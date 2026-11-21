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
export type JobDeclaration = Readonly<{
  type: string;
  version: number;
  repeatSafety: "idempotent" | "monotonic" | "consumer-reconciled";
  validate: (payload: Readonly<Record<string, JobValue>>) => boolean;
}>;
export type JobDefinition<Requirements = never> = JobDeclaration & Readonly<{
  handle: (job: JobEnvelope, context: Readonly<{ attempt: number }>) => Effect.Effect<void, JobHandlerFailure, Requirements>;
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
export type JobAttempt =
  | Readonly<{ kind: "malformed-envelope"; code: JobFailureCode; operationId?: string }>
  | Readonly<{ kind: "declaration-rejection"; code: JobFailureCode }>
  | Readonly<{ kind: "executed"; job: JobEnvelope; decision: JobDecision }>;
const operationPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const typePattern = /^[a-z][a-z0-9-]{0,63}$/u;
const maximumEnvelopeBytes = 16_384;
const encoder = new TextEncoder();
type SnapshotBudget = { remaining: number };

export function isJobEnvironment(value: unknown): value is JobEnvironment {
  return value === "local" || value === "staging" || value === "production";
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
// Charge a lower bound on the JSON bytes before building more of the snapshot.
// The exact UTF-8 check still accounts for escaping and the envelope fields.
function reserveSnapshotBytes(budget: SnapshotBudget, minimumBytes: number): boolean {
  budget.remaining -= minimumBytes;
  return budget.remaining >= 0;
}

function snapshotJsonValue(value: unknown, depth: number, budget: SnapshotBudget): JobValue | undefined {
  if (depth > 5) return undefined;
  if (value === null || typeof value === "boolean") {
    return reserveSnapshotBytes(budget, value === false ? 5 : 4) ? value : undefined;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) && reserveSnapshotBytes(budget, 1) ? (value === 0 ? 0 : value) : undefined;
  }
  if (typeof value === "string") {
    return value.length <= 2_048 && reserveSnapshotBytes(budget, value.length + 2) ? value : undefined;
  }
  if (Array.isArray(value)) {
    const length = value.length;
    if (length > 64 || !reserveSnapshotBytes(budget, 2 + Math.max(0, length - 1))) return undefined;
    const elements: JobValue[] = [];
    for (let index = 0; index < length; index++) {
      const element = snapshotJsonValue(index in value ? value[index] : null, depth + 1, budget);
      if (element === undefined) return undefined;
      elements.push(element);
    }
    return Object.freeze(elements);
  }
  return record(value) ? snapshotJsonRecord(value, depth, budget) : undefined;
}

function snapshotJsonRecord(value: Record<string, unknown>, depth: number, budget: SnapshotBudget): Readonly<Record<string, JobValue>> | undefined {
  if (!reserveSnapshotBytes(budget, 2)) return undefined;
  const keys = Object.keys(value);
  if (keys.length > 64 || !reserveSnapshotBytes(budget, Math.max(0, keys.length - 1))) return undefined;
  const snapshot: Record<string, JobValue> = {};
  for (const key of keys) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/u.test(key) || !reserveSnapshotBytes(budget, key.length + 3)) return undefined;
    const item = snapshotJsonValue(value[key], depth + 1, budget);
    if (item === undefined) return undefined;
    snapshot[key] = item;
  }
  return Object.freeze(snapshot);
}
function validDeclarations(handlers: readonly JobDeclaration[]): boolean {
  const identities = new Set<string>();
  return handlers.length <= 32 && handlers.every((handler) => {
    if (!typePattern.test(handler.type) || !Number.isSafeInteger(handler.version) || handler.version < 1 || handler.version > 65_535 ||
      !["idempotent", "monotonic", "consumer-reconciled"].includes(handler.repeatSafety) ||
      typeof handler.validate !== "function") return false;
    const identity = `${handler.type}:${handler.version}`;
    if (identities.has(identity)) return false;
    identities.add(identity); return true;
  });
}

// Structural validity bounds retained data; it is not evidence of producer
// admission. Keep parsing independent of the current business declaration.
export function parseJobEnvelope(value: unknown, environment: JobEnvironment): JobEnvelope {
  try {
    if (!record(value) || Object.keys(value).sort().join(",") !== "environment,jobType,jobVersion,operationId,payload,version") {
      throw new JobDeliveryFailure("job-validation");
    }
    const { version, environment: target, operationId, jobType, jobVersion, payload: input } = value;
    if (version !== 1 || !isJobEnvironment(target) || typeof operationId !== "string" || !operationPattern.test(operationId) ||
      typeof jobType !== "string" || !typePattern.test(jobType) || typeof jobVersion !== "number" || !Number.isSafeInteger(jobVersion) ||
      !record(input)) throw new JobDeliveryFailure("job-validation");
    const payload = snapshotJsonRecord(input, 0, { remaining: maximumEnvelopeBytes });
    if (payload === undefined) throw new JobDeliveryFailure("job-validation");
    const job: JobEnvelope = { version, environment: target, operationId, jobType, jobVersion, payload };
    if (encoder.encode(JSON.stringify(job)).byteLength > maximumEnvelopeBytes) throw new JobDeliveryFailure("job-validation");
    if (target !== environment) throw new JobDeliveryFailure("job-environment");
    return Object.freeze(job);
  } catch (error) {
    throw error instanceof JobDeliveryFailure ? error : new JobDeliveryFailure("job-validation");
  }
}

