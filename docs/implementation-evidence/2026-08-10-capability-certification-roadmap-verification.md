# Capability-Certification Roadmap Verification Evidence

**Verification date:** 2026-08-10 (America/Toronto)

**Status:** Documentation amendment and independent review complete; verified-final-diff approval pending

**Comparison:** local base `d029ff6` to the uncommitted working tree on `capability-certification-roadmap`

## Result

The canonical roadmap now requires every new or materially changed executable capability to be delivered through an implementation task followed by a separately planned and approved certification task. Implementation approval does not establish certification, and the certification task does not inherit provider, deployment, credential, spending, persistent-state, or other external-action authority.

P2 Task 5B is the first concrete sibling task. It follows the implemented Calendly capability and owns both `booking-calendly` certification and the smallest reusable fresh-scaffold certification foundation justified by that capability. This amendment preserves the existing provider-outcome boundary; Task 5B Gate 1 and Gate 2 planning must derive current account, credential, staging, synthetic-data, cost, cleanup, recovery, and executable-scenario instructions from current official sources before any execution.

The planned registry and gates are transition-safe:

- descriptor admission requires a task-linked pending record;
- active certification is bound to the descriptor version or behavior-contract digest, so a material change replaces stale active coverage with a new task-linked pending record while retaining history;
- accepted pre-foundation descriptors receive `backfill-pending` records that are exempt only from P2 closure and are not certified by that exception; and
- P3 closure rejects every unreconciled `backfill-pending` record.

From P4 onward, each new or materially changed executable capability automatically receives its separate certification sibling task. P3 performs the one-time existing-capability backfill, reusing unchanged valid evidence without repeating an expensive check and creating separate certification tasks for material gaps.

## Current-source preparation basis

Current official documentation consulted while preparing this roadmap amendment:

- [Playwright best practices](https://playwright.dev/docs/best-practices) for user-visible behavior and controlled third-party dependency boundaries;
- [GitHub Actions deployment environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments) for protected environments and approval boundaries; and
- [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use) for least-privilege credentials and untrusted-input handling.

These sources inform the durable planning checklist only. Provider-specific instructions remain deliberately deferred to each capability-certification task so they can be refreshed when that task begins.

## TDD and review evidence

The focused constitution contract was added before the canonical prose. Its initial RED run failed because the capability task-pair heading was absent. Subsequent reviewer-driven RED runs failed first for the missing two-stage admission/closure contract and then for the missing certification-subject binding, proving that the new assertions detected the identified gaps.

The bounded independent review found and closed five material issues across two repair rounds:

1. split descriptor admission from phase/release closure so sequential implementation and certification remain possible;
2. protect the complete account, credentials, callbacks, synthetic data, rate/quota/cost, retention, cleanup, ownership, authorization, and local-versus-external planning obligations;
3. preserve existing canonical provider outcomes instead of claiming this amendment defines a new scenario;
4. exempt grandfathered `backfill-pending` records only from P2 closure and require their reconciliation by P3 closure; and
5. bind active certification to a version or behavior digest so a material change cannot retain stale certification.

The final bounded recheck reported: “No material improvements recommended.”

## Final verification

| Exact command | Result | Evidence boundary |
| --- | --- | --- |
| `rtk proxy env CI=true volta run --node 22.23.2 node --test tests/constitution/*.test.mjs` | exit `0`; `23/23` | Canonical ownership, local-link integrity, atomic certification-planning obligations, transition rules, and semantic-naming adapter |
| `rtk proxy env CI=true volta run --node 22.23.2 node scripts/check-semantic-naming.mjs` | exit `0`; no output | Current tracked and non-ignored untracked authored surfaces satisfy semantic naming |
| `rtk git diff --check` | exit `0`; no output | No whitespace errors in the bounded working-tree diff |

The final commands intentionally invoke the dependency-free Node test and naming scripts directly. A package-script retry first selected an incompatible fallback runtime; the exact pinned pnpm retry then attempted to install the isolated worktree's missing dependencies and encountered sandboxed registry DNS failures. Neither failure exercised the documentation contract. Direct execution used the repository-pinned Node `22.23.2` and completed without requiring dependencies or network access.

## Claim limits and external-action boundary

This amendment creates policy, sequencing, planning requirements, and a constitution guard only. It does not implement the planned coverage registry, admission/closure gates, certification runner, fresh-scaffold journey, compiled-CLI lifecycle journey, protected-staging workflow, or provider scenario.

No account was created, no credential was requested or stored, no provider resource was configured, no synthetic booking was made, no deployment occurred, no money was spent, and no external or persistent state was mutated. The active Calendly implementation worktree was not changed.

## Recovery

The amendment is uncommitted and isolated. Before integration, recovery is deletion of this dedicated worktree/branch only after preserving any wanted changes. After any future commit, source recovery should use a focused `git revert`; it would not clean provider state because this amendment created none.
