# Generated Unit and Component Testing Certification Verification Evidence

**Date:** 2026-08-12; evidence renewed 2026-08-13 (America/Toronto)

**Status:** All eight approved local outcomes were renewed at one post-Plan-A descendant revision and independently reviewed; verified-final-diff approval remains pending

**Accepted Plan A revision:** `368b9491fd2f813f83f1e456823d8c7546f6762c`

**Preserved Task 6D source revision:** `66ca1dfe60ee361ceadac58ab37992549a67a5e6`

**Certification evidence revision:** `d7c63b0aaa9bebd56c075f16f1e5d86519853698`

**Accepted/evidence tree:** `e61d32866ab7c3df286b4de32b8a8eb9653dd229`

**Certification capability:** `standards`

**Certification descriptor version:** `0.3.0`

**Certification behavior-contract digest:** `sha256:be53fdace61b6782e7f0abbbc0af7c333f81122f3a62fcfc7eb0ac687b2ff2fb`

**Passed certification outcomes:** `fresh-scaffold, unit-tests, component-tests, state-agreement, generated-project-builds, browser-regression, retained-fixture-matrix, ci-contract`

**Reviewed certification outcomes:** `fresh-scaffold, unit-tests, component-tests, state-agreement, generated-project-builds, browser-regression, retained-fixture-matrix, ci-contract`

**Certification receipt status:** `complete`

**Certification reviewer decision:** `accepted`

**Certification unresolved prompts:** `none`

## Renewal identity and reconciliation

Fresh local and remote identity checks established:

```text
local main: 368b9491fd2f813f83f1e456823d8c7546f6762c
origin/main: 368b9491fd2f813f83f1e456823d8c7546f6762c
remote main: 368b9491fd2f813f83f1e456823d8c7546f6762c
accepted parent: ee1e1df10fa2be2f09333efecd86de7f7a131d49
reviewed Plan A source: c012046b7aa9ecac48a1b0346ca2492ea8ce9875
accepted/source tree: e61d32866ab7c3df286b4de32b8a8eb9653dd229
preserved branch head: 66ca1dfe60ee361ceadac58ab37992549a67a5e6
preserved remote branch: a3f9c01c989fd7b033fbadd1a159b56925848b79
```

The worktree was clean, registered at the expected path, and on branch `standards-certification`. The reviewed Plan A source and squash commit had byte-identical trees, while the preserved Task 6D head did not descend from accepted Plan A. A conflict preflight identified only the expected documentary overlap. The smallest history-preserving reconciliation was a two-parent merge:

```text
merge: d7c63b0aaa9bebd56c075f16f1e5d86519853698
parents: 66ca1dfe60ee361ceadac58ab37992549a67a5e6 368b9491fd2f813f83f1e456823d8c7546f6762c
tree: e61d32866ab7c3df286b4de32b8a8eb9653dd229
```

Both parents are ancestors of the merge. Its tree is byte-identical to accepted Plan A, and `git diff 368b9491fd2f813f83f1e456823d8c7546f6762c..d7c63b0aaa9bebd56c075f16f1e5d86519853698` is empty. No reset, clean, rebase, history discard, or worktree substitution occurred. The evidence-ancestry validator is unchanged.

