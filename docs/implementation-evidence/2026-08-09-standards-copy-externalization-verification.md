# Standards Copy Externalization Verification Evidence

**Date:** 2026-08-09 (America/Toronto)

**Status:** Implemented, independently reviewed, and ready for verified-final-diff approval

**Implementation comparison:** `b082a4302bfa2fc8e2f8ad220bb4d551d9d49283..f6e4ad411ee0d166e230488caf03c1086cd110ce`

The separate final artifact commit completes the plan checklist and adds this evidence plus the review packet without changing executable, configuration, package, or test behavior. Its exact hash is reported at handoff.

## Result

The standards source now exports `createCopyExternalizationConfig`, an ordinary flat ESLint config that rejects static user-visible copy in:

- non-whitespace JSX text;
- result-producing static JSX child expressions;
- literal `aria-label`, `title`, `placeholder`, and `alt` values; and
- visible fields in local static `metadata` and `generateMetadata` exports, including structured titles, conditional result branches, and top-level named export aliases.

Expression traversal is render-position aware: conditional branches, `||`, `??`, string concatenation, array elements, the right side of `&&`, and the final sequence result are inspected; comparison operands, non-concatenating binary operands, non-final sequence expressions, type-only exports, and nested shadows are not treated as visible copy. Whitespace-only JSX is ignored, while invariant escapes compare exact unnormalized source text.

The builder root is the concrete current consumer. Its dedicated zero-warning command lints all four canonical application and presentation TSX templates with the root config explicitly selected so ESLint does not load generated-project configuration. The aggregate builder lint invokes that command once.

The source package remains version `0.1.0` with a pending minor Changeset. Published `@egeria-systems/standards@0.1.0` does not contain this API. No publication, version materialization, generated dependency change, or generated-project adoption occurred.

## Approved amendments

The user preapproved plan amendments through the implemented-task review gate. Three evidence-backed amendments were needed:

1. The root command gained `--config eslint.config.mjs` after the direct CLI RED proved that nested generated-project config discovery occurred before root ignore processing.
2. Independent reviews added dual-major result-position, conditional metadata, exact-whitespace escape, named runtime export, and type-only export regressions.
3. Existing package-boundary and constitution status assertions required one canonical ownership sentence to preserve both approved builder-kernel provenance and verified new-directory mutation wording.

No amendment expanded into generated-project adoption, publication, localization-key infrastructure, another capability, or a later P2 deliverable.

## TDD evidence

### Public standards source

The initial standards RED executed 13 new tests before the source API existed. All 13 failed at the expected missing public source boundary. The public/release boundary RED passed 5/9 and produced the four expected failures for the absent export, Changeset, and packaged file contract.

After the minimum implementation, the exact copy-rule suite passed 13/13 under ESLint `9.39.5` and `10.8.0`; the public/release boundary suite passed 9/9; standards lint passed; and dry-run packaging contained the new source file.

An apparent packaging failure during the first GREEN attempt was environmental, not a source defect: a direct Node test spawned ambient Node `24.14.0` and pnpm `11.16.0`. Repeating the unchanged test with repository-pinned Node `22.23.2` and pnpm `11.20.0` passed 9/9.

### Root consumer

The root-consumer RED passed 0/4. Failures identified the absent root import/config, exact command, aggregate integration, and ignored template paths. The first programmatic GREEN passed 16/16.

The direct root command then failed because ESLint imported `packages/builder-core/templates/common/apps/web/eslint.config.mjs` and could not resolve its generated-project-only `eslint-config-next` dependency. A minimal command-line experiment with `--config eslint.config.mjs` passed. The three exact script/config contract tests then failed 0/3 before the manifest change and passed 3/3 afterward. The direct command and aggregate lint passed without modifying a template byte.

### Independent-review repairs

Requirements and architecture reviewers independently reproduced conditional metadata bypasses, comparison/sequence false positives, a whitespace-normalized invariant escape, and missing named export aliases under both ESLint majors.

