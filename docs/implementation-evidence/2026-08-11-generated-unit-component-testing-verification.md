# Generated Unit and Component Testing Verification Evidence

> **Historical evidence:** This records the 2026-08-11 implementation comparison only. The [2026-08-12 CI repair verification](2026-08-12-generated-testing-ci-repair-verification.md) owns the current merged-main, hosted-CI, repair, and recovery evidence for merge request 2.

**Verification date:** 2026-08-11 (America/Toronto)

**Status:** Implemented, independently reviewed, and ready for verified-final-diff approval

**Implementation comparison:** `f4f682d4c711dc86a0158ab7f05393d5c33f0160..df7bbe9`

**Verified implementation content:** committed as `df7bbe9`

The separate final artifact commit reconciles bounded documentation claims, completes the implementation-plan checklist, and adds this evidence plus the review packet. It changes no template, schema, fixture, dependency, workflow, package, capability, recipe, state, or runtime verification behavior. It does update the enforcement-map constitution assertion described below and reruns `test:constitution`; its exact hash is reported at handoff.

## Result

The production builder now generates independently invokable named Vitest projects for every retained `portfolio` and `site` variant:

- a Node unit project with two parser tests covering representative valid and invalid content;
- a jsdom component project with one semantic Testing Library test of the actual generated `ContentPage`;
- exact run and watch scripts at the web boundary plus delegating workspace-root commands;
- explicit component matcher setup and cleanup;
- Vite 8 native TypeScript-path resolution and the exact reviewed React/jsdom/Testing Library dependencies;
- generated project and web guidance naming the exact commands, RED/GREEN sequence, and jsdom/browser evidence boundary; and
- read-only generated and repository quality workflows that execute the test-owning components at their appropriate layers.

The existing hybrid `standards` capability owns these generated source surfaces. It advances to `standards@0.3.0`; both materialized recipes advance to `0.7.0`; project/state schema remains `1.0.0`; and generated repositories retain the replaceable public dependency `@egeria-systems/standards@0.1.0`. No testing capability, public testing package, Workers Vitest pool, `fast-check`, database, provider, credential, deployment, analytics, or later-stage runtime was added.

The verification receipt is version-correlated: retained recipes `0.1.0` through `0.6.0` continue to accept only their legacy tuple, while recipe `0.7.0` requires `unit-tests` and `component-tests` after typecheck and before builds. Cross-version tuple substitutions fail.

`standards@0.3.0` remains an ordinary `pending` certification subject with digest `sha256:be53fdace61b6782e7f0abbbc0af7c333f81122f3a62fcfc7eb0ac687b2ff2fb` and a repository-present separate certification plan. This increment does not execute Task 6D or certify standards. The independently pending `observability@0.2.0` subject and its Task 6B evidence/workflow remain separate and unchanged.

## Preparation and dependency evidence

The [preparation evidence](2026-08-11-generated-unit-component-testing-preparation.md) records the exact base/worktree, inspected architecture/roadmap/ADRs/schemas/manifests/review packets, official documentation, current registry metadata, licenses, signatures, integrity values, engine/peer contracts, GitHub advisory queries, CI action commits, and baseline verification.

Selected exact generated development dependencies are:

| Package | Version |
| --- | --- |
| `vitest` | `4.1.10` |
| `@vitejs/plugin-react` | `6.0.5` |
| `jsdom` | `30.0.1` |
| `@testing-library/react` | `16.3.2` |
| `@testing-library/dom` | `10.4.1` |
| `@testing-library/user-event` | `14.6.3` |
| `@testing-library/jest-dom` | `7.0.1` |

The generated lock graphs passed peer-dependency, moderate audit, and registry-signature verification during final fixed-root certification. These are point-in-time supply-chain checks, not proof that unknown vulnerabilities are absent or that registry artifacts reproduce upstream source.

## TDD and repair evidence

The first focused RED contracts rejected the frozen capability/recipe, missing manifests/scripts/config/setup/specifications, absent managed surfaces and probes, old verification tuple, absent CI lanes, and incomplete AGENT coverage. Minimum template, catalog, state, verifier, workflow, and guidance changes made those contracts GREEN. Isolated rendered-project execution then passed both named projects before committed-fixture regeneration.

Review and aggregate verification produced three material repair groups with causal protection:

