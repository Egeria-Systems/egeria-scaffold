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
    "aria-current",
    "page",
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

test("serves and navigates to the generated nested work route", async ({
  page,
}) => {
  await openRoute(page, "/work/featured");
  await expect(page).toHaveTitle("Featured work");
  await expect(
    page.getByRole("heading", { level: 1, name: "Featured work" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Work" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await openRoute(page, "/");
  await page.getByRole("link", { name: "Work" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/work/featured");
  await expect(page).toHaveTitle("Featured work");
});

test("publishes crawl routes, redirects the work index, and serves not found content", async ({
  page,
  request,
}) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  expect(await sitemap.text()).toContain("https://example.com/work/featured");

  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toContain("https://example.com/sitemap.xml");

  await openRoute(page, "/work");
  await expect(page).toHaveURL((url) => url.pathname === "/work/featured");

  const missing = await page.goto("/missing-page", {
    waitUntil: "networkidle",
  });
  expect(missing?.status()).toBe(404);
  await expect(page).toHaveTitle("Page not found");
  await expect(
    page.getByRole("heading", { level: 1, name: "Page not found" }),
  ).toBeVisible();
});
