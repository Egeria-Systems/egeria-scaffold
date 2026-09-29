import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import {
  createFileSystemRepositoryReader,
  createApplicationEnvironmentRenderingContext,
  createPnpmGeneratedProjectVerifier,
  generateProject,
  inferRepository,
  readVerifiedProjectSnapshot,
} from "../dist/index.js";
import { derivePnpmToolEnvironment } from "../dist/generation/verify-generated-project.js";

const execFileAsync = promisify(execFile);

async function prepareObservabilityBrowserProof(app) {
  const reporterPath = join(app, "src/infrastructure/observability/browser-reporter.ts");
  const prefix = await readFile(reporterPath);
  const suffix = Buffer.from("\nexport { sendEnvelope as sendObservabilityEnvelopeForProof };\n");
  await writeFile(reporterPath, Buffer.concat([prefix, suffix]));
  const reporter = await readFile(reporterPath);
  assert.deepEqual(reporter.subarray(0, prefix.length), prefix);
  assert.deepEqual(reporter.subarray(prefix.length), suffix);
  await mkdir(join(app, "app/[locale]/browser-proof"), { recursive: true });
  await writeFile(join(app, "app/[locale]/browser-proof/page.tsx"), [
    '"use client";',
    'import { useEffect } from "react";',
    'import { reportCaughtBrowserError, reportWebVital, sendObservabilityEnvelopeForProof } from "@/src/infrastructure/observability/browser-reporter";',
    'import { submitContact } from "@/src/integrations/contact-form-web3forms/submit-contact";',
    'export default function Proof() {',
    '  useEffect(() => { Object.assign(window, { sendObservabilityEnvelopeForProof }); return () => { Reflect.deleteProperty(window, "sendObservabilityEnvelopeForProof"); }; }, []);',
    '  return <><button onClick={() => reportWebVital({ name: "LCP", value: 12, delta: 1, rating: "good", navigationType: "navigate" })}>Send vital</button>',
    '  <button onClick={() => reportCaughtBrowserError(new Error("Synthetic browser failure"), { operation: "proof-load" })}>Send error</button>',
    '  <button onClick={() => submitContact({ settings: { accessKey: "00000000-0000-4000-8000-000000000001" }, fields: { name: "Synthetic Example", email: "synthetic@example.test", message: "Synthetic test only" }, subject: "Synthetic example", captchaToken: "synthetic-token", signal: new AbortController().signal })}>Send contact</button></>;',
    '}',
  ].join("\n"));
  const digest = bytes => createHash("sha256").update(bytes).digest("hex");
  return { reporterPrefix: digest(prefix), reporterSuffix: digest(suffix), reporter: digest(reporter), page: digest(await readFile(join(app, "app/[locale]/browser-proof/page.tsx"))) };
}

