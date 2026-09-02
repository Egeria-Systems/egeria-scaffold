import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const core = await import(pathToFileURL(resolve(packageRoot, "dist/index.js")));
const { createBuilderStateSurfaces } = await import(
  pathToFileURL(
    resolve(packageRoot, "dist/generation/builder-state-surfaces.js"),
  )
);
const repositoryRoot = resolve(packageRoot, "../..");
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const git = Object.freeze({
  ok: true,
  identity: Object.freeze({
    root: "/private/generated-worktree",
    revision: "abcdef0123456789abcdef0123456789abcdef01",
    attachedRef: "refs/heads/upgrade-planning",
    gitDirectory: "/private/generated-common/.git/worktrees/upgrade-planning",
    commonDirectory: "/private/generated-common/.git",
  }),
});
const visualPaths = [
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
const acceptedSiteLockfileFingerprint =
  "020061380ecdf4eaafdff982bc2cc3be4a7867f752f874bfc1eb6dbc1c983952";
const acceptedSiteWorkspaceFingerprint =
  "990f97df2cb8a4798c7ce039e7f6fa0e743ebaf93368fe0f1f90a7c796903b2b";

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

async function loadEntries(root) {
  const entries = new Map();

  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolutePath = join(directory, entry.name);

      if (entry.isDirectory()) {
        await visit(absolutePath);
      } else if (entry.isFile()) {
        const path = relative(root, absolutePath).split(sep).join("/");
        const content = await readFile(absolutePath);

        try {
          entries.set(path, decoder.decode(content));
        } catch {
          entries.set(path, { kind: "error", code: "FILE_ENCODING_INVALID" });
        }
      }
    }
  }

  await visit(root);
  return entries;
}

async function currentEntries(profile) {
  return loadEntries(resolve(repositoryRoot, `fixtures/generated/${profile}`));
}

async function acceptedSiteEntries() {
  const current = await currentEntries("site");
  const currentState = core.parseStateJson(current.get(".egeria/state.json"));
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
  const lockfile = await readFile(
    resolve(packageRoot, "lockfiles/web-recipe-0.8.0/pnpm-lock.yaml"),
  );
  const workspace = await readFile(
    resolve(packageRoot, "lockfiles/web-recipe-0.8.0/pnpm-workspace.yaml"),
  );
  const byteFiles = new Map(
    rendered.value.files.map(({ path, content }) => [path, content]),
  );
  byteFiles.set(".egeria/project.yaml", encoder.encode(projectSource));
  byteFiles.set(".egeria/migrations.jsonl", new Uint8Array());
  byteFiles.set("pnpm-lock.yaml", new Uint8Array(lockfile));
  byteFiles.set("pnpm-workspace.yaml", new Uint8Array(workspace));
  const materialized = core.materializeInstalledSurfaces({
    files: byteFiles,
    surfaces: [...rendered.value.surfaces, ...createBuilderStateSurfaces()].sort(
      (left, right) => compareText(left.identifier, right.identifier),
    ),
  });
  assert.equal(materialized.ok, true, JSON.stringify(materialized.issues));
  byteFiles.set(
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
  const entries = new Map();
  for (const [path, content] of byteFiles) {
    try {
      entries.set(path, decoder.decode(content));
    } catch {
      entries.set(path, { kind: "error", code: "FILE_ENCODING_INVALID" });
    }
  }
  return entries;
}

test("historical site upgrades retain their accepted source lockfile", async () => {
  const lockfile = await readFile(
    resolve(packageRoot, "lockfiles/web-recipe-0.8.0/pnpm-lock.yaml"),
  );

  assert.equal(
    createHash("sha256").update(lockfile).digest("hex"),
    acceptedSiteLockfileFingerprint,
  );

  const workspace = await readFile(
    resolve(packageRoot, "lockfiles/web-recipe-0.8.0/pnpm-workspace.yaml"),
  );
  assert.equal(
    createHash("sha256").update(workspace).digest("hex"),
    acceptedSiteWorkspaceFingerprint,
  );
});

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
    historicalQualitySource(entries.get(".github/workflows/quality.yml")),
  );
  const manifest = JSON.parse(entries.get("apps/web/package.json"));
  delete manifest.scripts["test:visual"];
  entries.set("apps/web/package.json", `${JSON.stringify(manifest)}\n`);

  const projectResult = core.parseProjectYaml(entries.get(".egeria/project.yaml"));
  const stateResult = core.parseStateJson(entries.get(".egeria/state.json"));
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
            encoder.encode(entries.get(".github/workflows/quality.yml")),
          ),
        };
      }

      return surface;
    });
  const stateSource = core.serializeStateJson({
    ...stateResult.value,
    origin: { ...stateResult.value.origin, recipeVersion: "0.9.0" },
    installedCapabilities: stateResult.value.installedCapabilities.map(
      (capability) =>
        capability.identifier === "standards"
          ? { ...capability, version: "0.3.0" }
          : capability,
    ),
    managedSurfaces,
  });

  entries.set(".egeria/project.yaml", projectSource);
  entries.set(".egeria/state.json", stateSource);
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
          const value = fixedOverrides.get(path);

          if (value === "throw") {
            throw new Error("private reader failure detail");
          }

          return structuredClone(value);
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

