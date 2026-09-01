import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { certifyFreshScaffoldForTesting } from "./lib/certify-fresh-scaffold.mjs";
import { runCertificationCli } from "./lib/certification-cli.mjs";
import {
  createCertificationPreflight,
  createCertificationRepositoryReaders,
} from "./lib/certification-preflight.mjs";
import {
  createIsolatedProcessEnvironment,
  isolatedProcessOptions,
} from "./lib/isolated-process.mjs";
import { verifyGeneratedProject } from "./verify-generated-skeletons.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const exactRevisionPattern = /^[0-9a-f]{40}$/u;
const publicRegistry = "https://registry.npmjs.org/";
const commandTimeoutMilliseconds = 15 * 60 * 1000;
const lifecycleCommandTimeoutMilliseconds = 45 * 60 * 1000;
const profiles = Object.freeze(["portfolio", "site"]);
const subject = Object.freeze({
  descriptorVersion: "0.1.0",
  behaviorContractDigest:
    "sha256:016afd467349fde8ffeb821fe672cf60004f8e10916141c4f3837a81afcb1d41",
});
const commonCapabilities = Object.freeze([
  "standards",
  "content-files",
  "section-composition",
  "deployment-cloudflare",
  "observability",
]);
const fixedVerificationChecks = Object.freeze([
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
      "the compiled CLI preserves multilingual through both capability install orders and re-addition",
    ]),
  }),
  Object.freeze({
    file: "packages/builder-core/tests/apply-capability-addition.test.mjs",
    tests: Object.freeze([
      "Calendly addition accepts the planned multilingual booking-composition replacement",
      "multilingual addition applies the locale overlay and persists fresh discovery",
      "multilingual addition refuses installed, stale-plan, and drifted repositories without persistence",
      "multilingual addition retains inspectable transform and verification failure prefixes",
      "multilingual addition refuses changed final bytes after persistence",
    ]),
  }),
  Object.freeze({
    file: "packages/builder-core/tests/apply-capability-removal.test.mjs",
    tests: Object.freeze([
      "multilingual and Calendly removal preserve the other capability in both install orders",
      "multilingual removal preserves a modified locale catalog as an explicit ejection",
      "multilingual removal refuses absent, stale-plan, and drifted repositories without persistence",
      "multilingual removal retains inspectable transform and verification failure prefixes",
      "multilingual removal refuses changed final bytes after persistence",
    ]),
  }),
  Object.freeze({
    file: "packages/builder-core/tests/plan-capability-addition.test.mjs",
    tests: Object.freeze([
      "multilingual addition plans the exact locale overlay with or without Calendly",
      "multilingual addition plan refuses managed drift without writes",
    ]),
  }),
  Object.freeze({
    file: "packages/builder-core/tests/plan-capability-removal.test.mjs",
    tests: Object.freeze([
      "multilingual removal plan refuses absent state and managed drift without writes",
    ]),
  }),
]);
const lifecycleChecks = Object.freeze([
  "compiled-add-remove-re-add-both-profiles",
  "addition-fresh-inference-and-state-last",
  "removal-composition-ejection-and-state-last",
  "addition-drift-refusal",
  "removal-drift-refusal",
  "retained-failure-prefixes",
  "exact-final-byte-validation",
]);

export class MultilingualCertificationError extends Error {
  constructor(code) {
    super(`Multilingual certification failed: ${code}`);
    this.name = "MultilingualCertificationError";
    this.code = code;
  }
}

function createError(code) {
  return new MultilingualCertificationError(code);
}

const preflightErrorCodes = Object.freeze({
  adapterInvalid: "CERTIFICATION_ADAPTER_INVALID",
  revisionInvalid: "CERTIFICATION_REVISION_UNAVAILABLE",
  revisionUnavailable: "CERTIFICATION_REVISION_UNAVAILABLE",
  revisionMismatch: "CERTIFICATION_REVISION_MISMATCH",
  worktreeUnavailable: "CERTIFICATION_WORKTREE_UNAVAILABLE",
  worktreeDirty: "CERTIFICATION_WORKTREE_DIRTY",
  indexFlags: "CERTIFICATION_INDEX_FLAGS",
});
const repositoryReaders = createCertificationRepositoryReaders({
  repositoryRoot,
  revisionArguments: ["rev-parse", "--verify", "HEAD"],
  exactRevisionPattern,
  createError,
  isCertificationError: (error) => error instanceof MultilingualCertificationError,
  errorCodes: preflightErrorCodes,
});

