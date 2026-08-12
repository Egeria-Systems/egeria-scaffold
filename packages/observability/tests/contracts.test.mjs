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
        eventId: "event-123",
        correlationId: "ray-123",
        releaseId: "release_5",
        service: "web",
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
      schemaVersion: "2.0.0",
      occurredAt: "2026-08-10T18:00:00.000Z",
      name: "next.request.error",
      kind: "application.error",
      runtime: "server",
      severity: "error",
      context: {
        eventId: "event-123",
        correlationId: "ray-123",
        releaseId: "release_5",
        service: "web",
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
        context: { eventId: "event-123", service: "web" },
      },
      "EVENT_NAME_INVALID",
    ],
    [
      {
        name: "next.request.error",
        kind: "application.error",
        runtime: "server",
        severity: "error",
        context: { eventId: "credential secret", service: "web" },
      },
      "EVENT_CONTEXT_INVALID",
    ],
    [
      {
        name: "application.ready",
        kind: "application.lifecycle",
        runtime: "server",
        severity: "info",
        context: { eventId: "127.0.0.1", service: "web" },
      },
      "EVENT_CONTEXT_INVALID",
    ],
    [
      {
        name: "application.ready",
        kind: "application.lifecycle",
        runtime: "server",
        severity: "info",
        context: { eventId: "2001:db8::192.0.2.1", service: "web" },
      },
      "EVENT_CONTEXT_INVALID",
    ],
    [
      {
        name: "application.ready",
        kind: "application.lifecycle",
        runtime: "server",
        severity: "info",
        context: {
          eventId: "event-123",
          releaseId: "sk_live_fictionalValue123",
          service: "web",
        },
      },
      "EVENT_CONTEXT_INVALID",
    ],
  ]) {
    const result = createOperationalEvent(input, { clock: fixedClock });

    assert.deepEqual(result, { ok: false, code });
    assert.doesNotMatch(JSON.stringify(result), /credential-secret|credential secret/u);
  }

  const longNameResult = createOperationalEvent(
    {
      name: `event.${"a".repeat(100_000)}`,
      kind: "application.lifecycle",
      runtime: "server",
      severity: "info",
      context: { eventId: "event-123", service: "web" },
    },
    { clock: fixedClock },
  );
  assert.deepEqual(longNameResult, {
    ok: false,
    code: "EVENT_NAME_INVALID",
  });
  assert.equal(JSON.stringify(longNameResult).length < 100, true);
});

test("private-data keys and secret-like string values are never admitted", () => {
  for (const prohibitedName of [
    "console_output",
    "credential_value",
    "filename",
    "form_value",
    "request_body",
    "response_body",
  ]) {
    const result = createOperationalEvent(
      {
        name: "application.ready",
        kind: "application.lifecycle",
        runtime: "server",
        severity: "info",
        context: { eventId: "event-123", service: "web" },
        attributes: { [prohibitedName]: "private-value" },
      },
      {
        allowedAttributeNames: [prohibitedName],
        clock: fixedClock,
      },
    );

    assert.deepEqual(result, {
      ok: false,
      code: "EVENT_ATTRIBUTE_POLICY_INVALID",
    });
  }

  for (const privateValue of [
    "credential-secret",
    "ghp_fictionalAccessToken123",
    "sk_live_fictionalValue123",
    "source-token-123456",
    "aaaabbbb.ccccdddd.eeeeffff",
    "127.0.0.1",
    "2001:db8:1:2:3:4:5:6",
    "2001:db8::1",
    "::1",
    "2001:db8::192.0.2.1",
    "0:0:0:0:0:ffff:192.0.2.128",
  ]) {
    const result = createOperationalEvent(
      {
        name: "application.ready",
        kind: "application.lifecycle",
        runtime: "server",
        severity: "info",
        context: { eventId: "event-123", service: "web" },
        attributes: { operation: privateValue },
      },
      {
        allowedAttributeNames: ["operation"],
        clock: fixedClock,
      },
    );

    assert.equal(result.ok, true);
    assert.deepEqual(result.value.attributes, {});
    assert.doesNotMatch(JSON.stringify(result), new RegExp(privateValue, "u"));
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
        context: { eventId: "event-123", service: "web" },
      },
      "EVENT_ERROR_CATEGORY_INVALID",
    ],
    [
      {
        name: "application.ready",
        kind: "application.lifecycle",
        runtime: "server",
        severity: "info",
        context: { eventId: "event-123", service: "web" },
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
