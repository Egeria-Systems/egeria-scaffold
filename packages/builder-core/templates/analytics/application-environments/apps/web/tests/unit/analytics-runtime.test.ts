import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createAnalyticsConsentContext,
  createAnalyticsConsentRecord as createRecord,
  parseAnalyticsConsentRecord,
  type AnalyticsCollectionContext,
  type AnalyticsConsentContextEntry,
  type AnalyticsConsentRecordV3,
  type AnalyticsPurposeDecision,
} from "../../src/integrations/analytics/analytics-consent-state";
import type {
  AnalyticsPurposeIdentifier,
  AnalyticsSettings,
} from "../../src/integrations/analytics/analytics-provider-contract";
import {
  analyticsConsentStorageKey,
  browserAnalyticsConsentRuntime,
} from "../../src/integrations/analytics/analytics-runtime";

const now = new Date("2026-08-27T12:00:00.000Z");
const legacyStorageKey = "egeria.analytics.consent.v1";
const analyticsSettings: AnalyticsSettings = {
  consent: { policy: "explicit-opt-in" },
  providers: {
    cloudflareWebAnalytics: true,
    googleAnalytics4: true,
    microsoftClarity: {
      audience: "not-directed-to-minors",
    },
  },
  operationalIntegrations: {},
};

function collectionContext(context: readonly AnalyticsConsentContextEntry[], enabled = true): AnalyticsCollectionContext {
  const destinations = [
    { provider: "cloudflare-web-analytics", destination: "0123456789abcdef0123456789abcdef" },
    { provider: "google-analytics-4", destination: "G-TEST123456" },
    { provider: "microsoft-clarity", destination: "qatest1234" },
  ] as const;
  return { collectionEnabled: enabled, applicationEnvironment: "staging",
    siteOrigin: context.some(entry => entry.provider === "microsoft-clarity") ? "https://qa.analytics-test.invalid" : null,
    destinations: destinations.filter(entry => context.some(selected => selected.provider === entry.provider)),
  };
}
function createAnalyticsConsentRecord(decisions: readonly AnalyticsPurposeDecision[], context: readonly AnalyticsConsentContextEntry[], date: Date) {
  return createRecord(decisions, context, collectionContext(context), date);
}

type StorageListener = (event: StorageEvent) => void;

type TestScript = {
  async: boolean;
  dataset: Record<string, string>;
  defer: boolean;
  id: string;
  remove: () => void;
  src: string;
};

function purposeDecisions(
  settings: AnalyticsSettings,
  granted: readonly AnalyticsPurposeIdentifier[],
): readonly AnalyticsPurposeDecision[] {
  const grantedPurposes = new Set(granted);
  return createAnalyticsConsentContext(settings).map(({ purpose }) => ({
    purpose,
    decision: grantedPurposes.has(purpose) ? "granted" : "denied",
  }));
}

function storedRecord(
  settings: AnalyticsSettings,
  granted: readonly AnalyticsPurposeIdentifier[],
): AnalyticsConsentRecordV3 {
  return createAnalyticsConsentRecord(
    purposeDecisions(settings, granted),
    createAnalyticsConsentContext(settings),
    now,
  );
}

