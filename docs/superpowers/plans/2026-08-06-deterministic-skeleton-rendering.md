# Deterministic Portfolio and Site Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to execute this plan task by task. Use `superpowers:test-driven-development` for every runtime change and `superpowers:verification-before-completion` before any completion claim.

**Goal:** Render deterministic, in-memory `portfolio` and `site` skeletons from explicit checked-in templates while preserving the current P1 capability, project, and ownership contracts.

**Architecture:** A private explicit catalog selects common templates plus one profile overlay. A pure strict renderer validates source names, destination paths, and the exact three-token grammar. An imperative shell reads the allowlisted templates, composes the existing catalog/profile/resolver/project contracts, inserts the supplied public-package versions structurally into parsed JSON, validates every declared ownership target, and returns sorted bytes without writing a repository or `.egeria` state.

**Tech stack:** Node.js `22.23.0` as the accepted repository pin, pnpm `11.20.0`, TypeScript `6.0.3`, Zod `4.4.3`, Node test runner, Next.js `16.3.0`, React/React DOM `19.2.8`, OpenNext Cloudflare `1.20.2`, Wrangler `4.118.0`, ESLint `9.39.5`.

**Design authority:** [`2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md`](../../roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md), accepted ADRs `0001`–`0011`, and the approved P1 Task 6 design in [`2026-08-05-p1-builder-kernel.md`](2026-08-05-p1-builder-kernel.md). Preparation and current-source evidence is recorded in [`2026-08-06-deterministic-skeleton-rendering-preparation.md`](../../implementation-evidence/2026-08-06-deterministic-skeleton-rendering-preparation.md).

## Approval and execution boundary

This plan stops at Gate 2. Approval authorizes only the local Task 6 files and focused commits listed below. It does not authorize Task 7, a Node pin change, public-package publication, generated-project installation, destination writes, `.egeria` state, CLI behavior, push, pull request, merge, workflow dispatch, deployment, provider mutation, permission changes, external messages, or responses to review comments.

Before the first implementation edit:

1. Re-read root and `packages/builder-core/AGENTS.md` instructions, this plan, its preparation evidence, and the current files named here.
2. Run `rtk git status --short --branch`, `rtk git rev-parse HEAD`, and `rtk git worktree list --porcelain`.
3. Confirm the approved comparison base remains `5ed1630`; after the planning commit, record its exact commit as the implementation starting `HEAD`.
4. Preserve the user's unstaged root `AGENTS.md` change. Do not stage, edit, restore, or include it in a Task 6 commit.
5. Confirm the approved source-plan SHA-256 remains `30860d49a11b53d42839e3e6f687e62e58155b3ac68014f75d9799b6f3605b05` and `pnpm-lock.yaml` remains `f454284272a7ee9932d9470f288b72ac1479b3c806807dfdff3591fe9dea8fc0`.
6. If a named runtime, template, test, direct-owner document, manifest, lockfile, or accepted ADR changed, stop and amend this plan before coding.

After Gate 2 approval, preserve the approved preparation boundary in one focused documentation commit before runtime work:

```bash
git add docs/implementation-evidence/2026-08-06-deterministic-skeleton-rendering-preparation.md docs/superpowers/plans/2026-08-06-deterministic-skeleton-rendering.md
git diff --cached --check
git commit -m "Plan deterministic skeleton rendering"
```

Verify the staged diff contains only those two files and excludes root `AGENTS.md`. This commit records approval inputs; it does not begin implementation.

Because the primary checkout contains the user-owned root `AGENTS.md` edit, create an isolated implementation worktree after the planning commit:

```bash
git worktree add /private/tmp/egeria-scaffold-p1-task-6 -b p1-task-6-skeleton-rendering
```

Run all remaining implementation, tests, reviews, and commits from `/private/tmp/egeria-scaffold-p1-task-6`. Record the planning commit as the implementation starting `HEAD`. Do not copy, stash, stage, or otherwise move the primary checkout's root `AGENTS.md` edit. If the temporary worktree path already exists or the branch name is already present, stop and inspect rather than deleting or overwriting either target.

Use the pinned pnpm executable in every repository command:

```bash
/Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm
```

## Scope and non-goals

Task 6 creates no dependency change. Do not edit any `package.json`, `pnpm-lock.yaml`, root tool configuration, JSON Schema artifact, compatibility record, proof file, CLI file, or `.egeria` file.

The generated skeleton is data returned by `renderSkeleton`; it is not written, installed, built, previewed, deployed, or represented as release-ready. Tests use synthetic exact `0.1.0` standards and observability versions only as contract inputs. Task 7 remains blocked on the separately authorized publication prerequisite.

The accepted Node `22.23.0` pin is retained in rendered bytes because changing the runtime matrix crosses the compatibility boundary. Official Node `22.23.2` security fixes make a separate runtime-pin increment mandatory before P1 closure and before an installable generated repository is accepted.

