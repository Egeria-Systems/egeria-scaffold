# Remaining program: recorded user decisions

**Date:** 2026-09-15; updated 2026-09-16; delivery status reconciled 2026-09-23
**Status:** All program-level direction questions are answered. On 2026-09-16 the user explicitly approved the bounded P7 initial-composition recommendation. Exact canonical diffs, implementation plans, certification and external actions retain their own gates.

This decision record owns the interpretation of the user's D1–D12 answers for the [delivery proposal](2026-09-16-remaining-program-delivery-plan.md) and [email planning handoff](2026-09-16-email-delivery-contract-plan.md). The P7 start-order exception is owned by the review protocol; this record explains the approved direction without defining a second lifecycle policy. It changes no executable behavior. Do not re-ask these direction questions. Return with a concrete choice only if evidence exposes a material unresolved tradeoff.

## 1. Decisions and remaining work

| Decision | User answer | Recorded disposition |
| --- | --- | --- |
| **D1** | Yes. | Accept capability-driven backend support for supported portfolio/site generations, preserving profile/content, defaults and historical behavior. The email-specific installed snapshots and canonical contract are implemented under [ADR-0017](../adr/0017-transactional-email-resend.md); separate certification remains required. |
| **D2** | Yes. | Implemented under [ADR-0017](../adr/0017-transactional-email-resend.md): one server-only attempt, stable logical-send identity, provider-acceptance/rejection/uncertainty outcomes and consumer-owned retry policy. No automatic standalone retry or inbox-delivery claim. |
| **D3** | Most resilient and future-proof approach within reasonable scope; explain pushback and why a smaller solution meets testing needs. | Engineering selection criteria accepted. Prefer durable behavioral coverage and compatible maintained tools; demonstrate any benefit before adding another runner or migrating the existing lane. Section 3 gives the current recommendation. |
| **D4** | Preference for a separate Worker for separation of concerns; invites pushback if the main Worker is sufficient. | Historical preference retained. After merged P5E-1, the subsequent explicit decision selects the shared primary Worker under ADR-0019; section 4 records both the evidence and decision. |
| **D5** | Recommended approach plus best practice. | Minimal durable contact with abuse/privacy controls and optional notifications. Use bounded, documented policy settings; no attachments or arbitrary form engine. Concrete policy defaults are prepared at P5F's gate. |
| **D6** | Recommended approach, ideally configurable. | Editorial-only CMS authority, protected staff, approved import/parity/cutover; use Payload's ordinary project-owned configuration for real editorial needs. |
| **D7** | Reasonable best practice, ideally configurable. | Secure individual-account baseline, explicit linking, server authorization, recent authentication for sensitive changes, private audit and recoverable export/deletion. Bounded policy settings; no generic identity-policy system. |
| **D8** | Reasonable best practice, ideally configurable. | Independent TOTP/passkeys with a reviewed cross-method assurance and recovery matrix, safe defaults and no silent bypass or last-method lockout. |
| **D9** | Reasonable best practice, ideally configurable. | Hosted payment surfaces, verified durable receipts and server-derived entitlements; configure actual business policy and supported modes without inventing prices, tax or legal obligations. |
| **D10** | Recommended approach. | Smallest signed booking/cancellation contract with durable deduplication, explicit source/environment binding, replay and recovery. No CRM. |
| **D11** | Recommended approach; performance still deferred. | Observed-risk fleet selection, real supported version edges, bounded portability and explicit recovery. Performance measurement/budgets remain deferred; this task does not reopen them. |
| **D12** | Recommended investigation, followed by explicit approval on 2026-09-16 of the concrete staging recommendation. | Approve the P7-only initial-composition exception: implement the full fresh authenticated recipe through focused work packages, then separately certify exact subjects in dependency order before migration/downstream work. No new intermediate profile or general waiver. |

D1/D2 are answered. D3 delegates a bounded evidence-led engineering recommendation. D4 is resolved by the subsequent shared-Worker decision after its merged topology proof; D12's staging direction is now settled, with canonical application and exact implementation gates still required. D5–D10 delegate reasonable defaults and useful configurability, not unspecified material policy or arbitrary scope expansion. D11 still needs actual authorized fleet targets at execution time; no further program-level performance decision is required.

## 2. Approved independent-review decision: P7 staging

The initial independent review found that the complete first authenticated recipe and strict certification-before-dependent implementation had no executable schedule on the existing support matrix. The user requested a recommendation balancing quality, resilience and QA against excessive work, then explicitly replied **“approved”** on 2026-09-16 to the bounded initial-composition approach below. This resolves the material D12 choice; do not ask it again.

