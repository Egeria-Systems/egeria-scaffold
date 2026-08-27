import { describe, expect, it } from "vitest";

import {
  createLanguageAlternates,
  isLocale,
  localizePath,
  looksLikeLocaleSegment,
  negotiateLocale,
  requireLocale,
} from "../../src/i18n/locale";

describe("locale contract", () => {
  it("accepts only the supported locale set", () => {
    expect(isLocale("en-CA")).toBe(true);
    expect(isLocale("fr-CA")).toBe(true);
    expect(isLocale("en-US")).toBe(false);
    expect(() => requireLocale("es-ES")).toThrowError("LOCALE_INVALID");
    expect(looksLikeLocaleSegment("es-ES")).toBe(true);
    expect(looksLikeLocaleSegment("about")).toBe(false);
  });

  it("negotiates once by quality and falls back to the default locale", () => {
    expect(negotiateLocale("en-CA;q=0.4, fr-CA;q=0.9")).toBe("fr-CA");
    expect(negotiateLocale("fr-FR, en;q=0.8")).toBe("en-CA");
    expect(negotiateLocale("de-DE, *;q=0.2")).toBe("en-CA");
    expect(negotiateLocale(null)).toBe("en-CA");
  });

  it("creates locale-prefixed paths and exact alternates", () => {
    expect(localizePath("fr-CA", "/about")).toBe("/fr-CA/about");
    expect(localizePath("en-CA", "/")).toBe("/en-CA");
    expect(createLanguageAlternates("/about")).toEqual({
      "en-CA": "/en-CA/about",
      "fr-CA": "/fr-CA/about",
    });
  });
});
