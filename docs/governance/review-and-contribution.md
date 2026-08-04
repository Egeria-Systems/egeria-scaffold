# Review and Contribution Protocol

This document is the canonical owner of the implementation lifecycle. Root and nested instructions link here instead of maintaining competing copies.

## Gate 1: preparation evidence

Before implementation:

1. Freeze the approved increment, comparison, expected behavior, tests, and completion criteria.
2. Verify the current branch, status, local and relevant remote refs, recent commits, manifests, tests, architecture sources, `.egeria` schemas, accepted ADRs, applicable instructions, and prior review packets.
3. Revalidate current official documentation and security advisories for every tool or provider the increment will execute or configure.
4. Record dated evidence under `docs/implementation-evidence/`, distinguishing verified facts, assumptions, limitations, and deferred proof.
5. Present direct contradictions and genuinely blocking uncertainties in one consolidated batch. Resolve ordinary details from official sources and accepted practice without expanding scope.

Gate 1 evidence is not permission to edit implementation files or take external action.

## Gate 2: implementation-plan approval

Write an exact-file, test-driven plan under `docs/superpowers/plans/`. It must define interfaces, RED/GREEN checks, focused commit boundaries, reviewers, final verification, review-packet contents, deferred work, and recovery.

Stop for explicit approval. Plan approval authorizes only the bounded local implementation and commits described by the approved plan. It does not authorize a different increment, push, pull request, merge, deployment, publication, provider mutation, production action, permission change, or external message.

## Clean execution boundary

Repository-changing builder commands require:

- no staged or tracked modifications;
- no relevant untracked files;
- no merge, rebase, revert, or cherry-pick in progress;
- no unresolved conflict;
- an isolated worktree created from the approved base.

The builder never stashes, commits, discards, restores, or force-bypasses user work automatically. P0.1 repository-constitution development on `main` is a one-time explicit bootstrap exception; it does not modify the permanent builder rule.

## Test-driven implementation

For each independently reviewable task:

1. Write a focused test or executable contract for the intended behavior.
2. Run it and confirm the expected RED state is caused by the missing behavior.
3. Implement the minimum change that satisfies the contract.
4. Run the focused check and confirm GREEN.
5. Refactor only when it reduces evidenced maintenance cost without broadening behavior.
6. Commit only the coherent task files with a clear, short message.

Configuration and documentation changes use dependency-free contract tests where practical. Static checks remain static evidence; they do not substitute for runtime, deployment, accessibility, security, translation, or human evaluation.

## Independent review

After the coherent increment, dispatch three non-overlapping read-only reviewers:

- **Requirements reviewer:** compare the final diff with the approved source, increment acceptance, exact-file plan, file boundary, and non-goals.
- **Architecture and anti-overengineering reviewer:** check architecture invariants, canonical ownership, internal consistency, premature implementation, generic abstractions, and churn whose benefit does not outweigh risk.
- **Test-evidence reviewer:** check RED/GREEN credibility, final-tree coverage, command relevance, assertion strength, and whether claims exceed evidence.

Provide reviewers a self-contained packet and exact comparison; do not rely on inherited conversation history. Prohibit edits, recursive delegation, GitHub comments, and external action. Add a specialist only when the changed scope raises a material question the required reviewers cannot responsibly resolve.

Reviewer output is evidence, not authority. The controller waits for all reports, verifies each finding against the current shared tree, reconciles duplicates or conflicts, and classifies findings as material-kept, invalid, duplicate, deferred-by-scope, or low-value churn. Repair only current, evidence-backed material findings and rerun affected checks.

## Final verification and packet

After all relevant inputs settle:

1. Run the full relevant deterministic suite once.
2. Inspect the final status, comparison diff, changed-file list, and commit range.
3. Confirm no unrelated or premature surface was created.
4. Record exact commands, versions, results, known limitations, and unproven properties.
5. Create a review packet under `docs/review-packets/` with scope, comparison, changed files, reviewer dispositions, verification, risks, deferred work, and rollback/recovery.

## Gate 3: verified-final-diff approval

Present the final packet and stop. Gate 3 approval accepts only the verified increment diff. It does not itself authorize push, pull-request creation, merge, publication, deployment, persistent-data migration, provider cleanup, permission change, or production action.

Pull-request creation requires a separate explicit request. Responding to GitHub review comments also requires an explicit request. Production deployment and persistent-data/provider changes always require their specified human gate and recovery plan; an agent or reviewer cannot self-approve them.
