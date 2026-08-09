# Standards Copy Externalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task by task, `superpowers:test-driven-development` for every behavior change, `superpowers:systematic-debugging` for unexpected failures, `superpowers:requesting-code-review` for the mandatory reviews, and `superpowers:verification-before-completion` before any completion claim. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public standards-owned flat ESLint config that rejects static user-visible copy in canonical generated-application TSX and make the builder templates a real local consumer without publishing or changing generated dependency graphs.

**Architecture:** `@egeria-systems/standards` owns one self-contained custom rule and one config factory using its existing TypeScript parser dependency. The builder root composes that factory only for canonical generated TSX templates and includes the check in its zero-warning lint aggregate. A minor Changeset records the future public release while current manifests remain at immutable published `0.1.0`.

**Tech Stack:** Node.js `22.23.2`, pnpm `11.20.0`, ESLint `9.39.5` and `10.8.0`, typescript-eslint `8.66.0`, TypeScript `6.0.3`, Node test runner, Changesets `2.31.1`.

## Global Constraints

- Work directly on clean local `main` at approved base `b082a4302bfa2fc8e2f8ad220bb4d551d9d49283`; stop if the stream becomes dirty from unrelated work or ceases to be sequential.
- Use exact Node `22.23.2` and pnpm `11.20.0` for every repository pnpm command.
- Preserve the existing public standards package and its ordinary replaceable-dependency boundary; add no runtime application package or new dependency.
- Keep `packages/standards/package.json` at published `0.1.0`; add a minor Changeset but do not run `changeset version` or publish.
- Do not modify generated templates, fixtures, their manifests/lockfiles, `.egeria` state, the proof, or provider/workflow configuration.
- Keep missing/unused locale-key and locale-parity validation deferred until a concrete localization-key or multilingual consumer exists.
- Do not add autofixes, wildcard/regex escape hatches, inline bypass syntax, data-flow analysis, a generic validation framework, or a second copy-policy owner.
- Static passing evidence proves only the specified literal-source boundary, not complete rendered-copy behavior, translation quality, visual quality, accessibility, or production readiness.
- Before each commit, inspect the exact staged set and run `git diff --cached --check`.

---

## Exact File Structure

Create:

```text
.changeset/externalize-visible-copy.md
packages/standards/eslint/copy-externalization.mjs
packages/standards/tests/copy-externalization.test.mjs
docs/implementation-evidence/2026-08-09-standards-copy-externalization-preparation.md
docs/implementation-evidence/2026-08-09-standards-copy-externalization-verification.md
docs/review-packets/2026-08-09-standards-copy-externalization.md
docs/superpowers/plans/2026-08-09-standards-copy-externalization.md
```

Modify the public standards API and direct contracts:

```text
packages/standards/package.json
packages/standards/README.md
packages/standards/AGENTS.md
tests/package-boundaries/public-standards.test.mjs
tests/package-boundaries/release-safeguards.test.mjs
```

Modify the concrete builder-template consumer and canonical owners:

```text
package.json
eslint.config.mjs
tests/package-boundaries/internal-linting.test.mjs
docs/architecture/enforcement-map.md
docs/architecture/package-ownership.md
```

No other path is in scope. In particular, `pnpm-lock.yaml`, `packages/standards/CHANGELOG.md`, builder templates, generated fixtures, `.egeria` state, workflows, and proof files must remain unchanged.

## Public Interface

`packages/standards/eslint/copy-externalization.mjs` exports exactly:

```js
export function createCopyExternalizationConfig({
  files = ["app/**/*.{ts,tsx}", "src/**/*.{ts,tsx}"],
  invariantLiterals = [],
} = {})
```

The factory returns one flat config object with:

