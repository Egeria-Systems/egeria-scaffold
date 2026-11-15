# Shared Test Deployment

This document owns the shared non-production deployment boundary for the repository's manual compatibility proof and stateless capability certifications, and the separate protected staging boundaries below. The [review and contribution protocol](review-and-contribution.md) continues to own approval gates. Individual plans own their provider journey and evidence requirements.

## Fixed shared identities

- GitHub environment: `test-deploy`
- Public environment variable: `DEPLOY_URL`
- Cloudflare Worker: `test-deploy`
- Cross-workflow concurrency group: `test-deploy`, with in-progress cancellation disabled and `queue: max`

The variable must be the public HTTPS root origin served by that exact Worker. A redirect, private origin, production or client domain, different Worker route, or unreachable origin is a hard preflight stop. Values remain external configuration and must not be copied into committed evidence merely to make a check pass.

## Eligibility gate

A workflow may reuse this boundary only when its deployment is stateless, non-production, in the same Cloudflare account, and governed by the same protection boundary, owners, credential scope, quota, no-spend decision, cleanup procedure, and evidence-review standard. The [compatibility proof](../../.github/workflows/compatibility-proof.yml) is the only currently eligible deployment, including separately approved baseline recovery.

The [Calendly](../../.github/workflows/booking-calendly-certification.yml), [observability](../../.github/workflows/observability-error-diagnostics-certification.yml) and [Web3Forms](../../.github/workflows/web3forms-certification.yml) workflows refuse hosted certification for the current environment generation. Their deployed browser checks require [protected staging](#protected-staging-prerequisites), while the shared Worker serves a public origin. Each manual dispatch fails before requesting the shared lease, entering the GitHub environment or receiving credentials. Local runners remain available for their declared checks. A future hosted run requires subject-specific approval of a protected boundary and a verified workflow for that subject.

The historical Web3Forms certification used a stateless generated site on the shared Worker under the same account, Workers Scripts Write permission, main-only protection, owners, concurrency, no-spend decision and compatibility-baseline recovery. The separately approved owned-form journey used synthetic fields, a bounded human mailbox check, CAPTCHA rejection probes, seven-day form retention, human-controlled mailbox copies and explicit retention of the reusable form. Provider logs, backups and hCaptcha processing remain accepted residuals. Real CAPTCHA and mailbox inspection require human evaluation. The journey introduced no same-origin contact handler or Worker secret. Historical lease, recovery and provider-data dispositions retain their original scope.

A workflow is not eligible when it targets production, uses persistent data outside an explicitly accepted provider-data disposition such as the Web3Forms boundary above, needs a different Cloudflare account, uses a client or private domain, requires different provider permissions, changes the shared protection or spend boundary, cannot restore the baseline, or can leave provider-specific state without an approved disposition. Database, identity, payments, CMS, durable queue, storage, destructive migration, and privileged integration journeys therefore require a separately reviewed environment and provider-resource design unless a later accepted plan proves equivalence against this gate.

This is a bounded reuse policy, not permission to reuse one Worker for every future certification.

## Environment and credential contract

Before an eligible deployment or recovery dispatch, a read-only administrator preflight must confirm:

1. `test-deploy` exists, allows only the approved `main` ref, has the available reviewer, wait, custom-rule, bypass, and self-review protections recorded, and has no broader deployment policy;
2. `DEPLOY_URL` resolves to the public non-production `test-deploy` Worker root;
3. the only allowed environment secret names are `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `BETTER_STACK_INGESTING_HOST`, `BETTER_STACK_SOURCE_TOKEN`, and `WEB3FORMS_ACCESS_KEY`;
4. the workflow references only the secret names it requires and exposes them only to its exact credential-bearing steps;
5. each credential has a named owner, least-privilege non-production scope, expiry or review date, and rotation or revocation decision; and
6. the GitHub, Cloudflare, provider, privacy and cost, cleanup, dispatch, and evidence-review owners are named for the run.

Cloudflare currently defines `Workers Scripts Write` at account resource granularity rather than an individual Worker resource. It is the only Cloudflare permission allowed for these deploy and Worker-secret steps. The selected account must therefore be affirmed as non-production-only; a token that reaches any production Worker is ineligible even when its permission name is otherwise minimal.

`WEB3FORMS_ACCESS_KEY` is a public browser identifier stored as an environment secret to keep it masked in preparation logs and out of dispatch inputs and receipts. Only the preparation step receives it; generated browser assets necessarily contain it. Retain the identifier under the named form owner's reuse and scope-review decision. Protected storage does not turn it into a private credential or authorize submissions.

The no-upgrade and no-incremental-spend boundary is mandatory. A missing protection, unexpected secret name, production access, authorization failure, quota change, billing prompt, or revision drift stops the run. Never request, print, copy, persist, or commit secret values, ingestion hosts, private URLs, raw logs, request metadata, stacks, or real traffic data.

## Exclusive lease and deployment identity

The shared Worker has one exclusive lease from the first run-specific preflight through its separately approved cleanup and recovery verification. All eligible workflows use the same concurrency group so their deployments cannot run concurrently. Operators must also confirm that no manual or external deployment is active; GitHub concurrency does not coordinate changes made outside these workflows.

Generated candidate names remain capability-specific because they identify the generated application under test. Deployment commands override the generated Wrangler name and target the shared Worker explicitly. Receipts must distinguish the generated candidate identity from the exact deployed Worker, deployment, version, route envelope, and real-browser identity.

GitHub Actions remains the sole deployment authority. A queued dispatch is still a separate requested run, not an automatic rerun. Only one approved run may be dispatched for an authorization, and an unchanged failure must not be rerun automatically.

## Secret residue, cleanup, and recovery

Cloudflare documents that an ordinary code deployment preserves existing Worker secrets. Provider-specific secrets installed for one certification therefore remain on the shared Worker until they are removed or explicitly retained under a named owner, expiry, rotation, privacy, cost, and recovery decision. The exclusive lease must not be released while that disposition is unresolved.

Cleanup never deletes the reusable Worker merely because a certification finished. Under separate approval, the operator must:

1. remove or explicitly retain provider-specific Worker secrets under the recorded decision;
2. deploy the clean compatibility baseline to `test-deploy` through the protected workflow or another separately approved GitHub Actions recovery workflow;
3. verify every certification-only route is unreachable and the compatibility route serves the expected clean baseline;
4. resolve provider source and retained-data disposition, GitHub environment secret and variable disposition, credential rotation or revocation, and runner-temporary files exactly as the run-specific runbook requires; and
5. record the final Worker version, route result, quota and spend state, residual risk, and recovery owner without including prohibited content.

Source revert, Worker rollback, provider cleanup, credential recovery, environment deletion, and certification-registry transition are separate actions. The legacy `compatibility`, `certification`, and capability-specific environments must not be deleted until their historical evidence and active workflow references have been checked and deletion has separate explicit approval.

## Evidence boundary

Historical receipts keep the environment and Worker identities actually used at the time. Current plans and templates link this policy for later execution; they do not rewrite completed provider evidence. Reusing this boundary proves neither production readiness nor security completeness, durable delivery, performance, human accessibility, or WCAG conformance.


## Protected staging prerequisites

The analytics and synthetic boundaries below use separately approved, owned non-production HTTPS hostnames behind Cloudflare Access. They do not migrate the four shared consumers or change `test-deploy`, its public origin, credentials, lease or recovery. Historical synthetic receipts retain their actual shared identities and any outstanding recovery obligations.

Before either protected staging dispatch, a read-only administrator preflight must bind the environment's `DEPLOY_URL` to its exact Worker, owned QA zone and non-production account. The value must equal its canonical HTTPS root origin: no user information, port, path, trailing slash, query, fragment, IP literal, local name, `workers.dev` or preview destination. Keep both Worker subdomain controls disabled and admit only the approved protected custom hostname; check zone routes, schedules, service-binding callers and every other ingress against that envelope. A second hostname on the shared Worker does not isolate deployments. Missing ownership, domain binding, TLS, protection or current resource identity stops execution; URL syntax alone proves none of them.

Confirm an Access application covers the exact hostname with a default-refusing Service Auth policy, and a complete, valid, owned service-token pair is available as `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET`. Record owner, non-production scope, expiry or review date, rotation/revocation and post-run disposition without exposing values. Only admission and the exact readiness/browser steps receive that pair. Build values and browser expectations remain in their consuming steps; provider-management credentials remain confined to their existing steps. Generated private transport forwards Access headers only to the exact approved origin, refuses redirects and disables credential-bearing browser artifacts. Missing, partial, expired or ineffective Access configuration stops the run; no public fallback is allowed. Local contract tests do not prove live Access enforcement.

Both environments permit only the approved `main` ref, require the available environment reviewer and disable administrator bypass. Follow [ADR-0011](../adr/0011-github-actions-deployment-authority.md): prevent self-approval where supported, and use distinct eligible initiator and reviewer identities, or record an explicitly governed limitation before dispatch. The administrator must verify the actual controls; existing settings and workflow YAML do not establish compliance. The existing no-upgrade, no-incremental-spend, quota, named-owner, exclusive-lease and separate dispatch/final-diff approvals remain required.

Attachment of a protected custom domain to a metadata-only Worker with no published version remains unverified. The current [native domain attachment contract](https://developers.cloudflare.com/api/resources/workers/subresources/domains/methods/update/) names a Worker and does not state a published-version prerequisite; that is not evidence of backend acceptance. A separately approved administrator packet must name the QA account/zone, exact Worker and hostname, disabled alternate controls, Access policy, absence/collision checks and recovery, and authorize one bounded native attachment attempt after Access is prepared. Rejection or an ambiguous result stops for clarification. Do not upload bootstrap code, broaden permissions, add workflow modes/artifact protocols, retry other targets or delete/recreate resources to bridge that uncertainty. CI remains the code-deployment authority.

## Protected integration test deployment

The [analytics certification workflow](../../.github/workflows/analytics-certification.yml) uses the separate `integration-test-deploy` environment, Worker, and concurrency group, with in-progress cancellation disabled and `queue: max`. Its additional Web Analytics permission and required reviewer boundary keep it separate from `test-deploy`. The [protected staging prerequisites](#protected-staging-prerequisites) govern its approved hostname, Access and review controls. Its allowed environment secret names are `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_DEPLOY_API_TOKEN`, `CLOUDFLARE_WEB_ANALYTICS_API_TOKEN`, `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET`; this adds no permission to create or configure Access, DNS or domains from CI. Provider dashboard display names describe integration tests without a phase or date; the workflow and generated candidate retain their analytics-specific identities.

A future integration test may reuse this infrastructure only after a reviewed plan confirms equivalent account, protection, permission, privacy, quota, no-spend, resource disposition and recovery boundaries. It must share the concurrency group and hold the exclusive lease through verified recovery. The neutral name does not authorize additional provider permissions, stateful tests or production use. The analytics workflow is the only current consumer.

The former `analytics-certification` GitHub environment remains retained with its existing protections during migration. Its historical evidence keeps the original identity. Before the first dispatch to the new environment, verify its protections, variables, credential scope and expiry; saved token values must be entered by their owner because GitHub does not expose them for copying. Do not deploy through the former environment or treat identities from its origin as reusable evidence for the new Worker.

Recovery preserves reusable resources. After ending the synthetic browser journey and recording provider observations, dispatch `cleanup` with the approved current `expected_revision` and the original `exercise_revision`. The workflow reconciles the original site tag/token digest and Worker deployment/version against current readback before any mutation. It leaves the manual Web Analytics site (`auto_install: false`) intact and disables both the Worker's `workers.dev` route and preview URLs through Cloudflare's [script subdomain API](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/subdomain/methods/create/), using the existing Workers Scripts Write permission. It rereads resource identities and both disabled controls before issuing a receipt. Known Web Analytics sites use direct tag readback; hostname discovery requires a complete first page bounded to 100 sites and refuses incomplete pagination. A missing resource remains absent; an unknown or replacement resource, failed request, disappearance during recovery, or enabled URL prevents success. Recovery never deletes or recreates a resource.

This verifies the named Cloudflare controls, not provider-data erasure or a universal network isolation guarantee. The approved custom hostname remains attached behind Access; disabling `workers.dev` and preview URLs does not close that hostname. Before releasing the lease or accepting complete cleanup/recovery, the operator must verify the approved protected-host envelope, end open synthetic sessions, separately revoke or expire machine access (or perform separately approved route removal), verify the resulting access disposition, and record retained provider-data disposition. Unknown or additional ingress, active sessions or unresolved access disposition keeps that outcome pending. The automated receipt leaves that operator outcome pending. Retained GA4, Clarity, Search Console, private reporting resources, GitHub environment configuration, and historical measurements stay under their existing owner, privacy, retention, and credential-expiry decisions. Retention does not extend credentials or authorize new traffic, sharing, spending, or production use.

For a later approved exercise, supply `reuse_revision` naming the prior ancestral exercise instead of creating replacement resources. The workflow downloads that revision's unique, unexpired identity artifacts, validates their provenance, and refuses mismatched or missing known resources. It accepts the retained Worker only while both URL controls remain disabled; deployment then records the new exact deployment/version. Omitting `reuse_revision` permits fresh creation only when the resources do not exist. `exercise_revision` remains cleanup-only. All current-main, environment-review, account-scope, exclusive-lease, privacy, and no-spend preflights apply again.

Identity-only artifacts retain for 90 days to support subsequent test runs; build and redacted execution receipts retain for seven days. Preserve the private identity/recovery evidence before artifact expiry. Expired, missing, duplicate, or inconsistent provenance stops automated reuse and requires a separately reviewed identity-reconciliation procedure for the same retained resources. It never authorizes deletion, blind adoption, or broadening credentials to work around the missing evidence.

## Dedicated synthetic staging

The [synthetic client journey](../../.github/workflows/synthetic-client-journey.yml) uses `synthetic-client-staging` for its GitHub environment, exact Worker override and concurrency group, with in-progress cancellation disabled and `queue: max`. It follows the [protected staging prerequisites](#protected-staging-prerequisites). The environment's allowed secret names are `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET`; `DEPLOY_URL` is its approved protected origin. The deploy token retains only the existing Workers Scripts Write scope in the affirmed non-production-only account. This separate boundary does not broaden the shared environment's secret allowlist.

The synthetic client journey uses a pre-existing operator-owned Cloudflare Web Analytics site token supplied only at dispatch. It creates no provider resource and performs no control-plane provider mutation. The token is a public site identifier, is masked before use, and is supplied to the exact generated build/browser/deploy steps rather than stored in generated capability settings. Development checks retain their local target; a separate staging build is bound to clean builder/generated Git identities and a prepared-artifact record verified before and after preview and immediately before explicit staging deployment. Neither those local checks nor a prepared-artifact receipt proves hosted behavior.

After explicit opt-in, the deployed browser check sends only bounded synthetic measurement traffic and accepts the provider-account retention already chosen for that test traffic; it does not establish provider receipt or deletion. Keep its content-safe receipts and existing seven-day artifact retention. Preserve [ADR-0020](../adr/0020-application-environments.md)'s provider/environment separation; no production domain or real client data is admitted here.

Hold the dedicated exclusive lease through separately approved recovery. Retain the reusable Worker and protected hostname behind Access, keep both alternate URL controls disabled, end open sessions, and separately revoke or expire machine access or obtain approval for route removal. Verify the exact deployed identity, approved ingress/access disposition, provider-data retention, credential expiry, quota and spend before releasing the lease. Disabling the two Worker URL controls alone cannot establish that the custom hostname is unavailable. No shared compatibility-baseline redeployment belongs to this dedicated boundary; unresolved historical shared runs retain their original recovery obligations. Source rollback, provider disposition, credentials, route removal and resource deletion remain separate actions with their own approvals.
