import { expect, test } from "@playwright/test";

import { analyticsSettings } from "../../src/integrations/analytics/analytics-settings";

const providerHosts = [
  "static.cloudflareinsights.com",
  "www.googletagmanager.com",
  "www.clarity.ms",
] as const;

test("optional providers stay blocked until grant and withdrawal persists denial", async ({
  page,
}) => {
  const providerRequests: string[] = [];
  for (const host of providerHosts) {
    await page.route(`https://${host}/**`, async (route) => {
      providerRequests.push(route.request().url());
      await route.fulfill({ status: 204, body: "" });
    });
  }

  await page.goto("/");
  await expect(page.getByRole("dialog", { name: "Analytics choices" })).toBeVisible();
  expect(providerRequests).toEqual([]);

  await page.getByRole("button", { name: "Allow analytics" }).click();
  const expectedProviderCount = Object.values(analyticsSettings.providers).filter(
    (provider) => provider !== undefined,
  ).length;
  await expect.poll(() => providerRequests.length).toBe(expectedProviderCount);

  const verificationToken =
    analyticsSettings.operationalIntegrations.googleSearchConsole
      ?.verificationToken;
  if (verificationToken !== undefined) {
    await expect(page.locator('meta[name="google-site-verification"]')).toHaveAttribute(
      "content",
      verificationToken,
    );
  }

  await page.getByRole("button", { name: "Manage analytics" }).click();
  await Promise.all([
    page.waitForEvent("framenavigated"),
    page.getByRole("button", { name: "Withdraw analytics consent" }).click(),
  ]);
  await expect(page.getByRole("button", { name: "Manage analytics" })).toBeVisible();
  expect(
    await page.evaluate(() =>
      window.localStorage.getItem("egeria.analytics.consent.v1"),
    ),
  ).toBe("denied");
});
