# Dependency Update CI Cost Review Packet

**Date:** 2026-08-13 (America/Toronto)

**Status:** Local implementation complete; awaiting verified-final-diff approval

**Base:** `7401d05b987e36e6d9fa547e78fcf9862fb51b80`

**Comparison:** base through the current uncommitted working tree

## Outcome

The weekly GitHub Actions Dependabot entry now has one explicit version-update group matching every action. The immutable action-reference policy remains unchanged: live root workflows must still name the expected action repository and use a full lowercase 40-character commit SHA.

The generated-project and compatibility-proof scope lists now treat only `.github/workflows/repository-quality.yml` as a deep workflow input. Changes limited to the four manual workflows do not activate either deep lane solely because they are workflow files. The repository-quality workflow still activates both lanes; missing, zero, malformed, unresolvable, unavailable, unsupported-event, and Git-diff-error cases still fail safe to both lanes. The stable `builder-and-packages` job remains unconditional and continues to run the workflow-policy contracts.

No job identity, trigger, dependency-review policy, action pin, permission, secret, environment, cache, deployment, publication, certification, provider, generated source, fixture, package, or runtime behavior changed.

## Changed files

Configuration and executable policy:

- `.github/dependabot.yml`
- `.github/workflows/repository-quality.yml`
- `tests/constitution/constitution.test.mjs`

Canonical current state:

- `docs/architecture/overview.md`
- `docs/architecture/enforcement-map.md`

Design, plan, evidence, and review:

- `docs/superpowers/specs/2026-08-13-dependency-update-ci-cost-design.md`
- `docs/superpowers/plans/2026-08-13-dependency-update-ci-cost.md`
- `docs/implementation-evidence/2026-08-13-dependency-update-ci-cost-preparation.md`
- `docs/review-packets/2026-08-13-dependency-update-ci-cost.md`

## TDD evidence

All focused runs used Node `22.23.2`.

1. Dependabot RED: the new focused contract failed because `actionUpdates[0].groups` was `undefined`.
2. Dependabot GREEN: after adding `action-updates`, the focused test passed 1/1.
3. Scope RED: the structural workflow contract failed on `.github/workflows/**` versus the exact repository-quality path, and the actual-shell scenario returned both lanes `true` for the manual-workflow-only change; both focused tests failed for the intended missing behavior.
4. Scope GREEN: after narrowing both path arrays, both focused tests passed 2/2, including the retained repository-quality and fail-safe scenarios.
5. Review repair RED: new negative cases for an `if` or `needs` on `builder-and-packages` exposed that the contract did not reject a conditioned policy lane; the focused test failed with the intended missing-exception message.
6. Review repair GREEN: exact absence assertions made the focused workflow-policy test pass 1/1 and reject both mutations.

## Verification

The dependency tree was recreated from the unchanged lockfile with the pinned toolchain after the existing modules tree was found to have been prepared by a different pnpm. The first sandboxed install could not resolve the npm registry; the approved network retry reused 719 cached packages, completed with no lockfile change, and installed under pnpm `11.20.0`.

| Command | Result |
| --- | --- |
| `/Users/CoveMB/.volta/tools/image/node/22.23.2/bin/node --test tests/constitution/*.test.mjs` | Passed, 56/56 before review repairs |
| `pnpm run check:semantic-naming` | Passed |
| `pnpm run verify:builder-packages:quality` | Passed: constitution, package boundaries, builder/package build and lint, public-package tests, and builder typecheck |
| `git diff --check` | Passed before independent review |

The final documentation-sensitive constitution, semantic-naming, and diff checks are recorded in the handoff after this packet settles.

## Independent review dispositions

- Requirements: `READY`; no material findings.
- Architecture and anti-overengineering: `READY`; no material findings.
- Test evidence, initial: `NOT READY` with two material findings. The contract did not explicitly protect the unconditional `builder-and-packages` countercontrol, and the overview described configured Dependabot batching as if a hosted grouped pull request had been observed.
- Controller disposition: both findings were material and kept. Mutation-resistant absence assertions now protect the unconditional job, and the overview now says Dependabot is configured to group matching updates.
- Test evidence, re-review: `READY`; both repairs are present and causal, with no remaining material finding.

## Claim limits and residual risk

Local YAML parsing proves the repository configuration shape, not that Dependabot has created or will create a particular grouped pull request. Synthetic Git history executes the actual classifier shell, but does not prove GitHub-hosted event payloads, job conditions, required-check settings, runner availability, or realized billing savings. No hosted workflow was dispatched.

Grouping action updates can make one failed update harder to isolate when several actions change together. The group is limited to the small GitHub Actions ecosystem; immutable pins, ordinary diff review, dependency review, the always-on policy lane, and hosted CI remain the review boundary. Major action updates are not excluded from the group because the approved recommendation intentionally matched every action version update.

No local check establishes deployment, publication, provider behavior, production safety, visual quality, human accessibility, assistive-technology compatibility, or WCAG conformance.

## Recovery

Before commit, use an approved focused patch to restore the base bytes. After any separately authorized commit, use a focused revert. Remove `action-updates` to restore per-action Dependabot pull requests. Restore `.github/workflows/**` in both deep path arrays to restore the prior conservative scope, then revert the matching contracts and current-state documentation. No external recovery applies because this work changed no external system.

## Stop gate

Stop for verified-final-diff approval. This packet does not authorize staging, commit, push, pull-request creation, workflow dispatch, merge, repository settings, deployment, publication, certification, provider mutation, production action, or external messaging.
