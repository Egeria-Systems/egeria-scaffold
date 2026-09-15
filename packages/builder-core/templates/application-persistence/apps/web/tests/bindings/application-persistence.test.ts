import type { D1Database } from "@cloudflare/workers-types";
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
