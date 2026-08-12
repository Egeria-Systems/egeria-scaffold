import {
  operationalCaptureMechanisms,
  operationalRenderSources,
  operationalRenderTypes,
  operationalRevalidateReasons,
  operationalRouteTypes,
  operationalRouterKinds,
  type CreateOperationalErrorReportOptions,
  type ErrorCaptureContext,
  type ExceptionDiagnostics,
  type OperationalErrorReport,
  type OperationalErrorReportResult,
  type OperationalEvent,
} from "./contracts.js";
import { createOperationalEvent, isOperationalEvent } from "./events.js";
import {
  isPrivateDataLikeString,
  redactExceptionText,
  truncateUtf8,
  utf8ByteLength,
} from "./redaction.js";

const maximumMessageBytes = 2_048;
const maximumStackBytes = 16_384;
const maximumStackLines = 64;
const maximumCauseLinks = 2;
const boundedTokenPattern = /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/u;
const operationPattern = /^[a-z][a-z0-9.-]{0,63}$/u;
const routeIdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:/[\]()-]{0,255}$/u;
const fingerprintPattern = /^fnv1a32-v1:[a-f0-9]{8}$/u;
const requestMethods = Object.freeze([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const);
const captureKeys = Object.freeze([
  "handled",
  "mechanism",
  "operation",
  "renderSource",
  "renderType",
  "requestMethod",
  "revalidateReason",
  "routeIdentifier",
  "routeType",
  "routerKind",
]);
const reportKeys = Object.freeze(["capture", "diagnostics", "event"]);
const diagnosticKeys = Object.freeze([
  "cause",
  "exceptionCode",
  "exceptionDigest",
  "exceptionMessage",
  "exceptionStacktrace",
  "exceptionType",
  "fingerprint",
  "truncated",
]);
const eventKeys = Object.freeze([
  "attributes",
  "context",
  "errorCategory",
  "kind",
  "name",
  "occurredAt",
  "runtime",
  "schemaVersion",
  "severity",
]);
const createdReports = new WeakSet();

function includes<const Value extends string>(
  values: readonly Value[],
  value: unknown,
): value is Value {
  return typeof value === "string" && values.includes(value as Value);
}

function isPlainRecord(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  try {
    const prototype = Object.getPrototypeOf(value) as unknown;
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function hasOnlyKeys(
  value: Readonly<Record<string, unknown>>,
  allowed: readonly string[],
): boolean {
  try {
    return Object.keys(value).every((key) => allowed.includes(key));
  } catch {
    return false;
  }
}

function hasAllKeys(
  value: Readonly<Record<string, unknown>>,
  required: readonly string[],
): boolean {
  try {
    return required.every((key) => key in value);
  } catch {
    return false;
  }
}

function readField(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  try {
    return Reflect.get(value, key) as unknown;
  } catch {
    return undefined;
  }
}

function readBoundedToken(value: unknown): string | undefined {
  return typeof value === "string" &&
    boundedTokenPattern.test(value) &&
    !isPrivateDataLikeString(value)
    ? value
    : undefined;
}

function resultFailure(
  code: Extract<OperationalErrorReportResult, { ok: false }>["code"],
): OperationalErrorReportResult {
  return Object.freeze({ ok: false, code });
}

function createCaptureContext(
  value: unknown,
  event: OperationalEvent,
): ErrorCaptureContext | undefined {
  if (!isPlainRecord(value) || !hasOnlyKeys(value, captureKeys)) {
    return undefined;
  }
  try {
    const mechanism = value.mechanism;
    const handled = value.handled;
    const operation = value.operation;
    const routerKind = value.routerKind;
    const routeType = value.routeType;
    const renderSource = value.renderSource;
    const renderType = value.renderType;
    const revalidateReason = value.revalidateReason;
    const requestMethod = value.requestMethod;
    const routeIdentifier = value.routeIdentifier;
    if (
      !includes(operationalCaptureMechanisms, mechanism) ||
      typeof handled !== "boolean" ||
      (operation !== undefined &&
        (typeof operation !== "string" ||
          !operationPattern.test(operation) ||
          isPrivateDataLikeString(operation))) ||
      (routerKind !== undefined &&
        !includes(operationalRouterKinds, routerKind)) ||
      (routeType !== undefined && !includes(operationalRouteTypes, routeType)) ||
      (renderSource !== undefined &&
        !includes(operationalRenderSources, renderSource)) ||
      (renderType !== undefined &&
        !includes(operationalRenderTypes, renderType)) ||
      (revalidateReason !== undefined &&
        !includes(operationalRevalidateReasons, revalidateReason)) ||
      (requestMethod !== undefined && !includes(requestMethods, requestMethod)) ||
      (routeIdentifier !== undefined &&
        (typeof routeIdentifier !== "string" ||
          !routeIdentifierPattern.test(routeIdentifier) ||
          isPrivateDataLikeString(routeIdentifier)))
    ) {
      return undefined;
    }

    const browserMechanism =
      mechanism === "browser-error-event" ||
      mechanism === "browser-unhandled-rejection" ||
      mechanism === "react-error-boundary";
    if (
      (browserMechanism && event.runtime !== "browser") ||
      (mechanism === "next-request-error" && event.runtime !== "server")
    ) {
      return undefined;
    }

    return Object.freeze({
      mechanism,
      handled,
      ...(typeof operation === "string" ? { operation } : {}),
      ...(typeof routerKind === "string" ? { routerKind } : {}),
      ...(typeof routeType === "string" ? { routeType } : {}),
      ...(typeof renderSource === "string" ? { renderSource } : {}),
      ...(typeof renderType === "string" ? { renderType } : {}),
      ...(typeof revalidateReason === "string" ? { revalidateReason } : {}),
      ...(typeof requestMethod === "string" ? { requestMethod } : {}),
      ...(typeof routeIdentifier === "string" ? { routeIdentifier } : {}),
    });
  } catch {
    return undefined;
  }
}

function encodeUtf8(value: string): readonly number[] {
  const bytes: number[] = [];
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
    } else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      bytes.push(
        0xe0 | (codePoint >> 12),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }
  return bytes;
}

function fnv1a32(value: string): string {
  let hash = 0x811c9dc5;
  for (const byte of encodeUtf8(value)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function findTopFrame(stack: string | undefined): string | undefined {
  return stack
    ?.split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("at "));
}

export function createDiagnosticFingerprint(input: Readonly<{
  exceptionType: string;
  exceptionStacktrace?: string;
  exceptionDigest?: string;
}>): string {
  const basis = [
    input.exceptionType,
    findTopFrame(input.exceptionStacktrace),
    input.exceptionDigest,
  ]
    .filter((value): value is string => value !== undefined)
    .join("|");
  return `fnv1a32-v1:${fnv1a32(basis)}`;
}

function sanitizeText(
  value: unknown,
  maximumBytes: number,
): Readonly<{ value?: string; changed: boolean }> {
  if (typeof value !== "string" || value.length === 0) {
    return Object.freeze({ changed: false });
  }
  const redacted = redactExceptionText(value);
  const bounded = truncateUtf8(redacted.value, maximumBytes);
  return Object.freeze({
    value: bounded.value,
    changed: redacted.redacted || bounded.truncated,
  });
}

function sanitizeStack(
  value: unknown,
): Readonly<{ value?: string; changed: boolean }> {
  if (typeof value !== "string" || value.length === 0) {
    return Object.freeze({ changed: false });
  }
  const redacted = redactExceptionText(value);
  const lines = redacted.value.split("\n");
  const lineBounded =
    lines.length <= maximumStackLines
      ? lines.join("\n")
      : [...lines.slice(0, maximumStackLines - 1), "[TRUNCATED]"].join("\n");
  const byteBounded = truncateUtf8(lineBounded, maximumStackBytes);
  return Object.freeze({
    value: byteBounded.value,
    changed:
      redacted.redacted || lines.length > maximumStackLines || byteBounded.truncated,
  });
}

function createExceptionDiagnostics(
  error: unknown,
  depth: number,
  seen: WeakSet<object>,
): ExceptionDiagnostics {
  const objectLike = typeof error === "object" && error !== null;
  if (objectLike) {
    if (seen.has(error)) {
      const exceptionType = "CyclicCause";
      return Object.freeze({
        exceptionType,
        fingerprint: createDiagnosticFingerprint({ exceptionType }),
        truncated: true,
      });
    }
    seen.add(error);
  }

  const primitiveReason = !objectLike && typeof error === "string";
  const exceptionType = primitiveReason
    ? "NonErrorRejection"
    : (readBoundedToken(readField(error, "name")) ??
      (objectLike ? "Error" : "NonErrorRejection"));
  const message = sanitizeText(
    primitiveReason ? error : readField(error, "message"),
    maximumMessageBytes,
  );
  const stack = sanitizeStack(readField(error, "stack"));
  const exceptionCode = readBoundedToken(readField(error, "code"));
  const exceptionDigest = readBoundedToken(readField(error, "digest"));
  const causeValue = readField(error, "cause");
  const causeOmitted =
    causeValue !== undefined &&
    (depth >= maximumCauseLinks ||
      (typeof causeValue === "object" &&
        causeValue !== null &&
        seen.has(causeValue)));
  const cause =
    causeValue === undefined || causeOmitted
      ? undefined
      : createExceptionDiagnostics(causeValue, depth + 1, seen);
  const fingerprint = createDiagnosticFingerprint({
    exceptionType,
    ...(stack.value === undefined ? {} : { exceptionStacktrace: stack.value }),
    ...(exceptionDigest === undefined ? {} : { exceptionDigest }),
  });

  return Object.freeze({
    exceptionType,
    ...(message.value === undefined ? {} : { exceptionMessage: message.value }),
    ...(stack.value === undefined ? {} : { exceptionStacktrace: stack.value }),
    ...(exceptionCode === undefined ? {} : { exceptionCode }),
    ...(exceptionDigest === undefined ? {} : { exceptionDigest }),
    fingerprint,
    ...(cause === undefined ? {} : { cause }),
    truncated:
      message.changed ||
      stack.changed ||
      causeOmitted ||
      cause?.truncated === true,
  });
}

function createReport(
  event: OperationalEvent,
  capture: ErrorCaptureContext,
  diagnostics: ExceptionDiagnostics,
): OperationalErrorReport {
  const report = Object.freeze({ event, capture, diagnostics });
  createdReports.add(report);
  return report;
}

export function createOperationalErrorReport(
  event: OperationalEvent,
  error: unknown,
  captureInput: ErrorCaptureContext,
  options: CreateOperationalErrorReportOptions,
): OperationalErrorReportResult {
  if (!isOperationalEvent(event) || event.kind !== "application.error") {
    return resultFailure("ERROR_REPORT_EVENT_INVALID");
  }
  try {
    if (!isPlainRecord(options) || Object.keys(options).length !== 0) {
      return resultFailure("ERROR_REPORT_INPUT_INVALID");
    }
    const capture = createCaptureContext(captureInput, event);
    if (capture === undefined) {
      return resultFailure("ERROR_REPORT_CAPTURE_INVALID");
    }
    const value = createReport(
      event,
      capture,
      createExceptionDiagnostics(error, 0, new WeakSet()),
    );
    return Object.freeze({ ok: true, value });
  } catch {
    return resultFailure("ERROR_REPORT_INPUT_INVALID");
  }
}

function reconstructEvent(value: unknown): OperationalEvent | undefined {
  if (!isPlainRecord(value) || !hasOnlyKeys(value, eventKeys)) return undefined;
  try {
    if (value.schemaVersion !== "2.0.0" || typeof value.occurredAt !== "string") {
      return undefined;
    }
    const attributes = value.attributes;
    if (!isPlainRecord(attributes)) return undefined;
    const allowedAttributeNames = Object.keys(attributes);
    const created = createOperationalEvent(
      {
        name: value.name as never,
        kind: value.kind as never,
        runtime: value.runtime as never,
        severity: value.severity as never,
        context: value.context as never,
        ...(value.errorCategory === undefined
          ? {}
          : { errorCategory: value.errorCategory as never }),
        attributes,
      },
      {
        allowedAttributeNames,
        clock: { now: () => new Date(value.occurredAt as string) },
      },
    );
    return created.ok && created.value.occurredAt === value.occurredAt
      ? created.value
      : undefined;
  } catch {
    return undefined;
  }
}

function reconstructDiagnostics(
  value: unknown,
  depth: number,
): ExceptionDiagnostics | undefined {
  if (
    !isPlainRecord(value) ||
    !hasOnlyKeys(value, diagnosticKeys) ||
    depth > maximumCauseLinks
  ) {
    return undefined;
  }
  try {
    const exceptionType = readBoundedToken(value.exceptionType);
    const fingerprint = value.fingerprint;
    const truncated = value.truncated;
    const message = sanitizeText(value.exceptionMessage, maximumMessageBytes);
    const stack = sanitizeStack(value.exceptionStacktrace);
    const exceptionCode =
      value.exceptionCode === undefined
        ? undefined
        : readBoundedToken(value.exceptionCode);
    const exceptionDigest =
      value.exceptionDigest === undefined
        ? undefined
        : readBoundedToken(value.exceptionDigest);
    if (
      exceptionType === undefined ||
      typeof fingerprint !== "string" ||
      !fingerprintPattern.test(fingerprint) ||
      typeof truncated !== "boolean" ||
      (value.exceptionMessage !== undefined && message.value !== value.exceptionMessage) ||
      (value.exceptionStacktrace !== undefined &&
        stack.value !== value.exceptionStacktrace) ||
      (value.exceptionCode !== undefined && exceptionCode === undefined) ||
      (value.exceptionDigest !== undefined && exceptionDigest === undefined)
    ) {
      return undefined;
    }
    const cause =
      value.cause === undefined
        ? undefined
        : reconstructDiagnostics(value.cause, depth + 1);
    if (value.cause !== undefined && cause === undefined) return undefined;
    const expectedFingerprint = createDiagnosticFingerprint({
      exceptionType,
      ...(stack.value === undefined ? {} : { exceptionStacktrace: stack.value }),
      ...(exceptionDigest === undefined ? {} : { exceptionDigest }),
    });
    if (fingerprint !== expectedFingerprint) return undefined;
    return Object.freeze({
      exceptionType,
      ...(message.value === undefined ? {} : { exceptionMessage: message.value }),
      ...(stack.value === undefined ? {} : { exceptionStacktrace: stack.value }),
      ...(exceptionCode === undefined ? {} : { exceptionCode }),
      ...(exceptionDigest === undefined ? {} : { exceptionDigest }),
      fingerprint,
      ...(cause === undefined ? {} : { cause }),
      truncated,
    });
  } catch {
    return undefined;
  }
}

export function reconstructOperationalErrorReport(
  value: unknown,
): OperationalErrorReportResult {
  if (
    !isPlainRecord(value) ||
    !hasOnlyKeys(value, reportKeys) ||
    !hasAllKeys(value, reportKeys)
  ) {
    return resultFailure("ERROR_REPORT_INPUT_INVALID");
  }
  try {
    const event = reconstructEvent(value.event);
    if (event?.kind !== "application.error") {
      return resultFailure("ERROR_REPORT_EVENT_INVALID");
    }
    const capture = createCaptureContext(value.capture, event);
    if (capture === undefined) {
      return resultFailure("ERROR_REPORT_CAPTURE_INVALID");
    }
    const diagnostics = reconstructDiagnostics(value.diagnostics, 0);
    if (diagnostics === undefined) {
      return resultFailure("ERROR_REPORT_DIAGNOSTICS_INVALID");
    }
    return Object.freeze({
      ok: true,
      value: createReport(event, capture, diagnostics),
    });
  } catch {
    return resultFailure("ERROR_REPORT_INPUT_INVALID");
  }
}

export function isOperationalErrorReport(
  value: unknown,
): value is OperationalErrorReport {
  return (
    typeof value === "object" &&
    value !== null &&
    createdReports.has(value)
  );
}

export const diagnosticLimits = Object.freeze({
  maximumCauseLinks,
  maximumMessageBytes,
  maximumStackBytes,
  maximumStackLines,
});

export function hasValidDiagnosticBounds(
  diagnostics: ExceptionDiagnostics,
): boolean {
  return (
    (diagnostics.exceptionMessage === undefined ||
      utf8ByteLength(diagnostics.exceptionMessage) <= maximumMessageBytes) &&
    (diagnostics.exceptionStacktrace === undefined ||
      (utf8ByteLength(diagnostics.exceptionStacktrace) <= maximumStackBytes &&
        diagnostics.exceptionStacktrace.split("\n").length <= maximumStackLines))
  );
}