async function planFromEntries(entries, options = {}) {
  const source = createSnapshotReader(entries, options.overrides);
  const before = source.snapshot();

  try {
    return await core.planCapabilityUpgrade({
      reader: source.reader,
      git: options.git ?? git,
      capability: options.capability ?? "standards",
      toVersion: options.toVersion ?? "0.4.0",
    });
  } finally {
    assert.equal(source.snapshot(), before);
  }
}

function assertFailure(result, code) {
  assert.equal(result.ok, false);
  assert.deepEqual(result.issues.map(({ code: issueCode }) => issueCode), [code]);
  assert.doesNotMatch(
    JSON.stringify(result),
    /private reader failure detail|refs\/heads|generated-worktree|generated-common/u,
  );
}

async function expectedActions(profile) {
  const fixtureRoot = resolve(repositoryRoot, `fixtures/generated/${profile}`);
  const fileAction = async (kind, path, ownership) => ({
    kind,
    path,
    ownership,
    owner: "standards",
    targetFingerprint: core.fingerprintFileContent(
      new Uint8Array(await readFile(resolve(fixtureRoot, path))),
    ),
  });

  return [
    await fileAction("replace-file", ".github/workflows/quality.yml", "managed"),
    await fileAction(
      "create-file",
      "apps/web/playwright.visual.config.ts",
      "managed",
    ),
    {
      kind: "set-json-value",
      path: "apps/web/package.json",
      pointer: "/scripts/test:visual",
      ownership: "merge-managed",
      owner: "standards",
      targetFingerprint: core.fingerprintJsonValue(
        "playwright test --config playwright.visual.config.ts",
      ),
    },
    await fileAction(
      "create-file",
      "apps/web/tests/visual/home-visual.spec.ts",
      "application-owned",
    ),
    await fileAction(
      "create-file",
      "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
      "application-owned",
    ),
    await fileAction(
      "create-file",
      "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
      "application-owned",
    ),
  ].sort((left, right) => compareText(left.path, right.path));
}

test("the supported standards edge binds the accepted endpoint subjects", () => {
  const edge = core.resolveSupportedCapabilityUpgrade({
    capability: "standards",
    fromVersion: "0.3.0",
    toVersion: "0.4.0",
  });

  assert.deepEqual(edge, {
    ok: true,
    value: {
      capability: "standards",
      fromVersion: "0.3.0",
      toVersion: "0.4.0",
      source: {
        recipeVersion: "0.9.0",
        evidenceRevision: "ea5a8ae8a6b0aa5fd7b8bc3bab3e03a52242aee2",
        subject: {
          descriptorVersion: "0.3.0",
          behaviorContractDigest:
            "sha256:be53fdace61b6782e7f0abbbc0af7c333f81122f3a62fcfc7eb0ac687b2ff2fb",
        },
      },
      target: {
        recipeVersion: "0.10.0",
        evidenceRevision: "d7f9dac6e25d5dde32015968d0912b45e73644e7",
        subject: {
          descriptorVersion: "0.4.0",
          behaviorContractDigest:
            "sha256:81bb7d1c0ee095b6411c29350fa418c8676ffa90594b848a9cc19806e08c29d4",
        },
      },
    },
  });
});

