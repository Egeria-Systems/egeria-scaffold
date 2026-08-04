# ADR-0007: Transactional Repository Migrations

**Status:** Accepted

**Date:** 2026-08-04

## Context

Builder transformations may touch customized source, dependencies, generated state, deployed configuration, external providers, and persistent data. Re-executing a transformation on the user's primary working tree or treating Git reversal as complete recovery would create avoidable loss and false assurance.

## Decision

Repository-changing builder commands require a clean and stable Git state:

- no staged changes or tracked modifications;
- no relevant untracked files;
- no merge, rebase, revert, or cherry-pick in progress;
- no unresolved conflict.

The builder never stashes, commits, discards, restores, or force-bypasses work automatically. A named recovery stash may be offered only after explicit authorization.

The modifying lifecycle is:

1. validate command, target, compatibility, and authority;
2. verify clean Git state;
3. infer repository state and compare it with desired and installed state;
4. classify drift and resolve the capability graph plus migration preconditions;
5. create a dedicated branch and isolated worktree;
6. produce a dry-run plan and proposed diff;
7. obtain implementation-plan approval;
8. execute the transformation exactly once in the isolated worktree;
9. install dependencies when approved and run proportional verification;
10. re-infer the result;
11. update `.egeria` state and migration records after transformation verification and post-change inference succeed;
12. rerun state/inference verification;
13. prepare the exact verified final diff and review packet, including the state records;
14. obtain verified-final-diff approval;
15. commit the exact result, and create a pull request only when separately requested.

The transformation is never executed again against the primary working tree. Informational extension may continue only when non-interference is proven. Reconcilable drift stops for an explicit reconciliation plan. Partial, contradictory, or ambiguous evidence blocks the operation. There is no generic force bypass.

Recovery treats these as separate domains:

- source rollback;
- dependency rollback;
- deployment rollback;
- D1 and other persistent-data recovery;
- R2/media recovery;
- queue/provider cleanup;
- Stripe and other provider operational reversal.

Git rollback is never represented as persistent-data or provider rollback. This ordering resolves the source plan's inconsistent placement of the state update after final-diff approval: the approved diff must already contain the final verified state records.

## Consequences

- Plan approval and verified-final-diff approval remain distinct.
- The user's original working tree remains untouched by transformation execution.
- Migrations require explicit preconditions, verification, inference, and recovery.
- Stateful removals may require export, retention, cleanup, or operational reversal after source changes.
- Builder automation favors stopping with evidence over an unsafe force option.

## Enforcement

`INV-CLEAN-ISOLATED-MIGRATION` and `INV-STATE-UPDATE-ORDER` are planned for P3 temporary-repository integration tests, failure injection, recovery fixtures, and final-state inference assertions.
