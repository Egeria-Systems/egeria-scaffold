"use client";

import { useEffect, useRef, useState } from "react";

import type { AnalyticsContent } from "./analytics-content";
import type { AnalyticsSettings } from "./analytics-provider-contract";
import {
  browserAnalyticsConsentRuntime,
  type AnalyticsConsentChoice,
  type AnalyticsConsentRuntime,
} from "./analytics-runtime";

type AnalyticsConsentProperties = Readonly<{
  settings: AnalyticsSettings;
  content: AnalyticsContent;
  runtime?: AnalyticsConsentRuntime;
}>;

type AnalyticsConsentControlProperties = Readonly<{
  settings: AnalyticsSettings;
  content: AnalyticsContent;
  runtime: AnalyticsConsentRuntime;
  purposes: readonly string[];
}>;

function selectedPurposes(
  settings: AnalyticsSettings,
  content: AnalyticsContent,
): readonly string[] {
  return [
    ...(settings.providers.cloudflareWebAnalytics === undefined
      ? []
      : [content.purposes.cloudflareWebAnalytics]),
    ...(settings.providers.googleAnalytics4 === undefined
      ? []
      : [content.purposes.googleAnalytics4]),
    ...(settings.providers.microsoftClarity === undefined
      ? []
      : [content.purposes.microsoftClarity]),
  ];
}

function AnalyticsConsentControl({
  settings,
  content,
  runtime,
  purposes,
}: AnalyticsConsentControlProperties) {
  const [choice, setChoice] = useState<
    AnalyticsConsentChoice | null | undefined
  >(undefined);
  const [managing, setManaging] = useState(false);
  const dialogReference = useRef<HTMLDivElement>(null);
  const manageButtonReference = useRef<HTMLButtonElement>(null);
  const hasOpenedDialogReference = useRef(false);

  useEffect(() => {
    let active = true;
    const storedChoice = runtime.read();
    if (storedChoice === "granted") {
      runtime.grant(settings);
    }
    queueMicrotask(() => {
      if (active) {
        setChoice(storedChoice);
      }
    });
    return () => {
      active = false;
    };
  }, [runtime, settings]);

  const showChoices = choice === null || managing;

  useEffect(() => {
    if (choice === undefined) {
      return;
    }

    if (showChoices) {
      hasOpenedDialogReference.current = true;
      dialogReference.current
        ?.querySelector<HTMLButtonElement>("button")
        ?.focus();
    } else if (hasOpenedDialogReference.current) {
      manageButtonReference.current?.focus();
    }
  }, [choice, showChoices]);

  if (choice === undefined) {
    return null;
  }

  function grant() {
    runtime.grant(settings);
    setChoice("granted");
    setManaging(false);
  }

  function decline() {
    runtime.decline();
    setChoice("denied");
    setManaging(false);
  }

  function withdraw() {
    runtime.withdraw(settings);
  }

  return (
    <aside aria-label={content.heading} className="analytics-consent">
      {showChoices ? (
        <div
          ref={dialogReference}
          role="dialog"
          aria-modal="false"
          aria-labelledby="analytics-heading"
        >
          <h2 id="analytics-heading">{content.heading}</h2>
          <p>{content.summary}</p>
          {purposes.length > 0 ? (
            <>
              <h3>{content.providersHeading}</h3>
              <ul>{purposes.map((purpose) => <li key={purpose}>{purpose}</li>)}</ul>
            </>
          ) : null}
          <p aria-live="polite">
            {choice === "granted"
              ? content.grantedStatus
              : choice === "denied"
                ? content.deniedStatus
                : null}
          </p>
          <div>
            {choice === "granted" ? null : (
              <>
                <button type="button" onClick={grant}>{content.allowLabel}</button>
                <button type="button" onClick={decline}>{content.declineLabel}</button>
              </>
            )}
            {choice === "granted" ? (
              <button type="button" onClick={withdraw}>{content.withdrawLabel}</button>
            ) : null}
            {choice !== null ? (
              <button type="button" onClick={() => setManaging(false)}>
                {content.closeLabel}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {!showChoices ? (
        <button
          ref={manageButtonReference}
          type="button"
          onClick={() => setManaging(true)}
        >
          {content.manageLabel}
        </button>
      ) : null}
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
