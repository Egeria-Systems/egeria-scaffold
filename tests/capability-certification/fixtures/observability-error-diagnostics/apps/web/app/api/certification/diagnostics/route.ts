import { reportCaughtServerError } from "../../../../src/infrastructure/observability/server-reporter";

const markerPattern = /^diagnostics-[a-z]+-[0-9a-f]{16}$/u;
const cases = Object.freeze([
  "next-request-error",
  "selected-server-catch",
  "diagnostic-failure-containment",
] as const);
const cloudflareContextKey = Symbol.for("__cloudflare-context__");
const certificationLeaseKey = Symbol.for(
  "__observability-diagnostics-certification-lease__",
);
const controlledDiagnosticHost =
  "certification.eu-central-1.betterstackdata.com";
const controlledDiagnosticToken = "certification-placeholder";
const operationalRecordKeys = Object.freeze([
  "attributes",
  "correlation_id",
  "dt",
  "environment",
  "error_category",
  "event_id",
  "event_kind",
  "event_name",
  "release_id",
  "runtime",
  "schema_version",
  "service",
  "severity",
]);

type UnknownRecord = Readonly<Record<string, unknown>>;

function emptyResponse(status: number): Response {
  return new Response(null, { status });
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: UnknownRecord, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function hasExactAttributes(
  record: UnknownRecord,
  expected: UnknownRecord,
): boolean {
  const attributes = record.attributes;
  return (
    isRecord(attributes) &&
    JSON.stringify(attributes) === JSON.stringify(expected)
  );
}

function isSafeRecord(record: UnknownRecord): boolean {
  return (
    hasOnlyKeys(record, operationalRecordKeys) &&
    !Object.keys(record).some((key) => key.startsWith("exception."))
  );
}

function readInput(request: Request) {
  const url = new URL(request.url);
  const actualKeys = [...url.searchParams.keys()].sort();
  if (
    actualKeys.length !== 2 ||
    actualKeys[0] !== "case" ||
    actualKeys[1] !== "marker"
  ) {
    return undefined;
  }
  const requestedCase = url.searchParams.get("case");
  const marker = url.searchParams.get("marker");
  if (
    !cases.includes(requestedCase as (typeof cases)[number]) ||
    marker === null ||
    !markerPattern.test(marker)
  ) {
    return undefined;
  }
  return Object.freeze({
    case: requestedCase as (typeof cases)[number],
    marker,
  });
}

async function captureGeneratedDispatch(
  action: () => Promise<void>,
  rejectDiagnostic: boolean,
) {
  // This short-lived certification fixture patches isolate-wide globals. The
  // protected lease keeps captures exclusive; never reuse it for shared traffic.
  if (Reflect.get(globalThis, certificationLeaseKey) === true) {
    throw new Error("certification capture already active");
  }
  const previousContext = Reflect.get(globalThis, cloudflareContextKey);
  if (!isRecord(previousContext)) {
    throw new Error("Cloudflare context unavailable");
  }
  const previousEnvironment = previousContext.env;
  const previousExecutionContext = previousContext.ctx;
  if (!isRecord(previousExecutionContext)) {
    throw new Error("Cloudflare execution context unavailable");
  }

  const scheduled: Promise<unknown>[] = [];
  const records: UnknownRecord[] = [];
  let diagnosticAttempts = 0;
  const previousFetch = globalThis.fetch;
  const previousConsoleInfo = console.info;
  const replacementEnvironment = rejectDiagnostic
    ? Object.freeze({
        BETTER_STACK_INGESTING_HOST: controlledDiagnosticHost,
        BETTER_STACK_SOURCE_TOKEN: controlledDiagnosticToken,
      })
    : previousContext.env;
  const replacementExecutionContext = Object.freeze({
    ...previousExecutionContext,
    waitUntil(task: Promise<unknown>) {
      scheduled.push(Promise.resolve(task));
    },
  });

  let environmentReplaced = false;
  let executionContextReplaced = false;
  let leaseAcquired = false;
  let consoleReplaced = false;
  let fetchReplaced = false;
  let captureFailed = false;
  let captureError: unknown;
  try {
    environmentReplaced = Reflect.set(
      previousContext,
      "env",
      replacementEnvironment,
    );
    if (!environmentReplaced) {
      throw new Error("Cloudflare context replacement unavailable");
    }
    executionContextReplaced = Reflect.set(
      previousContext,
      "ctx",
      replacementExecutionContext,
    );
    if (!executionContextReplaced) {
      throw new Error("Cloudflare context replacement unavailable");
    }
    if (!Reflect.set(globalThis, certificationLeaseKey, true)) {
      throw new Error("certification lease unavailable");
    }
    leaseAcquired = true;
    console.info = (...values: unknown[]) => {
      const [candidate] = values;
      if (isRecord(candidate) && typeof candidate.event_name === "string") {
        records.push(candidate);
      }
      try {
        Reflect.apply(previousConsoleInfo, console, values);
      } catch {
        // Certification observation must not change generated reporting behavior.
      }
    };
    consoleReplaced = true;
    if (rejectDiagnostic) {
      globalThis.fetch = async (input) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        if (url !== `https://${controlledDiagnosticHost}`) {
          throw new Error("unexpected certification request");
        }
        diagnosticAttempts += 1;
        return new Response(null, { status: 503 });
      };
      fetchReplaced = true;
    }

    await action();
    await Promise.all(scheduled);
  } catch (error) {
    captureFailed = true;
    captureError = error;
  }

  let cleanupFailed = false;
  const attemptCleanup = (cleanup: () => boolean | void) => {
    try {
      if (cleanup() === false) {
        cleanupFailed = true;
      }
    } catch {
      cleanupFailed = true;
    }
  };
  if (fetchReplaced) {
    attemptCleanup(() => {
      globalThis.fetch = previousFetch;
    });
  }
  if (consoleReplaced) {
    attemptCleanup(() => {
      console.info = previousConsoleInfo;
    });
  }
  if (executionContextReplaced) {
    attemptCleanup(() =>
      Reflect.set(previousContext, "ctx", previousExecutionContext),
    );
  }
  if (environmentReplaced) {
    attemptCleanup(() =>
      Reflect.set(previousContext, "env", previousEnvironment),
    );
  }
  if (leaseAcquired) {
    attemptCleanup(() =>
      Reflect.set(globalThis, certificationLeaseKey, false),
    );
  }

  if (captureFailed) {
    throw captureError;
  }
  if (cleanupFailed) {
    throw new Error("Cloudflare context restoration failed");
  }

  return Object.freeze({
    records: Object.freeze(records),
    diagnosticAttempts,
    scheduledTasks: scheduled.length,
  });
}

