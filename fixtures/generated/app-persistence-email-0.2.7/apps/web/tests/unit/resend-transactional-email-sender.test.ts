import { Cause, Effect, Exit } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TransactionalEmailSender,
  type TransactionalEmailMessage,
} from "@/src/application/transactional-email-sender";
import { createResendTransactionalEmailSenderLayer } from "@/src/infrastructure/resend/transactional-email-sender";

const configuration = Object.freeze({
  RESEND_API_KEY: "re_controlled_test_credential",
  TRANSACTIONAL_EMAIL_FROM: "sender@example.com",
  TRANSACTIONAL_EMAIL_DOMAIN: "example.com",
});
const message: TransactionalEmailMessage = Object.freeze({
  to: "recipient@example.net",
  replyTo: "reply@example.com",
  subject: "Private test subject",
  text: "Private test plain text",
  html: "<p>Private test HTML</p>",
  idempotencyKey: "f9e140fa-793d-4653-bfdb-aadf99739502",
});
const messageReference = "bd479528-24e4-4f76-ae48-921874a9e461";

function setup(environment: unknown = configuration) {
  const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ id: messageReference }));
  const reportEvent = vi.fn<(event: unknown) => void | Promise<void>>();
  const readConfiguration = vi.fn(() => environment);
  const layer = createResendTransactionalEmailSenderLayer({
    configuration: Effect.sync(readConfiguration), request, reportEvent,
  });
  const program = (input: TransactionalEmailMessage = message) => Effect.gen(function* () {
    const sender = yield* TransactionalEmailSender;
    return yield* sender.send(input);
  }).pipe(Effect.provide(layer));
  return { request, reportEvent, readConfiguration, program };
}

