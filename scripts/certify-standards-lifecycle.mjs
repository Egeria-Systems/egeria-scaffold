import { execFile } from "node:child_process";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { runCertificationCli } from "./lib/certification-cli.mjs";
import {
  createCertificationPreflight,
  createCertificationRepositoryReaders,
} from "./lib/certification-preflight.mjs";
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

const createError = (code) => new StandardsLifecycleCertificationError(code);
const preflightErrorCodes = Object.freeze({
  adapterInvalid: "CERTIFICATION_ADAPTER_INVALID",
  revisionInvalid: "EVIDENCE_REVISION_INVALID",
  revisionUnavailable: "EVIDENCE_REVISION_UNAVAILABLE",
  revisionMismatch: "EVIDENCE_REVISION_MISMATCH",
  worktreeUnavailable: "EVIDENCE_WORKTREE_UNAVAILABLE",
  worktreeDirty: "EVIDENCE_WORKTREE_DIRTY",
});
const { readCurrentRevision, readRepositoryStatus } =
  createCertificationRepositoryReaders({
    repositoryRoot,
    revisionArguments: ["rev-parse", "HEAD"],
    exactRevisionPattern,
    createError,
    isCertificationError: (error) =>
      error instanceof StandardsLifecycleCertificationError,
    errorCodes: preflightErrorCodes,
  });

function preflightFor(adapters) {
  return createCertificationPreflight({
    adapters,
    requiredAdapterFunctions: [
      "readCurrentRevision",
      "readRepositoryStatus",
      "runCommand",
    ],
    createError,
    isCertificationError: (error) =>
      error instanceof StandardsLifecycleCertificationError,
    errorCodes: preflightErrorCodes,
  });
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

async function requireCleanRepository(preflight) {
  const status = await preflight.readRepositoryStatus();
  preflight.requireCleanStatus(status);
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
    observedTests.length === expectedTests.length &&
    observedTests.every((name, index) => name === expectedTests[index]) &&
    stdout.includes(`\n1..${expectedTests.length}\n`) &&
    totalTests !== undefined &&
    totalTests >= expectedTests.length &&
    summaryCounts.get("pass") === totalTests &&
    summaryCounts.get("fail") === 0
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
  const preflight = preflightFor(adapters);
  preflight.requireAdapters();
  const revision = input?.revision;
  if (!exactRevisionPattern.test(revision ?? "")) {
    fail("EVIDENCE_REVISION_INVALID");
  }

  await preflight.requireRevision(revision);
  await requireCleanRepository(preflight);
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
  await preflight.requireRevision(revision);
  await requireCleanRepository(preflight);

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
