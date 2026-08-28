import { describe, expect, it, vi } from "vitest";

import {
  createAnalyticsOperationalDeclarations,
  createAnalyticsProviderDeclarations,
  type AnalyticsPurposeIdentifier,
} from "../../src/integrations/analytics/analytics-provider-contract";
import {
  parseAnalyticsContent,
  readAnalyticsContent,
} from "../../src/integrations/analytics/analytics-content";
import {
  loadSelectedAnalytics,
  withdrawAnalyticsConsent,
} from "../../src/integrations/analytics/analytics-runtime";
import { analyticsSettings } from "../../src/integrations/analytics/analytics-settings";

function createTestBrowser(
  hostname = "app.example.com",
  cookies = "_ga=one; _ga_CONTAINER=two; _clck=three; _clsk=four; session=keep",
) {
  const scripts: Array<{ id: string }> = [];
  const cookieWrites: string[] = [];
  const storedValues = new Map<string, string>();
  const testWindow: Record<string, unknown> = {
    dataLayer: [],
    localStorage: {
      getItem: (key: string) => storedValues.get(key) ?? null,
      setItem: (key: string, value: string) => storedValues.set(key, value),
    },
    location: { hostname, reload: () => undefined },
  };
  const testDocument = {
    get cookie() {
      return cookies;
    },
    set cookie(value: string) {
      cookieWrites.push(value);
    },
    createElement: () => ({ id: "", dataset: {} }),
    getElementById: (identifier: string) =>
      scripts.find(({ id }) => id === identifier) ?? null,
    head: {
      append: (script: { id: string }) => scripts.push(script),
    },
  };
  const browser = {
    document: testDocument,
    window: testWindow,
  } as unknown as NonNullable<Parameters<typeof loadSelectedAnalytics>[1]>;

  return { browser, cookieWrites, scripts, storedValues, testWindow };
}

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

  it("initializes each selected runtime provider only once", () => {
    const { browser, scripts, testWindow } = createTestBrowser();

    loadSelectedAnalytics(analyticsSettings, browser);
    loadSelectedAnalytics(analyticsSettings, browser);

    expect(scripts).toHaveLength(
      createAnalyticsProviderDeclarations(analyticsSettings).length,
    );
    expect(
      (testWindow.dataLayer as unknown[][]).filter(
        ([command]) => command === "config",
      ),
    ).toHaveLength(1);
    expect(
      (
        testWindow.clarity as
          | { q?: unknown[][] }
          | undefined
      )?.q?.filter(
        ([command, consent]) =>
          command === "consentv2" &&
          (consent as { analytics_Storage?: string }).analytics_Storage ===
            "granted",
      ),
    ).toHaveLength(1);
  });

  it("loads each runtime provider independently", () => {
    const fixtures = [
      {
        identifier: "cloudflare-web-analytics",
        providers: {
          cloudflareWebAnalytics:
            analyticsSettings.providers.cloudflareWebAnalytics,
        },
      },
      {
        identifier: "google-analytics-4",
        providers: {
          googleAnalytics4: analyticsSettings.providers.googleAnalytics4,
        },
      },
      {
        identifier: "microsoft-clarity",
        providers: {
          microsoftClarity: analyticsSettings.providers.microsoftClarity,
        },
      },
    ] as const;

    for (const fixture of fixtures) {
      const settings = {
        consent: { policy: "explicit-opt-in" },
        providers: fixture.providers,
        operationalIntegrations: {},
      } as const;
      const { browser, scripts } = createTestBrowser();
      const declarations = createAnalyticsProviderDeclarations(settings);

      loadSelectedAnalytics(settings, browser);

      expect(declarations.map(({ identifier }) => identifier)).toEqual([
        fixture.identifier,
      ]);
      expect(scripts.map(({ id }) => id)).toEqual([
        declarations[0]?.scriptId,
      ]);
    }
  });

  it("withdraws consent across host-only and parent-domain analytics cookies", () => {
    const { browser, cookieWrites, storedValues, testWindow } = createTestBrowser();
    const reload = vi.fn();

    withdrawAnalyticsConsent(analyticsSettings, browser, reload);

    for (const cookieName of ["_ga", "_ga_CONTAINER", "_clck", "_clsk"]) {
      expect(cookieWrites).toContain(
        `${cookieName}=; Max-Age=0; Path=/; SameSite=Lax`,
      );
      expect(cookieWrites).toContain(
        `${cookieName}=; Max-Age=0; Path=/; Domain=app.example.com; SameSite=Lax`,
      );
      expect(cookieWrites).toContain(
        `${cookieName}=; Max-Age=0; Path=/; Domain=example.com; SameSite=Lax`,
      );
    }
    expect(cookieWrites.some((write) => write.includes("Domain=com"))).toBe(false);
    expect(cookieWrites.some((write) => write.startsWith("session="))).toBe(false);
    expect(testWindow.dataLayer).toContainEqual([
      "consent",
      "update",
      {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      },
    ]);
    expect(
      (testWindow.clarity as { q?: unknown[][] } | undefined)?.q,
    ).toEqual(
      expect.arrayContaining([
        [
          "consentv2",
          { ad_Storage: "denied", analytics_Storage: "denied" },
        ],
        ["consent", false],
      ]),
    );
    expect(storedValues.get("egeria.analytics.consent.v1")).toBe("denied");
    expect(reload).toHaveBeenCalledOnce();
  });
});
