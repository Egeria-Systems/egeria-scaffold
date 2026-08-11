import type {
  OperationalEvent,
  OperationalSink,
  SinkWriteResult,
} from "./contracts.js";
import { copyOperationalEvent } from "./events.js";

export type BrowserEnvelope = Readonly<{
  schemaVersion: "1.0.0";
  event: OperationalEvent;
}>;

export type BrowserEnvelopeResult =
  | Readonly<{ ok: true; value: BrowserEnvelope }>
  | Readonly<{ ok: false; code: "BROWSER_EVENT_INVALID" }>;

export function createBrowserEnvelope(
  event: OperationalEvent,
): BrowserEnvelopeResult {
  const copied = copyOperationalEvent(event);
  if (
    copied?.runtime !== "browser" ||
    (copied.kind !== "application.error" && copied.kind !== "web.vital")
  ) {
    return Object.freeze({ ok: false, code: "BROWSER_EVENT_INVALID" });
  }

  return Object.freeze({
    ok: true,
    value: Object.freeze({ schemaVersion: "1.0.0", event: copied }),
  });
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
