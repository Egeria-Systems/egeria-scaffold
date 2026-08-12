# Pending Changeset selection repair review packet

Date: 2026-08-12

Status: REVIEW CANDIDATE — local deterministic repair independently verified with a recorded controller exception; final new-branch review and hosted CI pending

## Comparison and changed files

The accepted source base is remote `main@12ecc73a8337ab12ece9dd3a6b2aec03f940383c`, the squash integration of MR #2. The final handoff comparison is freshly fetched `origin/main...HEAD` on `release-changeset-selection`; its exact head is identified after the self-referential packet is committed.

The approved repair scope is exactly:

```text
docs/implementation-evidence/2026-08-12-pending-changeset-selection-repair.md
docs/review-packets/2026-08-12-pending-changeset-selection-repair.md
docs/superpowers/plans/2026-08-11-generated-testing-ci-repairs.md
scripts/check-package-release.mjs
tests/package-boundaries/release-safeguards.test.mjs
```

No historical MR #2 review packet or implementation-evidence record is rewritten. No package, workflow, Changeset, manifest, generated project, fixture, state, provider, deployment, credential, persistent-data, publication, or production surface changes.

## Finding and disposition

| Review stage | Disposition |
| --- | --- |
| Independent candidate review | One material coverage gap: the ambient two-record fixture could not causally protect complete selection or ordering |
| Independent validator | Confirmed `F001` at medium severity and high confidence; current production remained correct and current records remained fail-closed |
| Independent repair-direction auditor | Selected a pure repository-internal selector consumed by the existing loader; rejected duplicated test logic, filesystem injection, and wider release restructuring |
| Gate A | `F001` approved; receipt `117734ffc15d687b0a5353360fe0c0cff92f2a85b383d81ba87b1a55d4efd3e1` |
| Gate B | Exact plan `618cd0333f9de31eb83dae1d89c009b18f78d4829a09c15c3dfe8d67fa9f390b` approved; receipt `247220706337e96833994e34c112a3a7c16425834c5a36dc513c57f83220f5ab` |
| Independent post-fix verifier | Confirmed `F001` resolved and no code or release-path regression; identified one low-severity evidence-cutoff contradiction, corrected within the approved evidence path |

## Implementation

- Extract `selectPendingChangesets(fileNames)` in the existing private release-validator script.
- Keep `loadPendingChangesets()` as the sole filesystem loader and make it consume the pure selector.
- Add one controlled unordered-input test containing `README.md`, a non-Markdown entry, both current records, and `arbitrary-future.md`.
- Retain the live exact two-file inventory and byte assertions.
- Correct the prior plan's overstatement that the ambient fixture independently protected ordering and loader-hidden future entries.

Both local and registry validation still consume the same loader. The existing downstream test still requires any nonempty pending Changeset list to fail with `PENDING_CHANGESET`.

## Commands and results

All successful `pnpm` results used Volta's repository-pinned Node `22.23.2` and pnpm `11.20.0`.

| Command | Result |
| --- | --- |
| focused selector test before production export | Expected RED: missing named export |
| focused selector test after production export | PASS; 1/1 |
| `pnpm run test:package-boundaries` | PASS; 46/46 |
| `pnpm run test:constitution` | PASS; 52/52 |
| `pnpm exec eslint scripts/check-package-release.mjs tests/package-boundaries/release-safeguards.test.mjs --max-warnings 0` | PASS; no warnings |
| `pnpm run check:semantic-naming` | PASS |
| `git diff --check` | PASS |

The material-review controller retains the focused RED/GREEN and global logs. Its bounded second attempt could not rerun the focused test because its per-attempt counter reused an existing attempt-independent `run-1` checkpoint path. No controller artifact was deleted or rewritten. After the evidence-only correction, direct reruns passed the focused selector 1/1, constitution 52/52, semantic naming, and `git diff --check`. The user explicitly authorized continuing with that infrastructure exception after reviewing it.

## Risks and deferred work

- The selector test protects filename transformation semantics, not filesystem read failures or entry types; those were outside `F001` and the CLI catch remains unchanged.
- Current repository intent remains protected separately by the live inventory and exact-byte assertions.
- The follow-up adds a repository-internal export from a private script, not a supported public package API.
- Hosted CI, exact final branch comparison, eligible approval, resolved threads, and repository rules remain merge gates after push.
- Registry publication, provider behavior, deployment, production, performance, visual review, human accessibility evaluation, and WCAG conformance remain unproven or outside scope.
- Existing pending capability certifications remain separate and are not advanced by this repair.

## Rollback and recovery

Before integration, separately authorized withdrawal closes or leaves unmerged the new follow-up MR and retains its branch and evidence; it changes no accepted `main` history. Separately authorized source recovery may revert only the focused follow-up commit in an isolated clean worktree, preserving staged, unstaged, untracked, and unrelated committed user work. After squash integration, separately authorized recovery reverts only the resulting integration commit and reruns the affected deterministic checks.

Never clean, reset, discard, overwrite, or partially revert unrelated work. No persistent-data, provider, deployment, credential, publication, or production recovery applies.

## Handoff gate

Create one focused commit, replay only that commit onto `release-changeset-selection` from current `origin/main`, rerun the approved checks, obtain one bounded independent exact-diff review, and push the clean branch. Preserve the incomplete controller run and explicit continuation authorization as evidence; do not represent it as `COMPLETE`. MR creation is a separate explicit action.
