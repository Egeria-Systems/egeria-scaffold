import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "../..");
const core = await import(pathToFileURL(resolve(packageRoot, "dist/index.js")));
const stateSurfaces = await import(
  pathToFileURL(
    resolve(packageRoot, "dist/generation/builder-state-surfaces.js"),
  )
);
const decoder = new TextDecoder("utf-8", { fatal: true });
const encoder = new TextEncoder();
const root = "/generated/project";
const completedAt = "2026-08-22T15:00:00.000Z";
const settings = Object.freeze({
  destination: "https://calendly.com/private/discovery",
  mode: "popup",
});
const analyticsSettings = Object.freeze({
  consent: Object.freeze({ policy: "explicit-opt-in" }),
  providers: Object.freeze({
    cloudflareWebAnalytics: Object.freeze({
      siteToken: "0123456789abcdef0123456789abcdef",
    }),
    googleAnalytics4: Object.freeze({ measurementId: "G-ABCDEF1234" }),
    microsoftClarity: Object.freeze({
      projectId: "clarity123",
      audience: "not-directed-to-minors",
    }),
  }),
  operationalIntegrations: Object.freeze({
    googleSearchConsole: Object.freeze({
      verificationToken: "search-console-verification-token",
    }),
    lookerStudio: Object.freeze({ connector: "google-analytics-4" }),
  }),
});
const persistedVerificationChecks = [
  "contracts",
  "plan-approval",
  "pre-state-inference",
  ...core.ordinaryGenerationVerificationChecks,
  "post-change-inference",
];
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

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

async function loadTextEntries(directory) {
  const entries = new Map();

  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const absolutePath = join(current, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
      } else if (entry.isFile()) {
        entries.set(
          relative(directory, absolutePath).split(sep).join("/"),
          await readFile(absolutePath, "utf8"),
        );
      }
    }
  }

  await visit(directory);
  return entries;
}

async function installedEntries(profile, options = {}) {
  const includeBooking = options.booking ?? true;
  const includeMultilingual = options.multilingual ?? false;
  const includeAnalytics = options.analytics ?? false;
  const rendered = await core.renderSkeleton({
    profile,
    projectName: `${profile}-removal-test`,
    displayName: `${profile} removal test`,
    packageVersions: core.verifiedCapabilityPackageVersions,
    ...(includeBooking ? { bookingCalendly: settings } : {}),
    ...(includeMultilingual ? { multilingual: true } : {}),
    ...(includeAnalytics ? { analytics: analyticsSettings } : {}),
  });
  assert.equal(rendered.ok, true, JSON.stringify(rendered.issues));

  const byteFiles = new Map(
    rendered.value.files.map(({ path, content }) => [path, content]),
  );
  byteFiles.set(
    "pnpm-lock.yaml",
    new Uint8Array(
      await readFile(
        resolve(repositoryRoot, `fixtures/generated/${profile}/pnpm-lock.yaml`),
      ),
    ),
  );
  byteFiles.set(
    ".egeria/project.yaml",
    encoder.encode(core.serializeProjectYaml(rendered.value.project)),
  );
  const defaultMigrations = [
    ...(includeBooking ? ["add-booking-calendly-0-1-0"] : []),
    ...(includeMultilingual ? ["add-multilingual-0-1-0"] : []),
    ...(includeAnalytics ? ["add-analytics-0-1-0"] : []),
  ];
  const appliedMigrations = options.appliedMigrations ?? defaultMigrations;
  const additionMigrations = appliedMigrations.map((identifier, index) => ({
    schemaVersion: "1.0.0",
    identifier,
    kind: "migration",
    outcome: "succeeded",
    completedAt: `2026-08-21T15:00:0${index}.000Z`,
    fromBuilderVersion: "0.0.0",
    toBuilderVersion: "0.0.0",
    capabilities: rendered.value.resolved.capabilities
      .map(({ identifier: capabilityIdentifier }) => capabilityIdentifier)
      .sort(compareText),
    persistentDataAuthorizations: [],
    remainingKnownDrift: [],
    verificationChecks: persistedVerificationChecks,
  }));
  byteFiles.set(
    ".egeria/migrations.jsonl",
    encoder.encode(
      additionMigrations.map(core.serializeMigrationRecord).join(""),
    ),
  );

  const surfaces = core.materializeInstalledSurfaces({
    files: byteFiles,
    surfaces: [
      ...rendered.value.surfaces,
      ...stateSurfaces.createBuilderStateSurfaces(),
    ],
  });
  assert.equal(surfaces.ok, true, JSON.stringify(surfaces.issues));
  const state = {
    schemaVersion: "1.0.0",
    builderVersion: "0.0.0",
    projectSchemaVersion: "1.0.0",
    origin: { profile, recipeVersion: rendered.value.project.recipeVersion },
    installedCapabilities: core.createInstalledManifest(rendered.value.resolved),
    appliedMigrations,
    managedSurfaces: surfaces.value,
    ejections: [],
    compatibility: {
      node: "22.23.2",
      pnpm: "11.20.0",
      platformAdapter: "cloudflare-workers",
    },
    lastSuccessfulVerification: {
      kind: "capability-addition",
      checks: persistedVerificationChecks,
    },
  };
  const entries = new Map(
    [...byteFiles].map(([path, content]) => {
      try {
        return [path, decoder.decode(content)];
      } catch {
        return [path, { kind: "error", code: "FILE_ENCODING_INVALID" }];
      }
    }),
  );
  entries.set(".egeria/state.json", core.serializeStateJson(state));
  return entries;
}

function sourceMatchesExpected(current, expected) {
  if (expected instanceof Uint8Array) {
    return typeof current === "string" && current === decoder.decode(expected);
  }
  if (expected.kind === "missing") {
    return current === undefined;
  }
  return (
    typeof current === "string" &&
    current === decoder.decode(expected.content)
  );
}

function createRepository(entries, options = {}) {
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
          : typeof content === "string"
            ? { kind: "file", content }
            : structuredClone(content);
      },
    },
    writer: {
      async write(changes) {
        const batch = writes.length + 1;
        const configuredFailure = options.failBatch === batch;
        if (configuredFailure) {
          return {
            ok: false,
            sourceChanged: options.failedBatchSourceChanged ?? false,
          };
        }

        for (const change of changes) {
          const current = files.get(change.path);
          if (!sourceMatchesExpected(current, change.expected)) {
            return { ok: false, sourceChanged: false };
          }
        }

        for (const change of changes) {
          if (change.kind === "delete-file") {
            files.delete(change.path);
          } else {
            files.set(change.path, decoder.decode(change.content));
          }
        }
        writes.push(changes.map(({ kind, path }) => ({ kind, path })));
        await options.afterWrite?.({ batch, changes, files });
        return { ok: true };
      },
    },
  };
}

function inventoryInspectorForFiles(files) {
  return () =>
    Promise.resolve({
      ok: true,
      value: {
        entries: [...files.keys()].sort(compareText).map((path) => ({
          path,
          kind: "file",
          source: "tracked",
        })),
        truncated: false,
      },
    });
}

const inspectEmptyRepositoryInventory = () =>
  Promise.resolve({
    ok: true,
    value: { entries: [], truncated: false },
  });

async function runAddition(repository) {
  const planned = await core.planCapabilityAddition({
    reader: repository.reader,
    git,
    capability: "analytics",
    settings: analyticsSettings,
  });
  assert.equal(planned.ok, true, JSON.stringify(planned.issues));
  const verifierCalls = [];
  const result = await core.applyCapabilityAddition({
    root,
    capability: "analytics",
    settings: analyticsSettings,
    approvedPlanFingerprint: planned.value.planFingerprint,
    reader: repository.reader,
    writer: repository.writer,
    verifier: successfulVerifier(verifierCalls),
    inspectWorktree: () => Promise.resolve(git),
    inspectCreateTargets: () => Promise.resolve({ ok: true }),
    inspectExpectedChanges: () => Promise.resolve({ ok: true }),
    now: () => "2026-08-23T15:00:00.000Z",
  });
  return { plan: planned.value, result, verifierCalls };
}

