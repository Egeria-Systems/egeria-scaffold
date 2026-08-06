# @egeria-systems/observability

This is the intentionally empty public observability package shell for the Egeria Systems builder workspace.

The package establishes the package name, build contract, empty root API, and publication safeguards. Importing the built root module exposes no values. The package has no runtime dependencies and implements no events, redaction, transports, providers, analytics, or Cloudflare integration.

Future behavior requires a separately approved stage and concrete consumers. Analytics remains an independent capability. The canonical ownership and stage boundary are recorded in [Package Ownership](../../docs/architecture/package-ownership.md).

Run `pnpm run verify` in this package to build the declarations and JavaScript, test the empty public API, and type-check the source.

## Source and license

The package source is [`packages/observability`](https://github.com/Egeria-Systems/egeria-scaffold/tree/main/packages/observability). It is licensed under [Apache-2.0](LICENSE).
