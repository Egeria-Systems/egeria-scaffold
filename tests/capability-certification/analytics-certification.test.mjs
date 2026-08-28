import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const certificationScript = resolve(
  repositoryRoot,
  "scripts/certify-analytics.mjs",
);
const revision = "a".repeat(40);
const subject = Object.freeze({
  descriptorVersion: "0.1.0",
  behaviorContractDigest:
    "sha256:ca2e69a35e935eab011f0543fdf140e644a0dec490650298bdfba730e2e9d378",
});
const providerArguments = Object.freeze([
  "--cloudflare-web-analytics-token",
  "0123456789abcdef0123456789abcdef",
  "--google-analytics-id",
  "G-ABCDEF1234",
  "--microsoft-clarity-id",
  "clarity123",
  "--microsoft-clarity-audience",
  "not-directed-to-minors",
  "--search-console-verification",
  "search-console-verification-token",
  "--looker-studio",
]);
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
const commonCapabilities = Object.freeze([
  "standards",
  "content-files",
  "section-composition",
  "deployment-cloudflare",
  "observability",
]);
const generatedChecks = Object.freeze([
  "pnpm-version",
  "frozen-install",
  "peer-dependencies",
  "dependency-audit",
  "registry-signatures",
  "lint",
  "cloudflare-types",
  "typecheck",
  "unit-tests",
  "component-tests",
  "next-build",
  "opennext-build",
  "browser-install",
  "browser-development",
  "browser-preview",
]);
const freshScaffoldChecks = Object.freeze([
  "compiled-cli-create",
  "state-inference",
  "healthy-diagnostics",
  "exact-diff",
  ...generatedChecks,
  "exact-generated-analytics-settings",
]);
const lifecycleTestsByFile = new Map([
  [
    "apps/cli/tests/cli.test.mjs",
    Object.freeze([
      "the compiled CLI preserves analytics and multilingual across both install orders and analytics re-addition",
      "the compiled CLI refuses duplicate analytics addition without repository mutation",
    ]),
  ],
  [
    "packages/builder-core/tests/apply-capability-addition.test.mjs",
    Object.freeze([
      "analytics addition composes with multilingual and persists only public settings",
      "analytics addition binds transformation to the approved settings snapshot",
      "analytics addition retains failure prefixes and final authority",
    ]),
  ],
  [
    "packages/builder-core/tests/apply-capability-removal.test.mjs",
    Object.freeze([
      "analytics removal restores the multilingual layout and persists fresh discovery",
      "analytics removal can be re-added with exact repaired surfaces and ordered history",
      "analytics removal retains failure prefixes and final authority",
    ]),
  ],
  [
    "packages/builder-core/tests/plan-capability-addition.test.mjs",
    Object.freeze([
      "analytics addition redacts public identifiers and composes after multilingual",
      "analytics addition planning refuses drift and binds private authority",
    ]),
  ],
  [
    "packages/builder-core/tests/plan-capability-removal.test.mjs",
    Object.freeze([
      "analytics removal restores the composed layout and requires provider disposition review",
      "analytics removal planning refuses drift and binds private authority",
    ]),
  ],
]);

function successfulTap(testNames) {
  return [
    "TAP version 13",
    ...testNames.flatMap((name, index) => [
      `# Subtest: ${name}`,
      `ok ${index + 1} - ${name}`,
    ]),
    `1..${testNames.length}`,
    `# tests ${testNames.length}`,
    `# pass ${testNames.length}`,
    "# fail 0",
    "",
  ].join("\n");
}

function renderAnalyticsSettingsArtifact(settings) {
  return [
    'import type { AnalyticsSettings } from "./analytics-provider-contract";',
    "",
    `export const analyticsSettings = ${JSON.stringify(settings, null, 2)} as const satisfies AnalyticsSettings;`,
    "",
  ].join("\n");
}