test("catalog snapshots refuse undeclared standards versions at runtime", () => {
  for (const snapshot of [
    { standards: "0.5.0" },
    {},
    null,
    undefined,
  ]) {
    const result = core.createCapabilityCatalogSnapshot(
      core.verifiedCapabilityPackageVersions,
      snapshot,
    );

    assert.equal(result.ok, false);
    assert.deepEqual(result.issues, [
      {
        code: "CAPABILITY_DESCRIPTOR_VERSION_INVALID",
        path: ["snapshot", "standards"],
        context: { reason: "unsupported-version" },
      },
    ]);
  }

  assert.throws(
    () => core.createProfileRecipeSnapshot("0.11.0"),
    /profile-recipe-snapshot-version-unsupported/u,
  );
});

test("the supported standards edge refuses every undeclared pair", () => {
  const cases = [
    {
      input: {
        capability: "standards",
        fromVersion: "0.4.0",
        toVersion: "0.4.0",
      },
      code: "CAPABILITY_ALREADY_CURRENT",
    },
    {
      input: {
        capability: "standards",
        fromVersion: "0.2.0",
        toVersion: "0.4.0",
      },
      code: "CAPABILITY_UPGRADE_EDGE_MISSING",
    },
    {
      input: {
        capability: "standards",
        fromVersion: "0.3.0",
        toVersion: "0.5.0",
      },
      code: "CAPABILITY_UPGRADE_UNSUPPORTED",
    },
    {
      input: {
        capability: "observability",
        fromVersion: "0.3.0",
        toVersion: "0.4.0",
      },
      code: "CAPABILITY_UPGRADE_UNSUPPORTED",
    },
  ];

  for (const { code, input } of cases) {
    assert.deepEqual(core.resolveSupportedCapabilityUpgrade(input), {
      ok: false,
      code,
    });
  }
});

test("the production site recipe has one exact certified site-routing upgrade edge", async () => {
  const edge = core.resolveSupportedCapabilityUpgrade({
    capability: "site-routing",
    fromVersion: "0.3.0",
    toVersion: "0.4.0",
  });
  assert.equal(edge.ok, true);
  assert.equal(edge.value.source.recipeVersion, "0.10.0");
  assert.equal(edge.value.target.recipeVersion, "0.11.0");
  assert.equal(
    edge.value.target.evidenceRevision,
    "e69c28ec4228622fd34517a72858e2ac55401a5a",
  );

  const entries = await acceptedSiteEntries();
  const result = await planFromEntries(entries, {
    capability: "site-routing",
  });
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  assert.deepEqual(result.value.capability, {
    identifier: "site-routing",
    fromVersion: "0.3.0",
    toVersion: "0.4.0",
  });
  assert.deepEqual(
    result.value.actions.map(({ kind, path }) => [kind, path]),
    [
      ["replace-file", ".egeria/project.yaml"],
      ["replace-file", "apps/web/app/about/page.tsx"],
      ["create-file", "apps/web/app/not-found.tsx"],
      ["replace-file", "apps/web/app/page.tsx"],
      ["create-file", "apps/web/app/robots.ts"],
      ["create-file", "apps/web/app/sitemap.ts"],
      ["create-file", "apps/web/app/work/error.tsx"],
      ["create-file", "apps/web/app/work/featured/page.tsx"],
      ["create-file", "apps/web/app/work/page.tsx"],
      ["replace-file", "apps/web/content/en-CA/about.yaml"],
      ["create-file", "apps/web/content/en-CA/not-found.yaml"],
      ["create-file", "apps/web/content/en-CA/routing.yaml"],
      ["replace-file", "apps/web/content/en-CA/site.yaml"],
      ["create-file", "apps/web/content/en-CA/work-featured.yaml"],
      ["replace-file", "apps/web/package.json"],
      ["create-file", "apps/web/src/routing/read-routing-content.ts"],
      ["create-file", "apps/web/src/routing/routing-content-schema.ts"],
      ["create-file", "apps/web/src/routing/site-page.tsx"],
      ["create-file", "apps/web/tests/component/site-page.test.tsx"],
      ["create-file", "apps/web/tests/e2e/site-routing.spec.ts"],
      ["create-file", "apps/web/tests/unit/routing-content.test.ts"],
      ["replace-file", "pnpm-lock.yaml"],
      ["replace-file", "pnpm-workspace.yaml"],
    ],
  );
  assert.equal(result.value.profile, "site");
  assert.match(result.value.planFingerprint, /^sha256:[a-f0-9]{64}$/u);
});

