"use client";

import { useEffect, useRef, useState } from "react";

import type { AnalyticsContent } from "./analytics-content";
import type {
  AnalyticsConsentResolution,
  AnalyticsPurposeDecision,
} from "./analytics-consent-state";
import {
  createAnalyticsProviderDeclarations,
  type AnalyticsProviderIdentifier,
  type AnalyticsPurposeIdentifier,
  type AnalyticsSettings,
} from "./analytics-provider-contract";
import {
  browserAnalyticsConsentRuntime,
  type AnalyticsConsentRuntime,
} from "./analytics-runtime";

type AnalyticsConsentProperties = Readonly<{
  settings: AnalyticsSettings;
  content: AnalyticsContent;
  runtime?: AnalyticsConsentRuntime;
}>;

type PurposePresentation = Readonly<{
  purpose: AnalyticsPurposeIdentifier;
  label: string;
  description: string;
  providers: readonly AnalyticsProviderIdentifier[];
}>;

type AnalyticsConsentControlProperties = Readonly<{
  settings: AnalyticsSettings;
  content: AnalyticsContent;
  runtime: AnalyticsConsentRuntime;
  purposes: readonly PurposePresentation[];
}>;

const decisionButtonClassName =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md bg-accent py-2 pe-4 ps-4 font-semibold text-accent-contrast hover:bg-accent-hover";
const secondaryButtonClassName =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border-2 border-line bg-surface py-2 pe-4 ps-4 font-semibold text-ink hover:text-accent-hover";

function selectedPurposes(
  settings: AnalyticsSettings,
  content: AnalyticsContent,
): readonly PurposePresentation[] {
  const presentations = new Map<
    AnalyticsPurposeIdentifier,
    {
      purpose: AnalyticsPurposeIdentifier;
      label: string;
      description: string;
      providers: AnalyticsProviderIdentifier[];
    }
  >();

  for (const declaration of createAnalyticsProviderDeclarations(settings)) {
    const existing = presentations.get(declaration.purpose);
    if (existing !== undefined) {
      existing.providers.push(declaration.identifier);
      continue;
    }

    const purposeContent = content.purposes[declaration.purpose];
    presentations.set(declaration.purpose, {
      purpose: declaration.purpose,
      label: purposeContent.label,
      description: purposeContent.description,
      providers: [declaration.identifier],
    });
  }

  return [...presentations.values()];
}

function decisionsFor(
  purposes: readonly PurposePresentation[],
  decision: AnalyticsPurposeDecision["decision"],
): readonly AnalyticsPurposeDecision[] {
  return purposes.map(({ purpose }) => ({ purpose, decision }));
}

function isGranted(
  decisions: readonly AnalyticsPurposeDecision[],
  purpose: AnalyticsPurposeIdentifier,
): boolean {
  return decisions.some(
    (entry) => entry.purpose === purpose && entry.decision === "granted",
  );
}

function initialStatus(
  resolution: AnalyticsConsentResolution,
  content: AnalyticsContent,
): string {
  if (resolution.status === "valid" || resolution.reason === "missing") {
    return "";
  }
  if (resolution.reason === "expired") {
    return content.expiredChoiceStatus;
  }
  if (
    resolution.reason === "notice-changed" ||
    resolution.reason === "provider-context-changed"
  ) {
    return content.updatedChoiceStatus;
  }
  return "";
}

