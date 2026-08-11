# Production Observability Provider Receipt Template

Use this template only after the separately authorized protected-staging and provider journey in the [preparation record](2026-08-11-production-observability-certification-preparation.md). Replace every bracketed prompt with content-safe evidence or `not executed`. Delete this instruction before review.

Apply the [shared test deployment policy](../governance/shared-test-deployment.md) to the current run. Historical completed receipts keep the identities actually used and are not rewritten from this template.

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
- Protected environment: `test-deploy`
- Generated candidate: `acme-portfolio-observability`
- Deployed Worker: `test-deploy`
- Public route binding: [`DEPLOY_URL` matched the exact `test-deploy` Worker root / mismatch requiring stop]
- Exclusive lease: [confirmed from preflight through cleanup / not confirmed — stop]
- Deployment risk owner and provider reviewers: [public identities and roles]
- Revision and default-branch checks: [pass / fail]
- Bounded workflow receipt inventory: [local receipt, Node route-envelope receipt, actual browser-instrumentation receipt, and Cloudflare identity receipt; pass / fail, exact checks, route markers, and browser UUID only]
- Checked Git SHA to Cloudflare identity: [confirm the exact workflow order checked Git SHA, deployed, completed secret installation, captured `deployments list --json`, and sanitized the unique latest Cloudflare deployment identifier plus its single 100% Cloudflare version identifier]
- Cloudflare deployment identifier: [bounded UUID from the identity receipt]
- Cloudflare version identifier: [bounded UUID from the identity receipt]

## Synthetic-data declaration

- Fixed Node route-envelope markers declared before execution: [`routeBrowserError` and `routeWebVital` correlation markers from the route-envelope JSON receipt; these do not establish browser instrumentation]
- Actual browser-reporter correlation identifier: [the single UUID from the browser-instrumentation JSON receipt; this is generated at browser execution and is not revision-derived]
- Certification-only framework error: `synthetic observability certification error`
- Expected bounded requests: [the Node route exercise makes one home request, one generic error request, two accepted route-envelope custom-event requests, and seven rejected route inputs; the browser fixture makes one accepted actual browser-reporter request]
- The `Exercise deployed observability` step predeclares one Node-posted `browser.window.error` route-envelope event with its revision-derived correlation marker, one Node-posted `browser.web.vital` route-envelope event with its revision-derived correlation marker, and the `server.request.error` produced by the thrown certification route with a generated UUID that is not a revision-derived marker. The first two prove only route-envelope acceptance, not generated browser reporting.
- The `Test deployed application behavior` step dispatches an actual `ErrorEvent("error")` through the generated global listener and predeclares one actual generated browser reporter `browser.window.error` with the UUID recorded in the browser-instrumentation receipt. The same navigation may emit bounded `browser.web.vital` events; their occurrence, metric mix, generated correlation identifiers, and count are non-deterministic, so the receipt must not predeclare an exact marker or count for this class.
- Real client traffic, content, identities, request data, and production resources excluded: [yes / no]

## Deployed application and custom-event evidence

- Home response and certification-error response: [exact `200` and `500` status result]
- Node browser-error and web-vital route-envelope acceptance: [exact `202` status results]
- Actual browser instrumentation acceptance: [exact `202`, absent `cookie` and `referer` request headers, exact bounded `browser.window.error` envelope, and the browser-reporter UUID from the bounded receipt]
- Cross-origin, media-type, oversize, malformed JSON, extra-field, vocabulary, and secret-bearing rejection: [exact `403`, `415`, `413`, `400`, `400`, `400`, `400` status results]
- Complete observed custom-event inventory in Cloudflare Workers Logs and Better Stack: [for every predeclared class above, record the workflow source step, event name/kind/runtime/severity, content-safe correlation classification, allowed attribute names and vocabulary, deployed `release_id` match, and provider-specific observed count, including zero]
- Deterministic exercise reconciliation: [the Node route-envelope revision-marker browser error, Node route-envelope revision-marker web vital, and generated-UUID server request error are each present as expected in both providers / stop and reject]
- Actual browser-reporter reconciliation: [the browser-instrumentation receipt UUID identifies exactly one generated-listener `browser.window.error` in each provider / stop and reject]
- Playwright navigation reconciliation: [record the complete observed `browser.web.vital` metric-name set and count in each provider without claiming an exact expected marker or count]
- Additional custom event reconciliation: [reject the receipt unless every additional custom event is predeclared, bounded by the workflow step and generated vocabulary, and reconciled in the complete inventory]
- Application/custom event fields observed: [`schema_version`, `dt`, `event_name`, `event_kind`, `runtime`, `severity`, `correlation_id`, `release_id`, `error_category` when applicable, and allowlisted `attributes`; record field names and bounded expected values only]
- Release identity reconciliation: [every provider custom event has `release_id` equal to the captured Cloudflare version identifier; it must never equal or be interpreted as the Git SHA]
- Unexpected or private fields observed: [none / stop and reject]

