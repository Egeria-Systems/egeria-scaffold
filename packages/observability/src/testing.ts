import type {
  OperationalEvent,
  OperationalSeverity,
  OperationalSink,
} from "./contracts.js";
import { isOperationalEvent } from "./events.js";

export type MemorySink = Readonly<{
  sink: OperationalSink;
  snapshot: () => readonly OperationalEvent[];
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
