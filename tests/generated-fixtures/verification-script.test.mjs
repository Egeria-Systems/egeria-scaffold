import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  access,
  cp,
  lstat,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

import {
  generatedFixtureContracts,
  inspectGeneratedFixture,
  verifyGeneratedSkeletonsForTesting,
} from "../../scripts/verify-generated-skeletons.mjs";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const execFileAsync = promisify(execFile);

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function copyFixture(owner, profile, label) {
  const root = join(owner, `${profile}-${label}`);
  await cp(resolve(repositoryRoot, `fixtures/generated/${profile}`), root, {
    recursive: true,
    force: false,
    errorOnExist: true,
    dereference: false,
  });
  return root;
}

async function expectFixtureError(callback, expectedCode) {
  await assert.rejects(callback, (error) => {
    assert.equal(error?.name, "GeneratedFixtureVerificationError");
    assert.equal(error?.code, expectedCode);
    assert.doesNotMatch(String(error), /NPM_TOKEN|PRIVATE_VALUE/u);
    return true;
  });
}

async function createKnownOwner(parent) {
  const path = await mkdtemp(join(parent, "verification-owner-"));
  const stats = await lstat(path, { bigint: true });
  return { path, device: stats.dev, inode: stats.ino };
}

test("fixture inspection accepts only the exact portable generated trees", async () => {
  assert.deepEqual(
    generatedFixtureContracts.map(({ profile, relativeRoot }) => ({
      profile,
      relativeRoot,
    })),
    [
      { profile: "portfolio", relativeRoot: "fixtures/generated/portfolio" },
      { profile: "site", relativeRoot: "fixtures/generated/site" },
    ],
  );

  for (const contract of generatedFixtureContracts) {
    const snapshot = await inspectGeneratedFixture(
      resolve(repositoryRoot, contract.relativeRoot),
      contract.profile,
    );
    assert.equal(snapshot.length, contract.expectedFiles.length);
    assert.deepEqual(
      snapshot.map(({ path }) => path),
      contract.expectedFiles,
    );
  }
});

test("generated fixture checkout bytes are pinned to LF", async () => {
  const fixturePaths = generatedFixtureContracts.map(
    ({ relativeRoot }) => `${relativeRoot}/package.json`,
  );
  const { stdout } = await execFileAsync(
    "git",
    ["check-attr", "text", "eol", "--", ...fixturePaths],
    { cwd: repositoryRoot, encoding: "utf8" },
  );

  assert.deepEqual(stdout.trimEnd().split("\n"), [
    "fixtures/generated/portfolio/package.json: text: set",
    "fixtures/generated/portfolio/package.json: eol: lf",
    "fixtures/generated/site/package.json: text: set",
    "fixtures/generated/site/package.json: eol: lf",
  ]);
});

test("fixture inspection rejects artifacts, local sources, altered integrity, and links", async () => {
  const owner = await mkdtemp(join(tmpdir(), "egeria-fixture-policy-"));

  try {
    const artifactRoot = await copyFixture(owner, "portfolio", "artifact");
    await writeFile(join(artifactRoot, ".env"), "PRIVATE_VALUE=secret\n", {
      encoding: "utf8",
      mode: 0o600,
    });
    await expectFixtureError(
      () =>
        inspectGeneratedFixture(artifactRoot, "portfolio"),
      "GENERATED_FIXTURE_FORBIDDEN_ARTIFACT",
    );

    const localSourceRoot = await copyFixture(owner, "portfolio", "local-source");
    const webManifestPath = join(localSourceRoot, "apps/web/package.json");
    const webManifest = JSON.parse(await readFile(webManifestPath, "utf8"));
    webManifest.dependencies["@egeria-systems/observability"] =
      "file:../../../../private-package";
    await writeFile(webManifestPath, `${JSON.stringify(webManifest, null, 2)}\n`);
    await expectFixtureError(
      () =>
        inspectGeneratedFixture(localSourceRoot, "portfolio"),
      "GENERATED_FIXTURE_LOCAL_DEPENDENCY",
    );

    const integrityRoot = await copyFixture(owner, "portfolio", "integrity");
    const lockfilePath = join(integrityRoot, "pnpm-lock.yaml");
    const lockfile = await readFile(lockfilePath, "utf8");
    const alteredLockfile = lockfile.replace(
      "sha512-BmDwcX0T6KT271C4N24jCKn6ymKTqDAFpJjsG6LNpmIoTAz0xApIcqpHFl9dHOqlB2xdhdHwKYfSiELUp04E0Q==",
      "sha512-invalid",
    );
    assert.notEqual(alteredLockfile, lockfile);
    await writeFile(lockfilePath, alteredLockfile);
    await expectFixtureError(
      () =>
        inspectGeneratedFixture(integrityRoot, "portfolio"),
      "FIXTURE_LOCKFILE_INVALID",
    );

    const linkedRoot = await copyFixture(owner, "portfolio", "linked");
    await rm(join(linkedRoot, "README.md"));
    await symlink("package.json", join(linkedRoot, "README.md"));
    await expectFixtureError(
      () =>
        inspectGeneratedFixture(linkedRoot, "portfolio"),
      "FIXTURE_PATH_INVALID",
    );
  } finally {
    await rm(owner, { recursive: true, force: true });
  }
});

