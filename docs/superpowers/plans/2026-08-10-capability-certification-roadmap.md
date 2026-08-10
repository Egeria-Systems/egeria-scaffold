# Capability Certification Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this documentation-only plan task-by-task. Do not implement the future certification runner, create provider scenarios, or take external action.

**Goal:** Materialize the approved capability implementation/certification task-pair and human-prerequisite planning contract in the repository's canonical roadmap and governance owners.

**Architecture:** The full source plan owns the normative task-pair and certification requirements. The concise program roadmap owns sequencing, the review protocol owns per-task Gate 1 and Gate 2 requirements, and the enforcement map owns the planned automated coverage gate. A dependency-free constitution test prevents these owners from drifting.

**Tech Stack:** Markdown, Node.js built-in test runner, repository semantic-naming scanner.

## Global Constraints

- Preserve the active Calendly implementation and all unrelated user-owned work.
- Change only the approved documentation contract, its exact plan/design artifacts, and one direct dependency-free constitution test.
- Do not add provider-specific scenarios, accounts, credentials, workflows, runner code, capability metadata, schemas, packages, dependencies, fixtures, or generated output.
- Do not claim that planned registry, provider, staging, deployment, or runtime evidence exists.
- Do not stage, commit, push, open a pull request, deploy, or take external action without separate authorization.

---

### Task 1: Lock the capability-certification roadmap contract

**Files:**
- Create: `docs/superpowers/specs/2026-08-10-capability-certification-task-pair-design.md`
- Create: `docs/superpowers/plans/2026-08-10-capability-certification-roadmap.md`
- Create: `docs/implementation-evidence/2026-08-10-capability-certification-roadmap-verification.md`
- Create: `docs/review-packets/2026-08-10-capability-certification-roadmap.md`
- Modify: `tests/constitution/constitution.test.mjs`
- Modify: `docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md`
- Modify: `docs/roadmaps/program-roadmap.md`
- Modify: `docs/governance/review-and-contribution.md`
- Modify: `docs/architecture/enforcement-map.md`

**Interfaces:**
- Consumes: the existing capability-certification journey, three-gate review lifecycle, gradual phase sequence, and enforcement-map ownership.
- Produces: one normative task-pair contract, one capability-certification planning checklist, one explicit P2 Task 5B/P3 backfill/future pairing sequence, and one planned certification-coverage invariant.

- [x] **Step 1: Add a focused constitution contract**

Assert that the four canonical owners agree on the separate task pair, current-provider human-prerequisite instructions, P2 Task 5B and P3 lifecycle/backfill sequence, planned registry gate, and explicit non-authorization of external actions.

- [x] **Step 2: Run the focused test and confirm RED**

Run:

```bash
volta run --node 22.23.2 node --test tests/constitution/constitution.test.mjs
```

Expected: the new capability-certification documentation contract fails because the canonical text is absent.

- [x] **Step 3: Amend the four canonical owners**

Add the approved task-pair contract and human-prerequisite planning requirements without provider-specific scenarios. Mark the registry/runner as planned, retain separate local and protected-staging claims, and keep external actions explicitly approval-gated.

- [x] **Step 4: Run focused verification and confirm GREEN**

Run:

```bash
volta run --node 22.23.2 node --test tests/constitution/constitution.test.mjs
volta run --node 22.23.2 node scripts/check-semantic-naming.mjs
git diff --check
```

Expected: all constitution tests pass, semantic naming exits zero, and `git diff --check` reports no errors.

- [x] **Step 5: Inspect the bounded final diff and record evidence**

Confirm that only the nine named files changed, every canonical owner agrees, no provider scenario or runtime surface was added, and the active Calendly worktree remains untouched. Record the verification and independent-review dispositions, then stop without staging or committing.
