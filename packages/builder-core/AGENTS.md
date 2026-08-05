# Builder core boundary

Read the repository [`AGENTS.md`](../../AGENTS.md), the canonical [package ownership](../../docs/architecture/package-ownership.md), and the [review and contribution protocol](../../docs/governance/review-and-contribution.md) before editing this surface.

`packages/builder-core` is the private owner of builder internals and project/state schemas. P1 Tasks 1 and 2 added the executable contracts, checked JSON Schema artifacts, exact six-capability catalog, `portfolio` and `site` recipes, deterministic resolution, and installed-manifest projection. P1 Task 3 adds strict `.egeria` codecs plus pure hybrid-ownership fingerprint materialization.

- Keep runtime Zod schemas canonical and generated Draft 2020-12 artifacts byte-checked against them. Do not hand-edit artifacts.
- Keep the executable catalog limited to `standards`, `content-files`, `section-composition`, `deployment-cloudflare`, `observability`, and `site-routing`; keep executable profiles limited to `portfolio` and `site`.
- Keep Task 3 codecs in-memory, deterministic, strict, and content-safe. Task 3 does not create `.egeria` files or read a repository; inference remains deferred to Task 4.
- Do not add diagnostics, planning, migration execution, repository transformation, templates, generated projects, recovery automation, provider integration, CLI behavior, or later-stage capability runtime code.
- Do not create or move schema ownership into a separate `project-schema` package.
- Do not expose builder-core as a public package or add generic `PlatformService` or `ApplicationDatabase` ports.
- Follow the currently approved increment and stop at its review gate before expanding this boundary.
