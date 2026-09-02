import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "../..");
const core = await import(pathToFileURL(resolve(packageRoot, "dist/index.js")));
const { createBuilderStateSurfaces } = await import(
  pathToFileURL(
    resolve(packageRoot, "dist/generation/builder-state-surfaces.js"),
  )
);
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const root = "/generated/project";
const migrationIdentifier = "upgrade-standards-0-3-0-to-0-4-0";
const completedAt = "2026-08-23T15:00:00.000Z";
const git = Object.freeze({
  ok: true,
  identity: Object.freeze({
    root,
    revision: "abcdef0123456789abcdef0123456789abcdef01",
    attachedRef: "refs/heads/standards-upgrade",
    gitDirectory: "/generated/common/.git/worktrees/standards-upgrade",
    commonDirectory: "/generated/common/.git",
  }),
});
const visualPaths = [
  "apps/web/playwright.visual.config.ts",
  "apps/web/tests/visual/home-visual.spec.ts",
  "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
];
const exactChangedPaths = [
  ".egeria/migrations.jsonl",
  ".egeria/state.json",
  ".github/workflows/quality.yml",
  "apps/web/package.json",
  "apps/web/playwright.visual.config.ts",
  "apps/web/tests/visual/home-visual.spec.ts",
  "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
];
const currentStandardsSurfaceIdentifiers = new Set([
  "standards-playwright-visual-configuration",
  "standards-visual-regression-desktop-baseline",
  "standards-visual-regression-mobile-baseline",
  "standards-visual-regression-specification",
  "standards-visual-regression-test-script",
]);

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

async function acceptedSiteEntries() {
  const current = await currentEntries("site");
  const currentState = core.parseStateJson(
    decode(current.get(".egeria/state.json")),
  );
  assert.equal(currentState.ok, true);
  const rendered = await core.renderSkeleton(
    {
      profile: "site",
      projectName: "acme-site",
      displayName: "Acme Site",
      packageVersions: core.verifiedCapabilityPackageVersions,
    },
    {
      catalogSnapshot: { standards: "0.4.0", siteRouting: "0.3.0" },
      profiles: core.createProfileRecipeSnapshot("0.10.0"),
    },
  );
  assert.equal(rendered.ok, true, JSON.stringify(rendered.issues));
  const projectSource = core.serializeProjectYaml(rendered.value.project);
  const lockfile = new Uint8Array(
    await readFile(
      resolve(
        packageRoot,
        "lockfiles/web-recipe-0.8.0/pnpm-lock.yaml",
      ),
    ),
  );
  const workspace = new Uint8Array(
    await readFile(
      resolve(
        packageRoot,
        "lockfiles/web-recipe-0.8.0/pnpm-workspace.yaml",
      ),
    ),
  );
  const files = new Map(
    rendered.value.files.map(({ path, content }) => [path, content]),
  );
  files.set(".egeria/project.yaml", encoder.encode(projectSource));
  files.set(".egeria/migrations.jsonl", new Uint8Array());
  files.set("pnpm-lock.yaml", lockfile);
  files.set("pnpm-workspace.yaml", workspace);
  const materialized = core.materializeInstalledSurfaces({
    files,
    surfaces: [...rendered.value.surfaces, ...createBuilderStateSurfaces()].sort(
      (left, right) => compareText(left.identifier, right.identifier),
    ),
  });
  assert.equal(materialized.ok, true, JSON.stringify(materialized.issues));
  files.set(
    ".egeria/state.json",
    encoder.encode(
      core.serializeStateJson({
        ...currentState.value,
        origin: { profile: "site", recipeVersion: "0.10.0" },
        installedCapabilities: core.createInstalledManifest(
          rendered.value.resolved,
        ),
        managedSurfaces: materialized.value,
      }),
    ),
  );
  return files;
}

function historicalQualitySource(current) {
  const visualStep = [
    "      - name: Compare OpenNext visual baselines",
    "        run: pnpm --dir apps/web run test:visual",
    "",
  ].join("\n");
  assert.equal(current.includes(visualStep), true);
  return current.replace(visualStep, "");
}

