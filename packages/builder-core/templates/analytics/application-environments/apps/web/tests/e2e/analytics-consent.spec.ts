import { readFileSync } from "node:fs";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
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
const cookiePrefix = target === "production" ? "egeria_production" : "egeria_nonproduction";
const project: unknown = parse(readFileSync(new URL("../../../../.egeria/project.yaml", import.meta.url), "utf8"));
const selected: unknown = typeof project === "object" && project !== null ? Reflect.get(project, "selectedCapabilities") : undefined;
if (!Array.isArray(selected) || !selected.every(value => typeof value === "string")) throw new Error("ANALYTICS_TEST_SELECTION_INVALID");
const contactSelected = selected.includes("contact-form-web3forms");
const bookingSelected = selected.includes("booking-calendly");
const expectedContactKey = contactSelected ? requiredExpectation("CONTACT_TEST_EXPECTED_ACCESS_KEY") : "";
const expectedBookingUrl = bookingSelected ? requiredExpectation("BOOKING_TEST_EXPECTED_URL") : "";
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
    if ((url.origin === "ws://127.0.0.1:3101" || url.origin === "ws://127.0.0.1:3100") && url.pathname === "/_next/hmr") {
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
      if (appOrigin === transportOrigin || appOrigin === "http://127.0.0.1:3100") return route.continue();
      // Only the exact synthetic app origin is fulfilled from the owned, fixed loopback server.
      const response = await route.fetch({ url: `${transportOrigin}${url.pathname}${url.search}`, maxRedirects: 0 });
      return route.fulfill({ response });
    }
    if (url.origin === transportOrigin) return route.continue(); // deliberate wrong-origin challenge
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
    if (bookingSelected && expectedBookingUrl !== "" && url.href === expectedBookingUrl && request.isNavigationRequest()) {
      audit.bookings.push(url.href);
      return route.fulfill({ contentType: "text/html", body: '<!doctype html><html lang="en"><head><title>Synthetic scheduling</title><link rel="icon" href="data:,"></head><body><main>Synthetic scheduling</main></body></html>' });
    }
    audit.unexpected.push(url.href);
    return route.abort();
  });
});

