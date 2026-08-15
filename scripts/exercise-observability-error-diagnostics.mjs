import { lstat, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

const requestTimeoutMilliseconds = 10_000;
const maximumReceiptBytes = 4_096;
const exactRevisionPattern = /^[0-9a-f]{40}$/u;
const eventIdentifierPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const subject = Object.freeze({
  descriptorVersion: "0.3.0",
  behaviorContractDigest:
    "sha256:24a3cb3361cd8f72a12a1926b512e087adb31ad120a62b70e06a68d9dcf90c99",
});
const browserCases = Object.freeze([
  "browser-error",
  "unhandled-rejection",
  "react-boundary",
  "selected-browser-catch",
  "duplicate-suppression",
]);
const serverCases = Object.freeze([
  "next-request-error",
  "selected-server-catch",
  "diagnostic-failure-containment",
]);
const routeCounts = Object.freeze({
  cases: 3,
  captureInvocations: 3,
  acceptedOriginals: 3,
  syntheticApplicationRequests: 3,
  expectedWorkersRecords: 4,
  expectedBetterStackRecords: 2,
  diagnosticDeliveryFailures: 1,
});
const browserCounts = Object.freeze({
  cases: 5,
  captureInvocations: 6,
  acceptedOriginals: 5,
  syntheticApplicationRequests: 7,
  expectedWorkersRecords: 5,
  expectedBetterStackRecords: 5,
  diagnosticDeliveryFailures: 0,
});

export class ObservabilityErrorDiagnosticsExerciseError extends Error {
  constructor(code) {
    super(`Observability error diagnostics exercise failed: ${code}`);
    this.name = "ObservabilityErrorDiagnosticsExerciseError";
    this.code = code;
  }
}

function createError(code) {
  return new ObservabilityErrorDiagnosticsExerciseError(code);
}

function readBaseUrl(value) {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    const rootUrl = `${url.origin}/`;
    if (
      url.protocol !== "https:" ||
      url.username !== "" ||
      url.password !== "" ||
      url.pathname !== "/" ||
      url.search !== "" ||
      url.hash !== "" ||
      (value !== url.origin && value !== rootUrl)
    ) {
      return undefined;
    }
    return rootUrl;
  } catch {
    return undefined;
  }
}

function readInput(input) {
  const baseUrl = readBaseUrl(input?.baseUrl);
  if (baseUrl === undefined) throw createError("EXERCISE_BASE_URL_INVALID");
  if (
    typeof input?.revision !== "string" ||
    !exactRevisionPattern.test(input.revision)
  ) {
    throw createError("EXERCISE_REVISION_INVALID");
  }
  return Object.freeze({ baseUrl, revision: input.revision });
}

function readAdapters(adapters) {
  if (
    adapters === null ||
    typeof adapters !== "object" ||
    typeof adapters.fetch !== "function" ||
    typeof adapters.createTimeoutSignal !== "function"
  ) {
    throw createError("EXERCISE_ADAPTER_INVALID");
  }
  return adapters;
}

function hasExactKeys(value, keys) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function createRequests(input) {
  const markerSuffix = input.revision.slice(0, 16);
  const route = `${input.baseUrl}api/certification/diagnostics`;
  return Object.freeze([
    Object.freeze({
      url: `${route}?case=next-request-error&marker=diagnostics-next-${markerSuffix}`,
      expectedStatus: 500,
      check: "next-request-error-contained",
      readSafeResult: false,
    }),
    Object.freeze({
      url: `${route}?case=selected-server-catch&marker=diagnostics-server-${markerSuffix}`,
      expectedStatus: 204,
      check: "selected-server-catch-preserved",
      readSafeResult: false,
    }),
    Object.freeze({
      url: `${route}?case=diagnostic-failure-containment&marker=diagnostics-failure-${markerSuffix}`,
      expectedStatus: 200,
      check: "diagnostic-failure-contained",
      readSafeResult: true,
    }),
  ]);
}

function readFailureName(error) {
  try {
    return typeof error === "object" &&
      error !== null &&
      typeof error.name === "string"
      ? error.name
      : undefined;
  } catch {
    return undefined;
  }
}

async function runRequest(request, adapters) {
  let response;
  try {
    response = await adapters.fetch(request.url, {
      method: "GET",
      signal: adapters.createTimeoutSignal(requestTimeoutMilliseconds),
    });
  } catch (error) {
    const name = readFailureName(error);
    throw createError(
      name === "AbortError" || name === "TimeoutError"
        ? "EXERCISE_REQUEST_TIMEOUT"
        : "EXERCISE_REQUEST_FAILED",
    );
  }

  let status;
  try {
    status = response?.status;
  } catch {
    throw createError("EXERCISE_REQUEST_FAILED");
  }
  if (status !== request.expectedStatus) {
    throw createError("EXERCISE_STATUS_UNEXPECTED");
  }
  if (!request.readSafeResult) return;

  let value;
  try {
    value = await response.json();
  } catch {
    throw createError("EXERCISE_FAILURE_RESULT_INVALID");
  }
  if (
    !hasExactKeys(value, [
      "applicationResult",
      "deliveryResult",
      "diagnosticAttempts",
      "healthRecords",
      "ok",
      "originalRecords",
      "recursiveDiagnosticAttempts",
      "scheduledTasks",
    ]) ||
    value.ok !== true ||
    value.diagnosticAttempts !== 1 ||
    value.deliveryResult !== "provider-rejected" ||
    value.applicationResult !== "preserved" ||
    value.healthRecords !== 1 ||
    value.originalRecords !== 1 ||
    value.recursiveDiagnosticAttempts !== 0 ||
    value.scheduledTasks !== 1
  ) {
    throw createError("EXERCISE_FAILURE_RESULT_INVALID");
  }
}

