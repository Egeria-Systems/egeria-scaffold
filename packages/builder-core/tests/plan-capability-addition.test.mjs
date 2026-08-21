import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "../..");
const core = await import(
  pathToFileURL(resolve(packageRoot, "dist/index.js"))
);
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const settings = Object.freeze({
  destination: "https://calendly.com/example/discovery",
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

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

async function loadTextEntries(root) {
  const entries = new Map();

  async function visit(directory) {
    const directoryEntries = await readdir(directory, { withFileTypes: true });

    for (const entry of directoryEntries) {
      const absolutePath = join(directory, entry.name);

      if (entry.isDirectory()) {
        await visit(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const content = await readFile(absolutePath);

      try {
        const path = relative(root, absolutePath).split(sep).join("/");
        entries.set(path, decoder.decode(content));
      } catch {
        const path = relative(root, absolutePath).split(sep).join("/");
        entries.set(path, { kind: "error", code: "FILE_ENCODING_INVALID" });
      }
    }
  }

  await visit(root);
  return entries;
}

function cloneReadResult(value) {
  return value === "throw" ? value : structuredClone(value);
}

function createSnapshotReader(entries, overrides = new Map()) {
  const files = new Map(entries);
  const fixedOverrides = new Map(
    [...overrides].map(([path, value]) => [path, cloneReadResult(value)]),
  );
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
          const override = fixedOverrides.get(path);

          if (override === "throw") {
            throw new Error("private reader failure detail");
          }

          return structuredClone(override);
        }

        const content = files.get(path);
        if (content === undefined) {
          return { kind: "missing" };
        }

        return typeof content === "string"
          ? { kind: "file", content }
          : structuredClone(content);
      },
    },
    snapshot,
  };
}

async function fixtureEntries(name) {
  return loadTextEntries(resolve(repositoryRoot, `fixtures/generated/${name}`));
}

function assertFailure(result, code) {
  assert.equal(result.ok, false);
  assert.deepEqual(result.issues.map(({ code: issueCode }) => issueCode), [code]);
  assert.ok(
    result.issues.every(
      (issue) => !JSON.stringify(issue).includes("private reader failure detail"),
    ),
  );
}

async function planFromEntries(entries, options = {}) {
  const snapshotReader = createSnapshotReader(entries, options.overrides);
  const before = snapshotReader.snapshot();
  try {
    return await core.planCapabilityAddition({
      reader: snapshotReader.reader,
      git,
      capability: options.capability ?? "booking-calendly",
      settings: options.settings ?? settings,
    });
  } finally {
    assert.equal(snapshotReader.snapshot(), before);
  }
}

function expectedActions() {
  return [
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
      kind: "create-file",
      path: "apps/web/content/en-CA/booking-calendly.yaml",
      ownership: "application-owned",
      owner: "booking-calendly",
    },
    {
      kind: "create-file",
      path: "apps/web/src/integrations/booking-calendly/booking-content.ts",
      ownership: "application-owned",
      owner: "booking-calendly",
    },
    {
      kind: "create-file",
      path: "apps/web/src/integrations/booking-calendly/booking-settings.ts",
      ownership: "managed",
      owner: "booking-calendly",
    },
    {
      kind: "create-file",
      path: "apps/web/src/integrations/booking-calendly/calendly-booking.tsx",
      ownership: "application-owned",
      owner: "booking-calendly",
    },
    {
      kind: "create-file",
      path: "apps/web/tests/e2e/calendly-booking.spec.ts",
      ownership: "application-owned",
      owner: "booking-calendly",
    },
  ];
}

