import typescriptEslint from "typescript-eslint";

const defaultFiles = ["app/**/*.{ts,tsx}", "src/**/*.{ts,tsx}"];
const userVisibleAttributeNames = new Set([
  "alt",
  "aria-label",
  "placeholder",
  "title",
]);
const userVisibleMetadataNames = new Set([
  "alt",
  "applicationName",
  "creator",
  "description",
  "publisher",
  "title",
]);
const expressionWrapperTypes = new Set([
  "ChainExpression",
  "ParenthesizedExpression",
  "TSAsExpression",
  "TSInstantiationExpression",
  "TSNonNullExpression",
  "TSSatisfiesExpression",
  "TSTypeAssertion",
]);

function isNonEmptyStringArray(value, { requireValues = false } = {}) {
  return (
    Array.isArray(value) &&
    (!requireValues || value.length > 0) &&
    value.every(
      (item) => typeof item === "string" && item.trim().length > 0,
    ) &&
    new Set(value).size === value.length
  );
}

function unwrapExpression(node) {
  let currentNode = node;

  while (
    currentNode &&
    expressionWrapperTypes.has(currentNode.type) &&
    "expression" in currentNode
  ) {
    currentNode = currentNode.expression;
  }

  return currentNode;
}

function normalizeVisibleText(value) {
  return value.replace(/\s+/gu, " ").trim();
}

function createTextCandidate(node, value) {
  const text = normalizeVisibleText(value);
  return text.length === 0 ? [] : [{ node, text }];
}

function collectStaticTextCandidates(node) {
  const expression = unwrapExpression(node);

  if (!expression) {
    return [];
  }

  if (expression.type === "Literal" && typeof expression.value === "string") {
    return createTextCandidate(expression, expression.value);
  }

  if (expression.type === "TemplateLiteral") {
    return expression.quasis.flatMap((quasi) =>
      createTextCandidate(quasi, quasi.value.cooked ?? quasi.value.raw),
    );
  }

  if (expression.type === "ConditionalExpression") {
    return [
      ...collectStaticTextCandidates(expression.consequent),
      ...collectStaticTextCandidates(expression.alternate),
    ];
  }

  if (
    expression.type === "LogicalExpression" ||
    expression.type === "BinaryExpression"
  ) {
    return [
      ...collectStaticTextCandidates(expression.left),
      ...collectStaticTextCandidates(expression.right),
    ];
  }

  if (expression.type === "SequenceExpression") {
    return expression.expressions.flatMap(collectStaticTextCandidates);
  }

  if (expression.type === "ArrayExpression") {
    return expression.elements.flatMap((element) =>
      element ? collectStaticTextCandidates(element) : [],
    );
  }

  return [];
}

function collectAllStaticTextCandidates(node) {
  const expression = unwrapExpression(node);
  const directCandidates = collectStaticTextCandidates(expression);

  if (directCandidates.length > 0 || !expression) {
    return directCandidates;
  }

  if (expression.type === "ObjectExpression") {
    return expression.properties.flatMap((property) =>
      property.type === "Property"
        ? collectAllStaticTextCandidates(property.value)
        : [],
    );
  }

  if (expression.type === "ArrayExpression") {
    return expression.elements.flatMap((element) =>
      element ? collectAllStaticTextCandidates(element) : [],
    );
  }

  return [];
}

function readPropertyName(property) {
  if (property.type !== "Property" || property.computed) {
    return undefined;
  }

  if (property.key.type === "Identifier") {
    return property.key.name;
  }

  if (property.key.type === "Literal" && typeof property.key.value === "string") {
    return property.key.value;
  }

  return undefined;
}

function isNamedExportedVariable(node, name) {
  return (
    node.id.type === "Identifier" &&
    node.id.name === name &&
    node.parent?.type === "VariableDeclaration" &&
    node.parent.parent?.type === "ExportNamedDeclaration"
  );
}

function findNearestFunction(node) {
  let currentNode = node.parent;

  while (currentNode) {
    if (
      currentNode.type === "ArrowFunctionExpression" ||
      currentNode.type === "FunctionDeclaration" ||
      currentNode.type === "FunctionExpression"
    ) {
      return currentNode;
    }

    currentNode = currentNode.parent;
  }

  return undefined;
}

function isExportedGenerateMetadataFunction(node) {
  if (node.type === "FunctionDeclaration") {
    return (
      node.id?.name === "generateMetadata" &&
      node.parent?.type === "ExportNamedDeclaration"
    );
  }

  const declarator = node.parent;
  return (
    declarator?.type === "VariableDeclarator" &&
    declarator.id.type === "Identifier" &&
    declarator.id.name === "generateMetadata" &&
    declarator.parent?.type === "VariableDeclaration" &&
    declarator.parent.parent?.type === "ExportNamedDeclaration"
  );
}