function AnalyticsConsentControl({
  settings,
  content,
  runtime,
  purposes,
}: AnalyticsConsentControlProperties) {
  const [ready, setReady] = useState(false);
  const [hasChoice, setHasChoice] = useState(false);
  const [decisions, setDecisions] = useState<
    readonly AnalyticsPurposeDecision[]
  >([]);
  const [draft, setDraft] = useState<readonly AnalyticsPurposeDecision[]>([]);
  const [managing, setManaging] = useState(false);
  const [status, setStatus] = useState("");
  const verifiedDecisionsReference = useRef<readonly AnalyticsPurposeDecision[]>(
    [],
  );
  const managementHeadingReference = useRef<HTMLHeadingElement>(null);
  const chooseButtonReference = useRef<HTMLButtonElement>(null);
  const manageButtonReference = useRef<HTMLButtonElement>(null);
  const focusRequestReference = useRef<
    "management" | "choose" | "manage" | null
  >(null);

  useEffect(() => {
    let active = true;
    const snapshot = runtime.initialize(settings);
    verifiedDecisionsReference.current = snapshot.decisions;
    const dispose = runtime.subscribe(
      settings,
      () => verifiedDecisionsReference.current,
      (synchronizedDecisions) => {
        if (!active) {
          return;
        }
        verifiedDecisionsReference.current = synchronizedDecisions;
        setDecisions(synchronizedDecisions);
        setDraft(synchronizedDecisions);
        setHasChoice(true);
      },
    );

    queueMicrotask(() => {
      if (!active) {
        return;
      }
      setDecisions(snapshot.decisions);
      setDraft(snapshot.decisions);
      setHasChoice(snapshot.resolution.status === "valid");
      setStatus(initialStatus(snapshot.resolution, content));
      setReady(true);
    });

    return () => {
      active = false;
      dispose();
    };
  }, [content, runtime, settings]);

  useEffect(() => {
    const focusRequest = focusRequestReference.current;
    focusRequestReference.current = null;
    switch (focusRequest) {
      case "management":
        managementHeadingReference.current?.focus();
        break;
      case "choose":
        chooseButtonReference.current?.focus();
        break;
      case "manage":
        manageButtonReference.current?.focus();
        break;
    }
  });

  if (!ready) {
    return null;
  }

  const allGranted = decisionsFor(purposes, "granted");
  const allDenied = decisionsFor(purposes, "denied");
  const anyPurposeGranted = decisions.some(
    ({ decision }) => decision === "granted",
  );

  function openManagement() {
    setDraft(decisions);
    focusRequestReference.current = "management";
    setManaging(true);
  }

  function closeManagement() {
    setDraft(decisions);
    focusRequestReference.current = hasChoice ? "manage" : "choose";
    setManaging(false);
  }

  function saveRequested(requested: readonly AnalyticsPurposeDecision[]) {
    const result = runtime.save(
      settings,
      verifiedDecisionsReference.current,
      requested,
    );
    verifiedDecisionsReference.current = result.decisions;
    setDecisions(result.decisions);
    setHasChoice(true);

    if (result.persistence === "stale-grant-retained") {
      setDraft(requested);
      setStatus(content.staleGrantRetainedStatus);
      setManaging(true);
      return;
    }

    setDraft(result.decisions);
    setStatus(
      result.persistence === "session-only" ? content.sessionOnlyStatus : "",
    );
    if (!result.reloading) {
      focusRequestReference.current = "manage";
      setManaging(false);
    }
  }

  function updateDraft(
    purpose: AnalyticsPurposeIdentifier,
    granted: boolean,
  ) {
    setDraft((current) =>
      current.map((decision) =>
        decision.purpose === purpose
          ? { ...decision, decision: granted ? "granted" : "denied" }
          : decision,
      ),
    );
  }

  return (
    <aside
      aria-labelledby="analytics-consent-heading"
      className="flex w-full flex-col gap-4 rounded-2xl border-2 border-line bg-surface p-5 text-ink shadow-lg sm:p-6"
    >
      <div className="flex flex-col gap-2">
        <h2 id="analytics-consent-heading" className="text-2xl font-semibold">
          {content.heading}
        </h2>
        <p className="max-w-3xl text-muted">{content.summary}</p>
      </div>

      {!managing && !hasChoice ? (
        <div className="flex flex-col gap-4">
          <ul className="list-disc space-y-1 ps-6">
            {purposes.map(({ purpose, label }) => (
              <li key={purpose}>{label}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={decisionButtonClassName}
              data-analytics-consent-action="allow"
              onClick={() => saveRequested(allGranted)}
            >
              {content.allowAllLabel}
            </button>
            <button
              type="button"
              className={decisionButtonClassName}
              data-analytics-consent-action="decline"
              onClick={() => saveRequested(allDenied)}
            >
              {content.rejectAllLabel}
            </button>
            <button
              ref={chooseButtonReference}
              type="button"
              className={secondaryButtonClassName}
              data-analytics-consent-action="choose"
              onClick={openManagement}
            >
              {content.choosePurposesLabel}
            </button>
          </div>
        </div>
      ) : null}

      {!managing && hasChoice ? (
        <button
          ref={manageButtonReference}
          type="button"
          className={secondaryButtonClassName}
          data-analytics-consent-action="manage"
          onClick={openManagement}
        >
          {content.manageChoicesLabel}
        </button>
      ) : null}

      {managing ? (
        <section
          aria-labelledby="analytics-consent-management-heading"
          className="flex flex-col gap-4"
        >
          <h3
            id="analytics-consent-management-heading"
            ref={managementHeadingReference}
            tabIndex={-1}
            className="text-xl font-semibold"
          >
            {content.manageChoicesLabel}
          </h3>
          <fieldset className="flex flex-col gap-4">
            <legend className="mb-3 font-semibold">
              {content.purposesLegend}
            </legend>
            {purposes.map((purpose) => {
              const descriptionIdentifier =
                `analytics-purpose-description-${purpose.purpose}`;
              return (
                <div
                  key={purpose.purpose}
                  className="rounded-xl border border-line p-4"
                >
                  <label className="flex min-h-11 items-center gap-3 font-semibold">
                    <input
                      type="checkbox"
                      checked={isGranted(draft, purpose.purpose)}
                      aria-describedby={descriptionIdentifier}
                      data-analytics-consent-purpose={purpose.purpose}
                      onChange={(event) =>
                        updateDraft(purpose.purpose, event.currentTarget.checked)
                      }
                    />
                    <span>{purpose.label}</span>
                  </label>
                  <p id={descriptionIdentifier} className="mt-1 text-muted">
                    {purpose.description}
                  </p>
                  <div className="mt-3 flex flex-col gap-2">
                    {purpose.providers.map((provider) => {
                      const disclosure = content.providers[provider];
                      return (
                        <details key={provider} className="rounded-md border border-line p-3">
                          <summary className="min-h-11 cursor-pointer font-semibold text-accent">
                            {disclosure.name}
                          </summary>
                          <div className="flex flex-col gap-2 pt-2 text-sm text-muted">
                            <p>{disclosure.dataSummary}</p>
                            <p>{disclosure.storageSummary}</p>
                            <p>{disclosure.retentionSummary}</p>
                          </div>
                        </details>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </fieldset>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={decisionButtonClassName}
              data-analytics-consent-action="allow"
              onClick={() => saveRequested(allGranted)}
            >
              {content.allowAllLabel}
            </button>
            <button
              type="button"
              className={decisionButtonClassName}
              data-analytics-consent-action="decline"
              onClick={() => saveRequested(allDenied)}
            >
              {content.rejectAllLabel}
            </button>
            <button
              type="button"
              className={secondaryButtonClassName}
              data-analytics-consent-action="save"
              onClick={() => saveRequested(draft)}
            >
              {content.saveSelectionLabel}
            </button>
            <button
              type="button"
              className={secondaryButtonClassName}
              data-analytics-consent-action="close"
              onClick={closeManagement}
            >
              {content.closeLabel}
            </button>
          </div>
        </section>
      ) : null}

      {anyPurposeGranted ? (
        <button
          type="button"
          className={secondaryButtonClassName}
          data-analytics-consent-action="withdraw"
          onClick={() => saveRequested(allDenied)}
        >
          {content.turnOffLabel}
        </button>
      ) : null}

      <p role="status" aria-live="polite" aria-atomic="true" className="text-sm font-semibold">
        {status}
      </p>
    </aside>
  );
}

export function AnalyticsConsent({
  settings,
  content,
  runtime = browserAnalyticsConsentRuntime,
}: AnalyticsConsentProperties) {
  const purposes = selectedPurposes(settings, content);
  if (purposes.length === 0) {
    return null;
  }

  return (
    <AnalyticsConsentControl
      settings={settings}
      content={content}
      runtime={runtime}
      purposes={purposes}
    />
  );
}