function expectedPlan(profile) {
  const currentCapabilities = [
    "content-files",
    "deployment-cloudflare",
    "observability",
    "section-composition",
    ...(profile === "site" ? ["site-routing"] : []),
    "standards",
  ].sort(compareText);

  return {
    operation: "add-capability",
    status: "approval-required",
    baseRevision: git.identity.revision,
    profile,
    capability: {
      identifier: "booking-calendly",
      version: "0.1.0",
    },
    settings: {
      mode: "popup",
      destination: "redacted",
    },
    currentCapabilities,
    desiredCapabilities: ["booking-calendly", ...currentCapabilities].sort(
      compareText,
    ),
    actions: expectedActions(),
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

test("capability addition plan is exact and read-only for portfolio and site", async () => {
  for (const profile of ["portfolio", "site"]) {
    const result = await planFromEntries(await fixtureEntries(profile));
    assert.equal(result.ok, true, JSON.stringify(result.issues));
    assert.deepEqual(result.value, expectedPlan(profile));
    assert.doesNotMatch(JSON.stringify(result.value), /calendly\.com|refs\/heads|\/generated\//u);
  }
});

test("capability addition plan refuses invalid controls and historical recipes", async () => {
  const base = await fixtureEntries("portfolio");
  const invalidCases = [
    new Map([[".egeria/project.yaml", { kind: "missing" }]]),
    new Map([[".egeria/state.json", { kind: "file", content: "{" }]]),
    new Map([
      [
        ".egeria/migrations.jsonl",
        { kind: "file", content: "private malformed migration" },
      ],
    ]),
  ];

  for (const overrides of invalidCases) {
    assertFailure(
      await planFromEntries(base, { overrides }),
      "PROJECT_INSPECTION_INVALID",
    );
  }

  const historical = new Map(base);
  const parsedProject = core.parseProjectYaml(
    historical.get(".egeria/project.yaml"),
  );
  const parsedState = core.parseStateJson(historical.get(".egeria/state.json"));
  assert.equal(parsedProject.ok, true);
  assert.equal(parsedState.ok, true);
  historical.set(
    ".egeria/project.yaml",
    core.serializeProjectYaml({ ...parsedProject.value, recipeVersion: "0.9.0" }),
  );
  historical.set(
    ".egeria/state.json",
    core.serializeStateJson({
      ...parsedState.value,
      origin: { ...parsedState.value.origin, recipeVersion: "0.9.0" },
    }),
  );
  assertFailure(
    await planFromEntries(historical),
    "PROJECT_INSPECTION_INVALID",
  );
});

test("capability addition plan refuses inference drift and replacement drift", async () => {
  const base = await fixtureEntries("portfolio");
  const cases = [
    new Map([
      [
        "apps/web/next.config.ts",
        { kind: "file", content: "private managed drift\n" },
      ],
    ]),
    new Map([["apps/web/app/page.tsx", { kind: "missing" }]]),
    new Map([["apps/web/app/layout.tsx", { kind: "missing" }]]),
    new Map([
      [
        "apps/web/app/page.tsx",
        { kind: "file", content: "private application customization\n" },
      ],
    ]),
  ];

  for (const overrides of cases) {
    assertFailure(
      await planFromEntries(base, { overrides }),
      "PROJECT_DRIFT_DETECTED",
    );
  }
});

test("capability addition plan refuses incomplete or contradictory surface inventories", async () => {
  const base = await fixtureEntries("portfolio");
  const stateResult = core.parseStateJson(base.get(".egeria/state.json"));
  assert.equal(stateResult.ok, true);
  const rootLayout = stateResult.value.managedSurfaces.find(
    ({ identifier }) => identifier === "builder-root-layout",
  );
  assert.notEqual(rootLayout, undefined);

  const cases = [
    stateResult.value.managedSurfaces.filter(
      ({ identifier }) => identifier !== "builder-root-layout",
    ),
    [
      ...stateResult.value.managedSurfaces,
      { ...rootLayout, identifier: "invented-application-surface" },
    ],
    stateResult.value.managedSurfaces.map((surface) =>
      surface.identifier === "builder-root-layout"
        ? { ...surface, path: "apps/web/app/page.tsx" }
        : surface,
    ),
  ];

  for (const managedSurfaces of cases) {
    const entries = new Map(base);
    entries.delete("apps/web/app/layout.tsx");
    entries.set(
      ".egeria/state.json",
      core.serializeStateJson({ ...stateResult.value, managedSurfaces }),
    );
    assertFailure(
      await planFromEntries(entries),
      "PROJECT_DRIFT_DETECTED",
    );
  }
});

function setEjections(entries, projectEjections, stateEjections) {
  const next = new Map(entries);
  const projectResult = core.parseProjectYaml(next.get(".egeria/project.yaml"));
  const stateResult = core.parseStateJson(next.get(".egeria/state.json"));
  assert.equal(projectResult.ok, true);
  assert.equal(stateResult.ok, true);
  const projectSource = core.serializeProjectYaml({
    ...projectResult.value,
    ejectedAreas: projectEjections,
  });
  const managedSurfaces = stateResult.value.managedSurfaces.map((surface) =>
    surface.identifier === "builder-project-configuration"
      ? {
          ...surface,
          fingerprint: core.fingerprintFileContent(encoder.encode(projectSource)),
        }
      : surface,
  );
  next.set(".egeria/project.yaml", projectSource);
  next.set(
    ".egeria/state.json",
    core.serializeStateJson({
      ...stateResult.value,
      ejections: stateEjections,
      managedSurfaces,
    }),
  );
  return next;
}

test("capability addition plan refuses all project and state ejections", async () => {
  const base = await fixtureEntries("portfolio");
  const path = "apps/web/app/page.tsx";

  for (const entries of [
    setEjections(base, [path], [path]),
    setEjections(base, [path], []),
    setEjections(base, [], [path]),
  ]) {
    assertFailure(
      await planFromEntries(entries),
      "PROJECT_EJECTION_UNSUPPORTED",
    );
  }
});

test("capability addition plan refuses every create-target collision kind", async () => {
  const base = await fixtureEntries("portfolio");
  const target = "apps/web/content/en-CA/booking-calendly.yaml";
  const collisionResults = [
    { kind: "file", content: "ignored but existing\n" },
    { kind: "symlink" },
    { kind: "error", code: "FILE_TYPE_UNSUPPORTED" },
    { kind: "error", code: "READ_FAILED" },
  ];

  for (const collision of collisionResults) {
    assertFailure(
      await planFromEntries(base, {
        overrides: new Map([[target, collision]]),
      }),
      "CAPABILITY_ACTION_CONFLICT",
    );
  }
});

test("capability addition plan refuses installed and unsupported capabilities", async () => {
  assertFailure(
    await planFromEntries(await fixtureEntries("portfolio-calendly")),
    "CAPABILITY_ALREADY_INSTALLED",
  );
  assertFailure(
    await planFromEntries(await fixtureEntries("portfolio"), {
      capability: "invented-capability",
    }),
    "CAPABILITY_ADDITION_UNSUPPORTED",
  );
});

test("capability addition plan is deterministic, order-independent, and destination-redacted", async () => {
  const base = await fixtureEntries("portfolio");
  const reordered = new Map(base);
  const projectResult = core.parseProjectYaml(reordered.get(".egeria/project.yaml"));
  const stateResult = core.parseStateJson(reordered.get(".egeria/state.json"));
  assert.equal(projectResult.ok, true);
  assert.equal(stateResult.ok, true);
  const projectSource = core.serializeProjectYaml({
    ...projectResult.value,
    selectedCapabilities: [...projectResult.value.selectedCapabilities].reverse(),
  });
  const managedSurfaces = stateResult.value.managedSurfaces.map((surface) =>
    surface.identifier === "builder-project-configuration"
      ? {
          ...surface,
          fingerprint: core.fingerprintFileContent(encoder.encode(projectSource)),
        }
      : surface,
  );
  reordered.set(".egeria/project.yaml", projectSource);
  reordered.set(
    ".egeria/state.json",
    core.serializeStateJson({
      ...stateResult.value,
      installedCapabilities: [
        ...stateResult.value.installedCapabilities,
      ].reverse(),
      managedSurfaces,
    }),
  );

  const first = await planFromEntries(base);
  const repeated = await planFromEntries(base);
  const differentDestination = await planFromEntries(reordered, {
    settings: {
      ...settings,
      destination: "https://www.calendly.com/example/another-secret",
    },
  });
  assert.equal(first.ok, true);
  assert.equal(repeated.ok, true);
  assert.equal(differentDestination.ok, true);
  assert.deepEqual(repeated.value, first.value);
  assert.deepEqual(differentDestination.value, first.value);
  assert.doesNotMatch(
    JSON.stringify(first.value),
    /discovery|another-secret|calendly\.com/iu,
  );
});

test("capability addition plan propagates unexpected reader failures for boundary containment", async () => {
  await assert.rejects(
    planFromEntries(await fixtureEntries("portfolio"), {
      overrides: new Map([[".egeria/project.yaml", "throw"]]),
    }),
  );
});
