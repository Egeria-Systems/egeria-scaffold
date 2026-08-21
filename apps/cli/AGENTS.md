# Builder CLI boundary

Read the repository [`AGENTS.md`](../../AGENTS.md), the canonical [package ownership](../../docs/architecture/package-ownership.md), and the [review and contribution protocol](../../docs/governance/review-and-contribution.md) before editing this surface.

`apps/cli` is the private executable adapter for the builder kernel.

- Keep the five commands exact: `create`, `infer`, `doctor`, `diff`, and `plan-add`. Parse only command-specific long options and emit one content-safe JSON line.
- Keep command input/output thin. Builder decisions, repository transformations, schemas, profile recipes, state, inference, and diagnostics belong to `packages/builder-core`.
- `create` may call only builder-core's approved new-directory generation boundary. It does not add overwrite, interactive prompt, Git, deployment, publication, provider, or existing-repository mutation behavior.
- `infer`, `doctor`, and `diff` remain read-only and must not install dependencies or change repository bytes.
- `plan-add` remains read-only and is limited to `booking-calendly` with paired validated Calendly settings. Require builder-core's clean attached linked worktree preflight before and after planning, return only the stable redacted plan or refusal code, and never create the worktree or branch. Do not transform, migrate, persist state, install dependencies, or contact a provider.
- Test this adapter with Node's test runner (`node --test`) through `pnpm run test:cli`. Cover argument parsing and process/output contracts with focused unit and subprocess tests; keep generated-project behavior in builder-core. Passing CLI tests do not prove dependency installation, generated application runtime, browser, workerd, deployment, or provider behavior.
- Do not expose this application as a public package.
- Follow the currently approved increment and stop at its review gate before expanding this boundary.
