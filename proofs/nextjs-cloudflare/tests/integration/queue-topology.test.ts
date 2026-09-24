import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createTestHarness, type TestHarnessOptions } from "wrangler";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";

const proofRoot = process.cwd();
const fixtureRoot = resolve(proofRoot, "tests/fixtures/queue-topology");
type Topology = "shared" | "separate";
type Observation = {
  stage: "attempt" | "complete" | "dead-letter" | "wrong-environment";
  key: string;
  sequence: number;
  id: string;
  attempts: number;
  environment: string;
  queue: string;
  consumerMarker: boolean;
  httpMarker: boolean;
};

// Inline configs are rooted in an empty temporary directory, so Wrangler cannot
// load a developer's adjacent .dev.vars/.env into these synthetic Workers.
function workers(topology: Topology): TestHarnessOptions["workers"] {
  return ["blue", "green"].flatMap((environment) => {
    const queue = `proof-${environment}`;
    const common = {
      compatibility_date: "2026-08-04",
      compatibility_flags: ["nodejs_compat"],
    };
    const consumers = [
      { queue, max_batch_size: 2, max_batch_timeout: 0.1, max_retries: 2,
        retry_delay: 0, dead_letter_queue: `${queue}-dead` },
      { queue: `${queue}-dead`, max_batch_size: 2, max_batch_timeout: 0.1,
        max_retries: 0 },
    ];
    const producer = { binding: "QUEUE", queue };
    const web = {
      ...common,
      name: `web-${environment}`,
      main: resolve(fixtureRoot, topology === "shared" ? "shared.mjs" : "http.mjs"),
      assets: { directory: resolve(proofRoot, ".open-next/assets"), binding: "ASSETS" },
      vars: { PROOF_ENVIRONMENT: environment, HTTP_MARKER: "synthetic-http",
        ...(topology === "shared" ? { CONSUMER_MARKER: "synthetic-consumer" } : {}) },
      queues: { producers: [producer], ...(topology === "shared" ? { consumers } : {}) },
    };
    return topology === "shared" ? [{ config: web }] : [
      { config: web },
      { config: { ...common, name: `consumer-${environment}`,
        main: resolve(fixtureRoot, "consumer.mjs"),
        vars: { PROOF_ENVIRONMENT: environment, CONSUMER_MARKER: "synthetic-consumer" },
        queues: { consumers } } },
    ];
  });
}

