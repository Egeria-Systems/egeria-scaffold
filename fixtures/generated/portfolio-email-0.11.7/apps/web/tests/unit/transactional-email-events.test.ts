import { afterEach, expect, it, vi } from "vitest";
import { reportTransactionalEmailEvent } from "@/src/infrastructure/observability/transactional-email-events";

afterEach(() => { vi.restoreAllMocks(); });

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
    event_name: "transactional.email.send", event_kind: "application.lifecycle", runtime: "server",
    attributes: { outcome: event.outcome, ...("code" in event ? { error_code: event.code } : {}) },
  });
  expect(JSON.stringify(write.mock.calls)).not.toContain("private-");
});

it("contains the structured sink failure", async () => {
  vi.spyOn(console, "info").mockImplementation(() => { throw new Error("private-sink-error"); });
  await expect(reportTransactionalEmailEvent({ outcome: "accepted" })).resolves.toBeUndefined();
});
