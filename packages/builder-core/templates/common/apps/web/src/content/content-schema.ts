export type NavigationItem = Readonly<{
  href: string;
  label: string;
}>;

export type PageContent = Readonly<{
  heading: string;
  summary: string;
}>;

export type SiteContent = Readonly<{
  metadata: Readonly<{
    title: string;
    description: string;
  }>;
  home: PageContent;
  navigation: readonly NavigationItem[];
}>;

function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = [...keys].sort();

  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every((key, index) => key === expectedKeys[index])
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function parsePageContent(value: unknown): PageContent {
  if (
    !isUnknownRecord(value) ||
    !hasExactKeys(value, ["heading", "summary"]) ||
    !isNonEmptyString(value.heading) ||
    !isNonEmptyString(value.summary)
  ) {
    throw new TypeError("CONTENT_INVALID");
  }

  return { heading: value.heading, summary: value.summary };
}

function parseNavigation(value: unknown): readonly NavigationItem[] {
  if (!Array.isArray(value)) {
    throw new TypeError("CONTENT_INVALID");
  }

  const navigation: NavigationItem[] = [];
  const hrefs = new Set<string>();

  for (const item of value) {
    if (
      !isUnknownRecord(item) ||
      !hasExactKeys(item, ["href", "label"]) ||
      !isNonEmptyString(item.href) ||
      !isNonEmptyString(item.label) ||
      hrefs.has(item.href)
    ) {
      throw new TypeError("CONTENT_INVALID");
    }

    hrefs.add(item.href);
    navigation.push({ href: item.href, label: item.label });
  }

  return navigation;
}

export function parseSiteContent(value: unknown): SiteContent {
  if (
    !isUnknownRecord(value) ||
    !hasExactKeys(value, ["metadata", "home", "navigation"]) ||
    !isUnknownRecord(value.metadata) ||
    !hasExactKeys(value.metadata, ["title", "description"]) ||
    !isNonEmptyString(value.metadata.title) ||
    !isNonEmptyString(value.metadata.description)
  ) {
    throw new TypeError("CONTENT_INVALID");
  }

  return {
    metadata: {
      title: value.metadata.title,
      description: value.metadata.description,
    },
    home: parsePageContent(value.home),
    navigation: parseNavigation(value.navigation),
  };
}
