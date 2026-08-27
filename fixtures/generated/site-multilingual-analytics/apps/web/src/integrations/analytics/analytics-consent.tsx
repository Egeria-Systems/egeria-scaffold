"use client";

import { useEffect, useState } from "react";

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

export function AnalyticsConsent({
  settings,
  content,
  runtime = browserAnalyticsConsentRuntime,
}: AnalyticsConsentProperties) {
  const [choice, setChoice] = useState<
    AnalyticsConsentChoice | null | undefined
  >(undefined);
  const [managing, setManaging] = useState(false);

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

  if (choice === undefined) {
    return null;
  }

  const purposes = selectedPurposes(settings, content);
  const showChoices = choice === null || managing;

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
        <div role="dialog" aria-modal="false" aria-labelledby="analytics-heading">
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
            <button type="button" onClick={grant}>{content.allowLabel}</button>
            <button type="button" onClick={decline}>{content.declineLabel}</button>
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
        <button type="button" onClick={() => setManaging(true)}>
          {content.manageLabel}
        </button>
      ) : null}
    </aside>
  );
}
