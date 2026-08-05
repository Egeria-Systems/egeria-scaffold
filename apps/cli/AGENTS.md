# Builder CLI boundary

Read the repository [`AGENTS.md`](../../AGENTS.md), the canonical [package ownership](../../docs/architecture/package-ownership.md), and the [review and contribution protocol](../../docs/governance/review-and-contribution.md) before editing this surface.

`apps/cli` is a private builder application boundary. In P0.3 it is only an empty ESM ownership shell.

- Do not add a `bin` entry, command parser, interactive prompt, generated-repository mutation, migration, state write, profile behavior, capability behavior, or user-visible copy in this increment.
- Keep command input/output thin when a later approved stage makes it executable. Builder decisions and repository transformations belong to `packages/builder-core`.
- Do not expose this application as a public package.
- Follow the currently approved increment and stop at its review gate before expanding this boundary.
