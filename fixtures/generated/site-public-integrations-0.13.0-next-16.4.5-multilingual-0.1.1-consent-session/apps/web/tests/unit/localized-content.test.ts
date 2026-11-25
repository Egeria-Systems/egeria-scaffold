import { describe, expect, it } from "vitest";

import {
  assertTranslationParity,
  localeFromMiddlewareHeader,
  localizedRoutes,
  parseLocalizedCatalog,
  resolveLocalizedRoute,
} from "../../src/i18n/localized-content";

const page = {
  metadata: { title: "Example", description: "Example page." },
  sections: [
    {
      id: "introduction",
      type: "hero",
      variant: "default",
      enabled: true,
      content: { heading: "Example", summary: "Example summary." },
    },
  ],
};

const validCatalog = {
  metadata: page.metadata,
  accessibility: {
    skipToContent: "Skip to content",
    navigationLabel: "Primary navigation",
  },
  navigation: [{ href: "/en-CA", label: "Home" }],
  localeSwitch: { label: "Français" },
  pages: Object.fromEntries(
    localizedRoutes.map(({ identifier }) => [identifier, page]),
  ),
  notFound: page,
  error: {
    heading: "Something went wrong",
    summary: "Please try again.",
    retryLabel: "Try again",
  },
};

describe("localized content", () => {
  it("loads strict locale catalogs with matching translation shapes", () => {
    const english = parseLocalizedCatalog(validCatalog, "en-CA");
    const french = parseLocalizedCatalog({
      ...validCatalog,
      navigation: [{ href: "/fr-CA", label: "Accueil" }],
      localeSwitch: { label: "English" },
    }, "fr-CA");
    expect(english.pages.home).toBeDefined();
    expect(french.pages.home).toBeDefined();
    expect(() => assertTranslationParity(english, french)).not.toThrow();
    expect(() => parseLocalizedCatalog({ ...english, unused: true }, "en-CA")).toThrowError(
      "CONTENT_INVALID",
    );
    expect(() =>
      parseLocalizedCatalog({ ...validCatalog, booking: { heading: "Stale booking copy" } }, "en-CA"),
    ).toThrowError("CONTENT_INVALID");
  });

  it("rejects cross-locale section and navigation drift", () => {
    const english = parseLocalizedCatalog(validCatalog, "en-CA");
    const changedSection = parseLocalizedCatalog({
      ...validCatalog,
      navigation: [{ href: "/fr-CA", label: "Accueil" }],
      localeSwitch: { label: "English" },
      pages: Object.fromEntries(
        localizedRoutes.map(({ identifier }) => [
          identifier,
          identifier === "home"
            ? {
                ...page,
                sections: [
                  {
                    id: "changed",
                    type: "hero",
                    variant: "default",
                    enabled: true,
                    content: {
                      heading: "Exemple",
                      summary: "Résumé d’exemple.",
                    },
                  },
                ],
              }
            : page,
        ]),
      ),
    }, "fr-CA");
    expect(() => assertTranslationParity(english, changedSection)).toThrowError(
      "CONTENT_INVALID",
    );

    const changedNavigation = parseLocalizedCatalog({
      ...validCatalog,
      navigation: [
        { href: "/fr-CA", label: "Accueil" },
        { href: "/fr-CA", label: "Accueil en double" },
      ],
      localeSwitch: { label: "English" },
    }, "fr-CA");
    expect(() => assertTranslationParity(english, changedNavigation)).toThrowError(
      "CONTENT_INVALID",
    );
  });

  it("resolves only declared localized routes", () => {
    expect(resolveLocalizedRoute("fr-CA", [])).toEqual({
      kind: "page",
      identifier: "home",
      path: "/fr-CA",
    });
    expect(resolveLocalizedRoute("en-CA", ["missing"])).toEqual({
      kind: "not-found",
    });
  });

  it("accepts only an exact locale from the middleware-owned header", () => {
    expect(localeFromMiddlewareHeader("fr-CA")).toBe("fr-CA");
    expect(localeFromMiddlewareHeader("fr-CA, en-CA;q=0.8")).toBe("en-CA");
    expect(localeFromMiddlewareHeader(null)).toBe("en-CA");
  });
});

