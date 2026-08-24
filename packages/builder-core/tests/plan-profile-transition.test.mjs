import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "../..");
const core = await import(pathToFileURL(resolve(packageRoot, "dist/index.js")));
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const baseGit = Object.freeze({
  ok: true,
  identity: Object.freeze({
    root: "/private/profile-transition-worktree",
    revision: "abcdef0123456789abcdef0123456789abcdef01",
    attachedRef: "refs/heads/profile-transition-planning",
    gitDirectory:
      "/private/profile-transition-common/.git/worktrees/profile-transition-planning",
    commonDirectory: "/private/profile-transition-common/.git",
  }),
});
const controlPaths = [
  ".egeria/migrations.jsonl",
  ".egeria/project.yaml",
  ".egeria/state.json",
];
const actionPaths = [
  ".egeria/project.yaml",
  "apps/web/app/about/page.tsx",
  "apps/web/content/en-CA/about.yaml",
  "apps/web/content/en-CA/long-form/introduction.md",
  "apps/web/content/en-CA/site.yaml",
  "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
];

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sameBytes(left, right) {
  return (
    left.length === right.length &&
    left.every((byte, index) => byte === right[index])
  );
}

async function loadEntries(root) {
  const entries = new Map();

  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolutePath = join(directory, entry.name);

      if (entry.isDirectory()) {
        await visit(absolutePath);
      } else if (entry.isFile()) {
        entries.set(
          relative(root, absolutePath).split(sep).join("/"),
          new Uint8Array(await readFile(absolutePath)),
        );
      }
    }
  }

  await visit(root);
  return entries;
}

async function portfolioEntries() {
  return loadEntries(resolve(repositoryRoot, "fixtures/generated/portfolio"));
}

function cloneEntries(entries) {
  return new Map(
    [...entries].map(([path, content]) => [path, new Uint8Array(content)]),
  );
}

function snapshotEntries(entries) {
  return JSON.stringify(
    [...entries]
      .sort(([left], [right]) => compareText(left, right))
      .map(([path, content]) => [path, Buffer.from(content).toString("base64")]),
  );
}

function text(entries, path) {
  const content = entries.get(path);
  assert.ok(content, `missing fixture path: ${path}`);
  return decoder.decode(content);
}

function setText(entries, path, content) {
  entries.set(path, encoder.encode(content));
}

function createSnapshotReader(entries, overrides = new Map()) {
  const files = cloneEntries(entries);
  const fixedOverrides = new Map(overrides);

  return {
    async readText(path) {
      if (fixedOverrides.has(path)) {
        const override = fixedOverrides.get(path);

        if (override === "throw") {
          throw new Error("private repository reader detail");
        }

        return structuredClone(override);
      }

      const content = files.get(path);
      if (content === undefined) {
        return { kind: "missing" };
      }

      try {
        return { kind: "file", content: decoder.decode(content) };
      } catch {
        return { kind: "error", code: "FILE_ENCODING_INVALID" };
      }
    },
    async readBytes(path) {
      if (fixedOverrides.has(path)) {
        const override = fixedOverrides.get(path);
        if (override === "throw") {
          throw new Error("private repository reader detail");
        }
        if (override.kind === "file") {
          return { kind: "file", content: encoder.encode(override.content) };
        }
        return structuredClone(override);
      }
      const content = files.get(path);
      return content === undefined
        ? { kind: "missing" }
        : { kind: "file", content: new Uint8Array(content) };
    },
  };
}

async function planFromEntries(entries, options = {}) {
  const before = snapshotEntries(entries);
  const controlsBefore = new Map(
    controlPaths.map((path) => [path, new Uint8Array(entries.get(path))]),
  );
  const result = await core.planProfileTransition({
    reader: createSnapshotReader(entries, options.overrides),
    git: options.git ?? baseGit,
    toProfile: options.toProfile ?? "site",
  });

  assert.equal(snapshotEntries(entries), before);
  for (const [path, content] of controlsBefore) {
    assert.equal(sameBytes(entries.get(path), content), true, path);
  }

  return result;
}

function assertFailure(result, code) {
  assert.equal(result.ok, false);
  assert.deepEqual(result.issues.map(({ code: issueCode }) => issueCode), [code]);
  assert.doesNotMatch(
    JSON.stringify(result),
    /private repository reader detail|refs\/heads|profile-transition-worktree|profile-transition-common/u,
  );
}

