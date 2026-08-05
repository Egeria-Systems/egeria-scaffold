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

test("standards exposes only its approved public configuration APIs", async () => {
  assert.equal(
    await pathExists("packages/standards/package.json"),
    true,
    "the public standards manifest must exist",
  );

  assert.deepEqual(await readJson("packages/standards/package.json"), {
    name: "@egeria-systems/standards",
    version: "0.0.0",
    type: "module",
    files: ["eslint", "typescript", "README.md"],
    exports: {
      "./eslint/cloudflare-isolation": "./eslint/cloudflare-isolation.mjs",
      "./typescript/strict.json": "./typescript/strict.json",
      "./package.json": "./package.json",
    },
    scripts: {
      test: "node --test tests/*.test.mjs",
      verify: "pnpm run test",
      prepublishOnly: "pnpm run verify",
    },
    peerDependencies: {
      eslint: ">=9.39.5 <10",
    },
    devDependencies: {
      eslint: "9.39.5",
    },
    publishConfig: {
      access: "public",
      provenance: true,
      registry: "https://registry.npmjs.org/",
    },
  });

  assert.equal(await pathExists("packages/standards/AGENTS.md"), true);
  assert.equal(await pathExists("packages/standards/README.md"), true);
  assert.equal(await pathExists("packages/standards/src"), false);
});

test("each standards API has a concrete workspace consumer", async () => {
  const [cliManifest, coreManifest, proofManifest] = await Promise.all([
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
});
