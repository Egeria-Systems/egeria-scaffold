import { mkdtemp, readFile, rm, writeFile, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createTestHarness, type TestHarnessOptions } from "wrangler";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { Effect } from "effect";
import * as operatorPolicy from "@/src/infrastructure/cloudflare/job-operations";
import type { JobDefinition } from "@/src/application/job-delivery";

const operatorPath = "../../scripts/job-operator.mjs";
const { runOperator, createPrivateStore } = await import(operatorPath);

const applicationRoot = process.cwd();
const run = promisify(execFile);
let root: string;
let harness: ReturnType<typeof createTestHarness>;
let restoreFetch: () => void;
const blocked: string[] = [];
const operationId = "00000000-0000-4000-8000-000000000001";
const job = (action = "complete", sequence = 1, environment = "local") =>
  ({ version: 1, environment, operationId, jobType: "synthetic", jobVersion: 1, payload: { action, sequence } });

beforeAll(async () => {
  root = await mkdtemp(resolve(tmpdir(), "job-worker-test-"));
  const originalFetch = globalThis.fetch;
  const spy = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) { blocked.push("blocked"); throw new Error("TEST_EXTERNAL_REQUEST_BLOCKED"); }
    return originalFetch(input, init);
  });
  restoreFetch = () => spy.mockRestore();
  const configuration = JSON.parse(await readFile("wrangler.jsonc", "utf8"));
  const workers: TestHarnessOptions["workers"] = ["local", "staging"].map((environment) => {
    const selected = environment === "local" ? configuration : configuration.env[environment];
    return { config: {
      name: `jobs-${environment}`, main: resolve(applicationRoot, "tests/integration/fixtures/job-worker.mjs"),
      compatibility_date: configuration.compatibility_date, compatibility_flags: configuration.compatibility_flags,
      assets: { directory: resolve(applicationRoot, ".open-next/assets"), binding: "ASSETS" },
      version_metadata: configuration.version_metadata,
      vars: selected.vars,
      queues: { producers: selected.queues.producers, consumers: [
        ...selected.queues.consumers,
        { queue: selected.vars.JOB_DEAD_LETTER_QUEUE_NAME, max_batch_size: 10, max_batch_timeout: 0.1, max_retries: 0 },
      ] },
    } };
  });
  harness = createTestHarness({ root, workers });
  await harness.listen();
});
afterEach(async () => { await harness.reset(); });
afterAll(async () => {
  try { await harness?.close(); }
  finally { restoreFetch?.(); if (root) await rm(root, { recursive: true, force: true }); }
  expect(blocked).toEqual([]);
});

async function state(environment = "local") {
  const response = await harness.getWorker(`jobs-${environment}`).fetch("/__synthetic-jobs/state");
  return await response.json() as { observations: { operationId: string; attempt: number }[]; terminals: unknown[]; values: Record<string, number> };
}
async function enqueue(value = job(), environment = "local", raw = false) {
  const response = await harness.getWorker(`jobs-${environment}`).fetch(`/__synthetic-jobs/${raw ? "raw" : "enqueue"}`, {
    method: "POST", body: JSON.stringify(raw ? value : { job: value }),
  });
  expect(response.status).toBe(202);
  if (!raw) expect(await response.json()).toEqual({ status: "accepted", operationId });
}
async function completed(value = 1) {
  await expect.poll(async () => (await state()).values[operationId], { timeout: 80_000, interval: 50 }).toBe(value);
}

it("keeps actual built HTTP and health behavior while dispatch acceptance precedes completion", async () => {
  await enqueue();
  expect((await state()).values).toEqual({});
  for (const path of ["/", "/api/health"]) {
    const response = await harness.getWorker("jobs-local").fetch(path);
    expect(response.status).toBe(200);
  }
  await completed();
  expect((await state()).observations.map(({ attempt }) => attempt)).toEqual([1]);
});

it("native retry and duplicate out-of-order delivery preserve the consumer's monotonic side effect", async () => {
  await enqueue(job("retry", 1));
  await enqueue(job("complete", 2));
  await enqueue(job("complete", 2));
  await completed(2);
  await expect.poll(async () => (await state()).observations.length, { timeout: 40_000 }).toBe(4);
  expect((await state()).values[operationId]).toBe(2);
  expect((await state()).observations.map(({ attempt }) => attempt).sort()).toEqual([1, 1, 1, 2]);
});