```js
{
  name: "@egeria-systems/standards/copy-externalization",
  files,
  languageOptions: {
    parser: typescriptEslint.parser,
    ecmaVersion: "latest",
    sourceType: "module",
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
  plugins: {
    "@egeria-systems/copy": copyExternalizationPlugin,
  },
  rules: {
    "@egeria-systems/copy/externalize-visible-copy": [
      "error",
      { invariantLiterals },
    ],
  },
}
```

The factory requires a non-empty array of non-empty file patterns and an array of unique, non-empty invariant strings. Invalid factory input throws `TypeError("COPY_EXTERNALIZATION_CONFIG_INVALID")` without echoing values.

The non-fixing rule reports only these stable messages:

```text
Move user-visible JSX text to validated content or localization.
Move this user-visible attribute value to validated content or localization.
Move this user-visible metadata value to validated content or localization.
```

It inspects exact static contexts described in the preparation evidence. It never includes literal source text in a diagnostic.

## Task 1: Commit Preparation Evidence and Exact Plan

**Files:**

- Create: `docs/implementation-evidence/2026-08-09-standards-copy-externalization-preparation.md`
- Create: `docs/superpowers/plans/2026-08-09-standards-copy-externalization.md`

- [x] **Step 1: Validate planning artifacts**

Run:

```bash
rg -n 'T[B]D|T[O]DO|implement lat[e]r|fill i[n]' \
  docs/implementation-evidence/2026-08-09-standards-copy-externalization-preparation.md \
  docs/superpowers/plans/2026-08-09-standards-copy-externalization.md
pnpm run test:constitution
pnpm run check:semantic-naming
git diff --check
```

Expected: no placeholder matches; constitution passes 21/21; semantic naming and diff checks pass.

- [x] **Step 2: Commit exactly the planning artifacts**

```bash
git add \
  docs/implementation-evidence/2026-08-09-standards-copy-externalization-preparation.md \
  docs/superpowers/plans/2026-08-09-standards-copy-externalization.md
git diff --cached --check
git commit -m "Plan standards copy externalization"
```

Expected: one documentation-only commit containing exactly the two files.

## Task 2: RED — Specify the Public Copy Rule API

**Files:**

- Create: `packages/standards/tests/copy-externalization.test.mjs`
- Modify: `tests/package-boundaries/public-standards.test.mjs`
- Modify: `tests/package-boundaries/release-safeguards.test.mjs`

**Consumes:** Existing dual-major `Linter` pattern from `cloudflare-isolation.test.mjs`; current exact public manifest/tarball and Changesets lifecycle contracts.

**Produces:** Failing behavioral contracts for `createCopyExternalizationConfig`, rule identifier `@egeria-systems/copy/externalize-visible-copy`, the new public export, the packaged source file, and one pending standards minor Changeset.

- [ ] **Step 1: Write factory validation and valid-source tests**

Add tests that import the new public file and prove:

```js
assert.throws(
  () => createCopyExternalizationConfig({ files: [] }),
  { name: "TypeError", message: "COPY_EXTERNALIZATION_CONFIG_INVALID" },
);

assert.throws(
  () =>
    createCopyExternalizationConfig({
      invariantLiterals: ["same", "same"],
    }),
  { name: "TypeError", message: "COPY_EXTERNALIZATION_CONFIG_INVALID" },
);
```

For both ESLint `9.39.5` and `10.8.0`, verify zero messages for dynamic JSX text, dynamic relevant attributes, content-backed static metadata, logs, internal errors, stable identifiers, URL fields, and ordinary TypeScript syntax.

- [ ] **Step 2: Write literal-source rejection tests**

For both ESLint majors, use real `Linter.verify` calls and literal expected diagnostics to cover:

```tsx
export const metadata = {
  title: "Literal title",
  openGraph: { description: "Literal description" },
};

export function Example({ label }: { label: string }) {
  return (
    <button aria-label="Literal label" title={"Literal title"}>
      Literal child
      {true ? `Literal ${label}` : label}
    </button>
  );
}
```

