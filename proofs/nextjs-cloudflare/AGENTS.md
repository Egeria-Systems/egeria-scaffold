# Next.js and Cloudflare compatibility proof

This directory is infrastructure evidence, not a builder application, generated client repository, public package, profile, or reusable runtime package.

- Keep the accepted web proof minimal: one page and one API route. The separately authorized Queue topology comparison adds only synthetic test fixtures and local workerd tests under `tests/`; it changes no deployed entry point or product generation.
- Externalize all visible copy in `content/en-CA.json` and validate it before rendering.
- Keep presentation components pure and Cloudflare imports in `src/infrastructure/cloudflare`, configuration/composition roots, or infrastructure tests.
- Preserve the explicit Node development versus workerd preview/deployment distinction.
- Use `pnpm --filter @egeria-systems/nextjs-cloudflare-proof run test:unit` for Vitest unit behavior, `test:integration:cloudflare` for the `createTestHarness()` Workers-runtime boundary, and `test:e2e:dev` plus `test:e2e:preview` for Playwright browser behavior. Preview E2E consumes already prepared `.open-next` output, so run the Next build followed by the OpenNext `--skipNextBuild` transform first. Keep this harness as compatibility evidence; never reuse it as product architecture. A passing layer proves only the environment it exercises.
- Do not add product behavior, live provider integrations, analytics, observability, persistence, authentication, payments, or speculative abstractions. Queue fixtures are test-only, use no database or credentials, and must distinguish local observations from controlled injections and unproved deployed guarantees. The [Queue proof record](../../docs/compatibility/queue-consumer-topology.md) owns reproduction and limits.
- Automated accessibility results are evidence only and do not establish WCAG conformance.
- Read the root `AGENTS.md`, architecture documents, ADRs, and approved P0.2 plan before editing.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
