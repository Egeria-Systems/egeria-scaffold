import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

import {
  loadPendingChangesets,
  selectPendingChangesets,
} from "../../scripts/check-package-release.mjs";
import { exactSemanticVersionPattern } from "../helpers/semantic-version.mjs";

const execFileAsync = promisify(execFile);
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

async function listWorkspacePackages() {
  const { stdout } = await execFileAsync(
    "pnpm",
    ["list", "--recursive", "--depth", "-1", "--json"],
    { cwd: repositoryRoot, encoding: "utf8" },
  );

  return JSON.parse(stdout).map((workspacePackage) => ({
    name: workspacePackage.name,
    path: relative(repositoryRoot, workspacePackage.path) || ".",
    private: workspacePackage.private,
  }));
}

async function listPackedFiles(packageName) {
  const { stdout } = await execFileAsync(
    "pnpm",
    ["--filter", packageName, "pack", "--dry-run", "--json"],
    { cwd: repositoryRoot, encoding: "utf8", maxBuffer: 1024 * 1024 },
  );

  return JSON.parse(stdout)
    .files.map((file) => file.path)
    .sort();
}

test("only the approved public packages are locally publishable", async () => {
  const workspacePackages = await listWorkspacePackages();
  const packagesByName = new Map(
    workspacePackages.map((workspacePackage) => [
      workspacePackage.name,
      workspacePackage,
    ]),
  );

  for (const privatePackage of [
    { name: "@egeria-systems/scaffold", path: "." },
    { name: "@egeria-systems/cli", path: "apps/cli" },
    {
      name: "@egeria-systems/builder-core",
      path: "packages/builder-core",
    },
    {
      name: "@egeria-systems/nextjs-cloudflare-proof",
      path: "proofs/nextjs-cloudflare",
    },
  ]) {
    assert.deepEqual(packagesByName.get(privatePackage.name), {
      ...privatePackage,
      private: true,
    });
  }

  assert.deepEqual(
    workspacePackages
      .filter((workspacePackage) => workspacePackage.private !== true)
      .map((workspacePackage) => workspacePackage.name)
      .sort(),
    ["@egeria-systems/observability", "@egeria-systems/standards"],
  );
});

test("public package manifests constrain exports and publication", async () => {
  const standardsManifest = await readJson("packages/standards/package.json");
  const observabilityManifest = await readJson(
    "packages/observability/package.json",
  );
  const expectedPublishConfig = {
    access: "public",
    provenance: true,
    registry: "https://registry.npmjs.org/",
  };

  assert.deepEqual(standardsManifest.files, [
    "eslint",
    "typescript",
    "README.md",
  ]);
  assert.deepEqual(standardsManifest.exports, {
    "./eslint/cloudflare-isolation": "./eslint/cloudflare-isolation.mjs",
    "./eslint/copy-externalization": "./eslint/copy-externalization.mjs",
    "./eslint/typescript-strict": "./eslint/typescript-strict.mjs",
    "./typescript/strict.json": "./typescript/strict.json",
    "./package.json": "./package.json",
  });
  assert.equal(standardsManifest.scripts?.prepublishOnly, "pnpm run verify");
  assert.deepEqual(standardsManifest.publishConfig, expectedPublishConfig);

  assert.deepEqual(observabilityManifest.files, ["dist", "README.md"]);
  assert.deepEqual(observabilityManifest.exports, {
    ".": {
      types: "./dist/index.d.ts",
      import: "./dist/index.js",
    },
    "./browser": {
      types: "./dist/browser.d.ts",
      import: "./dist/browser.js",
    },
    "./server": {
      types: "./dist/server.d.ts",
      import: "./dist/server.js",
    },
    "./testing": {
      types: "./dist/testing.d.ts",
      import: "./dist/testing.js",
    },
    "./package.json": "./package.json",
  });
  assert.equal(
    observabilityManifest.scripts?.prepublishOnly,
    "pnpm run verify",
  );
  assert.deepEqual(observabilityManifest.publishConfig, expectedPublishConfig);
});

test("public source and package licenses are exact", async () => {
  const licensePaths = [
    "LICENSE",
    "packages/standards/LICENSE",
    "packages/observability/LICENSE",
  ];
  const licenses = await Promise.all(
    licensePaths.map((licensePath) =>
      readFile(resolve(repositoryRoot, licensePath)),
    ),
  );
  const [rootLicense] = licenses;
  const expectedRepository = (directory) => ({
    type: "git",
    url: "git+https://github.com/Egeria-Systems/egeria-scaffold.git",
    directory,
  });

  assert.ok(
    licenses.every((license) => license.equals(rootLicense)),
    "public license files must be byte-identical",
  );
  assert.equal(
    createHash("sha256").update(rootLicense).digest("hex"),
    "cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30",
  );

  for (const [manifestPath, directory] of [
    ["packages/standards/package.json", "packages/standards"],
    ["packages/observability/package.json", "packages/observability"],
  ]) {
    const manifest = await readJson(manifestPath);

    assert.equal(manifest.license, "Apache-2.0", manifestPath);
    assert.deepEqual(
      manifest.repository,
      expectedRepository(directory),
      manifestPath,
    );
  }
});

