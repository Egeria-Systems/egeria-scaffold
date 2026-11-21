import { Effect } from "effect";
import { expect, it, vi } from "vitest";
import { JobDispatcher, JobHandlerFailure, inspectTerminalJob, prepareJobRecovery, runJobAttempt, validateJob, type JobDefinition, type JobEnvelope } from "@/src/application/job-delivery";
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

it("a checked attempt validates and executes the same isolated snapshot once", async () => {
  const input = envelope({ payload: { entries: [{ sequence: 1 }] } });
  let validated: JobEnvelope["payload"] | undefined;
  const validate = vi.fn((payload: JobEnvelope["payload"]) => {
    validated = payload;
    return true;
  });
  const handle = vi.fn((job: JobEnvelope, { attempt }: { attempt: number }) => Effect.sync(() => {
    expect(job.payload).toBe(validated);
    expect(attempt).toBe(3);
    expect(Object.isFrozen(job)).toBe(true);
    expect(Object.isFrozen(job.payload)).toBe(true);
    expect(Object.isFrozen(job.payload.entries)).toBe(true);
    expect(job.payload).toEqual({ entries: [{ sequence: 1 }] });
  }));
  const pending = runJobAttempt(input, "local", [{ ...definition(handle), validate }], 3);
  Reflect.set(input.payload, "entries", []);
  const result = await pending;
  expect(result).toMatchObject({ kind: "executed", decision: { outcome: "completed" } });
  expect(validate).toHaveBeenCalledOnce();
  expect(handle).toHaveBeenCalledOnce();
  expect(Object.isFrozen(Reflect.get(Object(validated?.entries), "0"))).toBe(true);
});

it("a checked attempt reads a bounded JSON snapshot before declaration validation", async () => {
  const sequence = vi.fn().mockReturnValueOnce(1).mockReturnValue(Infinity);
  const handle = vi.fn(() => Effect.void);
  const input = envelope({ payload: { get sequence() { return sequence(); } } });
  const result = await runJobAttempt(input, "local", [definition(handle)], 1);
  expect(result).toMatchObject({ kind: "executed", job: { payload: { sequence: 1 } }, decision: { outcome: "completed" } });
  expect(sequence).toHaveBeenCalledOnce();
  expect(handle).toHaveBeenCalledOnce();
});

it("stops expanding oversized shared strings before visiting the rest of the payload", async () => {
  const chunk = "a".repeat(2_048);
  const read = vi.fn(() => chunk);
  const shared = { get chunk() { return read(); } };
  const entries = Array.from({ length: 12 }, () => shared);
  const validate = vi.fn(() => true);
  const handle = vi.fn(() => Effect.void);
  const result = await runJobAttempt(envelope({ payload: { entries } }), "local", [{ ...definition(handle), validate }], 1);
  expect(result).toEqual({ kind: "malformed-envelope", code: "job-validation", operationId });
  expect(read.mock.calls.length).toBeLessThan(entries.length);
  expect(validate).not.toHaveBeenCalled();
  expect(handle).not.toHaveBeenCalled();
});

it("stops expanding oversized shared containers with short values", () => {
  const read = vi.fn(() => null);
  const shared = { get value() { return read(); } };
  const row = Array.from({ length: 48 }, () => shared);
  const rows = Array.from({ length: 32 }, () => row);
  const handlers = [{ ...definition(() => Effect.void), validate: () => true }];
  expect(() => validateJob(envelope({ payload: { rows } }), "local", handlers))
    .toThrow(expect.objectContaining({ code: "job-validation" }));
  expect(read.mock.calls.length).toBeLessThan(rows.length * row.length);
});

it("preserves the exact UTF-8 envelope boundary with shared values and JSON escaping", () => {
  const shared = { chunk: "é".repeat(2_048) };
  const entries = [shared, shared, shared, "a".repeat(2_048), '"\\\n'];
  const encodedBytes = (job: JobEnvelope) => new TextEncoder().encode(JSON.stringify(job)).byteLength;
  const atLimit = (padding: string) => envelope({ payload: { entries, padding } });
  const padding = "x".repeat(16_384 - encodedBytes(atLimit("")));
  const handlers = [{ ...definition(() => Effect.void), validate: () => true }];
  expect(encodedBytes(atLimit(padding))).toBe(16_384);
  expect(validateJob(atLimit(padding), "local", handlers)).toEqual(atLimit(padding));
  expect(() => validateJob(atLimit(padding + "x"), "local", handlers))
    .toThrow(expect.objectContaining({ code: "job-validation" }));
});

