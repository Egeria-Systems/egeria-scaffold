export const supportedLocales = ["en-CA", "fr-CA"] as const;
export type Locale = (typeof supportedLocales)[number];

export const defaultLocale: Locale = "en-CA";

export function isLocale(value: string): value is Locale {
  return supportedLocales.some((locale) => locale === value);
}

export function requireLocale(value: string): Locale {
  if (!isLocale(value)) {
    throw new TypeError("LOCALE_INVALID");
  }

  return value;
}

export function looksLikeLocaleSegment(value: string): boolean {
  return /^[a-z]{2}(?:-[A-Z]{2})?$/u.test(value);
}

export function localizePath(locale: Locale, path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) {
    return path;
  }

  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

function parseQuality(parameter: string | undefined): number | undefined {
  if (parameter === undefined) {
    return 1;
  }

  const match = /^q=(0(?:\.\d{1,3})?|1(?:\.0{1,3})?)$/u.exec(
    parameter.trim(),
  );
  return match === null ? undefined : Number(match[1]);
}

export function negotiateLocale(header: string | null): Locale {
  if (header === null) {
    return defaultLocale;
  }

  const preferences = header
    .split(",")
    .flatMap((entry, index) => {
      const [rawTag, ...parameters] = entry.trim().split(";");
      const quality = parseQuality(parameters[0]);
      if (rawTag === undefined || quality === undefined || quality === 0) {
        return [];
      }

      return [{ tag: rawTag.toLowerCase(), quality, index }];
    })
    .sort(
      (left, right) => right.quality - left.quality || left.index - right.index,
    );

  for (const { tag } of preferences) {
    if (tag === "fr-ca" || tag === "fr") {
      return "fr-CA";
    }
    if (tag === "en-ca" || tag === "en") {
      return "en-CA";
    }
  }

  return defaultLocale;
}

export function createLanguageAlternates(path: string): Record<Locale, string> {
  return Object.fromEntries(
    supportedLocales.map((locale) => [locale, localizePath(locale, path)]),
  ) as Record<Locale, string>;
}
