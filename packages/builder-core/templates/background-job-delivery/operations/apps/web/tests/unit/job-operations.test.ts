import { mkdtemp, chmod, symlink, writeFile, realpath, rm, mkdir, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Effect } from "effect";
import { afterAll, expect, it } from "vitest";
import * as policy from "@/src/infrastructure/cloudflare/job-operations";
import type { JobDefinition } from "@/src/application/job-delivery";

const scriptPath = "../../scripts/job-operator.mjs";
const { runOperator, createPrivateStore, createCloudflareTransport, readPrivateJson, validatePrivatePaths } = await import(scriptPath);
const directories: string[] = [];
afterAll(async () => { for (const directory of directories) await rm(directory, { recursive: true, force: true }); });
const now = 1_800_000_000_000;
const operationId = "00000000-0000-4000-8000-000000000001";
const handlers: readonly JobDefinition[] = [{ type: "synthetic", version: 1, repeatSafety: "monotonic",
  validate: (payload) => Object.keys(payload).join() === "sequence" && Number.isSafeInteger(payload.sequence),
  handle: () => Effect.void,
}];
const scope = { environment: "staging", accountId: "a".repeat(32),
  primary: { id: "b".repeat(32), name: "synthetic-jobs-staging" },
  deadLetter: { id: "c".repeat(32), name: "synthetic-jobs-staging-dead" },
  consumer: { id: "d".repeat(32), scriptName: "synthetic-staging" },
  revision: "e".repeat(40), registryDigest: "f".repeat(64), deployedCompatibilityReviewed: true,
};
const configuration = { main: "worker.mjs", env: { staging: { name: scope.consumer.scriptName,
  vars: { JOB_ENVIRONMENT: "staging", JOB_QUEUE_NAME: scope.primary.name, JOB_DEAD_LETTER_QUEUE_NAME: scope.deadLetter.name },
  queues: { producers: [{ binding: "JOB_QUEUE", queue: scope.primary.name }, { binding: "JOB_DEAD_LETTER_QUEUE", queue: scope.deadLetter.name }],
    consumers: [{ queue: scope.primary.name, dead_letter_queue: scope.deadLetter.name, max_retries: 3, max_batch_size: 10, max_batch_timeout: 5, retry_delay: 5 }] },
} } };
const context = { revision: scope.revision, registryDigest: scope.registryDigest, configuration, handlers };
const job = { version: 1, environment: "staging", operationId, jobType: "synthetic", jobVersion: 1, payload: { sequence: 3 } };
const message = { id: "source-message", ref: "SYNTHETIC_PRIVATE_REF", body: JSON.stringify(job), timestamp_ms: now - 1000, attempts: 4 };
const request = (command: string, extra = {}) => ({ version: 1, command, authorized: true, scope,
  issuedAt: now - 100, expiresAt: now + 60_000,
  bounds: { maxMessages: 5, maxRequests: 20, maxDurationMs: 30_000, observations: 3, intervalMs: 10 }, ...extra });
function resources() { return [
  { queue_id: scope.primary.id, queue_name: scope.primary.name, settings: { message_retention_period: 86400, delivery_paused: false, delivery_delay: 0 },
    consumers_total_count: 1, consumers: [{ consumer_id: scope.consumer.id, script_name: scope.consumer.scriptName, type: "worker", dead_letter_queue: scope.deadLetter.name,
      settings: { batch_size: 10, max_retries: 3, max_wait_time_ms: 5000, retry_delay: 5 } }] },
  { queue_id: scope.deadLetter.id, queue_name: scope.deadLetter.name, settings: { message_retention_period: 86400 }, consumers_total_count: 0, consumers: [] },
]; }
async function setup() {
  const directory = await realpath(await mkdtemp(resolve(tmpdir(), "job-operator-unit-")));
  directories.push(directory);
  await chmod(directory, 0o700);
  const store = await createPrivateStore(directory);
  const sent: unknown[] = []; const removed: string[] = []; const calls: string[] = [];
  const transport = { async resource(id: string) { calls.push("resource"); return resources().find((item) => item.queue_id === id); },
    async peek() { calls.push("peek"); return [message]; },
    async send(envelope: unknown) { calls.push("send"); sent.push(envelope); },
    async remove(ref: string) { calls.push("remove"); removed.push(ref); },
    async metrics() { calls.push("metrics"); return { backlog_count: 0, backlog_bytes: 0, oldest_message_timestamp_ms: 0 }; },
  };
  const run = (input: unknown, overrides = {}) => runOperator({ request: input, context, policy, transport, store, now: () => now, sleep: async () => {}, ...overrides });
  const plan = async () => { await run(request("plan-replay", { selection: [{ messageId: message.id, originalRetentionDeadline: now + 40_000 }], priorEffectsReconciled: true })); return await store.read("plan.json"); };
  return { directory, store, transport, calls, sent, removed, run, plan };
}

