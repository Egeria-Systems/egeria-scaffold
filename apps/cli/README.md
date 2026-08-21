# `@egeria-systems/cli`

Private command adapter for the Egeria Systems builder kernel.

The executable exposes five exact commands: `create`, `infer`, `doctor`, `diff`, and `plan-add`. It performs strict command-specific argument parsing, delegates all builder policy and repository behavior to private `@egeria-systems/builder-core`, and emits one content-safe JSON line with stable exits.

`create` generates only a previously absent portfolio or site directory through the verified state-last builder-core boundary. It accepts either the exact base creation arguments or those arguments plus paired `--calendly-url` and `--calendly-mode` options for explicit Calendly initial scaffolding. The mode is exactly `link`, `inline`, or `popup`; builder-core owns the bounded HTTPS Calendly destination contract, selected-capability/settings agreement, and sanitized validation issues.

`infer`, `doctor`, and `diff` are read-only and evaluate the declared Calendly surfaces and settings through builder-core when installed. `plan-add` is also read-only: for a clean attached linked worktree, it checks current project health and returns a deterministic, redacted approval-required plan for adding `booking-calendly@0.1.0`. It detects tracked changes, all non-ignored untracked files, and the `assume-unchanged` and `skip-worktree` index flags. It requires installed application-owned paths to remain files and refuses managed drift, ejections, present collisions, absent but ignored create targets, operations, conflicts, detached or primary worktrees, unexpected Git/reader failures, and a changed final Git identity. It never creates the worktree or branch and performs no transform, migration, state update, dependency installation, or provider action.

The CLI has no prompt, overwrite mode, existing-repository mutation, deployment, publication, Calendly account configuration, provider API, provider-data ownership, or cleanup behavior. Local creation, inspection, eligibility, and planning do not establish recovery, certification, deployed behavior, performance or visual quality, security clearance, production readiness, human accessibility, or WCAG conformance.

The canonical API and lifecycle owner is [package ownership](../../docs/architecture/package-ownership.md).
