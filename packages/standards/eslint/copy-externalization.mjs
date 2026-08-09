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
  return normalizeVisibleText(value).length === 0 ? [] : [{ node, text: value }];
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

  if (expression.type === "LogicalExpression") {
    if (expression.operator === "&&") {
      return collectStaticTextCandidates(expression.right);
    }

    return [
      ...collectStaticTextCandidates(expression.left),
      ...collectStaticTextCandidates(expression.right),
    ];
  }

  if (expression.type === "BinaryExpression") {
    return expression.operator === "+"
      ? [
          ...collectStaticTextCandidates(expression.left),
          ...collectStaticTextCandidates(expression.right),
        ]
      : [];
  }

  if (expression.type === "SequenceExpression") {
    return collectStaticTextCandidates(expression.expressions.at(-1));
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

  if (!expression) {
    return [];
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

  if (expression.type === "ConditionalExpression") {
    return [
      ...collectAllStaticTextCandidates(expression.consequent),
      ...collectAllStaticTextCandidates(expression.alternate),
    ];
  }

  if (expression.type === "LogicalExpression") {
    if (expression.operator === "&&") {
      return collectAllStaticTextCandidates(expression.right);
    }

    return [
      ...collectAllStaticTextCandidates(expression.left),
      ...collectAllStaticTextCandidates(expression.right),
    ];
  }

  if (expression.type === "SequenceExpression") {
    return collectAllStaticTextCandidates(expression.expressions.at(-1));
  }

  return collectStaticTextCandidates(expression);
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

function readName(node) {
  if (node?.type === "Identifier") {
    return node.name;
  }

  if (node?.type === "Literal" && typeof node.value === "string") {
    return node.value;
  }

  return undefined;
}

function collectExportedLocalNames(program) {
  const localNamesByExport = new Map([
    ["generateMetadata", new Set()],
    ["metadata", new Set()],
  ]);

  for (const statement of program.body) {
    if (statement.type !== "ExportNamedDeclaration" || statement.source) {
      continue;
    }

    const declaration = statement.declaration;

    if (declaration?.type === "VariableDeclaration") {
      for (const declarator of declaration.declarations) {
        const localName = readName(declarator.id);
        localNamesByExport.get(localName)?.add(localName);
      }
    } else if (declaration?.type === "FunctionDeclaration") {
      const localName = readName(declaration.id);
      localNamesByExport.get(localName)?.add(localName);
    }

    for (const specifier of statement.specifiers) {
      if (specifier.type !== "ExportSpecifier") {
        continue;
      }

      const exportedName = readName(specifier.exported);
      const localName = readName(specifier.local);

      if (localName) {
        localNamesByExport.get(exportedName)?.add(localName);
      }
    }
  }

  return localNamesByExport;
}

function isTopLevelVariable(node) {
  const declaration = node.parent;
  const declarationParent = declaration?.parent;

  return (
    declaration?.type === "VariableDeclaration" &&
    (declarationParent?.type === "Program" ||
      (declarationParent?.type === "ExportNamedDeclaration" &&
        declarationParent.parent?.type === "Program"))
  );
}

function isNamedExportedVariable(node, localNames) {
  return (
    node.id.type === "Identifier" &&
    localNames.has(node.id.name) &&
    isTopLevelVariable(node)
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

function isExportedGenerateMetadataFunction(node, localNames) {
  if (node.type === "FunctionDeclaration") {
    return (
      node.id &&
      localNames.has(node.id.name) &&
      (node.parent?.type === "Program" ||
        (node.parent?.type === "ExportNamedDeclaration" &&
          node.parent.parent?.type === "Program"))
    );
  }

  const declarator = node.parent;
  return (
    declarator?.type === "VariableDeclarator" &&
    isNamedExportedVariable(declarator, localNames)
  );
}

function inspectMetadataNode(node, reportCandidates) {
  const expression = unwrapExpression(node);

  if (!expression) {
    return;
  }

  if (expression.type === "ConditionalExpression") {
    inspectMetadataNode(expression.consequent, reportCandidates);
    inspectMetadataNode(expression.alternate, reportCandidates);
    return;
  }

  if (expression.type === "LogicalExpression") {
    if (expression.operator !== "&&") {
      inspectMetadataNode(expression.left, reportCandidates);
    }
    inspectMetadataNode(expression.right, reportCandidates);
    return;
  }

  if (expression.type === "SequenceExpression") {
    inspectMetadataNode(expression.expressions.at(-1), reportCandidates);
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
    let exportedLocalNames = new Map();

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
      Program(node) {
        exportedLocalNames = collectExportedLocalNames(node);
      },
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
          isExportedGenerateMetadataFunction(
            containingFunction,
            exportedLocalNames.get("generateMetadata") ?? new Set(),
          )
        ) {
          inspectMetadataNode(node.argument, (candidates) =>
            reportCandidates(candidates, "metadata"),
          );
        }
      },
      VariableDeclarator(node) {
        if (
          isNamedExportedVariable(
            node,
            exportedLocalNames.get("metadata") ?? new Set(),
          )
        ) {
          inspectMetadataNode(node.init, (candidates) =>
            reportCandidates(candidates, "metadata"),
          );
        }

        if (
          isNamedExportedVariable(
            node,
            exportedLocalNames.get("generateMetadata") ?? new Set(),
          ) &&
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
