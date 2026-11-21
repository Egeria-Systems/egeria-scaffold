import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { promisify } from "node:util";
import { backgroundJobFiles } from "../../dist/catalog/capability-catalog.js";
import { createOwnedTemporaryDirectory, snapshotSourceTree, sourceIdentityMatches, sourceTreesEqual } from "../../dist/generation/source-tree-safety.js";
import { derivePnpmToolEnvironment } from "../../dist/generation/verify-generated-project.js";

const runFile = promisify(execFile);
const omittedCopyEntries = new Set([".git", "node_modules", ".next", ".open-next", ".wrangler", "dist", "coverage", "test-results", "playwright-report"]);
const fingerprint = bytes => createHash("sha256").update(bytes).digest("hex");
const manifest = snapshot => [...snapshot].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
  .map(([path, entry]) => ({ path, ...entry }));

async function snapshot(root) {
  const result = await snapshotSourceTree(root);
  assert.notEqual(result, undefined, "Synthetic fixture source must remain a regular, identity-stable tree");
  return result;
}

async function sourceCopy(generatedRoot, parent, prefix) {
  const generatedSnapshot = await snapshot(generatedRoot);
  const made = await createOwnedTemporaryDirectory(parent, prefix);
  assert.equal(made.ok, true);
  const root = join(made.value.path, "project");
  await cp(generatedRoot, root, { recursive: true, errorOnExist: true, force: false,
    filter: source => !omittedCopyEntries.has(basename(source)) });
  assert.equal(await sourceIdentityMatches(made.value), true);
  assert.equal(sourceTreesEqual(generatedSnapshot, await snapshot(generatedRoot)), true);
  return { root, owner: made.value, generatedRoot, generatedSnapshot };
}

async function authorFixture(fixture, sources) {
  for (const [path, source] of sources) {
    const destination = join(fixture.root, "apps/web", path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, source);
  }
  fixture.sourceSnapshot = await snapshot(fixture.root);
  await assertCompositionSourcePreserved(fixture);
  await writeFile(join(fixture.owner.path, "source-manifests.json"), JSON.stringify({
    generatedRoot: fixture.generatedRoot,
    extensionRoot: fixture.root,
    generationReceiptScope: "unchanged generated source only; extension requires independent prepared verification",
    authoredPaths: sources.map(([path]) => `apps/web/${path}`),
    generated: manifest(fixture.generatedSnapshot),
    extension: manifest(fixture.sourceSnapshot),
  }, null, 2), { flag: "wx", mode: 0o600 });
  return fixture;
}

export async function assertCompositionSourcePreserved(fixture) {
  assert.equal(await sourceIdentityMatches(fixture.owner), true);
  assert.equal(sourceTreesEqual(fixture.generatedSnapshot, await snapshot(fixture.generatedRoot)), true,
    "The successful generation receipt must remain attached to its original bytes");
  assert.equal(sourceTreesEqual(fixture.sourceSnapshot, await snapshot(fixture.root)), true,
    "Prepared verification must not mutate its extension source");
}

export async function createJobCompositionFixture({ generatedRoot, parent, selection }) {
  const email = selection.transactionalEmailResend === true;
  // One combined interaction suffices; other persistence lanes retain their
  // existing binding checks without inventing another database workflow.
  const persistence = email && selection.applicationPersistence === true;
  const fixture = await sourceCopy(generatedRoot, parent, "job-composition-");
  const sources = [
    ["src/application/job-handlers.ts", jobHandlersSource(email, persistence)],
    ["src/application/synthetic-composition-observation.ts", observationSource],
    ["src/composition/job-handler-composition.ts", compositionSource(email, persistence)],
    ["tests/integration/composed-job-worker.test.ts", workerTestSource(email, persistence)],
    ["tests/integration/fixtures/composition-dlq-observer.mjs", observerSource],
  ];
  if (email) sources.push(["tests/unit/composed-services.test.ts", concurrentServicesSource(persistence)],
    ["tests/types/email-requirement.ts", emailRequirementSource]);
  if (persistence) sources.push(["src/application/synthetic-composition-persistence.ts", persistencePortSource],
    ["src/infrastructure/cloudflare/synthetic-composition-persistence.ts", persistenceAdapterSource]);
  return authorFixture(fixture, sources);
}

const observationSource = `import { Context, Effect } from "effect";
export class CompositionObservation extends Context.Service<CompositionObservation, {
  readonly record: (value: Readonly<Record<string, unknown>>) => Effect.Effect<void>;
}>()("synthetic/CompositionObservation") {}
`;

function jobHandlersSource(email, persistence) {
  return `import { Effect } from "effect";
import { JobDispatcher, JobHandlerFailure, type JobDefinition } from "@/src/application/job-delivery";
import { CompositionObservation } from "@/src/application/synthetic-composition-observation";
${email ? 'import { TransactionalEmailSender } from "@/src/application/transactional-email-sender";' : ""}
${persistence ? 'import { CompositionPersistence } from "@/src/application/synthetic-composition-persistence";' : ""}

export const jobHandlers: readonly JobDefinition<JobDispatcher | CompositionObservation${email ? " | TransactionalEmailSender" : ""}${persistence ? " | CompositionPersistence" : ""}>[] = [{
  type: "synthetic-composition", version: 1, repeatSafety: "consumer-reconciled",
  validate: payload => Object.keys(payload).length === 1 && ${JSON.stringify(email ? ["email", "dispatch", "uncertain"] : ["dispatch"])}.includes(String(payload.action)),
  handle: (job, { attempt }) => Effect.gen(function* () {
    const observation = yield* CompositionObservation;
    yield* observation.record({ action: "attempt", attempt, operationId: job.operationId, payload: job.payload });
    ${persistence ? "yield* (yield* CompositionPersistence).record(job);" : ""}
    ${email ? `if (job.payload.action !== "dispatch") {
      yield* (yield* TransactionalEmailSender).send({ to: "allowed@example.test", subject: String(job.payload.action),
        text: "SYNTHETIC_PRIVATE_BODY:" + JSON.stringify(job.payload), idempotencyKey: job.operationId })
        .pipe(Effect.mapError(error => new JobHandlerFailure(error.code === "transactional-email-validation" ||
          error.code === "transactional-email-authorization" ? "terminal" : "retry")));
    }` : ""}
    yield* (yield* JobDispatcher).dispatch({ ...job, operationId: "00000000-0000-4000-8000-000000000102",
      jobType: "synthetic-follow-up", payload: { parentOperationId: job.operationId } })
      .pipe(Effect.mapError(() => new JobHandlerFailure("retry")));
    yield* observation.record({ action: "completion", outcome: "accepted", attempt, operationId: job.operationId });
  }),
}, {
  type: "synthetic-follow-up", version: 1, repeatSafety: "idempotent",
  validate: payload => Object.keys(payload).length === 1 && typeof payload.parentOperationId === "string",
  handle: job => Effect.gen(function* () {
    ${persistence ? "yield* (yield* CompositionPersistence).record(job);" : ""}
    yield* (yield* CompositionObservation).record({ action: "follow-up", operationId: job.operationId, payload: job.payload });
  }),
}];
`;
}

