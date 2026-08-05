# Semantic Executable Naming Verification Evidence

**Execution date:** 2026-08-05 (America/Toronto)

**Status:** Task 2A implementation and independent review are complete. Verified-final-diff approval is pending. Task 3 remains blocked.

**Implementation comparison:** `76aefa624bf9fac5110f6dda348cbf2905f34aa5..2f7d20c856d81caa03a53c418d21fafdb44f47fa`

**Branch:** clean sequential local `main`; the implementation candidate is twenty-three commits ahead of the unrefreshed local `origin/main`. Remote refs were not refreshed because this is a local review gate and no push, pull request, publication, workflow dispatch, or deployment is authorized. This verification record and its review packet are post-candidate gate artifacts and therefore are outside the frozen implementation comparison.

## Scope and preparation

Task 2A normalizes live private builder-core paths and exports, one stable issue code, one schema title, five root script keys, and their direct workflow/documentation/test consumers. It does not change catalog metadata, profile recipe data, resolution behavior, dependencies, the lockfile, runtime pins, provider behavior, generated client output, or public package APIs. It does not implement Task 3 or any later P1 surface.

The approved mapping and current official-source review are recorded in:

- [semantic naming preparation](2026-08-05-semantic-naming-preparation.md); and
- [Task 2A plan revalidation](2026-08-05-semantic-naming-plan-revalidation.md).

The planning gate was committed as `76aefa6` (`Revalidate semantic naming plan`), which became the exact implementation base. The naming implementation was committed as `2f7d20c` (`Normalize executable names`).

## TDD record

Tests were changed before production sources or manifests.

### RED

```text
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run build
exit 0; TypeScript build passed before the implementation rename.

rtk node --test packages/builder-core/tests/contracts.test.mjs packages/builder-core/tests/resolution.test.mjs
exit 1; 10 passed, 8 failed on the old schema title and missing semantic runtime exports/profile recipes.

rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:package-boundaries
exit 1; 19 passed, 3 failed on the old source paths and root script keys.

rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:constitution
exit 1; 10 passed, 3 failed on the old compatibility script, README/contributing commands, and workflow invocation.
```

These were expected missing-name failures. There was no dependency-install or module-loader failure in the RED set.

### GREEN development corrections

The first schema generation ran before rebuilding `dist` and therefore imported the pre-rename compiled schema. The next `schema:check` correctly failed with:

```text
SCHEMA_ARTIFACT_STALE profile.schema.json
```

Inspection confirmed that `src` and the newly compiled `dist` contained `Egeria portfolio and site profile recipe`, while the checked artifact still contained `Egeria P1 profile recipe`. Regenerating after the build changed only the title and resolved the failure.

The next focused builder run exposed a test-location mistake: `dist/index.d.ts` re-exports the catalog module and does not inline `CapabilityPackageVersions`. The test was corrected to follow the barrel's actual catalog export and inspect its declaration file. The focused builder test then passed 18/18. No production behavior changed in either correction.

## Final deterministic verification

The final implementation tree was unchanged between these successful commands and commit `2f7d20c`.

### Builder-core

```text
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run verify
```

Exit `0`:

- TypeScript build passed;
- checked Draft 2020-12 schema artifacts were current;
- builder-core tests passed 18/18;
- no-emit typecheck passed; and
- ESLint passed with zero warnings.

### Builder packages and repository contracts

```text
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run verify:builder-packages
```

Exit `0`:

- constitution tests: 13/13;
- package-boundary tests: 22/22;
- builder lint: CLI, builder-core, standards, and observability passed;
- builder builds: CLI, builder-core, and observability passed;
- standards tests: 14/14;
- observability tests: 1/1;
- builder no-emit typechecks passed; and
- Changesets still selects only standards and observability for the existing minor releases.

### Compatibility command consumer

The first sandboxed command reached `next build` and failed with the known local bind restriction:

```text
uncaughtException Error: listen EPERM: operation not permitted 127.0.0.1
```

The exact command was rerun with approved local loopback access:

```text
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run verify:compatibility-proof
```

Exit `0`:

- proof lint and typecheck passed;
- Vitest unit tests passed 4/4;
- Next.js production build passed;
- OpenNext Cloudflare build passed;
- Wrangler binding type check passed;
- workerd integration test passed 1/1;
- development Playwright/axe checks passed 4/4; and
- preview Playwright/axe checks passed 4/4.

The command did not deploy or call provider APIs. The accepted P0.2 record remains the owner of prior non-production deployment evidence.

### Exact-name and diff checks

`rtk git diff --check` passed. A repository-wide search for the two old paths, three old exports, old issue code, old schema title, and five old script keys found only explicit negative regression assertions and accepted historical plans, evidence, and review records. There is no compatibility alias or old executable consumer in the candidate.

The staged candidate was recognized as two source renames with 97% and 90% similarity. The final candidate contains 15 changed files, 116 insertions, and 49 deletions. `pnpm-lock.yaml`, `.nvmrc`, runtime pins, dependencies, public-package manifests, and provider configuration were unchanged.

## Independent review dispositions

- **Requirements:** No material findings.
- **Architecture and anti-overengineering:** No material findings. The reviewer confirmed the approved atomic mapping, behavior preservation, private builder-core boundary, absence of aliases, and absence of Task 3+ behavior.
- **Test evidence:** No material findings.

All reviews used frozen comparison `76aefa624bf9fac5110f6dda348cbf2905f34aa5..2f7d20c856d81caa03a53c418d21fafdb44f47fa`. Reviewers were read-only and performed no recursive delegation, GitHub action, workflow dispatch, deployment, provider call, or repository edit.

## Security, accessibility, and evidence limits

- The locked npm dependency graph had no known vulnerability in the dated moderate-threshold registry audit recorded in the plan-revalidation evidence. Task 2A does not change that graph.
- Node.js `22.23.0` remains pinned even though official security release `22.23.2` supersedes it. This is an explicit residual risk and separate compatibility-planning requirement. The local compatibility result proves command-rename preservation for trusted repository inputs only; it is not evidence of current runtime security.
- Static, Node, workerd, and Chromium checks prove only the exercised candidate and environments. They do not establish security completeness, production safety, cross-browser support, visual quality, translation quality, or human usability.
- Automated axe checks do not establish WCAG conformance. No human accessibility evaluation was performed because this naming-only increment creates no generated UI and no separate gate requires one.
- No push, pull request, publication, workflow dispatch, deployment, provider mutation, persistent-data mutation, external message, or production action occurred.

## Rollback and recovery

- **Source and commands:** revert `2f7d20c` with a new focused revert commit; do not reset shared `main`. This restores the old private source/export names, issue code, schema title, script keys, workflow invocation, documentation commands, and tests atomically.
- **Generated build output:** rebuild builder-core and regenerate checked schemas after the source revert. Ignored `dist`, `.next`, and `.open-next` output is reproducible and not authoritative state.
- **Dependencies:** no dependency or lockfile rollback exists because Task 2A changed neither.
- **Persistent data and providers:** none were created or mutated, so no persistent-data/provider rollback exists.
- **Deployment:** none occurred. Any future workflow dispatch, Worker deployment, rollback, deletion, domain change, or credential action remains separately approved work.

## Gate disposition

Task 2A is ready for explicit verified-final-diff approval after this record and the review packet are committed and the exact final comparison is presented. Approval would close Task 2A only. Task 3 implementation, the Node pin update, push, pull request, workflow dispatch, deployment, publication, and provider action remain separately gated.