test("upgrade planning is exact, fingerprinted, and read-only for both profiles", async () => {
  for (const profile of ["portfolio", "site"]) {
    const entries = await historicalEntries(profile);
    const result = await planFromEntries(entries);
    assert.equal(result.ok, true, JSON.stringify(result.issues));
    assert.match(result.value.planFingerprint, /^sha256:[a-f0-9]{64}$/u);
    const capabilities = [
      "content-files",
      "deployment-cloudflare",
      "observability",
      "section-composition",
      ...(profile === "site" ? ["site-routing"] : []),
      "standards",
    ].sort(compareText);
    const controls = [
      ".egeria/migrations.jsonl",
      ".egeria/project.yaml",
      ".egeria/state.json",
    ].map((path) => ({
      path,
      fingerprint: core.fingerprintFileContent(encoder.encode(entries.get(path))),
    }));

    assert.deepEqual(result.value, {
      operation: "upgrade-capability",
      status: "approval-required",
      planFingerprint: result.value.planFingerprint,
      baseRevision: git.identity.revision,
      profile,
      capability: {
        identifier: "standards",
        fromVersion: "0.3.0",
        toVersion: "0.4.0",
      },
      source: core.resolveSupportedCapabilityUpgrade({
        capability: "standards",
        fromVersion: "0.3.0",
        toVersion: "0.4.0",
      }).value.source,
      target: core.resolveSupportedCapabilityUpgrade({
        capability: "standards",
        fromVersion: "0.3.0",
        toVersion: "0.4.0",
      }).value.target,
      controlFiles: controls,
      currentCapabilities: capabilities,
      desiredCapabilities: capabilities,
      actions: await expectedActions(profile),
      requiredApprovals: ["transform", "verified-final-diff"],
      persistenceOrder: [
        "transform",
        "verify",
        "re-infer",
        "append-migration-record",
        "persist-state",
        "verify-state-and-inference",
      ],
    });
    assert.doesNotMatch(
      JSON.stringify(result.value),
      /refs\/heads|generated-worktree|generated-common|displayName|projectName/u,
    );
  }
});

test("upgrade planning fingerprints exact control bytes and Git identity", async () => {
  const entries = await historicalEntries("portfolio");
  const repeated = await planFromEntries(entries);
  const state = core.parseStateJson(entries.get(".egeria/state.json"));
  assert.equal(state.ok, true);
  const stateWhitespace = new Map(entries);
  stateWhitespace.set(".egeria/state.json", JSON.stringify(state.value));
  const changedControl = await planFromEntries(stateWhitespace);
  const changedGit = await planFromEntries(entries, {
    git: {
      ...git,
      identity: { ...git.identity, attachedRef: "refs/heads/other-private-ref" },
    },
  });

  assert.equal(repeated.ok, true);
  assert.deepEqual(await planFromEntries(entries), repeated);
  assert.equal(changedControl.ok, true);
  assert.equal(changedGit.ok, true);
  assert.notEqual(
    changedControl.value.planFingerprint,
    repeated.value.planFingerprint,
  );
  assert.notEqual(changedGit.value.planFingerprint, repeated.value.planFingerprint);
  assert.doesNotMatch(JSON.stringify(changedGit.value), /other-private-ref/u);
});

test("upgrade planning refuses incompatible controls and agreement failures", async () => {
  const base = await historicalEntries("portfolio");
  assertFailure(
    await planFromEntries(base, {
      overrides: new Map([[".egeria/state.json", { kind: "missing" }]]),
    }),
    "PROJECT_STATE_INCOMPATIBLE",
  );

  const migrationMismatch = new Map(base);
  const state = core.parseStateJson(base.get(".egeria/state.json"));
  assert.equal(state.ok, true);
  migrationMismatch.set(
    ".egeria/state.json",
    core.serializeStateJson({ ...state.value, appliedMigrations: ["invented"] }),
  );
  assertFailure(
    await planFromEntries(migrationMismatch),
    "PROJECT_STATE_INCOMPATIBLE",
  );

  const desiredMismatch = new Map(base);
  const project = core.parseProjectYaml(base.get(".egeria/project.yaml"));
  assert.equal(project.ok, true);
  const projectSource = core.serializeProjectYaml({
    ...project.value,
    selectedCapabilities: project.value.selectedCapabilities.filter(
      (identifier) => identifier !== "standards",
    ),
  });
  desiredMismatch.set(".egeria/project.yaml", projectSource);
  desiredMismatch.set(
    ".egeria/state.json",
    core.serializeStateJson({
      ...state.value,
      managedSurfaces: state.value.managedSurfaces.map((surface) =>
        surface.identifier === "builder-project-configuration"
          ? {
              ...surface,
              fingerprint: core.fingerprintFileContent(encoder.encode(projectSource)),
            }
          : surface,
      ),
    }),
  );
  assertFailure(
    await planFromEntries(desiredMismatch),
    "PROJECT_STATE_INCOMPATIBLE",
  );
});

