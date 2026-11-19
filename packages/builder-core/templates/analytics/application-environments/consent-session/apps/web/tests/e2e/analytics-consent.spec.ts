import { readFileSync } from "node:fs";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type OpenApplicationPage } from "./application-test";
import { type BrowserContext, type Page } from "@playwright/test";
import { parse } from "yaml";

import {
  createAnalyticsConsentContext,
  createAnalyticsConsentRecord,
  type AnalyticsCollectionContext,
  type AnalyticsConsentRecordV3,
  type AnalyticsPurposeDecision,
} from "../../src/integrations/analytics/analytics-consent-state";
import {
  createAnalyticsProviderDeclarations,
  type AnalyticsProviderIdentifier,
  type AnalyticsPurposeIdentifier,
  type AnalyticsSettings,
} from "../../src/integrations/analytics/analytics-provider-contract";
import { analyticsConsentStorageKey } from "../../src/integrations/analytics/analytics-runtime";
import { analyticsSettings } from "../../src/integrations/analytics/analytics-settings";

// Independent orchestration inputs describe the build, including when serving values contradict it.
function requiredExpectation(name: string): string {
  const value = process.env[name];
  if (value === undefined) throw new Error(`${name}:missing`);
  return value;
}
const expectedFlag = requiredExpectation("ANALYTICS_TEST_BUILD_FLAG");
const expectedCloudflareToken = requiredExpectation("ANALYTICS_TEST_EXPECTED_CLOUDFLARE_TOKEN");
const expectedGoogleId = requiredExpectation("ANALYTICS_TEST_EXPECTED_GA4_ID");
const expectedClarityId = requiredExpectation("ANALYTICS_TEST_EXPECTED_CLARITY_ID");
const expectedSiteOrigin = requiredExpectation("ANALYTICS_TEST_EXPECTED_SITE_ORIGIN");
const expectedVerification = requiredExpectation("ANALYTICS_TEST_EXPECTED_VERIFICATION");
const target = requiredExpectation("ANALYTICS_TEST_TARGET");
if (target !== "development" && target !== "staging" && target !== "production") throw new Error("ANALYTICS_TEST_TARGET:invalid");
const settings: AnalyticsSettings = analyticsSettings;
const declarations = createAnalyticsProviderDeclarations(settings);
const purposes = declarations.map(({ purpose }) => purpose).sort();
const destinations = {
  "cloudflare-web-analytics": expectedCloudflareToken,
  "google-analytics-4": expectedGoogleId,
  "microsoft-clarity": expectedClarityId,
};
const expectedCollectionContext: AnalyticsCollectionContext = {
  collectionEnabled: expectedFlag === "true",
  applicationEnvironment: target,
  siteOrigin: settings.providers.microsoftClarity === undefined || expectedSiteOrigin === "" ? null : expectedSiteOrigin,
  destinations: declarations.map(({ identifier }) => ({ provider: identifier, destination: destinations[identifier] || null })).sort((left, right) => left.provider.localeCompare(right.provider)),
};
const active = expectedFlag === "true" && declarations.every(({ identifier }) => destinations[identifier] !== "") &&
  (settings.providers.microsoftClarity === undefined || expectedSiteOrigin !== "");
const controlsHarness = process.env.ANALYTICS_TEST_CONTROLS_HARNESS === "enabled";
if (controlsHarness && !active) throw new Error("ANALYTICS_TEST_CONTROLS_HARNESS_REQUIRES_ACTIVE_COLLECTION");
const cookiePrefix = target === "production" ? "egeria_production" : "egeria_nonproduction";
const project: unknown = parse(readFileSync(new URL("../../../../.egeria/project.yaml", import.meta.url), "utf8"));
const selected: unknown = typeof project === "object" && project !== null ? Reflect.get(project, "selectedCapabilities") : undefined;
if (!Array.isArray(selected) || !selected.every(value => typeof value === "string")) throw new Error("ANALYTICS_TEST_SELECTION_INVALID");
const contactSelected = selected.includes("contact-form-web3forms");
const bookingSelected = selected.includes("booking-calendly");
const expectedContactKey = contactSelected ? requiredExpectation("CONTACT_TEST_EXPECTED_ACCESS_KEY") : "";
const expectedBookingUrl = bookingSelected ? requiredExpectation("BOOKING_TEST_EXPECTED_URL") : "";
const expectedBookingRequestUrl = expectedBookingUrl === "" ? "" : new URL(expectedBookingUrl).href;
const bookingMode = bookingSelected ? requiredExpectation("BOOKING_TEST_MODE") : "";
const locales = selected.includes("multilingual") ? ["en-CA", "fr-CA"] : ["en-CA"];
const routes = locales.map(locale => ({ locale, path: locales.length === 2 ? `/${locale}` : "/" }));
const primaryPath = routes[0]?.path ?? "/";
const action = (page: Page, name: string) => page.locator(`[data-analytics-consent-action="${name}"]`);
const choice = (page: Page, purpose: AnalyticsPurposeIdentifier) => page.locator(`[data-analytics-consent-purpose="${purpose}"]`);

function localeText(locale: string, key: string): string {
  const content: unknown = parse(readFileSync(new URL(`../../content/${locale}/analytics.yaml`, import.meta.url), "utf8"));
  const text: unknown = typeof content === "object" && content !== null ? Reflect.get(content, key) : undefined;
  if (typeof text !== "string") throw new Error("ANALYTICS_TEST_CONTENT_INVALID");
  return text;
}

