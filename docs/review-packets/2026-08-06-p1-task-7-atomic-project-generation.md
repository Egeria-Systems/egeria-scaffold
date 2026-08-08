# P1 Task 7 Review Packet — Atomic Project Generation

**Date:** 2026-08-08 (America/Toronto)

**Outcome:** PASS after evidence-backed repairs. Stop before Task 8.

**Implementation comparison:** `ae8c2687ba1d21cc8b5aa16003edc8255409e75a..1e8a3e3e6a01621632c527cdc6acf157649f1432`

The reviewed implementation lives in isolated worktree `/private/tmp/egeria-scaffold-p1-task-7` on branch `p1-task-7-atomic-generation`. The final gate-artifact commit adds this packet and its evidence record without changing implementation behavior. The exact handoff commit is reported when the clean review state is presented.

The primary checkout's existing modified and untracked files are excluded and untouched. No remote ref was fetched during final verification because the approved integrated base was already frozen and live registry/advisory facts were checked independently.

## Scope and result

Private `builder-core` now generates new `portfolio` and `site` repositories from deterministic materialized recipes. It binds exact public Egeria package versions, writes exclusively into a builder-owned sibling temporary directory, generates one portable lockfile, confirms pre-state inference, verifies the project in a separate validation copy, writes migrations and installed state last, confirms post-state inference, and publishes the still-absent destination with one rename.

The generated repository is a lightweight pnpm workspace with `apps/web` only. The delivered trees contain 25 files for `portfolio` and 27 for `site`; installed state records 43/45 managed surfaces, 5/6 capabilities, and the exact nine generation checks. Manifest, ownership, state, and inference agree.

The private CLI now exposes strict `create`, `infer`, `doctor`, and `diff` adapters with stable one-line JSON and content-free failures. All decisions remain in `builder-core`; read-only commands preserve repository bytes.

This increment does not implement existing-repository mutation, Task 8, migrations in motion, additional profiles or capabilities, Git operations, prompts, deployment, publication, providers, production state, or `apps/jobs`.

## Changed files

CLI adapter and tests:

```text
apps/cli/AGENTS.md
apps/cli/README.md
apps/cli/package.json
apps/cli/src/arguments.ts
apps/cli/src/index.ts
apps/cli/src/run-cli.ts
apps/cli/tests/cli.test.mjs
apps/cli/tsconfig.json
```

Canonical owners, plans, and records:

```text
docs/architecture/enforcement-map.md
docs/architecture/package-ownership.md
docs/implementation-evidence/2026-08-06-atomic-project-generation-preparation.md
docs/implementation-evidence/2026-08-06-atomic-project-generation-verification.md
docs/review-packets/2026-08-06-p1-task-7-atomic-project-generation.md
docs/superpowers/plans/2026-08-05-p1-builder-kernel.md
docs/superpowers/plans/2026-08-06-atomic-project-generation.md
```

Private builder-core contracts, source, templates, and tests:

```text
packages/builder-core/AGENTS.md
packages/builder-core/README.md
packages/builder-core/package.json
packages/builder-core/schemas/project.schema.json
packages/builder-core/src/catalog/verified-package-versions.ts
packages/builder-core/src/contracts/project.ts
packages/builder-core/src/generation/verify-generated-project.ts
packages/builder-core/src/generation/write-generated-project.ts
packages/builder-core/src/index.ts
packages/builder-core/templates/common/apps/web/src/content/read-content.ts
packages/builder-core/templates/site/apps/web/app/about/page.tsx
packages/builder-core/tests/contracts.test.mjs
packages/builder-core/tests/generate-project.integration.mjs
packages/builder-core/tests/generate-project.test.mjs
packages/builder-core/tests/render-skeleton.test.mjs
packages/builder-core/tests/resolution.test.mjs
```

Workspace consumers and package-boundary protection:

```text
package.json
pnpm-lock.yaml
tests/package-boundaries/internal-linting.test.mjs
tests/package-boundaries/private-packages.test.mjs
tests/package-boundaries/release-safeguards.test.mjs
```

## Focused commits

- `a0b3d76` — revalidated preparation evidence and exact-file implementation plan.
- `902b2b5` — immutable verified public-package version binding.
- `2518b65` — display-name contract and renderer-test alignment.
- `b3724b8` — atomic generation, installed state, inference agreement, and identity-bounded cleanup.
- `8ebdc2a` — isolated real generated-project verification and live integration infrastructure.
- `699fb18` — strict thin CLI project commands.
- `bda983c` — reviewer-proven invalid-root error repair.
- `a1d3438` — canonical boundary and portable-rename documentation repair.
- `1e8a3e3` — final semantic-naming constitution repair for a historical plan path.

The separate gate-artifact commit records final verification and this packet only.

