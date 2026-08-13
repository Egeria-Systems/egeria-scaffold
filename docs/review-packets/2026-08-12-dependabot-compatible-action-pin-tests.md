# Dependabot-Compatible Action Pin Tests Review Packet

- **Date:** 2026-08-12
- **Gate:** accepted and integrated
- **Historical planned comparison:** `12ecc73a8337ab12ece9dd3a6b2aec03f940383c` to the verified uncommitted working tree
- **Accepted comparison:** `2b0624c3448d569d68bad93edd8821c48fb432cb..4e7e68a5b5d8232137b6d4e0f7b7b03896f6ac7e`

## Outcome

Live root workflow policy tests now require the exact expected action repository followed by an immutable full 40-character lowercase hexadecimal commit SHA. They no longer encode one release-specific SHA, so a Dependabot full-SHA update does not fail merely because the release changed.

Dependabot configuration, live workflows, generated templates, retained fixtures, packages, runtime code, provider configuration, and deployment behavior are unchanged. Generated-output tests retain their exact SHA assertions.

## Post-integration acceptance

On 2026-08-12, explicit human authorization to continue the approved automatic-CI Plan A accepted this packet's exact predecessor revision `4e7e68a5b5d8232137b6d4e0f7b7b03896f6ac7e`. The revision is a direct, linear commit on top of accepted `2b0624c3448d569d68bad93edd8821c48fb432cb`; it is not represented as a pull-request merge or eligible GitHub review.

GitHub reports the commit's SSH signature as verified with reason `valid`. The commit was accepted on `main` while the two active repository rulesets applied required signatures and pull requests and exposed explicit always-bypass paths for organization administrators and repository role `5`. The commit has no associated pull request, so its acceptance is the configured direct-integration path rather than evidence that the pull-request review rule ran. No GitHub setting was changed during this verification.

Local `main`, `origin/main`, and the Plan A baseline all resolve to `4e7e68a5b5d8232137b6d4e0f7b7b03896f6ac7e`, and that revision is an ancestor of the Plan A candidate. Hosted push run `31605329575` completed the `Repository quality / builder-and-packages` job successfully for the exact revision. The path-scoped generated-project and compatibility-proof workflows did not run because this predecessor changed only their policy-test consumers; their latest exact Task 6C merge evidence remains the successful pull-request runs recorded by the generated-testing packet.

## Changed files

- `tests/helpers/github-actions.mjs`: pure action-reference predicate;
- `tests/constitution/github-actions.test.mjs`: the single new focused contract test;
- `tests/constitution/constitution.test.mjs`: shared predicate use for root quality, compatibility, Calendly, and observability live workflows;
- `tests/package-boundaries/package-release.test.mjs`: shared predicate use for the package-release live workflow;
- `docs/superpowers/plans/2026-08-12-dependabot-compatible-action-pin-tests.md`: exact reviewed implementation plan and execution checklist;
- `docs/implementation-evidence/2026-08-12-dependabot-compatible-action-pin-tests-preparation.md`: preparation, TDD, verification, and reviewer evidence; and
- `docs/review-packets/2026-08-12-dependabot-compatible-action-pin-tests.md`: this packet.

No other tracked or untracked source file is part of the comparison.

## Requirements and security disposition

- Dependabot remains enabled.
- Action owner/repository identity remains exact at every changed assertion.
- Tags, branches, short SHAs, uppercase SHA text, non-hex revisions, different repositories, and non-string values are rejected.
- Exactly one focused test was added.
- Existing trigger, permission, concurrency, runner, timeout, ref, `persist-credentials`, runtime, cache, secret-isolation, artifact-retention, deployment-order, and revision-binding assertions remain.
- No workflow or generated artifact was edited.

## Verification

| Command or check | Result |
| --- | --- |
| helper contract RED | 0/1; expected `false !== true` on first valid reference |
| helper contract GREEN | 1/1 passed |
| `node --test tests/constitution/*.test.mjs` | 53/53 passed |
| pinned-path `node --test tests/package-boundaries/*.test.mjs` | 45/45 passed |
| `node scripts/check-semantic-naming.mjs` | exit 0 |
| current action-SHA scan in modified policy tests | no matches |
| `git diff --check` | exit 0 |
| pinned `pnpm run verify:builder-packages:quality` | exit 0 |

The full aggregate used Node `22.23.2` and pnpm `11.20.0` and covered constitution 53/53, package boundaries 45/45, builds, lint, standards 33/33, observability 23/23, and typechecks. The frozen install changed no manifest, workspace, or lockfile input.

## Independent reviews

| Review | Disposition |
| --- | --- |
| plan review | initial procedural findings incorporated; amended plan reported ready with no material improvements |
| requirements | no material improvements; PASS |
| architecture, security, and anti-overengineering | no material improvements; READY |
| test evidence | no material improvements; READY |

No reviewer finding required an implementation repair.

## Risks and evidence limits

The predicate proves only the local reference shape and expected repository string. It does not verify that a SHA exists upstream, belongs to the upstream repository, corresponds to a reviewed release, remains compatible with these workflows, or succeeds on hosted GitHub Actions. Those remain human review and hosted-CI responsibilities for each Dependabot pull request.

This local work does not establish that PR #3 is green. The PR must later contain this repair through an authorized integration and be rebased or rerun through separately authorized GitHub actions.

## Recovery and deferred actions

Recovery is source-only: revert the seven bounded files and rerun the owning checks. No dependency manifest, lockfile, workflow, credential, provider resource, deployment, persistent data, permission, or production recovery applies.

Commit, push, pull-request changes, PR #3 rebase or rerun, merge, workflow dispatch, deployment, publication, and external messages remain unperformed and unauthorized. Stop at this packet for explicit verified-final-diff approval.
