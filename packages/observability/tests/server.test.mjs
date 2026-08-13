import assert from "node:assert/strict";
import test from "node:test";

import {
  createOperationalErrorReport,
  createOperationalEvent,
  dispatchOperationalErrorReport,
} from "@egeria-systems/observability";
import {
  createBetterStackDiagnosticSink,
  createBetterStackSink,
  createStructuredLogSink,
  serializeDiagnosticRecord,
  serializeOperationalRecord,
} from "@egeria-systems/observability/server";

function createEvent() {
  const result = createOperationalEvent(
    {
      name: "next.request.error",
      kind: "application.error",
      runtime: "server",
      severity: "error",
      context: {
        eventId: "event-123",
        correlationId: "ray-123",
        releaseId: "release-5",
        service: "web",
      },
      errorCategory: "network",
      attributes: { route_kind: "app-router" },
    },
    {
      allowedAttributeNames: ["route_kind"],
      clock: {
        now: () => new Date("2026-08-10T18:00:00.000Z"),
      },
    },
  );

  assert.equal(result.ok, true);
  return result.value;
}

function createReport(error = {
  name: "TypeError",
  message: "bounded request failure",
  stack:
    "TypeError: bounded request failure\n" +
    "    at request (https://example.com/app.js?token=abc#fragment:10:2)",
  code: "ERR_REQUEST",
  digest: "next-digest-1",
  cause: { name: "NetworkError", message: "connection failed" },
}) {
  const report = createOperationalErrorReport(
    createEvent(),
    error,
    {
      mechanism: "next-request-error",
      handled: false,
      routerKind: "app-router",
      routeType: "render",
      renderSource: "server-rendering",
      renderType: "dynamic",
      revalidateReason: "stale",
      requestMethod: "GET",
      routeIdentifier: "products/[product-id]",
    },
    {},
  );
  assert.equal(report.ok, true);
  return report.value;
}

const expectedRecord = {
  schema_version: "2.0.0",
  dt: "2026-08-10T18:00:00.000Z",
  event_name: "next.request.error",
  event_kind: "application.error",
  runtime: "server",
  severity: "error",
  event_id: "event-123",
  correlation_id: "ray-123",
  release_id: "release-5",
  service: "web",
  error_category: "network",
  attributes: { route_kind: "app-router" },
};

test("server records use the exact privacy-safe provider shape", () => {
  assert.equal(serializeOperationalRecord(createEvent()), JSON.stringify(expectedRecord));
});

test("structured logging writes an object and contains writer failures", async () => {
  const records = [];
  const sink = createStructuredLogSink({
    identifier: "workers-logs",
    write: (record) => {
      records.push(record);
    },
  });

  assert.deepEqual(await sink.write(createEvent()), { status: "delivered" });
  assert.deepEqual(records, [expectedRecord]);
  assert.equal(Object.isFrozen(records[0]), true);

  const failingSink = createStructuredLogSink({
    identifier: "workers-logs",
    write: () => {
      throw new Error("credential-secret response body");
    },
  });
  const failure = await failingSink.write(createEvent());

  assert.deepEqual(failure, { status: "failed", reason: "sink-threw" });
  assert.doesNotMatch(JSON.stringify(failure), /credential-secret/u);
});

