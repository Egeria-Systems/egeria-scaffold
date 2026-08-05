# `@egeria-systems/standards`

Public, replaceable static standards for Egeria Systems workspaces.

P0.3 exposes only:

- `@egeria-systems/standards/typescript/strict.json`, consumed by the private CLI and builder-core packages;
- `@egeria-systems/standards/eslint/cloudflare-isolation`, consumed by the Next.js and Cloudflare compatibility proof.

The package has no root export or runtime application code. Its manifest limits both the public API and package contents. Publication remains a separate explicitly approved external action.

The canonical API and lifecycle owner is [package ownership](../../docs/architecture/package-ownership.md).