test("fixture inspection rejects unapproved dependency and execution policy", async () => {
  const owner = await mkdtemp(join(tmpdir(), "egeria-fixture-policy-"));

  try {
    const workspaceOverrideRoot = await copyFixture(
      owner,
      "portfolio",
      "workspace-override",
    );
    const workspacePath = join(workspaceOverrideRoot, "pnpm-workspace.yaml");
    const workspace = await readFile(workspacePath, "utf8");
    await writeFile(
      workspacePath,
      workspace.replace(
        '  "miniflare>undici": 7.29.0',
        '  "miniflare>undici": 7.29.0\n  next: 16.3.1',
      ),
    );
    await expectFixtureError(
      () => inspectGeneratedFixture(workspaceOverrideRoot, "portfolio"),
      "FIXTURE_WORKSPACE_POLICY_INVALID",
    );

    const lockfileOverrideRoot = await copyFixture(
      owner,
      "portfolio",
      "lockfile-override",
    );
    const lockfilePath = join(lockfileOverrideRoot, "pnpm-lock.yaml");
    const lockfile = await readFile(lockfilePath, "utf8");
    await writeFile(
      lockfilePath,
      lockfile.replace(
        "  miniflare>undici: 7.29.0",
        "  miniflare>undici: 7.29.1",
      ),
    );
    await expectFixtureError(
      () => inspectGeneratedFixture(lockfileOverrideRoot, "portfolio"),
      "FIXTURE_LOCKFILE_INVALID",
    );

    const lifecycleRoot = await copyFixture(owner, "portfolio", "lifecycle");
    const rootManifestPath = join(lifecycleRoot, "package.json");
    const rootManifest = JSON.parse(await readFile(rootManifestPath, "utf8"));
    rootManifest.scripts.preinstall = "node unapproved-install-hook.mjs";
    await writeFile(
      rootManifestPath,
      `${JSON.stringify(rootManifest, null, 2)}\n`,
    );
    await expectFixtureError(
      () => inspectGeneratedFixture(lifecycleRoot, "portfolio"),
      "FIXTURE_MANIFEST_INVALID",
    );

    const remoteSourceRoot = await copyFixture(
      owner,
      "portfolio",
      "remote-source",
    );
    const webManifestPath = join(remoteSourceRoot, "apps/web/package.json");
    const webManifest = JSON.parse(await readFile(webManifestPath, "utf8"));
    webManifest.dependencies.next = "https://example.invalid/next.tgz";
    await writeFile(webManifestPath, `${JSON.stringify(webManifest, null, 2)}\n`);
    await expectFixtureError(
      () => inspectGeneratedFixture(remoteSourceRoot, "portfolio"),
      "FIXTURE_MANIFEST_INVALID",
    );

    const tarballRoot = await copyFixture(owner, "portfolio", "tarball");
    const tarballLockfilePath = join(tarballRoot, "pnpm-lock.yaml");
    const tarballLockfile = await readFile(tarballLockfilePath, "utf8");
    await writeFile(
      tarballLockfilePath,
      tarballLockfile.replace(
        "    resolution: {integrity:",
        "    resolution:\n      tarball: https://example.invalid/package.tgz\n      integrity:",
      ),
    );
    await expectFixtureError(
      () => inspectGeneratedFixture(tarballRoot, "portfolio"),
      "FIXTURE_LOCKFILE_INVALID",
    );

    const snapshotLocatorRoot = await copyFixture(
      owner,
      "portfolio",
      "snapshot-locator",
    );
    const snapshotLockfilePath = join(snapshotLocatorRoot, "pnpm-lock.yaml");
    const snapshotLockfile = await readFile(snapshotLockfilePath, "utf8");
    const alteredSnapshotLockfile = snapshotLockfile.replace(
      "      tslib: 2.8.1",
      "      tslib: git+https://example.invalid/unapproved.git",
    );
    assert.notEqual(alteredSnapshotLockfile, snapshotLockfile);
    await writeFile(snapshotLockfilePath, alteredSnapshotLockfile);
    await expectFixtureError(
      () => inspectGeneratedFixture(snapshotLocatorRoot, "portfolio"),
      "FIXTURE_LOCKFILE_INVALID",
    );
  } finally {
    await rm(owner, { recursive: true, force: true });
  }
});

