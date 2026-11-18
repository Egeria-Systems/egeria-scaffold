import { Context, Effect, Layer } from "effect";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { JobDispatcher, executeJob, validateJob, type JobDefinition, type JobEnvelope } from "@/src/application/job-delivery";

const state = vi.hoisted(() => ({
  definitions: [] as JobDefinition[],
  create: vi.fn<(input: Readonly<{ definitions: readonly JobDefinition[]; environment: unknown; compiledTarget: string }>) => readonly JobDefinition[]>(),
  context: vi.fn(),
  imports: vi.fn(),
}));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: state.context }));
vi.mock("@/src/application/job-handlers", () => ({ jobHandlers: state.definitions }));
vi.mock("@/src/composition/job-handler-composition", () => {
  state.imports();
  return { createJobHandlers: state.create };
});
const job: JobEnvelope = { version: 1, environment: "local", operationId: "00000000-0000-4000-8000-000000000001", jobType: "synthetic", jobVersion: 1, payload: {} };
const definition: JobDefinition = { type: "synthetic", version: 1, repeatSafety: "idempotent", validate: payload => Object.keys(payload).length === 0, handle: () => Effect.die("UNPROVIDED_TEST_HANDLER") };
function invocation(sentinel = "first", target = "development") {
  const environment = { sentinel, APPLICATION_ENVIRONMENT: target, JOB_ENVIRONMENT: target === "development" ? "local" : target,
    JOB_QUEUE_NAME: "jobs-test", JOB_DEAD_LETTER_QUEUE_NAME: "jobs-test-dead", JOB_QUEUE: { send: vi.fn(async () => {}) }, JOB_DEAD_LETTER_QUEUE: { send: vi.fn(async () => {}) } };
  const message = { body: { ...job, environment: environment.JOB_ENVIRONMENT }, attempts: 1, ack: vi.fn(), retry: vi.fn() };
  return { environment, message, batch: { queue: "jobs-test", messages: [message] } };
}
beforeEach(() => {
  vi.resetModules(); state.definitions.splice(0, state.definitions.length, definition);
  state.context.mockRejectedValue(new Error("NO_HTTP_CONTEXT"));
  state.create.mockImplementation(input => input.definitions.map(item => ({ ...item, handle: () => Effect.void })));
});
afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });

it("keeps HTTP admission independent of loading the Queue composition hook", async () => {
  const current = invocation();
  vi.stubEnv("NEXT_PUBLIC_APPLICATION_ENVIRONMENT", "development");
  state.context.mockResolvedValue({ env: current.environment });
  const { serverJobDispatcherLayer } = await import("@/src/composition/server-jobs");
  await Effect.runPromise(Effect.flatMap(JobDispatcher, dispatcher => dispatcher.dispatch(job)).pipe(Effect.provide(serverJobDispatcherLayer)));
  expect(state.imports).not.toHaveBeenCalled(); expect(state.create).not.toHaveBeenCalled();
  expect(current.environment.JOB_QUEUE.send).toHaveBeenCalledOnce();
});

it("assembles handlers from this invocation only after target preflight without HTTP context", async () => {
  vi.stubEnv("NEXT_PUBLIC_APPLICATION_ENVIRONMENT", undefined);
  const current = invocation();
  const { consumeServerJobs } = await import("@/src/composition/server-jobs");
  await consumeServerJobs(current.batch, current.environment, "development");
  expect(state.create).toHaveBeenCalledExactlyOnceWith({ definitions: state.definitions, environment: current.environment, compiledTarget: "development" });
  expect(current.message.ack).toHaveBeenCalledOnce(); expect(current.message.retry).not.toHaveBeenCalled();
  expect(state.context).not.toHaveBeenCalled();
});

it.each(["runtime", "queue", "envelope", "binding"])("refuses %s mismatch before importing or calling assembly", async reason => {
  const current = invocation();
  const { consumeServerJobs } = await import("@/src/composition/server-jobs");
  const batch = reason === "queue" ? { ...current.batch, queue: "wrong" } : reason === "envelope" ? { ...current.batch, messages: [current.message, { ...current.message, body: { ...job, environment: "production" } }] } : current.batch;
  const environment = reason === "runtime" ? { ...current.environment, APPLICATION_ENVIRONMENT: "production" } : reason === "binding" ? { ...current.environment, JOB_QUEUE: undefined } : current.environment;
  await expect(consumeServerJobs(batch, environment, "development")).rejects.toMatchObject({ code: "job-configuration" });
  expect(state.imports).not.toHaveBeenCalled(); expect(state.create).not.toHaveBeenCalled();
  expect(current.message.ack).not.toHaveBeenCalled(); expect(current.environment.JOB_QUEUE.send).not.toHaveBeenCalled();
});

