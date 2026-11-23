import type { ApplicationEnvironment } from "../../configuration/application-environment.ts";
import type { AnalyticsConfiguration } from "./analytics-configuration.ts";
import {
  createAnalyticsProviderDeclarations,
  type AnalyticsProviderIdentifier,
  type AnalyticsPurposeIdentifier,
  type AnalyticsSettings,
} from "./analytics-provider-contract";

export type AnalyticsPurposeDecision = Readonly<{
  purpose: AnalyticsPurposeIdentifier;
  decision: "granted" | "denied";
}>;

export type AnalyticsConsentContextEntry = Readonly<{
  provider: AnalyticsProviderIdentifier;
  purpose: AnalyticsPurposeIdentifier;
}>;

export type AnalyticsCollectionContext = Readonly<{
  collectionEnabled: boolean;
  applicationEnvironment: ApplicationEnvironment;
  siteOrigin: string | null;
  destinations: readonly Readonly<{ provider: AnalyticsProviderIdentifier; destination: string | null }>[];
}>;

export type AnalyticsConsentRecordV3 = Readonly<{
  schemaVersion: 3;
  noticeVersion: 1;
  decidedAt: string;
  expiresAt: string;
  providerPurposeContext: readonly AnalyticsConsentContextEntry[];
  collectionContext: AnalyticsCollectionContext;
  purposes: readonly AnalyticsPurposeDecision[];
}>;

export type AnalyticsConsentResolution =
  | Readonly<{ status: "valid"; record: AnalyticsConsentRecordV3 }>
  | Readonly<{
      status: "undecided";
      reason:
        | "missing"
        | "invalid"
        | "expired"
        | "notice-changed"
        | "provider-context-changed"
        | "collection-context-changed";
    }>;

const analyticsConsentDurationMilliseconds = 180 * 24 * 60 * 60 * 1_000;
const analyticsConsentRecordKeys = [
  "schemaVersion",
  "noticeVersion",
  "decidedAt",
  "expiresAt",
  "providerPurposeContext",
  "collectionContext",
  "purposes",
] as const;
const analyticsConsentContextKeys = ["provider", "purpose"] as const;
const analyticsPurposeDecisionKeys = ["purpose", "decision"] as const;

function compareCodePoints(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Readonly<Record<string, unknown>>,
  expectedKeys: readonly string[],
): boolean {
  const actualKeys = Object.keys(value).sort(compareCodePoints);
  const sortedExpectedKeys = [...expectedKeys].sort(compareCodePoints);

  return (
    actualKeys.length === sortedExpectedKeys.length &&
    actualKeys.every((key, index) => key === sortedExpectedKeys[index])
  );
}

function compareContextEntries(
  left: AnalyticsConsentContextEntry,
  right: AnalyticsConsentContextEntry,
): number {
  return (
    compareCodePoints(left.provider, right.provider) ||
    compareCodePoints(left.purpose, right.purpose)
  );
}

function comparePurposeDecisions(
  left: AnalyticsPurposeDecision,
  right: AnalyticsPurposeDecision,
): number {
  return compareCodePoints(left.purpose, right.purpose);
}

function parseContext(
  value: unknown,
): readonly AnalyticsConsentContextEntry[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const providers = new Set<string>();
  const context: AnalyticsConsentContextEntry[] = [];
  for (const entry of value) {
    if (
      !isObject(entry) ||
      !hasExactKeys(entry, analyticsConsentContextKeys) ||
      typeof entry.provider !== "string" ||
      typeof entry.purpose !== "string" ||
      providers.has(entry.provider)
    ) {
      return null;
    }

    providers.add(entry.provider);
    context.push({
      provider: entry.provider as AnalyticsProviderIdentifier,
      purpose: entry.purpose as AnalyticsPurposeIdentifier,
    });
  }

  return context;
}

function parsePurposeDecisions(
  value: unknown,
): readonly AnalyticsPurposeDecision[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const purposes = new Set<string>();
  const decisions: AnalyticsPurposeDecision[] = [];
  for (const entry of value) {
    if (
      !isObject(entry) ||
      !hasExactKeys(entry, analyticsPurposeDecisionKeys) ||
      typeof entry.purpose !== "string" ||
      (entry.decision !== "granted" && entry.decision !== "denied") ||
      purposes.has(entry.purpose)
    ) {
      return null;
    }

    purposes.add(entry.purpose);
    decisions.push({
      purpose: entry.purpose as AnalyticsPurposeIdentifier,
      decision: entry.decision,
    });
  }

  return decisions;
}

function contextsEqual(
  left: readonly AnalyticsConsentContextEntry[],
  right: readonly AnalyticsConsentContextEntry[],
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (entry, index) =>
        entry.provider === right[index]?.provider &&
        entry.purpose === right[index]?.purpose,
    )
  );
}

