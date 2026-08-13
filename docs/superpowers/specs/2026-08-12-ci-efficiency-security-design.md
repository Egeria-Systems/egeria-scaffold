# CI Efficiency and Security Design

**Date:** 2026-08-12 (America/Toronto)

**Status:** Design approved; Plan A is locally implemented and awaits verified-final-diff approval; Plan B and external actions remain unauthorized

**Initial revalidated baseline:** `4e7e68a5b5d8232137b6d4e0f7b7b03896f6ac7e`

**Reconciled Plan A baseline:** `ee1e1df10fa2be2f09333efecd86de7f7a131d49`

## Goal

Optimize every current GitHub Actions boundary for balanced feedback time and Actions usage without weakening clean-build evidence, test coverage, supply-chain controls, protected deployment authority, capability certification, or package release safeguards.

Redundant builds are removed before reusable state is considered. No planned workflow persists pnpm, browser, Next.js, generated-project, or deployment-output caches.

## Current-main amendment

Current `main` already contains:

- an always-on repository-quality workflow;
- path-scoped generated-project and compatibility-proof workflows;
- the generated-project quality workflow owned by `standards@0.3.0`;
- generated Vitest unit/component projects and their retained-fixture verification;
- weekly npm and GitHub Actions Dependabot configuration; and
- Dependabot-compatible live-workflow tests that require the exact action repository plus an immutable full lowercase 40-hex SHA without freezing one release-specific SHA in test code;
- complete pending-Changeset selection coverage in the private release validator; and
- four manual protected workflows for compatibility deployment, Calendly certification, production-observability certification, and package release.

This design therefore does not create those completed foundations. It consolidates and hardens the automatic root workflows, removes duplicate Next/OpenNext/preview builds, and hardens the existing protected workflows.

Historical implementation evidence remains historical. Canonical current-state documentation and direct workflow/test consumers change prospectively.

## Automatic repository CI

### One workflow, parallel jobs, stable required checks

Consolidate the three automatic root workflows into `.github/workflows/repository-quality.yml`. Delete `.github/workflows/generated-project-quality.yml` and `.github/workflows/compatibility-proof-quality.yml` after their jobs and contracts move intact.

The consolidated workflow triggers on every pull request and push to `main`; it has no workflow-level path filter. It contains:

1. `scope` — validates the base and head revisions and decides whether generated-project and compatibility-proof jobs are applicable;
2. `builder-and-packages` — always runs repository constitution, semantic naming, package boundaries, builder-core, CLI, package, certification, lint, typecheck, and release-intent checks;
3. `generated-projects` — runs when its current owned inputs change;
4. `compatibility-proof` — runs when its current owned inputs change;
5. `dependency-review` — runs for pull requests and rejects newly introduced moderate-or-higher vulnerabilities in development or runtime scopes.

The `scope` job uses full-history checkout and Git pathspecs. Pull requests use `github.event.pull_request.base.sha` and `github.event.pull_request.head.sha`; pushes use `github.event.before` and `github.sha`. Event revisions enter the shell only through environment variables, must be nonzero exact 40-lowercase-hex values, and must resolve locally as commit objects. Missing, zero, malformed, unavailable, or unresolvable revisions enable both deep jobs. Every diff result other than a definitive unchanged result enables the affected job, and any Git resolution or diff error enables both deep jobs. A workflow-file change enables both deep jobs.

Generated-project and compatibility-proof jobs use `jobs.<job_id>.if`, not workflow path filters. Current GitHub documentation states that conditionally skipped jobs report success, while path-filtered required workflows can remain pending. The later separately authorized repository-settings action can therefore require all five stable job names after hosted validation.

No final aggregation job is added. Requiring `scope` prevents a failed scope decision from being hidden by dependent skipped jobs, and requiring each applicable job preserves the most direct failure signal without another billed runner.

### Automatic-workflow security controls

Every job uses:

- `permissions: contents: read` and no broader token permission;
- verified full-SHA action pins;
- `persist-credentials: false` on checkout;
- fixed `ubuntu-24.04`, Node `22.23.2`, and pnpm `11.20.0`;
- frozen installation;
- bounded job timeouts;
- workflow-and-ref concurrency with superseded-run cancellation; and
- no secret, environment, deployment, provider, publication, or production authority.

The dependency-review job uses verified release commit `a1d282b36b6f3519aa1f3fc636f609c47dddb294` for `actions/dependency-review-action@v5.0.0`. The repository is public, so the action is currently available. Dependabot continues to propose weekly npm and GitHub Actions updates without auto-merge.

## Generated-project quality workflow

The generated workflow remains a single job because the generated repositories are small and share one installation. It retains:

- read-only permissions;
- verified full-SHA action pins;
- disabled checkout credentials;
- fixed tool versions;
- frozen installation;
- `cache: false`;
- lint, typecheck, unit, and component steps before Chromium installation;
- separate development and workerd Playwright/axe boundaries; and
- failure-only browser artifacts retained for seven days.