const persistencePortSource = `import { Context, Effect } from "effect";
import type { JobEnvelope, JobHandlerFailure } from "@/src/application/job-delivery";
// This consuming boundary owns only the concrete synthetic operation record.
export class CompositionPersistence extends Context.Service<CompositionPersistence, {
  readonly record: (job: JobEnvelope) => Effect.Effect<void, JobHandlerFailure>;
}>()("synthetic/CompositionPersistence") {}
`;

const persistenceAdapterSource = `import type { D1Database } from "@cloudflare/workers-types";
import { Effect, Layer } from "effect";
import { JobHandlerFailure } from "@/src/application/job-delivery";
import { CompositionPersistence } from "@/src/application/synthetic-composition-persistence";
import { resolveApplicationDatabaseEnvironment } from "@/src/configuration/application-database";
import { validateRuntimeApplicationEnvironment, type ApplicationEnvironment } from "@/src/configuration/application-environment";
type Inputs = Readonly<{ environment: unknown; compiledTarget: ApplicationEnvironment;
  record: (value: Readonly<Record<string, unknown>>) => Promise<void> }>;
function database(input: Inputs): D1Database {
  const runtime = validateRuntimeApplicationEnvironment(Reflect.get(Object(input.environment), "APPLICATION_ENVIRONMENT"), input.compiledTarget);
  if (!runtime.ok || Reflect.get(Object(input.environment), "APPLICATION_DATABASE_ENVIRONMENT") !== resolveApplicationDatabaseEnvironment(runtime.value)) {
    throw new Error("SYNTHETIC_DATABASE_TARGET_REFUSED");
  }
  const binding: unknown = Reflect.get(Object(input.environment), "APP_DB");
  if (typeof binding !== "object" || binding === null || !("prepare" in binding) || typeof binding.prepare !== "function") {
    throw new Error("SYNTHETIC_DATABASE_BINDING_REFUSED");
  }
  // D1 types stay in this local Cloudflare adapter, after its shape guard.
  return binding as D1Database;
}
export function createCompositionPersistenceLayer(input: Inputs): Layer.Layer<CompositionPersistence> {
  return Layer.succeed(CompositionPersistence, { record: job => Effect.tryPromise({
    try: async () => {
      const binding = database(input);
      await input.record({ action: "sql-attempt", phase: "write", operationId: job.operationId });
      await binding.prepare("INSERT INTO persistence_fixture (id, value) VALUES (?, ?) ON CONFLICT(id) DO NOTHING")
        .bind(job.operationId, JSON.stringify({ jobType: job.jobType, payload: job.payload })).run();
    }, catch: () => new JobHandlerFailure("retry"),
  }) });
}
export async function assertCompositionOperationRecorded(input: Inputs, operationId: string, payload: unknown): Promise<void> {
  const binding = database(input);
  await input.record({ action: "sql-attempt", phase: "provider-read", operationId });
  const row = await binding.prepare("SELECT value FROM persistence_fixture WHERE id = ?").bind(operationId).first<{ value: string }>();
  if (row?.value !== JSON.stringify({ jobType: "synthetic-composition", payload })) throw new Error("SYNTHETIC_SQL_ORDER_FAILED");
}
`;

