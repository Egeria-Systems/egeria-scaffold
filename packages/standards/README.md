# `@egeria-systems/standards`

Public, replaceable static standards for Egeria Systems workspaces.

The package exposes only:

- `@egeria-systems/standards/typescript/strict.json`, consumed by the private CLI and builder-core packages;
- `@egeria-systems/standards/eslint/typescript-strict`, a strict type-aware flat-config factory consumed by the builder root for CLI, builder-core, and observability source;
- `@egeria-systems/standards/eslint/copy-externalization`, a flat-config factory that rejects static user-visible JSX, relevant attribute, and Next.js metadata copy outside validated content or localization sources; and
- `@egeria-systems/standards/eslint/cloudflare-isolation`, consumed by the Next.js and Cloudflare compatibility proof.

The TypeScript ESLint factory requires an absolute `tsconfigRootDir`, enables `projectService`, and composes the pinned `strictTypeChecked` and `stylisticTypeChecked` presets. It adds no formatter rules or plugins; Prettier remains the formatting owner when a consuming repository installs it.

The copy externalization factory accepts optional `files` and `invariantLiterals` arrays. It reports non-whitespace JSX text, static JSX child expressions, literal `aria-label`, `title`, `placeholder`, and `alt` values, and static visible fields in exported Next.js metadata. It does not autofix or perform data-flow, locale-key, parity, or semantic-content validation. Exact invariant literals are the only supported escape and must be configured centrally.

This copy API is included in version `0.2.0`. Publication and generated-project adoption remain separate explicitly approved steps.

## Cloudflare isolation

The `cloudflareIsolation` named export remains a single flat-config object for existing consumers. To opt into the full static import policy, select the `cloudflareIsolationConfigs` array from the same entry and spread it after the Next.js presets.

```js
import { cloudflareIsolationConfigs } from "@egeria-systems/standards/eslint/cloudflare-isolation";
import { defineConfig } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypeScript,
  ...cloudflareIsolationConfigs,
]);
```

The policy checks static imports and re-exports, including type-only statements when the consuming config supplies a TypeScript parser. It recognizes the generated `@/src/infrastructure/cloudflare` alias and relative spellings for that layout, including sibling Cloudflare paths from infrastructure. It checks the literal module specifier. Dynamic imports, CommonJS, mock references, alternate aliases and arbitrary path detours fall outside its coverage.

Cloudflare infrastructure, `next.config.ts`, `open-next.config.ts` and the jobs `worker.mjs` can import Cloudflare providers and adapters. The same policy applies to the dedicated `tests/integration/cloudflare/` lane and the named health, jobs, compatibility, Queue-topology and D1 integration files and their Worker fixtures. Composition under `src/composition/` and the explicit `app/api/health/route.ts` and `app/api/compatibility/route.ts` bootstrap routes can import the adapters. Ordinary application code and tests are protected from both kinds of imports.

The package has no root export or runtime application code. Its manifest limits both the public API and package contents. Publication remains a separate explicitly approved external action.

The canonical API and lifecycle owner is [package ownership](../../docs/architecture/package-ownership.md).

## Source and license

The package source is [`packages/standards`](https://github.com/Egeria-Systems/egeria-scaffold/tree/main/packages/standards). It is licensed under [Apache-2.0](LICENSE).
