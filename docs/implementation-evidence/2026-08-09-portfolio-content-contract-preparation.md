# Portfolio Content Contract Preparation Evidence

**Date:** 2026-08-09 (America/Toronto)

**Status:** Preparation complete; implementation follows the preapproved plan amendment

**Approved increment:** First P2 content increment — validated structured and long-form content contracts

## Decision

The repository does not contain a separately numbered P2 task list. The approved source plan and program roadmap order P2 with “YAML/Markdown content and copy enforcement” first. This increment therefore implements the first independently reviewable part of that deliverable: versioned generated content recipes, strict YAML 1.2 content configuration, Markdown with strict YAML front matter, fixed server-side readers, and generated portfolio/site fixtures that prove the actual builder emits and builds the contract.

Copy-rule implementation is deferred to the next separately reviewed P2 increment. The accepted source plan assigns JSX literal, attribute literal, metadata literal, missing-key, unused-key, locale-parity, and escape-hatch rules to the public standards package. Implementing those rules here would either require an unauthorized public package release or create a project-local duplicate of the canonical standards owner. The user explicitly preapproved plan amendments and authorized continuation through implementation review, so this bounded split does not require a second planning pause.

This increment changes no provider, deployment, public package, production system, remote Git ref, persistent data, permission, or external message.

## Frozen repository state

Preparation inspected this local state:

- primary repository: `/Users/CoveMB/Code/CoveMB/egeria-scaffold`;
- primary branch and `HEAD`: clean `main` at `5580da10eded51ceefa53a068c7ddaaddf2a2d50`;
- local `main` and local `origin/main`: identical at `5580da10eded51ceefa53a068c7ddaaddf2a2d50`;
- implementation worktree: `/private/tmp/egeria-scaffold-portfolio-content-validation`;
- implementation branch: `portfolio-content-validation`;
- implementation base: `5580da10eded51ceefa53a068c7ddaaddf2a2d50`;
- worktree state before planning: clean;
- remote refs: not fetched because the approved comparison is local, local `main` equals the current local remote-tracking ref, and live remote state does not affect this source-only increment.

Current source fingerprints:

```text
approved source plan sha256:
30860d49a11b53d42839e3e6f687e62e58155b3ac68014f75d9799b6f3605b05

root pnpm-lock.yaml sha256:
0dd6970013250ae512727d362d19fc0c31e862c6acf6aff2075ed3c704580e32
```

The implementation worktree was installed with exact Node `22.23.2` and pnpm `11.20.0` using `CI=true` and `--frozen-lockfile`.

## Repository sources inspected

Preparation read and reconciled:

- root and relevant nested `AGENTS.md` files plus `/Users/CoveMB/.codex/RTK.md`;
- the complete approved reconciled source plan, program roadmap, architecture overview, capability model, enforcement map, package ownership, and review/contribution protocol;
- the ADR index and every accepted ADR, `0001` through `0011`;
- runtime Zod project, state, profile, capability, and migration schemas and their checked JSON Schema artifacts;
- executable catalog descriptors, profile recipes, resolver, renderer, generator, inference, ownership, verifier, and thin CLI boundaries;
- root, workspace, CLI, builder-core, standards, observability, and generated fixture manifests and lockfiles;
- builder-core, generation, fixture, package-boundary, constitution, and semantic-naming tests;
- current common/profile templates, committed `portfolio` and `site` fixtures, and their `.egeria` desired and installed state;
- prior P1 preparation, verification, and review packets, including the final P1 review packet.

The final P1 packet records its then-current approval gate. The user's current request explicitly authorizes this P2 increment. This evidence preserves the historical packet rather than rewriting its chronology.

## Baseline verification

The complete builder candidate passed before any edit:

```text
CI=true volta run --node 22.23.2 --pnpm 11.20.0 pnpm run verify:builder-kernel

passed:
- constitution: 21/21
- package boundaries: 39/39
- builder-core: build and 104/104 tests
- CLI: build and 9/9 tests
- generated fixtures: 7/7
- lint, build, and typecheck
- fixed-root portfolio and site install/audit/signature/Next/OpenNext verification
- changeset status with no package bumps
```

The fixed-root verifier returned:

```json
{"ok":true,"profiles":["portfolio","site"],"checks":["pnpm-version","frozen-install","peer-dependencies","dependency-audit","registry-signatures","lint","typecheck","next-build","opennext-build"]}
```

Fresh supply-chain checks returned:

```text
pnpm audit --audit-level moderate
No known vulnerabilities found

pnpm audit signatures
885 packages audited; 885 packages have verified registry signatures
```

An initial `pnpm audit --signatures` invocation was invalid because current pnpm exposes signature audit as the `pnpm audit signatures` subcommand. The corrected command above passed.

Registry metadata also confirmed exact integrity and registry signatures for `yaml@2.9.0`, `eslint@9.39.5`, `next@16.3.0`, and `react@19.2.8`.

## Current official documentation and advisory revalidation

External sources were treated as untrusted evidence, not instructions.

