import { execFile } from "node:child_process";
import { constants, copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  certifyFreshScaffold,
  certifyFreshScaffoldForTesting,
} from "./lib/certify-fresh-scaffold.mjs";
import { runCertificationCli } from "./lib/certification-cli.mjs";
import {
  createIsolatedProcessEnvironment,
  isolatedProcessOptions,
} from "./lib/isolated-process.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const exactRevisionPattern = /^[0-9a-f]{40}$/u;
const publicRegistry = "https://registry.npmjs.org/";
const commandTimeoutMilliseconds = 15 * 60 * 1000;
const subject = Object.freeze({
  descriptorVersion: "0.3.0",
  behaviorContractDigest:
    "sha256:d716a1c93f8f40db33e54612c85d521fbd6ba13cd142d35ab0c39fa9c4b9647e",
});
const expectedCapabilities = Object.freeze([
  "standards",
  "content-files",
  "section-composition",
  "deployment-cloudflare",
  "observability",
  "site-routing",
]);
const expectedVerificationChecks = Object.freeze([
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
const expectedFixtureChecks = Object.freeze([
  "site-routing-fixture-overlay",
  "site-routing-fixture-frozen-install",
  "site-routing-fixture-unit-contract",
  "site-routing-fixture-browser-install",
  "site-routing-fixture-browser-development",
]);
const fixtureRoot = resolve(
  repositoryRoot,
  "tests/capability-certification/fixtures/site-routing",
);
const fixtureMappings = Object.freeze([
  Object.freeze({
    source: "site-routing-certification.test.tsx",
    destination: "apps/web/tests/unit/site-routing-certification.test.tsx",
  }),
  Object.freeze({
    source: "site-routing-certification.spec.ts",
    destination: "apps/web/tests/e2e/site-routing-certification.spec.ts",
  }),
]);

export class SiteRoutingCertificationError extends Error {
  constructor(code) {
    super(`Site routing certification failed: ${code}`);
    this.name = "SiteRoutingCertificationError";
    this.code = code;
  }
}

function createError(code) {
  return new SiteRoutingCertificationError(code);
}

function configurationFor(revision) {
  if (typeof revision !== "string" || !exactRevisionPattern.test(revision)) {
    throw createError("CERTIFICATION_REVISION_INVALID");
  }

  return Object.freeze({
    profile: "site",
    projectName: "acme-site",
    displayName: "Acme Site",
    createArguments: Object.freeze([]),
    expectedCapabilities,
    capabilityIdentifier: "site-routing",
    capabilityVersion: "0.3.0",
    expectedRecipeVersion: "0.10.0",
    verifierIdentifier: "site",
    expectedVerificationChecks,
    expectedFixtureChecks,
    receipt: Object.freeze({
      subject,
      recipeVersion: "0.10.0",
      locale: "en-CA",
      evidenceRevision: revision,
    }),
    createError,
    isCertificationError: (error) =>
      error instanceof SiteRoutingCertificationError,
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
    if (!exactRevisionPattern.test(revision)) {
      throw new Error("invalid revision");
    }
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

function authorityAdapters() {
  return {
    readCurrentRevision,
    readRepositoryStatus,
    readRepositoryIndexEntries,
  };
}

function requireAuthorityAdapters(adapters) {
  if (
    adapters === null ||
    typeof adapters !== "object" ||
    typeof adapters.readCurrentRevision !== "function" ||
    typeof adapters.readRepositoryStatus !== "function" ||
    typeof adapters.readRepositoryIndexEntries !== "function"
  ) {
    throw createError("CERTIFICATION_ADAPTER_INVALID");
  }
}

async function requireRevision(revision, adapters) {
  let current;
  try {
    current = await adapters.readCurrentRevision();
  } catch (error) {
    if (error instanceof SiteRoutingCertificationError) throw error;
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
    if (error instanceof SiteRoutingCertificationError) throw error;
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

async function verifySiteRoutingFixture({
  projectRoot,
  runCommand,
  environment,
}) {
  const supportRoot = join(dirname(projectRoot), "site-routing-fixture-support");
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
      "tests/unit/site-routing-certification.test.tsx",
    ],
    "CERTIFICATION_FIXTURE_UNIT_FAILED",
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
      "tests/e2e/site-routing-certification.spec.ts",
    ],
    "CERTIFICATION_FIXTURE_BROWSER_FAILED",
  );

  return Object.freeze({ ok: true, checks: expectedFixtureChecks });
}

export function verifySiteRoutingFixtureForTesting(input) {
  return verifySiteRoutingFixture(input);
}

function withSourceCheck(result) {
  return Object.freeze({
    ...result,
    checks: Object.freeze([...result.checks, "repository-sources-unchanged"]),
  });
}

async function certifyWithAuthority(input, adapters, certify) {
  const configuration = configurationFor(input?.revision);
  requireAuthorityAdapters(adapters);
  await requireCleanRepository(adapters);
  await requireRevision(input.revision, adapters);
  const result = await certify(configuration);
  await requireRevision(input.revision, adapters);
  await requireCleanRepository(adapters);
  return withSourceCheck(result);
}

export function certifySiteRouting(input = {}) {
  const adapters = authorityAdapters();
  return certifyWithAuthority(input, adapters, (configuration) =>
    certifyFreshScaffold(configuration, verifySiteRoutingFixture),
  );
}

export function certifySiteRoutingForTesting(input, adapters) {
  return certifyWithAuthority(input, adapters, (configuration) =>
    certifyFreshScaffoldForTesting(configuration, adapters),
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
  certify: certifySiteRouting,
  isCertificationError: (error) =>
    error instanceof SiteRoutingCertificationError,
});