test("Better Stack delivery uses a server-held token and bounded HTTP request", async () => {
  const requests = [];
  const configured = createBetterStackSink({
    ingestingHost: "s123.eu-nbg-2.betterstackdata.com",
    sourceToken: "source-token-123456",
    request: async (request) => {
      requests.push(request);
      return { status: 202, body: "credential-secret response body" };
    },
  });

  assert.equal(configured.ok, true);
  assert.deepEqual(await configured.value.write(createEvent()), {
    status: "delivered",
  });
  assert.deepEqual(requests, [
    {
      url: "https://s123.eu-nbg-2.betterstackdata.com",
      method: "POST",
      headers: {
        Authorization: "Bearer source-token-123456",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(expectedRecord),
      timeoutMilliseconds: 5_000,
    },
  ]);
});

test("Better Stack configuration and delivery fail closed without content echoes", async () => {
  for (const configuration of [
    {
      ingestingHost: "betterstackdata.com.attacker.example",
      sourceToken: "source-token-123456",
    },
    {
      ingestingHost: "s123.eu-nbg-2.betterstackdata.com",
      sourceToken: "credential secret",
    },
  ]) {
    const result = createBetterStackSink({
      ...configuration,
      request: async () => ({ status: 202 }),
    });

    assert.deepEqual(result, {
      ok: false,
      code: "BETTER_STACK_CONFIGURATION_INVALID",
    });
    assert.doesNotMatch(JSON.stringify(result), /attacker|credential/u);
  }

  const hostileConfiguration = {
    get ingestingHost() {
      throw new Error("credential-secret response body");
    },
    sourceToken: "source-token-123456",
    request: async () => ({ status: 202 }),
  };
  const hostileResult = createBetterStackSink(hostileConfiguration);
  assert.deepEqual(hostileResult, {
    ok: false,
    code: "BETTER_STACK_CONFIGURATION_INVALID",
  });
  assert.doesNotMatch(JSON.stringify(hostileResult), /credential-secret/u);

  for (const [request, reason] of [
    [async () => ({ status: 200 }), "provider-rejected"],
    [async () => ({ status: 204 }), "provider-rejected"],
    [async () => ({ status: 299 }), "provider-rejected"],
    [async () => ({ status: 403, body: "credential-secret" }), "provider-rejected"],
    [
      async () => {
        throw new Error("credential-secret response body");
      },
      "network-failure",
    ],
  ]) {
    const configured = createBetterStackSink({
      ingestingHost: "s123.eu-nbg-2.betterstackdata.com",
      sourceToken: "source-token-123456",
      request,
    });

    assert.equal(configured.ok, true);
    const result = await configured.value.write(createEvent());

    assert.deepEqual(result, { status: "failed", reason });
    assert.doesNotMatch(JSON.stringify(result), /credential-secret/u);
  }
});

test("Better Stack delivery rejects an oversized structural value before HTTP", async () => {
  let requests = 0;
  const configured = createBetterStackSink({
    ingestingHost: "s123.eu-nbg-2.betterstackdata.com",
    sourceToken: "source-token-123456",
    request: async () => {
      requests += 1;
      return { status: 202 };
    },
  });
  assert.equal(configured.ok, true);

  const result = await configured.value.write({
    ...createEvent(),
    attributes: { oversized: "x".repeat(100_000) },
  });

  assert.deepEqual(result, { status: "failed", reason: "invalid-event" });
  assert.equal(requests, 0);
});

test("server effects reject structural event bypasses before delivery", async () => {
  const invalidEvent = {
    ...createEvent(),
    attributes: { response_body: "credential-secret response body" },
  };
  const records = [];
  const structured = createStructuredLogSink({
    identifier: "workers-logs",
    write: (record) => records.push(record),
  });
  assert.deepEqual(await structured.write(invalidEvent), {
    status: "failed",
    reason: "invalid-event",
  });
  assert.deepEqual(records, []);

  let requests = 0;
  const configured = createBetterStackSink({
    ingestingHost: "s123.eu-nbg-2.betterstackdata.com",
    sourceToken: "source-token-123456",
    request: async () => {
      requests += 1;
      return { status: 202 };
    },
  });
  assert.equal(configured.ok, true);
  assert.deepEqual(await configured.value.write(invalidEvent), {
    status: "failed",
    reason: "invalid-event",
  });
  assert.equal(requests, 0);

  assert.throws(() => serializeOperationalRecord(invalidEvent), {
    message: "OPERATIONAL_EVENT_INVALID",
  });
});

test("Better Stack diagnostic records enrich one safe event with bounded exception and capture fields", async () => {
  const report = createReport();
  const serialized = serializeDiagnosticRecord(report);
  const record = JSON.parse(serialized);

  assert.deepEqual(record, {
    ...expectedRecord,
    capture: report.capture,
    "exception.type": report.diagnostics.exceptionType,
    "exception.message": report.diagnostics.exceptionMessage,
    "exception.stacktrace": report.diagnostics.exceptionStacktrace,
    "exception.code": report.diagnostics.exceptionCode,
    "exception.digest": report.diagnostics.exceptionDigest,
    "exception.fingerprint": report.diagnostics.fingerprint,
    "exception.cause": report.diagnostics.cause,
    "exception.truncated": report.diagnostics.truncated,
  });
  assert.equal(Object.isFrozen(report), true);
  assert.doesNotMatch(
    serialized,
    /token=abc|#fragment|provider response|source-token-123456/u,
  );

  const sensitiveReport = createReport({
    name: "SecurityError",
    message:
      "credential=synthetic-credential client_secret=synthetic-client " +
      "access_token=synthetic-access ghp_0123456789abcdefghijklmnopqrstuvwxyz " +
      "postgres://dbuser:dbpass@localhost/private\n" +
      '{"access_token":"synthetic-json-token"}\n' +
      '{"password":"synthetic-before\\\"synthetic-after"}\n' +
      "Authorization: Basic dXNlcjpwYXNz\n" +
      'password="synthetic quoted value"\n' +
      "Cookie: session=secret-session; csrf=secret-csrf",
    stack:
      "SecurityError: restricted diagnostics\n" +
      "    at spaced (/Users/Alice Smith/private/project.ts:10:2)\n" +
      "    at parenthesized (/Users/Alice Smith (Admin)/private/project.ts:10:2)\n" +
      "    at windows (C:\\Program Files (Admin)\\private\\project.ts:10:2)\n" +
      "    at network (\\\\server\\shared folder (Admin)\\private\\project.ts:10:2)",
  });
  const sensitiveSerialized = serializeDiagnosticRecord(sensitiveReport);
  assert.match(sensitiveSerialized, /\[REDACTED_SECRET\]/u);
  assert.match(sensitiveSerialized, /\[REDACTED_PATH\]/u);
  assert.doesNotMatch(
    sensitiveSerialized,
    /synthetic-credential|synthetic-client|synthetic-access|synthetic-json-token|synthetic-before|synthetic-after|dXNlcjpwYXNz|synthetic quoted value|secret-session|secret-csrf|ghp_|dbuser|dbpass|Alice Smith|Program Files|shared folder|\(Admin\)/u,
  );
});

test("Better Stack diagnostic delivery accepts only exact 202 and contains provider content", async () => {
  const requests = [];
  const configured = createBetterStackDiagnosticSink({
    ingestingHost: "s123.eu-nbg-2.betterstackdata.com",
    sourceToken: "source-token-123456",
    timeoutMilliseconds: 1_500,
    request: async (request) => {
      requests.push(request);
      return { status: 202, body: "credential-secret provider response" };
    },
  });
  assert.equal(configured.ok, true);

  const report = createReport();
  assert.deepEqual(await configured.value.writeReport(report), {
    status: "delivered",
  });
  assert.deepEqual(requests, [
    {
      url: "https://s123.eu-nbg-2.betterstackdata.com",
      method: "POST",
      headers: {
        Authorization: "Bearer source-token-123456",
        "Content-Type": "application/json",
      },
      body: serializeDiagnosticRecord(report),
      timeoutMilliseconds: 1_500,
    },
  ]);

  for (const [request, reason] of [
    [async () => ({ status: 200, body: "credential-secret" }), "provider-rejected"],
    [async () => ({ status: 204, body: "credential-secret" }), "provider-rejected"],
    [
      async () => {
        throw new Error("credential-secret timeout response");
      },
      "network-failure",
    ],
  ]) {
    const failing = createBetterStackDiagnosticSink({
      ingestingHost: "s123.eu-nbg-2.betterstackdata.com",
      sourceToken: "source-token-123456",
      request,
    });
    assert.equal(failing.ok, true);
    const result = await failing.value.writeReport(report);
    assert.deepEqual(result, { status: "failed", reason });
    assert.doesNotMatch(JSON.stringify(result), /credential-secret|response/u);
  }
});

test("Better Stack diagnostic delivery replaces only its matching safe adapter", async () => {
  const requests = [];
  const request = async (value) => {
    requests.push(value);
    return { status: 202 };
  };
  const operational = createBetterStackSink({
    ingestingHost: "s123.eu-nbg-2.betterstackdata.com",
    sourceToken: "source-token-123456",
    request,
  });
  const diagnostic = createBetterStackDiagnosticSink({
    ingestingHost: "s123.eu-nbg-2.betterstackdata.com",
    sourceToken: "source-token-123456",
    request,
  });
  assert.equal(operational.ok, true);
  assert.equal(diagnostic.ok, true);

  let workersCalls = 0;
  const results = await dispatchOperationalErrorReport(createReport(), {
    operationalSinks: [
      {
        identifier: "workers-logs",
        write: () => {
          workersCalls += 1;
          return { status: "delivered" };
        },
      },
      operational.value,
    ],
    diagnosticSinks: [diagnostic.value],
  });

  assert.equal(workersCalls, 1);
  assert.equal(requests.length, 1);
  assert.match(requests[0].body, /"exception\.fingerprint"/u);
  assert.deepEqual(results, [
    { sink: "workers-logs", status: "delivered" },
    { sink: "better-stack", status: "delivered" },
  ]);
});

test("Better Stack diagnostic delivery rejects structural reports and oversized JSON before HTTP", async () => {
  let requests = 0;
  const configured = createBetterStackDiagnosticSink({
    ingestingHost: "s123.eu-nbg-2.betterstackdata.com",
    sourceToken: "source-token-123456",
    request: async () => {
      requests += 1;
      return { status: 202 };
    },
  });
  assert.equal(configured.ok, true);

  assert.deepEqual(await configured.value.writeReport({ ...createReport() }), {
    status: "failed",
    reason: "invalid-event",
  });

  const oversized = createReport({
    name: "TypeError",
    message: "\u0000".repeat(2_048),
    stack: "\u0000".repeat(16_384),
    cause: {
      name: "CauseOne",
      stack: "\u0000".repeat(16_384),
      cause: { name: "CauseTwo", stack: "\u0000".repeat(16_384) },
    },
  });
  assert.deepEqual(await configured.value.writeReport(oversized), {
    status: "failed",
    reason: "payload-too-large",
  });
  assert.equal(requests, 0);
});
