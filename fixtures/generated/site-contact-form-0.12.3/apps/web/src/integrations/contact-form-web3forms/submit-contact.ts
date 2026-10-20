import type { Web3FormsContactSettings } from "./contact-settings";

export type ContactFields = Readonly<{ name: string; email: string; message: string }>;
export type ContactField = keyof ContactFields;
export type ContactErrors = Readonly<Partial<Record<ContactField | "captcha", true>>>;
export type ContactSubmitResult =
  | Readonly<{ kind: "accepted" | "rejected" | "rate-limited" | "unknown" }>
  | Readonly<{ kind: "invalid"; field: ContactField | "captcha" }>;

export function validateContactFields(fields: ContactFields): ContactErrors {
  return {
    ...(fields.name.trim().length === 0 || fields.name.trim().length > 120 ? { name: true as const } : {}),
    ...(fields.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(fields.email.trim()) ? { email: true as const } : {}),
    ...(fields.message.trim().length === 0 || fields.message.trim().length > 5_000 ? { message: true as const } : {}),
  };
}

async function readAcknowledgement(response: Response, signal: AbortSignal): Promise<ContactSubmitResult> {
  if (response.status === 429 || [400, 401, 403, 422].includes(response.status) || !response.ok) {
    void response.body?.cancel().catch(() => {});
    return { kind: response.status === 429 ? "rate-limited" : [400, 401, 403, 422].includes(response.status) ? "rejected" : "unknown" };
  }
  const reader = response.body?.getReader();
  if (reader === undefined) return { kind: "unknown" };
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  let bytes = 0;
  let text = "";
  const decoder = new TextDecoder("utf-8", { fatal: true });
  try {
    while (!signal.aborted) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 16_384) { cancel(); return { kind: "unknown" }; }
      text += decoder.decode(chunk.value, { stream: true });
    }
    if (signal.aborted) return { kind: "unknown" };
    const body: unknown = JSON.parse(text + decoder.decode());
    if (typeof body !== "object" || body === null || Array.isArray(body) || !("success" in body)) return { kind: "unknown" };
    return { kind: body.success === true ? "accepted" : body.success === false ? "rejected" : "unknown" };
  } catch {
    cancel();
    return { kind: "unknown" };
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}

export async function submitContact(input: Readonly<{
  settings: Web3FormsContactSettings;
  fields: ContactFields;
  subject: string;
  captchaToken: string;
  signal: AbortSignal;
}>): Promise<ContactSubmitResult> {
  const errors = validateContactFields(input.fields);
  for (const field of ["name", "email", "message"] as const) if (errors[field]) return { kind: "invalid", field };
  if (input.captchaToken.trim().length === 0) return { kind: "invalid", field: "captcha" };
  if (input.signal.aborted) return { kind: "unknown" };
  const controller = new AbortController();
  let finishAbort: () => void = () => {};
  const aborted = new Promise<ContactSubmitResult>(resolve => { finishAbort = () => resolve({ kind: "unknown" }); });
  const abort = () => { controller.abort(); finishAbort(); };
  input.signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 15_000);
  try {
    const attempt = async (): Promise<ContactSubmitResult> => {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST", credentials: "omit", redirect: "error", referrerPolicy: "no-referrer",
        headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ access_key: input.settings.accessKey, name: input.fields.name.trim(), email: input.fields.email.trim(), message: input.fields.message.trim(), subject: input.subject, "h-captcha-response": input.captchaToken }),
      });
      if (controller.signal.aborted) { void response.body?.cancel().catch(() => {}); return { kind: "unknown" }; }
      return readAcknowledgement(response, controller.signal);
    };
    return await Promise.race([attempt(), aborted]);
  } catch {
    return { kind: "unknown" };
  } finally {
    clearTimeout(timer);
    input.signal.removeEventListener("abort", abort);
  }
}
