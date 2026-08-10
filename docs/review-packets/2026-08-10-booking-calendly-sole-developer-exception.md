# Booking Calendly Sole-Developer Exception Review Packet

**Date:** 2026-08-10 (America/Toronto)

**Status:** Ready for explicit user review; no external certification action executed

**Pre-amendment baseline:** `8c62701e2fec8902232480c84df95a0aa7815fa5`

**Reviewed implementation tip:** `296033e`

**Implementation comparison:** `8c62701e2fec8902232480c84df95a0aa7815fa5..296033e`

## Outcome

The certification runbook now truthfully supports the repository's sole-developer operating model. `CoveMB` is recorded separately as GitHub repository administrator, workflow dispatcher, deployment risk owner, Cloudflare account administrator, Calendly certification operator, and implemented-task reviewer. The receipt states that no independent human deployment reviewer exists. Read-only agent requirements, architecture/anti-overengineering, and test-evidence reviews remain independent implementation evidence, not GitHub deployment approval.

The current `compatibility` environment admits only `main`, has no required reviewer, and permits administrator bypass. Those facts are an accepted limitation for this bounded non-production journey. Compensating controls remain manual dispatch, an exact approved revision, `main` restriction, least-privilege environment secrets, a dedicated Worker, one synthetic booking, no spend, a content-safe receipt, and separate authorization for dispatch, booking, cancellation, and Worker cleanup. No environment setting or secret changed.

The existing public `30 Minute Meeting` one-on-one event was designated without changing the Calendly account. Its public scheduling URL is an uncommitted workflow input; the supplied inline-widget HTML and Calendly script are not needed by the builder's generated popup integration and were not added to source. Designation is the only authorized event-type action. The journey cannot create, change, disable, or delete the event type, and cleanup must preserve it after cancelling the one synthetic meeting.

The account is currently in a free trial, but the certification baseline uses only behavior currently documented for Calendly Free: one one-on-one event type, one connected calendar, customizable availability, supported video conferencing, and ordinary scheduling. Trial-only or paid workflows, routing, payments, multiple event types, multiple connected calendars, premium branding controls, upgrades, trial extensions, and incremental spend are excluded. Official plan documentation supports this design boundary; execution during the trial cannot by itself empirically prove future post-trial provider behavior, so trial expiry or a service-tier change remains a revalidation condition before a continuing availability claim.

No workflow, capability, certification registry, schema, generated source, fixture, dependency, application runtime, GitHub setting, Cloudflare resource, Calendly object, meeting, calendar record, or provider data changed. `booking-calendly@0.1.0` remains `pending`; the protected deployment, deployed browser journey, one provider booking, provider confirmation, cancellation, and Worker cleanup remain unexecuted.

## Current-source evidence

- Calendly's current [pricing page](https://calendly.com/pricing) lists one event type, one connected calendar, customizable availability, and video conferencing for Free.
- GitHub's current [environment-management documentation](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments) describes required reviewers, prevent-self-review, administrator bypass, branch restrictions, secrets, and variables as environment controls.
- GitHub's current [deployment-environment reference](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments) confirms that required reviewers need repository read access and that prevent-self-review requires more than one person.
- Read-only live preflight confirmed a public `Egeria-Systems/egeria-scaffold` repository, default branch `main`, one `main` deployment branch policy, no required reviewer, administrator bypass enabled, only organization member `CoveMB`, existing secret names `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`, existing variable `COMPATIBILITY_URL`, and no `BOOKING_CALENDLY_CERTIFICATION_URL`. Secret values were not accessed.
- Read-only Calendly inspection confirmed one visible `30 Minute Meeting` event described as `30 min`, `Google Meet`, and `One-on-One`. No provider setting changed, and the public URL is not recorded in this packet.

## Commits

- `f36e147` — document the approved exact-file sole-developer and Free-compatible plan amendment.
- `c47bca6` — add the truthful sole-operator runbook, Free-after-trial limits, provider receipt fields, and focused contract.
- `ec2696c` — narrow the selected provider authority to designation and preservation of the existing event only.
- `eabe8fe` — remove the remaining separately approvable event-deletion path and protect the boundary.
- `296033e` — harden the negative authority contract against additional approval wording.

## Changed files

Modified:

- `docs/superpowers/plans/2026-08-10-booking-calendly-certification.md`
- `docs/implementation-evidence/2026-08-10-booking-calendly-certification-preparation.md`
- `docs/implementation-evidence/booking-calendly-provider-receipt-template.md`
- `tests/constitution/constitution.test.mjs`

Added by this review commit:

