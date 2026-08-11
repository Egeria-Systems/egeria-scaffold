# Generated Unit and Component Testing Preparation Evidence

Date: 2026-08-11

## Scope and authority

This record prepares the approved generated unit and component testing increment. It authorizes only local implementation and verification on branch `generated-unit-component-testing` in the ignored isolated worktree `.worktrees/generated-unit-component-testing`. It authorizes focused commits required by the approved increment method.

It does not authorize a push, pull request, merge, publication, deployment, workflow dispatch, provider mutation, secret access, permission change, production action, or response to review comments.

The user explicitly authorized this worktree from current `main` while production-observability certification remains in progress, and preapproved evidence-backed plan amendments through presentation of the implemented-task review. The implementation plan records that narrow independent-work exception. Task 6C must preserve the separate observability subject, evidence, workflow, branch, and worktree exactly; it does not certify Task 6B or import later Task 6B changes.

## Frozen repository identity

- source checkout: `/Users/CoveMB/Code/CoveMB/egeria-scaffold`;
- implementation worktree: `/Users/CoveMB/Code/CoveMB/egeria-scaffold/.worktrees/generated-unit-component-testing`;
- branch: `generated-unit-component-testing`;
- base: `main@f4f682d4c711dc86a0158ab7f05393d5c33f0160`;
- local `main` and local `origin/main`: exact match at the frozen base; remote refs were not fetched because the user selected current local `main` and remote freshness does not alter this local source-bound increment;
- base status: clean;
- accepted direct predecessor: production-observability implementation comparison `717c3bb0f048f4a4bc544100125ae42d818f09bc..45b57d2dc265ef6ba9ac805d7352a01db5f1081d`, approved in its review packet; and
- ancestry: accepted revision `45b57d2dc265ef6ba9ac805d7352a01db5f1081d` is an ancestor of the frozen base.

The separate `observability-certification` worktree was clean when inspected. No worktree then modified the Task 6C exact-file scope. If that changes, or if later Task 6B integration overlaps this branch, reconciliation is a new review decision rather than an implicit merge.

## Repository sources inspected

Preparation read the root constitution and applicable nested `AGENTS.md` files for the CLI, builder core, standards, observability, compatibility proof, generated template root/web, and all retained generated fixtures. It also read:

- the approved source plan and program roadmap;
- architecture overview, capability model, package ownership, and enforcement map;
- the review and contribution protocol;
- all accepted ADRs and their index;
- the Next.js/Cloudflare compatibility record and nested proof instructions;
- executable project, profile, capability, certification, state, and migration contracts plus checked JSON Schemas;
- current root, workspace, CLI, package, proof, generated-template, and retained-fixture manifests;
- current capability catalog, profile recipes, template catalog, inference, diagnostics, state ownership, generation, and fixed-root verification implementations;
- the approved Task 6C design, implementation plan, and separate Task 6D certification plan; and
- production-observability implementation and certification preparation, verification, and review packets plus generated browser-foundation evidence.

The accepted ADRs do not conflict with the selected design. The approved source plan and Task 6C design did conflict with the user's newer instruction only on Task 6B sequencing; the consolidated resolution is recorded below.

## Frozen current contracts

- Profile recipes are `0.6.0` for both `portfolio` and `site`.
- The hybrid `standards@0.2.0` descriptor owns the existing generated lint, type, browser, accessibility, and quality-workflow surfaces and is recorded as `backfill-pending` with subject digest `sha256:a3a020b778c1ccfa24e0bfc951fcdf5eb74b50728f69e960124c6bae6a757311`.
- `observability@0.2.0` remains `pending` with subject digest `sha256:a4f15a132e08da307ab412673b02152fee8509c0cc1dabb4b60856abd61f5d97` and one reviewed local `fresh-scaffold` evidence item. Protected-staging, provider receipt, cleanup, and certification are absent.
- Generated repositories install exact public `@egeria-systems/standards@0.1.0` and `@egeria-systems/observability@0.2.0`. This increment does not publish or change either public package.
- Project and state schema version remains `1.0.0`.
- The generated verification tuple is `contracts`, `pre-state-inference`, `post-state-inference`, `lockfile`, `frozen-install`, `lint`, `typecheck`, `next-build`, `opennext-build`.
- The retained fixtures are `portfolio`, `portfolio-calendly`, and `site`; each already passes deterministic regeneration, state/inference/diff, audit/signatures, Wrangler types, lint/typecheck, Next/OpenNext builds, and local development/workerd browser suites on the frozen base.

