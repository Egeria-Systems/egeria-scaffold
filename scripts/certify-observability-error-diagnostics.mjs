import { createHash } from "node:crypto";
import {
  constants,
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

import {
  certifyFreshScaffold,
  certifyFreshScaffoldForTesting,
} from "./lib/certify-fresh-scaffold.mjs";
import { runCertificationCli } from "./lib/certification-cli.mjs";
import {
  createCertificationSubject,
  createInstalledManifest,
  createCapabilityCatalogSnapshot,
  verifiedCapabilityPackageVersions,
  vitestFiveCapabilityCatalogSnapshot,
  profileRecipes,
  parseProjectYaml,
  resolveCapabilities,
} from "../packages/builder-core/dist/index.js";
import { generatedFixtureContracts } from "./verify-generated-skeletons.mjs";
import { requireAppRuntimeEvidence } from "./certify-app-local.mjs";
import { createCertificationPreflight, createCertificationRepositoryReaders } from "./lib/certification-preflight.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const exactRevisionPattern = /^[0-9a-f]{40}$/u;
const publicRegistry = "https://registry.npmjs.org/";
const commandTimeoutMilliseconds = 15 * 60 * 1000;
const subject = Object.freeze({
  descriptorVersion: "0.3.0",
  behaviorContractDigest:
    "sha256:0fa9530d9b2b6de0438cadd400a80909e8f55a5cb6c3d7b3ecc59724088c5f43",
});
const expectedVerificationChecks = Object.freeze([
  "pnpm-version", "frozen-install", "peer-dependencies", "dependency-audit",
  "registry-signatures", "lint", "cloudflare-types", "typecheck", "unit-tests",
  "component-tests", "next-build", "opennext-build", "browser-install",
  "browser-development", "browser-preview",
]);
const expectedFixtureChecks = Object.freeze([
  "certification-fixture-overlay",
  "certification-fixture-frozen-install",
  "certification-fixture-browser-install",
  "certification-fixture-browser-capture",
  "certification-fixture-server-capture",
  "certification-fixture-capture-semantics",
  "repository-sources-unchanged",
]);
const expectedBrowserCases = Object.freeze([
  "browser-error",
  "unhandled-rejection",
  "react-boundary",
  "selected-browser-catch",
  "duplicate-suppression",
]);
const expectedServerCases = Object.freeze([
  "next-request-error",
  "selected-server-catch",
  "diagnostic-failure-containment",
]);
const expectedLocalCases = Object.freeze([
  ...expectedBrowserCases,
  ...expectedServerCases,
]);
const expectedLocalChecks = Object.freeze([
  "generated-browser-error-unhandled",
  "generated-unhandled-rejection-unhandled",
  "generated-react-boundary-handled",
  "generated-selected-browser-catch-handled",
  "generated-duplicate-suppression",
  "browser-private-context-omitted",
  "generated-next-request-error",
  "generated-selected-server-catch-context",
  "generated-diagnostic-failure-containment",
]);
const fixtureRoot = resolve(
  repositoryRoot,
  "tests/capability-certification/fixtures/observability-error-diagnostics",
);
const fixtureMappings = Object.freeze([
  Object.freeze({
    source: "apps/web/app/certification/diagnostics/page.tsx",
    destination: "apps/web/app/certification/diagnostics/page.tsx",
  }),
  Object.freeze({
    source: "apps/web/app/api/certification/diagnostics/route.ts",
    destination: "apps/web/app/api/certification/diagnostics/route.ts",
  }),
  Object.freeze({
    source: "observability-error-diagnostics.spec.ts",
    destination:
      "apps/web/tests/e2e/observability-error-diagnostics.spec.ts",
  }),
]);
const protectedRepositoryRoots = Object.freeze([
  resolve(repositoryRoot, "packages/builder-core/templates"),
  resolve(repositoryRoot, "fixtures/generated"),
]);

export class ObservabilityErrorDiagnosticsCertificationError extends Error {
  constructor(code) {
    super(`Observability error diagnostics certification failed: ${code}`);
    this.name = "ObservabilityErrorDiagnosticsCertificationError";
    this.code = code;
  }
}

function createError(code) {
  return new ObservabilityErrorDiagnosticsCertificationError(code);
}

const isCertificationError = error => error instanceof ObservabilityErrorDiagnosticsCertificationError;
const errorCodes = Object.freeze({
  adapterInvalid: "CERTIFICATION_ADAPTER_INVALID",
  revisionInvalid: "CERTIFICATION_REVISION_UNAVAILABLE",
  revisionUnavailable: "CERTIFICATION_REVISION_UNAVAILABLE",
  revisionMismatch: "CERTIFICATION_REVISION_MISMATCH",
  worktreeUnavailable: "CERTIFICATION_WORKTREE_UNAVAILABLE",
  worktreeDirty: "CERTIFICATION_WORKTREE_DIRTY",
  indexFlags: "CERTIFICATION_INDEX_FLAGS",
});
const repositoryReaders = createCertificationRepositoryReaders({
  repositoryRoot, revisionArguments: ["rev-parse", "--verify", "HEAD"],
  exactRevisionPattern, createError, isCertificationError, errorCodes,
});

async function requireAuthority(preflight, revision) {
  await preflight.requireRevision(revision);
  preflight.requireCleanStatus(await preflight.readRepositoryStatus());
  preflight.requireOrdinaryIndexEntries(await preflight.readRepositoryIndexEntries());
}

function configurationFor(revision) {
  if (typeof revision !== "string" || !exactRevisionPattern.test(revision)) {
    throw createError("CERTIFICATION_REVISION_INVALID");
  }
  const catalog = createCapabilityCatalogSnapshot(
    verifiedCapabilityPackageVersions, vitestFiveCapabilityCatalogSnapshot,
  );
  const fixture = generatedFixtureContracts.find(({ identifier }) => identifier === "app");
  if (!catalog.ok || !fixture) throw createError("CERTIFICATION_SUBJECT_INVALID");
  const resolved = resolveCapabilities({ profile: "app", requestedCapabilities: [] }, catalog.value, profileRecipes);
  const descriptor = catalog.value.find(({ identifier }) => identifier === "observability");
  if (!resolved.ok || resolved.value.recipeVersion !== "0.2.0" || !descriptor ||
      !isDeepStrictEqual(createCertificationSubject(descriptor, ["cleanup-recovery", "deployed-application", "fresh-scaffold"]), subject)) {
    throw createError("CERTIFICATION_SUBJECT_INVALID");
  }
  const installed = createInstalledManifest(resolved.value);
  if (!isDeepStrictEqual(installed.map(({ identifier }) => identifier), fixture.expectedCapabilities)) {
    throw createError("CERTIFICATION_SUBJECT_INVALID");
  }
  return Object.freeze({
    profile: "app",
    projectName: fixture.projectName,
    displayName: fixture.displayName,
    createArguments: Object.freeze([]),
    expectedCapabilities: fixture.expectedCapabilities,
    expectedInstalledCapabilities: installed,
    expectedCapabilitySettings: fixture.expectedCapabilitySettings,
    capabilityIdentifier: "observability",
    capabilityVersion: "0.3.0",
    expectedRecipeVersion: "0.2.0",
    verifierIdentifier: "app",
    expectedVerificationChecks,
    expectedFixtureChecks,
    receipt: Object.freeze({
      subject,
      recipeVersion: "0.2.0",
      evidenceRevision: revision,
      cleanup: "identity-checked",
    }),
    createError,
    isCertificationError: (error) =>
      error instanceof ObservabilityErrorDiagnosticsCertificationError,
  });
}

export function validateObservabilityDeploymentCandidate(input) {
  try {
    const configuration = configurationFor(input.revision);
    const project = parseProjectYaml(input.projectSource);
    const state = input.infer?.result?.state;
    const capabilities = input.infer?.result?.capabilities;
    if (!project.ok || project.value.originProfile !== "app" || project.value.recipeVersion !== "0.2.0" ||
        project.value.project.name !== configuration.projectName || project.value.project.displayName !== configuration.displayName ||
        !isDeepStrictEqual(project.value.selectedCapabilities, configuration.expectedCapabilities) ||
        !isDeepStrictEqual(project.value.capabilitySettings, configuration.expectedCapabilitySettings) ||
        input.infer?.ok !== true || input.infer.command !== "infer" || state?.kind !== "valid" ||
        !isDeepStrictEqual(state.value?.origin, { profile: "app", recipeVersion: "0.2.0" }) ||
        !isDeepStrictEqual(state.value?.installedCapabilities, configuration.expectedInstalledCapabilities) ||
        !Array.isArray(capabilities) || !isDeepStrictEqual(capabilities.map(({ identifier }) => identifier).sort(), [...configuration.expectedCapabilities].sort()) ||
        capabilities.some(({ category }) => category !== "confirmed") ||
        input.doctor?.ok !== true || input.doctor.command !== "doctor" || input.doctor.result?.healthy !== true ||
        !isDeepStrictEqual(input.doctor.result?.diagnostics, []) ||
        input.diff?.ok !== true || input.diff.command !== "diff" || input.diff.result?.equal !== true ||
        !isDeepStrictEqual(input.diff.result?.differences, []) ||
        input.manifest?.dependencies?.effect !== "4.0.0-rc.112" ||
        input.manifest?.dependencies?.["@egeria-systems/observability"] !== "0.3.0") {
      throw createError("CERTIFICATION_CANDIDATE_INVALID");
    }
    return {
      ok: true, capability: "observability", version: "0.3.0", subject,
      profile: "app", recipeVersion: "0.2.0", revision: input.revision,
      checks: ["compiled-cli-create", "state-inference", "healthy-diagnostics", "exact-diff", "complete-installed-manifest", "current-app-subject"],
    };
  } catch (error) {
    if (isCertificationError(error)) throw error;
    throw createError("CERTIFICATION_CANDIDATE_INVALID");
  }
}

function fingerprint(content) {
  return createHash("sha256").update(content).digest("hex");
}

async function snapshotTree(root) {
  const rootStats = await lstat(root);
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
    throw createError("CERTIFICATION_SOURCE_INVALID");
  }
  const snapshot = [];

  async function visit(directory, relativeDirectory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    );
    for (const entry of entries) {
      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${entry.name}`
        : entry.name;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(path, relativePath);
      } else if (entry.isFile()) {
        snapshot.push(
          Object.freeze({
            path: relativePath,
            fingerprint: fingerprint(await readFile(path)),
          }),
        );
      } else {
        throw createError("CERTIFICATION_SOURCE_INVALID");
      }
    }
  }

  await visit(root, "");
  return Object.freeze(snapshot);
}

async function requireSnapshotUnchanged(root, snapshot) {
  for (const expected of snapshot) {
    let content;
    try {
      content = await readFile(join(root, expected.path));
    } catch {
      throw createError("CERTIFICATION_SOURCE_CHANGED");
    }
    if (fingerprint(content) !== expected.fingerprint) {
      throw createError("CERTIFICATION_SOURCE_CHANGED");
    }
  }
}

async function requireTreeIdentical(root, snapshot) {
  let current;
  try {
    current = await snapshotTree(root);
  } catch {
    throw createError("CERTIFICATION_SOURCE_CHANGED");
  }
  if (!isDeepStrictEqual(current, snapshot)) {
    throw createError("CERTIFICATION_SOURCE_CHANGED");
  }
}

export function snapshotTreeForTesting(root) {
  return snapshotTree(root);
}

export function requireTreeIdenticalForTesting(root, snapshot) {
  return requireTreeIdentical(root, snapshot);
}

async function copyCertificationFixtures(projectRoot) {
  for (const mapping of fixtureMappings) {
    const source = join(fixtureRoot, mapping.source);
    const destination = join(projectRoot, mapping.destination);
    await mkdir(dirname(destination), { recursive: true });
    try {
      await copyFile(source, destination, constants.COPYFILE_EXCL);
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
  code,
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
    throw createError(code);
  }
}

function requireLocalReceipt(receipt, revision) {
  if (
    receipt?.ok !== true ||
    receipt.capability !== "observability" ||
    receipt.version !== "0.3.0" ||
    !isDeepStrictEqual(receipt.subject, subject) ||
    receipt.revision !== revision ||
    receipt.scope !== "local-full" ||
    receipt.providerRecordsClaimed !== false ||
    !isDeepStrictEqual(receipt.cases, expectedLocalCases) ||
    !isDeepStrictEqual(receipt.checks, expectedLocalChecks) ||
    !Array.isArray(receipt.eventIdentifiers) ||
    receipt.eventIdentifiers.length !== 5 ||
    new Set(receipt.eventIdentifiers).size !== 5 ||
    receipt.eventIdentifiers.some(
      (identifier) =>
        typeof identifier !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
          identifier,
        ),
    ) ||
    !isDeepStrictEqual(receipt.counts, {
      cases: 8,
      captureInvocations: 9,
      acceptedOriginals: 8,
      syntheticApplicationRequests: 10,
      diagnosticDeliveryFailures: 1,
    })
  ) {
    throw createError("CERTIFICATION_FIXTURE_RECEIPT_INVALID");
  }
}

export function validateLocalFixtureReceiptForTesting(receipt, revision) {
  requireLocalReceipt(receipt, revision);
  return true;
}

function fixtureVerifierFor(revision) {
  return async ({ projectRoot, runCommand, environment }) => {
    const protectedSnapshots = await Promise.all(
      protectedRepositoryRoots.map((root) => snapshotTree(root)),
    );
    const generatedSnapshot = await snapshotTree(projectRoot);
    const supportRoot = join(dirname(projectRoot), "fixture-support");
    const home = join(supportRoot, "home");
    const browsers = join(supportRoot, "playwright-browsers");
    const cache = join(supportRoot, "cache");
    const temporary = join(supportRoot, "temporary");
    const store = join(supportRoot, "store");
    const userConfiguration = join(supportRoot, ".npmrc");
    const browserReceiptPath = join(supportRoot, "browser-receipt.json");

    await mkdir(home, { recursive: true, mode: 0o700 });
    await mkdir(browsers, { mode: 0o700 });
    await mkdir(cache, { mode: 0o700 });
    await mkdir(temporary, { mode: 0o700 });
    await mkdir(store, { mode: 0o700 });
    await writeFile(userConfiguration, "", { flag: "wx", mode: 0o600 });
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
      EXPECTED_REVISION: revision,
      OBSERVABILITY_DIAGNOSTICS_BROWSER_RECEIPT_PATH: browserReceiptPath,
      OBSERVABILITY_DIAGNOSTICS_SCOPE: "local-full",
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
        "tests/e2e/observability-error-diagnostics.spec.ts",
      ],
      "CERTIFICATION_FIXTURE_BROWSER_FAILED",
    );

    let browserReceipt;
    try {
      browserReceipt = JSON.parse(await readFile(browserReceiptPath, "utf8"));
    } catch {
      throw createError("CERTIFICATION_FIXTURE_RECEIPT_INVALID");
    }
    requireLocalReceipt(browserReceipt, revision);
    await requireSnapshotUnchanged(projectRoot, generatedSnapshot);
    await Promise.all(
      protectedRepositoryRoots.map((root, index) =>
        requireTreeIdentical(root, protectedSnapshots[index]),
      ),
    );

    return Object.freeze({ ok: true, checks: expectedFixtureChecks });
  };
}

async function certifyWithAuthority(input, adapters, runJourney) {
  if (input === null || typeof input !== "object" ||
      !isDeepStrictEqual(Object.keys(input), ["revision"])) {
    throw createError("CERTIFICATION_REVISION_INVALID");
  }
  const configuration = configurationFor(input.revision);
  const preflight = createCertificationPreflight({
    adapters,
    requiredAdapterFunctions: ["readCurrentRevision", "readRepositoryStatus", "readRepositoryIndexEntries"],
    createError, isCertificationError, errorCodes,
  });
  preflight.requireAdapters();
  await requireAuthority(preflight, input.revision);
  const result = await runJourney(configuration);
  try {
    requireAppRuntimeEvidence(result, "app");
  } catch {
    throw createError("CERTIFICATION_RUNTIME_EVIDENCE_INVALID");
  }
  await requireAuthority(preflight, input.revision);
  return result;
}

export function certifyObservabilityErrorDiagnostics(input) {
  return certifyWithAuthority(input, repositoryReaders,
    configuration => certifyFreshScaffold(configuration, fixtureVerifierFor(input.revision)));
}

export function certifyObservabilityErrorDiagnosticsForTesting(input, adapters) {
  return certifyWithAuthority(input, adapters,
    configuration => certifyFreshScaffoldForTesting(configuration, adapters));
}

async function readCurrentRevision() {
  try {
    return await repositoryReaders.readCurrentRevision();
  } catch {
    return undefined;
  }
}

async function parseArguments(arguments_, readHead = readCurrentRevision) {
  if (arguments_.length === 0) {
    const revision = await readHead();
    return revision === undefined ? undefined : { revision };
  }
  if (arguments_.length === 2 && arguments_[0] === "--revision") {
    const revision =
      arguments_[1] === "HEAD" ? await readHead() : arguments_[1];
    return revision === undefined ? undefined : { revision };
  }
  return undefined;
}

export function parseArgumentsForTesting(arguments_, readHead) {
  return parseArguments(arguments_, readHead);
}

await runCertificationCli({
  moduleUrl: import.meta.url,
  parseArguments,
  certify: certifyObservabilityErrorDiagnostics,
  isCertificationError: (error) =>
    error instanceof ObservabilityErrorDiagnosticsCertificationError,
});
