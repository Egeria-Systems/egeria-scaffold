import { createOperationalEvent, dispatchOperationalEvent } from "@egeria-systems/observability";
import { createStructuredLogSink } from "@egeria-systems/observability/server";
import { transactionalEmailErrorCodes, type TransactionalEmailEvent } from "@/src/application/transactional-email-sender";

import { readCompiledApplicationEnvironment, validateRuntimeApplicationEnvironment } from "@/src/configuration/application-environment";
import { readRuntimeApplicationEnvironment } from "@/src/infrastructure/cloudflare/application-environment";

export async function reportTransactionalEmailEvent(event: TransactionalEmailEvent): Promise<void> {
  try {
    if (!["accepted", "failed", "unknown", "interrupted"].includes(event.outcome)) return;
    if ("code" in event && !transactionalEmailErrorCodes.includes(event.code)) return;
    const compiled = readCompiledApplicationEnvironment();
    if (!compiled.ok) return;
    const target = validateRuntimeApplicationEnvironment(await readRuntimeApplicationEnvironment(), compiled.value);
    if (!target.ok) return;
    const result = createOperationalEvent({
      name: "transactional.email.send",
      kind: "application.lifecycle",
      runtime: "server",
      severity: event.outcome === "accepted" ? "info" : "warning",
      context: { eventId: crypto.randomUUID(), service: "web", environment: target.value },
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
