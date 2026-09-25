import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Request } from "@playwright/test";

const expectedUrl = process.env.BOOKING_TEST_EXPECTED_URL ?? "";
const bookingMode = process.env.BOOKING_TEST_MODE;
if (bookingMode !== "link" && bookingMode !== "inline" && bookingMode !== "popup") {
  throw new Error("BOOKING_TEST_MODE:invalid");
}
const locales = process.env.BOOKING_TEST_MULTILINGUAL === "true" ? ["en-CA", "fr-CA"] : ["en-CA"];
const configured = expectedUrl !== "";
const schedulingDocument = '<!doctype html><html lang="en"><head><title>Synthetic scheduling</title><link rel="icon" href="data:,"></head><body><main>Synthetic scheduling document</main></body></html>';
const audits = new WeakMap<BrowserContext, Awaited<ReturnType<typeof controlProviders>>>();

test.use({ serviceWorkers: "block" });

async function controlProviders(context: BrowserContext, baseURL: unknown, blockFrame = false) {
  if (typeof baseURL !== "string") throw new Error("BASE_URL_REQUIRED");
  const localOrigin = new URL(baseURL).origin;
  const requests: Request[] = [];
  const attempts: string[] = [];
  const unexpected: string[] = [];
  await context.route("**/*", async route => {
    const request = route.request();
    if (new URL(request.url()).origin === localOrigin) return route.continue();
    attempts.push(request.url());
    if (configured && request.url() === expectedUrl && request.isNavigationRequest()) {
      requests.push(request);
      if (blockFrame && request.frame().parentFrame() !== null) return route.abort("blockedbyclient");
      return route.fulfill({ status: 200, contentType: "text/html", body: schedulingDocument });
    }
    unexpected.push(request.url());
    return route.abort("blockedbyclient");
  });
  const audit = { requests, attempts, unexpected };
  audits.set(context, audit);
  return audit;
}

test.afterEach(async ({ context }, information) => {
  const audit = audits.get(context);
  if (audit === undefined) return;
  await information.attach("provider-request-audit", { contentType: "application/json", body: JSON.stringify({ attempts: audit.attempts, unexpected: audit.unexpected }) });
  expect(audit.unexpected).toEqual([]);
  if (!configured) expect(audit.attempts).toEqual([]);
});

