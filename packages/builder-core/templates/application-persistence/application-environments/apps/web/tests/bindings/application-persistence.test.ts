import type { D1Database } from "@cloudflare/workers-types";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createTestHarness } from "wrangler";
import { persistenceFixture } from "./fixtures/schema";

// Vitest and Drizzle run in Node; the binding executes SQL in local workerd.
const server = createTestHarness({
  workers: [{ config: {
    name: "application-persistence-bindings",
    main: "./tests/bindings/fixtures/worker.ts",
    compatibility_date: "2026-08-04",
    workers_dev: false,
    preview_urls: false,
    send_metrics: false,
    d1_databases: [{
      binding: "APP_DB",
      database_name: "application-persistence-bindings-local",
      database_id: "00000000-0000-4000-8000-000000000001",
      migrations_dir: "./tests/bindings/fixtures/migrations",
      remote: false,
    }],
  } }],
});
const worker = server.getWorker<{ APP_DB: D1Database }>();

beforeEach(async () => { await server.listen(); });
afterEach(async ({ task }) => {
  if (task.result?.state === "fail") server.debug();
  await server.close();
});

it("discovers ordered SQL migrations and records them once in Wrangler's ledger", async () => {
  await worker.applyD1Migrations("APP_DB");
  const { APP_DB } = await worker.getEnv();
  const readLedger = () => APP_DB.prepare("SELECT name FROM d1_migrations ORDER BY id").all();

  expect((await readLedger()).results).toEqual([
    { name: "0000_persistence_fixture.sql" },
    { name: "0001_persistence_fixture_index.sql" },
  ]);
  expect(await APP_DB.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'persistence_fixture_value_unique'",
  ).all()).toMatchObject({ results: [{ name: "persistence_fixture_value_unique" }] });

  await worker.applyD1Migrations("APP_DB");
  expect((await readLedger()).results).toEqual([
    { name: "0000_persistence_fixture.sql" },
    { name: "0001_persistence_fixture_index.sql" },
  ]);
});

it("round-trips SQL-shaped values through parameterized Drizzle queries", async () => {
  await worker.applyD1Migrations("APP_DB");
  const { APP_DB } = await worker.getEnv();
  const database = drizzle(APP_DB);
  const id = "'; DROP TABLE persistence_fixture; --";
  const value = "literal 'quoted' value; SELECT 1";

  await database.insert(persistenceFixture).values([
    { id, value },
    { id: "unrelated", value: "separate value" },
  ]);

  expect(await database.select().from(persistenceFixture).where(eq(persistenceFixture.id, id)))
    .toEqual([{ id, value }]);
  expect(await database.select().from(persistenceFixture)).toHaveLength(2);
});

it("rolls back the prepared batch when a later statement violates a real constraint", async () => {
  await worker.applyD1Migrations("APP_DB");
  const { APP_DB } = await worker.getEnv();
  const database = drizzle(APP_DB);
  await database.insert(persistenceFixture).values({ id: "existing", value: "reserved" });

  await expect(database.batch([
    database.insert(persistenceFixture).values({ id: "rolled-back", value: "new value" }),
    database.insert(persistenceFixture).values({ id: "duplicate", value: "reserved" }),
    database.insert(persistenceFixture).values({ id: "not-committed", value: "later value" }),
  ])).rejects.toThrow(/UNIQUE constraint failed/);

  expect(await database.select().from(persistenceFixture))
    .toEqual([{ id: "existing", value: "reserved" }]);
});

it("resets stored data and the ledger before reapplying fixture migrations", async () => {
  await worker.applyD1Migrations("APP_DB");
  const { APP_DB } = await worker.getEnv();
  await drizzle(APP_DB).insert(persistenceFixture).values({ id: "discarded", value: "synthetic" });

  await server.reset();
  const resetEnvironment = await worker.getEnv();
  expect(await resetEnvironment.APP_DB.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('persistence_fixture', 'd1_migrations')",
  ).all()).toMatchObject({ results: [] });

  await worker.applyD1Migrations("APP_DB");
  expect(await drizzle(resetEnvironment.APP_DB).select().from(persistenceFixture)).toEqual([]);
  expect(await resetEnvironment.APP_DB.prepare("SELECT name FROM d1_migrations ORDER BY id").all())
    .toMatchObject({ results: [
      { name: "0000_persistence_fixture.sql" },
      { name: "0001_persistence_fixture_index.sql" },
    ] });
});

