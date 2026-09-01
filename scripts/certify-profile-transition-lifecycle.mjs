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
  "^the compiled (?:profile-transition planner is repeatable and leaves portfolio controls and Git unchanged|profile-transition planner refuses an already-site project without mutation|profile-transition command emits its command-specific malformed-argument refusal|profile-transition planner refuses the finite unsafe matrix without mutation|apply-profile-transition command completes default and Calendly portfolio transactions|profile transition verification failure retains transformed source and old controls|apply-profile-transition command refuses representative unsafe inputs without mutation)$";
const compiledCliTests = Object.freeze([
  "the compiled profile-transition planner is repeatable and leaves portfolio controls and Git unchanged",
  "the compiled profile-transition planner refuses an already-site project without mutation",
  "the compiled profile-transition command emits its command-specific malformed-argument refusal",
  "the compiled profile-transition planner refuses the finite unsafe matrix without mutation",
  "the compiled apply-profile-transition command completes default and Calendly portfolio transactions",
  "the compiled profile transition verification failure retains transformed source and old controls",
  "the compiled apply-profile-transition command refuses representative unsafe inputs without mutation",
]);
const builderCorePattern =
  "^(?:portfolio-to-site profile transition |filesystem-backed portfolio-to-site transition )";
const builderCoreTests = Object.freeze([
  "portfolio-to-site profile transition refuses unsupported target inputs without mutation",
  "portfolio-to-site profile transition transforms, verifies, persists state last, and stops for final-diff approval",
  "portfolio-to-site profile transition preserves the optional Calendly capability and settings",
  "portfolio-to-site profile transition refuses malformed, wrong, and stale plan authority without mutation",
  "portfolio-to-site profile transition propagates named planner refusals without mutation",
  "portfolio-to-site profile transition refuses duplicate migration history before writing",
  "portfolio-to-site profile transition refuses unsafe Git and changed pre-write identity",
  "portfolio-to-site profile transition refuses an ignored create target before mutation",
  "portfolio-to-site profile transition contains reader, create-target, and preflight exceptions before writes",
  "portfolio-to-site profile transition distinguishes uncommitted and partial transform failures",
  "portfolio-to-site profile transition contains thrown writer exceptions at every persistence boundary",
  "portfolio-to-site profile transition retains transformed source and old controls on verification or re-inference failure",
  "portfolio-to-site profile transition contains a thrown verifier exception with the transformed prefix",
  "portfolio-to-site profile transition maps clock and migration persistence failures to the retained source prefix",
  "portfolio-to-site profile transition contains a thrown clock exception with the transformed prefix",
  "portfolio-to-site profile transition retains the migration prefix when its reread fails",
  "portfolio-to-site profile transition retains an uncertain committed migration append",
  "portfolio-to-site profile transition retains migration and old state when state persistence fails",
  "portfolio-to-site profile transition retains migration and old state on state construction failure",
  "portfolio-to-site profile transition retains an uncertain committed state replacement",
  "portfolio-to-site profile transition retains the complete persisted prefix when state reread fails",
  "portfolio-to-site profile transition retains the full persisted prefix on post-state disagreement",
  "portfolio-to-site profile transition retains the full prefix on post-state state and inference disagreement",
  "portfolio-to-site profile transition reports final Git and exact-byte failures after persistence",
  "filesystem-backed portfolio-to-site transition verifies binary baselines without an injected byte reader",
  "filesystem-backed portfolio-to-site transition rejects changed final binary bytes without an injected byte reader",
  "filesystem-backed portfolio-to-site transition rejects an ancestor swap during an exact-byte read",
]);
const lifecycleChecks = Object.freeze([
  "compiled-plan-repeatability",
  "compiled-apply-default",
  "compiled-apply-calendly",
  "already-current-refusal",
  "unsafe-and-malformed-refusal",
  "verification-failure-prefix",
  "transformation-failure-prefix",
  "verification-and-reinference-prefix",
  "migration-persistence-prefix",
  "state-persistence-prefix",
  "post-state-prefix",
  "final-diff-and-byte-inspection",
  "exact-resultant-state",
]);

export class ProfileTransitionLifecycleCertificationError extends Error {
  constructor(code) {
    super(`Profile transition lifecycle certification failed: ${code}`);
    this.name = "ProfileTransitionLifecycleCertificationError";
    this.code = code;
  }
}

function fail(code) {
  throw new ProfileTransitionLifecycleCertificationError(code);
}

const createError = (code) =>
  new ProfileTransitionLifecycleCertificationError(code);
