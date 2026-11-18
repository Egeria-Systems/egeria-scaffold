import { describe, expect, it } from "vitest";

import {
  compareAnalyticsPurposeDecisions,
  createAnalyticsConsentContext,
  createAnalyticsConsentRecord as createRecord,
  createAnalyticsCollectionContext,
  parseAnalyticsConsentRecord as parseRecord,
  type AnalyticsCollectionContext,
  type AnalyticsConsentContextEntry,
  type AnalyticsConsentRecordV3,
  type AnalyticsPurposeDecision,
} from "../../src/integrations/analytics/analytics-consent-state";
import type {
  AnalyticsPurposeIdentifier,
  AnalyticsSettings,
} from "../../src/integrations/analytics/analytics-provider-contract";

const now = new Date("2026-08-27T12:00:00.000Z");
const expiresAt = "2027-02-23T12:00:00.000Z";

const providerSettings = {
  cloudflareWebAnalytics: true,
  googleAnalytics4: true,
  microsoftClarity: {
    audience: "not-directed-to-minors",
  },
} as const;

function createSettings(
  providers: AnalyticsSettings["providers"],
): AnalyticsSettings {
  return {
    consent: { policy: "explicit-opt-in" },
    providers,
    operationalIntegrations: {},
  };
}

const allProviderContext = [
  {
    provider: "cloudflare-web-analytics",
    purpose: "aggregate-traffic-and-performance",
  },
  {
    provider: "google-analytics-4",
    purpose: "audience-measurement",
  },
  {
    provider: "microsoft-clarity",
    purpose: "consented-experience-analysis",
  },
] as const satisfies readonly AnalyticsConsentContextEntry[];

const allGranted = [
  { purpose: "aggregate-traffic-and-performance", decision: "granted" },
  { purpose: "audience-measurement", decision: "granted" },
  { purpose: "consented-experience-analysis", decision: "granted" },
] as const satisfies readonly AnalyticsPurposeDecision[];

const allDenied = [
  { purpose: "aggregate-traffic-and-performance", decision: "denied" },
  { purpose: "audience-measurement", decision: "denied" },
  { purpose: "consented-experience-analysis", decision: "denied" },
] as const satisfies readonly AnalyticsPurposeDecision[];

const collectionContext: AnalyticsCollectionContext = {
  collectionEnabled: true,
  applicationEnvironment: "staging",
  siteOrigin: "https://qa.analytics-test.invalid",
  destinations: [
    { provider: "cloudflare-web-analytics", destination: "0123456789abcdef0123456789abcdef" },
    { provider: "google-analytics-4", destination: "G-TEST123456" },
    { provider: "microsoft-clarity", destination: "qatest1234" },
  ],
};
function collectionContextFor(context: readonly AnalyticsConsentContextEntry[]): AnalyticsCollectionContext {
  return { ...collectionContext,
    siteOrigin: context.some(entry => entry.provider === "microsoft-clarity") ? collectionContext.siteOrigin : null,
    destinations: collectionContext.destinations.filter(entry => context.some(selected => selected.provider === entry.provider)),
  };
}
function createAnalyticsConsentRecord(decisions: readonly AnalyticsPurposeDecision[], context: readonly AnalyticsConsentContextEntry[], date: Date) {
  return createRecord(decisions, context, collectionContextFor(context), date);
}
function parseAnalyticsConsentRecord(source: string | null, context: readonly AnalyticsConsentContextEntry[], date: Date) {
  return parseRecord(source, context, collectionContextFor(context), date);
}

function serializeRecord(record: AnalyticsConsentRecordV3): string {
  return JSON.stringify(record);
}

