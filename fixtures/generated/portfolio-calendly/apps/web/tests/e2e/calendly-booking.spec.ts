import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type Request,
} from "@playwright/test";

import {
  bookingCalendlySettings,
  type CalendlyBookingSettings,
} from "../../src/integrations/booking-calendly/booking-settings";

const LANDING_PATH = "./";

function readBookingMode(
  settings: CalendlyBookingSettings,
): CalendlyBookingSettings["mode"] {
  return settings.mode;
}

const bookingMode = readBookingMode(bookingCalendlySettings);
const providerOrigin = new URL(bookingCalendlySettings.destination).origin;
const schedulingDocument =
  '<!doctype html><html><head><link rel="icon" href="data:,"></head><body></body></html>';

type ProviderRequestAudit = Readonly<{
  configuredRequests: () => readonly Request[];
  requestCount: () => number;
  unexpectedRequestUrls: () => readonly string[];
}>;

async function stubSchedulingDocument(
  target: Page | BrowserContext,
): Promise<ProviderRequestAudit> {
  const configuredRequests: Request[] = [];
  const unexpectedRequestUrls: string[] = [];

  await target.route(
    (url) => url.origin === providerOrigin,
    async (route) => {
      const request = route.request();
      const requestUrl = request.url();

      if (requestUrl === bookingCalendlySettings.destination) {
        configuredRequests.push(request);
        await route.fulfill({
          status: 200,
          contentType: "text/html",
          body: schedulingDocument,
        });
        return;
      }

      unexpectedRequestUrls.push(requestUrl);
      await route.abort("blockedbyclient");
    },
  );

  return {
    configuredRequests: () => [...configuredRequests],
    requestCount: () => configuredRequests.length,
    unexpectedRequestUrls: () => [...unexpectedRequestUrls],
  };
}

test("loads the scheduling frame only through the configured interaction", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 200 });
  const providerAudit = await stubSchedulingDocument(page);
  await page.goto(LANDING_PATH, { waitUntil: "domcontentloaded" });

  const bookingLink = page.getByTestId("booking-link");
  await expect(bookingLink).toHaveAttribute(
    "href",
    bookingCalendlySettings.destination,
  );

  if (bookingMode === "link") {
    await expect(page.getByTestId("booking-frame")).toHaveCount(0);
    expect(providerAudit.requestCount()).toBe(0);
    expect(providerAudit.unexpectedRequestUrls()).toEqual([]);
    return;
  }

  const bookingFrame = page.getByTestId("booking-frame");
  await expect(bookingFrame).toHaveCount(0);
  expect(providerAudit.requestCount()).toBe(0);

  if (bookingMode === "inline") {
    await page.getByTestId("booking-inline-region").scrollIntoViewIfNeeded();
    await expect(bookingFrame).toHaveCount(1);
    await expect(bookingFrame).toHaveAttribute(
      "src",
      bookingCalendlySettings.destination,
    );
    await expect.poll(providerAudit.requestCount).toBeGreaterThan(0);
    expect(providerAudit.unexpectedRequestUrls()).toEqual([]);
    return;
  }

  const dialog = page.getByTestId("booking-dialog");
  await expect(dialog).not.toBeVisible();
  await bookingLink.click();
  await expect(dialog).toBeVisible();
  await expect(bookingFrame).toHaveCount(1);
  await expect(bookingFrame).toHaveAttribute(
    "src",
    bookingCalendlySettings.destination,
  );
  await expect.poll(providerAudit.requestCount).toBeGreaterThan(0);
  expect(
    await dialog.evaluate((element) =>
      element.contains(document.activeElement),
    ),
  ).toBe(true);

  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(bookingFrame).toHaveCount(0);
  expect(providerAudit.unexpectedRequestUrls()).toEqual([]);
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
    const providerAudit = await stubSchedulingDocument(context);
    const page = await context.newPage();
    await page.goto(LANDING_PATH, { waitUntil: "domcontentloaded" });
    const bookingLink = page.getByTestId("booking-link");
    await expect(bookingLink).toHaveAttribute(
      "href",
      bookingCalendlySettings.destination,
    );
    await expect(page.getByTestId("booking-frame")).toHaveCount(0);

    await Promise.all([
      page.waitForURL(bookingCalendlySettings.destination),
      bookingLink.click(),
    ]);
    expect(providerAudit.requestCount()).toBe(1);
    expect(providerAudit.unexpectedRequestUrls()).toEqual([]);
  } finally {
    await context.close();
  }
});