it("requires explicit authority and matching current environment, revision and resource identities before provider access", async () => {
  for (const invalid of [request("inspect", { authorized: false }), request("inspect", { expiresAt: now }),
    request("inspect", { scope: { ...scope, environment: "production" } }), request("inspect", { scope: { ...scope, revision: "0".repeat(40) } }),
    request("inspect", { scope: { ...scope, registryDigest: "0".repeat(64) } })]) {
    const task = await setup();
    await expect(task.run(invalid)).rejects.toThrow(); expect(task.calls).toEqual([]);
  }
});

it("inspects without leasing and records bodies only in a private bounded snapshot", async () => {
  const task = await setup(); const result = await task.run(request("inspect"));
  expect(result.outcome).toBe("inspected"); expect(task.calls).toEqual(["resource", "resource", "peek"]);
  expect((await task.store.read("inspection.json")).messages).toEqual([message]);
  expect(JSON.stringify(result)).not.toContain(operationId); expect(task.sent).toEqual([]); expect(task.removed).toEqual([]);
});

it("replays the exact validated original identity and removes only its selected source after durable acceptance", async () => {
  const task = await setup(); const plan = await task.plan();
  const result = await task.run(request("replay", { approvalFingerprint: plan.fingerprint, priorEffectsReconciled: true }));
  expect(task.sent).toEqual([job]); expect(task.removed).toEqual([message.ref]); expect(result.outcome).toBe("replayed");
  expect((await task.store.read("checkpoint.json")).entries.map((entry: { stage: string }) => entry.stage)).toEqual(["removed"]);
  await expect(task.run(request("replay", { approvalFingerprint: plan.fingerprint, priorEffectsReconciled: true }))).rejects.toThrow("job-run-complete");
  expect(task.sent).toEqual([job]);
});

it.each(["send", "remove"] as const)("stops after uncertain %s and refuses automatic repetition", async (effect) => {
  const task = await setup(); const plan = await task.plan();
  task.transport[effect] = async () => { throw new Error("SYNTHETIC_PRIVATE_BODY_TOKEN"); };
  const input = request("replay", { approvalFingerprint: plan.fingerprint, priorEffectsReconciled: true });
  const result = await task.run(input);
  expect(result.outcome).toBe("unknown");
  const checkpoint = await task.store.read("checkpoint.json");
  expect(checkpoint.entries[0].stage).toBe(effect === "send" ? "send-started" : "removal-started");
  const callCount = task.calls.length;
  await expect(task.run(input)).rejects.toThrow("job-reconciliation-required");
  expect(task.calls.length).toBe(callCount);
  expect(JSON.stringify(result)).not.toMatch(/SYNTHETIC_PRIVATE|source-message|aaaaaaa/);
});

it("resumes accepted sends by removing the original DLQ copy without sending again", async () => {
  const task = await setup(); const plan = await task.plan();
  await task.store.write("checkpoint.json", { version: 1, fingerprint: plan.fingerprint, complete: false,
    entries: [{ messageHash: policy.fingerprint(message.id), stage: "send-accepted" }] });
  expect((await task.run(request("replay", { approvalFingerprint: plan.fingerprint, priorEffectsReconciled: true }))).outcome).toBe("replayed");
  expect(task.sent).toEqual([]); expect(task.removed).toEqual([message.ref]);
});

it("makes no external effect when the pre-effect checkpoint cannot be written", async () => {
  const task = await setup(); const plan = await task.plan();
  await symlink(resolve(task.directory, "plan.json"), resolve(task.directory, "checkpoint.json"));
  await expect(task.run(request("replay", { approvalFingerprint: plan.fingerprint, priorEffectsReconciled: true }))).rejects.toThrow();
  expect(task.sent).toEqual([]); expect(task.removed).toEqual([]);
});

