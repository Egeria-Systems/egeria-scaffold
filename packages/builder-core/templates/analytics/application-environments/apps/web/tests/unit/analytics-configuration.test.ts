import { afterEach, describe, expect, it, vi } from "vitest";

import {
  googleAnalyticsCookiePrefix,
  readCompiledAnalyticsConfiguration,
  resolveAnalyticsConfiguration,
  type AnalyticsConfigurationInput,
} from "../../src/integrations/analytics/analytics-configuration";
import type { AnalyticsSettings } from "../../src/integrations/analytics/analytics-provider-contract";

const settings: AnalyticsSettings = {
  consent: { policy: "explicit-opt-in" },
  providers: {
    cloudflareWebAnalytics: true,
    googleAnalytics4: true,
    microsoftClarity: { audience: "not-directed-to-minors" },
  },
  operationalIntegrations: {},
};
const input: AnalyticsConfigurationInput = {
  enabled: "true",
  cloudflareToken: "0123456789abcdef0123456789abcdef",
  googleMeasurementId: "G-TEST123456",
  clarityProjectId: "qatest1234",
  googleSiteVerification: undefined,
  siteUrl: "https://qa.analytics-test.invalid",
};
afterEach(() => vi.unstubAllEnvs());

describe("analytics build configuration", () => {
  it.each([undefined, "", "false", "TRUE", "1", " true ", true, false, 1, null])(
    "keeps collection off for the raw flag %s", enabled => {
      const result = resolveAnalyticsConfiguration(settings, { ...input, enabled }, "development");
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("expected a usable disabled configuration");
      expect(result.configuration.collectionEnabled).toBe(false);
    },
  );

  it("allows the exact flag only when every selected runtime input is available", () => {
    const result = resolveAnalyticsConfiguration(settings, input, "staging");
    expect(result).toEqual({ ok: true, configuration: {
      collectionEnabled: true, collectionAvailable: true, applicationEnvironment: "staging",
      cloudflareToken: "0123456789abcdef0123456789abcdef", googleMeasurementId: "G-TEST123456",
      clarityProjectId: "qatest1234", siteOrigin: "https://qa.analytics-test.invalid",
      googleSiteVerification: undefined, missingFields: [],
    } });
  });

  it.each([
    ["cloudflareToken", "NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN"],
    ["googleMeasurementId", "NEXT_PUBLIC_GA4_MEASUREMENT_ID"],
    ["clarityProjectId", "NEXT_PUBLIC_CLARITY_PROJECT_ID"],
    ["siteUrl", "NEXT_PUBLIC_SITE_URL"],
  ] as const)("keeps the entire local collection set off when %s is absent", (key, field) => {
    const result = resolveAnalyticsConfiguration(settings, { ...input, [key]: undefined }, "development");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected a usable local configuration");
    expect(result.configuration.collectionEnabled).toBe(true);
    expect(result.configuration.collectionAvailable).toBe(false);
    expect(result.configuration.missingFields).toEqual([field]);
    for (const target of ["staging", "production"] as const) {
      expect(resolveAnalyticsConfiguration(settings, { ...input, [key]: "" }, target)).toEqual({ ok: false, issue: { field, reason: "missing" } });
      expect(resolveAnalyticsConfiguration(settings, { ...input, [key]: "", enabled: "false" }, target).ok).toBe(true);
    }
  });

  it("keeps absent identifiers harmless in disabled builds", () => {
    const result = resolveAnalyticsConfiguration(settings, {
      enabled: undefined, cloudflareToken: undefined, googleMeasurementId: "", clarityProjectId: undefined,
      googleSiteVerification: undefined, siteUrl: undefined,
    }, "development");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected a usable disabled configuration");
    expect(result.configuration.collectionEnabled).toBe(false);
    expect(result.configuration.collectionAvailable).toBe(false);
    expect(result.configuration.missingFields).toEqual([
      "NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN", "NEXT_PUBLIC_GA4_MEASUREMENT_ID", "NEXT_PUBLIC_CLARITY_PROJECT_ID", "NEXT_PUBLIC_SITE_URL",
    ]);
  });

  it.each([
    ["cloudflareToken", "NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN"],
    ["googleMeasurementId", "NEXT_PUBLIC_GA4_MEASUREMENT_ID"],
    ["clarityProjectId", "NEXT_PUBLIC_CLARITY_PROJECT_ID"],
  ] as const)("rejects malformed selected %s even while off without returning values", (key, field) => {
    for (const value of ["private-invalid-sentinel", " ", null, 42, {}]) {
      const result = resolveAnalyticsConfiguration(settings, { ...input, [key]: value, enabled: "false" }, "development");
      expect(result).toEqual({ ok: false, issue: { field, reason: "invalid" } });
      expect(JSON.stringify(result)).not.toContain("private-invalid-sentinel");
    }
  });

  it("ignores unselected provider inputs without materializing them", () => {
    const result = resolveAnalyticsConfiguration({ consent: settings.consent, providers: { googleAnalytics4: true }, operationalIntegrations: {} }, {
      ...input, cloudflareToken: "private-invalid-sentinel", clarityProjectId: null,
      googleSiteVerification: "bad", siteUrl: "invalid",
    }, "production");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected the selected GA4 configuration");
    expect(result.configuration.collectionAvailable).toBe(true);
    expect(result.configuration.cloudflareToken).toBeUndefined();
    expect(result.configuration.clarityProjectId).toBeUndefined();
    expect(result.configuration.siteOrigin).toBeUndefined();
    expect(result.configuration.googleSiteVerification).toBeUndefined();
  });

  it("requires selected Search verification in production independently of collection", () => {
    const searchOnly: AnalyticsSettings = { consent: settings.consent, providers: {}, operationalIntegrations: { googleSearchConsole: true } };
    expect(resolveAnalyticsConfiguration(searchOnly, { ...input, enabled: "false" }, "production")).toEqual({ ok: false, issue: { field: "NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION", reason: "missing" } });
    for (const target of ["development", "staging", "production"] as const) {
      const result = resolveAnalyticsConfiguration(searchOnly, { ...input, enabled: "false", googleSiteVerification: "synthetic-verification-token" }, target);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("expected Search configuration");
      expect(result.configuration.googleSiteVerification).toBe(target === "production" ? "synthetic-verification-token" : undefined);
      expect(result.configuration.cloudflareToken).toBeUndefined();
      expect(resolveAnalyticsConfiguration(searchOnly, { ...input, googleSiteVerification: "bad" }, target)).toEqual({ ok: false, issue: { field: "NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION", reason: "invalid" } });
    }
  });

  it.each(["http://localhost:3000", "http://127.0.0.1:3101", "http://[::1]:3101", "https://qa.analytics-test.invalid/"])("accepts development origin %s", siteUrl => {
    const result = resolveAnalyticsConfiguration(settings, { ...input, siteUrl }, "development");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected a valid origin");
    expect(result.configuration.siteOrigin).toBe(new URL(siteUrl).origin);
  });

  it.each(["http://qa.analytics-test.invalid", "https://user:password@qa.analytics-test.invalid", "https://qa.analytics-test.invalid/path", "https://qa.analytics-test.invalid?", "https://qa.analytics-test.invalid#", " https://qa.analytics-test.invalid", null])("refuses unsafe origin %s while disabled", siteUrl => {
    expect(resolveAnalyticsConfiguration(settings, { ...input, enabled: "false", siteUrl }, "development")).toEqual({ ok: false, issue: { field: "NEXT_PUBLIC_SITE_URL", reason: "invalid" } });
  });

  it("requires HTTPS on release targets", () => {
    for (const target of ["staging", "production"] as const) {
      expect(resolveAnalyticsConfiguration(settings, { ...input, siteUrl: "http://localhost:3000" }, target)).toEqual({ ok: false, issue: { field: "NEXT_PUBLIC_SITE_URL", reason: "invalid" } });
    }
  });

  it("uses only the compiled target and statically named public fields", () => {
    vi.stubEnv("NEXT_PUBLIC_APPLICATION_ENVIRONMENT", "staging");
    vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN", "0123456789abcdef0123456789abcdef");
    vi.stubEnv("NEXT_PUBLIC_GA4_MEASUREMENT_ID", "G-TEST123456");
    vi.stubEnv("NEXT_PUBLIC_CLARITY_PROJECT_ID", "qatest1234");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://qa.analytics-test.invalid");
    expect(readCompiledAnalyticsConfiguration(settings)).toEqual(resolveAnalyticsConfiguration(settings, input, "staging"));
    vi.stubEnv("NEXT_PUBLIC_APPLICATION_ENVIRONMENT", "private-invalid-sentinel");
    expect(readCompiledAnalyticsConfiguration(settings)).toEqual({ ok: false, issue: { field: "APPLICATION_ENVIRONMENT", reason: "invalid" } });
  });

  it("separates production cookies from the shared nonproduction installation", () => {
    expect(googleAnalyticsCookiePrefix("development")).toBe("egeria_nonproduction");
    expect(googleAnalyticsCookiePrefix("staging")).toBe("egeria_nonproduction");
    expect(googleAnalyticsCookiePrefix("production")).toBe("egeria_production");
  });
});