function purposeDecisionsEqual(
  left: readonly AnalyticsPurposeDecision[],
  right: readonly AnalyticsPurposeDecision[],
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (entry, index) =>
        entry.purpose === right[index]?.purpose &&
        entry.decision === right[index]?.decision,
    )
  );
}

function purposeKeysEqual(
  decisions: readonly AnalyticsPurposeDecision[],
  context: readonly AnalyticsConsentContextEntry[],
): boolean {
  const expectedPurposes = [...new Set(context.map(({ purpose }) => purpose))]
    .sort(compareCodePoints);

  return (
    decisions.length === expectedPurposes.length &&
    decisions.every(
      ({ purpose }, index) => purpose === expectedPurposes[index],
    )
  );
}

function parseCanonicalInstant(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }

  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    return null;
  }

  try {
    return new Date(milliseconds).toISOString() === value
      ? milliseconds
      : null;
  } catch {
    return null;
  }
}

function undecided(
  reason: Extract<AnalyticsConsentResolution, { status: "undecided" }>["reason"],
): AnalyticsConsentResolution {
  return { status: "undecided", reason };
}

function invalidConsentInput(): never {
  throw new Error("ANALYTICS_CONSENT_INVALID");
}

export function createAnalyticsConsentContext(
  settings: AnalyticsSettings,
): readonly AnalyticsConsentContextEntry[] {
  return createAnalyticsProviderDeclarations(settings)
    .map(({ identifier, purpose }) => ({ provider: identifier, purpose }))
    .sort(compareContextEntries);
}

export function createAnalyticsCollectionContext(
  settings: AnalyticsSettings,
  configuration: AnalyticsConfiguration,
): AnalyticsCollectionContext {
  const destinations = {
    "cloudflare-web-analytics": configuration.cloudflareToken,
    "google-analytics-4": configuration.googleMeasurementId,
    "microsoft-clarity": configuration.clarityProjectId,
  };
  return {
    collectionEnabled: configuration.collectionEnabled,
    applicationEnvironment: configuration.applicationEnvironment,
    siteOrigin: settings.providers.microsoftClarity === undefined ? null : configuration.siteOrigin ?? null,
    destinations: createAnalyticsProviderDeclarations(settings)
      .map(({ identifier }) => ({ provider: identifier, destination: destinations[identifier] ?? null }))
      .sort((left, right) => compareCodePoints(left.provider, right.provider)),
  };
}

function parseCollectionContext(value: unknown): AnalyticsCollectionContext | null {
  if (!isObject(value) || !hasExactKeys(value, ["collectionEnabled", "applicationEnvironment", "siteOrigin", "destinations"]) ||
    typeof value.collectionEnabled !== "boolean" ||
    (value.applicationEnvironment !== "development" && value.applicationEnvironment !== "staging" && value.applicationEnvironment !== "production") ||
    (value.siteOrigin !== null && typeof value.siteOrigin !== "string") || !Array.isArray(value.destinations)) return null;
  const destinations: { provider: AnalyticsProviderIdentifier; destination: string | null }[] = [];
  for (const entry of value.destinations) {
    if (!isObject(entry) || !hasExactKeys(entry, ["provider", "destination"]) ||
      (entry.provider !== "cloudflare-web-analytics" && entry.provider !== "google-analytics-4" && entry.provider !== "microsoft-clarity") ||
      (entry.destination !== null && typeof entry.destination !== "string")) return null;
    const previous = destinations.at(-1);
    if (previous !== undefined && compareCodePoints(previous.provider, entry.provider) >= 0) return null;
    destinations.push({ provider: entry.provider, destination: entry.destination });
  }
  return { collectionEnabled: value.collectionEnabled, applicationEnvironment: value.applicationEnvironment, siteOrigin: value.siteOrigin, destinations };
}

function collectionContextsEqual(left: AnalyticsCollectionContext, right: AnalyticsCollectionContext): boolean {
  return left.collectionEnabled === right.collectionEnabled && left.applicationEnvironment === right.applicationEnvironment &&
    left.siteOrigin === right.siteOrigin && left.destinations.length === right.destinations.length &&
    left.destinations.every((entry, index) => entry.provider === right.destinations[index]?.provider && entry.destination === right.destinations[index]?.destination);
}

