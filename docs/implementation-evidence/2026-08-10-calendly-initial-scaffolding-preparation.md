# Calendly Initial-Scaffolding Preparation Evidence

**Date:** 2026-08-10 (America/Toronto)

**Status:** Preparation complete; implementation advance-approved through the implemented-task review gate

**Increment:** P2 Task 5 — Calendly initial-scaffolding integration

## Approval and repository freeze

The user selected P2 Task 5, preapproved necessary exact-file plan amendments, and authorized continuous implementation through review of the implemented task. This approval does not include verified-final-diff approval, push, pull request, merge, publication, deployment, workflow dispatch, Calendly account changes, creation of a Calendly event type, a synthetic booking, permission changes, production action, or any other external mutation.

Preparation froze clean sequential local `main` at:

```text
02ec5eb12741c1622beec02529c38965e7501d68
```

`git status --short` was empty. Local `main` was 44 commits ahead of the unrefreshed local `origin/main`; remote freshness does not affect this source-bound increment. The program roadmap expressly assigns the next approved sequential builder-repository increment to clean local `main`. No parallel implementation stream exists, so a worktree would add no isolation benefit. Builder executions that write generated repositories remain confined to absent temporary destinations or the fixture-update procedure.

## Repository sources inspected

Preparation read and reconciled:

- root `AGENTS.md`, `/Users/CoveMB/.codex/RTK.md`, and the nested CLI, builder-core, standards, generated-portfolio, and generated-site instructions;
- the approved source plan, architecture overview, capability model, enforcement map, package ownership map, program roadmap, review protocol, and accepted ADRs `0001` through `0011`;
- current project, profile, capability, state, migration, ownership, inference, diagnostics, rendering, generation, and JSON Schema contracts;
- current manifests, lockfiles, explicit template allowlists, CLI arguments, generated verification receipts, fixture contracts, and browser-quality suites;
- committed `portfolio` and `site` `.egeria` project/state/migration artifacts and exact generated file inventories;
- P1 and P2 preparation, verification, and review packets through the generated browser-testing foundation; and
- current branch, status, worktree layout, recent commits, and comparison scope.

## Current official documentation and security evidence

External content was treated as untrusted evidence, not as instructions.

### Calendly

- Calendly's current [embed options overview](https://calendly.com/help/embed-options-overview) documents inline, popup-text, and popup-widget presentation choices.
- Calendly's current [advanced embed guide](https://calendly.com/help/advanced-calendly-embed-for-developers) documents an iframe as a supported direct-embed alternative and notes that iframe embeds do not provide the script embed's automatic resize or event tracking.
- Calendly's [developer scheduling-page guide](https://developer.calendly.com/how-to-display-the-scheduling-page-for-users-of-your-app) confirms that a scheduling URL is the provider destination displayed by the integration.
- Calendly's [privacy and security guidance](https://calendly.com/help/your-privacy-and-security), [privacy notice](https://calendly.com/legal/privacy-notice), and [developer policy](https://developer.calendly.com/developer-policy) establish that Calendly, not the generated repository, controls provider-side scheduling data, cookies, retention, and account configuration.

The selected design uses the documented direct iframe rather than loading Calendly's mutable host-page JavaScript. Link mode performs no provider request until navigation. Inline mode assigns the iframe URL only when the booking region approaches the viewport. Popup mode uses an accessible native modal dialog and assigns the iframe URL only after user activation. All modes retain an ordinary HTTPS anchor fallback.

### Playwright and accessibility

- Playwright's current [best-practices guide](https://playwright.dev/docs/best-practices) recommends testing user-visible behavior and controlling third-party dependencies rather than testing external services.
- Playwright's current [accessibility-testing guide](https://playwright.dev/docs/accessibility-testing) treats automated accessibility analysis as partial evidence and recommends combining it with manual assessment.
- W3C's [evaluation-tools overview](https://www.w3.org/WAI/test-evaluate/tools/) says automated tools cannot determine every accessibility requirement.

Generated Calendly browser tests will intercept the cross-origin scheduling document. They can prove local link, lazy-load, modal, keyboard, reflow, and fallback behavior without treating Calendly availability or provider behavior as a local test dependency. They cannot prove WCAG conformance, Calendly accessibility, a real booking, provider-side receipt, hosted execution, or production safety.

### Current dependency and advisory state

The increment adds no package dependency. It retains Node.js `22.23.2`, pnpm `11.20.0`, Next.js `16.3.0`, React `19.2.8`, Playwright `1.62.1`, axe Playwright `4.12.1`, OpenNext Cloudflare `1.20.2`, and Wrangler `4.118.0`.

Official Next.js security advisories and the current Next.js/React release records were rechecked. The repository's exact baseline then passed `pnpm audit --audit-level moderate` with no known vulnerabilities and `pnpm audit signatures` with 885 verified registry signatures. This is dated supply-chain evidence, not a guarantee against unknown or future vulnerabilities.

## Baseline verification

The first unchanged aggregate run used an ambient pnpm launcher whose bundled Node.js did not match the repository pin. The exact invocation was corrected to `volta run --node 22.23.2 --pnpm 11.20.0` before accepting any evidence.

