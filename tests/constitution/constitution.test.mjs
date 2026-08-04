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

const governanceDocuments = {
  "README.md": [
    "P0.1 — Constitution and ADRs",
    "No production profile is implemented",
    "docs/architecture/overview.md",
    "docs/roadmaps/program-roadmap.md",
  ],
  "AGENTS.md": [
    "Plan approval is not final-diff approval",
    "Never create a pull request unless explicitly asked",
    "Cloudflare types and bindings",
    "No WCAG conformance claim",
    "Canonical owners and cohesion",
    "Update the canonical owner and every direct consumer",
  ],
  "CONTRIBUTING.md": [
    "docs/governance/review-and-contribution.md",
    "docs/architecture/enforcement-map.md",
  ],
  "docs/governance/review-and-contribution.md": [
    "Gate 1: preparation evidence",
    "Gate 2: implementation-plan approval",
    "Gate 3: verified-final-diff approval",
    "Requirements reviewer",
    "Architecture and anti-overengineering reviewer",
    "Test-evidence reviewer",
    "Pull-request creation requires a separate explicit request",
  ],
};

test("governance documents preserve the approval and action boundaries", async () => {
  for (const [relativePath, requiredFragments] of Object.entries(
    governanceDocuments,
  )) {
    const document = await readRepositoryFile(relativePath);

    for (const fragment of requiredFragments) {
      assert.ok(
        document.includes(fragment),
        `${relativePath} must include: ${fragment}`,
      );
    }
  }
});
