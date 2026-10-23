import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  lstat,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { createGenerationRenderingContext } from "../dist/catalog/verified-package-versions.js";
const currentTransitionCohorts = [
  { label: "Current", generation: "current", portfolio: "0.11.6", site: "0.12.6", app: "0.2.6" },
];
const currentTransitionContexts = { current: createGenerationRenderingContext() };

import { parseDocument } from "yaml";
import { createBuilderStateSurfaces } from "../dist/generation/builder-state-surfaces.js";
import {
  appTransitionVisualProject,
  appTransitionVisualBookingSettings,
  appTransitionVisualAnalyticsSettings,
} from "../dist/lifecycle/app-profile-transition.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "../..");
const core = await import(pathToFileURL(resolve(packageRoot, "dist/index.js")));
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const root = "/generated/project";
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
const baselinePaths = [
  "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
];

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

function successfulVerifier(calls, profile = "site") {
  return {
    prepareLockfile() {
      throw new Error("transition must not prepare a lockfile");
    },
    verifyInIsolatedCopy(receivedRoot) {
      calls.push(receivedRoot);
      return Promise.resolve({
        ok: true,
        value: { checks: profile === "app" ? core.appGenerationVerificationChecks : core.ordinaryGenerationVerificationChecks },
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
    verifier: overrides.verifier ?? successfulVerifier(verifierCalls, overrides.toProfile),
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

function assertFailure(result, expected) {
  assert.deepEqual(result, { ok: false, ...expected });
  assert.doesNotMatch(
    JSON.stringify(result),
    /private repository failure|private writer failure|refs\/heads|generated\/common/u,
  );
}

async function appTransitionSource(profile, subset = 0, generation = "current") {
  const rendered = await core.renderSkeleton({
    profile,
    ...appTransitionVisualProject,
    packageVersions: core.verifiedCapabilityPackageVersions,
    ...(subset & 1 ? { bookingCalendly: appTransitionVisualBookingSettings } : {}),
    ...(subset & 2 ? { multilingual: true } : {}),
    ...(subset & 4 ? { analytics: appTransitionVisualAnalyticsSettings } : {}),
  }, currentTransitionContexts[generation]);
  assert.equal(rendered.ok, true, JSON.stringify(rendered));
  const files = new Map(rendered.value.files.map(({ path, content }) => [path, bytes(content)]));
  files.set("pnpm-lock.yaml", bytes(await readFile(resolve(packageRoot,
    `lockfiles/web-recipe-${`${profile}-${currentTransitionCohorts.find(cohort => cohort.generation === generation)[profile]}`}/pnpm-lock.yaml`))));
  files.set(".egeria/project.yaml", bytes(core.serializeProjectYaml(rendered.value.project)));
  files.set(".egeria/migrations.jsonl", bytes(""));
  const surfaces = core.materializeInstalledSurfaces({
    files, surfaces: [...rendered.value.surfaces, ...createBuilderStateSurfaces()],
  });
  assert.equal(surfaces.ok, true, JSON.stringify(surfaces));
  const state = {
    schemaVersion: "1.0.0", builderVersion: "0.0.0", projectSchemaVersion: "1.0.0",
    origin: { profile, recipeVersion: rendered.value.project.recipeVersion },
    installedCapabilities: core.createInstalledManifest(rendered.value.resolved),
    appliedMigrations: [], managedSurfaces: surfaces.value, ejections: [],
    compatibility: { node: "22.23.2", pnpm: "11.20.0", platformAdapter: "cloudflare-workers" },
    lastSuccessfulVerification: { kind: "generation", checks: [
      "contracts", "pre-state-inference", ...core.ordinaryGenerationVerificationChecks,
      "post-state-inference",
    ] },
  };
  files.set(".egeria/state.json", bytes(core.serializeStateJson(state)));
  assert.equal(core.parseStateJson(decode(files.get(".egeria/state.json"))).ok, true);
  return files;
}

async function approvedAppPlan(reader, inspection = git) {
  const result = await core.planProfileTransition({
    reader, git: inspection, toProfile: "app",
    inspectCreateTargets: async () => ({ ok: true }),
    inspectWorktree: async () => inspection,
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.value;
}

async function runAppTransition(repository, overrides = {}) {
  const plan = await approvedAppPlan(repository.reader);
  await overrides.afterPlan?.(repository);
  return invokeApply(repository, {
    ...overrides, toProfile: "app", approvedPlanFingerprint: overrides.approvedPlanFingerprint ?? plan.planFingerprint,
  });
}

test("app transitions refuse stale action, preserved, control and visual inputs before any side effect", async () => {
  for (const [profile, path, replacement] of [
    ["site", "apps/web/app/api/health/route.ts", "collision"],
    ["site", "pnpm-workspace.yaml", "drift"],
    ["site", "pnpm-lock.yaml", "drift"],
    ["site", "apps/web/content/en-CA/long-form/introduction.md", "---\ntitle: Changed\nsummary: Still valid\n---\nChanged prose.\n"],
    ["site", "apps/web/package.json", undefined],
    ["site", "apps/web/content/en-CA/site.yaml", "metadata: ["],
    ["site", baselinePaths[0], "changed PNG"],
    ["site", ".egeria/project.yaml", undefined],
  ]) {
    const repository = createRepository(await appTransitionSource(profile));
    let expected;
    const execution = await runAppTransition(repository, { afterPlan() {
      if (replacement !== undefined) repository.files.set(path, bytes(replacement));
      else repository.files.set(path, bytes(`${decode(repository.files.get(path))}\n`));
      expected = snapshotFiles(repository.files);
    } });
    assert.equal(execution.result.ok, false, path);
    assert.equal(execution.result.recovery, "not-required", path);
    assert.equal(execution.result.phase, "precondition", path);
    assert.deepEqual(repository.writes, [], path);
    assert.deepEqual(execution.verifierCalls, [], path);
    assertUnchanged(repository, expected);
  }
});

test("app transitions recheck every action kind and preserved bytes after plan recomputation", async () => {
  for (const path of [
    "apps/web/app/api/health/route.ts", "pnpm-workspace.yaml", "pnpm-lock.yaml",
    "apps/web/package.json", "apps/web/content/en-CA/site.yaml",
    "apps/web/content/en-CA/long-form/introduction.md", ".egeria/state.json",
  ]) {
    const repository = createRepository(await appTransitionSource("site"));
    let inspections = 0;
    let expected;
    const execution = await runAppTransition(repository, {
      async inspectWorktree() {
        inspections += 1;
        if (inspections === 4) {
          repository.files.set(path, bytes("late source mutation"));
          expected = snapshotFiles(repository.files);
        }
        return git;
      },
    });
    assert.equal(inspections, 4);
    assert.equal(execution.result.ok, false, path);
    assert.equal(execution.result.phase, "precondition");
    assert.equal(execution.result.recovery, "not-required");
    assert.deepEqual(repository.writes, []);
    assert.deepEqual(execution.verifierCalls, []);
    assertUnchanged(repository, expected);
  }
});

test("app transitions refuse wrong approval, create eligibility and late Git changes without writes", async () => {
  for (const overrides of [
    { approvedPlanFingerprint: `sha256:${"0".repeat(64)}` },
    { inspectCreateTargets: async () => ({ ok: false, code: "CAPABILITY_ACTION_CONFLICT" }) },
    { inspectWorktree: (() => { let calls = 0; return async () => ++calls === 4
      ? { ok: true, identity: { ...git.identity, revision: "b".repeat(40) } } : git; })() },
  ]) {
    const repository = createRepository(await appTransitionSource("site"));
    const before = snapshotFiles(repository.files);
    const execution = await runAppTransition(repository, overrides);
    assert.equal(execution.result.ok, false);
    assert.equal(execution.result.recovery, "not-required");
    assert.deepEqual(repository.writes, []);
    assert.deepEqual(execution.verifierCalls, []);
    assertUnchanged(repository, before);
  }
});

test("app transition failures retain the exact source and control prefix at every persistence boundary", async () => {
  const cases = [
    { name: "verifier exception", prefix: 1, phase: "verify", overrides: { verifier: { async verifyInIsolatedCopy() { throw new Error("private verifier detail"); } } } },
    { name: "clock exception", prefix: 1, phase: "persist-migration", overrides: { now: () => { throw new Error("private clock detail"); } } },
    { name: "project writer exception", prefix: 1, phase: "persist-project", writer: { throwBatch: 2 } },
    { name: "migration writer exception", prefix: 2, phase: "persist-migration", writer: { throwBatch: 3 } },
    { name: "state writer exception", prefix: 3, phase: "persist-state", writer: { throwBatch: 4 } },
    { name: "verification rejection", prefix: 1, phase: "verify", overrides: { verifier: { async verifyInIsolatedCopy() { return { ok: false, issues: [] }; } } } },
    { name: "missing Worker receipt", prefix: 1, phase: "verify", overrides: { verifier: successfulVerifier([]) } },
    { name: "invalid migration", prefix: 1, phase: "persist-migration", overrides: { now: () => "invalid" } },
    { name: "project write", prefix: 1, phase: "persist-project", writer: { failBatch: 2 } },
    { name: "migration write", prefix: 2, phase: "persist-migration", writer: { failBatch: 3 } },
    { name: "state write", prefix: 3, phase: "persist-state", writer: { failBatch: 4 } },
    { name: "state construction", prefix: 3, phase: "persist-state", overrides: { constructState: () => undefined } },
    { name: "project reread", prefix: 2, phase: "persist-project", readFailure: [2, ".egeria/project.yaml", "bytes"] },
    { name: "migration reread", prefix: 3, phase: "persist-migration", readFailure: [3, ".egeria/migrations.jsonl", "text"] },
    { name: "state reread", prefix: 4, phase: "post-state", readFailure: [4, ".egeria/state.json", "text"] },
    { name: "pending inference", prefix: 1, phase: "re-infer", readFailure: [1, "apps/web/app/api/health/route.ts", "text"] },
    { name: "final Git diff", prefix: 4, phase: "final-diff", overrides: { inspectExpectedChanges: async () => ({ ok: false, code: "GIT_WORKTREE_CHANGED" }) } },
  ];
  for (const entry of cases) {
    const source = await appTransitionSource("site", 7);
    const repository = createRepository(source, entry.writer);
    if (entry.readFailure) {
      const [batch, path, mode] = entry.readFailure;
      const method = mode === "bytes" ? "readBytes" : "readText";
      const read = repository.reader[method];
      repository.reader[method] = async value => repository.writes.length === batch && value === path
        ? { kind: "error", code: "FILE_READ_FAILED" } : read(value);
    }
    const execution = await runAppTransition(repository, entry.overrides);
    assert.equal(execution.result.ok, false, entry.name);
    assert.equal(execution.result.phase, entry.phase, entry.name);
    assert.equal(execution.result.recovery, "inspect-worktree", entry.name);
    assert.equal(repository.writes.length, entry.prefix, entry.name);
    const retained = new Map(source);
    for (const change of repository.writes.flat()) retained.set(change.path, change.content);
    assert.deepEqual(snapshotFiles(repository.files), snapshotFiles(retained), entry.name);
    assert.equal(repository.writes[0].some(({ path }) => path.startsWith(".egeria/")), false);
  }
});

test("app transition exact rereads reject changed preserved files both before persistence and at final diff", async () => {
  for (const phase of ["re-infer", "final-diff"]) {
    const path = "apps/web/content/en-CA/long-form/introduction.md";
    const source = await appTransitionSource("site");
    const corrupted = bytes("retained concurrent change");
    const repository = createRepository(source, {
      afterWrite({ batch, files }) { if (phase === "re-infer" && batch === 1) files.set(path, corrupted); },
    });
    const execution = await runAppTransition(repository, phase === "final-diff" ? {
      async inspectExpectedChanges() { repository.files.set(path, corrupted); return { ok: true }; },
    } : {});
    assert.equal(execution.result.ok, false);
    assert.equal(execution.result.phase, phase);
    assert.equal(execution.result.recovery, "inspect-worktree");
    assert.deepEqual(repository.files.get(path), corrupted);
    assert.equal(repository.writes.length, phase === "re-infer" ? 1 : 4);
    if (phase === "re-infer") assertControlBytes(repository, source);
  }
});

test("site app execution preserves customized UI, locale values and unrelated package members", async () => {
  const source = await appTransitionSource("site", 7);
  const manifestPath = "apps/web/package.json";
  const manifest = JSON.parse(decode(source.get(manifestPath)));
  manifest.description = "Retained package metadata";
  manifest.scripts.custom = "node --version";
  source.set(manifestPath, bytes(JSON.stringify(manifest)));
  const uiPath = "apps/web/src/presentation/content-page.tsx";
  source.set(uiPath, bytes(`${decode(source.get(uiPath))}\n// Application customization.\n`));
  const localePath = "apps/web/content/fr-CA/localized-content.yaml";
  source.set(localePath, bytes(`${decode(source.get(localePath))}\n# Application locale comment.\n`));
  const repository = createRepository(source);
  const execution = await runAppTransition(repository);
  assert.equal(execution.result.ok, true, JSON.stringify(execution.result));
  const merged = JSON.parse(decode(repository.files.get(manifestPath)));
  assert.equal(merged.description, manifest.description);
  assert.equal(merged.scripts.custom, manifest.scripts.custom);
  assert.deepEqual(repository.files.get(uiPath), source.get(uiPath));
  assert.deepEqual(repository.files.get(localePath), source.get(localePath));
});

test("app execution retains actual atomic-writer prefixes for every transformation action kind", async () => {
  for (const kind of ["create-file", "replace-file", "merge-json"]) {
    const source = await appTransitionSource("site");
    await withFileSystemRepository(source, async directory => {
      const identity = { ...git.identity, root: directory };
      const inspection = { ok: true, identity };
      const reader = core.createFileSystemRepositoryReader(directory);
      const plan = await approvedAppPlan(reader, inspection);
      const cut = plan.actions.findIndex((action, index) => index > 0 && action.kind === kind);
      assert.ok(cut > 0, kind);
      const stoppedPath = plan.actions[cut].path;
      const atomic = core.createFileSystemProfileTransitionWriter(directory, {
        async beforeCommit(path) { if (path === stoppedPath) throw new Error("synthetic commit interruption"); },
      });
      let supplied;
      let verifications = 0;
      const result = await core.applyProfileTransition({
        root: directory, toProfile: "app", approvedPlanFingerprint: plan.planFingerprint,
        writer: { async write(changes) { supplied = changes; return atomic.write(changes); } },
        verifier: { async verifyInIsolatedCopy() { verifications += 1; throw new Error("must not verify a prefix"); } },
        inspectWorktree: async () => inspection,
        inspectCreateTargets: async () => ({ ok: true }),
      });
      assertFailure(result, { code: "PROFILE_TRANSITION_TRANSFORM_FAILED", phase: "transform", recovery: "inspect-worktree" });
      assert.equal(verifications, 0);
      const expected = new Map(source);
      for (const change of supplied.slice(0, cut)) expected.set(change.path, change.content);
      const retained = await loadEntries(directory);
      const temporaryPaths = [...retained.keys()].filter(path => path.includes(".egeria-profile-transition-"));
      // A newly created parent retains the interrupted temporary file; an
      // existing parent permits the unchanged writer's identity-checked cleanup.
      const createdParent = dirname(stoppedPath) !== "." && ![...expected.keys()].some(path => path.startsWith(`${dirname(stoppedPath)}/`));
      assert.equal(temporaryPaths.length, createdParent ? 1 : 0, kind);
      if (createdParent) {
        assert.equal(dirname(temporaryPaths[0]), dirname(stoppedPath));
        assert.deepEqual(retained.get(temporaryPaths[0]), supplied[cut].content);
        expected.set(temporaryPaths[0], supplied[cut].content);
      }
      assert.deepEqual(snapshotFiles(retained), snapshotFiles(expected), kind);
    });
  }
});

test("app transitions execute in real linked worktrees through production Git and filesystem boundaries", async () => {
  const execute = promisify(execFile);
  for (const profile of ["site"]) {
    for (const subset of [0, 7]) {
      const owner = await realpath(await mkdtemp(join(tmpdir(), "egeria-app-transition-linked-")));
      try {
        const source = await appTransitionSource(profile, subset);
        const checkout = join(owner, "source");
        const worktree = join(owner, "transition");
        await mkdir(checkout);
        await writeEntries(checkout, source);
        const environment = {
          PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: "1",
          GIT_CONFIG_GLOBAL: join(owner, "absent-global-config"), GIT_TERMINAL_PROMPT: "0",
        };
        const gitCommand = arguments_ => execute("git", arguments_, { cwd: checkout, env: environment });
        await gitCommand(["init", "--initial-branch=main"]);
        await gitCommand(["add", "."]);
        await gitCommand(["-c", "user.name=Synthetic Verification", "-c", "user.email=verification@example.invalid",
          "-c", "commit.gpgsign=false", "commit", "-m", "Synthetic transition source"]);
        await gitCommand(["worktree", "add", "-b", "app-transition", worktree]);
        const inspection = await core.inspectGitWorktree({ root: worktree });
        assert.equal(inspection.ok, true, JSON.stringify(inspection));
        const planned = await core.planProfileTransition({
          reader: core.createFileSystemRepositoryReader(worktree), git: inspection, toProfile: "app",
        });
        assert.equal(planned.ok, true, JSON.stringify(planned));
        const calls = [];
        const result = await core.applyProfileTransition({
          root: worktree, toProfile: "app", approvedPlanFingerprint: planned.value.planFingerprint,
          verifier: successfulVerifier(calls, "app"), now: () => completedAt,
        });
        assert.equal(result.ok, true, `${profile}/${subset}: ${JSON.stringify(result)}`);
        assert.deepEqual(calls, [worktree]);
        assert.equal(result.value.baseRevision, inspection.identity.revision);
        const state = core.parseStateJson(await readFile(join(worktree, ".egeria/state.json"), "utf8"));
        assert.equal(state.ok, true);
        assert.deepEqual(state.value.appliedMigrations, [result.value.migration]);
        assert.equal((await execute("git", ["rev-parse", "HEAD"], { cwd: worktree, env: environment })).stdout.trim(), inspection.identity.revision);
        assert.equal((await gitCommand(["status", "--porcelain"])).stdout, "");
      } finally {
        await rm(owner, { recursive: true, force: true });
      }
    }
  }
});

test("installed incoming app transitions ignore changed generation defaults", async () => {
  for (const profile of ["site"]) {
    const source = await appTransitionSource(profile);
    const repository = createRepository(source);
    const recipes = core.profileRecipes.splice(0);
    try {
      const execution = await runAppTransition(repository, {
        verifier: {
          prepareLockfile() { throw new Error("must not resolve a new graph"); },
          async verifyInIsolatedCopy() { return { ok: true, value: { checks: core.appGenerationVerificationChecks } }; },
        },
      });
      assert.equal(execution.result.ok, true, JSON.stringify(execution.result));
      const manifest = JSON.parse(decode(repository.files.get("apps/web/package.json")));
      assert.equal(manifest.devDependencies.vitest, "5.0.3");
      const state = core.parseStateJson(decode(repository.files.get(".egeria/state.json")));
      assert.equal(state.ok, true);
      assert.deepEqual(state.value.origin, { profile: "app", recipeVersion: "0.2.6" });
      assert.deepEqual(repository.files.get("pnpm-lock.yaml"), bytes(await readFile(resolve(packageRoot, "lockfiles/web-recipe-app-0.2.6/pnpm-lock.yaml"))));
    } finally {
      core.profileRecipes.push(...recipes);
    }
  }
});

for (const profile of ["portfolio", "site"]) {
  for (let subset = 0; subset < 8; subset += 1) {
    test(`app transition executes ${profile} optional subset ${subset} with state-last persistence`, async () => {
      const source = await appTransitionSource(profile, subset);
      const repository = createRepository(source);
      const plan = await approvedAppPlan(repository.reader);
      const execution = await invokeApply(repository, {
        toProfile: "app", approvedPlanFingerprint: plan.planFingerprint,
        verifier: {
          prepareLockfile() { throw new Error("must not resolve a new graph"); },
          async verifyInIsolatedCopy(receivedRoot) {
            assert.equal(receivedRoot, root);
            assertControlBytes(repository, source);
            assert.equal(repository.writes.length, 1);
            return { ok: true, value: { checks: core.appGenerationVerificationChecks } };
          },
        },
      });
      assert.equal(execution.result.ok, true, JSON.stringify(execution.result));
      assert.equal(execution.result.value.status, "verified-final-diff-approval-required");
      assert.equal(execution.result.value.migration,
        profile === "portfolio" ? "transition-portfolio-0-11-6-to-app-0-2-6" : "transition-site-0-12-6-to-app-0-2-6");
      assert.deepEqual(execution.result.value.verificationChecks, core.appProfileTransitionVerificationChecks);
      assert.deepEqual(repository.writes.map(batch => batch.map(({ path }) => path)), [
        plan.actions.map(({ path }) => path),
        [".egeria/project.yaml"], [".egeria/migrations.jsonl"], [".egeria/state.json"],
      ]);
      assertExactChangedPaths(repository.files, snapshotFiles(source), execution.result.value.changedPaths);
      for (const { path, kind } of plan.dispositions) {
        assert.notEqual(kind, "delete-file");
        if (kind === "preserve-file") assert.deepEqual(repository.files.get(path), source.get(path), path);
      }
      const project = core.parseProjectYaml(decode(repository.files.get(".egeria/project.yaml")));
      const previousProject = core.parseProjectYaml(decode(source.get(".egeria/project.yaml")));
      assert.equal(project.ok, true);
      assert.equal(project.value.originProfile, "app");
      assert.equal(project.value.recipeVersion, "0.2.6");
      assert.deepEqual(project.value.capabilitySettings, previousProject.value.capabilitySettings);
      const manifest = JSON.parse(decode(repository.files.get("apps/web/package.json")));
      assert.equal(manifest.dependencies.effect, "4.0.0-rc.112");
      assert.equal(manifest.dependencies.next, "16.4.1");
      assert.equal(manifest.scripts["test:integration:cloudflare"], "vitest run --config vitest.cloudflare.config.ts");
      assert.deepEqual(repository.files.get("pnpm-lock.yaml"), bytes(await readFile(resolve(packageRoot, "lockfiles/web-recipe-app-0.2.6/pnpm-lock.yaml"))));
      if (profile === "portfolio") {
        for (const locale of subset & 2 ? ["en-CA", "fr-CA"] : ["en-CA"]) {
          const path = `apps/web/content/${locale}/${subset & 2 ? "localized-content" : "site"}.yaml`;
          const before = parseDocument(decode(source.get(path))).toJS();
          const after = parseDocument(decode(repository.files.get(path))).toJS();
          assert.deepEqual(after.metadata, before.metadata);
          assert.deepEqual(after.accessibility, before.accessibility);
          assert.deepEqual(subset & 2 ? after.pages.home : after.home, subset & 2 ? before.pages.home : before.home);
        }
      }
      const state = core.parseStateJson(decode(repository.files.get(".egeria/state.json")));
      const migrations = core.parseMigrationLog(decode(repository.files.get(".egeria/migrations.jsonl")));
      assert.equal(state.ok, true, JSON.stringify(state));
      assert.equal(migrations.ok, true);
      assert.equal(migrations.value.length, 1);
      assert.deepEqual(state.value.origin, { profile: "app", recipeVersion: "0.2.6" });
      assert.deepEqual(state.value.appliedMigrations, [execution.result.value.migration]);
      assert.deepEqual(state.value.ejections, []);
      assert.deepEqual(state.value.lastSuccessfulVerification.checks, core.appProfileTransitionPersistedVerificationChecks);
      const catalog = core.createCapabilityCatalogSnapshot(core.verifiedCapabilityPackageVersions, createGenerationRenderingContext().catalogSnapshot);
      assert.equal(catalog.ok, true);
      const inferred = await core.inferRepository({ reader: repository.reader, catalog: catalog.value });
      assert.ok(inferred.capabilities.every(({ category }) => category === "confirmed"));
      assert.ok(inferred.surfaces.every(({ status }) => status === "confirmed" || status === "application-owned"));
    });
  }
}

for (const cohort of currentTransitionCohorts) test(`${cohort.label} incoming app execution preserves all subsets with exact state-last receipts`, async () => {
  for (const profile of ["site"]) {
    for (let subset = 0; subset < 8; subset++) {
      const source = await appTransitionSource(profile, subset, cohort.generation);
      const repository = createRepository(source);
      const plan = await approvedAppPlan(repository.reader);
      const execution = await invokeApply(repository, {
        toProfile: "app", approvedPlanFingerprint: plan.planFingerprint,
        verifier: {
          prepareLockfile() { throw new Error("must not resolve a new graph"); },
          async verifyInIsolatedCopy() {
            assertControlBytes(repository, source);
            assert.equal(repository.writes.length, 1);
            return { ok: true, value: { checks: core.appGenerationVerificationChecks } };
          },
        },
      });
      assert.equal(execution.result.ok, true, JSON.stringify(execution.result));
      assert.equal(execution.result.value.status, "verified-final-diff-approval-required");
      assert.equal(execution.result.value.migration, `transition-${profile}-${cohort[profile].replaceAll(".", "-")}-to-app-${cohort.app.replaceAll(".", "-")}`);
      assert.deepEqual(repository.writes.map(batch => batch.map(({ path }) => path)), [plan.actions.map(({ path }) => path), [".egeria/project.yaml"], [".egeria/migrations.jsonl"], [".egeria/state.json"]]);
      const state = core.parseStateJson(decode(repository.files.get(".egeria/state.json")));
      assert.equal(state.ok, true);
      assert.deepEqual(state.value.origin, { profile: "app", recipeVersion: cohort.app });
      assert.equal(state.value.installedCapabilities.find(({ identifier }) => identifier === "standards").version, "0.5.1");
      assert.deepEqual(state.value.lastSuccessfulVerification.checks, core.appProfileTransitionPersistedVerificationChecks);
      assert.equal(JSON.parse(decode(repository.files.get("apps/web/package.json"))).devDependencies.vitest, "5.0.3");
      assert.equal(JSON.parse(decode(repository.files.get("apps/web/package.json"))).dependencies.next, "16.4.1");
      assert.deepEqual(repository.files.get("pnpm-lock.yaml"), bytes(await readFile(resolve(packageRoot, `lockfiles/web-recipe-app-${cohort.app}/pnpm-lock.yaml`))));
      for (const { path, kind } of plan.dispositions) if (kind === "preserve-file") assert.deepEqual(repository.files.get(path), source.get(path), path);
      assertExactChangedPaths(repository.files, snapshotFiles(source), execution.result.value.changedPaths);
    }
  }
});


test("successor portfolio execution refuses unadmitted visual inputs before writes or verification", async () => {
  const source = await loadEntries(resolve(repositoryRoot, "fixtures/generated/portfolio-0.11.6"));
  const repository = createRepository(source);
  const result = await core.applyProfileTransition({
    root: git.identity.root,
    toProfile: "app",
    approvedPlanFingerprint: `sha256:${"0".repeat(64)}`,
    reader: repository.reader,
    writer: repository.writer,
    inspectWorktree: async () => git,
    inspectCreateTargets: async () => ({ ok: true }),
    inspectExpectedChanges: async () => ({ ok: true }),
    verifier: { async verifyInIsolatedCopy() { throw new Error("unadmitted transition must not verify"); } },
  });
  assertFailure(result, { code: "PROFILE_TRANSITION_VISUAL_EVIDENCE_REQUIRED", phase: "precondition", recovery: "not-required" });
  assert.deepEqual(repository.writes, []);
  assert.deepEqual(repository.files, source);
});

test("unapproved current portfolio and mixed controls refuse before any write", async () => {
  const cases = [
    { generation: "current", profile: "portfolio", code: "PROFILE_TRANSITION_PLAN_APPROVAL_INVALID" },
    { generation: "current", profile: "portfolio", stateRecipe: "0.11.3", code: "PROJECT_STATE_INCOMPATIBLE" },
    { generation: "current", profile: "site", stateRecipe: "0.12.3", code: "PROJECT_STATE_INCOMPATIBLE" },
    { generation: "current", profile: "portfolio", stateRecipe: "9.9.9", code: "PROJECT_STATE_INCOMPATIBLE" },
    { generation: "current", profile: "site", stateRecipe: "9.9.9", code: "PROJECT_STATE_INCOMPATIBLE" },
  ];
  for (const entry of cases) {
    const source = await appTransitionSource(entry.profile, 0, entry.generation);
    if (entry.stateRecipe) {
      const state = JSON.parse(decode(source.get(".egeria/state.json")));
      state.origin.recipeVersion = entry.stateRecipe;
      source.set(".egeria/state.json", bytes(JSON.stringify(state)));
    }
    const repository = createRepository(source);
    const result = await core.applyProfileTransition({
      root: git.identity.root, toProfile: "app", approvedPlanFingerprint: "sha256:" + "0".repeat(64),
      reader: repository.reader, writer: repository.writer,
      inspectWorktree: async () => git, inspectCreateTargets: async () => ({ ok: true }),
      inspectExpectedChanges: async () => ({ ok: true }),
      verifier: { async verifyInIsolatedCopy() { throw new Error("refused transition must not verify"); } },
    });
    assertFailure(result, { code: entry.code, phase: "precondition", recovery: "not-required" });
    assert.deepEqual(repository.writes, []);
    assert.deepEqual(repository.files, source);
  }
});

test("retired portfolio controls invalidate approved transitions before effects", async () => {
  for (const name of ["portfolio-0.11.3", "portfolio-calendly-0.11.3", "portfolio-email-0.11.3"]) {
    const source = await appTransitionSource("site");
    const repository = createRepository(source);
    const plan = await approvedAppPlan(repository.reader);
    const control = JSON.parse(await readFile(resolve(packageRoot, `tests/fixtures/retired-recipes/${name}.json`), "utf8"));
    repository.files.set(".egeria/project.yaml", bytes(control.projectYaml));
    repository.files.set(".egeria/state.json", bytes(JSON.stringify(control.variants.committed.state)));
    const before = snapshotFiles(repository.files);
    const execution = await invokeApply(repository, {
      toProfile: "app", approvedPlanFingerprint: plan.planFingerprint,
      verifier: {
        prepareLockfile() { throw new Error("retired transition must not resolve dependencies"); },
        async verifyInIsolatedCopy() { throw new Error("retired transition must not verify"); },
      },
    });
    assertFailure(execution.result, { code: "PROJECT_STATE_INCOMPATIBLE", phase: "precondition", recovery: "not-required" });
    assert.deepEqual(repository.writes, []);
    assertExactChangedPaths(repository.files, before, []);
  }
});

test("portfolio optional subsets refuse unproved first-viewport changes before effects", async () => {
  for (let subset = 0; subset < 8; subset += 1) {
    const source = await appTransitionSource("portfolio", subset);
    const path = `apps/web/content/en-CA/${subset & 2 ? "localized-content" : "site"}.yaml`;
    const document = parseDocument(decode(source.get(path)));
    document.setIn([...(subset & 2 ? ["pages", "home"] : ["home"]), "sections", 0, "content", "heading"], "Changed first viewport");
    source.set(path, bytes(document.toString()));
    const repository = createRepository(source);
    const before = snapshotFiles(repository.files);
    const execution = await invokeApply(repository, { toProfile: "app" });
    assertFailure(execution.result, { code: "PROFILE_TRANSITION_VISUAL_EVIDENCE_REQUIRED", phase: "precondition", recovery: "not-required" });
    assert.deepEqual(repository.writes, []);
    assert.deepEqual(execution.verifierCalls, []);
    assertUnchanged(repository, before);
  }
});

test("app transition retains the full persisted prefix on post-state disagreement", async () => {
  for (const subject of ["migration", "state"]) {
    const source = await appTransitionSource("site");
    let changedPath;
    let changedBytes;
    const repository = createRepository(source, {
      afterWrite({ batch, files }) {
        if (batch !== 4) return;
        changedPath = subject === "migration" ? ".egeria/migrations.jsonl" : ".egeria/state.json";
        changedBytes = subject === "migration"
          ? bytes(decode(files.get(changedPath)).replace(completedAt, "2026-08-23T15:00:00.001Z"))
          : bytes(core.serializeStateJson({
              ...JSON.parse(decode(files.get(changedPath))),
              ejections: ["apps/web/content/en-CA/site.yaml"],
            }));
        files.set(changedPath, changedBytes);
      },
    });
    const execution = await runAppTransition(repository);
    assertFailure(execution.result, {
      code: "PROFILE_TRANSITION_POST_STATE_FAILED",
      phase: "post-state",
      recovery: "inspect-worktree",
    });
    assert.equal(repository.writes.length, 4);
    const expected = new Map(source);
    for (const change of repository.writes.flat()) expected.set(change.path, change.content);
    expected.set(changedPath, changedBytes);
    assert.deepEqual(snapshotFiles(repository.files), snapshotFiles(expected));
    const migration = core.parseMigrationLog(decode(repository.files.get(".egeria/migrations.jsonl")));
    assert.equal(migration.ok, true);
    assert.ok(migration.value.some(({ identifier }) => identifier === "transition-site-0-12-6-to-app-0-2-6"));
  }
});

test("filesystem-backed app transition rejects an ancestor swap during an exact-byte read", async (context) => {
  const outside = await mkdtemp(join(tmpdir(), "egeria-app-transition-exact-read-outside-"));
  context.after(() => rm(outside, { recursive: true, force: true }));
  await withFileSystemRepository(await appTransitionSource("site"), async directory => {
    const inspection = { ok: true, identity: { ...git.identity, root: directory } };
    const plan = await approvedAppPlan(core.createFileSystemRepositoryReader(directory), inspection);
    const controlDirectory = join(directory, ".egeria");
    const movedControlDirectory = join(directory, ".egeria-original");
    let swapped = false;
    const result = await core.applyProfileTransition({
      root: directory, toProfile: "app", approvedPlanFingerprint: plan.planFingerprint,
      verifier: successfulVerifier([], "app"),
      inspectWorktree: async () => inspection,
      inspectCreateTargets: async () => ({ ok: true }),
      inspectExpectedChanges: async () => ({ ok: true }),
      afterExactFileRead: async path => {
        if (!swapped && path === ".egeria/project.yaml") {
          swapped = true;
          await rename(controlDirectory, movedControlDirectory);
          await symlink(outside, controlDirectory);
        }
      },
    });
    assert.equal(swapped, true);
    assertFailure(result, {
      code: "PROFILE_TRANSITION_REINFERENCE_FAILED",
      phase: "re-infer",
      recovery: "inspect-worktree",
    });
    assert.deepEqual(await readdir(outside), []);
    const migration = core.parseMigrationLog(await readFile(join(movedControlDirectory, "migrations.jsonl"), "utf8"));
    assert.equal(migration.ok, true);
    assert.equal(migration.value.some(({ identifier }) => identifier === "transition-site-0-12-6-to-app-0-2-6"), false);
  });
});
