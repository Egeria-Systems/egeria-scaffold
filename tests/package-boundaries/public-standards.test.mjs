import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { exactSemanticVersionPattern } from "../helpers/semantic-version.mjs";

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

test("standards exposes only its approved public configuration APIs", async () => {
  assert.equal(
    await pathExists("packages/standards/package.json"),
    true,
    "the public standards manifest must exist",
  );

  const standardsManifest = await readJson("packages/standards/package.json");
  const { dependencies, devDependencies, ...stableManifest } =
    standardsManifest;

  assert.deepEqual(stableManifest, {
    name: "@egeria-systems/standards",
    version: "0.2.0",
    type: "module",
    license: "Apache-2.0",
    repository: {
      type: "git",
      url: "git+https://github.com/Egeria-Systems/egeria-scaffold.git",
      directory: "packages/standards",
    },
    files: ["eslint", "typescript", "README.md"],
    exports: {
      "./eslint/cloudflare-isolation": "./eslint/cloudflare-isolation.mjs",
      "./eslint/copy-externalization": "./eslint/copy-externalization.mjs",
      "./eslint/typescript-strict": "./eslint/typescript-strict.mjs",
      "./typescript/strict.json": "./typescript/strict.json",
      "./package.json": "./package.json",
    },
    scripts: {
      lint:
        "pnpm --dir ../.. exec eslint packages/standards/eslint --max-warnings 0",
      test: "node --test tests/*.test.mjs",
      verify: "pnpm run lint && pnpm run test",
      prepublishOnly: "pnpm run verify",
    },
    peerDependencies: {
      eslint: "^9.39.5 || ^10.8.0",
    },
    publishConfig: {
      access: "public",
      provenance: true,
      registry: "https://registry.npmjs.org/",
    },
  });
  assert.deepEqual(Object.keys(dependencies ?? {}), ["typescript-eslint"]);
  const typescriptEslintVersion = dependencies?.["typescript-eslint"];
  assert.equal(typeof typescriptEslintVersion, "string");
  assert.match(typescriptEslintVersion, exactSemanticVersionPattern);
  assert.equal(
    typescriptEslintVersion.split(".", 1)[0],
    "8",
    "the strict preset provider must remain on its supported major",
  );
  assert.deepEqual(Object.keys(devDependencies ?? {}).sort(), [
    "eslint",
    "eslint-10",
    "typescript",
  ]);
  for (const [surface, version, expectedMajor] of [
    ["ESLint 9 test dependency", devDependencies?.eslint, "9"],
    ["TypeScript", devDependencies?.typescript, "6"],
  ]) {
    assert.equal(typeof version, "string", surface);
    assert.match(version, exactSemanticVersionPattern, surface);
    assert.equal(
      version.split(".", 1)[0],
      expectedMajor,
      `${surface} must retain the supported major`,
    );
  }
  const eslint10Alias = devDependencies?.["eslint-10"];
  assert.equal(typeof eslint10Alias, "string", "ESLint 10 test dependency");
  const eslint10AliasMatch = /^npm:eslint@(?<version>.+)$/u.exec(
    eslint10Alias,
  );
  assert.ok(
    eslint10AliasMatch,
    "ESLint 10 must remain an npm alias",
  );
  const eslint10Version = eslint10AliasMatch.groups?.version;
  assert.equal(typeof eslint10Version, "string");
  assert.match(eslint10Version, exactSemanticVersionPattern);
  assert.equal(
    eslint10Version.split(".", 1)[0],
    "10",
    "the ESLint 10 test dependency must retain the supported major",
  );

  assert.equal(await pathExists("packages/standards/AGENTS.md"), true);
  assert.equal(await pathExists("packages/standards/README.md"), true);
  assert.equal(await pathExists("packages/standards/src"), false);
});

test("each standards API has a concrete workspace consumer", async () => {
  const [
    rootManifest,
    rootConfiguration,
    cliManifest,
    coreManifest,
    proofManifest,
  ] = await Promise.all([
    readJson("package.json"),
    readFile(resolve(repositoryRoot, "eslint.config.mjs"), "utf8"),
    readJson("apps/cli/package.json"),
    readJson("packages/builder-core/package.json"),
    readJson("proofs/nextjs-cloudflare/package.json"),
  ]);

  assert.equal(
    cliManifest.devDependencies?.["@egeria-systems/standards"],
    "workspace:*",
  );
  assert.equal(
    coreManifest.devDependencies?.["@egeria-systems/standards"],
    "workspace:*",
  );
  assert.equal(
    proofManifest.devDependencies?.["@egeria-systems/standards"],
    "workspace:*",
  );
  assert.equal(
    rootManifest.devDependencies?.["@egeria-systems/standards"],
    "workspace:*",
  );
  assert.equal(
    rootManifest.scripts?.["check:copy-externalization"],
    'eslint "packages/builder-core/templates/**/app/**/*.tsx" "packages/builder-core/templates/**/src/integrations/**/*.tsx" "packages/builder-core/templates/**/src/presentation/**/*.tsx" "packages/builder-core/templates/**/src/sections/**/*.tsx" --config eslint.config.mjs --max-warnings 0',
  );
  assert.match(
    rootConfiguration,
    /createCopyExternalizationConfig/u,
  );
});
