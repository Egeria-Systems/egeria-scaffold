import {
  registerDiagnosticSinkOperationalReplacement,
  type DiagnosticSink,
  type ErrorCaptureContext,
  type ExceptionDiagnostics,
  type OperationalErrorReport,
  type OperationalEvent,
  type OperationalSink,
  type SinkWriteResult,
} from "./contracts.js";
import { isOperationalErrorReport } from "./diagnostics.js";
import { isOperationalEvent } from "./events.js";
import { utf8ByteLength } from "./redaction.js";

const maximumPayloadBytes = 96_000;
const betterStackHostPattern =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+betterstackdata\.com$/u;
const sourceTokenPattern = /^[A-Za-z0-9._~-]{16,512}$/u;

export type OperationalRecord = Readonly<{
  schema_version: "2.0.0";
  dt: string;
  event_name: string;
  event_kind: OperationalEvent["kind"];
  runtime: OperationalEvent["runtime"];
  severity: OperationalEvent["severity"];
  event_id: string;
  correlation_id?: string;
  release_id?: string;
  service: string;
  environment?: string;
  error_category?: NonNullable<OperationalEvent["errorCategory"]>;
  attributes: OperationalEvent["attributes"];
}>;

export type StructuredLogWriter = (
  record: OperationalRecord,
) => void | Promise<void>;

export type BetterStackRequest = (
  request: Readonly<{
    url: string;
    method: "POST";
    headers: Readonly<Record<string, string>>;
    body: string;
    timeoutMilliseconds: number;
  }>,
) => Promise<Readonly<{ status: number }>>;

export type BetterStackConfigurationResult =
  | Readonly<{ ok: true; value: OperationalSink }>
  | Readonly<{
      ok: false;
      code: "BETTER_STACK_CONFIGURATION_INVALID";
    }>;

export type BetterStackDiagnosticConfigurationResult =
  | Readonly<{ ok: true; value: DiagnosticSink }>
  | Readonly<{
      ok: false;
      code: "BETTER_STACK_CONFIGURATION_INVALID";
    }>;

export type DiagnosticRecord = OperationalRecord &
  Readonly<{
    capture: ErrorCaptureContext;
    "exception.type": string;
    "exception.message"?: string;
    "exception.stacktrace"?: string;
    "exception.code"?: string;
    "exception.digest"?: string;
    "exception.fingerprint": string;
    "exception.cause"?: ExceptionDiagnostics;
    "exception.truncated": boolean;
  }>;

type BetterStackConfiguration = Readonly<{
  ingestingHost: string;
  sourceToken: string;
  request: BetterStackRequest;
  timeoutMilliseconds: number;
}>;

function configurationFailure(): Readonly<{
  ok: false;
  code: "BETTER_STACK_CONFIGURATION_INVALID";
}> {
  return Object.freeze({
    ok: false,
    code: "BETTER_STACK_CONFIGURATION_INVALID",
  });
}

function readBetterStackConfiguration(
  input: Readonly<{
    ingestingHost: string;
    sourceToken: string;
    request: BetterStackRequest;
    timeoutMilliseconds?: number;
  }>,
): BetterStackConfiguration | undefined {
  try {
    const ingestingHost = input.ingestingHost;
    const sourceToken = input.sourceToken;
    const request = input.request;
    const timeoutMilliseconds = input.timeoutMilliseconds ?? 5_000;
    if (
      typeof ingestingHost !== "string" ||
      !betterStackHostPattern.test(ingestingHost) ||
      typeof sourceToken !== "string" ||
      !sourceTokenPattern.test(sourceToken) ||
      typeof request !== "function" ||
      !Number.isInteger(timeoutMilliseconds) ||
      timeoutMilliseconds < 100 ||
      timeoutMilliseconds > 30_000
    ) {
      return undefined;
    }
    return Object.freeze({
      ingestingHost,
      sourceToken,
      request,
      timeoutMilliseconds,
    });
  } catch {
    return undefined;
  }
}

function createOperationalRecord(event: OperationalEvent): OperationalRecord {
  if (!isOperationalEvent(event)) {
    throw new TypeError("OPERATIONAL_EVENT_INVALID");
  }
  return Object.freeze({
    schema_version: "2.0.0" as const,
    dt: event.occurredAt,
    event_name: event.name,
    event_kind: event.kind,
    runtime: event.runtime,
    severity: event.severity,
    event_id: event.context.eventId,
    ...(event.context.correlationId === undefined
      ? {}
      : { correlation_id: event.context.correlationId }),
    ...(event.context.releaseId === undefined
      ? {}
      : { release_id: event.context.releaseId }),
    service: event.context.service,
    ...(event.context.environment === undefined
      ? {}
      : { environment: event.context.environment }),
    ...(event.errorCategory === undefined
      ? {}
      : { error_category: event.errorCategory }),
    attributes: event.attributes,
  });
}