type ProviderRequest = { provider: AnalyticsProviderIdentifier; script: boolean; url: string; page: Page };
type Command = { provider: string; parameters: unknown[]; page: Page };
type Audit = { requests: ProviderRequest[]; commands: Command[]; attempts: string[]; unexpected: string[]; submissions: Record<string, unknown>[]; bookings: string[] };
const audits = new WeakMap<BrowserContext, Audit>();
test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ context, baseURL }) => {
  if (typeof baseURL !== "string") throw new Error("BASE_URL_REQUIRED");
  const appOrigin = new URL(baseURL).origin;
  const transportOrigin = "http://127.0.0.1:3101";
  const audit: Audit = { requests: [], commands: [], attempts: [], unexpected: [], submissions: [], bookings: [] };
  audits.set(context, audit);
  await context.exposeBinding("__analyticsRecord", ({ page }, provider: string, parameters: unknown[]) => {
    audit.commands.push({ page, provider, parameters });
  });
  await context.routeWebSocket("**/*", socket => {
    const url = new URL(socket.url());
    if (!process.env.DEPLOY_URL && (url.origin === "ws://127.0.0.1:3101" || url.origin === "ws://127.0.0.1:3100") && url.pathname === "/_next/hmr") {
      socket.connectToServer();
    } else {
      audit.unexpected.push(url.href);
      void socket.close();
    }
  });
  await context.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === appOrigin) {
      if (process.env.DEPLOY_URL) return route.fallback();
      if (appOrigin === transportOrigin || appOrigin === "http://127.0.0.1:3100") return route.fallback();
    }
    if (!process.env.DEPLOY_URL && (url.origin === appOrigin || url.origin === transportOrigin)) {
      // Synthetic origins and the deliberate wrong-origin challenge use only the owned loopback server.
      const response = await route.fetch({ url: `${transportOrigin}${url.pathname}${url.search}`, maxRedirects: 0, maxRetries: 0, timeout: 10000 });
      try {
        if ([301, 302, 303, 307, 308].includes(response.status())) { audit.unexpected.push(url.href); return await route.abort(); }
        return await route.fulfill({ response });
      } finally { await response.dispose(); }
    }
    audit.attempts.push(url.href);
    const provider: AnalyticsProviderIdentifier | undefined =
      url.origin === "https://static.cloudflareinsights.com" || url.origin === "https://cloudflareinsights.com" ? "cloudflare-web-analytics" :
      url.origin === "https://www.googletagmanager.com" || url.origin === "https://www.google-analytics.com" ? "google-analytics-4" :
      url.origin === "https://www.clarity.ms" ? "microsoft-clarity" : undefined;
    if (provider !== undefined && declarations.some(({ identifier }) => identifier === provider)) {
      const script = request.resourceType() === "script";
      audit.requests.push({ provider, script, url: url.href, page: request.frame().page() });
      let body = "";
      if (script && provider === "cloudflare-web-analytics" && url.href === "https://static.cloudflareinsights.com/beacon.min.js") {
        body = `const token = JSON.parse(document.currentScript.dataset.cfBeacon).token;
          window.__analyticsRecord('cloudflare', [token]);
          fetch('https://cloudflareinsights.com/cdn-cgi/rum?token=' + encodeURIComponent(token));`;
      } else if (script && provider === "google-analytics-4" && url.pathname === "/gtag/js") {
        body = `(() => {
          const queued = Array.from(window.dataLayer || [], value => Array.from(value));
          const command = (...values) => window.__analyticsRecord('google', values);
          queued.forEach(values => command(...values)); window.gtag = command;
          const configuration = queued.find(values => values[0] === 'config');
          if (configuration) {
            const id = configuration[1], options = configuration[2];
            document.cookie = options.cookie_prefix + '_ga=synthetic; Path=/; SameSite=Lax; Secure';
            document.cookie = options.cookie_prefix + '_ga_' + id.slice(2) + '=synthetic; Path=/; SameSite=Lax; Secure';
            fetch('https://www.google-analytics.com/g/collect?tid=' + encodeURIComponent(id));
          }
        })();`;
      } else if (script && provider === "microsoft-clarity" && url.pathname.startsWith("/tag/")) {
        body = `(() => {
          const id = new URL(document.currentScript.src).pathname.slice(5);
          const queued = window.clarity?.q || [];
          const command = (...values) => window.__analyticsRecord('clarity', values);
          queued.forEach(values => command(...values)); window.clarity = command;
          document.cookie = '_clck=synthetic; Path=/; SameSite=Lax; Secure';
          document.cookie = '_clsk=synthetic; Path=/; SameSite=Lax; Secure';
          fetch('https://www.clarity.ms/collect?project=' + encodeURIComponent(id));
        })();`;
      } else if (script || !["/cdn-cgi/rum", "/g/collect", "/collect"].includes(url.pathname)) {
        audit.unexpected.push(url.href);
        return route.abort();
      }
      return route.fulfill({ status: 200, contentType: script ? "application/javascript" : "text/plain", headers: { "access-control-allow-origin": "*", "cache-control": "no-store" }, body });
    }
    if (contactSelected && expectedContactKey !== "" && url.href === "https://js.hcaptcha.com/1/api.js?onload=egeriaContactCaptchaReady&render=explicit&recaptchacompat=off") {
      return route.fulfill({ contentType: "application/javascript", body: `
        window.hcaptcha = { render: (container, options) => {
          const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Synthetic challenge';
          button.onclick = () => options.callback('synthetic-token'); container.appendChild(button); return 'synthetic-widget';
        }, reset: () => {}, remove: () => {} };
        window.egeriaContactCaptchaReady();` });
    }
    if (contactSelected && expectedContactKey !== "" && url.href === "https://api.web3forms.com/submit") {
      if (request.method() === "POST") audit.submissions.push(request.postDataJSON() as Record<string, unknown>);
      return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type" }, body: JSON.stringify({ success: true }) });
    }
    if (bookingSelected && expectedBookingRequestUrl !== "" && url.href === expectedBookingRequestUrl && request.isNavigationRequest()) {
      audit.bookings.push(url.href);
      return route.fulfill({ contentType: "text/html", body: '<!doctype html><html lang="en"><head><title>Synthetic scheduling</title><link rel="icon" href="data:,"></head><body><main>Synthetic scheduling</main></body></html>' });
    }
    audit.unexpected.push(url.href);
    return route.abort();
  });
});

