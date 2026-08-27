import { expect, test } from "@playwright/test";

test("unprefixed requests negotiate once and explicit locale routes remain stable", async ({
  page,
  request,
}) => {
  const negotiation = await request.get("/", {
    headers: { "Accept-Language": "fr-CA,fr;q=0.9" },
    maxRedirects: 0,
  });
  expect(negotiation.status()).toBe(307);
  const location = negotiation.headers().location;
  if (location === undefined) throw new Error("Locale redirect is missing");
  expect(location).toBe("/fr-CA");
  expect(negotiation.headers().vary).toContain("Accept-Language");

  await page.goto(location);
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
  await expect(page).toHaveTitle("Page introuvable");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "La page demandée est introuvable.",
  );
});
