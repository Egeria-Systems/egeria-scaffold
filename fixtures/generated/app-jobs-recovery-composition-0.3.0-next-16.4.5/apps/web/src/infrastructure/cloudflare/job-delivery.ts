import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Effect, Layer } from "effect";
import { parseApplicationEnvironment, validateRuntimeApplicationEnvironment, type ApplicationEnvironment, type ApplicationEnvironmentResult } from "@/src/configuration/application-environment";
import { executeJob, isJobEnvironment, JobDeliveryFailure, JobDispatcher, parseJobEnvelope, terminalJob, validateJob,
  type JobDeclaration, type JobDefinition, type JobEnvironment, type JobEnvelope, type JobFailureCode } from "@/src/application/job-delivery";

export const cloudflareJobConfiguration = Effect.tryPromise({
  try: async () => (await getCloudflareContext({ async: true })).env,
  catch: () => new JobDeliveryFailure("job-configuration"),
});

// Narrow structural access remains adapter-owned; no platform type crosses the
// application port. Native Queue.send cannot cancel already accepted messages.
type QueueBinding = Readonly<{ send: (body: unknown, options?: Readonly<{ contentType: "json" }>) => Promise<unknown> }>;
type Configuration = Readonly<{ environment: JobEnvironment; queueName: string; queue: QueueBinding; deadLetters: QueueBinding }>;
type QueueMessage = Readonly<{ body: unknown; attempts: number; ack: () => void; retry: (options: Readonly<{ delaySeconds: number }>) => void }>;
export type JobMessageBatch = Readonly<{ queue: string; messages: readonly QueueMessage[] }>;
function queueBinding(value: unknown): value is QueueBinding {
  return typeof value === "object" && value !== null && "send" in value && typeof value.send === "function";
}
function configuration(value: unknown, compiledTarget: ApplicationEnvironment): Configuration {
  try {
    if (typeof value !== "object" || value === null) throw new Error();
    if (!parseApplicationEnvironment(compiledTarget).ok ||
      !validateRuntimeApplicationEnvironment(Reflect.get(value, "APPLICATION_ENVIRONMENT"), compiledTarget).ok) throw new Error();
    const environment: unknown = Reflect.get(value, "JOB_ENVIRONMENT");
    if (environment !== (compiledTarget === "development" ? "local" : compiledTarget)) throw new Error();
    const queueName: unknown = Reflect.get(value, "JOB_QUEUE_NAME");
    const deadName: unknown = Reflect.get(value, "JOB_DEAD_LETTER_QUEUE_NAME");
    const queue: unknown = Reflect.get(value, "JOB_QUEUE");
    const deadLetters: unknown = Reflect.get(value, "JOB_DEAD_LETTER_QUEUE");
    if (!isJobEnvironment(environment) || typeof queueName !== "string" || typeof deadName !== "string" ||
      !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(queueName) || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(deadName) ||
      queueName === deadName || !queueBinding(queue) || !queueBinding(deadLetters) || queue === deadLetters) throw new Error();
    return { environment, queueName, queue, deadLetters };
  } catch { throw new JobDeliveryFailure("job-configuration"); }
}
function report(outcome: "accepted" | "completed" | "retry" | "terminal" | "unknown", code?: JobFailureCode): void {
  try { console.info(JSON.stringify({ event: "job-delivery", outcome, ...(code === undefined ? {} : { code }) })); }
  catch { /* Diagnostics never change delivery disposition. */ }
}
async function send(queue: QueueBinding, body: unknown, signal: AbortSignal): Promise<void> {
  await Promise.resolve();
  if (signal.aborted) throw new JobDeliveryFailure("job-acceptance-unknown");
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(10_000)]);
  let rejectAbort: () => void = () => {};
  const interrupted = new Promise<never>((_resolve, reject) => {
    rejectAbort = () => reject(new JobDeliveryFailure("job-acceptance-unknown"));
  });
  deadline.addEventListener("abort", rejectAbort, { once: true });
  try {
    if (deadline.aborted) throw new JobDeliveryFailure("job-acceptance-unknown");
    await Promise.race([queue.send(body, { contentType: "json" }), interrupted]);
    if (deadline.aborted) throw new JobDeliveryFailure("job-acceptance-unknown");
  } catch { throw new JobDeliveryFailure("job-acceptance-unknown"); }
  finally { deadline.removeEventListener("abort", rejectAbort); }
}