test("root release commands use the supported Changesets boundary", async () => {
  const rootManifest = await readJson("package.json");
  const changesetsVersion = rootManifest.devDependencies?.["@changesets/cli"];

  assert.equal(typeof changesetsVersion, "string");
  assert.match(changesetsVersion, exactSemanticVersionPattern);
  assert.equal(
    changesetsVersion.split(".", 1)[0],
    "3",
    "release commands must retain the supported Changesets major",
  );
  assert.equal(rootManifest.devDependencies?.npm, "12.0.2");
  assert.deepEqual(
    {
      build: rootManifest.scripts?.["build:builder"],
      copyExternalization:
        rootManifest.scripts?.["check:copy-externalization"],
      changeset: rootManifest.scripts?.changeset,
      changesetStatus: rootManifest.scripts?.["changeset:status"],
      releaseCheck: rootManifest.scripts?.["check:package-release"],
      builderCoreTests: rootManifest.scripts?.["test:builder-core"],
      cliTests: rootManifest.scripts?.["test:cli"],
      lint: rootManifest.scripts?.["lint:builder"],
      release: rootManifest.scripts?.["release-packages"],
      packageBoundaries: rootManifest.scripts?.["test:package-boundaries"],
      packageTests: rootManifest.scripts?.["test:packages"],
      test: rootManifest.scripts?.test,
      typecheck: rootManifest.scripts?.["typecheck:builder"],
      verify: rootManifest.scripts?.["verify:builder-packages"],
      verifyQuality:
        rootManifest.scripts?.["verify:builder-packages:quality"],
      verifyRelease:
        rootManifest.scripts?.["verify:package-release-candidate"],
      version: rootManifest.scripts?.["version-packages"],
    },
    {
      build:
        "pnpm --filter @egeria-systems/cli --filter @egeria-systems/builder-core --filter @egeria-systems/observability run build",
      copyExternalization:
        'eslint "packages/builder-core/templates/**/app/**/*.tsx" "packages/builder-core/templates/**/src/integrations/**/*.tsx" "packages/builder-core/templates/**/src/presentation/**/*.tsx" "packages/builder-core/templates/**/src/sections/**/*.tsx" --config eslint.config.mjs --max-warnings 0',
      changeset: "changeset",
      changesetStatus: "changeset status",
      releaseCheck: "node scripts/check-package-release.mjs",
      builderCoreTests:
        "pnpm --filter @egeria-systems/builder-core run build && node --test packages/builder-core/tests/*.test.mjs",
      cliTests:
        "pnpm --filter @egeria-systems/cli run build && pnpm --filter @egeria-systems/cli run test",
      lint:
        "pnpm --filter @egeria-systems/cli --filter @egeria-systems/builder-core --filter @egeria-systems/standards --filter @egeria-systems/observability run lint && pnpm run check:copy-externalization",
      release: "changeset publish",
      packageBoundaries: "node --test tests/package-boundaries/*.test.mjs",
      packageTests:
        "pnpm --filter @egeria-systems/standards --filter @egeria-systems/observability run test",
      test:
        "pnpm run test:constitution && pnpm --filter @egeria-systems/nextjs-cloudflare-proof test:unit && pnpm run test:package-boundaries && pnpm run test:builder-core && pnpm run test:cli && pnpm run test:packages",
      typecheck:
        "pnpm --filter @egeria-systems/cli --filter @egeria-systems/builder-core --filter @egeria-systems/observability run typecheck",
      verify:
        "pnpm run test:constitution && pnpm run test:package-boundaries && pnpm run build:builder && pnpm run lint:builder && pnpm run test:cli && pnpm run test:packages && pnpm run typecheck:builder && pnpm run changeset:status",
      verifyQuality:
        "pnpm run test:constitution && pnpm run test:package-boundaries && pnpm run build:builder && pnpm run lint:builder && pnpm run test:packages && pnpm run typecheck:builder",
      verifyRelease:
        "pnpm run verify:builder-packages:quality && pnpm run check:package-release local",
      version: "changeset version",
    },
  );

  assert.deepEqual(
    Object.entries(rootManifest.scripts)
      .filter(([, command]) => command.includes("publish")),
    [["release-packages", "changeset publish"]],
  );
});

test("public package verification builds workspace declarations before typed lint", async () => {
  const rootManifest = await readJson("package.json");

  for (const scriptName of [
    "verify:builder-packages",
    "verify:builder-packages:quality",
  ]) {
    const command = rootManifest.scripts?.[scriptName];

    assert.equal(typeof command, "string", scriptName);
    assert.ok(
      command.indexOf("pnpm run build:builder") >= 0,
      `${scriptName} must build workspace declarations`,
    );
    assert.ok(
      command.indexOf("pnpm run build:builder") <
        command.indexOf("pnpm run lint:builder"),
      `${scriptName} must build workspace declarations before typed lint`,
    );
  }
});