for (const topology of ["shared", "separate"] as const) {
  describe(`${topology} Queue consumer with the built OpenNext Worker`, () => {
    let server: ReturnType<typeof createTestHarness>;
    let temporaryRoot: string;
    let restoreOutbound: (() => void) | undefined;
    const externalRequests: string[] = [];

    beforeAll(async () => {
      temporaryRoot = await mkdtemp(resolve(tmpdir(), "queue-topology-"));
      const originalFetch = globalThis.fetch;
      const outbound = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
        const url = new URL(input instanceof Request ? input.url : String(input));
        if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
          externalRequests.push("blocked");
          throw new Error("PROOF_EXTERNAL_REQUEST_BLOCKED");
        }
        return originalFetch(input, init);
      });
      restoreOutbound = () => outbound.mockRestore();
      server = createTestHarness({ root: temporaryRoot, workers: workers(topology) });
      await server.listen();
    }, 30_000);

    afterEach(async () => {
      await server.reset();
    }, 30_000);

    afterAll(async () => {
      try {
        await server?.close();
      } finally {
        restoreOutbound?.();
        if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true });
      }
      expect(externalRequests).toEqual([]);
    });

    function observations(key: string): Observation[] {
      return server.getLogs().flatMap(({ message }) => {
        if (!message.startsWith('{"proof":"queue-topology"')) return [];
        const value = JSON.parse(message) as Observation;
        return value.key === key ? [value] : [];
      });
    }

    async function enqueue(
      messages: { key: string; action: string; sequence?: number; environment?: string }[],
      environment = "blue",
    ) {
      const response = await server.getWorker(`web-${environment}`).fetch("/__queue-proof/enqueue", {
        method: "POST", body: JSON.stringify(messages.map((message) => ({
          environment, sequence: 0, ...message,
        }))),
      });
      expect(response.status).toBe(202);
    }

    async function completed(key: string, count = 1) {
      await expect.poll(() => observations(key).filter((entry) => entry.stage === "complete").length,
        { timeout: 10_000, interval: 25 }).toBe(count);
      return observations(key);
    }

    test("retains the built Next route and static page in both environments", async () => {
      for (const environment of ["blue", "green"]) {
        const web = server.getWorker(`web-${environment}`);
        const route = await web.fetch("/api/compatibility");
        expect(route.status).toBe(200);
        expect(await route.json()).toEqual({ environment, runtime: "workerd" });
        const page = await web.fetch("/");
        expect(page.status).toBe(200);
        expect(await page.text()).toContain("Next.js and Cloudflare compatibility proof");
      }
    });

    test("enqueues and consumes through a real Queue with explicit and implicit ack", async () => {
      await enqueue([{ key: "explicit", action: "ack" }, { key: "implicit", action: "return" }]);
      for (const key of ["explicit", "implicit"]) {
        const events = await completed(key);
        expect(events.filter((entry) => entry.stage === "attempt").map((entry) => entry.attempts)).toEqual([1]);
        expect(events[0]?.id).toEqual(expect.any(String));
      }
    });

    test("native individual retry preserves transport identity and can complete out of order", async () => {
      await enqueue([{ key: "ordered", action: "retry-once", sequence: 1 },
        { key: "ordered", action: "ack", sequence: 2 }]);
      const events = await completed("ordered", 2);
      expect(events.filter((entry) => entry.stage === "complete").map((entry) => entry.sequence)).toEqual([2, 1]);
      const retried = events.filter((entry) => entry.stage === "attempt" && entry.sequence === 1);
      expect(retried.map((entry) => entry.attempts)).toEqual([1, 2]);
      expect(new Set(retried.map((entry) => entry.id)).size).toBe(1);
    });

    test("a rejected handler is retried by the runtime", async () => {
      await enqueue([{ key: "failure", action: "throw-once" }]);
      const events = await completed("failure");
      expect(events.filter((entry) => entry.stage === "attempt").map((entry) => entry.attempts)).toEqual([1, 2]);
      const response = await server.getWorker("web-blue").fetch("/api/compatibility");
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ environment: "blue", runtime: "workerd" });
    });

    test("exhaustion reaches a real local dead-letter Queue and synthetic replay retains logical identity", async () => {
      await enqueue([{ key: "poison", action: "poison" }]);
      await expect.poll(() => observations("poison").filter((entry) => entry.stage === "dead-letter").length,
        { timeout: 10_000, interval: 25 }).toBe(1);
      const events = observations("poison");
      expect(events.filter((entry) => entry.stage === "attempt").map((entry) => entry.attempts)).toEqual([1, 2, 3]);
      expect(events.find((entry) => entry.stage === "dead-letter")?.queue).toBe("proof-blue-dead");
      await enqueue([{ key: "poison", action: "ack" }]);
      const replay = (await completed("poison")).find((entry) => entry.stage === "complete");
      expect(replay?.key).toBe("poison");
      expect(replay?.id).not.toBe(events[0]?.id);
    });

    test("controlled duplicate logical payloads are distinct deliveries, with no invented deduplication", async () => {
      await enqueue([{ key: "duplicate", action: "ack", sequence: 2 },
        { key: "duplicate", action: "ack", sequence: 1 }]);
      const events = (await completed("duplicate", 2)).filter((entry) => entry.stage === "complete");
      expect(events.map((entry) => entry.sequence).sort()).toEqual([1, 2]);
      expect(new Set(events.map((entry) => entry.id)).size).toBe(2);
    });

    test("distinct environments do not consume each other's queues and reject a wrong-environment injection", async () => {
      for (const environment of ["blue", "green"]) {
        await enqueue([{ key: environment, action: "ack" }], environment);
        const events = await completed(environment);
        expect(events.every((entry) => entry.environment === environment && entry.queue === `proof-${environment}`)).toBe(true);
      }
      await enqueue([{ key: "wrong", action: "ack", environment: "green" }]);
      await expect.poll(() => observations("wrong").length, { timeout: 10_000 }).toBe(1);
      expect(observations("wrong")[0]?.stage).toBe("wrong-environment");
      expect(observations("wrong").some((entry) => entry.stage === "complete")).toBe(false);
    });

    test("separation confines synthetic consumer bindings while sharing exposes both sets", async () => {
      const web = server.getWorker("web-blue");
      const response = await web.fetch("/__queue-proof/bindings");
      expect(await response.json()).toEqual({ httpMarker: true, consumerMarker: topology === "shared" });
      await enqueue([{ key: "bindings", action: "ack" }]);
      const [event] = await completed("bindings");
      expect(event).toMatchObject({ consumerMarker: true, httpMarker: topology === "shared" });
      if (topology === "separate") {
        await expect(server.getWorker("consumer-blue").fetch("/"))
          .rejects.toThrow("Handler does not export a fetch() function.");
      }
    });

    test("a missing producer binding fails without claiming enqueue", async () => {
      const missing = workers(topology);
      const first = missing[0];
      if (!first || !("config" in first)) throw new Error("Missing proof config");
      first.config.queues = { ...first.config.queues, producers: [] };
      await server.update({ root: temporaryRoot, workers: missing });
      const response = await server.getWorker("web-blue").fetch("/__queue-proof/enqueue", {
        method: "POST", body: JSON.stringify([{ key: "missing", action: "ack", environment: "blue" }]),
      });
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: "QUEUE_BINDING_MISSING" });
      expect(observations("missing")).toEqual([]);
    });

    test("records the pinned emulator ack/batch-failure mismatch, not production semantics", async () => {
      await enqueue([{ key: "ack-before-failure", action: "ack" },
        { key: "batch-failure", action: "throw-once" }]);
      await completed("batch-failure");
      // Cloudflare documents [1]. The pinned Miniflare broker ignores explicitAcks
      // on a failed batch: retain this observed limitation, and revisit on upgrades.
      expect(observations("ack-before-failure").filter((entry) => entry.stage === "attempt")
        .map((entry) => entry.attempts)).toEqual([1, 2]);
    });
  });
}
