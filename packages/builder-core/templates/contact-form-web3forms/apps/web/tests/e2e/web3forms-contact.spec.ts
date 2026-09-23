import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function controlProviders(page: Page, outcome = "accepted") {
  const requests: Record<string, unknown>[] = [];
  const scripts: string[] = [];
  const unexpected: string[] = [];
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return route.continue();
    if (url.origin === "https://js.hcaptcha.com" && url.pathname === "/1/api.js") {
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
      requests.push(request.postDataJSON() as Record<string, unknown>);
      if (outcome === "unknown") return route.abort();
      return route.fulfill({ status: outcome === "rate-limited" ? 429 : outcome === "rejected" ? 400 : 200,
        contentType: "application/json", body: JSON.stringify({ success: outcome === "accepted", message: "PRIVATE_PROVIDER_MESSAGE" }) });
    }
    unexpected.push(url.origin);
    return route.abort();
  });
  return { requests, scripts, unexpected };
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

test("non-home routes never mount contact", async ({ page }) => {
  const provider = await controlProviders(page);
  await page.goto("./missing-contact-route");
  await expect(page.locator("#contact-form")).toHaveCount(0);
  expect(provider.scripts).toEqual([]);
  expect(provider.requests).toEqual([]);
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
  }
  expect(errors).toEqual([]);
  expect(provider.unexpected).toEqual([]);
});
