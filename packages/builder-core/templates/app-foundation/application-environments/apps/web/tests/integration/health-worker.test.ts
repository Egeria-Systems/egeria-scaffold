import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createTestHarness } from "wrangler";
import { resolveBuildApplicationEnvironment } from "@/src/configuration/application-environment";

const target = resolveBuildApplicationEnvironment({ applicationEnvironment: process.env.APPLICATION_ENVIRONMENT }, "local");
if (!target.ok) throw new Error("Invalid integration build target");
const buildTarget = target.value;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
let configurationRoot: string;
let workerBefore: Buffer;
const workerPath = resolve(".open-next/worker.js");

beforeAll(async () => {
  configurationRoot = await mkdtemp(resolve(".environment-health-test-"));
  workerBefore = await readFile(workerPath);
});
afterAll(async () => { if (configurationRoot !== undefined) await rm(configurationRoot, { recursive: true, force: true }); });

it.each([
  ["matching", buildTarget, 200],
  ["missing", undefined, 503],
  ["invalid", "private-invalid-target", 503],
  ["mismatched", buildTarget === "production" ? "staging" : "production", 503],
  ["restored", buildTarget, 200],
] as const)("serves bounded health from the same built Worker with %s runtime configuration", async (name, runtimeTarget, status) => {
  const configuration = JSON.parse(await readFile("wrangler.jsonc", "utf8"));
  delete configuration.env;
  delete configuration.$schema;
  configuration.main = workerPath;
  configuration.assets.directory = resolve(configuration.assets.directory);
  configuration.vars = runtimeTarget === undefined ? {} : { APPLICATION_ENVIRONMENT: runtimeTarget };
  const configPath = join(configurationRoot, `${name}.jsonc`);
  await writeFile(configPath, JSON.stringify(configuration));
  const server = createTestHarness({ workers: [{ configPath }] });
  try {
    await server.listen();
    const response = await server.fetch("/api/health");
    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    const text = await response.text();
    expect(text).not.toContain("private-");
    expect(JSON.parse(text)).toEqual(status === 200 ? {
      status: "ok", requestId: expect.stringMatching(uuid), build: expect.any(Object),
    } : {
      status: "unavailable", requestId: expect.stringMatching(uuid), error: { code: "application-environment-invalid" },
    });
    if (status === 200) {
      const { build } = JSON.parse(text);
      expect(build).toEqual("releaseId" in build ? { releaseId: expect.stringMatching(uuid) } : {});
    }
    expect(await readFile(workerPath)).toEqual(workerBefore);
  } catch (error) {
    server.debug();
    throw error;
  } finally { await server.close(); }
});
