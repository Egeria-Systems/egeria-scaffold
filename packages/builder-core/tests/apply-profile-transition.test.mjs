import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  lstat,
  readFile,
  readdir,
  rename,
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
const { createProfileRecipeSnapshot } = await import(
  pathToFileURL(resolve(packageRoot, "dist/profiles/profile-recipes.js"))
);
const historicalTransitionContext = {
  catalogSnapshot: { standards: "0.4.0", siteRouting: "0.3.0" },
  profiles: createProfileRecipeSnapshot("0.10.0"),
};
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const root = "/generated/project";
const migrationIdentifier = "transition-portfolio-0-10-0-to-site-0-10-0";
const completedAt = "2026-08-23T15:00:00.000Z";
const git = Object.freeze({
  ok: true,
  identity: Object.freeze({
    root,
    revision: "abcdef0123456789abcdef0123456789abcdef01",
    attachedRef: "refs/heads/portfolio-to-site-transition",
    gitDirectory: "/generated/common/.git/worktrees/portfolio-to-site-transition",
    commonDirectory: "/generated/common/.git",
  }),
});
const createPaths = [
  "apps/web/app/about/page.tsx",
  "apps/web/content/en-CA/about.yaml",
];
const exactChangedPaths = [
  ".egeria/migrations.jsonl",
  ".egeria/project.yaml",
  ".egeria/state.json",
  ...createPaths,
  "apps/web/content/en-CA/long-form/introduction.md",
  "apps/web/content/en-CA/site.yaml",
  "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
];
const baselinePaths = exactChangedPaths.slice(-2);

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function bytes(value) {
  return typeof value === "string" ? encoder.encode(value) : new Uint8Array(value);
}

function decode(value) {
  return decoder.decode(value);
}

function sameBytes(left, right) {
  return (
    left.length === right.length &&
    left.every((byte, index) => byte === right[index])
  );
}

async function loadEntries(directory) {
  const entries = new Map();

  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const absolutePath = join(current, entry.name);

      if (entry.isDirectory()) {
        await visit(absolutePath);
      } else if (entry.isFile()) {
        const path = relative(directory, absolutePath).split(sep).join("/");
        entries.set(path, new Uint8Array(await readFile(absolutePath)));
      }
    }
  }

  await visit(directory);
  return entries;
}

async function currentEntries(profile) {
  return loadEntries(resolve(repositoryRoot, `fixtures/generated/${profile}`));
}

async function sourceEntries(variant = "portfolio") {
  return currentEntries(variant);
}

async function transitionTargetEntries(source) {
  const project = core.parseProjectYaml(
    decode(source.get(".egeria/project.yaml")),
  );
  assert.equal(project.ok, true, JSON.stringify(project.issues));
  const booking = project.value.capabilitySettings["booking-calendly"];
  const rendered = await core.renderSkeleton(
    {
      profile: "site",
      projectName: project.value.project.name,
      displayName: project.value.project.displayName,
      packageVersions: core.verifiedCapabilityPackageVersions,
      ...(booking === undefined ? {} : { bookingCalendly: booking }),
    },
    historicalTransitionContext,
  );
  assert.equal(rendered.ok, true, JSON.stringify(rendered.issues));
  return new Map([
    ...rendered.value.files.map(({ path, content }) => [path, content]),
    [
      ".egeria/project.yaml",
      encoder.encode(core.serializeProjectYaml(rendered.value.project)),
    ],
  ]);
}

function snapshotFiles(files) {
  return [...files]
    .sort(([left], [right]) => compareText(left, right))
    .map(([path, content]) => [path, Buffer.from(content).toString("base64")]);
}

function createRepository(entries, options = {}) {
  const files = new Map(
    [...entries].map(([path, content]) => [path, new Uint8Array(content)]),
  );
  const writes = [];

  const repository = {
    files,
    writes,
    reader: {
      async readText(path) {
        if (options.throwOnRead === path) {
          throw new Error("private repository failure");
        }

        const content = files.get(path);
        if (content === undefined) {
          return { kind: "missing" };
        }

        try {
          return { kind: "file", content: decode(content) };
        } catch {
          return { kind: "error", code: "FILE_ENCODING_INVALID" };
        }
      },
      async readBytes(path) {
        const content = files.get(path);
        return content === undefined
          ? { kind: "missing" }
          : { kind: "file", content: new Uint8Array(content) };
      },
    },
    writer: {
      async write(changes) {
        const batch = writes.length + 1;
        if (options.throwBatch === batch) {
          throw new Error("private writer failure");
        }
        if (options.failBatch === batch) {
          return {
            ok: false,
            sourceChanged: options.failBatchSourceChanged ?? false,
          };
        }

        for (const change of changes) {
          const current = files.get(change.path);
          if (
            (change.expected.kind === "missing" && current !== undefined) ||
            (change.expected.kind === "file" &&
              (current === undefined ||
                !sameBytes(current, change.expected.content)))
          ) {
            return { ok: false, sourceChanged: false };
          }
        }

        for (const change of changes) {
          files.set(change.path, new Uint8Array(change.content));
        }
        writes.push(changes.map((change) => structuredClone(change)));
        await options.afterWrite?.({ batch, changes, files });
        return { ok: true };
      },
    },
  };

  return repository;
}

async function approvedPlan(reader, gitInspection = git) {
  const result = await core.planProfileTransition({
    reader,
    git: gitInspection,
    toProfile: "site",
  });
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  return result.value;
}

