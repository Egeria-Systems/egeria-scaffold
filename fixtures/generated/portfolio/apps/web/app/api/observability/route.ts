import {
  reportBrowserEvent,
  type BrowserOperationalInput,
} from "../../../src/infrastructure/observability/server-reporter";

const maximumPayloadBytes = 8_192;
const correlationIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const prohibitedTokenPattern =
  /(?:authorization|bearer|cookie|password|secret|token)/iu;
const webVitalNames = ["CLS", "FCP", "FID", "INP", "LCP", "TTFB"] as const;
const webVitalRatings = ["good", "needs-improvement", "poor"] as const;
const navigationTypes = [
  "navigate",
  "reload",
  "back-forward",
  "back-forward-cache",
  "prerender",
  "restore",
] as const;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Readonly<Record<string, unknown>>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function includes<const Value extends string>(
  values: readonly Value[],
  value: unknown,
): value is Value {
  return typeof value === "string" && values.includes(value as Value);
}

function readCorrelationId(value: unknown): string | undefined {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["correlationId"]) ||
    typeof value.correlationId !== "string" ||
    !correlationIdPattern.test(value.correlationId) ||
    prohibitedTokenPattern.test(value.correlationId)
  ) {
    return undefined;
  }
  return value.correlationId;
}

function readErrorEvent(
  event: Readonly<Record<string, unknown>>,
  correlationId: string,
): BrowserOperationalInput | undefined {
  if (
    !hasExactKeys(event, [
      "attributes",
      "context",
      "errorCategory",
      "kind",
      "name",
      "runtime",
      "severity",
    ]) ||
    event.kind !== "application.error" ||
    event.runtime !== "browser" ||
    event.severity !== "error" ||
    event.errorCategory !== "unexpected" ||
    !isRecord(event.attributes) ||
    !hasExactKeys(event.attributes, ["source"])
  ) {
    return undefined;
  }
  const source = event.attributes.source;
  const name = event.name;
  if (
    (source !== "window-error" && source !== "unhandled-rejection") ||
    (name !== "browser.window.error" &&
      name !== "browser.unhandled.rejection") ||
    (source === "window-error") !== (name === "browser.window.error")
  ) {
    return undefined;
  }
  return Object.freeze({
    name,
    kind: "application.error",
    severity: "error",
    correlationId,
    errorCategory: "unexpected",
    attributes: Object.freeze({ source }),
    allowedAttributeNames: Object.freeze(["source"]),
  });
}

function readWebVitalEvent(
  event: Readonly<Record<string, unknown>>,
  correlationId: string,
): BrowserOperationalInput | undefined {
  if (
    !hasExactKeys(event, [
      "attributes",
      "context",
      "kind",
      "name",
      "runtime",
      "severity",
    ]) ||
    event.name !== "browser.web.vital" ||
    event.kind !== "web.vital" ||
    event.runtime !== "browser" ||
    event.severity !== "info" ||
    !isRecord(event.attributes) ||
    !hasExactKeys(event.attributes, [
      "delta",
      "metricName",
      "navigationType",
      "rating",
      "value",
    ]) ||
    !includes(webVitalNames, event.attributes.metricName) ||
    typeof event.attributes.value !== "number" ||
    !Number.isFinite(event.attributes.value) ||
    Math.abs(event.attributes.value) > 1_000_000_000 ||
    typeof event.attributes.delta !== "number" ||
    !Number.isFinite(event.attributes.delta) ||
    Math.abs(event.attributes.delta) > 1_000_000_000 ||
    !includes(webVitalRatings, event.attributes.rating) ||
    !includes(navigationTypes, event.attributes.navigationType)
  ) {
    return undefined;
  }
  return Object.freeze({
    name: "browser.web.vital",
    kind: "web.vital",
    severity: "info",
    correlationId,
    attributes: Object.freeze({
      metricName: event.attributes.metricName,
      value: event.attributes.value,
      delta: event.attributes.delta,
      rating: event.attributes.rating,
      navigationType: event.attributes.navigationType,
    }),
    allowedAttributeNames: Object.freeze([
      "delta",
      "metricName",
      "navigationType",
      "rating",
      "value",
    ]),
  });
}

function readBrowserEvent(value: unknown): BrowserOperationalInput | undefined {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["event", "schemaVersion"]) ||
    value.schemaVersion !== "1.0.0" ||
    !isRecord(value.event)
  ) {
    return undefined;
  }
  const correlationId = readCorrelationId(value.event.context);
  if (correlationId === undefined) return undefined;
  return value.event.kind === "application.error"
    ? readErrorEvent(value.event, correlationId)
    : readWebVitalEvent(value.event, correlationId);
}

function emptyResponse(status: number): Response {
  return new Response(null, { status });
}

type BoundedBodyResult =
  | { readonly ok: true; readonly source: string }
  | { readonly ok: false; readonly reason: "invalid" | "too-large" };

async function readBoundedBody(request: Request): Promise<BoundedBodyResult> {
  if (request.body === null) return { ok: true, source: "" };

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let source = "";
  let totalBytes = 0;

  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;

      totalBytes += chunk.value.byteLength;
      if (totalBytes > maximumPayloadBytes) {
        try {
          await reader.cancel();
        } catch {
          // The bounded rejection is unchanged when cancellation fails.
        }
        return { ok: false, reason: "too-large" };
      }
      source += decoder.decode(chunk.value, { stream: true });
    }

    source += decoder.decode();
    return { ok: true, source };
  } catch {
    try {
      await reader.cancel();
    } catch {
      // The invalid-body response is unchanged when cancellation fails.
    }
    return { ok: false, reason: "invalid" };
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: Request): Promise<Response> {
  const requestURL = new URL(request.url);
  if (request.headers.get("origin") !== requestURL.origin) {
    return emptyResponse(403);
  }
  if (
    request.headers.get("content-type")?.split(";", 1)[0] !==
    "application/json"
  ) {
    return emptyResponse(415);
  }

  const declaredLength = request.headers.get("content-length");
  if (
    declaredLength !== null &&
    (!/^\d+$/u.test(declaredLength) ||
      Number(declaredLength) > maximumPayloadBytes)
  ) {
    return emptyResponse(413);
  }

  const body = await readBoundedBody(request);
  if (!body.ok) {
    return emptyResponse(body.reason === "too-large" ? 413 : 400);
  }

  let report: BrowserOperationalInput | undefined;
  try {
    report = readBrowserEvent(JSON.parse(body.source) as unknown);
  } catch {
    return emptyResponse(400);
  }
  if (report === undefined) return emptyResponse(400);

  try {
    await reportBrowserEvent(report);
  } catch {
    // A reporting failure cannot change the application response.
  }
  return emptyResponse(202);
}
