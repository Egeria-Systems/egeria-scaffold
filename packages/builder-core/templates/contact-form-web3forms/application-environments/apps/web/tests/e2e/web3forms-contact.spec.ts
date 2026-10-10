import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const expectedAccessKey = process.env.CONTACT_TEST_EXPECTED_ACCESS_KEY ?? "";
const configured = expectedAccessKey !== "";
if (configured && !/^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/u.test(expectedAccessKey)) {
  throw new Error("CONTACT_TEST_EXPECTED_ACCESS_KEY:invalid");
}

const expectedBookingUrl = process.env.BOOKING_TEST_EXPECTED_URL ?? "";
const audits = new WeakMap<BrowserContext, Awaited<ReturnType<typeof controlProviders>>>();
test.use({ serviceWorkers: "block" });
test.afterEach(async ({ context }, information) => {
  const audit = audits.get(context);
  if (audit === undefined) return;
  await information.attach("provider-request-audit", { contentType: "application/json", body: JSON.stringify({ attempts: audit.attempts, unexpected: audit.unexpected }) });
  expect(audit.unexpected).toEqual([]);
  if (!configured) expect(audit.contactAttempts).toEqual([]);
  if (expectedBookingUrl === "") expect(audit.bookingAttempts).toEqual([]);
  if (!configured && expectedBookingUrl === "") expect(audit.attempts).toEqual([]);
});

async function controlProviders(page: Page, outcome = "accepted") {
  const requests: Record<string, unknown>[] = [];
  const scripts: string[] = [];
  const unexpected: string[] = [];
  const attempts: string[] = [];
  const contactAttempts: string[] = [];
  const bookingAttempts: string[] = [];
  const baseURL = test.info().project.use.baseURL;
  if (typeof baseURL !== "string") throw new Error("BASE_URL_REQUIRED");
  const localOrigin = new URL(baseURL).origin;
  await page.context().route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === localOrigin) return route.continue();
    attempts.push(url.href);
    if (url.hostname === "calendly.com" || url.hostname === "www.calendly.com") bookingAttempts.push(url.href);
    if (expectedBookingUrl !== "" && url.href === expectedBookingUrl && request.isNavigationRequest()) {
      return route.fulfill({ contentType: "text/html", body: '<!doctype html><html lang="en"><head><title>Synthetic booking</title><link rel="icon" href="data:,"></head><body><main>Synthetic booking</main></body></html>' });
    }
    if (url.origin === "https://js.hcaptcha.com" && url.pathname === "/1/api.js") {
      contactAttempts.push(url.href);
      scripts.push(url.href);
      if (outcome === "blocked") return route.abort();
      // Delivering a script does not mean the SDK is ready. No real provider executes.
      return route.fulfill({ contentType: "application/javascript", body: `
        window.contactTestReady = () => {
          window.hcaptcha = {
            render: (container, options) => {
              const button = document.createElement('button'); button.type = 'button';
              button.textContent = 'Synthetic challenge';
              button.onclick = () => options.callback('synthetic-token');
              container.appendChild(button); window.contactTestExpire = options['expired-callback'];
              return 'synthetic-widget';
            }, reset: () => {}, remove: () => {}
          };
          window.egeriaContactCaptchaReady();
        };
      ` });
    }
    if (url.href === "https://api.web3forms.com/submit") {
      contactAttempts.push(url.href);
      requests.push(request.postDataJSON() as Record<string, unknown>);
      if (outcome === "unknown") return route.abort();
      return route.fulfill({ status: outcome === "rate-limited" ? 429 : outcome === "rejected" ? 400 : 200,
        contentType: "application/json", body: JSON.stringify({ success: outcome === "accepted", message: "PRIVATE_PROVIDER_MESSAGE" }) });
    }
    unexpected.push(url.origin);
    return route.abort();
  });
  const audit = { requests, scripts, unexpected, attempts, contactAttempts, bookingAttempts };
  audits.set(page.context(), audit);
  return audit;
}

async function openForm(page: Page) {
  await page.goto("./");
  const form = page.locator("#contact-form form");
  await expect(form).toBeVisible();
  return form;
}
async function fill(page: Page) {
  await page.locator("#contact-name").fill("Synthetic visitor");
  await page.locator("#contact-email").fill("synthetic@example.invalid");
  await page.locator("#contact-message").fill("Controlled contact verification");
}
async function solve(page: Page) {
  await page.locator("#contact-captcha button").click();
  await expect.poll(() => page.evaluate(() => typeof Reflect.get(window, "contactTestReady"))).toBe("function");
  await expect(page.getByRole("button", { name: "Synthetic challenge" })).toHaveCount(0);
  await page.evaluate(() => Reflect.get(window, "contactTestReady")());
  await page.getByRole("button", { name: "Synthetic challenge" }).click();
}