for (const locale of locales) {
  const path = locales.length === 1 ? "./" : `/${locale}`;
  test.describe(locale, () => {
    test("unavailable booking stays local after interaction and at narrow width", async ({ page, context, baseURL }) => {
      test.skip(configured);
      await controlProviders(context, baseURL);
      await page.setViewportSize({ width: 320, height: 800 });
      await page.goto(path);
      const section = page.getByTestId("booking-unavailable");
      await section.scrollIntoViewIfNeeded();
      await expect(section).toContainText(locale === "fr-CA"
        ? "La prise de rendez-vous en ligne est actuellement indisponible. Veuillez utiliser les coordonnées ci-dessous."
        : "Online booking is currently unavailable. Please use the contact details below.");
      await expect(section.locator("a, button, iframe, dialog")).toHaveCount(0);
      await expect(page.getByTestId("booking-link")).toHaveCount(0);
      await expect(page.getByTestId("booking-frame")).toHaveCount(0);
      await expect(page.getByTestId("booking-dialog")).toHaveCount(0);
      await page.keyboard.press("Tab");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(250);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      expect((await new AxeBuilder({ page }).include('[data-testid="booking-unavailable"]').withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
    });

    test("loads only through the configured interaction and preserves destination", async ({ page, context, baseURL }) => {
      test.skip(!configured);
      await page.setViewportSize({ width: 320, height: 200 });
      const audit = await controlProviders(context, baseURL);
      await page.goto(path);
      const link = page.getByTestId("booking-link");
      await expect(link).toHaveAttribute("href", expectedUrl);
      await expect(page.getByTestId("booking-frame")).toHaveCount(0);
      expect(audit.requests).toHaveLength(0);
      if (bookingMode === "link") {
        await Promise.all([page.waitForURL(expectedUrl), link.click()]);
        expect(audit.requests).toHaveLength(1);
        expect(audit.requests[0]?.frame()).toBe(page.mainFrame());
        return;
      }
      if (bookingMode === "inline") {
        await page.getByTestId("booking-inline-region").scrollIntoViewIfNeeded();
      } else {
        await link.focus();
        await page.keyboard.press("Enter");
        const dialog = page.getByTestId("booking-dialog");
        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole("button")).toBeFocused();
        for (let index = 0; index < 3; index += 1) {
          await page.keyboard.press("Tab");
          // Browser UI may receive focus; the background document must remain inert.
          expect(await dialog.evaluate(element => !document.hasFocus() || element.contains(document.activeElement))).toBe(true);
        }
        await page.keyboard.press("Shift+Tab");
        await expect(dialog.getByRole("button")).toBeFocused();
      }
      await expect(page.getByTestId("booking-frame")).toHaveAttribute("src", expectedUrl);
      await expect.poll(() => audit.requests.length).toBeGreaterThan(0);
      if (bookingMode === "popup") {
        await page.keyboard.press("Escape");
        await expect(page.getByTestId("booking-dialog")).not.toBeVisible();
        await expect(page.getByTestId("booking-frame")).toHaveCount(0);
      }
    });

    test("ordinary navigation and unavailable copy survive without JavaScript", async ({ browser, baseURL }, information) => {
      if (typeof baseURL !== "string") throw new Error("BASE_URL_REQUIRED");
      const context = await browser.newContext({ baseURL, javaScriptEnabled: false, serviceWorkers: "block" });
      try {
        const audit = await controlProviders(context, baseURL);
        const page = await context.newPage();
        await page.goto(path, { waitUntil: "domcontentloaded" });
        await expect(page.getByTestId("booking-frame")).toHaveCount(0);
        if (configured) {
          const link = page.getByTestId("booking-link");
          await expect(link).toHaveAttribute("href", expectedUrl);
          await Promise.all([page.waitForURL(expectedUrl), link.click()]);
          expect(audit.requests).toHaveLength(1);
          expect(audit.requests[0]?.frame()).toBe(page.mainFrame());
        } else {
          await expect(page.getByTestId("booking-unavailable")).toBeVisible();
          await expect(page.getByTestId("booking-link")).toHaveCount(0);
          expect(audit.attempts).toEqual([]);
        }
        expect(audit.unexpected).toEqual([]);
        await information.attach("no-javascript-request-audit", { contentType: "application/json", body: JSON.stringify({ attempts: audit.attempts, unexpected: audit.unexpected }) });
      } finally { await context.close(); }
    });

    test("inline fallback works without IntersectionObserver", async ({ page, context, baseURL }) => {
      test.skip(!configured || bookingMode !== "inline");
      await controlProviders(context, baseURL);
      await page.addInitScript(() => Object.defineProperty(window, "IntersectionObserver", { configurable: true, value: undefined }));
      await page.goto(path);
      await expect(page.getByTestId("booking-frame")).toHaveAttribute("src", expectedUrl);
      await page.getByTestId("booking-frame").scrollIntoViewIfNeeded();
      await expect.poll(() => audits.get(context)?.requests.length).toBeGreaterThan(0);
    });

    test("popup falls back to navigation without native modal support", async ({ page, context, baseURL }) => {
      test.skip(!configured || bookingMode !== "popup");
      const audit = await controlProviders(context, baseURL);
      await page.addInitScript(() => Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: undefined }));
      await page.goto(path);
      await Promise.all([page.waitForURL(expectedUrl), page.getByTestId("booking-link").click()]);
      expect(audit.requests).toHaveLength(1);
      expect(audit.requests[0]?.frame()).toBe(page.mainFrame());
    });

    test("blocked embeds preserve ordinary anchor navigation", async ({ page, context, baseURL }) => {
      test.skip(!configured || bookingMode === "link");
      const audit = await controlProviders(context, baseURL, true);
      await page.goto(path);
      if (bookingMode === "inline") await page.getByTestId("booking-inline-region").scrollIntoViewIfNeeded();
      else await page.getByTestId("booking-link").click();
      await expect.poll(() => audit.requests.length).toBeGreaterThan(0);
      if (bookingMode === "popup") {
        await page.keyboard.press("Escape");
        await page.evaluate(() => Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: undefined }));
      }
      await Promise.all([page.waitForURL(expectedUrl), page.getByTestId("booking-link").click()]);
      expect(audit.requests.at(-1)?.frame()).toBe(page.mainFrame());
    });

    test("configured booking fits 320px and passes selected axe checks", async ({ page, context, baseURL }) => {
      test.skip(!configured);
      await controlProviders(context, baseURL);
      await page.setViewportSize({ width: 320, height: 800 });
      await page.goto(path);
      await page.getByTestId("booking-link").scrollIntoViewIfNeeded();
      if (bookingMode === "popup") await page.getByTestId("booking-link").click();
      const selector = bookingMode === "popup" ? '[data-testid="booking-dialog"]' : 'section[aria-labelledby="booking-heading"]';
      const section = page.locator(selector);
      await expect(section).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      expect(await section.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      const bounds = await section.boundingBox();
      expect(bounds?.x).toBeGreaterThanOrEqual(0);
      expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(320);
      expect((await new AxeBuilder({ page }).include(selector).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
    });
  });
}
