import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
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

test("the packed observability package loads every exact public surface in isolation", async () => {
  const consumerRoot = await mkdtemp(
    join(tmpdir(), "egeria-observability-consumer-"),
  );

  try {
    await execFileAsync(
      "pnpm",
      [
        "--filter",
        "@egeria-systems/observability",
        "pack",
        "--pack-destination",
        consumerRoot,
      ],
      { cwd: repositoryRoot, encoding: "utf8" },
    );
    const archiveName = (await readdir(consumerRoot)).find((name) =>
      name.endsWith(".tgz"),
    );
    assert.notEqual(archiveName, undefined);

    const packageRoot = resolve(
      consumerRoot,
      "node_modules/@egeria-systems/observability",
    );
    await mkdir(packageRoot, { recursive: true });
    await execFileAsync(
      "tar",
      [
        "-xzf",
        resolve(consumerRoot, archiveName),
        "--strip-components=1",
        "-C",
        packageRoot,
      ],
      { cwd: consumerRoot, encoding: "utf8" },
    );

    const consumerPath = resolve(consumerRoot, "consumer.mjs");
    await writeFile(
      consumerPath,
      `const surfaces = await Promise.all([
  import("@egeria-systems/observability"),
  import("@egeria-systems/observability/browser"),
  import("@egeria-systems/observability/server"),
  import("@egeria-systems/observability/testing"),
]);
process.stdout.write(JSON.stringify(surfaces.map((surface) => Object.keys(surface).sort())));
`,
      "utf8",
    );
    const { stdout } = await execFileAsync(process.execPath, [consumerPath], {
      cwd: consumerRoot,
      encoding: "utf8",
    });

    assert.deepEqual(JSON.parse(stdout), [
      [
        "createOperationalEvent",
        "dispatchOperationalEvent",
        "normalizeErrorCategory",
        "operationalErrorCategories",
        "operationalEventKinds",
        "operationalRuntimes",
        "operationalSeverities",
      ],
      ["createBrowserEnvelope", "createBrowserSink"],
      [
        "createBetterStackSink",
        "createStructuredLogSink",
        "serializeOperationalRecord",
      ],
      ["assertOperationalEvent", "createMemorySink"],
    ]);
  } finally {
    await rm(consumerRoot, { force: true, recursive: true });
  }
});

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

test("observability exposes only its approved operational APIs", async () => {
  assert.equal(
    await pathExists("packages/observability/package.json"),
    true,
    "the public observability manifest must exist",
  );

  const manifest = await readJson("packages/observability/package.json");

  assert.deepEqual(manifest, {
    name: "@egeria-systems/observability",
    version: "0.1.0",
    type: "module",
    license: "Apache-2.0",
    repository: {
      type: "git",
      url: "git+https://github.com/Egeria-Systems/egeria-scaffold.git",
      directory: "packages/observability",
    },
    files: ["dist", "README.md"],
    exports: {
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

test("observability keeps provider-neutral source and zero runtime dependencies", async () => {
  const sourceDirectory = resolve(repositoryRoot, "packages/observability/src");

  assert.equal(
    await pathExists("packages/observability/src"),
    true,
    "the observability source boundary must exist",
  );
  assert.deepEqual(await listFiles(sourceDirectory), [
    "browser.ts",
    "contracts.ts",
    "dispatch.ts",
    "events.ts",
    "index.ts",
    "redaction.ts",
    "server.ts",
    "testing.ts",
  ]);

  const source = await Promise.all(
    (await listFiles(sourceDirectory)).map((path) =>
      readFile(resolve(sourceDirectory, path), "utf8"),
    ),
  );
  const joinedSource = source.join("\n");
  assert.doesNotMatch(
    joinedSource,
    /from ["'](?:node:|next|react|@opennextjs\/cloudflare|@logtail\/next|cloudflare)/u,
  );
  assert.doesNotMatch(
    joinedSource,
    /session.?replay|autocapture|web.?analytics|google.?analytics|clarity/iu,
  );

  for (const requiredDocument of [
    "packages/observability/AGENTS.md",
    "packages/observability/README.md",
  ]) {
    assert.equal(await pathExists(requiredDocument), true);
  }
});