async function exerciseWithAdapters(input, adapters) {
  const validatedInput = readInput(input);
  const validatedAdapters = readAdapters(adapters);
  const requests = createRequests(validatedInput);
  for (const request of requests) {
    await runRequest(request, validatedAdapters);
  }
  return Object.freeze({
    ok: true,
    capability: "observability",
    version: "0.3.0",
    subject,
    revision: validatedInput.revision,
    cases: serverCases,
    providerRecordsClaimed: false,
    counts: routeCounts,
    checks: Object.freeze(requests.map(({ check }) => check)),
  });
}

const productionAdapters = Object.freeze({
  fetch: globalThis.fetch,
  createTimeoutSignal: (milliseconds) => AbortSignal.timeout(milliseconds),
});

export function exerciseObservabilityErrorDiagnostics(input) {
  return exerciseWithAdapters(input, productionAdapters);
}

export function exerciseObservabilityErrorDiagnosticsForTesting(
  input,
  adapters,
) {
  return exerciseWithAdapters(input, adapters);
}

function receiptMatches(value, expected) {
  return (
    value?.ok === true &&
    value.capability === "observability" &&
    value.version === "0.3.0" &&
    isDeepStrictEqual(value.subject, subject) &&
    value.revision === expected.revision &&
    value.providerRecordsClaimed === false &&
    isDeepStrictEqual(value.cases, expected.cases) &&
    isDeepStrictEqual(value.counts, expected.counts)
  );
}

export function reconcileObservabilityErrorDiagnosticsReceipts(
  routeReceipt,
  browserReceipt,
  revision,
) {
  if (typeof revision !== "string" || !exactRevisionPattern.test(revision)) {
    throw createError("RECEIPT_REVISION_INVALID");
  }
  if (
    !receiptMatches(routeReceipt, {
      revision,
      cases: serverCases,
      counts: routeCounts,
    }) ||
    !receiptMatches(browserReceipt, {
      revision,
      cases: browserCases,
      counts: browserCounts,
    }) ||
    browserReceipt.scope !== "browser-only" ||
    !Array.isArray(browserReceipt.eventIdentifiers) ||
    browserReceipt.eventIdentifiers.length !== 5 ||
    new Set(browserReceipt.eventIdentifiers).size !== 5 ||
    browserReceipt.eventIdentifiers.some(
      (identifier) =>
        typeof identifier !== "string" ||
        !eventIdentifierPattern.test(identifier),
    )
  ) {
    throw createError("RECEIPT_COUNTS_INVALID");
  }

  return Object.freeze({
    ok: true,
    capability: "observability",
    version: "0.3.0",
    subject,
    revision,
    cases: Object.freeze([...browserCases, ...serverCases]),
    providerRecordsClaimed: false,
    counts: Object.freeze({
      cases: 8,
      captureInvocations: 9,
      acceptedOriginals: 8,
      syntheticApplicationRequests: 10,
      maximumSyntheticApplicationRequests: 16,
      expectedWorkersRecords: 9,
      expectedBetterStackRecords: 7,
      diagnosticDeliveryFailures: 1,
    }),
    checks: Object.freeze([
      "exact-case-matrix",
      "duplicate-suppression",
      "bounded-application-requests",
      "controlled-diagnostic-failure",
    ]),
  });
}

async function readBoundedReceipt(path) {
  let stats;
  try {
    stats = await lstat(path);
  } catch {
    throw createError("RECEIPT_INPUT_INVALID");
  }
  if (
    stats.isSymbolicLink() ||
    !stats.isFile() ||
    stats.size === 0 ||
    stats.size > maximumReceiptBytes
  ) {
    throw createError("RECEIPT_INPUT_INVALID");
  }
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    throw createError("RECEIPT_INPUT_INVALID");
  }
}

function parseArguments(arguments_) {
  if (
    arguments_.length === 4 &&
    arguments_[0] === "--base-url" &&
    arguments_[2] === "--revision"
  ) {
    return {
      kind: "exercise",
      baseUrl: arguments_[1],
      revision: arguments_[3],
    };
  }
  if (
    arguments_.length === 7 &&
    arguments_[0] === "--reconcile" &&
    arguments_[1] === "--route-receipt" &&
    arguments_[3] === "--browser-receipt" &&
    arguments_[5] === "--revision"
  ) {
    return {
      kind: "reconcile",
      routeReceiptPath: arguments_[2],
      browserReceiptPath: arguments_[4],
      revision: arguments_[6],
    };
  }
  return undefined;
}

async function runMain() {
  const input = parseArguments(process.argv.slice(2));
  if (input === undefined) {
    process.stderr.write(
      `${JSON.stringify({ ok: false, code: "EXERCISE_ARGUMENT_INVALID" })}\n`,
    );
    process.exitCode = 2;
    return;
  }

  try {
    const receipt =
      input.kind === "exercise"
        ? await exerciseObservabilityErrorDiagnostics(input)
        : reconcileObservabilityErrorDiagnosticsReceipts(
            await readBoundedReceipt(input.routeReceiptPath),
            await readBoundedReceipt(input.browserReceiptPath),
            input.revision,
          );
    process.stdout.write(`${JSON.stringify(receipt)}\n`);
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({
        ok: false,
        code:
          error instanceof ObservabilityErrorDiagnosticsExerciseError
            ? error.code
            : "EXERCISE_FAILED",
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
