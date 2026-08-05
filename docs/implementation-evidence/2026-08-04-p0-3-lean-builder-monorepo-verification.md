# P0.3 lean builder monorepo verification evidence

**Execution date:** 2026-08-05 (America/Toronto)

**Implementation comparison:** `40604eb5b8a3ade0175c16dd945a1bafee15ae04..b6472d2bbe3c7149e14947faa4e13b0a22690ab2`

**Branch:** `main`; the committed implementation candidate is eleven commits ahead of the unrefreshed local `origin/main`. Remote refs were not refreshed because this is a local review gate and no push, pull request, publication, or deployment is authorized. This verification record and the review packet are post-candidate review artifacts and therefore are outside the frozen implementation comparison.

## Environment and locked graph

```text
node --version
v22.23.0

/Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --version
11.20.0

pnpm exec changeset --version
2.31.1

shasum -a 256 pnpm-lock.yaml
c33e7c8da6fcf8708ff9f16444157aa85ac0e77f9503bd80ee250f0cc0f96b95
```

The final locked graph pins root ESLint `10.8.0`, proof ESLint `9.39.5`, `@eslint/js@10.0.1`, `typescript-eslint@8.66.0`, TypeScript `6.0.3`, and Changesets `2.31.1`. Standards declares `^9.39.5 || ^10.8.0` and its tests import both exact engines.

Current official documentation, exact registry metadata, and direct-tool security checks are recorded in:

- [P0.3 preparation](2026-08-04-p0-3-lean-builder-monorepo-preparation.md);
- [strict builder lint preparation](2026-08-04-p0-3-strict-builder-lint-preparation.md);
- [ESLint compatibility boundary](2026-08-05-p0-3-eslint-compatibility-boundary.md).

The 2026-08-05 registry recheck confirmed that `eslint-config-next@16.3.0` has three selected plugin dependencies whose peer ranges stop at ESLint 9. The accepted proof and future generated Next.js projects therefore remain on ESLint `9.39.5` while that selected graph requires it. The builder root uses ESLint `10.8.0`; standards behaviorally tests both majors.

## TDD record

Each implementation increment added its focused contract before the production surface:

1. **Private ownership shells:** RED reported missing CLI/builder-core manifests, strict configs, empty source shells, and forbidden-boundary guards. GREEN materialized only the private shells and passed focused boundary tests plus build/typecheck.
2. **Consumed standards APIs:** RED reported missing strict TypeScript and Cloudflare-isolation exports/consumers. GREEN passed the real ESLint boundary behavior, strict-config contract, proof lint, builds, types, and package boundaries.
3. **Empty observability shell:** RED reported the missing empty public API, package manifest, strict build, and packaging boundary. GREEN passed its empty-export test, build/typecheck, and public-package boundary tests.
4. **Release safeguards:** RED reported missing Changesets configuration, lifecycle scripts, public/private release classification, and exact dry-run tarballs. GREEN passed the then-current 16 package-boundary tests, package tests, builds/types, Changeset status, peer check, audit, and exact dry-run packs.
5. **Strict dual-major lint standard:** the focused RED run passed 13 existing assertions and failed 17 assertions on the missing ESLint 10 engine/API/root/package contracts. After the minimum implementation and one fixture refinement to isolate the intended typed defect, GREEN passed all 30 focused assertions. Both majors accept deliberately non-Prettier-formatted valid TypeScript, reject a floating promise with `@typescript-eslint/no-floating-promises`, and enforce Cloudflare isolation.
6. **Canonical documentation:** RED failed on missing package-owner links and review status. GREEN passed 13 constitution contracts and 19 then-current package-boundary tests.
7. **ESLint compatibility clarification:** RED passed 7 and failed 5 focused assertions because standards source had no root ESLint 10 configuration or lint scripts. GREEN passed all 12 focused assertions, then the complete affected P0.3 suite. The exact proof lint contract stayed green throughout.
8. **Independent-review repair:** both the requirements and architecture reviewers found that the Cloudflare-isolation config did not yet reject a relative import of the proof adapter from protected code. RED passed 4 and failed 3 focused assertions under the exact installed ESLint 9 and 10 engines. GREEN passed 7/7 after adding a relative-import restriction that still permits the proof's `app/api` composition root. The complete standards suite then passed 14/14.
9. **Test-protection repair:** the independent test-evidence reviewer found that the correct current topology and typed root lint integration lacked causal regression protection. The exact topology assertion initially failed because its expected normalization did not match pnpm's explicit `private: false` output; after correcting the test contract, the focused suite passed 10/10. The actual root ESLint 10 config now behaviorally rejects a floating promise and accepts its awaited control. The complete package-boundary suite passed 21/21 and the final P0.3 verification passed.

The RED failures were expected missing-feature failures, not accepted failures on the final tree. Current GREEN results are superseded by the final commands below.

