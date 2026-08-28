import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual, promisify } from "node:util";

import { certifyFreshScaffoldForTesting } from "./lib/certify-fresh-scaffold.mjs";
import { runCertificationCli } from "./lib/certification-cli.mjs";
import {
  createIsolatedProcessEnvironment,
  isolatedProcessOptions,
} from "./lib/isolated-process.mjs";
import { verifyGeneratedProject } from "./verify-generated-skeletons.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliEntry = resolve(repositoryRoot, "apps/cli/dist/index.js");
const exactRevisionPattern = /^[0-9a-f]{40}$/u;
const publicRegistry = "https://registry.npmjs.org/";
const commandTimeoutMilliseconds = 15 * 60 * 1000;
const aggregateCreateTimeoutMilliseconds = 45 * 60 * 1000;
const lifecycleCommandTimeoutMilliseconds = 45 * 60 * 1000;
const profiles = Object.freeze(["portfolio", "site"]);
const subject = Object.freeze({
  descriptorVersion: "0.1.0",
  behaviorContractDigest:
    "sha256:ca2e69a35e935eab011f0543fdf140e644a0dec490650298bdfba730e2e9d378",
});
const expectedAnalyticsSettings = Object.freeze({
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
const providerArguments = Object.freeze([
  "--cloudflare-web-analytics-token",
  expectedAnalyticsSettings.providers.cloudflareWebAnalytics.siteToken,
  "--google-analytics-id",
  expectedAnalyticsSettings.providers.googleAnalytics4.measurementId,
  "--microsoft-clarity-id",
  expectedAnalyticsSettings.providers.microsoftClarity.projectId,
  "--microsoft-clarity-audience",
  expectedAnalyticsSettings.providers.microsoftClarity.audience,
  "--search-console-verification",
  expectedAnalyticsSettings.operationalIntegrations.googleSearchConsole
    .verificationToken,
  "--looker-studio",
]);
const analyticsSettingsPath =
  "apps/web/src/integrations/analytics/analytics-settings.ts";
const analyticsSettingsPrefix =
  'import type { AnalyticsSettings } from "./analytics-provider-contract";\n\nexport const analyticsSettings = ';
const analyticsSettingsSuffix =
  " as const satisfies AnalyticsSettings;\n";
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
const baseFreshScaffoldChecks = Object.freeze([
  "compiled-cli-create",
  "state-inference",
  "healthy-diagnostics",
  "exact-diff",
]);
const lifecycleGroups = Object.freeze([
  Object.freeze({
    file: "apps/cli/tests/cli.test.mjs",
    tests: Object.freeze([
      "the compiled CLI preserves analytics and multilingual across both install orders and analytics re-addition",
      "the compiled CLI refuses duplicate analytics addition without repository mutation",
    ]),
  }),
  Object.freeze({
    file: "packages/builder-core/tests/apply-capability-addition.test.mjs",
    tests: Object.freeze([
      "analytics addition composes with multilingual and persists only public settings",
      "analytics addition binds transformation to the approved settings snapshot",
      "analytics addition retains failure prefixes and final authority",
    ]),
  }),
  Object.freeze({
    file: "packages/builder-core/tests/apply-capability-removal.test.mjs",
    tests: Object.freeze([
      "analytics removal restores the multilingual layout and persists fresh discovery",
      "analytics removal can be re-added with exact repaired surfaces and ordered history",
      "analytics removal retains failure prefixes and final authority",
    ]),
  }),
  Object.freeze({
    file: "packages/builder-core/tests/plan-capability-addition.test.mjs",
    tests: Object.freeze([
      "analytics addition redacts public identifiers and composes after multilingual",
      "analytics addition planning refuses drift and binds private authority",
    ]),
  }),
  Object.freeze({
    file: "packages/builder-core/tests/plan-capability-removal.test.mjs",
    tests: Object.freeze([
      "analytics removal restores the composed layout and requires provider disposition review",
      "analytics removal planning refuses drift and binds private authority",
    ]),
  }),
]);
const lifecycleChecks = Object.freeze([
  "compiled-add-remove-re-add-both-profiles",
  "duplicate-analytics-add-refusal",
  "settings-bound-addition",
  "addition-state-last-and-failure-prefixes",
  "removal-state-last-provider-disposition-and-failure-prefixes",
  "drift-and-unsafe-root-refusal",
  "final-diff-authority",
  "exact-final-byte-validation",
]);

export class AnalyticsCertificationError extends Error {
  constructor(code) {
    super(`Analytics certification failed: ${code}`);
    this.name = "AnalyticsCertificationError";
    this.code = code;
  }
}

function createError(code) {
  return new AnalyticsCertificationError(code);
}

function configurationFor(profile, revision) {
  if (typeof revision !== "string" || !exactRevisionPattern.test(revision)) {
    throw createError("CERTIFICATION_REVISION_INVALID");
  }
  if (!profiles.includes(profile)) {
    throw createError("CERTIFICATION_PROFILE_INVALID");
  }

  const isPortfolio = profile === "portfolio";
  return Object.freeze({
    profile,
    projectName: isPortfolio
      ? "acme-portfolio-analytics"
      : "acme-site-multilingual-analytics",
    displayName: isPortfolio
      ? "Acme Portfolio Analytics"
      : "Acme Site Multilingual Analytics",
    createArguments: Object.freeze([
      ...providerArguments,
      ...(isPortfolio ? [] : ["--multilingual"]),
    ]),
    expectedCapabilities: isPortfolio
      ? Object.freeze([...commonCapabilities, "analytics"])
      : Object.freeze([
          ...commonCapabilities,
          "site-routing",
          "analytics",
          "multilingual",
        ]),
    capabilityIdentifier: "analytics",
    capabilityVersion: "0.1.0",
    expectedRecipeVersion: isPortfolio ? "0.10.0" : "0.11.0",
    verifierIdentifier: isPortfolio
      ? "portfolio-analytics"
      : "site-multilingual-analytics",
    expectedVerificationChecks: generatedChecks,
    expectedFixtureChecks: Object.freeze([
      "exact-generated-analytics-settings",
    ]),
    receipt: Object.freeze({ subject, evidenceRevision: revision }),
    createError,
    isCertificationError: (error) =>
      error instanceof AnalyticsCertificationError,
  });
}

function arraysEqual(left, right) {
  return (
    Array.isArray(left) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

async function runPortfolioCommand(
  runCommand,
  environment,
  projectRoot,
  arguments_,
  failureCode,
) {
  try {
    return await runCommand({
      executable: "pnpm",
      arguments: arguments_,
      cwd: projectRoot,
      environment,
      timeout: commandTimeoutMilliseconds,
    });
  } catch {
    throw createError(failureCode);
  }
}

function requireSafeProjectRoot(projectRoot) {
  if (
    typeof projectRoot !== "string" ||
    !isAbsolute(projectRoot) ||
    parse(projectRoot).root === projectRoot
  ) {
    throw createError("CERTIFICATION_PROJECT_ROOT_UNSAFE");
  }
}

export async function verifyAnalyticsPortfolioForTesting({
  projectRoot,
  runCommand,
  environment,
}) {
  requireSafeProjectRoot(projectRoot);
  if (
    typeof runCommand !== "function" ||
    environment === null ||
    typeof environment !== "object"
  ) {
    throw createError("CERTIFICATION_ADAPTER_INVALID");
  }

  const supportRoot = join(dirname(projectRoot), "analytics-portfolio-support");
  const home = join(supportRoot, "home");
  const browsers = join(supportRoot, "playwright-browsers");
  const cache = join(supportRoot, "cache");
  const temporary = join(supportRoot, "temporary");
  const store = join(supportRoot, "store");
  const userConfiguration = join(supportRoot, ".npmrc");

  try {
    await mkdir(home, { recursive: true, mode: 0o700 });
    await mkdir(browsers, { mode: 0o700 });
    await mkdir(cache, { mode: 0o700 });
    await mkdir(temporary, { mode: 0o700 });
    await mkdir(store, { mode: 0o700 });
    await writeFile(userConfiguration, "", { flag: "wx", mode: 0o600 });
  } catch {
    throw createError("CERTIFICATION_PROJECT_SETUP_FAILED");
  }

  const childEnvironment = createIsolatedProcessEnvironment({
    ...(typeof environment.PATH === "string" ? { PATH: environment.PATH } : {}),
    HOME: home,
    USERPROFILE: home,
    TMPDIR: temporary,
    TMP: temporary,
    TEMP: temporary,
    NPM_CONFIG_REGISTRY: publicRegistry,
    NPM_CONFIG_USERCONFIG: userConfiguration,
    PLAYWRIGHT_BROWSERS_PATH: browsers,
    XDG_CACHE_HOME: cache,
  });
  const version = await runPortfolioCommand(
    runCommand,
    childEnvironment,
    projectRoot,
    ["--version"],
    "PNPM_VERSION_INVALID",
  );
  if (typeof version !== "string" || version.trim() !== "11.20.0") {
    throw createError("PNPM_VERSION_INVALID");
  }

  const commands = [
    {
      arguments: ["install", "--frozen-lockfile", "--store-dir", store],
      failureCode: "FROZEN_INSTALL_FAILED",
    },
    { arguments: ["peers", "check"], failureCode: "PEER_DEPENDENCY_CHECK_FAILED" },
    {
      arguments: ["audit", "--audit-level", "moderate"],
      failureCode: "DEPENDENCY_AUDIT_FAILED",
    },
    {
      arguments: ["audit", "signatures"],
      failureCode: "REGISTRY_SIGNATURE_CHECK_FAILED",
    },
    { arguments: ["run", "lint"], failureCode: "LINT_FAILED" },
    {
      arguments: ["--dir", "apps/web", "run", "cf-typegen"],
      failureCode: "CLOUDFLARE_TYPE_GENERATION_FAILED",
    },
    { arguments: ["run", "typecheck"], failureCode: "TYPECHECK_FAILED" },
    { arguments: ["run", "test:unit"], failureCode: "UNIT_TESTS_FAILED" },
    {
      arguments: ["run", "test:component"],
      failureCode: "COMPONENT_TESTS_FAILED",
    },
    { arguments: ["run", "build"], failureCode: "NEXT_BUILD_FAILED" },
    {
      arguments: [
        "--dir",
        "apps/web",
        "exec",
        "opennextjs-cloudflare",
        "build",
        "--skipNextBuild",
      ],
      failureCode: "OPENNEXT_BUILD_FAILED",
    },
    {
      arguments: ["--dir", "apps/web", "run", "browser:install"],
      failureCode: "BROWSER_INSTALL_FAILED",
    },
    {
      arguments: ["--dir", "apps/web", "run", "test:e2e:dev"],
      failureCode: "BROWSER_DEVELOPMENT_FAILED",
    },
    {
      arguments: ["--dir", "apps/web", "run", "test:e2e:preview"],
      failureCode: "BROWSER_PREVIEW_FAILED",
    },
  ];

  for (const command of commands) {
    await runPortfolioCommand(
      runCommand,
      childEnvironment,
      projectRoot,
      command.arguments,
      command.failureCode,
    );
  }

  return Object.freeze({
    ok: true,
    fixtures: Object.freeze(["portfolio-analytics"]),
    profiles: Object.freeze(["portfolio"]),
    checks: generatedChecks,
  });
}

async function verifyGeneratedAnalyticsSettings({ projectRoot }) {
  let source;
  try {
    source = await readFile(join(projectRoot, analyticsSettingsPath), "utf8");
  } catch {
    throw createError("GENERATED_ANALYTICS_SETTINGS_INVALID");
  }

  if (
    !source.startsWith(analyticsSettingsPrefix) ||
    !source.endsWith(analyticsSettingsSuffix)
  ) {
    throw createError("GENERATED_ANALYTICS_SETTINGS_INVALID");
  }

  let settings;
  try {
    settings = JSON.parse(
      source.slice(
        analyticsSettingsPrefix.length,
        -analyticsSettingsSuffix.length,
      ),
    );
  } catch {
    throw createError("GENERATED_ANALYTICS_SETTINGS_INVALID");
  }
  if (!isDeepStrictEqual(settings, expectedAnalyticsSettings)) {
    throw createError("GENERATED_ANALYTICS_SETTINGS_INVALID");
  }

  return Object.freeze({
    ok: true,
    checks: Object.freeze(["exact-generated-analytics-settings"]),
  });
}

function expectedJourneyChecks() {
  return [
    ...baseFreshScaffoldChecks,
    ...generatedChecks,
    "exact-generated-analytics-settings",
  ];
}

function requireJourneyResult(configuration, result) {
  if (
    result?.ok !== true ||
    result.capability !== "analytics" ||
    result.version !== "0.1.0" ||
    result.profile !== configuration.profile ||
    result.subject?.descriptorVersion !== subject.descriptorVersion ||
    result.subject?.behaviorContractDigest !== subject.behaviorContractDigest ||
    result.evidenceRevision !== configuration.receipt.evidenceRevision ||
    !arraysEqual(result.checks, expectedJourneyChecks())
  ) {
    throw createError("CERTIFICATION_JOURNEY_INVALID");
  }
}

function requireAuthorityAdapters(adapters) {
  if (
    adapters === null ||
    typeof adapters !== "object" ||
    typeof adapters.readCurrentRevision !== "function" ||
    typeof adapters.readRepositoryStatus !== "function" ||
    typeof adapters.readRepositoryIndexEntries !== "function" ||
    typeof adapters.runLifecycleCommand !== "function" ||
    adapters.journeys?.portfolio === undefined ||
    adapters.journeys?.site === undefined
  ) {
    throw createError("CERTIFICATION_ADAPTER_INVALID");
  }
}

async function requireRevision(revision, adapters) {
  let current;
  try {
    current = await adapters.readCurrentRevision();
  } catch (error) {
    if (error instanceof AnalyticsCertificationError) throw error;
    throw createError("CERTIFICATION_REVISION_UNAVAILABLE");
  }
  if (current !== revision) {
    throw createError("CERTIFICATION_REVISION_MISMATCH");
  }
}

async function requireCleanRepository(adapters) {
  let status;
  let indexEntries;
  try {
    status = await adapters.readRepositoryStatus();
    indexEntries = await adapters.readRepositoryIndexEntries();
  } catch (error) {
    if (error instanceof AnalyticsCertificationError) throw error;
    throw createError("CERTIFICATION_WORKTREE_UNAVAILABLE");
  }

  if (typeof status !== "string" || typeof indexEntries !== "string") {
    throw createError("CERTIFICATION_WORKTREE_UNAVAILABLE");
  }
  if (status.length !== 0) {
    throw createError("CERTIFICATION_WORKTREE_DIRTY");
  }
  if (indexEntries.length === 0) return;

  const entries = indexEntries.split("\0");
  if (entries.at(-1) !== "") {
    throw createError("CERTIFICATION_WORKTREE_UNAVAILABLE");
  }
  entries.pop();
  for (const entry of entries) {
    if (entry.length < 3 || entry[1] !== " ") {
      throw createError("CERTIFICATION_WORKTREE_UNAVAILABLE");
    }
    if (entry[0] !== "H") {
      throw createError("CERTIFICATION_INDEX_FLAGS");
    }
  }
}

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function testNamePattern(tests) {
  return `^(?:${tests.map(escapeRegularExpression).join("|")})$`;
}

function hasExactPassedTests(stdout, expectedTests) {
  if (typeof stdout !== "string") return false;
  const observedTests = stdout
    .split("\n")
    .flatMap((line) =>
      line.startsWith("# Subtest: ") ? [line.slice("# Subtest: ".length)] : [],
    );
  const summaryCounts = new Map(
    stdout.split("\n").flatMap((line) => {
      const match = /^# (tests|pass|fail) ([0-9]+)$/u.exec(line);
      return match === null ? [] : [[match[1], Number(match[2])]];
    }),
  );
  const totalTests = summaryCounts.get("tests");
  return (
    arraysEqual(observedTests, expectedTests) &&
    stdout.includes(`\n1..${expectedTests.length}\n`) &&
    totalTests !== undefined &&
    totalTests >= expectedTests.length &&
    summaryCounts.get("pass") === totalTests &&
    summaryCounts.get("fail") === 0
  );
}

async function certifyLifecycle(adapters) {
  for (const group of lifecycleGroups) {
    try {
      const result = await adapters.runLifecycleCommand({
        executable: process.execPath,
        arguments: [
          "--test",
          "--test-reporter=tap",
          "--test-name-pattern",
          testNamePattern(group.tests),
          group.file,
        ],
        cwd: repositoryRoot,
        environment: createIsolatedProcessEnvironment(),
      });
      if (!hasExactPassedTests(result?.stdout, group.tests)) {
        throw new Error("invalid lifecycle evidence");
      }
    } catch {
      throw createError("CERTIFICATION_LIFECYCLE_EVIDENCE_FAILED");
    }
  }
  return lifecycleChecks;
}

async function certifyWithAuthority(input, adapters) {
  const revision = input?.revision;
  const configurations = profiles.map((profile) =>
    configurationFor(profile, revision),
  );
  requireAuthorityAdapters(adapters);
  await requireCleanRepository(adapters);
  await requireRevision(revision, adapters);

  const results = [];
  for (const configuration of configurations) {
    const result = await certifyFreshScaffoldForTesting(
      configuration,
      {
        ...adapters.journeys[configuration.profile],
        verifyFixture: verifyGeneratedAnalyticsSettings,
      },
    );
    requireJourneyResult(configuration, result);
    results.push(result);
  }
  const existingRepositoryChecks = await certifyLifecycle(adapters);

  await requireRevision(revision, adapters);
  await requireCleanRepository(adapters);
  return Object.freeze({
    ok: true,
    capability: "analytics",
    version: "0.1.0",
    profiles,
    subject,
    evidenceRevision: revision,
    outcomes: Object.freeze([
      "existing-repository-lifecycle",
      "fresh-scaffold",
    ]),
    providerRecordsClaimed: false,
    checks: Object.freeze([
      ...results.flatMap((result) =>
        result.checks.map((check) => `${result.profile}:${check}`),
      ),
      ...existingRepositoryChecks,
      "repository-sources-unchanged",
    ]),
  });
}

async function readCurrentRevision() {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["rev-parse", "--verify", "HEAD"],
      {
        cwd: repositoryRoot,
        env: createIsolatedProcessEnvironment(),
        timeout: 30_000,
        ...isolatedProcessOptions,
      },
    );
    const revision = stdout.trim();
    if (!exactRevisionPattern.test(revision)) throw new Error("invalid revision");
    return revision;
  } catch {
    throw createError("CERTIFICATION_REVISION_UNAVAILABLE");
  }
}

async function readRepositoryStatus() {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
      {
        cwd: repositoryRoot,
        env: createIsolatedProcessEnvironment(),
        timeout: 30_000,
        ...isolatedProcessOptions,
      },
    );
    return stdout;
  } catch {
    throw createError("CERTIFICATION_WORKTREE_UNAVAILABLE");
  }
}

