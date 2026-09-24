import { Cause, Context, Data, Effect, Exit } from "effect";

export type JobEnvironment = "local" | "staging" | "production";
export type JobValue = null | boolean | number | string | readonly JobValue[] | { readonly [key: string]: JobValue };
export type JobEnvelope = Readonly<{
  version: 1;
  environment: JobEnvironment;
  operationId: string;
  jobType: string;
  jobVersion: number;
  payload: Readonly<Record<string, JobValue>>;
}>;
export type JobAcceptance = Readonly<{ status: "accepted"; operationId: string }>;
export type JobFailureCode = "job-validation" | "job-unsupported" | "job-environment" | "job-configuration" |
  "job-acceptance-unknown" | "job-capacity" | "job-handler-retry" | "job-handler-terminal" |
  "job-handler-cancelled" | "job-execution-unknown" | "job-retries-exhausted";

export class JobDeliveryFailure extends Data.TaggedError("JobDeliveryFailure")<{ readonly code: JobFailureCode }> {
  constructor(code: JobFailureCode) { super({ code }); Object.freeze(this); }
}
export class JobHandlerFailure extends Data.TaggedError("JobHandlerFailure")<{ readonly disposition: "retry" | "terminal" | "cancelled" }> {
  constructor(disposition: "retry" | "terminal" | "cancelled") { super({ disposition }); Object.freeze(this); }
}
export class JobDispatcher extends Context.Service<JobDispatcher, {
  readonly dispatch: (job: JobEnvelope) => Effect.Effect<JobAcceptance, JobDeliveryFailure>;
}>()("@egeria-systems/generated-app/JobDispatcher") {}

// Each consumer must validate an explicit payload allowlist and make its effects
// safe under repeats, older versions and out-of-order delivery. This declaration
// is an obligation, not a deduplication implementation or proof of safety.
export type JobDefinition = Readonly<{
  type: string;
  version: number;
  repeatSafety: "idempotent" | "monotonic" | "consumer-reconciled";
  validate: (payload: Readonly<Record<string, JobValue>>) => boolean;
  handle: (job: JobEnvelope, context: Readonly<{ attempt: number }>) => Effect.Effect<void, JobHandlerFailure>;
}>;
export type JobDecision = Readonly<{ outcome: "completed" }> |
  Readonly<{ outcome: "retry" | "terminal"; code: JobFailureCode }>;
export type TerminalJob = Readonly<{
  terminalVersion: 1;
  environment: JobEnvironment;
  code: JobFailureCode;
  operationId?: string;
  job?: JobEnvelope;
}>;
const operationPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const typePattern = /^[a-z][a-z0-9-]{0,63}$/u;
const encoder = new TextEncoder();

