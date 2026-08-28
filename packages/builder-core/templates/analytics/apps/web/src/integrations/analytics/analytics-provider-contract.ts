export type AnalyticsSettings = Readonly<{
  consent: Readonly<{ policy: "explicit-opt-in" }>;
  providers: Readonly<{
    cloudflareWebAnalytics?: Readonly<{ siteToken: string }>;
    googleAnalytics4?: Readonly<{ measurementId: string }>;
    microsoftClarity?: Readonly<{
      projectId: string;
      audience: "not-directed-to-minors";
    }>;
  }>;
  operationalIntegrations: Readonly<{
    googleSearchConsole?: Readonly<{ verificationToken: string }>;
    lookerStudio?: Readonly<{ connector: "google-analytics-4" }>;
  }>;
}>;

export type AnalyticsProviderIdentifier =
  | "cloudflare-web-analytics"
  | "google-analytics-4"
  | "microsoft-clarity";

export type AnalyticsPurposeIdentifier =
  | "aggregate-traffic-and-performance"
  | "audience-measurement"
  | "consented-experience-analysis";

export type AnalyticsCookieCleanupRule =
  | Readonly<{ match: "exact"; value: string }>
  | Readonly<{ match: "prefix"; value: string }>;

export type AnalyticsProviderDeclaration = Readonly<{
  identifier: AnalyticsProviderIdentifier;
  scriptId: string;
  purpose: AnalyticsPurposeIdentifier;
  scriptSource: string;
  imageSources: readonly string[];
  connectSources: readonly string[];
  browserStorage: readonly string[];
  cookies: readonly string[];
  cookieCleanupRules: readonly AnalyticsCookieCleanupRule[];
  dataClasses: readonly string[];
  retention: "provider-controlled";
}>;

export type AnalyticsOperationalDeclaration = Readonly<{
  identifier: "google-search-console" | "looker-studio";
  runtimeCode: false;
  purpose: "search-ownership-verification" | "analytics-reporting";
}>;

const providerDeclarations = {
  cloudflareWebAnalytics: {
    identifier: "cloudflare-web-analytics",
    scriptId: "analytics-cloudflare-web-analytics",
    purpose: "aggregate-traffic-and-performance",
    scriptSource: "https://static.cloudflareinsights.com/beacon.min.js",
    imageSources: [],
    connectSources: ["https://cloudflareinsights.com"],
    browserStorage: [],
    cookies: [],
    cookieCleanupRules: [],
    dataClasses: ["aggregate-traffic", "web-performance"],
    retention: "provider-controlled",
  },
  googleAnalytics4: {
    identifier: "google-analytics-4",
    scriptId: "analytics-google-analytics-4",
    purpose: "audience-measurement",
    scriptSource: "https://www.googletagmanager.com/gtag/js",
    imageSources: [
      "https://*.google-analytics.com",
      "https://www.googletagmanager.com",
    ],
    connectSources: [
      "https://*.google-analytics.com",
      "https://*.analytics.google.com",
      "https://www.googletagmanager.com",
    ],
    browserStorage: ["first-party-cookie"],
    cookies: ["_ga", "_ga_<container-id>"],
    cookieCleanupRules: [
      { match: "exact", value: "_ga" },
      { match: "prefix", value: "_ga_" },
    ],
    dataClasses: [
      "audience",
      "device",
      "navigation",
      "session-statistics",
      "approximate-geolocation",
      "pseudonymous-client-and-session-identifiers",
    ],
    retention: "provider-controlled",
  },
  microsoftClarity: {
    identifier: "microsoft-clarity",
    scriptId: "analytics-microsoft-clarity",
    purpose: "consented-experience-analysis",
    scriptSource: "https://www.clarity.ms/tag/",
    imageSources: [],
    connectSources: [
      "https://www.clarity.ms",
      "https://*.clarity.ms",
      "https://c.bing.com",
    ],
    browserStorage: ["first-party-cookie", "provider-controlled-storage"],
    cookies: ["_clck", "_clsk"],
    cookieCleanupRules: [
      { match: "exact", value: "_clck" },
      { match: "exact", value: "_clsk" },
    ],
    dataClasses: [
      "interaction",
      "navigation",
      "session",
      "session-replay-dom-mutations-content-and-layout",
      "diagnostics-and-performance",
      "page-metadata-and-dimensions",
      "pseudonymous-envelope-user-and-session-identifiers",
    ],
    retention: "provider-controlled",
  },
} as const satisfies Readonly<
  Record<keyof AnalyticsSettings["providers"], AnalyticsProviderDeclaration>
>;

export function createAnalyticsProviderDeclarations(
  settings: AnalyticsSettings,
): readonly AnalyticsProviderDeclaration[] {
  return [
    ...(settings.providers.cloudflareWebAnalytics === undefined
      ? []
      : [providerDeclarations.cloudflareWebAnalytics]),
    ...(settings.providers.googleAnalytics4 === undefined
      ? []
      : [providerDeclarations.googleAnalytics4]),
    ...(settings.providers.microsoftClarity === undefined
      ? []
      : [providerDeclarations.microsoftClarity]),
  ];
}

export function createAnalyticsOperationalDeclarations(
  settings: AnalyticsSettings,
): readonly AnalyticsOperationalDeclaration[] {
  return [
    ...(settings.operationalIntegrations.googleSearchConsole === undefined
      ? []
      : [
          {
            identifier: "google-search-console",
            runtimeCode: false,
            purpose: "search-ownership-verification",
          } as const,
        ]),
    ...(settings.operationalIntegrations.lookerStudio === undefined
      ? []
      : [
          {
            identifier: "looker-studio",
            runtimeCode: false,
            purpose: "analytics-reporting",
          } as const,
        ]),
  ];
}
