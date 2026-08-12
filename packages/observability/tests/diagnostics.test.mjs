import assert from "node:assert/strict";
import test from "node:test";

import {
  createOperationalErrorReport,
  createOperationalEvent,
  dispatchOperationalEvent,
  isOperationalErrorReport,
  reconstructOperationalErrorReport,
} from "@egeria-systems/observability";

const fixedClock = Object.freeze({
  now: () => new Date("2026-08-12T12:00:00.000Z"),
});

function createErrorEvent(runtime = "server") {
  const result = createOperationalEvent(
    {
      name: "application.unexpected.error",
      kind: "application.error",
      runtime,
      severity: "error",
      context: {
        eventId: `event-${runtime}-1`,
        correlationId: "operation-1",
        releaseId: "release-1",
        service: "web",
      },
      errorCategory: "unexpected",
      attributes: { source: "selected-catch" },
    },
    { allowedAttributeNames: ["source"], clock: fixedClock },
  );
  assert.equal(result.ok, true);
  return result.value;
}

const selectedCatch = Object.freeze({
  mechanism: "selected-catch",
  handled: true,
  operation: "render-content",
});

test("safe operational events retain only explicit event context and never expose diagnostics", async () => {
  const event = createErrorEvent();
  const received = [];
  const results = await dispatchOperationalEvent(event, [
    {
      identifier: "safe-memory",
      write(value) {
        received.push(value);
        return { status: "delivered" };
      },
    },
  ]);

  assert.deepEqual(event, {
    schemaVersion: "2.0.0",
    occurredAt: "2026-08-12T12:00:00.000Z",
    name: "application.unexpected.error",
    kind: "application.error",
    runtime: "server",
    severity: "error",
    context: {
      eventId: "event-server-1",
      correlationId: "operation-1",
      releaseId: "release-1",
      service: "web",
    },
    errorCategory: "unexpected",
    attributes: { source: "selected-catch" },
  });
  assert.deepEqual(results, [{ sink: "safe-memory", status: "delivered" }]);
  assert.equal(received[0], event);
  assert.doesNotMatch(
    JSON.stringify(received),
    /diagnostics|exception|message|stack|cause|fingerprint/u,
  );

  for (const prohibitedName of ["message", "stack", "cause", "url", "path"]) {
    const result = createOperationalEvent(
      {
        name: "application.unexpected.error",
        kind: "application.error",
        runtime: "server",
        severity: "error",
        context: { eventId: "event-2", service: "web" },
        errorCategory: "unexpected",
        attributes: { [prohibitedName]: "private-value" },
      },
      { allowedAttributeNames: [prohibitedName], clock: fixedClock },
    );
    assert.deepEqual(result, {
      ok: false,
      code: "EVENT_ATTRIBUTE_POLICY_INVALID",
    });
  }
});

test("normal errors produce immutable bounded diagnostics and an exact FNV-1a vector", () => {
  const error = { name: "hello", message: "ordinary failure" };
  const result = createOperationalErrorReport(
    createErrorEvent(),
    error,
    selectedCatch,
    {},
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.value.diagnostics, {
    exceptionType: "hello",
    exceptionMessage: "ordinary failure",
    fingerprint: "fnv1a32-v1:4f9f2cab",
    truncated: false,
  });
  assert.deepEqual(result.value.event, createErrorEvent());
  assert.deepEqual(result.value.capture, selectedCatch);
  assert.equal(isOperationalErrorReport(result.value), true);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.value), true);
  assert.equal(Object.isFrozen(result.value.capture), true);
  assert.equal(Object.isFrozen(result.value.diagnostics), true);
});