## Cloudflare platform and framework log evidence

- Workers Logs platform/framework error visible for the certification-only route: [yes / no]
- Provider-controlled platform/framework field inventory: [field names only; do not copy values, raw logs, request metadata, or stacks]
- Platform/framework retention setting and documented plan basis: [duration and plan basis]
- Invocation-log configuration remained disabled: [yes / no]
- Separation from application/custom event schema confirmed: [yes / no]
- Cloudflare version metadata semantics: [`CF_VERSION_METADATA.id` supplies the executing Cloudflare version identifier used as custom-event `release_id`; it is not the Git revision. Exact workflow sequencing binds the checked Git SHA to the captured deployment/version receipt but does not prove telemetry delivery, retention, durability, or source equivalence beyond that run.]

## Better Stack evidence

- Source, region, tier, quota, and retention: [content-safe source label; region; plan tier; quota before/after; retention; no ingestion host or private provider URL]
- Node route-envelope browser-error record receipt: [`schema_version`, `dt`, `event_name`, `event_kind`, `runtime`, `severity`, revision-derived `correlation_id`, captured Cloudflare-version `release_id`, `error_category`, and `attributes` matched to the expected bounded values]
- Actual browser-reporter error record receipt: [`schema_version`, `dt`, `event_name`, `event_kind`, `runtime`, `severity`, browser-receipt UUID `correlation_id`, captured Cloudflare-version `release_id`, `error_category`, and `attributes` matched to the expected bounded values]
- Node route-envelope web-vital record receipt: [`schema_version`, `dt`, `event_name`, `event_kind`, `runtime`, `severity`, revision-derived `correlation_id`, captured Cloudflare-version `release_id`, and `attributes` matched to the expected bounded values]
- Server-request-error record receipt: [`server.request.error` with bounded server/error vocabulary, generated UUID correlation identifier, deployed `release_id`, empty `attributes`, and no raw error content]
- Playwright-navigation web-vital inventory: [complete observed metric-name set and count with bounded browser/info vocabulary; do not assign an exact expected marker or count]
- Every provider custom event uses captured Cloudflare version identity: [`release_id` equals the captured Cloudflare version identifier and never the Git SHA; yes / no]
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
- Cloudflare Worker secret disposition: [removed before lease release / rotated / retained under named owner, expiry, privacy, cost, and recovery decision]
- Better Stack source token disposition: [revoked or rotated when supported / retained under named owner and expiry; do not claim undocumented behavior]
- Credential values recorded in workflow arguments, artifacts, or repository evidence: `none`

## Worker, source, and data cleanup

- Selected route-removal cleanup: [restore the clean compatibility baseline on retained Worker `test-deploy`; `not executed` means `cleanup-recovery` cannot pass]
- Cloudflare Worker cleanup: [clean compatibility baseline deployed without the certification fixture / not executed — cleanup-recovery fails]
- Better Stack source cleanup: [deleted / retained under explicit owner, expiry, and recovery decision]
- Better Stack retained data cleanup: [deleted or expired / retained under explicit retention and owner]
- Staging origin final state: [retained Worker serves the clean compatibility baseline without the certification route]
- Post-cleanup reachability verification for `/api/observability-certification-error`: [confirm the route is unreachable and record only the status; record no response body]
- Clean compatibility route and deployment identity: [pass / fail and bounded identity]
- Cleanup outcome gate: `cleanup-recovery` cannot pass when the route remains reachable or the reachability result is not verified.
- Temporary generated candidate and certification-only route disposition: [runner-temporary project expired; route absent from builder templates and generated fixtures and retained only as the certification test fixture]
- Recovery evidence for source, deployment, credentials, provider source, and retained data: [separate content-safe outcomes]

## Privacy exclusions

This receipt must not contain any secret, credential, token value, ingestion host, private URL, raw log, raw provider record, stack, request metadata, header, cookie, IP address, user agent, client data, client identifier, or real traffic content. Record only bounded field names, fixed synthetic markers, approved enum values, counts, statuses, retention decisions, and public identities. Stop and reject the evidence if unexpected private or real content appears.

## Claim boundary

This receipt records one exact protected-staging journey. Capturing the latest Cloudflare deployment/version after secret installation binds those provider identifiers to the workflow-checked Git SHA only through the reviewed sequence; it is not a general provenance attestation. The receipt does not establish durable delivery, retries, ongoing provider availability, production readiness, performance, visual approval, security completeness, human accessibility, or WCAG conformance. `waitUntil()` remains best-effort, provider retention and quotas remain plan-dependent, and automated accessibility results remain partial evidence only.

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
