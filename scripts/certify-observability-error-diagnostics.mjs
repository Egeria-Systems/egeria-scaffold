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
import { pathToFileURL, fileURLToPath } from "node:url";

import {
  certifyFreshScaffold,
  certifyFreshScaffoldForTesting,
} from "./lib/certify-fresh-scaffold.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
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
  "repository-sources-unchanged",
]);
const expectedBrowserCases = Object.freeze([
  "browser-error",
  "unhandled-rejection",
  "react-boundary",
  "selected-browser-catch",
  "duplicate-suppression",
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

function requireBrowserReceipt(receipt, revision) {
  if (
    receipt?.ok !== true ||
    receipt.capability !== "observability" ||
    receipt.version !== "0.3.0" ||
    JSON.stringify(receipt.subject) !== JSON.stringify(subject) ||
    receipt.revision !== revision ||
    JSON.stringify(receipt.cases) !== JSON.stringify(expectedBrowserCases) ||
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
    JSON.stringify(receipt.counts) !==
      JSON.stringify({
        cases: 5,
        captureInvocations: 6,
        acceptedOriginals: 5,
        syntheticApplicationRequests: 7,
        workersRecords: 5,
        betterStackRecords: 5,
        diagnosticDeliveryFailures: 0,
      })
  ) {
    throw createError("CERTIFICATION_FIXTURE_RECEIPT_INVALID");
  }
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
    requireBrowserReceipt(browserReceipt, revision);
    await requireSnapshotUnchanged(projectRoot, generatedSnapshot);
    await Promise.all(
      protectedRepositoryRoots.map((root, index) =>
        requireSnapshotUnchanged(root, protectedSnapshots[index]),
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

function parseArguments(arguments_) {
  if (arguments_.length === 2 && arguments_[0] === "--revision") {
    return { revision: arguments_[1] };
  }
  return undefined;
}

async function runMain() {
  const input = parseArguments(process.argv.slice(2));
  if (input === undefined) {
    process.stderr.write(
      `${JSON.stringify({
        ok: false,
        code: "CERTIFICATION_ARGUMENT_INVALID",
      })}\n`,
    );
    process.exitCode = 2;
    return;
  }

  try {
    const result = await certifyObservabilityErrorDiagnostics(input);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({
        ok: false,
        code:
          error instanceof ObservabilityErrorDiagnosticsCertificationError
            ? error.code
            : "CERTIFICATION_FAILED",
      })}\n`,
    );
    process.exitCode = 1;
  }
}

if (
  process.argv[1] !== undefined &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  await runMain();
}
