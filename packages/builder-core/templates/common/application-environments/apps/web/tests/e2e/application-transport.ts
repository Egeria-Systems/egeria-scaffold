import type { APIRequest, APIResponse, BrowserContext, Page, PlaywrightTestOptions, Request, Response } from "@playwright/test";
import { guardedDevelopmentMode } from "../../scripts/browser-development-server.ts";

export type ResponseOptions = Readonly<{ acceptLanguage?: string; redirect?: "manual" | "same-origin" }>;
export type ApplicationResponse = Pick<APIResponse, "status" | "ok" | "headers" | "text" | "json" | "url">;
export type OpenApplicationPage = (page: Page, path: string, options?: ResponseOptions) => ReturnType<Page["goto"]>;
type Environment = Readonly<Record<string, string | undefined>>;
const fail = (code: string): never => { throw new Error(`APPLICATION_TRANSPORT_${code}`); };
const redirects = new Set([301, 302, 303, 307, 308]);

export function readTransportSettings(baseURL: string, environment: Environment) {
  let origin: URL;
  try { origin = new URL(baseURL); } catch { return fail("ORIGIN_INVALID"); }
  const local = origin.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  if ((!local && origin.protocol !== "https:") || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash ||
      baseURL.trim() !== baseURL || baseURL.includes("\\") || baseURL.includes("?") || baseURL.includes("#")) fail("ORIGIN_INVALID");
  const deployed = environment.DEPLOY_URL !== undefined;
  if (deployed && (origin.protocol !== "https:" || environment.DEPLOY_URL !== origin.origin ||
      environment.NEXT_PUBLIC_SITE_URL !== origin.origin || !["staging", "production"].includes(environment.APPLICATION_ENVIRONMENT ?? ""))) fail("ORIGIN_INVALID");
  const protectedStaging = deployed && environment.APPLICATION_ENVIRONMENT === "staging";
  const clientId = environment.CF_ACCESS_CLIENT_ID;
  const clientSecret = environment.CF_ACCESS_CLIENT_SECRET;
  if (protectedStaging ? !clientId || !clientSecret : clientId !== undefined || clientSecret !== undefined) fail("CREDENTIALS_INVALID");
  if (protectedStaging && (["DEBUG", "PWDEBUG", "NODE_DEBUG", "NODE_OPTIONS"].some(key => Boolean(environment[key])) ||
    ["ACTIONS_STEP_DEBUG", "ACTIONS_RUNNER_DEBUG", "RUNNER_DEBUG"].some(key => ["true", "1"].includes((environment[key] ?? "").toLowerCase())))) fail("DEBUG_FORBIDDEN");
  return { origin: origin.origin, protectedStaging };
}

export function assertTransportDiagnostics(settings: ReturnType<typeof readTransportSettings>, use: Partial<PlaywrightTestOptions> & { trace?: unknown; video?: unknown; screenshot?: unknown }) {
  if (settings.protectedStaging && (use.trace !== "off" || use.video !== "off" || use.screenshot !== "off" || use.serviceWorkers !== "block" ||
      use.extraHTTPHeaders !== undefined || use.storageState !== undefined || use.contextOptions?.recordHar !== undefined)) fail("DIAGNOSTICS_FORBIDDEN");
}