async function renderEndpoints(entries) {
  const project = core.parseProjectYaml(text(entries, ".egeria/project.yaml"));
  assert.equal(project.ok, true);
  const settings = project.value.capabilitySettings["booking-calendly"];
  const common = {
    projectName: project.value.project.name,
    displayName: project.value.project.displayName,
    packageVersions: core.verifiedCapabilityPackageVersions,
    ...(settings === undefined ? {} : { bookingCalendly: settings }),
  };
  const [source, target] = await Promise.all([
    core.renderSkeleton({ ...common, profile: "portfolio" }),
    core.renderSkeleton({ ...common, profile: "site" }),
  ]);
  assert.equal(source.ok, true);
  assert.equal(target.ok, true);
  return { source: source.value, target: target.value };
}

function generatedFile(rendered, path) {
  const file = rendered.files.find((entry) => entry.path === path);
  assert.ok(file, `missing rendered path: ${path}`);
  return file.content;
}

function capabilitySubjects(rendered) {
  return rendered.resolved.capabilities
    .map(({ identifier, version }) => ({ identifier, version }))
    .sort((left, right) => compareText(left.identifier, right.identifier));
}

async function expectedActions(entries) {
  const { source, target } = await renderEndpoints(entries);
  const targetProject = core.serializeProjectYaml(target.project);
  const owners = new Map([
    [".egeria/project.yaml", ["managed", "builder-kernel"]],
    ["apps/web/app/about/page.tsx", ["application-owned", "site-routing"]],
    ["apps/web/content/en-CA/about.yaml", ["application-owned", "site-routing"]],
    [
      "apps/web/content/en-CA/long-form/introduction.md",
      ["application-owned", "content-files"],
    ],
    ["apps/web/content/en-CA/site.yaml", ["application-owned", "content-files"]],
    [
      "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
      ["application-owned", "standards"],
    ],
    [
      "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
      ["application-owned", "standards"],
    ],
  ]);

  return actionPaths.map((path) => {
    const [ownership, owner] = owners.get(path);
    const create = !entries.has(path);
    const current = create
      ? undefined
      : path === ".egeria/project.yaml"
        ? entries.get(path)
        : generatedFile(source, path);
    const targetContent =
      path === ".egeria/project.yaml"
        ? encoder.encode(targetProject)
        : generatedFile(target, path);

    return {
      kind: create ? "create-file" : "replace-file",
      path,
      ownership,
      owner,
      currentSubject: create
        ? { kind: "absent" }
        : {
            kind: "fingerprint",
            fingerprint: core.fingerprintFileContent(current),
          },
      targetFingerprint: core.fingerprintFileContent(targetContent),
    };
  });
}

test("the supported profile-transition matrix contains only exact portfolio 0.10.0 to site 0.10.0", () => {
  assert.deepEqual(
    core.resolveSupportedProfileTransition({
      fromProfile: "portfolio",
      fromRecipeVersion: "0.10.0",
      toProfile: "site",
      toRecipeVersion: "0.10.0",
    }),
    {
      ok: true,
      value: {
        source: { profile: "portfolio", recipeVersion: "0.10.0" },
        target: { profile: "site", recipeVersion: "0.10.0" },
      },
    },
  );

  const refusals = [
    ["site", "0.10.0", "site", "0.10.0", "PROFILE_ALREADY_CURRENT"],
    ["app", "0.10.0", "site", "0.10.0", "PROFILE_TRANSITION_SOURCE_UNSUPPORTED"],
    ["portfolio", "0.9.0", "site", "0.10.0", "PROFILE_TRANSITION_EDGE_MISSING"],
    ["portfolio", "0.10.0", "site", "0.9.0", "PROFILE_TRANSITION_EDGE_MISSING"],
    ["portfolio", "0.10.0", "portfolio", "0.10.0", "PROFILE_TRANSITION_UNSUPPORTED"],
    ["portfolio", "0.10.0", "app", "0.10.0", "PROFILE_TRANSITION_UNSUPPORTED"],
  ];

  for (const [fromProfile, fromRecipeVersion, toProfile, toRecipeVersion, code] of refusals) {
    assert.deepEqual(
      core.resolveSupportedProfileTransition({
        fromProfile,
        fromRecipeVersion,
        toProfile,
        toRecipeVersion,
      }),
      { ok: false, code },
    );
  }
});

