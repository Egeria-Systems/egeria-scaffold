import { expect, test } from "./application-test";

const siteOrigin = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").origin;
const routes = [
  "/en-CA",
  "/en-CA/about",
  "/en-CA/work/featured",
  "/fr-CA",
  "/fr-CA/about",
  "/fr-CA/work/featured",
] as const;

function parseSitemapAlternates(source: string) {
  const entries = new Map<string, Map<string, string>>();
  for (const match of source.matchAll(/<url>([\s\S]*?)<\/url>/gu)) {
    const body = match[1] ?? "";
    const location = body.match(/<loc>([^<]+)<\/loc>/u)?.[1];
    if (location === undefined) continue;
    entries.set(
      location,
      new Map(
        [...body.matchAll(
          /<xhtml:link rel="alternate" hreflang="([^"]+)" href="([^"]+)"\s*\/>/gu,
        )].map((alternate) => [alternate[1] ?? "", alternate[2] ?? ""]),
      ),
    );
  }
  return entries;
}

test("serves localized route metadata and active navigation across nested routes", async ({
  openApplicationPage, page,
}) => {
  for (const route of routes) {
    await openApplicationPage(page, route);
    await expect(page).toHaveTitle(/\S/u);
    await expect(page.locator("html")).toHaveAttribute(
      "lang",
      route.split("/")[1] ?? "",
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /\S/u,
    );
    await expect(page.locator('nav a[aria-current="page"]')).toHaveAttribute(
      "href",
      route,
    );
  }

  await openApplicationPage(page, "/fr-CA/work/featured");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/fr-CA\/work\/featured$/u,
  );
  for (const locale of ["en-CA", "fr-CA"]) {
    await expect(
      page.locator(`link[rel="alternate"][hreflang="${locale}"]`),
    ).toHaveAttribute("href", new RegExp(`/${locale}/work/featured$`, "u"));
  }
});

test("publishes localized discovery, redirects, and not-found behavior", async ({
  openApplicationPage, page,
  getApplicationResponse,
}) => {
  const sitemap = await getApplicationResponse("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  const sitemapContent = await sitemap.text();
  const sitemapAlternates = parseSitemapAlternates(sitemapContent);
  const expectedAlternates = new Map([
    ["en-CA", `${siteOrigin}/en-CA/work/featured`],
    ["fr-CA", `${siteOrigin}/fr-CA/work/featured`],
  ]);
  for (const location of expectedAlternates.values()) {
    expect(sitemapAlternates.get(location)).toEqual(expectedAlternates);
  }

  const robots = await getApplicationResponse("/robots.txt");
  expect(robots.ok()).toBe(true);
  const robotsContent = await robots.text();
  expect(robotsContent).toContain(`${siteOrigin}/sitemap.xml`);
  expect(robotsContent).toContain(process.env.APPLICATION_ENVIRONMENT === "production" ? "Allow: /" : "Disallow: /");

  await openApplicationPage(page, "/fr-CA/work");
  await expect(page).toHaveURL(/\/fr-CA\/work\/featured$/u);

  const missing = await openApplicationPage(page, "/fr-CA/missing-page");
  expect(missing?.status()).toBe(404);
  expect(await page.locator('meta[name="robots"]').evaluateAll(elements => elements.map(element => element.getAttribute("content")).join(","))).toContain("noindex");
  await expect(page).toHaveTitle(/\S/u);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  await expect(page.locator('link[rel="alternate"]')).toHaveCount(0);
});
