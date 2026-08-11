import assert from "node:assert/strict";
import test from "node:test";

import { createOperationalEvent } from "@egeria-systems/observability";
import {
  createBrowserEnvelope,
  createBrowserSink,
} from "@egeria-systems/observability/browser";

function createEvent(runtime = "browser") {
  const result = createOperationalEvent(
    {
      name: "browser.unhandled.error",
      kind: "application.error",
      runtime,
      severity: "error",
      context: { correlationId: "browser-123" },
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

test("browser envelopes contain only canonical bounded operational fields", () => {
  const event = createEvent();
  const result = createBrowserEnvelope(event);

  assert.deepEqual(result, {
    ok: true,
    value: {
      schemaVersion: "1.0.0",
      event,
    },
  });
  assert.equal(Object.isFrozen(result.value), true);
  assert.equal(Object.isFrozen(result.value.event), true);
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
