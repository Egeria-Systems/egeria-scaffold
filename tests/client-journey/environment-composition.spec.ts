import { expect, test } from "./application-test";

// Copied only into the owned local composed-site proof. Every external request
// is fulfilled or refused here; this test cannot run against a hosted origin.
if (process.env.DEPLOY_URL || process.env.CF_ACCESS_CLIENT_ID || process.env.CF_ACCESS_CLIENT_SECRET) {
  throw new Error("COMPOSITION_LOCAL_ONLY");
}
const contactKey = process.env.CONTACT_TEST_EXPECTED_ACCESS_KEY;
const bookingURL = process.env.BOOKING_TEST_EXPECTED_URL;
if (contactKey === undefined || bookingURL === undefined) throw new Error("COMPOSITION_EXPECTATIONS_REQUIRED");
const configured = contactKey !== "" && bookingURL !== "";
if ((contactKey !== "") !== (bookingURL !== "")) throw new Error("COMPOSITION_SELECTION_INVALID");
const bookingRequestURL = configured ? new URL(bookingURL).href : "";
const action = (name: string) => `[data-analytics-consent-action="${name}"]`;

for (const locale of ["en-CA", "fr-CA"]) {
  for (const choice of configured ? ["decline", "withdraw"] : ["unavailable"]) {
    test(`${locale} contact and popup booking survive ${choice} analytics`, async ({ page, context, baseURL }) => {
      if (typeof baseURL !== "string") throw new Error("COMPOSITION_ORIGIN_REQUIRED");
      const origin = new URL(baseURL).origin;
      const unexpected: string[] = [];
      const analytics: string[] = [];
      const submissions: Record<string, unknown>[] = [];
      const bookings: string[] = [];
      await context.route("**/*", async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.origin === origin) {
          if (origin === "http://127.0.0.1:3100" || origin === "http://127.0.0.1:3101") return route.fallback();
          const response = await route.fetch({ url: `http://127.0.0.1:3101${url.pathname}${url.search}`, maxRedirects: 0, maxRetries: 0 });
          try {
            if ([301, 302, 303, 307, 308].includes(response.status())) {
              unexpected.push(url.href);
              return await route.abort();
            }
            return await route.fulfill({ response });
          } finally { await response.dispose(); }
        }
        if (["https://static.cloudflareinsights.com/beacon.min.js", "https://www.googletagmanager.com/gtag/js", "https://www.clarity.ms/tag/"].some(prefix => url.href.startsWith(prefix))) {
          analytics.push(url.href);
          return route.fulfill({ contentType: "application/javascript", body: "/* controlled provider script */" });
        }
        if (configured && url.href === "https://js.hcaptcha.com/1/api.js?onload=egeriaContactCaptchaReady&render=explicit&recaptchacompat=off") {
          return route.fulfill({ contentType: "application/javascript", body: `
            window.hcaptcha = { render: (container, options) => {
              const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Synthetic challenge';
              button.onclick = () => options.callback('synthetic-token'); container.appendChild(button); return 'synthetic-widget';
            }, reset: () => {}, remove: () => {} };
            window.egeriaContactCaptchaReady();` });
        }
        if (configured && url.href === "https://api.web3forms.com/submit") {
          if (request.method() === "POST") submissions.push(request.postDataJSON() as Record<string, unknown>);
          return route.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type" }, body: '{"success":true}' });
        }
        if (configured && url.href === bookingRequestURL && request.isNavigationRequest()) {
          bookings.push(url.href);
          return route.fulfill({ contentType: "text/html", body: '<!doctype html><html lang="en"><head><title>Synthetic booking</title><link rel="icon" href="data:,"></head><body><main>Synthetic booking</main></body></html>' });
        }
        unexpected.push(url.href);
        return route.abort();
      });
      // Only the interceptor above resolves synthetic origins to owned loopback.
      await page.goto(`/${locale}`, { waitUntil: "networkidle" });
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      expect(analytics).toEqual([]);
      if (!configured) {
        await expect(page.locator("#contact-form form")).toHaveCount(0);
        await expect(page.locator("#contact-form")).toContainText(locale === "fr-CA"
          ? "Le formulaire de contact est actuellement indisponible."
          : "The contact form is currently unavailable.");
        await expect(page.getByTestId("booking-unavailable")).toContainText(locale === "fr-CA"
          ? "La prise de rendez-vous en ligne est actuellement indisponible."
          : "Online booking is currently unavailable.");
        await expect(page.getByTestId("booking-link")).toHaveCount(0);
      } else {
        await page.locator(action("decline")).click();
        if (choice === "withdraw") {
          await page.locator(action("manage")).click();
          await page.locator(action("allow")).click();
          await expect(page.locator(action("withdraw"))).toBeVisible();
          const reload = page.waitForEvent("framenavigated", { predicate: frame => frame === page.mainFrame() });
          await page.locator(action("withdraw")).click();
          await reload;
          await page.waitForLoadState("networkidle");
        }
        const afterChoice = analytics.length;
        await page.locator("#contact-name").fill("Synthetic visitor");
        await page.locator("#contact-email").fill("synthetic@example.invalid");
        await page.locator("#contact-message").fill("Controlled composed contact verification");
        await page.locator("#contact-captcha button").click();
        await page.getByRole("button", { name: "Synthetic challenge" }).click();
        await page.locator('#contact-form button[type="submit"]').click();
        await expect.poll(() => submissions.length).toBe(1);
        expect(submissions[0]?.access_key).toBe(contactKey);
        await expect(page.locator("#contact-form [role=status]")).toBeFocused();
        await expect(page.getByTestId("booking-link")).toHaveAttribute("href", bookingURL);
        await page.getByTestId("booking-link").click();
        await expect(page.getByTestId("booking-dialog")).toBeVisible();
        await expect.poll(() => bookings.length).toBe(1);
        await expect(page.getByTestId("booking-frame")).toHaveAttribute("src", bookingURL);
        await page.keyboard.press("Escape");
        await expect(page.getByTestId("booking-dialog")).not.toBeVisible();
        expect(analytics).toHaveLength(afterChoice);
      }
      expect(unexpected).toEqual([]);
      if (!configured) {
        expect(analytics).toEqual([]);
        expect(submissions).toEqual([]);
        expect(bookings).toEqual([]);
      }
    });
  }
}