export function createCloudflareJobDispatcherLayer(dependencies: Readonly<{
  compiledTarget: () => ApplicationEnvironmentResult;
  configuration: Effect.Effect<unknown, JobDeliveryFailure>; handlers: readonly JobDeclaration[];
}>): Layer.Layer<JobDispatcher> {
  return Layer.succeed(JobDispatcher, {
    dispatch: (input: JobEnvelope) => Effect.gen(function* () {
      const compiled = yield* Effect.try({ try: () => {
        const result = dependencies.compiledTarget();
        if (!result.ok) throw new JobDeliveryFailure("job-configuration");
        return result.value;
      }, catch: () => new JobDeliveryFailure("job-configuration") });
      const raw = yield* dependencies.configuration;
      const settings = yield* Effect.try({ try: () => configuration(raw, compiled), catch: () => new JobDeliveryFailure("job-configuration") });
      const job = yield* Effect.try({ try: () => validateJob(input, settings.environment, dependencies.handlers),
        catch: (error) => error instanceof JobDeliveryFailure ? error : new JobDeliveryFailure("job-validation") });
      yield* Effect.tryPromise({ try: (signal) => send(settings.queue, job, signal), catch: () => new JobDeliveryFailure("job-acceptance-unknown") });
      report("accepted");
      return { status: "accepted" as const, operationId: job.operationId };
    }),
  });
}

export function validateCloudflareJobBatch(batch: JobMessageBatch, environment: unknown, compiledTarget: ApplicationEnvironment): Configuration {
  const settings = configuration(environment, compiledTarget);
  if (batch.queue !== settings.queueName || batch.messages.length > 10) throw new JobDeliveryFailure("job-configuration");
  // Refuse cross-target batches before any message handler, queue write or ack.
  // Missing or unrecognized targets are handled by per-message validation.
  for (const message of batch.messages) {
    const body = message.body;
    if (typeof body === "object" && body !== null && "environment" in body &&
      isJobEnvironment(body.environment) && body.environment !== settings.environment) {
      throw new JobDeliveryFailure("job-configuration");
    }
  }
  return settings;
}

export async function consumeCloudflareJobs(batch: JobMessageBatch, environment: unknown, compiledTarget: ApplicationEnvironment, handlers: readonly JobDefinition[], signal?: AbortSignal): Promise<void> {
  const settings = validateCloudflareJobBatch(batch, environment, compiledTarget);
  for (const message of batch.messages) {
    if (!Number.isSafeInteger(message.attempts) || message.attempts < 1) throw new JobDeliveryFailure("job-configuration");
    const delaySeconds = Math.min(300, 5 * 2 ** Math.min(6, message.attempts - 1));
    try {
      let job: JobEnvelope;
      try { job = parseJobEnvelope(message.body, settings.environment); }
      catch (error) {
        const code = error instanceof JobDeliveryFailure ? error.code : "job-validation";
        await send(settings.deadLetters, terminalJob(message.body, settings.environment, code), signal ?? new AbortController().signal);
        message.ack(); report("terminal", code); continue;
      }
      try { job = validateJob(job, settings.environment, handlers); }
      catch (error) {
        const code = error instanceof JobDeliveryFailure ? error.code : "job-configuration";
        // Current business rejection cannot distinguish a changed consumer from
        // invalid injected work. Native exhaustion retains the original body.
        message.retry({ delaySeconds }); report("retry", code); continue;
      }
      const decision = await executeJob(job, handlers, message.attempts, signal);
      if (decision.outcome === "completed") { message.ack(); report("completed"); }
      else if (decision.outcome === "terminal") {
        await send(settings.deadLetters, terminalJob(job, settings.environment, decision.code), signal ?? new AbortController().signal);
        message.ack(); report("terminal", decision.code);
      } else {
        // Native max_retries owns exhaustion and transfers the original envelope
        // to the configured DLQ. Do not re-enqueue and reset native attempt state.
        message.retry({ delaySeconds }); report("retry", decision.code);
      }
    } catch {
      message.retry({ delaySeconds }); report("unknown", "job-execution-unknown");
    }
  }
}
