# Shared Test Deployment

This document owns the reusable non-production deployment boundary for the repository's manual compatibility proof and stateless capability certifications. The [review and contribution protocol](review-and-contribution.md) continues to own approval gates. Individual plans own their provider journey and evidence requirements.

## Fixed shared identities

- GitHub environment: `test-deploy`
- Public environment variable: `DEPLOY_URL`
- Cloudflare Worker: `test-deploy`
- Cross-workflow concurrency group: `test-deploy`, with in-progress cancellation disabled and `queue: max`

The variable must be the public HTTPS root origin served by that exact Worker. A redirect, private origin, production or client domain, different Worker route, or unreachable origin is a hard preflight stop. Values remain external configuration and must not be copied into committed evidence merely to make a check pass.

## Eligibility gate

A workflow may reuse this boundary only when its deployment is stateless, non-production, in the same Cloudflare account, and governed by the same protection boundary, owners, credential scope, quota, no-spend decision, cleanup procedure, and evidence-review standard. The current eligible workflows are:

- [compatibility proof](../../.github/workflows/compatibility-proof.yml);
- [booking Calendly certification](../../.github/workflows/booking-calendly-certification.yml); and
- [observability error-diagnostics certification](../../.github/workflows/observability-error-diagnostics-certification.yml); and
- [synthetic client journey](../../.github/workflows/synthetic-client-journey.yml).

The synthetic client journey uses a pre-existing operator-owned Cloudflare Web Analytics site token supplied only at dispatch. It creates no provider resource and performs no control-plane provider mutation. After explicit opt-in, the deployed browser check sends only bounded synthetic measurement traffic and accepts the provider-account retention already chosen for that test traffic; it does not establish provider receipt or deletion. The token is a public site identifier rather than a credential, and this reuse adds no GitHub environment secret or variable. Its exclusive lease cannot be released until the existing compatibility workflow restores and verifies the clean compatibility baseline under separate recovery approval.

A workflow is not eligible when it targets production, uses persistent data, needs a different Cloudflare account, uses a client or private domain, requires different provider permissions, changes the shared protection or spend boundary, cannot restore the baseline, or can leave provider-specific state without an approved disposition. Database, identity, payments, CMS, durable queue, storage, destructive migration, and privileged integration journeys therefore require a separately reviewed environment and provider-resource design unless a later accepted plan proves equivalence against this gate.

This is a bounded reuse policy, not permission to reuse one Worker for every future certification.

## Environment and credential contract

Before every dispatch, a read-only administrator preflight must confirm:

1. `test-deploy` exists, allows only the approved `main` ref, has the available reviewer, wait, custom-rule, bypass, and self-review protections recorded, and has no broader deployment policy;
2. `DEPLOY_URL` resolves to the public non-production `test-deploy` Worker root;
3. the only allowed environment secret names are `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `BETTER_STACK_INGESTING_HOST`, and `BETTER_STACK_SOURCE_TOKEN`;
4. the workflow references only the secret names it requires and exposes them only to its exact credential-bearing steps;
5. each credential has a named owner, least-privilege non-production scope, expiry or review date, and rotation or revocation decision; and
6. the GitHub, Cloudflare, provider, privacy and cost, cleanup, dispatch, and evidence-review owners are named for the run.

Cloudflare currently defines `Workers Scripts Write` at account resource granularity rather than an individual Worker resource. It is the only Cloudflare permission allowed for these deploy and Worker-secret steps. The selected account must therefore be affirmed as non-production-only; a token that reaches any production Worker is ineligible even when its permission name is otherwise minimal.

The no-upgrade and no-incremental-spend boundary is mandatory. A missing protection, unexpected secret name, production access, authorization failure, quota change, billing prompt, or revision drift stops the run. Never request, print, copy, persist, or commit secret values, ingestion hosts, private URLs, raw logs, request metadata, stacks, or real traffic data.

## Exclusive lease and deployment identity

The shared Worker has one exclusive lease from the first run-specific preflight through its separately approved cleanup and recovery verification. The three workflows use the same concurrency group so their deployments cannot run concurrently. Operators must also confirm that no manual or external deployment is active; GitHub concurrency does not coordinate changes made outside these workflows.

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
