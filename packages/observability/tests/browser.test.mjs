import assert from "node:assert/strict";
import test from "node:test";

import {
  createOperationalErrorReport,
  createOperationalEvent,
} from "@egeria-systems/observability";
import {
  createBrowserDiagnosticSink,
  createBrowserEnvelope,
  createBrowserErrorEnvelope,
  createBrowserSink,
} from "@egeria-systems/observability/browser";

function createEvent(runtime = "browser") {
  const result = createOperationalEvent(
    {
      name: "browser.unhandled.error",
      kind: "application.error",
      runtime,
      severity: "error",
      context: {
        eventId: "event-browser-123",
        correlationId: "browser-123",
        service: "web",
      },
      errorCategory: "unexpected",
      attributes: { source: "window-error" },
    },
    {
      allowedAttributeNames: ["source"],
      clock: {
        now: () => new Date("2026-08-10T18:00:00.000Z"),
      },
    },
  );

  assert.equal(result.ok, true);
  return result.value;
}

function createWebVitalEvent() {
  const result = createOperationalEvent(
    {
      name: "browser.web.vital",
      kind: "web.vital",
      runtime: "browser",
      severity: "info",
      context: { eventId: "event-vital-1", service: "web" },
      attributes: { metric_name: "LCP" },
    },
    {
      allowedAttributeNames: ["metric_name"],
      clock: {
        now: () => new Date("2026-08-10T18:00:00.000Z"),
      },
    },
  );
  assert.equal(result.ok, true);
  return result.value;
}

function createReport(
  error = { name: "TypeError", message: "bounded failure" },
  capture = { mechanism: "browser-error-event", handled: false },
  runtime = "browser",
  clock = { now: () => new Date("2026-08-10T18:00:00.000Z") },
) {
  const eventResult = createOperationalEvent(
    {
      name: "browser.window.error",
      kind: "application.error",
      runtime,
      severity: "error",
      context: { eventId: `event-${runtime}-error-1`, service: "web" },
      errorCategory: "unexpected",
    },
    { clock },
  );
  assert.equal(eventResult.ok, true);
  const reportResult = createOperationalErrorReport(
    eventResult.value,
    error,
    capture,
    {},
  );
  assert.equal(reportResult.ok, true);
  return reportResult.value;
}

function rawErrorEnvelopeSize(report) {
  return Buffer.byteLength(
    JSON.stringify({
      schemaVersion: "2.0.0",
      type: "error-report",
      report,
    }),
    "utf8",
  );
}

function createReportWithRawEnvelopeSize(targetBytes) {
  const baseMessage = "é";
  const baseReport = createReport({ name: "TypeError", message: baseMessage });
  const remainingBytes = targetBytes - rawErrorEnvelopeSize(baseReport);
  assert.equal(remainingBytes >= 0, true);
  const escapedCharacters = Math.floor(remainingBytes / 6);
  const asciiCharacters = remainingBytes % 6;
  const message =
    baseMessage +
    "\u0000".repeat(escapedCharacters) +
    "x".repeat(asciiCharacters);
  assert.equal(Buffer.byteLength(message, "utf8") <= 2_048, true);
  const report = createReport({ name: "TypeError", message });
  assert.equal(rawErrorEnvelopeSize(report), targetBytes);
  return report;
}

test("browser envelopes contain only canonical bounded operational fields", () => {
  const event = createEvent();
  const result = createBrowserEnvelope(event);

  assert.deepEqual(result, {
    ok: true,
    value: {
      schemaVersion: "2.0.0",
      type: "operational-event",
      event,
    },
  });
  assert.equal(Object.isFrozen(result.value), true);
  assert.equal(Object.isFrozen(result.value.event), true);
});

test("safe web-vital envelopes cannot acquire diagnostic fields", () => {
  const event = createWebVitalEvent();
  const envelope = createBrowserEnvelope(event);
  assert.deepEqual(envelope, {
    ok: true,
    value: {
      schemaVersion: "2.0.0",
      type: "operational-event",
      event,
    },
  });
  assert.doesNotMatch(
    JSON.stringify(envelope),
    /diagnostics|exception|message|stack|cause|fingerprint/u,
  );
});

test("browser envelopes reject server and unsupported event kinds", () => {
  assert.deepEqual(createBrowserEnvelope(createEvent("server")), {
    ok: false,
    code: "BROWSER_EVENT_INVALID",
  });
  assert.deepEqual(
    createBrowserEnvelope({
      ...createEvent(),
      kind: "application.lifecycle",
    }),
    { ok: false, code: "BROWSER_EVENT_INVALID" },
  );
  const structuralBypass = createBrowserEnvelope({
    ...createEvent(),
    message: "credential-secret response body",
  });
  assert.deepEqual(structuralBypass, {
    ok: false,
    code: "BROWSER_EVENT_INVALID",
  });
  assert.doesNotMatch(JSON.stringify(structuralBypass), /credential-secret/u);
});

