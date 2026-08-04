# Next.js and Cloudflare compatibility proof

This directory is infrastructure evidence, not a builder application, generated client repository, public package, profile, or reusable runtime package.

- Keep the proof minimal: one page, one API route, and tests required by P0.2.
- Externalize all visible copy in `content/en-CA.json` and validate it before rendering.
- Keep presentation components pure and Cloudflare imports in `src/infrastructure/cloudflare`, configuration/composition roots, or infrastructure tests.
- Preserve the explicit Node development versus workerd preview/deployment distinction.
- Do not add product behavior, provider integrations, analytics, observability, persistence, authentication, payments, or speculative abstractions.
- Automated accessibility results are evidence only and do not establish WCAG conformance.
- Read the root `AGENTS.md`, architecture documents, ADRs, and approved P0.2 plan before editing.