describe("analytics consent state", () => {
  it("derives every configured provider subset with its exact fixed purpose", () => {
    const fixtures = [
      {
        settings: createSettings({
          cloudflareWebAnalytics: providerSettings.cloudflareWebAnalytics,
        }),
        expected: [allProviderContext[0]],
      },
      {
        settings: createSettings({
          googleAnalytics4: providerSettings.googleAnalytics4,
        }),
        expected: [allProviderContext[1]],
      },
      {
        settings: createSettings({
          microsoftClarity: providerSettings.microsoftClarity,
        }),
        expected: [allProviderContext[2]],
      },
      {
        settings: createSettings({
          googleAnalytics4: providerSettings.googleAnalytics4,
          cloudflareWebAnalytics: providerSettings.cloudflareWebAnalytics,
        }),
        expected: [allProviderContext[0], allProviderContext[1]],
      },
      {
        settings: createSettings({
          microsoftClarity: providerSettings.microsoftClarity,
          cloudflareWebAnalytics: providerSettings.cloudflareWebAnalytics,
        }),
        expected: [allProviderContext[0], allProviderContext[2]],
      },
      {
        settings: createSettings({
          microsoftClarity: providerSettings.microsoftClarity,
          googleAnalytics4: providerSettings.googleAnalytics4,
        }),
        expected: [allProviderContext[1], allProviderContext[2]],
      },
      {
        settings: createSettings({
          microsoftClarity: providerSettings.microsoftClarity,
          cloudflareWebAnalytics: providerSettings.cloudflareWebAnalytics,
          googleAnalytics4: providerSettings.googleAnalytics4,
        }),
        expected: allProviderContext,
      },
    ] as const;

    for (const fixture of fixtures) {
      const context = createAnalyticsConsentContext(fixture.settings);

      expect(context).toEqual(fixture.expected);
      expect(JSON.stringify(context)).not.toMatch(
        /cloudflare-test-token|G-TEST123456|clarity-test-project/u,
      );
    }
  });

  it("creates all eight three-purpose choices in canonical purpose order", () => {
    const combinations = [
      [
        { purpose: "aggregate-traffic-and-performance", decision: "denied" },
        { purpose: "audience-measurement", decision: "denied" },
        { purpose: "consented-experience-analysis", decision: "denied" },
      ],
      [
        { purpose: "aggregate-traffic-and-performance", decision: "denied" },
        { purpose: "audience-measurement", decision: "denied" },
        { purpose: "consented-experience-analysis", decision: "granted" },
      ],
      [
        { purpose: "aggregate-traffic-and-performance", decision: "denied" },
        { purpose: "audience-measurement", decision: "granted" },
        { purpose: "consented-experience-analysis", decision: "denied" },
      ],
      [
        { purpose: "aggregate-traffic-and-performance", decision: "denied" },
        { purpose: "audience-measurement", decision: "granted" },
        { purpose: "consented-experience-analysis", decision: "granted" },
      ],
      [
        { purpose: "aggregate-traffic-and-performance", decision: "granted" },
        { purpose: "audience-measurement", decision: "denied" },
        { purpose: "consented-experience-analysis", decision: "denied" },
      ],
      [
        { purpose: "aggregate-traffic-and-performance", decision: "granted" },
        { purpose: "audience-measurement", decision: "denied" },
        { purpose: "consented-experience-analysis", decision: "granted" },
      ],
      [
        { purpose: "aggregate-traffic-and-performance", decision: "granted" },
        { purpose: "audience-measurement", decision: "granted" },
        { purpose: "consented-experience-analysis", decision: "denied" },
      ],
      [
        { purpose: "aggregate-traffic-and-performance", decision: "granted" },
        { purpose: "audience-measurement", decision: "granted" },
        { purpose: "consented-experience-analysis", decision: "granted" },
      ],
    ] as const satisfies readonly (readonly AnalyticsPurposeDecision[])[];

    for (const expected of combinations) {
      const input = [expected[2], expected[0], expected[1]];

      expect(
        createAnalyticsConsentRecord(input, allProviderContext, now).purposes,
      ).toEqual(expected);
    }
  });

  it("sorts context and one-provider decisions by code point", () => {
    expect(
      createAnalyticsConsentRecord(
        [{ purpose: "audience-measurement", decision: "granted" }],
        [
          {
            provider: "google-analytics-4",
            purpose: "audience-measurement",
          },
        ],
        now,
      ),
    ).toMatchObject({
      providerPurposeContext: [
        {
          provider: "google-analytics-4",
          purpose: "audience-measurement",
        },
      ],
      purposes: [
        { purpose: "audience-measurement", decision: "granted" },
      ],
    });

    const unsortedContext = [
      allProviderContext[2],
      allProviderContext[1],
      allProviderContext[0],
    ];
    const unsortedDecisions = [allGranted[2], allGranted[1], allGranted[0]];

    expect(
      createAnalyticsConsentRecord(unsortedDecisions, unsortedContext, now),
    ).toMatchObject({
      providerPurposeContext: allProviderContext,
      purposes: allGranted,
    });
  });

  it("uses the same exact 180-day interval for granted, denied, and partial choices", () => {
    const partial = [
      { purpose: "aggregate-traffic-and-performance", decision: "granted" },
      { purpose: "audience-measurement", decision: "denied" },
      { purpose: "consented-experience-analysis", decision: "granted" },
    ] as const satisfies readonly AnalyticsPurposeDecision[];
    const records = [allGranted, allDenied, partial].map((decisions) =>
      createAnalyticsConsentRecord(decisions, allProviderContext, now),
    );

    expect(
      records.map((record) => ({
        decidedAt: record.decidedAt,
        expiresAt: record.expiresAt,
      })),
    ).toEqual([
      { decidedAt: "2026-08-27T12:00:00.000Z", expiresAt },
      { decidedAt: "2026-08-27T12:00:00.000Z", expiresAt },
      { decidedAt: "2026-08-27T12:00:00.000Z", expiresAt },
    ]);
  });

  it("rejects missing, duplicate, extra-shaped, unknown, and unconfigured decisions", () => {
    const googleContext = [allProviderContext[1]];
    const validRecord = createAnalyticsConsentRecord(
      [allGranted[1]],
      googleContext,
      now,
    );
    const invalidPurpose = "future-purpose" as AnalyticsPurposeIdentifier;
    const invalidSources = [
      serializeRecord({ ...validRecord, purposes: [] }),
      serializeRecord({
        ...validRecord,
        purposes: [allGranted[1], allDenied[1]],
      }),
      JSON.stringify({
        ...validRecord,
        purposes: [{ ...allGranted[1], source: "manual" }],
      }),
      serializeRecord({
        ...validRecord,
        purposes: [{ purpose: invalidPurpose, decision: "granted" }],
      }),
      serializeRecord({ ...validRecord, purposes: [allGranted[0]] }),
    ];

    expect(() => createAnalyticsConsentRecord([], googleContext, now)).toThrow(
      "ANALYTICS_CONSENT_INVALID",
    );
    expect(() =>
      createAnalyticsConsentRecord(
        [allGranted[1], allDenied[1]],
        googleContext,
        now,
      ),
    ).toThrow("ANALYTICS_CONSENT_INVALID");
    expect(() =>
      createAnalyticsConsentRecord([allGranted[0]], googleContext, now),
    ).toThrow("ANALYTICS_CONSENT_INVALID");

    for (const source of invalidSources) {
      expect(parseAnalyticsConsentRecord(source, googleContext, now)).toEqual({
        status: "undecided",
        reason: "invalid",
      });
    }
  });

  it("accepts only a strict current record", () => {
    const record = createAnalyticsConsentRecord(
      allGranted,
      allProviderContext,
      now,
    );

    expect(
      parseAnalyticsConsentRecord(
        serializeRecord(record),
        allProviderContext,
        now,
      ),
    ).toEqual({ status: "valid", record });
  });

  it("rejects malformed, future-schema, and non-canonical timestamp records", () => {
    const record = createAnalyticsConsentRecord(
      allGranted,
      allProviderContext,
      now,
    );
    const invalidSources = [
      "{",
      JSON.stringify({ ...record, schemaVersion: 4 }),
      JSON.stringify({ ...record, schemaVersion: 2 }),
      JSON.stringify({ ...record, decidedAt: "not-a-timestamp" }),
      JSON.stringify({ ...record, expiresAt: "not-a-timestamp" }),
      JSON.stringify({
        ...record,
        decidedAt: "2026-08-27T08:00:00-04:00",
      }),
      JSON.stringify({ ...record, unexpected: true }),
    ];

    for (const source of invalidSources) {
      expect(
        parseAnalyticsConsentRecord(source, allProviderContext, now),
      ).toEqual({ status: "undecided", reason: "invalid" });
    }
  });

  it("rejects a future decision and any non-exact expiry interval", () => {
    const record = createAnalyticsConsentRecord(
      allGranted,
      allProviderContext,
      now,
    );
    const invalidSources = [
      JSON.stringify({
        ...record,
        decidedAt: "2026-08-27T12:00:00.001Z",
        expiresAt: "2027-02-23T12:00:00.001Z",
      }),
      JSON.stringify({
        ...record,
        expiresAt: "2027-02-23T11:59:59.999Z",
      }),
      JSON.stringify({
        ...record,
        expiresAt: "2027-02-23T12:00:00.001Z",
      }),
    ];

    for (const source of invalidSources) {
      expect(
        parseAnalyticsConsentRecord(source, allProviderContext, now),
      ).toEqual({ status: "undecided", reason: "invalid" });
    }
  });

  it("treats the exact expiry boundary as expired", () => {
    const expiredRecord: AnalyticsConsentRecordV3 = {
      schemaVersion: 3,
      noticeVersion: 1,
      decidedAt: "2026-02-28T12:00:00.000Z",
      expiresAt: "2026-08-27T12:00:00.000Z",
      providerPurposeContext: [allProviderContext[1]],
      collectionContext: collectionContextFor([allProviderContext[1]]),
      purposes: [allGranted[1]],
    };

    expect(
      parseAnalyticsConsentRecord(
        serializeRecord(expiredRecord),
        [allProviderContext[1]],
        now,
      ),
    ).toEqual({ status: "undecided", reason: "expired" });
  });

  it("distinguishes notice and provider-context changes", () => {
    const record = createAnalyticsConsentRecord(
      [allGranted[1]],
      [allProviderContext[1]],
      now,
    );

    expect(
      parseAnalyticsConsentRecord(
        JSON.stringify({ ...record, noticeVersion: 2 }),
        [allProviderContext[1]],
        now,
      ),
    ).toEqual({ status: "undecided", reason: "notice-changed" });
    expect(
      parseAnalyticsConsentRecord(
        serializeRecord(record),
        allProviderContext,
        now,
      ),
    ).toEqual({ status: "undecided", reason: "provider-context-changed" });
  });

  it("never promotes legacy granted or denied storage values", () => {
    for (const source of ["granted", "denied", '"granted"', '"denied"']) {
      expect(
        parseAnalyticsConsentRecord(source, allProviderContext, now),
      ).toEqual({ status: "undecided", reason: "invalid" });
    }
    expect(parseAnalyticsConsentRecord(null, allProviderContext, now)).toEqual({
      status: "undecided",
      reason: "missing",
    });
  });

  it("reports purpose additions and reductions in deterministic order", () => {
    const previous = [
      { purpose: "consented-experience-analysis", decision: "granted" },
      { purpose: "aggregate-traffic-and-performance", decision: "denied" },
      { purpose: "audience-measurement", decision: "granted" },
    ] as const satisfies readonly AnalyticsPurposeDecision[];
    const next = [
      { purpose: "audience-measurement", decision: "granted" },
      { purpose: "consented-experience-analysis", decision: "denied" },
      { purpose: "aggregate-traffic-and-performance", decision: "granted" },
    ] as const satisfies readonly AnalyticsPurposeDecision[];

    expect(compareAnalyticsPurposeDecisions(previous, next)).toEqual({
      added: ["aggregate-traffic-and-performance"],
      removed: ["consented-experience-analysis"],
    });
    expect(compareAnalyticsPurposeDecisions(next, previous)).toEqual({
      added: ["consented-experience-analysis"],
      removed: ["aggregate-traffic-and-performance"],
    });
  });
});


