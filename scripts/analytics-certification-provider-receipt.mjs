import { lstat, readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { requireAppRuntimeEvidence } from "./certify-app-local.mjs";

const exactRepository = "Egeria-Systems/egeria-scaffold";
const exactHeadRef = "refs/heads/main";
const exactEnvironment = "integration-test-deploy";
const exactWorker = "integration-test-deploy";
const exactDigest =
  "sha256:6c562317c6888a0c4a1b14bb2d7320f309b7c6ac3927a4b94cb3e9365ae01bba";
const exactRevisionPattern = /^[0-9a-f]{40}$/u;
const exactDedicatedHostnamePattern =
  /^integration-test-deploy\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.workers\.dev$/u;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const sha256HexPattern = /^[0-9a-f]{64}$/u;
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

function isBoundedIdentifier(value) {
  return (
    typeof value === "string" &&
    value.length >= 8 &&
    value.length <= 128 &&
    /^[A-Za-z0-9_-]+$/u.test(value)
  );
}

function requireCleanupContext(context) {
  if (
    !hasExactKeys(context, ["headSha", "environment", "hostname", "worker"]) ||
    !exactRevisionPattern.test(context.headSha) ||
    context.environment !== exactEnvironment ||
    !exactDedicatedHostnamePattern.test(context.hostname) ||
    context.worker !== exactWorker
  ) {
    reject();
  }
}

function requireSiteIdentity(identity, context) {
  if (
    !hasExactKeys(identity, [
      "headSha",
      "environment",
      "hostname",
      "identityKnown",
      "site",
    ]) ||
    identity.headSha !== context.headSha ||
    identity.environment !== context.environment ||
    identity.hostname !== context.hostname ||
    typeof identity.identityKnown !== "boolean"
  ) {
    reject();
  }
  if (identity.identityKnown === false) {
    if (identity.site !== null) reject();
    return;
  }
  if (
    !hasExactKeys(identity.site, [
      "siteTag",
      "siteTokenSha256",
      "autoInstall",
    ]) ||
    !isBoundedIdentifier(identity.site.siteTag) ||
    !sha256HexPattern.test(identity.site.siteTokenSha256) ||
    identity.site.autoInstall !== false
  ) {
    reject();
  }
}

function requireWorkerIdentity(identity, context) {
  if (
    !hasExactKeys(identity, [
      "headSha",
      "environment",
      "hostname",
      "identityKnown",
      "worker",
    ]) ||
    identity.headSha !== context.headSha ||
    identity.environment !== context.environment ||
    identity.hostname !== context.hostname ||
    typeof identity.identityKnown !== "boolean"
  ) {
    reject();
  }
  if (identity.identityKnown === false) {
    if (identity.worker !== null) reject();
    return;
  }
  if (
    !hasExactKeys(identity.worker, ["name", "deploymentId", "versionId"]) ||
    identity.worker.name !== exactWorker ||
    !uuidPattern.test(identity.worker.deploymentId) ||
    !uuidPattern.test(identity.worker.versionId)
  ) {
    reject();
  }
}

export function prepareAnalyticsCertificationReuse({ context, siteIdentity, workerIdentity, headSha }) {
  requireCleanupContext(context);
  requireSiteIdentity(siteIdentity, context);
  requireWorkerIdentity(workerIdentity, context);
  if (!exactRevisionPattern.test(headSha) || headSha === context.headSha) reject();
  return {
    siteIdentity: { ...siteIdentity, headSha },
    workerIdentity: { ...workerIdentity, headSha },
  };
}

export async function readAnalyticsCertificationSite(controlPlaneFetch, endpoint, headers, hostname, siteTag = null) {
  if (siteTag !== null) {
    const response = await controlPlaneFetch(`${endpoint}/${encodeURIComponent(siteTag)}`, { headers });
    if (response.status !== 404) {
      const payload = await response.json();
      if (!response.ok || payload?.success !== true || typeof payload.result?.site_token !== "string") reject();
      return payload.result;
    }
  }
  const response = await controlPlaneFetch(`${endpoint}/list?page=1&per_page=100`, { headers });
  const payload = await response.json();
  // Absence requires a complete listing. A bounded incomplete page is not evidence.
  if (!response.ok || payload?.success !== true || !Array.isArray(payload.result) ||
    payload.result.length > 100 || payload.result_info?.page !== 1 ||
    payload.result_info?.total_count !== payload.result.length ||
    (payload.result_info?.total_pages !== undefined && ![0, 1].includes(payload.result_info.total_pages))) {
    const boundedInteger = (value) =>
      Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000 ? value : null;
    const error = new AnalyticsProviderReceiptError();
    // Uncaught workflow errors may expose diagnostics, never provider text or identifiers.
    error.diagnostics = {
      httpStatus: boundedInteger(response.status),
      apiSuccess: payload?.success === true,
      apiErrorCodes: Array.isArray(payload?.errors)
        ? payload.errors.slice(0, 10).map((entry) => boundedInteger(entry?.code)).filter((code) => code !== null)
        : [],
      resultCount: Array.isArray(payload?.result) ? boundedInteger(payload.result.length) : null,
      page: boundedInteger(payload?.result_info?.page),
      totalCount: boundedInteger(payload?.result_info?.total_count),
      totalPages: boundedInteger(payload?.result_info?.total_pages),
    };
    throw error;
  }
  const matches = payload.result.filter((site) => site?.host === hostname);
  if (matches.length > 1 || (matches.length === 1 && typeof matches[0].site_token !== "string")) reject();
  return matches[0] ?? null;
}

export async function readAnalyticsCertificationWorker(controlPlaneFetch, endpoint, headers) {
  const response = await controlPlaneFetch(endpoint, { headers });
  if (response.status === 404) return null;
  if (!response.ok) reject();
  const deploymentsResponse = await controlPlaneFetch(`${endpoint}/deployments`, { headers });
  const payload = await deploymentsResponse.json();
  const deployments = Array.isArray(payload?.result) ? payload.result : payload?.result?.deployments;
  if (!deploymentsResponse.ok || payload?.success !== true || !Array.isArray(deployments) || deployments.length < 1 || deployments.length > 100) reject();
  const timestamp = (deployment) => Date.parse(deployment?.created_on);
  if (deployments.some((deployment) => !Number.isFinite(timestamp(deployment)))) reject();
  const latestTime = Math.max(...deployments.map(timestamp));
  const latest = deployments.filter((deployment) => timestamp(deployment) === latestTime);
  if (latest.length !== 1 || latest[0].versions?.length !== 1 || latest[0].versions[0]?.percentage !== 100) reject();
  const { id: deploymentId, versions: [{ version_id: versionId }] } = latest[0];
  if (!uuidPattern.test(deploymentId) || !uuidPattern.test(versionId)) reject();
  return { name: exactWorker, deploymentId, versionId };
}

export function planAnalyticsCertificationCleanup({
  context,
  siteIdentity,
  workerIdentity,
  currentSite,
  currentWorker,
} = {}) {
  requireCleanupContext(context);
  requireSiteIdentity(siteIdentity, context);
  requireWorkerIdentity(workerIdentity, context);

  if (currentSite !== null) {
    if (
      siteIdentity.identityKnown !== true ||
      !hasExactKeys(currentSite, [
        "hostname",
        "siteTag",
        "siteTokenSha256",
        "autoInstall",
      ]) ||
      currentSite.hostname !== context.hostname ||
      currentSite.siteTag !== siteIdentity.site.siteTag ||
      currentSite.siteTokenSha256 !== siteIdentity.site.siteTokenSha256 ||
      currentSite.autoInstall !== false
    ) {
      reject();
    }
  }

  if (currentWorker !== null) {
    if (
      workerIdentity.identityKnown !== true ||
      !hasExactKeys(currentWorker, ["name", "deploymentId", "versionId"]) ||
      currentWorker.name !== exactWorker ||
      currentWorker.deploymentId !== workerIdentity.worker.deploymentId ||
      currentWorker.versionId !== workerIdentity.worker.versionId
    ) {
      reject();
    }
  }

  return Object.freeze({
    disableWorker: currentWorker !== null,
    siteInitialState: currentSite === null ? "absent" : "present",
    workerInitialState: currentWorker === null ? "absent" : "present",
  });
}

function containsUnsafeContent(value) {
  if (typeof value === "string") {
    return /https?:\/\/|bearer\s|api[_-]?key|secret\s*=|token\s*=/iu.test(value);
  }
  if (Array.isArray(value)) return value.some(containsUnsafeContent);
  if (value === null || typeof value !== "object") return false;
  return Object.values(value).some(containsUnsafeContent);
}

function requireMeasuredContext(context) {
  if (
    !hasExactKeys(context, [
      "schemaVersion",
      "mode",
      "event",
      "source",
      "subject",
      "environment",
      "resources",
    ]) ||
    context.schemaVersion !== "2.0.0" ||
    !["exercise", "cleanup"].includes(context.mode) ||
    !hasExactKeys(context.event, ["name"]) ||
    context.event.name !== "workflow_dispatch" ||
    !hasExactKeys(context.source, [
      "repository", "ref", "revision", "expectedRevision", "checkedOutRevision", "exerciseRevision",
    ]) ||
    context.source.repository !== exactRepository ||
    context.source.ref !== exactHeadRef ||
    !exactRevisionPattern.test(context.source.revision) ||
    context.source.expectedRevision !== context.source.revision ||
    context.source.checkedOutRevision !== context.source.revision ||
    !exactRevisionPattern.test(context.source.exerciseRevision) ||
    (context.mode === "exercise" && context.source.exerciseRevision !== context.source.revision) ||
    !hasExactKeys(context.subject, [
      "identifier",
      "version",
      "behaviorContractDigest",
    ]) ||
    context.subject.identifier !== "analytics" ||
    context.subject.version !== "0.1.0" ||
    context.subject.behaviorContractDigest !== exactDigest ||
    context.environment !== exactEnvironment ||
    !hasExactKeys(context.resources, [
      "worker",
      "target",
      "hostname",
      "production",
    ]) ||
    context.resources.worker !== exactWorker ||
    context.resources.target !== "dedicated-non-production-workers-dev" ||
    !exactDedicatedHostnamePattern.test(context.resources.hostname) ||
    context.resources.production !== false ||
    containsUnsafeContent(context)
  ) {
    reject();
  }
}

function cleanupContextFromMeasuredContext(context) {
  return {
    headSha: context.source.exerciseRevision,
    environment: context.environment,
    hostname: context.resources.hostname,
    worker: context.resources.worker,
  };
}

function requireAppBuild(measurement, context) {
  if (
    !hasExactKeys(measurement, [
      "schemaVersion", "headSha", "profile", "recipeVersion",
      "workerIntegration", "appBuildEvidence",
    ]) ||
    measurement.schemaVersion !== "1.0.0" ||
    measurement.headSha !== context.source.revision ||
    measurement.profile !== "app" ||
    measurement.recipeVersion !== "0.2.0"
  ) reject();
  try {
    requireAppRuntimeEvidence(measurement, "app-analytics");
  } catch {
    reject();
  }
}

function requireSiteReadback(measurement, context, identity) {
  if (
    !hasExactKeys(measurement, [
      "schemaVersion",
      "headSha",
      "environment",
      "hostname",
      "createdByRun",
      "reusedFromRevision",
      "readbackVerified",
      "siteTagMatchesIdentity",
      "siteTokenMatchesIdentity",
      "scriptTokenMatchesIdentity",
      "autoInstall",
    ]) ||
    measurement.schemaVersion !== "2.0.0" ||
    measurement.headSha !== context.source.revision ||
    measurement.environment !== context.environment ||
    measurement.hostname !== context.resources.hostname ||
    identity.identityKnown !== true ||
    typeof measurement.createdByRun !== "boolean" ||
    (measurement.createdByRun
      ? measurement.reusedFromRevision !== null
      : (!exactRevisionPattern.test(measurement.reusedFromRevision) || measurement.reusedFromRevision === context.source.revision)) ||
    measurement.readbackVerified !== true ||
    measurement.siteTagMatchesIdentity !== true ||
    measurement.siteTokenMatchesIdentity !== true ||
    measurement.scriptTokenMatchesIdentity !== true ||
    measurement.autoInstall !== false
  ) {
    reject();
  }
}

function requireDeploymentReadback(measurement, context, identity) {
  if (
    !hasExactKeys(measurement, [
      "schemaVersion",
      "headSha",
      "environment",
      "hostname",
      "worker",
      "scriptReadbackVerified",
      "deploymentReadbackVerified",
      "deploymentId",
      "versionId",
      "singleVersionAt100Percent",
    ]) ||
    measurement.schemaVersion !== "1.0.0" ||
    measurement.headSha !== context.source.revision ||
    measurement.environment !== context.environment ||
    measurement.hostname !== context.resources.hostname ||
    measurement.worker !== exactWorker ||
    identity.identityKnown !== true ||
    measurement.scriptReadbackVerified !== true ||
    measurement.deploymentReadbackVerified !== true ||
    measurement.deploymentId !== identity.worker.deploymentId ||
    measurement.versionId !== identity.worker.versionId ||
    measurement.singleVersionAt100Percent !== true
  ) {
    reject();
  }
}

function requireReadiness(measurement, context) {
  if (
    !hasExactKeys(measurement, [
      "schemaVersion",
      "headSha",
      "hostname",
      "maximumAttempts",
      "intervalMilliseconds",
      "requestTimeoutMilliseconds",
      "maximumElapsedMilliseconds",
      "attempts",
      "elapsedMilliseconds",
      "succeeded",
      "status",
    ]) ||
    measurement.schemaVersion !== "1.0.0" ||
    measurement.headSha !== context.source.revision ||
    measurement.hostname !== context.resources.hostname ||
    measurement.maximumAttempts !== 20 ||
    measurement.intervalMilliseconds !== 15_000 ||
    measurement.requestTimeoutMilliseconds !== 5_000 ||
    measurement.maximumElapsedMilliseconds !== 300_000 ||
    !Number.isInteger(measurement.attempts) ||
    measurement.attempts < 1 ||
    measurement.attempts > measurement.maximumAttempts ||
    !Number.isInteger(measurement.elapsedMilliseconds) ||
    measurement.elapsedMilliseconds < 0 ||
    measurement.elapsedMilliseconds > measurement.maximumElapsedMilliseconds ||
    measurement.succeeded !== true ||
    !Number.isInteger(measurement.status) ||
    measurement.status < 200 ||
    measurement.status > 399
  ) {
    reject();
  }
}

function requireRequestPhase(
  phase,
  keys = ["providerRequests", "unexpectedExternalRequests"],
) {
  return (
    hasExactKeys(phase, keys) &&
    Number.isInteger(phase.providerRequests) &&
    phase.providerRequests >= 0 &&
    Number.isInteger(phase.unexpectedExternalRequests) &&
    phase.unexpectedExternalRequests === 0
  );
}

function requireProviderMeasurements(providers, minimumRequests) {
  if (
    !hasExactKeys(providers, [
      "cloudflareWebAnalytics",
      "googleAnalytics4",
      "microsoftClarity",
    ])
  ) {
    reject();
  }

  let requestCount = 0;
  for (const provider of Object.values(providers)) {
    if (
      !hasExactKeys(provider, ["scriptRequests", "collectionRequests"]) ||
      !Number.isInteger(provider.scriptRequests) ||
      provider.scriptRequests < minimumRequests ||
      !Number.isInteger(provider.collectionRequests) ||
      provider.collectionRequests < minimumRequests
    ) {
      reject();
    }
    requestCount += provider.scriptRequests + provider.collectionRequests;
  }
  return requestCount;
}

function requireBrowserJourney(measurement) {
  if (
    !hasExactKeys(measurement, [
      "schemaVersion",
      "traffic",
      "requestEnvelopeLimit",
      "totalExternalRequests",
      "unexpectedExternalRequests",
      "cases",
      "providers",
      "freshDenial",
      "persistedDenialReload",
      "partialGrant",
      "fullGrant",
      "withdrawalReload",
      "providerSourceBoundary",
    ]) ||
    measurement.schemaVersion !== "1.1.0" ||
    measurement.traffic !== "synthetic-only" ||
    measurement.requestEnvelopeLimit !== 64 ||
    !Number.isInteger(measurement.totalExternalRequests) ||
    measurement.totalExternalRequests < 1 ||
    measurement.totalExternalRequests > measurement.requestEnvelopeLimit ||
    measurement.unexpectedExternalRequests !== 0 ||
    !arraysEqual(measurement.cases, [
      "fresh-denial",
      "persisted-denial-reload",
      "purpose-specific-partial-grant",
      "positive-grant",
      "complete-withdrawal-reload",
    ]) ||
    !requireRequestPhase(measurement.freshDenial, [
      "providerRequests",
      "unexpectedExternalRequests",
      "consentRecordPersisted",
      "providerCookieCount",
    ]) ||
    measurement.freshDenial.providerRequests !== 0 ||
    measurement.freshDenial.consentRecordPersisted !== false ||
    measurement.freshDenial.providerCookieCount !== 0 ||
    !requireRequestPhase(measurement.persistedDenialReload, [
      "providerRequests",
      "unexpectedExternalRequests",
      "consentRecordPersisted",
      "consentRecordSchemaVersion",
      "deniedPurposeCount",
      "providerCookieCount",
    ]) ||
    measurement.persistedDenialReload.providerRequests !== 0 ||
    measurement.persistedDenialReload.consentRecordPersisted !== true ||
    measurement.persistedDenialReload.consentRecordSchemaVersion !== 2 ||
    measurement.persistedDenialReload.deniedPurposeCount !== 3 ||
    measurement.persistedDenialReload.providerCookieCount !== 0 ||
    !requireRequestPhase(measurement.partialGrant, [
      "providerRequests",
      "unexpectedExternalRequests",
      "grantedPurpose",
      "grantedProvider",
      "providers",
    ]) ||
    measurement.partialGrant.grantedPurpose !==
      "aggregate-traffic-and-performance" ||
    measurement.partialGrant.grantedProvider !== "cloudflareWebAnalytics" ||
    !requireRequestPhase(measurement.fullGrant) ||
    !hasExactKeys(measurement.withdrawalReload, [
      "providerRequests",
      "unexpectedExternalRequests",
      "captureStartedBeforeAction",
      "networkIdleObserved",
      "consentRecordPersisted",
      "deniedPurposeCount",
      "providerCookiesBeforeWithdrawal",
      "providerCookiesAfterWithdrawal",
    ]) ||
    !Number.isInteger(measurement.withdrawalReload.providerRequests) ||
    measurement.withdrawalReload.providerRequests !== 0 ||
    measurement.withdrawalReload.unexpectedExternalRequests !== 0 ||
    measurement.withdrawalReload.captureStartedBeforeAction !== true ||
    measurement.withdrawalReload.networkIdleObserved !== true ||
    measurement.withdrawalReload.consentRecordPersisted !== true ||
    measurement.withdrawalReload.deniedPurposeCount !== 3 ||
    !Number.isInteger(
      measurement.withdrawalReload.providerCookiesBeforeWithdrawal,
    ) ||
    measurement.withdrawalReload.providerCookiesBeforeWithdrawal < 2 ||
    measurement.withdrawalReload.providerCookiesAfterWithdrawal !== 0 ||
    !hasExactKeys(measurement.providerSourceBoundary, [
      "classifiedProviderRequests",
      "unexpectedExternalRequests",
    ]) ||
    !Number.isInteger(
      measurement.providerSourceBoundary.classifiedProviderRequests,
    ) ||
    measurement.providerSourceBoundary.unexpectedExternalRequests !== 0
  ) {
    reject();
  }

  const providerRequestCount = requireProviderMeasurements(
    measurement.providers,
    1,
  );
  const partialProviderRequestCount = requireProviderMeasurements(
    measurement.partialGrant.providers,
    0,
  );
  const partialProviders = measurement.partialGrant.providers;
  if (
    partialProviders.cloudflareWebAnalytics.scriptRequests < 1 ||
    partialProviders.cloudflareWebAnalytics.collectionRequests < 1 ||
    partialProviders.googleAnalytics4.scriptRequests !== 0 ||
    partialProviders.googleAnalytics4.collectionRequests !== 0 ||
    partialProviders.microsoftClarity.scriptRequests !== 0 ||
    partialProviders.microsoftClarity.collectionRequests !== 0 ||
    measurement.partialGrant.providerRequests !== partialProviderRequestCount ||
    measurement.fullGrant.providerRequests !== providerRequestCount ||
    measurement.totalExternalRequests !== providerRequestCount ||
    measurement.providerSourceBoundary.classifiedProviderRequests !==
      providerRequestCount
  ) {
    reject();
  }
}

function requireCleanupResourceMeasurement(measurement, identity, worker = false) {
  const keys = ["initialState", "identityDisposition", "disposition", "verified"];
  if (worker) keys.push("workersDevEnabled", "previewsEnabled");
  if (
    !hasExactKeys(measurement, keys) ||
    !["present", "absent"].includes(measurement.initialState) ||
    measurement.verified !== true
  ) reject();
  const present = measurement.initialState === "present";
  if (
    (present && identity.identityKnown !== true) ||
    measurement.identityDisposition !== (present ? "matched" : "not-present") ||
    measurement.disposition !== (present ? "retained" : "absent") ||
    (worker && (measurement.workersDevEnabled !== (present ? false : null) ||
      measurement.previewsEnabled !== (present ? false : null)))
  ) reject();
}

function requireCleanupMeasurement(measurement, context, siteIdentity, workerIdentity) {
  if (
    !hasExactKeys(measurement, [
      "schemaVersion",
      "headSha",
      "environment",
      "hostname",
      "worker",
      "site",
      "workerResource",
      "dedicatedRecovery",
      "operatorCleanupPending",
    ]) ||
    measurement.schemaVersion !== "2.0.0" ||
    measurement.headSha !== context.source.exerciseRevision ||
    measurement.environment !== context.environment ||
    measurement.hostname !== context.resources.hostname ||
    measurement.worker !== exactWorker ||
    measurement.dedicatedRecovery !== "retained-with-workers-dev-disabled" ||
    measurement.operatorCleanupPending !== true
  ) {
    reject();
  }
  requireCleanupResourceMeasurement(measurement.site, siteIdentity);
  requireCleanupResourceMeasurement(measurement.workerResource, workerIdentity, true);
}

function createMeasuredReceipt(input) {
  if (
    !hasExactKeys(input, [
      "context",
      "siteIdentity",
      "workerIdentity",
      "appBuild",
      "siteReadback",
      "deploymentReadback",
      "readiness",
      "browserJourney",
      "cleanup",
    ]) ||
    containsUnsafeContent(input)
  ) {
    reject();
  }
  const { context } = input;
  requireMeasuredContext(context);
  const cleanupContext = cleanupContextFromMeasuredContext(context);
  requireSiteIdentity(input.siteIdentity, cleanupContext);
  requireWorkerIdentity(input.workerIdentity, cleanupContext);

  let outcomes;
  let resourceDisposition;
  let measurements;
  let checks;
  if (context.mode === "exercise") {
    if (input.cleanup !== null) reject();
    requireAppBuild(input.appBuild, context);
    requireSiteReadback(input.siteReadback, context, input.siteIdentity);
    requireDeploymentReadback(
      input.deploymentReadback,
      context,
      input.workerIdentity,
    );
    requireReadiness(input.readiness, context);
    requireBrowserJourney(input.browserJourney);
    outcomes = ["deployed-application"];
    resourceDisposition = "retained-for-human-provider-confirmation";
    measurements = {
      reusedFromRevision: input.siteReadback.reusedFromRevision,
      readinessAttempts: input.readiness.attempts,
      readinessElapsedMilliseconds: input.readiness.elapsedMilliseconds,
      externalRequestEnvelopes: input.browserJourney.totalExternalRequests,
      deployedConsentCases: input.browserJourney.cases.length,
      persistedDenialProviderRequests:
        input.browserJourney.persistedDenialReload.providerRequests,
      partialGrantProviderRequests:
        input.browserJourney.partialGrant.providerRequests,
      providerCookiesAfterWithdrawal:
        input.browserJourney.withdrawalReload.providerCookiesAfterWithdrawal,
      sourceBoundaryUnexpectedExternalRequests:
        input.browserJourney.providerSourceBoundary.unexpectedExternalRequests,
    };
    checks = [
      "approved-main-revision",
      "exact-subject",
      "app-whole-worker-integration",
      "app-effect-build-inspection",
      "dedicated-worker-identity",
      "manual-web-analytics-readback",
      "bounded-readiness",
      "bounded-synthetic-provider-collections",
      "persisted-denial-reload",
      "purpose-specific-partial-grant",
      "accessible-provider-cookie-cleanup",
      "configured-provider-source-boundary",
      "deployed-consent-journeys",
    ];
  } else {
    if (
      input.appBuild !== null ||
      input.siteReadback !== null ||
      input.deploymentReadback !== null ||
      input.readiness !== null ||
      input.browserJourney !== null
    ) {
      reject();
    }
    requireCleanupMeasurement(
      input.cleanup,
      context,
      input.siteIdentity,
      input.workerIdentity,
    );
    outcomes = [];
    resourceDisposition = "cloudflare-retained-or-absent-workers-dev-disabled";
    measurements = {
      siteInitialState: input.cleanup.site.initialState,
      workerInitialState: input.cleanup.workerResource.initialState,
    };
    checks = [
      "approved-main-revision",
      "exact-subject",
      "exercise-identity-reconciled",
      "dedicated-worker-retained-disabled-or-absent",
      "web-analytics-site-retained-manual-or-absent",
      "operator-cleanup-pending",
    ];
  }

  return Object.freeze({
    schemaVersion: "3.0.0",
    ok: true,
    mode: context.mode,
    subject: Object.freeze({ ...context.subject }),
    repository: exactRepository,
    headRef: exactHeadRef,
    headSha: context.source.revision,
    exerciseRevision: context.source.exerciseRevision,
    environment: exactEnvironment,
    worker: exactWorker,
    outcomes: Object.freeze(outcomes),
    providerRecordsClaimed: false,
    providerConfirmation: "pending-human-evidence",
    resourceDisposition,
    measurements: Object.freeze(measurements),
    checks: Object.freeze(checks),
  });
}

export function createAnalyticsCertificationProviderReceiptForTesting(input) {
  return createMeasuredReceipt(input);
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

async function readMeasuredEvidence(directoryPath) {
  const directory = resolve(directoryPath);
  let statistics;
  try {
    statistics = await lstat(directory);
  } catch {
    reject();
  }
  if (
    !statistics.isDirectory() ||
    statistics.isSymbolicLink() ||
    (statistics.mode & 0o077) !== 0
  ) {
    reject();
  }

  const context = await readEvidence(join(directory, "context.json"));
  requireMeasuredContext(context);
  const exerciseFiles = [
    "app-build.json",
    "browser-journey.json",
    "context.json",
    "deployment-readback.json",
    "readiness.json",
    "site-identity.json",
    "site-readback.json",
    "worker-identity.json",
  ];
  const cleanupFiles = [
    "cleanup.json",
    "context.json",
    "site-identity.json",
    "worker-identity.json",
  ];
  const expectedFiles = context.mode === "exercise" ? exerciseFiles : cleanupFiles;
  let actualFiles;
  try {
    actualFiles = (await readdir(directory)).sort();
  } catch {
    reject();
  }
  if (!arraysEqual(actualFiles, expectedFiles)) reject();

  const [siteIdentity, workerIdentity] = await Promise.all([
    readEvidence(join(directory, "site-identity.json")),
    readEvidence(join(directory, "worker-identity.json")),
  ]);
  if (context.mode === "exercise") {
    const [appBuild, siteReadback, deploymentReadback, readiness, browserJourney] =
      await Promise.all([
        readEvidence(join(directory, "app-build.json")),
        readEvidence(join(directory, "site-readback.json")),
        readEvidence(join(directory, "deployment-readback.json")),
        readEvidence(join(directory, "readiness.json")),
        readEvidence(join(directory, "browser-journey.json")),
      ]);
    return {
      context,
      siteIdentity,
      workerIdentity,
      appBuild,
      siteReadback,
      deploymentReadback,
      readiness,
      browserJourney,
      cleanup: null,
    };
  }
  return {
    context,
    siteIdentity,
    workerIdentity,
    appBuild: null,
    siteReadback: null,
    deploymentReadback: null,
    readiness: null,
    browserJourney: null,
    cleanup: await readEvidence(join(directory, "cleanup.json")),
  };
}

async function main() {
  const arguments_ = process.argv.slice(2);
  if (arguments_.length !== 2 || arguments_[0] !== "--input-directory") reject();
  const evidence = await readMeasuredEvidence(arguments_[1]);
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