function inspectMetadataNode(node, reportCandidates) {
  const expression = unwrapExpression(node);

  if (!expression) {
    return;
  }

  if (expression.type === "ArrayExpression") {
    for (const element of expression.elements) {
      if (element) {
        inspectMetadataNode(element, reportCandidates);
      }
    }
    return;
  }

  if (expression.type !== "ObjectExpression") {
    return;
  }

  for (const property of expression.properties) {
    if (property.type !== "Property") {
      continue;
    }

    const propertyName = readPropertyName(property);

    if (propertyName && userVisibleMetadataNames.has(propertyName)) {
      reportCandidates(collectAllStaticTextCandidates(property.value));
    } else {
      inspectMetadataNode(property.value, reportCandidates);
    }
  }
}

const externalizeVisibleCopyRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require static user-visible copy to originate from validated content or localization.",
    },
    schema: [
      {
        type: "object",
        properties: {
          invariantLiterals: {
            type: "array",
            items: { type: "string", minLength: 1 },
            uniqueItems: true,
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      attribute:
        "Move this user-visible attribute value to validated content or localization.",
      jsx: "Move user-visible JSX text to validated content or localization.",
      metadata:
        "Move this user-visible metadata value to validated content or localization.",
    },
  },
  create(context) {
    const invariantLiterals = new Set(
      context.options[0]?.invariantLiterals ?? [],
    );
    const reportedNodes = new WeakSet();

    function reportCandidates(candidates, messageId) {
      for (const candidate of candidates) {
        if (
          invariantLiterals.has(candidate.text) ||
          reportedNodes.has(candidate.node)
        ) {
          continue;
        }

        reportedNodes.add(candidate.node);
        context.report({ node: candidate.node, messageId });
      }
    }

    return {
      JSXAttribute(node) {
        const attributeName =
          node.name.type === "JSXIdentifier" ? node.name.name : undefined;

        if (!attributeName || !userVisibleAttributeNames.has(attributeName)) {
          return;
        }

        if (node.value?.type === "Literal" && typeof node.value.value === "string") {
          reportCandidates(
            createTextCandidate(node.value, node.value.value),
            "attribute",
          );
        } else if (node.value?.type === "JSXExpressionContainer") {
          reportCandidates(
            collectStaticTextCandidates(node.value.expression),
            "attribute",
          );
        }
      },
      JSXExpressionContainer(node) {
        if (node.parent?.type === "JSXAttribute") {
          return;
        }

        reportCandidates(collectStaticTextCandidates(node.expression), "jsx");
      },
      JSXText(node) {
        reportCandidates(createTextCandidate(node, node.value), "jsx");
      },
      ReturnStatement(node) {
        const containingFunction = findNearestFunction(node);

        if (
          containingFunction &&
          isExportedGenerateMetadataFunction(containingFunction)
        ) {
          inspectMetadataNode(node.argument, (candidates) =>
            reportCandidates(candidates, "metadata"),
          );
        }
      },
      VariableDeclarator(node) {
        if (isNamedExportedVariable(node, "metadata")) {
          inspectMetadataNode(node.init, (candidates) =>
            reportCandidates(candidates, "metadata"),
          );
        }

        if (
          isNamedExportedVariable(node, "generateMetadata") &&
          node.init?.type === "ArrowFunctionExpression" &&
          node.init.expression
        ) {
          inspectMetadataNode(node.init.body, (candidates) =>
            reportCandidates(candidates, "metadata"),
          );
        }
      },
    };
  },
};

const copyExternalizationPlugin = {
  meta: {
    name: "@egeria-systems/standards-copy-externalization",
  },
  rules: {
    "externalize-visible-copy": externalizeVisibleCopyRule,
  },
};

export function createCopyExternalizationConfig({
  files = defaultFiles,
  invariantLiterals = [],
} = {}) {
  if (
    !isNonEmptyStringArray(files, { requireValues: true }) ||
    !isNonEmptyStringArray(invariantLiterals)
  ) {
    throw new TypeError("COPY_EXTERNALIZATION_CONFIG_INVALID");
  }

  const configuredFiles = [...files];
  const configuredInvariantLiterals = [...invariantLiterals];

  return {
    name: "@egeria-systems/standards/copy-externalization",
    files: configuredFiles,
    languageOptions: {
      parser: typescriptEslint.parser,
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@egeria-systems/copy": copyExternalizationPlugin,
    },
    rules: {
      "@egeria-systems/copy/externalize-visible-copy": [
        "error",
        { invariantLiterals: configuredInvariantLiterals },
      ],
    },
  };
}
