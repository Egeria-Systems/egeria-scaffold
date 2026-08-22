import assert from "node:assert/strict";
import {
  lstat,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "../..");
const core = await import(pathToFileURL(resolve(packageRoot, "dist/index.js")));
const decoder = new TextDecoder("utf-8", { fatal: true });
const encoder = new TextEncoder();
const persistedVerificationChecks = [
  "contracts",
  "plan-approval",
  "pre-state-inference",
  ...core.ordinaryGenerationVerificationChecks,
  "post-change-inference",
];
const root = "/generated/project";
const settings = Object.freeze({
  destination: "https://calendly.com/private/discovery",
  mode: "popup",
});
const git = Object.freeze({
  ok: true,
  identity: Object.freeze({
    root,
    revision: "abcdef0123456789abcdef0123456789abcdef01",
    attachedRef: "refs/heads/transactional-change",
    gitDirectory: "/generated/common/.git/worktrees/transactional-change",
    commonDirectory: "/generated/common/.git",
  }),
});

async function loadTextEntries(directory) {
  const entries = new Map();

  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const absolutePath = join(current, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
      } else if (entry.isFile()) {
        const path = relative(directory, absolutePath).split(sep).join("/");
        entries.set(path, await readFile(absolutePath, "utf8"));
      }
    }
  }

  await visit(directory);
  return entries;
}

async function fixtureEntries(profile = "portfolio") {
  return loadTextEntries(resolve(repositoryRoot, `fixtures/generated/${profile}`));
}

function createRepository(entries, failBatch, afterWrite) {
  const files = new Map(entries);
  const writes = [];

  return {
    files,
    writes,
    reader: {
      async readText(path) {
        const content = files.get(path);
        return content === undefined
          ? { kind: "missing" }
          : { kind: "file", content };
      },
    },
    writer: {
      async write(changes) {
        const batch = writes.length + 1;
        if (batch === failBatch) {
          return { ok: false, sourceChanged: false };
        }

        let sourceChanged = false;
        for (const change of changes) {
          const current = files.get(change.path);
          if (
            (change.expected.kind === "missing" && current !== undefined) ||
            (change.expected.kind === "file" &&
              current !== decoder.decode(change.expected.content))
          ) {
            return { ok: false, sourceChanged };
          }
          files.set(change.path, decoder.decode(change.content));
          sourceChanged = true;
        }
        writes.push(changes.map(({ path }) => path));
        await afterWrite?.({ batch, changes, files });
        return { ok: true };
      },
    },
  };
}

async function approvedPlan(reader) {
  const result = await core.planCapabilityAddition({
    reader,
    git,
    capability: "booking-calendly",
    settings,
  });
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  return result.value;
}

function successfulVerifier(calls) {
  return {
    prepareLockfile() {
      throw new Error("addition must not prepare a lockfile");
    },
    verifyInIsolatedCopy(receivedRoot) {
      calls.push(receivedRoot);
      return Promise.resolve({
        ok: true,
        value: { checks: core.ordinaryGenerationVerificationChecks },
      });
    },
  };
}

async function runApply(repository, overrides = {}) {
  const plan = await approvedPlan(repository.reader);
  const expectedInspections = [];
  const verifierCalls = [];
  const result = await core.applyCapabilityAddition({
    root,
    capability: "booking-calendly",
    settings,
    approvedPlanFingerprint:
      overrides.approvedPlanFingerprint ?? plan.planFingerprint,
    reader: repository.reader,
    writer: repository.writer,
    verifier:
      overrides.verifier ?? successfulVerifier(verifierCalls),
    inspectWorktree: overrides.inspectWorktree ?? (() => Promise.resolve(git)),
    inspectCreateTargets: overrides.inspectCreateTargets ??
      (() => Promise.resolve({ ok: true })),
    inspectExpectedChanges:
      overrides.inspectExpectedChanges ??
      ((input) => {
        expectedInspections.push(input);
        return Promise.resolve({ ok: true });
      }),
    now: overrides.now ?? (() => "2026-08-21T15:00:00.000Z"),
  });
  return { expectedInspections, plan, result, verifierCalls };
}