Do not add application foundation, persistence, databases, email, jobs, durable submissions, identity, TOTP, passkeys, payments, analytics, CMS, forms, `apps/jobs`, local generated packages, business CRUD, generated lockfiles, deployment variables, middleware, or provider resources.

## Exact final file set

Create these runtime files:

```text
packages/builder-core/src/generation/render-template.ts
packages/builder-core/src/generation/template-catalog.ts
packages/builder-core/src/generation/render-skeleton.ts
packages/builder-core/tests/render-skeleton.test.mjs
```

Create these common templates:

```text
packages/builder-core/templates/common/.gitignore.template
packages/builder-core/templates/common/.nvmrc
packages/builder-core/templates/common/AGENTS.md.template
packages/builder-core/templates/common/README.md.template
packages/builder-core/templates/common/package.json.template
packages/builder-core/templates/common/pnpm-workspace.yaml
packages/builder-core/templates/common/apps/web/AGENTS.md.template
packages/builder-core/templates/common/apps/web/package.json.template
packages/builder-core/templates/common/apps/web/tsconfig.json
packages/builder-core/templates/common/apps/web/eslint.config.mjs
packages/builder-core/templates/common/apps/web/next.config.ts
packages/builder-core/templates/common/apps/web/open-next.config.ts
packages/builder-core/templates/common/apps/web/wrangler.jsonc.template
packages/builder-core/templates/common/apps/web/app/globals.css
packages/builder-core/templates/common/apps/web/app/layout.tsx
packages/builder-core/templates/common/apps/web/app/page.tsx
packages/builder-core/templates/common/apps/web/src/content/content-schema.ts
packages/builder-core/templates/common/apps/web/src/content/read-content.ts
packages/builder-core/templates/common/apps/web/src/presentation/content-page.tsx
packages/builder-core/templates/common/apps/web/src/infrastructure/observability/installed-capability.ts
```

Create these profile overlays:

```text
packages/builder-core/templates/portfolio/apps/web/content/en-CA/site.json.template
packages/builder-core/templates/site/apps/web/content/en-CA/site.json.template
packages/builder-core/templates/site/apps/web/content/en-CA/about.json.template
packages/builder-core/templates/site/apps/web/app/about/page.tsx
```

Modify these direct consumers atomically:

```text
packages/builder-core/src/index.ts
packages/builder-core/AGENTS.md
packages/builder-core/README.md
docs/architecture/package-ownership.md
docs/architecture/enforcement-map.md
tests/package-boundaries/private-packages.test.mjs
```

After implementation and independent review, create:

```text
docs/implementation-evidence/2026-08-06-deterministic-skeleton-rendering-verification.md
docs/review-packets/2026-08-06-p1-task-6-deterministic-skeleton-rendering.md
```

Do not change the date silently if work crosses a local calendar day; use the actual verification/review date in those two filenames and cross-links.

## Public API and stable failures

`packages/builder-core/src/generation/render-skeleton.ts` owns these public types and function:

```ts
export type GenerationRequest = Readonly<{
  profile: "portfolio" | "site";
  projectName: string;
  displayName: string;
  packageVersions: CapabilityPackageVersions;
}>;

export type GeneratedFile = Readonly<{
  path: string;
  content: Uint8Array;
}>;

export type RenderedSkeleton = Readonly<{
  project: ProjectConfiguration;
  resolved: ResolvedCapabilities;
  files: readonly GeneratedFile[];
  surfaces: readonly ManagedSurfaceDescriptor[];
}>;

export async function renderSkeleton(
  request: GenerationRequest,
): Promise<ValidationResult<RenderedSkeleton>>;
```

Root-export only `renderSkeleton` and the three types above. Keep catalog entries, token helpers, template reads, builder-owned descriptor construction, and package-manifest mutation private.

New stable issue codes are:

```text
TEMPLATE_SOURCE_INVALID
TEMPLATE_TOKEN_INVALID
TEMPLATE_DESTINATION_DUPLICATE
TEMPLATE_READ_FAILED
GENERATED_MANIFEST_INVALID
GENERATED_SURFACE_INVALID
```

Every failure is a `ValidationResult`, with a deterministic path and sanitized context. Never include an absolute path, template contents, stack trace, user-supplied display name, filesystem error message, or secret-bearing environment value in an issue. Reuse current catalog/resolution/project issue codes rather than wrapping them.

Use these issue paths:

```text
TEMPLATE_SOURCE_INVALID       ["templates", entryIndex, "source"]
TEMPLATE_TOKEN_INVALID        ["templates", entryIndex, "tokens"]
TEMPLATE_DESTINATION_DUPLICATE ["files", destination]
TEMPLATE_READ_FAILED          ["templates", entryIndex, "source"]
GENERATED_MANIFEST_INVALID    ["files", "apps/web/package.json"]
GENERATED_SURFACE_INVALID     ["surfaces"]
```