async function historicalEntries(profile) {
  const entries =
    profile === "site" ? await acceptedSiteEntries() : await currentEntries(profile);

  for (const path of visualPaths) {
    entries.delete(path);
  }

  entries.set(
    ".github/workflows/quality.yml",
    encoder.encode(
      historicalQualitySource(decode(entries.get(".github/workflows/quality.yml"))),
    ),
  );
  const manifest = JSON.parse(decode(entries.get("apps/web/package.json")));
  delete manifest.scripts["test:visual"];
  entries.set("apps/web/package.json", encoder.encode(`${JSON.stringify(manifest)}\n`));

  const projectResult = core.parseProjectYaml(
    decode(entries.get(".egeria/project.yaml")),
  );
  const stateResult = core.parseStateJson(decode(entries.get(".egeria/state.json")));
  assert.equal(projectResult.ok, true);
  assert.equal(stateResult.ok, true);
  const projectSource = core.serializeProjectYaml({
    ...projectResult.value,
    recipeVersion: "0.9.0",
  });
  const managedSurfaces = stateResult.value.managedSurfaces
    .filter(({ identifier }) => !currentStandardsSurfaceIdentifiers.has(identifier))
    .map((surface) => {
      if (surface.identifier === "builder-project-configuration") {
        return {
          ...surface,
          fingerprint: core.fingerprintFileContent(encoder.encode(projectSource)),
        };
      }

      if (surface.identifier === "standards-quality-workflow") {
        return {
          ...surface,
          fingerprint: core.fingerprintFileContent(
            entries.get(".github/workflows/quality.yml"),
          ),
        };
      }

      return surface;
    });
  entries.set(".egeria/project.yaml", encoder.encode(projectSource));
  entries.set(
    ".egeria/state.json",
    encoder.encode(
      core.serializeStateJson({
        ...stateResult.value,
        origin: { ...stateResult.value.origin, recipeVersion: "0.9.0" },
        installedCapabilities: stateResult.value.installedCapabilities.map(
          (capability) =>
            capability.identifier === "standards"
              ? { ...capability, version: "0.3.0" }
              : capability,
        ),
        managedSurfaces,
      }),
    ),
  );
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

async function approvedPlan(
  reader,
  gitInspection = git,
  capability = "standards",
) {
  const result = await core.planCapabilityUpgrade({
    reader,
    git: gitInspection,
    capability,
    toVersion: "0.4.0",
  });
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  return result.value;
}

function successfulVerifier(calls) {
  return {
    prepareLockfile() {
      throw new Error("upgrade must not prepare a lockfile");
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
  const result = await core.applyCapabilityUpgrade({
    root: overrides.root ?? root,
    capability: overrides.capability ?? "standards",
    toVersion: overrides.toVersion ?? "0.4.0",
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
  const plan = await approvedPlan(
    repository.reader,
    overrides.gitInspection ?? git,
    overrides.capability ?? "standards",
  );
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
    verificationChecks: core.capabilityUpgradePersistedVerificationChecks,
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
    join(tmpdir(), "egeria-standards-upgrade-executor-"),
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
    gitDirectory: join(directory, ".git-worktrees", "standards-upgrade"),
    commonDirectory: join(directory, ".git-common"),
  });
  const inspection = Object.freeze({ ok: true, identity });
  const plan = await approvedPlan(
    core.createFileSystemRepositoryReader(directory),
    inspection,
  );
  const verifierCalls = [];
  const result = await core.applyCapabilityUpgrade({
    root: directory,
    capability: "standards",
    toVersion: "0.4.0",
    approvedPlanFingerprint: plan.planFingerprint,
    verifier: successfulVerifier(verifierCalls),
    inspectWorktree: () => Promise.resolve(inspection),
    inspectCreateTargets: () => Promise.resolve({ ok: true }),
    inspectExpectedChanges:
      overrides.inspectExpectedChanges ?? (() => Promise.resolve({ ok: true })),
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

test("the exact standards capability upgrade executor and writer are exported", () => {
  assert.equal(typeof core.applyCapabilityUpgrade, "function");
  assert.equal(typeof core.createFileSystemCapabilityUpgradeWriter, "function");
});

test("standards capability upgrade refuses unsupported capability and target inputs without mutation", async () => {
  for (const unsupported of [
    { capability: "observability" },
    { toVersion: "0.5.0" },
  ]) {
    const repository = createRepository(await historicalEntries("portfolio"));
    const before = snapshotFiles(repository.files);
    const controls = new Map(
      [".egeria/project.yaml", ".egeria/state.json", ".egeria/migrations.jsonl"].map(
        (path) => [path, new Uint8Array(repository.files.get(path))],
      ),
    );
    const execution = await invokeApply(repository, unsupported);
    assertFailure(execution.result, {
      code: "CAPABILITY_UPGRADE_UNSUPPORTED",
      phase: "precondition",
      recovery: "not-required",
    });
    assertUnchanged(repository, before);
    assertControlBytes(repository, controls);
    assert.equal(repository.writes.length, 0);
    assert.deepEqual(execution.verifierCalls, []);
  }
});

test("standards capability upgrade transforms, verifies, persists state last, and stops for final-diff approval", async () => {
  for (const profile of ["portfolio", "site"]) {
    const historical = await historicalEntries(profile);
    const target =
      profile === "site" ? await acceptedSiteEntries() : await currentEntries(profile);
    const repository = createRepository(historical);
    const initialProject = new Uint8Array(
      repository.files.get(".egeria/project.yaml"),
    );
    const initialStateResult = core.parseStateJson(
      decode(repository.files.get(".egeria/state.json")),
    );
    assert.equal(initialStateResult.ok, true);

    const execution = await runApply(repository);
    assert.equal(execution.result.ok, true, JSON.stringify(execution.result));
    const changedPaths = [
      ...execution.plan.actions.map(({ path }) => path),
      ".egeria/migrations.jsonl",
      ".egeria/state.json",
    ].sort(compareText);
    assert.deepEqual(execution.result.value, {
      status: "verified-final-diff-approval-required",
      baseRevision: git.identity.revision,
      capability: {
        identifier: "standards",
        fromVersion: "0.3.0",
        toVersion: "0.4.0",
      },
      migration: migrationIdentifier,
      changedPaths,
      verificationChecks: core.capabilityUpgradeVerificationChecks,
    });
    assert.deepEqual(execution.verifierCalls, [root]);
    assert.equal(repository.writes.length, 3);
    assert.deepEqual(
      repository.writes[0].map(({ path }) => path),
      execution.plan.actions.map(({ path }) => path),
    );
    assert.deepEqual(
      repository.writes[1].map(({ path }) => path),
      [".egeria/migrations.jsonl"],
    );
    assert.deepEqual(
      repository.writes[2].map(({ path }) => path),
      [".egeria/state.json"],
    );
    assert.deepEqual(execution.worktreeInspections, [{ root }, { root }]);
    assert.deepEqual(execution.createTargetInspections, [
      {
        root,
        paths: execution.plan.actions.flatMap((action) =>
          action.kind === "create-file" ? [action.path] : [],
        ),
      },
    ]);
    assert.deepEqual(execution.expectedChangeInspections, [
      { root, identity: git.identity, expectedPaths: changedPaths },
    ]);

    for (const action of execution.plan.actions) {
      assert.deepEqual(
        repository.files.get(action.path),
        target.get(action.path),
        `${profile}:${action.path}`,
      );
    }
    assert.deepEqual(repository.files.get(".egeria/project.yaml"), initialProject);

    const migrations = core.parseMigrationLog(
      decode(repository.files.get(".egeria/migrations.jsonl")),
    );
    const state = core.parseStateJson(
      decode(repository.files.get(".egeria/state.json")),
    );
    assert.equal(migrations.ok, true, JSON.stringify(migrations.issues));
    assert.equal(state.ok, true, JSON.stringify(state.issues));
    assert.deepEqual(migrations.value.at(-1), {
      schemaVersion: "1.0.0",
      identifier: migrationIdentifier,
      kind: "migration",
      outcome: "succeeded",
      completedAt,
      fromBuilderVersion: "0.0.0",
      toBuilderVersion: "0.0.0",
      capabilities: execution.plan.desiredCapabilities,
      persistentDataAuthorizations: [],
      remainingKnownDrift: [],
      verificationChecks: core.capabilityUpgradePersistedVerificationChecks,
    });
    assert.deepEqual(state.value.origin, initialStateResult.value.origin);
    assert.equal(
      state.value.builderVersion,
      initialStateResult.value.builderVersion,
    );
    assert.equal(
      state.value.projectSchemaVersion,
      initialStateResult.value.projectSchemaVersion,
    );
    assert.deepEqual(state.value.compatibility, initialStateResult.value.compatibility);
    assert.deepEqual(state.value.ejections, initialStateResult.value.ejections);
    assert.deepEqual(state.value.appliedMigrations, [migrationIdentifier]);
    assert.equal(
      state.value.installedCapabilities.find(
        ({ identifier }) => identifier === "standards",
      )?.version,
      "0.4.0",
    );
    assert.deepEqual(
      state.value.installedCapabilities.filter(
        ({ identifier }) => identifier !== "standards",
      ),
      initialStateResult.value.installedCapabilities.filter(
        ({ identifier }) => identifier !== "standards",
      ),
    );
    const actionPaths = new Set(execution.plan.actions.map(({ path }) => path));
    const isTransactionSurface = (surface) =>
      surface.identifier === "builder-migration-log" ||
      (surface.owner.kind === "capability" &&
        surface.owner.identifier === "standards" &&
        actionPaths.has(surface.path));
    assert.deepEqual(
      state.value.managedSurfaces.filter(
        (surface) => !isTransactionSurface(surface),
      ),
      initialStateResult.value.managedSurfaces.filter(
        (surface) => !isTransactionSurface(surface),
      ),
    );
    assert.deepEqual(state.value.lastSuccessfulVerification, {
      kind: "capability-upgrade",
      checks: core.capabilityUpgradePersistedVerificationChecks,
    });
    assert.doesNotMatch(JSON.stringify(execution.result), /refs\/heads|displayName/u);
  }
});

test("site-routing upgrade replaces the exact production recipe and persists state last", async () => {
  const repository = createRepository(await acceptedSiteEntries());
  const before = snapshotFiles(repository.files);
  const execution = await runApply(repository, { capability: "site-routing" });

  assert.equal(execution.result.ok, true, JSON.stringify(execution.result));
  assert.equal(
    execution.result.value.migration,
    "upgrade-site-routing-0-3-0-to-0-4-0",
  );
  assert.deepEqual(execution.result.value.capability, {
    identifier: "site-routing",
    fromVersion: "0.3.0",
    toVersion: "0.4.0",
  });
  assertExactChangedPaths(
    repository.files,
    before,
    [
      ...execution.plan.actions.map(({ path }) => path),
      ".egeria/migrations.jsonl",
      ".egeria/state.json",
    ].sort(compareText),
  );

  const project = core.parseProjectYaml(
    decode(repository.files.get(".egeria/project.yaml")),
  );
  const state = core.parseStateJson(
    decode(repository.files.get(".egeria/state.json")),
  );
  const migrations = core.parseMigrationLog(
    decode(repository.files.get(".egeria/migrations.jsonl")),
  );
  assert.equal(project.ok, true);
  assert.equal(state.ok, true);
  assert.equal(migrations.ok, true);
  assert.equal(project.value.recipeVersion, "0.11.0");
  assert.equal(state.value.origin.recipeVersion, "0.11.0");
  assert.equal(
    state.value.installedCapabilities.find(
      ({ identifier }) => identifier === "site-routing",
    )?.version,
    "0.4.0",
  );
  assert.deepEqual(state.value.appliedMigrations, [
    "upgrade-site-routing-0-3-0-to-0-4-0",
  ]);
  assert.deepEqual(
    repository.files.get("pnpm-workspace.yaml"),
    new Uint8Array(
      await readFile(resolve(packageRoot, "templates/common/pnpm-workspace.yaml")),
    ),
  );
  assert.equal(repository.writes.length, 3);
  assert.deepEqual(
    repository.writes.map((batch) => batch.map(({ path }) => path)),
    [
      execution.plan.actions.map(({ path }) => path),
      [".egeria/migrations.jsonl"],
      [".egeria/state.json"],
    ],
  );
});

test("site-routing upgrade retains transformed source and old state and migration controls when verification fails", async () => {
  const target = await currentEntries("site");
  const repository = createRepository(await acceptedSiteEntries());
  const controls = new Map(
    [".egeria/state.json", ".egeria/migrations.jsonl"].map((path) => [
      path,
      new Uint8Array(repository.files.get(path)),
    ]),
  );
  const execution = await runApply(repository, {
    capability: "site-routing",
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

  assertFailure(execution.result, {
    code: "CAPABILITY_VERIFICATION_FAILED",
    phase: "verify",
    recovery: "inspect-worktree",
  });
  assertSourceActionsMatchTarget(repository, execution.plan, target);
  for (const [path, content] of controls) {
    assert.deepEqual(repository.files.get(path), content, path);
  }
  assert.equal(repository.writes.length, 1);
});

test("site-routing upgrade rejects changed final bytes after state persistence", async () => {
  const repository = createRepository(await acceptedSiteEntries());
  const corruptedPath = "apps/web/app/about/page.tsx";
  const execution = await runApply(repository, {
    capability: "site-routing",
    inspectExpectedChanges: () => {
      repository.files.set(
        corruptedPath,
        encoder.encode("concurrent final edit\n"),
      );
      return Promise.resolve({ ok: true });
    },
  });

  assertFailure(execution.result, {
    code: "CAPABILITY_FINAL_DIFF_FAILED",
    phase: "final-diff",
    recovery: "inspect-worktree",
  });
  assert.equal(repository.writes.length, 3);
  assert.equal(
    decode(repository.files.get(corruptedPath)),
    "concurrent final edit\n",
  );
});

test("standards capability upgrade refuses malformed, wrong, and stale plan authority without mutation", async () => {
  for (const approvedPlanFingerprint of [
    "not-a-fingerprint",
    `sha256:${"0".repeat(64)}`,
  ]) {
    const repository = createRepository(await historicalEntries("portfolio"));
    const before = snapshotFiles(repository.files);
    const execution = await runApply(repository, { approvedPlanFingerprint });
    assertFailure(execution.result, {
      code: "CAPABILITY_PLAN_APPROVAL_INVALID",
      phase: "precondition",
      recovery: "not-required",
    });
    assertUnchanged(repository, before);
    assert.equal(repository.writes.length, 0);
    assert.deepEqual(execution.verifierCalls, []);
  }

  const repository = createRepository(await historicalEntries("portfolio"));
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
    code: "CAPABILITY_PLAN_APPROVAL_INVALID",
    phase: "precondition",
    recovery: "not-required",
  });
  assert.deepEqual(snapshotFiles(repository.files).length, before.length);
  assert.equal(repository.writes.length, 0);
  assert.notDeepEqual(repository.files.get(".egeria/state.json"), controls.get(".egeria/state.json"));
  assert.deepEqual(repository.files.get(".egeria/project.yaml"), controls.get(".egeria/project.yaml"));
  assert.deepEqual(repository.files.get(".egeria/migrations.jsonl"), controls.get(".egeria/migrations.jsonl"));
});

test("standards capability upgrade propagates named planner refusals without mutation", async () => {
  const cases = [
    {
      name: "already current",
      entries: await currentEntries("portfolio"),
      code: "CAPABILITY_ALREADY_CURRENT",
    },
    {
      name: "missing edge",
      entries: await historicalEntries("portfolio"),
      mutate(entries) {
        const state = core.parseStateJson(decode(entries.get(".egeria/state.json")));
        assert.equal(state.ok, true);
        entries.set(
          ".egeria/state.json",
          encoder.encode(
            core.serializeStateJson({
              ...state.value,
              installedCapabilities: state.value.installedCapabilities.map(
                (capability) =>
                  capability.identifier === "standards"
                    ? { ...capability, version: "0.2.0" }
                    : capability,
              ),
            }),
          ),
        );
      },
      code: "CAPABILITY_UPGRADE_EDGE_MISSING",
    },
    {
      name: "ambiguous version",
      entries: await historicalEntries("portfolio"),
      mutate(entries) {
        const state = core.parseStateJson(decode(entries.get(".egeria/state.json")));
        assert.equal(state.ok, true);
        entries.set(
          ".egeria/state.json",
          encoder.encode(
            core.serializeStateJson({
              ...state.value,
              installedCapabilities: state.value.installedCapabilities.filter(
                ({ identifier }) => identifier !== "standards",
              ),
            }),
          ),
        );
      },
      code: "CAPABILITY_VERSION_AMBIGUOUS",
    },
    {
      name: "managed drift",
      entries: await historicalEntries("portfolio"),
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
      entries: await historicalEntries("portfolio"),
      mutate(entries) {
        entries.set(visualPaths[0], encoder.encode("collision\n"));
      },
      code: "CAPABILITY_ACTION_CONFLICT",
    },
    {
      name: "invalid migration history",
      entries: await historicalEntries("portfolio"),
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

test("standards capability upgrade refuses duplicate migration history before writing", async () => {
  const entries = await historicalEntries("portfolio");
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
    verificationChecks: core.capabilityUpgradePersistedVerificationChecks,
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

test("standards capability upgrade refuses unsafe Git and changed pre-write identity", async () => {
  for (const code of [
    "GIT_REPOSITORY_REQUIRED",
    "GIT_WORKTREE_IDENTITY_INVALID",
    "GIT_WORKTREE_NOT_ISOLATED",
    "GIT_BRANCH_REQUIRED",
    "GIT_OPERATION_IN_PROGRESS",
    "GIT_WORKTREE_CONFLICTED",
    "GIT_WORKTREE_DIRTY",
  ]) {
    const repository = createRepository(await historicalEntries("portfolio"));
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

  const nonCanonical = createRepository(await historicalEntries("portfolio"));
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

  const changed = createRepository(await historicalEntries("portfolio"));
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

test("standards capability upgrade refuses an ignored create target before mutation", async () => {
  const repository = createRepository(await historicalEntries("portfolio"));
  const before = snapshotFiles(repository.files);
  const controls = new Map(
    [".egeria/project.yaml", ".egeria/state.json", ".egeria/migrations.jsonl"].map(
      (path) => [path, new Uint8Array(repository.files.get(path))],
    ),
  );
  const execution = await runApply(repository, {
    inspectCreateTargets: ({ paths }) => {
      assert.deepEqual(paths, visualPaths);
      return Promise.resolve({
        ok: false,
        code: "CAPABILITY_ACTION_CONFLICT",
      });
    },
  });
  assertFailure(execution.result, {
    code: "CAPABILITY_ACTION_CONFLICT",
    phase: "precondition",
    recovery: "not-required",
  });
  assertUnchanged(repository, before);
  assertControlBytes(repository, controls);
  assert.equal(repository.writes.length, 0);
});

test("standards capability upgrade contains reader, create-target, and preflight exceptions before writes", async () => {
  const readerFailure = createRepository(await historicalEntries("portfolio"), {
    throwOnRead: ".egeria/project.yaml",
  });
  const readerBefore = snapshotFiles(readerFailure.files);
  const readerExecution = await invokeApply(readerFailure);
  assertFailure(readerExecution.result, {
    code: "REPOSITORY_OPEN_FAILED",
    phase: "precondition",
    recovery: "not-required",
  });
  assertUnchanged(readerFailure, readerBefore);

  const createConflict = createRepository(await historicalEntries("portfolio"));
  const createBefore = snapshotFiles(createConflict.files);
  const createExecution = await runApply(createConflict, {
    inspectCreateTargets: () =>
      Promise.resolve({ ok: false, code: "CAPABILITY_ACTION_CONFLICT" }),
  });
  assertFailure(createExecution.result, {
    code: "CAPABILITY_ACTION_CONFLICT",
    phase: "precondition",
    recovery: "not-required",
  });
  assertUnchanged(createConflict, createBefore);

  const preflightException = createRepository(
    await historicalEntries("portfolio"),
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

test("standards capability upgrade distinguishes uncommitted and partial transform failures", async () => {
  const refused = createRepository(await historicalEntries("portfolio"), {
    failBatch: 1,
  });
  const refusedBefore = snapshotFiles(refused.files);
  const refusedExecution = await runApply(refused);
  assertFailure(refusedExecution.result, {
    code: "CAPABILITY_TRANSFORM_FAILED",
    phase: "transform",
    recovery: "not-required",
  });
  assertUnchanged(refused, refusedBefore);

  const partial = createRepository(await historicalEntries("portfolio"));
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
    code: "CAPABILITY_TRANSFORM_FAILED",
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
  assertControlBytes(partial, partialBefore);
});

test("standards capability upgrade retains transformed source and old controls on verification or re-inference failure", async () => {
  const target = await currentEntries("portfolio");
  const verification = createRepository(await historicalEntries("portfolio"));
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
    code: "CAPABILITY_VERIFICATION_FAILED",
    phase: "verify",
    recovery: "inspect-worktree",
  });
  for (const action of verificationExecution.plan.actions) {
    assert.deepEqual(verification.files.get(action.path), target.get(action.path));
  }
  assertControlBytes(verification, verificationControls);

  const reinference = createRepository(await historicalEntries("portfolio"));
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
    code: "CAPABILITY_REINFERENCE_FAILED",
    phase: "re-infer",
    recovery: "inspect-worktree",
  });
  assertControlBytes(reinference, reinferenceControls);
});

test("standards capability upgrade maps clock and migration persistence failures to the retained source prefix", async () => {
  const invalidClock = createRepository(await historicalEntries("portfolio"));
  const invalidClockControls = new Map(
    [".egeria/project.yaml", ".egeria/state.json", ".egeria/migrations.jsonl"].map(
      (path) => [path, new Uint8Array(invalidClock.files.get(path))],
    ),
  );
  const invalidClockExecution = await runApply(invalidClock, {
    now: () => "not-an-iso-time",
  });
  assertFailure(invalidClockExecution.result, {
    code: "CAPABILITY_MIGRATION_RECORD_INVALID",
    phase: "persist-migration",
    recovery: "inspect-worktree",
  });
  assertControlBytes(invalidClock, invalidClockControls);
  assert.equal(invalidClock.writes.length, 1);

  const migrationFailure = createRepository(await historicalEntries("portfolio"), {
    failBatch: 2,
  });
  const migrationState = new Uint8Array(
    migrationFailure.files.get(".egeria/state.json"),
  );
  const migrationExecution = await runApply(migrationFailure);
  assertFailure(migrationExecution.result, {
    code: "CAPABILITY_MIGRATION_WRITE_FAILED",
    phase: "persist-migration",
    recovery: "inspect-worktree",
  });
  assert.deepEqual(migrationFailure.files.get(".egeria/state.json"), migrationState);
  assert.equal(migrationFailure.writes.length, 1);
});

test("standards capability upgrade retains the migration prefix when its reread fails", async () => {
  const target = await currentEntries("portfolio");
  const repository = createRepository(await historicalEntries("portfolio"));
  const before = snapshotFiles(repository.files);
  const initialProject = new Uint8Array(
    repository.files.get(".egeria/project.yaml"),
  );
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
    code: "CAPABILITY_MIGRATION_WRITE_FAILED",
    phase: "persist-migration",
    recovery: "inspect-worktree",
  });
  assertSourceActionsMatchTarget(repository, execution.plan, target);
  assert.deepEqual(repository.files.get(".egeria/project.yaml"), initialProject);
  assert.deepEqual(repository.files.get(".egeria/state.json"), initialState);
  assert.equal(
    decode(repository.files.get(".egeria/migrations.jsonl")),
    expectedMigrationSource(
      initialMigrationSource,
      execution.plan.desiredCapabilities,
    ),
  );
  assertExactChangedPaths(
    repository.files,
    before,
    exactChangedPaths.filter((path) => path !== ".egeria/state.json"),
  );
  assert.equal(repository.writes.length, 2);
});

test("standards capability upgrade retains an uncertain committed migration append", async () => {
  const target = await currentEntries("portfolio");
  const repository = createRepository(await historicalEntries("portfolio"));
  const before = snapshotFiles(repository.files);
  const initialProject = new Uint8Array(
    repository.files.get(".egeria/project.yaml"),
  );
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
    code: "CAPABILITY_MIGRATION_WRITE_FAILED",
    phase: "persist-migration",
    recovery: "inspect-worktree",
  });
  assertSourceActionsMatchTarget(repository, execution.plan, target);
  assert.deepEqual(repository.files.get(".egeria/project.yaml"), initialProject);
  assert.deepEqual(repository.files.get(".egeria/state.json"), initialState);
  assert.equal(
    decode(repository.files.get(".egeria/migrations.jsonl")),
    expectedMigrationSource(
      initialMigrationSource,
      execution.plan.desiredCapabilities,
    ),
  );
  assertExactChangedPaths(
    repository.files,
    before,
    exactChangedPaths.filter((path) => path !== ".egeria/state.json"),
  );
  assert.equal(repository.writes.length, 2);
});

test("standards capability upgrade retains migration and old state on state construction failure", async () => {
  const target = await currentEntries("portfolio");
  const repository = createRepository(await historicalEntries("portfolio"));
  const before = snapshotFiles(repository.files);
  const initialProject = new Uint8Array(
    repository.files.get(".egeria/project.yaml"),
  );
  const initialState = new Uint8Array(repository.files.get(".egeria/state.json"));
  const initialMigrationSource = decode(
    repository.files.get(".egeria/migrations.jsonl"),
  );
  const originalWrite = repository.writer.write;
  let sourceBatch;
  repository.writer.write = async (changes) => {
    const result = await originalWrite(changes);
    if (result.ok && changes.length === 6) {
      sourceBatch = changes;
    }
    if (result.ok && changes[0]?.path === ".egeria/migrations.jsonl") {
      const manifestChange = sourceBatch?.find(
        ({ path }) => path === "apps/web/package.json",
      );
      assert.notEqual(manifestChange, undefined);
      manifestChange.content.fill(0);
    }
    return result;
  };

  const execution = await runApply(repository);
  assertFailure(execution.result, {
    code: "CAPABILITY_STATE_CONSTRUCTION_FAILED",
    phase: "persist-state",
    recovery: "inspect-worktree",
  });
  assertSourceActionsMatchTarget(repository, execution.plan, target);
  assert.deepEqual(repository.files.get(".egeria/project.yaml"), initialProject);
  assert.deepEqual(repository.files.get(".egeria/state.json"), initialState);
  assert.equal(
    decode(repository.files.get(".egeria/migrations.jsonl")),
    expectedMigrationSource(
      initialMigrationSource,
      execution.plan.desiredCapabilities,
    ),
  );
  assertExactChangedPaths(
    repository.files,
    before,
    exactChangedPaths.filter((path) => path !== ".egeria/state.json"),
  );
  assert.equal(repository.writes.length, 2);
});

test("standards capability upgrade retains migration and old state when state persistence fails", async () => {
  const repository = createRepository(await historicalEntries("portfolio"), {
    failBatch: 3,
  });
  const initialState = new Uint8Array(repository.files.get(".egeria/state.json"));
  const execution = await runApply(repository);
  assertFailure(execution.result, {
    code: "CAPABILITY_STATE_WRITE_FAILED",
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
    core.capabilityUpgradePersistedVerificationChecks,
  );
  assert.equal(repository.writes.length, 2);
});

test("standards capability upgrade retains an uncertain committed state replacement", async () => {
  const target = await currentEntries("portfolio");
  const repository = createRepository(await historicalEntries("portfolio"));
  const before = snapshotFiles(repository.files);
  const initialProject = new Uint8Array(
    repository.files.get(".egeria/project.yaml"),
  );
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
    code: "CAPABILITY_STATE_WRITE_FAILED",
    phase: "persist-state",
    recovery: "inspect-worktree",
  });
  assertSourceActionsMatchTarget(repository, execution.plan, target);
  assert.deepEqual(repository.files.get(".egeria/project.yaml"), initialProject);
  assert.equal(
    decode(repository.files.get(".egeria/migrations.jsonl")),
    expectedMigrationSource(
      initialMigrationSource,
      execution.plan.desiredCapabilities,
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
    state.value.installedCapabilities.find(
      ({ identifier }) => identifier === "standards",
    )?.version,
    "0.4.0",
  );
  assert.notDeepEqual(repository.files.get(".egeria/state.json"), initialState);
  assertExactChangedPaths(repository.files, before, exactChangedPaths);
  assert.equal(repository.writes.length, 3);
});

test("standards capability upgrade retains the full persisted prefix on post-state disagreement", async () => {
  const repository = createRepository(await historicalEntries("portfolio"), {
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
    code: "CAPABILITY_POST_STATE_FAILED",
    phase: "post-state",
    recovery: "inspect-worktree",
  });
  assert.equal(repository.writes.length, 3);
  const state = core.parseStateJson(decode(repository.files.get(".egeria/state.json")));
  assert.equal(state.ok, true);
  assert.equal(state.value.appliedMigrations.includes(migrationIdentifier), true);
});

test("standards capability upgrade retains the full prefix on post-state state and inference disagreement", async () => {
  let disagreeingStateSource;
  const target = await currentEntries("portfolio");
  const repository = createRepository(await historicalEntries("portfolio"), {
    afterWrite({ batch, files }) {
      if (batch === 3) {
        const writtenState = core.parseStateJson(
          decode(files.get(".egeria/state.json")),
        );
        assert.equal(writtenState.ok, true);
        disagreeingStateSource = core.serializeStateJson({
          ...writtenState.value,
          installedCapabilities: writtenState.value.installedCapabilities.map(
            (capability) =>
              capability.identifier === "standards"
                ? { ...capability, version: "0.3.0" }
                : capability,
          ),
        });
        files.set(".egeria/state.json", encoder.encode(disagreeingStateSource));
      }
    },
  });
  const before = snapshotFiles(repository.files);
  const initialProject = new Uint8Array(
    repository.files.get(".egeria/project.yaml"),
  );
  const initialMigrationSource = decode(
    repository.files.get(".egeria/migrations.jsonl"),
  );

  const execution = await runApply(repository);
  assertFailure(execution.result, {
    code: "CAPABILITY_POST_STATE_FAILED",
    phase: "post-state",
    recovery: "inspect-worktree",
  });
  assertSourceActionsMatchTarget(repository, execution.plan, target);
  assert.deepEqual(repository.files.get(".egeria/project.yaml"), initialProject);
  assert.equal(
    decode(repository.files.get(".egeria/migrations.jsonl")),
    expectedMigrationSource(
      initialMigrationSource,
      execution.plan.desiredCapabilities,
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
  assert.equal(
    state.value.installedCapabilities.find(
      ({ identifier }) => identifier === "standards",
    )?.version,
    "0.3.0",
  );
  assertExactChangedPaths(repository.files, before, exactChangedPaths);
  assert.equal(repository.writes.length, 3);
});

test("standards capability upgrade reports final Git and exact-byte failures after persistence", async () => {
  const gitFailure = createRepository(await historicalEntries("portfolio"));
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

  const byteFailure = createRepository(await historicalEntries("portfolio"));
  const byteExecution = await runApply(byteFailure, {
    inspectExpectedChanges: () => {
      byteFailure.files.set(
        ".github/workflows/quality.yml",
        encoder.encode("concurrent final edit\n"),
      );
      return Promise.resolve({ ok: true });
    },
  });
  assertFailure(byteExecution.result, {
    code: "CAPABILITY_FINAL_DIFF_FAILED",
    phase: "final-diff",
    recovery: "inspect-worktree",
  });
  assert.equal(byteFailure.writes.length, 3);
});

test("filesystem-backed standards upgrade verifies binary baselines without an injected byte reader", async () => {
  await withFileSystemRepository(
    await historicalEntries("portfolio"),
    async (directory) => {
      const beforeFiles = await loadEntries(directory);
      const before = snapshotFiles(beforeFiles);
      const initialProject = new Uint8Array(
        beforeFiles.get(".egeria/project.yaml"),
      );
      const initialMigrationSource = decode(
        beforeFiles.get(".egeria/migrations.jsonl"),
      );
      const target = await currentEntries("portfolio");

      const execution = await runFileSystemApply(directory);
      assert.equal(execution.result.ok, true, JSON.stringify(execution.result));
      assert.deepEqual(execution.result.value.changedPaths, exactChangedPaths);
      assert.deepEqual(execution.verifierCalls, [directory]);

      const afterFiles = await loadEntries(directory);
      assertExactChangedPaths(afterFiles, before, exactChangedPaths);
      assert.deepEqual(afterFiles.get(".egeria/project.yaml"), initialProject);
      assert.equal(
        decode(afterFiles.get(".egeria/migrations.jsonl")),
        expectedMigrationSource(
          initialMigrationSource,
          execution.plan.desiredCapabilities,
        ),
      );
      for (const path of visualPaths.slice(2)) {
        assert.deepEqual(afterFiles.get(path), target.get(path), path);
      }
      const state = core.parseStateJson(decode(afterFiles.get(".egeria/state.json")));
      assert.equal(state.ok, true);
      assert.equal(
        decode(afterFiles.get(".egeria/state.json")),
        core.serializeStateJson(state.value),
      );
      assert.equal(
        state.value.installedCapabilities.find(
          ({ identifier }) => identifier === "standards",
        )?.version,
        "0.4.0",
      );
    },
  );
});

test("filesystem-backed standards upgrade rejects changed final binary bytes without an injected byte reader", async () => {
  await withFileSystemRepository(
    await historicalEntries("site"),
    async (directory) => {
      const beforeFiles = await loadEntries(directory);
      const before = snapshotFiles(beforeFiles);
      const initialProject = new Uint8Array(
        beforeFiles.get(".egeria/project.yaml"),
      );
      const initialMigrationSource = decode(
        beforeFiles.get(".egeria/migrations.jsonl"),
      );
      const corruptedPath = visualPaths[2];

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
        code: "CAPABILITY_FINAL_DIFF_FAILED",
        phase: "final-diff",
        recovery: "inspect-worktree",
      });

      const afterFiles = await loadEntries(directory);
      assertExactChangedPaths(afterFiles, before, exactChangedPaths);
      assert.deepEqual(afterFiles.get(".egeria/project.yaml"), initialProject);
      assert.equal(
        decode(afterFiles.get(".egeria/migrations.jsonl")),
        expectedMigrationSource(
          initialMigrationSource,
          execution.plan.desiredCapabilities,
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
