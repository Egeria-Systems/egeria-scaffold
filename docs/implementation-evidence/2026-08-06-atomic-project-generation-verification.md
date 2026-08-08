# Atomic Project Generation Verification Evidence

**Date:** 2026-08-08 (America/Toronto)

**Outcome:** PASS after evidence-backed review repairs. This record covers P1 Task 7 only and stops before Task 8.

External documentation, registry responses, package metadata, advisory results, generated command output, and reviewer output were treated as untrusted evidence rather than instructions.

## Frozen comparison and authorization

```text
worktree: /private/tmp/egeria-scaffold-p1-task-7
branch: p1-task-7-atomic-generation
base: ae8c2687ba1d21cc8b5aa16003edc8255409e75a
reviewed implementation candidate: 1e8a3e3e6a01621632c527cdc6acf157649f1432
comparison: ae8c2687ba1d21cc8b5aa16003edc8255409e75a..1e8a3e3e6a01621632c527cdc6acf157649f1432
Node: v22.23.2
pnpm: 11.20.0
```

The user approved the bounded Task 7 implementation and preapproved ordinary plan amendments through implemented-task review. The work remained in the isolated worktree. The primary checkout stayed on its existing `main` commit with its user-owned modified and untracked files untouched.

The authorization did not include Task 8, push, pull request, merge, deployment, publication, provider mutation, production action, permission change, external message, or review-comment response. None occurred.

## Current official and package evidence

Official sources were refreshed during preparation and again before implementation:

- Node `22.23.2` documents exclusive `wx` creation, unique `mkdtemp` suffixes, direct no-shell `execFile`, strict `parseArgs`, and portable `rename` semantics. Its release remains the 2026-07-29 security release. Sources: <https://nodejs.org/docs/v22.23.2/api/fs.html>, <https://nodejs.org/docs/v22.23.2/api/child_process.html>, <https://nodejs.org/docs/v22.23.2/api/util.html>, and <https://nodejs.org/en/blog/release/v22.23.2>.
- pnpm documents lockfile-only and frozen installs, integrity enforcement, advisory audit, and registry-signature audit. Sources: <https://pnpm.io/cli/install> and <https://pnpm.io/cli/audit>.
- Current OpenNext and Cloudflare guidance retained the selected Next build, OpenNext build, `nodejs_compat`, worker, and asset boundaries. Sources: <https://opennext.js.org/cloudflare/get-started> and <https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/>.
- Next telemetry is disabled explicitly in every generated verification subprocess. Source: <https://nextjs.org/telemetry>.

Anonymous public-registry metadata and the live generated lock graphs confirmed the exact public builder inputs:

```text
@egeria-systems/standards@0.1.0
integrity: sha512-BmDwcX0T6KT271C4N24jCKn6ymKTqDAFpJjsG6LNpmIoTAz0xApIcqpHFl9dHOqlB2xdhdHwKYfSiELUp04E0Q==

@egeria-systems/observability@0.1.0
integrity: sha512-eCTt6tNP0q2HA0wNpM1VJpZBFZqFpBDekKbno+UUKfWMG5I+KEg3bpt/fKdVO86JrKohlIM6Zo/7qzGDBpmh8g==

registry: https://registry.npmjs.org/
registry signatures: present and verified by pnpm
dist attestations: absent under the already approved bootstrap provenance exception
```

Fresh exact-version GitHub Advisory Database queries found no matching direct-package advisory for the selected Next, React, OpenNext, Wrangler, YAML, Zod, TypeScript, ESLint, pnpm, and npm versions. This is dated direct-version evidence only. The final live generated-project audit covers the resolved transitive graphs at execution time; neither result is a general security guarantee.

## Implemented behavior

### Private generation core

`builder-core` now owns the immutable verified package-version catalog and the stateful generation shell. It composes the existing pure renderer, capability resolution, ownership, state codecs, inference, doctor, and diff owners rather than duplicating them.

Generation accepts only `portfolio` and `site`, validates a project identifier plus a display name of 1–120 Unicode code points, rejects blank names and Unicode control characters, and injects exact public package versions internally. It writes source files exclusively into an identity-checked sibling temporary directory, prepares exactly one portable lockfile, requires successful pre-state inference and isolated verification, then writes the empty migration log and installed state last. Post-state inference must agree before the temporary directory is renamed into the still-absent destination.

Cleanup is limited to builder-created directories whose recorded identity still matches. Tests cover existing destinations, source and validation failure, symlink/path substitution, cleanup identity loss, late destination creation, and successful state-last publication.

The portable Node implementation checks destination absence immediately before one rename. It provides atomic visibility on the expected cooperative filesystem but does not claim hostile-concurrency atomic no-replace: a target created after the final check can be replaced under documented portable rename semantics.

