import assert from "node:assert/strict";
import test from "node:test";

import {
  createOperationalEvent,
  normalizeErrorCategory,
} from "@egeria-systems/observability";

const fixedClock = Object.freeze({
  now: () => new Date("2026-08-10T18:00:00.000Z"),
});

test("operational events admit only bounded allowlisted telemetry", () => {
  const result = createOperationalEvent(
    {
      name: "next.request.error",
      kind: "application.error",
      runtime: "server",
      severity: "error",
      context: {
        correlationId: "ray-123",
        releaseId: "release_5",
      },
      errorCategory: "unexpected",
      attributes: {
        attempt: 2,
        infinite: Number.POSITIVE_INFINITY,
        message: "credential-secret response body",
        nested: { private: "credential-secret" },
        ready: true,
        route_kind: "app-router",
        unsafe: "contains whitespace",
      },
    },
    {
      allowedAttributeNames: [
        "attempt",
        "infinite",
        "nested",
        "ready",
        "route_kind",
        "unsafe",
      ],
      clock: fixedClock,
    },
  );

  assert.deepEqual(result, {
    ok: true,
    value: {
      schemaVersion: "1.0.0",
      occurredAt: "2026-08-10T18:00:00.000Z",
      name: "next.request.error",
      kind: "application.error",
      runtime: "server",
      severity: "error",
      context: {
        correlationId: "ray-123",
        releaseId: "release_5",
      },
      errorCategory: "unexpected",
      attributes: {
        attempt: 2,
        ready: true,
        route_kind: "app-router",
      },
    },
  });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.value), true);
  assert.equal(Object.isFrozen(result.value.context), true);
  assert.equal(Object.isFrozen(result.value.attributes), true);
  assert.doesNotMatch(JSON.stringify(result), /credential-secret/u);
});

test("invalid event identity and context fail without echoing rejected values", () => {
  for (const [input, code] of [
    [
      {
        name: "credential-secret request",
        kind: "application.error",
        runtime: "server",
        severity: "error",
        context: { correlationId: "ray-123" },
      },
      "EVENT_NAME_INVALID",
    ],
    [
      {
        name: "next.request.error",
        kind: "application.error",
        runtime: "server",
        severity: "error",
        context: { correlationId: "credential secret" },
      },
      "EVENT_CONTEXT_INVALID",
    ],
  ]) {
    const result = createOperationalEvent(input, { clock: fixedClock });

    assert.deepEqual(result, { ok: false, code });
    assert.doesNotMatch(JSON.stringify(result), /credential-secret|credential secret/u);
  }
});

test("error categories are present only on application errors", () => {
  for (const [input, code] of [
    [
      {
        name: "next.request.error",
        kind: "application.error",
        runtime: "server",
        severity: "error",
        context: { correlationId: "ray-123" },
      },
      "EVENT_ERROR_CATEGORY_INVALID",
    ],
    [
      {
        name: "application.ready",
        kind: "application.lifecycle",
        runtime: "server",
        severity: "info",
        context: { correlationId: "ray-123" },
        errorCategory: "unexpected",
      },
      "EVENT_ERROR_CATEGORY_INVALID",
    ],
  ]) {
    assert.deepEqual(createOperationalEvent(input, { clock: fixedClock }), {
      ok: false,
      code,
    });
  }
});

test("hostile input access is contained without content echoes", () => {
  const input = {
    get name() {
      throw new Error("credential-secret response body");
    },
  };

  const result = createOperationalEvent(input, { clock: fixedClock });

  assert.deepEqual(result, { ok: false, code: "EVENT_INPUT_INVALID" });
  assert.doesNotMatch(JSON.stringify(result), /credential-secret/u);
});

test("error normalization uses bounded names and codes without reading messages", () => {
  assert.equal(normalizeErrorCategory({ name: "AbortError" }), "timeout");
  assert.equal(normalizeErrorCategory({ code: "ENOTFOUND" }), "network");
  assert.equal(
    normalizeErrorCategory({ code: "ERR_INVALID_ARG_TYPE" }),
    "validation",
  );
  assert.equal(
    normalizeErrorCategory({ code: "MODULE_NOT_FOUND" }),
    "dependency",
  );
  assert.equal(
    normalizeErrorCategory({ code: "CONFIGURATION_ERROR" }),
    "configuration",
  );
  assert.equal(
    normalizeErrorCategory({
      get name() {
        throw new Error("credential-secret");
      },
    }),
    "unexpected",
  );
  assert.equal(normalizeErrorCategory(new Error("credential-secret")), "unexpected");
});
