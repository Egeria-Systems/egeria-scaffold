# Production Observability Certification Retry Repair Review Packet

**Date:** 2026-08-12 (America/Toronto)

**Status:** Local repair implemented, fully verified, and independently reviewed; awaiting verified-final-diff approval

**Comparison:** `2c7533edf96de6d95f45406abe65ba4432c43d4e` to the current uncommitted `main` working tree

**Registry outcome:** `observability@0.2.0` remains `pending`; `certifications/capabilities.json` is unchanged

## Outcome

The first protected-staging attempt completed its manual workflow and produced all four bounded receipts, but failed certification because the provider inventory contained no `browser.web.vital` event by the five-minute deadline. Clean compatibility recovery restored the shared Worker baseline and made the certification route unreachable. Historical provider aggregates were used only for diagnosis and cannot satisfy certification.

The local repair corrects two source defects without changing the published observability package, capability descriptor, workflow credential boundary, provider configuration, or registry:

- generated web-vital operational attributes and the matching route envelope now use the package-required lower snake-case names `metric_name` and `navigation_type`;
- the browser route keeps direct URL-origin equality and adds a narrowly bounded development/proxy fallback requiring a canonical HTTP(S) Origin, exact Origin-host/Host equality, matching protocol, and `Sec-Fetch-Site: same-origin`.

Malformed, opaque, non-HTTP(S), cross-origin, and fallback requests without the browser fetch-metadata assertion remain rejected. The generated portfolio, portfolio-Calendly, and site fixtures, their managed-surface fingerprints, and current exact-toolchain lockfile output are reconciled.

This is a retry repair, not certification. No fresh workflow was dispatched, no provider was inspected or changed, no telemetry was sent, no GitHub environment or secret was changed, and no registry transition occurred during this repair.

## First attempt and recovery evidence

- Manual workflow run `31555136425` checked and deployed revision `2c7533edf96de6d95f45406abe65ba4432c43d4e` and produced four bounded receipt artifacts.
- The bounded deployment receipt identified Cloudflare deployment `d0ebc6de-d2c6-414b-ba0e-c6e831b10751` and version `d67f2513-25e0-4ebf-96ad-0cd6b567e362`.
- Route-envelope and actual generated-browser request acceptance evidence passed, but both provider aggregates contained zero `browser.web.vital` events at the deadline. The attempt failed and was not rerun.
- Separately approved compatibility run `31556831190` restored clean version `4ba01d1e` as the sole active version. Status-only checks returned `200` for the compatibility route and `404` for the certification-only error route; no response body was read.
- The Better Stack source and four GitHub environment secrets were retained only for the pending repair/retry decision. Their final disposition remains a later cleanup checkpoint owned by the user.

## Changed files

The repair comparison changes 21 existing files and adds this packet:

- `docs/implementation-evidence/2026-08-11-production-observability-certification-preparation.md`
- `docs/implementation-evidence/production-observability-provider-receipt-template.md`
- `docs/superpowers/plans/2026-08-10-production-observability-certification.md`
- the observability route, browser reporter, lockfile, and matching managed fingerprints under `fixtures/generated/portfolio`
- the same generated surfaces under `fixtures/generated/portfolio-calendly`
- the same generated surfaces under `fixtures/generated/site`
- `packages/builder-core/templates/common/apps/web/app/api/observability/route.ts`
- `packages/builder-core/templates/common/apps/web/src/infrastructure/observability/browser-reporter.ts`
- `packages/builder-core/tests/render-skeleton.test.mjs`
- `scripts/exercise-production-observability.mjs`
- `tests/capability-certification/production-observability.test.mjs`
- `tests/constitution/constitution.test.mjs`
- `docs/review-packets/2026-08-12-production-observability-certification-retry-repair.md`

Generated lockfile changes are limited to current generator-selected browser-data transitives: `electron-to-chromium` `1.5.403` to `1.5.404` and `update-browserslist-db` `1.3.0` to `1.3.1`. Direct dependencies, manifests, the repository lockfile, and pinned Node, pnpm, Next.js, OpenNext, Playwright, and Wrangler versions are unchanged.

## Test-driven evidence

- The first focused browser-reporter test failed because the published package rejected camel-case attribute names. The route and deployed exercise tests also failed against the required snake-case envelope. After the minimum name repair, all focused cases passed.
- The valid web-vital event then exposed a development-browser `403`: Next.js reconstructed `request.url` with a different loopback hostname while the browser Origin matched the network Host. A focused proxy-origin case first failed `403 !== 202`; the bounded same-origin fallback made it pass.
- A focused non-HTTP(S) direct-origin case then failed `202 !== 403`; the explicit protocol guard made it pass. Malformed and cross-origin rejection cases also pass.
- Final review found that the fallback's Host and protocol predicates were not independently regression-protected once `Sec-Fetch-Site: same-origin` was present. Two focused `403` cases now isolate a mismatched Host and mismatched protocol. Removing either corresponding production predicate produced the expected RED `202 !== 403`; restoring both produced focused GREEN.
- The generated browser-reporter mock now enforces the package attribute-name grammar and allowlist, so a rejected event cannot be mistaken for a delivered request.