The causal repair RED ran eight dual-major checks: 2 passed positive-result controls and 6 failed for the three defects under both majors. The minimum repair made all 8/8 pass. The full standards suite advanced from 27 to 33 tests and passed 33/33.

Architecture closure then found a type-only export alias false positive. Its causal dual-major RED failed 0/2. Filtering statement- and specifier-level type exports made the focused test pass 2/2; the full standards suite remained 33/33 and package boundaries remained 40/40.

The final aggregate first passed constitution 20/21 because an earlier focused ownership wording repair satisfied the package-boundary phrase while displacing the constitution phrase. One sentence was amended to retain both truthful boundaries. The two focused documentation contracts then passed 2/2, and the settled-tree aggregate passed 21/21 plus 40/40.

These are contemporaneous command observations retained from this implementation run. They are not reconstructed from commit order; source and tests enter focused commits together.

## Independent review dispositions

| Review | Finding | Disposition |
| --- | --- | --- |
| Requirements | Conditional structured metadata was missed | CLOSED in `6bf86e4`; dual-major conditional and named-export regressions, focused GREEN, and independent closure |
| Requirements | Comparison and non-final sequence literals were falsely treated as rendered copy | CLOSED in `6bf86e4`; result-position traversal, paired positive/negative tests, and independent closure |
| Architecture and anti-overengineering | Logical/binary traversal produced blocking false positives | CLOSED in `6bf86e4`; duplicate of the requirements finding and independently closed |
| Architecture and anti-overengineering | Whitespace normalization broadened the exact invariant escape | CLOSED in `6bf86e4`; raw identity is compared separately from whitespace-only detection |
| Architecture and anti-overengineering | Named export aliases bypassed metadata enforcement | CLOSED in `6bf86e4`; top-level local export names are resolved without matching nested shadows |
| Architecture closure | Type-only export aliases marked same-named values as runtime metadata | CLOSED in `b7e7d52`; statement/specifier type exports are excluded and dual-major closure passed |
| Test evidence | The same three behavioral defects lacked regression evidence at `b12be86` | CLOSED by `6bf86e4` and the settled 33/33 dual-major suite |
| Test evidence | The committed pre-review range did not yet contain RED causality evidence | CLOSED by this dated record of the retained contemporaneous RED results; no claim is inferred from commit ordering |

All reviewers were independent and read-only. They made no repository or external mutation and did not delegate.

## Final verification

The settled executable/configuration/test tree was `f6e4ad411ee0d166e230488caf03c1086cd110ce`, tree `7b30938cdd124d5aaeebae9d162b98b237861a7d`, on clean local `main`. Commands used `CI=true`, Node `22.23.2`, and pnpm `11.20.0`.

```text
pnpm run verify:builder-packages
PASS

pnpm run test:builder-core
PASS

pnpm run check:semantic-naming
PASS

git diff --check b082a4302bfa2fc8e2f8ad220bb4d551d9d49283..f6e4ad4
PASS
```

| Gate | Result |
| --- | --- |
| Constitution and local links | PASS; 21/21 |
| Package boundaries and dry-run package contents | PASS; 40/40 |
| Builder lint | PASS; zero warnings, including all four canonical TSX templates |
| Builder packages build and typecheck | PASS |
| Thin CLI | PASS; build plus 9/9 tests |
| Standards | PASS; 33/33, including both supported ESLint majors |
| Observability | PASS; 1/1 |
| Builder-core | PASS; build plus 104/104 tests |
| Changesets | PASS; only `@egeria-systems/standards` scheduled for a future minor bump |
| Semantic naming | PASS; no findings |
| Exact diff formatting | PASS |

The fixed-root generated-project verifier and generated-fixture regeneration were not repeated. The comparison has no change under `packages/builder-core/templates`, `tests/generated-fixtures`, `.egeria`, `.github/workflows`, `proofs`, `scripts/verify-generated-skeletons.mjs`, or `pnpm-lock.yaml`; public package versions remain `0.1.0`. The accepted baseline reconciliation records the successful full `verify:builder-kernel` on those identical inputs, including 7/7 fixture tests and all nine fixed-root checks for both profiles.

