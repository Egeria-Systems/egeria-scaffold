import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  access,
  chmod,
  cp,
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

import { certifyBookingCalendlyForTesting } from "../../scripts/certify-booking-calendly.mjs";
import { certifyContentFilesForTesting } from "../../scripts/certify-content-files.mjs";
import { certifyGeneratedTestingForTesting } from "../../scripts/certify-generated-testing.mjs";
import { certifySectionCompositionForTesting } from "../../scripts/certify-section-composition.mjs";
import { runCertificationCli } from "../../scripts/lib/certification-cli.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const checkScript = resolve(
  repositoryRoot,
  "scripts/check-capability-certification.mjs",
);
const certificationRegistryPath = resolve(
  repositoryRoot,
  "certifications/capabilities.json",
);
const builderCoreDistPath = resolve(
  repositoryRoot,
  "packages/builder-core/dist",
);
const builderCoreNodeModulesPath = resolve(
  repositoryRoot,
  "packages/builder-core/node_modules",
);
const privatePlanPath =
  "docs/superpowers/plans/private-certification-validation.md";
const privateEvidencePath =
  "docs/implementation-evidence/private-certification-validation.md";
const temporaryRootRemovalOptions = Object.freeze({
  force: true,
  maxRetries: 5,
  recursive: true,
  retryDelay: 100,
});
const privateSubject = Object.freeze({
  descriptorVersion: "0.1.0",
  behaviorContractDigest:
    "sha256:339462dc3cc43065aeeb2eabc0556960d07c4c6b3e1e13738715fc7e0cedc8ab",
});
const certificationScript = resolve(
  repositoryRoot,
  "scripts/certify-booking-calendly.mjs",
);
const contentFilesCertificationScript = resolve(
  repositoryRoot,
  "scripts/certify-content-files.mjs",
);
const generatedTestingCertificationScript = resolve(
  repositoryRoot,
  "scripts/certify-generated-testing.mjs",
);
const sectionCompositionCertificationScript = resolve(
  repositoryRoot,
  "scripts/certify-section-composition.mjs",
);
const compiledMultilingualLifecycleTests = [
  "the compiled CLI preserves multilingual through both capability install orders and re-addition",
];
const builderMultilingualAdditionLifecycleTests = [
  "Calendly addition accepts the planned multilingual booking-composition replacement",
  "multilingual addition applies the locale overlay and persists fresh discovery",
  "multilingual addition refuses installed, stale-plan, and drifted repositories without persistence",
  "multilingual addition retains inspectable transform and verification failure prefixes",
  "multilingual addition refuses changed final bytes after persistence",
];
const builderMultilingualRemovalLifecycleTests = [
  "multilingual and Calendly removal preserve the other capability in both install orders",
  "multilingual removal preserves a modified locale catalog as an explicit ejection",
  "multilingual removal refuses absent, stale-plan, and drifted repositories without persistence",
  "multilingual removal retains inspectable transform and verification failure prefixes",
  "multilingual removal refuses changed final bytes after persistence",
];
const builderMultilingualAdditionPlanTests = [
  "multilingual addition plans the exact locale overlay with or without Calendly",
  "multilingual addition plan refuses managed drift without writes",
];
const builderMultilingualRemovalPlanTests = [
  "multilingual removal plan refuses absent state and managed drift without writes",
];
const multilingualCommonCapabilities = [
  "standards",
  "content-files",
  "section-composition",
  "deployment-cloudflare",
  "observability",
];

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

