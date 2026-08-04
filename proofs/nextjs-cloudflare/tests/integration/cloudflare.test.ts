import { createTestHarness } from "wrangler";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";

const server = createTestHarness({
  workers: [{ configPath: "./wrangler.jsonc" }],
});

beforeAll(async () => {
  await server.listen();
});

afterEach(async () => {
  await server.reset();
});

afterAll(async () => {
  await server.close();
});

test("the built Worker returns the provider-neutral runtime report", async () => {
  const response = await server.fetch("/api/compatibility");

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("application/json");
  await expect(response.json()).resolves.toEqual({
    environment: "compatibility",
    runtime: "workerd",
  });
});
