# Observability Error Diagnostics Package Verification Evidence

**Verification date:** 2026-08-12 (America/Toronto)

**Status:** Local package candidate implemented, independently reviewed, materially repaired, and verified; exact-diff approval and every later gate remain pending

**Authorized package base:** `80d85cc2a45a5c0f7e0dc6ec57311538f62aa7df`

**Verified implementation tree before final repair evidence:** `2ee05d0644a0bd8ae2f05e47dfed791248098705`

**Branch and worktree:** `observability-error-diagnostics` at `/Users/CoveMB/Code/CoveMB/egeria-scaffold/.worktrees/observability-error-diagnostics`

The authorized base is the clean merge of planning commit `ab42a280e953b0dfb5d837290de323c5afd0c56b` with the then-latest local `main`/`origin/main` state `12ecc73a8337ab12ece9dd3a6b2aec03f940383c`. Remote refs were not fetched because the user authorized that exact latest local state and this increment performs no remote, publication, provider, or deployment action.

## Result

The package now separates privacy-safe operational events from restricted error reports. Schema `2.0.0` requires bounded `eventId` and `service`, supports a genuine optional `correlationId`, and adds guarded exception diagnostics, fixed redaction markers, deterministic FNV-1a grouping, two-link causes, explicit diagnostic sinks, Better Stack diagnostic serialization, and distinct bounded browser error envelopes.

`OperationalSink` remains compile-time and runtime safe-only. `DiagnosticSink` accepts only branded reports and exposes no public replacement metadata. A package-private nominal registration lets only the Better Stack diagnostic adapter replace the same Better Stack safe adapter; an arbitrary diagnostic sink cannot suppress Workers or another safe sink. The package remains framework-neutral and has zero runtime dependencies.

The manifest intentionally remains `0.2.0`. The new minor Changeset records target `0.3.0` intent only. No version was materialized and no artifact was published.

## Strict TDD evidence

The implementation used focused RED/GREEN cycles before each production change:

- package-contract tests initially failed because schema `2.0.0`, error-report types/constructors, guarded diagnostics, and their root exports were absent; after the minimum implementation, the focused and full package checks passed before commit `4c71ea1`;
- dispatch, serializer, Better Stack diagnostic, and testing-sink tests initially failed on missing APIs and delivery behavior; after implementation, the package passed before commit `4ef9572`;
- browser tests initially failed on absent error-envelope and diagnostic-sink behavior; exact 8,192/8,193-byte cases passed after deterministic cause, stack, then message reduction before commit `6eacc5f`; and
- independent review repairs were test-first. The focused run reproduced credential leakage, a hostile root getter escaping reconstruction, and forged no-stack fingerprints being accepted: 15 of 18 focused browser/diagnostic tests passed and three failed. Provider serialization independently reproduced the same credential leakage. After the minimum repair, build, lint, all 45 package tests, and typecheck passed before commit `1fa0868`.

The approved post-candidate repairs also followed focused RED/GREEN cycles:

- credential and spaced-path tests first produced three expected failures in a 19-test focused run, then passed 19/19 after the shared redactor repair;
- an arbitrary replacement declaration suppressed Workers in the runtime RED run, while the packed consumer produced an unused `@ts-expect-error` in the declaration RED run. The focused runtime and packed-boundary checks then passed 17/17 and 4/4 after replacement metadata became package-private and nominal;
- the browser-priority regression first failed because the minimum stack was absent, then passed 10/10 after the stack minimum was carried into message reduction; and
- the final reviewer found escaped quotes inside quoted credentials and parenthesized path segments. The bounded repair-round RED run passed 17/20 with three expected failures, then passed 20/20 after the minimum pattern correction.

The exact bound tests preserve 2,048 message bytes, 16,384 stack bytes, and 64 stack lines, and mark the first overflow. The browser-order tests use discriminating fixtures where cause removal alone fits, then stack reduction alone fits without changing the message, and only then message reduction is exercised.

## Independent review dispositions

Four read-only lenses assessed the exact Gate A package candidate. No reviewer edited the tree, recursively delegated, commented on GitHub, or performed external action.

| Review | Material finding | Disposition |
| --- | --- | --- |
| Requirements | Identifier equality suppressed an unrelated Workers safe sink | Fixed with an explicit diagnostic replacement identifier and a collision regression; only the Better Stack pair deduplicates |
| Requirements and architecture | Hostile Proxy `has` and root `get` traps could escape reconstruction | Fixed with guarded structural-key checks and a contained root reconstruction boundary; both regressions return stable input-invalid results |
| Requirements | Root Unix, Windows, and UNC absolute paths escaped redaction | Fixed with root-form patterns and exact negative assertions |
| Architecture | Package instructions could prohibit the sanitized stack URLs allowed by the approved design | Fixed by distinguishing standalone request/page URLs and unredacted absolute paths from approved sanitized stack frames |
| Security/privacy | Assignment-key variants, known token prefixes, and URI userinfo could reach reports/provider serialization | Fixed with expanded common-shape redaction and public report plus provider-serialization regressions; fixed markers remain explicit |
| Security/privacy | No-stack and digest-only fingerprints were not always recomputed | Fixed with unconditional reconstruction validation and browser-side recomputation after bounded stack changes |
| Test evidence | Runtime export tests did not causally prove compile-time sink-tier separation | Fixed with a packed public TypeScript consumer that accepts the correct calls and uses `@ts-expect-error` for both cross-tier calls |
| Test evidence | Sensitive-shape, exact server-bound, and browser reduction-order assertions were incomplete | Fixed with table-driven privacy cases, exact boundary/first-overflow cases, provider serialization, and discriminating reduction fixtures |
| Independent self-review | Quoted JSON, Basic authorization, quoted multi-word secrets, and multi-value cookies could retain credential suffixes | Fixed with complete line-bounded values, escape-aware quoted values, report tests, and provider-serialization tests |
| Independent self-review | Absolute Unix, Windows, and UNC prefixes with spaces or parenthesized directory segments could retain private path suffixes | Fixed by permitting those characters only in separator-terminated directory segments while retaining the bounded filename/frame evidence |
| Independent self-review | Public replacement metadata let an arbitrary diagnostic sink suppress Workers delivery | Fixed with package-private nominal registration used only by the Better Stack diagnostic adapter; runtime collision and packed declaration regressions pass |
| Independent self-review | Browser fitting could omit the stack before reducing the message | Fixed by preserving the minimum top-frame stack plus marker while the message is reduced; the envelope remains at or below 8,192 bytes |