const fixedChecks = Object.freeze([
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
const visualChecks = Object.freeze([...fixedChecks, "visual-regression"]);
const contentFixtureChecks = Object.freeze([
  "content-fixture-overlay",
  "content-fixture-frozen-install",
  "content-fixture-unit-contract",
  "content-fixture-browser-install",
  "content-fixture-browser-development",
]);
const sectionCompositionFixtureChecks = Object.freeze([
  "section-composition-fixture-overlay",
  "section-composition-fixture-frozen-install",
  "section-composition-fixture-unit-contract",
  "section-composition-fixture-component-contract",
  "section-composition-fixture-browser-install",
  "section-composition-fixture-browser-development",
]);

function createCertificationCliRuntime(arguments_ = []) {
  const scriptPath = resolve(
    repositoryRoot,
    "scripts/example-certification.mjs",
  );
  const stdout = [];
  const stderr = [];
  const runtime = {
    argv: [process.execPath, scriptPath, ...arguments_],
    stdout: { write: (value) => stdout.push(value) },
    stderr: { write: (value) => stderr.push(value) },
    exitCode: undefined,
  };

  return {
    moduleUrl: pathToFileURL(scriptPath).href,
    runtime,
    stdout,
    stderr,
  };
}

test("the certification CLI runner is inert when its module is imported", async () => {
  const execution = createCertificationCliRuntime();
  execution.runtime.argv[1] = resolve(repositoryRoot, "scripts/importer.mjs");

  await runCertificationCli(
    {
      moduleUrl: execution.moduleUrl,
      parseArguments: () => assert.fail("an imported module must not parse"),
      certify: () => assert.fail("an imported module must not certify"),
      isCertificationError: () => false,
    },
    execution.runtime,
  );

  assert.deepEqual(execution.stdout, []);
  assert.deepEqual(execution.stderr, []);
  assert.equal(execution.runtime.exitCode, undefined);
});

test("the certification CLI runner owns argument, success, and failure framing", async (context) => {
  await context.test("rejects arguments without echoing them", async () => {
    const execution = createCertificationCliRuntime([
      "--unknown",
      "private-value",
    ]);

    await runCertificationCli(
      {
        moduleUrl: execution.moduleUrl,
        parseArguments: () => undefined,
        certify: () => assert.fail("invalid arguments must not certify"),
        isCertificationError: () => false,
      },
      execution.runtime,
    );

    assert.deepEqual(execution.stdout, []);
    assert.deepEqual(execution.stderr, [
      `${JSON.stringify({
        ok: false,
        code: "CERTIFICATION_ARGUMENT_INVALID",
      })}\n`,
    ]);
    assert.equal(execution.runtime.exitCode, 2);
    assert.doesNotMatch(execution.stderr.join(""), /private-value/u);
  });

  await context.test("writes one JSON success result", async () => {
    const execution = createCertificationCliRuntime();

    await runCertificationCli(
      {
        moduleUrl: execution.moduleUrl,
        parseArguments: () => ({ profile: "portfolio" }),
        certify: async (input) => ({ ok: true, profile: input.profile }),
        isCertificationError: () => false,
      },
      execution.runtime,
    );

    assert.deepEqual(execution.stdout, [
      `${JSON.stringify({ ok: true, profile: "portfolio" })}\n`,
    ]);
    assert.deepEqual(execution.stderr, []);
    assert.equal(execution.runtime.exitCode, undefined);
  });

  class LocalCertificationError extends Error {
    constructor(code) {
      super("certification failed");
      this.code = code;
    }
  }

  for (const [name, error, expectedCode] of [
    [
      "preserves a typed certification code",
      new LocalCertificationError("TYPED_FAILURE"),
      "TYPED_FAILURE",
    ],
    [
      "contains an untyped failure",
      new Error("private-value"),
      "CERTIFICATION_FAILED",
    ],
  ]) {
    await context.test(name, async () => {
      const execution = createCertificationCliRuntime();

      await runCertificationCli(
        {
          moduleUrl: execution.moduleUrl,
          parseArguments: () => ({}),
          certify: async () => {
            throw error;
          },
          isCertificationError: (candidate) =>
            candidate instanceof LocalCertificationError,
        },
        execution.runtime,
      );

      assert.deepEqual(execution.stdout, []);
      assert.deepEqual(execution.stderr, [
        `${JSON.stringify({ ok: false, code: expectedCode })}\n`,
      ]);
      assert.equal(execution.runtime.exitCode, 1);
      assert.doesNotMatch(execution.stderr.join(""), /private-value/u);
    });
  }
});

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function createSuccessfulScaffoldAdapters({
  diagnostics = Object.freeze({ healthy: true, diagnostics: [] }),
  differences = Object.freeze({ equal: true, differences: [] }),
  inferredCapability,
  profile = "portfolio",
  expectedCapabilities = Object.freeze([
    "standards",
    "content-files",
    "section-composition",
    "deployment-cloudflare",
    "observability",
  ]),
  readCurrentRevision,
  readRepositoryStatus = async () => "",
  readRepositoryIndexEntries = async () =>
    "H selected-evidence.test.mjs\0",
  runLifecycleCommand,
  postCreate = async () => {},
  verifyFixture,
  verificationChecks = fixedChecks,
  verificationFixtures,
  verifierIdentifier = "portfolio",
}) {
  const state = {
    commands: [],
    ownedPath: undefined,
    projectRoot: undefined,
    verifiedProjectName: undefined,
    verifiedRoot: undefined,
    verificationOptions: undefined,
    fixtureInput: undefined,
    lifecycleCommands: [],
  };

  return {
    state,
    adapters: {
      readCurrentRevision,
      readRepositoryStatus,
      readRepositoryIndexEntries,
      ...(runLifecycleCommand === undefined
        ? {}
        : {
            async runLifecycleCommand(input) {
              state.lifecycleCommands.push(input);
              return runLifecycleCommand(input);
            },
          }),
      async runCommand(input) {
        state.commands.push(input);
        assert.equal(input.executable, process.execPath);
        assert.equal(input.environment.CLOUDFLARE_API_TOKEN, undefined);
        assert.equal(input.environment.CLOUDFLARE_ACCOUNT_ID, undefined);
        assert.equal(input.environment.NPM_TOKEN, undefined);
        assert.equal(input.environment.NODE_OPTIONS, undefined);
        const command = input.arguments[1];

        if (command === "create") {
          state.projectRoot = input.arguments[
            input.arguments.indexOf("--directory") + 1
          ];
          state.ownedPath = dirname(state.projectRoot);
          assert.equal((await lstat(state.ownedPath)).mode & 0o777, 0o700);
          await postCreate(state.projectRoot);
          return `${JSON.stringify({
            ok: true,
            command: "create",
            destination: state.projectRoot,
            profile,
            capabilities: expectedCapabilities,
          })}\n`;
        }
        if (command === "infer") {
          return `${JSON.stringify({
            ok: true,
            command: "infer",
            result: {
              state: {
                kind: "valid",
                value: { installedCapabilities: [inferredCapability] },
              },
              capabilities: [
                {
                  identifier: inferredCapability.identifier,
                  category: "confirmed",
                },
              ],
            },
          })}\n`;
        }
        if (command === "doctor") {
          return `${JSON.stringify({
            ok: true,
            command: "doctor",
            result: diagnostics,
          })}\n`;
        }
        if (command === "diff") {
          return `${JSON.stringify({
            ok: true,
            command: "diff",
            result: differences,
          })}\n`;
        }
        throw new Error("unexpected command");
      },
      async verifyProject(root, identifier, expectedProjectName, options) {
        state.verifiedRoot = root;
        state.verifiedProjectName = expectedProjectName;
        state.verificationOptions = options;
        assert.equal(identifier, verifierIdentifier);
        return {
          ok: true,
          fixtures: verificationFixtures ?? [verifierIdentifier],
          profiles: [profile],
          checks: verificationChecks,
        };
      },
      ...(verifyFixture === undefined
        ? {}
        : {
            async verifyFixture(input) {
              state.fixtureInput = input;
              return verifyFixture(input);
            },
          }),
    },
  };
}

test("section composition certification binds both supported fresh-scaffold profiles to one clean exact subject", async () => {
  const revision = "a".repeat(40);
  let revisionReads = 0;
  let statusReads = 0;
  let indexReads = 0;
  const authority = {
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
  };
  const portfolio = createSuccessfulScaffoldAdapters({
    inferredCapability: {
      identifier: "section-composition",
      version: "0.3.0",
    },
    readCurrentRevision: authority.readCurrentRevision,
    postCreate: (projectRoot) => writeRecipeVersion(projectRoot, "0.11.6"),
    verifyFixture: async ({ environment }) => {
      assert.equal(environment.CLOUDFLARE_API_TOKEN, undefined);
      assert.equal(environment.CLOUDFLARE_ACCOUNT_ID, undefined);
      assert.equal(environment.NPM_TOKEN, undefined);
      return { ok: true, checks: sectionCompositionFixtureChecks };
    },
  });
  const site = createSuccessfulScaffoldAdapters({
    expectedCapabilities: Object.freeze([
      "standards",
      "content-files",
      "section-composition",
      "deployment-cloudflare",
      "observability",
      "site-routing",
    ]),
    inferredCapability: {
      identifier: "section-composition",
      version: "0.3.0",
    },
    profile: "site",
    readCurrentRevision: authority.readCurrentRevision,
    postCreate: (projectRoot) => writeRecipeVersion(projectRoot, "0.12.6"),
    verifierIdentifier: "site",
  });

  const result = await certifySectionCompositionForTesting(
    { revision },
    {
      ...authority,
      journeys: { portfolio: portfolio.adapters, site: site.adapters },
    },
  );

  assert.deepEqual(result, {
    ok: true,
    capability: "section-composition",
    version: "0.3.0",
    profiles: ["portfolio", "site"],
    subject: {
      descriptorVersion: "0.3.0",
      behaviorContractDigest:
        "sha256:4f63f9d6169048b5a1f5b1d042b3a0ddaa22ca1273d1acadf6235ce93e616696",
    },
    recipeVersions: { portfolio: "0.11.6", site: "0.12.6" },
    locale: "en-CA",
    evidenceRevision: revision,
    checks: [
      ...[
        "compiled-cli-create",
        "state-inference",
        "healthy-diagnostics",
        "exact-diff",
        ...fixedChecks,
        ...sectionCompositionFixtureChecks,
      ].map((check) => `portfolio:${check}`),
      ...[
        "compiled-cli-create",
        "state-inference",
        "healthy-diagnostics",
        "exact-diff",
        ...fixedChecks,
      ].map((check) => `site:${check}`),
      "repository-sources-unchanged",
    ],
  });
  assert.equal(portfolio.state.verifiedRoot, portfolio.state.projectRoot);
  assert.equal(portfolio.state.fixtureInput.projectRoot, portfolio.state.projectRoot);
  assert.equal(site.state.verifiedRoot, site.state.projectRoot);
  assert.equal(site.state.fixtureInput, undefined);
  assert.equal(revisionReads, 2);
  assert.equal(statusReads, 2);
  assert.equal(indexReads, 2);
  assert.equal(await pathExists(portfolio.state.ownedPath), false);
  assert.equal(await pathExists(site.state.ownedPath), false);
});

test("section composition fixture verification applies the exact isolated overlay and command sequence", async () => {
  const ownedRoot = await mkdtemp(
    join(tmpdir(), "section-composition-fixture-verifier-"),
  );
  const projectRoot = join(ownedRoot, "generated-project");
  const supportRoot = join(
    ownedRoot,
    "section-composition-fixture-support",
  );
  const commands = [];

  try {
    const { verifySectionCompositionFixtureForTesting } = await import(
      "../../scripts/certify-section-composition.mjs"
    );
    const result = await verifySectionCompositionFixtureForTesting({
      projectRoot,
      environment: { PATH: "/verified/bin" },
      runCommand: async (command) => {
        commands.push(command);
      },
    });

    assert.deepEqual(result, {
      ok: true,
      checks: sectionCompositionFixtureChecks,
    });
    for (const [source, destination] of [
      [
        "section-composition-certification.test.ts",
        "apps/web/tests/unit/section-composition-certification.test.ts",
      ],
      [
        "section-composition-certification.test.tsx",
        "apps/web/tests/component/section-composition-certification.test.tsx",
      ],
      [
        "section-composition-certification.spec.ts",
        "apps/web/tests/e2e/section-composition-certification.spec.ts",
      ],
    ]) {
      assert.equal(
        await readFile(join(projectRoot, destination), "utf8"),
        await readFile(
          join(
            repositoryRoot,
            "tests/capability-certification/fixtures/section-composition",
            source,
          ),
          "utf8",
        ),
      );
    }
    assert.deepEqual(
      commands.map(({ executable, arguments: arguments_, cwd, timeout }) => ({
        executable,
        arguments: arguments_,
        cwd,
        timeout,
      })),
      [
        {
          executable: "pnpm",
          arguments: [
            "install",
            "--frozen-lockfile",
            "--store-dir",
            join(supportRoot, "store"),
          ],
          cwd: projectRoot,
          timeout: 15 * 60 * 1000,
        },
        {
          executable: "pnpm",
          arguments: [
            "--dir",
            "apps/web",
            "exec",
            "vitest",
            "run",
            "--project",
            "unit",
            "tests/unit/section-composition-certification.test.ts",
          ],
          cwd: projectRoot,
          timeout: 15 * 60 * 1000,
        },
        {
          executable: "pnpm",
          arguments: [
            "--dir",
            "apps/web",
            "exec",
            "vitest",
            "run",
            "--project",
            "component",
            "tests/component/section-composition-certification.test.tsx",
          ],
          cwd: projectRoot,
          timeout: 15 * 60 * 1000,
        },
        {
          executable: "pnpm",
          arguments: ["--dir", "apps/web", "run", "browser:install"],
          cwd: projectRoot,
          timeout: 15 * 60 * 1000,
        },
        {
          executable: "pnpm",
          arguments: [
            "--dir",
            "apps/web",
            "exec",
            "playwright",
            "test",
            "--config",
            "playwright.dev.config.ts",
            "tests/e2e/section-composition-certification.spec.ts",
          ],
          cwd: projectRoot,
          timeout: 15 * 60 * 1000,
        },
      ],
    );
    for (const command of commands) {
      assert.equal(command.environment.PATH, "/verified/bin");
      assert.equal(command.environment.HOME, join(supportRoot, "home"));
      assert.equal(command.environment.USERPROFILE, join(supportRoot, "home"));
      assert.equal(
        command.environment.PLAYWRIGHT_BROWSERS_PATH,
        join(supportRoot, "playwright-browsers"),
      );
      assert.equal(
        command.environment.NPM_CONFIG_USERCONFIG,
        join(supportRoot, ".npmrc"),
      );
      assert.equal(
        command.environment.NPM_CONFIG_REGISTRY,
        "https://registry.npmjs.org/",
      );
      assert.equal(command.environment.TMPDIR, join(supportRoot, "temporary"));
      assert.equal(command.environment.TMP, join(supportRoot, "temporary"));
      assert.equal(command.environment.TEMP, join(supportRoot, "temporary"));
      assert.equal(command.environment.XDG_CACHE_HOME, join(supportRoot, "cache"));
    }
  } finally {
    await rm(ownedRoot, { recursive: true, force: true });
  }
});

test("section composition certification fails closed on authority and journey drift", async (context) => {
  const revision = "a".repeat(40);
  const createJourneys = (authorityOverrides = {}, siteOverrides = {}) => {
    const authority = {
      readCurrentRevision: async () => revision,
      readRepositoryStatus: async () => "",
      readRepositoryIndexEntries: async () =>
        "H selected-evidence.test.mjs\0",
      ...authorityOverrides,
    };
    const portfolio = createSuccessfulScaffoldAdapters({
      inferredCapability: {
        identifier: "section-composition",
        version: "0.3.0",
      },
      readCurrentRevision: authority.readCurrentRevision,
      postCreate: (projectRoot) => writeRecipeVersion(projectRoot, "0.11.6"),
      verifyFixture: async () => ({
        ok: true,
        checks: sectionCompositionFixtureChecks,
      }),
    });
    const site = createSuccessfulScaffoldAdapters({
      expectedCapabilities: Object.freeze([
        "standards",
        "content-files",
        "section-composition",
        "deployment-cloudflare",
        "observability",
        "site-routing",
      ]),
      inferredCapability: {
        identifier: "section-composition",
        version: "0.3.0",
      },
      profile: "site",
      readCurrentRevision: authority.readCurrentRevision,
      postCreate: (projectRoot) => writeRecipeVersion(projectRoot, "0.12.6"),
      verifierIdentifier: "site",
      ...siteOverrides,
    });
    return {
      adapters: {
        ...authority,
        journeys: { portfolio: portfolio.adapters, site: site.adapters },
      },
      portfolio,
      site,
    };
  };

  await context.test("rejects a dirty worktree before either journey", async () => {
    const setup = createJourneys({
      readRepositoryStatus: async () => "?? private-source.ts\0",
    });
    await assert.rejects(
      certifySectionCompositionForTesting({ revision }, setup.adapters),
      (error) => error?.code === "CERTIFICATION_WORKTREE_DIRTY",
    );
    assert.equal(setup.portfolio.state.commands.length, 0);
    assert.equal(setup.site.state.commands.length, 0);
  });

  await context.test("rejects hidden index flags before either journey", async () => {
    const setup = createJourneys({
      readRepositoryIndexEntries: async () =>
        "S selected-evidence.test.mjs\0",
    });
    await assert.rejects(
      certifySectionCompositionForTesting({ revision }, setup.adapters),
      (error) => error?.code === "CERTIFICATION_INDEX_FLAGS",
    );
    assert.equal(setup.portfolio.state.commands.length, 0);
    assert.equal(setup.site.state.commands.length, 0);
  });

  await context.test("rejects worktree drift after both contained journeys", async () => {
    let statusReads = 0;
    const setup = createJourneys({
      readRepositoryStatus: async () => {
        statusReads += 1;
        return statusReads === 1 ? "" : "?? private-source.ts\0";
      },
    });
    await assert.rejects(
      certifySectionCompositionForTesting({ revision }, setup.adapters),
      (error) => error?.code === "CERTIFICATION_WORKTREE_DIRTY",
    );
    assert.equal(
      setup.portfolio.state.verifiedRoot,
      setup.portfolio.state.projectRoot,
    );
    assert.equal(setup.site.state.verifiedRoot, setup.site.state.projectRoot);
    assert.equal(await pathExists(setup.portfolio.state.ownedPath), false);
    assert.equal(await pathExists(setup.site.state.ownedPath), false);
  });

  await context.test("rejects index-flag drift after both contained journeys", async () => {
    let indexReads = 0;
    const setup = createJourneys({
      readRepositoryIndexEntries: async () => {
        indexReads += 1;
        return `${indexReads === 1 ? "H" : "S"} selected-evidence.test.mjs\0`;
      },
    });
    await assert.rejects(
      certifySectionCompositionForTesting({ revision }, setup.adapters),
      (error) => error?.code === "CERTIFICATION_INDEX_FLAGS",
    );
    assert.equal(
      setup.portfolio.state.verifiedRoot,
      setup.portfolio.state.projectRoot,
    );
    assert.equal(setup.site.state.verifiedRoot, setup.site.state.projectRoot);
    assert.equal(await pathExists(setup.portfolio.state.ownedPath), false);
    assert.equal(await pathExists(setup.site.state.ownedPath), false);
  });

  await context.test("rejects an invalid site verification identity", async () => {
    const setup = createJourneys({}, { verificationChecks: fixedChecks.slice(1) });
    await assert.rejects(
      certifySectionCompositionForTesting({ revision }, setup.adapters),
      (error) => error?.code === "GENERATED_PROJECT_VERIFICATION_INVALID",
    );
    assert.equal(await pathExists(setup.portfolio.state.ownedPath), false);
    assert.equal(await pathExists(setup.site.state.ownedPath), false);
  });

  await context.test("rejects revision drift after both contained journeys", async () => {
    let reads = 0;
    const setup = createJourneys({
      readCurrentRevision: async () => {
        reads += 1;
        return reads === 1 ? revision : "b".repeat(40);
      },
    });
    await assert.rejects(
      certifySectionCompositionForTesting({ revision }, setup.adapters),
      (error) => error?.code === "CERTIFICATION_REVISION_MISMATCH",
    );
    assert.equal(await pathExists(setup.portfolio.state.ownedPath), false);
    assert.equal(await pathExists(setup.site.state.ownedPath), false);
  });
});

test("the section composition certification command requires one exact revision without echoing rejected values", async () => {
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
      [sectionCompositionCertificationScript, ...arguments_],
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

async function writeRecipeVersion(projectRoot, version) {
  await mkdir(join(projectRoot, ".egeria"), { recursive: true });
  await writeFile(
    join(projectRoot, ".egeria/project.yaml"),
    `recipeVersion: ${version}\n`,
  );
}

async function copyCertificationRuntime(cleanRoot) {
  await chmod(cleanRoot, 0o700);
  await mkdir(join(cleanRoot, "scripts"), { recursive: true });
  await mkdir(join(cleanRoot, "certifications"), { recursive: true });
  await mkdir(join(cleanRoot, "packages/builder-core"), { recursive: true });
  await mkdir(join(cleanRoot, "node_modules"), { recursive: true });
  const cleanCheckScript = join(
    cleanRoot,
    "scripts/check-capability-certification.mjs",
  );
  await copyFile(checkScript, cleanCheckScript);
  await copyFile(
    join(repositoryRoot, "packages/builder-core/package.json"),
    join(cleanRoot, "packages/builder-core/package.json"),
  );
  await cp(builderCoreDistPath, join(cleanRoot, "packages/builder-core/dist"), {
    recursive: true,
  });
  for (const dependency of ["typescript", "yaml", "zod"]) {
    await cp(
      join(builderCoreNodeModulesPath, dependency),
      join(cleanRoot, "node_modules", dependency),
      { dereference: true, recursive: true },
    );
  }
  return cleanCheckScript;
}

function createPrivateRegistry(revision) {
  return {
    schemaVersion: "1.0.0",
    records: {
      "booking-calendly": {
        subject: privateSubject,
        requiredEvidence: ["fresh-scaffold"],
        status: "certified",
        taskPlan: privatePlanPath,
        evidence: [
          {
            kind: "fresh-scaffold",
            path: privateEvidencePath,
            outcome: "passed",
            revision,
            subject: privateSubject,
          },
        ],
      },
    },
  };
}

function createPrivateEvidence(revision, decision = "accepted") {
  return [
    "**Certification capability:** `booking-calendly`",
    "**Certification descriptor version:** `0.1.0`",
    `**Certification behavior-contract digest:** \`${privateSubject.behaviorContractDigest}\``,
    `**Certification evidence revision:** \`${revision}\``,
    "**Passed certification outcomes:** `fresh-scaffold`",
    "**Reviewed certification outcomes:** `fresh-scaffold`",
    "**Certification receipt status:** `complete`",
    `**Certification reviewer decision:** \`${decision}\``,
    "**Certification unresolved prompts:** `none`",
  ].join("\n");
}

async function writePrivateValidationFixture(
  cleanRoot,
  revision,
  decision = "accepted",
) {
  await mkdir(dirname(join(cleanRoot, privatePlanPath)), { recursive: true });
  await mkdir(dirname(join(cleanRoot, privateEvidencePath)), { recursive: true });
  await writeFile(join(cleanRoot, privatePlanPath), "# Private plan\n", "utf8");
  await writeFile(
    join(cleanRoot, privateEvidencePath),
    createPrivateEvidence(revision, decision),
    "utf8",
  );
  await writeFile(
    join(cleanRoot, "certifications/capabilities.json"),
    `${JSON.stringify(createPrivateRegistry(revision), null, 2)}\n`,
    "utf8",
  );
}

function assertArtifactIssue(result, code) {
  assert.equal(result.exitCode, 1);
  assert.equal(result.stderr, "");
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.gate, "artifacts");
  assert.equal(report.issues.some((issue) => issue.code === code), true);
}

async function runCheck(
  arguments_,
  { cwd = repositoryRoot, script = checkScript } = {},
) {
  try {
    const result = await execFileAsync(process.execPath, [script, ...arguments_], {
      cwd,
      encoding: "utf8",
      env: { PATH: process.env.PATH },
    });
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return {
      exitCode: error.code,
      stdout: error.stdout,
      stderr: error.stderr,
    };
  }
}

test("the repository registry admits accepted subjects and refuses closure for remaining certification", async () => {
  const admission = await runCheck([]);
  assert.deepEqual(admission, {
    exitCode: 0,
    stdout: `${JSON.stringify({
      ok: true,
      gate: "admission",
      records: 14,
    })}\n`,
    stderr: "",
  });

  const retiredClosure = await runCheck([
    "--closure",
    "legacy-backfill-exempt",
  ]);
  assert.deepEqual(retiredClosure, {
    exitCode: 2,
    stdout: "",
    stderr: `${JSON.stringify({
      ok: false,
      code: "CERTIFICATION_ARGUMENT_INVALID",
    })}\n`,
  });
  assert.doesNotMatch(retiredClosure.stderr, /legacy-backfill-exempt/u);

  const fullClosure = await runCheck(["--closure", "all-certified"]);
  assert.equal(fullClosure.exitCode, 1);
  assert.equal(fullClosure.stderr, "");
  assert.deepEqual(
    JSON.parse(fullClosure.stdout).issues.map(({ code, path }) => ({
      code,
      identifier: path[1],
    })),
    [
      "analytics",
      "app-foundation",
      "application-persistence",
      "background-job-delivery",
      "booking-calendly",
      "deployment-cloudflare",
      "standards",
      "transactional-email-resend",
    ].map((identifier) => ({
      code: "CAPABILITY_CERTIFICATION_PENDING",
      identifier,
    })),
  );
});

test("ordinary admission requires a new pending task for a changed accepted subject", async () => {
  const cleanRoot = await mkdtemp(
    join(tmpdir(), "egeria-certification-subject-transition-"),
  );

  try {
    const cleanCheckScript = await copyCertificationRuntime(cleanRoot);
    const currentRegistry = JSON.parse(
      await readFile(certificationRegistryPath, "utf8"),
    );
    const baselineRegistry = structuredClone(currentRegistry);
    const baselineRecord = baselineRegistry.records["booking-calendly"];
    baselineRecord.subject.descriptorVersion = "0.0.1";
    baselineRecord.subject.behaviorContractDigest = `sha256:${"0".repeat(64)}`;
    baselineRecord.status = "certified";
    baselineRecord.taskPlan =
      "docs/superpowers/plans/accepted-booking-certification.md";
    baselineRecord.evidence = baselineRecord.requiredEvidence.map((kind) => ({
      kind,
      path: "docs/implementation-evidence/accepted-booking-certification.md",
      outcome: "passed",
      revision: "a".repeat(40),
      subject: structuredClone(baselineRecord.subject),
    }));
    await writeFile(
      join(cleanRoot, "certifications/capabilities.json"),
      `${JSON.stringify(baselineRegistry, null, 2)}\n`,
      "utf8",
    );
    await execFileAsync("git", ["init", "--quiet"], { cwd: cleanRoot });
    await execFileAsync(
      "git",
      ["add", "certifications/capabilities.json"],
      { cwd: cleanRoot },
    );
    await execFileAsync(
      "git",
      [
        "-c",
        "user.name=Certification Test",
        "-c",
        "user.email=certification@example.invalid",
        "commit",
        "--quiet",
        "-m",
        "accept prior certification subject",
      ],
      { cwd: cleanRoot },
    );
    const { stdout: baselineRevisionOutput } = await execFileAsync(
      "git",
      ["rev-parse", "HEAD"],
      { cwd: cleanRoot, encoding: "utf8" },
    );
    await execFileAsync(
      "git",
      [
        "update-ref",
        "refs/remotes/origin/main",
        baselineRevisionOutput.trim(),
      ],
      { cwd: cleanRoot },
    );

    const changedCertifiedRegistry = structuredClone(currentRegistry);
    const changedCertifiedRecord =
      changedCertifiedRegistry.records["booking-calendly"];
    changedCertifiedRecord.status = "certified";
    changedCertifiedRecord.taskPlan = baselineRecord.taskPlan;
    changedCertifiedRecord.evidence = changedCertifiedRecord.requiredEvidence.map(
      (kind) => ({
        kind,
        path: "docs/implementation-evidence/changed-booking-certification.md",
        outcome: "passed",
        revision: "b".repeat(40),
        subject: structuredClone(changedCertifiedRecord.subject),
      }),
    );
    await writeFile(
      join(cleanRoot, "certifications/capabilities.json"),
      `${JSON.stringify(changedCertifiedRegistry, null, 2)}\n`,
      "utf8",
    );
    const changedCertified = await runCheck([], {
      cwd: cleanRoot,
      script: cleanCheckScript,
    });
    assert.equal(changedCertified.exitCode, 1);
    assert.equal(changedCertified.stderr, "");
    assert.deepEqual(
      JSON.parse(changedCertified.stdout).issues.map(({ code }) => code),
      [
        "CERTIFICATION_SUBJECT_PENDING_REQUIRED",
        "CERTIFICATION_TASK_PLAN_RENEWAL_REQUIRED",
      ],
    );

    await writeFile(
      join(cleanRoot, "certifications/capabilities.json"),
      `${JSON.stringify(currentRegistry, null, 2)}\n`,
      "utf8",
    );
    assert.deepEqual(
      await runCheck([], { cwd: cleanRoot, script: cleanCheckScript }),
      {
        exitCode: 0,
        stdout: `${JSON.stringify({
          ok: true,
          gate: "admission",
          records: 14,
        })}\n`,
        stderr: "",
      },
    );
  } finally {
    await rm(cleanRoot, temporaryRootRemovalOptions);
  }
});

test("the ordinary certification gate does not require private workflow artifacts", async () => {
  const cleanRoot = await mkdtemp(
    join(tmpdir(), "egeria-certification-clean-checkout-"),
  );

  try {
    const cleanCheckScript = await copyCertificationRuntime(cleanRoot);
    await copyFile(
      certificationRegistryPath,
      join(cleanRoot, "certifications/capabilities.json"),
    );

    const result = await runCheck([], {
      cwd: cleanRoot,
      script: cleanCheckScript,
    });

    assert.deepEqual(result, {
      exitCode: 0,
      stdout: `${JSON.stringify({
        ok: true,
        gate: "admission",
        records: 14,
      })}\n`,
      stderr: "",
    });
  } finally {
    await rm(cleanRoot, temporaryRootRemovalOptions);
  }
});

test("private certification validation rejects missing, rejected, and non-ancestor evidence", async () => {
  const cleanRoot = await mkdtemp(
    join(tmpdir(), "egeria-private-certification-validation-"),
  );

  try {
    const cleanCheckScript = await copyCertificationRuntime(cleanRoot);
    await writeFile(join(cleanRoot, "baseline.txt"), "baseline\n", "utf8");
    await execFileAsync("git", ["init", "--quiet"], { cwd: cleanRoot });
    await execFileAsync("git", ["add", "baseline.txt"], { cwd: cleanRoot });
    await execFileAsync(
      "git",
      [
        "-c",
        "user.name=Certification Test",
        "-c",
        "user.email=certification@example.invalid",
        "commit",
        "--quiet",
        "-m",
        "baseline",
      ],
      { cwd: cleanRoot },
    );
    const { stdout: revisionOutput } = await execFileAsync(
      "git",
      ["rev-parse", "HEAD"],
      { cwd: cleanRoot, encoding: "utf8" },
    );
    const revision = revisionOutput.trim();
    await writePrivateValidationFixture(cleanRoot, revision);

    const accepted = await runCheck(["--artifacts"], {
      cwd: cleanRoot,
      script: cleanCheckScript,
    });
    assert.deepEqual(accepted, {
      exitCode: 0,
      stdout: `${JSON.stringify({
        ok: true,
        gate: "artifacts",
        records: 1,
      })}\n`,
      stderr: "",
    });

    await rm(join(cleanRoot, privateEvidencePath));
    assertArtifactIssue(
      await runCheck(["--artifacts"], {
        cwd: cleanRoot,
        script: cleanCheckScript,
      }),
      "CERTIFICATION_EVIDENCE_MISSING",
    );

    await writePrivateValidationFixture(cleanRoot, revision, "rejected");
    assertArtifactIssue(
      await runCheck(["--artifacts"], {
        cwd: cleanRoot,
        script: cleanCheckScript,
      }),
      "CERTIFICATION_EVIDENCE_REVIEW_REJECTED",
    );

    const nonAncestorRevision = "0".repeat(40);
    await writePrivateValidationFixture(cleanRoot, nonAncestorRevision);
    assertArtifactIssue(
      await runCheck(["--artifacts"], {
        cwd: cleanRoot,
        script: cleanCheckScript,
      }),
      "CERTIFICATION_EVIDENCE_REVISION_UNKNOWN",
    );
  } finally {
    await rm(cleanRoot, temporaryRootRemovalOptions);
  }
});

test("private certification validation checks only records changed from accepted main", async () => {
  const cleanRoot = await mkdtemp(
    join(tmpdir(), "egeria-private-certification-delta-"),
  );

  try {
    const cleanCheckScript = await copyCertificationRuntime(cleanRoot);
    await writeFile(join(cleanRoot, "baseline.txt"), "baseline\n", "utf8");
    await execFileAsync("git", ["init", "--quiet"], { cwd: cleanRoot });
    await execFileAsync("git", ["add", "baseline.txt"], { cwd: cleanRoot });
    await execFileAsync(
      "git",
      [
        "-c",
        "user.name=Certification Test",
        "-c",
        "user.email=certification@example.invalid",
        "commit",
        "--quiet",
        "-m",
        "baseline",
      ],
      { cwd: cleanRoot },
    );
    const { stdout: initialRevisionOutput } = await execFileAsync(
      "git",
      ["rev-parse", "HEAD"],
      { cwd: cleanRoot, encoding: "utf8" },
    );
    const initialRevision = initialRevisionOutput.trim();
    const historicalSubject = {
      descriptorVersion: "0.4.0",
      behaviorContractDigest: `sha256:${"a".repeat(64)}`,
    };
    const historicalRecord = {
      subject: historicalSubject,
      requiredEvidence: ["fresh-scaffold"],
      status: "certified",
      taskPlan: "docs/superpowers/plans/historical-certification.md",
      evidence: [
        {
          kind: "fresh-scaffold",
          path: "docs/implementation-evidence/historical-certification.md",
          outcome: "passed",
          revision: initialRevision,
          subject: historicalSubject,
        },
      ],
    };
    const baselineRegistry = createPrivateRegistry(initialRevision);
    baselineRegistry.records["booking-calendly"].status = "pending";
    baselineRegistry.records["booking-calendly"].evidence = [];
    baselineRegistry.records.standards = historicalRecord;
    await writeFile(
      join(cleanRoot, "certifications/capabilities.json"),
      `${JSON.stringify(baselineRegistry, null, 2)}\n`,
      "utf8",
    );
    await execFileAsync(
      "git",
      ["add", "certifications/capabilities.json"],
      { cwd: cleanRoot },
    );
    await execFileAsync(
      "git",
      [
        "-c",
        "user.name=Certification Test",
        "-c",
        "user.email=certification@example.invalid",
        "commit",
        "--quiet",
        "-m",
        "accept baseline registry",
      ],
      { cwd: cleanRoot },
    );
    const { stdout: baselineRevisionOutput } = await execFileAsync(
      "git",
      ["rev-parse", "HEAD"],
      { cwd: cleanRoot, encoding: "utf8" },
    );
    const baselineRevision = baselineRevisionOutput.trim();
    await execFileAsync(
      "git",
      ["update-ref", "refs/remotes/origin/main", baselineRevision],
      { cwd: cleanRoot },
    );

    await writePrivateValidationFixture(cleanRoot, baselineRevision);
    const currentRegistry = createPrivateRegistry(baselineRevision);
    currentRegistry.records.standards = historicalRecord;
    await writeFile(
      join(cleanRoot, "certifications/capabilities.json"),
      `${JSON.stringify(currentRegistry, null, 2)}\n`,
      "utf8",
    );

    assert.deepEqual(
      await runCheck(["--artifacts"], {
        cwd: cleanRoot,
        script: cleanCheckScript,
      }),
      {
        exitCode: 0,
        stdout: `${JSON.stringify({
          ok: true,
          gate: "artifacts",
          records: 1,
        })}\n`,
        stderr: "",
      },
    );
  } finally {
    await rm(cleanRoot, temporaryRootRemovalOptions);
  }
});

test("private certification validation rejects deletion of an accepted evidence artifact", async () => {
  const cleanRoot = await mkdtemp(
    join(tmpdir(), "egeria-private-certification-deleted-evidence-"),
  );

  try {
    const cleanCheckScript = await copyCertificationRuntime(cleanRoot);
    await execFileAsync("git", ["init", "--quiet"], { cwd: cleanRoot });
    await writePrivateValidationFixture(cleanRoot, "0".repeat(40));
    await execFileAsync("git", ["add", "."], { cwd: cleanRoot });
    await execFileAsync(
      "git",
      [
        "-c",
        "user.name=Certification Test",
        "-c",
        "user.email=certification@example.invalid",
        "commit",
        "--quiet",
        "-m",
        "accept certification evidence",
      ],
      { cwd: cleanRoot },
    );
    const { stdout: baselineRevisionOutput } = await execFileAsync(
      "git",
      ["rev-parse", "HEAD"],
      { cwd: cleanRoot, encoding: "utf8" },
    );
    const baselineRevision = baselineRevisionOutput.trim();
    await writePrivateValidationFixture(cleanRoot, baselineRevision);
    await execFileAsync(
      "git",
      ["add", "certifications/capabilities.json", privateEvidencePath],
      { cwd: cleanRoot },
    );
    await execFileAsync(
      "git",
      [
        "-c",
        "user.name=Certification Test",
        "-c",
        "user.email=certification@example.invalid",
        "commit",
        "--quiet",
        "-m",
        "bind accepted evidence revision",
      ],
      { cwd: cleanRoot },
    );
    const { stdout: acceptedRevisionOutput } = await execFileAsync(
      "git",
      ["rev-parse", "HEAD"],
      { cwd: cleanRoot, encoding: "utf8" },
    );
    await execFileAsync(
      "git",
      ["update-ref", "refs/remotes/origin/main", acceptedRevisionOutput.trim()],
      { cwd: cleanRoot },
    );

    await rm(join(cleanRoot, privateEvidencePath));

    assertArtifactIssue(
      await runCheck(["--artifacts"], {
        cwd: cleanRoot,
        script: cleanCheckScript,
      }),
      "CERTIFICATION_EVIDENCE_MISSING",
    );
  } finally {
    await rm(cleanRoot, temporaryRootRemovalOptions);
  }
});

test("generated testing certification binds a fresh portfolio to the exact standards subject", async () => {
  const previousToken = process.env.NPM_TOKEN;
  process.env.NPM_TOKEN = "PRIVATE_VALUE";
  const scaffold = createSuccessfulScaffoldAdapters({
    inferredCapability: { identifier: "standards", version: "0.5.1" },
    postCreate: (projectRoot) => writeRecipeVersion(projectRoot, "0.11.6"),
    verificationChecks: visualChecks,
  });

  try {
    const result = await certifyGeneratedTestingForTesting(scaffold.adapters);

    assert.deepEqual(result, {
      ok: true,
      capability: "standards",
      version: "0.5.1",
      profile: "portfolio",
      subject: {
        descriptorVersion: "0.5.1",
        behaviorContractDigest:
          "sha256:936eaba6040e0736ccf630b775ab91f92d67f4e5a65332b829378e2a491cc168",
      },
      recipeVersion: "0.11.6",
      checks: [
        "compiled-cli-create",
        "state-inference",
        "healthy-diagnostics",
        "exact-diff",
        ...visualChecks,
      ],
    });
    assert.deepEqual(
      scaffold.state.commands.map(({ arguments: arguments_ }) =>
        arguments_.slice(1),
      ),
      [
        [
          "create",
          "--profile",
          "portfolio",
          "--name",
          "acme-portfolio",
          "--display-name",
          "Acme Portfolio",
          "--directory",
          scaffold.state.projectRoot,
        ],
        ["infer", "--directory", scaffold.state.projectRoot],
        ["doctor", "--directory", scaffold.state.projectRoot],
        ["diff", "--directory", scaffold.state.projectRoot],
      ],
    );
    assert.equal(scaffold.state.verifiedRoot, scaffold.state.projectRoot);
    assert.deepEqual(scaffold.state.verificationOptions, {
      includeVisual: true,
    });
    assert.equal(await pathExists(scaffold.state.ownedPath), false);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_VALUE/u);
  } finally {
    if (previousToken === undefined) {
      delete process.env.NPM_TOKEN;
    } else {
      process.env.NPM_TOKEN = previousToken;
    }
  }
});

test("generated testing certification rejects missing, extra, or reordered visual verifier checks", async () => {
  const invalidChecks = [
    visualChecks.slice(0, -2),
    fixedChecks,
    [...visualChecks, "unexpected"],
    [...visualChecks].reverse(),
  ];

  for (const checks of invalidChecks) {
    const scaffold = createSuccessfulScaffoldAdapters({
      inferredCapability: { identifier: "standards", version: "0.5.1" },
      postCreate: (projectRoot) =>
        writeRecipeVersion(projectRoot, "0.11.6"),
      verificationChecks: checks,
    });
    await assert.rejects(
      certifyGeneratedTestingForTesting(scaffold.adapters),
      (error) => {
        assert.equal(error.name, "GeneratedTestingCertificationError");
        assert.equal(error.code, "GENERATED_PROJECT_VERIFICATION_INVALID");
        return true;
      },
    );
  }
});

test("generated testing certification rejects stale state, recipe, diagnostics, diff, and verifier identity", async (context) => {
  const validInput = Object.freeze({
    inferredCapability: Object.freeze({
      identifier: "standards",
      version: "0.5.1",
    }),
    postCreate: (projectRoot) =>
      writeRecipeVersion(projectRoot, "0.11.6"),
    verificationChecks: visualChecks,
  });
  const cases = [
    [
      "stale installed standards",
      {
        ...validInput,
        inferredCapability: { identifier: "standards", version: "0.3.0" },
      },
      "FRESH_SCAFFOLD_INFERENCE_INVALID",
    ],
    [
      "stale recipe",
      {
        ...validInput,
        postCreate: (projectRoot) =>
          writeRecipeVersion(projectRoot, "0.9.0"),
      },
      "FRESH_SCAFFOLD_RECIPE_INVALID",
    ],
    [
      "unhealthy diagnostics",
      {
        ...validInput,
        diagnostics: { healthy: false, diagnostics: [{ code: "DRIFT" }] },
      },
      "FRESH_SCAFFOLD_DIAGNOSTICS_INVALID",
    ],
    [
      "non-empty diff",
      {
        ...validInput,
        differences: { equal: false, differences: [{ code: "DRIFT" }] },
      },
      "FRESH_SCAFFOLD_DIFF_INVALID",
    ],
    [
      "wrong verifier identity",
      { ...validInput, verificationFixtures: ["site"] },
      "GENERATED_PROJECT_VERIFICATION_INVALID",
    ],
  ];

  for (const [name, input, expectedCode] of cases) {
    await context.test(name, async () => {
      const scaffold = createSuccessfulScaffoldAdapters(input);
      await assert.rejects(
        certifyGeneratedTestingForTesting(scaffold.adapters),
        (error) => {
          assert.equal(error.name, "GeneratedTestingCertificationError");
          assert.equal(error.code, expectedCode);
          return true;
        },
      );
      assert.equal(await pathExists(scaffold.state.ownedPath), false);
    });
  }
});

test("the generated testing certification entry rejects unknown arguments without echoing them", async () => {
  let result;
  try {
    await execFileAsync(process.execPath, [
      generatedTestingCertificationScript,
      "--unknown",
      "private-value",
    ], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { PATH: process.env.PATH },
    });
    assert.fail("invalid arguments must fail");
  } catch (error) {
    result = error;
  }

  assert.equal(result.code, 2);
  assert.equal(result.stdout, "");
  assert.equal(
    result.stderr,
    `${JSON.stringify({
      ok: false,
      code: "CERTIFICATION_ARGUMENT_INVALID",
    })}\n`,
  );
  assert.doesNotMatch(result.stderr, /private-value/u);
});

test("content files certification binds a clean exact revision to causal fresh-scaffold evidence", async () => {
  const revision = "a".repeat(40);
  let revisionReads = 0;
  let statusReads = 0;
  let indexReads = 0;
  const scaffold = createSuccessfulScaffoldAdapters({
    inferredCapability: { identifier: "content-files", version: "0.4.0" },
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
    postCreate: (projectRoot) => writeRecipeVersion(projectRoot, "0.11.6"),
    verifyFixture: async ({ projectRoot, environment }) => {
      assert.equal(projectRoot, scaffold.state.projectRoot);
      assert.equal(environment.CLOUDFLARE_API_TOKEN, undefined);
      assert.equal(environment.CLOUDFLARE_ACCOUNT_ID, undefined);
      assert.equal(environment.NPM_TOKEN, undefined);
      assert.equal(environment.NODE_OPTIONS, undefined);
      return { ok: true, checks: contentFixtureChecks };
    },
  });

  const result = await certifyContentFilesForTesting(
    { revision },
    scaffold.adapters,
  );

  assert.deepEqual(result, {
    ok: true,
    capability: "content-files",
    version: "0.4.0",
    profile: "portfolio",
    subject: {
      descriptorVersion: "0.4.0",
      behaviorContractDigest:
        "sha256:5ae35debef622dc0fb9eeee3889e79a72fd6ff28eb730865bfe95e8674c9ff05",
    },
    recipeVersion: "0.11.6",
    locale: "en-CA",
    evidenceRevision: revision,
    checks: [
      "compiled-cli-create",
      "state-inference",
      "healthy-diagnostics",
      "exact-diff",
      ...fixedChecks,
      ...contentFixtureChecks,
      "repository-sources-unchanged",
    ],
  });
  assert.deepEqual(
    scaffold.state.commands.map(({ arguments: arguments_ }) =>
      arguments_.slice(1),
    ),
    [
      [
        "create",
        "--profile",
        "portfolio",
        "--name",
        "acme-portfolio",
        "--display-name",
        "Acme Portfolio",
        "--directory",
        scaffold.state.projectRoot,
      ],
      ["infer", "--directory", scaffold.state.projectRoot],
      ["doctor", "--directory", scaffold.state.projectRoot],
      ["diff", "--directory", scaffold.state.projectRoot],
    ],
  );
  assert.equal(scaffold.state.verifiedRoot, scaffold.state.projectRoot);
  assert.equal(scaffold.state.fixtureInput.projectRoot, scaffold.state.projectRoot);
  assert.equal(revisionReads, 2);
  assert.equal(statusReads, 2);
  assert.equal(indexReads, 2);
  assert.equal(await pathExists(scaffold.state.ownedPath), false);
});

test("content files fixture verification applies the exact isolated overlay and command sequence", async () => {
  const ownedRoot = await mkdtemp(join(tmpdir(), "content-fixture-verifier-"));
  const projectRoot = join(ownedRoot, "generated-project");
  const supportRoot = join(ownedRoot, "content-fixture-support");
  const siteContentPath = join(
    projectRoot,
    "apps/web/content/en-CA/site.yaml",
  );
  const commands = [];

  try {
    await mkdir(dirname(siteContentPath), { recursive: true });
    await writeFile(
      siteContentPath,
      "schemaVersion: 1.0.0\nnavigation: []\n",
    );
    const { verifyContentFixtureForTesting } = await import(
      "../../scripts/certify-content-files.mjs"
    );

    const result = await verifyContentFixtureForTesting({
      projectRoot,
      environment: { PATH: "/verified/bin" },
      runCommand: async (command) => {
        commands.push(command);
      },
    });

    assert.deepEqual(result, { ok: true, checks: contentFixtureChecks });
    assert.equal(
      await readFile(siteContentPath, "utf8"),
      "schemaVersion: 1.0.0\nnavigation:\n  - href: \"#introduction\"\n    label: Introduction\n",
    );
    assert.equal(
      await readFile(
        join(
          projectRoot,
          "apps/web/tests/unit/content-files-certification.test.ts",
        ),
        "utf8",
      ),
      await readFile(
        join(
          repositoryRoot,
          "tests/capability-certification/fixtures/content-files/content-files-certification.test.ts",
        ),
        "utf8",
      ),
    );
    assert.equal(
      await readFile(
        join(
          projectRoot,
          "apps/web/tests/e2e/content-files-certification.spec.ts",
        ),
        "utf8",
      ),
      await readFile(
        join(
          repositoryRoot,
          "tests/capability-certification/fixtures/content-files/content-files-certification.spec.ts",
        ),
        "utf8",
      ),
    );
    assert.equal(await readFile(join(supportRoot, ".npmrc"), "utf8"), "");
    assert.deepEqual(
      commands.map(({ executable, arguments: arguments_, cwd, timeout }) => ({
        executable,
        arguments: arguments_,
        cwd,
        timeout,
      })),
      [
        {
          executable: "pnpm",
          arguments: [
            "install",
            "--frozen-lockfile",
            "--store-dir",
            join(supportRoot, "store"),
          ],
          cwd: projectRoot,
          timeout: 15 * 60 * 1000,
        },
        {
          executable: "pnpm",
          arguments: [
            "--dir",
            "apps/web",
            "exec",
            "vitest",
            "run",
            "--project",
            "unit",
            "tests/unit/content-files-certification.test.ts",
          ],
          cwd: projectRoot,
          timeout: 15 * 60 * 1000,
        },
        {
          executable: "pnpm",
          arguments: ["--dir", "apps/web", "run", "browser:install"],
          cwd: projectRoot,
          timeout: 15 * 60 * 1000,
        },
        {
          executable: "pnpm",
          arguments: [
            "--dir",
            "apps/web",
            "exec",
            "playwright",
            "test",
            "--config",
            "playwright.dev.config.ts",
            "tests/e2e/content-files-certification.spec.ts",
          ],
          cwd: projectRoot,
          timeout: 15 * 60 * 1000,
        },
      ],
    );
    for (const command of commands) {
      assert.equal(command.environment.PATH, "/verified/bin");
      assert.equal(command.environment.HOME, join(supportRoot, "home"));
      assert.equal(
        command.environment.USERPROFILE,
        join(supportRoot, "home"),
      );
      assert.equal(
        command.environment.PLAYWRIGHT_BROWSERS_PATH,
        join(supportRoot, "playwright-browsers"),
      );
      assert.equal(
        command.environment.NPM_CONFIG_USERCONFIG,
        join(supportRoot, ".npmrc"),
      );
      assert.equal(
        command.environment.NPM_CONFIG_REGISTRY,
        "https://registry.npmjs.org/",
      );
      assert.equal(
        command.environment.TMPDIR,
        join(supportRoot, "temporary"),
      );
      assert.equal(command.environment.TMP, join(supportRoot, "temporary"));
      assert.equal(command.environment.TEMP, join(supportRoot, "temporary"));
      assert.equal(
        command.environment.XDG_CACHE_HOME,
        join(supportRoot, "cache"),
      );
    }
  } finally {
    await rm(ownedRoot, { recursive: true, force: true });
  }
});

test("content files fixture verification contains preparation and overlay filesystem failures", async (context) => {
  const { verifyContentFixtureForTesting } = await import(
    "../../scripts/certify-content-files.mjs"
  );
  const cases = [
    {
      name: "support-root preparation",
      prepare: async ({ ownedRoot }) => {
        await writeFile(join(ownedRoot, "content-fixture-support"), "blocked");
      },
    },
    {
      name: "fixture destination creation",
      prepare: async ({ projectRoot, siteContentPath }) => {
        await mkdir(dirname(siteContentPath), { recursive: true });
        await writeFile(siteContentPath, "navigation: []\n");
        await mkdir(join(projectRoot, "apps/web"), { recursive: true });
        await writeFile(join(projectRoot, "apps/web/tests"), "blocked");
      },
    },
    {
      name: "navigation overlay write",
      skip: process.getuid?.() === 0,
      prepare: async ({ siteContentPath }) => {
        await mkdir(dirname(siteContentPath), { recursive: true });
        await writeFile(siteContentPath, "navigation: []\n", { mode: 0o400 });
      },
    },
  ];

  for (const { name, prepare, skip = false } of cases) {
    await context.test(name, { skip }, async () => {
      const ownedRoot = await mkdtemp(
        join(tmpdir(), "content-fixture-failure-"),
      );
      const projectRoot = join(ownedRoot, "generated-project");
      const siteContentPath = join(
        projectRoot,
        "apps/web/content/en-CA/site.yaml",
      );
      let commandRuns = 0;

      try {
        await prepare({ ownedRoot, projectRoot, siteContentPath });
        await assert.rejects(
          verifyContentFixtureForTesting({
            projectRoot,
            environment: { PATH: "/verified/bin" },
            runCommand: async () => {
              commandRuns += 1;
            },
          }),
          (error) =>
            error?.name === "ContentFilesCertificationError" &&
            error.code === "CERTIFICATION_FIXTURE_OVERLAY_FAILED",
        );
        assert.equal(commandRuns, 0);
      } finally {
        await rm(ownedRoot, { recursive: true, force: true });
      }
    });
  }
});

test("content files certification fails closed on invalid authority and evidence drift", async (context) => {
  const revision = "a".repeat(40);
  const createScaffold = (overrides = {}) =>
    createSuccessfulScaffoldAdapters({
      inferredCapability: { identifier: "content-files", version: "0.4.0" },
      readCurrentRevision: async () => revision,
      postCreate: (projectRoot) => writeRecipeVersion(projectRoot, "0.11.6"),
      verifyFixture: async () => ({ ok: true, checks: contentFixtureChecks }),
      ...overrides,
    });

  await context.test("rejects a non-exact revision before using adapters", async () => {
    await assert.rejects(
      certifyContentFilesForTesting({ revision: "a".repeat(39) }, {}),
      (error) =>
        error?.name === "ContentFilesCertificationError" &&
        error.code === "CERTIFICATION_REVISION_INVALID",
    );
  });

  for (const [name, overrides, expectedCode] of [
    [
      "rejects a dirty worktree before scaffolding",
      { readRepositoryStatus: async () => "?? private-source.ts\0" },
      "CERTIFICATION_WORKTREE_DIRTY",
    ],
    [
      "rejects non-ordinary index flags before scaffolding",
      { readRepositoryIndexEntries: async () => "S selected-evidence.test.mjs\0" },
      "CERTIFICATION_INDEX_FLAGS",
    ],
  ]) {
    await context.test(name, async () => {
      const scaffold = createScaffold(overrides);
      await assert.rejects(
        certifyContentFilesForTesting({ revision }, scaffold.adapters),
        (error) =>
          error?.name === "ContentFilesCertificationError" &&
          error.code === expectedCode,
      );
      assert.equal(scaffold.state.commands.length, 0);
    });
  }

  await context.test("rejects revision drift after contained evidence", async () => {
    let reads = 0;
    const scaffold = createScaffold({
      readCurrentRevision: async () => {
        reads += 1;
        return reads === 1 ? revision : "b".repeat(40);
      },
    });
    await assert.rejects(
      certifyContentFilesForTesting({ revision }, scaffold.adapters),
      (error) => error?.code === "CERTIFICATION_REVISION_MISMATCH",
    );
    assert.equal(await pathExists(scaffold.state.ownedPath), false);
  });

  await context.test("contains causal fixture failure", async () => {
    const scaffold = createScaffold({
      verifyFixture: async () => {
        throw new Error("private fixture failure");
      },
    });
    await assert.rejects(
      certifyContentFilesForTesting({ revision }, scaffold.adapters),
      (error) => error?.code === "CERTIFICATION_FIXTURE_VERIFICATION_FAILED",
    );
    assert.equal(await pathExists(scaffold.state.ownedPath), false);
  });

  await context.test("rejects worktree drift after contained evidence", async () => {
    let reads = 0;
    const scaffold = createScaffold({
      readRepositoryStatus: async () => {
        reads += 1;
        return reads === 1 ? "" : " M private-source.ts\0";
      },
    });
    await assert.rejects(
      certifyContentFilesForTesting({ revision }, scaffold.adapters),
      (error) => error?.code === "CERTIFICATION_WORKTREE_DIRTY",
    );
    assert.equal(await pathExists(scaffold.state.ownedPath), false);
  });
});

test("the content files certification command requires one exact revision without echoing rejected values", async () => {
  for (const [arguments_, expectedCode, expectedExitCode] of [
    [
      ["--revision", "private-value"],
      "CERTIFICATION_REVISION_INVALID",
      1,
    ],
    [
      ["--", "--revision", "private-value"],
      "CERTIFICATION_REVISION_INVALID",
      1,
    ],
    [["--unknown", "private-value"], "CERTIFICATION_ARGUMENT_INVALID", 2],
  ]) {
    const execution = await execFileAsync(
      process.execPath,
      [contentFilesCertificationScript, ...arguments_],
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

test("multilingual certification binds both profiles and the exact lifecycle to one clean accepted subject", async () => {
  const { certifyMultilingualForTesting } = await import(
    "../../scripts/certify-multilingual.mjs"
  );
  const revision = "a".repeat(40);
  const subject = {
    descriptorVersion: "0.1.0",
    behaviorContractDigest:
      "sha256:016afd467349fde8ffeb821fe672cf60004f8e10916141c4f3837a81afcb1d41",
  };
  let revisionReads = 0;
  let statusReads = 0;
  let indexReads = 0;
  const authority = {
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
  };
  const portfolio = createSuccessfulScaffoldAdapters({
    expectedCapabilities: Object.freeze([
      ...multilingualCommonCapabilities,
      "booking-calendly",
      "multilingual",
    ]),
    inferredCapability: { identifier: "multilingual", version: "0.1.0" },
    profile: "portfolio",
    readCurrentRevision: authority.readCurrentRevision,
    postCreate: (projectRoot) => writeRecipeVersion(projectRoot, "0.10.0"),
    verifierIdentifier: "portfolio-multilingual-calendly",
  });
  const site = createSuccessfulScaffoldAdapters({
    expectedCapabilities: Object.freeze([
      ...multilingualCommonCapabilities,
      "site-routing",
      "multilingual",
    ]),
    inferredCapability: { identifier: "multilingual", version: "0.1.0" },
    profile: "site",
    readCurrentRevision: authority.readCurrentRevision,
    postCreate: (projectRoot) => writeRecipeVersion(projectRoot, "0.11.0"),
    verifierIdentifier: "site-multilingual",
  });
  const lifecycleCommands = [];
  const lifecycleByFile = new Map([
    ["apps/cli/tests/cli.test.mjs", compiledMultilingualLifecycleTests],
    [
      "packages/builder-core/tests/apply-capability-addition.test.mjs",
      builderMultilingualAdditionLifecycleTests,
    ],
    [
      "packages/builder-core/tests/apply-capability-removal.test.mjs",
      builderMultilingualRemovalLifecycleTests,
    ],
    [
      "packages/builder-core/tests/plan-capability-addition.test.mjs",
      builderMultilingualAdditionPlanTests,
    ],
    [
      "packages/builder-core/tests/plan-capability-removal.test.mjs",
      builderMultilingualRemovalPlanTests,
    ],
  ]);

  const result = await certifyMultilingualForTesting(
    { revision },
    {
      ...authority,
      journeys: { portfolio: portfolio.adapters, site: site.adapters },
      async runLifecycleCommand(input) {
        lifecycleCommands.push(input);
        const selected = lifecycleByFile.get(input.arguments.at(-1));
        assert.notEqual(selected, undefined);
        return { stdout: successfulTap(selected) };
      },
    },
  );

  assert.deepEqual(result, {
    ok: true,
    capability: "multilingual",
    version: "0.1.0",
    profiles: ["portfolio", "site"],
    subject,
    evidenceRevision: revision,
    outcomes: ["existing-repository-lifecycle", "fresh-scaffold"],
    checks: [
      "portfolio:compiled-cli-create",
      "portfolio:state-inference",
      "portfolio:healthy-diagnostics",
      "portfolio:exact-diff",
      ...fixedChecks.map((check) => `portfolio:${check}`),
      "site:compiled-cli-create",
      "site:state-inference",
      "site:healthy-diagnostics",
      "site:exact-diff",
      ...fixedChecks.map((check) => `site:${check}`),
      "compiled-add-remove-re-add-both-profiles",
      "addition-fresh-inference-and-state-last",
      "removal-composition-ejection-and-state-last",
      "addition-drift-refusal",
      "removal-drift-refusal",
      "retained-failure-prefixes",
      "exact-final-byte-validation",
      "repository-sources-unchanged",
    ],
  });
  assert.deepEqual(
    portfolio.state.commands.map(({ arguments: arguments_ }) =>
      arguments_.slice(1),
    ),
    [
      [
        "create",
        "--profile",
        "portfolio",
        "--name",
        "acme-portfolio-multilingual",
        "--display-name",
        "Acme Portfolio Multilingual",
        "--directory",
        portfolio.state.projectRoot,
        "--multilingual",
        "--calendly-url",
        "https://calendly.com/example/intro",
        "--calendly-mode",
        "popup",
      ],
      ["infer", "--directory", portfolio.state.projectRoot],
      ["doctor", "--directory", portfolio.state.projectRoot],
      ["diff", "--directory", portfolio.state.projectRoot],
    ],
  );
  assert.deepEqual(
    site.state.commands.map(({ arguments: arguments_ }) => arguments_.slice(1)),
    [
      [
        "create",
        "--profile",
        "site",
        "--name",
        "acme-site-multilingual",
        "--display-name",
        "Acme Site Multilingual",
        "--directory",
        site.state.projectRoot,
        "--multilingual",
      ],
      ["infer", "--directory", site.state.projectRoot],
      ["doctor", "--directory", site.state.projectRoot],
      ["diff", "--directory", site.state.projectRoot],
    ],
  );
  assert.deepEqual(
    lifecycleCommands.map(({ arguments: arguments_ }) => arguments_.at(-1)),
    [...lifecycleByFile.keys()],
  );
  assert.equal(revisionReads, 2);
  assert.equal(statusReads, 2);
  assert.equal(indexReads, 2);
  assert.equal(await pathExists(portfolio.state.ownedPath), false);
  assert.equal(await pathExists(site.state.ownedPath), false);
});

test("multilingual portfolio verification runs the full isolated project and browser sequence", async () => {
  const { verifyMultilingualPortfolioForTesting } = await import(
    "../../scripts/certify-multilingual.mjs"
  );
  const ownedRoot = await mkdtemp(
    join(tmpdir(), "multilingual-portfolio-verifier-"),
  );
  const projectRoot = join(ownedRoot, "project");
  const supportRoot = join(ownedRoot, "multilingual-portfolio-support");
  const commands = [];

  try {
    await mkdir(projectRoot);
    const result = await verifyMultilingualPortfolioForTesting({
      projectRoot,
      environment: { PATH: "/verified/bin" },
      async runCommand(command) {
        commands.push(command);
        return command.arguments[0] === "--version" ? "11.20.0\n" : "";
      },
    });

    assert.deepEqual(result, {
      ok: true,
      fixtures: ["portfolio-multilingual-calendly"],
      profiles: ["portfolio"],
      checks: fixedChecks,
    });
    assert.deepEqual(
      commands.map(({ executable, arguments: arguments_, cwd }) => ({
        executable,
        arguments: arguments_,
        cwd,
      })),
      [
        { executable: "pnpm", arguments: ["--version"], cwd: projectRoot },
        {
          executable: "pnpm",
          arguments: [
            "install",
            "--frozen-lockfile",
            "--store-dir",
            join(supportRoot, "store"),
          ],
          cwd: projectRoot,
        },
        {
          executable: "pnpm",
          arguments: ["peers", "check"],
          cwd: projectRoot,
        },
        {
          executable: "pnpm",
          arguments: ["audit", "--audit-level", "moderate"],
          cwd: projectRoot,
        },
        {
          executable: "pnpm",
          arguments: ["audit", "signatures"],
          cwd: projectRoot,
        },
        {
          executable: "pnpm",
          arguments: ["run", "lint"],
          cwd: projectRoot,
        },
        {
          executable: "pnpm",
          arguments: ["--dir", "apps/web", "run", "cf-typegen"],
          cwd: projectRoot,
        },
        {
          executable: "pnpm",
          arguments: ["run", "typecheck"],
          cwd: projectRoot,
        },
        {
          executable: "pnpm",
          arguments: ["run", "test:unit"],
          cwd: projectRoot,
        },
        {
          executable: "pnpm",
          arguments: ["run", "test:component"],
          cwd: projectRoot,
        },
        {
          executable: "pnpm",
          arguments: ["run", "build"],
          cwd: projectRoot,
        },
        {
          executable: "pnpm",
          arguments: [
            "--dir",
            "apps/web",
            "exec",
            "opennextjs-cloudflare",
            "build",
            "--skipNextBuild",
          ],
          cwd: projectRoot,
        },
        {
          executable: "pnpm",
          arguments: ["--dir", "apps/web", "run", "browser:install"],
          cwd: projectRoot,
        },
        {
          executable: "pnpm",
          arguments: ["--dir", "apps/web", "run", "test:e2e:dev"],
          cwd: projectRoot,
        },
        {
          executable: "pnpm",
          arguments: ["--dir", "apps/web", "run", "test:e2e:preview"],
          cwd: projectRoot,
        },
      ],
    );
    for (const command of commands) {
      assert.equal(command.environment.PATH, "/verified/bin");
      assert.equal(command.environment.HOME, join(supportRoot, "home"));
      assert.equal(command.environment.USERPROFILE, join(supportRoot, "home"));
      assert.equal(
        command.environment.PLAYWRIGHT_BROWSERS_PATH,
        join(supportRoot, "playwright-browsers"),
      );
      assert.equal(
        command.environment.NPM_CONFIG_USERCONFIG,
        join(supportRoot, ".npmrc"),
      );
      assert.equal(
        command.environment.NPM_CONFIG_REGISTRY,
        "https://registry.npmjs.org/",
      );
      assert.equal(command.environment.TMPDIR, join(supportRoot, "temporary"));
      assert.equal(command.environment.TMP, join(supportRoot, "temporary"));
      assert.equal(command.environment.TEMP, join(supportRoot, "temporary"));
      assert.equal(command.environment.XDG_CACHE_HOME, join(supportRoot, "cache"));
      assert.equal(command.environment.CLOUDFLARE_API_TOKEN, undefined);
      assert.equal(command.environment.CLOUDFLARE_ACCOUNT_ID, undefined);
      assert.equal(command.environment.NPM_TOKEN, undefined);
      assert.equal(command.environment.NODE_OPTIONS, undefined);
    }
  } finally {
    await rm(ownedRoot, { recursive: true, force: true });
  }
});

test("multilingual certification fails closed on authority and selected-evidence drift", async (context) => {
  const {
    certifyMultilingualForTesting,
    MultilingualCertificationError,
  } = await import("../../scripts/certify-multilingual.mjs");
  const revision = "a".repeat(40);
  const testsByFile = new Map([
    ["apps/cli/tests/cli.test.mjs", compiledMultilingualLifecycleTests],
    [
      "packages/builder-core/tests/apply-capability-addition.test.mjs",
      builderMultilingualAdditionLifecycleTests,
    ],
    [
      "packages/builder-core/tests/apply-capability-removal.test.mjs",
      builderMultilingualRemovalLifecycleTests,
    ],
    [
      "packages/builder-core/tests/plan-capability-addition.test.mjs",
      builderMultilingualAdditionPlanTests,
    ],
    [
      "packages/builder-core/tests/plan-capability-removal.test.mjs",
      builderMultilingualRemovalPlanTests,
    ],
  ]);
  const createAdapters = (overrides = {}) => {
    const portfolio = createSuccessfulScaffoldAdapters({
      expectedCapabilities: Object.freeze([
        ...multilingualCommonCapabilities,
        "booking-calendly",
        "multilingual",
      ]),
      inferredCapability: { identifier: "multilingual", version: "0.1.0" },
      profile: "portfolio",
      readCurrentRevision: async () => revision,
      postCreate: (projectRoot) => writeRecipeVersion(projectRoot, "0.10.0"),
      verifierIdentifier: "portfolio-multilingual-calendly",
    });
    const site = createSuccessfulScaffoldAdapters({
      expectedCapabilities: Object.freeze([
        ...multilingualCommonCapabilities,
        "site-routing",
        "multilingual",
      ]),
      inferredCapability: { identifier: "multilingual", version: "0.1.0" },
      profile: "site",
      readCurrentRevision: async () => revision,
      postCreate: (projectRoot) => writeRecipeVersion(projectRoot, "0.11.0"),
      verifierIdentifier: "site-multilingual",
    });
    return {
      state: { portfolio: portfolio.state, site: site.state },
      adapters: {
        readCurrentRevision: async () => revision,
        readRepositoryStatus: async () => "",
        readRepositoryIndexEntries: async () =>
          "H selected-evidence.test.mjs\0",
        async runLifecycleCommand(input) {
          return {
            stdout: successfulTap(testsByFile.get(input.arguments.at(-1))),
          };
        },
        journeys: { portfolio: portfolio.adapters, site: site.adapters },
        ...overrides,
      },
    };
  };

  await context.test("rejects a dirty source before a journey starts", async () => {
    const scaffold = createAdapters({
      readRepositoryStatus: async () => "?? private-source.ts\0",
    });
    await assert.rejects(
      certifyMultilingualForTesting({ revision }, scaffold.adapters),
      (error) =>
        error instanceof MultilingualCertificationError &&
        error.code === "CERTIFICATION_WORKTREE_DIRTY",
    );
    assert.equal(scaffold.state.portfolio.commands.length, 0);
    assert.equal(scaffold.state.site.commands.length, 0);
  });

  await context.test("rejects revision drift after contained evidence", async () => {
    let reads = 0;
    const scaffold = createAdapters({
      readCurrentRevision: async () =>
        (reads += 1) === 1 ? revision : "b".repeat(40),
    });
    await assert.rejects(
      certifyMultilingualForTesting({ revision }, scaffold.adapters),
      (error) => error?.code === "CERTIFICATION_REVISION_MISMATCH",
    );
    assert.equal(await pathExists(scaffold.state.portfolio.ownedPath), false);
    assert.equal(await pathExists(scaffold.state.site.ownedPath), false);
  });

  for (const [name, stdout] of [
    [
      "rejects a zero-match lifecycle selection",
      "TAP version 13\n1..0\n# tests 0\n# pass 0\n# fail 0\n",
    ],
    [
      "rejects a skipped lifecycle selection",
      [
        "TAP version 13",
        "# Subtest: the compiled CLI preserves multilingual through both capability install orders and re-addition",
        "ok 1 - the compiled CLI preserves multilingual through both capability install orders and re-addition # SKIP private refusal",
        "1..1",
        "# tests 1",
        "# pass 0",
        "# fail 0",
        "",
      ].join("\n"),
    ],
  ]) {
    await context.test(name, async () => {
      const scaffold = createAdapters({
        runLifecycleCommand: async () => ({ stdout }),
      });
      await assert.rejects(
        certifyMultilingualForTesting({ revision }, scaffold.adapters),
        (error) => error?.code === "CERTIFICATION_LIFECYCLE_EVIDENCE_FAILED",
      );
      assert.equal(await pathExists(scaffold.state.portfolio.ownedPath), false);
      assert.equal(await pathExists(scaffold.state.site.ownedPath), false);
    });
  }
});

test("the multilingual certification command requires one exact revision without echoing rejected values", async () => {
  const script = resolve(repositoryRoot, "scripts/certify-multilingual.mjs");
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
      [script, ...arguments_],
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

test("the registry command rejects unknown arguments without registry content", async () => {
  const result = await runCheck(["--unknown", "private-value"]);
  assert.deepEqual(result, {
    exitCode: 2,
    stdout: "",
    stderr: `${JSON.stringify({
      ok: false,
      code: "CERTIFICATION_ARGUMENT_INVALID",
    })}\n`,
  });
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /private-value/u);
});

test("Calendly app addition requires actual Worker evidence and preserves owned-directory isolation", async () => {
  const commands = [];
  let ownedPath;
  let projectRoot;
  let primaryRoot;
  let verifiedRoot;
  const previousToken = process.env.CLOUDFLARE_API_TOKEN;
  process.env.CLOUDFLARE_API_TOKEN = "PRIVATE_VALUE";

  const runtime = {
    workerIntegration: { executed: ["app-calendly"], skipped: [] },
    appBuildEvidence: [{
      fixture: "app-calendly",
      effect: { version: "4.0.0-rc.112", packageSha256: "a".repeat(64) },
      client: { files: ["apps/web/.next/static/chunks/app.js"], bytes: 25, inspectedEffectMarkers: ["~effect/Effect"] },
      server: { files: 1, bytes: 100 },
      worker: { path: "apps/web/.open-next/server-functions/default/handler.mjs", bytes: 50, sha256: "b".repeat(64) },
    }],
  };
  try {
    for (const [recipeVersion, invalidRuntime, expectedErrorCode] of [
      ["0.2.6", false, undefined],
      ["0.2.6", true, "CERTIFICATION_RUNTIME_EVIDENCE_INVALID"],
      ["0.2.2", false, "CAPABILITY_ADDITION_INFERENCE_INVALID"],
    ]) {
      commands.length = 0;
      verifiedRoot = undefined;
      const execution = certifyBookingCalendlyForTesting(
        { calendlyUrl: "https://calendly.com/example/intro" },
        {
          async runCommand(input) {
            commands.push(input);
            assert.equal(input.environment.CLOUDFLARE_API_TOKEN, undefined);
            assert.equal(input.environment.NPM_TOKEN, undefined);
            assert.equal(input.environment.NODE_OPTIONS, undefined);
            if (input.executable === "git") {
              const worktreeIndex = input.arguments.indexOf("worktree");
              if (worktreeIndex !== -1) {
                projectRoot = input.arguments.at(-1);
                await mkdir(projectRoot);
                await writeFile(join(projectRoot, ".git"), "gitdir: private\n");
              }
              return "";
            }

            assert.equal(input.executable, process.execPath);
            const command = input.arguments[1];

            if (command === "create") {
              primaryRoot = input.arguments[
                input.arguments.indexOf("--directory") + 1
              ];
              ownedPath = dirname(primaryRoot);
              assert.equal((await lstat(ownedPath)).mode & 0o777, 0o700);
              await mkdir(primaryRoot);
              return `${JSON.stringify({
                ok: true,
                command: "create",
                destination: projectRoot,
                profile: "app",
                capabilities: [
                  "standards", "deployment-cloudflare", "content-files", "section-composition",
                  "observability", "app-foundation", "site-routing",
                ],
              })}\n`;
            }
            if (command === "plan-add") {
              return `${JSON.stringify({
                ok: true,
                command: "plan-add",
                result: {
                  operation: "add-capability",
                  status: "approval-required",
                  planFingerprint: `sha256:${"a".repeat(64)}`,
                  profile: "app",
                  capability: {
                    identifier: "booking-calendly",
                    version: "0.1.0",
                  },
                },
              })}\n`;
            }
            if (command === "apply-add") {
              return `${JSON.stringify({
                ok: true,
                command: "apply-add",
                result: {
                  status: "verified-final-diff-approval-required",
                  capability: {
                    identifier: "booking-calendly",
                    version: "0.1.0",
                  },
                  migration: "add-booking-calendly-0-1-0",
                },
              })}\n`;
            }
            if (command === "infer") {
              return `${JSON.stringify({
                ok: true,
                command: "infer",
                result: {
                  state: {
                    kind: "valid",
                    value: {
                      origin: { profile: "app", recipeVersion },
                      installedCapabilities: [
                        { identifier: "standards", version: "0.5.1" },
                        { identifier: "deployment-cloudflare", version: "0.3.1" },
                        { identifier: "content-files", version: "0.4.0" },
                        { identifier: "section-composition", version: "0.3.0" },
                        { identifier: "observability", version: "0.3.0" },
                        { identifier: "app-foundation", version: "0.1.0" },
                        { identifier: "site-routing", version: "0.4.0" },
                        { identifier: "booking-calendly", version: "0.1.0" },
                      ],
                    },
                  },
                  capabilities: [
                    { identifier: "booking-calendly", category: "confirmed" },
                  ],
                },
              })}\n`;
            }
            if (command === "doctor") {
              return `${JSON.stringify({
                ok: true,
                command: "doctor",
                result: { healthy: true, diagnostics: [] },
              })}\n`;
            }
            if (command === "diff") {
              return `${JSON.stringify({
                ok: true,
                command: "diff",
                result: { equal: true, differences: [] },
              })}\n`;
            }
            throw new Error("unexpected command");
          },
          async verifyProject(root, identifier) {
            verifiedRoot = root;
            assert.equal(identifier, "app-calendly");
            assert.notEqual(root, projectRoot);
            assert.equal(dirname(root), ownedPath);
            assert.equal(await pathExists(join(root, ".git")), false);
            return {
              ok: true,
              fixtures: ["app-calendly"],
              profiles: ["app"],
              checks: fixedChecks,
              ...(invalidRuntime ? { workerIntegration: { executed: [], skipped: ["app-calendly"] } } : runtime),
            };
          },
        },
      );

      if (expectedErrorCode) {
        await assert.rejects(execution, error => error?.code === expectedErrorCode);
        if (expectedErrorCode === "CAPABILITY_ADDITION_INFERENCE_INVALID") assert.equal(verifiedRoot, undefined);
        assert.equal(await pathExists(ownedPath), false);
        continue;
      }
      const result = await execution;
      assert.deepEqual(result, {
        ok: true,
        capability: "booking-calendly",
        version: "0.1.0",
        profile: "app",
        mode: "popup",
        subject: { descriptorVersion: "0.1.0", behaviorContractDigest: "sha256:f9ee03e776da520af1bef7079a12454fd5339205f04d9836a424d5011da1bdca" },
        ...runtime,
        checks: [
          "compiled-cli-create-baseline",
          "clean-linked-worktree",
          "compiled-cli-plan-add",
          "compiled-cli-apply-add",
          "state-inference",
          "healthy-diagnostics",
          "exact-diff",
          ...fixedChecks,
        ],
      });
      assert.equal(commands.length, 12);
      assert.deepEqual(
        commands
          .filter(({ executable }) => executable === process.execPath)
          .map(({ arguments: arguments_ }) => arguments_.slice(1)),
        [
          [
            "create",
            "--profile",
            "app",
            "--name",
            "acme-app-calendly",
            "--display-name",
            "Acme App Booking",
            "--directory",
            primaryRoot,
          ],
          [
            "plan-add",
            "--directory",
            projectRoot,
            "--capability",
            "booking-calendly",
            "--calendly-url",
            "https://calendly.com/example/intro",
            "--calendly-mode",
            "popup",
          ],
          [
            "apply-add",
            "--directory",
            projectRoot,
            "--capability",
            "booking-calendly",
            "--calendly-url",
            "https://calendly.com/example/intro",
            "--calendly-mode",
            "popup",
            "--approved-plan",
            `sha256:${"a".repeat(64)}`,
          ],
          ["infer", "--directory", projectRoot],
          ["doctor", "--directory", projectRoot],
          ["diff", "--directory", projectRoot],
        ],
      );
      assert.deepEqual(
        commands
          .filter(({ executable }) => executable === "git")
          .map(({ arguments: arguments_ }) => arguments_),
        [
          ["-C", primaryRoot, "init", "--initial-branch", "main"],
          ["-C", primaryRoot, "config", "user.name", "Egeria Certification"],
          [
            "-C",
            primaryRoot,
            "config",
            "user.email",
            "certification@example.invalid",
          ],
          ["-C", primaryRoot, "add", "--all"],
          ["-C", primaryRoot, "commit", "-m", "Create certification baseline"],
          [
            "-C",
            primaryRoot,
            "worktree",
            "add",
            "-b",
            "booking-calendly-certification-worktree",
            projectRoot,
          ],
        ],
      );
      assert.notEqual(verifiedRoot, projectRoot);
      assert.equal(await pathExists(ownedPath), false);
      assert.doesNotMatch(JSON.stringify(result), /calendly\.com|PRIVATE_VALUE/u);
    }
  } finally {
    if (previousToken === undefined) {
      delete process.env.CLOUDFLARE_API_TOKEN;
    } else {
      process.env.CLOUDFLARE_API_TOKEN = previousToken;
    }
  }
});

test("Calendly production mutation maps command failures and removes its real owner", async () => {
  let ownedPath;

  await assert.rejects(
    () =>
      certifyBookingCalendlyForTesting(
        { calendlyUrl: "https://calendly.com/example/private-value" },
        {
          async runCommand(input) {
            ownedPath = dirname(
              input.arguments[input.arguments.indexOf("--directory") + 1],
            );
            throw new Error("PRIVATE_VALUE");
          },
          async verifyProject() {
            throw new Error("must not verify");
          },
        },
      ),
    (error) => {
      assert.equal(error?.name, "BookingCalendlyCertificationError");
      assert.equal(error?.code, "BASELINE_CREATE_FAILED");
      assert.doesNotMatch(String(error), /PRIVATE_VALUE|calendly\.com/u);
      return true;
    },
  );
  assert.equal(await pathExists(ownedPath), false);
});

test("Calendly certification canonicalizes an owned directory below a symbolic-link parent", async () => {
  const testRoot = await mkdtemp(
    join(tmpdir(), "egeria-calendly-canonical-owner-test-"),
  );
  const canonicalParent = join(testRoot, "canonical");
  const aliasParent = join(testRoot, "alias");
  await mkdir(canonicalParent);
  await symlink(
    canonicalParent,
    aliasParent,
    process.platform === "win32" ? "junction" : "dir",
  );
  const requestedOutputRoot = join(aliasParent, "owner");
  let observedOutputRoot;

  try {
    await assert.rejects(
      () =>
        certifyBookingCalendlyForTesting(
          {
            calendlyUrl: "https://calendly.com/example/private-value",
            outputRoot: requestedOutputRoot,
          },
          {
            async runCommand(input) {
              observedOutputRoot = dirname(
                input.arguments[input.arguments.indexOf("--directory") + 1],
              );
              throw new Error("stop after observing canonical owner");
            },
            async verifyProject() {
              throw new Error("must not verify");
            },
          },
        ),
      (error) => {
        assert.equal(error?.code, "BASELINE_CREATE_FAILED");
        return true;
      },
    );

    assert.equal(observedOutputRoot, join(await realpath(aliasParent), "owner"));
    assert.equal(await pathExists(requestedOutputRoot), false);
  } finally {
    await rm(testRoot, { recursive: true });
  }
});

test("Calendly testing API rejects the production-adapter mutation", async () => {
  for (const adapters of [undefined, null, {}, { runCommand() {} }]) {
    await assert.rejects(
      () =>
        certifyBookingCalendlyForTesting(
          { calendlyUrl: "https://calendly.com/example/intro" },
          adapters,
        ),
      (error) => {
        assert.equal(error?.name, "BookingCalendlyCertificationError");
        assert.equal(error?.code, "CERTIFICATION_ADAPTER_INVALID");
        return true;
      },
    );
  }
});

test("Calendly certification rejects unsafe retained output roots before commands", async () => {
  const owner = await mkdtemp(join(tmpdir(), "egeria-calendly-output-test-"));
  const existing = join(owner, "existing");
  await mkdir(existing);
  let calls = 0;
  const adapters = {
    runCommand() {
      calls += 1;
      throw new Error("must not run");
    },
    verifyProject() {
      throw new Error("must not verify");
    },
  };

  try {
    for (const outputRoot of ["relative-output", existing]) {
      await assert.rejects(
        () =>
          certifyBookingCalendlyForTesting(
            {
              calendlyUrl: "https://calendly.com/example/private-value",
              outputRoot,
            },
            adapters,
          ),
        (error) => {
          assert.equal(error?.name, "BookingCalendlyCertificationError");
          assert.equal(error?.code, "CERTIFICATION_OUTPUT_ROOT_INVALID");
          assert.doesNotMatch(String(error), /PRIVATE_VALUE|calendly\.com/u);
          return true;
        },
      );
    }
    assert.equal(calls, 0);
    assert.equal((await lstat(existing)).isDirectory(), true);
  } finally {
    await rm(owner, { recursive: true });
  }
});

test("the certification entry rejects unknown arguments without echoing them", async () => {
  let result;
  try {
    await execFileAsync(process.execPath, [
      certificationScript,
      "--unknown",
      "private-value",
    ], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { PATH: process.env.PATH },
    });
    assert.fail("invalid arguments must fail");
  } catch (error) {
    result = error;
  }

  assert.equal(result.code, 2);
  assert.equal(result.stdout, "");
  assert.equal(
    result.stderr,
    `${JSON.stringify({
      ok: false,
      code: "CERTIFICATION_ARGUMENT_INVALID",
    })}\n`,
  );
  assert.doesNotMatch(result.stderr, /private-value/u);
});

test("the certification entry accepts retained output syntax before safe root validation", async () => {
  let result;
  try {
    await execFileAsync(process.execPath, [
      certificationScript,
      "--output-root",
      "private-relative-output",
      "--calendly-url",
      "https://calendly.com/example/private-value",
    ], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { PATH: process.env.PATH },
    });
    assert.fail("relative retained output must fail");
  } catch (error) {
    result = error;
  }

  assert.equal(result.code, 1);
  assert.equal(result.stdout, "");
  assert.equal(
    result.stderr,
    `${JSON.stringify({
      ok: false,
      code: "CERTIFICATION_OUTPUT_ROOT_INVALID",
    })}\n`,
  );
  assert.doesNotMatch(result.stderr, /private-relative|calendly\.com/u);
});

test("the certification entry accepts the conventional package-script separator", async () => {
  let result;
  try {
    await execFileAsync(process.execPath, [
      certificationScript,
      "--",
      "--output-root",
      "private-relative-output",
      "--calendly-url",
      "https://calendly.com/example/private-value",
    ], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { PATH: process.env.PATH },
    });
    assert.fail("relative retained output must fail");
  } catch (error) {
    result = error;
  }

  assert.equal(result.code, 1);
  assert.equal(result.stdout, "");
  assert.equal(
    result.stderr,
    `${JSON.stringify({
      ok: false,
      code: "CERTIFICATION_OUTPUT_ROOT_INVALID",
    })}\n`,
  );
  assert.doesNotMatch(result.stderr, /private-relative|calendly\.com/u);
});