The successor contract is frozen as `standards@0.3.0` and recipe `0.7.0`. This is a material minor capability/recipe change, not a public-package release. It inserts `unit-tests` and `component-tests` after `typecheck` and before build checks, and creates an ordinary pending standards subject linked to Task 6D.

## Official documentation revalidation

- [Next.js Vitest guidance](https://nextjs.org/docs/app/guides/testing/vitest) continues to recommend Vitest, jsdom, React Testing Library, Vite's React plugin, and tsconfig-path resolution for synchronous components. It explicitly defers async Server Components to end-to-end tests; Task 6C retains Playwright for those/browser boundaries.
- [Vite shared options](https://vite.dev/config/shared-options.html#resolve-tsconfigpaths) now provide native `resolve.tsconfigPaths`. The first isolated generated run emitted Vite's deprecation warning for the separate plugin, so the preapproved plan was amended to remove `vite-tsconfig-paths@6.1.1` and use the native Vite 8 option instead.
- [Vitest projects](https://vitest.dev/guide/projects) and [Vitest CLI guidance](https://vitest.dev/guide/cli) support named projects plus explicit run/watch commands. Generated configuration therefore uses distinct `unit` and `component` projects rather than one ambiguous environment.
- [Testing Library setup](https://testing-library.com/docs/react-testing-library/setup/) supports explicit cleanup when test globals are disabled. [user-event setup](https://testing-library.com/docs/user-event/setup/) uses `userEvent.setup()` for interaction state. The generated setup imports `@testing-library/jest-dom/vitest` and starter component tests use semantic queries and user events.
- [Cloudflare Workers Vitest integration](https://developers.cloudflare.com/workers/testing/vitest-integration/) is specifically for Workers-runtime/binding behavior. No current generated portfolio/site capability owns a D1, KV, R2, Queue, Durable Object, or other binding, so Workers Vitest remains deferred to the accepted later application-persistence boundary.
- [jsdom](https://github.com/jsdom/jsdom) supplies a DOM emulation, not layout, browser, deployed-worker, or accessibility-conformance evidence. Task 6C does not use it for CSS layout, focus visibility, iframe behavior, routing, async Server Components, or complete journeys.
- [Node.js 22 releases](https://nodejs.org/en/download/archive/v22) retain the exact repository pin `22.23.2`, which satisfies every selected engine floor. No runtime pin changes.

No coverage provider/threshold, Vitest Browser Mode, MSW, Cypress, `fast-check`, or Workers pool is added. Real-browser development and OpenNext/workerd Playwright/axe checks remain separate mandatory fixed-root evidence. Automation does not establish WCAG conformance or human usability.

## Exact generated dependency selection

Registry metadata was queried on 2026-08-11. Every selected artifact is MIT licensed, older than the repository's one-day maturity floor, exposes registry signature metadata, and returned zero exact-version matches from GitHub's reviewed advisory API. Final lockfile resolution, peer checks, moderate audit, and signature verification remain mandatory because exact direct-package searches do not prove the transitive graph safe.

| Package | Exact version | Relevant engine/peer contract | SHA-512 registry integrity |
| --- | --- | --- | --- |
| `vitest` | `4.1.10` | Node `^20 || ^22 || >=24`; Vite `^6 || ^7 || ^8` | `sha512-R9jUTe5S4Qb0HCd4TNqpC7oGcrMssMRGXLW80ubjWsW9VH5GF8y1Y0SFLY9AbqSk6nt0PnOx4H4WNJYZ13GUPw==` |
| `@vitejs/plugin-react` | `6.0.5` | Node `^20.19 || >=22.12`; Vite `^8` | `sha512-BOVzne/NL162sMdResB25mUv+vWMF5NoAjNf09TeGlE7ZpszZWSD3winycicLJw72yeVsoCn/2kOhEuCvEShMA==` |
| `jsdom` | `30.0.1` | Node `^22.22.2 || ^24.15 || >=26`; optional canvas only | `sha512-52v7mUVUfNQVYYqE1lcdaymWL0njO7lTLUog6ZvW2U5KsbiLk/GnZlVJ+qx0xfNJZ6Gn+KSpPNE52vurbxZwrA==` |
| `@testing-library/react` | `16.3.2` | React/React DOM 18 or 19; DOM `^10`; Node `>=18` | `sha512-XU5/SytQM+ykqMnAnvB2umaJNIOsLF3PVv//1Ew4CTcpz0/BRyy/af40qqrt7SjKpDdT1saBMc42CUok5gaw+g==` |
| `@testing-library/dom` | `10.4.1` | Node `>=18` | `sha512-o4PXJQidqJl82ckFaXUeoAW+XysPLauYI43Abki5hABd853iMhitooc6znOnczgbTYmEP6U6/y1ZyKAIsvMKGg==` |
| `@testing-library/user-event` | `14.6.3` | DOM `>=7.21.4`; Node `>=12` | `sha512-6dBq67jT8lE+JTE8Exm02Kt6ze43hz1jdiSpSJwtTZiT1xQQ6b7nZYTTQ9njdArdU8XklOwaDp/AbT/eYSKF4g==` |
| `@testing-library/jest-dom` | `7.0.1` | Node `>=22`; Vitest `>=0.32`; DOM `>=10 <11` | `sha512-oMDTC3oA+6CXSO2JZnvOI7CA6oVub6kij5ggk9ohwye5slmkwxYDXcPOVxgMw/RQlticjtO0C1RZkR97HgrWMw==` |

Vitest's compatible Vite resolution and the React plugin's Vite 8 peer are aligned. The generated manifest does not add a speculative direct Vite dependency; frozen lockfile resolution and peer verification must reject that decision if the actual graph cannot satisfy it.

## CI action revalidation

Current official releases and immutable commits were resolved through GitHub's API:

- `actions/checkout@v7.0.1` -> `3d3c42e5aac5ba805825da76410c181273ba90b1`;
- `pnpm/setup@v2.0.2` -> `84cb39b217b10273981911c288cd62326dc7c6d2`; and
- `actions/upload-artifact@v7.0.1` -> `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a`.

GitHub's [secure-use guidance](https://docs.github.com/en/actions/reference/security/secure-use) supports immutable full-SHA action references and minimum permissions. The new ordinary quality workflow is read-only (`contents: read`), has no environment, credentials, deployment, provider call, publication, or external mutation. Source inspection does not establish that hosted CI ran.

## Baseline verification

The exact pinned Node/pnpm toolchain was installed in the isolated worktree with a frozen lockfile. Before any Task 6C change, the following passed:

| Check | Result |
| --- | --- |
| semantic naming | exit 0 |
| constitution | 48/48 tests |
| package boundaries | 45/45 tests |
| builder core | 136/136 tests |
| CLI | 10/10 tests |
| standards and observability package tests | exit 0 |
| capability certification tests | 20/20 tests |
| capability admission | 7 records admitted |
| root moderate dependency audit | no known vulnerabilities |
| root registry signature audit | 885/885 verified |

The unchanged expensive compatibility and generated browser matrices were not rerun only to populate preparation prose. Their settled base receipts remain evidence for unchanged inputs; Task 6C final verification must run the complete fixed-root verifier because generated manifests, lockfiles, tests, workflows, and verification ordering change.

## Consolidated contradiction and uncertainty batch

1. The approved source plan, design, and original implementation plan required completed Task 6B certification before Task 6C. Task 6B is still pending. The user's newer explicit direction establishes a narrow independent-work exception: Task 6C uses accepted Task 6 implementation as its direct predecessor, starts from current clean `main`, preserves every observability certification artifact and status, and leaves later branch reconciliation to a separate review decision. This plan/evidence amendment records the exception before RED work; canonical roadmap/source-plan wording is updated under a causal constitution test during implementation.
2. The original plan proposed 2026-08-10 evidence filenames. Actual implementation is 2026-08-11, so all newly created preparation, verification, and review-packet files use the actual date consistently.
3. Exact successor versions were intentionally deferred. The settled base supports the next material minor contracts: `standards@0.3.0` and recipe `0.7.0`. Project/state schema remains `1.0.0`, and no public package version changes.
4. The previous generated workflow pin `pnpm/setup@v2.0.1` is no longer current. Task 6C uses current `v2.0.2` commit `84cb39b217b10273981911c288cd62326dc7c6d2`. Existing unrelated workflows change only when a focused Task 6C contract requires an applicable test lane or current shared pin.
5. No blocking package, engine, peer, advisory, ownership, schema, provider, permission, or migration uncertainty remains. A peer/install/audit/signature failure in the rendered graph is a mandatory stop and evidence-backed amendment, not a reason to relax the contract.

## Evidence limits and recovery

This preparation proves repository inspection, exact local identities, current documentation/registry/advisory lookups, and baseline deterministic checks. It does not prove the future implementation, generated lock graph, hosted CI, browser behavior after the change, deployment, provider behavior, production safety, visual quality, performance, assistive-technology behavior, human usability, or WCAG conformance.

Source recovery is branch-local: revert the focused Task 6C commits, regenerate checked schemas and all three fixtures from the restored owners, and rerun the complete builder-kernel verifier. No provider, deployment, credential, persistent-data, or production recovery applies because none is authorized or performed.