it("a checked attempt separates structural and declaration failures without executing either", async () => {
  const handle = vi.fn(() => Effect.void);
  const validate = vi.fn(() => true);
  const handler = { ...definition(handle), validate };
  const malformed = await runJobAttempt({ ...envelope(), secret: "synthetic-unvalidated" }, "local", [], 1);
  expect(malformed).toEqual({ kind: "malformed-envelope", code: "job-validation", operationId });
  expect(await runJobAttempt(envelope({ environment: "production" }), "local", [handler], 1))
    .toMatchObject({ kind: "malformed-envelope", code: "job-environment" });
  expect(await runJobAttempt(envelope({ jobVersion: 2 }), "local", [handler], 1))
    .toEqual({ kind: "declaration-rejection", code: "job-unsupported" });
  expect(await runJobAttempt(envelope(), "local", [handler, handler], 1))
    .toEqual({ kind: "declaration-rejection", code: "job-configuration" });
  expect(validate).not.toHaveBeenCalled();
  expect(await runJobAttempt(envelope(), "local", [{ ...handler, validate: () => false }], 1))
    .toEqual({ kind: "declaration-rejection", code: "job-validation" });
  expect(await runJobAttempt(envelope(), "local", [{ ...handler, validate: () => { throw new Error("synthetic-private"); } }], 1))
    .toEqual({ kind: "declaration-rejection", code: "job-configuration" });
  expect(handle).not.toHaveBeenCalled();
});

it("a checked attempt preserves abort and unknown execution decisions", async () => {
  const handle = vi.fn(() => Effect.void);
  expect(await runJobAttempt(envelope(), "local", [definition(handle)], 1, AbortSignal.abort()))
    .toMatchObject({ kind: "executed", decision: { outcome: "retry", code: "job-handler-cancelled" } });
  expect(handle).not.toHaveBeenCalled();
  expect(await runJobAttempt(envelope(), "local", [definition(() => Effect.die("synthetic-private"))], 1))
    .toMatchObject({ kind: "executed", decision: { outcome: "retry", code: "job-execution-unknown" } });
});

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
    APPLICATION_ENVIRONMENT: "development", JOB_ENVIRONMENT: "local", JOB_QUEUE_NAME: "jobs-local", JOB_DEAD_LETTER_QUEUE_NAME: "jobs-local-dead",
    JOB_QUEUE: { send: async (body: unknown) => { accepted.push(body); } },
    JOB_DEAD_LETTER_QUEUE: { send: async (body: unknown) => { terminals.push(body); } },
  };
  return { accepted, terminals, environment };
}

it("Cloudflare admission is lazy, validates bindings and never claims completion", async () => {
  const { accepted, environment } = nativeEnvironment();
  const handlers = [definition(() => Effect.die("handler must not run during dispatch"))];
  const layer = createCloudflareJobDispatcherLayer({ compiledTarget: () => ({ ok: true, value: "development" }), configuration: Effect.succeed(environment), handlers });
  const task = dispatch(envelope()).pipe(Effect.provide(layer));
  expect(accepted).toEqual([]);
  expect(await Effect.runPromise(task)).toEqual({ status: "accepted", operationId });
  expect(accepted).toEqual([envelope()]);
  const missing = createCloudflareJobDispatcherLayer({ compiledTarget: () => ({ ok: true, value: "development" }), configuration: Effect.succeed({ ...environment, JOB_DEAD_LETTER_QUEUE: undefined }), handlers });
  await expect(Effect.runPromise(dispatch(envelope()).pipe(Effect.provide(missing)))).rejects.toMatchObject({ code: "job-configuration" });
  expect(accepted).toHaveLength(1);
});

