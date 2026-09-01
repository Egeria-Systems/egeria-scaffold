import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  createCertificationPreflight,
  createCertificationRepositoryReaders,
} from "../../scripts/lib/certification-preflight.mjs";

const execFileAsync = promisify(execFile);

class TestCertificationError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

const certificationErrorCodes = Object.freeze({
  adapterInvalid: "CERTIFICATION_ADAPTER_INVALID",
  revisionInvalid: "CERTIFICATION_REVISION_UNAVAILABLE",
  revisionUnavailable: "CERTIFICATION_REVISION_UNAVAILABLE",
  revisionMismatch: "CERTIFICATION_REVISION_MISMATCH",
  worktreeUnavailable: "CERTIFICATION_WORKTREE_UNAVAILABLE",
  worktreeDirty: "CERTIFICATION_WORKTREE_DIRTY",
  indexFlags: "CERTIFICATION_INDEX_FLAGS",
});
const evidenceErrorCodes = Object.freeze({
  ...certificationErrorCodes,
  revisionInvalid: "EVIDENCE_REVISION_INVALID",
  revisionUnavailable: "EVIDENCE_REVISION_UNAVAILABLE",
});
const createError = (code) => new TestCertificationError(code);
const isCertificationError = (error) =>
  error instanceof TestCertificationError;
const exactRevisionPattern = /^[0-9a-f]{40}$/u;

function readersFor(overrides = {}, executeGit) {
  return createCertificationRepositoryReaders(
    {
      repositoryRoot: "/repository",
      revisionArguments: ["rev-parse", "--verify", "HEAD"],
      exactRevisionPattern,
      createError,
      isCertificationError,
      errorCodes: certificationErrorCodes,
      ...overrides,
    },
    executeGit,
  );
}

function preflightFor(adapters, overrides = {}) {
  return createCertificationPreflight({
    adapters,
    requiredAdapterFunctions: [
      "readCurrentRevision",
      "readRepositoryStatus",
      "readRepositoryIndexEntries",
    ],
    createError,
    isCertificationError,
    errorCodes: certificationErrorCodes,
    ...overrides,
  });
}

test("certification repository readers retain exact Git commands and error maps", async () => {
  const revision = "a".repeat(40);
  const calls = [];
  const executeGit = async (executable, arguments_, options) => {
    calls.push({ executable, arguments_, options });
    return {
      stdout:
        arguments_[0] === "rev-parse"
          ? `${revision}\n`
          : arguments_[0] === "status"
            ? ""
            : "H tracked.mjs\0",
    };
  };
  const certificationReaders = readersFor({}, executeGit);
  const evidenceReaders = readersFor(
    {
      revisionArguments: ["rev-parse", "HEAD"],
      errorCodes: evidenceErrorCodes,
    },
    executeGit,
  );

  assert.equal(await certificationReaders.readCurrentRevision(), revision);
  assert.equal(await certificationReaders.readRepositoryStatus(), "");
  assert.equal(
    await certificationReaders.readRepositoryIndexEntries(),
    "H tracked.mjs\0",
  );
  assert.equal(await evidenceReaders.readCurrentRevision(), revision);
  assert.deepEqual(
    calls.map(({ executable, arguments_ }) => [executable, arguments_]),
    [
      ["git", ["rev-parse", "--verify", "HEAD"]],
      ["git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"]],
      ["git", ["ls-files", "-v", "-z"]],
      ["git", ["rev-parse", "HEAD"]],
    ],
  );
  for (const { options } of calls) {
    assert.equal(options.cwd, "/repository");
    assert.equal(options.timeout, 30_000);
    assert.equal(options.encoding, "utf8");
    assert.equal(options.shell, false);
    assert.equal(options.env.CI, "true");
  }

  await assert.rejects(
    readersFor({}, async () => ({ stdout: "invalid\n" }))
      .readCurrentRevision(),
    (error) => error?.code === "CERTIFICATION_REVISION_UNAVAILABLE",
  );
  await assert.rejects(
    readersFor(
      { errorCodes: evidenceErrorCodes },
      async () => ({ stdout: "invalid\n" }),
    ).readCurrentRevision(),
    (error) => error?.code === "EVIDENCE_REVISION_INVALID",
  );
  await assert.rejects(
    readersFor({}, async () => {
      throw new Error("private failure");
    }).readCurrentRevision(),
    (error) => error?.code === "CERTIFICATION_REVISION_UNAVAILABLE",
  );
});

