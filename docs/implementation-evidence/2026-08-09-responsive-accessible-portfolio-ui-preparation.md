# Responsive Accessible Portfolio UI Preparation Evidence

**Date:** 2026-08-09 (America/Toronto)

**Status:** Preparation complete; implementation advance-approved through the implemented-task review gate

**Increment:** P2 Task 4 — responsive accessible portfolio UI

## Approval and repository freeze

The user explicitly selected this next task and preapproved bounded plan amendments through review of the implemented task. That message supplies advancement and plan-amendment authority for this increment. It does not supply verified-final-diff approval, the next portfolio outcome, or any external-action authority.

Preparation froze clean local `main` at:

```text
de5936cbac3271cba55bd658576f47e4766f87bd
```

`git status --short` was empty. Local `main` was 25 commits ahead of `origin/main`; remote refs were not refreshed because remote freshness does not alter this source-bound local increment. The primary checkout is not a linked worktree. Existing separate worktrees and their branches were inventoried and left untouched.

The immediately preceding bounded-section packet remained worded as awaiting implemented-task approval. The user's explicit instruction to begin the next task is treated as current advancement authority, not as a retroactive claim that the prior exact comparison received a different approval record.

## Repository sources inspected

Preparation read and reconciled:

- root `AGENTS.md`, `/Users/CoveMB/.codex/RTK.md`, and the nested builder-core, standards, observability, CLI, generated-template, and compatibility-proof guidance;
- the complete approved source plan and concise program roadmap;
- architecture overview, capability model, enforcement map, package ownership, and review/contribution protocol;
- the ADR index and accepted ADRs `0001` through `0011`;
- all five checked builder-core `.egeria` schema artifacts and their canonical runtime owners;
- root, CLI, builder-core, standards, observability, generated web, and proof manifests/configuration;
- current capability/profile, rendering, ownership, generation, content, section, fixture, verifier, and constitution consumers;
- recent branch/worktree/commit history; and
- the current bounded-section, copy-externalization, content-contract, and golden-fixture review evidence, with the bounded-section packet as the direct predecessor.

## Current official documentation and advisory evidence

External content was treated as evidence, not instructions.

### Tailwind CSS and Next.js

- The current [Next.js App Router CSS guide](https://nextjs.org/docs/app/getting-started/css) documents the Tailwind v4 integration with `tailwindcss`, `@tailwindcss/postcss`, `postcss.config.mjs`, `@import "tailwindcss"`, and a root global-CSS import.
- The current [Tailwind PostCSS guide](https://tailwindcss.com/docs/installation/using-postcss) independently documents `tailwindcss`, `@tailwindcss/postcss`, and `postcss` with the same plugin/import boundary.
- The npm registry reported stable `tailwindcss@4.3.3` and `@tailwindcss/postcss@4.3.3`, both older than the repository's one-day maturity floor.
- The registry listed `postcss@8.5.23` as only hours old. The design instead selects stable `8.5.22`, published several days earlier and newer than the security fixes below.

### Security advisories

- GitHub's reviewed [GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q) reports a high-severity arbitrary file-read/information-disclosure issue in `postcss<=8.5.11`, patched in `8.5.12`.
- GitHub's reviewed [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) reports an earlier moderate PostCSS stringification issue patched in `8.5.10`.
- Exact `postcss@8.5.22` is above both patched-version floors. Generated projects process only checked-in source-owned CSS in this increment; they do not accept client-uploaded, CMS-authored, or other untrusted CSS.
- A fresh lockfile audit and registry-signature check remain mandatory after dependency resolution. Registry search alone is not treated as proof that the final graph is advisory-free.

### Accessibility

- W3C's [WCAG 2.2 Recommendation](https://www.w3.org/TR/WCAG22/) is the current normative standard used for the selected relevant behavior.
- W3C's [reflow understanding document](https://www.w3.org/WAI/WCAG22/Understanding/reflow) explains the 320 CSS-pixel reflow and text-enlargement relationship.
- W3C's [target-size understanding document](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) specifies the 24-by-24 CSS-pixel Level AA minimum or sufficient spacing. The design deliberately uses at least 44 CSS pixels for primary and navigation targets.
- W3C's [contrast understanding document](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) owns the contrast calculation and thresholds used by the deterministic palette test.
- Accepted ADR-0009 remains the claim owner: automation and source-level calculations do not establish WCAG conformance or human usability.

## Existing implementation evidence

The generated UI currently has:

- strict externalized YAML content and Markdown data;
- one enabled hero first in heading order;
- pure four-type semantic Server Components;
- ordered section rendering and safe ordinary links;
- a small plain global stylesheet; and
- production Next/OpenNext build evidence.

The predecessor packet explicitly records no browser accessibility tree, axe, keyboard/focus, reflow, reduced-motion, visual, performance, or human-usability result and names responsive accessible UI as the next outcome.

## Consolidated contradictions and uncertainties

No blocking canonical contradiction remains.

1. The approved source plan requires responsive Tailwind and semantic design tokens, but the executable catalog has no styling capability. Reusing `section-composition` preserves the exact six-capability catalog and assigns one cohesive owner. Adding a seventh capability would violate current stage discipline.
2. The roadmap lists generated accessibility/visual/performance automation after responsive accessible UI. This increment therefore implements and deterministically checks the source contract while preserving explicit browser/conformance claim limits. It does not pull the later harness forward.
3. The accessible skip-link label must be visible copy. The exact content contract therefore gains `accessibility.skipToContent`; embedding a TSX literal or an implicit fallback would violate ADR-0008.
4. Current `globals.css` is builder-kernel-owned. The implementation must transfer, not duplicate, that path into `section-composition` ownership when styling becomes capability behavior.

## Selected implementation boundary

- Advance `content-files` to `0.3.0`, `section-composition` to `0.3.0`, and current profile recipes to `0.4.0`.
- Add exact Tailwind/PostCSS development packages and one PostCSS configuration to generated `apps/web`.
- Add semantic CSS tokens and responsive utility composition without client-side runtime.
- Add externalized skip navigation and preserve pure presentation, ordered headings, native semantics, safe links, and Cloudflare isolation.
- Regenerate both production fixtures, including exact lockfiles and installed ownership/fingerprint state.
- Make no provider, workflow, deployment, publication, migration, persistent-data, or production change.

## Claim boundary

The planned evidence can prove exact source contracts, selected palette calculations, deterministic generation, dependency resolution, lint/typecheck, and Next/OpenNext compilation. It cannot prove computed browser layout, cross-browser behavior, assistive-technology compatibility, visual quality, human usability, accessibility conformance, production safety, or launch readiness. Those limits must remain explicit in final evidence and review.
