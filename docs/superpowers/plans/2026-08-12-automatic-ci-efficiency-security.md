# Automatic CI Efficiency and Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` task-by-task, `superpowers:test-driven-development` for behavior changes, `superpowers:requesting-code-review` for the mandatory review, and `superpowers:verification-before-completion` before any completion claim. Track every checkbox and stop at every stated gate.

**Goal:** Consolidate ordinary repository CI into stable, security-conscious checks and remove duplicate Next.js/OpenNext builds without adding reusable caches or weakening generated-project, compatibility-proof, certification, or clean-build evidence.

**Architecture:** Keep ordinary CI read-only and always triggered, then use a fail-safe `scope` job plus job-level conditions for the two expensive lanes. Preserve standalone generated/proof build commands while verification paths reuse the immediately preceding Next build through OpenNext's `--skipNextBuild`. Treat templates as canonical, fixtures as generated outputs, and hosted CI, repository settings, deployment, and certification as separate authorities.

**Toolchain:** GitHub Actions YAML; Node.js `22.23.2`; pnpm `11.20.0`; Node test runner; Next.js `16.3.0`; OpenNext Cloudflare `1.20.2`; Playwright; compiled builder CLI; generated fixture verifier.

## Approval and authority boundary

This plan is based on `main@4e7e68a5b5d8232137b6d4e0f7b7b03896f6ac7e`. Before implementation, refresh `origin/main`, require the approved base to remain an ancestor, and reconcile any overlapping change.

**Direct predecessor:** Dependabot-compatible live-workflow action-pin tests, integrated as `main@4e7e68a5b5d8232137b6d4e0f7b7b03896f6ac7e` after the pending-Changeset selection repair at `2b0624c3448d569d68bad93edd8821c48fb432cb`.

**Acceptance artifact:** `docs/review-packets/2026-08-12-dependabot-compatible-action-pin-tests.md`. At this plan's baseline, that packet still describes its pre-integration approval gate. Before executable edits, append a current acceptance outcome that records the explicit human approval, signed/rules-compliant integration revision `4e7e68a5b5d8232137b6d4e0f7b7b03896f6ac7e`, and reconciliation to local and remote `main`. A missing, pending, unapproved, ambiguous, or non-ancestor acceptance record is a hard stop.

Implementation authorization for this plan permits only local repository edits, focused commits, deterministic local checks, one independent read-only review, and review-backed repairs. It does not authorize push, pull request, merge, workflow dispatch, deployment, certification transition, publication, provider access, credential access, GitHub settings changes, production action, or responses to review comments.

The accepted tree's `standards@0.3.0` subject remains pending. A separate clean Task 6D candidate exists at `standards-certification@3b930c63d920b3c12c450c9598ff8ca36fdbcc01`, based on Task 6C revision `12ecc73a8337ab12ece9dd3a6b2aec03f940383c`. It has reached its own verified-final-diff stop gate but is neither approved nor integrated, and it does not contain accepted `main@4e7e68a5b5d8232137b6d4e0f7b7b03896f6ac7e`. Freeze that branch and worktree: Plan A must not modify, rebase, copy, discard, certify, approve, or integrate it.

This optimization changes managed workflow and preview configuration bytes but adds no managed surface, inference probe, evidence kind, dependency, environment variable, provider, or generated application behavior. Task 1 must nevertheless re-evaluate materiality against the current descriptor and certification contract. If a descriptor version or canonical behavior-contract digest must change, stop and amend the capability/certification plan before editing executable files. If Plan A is later approved and integrated first, reconciliation of the frozen Task 6D candidate belongs to a resumed Task 6D preflight: its evidence-producing revision must descend from the accepted Plan A revision, the affected build, browser, fixture, state, and CI-contract outcomes must be rerun against the optimized topology, and the subject/digest must be recomputed. Plan A may amend that future requirement but must not perform the reconciliation or certification transition. Both final diffs retain separate approval gates.

## Exact file scope

Create during implementation:

```text
docs/implementation-evidence/2026-08-12-automatic-ci-efficiency-security-preparation.md
docs/implementation-evidence/2026-08-12-automatic-ci-efficiency-security-verification.md
docs/review-packets/2026-08-12-automatic-ci-efficiency-security.md
```

Modify:

