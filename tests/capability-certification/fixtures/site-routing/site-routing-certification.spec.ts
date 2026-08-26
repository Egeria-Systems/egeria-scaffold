import { expect, test, type Page } from "@playwright/test";

async function openRoute(page: Page, target: string) {
  const response = await page.goto(target, { waitUntil: "networkidle" });
  expect(response, "the route returned a document response").not.toBeNull();
  expect(response?.ok(), "the route document response was successful").toBe(
    true,
  );
}

async function expectAboutRoute(page: Page) {
  await expect(page).toHaveURL((url) => url.pathname === "/about");
  await expect(
    page.getByRole("heading", { level: 1, name: "About" }),
  ).toBeVisible();
  await expect(page.getByText("Background and approach.")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Working principles" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Clear communication, careful craft, and practical outcomes guide the work.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Home" })).toHaveAttribute(
    "href",
    "/",
  );
  await expect(page.getByRole("link", { name: "About" })).toHaveAttribute(
    "href",
    "/about",
  );
}

test("serves the generated about route directly", async ({ page }) => {
  await openRoute(page, "/about");
  await expectAboutRoute(page);
});

test("navigates between the generated home and about routes", async ({
  page,
}) => {
  await openRoute(page, "/");
  await page.getByRole("link", { name: "About" }).click();
  await expectAboutRoute(page);

  await page.getByRole("link", { name: "Home" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Acme Site" }),
  ).toBeVisible();
});
