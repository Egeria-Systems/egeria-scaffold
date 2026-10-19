import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer as createHttpServer } from "node:http";
import type { Socket } from "node:net";
import { createServer, type Server } from "node:https";
import { mkdtemp, readFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, expect, type APIRequest } from "@playwright/test";
import { assertTransportDiagnostics, createApplicationTransport, readTransportSettings } from "../e2e/application-transport";
import { BrowserDevelopmentResponse, guardedDevelopmentMode } from "../../scripts/browser-development-server";

let directory: string;
let allowed: Server;
let denied: Server;
let origin: string;
let otherOrigin: string;
const observed: { path: string; authenticated: boolean }[] = [];
let externalRequests = 0;
const clientId = "synthetic-access-id-canary";
const clientSecret = "synthetic-access-secret-canary";
const environment = () => ({ APPLICATION_ENVIRONMENT: "staging", DEPLOY_URL: origin, NEXT_PUBLIC_SITE_URL: origin,
  CF_ACCESS_CLIENT_ID: clientId, CF_ACCESS_CLIENT_SECRET: clientSecret });
const listen = (server: Server): Promise<string> => new Promise(resolve => server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("CANARY_ADDRESS_INVALID");
  resolve(`https://127.0.0.1:${address.port}`);
}));
const close = async (server: Server) => { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); };

test.beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "application-transport-canary-"));
  const key = join(directory, "key.pem"), cert = join(directory, "cert.pem");
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", cert, "-days", "1", "-subj", "/CN=localhost"], { stdio: "ignore", timeout: 15000 });
  const tls = { key: await readFile(key), cert: await readFile(cert) };
  denied = createServer(tls, (_request, response) => { externalRequests++; response.end("unexpected"); });
  denied.on("upgrade", (_request, socket) => { externalRequests++; socket.destroy(); });
  otherOrigin = await listen(denied);
  allowed = createServer(tls, (request, response) => {
    const path = request.url ?? "/";
    observed.push({ path, authenticated: request.headers["cf-access-client-id"] === clientId && request.headers["cf-access-client-secret"] === clientSecret });
    const redirects: Record<string, string> = { "/absolute": `${otherOrigin}/leak`, "/relative": `//${new URL(otherOrigin).host}/leak`,
      "/protocol": origin.replace("https:", "http:") + "/leak", "/locale": "/fr-CA", "/loop": "/loop", "/chain": "/locale" };
    if (path in redirects) { response.writeHead(307, { Location: redirects[path]! }); response.end(); return; }
    if (path === "/timeout") return;
    if (path === "/reset") { request.socket.destroy(); return; }
    if (path === "/sw.js") { response.setHeader("content-type", "application/javascript"); response.end("self.addEventListener('fetch',()=>{});"); return; }
    response.setHeader("content-type", path === "/robots.txt" ? "text/plain" : path === "/sitemap.xml" ? "application/xml" : "text/html");
    response.end(path === "/robots.txt" ? "User-agent: *\nDisallow: /" : path === "/sitemap.xml" ? "<urlset/>" : '<!doctype html><html><head><link rel="icon" href="data:,"></head><body><main>Canary</main></body></html>');
  });
  origin = await listen(allowed);
});
test.afterAll(async () => { try { if (allowed) await close(allowed); if (denied) await close(denied); } finally { if (directory) await rm(directory, { recursive: true, force: true }); } });
test.beforeEach(() => { observed.length = 0; externalRequests = 0; });

// This factory is confined to these two loopback servers and the transport-test config.
const canaryRequest = (request: APIRequest): APIRequest => ({ newContext: () => request.newContext({ ignoreHTTPSErrors: true }) });

