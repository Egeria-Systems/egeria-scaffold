import { execFileSync } from "node:child_process";
import { createServer, type Server } from "node:https";
import { mkdtemp, readFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, expect, type APIRequest } from "@playwright/test";
import { assertTransportDiagnostics, createApplicationTransport, readTransportSettings } from "../e2e/application-transport";

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
