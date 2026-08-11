import assert from "node:assert/strict";
import test from "node:test";

import { createOperationalEvent } from "@egeria-systems/observability";
import {
  assertOperationalEvent,
  createMemorySink,
} from "@egeria-systems/observability/testing";

function createEvent(name) {
  const result = createOperationalEvent(
    {
      name,
      kind: "application.lifecycle",
      runtime: "server",
      severity: "info",
      context: { correlationId: "correlation-1" },
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

test("the memory sink returns immutable snapshots and exact event assertions", async () => {
  const memory = createMemorySink();
  const ready = createEvent("application.ready");
  const stopped = createEvent("application.stopped");

  assert.deepEqual(await memory.sink.write(ready), { status: "delivered" });
  assert.deepEqual(await memory.sink.write(stopped), { status: "delivered" });

  const snapshot = memory.snapshot();
  assert.deepEqual(snapshot, [ready, stopped]);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(assertOperationalEvent(snapshot, { name: "application.ready" }), ready);
});

test("event assertions fail with stable content-safe errors", () => {
  const events = [createEvent("application.ready")];

  assert.equal(
    assertOperationalEvent(events, {
      name: "application.ready",
      severity: "info",
    }),
    events[0],
  );

  assert.throws(
    () =>
      assertOperationalEvent(events, {
        name: "application.ready",
        severity: "error",
      }),
    { message: "OPERATIONAL_EVENT_NOT_FOUND" },
  );

  assert.throws(
    () =>
      assertOperationalEvent(events, {
        name: "application.missing",
        severity: "error",
      }),
    { message: "OPERATIONAL_EVENT_NOT_FOUND" },
  );
});

test("the memory sink rejects structural event bypasses", async () => {
  const memory = createMemorySink();
  const result = await memory.sink.write({
    ...createEvent("application.ready"),
    attributes: { response_body: "credential-secret response body" },
  });

  assert.deepEqual(result, { status: "failed", reason: "invalid-event" });
  assert.deepEqual(memory.snapshot(), []);
  assert.doesNotMatch(JSON.stringify(result), /credential-secret/u);
});
