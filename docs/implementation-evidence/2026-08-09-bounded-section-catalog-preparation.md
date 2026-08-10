# Bounded Section Catalog Preparation Evidence

**Date:** 2026-08-09 (America/Toronto)

**Status:** Preparation complete; design and exact-file plan are advance-approved through the implemented-task review gate

**Increment:** P2 Task 3 — bounded section catalog

## Approval and frozen repository state

The user identified the next approved increment as P2 Task 3, preapproved plan amendments, and authorized continuation through review of the implemented task. That approval covers bounded local source, tests, generated fixtures, documentation, commits, and verification. It does not authorize push, pull request, merge, publication, deployment, workflow dispatch, provider mutation, production action, permission change, external message, or response to review comments.

Preparation froze:

- repository: `/Users/CoveMB/Code/CoveMB/egeria-scaffold`;
- branch: `main`;
- `HEAD`: `83fe0e667a62701de881497d9293fc2355ef7654`;
- tree: `2faf92d1e3bf0e28338ca2445106f5a80913954f`;
- status: clean, `main...origin/main [ahead 16]`;
- local `origin/main`: `5580da10eded51ceefa53a068c7ddaaddf2a2d50`;
- toolchain: Node `22.23.2`, pnpm `11.20.0`; and
- lockfile: unchanged during preparation.

Remote refs were not fetched. This is one clean sequential local builder-repository stream, the user named its next accepted increment, and remote freshness cannot alter the local accepted architecture or exact generated-section contract. Builder commands that change an existing generated repository remain outside this increment and would still require an isolated worktree.

## Repository authority inspected

Preparation re-read or revalidated the root, CLI, builder-core, standards, and generated-project instructions; the complete approved source plan; architecture overview, capability model, enforcement map, package ownership, program roadmap, and review protocol; every accepted ADR `0001` through `0011`; all current runtime `.egeria` contracts and checked JSON Schema artifacts; root, workspace, CLI, builder-core, standards, observability, and generated-project manifests; current templates, readers, content parsers, routes, presentation components, capability catalog, profile recipes, generator, fixture verifier, tests, recent commits, and the P1 plus prior P2 preparation, verification, and review packets.

The source plan places the bounded section catalog immediately after the combined content/copy outcomes. The accepted current tree contains both preceding outcomes: strict generated YAML/Markdown content and standards-owned literal-copy enforcement. The next capability owner already exists as source-generated `section-composition@0.1.0`, with `content-files` as its declared dependency and two application-owned route/presentation surfaces.

No canonical contradiction blocks implementation. The roadmap names the required registry fields but intentionally does not prescribe the first catalog's concrete section types or field shapes. The selected types below are the smallest useful first-client set that materializes every required registry field without introducing later visual, booking, analytics, or CMS behavior.

## Current official documentation and advisory evidence

External sources were treated as untrusted evidence, not instructions.

