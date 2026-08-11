# Package release fresh-checkout remediation review

- Date: 2026-08-11
- Status: ready for the authorized fast-forward push; publication not rerun
- Comparison: `8b09d1b00004cafe0bd63405b956dd7122e2cbec..HEAD`
- Reviewed implementation commit: `78a308a4097d64ce8d071f302b2e16c03ffde747`
- Evidence: [fresh-checkout remediation evidence](../implementation-evidence/2026-08-11-package-release-fresh-checkout-remediation.md)

## Review result

The release failure is repaired at its canonical owner. Both public-package verification aggregates now emit builder workspace declarations before typed lint. The change is two command-order substitutions plus a focused regression assertion; it does not alter any underlying build, lint, test, typecheck, registry, authentication, provenance, or publication command.

The fix passed in a second fresh clone with no pre-existing `dist` output. All three independent reviews returned no material findings.

## Incident boundary

GitHub Actions run `31457236804`, job `93673502739`, failed on commit `8b09d1b` during `Verify release candidate`. The job stopped before its final registry check and before Changesets publication. The live registry check after the incident confirms that both `0.2.0` targets remain absent and each package has only its expected `0.1.0` history.

## Changed files

- Added `docs/superpowers/plans/2026-08-11-package-release-fresh-checkout-remediation.md`.
- Modified `package.json`.
- Modified `tests/package-boundaries/release-safeguards.test.mjs`.
- Added `docs/implementation-evidence/2026-08-11-package-release-fresh-checkout-remediation.md`.
- Added `docs/review-packets/2026-08-11-package-release-fresh-checkout-remediation.md`.

No other file changed. In particular, `.github/workflows/package-release.yml`, `pnpm-lock.yaml`, package manifests, package source, versions, changelogs, Changesets, and generated repositories are unchanged.

## Commits

- `9dc33e7` — `Plan fresh-checkout release remediation`
- `78a308a` — `Build workspace types before package lint`
- The final evidence commit is identified in the handoff after this packet is committed.

## Causal test evidence

- GitHub fresh-runner failure: 90 typed-lint diagnostics caused by unresolved builder-core types.
- Fresh clone of failed SHA: same 90 diagnostics.
- Single-variable hypothesis test: building only builder-core made unchanged lint pass.
- Focused RED: 0/1 passed against lint-before-build order, with the expected ordering assertion.
- Focused GREEN: 1/1 passed after the order change.
- Complete release-safeguard file: 8/8 passed.
- Exact repaired-commit fresh clone: complete release-candidate aggregate passed with no `dist` output present before execution.

## Verification summary

- Constitution: 29/29 passed.
- Package boundaries: 45/45 passed.
- Builder builds: passed.
- Builder lint and copy externalization: passed.
- Standards: 33/33 passed.
- Observability: 23/23 passed.
- Builder typecheck and local release check: passed.
- Peer dependencies: no issues.
- Full and production moderate audits: no known vulnerabilities.
- Registry signatures: 885 verified.
- Live registry: exact `0.1.0` histories and absent `0.2.0` targets.

Final documentation-link, semantic-naming, diff, worktree, and remote-identity checks are recorded in the handoff after the evidence commit.

## Reviewer dispositions

- Requirements: no material findings; scope and all release/authorization safeguards remain intact.
- Architecture and anti-overengineering: no material findings; the root verification scripts own the ordering and no workaround or speculative hook framework is justified.
- Test evidence: no material findings; the causal chain and exact fresh-clone aggregate sufficiently protect and prove the repair.

## Why prior validation passed

The earlier validation command was run, but its ordering made the result dependent on ignored build artifacts. The local worktree was Git-clean while still containing `dist` output from prior builds. GitHub used a fresh runner without those outputs. The repaired command creates its required declarations before typed lint, so warm and fresh worktrees follow the same sequence.

## Pre-commit hook disposition

No pre-commit hook is added. The old aggregate would have passed under the same warm local state even if a hook had invoked it. The authoritative prevention is a self-preparing verification command plus fresh-runner CI. An automatic pull-request/push verification workflow can be planned separately; an optional pre-push hook may improve feedback but must not become publication evidence.

## Push and recovery

The user explicitly authorized a new SHA on `main`. Because local `main` has unrelated untracked user files, it must remain untouched. Push the clean remediation-worktree `HEAD` directly and non-forcibly to `origin/main`, then verify the remote full SHA. Do not dispatch or rerun package publication as part of this repair.

If the push is rejected, stop without force. Before publication, any further defect requires a new reviewed forward commit and SHA; npm rollback remains unnecessary because nothing was published.