`context` contains only stable categorical values such as `{ reason: "unknown-token" }`, `{ reason: "malformed-token" }`, `{ reason: "recursive-token" }`, `{ reason: "invalid-json" }`, `{ reason: "missing-section" }`, or `{ reason: "ownership-validation" }`.

## Template and output contracts

The only textual tokens are:

```text
{{projectName}}
{{displayNameJson}}
{{workerName}}
```

`displayNameJson` is `JSON.stringify(project.displayName)`, including its JSON quotes. The JSON content templates therefore place it as a value without surrounding quotes. `workerName` equals the validated `projectName` in Task 6.

Only source paths ending in `.template` may contain tokens. Rendering performs one substitution pass. Reject source text containing any unknown or malformed `{{...}}` form, and reject replacement values containing `{{` or `}}` so user data cannot trigger recursive substitution. Static templates must contain no token delimiters.

All template source paths and derived destination paths pass `safeRelativePathSchema`. Derive destinations only by removing the first layer segment (`common/`, `portfolio/`, or `site/`) and then removing one terminal `.template`. Reject a destination equal to its layer root, an invalid path, or a duplicate after common/profile overlay composition.

Normalize CRLF and lone CR to LF and return exactly one final LF for every file. Sort `GeneratedFile[]` by `path` with direct code-point comparison, not locale-dependent comparison. Return new `Uint8Array` values and do not expose mutable internal buffers.

The exact generated destination sets are:

```text
portfolio (21 files)
.gitignore
.nvmrc
AGENTS.md
README.md
package.json
pnpm-workspace.yaml
apps/web/AGENTS.md
apps/web/app/globals.css
apps/web/app/layout.tsx
apps/web/app/page.tsx
apps/web/content/en-CA/site.json
apps/web/eslint.config.mjs
apps/web/next.config.ts
apps/web/open-next.config.ts
apps/web/package.json
apps/web/src/content/content-schema.ts
apps/web/src/content/read-content.ts
apps/web/src/infrastructure/observability/installed-capability.ts
apps/web/src/presentation/content-page.tsx
apps/web/tsconfig.json
apps/web/wrangler.jsonc

site (23 files)
the 21 portfolio destinations plus:
apps/web/app/about/page.tsx
apps/web/content/en-CA/about.json
```

No profile overlay may replace a common destination. Profile-specific differences live only in the listed content/route files.

## Generated project contract

Create and parse this desired project configuration through `projectConfigurationSchema`:

```ts
{
  schemaVersion: "1.0.0",
  builderCompatibility: "0.0.0",
  project: {
    name: request.projectName,
    displayName: request.displayName,
    defaultLocale: "en-CA",
  },
  originProfile: request.profile,
  recipeVersion: resolved.recipeVersion,
  platformAdapter: "cloudflare-workers",
  selectedCapabilities: resolved.capabilities.map(({ identifier }) => identifier),
  capabilitySettings: {},
  ejectedAreas: [],
}
```

Call `createCapabilityCatalog(request.packageVersions)`, then `resolveCapabilities({ profile: request.profile }, catalog, profileRecipes)`. Do not accept optional capabilities in Task 6. `portfolio` resolves five capabilities; `site` resolves those five plus `site-routing`, in the existing dependency-stable order.

The generated root `package.json` is:

```json
{
  "name": "{{projectName}}",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "build": "pnpm --dir apps/web run build",
    "build:cloudflare": "pnpm --dir apps/web run build:cloudflare",
    "dev": "pnpm --dir apps/web run dev",
    "lint": "pnpm --dir apps/web run lint",
    "typecheck": "pnpm --dir apps/web run typecheck",
    "verify": "pnpm run lint && pnpm run typecheck && pnpm run build && pnpm run build:cloudflare"
  },
  "engines": {
    "node": "22.23.0",
    "pnpm": "11.20.0"
  },
  "packageManager": "pnpm@11.20.0",
  "volta": {
    "node": "22.23.0"
  }
}
```

The application manifest template contains the accepted fixed graph and no standards/observability placeholders:

```json
{
  "name": "{{projectName}}-web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "next build",
    "build:cloudflare": "opennextjs-cloudflare build",
    "cf-typegen": "wrangler types --env-interface CloudflareEnv --include-runtime=false cloudflare-env.d.ts",
    "dev": "next dev",
    "lint": "eslint . --max-warnings 0",
    "preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
    "typecheck": "next typegen && tsc --noEmit"
  },
  "dependencies": {
    "@opennextjs/cloudflare": "1.20.2",
    "next": "16.3.0",
    "react": "19.2.8",
    "react-dom": "19.2.8"
  },
  "devDependencies": {
    "@types/node": "22.20.1",
    "@types/react": "19.2.18",
    "@types/react-dom": "19.2.4",
    "eslint": "9.39.5",
    "eslint-config-next": "16.3.0",
    "typescript": "6.0.3",
    "typescript-eslint": "8.66.0",
    "wrangler": "4.118.0"
  }
}
```

After text rendering, parse this manifest, require plain-object `dependencies` and `devDependencies`, insert:

