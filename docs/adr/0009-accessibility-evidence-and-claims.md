# ADR-0009: Accessibility Evidence and Claims

**Status:** Accepted

**Date:** 2026-08-04

## Context

Automated checks catch valuable regressions but cannot evaluate every WCAG success criterion or determine whether people with disabilities can use a product effectively. Making human evaluation a universal release gate would contradict the approved default program, while treating automation as conformance proof would be misleading.

## Decision

Generated applications include mandatory automated accessibility gates targeting WCAG 2.2 AA-relevant behavior, including:

- axe checks;
- keyboard interaction;
- focus visibility and management where automatable;
- responsive reflow;
- reduced motion;
- form states and error presentation;
- third-party fallback behavior.

Passing automation must never be presented as WCAG 2.2 AA conformance. A versioned human-review checklist is generated and recommended. Knowledgeable human evaluation becomes a release gate only when:

- the client contract requires it;
- procurement requires it;
- the project intends to make a conformance claim;
- an explicitly approved risk decision requires it.

“Accessibility review complete” means the automated and policy-required evidence for the selected scope. It does not silently add a universal human gate or authorize a conformance claim.

## Consequences

- Automated regressions block generated-project releases according to their owning phase.
- Review packets identify what automation exercised and what remains human judgment.
- Third-party embeds require accessible fallbacks and cannot borrow the host project's claims.
- Contract, procurement, and risk decisions can strengthen the default gate without rewriting the architecture.

## Enforcement

`INV-ACCESSIBILITY-AUTOMATION` is planned for the P0.2 proof and P2 generated projects through Playwright and axe. `INV-ACCESSIBILITY-CLAIMS` is recorded by the P0.1 constitution contract and gains release-check enforcement in P2.

W3C states that [no tool alone can determine accessibility](https://www.w3.org/WAI/test-evaluate/) and that conformance testing combines [automated testing and human evaluation](https://www.w3.org/WAI/WCAG21/Understanding/conformance.html).