test("Changesets keeps a restricted default and excludes private releases", async () => {
  assert.equal(
    await pathExists(".changeset/config.json"),
    true,
    "the Changesets configuration must exist",
  );

  assert.deepEqual(await readJson(".changeset/config.json"), {
    changelog: "@changesets/cli/changelog",
    commit: false,
    fixed: [],
    linked: [],
    access: "restricted",
    baseBranch: "main",
    updateInternalDependencies: "patch",
    ignore: [],
    bumpVersionsWithWorkspaceProtocolOnly: true,
    privatePackages: {
      version: false,
      tag: false,
    },
  });
});

test("pending Changeset discovery selects every Markdown record in deterministic order", () => {
  assert.deepEqual(
    selectPendingChangesets([
      "generated-testing-boundary.md",
      "README.md",
      "notes.txt",
      "arbitrary-future.md",
      "clarify-observability-boundary.md",
    ]),
    [
      "arbitrary-future.md",
      "clarify-observability-boundary.md",
      "generated-testing-boundary.md",
    ],
  );
});

test("the release candidate materializes only the approved public versions", async () => {
  const changesetFiles = await loadPendingChangesets();
  assert.deepEqual(changesetFiles, [
    "observability-sink-identifiers.md",
  ]);

  const observabilityManifest = await readJson(
    "packages/observability/package.json",
  );
  const observabilityChangelog = await readFile(
    resolve(repositoryRoot, "packages/observability/CHANGELOG.md"),
    "utf8",
  );
  assert.equal(observabilityManifest.version, "0.3.0");
  assert.match(observabilityChangelog, /^# @egeria-systems\/observability$/m);
  assert.match(observabilityChangelog, /^## 0\.3\.0$/m);
  assert.match(observabilityChangelog, /^## 0\.2\.0$/m);
  assert.match(observabilityChangelog, /^## 0\.1\.0$/m);
  assert.match(observabilityChangelog, /restricted diagnostic contract/u);
  assert.match(observabilityChangelog, /schema `2\.0\.0`/u);
  assert.match(observabilityChangelog, /zero runtime dependencies/u);
  assert.match(observabilityChangelog, /not backward compatible/u);

  const standardsManifest = await readJson("packages/standards/package.json");
  const standardsChangelog = await readFile(
    resolve(repositoryRoot, "packages/standards/CHANGELOG.md"),
    "utf8",
  );
  assert.equal(standardsManifest.version, "0.2.0");
  assert.match(standardsChangelog, /^# @egeria-systems\/standards$/m);
  assert.doesNotMatch(standardsChangelog, /^## 0\.3\.0$/m);
  assert.match(standardsChangelog, /^## 0\.2\.0$/m);
  assert.match(standardsChangelog, /^## 0\.1\.0$/m);
  assert.match(
    standardsChangelog,
    /Add a flat ESLint config that rejects static user-visible JSX, relevant attribute, and Next\.js metadata copy outside validated content or localization sources\./,
  );
  assert.match(
    standardsChangelog,
    /Establish the initial public package APIs, including strict type-aware ESLint configuration, and release safeguards\./,
  );

  for (const manifestPath of [
    "package.json",
    "apps/cli/package.json",
    "packages/builder-core/package.json",
    "proofs/nextjs-cloudflare/package.json",
  ]) {
    assert.equal((await readJson(manifestPath)).version, "0.0.0", manifestPath);
  }

  const standardsReadme = await readFile(
    resolve(repositoryRoot, "packages/standards/README.md"),
    "utf8",
  );
  assert.match(standardsReadme, /copy API is included in version `0\.2\.0`/);
  assert.doesNotMatch(
    standardsReadme,
    /pending minor Changeset|does not contain it/,
  );
});

test("public package dry runs contain only approved files", async () => {
  assert.deepEqual(await listPackedFiles("@egeria-systems/standards"), [
    "LICENSE",
    "README.md",
    "eslint/cloudflare-isolation.mjs",
    "eslint/copy-externalization.mjs",
    "eslint/typescript-strict.mjs",
    "package.json",
    "typescript/strict.json",
  ]);

  await execFileAsync(
    "pnpm",
    [
      "--config.verify-deps-before-run=warn",
      "--filter",
      "@egeria-systems/observability",
      "run",
      "build",
    ],
    { cwd: repositoryRoot, encoding: "utf8" },
  );

  assert.deepEqual(await listPackedFiles("@egeria-systems/observability"), [
    "LICENSE",
    "README.md",
    "dist/browser.d.ts",
    "dist/browser.js",
    "dist/contracts.d.ts",
    "dist/contracts.js",
    "dist/diagnostics.d.ts",
    "dist/diagnostics.js",
    "dist/dispatch.d.ts",
    "dist/dispatch.js",
    "dist/events.d.ts",
    "dist/events.js",
    "dist/index.d.ts",
    "dist/index.js",
    "dist/redaction.d.ts",
    "dist/redaction.js",
    "dist/server.d.ts",
    "dist/server.js",
    "dist/testing.d.ts",
    "dist/testing.js",
    "package.json",
  ]);
});
