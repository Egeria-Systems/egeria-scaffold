import { Cause, Effect, Exit } from "effect";
import { afterEach, expect, it, vi } from "vitest";
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

afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); });

it("loads runtime secrets lazily and uses native fetch only after local validation", async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ id: "controlled-message-reference" }));
  vi.stubGlobal("fetch", request);
  getCloudflareContext.mockResolvedValue({ env: {
    RESEND_API_KEY: "re_controlled_test_credential",
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