const preflightErrorCodes = Object.freeze({
  adapterInvalid: "CERTIFICATION_ADAPTER_INVALID",
  revisionInvalid: "EVIDENCE_REVISION_INVALID",
  revisionUnavailable: "EVIDENCE_REVISION_UNAVAILABLE",
  revisionMismatch: "EVIDENCE_REVISION_MISMATCH",
  worktreeUnavailable: "EVIDENCE_WORKTREE_UNAVAILABLE",
  worktreeDirty: "EVIDENCE_WORKTREE_DIRTY",
  indexFlags: "EVIDENCE_WORKTREE_INDEX_FLAGS",
});
const repositoryReaders = createCertificationRepositoryReaders({
  repositoryRoot,
  revisionArguments: ["rev-parse", "HEAD"],
  exactRevisionPattern,
  createError,
  isCertificationError: (error) =>
    error instanceof ProfileTransitionLifecycleCertificationError,
  errorCodes: preflightErrorCodes,
});

function preflightFor(adapters) {
  return createCertificationPreflight({
    adapters,
    requiredAdapterFunctions: [
      "readCurrentRevision",
      "readRepositoryStatus",
      "readRepositoryIndexEntries",
      "runCommand",
    ],
    createError,
    isCertificationError: (error) =>
      error instanceof ProfileTransitionLifecycleCertificationError,
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
  return {
    ...repositoryReaders,
    runCommand,
  };
}

async function requireCleanRepository(preflight) {
  const status = await preflight.readRepositoryStatus();
  preflight.requireCleanStatus(status);
  const indexEntries = await preflight.readRepositoryIndexEntries();
  preflight.requireOrdinaryIndexEntries(indexEntries);
}

function hasExactPassedTests(stdout, expectedTests) {
  if (typeof stdout !== "string") return false;
  const lines = stdout.split("\n");
  const passedTopLevelTests = lines.flatMap((line) => {
    const match = /^ok [0-9]+ - (.+)$/u.exec(line);
    if (match === null || match[1].includes(" # SKIP") || match[1].includes(" # TODO")) {
      return [];
    }
    return [match[1]];
  });
  const summaryCounts = new Map(
    lines.flatMap((line) => {
      const match = /^# (tests|pass|fail|cancelled|todo) ([0-9]+)$/u.exec(line);
      return match === null ? [] : [[match[1], Number(match[2])]];
    }),
  );
  return (
    passedTopLevelTests.length === expectedTests.length &&
    passedTopLevelTests.every((name, index) => name === expectedTests[index]) &&
    summaryCounts.get("tests") >= expectedTests.length &&
    summaryCounts.get("pass") >= expectedTests.length &&
    summaryCounts.get("fail") === 0 &&
    (summaryCounts.get("cancelled") ?? 0) === 0 &&
    (summaryCounts.get("todo") ?? 0) === 0 &&
    !lines.some((line) => line.startsWith("not ok "))
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
    if (!hasExactPassedTests(result?.stdout, expectedTests)) {
      fail("LIFECYCLE_EVIDENCE_FAILED");
    }
  } catch {
    fail("LIFECYCLE_EVIDENCE_FAILED");
  }
}

export function certifyProfileTransitionLifecycle(input = {}) {
  return certifyProfileTransitionLifecycleForTesting(
    input,
    productionAdapters(),
  );
}

export async function certifyProfileTransitionLifecycleForTesting(
  input = {},
  adapters,
) {
  const preflight = preflightFor(adapters);
  preflight.requireAdapters();
  const revision = input?.revision;
  if (!exactRevisionPattern.test(revision ?? "")) {
    fail("EVIDENCE_REVISION_INVALID");
  }

  await preflight.requireRevision(revision);
  await requireCleanRepository(preflight);
  await runEvidenceCommand(
    adapters,
    [
      "--test",
      "--test-reporter=tap",
      "--test-name-pattern",
      compiledCliPattern,
      "apps/cli/tests/cli.test.mjs",
    ],
    compiledCliTests,
  );
  await runEvidenceCommand(
    adapters,
    [
      "--test",
      "--test-reporter=tap",
      "--test-name-pattern",
      builderCorePattern,
      "packages/builder-core/tests/apply-profile-transition.test.mjs",
    ],
    builderCoreTests,
  );
  await preflight.requireRevision(revision);
  await requireCleanRepository(preflight);

  return {
    ok: true,
    subject: "profile-transition-lifecycle",
    evidenceRevision: revision,
    transition: {
      fromProfile: "portfolio",
      fromRecipeVersion: "0.10.0",
      toProfile: "site",
      toRecipeVersion: "0.10.0",
    },
    migration: "transition-portfolio-0-10-0-to-site-0-10-0",
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
  certify: certifyProfileTransitionLifecycle,
  isCertificationError: (error) =>
    error instanceof ProfileTransitionLifecycleCertificationError,
});