function failure(exit: Awaited<ReturnType<typeof Effect.runPromiseExit>>) {
  if (!Exit.isFailure(exit)) throw new Error("Expected a failure");
  const reason = exit.cause.reasons[0];
  if (reason === undefined || !Cause.isFailReason(reason)) throw new Error("Expected typed failure");
  return reason.error;
}

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("Resend transactional email sender", () => {
  it("sends one lazy fixed-origin request and returns only provider acceptance", async () => {
    const { program, request, readConfiguration, reportEvent } = setup();
    const pending = program();
    expect(request).not.toHaveBeenCalled();
    expect(readConfiguration).not.toHaveBeenCalled();
    const result = await Effect.runPromise(pending);
    expect(result).toEqual({ status: "accepted", messageReference });
    expect(Object.isFrozen(result)).toBe(true);
    expect(request).toHaveBeenCalledExactlyOnceWith("https://api.resend.com/emails", {
      method: "POST", redirect: "error", signal: expect.any(AbortSignal),
      headers: {
        Authorization: `Bearer ${configuration.RESEND_API_KEY}`,
        "Content-Type": "application/json", "Idempotency-Key": message.idempotencyKey,
      },
      body: JSON.stringify({
        from: configuration.TRANSACTIONAL_EMAIL_FROM, to: [message.to],
        subject: message.subject, text: message.text, reply_to: message.replyTo, html: message.html,
      }),
    });
    expect(reportEvent).toHaveBeenCalledExactlyOnceWith({ outcome: "accepted" });
  });

  it("omits optional payload fields and ignores caller-supplied sender overrides", async () => {
    const { program, request } = setup();
    await Effect.runPromise(program({
      to: message.to, subject: message.subject, text: message.text, idempotencyKey: message.idempotencyKey,
      ...{ from: "untrusted@example.net" },
    }));
    expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toEqual({
      from: configuration.TRANSACTIONAL_EMAIL_FROM, to: [message.to], subject: message.subject, text: message.text,
    });
  });

  it.each([
    { to: "bad\r\naddress@example.com" }, { to: "one@example.com,two@example.com" },
    { to: ["one@example.com"] }, { replyTo: "Name <reply@example.com>" },
    { subject: "" }, { subject: "header\ninjection" }, { subject: "header\u001finjection" }, { text: "" }, { html: "" },
    { idempotencyKey: "" }, { idempotencyKey: "x".repeat(257) },
    { idempotencyKey: "private@example.com" }, { idempotencyKey: "bad\r\nheader" },
  ])("rejects invalid message fields before reading configuration: %j", async (invalid) => {
    const { program, request, readConfiguration } = setup();
    const result = failure(await Effect.runPromiseExit(program({ ...message, ...invalid } as TransactionalEmailMessage)));
    expect(result).toMatchObject({ code: "transactional-email-validation" });
    expect(request).not.toHaveBeenCalled();
    expect(readConfiguration).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it.each([
    {}, null, { ...configuration, RESEND_API_KEY: "" },
    { ...configuration, RESEND_API_KEY: "re_bad\nheader" },
    { ...configuration, TRANSACTIONAL_EMAIL_FROM: "Name <sender@example.com>" },
    { ...configuration, TRANSACTIONAL_EMAIL_DOMAIN: "another.example.com" },
    { ...configuration, TRANSACTIONAL_EMAIL_DOMAIN: "https://example.com" },
  ])("rejects invalid local runtime configuration without HTTP: %j", async (environment) => {
    const { program, request } = setup(environment);
    expect(failure(await Effect.runPromiseExit(program()))).toMatchObject({ code: "transactional-email-configuration" });
    expect(request).not.toHaveBeenCalled();
  });

  it.each([
    [400, "validation_error", "validation"],
    [401, "missing_api_key", "authorization"],
    [403, "validation_error", "authorization"],
    [409, "invalid_idempotent_request", "idempotency-conflict"],
    [409, "concurrent_idempotent_requests", "idempotency-conflict"],
    [422, "missing_required_field", "validation"],
    [429, "rate_limit_exceeded", "rate-limited"],
    [429, "daily_quota_exceeded", "quota-exceeded"],
    [429, "monthly_quota_exceeded", "quota-exceeded"],
    [404, "not_found", "unavailable"],
    [500, "application_error", "acceptance-unknown"],
    [503, "service_unavailable", "acceptance-unknown"],
    [409, "unrecognized", "acceptance-unknown"],
  ])("maps HTTP %i / %s without retaining provider text", async (status, name, code) => {
    const { program, request, reportEvent } = setup();
    request.mockResolvedValue(Response.json({ name, message: "private-provider-body" }, { status }));
    const result = failure(await Effect.runPromiseExit(program()));
    expect(result).toMatchObject({ _tag: "TransactionalEmailFailure", code: `transactional-email-${code}` });
    expect(JSON.stringify(result)).not.toContain("private-provider-body");
    expect(result).not.toHaveProperty("cause");
    expect(request).toHaveBeenCalledOnce();
    expect(reportEvent).toHaveBeenCalledExactlyOnceWith({
      outcome: code === "acceptance-unknown" ? "unknown" : "failed", code: `transactional-email-${code}`,
    });
  });

  it.each(["0", "15", "86400", "-1", "1.5", "86401", "untrusted", "9999999999999999999"])(
    "preserves only bounded integer retry-after seconds: %s", async (hint) => {
      const { program, request } = setup();
      request.mockResolvedValue(Response.json({ name: "rate_limit_exceeded" }, { status: 429, headers: { "Retry-After": hint } }));
      const result = failure(await Effect.runPromiseExit(program()));
      if (["0", "15", "86400"].includes(hint)) expect(result).toHaveProperty("retryAfterSeconds", Number(hint));
      else expect(result).not.toHaveProperty("retryAfterSeconds");
      expect(request).toHaveBeenCalledOnce();
    },
  );

  it("normalizes bounded HTTP-date retry hints without retrying", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-22T12:00:00Z"));
    for (const [hint, seconds] of [
      ["Tue, 22 Sep 2026 12:00:15 GMT", 15],
      ["Wed, 23 Sep 2026 12:00:00 GMT", 86_400],
      ["Thu, 24 Sep 2026 12:00:00 GMT", undefined],
    ] as const) {
      const { program, request } = setup();
      request.mockResolvedValue(Response.json({ name: "rate_limit_exceeded" }, { status: 429, headers: { "Retry-After": hint } }));
      const result = failure(await Effect.runPromiseExit(program()));
      if (seconds === undefined) expect(result).not.toHaveProperty("retryAfterSeconds");
      else expect(result).toHaveProperty("retryAfterSeconds", seconds);
      expect(request).toHaveBeenCalledOnce();
    }
  });

  it.each([{}, { id: "" }, { id: "private@example.com" }, { id: messageReference, name: "error" }])(
    "treats invalid success envelopes as unknown acceptance: %j", async (body) => {
      const { program, request } = setup();
      request.mockResolvedValue(Response.json(body));
      expect(failure(await Effect.runPromiseExit(program()))).toMatchObject({ code: "transactional-email-acceptance-unknown" });
    },
  );

  it("bounds response bytes and cancels oversized bodies", async () => {
    const { program, request } = setup();
    const cancel = vi.fn();
    request.mockResolvedValue(new Response(new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(16_385)); }, cancel,
    })));
    expect(failure(await Effect.runPromiseExit(program()))).toMatchObject({ code: "transactional-email-acceptance-unknown" });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it.each(["throw", "reject"])("contains transport %s as unknown acceptance", async (mode) => {
    const { program, request } = setup();
    if (mode === "throw") request.mockImplementation(() => { throw new Error("private-transport-error"); });
    else request.mockRejectedValue(new Error("private-transport-error"));
    const result = failure(await Effect.runPromiseExit(program()));
    expect(result).toMatchObject({ code: "transactional-email-acceptance-unknown" });
    expect(JSON.stringify(result)).not.toContain("private-transport-error");
    expect(request).toHaveBeenCalledOnce();
  });

  it.each(["headers", "body", "delayed headers"])("enforces one ten-second deadline while waiting for %s", async (waitingFor) => {
    vi.useFakeTimers();
    const { program, request } = setup();
    const cancel = vi.fn();
    if (waitingFor === "headers") request.mockImplementation(() => new Promise(() => {}));
    else if (waitingFor === "delayed headers") request.mockImplementation(() => new Promise((resolve) => {
      setTimeout(() => { resolve(new Response(new ReadableStream({ cancel }))); }, 6_000);
    }));
    else request.mockResolvedValue(new Response(new ReadableStream({ cancel })));
    const result = Effect.runPromiseExit(program());
    await vi.advanceTimersByTimeAsync(9_999);
    expect(request).toHaveBeenCalledOnce();
    const signal = request.mock.calls[0]?.[1]?.signal;
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(failure(await result)).toMatchObject({ code: "transactional-email-acceptance-unknown" });
    expect(signal?.aborted).toBe(true);
    if (waitingFor !== "headers") expect(cancel).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    ["invalid JSON", () => new Response("private-invalid-json")],
    ["missing body", () => new Response(null, { status: 204 })],
    ["invalid UTF-8", () => new Response(new Uint8Array([255]))],
    ["stream failure", () => new Response(new ReadableStream({ start(controller) { controller.error(new Error("private-stream-error")); } }))],
  ] as const)("contains %s as unknown acceptance", async (_description, response) => {
    const { program, request } = setup();
    request.mockResolvedValue(response());
    const result = failure(await Effect.runPromiseExit(program()));
    expect(result).toMatchObject({ code: "transactional-email-acceptance-unknown" });
    expect(JSON.stringify(result)).not.toContain("private-");
    expect(request).toHaveBeenCalledOnce();
  });

  it("cancels a response that arrives after the deadline without changing the result", async () => {
    vi.useFakeTimers();
    const { program, request, reportEvent } = setup();
    let resolveRequest: (response: Response) => void = () => {};
    request.mockImplementation(() => new Promise((resolve) => { resolveRequest = resolve; }));
    const pending = Effect.runPromiseExit(program());
    await vi.advanceTimersByTimeAsync(10_000);
    expect(failure(await pending)).toMatchObject({ code: "transactional-email-acceptance-unknown" });
    const cancel = vi.fn();
    resolveRequest(new Response(new ReadableStream({ cancel })));
    await vi.advanceTimersByTimeAsync(0);
    expect(cancel).toHaveBeenCalledOnce();
    expect(reportEvent).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledOnce();
  });

  it("starts no request when the execution signal is already aborted", async () => {
    const { program, request } = setup();
    const controller = new AbortController();
    controller.abort();
    const exit = await Effect.runPromiseExit(program(), { signal: controller.signal });
    expect(Exit.isFailure(exit)).toBe(true);
    expect(request).not.toHaveBeenCalled();
  });

  it("preserves interruption while aborting active HTTP and recording only its category", async () => {
    const { program, request, reportEvent } = setup();
    request.mockImplementation(() => new Promise(() => {}));
    const controller = new AbortController();
    const pending = Effect.runPromiseExit(program(), { signal: controller.signal });
    await vi.waitFor(() => { expect(request).toHaveBeenCalledOnce(); });
    controller.abort();
    const exit = await pending;
    if (!Exit.isFailure(exit)) throw new Error("Expected interrupted effect");
    expect(exit.cause.reasons.some(Cause.isInterruptReason)).toBe(true);
    expect(request.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    expect(reportEvent).toHaveBeenCalledExactlyOnceWith({ outcome: "interrupted" });
  });

  it.each(["throw", "reject", "pending"])("reporter %s cannot change acceptance or send again", async (mode) => {
    const { program, request, reportEvent } = setup();
    if (mode === "throw") reportEvent.mockImplementation(() => { throw new Error("private-report-error"); });
    else if (mode === "reject") reportEvent.mockRejectedValue(new Error("private-report-error"));
    else reportEvent.mockImplementation(() => new Promise(() => {}));
    expect(await Effect.runPromise(program())).toEqual({ status: "accepted", messageReference });
    expect(request).toHaveBeenCalledOnce();
  });
});
