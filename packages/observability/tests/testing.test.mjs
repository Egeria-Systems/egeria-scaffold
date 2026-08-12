import assert from "node:assert/strict";
import test from "node:test";

import {
  createOperationalErrorReport,
  createOperationalEvent,
} from "@egeria-systems/observability";
import {
  assertOperationalErrorReport,
  assertOperationalEvent,
  createMemoryDiagnosticSink,
  createMemorySink,
} from "@egeria-systems/observability/testing";

function createEvent(name) {
  const result = createOperationalEvent(
    {
      name,
      kind: "application.lifecycle",
      runtime: "server",
      severity: "info",
      context: {
        eventId: `event-${name}`,
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

function createReport() {
  const eventResult = createOperationalEvent(
    {
      name: "application.unexpected.error",
      kind: "application.error",
      runtime: "server",
      severity: "error",
      context: { eventId: "event-error-1", service: "web" },
      errorCategory: "unexpected",
    },
    {
      clock: {
        now: () => new Date("2026-08-10T18:00:00.000Z"),
      },
    },
  );
  assert.equal(eventResult.ok, true);
  const reportResult = createOperationalErrorReport(
    eventResult.value,
    { name: "TypeError", message: "bounded failure" },
    { mechanism: "selected-catch", handled: true, operation: "load-page" },
    {},
  );
  assert.equal(reportResult.ok, true);
  return reportResult.value;
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

test("the diagnostic memory sink preserves branded immutable reports and exact assertions", async () => {
  const memory = createMemoryDiagnosticSink();
  const report = createReport();

  assert.deepEqual(await memory.sink.writeReport(report), {
    status: "delivered",
  });
  const snapshot = memory.snapshot();
  assert.deepEqual(snapshot, [report]);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(
    assertOperationalErrorReport(snapshot, {
      eventName: "application.unexpected.error",
      mechanism: "selected-catch",
    }),
    report,
  );

  assert.deepEqual(await memory.sink.writeReport({ ...report }), {
    status: "failed",
    reason: "invalid-event",
  });
  assert.deepEqual(memory.snapshot(), [report]);
  assert.throws(
    () =>
      assertOperationalErrorReport(snapshot, {
        eventName: "application.unexpected.error",
        mechanism: "next-request-error",
      }),
    { message: "OPERATIONAL_ERROR_REPORT_NOT_FOUND" },
  );
});