```text
.github/workflows/repository-quality.yml
proofs/nextjs-cloudflare/AGENTS.md
proofs/nextjs-cloudflare/package.json
proofs/nextjs-cloudflare/playwright.preview.config.ts
packages/builder-core/templates/common/.github/workflows/quality.yml.template
packages/builder-core/templates/common/AGENTS.md.template
packages/builder-core/templates/common/README.md.template
packages/builder-core/templates/common/apps/web/playwright.preview.config.ts
packages/builder-core/templates/common/package.json.template
packages/builder-core/src/generation/verify-generated-project.ts
scripts/verify-generated-skeletons.mjs
tests/constitution/constitution.test.mjs
tests/generated-fixtures/verification-script.test.mjs
packages/builder-core/tests/render-skeleton.test.mjs
packages/builder-core/tests/generate-project.test.mjs
fixtures/generated/portfolio/.github/workflows/quality.yml
fixtures/generated/portfolio/AGENTS.md
fixtures/generated/portfolio/README.md
fixtures/generated/portfolio/apps/web/playwright.preview.config.ts
fixtures/generated/portfolio/package.json
fixtures/generated/portfolio/.egeria/state.json
fixtures/generated/portfolio-calendly/.github/workflows/quality.yml
fixtures/generated/portfolio-calendly/AGENTS.md
fixtures/generated/portfolio-calendly/README.md
fixtures/generated/portfolio-calendly/apps/web/playwright.preview.config.ts
fixtures/generated/portfolio-calendly/package.json
fixtures/generated/portfolio-calendly/.egeria/state.json
fixtures/generated/site/.github/workflows/quality.yml
fixtures/generated/site/AGENTS.md
fixtures/generated/site/README.md
fixtures/generated/site/apps/web/playwright.preview.config.ts
fixtures/generated/site/package.json
fixtures/generated/site/.egeria/state.json
README.md
CONTRIBUTING.md
docs/architecture/enforcement-map.md
docs/architecture/overview.md
docs/compatibility/nextjs-cloudflare.md
docs/roadmaps/program-roadmap.md
docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md
docs/superpowers/plans/2026-08-10-generated-unit-component-testing-certification.md
docs/superpowers/plans/2026-08-12-automatic-ci-efficiency-security.md
docs/review-packets/2026-08-12-dependabot-compatible-action-pin-tests.md
```

Delete after consolidation:

```text
.github/workflows/generated-project-quality.yml
.github/workflows/compatibility-proof-quality.yml
```

The fixture list is derived scope, not permission to hand-edit. Use production generation as the sole source. If generation changes additional fixture files or fingerprints, inspect the cause, update the file inventory in this plan and preparation evidence, and stop for approval if the change is not directly caused by the approved template edits.

## Task 1: Freeze the current contract and materiality decision

- [x] Verify branch, status, worktrees, `git rev-parse HEAD`, `git rev-parse origin/main`, and `git merge-base --is-ancestor 4e7e68a5b5d8232137b6d4e0f7b7b03896f6ac7e HEAD`.
- [x] Update the named predecessor packet with its post-integration acceptance outcome and require explicit approval, accepted revision `4e7e68a5b5d8232137b6d4e0f7b7b03896f6ac7e`, signed/rules-compliant integration, and local/remote-main reconciliation before any executable edit.
- [x] Read root and applicable nested instructions, accepted ADRs, architecture overview, capability model, enforcement map, approved source plan, roadmap, compatibility record, current standards descriptor/registry, generated-testing implementation evidence, and Task 6D certification plan.
- [x] Record the three current automatic workflows, their exact triggers/jobs/path ownership, the generated workflow/template contract, proof verification order, current action pins, hosted-run evidence, and current cache settings.
- [x] Run `pnpm run check:capability-certification` and `pnpm run test:capability-certification`; require the existing pending standards record to be internally valid.
- [x] Decide explicitly whether the operational-only command changes alter the standards descriptor or canonical behavior-contract digest. Record the evidence and stop if the answer requires a new subject.
- [x] Write the preparation evidence with the exact comparison, authority boundary, recovery route, primary-source decisions, expected RED failures, and claim limits.

Expected: a settled preflight showing no unaccounted overlapping work and either a justified unchanged pending subject or a hard stop before executable edits.

