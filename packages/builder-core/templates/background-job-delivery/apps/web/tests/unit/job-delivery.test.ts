import { Effect } from "effect";
import { expect, it, vi } from "vitest";
import { JobDispatcher, JobHandlerFailure, inspectTerminalJob, prepareJobRecovery, validateJob, type JobDefinition, type JobEnvelope } from "@/src/application/job-delivery";
import { serverJobDispatcherLayer, consumeServerJobs } from "@/src/composition/server-jobs";
import { createMemoryJobDelivery } from "@/src/infrastructure/memory/job-delivery";
import { createCloudflareJobDispatcherLayer, consumeCloudflareJobs } from "@/src/infrastructure/cloudflare/job-delivery";

const compositionContext = vi.hoisted(() => ({ environment: {} as unknown, handlers: [] as JobDefinition[] }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: compositionContext.environment }) }));
vi.mock("@/src/application/job-handlers", () => ({ jobHandlers: compositionContext.handlers }));

const operationId = "00000000-0000-4000-8000-000000000001";
const envelope = (extra = {}): JobEnvelope => ({ version: 1, environment: "local", operationId, jobType: "synthetic", jobVersion: 1, payload: { sequence: 1 }, ...extra });
const definition = (handle: JobDefinition["handle"]): JobDefinition => ({
  type: "synthetic", version: 1, repeatSafety: "monotonic", validate: (payload) =>
    Object.keys(payload).length === 1 && typeof payload.sequence === "number" && Number.isSafeInteger(payload.sequence), handle,
});
const dispatch = (job: JobEnvelope) => Effect.flatMap(JobDispatcher, (dispatcher) => dispatcher.dispatch(job));

it("memory dispatch reports acceptance before execution and repeat-safe handlers converge out of order", async () => {
  let sequence = 0;
  const memory = createMemoryJobDelivery("local", [definition((job) => Effect.sync(() => {
    sequence = Math.max(sequence, Number(job.payload.sequence));
  }))]);
  for (const next of [2, 1, 2]) {
    expect(await Effect.runPromise(dispatch(envelope({ payload: { sequence: next } })).pipe(Effect.provide(memory.layer))))
      .toEqual({ status: "accepted", operationId });
  }
  expect(sequence).toBe(0);
  for (let attempt = 0; attempt < 3; attempt++) expect(await memory.consumeNext()).toEqual({ outcome: "completed" });
  expect(sequence).toBe(2);
  expect(await memory.consumeNext()).toBeUndefined();
});

it("refuses malformed, oversized, non-JSON, unknown and incompatible jobs before admission", async () => {
  const memory = createMemoryJobDelivery("local", [definition(() => Effect.void)]);
  const invalid = [
    { version: 2 }, { jobVersion: 2 }, { jobType: "unknown" }, { environment: "production" },
    { operationId: "private@example.test" }, { payload: { sequence: 1, secret: "synthetic-private" } },
    { payload: { sequence: "x".repeat(20_000) } }, { payload: { sequence: Infinity } },
  ];
  for (const extra of invalid) {
    await expect(Effect.runPromise(dispatch(envelope(extra)).pipe(Effect.provide(memory.layer)))).rejects.toThrow();
  }
  expect(await memory.consumeNext()).toBeUndefined();
});

it("memory exhaustion retains inspectable original identity and recovery refuses another environment", async () => {
  const handlers = [definition(() => Effect.fail(new JobHandlerFailure("retry")))];
  const memory = createMemoryJobDelivery("local", handlers);
  await Effect.runPromise(dispatch(envelope()).pipe(Effect.provide(memory.layer)));
  for (let attempt = 0; attempt < 3; attempt++) expect(await memory.consumeNext()).toEqual({ outcome: "retry", code: "job-handler-retry" });
  expect(await memory.consumeNext()).toEqual({ outcome: "terminal", code: "job-retries-exhausted" });
  expect(await memory.consumeNext()).toBeUndefined();
  expect(memory.terminals()).toHaveLength(1);
  const terminal = memory.terminals()[0];
  expect(inspectTerminalJob(terminal, "local", handlers)).toMatchObject({ operationId, recoverable: true });
  expect(prepareJobRecovery(terminal, "local", handlers)).toEqual(envelope());
  expect(() => prepareJobRecovery(terminal, "staging", handlers)).toThrow();
});

function nativeEnvironment() {
  const accepted: unknown[] = [];
  const terminals: unknown[] = [];
  const environment = {
    JOB_ENVIRONMENT: "local", JOB_QUEUE_NAME: "jobs-local", JOB_DEAD_LETTER_QUEUE_NAME: "jobs-local-dead",
    JOB_QUEUE: { send: async (body: unknown) => { accepted.push(body); } },
    JOB_DEAD_LETTER_QUEUE: { send: async (body: unknown) => { terminals.push(body); } },
  };
  return { accepted, terminals, environment };
}