function createTestBrowser(
  initialStorage: Readonly<Record<string, string>> = {},
  cookies = "egeria_nonproduction_ga=one; egeria_nonproduction_ga_TEST123456=two; _ga=unrelated; egeria_production_ga=production; egeria_nonproduction_ga_OTHER123=other; _clck=three; _clsk=four; session=keep",
  emptyProviderGlobals = false,
) {
  const effects: string[] = [];
  const cookieWrites: string[] = [];
  const scripts: TestScript[] = [];
  const storedValues = new Map(Object.entries(initialStorage));
  const storageListeners = new Set<StorageListener>();

  const localStorage = {
    getItem: vi.fn((key: string) => {
      effects.push(`storage:get:${key}`);
      return storedValues.get(key) ?? null;
    }),
    removeItem: vi.fn((key: string) => {
      effects.push(`storage:remove:${key}`);
      storedValues.delete(key);
    }),
    setItem: vi.fn((key: string, value: string) => {
      effects.push(`storage:set:${key}`);
      storedValues.set(key, value);
    }),
  };
  const sessionStorage = {};
  const dataLayer = {
    entries: [] as unknown[][],
    rawEntries: [] as unknown[],
    push(parameters: unknown) {
      const normalized = Array.from(parameters as ArrayLike<unknown>);
      this.rawEntries.push(parameters);
      this.entries.push(normalized);
      effects.push(`google:${String(normalized[0])}:${String(normalized[1])}`);
      return this.entries.length;
    },
  };
  const clarity = vi.fn((...parameters: unknown[]) => {
    effects.push(`clarity:${String(parameters[0])}:${JSON.stringify(parameters[1])}`);
  });
  const reload = vi.fn(() => effects.push("reload"));
  const addEventListener = vi.fn(
    (type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === "storage") {
        storageListeners.add(listener as StorageListener);
      }
    },
  );
  const removeEventListener = vi.fn(
    (type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === "storage") {
        storageListeners.delete(listener as StorageListener);
      }
    },
  );
  const document = {
    get cookie() {
      return cookies;
    },
    set cookie(value: string) {
      cookieWrites.push(value);
      effects.push(`cookie:${value}`);
    },
    createElement: () => {
      const script: TestScript = {
        async: false,
        dataset: {},
        defer: false,
        id: "",
        remove: () => {
          effects.push(`remove-script:${script.id}`);
          const index = scripts.indexOf(script);
          if (index >= 0) scripts.splice(index, 1);
        },
        src: "",
      };
      return script;
    },
    getElementById: (identifier: string) =>
      scripts.find(({ id }) => id === identifier) ?? null,
    head: {
      append: (script: TestScript) => {
        scripts.push(script);
        effects.push(`append:${script.id}`);
      },
    },
  };
  const window = {
    addEventListener,
    clarity,
    dataLayer,
    localStorage,
    location: {
      hostname: "qa.analytics-test.invalid",
      origin: "https://qa.analytics-test.invalid",
      reload,
    },
    removeEventListener,
    sessionStorage,
  };

  if (emptyProviderGlobals) {
    Reflect.deleteProperty(window, "dataLayer");
    Reflect.deleteProperty(window, "clarity");
  }
  vi.stubGlobal("document", document);
  vi.stubGlobal("window", window);

  return {
    window,
    addEventListener,
    clarity,
    cookieWrites,
    dataLayer,
    effects,
    localStorage,
    reload,
    removeEventListener,
    scripts,
    sessionStorage,
    storedValues,
    dispatchStorage(
      newValue: string | null,
      key: string | null = analyticsConsentStorageKey,
      storageArea: Storage | null = localStorage as unknown as Storage,
    ) {
      for (const listener of storageListeners) {
        listener({ key, newValue, storageArea } as StorageEvent);
      }
    },
  };
}

function effectIndex(effects: readonly string[], prefix: string): number {
  return effects.findIndex((effect) => effect.startsWith(prefix));
}

