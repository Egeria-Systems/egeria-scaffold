# Standards Copy Externalization Preparation Evidence

**Date:** 2026-08-09 (America/Toronto)

**Status:** Preparation complete; implementation is advance-approved through the implemented-increment review gate

**Increment:** P2 Task 2 — standards-owned copy enforcement

## Approval and frozen repository state

The accepted-baseline reconciliation records the user's approval of the complete P1 comparison and the first P2 content comparison, their local integration, and direct development on clean local `main` for the next sequential builder-repository increment.

Preparation froze:

- repository: `/Users/CoveMB/Code/CoveMB/egeria-scaffold`;
- branch: `main`;
- `HEAD`: `b082a4302bfa2fc8e2f8ad220bb4d551d9d49283`;
- tree: `3977f80e21d469a5ab3fcc7284d62d099389dc18`;
- status: clean, `main...origin/main [ahead 8]`;
- accepted P2 content head: `e0886fb776f5cd80c34a6ab5c28e355cc1abd7b9`;
- local `origin/main`: `5580da10eded51ceefa53a068c7ddaaddf2a2d50`;
- toolchain: Node `v22.23.2`, pnpm `11.20.0`; and
- dependency lock: unchanged from the approved first P2 content comparison.

Remote refs were not fetched. The canonical reconciliation explicitly owns the accepted local baseline, the work is one clean sequential local stream, and remote freshness cannot change the local public-API or lint-rule design. No push, pull request, publication, workflow dispatch, deployment, provider mutation, or external message is authorized.

## Repository authority inspected

Preparation re-read or revalidated the root and standards instructions, approved source plan, architecture overview, capability model, enforcement map, package ownership, program roadmap, review protocol, all accepted ADRs, current manifests and lockfile references, `.egeria` schemas and generated state contracts, current standards APIs/tests, root lint and release safeguards, generated template and fixture lint consumers, recent commits, and the P1 plus first-P2 review/evidence packets.

No accepted ADR or instruction changed between the approved P1 base and this frozen head. The accepted reconciliation identifies the next increment as the standards-owned copy-enforcement task. ADR-0008 and the source plan assign copy checks to `@egeria-systems/standards`; package ownership requires a concrete consumer and forbids speculative APIs.

## Current official documentation and advisory evidence

External sources were treated as untrusted evidence, not instructions.

