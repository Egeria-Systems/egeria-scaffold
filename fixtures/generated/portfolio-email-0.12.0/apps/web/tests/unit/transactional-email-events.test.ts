import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { reportTransactionalEmailEvent } from "@/src/infrastructure/observability/transactional-email-events";

const { getCloudflareContext } = vi.hoisted(() => ({ getCloudflareContext: vi.fn() }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext }));
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APPLICATION_ENVIRONMENT", "staging");
  getCloudflareContext.mockResolvedValue({ env: { APPLICATION_ENVIRONMENT: "staging" } });
});
afterEach(() => { vi.restoreAllMocks(); vi.resetAllMocks(); vi.unstubAllEnvs(); });

it.each([
  { outcome: "accepted" },
  { outcome: "failed", code: "transactional-email-authorization" },
  { outcome: "unknown", code: "transactional-email-acceptance-unknown" },
  { outcome: "interrupted" },
] as const)("reports only bounded outcome and stable code: %j", async (event) => {
  const write = vi.spyOn(console, "info").mockImplementation(() => {});
  await reportTransactionalEmailEvent({ ...event, ...{ subject: "private-subject", key: "private-key", messageReference: "private-reference" } });
  expect(write).toHaveBeenCalledOnce();
  expect(write.mock.calls[0]?.[0]).toMatchObject({
    event_name: "transactional.email.send", event_kind: "application.lifecycle", runtime: "server", environment: "staging",
    attributes: { outcome: event.outcome, ...("code" in event ? { error_code: event.code } : {}) },
  });
  expect(JSON.stringify(write.mock.calls)).not.toContain("private-");
});

it("contains the structured sink failure", async () => {
  const write = vi.spyOn(console, "info").mockImplementation(() => { throw new Error("private-sink-error"); });
  await expect(reportTransactionalEmailEvent({ outcome: "accepted" })).resolves.toBeUndefined();
  expect(write).toHaveBeenCalledOnce();
});


it.each([undefined, "", "invalid", "production", null])("refuses mismatched targets then restores safe logging (case %#)", async target => {
  const write = vi.spyOn(console, "info").mockImplementation(() => {});
  getCloudflareContext.mockResolvedValue({ env: { APPLICATION_ENVIRONMENT: target } });
  await reportTransactionalEmailEvent({ outcome: "failed", code: "transactional-email-configuration" });
  expect(write).not.toHaveBeenCalled();
  getCloudflareContext.mockResolvedValue({ env: { APPLICATION_ENVIRONMENT: "staging", BETTER_STACK_SOURCE_TOKEN: "partial-provider-configuration" } });
  await reportTransactionalEmailEvent({ outcome: "accepted" });
  expect(write).toHaveBeenCalledOnce();
  expect(write.mock.calls[0]?.[0]).toMatchObject({ environment: "staging" });
});

it.each(["development", "staging", "production"])("labels the independent safe-only stream for %s", async target => {
  const write = vi.spyOn(console, "info").mockImplementation(() => {});
  vi.stubEnv("NEXT_PUBLIC_APPLICATION_ENVIRONMENT", target);
  getCloudflareContext.mockResolvedValue({ env: { APPLICATION_ENVIRONMENT: target } });
  await reportTransactionalEmailEvent({ outcome: "accepted" });
  expect(write).toHaveBeenCalledOnce();
  expect(write.mock.calls[0]?.[0]).toMatchObject({ environment: target });
});