## Verification evidence

- Directly affected suites passed 92/92: builder-core render-skeleton 35/35, production-observability certification 14/14, and constitution 43/43.
- Exact-toolchain generated-fixture determinism passed 8/8 with 43 portfolio, 48 portfolio-Calendly, and 45 site files byte-stable.
- The first aggregate fixed-root verifier run after the route correction passed development browser checks but reported the generic `BROWSER_PREVIEW_FAILED`. No source was changed in response.
- A sanitized isolated portfolio preview then passed all 6/6 browser checks. Full fixed-root verification passed for `portfolio-calendly` and `site`, including frozen install, peer checks, moderate audit, registry signatures, lint, Cloudflare types, typecheck, Next/OpenNext builds, pinned browser installation, development browser checks, and preview browser checks. This evidence identifies the aggregate preview result as transient rather than a supported source defect.
- `git diff --check` passed, and each committed generated route is byte-identical to its template with matching managed fingerprint.
- Final settled-tree `pnpm run verify:builder-kernel` exited `0`: constitution 50/50; package boundaries 45/45; builder-core 136/136; CLI 10/10; capability certification 20/20; admission accepted seven records; generated fixtures 8/8 with 43/48/45 byte-stable files; builder lint, build, and typecheck passed; the aggregate fixed-root verifier passed all three fixtures through frozen install, peer checks, moderate audit, registry signatures, lint, Cloudflare types, typecheck, Next/OpenNext builds, pinned browser installation, development browser checks, and preview browser checks; Changesets reported no package bump.

The diagnostic browser copy recorded only bounded status and equality classifications. It did not open or retain a raw console message, request field, trace, stack, provider record, ingestion host, private URL, secret, or real traffic content.

## External actions during repair

- Official GitHub, Cloudflare, Better Stack, OpenNext, Next.js, Playwright, Node, pnpm, and security documentation was revalidated against the repository-pinned toolchain and current provider contracts.
- Public npm registry reads and Playwright browser downloads supported isolated local verification. These were read/download actions only; no package was published and no provider account resource was changed.
- No Brave tab was focused or changed during local repair. The logged-in three-tab Brave window remains reserved for the separately approved live retry and aggregate-only provider inspection.
- A final portability scan found no absolute home path, user-specific tool path, or diagnostic temporary path in this repair's added lines, executable/configuration surfaces, or review packet. One older absolute worktree path in the modified preparation record was normalized to its repository-relative form. Older historical evidence elsewhere in the repository still contains machine-specific provenance paths and requires a separate evidence-migration decision rather than silent rewriting in this certification repair.

## Review disposition

The earlier bounded requirements review found no material improvement in the snake-case repair. Final independent review of the complete same-origin repair found one Important test-protection gap: the Host and protocol predicates were not independently protected when fetch metadata already asserted `same-origin`. The two focused RED/GREEN mutations above repaired that gap. The same reviewer rechecked the exact disposition after the post-review full gate and returned `No material improvements recommended.` No reviewer authorized push, workflow dispatch, provider inspection, evidence acceptance, or registry transition.

## Risks and claim limits

- The repair has not yet been deployed. It does not prove fresh GitHub workflow execution, provider delivery, retention, quota, cost, data residency, or cleanup.
- The direct URL-origin path is unchanged. The fallback depends on browser-controlled fetch metadata and the network Host presented to the application; final local browser matrices and one bounded deployed journey are required evidence for the exact environments tested.
- Cloudflare and Better Stack delivery remains best-effort and non-durable. No queue, Tail Worker, database, analytics, retry service, or background job was added.
- The first attempt's brief Cloudflare invocation-summary exposure remains a disclosed handling defect; no raw record was opened or copied.
- Automated checks do not establish durable delivery, production readiness, performance, visual approval, human accessibility, WCAG conformance, security completeness, or ongoing provider availability.
- Task 6C and the unrelated preserved preparation stream remain untouched.

## Recovery and next checkpoints

Source recovery is a focused revert of the eventual repair commit followed by the affected deterministic gates; it does not recover deployment or provider state. No reset, rebase, merge, or cherry-pick is part of recovery.

After final verification and independent review, stop for verified-final-diff approval. Only after an approved commit and push may the exact new `origin/main` SHA be fetched and revalidated, live protections and no-spend boundaries rechecked, and exactly one new manual observability workflow run dispatched with the ten-minute hard deadline. Provider inspection remains aggregate-only, no faster than every 30 seconds. Cleanup/recovery, evidence acceptance, and any later pending-to-certified registry diff remain separate checkpoints.