The single fresh post-fix reviewer examined only the four approved repairs and repair-caused regressions. It found the two additional credential/path variants above; after the one bounded repair round, it re-ran direct reproductions and focused checks and reported: `No material improvements recommended.`

## Verification

All commands used Node.js `22.23.2`, pnpm `11.20.0`, and the repository-required `rtk` prefix. The isolated worktree dependency graph was unchanged but its ignored install could not be refreshed without registry DNS. Verification therefore reused the primary checkout's installed ignored dependency directories through temporary links and passed pnpm's non-mutating dependency-status warning mode. This did not change any source, manifest, lockfile, registry, provider, credential, or certification state.

| Exact command | Result | Evidence boundary |
| --- | --- | --- |
| `rtk volta run --node 22.23.2 --pnpm 11.20.0 pnpm --config.verify-deps-before-run=warn --filter @egeria-systems/observability run verify` | PASS; build, lint, `48/48` tests, typecheck | Package source and behavior |
| `rtk volta run --node 22.23.2 --pnpm 11.20.0 node --test tests/package-boundaries/public-observability.test.mjs` | PASS; `4/4` | Exact public exports, packed runtime consumer, compile-time tier separation, strict compilation, and zero runtime dependencies |
| `rtk volta run --node 22.23.2 node --test tests/package-boundaries/release-safeguards.test.mjs` | PASS; `8/8` | Public-package manifest, license, version intent, build ordering, and exact tarball inventory |
| `rtk volta run --node 22.23.2 node --test tests/constitution/*.test.mjs` | PASS; `52/52` assertions | Repository governance, links, and invariant checks |
| `rtk volta run --node 22.23.2 node scripts/check-semantic-naming.mjs` | PASS | Tracked and non-ignored authored paths/content |
| `rtk volta run --node 22.23.2 --pnpm 11.20.0 pnpm --config.verify-deps-before-run=warn changeset status` | PASS; observability is the only minor bump | Local version intent only |
| `rtk git diff --check` | PASS; no output | Whitespace integrity |

The package-boundary suite's packed-consumer test builds immediately, packs to a temporary directory, extracts without installation, imports all exact runtime subpaths by package name, and compiles against the packed declarations. The release-safeguard test separately validates the exact tarball file inventory. The manifest has no `dependencies` entry and the boundary test proves zero runtime dependencies.

## Compatibility, risks, and claim limits

- Schema `2.0.0` is intentionally not backward compatible with the published pre-1.0 `0.2.0` schema. Compatibility remains available only through the unchanged published package; no dual-schema overload was added.
- Regex redaction is defense in depth, not a privacy guarantee. Unexpected sensitive shapes may remain possible; data minimization and provider access, region, retention, deletion, and operator handling require separate review.
- Local Node and injected-adapter tests do not prove a real browser, Cloudflare runtime, Workers Logs or Better Stack receipt, source maps, deployment, provider availability, quota/spend, or production behavior.
- No generated application consumes this source candidate. No generated integration, fixture, template, state, capability descriptor, migration, certification record, workflow, secret, provider resource, or deployment file was changed.
- Local `main` and `origin/main` advanced from the admitted `12ecc73a8337ab12ece9dd3a6b2aec03f940383c` state to `4e7e68a5b5d8232137b6d4e0f7b7b03896f6ac7e` while this candidate was under review. Revalidation found overlap only in `tests/package-boundaries/release-safeguards.test.mjs` and no textual conflict in the local merge-tree preview. No rebase or merge was authorized, so final integration freshness remains pending.
- The target remains `pending`; its certification plan was not executed and no production-readiness or privacy-completeness claim is made.

## Rollback and recovery

Source recovery is a focused newest-first `git revert`, never reset or history rewriting, across the final repair-evidence commit, `2ee05d0`, `1bac217`, `6a08c0d`, `195787b`, `1fa0868`, `6eacc5f`, `4ef9572`, and `4c71ea1` as far as the desired recovery boundary. The merge base `80d85cc` is the recovery boundary.

No version, registry artifact, provider resource, credential, deployment, generated state, or persistent data was created. There is therefore no current registry, provider, credential, deployment, or data cleanup action. Any future action in those domains needs its own authorization and recovery plan.

## Stop condition

This is the reviewed local Gate A package candidate only. Stop after the final evidence commit and its affected checks. Task 5+, version materialization, publication, push, pull request, merge, deployment, provider configuration, generated integration, and certification-state changes remain unauthorized.
