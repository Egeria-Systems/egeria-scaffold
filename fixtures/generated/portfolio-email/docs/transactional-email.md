# Transactional email

`TransactionalEmailSender` is a provider-neutral application port implemented by a Resend adapter. Supply `serverTransactionalEmailLayer` to the consuming server Effect. Creating the Layer or constructing a send does no provider work. The consuming delivery boundary executes its program once and supplies its request abort signal. This capability adds no public sending endpoint, business email template, contact submission, authentication flow, queue, database, retry scheduler or outbox.

Each send requires one bare recipient address, a subject, plain text and a caller-supplied opaque idempotency key. An optional bare reply-to address and HTML body are supported. Display names, address lists and header control characters are refused. The adapter always uses the configured sender; callers cannot override it. Keys contain 1–256 ASCII letters, digits, dots, underscores, colons or hyphens and start with a letter or digit. Use a random opaque identifier, never an address, token or other personal information. Templates, localization, authorization, abuse prevention and business policy belong to the consuming use case.

## Runtime configuration

Provision these values as server runtime secrets or environment variables through the project's approved deployment workflow:

| Name | Value |
| --- | --- |
| `RESEND_API_KEY` | A Resend sending-only key restricted to the selected domain. |
| `TRANSACTIONAL_EMAIL_FROM` | One bare sender address on that domain. |
| `TRANSACTIONAL_EMAIL_DOMAIN` | The exact sender domain, without a URL or wildcard. |

Composition acquires Cloudflare runtime configuration lazily. Local validation checks only credential shape, address/domain syntax and sender-domain consistency. An operator must separately verify the domain in Resend and provision the restricted key; local validation proves neither verification nor provider permissions. Keep credentials out of source, `.egeria`, logs, evidence and review packets. Builds and controlled tests need no real key or live send.

## Acceptance and failures

A successful result has `status: "accepted"` and an opaque `messageReference`. It confirms provider acceptance only, never inbox delivery, reading or durable exactly-once processing. The adapter performs one native-fetch request to the fixed Resend send endpoint, refuses redirects, and applies a ten-second deadline through response-body consumption. It reads at most 16 KiB of response data. There is no SDK dependency, automatic retry, configurable endpoint or generated idempotency key.

Stable typed codes distinguish `transactional-email-validation`, `transactional-email-configuration`, `transactional-email-authorization`, `transactional-email-idempotency-conflict`, `transactional-email-rate-limited`, `transactional-email-quota-exceeded`, `transactional-email-unavailable` and `transactional-email-acceptance-unknown`. Error values expose no provider message, response body, credential, address or cause. A bounded integer `retryAfterSeconds` from 0 through 86400 may accompany a provider failure; it is information, not a retry instruction. Standard HTTP-date hints are converted to seconds using the runtime clock. Invalid or out-of-range hints are ignored.

Timeouts, transport failures, malformed success envelopes and server errors leave acceptance unknown. Explicit endpoint refusals can report unavailability. Cancellation aborts the HTTP operation and preserves Effect interruption; it cannot retract a request already accepted by Resend. Do not treat interruption, a conflict with an in-progress request, or unknown acceptance as proof that nothing was sent.

Resend retains idempotency keys for 24 hours. A deliberate caller retry must reuse the same key and exact payload inside that interval. Changing the payload under a used key causes a conflict. No local durable deduplication exists, and expiry permits another send. See the [send API](https://resend.com/docs/api-reference/emails/send-email), [idempotency contract](https://resend.com/docs/dashboard/emails/idempotency-keys) and [error reference](https://resend.com/docs/api-reference/errors).

Operational events use the installed observability package and structured Worker logs. They contain only an acceptance/failure/unknown/interruption category and applicable stable code, plus the ordinary event identifier/time/service metadata. Addresses, subject, body, credentials, idempotency keys, message references, raw responses and arbitrary exception text are excluded. Reporting failure never changes the send result or sends another email. This capability provisions no telemetry provider or persistent log store.

## Verification and removal

Run `pnpm --dir apps/web run test:unit` for controlled application, adapter, composition and reporting behavior. These tests exercise the installed Effect runtime with controlled transport; they do not send email or certify live Resend, DNS, permissions, deployment, inbox delivery or production readiness. A built health-route test alone does not exercise an unconsumed email adapter.

Removal follows the builder's reviewed ownership, surviving-reference, fingerprint, isolated-verification and state-last transaction. Unresolved references or changed integrity refuse before mutation. Modified application-owned files require the ordinary preservation/ejection disposition. Removing email changes repository source only. Credential revocation, DNS changes, account/domain deletion and provider-retained data each require a separate operator decision and action.

On portfolio and site, selecting email adds its declared app-foundation dependency without changing the original profile or adding site routes to portfolio. Removing email retains that installed foundation, including its health, runtime and test surfaces, and records retention in the desired/installed state. Returning to a foundation-free repository requires separately scoped work. Existing app foundation and independently selected persistence remain intact. Historical recipes require their explicitly supported migration path; selecting email does not implicitly upgrade a recipe or transition a profile.
