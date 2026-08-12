import {
  sinkFailureReasons,
  type DiagnosticSink,
  type DispatchResult,
  type OperationalErrorReport,
  type OperationalEvent,
  type OperationalSink,
  type SinkFailureReason,
  type SinkWriteResult,
} from "./contracts.js";
import { isOperationalErrorReport } from "./diagnostics.js";
import { isOperationalEvent } from "./events.js";
import { isPrivateDataLikeString } from "./redaction.js";

const sinkIdentifierPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;

function isFailureReason(value: unknown): value is SinkFailureReason {
  return (
    typeof value === "string" &&
    sinkFailureReasons.includes(value as SinkFailureReason)
  );
}

function normalizeSinkResult(
  sink: string,
  value: unknown,
): DispatchResult {
  try {
    if (typeof value !== "object" || value === null) {
      throw new TypeError("SINK_RESULT_INVALID");
    }
    const result = value as Readonly<Record<string, unknown>>;
    if (result.status === "delivered") {
      return Object.freeze({ sink, status: "delivered" });
    }
    if (result.status === "failed" && isFailureReason(result.reason)) {
      return Object.freeze({
        sink,
        status: "failed",
        reason: result.reason,
      });
    }
  } catch {
    // Normalize all malformed result shapes below without exposing their content.
  }
  return Object.freeze({
    sink,
    status: "failed",
    reason: "invalid-result",
  });
}

function readSinkIdentifier(value: unknown): string | undefined {
  try {
    if (typeof value !== "object" || value === null) return undefined;
    const identifier = Reflect.get(value, "identifier") as unknown;
    return typeof identifier === "string" &&
      identifier.length <= 64 &&
      sinkIdentifierPattern.test(identifier) &&
      !isPrivateDataLikeString(identifier)
      ? identifier
      : undefined;
  } catch {
    return undefined;
  }
}

function hasSinkMethod(value: unknown, method: "write" | "writeReport"): boolean {
  try {
    return (
      typeof value === "object" &&
      value !== null &&
      typeof Reflect.get(value, method) === "function"
    );
  } catch {
    return false;
  }
}

async function dispatchToSink(
  value: OperationalEvent | OperationalErrorReport,
  sink: unknown,
  method: "write" | "writeReport",
  valid: boolean,
): Promise<DispatchResult> {
  let identifier = "invalid-sink";
  try {
    if (typeof sink !== "object" || sink === null) {
      return Object.freeze({
        sink: identifier,
        status: "failed",
        reason: "invalid-result",
      });
    }

    const candidateIdentifier = Reflect.get(sink, "identifier") as unknown;
    if (
      typeof candidateIdentifier === "string" &&
      candidateIdentifier.length <= 64 &&
      sinkIdentifierPattern.test(candidateIdentifier) &&
      !isPrivateDataLikeString(candidateIdentifier)
    ) {
      identifier = candidateIdentifier;
    }

    const write = Reflect.get(sink, method) as unknown;
    if (typeof write !== "function") {
      return Object.freeze({
        sink: identifier,
        status: "failed",
        reason: "invalid-result",
      });
    }
    if (!valid) {
      return Object.freeze({
        sink: identifier,
        status: "failed",
        reason: "invalid-event",
      });
    }

    const result = (await Reflect.apply(write, sink, [value])) as SinkWriteResult;
    return normalizeSinkResult(identifier, result);
  } catch {
    return Object.freeze({
      sink: identifier,
      status: "failed",
      reason: "sink-threw",
    });
  }
}

export async function dispatchOperationalEvent(
  event: OperationalEvent,
  sinks: readonly OperationalSink[],
): Promise<readonly DispatchResult[]> {
  return Object.freeze(
    await Promise.all(
      sinks.map((sink) =>
        dispatchToSink(event, sink, "write", isOperationalEvent(event)),
      ),
    ),
  );
}

export async function dispatchOperationalErrorReport(
  report: OperationalErrorReport,
  sinks: Readonly<{
    operationalSinks: readonly OperationalSink[];
    diagnosticSinks: readonly DiagnosticSink[];
  }>,
): Promise<readonly DispatchResult[]> {
  try {
    const operationalSinks = sinks.operationalSinks;
    const diagnosticSinks = sinks.diagnosticSinks;
    const valid = isOperationalErrorReport(report);
    if (!Array.isArray(operationalSinks) || !Array.isArray(diagnosticSinks)) {
      return Object.freeze([]);
    }

    const approvedDiagnosticIdentifiers = valid
      ? new Set(
          diagnosticSinks
            .filter((sink) => hasSinkMethod(sink, "writeReport"))
            .map(readSinkIdentifier)
            .filter((identifier): identifier is string => identifier !== undefined),
        )
      : new Set<string>();
    const selectedOperationalSinks = operationalSinks.filter((sink) => {
      const identifier = readSinkIdentifier(sink);
      return (
        identifier === undefined ||
        !approvedDiagnosticIdentifiers.has(identifier)
      );
    });

    return Object.freeze(
      await Promise.all([
        ...selectedOperationalSinks.map((sink) =>
          dispatchToSink(report.event, sink, "write", valid),
        ),
        ...diagnosticSinks.map((sink) =>
          dispatchToSink(report, sink, "writeReport", valid),
        ),
      ]),
    );
  } catch {
    return Object.freeze([]);
  }
}
