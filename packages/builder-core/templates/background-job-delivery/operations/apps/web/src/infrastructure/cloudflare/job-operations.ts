import { createHash } from "node:crypto";
import { isJobEnvironment, prepareJobRecovery, validateJob, type JobDefinition, type JobEnvelope, type JobEnvironment } from "@/src/application/job-delivery";

export type OperationScope = Readonly<{
  environment: JobEnvironment; accountId: string;
  primary: Readonly<{ id: string; name: string }>;
  deadLetter: Readonly<{ id: string; name: string }>;
  consumer: Readonly<{ id: string; scriptName: string }>;
  revision: string; registryDigest: string; deployedCompatibilityReviewed: true;
}>;
export type OperationBounds = Readonly<{ maxMessages: number; maxRequests: number; maxDurationMs: number; observations: number; intervalMs: number }>;
export type OperationRequest = Readonly<{
  version: 1; command: "inspect" | "plan-replay" | "replay" | "drain"; authorized: true;
  scope: OperationScope; issuedAt: number; expiresAt: number; bounds: OperationBounds;
  selection?: readonly Readonly<{ messageId: string; originalRetentionDeadline: number }>[];
  priorEffectsReconciled?: true; producersStopped?: true; approvalFingerprint?: string;
}>;
export type OperationContext = Readonly<{ configuration: unknown; revision: string; registryDigest: string; handlers: readonly JobDefinition[] }>;
export type PeekedMessage = Readonly<{ id: string; ref: string; body: string; timestamp_ms: number; attempts: number }>;
export type ReplayEntry = Readonly<{ messageId: string; ref: string; sourceDigest: string; envelope: JobEnvelope; envelopeDigest: string;
  originalRetentionDeadline: number; handler: Readonly<{ type: string; version: number; repeatSafety: JobDefinition["repeatSafety"] }> }>;
export type ReplayPlan = Readonly<{ version: 1; scope: OperationScope; bounds: OperationBounds; issuedAt: number; expiresAt: number;
  disposition: "remove-after-accepted"; entries: readonly ReplayEntry[]; fingerprint: string }>;
export type ReplayStage = "prepared" | "send-started" | "send-accepted" | "removal-started" | "removed";
export type ReplayCheckpoint = Readonly<{ version: 1; fingerprint: string; complete: boolean;
  entries: readonly Readonly<{ messageHash: string; stage: ReplayStage }>[] }>;
export type JobOperationTransport = Readonly<{
  resource: (id: string) => Promise<unknown>; peek: () => Promise<unknown>;
  send: (job: JobEnvelope) => Promise<void>; remove: (ref: string) => Promise<void>; metrics: () => Promise<unknown>;
}>;
const digestPattern = /^[a-f0-9]{64}$/u;
const idPattern = /^[a-f0-9]{32}$/u;
const namePattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;
export function refuse(code = "job-operation-invalid"): never { throw new Error(code); }
function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return refuse();
  return value as Record<string, unknown>;
}
function keys(value: unknown, expected: readonly string[]): Record<string, unknown> {
  const result = record(value);
  if (Object.keys(result).sort().join() !== [...expected].sort().join()) refuse();
  return result;
}
function integer(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum && (value as number) <= maximum;
}
function boundedString(value: unknown, limit: number): value is string { return typeof value === "string" && value.length > 0 && value.length <= limit; }
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return "{" + Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",") + "}";
  return JSON.stringify(value);
}
export function fingerprint(value: unknown): string { return createHash("sha256").update(canonical(value)).digest("hex"); }

