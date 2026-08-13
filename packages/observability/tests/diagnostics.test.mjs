import assert from "node:assert/strict";
import test from "node:test";

import {
  createOperationalErrorReport,
  createOperationalEvent,
  dispatchOperationalEvent,
  isOperationalErrorReport,
  reconstructOperationalErrorReport,
} from "@egeria-systems/observability";
import { redactExceptionText } from "../dist/redaction.js";

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
      "    at root (/private.ts:10:2)",
      "    at spaced (/Users/Alice Smith/private/project.ts:10:2)",
      "    at parenthesized (/Users/Alice Smith (Admin)/private/project.ts:10:2)",
      "    at windows (C:\\private.ts:10:2)",
      "    at windowsSpaced (C:\\Program Files\\private\\project.ts:10:2)",
      "    at windowsParenthesized (C:\\Program Files (Admin)\\private\\project.ts:10:2)",
      "    at network (\\\\server\\share\\private.ts:10:2)",
      "    at networkSpaced (\\\\server\\shared folder\\private\\project.ts:10:2)",
      "    at networkParenthesized (\\\\server\\shared folder (Admin)\\private\\project.ts:10:2)",
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
    diagnostics.exceptionStacktrace,
    /\(\/private\.ts|C:\\private|\\\\server\\share/u,
  );
  assert.doesNotMatch(
    JSON.stringify(diagnostics),
    /alice@example\.com|192\.0\.2\.1|aaaabbbb\.ccccdddd\.eeeeffff|credential-secret|token=abc|secret=abc|\/Users\/alice|Alice Smith|Program Files|shared folder|\(Admin\)|\/private\/build|#fragment/u,
  );
  assert.equal(diagnostics.exceptionCode, "ERR_RENDER");
  assert.equal(diagnostics.exceptionDigest, "digest-123");
});

test("exception redaction pre-bounds untrusted text before pattern matching", () => {
  const result = redactExceptionText("x".repeat(65_537));

  assert.equal(result.truncated, true);
  assert.equal(Buffer.byteLength(result.value, "utf8"), 65_536);
  assert.match(result.value, /\[TRUNCATED\]$/u);
});

test("restricted diagnostics redact quoted and multi-token credential values completely", () => {
  const cases = [
    {
      name: "quoted JSON access token",
      source: '{"access_token":"synthetic-json-token"}',
      forbidden: ["synthetic-json-token"],
    },
    {
      name: "quoted JSON password with an escaped quote",
      source: '{"password":"synthetic-before\\\"synthetic-after"}',
      forbidden: ["synthetic-before", "synthetic-after"],
    },
    {
      name: "Basic authorization header",
      source: "Authorization: Basic dXNlcjpwYXNz",
      forbidden: ["dXNlcjpwYXNz"],
    },
    {
      name: "quoted secret containing spaces",
      source: 'password="synthetic quoted value"',
      forbidden: ["synthetic", "quoted value"],
    },
    {
      name: "multi-value Cookie header",
      source: "Cookie: session=secret-session; csrf=secret-csrf",
      forbidden: ["secret-session", "secret-csrf"],
    },
  ];

  for (const credentialCase of cases) {
    const report = createOperationalErrorReport(
      createErrorEvent(),
      {
        name: "SecurityError",
        message: `benign-control ${credentialCase.source}`,
        stack: `SecurityError: benign-control ${credentialCase.source}`,
      },
      selectedCatch,
      {},
    );
    assert.equal(report.ok, true, credentialCase.name);
    const serialized = JSON.stringify(report.value.diagnostics);

    assert.match(serialized, /benign-control/u, credentialCase.name);
    assert.match(serialized, /\[REDACTED_SECRET\]/u, credentialCase.name);
    for (const forbiddenValue of credentialCase.forbidden) {
      assert.equal(
        serialized.includes(forbiddenValue),
        false,
        `${credentialCase.name}: ${forbiddenValue}`,
      );
    }
  }
});

test("restricted diagnostics redact the declared sensitive-shape matrix without altering benign neighbors", () => {
  const sensitiveValues = [
    "authorization=Basic-synthetic-auth",
    "cookie=synthetic-cookie",
    "credential=synthetic-credential",
    "client_secret=synthetic-client",
    "access_token=synthetic-access",
    "api-key=synthetic-api-key",
    "Bearer synthetic-bearer",
    "ghp_0123456789abcdefghijklmnopqrstuvwxyz",
    "aaaabbbb.ccccdddd.eeeeffff",
    "alice@example.com",
    "192.0.2.1",
    "2001:db8::1",
    "postgres://dbuser:dbpass@localhost/private",
  ];
  const source = `benign-control ${sensitiveValues.join(" ")}`;
  const report = createOperationalErrorReport(
    createErrorEvent(),
    {
      name: "SecurityError",
      message: source,
      stack: `SecurityError: ${source}`,
    },
    selectedCatch,
    {},
  );
  assert.equal(report.ok, true);
  const serialized = JSON.stringify(report.value.diagnostics);

  assert.match(report.value.diagnostics.exceptionMessage, /benign-control/u);
  assert.match(serialized, /\[REDACTED_SECRET\]/u);
  assert.match(serialized, /\[REDACTED_EMAIL\]/u);
  assert.match(serialized, /\[REDACTED_IP\]/u);
  for (const sensitiveValue of sensitiveValues) {
    assert.equal(serialized.includes(sensitiveValue), false, sensitiveValue);
  }
  assert.doesNotMatch(
    serialized,
    /synthetic-auth|synthetic-cookie|synthetic-credential|synthetic-client|synthetic-access|synthetic-api-key|synthetic-bearer|dbuser|dbpass/u,
  );
});