test("certification preflight preserves adapter, revision, status, and index contracts", async () => {
  const revision = "a".repeat(40);
  const adapters = {
    readCurrentRevision: async () => revision,
    readRepositoryStatus: async () => "",
    readRepositoryIndexEntries: async () => "H tracked.mjs\0",
  };
  const preflight = preflightFor(adapters);

  preflight.requireAdapters();
  await preflight.requireRevision(revision);
  preflight.requireCleanStatus(await preflight.readRepositoryStatus());
  preflight.requireOrdinaryIndexEntries(
    await preflight.readRepositoryIndexEntries(),
  );
  preflight.requireOrdinaryIndexEntries("");

  for (const [value, code] of [
    [undefined, "CERTIFICATION_WORKTREE_UNAVAILABLE"],
    ["broken", "CERTIFICATION_WORKTREE_UNAVAILABLE"],
    ["H tracked.mjs", "CERTIFICATION_WORKTREE_UNAVAILABLE"],
    ["S tracked.mjs\0", "CERTIFICATION_INDEX_FLAGS"],
  ]) {
    assert.throws(
      () => preflight.requireOrdinaryIndexEntries(value),
      (error) => error?.code === code,
    );
  }
  assert.throws(
    () => preflight.requireCleanStatus(undefined),
    (error) => error?.code === "CERTIFICATION_WORKTREE_UNAVAILABLE",
  );
  assert.throws(
    () => preflight.requireCleanStatus(" M tracked.mjs\0"),
    (error) => error?.code === "CERTIFICATION_WORKTREE_DIRTY",
  );
  assert.throws(
    () => preflightFor({ ...adapters, readRepositoryStatus: undefined }).requireAdapters(),
    (error) => error?.code === "CERTIFICATION_ADAPTER_INVALID",
  );
  await assert.rejects(
    preflightFor({ ...adapters, readCurrentRevision: async () => "b".repeat(40) })
      .requireRevision(revision),
    (error) => error?.code === "CERTIFICATION_REVISION_MISMATCH",
  );
  await assert.rejects(
    preflightFor({
      ...adapters,
      readRepositoryStatus: async () => {
        throw new Error("private failure");
      },
    }).readRepositoryStatus(),
    (error) => error?.code === "CERTIFICATION_WORKTREE_UNAVAILABLE",
  );

  const ownedError = createError("OWNED_ERROR");
  await assert.rejects(
    preflightFor({
      ...adapters,
      readCurrentRevision: async () => {
        throw ownedError;
      },
    }).requireRevision(revision),
    (error) => error === ownedError,
  );
});

test("certification preflight detects real clean, dirty, untracked, and hidden-index Git state", async (context) => {
  for (const hiddenFlag of ["--assume-unchanged", "--skip-worktree"]) {
    const fixtureRoot = await mkdtemp(
      join(tmpdir(), "egeria-certification-preflight-"),
    );
    context.after(() => rm(fixtureRoot, { recursive: true, force: true }));
    const trackedPath = join(fixtureRoot, "selected-evidence.test.mjs");
    await execFileAsync("git", ["init", "--quiet"], { cwd: fixtureRoot });
    await writeFile(trackedPath, "export const value = 1;\n");
    await execFileAsync("git", ["add", "selected-evidence.test.mjs"], {
      cwd: fixtureRoot,
    });
    await execFileAsync(
      "git",
      [
        "-c",
        "user.name=Certification Test",
        "-c",
        "user.email=certification-test@example.invalid",
        "commit",
        "--quiet",
        "-m",
        "Add evidence fixture",
      ],
      { cwd: fixtureRoot },
    );

    const readers = readersFor({ repositoryRoot: fixtureRoot });
    const preflight = preflightFor(readers);
    preflight.requireCleanStatus(await readers.readRepositoryStatus());
    preflight.requireOrdinaryIndexEntries(
      await readers.readRepositoryIndexEntries(),
    );

    await writeFile(trackedPath, "export const value = 2;\n");
    const dirtyStatus = await readers.readRepositoryStatus();
    assert.throws(
      () => preflight.requireCleanStatus(dirtyStatus),
      (error) => error?.code === "CERTIFICATION_WORKTREE_DIRTY",
    );
    await writeFile(trackedPath, "export const value = 1;\n");
    preflight.requireCleanStatus(await readers.readRepositoryStatus());

    await writeFile(join(fixtureRoot, "untracked.mjs"), "export {};\n");
    const untrackedStatus = await readers.readRepositoryStatus();
    assert.throws(
      () => preflight.requireCleanStatus(untrackedStatus),
      (error) => error?.code === "CERTIFICATION_WORKTREE_DIRTY",
    );
    await rm(join(fixtureRoot, "untracked.mjs"));

    await execFileAsync(
      "git",
      ["update-index", hiddenFlag, "selected-evidence.test.mjs"],
      { cwd: fixtureRoot },
    );
    await writeFile(trackedPath, "export const value = 2;\n");
    const status = await readers.readRepositoryStatus();
    assert.equal(status, "");
    const indexEntries = await readers.readRepositoryIndexEntries();
    assert.throws(
      () => preflight.requireOrdinaryIndexEntries(indexEntries),
      (error) => error?.code === "CERTIFICATION_INDEX_FLAGS",
    );
  }
});
