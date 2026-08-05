# P1 Pre-Task2 Schema Contract Clarifications Plan

> **For agentic workers:** Implement this plan as one bounded TDD increment only after explicit approval. Do not include any other deferred schema question.

**Goal:** Reconcile the capability-version contract before Task 2 and prevent unsupported P1 capability settings before `.egeria/project.yaml` consumers and fixtures exist.

**Architecture:** Runtime Zod schemas remain canonical inside private builder-core. The capability descriptor owns a capability release `version`; its schema-format version remains the `1.0.0` schema identifier. Desired project state retains `capabilitySettings`, but P1 accepts only an empty map because no executable P1 capability exposes settings. Checked Draft 2020-12 artifacts are regenerated from those runtime owners.

**Frozen base:** clean local `main` at `e18d23b6b5419e32bf01b66a8ca8b6aacfb2087a`; re-freeze and amend this plan if the branch, working tree, canonical contracts, or Task 1 code changes before implementation.

## Scope and non-goals

This increment changes exactly two behaviors:

1. a valid capability descriptor requires `version` and rejects the obsolete `schemaVersion` key; and
2. a valid P1 project configuration accepts `capabilitySettings: {}` and rejects every populated settings map.

Do not remove migration `outcome` or verification `kind`; define threat-review levels; restructure surface target/merge schemas; change ejection identity; broaden JSON Schema parity policy; implement Task 2; or add a capability setting.

No dependency, lockfile, package API path, CLI, provider, generated client repository, `.egeria` file, migration, deployment, publication, push, or pull request is in scope.

## Exact files

- Modify: `packages/builder-core/tests/contracts.test.mjs`
- Modify: `tests/constitution/constitution.test.mjs`
- Modify: `packages/builder-core/src/contracts/capability.ts`
- Modify: `packages/builder-core/src/contracts/project.ts`
- Regenerate from runtime owner: `packages/builder-core/schemas/capability.schema.json`
- Regenerate from runtime owner: `packages/builder-core/schemas/project.schema.json`
- Modify: `docs/architecture/capability-model.md`
- Modify: `docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md`
- Modify: `docs/superpowers/plans/2026-08-05-p1-builder-kernel.md`
- Modify: `docs/implementation-evidence/2026-08-05-p1-schema-contract-review-deferral.md`
- Modify: `docs/implementation-evidence/2026-08-05-p1-pre-task2-schema-contract-decision.md`

## TDD sequence

- [ ] **Step 1: Re-freeze and write focused failing tests**

Verify branch, status, HEAD, and the exact files above. In `contracts.test.mjs`:

- replace the valid capability fixture's `schemaVersion: "0.1.0"` with `version: "0.1.0"`;
- assert a descriptor using only `schemaVersion` is rejected;
- change valid project settings to `{}`; and
- assert a populated map such as `{ standards: {} }` is rejected.

In the existing constitution capability-contract test, assert that the canonical `CapabilityDescriptor` example contains `version: string` and does not contain `schemaVersion`.

- [ ] **Step 2: Run RED and record the causal failures**

```bash
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run build
rtk node --test packages/builder-core/tests/contracts.test.mjs tests/constitution/constitution.test.mjs
```

Expected RED: the runtime capability schema still requires `schemaVersion`, the project schema still accepts populated settings, and the canonical capability model still documents `schemaVersion`. The failure must exercise those exact assertions rather than a loader, dependency, or unrelated documentation error.

- [ ] **Step 3: Implement the minimum runtime contracts**

In `capability.ts`, rename only the descriptor property `schemaVersion` to `version`; do not rename profile, project, state, or migration schema-format fields.

In `project.ts`, replace the arbitrary nested settings record with an empty P1 map schema using `z.record(stableIdentifierSchema, z.never()).readonly()`. Keep the `capabilitySettings` top-level property required.

Do not add compatibility aliases, transforms, fallbacks, optional legacy keys, a second descriptor version field, or a generic capability-settings registry. No generated repository or persisted external P1 state exists, so there is no compatibility bridge to preserve.

- [ ] **Step 4: Reconcile canonical documentation in the same change**

- Change the canonical capability descriptor example to `version: string` and explain that this is the capability release version; the descriptor schema-format version is owned by the schema identifier.
- Change the approved source plan's capability metadata list from `schema version` to `capability version`.
- Update the main P1 plan's Task 1 project interface to `Readonly<Record<string, never>>` and record the Task 1A disposition without changing the other deferred questions.
- Update both dated evidence records with the exact RED/GREEN results and final source comparison; do not claim Task 2 behavior.

- [ ] **Step 5: Regenerate artifacts and run focused GREEN**

```bash
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run build
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run schema:generate
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run schema:check
rtk node --test packages/builder-core/tests/contracts.test.mjs tests/constitution/constitution.test.mjs
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run typecheck
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run lint
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:package-boundaries
rtk git diff --check
```

Expected GREEN: runtime and generated contracts require `version`, reject `schemaVersion`, accept only empty P1 capability settings, canonical documentation uses the same terminology, and package boundaries remain unchanged.

- [ ] **Step 6: Dispatch the required independent read-only reviewers**

Freeze the implementation comparison and provide the approved plan, decision evidence, changed-file list, RED/GREEN output, and exact source to three non-editing reviewers:

- requirements reviewer: exact two-behavior scope, canonical terminology, empty P1 settings, and non-goals;
- architecture/anti-overengineering reviewer: one version concept, no compatibility alias or settings framework, private schema ownership, and stage discipline; and
- test-evidence reviewer: causal RED, focused positive/negative controls, generated-artifact currency, and claim limits.

Validate every finding against the current shared tree. Repair only an evidence-backed material defect within the exact files above, add or adjust the focused regression assertion, rerun affected checks, and request only the bounded follow-up necessary to close it.

- [ ] **Step 7: Run settled verification, commit, and stop**

After the last relevant change, rerun the affected focused checks once, `git diff --check`, final status, changed-file list, and exact comparison. Record results and reviewer dispositions in the decision evidence.

```bash
git add packages/builder-core/src/contracts/capability.ts packages/builder-core/src/contracts/project.ts packages/builder-core/tests/contracts.test.mjs packages/builder-core/schemas/capability.schema.json packages/builder-core/schemas/project.schema.json tests/constitution/constitution.test.mjs docs/architecture/capability-model.md docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md docs/superpowers/plans/2026-08-05-p1-builder-kernel.md docs/implementation-evidence/2026-08-05-p1-schema-contract-review-deferral.md docs/implementation-evidence/2026-08-05-p1-pre-task2-schema-contract-decision.md
git commit -m "Clarify P1 schema contracts"
```

Present the exact committed comparison and stop for explicit user approval before Task 2. This approval would not authorize push, pull request, merge, publication, deployment, provider mutation, or another deferred schema change.

## Rollback and recovery

- Before commit, restore only this increment's exact files to the frozen base if approval is withdrawn or verification cannot be completed.
- After commit, revert the focused commit; never reset shared `main`.
- Regenerate checked artifacts from runtime Zod owners; never hand-reconcile generated JSON.
- No generated client state, migration history, provider state, persistent data, or dependency graph changes, so no external or data rollback exists.
