# ADR-0020: Application environments

**Status:** Accepted

**Date:** 2026-09-24

## Context

Public destinations currently travel through creation arguments and persisted settings, while server capabilities already have bounded resource and target contracts. Normal local work, protected staging and production need consistent configuration without a new provider framework or unsafe production fallbacks. No client project has been created; maintaining parallel settings formats and migrations for hypothetical consumers would add unnecessary support.

The [environment stream](../roadmaps/program-roadmap.md#lean-application-environments) owns actual entry, pending subjects, internal delivery and activation. Its [scoped governance exception](../governance/review-and-contribution.md#lean-application-environments-delivery-exception) changes routine approval and predecessor handling only for that stream. Acceptance of this ADR creates no runtime, certification outcome or external-action authority.

## Decision

### Target and configuration ownership

Use `APPLICATION_ENVIRONMENT` with exactly `development`, `staging` or `production`. Local development defaults to `development`; deployment requires an explicit valid target. Both staging and production use production compilation, so `NODE_ENV` is not the application target. Derive `NEXT_PUBLIC_APPLICATION_ENVIRONMENT` from the build target; it is not independently selectable. Wrangler supplies the matching runtime target. Existing server composition boundaries reject build/runtime disagreement before external effects. At persistence and jobs boundaries, map application `development` to their existing `local` target without renaming those protocols.

Keep capability/provider selection, presentation mode, consent policy and audience in `.egeria`. Read public destinations from fixed, statically named build inputs; secrets remain at existing server/Cloudflare boundaries. Do not introduce arbitrary variable mappings, a provider registry, dynamic browser configuration or a redundant settings-format discriminator.

| Public build input | Responsibility |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Exact origin for URLs, metadata and relevant origin checks |
| `NEXT_PUBLIC_ANALYTICS_ENABLED` | Only the exact string `true` enables collection, still subject to consent |
| `NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN` | Selected public beacon token |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | Selected GA4 measurement identifier |
| `NEXT_PUBLIC_CLARITY_PROJECT_ID` | Selected Clarity project identifier |
| `NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY` | Public hosted-contact access key |
| `NEXT_PUBLIC_CALENDLY_URL` | One scheduling destination for link, inline and popup modes |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Production-only Search Console metadata |

Preserve existing runtime names and adapters, including `RESEND_API_KEY`, `TRANSACTIONAL_EMAIL_FROM`, `TRANSACTIONAL_EMAIL_DOMAIN`, Better Stack host/token and `APP_DB`. Add `TRANSACTIONAL_EMAIL_ALLOWED_RECIPIENTS` for exact nonproduction recipient restrictions. Generate selected-only `apps/web/.env.example` and `.dev.vars.example`; real files remain ignored. Explain Next build inputs separately from Worker runtime inputs. Do not imply that Next.js automatically loads `.env.staging`.

Missing optional local contact or booking configuration produces a localized unavailable state and no provider request. A malformed nonempty value produces a field-only diagnostic, never the rejected value. Active selected deployment integrations require valid configuration. Missing required runtime inputs refuse before effects. Better Stack uses console fallback when both provider fields are absent; partial configuration is invalid. Local validation cannot prove remote values, account ownership or resource isolation.

### Analytics and consent

Keep analytics off during normal development and staging. Deliberate collection requires the exact build flag and visitor consent. A runtime or test-process flag cannot activate a disabled artifact. When deliberately enabled local collection lacks a selected provider identifier, disable the whole collection set with field-only diagnostics; enabled deployment requires every selected identifier. Do not add a partial-provider activation switch.

Consent controls remain available while collection is off, with the localized notice “Analytics collection is currently disabled.” Extend the existing consent context with collection state, target and configured destinations so a changed context requires a fresh choice. Preserve purpose keys, the 180-day lifetime, withdrawal, storage, cross-tab synchronization and reload behavior. Add neither a second store nor an opaque context-hashing layer.

GA4 uses host-only cookies (`cookie_domain: "none"`) and fixed production/nonproduction prefixes. Cloudflare Web Analytics uses the configured manual token, with automatic injection disabled to avoid duplicate or unintended collection. Real Clarity staging uses a separate registrable QA domain/project and exact allowed origin; controlled localhost tests do not establish that live behavior. Search Console remains production metadata only; Looker Studio remains guidance only. Analytics selection and consent do not disable functional contact, booking or operational observability.

### Resource isolation and effects

Share one appropriate nonproduction provider resource set per generated project, keeping production separate. Local persistent state remains simulated; staging and production databases remain distinct. Additional separation requires a provider requirement, security/state boundary or actual test-interference reason. Sharing never combines endpoint secrets, callbacks or trusted origins indiscriminately. Google sign-in uses separate deployment-environment projects. Manual development and staging may share a Stripe sandbox when their data/settings do not interfere; separately authorized live-provider CI uses an isolated sandbox. Ordinary CI uses controlled dependencies.

Hosted contact preserves its six-field browser submission, provider-compatible hCaptcha, request bounds, credentials omission and no-retry/no-fallback policy. Test form/inbox identities remain separate from production. Calendly uses isolated test account/calendars and one configured URL across its modes. Resend permits only explicitly allowlisted exact nonproduction recipients, without wildcards, address rewriting or production fallback; retain its one-attempt, ten-second, caller-idempotency and uncertain-outcome contract.

Persistence retains `APP_DB`, before-effect target checks, distinct staging/production database identities and non-cancelling per-target concurrency. Jobs retains the primary Worker, existing six queue identities, envelope guards, 24-hour retention and nonlocal operator attestation. Attestation is not remote verification. Existing jobs lifecycle, incidental optional operations on jobs-bearing repositories, profile transitions, replay and drain remain unsupported until their own accepted implementation.

Browser observability may send same-origin cookies only from the exact configured staging origin to its same-origin diagnostic endpoint for Access. All other contexts omit credentials. Preserve referrer restrictions, bounded privacy-safe payloads and contained reporting failures. This exception does not affect external Web3Forms requests and never places Access service credentials in browser code.

Metadata uses the configured origin; all nonproduction targets are noindex. Credentials, data and provider effects are not promoted with source code. Source rollback, deployment recovery, persistent-data recovery and provider disposition remain separate.

### Deployment and verification

[ADR-0011](0011-github-actions-deployment-authority.md) remains unchanged: GitHub Actions is the sole deployment authority. Build staging and production separately from the same frozen reviewed source revision, verify each artifact before deployment credentials, and require successful staging verification before native protected human production approval. All alternate staging routes must be protected or disabled. Generated YAML alone does not establish actual protection or approval eligibility.

Automated Access credentials are restricted to the exact authorized staging origin; deny forwarding to redirects or third-party requests and keep credentials out of browser source. Do not introduce a generic proxy. Separate controlled browser/runtime evidence, actual hosted behavior, provider-confirmed outcomes and operational recovery. Generating workflows or examples does not authorize executing them.

Future services consume this contract at first executable delivery. Their [delivery cards and certification rows](../roadmaps/2026-09-16-remaining-program-delivery-plan.md#application-environment-acceptance) own concrete callback, target, data, guide/example and composed-flow assertions. Do not implement future providers, schema, bindings or setup tooling now.

### Generation and precise supersessions

The complete new generation uses selection-only settings and creation arguments, with destinations supplied by the fixed configuration above. No client needs a legacy CLI branch, dual settings format or old-to-new migration. Necessary breaking changes are allowed only for this environment generation. Unknown, retired or mixed installed tuples refuse before writes. Preserve useful lifecycle for its actual supported tuples and later separately approved transitions; this is not permission to widen jobs operations.

Assemble one finite internal candidate through existing rendering boundaries. Public creation/defaults retain the last complete generation during partial implementation. Assign exact versions and schema dispositions from actual contents at the common-contract gate. Activate the public CLI/recipes atomically only when every consumer, verification path and guide is coherent. Retire only related unused generation support then; preserve historical decisions, receipts and evidence. Activation of a complete local builder candidate is distinct from certification, package publication and describing it as complete and releasable: all required release certification and acceptance outcomes must still be satisfied.

This ADR supersedes only these conflicting obligations, at that activation boundary:

- [ADR-0012](0012-purpose-based-analytics-consent.md): literal provider destinations in persisted analytics settings and the earlier consent-context shape; purpose-based policy and existing consent protections remain.
- [ADR-0015](0015-vitest-five-generation.md): continued executable retention of unused old recipes, installed snapshots and historical edges solely for this related generation retirement. Its historical Vitest/recipe decisions, installed-manifest authority and exact evidence remain; current public generation is preserved until activation.
- [ADR-0016](0016-optional-application-persistence.md) and [ADR-0017](0017-transactional-email-resend.md): preservation of unused old shared snapshots where retirement is necessary, plus configuration alignment with the common target and explicit email recipient restriction. Persistence removal/data safeguards and email outcome semantics remain.
- [ADR-0018](0018-hosted-contact-form.md): literal public key in creation/settings transport; fixed build configuration replaces it without changing the browser/provider contract.
- [ADR-0019](0019-background-job-delivery.md): preservation of unused old generation snapshots where necessary, and target/deployment reconciliation. Topology, delivery semantics, retention, evidence limits and lifecycle refusals remain.

No other architecture is superseded. In particular, retain materialized recipes and installed authority, application ownership, state-last guarded transactions, narrow ports, Effect boundaries, externalized copy, accessibility claim limits and public-package controls. No new generic executor, wrapper or configuration framework is justified.

## Consequences

- Local work can omit optional public destinations without accidental provider calls; deployments require deliberate target configuration.
- Each mechanism/service ships its own guide and worked example with exact public/secret and build/runtime locations, prerequisites, permitted sharing, commands, expected results, diagnosis, disabling and recovery. Shared concepts have one environment guide; consuming guides own composed examples and tests.
- Composed acceptance proves target consistency, success, optional absence, required-dependency refusal and concrete failure/recovery. A scenario can support separate causal subject assertions but never creates a composite certificate.
- New or materially changed subjects require their own evidence renewal, even when source/workflow/lock changes do not change a descriptor digest. This decision does not reset records or inherit prior certificates.

## Enforcement

The [enforcement map](../architecture/enforcement-map.md) owns actual versus planned gates; the [capability boundary](../architecture/capability-model.md#application-environments) owns assembly, lifecycle and certification limits. Configuration, compiled/runtime target refusal, credential isolation, provider/consent behavior, artifact verification and composed examples remain planned until their owning implementation and tests land. Document checks establish structure and source ownership only.

Primary sources checked on 2026-09-24 support the bounded decisions: [Next.js public build inputs](https://nextjs.org/docs/app/guides/environment-variables), [Wrangler environment declarations](https://developers.cloudflare.com/workers/wrangler/environments/), [native GitHub deployment review](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/review-deployments), [Google project separation](https://developers.google.com/identity/siwg/best-practices#google-cloud-project-setup) and [Stripe sandboxes](https://docs.stripe.com/sandboxes). Revalidate relevant provider requirements at implementation/certification preparation; project sharing policy is not a universal provider rule.