- [React list rendering](https://react.dev/learn/rendering-lists) requires stable data-derived keys. Section instance identifiers are therefore validated, unique, content-owned keys; array indexes and render-time generated keys are not used.
- [TypeScript narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html) documents discriminated unions and exhaustive `never` checking. The four section shapes use the stable `type` discriminator and an exhaustive rendering switch.
- [Next.js App Router](https://nextjs.org/docs/app) and [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) keep pages and layouts as Server Components by default. The registry adds no client boundary because its components need no state, effects, browser API, or event handler.
- The [YAML package documentation](https://eemeli.org/yaml/) confirms the current `parseDocument` error/warning model and alias limit used by the existing strict YAML 1.2 parser. The section contract reuses that canonical parser and adds no parser dependency.
- The [WHATWG URL standard](https://url.spec.whatwg.org/) distinguishes URL parsing and schemes. Rendered links accept only reviewed relative/hash destinations, HTTPS, and non-empty `mailto:` destinations; protocol-relative, credential-bearing, executable, data, and unknown schemes are rejected before rendering.
- Current official release records identify [React `19.2.8`](https://github.com/facebook/react/releases/tag/v19.2.8), [TypeScript `6.0.3`](https://github.com/microsoft/TypeScript/releases/tag/v6.0.3), and the repository-pinned [Node `22.23.2`](https://nodejs.org/en/blog/release/v22.23.2). This increment changes none of those versions.
- Current reviewed Next.js advisories include fixes at `16.2.5` for middleware/proxy issues and `16.2.11` for the July 2026 cache-confusion issue. The exact generated version `16.3.0` is outside those published affected ranges. This range comparison is point-in-time advisory evidence, not a guarantee against unknown vulnerabilities.

A fresh exact-lock `pnpm audit --audit-level=moderate` completed successfully on 2026-08-09 and reported `No known vulnerabilities found`. No dependency or provider is added by the selected design. The audit and advisory searches are point-in-time evidence and do not establish that the application or dependency graph is vulnerability-free.

## Baseline verification

The clean frozen tree passed:

```text
pnpm install --offline --frozen-lockfile
already up to date

pnpm run test:builder-core
104/104 passed

pnpm run test:generated-fixtures
7/7 passed; production generation matched 27-byte portfolio and 29-byte site fixtures

pnpm run check:copy-externalization
passed

pnpm run check:semantic-naming
passed

pnpm audit --audit-level=moderate
no known vulnerabilities

git diff --check
passed
```

The first restricted `test:generated-fixtures` attempt reported the verifier's sanitized `LOCKFILE_PREPARATION_FAILED` with reason `source-changed`. A manual identity-bounded temporary reproduction exposed the underlying `ENOTFOUND registry.npmjs.org`; the verifier intentionally maps installation failure and byte drift to the same content-free issue. The unchanged command passed 7/7 with public-registry access in 202 seconds. No source repair was made because the failure was an environment boundary, not a repository defect.

## Selected design

Three approaches were compared.

1. **One source-owned discriminated registry with four cohesive section types — selected.** Keep raw validation in the existing `content-files` parser, let `section-composition` consume its typed section union, and place metadata plus pure presentation components in one generated registry. This preserves the declared dependency direction and makes every required registry field executable without a framework.
2. **A generic schema-driven component/plugin engine.** Rejected because dynamic registration, generic component factories, nested configuration, or plugin loading would increase the executable surface and undermine the approved bounded-content rule before a second registry consumer exists.
3. **A visual page builder or client-editable MDX.** Rejected because arbitrary component trees, imports, JSX, JavaScript, CSS, and executable Markdown are expressly outside the architecture. It would also prematurely implement CMS and responsive-design concerns.

The first registry contains exactly:

- `hero`: one page-level heading and summary;
- `text`: one section heading and plain paragraph;
- `project-list`: one section heading and at least one titled project summary with a reviewed link; and
- `call-to-action`: one section heading, summary, and reviewed labeled link.

Each registered type has the sole approved variant `default`, supports `portfolio` and `site`, declares accessibility requirements, has an empty analytics declaration list, and has an empty migration-hook list at content schema `1.0.0`. Empty declarations are explicit current facts, not placeholder runtime systems.

Every page content object contains an ordered `sections` array. Every section requires exact `id`, `type`, `variant`, `enabled`, and `content` keys. Instance identifiers are stable semantic kebab-case values and unique even for disabled entries. Disabled entries remain fully validated. Each page requires exactly one enabled hero so the pure renderer emits one page-level heading. Unknown types, variants, keys, fields, unsafe links, duplicate identifiers, malformed content, and arbitrary nested values fail closed with the existing content-free `TypeError("CONTENT_INVALID")`.

## Capability, recipe, and generated-state boundary

`section-composition` advances from `0.1.0` to `0.2.0` and adds one application-owned source surface and inference probe:

```text
section-composition-registry
apps/web/src/sections/section-registry.tsx
```

Current `portfolio` and `site` recipes advance from `0.2.0` to `0.3.0`. Runtime project, profile, and state contracts continue accepting retained `0.1.0` and `0.2.0` provenance and add current `0.3.0`; they reject other versions. Existing capability identifiers, package versions, dependency graphs, platform resources, environment variables, secrets, analytics, and provider behavior remain unchanged.

The in-memory renderer is expected to emit 24 files for `portfolio` and 26 for `site`. Ownership descriptors advance to 43/45; generated managed-surface counts to 46/48; delivered committed fixture files to 28/30. The single new source file plus changed YAML, parser, route, presentation, guidance, recipe, state, and fingerprint bytes are the only expected generated changes. Any other path change requires a recorded plan amendment before fixture replacement.

## Consolidated contradictions and uncertainties

No unresolved item blocks implementation.

### Registry schema ownership versus capability dependency

The source plan says each registry entry has a content schema, while the existing catalog says `section-composition` depends on `content-files`.

**Resolution:** the canonical raw parsers and discriminated types remain in `content-schema.ts`; the exported registry entry references its corresponding parser as its `contentSchema`. The registry therefore owns the complete executable association while dependency direction remains `section-composition -> content-files`, not a cycle.

### Accessibility metadata versus the later accessible-UI increment

Every registry entry must declare accessibility requirements, but responsive accessible UI and automated accessibility gates are later work.

**Resolution:** encode semantic requirements that the current pure markup implements and test: one page-level heading, section-level headings, list semantics, and descriptive labeled links. Do not add styling, browser automation, axe, reflow, motion, or conformance claims in this increment.

### Link flexibility versus executable content injection

Portfolio sections need useful internal, external, and email links, while content must not create executable behavior.

**Resolution:** validate an explicit scheme boundary and render ordinary anchors only. Do not accept scripts, event handlers, target behavior, raw HTML, component names, CSS, or caller-defined attributes.

## Claim limits and non-goals

This increment does not add responsive or visual styling, image/media behavior, Markdown rendering, Calendly, analytics, production observability, CI/deployment, browser or visual tests, automated accessibility tooling, a WCAG conformance claim, a retained client project, existing-repository transformations, migration execution, package publication, new capabilities/profiles, providers, databases, queues, email, identity, payments, `apps/jobs`, or invented CRUD.

The accepted design is [Bounded Section Catalog Design](../superpowers/specs/2026-08-09-bounded-section-catalog-design.md). The exact-file execution plan is [Bounded Section Catalog Implementation Plan](../superpowers/plans/2026-08-09-bounded-section-catalog.md).
