import { writeFileSync } from "node:fs";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { createAnalyticsProviderDeclarations } from "../../src/integrations/analytics/analytics-provider-contract";
import { analyticsSettings } from "../../src/integrations/analytics/analytics-settings";

const providerDeclarations = createAnalyticsProviderDeclarations(
  analyticsSettings,
);
const deployedUrl = process.env.PLAYWRIGHT_DEPLOYED_URL;
if (deployedUrl === undefined) {
  throw new Error("DEPLOYED_URL_REQUIRED");
}
const deployedOrigin = new URL(deployedUrl).origin;
const cloudflareDeclaration = providerDeclarations.find(
  ({ identifier }) => identifier === "cloudflare-web-analytics",
);

function action(page: Page, identifier: string): Locator {
  return page.locator(`[data-analytics-consent-action="${identifier}"]`);
}

function purposeChoice(page: Page, identifier: string): Locator {
  return page.locator(`[data-analytics-consent-purpose="${identifier}"]`);
}

function sourceMatches(requestUrl: string, declaredSource: string): boolean {
  const request = new URL(requestUrl);
  const wildcardHostname = declaredSource.includes("://*.");
  const source = new URL(declaredSource.replace("://*.", "://"));
  const hostnameMatches = wildcardHostname
    ? request.hostname === source.hostname ||
      request.hostname.endsWith(`.${source.hostname}`)
    : request.hostname === source.hostname;

  return request.protocol === source.protocol && hostnameMatches;
}

function declarationForRequest(requestUrl: string) {
  return providerDeclarations.find((declaration) =>
    [
      declaration.scriptSource,
      ...declaration.imageSources,
      ...declaration.connectSources,
    ].some((source) => sourceMatches(requestUrl, source)),
  );
}

async function focusWithTab(page: Page, target: Locator): Promise<void> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) {
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error("KEYBOARD_TARGET_NOT_REACHED");
}

test("the hosted synthetic client journey is bilingual, opt-in, and bounded", async ({
  page,
  request,
}) => {
  expect(providerDeclarations.map(({ identifier }) => identifier)).toEqual([
    "cloudflare-web-analytics",
  ]);
  expect(cloudflareDeclaration).toBeDefined();
  if (cloudflareDeclaration === undefined) {
    throw new Error("CLOUDFLARE_PROVIDER_REQUIRED");
  }

  await page.addInitScript(() => {
    if (
      window.sessionStorage.getItem("synthetic-client-initialized") === null
    ) {
      window.localStorage.removeItem("egeria.analytics.consent.v2");
      window.sessionStorage.setItem("synthetic-client-initialized", "true");
    }
  });
  const externalRequests: string[] = [];
  const providerRequests: string[] = [];
  page.on("request", (observedRequest) => {
    const url = observedRequest.url();
    if (declarationForRequest(url) !== undefined) {
      providerRequests.push(url);
    }
    if (new URL(url).origin !== deployedOrigin) {
      externalRequests.push(url);
    }
  });

  for (const [path, locale, heading] of [
    ["/en-CA", "en-CA", "Harbour Light Studio"],
    ["/fr-CA", "fr-CA", "Harbour Light Studio"],
  ] as const) {
    await page.goto(path, { waitUntil: "networkidle" });
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      heading,
    );
    await expect(page).toHaveTitle(/Harbour Light Studio/u);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /\S/u,
    );
    expect(providerRequests).toEqual([]);
  }

  await page.goto("/en-CA", { waitUntil: "networkidle" });
  await focusWithTab(page, action(page, "choose"));
  await page.keyboard.press("Enter");
  await expect(
    page.locator("#analytics-consent-management-heading"),
  ).toBeFocused();
  await focusWithTab(
    page,
    purposeChoice(page, "aggregate-traffic-and-performance"),
  );
  await page.keyboard.press("Space");
  await focusWithTab(page, action(page, "save"));
  await page.keyboard.press("Enter");
  await expect(action(page, "manage")).toBeFocused();

  await expect
    .poll(() =>
      providerRequests.some((url) =>
        url.startsWith(cloudflareDeclaration.scriptSource),
      ),
    )
    .toBe(true);
  await page.waitForLoadState("networkidle");
  expect(
    providerRequests.every(
      (url) => declarationForRequest(url)?.identifier === "cloudflare-web-analytics",
    ),
  ).toBe(true);
  expect(externalRequests.some((url) => /google|clarity|bing/iu.test(url))).toBe(
    false,
  );
  expect(
    externalRequests.every((url) =>
      ["static.cloudflareinsights.com", "cloudflareinsights.com"].includes(
        new URL(url).hostname,
      ),
    ),
  ).toBe(true);

  const requestsBeforePersistedGrantReload = providerRequests.length;
  await page.reload({ waitUntil: "networkidle" });
  await expect(action(page, "manage")).toBeVisible();
  await expect
    .poll(() => providerRequests.length)
    .toBeGreaterThan(requestsBeforePersistedGrantReload);
  expect(
    providerRequests
      .slice(requestsBeforePersistedGrantReload)
      .every(
        (url) =>
          declarationForRequest(url)?.identifier ===
          "cloudflare-web-analytics",
      ),
  ).toBe(true);

  await action(page, "manage").click();
  const reloaded = page.waitForEvent("framenavigated", {
    predicate: (frame) => frame === page.mainFrame(),
  });
  await action(page, "withdraw").click();
  await reloaded;
  await page.waitForLoadState("networkidle");
  const requestsAfterWithdrawal = providerRequests.length;
  await page.goto("/fr-CA/about", { waitUntil: "networkidle" });
  expect(providerRequests).toHaveLength(requestsAfterWithdrawal);

  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/fr-CA/work/featured", { waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveAttribute("lang", "fr-CA");
  await expect(page.locator('nav a[aria-current="page"]')).toHaveAttribute(
    "href",
    "/fr-CA/work/featured",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const axeViolations = (
    await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze()
  ).violations;
  expect(axeViolations).toEqual([]);

  const redirect = await request.get("/fr-CA/work", { maxRedirects: 0 });
  expect(redirect.status()).toBe(307);
  expect(redirect.headers().location).toBe("/fr-CA/work/featured");
  const missing = await page.goto("/en-CA/missing-page");
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const cloudflareScriptRequestObserved = providerRequests.length > 0;
  const noProviderRequestAfterWithdrawal =
    providerRequests.length === requestsAfterWithdrawal;
  expect(cloudflareScriptRequestObserved).toBe(true);
  expect(noProviderRequestAfterWithdrawal).toBe(true);

  const receiptPath = process.env.SYNTHETIC_CLIENT_BROWSER_RECEIPT_PATH;
  if (receiptPath !== undefined) {
    writeFileSync(
      receiptPath,
      `${JSON.stringify({
        schemaVersion: "1.0.0",
        synthetic: true,
        locales: ["en-CA", "fr-CA"],
        cloudflareScriptRequestObserved,
        noProviderRequestAfterWithdrawal,
        automatedAxeViolations: axeViolations.length,
      })}\n`,
      { encoding: "utf8", flag: "wx", mode: 0o600 },
    );
  }
});
