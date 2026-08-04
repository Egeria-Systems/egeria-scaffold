import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);

async function readRepositoryFile(relativePath) {
  return readFile(resolve(repositoryRoot, relativePath), "utf8");
}

async function listRepositoryMarkdownFiles() {
  const { stdout } = await execFileAsync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { cwd: repositoryRoot, encoding: "utf8" },
  );

  return stdout
    .split("\0")
    .filter((path) => path.endsWith(".md"))
    .map((path) => resolve(repositoryRoot, path));
}

function isInsideRepository(path) {
  const relativePath = relative(repositoryRoot, path);

  return (
    relativePath !== ".." &&
    !relativePath.startsWith(`..${sep}`) &&
    !isAbsolute(relativePath)
  );
}

test("the root workspace remains private and pins the P0.2 toolchain", async () => {
  const manifest = JSON.parse(await readRepositoryFile("package.json"));
  const nvmVersion = await readRepositoryFile(".nvmrc");

  assert.equal(manifest.name, "@egeria-systems/scaffold");
  assert.equal(manifest.private, true);
  assert.equal(
    manifest.scripts.test,
    "pnpm run test:constitution && pnpm --filter @egeria-systems/nextjs-cloudflare-proof test:unit",
  );
  assert.equal(
    manifest.scripts["test:constitution"],
    "node --test tests/constitution/constitution.test.mjs",
  );
  assert.equal(
    manifest.scripts["verify:p0.2"],
    "pnpm --filter @egeria-systems/nextjs-cloudflare-proof verify",
  );
  assert.equal("dependencies" in manifest, false);
  assert.equal("devDependencies" in manifest, false);
  assert.equal(manifest.packageManager, "pnpm@11.20.0");
  assert.deepEqual(manifest.engines, {
    node: "22.23.0",
    pnpm: "11.20.0",
  });
  assert.deepEqual(manifest.volta, { node: "22.23.0" });
  assert.equal(nvmVersion, `${manifest.volta.node}\n`);
});

test("the workspace declares the approved proof root and install policy", async () => {
  const workspace = await readRepositoryFile("pnpm-workspace.yaml");

  assert.equal(
    workspace,
    'packages:\n  - "apps/*"\n  - "packages/*"\n  - "proofs/*"\n\npmOnFail: error\n\nminimumReleaseAge: 1440\n\noverrides:\n  "miniflare>undici": 7.29.0\n\nallowBuilds:\n  "@parcel/watcher": true\n  "@swc/core": true\n  esbuild: true\n  unrs-resolver: true\n  workerd: true\n',
  );
});

test("the compatibility proof has a private non-app workspace boundary", async () => {
  const proofManifest = JSON.parse(
    await readRepositoryFile("proofs/nextjs-cloudflare/package.json"),
  );

  assert.equal(
    proofManifest.name,
    "@egeria-systems/nextjs-cloudflare-proof",
  );
  assert.equal(proofManifest.private, true);
  await assert.rejects(readRepositoryFile("apps/web/package.json"));
  await assert.rejects(readRepositoryFile("apps/compatibility/package.json"));
  await assert.rejects(
    readRepositoryFile("packages/project-schema/package.json"),
  );
});

