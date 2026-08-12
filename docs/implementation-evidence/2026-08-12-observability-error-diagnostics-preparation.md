# Observability Error Diagnostics Preparation Evidence

**Date:** 2026-08-12 (America/Toronto)

**Status:** Planning and independent review complete; package-only implementation is separately gated by the committed plan

**Planning base:** `2a315aa0e7dce1bf1048b9a2c07e318add9241de`

**Branch:** `observability-error-diagnostics`

**Worktree:** `.worktrees/observability-error-diagnostics`

**Design:** [Observability Error Diagnostics Design](../superpowers/specs/2026-08-12-observability-error-diagnostics-design.md)

**Plan:** [Observability Error Diagnostics Implementation Plan](../superpowers/plans/2026-08-12-observability-error-diagnostics.md)

## Authority and current scope

The user approved the safe-operational plus restricted-diagnostic design, requested an independent plan review, and authorized creation of this isolated branch/worktree and a focused planning commit. This authority covers the design, plan, preparation evidence, local read-only verification, independent read-only plan review, and their commit.

It does not authorize implementation in this planning turn, package publication, version materialization, integration to `main`, push, pull request, merge, workflow dispatch, deployment, provider/source creation or mutation, credential or environment mutation, telemetry transmission, spending, cleanup, certification execution, registry transition, or a later program increment.

## Repository identity and preserved state

- The root repository was clean at local `main` and `origin/main` commit `2a315aa0e7dce1bf1048b9a2c07e318add9241de` before the worktree was created.
- No fetch was performed because remote freshness does not affect a local planning artifact; `origin/main` is therefore only the locally recorded remote-tracking ref.
- The isolated branch `observability-error-diagnostics` was created at that exact base under the repository-ignored `.worktrees` directory.
- The initial constitution run was setup-invalid because the isolated worktree had no installed workspace dependencies. An exact offline frozen install downloaded nothing but could not complete because `@changesets/cli-2.31.1.tgz` was not cached.
- A temporary ignored symlink to the root worktree's existing builder-core dependencies supported the bounded constitution check. It was removed after each check and is not part of the Git comparison.
- The planning comparison contains only this preparation record, the design, and the implementation plan.

## Direct predecessor

The package-candidate stream's direct predecessor is the completed production-observability implementation.

- Acceptance artifact: `docs/review-packets/2026-08-10-production-observability.md`.
- Accepted comparison: `717c3bb0f048f4a4bc544100125ae42d818f09bc..45b57d2dc265ef6ba9ac805d7352a01db5f1081d`.
- Accepted revision: `45b57d2dc265ef6ba9ac805d7352a01db5f1081d`.
- The artifact states that the user gave verified-final-diff approval and that the implementation is complete.
- `rtk git merge-base --is-ancestor 45b57d2dc265ef6ba9ac805d7352a01db5f1081d HEAD` exited `0` at planning HEAD.

Before Task 1 RED work, the implementation agent must revalidate this artifact, ancestry, clean status, current capability admission, focused package baselines, and absence of overlapping writes exactly as specified by the plan.

The current `observability@0.2.0` certification is not complete. The registry subject remains:

- descriptor version `0.2.0`;
- behavior-contract digest `sha256:a4f15a132e08da307ab412673b02152fee8509c0cc1dabb4b60856abd61f5d97`;
- status `pending`;
- task plan `docs/superpowers/plans/2026-08-10-production-observability-certification.md`; and
- one accepted local `fresh-scaffold` receipt, with deployed-application and cleanup-recovery outcomes still absent.

Package-only preparation neither changes nor closes that subject. The currently approved `Task 6B -> Task 6C -> Task 6D` sequence remains unchanged. Generated diagnostics integration is a later Gate B action and cannot begin until those tasks are accepted/integrated and the canonical source plan selects diagnostics next.

## Verified current implementation

At the planning base:

- the public package is exact `@egeria-systems/observability@0.2.0` with zero runtime dependencies and root, `./server`, `./browser`, and `./testing` exports;
- safe operational events intentionally reject raw errors, messages, stacks, causes, request data, URLs/paths, headers, cookies, and arbitrary objects;
- generated browser global handlers report only a fixed source/category and discard `ErrorEvent.error` and `PromiseRejectionEvent.reason`;
- generated Next.js `onRequestError` reports only the error category and discards documented safe framework context and digest;
- Workers structured custom logs and Better Stack currently receive the same safe operational error event;
- no App Router `error.tsx` or `global-error.tsx` is generated;
- no explicit selected-catch browser/server error-reporting API exists; and
- current generated production catches are expected validation/control flow, observability failure containment, or test/configuration paths, so no application catch call site should be invented.