test("capability addition applies, verifies, re-infers, and persists migration then state", async () => {
  for (const profile of ["portfolio", "site"]) {
    const repository = createRepository(await fixtureEntries(profile));
    const initialState = repository.files.get(".egeria/state.json");
    const { expectedInspections, plan, result, verifierCalls } =
      await runApply(repository);

    assert.equal(result.ok, true, JSON.stringify(result));
    assert.deepEqual(result.value, {
      status: "verified-final-diff-approval-required",
      baseRevision: git.identity.revision,
      capability: { identifier: "booking-calendly", version: "0.1.0" },
      migration: "add-booking-calendly-0-1-0",
      changedPaths: [
        ...plan.actions.map(({ path }) => path),
        ".egeria/migrations.jsonl",
        ".egeria/state.json",
      ].sort(),
      verificationChecks: core.capabilityAdditionVerificationChecks,
    });
    assert.deepEqual(verifierCalls, [root]);
    assert.equal(repository.writes.length, 3);
    assert.deepEqual(repository.writes[0], plan.actions.map(({ path }) => path));
    assert.deepEqual(repository.writes[1], [".egeria/migrations.jsonl"]);
    assert.deepEqual(repository.writes[2], [".egeria/state.json"]);
    assert.notEqual(repository.files.get(".egeria/state.json"), initialState);

    const state = core.parseStateJson(repository.files.get(".egeria/state.json"));
    const migrations = core.parseMigrationLog(
      repository.files.get(".egeria/migrations.jsonl"),
    );
    assert.equal(state.ok, true, JSON.stringify(state.issues));
    assert.equal(migrations.ok, true, JSON.stringify(migrations.issues));
    assert.deepEqual(state.value.appliedMigrations, [
      "add-booking-calendly-0-1-0",
    ]);
    assert.deepEqual(state.value.lastSuccessfulVerification, {
      kind: "capability-addition",
      checks: persistedVerificationChecks,
    });
    assert.equal(migrations.value.length, 1);
    assert.equal(migrations.value[0].identifier, "add-booking-calendly-0-1-0");
    assert.deepEqual(
      migrations.value[0].verificationChecks,
      persistedVerificationChecks,
    );
    assert.deepEqual(expectedInspections, [
      {
        root,
        identity: git.identity,
        expectedPaths: result.value.changedPaths,
      },
    ]);
    assert.doesNotMatch(JSON.stringify(result), /private|calendly\.com|refs\/heads/u);
  }
});

test("capability addition refuses an unapproved plan before writes or verification", async () => {
  const repository = createRepository(await fixtureEntries());
  const before = JSON.stringify([...repository.files]);
  const { result, verifierCalls } = await runApply(repository, {
    approvedPlanFingerprint: `sha256:${"0".repeat(64)}`,
  });

  assert.deepEqual(result, {
    ok: false,
    code: "CAPABILITY_PLAN_APPROVAL_INVALID",
    phase: "precondition",
    recovery: "not-required",
  });
  assert.deepEqual(repository.writes, []);
  assert.deepEqual(verifierCalls, []);
  assert.equal(JSON.stringify([...repository.files]), before);
});

test("capability addition preserves prior control state when verification fails", async () => {
  const repository = createRepository(await fixtureEntries());
  const initialState = repository.files.get(".egeria/state.json");
  const initialMigrations = repository.files.get(".egeria/migrations.jsonl");
  let clockCalls = 0;
  const { result } = await runApply(repository, {
    verifier: {
      prepareLockfile() {
        throw new Error("not used");
      },
      verifyInIsolatedCopy() {
        return Promise.resolve({
          ok: false,
          issues: [
            {
              code: "PRIVATE_FAILURE",
              path: [],
              context: { reason: "private verifier detail" },
            },
          ],
        });
      },
    },
    now: () => {
      clockCalls += 1;
      return "2026-08-21T15:00:00.000Z";
    },
  });

  assert.deepEqual(result, {
    ok: false,
    code: "CAPABILITY_VERIFICATION_FAILED",
    phase: "verify",
    recovery: "inspect-worktree",
  });
  assert.equal(repository.files.get(".egeria/state.json"), initialState);
  assert.equal(
    repository.files.get(".egeria/migrations.jsonl"),
    initialMigrations,
  );
  assert.equal(repository.writes.length, 1);
  assert.equal(clockCalls, 0);
  assert.doesNotMatch(JSON.stringify(result), /private verifier detail/u);
});

test("capability addition refuses changed output bytes before persistence", async () => {
  const repository = createRepository(await fixtureEntries());
  const initialState = repository.files.get(".egeria/state.json");
  const initialMigrations = repository.files.get(".egeria/migrations.jsonl");
  const { result } = await runApply(repository, {
    verifier: {
      prepareLockfile() {
        throw new Error("not used");
      },
      verifyInIsolatedCopy() {
        repository.files.set("apps/web/app/page.tsx", "concurrent edit\n");
        return Promise.resolve({
          ok: true,
          value: { checks: core.ordinaryGenerationVerificationChecks },
        });
      },
    },
  });

  assert.deepEqual(result, {
    ok: false,
    code: "CAPABILITY_REINFERENCE_FAILED",
    phase: "re-infer",
    recovery: "inspect-worktree",
  });
  assert.equal(repository.files.get(".egeria/state.json"), initialState);
  assert.equal(
    repository.files.get(".egeria/migrations.jsonl"),
    initialMigrations,
  );
});