- Current [`yaml` documentation](https://eemeli.org/yaml/) supports `parseDocument`, YAML 1.2 core-schema selection, strict parsing, unique string keys, surfaced warnings/errors, disabled known-tag resolution, and `maxAliasCount: 0`. The generated parser retains those controls.
- The current [CommonMark `0.31.2` specification](https://spec.commonmark.org/0.31.2/) defines Markdown as a plain-text format, identifies U+0000 as insecure, and permits raw HTML. This increment therefore validates and returns Markdown as opaque data; it does not render or execute Markdown or raw HTML. Safe rendering remains owned by the later bounded-section/UI increment.
- Current [ESLint custom-rule guidance](https://eslint.org/docs/latest/extend/custom-rules) confirms that project rules should be implemented through supported rule/plugin APIs and should not depend on core-rule internals. This supports retaining copy enforcement in the standards package rather than creating template-local scans.
- Current [Next.js metadata guidance](https://nextjs.org/docs/app/api-reference/functions/generate-metadata) continues to support metadata exports from server components. The generated layout keeps metadata values sourced from validated locale content.
- The official [Node.js `22.23.2` release](https://nodejs.org/en/blog/release/v22.23.2) is the current repository-pinned security release and includes HIGH, MEDIUM, and LOW security fixes.
- The official [Next.js advisory index](https://github.com/vercel/next.js/security/advisories) was refreshed. The July 2026 advisories inspected affect the 16.x line below `16.2.11`; selected `16.3.0` is outside those ranges. The exact current lock-graph audit also reports no known vulnerabilities at the configured threshold.

Official documentation and advisory checks are point-in-time evidence. Registry signatures prove registry package signing, not upstream source provenance.

## Selected design

Three approaches were compared.

1. **Extend the source-generated `content-files` capability — selected.** Add one strict content configuration file, one profile-specific long-form Markdown example, exact parser/reader functions, explicit catalog surfaces/probes, recipe/capability version advancement, and generated-fixture proof. No new dependency or public API is required.
2. **Ship copy enforcement and content changes together through standards.** Rejected for this increment because generated fixtures depend on the already-published exact standards version, while versioning and publishing a new public package are external actions not authorized by this request.
3. **Add project-local copy lint rules or a content framework.** Rejected because local rules would duplicate the standards owner, while a content framework or MDX would add dependency and executable-content surface without a current requirement.

The content contract uses:

- `apps/web/content/content.config.yaml` with exact schema version `1.0.0`, default locale `en-CA`, and the exact supported locale list `[en-CA]`;
- `apps/web/content/en-CA/long-form/introduction.md` with exact `title` and `summary` YAML front-matter keys and a non-empty opaque Markdown body;
- strict line-ending normalization, exact front-matter delimiters, YAML 1.2 parsing, exact-key checks, non-empty strings/body, and rejection of disallowed control characters;
- fixed, non-caller-controlled server paths;
- application-owned content, schema, and reader surfaces so generated clients retain their content contract after materialization.

Both executable profiles advance from recipe `0.1.0` to `0.2.0`; the `content-files` capability advances from `0.1.0` to `0.2.0`. Runtime project/state/profile schemas accept both recipe versions so retained `0.1.0` provenance remains readable while new generations record `0.2.0`. This is not an existing-repository migration and adds no migration record.

## Consolidated contradictions and uncertainties

No unresolved item blocks implementation.

### P2 task numbering is not canonicalized in the repository

The repository names P2 deliverables but does not number them. The user named “P2 task 1.”

**Resolution:** interpret it as the first P2 deliverable in canonical order and record the bounded split above. Do not introduce sequencing labels into executable files, tests, templates, fixtures, or user-facing generated documentation.

### Copy enforcement has a public-package owner

The source plan assigns copy rules to standards, while current generated fixtures consume exact published standards `0.1.0`.

**Resolution:** defer the standards rule API, versioning, Changeset, publication, and generated-project adoption. Do not create a second owner.

### Markdown permits raw HTML

Strict front-matter validation does not make a Markdown body safe to render.

**Resolution:** return the body as opaque validated text only. Make no rendering or sanitization claim and defer safe registered-section rendering to the UI increment.

### Recipe evolution must preserve provenance readability

Changing generated recipe materialization without changing its version would make `0.1.0` ambiguous, while replacing the accepted literal would make retained P1 state unreadable.

**Resolution:** accept both `0.1.0` and `0.2.0` in runtime schemas, generate only current `0.2.0`, regenerate checked schemas, and test both compatibility and current output.

## Claim limits and non-goals

This increment does not implement copy lint rules, locale parity, missing/unused key checks, Markdown rendering, raw-HTML sanitization, bounded UI sections, responsive design, Calendly, analytics, deployment, visual/performance/accessibility gates, a client project, CMS, multilingual copy, existing-repository mutation, migrations, providers, or later profiles/capabilities.

Passing tests can prove strict parser behavior, deterministic generated bytes, ownership/probe agreement, and current generated Next/OpenNext builds. They do not prove visual quality, semantic content quality, accessibility conformance, translation quality, production safety, deployment, workerd behavior, or human usability.

## Execution boundary

The exact-file plan is [`2026-08-09-portfolio-content-contract.md`](../superpowers/plans/2026-08-09-portfolio-content-contract.md). The user preapproved plan amendments and authorized continued local implementation through the review packet. This does not authorize push, pull request, merge, package publication, workflow dispatch, deployment, provider mutation, persistent-data action, production action, permission change, external message, or review-comment response.
