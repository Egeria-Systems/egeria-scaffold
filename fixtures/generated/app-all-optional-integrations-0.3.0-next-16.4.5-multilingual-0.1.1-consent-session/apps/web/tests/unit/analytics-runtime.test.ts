import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createAnalyticsConsentContext,
  createAnalyticsConsentRecord as createRecord,
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
  getBrowserAnalyticsConsentSession,
} from "../../src/integrations/analytics/analytics-runtime";

const now = new Date("2026-08-27T12:00:00.000Z");
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
      for (const listener of [...storageListeners]) {
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

  const key = analyticsConsentStorageKey;
  const google = "audience-measurement";
  const cloudflare = "aggregate-traffic-and-performance";
  const clarity = "consented-experience-analysis";
  const denied = purposeDecisions(analyticsSettings, []);
  const decide = (...granted: AnalyticsPurposeIdentifier[]) => purposeDecisions(analyticsSettings, granted);
  const record = (...granted: AnalyticsPurposeIdentifier[]) => JSON.stringify(storedRecord(analyticsSettings, granted));
  const failStorage = () => { throw new Error("storage unavailable"); };
  const present = (browser: ReturnType<typeof createTestBrowser>) => browser.scripts.map(({ id }) => id);
  const storageListeners = (browser: ReturnType<typeof createTestBrowser>) =>
    browser.addEventListener.mock.calls.filter(([event]) => event === "storage").length -
    browser.removeEventListener.mock.calls.filter(([event]) => event === "storage").length;

  it("revokes active providers from a verified remote choice while no controls are subscribed", () => {
    const browser = createTestBrowser({ [key]: record(google) });
    const session = getBrowserAnalyticsConsentSession(analyticsSettings);
    const unsubscribe = session.subscribe(vi.fn());
    expect(present(browser)).toEqual(["analytics-google-analytics-4"]);
    unsubscribe();
    expect(storageListeners(browser)).toBe(1);

    const denial = record();
    browser.storedValues.set(key, denial);
    browser.dispatchStorage(denial);

    expect(present(browser)).toEqual([]);
    expect(browser.reload).toHaveBeenCalledOnce();
    expect(session.getSnapshot().decisions).toEqual(denied);
  });

  it("uses a stable denied seed without reading storage or loading provider code", () => {
    const browser = createTestBrowser({ [key]: record(google) }, "", true);
    const session = getBrowserAnalyticsConsentSession(analyticsSettings);
    expect(session.getSnapshot()).toMatchObject({ decisions: denied, hasChoice: false });
    expect(session.getSnapshot()).toBe(session.getSnapshot());
    expect(browser.effects).toEqual([]);
    expect(storageListeners(browser)).toBe(0);
  });

  it.each([
    [google, "analytics-google-analytics-4"],
    [cloudflare, "analytics-cloudflare-web-analytics"],
    [clarity, "analytics-microsoft-clarity"],
  ] as const)("loads only the configured provider for a verified %s grant", (purpose, scriptId) => {
    const browser = createTestBrowser({ [key]: record(purpose) }, "", true);
    const session = getBrowserAnalyticsConsentSession(analyticsSettings);
    session.subscribe(() => {});
    expect(session.getSnapshot()).toEqual({ decisions: decide(purpose), hasChoice: true, persistence: "persisted" });
    expect(present(browser)).toEqual([scriptId]);
    const first = session.getSnapshot();
    const off = session.subscribe(() => {});
    off();
    expect(session.getSnapshot()).toBe(first);
    expect(storageListeners(browser)).toBe(1);
  });

  it("removes idle listeners after the last unsubscribe and verifies the current record on return", () => {
    const browser = createTestBrowser();
    const session = getBrowserAnalyticsConsentSession(analyticsSettings);
    const first = vi.fn();
    const second = vi.fn();
    const offFirst = session.subscribe(first);
    const offSecond = session.subscribe(second);
    expect(storageListeners(browser)).toBe(1);
    offFirst();
    offFirst();
    expect(storageListeners(browser)).toBe(1);
    offSecond();
    expect(storageListeners(browser)).toBe(0);

    browser.storedValues.set(key, record(google));
    expect(present(browser)).toEqual([]);
    const resumed = getBrowserAnalyticsConsentSession(structuredClone(analyticsSettings));
    expect(resumed).toBe(session);
    resumed.subscribe(second);
    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
    expect(present(browser)).toEqual(["analytics-google-analytics-4"]);
  });

  it("isolates separate documents and consent settings without retaining the old listener", () => {
    const first = createTestBrowser({ [key]: record(google) });
    const session = getBrowserAnalyticsConsentSession(analyticsSettings);
    const unsubscribe = session.subscribe(() => {});
    const googleOnly: AnalyticsSettings = { ...analyticsSettings, providers: { googleAnalytics4: true } };
    const differentContext = getBrowserAnalyticsConsentSession(googleOnly);
    const differentOff = differentContext.subscribe(() => {});
    expect(differentContext).not.toBe(session);
    expect(differentContext.getSnapshot()).toMatchObject({ decisions: purposeDecisions(googleOnly, []), hasChoice: false });
    expect(present(first)).toEqual([]);
    expect(storageListeners(first)).toBe(1);
    unsubscribe();
    differentOff();
    expect(storageListeners(first)).toBe(0);

    const second = createTestBrowser();
    const newDocument = getBrowserAnalyticsConsentSession(analyticsSettings);
    newDocument.subscribe(() => {});
    expect(newDocument).not.toBe(session);
    expect(newDocument.getSnapshot()).toMatchObject({ decisions: denied, hasChoice: false });
    expect(present(second)).toEqual([]);
  });

  it.each(["corrupt", "expired", "wrong context", "absent", "unreadable"] as const)(
    "begins denied when storage is %s",
    state => {
      const valid = storedRecord(analyticsSettings, [google]);
      const expired = createAnalyticsConsentRecord(decide(google), createAnalyticsConsentContext(analyticsSettings), new Date("2025-08-27T12:00:00Z"));
      const stored = {
        corrupt: "{",
        expired: JSON.stringify(expired),
        "wrong context": JSON.stringify({ ...valid, collectionContext: { ...valid.collectionContext, siteOrigin: "https://other.invalid" } }),
        absent: null,
        unreadable: JSON.stringify(valid),
      }[state];
      const browser = createTestBrowser(stored === null ? {} : { [key]: stored });
      if (state === "unreadable") browser.localStorage.getItem.mockImplementation(failStorage);
      const session = getBrowserAnalyticsConsentSession(analyticsSettings);
      session.subscribe(() => {});
      expect(session.getSnapshot()).toMatchObject({ decisions: denied, hasChoice: false });
      expect(present(browser)).toEqual([]);
    },
  );

  it("preserves a session-only choice through remount without notifying another document", () => {
    const browser = createTestBrowser();
    const session = getBrowserAnalyticsConsentSession(analyticsSettings);
    const unsubscribe = session.subscribe(() => {});
    browser.localStorage.setItem.mockImplementation(failStorage);
    expect(session.save(decide(google))).toEqual({ persistence: "session-only", reloading: false });
    expect(present(browser)).toEqual(["analytics-google-analytics-4"]);
    expect(browser.storedValues.has(key)).toBe(false);
    unsubscribe();
    getBrowserAnalyticsConsentSession(structuredClone(analyticsSettings)).subscribe(() => {});
    expect(session.getSnapshot()).toEqual({ decisions: decide(google), hasChoice: true, persistence: "session-only" });
    const other = createTestBrowser();
    expect(getBrowserAnalyticsConsentSession(analyticsSettings).getSnapshot().decisions).toEqual(denied);
    expect(present(other)).toEqual([]);
  });

  it.each(["absent remaining record", "verified record"] as const)(
    "stops only the withdrawn provider and reloads after a %s",
    mode => {
      const browser = createTestBrowser({ [key]: record(google, clarity) });
      const session = getBrowserAnalyticsConsentSession(analyticsSettings);
      session.subscribe(() => {});
      if (mode === "absent remaining record") browser.localStorage.setItem.mockImplementation(failStorage);
      const result = session.save(decide(clarity));
      expect(result).toEqual({
        persistence: mode === "verified record" ? "persisted" : "session-only", reloading: true,
      });
      expect(present(browser)).toEqual(mode === "verified record" ? ["analytics-microsoft-clarity"] : []);
      expect(browser.reload).toHaveBeenCalledOnce();
      expect(effectIndex(browser.effects, "remove-script:analytics-google-analytics-4")).toBeLessThan(effectIndex(browser.effects, "reload"));
      expect(browser.cookieWrites.some(value => value.startsWith("egeria_nonproduction_ga="))).toBe(true);
      expect(browser.cookieWrites.some(value => /^(?:_ga|egeria_production_ga|egeria_nonproduction_ga_OTHER123|session)=/u.test(value))).toBe(false);
    },
  );

  it("preserves a disputed mixed choice and refuses a stale grant across remounts", () => {
    const stale = record(google);
    const browser = createTestBrowser({ [key]: stale });
    const session = getBrowserAnalyticsConsentSession(analyticsSettings);
    const stop = session.subscribe(() => {});
    browser.localStorage.setItem.mockImplementation(failStorage);
    browser.localStorage.removeItem.mockImplementation(failStorage);
    const mixed = decide(clarity);
    expect(session.save(mixed)).toEqual({ persistence: "stale-grant-retained", reloading: false });
    expect(session.getSnapshot()).toMatchObject({ retry: mixed, decisions: denied, persistence: "stale-grant-retained" });
    stop();

    browser.dispatchStorage(stale);
    getBrowserAnalyticsConsentSession(structuredClone(analyticsSettings)).subscribe(() => {});
    expect(session.getSnapshot()).toMatchObject({ retry: mixed, decisions: denied, persistence: "stale-grant-retained" });
    expect(present(browser)).toEqual([]);
    expect(browser.reload).not.toHaveBeenCalled();
    expect(browser.effects.filter(effect => effect === "append:analytics-google-analytics-4")).toHaveLength(1);

    const accepted = record(clarity);
    browser.storedValues.set(key, accepted);
    browser.dispatchStorage(accepted);
    expect(browser.reload).toHaveBeenCalledOnce();
    expect(session.getSnapshot()).toEqual({ decisions: mixed, hasChoice: true, persistence: "persisted" });
    expect(present(browser)).toEqual([]);
  });

  it.each(["save", "storage event", "disputed save"] as const)(
    "settles withdrawal effects and notifies the other subscriber when a subscriber throws during %s",
    action => {
      const browser = createTestBrowser({ [key]: record(google) });
      const session = getBrowserAnalyticsConsentSession(analyticsSettings);
      const unsubscribeBroken = session.subscribe(() => {
        if (session.getSnapshot().decisions.every(({ decision }) => decision === "denied")) {
          throw new Error("subscriber failure");
        }
      });
      const observedDenial = vi.fn(() => ({
        decisions: session.getSnapshot().decisions,
        scripts: present(browser),
        reloads: browser.reload.mock.calls.length,
      }));
      const unsubscribeHealthy = session.subscribe(observedDenial);
      expect(present(browser)).toEqual(["analytics-google-analytics-4"]);

      const disputed = action === "disputed save";
      if (disputed) {
        browser.localStorage.setItem.mockImplementation(failStorage);
        browser.localStorage.removeItem.mockImplementation(failStorage);
      }
      vi.spyOn(console, "error").mockImplementation(() => {});
      expect(() => {
        if (action === "storage event") {
          const denial = record();
          browser.storedValues.set(key, denial);
          browser.dispatchStorage(denial);
        } else {
          session.save(denied);
        }
      }).not.toThrow();

      expect(present(browser)).toEqual([]);
      expect(browser.reload).toHaveBeenCalledTimes(disputed ? 0 : 1);
      expect(observedDenial).toHaveBeenCalledOnce();
      expect(observedDenial).toHaveReturnedWith({ decisions: denied, scripts: [], reloads: disputed ? 0 : 1 });
      expect(session.getSnapshot().persistence).toBe(disputed ? "stale-grant-retained" : "persisted");
      unsubscribeBroken();
      unsubscribeHealthy();
      expect(storageListeners(browser)).toBe(disputed ? 1 : 0);
    },
  );

  it("preserves a disputed mixed choice when switching away and back in one document", () => {
    const stale = record(google, clarity);
    const browser = createTestBrowser({ [key]: stale });
    const original = getBrowserAnalyticsConsentSession(analyticsSettings);
    const unsubscribe = original.subscribe(() => {});
    browser.localStorage.setItem.mockImplementation(failStorage);
    browser.localStorage.removeItem.mockImplementation(failStorage);
    const attempted = decide(clarity, cloudflare);
    expect(original.save(attempted)).toEqual({ persistence: "stale-grant-retained", reloading: false });
    expect(present(browser)).toEqual(["analytics-microsoft-clarity"]);
    unsubscribe();
    expect(storageListeners(browser)).toBe(1);

    const otherSettings: AnalyticsSettings = { ...analyticsSettings, providers: { googleAnalytics4: true } };
    const other = getBrowserAnalyticsConsentSession(otherSettings);
    const unsubscribeOther = other.subscribe(() => {});
    expect(other.getSnapshot()).toMatchObject({ hasChoice: false, decisions: purposeDecisions(otherSettings, []) });
    expect(present(browser)).toEqual([]);
    expect(storageListeners(browser)).toBe(1);
    unsubscribeOther();
    expect(storageListeners(browser)).toBe(0);

    const resumed = getBrowserAnalyticsConsentSession(structuredClone(analyticsSettings));
    resumed.subscribe(() => {});
    browser.dispatchStorage(stale);
    expect(present(browser)).toEqual([]);
    expect(resumed).toBe(original);
    expect(resumed.getSnapshot()).toMatchObject({ decisions: denied, retry: attempted, persistence: "stale-grant-retained" });
    expect(browser.reload).not.toHaveBeenCalled();
    expect(browser.storedValues.get(key)).toBe(stale);
    expect(browser.effects.filter(effect => effect === "append:analytics-google-analytics-4")).toHaveLength(1);

    const verifiedDenial = record();
    browser.storedValues.set(key, verifiedDenial);
    browser.dispatchStorage(verifiedDenial);
    expect(resumed.getSnapshot()).toMatchObject({ decisions: denied, persistence: "persisted" });
    expect(resumed.getSnapshot().retry).toBeUndefined();
    expect(browser.reload).toHaveBeenCalledOnce();
    expect(present(browser)).toEqual([]);
  });

  it("keeps a withdrawal incomplete while storage remains unreadable", () => {
    const browser = createTestBrowser({ [key]: record(google) });
    const session = getBrowserAnalyticsConsentSession(analyticsSettings);
    session.subscribe(() => {});
    browser.localStorage.getItem.mockImplementation(failStorage);
    browser.localStorage.setItem.mockImplementation(failStorage);
    browser.localStorage.removeItem.mockImplementation(failStorage);
    expect(session.save(denied)).toEqual({ persistence: "stale-grant-retained", reloading: false });
    browser.dispatchStorage(record());
    expect(present(browser)).toEqual([]);
    expect(browser.reload).not.toHaveBeenCalled();
    expect(session.getSnapshot()).toMatchObject({ decisions: denied, retry: denied, persistence: "stale-grant-retained" });
  });

  it("uses read-back to detect a concurrent replacement of a submitted decision", () => {
    const browser = createTestBrowser({ [key]: record(google) });
    const session = getBrowserAnalyticsConsentSession(analyticsSettings);
    session.subscribe(() => {});
    browser.localStorage.setItem.mockImplementation((_, value) => {
      expect(value).toContain("denied");
      browser.storedValues.set(key, record(google, clarity));
    });
    browser.localStorage.removeItem.mockImplementation(failStorage);
    expect(session.save(decide(cloudflare))).toEqual({ persistence: "stale-grant-retained", reloading: false });
    expect(present(browser)).toEqual([]);
    expect(session.getSnapshot()).toMatchObject({ decisions: denied, retry: decide(cloudflare) });
    expect(browser.reload).not.toHaveBeenCalled();
  });

  it.each(["newer denial", "missing", "unreadable"] as const)(
    "does not activate a stale event superseded by %s",
    backing => {
      const browser = createTestBrowser({ [key]: record() }, "", true);
      const session = getBrowserAnalyticsConsentSession(analyticsSettings);
      session.subscribe(() => {});
      if (backing === "missing") browser.storedValues.delete(key);
      if (backing === "unreadable") browser.localStorage.getItem.mockImplementation(failStorage);
      browser.dispatchStorage(record(google));
      expect(session.getSnapshot().decisions).toEqual(denied);
      expect(present(browser)).toEqual([]);
      expect(browser.reload).not.toHaveBeenCalled();
    },
  );

  it("ignores events from another storage area or for another key", () => {
    const browser = createTestBrowser({ [key]: record() });
    const session = getBrowserAnalyticsConsentSession(analyticsSettings);
    session.subscribe(() => {});
    const grant = record(google);
    browser.storedValues.set(key, grant);
    browser.dispatchStorage(grant, "another");
    browser.dispatchStorage(grant, key, null);
    expect(session.getSnapshot().decisions).toEqual(denied);
    expect(present(browser)).toEqual([]);
    browser.dispatchStorage(grant, key);
    expect(present(browser)).toEqual(["analytics-google-analytics-4"]);
  });

  it("applies a restrictive first event even if a later expansion was queued", () => {
    const browser = createTestBrowser({ [key]: record(google) });
    const session = getBrowserAnalyticsConsentSession(analyticsSettings);
    session.subscribe(() => {});
    browser.storedValues.set(key, record());
    browser.dispatchStorage(record(google, cloudflare));
    expect(present(browser)).toEqual([]);
    expect(session.getSnapshot().decisions).toEqual(denied);
    expect(browser.reload).toHaveBeenCalledOnce();
  });

  it("stops a purpose without reloading into a conflicting readable grant", () => {
    const browser = createTestBrowser({ [key]: record(google) });
    const session = getBrowserAnalyticsConsentSession(analyticsSettings);
    session.subscribe(() => {});
    browser.dispatchStorage(record());
    expect(session.getSnapshot()).toMatchObject({ decisions: denied, persistence: "stale-grant-retained" });
    expect(present(browser)).toEqual([]);
    expect(browser.reload).not.toHaveBeenCalled();
  });

  it("keeps collection off even when a matching durable choice grants every purpose", () => {
    vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENABLED", "false");
    const context = createAnalyticsConsentContext(analyticsSettings);
    const grant = createRecord(decide(google, cloudflare, clarity), context, collectionContext(context, false), now);
    const browser = createTestBrowser({ [key]: JSON.stringify(grant) }, "", true);
    const session = getBrowserAnalyticsConsentSession(analyticsSettings);
    session.subscribe(() => {});
    expect(session.getSnapshot().decisions).toEqual(decide(google, cloudflare, clarity));
    expect(present(browser)).toEqual([]);
    expect(browser.window).not.toHaveProperty("gtag");
  });

  it("uses one script and provider-specific privacy defaults across repeat choices", () => {
    const browser = createTestBrowser({}, "", true);
    const session = getBrowserAnalyticsConsentSession(analyticsSettings);
    session.subscribe(() => {});
    session.save(decide(google, clarity));
    session.save(decide(google, clarity));
    expect(present(browser)).toEqual(["analytics-google-analytics-4", "analytics-microsoft-clarity"]);
    expect(browser.window).toHaveProperty("dataLayer", expect.arrayContaining([
      expect.objectContaining({ 0: "consent", 1: "default", 2: {
        analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied",
      } }),
    ]));
    expect(browser.window).toHaveProperty("clarity.q", [
      ["consentv2", { analytics_Storage: "denied", ad_Storage: "denied" }],
      ["consentv2", { analytics_Storage: "granted", ad_Storage: "denied" }],
    ]);
  });

  it("replaces only obsolete preference keys after a verified save", () => {
    const browser = createTestBrowser({ "egeria.analytics.consent.v1": "old", "egeria.analytics.consent.v2": "older", "unrelated": "keep" });
    const session = getBrowserAnalyticsConsentSession(analyticsSettings);
    session.subscribe(() => {});
    expect(session.getSnapshot().decisions).toEqual(denied);
    expect(session.save(denied)).toEqual({ persistence: "persisted", reloading: false });
    expect([...browser.storedValues.keys()].sort()).toEqual([key, "unrelated"]);
  });
});
