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

export type AnalyticsConsentSnapshot = Readonly<{
  resolution: AnalyticsConsentResolution;
  decisions: readonly AnalyticsPurposeDecision[];
}>;

export type AnalyticsConsentSaveResult = Readonly<{
  decisions: readonly AnalyticsPurposeDecision[];
  persistence: AnalyticsConsentPersistence;
  reloading: boolean;
}>;

export type AnalyticsConsentRuntime = Readonly<{
  initialize: (settings: AnalyticsSettings) => AnalyticsConsentSnapshot;
  save: (
    settings: AnalyticsSettings,
    previous: readonly AnalyticsPurposeDecision[],
    next: readonly AnalyticsPurposeDecision[],
  ) => AnalyticsConsentSaveResult;
  subscribe: (
    settings: AnalyticsSettings,
    current: () => readonly AnalyticsPurposeDecision[],
    synchronized: (decisions: readonly AnalyticsPurposeDecision[]) => void,
  ) => () => void;
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

function applyReductionEffects(
  settings: AnalyticsSettings,
  removedPurposes: readonly AnalyticsPurposeIdentifier[],
  browser: AnalyticsBrowser,
): void {
  const removed = new Set(removedPurposes);
  const declarations = createAnalyticsProviderDeclarations(settings).filter(
    ({ purpose }) => removed.has(purpose),
  );

  for (const declaration of declarations) {
    switch (declaration.identifier) {
      case "cloudflare-web-analytics":
        break;
      case "google-analytics-4":
        if (typeof browser.window.gtag === "function") configureGoogleConsent(browser, "update", "denied");
        break;
      case "microsoft-clarity":
        if (typeof browser.window.clarity === "function") {
          configureClarityConsent(browser, "denied");
          browser.window.clarity("consent", false);
        }
        break;
    }

    browser.document.getElementById(declaration.scriptId)?.remove();
  }
  clearAccessibleCookies(settings, browser, declarations);
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

function initialize(
  settings: AnalyticsSettings,
  browser: AnalyticsBrowser,
): AnalyticsConsentSnapshot {
  const { resolution } = readStoredConsent(browser, settings);
  const decisions =
    resolution.status === "valid"
      ? resolution.record.purposes
      : deniedDecisions(settings);
  loadPurposes(settings, grantedPurposes(decisions), browser);
  return { resolution, decisions };
}

function save(
  settings: AnalyticsSettings,
  previous: readonly AnalyticsPurposeDecision[],
  next: readonly AnalyticsPurposeDecision[],
  browser: AnalyticsBrowser,
): AnalyticsConsentSaveResult {
  const transition = compareAnalyticsPurposeDecisions(previous, next);
  const persistence = persistDecisions(settings, next, browser);

  if (
    !persistence.persisted &&
    transition.removed.length === 0 &&
    persistence.stored.resolution.status === "valid"
  ) {
    const retainedTransition = compareAnalyticsPurposeDecisions(
      persistence.stored.resolution.record.purposes,
      next,
    );
    if (retainedTransition.removed.length > 0) {
      applyReductionEffects(settings, retainedTransition.removed, browser);
      return {
        decisions: persistence.stored.resolution.record.purposes,
        persistence: "stale-grant-retained",
        reloading: false,
      };
    }
  }

  if (transition.removed.length === 0) {
    loadPurposes(settings, transition.added, browser);
    return {
      decisions: next,
      persistence: persistence.persisted ? "persisted" : "session-only",
      reloading: false,
    };
  }

  if (persistence.persisted) {
    applyReductionEffects(settings, transition.removed, browser);
    browser.window.location.reload();
    return { decisions: next, persistence: "persisted", reloading: true };
  }

  const remaining = removeUnverifiedRecord(settings, browser);
  if (
    remaining.resolution.status === "valid" &&
    compareAnalyticsPurposeDecisions(
      remaining.resolution.record.purposes,
      next,
    ).removed.length > 0
  ) {
    const stillRemoved = compareAnalyticsPurposeDecisions(
      remaining.resolution.record.purposes,
      next,
    ).removed;
    applyReductionEffects(settings, stillRemoved, browser);
    return {
      decisions: remaining.resolution.record.purposes,
      persistence: "stale-grant-retained",
      reloading: false,
    };
  }

  applyReductionEffects(settings, transition.removed, browser);
  if (!remaining.readable) {
    return {
      decisions: previous,
      persistence: "stale-grant-retained",
      reloading: false,
    };
  }
  browser.window.location.reload();
  return { decisions: next, persistence: "session-only", reloading: true };
}

function subscribe(
  settings: AnalyticsSettings,
  current: () => readonly AnalyticsPurposeDecision[],
  synchronized: (decisions: readonly AnalyticsPurposeDecision[]) => void,
  browser: AnalyticsBrowser,
): () => void {
  const context = createAnalyticsConsentContext(settings);
  const listener = (event: StorageEvent): void => {
    if (
      event.storageArea !== browser.window.localStorage ||
      (event.key !== analyticsConsentStorageKey && event.key !== null)
    ) {
      return;
    }

    const configuration = readCompiledAnalyticsConfiguration(settings);
    const resolution: AnalyticsConsentResolution = configuration.ok ? parseAnalyticsConsentRecord(
      event.newValue,
      context,
      createAnalyticsCollectionContext(settings, configuration.configuration),
      new Date(),
    ) : { status: "undecided", reason: "invalid" };
    const previous = current();
    if (resolution.status !== "valid") {
      const next = deniedDecisions(settings);
      const transition = compareAnalyticsPurposeDecisions(previous, next);
      synchronized(next);
      applyReductionEffects(settings, transition.removed, browser);
      browser.window.location.reload();
      return;
    }

    const next = resolution.record.purposes;
    const transition = compareAnalyticsPurposeDecisions(previous, next);
    if (transition.removed.length > 0) {
      synchronized(next);
      applyReductionEffects(settings, transition.removed, browser);
      browser.window.location.reload();
      return;
    }

    loadPurposes(settings, transition.added, browser);
    synchronized(next);
  };

  browser.window.addEventListener("storage", listener);
  return () => browser.window.removeEventListener("storage", listener);
}

export const browserAnalyticsConsentRuntime: AnalyticsConsentRuntime = {
  initialize: (settings) => initialize(settings, currentBrowser()),
  save: (settings, previous, next) =>
    save(settings, previous, next, currentBrowser()),
  subscribe: (settings, current, synchronized) =>
    subscribe(settings, current, synchronized, currentBrowser()),
};