export function validateOperationRequest(value: unknown, context: OperationContext, now: number): OperationRequest {
  const candidate = record(value);
  const common = ["version", "command", "authorized", "scope", "issuedAt", "expiresAt", "bounds"];
  const extra = candidate.command === "plan-replay" ? ["selection", "priorEffectsReconciled"] :
    candidate.command === "replay" ? ["approvalFingerprint", "priorEffectsReconciled"] : candidate.command === "drain" ? ["producersStopped"] : [];
  keys(value, [...common, ...extra]);
  if (candidate.version !== 1 || candidate.authorized !== true || !["inspect", "plan-replay", "replay", "drain"].includes(String(candidate.command))) refuse("job-unauthorized");
  const scope = keys(candidate.scope, ["environment", "accountId", "primary", "deadLetter", "consumer", "revision", "registryDigest", "deployedCompatibilityReviewed"]);
  if (!isJobEnvironment(scope.environment) || !idPattern.test(String(scope.accountId)) || scope.revision !== context.revision ||
    !/^[a-f0-9]{40}$/u.test(String(scope.revision)) || scope.registryDigest !== context.registryDigest || !digestPattern.test(String(scope.registryDigest)) ||
    scope.deployedCompatibilityReviewed !== true) refuse("job-context-mismatch");
  const primary = keys(scope.primary, ["id", "name"]); const dead = keys(scope.deadLetter, ["id", "name"]);
  const consumer = keys(scope.consumer, ["id", "scriptName"]);
  if (![primary.id, dead.id, consumer.id].every((id) => typeof id === "string" && idPattern.test(id)) ||
    ![primary.name, dead.name, consumer.scriptName].every((name) => typeof name === "string" && namePattern.test(name)) ||
    primary.id === dead.id || primary.name === dead.name) refuse("job-context-mismatch");
  if (!integer(candidate.issuedAt, now - 900_000, now) || !integer(candidate.expiresAt, now + 1, candidate.issuedAt + 900_000)) refuse("job-authorization-expired");
  const bounds = keys(candidate.bounds, ["maxMessages", "maxRequests", "maxDurationMs", "observations", "intervalMs"]);
  if (!integer(bounds.maxMessages, 1, 20) || !integer(bounds.maxRequests, 3, 100) || !integer(bounds.maxDurationMs, 100, 60_000) ||
    !integer(bounds.observations, 2, 10) || !integer(bounds.intervalMs, 10, 5_000) || bounds.observations * bounds.intervalMs > bounds.maxDurationMs) refuse("job-bounds-invalid");
  if ((candidate.command === "plan-replay" || candidate.command === "replay") && candidate.priorEffectsReconciled !== true) refuse("job-reconciliation-required");
  if (candidate.command === "drain" && candidate.producersStopped !== true) refuse("job-unauthorized");
  if (candidate.command === "replay" && !digestPattern.test(String(candidate.approvalFingerprint))) refuse("job-plan-mismatch");
  if (candidate.command === "plan-replay") {
    if (!Array.isArray(candidate.selection) || candidate.selection.length < 1 || candidate.selection.length > bounds.maxMessages) refuse("job-selection-invalid");
    const identities = new Set();
    for (const item of candidate.selection) {
      const selected = keys(item, ["messageId", "originalRetentionDeadline"]);
      if (!boundedString(selected.messageId, 256) || identities.has(selected.messageId) ||
        !integer(selected.originalRetentionDeadline, now + 1, now + 86_400_000)) refuse("job-selection-invalid");
      identities.add(selected.messageId);
    }
  }
  const config = record(context.configuration);
  const selected = record(scope.environment === "local" ? config : record(config.env)[scope.environment]);
  const vars = record(selected.vars); const queues = record(selected.queues);
  if (config.main !== "worker.mjs" || selected.name !== consumer.scriptName || vars.JOB_ENVIRONMENT !== scope.environment ||
    vars.JOB_QUEUE_NAME !== primary.name || vars.JOB_DEAD_LETTER_QUEUE_NAME !== dead.name ||
    !Array.isArray(queues.producers) || queues.producers.length !== 2 || !Array.isArray(queues.consumers) || queues.consumers.length !== 1) refuse("job-configuration-mismatch");
  if (queues.producers.filter((item) => record(item).binding === "JOB_QUEUE" && record(item).queue === primary.name).length !== 1 ||
    queues.producers.filter((item) => record(item).binding === "JOB_DEAD_LETTER_QUEUE" && record(item).queue === dead.name).length !== 1) refuse("job-configuration-mismatch");
  const configured = record(queues.consumers[0]);
  if (configured.queue !== primary.name || configured.dead_letter_queue !== dead.name || configured.max_retries !== 3 ||
    configured.max_batch_size !== 10 || configured.max_batch_timeout !== 5 || configured.retry_delay !== 5) refuse("job-configuration-mismatch");
  return value as OperationRequest;
}