it("native exhausted retries transfer the unchanged job to the DLQ with original recovery identity", async () => {
  await enqueue(job("poison"));
  await expect.poll(async () => (await state()).terminals.length, { timeout: 80_000, interval: 100 }).toBe(1);
  const result = await state();
  expect(result.observations.map(({ attempt }) => attempt)).toEqual([1, 2, 3, 4]);
  expect(result.terminals).toEqual([job("poison")]);
  expect(result.values).toEqual({});
  const recovery = await harness.getWorker("jobs-local").fetch("/__synthetic-jobs/recovery");
  expect(await recovery.json()).toEqual(job("poison"));
}, 90_000);

it("timeout after a side effect retries without multiplying the logical update", async () => {
  await enqueue(job("timeout", 3));
  await completed(3);
  await expect.poll(async () => (await state()).observations.length, { timeout: 40_000 }).toBe(2);
  expect((await state()).values[operationId]).toBe(3);
  expect((await state()).observations.map(({ attempt }) => attempt)).toEqual([1, 2]);
}, 50_000);

it("quarantines malformed and wrong-environment input without payload logging", async () => {
  const web = harness.getWorker("jobs-local");
  const response = await web.fetch("/__synthetic-jobs/raw", { method: "POST", body: JSON.stringify({ privateBody: "SYNTHETIC_PRIVATE_BODY" }) });
  expect(response.status).toBe(202);
  await enqueue(job("complete", 1, "staging"), "local", true);
  await expect.poll(async () => (await state()).terminals.length, { timeout: 20_000 }).toBe(2);
  const result = await state();
  expect(result.observations).toEqual([]);
  expect(JSON.stringify(result.terminals)).not.toContain("SYNTHETIC_PRIVATE_BODY");
  expect(harness.getLogs().some(({ message }) => message.includes("SYNTHETIC_PRIVATE_BODY"))).toBe(false);
});

it("isolates environments and refuses dispatch without its dead-letter binding", async () => {
  await enqueue(job("complete", 1, "staging"), "staging");
  await expect.poll(async () => (await state("staging")).values[operationId], { timeout: 20_000 }).toBe(1);
  expect((await state()).observations).toEqual([]);
  const response = await harness.getWorker("jobs-local").fetch("/__synthetic-jobs/enqueue", {
    method: "POST", body: JSON.stringify({ job: job(), missingBinding: true }),
  });
  expect(response.status).toBe(422);
  expect((await state()).values).toEqual({});
});

it("configuration preflight rejects a missing native DLQ before any deployment", async () => {
  const config = JSON.parse(await readFile("wrangler.jsonc", "utf8"));
  const temporary = await mkdtemp(resolve(root, "preflight-"));
  await writeFile(resolve(temporary, "wrangler.jsonc"), JSON.stringify(config));
  const script = resolve(applicationRoot, "scripts/check-job-delivery.mjs");
  expect((await run(process.execPath, [script, "local"], { cwd: temporary })).stdout).toBe("JOB_CONFIGURATION_VALID\n");
  delete config.queues.consumers[0].dead_letter_queue;
  await writeFile(resolve(temporary, "wrangler.jsonc"), JSON.stringify(config));
  await expect(run(process.execPath, [script, "local"], { cwd: temporary })).rejects.toMatchObject({ code: 1 });
});


it("characterizes acknowledged-message redelivery after a later batch throw on the generated pins", async () => {
  await enqueue();
  const response = await harness.getWorker("jobs-local").fetch("/__synthetic-jobs/raw", {
    method: "POST", body: JSON.stringify({ syntheticBatchFailure: true }),
  });
  expect(response.status).toBe(202);
  await expect.poll(async () => (await state()).observations.length, { timeout: 25_000 }).toBe(2);
  // Cloudflare documents no redelivery after ack. This is negative local
  // characterization, not a pass of that documented production guarantee.
  expect((await state()).observations.map(({ attempt }) => attempt)).toEqual([1, 2]);
  expect((await state()).values[operationId]).toBe(1);
});


