import { createOperationalEvent, dispatchOperationalEvent } from "@egeria-systems/observability";
import { createStructuredLogSink } from "@egeria-systems/observability/server";
import { transactionalEmailErrorCodes, type TransactionalEmailEvent } from "@/src/application/transactional-email-sender";

export async function reportTransactionalEmailEvent(event: TransactionalEmailEvent): Promise<void> {
  try {
    if (!["accepted", "failed", "unknown", "interrupted"].includes(event.outcome)) return;
    if ("code" in event && !transactionalEmailErrorCodes.includes(event.code)) return;
    const result = createOperationalEvent({
      name: "transactional.email.send",
      kind: "application.lifecycle",
      runtime: "server",
      severity: event.outcome === "accepted" ? "info" : "warning",
      context: { eventId: crypto.randomUUID(), service: "web" },
      attributes: { outcome: event.outcome, ...("code" in event ? { error_code: event.code } : {}) },
    }, {
      allowedAttributeNames: ["outcome", "error_code"],
      clock: { now: () => new Date() },
    });
    if (!result.ok) return;
    await dispatchOperationalEvent(result.value, [createStructuredLogSink({
      identifier: "cloudflare-workers-logs",
      write: (record) => console.info(record),
    })]);
  } catch {
    // Operational reporting must never become an application failure.
  }
}
