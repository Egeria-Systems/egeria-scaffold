import type {
  DiagnosticSink,
  OperationalErrorReport,
  OperationalEvent,
  OperationalSink,
  SinkWriteResult,
} from "./contracts.js";
import {
  createDiagnosticFingerprint,
  isOperationalErrorReport,
  reconstructOperationalErrorReport,
} from "./diagnostics.js";
import { isOperationalEvent } from "./events.js";
import {
  exceptionRedactionMarkers,
  truncateUtf8,
  utf8ByteLength,
} from "./redaction.js";

const maximumBrowserEnvelopeBytes = 8_192;

export type BrowserEnvelope = Readonly<{
  schemaVersion: "2.0.0";
  type: "operational-event";
  event: OperationalEvent;
}>;

export type BrowserEnvelopeResult =
  | Readonly<{ ok: true; value: BrowserEnvelope }>
  | Readonly<{ ok: false; code: "BROWSER_EVENT_INVALID" }>;

export type BrowserErrorEnvelope = Readonly<{
  schemaVersion: "2.0.0";
  type: "error-report";
  report: OperationalErrorReport;
}>;

export type BrowserErrorEnvelopeResult =
  | Readonly<{ ok: true; value: BrowserErrorEnvelope }>
  | Readonly<{
      ok: false;
      code:
        | "BROWSER_ERROR_ENVELOPE_TOO_LARGE"
        | "BROWSER_ERROR_REPORT_INVALID";
    }>;

export function createBrowserEnvelope(
  event: OperationalEvent,
): BrowserEnvelopeResult {
  if (
    !isOperationalEvent(event) ||
    event.runtime !== "browser" ||
    (event.kind !== "application.error" && event.kind !== "web.vital")
  ) {
    return Object.freeze({ ok: false, code: "BROWSER_EVENT_INVALID" });
  }

  return Object.freeze({
    ok: true,
    value: Object.freeze({
      schemaVersion: "2.0.0",
      type: "operational-event",
      event,
    }),
  });
}

function createErrorEnvelope(
  report: OperationalErrorReport,
): BrowserErrorEnvelope {
  return Object.freeze({
    schemaVersion: "2.0.0",
    type: "error-report",
    report,
  });
}

function envelopeByteLength(report: OperationalErrorReport): number {
  return utf8ByteLength(JSON.stringify(createErrorEnvelope(report)));
}

function reconstructWithDiagnostics(
  report: OperationalErrorReport,
  diagnostics: Readonly<Record<string, unknown>>,
): OperationalErrorReport | undefined {
  const exceptionType = diagnostics.exceptionType;
  if (typeof exceptionType !== "string") return undefined;
  const exceptionStacktrace = diagnostics.exceptionStacktrace;
  const exceptionDigest = diagnostics.exceptionDigest;
  const fingerprint = createDiagnosticFingerprint({
    exceptionType,
    ...(typeof exceptionStacktrace === "string" ? { exceptionStacktrace } : {}),
    ...(typeof exceptionDigest === "string" ? { exceptionDigest } : {}),
  });
  const reconstructed = reconstructOperationalErrorReport({
    event: report.event,
    capture: report.capture,
    diagnostics: { ...diagnostics, fingerprint },
  });
  return reconstructed.ok ? reconstructed.value : undefined;
}

function omitDiagnosticField(
  report: OperationalErrorReport,
  field: "cause" | "exceptionMessage" | "exceptionStacktrace",
): Readonly<Record<string, unknown>> {
  return Object.fromEntries(
    Object.entries(report.diagnostics).filter(([name]) => name !== field),
  );
}

function removeDiagnosticCause(
  report: OperationalErrorReport,
): OperationalErrorReport | undefined {
  return reconstructWithDiagnostics(report, {
    ...omitDiagnosticField(report, "cause"),
    truncated: true,
  });
}

function replaceDiagnosticStack(
  report: OperationalErrorReport,
  value: string | undefined,
): OperationalErrorReport | undefined {
  return reconstructWithDiagnostics(report, {
    ...omitDiagnosticField(report, "exceptionStacktrace"),
    ...(value === undefined ? {} : { exceptionStacktrace: value }),
    truncated: true,
  });
}

function replaceDiagnosticMessage(
  report: OperationalErrorReport,
  value: string | undefined,
): OperationalErrorReport | undefined {
  return reconstructWithDiagnostics(report, {
    ...omitDiagnosticField(report, "exceptionMessage"),
    ...(value === undefined ? {} : { exceptionMessage: value }),
    truncated: true,
  });
}

function minimumStackPrefixBytes(stack: string): number {
  const lines = stack.split("\n");
  const topFrameIndex = lines.findIndex((line) => line.trim().startsWith("at "));
  if (topFrameIndex < 0) {
    return utf8ByteLength(exceptionRedactionMarkers.truncated);
  }
  const protectedPrefix = `${lines.slice(0, topFrameIndex + 1).join("\n")}\n`;
  return (
    utf8ByteLength(protectedPrefix) +
    utf8ByteLength(exceptionRedactionMarkers.truncated)
  );
}

