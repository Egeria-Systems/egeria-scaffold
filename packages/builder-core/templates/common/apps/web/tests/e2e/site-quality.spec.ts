import AxeBuilder from "@axe-core/playwright";
import { expect, test, type ConsoleMessage, type Page } from "@playwright/test";

type InternalLink = Readonly<{
  index: number;
  target: string;
}>;

const LANDING_PATH = "./";

function documentTarget(value: string): string {
  const url = new URL(value);
  return `${url.pathname}${url.search}${url.hash}`;
}

async function openWithoutRuntimeErrors(
  page: Page,
  target: string,
): Promise<void> {
  const runtimeIssues: string[] = [];
  const onPageError = (): void => {
    runtimeIssues.push("pageerror");
  };
  const onConsole = (message: ConsoleMessage): void => {
    if (message.type() === "error") {
      runtimeIssues.push("console");
    }
  };

  page.on("pageerror", onPageError);
  page.on("console", onConsole);

  try {
    const response = await page.goto(target, { waitUntil: "networkidle" });
    expect(response, "the main document returned a response").not.toBeNull();
    expect(response?.ok(), "the main document response was successful").toBe(
      true,
    );
  } finally {
    page.off("pageerror", onPageError);
    page.off("console", onConsole);
  }

  expect(runtimeIssues).toEqual([]);
}

async function discoverInternalLinks(page: Page): Promise<InternalLink[]> {
  return page.locator("a[href]").evaluateAll((elements) => {
    const links: InternalLink[] = [];
    const seen = new Set<string>();

    for (const [index, element] of elements.entries()) {
      const href = element.getAttribute("href");
      if (
        href === null ||
        href.startsWith("#") ||
        element.hasAttribute("download")
      ) {
        continue;
      }

      let url: URL;
      try {
        url = new URL(href, document.baseURI);
      } catch {
        continue;
      }

      if (
        url.origin !== window.location.origin ||
        !["http:", "https:"].includes(url.protocol)
      ) {
        continue;
      }

      const target = `${url.pathname}${url.search}${url.hash}`;
      if (seen.has(target)) {
        continue;
      }

      seen.add(target);
      links.push({ index, target });
    }

    return links;
  });
}

async function discoverContentPaths(page: Page): Promise<string[]> {
  await openWithoutRuntimeErrors(page, LANDING_PATH);
  const landingTarget = documentTarget(page.url());
  const links = await discoverInternalLinks(page);

  return [
    LANDING_PATH,
    ...links
      .map(({ target }) => target)
      .filter((target) => target !== landingTarget)
      .sort(),
  ];
}

test("renders structured content without page or console errors", async ({
  page,
}) => {
  const paths = await discoverContentPaths(page);

  for (const path of paths) {
    await openWithoutRuntimeErrors(page, path);
    const main = page.getByRole("main");
    const headings = main.getByRole("heading");
    const levelOneHeadings = main.getByRole("heading", { level: 1 });

    await expect(main).toBeVisible();
    await expect(levelOneHeadings).toHaveCount(1);
    expect(await headings.count()).toBeGreaterThan(0);
    expect(
      (await headings.allTextContents()).every(
        (heading) => heading.trim().length > 0,
      ),
    ).toBe(true);
    expect((await main.innerText()).trim().length).toBeGreaterThan(0);
  }
});

test("follows internal navigation when it is present", async ({ page }) => {
  await openWithoutRuntimeErrors(page, LANDING_PATH);
  const landingTarget = documentTarget(page.url());
  const links = (await discoverInternalLinks(page)).filter(
    ({ target }) => target !== landingTarget,
  );

  for (const { index, target } of links) {
    await openWithoutRuntimeErrors(page, LANDING_PATH);
    await page.locator("a[href]").nth(index).click();
    await expect(page).toHaveURL(
      (url) => `${url.pathname}${url.search}${url.hash}` === target,
    );
    await expect(page.getByRole("main")).toBeVisible();
  }
});

test("has no detected axe violations in the selected rule set", async ({
  page,
}) => {
  const paths = await discoverContentPaths(page);

  for (const path of paths) {
    await openWithoutRuntimeErrors(page, path);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  }
});

