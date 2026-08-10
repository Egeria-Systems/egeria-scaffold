# Responsive Accessible Portfolio UI Design

**Status:** Advance-approved for implementation through the implemented-task review gate

**Date:** 2026-08-09

## Goal

Make the actual builder generate a polished responsive interface for the current `portfolio` and `site` recipes. The interface must preserve the validated content and bounded-section contracts, externalize its remaining accessibility copy, use Tailwind CSS with semantic design tokens, and establish reviewable keyboard, focus, contrast, target-size, reflow, and reduced-motion foundations without claiming WCAG conformance.

## Selected boundary

Evolve the existing `section-composition` capability rather than introducing another capability. This capability already owns generated routes, the pure content-page presentation boundary, and the four presentation components. It will also own the Tailwind/PostCSS package properties, PostCSS configuration, global design-token stylesheet, and responsive component classes. Its version advances to `0.3.0`.

The `content-files` capability advances to `0.3.0` because the exact top-level site content contract gains one `accessibility.skipToContent` string. That externalized string is required only when navigation is present and supplies the visible label for the generated skip link. The current profile recipes advance to `0.4.0`. Retained recipe provenance remains readable.

No public package, new capability, runtime provider, browser client component, image model, font dependency, or generic design-system abstraction is added.

## Alternatives considered

### Selected: evolve `section-composition`

This keeps presentation, styling, and their exact generated package/configuration surfaces in one existing source-generated capability. It requires one ownership transfer for `apps/web/app/globals.css`, which is currently a builder-kernel application-owned surface, and adds one application-owned `apps/web/postcss.config.mjs` surface plus three merge-managed package properties.

### Rejected: retain plain global CSS only

This would minimize dependency changes, but it directly contradicts the approved source plan's responsive Tailwind requirement and would leave the generated result short of the accepted portfolio recipe.

### Rejected: add a `responsive-ui` or design-system capability

The accepted executable catalog has exactly six capabilities and names no independent styling capability. A seventh capability would create a new versioned lifecycle, resolution choice, and migration boundary without a demonstrated independent selection or consumer.

## Styling system

Generated projects use the current official Tailwind CSS v4 PostCSS setup:

- exact `tailwindcss@4.3.3`;
- exact `@tailwindcss/postcss@4.3.3`;
- exact patched `postcss@8.5.22`;
- one `postcss.config.mjs` plugin configuration; and
- one global stylesheet beginning with `@import "tailwindcss"`.

The stylesheet owns stable semantic CSS custom properties for canvas, surface, ink, muted text, borders, accent, accent hover, accent contrast, and focus. Tailwind's inline theme maps utilities to those semantic properties. Components consume semantic utilities such as canvas, surface, ink, muted, line, and accent rather than embedding colour literals.

The initial light palette provides at least 4.5:1 contrast for ordinary text and focus indication across the intended adjacent surfaces. The deterministic template test calculates the selected pairs from exact hex values. This is source-level evidence for the intended palette, not a browser-rendered or conformance result.

## Presentation and flow

`ContentPage` remains a pure Server Component. It receives typed sections, navigation, and the externalized skip-link label. When navigation exists, it renders a keyboard-focusable skip link before the main landmark and targets a focusable `main` element. Navigation wraps at narrow widths and exposes comfortably sized link targets.

The page shell uses fluid inline padding, a bounded readable container, and no fixed content width. The four registered section components remain exhaustive and data-only:

- hero: prominent page heading and summary with fluid typography;
- text: readable line length and generous section spacing;
- project list: one column by default and two columns when space permits, with semantic list/article/heading/link structure;
- call to action: a high-contrast panel and large ordinary anchor target.

Long words and destinations may wrap. No horizontal layout relies on a viewport wider than 320 CSS pixels. There is no sticky or fixed content that can obscure focus.

## Accessibility behavior

The generated UI provides:

- one existing content-backed page heading followed by ordered section headings;
- one main landmark and one labelled-by-content navigation block when present;
- an externalized skip-navigation link for repeated site navigation;
- visible high-contrast `:focus-visible` treatment with forced-colours support;
- minimum 44 CSS-pixel primary and navigation link block sizes;
- fluid sizing and wrapping intended for 320 CSS-pixel reflow and text enlargement;
- no required hover-only content or browser scripting;
- no default animation, plus a defensive reduced-motion override; and
- semantic anchors, lists, articles, headings, and landmarks without ARIA replacement of native roles.

Automated axe, browser keyboard, computed overflow, visual-regression, and performance gates remain the later separately listed program outcome. This increment does not describe its static and build evidence as browser, assistive-technology, human-usability, or WCAG-conformance proof.

## Content and error behavior

The top-level site YAML gains exactly:

```yaml
accessibility:
  skipToContent: Skip to content
```

The parser requires exact keys and a non-empty control-safe string. Invalid site content continues to fail closed with `TypeError("CONTENT_INVALID")` and never echoes source values. The pure page component receives the parsed string; no UI literal or fallback copy is embedded in TSX.

## State and ownership

`section-composition` owns these added or transferred application surfaces:

- `/devDependencies/@tailwindcss~1postcss`;
- `/devDependencies/postcss`;
- `/devDependencies/tailwindcss`;
- `apps/web/postcss.config.mjs`; and
- `apps/web/app/globals.css`.

The existing builder-kernel descriptor for `apps/web/app/globals.css` is removed in the same change, so one path retains exactly one owner. Every new surface has a matching inference probe. The generated project remains a lightweight `apps/web` workspace and the packages are ordinary exact development dependencies.

## Verification design

TDD begins with focused failures for:

- current and retained recipe versions;
- content and section capability versions;
- exact package/configuration/surface ownership;
- required externalized skip copy and pure page flow;
- exact design tokens, calculated contrast pairs, focus, target-size, wrapping, and reduced-motion contracts;
- responsive semantic Tailwind classes on every generated presentation component; and
- generated inventory, state, inference, package-manifest, and fixture-lock expectations.

GREEN requires builder-core tests, copy lint, production Next/OpenNext builds, deterministic production generation twice per profile, committed fixture byte equality, generated state/inference agreement, the fixed-root audit/signature/build harness, and the complete builder-kernel aggregate.

Independent requirements, architecture/anti-overengineering, test-evidence, and accessibility reviewers assess the exact implementation comparison. Evidence-backed material findings receive focused regression tests and bounded repair before the final packet.

## Non-goals

Do not add Calendly, analytics, production observability behavior, generated Playwright/axe/visual/performance gates, CI or deployment workflows, a human-review checklist, a WCAG claim, images or media content, Markdown rendering, a retained real client repository, existing-repository migration, providers, persistence, email, jobs, identity, payments, or `apps/jobs`.

## Recovery

Rollback uses focused newest-first revert commits, followed by fixture regeneration and complete builder-kernel verification. Source rollback removes the new development dependencies, PostCSS configuration, styling/content changes, recipe/capability versions, and generated fixture evidence together. No deployment, provider, persistent-data, analytics, or booking recovery applies.