## Task 2: RED — specify one stable automatic workflow

**Files:** `tests/constitution/constitution.test.mjs`

- [x] Replace the three-workflow expectation with one `.github/workflows/repository-quality.yml` contract triggered for every pull request and push to `main`, with no workflow-level `paths`, `paths-ignore`, secrets, environments, write permission, deploy, or publish command.
- [x] Require exactly the stable job identifiers `scope`, `builder-and-packages`, `generated-projects`, `compatibility-proof`, and `dependency-review`.
- [x] Require the exact expected action repositories plus immutable full lowercase 40-hex SHAs through the shared `isPinnedGitHubActionReference` policy, `persist-credentials: false`, fixed runner/Node/pnpm, frozen installation, `cache: false`, bounded timeouts, and cancel-in-progress concurrency for every applicable job. Do not encode one release-specific SHA in live-workflow policy tests; retain the exact reviewed initial SHAs in the workflow implementation and preparation evidence.
- [x] Require `scope` to read pull-request base/head from `github.event.pull_request.base.sha`/`github.event.pull_request.head.sha` and push base/head from `github.event.before`/`github.sha`, validate nonzero lowercase 40-hex values, resolve both as local commit objects, use Git pathspecs for the current generated/proof ownership sets, activate both deep jobs for workflow changes, and enable both deep jobs on zero/malformed/missing/unavailable/unresolvable revisions or any Git error.
- [x] Require each diff probe to distinguish status `0` (definitively unchanged) from `1` (changed). Any other status enables both deep jobs; no error may be interpreted as unchanged.
- [x] Require deep jobs to use job-level `if` expressions driven by the scope outputs and retain all current generated/proof checks.
- [x] Require pull-request dependency review from the exact `actions/dependency-review-action` repository through `isPinnedGitHubActionReference`, with `fail-on-severity: moderate` and both `runtime` and `development` scopes. Do not freeze one release-specific dependency-review SHA in the live-workflow policy test.
- [x] Add negative cases that reject unsafe interpolation of event revisions into shell source, workflow path filters, `cache: true`, a skipped fail-safe, extra authority, or removed coverage.
- [x] Run `pnpm run test:constitution` and confirm RED only for the old three-workflow topology and absent new controls.
- [x] Commit the focused RED contract as `test: define consolidated CI contract`.

## Task 3: GREEN — consolidate ordinary repository CI

**Files:** `.github/workflows/repository-quality.yml`; delete the two scoped workflow files.

- [ ] Keep workflow-level `permissions: contents: read` and `repository-quality-${{ github.ref }}` cancellation.
- [ ] Implement `scope` with full-history credential-free checkout. Pass the event-specific revisions through `env`, validate and resolve them as commit objects before diffing, handle `git diff --quiet` status `0`, `1`, and error distinctly, and write only literal `true`/`false` outputs.
- [ ] Preserve the current generated path ownership: `.gitattributes`, `.npmrc`, root workspace manifests/lockfile, `apps/cli/**`, builder/observability/standards packages, retained fixtures, verifier, and generated-fixture tests. Treat any `.github/workflows/**` change as applicable to both deep lanes.
- [ ] Preserve the current proof path ownership: `.npmrc`, root workspace manifests/lockfile, `packages/standards/**`, and the proof tree. Treat any `.github/workflows/**` change as applicable to both deep lanes.
- [ ] Keep `builder-and-packages` always-on with its existing explicit command order and change pnpm setup to `cache: false`.
- [ ] Move `generated-projects` and `compatibility-proof` intact behind their job-level conditions, set checkout `fetch-depth: 0` only where required, and change pnpm setup to `cache: false`.
- [ ] Add pull-request-only dependency review at the initially reviewed commit `a1d282b36b6f3519aa1f3fc636f609c47dddb294`, with no checkout, install, secrets, or additional permission; record that exact initial binding in preparation evidence.
- [ ] Delete the two superseded workflow files only after the consolidated contract contains their checks.
- [ ] Run `pnpm run test:constitution` and require GREEN.
- [ ] Run `git diff --check` and inspect the YAML diff for expression/shell quoting and least privilege.
- [ ] Commit the workflow implementation as `ci: consolidate repository quality checks`.