function createJourney({
  profile,
  projectName,
  displayName,
  expectedCapabilities,
  recipeVersion,
  verifierIdentifier,
  createArguments,
  settingsArtifactSource = renderAnalyticsSettingsArtifact(analyticsSettings),
  replaceOwner = false,
}) {
  const state = { commands: [], ownedPath: undefined, projectRoot: undefined };
  const adapters = {
    async runCommand(input) {
      state.commands.push(input);
      const command = input.arguments[1];
      const projectRoot = input.arguments[input.arguments.indexOf("--directory") + 1];
      if (command === "create") {
        state.projectRoot = projectRoot;
        state.ownedPath = dirname(projectRoot);
        if (replaceOwner) {
          await rm(state.ownedPath, { recursive: true });
          await mkdir(state.ownedPath, { mode: 0o700 });
          await writeFile(join(state.ownedPath, "replacement-marker"), "retained\n");
        }
        await mkdir(join(projectRoot, ".egeria"), { recursive: true });
        await writeFile(
          join(projectRoot, ".egeria/project.yaml"),
          `recipeVersion: ${recipeVersion}\n`,
        );
        const settingsPath = join(
          projectRoot,
          "apps/web/src/integrations/analytics/analytics-settings.ts",
        );
        await mkdir(dirname(settingsPath), { recursive: true });
        await writeFile(settingsPath, settingsArtifactSource);
        return `${JSON.stringify({
          ok: true,
          command,
          profile,
          capabilities: expectedCapabilities,
        })}\n`;
      }
      if (command === "infer") {
        return `${JSON.stringify({
          ok: true,
          command,
          result: {
            state: {
              kind: "valid",
              value: {
                installedCapabilities: [
                  { identifier: "analytics", version: "0.1.0" },
                ],
              },
            },
            capabilities: [{ identifier: "analytics", category: "confirmed" }],
          },
        })}\n`;
      }
      if (command === "doctor") {
        return `${JSON.stringify({
          ok: true,
          command,
          result: { healthy: true, diagnostics: [] },
        })}\n`;
      }
      if (command === "diff") {
        return `${JSON.stringify({
          ok: true,
          command,
          result: { equal: true, differences: [] },
        })}\n`;
      }
      throw new Error("unexpected command");
    },
    async verifyProject(root, identifier, receivedProjectName) {
      assert.equal(root, state.projectRoot);
      assert.equal(identifier, verifierIdentifier);
      assert.equal(receivedProjectName, projectName);
      return {
        ok: true,
        fixtures: [verifierIdentifier],
        profiles: [profile],
        checks: generatedChecks,
      };
    },
  };

  return {
    adapters,
    state,
    expectedCreateArguments: [
      "create",
      "--profile",
      profile,
      "--name",
      projectName,
      "--display-name",
      displayName,
      "--directory",
      undefined,
      ...createArguments,
    ],
  };
}

function createCertificationAdapters(overrides = {}) {
  const portfolio = createJourney({
    profile: "portfolio",
    projectName: "acme-portfolio-analytics",
    displayName: "Acme Portfolio Analytics",
    expectedCapabilities: [...commonCapabilities, "analytics"],
    recipeVersion: "0.10.0",
    verifierIdentifier: "portfolio-analytics",
    createArguments: providerArguments,
    settingsArtifactSource: overrides.portfolioSettingsArtifactSource,
    replaceOwner: overrides.replacePortfolioOwner === true,
  });
  const site = createJourney({
    profile: "site",
    projectName: "acme-site-multilingual-analytics",
    displayName: "Acme Site Multilingual Analytics",
    expectedCapabilities: [
      ...commonCapabilities,
      "site-routing",
      "analytics",
      "multilingual",
    ],
    recipeVersion: "0.11.0",
    verifierIdentifier: "site-multilingual-analytics",
    createArguments: [...providerArguments, "--multilingual"],
    settingsArtifactSource: overrides.siteSettingsArtifactSource,
  });
  const lifecycleCommands = [];
  const adapters = {
    readCurrentRevision: async () => revision,
    readRepositoryStatus: async () => "",
    readRepositoryIndexEntries: async () => "H selected-evidence.test.mjs\0",
    async runLifecycleCommand(input) {
      lifecycleCommands.push(input);
      const selected = lifecycleTestsByFile.get(input.arguments.at(-1));
      assert.notEqual(selected, undefined);
      return { stdout: successfulTap(selected) };
    },
    journeys: { portfolio: portfolio.adapters, site: site.adapters },
    ...overrides,
  };
  delete adapters.replacePortfolioOwner;
  delete adapters.portfolioSettingsArtifactSource;
  delete adapters.siteSettingsArtifactSource;

  return { adapters, lifecycleCommands, portfolio, site };
}

