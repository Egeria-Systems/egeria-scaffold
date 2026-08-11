# Booking Calendly Provider Certification Review Packet

**Date:** 2026-08-10 (America/Toronto)

**Status:** Ready for explicit verified-final-diff review; provider journey complete and external cleanup confirmed

**Certification baseline:** `f9ccb143724b4f1dd7f05a2ee8e3219c224d5558`

**Implementation commit:** `adf63e1`

**Implementation comparison:** `f9ccb143724b4f1dd7f05a2ee8e3219c224d5558..adf63e1`

**Review-record commit:** the separate enclosing commit that adds only this packet

## Outcome

`booking-calendly@0.1.0` is recorded as `certified`. Its registry evidence combines the retained compiled-CLI fresh-scaffold receipt with one separately authorized exact-revision protected-staging journey that passed deployed application behavior, provider-confirmed scheduling, cancellation, and cleanup.

GitHub Actions run [31443784009](https://github.com/Egeria-Systems/egeria-scaffold/actions/runs/31443784009), attempt 2, job [93638099657](https://github.com/Egeria-Systems/egeria-scaffold/actions/runs/31443784009/job/93638099657), completed successfully against exact revision `f9ccb143724b4f1dd7f05a2ee8e3219c224d5558`. GitHub reported artifact `booking-calendly-certification-31443784009-2` with digest `sha256:aafab7d79e3791b90d269fee515ef3d3e6feb9ce09922a538a224d08d731b26e` and seven-day retention.

The sole operator then completed exactly one synthetic booking through the deployed project, received the provider confirmation email, confirmed exactly one corresponding upcoming 30-minute meeting, cancelled it, and confirmed that no upcoming synthetic meeting remained. The pre-existing designated Free-compatible event type was preserved. The dedicated non-production Worker was deleted, and a fresh request to its former staging URL returned HTTP `404`.

The recurring repository browser checks continue to stub and fail-close the Calendly origin. They test generated application behavior without relying on provider availability. The one-time provider receipt establishes only the bounded journey above; it is not an ongoing Calendly service-level claim.

The long-lived Cloudflare token labelled `egeria-scaffold github tests` remains stored as the GitHub `compatibility` environment secret `CLOUDFLARE_API_TOKEN`. Its value was not accessed or recorded. It is retained for other authorized end-to-end tests, must be reviewed by 2027-08-10, and must be rotated immediately after suspected exposure or a material account, permission, or ownership change.

No workflow was dispatched again, no second booking was created, no paid Calendly upgrade was used, and no Worker was recreated during certification closure.

## Changed files

Implementation commit `adf63e1` modifies:

- `CONTRIBUTING.md`
- `README.md`
- `certifications/capabilities.json`
- `docs/architecture/capability-model.md`
- `docs/architecture/enforcement-map.md`
- `docs/architecture/overview.md`
- `docs/implementation-evidence/2026-08-10-booking-calendly-certification-verification.md`
- `docs/roadmaps/program-roadmap.md`
- `docs/superpowers/plans/2026-08-10-booking-calendly-certification.md`
- `packages/builder-core/AGENTS.md`
- `packages/builder-core/README.md`
- `tests/capability-certification/certification-runner.test.mjs`
- `tests/constitution/constitution.test.mjs`

It adds:

- `docs/implementation-evidence/2026-08-10-booking-calendly-provider-receipt.md`

The separate review-record commit adds only:

- `docs/review-packets/2026-08-10-booking-calendly-provider-certification.md`

Concurrent user-owned public-site roadmap, architecture, ADR, and constitution-test changes were preserved and excluded from both certification commits.

## Test-driven evidence and verification

The focused constitution contract first failed because the certified registry expected a provider receipt that did not yet exist (`ENOENT`). Adding the minimum receipt, registry transition, and current-document updates restored GREEN. The certification command contract then exposed a stale expectation that the transition closure would still reject `booking-calendly`; the focused test was updated to require transition closure success and an exact six-record all-certified rejection, then passed 5/5.

Independent review produced two further material counterexamples. Privacy coverage did not prohibit a private Calendly scheduling URL, and the runbook retained stale pending/unexecuted language while the receipt did not have an explicit privacy-exclusions section. Focused assertions failed before those repairs and passed after the receipt, plan, and content-safety contract were corrected.

The complete pinned command was run on the coherent implementation tree:

- `CI=true volta run --node 22.23.2 --pnpm 11.20.0 pnpm run verify:builder-kernel`: passed with constitution 28, package-boundary 41, builder-core 129, CLI 10, certification 5, admission for seven records, eight generated-fixture tests, byte-stability counts 36/41/38, builder lint/build/typecheck, and the fixed-root `portfolio`, `portfolio-calendly`, and `site` frozen installs, peer checks, moderate audit, registry signatures, lint, typecheck, Next/OpenNext builds, browser installation, development browser suites, and workerd-preview browser suites. Changeset status reported the expected pending standards minor release intent.

An earlier restricted-sandbox attempt could not resolve the npm registry and was surfaced by the fixed-root verifier as `source-changed`. Inspection of its identity-bounded temporary copy found no source difference. The same pinned command passed when network access was available; no source repair was made for the sandbox-only failure.

After reviewer-directed documentation and content-safety repairs, only affected focused checks were repeated because no generated source, dependency, workflow, runtime, or verifier input changed. The exact implementation commit was then checked in a clean detached worktree:

- `CI=true volta run --node 22.23.2 --pnpm 11.20.0 pnpm install --frozen-lockfile`: passed for all six workspace projects; the lockfile policy was current and 720 locked packages were installed.
- `pnpm run test:constitution`: passed 28/28.
- `pnpm run check:semantic-naming`: passed with no findings.
- `pnpm run test:capability-certification`: passed 5/5 after building builder-core.
- `pnpm run check:capability-certification`: admission passed for seven records.
- `node scripts/check-capability-certification.mjs --closure legacy-backfill-exempt`: passed.
- `node scripts/check-capability-certification.mjs --closure all-certified`: rejected exactly `content-files`, `deployment-cloudflare`, `observability`, `section-composition`, `site-routing`, and `standards` as `backfill-pending`, the required full-closure stop.
- `git show --check adf63e1`: passed.

The successful full builder gate was not repeated after the final receipt/plan/test-only repairs because those changes do not alter the expensive generated-project inputs. The clean-worktree focused verification above covers the final exact implementation commit.

## Reviewer dispositions

- **Requirements:** found stale pending/unexecuted plan language and missing explicit privacy exclusions. The runbook now describes the completed bounded journey, and the receipt explicitly excludes invitee contact data, confirmation content, provider identifiers, credentials, private URLs, and unnecessary provider data. Recheck: ready.
- **Architecture and anti-overengineering:** found that the receipt's content-safety contract did not protect private Calendly scheduling URLs. The constitution test now rejects non-help Calendly URLs while preserving official help citations. Recheck: no material findings.
- **Test evidence:** confirmed the transition/full-closure expectations, the full-gate evidence boundary, and the proportional focused rerun after documentation-only repairs. Final result: no material findings; ready.

No additional specialist reviewer was required. The certification closure changes no generated UI, provider integration runtime, dependency, Cloudflare binding, persistent store, production resource, or accessibility behavior.

## Risks, deferred work, and claim limits

- This is one exact-revision, one-booking provider result. It does not prove ongoing Calendly availability, future Free-plan behavior, or another generated project's deployment.
- The recurring automated suite deliberately uses a stubbed provider origin. Provider-owned scheduling, confirmation, and cancellation behavior remains Calendly's responsibility after this bounded certification journey.
- The GitHub artifact expires after seven days. The content-safe repository receipt retains its digest and outcome metadata without retaining invitee data or private scheduling details.
- The shared test token remains active without a fixed expiry. Its least-privilege scope and continued ownership require the recorded annual and event-driven review; source rollback does not rotate or remove it.
- Automated browser and axe results do not establish visual approval, human or assistive-technology usability, accessibility conformance, production readiness, or WCAG conformance.
- Full certification closure remains blocked by the six explicit legacy backfills listed above.
- The next roadmap or launch-scope approval remains separate and out of scope. This packet does not approve another increment, retained client migration evidence, launch, deployment, publication, push, pull request, or merge.
- Concurrent public-site roadmap work remains user-owned and uncommitted. It is not evidence for this certification comparison.

## Rollback and recovery

Source and evidence rollback is an ordinary Git revert of `adf63e1`, followed by the focused constitution, semantic-naming, certification admission, and both closure-policy checks. That revert returns `booking-calendly` to `pending` and removes the provider receipt from active registry evidence. This review-record commit is reverted separately if the review record must be withdrawn.

Provider recovery is separate. The synthetic meeting is already cancelled, the upcoming-meeting count was confirmed as zero, and the pre-existing Calendly event type remains available. No provider deletion is required or authorized.

Cloudflare recovery is separate. The dedicated Worker is deleted and its former URL returned `404`; recreating it requires a new authorized run. The retained token and GitHub environment secret are not changed by source rollback and require separate explicit authorization to rotate or remove.

No database, queue, application persistence, payment, production deployment, or other durable client data was created. There is no persistent-data rollback.

## Current official-document basis

- Calendly help for managing and cancelling scheduled meetings.
- Cloudflare documentation for deleting Workers and restricting API tokens to account-level Workers script editing.
- GitHub Actions documentation for artifact digests, workflow artifacts, environments, and deployment protection behavior.
- OpenNext Cloudflare deployment documentation for the deployed Worker boundary.
- pnpm documentation for frozen installs, audit, and registry signature verification.

Exact source links and access dates are retained in the implementation plan and provider receipt rather than copied as a second normative source list.

## Stop gate

Stop for explicit user approval of the exact certification implementation and this review record. Approval accepts only the verified local diff. It does not authorize push, pull-request creation, merge, another workflow dispatch, another booking, Worker recreation, credential mutation, launch, or the next roadmap increment.
