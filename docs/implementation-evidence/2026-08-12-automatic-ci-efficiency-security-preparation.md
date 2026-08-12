# Automatic CI Efficiency and Security Preparation Evidence

**Date:** 2026-08-12 (America/Toronto)

**Status:** Gate 1 complete; executable TDD work may begin under the approved Plan A boundary

## Exact comparison and repository state

- Worktree: `.worktrees/ci-efficiency-security`
- Branch: `ci-efficiency-security`
- Plan commit at preflight entry: `7dd35b4447edb70d57587730af8ab6deadd73c6a`
- Accepted implementation base: `main@4e7e68a5b5d8232137b6d4e0f7b7b03896f6ac7e`
- Refreshed `origin/main`: `4e7e68a5b5d8232137b6d4e0f7b7b03896f6ac7e`
- Local `main`: `4e7e68a5b5d8232137b6d4e0f7b7b03896f6ac7e`
- Planned final comparison: `4e7e68a5b5d8232137b6d4e0f7b7b03896f6ac7e...<Plan-A-candidate>`

The worktree was clean before preparation edits. `git merge-base --is-ancestor 4e7e68a5b5d8232137b6d4e0f7b7b03896f6ac7e HEAD` passed before and after refreshing `origin/main`. The worktree inventory showed no second checkout of `ci-efficiency-security` and no unaccounted writer in this worktree.

## Authority and stop boundaries

Authorized: Plan A local repository edits, focused commits, deterministic local verification, one bounded independent read-only review, and evidence-backed repairs.

Not authorized: Plan B, push, pull request, merge, workflow dispatch, deployment, publication, certification transition, provider or credential access, GitHub settings changes, production action, external messages, or review-comment responses.

The current Plan A baseline keeps `standards@0.3.0` pending. The separate clean Task 6D candidate is frozen at `standards-certification@3b930c63d920b3c12c450c9598ff8ca36fdbcc01`. It descends from Task 6C revision `12ecc73a8337ab12ece9dd3a6b2aec03f940383c`, but accepted `main@4e7e68a5b5d8232137b6d4e0f7b7b03896f6ac7e` is not its ancestor. Task 6D reached its own final-diff stop gate but remains unapproved and unintegrated. Plan A will not modify, rebase, copy, approve, integrate, or certify that candidate. If Plan A integrates first, reconciliation and renewed affected evidence occur only during resumed Task 6D on a descendant of the accepted Plan A revision.

## Direct-predecessor acceptance

The direct predecessor is the Dependabot-compatible action-pin policy change at `4e7e68a5b5d8232137b6d4e0f7b7b03896f6ac7e`, on top of accepted pending-Changeset repair `2b0624c3448d569d68bad93edd8821c48fb432cb`.

- Explicit human authority: continuing the approved Plan A accepts its exact named predecessor and requires this gate.
- Signature: GitHub's commit API reports the SSH signature as verified with reason `valid`.
- Integration path: direct linear commit on `main`; no associated pull request and no pull-request-review claim.
- Rules: both current active repository rulesets require signatures and pull requests and expose explicit always-bypass actors. GitHub accepted the signed direct commit on `main`; this is the configured direct-integration path. No setting was changed during preflight.
- Reconciliation: local `main` and refreshed `origin/main` both resolve to the exact accepted revision.
- Hosted evidence: push run `31605329575` passed `Repository quality / builder-and-packages` for the exact revision.

The predecessor packet now records this post-integration outcome instead of retaining a pending gate.

## Current automatic workflow contracts

| Workflow | Trigger and path ownership | Stable job before Plan A | Security and cache state |
| --- | --- | --- | --- |
| `.github/workflows/repository-quality.yml` | Every pull request and push to `main`; no workflow-level path filter | `builder-and-packages` | `contents: read`; checkout `3d3c42e5aac5ba805825da76410c181273ba90b1`; pnpm setup `84cb39b217b10273981911c288cd62326dc7c6d2`; credential persistence disabled; full history; fixed Ubuntu/Node/pnpm; timeout 30; cancellation; frozen install; `cache: true` |
| `.github/workflows/generated-project-quality.yml` | Pull requests and `main` pushes changing its workflow, `.gitattributes`, `.npmrc`, root workspace manifests/lockfile, CLI, builder-core, observability, standards, retained fixtures, fixed verifier, or generated-fixture tests | `generated-projects` | Same read-only checkout/setup pins; credential persistence disabled; timeout 45; cancellation; frozen install; `cache: true` |
| `.github/workflows/compatibility-proof-quality.yml` | Pull requests and `main` pushes changing its workflow, `.npmrc`, root workspace manifests/lockfile, standards, or the proof tree | `compatibility-proof` | Same read-only checkout/setup pins; credential persistence disabled; timeout 45; cancellation; frozen install; `cache: true` |

