import { execFile } from "node:child_process";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { runCertificationCli } from "./lib/certification-cli.mjs";
import {
  createIsolatedProcessEnvironment,
  isolatedProcessOptions,
} from "./lib/isolated-process.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const exactRevisionPattern = /^[a-f0-9]{40}$/u;
const commandTimeoutMilliseconds = 30 * 60 * 1000;
const compiledCliPattern =
  "^the compiled (?:plan-upgrade command plans both profiles without changing any byte|apply-upgrade command completes the exact portfolio and site transactions|standards upgrade verification failure retains transformed source and old controls|plan-upgrade command refuses unsafe or unsupported repository states without writes|apply-upgrade command refuses the finite unsafe matrix without mutation)$";
const compiledCliTests = Object.freeze([
  "the compiled plan-upgrade command plans both profiles without changing any byte",
  "the compiled apply-upgrade command completes the exact portfolio and site transactions",
  "the compiled standards upgrade verification failure retains transformed source and old controls",
  "the compiled plan-upgrade command refuses unsafe or unsupported repository states without writes",
  "the compiled apply-upgrade command refuses the finite unsafe matrix without mutation",
]);
const builderCoreTests = Object.freeze([
  "standards capability upgrade refuses unsupported capability and target inputs without mutation",
  "standards capability upgrade transforms, verifies, persists state last, and stops for final-diff approval",
  "standards capability upgrade refuses malformed, wrong, and stale plan authority without mutation",
  "standards capability upgrade propagates named planner refusals without mutation",
  "standards capability upgrade refuses duplicate migration history before writing",
  "standards capability upgrade refuses unsafe Git and changed pre-write identity",
  "standards capability upgrade refuses an ignored create target before mutation",
  "standards capability upgrade contains reader, create-target, and preflight exceptions before writes",
  "standards capability upgrade distinguishes uncommitted and partial transform failures",
  "standards capability upgrade retains transformed source and old controls on verification or re-inference failure",
  "standards capability upgrade maps clock and migration persistence failures to the retained source prefix",
  "standards capability upgrade retains the migration prefix when its reread fails",
  "standards capability upgrade retains an uncertain committed migration append",
  "standards capability upgrade retains migration and old state on state construction failure",
  "standards capability upgrade retains migration and old state when state persistence fails",
  "standards capability upgrade retains an uncertain committed state replacement",
  "standards capability upgrade retains the full persisted prefix on post-state disagreement",
  "standards capability upgrade retains the full prefix on post-state state and inference disagreement",
  "standards capability upgrade reports final Git and exact-byte failures after persistence",
]);
const lifecycleChecks = Object.freeze([
  "compiled-plan-upgrade",
  "compiled-apply-upgrade",
  "already-current-refusal",
  "missing-edge-refusal",
  "verification-failure-prefix",
  "migration-before-state",
  "state-persistence-failure-prefix",
  "exact-final-state",
  "fresh-scaffold",
]);

export class StandardsLifecycleCertificationError extends Error {
  constructor(code) {
    super(`Standards lifecycle certification failed: ${code}`);
    this.name = "StandardsLifecycleCertificationError";
    this.code = code;
  }
}

function fail(code) {
  throw new StandardsLifecycleCertificationError(code);
}

async function readCurrentRevision() {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["rev-parse", "HEAD"],
      {
        cwd: repositoryRoot,
        env: createIsolatedProcessEnvironment(),
        timeout: 30_000,
        ...isolatedProcessOptions,
      },
    );
    const revision = stdout.trim();
    if (!exactRevisionPattern.test(revision)) fail("EVIDENCE_REVISION_INVALID");
    return revision;
  } catch (error) {
    if (error instanceof StandardsLifecycleCertificationError) throw error;
    fail("EVIDENCE_REVISION_UNAVAILABLE");
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
    fail("EVIDENCE_WORKTREE_UNAVAILABLE");
  }
}

async function runCommand(input) {
  return execFileAsync(input.executable, input.arguments, {
    cwd: input.cwd,
    env: input.environment,
    timeout: commandTimeoutMilliseconds,
    ...isolatedProcessOptions,
  });
}

function productionAdapters() {
  return { readCurrentRevision, readRepositoryStatus, runCommand };
}