test("API navigation validates each redirect before sending credentials", async ({ playwright }) => {
  const transport = await createApplicationTransport(origin, environment(), canaryRequest(playwright.request));
  try {
    for (const path of [otherOrigin, "/absolute", "/relative", "/protocol", "/loop", "/reset"]) {
      await expect(transport.getApplicationResponse(path)).rejects.toThrow(/^APPLICATION_TRANSPORT_/u);
    }
    const redirect = await transport.getApplicationResponse("/locale", { redirect: "manual" });
    expect(redirect.status()).toBe(307);
    expect(redirect.headers().location).toBe("/fr-CA");
    expect((await transport.getApplicationResponse("/chain")).url()).toBe(`${origin}/fr-CA`);
    expect(await (await transport.getApplicationResponse("/robots.txt")).text()).toContain("Disallow: /");
    expect(await (await transport.getApplicationResponse("/sitemap.xml")).text()).toBe("<urlset/>");
    expect(externalRequests).toBe(0);
    expect(observed.every(value => value.authenticated)).toBe(true);
  } finally { await transport.dispose(); }
});

for (const protectedStaging of [true, false]) {
test(`${protectedStaging ? "protected" : "unprotected"} browser denial covers redirects, popups, unmocked requests and sockets while page mocks take precedence`, async ({ page, context, playwright }) => {
  const transport = await createApplicationTransport(origin, protectedStaging ? environment() : {}, canaryRequest(playwright.request));
  try {
    await transport.installBrowserProtection(context);
    await transport.openApplicationPage(page, "/locale");
    expect(page.url()).toBe(`${origin}/fr-CA`);
    await page.route(`${otherOrigin}/mock`, route => route.fulfill({ body: "controlled mock", contentType: "text/plain", headers: { "access-control-allow-origin": origin } }));
    expect(await page.evaluate(async url => (await fetch(url)).text(), `${otherOrigin}/mock`)).toBe("controlled mock");
    for (const path of ["/absolute", "/relative"]) {
      // An aborted navigation may commit an error document after goto rejects.
      const redirectPage = await context.newPage();
      try { await expect(redirectPage.goto(origin + path)).rejects.toThrow("net::ERR_BLOCKED_BY_CLIENT"); }
      finally { await redirectPage.close(); }
    }
    await transport.openApplicationPage(page, "/");
    const popupOpened = context.waitForEvent("page");
    const popupRequestFailed = context.waitForEvent("requestfailed", request => request.url() === `${otherOrigin}/popup`);
    await page.evaluate(url => { window.open(url); }, `${otherOrigin}/popup`);
    const [popup, popupRequest] = await Promise.all([popupOpened, popupRequestFailed]);
    try { expect(popupRequest.failure()?.errorText).toBe("net::ERR_BLOCKED_BY_CLIENT"); }
    finally { await popup.close(); }
    const [fetchRequest, fetchResult] = await Promise.all([
      context.waitForEvent("requestfailed", request => request.url() === `${otherOrigin}/fetch`),
      page.evaluate(async url => {
        try { await fetch(url); return "unexpected-success"; }
        catch { return "blocked"; }
      }, `${otherOrigin}/fetch`),
    ]);
    expect(["net::ERR_BLOCKED_BY_CLIENT", "net::ERR_BLOCKED_BY_CLIENT.Inspector"]).toContain(fetchRequest.failure()?.errorText);
    expect(fetchResult).toBe("blocked");
    const socketResult = await page.evaluate(url => new Promise<{ opened: boolean; wasClean: boolean }>(resolve => {
      const socket = new WebSocket(url);
      let opened = false;
      socket.onopen = () => { opened = true; socket.close(); };
      socket.onerror = () => {};
      socket.onclose = event => resolve({ opened, wasClean: event.wasClean });
    }), `${otherOrigin.replace("https:", "wss:")}/socket`);
    expect(socketResult).toEqual({ opened: false, wasClean: true });
    expect(externalRequests).toBe(0);
    expect(() => transport.assertBrowserRequests()).toThrow("APPLICATION_TRANSPORT_BROWSER_REQUEST_BLOCKED");
    expect(observed.every(value => value.authenticated === protectedStaging)).toBe(true);
  } finally { await transport.dispose(); }
});
}

