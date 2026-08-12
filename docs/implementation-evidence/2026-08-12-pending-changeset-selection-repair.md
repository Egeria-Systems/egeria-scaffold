# Pending Changeset selection repair evidence

Date: 2026-08-12

Recorded command window: 2026-08-12T13:25:16Z–2026-08-12T13:30:26Z

Status: local repair verified with a recorded controller exception; final new-branch comparison, hosted CI, and integration remain pending

## Scope and provenance

MR #2 was squash-merged to `main` as `12ecc73a8337ab12ece9dd3a6b2aec03f940383c`. GitHub reported that commit as current remote `main` before this follow-up began, and current-main inspection confirmed the shared loader and ambient-only safeguard remained byte-for-byte present.

The material review froze `0ce8c0db3a14242aa287a530672e8742b00e521a..2342c82bc9efbc8275b396849148f03cbde8d261` with scope hash `571bb11b4875f7ed678f3c304ca6b758dbd394dfaa94f157c17a3cdbe7a276dc`. Its independent review retained one finding:

- `F001` — the live `.changeset` fixture contains only the two current qualifying records, already in lexical order, so it cannot causally distinguish complete sorted discovery from removal of sorting or a selector restricted to today's names.

The current production implementation was correct. The risk was conditional: today's two records still kept release validation fail-closed, but after they were consumed, a future sole Markdown record omitted by a regression could be hidden from both local and registry validation.

Gate A approved only `F001` under receipt `117734ffc15d687b0a5353360fe0c0cff92f2a85b383d81ba87b1a55d4efd3e1`. Gate B approved exact plan `618cd0333f9de31eb83dae1d89c009b18f78d4829a09c15c3dfe8d67fa9f390b` under receipt `247220706337e96833994e34c112a3a7c16425834c5a36dc513c57f83220f5ab`.

## Transformation

The repair keeps `scripts/check-package-release.mjs` as the sole production owner:

- `selectPendingChangesets(fileNames)` is a pure repository-internal transformation that excludes `README.md`, excludes non-Markdown entries, includes every other `.md` name, and sorts the result.
- `loadPendingChangesets()` remains the only filesystem loader and passes `readdir` output to that selector.
- Local and registry modes continue to consume `loadPendingChangesets()` unchanged.
- The existing live two-file inventory and exact `Buffer.from("---\n---\n")` assertions remain independent repository-intent evidence.

No package export, package version, Changeset, workflow, release decision, publication command, provider, deployment, credential, persistent data, or production state changed.

## Causal RED and GREEN

The pinned runtime was Node `22.23.2` with pnpm `11.20.0`.

| Boundary | Command | Result |
| --- | --- | --- |
| Focused RED | `node --test --test-name-pattern='pending Changeset discovery selects every Markdown record in deterministic order' tests/package-boundaries/release-safeguards.test.mjs` | Expected failure: `SyntaxError` because `check-package-release.mjs` did not export `selectPendingChangesets` |
| Focused GREEN | same command after the production extraction | PASS; 1/1 |
| Package boundaries | `pnpm run test:package-boundaries` | PASS; 46/46 |
| Constitution | `pnpm run test:constitution` | PASS; 52/52 |
| Focused lint | `pnpm exec eslint scripts/check-package-release.mjs tests/package-boundaries/release-safeguards.test.mjs --max-warnings 0` | PASS; no warnings |
| Semantic naming | `pnpm run check:semantic-naming` | PASS |
| Diff hygiene | `git diff --check` | PASS |

The controlled assertion supplies deliberately unordered `generated-testing-boundary.md`, `README.md`, `notes.txt`, `arbitrary-future.md`, and `clarify-observability-boundary.md`. It requires exactly:

```text
arbitrary-future.md
clarify-observability-boundary.md
generated-testing-boundary.md
```

Removing sorting, including `README.md` or `notes.txt`, or omitting the arbitrary future record now fails this exact assertion.

An initial ambient `pnpm` attempt was rejected before test execution because the desktop fallback exposed Node `24.14.0` and pnpm `11.16.0`. No source diagnosis or test conclusion was drawn from those non-runs. Re-execution through Volta's repository-pinned Node `22.23.2` and pnpm `11.20.0` produced the results above.

## Review and integration boundary

The independent post-fix verifier confirmed `F001` resolved and found no code, test, loader, local-validation, registry-validation, or direct-execution regression. It found one low-severity evidence defect: the former cutoff predated global logs reported by the same record. The header now binds those reported results to their exact `13:25:16Z–13:30:26Z` command window.

The material-review controller could not execute the required focused test in bounded repair attempt 2 because it reset the test counter to `run-1` while reusing the attempt-independent checkpoint path already retained by attempt 1. No review artifact was deleted, renamed, overwritten, or rewritten to bypass that collision. Direct reruns after the one-line evidence correction passed the focused selector test 1/1, constitution 52/52, semantic naming, and `git diff --check`. At `2026-08-12T13:47:35Z`, the user explicitly authorized retaining this infrastructure exception and continuing with the independently verified repair.

One focused repair commit may therefore be transferred onto a new `release-changeset-selection` branch created from freshly fetched `origin/main`, with the complete deterministic checks and exact `main...HEAD` review repeated before the clean branch is pushed. The controller run remains preserved as incomplete infrastructure evidence rather than being represented as `COMPLETE`.

This evidence does not establish the final branch SHA, hosted GitHub Actions execution, merge-request approval, repository-rule satisfaction, publication, registry state, deployment, provider behavior, production safety, performance, visual quality, human accessibility, or WCAG conformance. Those claims remain pending or outside this repair.

## Recovery

During the guarded repair layer, recovery was limited to the five Gate-B-approved paths and stopped on unrelated drift. Before integration, withdrawing the follow-up retains its branch and evidence and changes no accepted `main` history. Any commit revert, branch deletion, or post-integration source recovery requires separate explicit authorization and must preserve staged, unstaged, untracked, and unrelated committed user work. No persistent-data, provider, deployment, credential, publication, or production rollback applies.