test("browser delivery uses an injected sender and contains rejection or failure", async () => {
  const envelopes = [];
  const sink = createBrowserSink({
    identifier: "same-origin-route",
    send: async (envelope) => {
      envelopes.push(envelope);
      return true;
    },
  });

  assert.deepEqual(await sink.write(createEvent()), { status: "delivered" });
  assert.deepEqual(envelopes, [createBrowserEnvelope(createEvent()).value]);

  for (const [send, reason] of [
    [async () => false, "transport-rejected"],
    [
      async () => {
        throw new Error("credential-secret response body");
      },
      "network-failure",
    ],
  ]) {
    const result = await createBrowserSink({
      identifier: "same-origin-route",
      send,
    }).write(createEvent());

    assert.deepEqual(result, { status: "failed", reason });
    assert.doesNotMatch(JSON.stringify(result), /credential-secret/u);
  }

  const structuralResult = await sink.write({
    ...createEvent(),
    attributes: { response_body: "credential-secret" },
  });
  assert.deepEqual(structuralResult, {
    status: "failed",
    reason: "invalid-event",
  });
  assert.equal(envelopes.length, 1);
});

test("browser error envelopes accept approved mechanisms and reject server or structural reports", () => {
  for (const capture of [
    { mechanism: "browser-error-event", handled: false },
    { mechanism: "browser-unhandled-rejection", handled: false },
    { mechanism: "react-error-boundary", handled: true },
    { mechanism: "selected-catch", handled: true, operation: "load-page" },
  ]) {
    const report = createReport(
      { name: "TypeError", message: "bounded failure" },
      capture,
    );
    const envelope = createBrowserErrorEnvelope(report);
    assert.deepEqual(envelope, {
      ok: true,
      value: {
        schemaVersion: "2.0.0",
        type: "error-report",
        report,
      },
    });
    assert.equal(Object.isFrozen(envelope), true);
    assert.equal(Object.isFrozen(envelope.value), true);
  }

  const serverReport = createReport(
    new Error("failure"),
    { mechanism: "next-request-error", handled: false },
    "server",
  );
  assert.deepEqual(createBrowserErrorEnvelope(serverReport), {
    ok: false,
    code: "BROWSER_ERROR_REPORT_INVALID",
  });
  const report = createReport();
  for (const structuralBypass of [
    { ...report },
    { ...report, privateContext: "credential-secret" },
    { ...report, capture: { mechanism: "invented", handled: false } },
  ]) {
    const result = createBrowserErrorEnvelope(structuralBypass);
    assert.deepEqual(result, {
      ok: false,
      code: "BROWSER_ERROR_REPORT_INVALID",
    });
    assert.doesNotMatch(JSON.stringify(result), /credential-secret/u);
  }
});

test("browser error envelopes remove causes before truncating stacks and messages", () => {
  const causeOnly = createReport({
    name: "TypeError",
    message: "root message remains",
    stack: "TypeError: root\n    at render (https://example.com/app.js:10:2)",
    cause: {
      name: "CauseError",
      message: "\u0000".repeat(2_048),
      stack: "\u0000".repeat(16_384),
    },
  });
  assert.equal(rawErrorEnvelopeSize(causeOnly) > 8_192, true);
  const causeEnvelope = createBrowserErrorEnvelope(causeOnly);
  assert.equal(causeEnvelope.ok, true);
  assert.equal(causeEnvelope.value.report.diagnostics.cause, undefined);
  assert.equal(
    causeEnvelope.value.report.diagnostics.exceptionMessage,
    causeOnly.diagnostics.exceptionMessage,
  );
  assert.equal(
    causeEnvelope.value.report.diagnostics.exceptionStacktrace,
    causeOnly.diagnostics.exceptionStacktrace,
  );

  const stackHeavy = createReport({
    name: "TypeError",
    message: "message remains",
    stack:
      "TypeError: bounded failure\n" +
      "    at render (https://example.com/app.js:10:2)\n" +
      "\u0000".repeat(16_000),
  });
  const stackEnvelope = createBrowserErrorEnvelope(stackHeavy);
  assert.equal(stackEnvelope.ok, true);
  assert.equal(stackHeavy.diagnostics.cause, undefined);
  assert.equal(
    stackEnvelope.value.report.diagnostics.exceptionMessage,
    "message remains",
  );
  assert.match(
    stackEnvelope.value.report.diagnostics.exceptionStacktrace,
    /\[TRUNCATED\]$/u,
  );
  assert.equal(stackEnvelope.value.report.diagnostics.truncated, true);
  assert.equal(
    Buffer.byteLength(JSON.stringify(stackEnvelope.value), "utf8") <= 8_192,
    true,
  );

  const messageHeavy = createReport({
    name: "TypeError",
    message: "\u0000".repeat(2_048),
  });
  const messageEnvelope = createBrowserErrorEnvelope(messageHeavy);
  assert.equal(messageEnvelope.ok, true);
  assert.equal(messageEnvelope.value.report.diagnostics.cause, undefined);
  assert.equal(
    messageEnvelope.value.report.diagnostics.exceptionStacktrace,
    undefined,
  );
  assert.match(
    messageEnvelope.value.report.diagnostics.exceptionMessage,
    /\[TRUNCATED\]$/u,
  );
  assert.equal(
    Buffer.byteLength(JSON.stringify(messageEnvelope.value), "utf8") <= 8_192,
    true,
  );
});