it("Cloudflare admission is lazy, validates bindings and never claims completion", async () => {
  const { accepted, environment } = nativeEnvironment();
  const handlers = [definition(() => Effect.die("handler must not run during dispatch"))];
  const layer = createCloudflareJobDispatcherLayer({ configuration: Effect.succeed(environment), handlers });
  const task = dispatch(envelope()).pipe(Effect.provide(layer));
  expect(accepted).toEqual([]);
  expect(await Effect.runPromise(task)).toEqual({ status: "accepted", operationId });
  expect(accepted).toEqual([envelope()]);
  const missing = createCloudflareJobDispatcherLayer({ configuration: Effect.succeed({ ...environment, JOB_DEAD_LETTER_QUEUE: undefined }), handlers });
  await expect(Effect.runPromise(dispatch(envelope()).pipe(Effect.provide(missing)))).rejects.toMatchObject({ code: "job-configuration" });
  expect(accepted).toHaveLength(1);
});

it("pre-aborted dispatch sends nothing, and a rejected send has unknown acceptance", async () => {
  const { accepted, environment } = nativeEnvironment();
  const handlers = [definition(() => Effect.void)];
  const layer = createCloudflareJobDispatcherLayer({ configuration: Effect.succeed(environment), handlers });
  await expect(Effect.runPromise(dispatch(envelope()).pipe(Effect.provide(layer)), { signal: AbortSignal.abort() })).rejects.toThrow();
  expect(accepted).toEqual([]);
  const uncertain = createCloudflareJobDispatcherLayer({ configuration: Effect.succeed({ ...environment,
    JOB_QUEUE: { send: async () => { accepted.push(envelope()); throw new Error("synthetic-secret"); } },
  }), handlers });
  await expect(Effect.runPromise(dispatch(envelope()).pipe(Effect.provide(uncertain)))).rejects.toMatchObject({ code: "job-acceptance-unknown" });
  expect(accepted).toHaveLength(1);
});

function message(body: unknown, attempts = 1) {
  return { id: "synthetic-transport", body, attempts, timestamp: new Date(0), ack: vi.fn(), retry: vi.fn() };
}

it("Queue delivery acknowledges success, retries failed work and quarantines poison without logging its body", async () => {
  const { environment, terminals } = nativeEnvironment();
  const success = message(envelope());
  const failure = message(envelope({ payload: { sequence: 2 } }));
  const poison = message({ secret: "synthetic-sensitive-body" });
  const logs = vi.spyOn(console, "info").mockImplementation(() => {});
  try {
    await consumeCloudflareJobs({ queue: "jobs-local", messages: [success, failure, poison] }, environment,
      [definition((job) => job.payload.sequence === 1 ? Effect.void : Effect.fail(new JobHandlerFailure("retry")))]);
    expect(success.ack).toHaveBeenCalledOnce();
    expect(failure.retry).toHaveBeenCalledWith({ delaySeconds: 5 });
    expect(poison.ack).toHaveBeenCalledOnce();
    expect(terminals).toHaveLength(1);
    expect(JSON.stringify(terminals)).not.toContain("synthetic-sensitive-body");
    expect(JSON.stringify(logs.mock.calls)).not.toContain("synthetic-sensitive-body");
  } finally { logs.mockRestore(); }
});

it("terminal send failure requests native retry without acknowledgement", async () => {
  const { environment } = nativeEnvironment();
  const poison = message({ bad: true });
  await consumeCloudflareJobs({ queue: "jobs-local", messages: [poison] }, { ...environment,
    JOB_DEAD_LETTER_QUEUE: { send: async () => { throw new Error("synthetic-private"); } },
  }, []);
  expect(poison.ack).not.toHaveBeenCalled();
  expect(poison.retry).toHaveBeenCalledOnce();
});

it("cancellation after a side effect never acknowledges completed work", async () => {
  const { environment } = nativeEnvironment();
  const delivery = message(envelope());
  const controller = new AbortController();
  let effects = 0;
  const handler = definition(() => Effect.gen(function* () {
    yield* Effect.sync(() => { effects++; controller.abort(); });
    yield* Effect.never;
  }));
  await consumeCloudflareJobs({ queue: "jobs-local", messages: [delivery] }, environment, [handler], controller.signal);
  expect(effects).toBe(1);
  expect(delivery.ack).not.toHaveBeenCalled();
  expect(delivery.retry).toHaveBeenCalledOnce();
});


it("pre-aborted memory admission and consumption start no side effects", async () => {
  let effects = 0;
  const memory = createMemoryJobDelivery("local", [definition(() => Effect.sync(() => { effects++; }))]);
  await expect(Effect.runPromise(dispatch(envelope()).pipe(Effect.provide(memory.layer)), { signal: AbortSignal.abort() })).rejects.toThrow();
  expect(await memory.consumeNext()).toBeUndefined();
  await Effect.runPromise(dispatch(envelope()).pipe(Effect.provide(memory.layer)));
  expect((await memory.consumeNext(AbortSignal.abort()))?.outcome).toBe("retry");
  expect(effects).toBe(0);
});

