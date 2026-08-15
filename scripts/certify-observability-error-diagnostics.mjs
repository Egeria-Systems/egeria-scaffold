import { execFile } from "node:child_process";
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
import { isDeepStrictEqual, promisify } from "node:util";

import {
  certifyFreshScaffold,
  certifyFreshScaffoldForTesting,
} from "./lib/certify-fresh-scaffold.mjs";
import { runCertificationCli } from "./lib/certification-cli.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const execFileAsync = promisify(execFile);
const exactRevisionPattern = /^[0-9a-f]{40}$/u;
const publicRegistry = "https://registry.npmjs.org/";
const commandTimeoutMilliseconds = 15 * 60 * 1000;
const subject = Object.freeze({
  descriptorVersion: "0.3.0",
  behaviorContractDigest:
    "sha256:24a3cb3361cd8f72a12a1926b512e087adb31ad120a62b70e06a68d9dcf90c99",
});
const expectedCapabilities = Object.freeze([
  "standards",
  "content-files",
  "section-composition",
  "deployment-cloudflare",
  "observability",
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

function configurationFor(revision) {
  if (typeof revision !== "string" || !exactRevisionPattern.test(revision)) {
    throw createError("CERTIFICATION_REVISION_INVALID");
  }
  return Object.freeze({
    profile: "portfolio",
    projectName: "acme-portfolio",
    displayName: "Acme Portfolio",
    createArguments: Object.freeze([]),
    expectedCapabilities,
    capabilityIdentifier: "observability",
    capabilityVersion: "0.3.0",
    expectedRecipeVersion: "0.8.0",
    verifierIdentifier: "portfolio",
    expectedFixtureChecks,
    receipt: Object.freeze({
      subject,
      recipeVersion: "0.8.0",
      evidenceRevision: revision,
      cleanup: "identity-checked",
    }),
    createError,
    isCertificationError: (error) =>
      error instanceof ObservabilityErrorDiagnosticsCertificationError,
  });
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

export function certifyObservabilityErrorDiagnostics(input) {
  const configuration = configurationFor(input?.revision);
  return certifyFreshScaffold(
    configuration,
    fixtureVerifierFor(input.revision),
  );
}

export function certifyObservabilityErrorDiagnosticsForTesting(
  input,
  adapters,
) {
  return certifyFreshScaffoldForTesting(
    configurationFor(input?.revision),
    adapters,
  );
}

async function readCurrentRevision() {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["rev-parse", "--verify", "HEAD"],
      { cwd: repositoryRoot, encoding: "utf8" },
    );
    const revision = stdout.trim();
    return exactRevisionPattern.test(revision) ? revision : undefined;
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
