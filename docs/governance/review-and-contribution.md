# Review and Contribution Protocol

This document is the canonical owner of the implementation lifecycle. Root and nested instructions link here instead of maintaining competing copies.

## Gate 1: preparation evidence

Before implementation:

1. Freeze the approved increment, comparison, expected behavior, tests, and completion criteria.
2. Verify the current branch, status, local and relevant remote refs, recent commits, manifests, tests, architecture sources, `.egeria` schemas, accepted ADRs, applicable instructions, and prior review packets.
3. Revalidate current official documentation and security advisories for every tool or provider the increment will execute or configure.
4. Record dated pre-acceptance evidence under the Git-ignored private local `docs/implementation-evidence/` directory, distinguishing verified facts, assumptions, limitations, and deferred proof. A separately approved, content-safe final receipt may become a tracked registry input only through an exact path exception that leaves every other private artifact ignored.
5. Present direct contradictions and genuinely blocking uncertainties in one consolidated batch. Resolve ordinary details from official sources and accepted practice without expanding scope.

### Direct-predecessor gate

Every implementation or certification plan must name its direct predecessor, or `none` for the first item, and that predecessor's acceptance artifact. Before implementation, require the artifact to record explicit approval, verify its accepted revision is an ancestor of `HEAD`, and run every applicable machine admission or closure check.

A missing, pending, unapproved, non-ancestor, or ambiguous predecessor is a hard stop even when the user requests a later item. Never infer the next item by incrementing a task number; resolve it from the approved source plan and current program roadmap.

A bounded independent-work exception may change one plan's direct predecessor only when explicit human approval and a plan amendment record the accepted earlier predecessor and artifact, exact base and isolated worktree, non-overlapping scope, state that must remain unchanged, and later reconciliation boundary. The approved source plan and current program roadmap must record the same exception before implementation proceeds. An exception does not approve the independent stream, waive either stream's final-diff gate, or authorize merge, deployment, provider action, or external mutation.

Gate 1 evidence is not permission to edit implementation files or take external action.

## Gate 2: implementation-plan approval

Write an exact-file, test-driven plan under the Git-ignored private local `docs/superpowers/plans/` directory. It must define interfaces, RED/GREEN checks, focused commit boundaries, reviewers, final verification, review-packet contents, deferred work, and recovery.

Stop for explicit approval. Plan approval authorizes only the bounded local implementation and commits described by the approved plan. It does not authorize a different increment, push, pull request, merge, deployment, publication, provider mutation, production action, permission change, or external message.

## Capability-certification planning

Gate 1 for a capability-certification task must produce a step-by-step human-prerequisite runbook before Gate 2 planning or execution. The runbook derives current instructions from dated official provider and platform sources rather than copying a scenario from the program roadmap.

The runbook must state either that no human setup is required and why, or identify:

1. the required account owner, account type, subscription tier, sandbox or test environment, and any eligibility or waiting period;
2. every resource the user must create and the exact least-privilege permissions or roles it needs;
3. credential names, scopes, lifetime, rotation expectations, and approved storage location without recording values in source, plans, evidence, logs, prompts, or messages;
4. callback, webhook, redirect, domain, origin, or allowlist configuration;
5. synthetic identities and data, readiness preflight, bounded polling, rate limits, quotas, possible spend, and retention;
6. step-by-step cleanup, resource deletion, credential revocation or rotation, rollback, and recovery; and
7. the owner of every action, the automation boundary, and each explicit approval checkpoint.

Gate 2 then binds the current prerequisites to the smallest supported generated-project baseline, exact compiled-CLI operation, local controlled-dependency tests, any conditionally required protected-staging or provider journey, success and failure evidence, cleanup, evidence retention, and rerun triggers. Prefer short-lived or federated credentials when the provider supports them; otherwise use the narrowest scoped non-production credential in its approved secret store.

If the runbook concludes that no human setup is required, the plan records the evidence supporting that conclusion and proceeds only with the approved local scope. Account creation, service-tier changes, provider-resource configuration, credential creation or use, deployment, spending, messages, and external or persistent-state mutation remain separate external actions: implementation or plan approval never supplies that authority, and each external action remains separately authorized.

The [approved source plan](../roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md) owns which capability deliveries require a separate certification task. This protocol owns how each task prepares, plans, obtains approval, and separates local proof from external outcomes.

Manual stateless non-production journeys may use the repository's [shared test deployment](shared-test-deployment.md) only after its eligibility, protection, exclusive-lease, credential, cleanup, and recovery gates pass. That policy does not make the shared environment suitable for every future certification.

The tracked registry is [`certifications/capabilities.json`](../../certifications/capabilities.json); builder-core owns its strict schema and pure gate semantics. After building the private package, use these exact repository commands:

```sh
pnpm run check:capability-certification
pnpm run check:private-capability-certification
node scripts/check-capability-certification.mjs --closure legacy-backfill-exempt
node scripts/check-capability-certification.mjs --closure all-certified
pnpm run verify:booking-calendly-certification
```

