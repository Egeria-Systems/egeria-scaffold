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
  booking: {
    heading: "Book a conversation",
    summary: "Choose a time.",
    linkLabel: "Schedule",
    frameTitle: "Scheduling page",
    popupHeading: "Choose a time",
    closeLabel: "Close scheduling",
  },
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
      parseLocalizedCatalog({ ...validCatalog, booking: undefined }, "en-CA"),
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