test("live verification uses fixed copies, a minimal environment, and exact commands", async () => {
  const ownerParent = await mkdtemp(join(tmpdir(), "egeria-fixture-harness-"));
  let ownedPath;
  const commands = [];
  const sourceBefore = await Promise.all(
    generatedFixtureContracts.map(({ profile, relativeRoot }) =>
      inspectGeneratedFixture(resolve(repositoryRoot, relativeRoot), profile),
    ),
  );

  process.env.NPM_TOKEN = "PRIVATE_VALUE";
  try {
    const result = await verifyGeneratedSkeletonsForTesting({
      async createOwner() {
        const identity = await createKnownOwner(ownerParent);
        ownedPath = identity.path;
        return identity;
      },
      async runCommand(input) {
        commands.push(input);
        assert.equal(input.executable, "pnpm");
        assert.equal(input.environment.NPM_TOKEN, undefined);
        assert.equal(input.environment.NODE_AUTH_TOKEN, undefined);
        assert.equal(input.environment.CI, "true");
        assert.equal(input.environment.NEXT_TELEMETRY_DISABLED, "1");
        assert.equal(
          input.environment.NPM_CONFIG_REGISTRY,
          "https://registry.npmjs.org/",
        );
        assert.equal(input.cwd.startsWith(`${ownedPath}/`), true);
        return input.arguments[0] === "--version" ? "11.20.0\n" : "";
      },
    });

    assert.deepEqual(result, {
      ok: true,
      profiles: ["portfolio", "site"],
      checks: [
        "pnpm-version",
        "frozen-install",
        "peer-dependencies",
        "dependency-audit",
        "registry-signatures",
        "lint",
        "typecheck",
        "next-build",
        "opennext-build",
      ],
    });
  } finally {
    delete process.env.NPM_TOKEN;
  }

  const argumentLists = commands.map(({ arguments: arguments_ }) => arguments_);
  const perProfile = argumentLists.slice(0, 9).map((arguments_) =>
    arguments_.map((argument) =>
      ownedPath !== undefined && argument.startsWith(ownedPath)
        ? "<owned-path>"
        : argument,
    ),
  );
  assert.deepEqual(argumentLists.slice(9).map((arguments_) =>
    arguments_.map((argument) =>
      ownedPath !== undefined && argument.startsWith(ownedPath)
        ? "<owned-path>"
        : argument,
    )), perProfile);
  assert.deepEqual(perProfile, [
    ["--version"],
    ["install", "--frozen-lockfile", "--store-dir", "<owned-path>"],
    ["peers", "check"],
    ["audit", "--audit-level", "moderate"],
    ["audit", "signatures"],
    ["run", "lint"],
    ["run", "typecheck"],
    ["run", "build"],
    ["run", "build:cloudflare"],
  ]);
  assert.equal(await pathExists(ownedPath), false);

  const sourceAfter = await Promise.all(
    generatedFixtureContracts.map(({ profile, relativeRoot }) =>
      inspectGeneratedFixture(resolve(repositoryRoot, relativeRoot), profile),
    ),
  );
  assert.deepEqual(sourceAfter, sourceBefore);
  await rm(ownerParent, { recursive: true, force: true });
});

test("live verification reports a stable failure and still removes its owner", async () => {
  const ownerParent = await mkdtemp(join(tmpdir(), "egeria-fixture-failure-"));
  let ownedPath;

  try {
    await expectFixtureError(
      () =>
        verifyGeneratedSkeletonsForTesting({
          async createOwner() {
            const identity = await createKnownOwner(ownerParent);
            ownedPath = identity.path;
            return identity;
          },
          async runCommand(input) {
            if (input.arguments.join(" ") === "audit --audit-level moderate") {
              throw new Error("PRIVATE_VALUE");
            }
            return input.arguments[0] === "--version" ? "11.20.0\n" : "";
          },
        }),
      "DEPENDENCY_AUDIT_FAILED",
    );
    assert.equal(await pathExists(ownedPath), false);
  } finally {
    await rm(ownerParent, { recursive: true, force: true });
  }
});
