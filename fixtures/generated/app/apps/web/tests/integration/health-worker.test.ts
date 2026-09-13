import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { createTestHarness } from "wrangler";

const server = createTestHarness({ workers: [{ configPath: "./wrangler.jsonc" }] });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

beforeAll(async () => { await server.listen(); });
afterAll(async () => { await server.close(); });
afterEach(({ task }) => {
  if (task.result?.state === "fail") server.debug();
});

it("serves bounded health information from the built Worker", async () => {
  const response = await server.fetch("/api/health");

  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
  const payload: unknown = await response.json();
  expect(payload).toEqual({
    status: "ok",
    requestId: expect.stringMatching(uuid),
    build: expect.any(Object),
  });
  if (typeof payload !== "object" || payload === null || !("build" in payload)) {
    throw new Error("Expected a health response object");
  }
  const build = payload.build;
  if (typeof build !== "object" || build === null) throw new Error("Expected build information");
  if ("releaseId" in build) expect(build).toEqual({ releaseId: expect.stringMatching(uuid) });
  else expect(build).toEqual({});
});