function compositionSource(email, persistence) {
  return `import { Effect, Layer } from "effect";
import { type JobDefinition } from "@/src/application/job-delivery";
import { type jobHandlers } from "@/src/application/job-handlers";
import { CompositionObservation } from "@/src/application/synthetic-composition-observation";
import { type ApplicationEnvironment, parseApplicationEnvironment } from "@/src/configuration/application-environment";
import { createCloudflareJobDispatcherLayer } from "@/src/infrastructure/cloudflare/job-delivery";
${email ? `import { createResendTransactionalEmailSenderLayer } from "@/src/infrastructure/resend/transactional-email-sender";
import { createTransactionalEmailEventReporter } from "@/src/infrastructure/observability/transactional-email-events";
// This bounded controlled provider model stores no invocation bindings. It is
// neither production deduplication nor evidence of real provider acceptance.
const providerModel = new Map<string, { attempts: number; body: string }>();` : ""}
${persistence ? 'import { createCompositionPersistenceLayer, assertCompositionOperationRecorded } from "@/src/infrastructure/cloudflare/synthetic-composition-persistence";' : ""}
export function createJobHandlers(input: Readonly<{ definitions: typeof jobHandlers; environment: unknown; compiledTarget: ApplicationEnvironment }>): readonly JobDefinition[] {
  // Constant test-only marker: target preflight must precede hook invocation.
  console.info("SYNTHETIC_COMPOSITION_ASSEMBLY");
  const record = async (value: Readonly<Record<string, unknown>>) => {
    const queue: unknown = Reflect.get(Object(input.environment), "COMPOSITION_OBSERVATIONS");
    if (typeof queue !== "object" || queue === null || !("send" in queue) || typeof queue.send !== "function") throw new Error("SYNTHETIC_OBSERVER_MISSING");
    await queue.send(value);
  };
  ${email ? `const report = createTransactionalEmailEventReporter({ compiledTarget: () => parseApplicationEnvironment(input.compiledTarget),
    runtimeTarget: () => Reflect.get(Object(input.environment), "APPLICATION_ENVIRONMENT") });
  const email = createResendTransactionalEmailSenderLayer({
    compiledTarget: () => parseApplicationEnvironment(input.compiledTarget), configuration: Effect.succeed(input.environment),
    request: async (url, init) => {
      if (String(url) !== "https://api.resend.com/emails" || init?.method !== "POST" || init.redirect !== "error") throw new Error("SYNTHETIC_EXTERNAL_BLOCK");
      const headers = new Headers(init.headers);
      const key = headers.get("Idempotency-Key") ?? "";
      const body: unknown = JSON.parse(String(init.body));
      const credentialMatches = headers.get("Authorization") === "Bearer " + String(Reflect.get(Object(input.environment), "RESEND_API_KEY"));
      const fromMatches = typeof body === "object" && body !== null && "from" in body && body.from === Reflect.get(Object(input.environment), "TRANSACTIONAL_EMAIL_FROM");
      // Bind this request to the intended invocation, not just this closure's
      // possibly stale configuration. Never include sentinel values in errors.
      if (!credentialMatches || !fromMatches || key !== Reflect.get(Object(input.environment), "COMPOSITION_EXPECTED_OPERATION_ID")) throw new Error("SYNTHETIC_EMAIL_INVOCATION_MISMATCH");
      if (typeof body !== "object" || body === null || !("subject" in body)) throw new Error("SYNTHETIC_EMAIL_BODY_INVALID");
      ${persistence ? "await assertCompositionOperationRecorded({ ...input, record }, key, { action: body.subject });" : ""}
      const providerKey = input.compiledTarget + ":" + key;
      const previous = providerModel.get(providerKey);
      if (previous !== undefined && previous.body !== String(init.body)) throw new Error("SYNTHETIC_IDEMPOTENCY_PAYLOAD_CHANGED");
      const count = (previous?.attempts ?? 0) + 1;
      providerModel.set(providerKey, { attempts: count, body: String(init.body) });
      const uncertain = body.subject === "uncertain" && count === 1;
      await record({ action: "provider", key, count, acceptances: 1, uncertain,
        target: input.compiledTarget, credentialMatches, fromMatches });
      // Never delegate to network: an ambiguous first response still models a
      // provider acceptance under the same key, followed by caller-owned retry.
      return uncertain ? Response.json({ name: "service_unavailable" }, { status: 503 }) : Response.json({ id: "synthetic-acceptance" });
    }, reportEvent: report,
  });` : ""}
  const dispatcher = createCloudflareJobDispatcherLayer({ compiledTarget: () => parseApplicationEnvironment(input.compiledTarget),
    configuration: Effect.succeed(input.environment), handlers: input.definitions });
  const observations = Layer.succeed(CompositionObservation, { record: value => Effect.promise(() => record(value)) });
  ${persistence ? "const persistence = createCompositionPersistenceLayer({ ...input, record });" : ""}
  // Layer construction and provision are lazy. Existing dependency-free test
  // handlers require no email, observation or D1 binding acquisition.
  return input.definitions.map(definition => ({ ...definition,
    handle: (job, context) => definition.handle(job, context).pipe(Effect.provide(dispatcher), Effect.provide(observations)${email ? ", Effect.provide(email)" : ""}${persistence ? ", Effect.provide(persistence)" : ""}),
  }));
}
`;
}

const observerSource = `const bodies = [], observations = [];
const observer = {
  async queue(batch) {
    for (const message of batch.messages) {
      (batch.queue.endsWith("-observations") ? observations : bodies).push(message.body);
      message.ack();
    }
  },
  async fetch() { return Response.json({ bodies, observations }); },
};
export default observer;
`;

