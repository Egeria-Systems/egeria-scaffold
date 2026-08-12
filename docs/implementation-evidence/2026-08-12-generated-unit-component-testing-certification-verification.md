# Generated Unit and Component Testing Certification Verification Evidence

**Date:** 2026-08-12 (America/Toronto)

**Status:** All eight approved local certification outcomes were rerun successfully at accepted `main` and independently reviewed; the evidence-ancestry repair awaits verified-final-diff and integration approval

**Planning base:** `12ecc73a8337ab12ece9dd3a6b2aec03f940383c`

**Accepted main and evidence revision:** `c9294e9dc59d4b7bafed406846af3b43a10733d3`

**Task 6D source revision:** `a3f9c01c989fd7b033fbadd1a159b56925848b79`

**Shared tree:** `0c7af5f591aea43c90d06c155bd28f69b0e4a6d1`

**Certification capability:** `standards`

**Certification descriptor version:** `0.3.0`

**Certification behavior-contract digest:** `sha256:be53fdace61b6782e7f0abbbc0af7c333f81122f3a62fcfc7eb0ac687b2ff2fb`

**Certification evidence revision:** `c9294e9dc59d4b7bafed406846af3b43a10733d3`

**Passed certification outcomes:** `fresh-scaffold, unit-tests, component-tests, state-agreement, generated-project-builds, browser-regression, retained-fixture-matrix, ci-contract`

**Reviewed certification outcomes:** `fresh-scaffold, unit-tests, component-tests, state-agreement, generated-project-builds, browser-regression, retained-fixture-matrix, ci-contract`

**Certification receipt status:** `complete`

**Certification reviewer decision:** `accepted`

**Certification unresolved prompts:** `none`

## Defect and evidence boundary

Accepted `origin/main` was `c9294e9dc59d4b7bafed406846af3b43a10733d3`. The clean Task 6D branch was `a3f9c01c989fd7b033fbadd1a159b56925848b79`. Both revisions resolved to the same tree, but the original evidence revision `f9a962874d587e4594af341a1fe5f62db6d7672c` was an ancestor only of the source branch. The repository's squash integration therefore preserved the content but not that evidence revision in accepted-main ancestry.

An identity-bounded temporary checkout detached at accepted main reproduced the unmodified admission failure:

```json
{"ok":false,"gate":"artifacts","issues":[{"code":"CERTIFICATION_EVIDENCE_REVISION_UNKNOWN","path":["records","standards","evidence",0,"revision"],"context":{"reason":"not-in-checked-history"}}]}
```

The ancestry validator remains unchanged. Relabelling was rejected because the original evidence had not run at accepted main. Instead, every receipt-bound outcome was rerun in a fresh, identity-bounded checkout at `c9294e9dc59d4b7bafed406846af3b43a10733d3`. The receipt and registry now identify that actual evidence-producing revision.

## Accepted-main evidence rerun

The exact Node.js `22.23.2` and pnpm `11.20.0` toolchain paths were used with `CI=true`. The accepted-main checkout had a clean index and worktree before and after verification and remained detached at the expected revision. Network access was enabled only for package installation, registry audit/signature verification, and browser-backed verification.

| Outcome | Evidence | Result |
| --- | --- | --- |
| `fresh-scaffold` | `pnpm run verify:generated-testing-certification` | Passed the compiled create, inference, doctor, diff, install/audit/signature, lint/type, unit/component, build, and development/preview browser matrix; all 19 checks reported. |
| `unit-tests` | Fresh generated `apps/web`: `pnpm run test:unit` | 1 file and 2 tests passed. |
| `component-tests` | Fresh generated `apps/web`: `pnpm run test:component` | 1 file and 1 test passed under jsdom. |
| `state-agreement` | Compiled CLI `infer`, `doctor`, and `diff` | State was valid, standards `0.3.0` was confirmed, diagnostics were healthy with zero findings, and the diff was equal with zero differences. |
| `generated-project-builds` | Fresh-scaffold fixed verifier | Lint, Cloudflare types, strict typecheck, Next.js build, and OpenNext build passed. |
| `browser-regression` | Fresh-scaffold fixed verifier | Local Next.js development and OpenNext/workerd preview Playwright/axe checks passed. |
| `retained-fixture-matrix` | `pnpm run test:generated-fixtures`; `pnpm run verify:generated-skeletons` | 8 of 8 fixture contracts passed; 47, 52, and 49 byte-stable files were confirmed; the fixed verifier passed for portfolio, Calendly portfolio, and site. |
| `ci-contract` | `pnpm run test:constitution` and static workflow inspection | 53 of 53 constitution tests passed. No hosted run is claimed. |