function successfulVerifier(calls) {
  return {
    prepareLockfile() {
      throw new Error("transition must not prepare a lockfile");
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

async function invokeApply(repository, overrides = {}) {
  const worktreeInspections = [];
  const createTargetInspections = [];
  const expectedChangeInspections = [];
  const verifierCalls = [];
  let worktreeCall = 0;
  const result = await core.applyProfileTransition({
    root: overrides.root ?? root,
    toProfile: overrides.toProfile ?? "site",
    approvedPlanFingerprint:
      overrides.approvedPlanFingerprint ?? `sha256:${"0".repeat(64)}`,
    reader: repository.reader,
    writer: repository.writer,
    verifier: overrides.verifier ?? successfulVerifier(verifierCalls),
    inspectWorktree:
      overrides.inspectWorktree ??
      ((input) => {
        worktreeInspections.push(input);
        worktreeCall += 1;
        return Promise.resolve(
          overrides.worktrees?.[worktreeCall - 1] ?? git,
        );
      }),
    inspectCreateTargets:
      overrides.inspectCreateTargets ??
      ((input) => {
        createTargetInspections.push(input);
        return Promise.resolve({ ok: true });
      }),
    inspectExpectedChanges:
      overrides.inspectExpectedChanges ??
      ((input) => {
        expectedChangeInspections.push(input);
        return Promise.resolve({ ok: true });
      }),
    constructState: overrides.constructState,
    now: overrides.now ?? (() => completedAt),
  });

  return {
    createTargetInspections,
    expectedChangeInspections,
    result,
    verifierCalls,
    worktreeInspections,
  };
}

async function runApply(repository, overrides = {}) {
  const plan = await approvedPlan(repository.reader);
  await overrides.afterPlan?.({ plan, repository });
  return {
    plan,
    ...(await invokeApply(repository, {
      ...overrides,
      approvedPlanFingerprint:
        overrides.approvedPlanFingerprint ?? plan.planFingerprint,
    })),
  };
}

function assertControlBytes(repository, expected) {
  for (const path of [
    ".egeria/project.yaml",
    ".egeria/state.json",
    ".egeria/migrations.jsonl",
  ]) {
    assert.deepEqual(repository.files.get(path), expected.get(path), path);
  }
}

function assertPersistenceControlBytes(repository, expected) {
  for (const path of [".egeria/state.json", ".egeria/migrations.jsonl"]) {
    assert.deepEqual(repository.files.get(path), expected.get(path), path);
  }
}

function assertUnchanged(repository, before) {
  assert.deepEqual(snapshotFiles(repository.files), before);
}

function assertExactChangedPaths(files, before, expectedPaths) {
  const beforeByPath = new Map(before);
  const after = snapshotFiles(files);
  const afterByPath = new Map(after);
  const paths = new Set([...beforeByPath.keys(), ...afterByPath.keys()]);
  assert.deepEqual(
    [...paths]
      .filter((path) => beforeByPath.get(path) !== afterByPath.get(path))
      .sort(compareText),
    expectedPaths,
  );
}

function assertSourceActionsMatchTarget(repository, plan, target) {
  for (const action of plan.actions) {
    assert.deepEqual(
      repository.files.get(action.path),
      target.get(action.path),
      action.path,
    );
  }
}

function desiredIdentifiers(plan) {
  return plan.target.capabilities.map(({ identifier }) => identifier);
}

function expectedMigrationSource(originalSource, desiredCapabilities) {
  const separator =
    originalSource.length > 0 && !originalSource.endsWith("\n") ? "\n" : "";
  return `${originalSource}${separator}${core.serializeMigrationRecord({
    schemaVersion: "1.0.0",
    identifier: migrationIdentifier,
    kind: "migration",
    outcome: "succeeded",
    completedAt,
    fromBuilderVersion: "0.0.0",
    toBuilderVersion: "0.0.0",
    capabilities: desiredCapabilities,
    persistentDataAuthorizations: [],
    remainingKnownDrift: [],
    verificationChecks: core.profileTransitionPersistedVerificationChecks,
  })}`;
}

async function writeEntries(directory, entries) {
  for (const [path, content] of entries) {
    const absolutePath = join(directory, path);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content);
  }
}

async function withFileSystemRepository(entries, run) {
  const directory = await mkdtemp(
    join(tmpdir(), "egeria-profile-transition-executor-"),
  );
  try {
    await writeEntries(directory, entries);
    return await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function runFileSystemApply(directory, overrides = {}) {
  const identity = Object.freeze({
    root: directory,
    revision: git.identity.revision,
    attachedRef: git.identity.attachedRef,
    gitDirectory: join(directory, ".git-worktrees", "portfolio-to-site-transition"),
    commonDirectory: join(directory, ".git-common"),
  });
  const inspection = Object.freeze({ ok: true, identity });
  const plan = await approvedPlan(
    core.createFileSystemRepositoryReader(directory),
    inspection,
  );
  const verifierCalls = [];
  const result = await core.applyProfileTransition({
    root: directory,
    toProfile: "site",
    approvedPlanFingerprint: plan.planFingerprint,
    verifier: successfulVerifier(verifierCalls),
    inspectWorktree: () => Promise.resolve(inspection),
    inspectCreateTargets: () => Promise.resolve({ ok: true }),
    inspectExpectedChanges:
      overrides.inspectExpectedChanges ?? (() => Promise.resolve({ ok: true })),
    afterExactFileRead: overrides.afterExactFileRead,
    now: () => completedAt,
  });
  return { plan, result, verifierCalls };
}

function assertFailure(result, expected) {
  assert.deepEqual(result, { ok: false, ...expected });
  assert.doesNotMatch(
    JSON.stringify(result),
    /private repository failure|private writer failure|refs\/heads|generated\/common/u,
  );
}

test("the exact portfolio-to-site profile transition executor and writer are exported", () => {
  assert.equal(typeof core.applyProfileTransition, "function");
  assert.equal(typeof core.createFileSystemProfileTransitionWriter, "function");
});

test("portfolio-to-site profile transition refuses unsupported target inputs without mutation", async () => {
  for (const unsupported of [
    { toProfile: "portfolio" },
    { toProfile: "app" },
  ]) {
    const repository = createRepository(await sourceEntries("portfolio"));
    const before = snapshotFiles(repository.files);
    const controls = new Map(
      [".egeria/project.yaml", ".egeria/state.json", ".egeria/migrations.jsonl"].map(
        (path) => [path, new Uint8Array(repository.files.get(path))],
      ),
    );
    const execution = await invokeApply(repository, unsupported);
    assertFailure(execution.result, {
      code: "PROFILE_TRANSITION_UNSUPPORTED",
      phase: "precondition",
      recovery: "not-required",
    });
    assertUnchanged(repository, before);
    assertControlBytes(repository, controls);
    assert.equal(repository.writes.length, 0);
    assert.deepEqual(execution.verifierCalls, []);
  }
});

test("portfolio-to-site profile transition transforms, verifies, persists state last, and stops for final-diff approval", async () => {
  const source = await sourceEntries();
  const target = await transitionTargetEntries(source);
  const repository = createRepository(source);
  const initialState = core.parseStateJson(
    decode(repository.files.get(".egeria/state.json")),
  );
  assert.equal(initialState.ok, true);

  const execution = await runApply(repository);
  assert.equal(execution.result.ok, true, JSON.stringify(execution.result));
  const changedPaths = [
    ...execution.plan.actions.map(({ path }) => path),
    ".egeria/migrations.jsonl",
    ".egeria/state.json",
  ].sort(compareText);
  assert.deepEqual(changedPaths, exactChangedPaths);
  assert.deepEqual(execution.result.value, {
    status: "verified-final-diff-approval-required",
    baseRevision: git.identity.revision,
    transition: {
      fromProfile: "portfolio",
      fromRecipeVersion: "0.10.0",
      toProfile: "site",
      toRecipeVersion: "0.10.0",
    },
    migration: migrationIdentifier,
    changedPaths,
    verificationChecks: core.profileTransitionVerificationChecks,
  });
  assert.deepEqual(execution.verifierCalls, [root]);
  assert.deepEqual(
    repository.writes.map((batch) => batch.map(({ path }) => path)),
    [
      execution.plan.actions.map(({ path }) => path),
      [".egeria/migrations.jsonl"],
      [".egeria/state.json"],
    ],
  );
  assert.deepEqual(execution.worktreeInspections, [{ root }, { root }]);
  assert.deepEqual(execution.createTargetInspections, [{ root, paths: createPaths }]);
  assert.deepEqual(execution.expectedChangeInspections, [
    { root, identity: git.identity, expectedPaths: changedPaths },
  ]);
  assertSourceActionsMatchTarget(repository, execution.plan, target);

  const migrations = core.parseMigrationLog(
    decode(repository.files.get(".egeria/migrations.jsonl")),
  );
  const state = core.parseStateJson(
    decode(repository.files.get(".egeria/state.json")),
  );
  assert.equal(migrations.ok, true, JSON.stringify(migrations.issues));
  assert.equal(state.ok, true, JSON.stringify(state.issues));
  const desiredCapabilities = execution.plan.target.capabilities.map(
    ({ identifier }) => identifier,
  );
  assert.deepEqual(migrations.value.at(-1), {
    schemaVersion: "1.0.0",
    identifier: migrationIdentifier,
    kind: "migration",
    outcome: "succeeded",
    completedAt,
    fromBuilderVersion: "0.0.0",
    toBuilderVersion: "0.0.0",
    capabilities: desiredCapabilities,
    persistentDataAuthorizations: [],
    remainingKnownDrift: [],
    verificationChecks: core.profileTransitionPersistedVerificationChecks,
  });
  assert.deepEqual(state.value.origin, {
    profile: "site",
    recipeVersion: "0.10.0",
  });
  assert.equal(state.value.builderVersion, initialState.value.builderVersion);
  assert.equal(
    state.value.projectSchemaVersion,
    initialState.value.projectSchemaVersion,
  );
  assert.deepEqual(state.value.compatibility, initialState.value.compatibility);
  assert.deepEqual(state.value.ejections, initialState.value.ejections);
  assert.deepEqual(state.value.appliedMigrations, [migrationIdentifier]);
  assert.deepEqual(
    state.value.installedCapabilities
      .map(({ identifier }) => identifier)
      .sort(compareText),
    [...desiredCapabilities].sort(compareText),
  );
  assert.deepEqual(state.value.lastSuccessfulVerification, {
    kind: "profile-transition",
    checks: core.profileTransitionPersistedVerificationChecks,
  });
  assert.doesNotMatch(JSON.stringify(execution.result), /refs\/heads|displayName/u);
});

test("portfolio-to-site profile transition preserves the optional Calendly capability and settings", async () => {
  const source = await sourceEntries("portfolio-calendly");
  const before = snapshotFiles(source);
  const target = await transitionTargetEntries(source);
  const repository = createRepository(source);
  const sourceProject = core.parseProjectYaml(
    decode(source.get(".egeria/project.yaml")),
  );
  assert.equal(sourceProject.ok, true);

  const execution = await runApply(repository);
  assert.equal(execution.result.ok, true, JSON.stringify(execution.result));
  assert.deepEqual(execution.result.value.changedPaths, exactChangedPaths);
  assertExactChangedPaths(repository.files, before, exactChangedPaths);
  assertSourceActionsMatchTarget(repository, execution.plan, target);

  const project = core.parseProjectYaml(
    decode(repository.files.get(".egeria/project.yaml")),
  );
  const state = core.parseStateJson(
    decode(repository.files.get(".egeria/state.json")),
  );
  assert.equal(project.ok, true);
  assert.equal(state.ok, true);
  assert.deepEqual(
    project.value.capabilitySettings["booking-calendly"],
    sourceProject.value.capabilitySettings["booking-calendly"],
  );
  assert.equal(
    state.value.installedCapabilities.some(
      ({ identifier }) => identifier === "booking-calendly",
    ),
    true,
  );
});

test("portfolio-to-site profile transition refuses malformed, wrong, and stale plan authority without mutation", async () => {
  for (const approvedPlanFingerprint of [
    "not-a-fingerprint",
    `sha256:${"0".repeat(64)}`,
  ]) {
    const repository = createRepository(await sourceEntries("portfolio"));
    const before = snapshotFiles(repository.files);
    const execution = await runApply(repository, { approvedPlanFingerprint });
    assertFailure(execution.result, {
      code: "PROFILE_TRANSITION_PLAN_APPROVAL_INVALID",
      phase: "precondition",
      recovery: "not-required",
    });
    assertUnchanged(repository, before);
    assert.equal(repository.writes.length, 0);
    assert.deepEqual(execution.verifierCalls, []);
  }

  const repository = createRepository(await sourceEntries("portfolio"));
  const before = snapshotFiles(repository.files);
  const controls = new Map(
    [".egeria/project.yaml", ".egeria/state.json", ".egeria/migrations.jsonl"].map(
      (path) => [path, new Uint8Array(repository.files.get(path))],
    ),
  );
  const execution = await runApply(repository, {
    afterPlan: ({ repository: current }) => {
      const state = core.parseStateJson(decode(current.files.get(".egeria/state.json")));
      assert.equal(state.ok, true);
      current.files.set(
        ".egeria/state.json",
        encoder.encode(JSON.stringify(state.value)),
      );
    },
  });
  assertFailure(execution.result, {
    code: "PROFILE_TRANSITION_PLAN_APPROVAL_INVALID",
    phase: "precondition",
    recovery: "not-required",
  });
  assert.deepEqual(snapshotFiles(repository.files).length, before.length);
  assert.equal(repository.writes.length, 0);
  assert.notDeepEqual(repository.files.get(".egeria/state.json"), controls.get(".egeria/state.json"));
  assert.deepEqual(repository.files.get(".egeria/project.yaml"), controls.get(".egeria/project.yaml"));
  assert.deepEqual(repository.files.get(".egeria/migrations.jsonl"), controls.get(".egeria/migrations.jsonl"));
});

test("portfolio-to-site profile transition propagates named planner refusals without mutation", async () => {
  const collisionEntries = await sourceEntries("portfolio");
  const collisionTarget = await transitionTargetEntries(collisionEntries);
  for (const path of createPaths) {
    collisionEntries.set(path, collisionTarget.get(path));
  }
  const cases = [
    {
      name: "already current",
      entries: await currentEntries("site"),
      code: "PROFILE_ALREADY_CURRENT",
    },
    {
      name: "managed drift",
      entries: await sourceEntries("portfolio"),
      mutate(entries) {
        entries.set(
          ".github/workflows/quality.yml",
          encoder.encode("managed drift\n"),
        );
      },
      code: "PROJECT_DRIFT_DETECTED",
    },
    {
      name: "create collision",
      entries: collisionEntries,
      code: "PROFILE_TRANSITION_ACTION_CONFLICT",
    },
    {
      name: "invalid migration history",
      entries: await sourceEntries("portfolio"),
      mutate(entries) {
        entries.set(".egeria/migrations.jsonl", encoder.encode("{\n"));
      },
      code: "PROJECT_STATE_INCOMPATIBLE",
    },
  ];

  for (const row of cases) {
    row.mutate?.(row.entries);
    const repository = createRepository(row.entries);
    const before = snapshotFiles(repository.files);
    const controls = new Map(
      [".egeria/project.yaml", ".egeria/state.json", ".egeria/migrations.jsonl"].map(
        (path) => [path, new Uint8Array(repository.files.get(path))],
      ),
    );
    const execution = await invokeApply(repository);
    assertFailure(execution.result, {
      code: row.code,
      phase: "precondition",
      recovery: "not-required",
    });
    assertUnchanged(repository, before);
    assertControlBytes(repository, controls);
    assert.equal(repository.writes.length, 0, row.name);
  }
});

test("portfolio-to-site profile transition refuses duplicate migration history before writing", async () => {
  const entries = await sourceEntries("portfolio");
  const state = core.parseStateJson(decode(entries.get(".egeria/state.json")));
  assert.equal(state.ok, true);
  const record = {
    schemaVersion: "1.0.0",
    identifier: migrationIdentifier,
    kind: "migration",
    outcome: "succeeded",
    completedAt,
    fromBuilderVersion: "0.0.0",
    toBuilderVersion: "0.0.0",
    capabilities: state.value.installedCapabilities
      .map(({ identifier }) => identifier)
      .sort(compareText),
    persistentDataAuthorizations: [],
    remainingKnownDrift: [],
    verificationChecks: core.profileTransitionPersistedVerificationChecks,
  };
  const migrationSource = core.serializeMigrationRecord(record);
  entries.set(".egeria/migrations.jsonl", encoder.encode(migrationSource));
  entries.set(
    ".egeria/state.json",
    encoder.encode(
      core.serializeStateJson({
        ...state.value,
        appliedMigrations: [migrationIdentifier],
        managedSurfaces: state.value.managedSurfaces.map((surface) =>
          surface.identifier === "builder-migration-log"
            ? {
                ...surface,
                fingerprint: core.fingerprintFileContent(
                  encoder.encode(migrationSource),
                ),
              }
            : surface,
        ),
      }),
    ),
  );
  const repository = createRepository(entries);
  const before = snapshotFiles(repository.files);
  const execution = await runApply(repository);
  assertFailure(execution.result, {
    code: "PROJECT_STATE_INCOMPATIBLE",
    phase: "precondition",
    recovery: "not-required",
  });
  assertUnchanged(repository, before);
  assert.equal(repository.writes.length, 0);
});

test("portfolio-to-site profile transition refuses unsafe Git and changed pre-write identity", async () => {
  for (const code of [
    "GIT_REPOSITORY_REQUIRED",
    "GIT_WORKTREE_IDENTITY_INVALID",
    "GIT_WORKTREE_NOT_ISOLATED",
    "GIT_BRANCH_REQUIRED",
    "GIT_OPERATION_IN_PROGRESS",
    "GIT_WORKTREE_CONFLICTED",
    "GIT_WORKTREE_DIRTY",
  ]) {
    const repository = createRepository(await sourceEntries("portfolio"));
    const before = snapshotFiles(repository.files);
    const execution = await invokeApply(repository, {
      inspectWorktree: () => Promise.resolve({ ok: false, code }),
    });
    assertFailure(execution.result, {
      code,
      phase: "precondition",
      recovery: "not-required",
    });
    assertUnchanged(repository, before);
  }

  const nonCanonical = createRepository(await sourceEntries("portfolio"));
  const nonCanonicalBefore = snapshotFiles(nonCanonical.files);
  const nonCanonicalExecution = await invokeApply(nonCanonical, {
    root: "/generated/../generated/project",
  });
  assertFailure(nonCanonicalExecution.result, {
    code: "GIT_WORKTREE_IDENTITY_INVALID",
    phase: "precondition",
    recovery: "not-required",
  });
  assertUnchanged(nonCanonical, nonCanonicalBefore);

  const changed = createRepository(await sourceEntries("portfolio"));
  const changedBefore = snapshotFiles(changed.files);
  const changedIdentity = {
    ...git,
    identity: { ...git.identity, revision: "1".repeat(40) },
  };
  const changedExecution = await runApply(changed, {
    worktrees: [git, changedIdentity],
  });
  assertFailure(changedExecution.result, {
    code: "GIT_WORKTREE_CHANGED",
    phase: "precondition",
    recovery: "not-required",
  });
  assertUnchanged(changed, changedBefore);
  assert.equal(changed.writes.length, 0);
});

test("portfolio-to-site profile transition refuses an ignored create target before mutation", async () => {
  const repository = createRepository(await sourceEntries("portfolio"));
  const before = snapshotFiles(repository.files);
  const controls = new Map(
    [".egeria/project.yaml", ".egeria/state.json", ".egeria/migrations.jsonl"].map(
      (path) => [path, new Uint8Array(repository.files.get(path))],
    ),
  );
  const execution = await runApply(repository, {
    inspectCreateTargets: ({ paths }) => {
      assert.deepEqual(paths, createPaths);
      return Promise.resolve({
        ok: false,
        code: "CAPABILITY_ACTION_CONFLICT",
      });
    },
  });
  assertFailure(execution.result, {
    code: "PROFILE_TRANSITION_ACTION_CONFLICT",
    phase: "precondition",
    recovery: "not-required",
  });
  assertUnchanged(repository, before);
  assertControlBytes(repository, controls);
  assert.equal(repository.writes.length, 0);
});

test("portfolio-to-site profile transition contains reader, create-target, and preflight exceptions before writes", async () => {
  const readerFailure = createRepository(await sourceEntries("portfolio"), {
    throwOnRead: ".egeria/project.yaml",
  });
  const readerBefore = snapshotFiles(readerFailure.files);
  const readerExecution = await invokeApply(readerFailure);
  assertFailure(readerExecution.result, {
    code: "PROJECT_INSPECTION_INVALID",
    phase: "precondition",
    recovery: "not-required",
  });
  assertUnchanged(readerFailure, readerBefore);

  const createConflict = createRepository(await sourceEntries("portfolio"));
  const createBefore = snapshotFiles(createConflict.files);
  const createExecution = await runApply(createConflict, {
    inspectCreateTargets: () =>
      Promise.resolve({ ok: false, code: "PROFILE_TRANSITION_ACTION_CONFLICT" }),
  });
  assertFailure(createExecution.result, {
    code: "PROFILE_TRANSITION_ACTION_CONFLICT",
    phase: "precondition",
    recovery: "not-required",
  });
  assertUnchanged(createConflict, createBefore);

  const preflightException = createRepository(
    await sourceEntries("portfolio"),
  );
  const preflightBefore = snapshotFiles(preflightException.files);
  const preflightExecution = await runApply(preflightException, {
    inspectCreateTargets: () => Promise.reject(new Error("private Git failure")),
  });
  assertFailure(preflightExecution.result, {
    code: "GIT_WORKTREE_IDENTITY_INVALID",
    phase: "precondition",
    recovery: "not-required",
  });
  assertUnchanged(preflightException, preflightBefore);
});

test("portfolio-to-site profile transition distinguishes uncommitted and partial transform failures", async () => {
  const refused = createRepository(await sourceEntries("portfolio"), {
    failBatch: 1,
  });
  const refusedBefore = snapshotFiles(refused.files);
  const refusedExecution = await runApply(refused);
  assertFailure(refusedExecution.result, {
    code: "PROFILE_TRANSITION_TRANSFORM_FAILED",
    phase: "transform",
    recovery: "not-required",
  });
  assertUnchanged(refused, refusedBefore);

  const partial = createRepository(await sourceEntries("portfolio"));
  const partialBefore = new Map(
    [...partial.files].map(([path, content]) => [path, new Uint8Array(content)]),
  );
  partial.writer.write = async (changes) => {
    const first = changes[0];
    partial.files.set(first.path, new Uint8Array(first.content));
    return { ok: false, sourceChanged: true };
  };
  const partialExecution = await runApply(partial);
  assertFailure(partialExecution.result, {
    code: "PROFILE_TRANSITION_TRANSFORM_FAILED",
    phase: "transform",
    recovery: "inspect-worktree",
  });
  assert.notDeepEqual(
    partial.files.get(partialExecution.plan.actions[0].path),
    partialBefore.get(partialExecution.plan.actions[0].path),
  );
  for (const action of partialExecution.plan.actions.slice(1)) {
    assert.deepEqual(partial.files.get(action.path), partialBefore.get(action.path));
  }
  assertPersistenceControlBytes(partial, partialBefore);
});

test("portfolio-to-site profile transition contains thrown writer exceptions at every persistence boundary", async () => {
  const cases = [
    {
      batch: 1,
      code: "PROFILE_TRANSITION_TRANSFORM_FAILED",
      phase: "transform",
    },
    {
      batch: 2,
      code: "PROFILE_TRANSITION_MIGRATION_WRITE_FAILED",
      phase: "persist-migration",
    },
    {
      batch: 3,
      code: "PROFILE_TRANSITION_STATE_WRITE_FAILED",
      phase: "persist-state",
    },
  ];

  for (const { batch, code, phase } of cases) {
    const source = await sourceEntries("portfolio");
    const target = await transitionTargetEntries(source);
    const repository = createRepository(source, { throwBatch: batch });
    const before = snapshotFiles(repository.files);
    const initialState = new Uint8Array(repository.files.get(".egeria/state.json"));
    const initialMigrationSource = decode(
      repository.files.get(".egeria/migrations.jsonl"),
    );
    const execution = await runApply(repository);

    assertFailure(execution.result, {
      code,
      phase,
      recovery: "inspect-worktree",
    });
    assert.doesNotMatch(JSON.stringify(execution.result), /private writer failure/u);
    assert.equal(repository.writes.length, batch - 1);
    if (batch === 1) {
      assertUnchanged(repository, before);
      continue;
    }

    assertSourceActionsMatchTarget(repository, execution.plan, target);
    assert.deepEqual(repository.files.get(".egeria/state.json"), initialState);
    assert.equal(
      decode(repository.files.get(".egeria/migrations.jsonl")),
      batch === 2
        ? initialMigrationSource
        : expectedMigrationSource(
            initialMigrationSource,
            desiredIdentifiers(execution.plan),
          ),
    );
    assertExactChangedPaths(
      repository.files,
      before,
      [
        ...execution.plan.actions.map(({ path }) => path),
        ...(batch === 3 ? [".egeria/migrations.jsonl"] : []),
      ].sort(compareText),
    );
  }
});

test("portfolio-to-site profile transition retains transformed source and old controls on verification or re-inference failure", async () => {
  const verificationSource = await sourceEntries("portfolio");
  const target = await transitionTargetEntries(verificationSource);
  const verification = createRepository(verificationSource);
  const verificationControls = new Map(
    [".egeria/project.yaml", ".egeria/state.json", ".egeria/migrations.jsonl"].map(
      (path) => [path, new Uint8Array(verification.files.get(path))],
    ),
  );
  const verificationExecution = await runApply(verification, {
    verifier: {
      prepareLockfile() {
        throw new Error("not used");
      },
      verifyInIsolatedCopy() {
        return Promise.resolve({
          ok: false,
          issues: [{ code: "PRIVATE_FAILURE", path: [], context: {} }],
        });
      },
    },
  });
  assertFailure(verificationExecution.result, {
    code: "PROFILE_TRANSITION_VERIFICATION_FAILED",
    phase: "verify",
    recovery: "inspect-worktree",
  });
  for (const action of verificationExecution.plan.actions) {
    assert.deepEqual(verification.files.get(action.path), target.get(action.path));
  }
  assertPersistenceControlBytes(verification, verificationControls);

  const reinference = createRepository(await sourceEntries("portfolio"));
  const reinferenceControls = new Map(
    [".egeria/project.yaml", ".egeria/state.json", ".egeria/migrations.jsonl"].map(
      (path) => [path, new Uint8Array(reinference.files.get(path))],
    ),
  );
  const reinferenceExecution = await runApply(reinference, {
    verifier: {
      prepareLockfile() {
        throw new Error("not used");
      },
      verifyInIsolatedCopy() {
        reinference.files.set(
          ".github/workflows/quality.yml",
          encoder.encode("concurrent transformed drift\n"),
        );
        return Promise.resolve({
          ok: true,
          value: { checks: core.ordinaryGenerationVerificationChecks },
        });
      },
    },
  });
  assertFailure(reinferenceExecution.result, {
    code: "PROFILE_TRANSITION_REINFERENCE_FAILED",
    phase: "re-infer",
    recovery: "inspect-worktree",
  });
  assertSourceActionsMatchTarget(reinference, reinferenceExecution.plan, target);
  assertPersistenceControlBytes(reinference, reinferenceControls);
});

test("portfolio-to-site profile transition contains a thrown verifier exception with the transformed prefix", async () => {
  const source = await sourceEntries("portfolio");
  const target = await transitionTargetEntries(source);
  const repository = createRepository(source);
  const before = snapshotFiles(repository.files);
  const initialControls = new Map(
    [".egeria/state.json", ".egeria/migrations.jsonl"].map((path) => [
      path,
      new Uint8Array(repository.files.get(path)),
    ]),
  );
  const execution = await runApply(repository, {
    verifier: {
      prepareLockfile() {
        throw new Error("not used");
      },
      verifyInIsolatedCopy() {
        throw new Error("private verifier failure");
      },
    },
  });

  assertFailure(execution.result, {
    code: "PROFILE_TRANSITION_VERIFICATION_FAILED",
    phase: "verify",
    recovery: "inspect-worktree",
  });
  assert.doesNotMatch(JSON.stringify(execution.result), /private verifier failure/u);
  assertSourceActionsMatchTarget(repository, execution.plan, target);
  assertPersistenceControlBytes(repository, initialControls);
  assertExactChangedPaths(
    repository.files,
    before,
    execution.plan.actions.map(({ path }) => path).sort(compareText),
  );
  assert.equal(repository.writes.length, 1);
});

test("portfolio-to-site profile transition maps clock and migration persistence failures to the retained source prefix", async () => {
  const invalidClockSource = await sourceEntries("portfolio");
  const invalidClockTarget = await transitionTargetEntries(invalidClockSource);
  const invalidClock = createRepository(invalidClockSource);
  const invalidClockControls = new Map(
    [".egeria/project.yaml", ".egeria/state.json", ".egeria/migrations.jsonl"].map(
      (path) => [path, new Uint8Array(invalidClock.files.get(path))],
    ),
  );
  const invalidClockExecution = await runApply(invalidClock, {
    now: () => "not-an-iso-time",
  });
  assertFailure(invalidClockExecution.result, {
    code: "PROFILE_TRANSITION_MIGRATION_RECORD_INVALID",
    phase: "persist-migration",
    recovery: "inspect-worktree",
  });
  assertSourceActionsMatchTarget(
    invalidClock,
    invalidClockExecution.plan,
    invalidClockTarget,
  );
  assertPersistenceControlBytes(invalidClock, invalidClockControls);
  assert.equal(invalidClock.writes.length, 1);

  const migrationFailure = createRepository(await sourceEntries("portfolio"), {
    failBatch: 2,
  });
  const migrationState = new Uint8Array(
    migrationFailure.files.get(".egeria/state.json"),
  );
  const migrationExecution = await runApply(migrationFailure);
  assertFailure(migrationExecution.result, {
    code: "PROFILE_TRANSITION_MIGRATION_WRITE_FAILED",
    phase: "persist-migration",
    recovery: "inspect-worktree",
  });
  assert.deepEqual(migrationFailure.files.get(".egeria/state.json"), migrationState);
  assert.equal(migrationFailure.writes.length, 1);
});

test("portfolio-to-site profile transition contains a thrown clock exception with the transformed prefix", async () => {
  const source = await sourceEntries("portfolio");
  const target = await transitionTargetEntries(source);
  const repository = createRepository(source);
  const before = snapshotFiles(repository.files);
  const initialControls = new Map(
    [".egeria/state.json", ".egeria/migrations.jsonl"].map((path) => [
      path,
      new Uint8Array(repository.files.get(path)),
    ]),
  );
  const execution = await runApply(repository, {
    now() {
      throw new Error("private clock failure");
    },
  });

  assertFailure(execution.result, {
    code: "PROFILE_TRANSITION_MIGRATION_RECORD_INVALID",
    phase: "persist-migration",
    recovery: "inspect-worktree",
  });
  assert.doesNotMatch(JSON.stringify(execution.result), /private clock failure/u);
  assertSourceActionsMatchTarget(repository, execution.plan, target);
  assertPersistenceControlBytes(repository, initialControls);
  assertExactChangedPaths(
    repository.files,
    before,
    execution.plan.actions.map(({ path }) => path).sort(compareText),
  );
  assert.equal(repository.writes.length, 1);
});

test("portfolio-to-site profile transition retains the migration prefix when its reread fails", async () => {
  const source = await sourceEntries("portfolio");
  const target = await transitionTargetEntries(source);
  const repository = createRepository(source);
  const before = snapshotFiles(repository.files);
  const initialState = new Uint8Array(repository.files.get(".egeria/state.json"));
  const initialMigrationSource = decode(
    repository.files.get(".egeria/migrations.jsonl"),
  );
  const originalWrite = repository.writer.write;
  const originalReadText = repository.reader.readText;
  let migrationCommitted = false;
  repository.writer.write = async (changes) => {
    const result = await originalWrite(changes);
    if (
      result.ok &&
      changes.length === 1 &&
      changes[0]?.path === ".egeria/migrations.jsonl"
    ) {
      migrationCommitted = true;
    }
    return result;
  };
  repository.reader.readText = (path) =>
    migrationCommitted && path === ".egeria/migrations.jsonl"
      ? Promise.resolve({ kind: "missing" })
      : originalReadText(path);

  const execution = await runApply(repository);
  assertFailure(execution.result, {
    code: "PROFILE_TRANSITION_MIGRATION_WRITE_FAILED",
    phase: "persist-migration",
    recovery: "inspect-worktree",
  });
  assertSourceActionsMatchTarget(repository, execution.plan, target);
  assert.deepEqual(repository.files.get(".egeria/state.json"), initialState);
  assert.equal(
    decode(repository.files.get(".egeria/migrations.jsonl")),
    expectedMigrationSource(
      initialMigrationSource,
      desiredIdentifiers(execution.plan),
    ),
  );
  assertExactChangedPaths(
    repository.files,
    before,
    exactChangedPaths.filter((path) => path !== ".egeria/state.json"),
  );
  assert.equal(repository.writes.length, 2);
});

test("portfolio-to-site profile transition retains an uncertain committed migration append", async () => {
  const source = await sourceEntries("portfolio");
  const target = await transitionTargetEntries(source);
  const repository = createRepository(source);
  const before = snapshotFiles(repository.files);
  const initialState = new Uint8Array(repository.files.get(".egeria/state.json"));
  const initialMigrationSource = decode(
    repository.files.get(".egeria/migrations.jsonl"),
  );
  const originalWrite = repository.writer.write;
  repository.writer.write = async (changes) => {
    const result = await originalWrite(changes);
    return result.ok && changes[0]?.path === ".egeria/migrations.jsonl"
      ? { ok: false, sourceChanged: true }
      : result;
  };

  const execution = await runApply(repository);
  assertFailure(execution.result, {
    code: "PROFILE_TRANSITION_MIGRATION_WRITE_FAILED",
    phase: "persist-migration",
    recovery: "inspect-worktree",
  });
  assertSourceActionsMatchTarget(repository, execution.plan, target);
  assert.deepEqual(repository.files.get(".egeria/state.json"), initialState);
  assert.equal(
    decode(repository.files.get(".egeria/migrations.jsonl")),
    expectedMigrationSource(
      initialMigrationSource,
      desiredIdentifiers(execution.plan),
    ),
  );
  assertExactChangedPaths(
    repository.files,
    before,
    exactChangedPaths.filter((path) => path !== ".egeria/state.json"),
  );
  assert.equal(repository.writes.length, 2);
});

test("portfolio-to-site profile transition retains migration and old state when state persistence fails", async () => {
  const repository = createRepository(await sourceEntries("portfolio"), {
    failBatch: 3,
  });
  const initialState = new Uint8Array(repository.files.get(".egeria/state.json"));
  const execution = await runApply(repository);
  assertFailure(execution.result, {
    code: "PROFILE_TRANSITION_STATE_WRITE_FAILED",
    phase: "persist-state",
    recovery: "inspect-worktree",
  });
  assert.deepEqual(repository.files.get(".egeria/state.json"), initialState);
  const migrations = core.parseMigrationLog(
    decode(repository.files.get(".egeria/migrations.jsonl")),
  );
  assert.equal(migrations.ok, true);
  assert.deepEqual(
    migrations.value.at(-1).verificationChecks,
    core.profileTransitionPersistedVerificationChecks,
  );
  assert.equal(repository.writes.length, 2);
});

test("portfolio-to-site profile transition retains migration and old state on state construction failure", async () => {
  const source = await sourceEntries("portfolio");
  const target = await transitionTargetEntries(source);
  const repository = createRepository(source);
  const before = snapshotFiles(repository.files);
  const initialState = new Uint8Array(repository.files.get(".egeria/state.json"));
  const initialMigrationSource = decode(
    repository.files.get(".egeria/migrations.jsonl"),
  );

  const execution = await runApply(repository, {
    constructState: () => undefined,
  });
  assertFailure(execution.result, {
    code: "PROFILE_TRANSITION_STATE_CONSTRUCTION_FAILED",
    phase: "persist-state",
    recovery: "inspect-worktree",
  });
  assertSourceActionsMatchTarget(repository, execution.plan, target);
  assert.equal(
    decode(repository.files.get(".egeria/migrations.jsonl")),
    expectedMigrationSource(
      initialMigrationSource,
      desiredIdentifiers(execution.plan),
    ),
  );
  assert.deepEqual(repository.files.get(".egeria/state.json"), initialState);
  assertExactChangedPaths(
    repository.files,
    before,
    exactChangedPaths.filter((path) => path !== ".egeria/state.json"),
  );
  assert.equal(repository.writes.length, 2);
});

test("portfolio-to-site profile transition retains an uncertain committed state replacement", async () => {
  const source = await sourceEntries("portfolio");
  const target = await transitionTargetEntries(source);
  const repository = createRepository(source);
  const before = snapshotFiles(repository.files);
  const initialState = new Uint8Array(repository.files.get(".egeria/state.json"));
  const initialMigrationSource = decode(
    repository.files.get(".egeria/migrations.jsonl"),
  );
  const originalWrite = repository.writer.write;
  repository.writer.write = async (changes) => {
    const result = await originalWrite(changes);
    return result.ok && changes[0]?.path === ".egeria/state.json"
      ? { ok: false, sourceChanged: true }
      : result;
  };

  const execution = await runApply(repository);
  assertFailure(execution.result, {
    code: "PROFILE_TRANSITION_STATE_WRITE_FAILED",
    phase: "persist-state",
    recovery: "inspect-worktree",
  });
  assertSourceActionsMatchTarget(repository, execution.plan, target);
  assert.equal(
    decode(repository.files.get(".egeria/migrations.jsonl")),
    expectedMigrationSource(
      initialMigrationSource,
      desiredIdentifiers(execution.plan),
    ),
  );
  const state = core.parseStateJson(
    decode(repository.files.get(".egeria/state.json")),
  );
  assert.equal(state.ok, true);
  assert.equal(
    decode(repository.files.get(".egeria/state.json")),
    core.serializeStateJson(state.value),
  );
  assert.deepEqual(
    repository.files.get(".egeria/state.json"),
    repository.writes[2][0].content,
  );
  assert.equal(
    state.value.installedCapabilities.some(
      ({ identifier }) => identifier === "site-routing",
    ),
    true,
  );
  assert.notDeepEqual(repository.files.get(".egeria/state.json"), initialState);
  assertExactChangedPaths(repository.files, before, exactChangedPaths);
  assert.equal(repository.writes.length, 3);
});

test("portfolio-to-site profile transition retains the complete persisted prefix when state reread fails", async () => {
  const source = await sourceEntries("portfolio");
  const repository = createRepository(source);
  const originalReadText = repository.reader.readText;
  repository.reader.readText = (path) => {
    if (repository.writes.length === 3 && path === ".egeria/state.json") {
      throw new Error("private state reread failure");
    }
    return originalReadText(path);
  };

  const execution = await runApply(repository);
  assertFailure(execution.result, {
    code: "PROFILE_TRANSITION_POST_STATE_FAILED",
    phase: "post-state",
    recovery: "inspect-worktree",
  });
  assert.equal(repository.writes.length, 3);
  const state = core.parseStateJson(
    decode(repository.files.get(".egeria/state.json")),
  );
  assert.equal(state.ok, true);
  assert.equal(state.value.appliedMigrations.includes(migrationIdentifier), true);
  assert.doesNotMatch(JSON.stringify(execution.result), /private state reread failure/u);
});

test("portfolio-to-site profile transition retains the full persisted prefix on post-state disagreement", async () => {
  const repository = createRepository(await sourceEntries("portfolio"), {
    afterWrite({ batch, files }) {
      if (batch === 3) {
        const migration = decode(files.get(".egeria/migrations.jsonl"));
        files.set(
          ".egeria/migrations.jsonl",
          encoder.encode(migration.replace(completedAt, "2026-08-23T15:00:00.001Z")),
        );
      }
    },
  });
  const execution = await runApply(repository);
  assertFailure(execution.result, {
    code: "PROFILE_TRANSITION_POST_STATE_FAILED",
    phase: "post-state",
    recovery: "inspect-worktree",
  });
  assert.equal(repository.writes.length, 3);
  const state = core.parseStateJson(decode(repository.files.get(".egeria/state.json")));
  assert.equal(state.ok, true);
  assert.equal(state.value.appliedMigrations.includes(migrationIdentifier), true);
});

test("portfolio-to-site profile transition retains the full prefix on post-state state and inference disagreement", async () => {
  let disagreeingStateSource;
  const source = await sourceEntries("portfolio");
  const target = await transitionTargetEntries(source);
  const repository = createRepository(source, {
    afterWrite({ batch, files }) {
      if (batch === 3) {
        const writtenState = core.parseStateJson(
          decode(files.get(".egeria/state.json")),
        );
        assert.equal(writtenState.ok, true);
        disagreeingStateSource = core.serializeStateJson({
          ...writtenState.value,
          origin: { profile: "portfolio", recipeVersion: "0.10.0" },
        });
        files.set(".egeria/state.json", encoder.encode(disagreeingStateSource));
      }
    },
  });
  const before = snapshotFiles(repository.files);
  const initialMigrationSource = decode(
    repository.files.get(".egeria/migrations.jsonl"),
  );

  const execution = await runApply(repository);
  assertFailure(execution.result, {
    code: "PROFILE_TRANSITION_POST_STATE_FAILED",
    phase: "post-state",
    recovery: "inspect-worktree",
  });
  assertSourceActionsMatchTarget(repository, execution.plan, target);
  assert.equal(
    decode(repository.files.get(".egeria/migrations.jsonl")),
    expectedMigrationSource(
      initialMigrationSource,
      desiredIdentifiers(execution.plan),
    ),
  );
  const state = core.parseStateJson(
    decode(repository.files.get(".egeria/state.json")),
  );
  assert.equal(state.ok, true);
  assert.notEqual(disagreeingStateSource, undefined);
  assert.equal(
    decode(repository.files.get(".egeria/state.json")),
    disagreeingStateSource,
  );
  assert.deepEqual(state.value.origin, {
    profile: "portfolio",
    recipeVersion: "0.10.0",
  });
  assertExactChangedPaths(repository.files, before, exactChangedPaths);
  assert.equal(repository.writes.length, 3);
});

test("portfolio-to-site profile transition reports final Git and exact-byte failures after persistence", async () => {
  const gitFailure = createRepository(await sourceEntries("portfolio"));
  const gitExecution = await runApply(gitFailure, {
    inspectExpectedChanges: () =>
      Promise.resolve({ ok: false, code: "GIT_WORKTREE_CHANGED" }),
  });
  assertFailure(gitExecution.result, {
    code: "GIT_WORKTREE_CHANGED",
    phase: "final-diff",
    recovery: "inspect-worktree",
  });
  assert.equal(gitFailure.writes.length, 3);

  const byteFailure = createRepository(await sourceEntries("portfolio"));
  const byteExecution = await runApply(byteFailure, {
    inspectExpectedChanges: () => {
      byteFailure.files.set(
        "apps/web/content/en-CA/site.yaml",
        encoder.encode("concurrent final edit\n"),
      );
      return Promise.resolve({ ok: true });
    },
  });
  assertFailure(byteExecution.result, {
    code: "PROFILE_TRANSITION_FINAL_DIFF_FAILED",
    phase: "final-diff",
    recovery: "inspect-worktree",
  });
  assert.equal(byteFailure.writes.length, 3);
});

test("filesystem-backed portfolio-to-site transition verifies binary baselines without an injected byte reader", async () => {
  await withFileSystemRepository(
    await sourceEntries("portfolio"),
    async (directory) => {
      const beforeFiles = await loadEntries(directory);
      const before = snapshotFiles(beforeFiles);
      const initialMigrationSource = decode(
        beforeFiles.get(".egeria/migrations.jsonl"),
      );
      const target = await transitionTargetEntries(beforeFiles);

      const execution = await runFileSystemApply(directory);
      assert.equal(execution.result.ok, true, JSON.stringify(execution.result));
      assert.deepEqual(execution.result.value.changedPaths, exactChangedPaths);
      assert.deepEqual(execution.verifierCalls, [directory]);

      const afterFiles = await loadEntries(directory);
      assertExactChangedPaths(afterFiles, before, exactChangedPaths);
      assert.deepEqual(
        afterFiles.get(".egeria/project.yaml"),
        target.get(".egeria/project.yaml"),
      );
      assert.equal(
        decode(afterFiles.get(".egeria/migrations.jsonl")),
        expectedMigrationSource(
          initialMigrationSource,
          desiredIdentifiers(execution.plan),
        ),
      );
      for (const path of baselinePaths) {
        assert.deepEqual(afterFiles.get(path), target.get(path), path);
      }
      const state = core.parseStateJson(decode(afterFiles.get(".egeria/state.json")));
      assert.equal(state.ok, true);
      assert.equal(
        decode(afterFiles.get(".egeria/state.json")),
        core.serializeStateJson(state.value),
      );
      assert.equal(
        state.value.installedCapabilities.some(
          ({ identifier }) => identifier === "site-routing",
        ),
        true,
      );
    },
  );
});

test("filesystem-backed portfolio-to-site transition rejects changed final binary bytes without an injected byte reader", async () => {
  await withFileSystemRepository(
    await sourceEntries("portfolio"),
    async (directory) => {
      const beforeFiles = await loadEntries(directory);
      const before = snapshotFiles(beforeFiles);
      const initialMigrationSource = decode(
        beforeFiles.get(".egeria/migrations.jsonl"),
      );
      const target = await transitionTargetEntries(beforeFiles);
      const corruptedPath = baselinePaths[0];

      const execution = await runFileSystemApply(directory, {
        inspectExpectedChanges: async () => {
          await writeFile(
            join(directory, corruptedPath),
            new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00]),
          );
          return { ok: true };
        },
      });
      assertFailure(execution.result, {
        code: "PROFILE_TRANSITION_FINAL_DIFF_FAILED",
        phase: "final-diff",
        recovery: "inspect-worktree",
      });

      const afterFiles = await loadEntries(directory);
      assertExactChangedPaths(afterFiles, before, exactChangedPaths);
      assert.deepEqual(
        afterFiles.get(".egeria/project.yaml"),
        target.get(".egeria/project.yaml"),
      );
      assert.equal(
        decode(afterFiles.get(".egeria/migrations.jsonl")),
        expectedMigrationSource(
          initialMigrationSource,
          desiredIdentifiers(execution.plan),
        ),
      );
      assert.deepEqual(
        afterFiles.get(corruptedPath),
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00]),
      );
      const state = core.parseStateJson(decode(afterFiles.get(".egeria/state.json")));
      assert.equal(state.ok, true);
      assert.equal(
        decode(afterFiles.get(".egeria/state.json")),
        core.serializeStateJson(state.value),
      );
      assert.equal(
        state.value.appliedMigrations.includes(migrationIdentifier),
        true,
      );
    },
  );
});

