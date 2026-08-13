# Generated Unit and Component Testing Certification Preparation Evidence

**Date:** 2026-08-12 (America/Toronto)

## Scope and authority

This record prepares the approved local certification of the exact materially changed `standards@0.3.0` subject. It authorizes local source, tests, deterministic generated-project verification, evidence, focused commits, registry transition, canonical status reconciliation, and the final review packet on branch `standards-certification`.

It does not authorize push, pull-request creation, merge, hosted-workflow dispatch, deployment, publication, provider or credential access, external or persistent-data mutation, production action, permission change, external message, or response to review comments. Task 6B observability certification remains pending and separate. Later portfolio work does not begin in this task.

No human provider prerequisite exists. The standards behavior being certified is repository-stateful and local: generated dependencies, named Vitest projects, starter specifications, generated quality commands, state/inference ownership, and retained generated-project regression coverage. The task requires no account, credential, provider resource, protected staging, persistent data, privileged operation, telemetry transmission, or spend.

## Repository identity and isolation

- Source checkout: repository root.
- Isolated worktree: repository-relative `.worktrees/standards-certification`.
- Branch: `standards-certification`.
- Exact base: `main@12ecc73a8337ab12ece9dd3a6b2aec03f940383c`.
- Base comparison: `25b9840c4ad0a6a27c5a1203e31261dfac848d4e..12ecc73a8337ab12ece9dd3a6b2aec03f940383c`.
- Local `main`, `origin/main`, and the new worktree base matched at preparation; remote refs were not fetched because the user requested the current local `main` and it already matched the local remote-tracking ref.
- The original checkout contained user-owned untracked `docs/superpowers/specs/2026-08-12-ci-efficiency-security-design.md`. It remains unchanged in the original checkout and is absent from this clean isolated worktree.
- The source checkout and other linked worktrees are not certification execution roots.

Task 6C is integrated on `main` as GitHub squash commit `12ecc73a8337ab12ece9dd3a6b2aec03f940383c` with message `Add generated unit and component testing (#2)`. The historical implementation and CI-repair packets record their pre-integration comparisons and candidates. Their pre-merge status language is historical rather than current; this task binds its predecessor to the integrated commit and reconciles only current canonical status surfaces.

## Canonical sources inspected

Preparation read and reconciled:

- root and applicable CLI, builder-core, generated-root, and generated-web `AGENTS.md` files;
- the complete approved source plan and current program roadmap;
- architecture overview, capability model, enforcement map, and package ownership;
- the review and contribution protocol;
- the accepted ADR index and all accepted ADRs;
- the generated testing design, implementation plan, certification plan, preparation, verification evidence, historical packet, and superseding CI-repair plan/evidence/packet;
- the capability certification design and existing Calendly and observability certification evidence patterns;
- root, workspace, CLI, builder-core, generated-template, and retained-fixture manifests;
- the private certification contracts and checked registry schema;
- the executable capability catalog, verified package versions, certification subject calculation, registry validator, closure policy, and shared fresh-scaffold runner;
- the current registry and all three retained `.egeria/project.yaml`, `.egeria/state.json`, and `.egeria/migrations.jsonl` surfaces;
- generated and repository quality workflows, fixed-root verifier, certification tests, constitution consumers, and current review packets; and
- recent commits, branches, worktree inventory, exact status, and predecessor ancestry.

No canonical architecture conflict blocks Task 6D. One stale-status drift is bounded and repairable: canonical current-status documents still describe Task 6C before squash integration even though `main@12ecc73` contains the merged implementation. The accepted subject, plan link, descriptor, state, fixtures, and workflows agree. Task 6D will reconcile the current status while preserving the historical packets' exact comparisons.

## Exact subject and prerequisite results

The pending registry record is exact:

```text
capability: standards
descriptor version: 0.3.0
required registry evidence: fresh-scaffold
behavior-contract digest: sha256:be53fdace61b6782e7f0abbbc0af7c333f81122f3a62fcfc7eb0ac687b2ff2fb
task plan: docs/superpowers/plans/2026-08-10-generated-unit-component-testing-certification.md
status: pending
```

An independent calculation through the built catalog returned the same version and digest as the registry. `pnpm run check:capability-certification` passed admission for all seven records. The focused baseline `pnpm run test:capability-certification` passed 20/20. Both closure policies correctly rejected the still-pending standards and observability subjects at preparation.