test("analytics certification binds both full-matrix profiles and lifecycle evidence to one exact local subject", async () => {
  const { certifyAnalyticsForTesting } = await import(certificationScript);
  let revisionReads = 0;
  let statusReads = 0;
  let indexReads = 0;
  const scaffold = createCertificationAdapters({
    readCurrentRevision: async () => {
      revisionReads += 1;
      return revision;
    },
    readRepositoryStatus: async () => {
      statusReads += 1;
      return "";
    },
    readRepositoryIndexEntries: async () => {
      indexReads += 1;
      return "H selected-evidence.test.mjs\0";
    },
  });

  const result = await certifyAnalyticsForTesting(
    { revision },
    scaffold.adapters,
  );

  assert.deepEqual(result, {
    ok: true,
    capability: "analytics",
    version: "0.1.0",
    profiles: ["portfolio", "site"],
    subject,
    evidenceRevision: revision,
    outcomes: ["existing-repository-lifecycle", "fresh-scaffold"],
    providerRecordsClaimed: false,
    checks: [
      ...freshScaffoldChecks.map((check) => `portfolio:${check}`),
      ...freshScaffoldChecks.map((check) => `site:${check}`),
      "compiled-add-remove-re-add-both-profiles",
      "duplicate-analytics-add-refusal",
      "settings-bound-addition",
      "addition-state-last-and-failure-prefixes",
      "removal-state-last-provider-disposition-and-failure-prefixes",
      "drift-and-unsafe-root-refusal",
      "final-diff-authority",
      "exact-final-byte-validation",
      "repository-sources-unchanged",
    ],
  });
  for (const journey of [scaffold.portfolio, scaffold.site]) {
    const createArguments = journey.state.commands[0].arguments.slice(1);
    const expectedArguments = [...journey.expectedCreateArguments];
    expectedArguments[expectedArguments.indexOf(undefined)] =
      journey.state.projectRoot;
    assert.deepEqual(createArguments, expectedArguments);
    assert.equal(await fileExists(journey.state.ownedPath), false);
  }
  assert.deepEqual(
    scaffold.lifecycleCommands.map(({ arguments: arguments_ }) =>
      arguments_.at(-1),
    ),
    [...lifecycleTestsByFile.keys()],
  );
  assert.equal(revisionReads, 2);
  assert.equal(statusReads, 2);
  assert.equal(indexReads, 2);
});

test("analytics certification rejects missing or changed generated settings fields for both profiles without disclosure", async (context) => {
  const { certifyAnalyticsForTesting, AnalyticsCertificationError } =
    await import(certificationScript);
  const cases = [
    {
      name: "portfolio missing provider field",
      profile: "portfolio",
      mutate(settings) {
        delete settings.providers.googleAnalytics4;
      },
    },
    {
      name: "portfolio changed provider field",
      profile: "portfolio",
      mutate(settings) {
        settings.providers.cloudflareWebAnalytics.siteToken =
          "changed-private-site-token";
      },
    },
    {
      name: "site missing operational field",
      profile: "site",
      mutate(settings) {
        delete settings.operationalIntegrations.googleSearchConsole;
      },
    },
    {
      name: "site changed operational field",
      profile: "site",
      mutate(settings) {
        settings.operationalIntegrations.lookerStudio.connector =
          "changed-private-connector";
      },
    },
  ];

  for (const fixture of cases) {
    await context.test(fixture.name, async () => {
      const changedSettings = structuredClone(analyticsSettings);
      fixture.mutate(changedSettings);
      const sourceOverride = {
        [`${fixture.profile}SettingsArtifactSource`]:
          renderAnalyticsSettingsArtifact(changedSettings),
      };
      const scaffold = createCertificationAdapters(sourceOverride);
      let observedError;

      await assert.rejects(
        certifyAnalyticsForTesting({ revision }, scaffold.adapters),
        (error) => {
          observedError = error;
          return (
            error instanceof AnalyticsCertificationError &&
            error.code === "GENERATED_ANALYTICS_SETTINGS_INVALID"
          );
        },
      );
      assert.doesNotMatch(
        observedError.message,
        /0123456789abcdef|G-ABCDEF1234|clarity123|search-console-verification-token|changed-private/u,
      );
      assert.equal(await fileExists(scaffold.portfolio.state.ownedPath), false);
      assert.equal(await fileExists(scaffold.site.state.ownedPath), false);
    });
  }
});

