import type { MetadataRoute } from "next";

import { localizedRoutes } from "../src/i18n/localized-content";
import { localizePath, supportedLocales } from "../src/i18n/locale";
import { readLocalizedCatalog } from "../src/i18n/read-localized-content";
import { readRoutingContent } from "../src/routing/read-routing-content";

export default function sitemap(): MetadataRoute.Sitemap {
  const { baseUrl } = readRoutingContent();

  return supportedLocales.flatMap((locale) => {
    readLocalizedCatalog(locale);
    return localizedRoutes.map(({ segments }) => {
      const path = segments.length === 0 ? "/" : `/${segments.join("/")}`;
      return {
        url: new URL(localizePath(locale, path), baseUrl).toString(),
        alternates: {
          languages: Object.fromEntries(
            supportedLocales.map((alternateLocale) => [
              alternateLocale,
              new URL(localizePath(alternateLocale, path), baseUrl).toString(),
            ]),
          ),
        },
        changeFrequency: "monthly" as const,
        priority: segments.length === 0 ? 1 : 0.8,
      };
    });
  });
}
