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

test("the private package manifests expose only their approved runtime boundaries", async () => {
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
    exports: {
      ".": {
        types: "./dist/index.d.ts",
        import: "./dist/index.js",
      },
      "./package.json": "./package.json",
    },
    scripts: {
      build: "tsc -p tsconfig.json",
      lint:
        "pnpm --dir ../.. exec eslint packages/builder-core/src --max-warnings 0",
      "schema:check": "node scripts/generate-json-schemas.mjs --check",
      "schema:generate": "node scripts/generate-json-schemas.mjs",
      test: "node --test tests/*.test.mjs",
      typecheck: "tsc -p tsconfig.json --noEmit",
      verify:
        "pnpm run build && pnpm run schema:check && pnpm run test && pnpm run typecheck && pnpm run lint",
    },
    dependencies: {
      yaml: "2.9.0",
      zod: "4.4.3",
    },
    devDependencies: {
      "@egeria-systems/standards": "workspace:*",
      "@types/node": "22.20.1",
      typescript: "6.0.3",
    },
  });
});

test("the private packages compile through the shared strict contract", async () => {
  const expectedCliConfig = {
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
  assert.deepEqual(await readJson("apps/cli/tsconfig.json"), expectedCliConfig);
  assert.deepEqual(
    await readJson("packages/builder-core/tsconfig.json"),
    {
      ...expectedCliConfig,
      compilerOptions: {
        ...expectedCliConfig.compilerOptions,
        types: ["node"],
      },
    },
  );
});

test("the CLI remains an empty shell while builder-core owns only approved Task 3 surfaces", async () => {
  const expectedSource = "export {};\n";

  assert.deepEqual(
    await listFiles(resolve(repositoryRoot, "apps/cli/src")),
    ["index.ts"],
  );
  assert.equal(
    await readFile(resolve(repositoryRoot, "apps/cli/src/index.ts"), "utf8"),
    expectedSource,
  );

  const builderCoreSourceFiles = await listFiles(
    resolve(repositoryRoot, "packages/builder-core/src"),
  );

  assert.deepEqual(
    builderCoreSourceFiles,
    [
      "catalog/capability-catalog.ts",
      "contracts/capability.ts",
      "contracts/identifiers.ts",
      "contracts/json-schemas.ts",
      "contracts/migration.ts",
      "contracts/profile.ts",
      "contracts/project.ts",
      "contracts/result.ts",
      "contracts/state.ts",
      "index.ts",
      "manifest/create-installed-manifest.ts",
      "ownership/fingerprint.ts",
      "ownership/materialize-surfaces.ts",
      "profiles/profile-recipes.ts",
      "resolution/resolve-capabilities.ts",
      "serialization/canonical-json.ts",
      "state/codecs.ts",
    ],
  );
  assert.equal(
    builderCoreSourceFiles.includes("catalog/p1-capabilities.ts"),
    false,
  );
  assert.equal(
    builderCoreSourceFiles.includes("profiles/p1-profiles.ts"),
    false,
  );
});

test("builder-core direct consumers describe the private Task 3 boundary", async () => {
  const builderInstructions = await readFile(
    resolve(repositoryRoot, "packages/builder-core/AGENTS.md"),
    "utf8",
  );
  const builderReadme = await readFile(
    resolve(repositoryRoot, "packages/builder-core/README.md"),
    "utf8",
  );
  const packageOwnership = await readFile(
    resolve(repositoryRoot, "docs/architecture/package-ownership.md"),
    "utf8",
  );

  assert.match(builderInstructions, /P1 Task 3/);
  assert.match(builderInstructions, /strict `.egeria` codecs/);
  assert.match(builderInstructions, /does not create `.egeria` files/);
  assert.match(builderInstructions, /inference remains deferred to Task 4/);

  assert.match(builderReadme, /P1 Task 3/);
  assert.match(builderReadme, /YAML 1.2/);
  assert.match(builderReadme, /SHA-256/);
  assert.match(builderReadme, /The CLI remains empty/);

  assert.match(packageOwnership, /through P1 Task 3/);
  assert.match(packageOwnership, /strict `.egeria` codecs/);
  assert.match(packageOwnership, /hybrid-ownership fingerprints/);
  assert.match(packageOwnership, /creates no `.egeria` files/);
  assert.doesNotMatch(
    packageOwnership,
    /`packages\/builder-core`[^\n]*Empty ESM ownership shell/,
  );
});

test("builder-core keeps schemas private and reserves every later-stage builder surface", async () => {
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
    "packages/builder-core/state",
    "packages/builder-core/templates",
  ]) {
    assert.equal(
      await pathExists(forbiddenPath),
      false,
      `${forbiddenPath} belongs to a later stage`,
    );
  }

  assert.deepEqual(
    await listFiles(resolve(repositoryRoot, "packages/builder-core/schemas")),
    [
      "capability.schema.json",
      "migration-record.schema.json",
      "profile.schema.json",
      "project.schema.json",
      "state.schema.json",
    ],
  );
});