export async function createApplicationTransport(baseURL: string, environment: Environment, request: APIRequest, mode?: typeof guardedDevelopmentMode) {
  const settings = readTransportSettings(baseURL, environment);
  if (mode !== undefined && (mode !== guardedDevelopmentMode || !settings.origin.startsWith("http:") || environment.DEPLOY_URL !== undefined)) fail("DEVELOPMENT_MODE_INVALID");
  const accessHeaders: Record<string, string> = settings.protectedStaging ? {
    "CF-Access-Client-Id": environment.CF_ACCESS_CLIENT_ID!, "CF-Access-Client-Secret": environment.CF_ACCESS_CLIENT_SECRET!,
  } : {};
  const context = await request.newContext();
  let browserFailure = false;
  const browserCleanups: (() => void)[] = [];
  function destination(value: string, base = settings.origin): URL {
    let url: URL;
    try { url = new URL(value, base); } catch { return fail("DESTINATION_INVALID"); }
    if (url.origin !== settings.origin || url.username || url.password || !["http:", "https:"].includes(url.protocol) || value.includes("\\")) fail("DESTINATION_INVALID");
    return url;
  }
  const getApplicationResponse = async (path: string, options: ResponseOptions = {}, deadline = Date.now() + 10000): Promise<ApplicationResponse> => {
    let url = destination(path);
    const visited = new Set<string>();
    for (let hop = 0; hop <= 5; hop++) {
      if (Date.now() >= deadline) fail("REQUEST_FAILED");
      if (visited.has(url.href)) fail("REDIRECT_INVALID");
      visited.add(url.href);
      let response: APIResponse;
      try {
        response = await context.get(url.href, { headers: { ...accessHeaders, ...(options.acceptLanguage ? { "Accept-Language": options.acceptLanguage } : {}) },
          maxRedirects: 0, maxRetries: 0, timeout: Math.max(1, Math.min(10000, deadline - Date.now())) });
      } catch { return fail("REQUEST_FAILED"); }
      try {
        const headers = response.headers();
        const status = response.status();
        let location: URL | undefined;
        if (redirects.has(status)) {
          if (!headers.location) fail("REDIRECT_INVALID");
          location = destination(headers.location!, url.href);
          if (visited.has(location.href)) fail("REDIRECT_INVALID");
          headers.location = `${location.pathname}${location.search}${location.hash}`;
        }
        if (location && options.redirect !== "manual") { url = location; continue; }
        const body = await response.text();
        const finalURL = url.href;
        return { status: () => status, ok: () => status >= 200 && status < 300, headers: () => ({ ...headers }),
          text: async () => body, json: async () => JSON.parse(body), url: () => finalURL };
      } finally { await response.dispose(); }
    }
    return fail("REDIRECT_LIMIT");
  };
  const openApplicationPage: OpenApplicationPage = async (page, path, options = {}) => {
    const response = await getApplicationResponse(path, { ...options, redirect: "same-origin" });
    try { return await page.goto(response.url(), { waitUntil: "networkidle" }); }
    catch { return fail("NAVIGATION_FAILED"); }
  };
  const installBrowserProtection = async (browser: BrowserContext) => {
    const pending = new Map<Request, { timer: ReturnType<typeof setTimeout>; successfulFetchResponse: boolean }>();
    const settled = (request: Request) => { const state = pending.get(request); if (state) { clearTimeout(state.timer); pending.delete(request); } };
    const responded = (response: Response) => {
      const request = response.request();
      const state = pending.get(request);
      const status = response.status();
      if (state && request.resourceType() === "fetch" && status >= 200 && status < 300) state.successfulFetchResponse = true;
    };
    const failed = (request: Request) => {
      const state = pending.get(request);
      if (state && !(state.successfulFetchResponse && request.resourceType() === "fetch" && request.failure()?.errorText === "net::ERR_ABORTED")) browserFailure = true;
      settled(request);
    };
    if (mode === guardedDevelopmentMode) {
      browser.on("response", responded);
      browser.on("requestfinished", settled);
      browser.on("requestfailed", failed);
      browserCleanups.push(() => {
        browser.off("response", responded); browser.off("requestfinished", settled); browser.off("requestfailed", failed);
        for (const state of pending.values()) clearTimeout(state.timer);
        pending.clear();
      });
    }
    await browser.routeWebSocket("**/*", route => {
      const url = new URL(route.url());
      const origin = settings.origin.replace(/^http/u, "ws");
      if (!settings.protectedStaging && url.origin === origin && url.pathname === "/_next/hmr") route.connectToServer();
      else { browserFailure = true; route.close(); }
    });
    await browser.route("**/*", async route => {
      let response: APIResponse | undefined;
      try {
        const incoming = route.request();
        destination(incoming.url());
        if (mode === guardedDevelopmentMode) {
          const timer = setTimeout(() => {
            pending.delete(incoming); browserFailure = true;
            // This bounds a hung request; redirect safety belongs to the server response barrier.
            let page: Page | undefined;
            try { page = incoming.frame().page(); } catch { /* A first popup request may not have a frame yet. */ }
            void (page ? page.close() : browser.close()).catch(() => {});
          }, 10000);
          pending.set(incoming, { timer, successfulFetchResponse: false });
          await route.continue();
          return;
        }
        response = await route.fetch({ headers: { ...route.request().headers(), ...accessHeaders }, maxRedirects: 0, maxRetries: 0, timeout: 10000 });
        if (redirects.has(response.status())) fail("BROWSER_REDIRECT_FORBIDDEN");
        await route.fulfill({ response });
      } catch { settled(route.request()); browserFailure = true; await route.abort("blockedbyclient").catch(() => {}); }
      finally { await response?.dispose(); }
    });
  };
  const waitForApplication = async () => {
    const deadline = Date.now() + 60000;
    for (let attempt = 0; attempt < 12 && Date.now() < deadline; attempt++) {
      try { if ((await getApplicationResponse("/", { redirect: "same-origin" }, Math.min(deadline, Date.now() + 10000))).ok()) return; } catch { /* Retry only bounded read-only readiness probes. */ }
      if (attempt < 11 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, Math.min(1000, deadline - Date.now())));
    }
    fail("READINESS_FAILED");
  };
  return { settings, getApplicationResponse, openApplicationPage, installBrowserProtection, waitForApplication,
    assertBrowserRequests: () => { if (browserFailure) fail("BROWSER_REQUEST_BLOCKED"); },
    dispose: async () => { for (const cleanup of browserCleanups) cleanup(); await context.dispose(); } };
}