Workflow-level path filtering can leave a required workflow check pending when no run is created. Plan A therefore keeps one always-created workflow and moves applicability to job-level conditions. GitHub documents that a job skipped by `jobs.<job_id>.if` reports success, preserving stable check identities without claiming that skipped work executed.

The consolidated workflow will keep the exact current action repositories and immutable full SHAs for checkout and pnpm setup. The new dependency-review job will initially bind official `actions/dependency-review-action@a1d282b36b6f3519aa1f3fc636f609c47dddb294`; the upstream commit exists in the official repository, is GitHub-verified, and identifies the `v5.0.0` release merge. Policy tests will continue to require the exact repository plus a full lowercase 40-hex SHA without encoding one release-specific value.

No root workflow currently persists Next.js, OpenNext, Playwright, or browser-binary caches. The only reusable workflow cache is `pnpm/setup` with `cache: true` in the three root quality workflows. The generated workflow template already uses `cache: false`. Plan A standardizes ordinary root and generated quality paths on `cache: false`, does not add `actions/cache`, and does not cache Playwright browsers. Playwright's current CI guidance does not recommend browser-binary caching because restore time is comparable to downloading and Linux system dependencies are not cacheable. Next.js documents CI build caching, but the current Turbopack production filesystem cache remains opt-in/experimental; Plan A does not introduce it.

## Generated and proof verification contracts

The canonical generated workflow template is `packages/builder-core/templates/common/.github/workflows/quality.yml.template`. It triggers for every pull request and push to `main`, is read-only and credential-free, uses the same immutable checkout/setup pins, already sets `cache: false`, and runs frozen install, lint, typecheck, unit, component, Next build, OpenNext build, explicit Chromium installation, development Playwright, preview Playwright, and failure-only artifact upload through pinned `actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a`.

Current generated root verification runs `pnpm run build` and then `pnpm run build:cloudflare`. The compiled generation verifier and fixed-root verifier likewise run a Next build and then the standalone `build:cloudflare` command. Current proof `verify` runs Next build followed by `build:cloudflare`, while preview Playwright starts `pnpm preview`; that public preview script performs another OpenNext build before starting preview.

OpenNext documents that its ordinary `build` command first invokes the project's Next build and supports `build --skipNextBuild` when prepared `.next` output already exists. Plan A therefore preserves standalone `build:cloudflare` and `preview` commands but changes only ordered verification paths to one Next build, one direct OpenNext `--skipNextBuild` transform, and direct preview from prepared `.open-next` output.

The first direct proof transform established that OpenNext's ordinary combined build privately enables standalone output and workspace-root tracing before invoking Next, while `--skipNextBuild` requires the caller's preceding Next build to have emitted that same prepared artifact. Plan A therefore added explicit standalone workspace-root tracing to the canonical proof and generated Next configuration. The exact newly required source paths are `proofs/nextjs-cloudflare/next.config.ts` and `packages/builder-core/templates/common/apps/web/next.config.ts`; production regeneration derived the matching `apps/web/next.config.ts` bytes and state fingerprints in the portfolio, portfolio-with-Calendly, and site fixtures. These five paths are directly caused by the approved one-build transform and are now included in the plan inventory.

## Existing hosted evidence

- Task 6C merge revision `12ecc73a8337ab12ece9dd3a6b2aec03f940383c`: repository run `31593552115`, generated-project run `31593552026`, and compatibility-proof run `31593552166` all passed.
- Accepted predecessor `4e7e68a5b5d8232137b6d4e0f7b7b03896f6ac7e`: repository run `31605329575` passed. Its policy-test-only diff did not match the two path-scoped deep workflows.

These historical runs prove their exact hosted revisions and old workflow topology only. Plan A does not dispatch hosted CI, and local checks will not prove the consolidated workflow executed on GitHub.

## Capability subject materiality

Accepted `main` records:

```text
standards descriptor: 0.3.0
behavior-contract digest: sha256:be53fdace61b6782e7f0abbbc0af7c333f81122f3a62fcfc7eb0ac687b2ff2fb
required evidence: fresh-scaffold
status: pending
```

The standards descriptor declares the generated quality workflow and preview configuration as managed file surfaces and checks their presence through file probes. It does not hash workflow/configuration bytes into the descriptor, encode pnpm cache settings, or encode the OpenNext/preview command strings changed by Plan A. The descriptor's package properties, probes, dependencies, environment variables, privileged operations, verification-plan identifiers, and required evidence remain unchanged.

