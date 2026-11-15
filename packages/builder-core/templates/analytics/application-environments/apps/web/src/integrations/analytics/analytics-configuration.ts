import {
  readCompiledApplicationEnvironment,
  type ApplicationEnvironment,
  type ApplicationEnvironmentIssue,
} from "../../configuration/application-environment.ts";
import type { AnalyticsSettings } from "./analytics-provider-contract.ts";

export type AnalyticsConfigurationField =
  | "NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN"
  | "NEXT_PUBLIC_GA4_MEASUREMENT_ID"
  | "NEXT_PUBLIC_CLARITY_PROJECT_ID"
  | "NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION"
  | "NEXT_PUBLIC_SITE_URL";
export type AnalyticsConfigurationIssue = Readonly<{
  field: AnalyticsConfigurationField;
  reason: "missing" | "invalid";
}>;
export type AnalyticsConfigurationInput = Readonly<{
  enabled: unknown;
  cloudflareToken: unknown;
  googleMeasurementId: unknown;
  clarityProjectId: unknown;
  googleSiteVerification: unknown;
  siteUrl: unknown;
}>;
export type AnalyticsConfiguration = Readonly<{
  collectionEnabled: boolean;
  collectionAvailable: boolean;
  applicationEnvironment: ApplicationEnvironment;
  cloudflareToken: string | undefined;
  googleMeasurementId: string | undefined;
  clarityProjectId: string | undefined;
  siteOrigin: string | undefined;
  googleSiteVerification: string | undefined;
  missingFields: readonly AnalyticsConfigurationField[];
}>;
export type AnalyticsConfigurationResult =
  | Readonly<{ ok: true; configuration: AnalyticsConfiguration }>
  | Readonly<{ ok: false; issue: AnalyticsConfigurationIssue }>;
export type CompiledAnalyticsConfigurationResult =
  | AnalyticsConfigurationResult
  | Readonly<{ ok: false; issue: ApplicationEnvironmentIssue }>;

export function resolveAnalyticsConfiguration(
  settings: AnalyticsSettings,
  input: AnalyticsConfigurationInput,
  target: ApplicationEnvironment,
): AnalyticsConfigurationResult {
  const collectionEnabled = input.enabled === "true";
  const activeRelease = collectionEnabled && target !== "development";
  const missingFields: AnalyticsConfigurationField[] = [];
  const destinations: {
    cloudflareToken: string | undefined;
    googleMeasurementId: string | undefined;
    clarityProjectId: string | undefined;
    googleSiteVerification: string | undefined;
  } = { cloudflareToken: undefined, googleMeasurementId: undefined, clarityProjectId: undefined, googleSiteVerification: undefined };
  const fields = [
    { key: "cloudflareToken", field: "NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN", selected: settings.providers.cloudflareWebAnalytics !== undefined, pattern: /^[a-fA-F0-9]{32}$/u },
    { key: "googleMeasurementId", field: "NEXT_PUBLIC_GA4_MEASUREMENT_ID", selected: settings.providers.googleAnalytics4 !== undefined, pattern: /^G-[A-Z0-9]{6,20}$/u },
    { key: "clarityProjectId", field: "NEXT_PUBLIC_CLARITY_PROJECT_ID", selected: settings.providers.microsoftClarity !== undefined, pattern: /^[a-z0-9]{8,32}$/u },
    { key: "googleSiteVerification", field: "NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION", selected: settings.operationalIntegrations.googleSearchConsole !== undefined, pattern: /^[A-Za-z0-9_-]{16,128}$/u },
  ] as const;
  for (const { key, field, selected, pattern } of fields) {
    if (!selected) continue;
    const value = input[key];
    const verification = key === "googleSiteVerification";
    if (value === undefined || value === "") {
      if (verification ? target === "production" : activeRelease) {
        return { ok: false, issue: { field, reason: "missing" } };
      }
      if (!verification) missingFields.push(field);
    } else if (typeof value !== "string" || !pattern.test(value)) {
      return { ok: false, issue: { field, reason: "invalid" } };
    } else if (!verification || target === "production") {
      destinations[key] = value;
    }
  }

  let siteOrigin: string | undefined;
  if (settings.providers.microsoftClarity !== undefined) {
    const value = input.siteUrl;
    const field = "NEXT_PUBLIC_SITE_URL";
    if (value === undefined || value === "") {
      if (activeRelease) return { ok: false, issue: { field, reason: "missing" } };
      missingFields.push(field);
    } else {
      try {
        if (typeof value !== "string" || value.trim() !== value || value.includes("?") || value.includes("#")) {
          return { ok: false, issue: { field, reason: "invalid" } };
        }
        const url = new URL(value);
        const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
        if (url.username !== "" || url.password !== "" || url.pathname !== "/" ||
          (url.protocol !== "https:" && !(target === "development" && loopback && url.protocol === "http:"))) {
          return { ok: false, issue: { field, reason: "invalid" } };
        }
        siteOrigin = url.origin;
      } catch {
        return { ok: false, issue: { field, reason: "invalid" } };
      }
    }
  }
  return { ok: true, configuration: {
    collectionEnabled, collectionAvailable: missingFields.length === 0,
    applicationEnvironment: target, ...destinations, siteOrigin, missingFields,
  } };
}

export function readCompiledAnalyticsConfiguration(settings: AnalyticsSettings): CompiledAnalyticsConfigurationResult {
  const target = readCompiledApplicationEnvironment();
  if (!target.ok) return target;
  return resolveAnalyticsConfiguration(settings, {
    enabled: process.env.NEXT_PUBLIC_ANALYTICS_ENABLED,
    cloudflareToken: process.env.NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN,
    googleMeasurementId: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID,
    clarityProjectId: process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID,
    googleSiteVerification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  }, target.value);
}

export function googleAnalyticsCookiePrefix(target: ApplicationEnvironment): "egeria_production" | "egeria_nonproduction" {
  return target === "production" ? "egeria_production" : "egeria_nonproduction";
}
