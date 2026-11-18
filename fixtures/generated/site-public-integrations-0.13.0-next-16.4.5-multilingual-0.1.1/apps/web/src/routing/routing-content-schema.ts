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
