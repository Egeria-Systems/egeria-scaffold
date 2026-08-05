# Builder core boundary

Read the repository [`AGENTS.md`](../../AGENTS.md), the canonical [package ownership](../../docs/architecture/package-ownership.md), and the [review and contribution protocol](../../docs/governance/review-and-contribution.md) before editing this surface.

`packages/builder-core` is the private owner of builder internals and project/state schemas. P1 Task 1 adds the first executable runtime contracts and checked JSON Schema artifacts inside this package.

- Keep runtime Zod schemas canonical and generated Draft 2020-12 artifacts byte-checked against them. Do not hand-edit artifacts.
- This task adds schema contracts only. Do not add executable capability catalogs, profile resolution, `.egeria` codecs or files, inference, planning, migration execution, repository transformation, templates, generated projects, recovery automation, or provider integration.
- Do not create or move schema ownership into a separate `project-schema` package.
- Do not expose builder-core as a public package or add generic `PlatformService` or `ApplicationDatabase` ports.
- Follow the currently approved increment and stop at its review gate before expanding this boundary.
