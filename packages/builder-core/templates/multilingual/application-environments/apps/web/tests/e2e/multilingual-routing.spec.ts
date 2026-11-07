import { expect, test } from "./application-test";

test("unprefixed requests negotiate once and explicit locale routes remain stable", async ({
  openApplicationPage, page,
  getApplicationResponse,
}) => {
  const negotiation = await getApplicationResponse("/", {
    acceptLanguage: "fr-CA,fr;q=0.9",
    redirect: "manual",
  });
  expect(negotiation.status()).toBe(307);
  const location = negotiation.headers().location;
  if (location === undefined) throw new Error("Locale redirect is missing");
  expect(location).toBe("/fr-CA");
  expect(negotiation.headers().vary).toContain("Accept-Language");

  await openApplicationPage(page, location);
  await expect(page).toHaveURL(/\/fr-CA$/u);
  await expect(page.locator("html")).toHaveAttribute("lang", "fr-CA");
  await page.locator('a[hreflang="en-CA"]').click();
  await expect(page).toHaveURL(/\/en-CA$/u);
  await expect(page.locator("html")).toHaveAttribute("lang", "en-CA");
});

test("unsupported explicit locales and unknown localized paths return not found", async ({
  openApplicationPage, page,
}) => {
  const unsupported = await openApplicationPage(page, "/es-ES");
  expect(unsupported?.status()).toBe(404);
  const missing = await openApplicationPage(page, "/fr-CA/missing");
  expect(missing?.status()).toBe(404);
  await expect(page.locator("html")).toHaveAttribute("lang", "fr-CA");
  await expect(page).toHaveTitle(/\S/u);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /\S/u,
  );
});
