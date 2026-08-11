# Production Observability Provider Receipt Template

Use this template only after the separately authorized protected-staging and provider journey in the [preparation record](2026-08-11-production-observability-certification-preparation.md). Replace every bracketed prompt with content-safe evidence or `not executed`. Delete this instruction before review.

**Execution date:** [date and timezone]

**Certification receipt status:** [replace with `complete` only after every section is resolved]

**Certification reviewer decision:** [replace with `accepted` only after affirmative implemented-task review]

**Certification unresolved prompts:** [replace with `none` only after every bracketed prompt is resolved]

**Certification capability:** `observability`

**Certification descriptor version:** `0.2.0`

**Certification behavior-contract digest:** `sha256:a4f15a132e08da307ab412673b02152fee8509c0cc1dabb4b60856abd61f5d97`

**Certification evidence revision:** [40-character deployed Git revision]

**Passed certification outcomes:** `cleanup-recovery, deployed-application`

**Reviewed certification outcomes:** `cleanup-recovery, deployed-application`

## Workflow and revision identity

- Repository revision: [40-character Git commit]
- Workflow run identifier and artifact digest: [content-safe identifiers; do not include a private URL]
- Protected environment: `observability-certification`
- Dedicated Worker: `acme-portfolio-observability`
- Deployment risk owner and provider reviewers: [public identities and roles]
- Revision and default-branch checks: [pass / fail]
- Local and deployed receipt results: [pass / fail, checks, and revision-derived markers]

## Synthetic-data declaration

- Fixed application/custom event markers declared before execution: [browser error and web-vital correlation markers from the deployed JSON receipt]
- Certification-only framework error: `synthetic observability certification error`
- Expected bounded requests: [one home response, one generic error response, two accepted custom events, and seven rejected route inputs]
- The `Exercise deployed observability` step predeclares one `browser.window.error` with its revision-derived correlation marker, one `browser.web.vital` with its revision-derived correlation marker, and the `server.request.error` produced by the thrown certification route with a generated UUID that is not a revision-derived marker.
- The `Test deployed application behavior` step predeclares bounded `browser.web.vital` emissions from Playwright navigation. Their occurrence, metric mix, generated correlation identifiers, and count are non-deterministic; the receipt must not predeclare an exact marker or count for this class.
- Real client traffic, content, identities, request data, and production resources excluded: [yes / no]

## Deployed application and custom-event evidence

- Home response and certification-error response: [exact `200` and `500` status result]
- Browser-error and web-vital route acceptance: [exact `202` status results]
- Cross-origin, media-type, oversize, malformed JSON, extra-field, vocabulary, and secret-bearing rejection: [exact `403`, `415`, `413`, `400`, `400`, `400`, `400` status results]
- Complete observed custom-event inventory in Cloudflare Workers Logs and Better Stack: [for every predeclared class above, record the workflow source step, event name/kind/runtime/severity, content-safe correlation classification, allowed attribute names and vocabulary, deployed `release_id` match, and provider-specific observed count, including zero]
- Deterministic exercise reconciliation: [the revision-marker browser error, revision-marker web vital, and generated-UUID server request error are each present as expected in both providers / stop and reject]
- Playwright navigation reconciliation: [record the complete observed `browser.web.vital` metric-name set and count in each provider without claiming an exact expected marker or count]
- Additional custom event reconciliation: [reject the receipt unless every additional custom event is predeclared, bounded by the workflow step and generated vocabulary, and reconciled in the complete inventory]
- Application/custom event fields observed: [`schema_version`, `dt`, `event_name`, `event_kind`, `runtime`, `severity`, `correlation_id`, `release_id`, `error_category` when applicable, and allowlisted `attributes`; record field names and bounded expected values only]
- Unexpected or private fields observed: [none / stop and reject]

## Cloudflare platform and framework log evidence

- Workers Logs platform/framework error visible for the certification-only route: [yes / no]
- Provider-controlled platform/framework field inventory: [field names only; do not copy values, raw logs, request metadata, or stacks]
- Platform/framework retention setting and documented plan basis: [duration and plan basis]
- Invocation-log configuration remained disabled: [yes / no]
- Separation from application/custom event schema confirmed: [yes / no]

## Better Stack evidence

- Source, region, tier, quota, and retention: [content-safe source label; region; plan tier; quota before/after; retention; no ingestion host or private provider URL]
- Browser-error record receipt: [`schema_version`, `dt`, `event_name`, `event_kind`, `runtime`, `severity`, `correlation_id`, `release_id`, `error_category`, and `attributes` matched to the expected bounded values]
- Exercise web-vital record receipt: [`schema_version`, `dt`, `event_name`, `event_kind`, `runtime`, `severity`, revision-derived `correlation_id`, `release_id`, and `attributes` matched to the expected bounded values]
- Server-request-error record receipt: [`server.request.error` with bounded server/error vocabulary, generated UUID correlation identifier, deployed `release_id`, empty `attributes`, and no raw error content]
- Playwright-navigation web-vital inventory: [complete observed metric-name set and count with bounded browser/info vocabulary; do not assign an exact expected marker or count]
- Exact deployed revision match through `release_id`: [yes / no]
- Unexpected fields or events and post-run quota/spend result: [none and bounded result / stop and reject]

