import { parseDocument } from "yaml";

export type NavigationItem = Readonly<{
  href: string;
  label: string;
}>;

export type ContentConfiguration = Readonly<{
  schemaVersion: "1.0.0";
  defaultLocale: "en-CA";
  locales: readonly ["en-CA"];
}>;

export type LongFormDocument = Readonly<{
  frontMatter: Readonly<{
    title: string;
    summary: string;
  }>;
  body: string;
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

function hasDisallowedControlCharacter(value: string): boolean {
  for (const character of value) {
    const codeUnit = character.charCodeAt(0);

    if (
      codeUnit <= 0x08 ||
      codeUnit === 0x0b ||
      codeUnit === 0x0c ||
      (codeUnit >= 0x0e && codeUnit <= 0x1f) ||
      codeUnit === 0x7f
    ) {
      return true;
    }
  }

  return false;
}

export function parseYamlContent(source: string): unknown {
  try {
    const document = parseDocument(source, {
      version: "1.2",
      schema: "core",
      resolveKnownTags: false,
      strict: true,
      stringKeys: true,
      uniqueKeys: true,
    });

    if (document.errors.length > 0 || document.warnings.length > 0) {
      throw new TypeError("CONTENT_INVALID");
    }

    return document.toJS({ maxAliasCount: 0, mapAsMap: false }) as unknown;
  } catch {
    throw new TypeError("CONTENT_INVALID");
  }
}

export function parseContentConfiguration(
  value: unknown,
): ContentConfiguration {
  if (
    !isUnknownRecord(value) ||
    !hasExactKeys(value, ["schemaVersion", "defaultLocale", "locales"]) ||
    value.schemaVersion !== "1.0.0" ||
    value.defaultLocale !== "en-CA" ||
    !Array.isArray(value.locales) ||
    value.locales.length !== 1 ||
    value.locales[0] !== "en-CA"
  ) {
    throw new TypeError("CONTENT_INVALID");
  }

  return {
    schemaVersion: "1.0.0",
    defaultLocale: "en-CA",
    locales: ["en-CA"],
  };
}

export function parseMarkdownContent(source: string): LongFormDocument {
  const normalizedSource = source
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n");

  if (hasDisallowedControlCharacter(normalizedSource)) {
    throw new TypeError("CONTENT_INVALID");
  }

  const lines = normalizedSource.split("\n");
  const closingDelimiterIndex = lines.indexOf("---", 1);

  if (lines[0] !== "---" || closingDelimiterIndex < 2) {
    throw new TypeError("CONTENT_INVALID");
  }

  const frontMatterValue = parseYamlContent(
    `${lines.slice(1, closingDelimiterIndex).join("\n")}\n`,
  );
  const body = lines.slice(closingDelimiterIndex + 1).join("\n").trim();

  if (
    !isUnknownRecord(frontMatterValue) ||
    !hasExactKeys(frontMatterValue, ["title", "summary"]) ||
    !isNonEmptyString(frontMatterValue.title) ||
    !isNonEmptyString(frontMatterValue.summary) ||
    body.length === 0
  ) {
    throw new TypeError("CONTENT_INVALID");
  }

  return {
    frontMatter: {
      title: frontMatterValue.title,
      summary: frontMatterValue.summary,
    },
    body,
  };
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
