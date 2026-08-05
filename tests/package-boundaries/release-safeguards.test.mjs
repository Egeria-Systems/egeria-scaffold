import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  access,
  mkdtemp,
  readFile,
  readdir,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

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
    "./package.json": "./package.json",
  });
  assert.equal(
    observabilityManifest.scripts?.prepublishOnly,
    "pnpm run verify",
  );
  assert.deepEqual(observabilityManifest.publishConfig, expectedPublishConfig);
});

test("root release commands use the pinned Changesets boundary", async () => {
  const rootManifest = await readJson("package.json");

  assert.equal(rootManifest.devDependencies?.["@changesets/cli"], "2.31.1");
  assert.deepEqual(
    {
      build: rootManifest.scripts?.["build:p0.3"],
      changeset: rootManifest.scripts?.changeset,
      changesetStatus: rootManifest.scripts?.["changeset:status"],
      builderCoreTests: rootManifest.scripts?.["test:builder-core"],
      lint: rootManifest.scripts?.["lint:p0.3"],
      release: rootManifest.scripts?.["release-packages"],
      packageBoundaries: rootManifest.scripts?.["test:package-boundaries"],
      packageTests: rootManifest.scripts?.["test:packages"],
      test: rootManifest.scripts?.test,
      typecheck: rootManifest.scripts?.["typecheck:p0.3"],
      verify: rootManifest.scripts?.["verify:p0.3"],
      version: rootManifest.scripts?.["version-packages"],
    },
    {
      build:
        "pnpm --filter @egeria-systems/cli --filter @egeria-systems/builder-core --filter @egeria-systems/observability run build",
      changeset: "changeset",
      changesetStatus: "changeset status",
      builderCoreTests:
        "pnpm --filter @egeria-systems/builder-core run build && node --test packages/builder-core/tests/*.test.mjs",
      lint:
        "pnpm --filter @egeria-systems/cli --filter @egeria-systems/builder-core --filter @egeria-systems/standards --filter @egeria-systems/observability run lint",
      release: "changeset publish",
      packageBoundaries: "node --test tests/package-boundaries/*.test.mjs",
      packageTests:
        "pnpm --filter @egeria-systems/standards --filter @egeria-systems/observability run test",
      test:
        "pnpm run test:constitution && pnpm --filter @egeria-systems/nextjs-cloudflare-proof test:unit && pnpm run test:package-boundaries && pnpm run test:builder-core && pnpm run test:packages",
      typecheck:
        "pnpm --filter @egeria-systems/cli --filter @egeria-systems/builder-core --filter @egeria-systems/observability run typecheck",
      verify:
        "pnpm run test:constitution && pnpm run test:package-boundaries && pnpm run lint:p0.3 && pnpm run build:p0.3 && pnpm run test:packages && pnpm run typecheck:p0.3 && pnpm run changeset:status",
      version: "changeset version",
    },
  );

  assert.deepEqual(
    Object.entries(rootManifest.scripts)
      .filter(([, command]) => command.includes("publish")),
    [["release-packages", "changeset publish"]],
  );
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

test("the initial release intent contains only public minor releases", async () => {
  assert.equal(
    await pathExists(".changeset/lean-builder-monorepo.md"),
    true,
    "the initial public-package Changeset must exist",
  );

  const changesetFiles = (await readdir(resolve(repositoryRoot, ".changeset")))
    .filter((file) => file.endsWith(".md") && file !== "README.md")
    .sort();
  assert.deepEqual(changesetFiles, ["lean-builder-monorepo.md"]);

  const changeset = await readFile(
    resolve(repositoryRoot, ".changeset/lean-builder-monorepo.md"),
    "utf8",
  );
  assert.match(changeset, /strict type-aware ESLint configuration/i);

  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "egeria-changeset-status-"),
  );
  const statusPath = join(temporaryDirectory, "status.json");

  try {
    await execFileAsync(
      "pnpm",
      ["exec", "changeset", "status", "--output", statusPath],
      { cwd: repositoryRoot, encoding: "utf8" },
    );
    const status = JSON.parse(await readFile(statusPath, "utf8"));

    assert.deepEqual(
      status.releases
        .filter((release) => release.type !== "none")
        .map((release) => ({ name: release.name, type: release.type }))
        .sort((left, right) => left.name.localeCompare(right.name)),
      [
        { name: "@egeria-systems/observability", type: "minor" },
        { name: "@egeria-systems/standards", type: "minor" },
      ],
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("public package dry runs contain only approved files", async () => {
  assert.deepEqual(await listPackedFiles("@egeria-systems/standards"), [
    "README.md",
    "eslint/cloudflare-isolation.mjs",
    "eslint/typescript-strict.mjs",
    "package.json",
    "typescript/strict.json",
  ]);

  await execFileAsync(
    "pnpm",
    ["--filter", "@egeria-systems/observability", "run", "build"],
    { cwd: repositoryRoot, encoding: "utf8" },
  );

  assert.deepEqual(await listPackedFiles("@egeria-systems/observability"), [
    "README.md",
    "dist/index.d.ts",
    "dist/index.js",
    "package.json",
  ]);
});