test.describe("configured contact", () => {
  test.skip(!configured);

test("explicit challenge, single submission, acknowledgement and accessible recovery", async ({ page }) => {
  const provider = await controlProviders(page);
  const form = await openForm(page);
  expect(provider.scripts).toEqual([]);
  await form.locator('button[type="submit"]').click();
  await expect(page.locator("#contact-name")).toBeFocused();
  await expect(page.locator("#contact-name")).toHaveAttribute("aria-invalid", "true");
  await fill(page);
  for (const field of ["name", "email", "message"]) {
    await expect(page.locator(`#contact-${field}`)).toHaveAttribute("aria-invalid", "false");
  }
  await expect(page.locator("#contact-captcha-error")).toBeVisible();
  await solve(page);
  await expect(page.locator("#contact-captcha-error")).toHaveCount(0);
  await form.evaluate(element => {
    element.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await expect.poll(() => provider.requests.length).toBe(1);
  expect(provider.requests[0]?.access_key).toBe(expectedAccessKey);
  expect(Object.keys(provider.requests[0] ?? {}).sort()).toEqual(["access_key", "email", "h-captcha-response", "message", "name", "subject"]);
  await expect(page.locator("#contact-form").getByRole("status")).toBeFocused();
  await expect(page.locator("#contact-name")).toHaveValue("");
  await expect(form).not.toContainText("PRIVATE_PROVIDER_MESSAGE");
  await expect(page.locator('#contact-form a[href="#contact"]')).toBeVisible();
  await expect(page.locator("#contact")).toBeVisible();
  expect((await new AxeBuilder({ page }).include("#contact-form").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
  expect(provider.unexpected).toEqual([]);
});

for (const outcome of ["rejected", "rate-limited", "unknown"]) {
  test(`${outcome} preserves fields and requires a fresh challenge`, async ({ page }) => {
    const provider = await controlProviders(page, outcome);
    const form = await openForm(page); await fill(page); await solve(page);
    await form.locator('button[type="submit"]').click();
    await expect(page.locator("#contact-form").getByRole("status")).toBeFocused();
    await expect(page.locator("#contact-message")).toHaveValue("Controlled contact verification");
    await form.locator('button[type="submit"]').click();
    await expect(page.locator("#contact-captcha")).toBeFocused();
    expect(provider.requests).toHaveLength(1);
    expect(provider.unexpected).toEqual([]);
  });
}

test("blocked challenge fails closed with fallback and 320px reflow", async ({ page }) => {
  const provider = await controlProviders(page, "blocked");
  await page.setViewportSize({ width: 320, height: 800 });
  const form = await openForm(page); await fill(page);
  await page.locator("#contact-captcha button").click();
  await form.locator('button[type="submit"]').click();
  await expect(page.locator("#contact-captcha")).toBeFocused();
  await page.locator('#contact-form a[href="#contact"]').click();
  await expect(page).toHaveURL(/#contact$/u);
  expect(provider.requests).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});


test("home navigation and locale changes dispose the form without loading providers", async ({ page }) => {
  const provider = await controlProviders(page);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.name));
  await openForm(page);
  const home = page.url();
  const about = page.locator('a[href$="/about"]').first();
  if (await about.count() > 0) {
    await about.click();
    await expect(page.locator("#contact-form")).toHaveCount(0);
    await page.goBack();
    await expect(page.locator("#contact-form form")).toBeVisible();
  }
  if (new URL(home).pathname.startsWith("/en-CA")) {
    await page.goto("/fr-CA");
    await expect(page.locator("#contact-form h2")).toHaveText("Envoyer un message");
    await fill(page); await solve(page);
    await page.locator('#contact-form button[type="submit"]').click();
    await expect(page.locator("#contact-form").getByRole("status")).toBeFocused();
    expect(provider.requests).toHaveLength(1);
    expect(provider.requests[0]?.access_key).toBe(expectedAccessKey);
    expect((await new AxeBuilder({ page }).include("#contact-form").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
  }
  expect(errors).toEqual([]);
  expect(provider.unexpected).toEqual([]);
});

});

test.describe("unavailable contact", () => {
  test.skip(configured);

  test("home and both selected languages retain accessible fallback without provider attempts", async ({ page }) => {
    const provider = await controlProviders(page);
    await page.goto("./");
    const localized = new URL(page.url()).pathname.startsWith("/en-CA");
    for (const language of localized ? ["en-CA", "fr-CA"] : ["en-CA"]) {
      if (localized) await page.goto(`/${language}`);
      const section = page.locator("#contact-form");
      await expect(section).toBeVisible();
      await expect(section.locator("form, input, textarea, button, iframe")).toHaveCount(0);
      await expect(section.getByRole("heading")).toHaveText(language === "fr-CA" ? "Envoyer un message" : "Send a message");
      await expect(section).toContainText(language === "fr-CA"
        ? "Le formulaire de contact est actuellement indisponible. Veuillez utiliser les coordonnées ci-dessous."
        : "The contact form is currently unavailable. Please use the contact details below.");
      await section.locator('a[href="#contact"]').click();
      await expect(page).toHaveURL(/#contact$/u);
      await expect(page.locator("#contact")).toBeVisible();
      expect((await new AxeBuilder({ page }).include("#contact-form").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
    }
    expect(provider.contactAttempts).toEqual([]);
    expect(provider.scripts).toEqual([]);
    expect(provider.requests).toEqual([]);
  });

  test("navigation and narrow reflow never activate unavailable contact", async ({ page }) => {
    const provider = await controlProviders(page);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.name));
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("./");
    await expect(page.locator("#contact-form")).toBeVisible();
    const about = page.locator('a[href$="/about"]').first();
    if (await about.count() > 0) {
      await about.click();
      await expect(page.locator("#contact-form")).toHaveCount(0);
      await page.goBack();
      await expect(page.locator("#contact-form")).toBeVisible();
    }
    await expect(page.locator("#contact-form form, #contact-captcha")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    expect(provider.contactAttempts).toEqual([]);
    expect(errors).toEqual([]);
  });
});

test("non-home routes never mount contact", async ({ page }) => {
  const provider = await controlProviders(page);
  await page.goto("./missing-contact-route");
  await expect(page.locator("#contact-form")).toHaveCount(0);
  expect(provider.attempts).toEqual([]);
  expect(provider.scripts).toEqual([]);
  expect(provider.requests).toEqual([]);
});
