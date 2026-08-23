import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "../..");
const cliArguments = await import(
  pathToFileURL(resolve(packageRoot, "dist/arguments.js"))
);
const cli = await import(pathToFileURL(resolve(packageRoot, "dist/run-cli.js")));
const core = await import(
  pathToFileURL(resolve(repositoryRoot, "packages/builder-core/dist/index.js"))
);

const generatedChecks = [
  "lockfile",
  "frozen-install",
  "lint",
  "typecheck",
  "unit-tests",
  "component-tests",
  "next-build",
  "opennext-build",
];
const planSettings = {
  destination: "https://calendly.com/acme/private-planning-destination",
  mode: "popup",
};

function cleanGitInspection(overrides = {}) {
  return {
    ok: true,
    identity: {
      root: "/private/generated-worktree",
      revision: "abcdef0123456789abcdef0123456789abcdef01",
      attachedRef: "refs/heads/transactional-change",
      gitDirectory:
        "/private/generated-common/.git/worktrees/transactional-change",
      commonDirectory: "/private/generated-common/.git",
      ...overrides,
    },
  };
}

function expectedPlanActions() {
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

function expectedAdditionPlan(profile, revision, planFingerprint, mode = "popup") {
  const currentCapabilities = [
    "content-files",
    "deployment-cloudflare",
    "observability",
    "section-composition",
    ...(profile === "site" ? ["site-routing"] : []),
    "standards",
  ].sort();

  return {
    operation: "add-capability",
    status: "approval-required",
    planFingerprint,
    baseRevision: revision,
    profile,
    capability: {
      identifier: "booking-calendly",
      version: "0.1.0",
    },
    settings: { mode, destination: "redacted" },
    currentCapabilities,
    desiredCapabilities: ["booking-calendly", ...currentCapabilities].sort(),
    actions: expectedPlanActions(),
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

function expectedRemovalPlan(profile, revision, planFingerprint) {
  const desiredCapabilities = [
    "content-files",
    "deployment-cloudflare",
    "observability",
    "section-composition",
    ...(profile === "site" ? ["site-routing"] : []),
    "standards",
  ].sort();

  return {
    operation: "remove-capability",
    status: "approval-required",
    planFingerprint,
    baseRevision: revision,
    profile,
    capability: {
      identifier: "booking-calendly",
      version: "0.1.0",
    },
    currentCapabilities: ["booking-calendly", ...desiredCapabilities].sort(),
    desiredCapabilities,
    actions: [
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
    ],
    reviewRequirements: [
      {
        code: "review-surviving-references-to-removed-surfaces",
        scope: "repository",
      },
    ],
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

function assertSuccess(result) {
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  return result.value;
}

function createFakeVerifier() {
  return {
    async prepareLockfile(root) {
      await writeFile(join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
      return { ok: true, value: undefined };
    },
    verifyInIsolatedCopy() {
      return Promise.resolve({
        ok: true,
        value: { checks: generatedChecks },
      });
    },
  };
}

function captureOutput() {
  const standard = [];
  const error = [];

  return {
    output: {
      write(value) {
        standard.push(value);
      },
      writeError(value) {
        error.push(value);
      },
    },
    standard,
    error,
  };
}

function planAddArguments(directory, selectedSettings = planSettings) {
  return [
    "plan-add",
    "--directory",
    directory,
    "--capability",
    "booking-calendly",
    "--calendly-url",
    selectedSettings.destination,
    "--calendly-mode",
    selectedSettings.mode,
  ];
}

function planRemoveArguments(directory) {
  return [
    "plan-remove",
    "--directory",
    directory,
    "--capability",
    "booking-calendly",
  ];
}

function planUpgradeArguments(directory) {
  return [
    "plan-upgrade",
    "--directory",
    directory,
    "--capability",
    "standards",
    "--to-version",
    "0.4.0",
  ];
}

function applyAddArguments(
  directory,
  approvedPlan = `sha256:${"a".repeat(64)}`,
  selectedSettings = planSettings,
) {
  return [
    "apply-add",
    "--directory",
    directory,
    "--capability",
    "booking-calendly",
    "--calendly-url",
    selectedSettings.destination,
    "--calendly-mode",
    selectedSettings.mode,
    "--approved-plan",
    approvedPlan,
  ];
}

function applyRemoveArguments(
  directory,
  approvedPlan = `sha256:${"a".repeat(64)}`,
) {
  return [
    "apply-remove",
    "--directory",
    directory,
    "--capability",
    "booking-calendly",
    "--approved-plan",
    approvedPlan,
  ];
}

function applyUpgradeArguments(
  directory,
  approvedPlan = `sha256:${"a".repeat(64)}`,
) {
  return [
    "apply-upgrade",
    "--directory",
    directory,
    "--capability",
    "standards",
    "--to-version",
    "0.4.0",
    "--approved-plan",
    approvedPlan,
  ];
}

async function listTree(root) {
  const snapshot = [];

  async function visit(directory, relativeDirectory) {
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries.sort((left, right) =>
      left.name.localeCompare(right.name),
    )) {
      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${entry.name}`
        : entry.name;
      const absolutePath = join(directory, entry.name);

      if (entry.isDirectory()) {
        snapshot.push({ kind: "directory", path: relativePath });
        await visit(absolutePath, relativePath);
      } else {
        const stats = await lstat(absolutePath);
        assert.equal(stats.isFile(), true, relativePath);
        snapshot.push({
          kind: "file",
          path: relativePath,
          content: (await readFile(absolutePath)).toString("base64"),
        });
      }
    }
  }

  await visit(root, "");
  return snapshot;
}

async function executeNode(arguments_) {
  return new Promise((resolveResult) => {
    execFile(
      process.execPath,
      arguments_,
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        env: {
          PATH: process.env.PATH,
        },
      },
      (error, stdout, stderr) => {
        resolveResult({
          exitCode: error === null ? 0 : error.code,
          stdout,
          stderr,
        });
      },
    );
  });
}

async function withGeneratedFixture(run) {
  const owner = await mkdtemp(join(tmpdir(), "egeria-cli-test-"));
  const destination = join(owner, "acme-portfolio");

  try {
    assertSuccess(
      await core.generateProject({
        request: {
          profile: "portfolio",
          projectName: "acme-portfolio",
          displayName: "Acme Portfolio",
        },
        destination,
        verifier: createFakeVerifier(),
      }),
    );
    await run(destination);
  } finally {
    await rm(owner, { recursive: true, force: true });
  }
}

async function withGeneratedCalendlyFixture(profile, run) {
  const owner = await mkdtemp(join(tmpdir(), "egeria-cli-remove-test-"));
  const destination = join(owner, `acme-${profile}`);

  try {
    assertSuccess(
      await core.generateProject({
        request: {
          profile,
          projectName: `acme-${profile}`,
          displayName: `Acme ${profile}`,
          bookingCalendly: planSettings,
        },
        destination,
        verifier: createFakeVerifier(),
      }),
    );
    await run(destination);
  } finally {
    await rm(owner, { recursive: true, force: true });
  }
}

const currentStandardsSurfaceIdentifiers = new Set([
  "standards-playwright-visual-configuration",
  "standards-visual-regression-desktop-baseline",
  "standards-visual-regression-mobile-baseline",
  "standards-visual-regression-specification",
  "standards-visual-regression-test-script",
]);
const visualUpgradePaths = [
  "apps/web/playwright.visual.config.ts",
  "apps/web/tests/visual/home-visual.spec.ts",
  "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
];
const upgradeSourcePaths = [
  ".github/workflows/quality.yml",
  "apps/web/package.json",
  ...visualUpgradePaths,
];
const upgradeControlPaths = [
  ".egeria/project.yaml",
  ".egeria/state.json",
  ".egeria/migrations.jsonl",
];

async function prepareHistoricalUpgradeFixture(root) {
  for (const path of visualUpgradePaths) {
    await rm(join(root, path), { force: false });
  }

  const qualityPath = join(root, ".github/workflows/quality.yml");
  const quality = await readFile(qualityPath, "utf8");
  const visualStep = [
    "      - name: Compare OpenNext visual baselines",
    "        run: pnpm --dir apps/web run test:visual",
    "",
  ].join("\n");
  assert.equal(quality.includes(visualStep), true);
  const historicalQuality = quality.replace(visualStep, "");
  await writeFile(qualityPath, historicalQuality);

  const manifestPath = join(root, "apps/web/package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  delete manifest.scripts["test:visual"];
  await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);

  const projectPath = join(root, ".egeria/project.yaml");
  const statePath = join(root, ".egeria/state.json");
  const project = core.parseProjectYaml(await readFile(projectPath, "utf8"));
  const state = core.parseStateJson(await readFile(statePath, "utf8"));
  assert.equal(project.ok, true);
  assert.equal(state.ok, true);
  const projectSource = core.serializeProjectYaml({
    ...project.value,
    recipeVersion: "0.9.0",
  });
  const managedSurfaces = state.value.managedSurfaces
    .filter(({ identifier }) => !currentStandardsSurfaceIdentifiers.has(identifier))
    .map((surface) => {
      if (surface.identifier === "builder-project-configuration") {
        return {
          ...surface,
          fingerprint: core.fingerprintFileContent(
            new TextEncoder().encode(projectSource),
          ),
        };
      }

      if (surface.identifier === "standards-quality-workflow") {
        return {
          ...surface,
          fingerprint: core.fingerprintFileContent(
            new TextEncoder().encode(historicalQuality),
          ),
        };
      }

      return surface;
    });
  await writeFile(projectPath, projectSource);
  await writeFile(
    statePath,
    core.serializeStateJson({
      ...state.value,
      origin: { ...state.value.origin, recipeVersion: "0.9.0" },
      installedCapabilities: state.value.installedCapabilities.map(
        (capability) =>
          capability.identifier === "standards"
            ? { ...capability, version: "0.3.0" }
            : capability,
      ),
      managedSurfaces,
    }),
  );
}

async function withHistoricalUpgradeFixture(profile, run) {
  const owner = await mkdtemp(join(tmpdir(), "egeria-cli-upgrade-test-"));
  const destination = join(owner, `acme-${profile}`);

  try {
    await cp(resolve(repositoryRoot, `fixtures/generated/${profile}`), destination, {
      recursive: true,
    });
    await prepareHistoricalUpgradeFixture(destination);
    await run(destination);
  } finally {
    await rm(owner, { recursive: true, force: true });
  }
}

test("the parser accepts only the exact command-specific arguments", () => {
  assert.deepEqual(
    assertSuccess(
      cliArguments.parseCliArguments([
        "create",
        "--profile",
        "portfolio",
        "--name",
        "acme-portfolio",
        "--display-name",
        "Acme Portfolio",
        "--directory",
        "/private/tmp/acme-portfolio",
      ]),
    ),
    {
      kind: "create",
      profile: "portfolio",
      projectName: "acme-portfolio",
      displayName: "Acme Portfolio",
      directory: "/private/tmp/acme-portfolio",
    },
  );

  for (const mode of ["link", "inline", "popup"]) {
    assert.deepEqual(
      assertSuccess(
        cliArguments.parseCliArguments([
          "create",
          "--profile",
          "portfolio",
          "--name",
          "acme-portfolio",
          "--display-name",
          "Acme Portfolio",
          "--directory",
          "/private/tmp/acme-portfolio",
          "--calendly-url",
          "https://calendly.com/acme/intro",
          "--calendly-mode",
          mode,
        ]),
      ),
      {
        kind: "create",
        profile: "portfolio",
        projectName: "acme-portfolio",
        displayName: "Acme Portfolio",
        directory: "/private/tmp/acme-portfolio",
        bookingCalendly: {
          destination: "https://calendly.com/acme/intro",
          mode,
        },
      },
    );
  }

  for (const kind of ["infer", "doctor", "diff"]) {
    assert.deepEqual(
      assertSuccess(
        cliArguments.parseCliArguments([
          kind,
          "--directory",
          "/private/tmp/acme-portfolio",
        ]),
      ),
      { kind, directory: "/private/tmp/acme-portfolio" },
    );
  }
});

test("the plan-add parser accepts exact options in any order", () => {
  const expected = {
    kind: "plan-add",
    directory: "/private/tmp/acme-portfolio",
    capability: "booking-calendly",
    settings: {
      destination: "https://calendly.com/acme/intro",
      mode: "popup",
    },
  };
  const ordered = [
    "plan-add",
    "--directory",
    "/private/tmp/acme-portfolio",
    "--capability",
    "booking-calendly",
    "--calendly-url",
    "https://calendly.com/acme/intro",
    "--calendly-mode",
    "popup",
  ];
  const reordered = [
    "plan-add",
    "--calendly-mode",
    "popup",
    "--calendly-url",
    "https://calendly.com/acme/intro",
    "--capability",
    "booking-calendly",
    "--directory",
    "/private/tmp/acme-portfolio",
  ];

  assert.deepEqual(assertSuccess(cliArguments.parseCliArguments(ordered)), expected);
  assert.deepEqual(
    assertSuccess(cliArguments.parseCliArguments(reordered)),
    expected,
  );
});

test("the plan-add parser rejects incomplete, duplicate, unknown, and unsafe values", () => {
  const valid = [
    "plan-add",
    "--directory",
    "/private/tmp/acme-portfolio",
    "--capability",
    "booking-calendly",
    "--calendly-url",
    "https://calendly.com/acme/intro",
    "--calendly-mode",
    "popup",
  ];
  const invalidCases = [
    valid.slice(0, -2),
    [...valid, "--directory", "/private/tmp/other"],
    [...valid, "--unknown", "private-value"],
    valid.map((value) =>
      value === "booking-calendly" ? "invented-capability" : value,
    ),
    valid.map((value) => (value === "popup" ? "modal" : value)),
    valid.map((value) =>
      value === "https://calendly.com/acme/intro"
        ? "https://calendar.example/private"
        : value,
    ),
    valid.map((value) =>
      value === "/private/tmp/acme-portfolio" ? "bad\0directory" : value,
    ),
  ];

  for (const arguments_ of invalidCases) {
    const result = cliArguments.parseCliArguments(arguments_);
    assert.equal(result.ok, false, JSON.stringify(arguments_));
    assert.deepEqual(result.issues, [
      {
        code: "CLI_ARGUMENT_INVALID",
        path: [],
        context: { reason: "invalid-arguments" },
      },
    ]);
    assert.doesNotMatch(
      JSON.stringify(result),
      /invented-capability|calendar\.example|private-value|bad\\u0000directory/u,
    );
  }
});

test("the plan-remove parser accepts only its exact options in any order", () => {
  const expected = {
    kind: "plan-remove",
    directory: "/private/tmp/acme-portfolio",
    capability: "booking-calendly",
  };
  assert.deepEqual(
    assertSuccess(
      cliArguments.parseCliArguments(
        planRemoveArguments("/private/tmp/acme-portfolio"),
      ),
    ),
    expected,
  );
  assert.deepEqual(
    assertSuccess(
      cliArguments.parseCliArguments([
        "plan-remove",
        "--capability",
        "booking-calendly",
        "--directory",
        "/private/tmp/acme-portfolio",
      ]),
    ),
    expected,
  );

  const invalidCases = [
    planRemoveArguments("/private/tmp/acme-portfolio").slice(0, -2),
    [
      ...planRemoveArguments("/private/tmp/acme-portfolio"),
      "--directory",
      "/private/tmp/other",
    ],
    [
      ...planRemoveArguments("/private/tmp/acme-portfolio"),
      "--unknown",
      "private-value",
    ],
    [
      "plan-remove",
      "--dir",
      "/private/tmp/acme-portfolio",
      "--capability",
      "booking-calendly",
    ],
    planRemoveArguments("/private/tmp/acme-portfolio").map((value) =>
      value === "booking-calendly" ? "invented-capability" : value,
    ),
    planRemoveArguments("bad\0directory"),
    [...planRemoveArguments("/private/tmp/acme-portfolio"), "--calendly-mode", "popup"],
  ];

  for (const arguments_ of invalidCases) {
    const result = cliArguments.parseCliArguments(arguments_);
    assert.equal(result.ok, false, JSON.stringify(arguments_));
    assert.deepEqual(result.issues, [
      {
        code: "CLI_ARGUMENT_INVALID",
        path: [],
        context: { reason: "invalid-arguments" },
      },
    ]);
    assert.doesNotMatch(
      JSON.stringify(result),
      /invented-capability|private-value|bad\\u0000directory/u,
    );
  }
});

test("the plan-upgrade parser accepts only its exact absolute-worktree contract", () => {
  const expected = {
    kind: "plan-upgrade",
    directory: "/private/tmp/acme-portfolio",
    capability: "standards",
    toVersion: "0.4.0",
  };
  const valid = planUpgradeArguments("/private/tmp/acme-portfolio");
  assert.deepEqual(
    assertSuccess(cliArguments.parseCliArguments(valid)),
    expected,
  );
  assert.deepEqual(
    assertSuccess(
      cliArguments.parseCliArguments([
        "plan-upgrade",
        "--to-version",
        "0.4.0",
        "--capability",
        "standards",
        "--directory",
        "/private/tmp/acme-portfolio",
      ]),
    ),
    expected,
  );

  const invalidCases = [
    valid.slice(0, -2),
    [...valid, "--directory", "/private/tmp/other"],
    [...valid, "--unknown", "private-value"],
    [...valid, "--from-version", "0.3.0"],
    valid.map((value) => (value === "standards" ? "observability" : value)),
    valid.map((value) => (value === "0.4.0" ? "0.5.0" : value)),
    planUpgradeArguments("relative/project"),
    planUpgradeArguments("bad\0directory"),
  ];

  for (const arguments_ of invalidCases) {
    const result = cliArguments.parseCliArguments(arguments_);
    assert.equal(result.ok, false, JSON.stringify(arguments_));
    assert.deepEqual(result.issues, [
      {
        code: "CLI_ARGUMENT_INVALID",
        path: [],
        context: { reason: "invalid-arguments" },
      },
    ]);
    assert.doesNotMatch(
      JSON.stringify(result),
      /observability|0\.5\.0|private-value|bad\\u0000directory/u,
    );
  }
});

test("the apply-add parser accepts only the exact approved transaction arguments", () => {
  const fingerprint = `sha256:${"a".repeat(64)}`;
  assert.deepEqual(
    assertSuccess(
      cliArguments.parseCliArguments(
        applyAddArguments("/private/tmp/acme-portfolio", fingerprint),
      ),
    ),
    {
      kind: "apply-add",
      directory: "/private/tmp/acme-portfolio",
      capability: "booking-calendly",
      settings: planSettings,
      approvedPlanFingerprint: fingerprint,
    },
  );

  for (const arguments_ of [
    applyAddArguments("/private/tmp/acme-portfolio").slice(0, -2),
    [...applyAddArguments("/private/tmp/acme-portfolio"), "--unknown", "x"],
    applyAddArguments("/private/tmp/acme-portfolio", "sha256:short"),
    applyAddArguments("/private/tmp/acme-portfolio", `sha256:${"A".repeat(64)}`),
    [
      ...applyAddArguments("/private/tmp/acme-portfolio"),
      "--approved-plan",
      fingerprint,
    ],
  ]) {
    const result = cliArguments.parseCliArguments(arguments_);
    assert.equal(result.ok, false);
    assert.deepEqual(result.issues, [
      {
        code: "CLI_ARGUMENT_INVALID",
        path: [],
        context: { reason: "invalid-arguments" },
      },
    ]);
  }
});

test("the apply-remove parser accepts only the exact approved removal arguments", () => {
  const fingerprint = `sha256:${"a".repeat(64)}`;
  assert.deepEqual(
    assertSuccess(
      cliArguments.parseCliArguments(
        applyRemoveArguments("/private/tmp/acme-portfolio", fingerprint),
      ),
    ),
    {
      kind: "apply-remove",
      directory: "/private/tmp/acme-portfolio",
      capability: "booking-calendly",
      approvedPlanFingerprint: fingerprint,
    },
  );
  assert.deepEqual(
    assertSuccess(
      cliArguments.parseCliArguments([
        "apply-remove",
        "--approved-plan",
        fingerprint,
        "--capability",
        "booking-calendly",
        "--directory",
        "/private/tmp/acme-portfolio",
      ]),
    ),
    {
      kind: "apply-remove",
      directory: "/private/tmp/acme-portfolio",
      capability: "booking-calendly",
      approvedPlanFingerprint: fingerprint,
    },
  );

  for (const arguments_ of [
    applyRemoveArguments("/private/tmp/acme-portfolio").slice(0, -2),
    [...applyRemoveArguments("/private/tmp/acme-portfolio"), "--unknown", "x"],
    applyRemoveArguments("/private/tmp/acme-portfolio", "sha256:short"),
    applyRemoveArguments(
      "/private/tmp/acme-portfolio",
      `sha256:${"A".repeat(64)}`,
    ),
    [
      ...applyRemoveArguments("/private/tmp/acme-portfolio"),
      "--calendly-mode",
      "popup",
    ],
    [
      ...applyRemoveArguments("/private/tmp/acme-portfolio"),
      "--approved-plan",
      fingerprint,
    ],
    applyRemoveArguments(""),
    applyRemoveArguments("bad\0directory"),
    applyRemoveArguments("/private/tmp/acme-portfolio").map((value) =>
      value === "booking-calendly" ? "invented-capability" : value,
    ),
  ]) {
    const result = cliArguments.parseCliArguments(arguments_);
    assert.equal(result.ok, false);
    assert.deepEqual(result.issues, [
      {
        code: "CLI_ARGUMENT_INVALID",
        path: [],
        context: { reason: "invalid-arguments" },
      },
    ]);
  }
});

test("the apply-upgrade parser accepts only the exact approved standards edge", () => {
  const fingerprint = `sha256:${"a".repeat(64)}`;
  const expected = {
    kind: "apply-upgrade",
    directory: "/private/tmp/acme-portfolio",
    capability: "standards",
    toVersion: "0.4.0",
    approvedPlanFingerprint: fingerprint,
  };
  const valid = applyUpgradeArguments(
    "/private/tmp/acme-portfolio",
    fingerprint,
  );

  assert.deepEqual(
    assertSuccess(cliArguments.parseCliArguments(valid)),
    expected,
  );
  assert.deepEqual(
    assertSuccess(
      cliArguments.parseCliArguments([
        "apply-upgrade",
        "--approved-plan",
        fingerprint,
        "--to-version",
        "0.4.0",
        "--capability",
        "standards",
        "--directory",
        "/private/tmp/acme-portfolio",
      ]),
    ),
    expected,
  );

  const invalidCases = [
    valid.slice(0, -2),
    valid.slice(0, -4),
    [...valid, "--approved-plan", fingerprint],
    [...valid, "--directory", "/private/tmp/other"],
    [...valid, "--unknown", "private-value"],
    [...valid, "private-positional"],
    [...valid, "--from-version", "0.3.0"],
    [...valid, "--from-version=0.3.0"],
    ["apply-upgrade", "--from-version", "0.3.0", ...valid.slice(1)],
    applyUpgradeArguments("/private/tmp/acme-portfolio", "sha256:short"),
    applyUpgradeArguments(
      "/private/tmp/acme-portfolio",
      `sha256:${"A".repeat(64)}`,
    ),
    valid.map((value) => (value === "standards" ? "observability" : value)),
    valid.map((value) => (value === "0.4.0" ? "0.5.0" : value)),
    applyUpgradeArguments(""),
    applyUpgradeArguments("relative/project"),
    applyUpgradeArguments("bad\0directory"),
  ];

  for (const arguments_ of invalidCases) {
    const result = cliArguments.parseCliArguments(arguments_);
    assert.equal(result.ok, false, JSON.stringify(arguments_));
    assert.deepEqual(result.issues, [
      {
        code: "CLI_ARGUMENT_INVALID",
        path: [],
        context: { reason: "invalid-arguments" },
      },
    ]);
    assert.doesNotMatch(
      JSON.stringify(result),
      /private-value|private-positional|observability|0\.5\.0|bad\\u0000directory/u,
    );
  }
});

test("the parser rejects missing, repeated, unknown, abbreviated, and crossed arguments", () => {
  const invalidCases = [
    [],
    ["unknown", "--directory", "/private/tmp/example"],
    ["infer"],
    ["infer", "--directory", "/tmp/a", "--directory", "/tmp/b"],
    ["infer", "--directory", "/tmp/a", "--profile", "site"],
    ["infer", "--directory", "/tmp/a", "extra"],
    ["infer", "--dir", "/tmp/a"],
    [
      "create",
      "--profile",
      "application",
      "--name",
      "acme",
      "--display-name",
      "Acme",
      "--directory",
      "/tmp/acme",
    ],
    [
      "create",
      "--profile",
      "site",
      "--name",
      "Not-Kebab",
      "--display-name",
      "Acme",
      "--directory",
      "/tmp/acme",
    ],
    [
      "create",
      "--profile",
      "site",
      "--name",
      "acme",
      "--display-name",
      "   ",
      "--directory",
      "/tmp/acme",
    ],
    [
      "create",
      "--profile",
      "portfolio",
      "--name",
      "acme",
      "--display-name",
      "Acme",
      "--directory",
      "/tmp/acme",
      "--calendly-url",
      "https://calendly.com/acme/intro",
    ],
    [
      "create",
      "--profile",
      "portfolio",
      "--name",
      "acme",
      "--display-name",
      "Acme",
      "--directory",
      "/tmp/acme",
      "--calendly-mode",
      "popup",
    ],
    [
      "create",
      "--profile",
      "portfolio",
      "--name",
      "acme",
      "--display-name",
      "Acme",
      "--directory",
      "/tmp/acme",
      "--calendly-url",
      "https://calendar.example/private",
      "--calendly-mode",
      "popup",
    ],
  ];

  for (const arguments_ of invalidCases) {
    const result = cliArguments.parseCliArguments(arguments_);
    assert.equal(result.ok, false, JSON.stringify(arguments_));
    assert.deepEqual(
      result.issues,
      [
        {
          code: "CLI_ARGUMENT_INVALID",
          path: [],
          context: { reason: "invalid-arguments" },
        },
      ],
      JSON.stringify(arguments_),
    );
    assert.doesNotMatch(
      JSON.stringify(result),
      /Not-Kebab|application|\/tmp\/b|calendar\.example|private/u,
    );
  }
});

test("the runner forwards paired Calendly selection without exposing its URL", async () => {
  const owner = await mkdtemp(join(tmpdir(), "egeria-cli-calendly-"));
  const destination = join(owner, "acme-portfolio");
  const fakeVerifier = createFakeVerifier();
  const runCli = cli.createCliRunner({
    createVerifier: () => fakeVerifier,
  });
  const captured = captureOutput();

  try {
    assert.equal(
      await runCli(
        [
          "create",
          "--profile",
          "portfolio",
          "--name",
          "acme-portfolio",
          "--display-name",
          "Acme Portfolio",
          "--directory",
          destination,
          "--calendly-url",
          "https://calendly.com/acme/private-intro",
          "--calendly-mode",
          "popup",
        ],
        captured.output,
      ),
      0,
    );
    assert.deepEqual(captured.error, []);
    assert.deepEqual(captured.standard, [
      JSON.stringify({
        ok: true,
        command: "create",
        destination: await realpath(destination),
        profile: "portfolio",
        capabilities: [
          "standards",
          "content-files",
          "section-composition",
          "deployment-cloudflare",
          "observability",
          "booking-calendly",
        ],
      }),
    ]);
    assert.doesNotMatch(captured.standard[0], /private-intro|calendly\.com/u);
  } finally {
    await rm(owner, { recursive: true, force: true });
  }
});

test("the runner emits exact create success and sanitized failure JSON", async () => {
  const owner = await mkdtemp(join(tmpdir(), "egeria-cli-create-"));
  const destination = join(owner, "acme-portfolio");
  const runCli = cli.createCliRunner({
    createVerifier: createFakeVerifier,
  });

  try {
    const success = captureOutput();
    assert.equal(
      await runCli(
        [
          "create",
          "--profile",
          "portfolio",
          "--name",
          "acme-portfolio",
          "--display-name",
          "Acme Portfolio",
          "--directory",
          destination,
        ],
        success.output,
      ),
      0,
    );
    assert.deepEqual(success.error, []);
    assert.deepEqual(success.standard, [
      JSON.stringify({
        ok: true,
        command: "create",
        destination: await realpath(destination),
        profile: "portfolio",
        capabilities: [
          "standards",
          "content-files",
          "section-composition",
          "deployment-cloudflare",
          "observability",
        ],
      }),
    ]);

    const failure = captureOutput();
    assert.equal(
      await runCli(
        [
          "create",
          "--profile",
          "portfolio",
          "--name",
          "acme-portfolio",
          "--display-name",
          "Acme Portfolio",
          "--directory",
          destination,
        ],
        failure.output,
      ),
      1,
    );
    assert.deepEqual(failure.standard, []);
    assert.deepEqual(failure.error, [
      JSON.stringify({
        ok: false,
        command: "create",
        issues: [
          {
            code: "DESTINATION_EXISTS",
            path: [],
            context: { reason: "already-exists" },
          },
        ],
      }),
    ]);
  } finally {
    await rm(owner, { recursive: true, force: true });
  }
});

test("invalid CLI input emits one content-free JSON error and exit two", async () => {
  const captured = captureOutput();
  const exitCode = await cli.runCli(
    ["infer", "--unknown", "private-value"],
    captured.output,
  );

  assert.equal(exitCode, 2);
  assert.deepEqual(captured.standard, []);
  assert.deepEqual(captured.error, [
    JSON.stringify({ ok: false, code: "CLI_ARGUMENT_INVALID" }),
  ]);
  assert.doesNotMatch(captured.error[0], /private-value|Unknown option|parseArgs/);
});

test("repository open failures emit one content-free JSON error", async () => {
  const captured = captureOutput();
  const runCli = cli.createCliRunner({
    createVerifier: createFakeVerifier,
    createReader() {
      throw new Error("private directory detail");
    },
  });

  assert.equal(
    await runCli(
      ["infer", "--directory", "/private/tmp/private-project"],
      captured.output,
    ),
    1,
  );
  assert.deepEqual(captured.standard, []);
  assert.deepEqual(captured.error, [
    JSON.stringify({ ok: false, code: "REPOSITORY_OPEN_FAILED" }),
  ]);
  assert.doesNotMatch(captured.error[0], /private-project|private directory detail/);
});

test("real invalid repository roots emit the sanitized open failure", async () => {
  const owner = await mkdtemp(join(tmpdir(), "egeria-cli-roots-"));
  const missingRoot = join(owner, "missing");
  const fileRoot = join(owner, "file");
  const directoryRoot = join(owner, "directory");
  const symlinkRoot = join(owner, "symlink");

  try {
    await writeFile(fileRoot, "not a repository\n");
    await mkdir(directoryRoot);
    await symlink(directoryRoot, symlinkRoot, "dir");

    for (const root of [missingRoot, fileRoot, symlinkRoot]) {
      const captured = captureOutput();
      assert.equal(
        await cli.runCli(["infer", "--directory", root], captured.output),
        1,
      );
      assert.deepEqual(captured.standard, []);
      assert.deepEqual(captured.error, [
        JSON.stringify({ ok: false, code: "REPOSITORY_OPEN_FAILED" }),
      ]);
      assert.equal(captured.error[0].includes(root), false);
    }
  } finally {
    await rm(owner, { recursive: true, force: true });
  }
});

test("infer, doctor, and diff preserve every fixture path and byte", async () => {
  await withGeneratedFixture(async (directory) => {
    const catalog = assertSuccess(core.createVerifiedCapabilityCatalog());
    const operations = [
      {
        kind: "infer",
        expected: await core.inferRepository({
          reader: core.createFileSystemRepositoryReader(directory),
          catalog,
        }),
        exitCode: 0,
      },
      {
        kind: "doctor",
        expected: await core.doctorRepository({
          reader: core.createFileSystemRepositoryReader(directory),
          catalog,
          profiles: core.profileRecipes,
        }),
        exitCode: 0,
      },
      {
        kind: "diff",
        expected: await core.diffProject({
          reader: core.createFileSystemRepositoryReader(directory),
          catalog,
          profiles: core.profileRecipes,
        }),
        exitCode: 0,
      },
    ];
    const original = await listTree(directory);

    for (const operation of operations) {
      const captured = captureOutput();
      assert.equal(
        await cli.runCli(
          [operation.kind, "--directory", directory],
          captured.output,
        ),
        operation.exitCode,
      );
      assert.deepEqual(captured.error, []);
      assert.deepEqual(captured.standard, [
        JSON.stringify({
          ok: true,
          command: operation.kind,
          result: operation.expected,
        }),
      ]);
      assert.deepEqual(await listTree(directory), original);
    }
  });
});

test("doctor and diff return exit one for diagnosed repository drift", async () => {
  await withGeneratedFixture(async (directory) => {
    await writeFile(join(directory, "pnpm-lock.yaml"), "drift\n");

    for (const kind of ["doctor", "diff"]) {
      const captured = captureOutput();
      assert.equal(
        await cli.runCli([kind, "--directory", directory], captured.output),
        1,
      );
      assert.deepEqual(captured.error, []);
      assert.equal(JSON.parse(captured.standard[0]).command, kind);
    }
  });
});

test("plan-add emits the complete approval-required envelope after two matching inspections", async () => {
  const inspection = cleanGitInspection();
  const inspections = [inspection, structuredClone(inspection)];
  const runCli = cli.createCliRunner({
    createVerifier: createFakeVerifier,
    createReader: () =>
      core.createFileSystemRepositoryReader(
        resolve(repositoryRoot, "fixtures/generated/portfolio"),
      ),
    inspectGitWorktree: () => Promise.resolve(inspections.shift()),
    inspectGitCreateTargets: () => Promise.resolve({ ok: true }),
  });
  const captured = captureOutput();

  assert.equal(
    await runCli(planAddArguments("/private/ignored-input"), captured.output),
    0,
  );
  assert.deepEqual(inspections, []);
  assert.deepEqual(captured.error, []);
  const emitted = JSON.parse(captured.standard[0]);
  assert.match(emitted.result.planFingerprint, /^sha256:[a-f0-9]{64}$/u);
  assert.deepEqual(emitted, {
    ok: true,
    command: "plan-add",
    result: expectedAdditionPlan(
      "portfolio",
      inspection.identity.revision,
      emitted.result.planFingerprint,
    ),
  });
  assert.doesNotMatch(
    captured.standard[0],
    /private-planning-destination|calendly\.com|refs\/heads|generated-common/u,
  );
});

test("plan-remove emits the complete approval-required plan after two matching inspections", async () => {
  await withGeneratedCalendlyFixture("portfolio", async (directory) => {
    const inspection = cleanGitInspection();
    const inspections = [inspection, structuredClone(inspection)];
    const runCli = cli.createCliRunner({
      createVerifier: createFakeVerifier,
      createReader: () => core.createFileSystemRepositoryReader(directory),
      inspectGitWorktree: () => Promise.resolve(inspections.shift()),
    });
    const captured = captureOutput();

    assert.equal(
      await runCli(
        planRemoveArguments("/private/ignored-input"),
        captured.output,
      ),
      0,
    );
    assert.deepEqual(inspections, []);
    assert.deepEqual(captured.error, []);
    const emitted = JSON.parse(captured.standard[0]);
    assert.match(emitted.plan.planFingerprint, /^sha256:[a-f0-9]{64}$/u);
    assert.deepEqual(emitted, {
      ok: true,
      command: "plan-remove",
      plan: expectedRemovalPlan(
        "portfolio",
        inspection.identity.revision,
        emitted.plan.planFingerprint,
      ),
    });
    assert.doesNotMatch(
      captured.standard[0],
      /private-planning-destination|calendly\.com|refs\/heads|generated-common/u,
    );
  });
});

test("plan-upgrade emits the exact read-only plan after stable Git and target checks", async () => {
  await withHistoricalUpgradeFixture("portfolio", async (directory) => {
    const inspection = cleanGitInspection();
    const inspections = [inspection, structuredClone(inspection)];
    const runCli = cli.createCliRunner({
      createVerifier: createFakeVerifier,
      createReader: () => core.createFileSystemRepositoryReader(directory),
      inspectGitWorktree: () => Promise.resolve(inspections.shift()),
      inspectGitCreateTargets: ({ paths }) => {
        assert.deepEqual(paths, visualUpgradePaths);
        return Promise.resolve({ ok: true });
      },
    });
    const before = await listTree(directory);
    const direct = await core.planCapabilityUpgrade({
      reader: core.createFileSystemRepositoryReader(directory),
      git: inspection,
      capability: "standards",
      toVersion: "0.4.0",
    });
    assert.equal(direct.ok, true);
    const captured = captureOutput();

    assert.equal(
      await runCli(
        planUpgradeArguments("/private/ignored-input"),
        captured.output,
      ),
      0,
    );
    assert.deepEqual(inspections, []);
    assert.deepEqual(captured.error, []);
    assert.deepEqual(JSON.parse(captured.standard[0]), {
      ok: true,
      command: "plan-upgrade",
      plan: direct.value,
    });
    assert.deepEqual(await listTree(directory), before);
    assert.doesNotMatch(
      captured.standard[0],
      /refs\/heads|generated-common|generated-worktree|ignored-input/u,
    );
  });
});

test("plan-upgrade contains planner, target, Git, and reader refusals", async () => {
  await withHistoricalUpgradeFixture("portfolio", async (directory) => {
    const cases = [
      {
        name: "dirty Git",
        inspections: [{ ok: false, code: "GIT_WORKTREE_DIRTY" }],
        code: "GIT_WORKTREE_DIRTY",
      },
      {
        name: "identity changed",
        inspections: [
          cleanGitInspection(),
          cleanGitInspection({
            revision: "1111111111111111111111111111111111111111",
          }),
        ],
        code: "GIT_WORKTREE_CHANGED",
      },
    ];

    for (const fixture of cases) {
      const inspections = structuredClone(fixture.inspections);
      const runCli = cli.createCliRunner({
        createVerifier: createFakeVerifier,
        createReader: () => core.createFileSystemRepositoryReader(directory),
        inspectGitCreateTargets: () => Promise.resolve({ ok: true }),
        inspectGitWorktree: () => Promise.resolve(inspections.shift()),
      });
      const captured = captureOutput();
      assert.equal(
        await runCli(planUpgradeArguments(directory), captured.output),
        1,
        fixture.name,
      );
      assert.deepEqual(captured.standard, [], fixture.name);
      assert.deepEqual(
        captured.error,
        [
          JSON.stringify({
            ok: false,
            command: "plan-upgrade",
            code: fixture.code,
          }),
        ],
        fixture.name,
      );
    }

    const targetRunner = cli.createCliRunner({
      createVerifier: createFakeVerifier,
      createReader: () => core.createFileSystemRepositoryReader(directory),
      inspectGitCreateTargets: () =>
        Promise.resolve({ ok: false, code: "CAPABILITY_ACTION_CONFLICT" }),
      inspectGitWorktree: () => Promise.resolve(cleanGitInspection()),
    });
    const target = captureOutput();
    assert.equal(
      await targetRunner(planUpgradeArguments(directory), target.output),
      1,
    );
    assert.deepEqual(target.error, [
      JSON.stringify({
        ok: false,
        command: "plan-upgrade",
        code: "CAPABILITY_ACTION_CONFLICT",
      }),
    ]);

    const readerRunner = cli.createCliRunner({
      createVerifier: createFakeVerifier,
      createReader: () => ({
        readText() {
          throw new Error("private reader failure");
        },
      }),
      inspectGitWorktree: () => Promise.resolve(cleanGitInspection()),
    });
    const reader = captureOutput();
    assert.equal(
      await readerRunner(planUpgradeArguments(directory), reader.output),
      1,
    );
    assert.deepEqual(reader.error, [
      JSON.stringify({
        ok: false,
        command: "plan-upgrade",
        code: "REPOSITORY_OPEN_FAILED",
      }),
    ]);
    assert.doesNotMatch(reader.error[0], /private reader failure/u);
  });
});

test("plan-remove reports exact absence and contains final identity changes", async () => {
  await withGeneratedFixture(async (directory) => {
    const inspection = cleanGitInspection();
    const runCli = cli.createCliRunner({
      createVerifier: createFakeVerifier,
      createReader: () => core.createFileSystemRepositoryReader(directory),
      inspectGitWorktree: () => Promise.resolve(structuredClone(inspection)),
    });
    const captured = captureOutput();

    assert.equal(
      await runCli(
        planRemoveArguments("/private/ignored-input"),
        captured.output,
      ),
      1,
    );
    assert.deepEqual(captured.standard, []);
    assert.deepEqual(captured.error, [
      JSON.stringify({
        ok: false,
        command: "plan-remove",
        code: "CAPABILITY_NOT_INSTALLED",
        capability: "booking-calendly",
      }),
    ]);
  });

  await withGeneratedFixture(async (directory) => {
    const inspections = [
      cleanGitInspection(),
      cleanGitInspection({
        revision: "1111111111111111111111111111111111111111",
      }),
    ];
    const runCli = cli.createCliRunner({
      createVerifier: createFakeVerifier,
      createReader: () => core.createFileSystemRepositoryReader(directory),
      inspectGitWorktree: () => Promise.resolve(inspections.shift()),
    });
    const captured = captureOutput();

    assert.equal(
      await runCli(
        planRemoveArguments("/private/ignored-input"),
        captured.output,
      ),
      1,
    );
    assert.deepEqual(captured.standard, []);
    assert.deepEqual(captured.error, [
      JSON.stringify({
        ok: false,
        command: "plan-remove",
        code: "GIT_WORKTREE_CHANGED",
      }),
    ]);
  });

  await withGeneratedCalendlyFixture("portfolio", async (directory) => {
    const inspections = [
      cleanGitInspection(),
      cleanGitInspection({
        revision: "1111111111111111111111111111111111111111",
      }),
    ];
    const runCli = cli.createCliRunner({
      createVerifier: createFakeVerifier,
      createReader: () => core.createFileSystemRepositoryReader(directory),
      inspectGitWorktree: () => Promise.resolve(inspections.shift()),
    });
    const captured = captureOutput();

    assert.equal(
      await runCli(
        planRemoveArguments("/private/ignored-input"),
        captured.output,
      ),
      1,
    );
    assert.deepEqual(captured.standard, []);
    assert.deepEqual(captured.error, [
      JSON.stringify({
        ok: false,
        command: "plan-remove",
        code: "GIT_WORKTREE_CHANGED",
      }),
    ]);
  });
});

test("plan-remove maps Git and repository failures without disclosing internals", async () => {
  const gitRunner = cli.createCliRunner({
    createVerifier: createFakeVerifier,
    inspectGitWorktree: () =>
      Promise.resolve({ ok: false, code: "GIT_WORKTREE_DIRTY" }),
  });
  const gitFailure = captureOutput();
  assert.equal(
    await gitRunner(
      planRemoveArguments("/private/ignored-input"),
      gitFailure.output,
    ),
    1,
  );
  assert.deepEqual(gitFailure.standard, []);
  assert.deepEqual(gitFailure.error, [
    JSON.stringify({
      ok: false,
      command: "plan-remove",
      code: "GIT_WORKTREE_DIRTY",
    }),
  ]);

  const readerRunner = cli.createCliRunner({
    createVerifier: createFakeVerifier,
    createReader: () => ({
      readText() {
        throw new Error("private repository reader failure");
      },
    }),
    inspectGitWorktree: () => Promise.resolve(cleanGitInspection()),
  });
  const readerFailure = captureOutput();
  assert.equal(
    await readerRunner(
      planRemoveArguments("/private/ignored-input"),
      readerFailure.output,
    ),
    1,
  );
  assert.deepEqual(readerFailure.standard, []);
  assert.deepEqual(readerFailure.error, [
    JSON.stringify({
      ok: false,
      command: "plan-remove",
      code: "REPOSITORY_OPEN_FAILED",
    }),
  ]);
  assert.doesNotMatch(readerFailure.error[0], /private repository reader/u);
});

test("apply-add forwards exact approval inputs and emits only the bounded result", async () => {
  const calls = [];
  const fingerprint = `sha256:${"a".repeat(64)}`;
  const value = {
    status: "verified-final-diff-approval-required",
    baseRevision: "abcdef0123456789abcdef0123456789abcdef01",
    capability: { identifier: "booking-calendly", version: "0.1.0" },
    migration: "add-booking-calendly-0-1-0",
    changedPaths: [".egeria/project.yaml", ".egeria/state.json"],
    verificationChecks: core.capabilityAdditionVerificationChecks,
  };
  const runCli = cli.createCliRunner({
    createVerifier: createFakeVerifier,
    applyCapabilityAddition(input) {
      calls.push(input);
      return Promise.resolve({ ok: true, value });
    },
  });
  const captured = captureOutput();

  assert.equal(
    await runCli(
      applyAddArguments("/private/transaction", fingerprint),
      captured.output,
    ),
    0,
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].root, resolve("/private/transaction"));
  assert.equal(calls[0].capability, "booking-calendly");
  assert.deepEqual(calls[0].settings, planSettings);
  assert.equal(calls[0].approvedPlanFingerprint, fingerprint);
  assert.equal(typeof calls[0].verifier.verifyInIsolatedCopy, "function");
  assert.deepEqual(captured.error, []);
  assert.deepEqual(captured.standard, [
    JSON.stringify({ ok: true, command: "apply-add", result: value }),
  ]);
  assert.doesNotMatch(
    captured.standard[0],
    /private-planning-destination|calendly\.com|refs\/heads/u,
  );
});

test("apply-add contains refusal and recovery details without leaking internals", async () => {
  const runCli = cli.createCliRunner({
    createVerifier: createFakeVerifier,
    applyCapabilityAddition: () =>
      Promise.resolve({
        ok: false,
        code: "CAPABILITY_VERIFICATION_FAILED",
        phase: "verify",
        recovery: "inspect-worktree",
        privateDetail: "must not escape",
      }),
  });
  const captured = captureOutput();

  assert.equal(
    await runCli(applyAddArguments("/private/transaction"), captured.output),
    1,
  );
  assert.deepEqual(captured.standard, []);
  assert.deepEqual(captured.error, [
    JSON.stringify({
      ok: false,
      command: "apply-add",
      code: "CAPABILITY_VERIFICATION_FAILED",
      phase: "verify",
      recovery: "inspect-worktree",
    }),
  ]);
  assert.doesNotMatch(captured.error[0], /must not escape|calendly\.com/u);
});

test("apply-add conservatively contains a rejected executor promise", async () => {
  const runCli = cli.createCliRunner({
    createVerifier: createFakeVerifier,
    applyCapabilityAddition: () =>
      Promise.reject(new Error("private executor failure")),
  });
  const captured = captureOutput();

  assert.equal(
    await runCli(applyAddArguments("/private/transaction"), captured.output),
    1,
  );
  assert.deepEqual(captured.standard, []);
  assert.deepEqual(captured.error, [
    JSON.stringify({
      ok: false,
      command: "apply-add",
      code: "CAPABILITY_EXECUTION_FAILED",
      phase: "precondition",
      recovery: "inspect-worktree",
    }),
  ]);
  assert.doesNotMatch(
    captured.error[0],
    /private executor failure|calendly\.com/u,
  );
});

test("apply-remove forwards exact approval inputs and emits only the bounded result", async () => {
  const calls = [];
  const fingerprint = `sha256:${"a".repeat(64)}`;
  const value = {
    status: "verified-final-diff-approval-required",
    baseRevision: "abcdef0123456789abcdef0123456789abcdef01",
    capability: { identifier: "booking-calendly", version: "0.1.0" },
    migration: "remove-booking-calendly-0-1-0",
    changedPaths: [".egeria/project.yaml", ".egeria/state.json"],
    preservedPaths: [],
    verificationChecks: core.capabilityRemovalVerificationChecks,
  };
  const runCli = cli.createCliRunner({
    createVerifier: createFakeVerifier,
    applyCapabilityRemoval(input) {
      calls.push(input);
      return Promise.resolve({ ok: true, value });
    },
  });
  const captured = captureOutput();

  assert.equal(
    await runCli(
      applyRemoveArguments("/private/transaction", fingerprint),
      captured.output,
    ),
    0,
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].root, resolve("/private/transaction"));
  assert.equal(calls[0].capability, "booking-calendly");
  assert.equal(calls[0].approvedPlanFingerprint, fingerprint);
  assert.equal(typeof calls[0].verifier.verifyInIsolatedCopy, "function");
  assert.deepEqual(captured.error, []);
  assert.deepEqual(captured.standard, [
    JSON.stringify({ ok: true, command: "apply-remove", result: value }),
  ]);
});

test("apply-remove contains ordinary failure details and emits exact absence", async () => {
  const ordinaryRunner = cli.createCliRunner({
    createVerifier: createFakeVerifier,
    applyCapabilityRemoval: () =>
      Promise.resolve({
        ok: false,
        code: "CAPABILITY_VERIFICATION_FAILED",
        phase: "verify",
        recovery: "inspect-worktree",
        privateDetail: "must not escape",
      }),
  });
  const ordinary = captureOutput();
  assert.equal(
    await ordinaryRunner(
      applyRemoveArguments("/private/transaction"),
      ordinary.output,
    ),
    1,
  );
  assert.deepEqual(ordinary.standard, []);
  assert.deepEqual(ordinary.error, [
    JSON.stringify({
      ok: false,
      command: "apply-remove",
      code: "CAPABILITY_VERIFICATION_FAILED",
      phase: "verify",
      recovery: "inspect-worktree",
    }),
  ]);
  assert.doesNotMatch(ordinary.error[0], /must not escape|calendly\.com/u);

  const absentRunner = cli.createCliRunner({
    createVerifier: createFakeVerifier,
    applyCapabilityRemoval: () =>
      Promise.resolve({
        ok: false,
        code: "CAPABILITY_NOT_INSTALLED",
        phase: "precondition",
        recovery: "not-required",
      }),
  });
  const absent = captureOutput();
  assert.equal(
    await absentRunner(
      applyRemoveArguments("/private/transaction"),
      absent.output,
    ),
    1,
  );
  assert.deepEqual(absent.standard, []);
  assert.deepEqual(absent.error, [
    JSON.stringify({
      ok: false,
      command: "apply-remove",
      code: "CAPABILITY_NOT_INSTALLED",
      capability: "booking-calendly",
    }),
  ]);
});

test("apply-remove conservatively contains a rejected executor promise", async () => {
  const runCli = cli.createCliRunner({
    createVerifier: createFakeVerifier,
    applyCapabilityRemoval: () =>
      Promise.reject(new Error("private executor failure")),
  });
  const captured = captureOutput();

  assert.equal(
    await runCli(
      applyRemoveArguments("/private/transaction"),
      captured.output,
    ),
    1,
  );
  assert.deepEqual(captured.standard, []);
  assert.deepEqual(captured.error, [
    JSON.stringify({
      ok: false,
      command: "apply-remove",
      code: "CAPABILITY_EXECUTION_FAILED",
      phase: "precondition",
      recovery: "inspect-worktree",
    }),
  ]);
  assert.doesNotMatch(captured.error[0], /private executor failure|calendly\.com/u);
});

test("apply-remove reports exact transformation mutation and recovery evidence", async () => {
  for (const fixture of [
    {
      recovery: "not-required",
      mutate() {},
      expected: "before\n",
    },
    {
      recovery: "inspect-worktree",
      mutate(repository) {
        repository.source = "retained prefix\n";
      },
      expected: "retained prefix\n",
    },
  ]) {
    const repository = { source: "before\n" };
    const runCli = cli.createCliRunner({
      createVerifier: createFakeVerifier,
      applyCapabilityRemoval: () => {
        fixture.mutate(repository);
        return Promise.resolve({
          ok: false,
          code: "CAPABILITY_TRANSFORM_FAILED",
          phase: "transform",
          recovery: fixture.recovery,
        });
      },
    });
    const captured = captureOutput();
    assert.equal(
      await runCli(
        applyRemoveArguments("/private/transaction"),
        captured.output,
      ),
      1,
    );
    assert.equal(repository.source, fixture.expected);
    assert.deepEqual(captured.standard, []);
    assert.deepEqual(captured.error, [
      JSON.stringify({
        ok: false,
        command: "apply-remove",
        code: "CAPABILITY_TRANSFORM_FAILED",
        phase: "transform",
        recovery: fixture.recovery,
      }),
    ]);
  }
});

test("apply-upgrade forwards the exact approved edge and emits only the bounded result", async () => {
  const calls = [];
  const fingerprint = `sha256:${"b".repeat(64)}`;
  const value = {
    status: "verified-final-diff-approval-required",
    baseRevision: "abcdef0123456789abcdef0123456789abcdef01",
    capability: {
      identifier: "standards",
      fromVersion: "0.3.0",
      toVersion: "0.4.0",
    },
    migration: "upgrade-standards-0-3-0-to-0-4-0",
    changedPaths: [
      ".egeria/migrations.jsonl",
      ".egeria/state.json",
      ...upgradeSourcePaths,
    ].sort(),
    verificationChecks: core.capabilityUpgradeVerificationChecks,
  };
  const runCli = cli.createCliRunner({
    createVerifier: createFakeVerifier,
    applyCapabilityUpgrade(input) {
      calls.push(input);
      return Promise.resolve({ ok: true, value });
    },
  });
  const captured = captureOutput();

  assert.equal(
    await runCli(
      applyUpgradeArguments("/private/upgrade-worktree", fingerprint),
      captured.output,
    ),
    0,
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].root, resolve("/private/upgrade-worktree"));
  assert.equal(calls[0].capability, "standards");
  assert.equal(calls[0].toVersion, "0.4.0");
  assert.equal(calls[0].approvedPlanFingerprint, fingerprint);
  assert.equal(typeof calls[0].verifier.verifyInIsolatedCopy, "function");
  assert.deepEqual(captured.error, []);
  assert.deepEqual(captured.standard, [
    JSON.stringify({ ok: true, command: "apply-upgrade", result: value }),
  ]);
  assert.doesNotMatch(
    captured.standard[0],
    /upgrade-worktree|refs\/heads|\.git\/worktrees|private executor/u,
  );
});

test("apply-upgrade emits exact refusal and rejected-executor envelopes", async () => {
  const refusalRunner = cli.createCliRunner({
    createVerifier: createFakeVerifier,
    applyCapabilityUpgrade: () =>
      Promise.resolve({
        ok: false,
        code: "CAPABILITY_VERIFICATION_FAILED",
        phase: "verify",
        recovery: "inspect-worktree",
        privateDetail: "private executor detail",
      }),
  });
  const refusal = captureOutput();
  assert.equal(
    await refusalRunner(
      applyUpgradeArguments("/private/upgrade-worktree"),
      refusal.output,
    ),
    1,
  );
  assert.deepEqual(refusal.standard, []);
  assert.deepEqual(refusal.error, [
    JSON.stringify({
      ok: false,
      command: "apply-upgrade",
      code: "CAPABILITY_VERIFICATION_FAILED",
      phase: "verify",
      recovery: "inspect-worktree",
    }),
  ]);
  assert.doesNotMatch(
    refusal.error[0],
    /upgrade-worktree|private executor detail|refs\/heads|\.git\/worktrees/u,
  );

  const rejectedRunner = cli.createCliRunner({
    createVerifier: createFakeVerifier,
    applyCapabilityUpgrade: () =>
      Promise.reject(new Error("private executor rejection")),
  });
  const rejected = captureOutput();
  assert.equal(
    await rejectedRunner(
      applyUpgradeArguments("/private/upgrade-worktree"),
      rejected.output,
    ),
    1,
  );
  assert.deepEqual(rejected.standard, []);
  assert.deepEqual(rejected.error, [
    JSON.stringify({
      ok: false,
      command: "apply-upgrade",
      code: "CAPABILITY_EXECUTION_FAILED",
      phase: "precondition",
      recovery: "inspect-worktree",
    }),
  ]);
  assert.doesNotMatch(
    rejected.error[0],
    /upgrade-worktree|private executor rejection/u,
  );
});

test("apply-upgrade preserves representative inspectable failure prefixes", async () => {
  const cases = [
    {
      name: "verification",
      failure: {
        code: "CAPABILITY_VERIFICATION_FAILED",
        phase: "verify",
        recovery: "inspect-worktree",
      },
      mutate(repository) {
        repository.source = "six-source-action-prefix";
      },
      expected: {
        source: "six-source-action-prefix",
        migration: "original-migration",
        state: "original-state",
      },
    },
    {
      name: "migration persistence",
      failure: {
        code: "CAPABILITY_MIGRATION_WRITE_FAILED",
        phase: "persist-migration",
        recovery: "inspect-worktree",
      },
      mutate(repository) {
        repository.source = "six-source-action-prefix";
        repository.migration = "original-migration+upgrade-record";
      },
      expected: {
        source: "six-source-action-prefix",
        migration: "original-migration+upgrade-record",
        state: "original-state",
      },
    },
    {
      name: "state persistence",
      failure: {
        code: "CAPABILITY_STATE_WRITE_FAILED",
        phase: "persist-state",
        recovery: "inspect-worktree",
      },
      mutate(repository) {
        repository.source = "six-source-action-prefix";
        repository.migration = "original-migration+upgrade-record";
        repository.state = "uncertain-upgrade-state";
      },
      expected: {
        source: "six-source-action-prefix",
        migration: "original-migration+upgrade-record",
        state: "uncertain-upgrade-state",
      },
    },
  ];

  for (const fixture of cases) {
    const repository = {
      source: "original-source",
      migration: "original-migration",
      state: "original-state",
    };
    const runCli = cli.createCliRunner({
      createVerifier: createFakeVerifier,
      applyCapabilityUpgrade: () => {
        fixture.mutate(repository);
        return Promise.resolve({ ok: false, ...fixture.failure });
      },
    });
    const captured = captureOutput();

    assert.equal(
      await runCli(
        applyUpgradeArguments("/private/upgrade-worktree"),
        captured.output,
      ),
      1,
      fixture.name,
    );
    assert.deepEqual(repository, fixture.expected, fixture.name);
    assert.deepEqual(captured.standard, [], fixture.name);
    assert.deepEqual(
      captured.error,
      [
        JSON.stringify({
          ok: false,
          command: "apply-upgrade",
          ...fixture.failure,
        }),
      ],
      fixture.name,
    );
  }
});

test("plan-add contains final inspection changes and never leaks a completed plan", async () => {
  const initial = cleanGitInspection();
  const finalCases = [
    {
      name: "revision changed",
      final: cleanGitInspection({
        revision: "1111111111111111111111111111111111111111",
      }),
      code: "GIT_WORKTREE_CHANGED",
    },
    {
      name: "attached ref changed",
      final: cleanGitInspection({ attachedRef: "refs/heads/other-change" }),
      code: "GIT_WORKTREE_CHANGED",
    },
    {
      name: "Git directory changed",
      final: cleanGitInspection({
        gitDirectory: "/private/generated-common/.git/worktrees/replaced",
      }),
      code: "GIT_WORKTREE_CHANGED",
    },
    {
      name: "common directory changed",
      final: cleanGitInspection({
        commonDirectory: "/private/replaced-common/.git",
      }),
      code: "GIT_WORKTREE_CHANGED",
    },
    {
      name: "clean worktree became dirty",
      final: { ok: false, code: "GIT_WORKTREE_DIRTY" },
      code: "GIT_WORKTREE_DIRTY",
    },
    {
      name: "operation began",
      final: { ok: false, code: "GIT_OPERATION_IN_PROGRESS" },
      code: "GIT_OPERATION_IN_PROGRESS",
    },
    {
      name: "conflict appeared",
      final: { ok: false, code: "GIT_WORKTREE_CONFLICTED" },
      code: "GIT_WORKTREE_CONFLICTED",
    },
    {
      name: "inspection timed out",
      final: { ok: false, code: "GIT_WORKTREE_IDENTITY_INVALID" },
      code: "GIT_WORKTREE_IDENTITY_INVALID",
    },
  ];

  for (const fixture of finalCases) {
    const inspections = [structuredClone(initial), fixture.final];
    const runCli = cli.createCliRunner({
      createVerifier: createFakeVerifier,
      createReader: () =>
        core.createFileSystemRepositoryReader(
          resolve(repositoryRoot, "fixtures/generated/portfolio"),
        ),
      inspectGitWorktree: () => Promise.resolve(inspections.shift()),
      inspectGitCreateTargets: () => Promise.resolve({ ok: true }),
    });
    const captured = captureOutput();

    assert.equal(
      await runCli(planAddArguments("/private/ignored-input"), captured.output),
      1,
      fixture.name,
    );
    assert.deepEqual(captured.standard, [], fixture.name);
    assert.deepEqual(
      captured.error,
      [
        JSON.stringify({
          ok: false,
          command: "plan-add",
          code: fixture.code,
        }),
      ],
      fixture.name,
    );
    assert.doesNotMatch(
      captured.error[0],
      /approval-required|private-planning-destination|refs\/heads|generated-common/u,
      fixture.name,
    );
  }

  const inspections = [structuredClone(initial), "throw"];
  const throwingRunner = cli.createCliRunner({
    createVerifier: createFakeVerifier,
    createReader: () =>
      core.createFileSystemRepositoryReader(
        resolve(repositoryRoot, "fixtures/generated/portfolio"),
      ),
    inspectGitCreateTargets: () => Promise.resolve({ ok: true }),
    inspectGitWorktree() {
      const next = inspections.shift();
      if (next === "throw") {
        throw new Error("private Git failure");
      }
      return Promise.resolve(next);
    },
  });
  const captured = captureOutput();
  assert.equal(
    await throwingRunner(
      planAddArguments("/private/ignored-input"),
      captured.output,
    ),
    1,
  );
  assert.deepEqual(captured.standard, []);
  assert.deepEqual(captured.error, [
    JSON.stringify({
      ok: false,
      command: "plan-add",
      code: "GIT_WORKTREE_IDENTITY_INVALID",
    }),
  ]);
  assert.doesNotMatch(captured.error[0], /private Git failure|approval-required/u);

  const readerFailureRunner = cli.createCliRunner({
    createVerifier: createFakeVerifier,
    createReader: () => ({
      readText() {
        throw new Error("private repository reader failure");
      },
    }),
    inspectGitCreateTargets: () => Promise.resolve({ ok: true }),
    inspectGitWorktree: () => Promise.resolve(structuredClone(initial)),
  });
  const readerFailure = captureOutput();
  assert.equal(
    await readerFailureRunner(
      planAddArguments("/private/ignored-input"),
      readerFailure.output,
    ),
    1,
  );
  assert.deepEqual(readerFailure.standard, []);
  assert.deepEqual(readerFailure.error, [
    JSON.stringify({
      ok: false,
      command: "plan-add",
      code: "REPOSITORY_OPEN_FAILED",
    }),
  ]);
  assert.doesNotMatch(
    readerFailure.error[0],
    /private repository reader failure|approval-required/u,
  );

  const ignoredTargetRunner = cli.createCliRunner({
    createVerifier: createFakeVerifier,
    createReader: () =>
      core.createFileSystemRepositoryReader(
        resolve(repositoryRoot, "fixtures/generated/portfolio"),
      ),
    inspectGitCreateTargets: () =>
      Promise.resolve({ ok: false, code: "CAPABILITY_ACTION_CONFLICT" }),
    inspectGitWorktree: () => Promise.resolve(structuredClone(initial)),
  });
  const ignoredTarget = captureOutput();
  assert.equal(
    await ignoredTargetRunner(
      planAddArguments("/private/ignored-input"),
      ignoredTarget.output,
    ),
    1,
  );
  assert.deepEqual(ignoredTarget.standard, []);
  assert.deepEqual(ignoredTarget.error, [
    JSON.stringify({
      ok: false,
      command: "plan-add",
      code: "CAPABILITY_ACTION_CONFLICT",
    }),
  ]);
});

async function executeGit(root, arguments_, readOnly = false) {
  const globalOptions = readOnly
    ? [
        "--no-optional-locks",
        "--no-replace-objects",
        "--no-lazy-fetch",
        "-c",
        "core.fsmonitor=false",
        "-c",
        "core.untrackedCache=false",
      ]
    : [];

  return new Promise((resolveResult, rejectResult) => {
    execFile(
      "git",
      [...globalOptions, ...arguments_],
      {
        cwd: root,
        encoding: "buffer",
        env: { PATH: process.env.PATH },
        maxBuffer: 1024 * 1024,
        timeout: 10_000,
      },
      (error, stdout) => {
        if (error === null) {
          resolveResult(new Uint8Array(stdout));
        } else {
          rejectResult(error);
        }
      },
    );
  });
}

async function withGitFixture(name, run, options = {}) {
  const createdOwner = await mkdtemp(join(tmpdir(), "egeria-plan-add-cli-"));
  const owner = await realpath(createdOwner);
  const ownerStats = await lstat(owner, { bigint: true });
  const primary = join(owner, "primary");
  const linked = join(owner, "linked");

  try {
    if (options.bookingCalendly === undefined) {
      await cp(resolve(repositoryRoot, `fixtures/generated/${name}`), primary, {
        recursive: true,
      });
    } else {
      assertSuccess(
        await core.generateProject({
          request: {
            profile: name,
            projectName: `acme-${name}`,
            displayName: `Acme ${name}`,
            bookingCalendly: options.bookingCalendly,
          },
          destination: primary,
          verifier: createFakeVerifier(),
        }),
      );
    }
    if (options.preparePrimary !== undefined) {
      await options.preparePrimary(primary);
    }
    await executeGit(owner, ["init", "--initial-branch=main", primary]);
    await executeGit(primary, ["config", "user.name", "CLI Plan Test"]);
    await executeGit(primary, [
      "config",
      "user.email",
      "cli-plan@example.test",
    ]);
    await executeGit(primary, ["add", "-A"]);
    await executeGit(primary, ["commit", "-m", "fixture"]);
    await executeGit(primary, [
      "worktree",
      "add",
      "-b",
      options.branch ?? "plan-add-test",
      linked,
    ]);
    await run({ linked, primary });
  } finally {
    const currentStats = await lstat(owner, { bigint: true });
    assert.equal(currentStats.isDirectory(), true);
    assert.equal(currentStats.isSymbolicLink(), false);
    assert.equal(currentStats.dev, ownerStats.dev);
    assert.equal(currentStats.ino, ownerStats.ino);
    await rm(owner, { recursive: true, force: false });
  }
}

async function operationSnapshot(root) {
  const states = [];

  for (const marker of [
    "MERGE_HEAD",
    "rebase-merge",
    "rebase-apply",
    "REVERT_HEAD",
    "CHERRY_PICK_HEAD",
    "sequencer",
  ]) {
    const pathOutput = await executeGit(
      root,
      ["rev-parse", "--git-path", marker],
      true,
    );
    const path = Buffer.from(pathOutput).toString("utf8").trim();

    try {
      const stats = await lstat(path);
      states.push({
        marker,
        kind: stats.isSymbolicLink()
          ? "symlink"
          : stats.isDirectory()
            ? "directory"
            : "file",
        ...(stats.isFile()
          ? { content: (await readFile(path)).toString("base64") }
          : {}),
      });
    } catch (error) {
      if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") {
        throw error;
      }
    }
  }

  return states;
}

async function gitRepositorySnapshot(root) {
  const [head, refs, status, indexVisibility, tree, operations] = await Promise.all([
    executeGit(root, ["rev-parse", "HEAD"], true),
    executeGit(root, ["show-ref"], true),
    executeGit(
      root,
      ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
      true,
    ),
    executeGit(root, ["ls-files", "-v", "-z"], true),
    listTree(root),
    operationSnapshot(root),
  ]);

  return {
    head,
    refs,
    status,
    indexVisibility,
    tree: tree.filter(
      ({ path }) => path !== ".git" && !path.startsWith(".git/"),
    ),
    operations,
  };
}

function withoutSharedRefs(snapshot) {
  return {
    head: snapshot.head,
    status: snapshot.status,
    indexVisibility: snapshot.indexVisibility,
    tree: snapshot.tree,
    operations: snapshot.operations,
  };
}

async function assertExactInstalledAgreement(root, options = {}) {
  const projectSource = await readFile(join(root, ".egeria/project.yaml"), "utf8");
  const stateSource = await readFile(join(root, ".egeria/state.json"), "utf8");
  const project = core.parseProjectYaml(projectSource);
  const state = core.parseStateJson(stateSource);
  const catalog = core.createVerifiedCapabilityCatalog();
  assert.equal(project.ok, true);
  assert.equal(state.ok, true);
  assert.equal(catalog.ok, true);
  const inference = await core.inferRepository({
    reader: core.createFileSystemRepositoryReader(root),
    catalog: catalog.value,
  });
  const desired = [...project.value.selectedCapabilities].sort();
  const installed = state.value.installedCapabilities
    .map(({ identifier }) => identifier)
    .sort();
  const confirmed = inference.capabilities
    .filter(({ category }) => category === "confirmed")
    .map(({ identifier }) => identifier)
    .sort();
  assert.deepEqual(installed, desired);
  assert.deepEqual(confirmed, desired);
  assert.equal(inference.state.kind, "valid");
  assert.equal(core.serializeStateJson(inference.state.value), stateSource);
  for (const evidence of inference.capabilities.filter(
    ({ identifier }) => !desired.includes(identifier),
  )) {
    assert.equal(evidence.identifier, "booking-calendly");
    assert.equal(options.allowPreservedCalendly, true);
    assert.equal(
      evidence.probes.every(
        ({ path, status }) =>
          status === "missing" ||
          (status === "present" && state.value.ejections.includes(path)),
      ),
      true,
    );
  }
}

async function commitAll(root, message) {
  await executeGit(root, ["add", "-A"]);
  await executeGit(root, ["commit", "-m", message]);
}

async function replaceFakeLockfileWithFixture(root, profile) {
  const lockfile = new Uint8Array(
    await readFile(
      resolve(repositoryRoot, `fixtures/generated/${profile}/pnpm-lock.yaml`),
    ),
  );
  await writeFile(join(root, "pnpm-lock.yaml"), lockfile);
  const statePath = join(root, ".egeria/state.json");
  const state = core.parseStateJson(await readFile(statePath, "utf8"));
  assert.equal(state.ok, true);
  await writeFile(
    statePath,
    core.serializeStateJson({
      ...state.value,
      managedSurfaces: state.value.managedSurfaces.map((surface) =>
        surface.identifier === "builder-dependency-lockfile"
          ? {
              ...surface,
              fingerprint: core.fingerprintFileContent(lockfile),
            }
          : surface,
      ),
    }),
  );
}

async function executeBuiltPlanAdd(directory) {
  return executeNode([
    resolve(packageRoot, "dist/index.js"),
    ...planAddArguments(directory),
  ]);
}

async function executeBuiltPlanRemove(directory) {
  return executeNode([
    resolve(packageRoot, "dist/index.js"),
    ...planRemoveArguments(directory),
  ]);
}

async function executeBuiltPlanUpgrade(directory) {
  return executeNode([
    resolve(packageRoot, "dist/index.js"),
    ...planUpgradeArguments(directory),
  ]);
}

async function executeBuiltApplyAdd(directory, approvedPlan) {
  return executeNode([
    resolve(packageRoot, "dist/index.js"),
    ...applyAddArguments(directory, approvedPlan),
  ]);
}

async function executeBuiltApplyRemove(directory, approvedPlan) {
  return executeNode([
    resolve(packageRoot, "dist/index.js"),
    ...applyRemoveArguments(directory, approvedPlan),
  ]);
}

async function executeBuiltApplyUpgrade(directory, approvedPlan) {
  return executeNode([
    resolve(packageRoot, "dist/index.js"),
    ...applyUpgradeArguments(directory, approvedPlan),
  ]);
}

test("the compiled plan-add command emits exact portfolio and site plans without writes", async () => {
  for (const profile of ["portfolio", "site"]) {
    await withGitFixture(profile, async ({ linked }) => {
      const before = await gitRepositorySnapshot(linked);
      const execution = await executeBuiltPlanAdd(linked);
      const after = await gitRepositorySnapshot(linked);
      const revision = Buffer.from(before.head).toString("utf8").trim();

      assert.equal(execution.exitCode, 0);
      assert.equal(execution.stderr, "");
      const emitted = JSON.parse(execution.stdout.trimEnd());
      assert.match(emitted.result.planFingerprint, /^sha256:[a-f0-9]{64}$/u);
      assert.deepEqual(emitted, {
        ok: true,
        command: "plan-add",
        result: expectedAdditionPlan(
          profile,
          revision,
          emitted.result.planFingerprint,
        ),
      });
      assert.deepEqual(after, before);
      assert.doesNotMatch(
        execution.stdout,
        /private-planning-destination|calendly\.com|refs\/heads|\.git\/worktrees/u,
      );
    });
  }
});

test("the compiled plan-upgrade command plans both profiles without changing any byte", async () => {
  for (const profile of ["portfolio", "site"]) {
    await withGitFixture(
      profile,
      async ({ linked }) => {
        const before = await gitRepositorySnapshot(linked);
        const controlBefore = await Promise.all(
          ["project.yaml", "state.json", "migrations.jsonl"].map((name) =>
            readFile(join(linked, ".egeria", name)),
          ),
        );
        const execution = await executeBuiltPlanUpgrade(linked);
        const after = await gitRepositorySnapshot(linked);
        const controlAfter = await Promise.all(
          ["project.yaml", "state.json", "migrations.jsonl"].map((name) =>
            readFile(join(linked, ".egeria", name)),
          ),
        );

        assert.equal(execution.exitCode, 0, execution.stderr);
        assert.equal(execution.stderr, "");
        const emitted = JSON.parse(execution.stdout);
        assert.equal(emitted.ok, true);
        assert.equal(emitted.command, "plan-upgrade");
        assert.equal(emitted.plan.profile, profile);
        assert.deepEqual(emitted.plan.capability, {
          identifier: "standards",
          fromVersion: "0.3.0",
          toVersion: "0.4.0",
        });
        assert.equal(emitted.plan.actions.length, 6);
        assert.deepEqual(
          emitted.plan.actions.filter(({ kind }) => kind === "create-file")
            .map(({ path }) => path),
          visualUpgradePaths,
        );
        assert.match(
          emitted.plan.planFingerprint,
          /^sha256:[a-f0-9]{64}$/u,
        );
        assert.deepEqual(after, before);
        assert.deepEqual(controlAfter, controlBefore);
        assert.doesNotMatch(
          execution.stdout,
          /refs\/heads|\.git\/worktrees|acme-(?:portfolio|site)/u,
        );
      },
      {
        branch: `plan-upgrade-${profile}-test`,
        preparePrimary: prepareHistoricalUpgradeFixture,
      },
    );
  }
});

test("the compiled apply-upgrade command completes the exact portfolio and site transactions", async () => {
  for (const profile of ["portfolio", "site"]) {
    await withGitFixture(
      profile,
      async ({ linked, primary }) => {
        const linkedBefore = await gitRepositorySnapshot(linked);
        const primaryBefore = await gitRepositorySnapshot(primary);
        const initialInspection = await core.inspectGitWorktree({ root: linked });
        assert.equal(initialInspection.ok, true);
        const initialProjectSource = await readFile(
          join(linked, ".egeria/project.yaml"),
          "utf8",
        );
        const initialStateSource = await readFile(
          join(linked, ".egeria/state.json"),
          "utf8",
        );
        const initialMigrationSource = await readFile(
          join(linked, ".egeria/migrations.jsonl"),
          "utf8",
        );
        const initialState = core.parseStateJson(initialStateSource);
        assert.equal(initialState.ok, true);

        const planExecution = await executeBuiltPlanUpgrade(linked);
        assert.equal(planExecution.exitCode, 0, planExecution.stderr);
        assert.equal(planExecution.stderr, "");
        const plan = JSON.parse(planExecution.stdout).plan;
        assert.deepEqual(await gitRepositorySnapshot(linked), linkedBefore);

        const execution = await executeBuiltApplyUpgrade(
          linked,
          plan.planFingerprint,
        );
        assert.equal(execution.exitCode, 0, execution.stderr);
        assert.equal(execution.stderr, "");
        assert.equal(execution.stdout.endsWith("\n"), true);
        assert.equal(execution.stdout.trimEnd().split("\n").length, 1);
        const emitted = JSON.parse(execution.stdout);
        const expectedChangedPaths = [
          ...upgradeSourcePaths,
          ".egeria/migrations.jsonl",
          ".egeria/state.json",
        ].sort();
        assert.deepEqual(emitted, {
          ok: true,
          command: "apply-upgrade",
          result: {
            status: "verified-final-diff-approval-required",
            baseRevision: Buffer.from(linkedBefore.head).toString("utf8").trim(),
            capability: {
              identifier: "standards",
              fromVersion: "0.3.0",
              toVersion: "0.4.0",
            },
            migration: "upgrade-standards-0-3-0-to-0-4-0",
            changedPaths: expectedChangedPaths,
            verificationChecks: core.capabilityUpgradeVerificationChecks,
          },
        });

        for (const path of upgradeSourcePaths) {
          assert.deepEqual(
            await readFile(join(linked, path)),
            await readFile(
              resolve(repositoryRoot, `fixtures/generated/${profile}`, path),
            ),
            `${profile}:${path}`,
          );
        }
        assert.equal(
          await readFile(join(linked, ".egeria/project.yaml"), "utf8"),
          initialProjectSource,
        );

        const migrationSource = await readFile(
          join(linked, ".egeria/migrations.jsonl"),
          "utf8",
        );
        const migrations = core.parseMigrationLog(migrationSource);
        assert.equal(migrations.ok, true);
        assert.equal(migrations.value.length, 1);
        const migration = migrations.value[0];
        assert.match(migration.completedAt, /^\d{4}-\d{2}-\d{2}T/u);
        assert.deepEqual(migration, {
          schemaVersion: "1.0.0",
          identifier: "upgrade-standards-0-3-0-to-0-4-0",
          kind: "migration",
          outcome: "succeeded",
          completedAt: migration.completedAt,
          fromBuilderVersion: "0.0.0",
          toBuilderVersion: "0.0.0",
          capabilities: plan.desiredCapabilities,
          persistentDataAuthorizations: [],
          remainingKnownDrift: [],
          verificationChecks: core.capabilityUpgradePersistedVerificationChecks,
        });
        const migrationSeparator =
          initialMigrationSource.length > 0 &&
          !initialMigrationSource.endsWith("\n")
            ? "\n"
            : "";
        assert.equal(
          migrationSource,
          `${initialMigrationSource}${migrationSeparator}${core.serializeMigrationRecord(
            migration,
          )}`,
        );

        const targetState = core.parseStateJson(
          await readFile(
            resolve(
              repositoryRoot,
              `fixtures/generated/${profile}/.egeria/state.json`,
            ),
            "utf8",
          ),
        );
        assert.equal(targetState.ok, true);
        const initialSurfaces = new Map(
          initialState.value.managedSurfaces.map((surface) => [
            surface.identifier,
            surface,
          ]),
        );
        const changedSurfacePaths = new Set([
          ...upgradeSourcePaths,
          ".egeria/migrations.jsonl",
        ]);
        const expectedManagedSurfaces = targetState.value.managedSurfaces.map(
          (surface) => {
            if (surface.path === ".egeria/migrations.jsonl") {
              return {
                ...surface,
                fingerprint: core.fingerprintFileContent(
                  new TextEncoder().encode(migrationSource),
                ),
              };
            }
            if (changedSurfacePaths.has(surface.path)) {
              return surface;
            }
            const initial = initialSurfaces.get(surface.identifier);
            assert.notEqual(initial, undefined, surface.identifier);
            return initial;
          },
        );
        const expectedStateSource = core.serializeStateJson({
          ...initialState.value,
          installedCapabilities: initialState.value.installedCapabilities.map(
            (capability) =>
              capability.identifier === "standards"
                ? { ...capability, version: "0.4.0" }
                : capability,
          ),
          appliedMigrations: [
            ...initialState.value.appliedMigrations,
            "upgrade-standards-0-3-0-to-0-4-0",
          ],
          managedSurfaces: expectedManagedSurfaces,
          lastSuccessfulVerification: {
            kind: "capability-upgrade",
            checks: core.capabilityUpgradePersistedVerificationChecks,
          },
        });
        assert.equal(
          await readFile(join(linked, ".egeria/state.json"), "utf8"),
          expectedStateSource,
        );

        const status = Buffer.from(
          await executeGit(
            linked,
            ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
            true,
          ),
        ).toString("utf8");
        assert.deepEqual(
          status
            .split("\0")
            .filter(Boolean)
            .map((entry) => entry.slice(3))
            .sort(),
          expectedChangedPaths,
        );
        assert.deepEqual(
          await core.inspectGitExpectedChanges({
            root: linked,
            identity: initialInspection.identity,
            expectedPaths: expectedChangedPaths,
          }),
          { ok: true },
        );
        assert.deepEqual(
          withoutSharedRefs(await gitRepositorySnapshot(primary)),
          withoutSharedRefs(primaryBefore),
        );
        assert.doesNotMatch(
          execution.stdout,
          /refs\/heads|\.git\/worktrees|acme-(?:portfolio|site)|project\.yaml/u,
        );
      },
      {
        branch: `standards-upgrade-${profile}-success`,
        preparePrimary: prepareHistoricalUpgradeFixture,
      },
    );
  }
});

test("the compiled plan-upgrade command refuses unsafe or unsupported repository states without writes", async () => {
  const cases = [
    {
      name: "primary worktree",
      preparePrimary: prepareHistoricalUpgradeFixture,
      select: ({ primary }) => primary,
      prepareLinked: async () => {},
      code: "GIT_WORKTREE_NOT_ISOLATED",
    },
    {
      name: "detached worktree",
      preparePrimary: prepareHistoricalUpgradeFixture,
      prepareLinked: (root) => executeGit(root, ["checkout", "--detach"]),
      code: "GIT_BRANCH_REQUIRED",
    },
    {
      name: "already current",
      preparePrimary: undefined,
      prepareLinked: async () => {},
      code: "CAPABILITY_ALREADY_CURRENT",
    },
    {
      name: "dirty repository",
      preparePrimary: prepareHistoricalUpgradeFixture,
      prepareLinked: (root) =>
        writeFile(join(root, "private-untracked.txt"), "private\n"),
      code: "GIT_WORKTREE_DIRTY",
    },
    ...[
      ["assume-unchanged", "--assume-unchanged"],
      ["skip-worktree", "--skip-worktree"],
    ].map(([name, flag]) => ({
      name: `hidden tracked change with ${name}`,
      preparePrimary: prepareHistoricalUpgradeFixture,
      prepareLinked: async (root) => {
        await executeGit(root, ["update-index", flag, ".gitignore"]);
        await writeFile(join(root, ".gitignore"), `private ${name} drift\n`);
      },
      code: "GIT_WORKTREE_DIRTY",
    })),
    {
      name: "managed drift",
      preparePrimary: prepareHistoricalUpgradeFixture,
      prepareLinked: async (root) => {
        await writeFile(
          join(root, ".github/workflows/quality.yml"),
          "private managed drift\n",
        );
        await commitAll(root, "drift managed quality workflow");
      },
      code: "PROJECT_DRIFT_DETECTED",
    },
    {
      name: "incompatible migration state",
      preparePrimary: prepareHistoricalUpgradeFixture,
      prepareLinked: async (root) => {
        const path = join(root, ".egeria/state.json");
        const state = core.parseStateJson(await readFile(path, "utf8"));
        assert.equal(state.ok, true);
        await writeFile(
          path,
          core.serializeStateJson({
            ...state.value,
            appliedMigrations: ["invented"],
          }),
        );
        await commitAll(root, "create incompatible migration state");
      },
      code: "PROJECT_STATE_INCOMPATIBLE",
    },
    {
      name: "missing source edge",
      preparePrimary: prepareHistoricalUpgradeFixture,
      prepareLinked: async (root) => {
        const path = join(root, ".egeria/state.json");
        const state = core.parseStateJson(await readFile(path, "utf8"));
        assert.equal(state.ok, true);
        await writeFile(
          path,
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
        await commitAll(root, "set unsupported source version");
      },
      code: "CAPABILITY_UPGRADE_EDGE_MISSING",
    },
    {
      name: "ambiguous source inference",
      preparePrimary: prepareHistoricalUpgradeFixture,
      prepareLinked: async (root) => {
        await writeFile(join(root, "apps/web/package.json"), "{");
        await commitAll(root, "make version inference ambiguous");
      },
      code: "CAPABILITY_VERSION_AMBIGUOUS",
    },
    {
      name: "ignored create target",
      preparePrimary: prepareHistoricalUpgradeFixture,
      prepareLinked: async (root) => {
        await writeFile(
          join(root, ".gitignore"),
          `${await readFile(join(root, ".gitignore"), "utf8")}\n${visualUpgradePaths[0]}\n`,
        );
        await commitAll(root, "ignore an upgrade create target");
      },
      code: "CAPABILITY_ACTION_CONFLICT",
    },
  ];

  for (const fixture of cases) {
    await withGitFixture(
      "portfolio",
      async (roots) => {
        const root = fixture.select?.(roots) ?? roots.linked;
        await fixture.prepareLinked(root);
        const before = await gitRepositorySnapshot(root);
        const execution = await executeBuiltPlanUpgrade(root);
        const after = await gitRepositorySnapshot(root);

        assert.equal(execution.exitCode, 1, fixture.name);
        assert.equal(execution.stdout, "", fixture.name);
        assert.deepEqual(
          JSON.parse(execution.stderr),
          {
            ok: false,
            command: "plan-upgrade",
            code: fixture.code,
          },
          fixture.name,
        );
        assert.deepEqual(after, before, fixture.name);
        assert.doesNotMatch(
          execution.stderr,
          /private|refs\/heads|\.git\/worktrees/u,
          fixture.name,
        );
      },
      {
        branch: `plan-upgrade-${fixture.code.toLowerCase()}-test`,
        ...(fixture.preparePrimary === undefined
          ? {}
          : { preparePrimary: fixture.preparePrimary }),
      },
    );
  }
});

test("the compiled apply-upgrade command refuses the finite unsafe matrix without mutation", async () => {
  const cases = [
    {
      name: "wrong fingerprint",
      historical: true,
      prepare: async ({ linked }) => ({
        root: linked,
        approvedPlan: `sha256:${"0".repeat(64)}`,
        expectedCode: "CAPABILITY_PLAN_APPROVAL_INVALID",
      }),
    },
    {
      name: "stale fingerprint after a clean base revision change",
      historical: true,
      prepare: async ({ linked }) => {
        const planned = await executeBuiltPlanUpgrade(linked);
        assert.equal(planned.exitCode, 0, planned.stderr);
        const approvedPlan = JSON.parse(planned.stdout).plan.planFingerprint;
        await writeFile(
          join(linked, ".gitignore"),
          `${await readFile(join(linked, ".gitignore"), "utf8")}\n# changed base\n`,
        );
        await commitAll(linked, "change approved upgrade base");
        return {
          root: linked,
          approvedPlan,
          expectedCode: "CAPABILITY_PLAN_APPROVAL_INVALID",
        };
      },
    },
    {
      name: "changed approved plan through managed drift",
      historical: true,
      prepare: async ({ linked }) => {
        const planned = await executeBuiltPlanUpgrade(linked);
        assert.equal(planned.exitCode, 0, planned.stderr);
        const approvedPlan = JSON.parse(planned.stdout).plan.planFingerprint;
        await writeFile(
          join(linked, ".github/workflows/quality.yml"),
          "private changed approved source\n",
        );
        await commitAll(linked, "change approved upgrade source");
        return {
          root: linked,
          approvedPlan,
          expectedCode: "PROJECT_DRIFT_DETECTED",
        };
      },
    },
    {
      name: "unsupported target syntax",
      historical: true,
      prepare: async ({ linked }) => ({
        root: linked,
        approvedPlan: `sha256:${"0".repeat(64)}`,
        expectedArgumentRefusal: true,
        arguments: applyUpgradeArguments(
          linked,
          `sha256:${"0".repeat(64)}`,
        ).map((value) => (value === "0.4.0" ? "0.5.0" : value)),
      }),
    },
    {
      name: "missing source edge",
      historical: true,
      prepare: async ({ linked }) => {
        const path = join(linked, ".egeria/state.json");
        const state = core.parseStateJson(await readFile(path, "utf8"));
        assert.equal(state.ok, true);
        await writeFile(
          path,
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
        await commitAll(linked, "set unsupported standards source");
        return {
          root: linked,
          approvedPlan: `sha256:${"0".repeat(64)}`,
          expectedCode: "CAPABILITY_UPGRADE_EDGE_MISSING",
        };
      },
    },
    {
      name: "already current",
      historical: false,
      prepare: async ({ linked }) => ({
        root: linked,
        approvedPlan: `sha256:${"0".repeat(64)}`,
        expectedCode: "CAPABILITY_ALREADY_CURRENT",
      }),
    },
    {
      name: "ambiguous source",
      historical: true,
      prepare: async ({ linked }) => {
        await writeFile(join(linked, "apps/web/package.json"), "{");
        await commitAll(linked, "make standards source ambiguous");
        return {
          root: linked,
          approvedPlan: `sha256:${"0".repeat(64)}`,
          expectedCode: "CAPABILITY_VERSION_AMBIGUOUS",
        };
      },
    },
    {
      name: "managed drift",
      historical: true,
      prepare: async ({ linked }) => {
        await writeFile(
          join(linked, ".github/workflows/quality.yml"),
          "private managed drift\n",
        );
        await commitAll(linked, "drift standards workflow");
        return {
          root: linked,
          approvedPlan: `sha256:${"0".repeat(64)}`,
          expectedCode: "PROJECT_DRIFT_DETECTED",
        };
      },
    },
    {
      name: "incompatible state",
      historical: true,
      prepare: async ({ linked }) => {
        const path = join(linked, ".egeria/state.json");
        const state = core.parseStateJson(await readFile(path, "utf8"));
        assert.equal(state.ok, true);
        await writeFile(
          path,
          core.serializeStateJson({
            ...state.value,
            appliedMigrations: ["invented-migration"],
          }),
        );
        await commitAll(linked, "make upgrade state incompatible");
        return {
          root: linked,
          approvedPlan: `sha256:${"0".repeat(64)}`,
          expectedCode: "PROJECT_STATE_INCOMPATIBLE",
        };
      },
    },
    {
      name: "create target conflict",
      historical: true,
      prepare: async ({ linked }) => {
        const path = join(linked, visualUpgradePaths[0]);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, "private create conflict\n");
        await commitAll(linked, "add conflicting upgrade target");
        return {
          root: linked,
          approvedPlan: `sha256:${"0".repeat(64)}`,
          expectedCode: "CAPABILITY_ACTION_CONFLICT",
        };
      },
    },
    {
      name: "ignored create target conflict",
      historical: true,
      prepare: async ({ linked }) => {
        await writeFile(
          join(linked, ".gitignore"),
          `${await readFile(join(linked, ".gitignore"), "utf8")}\n${visualUpgradePaths[0]}\n`,
        );
        await commitAll(linked, "ignore upgrade target");
        const path = join(linked, visualUpgradePaths[0]);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, "private ignored conflict\n");
        return {
          root: linked,
          approvedPlan: `sha256:${"0".repeat(64)}`,
          expectedCode: "CAPABILITY_ACTION_CONFLICT",
        };
      },
    },
    {
      name: "dirty repository",
      historical: true,
      prepare: async ({ linked }) => {
        await writeFile(join(linked, "private-untracked.txt"), "private\n");
        return {
          root: linked,
          approvedPlan: `sha256:${"0".repeat(64)}`,
          expectedCode: "GIT_WORKTREE_DIRTY",
        };
      },
    },
    {
      name: "detached worktree",
      historical: true,
      prepare: async ({ linked }) => {
        await executeGit(linked, ["checkout", "--detach"]);
        return {
          root: linked,
          approvedPlan: `sha256:${"0".repeat(64)}`,
          expectedCode: "GIT_BRANCH_REQUIRED",
        };
      },
    },
    {
      name: "primary unisolated checkout",
      historical: true,
      prepare: async ({ primary }) => ({
        root: primary,
        approvedPlan: `sha256:${"0".repeat(64)}`,
        expectedCode: "GIT_WORKTREE_NOT_ISOLATED",
      }),
    },
    ...[
      ["assume-unchanged", "--assume-unchanged"],
      ["skip-worktree", "--skip-worktree"],
    ].map(([name, flag]) => ({
      name: `${name} hidden tracked change`,
      historical: true,
      prepare: async ({ linked }) => {
        await executeGit(linked, ["update-index", flag, ".gitignore"]);
        await writeFile(join(linked, ".gitignore"), `private ${name} drift\n`);
        return {
          root: linked,
          approvedPlan: `sha256:${"0".repeat(64)}`,
          expectedCode: "GIT_WORKTREE_DIRTY",
        };
      },
    })),
  ];

  for (const [index, fixture] of cases.entries()) {
    await withGitFixture(
      "portfolio",
      async (roots) => {
        const prepared = await fixture.prepare(roots);
        const before = await gitRepositorySnapshot(prepared.root);
        const controlsBefore = await Promise.all(
          upgradeControlPaths.map((path) => readFile(join(prepared.root, path))),
        );
        const execution =
          prepared.arguments === undefined
            ? await executeBuiltApplyUpgrade(
                prepared.root,
                prepared.approvedPlan,
              )
            : await executeNode([
                resolve(packageRoot, "dist/index.js"),
                ...prepared.arguments,
              ]);
        const after = await gitRepositorySnapshot(prepared.root);
        const controlsAfter = await Promise.all(
          upgradeControlPaths.map((path) => readFile(join(prepared.root, path))),
        );

        assert.equal(
          execution.exitCode,
          prepared.expectedArgumentRefusal === true ? 2 : 1,
          fixture.name,
        );
        assert.equal(execution.stdout, "", fixture.name);
        assert.equal(execution.stderr.endsWith("\n"), true, fixture.name);
        assert.equal(
          execution.stderr.trimEnd().split("\n").length,
          1,
          fixture.name,
        );
        assert.deepEqual(
          JSON.parse(execution.stderr),
          prepared.expectedArgumentRefusal === true
            ? { ok: false, code: "CLI_ARGUMENT_INVALID" }
            : {
                ok: false,
                command: "apply-upgrade",
                code: prepared.expectedCode,
                phase: "precondition",
                recovery: "not-required",
              },
          fixture.name,
        );
        assert.deepEqual(after, before, fixture.name);
        assert.deepEqual(controlsAfter, controlsBefore, fixture.name);
        assert.doesNotMatch(
          execution.stderr,
          /private|refs\/heads|\.git\/worktrees|invented-migration/u,
          fixture.name,
        );
      },
      {
        branch: `standards-upgrade-refusal-${index}`,
        ...(fixture.historical
          ? { preparePrimary: prepareHistoricalUpgradeFixture }
          : {}),
      },
    );
  }
});

test("the compiled plan-remove command emits exact portfolio and site plans without writes", async () => {
  for (const profile of ["portfolio", "site"]) {
    await withGitFixture(
      profile,
      async ({ linked }) => {
        const before = await gitRepositorySnapshot(linked);
        const execution = await executeBuiltPlanRemove(linked);
        const after = await gitRepositorySnapshot(linked);
        const revision = Buffer.from(before.head).toString("utf8").trim();

        assert.equal(execution.exitCode, 0, execution.stderr);
        assert.equal(execution.stderr, "");
        const emitted = JSON.parse(execution.stdout.trimEnd());
        assert.match(emitted.plan.planFingerprint, /^sha256:[a-f0-9]{64}$/u);
        assert.deepEqual(emitted, {
          ok: true,
          command: "plan-remove",
          plan: expectedRemovalPlan(
            profile,
            revision,
            emitted.plan.planFingerprint,
          ),
        });
        assert.deepEqual(after, before);
        assert.doesNotMatch(
          execution.stdout,
          /private-planning-destination|calendly\.com|refs\/heads|\.git\/worktrees/u,
        );
      },
      {
        bookingCalendly: planSettings,
        branch: `plan-remove-${profile}-test`,
      },
    );
  }
});

test("the compiled plan-remove command reports exact absence without writes", async () => {
  await withGitFixture("portfolio", async ({ linked }) => {
    const before = await gitRepositorySnapshot(linked);
    const execution = await executeBuiltPlanRemove(linked);
    const after = await gitRepositorySnapshot(linked);

    assert.equal(execution.exitCode, 1);
    assert.equal(execution.stdout, "");
    assert.deepEqual(JSON.parse(execution.stderr), {
      ok: false,
      command: "plan-remove",
      code: "CAPABILITY_NOT_INSTALLED",
      capability: "booking-calendly",
    });
    assert.deepEqual(after, before);
  });
});

test("the compiled plan-remove command refuses unsafe states without writes", async () => {
  const cases = [
    {
      name: "dirty repository",
      prepare: (root) => writeFile(join(root, "private-untracked.txt"), "x\n"),
      code: "GIT_WORKTREE_DIRTY",
    },
    {
      name: "managed surface drift",
      prepare: async (root) => {
        await writeFile(
          join(
            root,
            "apps/web/src/integrations/booking-calendly/booking-settings.ts",
          ),
          "private drift\n",
        );
        await commitAll(root, "drift managed Calendly settings");
      },
      code: "PROJECT_DRIFT_DETECTED",
    },
  ];

  for (const fixture of cases) {
    await withGitFixture(
      "portfolio",
      async ({ linked }) => {
        await fixture.prepare(linked);
        const before = await gitRepositorySnapshot(linked);
        const execution = await executeBuiltPlanRemove(linked);
        const after = await gitRepositorySnapshot(linked);

        assert.equal(execution.exitCode, 1, fixture.name);
        assert.equal(execution.stdout, "", fixture.name);
        assert.deepEqual(
          JSON.parse(execution.stderr),
          {
            ok: false,
            command: "plan-remove",
            code: fixture.code,
          },
          fixture.name,
        );
        assert.deepEqual(after, before, fixture.name);
        assert.doesNotMatch(
          execution.stderr,
          /private drift|calendly\.com|refs\/heads|\.git\/worktrees/u,
          fixture.name,
        );
      },
      {
        bookingCalendly: planSettings,
        branch: `plan-remove-${fixture.code.toLowerCase()}-test`,
      },
    );
  }
});

test("the compiled CLI completes exact add-remove-re-add transactions", async () => {
  for (const profile of ["portfolio", "site"]) {
    await withGitFixture(profile, async ({ linked, primary }) => {
      const primaryBefore = await gitRepositorySnapshot(primary);
      const linkedBefore = await gitRepositorySnapshot(linked);
      const initialProjectSource = await readFile(
        join(linked, ".egeria/project.yaml"),
        "utf8",
      );
      const planExecution = await executeBuiltPlanAdd(linked);
      assert.equal(planExecution.exitCode, 0, planExecution.stderr);
      const planEnvelope = JSON.parse(planExecution.stdout);
      const wrongApproval = await executeBuiltApplyAdd(
        linked,
        `sha256:${"0".repeat(64)}`,
      );
      assert.equal(wrongApproval.exitCode, 1);
      assert.deepEqual(JSON.parse(wrongApproval.stderr), {
        ok: false,
        command: "apply-add",
        code: "CAPABILITY_PLAN_APPROVAL_INVALID",
        phase: "precondition",
        recovery: "not-required",
      });
      assert.deepEqual(await gitRepositorySnapshot(linked), linkedBefore);

      const execution = await executeBuiltApplyAdd(
        linked,
        planEnvelope.result.planFingerprint,
      );
      assert.equal(execution.exitCode, 0, execution.stderr);
      assert.equal(execution.stderr, "");
      const envelope = JSON.parse(execution.stdout);
      const expectedPaths = [
        ...expectedPlanActions().map(({ path }) => path),
        ".egeria/migrations.jsonl",
        ".egeria/state.json",
      ].sort();
      assert.deepEqual(envelope, {
        ok: true,
        command: "apply-add",
        result: {
          status: "verified-final-diff-approval-required",
          baseRevision: Buffer.from(linkedBefore.head).toString("utf8").trim(),
          capability: { identifier: "booking-calendly", version: "0.1.0" },
          migration: "add-booking-calendly-0-1-0",
          changedPaths: expectedPaths,
          verificationChecks: core.capabilityAdditionVerificationChecks,
        },
      });
      assert.deepEqual(await gitRepositorySnapshot(primary), primaryBefore);

      const state = core.parseStateJson(
        await readFile(join(linked, ".egeria/state.json"), "utf8"),
      );
      const migrations = core.parseMigrationLog(
        await readFile(join(linked, ".egeria/migrations.jsonl"), "utf8"),
      );
      assert.equal(state.ok, true, JSON.stringify(state.issues));
      assert.equal(migrations.ok, true, JSON.stringify(migrations.issues));
      assert.deepEqual(state.value.appliedMigrations, [
        "add-booking-calendly-0-1-0",
      ]);
      assert.equal(migrations.value.length, 1);
      assert.equal(
        migrations.value[0].identifier,
        "add-booking-calendly-0-1-0",
      );
      const addedProjectSource = await readFile(
        join(linked, ".egeria/project.yaml"),
        "utf8",
      );
      const addedStateSource = await readFile(
        join(linked, ".egeria/state.json"),
        "utf8",
      );
      const addedMigrationSource = await readFile(
        join(linked, ".egeria/migrations.jsonl"),
        "utf8",
      );
      const addedProject = core.parseProjectYaml(addedProjectSource);
      assert.equal(addedProject.ok, true);
      assert.equal(
        addedProjectSource,
        core.serializeProjectYaml(addedProject.value),
      );
      assert.equal(addedStateSource, core.serializeStateJson(state.value));
      assert.equal(
        addedMigrationSource,
        migrations.value.map(core.serializeMigrationRecord).join(""),
      );
      assert.doesNotMatch(
        execution.stdout,
        /private-planning-destination|calendly\.com|refs\/heads|\.git\/worktrees/u,
      );

      await commitAll(linked, "add Calendly capability");
      const cleanAdded = await gitRepositorySnapshot(linked);
      const removalPlanExecution = await executeBuiltPlanRemove(linked);
      assert.equal(removalPlanExecution.exitCode, 0, removalPlanExecution.stderr);
      const removalPlan = JSON.parse(removalPlanExecution.stdout).plan;
      assert.deepEqual(await gitRepositorySnapshot(linked), cleanAdded);

      const wrongRemoval = await executeBuiltApplyRemove(
        linked,
        `sha256:${"0".repeat(64)}`,
      );
      assert.equal(wrongRemoval.exitCode, 1);
      assert.deepEqual(JSON.parse(wrongRemoval.stderr), {
        ok: false,
        command: "apply-remove",
        code: "CAPABILITY_PLAN_APPROVAL_INVALID",
        phase: "precondition",
        recovery: "not-required",
      });
      assert.deepEqual(await gitRepositorySnapshot(linked), cleanAdded);
      assert.equal(
        await readFile(join(linked, ".egeria/project.yaml"), "utf8"),
        addedProjectSource,
      );
      assert.equal(
        await readFile(join(linked, ".egeria/state.json"), "utf8"),
        addedStateSource,
      );
      assert.equal(
        await readFile(join(linked, ".egeria/migrations.jsonl"), "utf8"),
        addedMigrationSource,
      );

      const removal = await executeBuiltApplyRemove(
        linked,
        removalPlan.planFingerprint,
      );
      assert.equal(removal.exitCode, 0, removal.stderr);
      assert.equal(removal.stderr, "");
      const removalEnvelope = JSON.parse(removal.stdout);
      const removalPaths = [
        ...removalPlan.actions.flatMap((action) =>
          action.kind === "preserve-file-and-eject" ? [] : [action.path],
        ),
        ".egeria/migrations.jsonl",
        ".egeria/state.json",
      ].sort();
      assert.deepEqual(removalEnvelope, {
        ok: true,
        command: "apply-remove",
        result: {
          status: "verified-final-diff-approval-required",
          baseRevision: Buffer.from(cleanAdded.head).toString("utf8").trim(),
          capability: { identifier: "booking-calendly", version: "0.1.0" },
          migration: "remove-booking-calendly-0-1-0",
          changedPaths: removalPaths,
          preservedPaths: [],
          verificationChecks: core.capabilityRemovalVerificationChecks,
        },
      });
      const removedProjectSource = await readFile(
        join(linked, ".egeria/project.yaml"),
        "utf8",
      );
      const removedStateSource = await readFile(
        join(linked, ".egeria/state.json"),
        "utf8",
      );
      const removedMigrationSource = await readFile(
        join(linked, ".egeria/migrations.jsonl"),
        "utf8",
      );
      const removedProject = core.parseProjectYaml(removedProjectSource);
      const removedState = core.parseStateJson(removedStateSource);
      const removedMigrations = core.parseMigrationLog(removedMigrationSource);
      assert.equal(removedProject.ok, true);
      assert.equal(removedState.ok, true);
      assert.equal(removedMigrations.ok, true);
      assert.equal(removedProjectSource, initialProjectSource);
      assert.equal(
        removedProjectSource,
        core.serializeProjectYaml(removedProject.value),
      );
      assert.equal(
        removedStateSource,
        core.serializeStateJson(removedState.value),
      );
      assert.equal(
        removedMigrationSource,
        removedMigrations.value.map(core.serializeMigrationRecord).join(""),
      );
      assert.deepEqual(removedState.value.appliedMigrations, [
        "add-booking-calendly-0-1-0",
        "remove-booking-calendly-0-1-0",
      ]);
      assert.deepEqual(
        removedMigrations.value.map(({ identifier }) => identifier),
        removedState.value.appliedMigrations,
      );
      assert.equal(
        removedState.value.installedCapabilities.some(
          ({ identifier }) => identifier === "booking-calendly",
        ),
        false,
      );
      await assertExactInstalledAgreement(linked);
      assert.doesNotMatch(
        removal.stdout,
        /private-planning-destination|calendly\.com|refs\/heads|\.git\/worktrees/u,
      );

      await commitAll(linked, "remove Calendly capability");
      const cleanRemoved = await gitRepositorySnapshot(linked);
      const repeatedRemoval = await executeBuiltApplyRemove(
        linked,
        removalPlan.planFingerprint,
      );
      assert.equal(repeatedRemoval.exitCode, 1);
      assert.equal(repeatedRemoval.stdout, "");
      assert.deepEqual(JSON.parse(repeatedRemoval.stderr), {
        ok: false,
        command: "apply-remove",
        code: "CAPABILITY_NOT_INSTALLED",
        capability: "booking-calendly",
      });
      assert.deepEqual(await gitRepositorySnapshot(linked), cleanRemoved);
      assert.equal(
        await readFile(join(linked, ".egeria/project.yaml"), "utf8"),
        removedProjectSource,
      );
      assert.equal(
        await readFile(join(linked, ".egeria/state.json"), "utf8"),
        removedStateSource,
      );
      assert.equal(
        await readFile(join(linked, ".egeria/migrations.jsonl"), "utf8"),
        removedMigrationSource,
      );

      const readdPlanExecution = await executeBuiltPlanAdd(linked);
      assert.equal(readdPlanExecution.exitCode, 0, readdPlanExecution.stderr);
      const readdPlan = JSON.parse(readdPlanExecution.stdout).result;
      assert.deepEqual(await gitRepositorySnapshot(linked), cleanRemoved);
      const readdition = await executeBuiltApplyAdd(
        linked,
        readdPlan.planFingerprint,
      );
      assert.equal(readdition.exitCode, 0, readdition.stderr);
      assert.equal(readdition.stderr, "");
      const readdedProjectSource = await readFile(
        join(linked, ".egeria/project.yaml"),
        "utf8",
      );
      const readdedStateSource = await readFile(
        join(linked, ".egeria/state.json"),
        "utf8",
      );
      const readdedMigrationSource = await readFile(
        join(linked, ".egeria/migrations.jsonl"),
        "utf8",
      );
      const readdedProject = core.parseProjectYaml(readdedProjectSource);
      const readdedState = core.parseStateJson(readdedStateSource);
      const readdedMigrations = core.parseMigrationLog(readdedMigrationSource);
      assert.equal(readdedProject.ok, true);
      assert.equal(readdedState.ok, true);
      assert.equal(readdedMigrations.ok, true);
      assert.equal(readdedProjectSource, addedProjectSource);
      assert.equal(
        readdedProjectSource,
        core.serializeProjectYaml(readdedProject.value),
      );
      assert.equal(
        readdedStateSource,
        core.serializeStateJson(readdedState.value),
      );
      assert.equal(
        readdedMigrationSource,
        readdedMigrations.value.map(core.serializeMigrationRecord).join(""),
      );
      assert.deepEqual(readdedState.value.appliedMigrations, [
        "add-booking-calendly-0-1-0",
        "remove-booking-calendly-0-1-0",
        "add-booking-calendly-0-1-0",
      ]);
      assert.deepEqual(
        readdedMigrations.value.map(({ identifier }) => identifier),
        readdedState.value.appliedMigrations,
      );
      assert.equal(
        readdedState.value.installedCapabilities.some(
          ({ identifier }) => identifier === "booking-calendly",
        ),
        true,
      );
      await assertExactInstalledAgreement(linked);
      const primaryAfterLifecycle = await gitRepositorySnapshot(primary);
      assert.deepEqual(
        {
          head: primaryAfterLifecycle.head,
          status: primaryAfterLifecycle.status,
          indexVisibility: primaryAfterLifecycle.indexVisibility,
          tree: primaryAfterLifecycle.tree,
          operations: primaryAfterLifecycle.operations,
        },
        {
          head: primaryBefore.head,
          status: primaryBefore.status,
          indexVisibility: primaryBefore.indexVisibility,
          tree: primaryBefore.tree,
          operations: primaryBefore.operations,
        },
      );
    });
  }
});

test("compiled removal preserves modified and already-ejected application surfaces", async () => {
  await withGitFixture(
    "portfolio",
    async ({ linked, primary }) => {
      await replaceFakeLockfileWithFixture(linked, "portfolio");
      const primaryBefore = await gitRepositorySnapshot(primary);
      const modifiedPath = "apps/web/content/en-CA/booking-calendly.yaml";
      const ejectedPath =
        "apps/web/src/integrations/booking-calendly/booking-content.ts";
      const modifiedSource = `${await readFile(join(linked, modifiedPath), "utf8")}\n# application change\n`;
      const ejectedSource = await readFile(join(linked, ejectedPath), "utf8");
      await writeFile(join(linked, modifiedPath), modifiedSource);

      const projectPath = join(linked, ".egeria/project.yaml");
      const statePath = join(linked, ".egeria/state.json");
      const project = core.parseProjectYaml(await readFile(projectPath, "utf8"));
      const state = core.parseStateJson(await readFile(statePath, "utf8"));
      assert.equal(project.ok, true);
      assert.equal(state.ok, true);
      const ejectedProjectSource = core.serializeProjectYaml({
        ...project.value,
        ejectedAreas: [ejectedPath],
      });
      await writeFile(projectPath, ejectedProjectSource);
      const ejectedState = {
        ...state.value,
        managedSurfaces: state.value.managedSurfaces.map((surface) =>
          surface.path === ejectedPath
            ? { ...surface, ownership: "ejected" }
            : surface.identifier === "builder-project-configuration"
              ? {
                  ...surface,
                  fingerprint: core.fingerprintFileContent(
                    new TextEncoder().encode(ejectedProjectSource),
                  ),
                }
              : surface,
        ),
        ejections: [ejectedPath],
      };
      await writeFile(statePath, core.serializeStateJson(ejectedState));
      await commitAll(linked, "modify and eject Calendly surfaces");
      const cleanBefore = await gitRepositorySnapshot(linked);
      const controlsBeforePlan = {
        project: await readFile(projectPath, "utf8"),
        state: await readFile(statePath, "utf8"),
        migrations: await readFile(
          join(linked, ".egeria/migrations.jsonl"),
          "utf8",
        ),
      };

      const planExecution = await executeBuiltPlanRemove(linked);
      assert.equal(planExecution.exitCode, 0, planExecution.stderr);
      const plan = JSON.parse(planExecution.stdout).plan;
      assert.deepEqual(await gitRepositorySnapshot(linked), cleanBefore);
      assert.deepEqual(
        {
          project: await readFile(projectPath, "utf8"),
          state: await readFile(statePath, "utf8"),
          migrations: await readFile(
            join(linked, ".egeria/migrations.jsonl"),
            "utf8",
          ),
        },
        controlsBeforePlan,
      );
      assert.deepEqual(
        plan.actions
          .filter(({ kind }) => kind === "preserve-file-and-eject")
          .map(({ path }) => path),
        [ejectedPath, modifiedPath].sort(),
      );

      const removal = await executeBuiltApplyRemove(
        linked,
        plan.planFingerprint,
      );
      assert.equal(removal.exitCode, 0, removal.stderr);
      assert.equal(removal.stderr, "");
      const envelope = JSON.parse(removal.stdout);
      assert.deepEqual(envelope.result.preservedPaths, [
        ejectedPath,
        modifiedPath,
      ].sort());
      assert.equal(envelope.result.changedPaths.includes(ejectedPath), false);
      assert.equal(envelope.result.changedPaths.includes(modifiedPath), false);
      assert.equal(await readFile(join(linked, modifiedPath), "utf8"), modifiedSource);
      assert.equal(await readFile(join(linked, ejectedPath), "utf8"), ejectedSource);

      const finalProjectSource = await readFile(projectPath, "utf8");
      const finalStateSource = await readFile(statePath, "utf8");
      const finalMigrationSource = await readFile(
        join(linked, ".egeria/migrations.jsonl"),
        "utf8",
      );
      const finalProject = core.parseProjectYaml(finalProjectSource);
      const finalState = core.parseStateJson(finalStateSource);
      const finalMigrations = core.parseMigrationLog(finalMigrationSource);
      assert.equal(finalProject.ok, true);
      assert.equal(finalState.ok, true);
      assert.equal(finalMigrations.ok, true);
      assert.equal(
        finalProjectSource,
        core.serializeProjectYaml(finalProject.value),
      );
      assert.equal(finalStateSource, core.serializeStateJson(finalState.value));
      assert.equal(
        finalMigrationSource,
        finalMigrations.value.map(core.serializeMigrationRecord).join(""),
      );
      assert.deepEqual(finalProject.value.ejectedAreas, envelope.result.preservedPaths);
      assert.deepEqual(finalState.value.ejections, envelope.result.preservedPaths);
      const changedSurfaceIdentifiers = new Set([
        "builder-home-route",
        "builder-migration-log",
        "builder-project-configuration",
      ]);
      for (const priorSurface of ejectedState.managedSurfaces) {
        if (
          priorSurface.owner.kind === "capability" &&
          priorSurface.owner.identifier === "booking-calendly"
        ) {
          continue;
        }
        if (changedSurfaceIdentifiers.has(priorSurface.identifier)) {
          continue;
        }
        assert.deepEqual(
          finalState.value.managedSurfaces.find(
            ({ identifier }) => identifier === priorSurface.identifier,
          ),
          priorSurface,
        );
      }
      await assertExactInstalledAgreement(linked, {
        allowPreservedCalendly: true,
      });
      assert.deepEqual(
        withoutSharedRefs(await gitRepositorySnapshot(primary)),
        withoutSharedRefs(primaryBefore),
      );
    },
    {
      bookingCalendly: planSettings,
      branch: "apply-remove-preservation-test",
    },
  );
});

test("compiled removal verification failure retains transformation and old receipts", async () => {
  await withGitFixture(
    "portfolio",
    async ({ linked, primary }) => {
      await replaceFakeLockfileWithFixture(linked, "portfolio");
      const primaryBefore = await gitRepositorySnapshot(primary);
      const preservedPath =
        "apps/web/src/integrations/booking-calendly/booking-content.ts";
      const invalidSource = "export const broken = ;\n";
      await writeFile(join(linked, preservedPath), invalidSource);
      await commitAll(linked, "make Calendly application source invalid");
      const initialInspection = await core.inspectGitWorktree({ root: linked });
      assert.equal(initialInspection.ok, true);
      const stateBefore = await readFile(
        join(linked, ".egeria/state.json"),
        "utf8",
      );
      const migrationsBefore = await readFile(
        join(linked, ".egeria/migrations.jsonl"),
        "utf8",
      );
      const planExecution = await executeBuiltPlanRemove(linked);
      assert.equal(planExecution.exitCode, 0, planExecution.stderr);
      const plan = JSON.parse(planExecution.stdout).plan;
      assert.equal(
        plan.actions.find(({ path }) => path === preservedPath).kind,
        "preserve-file-and-eject",
      );

      const removal = await executeBuiltApplyRemove(
        linked,
        plan.planFingerprint,
      );
      assert.equal(removal.exitCode, 1);
      assert.equal(removal.stdout, "");
      assert.deepEqual(JSON.parse(removal.stderr), {
        ok: false,
        command: "apply-remove",
        code: "CAPABILITY_VERIFICATION_FAILED",
        phase: "verify",
        recovery: "inspect-worktree",
      });
      assert.equal(await readFile(join(linked, preservedPath), "utf8"), invalidSource);
      assert.equal(
        await readFile(join(linked, ".egeria/state.json"), "utf8"),
        stateBefore,
      );
      assert.equal(
        await readFile(join(linked, ".egeria/migrations.jsonl"), "utf8"),
        migrationsBefore,
      );
      const transformedProjectSource = await readFile(
        join(linked, ".egeria/project.yaml"),
        "utf8",
      );
      const transformedProject = core.parseProjectYaml(transformedProjectSource);
      assert.equal(transformedProject.ok, true);
      assert.equal(
        transformedProject.value.selectedCapabilities.includes(
          "booking-calendly",
        ),
        false,
      );
      assert.deepEqual(transformedProject.value.ejectedAreas, [preservedPath]);
      const transformedPaths = plan.actions.flatMap((action) =>
        action.kind === "preserve-file-and-eject" ? [] : [action.path],
      );
      assert.deepEqual(
        await core.inspectGitExpectedChanges({
          root: linked,
          identity: initialInspection.identity,
          expectedPaths: transformedPaths,
        }),
        { ok: true },
      );
      assert.deepEqual(
        withoutSharedRefs(await gitRepositorySnapshot(primary)),
        withoutSharedRefs(primaryBefore),
      );
      assert.doesNotMatch(
        removal.stderr,
        /export const broken|calendly\.com|refs\/heads|\.git\/worktrees/u,
      );
    },
    {
      bookingCalendly: planSettings,
      branch: "apply-remove-verification-failure-test",
    },
  );
});

test("the compiled plan-add command refuses unsafe repository states without writes", async () => {
  const cases = [
    {
      name: "primary worktree",
      fixture: "portfolio",
      select: ({ primary }) => primary,
      prepare: async () => {},
      code: "GIT_WORKTREE_NOT_ISOLATED",
    },
    {
      name: "untracked dirt",
      fixture: "portfolio",
      select: ({ linked }) => linked,
      prepare: (root) => writeFile(join(root, "private-untracked.txt"), "x\n"),
      code: "GIT_WORKTREE_DIRTY",
    },
    {
      name: "detached head",
      fixture: "portfolio",
      select: ({ linked }) => linked,
      prepare: (root) => executeGit(root, ["checkout", "--detach"]),
      code: "GIT_BRANCH_REQUIRED",
    },
    {
      name: "operation marker",
      fixture: "portfolio",
      select: ({ linked }) => linked,
      prepare: async (root) => {
        const output = await executeGit(root, [
          "rev-parse",
          "--git-path",
          "MERGE_HEAD",
        ]);
        await writeFile(Buffer.from(output).toString("utf8").trim(), "operation\n");
      },
      code: "GIT_OPERATION_IN_PROGRESS",
    },
    {
      name: "committed application drift",
      fixture: "portfolio",
      select: ({ linked }) => linked,
      prepare: async (root) => {
        await writeFile(join(root, "apps/web/app/page.tsx"), "private drift\n");
        await commitAll(root, "drift home route");
      },
      code: "PROJECT_DRIFT_DETECTED",
    },
    {
      name: "missing unrelated application-owned surface",
      fixture: "portfolio",
      select: ({ linked }) => linked,
      prepare: async (root) => {
        await rm(join(root, "apps/web/app/layout.tsx"));
        await commitAll(root, "delete application layout");
      },
      code: "PROJECT_DRIFT_DETECTED",
    },
    {
      name: "surface omitted from installed inventory",
      fixture: "portfolio",
      select: ({ linked }) => linked,
      prepare: async (root) => {
        const statePath = join(root, ".egeria/state.json");
        const parsed = core.parseStateJson(await readFile(statePath, "utf8"));
        assert.equal(parsed.ok, true);
        await writeFile(
          statePath,
          core.serializeStateJson({
            ...parsed.value,
            managedSurfaces: parsed.value.managedSurfaces.filter(
              ({ identifier }) => identifier !== "builder-root-layout",
            ),
          }),
        );
        await commitAll(root, "omit application layout from state");
      },
      code: "PROJECT_DRIFT_DETECTED",
    },
    {
      name: "committed ejection",
      fixture: "portfolio",
      select: ({ linked }) => linked,
      prepare: async (root) => {
        const statePath = join(root, ".egeria/state.json");
        const parsed = core.parseStateJson(await readFile(statePath, "utf8"));
        assert.equal(parsed.ok, true);
        await writeFile(
          statePath,
          core.serializeStateJson({
            ...parsed.value,
            ejections: ["apps/web/app/page.tsx"],
          }),
        );
        await commitAll(root, "record unsupported ejection");
      },
      code: "PROJECT_EJECTION_UNSUPPORTED",
    },
    {
      name: "ignored create collision",
      fixture: "portfolio",
      select: ({ linked }) => linked,
      prepare: async (root) => {
        const ignorePath = join(root, ".gitignore");
        await writeFile(
          ignorePath,
          `${await readFile(ignorePath, "utf8")}apps/web/content/en-CA/booking-calendly.yaml\n`,
        );
        await commitAll(root, "ignore collision target");
        await writeFile(
          join(root, "apps/web/content/en-CA/booking-calendly.yaml"),
          "ignored collision\n",
        );
      },
      code: "CAPABILITY_ACTION_CONFLICT",
    },
    {
      name: "absent ignored create target",
      fixture: "portfolio",
      select: ({ linked }) => linked,
      prepare: async (root) => {
        const ignorePath = join(root, ".gitignore");
        await writeFile(
          ignorePath,
          `${await readFile(ignorePath, "utf8")}apps/web/content/en-CA/booking-calendly.yaml\n`,
        );
        await commitAll(root, "ignore absent create target");
      },
      code: "CAPABILITY_ACTION_CONFLICT",
    },
    ...[
      ["assume-unchanged", "--assume-unchanged"],
      ["skip-worktree", "--skip-worktree"],
    ].map(([name, flag]) => ({
      name: `hidden tracked change with ${name}`,
      fixture: "portfolio",
      select: ({ linked }) => linked,
      prepare: async (root) => {
        await executeGit(root, ["update-index", flag, ".gitignore"]);
        await writeFile(join(root, ".gitignore"), `hidden ${name} change\n`);
      },
      code: "GIT_WORKTREE_DIRTY",
    })),
    {
      name: "already installed capability",
      fixture: "portfolio-calendly",
      select: ({ linked }) => linked,
      prepare: async () => {},
      code: "CAPABILITY_ALREADY_INSTALLED",
    },
  ];

  for (const fixture of cases) {
    await withGitFixture(fixture.fixture, async (roots) => {
      const root = fixture.select(roots);
      await fixture.prepare(root);
      const before = await gitRepositorySnapshot(root);
      const execution = await executeBuiltPlanAdd(root);
      const after = await gitRepositorySnapshot(root);

      assert.equal(execution.exitCode, 1, fixture.name);
      assert.equal(execution.stdout, "", fixture.name);
      assert.deepEqual(
        execution.stderr.trimEnd().split("\n"),
        [
          JSON.stringify({
            ok: false,
            command: "plan-add",
            code: fixture.code,
          }),
        ],
        fixture.name,
      );
      assert.deepEqual(after, before, fixture.name);
      assert.doesNotMatch(
        execution.stderr,
        /private-planning-destination|calendly\.com|refs\/heads|private drift|private-untracked/u,
        fixture.name,
      );
    });
  }
});

test("the built entry emits one JSON line with exact process exits", async () => {
  await withGeneratedFixture(async (directory) => {
    const entry = resolve(packageRoot, "dist/index.js");
    const healthy = await executeNode([
      entry,
      "doctor",
      "--directory",
      directory,
    ]);

    assert.equal(healthy.exitCode, 0);
    assert.equal(healthy.stderr, "");
    assert.deepEqual(healthy.stdout.trimEnd().split("\n"), [
      JSON.stringify({
        ok: true,
        command: "doctor",
        result: { healthy: true, diagnostics: [] },
      }),
    ]);

    const invalid = await executeNode([entry, "doctor", "--unknown", "value"]);
    assert.equal(invalid.exitCode, 2);
    assert.equal(invalid.stdout, "");
    assert.equal(
      invalid.stderr,
      `${JSON.stringify({ ok: false, code: "CLI_ARGUMENT_INVALID" })}\n`,
    );
  });
});