test.afterEach(async ({ context }, information) => {
  // Stop request producers before removing interception, then drain handlers before context disposal.
  for (const page of context.pages()) await page.close();
  await context.unrouteAll({ behavior: "wait" });
  const audit = audits.get(context);
  if (audit === undefined) throw new Error("ANALYTICS_TEST_AUDIT_MISSING");
  if (!process.env.CF_ACCESS_CLIENT_ID) await information.attach("controlled-request-audit", { contentType: "application/json", body: JSON.stringify({
    ...audit, requests: audit.requests.map(({ provider, script, url }) => ({ provider, script, url })), commands: audit.commands.map(({ provider, parameters }) => ({ provider, parameters })),
  }) });
  expect(audit.unexpected).toEqual([]);
  if (!active) expect(audit.requests).toEqual([]);
  if (expectedContactKey === "") expect(audit.submissions).toEqual([]);
  if (expectedBookingUrl === "") expect(audit.bookings).toEqual([]);
});

function auditFor(page: Page): Audit {
  const audit = audits.get(page.context());
  if (audit === undefined) throw new Error("ANALYTICS_TEST_AUDIT_MISSING");
  return audit;
}
function decisions(granted: readonly AnalyticsPurposeIdentifier[]): readonly AnalyticsPurposeDecision[] {
  return purposes.map(purpose => ({ purpose, decision: granted.includes(purpose) ? "granted" : "denied" }));
}
function consentRecord(granted = purposes, date = new Date()) {
  return createAnalyticsConsentRecord(decisions(granted), createAnalyticsConsentContext(settings), expectedCollectionContext, date);
}
async function preload(page: Page, record: unknown) {
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: analyticsConsentStorageKey, value: JSON.stringify(record) });
}
async function readRecord(page: Page): Promise<AnalyticsConsentRecordV3> {
  const value = await page.evaluate(key => localStorage.getItem(key), analyticsConsentStorageKey);
  expect(value).not.toBeNull();
  return JSON.parse(value ?? "null") as AnalyticsConsentRecordV3;
}
async function clearFromAnotherDocument(page: Page, replacement: string | null) {
  return page.evaluate(({ key, replacement }) => new Promise<boolean[]>(resolve => {
    const frame = document.createElement("iframe");
    frame.hidden = true;
    document.body.append(frame);
    const storage = frame.contentWindow?.localStorage;
    if (storage === undefined) throw new Error("ANALYTICS_TEST_STORAGE_WRITER_MISSING");
    const trusted: boolean[] = [];
    const listener = (event: StorageEvent) => {
      const expectedKey = trusted.length === 0 ? null : key;
      const expectedValue = trusted.length === 0 ? null : replacement;
      if (event.storageArea !== localStorage || event.key !== expectedKey || event.newValue !== expectedValue) return;
      trusted.push(event.isTrusted);
      if (replacement === null || trusted.length === 2) {
        window.removeEventListener("storage", listener);
        frame.remove();
        resolve(trusted);
      }
    };
    window.addEventListener("storage", listener);
    storage.clear();
    if (replacement !== null) storage.setItem(key, replacement);
  }), { key: analyticsConsentStorageKey, replacement });
}
async function visit(page: Page, openApplicationPage: OpenApplicationPage, path: string) {
  // Local synthetic origins are resolved by the bounded loopback interceptor above.
  if (process.env.DEPLOY_URL) await openApplicationPage(page, path);
  else await page.goto(path, { waitUntil: "networkidle" });
  if (bookingMode === "inline" && expectedBookingUrl !== "") {
    // The lazy inline frame changes layout; settle it before scrolling to consent controls.
    await page.getByTestId("booking-inline-region").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("booking-frame")).toBeVisible();
  }
}
async function assertQueues(page: Page, selected: readonly AnalyticsProviderIdentifier[]) {
  const globals = await page.evaluate(() => ({ google: typeof Reflect.get(window, "gtag"), data: typeof Reflect.get(window, "dataLayer"), clarity: typeof Reflect.get(window, "clarity") }));
  expect(globals.google).toBe(selected.includes("google-analytics-4") ? "function" : "undefined");
  expect(globals.data).toBe(selected.includes("google-analytics-4") ? "object" : "undefined");
  expect(globals.clarity).toBe(selected.includes("microsoft-clarity") ? "function" : "undefined");
}
async function assertProviders(page: Page, requested: readonly AnalyticsProviderIdentifier[], requestsBefore = 0) {
  const selected = active ? requested : [];
  const relevantRequests = () => auditFor(page).requests.slice(requestsBefore).filter(value => value.page === page);
  for (const declaration of declarations) await expect(page.locator(`#${declaration.scriptId}`)).toHaveCount(selected.includes(declaration.identifier) ? 1 : 0);
  for (const provider of selected) {
    const collectionUrl = provider === "cloudflare-web-analytics" ? `https://cloudflareinsights.com/cdn-cgi/rum?token=${expectedCloudflareToken}` :
      provider === "google-analytics-4" ? `https://www.google-analytics.com/g/collect?tid=${expectedGoogleId}` :
        `https://www.clarity.ms/collect?project=${expectedClarityId}`;
    await expect.poll(() => relevantRequests().some(value => value.url === collectionUrl)).toBe(true);
  }
  const requests = relevantRequests();
  expect([...new Set(requests.map(value => value.provider))].sort()).toEqual([...selected].sort());
  await assertQueues(page, selected);
  for (const provider of selected) {
    const scripts = requests.filter(value => value.provider === provider && value.script);
    expect(scripts).toHaveLength(1);
    if (provider === "cloudflare-web-analytics") {
      expect(scripts[0]?.url).toBe("https://static.cloudflareinsights.com/beacon.min.js");
    } else if (provider === "google-analytics-4") {
      expect(scripts[0]?.url).toBe(`https://www.googletagmanager.com/gtag/js?id=${expectedGoogleId}`);
      expect(auditFor(page).commands.filter(value => value.page === page && value.provider === "google").map(value => value.parameters)).toContainEqual([
        "config", expectedGoogleId, { send_page_view: true, cookie_domain: "none", cookie_path: "/", cookie_prefix: cookiePrefix, allow_google_signals: false, allow_ad_personalization_signals: false },
      ]);
      const cookies = await page.context().cookies(page.url());
      for (const name of [`${cookiePrefix}_ga`, `${cookiePrefix}_ga_${expectedGoogleId.slice(2)}`]) {
        expect(cookies.find(cookie => cookie.name === name)?.domain).toBe(new URL(page.url()).hostname);
      }
    } else {
      expect(scripts[0]?.url).toBe(`https://www.clarity.ms/tag/${expectedClarityId}`);
    }
  }
}
async function select(page: Page, granted: readonly AnalyticsPurposeIdentifier[]) {
  await action(page, "choose").click();
  for (const purpose of granted) await choice(page, purpose).check();
  await action(page, "save").click();
}
async function focusWithTab(page: Page, locator: ReturnType<typeof action>) {
  for (let count = 0; count < 60; count++) {
    if (await locator.evaluate(element => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  await expect(locator).toBeFocused();
}

// Search-only selection has its own executed case, without provider-suite skips.
test("metadata belongs only to the expected production property and first visit stays inactive", async ({ openApplicationPage, page }) => {
  await visit(page, openApplicationPage, primaryPath);
  const verification = page.locator('meta[name="google-site-verification"]');
  if (expectedVerification === "") await expect(verification).toHaveCount(0);
  else await expect(verification).toHaveAttribute("content", expectedVerification);
  await expect(page.locator('[data-analytics-consent-action="choose"]')).toHaveCount(declarations.length === 0 ? 0 : 1);
  await assertProviders(page, []);
});

if (declarations.length > 0) {
  test("a remote saved denial moves keyboard focus from Choose to Manage", async ({ context, openApplicationPage, page }) => {
    const other = await context.newPage();
    await Promise.all([visit(page, openApplicationPage, primaryPath), visit(other, openApplicationPage, primaryPath)]);
    await focusWithTab(page, action(page, "choose"));
    const originalDocument = await page.evaluateHandle(() => document);

    await action(other, "decline").click();
    await expect(action(page, "manage")).toBeFocused();
    expect((await readRecord(page)).purposes).toEqual(decisions([]));
    await assertProviders(page, []);
    expect(await originalDocument.evaluate(original => original === document)).toBe(true);
    await originalDocument.dispose();
  });

  test("denial remains authoritative across queued grant events and reload", async ({ openApplicationPage, page }) => {
    await visit(page, openApplicationPage, primaryPath);
    await action(page, "decline").click();
    const events = await page.evaluate(({ key, granted, denied }) => new Promise<{
      trusted: boolean; grant: boolean; storedDenial: boolean; scripts: string[];
    }[]>(resolve => {
      const frame = document.createElement("iframe");
      frame.hidden = true;
      document.body.append(frame);
      const storage = frame.contentWindow?.localStorage;
      if (storage === undefined) throw new Error("ANALYTICS_TEST_STORAGE_WRITER_MISSING");
      const observed: { trusted: boolean; grant: boolean; storedDenial: boolean; scripts: string[] }[] = [];
      const listener = (event: StorageEvent) => {
        if (event.key !== key || event.storageArea !== localStorage) return;
        observed.push({
          trusted: event.isTrusted, grant: event.newValue === granted,
          storedDenial: localStorage.getItem(key) === denied,
          scripts: Array.from(document.querySelectorAll('script[id^="analytics-"]'), script => script.id),
        });
        if (observed.length === 2) {
          window.removeEventListener("storage", listener);
          frame.remove();
          resolve(observed);
        }
      };
      window.addEventListener("storage", listener);
      // Both writes finish in this task before native FIFO events reach the page's consent listener.
      storage.setItem(key, granted);
      storage.setItem(key, denied);
    }), { key: analyticsConsentStorageKey, granted: JSON.stringify(consentRecord()), denied: JSON.stringify(consentRecord([])) });
    expect(events).toEqual([
      { trusted: true, grant: true, storedDenial: true, scripts: [] },
      { trusted: true, grant: false, storedDenial: true, scripts: [] },
    ]);
    await assertProviders(page, []);
    expect(auditFor(page).commands).toEqual([]);
    await page.reload();
    await expect(action(page, "manage")).toBeVisible();
    const record = await readRecord(page);
    expect(record.schemaVersion).toBe(3);
    expect(record.collectionContext).toEqual(expectedCollectionContext);
    expect(record.purposes).toEqual(decisions([]));
    await assertProviders(page, []);

    const originalDocument = await page.evaluateHandle(() => document);
    expect(await clearFromAnotherDocument(page, null)).toEqual([true]);
    for (const name of ["allow", "decline", "choose"] as const) await expect(action(page, name)).toBeVisible();
    await expect(action(page, "manage")).toHaveCount(0);
    expect(await originalDocument.evaluate(original => original === document)).toBe(true);
    await originalDocument.dispose();
    await assertProviders(page, []);
    expect(auditFor(page).requests).toEqual([]);
    expect(auditFor(page).commands).toEqual([]);
  });

  test("an accepted saved grant obeys the compiled activation and destinations", async ({ openApplicationPage, page }) => {
    await preload(page, consentRecord());
    await visit(page, openApplicationPage, primaryPath);
    await expect(action(page, "manage")).toBeVisible();
    expect((await readRecord(page)).collectionContext).toEqual(expectedCollectionContext);
    await assertProviders(page, declarations.map(value => value.identifier));
  });

  if (active && settings.providers.googleAnalytics4 !== undefined && settings.providers.cloudflareWebAnalytics !== undefined) {
    for (const retainClarity of settings.providers.microsoftClarity === undefined ? [false] : [false, true]) {
      test(`current stored denial reduces active providers before another event${retainClarity ? " while retaining Clarity" : ""}`, async ({ openApplicationPage, page }, information) => {
        const retained: AnalyticsPurposeIdentifier[] = retainClarity ? ["consented-experience-analysis"] : [];
        await visit(page, openApplicationPage, primaryPath);
        await select(page, ["audience-measurement", ...retained]);
        await assertProviders(page, ["google-analytics-4", ...(retainClarity ? ["microsoft-clarity" as const] : [])]);
        const requestsBefore = auditFor(page).requests.length;
        const observationKey = "egeria.analytics.test.first-event";
        const stored = JSON.stringify(consentRecord(retained));
        await Promise.all([
          page.waitForEvent("domcontentloaded"),
          page.evaluate(({ key, observationKey, expansion, stored }) => {
            sessionStorage.removeItem(observationKey);
            const google = Reflect.get(window, "gtag") as (...parameters: unknown[]) => void;
            const commands: unknown[][] = [];
            Reflect.set(window, "gtag", (...parameters: unknown[]) => {
              commands.push(parameters);
              google(...parameters);
            });
            const listener = (event: StorageEvent) => {
              if (event.key !== key || event.storageArea !== localStorage || event.newValue !== expansion) return;
              // This observer follows the application listener; its first-event snapshot survives reload.
              sessionStorage.setItem(observationKey, JSON.stringify({
                trusted: event.isTrusted,
                storedDenial: localStorage.getItem(key) === stored,
                scripts: Array.from(document.querySelectorAll('script[id^="analytics-"]'), script => script.id),
                cookies: document.cookie.split(";").map(cookie => cookie.split("=", 1)[0]?.trim()),
                commands,
              }));
              window.removeEventListener("storage", listener);
            };
            window.addEventListener("storage", listener);
            const frame = document.createElement("iframe");
            frame.hidden = true;
            document.body.append(frame);
            const storage = frame.contentWindow?.localStorage;
            if (storage === undefined) throw new Error("ANALYTICS_TEST_STORAGE_WRITER_MISSING");
            storage.setItem(key, expansion);
            storage.setItem(key, stored);
          }, {
            key: analyticsConsentStorageKey, observationKey, stored,
            expansion: JSON.stringify(consentRecord(["audience-measurement", "aggregate-traffic-and-performance", ...retained])),
          }),
        ]);
        const source = await page.evaluate(key => sessionStorage.getItem(key), observationKey);
        expect(source).not.toBeNull();
        const observed = JSON.parse(source ?? "null");
        if (!process.env.CF_ACCESS_CLIENT_ID) await information.attach("first-storage-event", { contentType: "application/json", body: source ?? "null" });
        expect(observed).toMatchObject({
          trusted: true, storedDenial: true,
          scripts: retainClarity ? ["analytics-microsoft-clarity"] : [],
          commands: [["consent", "update", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" }]],
        });
        expect(observed.cookies).not.toContain(`${cookiePrefix}_ga`);
        expect(observed.cookies).not.toContain(`${cookiePrefix}_ga_${expectedGoogleId.slice(2)}`);
        if (retainClarity) expect(observed.cookies).toEqual(expect.arrayContaining(["_clck", "_clsk"]));
        await expect(action(page, "manage")).toBeVisible();
        expect((await readRecord(page)).purposes).toEqual(decisions(retained));
        await assertProviders(page, retainClarity ? ["microsoft-clarity"] : [], requestsBefore);
        await page.evaluate(key => sessionStorage.removeItem(key), observationKey);
      });
    }
  }

  for (const declaration of declarations) {
    test(`an isolated ${declaration.purpose} choice activates only its own provider`, async ({ openApplicationPage, page }) => {
      await visit(page, openApplicationPage, primaryPath);
      await select(page, [declaration.purpose]);
      await expect(action(page, "manage")).toBeVisible();
      await assertProviders(page, [declaration.identifier]);
    });
  }

  test("repeated all-purpose grants do not duplicate scripts or reset provider defaults", async ({ openApplicationPage, page }) => {
    await visit(page, openApplicationPage, primaryPath);
    await action(page, "allow").click();
    await assertProviders(page, declarations.map(value => value.identifier));
    await action(page, "manage").click();
    await action(page, "allow").click();
    await assertProviders(page, declarations.map(value => value.identifier));
    for (const [provider, command] of [["google", "consent"], ["clarity", "consentv2"]]) {
      const defaults = auditFor(page).commands.filter(value => value.provider === provider && value.parameters[0] === command && (provider === "google" ? value.parameters[1] === "default" : JSON.stringify(value.parameters[1]).includes('"analytics_Storage":"denied"')));
      expect(defaults).toHaveLength(active && (provider === "google" ? settings.providers.googleAnalytics4 : settings.providers.microsoftClarity) !== undefined ? 1 : 0);
    }
  });

  for (const changed of ["activation", "target", "destination", "origin", "old-format", "expired"] as const) {
    test(`a ${changed} record grants nothing and prompts again`, async ({ openApplicationPage, page }) => {
      const record = consentRecord(purposes, changed === "expired" ? new Date(Date.now() - 181 * 86_400_000) : new Date());
      const altered = structuredClone(record) as Record<string, unknown>;
      if (changed === "old-format") altered.schemaVersion = 2;
      else if (changed !== "expired") {
        altered.collectionContext = { ...record.collectionContext,
          ...(changed === "activation" ? { collectionEnabled: !record.collectionContext.collectionEnabled } : {}),
          ...(changed === "target" ? { applicationEnvironment: target === "production" ? "staging" : "production" } : {}),
          ...(changed === "destination" ? { destinations: record.collectionContext.destinations.map((value, index) => index === 0 ? { ...value, destination: "changed-destination" } : value) } : {}),
          ...(changed === "origin" ? { siteOrigin: "https://different.invalid" } : {}),
        };
      }
      await preload(page, altered);
      await visit(page, openApplicationPage, primaryPath);
      await expect(action(page, "choose")).toBeVisible();
      await assertProviders(page, []);
    });
  }

  if (controlsHarness) {
    test("active withdrawal stops providers while the first tab has zero controls", async ({ context, openApplicationPage }) => {
      const first = await context.newPage();
      const second = await context.newPage();
      const controls = first.locator('[aria-labelledby="analytics-consent-heading"]');
      await Promise.all([visit(first, openApplicationPage, primaryPath), visit(second, openApplicationPage, primaryPath)]);
      await assertProviders(first, []);
      await assertProviders(second, []);
      expect(auditFor(first).requests).toEqual([]);
      expect(auditFor(second).requests).toEqual([]);

      const configured = declarations.map(({ identifier }) => identifier);
      await select(first, purposes);
      await assertProviders(first, configured);
      await assertProviders(second, configured);
      const oldDocument = await first.evaluateHandle(() => document);
      await first.getByRole("button", { name: "Hide test consent controls" }).click();
      await expect(controls).toHaveCount(0);
      expect(await oldDocument.evaluate(previous => previous === document)).toBe(true);
      await oldDocument.dispose();
      await assertProviders(first, configured);

      const observationKey = "egeria.analytics.test.unmounted-withdrawal";
      await first.evaluate(({ key, observationKey }) => {
        window.addEventListener("storage", event => {
          if (event.key !== key || event.storageArea !== localStorage) return;
          sessionStorage.setItem(observationKey, JSON.stringify({
            trusted: event.isTrusted,
            scripts: document.querySelectorAll('script[id^="analytics-"]').length,
            controls: document.querySelectorAll('[aria-labelledby="analytics-consent-heading"]').length,
          }));
        });
      }, { key: analyticsConsentStorageKey, observationKey });

      const requestsBefore = auditFor(first).requests.length;
      const documentLoads = new Map([[first, 0], [second, 0]]);
      for (const page of [first, second]) {
        page.on("request", request => {
          if (request.isNavigationRequest() && request.resourceType() === "document" && request.frame() === page.mainFrame()) {
            documentLoads.set(page, (documentLoads.get(page) ?? 0) + 1);
          }
        });
      }
      await Promise.all([
        second.waitForEvent("domcontentloaded"),
        action(second, "withdraw").click(),
      ]);
      await expect.poll(() => first.evaluate(
        key => JSON.parse(sessionStorage.getItem(key) ?? "null") as unknown,
        observationKey,
      ).catch(() => null)).toEqual({ trusted: true, scripts: 0, controls: 0 });
      await expect.poll(() => documentLoads.get(first)).toBe(1);
      const showControls = first.getByRole("button", { name: "Show test consent controls" });
      await expect(showControls).toBeVisible();
      await expect(controls).toHaveCount(0);
      const commands = auditFor(first).commands.filter(command => command.page === first);
      if (settings.providers.googleAnalytics4 !== undefined) {
        expect(commands).toContainEqual(expect.objectContaining({
          provider: "google",
          parameters: ["consent", "update", expect.objectContaining({ analytics_storage: "denied" })],
        }));
      }
      if (settings.providers.microsoftClarity !== undefined) {
        expect(commands).toContainEqual(expect.objectContaining({
          provider: "clarity", parameters: ["consent", false],
        }));
      }
      expect((await readRecord(first)).purposes).toEqual(decisions([]));
      await assertQueues(first, []);
      for (const { scriptId } of declarations) await expect(first.locator(`#${scriptId}`)).toHaveCount(0);
      const withdrawnDocument = await first.evaluateHandle(() => document);
      await showControls.click();
      await expect(action(first, "manage")).toBeVisible();
      await assertQueues(first, []);
      for (const { scriptId } of declarations) await expect(first.locator(`#${scriptId}`)).toHaveCount(0);
      expect(auditFor(first).requests.slice(requestsBefore)).toEqual([]);
      expect(await withdrawnDocument.evaluate(previous => previous === document)).toBe(true);
      await withdrawnDocument.dispose();
      expect([documentLoads.get(first), documentLoads.get(second)]).toEqual([1, 1]);
    });
  }

  test("withdrawal removes only this installation's cookies and reloads both pages without providers", async ({ context, openApplicationPage }) => {
    const first = await context.newPage();
    const second = await context.newPage();
    await Promise.all([visit(first, openApplicationPage, primaryPath), visit(second, openApplicationPage, primaryPath)]);
    await Promise.all([expect(action(first, "choose")).toBeVisible(), expect(action(second, "choose")).toBeVisible()]);
    const initial = declarations[0];
    if (initial === undefined) throw new Error("ANALYTICS_TEST_PROVIDER_MISSING");
    await select(first, [initial.purpose]);
    await expect(action(second, "manage")).toBeVisible();
    await assertProviders(first, [initial.identifier]);
    await assertProviders(second, [initial.identifier]);
    await action(first, "manage").click();
    await action(first, "allow").click();
    await expect(action(second, "manage")).toBeVisible();
    await assertProviders(first, declarations.map(value => value.identifier));
    await assertProviders(second, declarations.map(value => value.identifier));
    await first.evaluate(() => { document.cookie = "_ga=unrelated; Path=/; SameSite=Lax"; document.cookie = "egeria_unrelated_ga=unrelated; Path=/; SameSite=Lax"; });
    const reloads = [first, second].map(page => page.waitForEvent("framenavigated", { predicate: frame => frame === page.mainFrame() }));
    const requestsBefore = auditFor(first).requests.length;
    await action(first, "withdraw").click();
    await Promise.all(reloads);
    for (const page of [first, second]) {
      await expect(action(page, "manage")).toBeVisible();
      await assertProviders(page, [], requestsBefore);
      expect((await readRecord(page)).purposes).toEqual(decisions([]));
    }
    const cookies = await context.cookies(first.url());
    expect(cookies.map(value => value.name)).toEqual(expect.arrayContaining(["_ga", "egeria_unrelated_ga"]));
    expect(cookies.some(value => value.name === `${cookiePrefix}_ga` || value.name === `${cookiePrefix}_ga_${expectedGoogleId.slice(2)}` || value.name === "_clck" || value.name === "_clsk")).toBe(false);
  });

  for (const { locale, path } of routes) {
    test(`keyboard controls, disabled explanation, axe and narrow reflow work in ${locale}`, async ({ openApplicationPage, page }) => {
      await page.setViewportSize({ width: 320, height: 800 });
      await visit(page, openApplicationPage, path);
      await expect(action(page, "choose")).toBeVisible();
      await expect(page.getByText(localeText(locale, "collectionDisabledNotice"))).toHaveCount(active ? 0 : 1);
      await focusWithTab(page, action(page, "choose"));
      await page.keyboard.press("Enter");
      await expect(page.locator("#analytics-consent-management-heading")).toBeFocused();
      const purpose = purposes[0];
      if (purpose === undefined) throw new Error("ANALYTICS_TEST_PURPOSE_MISSING");
      await focusWithTab(page, choice(page, purpose));
      await page.keyboard.press("Space");
      await expect(choice(page, purpose)).toBeChecked();
      expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await focusWithTab(page, action(page, "save"));
      await page.keyboard.press("Enter");
      await expect(action(page, "manage")).toBeFocused();
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
    });

    if (active) test(`failed storage retains an honest incomplete choice in ${locale}`, async ({ openApplicationPage, page, screenshot }, information) => {
      await visit(page, openApplicationPage, path);
      const otherProviders = declarations.filter(value => value.identifier !== "cloudflare-web-analytics");
      const cloudflareOnly = otherProviders.length === 0;
      const initial = cloudflareOnly ? declarations : otherProviders;
      const requested = cloudflareOnly ? [] : declarations.filter(value => value.identifier === "cloudflare-web-analytics");
      await select(page, initial.map(value => value.purpose));
      await assertProviders(page, initial.map(value => value.identifier));
      const requestsBefore = auditFor(page).requests.length;
      const originalDocument = await page.evaluateHandle(() => document);
      const storageFailure = await page.evaluateHandle(() => {
        const methods = Object.getPrototypeOf(localStorage) as Storage;
        const original = { getItem: methods.getItem, setItem: methods.setItem, removeItem: methods.removeItem };
        const blocked = () => { throw new DOMException("blocked", "SecurityError"); };
        methods.setItem = () => { throw new DOMException("blocked", "QuotaExceededError"); };
        methods.removeItem = blocked;
        return { blockReads: () => { methods.getItem = blocked; }, restore: () => { Object.assign(methods, original); } };
      });
      const original = page.url();
      const control = page.locator('[aria-labelledby="analytics-consent-heading"]');
      const status = control.getByRole("status");
      if (cloudflareOnly) {
        await focusWithTab(page, action(page, "withdraw"));
        await page.keyboard.press("Enter");
        await expect(page.locator("#analytics-consent-management-heading")).toBeFocused();
      } else {
        await action(page, "manage").click();
        for (const declaration of declarations) await choice(page, declaration.purpose).setChecked(requested.includes(declaration));
        await action(page, "save").click();
      }
      await expect(status).toHaveText(localeText(locale, "staleGrantRetainedStatus"));
      expect(page.url()).toBe(original);
      expect((await readRecord(page)).purposes).toEqual(decisions(initial.map(value => value.purpose)));
      await expect(action(page, "save")).toBeVisible();
      for (const declaration of declarations) await expect(page.locator(`#${declaration.scriptId}`)).toHaveCount(0);
      const stillGranted = initial.slice(0, 1).map(value => value.purpose);
      const trusted = await clearFromAnotherDocument(page, JSON.stringify(consentRecord(stillGranted)));
      expect(trusted).toEqual([true, true]);
      await expect(status).toHaveText(localeText(locale, "staleGrantRetainedStatus"));
      await action(page, "close").click();
      await action(page, "manage").click();
      for (const declaration of declarations) {
        await expect(choice(page, declaration.purpose)).toBeChecked({ checked: requested.includes(declaration) });
        await expect(page.locator(`#${declaration.scriptId}`)).toHaveCount(0);
      }
      const reallowed = initial[1];
      if (reallowed !== undefined) {
        // A failed retry reads only the first grant; the next event retains only the other one.
        await action(page, "save").click();
        expect(await clearFromAnotherDocument(page, JSON.stringify(consentRecord([reallowed.purpose])))).toEqual([true, true]);
        await expect(status).toHaveText(localeText(locale, "staleGrantRetainedStatus"));
        await expect(action(page, "save")).toBeFocused();
        for (const declaration of declarations) await choice(page, declaration.purpose).setChecked(declaration === reallowed);
        await storageFailure.evaluate(failure => failure.blockReads());
        await action(page, "save").click();
        await expect(status).toHaveText(localeText(locale, "staleGrantRetainedStatus"));
        await expect(choice(page, reallowed.purpose)).toBeChecked();
        const screenshotMode = typeof screenshot === "string" ? screenshot : screenshot.mode;
        if (screenshotMode !== "off") {
          await information.attach("incomplete-withdrawal", { contentType: "image/png", body: await control.screenshot() });
        }
      }
      expect(await originalDocument.evaluate(original => original === document)).toBe(true);
      await originalDocument.dispose();
      expect(auditFor(page).requests.slice(requestsBefore)).toEqual([]);
      await storageFailure.evaluate(failure => failure.restore());
      await storageFailure.dispose();
      const verifiedChoice = reallowed === undefined ? requested : [reallowed];
      await Promise.all([page.waitForEvent("domcontentloaded"), action(page, "save").click()]);
      await expect(action(page, "manage")).toBeVisible();
      expect((await readRecord(page)).purposes).toEqual(decisions(verifiedChoice.map(value => value.purpose)));
      await assertProviders(page, verifiedChoice.map(value => value.identifier), requestsBefore);
    });
  }

  if (!process.env.DEPLOY_URL && active && settings.providers.microsoftClarity !== undefined && expectedSiteOrigin !== "http://127.0.0.1:3101") {
    test("a different browser origin refuses the entire collection set", async ({ openApplicationPage, page }) => {
      await visit(page, openApplicationPage, `http://127.0.0.1:3101${primaryPath}`);
      await action(page, "allow").click();
      await expect(action(page, "manage")).toBeVisible();
      await assertProviders(page, []);
    });
  }
}

if (contactSelected || bookingSelected) {
  test("contact and booking remain usable after analytics choices", async ({ openApplicationPage, page }) => {
    await visit(page, openApplicationPage, primaryPath);
    if (declarations.length > 0) {
      await action(page, "decline").click();
      await action(page, "manage").click();
      await action(page, "allow").click();
      await expect(action(page, "withdraw")).toBeVisible();
      const reload = page.waitForEvent("framenavigated", { predicate: frame => frame === page.mainFrame() });
      await action(page, "withdraw").click();
      await reload;
      await expect(action(page, "manage")).toBeVisible();
    }
    const audit = auditFor(page);
    if (contactSelected) {
      if (expectedContactKey === "") await expect(page.locator("#contact-form form")).toHaveCount(0);
      else {
        await page.locator("#contact-name").fill("Synthetic visitor");
        await page.locator("#contact-email").fill("synthetic@example.invalid");
        await page.locator("#contact-message").fill("Controlled composed contact verification");
        await page.locator("#contact-captcha button").click();
        await page.getByRole("button", { name: "Synthetic challenge" }).click();
        await page.locator('#contact-form button[type="submit"]').click();
        await expect.poll(() => audit.submissions.length).toBe(1);
        expect(Object.keys(audit.submissions[0] ?? {}).sort()).toEqual(["access_key", "email", "h-captcha-response", "message", "name", "subject"]);
        expect(audit.submissions[0]?.access_key).toBe(expectedContactKey);
        await expect(page.locator("#contact-form [role=status]")).toBeFocused();
      }
    }
    if (bookingSelected) {
      if (expectedBookingUrl === "") await expect(page.getByTestId("booking-unavailable")).toBeVisible();
      else {
        await expect(page.getByTestId("booking-link")).toHaveAttribute("href", expectedBookingUrl);
        if (bookingMode === "inline") await page.getByTestId("booking-inline-region").scrollIntoViewIfNeeded();
        else await page.getByTestId("booking-link").click();
        await expect.poll(() => audit.bookings.length).toBeGreaterThan(0);
        if (bookingMode !== "link") await expect(page.getByTestId("booking-frame")).toHaveAttribute("src", expectedBookingUrl);
      }
    }
  });
}
