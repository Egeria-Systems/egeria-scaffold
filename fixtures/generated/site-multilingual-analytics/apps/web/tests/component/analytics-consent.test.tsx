import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

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
import type {
  AnalyticsConsentRuntime,
  AnalyticsConsentSaveResult,
  AnalyticsConsentSnapshot,
} from "../../src/integrations/analytics/analytics-runtime";
import { analyticsSettings } from "../../src/integrations/analytics/analytics-settings";

const now = new Date("2026-08-27T12:00:00.000Z");

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
    googleSearchConsole: {
      verificationToken: "search-console-verification-token",
    },
  },
} as const;

const googleOnlySettings = {
  ...analyticsSettings,
  providers: {
    googleAnalytics4: analyticsSettings.providers.googleAnalytics4,
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
  let synchronization:
    | ((decisions: readonly AnalyticsPurposeDecision[]) => void)
    | undefined;
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
      synchronized: (decisions: readonly AnalyticsPurposeDecision[]) => void,
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
    synchronize(decisions: readonly AnalyticsPurposeDecision[]) {
      if (synchronization === undefined) {
        throw new Error("subscription not registered");
      }
      synchronization(decisions);
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
    expect(saveSelection).toHaveFocus();
    expect(runtime.save).toHaveBeenNthCalledWith(
      1,
      analyticsSettings,
      allGranted,
      requested,
    );
    expect(runtime.save).toHaveBeenNthCalledWith(
      2,
      analyticsSettings,
      allGranted,
      requested,
    );
  });

  it("subscribes once, disposes exactly, and does not move focus on synchronization", async () => {
    const runtime = createRuntime(validSnapshot(analyticsSettings, allGranted));
    const { rendered } = await renderConsent("en-CA", runtime);
    const outsideControl = document.createElement("button");
    document.body.append(outsideControl);
    outsideControl.focus();

    expect(runtime.subscribe).toHaveBeenCalledOnce();
    act(() => runtime.synchronize(partiallyGranted));
    expect(outsideControl).toHaveFocus();

    rendered.unmount();
    expect(runtime.dispose).toHaveBeenCalledOnce();
    outsideControl.remove();
  });

  it.each([
    ["expired", "expiredChoiceStatus"],
    ["notice-changed", "updatedChoiceStatus"],
    ["provider-context-changed", "updatedChoiceStatus"],
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