The first exact-toolchain sandbox run passed constitution, package-boundary, builder-core, and CLI tests, then failed fixture lockfile preparation because the restricted environment could not resolve the public registry. Repository evidence and source-tree comparison confirmed the documented network-boundary signal; no source changed.

The unchanged exact-toolchain verifier was rerun with approved registry access:

```text
CI=true volta run --node 22.23.2 --pnpm 11.20.0 pnpm run verify:builder-kernel
```

It exited zero. Constitution (21), package-boundary (40), builder-core (110), CLI (9), and generated-fixture (7) tests passed. The portfolio and site regenerated as 36 and 38 byte-stable files. Lint, copy externalization, build, typecheck, frozen install, peer checks, moderate advisory audit, registry signatures, Next build, OpenNext build, explicit Chromium installation, and development/preview browser suites passed for both fixtures. Changeset status retained the already approved minor release intent for `@egeria-systems/standards`.

## Consolidated contradictions and uncertainties

No contradiction blocks local implementation.

1. The roadmap still said the browser-testing increment awaited verified-final-diff approval. Selecting Task 5 as the next task resolves that status drift; the roadmap is updated at this preparation boundary.
2. `booking-calendly` is documented as optional during initial scaffolding but is not executable. The current resolver already supports requested capabilities; the missing surfaces are a strict CLI selection, capability settings, descriptor, conditional templates, and retained representative fixture.
3. The project schema currently forbids all capability settings. It can remain schema version `1.0.0` while adding one optional strict `booking-calendly` settings object because existing `{}` documents remain valid and no existing field changes meaning.
4. Portfolio and site recipe `0.5.0` defaults do not change. Calendly is an explicit optional selection, so advancing default recipe provenance would misrepresent the materialized recipes.
5. A host-page Calendly script would add mutable third-party code and extra CSP domains. The documented direct iframe supports the required scheduling page while keeping provider execution cross-origin and activation-bounded. Native `dialog` supplies popup presentation without a provider script.
6. The current `section-composition` descriptor owns the home composition root. Optional integration composition requires conditional root templates. Ownership moves atomically to the builder kernel while `section-composition` continues to own the section registry, presentation component, styles, and PostCSS/Tailwind surfaces.
7. Protected-staging provider certification requires a staging deployment, a synthetic Calendly event type, and an external booking. Those are explicit external mutations and require separate authority and environment inputs. This increment specifies but does not perform that certification. It remains a P2 acceptance risk rather than a reason to broaden local source authority.
8. The selected composition requires `ContentPage` to accept a typed child and generated guidance to explain the optional booking surface. Those three common-template changes necessarily update the corresponding unselected fixture bytes; the preapproved exact-file plan amendment enumerates those exceptions. Root copy enforcement also requires the command glob, `eslint.config.mjs` file scope, and their three exact package-boundary consumers to include integration TSX templates.

## Selected implementation boundary

- Add source-generated `booking-calendly@0.1.0` as an optional `portfolio`/`site` capability with automatic source removal, no package dependency, no environment variable, no secret, no generated provider resource, and no provider cleanup claim.
- Accept either the existing exact four `create` options or those four plus `--calendly-url` and `--calendly-mode`; require the two Calendly options together.
- Accept modes `link`, `inline`, and `popup`. Accept only an HTTPS `calendly.com` or `www.calendly.com` URL with a non-root path, no credentials, no query string, no fragment, no whitespace, and at most 2,048 characters. Reject inputs without echoing them in issues.
- Store the exact validated selection in `.egeria/project.yaml` as `capabilitySettings.booking-calendly`, and require settings/capability presence to agree.
- Generate validated externalized `en-CA` booking copy, a typed source reader, generated settings, a client presentation component, a booking-aware home composition root, and a capability-owned browser specification only when selected.
- Use an ordinary anchor for link mode; an intersection-activated direct iframe plus anchor fallback for inline mode; and an anchor enhanced to a native modal dialog containing a user-activated direct iframe for popup mode.
- Preserve the pure `ContentPage` boundary by accepting a typed React child; keep browser effects inside the booking client component.
- Retain `fixtures/generated/portfolio-calendly` in popup mode as the required representative `portfolio + Calendly` risk-matrix case, while unit/generation contracts exercise all three modes.
- Expand template inventory, schema, capability ownership/probes, copy lint coverage, deterministic generation, fixed-root certification, documentation, and review evidence together.

## Deferred outcomes and claim boundary

This increment does not add later CLI capability addition, existing-repository transformation, webhooks, provider event tracking, analytics, consent management, a public package, a generic integration framework, a generic platform/database port, a new profile, a new recipe default, a deployment workflow, credentials, Calendly account/event configuration, a synthetic booking, provider-side confirmation, hosted CI proof, live deployment proof, visual approval, performance certification, human accessibility evaluation, or a WCAG-conformance claim.

The local evidence may establish deterministic initial scaffolding, strict settings, bounded link/inline/popup behavior, copy placement, ownership/inference agreement, responsive browser behavior against a stubbed cross-origin scheduling document, and generated build compatibility. Protected-staging and provider-confirmed certification remains separately approval-gated and cannot be inferred from these checks.
