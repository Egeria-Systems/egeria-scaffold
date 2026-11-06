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

export type AnalyticsConsentRecordV2 = Readonly<{
  schemaVersion: 2;
  noticeVersion: 1;
  decidedAt: string;
  expiresAt: string;
  providerPurposeContext: readonly AnalyticsConsentContextEntry[];
  purposes: readonly AnalyticsPurposeDecision[];
}>;

export type AnalyticsConsentResolution =
  | Readonly<{ status: "valid"; record: AnalyticsConsentRecordV2 }>
  | Readonly<{
      status: "undecided";
      reason:
        | "missing"
        | "invalid"
        | "expired"
        | "notice-changed"
        | "provider-context-changed";
    }>;

const analyticsConsentDurationMilliseconds = 180 * 24 * 60 * 60 * 1_000;
const analyticsConsentRecordKeys = [
  "schemaVersion",
  "noticeVersion",
  "decidedAt",
  "expiresAt",
  "providerPurposeContext",
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

export function parseAnalyticsConsentRecord(
  source: string | null,
  expectedContext: readonly AnalyticsConsentContextEntry[],
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
  if (value.schemaVersion !== 2) {
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
      schemaVersion: 2,
      noticeVersion: 1,
      decidedAt: value.decidedAt as string,
      expiresAt: value.expiresAt as string,
      providerPurposeContext: normalizedContext,
      purposes: normalizedDecisions,
    },
  };
}

export function createAnalyticsConsentRecord(
  decisions: readonly AnalyticsPurposeDecision[],
  context: readonly AnalyticsConsentContextEntry[],
  now: Date,
): AnalyticsConsentRecordV2 {
  const parsedContext = parseContext(context);
  const parsedDecisions = parsePurposeDecisions(decisions);
  const nowMilliseconds = now.getTime();
  if (
    parsedContext === null ||
    parsedDecisions === null ||
    !Number.isFinite(nowMilliseconds)
  ) {
    return invalidConsentInput();
  }

  const normalizedContext = [...parsedContext].sort(compareContextEntries);
  const normalizedDecisions = [...parsedDecisions].sort(comparePurposeDecisions);
  if (!purposeKeysEqual(normalizedDecisions, normalizedContext)) {
    return invalidConsentInput();
  }

  try {
    return {
      schemaVersion: 2,
      noticeVersion: 1,
      decidedAt: new Date(nowMilliseconds).toISOString(),
      expiresAt: new Date(
        nowMilliseconds + analyticsConsentDurationMilliseconds,
      ).toISOString(),
      providerPurposeContext: normalizedContext,
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
