import { describe, expect, it } from "vitest";

import {
  createAnalyticsOperationalDeclarations,
  createAnalyticsProviderDeclarations,
  type AnalyticsPurposeIdentifier,
} from "../../src/integrations/analytics/analytics-provider-contract";
import {
  parseAnalyticsContent,
  readAnalyticsContent,
} from "../../src/integrations/analytics/analytics-content";
import { analyticsSettings } from "../../src/integrations/analytics/analytics-settings";

describe("analytics provider contract", () => {
  it("declares the exact non-advertising GA4 CSP sources only when selected", () => {
    const googleAnalytics4Only = createAnalyticsProviderDeclarations({
      consent: { policy: "explicit-opt-in" },
      providers: { googleAnalytics4: { measurementId: "G-TEST123456" } },
      operationalIntegrations: {},
    });
    const declaration = googleAnalytics4Only[0] as
      | (typeof googleAnalytics4Only)[number] & {
          imageSources?: readonly string[];
        }
      | undefined;

    expect(googleAnalytics4Only.map(({ identifier }) => identifier)).toEqual([
      "google-analytics-4",
    ]);
    expect(declaration?.scriptSource).toBe(
      "https://www.googletagmanager.com/gtag/js",
    );
    expect(declaration?.imageSources).toEqual([
      "https://*.google-analytics.com",
      "https://www.googletagmanager.com",
    ]);
    expect(declaration?.connectSources).toEqual([
      "https://*.google-analytics.com",
      "https://*.analytics.google.com",
      "https://www.googletagmanager.com",
    ]);

    const declaredSources = [
      declaration?.scriptSource,
      ...(declaration?.imageSources ?? []),
      ...(declaration?.connectSources ?? []),
    ].join(" ");
    expect(declaredSources).not.toMatch(
      /doubleclick\.net|googleadservices\.com|googlesyndication\.com|https:\/\/\*\.google\./u,
    );

    const cloudflareOnly = createAnalyticsProviderDeclarations({
      consent: { policy: "explicit-opt-in" },
      providers: { cloudflareWebAnalytics: { siteToken: "test-token" } },
      operationalIntegrations: {},
    });
    expect(cloudflareOnly.map(({ identifier }) => identifier)).toEqual([
      "cloudflare-web-analytics",
    ]);
    expect(JSON.stringify(cloudflareOnly)).not.toMatch(/google/iu);
  });

  it("declares bounded GA4 default data classes only when GA4 is selected", () => {
    const googleAnalytics4Only = createAnalyticsProviderDeclarations({
      consent: { policy: "explicit-opt-in" },
      providers: { googleAnalytics4: { measurementId: "G-TEST123456" } },
      operationalIntegrations: {},
    });

    expect(googleAnalytics4Only[0]?.dataClasses).toEqual([
      "audience",
      "device",
      "navigation",
      "session-statistics",
      "approximate-geolocation",
      "pseudonymous-client-and-session-identifiers",
    ]);
    expect(googleAnalytics4Only[0]?.dataClasses.join(" ")).not.toMatch(
      /advertis|ad-personalization/iu,
    );

    const clarityOnly = createAnalyticsProviderDeclarations({
      consent: { policy: "explicit-opt-in" },
      providers: {
        microsoftClarity: {
          projectId: "clarity-test",
          audience: "not-directed-to-minors",
        },
      },
      operationalIntegrations: {},
    });
    expect(clarityOnly.map(({ identifier }) => identifier)).toEqual([
      "microsoft-clarity",
    ]);
    expect(clarityOnly[0]?.dataClasses).not.toEqual(
      googleAnalytics4Only[0]?.dataClasses,
    );
    expect(JSON.stringify(clarityOnly)).not.toMatch(
      /session-statistics|approximate-geolocation|pseudonymous-client-and-session-identifiers/u,
    );
  });

  it("declares bounded Clarity capture classes only when Clarity is selected", () => {
    const clarityOnly = createAnalyticsProviderDeclarations({
      consent: { policy: "explicit-opt-in" },
      providers: {
        microsoftClarity: {
          projectId: "clarity-test",
          audience: "not-directed-to-minors",
        },
      },
      operationalIntegrations: {},
    });

    expect(clarityOnly[0]?.dataClasses).toEqual([
      "interaction",
      "navigation",
      "session",
      "session-replay-dom-mutations-content-and-layout",
      "diagnostics-and-performance",
      "page-metadata-and-dimensions",
      "pseudonymous-envelope-user-and-session-identifiers",
    ]);

    const googleAnalytics4Only = createAnalyticsProviderDeclarations({
      consent: { policy: "explicit-opt-in" },
      providers: { googleAnalytics4: { measurementId: "G-TEST123456" } },
      operationalIntegrations: {},
    });
    expect(googleAnalytics4Only.map(({ identifier }) => identifier)).toEqual([
      "google-analytics-4",
    ]);
    expect(JSON.stringify(googleAnalytics4Only)).not.toMatch(
      /session-replay-dom-mutations-content-and-layout|diagnostics-and-performance|page-metadata-and-dimensions|pseudonymous-envelope-user-and-session-identifiers/u,
    );
  });

  it("declares each selected runtime provider once with its fixed purpose", () => {
    const declarations = createAnalyticsProviderDeclarations(analyticsSettings);
    const expectedProviderPurposes = [
      {
        identifier: "cloudflare-web-analytics",
        purpose: "aggregate-traffic-and-performance",
      },
      {
        identifier: "google-analytics-4",
        purpose: "audience-measurement",
      },
      {
        identifier: "microsoft-clarity",
        purpose: "consented-experience-analysis",
      },
    ] as const satisfies readonly Readonly<{
      identifier: (typeof declarations)[number]["identifier"];
      purpose: AnalyticsPurposeIdentifier;
    }>[];

    expect(new Set(declarations.map(({ identifier }) => identifier)).size).toBe(
      declarations.length,
    );
    expect(new Set(declarations.map(({ scriptId }) => scriptId)).size).toBe(
      declarations.length,
    );
    expect(
      declarations.map(({ identifier, purpose }) => ({ identifier, purpose })),
    ).toEqual(
      expectedProviderPurposes,
    );
    expect(declarations.every(({ retention }) => retention === "provider-controlled")).toBe(true);
  });

  it("declares executable cookie cleanup rules separately from disclosure copy", () => {
    const declarations = createAnalyticsProviderDeclarations(analyticsSettings);

    expect(
      declarations.map(({ identifier, cookieCleanupRules }) => ({
        identifier,
        cookieCleanupRules,
      })),
    ).toEqual([
      {
        identifier: "cloudflare-web-analytics",
        cookieCleanupRules: [],
      },
      {
        identifier: "google-analytics-4",
        cookieCleanupRules: [
          { match: "exact", value: "_ga" },
          { match: "prefix", value: "_ga_" },
        ],
      },
      {
        identifier: "microsoft-clarity",
        cookieCleanupRules: [
          { match: "exact", value: "_clck" },
          { match: "exact", value: "_clsk" },
        ],
      },
    ]);
    expect(declarations[1]?.cookies).toEqual(["_ga", "_ga_<container-id>"]);
  });

  it("keeps operational integrations out of runtime provider loading", () => {
    const declarations = createAnalyticsOperationalDeclarations(analyticsSettings);

    expect(declarations.every(({ runtimeCode }) => runtimeCode === false)).toBe(true);
    expect(declarations.map(({ identifier }) => identifier)).toEqual([
      ...(analyticsSettings.operationalIntegrations.googleSearchConsole === undefined
        ? []
        : ["google-search-console"]),
      ...(analyticsSettings.operationalIntegrations.lookerStudio === undefined
        ? []
        : ["looker-studio"]),
    ]);
  });

  it("loads exact localized consent content and rejects extra keys", () => {
    const english = readAnalyticsContent("en-CA");
    const french = readAnalyticsContent("fr-CA");

    expect(english.allowLabel).not.toBe(french.allowLabel);
    expect(() => parseAnalyticsContent({ ...english, extra: true })).toThrow(
      "CONTENT_INVALID",
    );
  });

});
