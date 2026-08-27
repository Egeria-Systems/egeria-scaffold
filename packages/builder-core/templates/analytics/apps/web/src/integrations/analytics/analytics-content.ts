import englishAnalyticsContentSource from "../../../content/en-CA/analytics.yaml?raw";
import frenchAnalyticsContentSource from "../../../content/fr-CA/analytics.yaml?raw";

import {
  hasExactKeys,
  isNonEmptyString,
  isUnknownRecord,
  parseYamlContent,
} from "../../content/content-schema";

export type AnalyticsLocale = "en-CA" | "fr-CA";

export type AnalyticsContent = Readonly<{
  heading: string;
  summary: string;
  providersHeading: string;
  allowLabel: string;
  declineLabel: string;
  manageLabel: string;
  withdrawLabel: string;
  closeLabel: string;
  grantedStatus: string;
  deniedStatus: string;
  purposes: Readonly<{
    cloudflareWebAnalytics: string;
    googleAnalytics4: string;
    microsoftClarity: string;
  }>;
}>;

const contentKeys = [
  "heading",
  "summary",
  "providersHeading",
  "allowLabel",
  "declineLabel",
  "manageLabel",
  "withdrawLabel",
  "closeLabel",
  "grantedStatus",
  "deniedStatus",
  "purposes",
] as const;
const purposeKeys = [
  "cloudflareWebAnalytics",
  "googleAnalytics4",
  "microsoftClarity",
] as const;

export function parseAnalyticsContent(value: unknown): AnalyticsContent {
  if (!isUnknownRecord(value) || !hasExactKeys(value, contentKeys)) {
    throw new TypeError("CONTENT_INVALID");
  }
  if (
    !isNonEmptyString(value.heading) ||
    !isNonEmptyString(value.summary) ||
    !isNonEmptyString(value.providersHeading) ||
    !isNonEmptyString(value.allowLabel) ||
    !isNonEmptyString(value.declineLabel) ||
    !isNonEmptyString(value.manageLabel) ||
    !isNonEmptyString(value.withdrawLabel) ||
    !isNonEmptyString(value.closeLabel) ||
    !isNonEmptyString(value.grantedStatus) ||
    !isNonEmptyString(value.deniedStatus) ||
    !isUnknownRecord(value.purposes) ||
    !hasExactKeys(value.purposes, purposeKeys) ||
    !isNonEmptyString(value.purposes.cloudflareWebAnalytics) ||
    !isNonEmptyString(value.purposes.googleAnalytics4) ||
    !isNonEmptyString(value.purposes.microsoftClarity)
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