test("capability addition preserves state when migration persistence fails", async () => {
  const migrationFailureRepository = createRepository(await fixtureEntries(), 2);
  const initialState = migrationFailureRepository.files.get(".egeria/state.json");
  const migrationFailure = await runApply(migrationFailureRepository);
  assert.deepEqual(migrationFailure.result, {
    ok: false,
    code: "CAPABILITY_MIGRATION_WRITE_FAILED",
    phase: "persist-migration",
    recovery: "inspect-worktree",
  });
  assert.equal(
    migrationFailureRepository.files.get(".egeria/state.json"),
    initialState,
  );
});

test("capability addition records only persisted checks when state persistence fails", async () => {
  const stateFailureRepository = createRepository(await fixtureEntries(), 3);
  const stateFailure = await runApply(stateFailureRepository);
  assert.deepEqual(stateFailure.result, {
    ok: false,
    code: "CAPABILITY_STATE_WRITE_FAILED",
    phase: "persist-state",
    recovery: "inspect-worktree",
  });
  const stateFailureMigrations = core.parseMigrationLog(
    stateFailureRepository.files.get(".egeria/migrations.jsonl"),
  );
  assert.equal(stateFailureMigrations.ok, true);
  assert.deepEqual(
    stateFailureMigrations.value.at(-1).verificationChecks,
    persistedVerificationChecks,
  );
  assert.equal(
    stateFailureMigrations.value.at(-1).completedAt,
    "2026-08-21T15:00:00.000Z",
  );
});

test("capability addition retains persisted receipts when post-state inference disagrees", async () => {
  const postStateRepository = createRepository(
    await fixtureEntries(),
    undefined,
    ({ batch, files }) => {
      if (batch === 3) {
        files.set(
          ".egeria/migrations.jsonl",
          files
            .get(".egeria/migrations.jsonl")
            .replace("15:00:00.000Z", "15:00:00.001Z"),
        );
      }
    },
  );
  const postStateFailure = await runApply(postStateRepository);
  assert.deepEqual(postStateFailure.result, {
    ok: false,
    code: "CAPABILITY_POST_STATE_FAILED",
    phase: "post-state",
    recovery: "inspect-worktree",
  });
  const postState = core.parseStateJson(
    postStateRepository.files.get(".egeria/state.json"),
  );
  assert.equal(postState.ok, true);
  assert.deepEqual(postState.value.lastSuccessfulVerification, {
    kind: "capability-addition",
    checks: persistedVerificationChecks,
  });
});

test("capability addition reports a final diff refusal after persistence", async () => {
  const finalDiffRepository = createRepository(await fixtureEntries());
  const finalDiffFailure = await runApply(finalDiffRepository, {
    inspectExpectedChanges: () =>
      Promise.resolve({ ok: false, code: "GIT_WORKTREE_CHANGED" }),
  });
  assert.deepEqual(finalDiffFailure.result, {
    ok: false,
    code: "GIT_WORKTREE_CHANGED",
    phase: "final-diff",
    recovery: "inspect-worktree",
  });
  assert.equal(finalDiffRepository.writes.length, 3);
});

test("capability addition refuses changed final bytes after diff inspection", async () => {
  const finalBytesRepository = createRepository(await fixtureEntries());
  const finalBytesFailure = await runApply(finalBytesRepository, {
    inspectExpectedChanges: () => {
      finalBytesRepository.files.set(
        "apps/web/app/page.tsx",
        "concurrent final edit\n",
      );
      return Promise.resolve({ ok: true });
    },
  });
  assert.deepEqual(finalBytesFailure.result, {
    ok: false,
    code: "CAPABILITY_POST_STATE_FAILED",
    phase: "post-state",
    recovery: "inspect-worktree",
  });
});

test("capability addition requires inspection for a retained partial transform prefix", async () => {
  const repository = createRepository(await fixtureEntries());
  const before = new Map(repository.files);
  repository.writer.write = async (changes) => {
    const first = changes[0];
    repository.files.set(first.path, decoder.decode(first.content));
    return { ok: false, sourceChanged: true };
  };

  const { plan, result } = await runApply(repository);
  assert.deepEqual(result, {
    ok: false,
    code: "CAPABILITY_TRANSFORM_FAILED",
    phase: "transform",
    recovery: "inspect-worktree",
  });
  assert.notEqual(
    repository.files.get(plan.actions[0].path),
    before.get(plan.actions[0].path),
  );
  for (const action of plan.actions.slice(1)) {
    assert.equal(repository.files.get(action.path), before.get(action.path));
  }
});