test("protected diagnostics, service workers and raw request failures cannot expose credentials", async ({ page, context, playwright }, information) => {
  const transport = await createApplicationTransport(origin, environment(), canaryRequest(playwright.request));
  try {
    assertTransportDiagnostics(transport.settings, information.project.use);
    await transport.installBrowserProtection(context);
    await transport.openApplicationPage(page, "/");
    await page.evaluate(() => navigator.serviceWorker.register("/sw.js").catch(() => undefined));
    expect(observed.some(value => value.path === "/sw.js")).toBe(false);
    for (const change of [{ DEBUG: "pw:api" }, { PWDEBUG: "1" }, { ACTIONS_STEP_DEBUG: "true" }, { RUNNER_DEBUG: "1" }]) {
      expect(() => readTransportSettings(origin, { ...environment(), ...change })).toThrow("APPLICATION_TRANSPORT_DEBUG_FORBIDDEN");
    }
    for (const trace of ["on", "retain-on-failure"]) expect(() => assertTransportDiagnostics(transport.settings, { ...information.project.use, trace })).toThrow();
    for (const path of ["/reset", "/timeout"]) {
      try { await transport.getApplicationResponse(path); throw new Error("CANARY_EXPECTED_FAILURE"); }
      catch (error) { expect((error as Error).message).toBe("APPLICATION_TRANSPORT_REQUEST_FAILED"); }
    }
    async function inspect(path: string): Promise<void> {
      for (const entry of await readdir(path, { withFileTypes: true }).catch(() => [])) {
        const file = join(path, entry.name);
        if (entry.isDirectory()) await inspect(file);
        else if (entry.isFile()) { const value = await readFile(file, "utf8"); expect(value.includes(clientId) || value.includes(clientSecret)).toBe(false); }
      }
    }
    await inspect(information.outputDir);
  } finally { await transport.dispose(); }
});