async function approvedPlan(reader, capability = "booking-calendly") {
  const result = await core.planCapabilityRemoval({
    reader,
    git,
    capability,
    inspectRepositoryInventory: inspectEmptyRepositoryInventory,
  });
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  return result.value;
}

function successfulVerifier(calls) {
  return {
    prepareLockfile() {
      throw new Error("removal must not prepare a lockfile");
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
  const capability = overrides.capability ?? "booking-calendly";
  const plan = await approvedPlan(repository.reader, capability);
  const worktreeInspections = [];
  const expectedInspections = [];
  const verifierCalls = [];
  const result = await core.applyCapabilityRemoval({
    root: overrides.root ?? root,
    capability,
    approvedPlanFingerprint:
      overrides.approvedPlanFingerprint ?? plan.planFingerprint,
    reader: repository.reader,
    writer: repository.writer,
    verifier: overrides.verifier ?? successfulVerifier(verifierCalls),
    inspectWorktree:
      overrides.inspectWorktree ??
      ((input) => {
        worktreeInspections.push(input);
        return Promise.resolve(git);
      }),
    inspectExpectedChanges:
      overrides.inspectExpectedChanges ??
      ((input) => {
        expectedInspections.push(input);
        return Promise.resolve({ ok: true });
      }),
    inspectRepositoryInventory:
      overrides.inspectRepositoryInventory ?? inspectEmptyRepositoryInventory,
    now: overrides.now ?? (() => completedAt),
  });
  return {
    expectedInspections,
    plan,
    result,
    verifierCalls,
    worktreeInspections,
  };
}

test("capability removal recomputes the Calendly reference guard before its first write", async () => {
  const entries = await installedEntries("portfolio");
  const repository = createRepository(entries);
  const inspectRepositoryInventory = inventoryInspectorForFiles(repository.files);
  const planned = await core.planCapabilityRemoval({
    reader: repository.reader,
    git,
    capability: "booking-calendly",
    inspectRepositoryInventory,
  });
  assert.equal(planned.ok, true, JSON.stringify(planned.issues));

  const consumerPath = "apps/web/src/surviving-booking-consumer.ts";
  repository.files.set(
    consumerPath,
    'export { CalendlyBooking } from "@/src/integrations/booking-calendly/calendly-booking";\n',
  );
  const before = snapshot(repository.files);
  const verifierCalls = [];
  const finalDiffCalls = [];
  const result = await core.applyCapabilityRemoval({
    root,
    capability: "booking-calendly",
    approvedPlanFingerprint: planned.value.planFingerprint,
    reader: repository.reader,
    writer: repository.writer,
    verifier: successfulVerifier(verifierCalls),
    inspectWorktree: () => Promise.resolve(git),
    inspectExpectedChanges: (input) => {
      finalDiffCalls.push(input);
      return Promise.resolve({ ok: true });
    },
    inspectRepositoryInventory,
    now: () => completedAt,
  });

  assert.deepEqual(result, {
    ok: false,
    code: "CAPABILITY_REMOVAL_REFERENCE_CONFLICT",
    conflicts: [consumerPath],
    phase: "precondition",
    recovery: "not-required",
  });
  assert.equal(snapshot(repository.files), before);
  assert.deepEqual(repository.writes, []);
  assert.deepEqual(verifierCalls, []);
  assert.deepEqual(finalDiffCalls, []);
  assert.doesNotMatch(JSON.stringify(result), /CalendlyBooking|refs\/heads/u);
});

async function expectedSuccessfulArtifacts(
  entries,
  plan,
  capability = "booking-calendly",
) {
  const currentProject = core.parseProjectYaml(entries.get(".egeria/project.yaml"));
  const currentState = core.parseStateJson(entries.get(".egeria/state.json"));
  assert.equal(currentProject.ok, true);
  assert.equal(currentState.ok, true);
  const preservedPaths = plan.actions
    .flatMap((action) =>
      action.kind === "preserve-file-and-eject" ? [action.path] : [],
    )
    .sort(compareText);
  const nextProject = {
    ...currentProject.value,
    selectedCapabilities: currentProject.value.selectedCapabilities.filter(
      (identifier) => identifier !== capability,
    ),
    capabilitySettings: {},
    ejectedAreas: [...new Set([
      ...currentProject.value.ejectedAreas,
      ...preservedPaths,
    ])].sort(compareText),
  };
  const desired = await core.renderSkeleton({
    profile: currentProject.value.originProfile,
    projectName: currentProject.value.project.name,
    displayName: currentProject.value.project.displayName,
    packageVersions: core.verifiedCapabilityPackageVersions,
  });
  assert.equal(desired.ok, true);
  const expectedFiles = new Map(entries);
  const desiredText = new Map(
    desired.value.files.flatMap(({ path, content }) => {
      try {
        return [[path, decoder.decode(content)]];
      } catch {
        return [];
      }
    }),
  );
  for (const action of plan.actions) {
    if (action.kind === "delete-file") {
      expectedFiles.delete(action.path);
    } else if (action.kind === "replace-file") {
      expectedFiles.set(action.path, desiredText.get(action.path));
    }
  }
  const projectSource = core.serializeProjectYaml(nextProject);
  expectedFiles.set(".egeria/project.yaml", projectSource);
  const removalMigration = {
    schemaVersion: "1.0.0",
    identifier: `remove-${capability}-0-1-0`,
    kind: "migration",
    outcome: "succeeded",
    completedAt,
    fromBuilderVersion: currentState.value.builderVersion,
    toBuilderVersion: currentState.value.builderVersion,
    capabilities: plan.desiredCapabilities,
    persistentDataAuthorizations: [],
    remainingKnownDrift: [],
    verificationChecks: persistedVerificationChecks,
  };
  const migrationSource = `${entries.get(".egeria/migrations.jsonl")}${core.serializeMigrationRecord(removalMigration)}`;
  expectedFiles.set(".egeria/migrations.jsonl", migrationSource);

  const desiredDescriptors = [
    ...desired.value.surfaces,
    ...stateSurfaces.createBuilderStateSurfaces(),
  ].sort((left, right) => compareText(left.identifier, right.identifier));
  const changedPaths = new Set([
    ...plan.actions.flatMap((action) =>
      action.kind === "preserve-file-and-eject" ? [] : [action.path],
    ),
    ".egeria/migrations.jsonl",
  ]);
  const byteFiles = new Map(
    [...expectedFiles].flatMap(([path, content]) =>
      typeof content === "string" ? [[path, encoder.encode(content)]] : [],
    ),
  );
  const changedDescriptors = desiredDescriptors.filter(({ path }) =>
    changedPaths.has(path),
  );
  const materialized = core.materializeInstalledSurfaces({
    files: byteFiles,
    surfaces: changedDescriptors,
  });
  assert.equal(materialized.ok, true, JSON.stringify(materialized.issues));
  const materializedByIdentifier = new Map(
    materialized.value.map((surface) => [surface.identifier, surface]),
  );
  const currentByIdentifier = new Map(
    currentState.value.managedSurfaces.map((surface) => [surface.identifier, surface]),
  );
  const nextSurfaces = desiredDescriptors.map((descriptor) =>
    materializedByIdentifier.get(descriptor.identifier) ??
      currentByIdentifier.get(descriptor.identifier),
  );
  for (const preservedPath of preservedPaths) {
    const preserved = currentState.value.managedSurfaces.find(
      ({ path }) => path === preservedPath,
    );
    assert.ok(preserved);
    nextSurfaces.push({ ...preserved, ownership: "ejected" });
  }
  nextSurfaces.sort((left, right) => compareText(left.identifier, right.identifier));
  const nextState = {
    ...currentState.value,
    installedCapabilities: core.createInstalledManifest(desired.value.resolved),
    appliedMigrations: [
      ...currentState.value.appliedMigrations,
      `remove-${capability}-0-1-0`,
    ],
    managedSurfaces: nextSurfaces,
    ejections: nextProject.ejectedAreas,
    lastSuccessfulVerification: {
      kind: "capability-removal",
      checks: persistedVerificationChecks,
    },
  };
  const stateSource = core.serializeStateJson(nextState);
  expectedFiles.set(".egeria/state.json", stateSource);
  return { expectedFiles, migrationSource, projectSource, stateSource };
}

test("capability removal executes the approved plan once and persists migration before state", async () => {
  assert.equal(typeof core.applyCapabilityRemoval, "function");
  for (const profile of ["portfolio", "site"]) {
    const entries = await installedEntries(profile);
    const repository = createRepository(entries);
    const plan = await approvedPlan(repository.reader);
    const expected = await expectedSuccessfulArtifacts(entries, plan);
    const {
      expectedInspections,
      result,
      verifierCalls,
      worktreeInspections,
    } = await runApply(repository);

    const catalog = core.createVerifiedCapabilityCatalog();
    assert.equal(catalog.ok, true);
    const finalInference = await core.inferRepository({
      reader: repository.reader,
      catalog: catalog.value,
    });
    assert.equal(
      result.ok,
      true,
      JSON.stringify({
        result,
        capabilities: finalInference.capabilities,
        stateExact:
          repository.files.get(".egeria/state.json") === expected.stateSource,
        exceptionalSurfaces: finalInference.surfaces.filter(
          ({ status }) =>
            !["confirmed", "application-owned", "ejected"].includes(status),
        ),
      }),
    );
    assert.deepEqual(result.value, {
      status: "verified-final-diff-approval-required",
      baseRevision: git.identity.revision,
      capability: { identifier: "booking-calendly", version: "0.1.0" },
      migration: "remove-booking-calendly-0-1-0",
      changedPaths: [
        ...plan.actions.flatMap((action) =>
          action.kind === "preserve-file-and-eject" ? [] : [action.path],
        ),
        ".egeria/migrations.jsonl",
        ".egeria/state.json",
      ].sort(compareText),
      preservedPaths: [],
      verificationChecks: core.capabilityRemovalVerificationChecks,
    });
    assert.deepEqual(worktreeInspections, [{ root }, { root }]);
    assert.deepEqual(verifierCalls, [root]);
    assert.equal(repository.writes.length, 3);
    assert.deepEqual(
      repository.writes[0].map(({ path }) => path),
      plan.actions.map(({ path }) => path),
    );
    assert.deepEqual(repository.writes[1], [
      { kind: "replace-file", path: ".egeria/migrations.jsonl" },
    ]);
    assert.deepEqual(repository.writes[2], [
      { kind: "replace-file", path: ".egeria/state.json" },
    ]);
    assert.equal(repository.files.get(".egeria/project.yaml"), expected.projectSource);
    assert.equal(repository.files.get(".egeria/migrations.jsonl"), expected.migrationSource);
    assert.equal(repository.files.get(".egeria/state.json"), expected.stateSource);
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

test("multilingual and Calendly removal preserve the other capability in both install orders", async () => {
  const installOrders = [
    ["add-booking-calendly-0-1-0", "add-multilingual-0-1-0"],
    ["add-multilingual-0-1-0", "add-booking-calendly-0-1-0"],
  ];

  for (const appliedMigrations of installOrders) {
    for (const capability of ["booking-calendly", "multilingual"]) {
      const repository = createRepository(
        await installedEntries("site", {
          booking: true,
          multilingual: true,
          appliedMigrations,
        }),
      );
      const { result } = await runApply(repository, { capability });
      const catalog = core.createVerifiedCapabilityCatalog();
      const failedInference = result.ok || !catalog.ok
        ? undefined
        : await core.inferRepository({
            reader: repository.reader,
            catalog: catalog.value,
          });
      assert.equal(
        result.ok,
        true,
        JSON.stringify({
          result,
          capability,
          appliedMigrations,
          capabilities: failedInference?.capabilities.map(
            ({ identifier, category }) => ({ identifier, category }),
          ),
          exceptionalSurfaces: failedInference?.surfaces.filter(
            ({ status }) =>
              !["confirmed", "application-owned", "missing", "drifted"].includes(
                status,
              ),
          ),
        }),
      );
      assert.equal(
        result.value.migration,
        capability === "booking-calendly"
          ? "remove-booking-calendly-0-1-0"
          : "remove-multilingual-0-1-0",
      );
      assert.equal(repository.writes.length, 3);
      assert.deepEqual(repository.writes[1], [
        { kind: "replace-file", path: ".egeria/migrations.jsonl" },
      ]);
      assert.deepEqual(repository.writes[2], [
        { kind: "replace-file", path: ".egeria/state.json" },
      ]);
      const project = core.parseProjectYaml(
        repository.files.get(".egeria/project.yaml"),
      );
      const state = core.parseStateJson(repository.files.get(".egeria/state.json"));
      assert.equal(project.ok, true);
      assert.equal(state.ok, true);
      assert.equal(project.value.selectedCapabilities.includes(capability), false);
      const survivor = capability === "booking-calendly"
        ? "multilingual"
        : "booking-calendly";
      assert.equal(project.value.selectedCapabilities.includes(survivor), true);
      assert.equal(
        state.value.installedCapabilities.some(
          ({ identifier }) => identifier === survivor,
        ),
        true,
      );
      if (capability === "booking-calendly") {
        assert.match(
          repository.files.get(
            "apps/web/src/integrations/booking/localized-booking.tsx",
          ),
          /return null/u,
        );
      } else {
        assert.equal(
          repository.files.has("apps/web/content/fr-CA/localized-content.yaml"),
          false,
        );
        assert.equal(
          repository.files.has(
            "apps/web/src/integrations/booking-calendly/calendly-booking.tsx",
          ),
          true,
        );
      }
    }
  }
});

test("analytics removal restores the multilingual layout and persists fresh discovery", async () => {
  const repository = createRepository(
    await installedEntries("site", {
      booking: false,
      multilingual: true,
      analytics: true,
      appliedMigrations: [
        "add-multilingual-0-1-0",
        "add-analytics-0-1-0",
      ],
    }),
  );
  const { plan, result, verifierCalls } = await runApply(repository, {
    capability: "analytics",
  });

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(result.value.capability, {
    identifier: "analytics",
    version: "0.1.0",
  });
  assert.equal(result.value.migration, "remove-analytics-0-1-0");
  assert.deepEqual(verifierCalls, [root]);
  assert.deepEqual(
    result.value.changedPaths,
    [
      ...plan.actions.flatMap((action) =>
        action.kind === "preserve-file-and-eject" ? [] : [action.path],
      ),
      ".egeria/migrations.jsonl",
      ".egeria/state.json",
    ].sort(compareText),
  );

  const project = core.parseProjectYaml(
    repository.files.get(".egeria/project.yaml"),
  );
  const state = core.parseStateJson(repository.files.get(".egeria/state.json"));
  assert.equal(project.ok, true);
  assert.equal(state.ok, true);
  assert.equal(project.value.selectedCapabilities.includes("analytics"), false);
  assert.equal(project.value.selectedCapabilities.includes("multilingual"), true);
  assert.equal(project.value.capabilitySettings.analytics, undefined);
  assert.equal(
    state.value.installedCapabilities.some(
      ({ identifier }) => identifier === "analytics",
    ),
    false,
  );
  assert.equal(
    state.value.installedCapabilities.some(
      ({ identifier }) => identifier === "multilingual",
    ),
    true,
  );
  assert.equal(state.value.appliedMigrations.at(-1), "remove-analytics-0-1-0");
  assert.equal(
    repository.files.has(
      "apps/web/src/integrations/analytics/analytics-runtime.ts",
    ),
    false,
  );
  assert.doesNotMatch(
    repository.files.get("apps/web/app/layout.tsx"),
    /AnalyticsConsent/u,
  );
});

test("analytics removal can be re-added with exact repaired surfaces and ordered history", async () => {
  const repairedPaths = [
    "apps/web/src/integrations/analytics/analytics-consent-state.ts",
    "apps/web/tests/unit/analytics-consent-state.test.ts",
    "apps/web/tests/unit/analytics-runtime.test.ts",
  ];
  const initialEntries = await installedEntries("site", {
    booking: false,
    multilingual: true,
    analytics: true,
    appliedMigrations: [
      "add-multilingual-0-1-0",
      "add-analytics-0-1-0",
    ],
  });
  const initialState = core.parseStateJson(initialEntries.get(".egeria/state.json"));
  assert.equal(initialState.ok, true, JSON.stringify(initialState.issues));
  const repository = createRepository(initialEntries);

  const removal = await runApply(repository, { capability: "analytics" });
  assert.equal(removal.result.ok, true, JSON.stringify(removal.result));
  const removedState = core.parseStateJson(
    repository.files.get(".egeria/state.json"),
  );
  assert.equal(removedState.ok, true, JSON.stringify(removedState.issues));
  assert.deepEqual(removedState.value.appliedMigrations, [
    "add-multilingual-0-1-0",
    "add-analytics-0-1-0",
    "remove-analytics-0-1-0",
  ]);
  assert.equal(
    removedState.value.installedCapabilities.some(
      ({ identifier }) => identifier === "analytics",
    ),
    false,
  );

  const readdition = await runAddition(repository);
  assert.equal(readdition.result.ok, true, JSON.stringify(readdition.result));
  assert.deepEqual(readdition.verifierCalls, [root]);
  assert.deepEqual(
    readdition.result.value.changedPaths,
    [
      ...readdition.plan.actions.map(({ path }) => path),
      ".egeria/migrations.jsonl",
      ".egeria/state.json",
    ].sort(compareText),
  );
  assert.deepEqual(
    repairedPaths.filter((path) => repository.files.has(path)),
    repairedPaths,
  );

  const readdedProject = core.parseProjectYaml(
    repository.files.get(".egeria/project.yaml"),
  );
  const readdedState = core.parseStateJson(
    repository.files.get(".egeria/state.json"),
  );
  const readdedMigrations = core.parseMigrationLog(
    repository.files.get(".egeria/migrations.jsonl"),
  );
  assert.equal(readdedProject.ok, true, JSON.stringify(readdedProject.issues));
  assert.equal(readdedState.ok, true, JSON.stringify(readdedState.issues));
  assert.equal(
    readdedMigrations.ok,
    true,
    JSON.stringify(readdedMigrations.issues),
  );
  const expectedMigrationHistory = [
    "add-multilingual-0-1-0",
    "add-analytics-0-1-0",
    "remove-analytics-0-1-0",
    "add-analytics-0-1-0",
  ];
  assert.deepEqual(readdedState.value.appliedMigrations, expectedMigrationHistory);
  assert.deepEqual(
    readdedMigrations.value.map(({ identifier }) => identifier),
    expectedMigrationHistory,
  );
  assert.deepEqual(readdedProject.value.capabilitySettings.analytics, analyticsSettings);
  assert.equal(readdedProject.value.selectedCapabilities.includes("analytics"), true);
  assert.deepEqual(
    readdedState.value.installedCapabilities,
    initialState.value.installedCapabilities,
  );
  assert.deepEqual(
    readdedState.value.managedSurfaces.filter(
      ({ owner }) => owner.identifier === "analytics",
    ),
    initialState.value.managedSurfaces.filter(
      ({ owner }) => owner.identifier === "analytics",
    ),
  );

  const catalog = core.createVerifiedCapabilityCatalog();
  assert.equal(catalog.ok, true, JSON.stringify(catalog.issues));
  const inference = await core.inferRepository({
    reader: repository.reader,
    catalog: catalog.value,
  });
  assert.equal(inference.state.kind, "valid");
  assert.equal(
    inference.capabilities.find(({ identifier }) => identifier === "analytics")
      ?.category,
    "confirmed",
  );
});

test("multilingual removal preserves a modified locale catalog as an explicit ejection", async () => {
  const entries = await installedEntries("portfolio", {
    booking: false,
    multilingual: true,
  });
  const preservedPath = "apps/web/content/fr-CA/localized-content.yaml";
  const customized = `${entries.get(preservedPath)}# reviewed application translation\n`;
  entries.set(preservedPath, customized);
  const repository = createRepository(entries);
  const { plan, result } = await runApply(repository, {
    capability: "multilingual",
  });

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(result.value.preservedPaths, [preservedPath]);
  assert.equal(
    plan.actions.some(
      ({ kind, path }) =>
        kind === "preserve-file-and-eject" && path === preservedPath,
    ),
    true,
  );
  assert.equal(repository.files.get(preservedPath), customized);
  const project = core.parseProjectYaml(repository.files.get(".egeria/project.yaml"));
  const state = core.parseStateJson(repository.files.get(".egeria/state.json"));
  assert.equal(project.ok, true);
  assert.equal(state.ok, true);
  assert.deepEqual(project.value.ejectedAreas, [preservedPath]);
  assert.equal(
    state.value.managedSurfaces.find(({ path }) => path === preservedPath)
      ?.ownership,
    "ejected",
  );
});

test("multilingual removal refuses absent, stale-plan, and drifted repositories without persistence", async () => {
  const removedRepository = createRepository(
    await installedEntries("portfolio", {
      booking: false,
      multilingual: true,
    }),
  );
  const removed = await runApply(removedRepository, {
    capability: "multilingual",
  });
  assert.equal(removed.result.ok, true, JSON.stringify(removed.result));
  const removedBefore = snapshot(removedRepository.files);
  const removedWrites = removedRepository.writes.length;
  const repeatedVerifierCalls = [];
  const repeated = await core.applyCapabilityRemoval({
    root,
    capability: "multilingual",
    approvedPlanFingerprint: removed.plan.planFingerprint,
    reader: removedRepository.reader,
    writer: removedRepository.writer,
    verifier: successfulVerifier(repeatedVerifierCalls),
    inspectWorktree: () => Promise.resolve(git),
    inspectExpectedChanges: () => Promise.resolve({ ok: true }),
  });
  assert.deepEqual(repeated, {
    ok: false,
    code: "CAPABILITY_NOT_INSTALLED",
    phase: "precondition",
    recovery: "not-required",
  });
  assert.equal(removedRepository.writes.length, removedWrites);
  assert.deepEqual(repeatedVerifierCalls, []);
  assert.equal(snapshot(removedRepository.files), removedBefore);

  const staleRepository = createRepository(
    await installedEntries("portfolio", {
      booking: false,
      multilingual: true,
    }),
  );
  const staleBefore = snapshot(staleRepository.files);
  const stale = await runApply(staleRepository, {
    capability: "multilingual",
    approvedPlanFingerprint: `sha256:${"0".repeat(64)}`,
  });
  assert.deepEqual(stale.result, {
    ok: false,
    code: "CAPABILITY_PLAN_APPROVAL_INVALID",
    phase: "precondition",
    recovery: "not-required",
  });
  assert.deepEqual(staleRepository.writes, []);
  assert.equal(snapshot(staleRepository.files), staleBefore);

  const driftedEntries = await installedEntries("portfolio", {
    booking: false,
    multilingual: true,
  });
  driftedEntries.set("apps/web/src/i18n/locale.ts", "private managed drift\n");
  const driftedRepository = createRepository(driftedEntries);
  const driftedBefore = snapshot(driftedRepository.files);
  const drifted = await core.applyCapabilityRemoval({
    root,
    capability: "multilingual",
    approvedPlanFingerprint: `sha256:${"0".repeat(64)}`,
    reader: driftedRepository.reader,
    writer: driftedRepository.writer,
    verifier: successfulVerifier([]),
    inspectWorktree: () => Promise.resolve(git),
    inspectExpectedChanges: () => Promise.resolve({ ok: true }),
  });
  assert.deepEqual(drifted, {
    ok: false,
    code: "PROJECT_DRIFT_DETECTED",
    phase: "precondition",
    recovery: "not-required",
  });
  assert.deepEqual(driftedRepository.writes, []);
  assert.equal(snapshot(driftedRepository.files), driftedBefore);
});

test("multilingual removal retains inspectable transform and verification failure prefixes", async () => {
  const entries = await installedEntries("portfolio", {
    booking: false,
    multilingual: true,
  });
  const partialRepository = createRepository(entries);
  const partialBefore = snapshot(partialRepository.files);
  partialRepository.writer.write = async (changes) => {
    const first = changes[0];
    assert.ok(first);
    if (first.kind === "delete-file") {
      partialRepository.files.delete(first.path);
    } else {
      partialRepository.files.set(first.path, decoder.decode(first.content));
    }
    return { ok: false, sourceChanged: true };
  };
  const partial = await runApply(partialRepository, {
    capability: "multilingual",
  });
  assert.deepEqual(partial.result, {
    ok: false,
    code: "CAPABILITY_TRANSFORM_FAILED",
    phase: "transform",
    recovery: "inspect-worktree",
  });
  assert.notEqual(snapshot(partialRepository.files), partialBefore);
  assert.equal(
    partialRepository.files.get(".egeria/state.json"),
    entries.get(".egeria/state.json"),
  );
  assert.equal(
    partialRepository.files.get(".egeria/migrations.jsonl"),
    entries.get(".egeria/migrations.jsonl"),
  );

  const verificationRepository = createRepository(entries);
  const verification = await runApply(verificationRepository, {
    capability: "multilingual",
    verifier: {
      prepareLockfile() {
        throw new Error("not used");
      },
      verifyInIsolatedCopy() {
        return Promise.resolve({ ok: false, issues: [] });
      },
    },
  });
  assert.deepEqual(verification.result, {
    ok: false,
    code: "CAPABILITY_VERIFICATION_FAILED",
    phase: "verify",
    recovery: "inspect-worktree",
  });
  assert.equal(verificationRepository.writes.length, 1);
  assert.equal(
    verificationRepository.files.get(".egeria/state.json"),
    entries.get(".egeria/state.json"),
  );
  assert.equal(
    verificationRepository.files.get(".egeria/migrations.jsonl"),
    entries.get(".egeria/migrations.jsonl"),
  );
});

test("multilingual removal refuses changed final bytes after persistence", async () => {
  const repository = createRepository(
    await installedEntries("portfolio", {
      booking: false,
      multilingual: true,
    }),
  );
  const result = await runApply(repository, {
    capability: "multilingual",
    inspectExpectedChanges: () => {
      repository.files.set(
        "apps/web/src/i18n/locale.ts",
        "concurrent final file\n",
      );
      return Promise.resolve({ ok: true });
    },
  });
  assert.deepEqual(result.result, {
    ok: false,
    code: "CAPABILITY_POST_STATE_FAILED",
    phase: "post-state",
    recovery: "inspect-worktree",
  });
  assert.equal(repository.writes.length, 3);
});

function snapshot(entries) {
  return JSON.stringify(
    [...entries].sort(([left], [right]) => compareText(left, right)),
  );
}

function preserveModifiedAndEjectedSurfaces(entries) {
  const modifiedPath = "apps/web/content/en-CA/booking-calendly.yaml";
  const ejectedPath =
    "apps/web/src/integrations/booking-calendly/booking-content.ts";
  const modifiedContent = `${entries.get(modifiedPath)}\n# application change\n`;
  entries.set(modifiedPath, modifiedContent);

  const project = core.parseProjectYaml(entries.get(".egeria/project.yaml"));
  const state = core.parseStateJson(entries.get(".egeria/state.json"));
  assert.equal(project.ok, true);
  assert.equal(state.ok, true);
  const nextProject = {
    ...project.value,
    ejectedAreas: [ejectedPath],
  };
  const projectSource = core.serializeProjectYaml(nextProject);
  entries.set(".egeria/project.yaml", projectSource);
  const nextState = {
    ...state.value,
    managedSurfaces: state.value.managedSurfaces.map((surface) =>
      surface.path === ejectedPath
        ? { ...surface, ownership: "ejected" }
        : surface.identifier === "builder-project-configuration"
          ? {
              ...surface,
              fingerprint: core.fingerprintFileContent(
                encoder.encode(projectSource),
              ),
            }
          : surface,
    ),
    ejections: [ejectedPath],
  };
  entries.set(".egeria/state.json", core.serializeStateJson(nextState));
  return { ejectedPath, modifiedContent, modifiedPath };
}

test("capability removal preserves modified and already-ejected application surfaces", async () => {
  const entries = await installedEntries("portfolio");
  const { ejectedPath, modifiedContent, modifiedPath } =
    preserveModifiedAndEjectedSurfaces(entries);
  const ejectedContent = entries.get(ejectedPath);
  const repository = createRepository(entries);
  const plan = await approvedPlan(repository.reader);
  const expected = await expectedSuccessfulArtifacts(entries, plan);
  const { result } = await runApply(repository);

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(result.value.preservedPaths, [ejectedPath, modifiedPath].sort());
  assert.equal(repository.files.get(modifiedPath), modifiedContent);
  assert.equal(repository.files.get(ejectedPath), ejectedContent);
  assert.equal(repository.files.get(".egeria/project.yaml"), expected.projectSource);
  assert.equal(repository.files.get(".egeria/migrations.jsonl"), expected.migrationSource);
  assert.equal(repository.files.get(".egeria/state.json"), expected.stateSource);
  assert.equal(
    repository.files.has(
      "apps/web/src/integrations/booking-calendly/booking-settings.ts",
    ),
    false,
  );
  assert.equal(
    repository.files.has(
      "apps/web/src/integrations/booking-calendly/calendly-booking.tsx",
    ),
    false,
  );
  const state = core.parseStateJson(expected.stateSource);
  const project = core.parseProjectYaml(expected.projectSource);
  assert.equal(state.ok, true);
  assert.equal(project.ok, true);
  assert.deepEqual(state.value.ejections, result.value.preservedPaths);
  assert.deepEqual(project.value.ejectedAreas, result.value.preservedPaths);
  assert.deepEqual(
    state.value.managedSurfaces
      .filter(({ path }) => result.value.preservedPaths.includes(path))
      .map(({ ownership }) => ownership),
    ["ejected", "ejected"],
  );
});

test("repeat capability removal refuses without mutating the persisted removed repository", async () => {
  const entries = await installedEntries("site");
  const repository = createRepository(entries);
  const initialPlan = await approvedPlan(repository.reader);
  const expected = await expectedSuccessfulArtifacts(entries, initialPlan);
  const first = await runApply(repository);
  assert.equal(first.result.ok, true, JSON.stringify(first.result));
  const beforeRepeat = snapshot(repository.files);
  const writesBeforeRepeat = repository.writes.length;
  const verifierCalls = [];
  const finalDiffCalls = [];

  const repeated = await core.applyCapabilityRemoval({
    root,
    capability: "booking-calendly",
    approvedPlanFingerprint: initialPlan.planFingerprint,
    reader: repository.reader,
    writer: repository.writer,
    verifier: successfulVerifier(verifierCalls),
    inspectWorktree: () => Promise.resolve(git),
    inspectExpectedChanges: (input) => {
      finalDiffCalls.push(input);
      return Promise.resolve({ ok: true });
    },
    now: () => completedAt,
  });

  assert.deepEqual(repeated, {
    ok: false,
    code: "CAPABILITY_NOT_INSTALLED",
    phase: "precondition",
    recovery: "not-required",
  });
  assert.equal(repository.writes.length, writesBeforeRepeat);
  assert.deepEqual(verifierCalls, []);
  assert.deepEqual(finalDiffCalls, []);
  assert.equal(snapshot(repository.files), beforeRepeat);
  assert.equal(repository.files.get(".egeria/project.yaml"), expected.projectSource);
  assert.equal(repository.files.get(".egeria/migrations.jsonl"), expected.migrationSource);
  assert.equal(repository.files.get(".egeria/state.json"), expected.stateSource);
});

test("capability removal refuses invalid roots, Git states, changed identity, and approval before writes", async () => {
  const entries = await installedEntries("portfolio");
  const baseRepository = createRepository(entries);
  const plan = await approvedPlan(baseRepository.reader);
  const cases = [
    {
      expectedCode: "GIT_WORKTREE_IDENTITY_INVALID",
      overrides: { root: "relative/project" },
    },
    ...[
      "GIT_WORKTREE_NOT_ISOLATED",
      "GIT_BRANCH_REQUIRED",
      "GIT_WORKTREE_DIRTY",
      "GIT_OPERATION_IN_PROGRESS",
      "GIT_WORKTREE_CONFLICTED",
    ].map((code) => ({
      expectedCode: code,
      overrides: {
        inspectWorktree: () => Promise.resolve({ ok: false, code }),
      },
    })),
    {
      expectedCode: "CAPABILITY_PLAN_APPROVAL_INVALID",
      overrides: { approvedPlanFingerprint: `sha256:${"0".repeat(64)}` },
    },
    {
      expectedCode: "GIT_WORKTREE_CHANGED",
      overrides: {
        inspectWorktree: (() => {
          let calls = 0;
          return () => {
            calls += 1;
            return Promise.resolve(
              calls === 1
                ? git
                : {
                    ok: true,
                    identity: { ...git.identity, revision: "1".repeat(40) },
                  },
            );
          };
        })(),
      },
    },
  ];

  for (const { expectedCode, overrides } of cases) {
    const repository = createRepository(entries);
    const before = snapshot(repository.files);
    const verifierCalls = [];
    const finalDiffCalls = [];
    const result = await core.applyCapabilityRemoval({
      root: overrides.root ?? root,
      capability: "booking-calendly",
      approvedPlanFingerprint:
        overrides.approvedPlanFingerprint ?? plan.planFingerprint,
      reader: repository.reader,
      writer: repository.writer,
      verifier: successfulVerifier(verifierCalls),
      inspectWorktree: overrides.inspectWorktree ?? (() => Promise.resolve(git)),
      inspectExpectedChanges: (input) => {
        finalDiffCalls.push(input);
        return Promise.resolve({ ok: true });
      },
      inspectRepositoryInventory: inspectEmptyRepositoryInventory,
      now: () => completedAt,
    });
    assert.deepEqual(result, {
      ok: false,
      code: expectedCode,
      phase: "precondition",
      recovery: "not-required",
    });
    assert.equal(snapshot(repository.files), before);
    assert.deepEqual(repository.writes, []);
    assert.deepEqual(verifierCalls, []);
    assert.deepEqual(finalDiffCalls, []);
  }
});

test("capability removal refuses invalid controls, ejection disagreement, drift, and unsupported capability", async () => {
  const original = await installedEntries("portfolio");
  const cases = [];

  const invalidControls = new Map(original);
  invalidControls.set(".egeria/state.json", "{}\n");
  cases.push({ entries: invalidControls, code: "PROJECT_INSPECTION_INVALID" });

  const invalidEjections = new Map(original);
  const invalidProject = core.parseProjectYaml(
    invalidEjections.get(".egeria/project.yaml"),
  );
  assert.equal(invalidProject.ok, true);
  invalidEjections.set(
    ".egeria/project.yaml",
    core.serializeProjectYaml({
      ...invalidProject.value,
      ejectedAreas: ["apps/web/content/en-CA/booking-calendly.yaml"],
    }),
  );
  cases.push({ entries: invalidEjections, code: "PROJECT_EJECTION_INVALID" });

  const drifted = new Map(original);
  drifted.set(
    "apps/web/src/integrations/booking-calendly/booking-settings.ts",
    "drifted\n",
  );
  cases.push({ entries: drifted, code: "PROJECT_DRIFT_DETECTED" });

  for (const testCase of cases) {
    const repository = createRepository(testCase.entries);
    const before = snapshot(repository.files);
    const result = await core.applyCapabilityRemoval({
      root,
      capability: "booking-calendly",
      approvedPlanFingerprint: `sha256:${"0".repeat(64)}`,
      reader: repository.reader,
      writer: repository.writer,
      verifier: successfulVerifier([]),
      inspectWorktree: () => Promise.resolve(git),
      inspectExpectedChanges: () => Promise.resolve({ ok: true }),
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, testCase.code);
    assert.equal(result.phase, "precondition");
    assert.equal(result.recovery, "not-required");
    assert.equal(snapshot(repository.files), before);
    assert.deepEqual(repository.writes, []);
  }

  const unsupportedRepository = createRepository(original);
  const unsupported = await core.applyCapabilityRemoval({
    root,
    capability: "invented-capability",
    approvedPlanFingerprint: `sha256:${"0".repeat(64)}`,
    reader: unsupportedRepository.reader,
    writer: unsupportedRepository.writer,
    verifier: successfulVerifier([]),
    inspectWorktree: () => Promise.resolve(git),
    inspectExpectedChanges: () => Promise.resolve({ ok: true }),
  });
  assert.deepEqual(unsupported, {
    ok: false,
    code: "CAPABILITY_REMOVAL_UNSUPPORTED",
    phase: "precondition",
    recovery: "not-required",
  });
  assert.deepEqual(unsupportedRepository.writes, []);
});

test("capability removal reports no-mutation and retained-prefix transformation failures", async () => {
  const entries = await installedEntries("portfolio");

  const unchangedRepository = createRepository(entries, { failBatch: 1 });
  const unchangedBefore = snapshot(unchangedRepository.files);
  const unchanged = await runApply(unchangedRepository);
  assert.deepEqual(unchanged.result, {
    ok: false,
    code: "CAPABILITY_TRANSFORM_FAILED",
    phase: "transform",
    recovery: "not-required",
  });
  assert.equal(snapshot(unchangedRepository.files), unchangedBefore);
  assert.deepEqual(unchanged.verifierCalls, []);
  assert.deepEqual(unchanged.expectedInspections, []);

  const partialRepository = createRepository(entries);
  const partialPlan = await approvedPlan(partialRepository.reader);
  const firstAction = partialPlan.actions[0];
  const originalWriter = partialRepository.writer.write;
  partialRepository.writer.write = async (changes) => {
    const first = changes[0];
    assert.ok(first);
    if (first.kind === "delete-file") {
      partialRepository.files.delete(first.path);
    } else {
      partialRepository.files.set(first.path, decoder.decode(first.content));
    }
    return { ok: false, sourceChanged: true };
  };
  const partial = await runApply(partialRepository);
  assert.deepEqual(partial.result, {
    ok: false,
    code: "CAPABILITY_TRANSFORM_FAILED",
    phase: "transform",
    recovery: "inspect-worktree",
  });
  assert.notEqual(
    partialRepository.files.get(firstAction.path),
    entries.get(firstAction.path),
  );
  for (const action of partialPlan.actions.slice(1)) {
    assert.equal(partialRepository.files.get(action.path), entries.get(action.path));
  }
  assert.deepEqual(partial.verifierCalls, []);
  assert.deepEqual(partial.expectedInspections, []);
  partialRepository.writer.write = originalWriter;

  const thrownRepository = createRepository(entries);
  const thrownPlan = await approvedPlan(thrownRepository.reader);
  thrownRepository.writer.write = async (changes) => {
    const first = changes[0];
    assert.ok(first);
    if (first.kind === "delete-file") {
      thrownRepository.files.delete(first.path);
    } else {
      thrownRepository.files.set(first.path, decoder.decode(first.content));
    }
    throw new Error("private transformation failure");
  };
  const thrown = await runApply(thrownRepository);
  assert.deepEqual(thrown.result, {
    ok: false,
    code: "CAPABILITY_TRANSFORM_FAILED",
    phase: "transform",
    recovery: "inspect-worktree",
  });
  assert.notEqual(
    thrownRepository.files.get(thrownPlan.actions[0].path),
    entries.get(thrownPlan.actions[0].path),
  );
});

test("capability removal retains transformed source and old receipts on verification and re-inference failures", async () => {
  const entries = await installedEntries("portfolio");
  const oldState = entries.get(".egeria/state.json");
  const oldMigrations = entries.get(".egeria/migrations.jsonl");

  const verificationRepository = createRepository(entries);
  const verificationPlan = await approvedPlan(verificationRepository.reader);
  const verificationExpected = await expectedSuccessfulArtifacts(
    entries,
    verificationPlan,
  );
  const verification = await runApply(verificationRepository, {
    verifier: {
      prepareLockfile() {
        throw new Error("not used");
      },
      verifyInIsolatedCopy() {
        return Promise.resolve({ ok: false, issues: [] });
      },
    },
  });
  assert.deepEqual(verification.result, {
    ok: false,
    code: "CAPABILITY_VERIFICATION_FAILED",
    phase: "verify",
    recovery: "inspect-worktree",
  });
  assert.equal(
    verificationRepository.files.get(".egeria/project.yaml"),
    verificationExpected.projectSource,
  );
  assert.equal(verificationRepository.files.get(".egeria/state.json"), oldState);
  assert.equal(
    verificationRepository.files.get(".egeria/migrations.jsonl"),
    oldMigrations,
  );
  assert.equal(verificationRepository.writes.length, 1);

  const inferenceRepository = createRepository(entries);
  const inferencePlan = await approvedPlan(inferenceRepository.reader);
  const driftPath = inferencePlan.actions.find(
    ({ kind }) => kind === "replace-file",
  ).path;
  const inference = await runApply(inferenceRepository, {
    verifier: {
      prepareLockfile() {
        throw new Error("not used");
      },
      verifyInIsolatedCopy() {
        inferenceRepository.files.set(driftPath, "concurrent edit\n");
        return Promise.resolve({
          ok: true,
          value: { checks: core.ordinaryGenerationVerificationChecks },
        });
      },
    },
  });
  assert.deepEqual(inference.result, {
    ok: false,
    code: "CAPABILITY_REINFERENCE_FAILED",
    phase: "re-infer",
    recovery: "inspect-worktree",
  });
  assert.equal(inferenceRepository.files.get(".egeria/state.json"), oldState);
  assert.equal(inferenceRepository.files.get(".egeria/migrations.jsonl"), oldMigrations);
  assert.equal(inferenceRepository.files.get(driftPath), "concurrent edit\n");
  assert.equal(inferenceRepository.writes.length, 1);
});

test("capability removal rejects incomplete, reordered, and extra verification receipts", async () => {
  const entries = await installedEntries("portfolio");
  const oldState = entries.get(".egeria/state.json");
  const oldMigrations = entries.get(".egeria/migrations.jsonl");
  const checks = core.ordinaryGenerationVerificationChecks;
  const invalidChecks = [
    checks.slice(0, -1),
    [checks[1], checks[0], ...checks.slice(2)],
    [...checks, checks[0]],
  ];

  for (const receivedChecks of invalidChecks) {
    const repository = createRepository(entries);
    const result = await runApply(repository, {
      verifier: {
        prepareLockfile() {
          throw new Error("not used");
        },
        verifyInIsolatedCopy() {
          return Promise.resolve({
            ok: true,
            value: { checks: receivedChecks },
          });
        },
      },
    });

    assert.deepEqual(result.result, {
      ok: false,
      code: "CAPABILITY_VERIFICATION_FAILED",
      phase: "verify",
      recovery: "inspect-worktree",
    });
    assert.equal(repository.writes.length, 1);
    assert.equal(repository.files.get(".egeria/state.json"), oldState);
    assert.equal(
      repository.files.get(".egeria/migrations.jsonl"),
      oldMigrations,
    );
    assert.deepEqual(result.expectedInspections, []);
  }
});

test("capability removal preserves exact persistence prefixes across migration and state failures", async () => {
  const entries = await installedEntries("site");
  const planRepository = createRepository(entries);
  const plan = await approvedPlan(planRepository.reader);
  const expected = await expectedSuccessfulArtifacts(entries, plan);
  const oldState = entries.get(".egeria/state.json");
  const oldMigrations = entries.get(".egeria/migrations.jsonl");

  const invalidClockRepository = createRepository(entries);
  const invalidClock = await runApply(invalidClockRepository, {
    now: () => "not-a-time",
  });
  assert.deepEqual(invalidClock.result, {
    ok: false,
    code: "CAPABILITY_MIGRATION_RECORD_INVALID",
    phase: "re-infer",
    recovery: "inspect-worktree",
  });
  assert.equal(invalidClockRepository.files.get(".egeria/state.json"), oldState);
  assert.equal(invalidClockRepository.files.get(".egeria/migrations.jsonl"), oldMigrations);
  assert.equal(invalidClockRepository.files.get(".egeria/project.yaml"), expected.projectSource);

  const migrationRepository = createRepository(entries, { failBatch: 2 });
  const migrationFailure = await runApply(migrationRepository);
  assert.deepEqual(migrationFailure.result, {
    ok: false,
    code: "CAPABILITY_MIGRATION_WRITE_FAILED",
    phase: "persist-migration",
    recovery: "inspect-worktree",
  });
  assert.equal(migrationRepository.files.get(".egeria/state.json"), oldState);
  assert.equal(migrationRepository.files.get(".egeria/migrations.jsonl"), oldMigrations);
  assert.equal(migrationRepository.files.get(".egeria/project.yaml"), expected.projectSource);

  const uncertainRepository = createRepository(entries);
  const uncertainWrite = uncertainRepository.writer.write;
  let uncertainBatch = 0;
  uncertainRepository.writer.write = async (changes) => {
    uncertainBatch += 1;
    if (uncertainBatch === 2) {
      uncertainRepository.files.set(
        ".egeria/migrations.jsonl",
        "uncertain prefix\n",
      );
      return { ok: false, sourceChanged: true };
    }
    return uncertainWrite(changes);
  };
  const uncertainFailure = await runApply(uncertainRepository);
  assert.deepEqual(uncertainFailure.result, {
    ok: false,
    code: "CAPABILITY_MIGRATION_WRITE_FAILED",
    phase: "persist-migration",
    recovery: "inspect-worktree",
  });
  assert.equal(uncertainRepository.files.get(".egeria/state.json"), oldState);
  assert.equal(
    uncertainRepository.files.get(".egeria/migrations.jsonl"),
    "uncertain prefix\n",
  );

  const corruptMigrationRepository = createRepository(entries, {
    afterWrite({ batch, files }) {
      if (batch === 2) {
        files.set(".egeria/migrations.jsonl", "corrupt migration prefix\n");
      }
    },
  });
  const corruptMigration = await runApply(corruptMigrationRepository);
  assert.deepEqual(corruptMigration.result, {
    ok: false,
    code: "CAPABILITY_MIGRATION_WRITE_FAILED",
    phase: "persist-migration",
    recovery: "inspect-worktree",
  });
  assert.equal(corruptMigrationRepository.writes.length, 2);
  assert.deepEqual(corruptMigrationRepository.writes[1], [
    { kind: "replace-file", path: ".egeria/migrations.jsonl" },
  ]);
  assert.equal(corruptMigrationRepository.files.get(".egeria/state.json"), oldState);
  assert.equal(
    corruptMigrationRepository.files.get(".egeria/migrations.jsonl"),
    "corrupt migration prefix\n",
  );
  assert.equal(
    corruptMigrationRepository.files.get(".egeria/project.yaml"),
    expected.projectSource,
  );

  const stateRepository = createRepository(entries, { failBatch: 3 });
  const stateFailure = await runApply(stateRepository);
  assert.deepEqual(stateFailure.result, {
    ok: false,
    code: "CAPABILITY_STATE_WRITE_FAILED",
    phase: "persist-state",
    recovery: "inspect-worktree",
  });
  assert.equal(stateRepository.files.get(".egeria/state.json"), oldState);
  assert.equal(stateRepository.files.get(".egeria/migrations.jsonl"), expected.migrationSource);
  assert.equal(stateRepository.files.get(".egeria/project.yaml"), expected.projectSource);
});

test("capability removal retains persisted receipts on post-state, final-diff, and final-byte failures", async () => {
  const entries = await installedEntries("portfolio");
  const planRepository = createRepository(entries);
  const plan = await approvedPlan(planRepository.reader);
  const expected = await expectedSuccessfulArtifacts(entries, plan);

  const postStateRepository = createRepository(entries, {
    afterWrite({ batch, files }) {
      if (batch === 3) {
        files.set(
          ".egeria/migrations.jsonl",
          files
            .get(".egeria/migrations.jsonl")
            .replace(completedAt, "2026-08-22T15:00:00.001Z"),
        );
      }
    },
  });
  const postState = await runApply(postStateRepository);
  assert.deepEqual(postState.result, {
    ok: false,
    code: "CAPABILITY_POST_STATE_FAILED",
    phase: "post-state",
    recovery: "inspect-worktree",
  });
  assert.equal(postStateRepository.files.get(".egeria/state.json"), expected.stateSource);
  assert.notEqual(postStateRepository.files.get(".egeria/migrations.jsonl"), expected.migrationSource);

  const diffRepository = createRepository(entries);
  const diffFailure = await runApply(diffRepository, {
    inspectExpectedChanges: () =>
      Promise.resolve({ ok: false, code: "GIT_WORKTREE_CHANGED" }),
  });
  assert.deepEqual(diffFailure.result, {
    ok: false,
    code: "GIT_WORKTREE_CHANGED",
    phase: "final-diff",
    recovery: "inspect-worktree",
  });
  assert.equal(diffRepository.files.get(".egeria/project.yaml"), expected.projectSource);
  assert.equal(diffRepository.files.get(".egeria/migrations.jsonl"), expected.migrationSource);
  assert.equal(diffRepository.files.get(".egeria/state.json"), expected.stateSource);

  const raceRepository = createRepository(entries);
  const deletedPath = plan.actions.find(({ kind }) => kind === "delete-file").path;
  const raceFailure = await runApply(raceRepository, {
    inspectExpectedChanges: () => {
      raceRepository.files.set(deletedPath, "concurrent final file\n");
      return Promise.resolve({ ok: true });
    },
  });
  assert.deepEqual(raceFailure.result, {
    ok: false,
    code: "CAPABILITY_POST_STATE_FAILED",
    phase: "post-state",
    recovery: "inspect-worktree",
  });
  assert.equal(raceRepository.files.get(".egeria/project.yaml"), expected.projectSource);
  assert.equal(raceRepository.files.get(".egeria/migrations.jsonl"), expected.migrationSource);
  assert.equal(raceRepository.files.get(".egeria/state.json"), expected.stateSource);
  assert.equal(raceRepository.files.get(deletedPath), "concurrent final file\n");
});

test("analytics removal retains failure prefixes and final authority", async () => {
  const entries = await installedEntries("portfolio", {
    booking: false,
    analytics: true,
  });
  const oldState = entries.get(".egeria/state.json");
  const oldMigrations = entries.get(".egeria/migrations.jsonl");

  const unsafeRepository = createRepository(entries);
  const unsafeBefore = snapshot(unsafeRepository.files);
  const unsafe = await runApply(unsafeRepository, {
    capability: "analytics",
    root: "relative/project",
  });
  assert.deepEqual(unsafe.result, {
    ok: false,
    code: "GIT_WORKTREE_IDENTITY_INVALID",
    phase: "precondition",
    recovery: "not-required",
  }, "unsafe root refusal");
  assert.equal(snapshot(unsafeRepository.files), unsafeBefore);
  assert.deepEqual(unsafeRepository.writes, []);

  const partialRepository = createRepository(entries);
  const partialPlan = await approvedPlan(partialRepository.reader, "analytics");
  partialRepository.writer.write = async (changes) => {
    const first = changes[0];
    assert.ok(first);
    if (first.kind === "delete-file") {
      partialRepository.files.delete(first.path);
    } else {
      partialRepository.files.set(first.path, decoder.decode(first.content));
    }
    return { ok: false, sourceChanged: true };
  };
  const partial = await runApply(partialRepository, {
    capability: "analytics",
  });
  assert.deepEqual(partial.result, {
    ok: false,
    code: "CAPABILITY_TRANSFORM_FAILED",
    phase: "transform",
    recovery: "inspect-worktree",
  }, "partial transform failure");
  assert.notEqual(
    partialRepository.files.get(partialPlan.actions[0].path),
    entries.get(partialPlan.actions[0].path),
  );

  const verificationRepository = createRepository(entries);
  const verification = await runApply(verificationRepository, {
    capability: "analytics",
    verifier: {
      prepareLockfile() {
        throw new Error("not used");
      },
      verifyInIsolatedCopy() {
        return Promise.resolve({ ok: false, issues: [] });
      },
    },
  });
  assert.deepEqual(verification.result, {
    ok: false,
    code: "CAPABILITY_VERIFICATION_FAILED",
    phase: "verify",
    recovery: "inspect-worktree",
  }, "verification failure");
  assert.equal(verificationRepository.files.get(".egeria/state.json"), oldState);
  assert.equal(
    verificationRepository.files.get(".egeria/migrations.jsonl"),
    oldMigrations,
  );
  assert.equal(verificationRepository.writes.length, 1);

  const planRepository = createRepository(entries);
  const plan = await approvedPlan(planRepository.reader, "analytics");
  const expected = await expectedSuccessfulArtifacts(entries, plan, "analytics");
  const stateRepository = createRepository(entries, { failBatch: 3 });
  const stateFailure = await runApply(stateRepository, {
    capability: "analytics",
  });
  assert.deepEqual(stateFailure.result, {
    ok: false,
    code: "CAPABILITY_STATE_WRITE_FAILED",
    phase: "persist-state",
    recovery: "inspect-worktree",
  }, "state persistence failure");
  assert.equal(stateRepository.files.get(".egeria/state.json"), oldState);
  assert.equal(
    stateRepository.files.get(".egeria/migrations.jsonl"),
    expected.migrationSource,
  );

  const postStateRepository = createRepository(entries, {
    afterWrite({ batch, files }) {
      if (batch === 3) {
        files.set(
          ".egeria/migrations.jsonl",
          files
            .get(".egeria/migrations.jsonl")
            .replace(completedAt, "2026-08-22T15:00:00.001Z"),
        );
      }
    },
  });
  const postState = await runApply(postStateRepository, {
    capability: "analytics",
  });
  assert.deepEqual(postState.result, {
    ok: false,
    code: "CAPABILITY_POST_STATE_FAILED",
    phase: "post-state",
    recovery: "inspect-worktree",
  }, "post-state failure");
  assert.equal(
    postStateRepository.files.get(".egeria/state.json"),
    expected.stateSource,
  );

  const finalDiffRepository = createRepository(entries);
  const finalDiff = await runApply(finalDiffRepository, {
    capability: "analytics",
    inspectExpectedChanges: () =>
      Promise.resolve({ ok: false, code: "GIT_WORKTREE_CHANGED" }),
  });
  assert.deepEqual(finalDiff.result, {
    ok: false,
    code: "GIT_WORKTREE_CHANGED",
    phase: "final-diff",
    recovery: "inspect-worktree",
  }, "final diff refusal");
  assert.equal(
    finalDiffRepository.files.get(".egeria/state.json"),
    expected.stateSource,
  );

  const finalBytesRepository = createRepository(entries);
  const deletedPath = plan.actions.find(({ kind }) => kind === "delete-file").path;
  const finalBytes = await runApply(finalBytesRepository, {
    capability: "analytics",
    inspectExpectedChanges: () => {
      finalBytesRepository.files.set(deletedPath, "concurrent final file\n");
      return Promise.resolve({ ok: true });
    },
  });
  assert.deepEqual(finalBytes.result, {
    ok: false,
    code: "CAPABILITY_POST_STATE_FAILED",
    phase: "post-state",
    recovery: "inspect-worktree",
  }, "final byte refusal");
  assert.equal(finalBytesRepository.files.get(".egeria/state.json"), expected.stateSource);
  assert.equal(
    finalBytesRepository.files.get(deletedPath),
    "concurrent final file\n",
  );
});