Its OpenNext step transforms the immediately preceding Next build with `opennextjs-cloudflare build --skipNextBuild`. The preview Playwright configuration starts `opennextjs-cloudflare preview` directly against the prepared `.open-next` output instead of invoking the standalone build-and-preview convenience script.

The existing `build:cloudflare` and `preview` package scripts remain unchanged for backward compatibility. Verification paths call the underlying prepared-output commands directly, so current generated-project public commands are not silently redefined.

The compiled generator's project verifier, generated root `verify` script, fixed-root verifier, and generated workflow own this execution order:

1. one Next build;
2. one OpenNext transformation with `--skipNextBuild`;
3. Chromium installation;
4. development browser checks; and
5. workerd preview against the prepared output.

The preview Playwright configuration owns only step 5: it starts workerd preview against already prepared `.open-next` output. The verifier, generated root command, fixed-root verifier, or generated workflow that invokes it owns the preceding Next build, OpenNext transformation, Chromium installation, and development-browser checks.

The workflow and preview configuration are already managed `standards` surfaces. No new capability surface, public package API, dependency, environment variable, or evidence kind is introduced. Accepted `main@ee1e1df10fa2be2f09333efecd86de7f7a131d49` records `standards@0.3.0` as certified through the reviewed eight-outcome receipt rerun at accepted-main evidence revision `c9294e9dc59d4b7bafed406846af3b43a10733d3`. Plan A does not change that subject, digest, receipt, registry entry, or status. If Plan A is accepted and integrated, the separate standards-certification stream must renew affected operational evidence on a descendant using the optimized commands and no-cache contract. If implementation preflight finds that the canonical behavior-contract digest must change, implementation stops for a descriptor/certification plan amendment rather than inheriting the old subject.

## Compatibility proof verification

The proof keeps its standalone `build:cloudflare` and `preview` scripts. Its aggregate verification and automatic CI instead run:

1. `next build`;
2. `opennextjs-cloudflare build --skipNextBuild`;
3. generated type and workerd harness checks;
4. browser installation;
5. development browser checks; and
6. direct `opennextjs-cloudflare preview` under Playwright.

The manual compatibility workflow consumes that prepared output and its deploy-only command remains prohibited from building under Cloudflare credentials.

## Cache decision

### `.next/cache` is rejected

No root, generated, proof, certification, or release workflow restores or saves `.next/cache`.

The repository pins Next.js 16.3.0 with Turbopack, whose exact package source enables filesystem caching for production builds by default. The repository's clean jobs and identity-bounded copies still do not restore or save `.next/cache` across runs. Enabling meaningful cross-run reuse would add an unsigned GitHub cache to small, clean-build evidence paths and require an explicit cache-identity and invalidation contract.

That trade is rejected because:

- duplicate builds can be removed deterministically;
- the fixed-root verifier intentionally exercises identity-bounded clean copies;
- shared generated caches complicate fixture identity and evidence isolation;
- GitHub caches are unsigned and restored as untrusted input; and
- cache transfer has already been comparable to or slower than frozen installation in this repository.

Reconsideration requires a separate approved design after hosted data shows compilation remains a material bottleneck after deduplication and that design establishes safe cache identity, trust, and invalidation boundaries.

### All other reusable caches are rejected

Set pnpm setup to `cache: false` in every workflow. Do not cache:

- pnpm stores or `node_modules`;
- Playwright browsers or operating-system packages;
- `.next`, `.open-next`, generated repositories, or deployment candidates;
- temporary home, registry, configuration, browser, report, or server state;
- receipts or failure artifacts as reusable state; or
- credentials, provider configuration, private URLs, logs, personal data, or other sensitive content.

Playwright browser caching remains excluded because Playwright reports that restore time is comparable to download time and Linux dependencies remain uncached.

## Protected workflows

Compatibility, Calendly, production-observability, and package-release workflows remain manual exact-main operations with non-cancelling concurrency.

The three shared deployments retain `test-deploy`, `queue: max`, `cancel-in-progress: false`, protected environment authority, exact Worker identity, step-scoped secrets, exclusive lease, cleanup contract, and content-safe receipts. Package release retains its separate concurrency group, protected `npm-release` environment, exact commit binding, OIDC provenance, registry-absence check, advisory checks, and authentication cleanup.

Hardening changes are:

- align checkout to verified `3d3c42e5aac5ba805825da76410c181273ba90b1`;
- align pnpm setup to verified `84cb39b217b10273981911c288cd62326dc7c6d2`;
- set `cache: false` in all four workflows;
- add exact approved-revision input, validation, exact checkout, disabled credential persistence, and a 45-minute timeout to compatibility deployment; and
- add a 30-minute timeout to package release.

Calendly and observability retain their current 45- and 60-minute timeouts. No cross-job candidate artifact or digest layer is added: the verified output remains in one isolated job, no untrusted step mutates it before deployment, and credential-bearing steps are already contractually forbidden from building or testing.