test("upgrade planning refuses ambiguous inference, drift, ejection, and collisions", async () => {
  const base = await historicalEntries("portfolio");
  assertFailure(
    await planFromEntries(base, {
      overrides: new Map([
        ["apps/web/package.json", { kind: "file", content: "{" }],
      ]),
    }),
    "CAPABILITY_VERSION_AMBIGUOUS",
  );
  assertFailure(
    await planFromEntries(base, {
      overrides: new Map([
        [
          ".github/workflows/quality.yml",
          { kind: "file", content: "managed drift\n" },
        ],
      ]),
    }),
    "PROJECT_DRIFT_DETECTED",
  );

  const state = core.parseStateJson(base.get(".egeria/state.json"));
  const project = core.parseProjectYaml(base.get(".egeria/project.yaml"));
  assert.equal(state.ok, true);
  assert.equal(project.ok, true);
  const ejected = new Map(base);
  const ejectedPath = "apps/web/tests/unit/content-schema.test.ts";
  const projectSource = core.serializeProjectYaml({
    ...project.value,
    ejectedAreas: [ejectedPath],
  });
  ejected.set(".egeria/project.yaml", projectSource);
  ejected.set(
    ".egeria/state.json",
    core.serializeStateJson({
      ...state.value,
      ejections: [ejectedPath],
      managedSurfaces: state.value.managedSurfaces.map((surface) => {
        if (surface.identifier === "builder-project-configuration") {
          return {
            ...surface,
            fingerprint: core.fingerprintFileContent(encoder.encode(projectSource)),
          };
        }

        return surface.path === ejectedPath
          ? { ...surface, ownership: "ejected" }
          : surface;
      }),
    }),
  );
  assertFailure(
    await planFromEntries(ejected),
    "PROJECT_EJECTION_UNSUPPORTED",
  );

  for (const collision of [
    { kind: "file", content: "collision\n" },
    { kind: "symlink" },
    { kind: "error", code: "FILE_TYPE_UNSUPPORTED" },
  ]) {
    assertFailure(
      await planFromEntries(base, {
        overrides: new Map([[visualPaths[0], collision]]),
      }),
      "CAPABILITY_ACTION_CONFLICT",
    );
  }
});

test("upgrade planning distinguishes already-current, missing-edge, and unsupported requests", async () => {
  assertFailure(
    await planFromEntries(await currentEntries("portfolio")),
    "CAPABILITY_ALREADY_CURRENT",
  );

  const missingEdge = await historicalEntries("portfolio");
  const state = core.parseStateJson(missingEdge.get(".egeria/state.json"));
  assert.equal(state.ok, true);
  missingEdge.set(
    ".egeria/state.json",
    core.serializeStateJson({
      ...state.value,
      installedCapabilities: state.value.installedCapabilities.map(
        (capability) =>
          capability.identifier === "standards"
            ? { ...capability, version: "0.2.0" }
            : capability,
      ),
    }),
  );
  assertFailure(
    await planFromEntries(missingEdge),
    "CAPABILITY_UPGRADE_EDGE_MISSING",
  );

  const reader = {
    async readText() {
      throw new Error("repository must not be read");
    },
  };
  for (const request of [
    { capability: "observability", toVersion: "0.4.0" },
    { capability: "standards", toVersion: "0.5.0" },
  ]) {
    assertFailure(
      await core.planCapabilityUpgrade({ reader, git, ...request }),
      "CAPABILITY_UPGRADE_UNSUPPORTED",
    );
  }
});

test("upgrade planning propagates unexpected reader failures for CLI containment", async () => {
  await assert.rejects(
    planFromEntries(await historicalEntries("portfolio"), {
      overrides: new Map([[".egeria/project.yaml", "throw"]]),
    }),
  );
});
