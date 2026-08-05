import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);

async function pathExists(relativePath) {
  try {
    await access(resolve(repositoryRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function readJson(relativePath) {
  return JSON.parse(
    await readFile(resolve(repositoryRoot, relativePath), "utf8"),
  );
}

test("the builder root owns an exact ESLint 10 lint boundary", async () => {
  const rootManifest = await readJson("package.json");

  assert.equal(await pathExists("eslint.config.mjs"), true);
  assert.deepEqual(
    {
      eslint: rootManifest.devDependencies?.eslint,
      eslintJs: rootManifest.devDependencies?.["@eslint/js"],
      standards: rootManifest.devDependencies?.["@egeria-systems/standards"],
    },
    {
      eslint: "10.8.0",
      eslintJs: "10.0.1",
      standards: "workspace:*",
    },
  );
  assert.equal(
    rootManifest.scripts?.["lint:p0.3"],
    "pnpm --filter @egeria-systems/cli --filter @egeria-systems/builder-core --filter @egeria-systems/standards --filter @egeria-systems/observability run lint",
  );
  assert.match(rootManifest.scripts?.["verify:p0.3"] ?? "", /lint:p0\.3/);
});

test("ESLint 10 applies the builder root config to standards source", async () => {
  const { ESLint } = await import("eslint");
  const eslint = new ESLint({
    cwd: repositoryRoot,
    overrideConfigFile: resolve(repositoryRoot, "eslint.config.mjs"),
  });

  const [result] = await eslint.lintText("missingBuilderGlobal;\n", {
    filePath: resolve(
      repositoryRoot,
      "packages/standards/eslint/compatibility-boundary.mjs",
    ),
  });

  assert.equal(ESLint.version, "10.8.0");
  assert.deepEqual(
    result.messages.map(({ ruleId, severity }) => ({ ruleId, severity })),
    [{ ruleId: "no-undef", severity: 2 }],
  );
});

test("ESLint 10 applies typed strict linting through the builder root config", async () => {
  const { ESLint } = await import("eslint");
  const eslint = new ESLint({
    cwd: repositoryRoot,
    overrideConfigFile: resolve(repositoryRoot, "eslint.config.mjs"),
  });
  const filePath = resolve(repositoryRoot, "apps/cli/src/index.ts");
  const [invalidResult] = await eslint.lintText("Promise.resolve();\n", {
    filePath,
  });
  const [validResult] = await eslint.lintText("await Promise.resolve();\n", {
    filePath,
  });

  assert.deepEqual(
    invalidResult.messages.map(({ ruleId, severity }) => ({ ruleId, severity })),
    [{ ruleId: "@typescript-eslint/no-floating-promises", severity: 2 }],
  );
  assert.deepEqual(validResult.messages, []);
});

test("each immediate builder application and package delegates zero-warning lint to the root", async () => {
  const expectedScripts = new Map([
    [
      "apps/cli/package.json",
      "pnpm --dir ../.. exec eslint apps/cli/src --max-warnings 0",
    ],
    [
      "packages/builder-core/package.json",
      "pnpm --dir ../.. exec eslint packages/builder-core/src --max-warnings 0",
    ],
    [
      "packages/observability/package.json",
      "pnpm --dir ../.. exec eslint packages/observability/src --max-warnings 0",
    ],
    [
      "packages/standards/package.json",
      "pnpm --dir ../.. exec eslint packages/standards/eslint --max-warnings 0",
    ],
  ]);

  for (const [manifestPath, lintScript] of expectedScripts) {
    const manifest = await readJson(manifestPath);

    assert.equal(manifest.scripts?.lint, lintScript, manifestPath);
  }
});

test("the accepted Next proof keeps its package-local ESLint 9 boundary", async () => {
  const proofManifest = await readJson("proofs/nextjs-cloudflare/package.json");

  assert.equal(proofManifest.scripts?.lint, "eslint . --max-warnings 0");
  assert.deepEqual(
    {
      eslint: proofManifest.devDependencies?.eslint,
      next: proofManifest.devDependencies?.["eslint-config-next"],
      typescriptEslint: proofManifest.devDependencies?.["typescript-eslint"],
    },
    {
      eslint: "9.39.5",
      next: "16.3.0",
      typescriptEslint: "8.66.0",
    },
  );
});