function workerTestSource(email, persistence) {
  const modes = persistence ? ["uncertain", "missing-email", "runtime-mismatch", "database-mismatch"]
    : email ? ["email", "dispatch", "uncertain", "missing-email", "runtime-mismatch"] : ["dispatch", "runtime-mismatch"];
  return `import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createTestHarness } from "wrangler";
import { expect, it } from "vitest";
${persistence ? 'import type { D1Database } from "@cloudflare/workers-types";' : ""}

type Observation = { action: string; attempt?: number; outcome?: string; key?: string; count?: number;
  acceptances?: number; operationId?: string; payload?: unknown; uncertain?: boolean; target?: string;
  credentialMatches?: boolean; fromMatches?: boolean; phase?: string };
type ObserverState = { bodies: unknown[]; observations: Observation[] };
type Bindings = { JOB_QUEUE: { send(body: unknown, options: { contentType: "json" }): Promise<void> }${persistence ? "; APP_DB: D1Database" : ""} };
const modes: readonly string[] = ${JSON.stringify(modes)};
const operationId = "00000000-0000-4000-8000-000000000101";
const followUpId = "00000000-0000-4000-8000-000000000102";
for (const mode of modes) {
  it("Queue-first " + mode + " preserves real composed services and native delivery", async () => {
    const target = process.env.APPLICATION_ENVIRONMENT ?? "development";
    expect(["development", "staging", "production"]).toContain(target);
    const buildId = await readFile(".open-next/assets/BUILD_ID", "utf8");
    expect(buildId).toMatch(new RegExp("^egeria-" + target + "-[a-f0-9]{40}$", "u"));
    const root = await mkdtemp(resolve(tmpdir(), "composed-job-worker-"));
    const configuration = JSON.parse(await readFile("wrangler.jsonc", "utf8"));
    const installed = JSON.parse(await readFile("../../.egeria/state.json", "utf8"));
    const homePath = installed.installedCapabilities.some((item: { identifier: string }) => item.identifier === "multilingual") ? "/en-CA" : "/";
    const selected = target === "development" ? configuration : configuration.env[target];
    expect(selected.vars.APPLICATION_ENVIRONMENT).toBe(target);
    expect(selected.vars.JOB_ENVIRONMENT).toBe(target === "development" ? "local" : target);
    expect(selected.queues.consumers).toHaveLength(1);
    expect(selected.queues.consumers[0].max_retries).toBe(3);
    const webConfig = resolve(root, "web.jsonc"), observerConfig = resolve(root, "observer.jsonc");
    const vars = { ...selected.vars, COMPOSITION_EXPECTED_OPERATION_ID: operationId,
      ${email ? `RESEND_API_KEY: "re_controlled_" + target + "_" + mode.replaceAll("-", "_"),
      TRANSACTIONAL_EMAIL_FROM: "sender-" + target + "@example.test", TRANSACTIONAL_EMAIL_DOMAIN: "example.test",
      TRANSACTIONAL_EMAIL_ALLOWED_RECIPIENTS: "allowed@example.test,second@example.test",` : ""}
    };
    if (mode === "missing-email") delete vars.RESEND_API_KEY;
    if (mode === "runtime-mismatch") vars.APPLICATION_ENVIRONMENT = target === "production" ? "staging" : "production";
    if (mode === "database-mismatch") vars.APPLICATION_DATABASE_ENVIRONMENT = target === "production" ? "staging" : "production";
    const common = { ...configuration, ...selected };
    delete common.env; delete common.$schema;
    await writeFile(webConfig, JSON.stringify({ ...common, name: "composition-web", main: resolve("worker.mjs"),
      assets: { ...configuration.assets, ...selected.assets, directory: resolve(".open-next/assets") }, vars,
      ...(selected.d1_databases === undefined ? {} : { d1_databases: selected.d1_databases.map((database: Record<string, unknown>) => ({
        ...database, database_name: "composition-local", database_id: "00000000-0000-4000-8000-000000000701", remote: false,
        ${persistence ? 'migrations_dir: resolve("tests/bindings/fixtures/migrations"),' : ""}
      })) }),
      queues: { ...selected.queues, producers: [...selected.queues.producers,
        { binding: "COMPOSITION_OBSERVATIONS", queue: "composition-observations" }] },
    }), { flag: "wx", mode: 0o600 });
    await writeFile(observerConfig, JSON.stringify({ name: "composition-observer", main: resolve("tests/integration/fixtures/composition-dlq-observer.mjs"),
      compatibility_date: configuration.compatibility_date, queues: { consumers: [
        { queue: selected.vars.JOB_DEAD_LETTER_QUEUE_NAME, max_batch_size: 10, max_batch_timeout: 0.1, max_retries: 0 },
        { queue: "composition-observations", max_batch_size: 10, max_batch_timeout: 0.1, max_retries: 0 },
      ] } }), { flag: "wx", mode: 0o600 });
    const harness = createTestHarness({ root, workers: [{ configPath: webConfig, env: "" }, { configPath: observerConfig, env: "" }] });
    let passed = false;
    try {
      await harness.listen();
      const web = harness.getWorker<Bindings>("composition-web");
      ${persistence ? 'await web.applyD1Migrations("APP_DB");' : ""}
      const bindings = await web.getEnv();
      ${persistence ? `// Harness setup/readback SQL is distinct from application sql-attempt events.
      await bindings.APP_DB.prepare("INSERT INTO persistence_fixture (id, value) VALUES (?, ?)").bind("sentinel", "unchanged-sentinel").run();
      const rows = async () => (await bindings.APP_DB.prepare("SELECT id, value FROM persistence_fixture ORDER BY id").all()).results;
      const sentinel = { id: "sentinel", value: "unchanged-sentinel" };
      expect(await rows()).toEqual([sentinel]);` : ""}
      const action = mode === "dispatch" ? "dispatch" : mode === "uncertain" ? "uncertain" : ${JSON.stringify(email ? "email" : "dispatch")};
      const job = { version: 1, environment: target === "development" ? "local" : target, operationId,
        jobType: "synthetic-composition", jobVersion: 1, payload: { action } };
      // First application event: getEnv, migrations and observer HTTP do not
      // invoke application fetch. Only the observer consumes the native DLQ.
      await bindings.JOB_QUEUE.send(job, { contentType: "json" });
      let state: ObserverState = { bodies: [], observations: [] };
      const readState = async () => {
        state = await (await harness.getWorker("composition-observer").fetch("/")).json() as ObserverState;
        return state;
      };
      if (mode === "uncertain") {
        await expect.poll(async () => (await readState()).observations.filter(item => item.action === "provider").length,
          { timeout: 30_000, interval: 100 }).toBe(1);
        expect(state.observations.filter(item => item.action === "provider").map(item => item.uncertain)).toEqual([true]);
        expect(state.observations.filter(item => ["completion", "follow-up"].includes(item.action))).toEqual([]);
        ${persistence ? `expect(await rows()).toEqual([{ id: operationId, value: JSON.stringify({ jobType: job.jobType, payload: job.payload }) }, sentinel]);` : ""}
      }
      const refused = ["missing-email", "runtime-mismatch", "database-mismatch"].includes(mode);
      await expect.poll(async () => {
        await readState();
        return refused ? state.bodies.length : state.observations.filter(item => item.action === "follow-up").length;
      }, { timeout: 90_000, interval: 100 }).toBe(1);
      if (mode === "email") {
        await bindings.JOB_QUEUE.send(job, { contentType: "json" });
        await expect.poll(async () => (await readState()).observations.filter(item => item.action === "follow-up").length,
          { timeout: 30_000, interval: 100 }).toBe(2);
      }
      // Bound the count to the exercised local batch window, including any
      // immediately duplicated follow-up; this is not arbitrary scheduler proof.
      await new Promise(resolveDelay => setTimeout(resolveDelay, selected.queues.consumers[0].max_batch_timeout * 1000 + 250));
      await readState();
      const attempts = state.observations.filter(item => item.action === "attempt");
      expect(attempts.map(item => item.attempt)).toEqual(mode === "runtime-mismatch" ? []
        : refused ? [1, 2, 3, 4] : mode === "uncertain" ? [1, 2] : mode === "email" ? [1, 1] : [1]);
      expect(attempts.map(item => ({ operationId: item.operationId, payload: item.payload })))
        .toEqual(attempts.map(() => ({ operationId, payload: job.payload })));
      expect(state.bodies).toEqual(refused ? [job] : []);
      const followUps = state.observations.filter(item => item.action === "follow-up");
      expect(followUps.map(item => ({ operationId: item.operationId, payload: item.payload }))).toEqual(
        Array.from({ length: refused ? 0 : mode === "email" ? 2 : 1 }, () => ({ operationId: followUpId, payload: { parentOperationId: operationId } })));
      const providers = state.observations.filter(item => item.action === "provider");
      const providerCount = refused || mode === "dispatch" ? 0 : 2;
      expect(providers.map(item => ({ key: item.key, count: item.count, acceptances: item.acceptances,
        target: item.target, credentialMatches: item.credentialMatches, fromMatches: item.fromMatches }))).toEqual(
        Array.from({ length: providerCount }, (_, index) => ({ key: operationId, count: index + 1, acceptances: 1,
          target, credentialMatches: true, fromMatches: true })));
      const lifecycle = state.observations.filter(item => ["provider", "completion", "follow-up"].includes(item.action)).map(item => item.action);
      expect(lifecycle).toEqual(refused ? [] : mode === "dispatch" ? ["completion", "follow-up"]
        : mode === "email" ? ["provider", "completion", "follow-up", "provider", "completion", "follow-up"]
          : ["provider", "provider", "completion", "follow-up"]);
      ${persistence ? `const sql = state.observations.filter(item => item.action === "sql-attempt");
      if (mode === "runtime-mismatch" || mode === "database-mismatch") {
        expect(sql).toEqual([]);
        expect(await rows()).toEqual([sentinel]);
      } else {
        expect(sql.filter(item => item.phase === "write").map(item => item.operationId))
          .toEqual(mode === "missing-email" ? [operationId, operationId, operationId, operationId] : [operationId, operationId, followUpId]);
        expect(sql.filter(item => item.phase === "provider-read").map(item => item.operationId))
          .toEqual(mode === "missing-email" ? [] : [operationId, operationId]);
        expect(await rows()).toEqual([
          { id: operationId, value: JSON.stringify({ jobType: job.jobType, payload: job.payload }) },
          ...(refused ? [] : [{ id: followUpId, value: JSON.stringify({ jobType: "synthetic-follow-up", payload: { parentOperationId: operationId } }) }]),
          sentinel,
        ]);
      }` : ""}
      const emailLogs = () => harness.getLogs().filter(item => item.message.includes("transactional.email.send"));
      const emailCount = mode === "missing-email" ? 4 : refused || mode === "dispatch" ? 0 : 2;
      await expect.poll(() => emailLogs().length).toBe(emailCount);
      const outcomes = emailLogs().map(item => item.message.match(/outcome: '([^']+)'/u)?.[1]);
      expect(outcomes).toEqual(mode === "missing-email" ? ["failed", "failed", "failed", "failed"]
        : refused || mode === "dispatch" ? [] : mode === "uncertain" ? ["unknown", "accepted"] : ["accepted", "accepted"]);
      if (mode === "missing-email") expect(emailLogs().every(item => item.message.includes("error_code: 'transactional-email-configuration'"))).toBe(true);
      if (mode === "uncertain") expect(emailLogs()[0]?.message).toContain("error_code: 'transactional-email-acceptance-unknown'");
      expect(emailLogs().every(item => item.message.includes("environment: '" + target + "'"))).toBe(true);
      const logs = harness.getLogs().map(item => item.message).join("\\n");
      if (mode === "runtime-mismatch") {
        expect(logs).not.toContain("SYNTHETIC_COMPOSITION_ASSEMBLY");
        expect(state.observations).toEqual([]);
      } else expect(logs).toContain("SYNTHETIC_COMPOSITION_ASSEMBLY");
      expect(logs).not.toMatch(/re_controlled|allowed@example|sender-.*@example|SYNTHETIC_PRIVATE_BODY/u);
      // HTTP is checked only after all Queue, provider, persistence and log assertions.
      expect((await web.fetch(homePath)).status).toBe(200);
      expect((await web.fetch("/api/health")).status).toBe(mode === "runtime-mismatch" ? 503 : 200);
      console.log(JSON.stringify({ target, mode, firstApplicationEvent: "queue", attempts: attempts.length,
        providers: providers.length, followUps: followUps.length, lifecycle, originalNativeDlq: refused, liveProviderAccess: false }));
      passed = true;
    } finally {
      await harness.close();
      if (passed) await rm(root, { recursive: true, force: true });
      else console.error(JSON.stringify({ retainedCompositionHarness: root }));
    }
  }, 130_000);
}
`;
}

