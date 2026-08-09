# `@egeria-systems/standards`

Public, replaceable static standards for Egeria Systems workspaces.

The package exposes only:

- `@egeria-systems/standards/typescript/strict.json`, consumed by the private CLI and builder-core packages;
- `@egeria-systems/standards/eslint/typescript-strict`, a strict type-aware flat-config factory consumed by the builder root for CLI, builder-core, and observability source;
- `@egeria-systems/standards/eslint/copy-externalization`, a flat-config factory that rejects static user-visible JSX, relevant attribute, and Next.js metadata copy outside validated content or localization sources; and
- `@egeria-systems/standards/eslint/cloudflare-isolation`, consumed by the Next.js and Cloudflare compatibility proof.

The TypeScript ESLint factory requires an absolute `tsconfigRootDir`, enables `projectService`, and composes the pinned `strictTypeChecked` and `stylisticTypeChecked` presets. It adds no formatter rules or plugins; Prettier remains the formatting owner when a consuming repository installs it.

The copy externalization factory accepts optional `files` and `invariantLiterals` arrays. It reports non-whitespace JSX text, static JSX child expressions, literal `aria-label`, `title`, `placeholder`, and `alt` values, and static visible fields in exported Next.js metadata. It does not autofix or perform data-flow, locale-key, parity, or semantic-content validation. Exact invariant literals are the only supported escape and must be configured centrally.

This copy API is present in the repository source with a pending minor Changeset. The immutable published `0.1.0` package does not contain it; generated-project adoption requires a separately approved future publication and builder update.

The package has no root export or runtime application code. Its manifest limits both the public API and package contents. Publication remains a separate explicitly approved external action.

The canonical API and lifecycle owner is [package ownership](../../docs/architecture/package-ownership.md).

## Source and license

The package source is [`packages/standards`](https://github.com/Egeria-Systems/egeria-scaffold/tree/main/packages/standards). It is licensed under [Apache-2.0](LICENSE).
