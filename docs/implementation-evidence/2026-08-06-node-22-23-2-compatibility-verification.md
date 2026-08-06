# Node 22.23.2 Compatibility Verification

**Date:** 2026-08-06 (America/Toronto)

**Status:** Local implementation verified; no workflow dispatch or deployment performed

**Plan:** [Node 22.23.2 compatibility plan](../superpowers/plans/2026-08-06-node-22-23-2-compatibility.md)

**Review packet:** [Node 22.23.2 compatibility review](../review-packets/2026-08-06-node-22-23-2-compatibility.md)

## Exact comparison

```text
worktree: /private/tmp/egeria-scaffold-public-package-release
branch: public-package-release
base: 0ac1c4bfeadc9d86efc2beed6a30a4afb32bf3c2
candidate: c2ac452e2000b6073540cb9a7bda015c6f3e6aec
```

The base contains the approved deterministic skeleton-rendering integration and the committed public-package release/Node prerequisite plans. The candidate changes only the approved Node runtime surfaces plus the bounded ESLint template-discovery amendment recorded in the plan.

## Changed files

- `.github/workflows/compatibility-proof.yml`
- `.nvmrc`
- `README.md`
- `docs/compatibility/nextjs-cloudflare.md`
- `docs/implementation-evidence/2026-08-06-node-22-23-2-compatibility-preparation.md`
- `docs/superpowers/plans/2026-08-06-node-22-23-2-compatibility.md`
- `eslint.config.mjs`
- `package.json`
- `packages/builder-core/schemas/state.schema.json`
- `packages/builder-core/src/contracts/state.ts`
- `packages/builder-core/templates/common/.nvmrc`
- `packages/builder-core/templates/common/package.json.template`
- `packages/builder-core/tests/contracts.test.mjs`
- `packages/builder-core/tests/diagnostics.test.mjs`
- `packages/builder-core/tests/inference.test.mjs`
- `packages/builder-core/tests/render-skeleton.test.mjs`
- `packages/builder-core/tests/state-ownership.test.mjs`
- `proofs/nextjs-cloudflare/content/en-CA.json`
- `tests/constitution/constitution.test.mjs`
- `tests/package-boundaries/internal-linting.test.mjs`

No dependency or lockfile changed.

## Runtime and generated-contract results

```text
node --version
v22.23.2

/Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --version
11.20.0

packages/builder-core/schemas/state.schema.json SHA-256
9f3712f1689e778e92343ffa60cbf97a3709c79bc9e652f4bbc8f4aace4e6aa8
```

Volta fetched Node `22.23.2` without changing the global default. Repository-local Volta configuration selects it in this worktree. Every successful pnpm verification command explicitly invoked `/Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm`; the desktop fallback pnpm `11.16.0` is not evidence.

Builder-core was rebuilt immediately before the existing schema generator ran. The final direct `schema:check` passed, proving the checked JSON Schema bytes match the executable contract generator.

## Test-driven record

### Runtime pins

The root test was changed first to require `22.23.2` and run under Node `22.23.2`:

```text
tests/constitution/constitution.test.mjs
RED: 12/13 passed
cause: engines.node and volta.node were still 22.23.0
```

The five selected builder test files were changed first:

```text
RED: 49/78 passed
cause: the executable state literal and rendered manifest templates still required 22.23.0
```

After updating the live owners, rebuilding builder-core, and generating the schema:

```text
constitution.test.mjs: 13/13 passed
selected builder tests: 78/78 passed
```

Review-requested assertions additionally tie the real proof-content Node fact to root `volta.node` and rendered `.nvmrc` to the rendered manifest's Volta pin. Those assertions were added after the owners already contained `22.23.2`, so they were immediately green; no fabricated RED is claimed. Their purpose is future drift prevention.

### Integrated template lint boundary

The first complete builder verification failed in ESLint before later stages:

```text
ERR_MODULE_NOT_FOUND: Cannot find package 'eslint-config-next'
imported from packages/builder-core/templates/common/apps/web/eslint.config.mjs
```

ESLint 10 discovered and executed the generated-project configuration while traversing the builder's broad test globs. A focused test then produced the expected RED:

```text
builder lint does not execute generated-project configuration
RED: false !== true
```

The minimum fix adds only `packages/builder-core/templates/**` to builder ESLint's ignores. Focused GREEN passed 1/1 and `lint:builder` passed. The independent semantic-naming command still scans tracked and non-ignored authored template paths/content, so the correction does not exempt generated sources from the repository naming contract.

## Final command evidence

| Command | Result |
|---|---|
| exact pnpm `install --frozen-lockfile` | pass; already up to date |
| exact pnpm `audit --audit-level=moderate` | pass; no known vulnerabilities found |
| exact pnpm `run verify:builder-packages` | pass |
| `test:constitution` within the aggregate | 20/20 passed: 13 constitution and 7 semantic-naming tests |
| `test:package-boundaries` within the aggregate | 25/25 passed |
| standards tests | 14/14 passed |
| observability tests | 1/1 passed |
| builder lint/build/typecheck and Changesets status | pass; exact two public minor releases still pending |
| builder-core `schema:check` | pass |
| exact pnpm `run verify:compatibility-proof` | pass |
| compatibility unit test | 4/4 passed |
| Next.js `16.3.0` build | pass |
| OpenNext `1.20.2` build | pass |
| Wrangler type check | pass |
| workerd integration | 1/1 passed |
| development Playwright smoke | 4/4 passed |
| preview Playwright smoke | 4/4 passed |
| semantic naming | pass |
| `git diff --check` | pass |

The compatibility proof was permitted to bind loopback ports. It did not receive Cloudflare credentials, dispatch GitHub Actions, call a deploy command, or change a Worker.

## Reviewer dispositions

- Requirements initially found the ESLint repair outside the exact inventory. The plan and preparation evidence were amended under the user's standing no-choice amendment approval. Final rereview: no material findings.
- Architecture initially found two unprotected live copy surfaces. Tests now bind proof content to the root pin and rendered `.nvmrc` to the rendered manifest. Final rereview: no material findings.
- Test evidence challenged the pnpm provenance and RED/GREEN record. Exact command evidence and scope counts were supplied; its independent direct checks passed. Final review: no material findings.

## Evidence limits

- Node `22.23.2` evidence is local-only. The existing deployed canary and its lockfile evidence remain on Node `22.23.0`.
- Automated accessibility checks do not establish WCAG conformance or human usability.
- The selected builder run covers every changed builder contract/template consumer; the broader builder-core behavioral suite was not rerun as one aggregate because unchanged resolution-only tests do not consume these surfaces.
- Advisory results are dated evidence and cannot guarantee future absence.
- No generated repository was installed as a standalone workspace in this increment; deterministic rendered manifest and file-contract tests passed.

## Recovery

Source rollback is a revert of `c2ac452e2000b6073540cb9a7bda015c6f3e6aec`. The generated state schema, templates, workflow pin, proof copy, tests, and documentation must revert atomically with the contract. No state or migration record is updated because no client repository was transformed.

No provider rollback exists for this increment because the workflow was not dispatched and no deployment occurred. The downloaded Volta runtime is local tool cache, not project or provider state.