function catalogWithSectionLinks(
  locale: "en-CA" | "fr-CA",
  cta: string,
  projects: readonly string[] = [cta],
  enabled = true,
) {
  return parseLocalizedCatalog({
    ...validCatalog,
    navigation: [{ href: `/${locale}`, label: "Home" }],
    pages: {
      ...validCatalog.pages,
      home: {
        ...page,
        sections: [
          ...page.sections,
          {
            id: "contact", type: "call-to-action", variant: "default", enabled,
            content: { heading: "Contact", summary: "Contact summary", label: "Open", href: cta },
          },
          {
            id: "featured", type: "project-list", variant: "default", enabled: true,
            content: {
              heading: "Featured",
              projects: projects.map((href) => ({ title: "Project", summary: "Project summary", href })),
            },
          },
        ],
      },
    },
  }, locale);
}

describe("localized section link parity", () => {
  it.each([
    ["/en-CA/about", "/fr-CA/about"],
    ["/en-CA/work/featured", "/fr-CA/work/featured"],
    ["/en-CA", "/fr-CA"],
    ["/en-CA/about?x=1#team", "/fr-CA/about?x=1#team"],
    ["/en-CA?x=1#team", "/fr-CA?x=1#team"],
    ["/about", "/about"],
    ["https://example.test/en-CA/about", "https://example.test/en-CA/about"],
    ["mailto:info@example.test", "mailto:info@example.test"],
    ["#team", "#team"],
  ])("accepts corresponding destinations %s and %s without rewriting them", (englishHref, frenchHref) => {
    const reference = catalogWithSectionLinks("en-CA", englishHref);
    const candidate = catalogWithSectionLinks("fr-CA", frenchHref);
    expect(() => assertTranslationParity(reference, candidate)).not.toThrow();
    expect(candidate.pages.home?.sections[1]?.content).toMatchObject({ href: frenchHref });
    expect(candidate.pages.home?.sections[2]?.content).toMatchObject({ projects: [{ href: frenchHref }] });
  });

  it.each([
    ["/en-CA/about", "/fr-CA/work/featured"],
    ["/en-CA/about?x=1", "/fr-CA/about?x=2"],
    ["/en-CA/about#one", "/fr-CA/about#two"],
    ["/en-CAevil/about", "/fr-CA/about"],
    ["/en-US/about", "/fr-CA/about"],
    ["https://example.test/en-CA/about", "https://example.test/fr-CA/about"],
    ["mailto:info@example.test", "mailto:contact@example.test"],
    ["#team", "#people"],
    ["/en-CA/about/", "/fr-CA/about"],
    ["/en-CA/%61bout", "/fr-CA/about"],
    ["/en-CA/about?x=1&y=2", "/fr-CA/about?y=2&x=1"],
  ])("rejects different destinations %s and %s", (englishHref, frenchHref) => {
    const reference = catalogWithSectionLinks("en-CA", englishHref);
    const candidate = catalogWithSectionLinks("fr-CA", frenchHref);
    expect(() => assertTranslationParity(reference, candidate)).toThrowError("CONTENT_INVALID");
  });

  it("preserves project order, enabled parity, and unsafe URL refusal", () => {
    const reference = catalogWithSectionLinks("en-CA", "/en-CA/about", ["/en-CA/about", "/en-CA"]);
    const reversed = catalogWithSectionLinks("fr-CA", "/fr-CA/about", ["/fr-CA", "/fr-CA/about"]);
    const disabled = catalogWithSectionLinks("fr-CA", "/fr-CA/about", ["/fr-CA/about", "/fr-CA"], false);
    expect(() => assertTranslationParity(reference, reversed)).toThrowError("CONTENT_INVALID");
    expect(() => assertTranslationParity(reference, disabled)).toThrowError("CONTENT_INVALID");
    expect(() => catalogWithSectionLinks("fr-CA", "//example.test/fr-CA/about")).toThrowError("CONTENT_INVALID");
  });
});