test("activates inline fallback when IntersectionObserver is unavailable", async ({
  page,
}) => {
  test.skip(bookingMode !== "inline");
  await page.addInitScript(() => {
    Object.defineProperty(window, "IntersectionObserver", {
      configurable: true,
      value: undefined,
    });
  });
  const providerAudit = await stubSchedulingDocument(page);
  await page.goto(LANDING_PATH, { waitUntil: "domcontentloaded" });

  const bookingFrame = page.getByTestId("booking-frame");
  await expect(bookingFrame).toHaveCount(1);
  await expect(bookingFrame).toHaveAttribute(
    "src",
    bookingCalendlySettings.destination,
  );
  await expect.poll(providerAudit.requestCount).toBeGreaterThan(0);
  expect(providerAudit.unexpectedRequestUrls()).toEqual([]);
});

test("preserves popup navigation when native modal support is unavailable", async ({
  page,
}) => {
  test.skip(bookingMode !== "popup");
  await page.addInitScript(() => {
    Object.defineProperty(
      HTMLDialogElement.prototype,
      "showModal",
      {
        configurable: true,
        value: undefined,
      },
    );
  });
  const providerAudit = await stubSchedulingDocument(page);
  await page.goto(LANDING_PATH, { waitUntil: "domcontentloaded" });

  const bookingLink = page.getByTestId("booking-link");
  await expect(page.getByTestId("booking-dialog")).not.toBeVisible();
  await expect(page.getByTestId("booking-frame")).toHaveCount(0);
  expect(providerAudit.configuredRequests()).toEqual([]);
  expect(providerAudit.unexpectedRequestUrls()).toEqual([]);

  const fallbackState = await page.evaluate(() => {
    const link = document.querySelector('[data-testid="booking-link"]');
    if (!(link instanceof HTMLAnchorElement)) {
      throw new Error("BOOKING_LINK_REQUIRED");
    }

    link.addEventListener("click", (event) => event.preventDefault(), {
      once: true,
    });
    link.click();

    return new Promise<
      Readonly<{ dialogOpen: boolean; frameCount: number }>
    >((resolve) => {
      window.requestAnimationFrame(() => {
        const dialog = document.querySelector(
          '[data-testid="booking-dialog"]',
        );
        resolve({
          dialogOpen: dialog instanceof HTMLDialogElement && dialog.open,
          frameCount: document.querySelectorAll(
            '[data-testid="booking-frame"]',
          ).length,
        });
      });
    });
  });
  expect(fallbackState).toEqual({ dialogOpen: false, frameCount: 0 });

  await Promise.all([
    page.waitForURL(bookingCalendlySettings.destination),
    bookingLink.click(),
  ]);
  expect(
    providerAudit.configuredRequests().map((request) => ({
      isMainFrame: request.frame() === page.mainFrame(),
      isNavigation: request.isNavigationRequest(),
    })),
  ).toEqual([{ isMainFrame: true, isNavigation: true }]);
  expect(providerAudit.unexpectedRequestUrls()).toEqual([]);
});

test("keeps the open popup bounded and free of selected axe violations", async ({
  page,
}) => {
  test.skip(bookingMode !== "popup");
  await page.setViewportSize({ width: 320, height: 800 });
  const providerAudit = await stubSchedulingDocument(page);
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
  const dialogBounds = await dialog.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return {
      innerWidth: window.innerWidth,
      left: bounds.left,
      right: bounds.right,
    };
  });
  expect(dialogBounds.left).toBeGreaterThanOrEqual(0);
  expect(dialogBounds.right).toBeLessThanOrEqual(dialogBounds.innerWidth);

  const results = await new AxeBuilder({ page })
    .include('[data-testid="booking-dialog"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  expect(providerAudit.unexpectedRequestUrls()).toEqual([]);
});
