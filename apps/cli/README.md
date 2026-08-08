# `@egeria-systems/cli`

Private command adapter for the Egeria Systems builder kernel.

The executable exposes four exact commands: `create`, `infer`, `doctor`, and `diff`. It performs strict command-specific argument parsing, delegates all builder policy and repository behavior to private `@egeria-systems/builder-core`, and emits one content-safe JSON line with stable exits.

`create` generates only a previously absent portfolio or site directory through the verified state-last builder-core boundary. `infer`, `doctor`, and `diff` are read-only. The CLI has no prompt, overwrite mode, existing-repository transformation, Git behavior, deployment, publication, or provider integration.

The canonical API and lifecycle owner is [package ownership](../../docs/architecture/package-ownership.md).
