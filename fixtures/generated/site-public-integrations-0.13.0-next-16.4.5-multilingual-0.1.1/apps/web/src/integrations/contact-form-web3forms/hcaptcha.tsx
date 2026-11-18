"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import type { ContactContent, ContactLocale } from "./contact-content";

type CaptchaApi = Readonly<{
  render: (container: HTMLElement, options: Readonly<Record<string, unknown>>) => string;
  reset: (widget: string) => void;
  remove: (widget: string) => void;
}>;
declare global {
  interface Window {
    hcaptcha?: CaptchaApi;
    egeriaContactCaptchaReady?: () => void;
  }
}
let sdkReady = false;
const readyListeners = new Set<() => void>();

export function ContactCaptcha({ locale, content, onToken }: Readonly<{
  locale: ContactLocale;
  content: ContactContent;
  onToken: (token: string) => void;
}>) {
  const container = useRef<HTMLDivElement>(null);
  const tokenCallback = useRef(onToken);
  const [prepared, setPrepared] = useState(false);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "expired" | "unavailable">("loading");
  useEffect(() => { tokenCallback.current = onToken; }, [onToken]);
  useEffect(() => {
    let active = true;
    const listener = () => { if (active) setReady(true); };
    readyListeners.add(listener);
    window.egeriaContactCaptchaReady = () => {
      sdkReady = true;
      for (const notify of readyListeners) notify();
    };
    // Mount Script only after the named readiness callback has been installed.
    queueMicrotask(() => {
      if (!active) return;
      if (sdkReady) listener();
      setPrepared(true);
    });
    return () => { active = false; readyListeners.delete(listener); };
  }, []);
  useEffect(() => {
    if (!ready || container.current === null) return;
    const api = window.hcaptcha;
    let active = true;
    let widget: string | undefined;
    const invalidate = (next: "expired" | "unavailable") => {
      if (!active) return;
      tokenCallback.current("");
      setStatus(next);
    };
    const element = container.current;
    // Serialize SDK work after readiness and make abandoned mounts inert.
    queueMicrotask(() => {
      if (!active) return;
      if (api === undefined) { invalidate("unavailable"); return; }
      try {
      widget = api.render(element, {
        sitekey: "50b2fe65-b00b-4b9e-ad62-3ba471098be2",
        hl: locale === "fr-CA" ? "fr" : "en",
        size: "compact",
        callback: (token: unknown) => {
          if (!active) return;
          tokenCallback.current(typeof token === "string" ? token : "");
          setStatus("ready");
        },
        "expired-callback": () => invalidate("expired"),
        "chalexpired-callback": () => invalidate("expired"),
        "error-callback": () => invalidate("unavailable"),
      });
      setStatus("ready");
      } catch { invalidate("unavailable"); }
    });
    return () => {
      active = false;
      tokenCallback.current("");
      if (widget !== undefined && api !== undefined) {
        try { api.reset(widget); } catch { /* Provider teardown is best effort. */ }
        try { api.remove(widget); } catch { /* Provider teardown is best effort. */ }
      }
    };
  }, [locale, ready]);

  return (
    <>
      <div ref={container} />
      {status === "ready" ? null : <p aria-live="polite">{status === "loading" ? content.captchaLoading : status === "expired" ? content.captchaExpired : content.captchaUnavailable}</p>}
      {prepared && !sdkReady ? <Script id="contact-hcaptcha" src="https://js.hcaptcha.com/1/api.js?onload=egeriaContactCaptchaReady&render=explicit&recaptchacompat=off" strategy="afterInteractive" onError={() => { tokenCallback.current(""); setStatus("unavailable"); } } /> : null}
    </>
  );
}