test.afterEach(async ({ context }, information) => {
  const audit = audits.get(context);
  if (audit === undefined) throw new Error("ANALYTICS_TEST_AUDIT_MISSING");
  await information.attach("controlled-request-audit", { contentType: "application/json", body: JSON.stringify({
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
async function visit(page: Page, path: string) {
  await page.goto(path);
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
async function assertProviders(page: Page, requested: readonly AnalyticsProviderIdentifier[]) {
  const selected = active ? requested : [];
  for (const declaration of declarations) await expect(page.locator(`#${declaration.scriptId}`)).toHaveCount(selected.includes(declaration.identifier) ? 1 : 0);
  for (const provider of selected) {
    const collectionUrl = provider === "cloudflare-web-analytics" ? `https://cloudflareinsights.com/cdn-cgi/rum?token=${expectedCloudflareToken}` :
      provider === "google-analytics-4" ? `https://www.google-analytics.com/g/collect?tid=${expectedGoogleId}` :
        `https://www.clarity.ms/collect?project=${expectedClarityId}`;
    await expect.poll(() => auditFor(page).requests.some(value => value.page === page && value.url === collectionUrl)).toBe(true);
  }
  const requests = auditFor(page).requests.filter(value => value.page === page);
  expect([...new Set(requests.filter(value => value.script).map(value => value.provider))].sort()).toEqual([...selected].sort());
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
test("metadata belongs only to the expected production property and first visit stays inactive", async ({ page }) => {
  await visit(page, primaryPath);
  const verification = page.locator('meta[name="google-site-verification"]');
  if (expectedVerification === "") await expect(verification).toHaveCount(0);
  else await expect(verification).toHaveAttribute("content", expectedVerification);
  await expect(page.locator('[data-analytics-consent-action="choose"]')).toHaveCount(declarations.length === 0 ? 0 : 1);
  await assertProviders(page, []);
});

if (declarations.length > 0) {
  test("denial persists in the current exact context", async ({ page }) => {
    await visit(page, primaryPath);
    await action(page, "decline").click();
    await page.reload();
    await expect(action(page, "manage")).toBeVisible();
    const record = await readRecord(page);
    expect(record.schemaVersion).toBe(3);
    expect(record.collectionContext).toEqual(expectedCollectionContext);
    expect(record.purposes).toEqual(decisions([]));
    await assertProviders(page, []);
  });

  test("an accepted saved grant obeys the compiled activation and destinations", async ({ page }) => {
    await preload(page, consentRecord());
    await visit(page, primaryPath);
    await expect(action(page, "manage")).toBeVisible();
    expect((await readRecord(page)).collectionContext).toEqual(expectedCollectionContext);
    await assertProviders(page, declarations.map(value => value.identifier));
  });

  for (const declaration of declarations) {
    test(`an isolated ${declaration.purpose} choice activates only its own provider`, async ({ page }) => {
      await visit(page, primaryPath);
      await select(page, [declaration.purpose]);
      await expect(action(page, "manage")).toBeVisible();
      await assertProviders(page, [declaration.identifier]);
    });
  }

  test("repeated all-purpose grants do not duplicate scripts or reset provider defaults", async ({ page }) => {
    await visit(page, primaryPath);
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
    test(`a ${changed} record grants nothing and prompts again`, async ({ page }) => {
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
      await visit(page, primaryPath);
      await expect(action(page, "choose")).toBeVisible();
      await assertProviders(page, []);
    });
  }

  test("withdrawal removes only this installation's cookies and reloads both pages without providers", async ({ context }) => {
    const first = await context.newPage();
    const second = await context.newPage();
    await Promise.all([visit(first, primaryPath), visit(second, primaryPath)]);
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
    auditFor(first).requests.length = 0;
    await action(first, "withdraw").click();
    await Promise.all(reloads);
    for (const page of [first, second]) {
      await expect(action(page, "manage")).toBeVisible();
      await assertProviders(page, []);
      expect((await readRecord(page)).purposes).toEqual(decisions([]));
    }
    const cookies = await context.cookies(first.url());
    expect(cookies.map(value => value.name)).toEqual(expect.arrayContaining(["_ga", "egeria_unrelated_ga"]));
    expect(cookies.some(value => value.name === `${cookiePrefix}_ga` || value.name === `${cookiePrefix}_ga_${expectedGoogleId.slice(2)}` || value.name === "_clck" || value.name === "_clsk")).toBe(false);
  });

  for (const { locale, path } of routes) {
    test(`keyboard controls, disabled explanation, axe and narrow reflow work in ${locale}`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 800 });
      await visit(page, path);
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

    if (active) test(`failed storage retains an honest incomplete choice in ${locale}`, async ({ page }) => {
      await visit(page, path);
      const initial = declarations.filter(value => value.identifier !== "cloudflare-web-analytics");
      await select(page, initial.map(value => value.purpose));
      await assertProviders(page, initial.map(value => value.identifier));
      await page.evaluate(() => {
        Object.defineProperties(Object.getPrototypeOf(localStorage), {
          setItem: { configurable: true, value: () => { throw new DOMException("blocked", "QuotaExceededError"); } },
          removeItem: { configurable: true, value: () => { throw new DOMException("blocked", "SecurityError"); } },
        });
      });
      const original = page.url();
      await action(page, "manage").click();
      for (const declaration of declarations) await choice(page, declaration.purpose).setChecked(declaration.identifier === "cloudflare-web-analytics");
      await action(page, "save").click();
      await expect(page.locator('[aria-labelledby="analytics-consent-heading"] [role="status"]')).toHaveText(localeText(locale, "staleGrantRetainedStatus"));
      expect(page.url()).toBe(original);
      expect((await readRecord(page)).purposes).toEqual(decisions(initial.map(value => value.purpose)));
      await expect(action(page, "save")).toBeVisible();
      for (const declaration of declarations) await expect(page.locator(`#${declaration.scriptId}`)).toHaveCount(0);
      expect(auditFor(page).requests.some(value => value.provider === "cloudflare-web-analytics")).toBe(false);
    });
  }

  if (active && settings.providers.microsoftClarity !== undefined && expectedSiteOrigin !== "http://127.0.0.1:3101") {
    test("a different browser origin refuses the entire collection set", async ({ page }) => {
      await visit(page, `http://127.0.0.1:3101${primaryPath}`);
      await action(page, "allow").click();
      await expect(action(page, "manage")).toBeVisible();
      await assertProviders(page, []);
    });
  }
}

if (contactSelected || bookingSelected) test("contact and booking remain usable after analytics choices", async ({ page }) => {
  await visit(page, primaryPath);
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
