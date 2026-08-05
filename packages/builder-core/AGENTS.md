# Builder core boundary

Read the repository [`AGENTS.md`](../../AGENTS.md), the canonical [package ownership](../../docs/architecture/package-ownership.md), and the [review and contribution protocol](../../docs/governance/review-and-contribution.md) before editing this surface.

`packages/builder-core` is the private owner of future builder internals and project/state schemas. P0.3 creates only the ownership shell; P1 is the first executable schema and builder-kernel stage.

- Do not add schemas, `.egeria` state, profiles, capabilities, inference, planning, migrations, transformations, generators, verification, recovery, filesystem mutation, or provider integration in this increment.
- Do not create or move schema ownership into a separate `project-schema` package.
- Do not expose builder-core as a public package or add generic `PlatformService` or `ApplicationDatabase` ports.
- Follow the currently approved increment and stop at its review gate before expanding this boundary.
