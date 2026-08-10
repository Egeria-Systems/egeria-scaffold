# `@egeria-systems/cli`

Private command adapter for the Egeria Systems builder kernel.

The executable exposes four exact commands: `create`, `infer`, `doctor`, and `diff`. It performs strict command-specific argument parsing, delegates all builder policy and repository behavior to private `@egeria-systems/builder-core`, and emits one content-safe JSON line with stable exits.

`create` generates only a previously absent portfolio or site directory through the verified state-last builder-core boundary. It accepts either the exact base creation arguments or those arguments plus paired `--calendly-url` and `--calendly-mode` options for explicit Calendly initial scaffolding. The mode is exactly `link`, `inline`, or `popup`; builder-core owns the bounded HTTPS Calendly destination contract, selected-capability/settings agreement, and sanitized validation issues.

`infer`, `doctor`, and `diff` are read-only and evaluate the declared Calendly surfaces and settings through builder-core when installed. The CLI has no prompt, overwrite mode, later-add command, existing-repository transformation, Git behavior, deployment, publication, Calendly account configuration, provider API, provider-data ownership, or cleanup behavior. Local creation and inspection do not establish protected-staging or provider-confirmed certification.

The canonical API and lifecycle owner is [package ownership](../../docs/architecture/package-ownership.md).
