# Generated Testing CI Repair Verification Evidence

**Verification date:** 2026-08-12 (America/Toronto)

**Base:** `origin/main@2a315aa0e7dce1bf1048b9a2c07e318add9241de`

**Verified implementation and CI content:** `93e4e9f6ea944329de7c47c9e8bf34382774b1f8`

**Merge request:** [Egeria-Systems/egeria-scaffold#2](https://github.com/Egeria-Systems/egeria-scaffold/pull/2)

**Result:** The generated-testing repair and current `main` reconciliation are locally verified and passed all three applicable read-only GitHub Actions workflows. Final documentary artifacts, independent exact-diff review, repository approval, and merge remain separate.

## Implemented repair

- Builder-core owns a checked recipe `0.7.0` lockfile and materializes those exact bytes before isolated frozen-install verification. Lockfile preparation invokes no package manager or registry process.
- Exclusive lockfile write/close failures fail closed without unlinking a concurrently replaceable pathname. The generation transaction cleans only its identity-owned staging root.
- Fixed JSON Schema tuples emit exact `minItems` and `maxItems` bounds.
- Builder/package checks remain always-on. Generated-project and compatibility-proof matrices run in separate path-scoped, read-only workflows with their complete commands unchanged.
- Pull-request release intent compares explicitly with `origin/main`; this MR owns an empty Changeset because its public-package-root changes are non-packed instruction files and require no package bump.

No generated application capability, package version, provider, deployment, credential, persistent data, production state, or certification status changed through these repairs.

## Main reconciliation and fingerprint disposition

`main@2a315aa0e7dce1bf1048b9a2c07e318add9241de` was merged into the branch as signed merge commit `ac7d5168461d3997e26a1dedfa6101a126992c80`.

The three `.egeria/state.json` files conflicted only on `builder-dependency-lockfile`. Incoming `main` had regenerated a transient `electron-to-chromium@1.5.404` resolution, but the checked recipe `0.7.0` artifact deliberately retains the reviewed `1.5.403` graph. The resolution therefore retained the checked recipe bytes and accepted incoming observability source bytes:

| Surface | SHA-256 | Validation |
| --- | --- | --- |
| Recipe plus all three generated `pnpm-lock.yaml` files | `932b3d7a9fafd7dd3b086cbcb2ebf575a15034be90b599939b1d2fcfbd6b3c8c` | all four files byte-identical; all three state fingerprints match |
| Observability ingestion route template plus all three fixtures | `75e6c5d88e9d89c43e44cc3db79f38805771d1e7f723bd0c88410ab3518bec67` | all four files byte-identical; all three state fingerprints match |
| Browser reporter template plus all three fixtures | `972e69ce65b09a5d18ea64a17f3448f96d31c4fcdc68d83619bcb3307edb499d` | all four files byte-identical; all three state fingerprints match |

The production determinism gate then regenerated every retained fixture byte-for-byte: `portfolio` 47 files, `portfolio-calendly` 52 files, and `site` 49 files.

## Local verification

The pinned runtime was Node `22.23.2` with pnpm `11.20.0`.

| Candidate | Command or gate | Result |
| --- | --- | --- |
| `ac7d516` | `pnpm run test:generated-fixtures` | PASS; 8/8 and 47/52/49 byte-stable files |
| `ac7d516` | builder-core build and tests | PASS; 140/140 |
| `ac7d516` | capability certification | PASS; 20/20 |
| `ac7d516` | constitution | PASS; 52/52 |
| `ac7d516` | semantic naming and `git diff --check` | PASS |
| `ac7d516` | `pnpm run verify:builder-kernel` | PASS; complete aggregate including fixed-root install, audit, signatures, lint, types, unit/component tests, Next/OpenNext builds, and both browser modes |
| `5c4c036` | cleanup-identity test and complete capability certification | PASS; 1/1 focused and 20/20 aggregate |
| `5c4c036` | focused ESLint, constitution, semantic naming, diff check | PASS |
| `93e4e9f` | package boundaries | PASS; 45/45, including packed-file and retained-Changeset safeguards |
| `93e4e9f` | `changeset status --since origin/main` | PASS; no package bump at any level |
| `93e4e9f` | constitution, semantic naming, staged/unstaged diff checks | PASS; 52/52 and no findings |

The complete aggregate was not repeated after `ac7d516` because later changes affect only tests, workflow release-intent comparison, an empty Changeset, plans, and evidence. The affected full suites and exact hosted workflow were run instead.

## Hosted RED/GREEN evidence

Three Linux-specific failures were reproduced and repaired without weakening a gate:

1. Run `31582711142` failed the incoming cleanup-identity test because deleting and immediately recreating a pathname allowed Linux to reuse the original inode. The test now creates the replacement while the original exists, records a distinct identity, renames it into place, and asserts the retained identity.
2. Run `31583053791` passed that repair and failed only because Changesets looked for an absent local `main` in the pull-request merge checkout. The workflow now uses the official `status --since origin/main` boundary.
3. Run `31583485523` then failed the exact retained-Changeset inventory because the new empty record had no direct-consumer update. The safeguard now admits both reviewed empty records and continues to reject unreviewed release intent.

Exact candidate `93e4e9f6ea944329de7c47c9e8bf34382774b1f8` passed:

| Workflow | Run | Result |
| --- | ---: | --- |
| Repository quality / `builder-and-packages` | [`31583624246`](https://github.com/Egeria-Systems/egeria-scaffold/actions/runs/31583624246) | PASS; 1m42s; every step including release intent |
| Compatibility proof quality / `compatibility-proof` | [`31583624223`](https://github.com/Egeria-Systems/egeria-scaffold/actions/runs/31583624223) | PASS; 2m00s; unit, build, integration, and development/preview browser checks |
| Generated project quality / `generated-projects` | [`31583624387`](https://github.com/Egeria-Systems/egeria-scaffold/actions/runs/31583624387) | PASS; 13m13s; determinism and complete retained-project matrix |

These hosted runs prove the checked workflows executed successfully on GitHub's Ubuntu runner for that exact candidate. They do not prove deployment, provider behavior, production safety, performance, visual quality, human accessibility, or WCAG conformance.

## Current documentation and official sources

GitHub's official workflow syntax and secure-use guidance remain the owners for path-filter behavior, immutable action references, and least-privilege permissions. Changesets' official command reference documents `changeset status --since=<git ref>`. Node `22.23.2` documents `fsPromises.rename` as the supported promise-based rename operation used by the deterministic identity-replacement test.

- [GitHub Actions workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
- [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use)
- [Changesets command-line options](https://github.com/changesets/changesets/blob/main/docs/command-line-options.md)
- [Node.js 22.23.2 file-system promises](https://nodejs.org/docs/latest-v22.x/api/fs.html#fspromisesrenameoldpath-newpath)

The checked action commits and public advisory queries remain recorded in the [repair preparation evidence](2026-08-12-generated-testing-ci-repair-preparation.md). No new provider or deploy tool was introduced.

## Claim limits and recovery

- `standards@0.3.0` and `observability@0.2.0` remain separate pending certification subjects.
- Path-scoped workflows are not configured as required status contexts. Repository rules must be revalidated before making them required.
- Registry availability, audits, signatures, dependency installation, and browser installation remain point-in-time external inputs.
- A documentation-only final artifact commit follows this verified content and receives its own lightweight local checks plus hosted exact-head checks before merge.

After integration, source recovery is an ordinary revert of the merge-request integration commit followed by regeneration and `pnpm run verify:builder-kernel`. Before integration, focused repair commits can be reverted newest-first: `93e4e9f`, `24ec499`, `5c4c036`, `e9cb302`, `d5668ab`, `f8af04c`, `bfba450`, and `6f2e558`. Do not revert the `main` reconciliation merely to remove this branch's repairs.

No persistent-data, provider, deployment, credential, package-publication, or production recovery applies.