These facts establish the gap only. They do not prove live provider behavior.

## Current primary-source check

Planning revalidated current primary documentation:

- [Next.js error handling](https://nextjs.org/docs/app/getting-started/error-handling) distinguishes expected errors from uncaught exceptions and documents route/global error boundaries.
- [Next.js instrumentation](https://nextjs.org/docs/pages/api-reference/file-conventions/instrumentation) documents `onRequestError(error, request, context)`, digest, safe framework vocabularies, and awaited asynchronous reporting.
- [MDN Window error event](https://developer.mozilla.org/en-US/docs/Web/API/Window/error_event) documents the `ErrorEvent` received by global listeners.
- [MDN PromiseRejectionEvent](https://developer.mozilla.org/en-US/docs/Web/API/PromiseRejectionEvent/PromiseRejectionEvent) documents that rejection reason may be any value.
- [OpenTelemetry exception attributes](https://opentelemetry.io/docs/specs/semconv/registry/attributes/exception/) defines exception type/message/stack concepts and explicitly warns that exception messages may contain sensitive information.
- [Cloudflare Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/) documents structured custom logs, independent errors/uncaught exceptions, retention/limits, and pricing.
- [Cloudflare source maps](https://developers.cloudflare.com/workers/observability/source-maps/) states that uploaded maps do not deobfuscate `Error.stack` read inside a Worker.
- [Better Stack HTTP ingestion](https://betterstack.com/docs/logs/ingesting-data/http/logs/) documents injected JSON delivery and recommends bounded records.
- [Better Stack source-map uploads](https://betterstack.com/docs/errors/collecting-errors/upload-source-maps/) requires a separate Errors application and upload credential path.

The plan adds no dependency or SDK. The current base's settled builder-kernel verification already covered current pinned-package audits/signatures; dependency inputs have not changed in this planning comparison. Registry, provider, and source-map checks must be refreshed at the later package-release or external certification gate because those facts can drift.

## Independent review and dispositions

One independent read-only quality reviewer checked the design and plan against governance, canonical architecture/roadmaps, current code/tests, and the active certification subject. The reviewer did not edit or fan out.

| Finding | Disposition |
| --- | --- |
| A 16,384-byte stack conflicted with the route's 8,192-byte total request limit | Fixed by defining one exact 8,192-byte serialized browser-envelope contract, deterministic cause/stack/message reduction, exact constructor failure, unchanged route cap, and 8,192/8,193 multibyte/escaped boundary tests. Server-originated diagnostics retain the larger bound. |
| The plan omitted the mandatory direct predecessor receipt and machine gates | Fixed by naming the completed production-observability implementation, its acceptance artifact/comparison/revision, ancestry command, admission and focused baseline checks, and hard-stop conditions. |
| The plan attempted to resequence diagnostics ahead of existing generated testing without updating every canonical owner | Fixed by preserving `Task 6B -> Task 6C -> Task 6D`. Package preparation is isolated; publication/generated integration requires those predecessors plus explicit canonical selection at Gate B. |
| Service/environment context required invention outside the exact owner scope | Fixed with exact generated `service: "web"` and no generated environment value. The public package may accept an optional bounded environment token for other consumers. |
| The first disposition recheck found that hard-coded recipe `0.6.0 -> 0.7.0` collided with the earlier generated-testing owner | Fixed by freezing the accepted identical post-standards-certification recipe versions at Gate B, deriving exactly one next-minor successor, recording both exact values before RED, and regression-testing that relationship. |

The first bounded recheck confirmed the original size, predecessor, sequencing, and service/environment repairs, then retained the recipe-version collision above. After the exact correction, the final bounded disposition check returned: `No material improvements recommended.`

## Planning verification

Completed on the planning comparison with Node.js `22.23.2`:

- `rtk git diff --check` — passed;
- `rtk volta run --node 22.23.2 --pnpm 11.20.0 node scripts/check-semantic-naming.mjs` — passed;
- `rtk volta run --node 22.23.2 --pnpm 11.20.0 node --test tests/constitution/*.test.mjs` — passed, 50/50 tests;
- unresolved-marker scan across the design and plan — no unresolved planning marker or prohibited branch/file-label match; and
- repository status — only the three intended planning artifacts are present.

The constitution result includes documentation-link and semantic-naming coverage. It does not establish package implementation, browser/runtime behavior, provider receipt, diagnostic privacy, source-map behavior, deployment, cleanup, or certification.

## Stop gate

After the independent disposition recheck, focused checks, and planning commit, stop. The handoff prompt may authorize another agent to begin only the Gate A package-candidate tasks. That agent must stop at Gate A before publication or generated integration.
