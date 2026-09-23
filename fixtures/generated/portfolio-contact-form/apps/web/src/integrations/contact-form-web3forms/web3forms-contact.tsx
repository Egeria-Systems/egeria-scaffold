"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { ContactContent, ContactLocale } from "./contact-content";
import { ContactForm } from "./contact-form";
import type { Web3FormsContactSettings } from "./contact-settings";
import { ContactCaptcha } from "./hcaptcha";
import { submitContact, validateContactFields, type ContactErrors, type ContactFields } from "./submit-contact";

const emptyFields: ContactFields = { name: "", email: "", message: "" };
export function Web3FormsContact({ settings, content, locale }: Readonly<{
  settings: Web3FormsContactSettings;
  content: ContactContent;
  locale: ContactLocale;
}>) {
  const [fields, setFields] = useState(emptyFields);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const [activated, setActivated] = useState(false);
  const [captchaVersion, setCaptchaVersion] = useState(0);
  const captchaToken = useRef("");
  const inFlight = useRef<AbortController | undefined>(undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const receiveToken = useCallback((token: string) => { captchaToken.current = token; }, []);
  useEffect(() => () => {
    inFlight.current?.abort();
    inFlight.current = undefined;
    captchaToken.current = "";
  }, []);
  useEffect(() => { if (status !== "") statusRef.current?.focus(); }, [status]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current !== undefined) return;
    const invalid: ContactErrors = { ...validateContactFields(fields), ...(captchaToken.current === "" ? { captcha: true as const } : {}) };
    setErrors(invalid);
    const firstInvalid = (["name", "email", "message", "captcha"] as const).find(field => invalid[field]);
    if (firstInvalid !== undefined) {
      formRef.current?.querySelector<HTMLElement>(`#contact-${firstInvalid}`)?.focus();
      return;
    }
    const controller = new AbortController();
    inFlight.current = controller;
    setPending(true); setStatus("");
    const result = await submitContact({ settings, fields, subject: content.subject, captchaToken: captchaToken.current, signal: controller.signal });
    if (inFlight.current !== controller) return;
    inFlight.current = undefined;
    captchaToken.current = "";
    setCaptchaVersion(version => version + 1);
    setPending(false);
    if (result.kind === "accepted") setFields(emptyFields);
    if (result.kind === "invalid") setErrors({ [result.field]: true });
    setStatus(result.kind === "accepted" ? content.accepted : result.kind === "rate-limited" ? content.rateLimited : result.kind === "unknown" ? content.unknown : content.rejected);
  }
  return <ContactForm content={content} fields={fields} errors={errors} pending={pending} status={status} formRef={formRef} statusRef={statusRef} onChange={(field, value) => setFields(current => ({ ...current, [field]: value }))} onSubmit={event => { void submit(event); } } captcha={
    <>
      <p className="mb-3">{content.captchaNotice}</p>
      {activated ? <ContactCaptcha key={captchaVersion} locale={locale} content={content} onToken={receiveToken} /> : <button type="button" className="min-h-11 rounded-md border border-muted ps-4 pe-4 py-3 font-semibold" onClick={() => setActivated(true)}>{content.activateCaptchaLabel}</button>}
    </>
  } />;
}
