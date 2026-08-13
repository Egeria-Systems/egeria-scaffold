# Automatic CI Efficiency and Security Review Packet

**Date:** 2026-08-12 (America/Toronto)

**Status:** Plan A local implementation, accepted-main reconciliation, selected PR #10 review repair, and affected verification are complete; the user authorized one focused commit and normal push to the existing branch

**Accepted Plan A base after reconciliation:** `ee1e1df10fa2be2f09333efecd86de7f7a131d49`

**Reviewed implementation candidate before this packet:** `5c1b53974924649190ed393dde0a96ca91f35ecd`

**Branch:** `ci-efficiency-security`

**Isolated worktree:** `.worktrees/ci-efficiency-security`

**Exact comparison:** accepted base `ee1e1df10fa2be2f09333efecd86de7f7a131d49` through the commit containing this packet. Its parent PR head is `55cde83d721145370e537dba251a10d494ca9799`; the resulting twelve-file repair includes the preserved five-file final-review repair and the selected PR-review dispositions. The final handoff reports the containing commit because a commit cannot include its own hash.

## Outcome

Plan A replaces three overlapping automatic workflows with one read-only `Repository quality` workflow. It keeps five stable job identities, classifies generated-project and compatibility-proof ownership through a fail-safe Git scope job, and adds pull-request dependency review. Invalid, unavailable, or erroring revision comparisons enable both deep lanes. Ordinary CI remains pinned, credential-free, frozen-install, timeout-bounded, cancelling, and reusable-cache-free.

Generated-project and compatibility-proof verification now build standalone Next output once, transform that prepared output once through OpenNext `--skipNextBuild`, and run preview directly from the prepared `.open-next` output. Public standalone build and preview commands remain available. The three retained fixtures were regenerated only through the production generator and match their canonical templates and state fingerprints.

Accepted base `ee1e1df10fa2be2f09333efecd86de7f7a131d49` records `standards@0.3.0` as certified and binds its reviewed eight-outcome receipt to accepted-main evidence revision `c9294e9dc59d4b7bafed406846af3b43a10733d3`. Its `deployment-cloudflare@0.2.0` backfill subject retains the exact behavior-contract digest. Plan A changes no certification registry entry or status. After Plan A is approved and integrated, a separately resumed Task 6D stream must rerun all eight receipt outcomes under one descendant evidence revision and update the evidence bindings without another pending-to-certified transition. That work is not part of Plan A.

## Exact changed files

Automatic workflows:

- `.github/workflows/repository-quality.yml`
- `.github/workflows/generated-project-quality.yml` (deleted)
- `.github/workflows/compatibility-proof-quality.yml` (deleted)

Compatibility proof:

- `proofs/nextjs-cloudflare/AGENTS.md`
- `proofs/nextjs-cloudflare/next.config.ts`
- `proofs/nextjs-cloudflare/package.json`
- `proofs/nextjs-cloudflare/playwright.preview.config.ts`

Builder implementation, templates, and contracts:

- `packages/builder-core/src/generation/verify-generated-project.ts`
- `packages/builder-core/templates/common/.github/workflows/quality.yml.template`
- `packages/builder-core/templates/common/AGENTS.md.template`
- `packages/builder-core/templates/common/README.md.template`
- `packages/builder-core/templates/common/apps/web/next.config.ts`
- `packages/builder-core/templates/common/apps/web/playwright.preview.config.ts`
- `packages/builder-core/templates/common/package.json.template`
- `packages/builder-core/tests/generate-project.test.mjs`
- `packages/builder-core/tests/render-skeleton.test.mjs`
- `scripts/verify-generated-skeletons.mjs`
- `tests/constitution/constitution.test.mjs`
- `tests/generated-fixtures/verification-script.test.mjs`

Production-derived retained fixtures:

- `fixtures/generated/portfolio/.egeria/state.json`
- `fixtures/generated/portfolio/.github/workflows/quality.yml`
- `fixtures/generated/portfolio/AGENTS.md`
- `fixtures/generated/portfolio/README.md`
- `fixtures/generated/portfolio/apps/web/next.config.ts`
- `fixtures/generated/portfolio/apps/web/playwright.preview.config.ts`
- `fixtures/generated/portfolio/package.json`
- `fixtures/generated/portfolio-calendly/.egeria/state.json`
- `fixtures/generated/portfolio-calendly/.github/workflows/quality.yml`
- `fixtures/generated/portfolio-calendly/AGENTS.md`
- `fixtures/generated/portfolio-calendly/README.md`
- `fixtures/generated/portfolio-calendly/apps/web/next.config.ts`
- `fixtures/generated/portfolio-calendly/apps/web/playwright.preview.config.ts`
- `fixtures/generated/portfolio-calendly/package.json`
- `fixtures/generated/site/.egeria/state.json`
- `fixtures/generated/site/.github/workflows/quality.yml`
- `fixtures/generated/site/AGENTS.md`
- `fixtures/generated/site/README.md`
- `fixtures/generated/site/apps/web/next.config.ts`
- `fixtures/generated/site/apps/web/playwright.preview.config.ts`
- `fixtures/generated/site/package.json`

