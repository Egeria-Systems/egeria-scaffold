import assert from "node:assert/strict";
import test from "node:test";

import { createOperationalEvent } from "@egeria-systems/observability";
import {
  createBetterStackSink,
  createStructuredLogSink,
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
        correlationId: "ray-123",
        releaseId: "release-5",
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

const expectedRecord = {
  schema_version: "1.0.0",
  timestamp: "2026-08-10T18:00:00.000Z",
  event_name: "next.request.error",
  event_kind: "application.error",
  runtime: "server",
  severity: "error",
  correlation_id: "ray-123",
  release_id: "release-5",
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

test("Better Stack delivery rejects an oversized runtime value before HTTP", async () => {
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

  assert.deepEqual(result, { status: "failed", reason: "payload-too-large" });
  assert.equal(requests, 0);
});
