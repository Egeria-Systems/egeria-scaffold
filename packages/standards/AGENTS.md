# Standards package boundary

Read the repository [`AGENTS.md`](../../AGENTS.md), the canonical [package ownership](../../docs/architecture/package-ownership.md), and the [review and contribution protocol](../../docs/governance/review-and-contribution.md) before editing this surface.

`@egeria-systems/standards` is a public, replaceable configuration package. Its P0.3 API is limited to the strict TypeScript configuration and the Cloudflare-isolation ESLint flat config.

- Add a standard only when it has a concrete consumer and an approved stable API.
- Keep this package free of runtime application code, a root export, profiles, generators, providers, analytics, observability, and user-visible copy.
- Preserve provider-neutral boundaries. The Cloudflare lint API may identify forbidden imports but must not introduce Cloudflare runtime code.
- Keep exports and packaged files explicit. Local release configuration never authorizes publication.
- Follow the currently approved increment and stop at its review gate before expanding this boundary.
