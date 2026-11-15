import { Cause, Effect, Exit } from "effect";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TransactionalEmailSender } from "@/src/application/transactional-email-sender";
import { serverTransactionalEmailLayer } from "@/src/composition/server-transactional-email";

const { getCloudflareContext, reportTransactionalEmailEvent } = vi.hoisted(() => ({
  getCloudflareContext: vi.fn<() => Promise<unknown>>(),
  reportTransactionalEmailEvent: vi.fn(),
}));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext }));
vi.mock("@/src/infrastructure/observability/transactional-email-events", () => ({ reportTransactionalEmailEvent }));

const send = Effect.gen(function* () {
  const sender = yield* TransactionalEmailSender;
  return yield* sender.send({ to: "recipient@example.net", subject: "Test", text: "Test", idempotencyKey: "opaque-test-key" });
}).pipe(Effect.provide(serverTransactionalEmailLayer));

beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_APPLICATION_ENVIRONMENT", "production"); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetAllMocks(); });

it("loads runtime secrets lazily and uses native fetch only after local validation", async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ id: "controlled-message-reference" }));
  vi.stubGlobal("fetch", request);
  getCloudflareContext.mockResolvedValue({ env: {
    APPLICATION_ENVIRONMENT: "production", RESEND_API_KEY: "re_controlled_test_credential",
    TRANSACTIONAL_EMAIL_FROM: "sender@example.com", TRANSACTIONAL_EMAIL_DOMAIN: "example.com",
  } });
  expect(getCloudflareContext).not.toHaveBeenCalled();
  expect(await Effect.runPromise(send)).toEqual({ status: "accepted", messageReference: "controlled-message-reference" });
  expect(getCloudflareContext).toHaveBeenCalledExactlyOnceWith({ async: true });
  expect(request).toHaveBeenCalledOnce();
  expect(reportTransactionalEmailEvent).toHaveBeenCalledExactlyOnceWith({ outcome: "accepted" });
});

it("contains unavailable runtime configuration without revealing provider exceptions", async () => {
  getCloudflareContext.mockRejectedValue(new Error("private-runtime-configuration"));
  const request = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", request);
  const exit = await Effect.runPromiseExit(send);
  if (!Exit.isFailure(exit)) throw new Error("Expected configuration failure");
  expect(exit.cause.reasons.some((reason) => Cause.isFailReason(reason) && reason.error.code === "transactional-email-configuration")).toBe(true);
  expect(JSON.stringify(exit)).not.toContain("private-runtime-configuration");
  expect(request).not.toHaveBeenCalled();
});


it.each([
  ["staging", "recipient@example.net", "accepted", 1],
  ["staging", "different@example.test", "transactional-email-authorization", 0],
  ["staging", undefined, "transactional-email-configuration", 0],
  ["production", "recipient@example.net", "transactional-email-configuration", 0],
] as const)("enforces runtime isolation through the actual server layer (case %#)", async (runtime, allowlist, outcome, attempts) => {
  vi.stubEnv("NEXT_PUBLIC_APPLICATION_ENVIRONMENT", "staging");
  getCloudflareContext.mockResolvedValue({ env: {
    APPLICATION_ENVIRONMENT: runtime, TRANSACTIONAL_EMAIL_ALLOWED_RECIPIENTS: allowlist,
    RESEND_API_KEY: "re_controlled_test_credential", TRANSACTIONAL_EMAIL_FROM: "sender@example.com", TRANSACTIONAL_EMAIL_DOMAIN: "example.com",
  } });
  const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ id: "controlled-message-reference" }));
  vi.stubGlobal("fetch", request);
  const exit = await Effect.runPromiseExit(send);
  expect(request.mock.calls.length).toBe(attempts);
  if (outcome === "accepted") expect(Exit.isSuccess(exit)).toBe(true);
  else {
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(exit.cause.reasons.some(reason => Cause.isFailReason(reason) && reason.error.code === outcome)).toBe(true);
    expect(JSON.stringify(exit)).not.toMatch(/recipient@|sender@|re_controlled|opaque-test-key|controlled-message-reference/u);
  }
});


it("runs the documented local example with intercepted transport", async () => {
  vi.stubEnv("NEXT_PUBLIC_APPLICATION_ENVIRONMENT", "development");
  getCloudflareContext.mockResolvedValue({ env: {
    APPLICATION_ENVIRONMENT: "development",
    RESEND_API_KEY: "re_controlled_test_credential",
    TRANSACTIONAL_EMAIL_FROM: "sender@example.test",
    TRANSACTIONAL_EMAIL_DOMAIN: "example.test",
    TRANSACTIONAL_EMAIL_ALLOWED_RECIPIENTS: "allowed@example.test,second@example.test",
  } });
  let attemptedCalls = 0;
  vi.stubGlobal("fetch", async (url: string | URL | Request) => {
    if (url !== "https://api.resend.com/emails") throw new Error("Unexpected transport");
    attemptedCalls += 1;
    return Response.json({ id: "synthetic-acceptance" });
  });
  const program = Effect.gen(function* () {
    const sender = yield* TransactionalEmailSender;
    return yield* sender.send({
      to: "allowed@example.test", subject: "Local example", text: "Synthetic message",
      idempotencyKey: "local-example-001",
    });
  }).pipe(Effect.provide(serverTransactionalEmailLayer));
  const result = await Effect.runPromise(program);
  expect({ status: result.status, attemptedCalls }).toEqual({ status: "accepted", attemptedCalls: 1 });
});