```ts
dependencies["@egeria-systems/observability"] =
  request.packageVersions.observability;
devDependencies["@egeria-systems/standards"] =
  request.packageVersions.standards;
```

Serialize with `stringifyCanonicalJson` plus one LF. This structural insertion preserves the exact three-token grammar. The capability catalog already rejects ranges, prereleases, Git/URL/file sources, and `workspace:` through its stable semantic-version contract.

The generated `pnpm-workspace.yaml` is exactly:

```yaml
packages:
  - "apps/*"

pmOnFail: error

minimumReleaseAge: 1440

overrides:
  "miniflare>undici": 7.29.0

allowBuilds:
  "@parcel/watcher": true
  "@swc/core": true
  esbuild: true
  unrs-resolver: true
  workerd: true
```

Use the proof's accepted `eslint.config.mjs`, `next.config.ts`, and `open-next.config.ts` bytes. The generated `tsconfig.json` extends `@egeria-systems/standards/typescript/strict.json`, adds the Next plugin and DOM/Bundler/JSX settings, includes `next-env.d.ts`, `cloudflare-env.d.ts`, application source/configuration, `.next/types/**/*.ts`, and `.next/dev/types/**/*.ts`, and excludes `node_modules`. Do not generate `next-env.d.ts` or `cloudflare-env.d.ts`; their commands own them.