**Accepted direction:** Build the complete first authenticated recipe through focused work packages; then certify each capability separately in dependency order before migration or downstream work. Existing persistence/email/foundation prerequisites must be certified before implementation. Changed shared prerequisite subjects are certified before dependent identity subjects. Identity-core precedes protected-area, Google and account-profile; support follows its declared core/protected/account dependencies. The final composed fresh-baseline checkpoint requires all exact required subjects to be certified.

Internal steps remain reviewable through focused RED/GREEN and contract/diff checks. The complete initial recipe receives independent requirements, architecture/security and test-evidence review and Gate 3. No incomplete public profile, temporary supported identity selection or unused abstraction is introduced to shrink the work packages.

Use one representative complete generated baseline where adequate. Reuse setup and unchanged causal evidence, while preserving each subject's own assertions, review and acceptance. Add cases for meaningful contract and security/data risks, not every possible configuration combination. Protected stateful staging still needs its actual plan and authority; it cannot borrow permission from the stateless shared deployment policy.

The tradeoff is later formal certification within this initial composition, which can expose integration defects after more dependent code exists. The deployed compatibility proof, early contract tests, focused internal checkpoints and final independent review reduce that risk. Creating extra supported intermediate products would add durable lifecycle/compatibility obligations without a current product need; the user approved avoiding that expansion.

