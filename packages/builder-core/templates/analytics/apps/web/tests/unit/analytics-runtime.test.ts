import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createAnalyticsConsentContext,
  createAnalyticsConsentRecord,
  type AnalyticsConsentRecordV2,
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
    cloudflareWebAnalytics: {
      siteToken: "0123456789abcdef0123456789abcdef",
    },
    googleAnalytics4: { measurementId: "G-TEST123456" },
    microsoftClarity: {
      projectId: "clarity123",
      audience: "not-directed-to-minors",
    },
  },
  operationalIntegrations: {},
};

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
): AnalyticsConsentRecordV2 {
  return createAnalyticsConsentRecord(
    purposeDecisions(settings, granted),
    createAnalyticsConsentContext(settings),
    now,
  );
}

function createTestBrowser(
  initialStorage: Readonly<Record<string, string>> = {},
  cookies = "_ga=one; _ga_CONTAINER=two; _clck=three; _clsk=four; session=keep",
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
  const dataLayer = {
    entries: [] as unknown[][],
    push(parameters: unknown[]) {
      this.entries.push(parameters);
      effects.push(`google:${String(parameters[0])}:${String(parameters[1])}`);
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
      hostname: "app.example.com",
      reload,
    },
    removeEventListener,
  };

  vi.stubGlobal("document", document);
  vi.stubGlobal("window", window);

  return {
    addEventListener,
    clarity,
    cookieWrites,
    dataLayer,
    effects,
    localStorage,
    reload,
    removeEventListener,
    scripts,
    storedValues,
    dispatchStorage(newValue: string | null, key = analyticsConsentStorageKey) {
      for (const listener of storageListeners) {
        listener({ key, newValue } as StorageEvent);
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
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
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
    const googleDefault = effectIndex(browser.effects, "google:consent:default");
    for (const laterEffect of [
      "google:consent:update",
      "google:js:",
      "google:config:",
      "append:analytics-google-analytics-4",
    ]) {
      expect(googleDefault).toBeLessThan(effectIndex(browser.effects, laterEffect));
    }
    const googleConsentCommands = browser.effects.filter((effect) =>
      effect.startsWith("google:consent:"),
    );
    expect(googleConsentCommands).toEqual([
      "google:consent:default",
      "google:consent:update",
      "google:consent:default",
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
      clarityDenied,
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

  it("persists reductions before denial, exact and prefix cookie cleanup, and reload", () => {
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
    expect(persisted).toBeLessThan(effectIndex(browser.effects, "cookie:_ga="));
    expect(effectIndex(browser.effects, "cookie:_ga=")).toBeLessThan(
      effectIndex(browser.effects, "reload"),
    );
    for (const cookieName of ["_ga", "_ga_CONTAINER", "_clck", "_clsk"]) {
      expect(browser.cookieWrites).toContain(
        `${cookieName}=; Max-Age=0; Path=/; SameSite=Lax`,
      );
      expect(browser.cookieWrites).toContain(
        `${cookieName}=; Max-Age=0; Path=/; Domain=app.example.com; SameSite=Lax`,
      );
      expect(browser.cookieWrites).toContain(
        `${cookieName}=; Max-Age=0; Path=/; Domain=example.com; SameSite=Lax`,
      );
    }
    expect(browser.cookieWrites.some((write) => write.includes("Domain=com"))).toBe(false);
    expect(browser.cookieWrites.some((write) => write.startsWith("session="))).toBe(false);
    expect(browser.reload).toHaveBeenCalledOnce();
  });

  it("lets a reduction reload after a failed overwrite when v2 removal is verified", () => {
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

  it("keeps an unreadable reduction session-only without an unsafe reload", () => {
    const previous = purposeDecisions(analyticsSettings, [
      "audience-measurement",
    ]);
    const denied = purposeDecisions(analyticsSettings, []);
    const browser = createTestBrowser();
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
      decisions: denied,
      persistence: "session-only",
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
        "_ga=; Max-Age=0; Path=/; SameSite=Lax",
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
            googleAnalytics4: { measurementId: "G-TEST123456" },
          },
          operationalIntegrations: {},
        }),
        purposes: purposeDecisions(
          {
            consent: { policy: "explicit-opt-in" },
            providers: {
              googleAnalytics4: { measurementId: "G-TEST123456" },
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
