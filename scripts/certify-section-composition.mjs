import { constants, copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  certifyFreshScaffold,
  certifyFreshScaffoldForTesting,
} from "./lib/certify-fresh-scaffold.mjs";
import { runCertificationCli } from "./lib/certification-cli.mjs";
import {
  createCertificationPreflight,
  createCertificationRepositoryReaders,
} from "./lib/certification-preflight.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const exactRevisionPattern = /^[0-9a-f]{40}$/u;
const publicRegistry = "https://registry.npmjs.org/";
const commandTimeoutMilliseconds = 15 * 60 * 1000;
const subject = Object.freeze({
  descriptorVersion: "0.3.0",
  behaviorContractDigest:
    "sha256:4f63f9d6169048b5a1f5b1d042b3a0ddaa22ca1273d1acadf6235ce93e616696",
});
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
const fixtureChecks = Object.freeze([
  "section-composition-fixture-overlay",
  "section-composition-fixture-frozen-install",
  "section-composition-fixture-unit-contract",
  "section-composition-fixture-component-contract",
  "section-composition-fixture-browser-install",
  "section-composition-fixture-browser-development",
]);
const baseFreshScaffoldChecks = Object.freeze([
  "compiled-cli-create",
  "state-inference",
  "healthy-diagnostics",
  "exact-diff",
]);
const commonCapabilities = Object.freeze([
  "standards",
  "content-files",
  "section-composition",
  "deployment-cloudflare",
  "observability",
]);
const profiles = Object.freeze(["portfolio", "site"]);
const fixtureRoot = resolve(
  repositoryRoot,
  "tests/capability-certification/fixtures/section-composition",
);
const fixtureMappings = Object.freeze([
  Object.freeze({
    source: "section-composition-certification.test.ts",
    destination:
      "apps/web/tests/unit/section-composition-certification.test.ts",
  }),
  Object.freeze({
    source: "section-composition-certification.test.tsx",
    destination:
      "apps/web/tests/component/section-composition-certification.test.tsx",
  }),
  Object.freeze({
    source: "section-composition-certification.spec.ts",
    destination:
      "apps/web/tests/e2e/section-composition-certification.spec.ts",
  }),
]);

export class SectionCompositionCertificationError extends Error {
  constructor(code) {
    super(`Section composition certification failed: ${code}`);
    this.name = "SectionCompositionCertificationError";
    this.code = code;
  }
}

function createError(code) {
  return new SectionCompositionCertificationError(code);
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
  isCertificationError: (error) =>
    error instanceof SectionCompositionCertificationError,
  errorCodes: preflightErrorCodes,
});

function preflightFor(adapters) {
  return createCertificationPreflight({
    adapters,
    requiredAdapterFunctions: [
      "readCurrentRevision",
      "readRepositoryStatus",
      "readRepositoryIndexEntries",
    ],
    createError,
    isCertificationError: (error) =>
      error instanceof SectionCompositionCertificationError,
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
    projectName: isPortfolio ? "acme-portfolio" : "acme-site",
    displayName: isPortfolio ? "Acme Portfolio" : "Acme Site",
    createArguments: Object.freeze([]),
    expectedCapabilities: isPortfolio
      ? commonCapabilities
      : Object.freeze([...commonCapabilities, "site-routing"]),
    capabilityIdentifier: "section-composition",
    capabilityVersion: "0.3.0",
    expectedRecipeVersion: "0.10.0",
    verifierIdentifier: profile,
    expectedVerificationChecks: fixedVerificationChecks,
    ...(isPortfolio ? { expectedFixtureChecks: fixtureChecks } : {}),
    receipt: Object.freeze({
      subject,
      recipeVersion: "0.10.0",
      locale: "en-CA",
      evidenceRevision: revision,
    }),
    createError,
    isCertificationError: (error) =>
      error instanceof SectionCompositionCertificationError,
  });
}

function authorityAdapters() {
  return { ...repositoryReaders };
}

async function requireCleanRepository(preflight) {
  const status = await preflight.readRepositoryStatus();
  const indexEntries = await preflight.readRepositoryIndexEntries();
  preflight.requireCleanStatus(status);
  preflight.requireOrdinaryIndexEntries(indexEntries);
}

