import {
  createOperationalEvent,
  dispatchOperationalEvent,
} from "@egeria-systems/observability";
import {
  createBrowserSink,
  type BrowserEnvelope,
} from "@egeria-systems/observability/browser";

type WebVitalInput = Readonly<{
  name: string;
  value: number;
  delta: number;
  rating: string;
  navigationType: string;
}>;

function createCorrelationId(): string {
  return crypto.randomUUID();
}

function createSameOriginSink() {
  return createBrowserSink({
    identifier: "same-origin-route",
    send: async (envelope: BrowserEnvelope) => {
      const { event } = envelope;
      const response = await fetch("/api/observability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        referrerPolicy: "no-referrer",
        keepalive: true,
        body: JSON.stringify({
          schemaVersion: envelope.schemaVersion,
          event: {
            name: event.name,
            kind: event.kind,
            runtime: event.runtime,
            severity: event.severity,
            context: { correlationId: event.context.correlationId },
            ...(event.errorCategory === undefined
              ? {}
              : { errorCategory: event.errorCategory }),
            attributes: event.attributes,
          },
        }),
      });
      return response.ok;
    },
  });
}

function reportBrowserInput(
  input: Parameters<typeof createOperationalEvent>[0],
  allowedAttributeNames: readonly string[],
): void {
  const event = createOperationalEvent(input, {
    allowedAttributeNames,
    clock: { now: () => new Date() },
  });
  if (!event.ok) return;
  void dispatchOperationalEvent(event.value, [createSameOriginSink()]);
}

export function reportBrowserError(
  source: "window-error" | "unhandled-rejection",
): void {
  reportBrowserInput(
    {
      name:
        source === "window-error"
          ? "browser.window.error"
          : "browser.unhandled.rejection",
      kind: "application.error",
      runtime: "browser",
      severity: "error",
      context: { correlationId: createCorrelationId() },
      errorCategory: "unexpected",
      attributes: { source },
    },
    ["source"],
  );
}

export function reportWebVital(metric: WebVitalInput): void {
  reportBrowserInput(
    {
      name: "browser.web.vital",
      kind: "web.vital",
      runtime: "browser",
      severity: "info",
      context: { correlationId: createCorrelationId() },
      attributes: {
        metric_name: metric.name,
        value: metric.value,
        delta: metric.delta,
        rating: metric.rating,
        navigation_type: metric.navigationType,
      },
    },
    ["delta", "metric_name", "navigation_type", "rating", "value"],
  );
}
