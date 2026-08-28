import { describe, expect, it } from "vitest";

import {
  compareAnalyticsPurposeDecisions,
  createAnalyticsConsentContext,
  createAnalyticsConsentRecord,
  parseAnalyticsConsentRecord,
  type AnalyticsConsentContextEntry,
  type AnalyticsConsentRecordV2,
  type AnalyticsPurposeDecision,
} from "../../src/integrations/analytics/analytics-consent-state";
import type {
  AnalyticsPurposeIdentifier,
  AnalyticsSettings,
} from "../../src/integrations/analytics/analytics-provider-contract";

const now = new Date("2026-08-27T12:00:00.000Z");
const expiresAt = "2027-02-23T12:00:00.000Z";

const providerSettings = {
  cloudflareWebAnalytics: { siteToken: "cloudflare-test-token" },
  googleAnalytics4: { measurementId: "G-TEST123456" },
  microsoftClarity: {
    projectId: "clarity-test-project",
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

function serializeRecord(record: AnalyticsConsentRecordV2): string {
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
      JSON.stringify({ ...record, schemaVersion: 3 }),
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
    const expiredRecord: AnalyticsConsentRecordV2 = {
      schemaVersion: 2,
      noticeVersion: 1,
      decidedAt: "2026-02-28T12:00:00.000Z",
      expiresAt: "2026-08-27T12:00:00.000Z",
      providerPurposeContext: [allProviderContext[1]],
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