test("portfolio-to-site planning returns the exact seven-action approval plan without mutation", async () => {
  const entries = await portfolioEntries();
  const result = await planFromEntries(entries);
  assert.equal(result.ok, true);
  const rendered = await renderEndpoints(entries);

  assert.deepEqual(result.value, {
    operation: "transition-profile",
    status: "approval-required",
    planFingerprint: result.value.planFingerprint,
    baseRevision: baseGit.identity.revision,
    source: {
      profile: "portfolio",
      recipeVersion: "0.10.0",
      capabilities: capabilitySubjects(rendered.source),
    },
    target: {
      profile: "site",
      recipeVersion: "0.10.0",
      capabilities: capabilitySubjects(rendered.target),
    },
    controlFiles: controlPaths.map((path) => ({
      path,
      fingerprint: core.fingerprintFileContent(entries.get(path)),
    })),
    actions: await expectedActions(entries),
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
  assert.match(result.value.planFingerprint, /^sha256:[a-f0-9]{64}$/u);
  assert.doesNotMatch(
    JSON.stringify(result.value),
    /Acme Portfolio|acme-portfolio|refs\/heads|profile-transition-worktree|profile-transition-common/u,
  );

  const repeated = await planFromEntries(entries);
  assert.deepEqual(repeated, result);
});

test("planning preserves exact optional Calendly selection while adding only site routing", async () => {
  const entries = await loadEntries(
    resolve(repositoryRoot, "fixtures/generated/portfolio-calendly"),
  );
  const result = await planFromEntries(entries);
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.value.target.capabilities.filter(
      ({ identifier }) => identifier === "booking-calendly" || identifier === "site-routing",
    ),
    [
      { identifier: "booking-calendly", version: "0.1.0" },
      { identifier: "site-routing", version: "0.3.0" },
    ],
  );
  assert.doesNotMatch(JSON.stringify(result.value), /calendly\.com/u);
});

test("planning refuses already-current, unsupported, inconsistent, and invalid controls without mutation", async () => {
  const portfolio = await portfolioEntries();
  const site = await loadEntries(resolve(repositoryRoot, "fixtures/generated/site"));
  assertFailure(await planFromEntries(site), "PROFILE_ALREADY_CURRENT");
  assertFailure(
    await planFromEntries(portfolio, { toProfile: "portfolio" }),
    "PROFILE_TRANSITION_UNSUPPORTED",
  );

  const projectOnlySite = cloneEntries(portfolio);
  const projectClaimingSite = core.parseProjectYaml(
    text(projectOnlySite, ".egeria/project.yaml"),
  );
  assert.equal(projectClaimingSite.ok, true);
  setText(
    projectOnlySite,
    ".egeria/project.yaml",
    core.serializeProjectYaml({
      ...projectClaimingSite.value,
      originProfile: "site",
    }),
  );
  assertFailure(
    await planFromEntries(projectOnlySite),
    "PROJECT_STATE_INCOMPATIBLE",
  );

  const oldRecipe = cloneEntries(portfolio);
  const oldProject = core.parseProjectYaml(text(oldRecipe, ".egeria/project.yaml"));
  assert.equal(oldProject.ok, true);
  setText(
    oldRecipe,
    ".egeria/project.yaml",
    core.serializeProjectYaml({ ...oldProject.value, recipeVersion: "0.9.0" }),
  );
  assertFailure(
    await planFromEntries(oldRecipe),
    "PROJECT_STATE_INCOMPATIBLE",
  );

  for (const [path, content] of [
    [".egeria/project.yaml", "not: [valid"],
    [".egeria/state.json", "{"],
    [".egeria/migrations.jsonl", "not-json\n"],
  ]) {
    const invalid = cloneEntries(portfolio);
    setText(invalid, path, content);
    assertFailure(await planFromEntries(invalid), "PROJECT_STATE_INCOMPATIBLE");
  }
});

test("planning refuses ambiguous source inference and present create-target collisions", async () => {
  const entries = await portfolioEntries();
  const { target } = await renderEndpoints(entries);

  const partial = cloneEntries(entries);
  partial.set(
    "apps/web/app/about/page.tsx",
    generatedFile(target, "apps/web/app/about/page.tsx"),
  );
  assertFailure(
    await planFromEntries(partial),
    "PROFILE_INFERENCE_AMBIGUOUS",
  );

  const collision = cloneEntries(entries);
  for (const path of [
    "apps/web/app/about/page.tsx",
    "apps/web/content/en-CA/about.yaml",
  ]) {
    collision.set(path, generatedFile(target, path));
  }
  assertFailure(
    await planFromEntries(collision),
    "PROFILE_TRANSITION_ACTION_CONFLICT",
  );
});

test("planning refuses state disagreement, inventory drift, source drift, and ejection", async () => {
  const entries = await portfolioEntries();

  const mismatchedState = cloneEntries(entries);
  const state = core.parseStateJson(text(entries, ".egeria/state.json"));
  assert.equal(state.ok, true);
  setText(
    mismatchedState,
    ".egeria/state.json",
    core.serializeStateJson({
      ...state.value,
      origin: { ...state.value.origin, profile: "site" },
    }),
  );
  assertFailure(
    await planFromEntries(mismatchedState),
    "PROJECT_STATE_INCOMPATIBLE",
  );

  const inventory = cloneEntries(entries);
  setText(
    inventory,
    ".egeria/state.json",
    core.serializeStateJson({
      ...state.value,
      managedSurfaces: state.value.managedSurfaces.slice(1),
    }),
  );
  assertFailure(await planFromEntries(inventory), "PROJECT_DRIFT_DETECTED");

  const drift = cloneEntries(entries);
  setText(
    drift,
    "apps/web/content/en-CA/site.yaml",
    `${text(drift, "apps/web/content/en-CA/site.yaml")}\nchanged: true\n`,
  );
  assertFailure(await planFromEntries(drift), "PROJECT_DRIFT_DETECTED");

  const binaryDrift = cloneEntries(entries);
  const visualPath =
    "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png";
  const changedVisual = new Uint8Array(binaryDrift.get(visualPath));
  changedVisual[changedVisual.length - 1] ^= 1;
  binaryDrift.set(visualPath, changedVisual);
  assertFailure(
    await planFromEntries(binaryDrift),
    "PROJECT_DRIFT_DETECTED",
  );

  const ejected = cloneEntries(entries);
  const project = core.parseProjectYaml(text(entries, ".egeria/project.yaml"));
  assert.equal(project.ok, true);
  const ejectedPath = "apps/web/content/en-CA/site.yaml";
  setText(
    ejected,
    ".egeria/project.yaml",
    core.serializeProjectYaml({ ...project.value, ejectedAreas: [ejectedPath] }),
  );
  setText(
    ejected,
    ".egeria/state.json",
    core.serializeStateJson({ ...state.value, ejections: [ejectedPath] }),
  );
  assertFailure(
    await planFromEntries(ejected),
    "PROJECT_EJECTION_UNSUPPORTED",
  );
});

test("planning contains unexpected reader failures and fingerprints every private input", async () => {
  const entries = await portfolioEntries();
  assertFailure(
    await planFromEntries(entries, {
      overrides: new Map([[".egeria/state.json", "throw"]]),
    }),
    "PROJECT_INSPECTION_INVALID",
  );

  const baseline = await planFromEntries(entries);
  assert.equal(baseline.ok, true);

  const reformattedState = cloneEntries(entries);
  const parsedState = JSON.parse(text(entries, ".egeria/state.json"));
  setText(
    reformattedState,
    ".egeria/state.json",
    `${JSON.stringify(parsedState, null, 4)}\n`,
  );
  const reformatted = await planFromEntries(reformattedState);
  assert.equal(reformatted.ok, true);
  assert.notEqual(
    reformatted.value.planFingerprint,
    baseline.value.planFingerprint,
  );

  const differentGit = await planFromEntries(entries, {
    git: {
      ok: true,
      identity: { ...baseGit.identity, attachedRef: "refs/heads/another-transition" },
    },
  });
  assert.equal(differentGit.ok, true);
  assert.notEqual(
    differentGit.value.planFingerprint,
    baseline.value.planFingerprint,
  );
});