Expected: stable job names always appear for pull requests; deep work is skipped at the job level only when the validated diff says it is irrelevant.

## Task 4: RED — specify prepared-output reuse

**Files:** `tests/constitution/constitution.test.mjs`, `tests/generated-fixtures/verification-script.test.mjs`, `packages/builder-core/tests/render-skeleton.test.mjs`, `packages/builder-core/tests/generate-project.test.mjs`

- [ ] Require proof `verify` to contain one Next build followed by `opennextjs-cloudflare build --skipNextBuild`, with preview Playwright starting `opennextjs-cloudflare preview` directly.
- [ ] Require compiled-generator verification, generated root `verify`, generated workflow, and fixed-root verifier to use the same prepared-output order and never invoke `build:cloudflare` after a successful Next build.
- [ ] Preserve generated/proof standalone `build:cloudflare` and `preview` package scripts byte-for-byte as public convenience commands.
- [ ] Update the fixed-root command sequence/count and failure-code expectations for direct `pnpm --dir apps/web exec opennextjs-cloudflare build --skipNextBuild`.
- [ ] Require instructions and README templates to state that preview E2E consumes already prepared `.open-next` output and must follow the build/transform step.
- [ ] Require the generated workflow to keep lint, typecheck, unit, component, Next, OpenNext, Chromium, development-browser, preview-browser, and failure-artifact boundaries while using `cache: false`.
- [ ] Run `pnpm run test:constitution`, `pnpm run test:builder-core`, and `pnpm run test:generated-fixtures`; confirm RED only for the obsolete duplicate-build commands/documentation/cache flag.
- [ ] Commit the focused RED contracts as `test: require prepared OpenNext output reuse`.

## Task 5: GREEN — deduplicate generated and proof verification

**Files:** proof package/config/instructions; generated templates; `packages/builder-core/src/generation/verify-generated-project.ts`; `scripts/verify-generated-skeletons.mjs`.

- [ ] Change proof `verify` so `pnpm run build` is followed by `pnpm exec opennextjs-cloudflare build --skipNextBuild`; do not change proof `build:cloudflare`, `preview`, or `deploy` scripts.
- [ ] Change proof preview Playwright `webServer.command` to direct `pnpm exec opennextjs-cloudflare preview -- --ip 127.0.0.1 --port 3101`.
- [ ] Change generated root `verify` to call `pnpm --dir apps/web exec opennextjs-cloudflare build --skipNextBuild` after its root Next build; preserve root/web standalone build and preview scripts.
- [ ] Change generated preview Playwright to direct `pnpm exec opennextjs-cloudflare preview -- --ip 127.0.0.1 --port 3101`.
- [ ] Change the generated workflow's OpenNext step to the direct `--skipNextBuild` command and set pnpm setup to `cache: false`.
- [ ] Change compiled-generator verification's OpenNext command array to `--dir`, `apps/web`, `exec`, `opennextjs-cloudflare`, `build`, `--skipNextBuild`; preserve state-last ordering, failure code, bounded output, and verification receipt identifier.
- [ ] Change the fixed-root verifier's OpenNext command array to `--dir`, `apps/web`, `exec`, `opennextjs-cloudflare`, `build`, `--skipNextBuild`; keep the existing bounded execution, isolated homes/stores/caches, failure normalization, and single execution per fixture.
- [ ] Update proof/generated instructions and READMEs with the prepared-output prerequisite and evidence boundary.
- [ ] Run the three focused test commands from Task 4 and require GREEN.
- [ ] Commit the implementation as `perf: reuse prepared OpenNext builds`.

## Task 6: Regenerate retained fixtures from production output

- [ ] Build the production builder and CLI with `pnpm run build:builder`.
- [ ] Generate each `generatedFixtureContracts` case twice into absent directories under one new mode-0700 temporary owner, using the compiled CLI and the exact production `createArguments` from `scripts/verify-generated-skeletons.mjs`.
- [ ] Run `pnpm run test:generated-fixtures` before replacement and require the two generated copies to be byte-identical with exact inventories, state, inference, and portable lockfiles.
- [ ] Replace committed fixture roots only from one validated production output per identifier. Do not hand-edit fixture workflow, package, README, AGENTS, preview configuration, or state fingerprints.
- [ ] Re-run `pnpm run test:generated-fixtures`; require committed fixtures to equal fresh production generation exactly.
- [ ] Review the derived diff. Require it to contain only the approved template-derived paths and their direct state fingerprints; investigate any other byte.
- [ ] Commit derived outputs as `test: regenerate optimized CI fixtures`.

