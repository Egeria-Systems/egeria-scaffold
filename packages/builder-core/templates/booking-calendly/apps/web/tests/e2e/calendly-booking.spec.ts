import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test,
  type Page,
} from "@playwright/test";

import { bookingCalendlySettings } from "../../src/integrations/booking-calendly/booking-settings";

const LANDING_PATH = "./";

async function stubSchedulingDocument(page: Page): Promise<() => number> {
  let requestCount = 0;

  await page.route(bookingCalendlySettings.destination, async (route) => {
    requestCount += 1;
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><html><body></body></html>",
    });
  });

  return () => requestCount;
}

test("loads the scheduling frame only through the configured interaction", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 200 });
  const providerRequestCount = await stubSchedulingDocument(page);
  await page.goto(LANDING_PATH, { waitUntil: "domcontentloaded" });

  const bookingLink = page.getByTestId("booking-link");
  await expect(bookingLink).toHaveAttribute(
    "href",
    bookingCalendlySettings.destination,
  );

  if (bookingCalendlySettings.mode === "link") {
    await expect(page.getByTestId("booking-frame")).toHaveCount(0);
    expect(providerRequestCount()).toBe(0);
    return;
  }

  const bookingFrame = page.getByTestId("booking-frame");
  await expect(bookingFrame).not.toHaveAttribute("src");
  expect(providerRequestCount()).toBe(0);

  if (bookingCalendlySettings.mode === "inline") {
    await page.getByTestId("booking-inline-region").scrollIntoViewIfNeeded();
    await expect(bookingFrame).toHaveAttribute(
      "src",
      bookingCalendlySettings.destination,
    );
    await expect.poll(providerRequestCount).toBeGreaterThan(0);
    return;
  }

  const dialog = page.getByTestId("booking-dialog");
  await expect(dialog).not.toBeVisible();
  await bookingLink.click();
  await expect(dialog).toBeVisible();
  await expect(bookingFrame).toHaveAttribute(
    "src",
    bookingCalendlySettings.destination,
  );
  await expect.poll(providerRequestCount).toBeGreaterThan(0);
  expect(
    await dialog.evaluate((element) =>
      element.contains(document.activeElement),
    ),
  ).toBe(true);

  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(bookingFrame).not.toHaveAttribute("src");
});

test("preserves ordinary anchor navigation without JavaScript", async ({
  browser,
}, testInformation) => {
  const baseURL = testInformation.project.use.baseURL;
  if (typeof baseURL !== "string") {
    throw new Error("BASE_URL_REQUIRED");
  }

  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
  });

  try {
    await context.route(bookingCalendlySettings.destination, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><html><body></body></html>",
      });
    });
    const page = await context.newPage();
    await page.goto(LANDING_PATH, { waitUntil: "domcontentloaded" });
    const bookingLink = page.getByTestId("booking-link");
    await expect(bookingLink).toHaveAttribute(
      "href",
      bookingCalendlySettings.destination,
    );

    await Promise.all([
      page.waitForURL(bookingCalendlySettings.destination),
      bookingLink.click(),
    ]);
  } finally {
    await context.close();
  }
});

test("keeps the open popup bounded and free of selected axe violations", async ({
  page,
}) => {
  test.skip(bookingCalendlySettings.mode !== "popup");
  await page.setViewportSize({ width: 320, height: 800 });
  await stubSchedulingDocument(page);
  await page.goto(LANDING_PATH, { waitUntil: "domcontentloaded" });
  await page.getByTestId("booking-link").click();
  const dialog = page.getByTestId("booking-dialog");
  await expect(dialog).toBeVisible();

  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);

  const results = await new AxeBuilder({ page })
    .include('[data-testid="booking-dialog"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
