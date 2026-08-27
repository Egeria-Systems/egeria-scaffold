import {
  hasExactKeys,
  isNonEmptyString,
  isUnknownRecord,
  parsePageContent,
  type NavigationItem,
  type PageSection,
} from "../content/content-schema";
import { localizedRedirects, localizedRoutes } from "./localized-profile";
import { isLocale, localizePath, supportedLocales, type Locale } from "./locale";

export type LocalizedPageContent = Readonly<{
  metadata: Readonly<{ title: string; description: string }>;
  sections: readonly PageSection[];
}>;

export type LocalizedBookingContent = Readonly<{
  heading: string;
  summary: string;
  linkLabel: string;
  frameTitle: string;
  popupHeading: string;
  closeLabel: string;
}>;

export type LocalizedErrorContent = Readonly<{
  heading: string;
  summary: string;
  retryLabel: string;
}>;

export type LocalizedCatalog = Readonly<{
  metadata: Readonly<{ title: string; description: string }>;
  accessibility: Readonly<{
    skipToContent: string;
    navigationLabel: string;
  }>;
  navigation: readonly NavigationItem[];
  localeSwitch: Readonly<{ label: string }>;
  pages: Readonly<Record<string, LocalizedPageContent>>;
  notFound: LocalizedPageContent;
  booking: LocalizedBookingContent;
  error: LocalizedErrorContent;
}>;

export type LocalizedRoute =
  | Readonly<{ kind: "page"; identifier: string; path: string }>
  | Readonly<{ kind: "redirect"; path: string }>
  | Readonly<{ kind: "not-found" }>;

const bookingKeys = [
  "heading",
  "summary",
  "linkLabel",
  "frameTitle",
  "popupHeading",
  "closeLabel",
] as const;

const errorKeys = ["heading", "summary", "retryLabel"] as const;

function contentInvalid(): never {
  throw new TypeError("CONTENT_INVALID");
}

function parseMetadata(value: unknown): LocalizedPageContent["metadata"] {
  if (
    !isUnknownRecord(value) ||
    !hasExactKeys(value, ["title", "description"]) ||
    !isNonEmptyString(value.title) ||
    !isNonEmptyString(value.description)
  ) {
    return contentInvalid();
  }
  return { title: value.title, description: value.description };
}

function parseLocalizedPage(value: unknown): LocalizedPageContent {
  if (!isUnknownRecord(value) || !hasExactKeys(value, ["metadata", "sections"])) {
    return contentInvalid();
  }
  return {
    metadata: parseMetadata(value.metadata),
    sections: parsePageContent({ sections: value.sections }).sections,
  };
}

function routePath(locale: Locale, segments: readonly string[]): string {
  const suffix = segments.length === 0 ? "/" : `/${segments.join("/")}`;
  return localizePath(locale, suffix);
}

function parseNavigation(
  value: unknown,
  locale: Locale,
): readonly NavigationItem[] {
  if (!Array.isArray(value)) {
    return contentInvalid();
  }

  const declaredPaths = new Set(
    localizedRoutes.map(({ segments }) => routePath(locale, segments)),
  );

  return value.map((item) => {
    if (
      !isUnknownRecord(item) ||
      !hasExactKeys(item, ["href", "label"]) ||
      !isNonEmptyString(item.href) ||
      !isNonEmptyString(item.label) ||
      !item.href.startsWith("/") ||
      item.href.startsWith("//") ||
      !declaredPaths.has(item.href)
    ) {
      return contentInvalid();
    }
    return { href: item.href, label: item.label };
  });
}

function parseLocaleSwitch(value: unknown): LocalizedCatalog["localeSwitch"] {
  if (
    !isUnknownRecord(value) ||
    !hasExactKeys(value, ["label"]) ||
    !isNonEmptyString(value.label)
  ) {
    return contentInvalid();
  }
  return { label: value.label };
}

function parseBooking(value: unknown): LocalizedBookingContent {
  if (!isUnknownRecord(value) || !hasExactKeys(value, bookingKeys)) {
    return contentInvalid();
  }
  for (const key of bookingKeys) {
    if (!isNonEmptyString(value[key])) {
      return contentInvalid();
    }
  }
  return Object.fromEntries(
    bookingKeys.map((key) => [key, value[key]]),
  ) as LocalizedBookingContent;
}

