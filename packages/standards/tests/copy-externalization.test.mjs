import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import test from "node:test";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const configPath = resolve(packageRoot, "eslint/copy-externalization.mjs");
const eslintPackages = [
  ["ESLint 9", "eslint"],
  ["ESLint 10", "eslint-10"],
];
const ruleId = "@egeria-systems/copy/externalize-visible-copy";

async function loadCopyExternalizationFactory() {
  try {
    await access(configPath);
  } catch {
    assert.fail(
      "eslint/copy-externalization.mjs must be a public standards API",
    );
  }

  const standardsModule = await import(pathToFileURL(configPath));
  return standardsModule.createCopyExternalizationConfig;
}

async function lintSource(
  eslintPackage,
  source,
  { invariantLiterals = [] } = {},
) {
  const createCopyExternalizationConfig =
    await loadCopyExternalizationFactory();
  const { Linter } = await import(eslintPackage);
  const linter = new Linter({ configType: "flat" });

  return linter.verify(
    source,
    [
      createCopyExternalizationConfig({
        files: ["app/**/*.tsx"],
        invariantLiterals,
      }),
    ],
    { filename: "app/example.tsx" },
  );
}

function selectDiagnostics(messages) {
  return messages.map(({ message, ruleId: messageRuleId, severity }) => ({
    message,
    ruleId: messageRuleId,
    severity,
  }));
}

test("the copy config rejects invalid file and invariant allowlists", async () => {
  const createCopyExternalizationConfig =
    await loadCopyExternalizationFactory();
  const expectedError = {
    name: "TypeError",
    message: "COPY_EXTERNALIZATION_CONFIG_INVALID",
  };

  assert.throws(
    () => createCopyExternalizationConfig({ files: [] }),
    expectedError,
  );
  assert.throws(
    () => createCopyExternalizationConfig({ files: [""] }),
    expectedError,
  );
  assert.throws(
    () => createCopyExternalizationConfig({ invariantLiterals: "fixed" }),
    expectedError,
  );
  assert.throws(
    () =>
      createCopyExternalizationConfig({
        invariantLiterals: ["same", "same"],
      }),
    expectedError,
  );
  assert.throws(
    () => createCopyExternalizationConfig({ invariantLiterals: [" "] }),
    expectedError,
  );
});