export function serializeOperationalRecord(event: OperationalEvent): string {
  return JSON.stringify(createOperationalRecord(event));
}

function createDiagnosticRecord(
  report: OperationalErrorReport,
): DiagnosticRecord {
  if (!isOperationalErrorReport(report)) {
    throw new TypeError("OPERATIONAL_ERROR_REPORT_INVALID");
  }
  const diagnostics = report.diagnostics;
  return Object.freeze({
    ...createOperationalRecord(report.event),
    capture: report.capture,
    "exception.type": diagnostics.exceptionType,
    ...(diagnostics.exceptionMessage === undefined
      ? {}
      : { "exception.message": diagnostics.exceptionMessage }),
    ...(diagnostics.exceptionStacktrace === undefined
      ? {}
      : { "exception.stacktrace": diagnostics.exceptionStacktrace }),
    ...(diagnostics.exceptionCode === undefined
      ? {}
      : { "exception.code": diagnostics.exceptionCode }),
    ...(diagnostics.exceptionDigest === undefined
      ? {}
      : { "exception.digest": diagnostics.exceptionDigest }),
    "exception.fingerprint": diagnostics.fingerprint,
    ...(diagnostics.cause === undefined
      ? {}
      : { "exception.cause": diagnostics.cause }),
    "exception.truncated": diagnostics.truncated,
  });
}

export function serializeDiagnosticRecord(
  report: OperationalErrorReport,
): string {
  return JSON.stringify(createDiagnosticRecord(report));
}

async function writeBetterStackBody(
  configuration: BetterStackConfiguration,
  body: string,
): Promise<SinkWriteResult> {
  if (utf8ByteLength(body) > maximumPayloadBytes) {
    return Object.freeze({
      status: "failed",
      reason: "payload-too-large",
    });
  }

  try {
    const response = await configuration.request(
      Object.freeze({
        url: `https://${configuration.ingestingHost}`,
        method: "POST",
        headers: Object.freeze({
          Authorization: `Bearer ${configuration.sourceToken}`,
          "Content-Type": "application/json",
        }),
        body,
        timeoutMilliseconds: configuration.timeoutMilliseconds,
      }),
    );
    return response.status === 202
      ? Object.freeze({ status: "delivered" })
      : Object.freeze({
          status: "failed",
          reason: "provider-rejected",
        });
  } catch {
    return Object.freeze({
      status: "failed",
      reason: "network-failure",
    });
  }
}

export function createStructuredLogSink(input: Readonly<{
  identifier: string;
  write: StructuredLogWriter;
}>): OperationalSink {
  return Object.freeze({
    identifier: input.identifier,
    write: async (event): Promise<SinkWriteResult> => {
      if (!isOperationalEvent(event)) {
        return Object.freeze({ status: "failed", reason: "invalid-event" });
      }
      try {
        await input.write(createOperationalRecord(event));
        return Object.freeze({ status: "delivered" });
      } catch {
        return Object.freeze({ status: "failed", reason: "sink-threw" });
      }
    },
  });
}

export function createBetterStackSink(
  input: Readonly<{
    ingestingHost: string;
    sourceToken: string;
    request: BetterStackRequest;
    timeoutMilliseconds?: number;
  }>,
): BetterStackConfigurationResult {
  const configuration = readBetterStackConfiguration(input);
  if (configuration === undefined) return configurationFailure();
  const value: OperationalSink = Object.freeze({
    identifier: "better-stack",
    write: async (event): Promise<SinkWriteResult> => {
      if (!isOperationalEvent(event)) {
        return Object.freeze({ status: "failed", reason: "invalid-event" });
      }
      let body: string;
      try {
        body = serializeOperationalRecord(event);
      } catch {
        return Object.freeze({
          status: "failed",
          reason: "payload-invalid",
        });
      }
      return writeBetterStackBody(configuration, body);
    },
  });

  return Object.freeze({ ok: true, value });
}

export function createBetterStackDiagnosticSink(
  input: Readonly<{
    ingestingHost: string;
    sourceToken: string;
    request: BetterStackRequest;
    timeoutMilliseconds?: number;
  }>,
): BetterStackDiagnosticConfigurationResult {
  const configuration = readBetterStackConfiguration(input);
  if (configuration === undefined) return configurationFailure();
  const value: DiagnosticSink = Object.freeze({
    identifier: "better-stack",
    writeReport: async (report): Promise<SinkWriteResult> => {
      if (!isOperationalErrorReport(report)) {
        return Object.freeze({ status: "failed", reason: "invalid-event" });
      }
      let body: string;
      try {
        body = serializeDiagnosticRecord(report);
      } catch {
        return Object.freeze({ status: "failed", reason: "payload-invalid" });
      }
      return writeBetterStackBody(configuration, body);
    },
  });
  registerDiagnosticSinkOperationalReplacement(value, "better-stack");
  return Object.freeze({ ok: true, value });
}
