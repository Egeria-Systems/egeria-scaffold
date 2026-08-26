import { expect, test } from "@playwright/test";

const siteTitle = "Acme Site";
const routes = [
  { path: "/", title: siteTitle },
  { path: "/about", title: "About" },
  { path: "/work/featured", title: "Featured work" },
] as const;

test("serves route metadata and active navigation across a nested route", async ({
  page,
}) => {
  for (const route of routes) {
    await page.goto(route.path);
    await expect(page).toHaveTitle(route.title);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /\S/u,
    );
    await expect(page.locator('nav a[aria-current="page"]')).toHaveAttribute(
      "href",
      route.path,
    );
  }
});

test("publishes crawl metadata, redirects the work index, and serves a content-backed not-found page", async ({
  page,
  request,
}) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  expect(await sitemap.text()).toContain("https://example.com/work/featured");

  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toContain("https://example.com/sitemap.xml");

  await page.goto("/work");
  await expect(page).toHaveURL(/\/work\/featured$/u);

  const missing = await page.goto("/missing-page");
  expect(missing?.status()).toBe(404);
  await expect(page).toHaveTitle("Page not found");
  await expect(
    page.getByRole("heading", { level: 1, name: "Page not found" }),
  ).toBeVisible();
});
