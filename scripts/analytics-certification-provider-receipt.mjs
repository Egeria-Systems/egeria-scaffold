import { lstat, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const exactRepository = "Egeria-Systems/egeria-scaffold";
const exactHeadRef = "analytics-capability-certification";
const exactEnvironment = "analytics-certification";
const exactWorker = "analytics-certification";
const exactDigest =
  "sha256:ca2e69a35e935eab011f0543fdf140e644a0dec490650298bdfba730e2e9d378";
const exactRevisionPattern = /^[0-9a-f]{40}$/u;
const maximumInputBytes = 32 * 1024;

export class AnalyticsProviderReceiptError extends Error {
  constructor(code = "ANALYTICS_PROVIDER_EVIDENCE_INVALID") {
    super(`Analytics provider receipt failed: ${code}`);
    this.name = "AnalyticsProviderReceiptError";
    this.code = code;
  }
}

function reject() {
  throw new AnalyticsProviderReceiptError();
}

function hasExactKeys(value, keys) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function arraysEqual(left, right) {
  return (
    Array.isArray(left) &&
    left.length === right.length &&
    left.every((entry, index) => entry === right[index])
  );
}

function containsUnsafeContent(value) {
  if (typeof value === "string") {
    return /https?:\/\/|bearer\s|api[_-]?key|secret\s*=|token\s*=/iu.test(value);
  }
  if (Array.isArray(value)) return value.some(containsUnsafeContent);
  if (value === null || typeof value !== "object") return false;
  return Object.values(value).some(containsUnsafeContent);
}

function requireSharedEvidence(input) {
  if (
    !hasExactKeys(input, [
      "schemaVersion",
      "mode",
      "event",
      "pullRequest",
      "subject",
      "environment",
      "resources",
      "polling",
      "traffic",
      "checks",
      "disposition",
      "outcomes",
      "providerRecordsClaimed",
    ]) ||
    input.schemaVersion !== "1.0.0" ||
    !["exercise", "cleanup"].includes(input.mode) ||
    !hasExactKeys(input.event, ["name", "action", "label"]) ||
    input.event.name !== "pull_request" ||
    input.event.action !== "labeled" ||
    input.event.label !== `analytics-certification-${input.mode}` ||
    !hasExactKeys(input.pullRequest, [
      "baseRepository",
      "headRepository",
      "headRef",
      "headSha",
      "checkedOutSha",
    ]) ||
    input.pullRequest.baseRepository !== exactRepository ||
    input.pullRequest.headRepository !== exactRepository ||
    input.pullRequest.headRef !== exactHeadRef ||
    !exactRevisionPattern.test(input.pullRequest.headSha) ||
    input.pullRequest.checkedOutSha !== input.pullRequest.headSha ||
    !hasExactKeys(input.subject, [
      "identifier",
      "version",
      "behaviorContractDigest",
    ]) ||
    input.subject.identifier !== "analytics" ||
    input.subject.version !== "0.1.0" ||
    input.subject.behaviorContractDigest !== exactDigest ||
    input.environment !== exactEnvironment ||
    !hasExactKeys(input.polling, [
      "maxAttempts",
      "intervalSeconds",
      "attempts",
      "elapsedSeconds",
      "automaticRetries",
    ]) ||
    input.polling.maxAttempts !== 20 ||
    input.polling.intervalSeconds !== 15 ||
    !Number.isInteger(input.polling.attempts) ||
    input.polling.attempts < 1 ||
    input.polling.attempts > input.polling.maxAttempts ||
    !Number.isFinite(input.polling.elapsedSeconds) ||
    input.polling.elapsedSeconds < 0 ||
    input.polling.elapsedSeconds >
      input.polling.maxAttempts * input.polling.intervalSeconds ||
    input.polling.automaticRetries !== 0 ||
    !hasExactKeys(input.traffic, [
      "syntheticOnly",
      "realUserTraffic",
      "personalData",
      "boundedRequestEnvelopes",
      "unexpectedTraffic",
    ]) ||
    input.traffic.syntheticOnly !== true ||
    input.traffic.realUserTraffic !== false ||
    input.traffic.personalData !== false ||
    input.traffic.boundedRequestEnvelopes !== true ||
    input.traffic.unexpectedTraffic !== false ||
    input.providerRecordsClaimed !== false ||
    containsUnsafeContent(input)
  ) {
    reject();
  }
}

function requireResources(resources) {
  if (
    !hasExactKeys(resources, [
      "worker",
      "target",
      "httpsTargetValidated",
      "production",
      "cloudflareWebAnalytics",
    ]) ||
    resources.worker !== exactWorker ||
    resources.target !== "dedicated-non-production-workers-dev" ||
    resources.httpsTargetValidated !== true ||
    resources.production !== false ||
    !hasExactKeys(resources.cloudflareWebAnalytics, [
      "createdByRun",
      "autoInstall",
      "readbackVerified",
      "hostnameBound",
      "siteTokenBound",
      "scriptTokenBound",
    ]) ||
    resources.cloudflareWebAnalytics.createdByRun !== true ||
    resources.cloudflareWebAnalytics.autoInstall !== false ||
    resources.cloudflareWebAnalytics.readbackVerified !== true ||
    resources.cloudflareWebAnalytics.hostnameBound !== true ||
    resources.cloudflareWebAnalytics.siteTokenBound !== true ||
    resources.cloudflareWebAnalytics.scriptTokenBound !== true
  ) {
    reject();
  }
}

function requireExercise(input) {
  if (
    !hasExactKeys(input.checks, [
      "revisionVerified",
      "subjectVerified",
      "localInstallPassed",
      "localBuildPassed",
      "generatedCandidateVerified",
      "deploymentVerified",
      "consentJourneysPassed",
      "noRequestsBeforeGrant",
      "withdrawalReloadPassed",
    ]) ||
    Object.values(input.checks).some((value) => value !== true) ||
    !hasExactKeys(input.disposition, [
      "worker",
      "cloudflareWebAnalyticsSite",
      "operatorControlledProviders",
    ]) ||
    input.disposition.worker !== "retained-for-human-provider-confirmation" ||
    input.disposition.cloudflareWebAnalyticsSite !==
      "retained-for-human-provider-confirmation" ||
    input.disposition.operatorControlledProviders !==
      "pending-reviewed-cleanup" ||
    !arraysEqual(input.outcomes, ["deployed-application"])
  ) {
    reject();
  }
}

function requireCleanup(input) {
  if (
    !hasExactKeys(input.checks, [
      "revisionVerified",
      "subjectVerified",
      "resourceIdentityVerified",
      "compatibilityBaselineRecovered",
      "compatibilityBaselineVerified",
      "workerDeletionVerified",
      "webAnalyticsSiteDeletionVerified",
      "workerAbsenceVerified",
      "webAnalyticsSiteAbsenceVerified",
    ]) ||
    Object.values(input.checks).some((value) => value !== true) ||
    !hasExactKeys(input.disposition, [
      "worker",
      "cloudflareWebAnalyticsSite",
      "operatorControlledProviders",
    ]) ||
    input.disposition.worker !== "removed-and-absence-verified" ||
    input.disposition.cloudflareWebAnalyticsSite !==
      "removed-and-absence-verified" ||
    input.disposition.operatorControlledProviders !==
      "pending-reviewed-cleanup" ||
    !arraysEqual(input.outcomes, ["cleanup-recovery"])
  ) {
    reject();
  }
}

export function createAnalyticsCertificationProviderReceiptForTesting(input) {
  requireSharedEvidence(input);
  requireResources(input.resources);
  if (input.mode === "exercise") requireExercise(input);
  else requireCleanup(input);

  return Object.freeze({
    schemaVersion: "1.0.0",
    ok: true,
    mode: input.mode,
    subject: Object.freeze({ ...input.subject }),
    repository: exactRepository,
    headRef: exactHeadRef,
    headSha: input.pullRequest.headSha,
    environment: exactEnvironment,
    worker: exactWorker,
    outcomes: Object.freeze([...input.outcomes]),
    providerRecordsClaimed: false,
    providerConfirmation: "pending-human-evidence",
    resourceDisposition:
      input.mode === "exercise"
        ? "retained-for-human-provider-confirmation"
        : "removed-and-absence-verified",
    checks: Object.freeze(
      input.mode === "exercise"
        ? [
            "trusted-pull-request-head",
            "exact-subject",
            "dedicated-non-production-target",
            "manual-web-analytics-readback",
            "bounded-synthetic-traffic",
            "deployed-consent-journeys",
          ]
        : [
            "trusted-pull-request-head",
            "exact-subject",
            "task-resource-identity",
            "compatibility-baseline-recovery",
            "worker-absence",
            "web-analytics-site-absence",
          ],
    ),
  });
}

async function readEvidence(path) {
  const resolvedPath = resolve(path);
  let statistics;
  try {
    statistics = await lstat(resolvedPath);
  } catch {
    reject();
  }
  if (
    !statistics.isFile() ||
    statistics.isSymbolicLink() ||
    (statistics.mode & 0o077) !== 0 ||
    statistics.size < 2 ||
    statistics.size > maximumInputBytes
  ) {
    reject();
  }
  let value;
  try {
    value = JSON.parse(await readFile(resolvedPath, "utf8"));
  } catch {
    reject();
  }
  return value;
}

async function main() {
  const arguments_ = process.argv.slice(2);
  if (arguments_.length !== 2 || arguments_[0] !== "--input") reject();
  const evidence = await readEvidence(arguments_[1]);
  const receipt = createAnalyticsCertificationProviderReceiptForTesting(evidence);
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
}

if (process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    await main();
  } catch (error) {
    const code =
      error instanceof AnalyticsProviderReceiptError
        ? error.code
        : "ANALYTICS_PROVIDER_EVIDENCE_INVALID";
    process.stderr.write(`${JSON.stringify({ ok: false, code })}\n`);
    process.exitCode = 1;
  }
}