it("refuses conflicting serving targets before SQL and restores the same compiled fixture", async () => {
  await mkdir(".wrangler", { recursive: true });
  const root = await mkdtemp(resolve(".wrangler/persistence-target-test-"));
  const source = resolve("tests/bindings/fixtures/worker.ts");
  const sourceBefore = await readFile(source);
  const buildConfig = join(root, "build.jsonc");
  await writeFile(buildConfig, JSON.stringify({
    name: "persistence-target-fixture", main: source, compatibility_date: "2026-08-04",
    workers_dev: false, preview_urls: false, send_metrics: false,
    define: { "process.env.NEXT_PUBLIC_APPLICATION_ENVIRONMENT": JSON.stringify("development") },
  }));
  execFileSync("pnpm", ["exec", "wrangler", "deploy", "--dry-run", "--config", buildConfig, "--outdir", join(root, "built"), "--x-provision=false", "--x-auto-create=false"], {
    encoding: "utf8", env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
  });
  const compiled = join(root, "built/worker.js");
  const compiledBefore = await readFile(compiled);
  const database = (binding: string, suffix: string) => ({
    binding, database_name: `persistence-target-${suffix}`,
    database_id: suffix === "app" ? "00000000-0000-4000-8000-000000000011" : "00000000-0000-4000-8000-000000000012",
    migrations_dir: resolve("tests/bindings/fixtures/migrations"), remote: false,
  });
  const configuration = (application: string | undefined, databaseTarget: string, binding: "present" | "missing" | "wrong" = "present") => ({ workers: [{ config: {
    name: "persistence-target-fixture", main: compiled, no_bundle: true, compatibility_date: "2026-08-04",
    workers_dev: false, preview_urls: false, send_metrics: false,
    vars: { ...(application === undefined ? {} : { APPLICATION_ENVIRONMENT: application }), APPLICATION_DATABASE_ENVIRONMENT: databaseTarget, ...(binding === "wrong" ? { APP_DB: "private-wrong-binding" } : {}) },
    d1_databases: [...(binding === "present" ? [database("APP_DB", "app")] : []), database("OTHER_DB", "other")],
  } }] });
  const runtime = createTestHarness(configuration("development", "local"));
  const targetWorker = runtime.getWorker<{ APP_DB: D1Database; OTHER_DB: D1Database }>();
  try {
    await runtime.listen();
    await targetWorker.applyD1Migrations("APP_DB");
    await targetWorker.applyD1Migrations("OTHER_DB");
    const initial = await targetWorker.getEnv();
    await initial.APP_DB.prepare("INSERT INTO persistence_fixture (id, value) VALUES (?, ?)").bind("app", "app-only").run();
    await initial.OTHER_DB.prepare("INSERT INTO persistence_fixture (id, value) VALUES (?, ?)").bind("other", "other-only").run();
    const accepted = await targetWorker.fetch("/", { method: "POST", body: "accepted" });
    expect(accepted.status).toBe(204);
    for (const [application, databaseTarget, binding] of [
      [undefined, "local", "present"], ["private-invalid-target", "local", "present"],
      ["production", "production", "present"], ["development", "staging", "present"],
      ["development", "invalid", "present"], ["development", "local", "missing"], ["development", "local", "wrong"],
    ] as const) {
      await runtime.update(configuration(application, databaseTarget, binding));
      const denied = await targetWorker.fetch("/", { method: "POST", body: "must-not-be-written" });
      expect(denied.status).toBe(503);
      expect(await denied.text()).not.toContain("private-");
      await runtime.update(configuration("development", "local"));
      const restored = await targetWorker.getEnv();
      expect((await restored.APP_DB.prepare("SELECT id, value FROM persistence_fixture ORDER BY id").all()).results)
        .toEqual([{ id: "accepted", value: "accepted" }, { id: "app", value: "app-only" }]);
      expect((await restored.OTHER_DB.prepare("SELECT id, value FROM persistence_fixture ORDER BY id").all()).results)
        .toEqual([{ id: "other", value: "other-only" }]);
      expect(await readFile(compiled)).toEqual(compiledBefore);
      expect(await readFile(source)).toEqual(sourceBefore);
    }
    expect((await targetWorker.fetch("/", { method: "POST", body: "restored" })).status).toBe(204);
    const restored = await targetWorker.getEnv();
    expect((await restored.APP_DB.prepare("SELECT id FROM persistence_fixture WHERE id = ?").bind("restored").all()).results).toEqual([{ id: "restored" }]);
  } catch (error) {
    runtime.debug();
    throw error;
  } finally {
    await runtime.close();
  }
}, 120_000);