function truncateOptionalText(
  report: OperationalErrorReport,
  value: string,
  minimumBytes: number,
  replace: (
    report: OperationalErrorReport,
    value: string | undefined,
  ) => OperationalErrorReport | undefined,
  minimumFallback: "omit" | "preserve",
): OperationalErrorReport | undefined {
  const maximumBytes = utf8ByteLength(value) - 1;
  const minimumCandidate = replace(
    report,
    truncateUtf8(value, minimumBytes).value,
  );
  if (minimumCandidate === undefined) return undefined;
  if (envelopeByteLength(minimumCandidate) > maximumBrowserEnvelopeBytes) {
    if (minimumFallback === "preserve") return minimumCandidate;
    return replace(report, undefined);
  }

  let selected = minimumCandidate;
  let lowerBound = minimumBytes;
  let upperBound = maximumBytes;
  while (lowerBound <= upperBound) {
    const midpoint = Math.floor((lowerBound + upperBound) / 2);
    const candidate = replace(report, truncateUtf8(value, midpoint).value);
    if (
      candidate !== undefined &&
      envelopeByteLength(candidate) <= maximumBrowserEnvelopeBytes
    ) {
      selected = candidate;
      lowerBound = midpoint + 1;
    } else {
      upperBound = midpoint - 1;
    }
  }
  return selected;
}

function fitBrowserErrorReport(
  report: OperationalErrorReport,
): OperationalErrorReport | undefined {
  let candidate = report;
  if (envelopeByteLength(candidate) <= maximumBrowserEnvelopeBytes) {
    return candidate;
  }

  if (candidate.diagnostics.cause !== undefined) {
    const withoutCause = removeDiagnosticCause(candidate);
    if (withoutCause === undefined) return undefined;
    candidate = withoutCause;
    if (envelopeByteLength(candidate) <= maximumBrowserEnvelopeBytes) {
      return candidate;
    }
  }

  const stack = candidate.diagnostics.exceptionStacktrace;
  if (stack !== undefined) {
    const stackBounded = truncateOptionalText(
      candidate,
      stack,
      minimumStackPrefixBytes(stack),
      replaceDiagnosticStack,
      "preserve",
    );
    if (stackBounded === undefined) return undefined;
    candidate = stackBounded;
    if (envelopeByteLength(candidate) <= maximumBrowserEnvelopeBytes) {
      return candidate;
    }
  }

  const message = candidate.diagnostics.exceptionMessage;
  if (message !== undefined) {
    const messageBounded = truncateOptionalText(
      candidate,
      message,
      utf8ByteLength(exceptionRedactionMarkers.truncated),
      replaceDiagnosticMessage,
      "omit",
    );
    if (messageBounded === undefined) return undefined;
    candidate = messageBounded;
  }

  return envelopeByteLength(candidate) <= maximumBrowserEnvelopeBytes
    ? candidate
    : undefined;
}

export function createBrowserErrorEnvelope(
  report: OperationalErrorReport,
): BrowserErrorEnvelopeResult {
  if (
    !isOperationalErrorReport(report) ||
    report.event.runtime !== "browser" ||
    report.event.kind !== "application.error"
  ) {
    return Object.freeze({
      ok: false,
      code: "BROWSER_ERROR_REPORT_INVALID",
    });
  }

  try {
    const fittedReport = fitBrowserErrorReport(report);
    if (fittedReport === undefined) {
      return Object.freeze({
        ok: false,
        code: "BROWSER_ERROR_ENVELOPE_TOO_LARGE",
      });
    }
    return Object.freeze({
      ok: true,
      value: createErrorEnvelope(fittedReport),
    });
  } catch {
    return Object.freeze({
      ok: false,
      code: "BROWSER_ERROR_REPORT_INVALID",
    });
  }
}

export function createBrowserSink(input: Readonly<{
  identifier: string;
  send: (envelope: BrowserEnvelope) => boolean | Promise<boolean>;
}>): OperationalSink {
  return Object.freeze({
    identifier: input.identifier,
    write: async (event): Promise<SinkWriteResult> => {
      const envelope = createBrowserEnvelope(event);
      if (!envelope.ok) {
        return Object.freeze({ status: "failed", reason: "invalid-event" });
      }
      try {
        return (await input.send(envelope.value))
          ? Object.freeze({ status: "delivered" })
          : Object.freeze({
              status: "failed",
              reason: "transport-rejected",
            });
      } catch {
        return Object.freeze({
          status: "failed",
          reason: "network-failure",
        });
      }
    },
  });
}

export function createBrowserDiagnosticSink(input: Readonly<{
  identifier: string;
  send: (envelope: BrowserErrorEnvelope) => boolean | Promise<boolean>;
}>): DiagnosticSink {
  return Object.freeze({
    identifier: input.identifier,
    writeReport: async (report): Promise<SinkWriteResult> => {
      const envelope = createBrowserErrorEnvelope(report);
      if (!envelope.ok) {
        return Object.freeze({
          status: "failed",
          reason:
            envelope.code === "BROWSER_ERROR_ENVELOPE_TOO_LARGE"
              ? "payload-too-large"
              : "invalid-event",
        });
      }
      try {
        return (await input.send(envelope.value))
          ? Object.freeze({ status: "delivered" })
          : Object.freeze({
              status: "failed",
              reason: "transport-rejected",
            });
      } catch {
        return Object.freeze({
          status: "failed",
          reason: "network-failure",
        });
      }
    },
  });
}