test("filesystem addition writer replaces expected files and exclusively creates targets", async (context) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "egeria-addition-writer-"));
  context.after(() => rm(temporaryRoot, { recursive: true, force: false }));
  await writeFile(join(temporaryRoot, "existing.txt"), "before\n", "utf8");
  const writer = core.createFileSystemCapabilityAdditionWriter(temporaryRoot);

  assert.deepEqual(
    await writer.write([
      {
        path: "existing.txt",
        expected: { kind: "file", content: encoder.encode("before\n") },
        content: encoder.encode("after\n"),
      },
      {
        path: "new/nested.txt",
        expected: { kind: "missing" },
        content: encoder.encode("created\n"),
      },
    ]),
    { ok: true },
  );
  assert.equal(await readFile(join(temporaryRoot, "existing.txt"), "utf8"), "after\n");
  assert.equal(
    await readFile(join(temporaryRoot, "new/nested.txt"), "utf8"),
    "created\n",
  );

  assert.deepEqual(
    await writer.write([
      {
        path: "existing.txt",
        expected: { kind: "file", content: encoder.encode("before\n") },
        content: encoder.encode("must-not-write\n"),
      },
    ]),
    { ok: false, sourceChanged: false },
  );
  assert.equal(await readFile(join(temporaryRoot, "existing.txt"), "utf8"), "after\n");

  assert.deepEqual(
    await writer.write([
      {
        path: "not-created/nested.txt",
        expected: { kind: "missing" },
        content: encoder.encode("must-not-create\n"),
      },
      {
        path: "existing.txt",
        expected: { kind: "file", content: encoder.encode("stale\n") },
        content: encoder.encode("must-not-write\n"),
      },
    ]),
    { ok: false, sourceChanged: false },
  );
  await assert.rejects(
    lstat(join(temporaryRoot, "not-created")),
    (error) => error?.code === "ENOENT",
  );

  await symlink(join(temporaryRoot, "existing.txt"), join(temporaryRoot, "link.txt"));
  assert.deepEqual(
    await writer.write([
      {
        path: "link.txt",
        expected: { kind: "file", content: encoder.encode("after\n") },
        content: encoder.encode("must-not-follow\n"),
      },
    ]),
    { ok: false, sourceChanged: false },
  );
  assert.equal(await readFile(join(temporaryRoot, "existing.txt"), "utf8"), "after\n");
});

test("filesystem addition writer preserves live files across commit races and staged-write failure", async (context) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "egeria-addition-race-"));
  context.after(() => rm(temporaryRoot, { recursive: true, force: false }));
  const target = join(temporaryRoot, "existing.txt");
  await writeFile(target, "before\n", "utf8");

  const concurrentWriter = core.createFileSystemCapabilityAdditionWriter(
    temporaryRoot,
    {
      beforeCommit: async () => writeFile(target, "concurrent\n", "utf8"),
    },
  );
  assert.deepEqual(
    await concurrentWriter.write([
      {
        path: "existing.txt",
        expected: { kind: "file", content: encoder.encode("before\n") },
        content: encoder.encode("after\n"),
      },
    ]),
    { ok: false, sourceChanged: false },
  );
  assert.equal(await readFile(target, "utf8"), "concurrent\n");

  await writeFile(target, "before\n", "utf8");
  const failingWriter = core.createFileSystemCapabilityAdditionWriter(
    temporaryRoot,
    {
      beforeCommit: () => Promise.reject(new Error("injected failure")),
    },
  );
  assert.deepEqual(
    await failingWriter.write([
      {
        path: "existing.txt",
        expected: { kind: "file", content: encoder.encode("before\n") },
        content: encoder.encode("after\n"),
      },
    ]),
    { ok: false, sourceChanged: false },
  );
  assert.equal(await readFile(target, "utf8"), "before\n");
  assert.deepEqual(await readdir(temporaryRoot), ["existing.txt"]);

  const firstTarget = join(temporaryRoot, "first.txt");
  const secondTarget = join(temporaryRoot, "second.txt");
  await writeFile(firstTarget, "first before\n", "utf8");
  await writeFile(secondTarget, "second before\n", "utf8");
  const partialWriter = core.createFileSystemCapabilityAdditionWriter(
    temporaryRoot,
    {
      beforeCommit: (path) =>
        path === "second.txt"
          ? Promise.reject(new Error("injected second commit failure"))
          : Promise.resolve(),
    },
  );
  assert.deepEqual(
    await partialWriter.write([
      {
        path: "first.txt",
        expected: {
          kind: "file",
          content: encoder.encode("first before\n"),
        },
        content: encoder.encode("first after\n"),
      },
      {
        path: "second.txt",
        expected: {
          kind: "file",
          content: encoder.encode("second before\n"),
        },
        content: encoder.encode("second after\n"),
      },
    ]),
    { ok: false, sourceChanged: true },
  );
  assert.equal(await readFile(firstTarget, "utf8"), "first after\n");
  assert.equal(await readFile(secondTarget, "utf8"), "second before\n");
  assert.deepEqual((await readdir(temporaryRoot)).sort(), [
    "existing.txt",
    "first.txt",
    "second.txt",
  ]);
});
