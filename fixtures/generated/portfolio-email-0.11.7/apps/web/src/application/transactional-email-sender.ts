import { Context, Data, type Effect } from "effect";

export type TransactionalEmailMessage = Readonly<{
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html?: string;
  idempotencyKey: string;
}>;

export type TransactionalEmailAcceptance = Readonly<{
  status: "accepted";
  messageReference: string;
}>;

export const transactionalEmailErrorCodes = Object.freeze([
  "transactional-email-validation",
  "transactional-email-configuration",
  "transactional-email-authorization",
  "transactional-email-idempotency-conflict",
  "transactional-email-rate-limited",
  "transactional-email-quota-exceeded",
  "transactional-email-unavailable",
  "transactional-email-acceptance-unknown",
] as const);

export type TransactionalEmailErrorCode = (typeof transactionalEmailErrorCodes)[number];

export class TransactionalEmailFailure extends Data.TaggedError("TransactionalEmailFailure")<{
  readonly code: TransactionalEmailErrorCode;
  readonly retryAfterSeconds?: number;
}> {
  constructor(code: TransactionalEmailErrorCode, retryAfterSeconds?: number) {
    super({ code, ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }) });
    Object.freeze(this);
  }
}

export type TransactionalEmailEvent =
  | Readonly<{ outcome: "accepted" | "interrupted" }>
  | Readonly<{ outcome: "failed" | "unknown"; code: TransactionalEmailErrorCode }>;

export class TransactionalEmailSender extends Context.Service<TransactionalEmailSender, {
  readonly send: (message: TransactionalEmailMessage) => Effect.Effect<
    TransactionalEmailAcceptance,
    TransactionalEmailFailure
  >;
}>()("@egeria-systems/generated-app/TransactionalEmailSender") {}