function concurrentServicesSource(persistence) {
  return `import { expect, it, vi } from "vitest";
import { jobHandlers } from "@/src/application/job-handlers";
import { createJobHandlers } from "@/src/composition/job-handler-composition";
import { runJobAttempt, type JobEnvelope } from "@/src/application/job-delivery";
const { context } = vi.hoisted(() => ({ context: vi.fn(() => { throw new Error("HTTP_CONTEXT_UNAVAILABLE"); }) }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: context }));
type Observation = { action: string; key?: string; target?: string; credentialMatches?: boolean; fromMatches?: boolean };
it("closes overlapping actual service Effects for each intended invocation without HTTP context", async () => {
  const records: Observation[][] = [[], []];
  const queues: unknown[][] = [[], []];
  const targets = ["development", "staging"] as const;
  const ids = ["00000000-0000-4000-8000-000000000201", "00000000-0000-4000-8000-000000000202"] as const;
  let release: () => void = () => {};
  const gate = new Promise<void>(resolveGate => { release = resolveGate; });
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  try {
    const invocations = targets.map((target, index) => {
      ${persistence ? `// This unit-only D1-shaped double permits the actual service Effects to
      // overlap. Only the native Worker test claims concrete local D1 behavior.
      const rows = new Map<string, string>();
      const database = { prepare: (sql: string) => ({ bind: (id: string, value?: string) => ({
        run: async () => {
          if (!sql.startsWith("INSERT") || value === undefined) throw new Error("SYNTHETIC_UNIT_SQL_INVALID");
          if (!rows.has(id)) rows.set(id, value);
        },
        first: async () => rows.has(id) ? { value: rows.get(id) } : null,
      }) }) };` : ""}
      const environment = { APPLICATION_ENVIRONMENT: target, JOB_ENVIRONMENT: target === "development" ? "local" : target,
        JOB_QUEUE_NAME: "jobs-" + target, JOB_DEAD_LETTER_QUEUE_NAME: "jobs-" + target + "-dead",
        JOB_QUEUE: { send: async (body: unknown) => { queues[index]?.push(body); } },
        JOB_DEAD_LETTER_QUEUE: { send: vi.fn(async () => {}) },
        COMPOSITION_EXPECTED_OPERATION_ID: ids[index],
        COMPOSITION_OBSERVATIONS: { send: async (body: Observation) => {
          records[index]?.push(body);
          if (body.action === "attempt") await gate;
        } },
        RESEND_API_KEY: index === 0 ? "re_controlled_first_invocation" : "re_controlled_second_invocation",
        TRANSACTIONAL_EMAIL_FROM: index === 0 ? "first-sender@example.test" : "second-sender@example.test",
        TRANSACTIONAL_EMAIL_DOMAIN: "example.test", TRANSACTIONAL_EMAIL_ALLOWED_RECIPIENTS: "allowed@example.test",
        ${persistence ? 'APPLICATION_DATABASE_ENVIRONMENT: target === "development" ? "local" : target, APP_DB: database,' : ""}
      };
      const definitions = createJobHandlers({ definitions: jobHandlers, environment, compiledTarget: target });
      const job: JobEnvelope = { version: 1, environment: target === "development" ? "local" : target,
        operationId: ids[index] ?? "", jobType: "synthetic-composition", jobVersion: 1, payload: { action: "email" } };
      return { definitions, job };
    });
    expect(records).toEqual([[], []]); expect(queues).toEqual([[], []]);
    const pending = Promise.all(invocations.map(item => runJobAttempt(item.job, item.job.environment, item.definitions, 1)));
    await expect.poll(() => records.map(items => items.filter(item => item.action === "attempt").length)).toEqual([1, 1]);
    expect(records.map(items => items.filter(item => item.action === "provider").length)).toEqual([0, 0]);
    expect(queues).toEqual([[], []]);
    release();
    expect(await pending).toMatchObject(invocations.map(() => ({ kind: "executed", decision: { outcome: "completed" } })));
    for (const [index, target] of targets.entries()) {
      expect(records[index]?.filter(item => item.action === "provider").map(item => ({ key: item.key, target: item.target,
        credentialMatches: item.credentialMatches, fromMatches: item.fromMatches })))
        .toEqual([{ key: ids[index], target, credentialMatches: true, fromMatches: true }]);
      expect(records[index]?.filter(item => ["attempt", "provider", "completion"].includes(item.action)).map(item => item.action))
        .toEqual(["attempt", "provider", "completion"]);
      expect(queues[index]).toEqual([{ version: 1, environment: target === "development" ? "local" : target,
        operationId: "00000000-0000-4000-8000-000000000102", jobType: "synthetic-follow-up", jobVersion: 1,
        payload: { parentOperationId: ids[index] } }]);
    }
    expect(context).not.toHaveBeenCalled();
    const messages = JSON.stringify(log.mock.calls);
    expect(messages).not.toMatch(/re_controlled|first-sender|second-sender|allowed@example|SYNTHETIC_PRIVATE_BODY/u);
  } finally { release(); log.mockRestore(); }
});
`;
}