1. **Legacy state compatibility.** A focused RED showed that the initial expanded receipt rejected retained `0.1.0` through `0.6.0` state. Runtime validation now correlates the exact legacy tuple to those recipes and the expanded tuple to `0.7.0`; positive and cross-version negative tests pass. An attempted root schema union degraded diagnostic paths and was rejected by the 138-test builder-core aggregate, then replaced by the narrower nested structural union plus runtime correlation.
2. **Repository-quality ordering and current receipt assertions.** A focused constitution RED showed public-package tests could execute before their build output existed. The root aggregate and read-only workflow now build package outputs before standards/observability tests, with ordering assertions. Fixture determinism asserts the current tuple only through `lastSuccessfulVerification`, not a nonexistent legacy property.
3. **Guidance and evidence boundaries.** Generated web guidance now links its canonical parent, names exact root unit/component commands, and states the RED/GREEN/final-verify sequence. Canonical claims distinguish current implementation evidence from hosted CI, deployment, provider, visual/performance, human-accessibility, and conformance evidence.

During an early verifier-harness test, a test-only fake `pnpm` used `#!/usr/bin/env node` under the isolated home and recursively resolved through Volta. The exact process group was terminated; no repository source, generated fixture, provider, or external system was changed. The harness was repaired to invoke the absolute `process.execPath`, and builder-core passed 138/138. Final production regeneration and verification used an absolute Node `22.23.2`/Corepack pnpm `11.20.0` shim, not the test fake.

The first approved production-regeneration attempt failed closed with `PNPM_VERSION_INVALID` because the child process reached an ambient fallback pnpm. All six targets were still temporary and no committed fixture was replaced. The rerun used the pinned absolute pnpm shim and completed successfully.

## Production regeneration

The compiled production CLI generated each variant twice into absent, isolated destinations. Complete base64 file snapshots matched before replacement:

| Fixture | First output | Second output | Result |
| --- | ---: | ---: | --- |
| `portfolio` | 47 files | 47 files | byte-identical |
| `portfolio-calendly` | 52 files | 52 files | byte-identical |
| `site` | 49 files | 49 files | byte-identical |

Only after all three pairs matched were the committed roots replaced from their first production output. The resulting review repair changed only each generated web instruction file and its corresponding state fingerprint; `git diff --check` passed. The full generated-fixture gate then passed 8/8, including deterministic production rendering, exact inventories, project/state/inference/doctor/diff agreement, workflow policy, and fixed-verifier contracts.

Each fixture contains exactly two unit cases and one component case. The ordinary generation verifier and final fixed-root verifier both ran the named semantic commands successfully, for six unit and three component cases across the retained matrix.

## Final verification

The complete aggregate passed against the content committed as `df7bbe9` with Node `22.23.2`, pnpm `11.20.0`, and pinned child-process resolution:

```sh
PATH=/private/tmp/task6c-pinned-bin:/Users/CoveMB/.volta/tools/image/node/22.23.2/bin:/usr/bin:/bin:/usr/sbin:/sbin \
  /Users/CoveMB/.volta/tools/image/node/22.23.2/bin/corepack pnpm run verify:builder-kernel
```

| Gate | Result |
| --- | --- |
| Constitution | PASS; 50/50 |
| Semantic naming | PASS |
| Package boundaries | PASS; 45/45 |
| Private builder-core | PASS; build and 138/138 |
| Thin CLI | PASS; build and 10/10 |
| Standards | PASS; 33/33 |
| Observability | PASS; 23/23 |
| Capability certification contracts | PASS; 20/20 |
| Capability admission | PASS; 7 records |
| Generated fixtures | PASS; 8/8; 47/52/49 byte-stable files |
| Builder lint and copy externalization | PASS; zero warnings |
| Builder build and typecheck | PASS |
| Fixed-root generated matrix | PASS for all three fixtures |
| Changesets | PASS; no package bump required |

The fixed-root verifier returned:

```json
{"ok":true,"fixtures":["portfolio","portfolio-calendly","site"],"profiles":["portfolio","site"],"checks":["pnpm-version","frozen-install","peer-dependencies","dependency-audit","registry-signatures","lint","cloudflare-types","typecheck","unit-tests","component-tests","next-build","opennext-build","browser-install","browser-development","browser-preview"]}
```