test("provides keyboard focus with a computed visible indicator", async ({
  page,
}) => {
  const paths = await discoverContentPaths(page);

  for (const path of paths) {
    await openWithoutRuntimeErrors(page, path);
    await page.keyboard.press("Tab");

    const focused = page.locator(":focus");
    await expect(focused).toBeVisible();
    const focusEvidence = await focused.evaluate((element) => {
      type FocusIndicatorStyle = Readonly<{
        outlineColor: string;
        outlineStyle: string;
        outlineWidth: string;
        boxShadow: string;
      }>;

      const isPerceptibleColor = (value: string): boolean => {
        const color = value.trim().toLowerCase();
        if (color === "transparent") {
          return false;
        }

        const slashAlpha = color.match(/\/\s*(\d*\.?\d+)(%)?\s*\)$/u);
        const commaAlpha = /^(?:rgba|hsla)\(/u.test(color)
          ? color.match(/,\s*(\d*\.?\d+)(%)?\s*\)$/u)
          : null;
        const alpha = slashAlpha ?? commaAlpha;

        if (alpha === null) {
          return true;
        }

        return Number.parseFloat(alpha[1] ?? "0") > 0;
      };
      const hasPerceptibleShadow = (value: string): boolean => {
        if (value === "none") {
          return false;
        }

        const colors =
          value.match(/(?:rgba?|hsla?)\([^)]*\)|\btransparent\b/gu) ?? [];
        const hasVisibleColor =
          colors.length === 0 || colors.some(isPerceptibleColor);
        const hasVisibleGeometry =
          value
            .match(/-?(?:\d*\.)?\d+px/gu)
            ?.some((length) => Number.parseFloat(length) !== 0) ?? false;

        return hasVisibleColor && hasVisibleGeometry;
      };
      const hasPerceptibleFocusIndicator = (
        style: FocusIndicatorStyle,
      ): boolean => {
        const hasOutline =
          style.outlineStyle !== "none" &&
          Number.parseFloat(style.outlineWidth) > 0 &&
          isPerceptibleColor(style.outlineColor);

        return hasOutline || hasPerceptibleShadow(style.boxShadow);
      };
      const style = getComputedStyle(element);

      return {
        hasVisibleFocus: hasPerceptibleFocusIndicator(style),
        rejectsTransparentIndicator: !hasPerceptibleFocusIndicator({
          outlineColor: "rgba(0, 0, 0, 0)",
          outlineStyle: "solid",
          outlineWidth: "2px",
          boxShadow: "rgba(0, 0, 0, 0) 0px 0px 0px 3px",
        }),
      };
    });

    expect(focusEvidence.rejectsTransparentIndicator).toBe(true);
    expect(focusEvidence.hasVisibleFocus).toBe(true);
  }
});

test("reflows without document overflow at 320 CSS pixels", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  const paths = await discoverContentPaths(page);

  for (const path of paths) {
    await openWithoutRuntimeErrors(page, path);
    const overflows = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );

    expect(overflows).toBe(false);
  }
});

test("honours reduced motion without material animation or transition", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const paths = await discoverContentPaths(page);

  for (const path of paths) {
    await openWithoutRuntimeErrors(page, path);
    expect(
      await page.evaluate(() =>
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      ),
    ).toBe(true);

    const movingElements = await page.locator("main, main *").evaluateAll(
      (elements) => {
        const durationToMilliseconds = (duration: string): number =>
          duration
            .split(",")
            .map((value) => value.trim())
            .map((value) =>
              value.endsWith("ms")
                ? Number.parseFloat(value)
                : Number.parseFloat(value) * 1_000,
            )
            .reduce((maximum, value) => Math.max(maximum, value), 0);

        return elements
          .map((element) => {
            const style = getComputedStyle(element);
            return {
              animationDuration: durationToMilliseconds(
                style.animationDuration,
              ),
              transitionDuration: durationToMilliseconds(
                style.transitionDuration,
              ),
            };
          })
          .filter(
            ({ animationDuration, transitionDuration }) =>
              animationDuration > 1 || transitionDuration > 1,
          );
      },
    );

    expect(movingElements).toEqual([]);
  }
});