it("refuses altered plans, absent selection, incompatible handlers and expired original retention", async () => {
  for (const changed of [ { selection: [{ messageId: "absent", originalRetentionDeadline: now + 40_000 }] },
    { selection: [{ messageId: message.id, originalRetentionDeadline: now }] }, { priorEffectsReconciled: false } ]) {
    const task = await setup();
    await expect(task.run(request("plan-replay", { selection: [{ messageId: message.id, originalRetentionDeadline: now + 40_000 }], priorEffectsReconciled: true, ...changed }))).rejects.toThrow();
    expect(task.sent).toEqual([]);
  }
  const task = await setup(); const plan = await task.plan(); plan.entries[0].envelope.payload.sequence = 4;
  await task.store.write("plan.json", plan);
  await expect(task.run(request("replay", { approvalFingerprint: plan.fingerprint, priorEffectsReconciled: true }))).rejects.toThrow();
  const other = await setup(); await expect(other.run(request("plan-replay", { selection: [{ messageId: message.id, originalRetentionDeadline: now + 40_000 }], priorEffectsReconciled: true }), { context: { ...context, handlers: [] } })).rejects.toThrow();
});

it("refuses changed remote retention, missing resources, a different consumer and a consumed DLQ", async () => {
  for (const change of [(items: ReturnType<typeof resources>) => { items[0]!.settings.message_retention_period = 172800; },
    (items: ReturnType<typeof resources>) => { items[0]!.consumers[0]!.script_name = "other"; },
    (items: ReturnType<typeof resources>) => { items[1]!.consumers_total_count = 1; },
    (items: ReturnType<typeof resources>) => { items.pop(); }]) {
    const task = await setup(); const items = resources(); change(items);
    task.transport.resource = async (id: string) => items.find((item) => item.queue_id === id);
    await expect(task.run(request("inspect"))).rejects.toThrow(); expect(task.sent).toEqual([]);
  }
});

it("reports only observed quiescence, partial backlog or unknown observations while leaving the native consumer intact", async () => {
  const task = await setup(); expect((await task.run(request("drain", { producersStopped: true }))).outcome).toBe("observed-quiescent");
  task.transport.metrics = async () => ({ backlog_count: 2, backlog_bytes: 50, oldest_message_timestamp_ms: now - 1000 });
  expect((await task.run(request("drain", { producersStopped: true }))).outcome).toBe("partial");
  task.transport.metrics = async () => { throw new Error("private"); };
  expect((await task.run(request("drain", { producersStopped: true }))).outcome).toBe("unknown");
  expect(task.sent).toEqual([]); expect(task.removed).toEqual([]);
});

it("rejects public or symlinked private inputs and concurrent access", async () => {
  const task = await setup(); const file = resolve(task.directory, "input.json");
  await writeFile(file, "{}", { mode: 0o644 }); await expect(readPrivateJson(file)).rejects.toThrow();
  await chmod(file, 0o600); await symlink(file, resolve(task.directory, "link.json"));
  await expect(readPrivateJson(resolve(task.directory, "link.json"))).rejects.toThrow();
  const release = await task.store.lock(); await expect(task.store.lock()).rejects.toThrow(); await release();
});

it("uses fixed HTTPS endpoints, denies redirects and rejects per-reference purge warnings", async () => {
  const requests: { url: string; init: RequestInit }[] = [];
  const fetcher = async (url: string, init: RequestInit) => { requests.push({ url, init }); return Response.json({ success: true, errors: [], result: { errors: [], warnings: { secretRef: "private" } } }); };
  const transport = createCloudflareTransport({ scope, token: "synthetic-token", fetch: fetcher, deadline: () => now + 1000, now: () => now });
  await expect(transport.remove(message.ref)).rejects.toThrow("job-provider-unknown");
  expect(requests[0]?.url).toBe(`https://api.cloudflare.com/client/v4/accounts/${scope.accountId}/queues/${scope.deadLetter.id}/messages/purge`);
  expect(requests[0]?.init.redirect).toBe("error");
  expect(JSON.parse(requests[0]?.init.body as string)).toEqual({ refs: [{ ref: message.ref }] });
});


it("bounds partial replay and resumes only the remaining source selection", async () => {
  const task = await setup();
  const secondJob = { ...job, operationId: "00000000-0000-4000-8000-000000000002" };
  const second = { ...message, id: "source-second", ref: "SYNTHETIC_SECOND_REF", body: JSON.stringify(secondJob) };
  task.transport.peek = async () => [message, second];
  const bounds = { ...request("inspect").bounds, maxRequests: 9 };
  await task.run(request("plan-replay", { bounds, priorEffectsReconciled: true, selection: [message, second].map((item) => ({ messageId: item.id, originalRetentionDeadline: now + 40_000 })) }));
  const plan = await task.store.read("plan.json");
  const input = request("replay", { bounds, priorEffectsReconciled: true, approvalFingerprint: plan.fingerprint });
  expect((await task.run(input)).outcome).toBe("partial");
  expect(task.sent).toEqual([job]); expect(task.removed).toEqual([message.ref]);
  expect((await task.run(input)).outcome).toBe("replayed");
  expect(task.sent).toEqual([job, secondJob]); expect(task.removed).toEqual([message.ref, second.ref]);
});

