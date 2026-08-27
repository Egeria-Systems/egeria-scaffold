import { expect, test } from "@playwright/test";

import { createAnalyticsProviderDeclarations } from "../../src/integrations/analytics/analytics-provider-contract";
import { analyticsSettings } from "../../src/integrations/analytics/analytics-settings";

const providerDeclarations = createAnalyticsProviderDeclarations(analyticsSettings);
const providerOrigins = [
  ...new Set(
    providerDeclarations.flatMap((declaration) => [
      new URL(declaration.scriptSource).origin,
      ...declaration.connectSources,
    ]),
  ),
];

test("optional providers stay blocked until grant and withdrawal persists denial", async ({
  page,
}) => {
  const providerRequests: string[] = [];
  for (const origin of providerOrigins) {
    await page.route(`${origin}/**`, async (route) => {
      providerRequests.push(route.request().url());
      await route.fulfill({ status: 204, body: "" });
    });
  }

  await page.goto("/");
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(providerRequests).toEqual([]);

  await page.locator('[data-analytics-consent-action="decline"]').click();
  await page.reload();
  await expect(
    page.locator('[data-analytics-consent-action="manage"]'),
  ).toBeVisible();
  expect(providerRequests).toEqual([]);

  await page.locator('[data-analytics-consent-action="manage"]').click();
  await page.locator('[data-analytics-consent-action="allow"]').click();
  const expectedProviderCount = providerDeclarations.length;
  await expect.poll(() => providerRequests.length).toBe(expectedProviderCount);
  for (const declaration of providerDeclarations) {
    expect(
      providerRequests.some((request) =>
        request.startsWith(declaration.scriptSource),
      ),
    ).toBe(true);
  }

  const verificationToken =
    analyticsSettings.operationalIntegrations.googleSearchConsole
      ?.verificationToken;
  if (verificationToken !== undefined) {
    await expect(page.locator('meta[name="google-site-verification"]')).toHaveAttribute(
      "content",
      verificationToken,
    );
  }

  await page.evaluate(() => {
    document.cookie = "_ga=browser-test; Path=/; SameSite=Lax";
    document.cookie = "_clck=browser-test; Path=/; SameSite=Lax";
  });
  expect(await page.evaluate(() => document.cookie)).toContain("_ga=");
  expect(await page.evaluate(() => document.cookie)).toContain("_clck=");

  await page.locator('[data-analytics-consent-action="manage"]').click();
  await Promise.all([
    page.waitForEvent("framenavigated"),
    page.locator('[data-analytics-consent-action="withdraw"]').click(),
  ]);
  await expect(
    page.locator('[data-analytics-consent-action="manage"]'),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      window.localStorage.getItem("egeria.analytics.consent.v1"),
    ),
  ).toBe("denied");
  expect(await page.evaluate(() => document.cookie)).not.toContain("_ga=");
  expect(await page.evaluate(() => document.cookie)).not.toContain("_clck=");
  expect(providerRequests).toHaveLength(expectedProviderCount);
});
