import worker from "../../../worker.mjs";
import { Effect } from "effect";
import { jobHandlers } from "../../../src/application/job-handlers.ts";
import { JobDispatcher, JobHandlerFailure, prepareJobRecovery } from "../../../src/application/job-delivery.ts";
import { createCloudflareJobDispatcherLayer } from "../../../src/infrastructure/cloudflare/job-delivery.ts";

// Synthetic test-only state, endpoints and handler. No fixture endpoint is
// exported by the generated production entry point.
const observations = [];
const terminals = [];
const values = new Map();
const handlers = [{ type: "synthetic", version: 1, repeatSafety: "monotonic",
  validate: (payload) => Object.keys(payload).sort().join(",") === "action,sequence" &&
    ["complete", "retry", "poison", "terminal", "timeout"].includes(payload.action) && Number.isSafeInteger(payload.sequence),
  handle: (job, { attempt }) => Effect.gen(function* () {
    yield* Effect.sync(() => { observations.push({ operationId: job.operationId, attempt }); });
    if (job.payload.action === "poison" || (job.payload.action === "retry" && attempt === 1)) yield* Effect.fail(new JobHandlerFailure("retry"));
    if (job.payload.action === "terminal") yield* Effect.fail(new JobHandlerFailure("terminal"));
    yield* Effect.sync(() => { values.set(job.operationId, Math.max(values.get(job.operationId) ?? 0, job.payload.sequence)); });
    if (job.payload.action === "timeout" && attempt === 1) yield* Effect.never;
  }),
}];
// Populate only this test Worker's application-owned registry. Production
// queue delivery below executes the actual entry and server composition.
jobHandlers.push(...handlers);
const syntheticWorker = {
  ...worker,
  async fetch(request, environment, context) {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/__synthetic-jobs/state") return Response.json({ observations, terminals, values: Object.fromEntries(values) });
    if (pathname === "/__synthetic-jobs/handlers") {
      const handlerState = await request.json();
      const registered = handlerState === "missing" ? [] : handlerState === "duplicate" ? [...handlers, ...handlers] :
        handlerState === "validator-failure" ? handlers.map((handler) => ({ ...handler, validate: () => { throw new Error("synthetic-validator-secret"); } })) : handlers;
      jobHandlers.splice(0, jobHandlers.length, ...registered);
      return new Response(null, { status: 204 });
    }
    if (pathname === "/__synthetic-jobs/enqueue") {
      const input = await request.json();
      const layer = createCloudflareJobDispatcherLayer({ configuration: Effect.succeed(input.missingBinding ? { ...environment, JOB_DEAD_LETTER_QUEUE: undefined } : environment), handlers });
      try {
        const accepted = await Effect.runPromise(Effect.flatMap(JobDispatcher, (dispatcher) => dispatcher.dispatch(input.job)).pipe(Effect.provide(layer)));
        return Response.json(accepted, { status: 202 });
      } catch { return Response.json({ code: "synthetic-refused" }, { status: 422 }); }
    }
    if (pathname === "/__synthetic-jobs/raw") {
      await environment.JOB_QUEUE.send(await request.json());
      return new Response(null, { status: 202 });
    }
    if (pathname === "/__synthetic-jobs/recovery") {
      try { return Response.json(prepareJobRecovery(terminals[0], environment.JOB_ENVIRONMENT, jobHandlers)); }
      catch { return Response.json({ recoverable: false }, { status: 422 }); }
    }
    return worker.fetch(request, environment, context);
  },
  async queue(batch, environment) {
    if (batch.queue === environment.JOB_DEAD_LETTER_QUEUE_NAME) {
      // Local observation consumer only; production leaves its DLQ unconsumed.
      for (const message of batch.messages) { terminals.push(message.body); message.ack(); }
      return;
    }
    if (batch.messages.some((message) => message.body?.syntheticBatchFailure === true)) {
      // Deliberately bypass normal per-message failure handling to retain the
      // pinned emulator's negative ack-before-batch-throw characterization.
      for (const message of batch.messages) {
        if (message.body?.syntheticBatchFailure === true) {
          if (message.attempts === 1) throw new Error("SYNTHETIC_BATCH_FAILURE");
          message.ack();
        } else await worker.queue({ queue: batch.queue, messages: [message] }, environment);
      }
      return;
    }
    await worker.queue(batch, environment);
  },
};

export default syntheticWorker;