function arraysEqual(left, right) {
  return (
    Array.isArray(left) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function expectedChecksFor(configuration) {
  return [
    ...baseFreshScaffoldChecks,
    ...fixedVerificationChecks,
    ...(configuration.expectedFixtureChecks ?? []),
  ];
}

function requireJourneyResult(configuration, result) {
  if (
    result?.ok !== true ||
    result.capability !== "section-composition" ||
    result.version !== "0.3.0" ||
    result.profile !== configuration.profile ||
    result.subject?.descriptorVersion !== subject.descriptorVersion ||
    result.subject?.behaviorContractDigest !== subject.behaviorContractDigest ||
    result.recipeVersion !== "0.10.0" ||
    result.locale !== "en-CA" ||
    result.evidenceRevision !== configuration.receipt.evidenceRevision ||
    !arraysEqual(result.checks, expectedChecksFor(configuration))
  ) {
    throw createError("CERTIFICATION_JOURNEY_INVALID");
  }
}

async function copyCertificationFixtures(projectRoot) {
  for (const mapping of fixtureMappings) {
    const destination = join(projectRoot, mapping.destination);
    try {
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(
        join(fixtureRoot, mapping.source),
        destination,
        constants.COPYFILE_EXCL,
      );
    } catch {
      throw createError("CERTIFICATION_FIXTURE_OVERLAY_FAILED");
    }
  }
}

async function runProjectCommand(
  runCommand,
  environment,
  projectRoot,
  arguments_,
  failureCode,
) {
  try {
    await runCommand({
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

async function verifySectionCompositionFixture({
  projectRoot,
  runCommand,
  environment,
}) {
  const supportRoot = join(
    dirname(projectRoot),
    "section-composition-fixture-support",
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
    throw createError("CERTIFICATION_FIXTURE_OVERLAY_FAILED");
  }
  await copyCertificationFixtures(projectRoot);

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

  await runProjectCommand(
    runCommand,
    childEnvironment,
    projectRoot,
    ["install", "--frozen-lockfile", "--store-dir", store],
    "CERTIFICATION_FIXTURE_INSTALL_FAILED",
  );
  await runProjectCommand(
    runCommand,
    childEnvironment,
    projectRoot,
    [
      "--dir",
      "apps/web",
      "exec",
      "vitest",
      "run",
      "--project",
      "unit",
      "tests/unit/section-composition-certification.test.ts",
    ],
    "CERTIFICATION_FIXTURE_UNIT_FAILED",
  );
  await runProjectCommand(
    runCommand,
    childEnvironment,
    projectRoot,
    [
      "--dir",
      "apps/web",
      "exec",
      "vitest",
      "run",
      "--project",
      "component",
      "tests/component/section-composition-certification.test.tsx",
    ],
    "CERTIFICATION_FIXTURE_COMPONENT_FAILED",
  );
  await runProjectCommand(
    runCommand,
    childEnvironment,
    projectRoot,
    ["--dir", "apps/web", "run", "browser:install"],
    "CERTIFICATION_FIXTURE_BROWSER_INSTALL_FAILED",
  );
  await runProjectCommand(
    runCommand,
    childEnvironment,
    projectRoot,
    [
      "--dir",
      "apps/web",
      "exec",
      "playwright",
      "test",
      "--config",
      "playwright.dev.config.ts",
      "tests/e2e/section-composition-certification.spec.ts",
    ],
    "CERTIFICATION_FIXTURE_BROWSER_FAILED",
  );

  return Object.freeze({ ok: true, checks: fixtureChecks });
}

export function verifySectionCompositionFixtureForTesting(input) {
  return verifySectionCompositionFixture(input);
}

async function certifyWithAuthority(input, adapters, runJourney) {
  const revision = input?.revision;
  const configurations = profiles.map((profile) =>
    configurationFor(profile, revision),
  );
  const preflight = preflightFor(adapters);
  preflight.requireAdapters();
  await requireCleanRepository(preflight);
  await preflight.requireRevision(revision);

  const results = [];
  for (const configuration of configurations) {
    const result = await runJourney(configuration);
    requireJourneyResult(configuration, result);
    results.push(result);
  }

  await preflight.requireRevision(revision);
  await requireCleanRepository(preflight);
  return Object.freeze({
    ok: true,
    capability: "section-composition",
    version: "0.3.0",
    profiles,
    subject,
    recipeVersion: "0.10.0",
    locale: "en-CA",
    evidenceRevision: revision,
    checks: Object.freeze([
      ...results.flatMap((result) =>
        result.checks.map((check) => `${result.profile}:${check}`),
      ),
      "repository-sources-unchanged",
    ]),
  });
}

export function certifySectionComposition(input = {}) {
  return certifyWithAuthority(
    input,
    authorityAdapters(),
    (configuration) =>
      certifyFreshScaffold(
        configuration,
        configuration.profile === "portfolio"
          ? verifySectionCompositionFixture
          : undefined,
      ),
  );
}

export function certifySectionCompositionForTesting(input, adapters) {
  if (
    adapters?.journeys?.portfolio === undefined ||
    adapters?.journeys?.site === undefined
  ) {
    throw createError("CERTIFICATION_ADAPTER_INVALID");
  }
  return certifyWithAuthority(input, adapters, (configuration) =>
    certifyFreshScaffoldForTesting(
      configuration,
      adapters.journeys[configuration.profile],
    ),
  );
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

await runCertificationCli({
  moduleUrl: import.meta.url,
  parseArguments,
  certify: certifySectionComposition,
  isCertificationError: (error) =>
    error instanceof SectionCompositionCertificationError,
});