test("filesystem-backed portfolio-to-site transition rejects an ancestor swap during an exact-byte read", async (context) => {
  const outside = await mkdtemp(
    join(tmpdir(), "egeria-profile-transition-exact-read-outside-"),
  );
  context.after(() => rm(outside, { recursive: true, force: true }));
  await withFileSystemRepository(
    await sourceEntries("portfolio"),
    async (directory) => {
      const controlDirectory = join(directory, ".egeria");
      const movedControlDirectory = join(directory, ".egeria-original");
      let swapped = false;

      const execution = await runFileSystemApply(directory, {
        afterExactFileRead: async (path) => {
          if (!swapped && path === ".egeria/project.yaml") {
            swapped = true;
            await rename(controlDirectory, movedControlDirectory);
            await symlink(outside, controlDirectory);
          }
        },
      });
      assert.equal(swapped, true);
      assertFailure(execution.result, {
        code: "PROFILE_TRANSITION_REINFERENCE_FAILED",
        phase: "re-infer",
        recovery: "inspect-worktree",
      });
      await assert.rejects(
        lstat(join(outside, "project.yaml")),
        (error) => error?.code === "ENOENT",
      );
      const movedControlEntries = await readdir(movedControlDirectory);
      assert.equal(
        movedControlEntries.includes("migrations.jsonl"),
        true,
        JSON.stringify(movedControlEntries.sort()),
      );
      const migration = core.parseMigrationLog(
        decode(await readFile(join(movedControlDirectory, "migrations.jsonl"))),
      );
      assert.equal(migration.ok, true);
      assert.equal(
        migration.value.some(({ identifier }) => identifier === migrationIdentifier),
        false,
      );
    },
  );
});