export function parseAnalyticsConsentRecord(
  source: string | null,
  expectedContext: readonly AnalyticsConsentContextEntry[],
  expectedCollectionContext: AnalyticsCollectionContext,
  now: Date,
): AnalyticsConsentResolution {
  if (source === null) {
    return undecided("missing");
  }

  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    return undecided("invalid");
  }

  if (!isObject(value) || !hasExactKeys(value, analyticsConsentRecordKeys)) {
    return undecided("invalid");
  }
  if (value.schemaVersion !== 3) {
    return undecided("invalid");
  }
  if (typeof value.noticeVersion !== "number") {
    return undecided("invalid");
  }
  if (value.noticeVersion !== 1) {
    return undecided("notice-changed");
  }

  const parsedContext = parseContext(value.providerPurposeContext);
  const normalizedExpectedContext = parseContext(expectedContext);
  if (parsedContext === null || normalizedExpectedContext === null) {
    return undecided("invalid");
  }

  const normalizedContext = [...parsedContext].sort(compareContextEntries);
  const sortedExpectedContext = [...normalizedExpectedContext].sort(
    compareContextEntries,
  );
  if (!contextsEqual(parsedContext, normalizedContext)) {
    return undecided("invalid");
  }
  if (!contextsEqual(normalizedContext, sortedExpectedContext)) {
    return undecided("provider-context-changed");
  }

  const collectionContext = parseCollectionContext(value.collectionContext);
  const expectedCollection = parseCollectionContext(expectedCollectionContext);
  if (collectionContext === null || expectedCollection === null) return undecided("invalid");
  if (!collectionContextsEqual(collectionContext, expectedCollection)) return undecided("collection-context-changed");

  const parsedDecisions = parsePurposeDecisions(value.purposes);
  if (parsedDecisions === null) {
    return undecided("invalid");
  }

  const normalizedDecisions = [...parsedDecisions].sort(comparePurposeDecisions);
  if (
    !purposeDecisionsEqual(parsedDecisions, normalizedDecisions) ||
    !purposeKeysEqual(normalizedDecisions, sortedExpectedContext)
  ) {
    return undecided("invalid");
  }

  const decidedAtMilliseconds = parseCanonicalInstant(value.decidedAt);
  const expiresAtMilliseconds = parseCanonicalInstant(value.expiresAt);
  const nowMilliseconds = now.getTime();
  if (
    decidedAtMilliseconds === null ||
    expiresAtMilliseconds === null ||
    !Number.isFinite(nowMilliseconds) ||
    decidedAtMilliseconds > nowMilliseconds ||
    expiresAtMilliseconds - decidedAtMilliseconds !==
      analyticsConsentDurationMilliseconds
  ) {
    return undecided("invalid");
  }
  if (expiresAtMilliseconds <= nowMilliseconds) {
    return undecided("expired");
  }

  return {
    status: "valid",
    record: {
      schemaVersion: 3,
      noticeVersion: 1,
      decidedAt: value.decidedAt as string,
      expiresAt: value.expiresAt as string,
      providerPurposeContext: normalizedContext,
      collectionContext,
      purposes: normalizedDecisions,
    },
  };
}

export function createAnalyticsConsentRecord(
  decisions: readonly AnalyticsPurposeDecision[],
  context: readonly AnalyticsConsentContextEntry[],
  collectionContext: AnalyticsCollectionContext,
  now: Date,
): AnalyticsConsentRecordV3 {
  const parsedContext = parseContext(context);
  const parsedDecisions = parsePurposeDecisions(decisions);
  const parsedCollection = parseCollectionContext(collectionContext);
  const nowMilliseconds = now.getTime();
  if (
    parsedContext === null ||
    parsedCollection === null ||
    parsedDecisions === null ||
    !Number.isFinite(nowMilliseconds)
  ) {
    return invalidConsentInput();
  }

  const normalizedContext = [...parsedContext].sort(compareContextEntries);
  const normalizedDecisions = [...parsedDecisions].sort(comparePurposeDecisions);
  if (!purposeKeysEqual(normalizedDecisions, normalizedContext) || parsedCollection.destinations.length !== normalizedContext.length ||
    normalizedContext.some((entry, index) => entry.provider !== parsedCollection.destinations[index]?.provider)) {
    return invalidConsentInput();
  }

  try {
    return {
      schemaVersion: 3,
      noticeVersion: 1,
      decidedAt: new Date(nowMilliseconds).toISOString(),
      expiresAt: new Date(
        nowMilliseconds + analyticsConsentDurationMilliseconds,
      ).toISOString(),
      providerPurposeContext: normalizedContext,
      collectionContext: parsedCollection,
      purposes: normalizedDecisions,
    };
  } catch {
    return invalidConsentInput();
  }
}

export function compareAnalyticsPurposeDecisions(
  previous: readonly AnalyticsPurposeDecision[],
  next: readonly AnalyticsPurposeDecision[],
): Readonly<{
  added: readonly AnalyticsPurposeIdentifier[];
  removed: readonly AnalyticsPurposeIdentifier[];
}> {
  const previousGrants = new Set(
    previous
      .filter(({ decision }) => decision === "granted")
      .map(({ purpose }) => purpose),
  );
  const nextGrants = new Set(
    next
      .filter(({ decision }) => decision === "granted")
      .map(({ purpose }) => purpose),
  );

  return {
    added: [...nextGrants]
      .filter((purpose) => !previousGrants.has(purpose))
      .sort(compareCodePoints),
    removed: [...previousGrants]
      .filter((purpose) => !nextGrants.has(purpose))
      .sort(compareCodePoints),
  };
}
