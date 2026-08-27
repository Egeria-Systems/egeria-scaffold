import { describe, expect, it, vi } from "vitest";

import {
  createAnalyticsOperationalDeclarations,
  createAnalyticsProviderDeclarations,
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
  it("declares each selected runtime provider once with a unique purpose", () => {
    const declarations = createAnalyticsProviderDeclarations(analyticsSettings);
    const expectedPurposes = [
      "aggregate-traffic-and-performance",
      "audience-measurement",
      "consented-experience-analysis",
    ].filter((purpose) =>
      declarations.some((declaration) => declaration.purpose === purpose),
    );

    expect(new Set(declarations.map(({ identifier }) => identifier)).size).toBe(
      declarations.length,
    );
    expect(new Set(declarations.map(({ scriptId }) => scriptId)).size).toBe(
      declarations.length,
    );
    expect(new Set(declarations.map(({ purpose }) => purpose))).toEqual(
      new Set(expectedPurposes),
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