it("pre-aborted dispatch sends nothing, and a rejected send has unknown acceptance", async () => {
  const { accepted, environment } = nativeEnvironment();
  const handlers = [definition(() => Effect.void)];
  const layer = createCloudflareJobDispatcherLayer({ compiledTarget: () => ({ ok: true, value: "development" }), configuration: Effect.succeed(environment), handlers });
  await expect(Effect.runPromise(dispatch(envelope()).pipe(Effect.provide(layer)), { signal: AbortSignal.abort() })).rejects.toThrow();
  expect(accepted).toEqual([]);
  const uncertain = createCloudflareJobDispatcherLayer({ compiledTarget: () => ({ ok: true, value: "development" }), configuration: Effect.succeed({ ...environment,
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
  const poison = [
    message({ secret: "synthetic-sensitive-body" }),
    message({ environment: "prod", secret: "synthetic-sensitive-body" }),
    message({ environment: null, secret: "synthetic-sensitive-body" }),
  ];
  const logs = vi.spyOn(console, "info").mockImplementation(() => {});
  try {
    await consumeCloudflareJobs({ queue: "jobs-local", messages: [...poison, success, failure] }, environment, "development",
      [definition((job) => job.payload.sequence === 1 ? Effect.void : Effect.fail(new JobHandlerFailure("retry")))]);
    expect(success.ack).toHaveBeenCalledOnce();
    expect(failure.retry).toHaveBeenCalledWith({ delaySeconds: 5 });
    for (const delivery of poison) {
      expect(delivery.ack).toHaveBeenCalledOnce();
      expect(delivery.retry).not.toHaveBeenCalled();
    }
    expect(terminals).toEqual(poison.map(() => ({ terminalVersion: 1, environment: "local", code: "job-validation" })));
    expect(JSON.stringify(logs.mock.calls)).not.toContain("synthetic-sensitive-body");
  } finally { logs.mockRestore(); }
});

it("terminal send failure requests native retry without acknowledgement", async () => {
  const { environment } = nativeEnvironment();
  const poison = message({ bad: true });
  await consumeCloudflareJobs({ queue: "jobs-local", messages: [poison] }, { ...environment,
    JOB_DEAD_LETTER_QUEUE: { send: async () => { throw new Error("synthetic-private"); } },
  }, "development", []);
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
  await consumeCloudflareJobs({ queue: "jobs-local", messages: [delivery] }, environment, "development", [handler], controller.signal);
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
    const layer = createCloudflareJobDispatcherLayer({ compiledTarget: () => ({ ok: true, value: "development" }), configuration: Effect.succeed(environment), handlers: restored });
    await Effect.runPromise(dispatch(envelope()).pipe(Effect.provide(layer)));
    const delivery = message(accepted[0]);
    await consumeCloudflareJobs({ queue: "jobs-local", messages: [delivery] }, environment, "development", handlers);
    expect(delivery.ack).not.toHaveBeenCalled();
    expect(delivery.retry).toHaveBeenCalledWith({ delaySeconds: 5 });
    expect(terminals).toEqual([]);
    expect(prepareJobRecovery(delivery.body, "local", restored)).toEqual(envelope());
    const retry = message(delivery.body, 2);
    await consumeCloudflareJobs({ queue: "jobs-local", messages: [retry] }, environment, "development", restored);
    expect(retry.ack).toHaveBeenCalledOnce();
    expect(retry.retry).not.toHaveBeenCalled();
  }
});


it("server composition dispatches through its context and consumes through its application registry", async () => {
  const { environment, accepted } = nativeEnvironment();
  let effects = 0;
  vi.stubEnv("NEXT_PUBLIC_APPLICATION_ENVIRONMENT", "development");
  compositionContext.environment = environment;
  compositionContext.handlers.push(definition(() => Effect.sync(() => { effects++; })));
  try {
    expect(await Effect.runPromise(dispatch(envelope()).pipe(Effect.provide(serverJobDispatcherLayer))))
      .toEqual({ status: "accepted", operationId });
    expect(accepted).toEqual([envelope()]);
    expect(effects).toBe(0);
    const delivery = message(accepted[0]);
    await consumeServerJobs({ queue: "jobs-local", messages: [delivery] }, environment, "development");
    expect(delivery.ack).toHaveBeenCalledOnce();
    expect(effects).toBe(1);
    compositionContext.environment = { ...environment, JOB_DEAD_LETTER_QUEUE: undefined };
    await expect(Effect.runPromise(dispatch(envelope()).pipe(Effect.provide(serverJobDispatcherLayer))))
      .rejects.toMatchObject({ code: "job-configuration" });
    expect(accepted).toHaveLength(1);
  } finally { compositionContext.handlers.length = 0; compositionContext.environment = {}; vi.unstubAllEnvs(); }
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
      const layer = createCloudflareJobDispatcherLayer({ compiledTarget: () => ({ ok: true, value: "development" }), configuration: Effect.succeed({ ...environment, [key]: identity }), handlers: [definition(() => Effect.void)] });
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


it("refuses compiled, Worker and queue target disagreement before dispatch or consumption effects", async () => {
  for (const mismatch of ["compiled", "worker", "queue", "envelope"]) {
    const { environment, accepted, terminals } = nativeEnvironment();
    let effects = 0;
    const handlers = [definition(() => Effect.sync(() => { effects++; }))];
    const target = mismatch === "compiled" ? "staging" : "development";
    const raw = { ...environment,
      APPLICATION_ENVIRONMENT: mismatch === "worker" ? "production" : "development",
      JOB_ENVIRONMENT: mismatch === "queue" ? "staging" : "local" };
    const job = envelope(mismatch === "envelope" ? { environment: "production" } : {});
    const layer = createCloudflareJobDispatcherLayer({ compiledTarget: () => ({ ok: true, value: target }),
      configuration: Effect.succeed(raw), handlers });
    await expect(Effect.runPromise(dispatch(job).pipe(Effect.provide(layer)))).rejects.toThrow();
    const delivery = message(job);
    await expect(consumeCloudflareJobs({ queue: "jobs-local", messages: [delivery] }, raw, target, handlers)).rejects.toMatchObject({ code: "job-configuration" });
    expect(accepted).toEqual([]);
    expect(terminals).toEqual([]);
    expect(effects).toBe(0);
    expect(delivery.ack).not.toHaveBeenCalled();
    expect(delivery.retry).not.toHaveBeenCalled();
  }
});

it("maps development to local while staging and production preserve their queue target", async () => {
  for (const [target, jobEnvironment] of [["development", "local"], ["staging", "staging"], ["production", "production"]] as const) {
    const { environment, accepted } = nativeEnvironment();
    const raw = { ...environment, APPLICATION_ENVIRONMENT: target, JOB_ENVIRONMENT: jobEnvironment };
    const handlers = [definition(() => Effect.void)];
    const layer = createCloudflareJobDispatcherLayer({ compiledTarget: () => ({ ok: true, value: target }), configuration: Effect.succeed(raw), handlers });
    await Effect.runPromise(dispatch(envelope({ environment: jobEnvironment })).pipe(Effect.provide(layer)));
    const delivery = message(accepted[0]);
    await consumeCloudflareJobs({ queue: "jobs-local", messages: [delivery] }, raw, target, handlers);
    expect(delivery.ack).toHaveBeenCalledOnce();
  }
});

it("accepted envelope remains recoverable after validator rejection", async () => {
  const { environment, accepted, terminals } = nativeEnvironment();
  let effects = 0;
  const original = [definition(() => Effect.sync(() => { effects++; }))];
  const layer = createCloudflareJobDispatcherLayer({ compiledTarget: () => ({ ok: true, value: "development" }), configuration: Effect.succeed(environment), handlers: original });
  await Effect.runPromise(dispatch(envelope()).pipe(Effect.provide(layer)));
  const replacement = [{ ...original[0]!, validate: () => false }];
  const delivery = message(accepted[0]);
  const logs = vi.spyOn(console, "info").mockImplementation(() => {});
  try {
    await consumeCloudflareJobs({ queue: "jobs-local", messages: [delivery] }, environment, "development", replacement);
    expect(effects).toBe(0);
    expect(delivery.ack).not.toHaveBeenCalled();
    expect(delivery.retry).toHaveBeenCalledWith({ delaySeconds: 5 });
    expect(terminals).toEqual([]);
    expect(delivery.body).toEqual(envelope());
    expect(() => prepareJobRecovery(delivery.body, "local", replacement)).toThrow();
    expect(JSON.stringify(logs.mock.calls)).not.toContain("sequence");
  } finally { logs.mockRestore(); }
});

it("producer rejects invalid payload before send", async () => {
  const { environment, accepted } = nativeEnvironment();
  const handlers = [definition(() => Effect.void)];
  const layer = createCloudflareJobDispatcherLayer({ compiledTarget: () => ({ ok: true, value: "development" }), configuration: Effect.succeed(environment), handlers });
  await expect(Effect.runPromise(dispatch(envelope({ payload: { sequence: "invalid" } })).pipe(Effect.provide(layer))))
    .rejects.toMatchObject({ code: "job-validation" });
  expect(accepted).toEqual([]);
});

it("malformed body remains sanitized even when the declaration is absent", async () => {
  const { environment, terminals } = nativeEnvironment();
  const delivery = message({ ...envelope(), payload: { secret: "synthetic-private-malformed" }, unexpected: true });
  await consumeCloudflareJobs({ queue: "jobs-local", messages: [delivery] }, environment, "development", []);
  expect(delivery.ack).toHaveBeenCalledOnce();
  expect(delivery.retry).not.toHaveBeenCalled();
  expect(terminals).toEqual([{ terminalVersion: 1, environment: "local", code: "job-validation", operationId }]);
});

it("terminal disposition preserves the original validated snapshot", async () => {
  for (const disposition of ["terminal", "cancelled"] as const) {
    const { environment, terminals } = nativeEnvironment();
    let accepts = true;
    let validations = 0;
    const handlers = [{ ...definition(job => Effect.sync(() => {
      accepts = false;
      Reflect.set(job.payload, "sequence", 999);
    }).pipe(Effect.andThen(Effect.fail(new JobHandlerFailure(disposition))))),
      validate: () => { validations++; return accepts; } }];
    const delivery = message(envelope());
    await consumeCloudflareJobs({ queue: "jobs-local", messages: [delivery] }, environment, "development", handlers);
    expect(terminals).toEqual([{ terminalVersion: 1, environment: "local", code: `job-handler-${disposition}`, operationId, job: envelope() }]);
    expect(validations).toBe(1);
    expect(delivery.ack).toHaveBeenCalledOnce();
    expect(delivery.retry).not.toHaveBeenCalled();
  }
});

it("restored declaration recovers unchanged identity and payload", async () => {
  let effects = 0;
  const restored = [definition(() => Effect.sync(() => { effects++; }))];
  const handlers = [...restored];
  const memory = createMemoryJobDelivery("local", handlers);
  await Effect.runPromise(dispatch(envelope()).pipe(Effect.provide(memory.layer)));
  handlers[0] = { ...restored[0]!, validate: () => false };
  for (let attempt = 1; attempt <= 4; attempt++) {
    expect(await memory.consumeNext()).toEqual(attempt < 4 ? { outcome: "retry", code: "job-validation" } : { outcome: "terminal", code: "job-retries-exhausted" });
  }
  expect(effects).toBe(0);
  expect(await memory.consumeNext()).toBeUndefined();
  const retained = memory.terminals()[0];
  expect(retained).toEqual({ terminalVersion: 1, environment: "local", code: "job-retries-exhausted", operationId, job: envelope() });
  expect(() => prepareJobRecovery(retained, "local", handlers)).toThrow();
  expect(prepareJobRecovery(retained, "local", restored)).toEqual(envelope());
  handlers[0] = restored[0]!;
  await Effect.runPromise(dispatch(prepareJobRecovery(retained, "local", restored)).pipe(Effect.provide(memory.layer)));
  expect(await memory.consumeNext()).toEqual({ outcome: "completed" });
  expect(effects).toBe(1);
});

it("validator and caller mutation cannot change the admitted nested snapshot", async () => {
  const { environment, accepted } = nativeEnvironment();
  const job = envelope({ payload: { nested: { sequence: 1 }, entries: [1, 2] } });
  const handlers = [{ ...definition(() => Effect.void), validate: (payload: JobEnvelope["payload"]) => {
    Reflect.set(payload.nested as object, "sequence", 999);
    Reflect.set(payload.entries as object, "0", 999);
    return true;
  } }];
  const layer = createCloudflareJobDispatcherLayer({ compiledTarget: () => ({ ok: true, value: "development" }), configuration: Effect.succeed(environment), handlers });
  await Effect.runPromise(dispatch(job).pipe(Effect.provide(layer)));
  Reflect.set(job.payload.nested as object, "sequence", 777);
  expect(accepted).toEqual([envelope({ payload: { nested: { sequence: 1 }, entries: [1, 2] } })]);
});

it("local retries isolate handler mutation and revalidate each attempt", async () => {
  const seen: unknown[] = [];
  const handlers = [{ ...definition(job => Effect.sync(() => {
    seen.push(structuredClone(job.payload));
    Reflect.set(job.payload.nested as object, "sequence", 999);
  }).pipe(Effect.andThen(Effect.fail(new JobHandlerFailure("retry"))))), validate: () => true }];
  const memory = createMemoryJobDelivery("local", handlers);
  await Effect.runPromise(dispatch(envelope({ payload: { nested: { sequence: 1 } } })).pipe(Effect.provide(memory.layer)));
  for (let attempt = 0; attempt < 4; attempt++) await memory.consumeNext();
  expect(seen).toEqual(Array.from({ length: 4 }, () => ({ nested: { sequence: 1 } })));
  expect(memory.terminals()[0]?.job).toEqual(envelope({ payload: { nested: { sequence: 1 } } }));
});

it("memory retries missing, duplicate and throwing declarations without execution", async () => {
  for (const fault of ["missing", "duplicate", "throwing"] as const) {
    let effects = 0;
    const handler = definition(() => Effect.sync(() => { effects++; }));
    const handlers = [handler];
    const memory = createMemoryJobDelivery("local", handlers);
    await Effect.runPromise(dispatch(envelope()).pipe(Effect.provide(memory.layer)));
    if (fault === "missing") handlers.length = 0;
    if (fault === "duplicate") handlers.push(handler);
    if (fault === "throwing") handlers[0] = { ...handler, validate: () => { throw new Error("synthetic-private-validator"); } };
    expect(await memory.consumeNext()).toEqual({ outcome: "retry", code: fault === "missing" ? "job-unsupported" : "job-configuration" });
    expect(effects).toBe(0);
    handlers.splice(0, handlers.length, handler);
    expect(await memory.consumeNext()).toEqual({ outcome: "completed" });
    expect(effects).toBe(1);
  }
});

it("acknowledgement failure retries the original without undoing its effect", async () => {
  const { environment, terminals } = nativeEnvironment();
  let effects = 0;
  const delivery = message(envelope());
  delivery.ack.mockImplementation(() => { throw new Error("synthetic-ack-uncertainty"); });
  await consumeCloudflareJobs({ queue: "jobs-local", messages: [delivery] }, environment, "development", [definition(() => Effect.sync(() => { effects++; }))]);
  expect(effects).toBe(1);
  expect(delivery.retry).toHaveBeenCalledOnce();
  expect(delivery.body).toEqual(envelope());
  expect(terminals).toEqual([]);
});

it("terminal admission uncertainty preserves the source and permits duplicate terminal copies", async () => {
  const { environment, terminals } = nativeEnvironment();
  const delivery = message(envelope());
  const handlers = [definition(() => Effect.fail(new JobHandlerFailure("terminal")))];
  await consumeCloudflareJobs({ queue: "jobs-local", messages: [delivery] }, { ...environment,
    JOB_DEAD_LETTER_QUEUE: { send: async (body: unknown) => { terminals.push(body); throw new Error("synthetic-uncertain-send"); } },
  }, "development", handlers);
  expect(delivery.ack).not.toHaveBeenCalled();
  expect(delivery.retry).toHaveBeenCalledOnce();
  await consumeCloudflareJobs({ queue: "jobs-local", messages: [message(delivery.body, 2)] }, environment, "development", handlers);
  expect(terminals).toEqual(Array.from({ length: 2 }, () => ({ terminalVersion: 1, environment: "local", code: "job-handler-terminal", operationId, job: envelope() })));
});

it("a cross-target batch refuses every message before any effect", async () => {
  const { environment, accepted, terminals } = nativeEnvironment();
  let effects = 0;
  const deliveries = [message(envelope()), message(envelope({ environment: "production" }))];
  await expect(consumeCloudflareJobs({ queue: "jobs-local", messages: deliveries }, environment, "development",
    [definition(() => Effect.sync(() => { effects++; }))])).rejects.toMatchObject({ code: "job-configuration" });
  expect(effects).toBe(0);
  expect(accepted).toEqual([]);
  expect(terminals).toEqual([]);
  for (const delivery of deliveries) { expect(delivery.ack).not.toHaveBeenCalled(); expect(delivery.retry).not.toHaveBeenCalled(); }
});

it("structurally valid injected business-invalid work retries without a provenance claim", async () => {
  const { environment, accepted, terminals } = nativeEnvironment();
  let effects = 0;
  const handlers = [definition(() => Effect.sync(() => { effects++; }))];
  const source = envelope({ payload: { sequence: "synthetic-business-invalid" } });
  for (let attempts = 1; attempts <= 4; attempts++) {
    const delivery = message(source, attempts);
    await consumeCloudflareJobs({ queue: "jobs-local", messages: [delivery] }, environment, "development", handlers);
    expect(delivery.retry).toHaveBeenCalledWith({ delaySeconds: 5 * 2 ** (attempts - 1) });
    expect(delivery.ack).not.toHaveBeenCalled();
    expect(delivery.body).toEqual(source);
  }
  expect(effects).toBe(0);
  expect(accepted).toEqual([]);
  expect(terminals).toEqual([]);
  expect(inspectTerminalJob(source, "local", handlers)).toEqual({ recoverable: false });
});

it("preserves the bounded payload shape and declaration limits", () => {
  const permissive = { ...definition(() => Effect.void), validate: () => true };
  const nested = (depth: number): JobEnvelope["payload"] => depth === 0 ? { leaf: true } : { child: nested(depth - 1) };
  const valid = [{ value: "a".repeat(2_048) }, { values: Array.from({ length: 64 }, () => 1) },
    Object.fromEntries(Array.from({ length: 64 }, (_, index) => [`field${index}`, 1])), nested(4)];
  const invalid = [{ value: "a".repeat(2_049) }, { values: Array.from({ length: 65 }, () => 1) },
    Object.fromEntries(Array.from({ length: 65 }, (_, index) => [`field${index}`, 1])), nested(5), { invalidKey$: true }];
  for (const payload of valid) expect(validateJob(envelope({ payload }), "local", [permissive]).payload).toEqual(payload);
  for (const payload of invalid) expect(() => validateJob(envelope({ payload }), "local", [permissive])).toThrow();
  const registry = Array.from({ length: 32 }, (_, index) => ({ ...permissive, type: index === 0 ? "synthetic" : `job-${index}` }));
  expect(validateJob(envelope(), "local", registry)).toEqual(envelope());
  expect(() => validateJob(envelope(), "local", [...registry, { ...permissive, type: "overflow" }]))
    .toThrow(expect.objectContaining({ code: "job-configuration" }));
});

it("local terminal retention counts toward capacity without losing recoverable work", async () => {
  const memory = createMemoryJobDelivery("local", [definition(() => Effect.fail(new JobHandlerFailure("terminal")))]);
  for (let index = 0; index < 100; index++) {
    await Effect.runPromise(dispatch(envelope()).pipe(Effect.provide(memory.layer)));
    expect((await memory.consumeNext())?.outcome).toBe("terminal");
  }
  await expect(Effect.runPromise(dispatch(envelope()).pipe(Effect.provide(memory.layer)))).rejects.toMatchObject({ code: "job-capacity" });
  expect(memory.terminals()).toHaveLength(100);
  const copy = memory.terminals();
  Reflect.set(copy[0]!.job!.payload, "sequence", 999);
  expect(memory.terminals()[0]?.job).toEqual(envelope());
});

it("admits and prepares recovery from a provider-independent declaration without an executable handle", () => {
  const declaration = { type: "synthetic", version: 1, repeatSafety: "idempotent" as const, validate: (payload: Readonly<Record<string, unknown>>) => payload.sequence === 1 };
  // Runtime admission inspects declaration policy, not the executable handle.
  const registry = [Object.assign(declaration, { handle: undefined })];
  expect(validateJob(envelope(), "local", registry)).toEqual(envelope());
  expect(prepareJobRecovery(envelope(), "local", registry)).toEqual(envelope());
});
