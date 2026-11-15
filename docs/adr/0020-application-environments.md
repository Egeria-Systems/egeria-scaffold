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

Assemble one finite internal candidate through existing rendering boundaries. Public creation/defaults retain the last complete generation during partial implementation. Assign exact versions and schema dispositions from actual contents at the common-contract gate. Activate the public CLI/recipes atomically only when every consumer, verification path and guide is coherent. Except for the narrow early retirements below, retire only related unused generation support then; preserve historical decisions, receipts and evidence. Activation of a complete local builder candidate is distinct from certification, package publication and describing it as complete and releasable: all required release certification and acceptance outcomes must still be satisfied.

The schema-1 [dependency security successors](0015-vitest-five-generation.md#dependency-security-successors) are a dependency-only update to the complete public generation. They do not activate schema-2 configuration/settings, its CLI or provider consumers, or the retirement permitted below. The internal environment recipe identities remain unchanged.

### Early retirement of unused intermediate recipes

The separately approved retirement of `portfolio@0.11.1`, `site@0.12.1` and `app@0.2.1` takes effect before complete environment activation. No client project uses these intermediate recipes. This narrow timing exception supersedes ADR-0015's continued executable retention only for these three identities, both original and corrected Next declarations, their eleven executable fixture roots, five exclusive lock families and two incoming app edges. Raw or structured retired inputs refuse before writes; they cannot adopt public defaults through another operation.

Preserve complete original bytes in reachable Git history/recovery, independently frozen regression controls and the [historical visual source-input record and PNG inventory](../implementation-evidence/retired-recipe-visuals/transition-inputs.json). That record carries no successor acceptance. Keep shared descriptors, every other supported cohort and the schema-1 public defaults at this retirement boundary, `portfolio@0.11.2`, `site@0.12.2`, `app@0.2.2`, exact. Later literal-root successor selection follows [ADR-0015](0015-vitest-five-generation.md#literal-lint-roots-successors). This retirement neither activates schema 2 nor grants a migration, broader retirement, security exception or release acceptance. All other supersessions below still require complete activation.

### Early retirement of the unused portfolio literal-root recipe

The human separately approved retirement of `portfolio@0.11.3` before complete environment activation and attested that no real client or active project uses it with any capability combination. This is human attestation, not an independently discovered deployment inventory. The exception supersedes [ADR-0015](0015-vitest-five-generation.md#literal-lint-roots-successors) only for this recipe: all its capability combinations, the `portfolio-0.11.3`, `portfolio-calendly-0.11.3` and `portfolio-email-0.11.3` executable fixture roots, the two exclusive `portfolio-0.11.3` and `portfolio-0.11.3-foundation` lock families, and the incoming `portfolio@0.11.3 -> app@0.2.3` edge.

Complete original bytes remain recoverable from verified Git history and a separately restored bundle. Three independently frozen project/state controls preserve refusal coverage. Six original fixture PNGs and the inert visual candidate inputs remain in the [historical portfolio visual record](../implementation-evidence/retired-recipe-visuals/portfolio-0.11.3/transition-inputs.json); shared transition PNGs and existing admitted/candidate records remain exact. Raw, structured, stale and mixed retired controls refuse before writes or other effects. Explicit visual selection of `app@0.2.3`, whose source was this retired portfolio recipe, also refuses before preparation.

Retain `site@0.12.3`, `app@0.2.3`, their same-cohort site-to-app edge, every current `.4` recipe and all other supported cohorts. Installed-manifest authority and independent optional capabilities remain unchanged. This retirement supplies no migration, schema-2 activation, broader retirement, visual admission, certification or security exception. The unchanged security gates, including fresh full-PR dependency review, must establish the resulting candidate's outcome.

### Early retirement of unused public generations

The human confirmed that the tool has not been used and requires no backward compatibility. The separately approved public-generation retirement therefore supersedes the timing and retention clauses in this ADR's generation boundary and two earlier retirement exceptions: older public executable recipes may retire before complete environment activation. This is a human attestation, not an independently discovered deployment inventory.

The sole public schema-1 generation is now `portfolio@0.11.7`, `site@0.12.7` and `app@0.2.7`, with ordinary `standards@0.5.1` and persistence `standards@0.6.1`. [ADR-0015](0015-vitest-five-generation.md#patched-public-generation) owns the exact dependency successors. The explicit internal schema-2 candidate retains portfolio `0.12.0`, site `0.13.0` and app `0.3.0`, with `standards@0.7.1`; it remains unavailable through public creation. Full schema/profile/recipe tuples distinguish internal portfolio `0.12.0` from retired public site `0.12.0`.

Retire the seventeen public recipe pairs recorded in the [frozen public-generation provenance](../../packages/builder-core/tests/fixtures/retired-recipes/public-generations.json), all forty-one corresponding executable fixture roots and twenty-three exclusive public lockfiles. Eleven successor fixtures and five public lock families replace them. Renew the three independent internal lock families without changing their recipe identities. Earlier retired intermediate controls remain refused. Preserve original bytes in verified recovery, existing frozen controls, historical receipts and the [eighty-two preserved fixture images](../implementation-evidence/retired-recipe-visuals/public-generation-retirement.json). Historical records remain evidence for their original subjects only.

The subsequent Next security renewal retires three additional unused public pairs: `portfolio@0.11.5`, `site@0.12.5` and `app@0.2.5`, their eleven executable fixture roots and five exclusive lock families. The current successors above replace them without reinterpreting an installed predecessor. Original bytes remain in verified recovery and Git history; eleven additional [frozen controls](../../packages/builder-core/tests/fixtures/retired-recipes/) preserve raw, structured and mixed-state refusal. All twenty-two predecessor fixture PNGs carry byte-identically to their corresponding successor fixture paths; this supplies no new visual admission. The earlier seventeen-pair provenance, forty-one-fixture record and eighty-two historical images remain unchanged.

The approved Workers-types correction also retires executable `application-persistence@0.1.0` in favor of exact `0.1.1`, as specified by [ADR-0016](0016-optional-application-persistence.md#workers-types-patch-successor). Preserve the [frozen original descriptor and registry record](../../packages/builder-core/tests/fixtures/retired-capabilities/application-persistence-0.1.0.json), original recipe controls and historical evidence. This changes no client data and adds no compatibility migration; retired or mixed installed persistence refuses before effects.

Remove obsolete capability-upgrade modules and the `plan-upgrade`/`apply-upgrade` CLI commands. Remove old profile-transition edges and historical-only certification runners. Current incoming app edges are exactly portfolio `0.11.7` to app `0.2.7` and site `0.12.7` to app `0.2.7`, with their existing eight optional subsets and operation-specific safeguards. Generic migration history and state-last persistence remain. Unknown, retired, stale and mixed controls refuse before effects, including read-only snapshot selection; none may acquire a current default implicitly.

Preserve independently used capability variants, including both jobs versions and current foundation, deployment, persistence and email combinations. This exception grants no client migration, provider action, security waiver, schema-2 public activation, certification acceptance or publication. All other complete-activation supersessions below retain their original timing.

Visual candidate preparation selects app `0.2.7` and refuses retired inputs. Historical visual admission records remain inert provenance; their retirement left the current admission set empty. At that retirement boundary, default comparison and portfolio-to-app planning/execution required separate exact successor admission and failed closed for unproved inputs. Only the default-measurement prerequisite is superseded prospectively by [fresh visual measurement and separate acceptance](#fresh-visual-measurement-and-separate-acceptance) below; portfolio-to-app planning/execution remains fail-closed. Matching historical pixels do not transfer approval. Site-to-app retains its no-visual-change behavior.

The separately approved successor source registers one finite current record for the separately accepted original four images and manifest, plus no-write reuse of the already-canonical PNGs. This narrowly extends the retirement-time empty-set state without restoring historical admission. The [app transition visual boundary](../architecture/capability-model.md#app-transition-visual-evidence) owns the shared lifecycle policy, retained accepted-source raw inventory and two-file bridge provenance, current lock/baseline membership and distinct measurement/acceptance claim limits. The human approved the concrete reviewed source candidate and no-write asset reuse separately from local implementation and deterministic tests. Promotion and ordinary visual execution retain their separate gates.

### Fresh visual measurement and separate acceptance

The human's 2026-10-27 prospective separation supersedes only the earlier default-comparison admission prerequisite in [early retirement](#early-retirement-of-unused-public-generations). Fresh candidate measurement and ordinary non-update comparison may exercise stable current public inputs without prior human acceptance of that source or influence tuple. The producer binds actual operation inputs, current schema/profile/recipe and lock, source and compiled bytes, expected PNGs, toolchain, browser and complete results. Input drift, unsafe paths and failed runtime or visual checks still refuse. The [canonical visual boundary](../architecture/capability-model.md#app-transition-visual-evidence) owns these controls and bounded hosted result retention.

Measurement is evidence, not an acceptance decision. Preserve separate exact-manifest human image approval and exclusive promotion, the finite portfolio lifecycle influence/lock/baseline membership and no-write refusals, and every original manifest/PNG identity. A passing measurement cannot refresh stale lifecycle evidence, promote a comparison manifest, rewrite baselines, restore retired public generation or activate schema 2. This amendment changes no generation tuple, lifecycle edge, security exception, certification status or production authority; earlier records retain their original scope.

### Supersessions at complete activation

Apart from the precise unused-public-generation timing exception above, this ADR supersedes only these conflicting obligations at complete activation:

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
