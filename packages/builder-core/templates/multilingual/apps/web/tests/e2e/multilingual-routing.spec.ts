import { expect, test } from "@playwright/test";

test("unprefixed requests negotiate once and explicit locale routes remain stable", async ({
  page,
}) => {
  await page.context().setExtraHTTPHeaders({ "Accept-Language": "fr-CA,fr;q=0.9" });
  await page.goto("/");
  await expect(page).toHaveURL(/\/fr-CA$/u);
  await expect(page.locator("html")).toHaveAttribute("lang", "fr-CA");
  await page.getByRole("link", { name: "English" }).click();
  await expect(page).toHaveURL(/\/en-CA$/u);
  await expect(page.locator("html")).toHaveAttribute("lang", "en-CA");
});

test("unsupported explicit locales and unknown localized paths return not found", async ({
  page,
}) => {
  const unsupported = await page.goto("/es-ES");
  expect(unsupported?.status()).toBe(404);
  const missing = await page.goto("/fr-CA/missing");
  expect(missing?.status()).toBe(404);
});