it.each(["missing", "extra", "duplicate", "validator", "policy", "version", "type", "handle"])("refuses %s assembly before business effects or acknowledgement", async variant => {
  const current = invocation(); const effect = vi.fn();
  const closed = { ...definition, handle: () => Effect.sync(effect) };
  state.create.mockImplementation(() => {
    if (variant === "missing") return [];
    if (variant === "extra") return [closed, { ...closed, type: "extra" }];
    if (variant === "duplicate") return [closed, closed];
    if (variant === "validator") return [{ ...closed, validate: () => true }];
    if (variant === "policy") return [{ ...closed, repeatSafety: "monotonic" }];
    if (variant === "version") return [{ ...closed, version: 2 }];
    if (variant === "type") return [{ ...closed, type: "different" }];
    Reflect.set(closed, "handle", undefined); // Deliberately corrupt a runtime callback.
    return [closed];
  });
  const { consumeServerJobs } = await import("@/src/composition/server-jobs");
  await expect(consumeServerJobs(current.batch, current.environment, "development")).rejects.toMatchObject({ code: "job-configuration" });
  expect(effect).not.toHaveBeenCalled(); expect(current.message.ack).not.toHaveBeenCalled(); expect(current.message.retry).not.toHaveBeenCalled();
  expect(current.environment.JOB_QUEUE.send).not.toHaveBeenCalled(); expect(current.environment.JOB_DEAD_LETTER_QUEUE.send).not.toHaveBeenCalled();
});

it("isolates concurrent invocation environments and compiled targets without eager handler execution", async () => {
  const effects: string[] = [];
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  state.create.mockImplementation(input => {
    const sentinel = Reflect.get(Object(input.environment), "sentinel");
    expect(effects).toEqual([]);
    return input.definitions.map(item => ({ ...item, handle: () => Effect.promise(async () => {
      await gate; effects.push(`${input.compiledTarget}:${sentinel}`);
    }) }));
  });
  const first = invocation("first", "development"), second = invocation("second", "staging");
  const { consumeServerJobs } = await import("@/src/composition/server-jobs");
  // Start the second invocation while the first business Effect is suspended.
  // This avoids the test runner's concurrent dynamic-import mock bypass.
  const firstPending = consumeServerJobs(first.batch, first.environment, "development");
  await expect.poll(() => state.create.mock.calls.length).toBe(1);
  const pending = Promise.all([firstPending, consumeServerJobs(second.batch, second.environment, "staging")]);
  await expect.poll(() => state.create.mock.calls.length).toBe(2);
  expect(effects).toEqual([]); release(); await pending;
  expect(effects.sort()).toEqual(["development:first", "staging:second"]);
  expect(first.message.ack).toHaveBeenCalledOnce(); expect(second.message.ack).toHaveBeenCalledOnce();
  expect(state.context).not.toHaveBeenCalled();
});

it("refuses assembly that rewrites registry policy and sanitizes hook failures", async () => {
  const current = invocation();
  state.definitions[0] = { ...definition };
  const originalValidator = state.definitions[0].validate;
  state.create.mockImplementation(input => {
    for (const item of input.definitions) Reflect.set(item, "validate", () => true);
    return input.definitions.map(item => ({ ...item, handle: () => Effect.void }));
  });
  const { consumeServerJobs } = await import("@/src/composition/server-jobs");
  await expect(consumeServerJobs(current.batch, current.environment, "development")).rejects.toMatchObject({ code: "job-configuration" });
  expect(current.message.ack).not.toHaveBeenCalled();
  expect(state.create.mock.calls[0]?.[0].definitions[0]).not.toBe(state.definitions[0]);
  expect(state.definitions[0].validate).toBe(originalValidator);
  expect(() => validateJob({ ...job, payload: { unexpected: true } }, "local", state.definitions)).toThrowError();
  state.create.mockImplementation(() => { throw new Error("private-hook-configuration"); });
  await expect(consumeServerJobs(current.batch, current.environment, "development")).rejects.toMatchObject({ code: "job-configuration" });
});

class SelectedService extends Context.Service<SelectedService, { readonly run: Effect.Effect<void> }>()("synthetic/SelectedService") {}

it("keeps service requirements until a layer closes the executable handle", async () => {
  const run = vi.fn();
  const requiring: JobDefinition<SelectedService> = { ...definition, handle: () => Effect.flatMap(SelectedService, service => service.run) };
  // @ts-expect-error An unprovided service requirement cannot be erased at execution.
  const unprovided: JobDefinition = requiring;
  void unprovided;
  const layer = Layer.succeed(SelectedService, { run: Effect.sync(run) });
  const closed: JobDefinition = { ...requiring, handle: (job, context) => requiring.handle(job, context).pipe(Effect.provide(layer)) };
  expect(run).not.toHaveBeenCalled();
  expect(await executeJob(job, [closed], 1)).toEqual({ outcome: "completed" });
  expect(run).toHaveBeenCalledOnce();
});