The bounded fresh-scaffold result was:

```json
{"ok":true,"capability":"standards","version":"0.3.0","profile":"portfolio","checks":["compiled-cli-create","state-inference","healthy-diagnostics","exact-diff","pnpm-version","frozen-install","peer-dependencies","dependency-audit","registry-signatures","lint","cloudflare-types","typecheck","unit-tests","component-tests","next-build","opennext-build","browser-install","browser-development","browser-preview"]}
```

The bounded retained-fixture result was:

```json
{"ok":true,"fixtures":["portfolio","portfolio-calendly","site"],"profiles":["portfolio","site"],"checks":["pnpm-version","frozen-install","peer-dependencies","dependency-audit","registry-signatures","lint","cloudflare-types","typecheck","unit-tests","component-tests","next-build","opennext-build","browser-install","browser-development","browser-preview"]}
```

The separate unit/component/state counts used the production compiled CLI with its documented injected-verifier boundary so that creation did not repeat the already-passed fixed-root verifier. The generated project used the accepted retained portfolio lockfile, installed 758 packages from the frozen lockfile with no downloads, passed the counts above, and returned valid inference, healthy diagnostics, and an equal diff.

## Setup-invalid attempts and cleanup

Two initial accepted-main attempts used an unpinned Node/pnpm pair or lacked required sandbox network authority; they were setup-invalid and are not counted. A later direct create entered sandbox registry retries because it invoked the fixed verifier, and the first retained-fixture run lost its session handle before a network-authorized rerun. Their exact temporary processes were terminated and their identity-bounded roots removed. None contributed evidence.

The recorded runs used the repository-pinned toolchain and necessary network authorization. All evidence checkouts, generated projects, and the one-off injected-verifier helper were removed after their owning revisions, modes, and clean states were verified.

## Ancestry and integration constraint

The evidence revision is accepted main itself, so it is an ancestor of any future integration commit based on that revision or a descendant. The final candidate must be tested as an integration-shaped commit whose parent is accepted main. This is compatible with the repository's observed squash integration method because the receipt references the retained base revision, not a source-branch-only revision.

Integration must not change to an older or unrelated base. If accepted main advances, the integrator must prove `c9294e9dc59d4b7bafed406846af3b43a10733d3` is still an ancestor of the actual integration candidate and rerun admission there. No merge into `main`, push, pull request, workflow, or external action is part of this repair.

One bounded independent read-only reviewer covered requirements, architecture/anti-overengineering, test evidence, ancestry, integration, claims, and recovery. The reviewer reported: `No material improvements recommended.` It confirmed the integration strategy only with the ancestry and exact-candidate admission constraint above; source-branch admission remains expected to fail because accepted main is not its ancestor.

The reviewed repair tree was also applied to a fresh temporary checkout and committed with accepted main as its sole parent. Accepted main was an ancestor; focused certification passed 20 of 20, the owning capability-certification suite passed 24 of 24, admission passed for all seven records, constitution passed 53 of 53, semantic naming passed, and the diff/status checks were clean. The two closure policies produced only their documented expected rejections for pending observability and the four unchanged backfills. The exact final post-packet synthetic identity is reported in the handoff.

## Claim limits and recovery

No workflow was dispatched. No deployment, provider, credential, environment, permission, persistent data, or production system was read or mutated. Passing local Playwright/axe automation does not establish visual quality, human usability, assistive-technology compatibility, or WCAG conformance.

Recovery reverts the registry binding, receipt, verification evidence, review packet, tests, and current-status documentation in newest-first focused changes. If the exact subject remains valid, its record returns to `pending`. No source, dependency, provider, deployment, persistent-data, credential, or production recovery applies.