test("repository documentation has no broken local Markdown links", async () => {
  const markdownFiles = await listRepositoryMarkdownFiles();
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

      if (!isInsideRepository(target)) {
        brokenLinks.push(
          `${markdownFile.slice(repositoryRoot.length + 1)} -> ${destination} (outside repository)`,
        );
        continue;
      }

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

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function validateAcceptedAdr({ document, fileName, identifier, index }) {
  const problems = [];

  if (!document.startsWith(`# ${identifier}: `)) {
    problems.push("document identifier does not match its file contract");
  }

  const statusLines = [...document.matchAll(/^\*\*Status:\*\* (.+)$/gm)];
  const dateLines = [...document.matchAll(/^\*\*Date:\*\* (.+)$/gm)];

  if (statusLines.length !== 1 || statusLines[0][1] !== "Accepted") {
    problems.push("document must declare Accepted exactly once");
  }

  if (dateLines.length !== 1 || dateLines[0][1] !== "2026-08-04") {
    problems.push("document must declare the accepted date exactly once");
  }

  const headings = ["Context", "Decision", "Consequences", "Enforcement"];
  const headingPositions = [];

  for (const heading of headings) {
    const marker = `\n## ${heading}\n`;
    const position = document.indexOf(marker);

    if (position === -1 || position !== document.lastIndexOf(marker)) {
      problems.push(`${heading} must appear exactly once`);
      continue;
    }

    headingPositions.push(position);

    const bodyStart = position + marker.length;
    const nextHeading = document.indexOf("\n## ", bodyStart);
    const body = document.slice(
      bodyStart,
      nextHeading === -1 ? document.length : nextHeading,
    );

    if (body.trim().length === 0) {
      problems.push(`${heading} must not be empty`);
    }
  }

  if (
    headingPositions.length === headings.length &&
    headingPositions.some(
      (position, index) => index > 0 && position < headingPositions[index - 1],
    )
  ) {
    problems.push("decision sections are out of order");
  }

  const escapedIdentifier = escapeRegularExpression(identifier);
  const escapedFileName = escapeRegularExpression(fileName);
  const identifierLinks = index.match(
    new RegExp(`\\[${escapedIdentifier}\\]\\(`, "g"),
  );
  const acceptedRow = new RegExp(
    `^\\| \\[${escapedIdentifier}\\]\\(${escapedFileName}\\) \\| [^|\\n]+ \\| Accepted \\| 2026-08-04 \\|$`,
    "m",
  );

  if ((identifierLinks?.length ?? 0) !== 1 || !acceptedRow.test(index)) {
    problems.push("index must contain one matching Accepted row");
  }

  return problems;
}

test("the ADR validator rejects non-authoritative decision records", () => {
  const problems = validateAcceptedAdr({
    document: `# ADR-9999: Invalid example

**Status:** Accepted

**Date:** 2026-08-04

## Decision

Decision appears before an empty context.

## Context

## Consequences

Consequences exist.

## Enforcement

Enforcement exists.
`,
    fileName: "9999-invalid-example.md",
    identifier: "ADR-9999",
    index: "| [ADR-9999](9999-invalid-example.md) | Invalid | Proposed | 2026-08-04 |",
  });

  assert.ok(problems.length >= 3);
});

const capabilityIdentifiers = [
  "standards",
  "content-files",
  "section-composition",
  "deployment-cloudflare",
  "observability",
  "booking-calendly",
  "site-routing",
  "app-foundation",
  "application-persistence",
  "transactional-email-resend",
  "background-job-delivery",
  "durable-contact-submissions",
  "multilingual",
  "analytics",
  "cms-payload",
  "identity-core",
  "identity-google",
  "protected-area",
  "account-profile",
  "support-console",
  "identity-2fa",
  "identity-passkeys",
  "payments-stripe",
  "booking-webhooks",
];

test("the documented capability catalog uses the normalized contract", async () => {
  const document = await readRepositoryFile(
    "docs/architecture/capability-model.md",
  );
  const catalog = document
    .split("## Initial catalog\n", 2)[1]
    .split("## Independent and conditional behavior", 1)[0];
  const capabilityRows = catalog
    .split("\n")
    .filter((line) => line.startsWith("| `"))
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );

  assert.deepEqual(
    capabilityRows.map(([identifier]) => identifier.slice(1, -1)),
    capabilityIdentifiers,
  );

  const allowedProfiles = new Set([
    "portfolio",
    "site",
    "app",
    "authenticated-app",
  ]);
  const allowedDeliveryModes = new Set([
    "package-backed",
    "source-generated",
    "hybrid",
  ]);
  const allowedStateClassifications = new Set([
    "stateless",
    "repository-stateful",
    "external-stateful",
    "persistent-data",
  ]);
  const allowedRemovalPolicies = new Set([
    "automatic",
    "reviewed",
    "export-and-remove",
    "eject-only",
    "unsupported",
  ]);

  for (const row of capabilityRows) {
    assert.equal(row.length, 6, `${row[0]} has an incomplete catalog row`);

    const [
      identifier,
      deliveryMode,
      stateClassifications,
      removalPolicy,
      profileInclusion,
      dependencies,
    ] = row;
    const states = [...stateClassifications.matchAll(/`([^`]+)`/g)].map(
      ([, state]) => state,
    );

    assert.ok(
      allowedDeliveryModes.has(deliveryMode.slice(1, -1)),
      `${identifier} has an invalid delivery mode: ${deliveryMode}`,
    );
    assert.ok(states.length > 0, `${identifier} has no state classification`);
    assert.equal(
      new Set(states).size,
      states.length,
      `${identifier} repeats a state classification`,
    );
    assert.ok(
      states.every((state) => allowedStateClassifications.has(state)),
      `${identifier} has an invalid state classification`,
    );
    assert.ok(
      !states.includes("stateless") || states.length === 1,
      `${identifier} combines stateless with another classification`,
    );
    assert.ok(
      allowedRemovalPolicies.has(removalPolicy.slice(1, -1)),
      `${identifier} has an invalid removal policy: ${removalPolicy}`,
    );
    assert.ok(dependencies.length > 0, `${identifier} has no dependency entry`);

    const inclusions = profileInclusion.split("; ");
    const includedProfiles = [];

    assert.ok(inclusions.length > 0, `${identifier} has no profile inclusion`);

    for (const inclusion of inclusions) {
      const match = /^(default|optional|dependency-only): (.+)$/.exec(inclusion);

      assert.ok(
        match,
        `${identifier} has invalid profile inclusion: ${inclusion}`,
      );

      for (const profile of match[2].split(", ")) {
        assert.ok(
          allowedProfiles.has(profile),
          `${identifier} names an unknown profile: ${profile}`,
        );
        includedProfiles.push(profile);
      }
    }

    assert.equal(
      new Set(includedProfiles).size,
      includedProfiles.length,
      `${identifier} repeats a profile inclusion`,
    );
  }
});

test("accepted ADRs use the repository decision contract", async () => {
  const index = await readRepositoryFile("docs/adr/README.md");
  const rowPositions = [];

  for (const [fileName, identifier] of acceptedAdrs) {
    const relativePath = `docs/adr/${fileName}`;
    const document = await readRepositoryFile(relativePath);

    assert.deepEqual(
      validateAcceptedAdr({ document, fileName, identifier, index }),
      [],
      relativePath,
    );
    rowPositions.push(index.indexOf(`[${identifier}](${fileName})`));
  }

  assert.ok(
    rowPositions.every(
      (position, index) => index === 0 || position > rowPositions[index - 1],
    ),
    "accepted ADR index rows are out of order",
  );
});
