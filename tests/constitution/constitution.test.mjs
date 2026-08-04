import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);

async function readRepositoryFile(relativePath) {
  return readFile(resolve(repositoryRoot, relativePath), "utf8");
}

test("the root workspace is private and dependency-free in P0.1", async () => {
  const manifest = JSON.parse(await readRepositoryFile("package.json"));

  assert.equal(manifest.name, "@egeria-systems/scaffold");
  assert.equal(manifest.private, true);
  assert.equal(manifest.scripts.test, "pnpm run test:constitution");
  assert.equal(
    manifest.scripts["test:constitution"],
    "node --test tests/constitution/constitution.test.mjs",
  );
  assert.equal("dependencies" in manifest, false);
  assert.equal("devDependencies" in manifest, false);
  assert.equal("packageManager" in manifest, false);
  assert.equal("engines" in manifest, false);
  assert.deepEqual(manifest.volta, { node: "22.23.0" });
});

test("the workspace declares only the approved future package roots", async () => {
  const workspace = await readRepositoryFile("pnpm-workspace.yaml");

  assert.equal(
    workspace,
    'packages:\n  - "apps/*"\n  - "packages/*"\n',
  );
});