const emailRequirementSource = `import { Effect, type Layer } from "effect";
import type { JobDefinition } from "@/src/application/job-delivery";
import type { TransactionalEmailSender } from "@/src/application/transactional-email-sender";
export function rejectUnprovidedEmail(definition: JobDefinition<TransactionalEmailSender>): JobDefinition {
  // @ts-expect-error A selected email service requirement must be provided.
  return definition;
}
export function provideEmail(definition: JobDefinition<TransactionalEmailSender>, layer: Layer.Layer<TransactionalEmailSender>): JobDefinition {
  return { ...definition, handle: (job, context) => definition.handle(job, context).pipe(Effect.provide(layer)) };
}
`;

async function assertEmailOnlySelection(root) {
  const state = JSON.parse(await readFile(join(root, ".egeria/state.json"), "utf8"));
  const installed = Object.fromEntries(state.installedCapabilities.map(({ identifier, version }) => [identifier, version]));
  assert.equal(state.origin.profile, "site");
  assert.equal(installed["transactional-email-resend"], "0.2.0");
  assert.equal(installed["app-foundation"], "0.3.0");
  assert.equal(installed["background-job-delivery"], undefined);
  assert.equal(installed["application-persistence"], undefined);
  for (const path of [...backgroundJobFiles.map(item => item.path), "apps/web/worker.mjs",
    "apps/web/src/configuration/application-database.ts", "apps/web/src/infrastructure/cloudflare/synthetic-composition-persistence.ts"]) {
    await assert.rejects(lstat(join(root, path)), { code: "ENOENT" }, `Independent email must not emit ${path}`);
  }
  const configuration = JSON.parse(await readFile(join(root, "apps/web/wrangler.jsonc"), "utf8"));
  assert.equal(configuration.main, ".open-next/worker.js");
  for (const target of [configuration, ...Object.values(configuration.env)]) {
    assert.equal(target.queues, undefined);
    assert.equal(target.d1_databases, undefined);
    assert.equal(Object.keys(target.vars ?? {}).some(key => key.startsWith("JOB_") || key === "APP_DB" || key === "APPLICATION_DATABASE_ENVIRONMENT"), false);
  }
}

