import { expect, test, type Page } from "@playwright/test";

test.skip(
  true,
  "Multilingual projects are outside the established generated visual matrix.",
);

const normalizedHeroHeading = "Reviewed visual baseline";

async function prepareHome(
  page: Page,
  viewport: Readonly<{ width: number; height: number }>,
): Promise<void> {
  await page.setViewportSize(viewport);
  const response = await page.goto("/en-CA");
  expect(response).not.toBeNull();
  expect(response?.ok()).toBe(true);

  const main = page.getByRole("main");
  await expect(main).toBeVisible();
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toBeVisible();
  await heading.evaluate((element, normalizedHeroHeading) => {
    element.textContent = normalizedHeroHeading;
  }, normalizedHeroHeading);
}

test("matches the desktop home viewport", async ({ page }) => {
  await prepareHome(page, { width: 1440, height: 900 });
  await expect(page).toHaveScreenshot("home-desktop.png");
});

test("matches the mobile home viewport", async ({ page }) => {
  await prepareHome(page, { width: 320, height: 800 });
  await expect(page).toHaveScreenshot("home-mobile.png");
});
