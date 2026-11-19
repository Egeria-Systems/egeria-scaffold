import type { FormEventHandler, ReactNode, RefObject } from "react";
import type { ContactContent } from "./contact-content";
import type { ContactErrors, ContactField, ContactFields } from "./submit-contact";

export function ContactForm({ content, fields, errors, pending, status, captcha, formRef, statusRef, onChange, onSubmit }: Readonly<{
  content: ContactContent;
  fields: ContactFields;
  errors: ContactErrors;
  pending: boolean;
  status: string;
  captcha: ReactNode;
  formRef: RefObject<HTMLFormElement | null>;
  statusRef: RefObject<HTMLParagraphElement | null>;
  onChange: (field: ContactField, value: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
}>) {
  const fieldClass = "block w-full min-w-0 rounded-md border border-muted bg-surface p-3 text-ink";
  return (
    <section id="contact-form" aria-labelledby="contact-form-heading" className="ps-4 pe-4 py-8 sm:ps-6 sm:pe-6 lg:ps-8 lg:pe-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <h2 id="contact-form-heading" className="text-2xl font-bold">{content.heading}</h2>
        <p>{content.summary}</p>
        <form ref={formRef} aria-labelledby="contact-form-heading" aria-describedby="contact-form-privacy" noValidate onSubmit={onSubmit}>
          <fieldset disabled={pending} className="flex min-w-0 flex-col gap-5 border-0 p-0">
            {(["name", "email", "message"] as const).map(field => (
              <div key={field}>
                <label htmlFor={`contact-${field}`} className="mb-2 block font-semibold">{content[`${field}Label`]}</label>
                {field === "message" ? <textarea id={`contact-${field}`} name={field} required maxLength={5000} rows={6} value={fields[field]} aria-invalid={errors[field] === true} aria-describedby={errors[field] ? `contact-${field}-error` : undefined} className={fieldClass} onChange={event => onChange(field, event.target.value)} /> :
                  <input id={`contact-${field}`} name={field} type={field === "email" ? "email" : "text"} autoComplete={field === "email" ? "email" : "name"} required maxLength={field === "email" ? 254 : 120} value={fields[field]} aria-invalid={errors[field] === true} aria-describedby={errors[field] ? `contact-${field}-error` : undefined} className={fieldClass} onChange={event => onChange(field, event.target.value)} />}
                {errors[field] ? <p id={`contact-${field}-error`} className="mt-2 font-semibold">{content[`${field}Error`]}</p> : null}
              </div>
            ))}
            <div id="contact-captcha" tabIndex={-1} aria-describedby={errors.captcha ? "contact-captcha-error" : undefined}>
              {captcha}
              {errors.captcha ? <p id="contact-captcha-error" className="mt-2 font-semibold">{content.captchaError}</p> : null}
            </div>
            <p id="contact-form-privacy">{content.privacy}</p>
            <button type="submit" disabled={pending} className="min-h-11 self-start rounded-md bg-accent ps-5 pe-5 py-3 font-semibold text-accent-contrast hover:bg-accent-hover disabled:opacity-60">{pending ? content.pendingLabel : content.submitLabel}</button>
          </fieldset>
        </form>
        <p ref={statusRef} role="status" aria-live="polite" aria-atomic="true" tabIndex={-1}>{status}</p>
        <a href="#contact" className="min-h-11 self-start py-3 font-semibold text-accent underline decoration-2 underline-offset-4">{content.fallbackLabel}</a>
      </div>
    </section>
  );
}