async function runObservabilityProofHarness() {
  const assert = (await import("node:assert/strict")).default;
  const { createHash } = await import("node:crypto");
  const { once } = await import("node:events");
  const { readFile, writeFile } = await import("node:fs/promises");
  const { createServer } = await import("node:http");
  const { resolve } = await import("node:path");
  const { createTestHarness } = await import("wrangler");
  const { chromium } = await import("@playwright/test");
  const { createOperationalEvent, createOperationalErrorReport } = await import("@egeria-systems/observability");
  const { createBrowserErrorEnvelope } = await import("@egeria-systems/observability/browser");
  const target = process.env.APPLICATION_ENVIRONMENT;
  const origin = "https://" + target + ".observability.test";
  const generated = JSON.parse(await readFile("wrangler.jsonc", "utf8"));
  const configuration = { ...generated, main: resolve("observability-proof-worker.mjs"), assets: { ...generated.assets, directory: resolve(".open-next/assets") }, vars: { ...generated.vars, APPLICATION_ENVIRONMENT: target, NEXT_PUBLIC_APPLICATION_ENVIRONMENT: "contradictory", NEXT_PUBLIC_SITE_URL: "https://different.observability.test" } };
  delete configuration.env; delete configuration.$schema;
  const configPath = resolve(process.argv[1] + ".wrangler.json");
  await writeFile(configPath, JSON.stringify(configuration));
  const server = createTestHarness({ workers: [{ configPath }] });
  const pair = { BETTER_STACK_INGESTING_HOST: "s123.eu-nbg-2.betterstackdata.com", BETTER_STACK_SOURCE_TOKEN: "controlled-source-value-123456" };
  const outcomes = [];
  const browserOutcomes = [];
  const failures = [];
  const digest = bytes => createHash("sha256").update(bytes).digest("hex");
  async function bounded(promise, operation) {
    let timer;
    try {
      return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Timed out: " + operation)), 30_000); })]);
    } finally { clearTimeout(timer); }
  }
  function isControlledDiagnostic(body) {
    return body.type === "error-report" ? body.report.capture.operation === "proof-load" : body.type === "operational-event" && body.event.attributes.metric_name === "LCP" && body.event.attributes.value === 12;
  }
  async function forwardBrowserRequest(url, method, headers, body) {
    return server.fetch(url.pathname + url.search, { method, redirect: "manual", headers: { ...Object.fromEntries(new Headers(headers)), "x-observability-proof-url": url.href }, ...(body === null ? {} : { body }) });
  }
  function createNativeIngress(visibleOrigin, forward, diagnostics) {
    const authority = new URL(visibleOrigin).host;
    assert.ok(["http://127.0.0.1:3101", "http://localhost:3101"].includes(visibleOrigin));
    const documents = [];
    const failures = [];
    const completions = new Map();
    let automaticVitals = 0;
    const hopHeaders = ["connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade"];
    const protectedMetadata = headers => Object.fromEntries([...headers].filter(([name]) => ["host", "origin", "cookie", "referer"].includes(name) || name.startsWith("sec-fetch-") || name.startsWith("content-")));
    const listener = createServer({ requestTimeout: 30_000, headersTimeout: 15_000 }, async (incoming, outgoing) => {
      try {
        assert.equal(incoming.headers.host, authority, "Unexpected HTTP authority");
        assert.ok(incoming.url.startsWith("/") && !incoming.url.startsWith("//"), "Expected origin-form request target");
        const url = new URL(incoming.url, visibleOrigin);
        assert.equal(url.origin, visibleOrigin);
        assert.ok(!url.pathname.startsWith("/__proof"), "Browser ingress cannot access proof controls");
        const body = await bounded((async () => {
          const chunks = []; let bytes = 0;
          for await (const chunk of incoming) { bytes += chunk.length; assert.ok(bytes <= 8192, "Oversized ingress body"); chunks.push(chunk); }
          return Buffer.concat(chunks);
        })(), "native request body");
        const received = new Headers();
        for (const [name, value] of Object.entries(incoming.headers)) if (value !== undefined) received.set(name, Array.isArray(value) ? value.join(", ") : value);
        let entry;
        if (url.pathname === "/api/observability") {
          const envelope = JSON.parse(body.toString("utf8"));
          if (!isControlledDiagnostic(envelope)) {
            assert.equal(envelope.type, "operational-event"); assert.equal(envelope.event.name, "browser.web.vital");
            assert.equal(received.has("cookie"), false); assert.equal(received.has("referer"), false);
            automaticVitals += 1; outgoing.writeHead(202); outgoing.end(); return;
          }
          entry = { url: url.href, method: incoming.method, envelopeType: envelope.type, eventName: envelope.type === "error-report" ? envelope.report.event.name : envelope.event.name, received: protectedMetadata(received), cookie: received.has("cookie"), referrer: received.has("referer"), bodySha256: digest(body) };
          diagnostics.push(entry);
        } else if (url.pathname === "/en-CA/browser-proof") {
          documents.push({ url: url.href, cookieAvailable: received.get("cookie")?.includes("observability_session=synthetic-local-cookie") === true });
        }
        const headers = new Headers(received);
        const nominated = (headers.get("connection") ?? "").split(",").map(name => name.trim().toLowerCase()).filter(Boolean);
        for (const name of nominated) assert.ok(!Object.hasOwn(protectedMetadata(received), name) && !["host", "origin", "cookie", "referer"].includes(name) && !name.startsWith("sec-fetch-") && !name.startsWith("content-"), "Connection must not nominate protected metadata");
        const removed = [];
        for (const name of new Set([...hopHeaders, ...nominated])) if (headers.has(name)) { removed.push(name); headers.delete(name); }
        assert.deepEqual(protectedMetadata(headers), protectedMetadata(received));
        if (entry) entry.forwarding = { headers: protectedMetadata(headers), bodySha256: digest(body), removedHopByHopHeaders: removed };
        const response = await bounded(forward(url, incoming.method, headers, body.length ? body : null), "native Worker response");
        const responseBody = Buffer.from(await bounded(response.arrayBuffer(), "native Worker body"));
        const responseHeaders = new Headers(response.headers);
        const responseNominations = (responseHeaders.get("connection") ?? "").split(",").map(name => name.trim().toLowerCase()).filter(Boolean);
        assert.ok(responseNominations.every(name => hopHeaders.includes(name)), "Response Connection must not nominate application headers");
        // Fetch supplies decoded bytes; this listener frames them for its own HTTP connection.
        for (const name of [...hopHeaders, "content-encoding", "content-length"]) responseHeaders.delete(name);
        for (const [name, value] of responseHeaders) outgoing.setHeader(name, value);
        outgoing.setHeader("content-length", String(responseBody.length));
        if (entry) {
          entry.workerResponse = { status: response.status, bodyBytes: responseBody.length };
          const finished = once(outgoing, "finish").then(() => { entry.nativeResponseFinished = true; });
          finished.catch(() => {}); completions.set(entry, finished);
        }
        outgoing.writeHead(response.status); outgoing.end(responseBody);
      } catch (error) {
        failures.push({ name: error.name, message: error.message });
        if (!outgoing.headersSent) outgoing.writeHead(500);
        outgoing.end();
        if (!incoming.complete) incoming.destroy();
      }
    });
    listener.on("error", error => failures.push({ name: error.name, code: error.code, message: error.message }));
    return {
      documents, failures, completions,
      get automaticVitals() { return automaticVitals; },
      async listen() {
        const listening = once(listener, "listening");
        listener.listen({ host: "127.0.0.1", port: 3101, exclusive: true });
        await bounded(listening, "native listener startup");
        assert.deepEqual(listener.address(), { address: "127.0.0.1", family: "IPv4", port: 3101 });
      },
      async close() {
        if (!listener.listening) return;
        const closed = once(listener, "close");
        listener.close(); listener.closeAllConnections();
        await bounded(closed, "native listener closure");
      },
    };
  }
  const vital = { schemaVersion: "2.0.0", type: "operational-event", event: { schemaVersion: "2.0.0", name: "browser.web.vital", kind: "web.vital", runtime: "browser", severity: "info", occurredAt: "2026-09-27T00:00:00.000Z", context: { eventId: "controlled-vital", service: "web" }, attributes: { metric_name: "LCP", value: 12, delta: 1, rating: "good", navigation_type: "navigate" } } };
  const event = createOperationalEvent({ name: "browser.caught.error", kind: "application.error", runtime: "browser", severity: "error", context: { eventId: "controlled-error", service: "web" }, errorCategory: "unexpected", attributes: { capture_mechanism: "selected-catch", handled: true, operation: "proof-load" } }, { allowedAttributeNames: ["capture_mechanism", "handled", "operation"], clock: { now: () => new Date() } });
  assert.equal(event.ok, true);
  const report = createOperationalErrorReport(event.value, { name: "Error", message: "Synthetic example", stack: "Error: Synthetic example\n    at example (https://staging.observability.test/app.js:12:4)" }, { mechanism: "selected-catch", handled: true, operation: "proof-load" }, {});
  assert.equal(report.ok, true);
  const envelope = createBrowserErrorEnvelope(report.value);
  assert.equal(envelope.ok, true);
  async function control(overrides = {}, omissions = [], behavior = "accept") {
    assert.equal((await server.fetch("/__proof/control", { method: "POST", body: JSON.stringify({ overrides, omissions, behavior }) })).status, 200);
  }
  async function observed() {
    const value = await (await server.fetch("/__proof/observations")).json();
    assert.equal(value.unexpectedOutbound, 0); assert.equal(value.unsafeRecord, false);
    return value;
  }
  async function dispatch(path, body, headers = {}) {
    return server.fetch(path, { method: "POST", redirect: "manual", headers: { "x-observability-proof-url": origin + path, origin, "content-type": "application/json", ...headers }, ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }) });
  }
  let browser;
  let completed = false;
  try {
    await server.listen();
    const cases = [
      { name: "console-only", overrides: {}, calls: 0, records: 1 },
      { name: "matching-provider", overrides: pair, calls: 1, records: 1 },
      { name: "missing-target", overrides: pair, omissions: ["APPLICATION_ENVIRONMENT"], calls: 0, records: 0 },
      { name: "invalid-target", overrides: { ...pair, APPLICATION_ENVIRONMENT: "invalid" }, calls: 0, records: 0 },
      { name: "opposite-target", overrides: { ...pair, APPLICATION_ENVIRONMENT: target === "production" ? "staging" : "production" }, calls: 0, records: 0 },
      ...(target === "staging" ? [
        { name: "host-only", overrides: { BETTER_STACK_INGESTING_HOST: pair.BETTER_STACK_INGESTING_HOST }, calls: 0, records: 0 },
        { name: "token-only", overrides: { BETTER_STACK_SOURCE_TOKEN: pair.BETTER_STACK_SOURCE_TOKEN }, calls: 0, records: 0 },
        { name: "wrong-type", overrides: { ...pair, BETTER_STACK_SOURCE_TOKEN: 1 }, calls: 0, records: 0 },
        { name: "invalid-host", overrides: { ...pair, BETTER_STACK_INGESTING_HOST: "outside.example.test" }, calls: 0, records: 0 },
        { name: "invalid-token", overrides: { ...pair, BETTER_STACK_SOURCE_TOKEN: "short" }, calls: 0, records: 0 },
        { name: "provider-rejection", overrides: pair, behavior: "reject", calls: 1, records: 2 },
        { name: "provider-throw", overrides: pair, behavior: "throw", calls: 1, records: 2 },
        { name: "provider-timeout", overrides: pair, behavior: "timeout", calls: 1, records: 2 },
      ] : []),
      { name: "restored", overrides: pair, calls: 1, records: 1 },
    ];
    for (const scenario of cases) {
      await control(scenario.overrides, scenario.omissions, scenario.behavior);
      assert.equal((await dispatch("/api/observability-proof")).status, 204, scenario.name);
      const value = await observed();
      assert.equal(value.attempts, scenario.calls, scenario.name); assert.equal(value.records.length, scenario.records, scenario.name);
      for (const record of value.records) assert.equal(record.environment, target);
      for (const label of value.providerEnvironments) assert.equal(label, target);
      outcomes.push({ name: scenario.name, ...value });
    }
    for (const [name, body, headers, status] of [
      ["browser-error", envelope.value, {}, 202], ["browser-vital", vital, {}, 202],
      ["malformed", { unexpected: true }, {}, 400], ["wrong-origin", vital, { origin: "https://other.observability.test" }, 403],
      ["wrong-media", vital, { "content-type": "text/plain" }, 415], ["oversized", "x".repeat(8193), {}, 413],
      ["forged-environment", { ...vital, event: { ...vital.event, context: { ...vital.event.context, environment: "production" } } }, {}, 400],
    ]) {
      await control(pair);
      assert.equal((await dispatch("/api/observability", body, headers)).status, status, name);
      const value = await observed(); assert.equal(value.attempts, status === 202 ? 1 : 0, name);
      if (status === 202) assert.equal(value.records[0].environment, target);
      outcomes.push({ name, status, ...value });
    }
    await control(pair);
    const oversizedStream = new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode("x".repeat(4096)));
      controller.enqueue(new TextEncoder().encode("x".repeat(4097))); controller.close();
    } });
    assert.equal((await server.fetch("/api/observability", { method: "POST", redirect: "manual", duplex: "half", body: oversizedStream, headers: { "x-observability-proof-url": origin + "/api/observability", origin, "content-type": "application/json" } })).status, 413);
    outcomes.push({ name: "chunked-oversized", ...await observed() });
    assert.equal(outcomes.at(-1).attempts, 0); assert.equal(outcomes.at(-1).records.length, 0);
    await control({ ...pair, APPLICATION_ENVIRONMENT: "invalid" });
    assert.equal((await dispatch("/api/observability", envelope.value)).status, 202);
    assert.equal((await observed()).attempts, 0); assert.equal((await observed()).records.length, 0);
    for (const [name, overrides, records] of [["email-valid", {}, 1], ["email-refused", { APPLICATION_ENVIRONMENT: "invalid" }, 0], ["email-restored-independent", { BETTER_STACK_SOURCE_TOKEN: "partial" }, 1]]) {
      await control(overrides); assert.equal((await dispatch("/api/observability-proof?email")).status, 204);
      const value = await observed(); assert.equal(value.attempts, 0); assert.equal(value.records.length, records);
      if (records) assert.equal(value.records[0].environment, target);
      outcomes.push({ name, ...value });
    }
    browser = await chromium.launch({ headless: true });
    const origins = target === "staging" ? [origin, "https://alternate.observability.test", origin + ":8443", "http://staging.observability.test", "http://127.0.0.1:3101", "http://localhost:3101"] : [origin];
    for (const visibleOrigin of origins) {
      const browserContext = await browser.newContext({ serviceWorkers: "block" });
      const transportOnly = visibleOrigin === "http://staging.observability.test";
      const pageErrors = [];
      const diagnostics = [];
      const nativeIngress = ["http://127.0.0.1:3101", "http://localhost:3101"].includes(visibleOrigin) ? createNativeIngress(visibleOrigin, forwardBrowserRequest, diagnostics) : undefined;
      const contactRequests = [];
      let automaticVitals = 0;
      const forbidden = [];
      let redirect;
      try {
        await browserContext.addCookies([{ name: "observability_session", value: "synthetic-local-cookie", url: visibleOrigin, httpOnly: true, secure: visibleOrigin.startsWith("https:"), sameSite: "Lax" }]);
        await browserContext.addCookies([{ name: "contact_session", value: "synthetic-provider-cookie", url: "https://api.web3forms.com", httpOnly: true, secure: true, sameSite: "None" }]);
        await browserContext.route("**/*", async route => {
          const request = route.request(); const url = new URL(request.url());
          if (nativeIngress) {
            if (url.origin === visibleOrigin) await route.continue();
            else { forbidden.push({ origin: url.origin, path: url.pathname }); await route.abort(); }
            return;
          }
          if (url.href === "https://api.web3forms.com/submit") {
            const headers = await request.allHeaders();
            if (request.method() === "POST") contactRequests.push({ cookie: Boolean(headers.cookie), referrer: Boolean(headers.referer) });
            await route.fulfill({ status: 200, headers: { "access-control-allow-origin": visibleOrigin, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type", "content-type": "application/json" }, body: JSON.stringify({ success: true }) }); return;
          }
          if (url.origin !== visibleOrigin || url.pathname === "/redirect-proof") {
            forbidden.push({ origin: url.origin, path: url.pathname }); await route.abort(); return;
          }
          const headers = await request.allHeaders();
          if (url.pathname === "/api/observability") {
            const body = request.postDataJSON();
            if (!isControlledDiagnostic(body)) {
              assert.equal(body.type, "operational-event"); assert.equal(body.event.name, "browser.web.vital");
              assert.equal(Boolean(headers.cookie?.includes("observability_session=")), target === "staging" && visibleOrigin === origin);
              automaticVitals += 1; await route.fulfill({ status: 202 }); return;
            }
            diagnostics.push({ cookie: Boolean(headers.cookie), referrer: Boolean(headers.referer) });
            if (redirect) { await route.fulfill({ status: 307, headers: { location: redirect } }); return; }
          }
          const response = await forwardBrowserRequest(url, request.method(), headers, request.postDataBuffer());
          await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
        });
        await nativeIngress?.listen();
        await control(pair);
        const page = await browserContext.newPage();
        page.on("pageerror", error => pageErrors.push({ name: error.name, message: error.message, stack: error.stack }));
        await page.goto(visibleOrigin + "/en-CA/browser-proof");
        await page.getByRole("button", { name: "Send vital" }).waitFor();
        if (nativeIngress) assert.deepEqual(nativeIngress.documents, [{ url: visibleOrigin + "/en-CA/browser-proof", cookieAvailable: true }]);
        const platform = await page.evaluate(() => ({ secureContext: isSecureContext, randomUUID: typeof crypto.randomUUID }));
        assert.deepEqual(platform, { secureContext: !transportOnly, randomUUID: transportOnly ? "undefined" : "function" });
        browserOutcomes.push({ origin: visibleOrigin, kind: "native-platform", ...platform, transportOnly });
        if (transportOnly) await page.waitForFunction(() => typeof window.sendObservabilityEnvelopeForProof === "function");
        async function send(name) {
          if (nativeIngress) {
            const completed = page.waitForResponse(response => response.url() === visibleOrigin + "/api/observability" && isControlledDiagnostic(response.request().postDataJSON()), { timeout: 30_000 });
            const [, response] = await Promise.all([page.getByRole("button", { name }).click(), completed]);
            assert.equal(diagnostics.length, 1);
            const entry = diagnostics[0];
            assert.ok(nativeIngress.completions.has(entry));
            await bounded(nativeIngress.completions.get(entry), "native response finish");
            assert.equal(entry.nativeResponseFinished, true);
            assert.equal(response.status(), entry.workerResponse.status);
            assert.equal(entry.url, response.request().url()); assert.equal(entry.method, "POST");
            assert.equal(entry.bodySha256, digest(response.request().postDataBuffer()));
            assert.equal(entry.forwarding.bodySha256, entry.bodySha256);
            assert.deepEqual(entry.forwarding.headers, entry.received);
            assert.equal(entry.received.host, new URL(visibleOrigin).host); assert.equal(entry.received.origin, visibleOrigin);
            assert.equal(entry.received["sec-fetch-site"], "same-origin"); assert.equal(entry.received["sec-fetch-mode"], "same-origin"); assert.equal(entry.received["sec-fetch-dest"], "empty");
            assert.equal(entry.envelopeType, name === "Send error" ? "error-report" : "operational-event");
            assert.equal(entry.eventName, name === "Send error" ? "browser.caught.error" : "browser.web.vital");
            return response.status();
          }
          const finished = new Promise((resolve, reject) => {
            const timer = setTimeout(() => { cleanup(); reject(new Error("Controlled diagnostic did not settle")); }, 30_000);
            const cleanup = () => { clearTimeout(timer); page.off("requestfinished", settle); page.off("requestfailed", settle); };
            const settle = request => {
              if (new URL(request.url()).pathname !== "/api/observability") return;
              const body = request.postDataJSON();
              if (!isControlledDiagnostic(body)) return;
              cleanup(); resolve(request);
            };
            page.on("requestfinished", settle); page.on("requestfailed", settle);
          });
          if (transportOnly) {
            // Transport only: insecure HTTP cannot create native UUID-backed events.
            assert.equal(await page.evaluate(value => window.sendObservabilityEnvelopeForProof(value), name === "Send vital" ? vital : envelope.value), true);
          } else {
            await page.getByRole("button", { name }).click();
          }
          return (await (await finished).response())?.status();
        }
        for (const kind of ["Send vital", "Send error"]) {
          await bounded(control(pair), "controlled Worker setup"); diagnostics.length = 0;
          const status = await send(kind);
          assert.equal(status, 202);
          assert.equal(diagnostics.length, 1);
          assert.equal(diagnostics[0].cookie, target === "staging" && visibleOrigin === origin); assert.equal(diagnostics[0].referrer, false);
          const value = await bounded(observed(), "controlled Worker observations"); assert.equal(value.attempts, 1);
          assert.equal(value.records.length, 1);
          assert.equal(value.records[0].name, kind === "Send error" ? "browser.caught.error" : "browser.web.vital");
          assert.equal(value.records[0].environment, target);
          assert.deepEqual(value.providerEnvironments, [target]);
          assert.equal(value.restrictedReports, kind === "Send error" ? 1 : 0);
          browserOutcomes.push({ origin: visibleOrigin, kind, status, transportOnly, ...diagnostics[0], ...value });
        }
        if (target === "staging" && visibleOrigin === origin) {
          const contactFinished = page.waitForResponse("https://api.web3forms.com/submit");
          await page.getByRole("button", { name: "Send contact" }).click(); await contactFinished;
          assert.deepEqual(contactRequests, [{ cookie: false, referrer: false }]);
          browserOutcomes.push({ kind: "web3forms-credentials-omitted", ...contactRequests[0] });
          await page.evaluate(() => { const base = document.createElement("base"); base.href = "https://external.observability.test/"; document.head.prepend(base); });
          await control({ ...pair, APPLICATION_ENVIRONMENT: "production" }); diagnostics.length = 0;
          await send("Send vital"); assert.equal(diagnostics[0].cookie, true);
          assert.equal((await observed()).attempts, 0); assert.equal((await observed()).records.length, 0);
          for (const location of [origin + "/redirect-proof", "https://external.observability.test/redirect-proof"]) {
            redirect = location; diagnostics.length = 0; await send("Send error");
            assert.equal(diagnostics.length, 1); assert.equal(forbidden.length, 0);
            browserOutcomes.push({ kind: "redirect-refused", crossOrigin: !location.startsWith(origin + "/"), cookie: diagnostics[0].cookie });
          }
        }
        assert.equal(forbidden.length, 0);
        browserOutcomes.push({ origin: visibleOrigin, kind: transportOnly ? "automatic-capture-unavailable" : "automatic-vitals-credential-check", count: nativeIngress?.automaticVitals ?? automaticVitals });
      } finally {
        const cleanup = await Promise.allSettled([bounded(browserContext.close(), "browser context closure"), nativeIngress?.close()]);
        for (const result of cleanup) if (result.status === "rejected") failures.push({ origin: visibleOrigin, scope: "browser-row-cleanup", name: result.reason.name, message: result.reason.message });
        for (const failure of nativeIngress?.failures ?? []) failures.push({ origin: visibleOrigin, scope: "native-ingress", ...failure });
        if (nativeIngress) browserOutcomes.push({ origin: visibleOrigin, kind: "native-ingress", documents: nativeIngress.documents, failures: nativeIngress.failures });
        browserOutcomes.push({ origin: visibleOrigin, kind: "page-errors", errors: pageErrors });
        assert.deepEqual(failures, []);
      }
      for (const error of pageErrors) {
        assert.equal(transportOnly, true, error.message);
        assert.equal(error.name, "TypeError");
        assert.match(error.message, /crypto\.randomUUID is not a function/u);
      }
    }
    completed = true;
  } finally {
    const cleanup = await Promise.allSettled([bounded(browser?.close(), "browser closure"), bounded(server.close(), "Worker closure")]);
    for (const result of cleanup) if (result.status === "rejected") failures.push({ scope: "harness-cleanup", name: result.reason.name, message: result.reason.message });
    await writeFile(process.argv[2], JSON.stringify({ target, completed: completed && failures.length === 0, outcomes, browserOutcomes, failures, providerTraffic: false, realAccessSession: false }, null, 2));
    assert.deepEqual(failures, []);
  }
}

function instrumentObservabilityWorker(worker) {
  let overrides = {};
  let omissions = [];
  let behavior = "accept";
  let observations;
  function reset() {
    observations = { attempts: 0, records: [], providerEnvironments: [], restrictedReports: 0, unsafeRecord: false, unexpectedOutbound: 0 };
  }
  reset();
  globalThis.fetch = async (input, options) => {
    const url = typeof input === "string" ? input : input.url ?? String(input);
    if (url !== "https://s123.eu-nbg-2.betterstackdata.com") {
      observations.unexpectedOutbound += 1;
      throw new Error("Unexpected outbound attempt");
    }
    observations.attempts += 1;
    const body = JSON.parse(String(options?.body));
    observations.providerEnvironments.push(body.environment);
    if (body["exception.fingerprint"]) observations.restrictedReports += 1;
    if (options?.redirect !== "error") throw new Error("Redirect refusal missing");
    if (behavior === "reject") return new Response(null, { status: 403 });
    if (behavior === "throw") throw new Error("Controlled transport failure");
    if (behavior === "timeout") return new Promise((_, reject) => {
      options.signal.addEventListener("abort", () => reject(new Error("Controlled timeout")), { once: true });
    });
    return new Response(null, { status: 202 });
  };
  console.info = record => {
    if (!record || typeof record !== "object" || typeof record.event_name !== "string") return;
    observations.unsafeRecord ||= Object.keys(record).some(key => key.startsWith("exception.") || ["message", "stack", "cookie", "authorization"].includes(key));
    observations.records.push({ name: record.event_name, environment: record.environment });
  };
  return { async fetch(incoming, env, context) {
    const path = new URL(incoming.url).pathname;
    if (path === "/__proof/control") {
      const input = await incoming.json();
      overrides = input.overrides ?? {}; omissions = input.omissions ?? []; behavior = input.behavior ?? "accept"; reset();
      return Response.json({ configured: true });
    }
    if (path === "/__proof/observations") return Response.json(observations);
    const runtime = { ...env, ...overrides };
    for (const key of omissions) delete runtime[key];
    const tasks = [];
    const url = new URL(incoming.headers.get("x-observability-proof-url") ?? incoming.url);
    const headers = new Headers(incoming.headers);
    headers.set("host", url.host); headers.set("x-forwarded-host", url.host); headers.set("x-forwarded-proto", url.protocol.slice(0, -1));
    const request = new Request(url, { ...incoming, method: incoming.method, headers, body: incoming.body, redirect: "manual" });
    const response = await worker.fetch(request, runtime, {
      waitUntil(task) { tasks.push(Promise.resolve(task)); context.waitUntil(task); },
      passThroughOnException() { context.passThroughOnException(); },
    });
    await Promise.allSettled(tasks);
    return response;
  } };
}
test("environment observability generation preserves diagnostics isolation", { timeout: 90 * 60 * 1000 }, async context => {
  const owner = await realpath(await mkdtemp(join(tmpdir(), "egeria-environment-observability-")));
  context.diagnostic("Retained observability evidence: " + owner);
  const supportRoot = join(owner, "support");
  await mkdir(supportRoot);
  const support = await prepareLiveSupport(supportRoot);
  const environment = { ...support.environment, ...await derivePnpmToolEnvironment("pnpm"), WRANGLER_SEND_METRICS: "false", WRANGLER_LOG_PATH: join(owner, "wrangler.log") };
  const commands = [];
  const receipts = [];
  const digest = bytes => createHash("sha256").update(bytes).digest("hex");
  async function command(label, executable, arguments_, cwd = owner, additions = {}) {
    try {
      const result = await execFileAsync(executable, arguments_, { cwd, encoding: "utf8", maxBuffer: 8 * 1024 * 1024, timeout: 25 * 60 * 1000, env: { ...environment, ...additions } });
      await writeFile(join(owner, label + ".log"), result.stdout + result.stderr);
      commands.push({ label, executable, arguments: arguments_, exitCode: 0 });
      return result.stdout;
    } catch (error) {
      await writeFile(join(owner, label + ".log"), (error.stdout ?? "") + (error.stderr ?? ""));
      commands.push({ label, executable, arguments: arguments_, exitCode: error.code });
      throw error;
    } finally { await writeFile(join(owner, "commands.json"), JSON.stringify(commands, null, 2)); }
  }
  const cliUrl = new URL("../../../apps/cli/dist/run-cli.js", import.meta.url).href;
  const coreUrl = new URL("../dist/index.js", import.meta.url).href;
  async function cli(label, arguments_) {
    const source = "import { createCliRunner } from " + JSON.stringify(cliUrl) + ";\n" +
      "import { createPnpmGeneratedProjectVerifier } from " + JSON.stringify(coreUrl) + ";\n" +
      'const run = createCliRunner({ createVerifier: () => createPnpmGeneratedProjectVerifier({ pnpmExecutable: "pnpm" }) }, "2.0.0");\n' +
      "process.exitCode = await run(" + JSON.stringify(arguments_) + ", { write: value => process.stdout.write(value), writeError: value => process.stderr.write(value) });";
    return JSON.parse(await command(label, process.execPath, ["--input-type=module", "-e", source]));
  }
  async function record(label, root) {
    const state = JSON.parse(await readFile(join(root, ".egeria/state.json"), "utf8"));
    const versions = Object.fromEntries(state.installedCapabilities.map(({ identifier, version }) => [identifier, version]));
    assert.equal(versions.observability, "0.4.0");
    for (const operation of ["infer", "doctor"]) assert.equal((await cli(label + "-" + operation, [operation, "--directory", root])).ok, true);
    receipts.push({ label, root, versions, verification: state.lastSuccessfulVerification, stateSha256: digest(await readFile(join(root, ".egeria/state.json"))), lockSha256: digest(await readFile(join(root, "pnpm-lock.yaml"))) });
    await writeFile(join(owner, "generation-receipts.json"), JSON.stringify(receipts, null, 2));
  }
  const portfolio = join(owner, "portfolio");
  assert.equal((await cli("portfolio-create", ["create", "--profile", "portfolio", "--name", "observability-example", "--display-name", "Observability Example", "--directory", portfolio])).ok, true);
  await record("portfolio", portfolio);
  const primary = join(owner, "app-primary");
  assert.equal((await cli("app-create", ["create", "--profile", "app", "--name", "observability-example", "--display-name", "Observability Example", "--directory", primary, "--transactional-email-resend", "--application-persistence", "--contact-form-web3forms", "--booking-calendly", "--calendly-mode", "link", "--google-analytics-4", "--multilingual"])).ok, true);
  await record("app", primary);
  await command("fixture-init", "git", ["init", "--initial-branch=main", primary]);
  await command("fixture-name", "git", ["config", "user.name", "Observability Integration Test"], primary);
  await command("fixture-email", "git", ["config", "user.email", "observability-test@example.test"], primary);
  await command("fixture-add", "git", ["add", "-A"], primary);
  await command("fixture-commit", "git", ["commit", "-m", "Preserve generated observability fixture"], primary);
  const linked = join(owner, "app-linked");
  await command("fixture-worktree", "git", ["worktree", "add", "-b", "observability-neighbor-check", linked], primary);
  const sharedPaths = ["pnpm-lock.yaml", "docs/observability.md", "apps/web/src/infrastructure/observability/server-reporter.ts", "apps/web/src/infrastructure/observability/browser-reporter.ts", "apps/web/src/infrastructure/cloudflare/observability-context.ts", "apps/web/src/configuration/application-database.ts", "apps/web/src/infrastructure/observability/transactional-email-events.ts"];
  const preserved = new Map(await Promise.all(sharedPaths.map(async path => [path, await readFile(join(linked, path))])));
  for (const operation of ["remove", "add"]) {
    const arguments_ = ["--directory", linked, "--capability", "booking-calendly", ...(operation === "add" ? ["--calendly-mode", "link"] : [])];
    const envelope = await cli("booking-" + operation + "-plan", ["plan-" + operation, ...arguments_]);
    const plan = operation === "add" ? envelope.result : envelope.plan;
    const result = await cli("booking-" + operation + "-apply", ["apply-" + operation, ...arguments_, "--approved-plan", plan.planFingerprint]);
    assert.equal(result.ok, true);
    assert.equal(result.result.status, "verified-final-diff-approval-required");
    await record("booking-" + operation, linked);
    for (const [path, bytes] of preserved) assert.deepEqual(await readFile(join(linked, path)), bytes, path);
    await command("booking-" + operation + "-add", "git", ["add", "-A"], linked);
    await command("booking-" + operation + "-commit", "git", ["commit", "-m", "Verify booking " + operation + " preserves observability"], linked);
  }
  for (const [path, bytes] of preserved) assert.deepEqual(await readFile(join(primary, path)), bytes, path);
  const project = join(owner, "worker-browser-proof");
  await cp(linked, project, { recursive: true, filter: source => ![".git", "node_modules", ".next", ".open-next", ".wrangler"].includes(source.split("/").at(-1)) });
  const app = join(project, "apps/web");
  await mkdir(join(app, "app/api/observability-proof"));
  await writeFile(join(app, "app/api/observability-proof/route.ts"), [
    'import { reportCaughtServerError } from "@/src/infrastructure/observability/server-reporter";',
    'import { reportTransactionalEmailEvent } from "@/src/infrastructure/observability/transactional-email-events";',
    'export const dynamic = "force-dynamic";',
    'export async function POST(request: Request) {',
    '  if (new URL(request.url).searchParams.has("email")) await reportTransactionalEmailEvent({ outcome: "accepted" });',
    '  else await reportCaughtServerError(new Error("Synthetic server failure"), { operation: "proof-load" });',
    '  return new Response(null, { status: 204 });',
    '}',
  ].join("\n"));
  const browserInstrumentation = await prepareObservabilityBrowserProof(app);
  const wrapper = 'import worker from "./.open-next/worker.js";\nexport default (' + instrumentObservabilityWorker.toString() + ")(worker);\n";
  const harness = "(" + runObservabilityProofHarness.toString() + ")();\n";
  await writeFile(join(app, "observability-proof-worker.mjs"), wrapper);
  await writeFile(join(app, "observability-proof.mjs"), harness);
  await command("proof-install", "pnpm", ["install", "--frozen-lockfile", "--store-dir", support.store], project);
  await command("proof-browser-install", "pnpm", ["--dir", "apps/web", "run", "browser:install"], project);
  await command("guide-unit-examples", "pnpm", ["--dir", "apps/web", "run", "test:unit", "tests/unit/observability-environment.test.ts", "tests/unit/server-transactional-email.test.ts", "tests/unit/transactional-email-events.test.ts"], project);
  async function hashTree(root) {
    const paths = (await readdir(root, { recursive: true, withFileTypes: true })).filter(entry => entry.isFile()).map(entry => join(entry.parentPath, entry.name)).sort();
    const hash = createHash("sha256");
    for (const path of paths) hash.update(path.slice(root.length)).update(await readFile(path));
    return { sha256: hash.digest("hex"), files: paths.length };
  }
  const sources = { browserInstrumentation, source: await hashTree(join(app, "src")), routes: await hashTree(join(app, "app")), wrapper: digest(Buffer.from(wrapper)), harness: digest(Buffer.from(harness)) };
  const artifacts = [];
  for (const target of ["development", "staging", "production"]) {
    const build = { APPLICATION_ENVIRONMENT: target, NEXT_PUBLIC_SITE_URL: "https://" + target + ".observability.test", NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: "00000000-0000-4000-8000-000000000001", NEXT_PUBLIC_CALENDLY_URL: "https://calendly.com/egeria-synthetic-nonproduction/intro", NEXT_PUBLIC_ANALYTICS_ENABLED: "false", NEXT_PUBLIC_GA4_MEASUREMENT_ID: "G-TEST123456" };
    await command(target + "-next", "pnpm", ["--dir", "apps/web", "run", "build"], project, build);
    await command(target + "-opennext", "pnpm", ["--dir", "apps/web", "exec", "opennextjs-cloudflare", "build", "--skipNextBuild"], project, { ...build, ...(target === "development" ? {} : { CLOUDFLARE_ENV: target }) });
    const artifact = { target, ...sources, completeWorkerTree: await hashTree(join(app, ".open-next")), workerSha256: digest(await readFile(join(app, ".open-next/worker.js"))), static: await hashTree(join(app, ".open-next/assets")) };
    await command(target + "-runtime-browser", process.execPath, [join(app, "observability-proof.mjs"), join(owner, target + "-outcomes.json")], app, { APPLICATION_ENVIRONMENT: target, NEXT_PUBLIC_APPLICATION_ENVIRONMENT: "contradictory", NEXT_PUBLIC_SITE_URL: "https://different.observability.test" });
    assert.deepEqual(await hashTree(join(app, ".open-next")), artifact.completeWorkerTree);
    assert.deepEqual(await hashTree(join(app, "src")), sources.source);
    assert.deepEqual(await hashTree(join(app, "app")), sources.routes);
    assert.equal(digest(await readFile(join(app, "observability-proof-worker.mjs"))), sources.wrapper);
    assert.equal(digest(await readFile(join(app, "observability-proof.mjs"))), sources.harness);
    artifacts.push(artifact);
    await writeFile(join(owner, "artifact-evidence.json"), JSON.stringify(artifacts, null, 2));
  }
  context.diagnostic(JSON.stringify({ owner, receipts: receipts.length, targets: artifacts.map(({ target }) => target), providerTraffic: false, realAccessSession: false }));
});

const publicRegistry = "https://registry.npmjs.org/";
const packages = [
  {
    name: "@egeria-systems/standards",
    version: "0.1.0",
    integrity:
      "sha512-BmDwcX0T6KT271C4N24jCKn6ymKTqDAFpJjsG6LNpmIoTAz0xApIcqpHFl9dHOqlB2xdhdHwKYfSiELUp04E0Q==",
    directory: "packages/standards",
    hasAttestations: false,
  },
  {
    name: "@egeria-systems/observability",
    version: "0.3.0",
    integrity:
      "sha512-AnqIa6qn1aLYuntoQ1zo9A80ioiStR2mKJg5mq/v/NrKNAFQf" +
      "P" +
      "7InXojel9Azst3lLDUUdyDuEDFmCIgyWDwrA==",
    directory: "packages/observability",
    hasAttestations: true,
  },
];

function assertSuccess(result) {
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  return result.value;
}

function createLiveEnvironment(supportRoot) {
  const environment = {
    CI: "true",
    NEXT_TELEMETRY_DISABLED: "1",
    HOME: join(supportRoot, "home"),
    USERPROFILE: join(supportRoot, "home"),
    TMPDIR: join(supportRoot, "temporary"),
    TMP: join(supportRoot, "temporary"),
    TEMP: join(supportRoot, "temporary"),
    NPM_CONFIG_REGISTRY: publicRegistry,
    NPM_CONFIG_USERCONFIG: join(supportRoot, ".npmrc"),
  };

  for (const key of ["PATH", "LANG", "SystemRoot", "ComSpec", "PATHEXT"]) {
    if (process.env[key] !== undefined) {
      environment[key] = process.env[key];
    }
  }

  return environment;
}

async function prepareLiveSupport(root) {
  const environment = createLiveEnvironment(root);
  await mkdir(environment.HOME, { recursive: true, mode: 0o700 });
  await mkdir(environment.TMPDIR, { mode: 0o700 });
  await mkdir(join(root, "store"), { mode: 0o700 });
  await writeFile(environment.NPM_CONFIG_USERCONFIG, "");
  return { environment, store: join(root, "store") };
}

async function runPnpm(arguments_, options) {
  return execFileAsync("pnpm", arguments_, {
    ...options,
    encoding: "utf8",
    maxBuffer: 5 * 1024 * 1024,
    shell: false,
    timeout: 15 * 60 * 1000,
    windowsHide: true,
  });
}

async function fetchPackageManifest(packageName, version) {
  const response = await fetch(
    `${publicRegistry}${encodeURIComponent(packageName)}/${version}`,
    { signal: AbortSignal.timeout(30_000) },
  );
  assert.equal(response.ok, true, `${packageName}: ${response.status}`);
  return response.json();
}

async function assertAbsent(path) {
  await assert.rejects(lstat(path), { code: "ENOENT" });
}

async function validatePublicGraph(owner, profile, destination) {
  const validationRoot = join(owner, `${profile}-audit-project`);
  const supportRoot = join(owner, `${profile}-audit-support`);
  await cp(destination, validationRoot, {
    recursive: true,
    force: false,
    errorOnExist: true,
    dereference: false,
  });
  await mkdir(supportRoot, { mode: 0o700 });
  const support = await prepareLiveSupport(supportRoot);

  await runPnpm(
    ["install", "--frozen-lockfile", "--store-dir", support.store],
    { cwd: validationRoot, env: support.environment },
  );
  await runPnpm(["audit", "--audit-level", "moderate"], {
    cwd: validationRoot,
    env: support.environment,
  });
  await runPnpm(["audit", "signatures"], {
    cwd: validationRoot,
    env: support.environment,
  });
}

test("public portfolio and site projects install, build, audit, and infer", async (context) => {
  const owner = await mkdtemp(join(tmpdir(), "egeria-public-generation-"));

  try {
    for (const expectedPackage of packages) {
      const manifest = await fetchPackageManifest(
        expectedPackage.name,
        expectedPackage.version,
      );
      assert.equal(manifest.name, expectedPackage.name);
      assert.equal(manifest.version, expectedPackage.version);
      assert.equal(manifest.license, "Apache-2.0");
      assert.deepEqual(manifest.repository, {
        type: "git",
        url: "git+https://github.com/Egeria-Systems/egeria-scaffold.git",
        directory: expectedPackage.directory,
      });
      assert.equal(manifest.dist.integrity, expectedPackage.integrity);
      assert.ok(manifest.dist.signatures.length > 0);
      assert.equal(
        manifest.dist.attestations !== undefined,
        expectedPackage.hasAttestations,
      );
    }

    const lockfileHashes = {};

    for (const profile of ["portfolio", "site"]) {
      const destination = join(owner, profile);
      const generated = assertSuccess(
        await generateProject({
          request: {
            profile,
            projectName: `public-${profile}`,
            displayName: `Public ${profile}`,
          },
          destination,
          verifier: createPnpmGeneratedProjectVerifier({
            pnpmExecutable: "pnpm",
          }),
        }),
      );
      assert.equal(
        generated.state.managedSurfaces.length,
        profile === "portfolio" ? 106 : 123,
      );

      const lockfile = await readFile(join(destination, "pnpm-lock.yaml"));
      const lockfileText = lockfile.toString("utf8");
      for (const expectedPackage of packages) {
        assert.ok(lockfileText.includes(expectedPackage.name));
        assert.ok(lockfileText.includes(expectedPackage.integrity));
      }
      lockfileHashes[profile] = createHash("sha256")
        .update(lockfile)
        .digest("hex");

      for (const path of [
        "node_modules",
        "apps/web/node_modules",
        "apps/web/.next",
        "apps/web/.open-next",
        "apps/web/.wrangler",
        ".pnpm-store",
      ]) {
        await assertAbsent(join(destination, path));
      }

      const snapshot = assertSuccess(await readVerifiedProjectSnapshot(
        createFileSystemRepositoryReader(generated.destination),
      ));
      const inference = await inferRepository({ reader: snapshot.reader, catalog: snapshot.catalog });
      assert.equal(inference.state.kind, "valid");
      assert.ok(
        inference.capabilities.every(
          ({ category }) => category === "confirmed",
        ),
      );
      assert.ok(
        inference.surfaces.every(({ status }) =>
          ["confirmed", "application-owned"].includes(status),
        ),
      );

      await validatePublicGraph(owner, profile, destination);
    }

    context.diagnostic(
      JSON.stringify({
        packageIntegrities: Object.fromEntries(
          packages.map(({ name, integrity }) => [name, integrity]),
        ),
        lockfileHashes,
      }),
    );
  } finally {
    await rm(owner, { recursive: true, force: true });
  }
});

test("application environment generation validates real target builds and the same Worker across runtime configurations", { timeout: 30 * 60 * 1000 }, async (context) => {
  const owner = await mkdtemp(join(tmpdir(), "egeria-application-environment-"));
  context.diagnostic(`Retained local evidence: ${owner}`);
  const commands = [];
  const renderingContext = createApplicationEnvironmentRenderingContext();
  const destination = join(owner, "generated");
  const generated = assertSuccess(await generateProject({
    request: { profile: "app", projectName: "environment-example", displayName: "Environment Example" },
    destination, renderingContext,
    verifier: createPnpmGeneratedProjectVerifier({ pnpmExecutable: "pnpm" }),
  }));
  assert.equal(generated.state.schemaVersion, "2.0.0");
  const snapshot = assertSuccess(await readVerifiedProjectSnapshot(createFileSystemRepositoryReader(destination), renderingContext));
  const inference = await inferRepository({ reader: snapshot.reader, catalog: snapshot.catalog, projectSchemaVersion: "2.0.0" });
  assert.equal(inference.state.kind, "valid");
  assert.ok(inference.capabilities.every(({ category }) => category === "confirmed"));
  assert.ok(inference.surfaces.every(({ status }) => status === "confirmed" || status === "application-owned"));
  await writeFile(join(owner, "generation-state.json"), JSON.stringify(generated.state, null, 2));

  const project = join(owner, "browser-proof");
  await cp(destination, project, { recursive: true, force: false, errorOnExist: true, dereference: false });
  const supportRoot = join(owner, "support");
  await mkdir(supportRoot);
  const support = await prepareLiveSupport(supportRoot);
  const environment = { ...support.environment, ...await derivePnpmToolEnvironment("pnpm"), WRANGLER_SEND_METRICS: "false" };
  async function run(name, arguments_, additions = {}) {
    const command = { name, arguments: arguments_, applicationEnvironment: additions.APPLICATION_ENVIRONMENT ?? "loaded-by-next-or-default" };
    try {
      const result = await runPnpm(arguments_, { cwd: project, env: { ...environment, ...additions } });
      await writeFile(join(owner, `${name}.log`), result.stdout + result.stderr);
      commands.push({ ...command, exitCode: 0 });
    } catch (error) {
      await writeFile(join(owner, `${name}.log`), (error.stdout ?? "") + (error.stderr ?? ""));
      commands.push({ ...command, exitCode: error.code });
      throw error;
    } finally { await writeFile(join(owner, "commands.json"), JSON.stringify(commands, null, 2)); }
  }
  const app = join(project, "apps/web");
  await mkdir(join(app, "app/environment-proof"));
  await writeFile(join(app, "app/environment-proof/page.tsx"), `"use client";
import { readCompiledApplicationEnvironment } from "@/src/configuration/application-environment";
export default function EnvironmentProof() {
  const target = readCompiledApplicationEnvironment();
  return <output data-application-environment={target.ok ? target.value : "invalid"}>{process.env.NEXT_PUBLIC_SITE_URL}</output>;
}
`);
  await writeFile(join(app, "tests/integration/browser-environment.test.ts"), `
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { createTestHarness } from "wrangler";

it("keeps the public build target and public values fixed when runtime configuration changes", async () => {
  const target = process.env.APPLICATION_ENVIRONMENT;
  if (target === undefined) throw new Error("Expected explicit proof target");
  const selected = "https://" + target + "-selected-public-sentinel.example";
  const forbidden = ["server-secret-sentinel", "runtime-secret-sentinel", "other-target-public-sentinel", "unloaded-staging-public-sentinel"];
  const workerBefore = await readFile(".open-next/worker.js");
  for (const runtime of [target, target === "production" ? "staging" : "production"]) {
    const server = createTestHarness({ workers: [{ configPath: "./wrangler.jsonc", vars: { APPLICATION_ENVIRONMENT: runtime }, secrets: { SERVER_ONLY_PROOF: "runtime-secret-sentinel" } }] });
    try {
      await server.listen();
      const response = await server.fetch("/environment-proof");
      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toContain('data-application-environment="' + target + '"');
      expect(body).toContain(selected);
      for (const sentinel of forbidden) expect(body).not.toContain(sentinel);
      const scripts = [...body.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1]).filter((path): path is string => path !== undefined);
      expect(scripts.length).toBeGreaterThan(0);
      let browserCode = "";
      for (const path of scripts) {
        const script = await server.fetch(path);
        expect(script.status).toBe(200);
        browserCode += await script.text();
      }
      expect(browserCode).toContain(selected);
      for (const sentinel of forbidden) expect(browserCode).not.toContain(sentinel);
      expect(await readFile(".open-next/worker.js")).toEqual(workerBefore);
    } finally { await server.close(); }
  }
}, 120_000);
`);
  await run("install", ["install", "--frozen-lockfile", "--store-dir", support.store]);
  await run("typecheck", ["--dir", "apps/web", "run", "typecheck"]);
  await run("unit", ["--dir", "apps/web", "run", "test:unit"]);
  await run("component", ["--dir", "apps/web", "run", "test:component"]);
  for (const target of ["development", "staging", "production"]) {
    const selected = `https://${target}-selected-public-sentinel.example`;
    await writeFile(join(app, ".env.local"), `APPLICATION_ENVIRONMENT=${target === "production" ? "staging" : target}\nNEXT_PUBLIC_SITE_URL=${selected}\nSERVER_ONLY_PROOF=server-secret-sentinel\n`);
    await writeFile(join(app, ".env.production"), "NEXT_PUBLIC_SITE_URL=https://other-target-public-sentinel.example\n");
    await writeFile(join(app, ".env.staging"), "NEXT_PUBLIC_SITE_URL=https://unloaded-staging-public-sentinel.example\n");
    await run(`${target}-preflight`, ["--dir", "apps/web", "run", target === "development" ? "check:environment" : "check:environment:deployment"], { APPLICATION_ENVIRONMENT: target });
    const buildEnvironment = target === "production" ? { APPLICATION_ENVIRONMENT: target } : {};
    await run(`${target}-next`, ["--dir", "apps/web", "run", "build"], buildEnvironment);
    await run(`${target}-opennext`, ["--dir", "apps/web", "exec", "opennextjs-cloudflare", "build", "--skipNextBuild"], { APPLICATION_ENVIRONMENT: target });
    await run(`${target}-worker`, ["--dir", "apps/web", "run", "test:integration:cloudflare"], { APPLICATION_ENVIRONMENT: target });
    const staticRoot = join(app, ".open-next/assets/_next/static");
    const staticFiles = await readdir(staticRoot, { recursive: true, withFileTypes: true });
    const buffers = await Promise.all(staticFiles.filter(entry => entry.isFile()).map(entry => readFile(join(entry.parentPath, entry.name))));
    const browserBytes = Buffer.concat(buffers);
    assert.ok(browserBytes.includes(selected));
    for (const sentinel of ["server-secret-sentinel", "runtime-secret-sentinel", "other-target-public-sentinel", "unloaded-staging-public-sentinel"]) assert.equal(browserBytes.includes(sentinel), false, sentinel);
    await writeFile(join(owner, `${target}-artifact.json`), JSON.stringify({ target, syntheticClientConsumer: true, staticFiles: buffers.length, browserSha256: createHash("sha256").update(browserBytes).digest("hex"), workerSha256: createHash("sha256").update(await readFile(join(app, ".open-next/worker.js"))).digest("hex") }, null, 2));
  }
});


test("environment contact builds freeze selected public values in controlled browser journeys", { timeout: 45 * 60 * 1000 }, async (context) => {
  const owner = await mkdtemp(join(tmpdir(), "egeria-environment-contact-"));
  context.diagnostic(`Retained contact evidence: ${owner}`);
  const renderingContext = createApplicationEnvironmentRenderingContext();
  const keyA = "00000000-0000-4000-8000-000000000001";
  const keyB = "00000000-0000-4000-8000-000000000002";
  const invalidKey = "invalid-contact-input-sentinel";
  const supportRoot = join(owner, "support");
  await mkdir(supportRoot);
  const support = await prepareLiveSupport(supportRoot);
  const environment = { ...support.environment, ...await derivePnpmToolEnvironment("pnpm"), WRANGLER_SEND_METRICS: "false" };
  const commands = [];
  const artifacts = [];
  const destination = join(owner, "generated");
  const generated = assertSuccess(await generateProject({
    request: { profile: "site", projectName: "contact-example", displayName: "Contact Example", multilingual: true, contactFormWeb3Forms: true },
    destination, renderingContext,
    verifier: createPnpmGeneratedProjectVerifier({ pnpmExecutable: "pnpm" }),
  }));
  assert.equal(generated.state.schemaVersion, "2.0.0");
  assert.equal(generated.state.installedCapabilities.find(value => value.identifier === "contact-form-web3forms")?.version, "0.2.0");
  await writeFile(join(owner, "generation-state.json"), JSON.stringify(generated.state, null, 2));
  const project = join(owner, "browser-proof");
  await cp(destination, project, { recursive: true, force: false, errorOnExist: true, dereference: false });
  const app = join(project, "apps/web");

  async function run(name, arguments_, additions = {}, succeeds = true, cwd = project) {
    let result;
    try {
      result = await runPnpm(arguments_, { cwd, env: { ...environment, ...additions } });
      commands.push({ name, arguments: arguments_, exitCode: 0 });
    } catch (error) {
      result = { stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
      commands.push({ name, arguments: arguments_, exitCode: error.code });
      if (succeeds) {
        await writeFile(join(owner, `${name}.log`), result.stdout + result.stderr);
        throw error;
      }
    } finally { await writeFile(join(owner, "commands.json"), JSON.stringify(commands, null, 2)); }
    await writeFile(join(owner, `${name}.log`), result.stdout + result.stderr);
    assert.equal(commands.at(-1).exitCode === 0, succeeds, name);
    return result;
  }

  async function sourceDigest() {
    const paths = await readdir(destination, { recursive: true, withFileTypes: true });
    const relativePaths = paths.filter(entry => entry.isFile())
      .map(entry => join(entry.parentPath, entry.name).slice(destination.length + 1)).sort();
    const digest = createHash("sha256");
    for (const path of relativePaths) {
      digest.update(path); digest.update(await readFile(join(project, path)));
    }
    return digest.digest("hex");
  }

  async function browser(name, mode, target, runtimeKey, expectedKey, cwd = project) {
    const reportPath = join(owner, `${name}.json`);
    await run(name, ["--dir", "apps/web", "run", `test:e2e:${mode}`, "--reporter=json", "web3forms-contact.spec.ts"], {
      APPLICATION_ENVIRONMENT: target,
      ...(mode === "dev" ? { WATCHPACK_POLLING: "true" } : {}),
      ...(mode === "preview" && target !== "development" ? { CLOUDFLARE_ENV: target } : {}),
      NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: runtimeKey,
      CONTACT_TEST_EXPECTED_ACCESS_KEY: expectedKey,
      PLAYWRIGHT_JSON_OUTPUT_FILE: reportPath,
    }, true, cwd);
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    assert.equal(report.stats.expected, expectedKey === "" ? 3 : 7, name);
    assert.equal(report.stats.unexpected, 0, name);
    assert.equal(report.stats.flaky, 0, name);
    return { executed: report.stats.expected, skipped: report.stats.skipped, expectedKey: expectedKey === "" ? "absent" : expectedKey === keyA ? "synthetic-A" : "synthetic-B" };
  }

  await run("install", ["install", "--frozen-lockfile", "--store-dir", support.store]);
  await run("browser-install", ["--dir", "apps/web", "run", "browser:install"]);
  // The state-last generator already ran actual lint, typecheck, unit/component and both builds in isolation.
  // These process checks exercise the selected preflight itself, without loading Next environment files.
  for (const target of ["development", "staging", "production"]) {
    for (const [label, key] of [["absent", ""], ["invalid", invalidKey], ["configured", keyA]]) {
      const succeeds = label === "configured" || (target === "development" && label === "absent");
      const result = await run(`${target}-${label}-preflight`, ["--dir", "apps/web", "run", target === "development" ? "check:environment" : "check:environment:deployment"], {
        APPLICATION_ENVIRONMENT: target, NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: key,
      }, succeeds);
      if (!succeeds) assert.match(result.stderr, /"code":"CONTACT_CONFIGURATION_INVALID","field":"NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY","reason":"(?:missing|invalid)"/u);
      assert.equal((result.stdout + result.stderr).includes(invalidKey), false);
      if (target !== "development" && label !== "configured") {
        const failedBuild = await run(`${target}-${label}-build`, ["--dir", "apps/web", "run", "build"], {
          APPLICATION_ENVIRONMENT: target, NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: key,
        }, false);
        assert.match(failedBuild.stderr, /CONTACT_CONFIGURATION_INVALID:NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY:(?:missing|invalid)/u);
        assert.equal((failedBuild.stdout + failedBuild.stderr).includes(invalidKey), false);
      }
    }
  }
  for (const command of ["check:environment", "build"]) {
    const conflict = await run(`target-conflict-${command.replace(":", "-")}`, ["--dir", "apps/web", "run", command], {
      APPLICATION_ENVIRONMENT: "staging", NEXT_PUBLIC_APPLICATION_ENVIRONMENT: "production", NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: invalidKey,
    }, false);
    assert.match(conflict.stderr, /APPLICATION_ENVIRONMENT_INVALID/u);
    assert.doesNotMatch(conflict.stderr, /CONTACT_CONFIGURATION_INVALID|invalid-contact-input-sentinel/u);
  }
  await browser("development-absent", "dev", "development", "", "");
  await browser("development-configured", "dev", "development", keyA, keyA);
  const sourceHash = await sourceDigest();
  for (const [target, buildKey, runtimeKey] of [["development", "", keyB], ["staging", keyA, keyB], ["production", keyB, keyA]]) {
    assert.equal(await sourceDigest(), sourceHash);
    await run(`${target}-next`, ["--dir", "apps/web", "run", "build"], {
      APPLICATION_ENVIRONMENT: target, NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: buildKey,
    });
    await run(`${target}-opennext`, ["--dir", "apps/web", "exec", "opennextjs-cloudflare", "build", "--skipNextBuild"], {
      APPLICATION_ENVIRONMENT: target, NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: buildKey,
      ...(target === "development" ? {} : { CLOUDFLARE_ENV: target }),
    });
    const worker = await readFile(join(app, ".open-next/worker.js"));
    const staticRoot = join(app, ".open-next/assets/_next/static");
    const entries = await readdir(staticRoot, { recursive: true, withFileTypes: true });
    const assets = await Promise.all(entries.filter(entry => entry.isFile()).map(entry => readFile(join(entry.parentPath, entry.name))));
    const before = createHash("sha256").update(worker).update(Buffer.concat(assets)).digest("hex");
    const observed = await browser(`${target}-prepared`, "preview", target, runtimeKey, buildKey);
    assert.deepEqual(await readFile(join(app, ".open-next/worker.js")), worker);
    assert.equal(await sourceDigest(), sourceHash);
    artifacts.push({ target, sourceHash, artifactHash: before, buildKey: buildKey === "" ? "absent" : buildKey === keyA ? "synthetic-A" : "synthetic-B", runtimeKey: runtimeKey === keyA ? "synthetic-A" : "synthetic-B", ...observed });
    await writeFile(join(owner, "artifacts.json"), JSON.stringify(artifacts, null, 2));
  }

  const portfolio = join(owner, "portfolio");
  assertSuccess(await generateProject({ request: { profile: "portfolio", projectName: "contact-portfolio", displayName: "Contact Portfolio", contactFormWeb3Forms: true },
    destination: portfolio, renderingContext, verifier: createPnpmGeneratedProjectVerifier({ pnpmExecutable: "pnpm" }),
  }));
  await run("portfolio-install", ["install", "--frozen-lockfile", "--store-dir", support.store], {}, true, portfolio);
  await browser("portfolio-configured", "dev", "development", keyA, keyA, portfolio);
  context.diagnostic(JSON.stringify({ owner, artifacts, portfolio: "configured one-page home and fallback; all provider requests intercepted" }));
});

for (const [profile, bookingMode, contact, multilingual] of [
  ["portfolio", "link", false, false],
  ["app", "inline", true, false],
  ["site", "popup", true, true],
]) {
  test(`environment booking builds freeze ${profile} selected values in controlled browsers`, { timeout: 60 * 60 * 1000 }, async context => {
    const owner = await mkdtemp(join(tmpdir(), `egeria-environment-booking-${profile}-`));
    context.diagnostic(`Retained booking evidence: ${owner}`);
    const urlA = "https://calendly.com/egeria-synthetic-nonproduction/intro";
    const urlB = "https://calendly.com/egeria-synthetic-production/intro";
    const keyA = "00000000-0000-4000-8000-000000000001";
    const keyB = "00000000-0000-4000-8000-000000000002";
    const invalidUrl = "invalid-booking-input-sentinel";
    const supportRoot = join(owner, "support");
    await mkdir(supportRoot);
    const support = await prepareLiveSupport(supportRoot);
    const environment = { ...support.environment, ...await derivePnpmToolEnvironment("pnpm"), WRANGLER_SEND_METRICS: "false" };
    const commands = [];
    const artifacts = [];
    const destination = join(owner, "generated");
    const generated = assertSuccess(await generateProject({
      request: { profile, projectName: `booking-${profile}`, displayName: "Booking Example", bookingCalendly: { mode: bookingMode },
        ...(contact ? { contactFormWeb3Forms: true } : {}), ...(multilingual ? { multilingual: true } : {}),
      },
      destination, renderingContext: createApplicationEnvironmentRenderingContext(),
      verifier: createPnpmGeneratedProjectVerifier({ pnpmExecutable: "pnpm" }),
    }));
    assert.equal(generated.state.schemaVersion, "2.0.0");
    assert.equal(generated.state.installedCapabilities.find(value => value.identifier === "booking-calendly")?.version, "0.2.0");
    await writeFile(join(owner, "generation-state.json"), JSON.stringify(generated.state, null, 2));
    const project = join(owner, "browser-proof");
    await cp(destination, project, { recursive: true, force: false, errorOnExist: true, dereference: false });
    const app = join(project, "apps/web");

    async function run(name, arguments_, additions = {}, succeeds = true) {
      let result;
      try {
        result = await runPnpm(arguments_, { cwd: project, env: { ...environment, ...additions } });
        commands.push({ name, arguments: arguments_, exitCode: 0 });
      } catch (error) {
        result = { stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
        commands.push({ name, arguments: arguments_, exitCode: error.code });
        if (succeeds) {
          await writeFile(join(owner, `${name}.log`), result.stdout + result.stderr);
          throw error;
        }
      } finally { await writeFile(join(owner, "commands.json"), JSON.stringify(commands, null, 2)); }
      await writeFile(join(owner, `${name}.log`), result.stdout + result.stderr);
      assert.equal(commands.at(-1).exitCode === 0, succeeds, name);
      return result;
    }

    const entries = await readdir(destination, { recursive: true, withFileTypes: true });
    const sourcePaths = entries.filter(entry => entry.isFile()).map(entry => join(entry.parentPath, entry.name).slice(destination.length + 1)).sort();
    async function sourceDigest() {
      const digest = createHash("sha256");
      for (const path of sourcePaths) { digest.update(path); digest.update(await readFile(join(project, path))); }
      return digest.digest("hex");
    }
    async function artifactDigest() {
      const staticRoot = join(app, ".open-next/assets");
      const entries = await readdir(staticRoot, { recursive: true, withFileTypes: true });
      const paths = entries.filter(entry => entry.isFile()).map(entry => join(entry.parentPath, entry.name).slice(staticRoot.length + 1)).sort();
      const digest = createHash("sha256");
      for (const path of paths) { digest.update(path); digest.update(await readFile(join(staticRoot, path))); }
      return { workerSha256: createHash("sha256").update(await readFile(join(app, ".open-next/worker.js"))).digest("hex"), staticSha256: digest.digest("hex"), staticFiles: paths.length };
    }
    async function browser(name, mode, target, runtimeUrl, expectedUrl, runtimeKey, expectedKey) {
      const reportPath = join(owner, `${name}.json`);
      await run(name, ["--dir", "apps/web", "run", `test:e2e:${mode}`, "--reporter=json", "--output", join(owner, `${name}-results`), "calendly-booking.spec.ts", ...(contact ? ["web3forms-contact.spec.ts"] : [])], {
        APPLICATION_ENVIRONMENT: target,
        ...(mode === "dev" ? { WATCHPACK_POLLING: "true" } : {}),
        ...(mode === "preview" && target !== "development" ? { CLOUDFLARE_ENV: target } : {}),
        NEXT_PUBLIC_CALENDLY_URL: runtimeUrl,
        NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: runtimeKey,
        BOOKING_TEST_EXPECTED_URL: expectedUrl,
        BOOKING_TEST_MODE: bookingMode,
        BOOKING_TEST_MULTILINGUAL: String(multilingual),
        CONTACT_TEST_EXPECTED_ACCESS_KEY: expectedKey,
        PLAYWRIGHT_JSON_OUTPUT_FILE: reportPath,
      });
      const report = JSON.parse(await readFile(reportPath, "utf8"));
      const bookingCount = (expectedUrl === "" ? 2 : bookingMode === "link" ? 3 : 5) * (multilingual ? 2 : 1);
      assert.equal(report.stats.expected, bookingCount + (contact ? expectedKey === "" ? 3 : 7 : 0), name);
      assert.equal(report.stats.unexpected, 0, name);
      assert.equal(report.stats.flaky, 0, name);
      const label = value => value === "" ? "absent" : value === urlA || value === keyA ? "synthetic-A" : "synthetic-B";
      return { executed: report.stats.expected, skipped: report.stats.skipped, expectedUrl: label(expectedUrl), expectedKey: label(expectedKey), runtimeUrl: label(runtimeUrl), runtimeKey: label(runtimeKey) };
    }

    await run("install", ["install", "--frozen-lockfile", "--store-dir", support.store]);
    await run("browser-install", ["--dir", "apps/web", "run", "browser:install"]);
    for (const target of ["development", "staging", "production"]) {
      for (const [label, url] of [["absent", ""], ["invalid", invalidUrl], ["configured", urlA]]) {
        const succeeds = label === "configured" || (target === "development" && label === "absent");
        const inputs = { APPLICATION_ENVIRONMENT: target, NEXT_PUBLIC_CALENDLY_URL: url, NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: contact ? keyA : "" };
        const result = await run(`${target}-${label}-preflight`, ["--dir", "apps/web", "run", target === "development" ? "check:environment" : "check:environment:deployment"], inputs, succeeds);
        if (!succeeds) assert.match(result.stderr, /"code":"BOOKING_CONFIGURATION_INVALID","field":"NEXT_PUBLIC_CALENDLY_URL","reason":"(?:missing|invalid)"/u);
        assert.equal((result.stdout + result.stderr).includes(invalidUrl), false);
        if (!succeeds) {
          const failed = await run(`${target}-${label}-build`, ["--dir", "apps/web", "run", "build"], inputs, false);
          assert.match(failed.stderr, /BOOKING_CONFIGURATION_INVALID:NEXT_PUBLIC_CALENDLY_URL:(?:missing|invalid)/u);
          assert.equal((failed.stdout + failed.stderr).includes(invalidUrl), false);
          await assertAbsent(join(app, ".open-next/worker.js"));
        }
      }
    }
    for (const command of ["check:environment", "build"]) {
      const conflict = await run(`target-conflict-${command.replace(":", "-")}`, ["--dir", "apps/web", "run", command], {
        APPLICATION_ENVIRONMENT: "staging", NEXT_PUBLIC_APPLICATION_ENVIRONMENT: "production", NEXT_PUBLIC_CALENDLY_URL: invalidUrl, NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: "invalid-contact-input-sentinel",
      }, false);
      assert.match(conflict.stderr, /APPLICATION_ENVIRONMENT_INVALID/u);
      assert.doesNotMatch(conflict.stderr, /BOOKING_CONFIGURATION_INVALID|CONTACT_CONFIGURATION_INVALID|invalid-booking-input-sentinel|invalid-contact-input-sentinel/u);
    }
    // This temporary copy is the app root Next actually reads; plain preflight must not load its local file.
    await writeFile(join(app, ".env.local"), `NEXT_PUBLIC_CALENDLY_URL=${invalidUrl}\n`);
    const localInputs = { APPLICATION_ENVIRONMENT: "development", NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: contact ? keyA : "" };
    await run("env-local-plain-preflight", ["--dir", "apps/web", "run", "check:environment"], localInputs);
    const localFileFailure = await run("env-local-next-build", ["--dir", "apps/web", "run", "build"], localInputs, false);
    assert.match(localFileFailure.stderr, /BOOKING_CONFIGURATION_INVALID:NEXT_PUBLIC_CALENDLY_URL:invalid/u);
    assert.equal((localFileFailure.stdout + localFileFailure.stderr).includes(invalidUrl), false);
    await rm(join(app, ".env.local"));

    const developments = multilingual ? [["neither", "", ""], ["booking-only", urlA, ""], ["contact-only", "", keyA], ["both", urlA, keyA]]
      : [["absent", "", ""], ["configured", urlA, contact ? keyA : ""]];
    for (const [label, url, key] of developments) await browser(`development-${label}`, "dev", "development", url, url, key, key);
    const sourceHash = await sourceDigest();
    for (const [target, buildUrl, runtimeUrl, buildKey, runtimeKey] of [
      ["development", "", urlB, "", contact ? keyB : ""],
      ["staging", urlA, urlB, contact ? keyA : "", contact ? keyB : ""],
      ["production", urlB, urlA, contact ? keyB : "", contact ? keyA : ""],
    ]) {
      assert.equal(await sourceDigest(), sourceHash);
      const inputs = { APPLICATION_ENVIRONMENT: target, NEXT_PUBLIC_CALENDLY_URL: buildUrl, NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: buildKey };
      await run(`${target}-next`, ["--dir", "apps/web", "run", "build"], inputs);
      await run(`${target}-opennext`, ["--dir", "apps/web", "exec", "opennextjs-cloudflare", "build", "--skipNextBuild"], {
        ...inputs, ...(target === "development" ? {} : { CLOUDFLARE_ENV: target }),
      });
      const before = await artifactDigest();
      const observed = await browser(`${target}-prepared`, "preview", target, runtimeUrl, buildUrl, runtimeKey, buildKey);
      assert.deepEqual(await artifactDigest(), before, "worker and sorted static assets must remain byte-identical after runtime challenge");
      assert.equal(await sourceDigest(), sourceHash);
      artifacts.push({ profile, bookingMode, target, sourceHash, ...before, ...observed });
      await writeFile(join(owner, "artifacts.json"), JSON.stringify(artifacts, null, 2));
    }
    context.diagnostic(JSON.stringify({ owner, artifacts, providers: "all third-party attempts intercepted before navigation" }));
  });
}

const environmentAnalyticsSelection = {
  consent: { policy: "explicit-opt-in" },
  providers: { cloudflareWebAnalytics: true, googleAnalytics4: true, microsoftClarity: { audience: "not-directed-to-minors" } },
  operationalIntegrations: { googleSearchConsole: true, lookerStudio: { connector: "google-analytics-4" } },
};

for (const [name, profile, contact, booking, multilingual, searchOnly] of [
  ["composed-site", "site", true, "popup", true, false],
  ["portfolio", "portfolio", false, undefined, false, false],
  ["application", "app", false, "inline", false, false],
  ["search-only", "site", false, undefined, false, true],
]) {
  test(`environment analytics builds freeze ${name} activation and destinations`, { timeout: 90 * 60 * 1000 }, async context => {
    const owner = await mkdtemp(join(tmpdir(), `egeria-environment-analytics-${name}-`));
    context.diagnostic(`Retained analytics evidence: ${owner}`);
    const supportRoot = join(owner, "support");
    await mkdir(supportRoot);
    const support = await prepareLiveSupport(supportRoot);
    const environment = { ...support.environment, ...await derivePnpmToolEnvironment("pnpm"), WRANGLER_SEND_METRICS: "false" };
    const commands = [];
    const artifacts = [];
    const identifiersA = {
      NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN: "0123456789abcdef0123456789abcdef",
      NEXT_PUBLIC_GA4_MEASUREMENT_ID: "G-TEST123456",
      NEXT_PUBLIC_CLARITY_PROJECT_ID: "qatest1234",
      NEXT_PUBLIC_SITE_URL: "https://qa.analytics-test.invalid",
      NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: "synthetic-nonproduction-verification",
      NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: contact ? "00000000-0000-4000-8000-000000000001" : "",
      NEXT_PUBLIC_CALENDLY_URL: booking === undefined ? "" : "https://calendly.com/egeria-synthetic-nonproduction/intro",
    };
    const identifiersB = {
      NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN: "fedcba9876543210fedcba9876543210",
      NEXT_PUBLIC_GA4_MEASUREMENT_ID: "G-PROD123456",
      NEXT_PUBLIC_CLARITY_PROJECT_ID: "prodtest1234",
      NEXT_PUBLIC_SITE_URL: "https://www.analytics-live.invalid",
      NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: "synthetic-production-verification",
      NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: contact ? "00000000-0000-4000-8000-000000000002" : "",
      NEXT_PUBLIC_CALENDLY_URL: booking === undefined ? "" : "https://calendly.com/egeria-synthetic-production/intro",
    };
    const analytics = searchOnly ? { consent: { policy: "explicit-opt-in" }, providers: {}, operationalIntegrations: { googleSearchConsole: true } } : environmentAnalyticsSelection;
    const destination = join(owner, "generated");
    const generated = assertSuccess(await generateProject({
      request: { profile, projectName: `analytics-${name}`, displayName: "Analytics Example", analytics,
        ...(contact ? { contactFormWeb3Forms: true } : {}), ...(booking === undefined ? {} : { bookingCalendly: { mode: booking } }), ...(multilingual ? { multilingual: true } : {}),
      }, destination, renderingContext: createApplicationEnvironmentRenderingContext(),
      verifier: createPnpmGeneratedProjectVerifier({ pnpmExecutable: "pnpm" }),
    }));
    assert.equal(generated.state.installedCapabilities.find(value => value.identifier === "analytics")?.version, "0.2.0");
    await writeFile(join(owner, "generation-state.json"), JSON.stringify(generated.state, null, 2));
    const project = join(owner, "browser-proof");
    await cp(destination, project, { recursive: true, force: false, errorOnExist: true, dereference: false });
    const app = join(project, "apps/web");
    async function run(label, arguments_, additions = {}, succeeds = true) {
      let result;
      try {
        result = await runPnpm(arguments_, { cwd: project, env: { ...environment, ...additions } });
        commands.push({ label, arguments: arguments_, exitCode: 0 });
      } catch (error) {
        result = { stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
        commands.push({ label, arguments: arguments_, exitCode: error.code });
        if (succeeds) { await writeFile(join(owner, `${label}.log`), result.stdout + result.stderr); throw error; }
      } finally { await writeFile(join(owner, "commands.json"), JSON.stringify(commands, null, 2)); }
      await writeFile(join(owner, `${label}.log`), result.stdout + result.stderr);
      assert.equal(commands.at(-1).exitCode === 0, succeeds, label);
      return result;
    }
    const entries = await readdir(destination, { recursive: true, withFileTypes: true });
    const sourcePaths = entries.filter(entry => entry.isFile()).map(entry => join(entry.parentPath, entry.name).slice(destination.length + 1)).sort();
    async function sourceDigest() {
      const hash = createHash("sha256");
      for (const path of sourcePaths) { hash.update(path); hash.update(await readFile(join(project, path))); }
      return hash.digest("hex");
    }
    async function artifactDigest() {
      const staticRoot = join(app, ".open-next/assets");
      const entries = await readdir(staticRoot, { recursive: true, withFileTypes: true });
      const paths = entries.filter(entry => entry.isFile()).map(entry => join(entry.parentPath, entry.name).slice(staticRoot.length + 1)).sort();
      const hash = createHash("sha256");
      for (const path of paths) { hash.update(path); hash.update(await readFile(join(staticRoot, path))); }
      return { workerSha256: createHash("sha256").update(await readFile(join(app, ".open-next/worker.js"))).digest("hex"), staticSha256: hash.digest("hex"), staticFiles: paths.length };
    }
    async function browser(label, mode, build, runtime) {
      const expectedOrigin = build.NEXT_PUBLIC_SITE_URL || "https://qa.analytics-test.invalid";
      const configPath = join(app, "playwright.analytics-acceptance.config.ts");
      await writeFile(configPath, `import config from "./playwright.preview.config";\nexport default { ...config, retries: 0, use: { ...config.use, baseURL: ${JSON.stringify(expectedOrigin)} }, ${mode === "dev" ? 'webServer: { command: "pnpm run dev --hostname 127.0.0.1 --port 3101", url: "http://127.0.0.1:3101", reuseExistingServer: false, timeout: 180000 },' : ""} };\n`);
      const reportPath = join(owner, `${label}.json`);
      await run(label, ["--dir", "apps/web", "exec", "playwright", "test", "--config", configPath, "tests/e2e/analytics-consent.spec.ts", "--reporter=json", "--output", join(owner, `${label}-results`)], {
        ...runtime,
        ...(mode === "dev" ? { WATCHPACK_POLLING: "true" } : {}),
        ...(mode === "preview" && build.APPLICATION_ENVIRONMENT !== "development" ? { CLOUDFLARE_ENV: build.APPLICATION_ENVIRONMENT } : {}),
        ANALYTICS_TEST_BUILD_FLAG: build.NEXT_PUBLIC_ANALYTICS_ENABLED,
        ANALYTICS_TEST_EXPECTED_CLOUDFLARE_TOKEN: searchOnly ? "" : build.NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN,
        ANALYTICS_TEST_EXPECTED_GA4_ID: searchOnly ? "" : build.NEXT_PUBLIC_GA4_MEASUREMENT_ID,
        ANALYTICS_TEST_EXPECTED_CLARITY_ID: searchOnly ? "" : build.NEXT_PUBLIC_CLARITY_PROJECT_ID,
        ANALYTICS_TEST_EXPECTED_SITE_ORIGIN: searchOnly ? "" : build.NEXT_PUBLIC_SITE_URL,
        ANALYTICS_TEST_EXPECTED_VERIFICATION: build.APPLICATION_ENVIRONMENT === "production" ? build.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION : "",
        ANALYTICS_TEST_TARGET: build.APPLICATION_ENVIRONMENT,
        CONTACT_TEST_EXPECTED_ACCESS_KEY: build.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY,
        BOOKING_TEST_EXPECTED_URL: build.NEXT_PUBLIC_CALENDLY_URL,
        ...(booking === undefined ? {} : { BOOKING_TEST_MODE: booking }),
        PLAYWRIGHT_JSON_OUTPUT_FILE: reportPath,
      });
      const report = JSON.parse(await readFile(reportPath, "utf8"));
      const active = build.NEXT_PUBLIC_ANALYTICS_ENABLED === "true" && build.NEXT_PUBLIC_GA4_MEASUREMENT_ID !== "";
      const expected = searchOnly ? 1 : 14 + (multilingual ? 2 : 1) * (active ? 2 : 1) + (active ? 1 : 0) + (contact || booking !== undefined ? 1 : 0);
      assert.equal(report.stats.expected, expected, label);
      assert.equal(report.stats.skipped, 0, label);
      assert.equal(report.stats.unexpected, 0, label);
      assert.equal(report.stats.flaky, 0, label);
      return { executed: report.stats.expected, skipped: report.stats.skipped, report: reportPath };
    }
    await run("install", ["install", "--frozen-lockfile", "--store-dir", support.store]);
    await run("browser-install", ["--dir", "apps/web", "run", "browser:install"]);
    if (name === "composed-site") {
      for (const [label, overrides, pattern] of [
        ["missing-active", { NEXT_PUBLIC_GA4_MEASUREMENT_ID: "" }, /ANALYTICS_CONFIGURATION_INVALID.*NEXT_PUBLIC_GA4_MEASUREMENT_ID.*missing/u],
        ["invalid-off", { NEXT_PUBLIC_ANALYTICS_ENABLED: "false", NEXT_PUBLIC_GA4_MEASUREMENT_ID: "invalid-analytics-input-sentinel" }, /ANALYTICS_CONFIGURATION_INVALID.*NEXT_PUBLIC_GA4_MEASUREMENT_ID.*invalid/u],
        ["production-verification", { APPLICATION_ENVIRONMENT: "production", NEXT_PUBLIC_ANALYTICS_ENABLED: "false", NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: "" }, /ANALYTICS_CONFIGURATION_INVALID.*NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION.*missing/u],
        ["target-conflict", { NEXT_PUBLIC_APPLICATION_ENVIRONMENT: "production", NEXT_PUBLIC_GA4_MEASUREMENT_ID: "invalid-analytics-input-sentinel" }, /APPLICATION_ENVIRONMENT_INVALID/u],
      ]) {
        for (const command of ["check:environment:deployment", "build"]) {
          const result = await run(`${label}-${command.replaceAll(":", "-")}`, ["--dir", "apps/web", "run", command], { ...identifiersA, APPLICATION_ENVIRONMENT: "staging", NEXT_PUBLIC_ANALYTICS_ENABLED: "true", ...overrides }, false);
          assert.match(result.stderr, pattern);
          assert.doesNotMatch(result.stdout + result.stderr, /invalid-analytics-input-sentinel/u);
        }
      }
      await writeFile(join(app, ".env.local"), "NEXT_PUBLIC_GA4_MEASUREMENT_ID=invalid-local-input-sentinel\n");
      const local = { APPLICATION_ENVIRONMENT: "development", NEXT_PUBLIC_ANALYTICS_ENABLED: "false" };
      await run("env-local-process-only", ["--dir", "apps/web", "run", "check:environment"], local);
      const rejected = await run("env-local-next-load", ["--dir", "apps/web", "run", "build"], local, false);
      assert.match(rejected.stderr, /ANALYTICS_CONFIGURATION_INVALID:NEXT_PUBLIC_GA4_MEASUREMENT_ID:invalid/u);
      assert.doesNotMatch(rejected.stdout + rejected.stderr, /invalid-local-input-sentinel/u);
      await rm(join(app, ".env.local")); // this test's own deliberately invalid input
      const partial = { ...identifiersA, APPLICATION_ENVIRONMENT: "development", NEXT_PUBLIC_ANALYTICS_ENABLED: "true", NEXT_PUBLIC_GA4_MEASUREMENT_ID: "", NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: "", NEXT_PUBLIC_CALENDLY_URL: "", NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3101" };
      await browser("development-missing-local-inputs", "dev", partial, partial);
    }
    const sourceHash = await sourceDigest();
    const matrix = searchOnly ? [["development", "false", identifiersA, identifiersB], ["staging", "false", identifiersA, identifiersB], ["production", "false", identifiersB, identifiersA]] :
      name === "composed-site" ? [["development", "false", identifiersA, identifiersB], ["staging", "true", identifiersA, identifiersB], ["production", "true", identifiersB, identifiersA]] :
        [["development", "false", identifiersA, identifiersB], ["development", "true", identifiersA, identifiersB]];
    for (const [target, flag, identifiers, contradiction] of matrix) {
      assert.equal(await sourceDigest(), sourceHash);
      const label = `${target}-${flag}`;
      const build = { ...identifiers, APPLICATION_ENVIRONMENT: target, NEXT_PUBLIC_ANALYTICS_ENABLED: flag };
      const runtime = { ...contradiction, APPLICATION_ENVIRONMENT: target, NEXT_PUBLIC_ANALYTICS_ENABLED: flag === "true" ? "false" : "true" };
      await run(`${label}-next`, ["--dir", "apps/web", "run", "build"], build);
      await run(`${label}-opennext`, ["--dir", "apps/web", "exec", "opennextjs-cloudflare", "build", "--skipNextBuild"], { ...build, ...(target === "development" ? {} : { CLOUDFLARE_ENV: target }) });
      const before = await artifactDigest();
      const staticEntries = await readdir(join(app, ".open-next/assets"), { recursive: true, withFileTypes: true });
      const chunks = [];
      for (const entry of staticEntries) if (entry.isFile() && entry.name.endsWith(".js")) chunks.push(await readFile(join(entry.parentPath, entry.name), "utf8"));
      const browserBytes = chunks.join("\n");
      if (!searchOnly) {
        for (const key of ["NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN", "NEXT_PUBLIC_GA4_MEASUREMENT_ID", "NEXT_PUBLIC_CLARITY_PROJECT_ID"]) {
          assert.ok(browserBytes.includes(identifiers[key]), key);
          assert.equal(browserBytes.includes(contradiction[key]), false, key);
        }
      }
      assert.equal(browserBytes.includes(identifiersA.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION), false);
      if (target !== "production") assert.equal(browserBytes.includes(identifiersB.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION), false);
      const observed = await browser(`${label}-runtime-challenge`, "preview", build, runtime);
      assert.deepEqual(await artifactDigest(), before);
      assert.equal(await sourceDigest(), sourceHash);
      artifacts.push({ name, profile, target, sourceHash, rawBuildFlag: flag, build, runtime, ...before, ...observed });
      await writeFile(join(owner, "artifacts.json"), JSON.stringify(artifacts, null, 2));
      if (name === "composed-site" && flag === "false") {
        const reportPath = join(owner, "disabled-neighbor-browser.json");
        await run("disabled-neighbor-browser", ["--dir", "apps/web", "run", "test:e2e:preview", "--reporter=json", "--output", join(owner, "disabled-neighbor-results"), "web3forms-contact.spec.ts", "calendly-booking.spec.ts"], {
          ...runtime, CONTACT_TEST_EXPECTED_ACCESS_KEY: build.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY, BOOKING_TEST_EXPECTED_URL: build.NEXT_PUBLIC_CALENDLY_URL,
          BOOKING_TEST_MODE: booking, BOOKING_TEST_MULTILINGUAL: String(multilingual), PLAYWRIGHT_JSON_OUTPUT_FILE: reportPath,
        });
        const report = JSON.parse(await readFile(reportPath, "utf8"));
        assert.equal(report.stats.expected, 17);
        assert.equal(report.stats.unexpected, 0);
        assert.equal(report.stats.flaky, 0);
        assert.deepEqual(await artifactDigest(), before);
      }
    }
    context.diagnostic(JSON.stringify({ owner, artifacts, providerBoundary: "synthetic intercepted requests only" }));
  });
}


test("environment persistence generation and lifecycle preserve target isolation", { timeout: 60 * 60 * 1000 }, async context => {
  const owner = await realpath(await mkdtemp(join(tmpdir(), "egeria-environment-persistence-")));
  context.diagnostic(`Retained local persistence evidence: ${owner}`);
  const primary = join(owner, "primary");
  const linked = join(owner, "linked");
  const commands = [];
  const cliUrl = new URL("../../../apps/cli/dist/run-cli.js", import.meta.url).href;
  const coreUrl = new URL("../dist/index.js", import.meta.url).href;
  async function command(label, executable, arguments_, cwd = owner) {
    try {
      const result = await execFileAsync(executable, arguments_, { cwd, encoding: "utf8", maxBuffer: 5 * 1024 * 1024, timeout: 20 * 60 * 1000, env: { PATH: process.env.PATH, LANG: process.env.LANG } });
      await writeFile(join(owner, `${label}.log`), result.stdout + result.stderr);
      commands.push({ label, executable, exitCode: 0 });
      return result.stdout;
    } catch (error) {
      await writeFile(join(owner, `${label}.log`), (error.stdout ?? "") + (error.stderr ?? ""));
      commands.push({ label, executable, exitCode: error.code });
      throw error;
    } finally { await writeFile(join(owner, "commands.json"), JSON.stringify(commands, null, 2)); }
  }
  async function cli(label, arguments_) {
    const source = `import { createCliRunner } from ${JSON.stringify(cliUrl)};
import { createPnpmGeneratedProjectVerifier } from ${JSON.stringify(coreUrl)};
const run = createCliRunner({ createVerifier: () => createPnpmGeneratedProjectVerifier({ pnpmExecutable: "pnpm" }) }, "2.0.0");
process.exitCode = await run(${JSON.stringify(arguments_)}, { write: value => process.stdout.write(value), writeError: value => process.stderr.write(value) });`;
    return JSON.parse(await command(label, process.execPath, ["--input-type=module", "-e", source]));
  }
  async function commitFixture(label, root) {
    await command(`${label}-add`, "git", ["add", "-A"], root);
    await command(`${label}-commit`, "git", ["commit", "-m", label], root);
  }
  const created = await cli("create", ["create", "--profile", "app", "--name", "persistence-example", "--display-name", "Persistence Example", "--directory", primary, "--application-persistence", "--multilingual", "--contact-form-web3forms", "--booking-calendly", "--calendly-mode", "link", "--google-analytics-4"]);
  assert.equal(created.ok, true);
  const initialState = JSON.parse(await readFile(join(primary, ".egeria/state.json"), "utf8"));
  assert.equal(initialState.schemaVersion, "2.0.0");
  for (const lane of ["cloudflare-types", "unit-tests", "next-build", "opennext-build", "worker-integration", "binding-integration"]) assert.ok(initialState.lastSuccessfulVerification.checks.includes(lane));
  const initialProject = await readFile(join(primary, ".egeria/project.yaml"));
  const initialLock = await readFile(join(primary, "pnpm-lock.yaml"));
  for (const operation of ["infer", "doctor"]) assert.equal((await cli(`initial-${operation}`, [operation, "--directory", primary])).ok, true);
  await command("fixture-init", "git", ["init", "--initial-branch=main", primary]);
  await command("fixture-name", "git", ["config", "user.name", "Persistence Integration Test"], primary);
  await command("fixture-email", "git", ["config", "user.email", "persistence-test@example.test"], primary);
  await commitFixture("generated-persistence", primary);
  await command("fixture-worktree", "git", ["worktree", "add", "-b", "persistence-lifecycle-test", linked], primary);

  // This evidence and its acceptances exercise only the synthetic source-removal contract.
  const inputPath = join(owner, "removal.json");
  const reviewPath = join(owner, "review.json");
  const databases = [{ environment: "local", databaseId: "local-test-database" }];
  const input = { databases, policy: { exportNotBefore: "2026-09-26T00:00:00Z", retainUntil: "2026-10-26T00:00:00Z", recoveryRequirements: [{ environment: "local", scope: "local" }], writeConsistency: "writes-paused" } };
  await writeFile(inputPath, JSON.stringify(input));
  const removalArguments = ["--directory", linked, "--capability", "application-persistence", "--persistence-removal", inputPath];
  const initialPlan = (await cli("removal-subject", ["plan-remove", ...removalArguments])).plan;
  const exportBytes = "synthetic local contract export\n";
  const recoveryBytes = "synthetic local contract recovery\n";
  const digest = bytes => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  await mkdir(join(linked, ".wrangler/removal-evidence"), { recursive: true });
  await writeFile(join(linked, ".wrangler/removal-evidence/export.sql"), exportBytes);
  await writeFile(join(linked, ".wrangler/removal-evidence/recovery.json"), recoveryBytes);
  input.evidence = { schemaVersion: "1.0.0", subject: { ...initialPlan.persistenceRemovalSubject, databases }, databases: [{ ...databases[0],
    export: { artifactReference: "local-export", digest: digest(exportBytes), completedAt: "2026-09-26T01:00:00Z", outcome: "passed" },
    recovery: { artifactReference: "local-recovery", digest: digest(recoveryBytes), exportDigest: digest(exportBytes), scope: "local", restoration: "passed", readback: "passed" },
    writeConsistency: { mode: "writes-paused", outcome: "passed" }, retention: { retainedUntil: "2026-10-26T00:00:00Z", outcome: "passed" },
  }] };
  input.localArtifacts = [{ reference: "local-export", path: ".wrangler/removal-evidence/export.sql" }, { reference: "local-recovery", path: ".wrangler/removal-evidence/recovery.json" }];
  await writeFile(inputPath, JSON.stringify(input));
  const removalPlan = (await cli("plan-remove", ["plan-remove", ...removalArguments])).plan;
  assert.equal(removalPlan.persistenceRemovalReport.recommendation, "ready-for-human-review");
  await writeFile(reviewPath, JSON.stringify({ reportFingerprint: removalPlan.persistenceRemovalReport.reportFingerprint, dispositions: removalPlan.persistenceRemovalReport.requiredReviewItems.map(({ identifier }) => ({ identifier, disposition: "accepted" })) }));
  const removed = await cli("apply-remove", ["apply-remove", ...removalArguments, "--persistence-human-review", reviewPath, "--approved-plan", removalPlan.planFingerprint]);
  assert.equal(removed.ok, true);
  assert.equal(removed.result.status, "verified-final-diff-approval-required");
  const removedState = JSON.parse(await readFile(join(linked, ".egeria/state.json"), "utf8"));
  assert.equal(removedState.installedCapabilities.find(({ identifier }) => identifier === "standards").version, "0.7.0");
  assert.equal(removedState.installedCapabilities.find(({ identifier }) => identifier === "deployment-cloudflare").version, "0.7.0");
  assert.equal(removedState.installedCapabilities.some(({ identifier }) => identifier === "application-persistence"), false);
  assert.equal(removedState.lastSuccessfulVerification.checks.includes("binding-integration"), false);
  await commitFixture("removed-persistence", linked);
  const additionArguments = ["--directory", linked, "--capability", "application-persistence"];
  const additionPlan = (await cli("plan-readd", ["plan-add", ...additionArguments])).result;
  const added = await cli("apply-readd", ["apply-add", ...additionArguments, "--approved-plan", additionPlan.planFingerprint]);
  assert.equal(added.ok, true);
  assert.equal(added.result.status, "verified-final-diff-approval-required");
  const finalState = JSON.parse(await readFile(join(linked, ".egeria/state.json"), "utf8"));
  assert.deepEqual(finalState.appliedMigrations, ["remove-application-persistence-0-2-0", "add-application-persistence-0-2-0"]);
  for (const [identifier, version] of [["application-persistence", "0.2.0"], ["standards", "0.8.0"], ["deployment-cloudflare", "0.8.0"], ["app-foundation", "0.3.0"]]) assert.equal(finalState.installedCapabilities.find(capability => capability.identifier === identifier).version, version);
  assert.ok(finalState.lastSuccessfulVerification.checks.includes("binding-integration"));
  assert.deepEqual(await readFile(join(linked, ".egeria/project.yaml")), initialProject);
  assert.deepEqual(await readFile(join(linked, "pnpm-lock.yaml")), initialLock);
  for (const operation of ["infer", "doctor"]) assert.equal((await cli(`final-${operation}`, [operation, "--directory", linked])).ok, true);
  await writeFile(join(owner, "verification-evidence.json"), JSON.stringify({ initial: initialState.lastSuccessfulVerification, removed: removedState.lastSuccessfulVerification, restored: finalState.lastSuccessfulVerification, localSyntheticOnly: true, providerAccess: false }, null, 2));
});

test("environment email generation and lifecycle preserve recipient isolation", { timeout: 90 * 60 * 1000 }, async context => {
  const owner = await realpath(await mkdtemp(join(tmpdir(), "egeria-environment-email-")));
  context.diagnostic(`Retained local email evidence: ${owner}`);
  const cliUrl = new URL("../../../apps/cli/dist/run-cli.js", import.meta.url).href;
  const coreUrl = new URL("../dist/index.js", import.meta.url).href;
  const commands = [];
  const receipts = [];
  const supportRoot = join(owner, "support");
  await mkdir(supportRoot);
  const support = await prepareLiveSupport(supportRoot);
  const environment = { ...support.environment, ...await derivePnpmToolEnvironment("pnpm"), WRANGLER_SEND_METRICS: "false" };
  const digest = bytes => createHash("sha256").update(bytes).digest("hex");
  async function command(label, executable, arguments_, cwd = owner, additions = {}) {
    try {
      const result = await execFileAsync(executable, arguments_, { cwd, encoding: "utf8", maxBuffer: 5 * 1024 * 1024, timeout: 20 * 60 * 1000, env: { ...environment, ...additions } });
      await writeFile(join(owner, `${label}.log`), result.stdout + result.stderr);
      commands.push({ label, executable, arguments: arguments_, exitCode: 0 });
      return result.stdout;
    } catch (error) {
      await writeFile(join(owner, `${label}.log`), (error.stdout ?? "") + (error.stderr ?? ""));
      commands.push({ label, executable, arguments: arguments_, exitCode: error.code });
      throw error;
    } finally { await writeFile(join(owner, "commands.json"), JSON.stringify(commands, null, 2)); }
  }
  async function cli(label, arguments_) {
    const source = `import { createCliRunner } from ${JSON.stringify(cliUrl)};
import { createPnpmGeneratedProjectVerifier } from ${JSON.stringify(coreUrl)};
const run = createCliRunner({ createVerifier: () => createPnpmGeneratedProjectVerifier({ pnpmExecutable: "pnpm" }) }, "2.0.0");
process.exitCode = await run(${JSON.stringify(arguments_)}, { write: value => process.stdout.write(value), writeError: value => process.stderr.write(value) });`;
    return JSON.parse(await command(label, process.execPath, ["--input-type=module", "-e", source]));
  }
  async function record(label, root, email, persistence) {
    const state = JSON.parse(await readFile(join(root, ".egeria/state.json"), "utf8"));
    const versions = Object.fromEntries(state.installedCapabilities.map(({ identifier, version }) => [identifier, version]));
    assert.equal(versions["transactional-email-resend"], email ? "0.2.0" : undefined);
    assert.equal(versions["application-persistence"], persistence ? "0.2.0" : undefined);
    if (email || label.includes("remove")) assert.equal(versions["app-foundation"], "0.3.0");
    assert.equal(versions["site-routing"], state.origin.profile === "portfolio" ? undefined : "0.4.0");
    for (const operation of ["infer", "doctor"]) assert.equal((await cli(`${label}-${operation}`, [operation, "--directory", root])).ok, true);
    receipts.push({ label, root, versions, verification: state.lastSuccessfulVerification,
      projectSha256: digest(await readFile(join(root, ".egeria/project.yaml"))), lockSha256: digest(await readFile(join(root, "pnpm-lock.yaml"))) });
    await writeFile(join(owner, "verification-evidence.json"), JSON.stringify({ receipts, localSyntheticOnly: true, liveProviderAccess: false }, null, 2));
  }
  async function commitFixture(label, root) {
    await command(`${label}-add-files`, "git", ["add", "-A"], root);
    await command(`${label}-commit`, "git", ["commit", "-m", label], root);
  }
  const projects = new Map();
  for (const profile of ["portfolio", "site", "app"]) {
    const primary = join(owner, `${profile}-primary`);
    const selected = profile === "portfolio" ? [] : ["--transactional-email-resend"];
    const neighbors = profile === "app" ? ["--application-persistence", "--contact-form-web3forms", "--booking-calendly", "--calendly-mode", "link", "--google-analytics-4"] : [];
    const created = await cli(`${profile}-create`, ["create", "--profile", profile, "--name", "email-example", "--display-name", "Email Example", "--directory", primary, ...selected, ...neighbors]);
    assert.equal(created.ok, true);
    await record(`${profile}-create`, primary, profile !== "portfolio", profile === "app");
    if (profile === "site") { projects.set(profile, primary); continue; }
    await command(`${profile}-init`, "git", ["init", "--initial-branch=main", primary]);
    await command(`${profile}-name`, "git", ["config", "user.name", "Email Integration Test"], primary);
    await command(`${profile}-identity`, "git", ["config", "user.email", "email-test@example.test"], primary);
    await commitFixture(`${profile}-generated`, primary);
    const primaryProject = await readFile(join(primary, ".egeria/project.yaml"));
    const primaryLock = await readFile(join(primary, "pnpm-lock.yaml"));
    const linked = join(owner, `${profile}-linked`);
    await command(`${profile}-worktree`, "git", ["worktree", "add", "-b", `${profile}-email-lifecycle-test`, linked], primary);
    const neighborPaths = profile === "app" ? ["apps/web/src/configuration/application-database.ts", "apps/web/src/integrations/contact-form-web3forms/contact-settings.ts", "apps/web/src/integrations/booking-calendly/booking-settings.ts", "apps/web/src/integrations/analytics/analytics-configuration.ts"] : [];
    const neighborBytes = new Map(await Promise.all(neighborPaths.map(async path => [path, await readFile(join(linked, path))])));
    for (const [index, operation] of (profile === "portfolio" ? ["add", "remove", "add"] : ["remove", "add"]).entries()) {
      const label = `${profile}-${index}-${operation}`;
      const arguments_ = ["--directory", linked, "--capability", "transactional-email-resend"];
      const envelope = await cli(`${label}-plan`, [`plan-${operation}`, ...arguments_]);
      const plan = operation === "add" ? envelope.result : envelope.plan;
      assert.equal(plan.capability.version, "0.2.0");
      const executed = await cli(`${label}-apply`, [`apply-${operation}`, ...arguments_, "--approved-plan", plan.planFingerprint]);
      assert.equal(executed.ok, true);
      assert.equal(executed.result.status, "verified-final-diff-approval-required");
      await record(label, linked, operation === "add", profile === "app");
      for (const [path, bytes] of neighborBytes) assert.deepEqual(await readFile(join(linked, path)), bytes);
      if (profile === "app") assert.deepEqual(await readFile(join(linked, "pnpm-lock.yaml")), primaryLock);
      await commitFixture(label, linked);
    }
    assert.deepEqual(await readFile(join(primary, ".egeria/project.yaml")), primaryProject);
    assert.deepEqual(await readFile(join(primary, "pnpm-lock.yaml")), primaryLock);
    projects.set(profile, linked);
  }

  const workerProject = join(owner, "intercepted-worker");
  await cp(projects.get("portfolio"), workerProject, { recursive: true, filter: source => ![".git", "node_modules", ".next", ".open-next", ".wrangler"].includes(source.split("/").at(-1)) });
  const app = join(workerProject, "apps/web");
  await mkdir(join(app, "app/email-proof"));
  await writeFile(join(app, "app/email-proof/route.ts"), `import { Cause, Effect, Exit } from "effect";
import { TransactionalEmailSender } from "@/src/application/transactional-email-sender";
import { serverTransactionalEmailLayer } from "@/src/composition/server-transactional-email";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  let attemptedCalls = 0;
  const previous = globalThis.fetch;
  globalThis.fetch = async input => {
    if (input !== "https://api.resend.com/emails") throw new Error("Unexpected transport");
    attemptedCalls += 1;
    return Response.json({ id: "synthetic-acceptance" });
  };
  try {
    const recipient = new URL(request.url).searchParams.has("unauthorized") ? "different@example.test" : "allowed@example.test";
    const program = Effect.gen(function* () {
      const sender = yield* TransactionalEmailSender;
      return yield* sender.send({ to: recipient, subject: "Synthetic example", text: "Synthetic message", idempotencyKey: "worker-example-001" });
    }).pipe(Effect.provide(serverTransactionalEmailLayer));
    const result = await Effect.runPromiseExit(program);
    const reason = Exit.isFailure(result) ? result.cause.reasons.find(Cause.isFailReason) : undefined;
    return Response.json({ outcome: Exit.isSuccess(result) ? "accepted" : reason?.error.code ?? "unexpected-failure", attemptedCalls });
  } finally { globalThis.fetch = previous; }
}
`);
  const harnessPath = join(app, "email-proof.mjs");
  await writeFile(harnessPath, `import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createTestHarness } from "wrangler";
const target = process.env.APPLICATION_ENVIRONMENT;
const generated = JSON.parse(await readFile("wrangler.jsonc", "utf8"));
const base = { ...generated, main: resolve(".open-next/worker.js"), assets: { ...generated.assets, directory: resolve(".open-next/assets") } };
delete base.env; delete base.$schema;
const valid = { ...base.vars, APPLICATION_ENVIRONMENT: target, RESEND_API_KEY: "re_controlled_test_credential", TRANSACTIONAL_EMAIL_FROM: "sender@example.test", TRANSACTIONAL_EMAIL_DOMAIN: "example.test", ...(target === "production" ? {} : { TRANSACTIONAL_EMAIL_ALLOWED_RECIPIENTS: "allowed@example.test,second@example.test" }) };
const cases = [
  { name: "matching", values: valid, outcome: "accepted", calls: 1 },
  { name: "missing-target", values: { ...valid, APPLICATION_ENVIRONMENT: undefined }, outcome: "transactional-email-configuration", calls: 0 },
  { name: "invalid-target", values: { ...valid, APPLICATION_ENVIRONMENT: "invalid" }, outcome: "transactional-email-configuration", calls: 0 },
  { name: "opposite-target", values: { ...valid, APPLICATION_ENVIRONMENT: target === "production" ? "staging" : "production" }, outcome: "transactional-email-configuration", calls: 0 },
  { name: "invalid-key", values: { ...valid, RESEND_API_KEY: "invalid" }, outcome: "transactional-email-configuration", calls: 0 },
  { name: "invalid-sender", values: { ...valid, TRANSACTIONAL_EMAIL_FROM: "invalid" }, outcome: "transactional-email-configuration", calls: 0 },
  ...(target === "production" ? [{ name: "ignored-list", values: { ...valid, TRANSACTIONAL_EMAIL_ALLOWED_RECIPIENTS: "invalid" }, outcome: "accepted", calls: 1 }] : [
    { name: "missing-list", values: { ...valid, TRANSACTIONAL_EMAIL_ALLOWED_RECIPIENTS: undefined }, outcome: "transactional-email-configuration", calls: 0 },
    { name: "malformed-list", values: { ...valid, TRANSACTIONAL_EMAIL_ALLOWED_RECIPIENTS: "allowed@example.test," }, outcome: "transactional-email-configuration", calls: 0 },
    { name: "unauthorized", values: valid, query: "?unauthorized", outcome: "transactional-email-authorization", calls: 0 },
  ]),
  { name: "restored", values: valid, outcome: "accepted", calls: 1 },
];
const outcomes = [];
for (const scenario of cases) {
  const configPath = resolve("email-proof.wrangler.json");
  await writeFile(configPath, JSON.stringify({ ...base, vars: scenario.values }));
  const server = createTestHarness({ workers: [{ configPath }] });
  try {
    await server.listen();
    const response = await server.fetch("/email-proof" + (scenario.query ?? ""), { method: "POST" });
    assert.equal(response.status, 200, scenario.name);
    const result = await response.json();
    assert.deepEqual(result, { outcome: scenario.outcome, attemptedCalls: scenario.calls }, scenario.name);
    outcomes.push({ name: scenario.name, ...result });
  } finally { await server.close(); }
}
await writeFile(process.argv[2], JSON.stringify({ target, outcomes }, null, 2));
`);
  await command("worker-install", "pnpm", ["install", "--frozen-lockfile", "--store-dir", support.store], workerProject);
  await command("worker-consumer-typecheck", "pnpm", ["--dir", "apps/web", "run", "typecheck"], workerProject);
  async function hashTree(root) {
    const paths = (await readdir(root, { recursive: true, withFileTypes: true })).filter(entry => entry.isFile()).map(entry => join(entry.parentPath, entry.name)).sort();
    const hash = createHash("sha256");
    for (const path of paths) hash.update(path.slice(root.length)).update(await readFile(path));
    return { sha256: hash.digest("hex"), files: paths.length };
  }
  const sourceBefore = await hashTree(join(app, "src"));
  const consumerBefore = await readFile(join(app, "app/email-proof/route.ts"));
  const artifactEvidence = [];
  for (const target of ["development", "staging", "production"]) {
    await command(`${target}-build`, "pnpm", ["--dir", "apps/web", "run", "build:cloudflare"], workerProject, { APPLICATION_ENVIRONMENT: target });
    const artifact = { target, worker: await hashTree(join(app, ".open-next")), source: sourceBefore, consumerSha256: digest(consumerBefore) };
    await command(`${target}-challenges`, process.execPath, [harnessPath, join(owner, `${target}-outcomes.json`)], app, { APPLICATION_ENVIRONMENT: target });
    assert.deepEqual(await hashTree(join(app, ".open-next")), artifact.worker);
    assert.deepEqual(await hashTree(join(app, "src")), sourceBefore);
    assert.deepEqual(await readFile(join(app, "app/email-proof/route.ts")), consumerBefore);
    artifactEvidence.push(artifact);
    await writeFile(join(owner, "worker-artifacts.json"), JSON.stringify(artifactEvidence, null, 2));
  }

  // These temporary consumers use existing jobs contracts without candidate admission or a product job flow.
  const jobsRoot = new URL("../templates/background-job-delivery/apps/web/", import.meta.url);
  for (const path of ["src/application/job-delivery.ts", "src/application/job-handlers.ts", "src/composition/server-jobs.ts", "src/infrastructure/cloudflare/job-delivery.ts", "src/infrastructure/memory/job-delivery.ts", "tests/unit/job-delivery.test.ts"]) {
    await mkdir(join(app, path, ".."), { recursive: true });
    await writeFile(join(app, path), await readFile(new URL(path, jobsRoot)));
  }
  await writeFile(join(app, "tests/unit/independent-email-jobs.test.ts"), `import { Effect, Exit } from "effect";
import { expect, it, vi } from "vitest";
import { JobDispatcher, type JobEnvelope } from "@/src/application/job-delivery";
import { createCloudflareJobDispatcherLayer } from "@/src/infrastructure/cloudflare/job-delivery";
it("optional absence and invalid independent queue configuration cause no external work", async () => {
  const request = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", request);
  try {
    expect(await Effect.runPromise(Effect.succeed("email-absent"))).toBe("email-absent");
    for (const target of ["local", "staging", "production"] as const) {
      for (const invalid of ["environment", "binding", "envelope"] as const) {
        const send = vi.fn();
        const configuration = { JOB_ENVIRONMENT: invalid === "environment" ? undefined : target, JOB_QUEUE_NAME: "jobs-" + target, JOB_DEAD_LETTER_QUEUE_NAME: "jobs-" + target + "-dead", JOB_QUEUE: invalid === "binding" ? undefined : { send }, JOB_DEAD_LETTER_QUEUE: { send } };
        const layer = createCloudflareJobDispatcherLayer({ configuration: Effect.succeed(configuration), handlers: [{ type: "synthetic", version: 1, repeatSafety: "monotonic", validate: () => true, handle: () => Effect.void }] });
        const envelope: JobEnvelope = { version: 1, environment: invalid === "envelope" ? target === "production" ? "local" : "production" : target, operationId: "00000000-0000-4000-8000-000000000001", jobType: "synthetic", jobVersion: 1, payload: {} };
        const result = await Effect.runPromiseExit(Effect.flatMap(JobDispatcher, dispatcher => dispatcher.dispatch(envelope)).pipe(Effect.provide(layer)));
        expect(Exit.isFailure(result)).toBe(true);
        expect(send).not.toHaveBeenCalled();
      }
    }
    expect(request).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
});
`);
  await command("independent-consumers", "pnpm", ["--dir", "apps/web", "run", "test:unit", "job-delivery.test.ts", "independent-email-jobs.test.ts"], workerProject);
  context.diagnostic(JSON.stringify({ owner, generationReceipts: receipts.length, builtTargets: artifactEvidence.length, transport: "intercepted-only", persistenceBindingChecks: "app generation and lifecycle receipts", jobsCandidateAdmitted: false }));
});