Canonical documentation, plans, and evidence:

- `CONTRIBUTING.md`
- `README.md`
- `docs/architecture/enforcement-map.md`
- `docs/architecture/overview.md`
- `docs/compatibility/nextjs-cloudflare.md`
- `docs/implementation-evidence/2026-08-12-automatic-ci-efficiency-security-preparation.md`
- `docs/implementation-evidence/2026-08-12-automatic-ci-efficiency-security-verification.md`
- `docs/review-packets/2026-08-12-dependabot-compatible-action-pin-tests.md`
- `docs/review-packets/2026-08-12-automatic-ci-efficiency-security.md`
- `docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md`
- `docs/roadmaps/program-roadmap.md`
- `docs/superpowers/plans/2026-08-10-generated-unit-component-testing-certification.md`
- `docs/superpowers/plans/2026-08-12-automatic-ci-efficiency-security.md`
- `docs/superpowers/plans/2026-08-12-protected-workflow-hardening.md`
- `docs/superpowers/specs/2026-08-12-ci-efficiency-security-design.md`

The protected-workflow-hardening document was authored with the approved two-plan design before Plan A execution. Every Plan B task remains unchecked. No protected workflow, Plan B test, evidence file, review packet, deployment command, certification command, or settings surface was changed or executed.

## Commits

The Plan A sequence after its approved base is:

- `493c85b3ff5260ff901e497a824c110a5c7f5df4` — `docs: plan secure CI optimization`
- `62f355af8a6572c3d63dd3d3905685f3fea600a8` — `docs: prepare automatic CI implementation`
- `a98f69d39c2dd6b6ff281149e15325ac5126a503` — `test: define consolidated CI contract`
- `5f58bf7d1c40e0a6407d57f9ce54613192549b98` — `ci: consolidate repository quality checks`
- `773eda0edda894643480fefbc0074dff3cca6016` — `test: require prepared OpenNext output reuse`
- `4e4d9e419954738ebb1adcc8dc86169f5ef9a1c4` — `test: require standalone prepared Next output`
- `87c50705284464dcb292758cd4cc79436d641f63` — `perf: reuse prepared OpenNext builds`
- `43f277be30eb38faccc81159a29aa64f730bf9c9` — `test: regenerate optimized CI fixtures`
- `c08963f10e1075bce8de9ccbac8d78e70435851f` — `docs: align CI optimization contracts`
- `5a3e1eed6a8086e58fa9cdbdb43c5006651ba520` — `docs: record CI optimization verification`
- `3a5b08bcacdb7088f4ed1a22c13c3b80f10e7d49` — `test: execute CI scope classification`
- `bbbb0dabb4a595f325cc079876c04684a9543c3d` — `test: exercise CI scope fail-safes`
- `5c1b53974924649190ed393dde0a96ca91f35ecd` — `docs: close CI optimization review findings`
- `1d1abde4e3a2d681f7a5b3354602e57cae3a9e16` — `docs: complete Plan A review packet`

The final packet commit is reported in the handoff.

## TDD record

The workflow contract was written first and failed only against the predecessor three-workflow topology and absent scope/dependency controls. The consolidated workflow then made it green.

Prepared-output contracts were written before implementation and failed only against the duplicate Next/OpenNext build order, indirect preview command, cache flag, and absent standalone/tracing configuration. The minimum implementation changed the command graph and Next configuration. Production regeneration then restored the exact fixture contract.

Independent review found that the scope classifier had structural assertions but no actual shell execution. A focused hermetic test was added first and failed RED because its execution harness was absent. The minimum harness then passed 1/1 across 12 actual shell executions, covering unrelated, generated-only, proof-only, workflow, pull-request, malformed, missing, zero, unresolvable, unsupported-event, and forced Git-error cases.