it("stops interrupted work before send and preserves safe prepared resumption", async () => {
  const task = await setup(); const plan = await task.plan(); let interrupted = false;
  task.transport.peek = async () => { interrupted = true; return [message]; };
  const input = request("replay", { priorEffectsReconciled: true, approvalFingerprint: plan.fingerprint });
  expect((await task.run(input, { interrupted: () => interrupted })).outcome).toBe("partial");
  expect(task.sent).toEqual([]); expect(task.removed).toEqual([]);
  expect((await task.store.read("checkpoint.json")).entries[0].stage).toBe("prepared");
  task.transport.peek = async () => [message];
  expect((await task.run(input)).outcome).toBe("replayed");
});

it("retains uncertainty when durable acceptance cannot be recorded after sending", async () => {
  const task = await setup(); const plan = await task.plan();
  const write = task.store.write; let writesUnavailable = false;
  // Root can bypass filesystem modes; make subsequent writes fail independently of privileges.
  task.store.write = async (name: string, value: unknown, exclusive = false) => {
    if (writesUnavailable) throw new Error("synthetic-storage-unavailable");
    await write(name, value, exclusive);
  };
  task.transport.send = async (envelope: unknown) => { task.sent.push(envelope); writesUnavailable = true; };
  const input = request("replay", { priorEffectsReconciled: true, approvalFingerprint: plan.fingerprint });
  try { await expect(task.run(input)).rejects.toThrow(); }
  finally { writesUnavailable = false; }
  expect(task.sent).toEqual([job]); expect(task.removed).toEqual([]);
  expect((await task.store.read("checkpoint.json")).entries[0].stage).toBe("send-started");
  const callCount = task.calls.length;
  await expect(task.run(input)).rejects.toThrow("job-reconciliation-required");
  expect(task.calls.length).toBe(callCount);
});

it("does not mistake one empty observation before delayed or in-flight work for completion", async () => {
  const task = await setup(); const counts = [0, 1, 0];
  task.transport.metrics = async () => { const count = counts.shift()!; return { backlog_count: count, backlog_bytes: count * 5, oldest_message_timestamp_ms: count ? now - 10 : 0 }; };
  expect((await task.run(request("drain", { producersStopped: true }))).outcome).toBe("partial");
  task.transport.metrics = async () => ({ backlog_count: 0, backlog_bytes: 0, oldest_message_timestamp_ms: -1 });
  expect((await task.run(request("drain", { producersStopped: true }))).outcome).toBe("unknown");
});

it("rejects oversize provider bodies, failed status and resource-changing redirects", async () => {
  for (const response of [new Response("x", { status: 302, headers: { location: "https://example.invalid/private" } }),
    new Response("x".repeat(1_048_577)), Response.json({ success: true, errors: [{ message: "secret" }], result: {} })]) {
    const transport = createCloudflareTransport({ scope, token: "synthetic-token", fetch: async () => response, deadline: () => now + 1000, now: () => now });
    await expect(transport.peek(5)).rejects.toThrow("job-provider-unknown");
  }
});