Admission must pass for a builder candidate. The clean-checkout command validates the tracked registry, descriptor subjects, required evidence kinds, status transitions, and the selected closure policy. Private local plans and pre-acceptance receipts remain required workflow inputs but are not repository or CI inputs. A registry-cited final receipt may be tracked only after explicit acceptance and content-safe review; before updating the tracked registry, certification work must still run `check:private-capability-certification` in the workspace that holds the complete private artifact set. That explicit local gate validates artifact presence and receipt content through builder-core and verifies evidence-producing revisions against the checked Git ancestry. Passed evidence metadata must match its capability, descriptor subject, evidence-producing revision, and explicit outcome. Each receipt must declare completed status, no unresolved prompt fields, an affirmative overall reviewer decision, and affirmative review of the recorded outcome. Run the closure policy required by the named phase or release and treat its rejecting exit as a stop, not a warning. The local Calendly command and receipt declare only fresh-scaffold evidence; relabeling or incompletely reviewing them cannot prove protected-staging, provider, cancellation, cleanup, or recovery outcomes.

## Builder-repository development boundary

Development of this repository may proceed directly on `main` only when the approved work is one clean, sequential implementation stream, no user-owned work is at risk, repository protections permit it, and isolation has no material safety or coordination benefit.

A dedicated branch and isolated worktree are required when implementation becomes parallel or when isolation is materially useful for risk containment, experimentation, conflicting changes, or preservation of another active tree. Before either mode, verify the branch, status, comparison, and approval scope. Development workflow permission never authorizes push, pull-request creation, merge, deployment, publication, or another external action.

## Accepted-baseline reconciliation

When an approved push or local integration advances accepted `main` history from another branch or worktree, reconcile the primary local `main` before starting the next increment.

1. Refresh the relevant remote refs, record the source commit, local `main`, and `origin/main`, and prove their ancestry.
2. If the primary checkout is clean and the history is linear, fast-forward local `main` to the accepted commit without creating a merge commit.
3. If user-owned work prevents that fast-forward, preserve it without loss and record a blocking handoff with the exact paths and recovery reference. Do not begin the next increment until the user approves reconciliation.
4. Verify the reconciled checkout, record its clean status and exact HEAD, and disclose any intentional local/remote divergence.
5. A push from another worktree is not complete merely because `origin/main` advanced. The integration receipt must name the commit that owns the next implementation baseline.

## Generated-client transformation boundary

Repository-changing builder commands always require:

- no staged or tracked modifications;
- no relevant untracked files;
- no merge, rebase, revert, or cherry-pick in progress;
- no unresolved conflict;
- a dedicated branch and isolated worktree created from the approved base.

The builder never stashes, commits, discards, restores, or force-bypasses user work automatically.

For builder transformations, state is part of the exact diff under review. After the source transformation passes proportional verification and post-change inference, update `.egeria` state and migration records, rerun state/inference verification, and only then prepare the verified final diff and request Gate 3 approval. Nothing may mutate the approved diff before it is committed.

## Test-driven implementation

For each independently reviewable task:

1. Write a focused test or executable contract for the intended behavior.
2. Run it and confirm the expected RED state is caused by the missing behavior.
3. Implement the minimum change that satisfies the contract.
4. Run the focused check and confirm GREEN.
5. Refactor only when it reduces evidenced maintenance cost without broadening behavior.
6. Commit only the coherent task files with a clear, short message.

Configuration and documentation changes use dependency-free contract tests where practical. Static checks remain static evidence; they do not substitute for runtime, deployment, accessibility, security, translation, or human evaluation.

For generated visual changes, run `pnpm run verify:generated-visuals` only in the pinned Linux/Chromium boundary after the generated OpenNext output is prepared. CI comparison is flag-free. Baseline updates require a causal source change, human review of expected, actual, and diff images, and a second comparison without update mode; they are never an automatic repair for a failing check. Screenshot equality does not establish visual quality, human accessibility, deployed behavior, production readiness, or WCAG conformance.

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
5. Create a review packet under the Git-ignored private local `docs/review-packets/` directory with scope, comparison, changed files, reviewer dispositions, verification, risks, deferred work, and rollback/recovery.

Private workflow artifacts must not be force-added. A separately approved content-safe final receipt cited by the tracked registry may be tracked only through an explicit exact path exception; preparation, raw inspection, and review artifacts remain ignored. Keep secrets, personal information, exact home-directory paths, machine-specific tool paths, private URLs, and raw provider output out of tracked documentation. Preserve any private artifacts through a separately managed local backup when their loss would matter; Git no longer supplies recovery for them.

## Gate 3: verified-final-diff approval

Present the final packet and stop. Gate 3 approval accepts only the verified increment diff. It does not itself authorize push, pull-request creation, merge, publication, deployment, persistent-data migration, provider cleanup, permission change, or production action.

Pull-request creation requires a separate explicit request. Responding to GitHub review comments also requires an explicit request. Production deployment and persistent-data/provider changes always require their specified human gate and recovery plan; an agent or reviewer cannot self-approve them.