describe("collection consent context", () => {
  it("rejects changed activation, target, each destination and Clarity origin", () => {
    const record = createRecord(allGranted, allProviderContext, collectionContext, now);
    expect(parseRecord(JSON.stringify(record), allProviderContext, collectionContext, now).status).toBe("valid");
    const changed: AnalyticsCollectionContext[] = [
      { ...collectionContext, collectionEnabled: false },
      { ...collectionContext, applicationEnvironment: "production" },
      { ...collectionContext, siteOrigin: "https://www.analytics-live.invalid" },
      ...["cloudflare-web-analytics", "google-analytics-4", "microsoft-clarity"].map(provider => ({
        ...collectionContext, destinations: collectionContext.destinations.map(entry => entry.provider === provider ? { ...entry, destination: null } : entry),
      })),
    ];
    for (const context of changed) {
      expect(parseRecord(JSON.stringify(record), allProviderContext, context, now)).toEqual({ status: "undecided", reason: "collection-context-changed" });
      const changedRecord = createRecord(allGranted, allProviderContext, context, now);
      expect(parseRecord(JSON.stringify(changedRecord), allProviderContext, collectionContext, now)).toEqual({ status: "undecided", reason: "collection-context-changed" });
    }
  });

  it("rejects extra, missing, duplicated, reordered and mistyped collection fields", () => {
    const record = createRecord(allGranted, allProviderContext, collectionContext, now);
    for (const invalid of [
      undefined, null, {}, { ...collectionContext, extra: true },
      { ...collectionContext, collectionEnabled: "true" }, { ...collectionContext, applicationEnvironment: "preview" },
      { ...collectionContext, siteOrigin: 42 },
      { ...collectionContext, destinations: [...collectionContext.destinations].reverse() },
      { ...collectionContext, destinations: [...collectionContext.destinations, collectionContext.destinations[0]] },
      { ...collectionContext, destinations: [{ provider: "google-analytics-4", destination: 42 }] },
      { ...collectionContext, destinations: [{ provider: "unknown", destination: null }] },
      { ...collectionContext, destinations: [{ provider: "google-analytics-4", destination: null, extra: true }] },
    ]) {
      expect(parseRecord(JSON.stringify({ ...record, collectionContext: invalid }), allProviderContext, collectionContext, now)).toEqual({ status: "undecided", reason: "invalid" });
    }
    for (const destinations of [[], collectionContext.destinations.slice(0, 1)]) {
      expect(parseRecord(JSON.stringify({ ...record, collectionContext: { ...collectionContext, destinations } }), allProviderContext, collectionContext, now).status).toBe("undecided");
    }
  });

  it("builds collection context independently from operational integrations and missing IDs", () => {
    const selected = createSettings(providerSettings);
    expect(createAnalyticsCollectionContext(selected, {
      collectionEnabled: false, collectionAvailable: false, applicationEnvironment: "development",
      cloudflareToken: undefined, googleMeasurementId: "G-TEST123456", clarityProjectId: undefined,
      siteOrigin: undefined, googleSiteVerification: undefined, missingFields: [],
    })).toEqual({ collectionEnabled: false, applicationEnvironment: "development", siteOrigin: null,
      destinations: [
        { provider: "cloudflare-web-analytics", destination: null },
        { provider: "google-analytics-4", destination: "G-TEST123456" },
        { provider: "microsoft-clarity", destination: null },
      ],
    });
  });
});