function requireAdapters(adapters) {
  if (
    adapters === null ||
    typeof adapters !== "object" ||
    typeof adapters.readCurrentRevision !== "function" ||
    typeof adapters.readRepositoryStatus !== "function" ||
    typeof adapters.runCommand !== "function"
  ) {
    fail("CERTIFICATION_ADAPTER_INVALID");
  }
}

async function requireCleanRepository(adapters) {
  let status;
  try {
    status = await adapters.readRepositoryStatus();
  } catch (error) {
    if (error instanceof StandardsLifecycleCertificationError) throw error;
    fail("EVIDENCE_WORKTREE_UNAVAILABLE");
  }
  if (typeof status !== "string") fail("EVIDENCE_WORKTREE_UNAVAILABLE");
  if (status.length !== 0) fail("EVIDENCE_WORKTREE_DIRTY");
}

async function requireRevision(revision, adapters) {
  let current;
  try {
    current = await adapters.readCurrentRevision();
  } catch (error) {
    if (error instanceof StandardsLifecycleCertificationError) throw error;
    fail("EVIDENCE_REVISION_UNAVAILABLE");
  }
  if (current !== revision) fail("EVIDENCE_REVISION_MISMATCH");
}

function hasExactPassedTests(stdout, expectedTests) {
  if (typeof stdout !== "string") return false;
  const observedTests = stdout
    .split("\n")
    .flatMap((line) =>
      line.startsWith("# Subtest: ") ? [line.slice("# Subtest: ".length)] : [],
    );
  return (
    observedTests.length === expectedTests.length &&
    observedTests.every((name, index) => name === expectedTests[index]) &&
    stdout.includes(`\n1..${expectedTests.length}\n`) &&
    stdout.includes(`\n# tests ${expectedTests.length}\n`) &&
    stdout.includes(`\n# pass ${expectedTests.length}\n`) &&
    stdout.includes("\n# fail 0\n")
  );
}

async function runEvidenceCommand(adapters, arguments_, expectedTests) {
  try {
    const result = await adapters.runCommand({
      executable: process.execPath,
      arguments: [...arguments_],
      cwd: repositoryRoot,
      environment: createIsolatedProcessEnvironment(),
    });
    if (
      expectedTests !== undefined &&
      !hasExactPassedTests(result?.stdout, expectedTests)
    ) {
      fail("LIFECYCLE_EVIDENCE_FAILED");
    }
  } catch {
    fail("LIFECYCLE_EVIDENCE_FAILED");
  }
}

export function certifyStandardsLifecycle(input = {}) {
  return certifyStandardsLifecycleForTesting(input, productionAdapters());
}

export async function certifyStandardsLifecycleForTesting(input = {}, adapters) {
  requireAdapters(adapters);
  const revision = input?.revision;
  if (!exactRevisionPattern.test(revision ?? "")) {
    fail("EVIDENCE_REVISION_INVALID");
  }

  await requireRevision(revision, adapters);
  await requireCleanRepository(adapters);
  await runEvidenceCommand(adapters, [
    "--test",
    "--test-reporter=tap",
    "--test-name-pattern",
    compiledCliPattern,
    "apps/cli/tests/cli.test.mjs",
  ], compiledCliTests);
  await runEvidenceCommand(adapters, [
    "scripts/certify-generated-testing.mjs",
  ]);
  await runEvidenceCommand(adapters, [
    "--test",
    "--test-reporter=tap",
    "--test-name-pattern",
    "^standards capability upgrade ",
    "packages/builder-core/tests/apply-capability-upgrade.test.mjs",
  ], builderCoreTests);
  await requireRevision(revision, adapters);
  await requireCleanRepository(adapters);

  return {
    ok: true,
    capability: "standards",
    version: "0.4.0",
    evidenceRevision: revision,
    profiles: ["portfolio", "site"],
    checks: [...lifecycleChecks],
  };
}

function parseArguments(arguments_) {
  const normalized = arguments_[0] === "--" ? arguments_.slice(1) : arguments_;
  if (
    normalized.length === 2 &&
    normalized[0] === "--revision" &&
    exactRevisionPattern.test(normalized[1] ?? "")
  ) {
    return { revision: normalized[1] };
  }
  return undefined;
}

await runCertificationCli({
  moduleUrl: import.meta.url,
  parseArguments,
  certify: certifyStandardsLifecycle,
  isCertificationError: (error) =>
    error instanceof StandardsLifecycleCertificationError,
});