## Task 7: Reconcile canonical documentation and pending certification plan

- [ ] Update the architecture overview, source plan, program roadmap, enforcement map, README, contribution guide, and compatibility record to describe one automatic workflow, stable job-level scoping, dependency review, no reusable caches, and one-build prepared-output verification.
- [ ] Amend the Task 6D standards certification plan so `ci-contract`, `generated-project-builds`, `browser-regression`, and `retained-fixture-matrix` require the exact `cache: false` and `--skipNextBuild`/direct-preview behavior now present.
- [ ] Preserve historical evidence and run identifiers as historical; do not rewrite them to describe the new topology.
- [ ] State that static/local checks do not prove hosted execution and that required-check configuration is a later separately authorized action.
- [ ] Run `pnpm run check:semantic-naming`, `pnpm run test:constitution`, and `git diff --check`.
- [ ] Commit the reconciliation as `docs: align CI optimization contracts`.

## Task 8: Complete local verification once

- [ ] Run `pnpm run verify:builder-kernel` once on the settled unchanged tree. This includes public registry reads, clean temporary installs, Chromium, local servers, browser execution, and the three retained fixtures; obtain any required network approval before starting.
- [ ] Run `pnpm --filter @egeria-systems/nextjs-cloudflare-proof exec playwright install --with-deps chromium`, then `pnpm run verify:compatibility-proof` once on the settled tree. The builder-kernel aggregate does not own this proof matrix.
- [ ] Run `git diff --check`, `pnpm run check:semantic-naming`, and `pnpm run changeset:status` if not already included against the final tree.
- [ ] Record exact commands, versions, duration, exit results, fixture identities, generated test counts, browser boundaries, and any skipped external evidence in verification evidence.
- [ ] Do not claim hosted GitHub, dependency-review, deployment, provider, visual, human-usability, assistive-technology, or WCAG outcomes from local results.

## Task 9: Independent review, bounded repair, and stop gate

- [ ] Dispatch one bounded independent read-only reviewer over the exact base-to-candidate comparison. Require three separately labeled, non-overlapping reports: requirements; architecture and anti-overengineering; and test evidence. Across those reports cover job-skip fail safety, shell/ref injection, permissions/pins/cache, complete command coverage, build-order correctness, fixture derivation, certification materiality, documentation, tests, claims, and recovery. Prohibit edits and recursive fan-out.
- [ ] Validate every finding against the current tree. For each material defect, add a focused failing regression test, implement the minimum repair, and rerun only affected checks.
- [ ] Create the review packet with exact comparison, changed files, commits, commands/results, reviewer dispositions, remaining risks, deferred hosted/settings work, claims, and recovery.
- [ ] Verify status, untracked files, worktree identities, commit history, and exact diff. Stop for verified-final-diff approval.

Do not push, open a pull request, dispatch CI, change required checks, begin Plan B, deploy, certify, publish, or mutate any external system.

## Completion criteria

- One automatic workflow exposes all five stable job names on every pull request and main push.
- Invalid or unavailable scope revisions run both deep lanes; irrelevant changes skip only the appropriate jobs.
- Ordinary CI is read-only, pinned, credential-free, frozen, bounded, cancelling, and cache-free.
- Dependency review blocks newly introduced moderate-or-higher runtime/development vulnerabilities on pull requests.
- Compiled-generator, generated, and proof verification paths perform one Next build and one OpenNext transform per candidate, while public standalone scripts remain compatible.
- Templates, production-generated fixtures, state fingerprints, fixed verifier, pending certification plan, and canonical docs agree.
- Focused and complete local checks pass; hosted/external evidence and final-diff approval remain separate.

## Recovery

Use focused newest-first reverts. Restore the two path-scoped workflow files together with the old root workflow contract; restore previous verification commands and regenerate all fixtures from the reverted templates; restore documentation and the pending certification plan to their prior exact subject. External settings require their own separately authorized recovery and are not changed by this plan.
