# ADR-0008: User-Visible Copy Externalization

**Status:** Accepted

**Date:** 2026-08-04

## Context

Generated applications must support translation, consistent validation, accessibility labels, and content ownership without hunting through executable code. Keeping user-facing prose in components or domain errors would mix behavior with presentation and make locale parity unreliable.

## Decision

All user-visible or translatable copy originates from validated content or localization files, including:

- page content, navigation, metadata, document titles, and descriptions;
- headings, instructions, labels, buttons, and links;
- accessibility labels and alternative text;
- placeholders and user-facing validation messages;
- loading, empty, success, and error states.

Domain and application code return stable identifiers such as `CONTACT_EMAIL_INVALID`, `AUTH_EMAIL_NOT_VERIFIED`, or `PAYMENT_SYNCHRONIZATION_PENDING`. Delivery and UI code map those identifiers to locale keys.

Technical logs, stable internal error identifiers, schema names, test descriptions, assertions, invariant developer messages, and diagnostics never presented to users stay beside their owning code. Narrow escapes are documented only for semantically invariant literals.

Structured content uses YAML 1.2; long-form content uses Markdown with validated front matter. Even single-language projects store content under a real locale identifier. Client-editable MDX is excluded.

## Consequences

- Translation and locale parity become testable contracts.
- Presentation remains independent from domain failure wording.
- Content owners can edit approved data without editing executable behavior.
- Accessibility names and user states receive the same validation as visible prose.
- Escape hatches must remain rare, explicit, and reviewable.

## Enforcement

`INV-COPY-EXTERNALIZATION` is planned for the P0.3 standards package and P2 generated applications: JSX literal checks, attribute and metadata checks, missing/unused key reports, locale parity validation, schema validation, and documented escape checks.
