import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, readFile, readdir } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
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

async function listFiles(directory, baseDirectory = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listFiles(path, baseDirectory)));
    } else {
      files.push(relative(baseDirectory, path));
    }
  }

  return files.sort();
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
    version: workspacePackage.version,
  }));
}

test("the workspace materializes the approved private builder boundaries", async () => {
  const workspacePackages = (await listWorkspacePackages()).sort((left, right) =>
    left.path.localeCompare(right.path),
  );

  assert.deepEqual(workspacePackages, [
    {
      name: "@egeria-systems/scaffold",
      path: ".",
      private: true,
      version: "0.0.0",
    },
    {
      name: "@egeria-systems/cli",
      path: "apps/cli",
      private: true,
      version: "0.0.0",
    },
    {
      name: "@egeria-systems/builder-core",
      path: "packages/builder-core",
      private: true,
      version: "0.0.0",
    },
    {
      name: "@egeria-systems/observability",
      path: "packages/observability",
      private: false,
      version: "0.0.0",
    },
    {
      name: "@egeria-systems/standards",
      path: "packages/standards",
      private: false,
      version: "0.0.0",
    },
    {
      name: "@egeria-systems/nextjs-cloudflare-proof",
      path: "proofs/nextjs-cloudflare",
      private: true,
      version: "0.0.0",
    },
  ]);
});

test("the private package manifests consume standards without a runtime API", async () => {
  assert.equal(await pathExists("apps/cli/package.json"), true);
  assert.equal(await pathExists("packages/builder-core/package.json"), true);

  assert.deepEqual(await readJson("apps/cli/package.json"), {
    name: "@egeria-systems/cli",
    version: "0.0.0",
    private: true,
    type: "module",
    scripts: {
      build: "tsc -p tsconfig.json",
      lint: "pnpm --dir ../.. exec eslint apps/cli/src --max-warnings 0",
      typecheck: "tsc -p tsconfig.json --noEmit",
    },
    devDependencies: {
      "@egeria-systems/standards": "workspace:*",
      typescript: "6.0.3",
    },
  });
  assert.deepEqual(await readJson("packages/builder-core/package.json"), {
    name: "@egeria-systems/builder-core",
    version: "0.0.0",
    private: true,
    type: "module",
    scripts: {
      build: "tsc -p tsconfig.json",
      lint:
        "pnpm --dir ../.. exec eslint packages/builder-core/src --max-warnings 0",
      typecheck: "tsc -p tsconfig.json --noEmit",
    },
    devDependencies: {
      "@egeria-systems/standards": "workspace:*",
      typescript: "6.0.3",
    },
  });
});

test("the private packages compile through the shared strict contract", async () => {
  const expectedConfig = {
    extends: "@egeria-systems/standards/typescript/strict.json",
    compilerOptions: {
      declaration: true,
      outDir: "dist",
      rootDir: "src",
    },
    include: ["src/**/*.ts"],
  };

  assert.equal(
    await pathExists("apps/cli/tsconfig.json"),
    true,
    "the CLI must consume the shared strict TypeScript API",
  );
  assert.equal(
    await pathExists("packages/builder-core/tsconfig.json"),
    true,
    "builder-core must consume the shared strict TypeScript API",
  );
  assert.deepEqual(await readJson("apps/cli/tsconfig.json"), expectedConfig);
  assert.deepEqual(
    await readJson("packages/builder-core/tsconfig.json"),
    expectedConfig,
  );
});

test("the private package sources remain empty ESM ownership shells", async () => {
  const expectedSource = "export {};\n";

  for (const sourceDirectory of [
    "apps/cli/src",
    "packages/builder-core/src",
  ]) {
    assert.equal(await pathExists(sourceDirectory), true);
    assert.deepEqual(
      await listFiles(resolve(repositoryRoot, sourceDirectory)),
      ["index.ts"],
    );
    assert.equal(
      await readFile(resolve(repositoryRoot, sourceDirectory, "index.ts"), "utf8"),
      expectedSource,
    );
  }
});

test("the private shells reserve later-stage surfaces without creating them", async () => {
  for (const requiredDocument of [
    "apps/cli/AGENTS.md",
    "apps/cli/README.md",
    "packages/builder-core/AGENTS.md",
    "packages/builder-core/README.md",
    "docs/architecture/package-ownership.md",
  ]) {
    assert.equal(
      await pathExists(requiredDocument),
      true,
      `${requiredDocument} must define or explain its boundary`,
    );
  }

  for (const forbiddenPath of [
    ".egeria",
    "packages/project-schema",
    "apps/cli/capabilities",
    "apps/cli/generators",
    "apps/cli/migrations",
    "apps/cli/profiles",
    "apps/cli/schemas",
    "apps/cli/state",
    "apps/cli/templates",
    "packages/builder-core/capabilities",
    "packages/builder-core/generators",
    "packages/builder-core/migrations",
    "packages/builder-core/profiles",
    "packages/builder-core/schemas",
    "packages/builder-core/state",
    "packages/builder-core/templates",
  ]) {
    assert.equal(
      await pathExists(forbiddenPath),
      false,
      `${forbiddenPath} belongs to a later stage`,
    );
  }
});
