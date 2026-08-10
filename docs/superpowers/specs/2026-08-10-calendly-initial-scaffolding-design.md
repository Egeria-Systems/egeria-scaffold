# Calendly Initial-Scaffolding Design

**Date:** 2026-08-10

**Status:** Approved-stage design; exact execution is owned by the paired implementation plan

## Outcome

An explicit Calendly selection during initial `portfolio` or `site` creation materializes `booking-calendly` with one validated destination and one of three presentation modes: `link`, `inline`, or `popup`. The selected capability and its settings become authoritative repository state. Omitting the selection preserves the existing recipe defaults, selected capabilities, empty settings, file inventory, and runtime behavior. The common `ContentPage` child slot and generated guidance are emitted for both selected and unselected projects, and state records the home composition root's required ownership transfer.

## Selection and state contract

The compiled CLI accepts:

```text
egeria create --profile portfolio --name acme-portfolio --display-name "Acme Portfolio" --directory /absent/path --calendly-url https://calendly.com/acme/intro --calendly-mode popup
```

`--calendly-url` and `--calendly-mode` are an atomic pair. The builder request carries their validated value as `bookingCalendly`. Resolution requests `booking-calendly`; its declared dependencies materialize through the existing dependency-first resolver.

`.egeria/project.yaml` stores:

```yaml
capabilitySettings:
  booking-calendly:
    destination: https://calendly.com/acme/intro
    mode: popup
```

The project contract allows no other settings key. `booking-calendly` settings must be present exactly when that capability is selected. Current projects with `capabilitySettings: {}` remain valid.

The URL contract accepts only HTTPS `calendly.com` or `www.calendly.com`, a non-root path, no user information, no fragment, no URL-normalization whitespace, and a maximum of 2,048 characters. Stable failures never include the rejected value.

## Capability contract

`booking-calendly@0.1.0` is source-generated, repository-stateful, automatically removable, and supported by `portfolio` and `site`. It depends on `section-composition`, installs no package, requests no secret or environment variable, creates no provider resource, and declares:

- external domain `calendly.com`;
- CSP contribution `frame-src https://calendly.com`;
- browser storage and scheduling data as provider-controlled inside the cross-origin frame;
- elevated threat review because a third-party scheduling surface handles personal data; and
- explicit documentation and removal/recovery requirements that exclude the Calendly account and provider data.

Its exact source probes and managed surfaces cover the booking copy, copy reader, generated settings, client component, and browser specification. The builder kernel owns the conditional home composition root so optional overlay selection never creates overlapping capability ownership.

## Generated presentation

All user-visible text comes from `apps/web/content/en-CA/booking-calendly.yaml` and is validated before rendering. The booking client component receives typed settings and typed copy.

- `link`: render a normal HTTPS anchor. No Calendly resource is requested until navigation.
- `inline`: render the normal anchor fallback and an initially empty frame region. An `IntersectionObserver` assigns the iframe URL only when the region approaches the viewport; absence of that API activates the frame after hydration. The iframe is lazy, titled from externalized copy, width-bounded, and fixed-height because the direct iframe does not auto-resize.
- `popup`: render the normal anchor as the activation control. When native modal support is available, prevent navigation, activate the iframe, and open a `dialog`; otherwise preserve anchor navigation. The dialog has an externalized heading and close label, native Escape behavior, focus containment, responsive bounds, and clears the iframe when closed.

The cross-origin iframe executes provider content outside the host origin. The generated repository does not load Calendly's host-page script, listen to provider events, claim bookings, or store scheduling data.

## Verification

Builder-core and CLI tests cover strict paired selection, URL/mode rejection, sanitization, capability/settings agreement, dependency-first resolution, conditional template selection, all three modes, copy validation, ownership/probe agreement, deterministic files, unchanged unselected file inventory and behavior, and only the enumerated common byte changes when unselected.

The retained `portfolio-calendly` fixture uses popup mode because it has the largest local interaction surface. Its capability-owned Playwright test stubs the cross-origin scheduling document, proves no eager provider request, proves enhanced dialog behavior and cleanup, proves the ordinary anchor works with JavaScript disabled, checks 320 CSS-pixel reflow, and runs the selected axe rules with the dialog open. Existing generic browser checks continue to cover the complete generated page in development and OpenNext/workerd preview.

These checks do not call Calendly, make a real booking, establish provider availability, certify hosted deployment, prove visual quality, or establish WCAG conformance.

## Protected-staging handoff

The later externally authorized certification must deploy the retained minimal portfolio through the approved protected-staging authority, use a synthetic Calendly event and identity, complete one booking through the rendered integration, confirm the provider event, verify the visible success and fallback paths, respect rate/retention limits, and clean up synthetic data. Source rollback is removal of the capability-owned generated surfaces and settings; provider cleanup is separate. No part of local implementation or review is substitute evidence for that journey.