async function guardedCanary() {
  const sockets = new Set<Socket>();
  const requests: { path: string; destination: string | undefined; mode: string | undefined; redirectStatus: number | undefined }[] = [];
  let forbiddenRequests = 0;
  const forbidden = createHttpServer((_request, response) => { forbiddenRequests++; response.end("unexpected"); });
  forbidden.on("upgrade", (_request, socket) => { forbiddenRequests++; socket.destroy(); });
  const localListen = (server: ReturnType<typeof createHttpServer>) => new Promise<string>(resolve => server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("CANARY_ADDRESS_INVALID");
    resolve(`http://127.0.0.1:${address.port}`);
  }));
  const forbiddenOrigin = await localListen(forbidden);
  const server = createHttpServer({ ServerResponse: BrowserDevelopmentResponse }, (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const browserRequest = Object.hasOwn(request.headers, "sec-fetch-dest") || Object.hasOwn(request.headers, "sec-fetch-mode");
    requests.push({ path: url.pathname, destination: request.headers["sec-fetch-dest"] as string | undefined, mode: request.headers["sec-fetch-mode"] as string | undefined,
      redirectStatus: url.pathname === "/redirect" ? Number(url.searchParams.get("status") ?? 307) : undefined });
    if (url.pathname === "/native-json") {
      if (request.method !== "POST" || request.headers.origin !== localOrigin || request.headers["sec-fetch-dest"] !== "empty" ||
        request.headers["sec-fetch-mode"] !== "cors" || request.headers["sec-fetch-site"] !== "same-origin" || request.headers["content-type"] !== "application/json") {
        response.writeHead(403); response.end(); return;
      }
      let body = "";
      request.setEncoding("utf8");
      request.on("data", chunk => { body += chunk; if (body.length > 1024) request.destroy(); });
      request.on("end", () => { response.writeHead(body === '{"native":true}' ? 202 : 400); response.end(); });
      return;
    }
    if (url.pathname === "/stream") {
      response.writeHead(202, { "content-type": "text/plain" }); response.flushHeaders();
      if (url.searchParams.get("outcome") === "error") setTimeout(() => response.destroy(), 100);
      return;
    }
    if (url.pathname === "/pending") return;
    if (url.pathname === "/locale") { response.writeHead(307, { Location: "/" }); response.end(); return; }
    if (url.pathname === "/redirect" || (url.pathname === "/changed" && browserRequest)) {
      // Classification must survive a handler mutating the request metadata.
      delete request.headers["sec-fetch-dest"]; delete request.headers["sec-fetch-mode"];
      const status = Number(url.searchParams.get("status") ?? 307);
      const writer = url.searchParams.get("writer") ?? "writeHead";
      response.setHeader("Location", `${forbiddenOrigin}/leak`);
      if (writer === "writeHead" || writer === "writeHeader") response[writer](status);
      else { response.statusCode = status; if (writer === "write") response.write("body"); else if (writer === "flushHeaders") response.flushHeaders(); }
      response.end(); return;
    }
    if (url.pathname === "/sw.js") { response.setHeader("content-type", "application/javascript"); response.end("self.addEventListener('fetch',()=>{});"); return; }
    response.setHeader("content-type", "text/html");
    response.end(`<!doctype html><html><head><link rel="icon" href="data:,"></head><body><main>Guarded canary</main>${url.pathname === "/iframe" ? '<iframe src="/redirect"></iframe>' : ""}</body></html>`);
  });
  server.on("connection", socket => { sockets.add(socket); socket.once("close", () => sockets.delete(socket)); });
  server.on("upgrade", (request, socket) => {
    if (request.url !== "/_next/hmr" || typeof request.headers["sec-websocket-key"] !== "string") { socket.destroy(); return; }
    const accept = createHash("sha1").update(request.headers["sec-websocket-key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    const body = Buffer.from("owned-hmr-frame");
    socket.write(Buffer.concat([Buffer.from([0x81, body.length]), body]));
    socket.once("data", () => socket.end(Buffer.from([0x88, 2, 0x03, 0xe8])));
  });
  const localOrigin = await localListen(server);
  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    const closed = new Promise<void>(resolve => server.close(() => resolve()));
    for (const socket of sockets) socket.destroy();
    await closed;
  };
  return { origin: localOrigin, forbiddenOrigin, requests, forbiddenRequests: () => forbiddenRequests, stop,
    close: async () => { await stop(); forbidden.closeAllConnections(); await new Promise<void>(resolve => forbidden.close(() => resolve())); } };
}

test("owned development server refuses browser redirects independently of transport interception", async ({ browser, playwright }) => {
  test.setTimeout(120000);
  const canary = await guardedCanary();
  const context = await browser.newContext({ serviceWorkers: "block" });
  const api = await playwright.request.newContext();
  try {
    const page = await context.newPage();
    const response = await page.goto(canary.origin);
    expect(await response?.serverAddr()).toEqual({ ipAddress: "127.0.0.1", port: Number(new URL(canary.origin).port) });
    for (const status of [301, 302, 303, 307, 308]) {
      for (const writer of ["writeHead", "writeHeader", "write", "end", "flushHeaders"]) {
        const target = await context.newPage();
        try { await expect(target.goto(`${canary.origin}/redirect?status=${status}&writer=${writer}`)).rejects.toThrow(); }
        finally { await target.close(); }
      }
    }
    const popupFailure = context.waitForEvent("requestfailed", request => request.url() === `${canary.origin}/redirect`);
    const popupOpened = context.waitForEvent("page");
    await page.evaluate(() => { window.open("/redirect"); });
    const [popup] = await Promise.all([popupOpened, popupFailure]);
    await popup.close();
    const iframeFailure = context.waitForEvent("requestfailed", request => request.url() === `${canary.origin}/redirect`);
    await page.goto(`${canary.origin}/iframe`); await iframeFailure;
    const noScript = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: "block" });
    try { const target = await noScript.newPage(); await expect(target.goto(`${canary.origin}/redirect`)).rejects.toThrow(); }
    finally { await noScript.close(); }
    const preflight = await api.get(`${canary.origin}/changed`, { maxRedirects: 0 });
    expect(preflight.status()).toBe(200); await preflight.dispose();
    await expect(page.goto(`${canary.origin}/changed`)).rejects.toThrow();
    const pending = context.waitForEvent("request", request => request.url() === `${canary.origin}/pending`);
    const navigation = page.goto(`${canary.origin}/pending`).catch(() => "closed");
    await pending; await canary.stop(); expect(await navigation).toBe("closed");
    const browserRequests = canary.requests.filter(request => request.path === "/redirect");
    expect(browserRequests.length).toBeGreaterThanOrEqual(28);
    expect(browserRequests.every(request => request.destination !== undefined && request.mode === "navigate")).toBe(true);
    expect(canary.requests.filter(request => request.path === "/changed").map(request => request.destination)).toEqual([undefined, "document"]);
    expect(canary.forbiddenRequests()).toBe(0);
  } finally { await api.dispose(); await context.close(); await canary.close(); }
});

