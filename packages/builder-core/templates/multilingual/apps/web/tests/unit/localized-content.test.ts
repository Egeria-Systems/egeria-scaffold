import { describe, expect, it } from "vitest";

import {
  assertTranslationParity,
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
  localeSwitch: { href: "/fr-CA", label: "Français" },
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
};

describe("localized content", () => {
  it("loads strict locale catalogs with matching translation shapes", () => {
    const english = parseLocalizedCatalog(validCatalog);
    const french = parseLocalizedCatalog({
      ...validCatalog,
      localeSwitch: { href: "/en-CA", label: "English" },
    });
    expect(english.pages.home).toBeDefined();
    expect(french.pages.home).toBeDefined();
    expect(() => assertTranslationParity(english, french)).not.toThrow();
    expect(() => parseLocalizedCatalog({ ...english, unused: true })).toThrowError(
      "CONTENT_INVALID",
    );
    expect(() =>
      assertTranslationParity(english, { ...french, booking: undefined }),
    ).toThrowError("CONTENT_INVALID");
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
});