it.each(["missing", "duplicate", "validator-failure"])("retains accepted work through native exhaustion after %s handler configuration and recovers after repair", async (handlerState) => {
  await enqueue();
  const web = harness.getWorker("jobs-local");
  const setHandlers = (value: string) => web.fetch("/__synthetic-jobs/handlers", { method: "POST", body: JSON.stringify(value) });
  expect((await setHandlers(handlerState)).status).toBe(204);
  await expect.poll(async () => (await state()).terminals.length, { timeout: 80_000, interval: 100 }).toBe(1);
  const result = await state();
  expect(result.observations).toEqual([]);
  expect(result.terminals).toEqual([job()]);
  expect(result.values).toEqual({});
  expect((await web.fetch("/__synthetic-jobs/recovery")).status).toBe(422);
  expect((await setHandlers("normal")).status).toBe(204);
  const recovery = await web.fetch("/__synthetic-jobs/recovery");
  expect(await recovery.json()).toEqual(job());
  await replayTerminalWithOperator();
  await completed();
  expect((await state()).terminals).toEqual([]);
  // A separate duplicate delivery still reaches the real consumer; its logical
  // effect converges under the original identity after operator replay.
  await enqueue();
  await expect.poll(async () => (await state()).observations.length, { timeout: 20_000 }).toBe(2);
  expect((await state()).values[operationId]).toBe(1);
}, 90_000);


async function replayTerminalWithOperator() {
  const configuration = JSON.parse(await readFile("wrangler.jsonc", "utf8"));
  const directory = await realpath(await mkdtemp(resolve(root, "operator-replay-")));
  const store = await createPrivateStore(directory);
  const scope = { environment: "local", accountId: "a".repeat(32),
    primary: { id: "b".repeat(32), name: configuration.vars.JOB_QUEUE_NAME },
    deadLetter: { id: "c".repeat(32), name: configuration.vars.JOB_DEAD_LETTER_QUEUE_NAME },
    consumer: { id: "d".repeat(32), scriptName: configuration.name }, revision: "e".repeat(40),
    registryDigest: "f".repeat(64), deployedCompatibilityReviewed: true };
  const handlers: readonly JobDefinition[] = [{ type: "synthetic", version: 1, repeatSafety: "monotonic",
    validate: (payload) => Object.keys(payload).sort().join() === "action,sequence" && payload.action === "complete" && Number.isSafeInteger(payload.sequence),
    handle: () => Effect.void }];
  const context = { configuration, revision: scope.revision, registryDigest: scope.registryDigest, handlers };
  const observedAt = Date.now(); const source = (await state()).terminals[0];
  const message = { id: "synthetic-terminal", ref: "synthetic-terminal-0", body: JSON.stringify(source), timestamp_ms: observedAt, attempts: 4 };
  const transport = {
    async resource(id: string) {
      const primary = id === scope.primary.id;
      return { queue_id: id, queue_name: primary ? scope.primary.name : scope.deadLetter.name,
        settings: { message_retention_period: 86400, delivery_paused: false, delivery_delay: 0 }, consumers_total_count: primary ? 1 : 0,
        consumers: primary ? [{ consumer_id: scope.consumer.id, script_name: scope.consumer.scriptName, type: "worker", dead_letter_queue: scope.deadLetter.name,
          settings: { batch_size: 10, max_retries: 3, max_wait_time_ms: 5000, retry_delay: 5 } }] : [] };
    },
    async peek() { return (await state()).terminals.length ? [message] : []; },
    async send(envelope: unknown) {
      const response = await web.fetch("/__synthetic-jobs/enqueue", { method: "POST", body: JSON.stringify({ job: envelope }) });
      if (response.status !== 202) throw new Error("SYNTHETIC_ACCEPTANCE_FAILED");
      expect(await response.json()).toEqual({ status: "accepted", operationId });
    },
    async remove(ref: string) {
      const response = await web.fetch("/__synthetic-jobs/remove-terminal", { method: "POST", body: JSON.stringify({ ref }) });
      if (response.status !== 204) throw new Error("SYNTHETIC_REMOVAL_FAILED");
    },
  };
  const web = harness.getWorker("jobs-local");
  const common = { version: 1, authorized: true, scope, issuedAt: observedAt, expiresAt: observedAt + 60_000,
    bounds: { maxMessages: 1, maxRequests: 20, maxDurationMs: 30_000, observations: 2, intervalMs: 10 }, priorEffectsReconciled: true };
  await runOperator({ request: { ...common, command: "plan-replay", selection: [{ messageId: message.id, originalRetentionDeadline: observedAt + 60_000 }] }, context, policy: operatorPolicy, transport, store });
  const plan = await store.read("plan.json");
  expect(plan.entries[0].envelope).toEqual(job());
  const request = { ...common, command: "replay", approvalFingerprint: plan.fingerprint };
  expect((await runOperator({ request, context, policy: operatorPolicy, transport, store })).outcome).toBe("replayed");
  await expect(runOperator({ request, context, policy: operatorPolicy, transport, store })).rejects.toThrow("job-run-complete");
}
