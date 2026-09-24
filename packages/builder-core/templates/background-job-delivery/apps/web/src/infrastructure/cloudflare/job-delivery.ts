import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Effect, Layer } from "effect";
import { executeJob, isJobEnvironment, JobDeliveryFailure, JobDispatcher, terminalJob, validateJob,
  type JobDefinition, type JobEnvironment, type JobEnvelope, type JobFailureCode } from "@/src/application/job-delivery";

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
function configuration(value: unknown): Configuration {
  try {
    if (typeof value !== "object" || value === null) throw new Error();
    const environment: unknown = Reflect.get(value, "JOB_ENVIRONMENT");
    const queueName: unknown = Reflect.get(value, "JOB_QUEUE_NAME");
    const deadName: unknown = Reflect.get(value, "JOB_DEAD_LETTER_QUEUE_NAME");
    const queue: unknown = Reflect.get(value, "JOB_QUEUE");
    const deadLetters: unknown = Reflect.get(value, "JOB_DEAD_LETTER_QUEUE");
    if (!isJobEnvironment(environment) || typeof queueName !== "string" || typeof deadName !== "string" ||
      !/^[a-z0-9][a-z0-9-]{0,99}$/u.test(queueName) || !/^[a-z0-9][a-z0-9-]{0,99}$/u.test(deadName) ||
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
  configuration: Effect.Effect<unknown, JobDeliveryFailure>; handlers: readonly JobDefinition[];
}>): Layer.Layer<JobDispatcher> {
  return Layer.succeed(JobDispatcher, {
    dispatch: (input: JobEnvelope) => Effect.gen(function* () {
      const raw = yield* dependencies.configuration;
      const settings = yield* Effect.try({ try: () => configuration(raw), catch: () => new JobDeliveryFailure("job-configuration") });
      const job = yield* Effect.try({ try: () => validateJob(input, settings.environment, dependencies.handlers),
        catch: (error) => error instanceof JobDeliveryFailure ? error : new JobDeliveryFailure("job-validation") });
      yield* Effect.tryPromise({ try: (signal) => send(settings.queue, job, signal), catch: () => new JobDeliveryFailure("job-acceptance-unknown") });
      report("accepted");
      return { status: "accepted" as const, operationId: job.operationId };
    }),
  });
}

export async function consumeCloudflareJobs(batch: JobMessageBatch, environment: unknown, handlers: readonly JobDefinition[], signal?: AbortSignal): Promise<void> {
  const settings = configuration(environment);
  if (batch.queue !== settings.queueName || batch.messages.length > 10) throw new JobDeliveryFailure("job-configuration");
  for (const message of batch.messages) {
    if (!Number.isSafeInteger(message.attempts) || message.attempts < 1) throw new JobDeliveryFailure("job-configuration");
    const delaySeconds = Math.min(300, 5 * 2 ** Math.min(6, message.attempts - 1));
    try {
      let job: JobEnvelope;
      try { job = validateJob(message.body, settings.environment, handlers); }
      catch (error) {
        const code = error instanceof JobDeliveryFailure ? error.code : "job-validation";
        if (code === "job-configuration" || code === "job-unsupported") {
          // A consumer deployment can temporarily remove a supported version or
          // break registration. Native exhaustion must retain accepted work.
          message.retry({ delaySeconds }); report("retry", code); continue;
        }
        await send(settings.deadLetters, terminalJob(message.body, settings.environment, handlers, code), signal ?? new AbortController().signal);
        message.ack(); report("terminal", code); continue;
      }
      const decision = await executeJob(job, handlers, message.attempts, signal);
      if (decision.outcome === "completed") { message.ack(); report("completed"); }
      else if (decision.outcome === "terminal") {
        await send(settings.deadLetters, terminalJob(job, settings.environment, handlers, decision.code), signal ?? new AbortController().signal);
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