Cache removal, action-pin alignment, exact-revision validation, and timeouts do not change generated application behavior or evidence kinds. Static workflow contracts and local proof verification are required; protected workflows are not dispatched merely to validate these metadata and setup changes. If a capability subject/digest check rejects the change, stop rather than relabel historical evidence.

## Delivery sequence

### Plan A — automatic CI and build deduplication

Plan A owns the consolidated automatic workflow, dependency review, generated/proof prepared-output commands, retained fixture regeneration, current-state documentation, and the future standards evidence-renewal amendment. It does not own the renewal execution or any certification transition.

It uses focused RED/GREEN workflow and command-graph contracts, production fixture generation, the complete builder-kernel verifier once, and hosted automatic workflow validation only after separate push authority.

### Plan B — protected workflow hardening

Plan B owns only the four manual workflows, direct constitution/release contracts, current compatibility record, and its review/evidence artifacts. It does not dispatch, deploy, certify, publish, or alter GitHub settings.

The plans have separate comparisons and approval gates. Plan A should land first because Plan B's compatibility workflow consumes the deduplicated proof verification path, but approval of either plan does not authorize the other.

## Verification and review

For each plan:

1. verify branch, status, exact base, worktrees, canonical owners, and certification state;
2. write focused tests first and observe only the intended RED failures;
3. implement the smallest coherent change;
4. run focused GREEN checks;
5. regenerate generated files only through production generation in identity-bounded temporary roots;
6. run the complete relevant suite once on the settled tree;
7. obtain one bounded independent read-only reviewer that returns three separately labeled, non-overlapping reports covering requirements, architecture/anti-overengineering, and test evidence;
8. repair only validated material findings and rerun affected checks;
9. record exact commands, results, files, risks, claims, and recovery; and
10. stop for verified-final-diff approval.

Static workflow inspection does not prove hosted execution. Local execution does not prove deployment, provider delivery, publication, visual quality, human usability, assistive-technology compatibility, or WCAG conformance.

## Completion criteria

- The automatic workflow has stable always-triggered job names and no workflow path filter.
- Scope decisions validate revisions and fail safe to running deep jobs.
- All automatic and protected workflows use reviewed full-SHA actions, disabled checkout credentials, frozen installs, bounded timeouts, and `cache: false`.
- Ordinary CI has no secret, environment, write, provider, deployment, publication, or production authority.
- Compiled-generator, generated, and proof verification perform one Next build and one OpenNext transformation per candidate.
- Preview tests use the prepared output without rebuilding.
- Existing standalone generated/proof build and preview scripts remain compatible.
- Protected workflows preserve revision, environment, lease, secret, receipt, cleanup, provenance, and non-cancellation controls.
- Templates, fixtures, state fingerprints, certification planning, documentation, and direct contracts agree.
- Focused and complete local verification pass, material review findings are resolved, and external claims remain separate.

## Recovery

Recovery uses focused newest-first reverts:

- revert the consolidated automatic workflow and restore the two scoped workflow files with their direct contracts;
- revert prepared-output commands, regenerate all retained fixtures through production generation, and preserve the exact certified standards subject and accepted receipt;
- revert protected workflow metadata and direct tests without dispatching or changing external state; and
- reverse branch protection, environments, credentials, deployments, providers, or publication only through separately authorized external recovery.

Historical receipts remain bound to the workflow, revision, and subject that produced them.

## Non-goals

This design does not authorize or add a push, pull request, merge, workflow dispatch, deployment, certification transition, publication, branch-protection change, environment mutation, provider mutation, production action, self-hosted runner, remote build cache, workflow-level path filter, cross-job build artifact, `.next/cache`, dependency-tree cache, browser cache, or reduced evidence boundary.

## Current primary-source basis

- [GitHub required-check troubleshooting](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks) distinguishes pending path-filtered workflows from successful conditionally skipped jobs.
- [GitHub job conditions](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-jobs-with-conditions) documents skipped-job success behavior.
- [GitHub dependency caching](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching) documents unsigned cache contents, scope, pull-request access, poisoning risk, and storage behavior.
- [GitHub secure use](https://docs.github.com/en/actions/reference/security/secure-use) recommends full-SHA pins and least privilege.
- [GitHub dependency review](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/manage-your-dependency-security/configure-dependency-review-action) documents pull-request vulnerability enforcement.
- [Next.js CI build caching](https://nextjs.org/docs/pages/guides/ci-build-caching) documents `.next/cache` as an available optimization.
- [Next.js 16.3.0 configuration source](https://github.com/vercel/next.js/blob/v16.3.0/packages/next/src/server/config-shared.ts) records production-build filesystem caching as enabled by default.
- [OpenNext Cloudflare CLI](https://opennext.js.org/cloudflare/cli) documents `build --skipNextBuild` and separate preview/deploy consumption of built output.
- [Playwright CI](https://playwright.dev/docs/ci) advises against browser-binary caching.