describe("analytics consent runtime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.stubEnv("NEXT_PUBLIC_APPLICATION_ENVIRONMENT", "staging");
    vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN", "0123456789abcdef0123456789abcdef");
    vi.stubEnv("NEXT_PUBLIC_GA4_MEASUREMENT_ID", "G-TEST123456");
    vi.stubEnv("NEXT_PUBLIC_CLARITY_PROJECT_ID", "qatest1234");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://qa.analytics-test.invalid");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("keeps an accepted saved grant inactive when the compiled flag is false", () => {
    vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENABLED", "false");
    const context = createAnalyticsConsentContext(analyticsSettings);
    const decisions = purposeDecisions(analyticsSettings, context.map(entry => entry.purpose));
    const expectedCollectionContext = collectionContext(context, false);
    const record = createRecord(decisions, context, expectedCollectionContext, now);
    const source = JSON.stringify(record);
    expect(parseAnalyticsConsentRecord(source, context, expectedCollectionContext, now)).toEqual({ status: "valid", record });
    const browser = createTestBrowser({ [analyticsConsentStorageKey]: source }, "", true);
    const snapshot = browserAnalyticsConsentRuntime.initialize(analyticsSettings);
    expect(snapshot.resolution).toEqual({ status: "valid", record });
    expect(snapshot.decisions).toEqual(decisions);
    expect(browser.scripts).toEqual([]);
    for (const name of ["dataLayer", "gtag", "clarity"]) expect(browser.window).not.toHaveProperty(name);
  });

  it.each([undefined, "", "false", "TRUE", "true "])("blocks startup, save and cross-tab effects for raw flag %s", flag => {
    vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENABLED", flag);
    const browser = createTestBrowser({}, "", true);
    const denied = purposeDecisions(analyticsSettings, []);
    const context = createAnalyticsConsentContext(analyticsSettings);
    const granted = purposeDecisions(analyticsSettings, context.map(entry => entry.purpose));
    browserAnalyticsConsentRuntime.initialize(analyticsSettings);
    const saved = browserAnalyticsConsentRuntime.save(analyticsSettings, denied, granted);
    expect(saved.persistence).toBe("persisted");
    const current = collectionContext(context, false);
    const source = browser.storedValues.get(analyticsConsentStorageKey) ?? null;
    expect(parseAnalyticsConsentRecord(source, context, current, now).status).toBe("valid");
    const synchronized = vi.fn();
    const unsubscribe = browserAnalyticsConsentRuntime.subscribe(analyticsSettings, () => denied, synchronized);
    browser.dispatchStorage(source);
    expect(synchronized).toHaveBeenCalledWith(granted);
    unsubscribe();
    expect(browser.scripts).toEqual([]);
    for (const name of ["dataLayer", "gtag", "clarity"]) expect(browser.window).not.toHaveProperty(name);
  });

  it("creates no provider queues without a grant even when collection is enabled", () => {
    const browser = createTestBrowser({}, "", true);
    browserAnalyticsConsentRuntime.initialize(analyticsSettings);
    expect(browser.scripts).toEqual([]);
    for (const name of ["dataLayer", "gtag", "clarity"]) expect(browser.window).not.toHaveProperty(name);
  });

  it.each([
    ["aggregate-traffic-and-performance", "analytics-cloudflare-web-analytics", ["dataLayer", "gtag", "clarity"]],
    ["audience-measurement", "analytics-google-analytics-4", ["clarity"]],
    ["consented-experience-analysis", "analytics-microsoft-clarity", ["dataLayer", "gtag"]],
  ] as const)("initializes only the provider granted by %s", (purpose, scriptId, absent) => {
    const browser = createTestBrowser({}, "", true);
    const denied = purposeDecisions(analyticsSettings, []);
    const granted = purposeDecisions(analyticsSettings, [purpose]);
    browserAnalyticsConsentRuntime.initialize(analyticsSettings);
    browserAnalyticsConsentRuntime.save(analyticsSettings, denied, granted);
    expect(browser.scripts.map(script => script.id)).toEqual([scriptId]);
    for (const name of absent) expect(browser.window).not.toHaveProperty(name);
  });

  it("blocks the entire local set and reports only field names when one active ID is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_APPLICATION_ENVIRONMENT", "development");
    vi.stubEnv("NEXT_PUBLIC_GA4_MEASUREMENT_ID", "");
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const browser = createTestBrowser({}, "", true);
    const denied = purposeDecisions(analyticsSettings, []);
    const granted = purposeDecisions(analyticsSettings, createAnalyticsConsentContext(analyticsSettings).map(entry => entry.purpose));
    browserAnalyticsConsentRuntime.initialize(analyticsSettings);
    browserAnalyticsConsentRuntime.initialize(analyticsSettings);
    browserAnalyticsConsentRuntime.save(analyticsSettings, denied, granted);
    expect(browser.scripts).toEqual([]);
    for (const name of ["dataLayer", "gtag", "clarity"]) expect(browser.window).not.toHaveProperty(name);
    expect(warning.mock.calls).toEqual([["ANALYTICS_COLLECTION_DISABLED", "NEXT_PUBLIC_GA4_MEASUREMENT_ID"]]);
    warning.mockRestore();
  });

  it("blocks collection on a sibling or unexpected Clarity origin", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const browser = createTestBrowser({}, "", true);
    browser.window.location.origin = "https://sibling.analytics-test.invalid";
    browserAnalyticsConsentRuntime.save(analyticsSettings, purposeDecisions(analyticsSettings, []), purposeDecisions(analyticsSettings, createAnalyticsConsentContext(analyticsSettings).map(entry => entry.purpose)));
    expect(browser.scripts).toEqual([]);
    for (const name of ["dataLayer", "gtag", "clarity"]) expect(browser.window).not.toHaveProperty(name);
    expect(warning.mock.calls).toEqual([["ANALYTICS_COLLECTION_DISABLED", "NEXT_PUBLIC_SITE_URL"]]);
    warning.mockRestore();
  });

  it("withdraws an off-build decision without creating denial queues", () => {
    vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENABLED", "false");
    const browser = createTestBrowser({}, "", true);
    const granted = purposeDecisions(analyticsSettings, createAnalyticsConsentContext(analyticsSettings).map(entry => entry.purpose));
    const result = browserAnalyticsConsentRuntime.save(analyticsSettings, granted, purposeDecisions(analyticsSettings, []));
    expect(result.persistence).toBe("persisted");
    expect(result.reloading).toBe(true);
    for (const name of ["dataLayer", "gtag", "clarity"]) expect(browser.window).not.toHaveProperty(name);
  });

  it("queues provider defaults before applying valid grants and inserts each provider once", () => {
    const allGranted = purposeDecisions(
      analyticsSettings,
      createAnalyticsConsentContext(analyticsSettings).map(({ purpose }) => purpose),
    );
    const browser = createTestBrowser({
      [analyticsConsentStorageKey]: JSON.stringify(
        createAnalyticsConsentRecord(
          allGranted,
          createAnalyticsConsentContext(analyticsSettings),
          now,
        ),
      ),
    });

    const first = browserAnalyticsConsentRuntime.initialize(analyticsSettings);
    const second = browserAnalyticsConsentRuntime.initialize(analyticsSettings);

    expect(first).toMatchObject({
      resolution: { status: "valid" },
      decisions: allGranted,
    });
    expect(second.decisions).toEqual(allGranted);
    expect(browser.scripts.map(({ id }) => id)).toEqual([
      "analytics-cloudflare-web-analytics",
      "analytics-google-analytics-4",
      "analytics-microsoft-clarity",
    ]);
    expect(
      browser.dataLayer.entries.filter(
        ([command, operation]) => command === "consent" && operation === "update",
      ),
    ).toHaveLength(2);
    expect(browser.dataLayer.entries).toContainEqual([
      "consent",
      "default",
      {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      },
    ]);
    expect(browser.dataLayer.rawEntries).not.toHaveLength(0);
    expect(
      browser.dataLayer.rawEntries.every(
        (entry) =>
          !Array.isArray(entry) &&
          Object.prototype.toString.call(entry) === "[object Arguments]",
      ),
    ).toBe(true);
    const googleDefault = effectIndex(browser.effects, "google:consent:default");
    for (const laterEffect of [
      "google:consent:update",
      "google:js:",
      "google:config:",
      "append:analytics-google-analytics-4",
    ]) {
      expect(googleDefault).toBeLessThan(effectIndex(browser.effects, laterEffect));
    }
    expect(browser.dataLayer.entries).toContainEqual([
      "config", "G-TEST123456", {
        send_page_view: true, cookie_domain: "none", cookie_path: "/", cookie_prefix: "egeria_nonproduction",
        allow_google_signals: false, allow_ad_personalization_signals: false,
      },
    ]);
    const googleConsentCommands = browser.effects.filter((effect) =>
      effect.startsWith("google:consent:"),
    );
    expect(googleConsentCommands).toEqual([
      "google:consent:default",
      "google:consent:update",
      "google:consent:update",
    ]);
    const clarityDenied =
      'clarity:consentv2:{"ad_Storage":"denied","analytics_Storage":"denied"}';
    const clarityGranted =
      'clarity:consentv2:{"ad_Storage":"denied","analytics_Storage":"granted"}';
    const clarityConsentCommands = browser.effects.filter((effect) =>
      effect.startsWith("clarity:consentv2:"),
    );
    expect(clarityConsentCommands).toEqual([
      clarityDenied,
      clarityGranted,
      clarityGranted,
    ]);
    const clarityDefault = effectIndex(browser.effects, clarityDenied);
    expect(clarityDefault).toBeGreaterThanOrEqual(0);
    expect(clarityDefault).toBeLessThan(
      effectIndex(browser.effects, clarityGranted),
    );
    expect(clarityDefault).toBeLessThan(
      effectIndex(browser.effects, "append:analytics-microsoft-clarity"),
    );
  });

  it("loads no provider scripts without a valid purpose grant", () => {
    const browser = createTestBrowser();

    const snapshot = browserAnalyticsConsentRuntime.initialize(analyticsSettings);

    expect(snapshot.resolution).toEqual({ status: "undecided", reason: "missing" });
    expect(snapshot.decisions.every(({ decision }) => decision === "denied")).toBe(true);
    expect(browser.scripts).toEqual([]);
    expect(browser.effects).not.toContain("google:consent:update");
    expect(browser.effects).not.toContain(
      'clarity:consentv2:{"ad_Storage":"denied","analytics_Storage":"granted"}',
    );
  });

  it("persists an addition before loading only its newly permitted provider", () => {
    const browser = createTestBrowser({ [legacyStorageKey]: "granted" });
    const denied = purposeDecisions(analyticsSettings, []);
    const googleGranted = purposeDecisions(analyticsSettings, [
      "audience-measurement",
    ]);

    browserAnalyticsConsentRuntime.initialize(analyticsSettings);
    browser.effects.length = 0;
    const result = browserAnalyticsConsentRuntime.save(
      analyticsSettings,
      denied,
      googleGranted,
    );

    expect(result).toEqual({
      decisions: googleGranted,
      persistence: "persisted",
      reloading: false,
    });
    expect(browser.scripts.map(({ id }) => id)).toEqual([
      "analytics-google-analytics-4",
    ]);
    expect(effectIndex(browser.effects, `storage:set:${analyticsConsentStorageKey}`)).toBeLessThan(
      effectIndex(browser.effects, "append:analytics-google-analytics-4"),
    );
    expect(effectIndex(browser.effects, `storage:get:${analyticsConsentStorageKey}`)).toBeLessThan(
      effectIndex(browser.effects, `storage:remove:${legacyStorageKey}`),
    );
    expect(browser.storedValues.has(legacyStorageKey)).toBe(false);
  });

  it("treats a semantic read-back mismatch as session-only", () => {
    const browser = createTestBrowser();
    const denied = purposeDecisions(analyticsSettings, []);
    const googleGranted = purposeDecisions(analyticsSettings, [
      "audience-measurement",
    ]);
    const mismatched = JSON.stringify(storedRecord(analyticsSettings, []));
    browser.localStorage.setItem.mockImplementation((key: string) => {
      browser.effects.push(`storage:set:${key}`);
      browser.storedValues.set(key, mismatched);
    });

    const result = browserAnalyticsConsentRuntime.save(
      analyticsSettings,
      denied,
      googleGranted,
    );

    expect(result.persistence).toBe("session-only");
    expect(result.reloading).toBe(false);
    expect(browser.scripts.map(({ id }) => id)).toEqual([
      "analytics-google-analytics-4",
    ]);
  });

  it("classifies a concurrent retained grant before an addition-only return", () => {
    const browser = createTestBrowser();
    const previous = purposeDecisions(analyticsSettings, []);
    const next = purposeDecisions(analyticsSettings, [
      "audience-measurement",
    ]);
    const retained = purposeDecisions(analyticsSettings, [
      "consented-experience-analysis",
    ]);
    const retainedSource = JSON.stringify(
      createAnalyticsConsentRecord(
        retained,
        createAnalyticsConsentContext(analyticsSettings),
        now,
      ),
    );
    browser.localStorage.setItem.mockImplementation((key: string) => {
      browser.effects.push(`storage:set:${key}`);
      browser.storedValues.set(key, retainedSource);
    });
    browser.localStorage.removeItem.mockImplementation(() => {
      throw new Error("concurrent grant retained");
    });

    const result = browserAnalyticsConsentRuntime.save(
      analyticsSettings,
      previous,
      next,
    );

    expect(result).toEqual({
      decisions: retained,
      persistence: "stale-grant-retained",
      reloading: false,
    });
    expect(browser.scripts).toEqual([]);
    expect(browser.reload).not.toHaveBeenCalled();
    expect(browser.clarity).toHaveBeenCalledWith("consentv2", {
      ad_Storage: "denied",
      analytics_Storage: "denied",
    });
    expect(browser.clarity).toHaveBeenCalledWith("consent", false);
    expect(browser.cookieWrites).toContain(
      "_clck=; Max-Age=0; Path=/; SameSite=Lax",
    );
  });

  it("keeps a storage-unavailable addition session-only", () => {
    const browser = createTestBrowser();
    const previous = purposeDecisions(analyticsSettings, []);
    const next = purposeDecisions(analyticsSettings, [
      "audience-measurement",
    ]);
    browser.localStorage.setItem.mockImplementation(() => {
      throw new Error("write unavailable");
    });
    browser.localStorage.getItem.mockImplementation(() => {
      throw new Error("read unavailable");
    });

    const result = browserAnalyticsConsentRuntime.save(
      analyticsSettings,
      previous,
      next,
    );

    expect(result).toEqual({
      decisions: next,
      persistence: "session-only",
      reloading: false,
    });
    expect(browser.scripts.map(({ id }) => id)).toEqual([
      "analytics-google-analytics-4",
    ]);
  });

  it("persists reductions before denial, installation cookie cleanup, and reload", () => {
    const allPurposes = createAnalyticsConsentContext(analyticsSettings).map(
      ({ purpose }) => purpose,
    );
    const previous = purposeDecisions(analyticsSettings, allPurposes);
    const next = purposeDecisions(analyticsSettings, [
      "aggregate-traffic-and-performance",
    ]);
    const browser = createTestBrowser({
      [analyticsConsentStorageKey]: JSON.stringify(
        storedRecord(analyticsSettings, allPurposes),
      ),
    });
    browserAnalyticsConsentRuntime.initialize(analyticsSettings);
    browser.effects.length = 0;

    const result = browserAnalyticsConsentRuntime.save(
      analyticsSettings,
      previous,
      next,
    );

    expect(result).toEqual({
      decisions: next,
      persistence: "persisted",
      reloading: true,
    });
    const persisted = effectIndex(
      browser.effects,
      `storage:get:${analyticsConsentStorageKey}`,
    );
    expect(persisted).toBeLessThan(
      effectIndex(browser.effects, "google:consent:update"),
    );
    expect(persisted).toBeLessThan(
      effectIndex(
        browser.effects,
        'clarity:consentv2:{"ad_Storage":"denied","analytics_Storage":"denied"}',
      ),
    );
    expect(persisted).toBeLessThan(effectIndex(browser.effects, "cookie:egeria_nonproduction_ga="));
    expect(effectIndex(browser.effects, "cookie:egeria_nonproduction_ga=")).toBeLessThan(
      effectIndex(browser.effects, "reload"),
    );
    for (const cookieName of ["egeria_nonproduction_ga", "egeria_nonproduction_ga_TEST123456", "_clck", "_clsk"]) {
      expect(browser.cookieWrites).toContain(`${cookieName}=; Max-Age=0; Path=/; SameSite=Lax`);
    }
    for (const cookieName of ["_clck", "_clsk"]) {
      expect(browser.cookieWrites).toContain(`${cookieName}=; Max-Age=0; Path=/; Domain=qa.analytics-test.invalid; SameSite=Lax`);
      expect(browser.cookieWrites).toContain(`${cookieName}=; Max-Age=0; Path=/; Domain=analytics-test.invalid; SameSite=Lax`);
    }
    expect(browser.cookieWrites.filter(write => write.startsWith("egeria_")).some(write => write.includes("Domain="))).toBe(false);
    for (const name of ["_ga", "egeria_production_ga", "egeria_nonproduction_ga_OTHER123", "session"]) {
      expect(browser.cookieWrites.some(write => write.startsWith(`${name}=`))).toBe(false);
    }
    expect(browser.reload).toHaveBeenCalledOnce();
  });

  it("lets a reduction reload after a failed overwrite when current-record removal is verified", () => {
    const allPurposes = createAnalyticsConsentContext(analyticsSettings).map(
      ({ purpose }) => purpose,
    );
    const previous = purposeDecisions(analyticsSettings, allPurposes);
    const denied = purposeDecisions(analyticsSettings, []);
    const browser = createTestBrowser({
      [analyticsConsentStorageKey]: JSON.stringify(
        storedRecord(analyticsSettings, allPurposes),
      ),
    });
    browser.localStorage.setItem.mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    const result = browserAnalyticsConsentRuntime.save(
      analyticsSettings,
      previous,
      denied,
    );

    expect(result).toEqual({
      decisions: denied,
      persistence: "session-only",
      reloading: true,
    });
    expect(browser.storedValues.has(analyticsConsentStorageKey)).toBe(false);
    expect(browser.localStorage.removeItem).toHaveBeenCalledWith(
      analyticsConsentStorageKey,
    );
    expect(browser.reload).toHaveBeenCalledOnce();
  });

  it("keeps an unreadable reduction in the incomplete-revocation state", () => {
    const previous = purposeDecisions(analyticsSettings, [
      "audience-measurement",
    ]);
    const denied = purposeDecisions(analyticsSettings, []);
    const browser = createTestBrowser();
    browserAnalyticsConsentRuntime.save(analyticsSettings, purposeDecisions(analyticsSettings, []), previous);
    browser.localStorage.setItem.mockImplementation(() => {
      throw new Error("write unavailable");
    });
    browser.localStorage.removeItem.mockImplementation(() => {
      throw new Error("remove unavailable");
    });
    browser.localStorage.getItem.mockImplementation(() => {
      throw new Error("read unavailable");
    });

    const result = browserAnalyticsConsentRuntime.save(
      analyticsSettings,
      previous,
      denied,
    );

    expect(result).toEqual({
      decisions: previous,
      persistence: "stale-grant-retained",
      reloading: false,
    });
    expect(browser.dataLayer.entries).toContainEqual([
      "consent",
      "update",
      expect.objectContaining({ analytics_storage: "denied" }),
    ]);
    expect(browser.reload).not.toHaveBeenCalled();
  });

  it("retains a verified stale grant without additions or reload, then permits a successful retry", () => {
    const previous = purposeDecisions(analyticsSettings, [
      "audience-measurement",
      "consented-experience-analysis",
    ]);
    const next = purposeDecisions(analyticsSettings, [
      "aggregate-traffic-and-performance",
    ]);
    const browser = createTestBrowser({
      [analyticsConsentStorageKey]: JSON.stringify(
        createAnalyticsConsentRecord(
          previous,
          createAnalyticsConsentContext(analyticsSettings),
          now,
        ),
      ),
    });
    browserAnalyticsConsentRuntime.initialize(analyticsSettings);
    browser.localStorage.setItem.mockImplementation(() => {
      throw new Error("write failed");
    });
    browser.localStorage.removeItem.mockImplementation(() => {
      throw new Error("remove failed");
    });

    const retained = browserAnalyticsConsentRuntime.save(
      analyticsSettings,
      previous,
      next,
    );

    expect(retained).toEqual({
      decisions: previous,
      persistence: "stale-grant-retained",
      reloading: false,
    });
    expect(browser.reload).not.toHaveBeenCalled();
    expect(browser.scripts.map(({ id }) => id)).not.toContain(
      "analytics-cloudflare-web-analytics",
    );
    expect(browser.dataLayer.entries).toContainEqual([
      "consent",
      "update",
      {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      },
    ]);
    expect(browser.clarity).toHaveBeenCalledWith("consentv2", {
      ad_Storage: "denied",
      analytics_Storage: "denied",
    });
    expect(browser.clarity).toHaveBeenCalledWith("consent", false);
    expect(
      browser.effects.some((effect) =>
        effect.startsWith("remove-script:analytics-cloudflare-web-analytics"),
      ),
    ).toBe(false);
    expect(browser.effects).not.toContain(
      "append:analytics-cloudflare-web-analytics",
    );
    expect(browser.cookieWrites).toEqual(
      expect.arrayContaining([
        "egeria_nonproduction_ga=; Max-Age=0; Path=/; SameSite=Lax",
        "_clck=; Max-Age=0; Path=/; SameSite=Lax",
      ]),
    );

    browser.localStorage.setItem.mockImplementation((key: string, value: string) => {
      browser.storedValues.set(key, value);
    });
    browser.localStorage.removeItem.mockImplementation((key: string) => {
      browser.storedValues.delete(key);
    });
    const retried = browserAnalyticsConsentRuntime.save(
      analyticsSettings,
      retained.decisions,
      next,
    );

    expect(retried).toEqual({
      decisions: next,
      persistence: "persisted",
      reloading: true,
    });
    expect(browser.reload).toHaveBeenCalledOnce();
  });

  it("lets a persisted mixed transition reduce safely without loading its addition", () => {
    const previous = purposeDecisions(analyticsSettings, [
      "audience-measurement",
    ]);
    const next = purposeDecisions(analyticsSettings, [
      "consented-experience-analysis",
    ]);
    const browser = createTestBrowser();

    const result = browserAnalyticsConsentRuntime.save(
      analyticsSettings,
      previous,
      next,
    );

    expect(result.reloading).toBe(true);
    expect(browser.scripts.map(({ id }) => id)).not.toContain(
      "analytics-microsoft-clarity",
    );
    expect(browser.reload).toHaveBeenCalledOnce();
  });

  it("synchronizes cross-tab additions incrementally and disposes the exact listener", () => {
    const browser = createTestBrowser();
    const current = purposeDecisions(analyticsSettings, []);
    const next = purposeDecisions(analyticsSettings, [
      "consented-experience-analysis",
    ]);
    const synchronized = vi.fn();
    browserAnalyticsConsentRuntime.initialize(analyticsSettings);
    browser.effects.length = 0;
    const dispose = browserAnalyticsConsentRuntime.subscribe(
      analyticsSettings,
      () => current,
      synchronized,
    );

    browser.dispatchStorage(
      JSON.stringify(
        createAnalyticsConsentRecord(
          next,
          createAnalyticsConsentContext(analyticsSettings),
          now,
        ),
      ),
    );

    expect(synchronized).toHaveBeenCalledWith(next);
    expect(browser.scripts.map(({ id }) => id)).toEqual([
      "analytics-microsoft-clarity",
    ]);
    expect(browser.reload).not.toHaveBeenCalled();
    const registered = browser.addEventListener.mock.calls[0]?.[1];
    dispose();
    expect(browser.removeEventListener).toHaveBeenCalledWith(
      "storage",
      registered,
    );
    browser.dispatchStorage(JSON.stringify(storedRecord(analyticsSettings, [])));
    expect(synchronized).toHaveBeenCalledOnce();
  });

  it("ignores same-key events from non-authoritative storage", () => {
    const browser = createTestBrowser();
    const current = purposeDecisions(analyticsSettings, []);
    const next = purposeDecisions(analyticsSettings, [
      "consented-experience-analysis",
    ]);
    const synchronized = vi.fn();
    browserAnalyticsConsentRuntime.subscribe(
      analyticsSettings,
      () => current,
      synchronized,
    );

    browser.dispatchStorage(
      JSON.stringify(
        createAnalyticsConsentRecord(
          next,
          createAnalyticsConsentContext(analyticsSettings),
          now,
        ),
      ),
      analyticsConsentStorageKey,
      browser.sessionStorage as Storage,
    );

    expect(synchronized).not.toHaveBeenCalled();
    expect(browser.scripts).toEqual([]);
    expect(browser.reload).not.toHaveBeenCalled();
  });

  it("fails closed when authoritative local storage is cleared", () => {
    const browser = createTestBrowser();
    const current = purposeDecisions(analyticsSettings, [
      "audience-measurement",
      "consented-experience-analysis",
    ]);
    browserAnalyticsConsentRuntime.save(analyticsSettings, purposeDecisions(analyticsSettings, []), current);
    const synchronized = vi.fn();
    browserAnalyticsConsentRuntime.subscribe(
      analyticsSettings,
      () => current,
      synchronized,
    );

    browser.dispatchStorage(null, null);

    expect(synchronized).toHaveBeenCalledWith(
      purposeDecisions(analyticsSettings, []),
    );
    expect(browser.dataLayer.entries).toContainEqual([
      "consent",
      "update",
      expect.objectContaining({ analytics_storage: "denied" }),
    ]);
    expect(browser.clarity).toHaveBeenCalledWith("consent", false);
    expect(browser.reload).toHaveBeenCalledOnce();
  });

  it.each([
    ["removed", null],
    ["malformed", "{"],
    [
      "expired",
      JSON.stringify({
        ...storedRecord(analyticsSettings, []),
        decidedAt: "2026-02-28T12:00:00.000Z",
        expiresAt: "2026-08-27T12:00:00.000Z",
      }),
    ],
    [
      "notice-mismatched",
      JSON.stringify({
        ...storedRecord(analyticsSettings, []),
        noticeVersion: 2,
      }),
    ],
    [
      "context-mismatched",
      JSON.stringify({
        ...storedRecord(analyticsSettings, []),
        providerPurposeContext: createAnalyticsConsentContext({
          consent: { policy: "explicit-opt-in" },
          providers: {
            googleAnalytics4: true,
          },
          operationalIntegrations: {},
        }),
        purposes: purposeDecisions(
          {
            consent: { policy: "explicit-opt-in" },
            providers: {
              googleAnalytics4: true,
            },
            operationalIntegrations: {},
          },
          [],
        ),
      }),
    ],
  ])("fails closed for a %s external record", (_label, newValue) => {
    const browser = createTestBrowser();
    const current = purposeDecisions(analyticsSettings, [
      "audience-measurement",
      "consented-experience-analysis",
    ]);
    browserAnalyticsConsentRuntime.save(analyticsSettings, purposeDecisions(analyticsSettings, []), current);
    const synchronized = vi.fn();
    browserAnalyticsConsentRuntime.subscribe(
      analyticsSettings,
      () => current,
      synchronized,
    );

    browser.dispatchStorage(newValue);

    expect(synchronized).toHaveBeenCalledWith(
      purposeDecisions(analyticsSettings, []),
    );
    expect(browser.dataLayer.entries).toContainEqual([
      "consent",
      "update",
      expect.objectContaining({ analytics_storage: "denied" }),
    ]);
    expect(browser.clarity).toHaveBeenCalledWith("consent", false);
    expect(browser.reload).toHaveBeenCalledOnce();
  });

  it("applies a valid cross-tab reduction before safely reloading", () => {
    const browser = createTestBrowser();
    const current = purposeDecisions(analyticsSettings, [
      "audience-measurement",
      "consented-experience-analysis",
    ]);
    const reduced = purposeDecisions(analyticsSettings, [
      "audience-measurement",
    ]);
    const synchronized = vi.fn();
    browserAnalyticsConsentRuntime.subscribe(
      analyticsSettings,
      () => current,
      synchronized,
    );

    browser.dispatchStorage(
      JSON.stringify(
        createAnalyticsConsentRecord(
          reduced,
          createAnalyticsConsentContext(analyticsSettings),
          now,
        ),
      ),
    );

    expect(synchronized).toHaveBeenCalledWith(reduced);
    expect(browser.clarity).toHaveBeenCalledWith("consent", false);
    expect(effectIndex(browser.effects, "clarity:consent:false")).toBeLessThan(
      effectIndex(browser.effects, "reload"),
    );
    expect(browser.reload).toHaveBeenCalledOnce();
  });
});
