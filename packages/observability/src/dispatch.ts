import {
  sinkFailureReasons,
  type DispatchResult,
  type OperationalEvent,
  type OperationalSink,
  type SinkFailureReason,
  type SinkWriteResult,
} from "./contracts.js";
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
  sink: unknown,
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

    const write = Reflect.get(sink, "write") as unknown;
    if (typeof write !== "function") {
      return Object.freeze({
        sink: identifier,
        status: "failed",
        reason: "invalid-result",
      });
    }
    if (!isOperationalEvent(event)) {
      return Object.freeze({
        sink: identifier,
        status: "failed",
        reason: "invalid-event",
      });
    }

    const result = (await Reflect.apply(write, sink, [event])) as SinkWriteResult;
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
    await Promise.all(sinks.map((sink) => dispatchToSink(event, sink))),
  );
}