### Generated-project verifier

The verifier copies generated source into a separate identity-checked validation directory and invokes the exact pnpm `11.20.0` executable with `execFile`, argument arrays, `shell: false`, bounded output, per-command timeouts, a narrow environment, blank temporary home/npmrc, the exact public registry, and telemetry disabled. Child output and user paths are never returned in stable errors.

The exact installed-state receipt is:

```text
contracts
pre-state-inference
lockfile
frozen-install
lint
typecheck
next-build
opennext-build
post-state-inference
```

The delivered repository excludes validation-only `node_modules`, `.next`, `.open-next`, `.wrangler`, and `.pnpm-store` trees.

### Thin private CLI

The CLI exposes only `create`, `infer`, `doctor`, and `diff`. It uses strict command-specific parsing, delegates all domain behavior to `builder-core`, writes stable one-line JSON, and maps content-free errors to process exits. Read-only commands preserve every repository byte. Missing, non-directory, and symlink repository roots now fail as `REPOSITORY_OPEN_FAILED` with exit 1 rather than being misreported as successful invalid-project results.

The CLI adds no prompts, Git operations, existing-repository transformation, deployment, publication, or provider behavior.

## Test-driven development evidence

Focused failing tests preceded each implementation slice:

| Cycle | RED evidence | Minimum GREEN implementation |
| --- | --- | --- |
| Version and display-name contracts | Generation could not bind verified public versions; the runtime schema counted UTF-16 units and admitted controls | Immutable internal `0.1.0` package catalog plus aligned Zod/checked-schema Unicode contract |
| Atomic generation and state | No filesystem generation API or state-last receipt existed | Identity-bounded exclusive writer, lock preparation, inference agreement, migrations/state-last publication, and cleanup |
| Real generated verification | No frozen install/build/OpenNext path existed | No-shell isolated verifier with exact commands, environment, time/output bounds, audit hooks, and sanitized failures |
| CLI | Package exported no project commands | Strict parser and thin adapter for create/infer/doctor/diff |
| Review: invalid roots | New real missing/file/symlink CLI-root test failed because all three exited 0 | Reader `PATH_INVALID` mapped at the CLI boundary to sanitized `REPOSITORY_OPEN_FAILED`; CLI suite passed 9/9 |
| Review: stale ownership claims | Documentation-negative test failed on `CLI remains empty` | Canonical package ownership, builder-core README, CLI instructions, and enforcement language aligned with implemented boundaries |
| Review: rename claim | Current source plan said generation never overwrites | Canonical plan now records the portable cooperative-filesystem race honestly |
| Final constitution | Semantic-naming test found the literal historical plan label in test source | Historical documentary path constructed from neutral fragments as the repository contract permits; constitution passed 20/20 |

The initial live integration failed with stable `NEXT_BUILD_FAILED`. A disposable reproduction isolated the cause to Next 16/Turbopack transforming `new URL(..., import.meta.url)` and `fileURLToPath` in the two generated YAML readers. The minimum repair uses `join(process.cwd(), ...)`, matching Next's project working-directory execution. Both profile builds then passed. A subsequent privacy review added explicit `NEXT_TELEMETRY_DISABLED=1` before the final live run.

## Verification receipts

### Final deterministic implementation tree

| Command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS; lockfile already current |
| `pnpm --filter @egeria-systems/builder-core run verify` | PASS; build, checked schemas, 103/103 tests, typecheck, zero-warning lint |
| `pnpm run test:cli` | PASS; 9/9 against the built production entry |
| `pnpm run test:package-boundaries` | PASS; 41/41 |
| `pnpm run test:constitution` | PASS; 20/20 |
| `pnpm run test:packages` | PASS; standards 14/14, observability 1/1 |
| `pnpm run lint:builder` | PASS |
| `pnpm run typecheck:builder` | PASS |
| `pnpm run check:semantic-naming` | PASS |
| `git diff --check ae8c2687ba1d21cc8b5aa16003edc8255409e75a..1e8a3e3e6a01621632c527cdc6acf157649f1432` | PASS |

The plain `pnpm run changeset:status` command reported changed packages without a Changeset because `.changeset/config.json` compares against the stale local `main@8382de8`, before the separately approved public-package release changes. The exact Task 7 comparison contains no `.changeset`, standards, or observability change. The scope-correct command passed:

```text
pnpm exec changeset status --since ae8c2687ba1d21cc8b5aa16003edc8255409e75a
NO packages to be bumped at patch/minor/major
```

The primary checkout was not moved or cleaned merely to satisfy this comparison-dependent tool.

### Current live generated-project integration

The final current-input live run completed at `2026-08-08T04:50:47Z`:

