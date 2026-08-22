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
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const settings = Object.freeze({
  destination: "https://calendly.com/private/discovery",
  mode: "popup",
});
const git = Object.freeze({
  ok: true,
  identity: Object.freeze({
    root: "/generated/project",
    revision: "abcdef0123456789abcdef0123456789abcdef01",
    attachedRef: "refs/heads/transactional-change",
    gitDirectory: "/generated/common/.git/worktrees/transactional-change",
    commonDirectory: "/generated/common/.git",
  }),
});
const generationChecks = [
  "contracts",
  "pre-state-inference",
  ...core.ordinaryGenerationVerificationChecks,
  "post-state-inference",
];

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

async function loadTextEntries(root) {
  const entries = new Map();

  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolutePath = join(directory, entry.name);

      if (entry.isDirectory()) {
        await visit(absolutePath);
      } else if (entry.isFile()) {
        entries.set(
          relative(root, absolutePath).split(sep).join("/"),
          await readFile(absolutePath, "utf8"),
        );
      }
    }
  }

  await visit(root);
  return entries;
}

async function baseFixtureEntries(profile) {
  return loadTextEntries(resolve(repositoryRoot, `fixtures/generated/${profile}`));
}

async function installedEntries(profile, bookingSettings = settings) {
  const rendered = await core.renderSkeleton({
    profile,
    projectName: `${profile}-removal-test`,
    displayName: `${profile} removal test`,
    packageVersions: core.verifiedCapabilityPackageVersions,
    bookingCalendly: bookingSettings,
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
  const projectSource = core.serializeProjectYaml(rendered.value.project);
  byteFiles.set(".egeria/project.yaml", encoder.encode(projectSource));
  byteFiles.set(".egeria/migrations.jsonl", encoder.encode(""));

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
    appliedMigrations: [],
    managedSurfaces: surfaces.value,
    ejections: [],
    compatibility: {
      node: "22.23.2",
      pnpm: "11.20.0",
      platformAdapter: "cloudflare-workers",
    },
    lastSuccessfulVerification: {
      kind: "generation",
      checks: generationChecks,
    },
  };
  const stateSource = core.serializeStateJson(state);
  const entries = new Map(
    [...byteFiles].map(([path, content]) => {
      try {
        return [path, decoder.decode(content)];
      } catch {
        return [path, { kind: "error", code: "FILE_ENCODING_INVALID" }];
      }
    }),
  );
  entries.set(".egeria/state.json", stateSource);
  return entries;
}

function createSnapshotReader(entries, overrides = new Map()) {
  const files = new Map(entries);
  const fixedOverrides = new Map(overrides);
  const snapshot = () =>
    JSON.stringify({
      files: [...files].sort(([left], [right]) => compareText(left, right)),
      overrides: [...fixedOverrides].sort(([left], [right]) =>
        compareText(left, right),
      ),
    });

  return {
    reader: {
      async readText(path) {
        if (fixedOverrides.has(path)) {
          const value = fixedOverrides.get(path);

          if (value === "throw") {
            throw new Error("private reader failure detail");
          }

          return structuredClone(value);
        }

        const content = files.get(path);
        return content === undefined
          ? { kind: "missing" }
          : typeof content === "string"
            ? { kind: "file", content }
            : structuredClone(content);
      },
    },
    snapshot,
  };
}

async function planFromEntries(entries, options = {}) {
  const snapshotReader = createSnapshotReader(entries, options.overrides);
  const before = snapshotReader.snapshot();

  try {
    return await core.planCapabilityRemoval({
      reader: snapshotReader.reader,
      git: options.git ?? git,
      capability: options.capability ?? "booking-calendly",
    });
  } finally {
    assert.equal(snapshotReader.snapshot(), before);
  }
}

function assertFailure(result, code) {
  assert.equal(result.ok, false);
  assert.deepEqual(result.issues.map(({ code: issueCode }) => issueCode), [code]);
  assert.doesNotMatch(
    JSON.stringify(result),
    /private reader failure detail|calendly\.com|refs\/heads|\/generated\//u,
  );
}

function expectedActions(overrides = new Map()) {
  const actions = [
    {
      kind: "replace-project-configuration",
      path: ".egeria/project.yaml",
      ownership: "managed",
      owner: "builder-kernel",
    },
    {
      kind: "replace-file",
      path: "apps/web/app/page.tsx",
      ownership: "application-owned",
      owner: "builder-kernel",
    },
    {
      kind: "delete-file",
      path: "apps/web/content/en-CA/booking-calendly.yaml",
      ownership: "application-owned",
      owner: "booking-calendly",
    },
    {
      kind: "delete-file",
      path: "apps/web/src/integrations/booking-calendly/booking-content.ts",
      ownership: "application-owned",
      owner: "booking-calendly",
    },
    {
      kind: "delete-file",
      path: "apps/web/src/integrations/booking-calendly/booking-settings.ts",
      ownership: "managed",
      owner: "booking-calendly",
    },
    {
      kind: "delete-file",
      path: "apps/web/src/integrations/booking-calendly/calendly-booking.tsx",
      ownership: "application-owned",
      owner: "booking-calendly",
    },
    {
      kind: "delete-file",
      path: "apps/web/tests/e2e/calendly-booking.spec.ts",
      ownership: "application-owned",
      owner: "booking-calendly",
    },
  ].map((action) => overrides.get(action.path) ?? action);

  return actions.sort((left, right) => compareText(left.path, right.path));
}

function expectedPlan(
  profile,
  planFingerprint,
  currentCapabilities,
  actionOverrides,
  reviewRequirements = [
    {
      code: "review-surviving-references-to-removed-surfaces",
      scope: "repository",
    },
  ],
) {
  return {
    operation: "remove-capability",
    status: "approval-required",
    planFingerprint,
    baseRevision: git.identity.revision,
    profile,
    capability: { identifier: "booking-calendly", version: "0.1.0" },
    currentCapabilities,
    desiredCapabilities: currentCapabilities.filter(
      (identifier) => identifier !== "booking-calendly",
    ),
    actions: expectedActions(actionOverrides),
    reviewRequirements,
    requiredApprovals: ["transform", "verified-final-diff"],
    persistenceOrder: [
      "transform",
      "verify",
      "re-infer",
      "append-migration-record",
      "persist-state",
      "verify-state-and-inference",
    ],
  };
}

const expectedCurrentCapabilities = Object.freeze({
  portfolio: Object.freeze([
    "booking-calendly",
    "content-files",
    "deployment-cloudflare",
    "observability",
    "section-composition",
    "standards",
  ]),
  site: Object.freeze([
    "booking-calendly",
    "content-files",
    "deployment-cloudflare",
    "observability",
    "section-composition",
    "site-routing",
    "standards",
  ]),
});

function updateEjections(entries, paths) {
  const next = new Map(entries);
  const project = core.parseProjectYaml(next.get(".egeria/project.yaml"));
  const state = core.parseStateJson(next.get(".egeria/state.json"));
  assert.equal(project.ok, true);
  assert.equal(state.ok, true);
  const projectSource = core.serializeProjectYaml({
    ...project.value,
    ejectedAreas: paths,
  });
  const pathSet = new Set(paths);
  const managedSurfaces = state.value.managedSurfaces.map((surface) => {
    if (surface.identifier === "builder-project-configuration") {
      return {
        ...surface,
        fingerprint: core.fingerprintFileContent(encoder.encode(projectSource)),
      };
    }

    return pathSet.has(surface.path)
      ? { ...surface, ownership: "ejected" }
      : surface;
  });
  next.set(".egeria/project.yaml", projectSource);
  next.set(
    ".egeria/state.json",
    core.serializeStateJson({
      ...state.value,
      managedSurfaces,
      ejections: paths,
    }),
  );
  return next;
}

async function postRemovalEntriesWithEjection(path, surfaceOverrides = {}) {
  const base = await baseFixtureEntries("portfolio");
  const installed = await installedEntries("portfolio");
  const project = core.parseProjectYaml(base.get(".egeria/project.yaml"));
  const state = core.parseStateJson(base.get(".egeria/state.json"));
  const installedState = core.parseStateJson(
    installed.get(".egeria/state.json"),
  );
  assert.equal(project.ok, true);
  assert.equal(state.ok, true);
  assert.equal(installedState.ok, true);
  const preservedSurface = installedState.value.managedSurfaces.find(
    (surface) => surface.path === path,
  );
  assert.notEqual(preservedSurface, undefined);
  const projectSource = core.serializeProjectYaml({
    ...project.value,
    ejectedAreas: [path],
  });
  const managedSurfaces = [
    ...state.value.managedSurfaces.map((surface) =>
      surface.identifier === "builder-project-configuration"
        ? {
            ...surface,
            fingerprint: core.fingerprintFileContent(
              encoder.encode(projectSource),
            ),
          }
        : surface,
    ),
    { ...preservedSurface, ownership: "ejected", ...surfaceOverrides },
  ].sort((left, right) => compareText(left.identifier, right.identifier));
  base.set(path, "private preserved application source\n");
  base.set(".egeria/project.yaml", projectSource);
  base.set(
    ".egeria/state.json",
    core.serializeStateJson({
      ...state.value,
      managedSurfaces,
      ejections: [path],
    }),
  );
  return base;
}

test("capability removal plan is exact and read-only for portfolio and site", async () => {
  for (const profile of ["portfolio", "site"]) {
    const result = await planFromEntries(await installedEntries(profile));
    assert.equal(result.ok, true, JSON.stringify(result.issues));
    assert.match(result.value.planFingerprint, /^sha256:[a-f0-9]{64}$/u);
    assert.deepEqual(
      result.value,
      expectedPlan(
        profile,
        result.value.planFingerprint,
        expectedCurrentCapabilities[profile],
      ),
    );
    assert.doesNotMatch(
      JSON.stringify(result.value),
      /calendly\.com|refs\/heads|\/generated\//u,
    );
  }
});

test("capability removal plan preserves modified and already-ejected application files", async () => {
  const modifiedPath =
    "apps/web/src/integrations/booking-calendly/calendly-booking.tsx";
  const modified = await installedEntries("portfolio");
  modified.set(modifiedPath, "private application customization\n");
  const modifiedResult = await planFromEntries(modified);
  assert.equal(modifiedResult.ok, true, JSON.stringify(modifiedResult.issues));
  const preservedAction = {
    kind: "preserve-file-and-eject",
    path: modifiedPath,
    ownership: "ejected",
    owner: "booking-calendly",
  };
  assert.deepEqual(
    modifiedResult.value,
    expectedPlan(
      "portfolio",
      modifiedResult.value.planFingerprint,
      expectedCurrentCapabilities.portfolio,
      new Map([[modifiedPath, preservedAction]]),
      [
        {
          code: "review-surviving-references-to-removed-surfaces",
          scope: "repository",
        },
        {
          code: "reconcile-preserved-capability-surfaces",
          paths: [modifiedPath],
        },
      ],
    ),
  );
  assert.doesNotMatch(JSON.stringify(modifiedResult), /private application/u);

  const alreadyEjected = updateEjections(
    await installedEntries("portfolio"),
    [modifiedPath],
  );
  const ejectedResult = await planFromEntries(alreadyEjected);
  assert.equal(ejectedResult.ok, true, JSON.stringify(ejectedResult.issues));
  assert.deepEqual(
    ejectedResult.value.actions,
    expectedActions(new Map([[modifiedPath, preservedAction]])),
  );
  assert.deepEqual(ejectedResult.value.reviewRequirements, [
    {
      code: "review-surviving-references-to-removed-surfaces",
      scope: "repository",
    },
    {
      code: "reconcile-preserved-capability-surfaces",
      paths: [modifiedPath],
    },
  ]);

  const unrelatedPath = "README.md";
  const unrelatedEjection = updateEjections(
    await installedEntries("portfolio"),
    [unrelatedPath],
  );
  const unrelatedResult = await planFromEntries(unrelatedEjection);
  assert.equal(unrelatedResult.ok, true, JSON.stringify(unrelatedResult.issues));
  assert.deepEqual(unrelatedResult.value.actions, expectedActions());
});

test("capability removal plan reconciles every preserved path in deterministic order", async () => {
  const alreadyEjectedPath =
    "apps/web/src/integrations/booking-calendly/booking-content.ts";
  const modifiedPath =
    "apps/web/src/integrations/booking-calendly/calendly-booking.tsx";
  const entries = updateEjections(
    await installedEntries("portfolio"),
    [alreadyEjectedPath],
  );
  entries.set(modifiedPath, "private application customization\n");

  const result = await planFromEntries(entries);
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  const preservedAction = (path) => ({
    kind: "preserve-file-and-eject",
    path,
    ownership: "ejected",
    owner: "booking-calendly",
  });
  assert.deepEqual(
    result.value,
    expectedPlan(
      "portfolio",
      result.value.planFingerprint,
      expectedCurrentCapabilities.portfolio,
      new Map([
        [alreadyEjectedPath, preservedAction(alreadyEjectedPath)],
        [modifiedPath, preservedAction(modifiedPath)],
      ]),
      [
        {
          code: "review-surviving-references-to-removed-surfaces",
          scope: "repository",
        },
        {
          code: "reconcile-preserved-capability-surfaces",
          paths: [alreadyEjectedPath, modifiedPath],
        },
      ],
    ),
  );
});

test("capability removal plan distinguishes not-installed state from removal drift", async () => {
  for (const profile of ["portfolio", "site"]) {
    assertFailure(
      await planFromEntries(await baseFixtureEntries(profile)),
      "CAPABILITY_NOT_INSTALLED",
    );
  }

  const residual = await baseFixtureEntries("portfolio");
  residual.set(
    "apps/web/src/integrations/booking-calendly/booking-settings.ts",
    "private residual source\n",
  );
  assertFailure(
    await planFromEntries(residual),
    "PROJECT_DRIFT_DETECTED",
  );

  const preservedPath =
    "apps/web/src/integrations/booking-calendly/calendly-booking.tsx";
  assertFailure(
    await planFromEntries(
      await postRemovalEntriesWithEjection(preservedPath),
    ),
    "CAPABILITY_NOT_INSTALLED",
  );

  assertFailure(
    await planFromEntries(
      await postRemovalEntriesWithEjection(preservedPath, {
        owner: { kind: "capability", identifier: "standards" },
      }),
    ),
    "PROJECT_DRIFT_DETECTED",
  );
});

test("capability removal plan refuses unsupported recipe, provenance, migration, and version state", async () => {
  const base = await installedEntries("portfolio");
  const project = core.parseProjectYaml(base.get(".egeria/project.yaml"));
  const state = core.parseStateJson(base.get(".egeria/state.json"));
  assert.equal(project.ok, true);
  assert.equal(state.ok, true);

  const historicalRecipe = new Map(base);
  historicalRecipe.set(
    ".egeria/project.yaml",
    core.serializeProjectYaml({
      ...project.value,
      recipeVersion: "0.9.0",
    }),
  );
  historicalRecipe.set(
    ".egeria/state.json",
    core.serializeStateJson({
      ...state.value,
      origin: { ...state.value.origin, recipeVersion: "0.9.0" },
    }),
  );

  const mismatchedOrigin = new Map(base);
  mismatchedOrigin.set(
    ".egeria/state.json",
    core.serializeStateJson({
      ...state.value,
      origin: { ...state.value.origin, profile: "site" },
    }),
  );

  const mismatchedMigrations = new Map(base);
  mismatchedMigrations.set(
    ".egeria/state.json",
    core.serializeStateJson({
      ...state.value,
      appliedMigrations: ["add-booking-calendly-0-1-0"],
    }),
  );

  const unsupportedInstalledVersion = new Map(base);
  unsupportedInstalledVersion.set(
    ".egeria/state.json",
    core.serializeStateJson({
      ...state.value,
      installedCapabilities: state.value.installedCapabilities.map(
        (capability) =>
          capability.identifier === "booking-calendly"
            ? { ...capability, version: "0.2.0" }
            : capability,
      ),
    }),
  );

  for (const { entries, code } of [
    { entries: historicalRecipe, code: "PROJECT_INSPECTION_INVALID" },
    { entries: mismatchedOrigin, code: "PROJECT_INSPECTION_INVALID" },
    { entries: mismatchedMigrations, code: "PROJECT_INSPECTION_INVALID" },
    { entries: unsupportedInstalledVersion, code: "PROJECT_DRIFT_DETECTED" },
  ]) {
    assertFailure(await planFromEntries(entries), code);
  }
});

test("capability removal plan refuses invalid controls, inventory, ejections, and owned drift", async () => {
  const base = await installedEntries("portfolio");
  const state = core.parseStateJson(base.get(".egeria/state.json"));
  assert.equal(state.ok, true);
  const incomplete = new Map(base);
  incomplete.set(
    ".egeria/state.json",
    core.serializeStateJson({
      ...state.value,
      managedSurfaces: state.value.managedSurfaces.filter(
        ({ identifier }) =>
          identifier !== "booking-calendly-browser-specification",
      ),
    }),
  );

  const inconsistentEjection = updateEjections(base, [
    "apps/web/content/en-CA/booking-calendly.yaml",
  ]);
  const inconsistentState = core.parseStateJson(
    inconsistentEjection.get(".egeria/state.json"),
  );
  assert.equal(inconsistentState.ok, true);
  inconsistentEjection.set(
    ".egeria/state.json",
    core.serializeStateJson({
      ...inconsistentState.value,
      ejections: [],
    }),
  );
  const unknownEjection = updateEjections(base, ["private/unknown-area"]);

  const cases = [
    {
      entries: base,
      overrides: new Map([[".egeria/project.yaml", { kind: "missing" }]]),
      code: "PROJECT_INSPECTION_INVALID",
    },
    { entries: incomplete, code: "PROJECT_DRIFT_DETECTED" },
    { entries: inconsistentEjection, code: "PROJECT_EJECTION_INVALID" },
    { entries: unknownEjection, code: "PROJECT_EJECTION_INVALID" },
    {
      entries: base,
      overrides: new Map([
        [
          "apps/web/src/integrations/booking-calendly/booking-settings.ts",
          { kind: "file", content: "private managed drift\n" },
        ],
      ]),
      code: "PROJECT_DRIFT_DETECTED",
    },
    {
      entries: base,
      overrides: new Map([
        [
          "apps/web/app/page.tsx",
          { kind: "file", content: "private shared composition\n" },
        ],
      ]),
      code: "PROJECT_DRIFT_DETECTED",
    },
    {
      entries: base,
      overrides: new Map([
        [
          "apps/web/content/en-CA/booking-calendly.yaml",
          { kind: "missing" },
        ],
      ]),
      code: "PROJECT_DRIFT_DETECTED",
    },
    {
      entries: base,
      overrides: new Map([["README.md", { kind: "missing" }]]),
      code: "PROJECT_DRIFT_DETECTED",
    },
    {
      entries: base,
      overrides: new Map([["README.md", { kind: "symlink" }]]),
      code: "PROJECT_DRIFT_DETECTED",
    },
    {
      entries: base,
      overrides: new Map([
        ["README.md", { kind: "error", code: "READ_FAILED" }],
      ]),
      code: "PROJECT_DRIFT_DETECTED",
    },
  ];

  for (const { entries, overrides, code } of cases) {
    assertFailure(await planFromEntries(entries, { overrides }), code);
  }
});

test("capability removal plan refuses unsupported requests before repository access", async () => {
  const reader = {
    async readText() {
      throw new Error("repository access must not occur");
    },
  };
  assertFailure(
    await core.planCapabilityRemoval({
      reader,
      git,
      capability: "invented-capability",
    }),
    "CAPABILITY_REMOVAL_UNSUPPORTED",
  );
});

test("capability removal plan tolerates bounded application-owned reader errors", async () => {
  const base = await installedEntries("portfolio");

  for (const code of ["FILE_ENCODING_INVALID", "FILE_TOO_LARGE"]) {
    const result = await planFromEntries(base, {
      overrides: new Map([["README.md", { kind: "error", code }]]),
    });
    assert.equal(result.ok, true, JSON.stringify(result.issues));
    assert.deepEqual(result.value.actions, expectedActions());
  }
});

test("capability removal plan binds private controls and Git identity without disclosure", async () => {
  const base = await installedEntries("portfolio");
  const first = await planFromEntries(base);
  assert.equal(first.ok, true, JSON.stringify(first.issues));
  const repeated = await planFromEntries(base);
  assert.equal(repeated.ok, true, JSON.stringify(repeated.issues));
  assert.equal(repeated.value.planFingerprint, first.value.planFingerprint);

  const changedSettings = await installedEntries("portfolio", {
    ...settings,
    destination: "https://calendly.com/private/changed",
  });
  const second = await planFromEntries(changedSettings);
  assert.equal(second.ok, true, JSON.stringify(second.issues));

  const changedGit = await planFromEntries(base, {
    git: {
      ...git,
      identity: {
        ...git.identity,
        gitDirectory: "/generated/common/.git/worktrees/other",
      },
    },
  });
  assert.equal(changedGit.ok, true, JSON.stringify(changedGit.issues));

  assert.notEqual(
    first.value.planFingerprint,
    second.value.planFingerprint,
  );
  assert.notEqual(
    first.value.planFingerprint,
    changedGit.value.planFingerprint,
  );
  assert.deepEqual(
    { ...first.value, planFingerprint: "redacted" },
    { ...second.value, planFingerprint: "redacted" },
  );
  assert.doesNotMatch(
    JSON.stringify([first, repeated, second, changedGit]),
    /calendly\.com|refs\/heads|\/generated\//u,
  );
});

test("capability removal plan fingerprint binds its review requirements", async () => {
  const entries = await installedEntries("portfolio");
  const result = await planFromEntries(entries);
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  const project = core.parseProjectYaml(entries.get(".egeria/project.yaml"));
  const state = core.parseStateJson(entries.get(".egeria/state.json"));
  assert.equal(project.ok, true, JSON.stringify(project.issues));
  assert.equal(state.ok, true, JSON.stringify(state.issues));
  const { planFingerprint, ...plan } = result.value;
  const fingerprintInput = {
    plan,
    project: project.value,
    state: state.value,
    gitIdentity: git.identity,
  };

  assert.equal(planFingerprint, core.fingerprintJsonValue(fingerprintInput));
  assert.notEqual(
    planFingerprint,
    core.fingerprintJsonValue({
      ...fingerprintInput,
      plan: { ...plan, reviewRequirements: [] },
    }),
  );
});