## Final deterministic verification

### Install and supply chain

```text
pnpm install --frozen-lockfile
Already up to date; exit 0.

pnpm audit --audit-level=moderate
No known vulnerabilities found; exit 0.

pnpm peers check
No peer dependency issues found; exit 0.
```

The audit queried the installed direct and transitive npm graph on 2026-08-05. It does not establish future safety or review software outside that graph.

### P0.3 repository verification

`pnpm run verify:p0.3` passed with:

- constitution: 13/13;
- package-boundary and publication contracts: 21/21;
- ESLint `10.8.0` zero-warning lint for CLI, builder-core, standards source, and observability;
- TypeScript build for CLI, builder-core, and observability;
- standards tests: 14/14 across real ESLint 9 and 10 APIs, including protected relative-adapter rejection and composition-root allowance;
- observability tests: 1/1;
- TypeScript no-emit checks for CLI, builder-core, and observability;
- Changeset status: only standards and observability receive planned minor releases.

### Affected P0.2 proof

The first sandboxed `pnpm run verify:p0.2` reached `next build` and failed with `listen EPERM: operation not permitted 127.0.0.1`. This is an environment restriction, not an implementation failure. The same complete command was rerun with approved local loopback-port access and passed:

- proof package ESLint `9.39.5` lint: zero warnings;
- TypeScript no-emit check;
- Vitest unit tests: 4/4;
- Next.js production build;
- OpenNext Cloudflare Worker build;
- generated binding type check;
- workerd integration test: 1/1;
- development Playwright/axe suite: 4/4;
- workerd preview Playwright/axe suite: 4/4.

This command did not deploy. The P0.2 compatibility record remains the owner of the prior non-production deployment evidence. Automated axe and interaction checks do not establish WCAG conformance.

### Dry-run public packages

`@egeria-systems/standards@0.0.0`:

```text
README.md
eslint/cloudflare-isolation.mjs
eslint/typescript-strict.mjs
package.json
typescript/strict.json
```

`@egeria-systems/observability@0.0.0`:

```text
README.md
dist/index.d.ts
dist/index.js
package.json
```

Both `pnpm pack --dry-run --json` commands exited zero. No tarball was published or uploaded.

### Repository comparison

`git diff --check 40604eb5b8a3ade0175c16dd945a1bafee15ae04..b6472d2bbe3c7149e14947faa4e13b0a22690ab2` passed. The committed implementation candidate contains all source and test repairs; the verification record and review packet remain post-candidate artifacts for Gate 3 inspection.

The P0.3 commits are:

```text
a6d0f0c Plan P0.3 lean builder monorepo
7437582 Establish private builder package boundaries
f520754 Add consumed standards package APIs
aec46c3 Add empty observability package shell
aa4b421 Configure package release safeguards
af9ce57 Add strict builder lint standard
097865b Document lean monorepo ownership
c752c15 Complete ESLint compatibility boundary
0145dfa Enforce Cloudflare adapter isolation
b6472d2 Strengthen P0.3 boundary tests
```

## Independent review dispositions

- **Requirements:** one medium finding retained. The shared config did not enforce the approved relative Cloudflare-adapter import boundary. Commit `0145dfa` added the missing behavior and dual-major regression coverage while preserving the route composition root. No other material requirement defect was reported.
- **Architecture and anti-overengineering:** the same medium finding was retained and repaired in `0145dfa`. The follow-up reviewer found no material defect and marked the repair READY.
- **Test evidence:** two medium protection gaps were retained: the workspace test did not reject arbitrary additional private packages, and no causal test proved that the root ESLint 10 config applied typed linting. Commit `b6472d2` adds the exact six-workspace assertion and actual-root-config typed invalid/valid control. The follow-up found no material findings and marked the test-evidence scope READY.
- **Release and supply chain:** no material findings. READY for P0.3 Gate 3, but not for npm publication. Scope ownership, licensing, registry acceptance, credentials, and provenance issuance remain unresolved external prerequisites.

## Evidence limits

- No npm publication, namespace claim, push, pull request, deployment, provider mutation, persistent-data mutation, or production action occurred.
- Public package manifests and dry-run packs prove local packaging boundaries, not npm-scope ownership, registry acceptance, provenance issuance, or installability from the public registry.
- Static, Node, workerd, and browser checks prove only the exercised candidate and environments; they do not prove security completeness, production safety, translation quality, visual quality, or future dependency compatibility.
- Automated accessibility checks are mandatory evidence but do not permit a WCAG conformance claim. No human accessibility evaluation was performed for P0.3 because this increment creates no generated UI and no separate contractual gate requires it.
- No `.egeria` schema/state, profile, capability implementation, generator, repository mutation, provider, observability transport, analytics behavior, or application runtime was introduced.