export async function createEmailOnlyFixture({ generatedRoot, parent }) {
  await assertEmailOnlySelection(generatedRoot);
  const fixture = await sourceCopy(generatedRoot, parent, "email-http-composition-");
  await authorFixture(fixture, [
    ["app/email-proof/route.ts", emailRouteSource],
    ["tests/integration/independent-email-worker.test.ts", emailWorkerTestSource],
  ]);
  await assertEmailOnlySelection(fixture.root);
  return fixture;
}

const emailRouteSource = `import { Cause, Effect, Exit } from "effect";
import { TransactionalEmailSender } from "@/src/application/transactional-email-sender";
import { serverTransactionalEmailLayer } from "@/src/composition/server-transactional-email";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  let attemptedCalls = 0;
  const previous = globalThis.fetch;
  // This exact interception runs inside workerd. It never delegates transport.
  // The host exercises these requests serially and every path restores fetch.
  globalThis.fetch = async (input, init) => {
    if (input !== "https://api.resend.com/emails" || init?.method !== "POST" || init.redirect !== "error") throw new Error("SYNTHETIC_EXTERNAL_BLOCK");
    attemptedCalls += 1;
    return Response.json({ id: "synthetic-acceptance" });
  };
  try {
    const recipient = new URL(request.url).searchParams.has("unauthorized") ? "refused@example.test" : "allowed@example.test";
    const program = Effect.gen(function* () {
      const sender = yield* TransactionalEmailSender;
      return yield* sender.send({ to: recipient, subject: "Synthetic example", text: "SYNTHETIC_PRIVATE_BODY",
        idempotencyKey: "independent-worker-example" });
    }).pipe(Effect.provide(serverTransactionalEmailLayer));
    const result = await Effect.runPromiseExit(program);
    const reason = Exit.isFailure(result) ? result.cause.reasons.find(Cause.isFailReason) : undefined;
    return Response.json({ outcome: Exit.isSuccess(result) ? "accepted" : reason?.error.code ?? "unexpected-failure", attemptedCalls });
  } finally { globalThis.fetch = previous; }
}
`;

const emailWorkerTestSource = `import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createTestHarness } from "wrangler";
import { expect, it } from "vitest";
it("independent email-only HTTP uses the real layer and refuses target/configuration/recipient errors before transport", async () => {
  const target = process.env.APPLICATION_ENVIRONMENT ?? "development";
  expect(target).toBe("development");
  expect(await readFile(".open-next/assets/BUILD_ID", "utf8")).toMatch(/^egeria-development-[a-f0-9]{40}$/u);
  const generated = JSON.parse(await readFile("wrangler.jsonc", "utf8"));
  const base = { ...generated, main: resolve(".open-next/worker.js"),
    assets: { ...generated.assets, directory: resolve(".open-next/assets") } };
  delete base.env; delete base.$schema;
  expect(base.queues).toBeUndefined(); expect(base.d1_databases).toBeUndefined();
  const valid = { ...base.vars, APPLICATION_ENVIRONMENT: target, RESEND_API_KEY: "re_controlled_email_only",
    TRANSACTIONAL_EMAIL_FROM: "sender@example.test", TRANSACTIONAL_EMAIL_DOMAIN: "example.test",
    TRANSACTIONAL_EMAIL_ALLOWED_RECIPIENTS: "allowed@example.test,second@example.test" };
  const cases = [
    { name: "matching", values: valid, outcome: "accepted", calls: 1 },
    { name: "missing-target", values: { ...valid, APPLICATION_ENVIRONMENT: undefined }, outcome: "transactional-email-configuration", calls: 0 },
    { name: "invalid-target", values: { ...valid, APPLICATION_ENVIRONMENT: "invalid" }, outcome: "transactional-email-configuration", calls: 0 },
    { name: "wrong-target", values: { ...valid, APPLICATION_ENVIRONMENT: "production" }, outcome: "transactional-email-configuration", calls: 0 },
    { name: "missing-key", values: { ...valid, RESEND_API_KEY: undefined }, outcome: "transactional-email-configuration", calls: 0 },
    { name: "invalid-key", values: { ...valid, RESEND_API_KEY: "invalid" }, outcome: "transactional-email-configuration", calls: 0 },
    { name: "missing-sender", values: { ...valid, TRANSACTIONAL_EMAIL_FROM: undefined }, outcome: "transactional-email-configuration", calls: 0 },
    { name: "missing-domain", values: { ...valid, TRANSACTIONAL_EMAIL_DOMAIN: undefined }, outcome: "transactional-email-configuration", calls: 0 },
    { name: "missing-list", values: { ...valid, TRANSACTIONAL_EMAIL_ALLOWED_RECIPIENTS: undefined }, outcome: "transactional-email-configuration", calls: 0 },
    { name: "invalid-list", values: { ...valid, TRANSACTIONAL_EMAIL_ALLOWED_RECIPIENTS: "allowed@example.test," }, outcome: "transactional-email-configuration", calls: 0 },
    { name: "refused-recipient", values: valid, query: "?unauthorized", outcome: "transactional-email-authorization", calls: 0 },
    { name: "restored", values: valid, outcome: "accepted", calls: 1 },
  ];
  const outcomes = [];
  for (const scenario of cases) {
    const root = await mkdtemp(resolve(tmpdir(), "independent-email-worker-"));
    const configPath = resolve(root, "worker.jsonc");
    await writeFile(configPath, JSON.stringify({ ...base, vars: scenario.values }), { flag: "wx", mode: 0o600 });
    const harness = createTestHarness({ root, workers: [{ configPath, env: "" }] });
    let passed = false;
    try {
      await harness.listen();
      const response = await harness.fetch("/email-proof" + (scenario.query ?? ""), { method: "POST" });
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result).toEqual({ outcome: scenario.outcome, attemptedCalls: scenario.calls });
      expect(harness.getLogs().map(item => item.message).join("\\n"))
        .not.toMatch(/re_controlled|allowed@example|sender@example|SYNTHETIC_PRIVATE_BODY/u);
      outcomes.push({ name: scenario.name, outcome: scenario.outcome, attemptedCalls: scenario.calls });
      passed = true;
    } finally {
      await harness.close();
      if (passed) await rm(root, { recursive: true, force: true });
      else console.error(JSON.stringify({ retainedEmailHarness: root, scenario: scenario.name }));
    }
  }
  console.log(JSON.stringify({ target, outcomes, jobsSelected: false, persistenceSelected: false, liveProviderAccess: false }));
}, 180_000);
`;

