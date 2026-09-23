# Email delivery contract and first runtime handoff

> **Historical handoff:** Resend planning and implementation are integrated. Do not execute this document as a new P5D-1 or P5D-2 assignment. Use [ADR-0017](../adr/0017-transactional-email-resend.md), the [implemented email boundary](../architecture/capability-model.md#transactional-email-boundary) and the [current delivery status](program-roadmap.md#hosted-contact-form--next-two-increments).

**Status:** Historical planning record, reconciled 2026-09-23. The original contract, generation and lifecycle breakdown is covered by the integrated Resend delivery; certification remains separate. The original restart prompt is retired.

**Original goal:** Resolve the concrete email delivery and public-profile admission contract, amend only its canonical planning owners after approval, and produce the exact P5D-2 implementation plan against its then-accepted baseline.

**Architecture:** `transactional-email-resend` remains a hybrid capability with repository/external state and reviewed removal, depending on `app-foundation`. Its sender port belongs to the generated email application boundary; Resend and memory adapters implement that contract. Delivery results express what was observed, and no standalone database, queue, send endpoint or wrapper package is introduced.

**Technology:** Preserve the accepted toolchain and selective Effect boundary. At the inspected baseline Node is `22.23.2`, pnpm `11.20.0`, generated Vitest is `5.0.0` and generated app Effect is `4.0.0-rc.112`. Exact future email API/SDK dependencies, if any, require current evidence; these pins do not authorize upgrades. Use the standard platform fetch capability if it meets the approved contract; add a provider SDK only for a concrete benefit established at Gate 1.

**Controlling sources:** [Source plan](2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md), [roadmap](program-roadmap.md), [capability model](../architecture/capability-model.md), [review protocol](../governance/review-and-contribution.md), [ADR index](../adr/README.md), and [remaining-program delivery plan](2026-09-16-remaining-program-delivery-plan.md), and [recorded D1–D12 decisions](2026-09-16-remaining-program-decisions.md).

## 1. Historical eligibility at preparation

Preparation on 2026-09-16 verified accepted main `991ab80bf071d9671bd9c465c01f2ca83d253234`, including persistence and ADR-0016. Admission then had five certified and six pending subjects, and the inspected P4/default-baseline and persistence integration records had unresolved gates. These are dated observations, not current counts or a claim that the later merges resolved those gates.

The original P5D-1 handoff prepared the email contract and the P5D-2 runtime plan. Subsequent email-specific approvals, ADR-0017 and integrated delivery superseded this start instruction. Sections 2–6 preserve the original planning scope and intermediate checkpoints; they are not a current file allowlist, new implementation assignment or proof of acceptance. The [roadmap](program-roadmap.md#hosted-contact-form--next-two-increments) owns the current Web3Forms-first certification priority and separate later Resend task.

### Existing work that must survive

- Keep the primary checkout, local `main`, every historical branch/worktree and all P4 artifacts unchanged.
- Preserve the existing application-persistence work and integrated PR #129 result. ADR-0016, local-first tuples, D1 harness and export-removal decisions are now accepted main. Preserve the stream's later commits and certification handoff; do not restart or re-ask settled choices.
- Preserve the historical P4 plan and evidence. Its old restart instructions and recipe versions do not authorize this increment.
- Keep P5A/P5B identifiers and their P3B relocation; do not create new tasks for them.

## 2. Original preconditions and decision inputs

**D1 and D2 are answered yes.** Use the linked decision record; do not ask them again. Prepare the exact documentary candidate and runtime plan from those directions. Canonical changes, material new tradeoffs and runtime admission still require the applicable concrete checkpoint.

### D1: public-profile backend admission

The existing catalog makes email optional on portfolio/site/app and app-foundation dependency-only on portfolio/site, while current executable generation and Effect verification are app-specific. The plan must resolve that gap explicitly.

Accepted program direction from the user's answer:

- Explicit email selection on supported current portfolio/site generations adds only its required foundation and email behavior, preserving the origin profile, production content/navigation semantics and independently selected website capabilities.
- A finite new installed snapshot represents every actual changed shared subject. Never mutate default or historical descriptors or use origin recipe alone to choose the installed view.
- Runtime/verification selection follows the installed foundation, with Effect still limited to generated server application/infrastructure/composition/delivery. Unselected non-backend projects remain Effect-free.
- Historical Vitest 4 projects retain their exact existing diagnostics and operations; this increment introduces no automatic standards migration, mixed-generation transition or profile conversion.
- Exact source/target versions, shared descriptor deltas and lock selection are frozen from the accepted candidate at Gate 2; no version numbers are guessed in this proposal.
- Future portfolio/site persistence/contact support needs its own consumer-driven approved scope using this boundary. Do not silently broaden the preserved app-only P5C implementation.

Any later proposed design change must still fulfill the preserved catalog requirements. Restricting email permanently to app or silently converting a site to app would require an explicit product requirement amendment; this planning task cannot silently make that change.

### D2: observable send outcome and retry boundary

Accepted program direction from the user's answer:

- One lazy, server-only send attempt consumes caller-validated transaction content and a stable logical-send identity. User-visible email copy belongs to the owning validated content/template; contact and identity own separate policy and token handling.
- Validate allowed sender/domain/environment and secret availability before any transport call. Do not put secrets in `.egeria`, generated client modules, command output or logs.
- Success means Resend API acceptance with a bounded opaque provider reference; it does not mean recipient inbox delivery. Missing or ambiguous acknowledgement is an explicit unknown result, not success or a definitely-unsent claim.
- Configuration, validation/rejection, throttling, temporary unavailability and uncertain acceptance remain distinguishable stable application categories. Provider exception text/body, recipient, subject, token and message content are not diagnostic payloads.
- No automatic email retry initially. A caller can retry the same logical operation under a subsequently approved bounded policy and its own durable state where required. Do not synthesize a new key on each attempt.
- Preserve Resend's documented idempotency retention/conflict limits in the operational contract; expiry does not authorize a duplicate side effect. Cancellation after a send starts is not proof the message was unsent.
- No email status webhook, mailbox tracking, queue/outbox, business consumer, attachments, marketing, batch scheduler or operational UI is added solely to make standalone email appear complete.

These outcome directions are accepted. Resolve their concrete TypeScript signature and stable identifiers against actual code conventions in the exact plan; do not treat accepted direction as an approved implementation diff.

## 3. Exact planning-file scope

The following paths exist at the verified baseline. This is the bounded documentary amendment scope after approval; it is not permission to change implementation files.

| Path | Exact responsibility in P5D-1 |
| --- | --- |
| `docs/architecture/capability-model.md` | Add the approved documentary transactional-email and public-profile backend-admission boundary beside the existing independent/conditional behavior and catalog. Keep row identifiers, required app-foundation dependency, hybrid/state/reviewed-removal semantics and current runtime-status claims accurate. |
| `docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md` | In §13 and the P5 sequencing/summary, retain all original outcomes while making the approved D1/D2 interpretation and P5D-2/P5D-3/separate-certification sequence unambiguous. Preserve the published remaining-program sequence and the existing P5C handoff. |
| `docs/roadmaps/program-roadmap.md` | Record short proposed email delivery/lifecycle/certification outcomes and the real P4 gate. Link the capability model for semantics. Do not close P4, mark P5C merged/certified, copy private paths or extend its exception. |
| `docs/architecture/enforcement-map.md` | Map the approved future public-profile and email safety checks to existing invariant owners and clearly planned evidence. Preserve identifiers; change no gate to actual before executable checks exist. |
| `docs/architecture/overview.md` | Reconcile only direct statements that would contradict the accepted D1 interpretation; link the detailed owner rather than repeat it. |
| `docs/adr/README.md` and one new decision only if required | If D1 extends an accepted normative restriction, draft the narrowly scoped decision with explicit supersession links. Allocate its exact number/path after checking accepted main and the preserved P5C ADR; present that exact file in the amendment approval before writing it as Accepted. No speculative reservation of ADR-0016. |
| A current private exact-file plan under `docs/superpowers/plans/`, derived from this tracked handoff | Record actual user answers, candidate identity, exact scope and unresolved entry gates; keep execution evidence private. |
| Private `docs/implementation-evidence/2026-09-14-email-delivery-contract-preparation.md` | Create a bounded source/decision/compatibility evidence record only when this increment is authorized. Keep secrets, raw provider output and unrelated machine information out. |
| Private `docs/review-packets/2026-09-14-email-delivery-contract.md` | Create the frozen comparison, checks, reviewer dispositions and approval-ready documentary packet. |

If accepted-main integration changes these paths, re-evaluate the exact overlap first. If an unresolved architecture decision requires another canonical owner, add its exact path to the proposed amendment and obtain the material decision; do not edit a broad wildcard allowlist.

No change is planned to the review protocol, P5C plan/evidence, registry, accepted receipts, runtime catalog/schema, templates, locks, fixtures, scripts, dependencies, Git refs or provider configuration in P5D-1.

## 4. Planning work packages and verifiable completion

These are execution steps within one coherent planning increment, not separate delivery increments.

### Original-increment execution and acceptance structure

This is one coherent documentary increment. The exact files are in section 3; the ordered work packages below are its execution steps.

- [ ] **Gate 1:** Freeze current canonical identity and the private candidate; verify D1/D2, applicable instructions and the precise runtime admission blockers. Documentary preparation does not consume or bypass pending P4/P5C certification.
- [ ] **RED / evidence gap:** Record the catalog-versus-runtime public-profile gap and missing concrete email outcome contract. Do not manufacture a failing test for private prose.
- [ ] **Minimum change:** Prepare the smallest owner-consistent D1/D2 amendment as a private proposed diff and the concrete P5D-2 plan from actual owners. Section 3 bounds any later separately approved canonical write.
- [ ] **GREEN:** Validate coverage, direct-owner consistency, links/anchors and immutable executable/registry inputs. Run the listed existing governance checks only when a canonical documentary candidate actually exists.
- [ ] **Review and acceptance:** Freeze ignored artifact hashes and the exact proposed canonical comparison; obtain the protocol's independent scopes for that documentary candidate, resolve material findings and produce the packet named in section 3. Stop at `verified-final-diff-approval-required` and the separate next-plan Gate 2.
- [ ] **Subject handoff:** Record that this increment changes no executable certification subject; list actual proposed runtime subject changes and their separate future certification obligations without resetting accepted records.

The [program proposal's execution structure](2026-09-16-remaining-program-delivery-plan.md#per-increment-execution-structure-and-gates) maps the original P4 headings to the canonical protocol. The approved P7-only staging exception does not affect this email scope and supplies no email exception. Approval of this planning structure is not approval to apply the later diff.

### A. Bind the accepted source and preserve candidate work

- [ ] Verify branch/worktree/status, exact main/remote identity, accepted P4 state and PR #129's status through read-only queries. Refresh refs only if required and authorized. Do not fast-forward/reset the primary checkout for this planning task.
- [ ] Read actual root/nested instructions and every changed accepted owner, including accepted ADR-0016 and the current P4/persistence closeout conflict.
- [x] Record D1/D2 yes answers and D3–D12 directions in the linked decision record; do not re-ask them.
- [ ] Reconcile later source changes and any explicit user corrections before preparing the exact candidate.
- [ ] Compare baseline-to-current changes in only the relevant owners. Bound the next exact comparison and confirm nothing from prior plans was silently discarded.

Useful current commands, run from the chosen worktree:

```sh
rtk git status --short --branch
rtk git rev-parse HEAD
rtk git rev-parse origin/main
rtk git log -5 --oneline origin/main
rtk git diff --name-status 991ab80bf071d9671bd9c465c01f2ca83d253234..origin/main
```

These reads do not prove remote freshness by themselves. Use the repository's remote identity check if current-main freshness affects the decision. No command here grants permission to mutate main or apply a client transformation.

### B. Prepare and validate one owner-consistent amendment

- [ ] Draft the exact documentary changes from D1/D2, with no new runtime or certification availability claim.
- [ ] Show a before/after ownership table: foundation runtime/verification, email sender/error contract, deployment configuration, builder lock/state, user copy and certification subjects.
- [ ] Trace every original email requirement to P5D-2 or P5D-3 and the separate certification outcome. Preserve public-profile obligations and future authenticated default support.
- [ ] Verify the amended roadmap distinguishes independent email from P5C, but serializes overlapping shared-contract edits/merges and preserves P4's hard gate.
- [ ] Validate local Markdown targets/anchors and owner consistency. Use existing documentation/governance checks when available; add no source-text mirror test solely for this reversible proposal.
- [ ] Compare registry and executable input identities with the baseline; require no changes.

After an authorized canonical documentation candidate exists, run the existing relevant checks once:

```sh
rtk pnpm run test:constitution
rtk pnpm run check:semantic-naming
rtk git diff --check
```

If dependencies are unavailable, report the unavailable check and use read-only link/diff inspection for planning; do not label the test passing. A dependency installation, build, visual or provider journey is not needed merely to write this private plan. Existing document-contract tests may reveal real canonical inconsistencies; if a substantive accepted behavior must change, stop for its owner decision rather than weakening a test.

### C. Produce the exact next runtime plan only from accepted decisions

- [ ] Use the known owner map below to trace actual entry points and direct consumers; consult the accepted P5C result rather than copying its candidate implementation.
- [ ] Freeze exact target profile/installed tuples, provider transport choice, generated file inventory, settings/secret boundary and outcome interface. Include the actual tests and command routing that exercise those boundaries.
- [ ] Define the precise RED/GREEN cases, expected missing-behavior failures, affected owning suites, full relevant candidate verification and one retained fixture selected for a real regression reason. Do not generate a fixture per combination.
- [ ] Name any material existing subject changes and their certification sibling plans; preserve default and retained records. Do not create their pending runtime records in this planning step.
- [ ] Present that exact P5D-2 plan for its own Gate 2. If P4 remains open, report the same specific admission blocker without starting runtime or a polling automation.

### D. Review and stop

- [ ] Freeze the candidate comparison including ignored plan/evidence bytes by content hash; a Git diff alone omits private files.
- [ ] If a canonical amendment candidate has been authorized, follow the protocol's existing plan-authorized bounded `@ponytail-review` and three independent read-only scopes. Do not run a whole-repo audit or apply a complexity suggestion without the required separate authority.
- [ ] Reconcile material findings against the actual candidate and user answers. Do not use reviewer approval as human design approval.
- [ ] Record comparison, all changed files, commands/results, uncertainty, subject delta (none executable), residual P4/P5C gates and recovery boundaries.
- [ ] Stop for approval of the exact documentary candidate and next runtime plan. No commit/PR/push/merge/provider action is authorized by this present planning request.

## 5. Known first-runtime owners and bounded behavior plan

This section identifies the P5D-2 owners after D1/D2 acceptance; its exact implementation has not yet been planned or approved. Existing paths are inspection targets, not a write allowlist. New file names, stable identifiers, target versions and signatures are settled in work package C using D1/D2 and accepted predecessor reconciliation; distant increments receive no speculative file lists.

| Existing path/boundary | What the P5D-2 planner must trace |
| --- | --- |
| `packages/builder-core/src/catalog/capability-catalog.ts` | Finite installed snapshots, requiredPackages, supportedProfiles, dependency and managed surface/probe ownership; do not widen historical descriptors globally. |
| `packages/builder-core/src/contracts/project.ts` and `packages/builder-core/src/contracts/profile.ts` | Strict explicit selection/settings and current profile vocabulary. Preserve existing unknown-option refusals. |
| `packages/builder-core/src/profiles/profile-recipes.ts` | Default recipes remain unchanged; origin profile is not implicit backend authority. |
| `packages/builder-core/src/generation/render-skeleton.ts`, `packages/builder-core/src/generation/template-catalog.ts`, `packages/builder-core/src/generation/verify-generated-project.ts` | Explicit backend selection, generated surfaces and locks, installed-capability-aware Worker receipts, default versus retained graph behavior. |
| `packages/builder-core/src/contracts/state.ts` | Verification vectors and successful state semantics; no successful receipt without actual executed checks. |
| `packages/builder-core/templates/` | Locate actual foundation/application/infrastructure/composition, copy, generated instruction and workflow owners before choosing new email paths. |
| `apps/cli/src/arguments.ts`, `apps/cli/src/run-cli.ts` | Thin explicit optional selection through current command conventions; no generic capability framework or provider call. |
| `packages/builder-core/src/certification/capability-certification.ts`, `packages/builder-core/src/contracts/certification.ts`, root `certifications/capabilities.json` | New/changed exact subjects, required evidence and task-linked pending admission; no certificate carry-forward. |
| `packages/builder-core/tests/render-skeleton.test.mjs`, `packages/builder-core/tests/generate-project.test.mjs`, `packages/builder-core/tests/resolution.test.mjs`, `packages/builder-core/tests/certification.test.mjs` | Actual generation/resolution/state/admission regressions and retained default compatibility. |
| `apps/cli/tests/cli.test.mjs`, `tests/generated-fixtures/`, `scripts/verify-generated-skeletons.mjs` | Compiled selection, exact generated result, immutable fixture verification and proof limits. |

### P5D-2 acceptance and failure matrix

| Observable case | Required evidence |
| --- | --- |
| Unselected portfolio/site/app | Exact retained generation, dependency, content, inference and supported operation behavior unchanged. |
| Explicit current-profile email selection | Dependency graph includes actual foundation/email, strict safe configuration, complete runtime and tests; no database/jobs/identity automatically selected. |
| Unsupported historical or mixed tuple | Read-only refusal before target/control writes; no automatic upgrade or origin-profile conversion. |
| Missing secret, invalid domain/from/header/address | No transport call; stable safe failure; no raw input in diagnostic output. |
| Accepted provider response | Stable provider-acceptance result, bounded opaque reference; no inbox-delivered claim. |
| Provider rejection, auth error, throttle, temporary error | Distinguishable safe categories and retry metadata only within validated bounds. |
| Timeout/cancellation after send starts | Explicit uncertainty; no fresh-id retry and no claim that side effect was cancelled. |
| Same logical operation / key conflict | Same stable key sent on controlled retry; changed payload/key conflict remains failure; expired provider protection is visible in operations guidance. |
| Provider error includes secret/message/recipient | No leak into result, stdout/stderr, structured telemetry or client bundle. |
| Worker runtime and bundle boundary | Actual generated contract execution under workerd using stub transport; Effect/provider implementation excluded from clients/presentation/domain and unselected graphs. |
| Existing-repository apply before P5D-3 | Explicit unsupported refusal; no implied lifecycle claim from fresh generation. |

Generated Node contract tests can exercise the real sender and memory adapter without a fake product endpoint. Use intercepted provider transport to prove protocol behavior locally. Actual synthetic provider outcome/cleanup remains P5D-C, not an implementation test with hidden credentials.

The next plan chooses the smallest relevant checks from current owning scripts, then one full settled relevant suite. Known scripts include `test:builder-core`, `test:cli`, `test:generated-project`, `test:generated-fixtures`, `test:capability-certification`, `check:capability-certification` and `verify:builder-kernel`. The two visual verifiers retain their existing pinned-environment and human-baseline requirements when relevant inputs change. Do not claim any unexecuted, skipped, interrupted or unchanged historical run as a fresh success.

## 6. Proposed commit, review and recovery boundary

- **P5D-1 scope:** one coherent email contract amendment only after its exact approval. This published handoff does not apply that future amendment or authorize its commit.
- **P5D-2 scope:** one fresh-generation implementation PR if separately requested, with the complete sender/configuration/runtime/tests/ownership/lock and safe-admission contract. Internal commits must remain meaningful and cannot expose incomplete capability status.
- **P5D-3 scope:** a separate existing-repository lifecycle implementation PR if requested, preserving reference, plan fingerprint and state-last contracts.
- **P5D-C scope:** independent certification comparison and authority. The implementation PR never includes fabricated provider evidence or promotes the pending subject.
- **Planning recovery:** revise only the proposed documentary candidate and retain its isolated worktree and evidence; preserve prior work.
- **Recovery during later implementation:** retain exact failed repository prefixes; separately review dependency/lock reversal and provider/credential/message disposition. Source rollback cannot recall an accepted email.

## 7. Retired execution prompt

The former copy-ready P5D-1 prompt is retired because its planning, generation and lifecycle work has been integrated. It must not restart email implementation, reopen D1/D2, allocate another email ADR, or replace the actual accepted contract with this older proposal. Git history retains the original prompt for provenance.

For subsequent work, use the [current roadmap](program-roadmap.md#hosted-contact-form--next-two-increments) and the [certification registry](../../certifications/capabilities.json) to resolve the exact subject and its current task plan. Web3Forms certification is next; Resend certification remains required separately later. Each certification task needs its own preparation, human-prerequisite runbook, exact plan, evidence and external-action authority under the [review protocol](../governance/review-and-contribution.md#capability-certification-planning). This historical handoff authorizes none of those actions.
