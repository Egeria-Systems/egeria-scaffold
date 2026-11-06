import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AnalyticsConsent } from "../../src/integrations/analytics/analytics-consent";
import {
  parseAnalyticsContent,
  readAnalyticsContent,
  type AnalyticsLocale,
} from "../../src/integrations/analytics/analytics-content";
import {
  createAnalyticsConsentContext,
  createAnalyticsConsentRecord,
  type AnalyticsConsentResolution,
  type AnalyticsPurposeDecision,
} from "../../src/integrations/analytics/analytics-consent-state";
import type { AnalyticsSettings } from "../../src/integrations/analytics/analytics-provider-contract";
import {
  analyticsConsentStorageKey,
  browserAnalyticsConsentRuntime,
  type AnalyticsConsentRuntime,
  type AnalyticsConsentSaveResult,
  type AnalyticsConsentSnapshot,
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

const allDenied = [
  { purpose: "aggregate-traffic-and-performance", decision: "denied" },
  { purpose: "audience-measurement", decision: "denied" },
  { purpose: "consented-experience-analysis", decision: "denied" },
] as const satisfies readonly AnalyticsPurposeDecision[];

const allGranted = [
  { purpose: "aggregate-traffic-and-performance", decision: "granted" },
  { purpose: "audience-measurement", decision: "granted" },
  { purpose: "consented-experience-analysis", decision: "granted" },
] as const satisfies readonly AnalyticsPurposeDecision[];

const partiallyGranted = [
  { purpose: "aggregate-traffic-and-performance", decision: "denied" },
  { purpose: "audience-measurement", decision: "granted" },
  { purpose: "consented-experience-analysis", decision: "denied" },
] as const satisfies readonly AnalyticsPurposeDecision[];

const searchConsoleOnlySettings = {
  ...analyticsSettings,
  providers: {},
  operationalIntegrations: {
    googleSearchConsole: true,
  },
} as const;

const googleOnlySettings = {
  consent: { policy: "explicit-opt-in" },
  providers: {
    googleAnalytics4: true,
  },
  operationalIntegrations: {},
} as const;

const googleDenied = [
  { purpose: "audience-measurement", decision: "denied" },
] as const satisfies readonly AnalyticsPurposeDecision[];

function validSnapshot(
  settings: AnalyticsSettings,
  decisions: readonly AnalyticsPurposeDecision[],
): AnalyticsConsentSnapshot {
  const record = createAnalyticsConsentRecord(
    decisions,
    createAnalyticsConsentContext(settings),
    {
      collectionEnabled: true,
      applicationEnvironment: "development",
      siteOrigin: settings.providers.microsoftClarity ? "http://localhost" : null,
      destinations: createAnalyticsConsentContext(settings).map(({ provider }) => ({
        provider,
        destination: {
          "cloudflare-web-analytics": "0123456789abcdef0123456789abcdef",
          "google-analytics-4": "G-TEST123456",
          "microsoft-clarity": "clarity123",
        }[provider],
      })),
    },
    now,
  );
  return {
    resolution: { status: "valid", record },
    decisions,
  };
}

function undecidedSnapshot(
  decisions: readonly AnalyticsPurposeDecision[],
  reason: Extract<
    AnalyticsConsentResolution,
    { status: "undecided" }
  >["reason"] = "missing",
): AnalyticsConsentSnapshot {
  return {
    resolution: { status: "undecided", reason },
    decisions,
  };
}

function createRuntime(
  snapshot: AnalyticsConsentSnapshot = undecidedSnapshot(allDenied),
) {
  const dispose = vi.fn();
  type Synchronize = Parameters<AnalyticsConsentRuntime["subscribe"]>[2];
  let synchronization: Synchronize | undefined;
  const initialize = vi.fn(() => snapshot);
  const save = vi.fn(
    (
      _settings: AnalyticsSettings,
      _previous: readonly AnalyticsPurposeDecision[],
      next: readonly AnalyticsPurposeDecision[],
    ): AnalyticsConsentSaveResult => ({
      decisions: next,
      persistence: "persisted",
      reloading: false,
    }),
  );
  const subscribe = vi.fn(
    (
      _settings: AnalyticsSettings,
      _current: () => readonly AnalyticsPurposeDecision[],
      synchronized: Synchronize,
    ) => {
      synchronization = synchronized;
      return dispose;
    },
  );
  const runtime = {
    initialize,
    save,
    subscribe,
  } satisfies AnalyticsConsentRuntime;

  return {
    dispose,
    initialize,
    runtime,
    save,
    subscribe,
    synchronize(...choice: Parameters<Synchronize>) {
      if (synchronization === undefined) {
        throw new Error("subscription not registered");
      }
      synchronization(...choice);
    },
  };
}

async function renderConsent(
  locale: AnalyticsLocale = "en-CA",
  runtime = createRuntime(),
  settings: AnalyticsSettings = analyticsSettings,
) {
  const content = readAnalyticsContent(locale);
  const rendered = render(
    <AnalyticsConsent
      settings={settings}
      content={content}
      runtime={runtime.runtime}
    />,
  );
  const complementary = await screen.findByRole("complementary", {
    name: content.heading,
  });
  return { complementary, content, rendered, runtime };
}

describe("analytics consent content", () => {
  it.each(["en-CA", "fr-CA"] as const)(
    "requires the complete %s purpose and disclosure catalog",
    (locale) => {
      const content = readAnalyticsContent(locale);

      expect(Object.keys(content).sort()).toEqual([
        "allowAllLabel",
        "choosePurposesLabel",
        "closeLabel",
        "collectionDisabledNotice",
        "expiredChoiceStatus",
        "heading",
        "manageChoicesLabel",
        "providers",
        "purposes",
        "purposesLegend",
        "rejectAllLabel",
        "saveSelectionLabel",
        "sessionOnlyStatus",
        "staleGrantRetainedStatus",
        "summary",
        "turnOffLabel",
        "updatedChoiceStatus",
      ]);
      expect(Object.keys(content.purposes).sort()).toEqual([
        "aggregate-traffic-and-performance",
        "audience-measurement",
        "consented-experience-analysis",
      ]);
      for (const purpose of Object.values(content.purposes)) {
        expect(Object.keys(purpose).sort()).toEqual(["description", "label"]);
        expect(purpose.label.trim()).not.toBe("");
        expect(purpose.description.trim()).not.toBe("");
      }
      expect(Object.keys(content.providers).sort()).toEqual([
        "cloudflare-web-analytics",
        "google-analytics-4",
        "microsoft-clarity",
      ]);
      for (const provider of Object.values(content.providers)) {
        expect(Object.keys(provider).sort()).toEqual([
          "dataSummary",
          "name",
          "retentionSummary",
          "storageSummary",
        ]);
        expect(Object.values(provider).every((value) => value.trim() !== "")).toBe(
          true,
        );
      }
    },
  );

  it("rejects missing and extra nested disclosure keys", () => {
    const content = readAnalyticsContent("en-CA");
    const missingPurposeDescription = {
      label: content.purposes["audience-measurement"].label,
    };

    expect(() =>
      parseAnalyticsContent({
        ...content,
        purposes: {
          ...content.purposes,
          "audience-measurement": missingPurposeDescription,
        },
      }),
    ).toThrow("CONTENT_INVALID");
    expect(() =>
      parseAnalyticsContent({
        ...content,
        providers: {
          ...content.providers,
          "google-analytics-4": {
            ...content.providers["google-analytics-4"],
            technicalName: "google-analytics-4",
          },
        },
      }),
    ).toThrow("CONTENT_INVALID");
  });

  it("gives both locales honest retry-or-close guidance", () => {
    const english = readAnalyticsContent("en-CA");
    const french = readAnalyticsContent("fr-CA");

    expect(english.staleGrantRetainedStatus).toMatch(/may continue/iu);
    expect(english.staleGrantRetainedStatus).toMatch(/retry/iu);
    expect(english.staleGrantRetainedStatus).toMatch(/close/iu);
    expect(english.staleGrantRetainedStatus).not.toMatch(
      /stopped|erased|compliant/iu,
    );
    expect(french.staleGrantRetainedStatus).toMatch(/peut se poursuivre/iu);
    expect(french.staleGrantRetainedStatus).toMatch(/réessay/iu);
    expect(french.staleGrantRetainedStatus).toMatch(/fermez/iu);
  });
});

describe("analytics consent", () => {
  it.each(["en-CA", "fr-CA"] as const)(
    "renders a labelled non-modal %s control without initial focus movement",
    async (locale) => {
      const outsideControl = document.createElement("button");
      document.body.append(outsideControl);
      outsideControl.focus();
      const { complementary, content } = await renderConsent(locale);

      expect(complementary).toBeVisible();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByText(content.summary)).toBeVisible();
      expect(
        screen.getByRole("button", { name: content.allowAllLabel }),
      ).not.toHaveFocus();
      expect(outsideControl).toHaveFocus();
      outsideControl.remove();
    },
  );

  it("gives allow-all and reject-all equal treatment", async () => {
    const { content } = await renderConsent();
    const allow = screen.getByRole("button", { name: content.allowAllLabel });
    const reject = screen.getByRole("button", { name: content.rejectAllLabel });

    expect(allow.className).toBe(reject.className);
    expect(allow.className).toContain("min-h-11");
  });

  it("moves focus to Manage after a first-time non-reloading save", async () => {
    const user = userEvent.setup();
    const runtime = createRuntime();
    const { content } = await renderConsent("en-CA", runtime);

    await user.click(
      screen.getByRole("button", { name: content.allowAllLabel }),
    );

    expect(
      screen.getByRole("button", { name: content.manageChoicesLabel }),
    ).toHaveFocus();
  });

  it("opens first-time choices without saving and returns focus to Choose", async () => {
    const user = userEvent.setup();
    const runtime = createRuntime();
    const { content } = await renderConsent("en-CA", runtime);
    const choose = screen.getByRole("button", {
      name: content.choosePurposesLabel,
    });

    await user.click(choose);

    expect(runtime.save).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: content.manageChoicesLabel }),
    ).toHaveFocus();
    for (const checkbox of screen.getAllByRole("checkbox")) {
      expect(checkbox).not.toBeChecked();
    }
    expect(
      screen.getByRole("button", { name: content.allowAllLabel }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: content.rejectAllLabel }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: content.saveSelectionLabel }),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: content.closeLabel }));
    expect(
      screen.getByRole("button", { name: content.choosePurposesLabel }),
    ).toHaveFocus();
  });

  it("reopens saved decisions, returns focus to Manage, and turns off directly", async () => {
    const user = userEvent.setup();
    const runtime = createRuntime(validSnapshot(analyticsSettings, partiallyGranted));
    const { content } = await renderConsent("en-CA", runtime);
    const manage = screen.getByRole("button", {
      name: content.manageChoicesLabel,
    });

    expect(
      screen.getAllByRole("button", { name: content.turnOffLabel }),
    ).toHaveLength(1);
    await user.click(manage);
    expect(
      screen.getByRole("checkbox", {
        name: content.purposes["audience-measurement"].label,
      }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", {
        name: content.purposes["aggregate-traffic-and-performance"].label,
      }),
    ).not.toBeChecked();

    await user.click(screen.getByRole("button", { name: content.closeLabel }));
    expect(
      screen.getByRole("button", { name: content.manageChoicesLabel }),
    ).toHaveFocus();
    await user.click(
      screen.getByRole("button", { name: content.turnOffLabel }),
    );
    expect(runtime.save).toHaveBeenCalledWith(
      analyticsSettings,
      partiallyGranted,
      allDenied,
      undefined,
    );
  });

  it("moves focus to Manage when a non-reloading management save replaces its action", async () => {
    const user = userEvent.setup();
    const runtime = createRuntime(validSnapshot(analyticsSettings, allDenied));
    const { content } = await renderConsent("en-CA", runtime);

    await user.click(
      screen.getByRole("button", { name: content.manageChoicesLabel }),
    );
    await user.click(
      screen.getByRole("checkbox", {
        name: content.purposes["audience-measurement"].label,
      }),
    );
    await user.click(
      screen.getByRole("button", { name: content.saveSelectionLabel }),
    );

    expect(
      screen.getByRole("button", { name: content.manageChoicesLabel }),
    ).toHaveFocus();
  });

  it("preserves verified decisions and the requested draft across a stale-grant retry", async () => {
    const user = userEvent.setup();
    const runtime = createRuntime(validSnapshot(analyticsSettings, allGranted));
    const requested = [
      allGranted[0],
      allGranted[1],
      { purpose: "consented-experience-analysis", decision: "denied" },
    ] as const satisfies readonly AnalyticsPurposeDecision[];
    runtime.save
      .mockReturnValueOnce({
        decisions: allGranted,
        persistence: "stale-grant-retained",
        disputedPurposes: ["consented-experience-analysis"],
        reloading: false,
      })
      .mockReturnValueOnce({
        decisions: requested,
        persistence: "persisted",
        reloading: true,
      });
    const { content } = await renderConsent("en-CA", runtime);

    await user.click(
      screen.getByRole("button", { name: content.manageChoicesLabel }),
    );
    const clarityChoice = screen.getByRole("checkbox", {
      name: content.purposes["consented-experience-analysis"].label,
    });
    await user.click(clarityChoice);
    const saveSelection = screen.getByRole("button", {
      name: content.saveSelectionLabel,
    });
    await user.click(saveSelection);

    act(() => runtime.synchronize(allGranted.map(decision => ({ ...decision }))));
    expect(screen.getByRole("status")).toHaveTextContent(
      content.staleGrantRetainedStatus,
    );
    expect(clarityChoice).not.toBeChecked();
    expect(
      screen.getByRole("heading", { name: content.manageChoicesLabel }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: content.manageChoicesLabel }),
    ).not.toBeInTheDocument();
    expect(saveSelection).toHaveFocus();

    await user.click(saveSelection);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(saveSelection).toHaveFocus();
    expect(runtime.save).toHaveBeenNthCalledWith(
      1,
      analyticsSettings,
      allGranted,
      requested,
      undefined,
    );
    expect(runtime.save).toHaveBeenNthCalledWith(
      2,
      analyticsSettings,
      allGranted,
      requested,
      ["consented-experience-analysis"],
    );
  });

  it("keeps the withdrawal warning until the conflicting purpose is denied", async () => {
    const user = userEvent.setup();
    const runtime = createRuntime(validSnapshot(analyticsSettings, partiallyGranted));
    runtime.save.mockReturnValueOnce({
      decisions: partiallyGranted,
      persistence: "stale-grant-retained",
      disputedPurposes: ["audience-measurement"],
      reloading: false,
    });
    const { content } = await renderConsent("en-CA", runtime);
    await user.click(screen.getByRole("button", { name: content.turnOffLabel }));

    await user.click(screen.getByRole("button", { name: content.closeLabel }));
    act(() => runtime.synchronize(allGranted));
    expect(screen.getByRole("status")).toHaveTextContent(content.staleGrantRetainedStatus);
    await user.click(screen.getByRole("button", { name: content.manageChoicesLabel }));
    for (const checkbox of screen.getAllByRole("checkbox")) expect(checkbox).not.toBeChecked();

    act(() => runtime.synchronize([allDenied[0], allDenied[1], allGranted[2]]));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(screen.getByRole("checkbox", { name: content.purposes["audience-measurement"].label })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: content.purposes["consented-experience-analysis"].label })).toBeChecked();
  });

  it("moves keyboard focus from a removed Manage action to Choose", async () => {
    const user = userEvent.setup();
    const runtime = createRuntime(validSnapshot(analyticsSettings, allDenied));
    const { content } = await renderConsent("en-CA", runtime);
    await user.tab();
    expect(screen.getByRole("button", { name: content.manageChoicesLabel })).toHaveFocus();

    act(() => runtime.synchronize(allDenied, "missing"));
    expect(screen.getByRole("button", { name: content.choosePurposesLabel })).toHaveFocus();
  });

  it("keeps the real failed withdrawal available for retry after storage notifications", async () => {
    vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENABLED", "false");
    const user = userEvent.setup();
    const content = readAnalyticsContent("en-CA");
    const key = analyticsConsentStorageKey;
    const blocked = () => { throw new Error("storage unavailable"); };
    const writes = vi.spyOn(Storage.prototype, "setItem");
    const removals = vi.spyOn(Storage.prototype, "removeItem");
    const reads = vi.spyOn(Storage.prototype, "getItem");
    try {
      browserAnalyticsConsentRuntime.save(analyticsSettings, allDenied, partiallyGranted);
      const partial = localStorage.getItem(key);
      if (partial === null) throw new Error("missing saved test preference");
      render(<AnalyticsConsent settings={analyticsSettings} content={content} />);
      await user.click(await screen.findByRole("button", { name: content.manageChoicesLabel }));
      await user.click(screen.getByRole("button", { name: content.allowAllLabel }));
      const retained = localStorage.getItem(key);
      expect(retained).not.toEqual(partial);
      writes.mockImplementationOnce(blocked);
      removals.mockImplementationOnce(blocked);
      await user.click(screen.getByRole("button", { name: content.turnOffLabel }));
      expect(localStorage.getItem(key)).toEqual(retained);
      const status = screen.getByRole("status");
      expect(status).toHaveTextContent(content.staleGrantRetainedStatus);

      const notify = (eventKey: string | null, newValue: string | null) => act(() => {
        window.dispatchEvent(new StorageEvent("storage", { key: eventKey, newValue, storageArea: localStorage }));
      });
      notify(null, null);
      expect(status).toHaveTextContent(content.staleGrantRetainedStatus);
      localStorage.setItem(key, partial);
      notify(key, partial);
      expect(status).toHaveTextContent(content.staleGrantRetainedStatus);
      reads.mockImplementationOnce(blocked);
      notify(key, null);
      expect(status).toHaveTextContent(content.staleGrantRetainedStatus);
      await user.click(screen.getByRole("button", { name: content.closeLabel }));
      await user.click(screen.getByRole("button", { name: content.manageChoicesLabel }));
      for (const checkbox of screen.getAllByRole("checkbox")) expect(checkbox).not.toBeChecked();
    } finally {
      writes.mockRestore();
      removals.mockRestore();
      reads.mockRestore();
      localStorage.removeItem(key);
    }
  });

  it.each(["changing backing grants", "unreadable mixed retry"] as const)(
    "keeps the real withdrawal incomplete across %s",
    async scenario => {
      vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENABLED", "false");
      const user = userEvent.setup();
      const content = readAnalyticsContent("en-CA");
      const key = analyticsConsentStorageKey;
      const blocked = () => { throw new Error("storage unavailable"); };
      const write = Storage.prototype.setItem;
      const reads = vi.spyOn(Storage.prototype, "getItem");
      const writes = vi.spyOn(Storage.prototype, "setItem");
      const removals = vi.spyOn(Storage.prototype, "removeItem");
      const notify = (record: string) => act(() => {
        write.call(localStorage, key, record);
        window.dispatchEvent(new StorageEvent("storage", { key, newValue: record, storageArea: localStorage }));
      });
      const saveRecord = (decisions: readonly AnalyticsPurposeDecision[]) => {
        browserAnalyticsConsentRuntime.save(analyticsSettings, allDenied, decisions);
        const record = localStorage.getItem(key);
        if (record === null) throw new Error("missing preference");
        return record;
      };
      try {
        const google = saveRecord(partiallyGranted);
        const clarity = saveRecord([allDenied[0], allDenied[1], allGranted[2]]);
        saveRecord([allDenied[0], allGranted[1], allGranted[2]]);
        render(<AnalyticsConsent settings={analyticsSettings} content={content} />);
        await user.click(await screen.findByRole("button", { name: content.manageChoicesLabel }));
        writes.mockImplementation(blocked);
        removals.mockImplementation(blocked);
        await user.click(screen.getByRole("button", { name: content.turnOffLabel }));
        const warning = screen.getByRole("status");
        expect(warning).toHaveTextContent(content.staleGrantRetainedStatus);
        notify(google);
        const googleChoice = screen.getByRole("checkbox", { name: content.purposes["audience-measurement"].label });
        if (scenario === "unreadable mixed retry") {
          await user.click(googleChoice);
          reads.mockImplementation(blocked);
        }
        const save = screen.getByRole("button", { name: content.saveSelectionLabel });
        await user.click(save);
        if (scenario === "changing backing grants") notify(clarity);
        expect(warning).toHaveTextContent(content.staleGrantRetainedStatus);
        expect(save).toHaveFocus();
        expect(googleChoice).toHaveProperty("checked", scenario === "unreadable mixed retry");
      } finally {
        reads.mockRestore();
        writes.mockRestore();
        removals.mockRestore();
        localStorage.removeItem(key);
      }
    },
  );

  it("resets a checked draft on a clear while keeping the open form and keyboard focus", async () => {
    const user = userEvent.setup();
    const runtime = createRuntime(validSnapshot(analyticsSettings, allDenied));
    const { content } = await renderConsent("en-CA", runtime);
    await user.click(screen.getByRole("button", { name: content.manageChoicesLabel }));
    await user.tab();
    const checkbox = screen.getByRole("checkbox", { name: content.purposes["aggregate-traffic-and-performance"].label });
    await user.keyboard("[Space]");
    expect(checkbox).toBeChecked();
    expect(checkbox).toHaveFocus();

    act(() => runtime.synchronize(allDenied, "missing"));
    expect(screen.getByRole("heading", { name: content.manageChoicesLabel })).toBeVisible();
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toHaveFocus();
  });

  it("synchronizes saved denial and undecided controls without moving external focus", async () => {
    const runtime = createRuntime(validSnapshot(analyticsSettings, allDenied));
    const { rendered, content } = await renderConsent("fr-CA", runtime);
    const outsideControl = document.createElement("button");
    document.body.append(outsideControl);
    outsideControl.focus();

    expect(runtime.subscribe).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: content.manageChoicesLabel })).toBeVisible();
    act(() => runtime.synchronize(allDenied, "notice-changed"));
    for (const name of [content.allowAllLabel, content.rejectAllLabel, content.choosePurposesLabel]) {
      expect(screen.getByRole("button", { name })).toBeVisible();
    }
    expect(screen.queryByRole("button", { name: content.manageChoicesLabel })).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(content.updatedChoiceStatus);
    expect(outsideControl).toHaveFocus();

    act(() => runtime.synchronize(allDenied));
    expect(screen.getByRole("button", { name: content.manageChoicesLabel })).toBeVisible();
    expect(screen.queryByRole("button", { name: content.choosePurposesLabel })).toBeNull();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(outsideControl).toHaveFocus();

    rendered.unmount();
    expect(runtime.dispose).toHaveBeenCalledOnce();
    outsideControl.remove();
  });

  it.each([
    ["expired", "expiredChoiceStatus"],
    ["notice-changed", "updatedChoiceStatus"],
    ["provider-context-changed", "updatedChoiceStatus"],
    ["collection-context-changed", "updatedChoiceStatus"],
  ] as const)("announces a %s choice through the bounded status", async (reason, key) => {
    const runtime = createRuntime(undecidedSnapshot(allDenied, reason));
    const { complementary, content } = await renderConsent("en-CA", runtime);
    const status = screen.getByRole("status");

    expect(status).toHaveTextContent(content[key]);
    expect(complementary).not.toHaveAttribute("aria-live");
  });

  it("announces a session-only choice without presenting it as durable", async () => {
    const user = userEvent.setup();
    const runtime = createRuntime();
    runtime.save.mockReturnValueOnce({
      decisions: allDenied,
      persistence: "session-only",
      reloading: false,
    });
    const { content } = await renderConsent("en-CA", runtime);

    await user.click(
      screen.getByRole("button", { name: content.rejectAllLabel }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      content.sessionOnlyStatus,
    );
  });

  it("shows only configured provider disclosure without visible technical identifiers", async () => {
    const user = userEvent.setup();
    const runtime = createRuntime(undecidedSnapshot(googleDenied));
    const { complementary, content } = await renderConsent(
      "en-CA",
      runtime,
      googleOnlySettings,
    );

    await user.click(
      screen.getByRole("button", { name: content.choosePurposesLabel }),
    );
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(
      screen.getByText(content.providers["google-analytics-4"].name),
    ).toBeVisible();
    expect(
      screen.queryByText(content.providers["cloudflare-web-analytics"].name),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(content.providers["microsoft-clarity"].name),
    ).not.toBeInTheDocument();
    expect(complementary.textContent).not.toMatch(
      /aggregate-traffic-and-performance|audience-measurement|consented-experience-analysis|google-analytics-4/u,
    );
  });

  it("omits controls when only Search Console is selected", () => {
    const runtime = createRuntime(undecidedSnapshot([]));
    const content = readAnalyticsContent("en-CA");

    render(
      <AnalyticsConsent
        settings={searchConsoleOnlySettings}
        content={content}
        runtime={runtime.runtime}
      />,
    );

    expect(
      screen.queryByRole("complementary", { name: content.heading }),
    ).not.toBeInTheDocument();
    expect(runtime.initialize).not.toHaveBeenCalled();
    expect(runtime.subscribe).not.toHaveBeenCalled();
  });
});


beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APPLICATION_ENVIRONMENT", "development");
  vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENABLED", "true");
  vi.stubEnv("NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN", "0123456789abcdef0123456789abcdef");
  vi.stubEnv("NEXT_PUBLIC_GA4_MEASUREMENT_ID", "G-TEST123456");
  vi.stubEnv("NEXT_PUBLIC_CLARITY_PROJECT_ID", "clarity123");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost");
});
afterEach(() => vi.unstubAllEnvs());

describe("analytics collection availability", () => {
  it.each([
    ["en-CA", "Analytics collection is currently disabled."],
    ["fr-CA", "La collecte de données analytiques est actuellement désactivée."],
  ] as const)("keeps %s choices usable while the compiled collection flag is off", async (locale, notice) => {
    vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENABLED", "false");
    const user = userEvent.setup();
    const { content, runtime } = await renderConsent(locale);
    expect(screen.getByText(notice)).toBeVisible();
    await user.click(screen.getByRole("button", { name: content.allowAllLabel }));
    expect(runtime.save).toHaveBeenCalledWith(analyticsSettings, allDenied, allGranted, undefined);
    expect(screen.getByRole("button", { name: content.manageChoicesLabel })).toBeEnabled();
  });

  it("explains disabled collection when a selected local destination is absent", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLARITY_PROJECT_ID", "");
    await renderConsent();
    expect(screen.getByText("Analytics collection is currently disabled.")).toBeVisible();
  });

  it("omits the disabled notice when enabled inputs are complete", async () => {
    await renderConsent();
    expect(screen.queryByText("Analytics collection is currently disabled.")).not.toBeInTheDocument();
  });
});