test("primitive reasons and hostile Error-like objects never throw or enumerate arbitrary data", () => {
  const primitive = createOperationalErrorReport(
    createErrorEvent("browser"),
    "primitive failure",
    {
      mechanism: "browser-unhandled-rejection",
      handled: false,
    },
    {},
  );
  assert.equal(primitive.ok, true);
  assert.equal(primitive.value.diagnostics.exceptionType, "NonErrorRejection");
  assert.equal(
    primitive.value.diagnostics.exceptionMessage,
    "primitive failure",
  );

  let enumerations = 0;
  const hostile = new Proxy(
    {},
    {
      get(_target, property) {
        if (property === "name") return "HostileError";
        throw new Error("credential-secret response body");
      },
      ownKeys() {
        enumerations += 1;
        throw new Error("credential-secret response body");
      },
    },
  );
  const hostileResult = createOperationalErrorReport(
    createErrorEvent(),
    hostile,
    selectedCatch,
    {},
  );
  assert.equal(hostileResult.ok, true);
  assert.equal(hostileResult.value.diagnostics.exceptionType, "HostileError");
  assert.equal(enumerations, 0);
  assert.doesNotMatch(JSON.stringify(hostileResult), /credential-secret/u);

  const hostileOptions = new Proxy(
    {},
    {
      ownKeys() {
        throw new Error("credential-secret option");
      },
    },
  );
  assert.doesNotThrow(() =>
    createOperationalErrorReport(
      createErrorEvent(),
      new Error("failure"),
      selectedCatch,
      hostileOptions,
    ),
  );
  assert.deepEqual(
    createOperationalErrorReport(
      createErrorEvent(),
      new Error("failure"),
      selectedCatch,
      hostileOptions,
    ),
    { ok: false, code: "ERROR_REPORT_INPUT_INVALID" },
  );
});

test("causes stop after two links and cycles retain deep immutability", () => {
  const root = { name: "RootError", message: "root" };
  const first = { name: "FirstCause", message: "first" };
  const second = { name: "SecondCause", message: "second" };
  const third = { name: "ThirdCause", message: "third" };
  root.cause = first;
  first.cause = second;
  second.cause = third;
  third.cause = root;

  const result = createOperationalErrorReport(
    createErrorEvent(),
    root,
    selectedCatch,
    {},
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.diagnostics.exceptionType, "RootError");
  assert.equal(result.value.diagnostics.cause.exceptionType, "FirstCause");
  assert.equal(
    result.value.diagnostics.cause.cause.exceptionType,
    "SecondCause",
  );
  assert.equal(result.value.diagnostics.cause.cause.cause, undefined);
  assert.equal(result.value.diagnostics.truncated, true);
  assert.equal(result.value.diagnostics.cause.cause.truncated, true);
  assert.equal(Object.isFrozen(result.value.diagnostics.cause), true);
  assert.equal(Object.isFrozen(result.value.diagnostics.cause.cause), true);

  const cyclicRoot = { name: "CyclicRoot" };
  const cyclicCause = { name: "CyclicCause", cause: cyclicRoot };
  cyclicRoot.cause = cyclicCause;
  const cyclicResult = createOperationalErrorReport(
    createErrorEvent(),
    cyclicRoot,
    selectedCatch,
    {},
  );
  assert.equal(cyclicResult.ok, true);
  assert.equal(cyclicResult.value.diagnostics.cause.cause, undefined);
  assert.equal(cyclicResult.value.diagnostics.cause.truncated, true);
});

