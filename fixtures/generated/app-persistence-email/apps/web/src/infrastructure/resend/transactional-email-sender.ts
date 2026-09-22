import { Cause, Effect, Exit, Layer } from "effect";
import {
  TransactionalEmailFailure,
  TransactionalEmailSender,
  type TransactionalEmailAcceptance,
  type TransactionalEmailErrorCode,
  type TransactionalEmailEvent,
  type TransactionalEmailMessage,
} from "@/src/application/transactional-email-sender";

type SenderDependencies = Readonly<{
  configuration: Effect.Effect<unknown, TransactionalEmailFailure>;
  request: typeof fetch;
  reportEvent: (event: TransactionalEmailEvent) => void | Promise<void>;
}>;

type ResendConfiguration = Readonly<{ apiKey: string; from: string }>;

const domainPattern = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/iu;
const opaqueTokenPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u;
const maximumResponseBytes = 16_384;
const requestDeadlineMilliseconds = 10_000;

function isAddress(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 254) return false;
  const [local, domain, extra] = value.split("@");
  return extra === undefined && local !== undefined && domain !== undefined &&
    local.length <= 64 && /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/u.test(local) &&
    domainPattern.test(domain);
}

function parseMessage(value: TransactionalEmailMessage): TransactionalEmailMessage {
  try {
    const { to, replyTo, subject, text, html, idempotencyKey } = value;
    if (!isAddress(to) || (replyTo !== undefined && !isAddress(replyTo)) ||
      typeof subject !== "string" || subject.trim().length === 0 || /\p{Cc}/u.test(subject) ||
      typeof text !== "string" || text.trim().length === 0 ||
      (html !== undefined && (typeof html !== "string" || html.trim().length === 0)) ||
      typeof idempotencyKey !== "string" || !opaqueTokenPattern.test(idempotencyKey)) {
      throw new TransactionalEmailFailure("transactional-email-validation");
    }
    return Object.freeze({
      to, subject, text, idempotencyKey,
      ...(replyTo === undefined ? {} : { replyTo }),
      ...(html === undefined ? {} : { html }),
    });
  } catch {
    throw new TransactionalEmailFailure("transactional-email-validation");
  }
}

function parseConfiguration(value: unknown): ResendConfiguration {
  try {
    if (typeof value !== "object" || value === null) throw new Error();
    const apiKey: unknown = Reflect.get(value, "RESEND_API_KEY");
    const from: unknown = Reflect.get(value, "TRANSACTIONAL_EMAIL_FROM");
    const domain: unknown = Reflect.get(value, "TRANSACTIONAL_EMAIL_DOMAIN");
    if (typeof apiKey !== "string" || !/^re_[A-Za-z0-9_-]{1,509}$/u.test(apiKey) ||
      !isAddress(from) || typeof domain !== "string" || domain.length > 253 ||
      !domainPattern.test(domain) || from.split("@")[1]?.toLowerCase() !== domain.toLowerCase()) {
      throw new Error();
    }
    return Object.freeze({ apiKey, from });
  } catch {
    throw new TransactionalEmailFailure("transactional-email-configuration");
  }
}

function unknownAcceptance(): TransactionalEmailFailure {
  return new TransactionalEmailFailure("transactional-email-acceptance-unknown");
}

function retryAfterSeconds(headers: Headers): number | undefined {
  const value = headers.get("retry-after");
  if (value === null) return undefined;
  if (/^\d{1,5}$/u.test(value)) {
    const seconds = Number(value);
    return seconds <= 86_400 ? seconds : undefined;
  }
  if (!/^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/u.test(value)) return undefined;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toUTCString() !== value) return undefined;
  const seconds = Math.max(0, Math.ceil((date.getTime() - Date.now()) / 1_000));
  return seconds <= 86_400 ? seconds : undefined;
}

function responseFailure(status: number, body: unknown, headers: Headers): TransactionalEmailFailure {
  const name: unknown = typeof body === "object" && body !== null ? Reflect.get(body, "name") : undefined;
  let code: TransactionalEmailErrorCode = "transactional-email-acceptance-unknown";
  if (status === 401 || status === 403) code = "transactional-email-authorization";
  else if ((status === 400 || status === 422) && typeof name === "string" && [
    "validation_error", "invalid_idempotency_key", "invalid_parameter", "missing_required_field", "missing_required_parameter",
  ].includes(name)) code = "transactional-email-validation";
  else if (status === 409 && (name === "invalid_idempotent_request" || name === "concurrent_idempotent_requests")) {
    code = "transactional-email-idempotency-conflict";
  } else if (status === 429 && (name === "daily_quota_exceeded" || name === "monthly_quota_exceeded")) {
    code = "transactional-email-quota-exceeded";
  } else if (status === 429 && name === "rate_limit_exceeded") code = "transactional-email-rate-limited";
  // These explicit endpoint refusals establish that no send was accepted.
  else if ((status === 404 && name === "not_found") || (status === 405 && name === "method_not_allowed")) {
    code = "transactional-email-unavailable";
  }
  // A server failure, including service_unavailable, cannot prove non-acceptance.
  return new TransactionalEmailFailure(code, retryAfterSeconds(headers));
}