The bounded final review found a separate evidence-renewal contract defect. A focused plan contract failed RED because the Task 6D amendment did not distinguish renewal of an already-certified subject from its original pending-subject admission. The minimum amendment made that test GREEN 1/1 by requiring all eight outcomes under one descendant evidence revision while preserving certified status. The full constitution initially rejected a literal historical sequencing label in the new executable test; the existing neutral label constructor repaired that authored-code violation without weakening the contract.

Selected PR review then required one runtime contract change: command failures must retain bounded exit-code and timeout metadata without exposing child output. The focused diagnostic contract failed RED because the formatter was absent. Minimum implementation made it GREEN; the full builder-core suite then exposed and repaired the pnpm-version wrapper's loss of that metadata. Constitution-only strengthening added an independent malformed-head scenario, bringing the exact scope shell to 13 executions, plus separate path-array ownership, first-separator output parsing, source-level security mutations, the actual obsolete preview command, and target-document wording checks.

## Verification

Node.js `22.23.2` and pnpm `11.20.0` were used for applicable pnpm checks.

| Command or boundary | Result |
| --- | --- |
| `pnpm run verify:builder-kernel` | Passed once in 551.041 seconds on the settled Plan A behavioral tree |
| `pnpm --filter @egeria-systems/nextjs-cloudflare-proof exec playwright install --with-deps chromium` | Passed; Chromium was already current |
| `pnpm run verify:compatibility-proof` | Passed once in 30.001 seconds on the settled Plan A behavioral tree |
| Retained fixture contract | Passed 9/9; exact inventories 47/52/49 and byte-identical production regeneration |
| Fixed-root retained-fixture verification | Passed all 15 checks for `portfolio`, `portfolio-calendly`, and `site` |
| Browser evidence | Passed development and direct prepared-OpenNext/workerd preview for all retained fixtures and the compatibility proof |
| Post-review scope behavior | Passed 1/1 focused test with 13 actual classifier executions |
| Final-candidate `test:constitution` | Passed 55/55 |
| Final-candidate `test:builder-core` | Passed 141/141 |
| Final-candidate `test:capability-certification` | Passed 24/24 |
| Final-candidate `check:capability-certification` | Passed admission for all 7 records |
| `legacy-backfill-exempt` closure | Expected rejection: `observability` remains `pending` |
| `all-certified` closure | Expected rejection: `observability` plus four records remain pending/backfill-pending |
| Final-candidate `test:package-boundaries` | Passed 46/46 |
| Final-candidate `check:semantic-naming` | Passed |
| Final-candidate `lint:builder` | Passed, including copy externalization |
| Final-candidate `typecheck:builder` | Passed |
| Final-candidate `changeset:status` | No package bump at patch, minor, or major |
| `git diff --check` | Passed |

The Plan A workflow, generator success path, production templates, proof, fixed-root verifier, and retained fixtures are byte-identical to the independently reviewed and fully verified pre-reconciliation Plan A candidate `a88f704bb65404dd218da908418c92cdd626ca7d`. The PR review changes only failure-result metadata in the compiled verifier; its commands, limits, output suppression, and success behavior remain unchanged. The expensive builder-kernel, regeneration, fixed-root, compatibility-proof, and browser success matrices were therefore not repeated. Focused certification, builder-core, package, lint, typecheck, semantic, Changesets, constitution, ancestry, and diff checks were rerun. The first constitution reconciliation was RED at 52/54 for stale sequencing assertions; focused TDD made that boundary GREEN 2/2 and the full suite GREEN 54/54 before the later review-strengthened final suite passed 55/55.

## Independent review dispositions

One bounded independent read-only reviewer produced the three required reports. Its initial overall verdict was `NOT READY` with three medium findings. Each was validated and repaired:

- Requirements: the plan's exact scope omitted the proof, template, and three retained-fixture `next.config.ts` paths. All five paths are now explicit in the plan and preparation inventory.
- Architecture, security, and anti-overengineering: the preparation evidence assessed only the standards subject. It now separately identifies `deployment-cloudflare` as canonical owner of the changed Next configuration, records its exact unchanged digest/evidence contract, and justifies the non-material preparation-order change without altering its `backfill-pending` status.
- Test evidence: structural tests did not execute the scope shell. The TDD repair added the hermetic actual-shell contract described above and recorded its causal evidence.

The reviewer found no other material defect. Controller verification confirmed each repair against the current tree and reran the affected checks.

