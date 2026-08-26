import { expect, test, type Page } from "@playwright/test";

async function openHome(page: Page) {
  const response = await page.goto("./", { waitUntil: "networkidle" });
  expect(response?.ok()).toBe(true);
}

test("renders all registered section shapes with computed semantic tokens", async ({
  page,
}) => {
  await openHome(page);

  await expect(page.locator("header#introduction")).toBeVisible();
  await expect(page.locator("section#approach")).toBeVisible();
  await expect(page.locator("section#selected-work")).toBeVisible();
  await expect(page.locator("section#contact")).toBeVisible();
  await expect(page.locator("#selected-work ul")).toHaveCount(1);
  await expect(page.locator("#selected-work article")).toHaveCount(1);

  expect(
    await page.locator("html").evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        canvas: style.getPropertyValue("--design-color-canvas").trim(),
        ink: style.getPropertyValue("--design-color-ink").trim(),
        accent: style.getPropertyValue("--design-color-accent").trim(),
        focus: style.getPropertyValue("--design-color-focus").trim(),
      };
    }),
  ).toEqual({
    canvas: "#f6f5ef",
    ink: "#17211f",
    accent: "#0b6959",
    focus: "#b45309",
  });
});

test("provides visible focus and minimum primary-link targets", async ({
  page,
}) => {
  await openHome(page);
  const projectLink = page.getByRole("link", { name: "Example project" });
  const actionLink = page.getByRole("link", { name: "Send an email" });

  await projectLink.focus();
  await expect(projectLink).toBeFocused();
  const focus = await projectLink.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
      boxShadow: style.boxShadow,
    };
  });
  expect(
    (focus.outlineStyle !== "none" && focus.outlineWidth > 0) ||
      focus.boxShadow !== "none",
  ).toBe(true);

  for (const link of [projectLink, actionLink]) {
    const box = await link.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
});

test("reflows at 320 CSS pixels and applies the responsive project grid", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await openHome(page);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    ),
  ).toBe(false);
  expect(
    (await page.locator("#selected-work ul").evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.split(" "),
    )).length,
  ).toBe(1);

  await page.setViewportSize({ width: 900, height: 800 });
  expect(
    (await page.locator("#selected-work ul").evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.split(" "),
    )).length,
  ).toBe(2);
});

test("honours the reduced-motion preference", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openHome(page);
  expect(
    await page.evaluate(() =>
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
  ).toBe(true);

  const excessiveMotion = await page.locator("main, main *").evaluateAll(
    (elements) => {
      const maximumMilliseconds = (value: string): number =>
        Math.max(
          ...value.split(",").map((duration) => {
            const normalized = duration.trim();
            return normalized.endsWith("ms")
              ? Number.parseFloat(normalized)
              : Number.parseFloat(normalized) * 1_000;
          }),
        );

      return elements.filter((element) => {
        const style = getComputedStyle(element);
        return (
          maximumMilliseconds(style.animationDuration) > 1 ||
          maximumMilliseconds(style.transitionDuration) > 1
        );
      }).length;
    },
  );
  expect(excessiveMotion).toBe(0);
});