test("guarded native documents retain their endpoint and a real allowed socket while enforcing request guards", async ({ page, context, playwright }) => {
  test.setTimeout(120000);
  const canary = await guardedCanary();
  const transport = await createApplicationTransport(canary.origin, {}, playwright.request, guardedDevelopmentMode);
  const errors: string[] = [];
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", error => errors.push(error.message));
  try {
    await transport.installBrowserProtection(context);
    const response = await transport.openApplicationPage(page, "/locale");
    expect(await response?.serverAddr()).toEqual({ ipAddress: "127.0.0.1", port: Number(new URL(canary.origin).port) });
    expect(await page.evaluate(url => new Promise<string>((resolve, reject) => {
      const socket = new WebSocket(url);
      socket.onerror = () => reject(new Error("Owned socket failed"));
      socket.onmessage = event => { resolve(String(event.data)); socket.close(); };
    }), `${canary.origin.replace("http:", "ws:")}/_next/hmr`)).toBe("owned-hmr-frame");
    expect(await page.evaluate(async () => {
      const response = await fetch("/native-json", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ native: true }),
      });
      await response.text();
      return response.status;
    })).toBe(202);
    const second = await context.newPage();
    await transport.openApplicationPage(second, "/"); await second.close();
    expect(errors).toEqual([]);
    transport.assertBrowserRequests();
    await page.route(`${canary.forbiddenOrigin}/mock`, route => route.fulfill({ body: "mock", contentType: "text/plain", headers: { "access-control-allow-origin": canary.origin } }));
    expect(await page.evaluate(async url => (await fetch(url)).text(), `${canary.forbiddenOrigin}/mock`)).toBe("mock");
    await page.evaluate(() => navigator.serviceWorker.register("/sw.js").catch(() => undefined));
    expect(canary.requests.some(request => request.path === "/sw.js")).toBe(false);
    for (const status of [301, 302, 303, 307, 308]) {
      const redirectContext = await context.browser()!.newContext({ serviceWorkers: "block" });
      const redirectTransport = await createApplicationTransport(canary.origin, {}, playwright.request, guardedDevelopmentMode);
      try {
        await redirectTransport.installBrowserProtection(redirectContext);
        const redirectPage = await redirectContext.newPage();
        await redirectTransport.openApplicationPage(redirectPage, "/");
        redirectTransport.assertBrowserRequests();
        expect(await redirectPage.evaluate(async path => fetch(path).then(() => "unexpected", () => "blocked"), `/redirect?status=${status}`)).toBe("blocked");
        expect(canary.forbiddenRequests()).toBe(0);
        expect(() => redirectTransport.assertBrowserRequests()).toThrow("APPLICATION_TRANSPORT_BROWSER_REQUEST_BLOCKED");
        expect(canary.requests.filter(request => request.path === "/redirect" && request.redirectStatus === status).length).toBeGreaterThanOrEqual(1);
      } finally { await redirectTransport.dispose(); await redirectContext.close(); }
    }
    const fetchRedirects = canary.requests.filter(request => request.path === "/redirect");
    expect(new Set(fetchRedirects.map(request => request.redirectStatus))).toEqual(new Set([301, 302, 303, 307, 308]));
    expect(fetchRedirects.every(request => request.destination === "empty" && request.mode === "cors")).toBe(true);
    const external = await context.newPage();
    try { await expect(external.goto(canary.forbiddenOrigin)).rejects.toThrow("net::ERR_BLOCKED_BY_CLIENT"); }
    finally { await external.close(); }
    const changed = await context.newPage();
    try { await expect(transport.openApplicationPage(changed, "/changed")).rejects.toThrow("APPLICATION_TRANSPORT_NAVIGATION_FAILED"); }
    finally { await changed.close(); }
    expect(canary.forbiddenRequests()).toBe(0);
    expect(() => transport.assertBrowserRequests()).toThrow("APPLICATION_TRANSPORT_BROWSER_REQUEST_BLOCKED");
  } finally { await transport.dispose(); await canary.close(); }
});