- `docs/review-packets/2026-08-10-booking-calendly-sole-developer-exception.md`

## Test-driven evidence and verification

The focused contract first failed because the preparation did not record the sole-developer exception. It then passed after the minimum runbook and receipt amendment. Reviewer-directed negative coverage subsequently failed against the still-open create/delete alternatives and the stale separately approvable deletion sentence; each focused repair restored GREEN. The final assertion includes `authorized`, `approval`, and `approved` variants for the forbidden separate event-type mutation path.

Fresh final-tree commands used Node.js `22.23.2` through Volta:

- `node --test tests/constitution/constitution.test.mjs tests/constitution/semantic-naming.test.mjs`: passed 28/28, including documentation links, workflow boundaries, provider safety, sole-operator truthfulness, Free-after-trial limits, designation-only authority, and semantic naming.
- `node scripts/check-semantic-naming.mjs`: passed with no output.
- `node scripts/check-capability-certification.mjs`: admission passed for seven records.
- `node scripts/check-capability-certification.mjs --closure legacy-backfill-exempt`: rejected only `booking-calendly` as `pending`, the required stop behavior.
- `node scripts/check-capability-certification.mjs --closure all-certified`: rejected `booking-calendly` as `pending` and six frozen records as `backfill-pending`, the required stop behavior.
- `git diff --check 8c62701e2fec8902232480c84df95a0aa7815fa5..296033e`: passed.

The first `pnpm run` verification attempt stopped before tests because the ambient shell exposed Node.js `24.14.0` and pnpm `11.16.0`, not the repository pins. A Volta-pinned pnpm attempt then stopped before tests because the restricted environment could not fetch pnpm metadata and would not replace `node_modules` without a TTY. Neither attempt changed repository source. Direct commands under the exact pinned Node.js runtime provided the valid deterministic evidence above; no dependency, build, browser, network-provider, workflow, deployment, or booking behavior changed in this documentation-and-contract amendment.

## Reviewer dispositions

- **Requirements:** identified a valid alternative path for a certification-created/deleted event and a stale separately approvable deletion sentence. The runbook and receipt now permit designation only, the event is preserved, and negative coverage rejects creation/change/disabling/deletion authorization variants. Final recheck: no material improvements recommended.
- **Test evidence:** identified label-only assertions that did not enforce the exact sole-operator receipt values. The contract now requires no independent human reviewer, no required reviewer configured, the accepted-bypass/stop alternatives, and `CoveMB` in every role. Recheck: no material improvements recommended.
- **Architecture and anti-overengineering:** found no material improvement after checking ADR-0011, canonical ownership, external-action separation, Free-compatible scope, designation-only recovery, and proportionality.

No specialist reviewer was required because the amendment changes no runtime, accessibility behavior, provider integration code, credential, deployment, or provider resource.

## Risks, deferred proof, and unsupported claims

- There is no independent human deployment approval, and administrator bypass remains enabled. This is explicitly accepted only for the bounded non-production journey and is not represented as a protected-review guarantee.
- The missing `BOOKING_CALENDLY_CERTIFICATION_URL` variable and Cloudflare Worker collision/ownership check still block safe workflow dispatch.
- A live booking executed while the account is in a trial can validate the basic provider path but cannot alone prove post-trial availability. The flow excludes every known paid dependency; revalidate after trial expiry or any Calendly service-tier change before claiming ongoing Free availability.
- Hosted runner behavior, deployment, live Calendly rendering, booking, provider confirmation, cancellation, and Worker rollback/deletion remain unexecuted.
- Automated browser and axe checks remain bounded evidence. They do not establish visual approval, human usability, accessibility conformance, production readiness, or WCAG conformance.
- The capability and P2 remain open while `booking-calendly` is pending. This packet does not approve launch scope or a later increment.

## Rollback and recovery

Source rollback is ordinary Git reversion of `296033e`, `eabe8fe`, `ec2696c`, `c47bca6`, and `f36e147` in reverse order, followed by the affected documentation/constitution checks and exact-diff review. The review-packet commit is reverted separately if this record must be withdrawn.

No Calendly, GitHub environment, Cloudflare, persistent-data, or provider recovery is currently required because this amendment performed no external mutation. In a later authorized journey, source rollback remains separate from synthetic meeting cancellation and Worker rollback/deletion. The pre-existing Calendly event type must remain unchanged.

## Stop gate

Stop for explicit user approval of this exact amendment. Approval accepts only the verified repository diff. It does not authorize push, GitHub variable or environment mutation, workflow dispatch, deployment, booking, cancellation, Worker cleanup, capability certification, P2 closure, launch approval, or another increment.