- [ESLint custom rules](https://eslint.org/docs/latest/extend/custom-rules) requires rule metadata, `messageId`-backed reports, and a JSON Schema for options. It warns against extending core-rule internals. The increment therefore implements a self-contained non-fixing rule with an exact option schema.
- [ESLint plugins](https://eslint.org/docs/latest/extend/plugins) documents inline flat-config plugins, rule maps, plugin metadata, and scoped namespaces. The new factory returns one ordinary flat-config entry with a private inline plugin and one public rule identifier.
- [typescript-eslint dependency versions](https://typescript-eslint.io/users/dependency-versions/) currently supports ESLint `^8.57.0 || ^9.0.0 || ^10.0.0`, Node `^18.18.0 || ^20.9.0 || >=21.1.0`, and TypeScript `>=4.8.4 <6.1.0`. The repository's ESLint `9.39.5`/`10.8.0`, Node `22.23.2`, and TypeScript `6.0.3` remain inside those ranges.
- [typescript-eslint parser documentation](https://typescript-eslint.io/packages/parser/) confirms that the parser produces ESLint-compatible nodes for TypeScript and parses `.tsx` as JSX. The copy config reuses the package's existing parser dependency without type-aware project services.
- [Next.js metadata documentation](https://nextjs.org/docs/app/api-reference/functions/generate-metadata) identifies both static `metadata` exports and `generateMetadata`, including visible `title` and `description` fields and structured title defaults/templates/absolute values. The rule covers those two entry points and visible metadata fields without interpreting unrelated URL, robots, or platform tokens.
- [Node.js `22.23.2`](https://nodejs.org/en/blog/release/v22.23.2) remains the repository-pinned LTS security release. This increment changes no Node pin.
- ESLint and typescript-eslint publish security policies at their official GitHub repositories. Package-specific public advisory searches did not identify a reviewed advisory for the exact direct tool versions. This negative search is supporting evidence, not proof that the dependency graph is vulnerability-free.

A fresh full-lock `pnpm audit` and signature audit could not run in the restricted environment. The sandbox could not resolve the registry, and escalation was rejected because it would transmit workspace dependency metadata. No workaround was attempted. The accepted first-P2 verification ran both checks successfully earlier on 2026-08-09 against the identical lockfile: no known moderate-or-higher vulnerability and 885/885 verified registry signatures. That evidence is current for the unchanged graph but remains point-in-time and was not freshly reproduced in this preparation.

## Baseline verification

The frozen tree passed:

```text
pnpm --filter @egeria-systems/standards test
14/14 passed under the existing dual-major coverage

node --test \
  tests/package-boundaries/public-standards.test.mjs \
  tests/package-boundaries/internal-linting.test.mjs \
  tests/package-boundaries/release-safeguards.test.mjs
15/15 passed

pnpm run test:constitution
21/21 passed

pnpm run check:semantic-naming
passed

pnpm run changeset:status
no packages currently scheduled for a bump

git diff --check
passed
```

## Selected design

Three approaches were compared.

1. **One standards flat-config factory plus a real builder-template consumer — selected.** Add one self-contained rule that rejects static user-visible JSX, relevant attribute, and Next metadata literals; allow only exact configured semantically invariant literals; exercise it under both supported ESLint majors; and make the builder root lint the canonical TSX templates. This creates one owner and one current consumer without changing generated dependency graphs.
2. **Publish and adopt the rule in generated projects in the same increment.** Rejected because package versioning materialization, remote integration, npm publication, and generated adoption are distinct approval and external-action boundaries. The current registry version `0.1.0` cannot expose code added after its immutable publication.
3. **Add a generic localization catalog and missing/unused/parity engine now.** Rejected because the current portfolio has one structurally validated locale and no localization-key lookup contract. A generic key engine would be unconsumed and would guess the later multilingual design.

The public source change receives a minor Changeset for a future `0.2.0` release. This increment does not run `changeset version`, publish, or claim that registry `0.1.0` contains the new API. The canonical templates become a concrete local consumer through the builder root's ESLint configuration and zero-warning aggregate. Generated repositories continue using published standards `0.1.0` until a separately approved release and adoption increment.

## Exact behavior boundary

The standards package adds:

```js
createCopyExternalizationConfig({
  files?: readonly string[];
  invariantLiterals?: readonly string[];
})
```

The returned flat config parses TypeScript/TSX without project services and enables `@egeria-systems/copy/externalize-visible-copy`. The rule rejects:

- non-whitespace JSX text;
- static string and template-literal text rendered through JSX child expressions, including conditional, logical, binary, sequence, and array compositions;
- static text in `aria-label`, `title`, `placeholder`, and `alt` JSX attributes; and
- static visible fields in exported `metadata` objects and objects returned from a named `generateMetadata` function, including structured title values and nested `title`, `description`, `applicationName`, `creator`, `publisher`, and `alt` fields.

It does not inspect logs, stable identifiers, tests, content files, dynamic values, arbitrary call arguments, URL/robots tokens, or application data flow. It provides no autofix because selecting content keys requires human intent. `invariantLiterals` is an exact, non-empty, unique string allowlist configured centrally; it is not an inline or wildcard bypass.

## Consolidated contradictions and uncertainties

No unresolved item blocks implementation.

### Public source versus published package

The public source package must own the new API, but published `0.1.0` is immutable.

**Resolution:** keep manifests at `0.1.0`, add one minor Changeset, update exact source/tarball contracts, and state explicitly that publication and generated adoption remain separate.

### Copy enforcement versus locale-key validation

The source plan lists JSX/attribute/metadata checks together with missing/unused keys and locale parity, but the current generated application has no localization-key catalog and only one locale.

**Resolution:** implement only the currently consumable literal-source checks. Retain missing/unused-key and locale-parity gates as planned until a concrete key-resolution or multilingual contract exists.

### Static enforcement cannot prove all rendered copy

AST checks cannot establish runtime data flow or semantic content quality.

**Resolution:** describe the gate as literal-source enforcement only. Generated parser/schema tests continue to own content shape, and later component/browser/locale gates own rendered behavior and parity.

## Claim limits and non-goals

This increment does not publish or materialize a package version; modify generated project manifests, lockfiles, templates, fixtures, `.egeria` state, or providers; add translation keys, missing/unused-key validation, locale parity, Markdown rendering, bounded sections, UI design, Calendly, observability runtime, CI/deployment, or accessibility automation; or claim production readiness, accessibility conformance, translation quality, or complete copy externalization.

The exact-file execution plan is [Standards Copy Externalization Implementation Plan](../superpowers/plans/2026-08-09-standards-copy-externalization.md).
