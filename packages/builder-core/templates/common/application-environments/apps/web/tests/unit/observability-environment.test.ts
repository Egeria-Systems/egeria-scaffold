import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createOperationalErrorReport, createOperationalEvent } from "@egeria-systems/observability";
import { createBrowserErrorEnvelope } from "@egeria-systems/observability/browser";
import { POST } from "@/app/api/observability/route";
import { readObservabilityRuntimeContext } from "@/src/infrastructure/cloudflare/observability-context";
import { reportCaughtBrowserError, reportWebVital } from "@/src/infrastructure/observability/browser-reporter";
import { reportCaughtServerError } from "@/src/infrastructure/observability/server-reporter";

const { getCloudflareContext } = vi.hoisted(() => ({ getCloudflareContext: vi.fn() }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext }));

const scheduled: Promise<unknown>[] = [];
const runtime: Record<string, unknown> = {};
const requests = vi.fn<typeof fetch>();
const records: unknown[] = [];
const provider = { BETTER_STACK_INGESTING_HOST: "s123.eu-nbg-2.betterstackdata.com", BETTER_STACK_SOURCE_TOKEN: "controlled-source-value-123456" };

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APPLICATION_ENVIRONMENT", "staging");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://staging.example.test");
  for (const key of Object.keys(runtime)) delete runtime[key];
  runtime.APPLICATION_ENVIRONMENT = "staging";
  scheduled.length = 0;
  records.length = 0;
  requests.mockResolvedValue(new Response(null, { status: 202 }));
  vi.stubGlobal("fetch", requests);
  vi.spyOn(console, "info").mockImplementation(record => { records.push(record); });
  getCloudflareContext.mockResolvedValue({ env: runtime, ctx: { waitUntil(task: Promise<unknown>) { scheduled.push(task); } } });
});