function preflightFor(adapters) {
  return createCertificationPreflight({
    adapters,
    requiredAdapterFunctions: [
      "readCurrentRevision",
      "readRepositoryStatus",
      "readRepositoryIndexEntries",
      "runLifecycleCommand",
    ],
    createError,
    isCertificationError: (error) =>
      error instanceof MultilingualCertificationError,
    errorCodes: preflightErrorCodes,
  });
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
      ? "acme-portfolio-multilingual"
      : "acme-site-multilingual",
    displayName: isPortfolio
      ? "Acme Portfolio Multilingual"
      : "Acme Site Multilingual",
    createArguments: Object.freeze([
      "--multilingual",
      ...(isPortfolio
        ? [
            "--calendly-url",
            "https://calendly.com/example/intro",
            "--calendly-mode",
            "popup",
          ]
        : []),
    ]),
    expectedCapabilities: isPortfolio
      ? Object.freeze([
          ...commonCapabilities,
          "booking-calendly",
          "multilingual",
        ])
      : Object.freeze([...commonCapabilities, "site-routing", "multilingual"]),
    capabilityIdentifier: "multilingual",
    capabilityVersion: "0.1.0",
    expectedRecipeVersion: isPortfolio ? "0.10.0" : "0.11.0",
    verifierIdentifier: isPortfolio
      ? "portfolio-multilingual-calendly"
      : "site-multilingual",
    expectedVerificationChecks: fixedVerificationChecks,
    receipt: Object.freeze({
      subject,
      evidenceRevision: revision,
    }),
    createError,
    isCertificationError: (error) =>
      error instanceof MultilingualCertificationError,
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

export async function verifyMultilingualPortfolioForTesting({
  projectRoot,
  runCommand,
  environment,
}) {
  if (
    typeof projectRoot !== "string" ||
    typeof runCommand !== "function" ||
    environment === null ||
    typeof environment !== "object"
  ) {
    throw createError("CERTIFICATION_ADAPTER_INVALID");
  }

  const supportRoot = join(
    dirname(projectRoot),
    "multilingual-portfolio-support",
  );
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

  const childEnvironment = {
    ...environment,
    HOME: home,
    USERPROFILE: home,
    TMPDIR: temporary,
    TMP: temporary,
    TEMP: temporary,
    NPM_CONFIG_REGISTRY: publicRegistry,
    NPM_CONFIG_USERCONFIG: userConfiguration,
    PLAYWRIGHT_BROWSERS_PATH: browsers,
    XDG_CACHE_HOME: cache,
  };
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
    {
      arguments: ["peers", "check"],
      failureCode: "PEER_DEPENDENCY_CHECK_FAILED",
    },
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
    fixtures: Object.freeze(["portfolio-multilingual-calendly"]),
    profiles: Object.freeze(["portfolio"]),
    checks: fixedVerificationChecks,
  });
}

function expectedJourneyChecks() {
  return [...baseFreshScaffoldChecks, ...fixedVerificationChecks];
}

function requireJourneyResult(configuration, result) {
  if (
    result?.ok !== true ||
    result.capability !== "multilingual" ||
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

function requireAuthorityAdapters(adapters, preflight) {
  preflight.requireAdapters();
  if (
    adapters.journeys?.portfolio === undefined ||
    adapters.journeys?.site === undefined
  ) {
    throw createError("CERTIFICATION_ADAPTER_INVALID");
  }
}

async function requireCleanRepository(preflight) {
  const status = await preflight.readRepositoryStatus();
  const indexEntries = await preflight.readRepositoryIndexEntries();
  preflight.requireCleanStatus(status);
  preflight.requireOrdinaryIndexEntries(indexEntries);
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
  const preflight = preflightFor(adapters);
  requireAuthorityAdapters(adapters, preflight);
  await requireCleanRepository(preflight);
  await preflight.requireRevision(revision);

  const results = [];
  for (const configuration of configurations) {
    const result = await certifyFreshScaffoldForTesting(
      configuration,
      adapters.journeys[configuration.profile],
    );
    requireJourneyResult(configuration, result);
    results.push(result);
  }
  const existingRepositoryChecks = await certifyLifecycle(adapters);

  await preflight.requireRevision(revision);
  await requireCleanRepository(preflight);
  return Object.freeze({
    ok: true,
    capability: "multilingual",
    version: "0.1.0",
    profiles,
    subject,
    evidenceRevision: revision,
    outcomes: Object.freeze([
      "existing-repository-lifecycle",
      "fresh-scaffold",
    ]),
    checks: Object.freeze([
      ...results.flatMap((result) =>
        result.checks.map((check) => `${result.profile}:${check}`),
      ),
      ...existingRepositoryChecks,
      "repository-sources-unchanged",
    ]),
  });
}

async function runProductionCommand(input) {
  const { stdout } = await execFileAsync(input.executable, input.arguments, {
    cwd: input.cwd,
    env: input.environment,
    timeout: input.timeout ?? commandTimeoutMilliseconds,
    ...isolatedProcessOptions,
  });
  return stdout;
}

function productionJourneyAdapters() {
  return {
    portfolio: {
      runCommand: runProductionCommand,
      verifyProject: (root, identifier, expectedProjectName) => {
        if (
          identifier !== "portfolio-multilingual-calendly" ||
          expectedProjectName !== "acme-portfolio-multilingual"
        ) {
          throw createError("CERTIFICATION_JOURNEY_INVALID");
        }
        return verifyMultilingualPortfolioForTesting({
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

export function certifyMultilingualForTesting(input, adapters) {
  return certifyWithAuthority(input, adapters);
}

export function certifyMultilingual(input = {}) {
  const runLifecycleCommand = (command) =>
    execFileAsync(command.executable, command.arguments, {
      cwd: command.cwd,
      env: command.environment,
      timeout: lifecycleCommandTimeoutMilliseconds,
      ...isolatedProcessOptions,
    });
  return certifyWithAuthority(input, {
    ...repositoryReaders,
    runLifecycleCommand,
    journeys: productionJourneyAdapters(),
  });
}

await runCertificationCli({
  moduleUrl: import.meta.url,
  parseArguments,
  certify: certifyMultilingual,
  isCertificationError: (error) =>
    error instanceof MultilingualCertificationError,
});
