import type {
  DiagnosticSink,
  OperationalCaptureMechanism,
  OperationalErrorReport,
  OperationalEvent,
  OperationalSeverity,
  OperationalSink,
} from "./contracts.js";
import { isOperationalErrorReport } from "./diagnostics.js";
import { isOperationalEvent } from "./events.js";

export type MemorySink = Readonly<{
  sink: OperationalSink;
  snapshot: () => readonly OperationalEvent[];
}>;

export type MemoryDiagnosticSink = Readonly<{
  sink: DiagnosticSink;
  snapshot: () => readonly OperationalErrorReport[];
}>;

export function createMemorySink(): MemorySink {
  const events: OperationalEvent[] = [];
  return Object.freeze({
    sink: Object.freeze({
      identifier: "memory",
      write: (event: OperationalEvent) => {
        if (!isOperationalEvent(event)) {
          return Object.freeze({ status: "failed", reason: "invalid-event" });
        }
        events.push(event);
        return Object.freeze({ status: "delivered" });
      },
    }),
    snapshot: () => Object.freeze([...events]),
  });
}

export function createMemoryDiagnosticSink(): MemoryDiagnosticSink {
  const reports: OperationalErrorReport[] = [];
  return Object.freeze({
    sink: Object.freeze({
      identifier: "diagnostic-memory",
      writeReport: (report: OperationalErrorReport) => {
        if (!isOperationalErrorReport(report)) {
          return Object.freeze({ status: "failed", reason: "invalid-event" });
        }
        reports.push(report);
        return Object.freeze({ status: "delivered" });
      },
    }),
    snapshot: () => Object.freeze([...reports]),
  });
}

export function assertOperationalEvent(
  events: readonly OperationalEvent[],
  expected: Readonly<{
    name: string;
    severity?: OperationalSeverity;
  }>,
): OperationalEvent {
  const match = events.find(
    (event) =>
      event.name === expected.name &&
      (expected.severity === undefined ||
        event.severity === expected.severity),
  );
  if (match === undefined) throw new Error("OPERATIONAL_EVENT_NOT_FOUND");
  return match;
}

export function assertOperationalErrorReport(
  reports: readonly OperationalErrorReport[],
  expected: Readonly<{
    eventName: string;
    mechanism?: OperationalCaptureMechanism;
  }>,
): OperationalErrorReport {
  const match = reports.find(
    (report) =>
      isOperationalErrorReport(report) &&
      report.event.name === expected.eventName &&
      (expected.mechanism === undefined ||
        report.capture.mechanism === expected.mechanism),
  );
  if (match === undefined) {
    throw new Error("OPERATIONAL_ERROR_REPORT_NOT_FOUND");
  }
  return match;
}
