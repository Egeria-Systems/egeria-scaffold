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
  const rootConfiguration = await readFile(
    resolve(repositoryRoot, "eslint.config.mjs"),
    "utf8",
  );

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
    rootManifest.scripts?.["lint:builder"],
    "pnpm --filter @egeria-systems/cli --filter @egeria-systems/builder-core --filter @egeria-systems/standards --filter @egeria-systems/observability run lint && pnpm run check:copy-externalization",
  );
  assert.equal(
    rootManifest.scripts?.["check:copy-externalization"],
    'eslint "packages/builder-core/templates/**/app/**/*.tsx" "packages/builder-core/templates/**/src/integrations/**/*.tsx" "packages/builder-core/templates/**/src/presentation/**/*.tsx" "packages/builder-core/templates/**/src/sections/**/*.tsx" --config eslint.config.mjs --max-warnings 0',
  );
  assert.equal(
    rootManifest.scripts?.["check:semantic-naming"],
    "node scripts/check-semantic-naming.mjs",
  );
  assert.equal(await pathExists("scripts/check-semantic-naming.mjs"), true);
  assert.equal(
    await pathExists("scripts/eslint/no-sequencing-labels.mjs"),
    false,
  );
  assert.doesNotMatch(rootConfiguration, /noSequencingLabels|semantic-naming/u);
  assert.match(
    rootManifest.scripts?.["verify:builder-packages:quality"] ?? "",
    /pnpm run lint:builder/,
  );
  assert.match(
    rootManifest.scripts?.["verify:builder-packages"] ?? "",
    /pnpm run lint:builder/,
  );
});

test("copy externalization covers canonical builder TSX templates", async () => {
  const { ESLint } = await import("eslint");
  const eslint = new ESLint({
    cwd: repositoryRoot,
    overrideConfigFile: resolve(repositoryRoot, "eslint.config.mjs"),
  });
  const results = await eslint.lintFiles([
    "packages/builder-core/templates/**/app/**/*.tsx",
    "packages/builder-core/templates/**/src/integrations/**/*.tsx",
    "packages/builder-core/templates/**/src/presentation/**/*.tsx",
    "packages/builder-core/templates/**/src/sections/**/*.tsx",
  ]);

  assert.deepEqual(
    results.map(({ filePath, messages }) => ({
      filePath: filePath.slice(repositoryRoot.length + 1),
      messages,
    })),
    [
      {
        filePath:
          "packages/builder-core/templates/booking-calendly/apps/web/app/page.tsx",
        messages: [],
      },
      {
        filePath:
          "packages/builder-core/templates/booking-calendly/apps/web/src/integrations/booking-calendly/calendly-booking.tsx",
        messages: [],
      },
      {
        filePath:
          "packages/builder-core/templates/common/apps/web/app/error.tsx",
        messages: [],
      },
      {
        filePath:
          "packages/builder-core/templates/common/apps/web/app/global-error.tsx",
        messages: [],
      },
      {
        filePath:
          "packages/builder-core/templates/common/apps/web/app/layout.tsx",
        messages: [],
      },
      {
        filePath: "packages/builder-core/templates/common/apps/web/app/page.tsx",
        messages: [],
      },
      {
        filePath:
          "packages/builder-core/templates/common/apps/web/src/presentation/content-page.tsx",
        messages: [],
      },
      {
        filePath:
          "packages/builder-core/templates/common/apps/web/src/presentation/error-fallback.tsx",
        messages: [],
      },
      {
        filePath:
          "packages/builder-core/templates/common/apps/web/src/sections/section-registry.tsx",
        messages: [],
      },
      {
        filePath:
          "packages/builder-core/templates/site/apps/web/app/about/page.tsx",
        messages: [],
      },
      {
        filePath:
          "packages/builder-core/templates/site/apps/web/app/about/production-page.tsx",
        messages: [],
      },
      {
        filePath:
          "packages/builder-core/templates/site/apps/web/app/not-found.tsx",
        messages: [],
      },
      {
        filePath:
          "packages/builder-core/templates/site/apps/web/app/page-with-booking.tsx",
        messages: [],
      },
      {
        filePath:
          "packages/builder-core/templates/site/apps/web/app/page.tsx",
        messages: [],
      },
      {
        filePath:
          "packages/builder-core/templates/site/apps/web/app/work/error.tsx",
        messages: [],
      },
      {
        filePath:
          "packages/builder-core/templates/site/apps/web/app/work/featured/page.tsx",
        messages: [],
      },
      {
        filePath:
          "packages/builder-core/templates/site/apps/web/app/work/page.tsx",
        messages: [],
      },
    ],
  );

  const [invalidResult] = await eslint.lintText(
    "export default function Page() { return <main>Literal</main>; }\n",
    {
      filePath: resolve(
        repositoryRoot,
        "packages/builder-core/templates/common/apps/web/app/page.tsx",
      ),
    },
  );

  assert.deepEqual(
    invalidResult.messages.map(({ ruleId, severity, message }) => ({
      ruleId,
      severity,
      message,
    })),
    [
      {
        ruleId: "@egeria-systems/copy/externalize-visible-copy",
        severity: 2,
        message:
          "Move user-visible JSX text to validated content or localization.",
      },
    ],
  );
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

test("builder lint does not execute generated-project configuration", async () => {
  const { ESLint } = await import("eslint");
  const eslint = new ESLint({
    cwd: repositoryRoot,
    overrideConfigFile: resolve(repositoryRoot, "eslint.config.mjs"),
  });

  assert.equal(
    await eslint.isPathIgnored(
      resolve(
        repositoryRoot,
        "packages/builder-core/templates/common/apps/web/eslint.config.mjs",
      ),
    ),
    true,
  );
});

test("each immediate builder application and package delegates zero-warning lint to the root", async () => {
  const expectedScripts = new Map([
    [
      "apps/cli/package.json",
      "pnpm --dir ../.. exec eslint apps/cli/src apps/cli/tests --max-warnings 0",
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