Add a named `generateMetadata` return-object case, all four relevant JSX attributes, whitespace-only JSX, a static title template object, exact invariant acceptance, and a near-match invariant rejection. Assert stable rule ID, severity, message, and no source excerpt in diagnostic messages.

- [ ] **Step 3: Specify public manifest, tarball, and pending Changeset contracts**

Require this exact export:

```json
"./eslint/copy-externalization": "./eslint/copy-externalization.mjs"
```

Require `eslint/copy-externalization.mjs` in the standards dry-run tarball. Replace the historical no-pending-changeset assertion with exactly one pending file named `.changeset/externalize-visible-copy.md` whose front matter schedules only `@egeria-systems/standards` for a minor bump and whose body describes the copy-externalization config. Keep both materialized manifests and changelogs at published `0.1.0`.

- [ ] **Step 4: Run RED and confirm causality**

Run:

```bash
node --test packages/standards/tests/copy-externalization.test.mjs
node --test \
  tests/package-boundaries/public-standards.test.mjs \
  tests/package-boundaries/release-safeguards.test.mjs
```

Expected: failures are caused by the missing public file/export/package bytes/Changeset, not loader, syntax, dependency, or existing-contract errors.

## Task 3: GREEN — Implement and Package the Public Rule

**Files:**

- Create: `.changeset/externalize-visible-copy.md`
- Create: `packages/standards/eslint/copy-externalization.mjs`
- Modify: `packages/standards/package.json`
- Modify: `packages/standards/README.md`
- Modify: `packages/standards/AGENTS.md`

**Consumes:** `typescriptEslint.parser` from existing `typescript-eslint@8.66.0`; ESLint's documented flat plugin/rule API.

**Produces:** `createCopyExternalizationConfig` and an unpublished minor release record. No package version or dependency changes.

- [ ] **Step 1: Implement validated factory input**

Implement pure helpers that accept only:

```js
Array.isArray(files) &&
files.length > 0 &&
files.every((file) => typeof file === "string" && file.length > 0)
```

and unique non-empty strings for `invariantLiterals`. Copy accepted arrays before placing them in the returned config so caller mutation cannot change the config.

- [ ] **Step 2: Implement static-text extraction and AST boundaries**

Implement small focused helpers for:

- unwrapping TypeScript assertion/non-null/chain wrappers;
- extracting meaningful static strings from literals and template literal quasis;
- recursively checking conditional, logical, binary, sequence, and array expressions without traversing call arguments or identifiers;
- recognizing the four exact JSX attribute names;
- recognizing static `metadata` declarations and named `generateMetadata` return objects; and
- walking object properties only for nested metadata containers and exact visible metadata keys.

Report each offending visible source node once. Ignore whitespace-only strings and exact `invariantLiterals`.

- [ ] **Step 3: Export the config and document the boundary**

Add the exact manifest export, update the package README with the factory signature, checked contexts, exact invariant option, non-fixing behavior, and unpublished-source limitation, and update nested instructions to include the new current source API while retaining publication and later-key-validation boundaries.

Create this Changeset:

```markdown
---
"@egeria-systems/standards": minor
---

Add a flat ESLint config that rejects static user-visible JSX, relevant attribute, and Next.js metadata copy outside validated content or localization sources.
```

- [ ] **Step 4: Run focused GREEN and package checks**

Run:

```bash
node --test packages/standards/tests/copy-externalization.test.mjs
node --test \
  tests/package-boundaries/public-standards.test.mjs \
  tests/package-boundaries/release-safeguards.test.mjs
pnpm --filter @egeria-systems/standards run lint
pnpm --filter @egeria-systems/standards test
pnpm run changeset:status
git diff --check
```

Expected: all focused/package tests pass; standards lint has zero warnings; Changesets reports only a future minor standards bump; manifests remain `0.1.0`; no lockfile change.

- [ ] **Step 5: Commit the public source increment**