afterEach(async () => {
  await Promise.all(scheduled);
  vi.restoreAllMocks();
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function report() {
  await reportCaughtServerError(new Error("synthetic failure"), { operation: "load-example" });
  await Promise.all(scheduled);
}

function browserError() {
  const event = createOperationalEvent({
    name: "browser.caught.error", kind: "application.error", runtime: "browser", severity: "error",
    context: { eventId: "browser-example-123", service: "web" }, errorCategory: "unexpected",
    attributes: { capture_mechanism: "selected-catch", handled: true, operation: "load-example" },
  }, { allowedAttributeNames: ["capture_mechanism", "handled", "operation"], clock: { now: () => new Date() } });
  if (!event.ok) throw new Error("Invalid test event");
  const report = createOperationalErrorReport(event.value, { name: "Error", message: "synthetic browser failure", stack: "Error: synthetic browser failure\n    at render (https://staging.example.test/app.js:12:4)" }, { mechanism: "selected-catch", handled: true, operation: "load-example" }, {});
  if (!report.ok) throw new Error("Invalid test report");
  const envelope = createBrowserErrorEnvelope(report.value);
  if (!envelope.ok) throw new Error("Invalid test envelope");
  return envelope.value;
}

const vital = {
  schemaVersion: "2.0.0", type: "operational-event",
  event: { schemaVersion: "2.0.0", name: "browser.web.vital", kind: "web.vital", runtime: "browser", severity: "info",
    occurredAt: "2026-09-27T00:00:00.000Z", context: { eventId: "vital-example-123", service: "web" },
    attributes: { metric_name: "LCP", value: 12, delta: 1, rating: "good", navigation_type: "navigate" } },
};

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://staging.example.test/api/observability", {
    method: "POST", headers: { origin: "https://staging.example.test", "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

it.each(["development", "staging", "production"])("labels console-only events for matched %s without restricted fields", async target => {
  vi.stubEnv("NEXT_PUBLIC_APPLICATION_ENVIRONMENT", target);
  runtime.APPLICATION_ENVIRONMENT = target;
  const context = await readObservabilityRuntimeContext();
  expect(context.applicationEnvironment).toBe(target);
  await report();
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({ event_name: "server.caught.error", environment: target });
  expect(JSON.stringify(records)).not.toMatch(/synthetic failure|exception\.message|exception\.stacktrace/u);
  expect(requests).not.toHaveBeenCalled();
});

it.each([
  { BETTER_STACK_INGESTING_HOST: provider.BETTER_STACK_INGESTING_HOST },
  { BETTER_STACK_SOURCE_TOKEN: provider.BETTER_STACK_SOURCE_TOKEN },
  { BETTER_STACK_INGESTING_HOST: null },
  { BETTER_STACK_SOURCE_TOKEN: 42 },
  { BETTER_STACK_INGESTING_HOST: " " },
])("rejects incomplete or wrong-type provider configuration before effects (case %#)", async values => {
  Object.assign(runtime, values);
  await expect(readObservabilityRuntimeContext()).rejects.toThrow("BETTER_STACK_CONFIGURATION_INVALID");
  await report();
  expect(records).toEqual([]);
  expect(requests).not.toHaveBeenCalled();
  expect(scheduled).toEqual([]);
});

it.each([
  { ...provider, BETTER_STACK_INGESTING_HOST: "outside.example.test" },
  { ...provider, BETTER_STACK_SOURCE_TOKEN: "short" },
  { ...provider, BETTER_STACK_SOURCE_TOKEN: " " },
])("refuses malformed complete provider settings through package validation (case %#)", async values => {
  Object.assign(runtime, values);
  await report();
  expect(records).toEqual([]);
  expect(requests).not.toHaveBeenCalled();
  expect(scheduled).toEqual([]);
});

it.each([undefined, "", "invalid", "production", null])("refuses invalid or mismatched runtime targets before effects (case %#)", async target => {
  runtime.APPLICATION_ENVIRONMENT = target;
  Object.assign(runtime, provider);
  await expect(readObservabilityRuntimeContext()).rejects.toThrow("APPLICATION_ENVIRONMENT_INVALID");
  await report();
  expect(records).toEqual([]);
  expect(requests).not.toHaveBeenCalled();
});

it.each([undefined, "", "invalid"])("refuses an unavailable compiled target (case %#)", async target => {
  vi.stubEnv("NEXT_PUBLIC_APPLICATION_ENVIRONMENT", target);
  await report();
  expect(records).toEqual([]);
  expect(requests).not.toHaveBeenCalled();
});

it("restores valid delivery and contains provider failure without leaking configuration", async () => {
  runtime.BETTER_STACK_SOURCE_TOKEN = provider.BETTER_STACK_SOURCE_TOKEN;
  await report();
  expect(records).toEqual([]);
  Object.assign(runtime, provider);
  requests.mockResolvedValue(new Response(null, { status: 403 }));
  await report();
  expect(records).toHaveLength(2);
  expect(records[1]).toMatchObject({ event_name: "observability.delivery.failed", environment: "staging" });
  expect(requests).toHaveBeenCalledOnce();
  expect(requests.mock.calls[0]?.[1]).toMatchObject({ redirect: "error", method: "POST" });
  expect(JSON.stringify(records)).not.toContain(provider.BETTER_STACK_SOURCE_TOKEN);
  requests.mockResolvedValue(new Response(null, { status: 202 }));
  records.length = 0;
  await report();
  expect(records).toHaveLength(1);
});

it("reconstructs browser diagnostics with authoritative labels through the actual route", async () => {
  Object.assign(runtime, provider);
  const envelope = browserError();
  expect((await POST(request(envelope))).status).toBe(202);
  await Promise.all(scheduled);
  expect(requests).toHaveBeenCalledOnce();
  const delivered = JSON.parse(String(requests.mock.calls[0]?.[1]?.body));
  expect(delivered).toMatchObject({ event_id: envelope.report.event.context.eventId, environment: "staging", "exception.fingerprint": envelope.report.diagnostics.fingerprint });
  expect(records[0]).toMatchObject({ event_name: "browser.caught.error", environment: "staging" });
  expect(JSON.stringify(records)).not.toMatch(/synthetic browser failure|exception\.stacktrace/u);
  const forged = { ...envelope, report: { ...envelope.report, event: { ...envelope.report.event, context: { ...envelope.report.event.context, environment: "production" } } } };
  expect((await POST(request(forged))).status).toBe(400);
  expect((await POST(request(vital))).status).toBe(202);
  await Promise.all(scheduled);
  expect(records.at(-1)).toMatchObject({ event_name: "browser.web.vital", environment: "staging" });
});

it("retains acceptance semantics on refused delivery and rejects malformed transport", async () => {
  runtime.APPLICATION_ENVIRONMENT = "production";
  expect((await POST(request(browserError()))).status).toBe(202);
  expect(records).toEqual([]);
  expect(requests).not.toHaveBeenCalled();
  expect((await POST(request({ invalid: true }))).status).toBe(400);
  expect((await POST(request(vital, { origin: "https://other.example.test" }))).status).toBe(403);
  expect((await POST(request(vital, { "content-type": "text/plain" }))).status).toBe(415);
  expect((await POST(request("x".repeat(8193)))).status).toBe(413);
});

it.each([
  ["staging", "https://staging.example.test", "https://staging.example.test", "same-origin"],
  ["development", "https://staging.example.test", "https://staging.example.test", "omit"],
  ["production", "https://staging.example.test", "https://staging.example.test", "omit"],
  ["staging", "https://staging.example.test", "https://other.example.test", "omit"],
  ["staging", "https://staging.example.test", "https://staging.example.test:8443", "omit"],
  ["staging", "https://staging.example.test", "http://staging.example.test", "omit"],
  ["staging", "http://localhost:3000", "http://localhost:3000", "omit"],
  ["staging", "https://127.0.0.1", "https://127.0.0.1", "omit"],
  ["staging", "https://localhost", "https://localhost", "omit"],
  ["staging", "https://localhost.", "https://localhost.", "omit"],
  ["staging", "https://preview.localhost.", "https://preview.localhost.", "omit"],
  ["staging", "https://[::1]", "https://[::1]", "omit"],
  ["staging", "https://staging.example.test/path", "https://staging.example.test", "omit"],
  ["staging", "https://staging.example.test?x=1", "https://staging.example.test", "omit"],
  ["staging", "https://user@staging.example.test", "https://staging.example.test", "omit"],
  ["staging", " https://staging.example.test", "https://staging.example.test", "omit"],
  ["staging", "", "https://staging.example.test", "omit"],
])("bounds both browser transports to their fixed origin (case %#)", async (target, site, origin, credentials) => {
  vi.stubEnv("NEXT_PUBLIC_APPLICATION_ENVIRONMENT", target);
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", site);
  vi.stubGlobal("window", { location: { origin } });
  reportWebVital({ name: "LCP", value: 12, delta: 1, rating: "good", navigationType: "navigate" });
  reportCaughtBrowserError(new Error("synthetic browser failure"), { operation: "load-example" });
  await vi.waitFor(() => expect(requests).toHaveBeenCalledTimes(2));
  for (const [url, options] of requests.mock.calls) {
    expect(url).toBe(`${origin}/api/observability`);
    expect(options).toMatchObject({ credentials, mode: "same-origin", redirect: "error", referrerPolicy: "no-referrer", keepalive: true });
    expect(String(options?.body)).not.toMatch(/controlled-source|APPLICATION_ENVIRONMENT|Cookie/u);
  }
});

it("does not issue browser transport without a window", () => {
  reportWebVital({ name: "LCP", value: 12, delta: 1, rating: "good", navigationType: "navigate" });
  expect(requests).not.toHaveBeenCalled();
});