async function exerciseSelectedServerCatch(marker: string): Promise<Response> {
  let captured;
  try {
    captured = await captureGeneratedDispatch(async () => {
      try {
        throw new Error("synthetic selected server error");
      } catch (error) {
        await reportCaughtServerError(error, {
          operation: "certification-server",
          correlationId: marker,
        });
      }
    }, false);
  } catch {
    return emptyResponse(500);
  }

  const originals = captured.records.filter(
    (record) => record.event_name === "server.caught.error",
  );
  const original = originals[0];
  const valid =
    captured.scheduledTasks === 1 &&
    captured.records.length === 1 &&
    originals.length === 1 &&
    original !== undefined &&
    original.correlation_id === marker &&
    isSafeRecord(original) &&
    hasExactAttributes(original, {
      capture_mechanism: "selected-catch",
      handled: true,
      operation: "certification-server",
    });
  return emptyResponse(valid ? 204 : 500);
}

async function exerciseDiagnosticFailure(marker: string): Promise<Response> {
  let captured;
  try {
    captured = await captureGeneratedDispatch(
      () =>
        reportCaughtServerError(
          new Error("synthetic controlled diagnostic failure"),
          {
            operation: "certification-failure",
            correlationId: marker,
          },
        ),
      true,
    );
  } catch {
    return emptyResponse(500);
  }

  const originals = captured.records.filter(
    (record) => record.event_name === "server.caught.error",
  );
  const healthRecords = captured.records.filter(
    (record) => record.event_name === "observability.delivery.failed",
  );
  const original = originals[0];
  const healthRecord = healthRecords[0];
  const recursiveDiagnosticAttempts = Math.max(
    0,
    captured.diagnosticAttempts - 1,
  );
  const valid =
    captured.scheduledTasks === 1 &&
    captured.diagnosticAttempts === 1 &&
    captured.records.length === 2 &&
    originals.length === 1 &&
    healthRecords.length === 1 &&
    original !== undefined &&
    healthRecord !== undefined &&
    original.correlation_id === marker &&
    isSafeRecord(original) &&
    isSafeRecord(healthRecord) &&
    hasExactAttributes(original, {
      capture_mechanism: "selected-catch",
      handled: true,
      operation: "certification-failure",
    }) &&
    hasExactAttributes(healthRecord, {
      reason: "provider-rejected",
      sink: "better-stack",
    }) &&
    recursiveDiagnosticAttempts === 0;
  if (!valid) return emptyResponse(500);

  return Response.json({
    ok: true,
    diagnosticAttempts: captured.diagnosticAttempts,
    deliveryResult: "provider-rejected",
    applicationResult: "preserved",
    healthRecords: healthRecords.length,
    originalRecords: originals.length,
    recursiveDiagnosticAttempts,
    scheduledTasks: captured.scheduledTasks,
  });
}

export async function GET(request: Request): Promise<Response> {
  const input = readInput(request);
  if (input === undefined) return emptyResponse(400);

  if (input.case === "next-request-error") {
    throw new Error("synthetic Next request error");
  }
  if (input.case === "selected-server-catch") {
    return exerciseSelectedServerCatch(input.marker);
  }
  return exerciseDiagnosticFailure(input.marker);
}
