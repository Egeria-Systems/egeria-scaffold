import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
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

async function listMarkdownFiles(directory = repositoryRoot) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") {
      continue;
    }

    const path = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFiles(path)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(path);
    }
  }

  return files;
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

test("repository documentation has no broken local Markdown links", async () => {
  const markdownFiles = await listMarkdownFiles();
  const brokenLinks = [];

  for (const markdownFile of markdownFiles) {
    const document = await readFile(markdownFile, "utf8");
    const links = document.matchAll(/\[[^\]]+\]\(([^)]+)\)/g);

    for (const [, destination] of links) {
      if (
        destination.startsWith("#") ||
        destination.startsWith("https://") ||
        destination.startsWith("http://") ||
        destination.startsWith("mailto:")
      ) {
        continue;
      }

      const [path] = destination.split("#", 1);
      const target = resolve(dirname(markdownFile), decodeURI(path));

      try {
        await access(target);
      } catch {
        brokenLinks.push(
          `${markdownFile.slice(repositoryRoot.length + 1)} -> ${destination}`,
        );
      }
    }
  }

  assert.deepEqual(brokenLinks, []);
});

const acceptedAdrs = [
  ["0001-materialized-profile-recipes.md", "ADR-0001"],
  ["0002-capability-delivery-and-state.md", "ADR-0002"],
  ["0003-hybrid-ownership.md", "ADR-0003"],
  ["0004-cloudflare-isolation.md", "ADR-0004"],
  ["0005-evidence-driven-package-extraction.md", "ADR-0005"],
  ["0006-egeria-state-files.md", "ADR-0006"],
  ["0007-transactional-repository-migrations.md", "ADR-0007"],
  ["0008-copy-externalization.md", "ADR-0008"],
  ["0009-accessibility-evidence-and-claims.md", "ADR-0009"],
  ["0010-analytics-and-observability.md", "ADR-0010"],
  ["0011-github-actions-deployment-authority.md", "ADR-0011"],
];

test("accepted ADRs use the repository decision contract", async () => {
  const index = await readRepositoryFile("docs/adr/README.md");

  for (const [fileName, identifier] of acceptedAdrs) {
    const relativePath = `docs/adr/${fileName}`;
    const document = await readRepositoryFile(relativePath);

    assert.ok(document.startsWith(`# ${identifier}:`));
    assert.ok(document.includes("**Status:** Accepted"));
    assert.ok(document.includes("**Date:** 2026-08-04"));
    assert.ok(document.includes("## Context"));
    assert.ok(document.includes("## Decision"));
    assert.ok(document.includes("## Consequences"));
    assert.ok(document.includes("## Enforcement"));
    assert.ok(index.includes(fileName));
  }
});