## Provider-failure containment test basis

- Package basis: [`packages/observability/tests/server.test.mjs` confirms provider rejection and a thrown provider request return stable bounded failure categories without provider-response content]
- Generated application basis: [`packages/builder-core/tests/render-skeleton.test.mjs` confirms the five-second request timeout signal and that dispatch, scheduling, and configuration failures do not escape reporting]
- Combined containment basis: [the exact tests above cover provider rejection, timeout and unreachable-request containment, non-throwing dispatch, and unchanged application behavior; record their exact passing commands]
- Live failure mutation: `not performed`; protected staging does not alter provider credentials to inject failure
- Evidence revision and exact local check results: [revision, commands, and pass / fail]

## Unauthenticated route abuse and cost decision

- Origin checking is not authentication: `confirmed`
- Public-route abuse and cost owner: [identity]
- Accepted deployment control or explicit bounded risk decision: [control, limit, monitoring, or rejection]
- Cloudflare and Better Stack quota/spend decision: [approved no-upgrade/no-incremental-spend boundary and observed result]
- Rerun trigger after abuse, quota, tier, retention, or cost change: [exact trigger]

## Credential disposition

- GitHub environment and secret access disposition: [protections, owners, retained/removed state, and next review]
- Cloudflare API credential disposition: [revoked / rotated / retained under named scope, expiry, and owner]
- Cloudflare Worker secret disposition: [removed with Worker / rotated / retained under named owner and expiry]
- Better Stack source token disposition: [revoked or rotated when supported / retained under named owner and expiry; do not claim undocumented behavior]
- Credential values recorded in workflow arguments, artifacts, or repository evidence: `none`

## Worker, source, and data cleanup

- Selected route-removal cleanup: [delete the certification Worker / clean redeploy without the certification fixture; `not executed` means `cleanup-recovery` cannot pass]
- Cloudflare Worker cleanup: [deleted certification Worker / clean replacement deployed without the certification fixture / not executed — cleanup-recovery fails]
- Better Stack source cleanup: [deleted / retained under explicit owner, expiry, and recovery decision]
- Better Stack retained data cleanup: [deleted or expired / retained under explicit retention and owner]
- Staging origin final state: [Worker unavailable after deletion / serves the clean replacement without the certification route]
- Post-cleanup reachability verification for `/api/observability-certification-error`: [confirm the route is unreachable, then record the observed result as `404` after clean redeploy or Worker/origin unavailable after deletion; record no response body]
- Cleanup outcome gate: `cleanup-recovery` cannot pass when the route remains reachable or the reachability result is not verified.
- Temporary generated candidate and certification-only route disposition: [runner-temporary project expired; route absent from builder templates and generated fixtures and retained only as the certification test fixture]
- Recovery evidence for source, deployment, credentials, provider source, and retained data: [separate content-safe outcomes]

## Privacy exclusions

This receipt must not contain any secret, credential, token value, ingestion host, private URL, raw log, raw provider record, stack, request metadata, header, cookie, IP address, user agent, client data, client identifier, or real traffic content. Record only bounded field names, fixed synthetic markers, approved enum values, counts, statuses, retention decisions, and public identities. Stop and reject the evidence if unexpected private or real content appears.

## Claim boundary

This receipt records one exact protected-staging journey. It does not establish durable delivery, retries, ongoing provider availability, production readiness, performance, visual approval, security completeness, human accessibility, or WCAG conformance. `waitUntil()` remains best-effort, provider retention and quotas remain plan-dependent, and automated accessibility results remain partial evidence only.

## Reviewer decision

- Deployed application/custom event evidence accepted: [yes / no and reason]
- Cloudflare platform/framework evidence accepted: [yes / no and reason]
- Better Stack evidence accepted: [yes / no and reason]
- Failure-containment basis accepted: [yes / no and reason]
- Abuse/cost decision accepted: [yes / no and reason]
- Credential disposition accepted: [yes / no and reason]
- Certification-only error-route unreachability accepted: [yes / no and reason]
- Cleanup/recovery evidence accepted: [yes / no and reason]
- Registry may change from `pending` to `certified`: [yes / no]
- Review revision: [40-character Git commit]
- Rerun trigger evaluation: [none / exact trigger requiring a newly authorized rerun]