The [review protocol](../governance/review-and-contribution.md#initial-authenticated-composition-exception) owns the narrow start-order exception; the roadmap names its composition and sequence, with precise references from the source plan. Publication of these documents does not authorize capability implementation, provider action or certification execution.

**No program-level material question remains pending.** Actual compatibility, topology, environment/resource choices and client-specific policy values remain the concrete entry inputs already assigned to their future Gate 1/2 checkpoints. A genuinely new material tradeoff must still be explained at that boundary.

## 3. D3: resilient testing with proportionate scope

**Recommendation:** Keep the accepted whole-built-Worker and persistence harness lanes. At each new binding capability, try the existing host-driven approach against the actual acceptance cases; use Workers Vitest where it provides a demonstrated missing capability or material feedback/isolation benefit at a compatible, bounded cost.

The Node host is test orchestration; it does not replace the Worker with a Node mock. ADR-0016 already places persistence execution in workerd. Cloudflare documents the Wrangler harness as supporting built Worker output, requests/events, bindings and diagnostic capture. This makes reuse a credible integration-testing approach, subject to the exact capability proof. [Cloudflare integration harness](https://developers.cloudflare.com/workers/testing/test-harness/)

Cloudflare also recommends its current Workers Vitest plugin for most Worker unit testing, with tests inside the runtime, per-file storage isolation and rapid reruns. That is meaningful counterevidence to a blanket “never add Workers Vitest” rule. It does not by itself establish compatibility with this repository's installed graph or replace final built-output tests. [Workers Vitest integration](https://developers.cloudflare.com/workers/testing/vitest-integration/)

The selection proof must cover:

- Real binding execution and deterministic isolated test data, with cleanup and useful failure diagnostics.
- Queue enqueue/consume, acknowledgement, retry exhaustion, duplicates, order changes and terminal recovery where jobs is the subject.
- D1 migration/transaction/recovery and R2 access/media behavior where those bindings are the subject.
- Whole deployed-artifact composition locally; separately authorized deployed/provider outcomes remain certification work.
- Exact dependency/peer compatibility, retained default and historical projects, runtime import boundaries, and the owning command/receipt contract.

If the existing harness passes these checks and the alternative adds no material missing coverage or maintenance benefit, a second runner, duplicate suites and a general runner abstraction are unnecessary. If a gap is reproduced, propose the smallest scoped adoption with explicit compatibility cost and retained evidence. No claim of permanent future-proofing; resilience comes from maintained tools, real behavior contracts and bounded replacement.

Accepted main now says future capabilities choose compatible runners at their own gates. An amendment to restore a mandatory Workers Vitest rule is not needed, and P5C is not reopened.

## 4. D4: source separation and Worker separation are different decisions

**Pushback:** A separate deployment is not required merely to keep concerns separate. HTTP delivery and queue delivery can be distinct thin handlers, call different application use cases and adapters, and share only a composition entry point. Business logic stays out of Next route files and the Worker entry point in either topology.

OpenNext documents a custom Worker entry point that reuses its generated fetch handler and adds another handler. Cloudflare defines queue consumption through its own handler contract. Together these support a shared-Worker candidate; they are not proof that this repository's exact OpenNext build and Queue configuration work together. [OpenNext custom Worker](https://opennext.js.org/cloudflare/howtos/custom-worker), [Queues JavaScript API](https://developers.cloudflare.com/queues/configuration/javascript-apis/)

**Main Worker is sufficient when the proof shows:** the HTTP and jobs code share an acceptable trust/credential boundary, deploy together, fit the actual runtime/bundle constraints, and have adequate queue retry, concurrency and recovery behavior. Keeping modules separate preserves maintainability without adding another deployable artifact.

**Choose a separate jobs Worker when there is a concrete benefit:**

- Job-only secrets/bindings or permissions should be unavailable to HTTP execution.
- Jobs require independent deployment, rollback, scaling/resource settings, bundle contents or ownership.
- Shared deployment/runtime behavior causes an evidenced failure or operational coupling.
- Preserving the generated OpenNext entry point proves materially simpler or safer than a compatible custom entry point.

A separate Worker adds another build/configuration, environment/secret map, local orchestration and deployment/recovery target. It can isolate permissions and releases; it does not by itself solve duplicate delivery, distributed state, ordering or lost enqueue. Those controls remain mandatory in both designs.

The [local Queue topology comparison](../compatibility/queue-consumer-topology.md) now supplies evidence and a recommendation for this decision; the preference and production decision remain distinct.

**Planning disposition:** Your separate-Worker preference remains recorded. P5E-1 compares one minimal candidate per viable topology against the same tests and shows the concrete operational differences. Recommend the main Worker if separation offers only source-code neatness; recommend a separate Worker if one of the above benefits is demonstrated. Do not build both as supported product modes or create an empty `apps/jobs` now. Present the resulting design for the topology checkpoint, without re-asking the abstract preference.

### Subsequent human topology decision (2026-09-23)

After accepting merged PR #145 as local predecessor evidence with its limitations, the user explicitly selected the shared primary OpenNext Worker for P5E-2. Separate HTTP and Queue delivery modules meet the demonstrated source-separation need; a narrow composition entry point joins them. This supersedes the unsettled topology disposition above while preserving the historical preference and proof findings. [ADR-0019](../adr/0019-background-job-delivery.md) owns the selected architecture. No `apps/jobs` or second product topology is authorized. The [runtime sequencing exception](program-roadmap.md#one-time-2026-09-23-background-job-runtime-exception) bounds execution through the open MR before P4 closure.

## 5. Configurability boundary for D5–D10

The working interpretation of “as configurable as possible” is **useful, validated configuration for real project policies**, with secure defaults and explicit ownership. More switches create more supported combinations, migrations and failure paths; they are not automatically more adaptable.

Use, in order: existing validated content/configuration; the selected library's ordinary supported project-owned configuration; a small typed domain setting for an actual current variation. Custom business schema or specialized behavior remains ordinary application-owned code. Add a reusable abstraction only for demonstrated consumers.

- Validate settings at the owning boundary; reject unknown or incompatible combinations.
- Keep secrets in approved environment/secret stores. Separate public content, nonsecret server policy and credentials.
- Version persisted contracts and bind material configuration changes into the existing plan/inference/migration lifecycle where required.
- Do not offer ordinary configuration switches that disable server authorization, signature verification, replay protection, data integrity, private logging or state-last/refusal guarantees.
- Test defaults, changed supported values, invalid bounds and material interactions. Do not create a test for every independent scalar or promise a Cartesian configuration matrix.
- Reuse the selected CMS/auth/provider configuration where appropriate; do not invent a settings DSL, visual policy builder, generic workflow engine or provider registry.

### Applied to each capability

| Area | Reasonable baseline and useful configuration | Values or choices that remain explicit at the owning gate |
| --- | --- | --- |
| Contact (D5) | Required reply address/message, optional name; bounded plain-text fields, no attachments; simple received/in-progress/closed lifecycle; private authorized access, Turnstile and bounded request/rate limits. Notifications remain optional and separate from acceptance. Configure validated limits, notification destination and retention policy. | Present concrete limits and retention/deletion behavior with their rationale before exposing intake. Legal retention is not a universal “best practice.” Real collection needs an explicit operator-owned policy; synthetic certification uses a declared test policy. |
| CMS (D6) | Application-owned editorial collections/blocks/locales, minimal administrator/editor roles, protected previews and safe media allowlists. Use Payload's normal configuration and existing content normalization. No runtime arbitrary-schema builder or customer/staff account merger. | Exact editable content, media access/size/type policy, staff bootstrap, publication/revalidation and import/cutover compatibility are shown in P6's concrete plan. Any extra role/workflow must have a real use case. |
| Accounts (D7) | Minimal profile, verified identity, explicit authorized linking, protected sessions, recent authentication for sensitive operations, immediate access revocation and resumable deletion. Configure supported session/recovery windows and selected methods within documented bounds; use administrator/user roles already required by the program. | Exact session/recovery policy, administrator bootstrap, profile schema and export/delete/retention behavior need a concrete security-reviewed plan; no arbitrary policy callbacks or generic role editor. |
| Factors (D8) | Independent opt-in TOTP/passkeys with complete enrollment, challenge, recovery, revoke and abuse protection. RP/origin allowlists and supported recent-auth windows are configuration. | Propose the actual cross-method matrix, including verified-passkey step-up and lost-factor/admin recovery. No automatic equivalence between every passkey ceremony and MFA; test the stated assurance. |
| Billing (D9) | Existing three modes; hosted Checkout/Portal, server-controlled product/price mapping, verified receipts, idempotent projection and reconciliation. Start with simple documented effective-date/cancellation behavior. | Products, currencies, tax handling, proration/grace/refund/entitlement rules and retained records are explicit business settings. Missing required policy fails configuration admission; do not guess a real client's prices, liability or legal retention. Concrete defaults and support breadth come to P8C's plan. |
| Booking events (D10) | Booking/cancellation with verified source/environment, durable event identity and explicit replay/recovery. Configure the approved account/subscription identifiers and bounded retention/retry values. | Freeze exact provider event versions, reschedule semantics, replay retention and operating owner. Additional event families require actual consumers. |

These are bounded planning defaults and preparation obligations. “Best practice” authorizes engineering judgment, not an implicit answer to a material unresolved business, privacy or security question. If a later concrete decision changes stored data, assurance, billing meaning or support scope, explain the actual choice and ask then; do not present another broad checklist now.

Payload provides configuration for collections, globals, localization and admin/preview behavior; reuse those owners instead of wrapping every option in the builder. [Payload configuration](https://payloadcms.com/docs/configuration/overview)

The account plan should apply current authentication guidance for sensitive changes, recovery, abuse resistance and sessions, with an explicit threat model. Framework defaults alone do not establish those properties. [OWASP authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

## 6. Dated baseline and current delivery position

Read-only verification on 2026-09-16 identified main as `991ab80bf071d9671bd9c465c01f2ca83d253234`, integrating persistence through PR #129 and ADR-0016. Preserve that historical evidence; it is not the current execution baseline.

The registry at that preparation baseline had **five certified and six pending admission subjects**: standards, deployment-cloudflare, application-persistence, analytics, booking-calendly and observability. The default app baseline's six historical/current-exact local receipts were preserved separately. These dated counts do not replace the current registry, and this reconciliation runs or promotes no certification.

**Dated acceptance-record conflict:** persistence was merged while the inspected roadmap still required P4 acceptance before integration. Preserve that conflict for the owning closeout; the later email and Web3Forms merges do not themselves establish P4 closure or resolve another stream's evidence.

The [integrated delivery status](program-roadmap.md#hosted-contact-form--next-two-increments) now governs scheduling. D1/D2 are implemented in Resend; do not repeat P5D-1 planning or its runtime slices. Web3Forms certification integrated through PR #144. The merged P5E-1 proof is accepted as local predecessor evidence; the [bounded runtime exception](program-roadmap.md#one-time-2026-09-23-background-job-runtime-exception) now permits only the isolated P5E-2 candidate through an open MR; Resend certification remains required separate later work. Both retain their own exact-subject evidence and approval gates; the P7-only staging decision is unchanged.

## 7. Verification and preservation

The approved directions and sequence received bounded independent planning review with no remaining material findings. That review is evidence about the plan, not runtime or provider behavior. Candidate-specific reports and local workspace preservation records remain private.

This publication records the incremental plan, first planning handoff, decisions and the protocol-owned P7 exception. It changes no executable capability, configuration surface, certification registry, accepted receipt or provider state. Preserve existing implementation and worktrees, and obtain each later gate's own required evidence.

## Development, staging and production direction

**Recorded 2026-09-24:** [ADR-0020](../adr/0020-application-environments.md) accepts the lean environment direction: shared nonproduction resources where appropriate, justified finer-isolation exceptions, production separation, separate target builds, normal analytics-off behavior and narrow retirement of unused generation support. Its [roadmap admission](program-roadmap.md#lean-application-environments) is new direct stream authority, not retrospective phase acceptance. D1–D12 and their policy answers remain unchanged; D12's composition staging is an implementation-order exception, not a deployed staging environment.

The [delivery-plan environment clauses](2026-09-16-remaining-program-delivery-plan.md#application-environment-acceptance) own every future service's concrete target, callback, data, local/hosted evidence and recovery requirements. Each consuming capability ships its guide and worked composed example at first executable delivery. No new business, identity, payment or assurance policy is inferred; Google project separation is a provider-specific exception, while permissible manual Stripe sandbox sharing is the selected project policy. Future implementation refreshes the relevant official documentation.