```bash
git add \
  .changeset/externalize-visible-copy.md \
  packages/standards/AGENTS.md \
  packages/standards/README.md \
  packages/standards/eslint/copy-externalization.mjs \
  packages/standards/package.json \
  packages/standards/tests/copy-externalization.test.mjs \
  tests/package-boundaries/public-standards.test.mjs \
  tests/package-boundaries/release-safeguards.test.mjs
git diff --cached --check
git commit -m "Add copy externalization lint rules"
```

Expected: exact eight-file public API/test/release commit with no version materialization or publication.

## Task 4: RED/GREEN — Make Builder Templates a Concrete Consumer

**Files:**

- Modify: `tests/package-boundaries/internal-linting.test.mjs`
- Modify: `package.json`
- Modify: `eslint.config.mjs`
- Modify: `docs/architecture/enforcement-map.md`
- Modify: `docs/architecture/package-ownership.md`

**Consumes:** `createCopyExternalizationConfig` from Task 3.

**Produces:** Root `check:copy-externalization`, canonical template coverage, aggregate lint integration, and accurate canonical ownership/status.

- [ ] **Step 1: Write the failing root-consumer tests**

Require root script:

```json
"check:copy-externalization": "eslint \"packages/builder-core/templates/**/app/**/*.tsx\" \"packages/builder-core/templates/**/src/presentation/**/*.tsx\" --max-warnings 0"
```

Require `lint:builder` to run the existing four-package lint followed by `pnpm run check:copy-externalization`. Instantiate ESLint with the root config and assert:

- all canonical app and presentation TSX templates return zero messages; and
- linting `export default function Page(){return <main>Literal</main>}` at a matching canonical template path returns one exact copy-rule error.

Update the public-API consumer contract to identify the root config/script as the concrete current consumer.

- [ ] **Step 2: Run the consumer RED**

Run:

```bash
node --test --test-name-pattern='copy externalization|builder root owns an exact ESLint' \
  tests/package-boundaries/internal-linting.test.mjs \
  tests/package-boundaries/public-standards.test.mjs \
  tests/package-boundaries/release-safeguards.test.mjs
```

Expected: failures identify the absent root import/config/script and unchanged lint aggregate.

- [ ] **Step 3: Compose the root config and aggregate**

Import `createCopyExternalizationConfig` in `eslint.config.mjs`. Remove only the blanket template global ignore and add one config instance for:

```js
[
  "packages/builder-core/templates/**/app/**/*.tsx",
  "packages/builder-core/templates/**/src/presentation/**/*.tsx",
]
```

Use no invariant literals initially. Add the exact root script and append it once to `lint:builder`. Do not change any template byte.

- [ ] **Step 4: Update canonical ownership without overstating adoption**

Update package ownership to distinguish:

- published `@egeria-systems/standards@0.1.0` APIs;
- the reviewed-but-unpublished source API plus pending minor Changeset; and
- later generated-project adoption after separately approved publication.

Update the enforcement map so `INV-COPY-EXTERNALIZATION` is actual for canonical builder TSX template literal-source checks under both supported ESLint majors while generated repository adoption, locale-key validation, parity, runtime copy resolution, and semantic quality remain planned.

- [ ] **Step 5: Run consumer GREEN and affected suites**

Run:

```bash
pnpm run check:copy-externalization
node --test \
  tests/package-boundaries/internal-linting.test.mjs \
  tests/package-boundaries/public-standards.test.mjs \
  tests/package-boundaries/release-safeguards.test.mjs
pnpm run test:package-boundaries
pnpm run lint:builder
pnpm run check:semantic-naming
git diff --check
```

Expected: canonical templates pass with zero warnings; mutation input produces the exact rule error in its test; all affected suites pass; no template, fixture, manifest version, dependency, or lockfile changes.

- [ ] **Step 6: Commit the consumer increment**