The accepted-main workflow at [run 31704445688](https://github.com/Egeria-Systems/egeria-scaffold/actions/runs/31704445688) is Plan A integration evidence. It is not claimed as a hosted Task 6D renewal run.

## Subject continuity

The descriptor and independent catalog calculation still produce:

```text
descriptor version: 0.3.0
behavior-contract digest: sha256:be53fdace61b6782e7f0abbbc0af7c333f81122f3a62fcfc7eb0ac687b2ff2fb
required registry evidence: fresh-scaffold
registry status: certified
```

This renewal does not create a new subject or repeat a pending-to-certified transition. It preserves the receipt path, registry status, subject, digest, attribution, and ancestry validation while replacing only the operational evidence binding and its direct current-status consumers.

## Eight-outcome renewal

All outcomes ran from clean revision `d7c63b0aaa9bebd56c075f16f1e5d86519853698` with Node.js `22.23.2`, pnpm `11.20.0`, `CI=true`, and disabled Next telemetry where applicable. Network access was limited to generated-project installation, audit/signature checks, and browser installation/verification.

| Outcome | Evidence | Result |
| --- | --- | --- |
| `fresh-scaffold` | `pnpm run verify:generated-testing-certification` | Passed compiled create; valid inference; healthy doctor; equal diff; frozen install, audit, signatures, lint, Cloudflare types, typecheck, named tests, build, and browser checks; all 19 checks reported. |
| `unit-tests` | Independent fresh generated `apps/web`: `pnpm run test:unit` | 1 file and 2 tests passed. |
| `component-tests` | Independent fresh generated `apps/web`: `pnpm run test:component` | 1 file and 1 test passed under jsdom. |
| `state-agreement` | Compiled CLI `infer`, `doctor`, and `diff` against the independent fresh project | State was `valid`; all installed capabilities and managed surfaces were confirmed or application-owned; diagnostics were healthy with zero findings; exact diff was equal with zero differences. |
| `generated-project-builds` | Fresh-scaffold runner and retained-fixture verifier | Lint, Cloudflare type generation, strict typecheck, one standalone Next build, and the OpenNext transform using `--skipNextBuild` passed. |
| `browser-regression` | Fresh-scaffold and retained-fixture verifiers | Playwright/axe passed against Next.js development and the prepared direct-workerd OpenNext preview. |
| `retained-fixture-matrix` | `pnpm run test:generated-fixtures`; `pnpm run verify:generated-skeletons` | 9 of 9 contracts passed; portfolio, portfolio-calendly, and site matched 47, 52, and 49 byte-stable files; the fixed verifier passed all three fixtures. |
| `ci-contract` | `pnpm run test:constitution` plus direct consolidated-workflow contract inspection | 55 of 55 tests passed, including the stable `scope`, `builder-and-packages`, `generated-projects`, `compatibility-proof`, and pull-request-only `dependency-review` jobs, fail-safe scoping, exact action pins, and disabled reusable pnpm caches. No hosted renewal run is claimed. |

The bounded fresh-scaffold result was:

```json
{"ok":true,"capability":"standards","version":"0.3.0","profile":"portfolio","checks":["compiled-cli-create","state-inference","healthy-diagnostics","exact-diff","pnpm-version","frozen-install","peer-dependencies","dependency-audit","registry-signatures","lint","cloudflare-types","typecheck","unit-tests","component-tests","next-build","opennext-build","browser-install","browser-development","browser-preview"]}
```

The bounded retained-fixture result was:

```json
{"ok":true,"fixtures":["portfolio","portfolio-calendly","site"],"profiles":["portfolio","site"],"checks":["pnpm-version","frozen-install","peer-dependencies","dependency-audit","registry-signatures","lint","cloudflare-types","typecheck","unit-tests","component-tests","next-build","opennext-build","browser-install","browser-development","browser-preview"]}
```

The independent generated project used the production compiled CLI and the documented injected-verifier boundary solely to avoid repeating the already-passed fixed verifier during creation. Its frozen public lockfile installed 758 packages. Creation returned the exact portfolio capability set; the separate named tests and all three read-only CLI commands then produced the results above. No generated or retained fixture was hand-edited.

## Focused certification and closure evidence

Before artifact edits, `pnpm run test:capability-certification` passed 24 of 24 and `pnpm run check:capability-certification` admitted all seven records at the unchanged accepted tree. The independently recomputed subject matched the registry exactly.

Both closure policies produced only their expected unrelated open records:

- `legacy-backfill-exempt` rejected ordinary pending `observability`;
- `all-certified` rejected `observability` plus the four unchanged `backfill-pending` records.

These expected non-zero closure results do not affect standards certification admission and do not close the broader portfolio stage.

## Setup-invalid attempts and cleanup

Setup-only failures are not counted as evidence:

- an initial exact-pnpm command without `CI=true` refused non-interactive dependency-tree replacement;
- the independent project first lacked one locked OpenNext tarball in the offline store, then passed the same frozen install with registry access;
- the first retained-fixture matrix was sandboxed from the registry and its generated frozen install reached the repository's 15-minute timeout; the same command passed with authorized registry access.

Every setup-invalid attempt failed before producing a claimed outcome. The explicit independent evidence root and helper were identity-checked and removed after use. Repository status remained clean at the evidence revision before artifact edits.

## Historical attribution

The receipt previously bound all eight outcomes to accepted-main evidence revision `c9294e9dc59d4b7bafed406846af3b43a10733d3`. That repaired the earlier squash-ancestry defect without weakening the validator. Its bounded independent reviewer found no material requirements, architecture/anti-overengineering, or test-evidence defect and returned `No material improvements recommended`, subject to retained ancestry and exact-candidate admission. The current review packet preserves that disposition as historical attribution without reusing it for the renewed outcomes. Plan A later changed managed workflow, preview, verifier, fixture/fingerprint, instruction, and build-order bytes without changing the standards subject. The current renewal therefore reran every outcome rather than relabelling or conditionally carrying prior results forward.

## Review, claim limits, and recovery

One bounded independent read-only reviewer assessed requirements and truthful evidence binding, architecture and anti-overengineering, test evidence and ancestry, claim limits, and recovery on the exact renewal diff. It reported `No material improvements recommended` with verdict `READY`. The receipt and every outcome therefore record `reviewDecision: accepted`; standards remains `certified` without another transition.

No workflow was dispatched. No deployment, provider, credential, environment, permission, persistent data, publication, or production system was read or mutated. Local Node/jsdom, build, workerd, Chromium, and axe results do not establish hosted execution, deployment behavior, visual quality, human usability, assistive-technology compatibility, production safety, or WCAG conformance.

Recovery is a focused newest-first revert of the renewal binding, receipt, evidence, review packet, tests, and current-status documentation. It restores the prior accepted-main evidence revision while preserving the exact certified subject, digest, status, plan, attribution, receipt link, and ancestry validator. No source, dependency, fixture, workflow, provider, deployment, persistent-data, credential, or production recovery applies.

Stop for explicit verified-final-diff and publication-strategy approval. Do not push, create or replace a pull request, merge, dispatch a workflow, deploy, publish, begin Plan B, or mutate an external system.