export function validateResources(scope: OperationScope, primaryValue: unknown, deadValue: unknown): void {
  const primary = record(primaryValue); const dead = record(deadValue);
  for (const [value, expected] of [[primary, scope.primary], [dead, scope.deadLetter]] as const) {
    if (value.queue_id !== expected.id || value.queue_name !== expected.name || record(value.settings).message_retention_period !== 86_400) refuse("job-resource-mismatch");
  }
  if (!Array.isArray(primary.consumers) || primary.consumers.length !== 1 || primary.consumers_total_count !== 1 ||
    !Array.isArray(dead.consumers) || dead.consumers.length !== 0 || dead.consumers_total_count !== 0) refuse("job-resource-mismatch");
  const consumer = record(primary.consumers[0]); const settings = record(consumer.settings);
  if (consumer.type !== "worker" || consumer.consumer_id !== scope.consumer.id || consumer.script_name !== scope.consumer.scriptName ||
    consumer.dead_letter_queue !== scope.deadLetter.name || settings.max_retries !== 3 || settings.batch_size !== 10 ||
    settings.max_wait_time_ms !== 5_000 || settings.retry_delay !== 5 || record(primary.settings).delivery_paused !== false ||
    record(primary.settings).delivery_delay !== 0) refuse("job-resource-mismatch");
}