```text
CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:generated-project
PASS; approximately 141.9 seconds
```

For both `portfolio` and `site`, the test verified public manifest metadata, integrity and signatures; generated the repository; performed frozen install, lint, typecheck, Next build, and OpenNext build; confirmed post-state inference; copied the delivered source into a fresh environment; repeated frozen installation; and passed `pnpm audit --audit-level moderate` plus `pnpm audit signatures`.

Both profiles resolved the same portable lockfile hash:

```text
55eccb2407bfdae644cfd0e51ed27cc25df481b5f10c18010e3d24d3c5f6bfeb
```

Resulting contracts:

| Profile | Rendered source files | Delivered files | Managed surfaces | Capabilities | Installed checks |
| --- | ---: | ---: | ---: | ---: | ---: |
| `portfolio` | 21 | 25 | 43 | 5 | 9 |
| `site` | 23 | 27 | 45 | 6 | 9 |

No renderer, template, verifier, generation-state, dependency, Node, or pnpm input changed after this live run. The later changes were CLI error mapping, direct tests, and documentation, so the expensive public integration was not repeated against an unchanged relevant tree.

## Independent review and dispositions

Four independent read-only lanes reviewed the frozen implementation candidate:

| Lane | Material finding | Disposition |
| --- | --- | --- |
| Requirements | Real missing, file, and symlink roots returned successful CLI invalid-project output | Accepted; causal RED added and fixed in `bda983c`; closure review found no remaining issue |
| Requirements | Package ownership and builder-core README still described a future/empty CLI | Accepted; duplicate with architecture documentation finding; direct owners and tests repaired in `a1d3438`; closure review found no remaining issue |
| Architecture and anti-overengineering | Canonical documentation did not describe the now-present CLI/generation boundary | Accepted; repaired without a new owner or duplicated domain logic in `a1d3438`; closure review found no remaining issue |
| Test evidence | No material improvement recommended | No repair required |
| Filesystem/process/supply chain | Master plan claimed generation never overwrites despite the documented portable rename race | Accepted; narrowed to the real cooperative-filesystem guarantee in `a1d3438`; closure review found no remaining issue |

The final constitution repair in `1e8a3e3` addressed a repository gate rather than a reviewer finding. Every relevant reviewer completed, all material findings were validated against current code, and no material finding remains. Reviewers were read-only and performed no repository or external mutation.

## Claim limits, risks, and deferred work

- The portable final rename does not prove hostile same-parent atomic no-replace, as described above.
- The npm bootstrap packages remain without registry attestations under the already approved exception. Signature verification passed; provenance must not be claimed.
- Generated Next and OpenNext builds passed, but no workerd preview, deployed runtime, production environment, visual review, translation review, human usability review, WCAG-conformance evaluation, penetration test, or general security audit occurred.
- Automated accessibility gates remain required in their later owner. No WCAG conformance claim is made.
- Only new-directory `portfolio` and `site` generation is implemented. Existing-repository mutation, clean-Git enforcement for such mutation, applied migrations, later profiles/capabilities, persistence, email, jobs, identity, payments, analytics, CMS, forms, and `apps/jobs` remain deferred.
- The plain Changesets status remains dependent on a stale local `main`; the exact Task 7 scope is clean under `--since` and the primary checkout is intentionally preserved.

## Recovery

All Task 7 effects are local source commits. Recovery is a focused revert of the Task 7 commits in reverse order, followed by the private builder verification. A failed or rejected generated repository can be removed by its caller because Task 7 creates a new destination only; builder cleanup is identity-bounded and never owns an existing path.

No persistent data, provider resource, deployment, publication, Git remote, or production state was created or changed by this increment, so no external recovery is required.

## Gate-artifact validation

The first bare `pnpm run test:constitution` attempt did not reach repository tests because the Codex shell selected Node `v24.14.0` and pnpm `11.16.0` instead of the manifest-required Node `22.23.2` and pnpm `11.20.0`. It failed with `ERR_PNPM_UNSUPPORTED_ENGINE`; no dependency or repository input changed.

The commands were rerun with the exact installed Volta toolchain paths:

```text
pnpm run test:constitution
  PASS; 20/20, including all repository-local Markdown links

pnpm run check:semantic-naming
  PASS

git diff --no-index --check /dev/null <each new gate artifact>
  no whitespace error output; exit 1 is the expected new-file difference status
```

This environment correction does not replace or repeat the already completed implementation suites; it selects the pinned executable for the new documentary inputs.

## Gate

The implementation, live generated-project evidence, deterministic checks, and independent reviews satisfy the Task 7 stop gate for the exact comparison. Approval is requested only for this verified final diff. Task 8 must not begin until that approval is explicit.