export function isJobEnvironment(value: unknown): value is JobEnvironment {
  return value === "local" || value === "staging" || value === "production";
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function jsonValue(value: unknown, depth: number): value is JobValue {
  if (depth > 5) return false;
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.length <= 2_048;
  if (Array.isArray(value)) return value.length <= 64 && value.every((item) => jsonValue(item, depth + 1));
  return record(value) && Object.keys(value).length <= 64 && Object.entries(value).every(([key, item]) =>
    /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/u.test(key) && jsonValue(item, depth + 1));
}
function validDefinitions(handlers: readonly JobDefinition[]): boolean {
  const identities = new Set<string>();
  return handlers.length <= 32 && handlers.every((handler) => {
    if (!typePattern.test(handler.type) || !Number.isSafeInteger(handler.version) || handler.version < 1 || handler.version > 65_535 ||
      !["idempotent", "monotonic", "consumer-reconciled"].includes(handler.repeatSafety) ||
      typeof handler.validate !== "function" || typeof handler.handle !== "function") return false;
    const identity = `${handler.type}:${handler.version}`;
    if (identities.has(identity)) return false;
    identities.add(identity); return true;
  });
}

export function validateJob(value: unknown, environment: JobEnvironment, handlers: readonly JobDefinition[]): JobEnvelope {
  try {
    if (!validDefinitions(handlers)) throw new JobDeliveryFailure("job-configuration");
    if (!record(value) || Object.keys(value).sort().join(",") !== "environment,jobType,jobVersion,operationId,payload,version" ||
      value.version !== 1 || !isJobEnvironment(value.environment) || typeof value.operationId !== "string" || !operationPattern.test(value.operationId) ||
      typeof value.jobType !== "string" || !typePattern.test(value.jobType) || !Number.isSafeInteger(value.jobVersion) ||
      !record(value.payload) || !jsonValue(value.payload, 0) || encoder.encode(JSON.stringify(value)).byteLength > 16_384) {
      throw new JobDeliveryFailure("job-validation");
    }
    if (value.environment !== environment) throw new JobDeliveryFailure("job-environment");
    const handler = handlers.find((candidate) => candidate.type === value.jobType && candidate.version === value.jobVersion);
    if (handler === undefined) throw new JobDeliveryFailure("job-unsupported");
    const job: JobEnvelope = JSON.parse(JSON.stringify(value));
    if (!handler.validate(job.payload)) throw new JobDeliveryFailure("job-validation");
    return job;
  } catch (error) {
    throw error instanceof JobDeliveryFailure ? error : new JobDeliveryFailure("job-validation");
  }
}

export async function executeJob(job: JobEnvelope, handlers: readonly JobDefinition[], attempt: number, signal?: AbortSignal): Promise<JobDecision> {
  if (signal?.aborted) return { outcome: "retry", code: "job-handler-cancelled" };
  const handler = handlers.find((candidate) => candidate.type === job.jobType && candidate.version === job.jobVersion);
  if (!handler) return { outcome: "terminal", code: "job-unsupported" };
  // A deadline or interruption cannot undo an already started side effect.
  const timeout = AbortSignal.timeout(10_000);
  const exit = await Effect.runPromiseExit(Effect.suspend(() => handler.handle(job, { attempt })), {
    signal: signal === undefined ? timeout : AbortSignal.any([signal, timeout]),
  });
  if (Exit.isSuccess(exit)) return { outcome: "completed" };
  if (exit.cause.reasons.some(Cause.isDieReason) || exit.cause.reasons.some(Cause.isInterruptReason)) {
    return { outcome: "retry", code: "job-execution-unknown" };
  }
  const failures = exit.cause.reasons.filter(Cause.isFailReason);
  if (failures.length !== 1 || !(failures[0]?.error instanceof JobHandlerFailure)) {
    return { outcome: "retry", code: "job-execution-unknown" };
  }
  const disposition = failures[0].error.disposition;
  return { outcome: disposition === "retry" ? "retry" : "terminal", code: `job-handler-${disposition}` };
}

export function terminalJob(value: unknown, environment: JobEnvironment, handlers: readonly JobDefinition[], code: JobFailureCode): TerminalJob {
  let job: JobEnvelope | undefined;
  try { job = validateJob(value, environment, handlers); } catch { /* Invalid bodies are not copied into diagnostic terminal records. */ }
  let operationId: string | undefined;
  try {
    if (record(value) && typeof value.operationId === "string" && operationPattern.test(value.operationId)) operationId = value.operationId;
  } catch { /* Malformed identity is not recoverable. */ }
  return { terminalVersion: 1, environment, code, ...(operationId === undefined ? {} : { operationId }), ...(job === undefined ? {} : { job }) };
}

// Native retry exhaustion retains the original envelope; explicit terminal
// disposition retains a TerminalJob. These pure entry points perform no I/O,
// authorization, replay, drain or acknowledgement of the operator's DLQ message.
export function prepareJobRecovery(value: unknown, environment: JobEnvironment, handlers: readonly JobDefinition[]): JobEnvelope {
  if (record(value) && value.terminalVersion === 1) {
    if (value.environment !== environment) throw new JobDeliveryFailure("job-environment");
    const job = validateJob(value.job, environment, handlers);
    if (value.operationId !== job.operationId) throw new JobDeliveryFailure("job-validation");
    return job;
  }
  return validateJob(value, environment, handlers);
}
export function inspectTerminalJob(value: unknown, environment: JobEnvironment, handlers: readonly JobDefinition[]): Readonly<{ recoverable: boolean; operationId?: string }> {
  try {
    const job = prepareJobRecovery(value, environment, handlers);
    return { recoverable: true, operationId: job.operationId };
  } catch { return { recoverable: false }; }
}
