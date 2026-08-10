# Capability-Certification Roadmap Review Packet

**Date:** 2026-08-10 (America/Toronto)

**Status:** Ready for verified-final-diff review; uncommitted

**Comparison:** local base `d029ff6` to the uncommitted working tree on `capability-certification-roadmap`

## Review outcome

The roadmap amendment makes certification an automatic, separate sibling task for every new or materially changed executable capability. It places the first concrete task immediately after the implemented Calendly capability, requires step-by-step human prerequisites during that task's own planning, defines a non-deadlocking staged backfill, invalidates stale certification after material changes, and protects the contract with dependency-free constitution assertions.

The implementation changes documentation and documentation-contract tests only. It does not implement or claim a working certification runner, provider integration test, deployed workflow, registry, or closure gate.

## Changed files

- `docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md` — normative task pair, staged introduction, certification-subject binding, and closure rules.
- `docs/roadmaps/program-roadmap.md` — Calendly Task 5B, P3 backfill/closure, and automatic future sibling-task sequence.
- `docs/governance/review-and-contribution.md` — per-certification-task current-source and step-by-step human-prerequisite planning contract.
- `docs/architecture/enforcement-map.md` — planned invariant and exact future automation ownership, without claiming implementation.
- `tests/constitution/constitution.test.mjs` — bounded cross-owner drift protection and atomic planning/transition assertions.
- `docs/superpowers/specs/2026-08-10-capability-certification-task-pair-design.md` — approved design record.
- `docs/superpowers/plans/2026-08-10-capability-certification-roadmap.md` — exact-file implementation plan and completed checklist.
- `docs/implementation-evidence/2026-08-10-capability-certification-roadmap-verification.md` — TDD, review, verification, and claim-limit evidence.
- `docs/review-packets/2026-08-10-capability-certification-roadmap.md` — this packet.

## Requirement-to-evidence map

| Requirement | Materialized evidence |
| --- | --- |
| Separate implementation and certification tasks | Normative source plan plus concise program-roadmap rule |
| Calendly first concrete certification | P2 Task 5B follows the implemented Calendly capability |
| Automatic future capability coverage | Every new or materially changed executable capability from P4 onward receives a sibling certification task |
| Human setup instructions during planning | Governance checklist requires account, tier, resource, role, credential, callback, synthetic-data, cost, retention, cleanup, recovery, owner, automation, and approval details, or an explicit no-setup statement |
| No implicit external authority | Source plan, governance, program roadmap, design, and constitution test keep every external action separately approved |
| Sequential but rejecting automation | Planned descriptor admission accepts a linked pending record; phase/release closure rejects unresolved ordinary pending records |
| Safe backfill transition | Pre-foundation records are `backfill-pending`, exempt only from P2 closure without certification, and rejected if still unresolved at P3 closure |
| Stale-certification prevention | Active coverage binds to descriptor version or behavior-contract digest; material change creates a new task-linked pending record |
| No unnecessary rerun | P3 may map unchanged valid evidence; material gaps receive separate tasks |
| Direct regression protection | One bounded constitution test checks all canonical owners and atomic obligations |

## Verification

| Command | Result |
| --- | --- |
| `rtk proxy env CI=true volta run --node 22.23.2 node --test tests/constitution/*.test.mjs` | pass; `23/23` |
| `rtk proxy env CI=true volta run --node 22.23.2 node scripts/check-semantic-naming.mjs` | pass |
| `rtk git diff --check` | pass |

The detailed TDD history and toolchain note are recorded in the [verification evidence](../implementation-evidence/2026-08-10-capability-certification-roadmap-verification.md).

## Independent-review dispositions

| Finding | Disposition |
| --- | --- |
| One closure gate conflicted with sequential implementation/certification | Repaired by splitting descriptor admission from phase/release closure |
| Test omitted atomic setup/security/cost/cleanup and local/external boundaries | Repaired with section-bounded assertions for every planning obligation |
| Design could be read as replacing the existing Calendly outcome | Repaired; it introduces no new provider outcome and preserves canonical outcomes |
| Grandfathered records could deadlock P2 closure | Repaired with a P2-only non-certifying exception and mandatory P3 rejection |
| A material change could retain stale certification | Repaired with descriptor-version/behavior-digest binding and task-linked pending replacement |

After both repair rounds, the same bounded independent reviewer reported: “No material improvements recommended.”

## Risks and deferred work

- The contract is protected as documentation, but the registry and rejecting gates remain planned and cannot reject a capability today.
- Exact provider steps, service tiers, APIs, costs, rate limits, and credentials may change; each certification task must refresh them from official sources during Gate 1.
- Local controlled-dependency tests cannot prove protected-staging deployment or provider-confirmed outcomes.
- Existing evidence may be reused only when its subject binding and causal assertions remain valid; registry presence is not proof.
- No Calendly provider behavior, real booking, hosted execution, production readiness, accessibility conformance, or cleanup result is established by this amendment.

## Rollback and recovery

No external state exists to clean up. Before integration, discard only this isolated worktree/branch if the amendment is rejected and only after confirming no wanted work remains. After a future commit, use a focused `git revert`; do not reset or rewrite shared history.

## Approval gate

The exact diff is ready for user review. Approval of this packet would authorize only the next explicitly requested repository integration action; it would not authorize commit, push, pull request, deployment, provider configuration, credential use, spending, or another external action.
