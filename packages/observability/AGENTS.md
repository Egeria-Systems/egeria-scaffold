# Observability package boundary

Read the repository [`AGENTS.md`](../../AGENTS.md), the canonical [package ownership](../../docs/architecture/package-ownership.md), and the [review and contribution protocol](../../docs/governance/review-and-contribution.md) before editing this surface.

`@egeria-systems/observability` is a public, replaceable package. Its `0.2.0` provider-neutral API owns immutable bounded operational events, context and error normalization, allowlisted attributes, redaction, non-throwing dispatch, Better Stack protocol encoding, structured-log and browser sinks, and test assertions with zero runtime dependencies.

- Keep the exact root, `./server`, `./browser`, and `./testing` exports provider-neutral and framework-neutral. Public API changes require an approved Changeset and separately authorized publication.
- Keep raw errors, messages, stacks, URLs, headers, cookies, form values, arbitrary attributes, secrets, and private data outside the contract. Event creation and dispatch remain failure-contained and copy-free.
- Keep provider protocol encoding separate from provider effects. The package performs no fetch, console interception, browser storage, analytics, resource creation, or credential discovery.
- Keep zero runtime dependencies. Cloudflare types and bindings belong only in generated platform adapters and composition roots, never in this package.
- Keep exports, source inventory, and packaged files explicit. Local release configuration never authorizes publication.
- Test the public API with Node's test runner (`node --test`) through `pnpm --filter @egeria-systems/observability run test`. Preserve coverage of bounded validation, privacy and redaction, sink/protocol encoding, adapter separation, and non-throwing failure behavior. These tests do not establish Cloudflare delivery, provider ingestion, deployment, or production behavior.
- Follow the currently approved increment and stop at its review gate before expanding this boundary.