async function readResponse(response: Response, signal: AbortSignal): Promise<unknown> {
  const reader = response.body?.getReader();
  if (reader === undefined) throw unknownAcceptance();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      if (signal.aborted) throw unknownAcceptance();
      const chunk = await reader.read();
      if (signal.aborted) throw unknownAcceptance();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maximumResponseBytes) throw unknownAcceptance();
      text += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode()) as unknown;
  } catch {
    cancel();
    throw unknownAcceptance();
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}

async function requestAcceptance(
  request: typeof fetch,
  configuration: ResendConfiguration,
  message: TransactionalEmailMessage,
  signal: AbortSignal,
): Promise<TransactionalEmailAcceptance> {
  if (signal.aborted) throw unknownAcceptance();
  const response = await request("https://api.resend.com/emails", {
    method: "POST",
    redirect: "error",
    signal,
    headers: {
      Authorization: `Bearer ${configuration.apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": message.idempotencyKey,
    },
    body: JSON.stringify({
      from: configuration.from, to: [message.to], subject: message.subject, text: message.text,
      ...(message.replyTo === undefined ? {} : { reply_to: message.replyTo }),
      ...(message.html === undefined ? {} : { html: message.html }),
    }),
  });
  if (signal.aborted) {
    void response.body?.cancel().catch(() => {});
    throw unknownAcceptance();
  }
  const body = await readResponse(response, signal);
  if (!response.ok) throw responseFailure(response.status, body, response.headers);
  if (typeof body !== "object" || body === null || Array.isArray(body) ||
    Object.keys(body).length !== 1 || !("id" in body) ||
    typeof body.id !== "string" || !opaqueTokenPattern.test(body.id)) throw unknownAcceptance();
  return Object.freeze({ status: "accepted", messageReference: body.id });
}

async function sendOnce(
  request: typeof fetch,
  configuration: ResendConfiguration,
  message: TransactionalEmailMessage,
  signal: AbortSignal,
): Promise<TransactionalEmailAcceptance> {
  // The pinned Effect runtime attaches the execution signal after starting work.
  // Yield before dispatch so an already-aborted execution cannot send a request.
  await Promise.resolve();
  if (signal.aborted) throw unknownAcceptance();
  const controller = new AbortController();
  const abort = () => { controller.abort(); };
  let rejectAbort: () => void = () => {};
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectAbort = () => { reject(unknownAcceptance()); };
  });
  controller.signal.addEventListener("abort", rejectAbort, { once: true });
  signal.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, requestDeadlineMilliseconds);
  if (signal.aborted) abort();
  try {
    // Race also bounds a transport or stream that fails to settle after abort.
    return await Promise.race([
      aborted,
      requestAcceptance(request, configuration, message, controller.signal),
    ]);
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
    controller.signal.removeEventListener("abort", rejectAbort);
  }
}

function report(dependencies: SenderDependencies, event: TransactionalEmailEvent): void {
  try {
    void Promise.resolve(dependencies.reportEvent(Object.freeze(event))).catch(() => {});
  } catch {
    // Reporting cannot change acceptance, interruption, or the number of sends.
  }
}

export function createResendTransactionalEmailSenderLayer(
  dependencies: SenderDependencies,
): Layer.Layer<TransactionalEmailSender> {
  return Layer.succeed(TransactionalEmailSender, {
    send: (input) => Effect.gen(function* () {
      const message = yield* Effect.try({ try: () => parseMessage(input), catch: () => new TransactionalEmailFailure("transactional-email-validation") });
      const environment = yield* dependencies.configuration;
      const configuration = yield* Effect.try({ try: () => parseConfiguration(environment), catch: () => new TransactionalEmailFailure("transactional-email-configuration") });
      return yield* Effect.tryPromise({
        try: (signal) => sendOnce(dependencies.request, configuration, message, signal),
        catch: (error) => error instanceof TransactionalEmailFailure ? error : unknownAcceptance(),
      });
    }).pipe(Effect.onExit((exit) => Effect.sync(() => {
      if (Exit.isSuccess(exit)) report(dependencies, { outcome: "accepted" });
      else if (exit.cause.reasons.some(Cause.isInterruptReason)) report(dependencies, { outcome: "interrupted" });
      else {
        const failure = exit.cause.reasons.find(Cause.isFailReason);
        const code = failure?.error instanceof TransactionalEmailFailure
          ? failure.error.code : "transactional-email-acceptance-unknown";
        report(dependencies, { outcome: code === "transactional-email-acceptance-unknown" ? "unknown" : "failed", code });
      }
    }))),
  });
}
