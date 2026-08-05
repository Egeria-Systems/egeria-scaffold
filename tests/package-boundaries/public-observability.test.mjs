import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
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

test("observability exposes only its approved empty public API", async () => {
  assert.equal(
    await pathExists("packages/observability/package.json"),
    true,
    "the public observability manifest must exist",
  );

  const manifest = await readJson("packages/observability/package.json");

  assert.deepEqual(manifest, {
    name: "@egeria-systems/observability",
    version: "0.0.0",
    type: "module",
    files: ["dist", "README.md"],
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
        "pnpm --dir ../.. exec eslint packages/observability/src --max-warnings 0",
      typecheck: "tsc -p tsconfig.json --noEmit",
      test: "node --test tests/*.test.mjs",
      verify:
        "pnpm run build && pnpm run lint && pnpm run test && pnpm run typecheck",
      prepublishOnly: "pnpm run verify",
    },
    devDependencies: {
      "@egeria-systems/standards": "workspace:*",
      typescript: "6.0.3",
    },
    publishConfig: {
      access: "public",
      provenance: true,
      registry: "https://registry.npmjs.org/",
    },
  });
  assert.equal(manifest.dependencies, undefined);
});

test("observability compiles through the shared strict contract", async () => {
  assert.equal(
    await pathExists("packages/observability/tsconfig.json"),
    true,
    "the observability TypeScript contract must exist",
  );

  assert.deepEqual(await readJson("packages/observability/tsconfig.json"), {
    extends: "@egeria-systems/standards/typescript/strict.json",
    compilerOptions: {
      declaration: true,
      outDir: "dist",
      rootDir: "src",
    },
    include: ["src/**/*.ts"],
  });
});

test("observability has no runtime behavior or provider integration", async () => {
  const sourceDirectory = resolve(repositoryRoot, "packages/observability/src");

  assert.equal(
    await pathExists("packages/observability/src"),
    true,
    "the empty observability source shell must exist",
  );
  assert.deepEqual(await listFiles(sourceDirectory), ["index.ts"]);
  assert.equal(
    await readFile(resolve(sourceDirectory, "index.ts"), "utf8"),
    "export {};\n",
  );

  for (const requiredDocument of [
    "packages/observability/AGENTS.md",
    "packages/observability/README.md",
  ]) {
    assert.equal(await pathExists(requiredDocument), true);
  }
});