function checkedDeclaration<Declaration extends JobDeclaration>(job: JobEnvelope, handlers: readonly Declaration[]): Declaration {
  const handler = handlers.find((candidate) => candidate.type === job.jobType && candidate.version === job.jobVersion);
  if (handler === undefined) throw new JobDeliveryFailure("job-unsupported");
  let accepted: boolean;
  try { accepted = handler.validate(job.payload); }
  catch { throw new JobDeliveryFailure("job-configuration"); }
  if (accepted !== true) throw new JobDeliveryFailure("job-validation");
  return handler;
}

export function validateJob(value: unknown, environment: JobEnvironment, handlers: readonly JobDeclaration[]): JobEnvelope {
  try {
    if (!validDeclarations(handlers)) throw new JobDeliveryFailure("job-configuration");
    const job = parseJobEnvelope(value, environment);
    checkedDeclaration(job, handlers);
    return job;
  } catch (error) {
    throw error instanceof JobDeliveryFailure ? error : new JobDeliveryFailure("job-validation");
  }
}

export async function runJobAttempt(value: unknown, environment: JobEnvironment, handlers: readonly JobDefinition[], attempt: number, signal?: AbortSignal): Promise<JobAttempt> {
  let job: JobEnvelope;
  try {
    job = parseJobEnvelope(value, environment);
  } catch (error) {
    const code = error instanceof JobDeliveryFailure ? error.code : "job-validation";
    const operationId = readOperationId(value);
    return { kind: "malformed-envelope", code, ...(operationId === undefined ? {} : { operationId }) };
  }

  let handler: JobDefinition;
  try {
    if (!validDeclarations(handlers)) throw new JobDeliveryFailure("job-configuration");
    handler = checkedDeclaration(job, handlers);
  } catch (error) {
    return { kind: "declaration-rejection", code: error instanceof JobDeliveryFailure ? error.code : "job-validation" };
  }
  return { kind: "executed", job, decision: await executeJob(job, handler, attempt, signal) };
}

async function executeJob(job: JobEnvelope, handler: JobDefinition, attempt: number, signal?: AbortSignal): Promise<JobDecision> {
  if (signal?.aborted) return { outcome: "retry", code: "job-handler-cancelled" };
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

function readOperationId(value: unknown): string | undefined {
  try {
    if (record(value)) {
      const { operationId } = value;
      if (typeof operationId === "string" && operationPattern.test(operationId)) return operationId;
    }
  } catch { /* Malformed identity is not recoverable. */ }
  return undefined;
}

export function terminalJob(environment: JobEnvironment, code: JobFailureCode, attachment?: JobEnvelope | string): TerminalJob {
  const job = typeof attachment === "string" ? undefined : attachment;
  const operationId = typeof attachment === "string" ? attachment : job?.operationId;
  return { terminalVersion: 1, environment, code, ...(operationId === undefined ? {} : { operationId }), ...(job === undefined ? {} : { job }) };
}

// Native retry exhaustion retains the original envelope; explicit terminal
// disposition retains a TerminalJob. These pure entry points perform no I/O,
// authorization, replay, drain or acknowledgement of the operator's DLQ message.
export function prepareJobRecovery(value: unknown, environment: JobEnvironment, handlers: readonly JobDeclaration[]): JobEnvelope {
  if (record(value) && value.terminalVersion === 1) {
    if (value.environment !== environment) throw new JobDeliveryFailure("job-environment");
    const job = validateJob(value.job, environment, handlers);
    if (value.operationId !== job.operationId) throw new JobDeliveryFailure("job-validation");
    return job;
  }
  return validateJob(value, environment, handlers);
}
export function inspectTerminalJob(value: unknown, environment: JobEnvironment, handlers: readonly JobDeclaration[]): Readonly<{ recoverable: boolean; operationId?: string }> {
  try {
    const job = prepareJobRecovery(value, environment, handlers);
    return { recoverable: true, operationId: job.operationId };
  } catch { return { recoverable: false }; }
}
