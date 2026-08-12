import assert from "node:assert/strict";
import test from "node:test";

import {
  createOperationalEvent,
  dispatchOperationalEvent,
} from "@egeria-systems/observability";

function createEvent() {
  const result = createOperationalEvent(
    {
      name: "application.ready",
      kind: "application.lifecycle",
      runtime: "server",
      severity: "info",
      context: {
        eventId: "event-1",
        correlationId: "correlation-1",
        service: "web",
      },
    },
    {
      clock: {
        now: () => new Date("2026-08-10T18:00:00.000Z"),
      },
    },
  );

  assert.equal(result.ok, true);
  return result.value;
}

test("dispatch attempts every sink and contains invalid or thrown results", async () => {
  const calls = [];
  const event = createEvent();
  const results = await dispatchOperationalEvent(event, [
    {
      identifier: "workers-logs",
      write: async (received) => {
        calls.push(["workers-logs", received]);
        return { status: "delivered" };
      },
    },
    {
      identifier: "better-stack",
      write: async (received) => {
        calls.push(["better-stack", received]);
        throw new Error("credential-secret response body");
      },
    },
    {
      identifier: "invalid-sink",
      write: async (received) => {
        calls.push(["invalid-sink", received]);
        return { status: "failed", reason: "credential-secret" };
      },
    },
  ]);

  assert.deepEqual(
    calls.map(([identifier, received]) => [identifier, received === event]),
    [
      ["workers-logs", true],
      ["better-stack", true],
      ["invalid-sink", true],
    ],
  );
  assert.deepEqual(results, [
    { sink: "workers-logs", status: "delivered" },
    { sink: "better-stack", status: "failed", reason: "sink-threw" },
    { sink: "invalid-sink", status: "failed", reason: "invalid-result" },
  ]);
  assert.equal(Object.isFrozen(results), true);
  assert.equal(results.every(Object.isFrozen), true);
  assert.doesNotMatch(JSON.stringify(results), /credential-secret/u);
});

test("dispatch preserves bounded sink failure categories", async () => {
  const results = await dispatchOperationalEvent(createEvent(), [
    {
      identifier: "better-stack",
      write: () => ({ status: "failed", reason: "provider-rejected" }),
    },
  ]);

  assert.deepEqual(results, [
    {
      sink: "better-stack",
      status: "failed",
      reason: "provider-rejected",
    },
  ]);
});

test("dispatch contains malformed sinks and rejects noncanonical events", async () => {
  const event = createEvent();
  const hostileSink = {
    get identifier() {
      throw new Error("credential-secret response body");
    },
    write: () => ({ status: "delivered" }),
  };
  const results = await dispatchOperationalEvent(event, [
    null,
    hostileSink,
    {
      identifier: "credential-secret",
      write: () => ({ status: "delivered" }),
    },
  ]);

  assert.deepEqual(results, [
    { sink: "invalid-sink", status: "failed", reason: "invalid-result" },
    { sink: "invalid-sink", status: "failed", reason: "sink-threw" },
    { sink: "invalid-sink", status: "delivered" },
  ]);
  assert.doesNotMatch(JSON.stringify(results), /credential-secret/u);

  let calls = 0;
  const invalidEventResults = await dispatchOperationalEvent(
    { ...event, attributes: { response_body: "credential-secret" } },
    [
      {
        identifier: "workers-logs",
        write: () => {
          calls += 1;
          return { status: "delivered" };
        },
      },
    ],
  );

  assert.deepEqual(invalidEventResults, [
    { sink: "workers-logs", status: "failed", reason: "invalid-event" },
  ]);
  assert.equal(calls, 0);
});

test("dispatch contains mutation attempts before the next sink observes them", async () => {
  const event = createEvent();
  let observedEvent;
  const results = await dispatchOperationalEvent(event, [
    {
      identifier: "mutating-sink",
      write: (received) => {
        received.context.correlationId = "credential-secret";
        return { status: "delivered" };
      },
    },
    {
      identifier: "observing-sink",
      write: (received) => {
        observedEvent = received;
        return { status: "delivered" };
      },
    },
  ]);

  assert.deepEqual(results, [
    { sink: "mutating-sink", status: "failed", reason: "sink-threw" },
    { sink: "observing-sink", status: "delivered" },
  ]);
  assert.equal(observedEvent, event);
  assert.equal(observedEvent.context.correlationId, "correlation-1");
  assert.equal(Object.isFrozen(observedEvent), true);
  assert.equal(Object.isFrozen(observedEvent.context), true);
});
