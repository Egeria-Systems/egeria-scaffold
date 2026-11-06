import {
  hasExactKeys,
  isNonEmptyString,
  isUnknownRecord,
  parsePageContent,
  type PageSection,
} from "../content/content-schema";

export type RoutingContent = Readonly<{
  baseUrl: string;
}>;

export type RoutedPageContent = Readonly<{
  metadata: Readonly<{
    title: string;
    description: string;
  }>;
  sections: readonly PageSection[];
}>;

export function parseRoutingContent(value: unknown): RoutingContent {
  if (
    !isUnknownRecord(value) ||
    !hasExactKeys(value, ["baseUrl"]) ||
    !isNonEmptyString(value.baseUrl)
  ) {
    throw new TypeError("CONTENT_INVALID");
  }

  try {
    const baseUrl = new URL(value.baseUrl);
    if (
      baseUrl.protocol !== "https:" ||
      baseUrl.username.length > 0 ||
      baseUrl.password.length > 0 ||
      baseUrl.pathname !== "/" ||
      baseUrl.search.length > 0 ||
      baseUrl.hash.length > 0
    ) {
      throw new TypeError("CONTENT_INVALID");
    }

    return { baseUrl: baseUrl.toString() };
  } catch {
    throw new TypeError("CONTENT_INVALID");
  }
}

export function parseRoutedPageContent(value: unknown): RoutedPageContent {
  if (
    !isUnknownRecord(value) ||
    !hasExactKeys(value, ["metadata", "sections"]) ||
    !isUnknownRecord(value.metadata) ||
    !hasExactKeys(value.metadata, ["title", "description"]) ||
    !isNonEmptyString(value.metadata.title) ||
    !isNonEmptyString(value.metadata.description)
  ) {
    throw new TypeError("CONTENT_INVALID");
  }

  const page = parsePageContent({ sections: value.sections });
  return {
    metadata: {
      title: value.metadata.title,
      description: value.metadata.description,
    },
    sections: page.sections,
  };
}
