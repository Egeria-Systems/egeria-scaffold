import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("renders the proof and returns its runtime report", async ({ page }) => {
  await expect
    .poll(
      async () => {
        const response = await page.request.get("/api/compatibility");

        if (!response.ok()) {
          return null;
        }

        try {
          return JSON.parse(await response.text());
        } catch {
          return null;
        }
      },
      {
        message: "the deployed compatibility runtime report to become ready",
        timeout: 60_000,
      },
    )
    .toEqual({
      environment: "compatibility",
      runtime: "workerd",
    });

  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Next.js and Cloudflare compatibility proof",
    }),
  ).toBeVisible();
});

test("has no detected axe violations in the selected rule set", async ({
  page,
}) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("supports keyboard focus and 320 CSS pixel reflow", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "View runtime report" }),
  ).toBeFocused();
  const overflows = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);
});

test("does not animate when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const animatedElements = await page.locator("main, main *").evaluateAll(
    (elements) =>
      elements
        .map((element) => {
          const style = getComputedStyle(element);
          return {
            tagName: element.tagName,
            identifier: element.id || element.className,
            animationName: style.animationName,
            transitionDuration: style.transitionDuration,
            transitionProperty: style.transitionProperty,
          };
        })
        .filter(
          ({ animationName, transitionDuration }) =>
            animationName !== "none" || transitionDuration !== "0s",
        ),
  );
  expect(animatedElements).toEqual([]);
});
