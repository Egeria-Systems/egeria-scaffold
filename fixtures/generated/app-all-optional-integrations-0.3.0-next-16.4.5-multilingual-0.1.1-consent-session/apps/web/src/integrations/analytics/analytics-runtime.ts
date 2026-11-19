import { googleAnalyticsCookiePrefix, readCompiledAnalyticsConfiguration, type AnalyticsConfiguration, type AnalyticsConfigurationField } from "./analytics-configuration";
import {
  compareAnalyticsPurposeDecisions,
  createAnalyticsConsentContext,
  createAnalyticsCollectionContext,
  createAnalyticsConsentRecord,
  parseAnalyticsConsentRecord,
  type AnalyticsConsentResolution,
  type AnalyticsPurposeDecision,
} from "./analytics-consent-state";
import {
  createAnalyticsProviderDeclarations,
  type AnalyticsCookieCleanupRule,
  type AnalyticsProviderDeclaration,
  type AnalyticsPurposeIdentifier,
  type AnalyticsSettings,
} from "./analytics-provider-contract";

export const analyticsConsentPolicy = "explicit-opt-in" as const;
export const analyticsConsentStorageKey = "egeria.analytics.consent.v3";

const legacyAnalyticsConsentStorageKeys = ["egeria.analytics.consent.v1", "egeria.analytics.consent.v2"];

export type AnalyticsConsentPersistence =
  | "persisted"
  | "session-only"
  | "stale-grant-retained";

export type UndecidedConsentReason = Extract<AnalyticsConsentResolution, { status: "undecided" }>["reason"];

export type AnalyticsConsentSnapshot = Readonly<{
  decisions: readonly AnalyticsPurposeDecision[];
  hasChoice: boolean;
  undecidedReason?: UndecidedConsentReason;
  persistence?: AnalyticsConsentPersistence;
  retry?: readonly AnalyticsPurposeDecision[];
}>;

export type AnalyticsConsentSaveResult = Readonly<{
  persistence: AnalyticsConsentPersistence;
  reloading: boolean;
}>;

export type AnalyticsConsentSession = Readonly<{
  getSnapshot: () => AnalyticsConsentSnapshot;
  subscribe: (listener: () => void) => () => void;
  save: (requested: readonly AnalyticsPurposeDecision[]) => AnalyticsConsentSaveResult;
}>;

type ClarityCommand = ((...parameters: unknown[]) => void) & {
  q?: unknown[][];
};

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...parameters: unknown[]) => void;
  clarity?: ClarityCommand;
};

type AnalyticsBrowser = Readonly<{
  document: Document;
  window: AnalyticsWindow;
}>;

function currentBrowser(): AnalyticsBrowser {
  return { document, window };
}

function deniedDecisions(
  settings: AnalyticsSettings,
): readonly AnalyticsPurposeDecision[] {
  return createAnalyticsConsentContext(settings).map(({ purpose }) => ({
    purpose,
    decision: "denied",
  }));
}

function insertScript(
  browser: AnalyticsBrowser,
  declaration: AnalyticsProviderDeclaration,
  source: string,
  configure?: (script: HTMLScriptElement) => void,
): void {
  if (browser.document.getElementById(declaration.scriptId) !== null) {
    return;
  }

  const script = browser.document.createElement("script");
  script.id = declaration.scriptId;
  script.src = source;
  script.async = true;
  configure?.(script);
  browser.document.head.append(script);
}

function googleCommand(
  browser: AnalyticsBrowser,
): (...parameters: unknown[]) => void {
  if (browser.window.gtag !== undefined) return browser.window.gtag;
  browser.window.dataLayer ??= [];
  browser.window.gtag ??= function () {
    // Google Tag consumes the native Arguments shape used by its documented snippet.
    // eslint-disable-next-line prefer-rest-params
    browser.window.dataLayer?.push(arguments);
  };
  return browser.window.gtag;
}