A later bounded independent read-only final review found one material evidence-renewal defect in the accepted-main reconciliation amendment: it routed an already-certified subject through Task 1's original pending-subject gate and allowed three outcomes to remain conditional even though the receipt binds every outcome to one evidence revision. The focused contract failed RED against that wording. The repaired Task 6D plan now defines an already-certified evidence-renewal preflight, requires all eight outcomes on one post-Plan A descendant, preserves certified status, and prohibits a second pending-to-certified transition. No workflow, generator, proof, template, verifier, fixture, registry, receipt, or accepted Task 6D evidence artifact changed for this repair.

The same reviewer found the first focused test too broad to lock four independent protections even though the repaired prose was correct. The strengthened contract now directly requires the no-pending-gate instruction, no carry-forward rule, preserved certified status, and accepted-artifact immutability. This test-only repair does not broaden the normative change. The reviewer's final read-only disposition was `READY`, with no material finding remaining.

All eleven user-selected PR #10 findings were checked against the current candidate. Ten requested repairs were applied directly. The dependency-review finding's underlying claim defect was valid, but its suggested `base-ref`/`head-ref` mechanism was not: the pinned action documents those inputs as unused for pull-request events. The unsupported exact-revision-input claim was removed while the enforceable action identity, immutable revision, pull-request-only condition, severity, and scope contracts were preserved. No review thread was replied to or resolved.

One bounded independent read-only final review then inspected the complete twelve-file repair from committed PR head `55cde83d721145370e537dba251a10d494ca9799`. Its disposition was `READY` with no material findings. It confirmed the selected findings were resolved, Task 6D artifacts remained byte-identical, failure metadata was bounded and output-free, integration and constitution coverage was causal, publication remained limited to the authorized normal fast-forward push, and no Plan B or unrelated work was present.

## Claims, residual risks, and deferred work

- No GitHub workflow was dispatched. Static and local behavior checks do not prove hosted event delivery, hosted job conditions, the dependency-review service, or GitHub required-check configuration.
- The user separately authorized one normal push of the focused containing commit to the existing `ci-efficiency-security` branch. The final handoff reports that result. No force-push, new or replacement branch/PR, PR metadata/comment mutation, merge, repository setting, workflow dispatch, environment, secret, permission, deployment, provider, publication, certification transition, production action, or other external message is authorized.
- Local Next.js, OpenNext/workerd, Playwright, and axe evidence does not establish deployed behavior, performance, visual quality, human usability, assistive-technology compatibility, or WCAG conformance.
- The consolidated workflow uses reviewed immutable action SHAs, but future action updates still require ordinary dependency review and hosted validation.
- Accepted base `ee1e1df10fa2be2f09333efecd86de7f7a131d49` includes Task 6D and its evidence-ancestry repair. Before any Plan A integration, revalidate current `main` and require capability admission to pass.
- Renewing Task 6D evidence remains a separate Task 6D responsibility only after an accepted Plan A revision exists. Its single-revision receipt contract requires all eight outcomes to be rerun on that descendant while the subject remains certified.
- Plan B remains unstarted. Its pre-existing plan document has no checked execution task and grants no implementation or external authority.

## Recovery

Use focused newest-first reverts after accepted base `ee1e1df10fa2be2f09333efecd86de7f7a131d49`:

1. Restore all three predecessor automatic workflows together.
2. Restore the prior generated/proof verification commands and Next/preview configuration.
3. Regenerate all three retained fixtures from the reverted production templates; do not hand-edit derived output.
4. Restore Plan A's canonical documentation and future Task 6D evidence-renewal amendment. Preserve the accepted Task 6D receipt, registry entry, and certification status.

No external recovery applies because Plan A changed no external system.

## Live PR and proposed publication boundary

Fresh revalidation found open PR #10 based on `main@ee1e1df10fa2be2f09333efecd86de7f7a131d49` with remote head `55cde83d721145370e537dba251a10d494ca9799`, exactly matching the clean local committed candidate before this repair. Its API snapshot remained `BLOCKED`, returned no review decision, and showed successful `scope`, `builder-and-packages`, `dependency-review`, `generated-projects`, `compatibility-proof`, and CodeRabbit checks. Because the remote branch contains the complete reconciled Plan A history, the earlier history-bridge proposal is obsolete. The user authorized the smallest publication strategy: one focused repair commit followed by a normal fast-forward push to the existing `ci-efficiency-security` branch. The containing commit and final pushed PR head are reported in the handoff. Do not force-push, create another branch or PR, merge, or update PR metadata/comments.

## Stop gate

After the authorized normal push, stop for the user's merge decision. Do not merge, create or replace a pull request, update PR metadata or comments, dispatch a workflow, change GitHub settings or required checks, deploy, publish, certify, begin Plan B, or mutate any other external system.