Decision: Plan A is an operational optimization of already declared managed surfaces, not a material capability-definition change. Descriptor version `0.3.0`, required evidence `fresh-scaffold`, and behavior-contract digest `sha256:be53fdace61b6782e7f0abbbc0af7c333f81122f3a62fcfc7eb0ac687b2ff2fb` remain unchanged. Generated fingerprints and the evidence produced from those bytes do change, so the frozen Task 6D candidate must be reconciled and its affected evidence renewed later; that need does not create a new standards subject.

Accepted `main` also records `deployment-cloudflare@0.2.0` with required evidence `cleanup-recovery`, `deployed-application`, and `fresh-scaffold`, behavior-contract digest `sha256:846ae45d15ba9d8f256a9b7a1d8a4f3cda1b871a3b3f79f7656fd621050e8273`, and status `backfill-pending`. That capability canonically owns `apps/web/next.config.ts` and its Next/OpenNext verification plan. The explicit `output: "standalone"` and workspace-root `outputFileTracingRoot` make the caller-prepared Next artifact equivalent to the standalone/tracing preparation OpenNext's combined command already applies internally; they add no managed path, dependency, platform resource, adapter semantic, inference probe, verification identifier, evidence kind, provider, binding, environment variable, or deployment authority. The descriptor, required evidence, and their computed canonical subject are therefore unchanged. Decision: this is a non-material preparation-order repair for the existing deployment capability, so its accepted legacy backfill subject remains exact and no new certification task or status transition is created. The local proof and fixed-root matrices validate the changed build order but do not certify or deploy `deployment-cloudflare`.

## Preparation checks

Executed with Node `22.23.2` and pnpm `11.20.0`:

| Command | Result |
| --- | --- |
| `pnpm run check:capability-certification` | Passed; admission; 7 records |
| `pnpm run test:capability-certification` | Passed; 20/20 |
| `pnpm run test:constitution` after canonical sequencing reconciliation | Passed; 53/53 |
| `pnpm run check:semantic-naming` | Passed |
| `pnpm audit --audit-level moderate` | Passed; no known vulnerabilities |
| `pnpm audit signatures` | Passed; 885/885 registry signatures verified |

These checks establish registry consistency, local certification contracts, and point-in-time registry advisory/signature results. They do not certify standards, prove hosted execution, or establish general supply-chain security.

## Primary-source decisions

- GitHub job conditions: <https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-jobs-with-conditions>
- GitHub workflow skips and required-check behavior: <https://docs.github.com/en/actions/how-tos/manage-workflow-runs/skip-workflow-runs>
- GitHub secure workflow use and full-SHA pinning: <https://docs.github.com/en/actions/reference/security/secure-use>
- GitHub dependency review: <https://docs.github.com/en/code-security/concepts/supply-chain-security/dependency-review>
- OpenNext Cloudflare CLI and `--skipNextBuild`: <https://opennext.js.org/cloudflare/cli>
- Next.js Turbopack filesystem cache: <https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopackFileSystemCache>
- Playwright CI browser caching: <https://playwright.dev/docs/ci>

## Expected RED evidence

Task 2's first constitution run must fail because the current tree still has three automatic workflow files, lacks the `scope` and `dependency-review` jobs, uses workflow-level path filters for the deep lanes, and keeps `cache: true` in root quality setup. It must not fail for unrelated predecessor or Task 6D drift.

Task 4's focused runs must fail because the proof, generated root verification, compiled verifier, fixed-root verifier, and preview configurations still route through standalone commands that rebuild already prepared Next/OpenNext output. They must preserve public standalone script compatibility and all unit, component, browser, artifact, state-last, and bounded-execution contracts.

## Recovery and claim limits

Before integration, recovery is focused newest-first reversion of Plan A commits after `4e7e68a5b5d8232137b6d4e0f7b7b03896f6ac7e`. Restore the two path-scoped workflow files together with the previous repository workflow; restore previous proof/generated verification commands; regenerate all retained fixtures from reverted production templates; restore the pending certification plan and canonical documentation. Do not use, mutate, or discard the frozen Task 6D branch as a recovery mechanism.

Local static, Node, build, workerd, and Chromium checks cannot prove GitHub-hosted execution, repository required-check configuration, dependency-review service availability, deployment, provider behavior, production safety, performance, visual quality, human usability, assistive-technology compatibility, or WCAG conformance. Those remain separate evidence and authority domains.
