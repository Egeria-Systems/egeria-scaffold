import {
  sinkFailureReasons,
  type DispatchResult,
  type OperationalEvent,
  type OperationalSink,
  type SinkFailureReason,
  type SinkWriteResult,
} from "./contracts.js";

const sinkIdentifierPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;

function isFailureReason(value: unknown): value is SinkFailureReason {
  return (
    typeof value === "string" &&
    sinkFailureReasons.includes(value as SinkFailureReason)
  );
}

function normalizeSinkResult(
  sink: string,
  value: SinkWriteResult,
): DispatchResult {
  if (value.status === "delivered") {
    return Object.freeze({ sink, status: "delivered" });
  }
  if (isFailureReason(value.reason)) {
    return Object.freeze({ sink, status: "failed", reason: value.reason });
  }
  return Object.freeze({
    sink,
    status: "failed",
    reason: "invalid-result",
  });
}

async function dispatchToSink(
  event: OperationalEvent,
  sink: OperationalSink,
): Promise<DispatchResult> {
  const identifier = sinkIdentifierPattern.test(sink.identifier)
    ? sink.identifier
    : "invalid-sink";
  try {
    return normalizeSinkResult(identifier, await sink.write(event));
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
    await Promise.all(sinks.map((sink) => dispatchToSink(event, sink))),
  );
}