test("analytics portfolio verification executes isolated unit, component, build, and browser behavior without provider authority", async () => {
  const { verifyAnalyticsPortfolioForTesting } = await import(
    certificationScript
  );
  const ownedRoot = await mkdtemp(join(tmpdir(), "analytics-portfolio-verifier-"));
  const projectRoot = join(ownedRoot, "project");
  const commands = [];

  try {
    await mkdir(projectRoot);
    const result = await verifyAnalyticsPortfolioForTesting({
      projectRoot,
      environment: {
        PATH: "/verified/bin",
        CLOUDFLARE_API_TOKEN: "private-token",
        GOOGLE_APPLICATION_CREDENTIALS: "/private/credentials.json",
      },
      async runCommand(command) {
        commands.push(command);
        return command.arguments[0] === "--version" ? "11.20.0\n" : "";
      },
    });

    assert.deepEqual(result, {
      ok: true,
      fixtures: ["portfolio-analytics"],
      profiles: ["portfolio"],
      checks: generatedChecks,
    });
    assert.deepEqual(
      commands.map(({ arguments: arguments_ }) => arguments_),
      [
        ["--version"],
        [
          "install",
          "--frozen-lockfile",
          "--store-dir",
          join(ownedRoot, "analytics-portfolio-support/store"),
        ],
        ["peers", "check"],
        ["audit", "--audit-level", "moderate"],
        ["audit", "signatures"],
        ["run", "lint"],
        ["--dir", "apps/web", "run", "cf-typegen"],
        ["run", "typecheck"],
        ["run", "test:unit"],
        ["run", "test:component"],
        ["run", "build"],
        [
          "--dir",
          "apps/web",
          "exec",
          "opennextjs-cloudflare",
          "build",
          "--skipNextBuild",
        ],
        ["--dir", "apps/web", "run", "browser:install"],
        ["--dir", "apps/web", "run", "test:e2e:dev"],
        ["--dir", "apps/web", "run", "test:e2e:preview"],
      ],
    );
    for (const command of commands) {
      assert.equal(command.cwd, projectRoot);
      assert.equal(command.environment.PATH, "/verified/bin");
      assert.equal(command.environment.CLOUDFLARE_API_TOKEN, undefined);
      assert.equal(command.environment.CLOUDFLARE_ACCOUNT_ID, undefined);
      assert.equal(command.environment.GOOGLE_APPLICATION_CREDENTIALS, undefined);
      assert.equal(command.environment.NPM_TOKEN, undefined);
    }
  } finally {
    await rm(ownedRoot, { recursive: true, force: true });
  }
});

test("analytics production commands give compiled create a finite aggregate timeout without widening child bounds", async () => {
  const { runAnalyticsProductionCommandForTesting } = await import(
    certificationScript
  );
  const calls = [];
  const execute = async (executable, arguments_, options) => {
    calls.push({ executable, arguments: arguments_, options });
    return { stdout: "ok\n" };
  };
  const environment = { PATH: "/verified/bin" };

  assert.equal(
    await runAnalyticsProductionCommandForTesting(
      {
        executable: process.execPath,
        arguments: [
          resolve(repositoryRoot, "apps/cli/dist/index.js"),
          "create",
        ],
        cwd: repositoryRoot,
        environment,
      },
      execute,
    ),
    "ok\n",
  );
  assert.equal(
    await runAnalyticsProductionCommandForTesting(
      {
        executable: "pnpm",
        arguments: ["run", "build"],
        cwd: "/private/generated-project",
        environment,
        timeout: 15 * 60 * 1000,
      },
      execute,
    ),
    "ok\n",
  );

  assert.equal(calls[0].options.timeout, 45 * 60 * 1000);
  assert.equal(calls[1].options.timeout, 15 * 60 * 1000);
  for (const call of calls) {
    assert.equal(call.options.cwd, call === calls[0] ? repositoryRoot : "/private/generated-project");
    assert.equal(call.options.env, environment);
    assert.equal(call.options.shell, false);
  }
});

