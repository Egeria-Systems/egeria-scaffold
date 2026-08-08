import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { generatedFixtureContracts } from "../../scripts/verify-generated-skeletons.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const cliEntry = resolve(repositoryRoot, "apps/cli/dist/index.js");
const maximumOutputBytes = 1024 * 1024;
const commandTimeoutMilliseconds = 45 * 60 * 1000;
const codePointCompare = (left, right) =>
  left < right ? -1 : left > right ? 1 : 0;

const childEnvironment = Object.fromEntries(
  ["PATH", "LANG", "SystemRoot", "ComSpec", "PATHEXT"]
    .filter((key) => process.env[key] !== undefined)
    .map((key) => [key, process.env[key]]),
);

async function pathExists(path) {
  try {
    await readdir(path);
    return true;
  } catch {
    return false;
  }
}

async function snapshotTree(root) {
  const snapshot = [];

  async function visit(directory, relativeDirectory) {
    const entries = (await readdir(directory, { withFileTypes: true })).sort(
      (left, right) => codePointCompare(left.name, right.name),
    );

    for (const entry of entries) {
      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${entry.name}`
        : entry.name;
      const absolutePath = join(directory, entry.name);

      if (entry.isDirectory()) {
        await visit(absolutePath, relativePath);
      } else {
        assert.equal(entry.isFile(), true, `non-regular fixture path: ${relativePath}`);
        snapshot.push({
          path: relativePath,
          content: await readFile(absolutePath, "base64"),
        });
      }
    }
  }

  await visit(root, "");
  return snapshot;
}

async function runCli(arguments_) {
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [cliEntry, ...arguments_],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: childEnvironment,
      maxBuffer: maximumOutputBytes,
      shell: false,
      timeout: commandTimeoutMilliseconds,
      windowsHide: true,
    },
  );
  assert.equal(stderr, "");
  const lines = stdout.trimEnd().split("\n");
  assert.equal(lines.length, 1, stdout);
  return JSON.parse(lines[0]);
}

async function assertReadOnlyAgreement(directory, before) {
  const inference = await runCli(["infer", "--directory", directory]);
  assert.equal(inference.ok, true);
  assert.equal(inference.command, "infer");
  assert.equal(inference.result.state.kind, "valid");
  assert.ok(
    inference.result.capabilities.every(
      ({ category }) => category === "confirmed",
    ),
  );
  assert.ok(
    inference.result.surfaces.every(({ status }) =>
      ["confirmed", "application-owned"].includes(status),
    ),
  );

  const doctor = await runCli(["doctor", "--directory", directory]);
  assert.deepEqual(doctor, {
    ok: true,
    command: "doctor",
    result: { healthy: true, diagnostics: [] },
  });

  const difference = await runCli(["diff", "--directory", directory]);
  assert.deepEqual(difference, {
    ok: true,
    command: "diff",
    result: { equal: true, differences: [] },
  });
  assert.deepEqual(await snapshotTree(directory), before);
}

function assertPortablePublicLockfile(lockfile) {
  assert.doesNotMatch(
    lockfile,
    /^\s+(?:specifier|version):\s+(?:file|link|workspace):/mu,
  );
  assert.doesNotMatch(
    lockfile,
    /^\s+['"]?(?:file|link|workspace):/mu,
  );
  assert.doesNotMatch(lockfile, /(?:^|[{,]\s*)tarball:/mu);
  assert.match(lockfile, /@egeria-systems\/standards@0\.1\.0/u);
  assert.match(lockfile, /@egeria-systems\/observability@0\.1\.0/u);
}

test("compiled project generation matches committed portfolio and site fixtures", async (context) => {
  for (const fixtureCase of generatedFixtureContracts) {
    assert.equal(
      await pathExists(resolve(repositoryRoot, fixtureCase.relativeRoot)),
      true,
      `committed fixture is absent: ${fixtureCase.relativeRoot}`,
    );
  }

  const owner = await mkdtemp(join(tmpdir(), "egeria-fixture-determinism-"));

  try {
    for (const fixtureCase of generatedFixtureContracts) {
      const generatedRoots = [
        join(owner, `${fixtureCase.profile}-first`),
        join(owner, `${fixtureCase.profile}-second`),
      ];
      const generatedSnapshots = [];

      for (const destination of generatedRoots) {
        const created = await runCli([
          "create",
          "--profile",
          fixtureCase.profile,
          "--name",
          fixtureCase.projectName,
          "--display-name",
          fixtureCase.displayName,
          "--directory",
          destination,
        ]);
        assert.deepEqual(created, {
          ok: true,
          command: "create",
          destination: await realpath(destination),
          profile: fixtureCase.profile,
          capabilities: fixtureCase.expectedCapabilities,
        });

        const snapshot = await snapshotTree(destination);
        assert.deepEqual(
          snapshot.map(({ path }) => path),
          fixtureCase.expectedFiles,
        );
        assert.equal(snapshot.length, fixtureCase.expectedFiles.length);

        const state = JSON.parse(
          await readFile(join(destination, ".egeria/state.json"), "utf8"),
        );
        assert.deepEqual(
          state.installedCapabilities.map(({ identifier }) => identifier),
          fixtureCase.expectedCapabilities,
        );
        assert.equal(
          state.managedSurfaces.length,
          fixtureCase.expectedSurfaces,
        );
        assert.deepEqual(state.lastSuccessfulVerification.checks, [
          "contracts",
          "pre-state-inference",
          "lockfile",
          "frozen-install",
          "lint",
          "typecheck",
          "next-build",
          "opennext-build",
          "post-state-inference",
        ]);

        const lockfile = await readFile(
          join(destination, "pnpm-lock.yaml"),
          "utf8",
        );
        assertPortablePublicLockfile(lockfile);
        await assertReadOnlyAgreement(destination, snapshot);
        generatedSnapshots.push(snapshot);
      }

      assert.deepEqual(generatedSnapshots[1], generatedSnapshots[0]);
      const committedSnapshot = await snapshotTree(
        resolve(repositoryRoot, fixtureCase.relativeRoot),
      );
      assert.deepEqual(committedSnapshot, generatedSnapshots[0]);
      context.diagnostic(
        `${fixtureCase.profile}: ${committedSnapshot.length} byte-stable files`,
      );
    }
  } finally {
    await rm(owner, { recursive: true, force: true });
  }
});
