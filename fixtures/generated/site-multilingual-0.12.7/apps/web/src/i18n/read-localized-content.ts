import defaultCatalogSource from "../../content/en-CA/localized-content.yaml";
import frenchCatalogSource from "../../content/fr-CA/localized-content.yaml";

import { parseYamlContent } from "../content/content-schema";
import {
  assertTranslationParity,
  parseLocalizedCatalog,
  type LocalizedCatalog,
} from "./localized-content";
import type { Locale } from "./locale";

const rawCatalogs = {
  "en-CA": parseYamlContent(defaultCatalogSource),
  "fr-CA": parseYamlContent(frenchCatalogSource),
} as const;

const catalogs: Record<Locale, LocalizedCatalog> = {
  "en-CA": parseLocalizedCatalog(rawCatalogs["en-CA"], "en-CA"),
  "fr-CA": parseLocalizedCatalog(rawCatalogs["fr-CA"], "fr-CA"),
};

assertTranslationParity(catalogs["en-CA"], catalogs["fr-CA"]);

export function readLocalizedCatalog(locale: Locale): LocalizedCatalog {
  return catalogs[locale];
}