The generated Wrangler JSONC has:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "{{workerName}}",
  "main": ".open-next/worker.js",
  "compatibility_date": "2026-08-04",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  }
}
```

Do not add proof-only variables or deployment scripts.

## Copy, presentation, and route contract

All generated application runtime UI and metadata copy resides in `apps/web/content/en-CA/*.json`. TypeScript and TSX may contain stable invariant identifiers, HTML element names, import paths, error identifiers, and locale configuration, but no heading, summary, navigation label, title, or description literal. Developer-facing repository instructions and README prose are documentation, not runtime application copy.

Use this portfolio content shape:

```json
{
  "metadata": {
    "title": {{displayNameJson}},
    "description": "A focused portfolio."
  },
  "home": {
    "heading": {{displayNameJson}},
    "summary": "A concise introduction to selected work."
  },
  "navigation": []
}
```

Use this site content shape:

```json
{
  "metadata": {
    "title": {{displayNameJson}},
    "description": "A multi-page public website."
  },
  "home": {
    "heading": {{displayNameJson}},
    "summary": "A clear starting point for this website."
  },
  "navigation": [
    { "href": "/", "label": "Home" },
    { "href": "/about", "label": "About" }
  ]
}
```

Use this site-only about content:

```json
{
  "heading": "About",
  "summary": "Background and approach."
}
```

`content-schema.ts` exports readonly `NavigationItem`, `PageContent`, and `SiteContent` types plus `parsePageContent` and `parseSiteContent`. Implement a small local unknown-record guard. Require exact keys, non-empty trimmed string values, an array for navigation, unique navigation `href` values, and no unrecognized properties. Throw only stable `CONTENT_INVALID` on invalid imported JSON. Do not add a generated Zod dependency.

`read-content.ts` statically imports `site.json`, parses it, and exports `readSiteContent(): SiteContent`. The home route and root layout call that reader. The site-only about route statically imports `about.json`, calls `parsePageContent`, and obtains navigation from `readSiteContent`.

`ContentPage` is a pure presentation function with this contract:

```ts
export type ContentPageProperties = Readonly<{
  heading: string;
  summary: string;
  navigation: readonly NavigationItem[];
}>;

export function ContentPage({
  heading,
  summary,
  navigation,
}: ContentPageProperties) {
  // Semantic JSX derived only from the supplied data.
}
```

Render navigation only when the array is non-empty. Do not read files, import JSON, access environment state, call Cloudflare APIs, fetch, or mutate values from this component. Routes load typed content and pass it to the component. The root layout derives Next `Metadata` title and description from parsed JSON and keeps `lang="en-CA"` as a locale identifier rather than visible copy.

`installed-capability.ts` imports `@egeria-systems/observability` for package registration and exports the stable identifier `observability`. It has no analytics behavior, environment access, telemetry event, or Cloudflare type.

## Ownership contract

Build the desired descriptor list by flattening `managedSurfaces` from the resolved capability order and appending the exact builder-owned descriptors below. Sort the final descriptors by `identifier` with code-point comparison.

Builder-owned full-file descriptors:

| Identifier | Path | Ownership |
| --- | --- | --- |
| `builder-gitignore` | `.gitignore` | `application-owned` |
| `builder-node-version` | `.nvmrc` | `managed` |
| `builder-root-instructions` | `AGENTS.md` | `application-owned` |
| `builder-readme` | `README.md` | `application-owned` |
| `builder-root-package-manifest` | `package.json` | `managed` |
| `builder-workspace-configuration` | `pnpm-workspace.yaml` | `managed` |
| `builder-web-instructions` | `apps/web/AGENTS.md` | `application-owned` |
| `builder-global-styles` | `apps/web/app/globals.css` | `application-owned` |
| `builder-root-layout` | `apps/web/app/layout.tsx` | `application-owned` |

Every row uses owner `{ kind: "builder-kernel" }`, `fingerprintTarget: { kind: "file" }`, and `mergeStrategy: "replace-file"`.

Builder-owned `apps/web/package.json` JSON-property descriptors:

| Identifier | Pointer |
| --- | --- |
| `builder-web-package-name` | `/name` |
| `builder-web-package-version` | `/version` |
| `builder-web-package-private` | `/private` |
| `builder-web-package-type` | `/type` |
| `builder-web-package-scripts` | `/scripts` |
| `builder-web-package-next` | `/dependencies/next` |
| `builder-web-package-react` | `/dependencies/react` |
| `builder-web-package-react-dom` | `/dependencies/react-dom` |
| `builder-web-package-types-node` | `/devDependencies/@types~1node` |
| `builder-web-package-types-react` | `/devDependencies/@types~1react` |
| `builder-web-package-types-react-dom` | `/devDependencies/@types~1react-dom` |
| `builder-web-package-eslint` | `/devDependencies/eslint` |
| `builder-web-package-eslint-next` | `/devDependencies/eslint-config-next` |
| `builder-web-package-typescript` | `/devDependencies/typescript` |
| `builder-web-package-typescript-eslint` | `/devDependencies/typescript-eslint` |

Every row uses owner `{ kind: "builder-kernel" }`, path `apps/web/package.json`, ownership `merge-managed`, `fingerprintTarget: { kind: "json-value", pointer }`, and `mergeStrategy: "json-property"`.

Do not add a full-file descriptor for `apps/web/package.json`; it would overlap the capability package pointers. Capability descriptors remain the canonical owners of standards configuration/content/routes/Cloudflare configuration/observability registration and these four manifest properties:

```text
/dependencies/@opennextjs~1cloudflare
/dependencies/@egeria-systems~1observability
/devDependencies/@egeria-systems~1standards
/devDependencies/wrangler
```

Construct a `ReadonlyMap<string, Uint8Array>` from all rendered files and call `materializeInstalledSurfaces({ files, surfaces })`. This call validates existence, JSON pointers, duplicate identifiers, and overlapping targets. Discard its fingerprints because installed state is Task 7. Map any failure to `GENERATED_SURFACE_INVALID` without leaking content. Successful totals are exactly 39 descriptors for `portfolio` and 41 for `site`.

## Task 1: Strict renderer mechanics

**Files:**

- Create: `packages/builder-core/src/generation/render-template.ts`
- Create: `packages/builder-core/tests/render-skeleton.test.mjs`

- [ ] **Step 1.1 — Write focused RED tests**

Create the test file with Node `assert/strict` and `node:test`. Import internal compiled helpers from `../dist/generation/render-template.js`; internal import is test-only and does not expand package exports.

Test:

- exact replacement of all three allowed tokens;
- JSON-safe quotes/newlines in `displayNameJson` remain valid data;
- CRLF and CR normalize to LF with exactly one terminal LF;
- static sources pass unchanged apart from newline normalization;
- unknown, malformed, unresolved, and replacement-introduced tokens return `TEMPLATE_TOKEN_INVALID` with sanitized context;
- unsafe source/destination forms return `TEMPLATE_SOURCE_INVALID`;
- `.template` strips exactly once and static names remain unchanged.

- [ ] **Step 1.2 — Verify expected RED**

```bash
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run build
rtk node --test packages/builder-core/tests/render-skeleton.test.mjs
```

Expected RED: TypeScript cannot resolve `src/generation/render-template.ts`, or the test cannot import its compiled module. Do not accept a syntax failure in the test itself as RED.

- [ ] **Step 1.3 — Implement the minimum pure helpers**

In `render-template.ts`, define private token-name and token-value types, and export only the internal functions required by the test and sibling generation modules. Use `safeRelativePathSchema`; do not use filesystem functions. Prefer explicit `for...of` token scanning where it preserves error location and early exit.

Required internal operations:

```ts
type TemplateTokens = Readonly<{
  projectName: string;
  displayNameJson: string;
  workerName: string;
}>;

deriveTemplateDestination(source: string): ValidationResult<string>;
renderTemplateSource(input: Readonly<{
  source: string;
  text: string;
  tokens: TemplateTokens;
}>): ValidationResult<string>;
```

- [ ] **Step 1.4 — Verify focused GREEN**

```bash
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run build
rtk node --test packages/builder-core/tests/render-skeleton.test.mjs
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run lint
rtk git diff --check
rtk git status --short
```

Do not commit this partial state. The repository's exact Task 5 source allowlist intentionally rejects the new module until Task 3 advances the enforcement test and all direct owners. Continue directly to Task 2 with the focused renderer test green.

## Task 2: Explicit catalog and deterministic skeleton composition

**Files:**

- Create: `packages/builder-core/src/generation/template-catalog.ts`
- Create: `packages/builder-core/src/generation/render-skeleton.ts`
- Create: all 24 template files in the exact final file set
- Modify: `packages/builder-core/src/index.ts`
- Modify: `packages/builder-core/tests/render-skeleton.test.mjs`

- [ ] **Step 2.1 — Extend tests for the public contract**

Import the public function from `../dist/index.js`. Add helpers that decode files, index by path, parse JSON, and compare byte arrays without mutating returned values.

Test all of the following:

1. Exact sorted 21-file `portfolio` destination list and 23-file `site` list.
2. Byte-for-byte equality across two same-input renders; catalog order and read completion order cannot affect returned ordering.
3. Every path is relative, contains no parent segment/backslash/control character, and every file has LF-only text with exactly one final LF.
4. `portfolio` has only `/`; `site` adds `/about`; neither output contains `apps/jobs`, generated `packages`, `.egeria`, a lockfile, middleware, or a deploy workflow.
5. Exact root/application manifests, exact accepted package pins, exact supplied synthetic `0.1.0` public-package pins, and absence of `workspace:`, `file:`, Git/URL sources, ranges, or prereleases.
6. Desired project configuration agrees with the resolved profile and capabilities.
7. `displayName` containing quotes, a newline, and non-ASCII text yields valid JSON and cannot alter JSON structure.
8. Invalid profile/name/display-name/package versions return existing catalog/project contract failures without reading or writing outside the template root.
9. Visible copy strings occur in content JSON and do not occur in TS/TSX; `portfolio` navigation is empty and `site` navigation/about content is exact.
10. No later-capability/provider markers occur: `app-foundation`, `database`, `d1`, `queue`, `resend`, `better-auth`, `stripe`, `analytics`, `web-analytics`, `cms`, `contact-submission`, `totp`, or `passkey`.
11. Every capability-owned descriptor equals the corresponding descriptor from the resolved catalog.
12. Descriptor totals are 39 and 41; all descriptor sources/pointers validate; no generated destination except `apps/web/package.json` lacks one full-file owner; package-manifest pointers cover every top-level/dependency/devDependency region exactly once without overlap.
13. Returned arrays are sorted, returned values do not expose a writable shared buffer, and one caller mutation cannot change a later render.
14. No filesystem destination is created and no repository file is changed by rendering.

- [ ] **Step 2.2 — Verify expected RED**

```bash
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run build
rtk node --test packages/builder-core/tests/render-skeleton.test.mjs
```

Expected RED: the root export and/or catalog/skeleton modules are absent. Keep the Task 1 renderer tests green.

- [ ] **Step 2.3 — Add the explicit catalog**

In `template-catalog.ts`, define readonly explicit arrays for the 20 common sources, one portfolio source, and three site sources. Do not call `readdir`, glob, walk directories, infer entries from disk, or permit caller-supplied template roots. Compose common plus exactly one profile array, derive/validate every destination with Task 1 helpers, reject duplicates before reading, and return entries sorted by destination.

- [ ] **Step 2.4 — Add exact checked-in templates**

Create only the named templates. Use normal source files as data; do not assemble executable TypeScript from fragments. Keep configuration aligned with the accepted proof and the generated-project/copy contracts above.

Generated `AGENTS.md` files are concise application-owned guidance. They describe the generated workspace boundary, copy externalization, pure presentation, and the prohibition on moving Cloudflare types into domain/application code. They do not reproduce the builder program lifecycle or claim that the generated repository is already verified.

`.gitignore` covers generated Node/Next/OpenNext/Wrangler artifacts, `next-env.d.ts`, `cloudflare-env.d.ts`, environment files except an example file, coverage, and common editor/OS state. It contains no credential value.

- [ ] **Step 2.5 — Compose the skeleton**

In `render-skeleton.ts`:

1. Validate package versions by creating the current capability catalog.
2. Resolve the current profile recipe.
3. Parse desired project configuration.
4. Obtain the explicit catalog.
5. Compute token values from validated project data.
6. Resolve the package-root template URL with `new URL("../../templates/", import.meta.url)`.
7. Read only allowlisted sources with `readFile(url, "utf8")`; convert read failures to sanitized results.
8. Render each source and encode with one shared `TextEncoder`.
9. Parse, structurally enrich, canonicalize, and replace the application-manifest bytes.
10. Construct capability and builder ownership descriptors.
11. Validate all sources/pointers through `materializeInstalledSurfaces` and discard the returned installed fingerprints.
12. Return sorted project/resolution/files/surfaces data.

Keep I/O orchestration in `renderSkeleton`. Keep project construction, manifest enrichment, descriptor construction, and sorting pure. Do not catch and expose raw errors.

- [ ] **Step 2.6 — Export only the public rendering boundary**

Append explicit exports to `src/index.ts`:

```ts
export { renderSkeleton } from "./generation/render-skeleton.js";
export type {
  GeneratedFile,
  GenerationRequest,
  RenderedSkeleton,
} from "./generation/render-skeleton.js";
```

Do not export internal catalog or renderer helpers.

- [ ] **Step 2.7 — Verify focused GREEN**

```bash
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run build
rtk node --test packages/builder-core/tests/render-skeleton.test.mjs
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run typecheck
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run lint
rtk git diff --check
rtk git status --short
```

Review every changed line against the Task 6 scope and make one focused DRY pass. Remove only duplication whose removal is clearly lower-risk than retaining it.

Do not stage or commit this partial state. Package-boundary enforcement and direct-owner documentation still describe Task 5. Continue directly to Task 3 so source, templates, enforcement, and canonical consumers remain atomic.

## Task 3: Advance direct boundary owners

**Files:**

- Modify: `tests/package-boundaries/private-packages.test.mjs`
- Modify: `packages/builder-core/AGENTS.md`
- Modify: `packages/builder-core/README.md`
- Modify: `docs/architecture/package-ownership.md`
- Modify: `docs/architecture/enforcement-map.md`

- [ ] **Step 3.1 — Write boundary RED**

Update the package-boundary test first:

- rename the source-boundary test to `the CLI remains an empty shell while builder-core owns the approved rendering boundary`;
- add the three generation modules to the exact source allowlist;
- add an exact recursive template-file allowlist matching the 24 sources in this plan;
- remove only `packages/builder-core/templates` from the later-stage forbidden paths;
- retain `.egeria`, CLI generation/state directories, builder-core `capabilities`, `generators`, `migrations`, and runtime `state` as forbidden;
- require the four direct-owner documents to describe the private deterministic-rendering boundary, deterministic in-memory rendering, explicit allowlisted templates, no repository write/state, and the separate future generation boundary;
- require package ownership to identify private builder-core as canonical owner and enforcement mapping to name the exact source/template allowlists and render tests.

Run only the boundary test. Expected RED is the deliberately stale exact source/template boundary and documentation text, not a malformed assertion:

```bash
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:package-boundaries
```

- [ ] **Step 3.2 — Update canonical/direct-owner documentation**

Make surgical changes:

- `packages/builder-core/AGENTS.md`: allow the exact `src/generation` and template boundaries; require explicit catalogs, strict tokens, deterministic bytes, copy externalization, pure presentation, no writes/state/CLI, and current ownership validation.
- `packages/builder-core/README.md`: describe the Task 6 public rendering API, returned values, stable failures, and evidence limits. Keep the CLI empty and Task 7 separate.
- `docs/architecture/package-ownership.md`: advance private builder-core responsibility through Task 6 and record templates/generation as private implementation data/API; do not imply public package extraction.
- `docs/architecture/enforcement-map.md`: map deterministic rendering, copy placement, Cloudflare isolation, and ownership agreement to `render-skeleton.test.mjs` and the exact package-boundary allowlists. Mark install/build/runtime/accessibility properties unproved.

Link to canonical owners instead of copying full lifecycle rules.

- [ ] **Step 3.3 — Verify coherent GREEN, commit, and stop**

```bash
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run check:semantic-naming
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:package-boundaries
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:constitution
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run verify
rtk git diff --check
rtk git status --short
```

Stage the complete atomic Task 6 implementation boundary, verify the staged diff excludes root `AGENTS.md`, then commit:

```bash
git add packages/builder-core/src/generation packages/builder-core/src/index.ts packages/builder-core/templates packages/builder-core/tests/render-skeleton.test.mjs tests/package-boundaries/private-packages.test.mjs packages/builder-core/AGENTS.md packages/builder-core/README.md docs/architecture/package-ownership.md docs/architecture/enforcement-map.md
git diff --cached --check
git commit -m "Render deterministic skeletons"
```

Stop for explicit user approval of this coherent implementation increment before Task 4 review and verification. Do not dispatch reviewers or write completion evidence until that approval.

## Task 4: Coherent verification, independent review, and Gate 3 packet

**Files:**

- Create: `docs/implementation-evidence/2026-08-06-deterministic-skeleton-rendering-verification.md`
- Create: `docs/review-packets/2026-08-06-p1-task-6-deterministic-skeleton-rendering.md`
- Modify runtime/tests/direct owners only when a reviewer finding is independently verified against the current tree and materially blocks approval

- [ ] **Step 4.1 — Freeze the coherent diff**

Record branch, base, `HEAD`, worktrees, status, changed-file list, staged/unstaged split, source-plan hash, lockfile hash, the planning commit, and the coherent implementation commit. Explicitly list the preserved user-owned root `AGENTS.md` change and confirm it is outside the Task 6 diff.

Use commit-based comparisons for Task 6 evidence so the unrelated working-tree edit is excluded:

```bash
rtk git diff --name-status 5ed1630..HEAD
rtk git diff --stat 5ed1630..HEAD
rtk git diff --check 5ed1630..HEAD
```

- [ ] **Step 4.2 — Run the full relevant deterministic suite once**

```bash
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run check:semantic-naming
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run verify
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:package-boundaries
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:constitution
rtk git diff --check 5ed1630..HEAD
rtk git status --short --branch
```

Do not rerun the unchanged compatibility proof or current dependency audit: Task 6 changes neither the proof nor installed lock graph. Do not install or build a rendered project. Record those as explicit evidence limits.

- [ ] **Step 4.3 — Dispatch bounded independent read-only reviewers**

After the coherent implementation is green, dispatch exactly these independent reviewers with no recursive fan-out and no write permission:

1. **Requirements reviewer:** compare `5ed1630..HEAD` with the approved Task 6 scope, authoritative program model, exact file sets, copy rules, and deferrals.
2. **Architecture and anti-overengineering reviewer:** inspect functional-core/imperative-shell separation, reuse of current contracts, explicit catalog, package boundaries, Cloudflare isolation, ownership overlap, and premature abstractions.
3. **Test-evidence reviewer:** verify RED/GREEN evidence, determinism/negative cases, exact fixtures, stable errors, and that claims do not exceed exercised behavior.
4. **Template/input-security specialist:** inspect traversal/token injection, JSON insertion, sanitized failures, secret exposure, generated config, exact package sources, and unsafe future write assumptions.

Each reviewer must return only material findings with exact file/line evidence, impact, and a minimal proposed disposition. A reviewer is evidence, not authority.

- [ ] **Step 4.4 — Validate and disposition findings**

For each finding:

1. reproduce or disprove it against the current tree;
2. record `accepted`, `rejected`, or `deferred`, with concrete evidence;
3. repair only accepted material defects within Task 6;
4. for behavior changes, add a focused failing regression test before the minimum repair;
5. rerun the smallest affected check;
6. make one focused repair commit named for the actual defect;
7. rerun the full relevant suite once only if tested inputs changed.

Do not add a fifth reviewer unless one of the four identifies a material issue requiring a distinct specialist. Do not repeat reviews of unchanged code.

- [ ] **Step 4.5 — Write verification evidence**

The dated implementation-evidence record must include:

- exact comparison and commit list;
- exact changed files;
- RED observations and GREEN command/result summaries;
- generated destination and surface counts by profile;
- deterministic hash evidence for at least one fixed `portfolio` and one fixed `site` request;
- relevant current official-document/advisory evidence from preparation, with retrieval date;
- reviewer findings and dispositions;
- confirmed non-goals and unchanged manifests/lockfile/proof;
- known Node security-pin and public-package availability gates;
- evidence limits: no fresh generated install/lock/build/workerd/deploy, visual, translation, accessibility-conformance, human-usability, security-audit, or production-safety proof.

- [ ] **Step 4.6 — Write the Gate 3 review packet**

The review packet must list:

- base/candidate and remote-refresh disclosure;
- changed files and focused commits;
- requirement-to-evidence mapping;
- exact commands, exit status, and concise results;
- independent reviewer dispositions;
- risks and fragile assumptions;
- deferred Task 7/publication/runtime-pin work;
- source rollback through focused commit reverts;
- statement that no persistent data, provider state, deployment, package publication, or `.egeria` state exists to recover;
- exact requested decision: approve Task 6 or request bounded repair.

- [ ] **Step 4.7 — Commit gate artifacts and stop**

```bash
git add docs/implementation-evidence/2026-08-06-deterministic-skeleton-rendering-verification.md docs/review-packets/2026-08-06-p1-task-6-deterministic-skeleton-rendering.md
git diff --cached --check
git commit -m "Record skeleton rendering verification"
rtk git status --short --branch
```

Verify the implementation worktree is clean and the primary checkout still contains the preserved user-owned root `AGENTS.md` edit. Stop for explicit Gate 3 verified-final-diff approval. Do not begin Task 7.

## Completion criteria

Task 6 is complete only when all of these are true:

- strict renderer tests observed a legitimate RED before implementation and are GREEN;
- exact catalog and template allowlists match the filesystem;
- `portfolio` returns exactly 21 sorted files and 39 valid ownership descriptors;
- `site` returns exactly 23 sorted files and 41 valid ownership descriptors;
- repeated rendering produces byte-identical results;
- manifest/project/resolution/capability ownership agree;
- generated application runtime UI and metadata copy exists only in localized JSON;
- Cloudflare types/bindings remain outside presentation/domain/application code;
- no write/state/CLI/later-capability surface was added;
- the permanent semantic-naming scanner reports no path, content, or test-description finding;
- builder-core verify, package-boundary tests, constitution tests, and diff checks pass on the final coherent tree;
- all material reviewer findings are dispositioned and accepted ones repaired;
- dated verification evidence and the Gate 3 review packet are committed;
- the user's root `AGENTS.md` change remains preserved in the primary checkout and excluded from the implementation branch;
- the implementation stops for explicit user approval before Task 7.