it("loads real nested alias imports on pinned native Node and refuses unsupported registry imports before transport", async () => {
  const directory = await realpath(await mkdtemp(resolve(tmpdir(), "job-registry-native-"))); directories.push(directory);
  await mkdir(resolve(directory, "src/application/nested"), { recursive: true });
  await mkdir(resolve(directory, "scripts"));
  await writeFile(resolve(directory, "package.json"), JSON.stringify({ type: "module" }));
  await symlink(resolve(process.cwd(), "node_modules"), resolve(directory, "node_modules"));
  for (const path of ["src/application/job-delivery.ts", "src/infrastructure/cloudflare/job-operations.ts", "scripts/job-operator.mjs"]) { await mkdir(resolve(directory, path, ".."), { recursive: true }); await copyFile(resolve(process.cwd(), path), resolve(directory, path)); }
  await writeFile(resolve(directory, "src/application/nested/payload.ts"), 'export const acceptable = (value: unknown): boolean => value === 3;');
  await writeFile(resolve(directory, "src/application/nested/handler.ts"), [
    'import { Effect } from "effect";', 'import { acceptable } from "@/src/application/nested/payload";',
    'import type { JobDefinition } from "@/src/application/job-delivery";',
    'export const handler: JobDefinition = { type: "synthetic", version: 1, repeatSafety: "monotonic", validate: (payload) => acceptable(payload.sequence), handle: () => Effect.void };',
  ].join("\n"));
  await writeFile(resolve(directory, "src/application/job-handlers.ts"), 'import { handler } from "@/src/application/nested/handler"; export const jobHandlers = [handler];');
  const run = promisify(execFile);
  const program = 'const { loadApplication } = await import("./scripts/job-operator.mjs"); try { const loaded = await loadApplication(process.cwd()); const data = JSON.parse(process.argv[1]); const plan = loaded.policy.buildReplayPlan(data.request, [data.message], loaded.handlers, data.now); console.log(JSON.stringify({ envelope: plan.entries[0].envelope, digest: loaded.registryDigest })); } catch (error) { console.log(error.message); process.exitCode = 1; }';
  const args = ["--input-type=module", "-e", program, JSON.stringify({ request: request("plan-replay", { priorEffectsReconciled: true, selection: [{ messageId: message.id, originalRetentionDeadline: now + 40_000 }] }), message, now })];
  // Application-specific ProcessEnv augmentations do not describe this isolated child.
  const options = { cwd: directory, env: { PATH: process.env.PATH, NODE_ENV: "test" } as unknown as NodeJS.ProcessEnv, timeout: 10_000 };
  const result = JSON.parse((await run(process.execPath, args, options)).stdout);
  expect(result.envelope).toEqual(job); expect(result.digest).toMatch(/^[a-f0-9]{64}$/u);
  await writeFile(resolve(directory, "src/application/job-handlers.ts"), 'import "server-only"; export const jobHandlers = [];');
  await expect(run(process.execPath, args, options)).rejects.toMatchObject({ code: 1, stdout: "job-registry-unsupported\n" });
});


it("refuses a full audit before any new provider operation", async () => {
  const task = await setup();
  await task.store.write("audit.json", Array.from({ length: 128 }, () => ({ version: 1, outcome: "inspected" })));
  await expect(task.run(request("inspect"))).rejects.toThrow("job-audit-full");
  expect(task.calls).toEqual([]);
});

it("does not remove a source when the remote consumer changes after send acceptance", async () => {
  const task = await setup(); const plan = await task.plan();
  task.transport.send = async (envelope: unknown) => {
    task.sent.push(envelope); const changed = resources(); changed[0]!.consumers[0]!.script_name = "changed";
    task.transport.resource = async (id: string) => changed.find((item) => item.queue_id === id);
  };
  const result = await task.run(request("replay", { priorEffectsReconciled: true, approvalFingerprint: plan.fingerprint }));
  expect(result.outcome).toBe("unknown"); expect(task.sent).toEqual([job]); expect(task.removed).toEqual([]);
  expect((await task.store.read("checkpoint.json")).entries[0].stage).toBe("send-accepted");
});

it("keeps command refusals free of rejected input, ambient synthetic credentials and raw errors", async () => {
  const task = await setup(); const input = resolve(task.directory, "request.json");
  await writeFile(input, JSON.stringify({ command: "inspect", authorized: false, private: "SYNTHETIC_PRIVATE_BODY" }), { mode: 0o600 });
  // Keep this child isolated even when Wrangler adds required application bindings to ProcessEnv.
  await expect(promisify(execFile)(process.execPath, [resolve(process.cwd(), "scripts/job-operator.mjs"), "inspect", "--request", input,
    "--directory", task.directory, "--token-file", resolve(task.directory, "absent-token.json")],
  { env: { PATH: process.env.PATH, NODE_ENV: "test", CLOUDFLARE_API_TOKEN: "SYNTHETIC_AMBIENT_SECRET" } as unknown as NodeJS.ProcessEnv, timeout: 10_000 })).rejects.toMatchObject({
    code: 1, stdout: '{"version":1,"outcome":"refused","code":"job-operator-refused"}\n', stderr: "",
  });
});


