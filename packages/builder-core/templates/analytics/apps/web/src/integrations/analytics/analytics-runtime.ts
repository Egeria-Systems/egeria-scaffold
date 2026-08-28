import {
  compareAnalyticsPurposeDecisions,
  createAnalyticsConsentContext,
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
export const analyticsConsentStorageKey = "egeria.analytics.consent.v2";

const legacyAnalyticsConsentStorageKey = "egeria.analytics.consent.v1";

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
  dataLayer?: unknown[][];
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
  browser.window.dataLayer ??= [];
  browser.window.gtag ??= (...parameters: unknown[]) => {
    browser.window.dataLayer?.push(parameters);
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

function configureProviderDefaults(
  settings: AnalyticsSettings,
  browser: AnalyticsBrowser,
): void {
  if (settings.providers.googleAnalytics4 !== undefined) {
    configureGoogleConsent(browser, "default", "denied");
  }
  if (settings.providers.microsoftClarity !== undefined) {
    configureClarityConsent(browser, "denied");
  }
}

function loadCloudflareWebAnalytics(
  settings: AnalyticsSettings,
  declaration: AnalyticsProviderDeclaration,
  browser: AnalyticsBrowser,
): void {
  const provider = settings.providers.cloudflareWebAnalytics;
  if (provider === undefined) {
    return;
  }

  insertScript(browser, declaration, declaration.scriptSource, (script) => {
    script.defer = true;
    script.dataset.cfBeacon = JSON.stringify({ token: provider.siteToken });
  });
}

function loadGoogleAnalytics4(
  settings: AnalyticsSettings,
  declaration: AnalyticsProviderDeclaration,
  browser: AnalyticsBrowser,
): void {
  const provider = settings.providers.googleAnalytics4;
  if (provider === undefined) {
    return;
  }

  configureGoogleConsent(browser, "update", "granted");
  if (browser.document.getElementById(declaration.scriptId) !== null) {
    return;
  }

  googleCommand(browser)("js", new Date());
  googleCommand(browser)("config", provider.measurementId, {
    send_page_view: true,
  });
  insertScript(
    browser,
    declaration,
    `${declaration.scriptSource}?id=${encodeURIComponent(provider.measurementId)}`,
  );
}

function loadMicrosoftClarity(
  settings: AnalyticsSettings,
  declaration: AnalyticsProviderDeclaration,
  browser: AnalyticsBrowser,
): void {
  const provider = settings.providers.microsoftClarity;
  if (provider === undefined) {
    return;
  }

  configureClarityConsent(browser, "granted");
  insertScript(
    browser,
    declaration,
    `${declaration.scriptSource}${encodeURIComponent(provider.projectId)}`,
  );
}

function loadPurposes(
  settings: AnalyticsSettings,
  purposes: readonly AnalyticsPurposeIdentifier[],
  browser: AnalyticsBrowser,
): void {
  const permitted = new Set(purposes);
  for (const declaration of createAnalyticsProviderDeclarations(settings)) {
    if (!permitted.has(declaration.purpose)) {
      continue;
    }

    switch (declaration.identifier) {
      case "cloudflare-web-analytics":
        loadCloudflareWebAnalytics(settings, declaration, browser);
        break;
      case "google-analytics-4":
        loadGoogleAnalytics4(settings, declaration, browser);
        break;
      case "microsoft-clarity":
        loadMicrosoftClarity(settings, declaration, browser);
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
  browser: AnalyticsBrowser,
  declarations: readonly AnalyticsProviderDeclaration[],
): void {
  const cleanupRules = declarations.flatMap(
    ({ cookieCleanupRules }) => cookieCleanupRules,
  );
  const domainVariants = cookieDomainVariants(browser.window.location.hostname);
  for (const cookie of browser.document.cookie.split(";")) {
    const name = cookie.split("=", 1)[0]?.trim();
    if (
      name === undefined ||
      !cleanupRules.some((rule) => matchesCookieRule(name, rule))
    ) {
      continue;
    }

    browser.document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
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
        configureGoogleConsent(browser, "update", "denied");
        break;
      case "microsoft-clarity":
        configureClarityConsent(browser, "denied");
        clarityCommand(browser)("consent", false);
        break;
    }

    browser.document.getElementById(declaration.scriptId)?.remove();
  }
  clearAccessibleCookies(browser, declarations);
}

type StoredConsentRead = Readonly<{
  readable: boolean;
  resolution: AnalyticsConsentResolution;
}>;

function readStoredConsent(
  browser: AnalyticsBrowser,
  settings: AnalyticsSettings,
): StoredConsentRead {
  try {
    const source = browser.window.localStorage.getItem(analyticsConsentStorageKey);
    return {
      readable: true,
      resolution: parseAnalyticsConsentRecord(
        source,
        createAnalyticsConsentContext(settings),
        new Date(),
      ),
    };
  } catch {
    return {
      readable: false,
      resolution: parseAnalyticsConsentRecord(
        null,
        createAnalyticsConsentContext(settings),
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
  const record = createAnalyticsConsentRecord(
    decisions,
    createAnalyticsConsentContext(settings),
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
      browser.window.localStorage.removeItem(legacyAnalyticsConsentStorageKey);
    } catch {
      // The verified v2 record is authoritative; v1 removal is best effort.
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
  configureProviderDefaults(settings, browser);
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

    const resolution = parseAnalyticsConsentRecord(
      event.newValue,
      context,
      new Date(),
    );
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
