# Transactional email

`TransactionalEmailSender` is a provider-neutral application port implemented by a Resend adapter. Supply `serverTransactionalEmailLayer` to the consuming server Effect. Creating the Layer or constructing a send does no provider work. The consuming delivery boundary executes its program once and supplies its request abort signal. This capability adds no public sending endpoint, business email template, contact submission, authentication flow, queue, database, retry scheduler or outbox.

Each send requires one bare recipient address, a subject, plain text and a caller-supplied opaque idempotency key. An optional bare reply-to address and HTML body are supported. Display names, address lists and header control characters are refused. The adapter always uses the configured sender; callers cannot override it. Keys contain 1–256 ASCII letters, digits, dots, underscores, colons or hyphens and start with a letter or digit. Use a random opaque identifier, never an address, token or other personal information. Templates, localization, authorization, abuse prevention and business policy belong to the consuming use case.

## Runtime configuration

Follow generated `docs/environments.md` ([source guide](https://github.com/Egeria-Systems/egeria-scaffold/blob/55fc25328e2d71ca74a35adfadc068217a178f90/packages/builder-core/templates/common/docs/environments.md)) for build target selection. The build input `APPLICATION_ENVIRONMENT` is compiled through the common configuration as `NEXT_PUBLIC_APPLICATION_ENVIRONMENT`; the server adapter compares that compiled target with runtime `APPLICATION_ENVIRONMENT` on every send. Missing, invalid or mismatched targets refuse before any HTTP call. Switching runtime values cannot repurpose an artifact built for a different target: rebuild for that target.

Copy `apps/web/.dev.vars.example` to ignored `apps/web/.dev.vars` for local Worker runtime configuration. Set these four email values there, alongside the matching runtime target. Keep recipient addresses and credentials out of public build variables, `.env.example`, `.egeria`, logs and committed real configuration. For a deployed Worker, configuration and secrets require the separately approved deployment workflow; do not assume values or secrets are inherited between Wrangler environments.

| Name | Value |
| --- | --- |
| `RESEND_API_KEY` | A sending-only key restricted to the selected domain. |
| `TRANSACTIONAL_EMAIL_FROM` | One bare sender address on that domain. |
| `TRANSACTIONAL_EMAIL_DOMAIN` | The exact sender domain, without a URL or wildcard. |
| `TRANSACTIONAL_EMAIL_ALLOWED_RECIPIENTS` | Required in development and staging: comma-separated, exact bare recipient addresses. Production ignores this value. |

This is synthetic configuration for intercepted tests only:

```dotenv
APPLICATION_ENVIRONMENT=development
RESEND_API_KEY=re_controlled_test_credential
TRANSACTIONAL_EMAIL_FROM=sender@example.test
TRANSACTIONAL_EMAIL_DOMAIN=example.test
TRANSACTIONAL_EMAIL_ALLOWED_RECIPIENTS=allowed@example.test,second@example.test
```

For staging tests, set both the compiled and runtime targets to `staging` and use the same synthetic list. In actual operator-approved nonproduction use, list only recipients whose owners approved testing. The entire list must be valid: no spaces, empty entries, trailing comma, JSON, display names, wildcard or domain-wide permission. Matching is exact and case-sensitive; addresses are neither normalized nor rewritten. `replyTo` is reply metadata, not another delivery recipient. The port has no batch, cc or bcc sending support.

A missing or malformed list returns `transactional-email-configuration`; a valid recipient absent from a valid list returns `transactional-email-authorization`. Both cause zero attempted sends. Production needs no list but still requires matching targets and valid key, sender and domain. These local checks cannot establish recipient ownership, remote key permissions, DNS verification or delivery.

Composition acquires Cloudflare configuration lazily. An operator must separately [verify the owned sending domain](https://resend.com/docs/dashboard/domains/introduction) and provision [a confidential API key](https://resend.com/docs/dashboard/api-keys/introduction) with [`sending_access` and the domain restriction](https://resend.com/docs/api-reference/api-keys/create-api-key). Builds and controlled tests require no real key or live send.

## Acceptance and failures

A successful result has `status: "accepted"` and an opaque `messageReference`. It confirms provider acceptance only, never inbox delivery, reading or durable exactly-once processing. The adapter performs one native-fetch request to the fixed Resend send endpoint, refuses redirects, and applies a ten-second deadline through response-body consumption. It reads at most 16 KiB of response data. There is no SDK dependency, automatic retry, configurable endpoint or generated idempotency key.

Stable typed codes distinguish `transactional-email-validation`, `transactional-email-configuration`, `transactional-email-authorization`, `transactional-email-idempotency-conflict`, `transactional-email-rate-limited`, `transactional-email-quota-exceeded`, `transactional-email-unavailable` and `transactional-email-acceptance-unknown`. Error values expose no provider message, response body, credential, address or cause. A bounded integer `retryAfterSeconds` from 0 through 86400 may accompany a provider failure; it is information, not a retry instruction. Standard HTTP-date hints are converted to seconds using the runtime clock. Invalid or out-of-range hints are ignored.

Timeouts, transport failures, malformed success envelopes and server errors leave acceptance unknown. Explicit endpoint refusals can report unavailability. Cancellation aborts the HTTP operation and preserves Effect interruption; it cannot retract a request already accepted by Resend. Do not treat interruption, a conflict with an in-progress request, or unknown acceptance as proof that nothing was sent.

Resend retains idempotency keys for 24 hours. A deliberate caller retry must reuse the same key and exact payload inside that interval. Changing the payload under a used key causes a conflict. No local durable deduplication exists, and expiry permits another send. See the [send API](https://resend.com/docs/api-reference/emails/send-email), [idempotency contract](https://resend.com/docs/dashboard/emails/idempotency-keys) and [error reference](https://resend.com/docs/api-reference/errors).

Account-specific [usage limits](https://resend.com/docs/api-reference/rate-limit) include rate and quota restrictions; team rate limits apply across keys. Consult the current account limits rather than assuming a fixed allowance. Rate and quota errors remain distinct; the caller owns any authorized retry and reconciliation.

Operational events use the installed observability package and structured Worker logs. They contain only an acceptance/failure/unknown/interruption category and applicable stable code, plus the ordinary event identifier/time/service metadata. Addresses, subject, body, credentials, idempotency keys, message references, raw responses and arbitrary exception text are excluded. Reporting failure never changes the send result or sends another email. This capability provisions no telemetry provider or persistent log store.

## Local example and independent composition

The example in `apps/web/tests/unit/server-transactional-email.test.ts` mocks `getCloudflareContext` with the synthetic development configuration above and intercepts global fetch. The interceptor accepts only the fixed Resend URL, returns synthetic acceptance, counts calls and never delegates to network transport. The test restores environment and fetch afterward. Within that test, the consuming program is:

```ts
const program = Effect.gen(function* () {
  const sender = yield* TransactionalEmailSender;
  return yield* sender.send({
    to: "allowed@example.test", subject: "Local example", text: "Synthetic message",
    idempotencyKey: "local-example-001",
  });
}).pipe(Effect.provide(serverTransactionalEmailLayer));
const result = await Effect.runPromise(program);
expect({ status: result.status, attemptedCalls }).toEqual({ status: "accepted", attemptedCalls: 1 });
```

Its imports are `Effect` from `effect`, `TransactionalEmailSender` from `@/src/application/transactional-email-sender`, and `serverTransactionalEmailLayer` from `@/src/composition/server-transactional-email`. The counter belongs to the test interceptor. Run the complete adapter and server-layer examples from the generated root:

```sh
pnpm --dir apps/web run test:unit resend-transactional-email-sender.test.ts server-transactional-email.test.ts
```

The suites also exercise missing lists, unauthorized recipients and target mismatches with zero attempted calls. Run `pnpm --dir apps/web run test:unit` for all generated unit contracts. Intercepted acceptance does not establish Resend API acceptance or mailbox arrival. A health-route test alone does not exercise an unconsumed email adapter.

Use generated `apps/web/docs/application-boundaries.md` ([source guide](https://github.com/Egeria-Systems/egeria-scaffold/blob/55fc25328e2d71ca74a35adfadc068217a178f90/packages/builder-core/templates/app-foundation/application-environments/apps/web/docs/application-boundaries.md)) for server composition. A use case requiring only email supplies `serverTransactionalEmailLayer`; it requires no database or queue. An email-absent use case never requests `TransactionalEmailSender` and performs no send. Selecting persistence independently adds its own schema, local `APP_DB` binding and checks. Its consumer validates compiled/runtime target and binding before a database operation; a mismatch must not write. See the repository [persistence guide](https://github.com/Egeria-Systems/egeria-scaffold/blob/55fc25328e2d71ca74a35adfadc068217a178f90/packages/builder-core/templates/application-persistence/application-environments/docs/application-persistence.md); selected projects also contain `docs/application-persistence.md`.

Background jobs remain unavailable in this internal application-environment candidate. The separate current [jobs guide](https://github.com/Egeria-Systems/egeria-scaffold/blob/55fc25328e2d71ca74a35adfadc068217a178f90/packages/builder-core/templates/background-job-delivery/docs/background-job-delivery.md) describes the existing dispatcher, envelope and `JOB_ENVIRONMENT` (`local`, `staging`, `production`) guards. Missing or mismatched jobs configuration, binding or envelope must not enqueue. Separate synthetic email, database and queue consumers demonstrate independent contracts; they do not create a queue-to-email or contact-to-email product flow. Local binding emulation cannot certify remote resource identity or delivery.

## Verification, operator work and removal

Controlled tests exercise the installed Effect runtime and stub transport. Real domain/key setup, recipient ownership confirmation, an explicitly authorized send, mailbox and uncertainty outcomes, provider retention review and cleanup remain pending operator/certification work. They do not follow from local checks, Worker builds or source approval.

Removal follows the builder's reviewed ownership, surviving-reference, fingerprint, isolated-verification and state-last transaction. Disable consumers and resolve source references before removal. Changed managed files refuse mutation; modified application-owned files require the ordinary preservation/ejection disposition. The shared `apps/web/.dev.vars.example` and ignored runtime values are application-owned and preserved. Review obsolete email values manually after disabling consumers; adding email to an edited example preserves it, so populate the required names from this guide.

Removing email changes repository source only. Retain provider resources that other consumers still use. Credential revocation, DNS changes, account/domain deletion and provider-retained data each require a separate operator decision. Source, dependencies, deployment, persistent data and provider recovery are distinct: restoring source cannot revoke a key, erase provider data or undo sent mail.

On portfolio and site, selecting email adds its declared app-foundation dependency without changing the original profile or adding site routes to portfolio. Removing email retains that installed foundation, including health, runtime and test surfaces, and records retention in desired/installed state. Returning to a foundation-free repository requires separately scoped work. Independently selected persistence and other integrations remain intact. Historical recipes require their explicitly supported migration path; selecting email does not implicitly upgrade a recipe or transition a profile.