async function readRepositoryIndexEntries() {
  try {
    const { stdout } = await execFileAsync("git", ["ls-files", "-v", "-z"], {
      cwd: repositoryRoot,
      env: createIsolatedProcessEnvironment(),
      timeout: 30_000,
      ...isolatedProcessOptions,
    });
    return stdout;
  } catch {
    throw createError("CERTIFICATION_WORKTREE_UNAVAILABLE");
  }
}

async function runProductionCommandWith(input, execute) {
  const isCompiledCreate =
    input.executable === process.execPath &&
    input.arguments[0] === cliEntry &&
    input.arguments[1] === "create";
  const { stdout } = await execute(input.executable, input.arguments, {
    cwd: input.cwd,
    env: input.environment,
    timeout:
      input.timeout ??
      (isCompiledCreate
        ? aggregateCreateTimeoutMilliseconds
        : commandTimeoutMilliseconds),
    ...isolatedProcessOptions,
  });
  return stdout;
}

async function runProductionCommand(input) {
  return runProductionCommandWith(input, execFileAsync);
}

export function runAnalyticsProductionCommandForTesting(input, execute) {
  return runProductionCommandWith(input, execute);
}

function productionJourneyAdapters() {
  return {
    portfolio: {
      runCommand: runProductionCommand,
      verifyProject: (root, identifier, expectedProjectName) => {
        if (
          identifier !== "portfolio-analytics" ||
          expectedProjectName !== "acme-portfolio-analytics"
        ) {
          throw createError("CERTIFICATION_JOURNEY_INVALID");
        }
        return verifyAnalyticsPortfolioForTesting({
          projectRoot: root,
          runCommand: runProductionCommand,
          environment: createIsolatedProcessEnvironment(),
        });
      },
    },
    site: {
      runCommand: runProductionCommand,
      verifyProject: verifyGeneratedProject,
    },
  };
}

function parseArguments(arguments_) {
  const normalizedArguments =
    arguments_[0] === "--" ? arguments_.slice(1) : arguments_;
  if (
    normalizedArguments.length === 2 &&
    normalizedArguments[0] === "--revision"
  ) {
    return { revision: normalizedArguments[1] };
  }
  return undefined;
}

export function certifyAnalyticsForTesting(input, adapters) {
  return certifyWithAuthority(input, adapters);
}

export function certifyAnalytics(input = {}) {
  const runLifecycleCommand = (command) =>
    execFileAsync(command.executable, command.arguments, {
      cwd: command.cwd,
      env: command.environment,
      timeout: lifecycleCommandTimeoutMilliseconds,
      ...isolatedProcessOptions,
    });
  return certifyWithAuthority(input, {
    readCurrentRevision,
    readRepositoryStatus,
    readRepositoryIndexEntries,
    runLifecycleCommand,
    journeys: productionJourneyAdapters(),
  });
}

await runCertificationCli({
  moduleUrl: import.meta.url,
  parseArguments,
  certify: certifyAnalytics,
  isCertificationError: (error) => error instanceof AnalyticsCertificationError,
});
