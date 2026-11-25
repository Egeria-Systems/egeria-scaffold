import { Effect, Layer } from "effect";
import { JobDeliveryFailure, JobDispatcher, runJobAttempt, terminalJob, validateJob,
  type JobDecision, type JobDefinition, type JobEnvironment, type JobEnvelope, type TerminalJob } from "@/src/application/job-delivery";

// Explicit local/test adapter. Not a production fallback, durable queue or
// exactly-once store. Capacity includes retained failures; restart loses data.
export function createMemoryJobDelivery(environment: JobEnvironment, handlers: readonly JobDefinition[]) {
  const pending: { job: JobEnvelope; attempts: number }[] = [];
  const failed: TerminalJob[] = [];
  let consuming = false;
  const layer = Layer.succeed(JobDispatcher, {
    dispatch: (input: JobEnvelope) => Effect.andThen(Effect.yieldNow, Effect.try({
      try: () => {
        const job = validateJob(input, environment, handlers);
        if (pending.length + failed.length >= 100) throw new JobDeliveryFailure("job-capacity");
        pending.push({ job, attempts: 0 });
        return { status: "accepted" as const, operationId: job.operationId };
      }, catch: (error) => error instanceof JobDeliveryFailure ? error : new JobDeliveryFailure("job-validation"),
    })),
  });
  return {
    layer,
    terminals: (): readonly TerminalJob[] => structuredClone(failed),
    consumeNext: async (signal?: AbortSignal): Promise<JobDecision | undefined> => {
      if (consuming) throw new JobDeliveryFailure("job-capacity");
      const item = pending[0];
      if (!item) return undefined;
      consuming = true;
      try {
        item.attempts++;
        let decision: JobDecision;
        let retainedEnvelope = item.job;
        try {
          const attempt = await runJobAttempt(item.job, environment, handlers, item.attempts, signal);
          if (attempt.kind === "executed") {
            retainedEnvelope = attempt.job;
            decision = attempt.decision;
          } else {
            decision = { outcome: "retry", code: attempt.code };
          }
        } catch (error) {
          decision = { outcome: "retry", code: error instanceof JobDeliveryFailure ? error.code : "job-execution-unknown" };
        }
        if (decision.outcome === "retry" && item.attempts >= 4) decision = { outcome: "terminal", code: "job-retries-exhausted" };
        if (decision.outcome !== "retry") pending.shift();
        if (decision.outcome === "terminal") failed.push(terminalJob(environment, decision.code, retainedEnvelope));
        return decision;
      } finally { consuming = false; }
    },
  };
}