for (const [eslintName, eslintPackage] of eslintPackages) {
  test(`${eslintName} accepts content-backed copy and technical literals`, async () => {
    const messages = await lintSource(
      eslintPackage,
      `import type { Metadata } from "next";

const content = {
  title: externalContent.title,
  description: externalContent.description,
  label: externalContent.label,
};

export const metadata: Metadata = {
  title: content.title,
  description: content.description,
  metadataBase: new URL("https://example.com"),
  robots: { index: true },
};

export function Example() {
  console.error("INTERNAL_RENDER_FAILURE");
  return (
    <main aria-label={content.label} title={content.title}>
      {content.description}
      <input alt={content.label} placeholder={content.label} />
    </main>
  );
}
`,
    );

    assert.deepEqual(messages, []);
  });

  test(`${eslintName} rejects JSX text and child-expression literals`, async () => {
    const messages = await lintSource(
      eslintPackage,
      `export function Example({ label }: { label: string }) {
  return (
    <main>
      Literal child
      {true ? \`Literal \${label}\` : label}
      {"Literal expression"}
    </main>
  );
}
`,
    );

    assert.deepEqual(selectDiagnostics(messages), [
      {
        message:
          "Move user-visible JSX text to validated content or localization.",
        ruleId,
        severity: 2,
      },
      {
        message:
          "Move user-visible JSX text to validated content or localization.",
        ruleId,
        severity: 2,
      },
      {
        message:
          "Move user-visible JSX text to validated content or localization.",
        ruleId,
        severity: 2,
      },
    ]);
    assert.ok(messages.every(({ message }) => !message.includes("Literal")));
  });

  test(`${eslintName} rejects literals in user-visible JSX attributes`, async () => {
    const messages = await lintSource(
      eslintPackage,
      `export function Example() {
  return (
    <main aria-label="Literal label" title={"Literal title"}>
      <input placeholder={true ? "Literal placeholder" : "Fallback"} />
      <img alt={\`Literal alt\`} />
    </main>
  );
}
`,
    );

    assert.deepEqual(
      selectDiagnostics(messages),
      Array.from({ length: 5 }, () => ({
        message:
          "Move this user-visible attribute value to validated content or localization.",
        ruleId,
        severity: 2,
      })),
    );
  });

  test(`${eslintName} rejects static visible metadata fields`, async () => {
    const messages = await lintSource(
      eslintPackage,
      `export const metadata = {
  title: {
    default: "Literal default",
    template: "%s | Literal template",
  },
  openGraph: {
    description: "Literal description",
    images: [{ url: "https://example.com/image.png", alt: "Literal alt" }],
  },
};

export function generateMetadata() {
  return {
    applicationName: "Literal application name",
    creator: "Literal creator",
    publisher: "Literal publisher",
  };
}
`,
    );

    assert.deepEqual(
      selectDiagnostics(messages),
      Array.from({ length: 7 }, () => ({
        message:
          "Move this user-visible metadata value to validated content or localization.",
        ruleId,
        severity: 2,
      })),
    );
  });

  test(`${eslintName} rejects metadata through result branches and named exports`, async () => {
    const messages = await lintSource(
      eslintPackage,
      `const pageMetadata = {
  title: condition
    ? { default: "Literal default", template: "%s | Literal template" }
    : { absolute: "Literal absolute" },
};

const buildMetadata = () =>
  condition
    ? { description: "Literal description" }
    : { title: { absolute: "Literal generated title" } };

export {
  pageMetadata as metadata,
  buildMetadata as generateMetadata,
};
`,
    );

    assert.deepEqual(
      selectDiagnostics(messages),
      Array.from({ length: 5 }, () => ({
        message:
          "Move this user-visible metadata value to validated content or localization.",
        ruleId,
        severity: 2,
      })),
    );

    const functionMessages = await lintSource(
      eslintPackage,
      `function createMetadata() {
  return { publisher: "Literal publisher" };
}

export { createMetadata as generateMetadata };
`,
    );

    assert.deepEqual(selectDiagnostics(functionMessages), [
      {
        message:
          "Move this user-visible metadata value to validated content or localization.",
        ruleId,
        severity: 2,
      },
    ]);
  });

  test(`${eslintName} ignores non-rendered JSX control literals`, async () => {
    assert.deepEqual(
      await lintSource(
        eslintPackage,
        `export function Example({ label, status }: { label: string; status: string }) {
  return (
    <main>
      {status === "ready" && label}
      {("debug", label)}
    </main>
  );
}
`,
      ),
      [],
    );
  });

  test(`${eslintName} rejects literals in result-producing JSX branches`, async () => {
    const messages = await lintSource(
      eslintPackage,
      `export function Example({ label, status }: { label: string; status: string }) {
  return (
    <main>
      {status ? label : "Literal alternate"}
      {label || "Literal fallback"}
      {label + " literal suffix"}
    </main>
  );
}
`,
    );

    assert.deepEqual(
      selectDiagnostics(messages),
      Array.from({ length: 3 }, () => ({
        message:
          "Move user-visible JSX text to validated content or localization.",
        ruleId,
        severity: 2,
      })),
    );
  });

  test(`${eslintName} accepts only exact configured invariant literals`, async () => {
    assert.deepEqual(
      await lintSource(eslintPackage, "export const value = <span>·</span>;", {
        invariantLiterals: ["·"],
      }),
      [],
    );

    const messages = await lintSource(
      eslintPackage,
      "export const value = <span>•</span>;",
      { invariantLiterals: ["·"] },
    );

    assert.deepEqual(selectDiagnostics(messages), [
      {
        message:
          "Move user-visible JSX text to validated content or localization.",
        ruleId,
        severity: 2,
      },
    ]);

    const whitespaceNearMatch = await lintSource(
      eslintPackage,
      "export const value = <span>A  B</span>;",
      { invariantLiterals: ["A B"] },
    );

    assert.deepEqual(selectDiagnostics(whitespaceNearMatch), [
      {
        message:
          "Move user-visible JSX text to validated content or localization.",
        ruleId,
        severity: 2,
      },
    ]);
  });

  test(`${eslintName} ignores whitespace-only JSX text`, async () => {
    assert.deepEqual(
      await lintSource(
        eslintPackage,
        `export const value = (
  <main>
    <span />
  </main>
);
`,
      ),
      [],
    );
  });
}
