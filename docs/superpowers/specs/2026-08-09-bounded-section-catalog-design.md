# Bounded Section Catalog Design

**Status:** Advance-approved for implementation through the implemented-task review gate

**Date:** 2026-08-09

## Goal

Make the actual builder generate a source-owned, typed, bounded section registry for portfolio and site pages. Validated YAML may select, configure, order, add, disable, or remove registered section instances, but it cannot supply executable code or arbitrary component trees.

## Boundary

This design materializes only the bounded section catalog. It consumes the already approved YAML/content and copy-externalization contracts. It does not implement the next responsive accessible UI increment, booking, analytics, deployment, browser checks, accessibility automation, or the retained real client project.

The generated code remains a cohesive application under `apps/web`; no package or dependency is added. Pages and section components remain Server Components because they use no state, effects, callbacks, or browser APIs.

## Data model

`apps/web/src/content/content-schema.ts` owns the raw YAML validation and exports the discriminated union consumed by the section capability:

```ts
type SectionBase<Type extends string, Content> = Readonly<{
  id: string;
  type: Type;
  variant: "default";
  enabled: boolean;
  content: Content;
}>;

export type PageSection =
  | SectionBase<"hero", Readonly<{ heading: string; summary: string }>>
  | SectionBase<"text", Readonly<{ heading: string; body: string }>>
  | SectionBase<
      "project-list",
      Readonly<{
        heading: string;
        projects: readonly Readonly<{
          title: string;
          summary: string;
          href: string;
        }>[];
      }>
    >
  | SectionBase<
      "call-to-action",
      Readonly<{
        heading: string;
        summary: string;
        label: string;
        href: string;
      }>
    >;

export type PageContent = Readonly<{
  sections: readonly PageSection[];
}>;
```

The actual implementation uses explicit named content and section types where that improves compiler errors. `parsePageContent` accepts exactly one `sections` key and an ordered non-empty array. Each entry has exactly `id`, `type`, `variant`, `enabled`, and `content`. Type-specific content parsers require exact keys and non-empty control-safe strings. Project lists require at least one entry. Instance identifiers use the existing semantic kebab-case grammar and must be unique across enabled and disabled entries.

Exactly one enabled `hero` is required per page. This is the smallest structural invariant that gives every generated page one page-level heading. Other section types may occur zero or more times, and all section instances may be reordered, added, disabled, or removed while the page retains one enabled hero.

The parser exposes a frozen `sectionContentSchemas` association so each registry entry points to the parser for its own content type. Every invalid input throws the existing source-free `TypeError("CONTENT_INVALID")`.

## Link boundary

Navigation, project, and call-to-action links share one pure safe-destination predicate. It accepts:

- root-relative paths beginning with one `/`;
- non-empty document fragments beginning with `#`;
- absolute `https:` URLs without embedded credentials; and
- non-empty `mailto:` URLs.

It rejects protocol-relative URLs, empty fragments, credentials, `http:`, `javascript:`, `data:`, `file:`, unknown schemes, malformed URLs, whitespace-only values, and forbidden control characters. Rendering adds no caller-defined attributes or event behavior.

## Source-owned registry

`apps/web/src/sections/section-registry.tsx` exports `sectionRegistry` with one entry per exact type. Each entry owns:

```ts
{
  type: "hero" | "text" | "project-list" | "call-to-action";
  contentSchemaVersion: "1.0.0";
  contentSchema: sectionContentSchemas[<type>];
  approvedVariants: readonly ["default"];
  Component: <pure typed presentation component>;
  supportedProfiles: readonly ["portfolio", "site"];
  accessibilityRequirements: readonly string[];
  analyticsDeclarations: readonly [];
  migrationHooks: readonly [];
}
```

Accessibility requirement identifiers are developer-facing metadata, not user-visible claims. They describe semantics implemented by the current components: page-level heading, section-level heading, list structure, and descriptive labeled links.

The exported `SectionComposition` filters disabled instances while preserving source order, uses `section.id` as its React key and DOM section identifier, narrows exhaustively on `section.type`, and delegates to the registry's matching pure component. Exhaustive checking makes a newly parsed type fail compilation until it has a registered presentation path.

## Presentation structure

- `HeroSection` renders a source-owned header with one `h1` plus summary.
- `TextSection` renders a labelled `section` with `h2` plus paragraph.
- `ProjectListSection` renders a labelled `section`, `h2`, list, project articles, `h3`, summaries, and content-backed links.
- `CallToActionSection` renders a labelled `section`, `h2`, summary, and content-backed anchor.

`ContentPage` remains a pure page shell: navigation followed by `SectionComposition`. Both home and site about routes pass typed `PageContent.sections`; route files contain no user-visible literals.

This semantic markup is unit- and build-tested, but it is not a substitute for the later responsive design, browser accessibility automation, or human evaluation.

## YAML materialization

Portfolio `site.yaml` demonstrates all four registered types using fictional, externalized content. Site home and about files use valid subsets of the same registry. The format is:

```yaml
home:
  sections:
    - id: introduction
      type: hero
      variant: default
      enabled: true
      content:
        heading: "..."
        summary: "..."
```

No YAML field identifies a component, module, import, element name, style, class, callback, script, or arbitrary child tree.

## State and compatibility

The current `section-composition` descriptor advances to `0.2.0`, adding only `apps/web/src/sections/section-registry.tsx` as an application-owned full-file surface and probe. Current recipes advance to `0.3.0`. Runtime project/profile/state contracts retain readable `0.1.0` and `0.2.0` provenance and accept current `0.3.0`.

The generated state is updated only by the existing successful new-directory pipeline after rendering, isolated verification, and post-change inference. No existing-repository migration hook executes in this increment; each registry entry explicitly declares no migrations for schema `1.0.0`.

## Verification strategy

TDD starts with contract, parser, registry, rendering, copy, ownership, and fixture expectations against the unchanged source. Focused RED must fail because version `0.3.0`, the new source, discriminated parser behavior, or registry behavior is absent.

GREEN includes:

- pure parser tests for valid and invalid section shapes, ordering, disabling, unique IDs, one enabled hero, and link schemes;
- executable registry tests using transpiled generated TypeScript/TSX and a deterministic test JSX runtime;
- exact template/capability/recipe/schema/ownership tests;
- copy-literal enforcement over `src/sections/**/*.tsx`;
- production portfolio/site generation twice with byte equality;
- committed fixture inventory, inference, state, lint, typecheck, Next build, and OpenNext build; and
- final `verify:builder-kernel` on the reviewed tree.

Static and build evidence does not establish visual quality, responsive behavior, deployed behavior, accessibility conformance, content quality, or production readiness.

## Recovery

Rollback is source-only: revert focused commits newest-first, regenerate fixtures from the restored production CLI, and rerun the builder-kernel verifier. No dependency, provider, deployment, persistent-data, or external-state rollback exists for this increment.