it("accepts a rotated fresh peek reference while removing only the approved original reference", async () => {
  const task = await setup(); const plan = await task.plan();
  task.transport.peek = async () => [{ ...message, ref: "SYNTHETIC_ROTATED_REF" }];
  const result = await task.run(request("replay", { priorEffectsReconciled: true, approvalFingerprint: plan.fingerprint }));
  expect(result.outcome).toBe("replayed"); expect(task.sent).toEqual([job]); expect(task.removed).toEqual([message.ref]);
});


it("requires run directory, request and token inputs all outside the whole repository", async () => {
  const task = await setup(); const repository = resolve(task.directory, "repository");
  const application = resolve(repository, "apps/web"); await mkdir(application, { recursive: true });
  const external = resolve(task.directory, "external.json"); await writeFile(external, "{}", { mode: 0o600 });
  const inside = resolve(repository, "private.json"); await writeFile(inside, "{}", { mode: 0o600 });
  for (const paths of [[repository, external, external], [task.directory, inside, external], [task.directory, external, inside]]) {
    await expect(validatePrivatePaths(repository, paths)).rejects.toThrow("job-private-path-invalid");
  }
  await expect(validatePrivatePaths(repository, [task.directory, external, external])).resolves.toBeUndefined();
});


it.each([
  ["send", "peek", "approval"], ["send", "resources", "approval"], ["send", "checkpoint", "approval"],
  ["remove", "resources", "approval"], ["remove", "checkpoint", "approval"],
  ["send", "peek", "retention"], ["send", "resources", "retention"], ["send", "checkpoint", "retention"],
  ["remove", "resources", "retention"], ["remove", "checkpoint", "retention"],
] as const)("stops %s when %s crosses the approved %s deadline", async (effect, boundary, expirySource) => {
  const task = await setup(); let currentTime = now;
  await task.run(request("plan-replay", { expiresAt: now + (expirySource === "approval" ? 1_000 : 60_000),
    selection: [{ messageId: message.id, originalRetentionDeadline: now + (expirySource === "retention" ? 1_000 : 40_000) }],
    priorEffectsReconciled: true }));
  const plan = await task.store.read("plan.json");
  expect(plan.expiresAt).toBe(now + 1_000);
  if (effect === "remove") await task.store.write("checkpoint.json", { version: 1, fingerprint: plan.fingerprint, complete: false,
    entries: [{ messageHash: policy.fingerprint(message.id), stage: "send-accepted" }] });
  const resource = task.transport.resource; let resourceReads = 0;
  task.transport.resource = async (id: string) => {
    const result = await resource(id); resourceReads += 1;
    if (boundary === "resources" && resourceReads === (effect === "send" ? 4 : 6)) currentTime = plan.expiresAt;
    return result;
  };
  task.transport.peek = async () => { if (boundary === "peek") currentTime = plan.expiresAt; return [message]; };
  const startedStage = effect === "send" ? "send-started" : "removal-started";
  const store = { ...task.store, write: async (name: string, value: unknown, exclusive = false) => {
    await task.store.write(name, value, exclusive);
    if (boundary === "checkpoint" && name === "checkpoint.json" && (value as policy.ReplayCheckpoint).entries[0]?.stage === startedStage) currentTime = plan.expiresAt;
  } };
  const input = request("replay", { approvalFingerprint: plan.fingerprint, priorEffectsReconciled: true });
  const result = await task.run(input, { store, now: () => currentTime });
  expect(task.sent).toEqual([]); expect(task.removed).toEqual([]);
  expect(result.outcome).toBe(boundary === "checkpoint" ? "unknown" : "partial");
  const checkpoint = await task.store.read("checkpoint.json");
  expect(checkpoint.entries[0].stage).toBe(boundary === "checkpoint" ? startedStage : effect === "send" ? "prepared" : "send-accepted");
  if (boundary === "checkpoint") {
    // Even if a later clock reading is earlier, persisted uncertainty cannot
    // permit an automatic repeat of the planned external mutation.
    const calls = task.calls.length;
    await expect(task.run(input)).rejects.toThrow("job-reconciliation-required");
    expect(task.calls.length).toBe(calls);
  }
});

it("never starts native transport mutations at the approved cutoff", async () => {
  let requests = 0;
  const transport = createCloudflareTransport({ scope, token: "synthetic-token", deadline: () => now,
    now: () => now, fetch: async () => { requests += 1; return Response.json({ success: true, errors: [], result: {} }); } });
  await expect(transport.send(job)).rejects.toThrow("job-operation-bounded");
  await expect(transport.remove(message.ref)).rejects.toThrow("job-operation-bounded");
  expect(requests).toBe(0);
});