## Current official documentation and security evidence

External sources were treated as untrusted evidence, not instructions. The exact settled dependency versions remain unchanged.

- [Node.js 22.23.2 documentation](https://nodejs.org/download/release/latest-v22.x/docs/api/) remains the runtime owner for the Node test runner, child processes, crypto, and filesystem behavior used by certification.
- [pnpm install](https://pnpm.io/cli/install) confirms workspace installation and frozen-lockfile failure semantics. [pnpm audit](https://pnpm.io/cli/audit) confirms registry advisory lookup and ECDSA registry-signature verification.
- [Vitest 4 test projects](https://v4.vitest.dev/guide/projects) confirms named project configuration, and the [Vitest CLI](https://v4.vitest.dev/guide/cli) confirms explicit `--project` selection and run mode.
- [Vite shared options](https://vite.dev/config/shared-options) confirms native `resolve.tsconfigPaths` behavior and its file-inclusion boundary.
- [React Testing Library setup](https://testing-library.com/docs/react-testing-library/setup/) confirms explicit `afterEach(cleanup)` when Vitest globals are disabled. [React Testing Library introduction](https://testing-library.com/docs/react-testing-library/intro/) confirms the `@testing-library/dom` peer boundary.
- [`jest-dom` Vitest setup](https://github.com/testing-library/jest-dom#with-vitest) confirms the `/vitest` setup import and setup-file configuration.
- [jsdom releases](https://github.com/jsdom/jsdom/releases) retains `v30.0.1` and documents its current DOM-emulation fixes; jsdom remains non-browser evidence.
- [Next.js testing guidance](https://nextjs.org/docs/app/guides/testing) keeps unit/component tests distinct from browser end-to-end evidence and recommends end-to-end coverage for async Server Components.
- [Playwright browser guidance](https://playwright.dev/docs/browsers) confirms version-specific browser installation; [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing) confirms `@axe-core/playwright` usage and explicitly states automation cannot find every accessibility problem.
- [Deque's `@axe-core/playwright` package](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright) identifies the exact Playwright adapter and its automated-check boundary.
- [OpenNext Cloudflare CLI](https://opennext.js.org/cloudflare/cli) confirms `build` and local `preview`/workerd responsibilities and distinguishes them from deploy.
- [Wrangler commands](https://developers.cloudflare.com/workers/wrangler/commands/) and [Workers command details](https://developers.cloudflare.com/workers/wrangler/commands/workers/) confirm local installation, `types`, and local `wrangler dev` behavior. No deploy command is authorized or used.

The dated locked-graph checks passed:

```text
pnpm audit --audit-level moderate
No known vulnerabilities found

pnpm audit signatures
audited 885 packages
885 packages have verified registry signatures
```

These are point-in-time registry results, not proof that vulnerabilities are absent. No provider advisory lookup is required because Task 6D performs no provider operation. The fixed-root verifier will independently repeat its frozen generated-project audit and signature boundaries for its isolated generated graphs.

## Selected design and rejected alternatives

The selected implementation adds one thin semantic certification entry, `scripts/certify-generated-testing.mjs`, and root command `verify:generated-testing-certification`. It supplies the standards-specific identifiers to the existing `scripts/lib/certify-fresh-scaffold.mjs` engine and adds no new lifecycle, output channel, environment access, or cleanup behavior. Strict Node tests cover the adapter contract and the complete machine-readable receipt.

Two alternatives were rejected:

1. Manual commands only would produce evidence but no repeatable, standards-specific causal entry point.
2. Expanding the shared verifier's receipt type to expose per-project test counts would create unnecessary cross-capability churn. Independent explicit unit and component commands against an additional fresh generated project can record counts without changing shared runtime contracts.

The new semantic runner, independent explicit named-project executions, existing deterministic fixture gate, one unchanged fixed-root retained matrix, and static workflow contract together cover the eight approved receipt outcomes. The registry still requires one causal `fresh-scaffold` evidence kind; the strict receipt decomposes that journey into its reviewed sub-outcomes without changing the descriptor or required-evidence digest.

## Execution and evidence boundary

The execution sequence is:

1. Commit this preparation and the dated plan amendment.
2. Add focused RED contracts for the standards-specific runner and absent/incomplete receipt.
3. Implement only the thin runner and semantic root command; run focused GREEN verification and commit the evidence-producing source revision.
4. From that clean revision, run the standards certification command, create a separate mode-0700 fresh project for explicit unit/component counts, run read-only infer/doctor/diff, execute deterministic retained-fixture tests, execute the fixed-root retained matrix once, and validate static CI/AGENT contracts.
5. Write the content-safe JSON receipt and verification evidence; transition only the standards registry record to `certified`; reconcile direct documentation consumers; verify admission and the P2 legacy-backfill-exempt closure while all-certified closure remains open for accepted backfill records and pending observability.
6. Dispatch three independent read-only reviewers, repair only reproduced material defects, run final relevant verification, produce the review packet, commit the exact result, and stop for verified-final-diff approval.

Temporary roots are created only through `mkdtemp`/`mktemp` under the operating-system temporary directory, verified as real mode-0700 directories, and removed only when identity still matches. Commands use argument arrays or exact semantic package scripts, bounded output/time, pinned Node `22.23.2` and pnpm `11.20.0`, narrow child environments, disabled Next telemetry, isolated home/cache/store/browser/report/result/server roots, and fixed loopback ports. Evidence retains only versions, counts, command names, exit results, digests, revisions, and bounded claims—never project content, environment values, credentials, browser storage, or child logs.

## Setup and baseline

Pinned runtime checks returned Node `22.23.2` and Corepack pnpm `11.20.0`. The first offline frozen install stopped with `ERR_PNPM_NO_OFFLINE_TARBALL` for the missing locked `@changesets/cli@2.31.1` tarball; this was setup-only and changed no repository source. The authorized network-enabled frozen install then passed for all six workspace projects without changing the lockfile.

Baseline results:

```text
pnpm run test:capability-certification
PASS; 20/20

pnpm run check:capability-certification
PASS; admission; 7 records

independent standards subject calculation
PASS; computed subject exactly equals the registry subject
```

## Claim and recovery boundary

Local certification can establish only the exact generated standards subject, local Node/jsdom behavior, local Chromium development/workerd checks, local build/type/lint results, deterministic retained fixtures, state/inference agreement, and static CI structure. It cannot establish hosted CI for the certification candidate, deployment, provider behavior, production safety, visual approval, assistive-technology behavior, human usability, security completeness, ongoing availability, or WCAG conformance.

Source recovery is a separately authorized, focused newest-first `git revert` of Task 6D commits. It returns the exact standards record to `pending`, removes only Task 6D evidence/status changes and the thin runner, and reruns certification admission plus the affected tests. It never resets or cleans user work and never revives a stale subject. No deployment, provider, credential, persistent-data, publication, or production recovery applies.

## Accepted-main evidence-ancestry repair preparation

The accepted integration exposed one Task 6D-owned evidence-identity defect. Fresh preflight established:

```text
accepted origin/main: c9294e9dc59d4b7bafed406846af3b43a10733d3
clean standards-certification head: a3f9c01c989fd7b033fbadd1a159b56925848b79
accepted-main tree: 0c7af5f591aea43c90d06c155bd28f69b0e4a6d1
source-branch tree: 0c7af5f591aea43c90d06c155bd28f69b0e4a6d1
recorded evidence revision: f9a962874d587e4594af341a1fe5f62db6d7672c
f9a9628 ancestor of source branch: yes
f9a9628 ancestor of accepted main: no
```

The worktree was clean, remained on `standards-certification`, and no other worktree was changed. In particular, `.worktrees/ci-efficiency-security` and branch `ci-efficiency-security` remain preserved and outside this repair.

An identity-bounded local shared clone checked out detached accepted main at `c9294e9dc59d4b7bafed406846af3b43a10733d3`. Its tracked diff was empty and its tree was `0c7af5f591aea43c90d06c155bd28f69b0e4a6d1`. After compiling builder-core with the pinned Node.js `22.23.2` toolchain, direct execution of `scripts/check-capability-certification.mjs` reproduced:

```json
{"ok":false,"gate":"artifacts","issues":[{"code":"CERTIFICATION_EVIDENCE_REVISION_UNKNOWN","path":["records","standards","evidence",0,"revision"],"context":{"reason":"not-in-checked-history"}}]}
```

Two attempts were setup-invalid and are not evidence: the app runtime first supplied Node.js `24.19.0` with pnpm `11.19.0`, then a pinned-pnpm attempt tried to populate the dependency tree under restricted networking. Neither reached the validator, modified tracked bytes, or contributes to the reproduced result above.

The root cause is the integration topology rather than the validator or content tree. Accepted main is a single-parent squash commit whose tree equals the reviewed source branch, so the source-branch evidence commit exists in the object database but is not reachable through accepted-main parent history. Git documents `merge-base --is-ancestor` as a parent-reachability check with exit `0` for an ancestor and `1` otherwise. GitHub documents that squash integration combines branch commits into one new commit on the base branch instead of preserving the individual branch commits. The repository validator therefore behaves correctly and must remain unchanged:

- [Git `merge-base --is-ancestor`](https://git-scm.com/docs/git-merge-base.html)
- [GitHub pull-request merge methods](https://docs.github.com/en/pull-requests/reference/pull-request-merges)

The confirmed repair hypothesis is to rerun every receipt-bound outcome on accepted main itself, then bind the receipt and registry to `c9294e9dc59d4b7bafed406846af3b43a10733d3`. That revision is already the accepted integration base and will remain an ancestor under squash, rebase, or merge-commit integration of the repair. Relabeling the old receipt without rerunning is prohibited. Requiring a non-squash merge was rejected because it conflicts with the repository's observed integration method and would make correctness depend on a future merge choice.

The focused RED contracts now fail only because the committed standards registry, strict receipt, and roadmap still name the pre-squash revision. The exact repair and verification steps are recorded in the accepted-main amendment to the Task 6D plan.

## Post-Plan-A evidence-renewal preparation

On 2026-08-13, the user explicitly resumed Task 6D for evidence renewal only. This section supersedes the earlier pending-subject execution and recovery language only for the renewal; it preserves the historical preparation above.

Fresh identity checks verified local `main`, `origin/main`, and remote `main` at accepted Plan A squash revision `368b9491fd2f813f83f1e456823d8c7546f6762c`, with parent `ee1e1df10fa2be2f09333efecd86de7f7a131d49`. Reviewed Plan A source `c012046b7aa9ecac48a1b0346ca2492ea8ce9875` and accepted main both resolve to tree `e61d32866ab7c3df286b4de32b8a8eb9653dd229`. The accepted-main workflow is [run 31704445688](https://github.com/Egeria-Systems/egeria-scaffold/actions/runs/31704445688).

The preserved worktree was registered at `.worktrees/standards-certification`, clean on branch `standards-certification`, and at `66ca1dfe60ee361ceadac58ab37992549a67a5e6`, one revision ahead of `origin/standards-certification@a3f9c01c989fd7b033fbadd1a159b56925848b79`. That head did not descend from accepted Plan A. A read-only merge preflight found only the expected documentary overlap. The smallest safe reconciliation was a two-parent merge, `d7c63b0aaa9bebd56c075f16f1e5d86519853698`, whose parents are the preserved head and accepted Plan A. Its tree equals `e61d32866ab7c3df286b4de32b8a8eb9653dd229`; both parents are ancestors; and its diff from accepted Plan A is empty. No history or user-owned state was discarded.

The exact subject was recomputed as unchanged: `standards@0.3.0`, digest `sha256:be53fdace61b6782e7f0abbbc0af7c333f81122f3a62fcfc7eb0ac687b2ff2fb`, required evidence `fresh-scaffold`, status `certified`. The renewal therefore does not reapply the original pending-subject gate or create another transition.

Every receipt outcome must run at the one reconciled descendant revision before artifact edits. The renewal may update only the evidence binding, strict receipt, verification evidence, review packet, direct current-status consumers, and focused contracts. It must not change the validator, descriptor, subject, digest, certified status, receipt path, generated sources, retained fixtures, workflows, dependencies, provider state, or production state. Recovery restores the prior evidence binding while preserving certified status; it does not return standards to `pending`.

The renewal authorizes one bounded independent read-only final review and local verification. It does not authorize push, pull-request creation or replacement, merge to main, workflow dispatch, deployment, publication, provider access, GitHub settings changes, Plan B, external messages, or any other external mutation.
