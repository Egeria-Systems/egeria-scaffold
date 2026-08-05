import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import test from "node:test";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const configPath = resolve(packageRoot, "eslint/typescript-strict.mjs");
const fixtureRoot = resolve(
  packageRoot,
  "tests/fixtures/typescript-strict",
);
const eslintPackages = [
  ["ESLint 9", "eslint"],
  ["ESLint 10", "eslint-10"],
];

async function loadTypeScriptStrictFactory() {
  try {
    await access(configPath);
  } catch {
    assert.fail(
      "eslint/typescript-strict.mjs must be a public standards API",
    );
  }

  const standardsModule = await import(pathToFileURL(configPath));
  return standardsModule.createTypeScriptStrictConfig;
}

function collectRules(configs) {
  return Object.assign(
    {},
    ...configs.map((config) => config.rules ?? {}),
  );
}

test("the strict TypeScript factory requires an absolute project root", async () => {
  const createTypeScriptStrictConfig = await loadTypeScriptStrictFactory();

  assert.throws(
    () => createTypeScriptStrictConfig({ tsconfigRootDir: "." }),
    /tsconfigRootDir must be an absolute path/,
  );
});

test("the strict TypeScript factory owns only the approved typed presets", async () => {
  const createTypeScriptStrictConfig = await loadTypeScriptStrictFactory();
  const configs = createTypeScriptStrictConfig({
    tsconfigRootDir: fixtureRoot,
  });
  const rules = collectRules(configs);

  assert.ok(Array.isArray(configs));
  assert.ok(configs.length > 0);
  assert.ok(
    configs.every((config) =>
      config.files?.includes("**/*.{ts,tsx,mts,cts}"),
    ),
  );
  assert.ok(
    configs.every(
      (config) =>
        config.languageOptions?.parserOptions?.projectService === true &&
        config.languageOptions.parserOptions.tsconfigRootDir === fixtureRoot,
    ),
  );
  assert.equal(rules["@typescript-eslint/no-floating-promises"], "error");
  assert.equal(
    rules["@typescript-eslint/array-type"],
    "error",
    "the stylistic type-checked preset must be composed",
  );
  assert.equal(
    rules["@typescript-eslint/explicit-function-return-type"],
    undefined,
    "the all preset must not be composed",
  );
  assert.equal(rules.semi, undefined, "Prettier retains formatting ownership");
  assert.equal(
    rules["@typescript-eslint/semi"],
    undefined,
    "Prettier retains formatting ownership",
  );
});

for (const [eslintName, eslintPackage] of eslintPackages) {
  test(`${eslintName} accepts valid non-Prettier-formatted TypeScript`, async () => {
    const createTypeScriptStrictConfig = await loadTypeScriptStrictFactory();
    const { ESLint } = await import(eslintPackage);
    const eslint = new ESLint({
      cwd: fixtureRoot,
      overrideConfigFile: true,
      overrideConfig: createTypeScriptStrictConfig({
        tsconfigRootDir: fixtureRoot,
      }),
    });

    const [result] = await eslint.lintFiles(["valid.ts"]);

    assert.deepEqual(result.messages, []);
    assert.equal(result.errorCount, 0);
    assert.equal(result.warningCount, 0);
  });

  test(`${eslintName} reports a typed floating-promise defect`, async () => {
    const createTypeScriptStrictConfig = await loadTypeScriptStrictFactory();
    const { ESLint } = await import(eslintPackage);
    const eslint = new ESLint({
      cwd: fixtureRoot,
      overrideConfigFile: true,
      overrideConfig: createTypeScriptStrictConfig({
        tsconfigRootDir: fixtureRoot,
      }),
    });

    const [result] = await eslint.lintFiles(["invalid.ts"]);

    assert.equal(result.errorCount, 1);
    assert.deepEqual(
      result.messages.map(({ ruleId, severity }) => ({ ruleId, severity })),
      [{ ruleId: "@typescript-eslint/no-floating-promises", severity: 2 }],
    );
  });
}