For each fixture, the verifier copied the immutable source to an identity-bounded owner and used distinct HOME, temporary, XDG cache, pnpm store, npm configuration, Playwright browser/report/result, server-state, and fixed-port values. Its narrow child environment excludes unrelated operator credentials/options. It runs unit and component checks after typecheck and before Next/OpenNext builds, then runs Chromium against Next development and OpenNext/workerd preview. The committed fixture roots are never execution roots.

The compatibility proof implementation was unchanged. Its immutable local matrix was not repeated merely to repopulate evidence; the final aggregate exercised the repository's static workflow/constitution contract that assigns the unchanged proof its owned lane. The new repository-quality workflow was validated structurally but was not dispatched or executed on a hosted runner.

After the aggregate, only bounded documentation, checklist, evidence, packet, and the enforcement-map constitution assertion changed. `pnpm run test:constitution`, `pnpm run check:semantic-naming`, and `git diff --check` were rerun against that final artifact content. No runtime input to the expensive generated matrix changed.

## Independent review dispositions

| Review | Material finding | Disposition |
| --- | --- | --- |
| Requirements | Generated web guidance omitted the parent link, exact root commands, and TDD sequence | CLOSED in `f07b828`; production fixtures regenerated from the repaired template |
| Requirements | Exact-file plan omitted CLI and observability receipt consumers | CLOSED in `f07b828`; plan amended and direct consumers updated |
| Architecture/anti-overengineering | Expanded receipt invalidated retained legacy states | CLOSED in `fcbc7bb`; exact version-correlated tuples and cross-version tests; focused re-review found no material issue |
| Test evidence | Determinism asserted a nonexistent/stale receipt property | CLOSED in `f33e326`; sole current owner asserted |
| Test evidence | Package tests could run before package builds | CLOSED in `f33e326`; root/workflow order plus constitution protection |
| Test evidence | Documentation overreached beyond then-executed evidence | CLOSED in `f07b828`, `f33e326`, and this final evidence reconciliation |
| Focused re-reviews | No remaining material defect | CLOSED; all three reviewers were read-only and did not fan out |

No Cloudflare specialist was added because Task 6C invokes but does not change compatibility-proof or platform-harness behavior.

## Claim limits, risks, and deferred work

- jsdom proves the tested DOM semantics only. It does not prove layout, visible focus, iframe/browser APIs, routing, async Server Components, workerd behavior, human usability, or accessibility conformance.
- Playwright/axe results are bounded Chromium automation. They do not establish WCAG conformance, cross-browser behavior, assistive-technology compatibility, or completed human evaluation.
- No hosted repository workflow, deployment, protected-staging observability journey, provider telemetry receipt, Workers Logs UI/retention behavior, visual regression, or performance budget was executed.
- `observability@0.2.0` and `standards@0.3.0` remain pending. Task 6B reconciliation and Task 6D certification are separate approval-gated work.
- P3 property-based state/migration tests and P5C Workers Vitest/binding tests remain planned, not implemented.
- Browser/package installation, audit/signature responses, and registry availability are mutable external inputs.
- Existing-repository transformation, transactional migrations, persistent-data/provider recovery, later capabilities, `apps/jobs`, push, merge, publication, and production remain outside this increment.
- Remote refs were not refreshed; the comparison is bound to the user-approved local base.

## Rollback and recovery

Source recovery is a focused newest-first `git revert` of `df7bbe9`, `f33e326`, `f07b828`, `fcbc7bb`, `01b22b5`, `0d71012`, `51133b2`, `3010d1c`, `c2ee887`, and `dffccf1`, stopping at the intended boundary. Revert the separate final artifact commit to withdraw this evidence, packet, checklist, and bounded claim reconciliation. Do not reset or rewrite history.

After a source revert, regenerate all three fixtures through the restored production CLI and rerun `pnpm run verify:builder-kernel`. Never leave templates, dependency/lockfile bytes, capability/recipe versions, schemas, managed surfaces, fingerprints, state, inference, or verification receipts out of agreement.

No persistent-data, provider, deployment, hosted-workflow, package-publication, remote-Git, permission, production, credential, or external-message recovery applies. Temporary generation, backup, store, browser, cache, server, and build roots are non-authoritative and reproducible from Git plus the pinned toolchain.