export function validatePeek(value: unknown, maximum: number): readonly PeekedMessage[] {
  if (!Array.isArray(value) || value.length > maximum) refuse("job-provider-invalid");
  const ids = new Set(); const refs = new Set();
  for (const item of value) {
    const message = record(item);
    if (!boundedString(message.id, 256) || !boundedString(message.ref, 4096) || !boundedString(message.body, 32_768) ||
      new TextEncoder().encode(message.body).byteLength > 32_768 || !integer(message.timestamp_ms, 0, Number.MAX_SAFE_INTEGER) ||
      !integer(message.attempts, 0, Number.MAX_SAFE_INTEGER) || ids.has(message.id) || refs.has(message.ref)) refuse("job-provider-invalid");
    ids.add(message.id); refs.add(message.ref);
  }
  // Provider metadata is intentionally excluded from our private replay input.
  return value.map((item) => ({ id: item.id, ref: item.ref, body: item.body, timestamp_ms: item.timestamp_ms, attempts: item.attempts })) as PeekedMessage[];
}
export function buildReplayPlan(request: OperationRequest, messages: readonly PeekedMessage[], handlers: readonly JobDefinition[], now: number): ReplayPlan {
  if (request.command !== "plan-replay" || request.priorEffectsReconciled !== true || !request.selection) refuse("job-unauthorized");
  const operationIds = new Set();
  const entries = request.selection.map((selected): ReplayEntry => {
    const message = messages.find((item) => item.id === selected.messageId);
    if (!message || selected.originalRetentionDeadline <= now || selected.originalRetentionDeadline > message.timestamp_ms + 86_400_000) refuse("job-selection-stale");
    let envelope: JobEnvelope;
    try { envelope = prepareJobRecovery(JSON.parse(message.body), request.scope.environment, handlers); }
    catch { return refuse("job-handler-incompatible"); }
    if (operationIds.has(envelope.operationId)) refuse("job-selection-duplicate");
    operationIds.add(envelope.operationId);
    const handler = handlers.find((item) => item.type === envelope.jobType && item.version === envelope.jobVersion)!;
    return { messageId: message.id, ref: message.ref, sourceDigest: fingerprint(message.body), envelope, envelopeDigest: fingerprint(envelope),
      originalRetentionDeadline: selected.originalRetentionDeadline, handler: { type: handler.type, version: handler.version, repeatSafety: handler.repeatSafety } };
  });
  const plan = { version: 1 as const, scope: request.scope, bounds: request.bounds, issuedAt: now,
    expiresAt: Math.min(request.expiresAt, ...entries.map((entry) => entry.originalRetentionDeadline)), disposition: "remove-after-accepted" as const, entries };
  return { ...plan, fingerprint: fingerprint(plan) };
}
export function validateReplayPlan(value: unknown, request: OperationRequest, context: OperationContext, now: number): ReplayPlan {
  const plan = keys(value, ["version", "scope", "bounds", "issuedAt", "expiresAt", "disposition", "entries", "fingerprint"]);
  const { fingerprint: storedFingerprint, ...content } = plan;
  if (plan.version !== 1 || plan.disposition !== "remove-after-accepted" || storedFingerprint !== request.approvalFingerprint ||
    storedFingerprint !== fingerprint(content) || fingerprint(plan.scope) !== fingerprint(request.scope) || fingerprint(plan.bounds) !== fingerprint(request.bounds) ||
    !integer(plan.issuedAt, now - 900_000, now) || !integer(plan.expiresAt, now + 1, plan.issuedAt + 900_000) ||
    !Array.isArray(plan.entries) || plan.entries.length < 1 || plan.entries.length > request.bounds.maxMessages) refuse("job-plan-mismatch");
  const identities = new Set(); const refs = new Set(); const operations = new Set();
  for (const item of plan.entries) {
    const entry = keys(item, ["messageId", "ref", "sourceDigest", "envelope", "envelopeDigest", "originalRetentionDeadline", "handler"]);
    if (!boundedString(entry.messageId, 256) || !boundedString(entry.ref, 4096) || !digestPattern.test(String(entry.sourceDigest)) ||
      entry.envelopeDigest !== fingerprint(entry.envelope) || !integer(entry.originalRetentionDeadline, now + 1, now + 86_400_000) ||
      (entry.originalRetentionDeadline as number) < plan.expiresAt || identities.has(entry.messageId) || refs.has(entry.ref)) refuse("job-plan-mismatch");
    const envelope = validateJob(entry.envelope, request.scope.environment, context.handlers);
    const handler = context.handlers.find((item) => item.type === envelope.jobType && item.version === envelope.jobVersion)!;
    if (fingerprint(entry.handler) !== fingerprint({ type: handler.type, version: handler.version, repeatSafety: handler.repeatSafety }) || operations.has(envelope.operationId)) refuse("job-handler-incompatible");
    identities.add(entry.messageId); refs.add(entry.ref); operations.add(envelope.operationId);
  }
  return value as ReplayPlan;
}
export function validateCheckpoint(value: unknown, plan: ReplayPlan): ReplayCheckpoint {
  const checkpoint = keys(value, ["version", "fingerprint", "complete", "entries"]);
  if (checkpoint.version !== 1 || checkpoint.fingerprint !== plan.fingerprint || typeof checkpoint.complete !== "boolean" ||
    !Array.isArray(checkpoint.entries) || checkpoint.entries.length !== plan.entries.length) refuse("job-checkpoint-invalid");
  let unfinished = false;
  for (let index = 0; index < checkpoint.entries.length; index += 1) {
    const entry = keys(checkpoint.entries[index], ["messageHash", "stage"]);
    if (entry.messageHash !== fingerprint(plan.entries[index]!.messageId) || !["prepared", "send-started", "send-accepted", "removal-started", "removed"].includes(String(entry.stage)) ||
      (unfinished && entry.stage !== "prepared")) refuse("job-checkpoint-invalid");
    if (entry.stage !== "removed") unfinished = true;
  }
  if (checkpoint.complete && unfinished) refuse("job-checkpoint-invalid");
  if (checkpoint.complete) refuse("job-run-complete");
  if (checkpoint.entries.some((entry) => ["send-started", "removal-started"].includes(entry.stage))) refuse("job-reconciliation-required");
  return value as ReplayCheckpoint;
}
export function observation(value: unknown): "empty" | "pending" {
  const metrics = record(value);
  if (![metrics.backlog_count, metrics.backlog_bytes, metrics.oldest_message_timestamp_ms].every((item) => integer(item, 0, Number.MAX_SAFE_INTEGER))) refuse("job-provider-invalid");
  return metrics.backlog_count === 0 && metrics.backlog_bytes === 0 && metrics.oldest_message_timestamp_ms === 0 ? "empty" : "pending";
}