test("browser error envelopes preserve minimum stack evidence before shrinking the message", () => {
  const topFrame = `    at render (${"f".repeat(6_200)}:10:2)`;
  const report = createReport({
    name: "TypeError",
    message: "m".repeat(2_048),
    stack:
      `TypeError: bounded failure\n${topFrame}\n` +
      "\u0000".repeat(8_000),
  });
  assert.equal(rawErrorEnvelopeSize(report) > 8_192, true);

  const envelope = createBrowserErrorEnvelope(report);
  assert.equal(envelope.ok, true);
  assert.equal(
    envelope.value.report.diagnostics.exceptionStacktrace,
    `TypeError: bounded failure\n${topFrame}\n[TRUNCATED]`,
  );
  assert.match(
    envelope.value.report.diagnostics.exceptionMessage,
    /\[TRUNCATED\]$/u,
  );
  assert.equal(
    envelope.value.report.diagnostics.exceptionMessage.length <
      report.diagnostics.exceptionMessage.length,
    true,
  );
  assert.equal(
    Buffer.byteLength(JSON.stringify(envelope.value), "utf8") <= 8_192,
    true,
  );
});

test("browser error envelopes enforce exact 8192 and 8193 byte boundaries with escaped multibyte input", () => {
  const exact = createReportWithRawEnvelopeSize(8_192);
  const exactEnvelope = createBrowserErrorEnvelope(exact);
  assert.equal(exactEnvelope.ok, true);
  assert.equal(exactEnvelope.value.report, exact);
  assert.equal(
    Buffer.byteLength(JSON.stringify(exactEnvelope.value), "utf8"),
    8_192,
  );

  const oversized = createReportWithRawEnvelopeSize(8_193);
  const oversizedEnvelope = createBrowserErrorEnvelope(oversized);
  assert.equal(oversizedEnvelope.ok, true);
  assert.notEqual(oversizedEnvelope.value.report, oversized);
  assert.match(
    oversizedEnvelope.value.report.diagnostics.exceptionMessage,
    /\[TRUNCATED\]$/u,
  );
  assert.equal(
    Buffer.byteLength(JSON.stringify(oversizedEnvelope.value), "utf8") <= 8_192,
    true,
  );
});

test("browser error envelopes fail closed when branded required fields alone exceed the limit", () => {
  const report = createReport(
    { name: "TypeError" },
    { mechanism: "browser-error-event", handled: false },
    "browser",
    {
      now: () => ({
        toISOString: () => "2".repeat(9_000),
      }),
    },
  );
  assert.deepEqual(createBrowserErrorEnvelope(report), {
    ok: false,
    code: "BROWSER_ERROR_ENVELOPE_TOO_LARGE",
  });
});

test("browser diagnostic delivery uses only the injected transport and content-safe results", async () => {
  const envelopes = [];
  const sink = createBrowserDiagnosticSink({
    identifier: "same-origin-route",
    send: async (envelope) => {
      envelopes.push(envelope);
      return true;
    },
  });
  const report = createReport();
  assert.deepEqual(await sink.writeReport(report), { status: "delivered" });
  assert.deepEqual(envelopes, [createBrowserErrorEnvelope(report).value]);

  for (const [send, reason] of [
    [async () => false, "transport-rejected"],
    [
      async () => {
        throw new Error("credential-secret transport response");
      },
      "network-failure",
    ],
  ]) {
    const result = await createBrowserDiagnosticSink({
      identifier: "same-origin-route",
      send,
    }).writeReport(report);
    assert.deepEqual(result, { status: "failed", reason });
    assert.doesNotMatch(
      JSON.stringify(result),
      /credential-secret|transport response|url|token/u,
    );
  }

  assert.deepEqual(await sink.writeReport({ ...report }), {
    status: "failed",
    reason: "invalid-event",
  });
  assert.equal(envelopes.length, 1);
});
