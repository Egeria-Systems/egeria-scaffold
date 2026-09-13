import englishAnalyticsContentSource from "../../../content/en-CA/analytics.yaml?raw";
import frenchAnalyticsContentSource from "../../../content/fr-CA/analytics.yaml?raw";

import {
  hasExactKeys,
  isNonEmptyString,
  isUnknownRecord,
  parseYamlContent,
} from "../../content/content-schema";
import type {
  AnalyticsProviderIdentifier,
  AnalyticsPurposeIdentifier,
} from "./analytics-provider-contract";

export type AnalyticsLocale = "en-CA" | "fr-CA";

export type AnalyticsPurposeContent = Readonly<{
  label: string;
  description: string;
}>;

export type AnalyticsProviderContent = Readonly<{
  name: string;
  dataSummary: string;
  storageSummary: string;
  retentionSummary: string;
}>;

export type AnalyticsContent = Readonly<{
  heading: string;
  summary: string;
  allowAllLabel: string;
  rejectAllLabel: string;
  choosePurposesLabel: string;
  saveSelectionLabel: string;
  manageChoicesLabel: string;
  closeLabel: string;
  turnOffLabel: string;
  purposesLegend: string;
  updatedChoiceStatus: string;
  expiredChoiceStatus: string;
  sessionOnlyStatus: string;
  staleGrantRetainedStatus: string;
  purposes: Readonly<
    Record<AnalyticsPurposeIdentifier, AnalyticsPurposeContent>
  >;
  providers: Readonly<
    Record<AnalyticsProviderIdentifier, AnalyticsProviderContent>
  >;
}>;

const stringContentKeys = [
  "heading",
  "summary",
  "allowAllLabel",
  "rejectAllLabel",
  "choosePurposesLabel",
  "saveSelectionLabel",
  "manageChoicesLabel",
  "closeLabel",
  "turnOffLabel",
  "purposesLegend",
  "updatedChoiceStatus",
  "expiredChoiceStatus",
  "sessionOnlyStatus",
  "staleGrantRetainedStatus",
] as const;
const contentKeys = [
  ...stringContentKeys,
  "purposes",
  "providers",
] as const;
const purposeKeys = [
  "aggregate-traffic-and-performance",
  "audience-measurement",
  "consented-experience-analysis",
] as const satisfies readonly AnalyticsPurposeIdentifier[];
const purposeContentKeys = ["label", "description"] as const;
const providerKeys = [
  "cloudflare-web-analytics",
  "google-analytics-4",
  "microsoft-clarity",
] as const satisfies readonly AnalyticsProviderIdentifier[];
const providerContentKeys = [
  "name",
  "dataSummary",
  "storageSummary",
  "retentionSummary",
] as const;

function hasNonEmptyStringValues(
  value: Readonly<Record<string, unknown>>,
  keys: readonly string[],
): boolean {
  return keys.every((key) => isNonEmptyString(value[key]));
}

function hasPurposeContent(value: unknown): boolean {
  return (
    isUnknownRecord(value) &&
    hasExactKeys(value, purposeContentKeys) &&
    hasNonEmptyStringValues(value, purposeContentKeys)
  );
}

function hasProviderContent(value: unknown): boolean {
  return (
    isUnknownRecord(value) &&
    hasExactKeys(value, providerContentKeys) &&
    hasNonEmptyStringValues(value, providerContentKeys)
  );
}

function hasExactContentEntries(
  value: unknown,
  keys: readonly string[],
  hasContent: (entry: unknown) => boolean,
): boolean {
  return (
    isUnknownRecord(value) &&
    hasExactKeys(value, keys) &&
    keys.every((key) => hasContent(value[key]))
  );
}

export function parseAnalyticsContent(value: unknown): AnalyticsContent {
  if (!isUnknownRecord(value) || !hasExactKeys(value, contentKeys)) {
    throw new TypeError("CONTENT_INVALID");
  }
  if (
    !hasNonEmptyStringValues(value, stringContentKeys) ||
    !hasExactContentEntries(value.purposes, purposeKeys, hasPurposeContent) ||
    !hasExactContentEntries(value.providers, providerKeys, hasProviderContent)
  ) {
    throw new TypeError("CONTENT_INVALID");
  }

  return value as AnalyticsContent;
}

const contentByLocale: Readonly<Record<AnalyticsLocale, string>> = {
  "en-CA": englishAnalyticsContentSource,
  "fr-CA": frenchAnalyticsContentSource,
};

export function readAnalyticsContent(locale: AnalyticsLocale): AnalyticsContent {
  return parseAnalyticsContent(parseYamlContent(contentByLocale[locale]));
}
