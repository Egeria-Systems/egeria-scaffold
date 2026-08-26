import { expect, test } from "@playwright/test";

test("generated portfolio renders content-file values", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Acme Portfolio");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "A focused portfolio.",
  );
  await expect(page.locator('a[href="#main-content"]')).toHaveText(
    "Skip to content",
  );
  await expect(
    page.getByRole("heading", { level: 1, name: "Acme Portfolio" }),
  ).toBeVisible();
  await expect(page.getByText("A concise introduction to selected work.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Introduction" })).toHaveAttribute(
    "href",
    "#introduction",
  );
});