it("enforces aggregate UTF-8 bytes and retained memory capacity independently of the handler allowlist", async () => {
  const handlers = [{ ...definition(() => Effect.void), validate: () => true }];
  const payload = Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`field${index}`, "é".repeat(2_000)]));
  expect(() => validateJob(envelope({ payload }), "local", handlers)).toThrow();
  const memory = createMemoryJobDelivery("local", handlers);
  for (let index = 0; index < 100; index++) await Effect.runPromise(dispatch(envelope()).pipe(Effect.provide(memory.layer)));
  await expect(Effect.runPromise(dispatch(envelope()).pipe(Effect.provide(memory.layer)))).rejects.toMatchObject({ code: "job-capacity" });
});


it("native retries preserve accepted work while handler support or registration is repaired", async () => {
  const restored = [definition(() => Effect.void)];
  for (const handlers of [[], [restored[0]!, restored[0]!], [{ ...restored[0]!, validate: () => { throw new Error("synthetic-validator-secret"); } }]]) {
    const { environment, terminals, accepted } = nativeEnvironment();
    const layer = createCloudflareJobDispatcherLayer({ configuration: Effect.succeed(environment), handlers: restored });
    await Effect.runPromise(dispatch(envelope()).pipe(Effect.provide(layer)));
    const delivery = message(accepted[0]);
    await consumeCloudflareJobs({ queue: "jobs-local", messages: [delivery] }, environment, handlers);
    expect(delivery.ack).not.toHaveBeenCalled();
    expect(delivery.retry).toHaveBeenCalledWith({ delaySeconds: 5 });
    expect(terminals).toEqual([]);
    expect(prepareJobRecovery(delivery.body, "local", restored)).toEqual(envelope());
    const retry = message(delivery.body, 2);
    await consumeCloudflareJobs({ queue: "jobs-local", messages: [retry] }, environment, restored);
    expect(retry.ack).toHaveBeenCalledOnce();
    expect(retry.retry).not.toHaveBeenCalled();
  }
});


it("server composition dispatches through its context and consumes through its application registry", async () => {
  const { environment, accepted } = nativeEnvironment();
  let effects = 0;
  compositionContext.environment = environment;
  compositionContext.handlers.push(definition(() => Effect.sync(() => { effects++; })));
  try {
    expect(await Effect.runPromise(dispatch(envelope()).pipe(Effect.provide(serverJobDispatcherLayer))))
      .toEqual({ status: "accepted", operationId });
    expect(accepted).toEqual([envelope()]);
    expect(effects).toBe(0);
    const delivery = message(accepted[0]);
    await consumeServerJobs({ queue: "jobs-local", messages: [delivery] }, environment);
    expect(delivery.ack).toHaveBeenCalledOnce();
    expect(effects).toBe(1);
    compositionContext.environment = { ...environment, JOB_DEAD_LETTER_QUEUE: undefined };
    await expect(Effect.runPromise(dispatch(envelope()).pipe(Effect.provide(serverJobDispatcherLayer))))
      .rejects.toMatchObject({ code: "job-configuration" });
    expect(accepted).toHaveLength(1);
  } finally { compositionContext.handlers.length = 0; compositionContext.environment = {}; }
});


it("requires an affirmative validator result and preserves thrown validation failures as configuration errors", () => {
  for (const result of [false, undefined, "truthy-invalid"]) {
    const handlers = [{ ...definition(() => Effect.void), validate: (() => result) as JobDefinition["validate"] }];
    expect(() => validateJob(envelope(), "local", handlers)).toThrow(expect.objectContaining({ code: "job-validation" }));
  }
  const handlers = [{ ...definition(() => Effect.void), validate: () => { throw new Error("synthetic-validator-secret"); } }];
  expect(() => validateJob(envelope(), "local", handlers)).toThrow(expect.objectContaining({ code: "job-configuration" }));
});

it("Cloudflare admission rejects invalid queue identities before sending", async () => {
  for (const key of ["JOB_QUEUE_NAME", "JOB_DEAD_LETTER_QUEUE_NAME"]) {
    for (const identity of ["a", "a".repeat(63), "a".repeat(64), "jobs-", "-jobs"]) {
      const { environment, accepted } = nativeEnvironment();
      const layer = createCloudflareJobDispatcherLayer({ configuration: Effect.succeed({ ...environment, [key]: identity }), handlers: [definition(() => Effect.void)] });
      const result = Effect.runPromise(dispatch(envelope()).pipe(Effect.provide(layer)));
      if ([1, 63].includes(identity.length)) {
        expect(await result).toEqual({ status: "accepted", operationId });
        expect(accepted).toHaveLength(1);
      } else {
        await expect(result).rejects.toMatchObject({ code: "job-configuration" });
        expect(accepted).toEqual([]);
      }
    }
  }
});