test("analytics certification fails closed on dirty, hidden-index, revision, and lifecycle evidence drift", async (context) => {
  const { certifyAnalyticsForTesting, AnalyticsCertificationError } =
    await import(certificationScript);

  await context.test("rejects a non-exact revision before adapters", async () => {
    await assert.rejects(
      certifyAnalyticsForTesting({ revision: "a".repeat(39) }, {}),
      (error) =>
        error instanceof AnalyticsCertificationError &&
        error.code === "CERTIFICATION_REVISION_INVALID",
    );
  });

  for (const [name, overrides, code] of [
    [
      "dirty checkout",
      { readRepositoryStatus: async () => "?? private-source.ts\0" },
      "CERTIFICATION_WORKTREE_DIRTY",
    ],
    [
      "hidden index",
      { readRepositoryIndexEntries: async () => "S selected-evidence.test.mjs\0" },
      "CERTIFICATION_INDEX_FLAGS",
    ],
  ]) {
    await context.test(`rejects ${name} before scaffolding`, async () => {
      const scaffold = createCertificationAdapters(overrides);
      await assert.rejects(
        certifyAnalyticsForTesting({ revision }, scaffold.adapters),
        (error) => error?.code === code,
      );
      assert.equal(scaffold.portfolio.state.commands.length, 0);
      assert.equal(scaffold.site.state.commands.length, 0);
    });
  }

  for (const [name, overrides, code] of [
    [
      "revision",
      {
        readCurrentRevision: (() => {
          let reads = 0;
          return async () => ((reads += 1) === 1 ? revision : "b".repeat(40));
        })(),
      },
      "CERTIFICATION_REVISION_MISMATCH",
    ],
    [
      "source",
      {
        readRepositoryStatus: (() => {
          let reads = 0;
          return async () => ((reads += 1) === 1 ? "" : " M private-source.ts\0");
        })(),
      },
      "CERTIFICATION_WORKTREE_DIRTY",
    ],
    [
      "hidden-index",
      {
        readRepositoryIndexEntries: (() => {
          let reads = 0;
          return async () =>
            `${(reads += 1) === 1 ? "H" : "S"} selected-evidence.test.mjs\0`;
        })(),
      },
      "CERTIFICATION_INDEX_FLAGS",
    ],
  ]) {
    await context.test(`rejects ${name} drift after contained evidence`, async () => {
      const scaffold = createCertificationAdapters(overrides);
      await assert.rejects(
        certifyAnalyticsForTesting({ revision }, scaffold.adapters),
        (error) => error?.code === code,
      );
      assert.equal(await fileExists(scaffold.portfolio.state.ownedPath), false);
      assert.equal(await fileExists(scaffold.site.state.ownedPath), false);
    });
  }

  for (const [name, runLifecycleCommand] of [
    [
      "zero-match",
      async () => ({
        stdout: "TAP version 13\n1..0\n# tests 0\n# pass 0\n# fail 0\n",
      }),
    ],
    [
      "skipped",
      async () => ({
        stdout: [
          "TAP version 13",
          `# Subtest: ${lifecycleTestsByFile.values().next().value[0]}`,
          `ok 1 - ${lifecycleTestsByFile.values().next().value[0]} # SKIP private refusal`,
          "1..1",
          "# tests 1",
          "# pass 0",
          "# fail 0",
          "",
        ].join("\n"),
      }),
    ],
    [
      "failed command",
      async () => {
        throw new Error("private lifecycle failure");
      },
    ],
  ]) {
    await context.test(`contains ${name} lifecycle evidence`, async () => {
      const scaffold = createCertificationAdapters({ runLifecycleCommand });
      await assert.rejects(
        certifyAnalyticsForTesting({ revision }, scaffold.adapters),
        (error) => error?.code === "CERTIFICATION_LIFECYCLE_EVIDENCE_FAILED",
      );
      assert.equal(await fileExists(scaffold.portfolio.state.ownedPath), false);
      assert.equal(await fileExists(scaffold.site.state.ownedPath), false);
    });
  }
});

test("analytics certification rejects unsafe roots and preserves a replacement owner during identity-safe cleanup", async () => {
  const {
    certifyAnalyticsForTesting,
    verifyAnalyticsPortfolioForTesting,
  } = await import(certificationScript);

  for (const projectRoot of ["relative/project", resolve("/")]) {
    await assert.rejects(
      verifyAnalyticsPortfolioForTesting({
        projectRoot,
        environment: {},
        runCommand: async () => "",
      }),
      (error) => error?.code === "CERTIFICATION_PROJECT_ROOT_UNSAFE",
    );
  }

  const scaffold = createCertificationAdapters({ replacePortfolioOwner: true });
  try {
    await assert.rejects(
      certifyAnalyticsForTesting({ revision }, scaffold.adapters),
      (error) => error?.code === "CERTIFICATION_CLEANUP_FAILED",
    );
    assert.equal(
      await fileExists(join(scaffold.portfolio.state.ownedPath, "replacement-marker")),
      true,
    );
  } finally {
    if (scaffold.portfolio.state.ownedPath !== undefined) {
      await rm(scaffold.portfolio.state.ownedPath, {
        recursive: true,
        force: true,
      });
    }
  }
});

test("the analytics certification command accepts only one exact revision without echoing rejected values", async () => {
  for (const [arguments_, expectedCode, expectedExitCode] of [
    [["--revision", "private-value"], "CERTIFICATION_REVISION_INVALID", 1],
    [
      ["--", "--revision", "private-value"],
      "CERTIFICATION_REVISION_INVALID",
      1,
    ],
    [["--unknown", "private-value"], "CERTIFICATION_ARGUMENT_INVALID", 2],
  ]) {
    const execution = await execFileAsync(
      process.execPath,
      [certificationScript, ...arguments_],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        env: { PATH: process.env.PATH },
      },
    ).catch((error) => error);

    assert.equal(execution.code, expectedExitCode);
    assert.equal(execution.stdout, "");
    assert.deepEqual(JSON.parse(execution.stderr), {
      ok: false,
      code: expectedCode,
    });
    assert.doesNotMatch(execution.stderr, /private-value/u);
  }
});

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