A fresh full-lock vulnerability/signature audit was not permitted because it would transmit workspace dependency metadata outside the sandbox. No workaround was attempted. The accepted first-P2 verification on the identical lockfile recorded no known moderate-or-higher vulnerability and 885/885 verified registry signatures earlier on the same date. That remains point-in-time unchanged-graph evidence, not a fresh audit or proof of dependency safety.

## Changed files

The implementation comparison changes 15 paths:

- `.changeset/externalize-visible-copy.md`;
- `docs/architecture/enforcement-map.md`;
- `docs/architecture/package-ownership.md`;
- `docs/implementation-evidence/2026-08-09-standards-copy-externalization-preparation.md`;
- `docs/superpowers/plans/2026-08-09-standards-copy-externalization.md`;
- `eslint.config.mjs`;
- `package.json`;
- `packages/standards/AGENTS.md`;
- `packages/standards/README.md`;
- `packages/standards/eslint/copy-externalization.mjs`;
- `packages/standards/package.json`;
- `packages/standards/tests/copy-externalization.test.mjs`;
- `tests/package-boundaries/internal-linting.test.mjs`;
- `tests/package-boundaries/public-standards.test.mjs`; and
- `tests/package-boundaries/release-safeguards.test.mjs`.

The final artifact commit additionally creates this verification record and `docs/review-packets/2026-08-09-standards-copy-externalization.md`, and marks the existing plan checklist complete.

## Focused commits

- `a9278a5` — plan standards copy externalization and record preparation evidence.
- `03c8d19` — correct the planned flat-config language-options shape against official ESLint documentation.
- `71059ac` — add the standards source API, dual-major tests, packaging contract, and minor Changeset.
- `b12be86` — compose the real builder-template consumer and canonical ownership.
- `6bf86e4` — repair result-position, exact escape, conditional metadata, and named export semantics.
- `b7e7d52` — exclude type-only metadata exports.
- `f6e4ad4` — reconcile the two accurate package-ownership status contracts.

The separate final artifact commit is reported at handoff.

## Claim limits, risks, and deferred work

- This is bounded static AST enforcement. It does not perform data-flow analysis, follow imports/re-exports, resolve computed metadata keys, inspect runtime content, or prove that every rendered string is externalized.
- Invariant escapes are exact and centrally configured. The current builder consumer configures none.
- Missing/unused localization keys, locale parity, multilingual behavior, translation quality, semantic-content quality, and runtime copy resolution remain deferred until a concrete localization-key contract exists.
- The source API is not in immutable published `0.1.0`. Publication, `changeset version`, release provenance, and generated-project adoption require separate approvals and verification.
- No generator, generated project, template, fixture, dependency graph, lockfile, state, provider, workflow, deployment, persistent data, or production system changed.
- No visual, performance, human-usability, human-accessibility, automated-accessibility, WCAG-conformance, security, production-readiness, or launch-readiness claim is made.
- Bounded sections, responsive UI, Calendly, observability runtime, CI/deployment, retained real client-project evidence, and launch-scope approval remain later P2 work.
- Remote refs were not refreshed; the accepted local baseline owns this sequential local comparison.

## Rollback and recovery

Use focused newest-first `git revert` commits rather than reset or history rewriting:

1. revert the final artifact commit to withdraw the completed checklist, verification record, and review packet;
2. revert `f6e4ad4` to restore the prior ownership status wording;
3. revert `b7e7d52` and `6bf86e4` to withdraw review-driven semantic repairs;
4. revert `b12be86` to remove the root builder-template consumer and canonical-owner updates;
5. revert `71059ac` to remove the public source API, tests, export, and pending Changeset; and
6. revert `03c8d19` and `a9278a5` to withdraw planning artifacts.

After a source revert, rerun `verify:builder-packages`, `test:builder-core`, and semantic naming. If any later work has adopted a published standards release, source rollback is insufficient: reverse the generated dependency update and release/provider state under their own separately approved recovery plan.

This increment created no persistent data, provider resource, deployment, public package release, remote Git mutation, permission change, production action, or external message to reverse.