## Requirement-to-evidence map

| Requirement | Evidence |
| --- | --- |
| Deterministic portfolio/site generation | Existing renderer determinism plus 21/23 source-file contracts and byte-stable generation tests |
| Authoritative installed capabilities and state | Exact 5/6 capability manifests, 43/45 managed surfaces, state-last receipt, and confirmed post-state inference |
| Atomic new-directory boundary | Builder-owned sibling temp, exclusive writes, immediate pre-rename absence check, one rename, identity-bounded cleanup and race/failure tests |
| Portable install and real build | Same exact lock hash for both profiles; fresh frozen installs; lint, typecheck, Next, and OpenNext builds |
| Supply-chain evidence | Exact public versions/integrities, moderate advisory audit, registry-signature audit, and explicit no-provenance exception |
| Thin private CLI | Production-entry tests for create/infer/doctor/diff, strict options, stable JSON/errors, invalid roots, and read-only byte equality |
| Managed/application ownership | Existing ownership materializer plus exact control-file descriptors and no validation outputs in the delivered tree |
| No later-stage behavior | Exact profiles/paths/commands, negative tests, package-boundary tests, and direct documentation |

## Verification summary

- Private builder-core build, schemas, 103/103 tests, typecheck, and zero-warning lint passed.
- CLI production-entry suite passed 9/9.
- Package boundaries passed 41/41; constitution/local links passed 20/20.
- Standards passed 14/14; observability passed 1/1.
- Builder lint, builder typecheck, frozen root install, semantic naming, and diff checks passed.
- The new packet/evidence links and semantic names passed the constitution and repository scanner under the exact Node `22.23.2`/pnpm `11.20.0` toolchain.
- The exact Task 7 Changesets comparison reported no package bump. The plain local-`main` comparison is stale and is disclosed below.
- The final live public-registry integration passed both profiles, including generation, two frozen-install contexts, lint, typecheck, Next/OpenNext builds, state/inference agreement, moderate audit, and registry-signature audit.
- Both generated profiles produced lockfile SHA-256 `55eccb2407bfdae644cfd0e51ed27cc25df481b5f10c18010e3d24d3c5f6bfeb`.

Exact commands, RED/GREEN observations, timestamps, integrity values, source links, reviewer dispositions, and claim limits are in the [verification evidence](../implementation-evidence/2026-08-06-atomic-project-generation-verification.md).

## Independent review dispositions

| Review | Material finding | Disposition |
| --- | --- | --- |
| Requirements | Real missing/file/symlink roots were emitted as successful invalid-project results | Accepted; focused RED and repair in `bda983c`; closure review clean |
| Requirements and architecture | Canonical package/CLI documentation was stale after implementation | Accepted once as a duplicate finding; direct owners and regression assertion repaired in `a1d3438`; closure reviews clean |
| Filesystem/process/supply chain | Source plan overstated portable rename as never-overwrite | Accepted; cooperative-filesystem race documented in `a1d3438`; closure review clean |
| Test evidence | No material improvement recommended | No repair required |

All relevant reviewers completed read-only. All material findings were validated against the current tree, repaired, and independently rechecked. No material finding remains.

## Risks and deferred work

- Portable Node rename gives the required visibility boundary but cannot prove atomic no-replace against a hostile actor creating the destination after the final check.
- Registry signatures passed. The two bootstrap Egeria packages have no registry attestation under the prior approved exception, so provenance is not claimed.
- The plain `pnpm run changeset:status` compares to stale local `main@8382de8` and sees earlier public-package release work. The scope-correct `pnpm exec changeset status --since ae8c2687...` passes with no package bump, and the exact Task 7 diff contains no public-package or Changeset change.
- Live evidence proves exact local install/build/audit paths, not workerd behavior, deployment, visual/translation quality, human usability, WCAG conformance, production safety, penetration resistance, or general security.
- Existing-repository transformation, migration application, clean-Git enforcement for mutation, later profiles/capabilities, persistence, email, jobs, identity, payments, analytics, CMS, forms, and `apps/jobs` remain deferred.

## Rollback and recovery

Revert the nine implementation commits in reverse order with focused revert commits, then rerun private builder verification. Revert the gate-artifact commit separately if this packet/evidence must be withdrawn.

Task 7 changed no persistent data, deployment, package publication, provider resource, Git remote, or production system. Failed generation cleanup is identity-bounded; an accepted generated destination is a new local repository owned by its caller and can be removed or retained independently.

## Approval boundary

Requested decision: approve the exact P1 Task 7 final diff reported at handoff, or request a bounded repair.

Approval closes Task 7 only. It does not authorize Task 8, push, pull request, merge, workflow dispatch, deployment, publication, provider mutation, permission change, production action, external message, or review-comment response.
