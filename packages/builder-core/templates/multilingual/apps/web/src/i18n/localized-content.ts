import {
  hasExactKeys,
  isNonEmptyString,
  isUnknownRecord,
  parsePageContent,
  type NavigationItem,
  type PageSection,
} from "../content/content-schema";
import { localizedRedirects, localizedRoutes } from "./localized-profile";
import { isLocale, localizePath, type Locale } from "./locale";

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

export type LocalizedCatalog = Readonly<{
  metadata: Readonly<{ title: string; description: string }>;
  accessibility: Readonly<{
    skipToContent: string;
    navigationLabel: string;
  }>;
  navigation: readonly NavigationItem[];
  localeSwitch: Readonly<{ href: string; label: string }>;
  pages: Readonly<Record<string, LocalizedPageContent>>;
  notFound: LocalizedPageContent;
  booking: LocalizedBookingContent;
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

function parseNavigation(value: unknown): readonly NavigationItem[] {
  if (!Array.isArray(value)) {
    return contentInvalid();
  }

  return value.map((item) => {
    if (
      !isUnknownRecord(item) ||
      !hasExactKeys(item, ["href", "label"]) ||
      !isNonEmptyString(item.href) ||
      !isNonEmptyString(item.label) ||
      !item.href.startsWith("/") ||
      item.href.startsWith("//")
    ) {
      return contentInvalid();
    }
    return { href: item.href, label: item.label };
  });
}

function parseLocaleSwitch(value: unknown): LocalizedCatalog["localeSwitch"] {
  if (
    !isUnknownRecord(value) ||
    !hasExactKeys(value, ["href", "label"]) ||
    !isNonEmptyString(value.href) ||
    !isNonEmptyString(value.label) ||
    !value.href.startsWith("/") ||
    value.href.startsWith("//")
  ) {
    return contentInvalid();
  }
  return { href: value.href, label: value.label };
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

function collectShape(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectShape(item, `${path}[${index}]`));
  }
  if (isUnknownRecord(value)) {
    return Object.keys(value)
      .sort()
      .flatMap((key) => collectShape(value[key], path.length === 0 ? key : `${path}.${key}`));
  }
  return [`${path}:${typeof value}`];
}

export function assertTranslationParity(
  reference: unknown,
  candidate: unknown,
): void {
  const referenceShape = collectShape(reference);
  const candidateShape = collectShape(candidate);
  if (
    referenceShape.length !== candidateShape.length ||
    referenceShape.some((key, index) => key !== candidateShape[index])
  ) {
    contentInvalid();
  }
}

export function parseLocalizedCatalog(value: unknown): LocalizedCatalog {
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
    navigation: parseNavigation(value.navigation),
    localeSwitch: parseLocaleSwitch(value.localeSwitch),
    pages: Object.fromEntries(
      localizedRoutes.map(({ identifier }) => [
        identifier,
        parseLocalizedPage(pages[identifier]),
      ]),
    ),
    notFound: parseLocalizedPage(value.notFound),
    booking: parseBooking(value.booking),
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
    const suffix = route.segments.length === 0 ? "/" : `/${route.segments.join("/")}`;
    return { kind: "page", identifier: route.identifier, path: localizePath(locale, suffix) };
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
