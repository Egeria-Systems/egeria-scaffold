# `@egeria-systems/standards`

Public, replaceable static standards for Egeria Systems workspaces.

P0.3 exposes only:

- `@egeria-systems/standards/typescript/strict.json`, consumed by the private CLI and builder-core packages;
- `@egeria-systems/standards/eslint/typescript-strict`, a strict type-aware flat-config factory consumed by the builder root for CLI, builder-core, and observability source;
- `@egeria-systems/standards/eslint/cloudflare-isolation`, consumed by the Next.js and Cloudflare compatibility proof.

The TypeScript ESLint factory requires an absolute `tsconfigRootDir`, enables `projectService`, and composes the pinned `strictTypeChecked` and `stylisticTypeChecked` presets. It adds no formatter rules or plugins; Prettier remains the formatting owner when a consuming repository installs it.

The package has no root export or runtime application code. Its manifest limits both the public API and package contents. Publication remains a separate explicitly approved external action.

The canonical API and lifecycle owner is [package ownership](../../docs/architecture/package-ownership.md).