function parseError(value: unknown): LocalizedErrorContent {
  if (!isUnknownRecord(value) || !hasExactKeys(value, errorKeys)) {
    return contentInvalid();
  }
  for (const key of errorKeys) {
    if (!isNonEmptyString(value[key])) {
      return contentInvalid();
    }
  }
  return Object.fromEntries(
    errorKeys.map((key) => [key, value[key]]),
  ) as LocalizedErrorContent;
}

function unlocalizePath(path: string): string {
  for (const locale of supportedLocales) {
    const prefix = `/${locale}`;
    if (path === prefix) return "/";
    if (path.startsWith(`${prefix}/`)) return path.slice(prefix.length);
  }
  return path;
}

function sectionStructure(section: PageSection): unknown {
  const base = {
    id: section.id,
    type: section.type,
    variant: section.variant,
    enabled: section.enabled,
  };
  if (section.type === "project-list") {
    return {
      ...base,
      destinations: section.content.projects.map(({ href }) => href),
    };
  }
  if (section.type === "call-to-action") {
    return { ...base, destination: section.content.href };
  }
  return base;
}

function pageStructure(page: LocalizedPageContent): unknown {
  return page.sections.map(sectionStructure);
}

function translationStructure(catalog: LocalizedCatalog): unknown {
  return {
    navigation: catalog.navigation.map(({ href }) => unlocalizePath(href)),
    pages: Object.fromEntries(
      localizedRoutes.map(({ identifier }) => {
        const page = catalog.pages[identifier];
        if (page === undefined) return contentInvalid();
        return [identifier, pageStructure(page)];
      }),
    ),
    notFound: pageStructure(catalog.notFound),
  };
}

export function assertTranslationParity(
  reference: LocalizedCatalog,
  candidate: LocalizedCatalog,
): void {
  if (
    JSON.stringify(translationStructure(reference)) !==
    JSON.stringify(translationStructure(candidate))
  ) {
    contentInvalid();
  }
}

export function parseLocalizedCatalog(
  value: unknown,
  locale: Locale,
): LocalizedCatalog {
  if (
    !isUnknownRecord(value) ||
    !hasExactKeys(value, [
      "metadata",
      "accessibility",
      "navigation",
      "localeSwitch",
      "pages",
      "notFound",
      "booking",
      "error",
    ]) ||
    !isUnknownRecord(value.accessibility) ||
    !hasExactKeys(value.accessibility, ["skipToContent", "navigationLabel"]) ||
    !isNonEmptyString(value.accessibility.skipToContent) ||
    !isNonEmptyString(value.accessibility.navigationLabel) ||
    !isUnknownRecord(value.pages) ||
    !hasExactKeys(
      value.pages,
      localizedRoutes.map(({ identifier }) => identifier),
    )
  ) {
    return contentInvalid();
  }
  const pages = value.pages;

  return {
    metadata: parseMetadata(value.metadata),
    accessibility: {
      skipToContent: value.accessibility.skipToContent,
      navigationLabel: value.accessibility.navigationLabel,
    },
    navigation: parseNavigation(value.navigation, locale),
    localeSwitch: parseLocaleSwitch(value.localeSwitch),
    pages: Object.fromEntries(
      localizedRoutes.map(({ identifier }) => [
        identifier,
        parseLocalizedPage(pages[identifier]),
      ]),
    ),
    notFound: parseLocalizedPage(value.notFound),
    booking: parseBooking(value.booking),
    error: parseError(value.error),
  };
}

function sameSegments(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function resolveLocalizedRoute(
  locale: Locale,
  segments: readonly string[],
): LocalizedRoute {
  const route = localizedRoutes.find((candidate) =>
    sameSegments(candidate.segments, segments),
  );
  if (route !== undefined) {
    return { kind: "page", identifier: route.identifier, path: routePath(locale, route.segments) };
  }

  const redirect = localizedRedirects.find((candidate) =>
    sameSegments(candidate.segments, segments),
  );
  if (redirect !== undefined) {
    return {
      kind: "redirect",
      path: localizePath(locale, `/${redirect.destinationSegments.join("/")}`),
    };
  }

  return { kind: "not-found" };
}

export function localeFromHeader(value: string | null): Locale {
  return value !== null && isLocale(value) ? value : "en-CA";
}

export { localizedRoutes };