export async function verifyEmailOnlyFixture(fixture) {
  const made = await createOwnedTemporaryDirectory(fixture.owner.path, "prepared-email-");
  assert.equal(made.ok, true);
  const preparedRoot = join(made.value.path, "project");
  await cp(fixture.root, preparedRoot, { recursive: true, force: false, errorOnExist: true });
  const support = join(made.value.path, "support");
  await mkdir(support, { mode: 0o700 });
  const home = join(support, "home"), temporary = join(support, "temporary"), store = join(support, "store");
  for (const path of [home, temporary, store]) await mkdir(path, { mode: 0o700 });
  const userConfiguration = join(support, ".npmrc");
  await writeFile(userConfiguration, "", { flag: "wx", mode: 0o600 });
  const toolEnvironment = await derivePnpmToolEnvironment("pnpm");
  const revision = "a".repeat(40); // Explicit synthetic identity, never an accepted source revision.
  const environment = { ...Object.fromEntries(["PATH", "SystemRoot", "ComSpec", "PATHEXT", "LANG"]
    .filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]])), ...toolEnvironment,
    HOME: home, USERPROFILE: home, TMPDIR: temporary, TMP: temporary, TEMP: temporary,
    npm_config_userconfig: userConfiguration, NPM_CONFIG_USERCONFIG: userConfiguration,
    npm_config_registry: "https://registry.npmjs.org/", NPM_CONFIG_REGISTRY: "https://registry.npmjs.org/",
    CI: "true", NEXT_TELEMETRY_DISABLED: "1", WRANGLER_SEND_METRICS: "false",
    APPLICATION_ENVIRONMENT: "development", NEXT_PUBLIC_SITE_URL: "https://development.application-test.invalid",
    BUILD_SOURCE_REVISION: revision,
  };
  const commands = [];
  const run = async (label, arguments_) => {
    const log = join(made.value.path, label + ".log");
    const command = { label, executable: "pnpm", arguments: arguments_, cwd: preparedRoot, startedAt: new Date().toISOString(), log };
    try {
      const result = await runFile("pnpm", arguments_, { cwd: preparedRoot, env: environment,
        timeout: 20 * 60 * 1000, maxBuffer: 4 * 1024 * 1024, encoding: "utf8" });
      await writeFile(log, result.stdout + result.stderr, { flag: "wx", mode: 0o600 });
      commands.push({ ...command, finishedAt: new Date().toISOString(), exitCode: 0 });
      return result.stdout;
    } catch (error) {
      await writeFile(log, (error.stdout ?? "") + (error.stderr ?? ""), { flag: "wx", mode: 0o600 });
      commands.push({ ...command, finishedAt: new Date().toISOString(), exitCode: error.code ?? null, signal: error.signal ?? null });
      throw error;
    } finally {
      await writeFile(join(made.value.path, "commands.json"), JSON.stringify(commands, null, 2), { mode: 0o600 });
    }
  };
  try {
    assert.equal((await run("pnpm-version", ["--version"])).trim(), "11.28.1");
    await run("frozen-install", ["install", "--frozen-lockfile", "--store-dir", store]);
    await run("lint", ["run", "lint"]);
    await run("typecheck", ["run", "typecheck"]);
    await run("unit", ["run", "test:unit"]);
    await run("component", ["run", "test:component"]);
    await run("next-build", ["run", "build"]);
    await run("opennext-build", ["--dir", "apps/web", "exec", "opennextjs-cloudflare", "build", "--skipNextBuild"]);
    const artifact = mode => ["--dir", "apps/web", "run", "check:prepared-artifact", mode, "development", revision, "--local"];
    await run("prepared-record", artifact("record"));
    const receiptPath = join(preparedRoot, "apps/web/.open-next/prepared-artifact.json");
    const receipt = await readFile(receiptPath);
    const sourceFiles = [...fixture.sourceSnapshot].filter(([, entry]) => entry.kind === "file").map(([path]) => path);
    const readPreparedSources = () => Promise.all(sourceFiles.map(async path => ({ path, sha256: fingerprint(await readFile(join(preparedRoot, path))) })));
    const finalSources = await readPreparedSources();
    await writeFile(join(made.value.path, "final-source-manifest.json"), JSON.stringify(finalSources, null, 2), { flag: "wx", mode: 0o600 });
    await writeFile(join(made.value.path, "prepared-artifact.json"), receipt, { flag: "wx", mode: 0o600 });
    await run("prepared-before-worker", artifact("verify"));
    await run("worker-integration", ["--dir", "apps/web", "run", "test:integration:cloudflare"]);
    await run("prepared-after-worker", artifact("verify"));
    assert.deepEqual(await readFile(receiptPath), receipt);
    assert.deepEqual(await readPreparedSources(), finalSources);
    await assertEmailOnlySelection(preparedRoot);
    await assertCompositionSourcePreserved(fixture);
    return { ok: true, targets: ["development"], preparedRoot, receiptSha256: fingerprint(receipt),
      finalSources, commands, providerPolicy: "intercepted inside workerd; no network delegation", liveAcceptance: false };
  } catch (error) {
    error.retainedEmailEvidencePath = made.value.path;
    throw error;
  }
}
