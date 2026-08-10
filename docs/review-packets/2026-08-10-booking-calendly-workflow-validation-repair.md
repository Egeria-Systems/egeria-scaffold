# Booking Calendly Workflow Validation Repair Review Packet

**Date:** 2026-08-10 (America/Toronto)

**Status:** Ready for explicit verified-final-diff review; no workflow dispatch, deployment, booking, cancellation, or Worker cleanup executed

**Pre-repair baseline:** `bbfc15a429bd460f6b32a0df39492926232b9963`

**Reviewed repair tip:** `62c78c9`

**Implementation comparison:** `bbfc15a429bd460f6b32a0df39492926232b9963..62c78c9`

## Outcome

GitHub rejected the newly pushed manual workflow before creating a job because `jobs.verify-and-deploy.env` referenced `${{ runner.temp }}`. GitHub run `31441374064` contained zero jobs and reported `Unrecognized named-value: 'runner'` at line 31. No credential-bearing step, deployment, application test, Calendly interaction, or provider mutation ran.

The repair removes the job-level expression and supplies the unchanged temporary project path only to the four steps that consume `$CERTIFICATION_ROOT`: deployment-candidate creation, preparation, deployment, and deployed application testing. The parsed-workflow contract now rejects a job-level `runner` expression and requires the exact step-level environments. GitHub's current [context-availability reference](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#context-availability) excludes `runner` from `jobs.<job_id>.env` and permits it in `jobs.<job_id>.steps.env`.

The workflow remains manual-dispatch only, exact-revision and `main` bounded, `contents: read`, non-cancelling, pinned, and secret-minimal. The Cloudflare secrets remain available only to the deployment step. No action version, command, Worker name, generated path, deployment URL, capability record, application behavior, provider object, or cleanup boundary changed.

## Authorized external preflight

The user separately authorized a dedicated Cloudflare token restricted to `Workers Scripts: Edit` for the selected non-production account, expiring 2026-08-12, and replacement of the GitHub `compatibility` environment's `CLOUDFLARE_API_TOKEN`. The token `egeria-scaffold Calendly certification` was created and its one-time value was transferred directly to GitHub without printing or committing it. The temporary clipboard and browser-session value were cleared. GitHub reports the secret updated at `2026-08-10T23:30:00Z`.

Read-only preflight found `acme-portfolio-calendly` absent, confirmed the `bmarquiscom.workers.dev` account subdomain, and found available quota without an upgrade. The prior active tokens were broader and had no expiry; neither is the certification environment secret after this change. The workflow was not manually dispatched. Source rollback and credential recovery remain separate.

## Changed files

Repair commit `62c78c9` modifies:

- `.github/workflows/booking-calendly-certification.yml`
- `tests/constitution/constitution.test.mjs`
- `docs/superpowers/plans/2026-08-10-booking-calendly-certification.md`
- `docs/implementation-evidence/2026-08-10-booking-calendly-certification-preparation.md`

This review record adds:

- `docs/review-packets/2026-08-10-booking-calendly-workflow-validation-repair.md`

## Test-driven evidence and verification

The first focused contract change rejected `runner` in job-level environment expressions and required the certification root on the initially identified consuming steps. Against the pushed workflow, the focused test failed with the exact invalid job-level value. Moving the value into step scope restored GREEN.

The requirements and test-evidence reviewers then identified a fourth consumer: `Test deployed application behavior` invokes `$CERTIFICATION_ROOT/apps/web`. The strengthened contract failed because that step lacked `CERTIFICATION_ROOT`; adding the same step-level expression restored GREEN. No implementation preceded either failing contract.

Fresh final-tree commands used Node.js `22.23.2` through Volta:

- `node --test tests/constitution/constitution.test.mjs tests/constitution/semantic-naming.test.mjs`: passed 28/28.
- `node scripts/check-semantic-naming.mjs`: passed with no output.
- `node scripts/check-capability-certification.mjs`: admission passed for seven records.
- `node scripts/check-capability-certification.mjs --closure legacy-backfill-exempt`: rejected only `booking-calendly` as `pending`, the required stop behavior.
- `git diff --check`: passed.
- GitHub environment-secret metadata lookup: `CLOUDFLARE_API_TOKEN` updated at `2026-08-10T23:30:00Z`; no value was read.
- GitHub workflow-run lookup: only the two push-time definition failures existed; no `workflow_dispatch` run existed.

Static parsing and the official context table establish the corrected expression placement. They do not prove hosted-runner execution or deployment. GitHub will perform its own workflow-definition validation when an approved repair is pushed; dispatch remains separately prohibited.

## Reviewer dispositions

- **Requirements:** found that deployed application testing was the fourth `$CERTIFICATION_ROOT` consumer. The contract, workflow, plan, and preparation evidence now require all four. Recheck: no material improvements recommended.
- **Test evidence:** independently confirmed the same counterexample and GitHub context rule. The reviewer observed the causal RED, the minimal fourth-step repair, and final GREEN. Recheck: no material improvements recommended.
- **Architecture and anti-overengineering:** found a time-scope contradiction between the initial no-secret-change snapshot and the later authorized credential preflight. The evidence now distinguishes the initial snapshot from the later permission-metadata inspection and sole secret replacement. Recheck: no material improvements recommended.

No specialist reviewer was required because the repair changes no generated UI, accessibility behavior, package, dependency, application runtime, provider integration, persistent data, or production resource.

## Risks, deferred proof, and unsupported claims

- The repaired workflow has not yet been pushed, so GitHub has not validated this exact revision. Current official context availability and the parsed regression contract are the available pre-push evidence.
- The short-lived Cloudflare token expires on 2026-08-12. If the bounded journey is not completed before expiry, credential replacement requires separate authorization; do not broaden or extend it implicitly.
- `BOOKING_CALENDLY_CERTIFICATION_URL` remains unset. Workflow dispatch remains blocked until the dedicated URL variable is separately authorized and configured.
- Hosted-runner execution, Cloudflare deployment, deployed browser behavior, live Calendly rendering, one synthetic booking, provider confirmation, cancellation, Worker cleanup, and credential revocation remain unexecuted.
- `booking-calendly@0.1.0` remains `pending`. The repair does not certify the capability, close the stage, approve launch scope, establish post-trial provider availability, or support an accessibility-conformance or WCAG-conformance claim.

## Rollback and recovery

Source rollback is an ordinary Git revert of `62c78c9`, followed by the focused workflow contract, the full constitution and semantic-naming suite, capability admission, expected rejecting closure, and exact-diff review. Reverting source would restore the GitHub-invalid job-level expression and therefore is not a safe dispatch state.

Credential recovery is separate. Revoking the dedicated Cloudflare token and replacing or removing the GitHub environment secret each require explicit external authorization. The overwritten broad token must not be restored merely as source rollback. The dedicated token's expiry provides a bounded failure mode, but expiry is not evidence of GitHub secret cleanup.

No Worker, meeting, calendar record, event type, persistent store, paid plan, or production resource requires recovery because none was created or changed.

## Stop gate

Stop for explicit approval of the verified repository comparison including this review record. Approval does not authorize push, GitHub variable mutation, workflow dispatch, deployment, booking, cancellation, Worker cleanup, token revocation, capability certification, stage closure, or launch approval.