test("guarded native fetch cancellation distinguishes successful headers from failures and hangs", async ({ browser, playwright }) => {
  test.setTimeout(120000);
  const canary = await guardedCanary();
  try {
    for (const outcome of ["abort", "before-headers", "error", "hang"]) await test.step(outcome, async () => {
      const context = await browser.newContext({ serviceWorkers: "block" });
      const transport = await createApplicationTransport(canary.origin, {}, playwright.request, guardedDevelopmentMode);
      try {
        await transport.installBrowserProtection(context);
        const page = await context.newPage(); await transport.openApplicationPage(page, "/");
        const path = outcome === "before-headers" ? "/pending?outcome=abort" : `/stream?outcome=${outcome}`;
        const url = canary.origin + path;
        const failed = outcome === "hang" ? undefined : context.waitForEvent("requestfailed", request => request.url() === url);
        let resourceType: string | undefined;
        context.on("request", request => { if (request.url() === url) resourceType = request.resourceType(); });
        const headers: number[] = [];
        context.on("response", response => { if (response.url() === url) headers.push(response.status()); });
        if (outcome === "hang") {
          const closed = page.waitForEvent("close");
          const started = Date.now();
          const body = page.evaluate(async target => (await fetch(target, { method: "POST", body: "synthetic" })).text(), path)
            .then(() => "unexpected completion", () => "page closed");
          await closed; expect(await body).toBe("page closed");
          expect(Date.now() - started).toBeGreaterThanOrEqual(9000);
        } else {
          const result = await page.evaluate(async ({ target, mode }) => {
            const controller = new AbortController();
            if (mode === "before-headers") setTimeout(() => controller.abort(), 100);
            let status: number | undefined;
            try {
              const response = await fetch(target, { method: "POST", body: "synthetic", signal: controller.signal });
              status = response.status;
              if (mode === "abort") controller.abort();
              await response.text(); return { status, error: "unexpected completion" };
            } catch (error) { return { status, error: (error as Error).name }; }
          }, { target: path, mode: outcome });
          expect(result).toEqual({ status: outcome === "before-headers" ? undefined : 202, error: outcome === "error" ? "TypeError" : "AbortError" });
        }
        const request = failed ? await failed : undefined;
        expect(resourceType).toBe("fetch");
        expect(headers).toEqual(outcome === "before-headers" ? [] : [202]);
        if (outcome === "abort") {
          expect(request?.failure()?.errorText).toBe("net::ERR_ABORTED"); transport.assertBrowserRequests();
        } else {
          if (outcome === "error") expect(request?.failure()?.errorText).not.toBe("net::ERR_ABORTED");
          expect(() => transport.assertBrowserRequests()).toThrow("APPLICATION_TRANSPORT_BROWSER_REQUEST_BLOCKED");
        }
      } finally { await transport.dispose(); await context.close(); }
    });
    expect(canary.forbiddenRequests()).toBe(0);
  } finally { await canary.close(); }
});