test("diagnostic message, byte, and line limits preserve exact boundaries and mark the first overflow", () => {
  const exactMessage = "m".repeat(2_048);
  const messageExact = createOperationalErrorReport(
    createErrorEvent(),
    { name: "MessageError", message: exactMessage },
    selectedCatch,
    {},
  );
  const messageOverflow = createOperationalErrorReport(
    createErrorEvent(),
    { name: "MessageError", message: `${exactMessage}m` },
    selectedCatch,
    {},
  );
  assert.equal(messageExact.ok, true);
  assert.equal(messageOverflow.ok, true);
  assert.equal(messageExact.value.diagnostics.exceptionMessage, exactMessage);
  assert.equal(
    Buffer.byteLength(messageExact.value.diagnostics.exceptionMessage, "utf8"),
    2_048,
  );
  assert.match(
    messageOverflow.value.diagnostics.exceptionMessage,
    /\[TRUNCATED\]$/u,
  );

  const exactStack = `StackError: ${"s".repeat(16_384 - "StackError: ".length)}`;
  const stackExact = createOperationalErrorReport(
    createErrorEvent(),
    { name: "StackError", stack: exactStack },
    selectedCatch,
    {},
  );
  const stackOverflow = createOperationalErrorReport(
    createErrorEvent(),
    { name: "StackError", stack: `${exactStack}s` },
    selectedCatch,
    {},
  );
  assert.equal(stackExact.ok, true);
  assert.equal(stackOverflow.ok, true);
  assert.equal(stackExact.value.diagnostics.exceptionStacktrace, exactStack);
  assert.equal(
    Buffer.byteLength(stackExact.value.diagnostics.exceptionStacktrace, "utf8"),
    16_384,
  );
  assert.match(
    stackOverflow.value.diagnostics.exceptionStacktrace,
    /\[TRUNCATED\]$/u,
  );

  const exactLines = Array.from(
    { length: 64 },
    (_, index) => `frame-${index}`,
  ).join("\n");
  const linesExact = createOperationalErrorReport(
    createErrorEvent(),
    { name: "LineError", stack: exactLines },
    selectedCatch,
    {},
  );
  const linesOverflow = createOperationalErrorReport(
    createErrorEvent(),
    { name: "LineError", stack: `${exactLines}\nframe-64` },
    selectedCatch,
    {},
  );
  assert.equal(linesExact.ok, true);
  assert.equal(linesOverflow.ok, true);
  assert.equal(linesExact.value.diagnostics.exceptionStacktrace, exactLines);
  assert.equal(
    linesExact.value.diagnostics.exceptionStacktrace.split("\n").length,
    64,
  );
  assert.equal(
    linesOverflow.value.diagnostics.exceptionStacktrace.split("\n").length,
    64,
  );
  assert.match(
    linesOverflow.value.diagnostics.exceptionStacktrace,
    /\[TRUNCATED\]$/u,
  );
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
  const hostileTransport = new Proxy(
    {},
    {
      getPrototypeOf: () => Object.prototype,
      ownKeys: () => ["capture", "diagnostics", "event"],
      getOwnPropertyDescriptor: () => ({ configurable: true, enumerable: true }),
      has() {
        throw new Error("credential-secret hostile has");
      },
    },
  );
  assert.doesNotThrow(() => reconstructOperationalErrorReport(hostileTransport));
  assert.deepEqual(reconstructOperationalErrorReport(hostileTransport), {
    ok: false,
    code: "ERROR_REPORT_INPUT_INVALID",
  });
  const hostileGetter = new Proxy(
    {},
    {
      getPrototypeOf: () => Object.prototype,
      ownKeys: () => ["capture", "diagnostics", "event"],
      getOwnPropertyDescriptor: () => ({ configurable: true, enumerable: true }),
      has: () => true,
      get() {
        throw new Error("credential-secret hostile getter");
      },
    },
  );
  assert.doesNotThrow(() => reconstructOperationalErrorReport(hostileGetter));
  assert.deepEqual(reconstructOperationalErrorReport(hostileGetter), {
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

  const withoutStack = createOperationalErrorReport(
    createErrorEvent("browser"),
    { name: "TypeError", message: "bounded failure" },
    { mechanism: "browser-error-event", handled: false },
    {},
  );
  assert.equal(withoutStack.ok, true);
  const tamperedWithoutStack = JSON.parse(JSON.stringify(withoutStack.value));
  tamperedWithoutStack.diagnostics.fingerprint = "fnv1a32-v1:00000000";
  assert.deepEqual(reconstructOperationalErrorReport(tamperedWithoutStack), {
    ok: false,
    code: "ERROR_REPORT_DIAGNOSTICS_INVALID",
  });

  const digestOnly = createOperationalErrorReport(
    createErrorEvent("browser"),
    { name: "TypeError", digest: "next-digest-1" },
    { mechanism: "browser-error-event", handled: false },
    {},
  );
  assert.equal(digestOnly.ok, true);
  const tamperedDigestOnly = JSON.parse(JSON.stringify(digestOnly.value));
  tamperedDigestOnly.diagnostics.exceptionDigest = "next-digest-2";
  assert.deepEqual(reconstructOperationalErrorReport(tamperedDigestOnly), {
    ok: false,
    code: "ERROR_REPORT_DIAGNOSTICS_INVALID",
  });
});
