# Builder core boundary

Read the repository [`AGENTS.md`](../../AGENTS.md), the canonical [package ownership](../../docs/architecture/package-ownership.md), and the [review and contribution protocol](../../docs/governance/review-and-contribution.md) before editing this surface.

`packages/builder-core` is the private owner of builder internals and project/state schemas. P1 Task 1 added the executable runtime contracts and checked JSON Schema artifacts. P1 Task 2 adds the exact six-capability catalog, the `portfolio` and `site` recipes, deterministic capability resolution, and installed-manifest materialization.

- Keep runtime Zod schemas canonical and generated Draft 2020-12 artifacts byte-checked against them. Do not hand-edit artifacts.
- Keep the Task 2 executable catalog limited to `standards`, `content-files`, `section-composition`, `deployment-cloudflare`, `observability`, and `site-routing`; keep executable profiles limited to `portfolio` and `site`.
- Task 2 does not add `.egeria` codecs or files, inference, planning, migration execution, repository transformation, templates, generated projects, recovery automation, provider integration, or later-stage capability runtime code.
- Do not create or move schema ownership into a separate `project-schema` package.
- Do not expose builder-core as a public package or add generic `PlatformService` or `ApplicationDatabase` ports.
- Follow the currently approved increment and stop at its review gate before expanding this boundary.