test("diagnostics redact private shapes, paths, URL details, and enforce byte and line limits", () => {
  const error = {
    name: "TypeError",
    message:
      `email alice@example.com ip 192.0.2.1 bearer token-value ` +
      `jwt aaaabbbb.ccccdddd.eeeeffff ` +
      "é".repeat(2_000),
    stack: [
      "TypeError: password=credential-secret",
      "    at render (/Users/alice/private/project/src/render.ts?token=abc#fragment:10:2)",
      "    at fetch (https://example.com/app.js?secret=abc#fragment:20:3)",
      ...Array.from(
        { length: 80 },
        (_, index) => `    at frame${index} (/private/build/app-${index}.js:1:1)`,
      ),
    ].join("\n"),
    code: "ERR_RENDER",
    digest: "digest-123",
  };
  const result = createOperationalErrorReport(
    createErrorEvent(),
    error,
    selectedCatch,
    {},
  );
  assert.equal(result.ok, true);

  const { diagnostics } = result.value;
  assert.equal(Buffer.byteLength(diagnostics.exceptionMessage, "utf8") <= 2_048, true);
  assert.equal(Buffer.byteLength(diagnostics.exceptionStacktrace, "utf8") <= 16_384, true);
  assert.equal(diagnostics.exceptionStacktrace.split("\n").length <= 64, true);
  assert.equal(diagnostics.truncated, true);
  assert.match(diagnostics.exceptionMessage, /\[REDACTED_EMAIL\]/u);
  assert.match(diagnostics.exceptionMessage, /\[REDACTED_IP\]/u);
  assert.match(diagnostics.exceptionMessage, /\[TRUNCATED\]$/u);
  assert.match(diagnostics.exceptionStacktrace, /\[REDACTED_PATH\]/u);
  assert.match(diagnostics.exceptionStacktrace, /https:\/\/example\.com\/app\.js/u);
  assert.doesNotMatch(
    JSON.stringify(diagnostics),
    /alice@example\.com|192\.0\.2\.1|aaaabbbb\.ccccdddd\.eeeeffff|credential-secret|token=abc|secret=abc|\/Users\/alice|\/private\/build|#fragment/u,
  );
  assert.equal(diagnostics.exceptionCode, "ERR_RENDER");
  assert.equal(diagnostics.exceptionDigest, "digest-123");
});

test("capture vocabularies, required fields, and canonical report identity fail closed", () => {
  const lifecycleEvent = createOperationalEvent(
    {
      name: "application.ready",
      kind: "application.lifecycle",
      runtime: "server",
      severity: "info",
      context: { eventId: "event-3", service: "web" },
    },
    { clock: fixedClock },
  );
  assert.equal(lifecycleEvent.ok, true);

  assert.deepEqual(
    createOperationalErrorReport(
      lifecycleEvent.value,
      new Error("failure"),
      selectedCatch,
      {},
    ),
    { ok: false, code: "ERROR_REPORT_EVENT_INVALID" },
  );
  assert.deepEqual(
    createOperationalErrorReport(
      createErrorEvent(),
      new Error("failure"),
      { mechanism: "invented", handled: true },
      {},
    ),
    { ok: false, code: "ERROR_REPORT_CAPTURE_INVALID" },
  );
  const missingDiagnostics = createOperationalErrorReport(
    createErrorEvent(),
    {},
    selectedCatch,
    {},
  );
  assert.equal(missingDiagnostics.ok, true);
  assert.deepEqual(missingDiagnostics.value.diagnostics, {
    exceptionType: "Error",
    fingerprint: "fnv1a32-v1:f38d9cf1",
    truncated: false,
  });
  assert.deepEqual(reconstructOperationalErrorReport({}), {
    ok: false,
    code: "ERROR_REPORT_INPUT_INVALID",
  });
  assert.equal(isOperationalErrorReport({}), false);
});

test("plain transport reports are reconstructed, re-sanitized, and rebranded", () => {
  const created = createOperationalErrorReport(
    createErrorEvent("browser"),
    {
      name: "TypeError",
      message: "bounded failure",
      stack: "TypeError: bounded failure\n    at render (app.js:10:2)",
    },
    { mechanism: "browser-error-event", handled: false },
    {},
  );
  assert.equal(created.ok, true);

  const transported = JSON.parse(JSON.stringify(created.value));
  const reconstructed = reconstructOperationalErrorReport(transported);
  assert.equal(reconstructed.ok, true);
  assert.deepEqual(reconstructed.value, created.value);
  assert.notEqual(reconstructed.value, created.value);
  assert.equal(isOperationalErrorReport(reconstructed.value), true);
  assert.equal(Object.isFrozen(reconstructed.value.diagnostics), true);

  transported.diagnostics.fingerprint = "fnv1a32-v1:00000000";
  assert.deepEqual(reconstructOperationalErrorReport(transported), {
    ok: false,
    code: "ERROR_REPORT_DIAGNOSTICS_INVALID",
  });
});