```bash
git add \
  package.json \
  eslint.config.mjs \
  tests/package-boundaries/internal-linting.test.mjs \
  tests/package-boundaries/public-standards.test.mjs \
  tests/package-boundaries/release-safeguards.test.mjs \
  docs/architecture/enforcement-map.md \
  docs/architecture/package-ownership.md
git diff --cached --check
git commit -m "Enforce externalized copy in builder templates"
```

Expected: exact consumer/canonical-owner commit; if public-standard or release tests did not require a second change after Task 3, omit those unchanged paths from staging and record the narrower set.

## Task 5: Independent Reviews and Evidence-Backed Repair

- [ ] **Step 1: Freeze the exact review comparison**

Record the planning commit's parent as base, current `HEAD`, `git diff --name-status`, and `git diff --check`. Confirm every changed path appears in the exact file structure above.

- [ ] **Step 2: Dispatch three non-overlapping read-only reviewers**

Dispatch:

- requirements reviewer: approved source, Task 2 boundary, exact plan, public/unpublished distinction, non-goals, and file scope;
- architecture and anti-overengineering reviewer: package ownership, AST precision, parser/config boundaries, escape safety, canonical ownership, deferrals, and unnecessary machinery; and
- test-evidence reviewer: RED causality, dual-major execution, realistic mutations, current template consumer, packaging/Changeset lifecycle, command relevance, and claim limits.

Each packet must include exact base/head SHAs and prohibit edits, recursive delegation, GitHub comments, external actions, and scope expansion.

- [ ] **Step 3: Validate and repair only material findings**

For each material current defect, add a focused causal test before changing production code, run RED, make the minimum repair, run affected GREEN, and request only the relevant review closure. Classify invalid, duplicate, deferred-by-scope, and low-value churn findings explicitly. Commit each coherent repair with a short semantic message.

## Task 6: Final Verification, Evidence, and Review Packet

**Files:**

- Create: `docs/implementation-evidence/2026-08-09-standards-copy-externalization-verification.md`
- Create: `docs/review-packets/2026-08-09-standards-copy-externalization.md`
- Modify: `docs/superpowers/plans/2026-08-09-standards-copy-externalization.md`

- [ ] **Step 1: Run the full relevant deterministic suite once on settled inputs**

Run with exact toolchain:

```bash
pnpm run verify:builder-kernel
pnpm run verify:builder-packages
pnpm run test:packages
pnpm run check:semantic-naming
pnpm run changeset:status
git diff --check
```

Do not repeat the fixed-root generated-project verifier if review repairs do not change a generator, template, generated fixture, dependency, lockfile, manifest version, or verifier input; record the accepted unchanged-input evidence instead. If any such input changes unexpectedly, stop and amend the plan before running networked generation.

- [ ] **Step 2: Inspect exact final state**

Run:

```bash
git status --short --branch
git diff --name-status <base>..HEAD
git diff --stat <base>..HEAD
git diff --check <base>..HEAD
git log --oneline --decorate <base>..HEAD
```

Also prove unchanged `pnpm-lock.yaml`, standards/observability manifest versions, generated templates/fixtures, `.egeria` state, workflows, and proof bytes.

- [ ] **Step 3: Write evidence and review packet**

Record exact comparison, changed files, commits, TDD observations, final commands/results, public-versus-published API distinction, Changeset status, official-source evidence, audit limitation, reviewer dispositions, risks, deferred work, claim limits, and focused revert/recovery order.

- [ ] **Step 4: Validate and commit final artifacts**

Run constitution, semantic naming, placeholder scan, local-link validation through the constitution suite, and diff checks. Mark every completed plan checkbox. Commit exactly the plan/evidence/packet files with:

```text
Record copy externalization verification
```

- [ ] **Step 5: Stop for verified-final-diff approval**

Present the exact final comparison and review packet. Do not push, create a pull request, run `changeset version`, publish, modify remote state, adopt an unpublished version in generated projects, or begin the next P2 increment.