function configureGoogleConsent(
  browser: AnalyticsBrowser,
  operation: "default" | "update",
  analyticsStorage: "granted" | "denied",
): void {
  googleCommand(browser)("consent", operation, {
    analytics_storage: analyticsStorage,
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
}

function clarityCommand(browser: AnalyticsBrowser): ClarityCommand {
  if (browser.window.clarity !== undefined) {
    return browser.window.clarity;
  }

  const command: ClarityCommand = (...parameters: unknown[]) => {
    command.q ??= [];
    command.q.push(parameters);
  };
  browser.window.clarity = command;
  return command;
}

function configureClarityConsent(
  browser: AnalyticsBrowser,
  analyticsStorage: "granted" | "denied",
): void {
  clarityCommand(browser)("consentv2", {
    ad_Storage: "denied",
    analytics_Storage: analyticsStorage,
  });
}

function loadCloudflareWebAnalytics(
  siteToken: string | undefined,
  declaration: AnalyticsProviderDeclaration,
  browser: AnalyticsBrowser,
): void {
  if (siteToken === undefined) {
    return;
  }

  insertScript(browser, declaration, declaration.scriptSource, (script) => {
    script.defer = true;
    script.dataset.cfBeacon = JSON.stringify({ token: siteToken });
  });
}

function loadGoogleAnalytics4(
  configuration: AnalyticsConfiguration,
  declaration: AnalyticsProviderDeclaration,
  browser: AnalyticsBrowser,
): void {
  const measurementId = configuration.googleMeasurementId;
  if (measurementId === undefined) {
    return;
  }

  if (browser.document.getElementById(declaration.scriptId) === null) configureGoogleConsent(browser, "default", "denied");
  configureGoogleConsent(browser, "update", "granted");
  if (browser.document.getElementById(declaration.scriptId) !== null) {
    return;
  }

  googleCommand(browser)("js", new Date());
  googleCommand(browser)("config", measurementId, {
    send_page_view: true,
    cookie_domain: "none",
    cookie_path: "/",
    cookie_prefix: googleAnalyticsCookiePrefix(configuration.applicationEnvironment),
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  insertScript(
    browser,
    declaration,
    `${declaration.scriptSource}?id=${encodeURIComponent(measurementId)}`,
  );
}

function loadMicrosoftClarity(
  projectId: string | undefined,
  declaration: AnalyticsProviderDeclaration,
  browser: AnalyticsBrowser,
): void {
  if (projectId === undefined) {
    return;
  }

  if (browser.document.getElementById(declaration.scriptId) === null) configureClarityConsent(browser, "denied");
  configureClarityConsent(browser, "granted");
  insertScript(
    browser,
    declaration,
    `${declaration.scriptSource}${encodeURIComponent(projectId)}`,
  );
}

const reportedUnavailableBrowsers = new WeakSet<AnalyticsWindow>();
function reportUnavailableCollection(browser: AnalyticsBrowser, fields: readonly AnalyticsConfigurationField[]): void {
  if (reportedUnavailableBrowsers.has(browser.window)) return;
  reportedUnavailableBrowsers.add(browser.window);
  console.warn("ANALYTICS_COLLECTION_DISABLED", ...fields);
}

function loadPurposes(
  settings: AnalyticsSettings,
  purposes: readonly AnalyticsPurposeIdentifier[],
  browser: AnalyticsBrowser,
): void {
  const configuration = readCompiledAnalyticsConfiguration(settings);
  if (!configuration.ok || !configuration.configuration.collectionEnabled) return;
  if (!configuration.configuration.collectionAvailable) {
    reportUnavailableCollection(browser, configuration.configuration.missingFields);
    return;
  }
  if (settings.providers.microsoftClarity !== undefined && browser.window.location.origin !== configuration.configuration.siteOrigin) {
    reportUnavailableCollection(browser, ["NEXT_PUBLIC_SITE_URL"]);
    return;
  }
  const permitted = new Set(purposes);
  for (const declaration of createAnalyticsProviderDeclarations(settings)) {
    if (!permitted.has(declaration.purpose)) {
      continue;
    }

    switch (declaration.identifier) {
      case "cloudflare-web-analytics":
        loadCloudflareWebAnalytics(configuration.configuration.cloudflareToken, declaration, browser);
        break;
      case "google-analytics-4":
        loadGoogleAnalytics4(configuration.configuration, declaration, browser);
        break;
      case "microsoft-clarity":
        loadMicrosoftClarity(configuration.configuration.clarityProjectId, declaration, browser);
        break;
    }
  }
}

function grantedPurposes(
  decisions: readonly AnalyticsPurposeDecision[],
): readonly AnalyticsPurposeIdentifier[] {
  return decisions
    .filter(({ decision }) => decision === "granted")
    .map(({ purpose }) => purpose);
}

function cookieDomainVariants(hostname: string): readonly string[] {
  const normalizedHostname = hostname.toLowerCase().replace(/\.$/u, "");
  const labels = normalizedHostname.split(".");
  const isIpAddress =
    labels.length === 4 && labels.every((label) => /^\d{1,3}$/u.test(label));
  if (labels.length < 2 || normalizedHostname.includes(":") || isIpAddress) {
    return [];
  }

  return labels
    .slice(0, -1)
    .map((_, index) => labels.slice(index).join("."));
}

function matchesCookieRule(
  name: string,
  rule: AnalyticsCookieCleanupRule,
): boolean {
  return rule.match === "exact"
    ? name === rule.value
    : name.startsWith(rule.value);
}

function clearAccessibleCookies(
  settings: AnalyticsSettings,
  browser: AnalyticsBrowser,
  declarations: readonly AnalyticsProviderDeclaration[],
): void {
  const configuration = readCompiledAnalyticsConfiguration(settings);
  const googleCookies = new Set<string>();
  if (configuration.ok && configuration.configuration.googleMeasurementId !== undefined && declarations.some(({ identifier }) => identifier === "google-analytics-4")) {
    const prefix = googleAnalyticsCookiePrefix(configuration.configuration.applicationEnvironment);
    googleCookies.add(`${prefix}_ga`);
    googleCookies.add(`${prefix}_ga_${configuration.configuration.googleMeasurementId.slice(2)}`);
  }
  const cleanupRules = declarations.filter(({ identifier }) => identifier !== "google-analytics-4").flatMap(
    ({ cookieCleanupRules }) => cookieCleanupRules,
  );
  const domainVariants = cookieDomainVariants(browser.window.location.hostname);
  for (const cookie of browser.document.cookie.split(";")) {
    const name = cookie.split("=", 1)[0]?.trim();
    if (
      name === undefined ||
      (!googleCookies.has(name) && !cleanupRules.some((rule) => matchesCookieRule(name, rule)))
    ) {
      continue;
    }

    browser.document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
    if (googleCookies.has(name)) continue;
    for (const domain of domainVariants) {
      browser.document.cookie =
        `${name}=; Max-Age=0; Path=/; Domain=${domain}; SameSite=Lax`;
    }
  }
}

function attemptProviderReduction(effect: () => void): void {
  try {
    effect();
  } catch {
    console.error("ANALYTICS_CONSENT_PROVIDER_FAILED");
  }
}

function applyReductionEffects(
  settings: AnalyticsSettings,
  removedPurposes: readonly AnalyticsPurposeIdentifier[],
  browser: AnalyticsBrowser,
): readonly AnalyticsPurposeIdentifier[] {
  const removed = new Set(removedPurposes);
  const declarations = createAnalyticsProviderDeclarations(settings).filter(
    ({ purpose }) => removed.has(purpose),
  );
  const retired: AnalyticsPurposeIdentifier[] = [];

  for (const declaration of declarations) {
    switch (declaration.identifier) {
      case "cloudflare-web-analytics":
        break;
      case "google-analytics-4":
        if (typeof browser.window.gtag === "function") {
          attemptProviderReduction(() => configureGoogleConsent(browser, "update", "denied"));
        }
        break;
      case "microsoft-clarity":
        if (typeof browser.window.clarity === "function") {
          attemptProviderReduction(() => configureClarityConsent(browser, "denied"));
          attemptProviderReduction(() => browser.window.clarity?.("consent", false));
        }
        break;
    }

    const script = browser.document.getElementById(declaration.scriptId);
    if (script !== null) {
      script.remove();
      retired.push(declaration.purpose);
    }
  }
  clearAccessibleCookies(settings, browser, declarations);
  return retired;
}

type StoredConsentRead = Readonly<{
  readable: boolean;
  resolution: AnalyticsConsentResolution;
}>;

function readStoredConsent(
  browser: AnalyticsBrowser,
  settings: AnalyticsSettings,
): StoredConsentRead {
  const configuration = readCompiledAnalyticsConfiguration(settings);
  if (!configuration.ok) return { readable: true, resolution: { status: "undecided", reason: "invalid" } };
  const collectionContext = createAnalyticsCollectionContext(settings, configuration.configuration);
  try {
    const source = browser.window.localStorage.getItem(analyticsConsentStorageKey);
    return {
      readable: true,
      resolution: parseAnalyticsConsentRecord(
        source,
        createAnalyticsConsentContext(settings),
        collectionContext,
        new Date(),
      ),
    };
  } catch {
    return {
      readable: false,
      resolution: parseAnalyticsConsentRecord(
        null,
        createAnalyticsConsentContext(settings),
        collectionContext,
        new Date(),
      ),
    };
  }
}

function recordsEqual(
  left: Extract<AnalyticsConsentResolution, { status: "valid" }>["record"],
  right: Extract<AnalyticsConsentResolution, { status: "valid" }>["record"],
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function persistDecisions(
  settings: AnalyticsSettings,
  decisions: readonly AnalyticsPurposeDecision[],
  browser: AnalyticsBrowser,
): Readonly<{ persisted: boolean; stored: StoredConsentRead }> {
  const configuration = readCompiledAnalyticsConfiguration(settings);
  if (!configuration.ok) return { persisted: false, stored: readStoredConsent(browser, settings) };
  const record = createAnalyticsConsentRecord(
    decisions,
    createAnalyticsConsentContext(settings),
    createAnalyticsCollectionContext(settings, configuration.configuration),
    new Date(),
  );
  try {
    browser.window.localStorage.setItem(
      analyticsConsentStorageKey,
      JSON.stringify(record),
    );
  } catch {
    // Read-back below distinguishes a retained valid grant from unavailable storage.
  }

  const stored = readStoredConsent(browser, settings);
  const persisted =
    stored.resolution.status === "valid" &&
    recordsEqual(stored.resolution.record, record);
  if (persisted) {
    try {
      for (const key of legacyAnalyticsConsentStorageKeys) browser.window.localStorage.removeItem(key);
    } catch {
      // The verified current record is authoritative; obsolete-key removal is best effort.
    }
  }
  return { persisted, stored };
}

function removeUnverifiedRecord(
  settings: AnalyticsSettings,
  browser: AnalyticsBrowser,
): StoredConsentRead {
  try {
    browser.window.localStorage.removeItem(analyticsConsentStorageKey);
  } catch {
    // Read-back below determines whether a valid stale grant remains.
  }
  return readStoredConsent(browser, settings);
}

type PendingWithdrawal = Readonly<{
  purposes: readonly AnalyticsPurposeIdentifier[];
  requested: readonly AnalyticsPurposeDecision[];
}>;

function restrictDecisions(
  decisions: readonly AnalyticsPurposeDecision[],
  withheld: readonly AnalyticsPurposeIdentifier[],
): readonly AnalyticsPurposeDecision[] {
  return decisions.map(({ purpose, decision }) => ({
    purpose, decision: withheld.includes(purpose) ? "denied" : decision,
  }));
}

function sameStoredConsent(left: StoredConsentRead | undefined, right: StoredConsentRead): boolean {
  if (left === undefined || left.readable !== right.readable) return false;
  if (left.resolution.status === "valid" && right.resolution.status === "valid") {
    return recordsEqual(left.resolution.record, right.resolution.record);
  }
  return left.resolution.status === "undecided" && right.resolution.status === "undecided" &&
    left.resolution.reason === right.resolution.reason;
}

function storageSnapshot(
  stored: StoredConsentRead,
  denied: readonly AnalyticsPurposeDecision[],
): AnalyticsConsentSnapshot {
  return stored.resolution.status === "valid"
    ? { decisions: stored.resolution.record.purposes, hasChoice: true, persistence: "persisted" }
    : { decisions: denied, hasChoice: false, undecidedReason: stored.resolution.reason };
}

function canRunProviders(settings: AnalyticsSettings, browser: AnalyticsBrowser): boolean {
  const result = readCompiledAnalyticsConfiguration(settings);
  return result.ok && result.configuration.collectionEnabled && result.configuration.collectionAvailable &&
    (settings.providers.microsoftClarity === undefined || browser.window.location.origin === result.configuration.siteOrigin);
}

function immutableDecisions(decisions: readonly AnalyticsPurposeDecision[]): readonly AnalyticsPurposeDecision[] {
  return Object.freeze(decisions.map(({ purpose, decision }) => Object.freeze({ purpose, decision })));
}

type BrowserConsentSession = Readonly<{
  session: AnalyticsConsentSession;
  stop: () => (() => void) | undefined;
}>;

type DocumentConsentSessions = {
  sessions: Map<string, BrowserConsentSession>;
  active?: string;
};

const consentByDocument = new WeakMap<Document, DocumentConsentSessions>();

function createBrowserConsentSession(
  settings: AnalyticsSettings,
  browser: AnalyticsBrowser,
  runWithActiveSession: <Result>(operation: () => Result) => Result,
): BrowserConsentSession {
  const denied = immutableDecisions(deniedDecisions(settings));
  const initialSnapshot: AnalyticsConsentSnapshot = Object.freeze({ decisions: denied, hasChoice: false, undecidedReason: "missing" });
  const subscribers = new Set<() => void>();
  const retiredPurposes = new Set<AnalyticsPurposeIdentifier>();
  let snapshot = initialSnapshot;
  let observedStorage: StoredConsentRead | undefined;
  let pending: PendingWithdrawal | undefined;
  let listening = false;
  let active = false;
  let reloading = false;

  function notifySubscribers(): void {
    for (const subscriber of subscribers) {
      try {
        subscriber();
      } catch {
        console.error("ANALYTICS_CONSENT_SUBSCRIBER_FAILED");
      }
    }
  }

  function reduce(purposes: readonly AnalyticsPurposeIdentifier[]): void {
    for (const purpose of applyReductionEffects(settings, purposes, browser)) retiredPurposes.add(purpose);
  }

  function publish(next: AnalyticsConsentSnapshot, applyEffects?: () => void, reload = false, deferNotification = false): boolean {
    const changed = JSON.stringify(snapshot) !== JSON.stringify(next);
    if (changed) {
      snapshot = Object.freeze({
        ...next,
        decisions: immutableDecisions(next.decisions),
        ...(next.retry === undefined ? {} : { retry: immutableDecisions(next.retry) }),
      });
    }
    // Complete the browser transition before calling application-supplied listeners.
    applyEffects?.();
    updateListener();
    if (reload) browser.window.location.reload();
    if (changed && !deferNotification) notifySubscribers();
    return changed;
  }

  function reflectStorage(stored: StoredConsentRead, notified?: AnalyticsConsentResolution): void {
    const storedSnapshot = storageSnapshot(stored, denied);
    const oldStorage = observedStorage;
    observedStorage = stored;
    const previous = snapshot.decisions;
    const retained = grantedPurposes(storedSnapshot.decisions);
    if (pending !== undefined) {
      if (stored.readable && pending.purposes.every(purpose => !retained.includes(purpose))) {
        const { removed } = compareAnalyticsPurposeDecisions(previous, storedSnapshot.decisions);
        pending = undefined;
        reloading = true;
        publish(storedSnapshot, () => reduce(removed), true);
      } else {
        const absent = notified?.status === "valid" ? grantedPurposes(notified.record.purposes) : [];
        const removed = grantedPurposes(previous).filter(purpose =>
          (stored.readable && !retained.includes(purpose)) ||
          (notified !== undefined && !absent.includes(purpose)));
        if (removed.length === 0) return;
        publish({ ...snapshot, decisions: restrictDecisions(previous, removed) },
          () => reduce(removed));
      }
      return;
    }

    if (notified === undefined && snapshot.persistence === "session-only" &&
        (!stored.readable || sameStoredConsent(oldStorage, stored) ||
          (oldStorage?.readable === false && stored.resolution.status === "undecided" && stored.resolution.reason === "missing"))) {
      return;
    }

    let next = storedSnapshot;
    if (notified !== undefined && !(notified.status === "valid" &&
      stored.resolution.status === "valid" && recordsEqual(notified.record, stored.resolution.record))) {
      if (notified.status === "valid") {
        const grants = grantedPurposes(notified.record.purposes);
        const removed = grantedPurposes(previous).filter(purpose =>
          !grants.includes(purpose) || (stored.readable && !retained.includes(purpose)));
        if (removed.length === 0) return;
        next = { ...snapshot, decisions: restrictDecisions(previous, removed) };
      } else {
        next = storedSnapshot.hasChoice && retained.length === 0
          ? storedSnapshot
          : { decisions: denied, hasChoice: false, undecidedReason: notified.reason };
      }
    }

    const { added, removed } = compareAnalyticsPurposeDecisions(previous, next.decisions);
    if (removed.length > 0) {
      const safe = stored.readable && removed.every(purpose => !retained.includes(purpose));
      if (!safe) {
        pending = { purposes: removed, requested: next.decisions };
        next = { ...next, hasChoice: true, persistence: "stale-grant-retained", retry: pending.requested };
      }
      reloading = safe;
      publish(next, () => reduce(removed), safe);
      return;
    }

    publish(next, () => loadPurposes(settings, added, browser));
  }

  function storageChanged(event: StorageEvent): void {
    if (reloading || (event.key !== analyticsConsentStorageKey && event.key !== null)) return;
    try {
      if (event.storageArea !== browser.window.localStorage) return;
    } catch {
      return;
    }
    const configuration = readCompiledAnalyticsConfiguration(settings);
    const notified = configuration.ok ? parseAnalyticsConsentRecord(
      event.newValue, createAnalyticsConsentContext(settings),
      createAnalyticsCollectionContext(settings, configuration.configuration), new Date(),
    ) : { status: "undecided", reason: "invalid" } as const;
    reflectStorage(readStoredConsent(browser, settings), notified);
  }

  function pageHidden(event: PageTransitionEvent): void {
    if (!event.persisted) removeListener();
  }

  function pageShown(event: PageTransitionEvent): void {
    if (event.persisted && !reloading) {
      reflectStorage(readStoredConsent(browser, settings));
    }
  }

  function removeListener(): void {
    if (!listening) return;
    listening = false;
    browser.window.removeEventListener("storage", storageChanged);
    browser.window.removeEventListener("pagehide", pageHidden);
    browser.window.removeEventListener("pageshow", pageShown);
  }

  function updateListener(): void {
    const needed = active && (subscribers.size > 0 || pending !== undefined ||
      (canRunProviders(settings, browser) && grantedPurposes(snapshot.decisions).length > 0));
    if (!needed) {
      removeListener();
    } else if (!listening) {
      listening = true;
      browser.window.addEventListener("storage", storageChanged);
      browser.window.addEventListener("pagehide", pageHidden);
      browser.window.addEventListener("pageshow", pageShown);
    }
  }

  function save(requested: readonly AnalyticsPurposeDecision[]): AnalyticsConsentSaveResult {
    active = true;
    // A direct action before subscription must not publish a grant it is about to withdraw.
    const previous = observedStorage === undefined
      ? storageSnapshot(readStoredConsent(browser, settings), denied).decisions
      : snapshot.decisions;
    const next = requested.map(({ purpose, decision }) => ({ purpose, decision }));
    const transition = compareAnalyticsPurposeDecisions(previous, next);
    const withdrawing = transition.removed.length > 0 || pending !== undefined;
    const { persisted, stored } = persistDecisions(settings, next, browser);
    const storedDecisions = storageSnapshot(stored, denied).decisions;
    const firstConflicts = compareAnalyticsPurposeDecisions(storedDecisions, next).removed;
    const remaining = !persisted && withdrawing && (!stored.readable || firstConflicts.length > 0)
      ? removeUnverifiedRecord(settings, browser) : stored;
    observedStorage = remaining;
    const retained = storageSnapshot(remaining, denied).decisions;
    const conflicts = compareAnalyticsPurposeDecisions(retained, next).removed;
    const locallyRemoved = remaining.readable ? compareAnalyticsPurposeDecisions(previous, retained).removed : [];
    const requestedGrants = grantedPurposes(next);

    if (conflicts.length > 0 || (withdrawing && !remaining.readable)) {
      const purposes = [...new Set([
        ...(pending?.purposes ?? []).filter(purpose => !requestedGrants.includes(purpose)),
        ...transition.removed, ...firstConflicts, ...conflicts,
      ])];
      // An unreadable retry needs a verifiable reduction even if its draft re-allows every purpose.
      pending = { purposes, requested: next };
      const removed = [...purposes, ...locallyRemoved];
      publish(
        { decisions: restrictDecisions(previous, removed), hasChoice: true, persistence: "stale-grant-retained", retry: pending.requested },
        () => reduce(removed),
      );
      return { persistence: "stale-grant-retained", reloading: false };
    }

    const persistence = persisted ? "persisted" : "session-only";
    // Retired loaders can still have executed code. Restore those grants in a fresh document.
    const supersedesDispute = persisted && pending !== undefined && transition.removed.length === 0 &&
      pending.purposes.every(purpose => requestedGrants.includes(purpose)) &&
      !requestedGrants.some(purpose => retiredPurposes.has(purpose));
    pending = undefined;
    const shouldReload = withdrawing && !supersedesDispute;
    reloading = shouldReload;
    const effective = withdrawing && !persisted ? retained : next;
    publish({ decisions: effective, hasChoice: true, persistence }, () => {
      if (shouldReload) reduce([...transition.removed, ...firstConflicts, ...locallyRemoved]);
      else loadPurposes(settings, transition.added, browser);
    }, shouldReload);
    return { persistence, reloading: shouldReload };
  }

  function subscribe(listener: () => void): () => void {
    const needsStorageCheck = !active || subscribers.size === 0;
    active = true;
    subscribers.add(listener);
    if (needsStorageCheck && !reloading) reflectStorage(readStoredConsent(browser, settings));
    updateListener();
    return () => {
      subscribers.delete(listener);
      updateListener();
    };
  }

  return {
    session: {
      getSnapshot: () => snapshot,
      subscribe: listener => runWithActiveSession(() => subscribe(listener)),
      save: requested => runWithActiveSession(() => save(requested)),
    },
    stop() {
      active = false;
      removeListener();
      const grants = grantedPurposes(snapshot.decisions);
      const retainDispute = pending !== undefined;
      if (!retainDispute) observedStorage = undefined;
      reloading = false;
      // Retain the retry and disputed purposes, without leaving any providers active.
      const changed = publish(retainDispute ? { ...snapshot, decisions: denied } : initialSnapshot, () => {
        if (grants.length > 0) reduce(grants);
      }, false, true);
      return changed ? notifySubscribers : undefined;
    },
  };
}

export function getBrowserAnalyticsConsentSession(settings: AnalyticsSettings): AnalyticsConsentSession {
  const browser = currentBrowser();
  const configuration = readCompiledAnalyticsConfiguration(settings);
  const key = JSON.stringify([
    createAnalyticsConsentContext(settings),
    configuration.ok ? createAnalyticsCollectionContext(settings, configuration.configuration) : null,
  ]);
  let documentSessions = consentByDocument.get(browser.document);
  if (documentSessions === undefined) {
    documentSessions = { sessions: new Map() };
    consentByDocument.set(browser.document, documentSessions);
  }
  const owner = documentSessions;
  const existing = owner.sessions.get(key);
  if (existing !== undefined) return existing.session;
  const created = createBrowserConsentSession(settings, browser, operation => {
    const previous = owner.active;
    owner.active = key;
    if (previous === undefined || previous === key) return operation();
    const notifyStoppedSession = owner.sessions.get(previous)?.stop();
    // A callback can take ownership again, so notify after the incoming transition settles.
    try {
      return operation();
    } finally {
      notifyStoppedSession?.();
    }
  });
  // Custom controls can retain a handle after its context stops. Keep it canonical for this document.
  owner.sessions.set(key, created);
  return created.session;
}
