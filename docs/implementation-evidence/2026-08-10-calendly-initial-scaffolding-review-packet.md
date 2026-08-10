# Calendly Initial-Scaffolding Review Packet

**Review date:** 2026-08-10 (America/Toronto)

**Outcome:** READY FOR VERIFIED-FINAL-DIFF APPROVAL after the final evidence commit and affected documentation checks

**Implementation comparison before final evidence:** `02ec5eb12741c1622beec02529c38965e7501d68..e0242eafa848847f108c08e3e9eaac408cc32e6a`

**Verified implementation tree:** `e0242eafa848847f108c08e3e9eaac408cc32e6a`

The two final evidence documents are the only current untracked additions. The existing plan has checklist-only modifications, and the ignored progress ledger is not part of the Git comparison. No implementation source, template, schema, fixture, manifest, dependency, workflow, or lockfile change is uncommitted. The final evidence commit has not been made; its hash and the exact final committed `02ec5eb12741c1622beec02529c38965e7501d68..HEAD` comparison will be reported after that commit. This packet does not invent a self-referential hash.

Remote refs were not fetched or refreshed. This is an approved clean sequential local `main` source stream with a frozen local base, and remote freshness does not affect the implementation comparison. Local `main` is currently ahead of the unrefreshed local `origin/main`; no claim is made about current remote state.

## Repository identity and evidence state

Before evidence drafting, local `main` was clean at `e0242eafa848847f108c08e3e9eaac408cc32e6a`. Current non-ignored status is limited to:

```text
 M docs/superpowers/plans/2026-08-10-calendly-initial-scaffolding.md
?? docs/implementation-evidence/2026-08-10-calendly-initial-scaffolding-review-packet.md
?? docs/implementation-evidence/2026-08-10-calendly-initial-scaffolding-verification.md
```

The six registered separate worktrees were inspected read-only. Each has an empty short status beyond its branch header; none contains a tracked, staged, or untracked change. One historical worktree branch reports only that it is behind the unrefreshed local `origin/main`.

Ignored workspace artifacts remain outside the comparison: the local pnpm store; dependency and build output under the root packages/CLI; proof `.next`, `.open-next`, `.wrangler`, dependency, test-result, and TypeScript-build output; and ignored SDD ledgers. The Calendly SDD directory contains the task reports and progress ledger used to prepare this packet. No ignored artifact is staged or included in the implementation or evidence commit.

## Scope and result

The builder now supports an explicit, optional `booking-calendly@0.1.0` selection only during initial `portfolio` or `site` scaffolding. The paired URL/mode request resolves dependency-first, records strict desired settings, and emits bounded link, inline, or popup presentation. Both profile recipes remain `0.5.0` with unchanged defaults.

The generated integration uses externalized validated booking copy, a typed reader, managed settings, a client-only presentation component, a conditional builder-owned home composition root, and a capability-owned browser specification. It uses ordinary-anchor fallback and a direct cross-origin iframe; popup enhancement uses native `dialog`. It adds no package, provider adapter, host-page script, API client, event listener, webhook, analytics hook, cookie/consent system, generic integration abstraction, generic platform/database port, later-add command, or existing-repository mutation.

The retained popup-mode `portfolio-calendly` fixture joins the base portfolio and site fixtures as representative risk evidence. All three passed exact regeneration, inference/diagnostics, isolated installs, audits and signatures, lint, typecheck, Next/OpenNext builds, and local development/workerd Chromium suites. The provider origin was stubbed and fail-closed; no Calendly service was called.

This packet does not mark P2 complete, approve launch scope, or authorize any later P2 outcome.

## Exact implementation inventory

The pre-evidence implementation comparison changes exactly 95 files: 13 documentation/governance files, 3 CLI files, 11 builder contract/generation/test files, 9 canonical template files, 10 root verification/policy files, and 49 generated-fixture files.

### Documentation, governance, and builder guidance — 13

```text
CONTRIBUTING.md
README.md
apps/cli/README.md
docs/architecture/capability-model.md
docs/architecture/enforcement-map.md
docs/architecture/overview.md
docs/architecture/package-ownership.md
docs/implementation-evidence/2026-08-10-calendly-initial-scaffolding-preparation.md
docs/roadmaps/program-roadmap.md
docs/superpowers/plans/2026-08-10-calendly-initial-scaffolding.md
docs/superpowers/specs/2026-08-10-calendly-initial-scaffolding-design.md
packages/builder-core/AGENTS.md
packages/builder-core/README.md
```

### CLI implementation and tests — 3

```text
apps/cli/src/arguments.ts
apps/cli/src/run-cli.ts
apps/cli/tests/cli.test.mjs
```

### Builder contracts, generation, schema, and tests — 11

```text
packages/builder-core/schemas/project.schema.json
packages/builder-core/src/catalog/capability-catalog.ts
packages/builder-core/src/contracts/project.ts
packages/builder-core/src/generation/render-skeleton.ts
packages/builder-core/src/generation/render-template.ts
packages/builder-core/src/generation/template-catalog.ts
packages/builder-core/src/generation/write-generated-project.ts
packages/builder-core/tests/contracts.test.mjs
packages/builder-core/tests/generate-project.test.mjs
packages/builder-core/tests/render-skeleton.test.mjs
packages/builder-core/tests/resolution.test.mjs
```

### Canonical generated-source templates — 9

```text
packages/builder-core/templates/booking-calendly/apps/web/app/page.tsx
packages/builder-core/templates/booking-calendly/apps/web/content/en-CA/booking-calendly.yaml
packages/builder-core/templates/booking-calendly/apps/web/src/integrations/booking-calendly/booking-content.ts
packages/builder-core/templates/booking-calendly/apps/web/src/integrations/booking-calendly/booking-settings.ts.template
packages/builder-core/templates/booking-calendly/apps/web/src/integrations/booking-calendly/calendly-booking.tsx
packages/builder-core/templates/booking-calendly/apps/web/tests/e2e/calendly-booking.spec.ts
packages/builder-core/templates/common/README.md.template
packages/builder-core/templates/common/apps/web/AGENTS.md.template
packages/builder-core/templates/common/apps/web/src/presentation/content-page.tsx
```

### Root policy, verification harness, and boundary tests — 10

```text
eslint.config.mjs
package.json
scripts/verify-generated-skeletons.mjs
tests/constitution/constitution.test.mjs
tests/generated-fixtures/determinism.test.mjs
tests/generated-fixtures/verification-script.test.mjs
tests/package-boundaries/internal-linting.test.mjs
tests/package-boundaries/private-packages.test.mjs
tests/package-boundaries/public-standards.test.mjs
tests/package-boundaries/release-safeguards.test.mjs
```

### Retained generated fixtures — 49

New representative fixture, exactly 41 files:

```text
fixtures/generated/portfolio-calendly/.egeria/migrations.jsonl
fixtures/generated/portfolio-calendly/.egeria/project.yaml
fixtures/generated/portfolio-calendly/.egeria/state.json
fixtures/generated/portfolio-calendly/.github/workflows/quality.yml
fixtures/generated/portfolio-calendly/.gitignore
fixtures/generated/portfolio-calendly/.nvmrc
fixtures/generated/portfolio-calendly/AGENTS.md
fixtures/generated/portfolio-calendly/README.md
fixtures/generated/portfolio-calendly/apps/web/AGENTS.md
fixtures/generated/portfolio-calendly/apps/web/app/globals.css
fixtures/generated/portfolio-calendly/apps/web/app/layout.tsx
fixtures/generated/portfolio-calendly/apps/web/app/page.tsx
fixtures/generated/portfolio-calendly/apps/web/content/content.config.yaml
fixtures/generated/portfolio-calendly/apps/web/content/en-CA/booking-calendly.yaml
fixtures/generated/portfolio-calendly/apps/web/content/en-CA/long-form/introduction.md
fixtures/generated/portfolio-calendly/apps/web/content/en-CA/site.yaml
fixtures/generated/portfolio-calendly/apps/web/eslint.config.mjs
fixtures/generated/portfolio-calendly/apps/web/next.config.ts
fixtures/generated/portfolio-calendly/apps/web/open-next.config.ts
fixtures/generated/portfolio-calendly/apps/web/package.json
fixtures/generated/portfolio-calendly/apps/web/playwright.config.shared.ts
fixtures/generated/portfolio-calendly/apps/web/playwright.deployed.config.ts
fixtures/generated/portfolio-calendly/apps/web/playwright.dev.config.ts
fixtures/generated/portfolio-calendly/apps/web/playwright.preview.config.ts
fixtures/generated/portfolio-calendly/apps/web/postcss.config.mjs
fixtures/generated/portfolio-calendly/apps/web/src/content/content-schema.ts
fixtures/generated/portfolio-calendly/apps/web/src/content/content-source.d.ts
fixtures/generated/portfolio-calendly/apps/web/src/content/read-content.ts
fixtures/generated/portfolio-calendly/apps/web/src/infrastructure/observability/installed-capability.ts
fixtures/generated/portfolio-calendly/apps/web/src/integrations/booking-calendly/booking-content.ts
fixtures/generated/portfolio-calendly/apps/web/src/integrations/booking-calendly/booking-settings.ts
fixtures/generated/portfolio-calendly/apps/web/src/integrations/booking-calendly/calendly-booking.tsx
fixtures/generated/portfolio-calendly/apps/web/src/presentation/content-page.tsx
fixtures/generated/portfolio-calendly/apps/web/src/sections/section-registry.tsx
fixtures/generated/portfolio-calendly/apps/web/tests/e2e/calendly-booking.spec.ts
fixtures/generated/portfolio-calendly/apps/web/tests/e2e/site-quality.spec.ts
fixtures/generated/portfolio-calendly/apps/web/tsconfig.json
fixtures/generated/portfolio-calendly/apps/web/wrangler.jsonc
fixtures/generated/portfolio-calendly/package.json
fixtures/generated/portfolio-calendly/pnpm-lock.yaml
fixtures/generated/portfolio-calendly/pnpm-workspace.yaml
```

Authorized common-output regeneration, exactly 8 files:

```text
fixtures/generated/portfolio/.egeria/state.json
fixtures/generated/portfolio/README.md
fixtures/generated/portfolio/apps/web/AGENTS.md
fixtures/generated/portfolio/apps/web/src/presentation/content-page.tsx
fixtures/generated/site/.egeria/state.json
fixtures/generated/site/README.md
fixtures/generated/site/apps/web/AGENTS.md
fixtures/generated/site/apps/web/src/presentation/content-page.tsx
```

The later final evidence commit is limited to:

```text
docs/implementation-evidence/2026-08-10-calendly-initial-scaffolding-verification.md
docs/implementation-evidence/2026-08-10-calendly-initial-scaffolding-review-packet.md
docs/superpowers/plans/2026-08-10-calendly-initial-scaffolding.md
```

The ignored `.superpowers/sdd/2026-08-10-calendly-initial-scaffolding/progress.md` is working-session status only and is not staged or committed.

## Focused commits

- `5077377e44213e7f8a0ce752ca04baf20d6be075` — `Plan Calendly initial scaffolding`
- `3a25478afaaff1f556a1398e536ef78ccfd40ece` — `Add Calendly scaffold contracts`
- `fd77ecfc48dd18669e4a13805f5ca9b7180f6c50` — `Accept explicit Calendly HTTPS port`
- `f0ab380d187506a8a6c2355a8ed731c064150cb4` — `Clarify Calendly common template scope`
- `aaf95835f9d0b85ab7678c4cdd974485d2ff1f3e` — `Generate Calendly booking presentation`
- `db5ed5424606d1fe2eea54d455d090ba4a385d58` — `Harden Calendly fallback behavior`
- `95786a4395896d289aababc2036ae2a06e291c88` — `Record Calendly implementation amendments`
- `c696e729a79fe6dd5eb0afc82bc628d06c2b6971` — `Fix generated Calendly browser typecheck`
- `7d80f81ff133e5886b72180bdbc206b1dccc6e02` — `Certify generated Calendly booking`
- `31e9bab10014e3fe9d06c40e6b945313c5dd6c1d` — `Document Calendly scaffold boundaries`
- `e0242eafa848847f108c08e3e9eaac408cc32e6a` — `Harden Calendly destination validation`

The final evidence commit is intentionally absent from this list until it exists.

## Requirement-to-evidence map

| Requirement | Evidence |
| --- | --- |
| Explicit optional initial selection | Paired CLI arguments; strict exact request keys; unchanged default recipes and no-selection behavior |
| Strict state agreement | `capabilitySettings.booking-calendly` exists exactly when selected; installed state records capability version and fingerprints |
| Validated destination | HTTPS, exact two hosts, non-root path, no credentials/query/fragment/whitespace/non-default port, 2,048-character bound, sanitized issues, explicit `:443` acceptance |
| Three presentation modes | Contract coverage for link/inline/popup; direct iframe; observer hydration fallback; native-dialog progressive enhancement; ordinary-anchor fallback |
| Externalized copy and pure composition | Validated `en-CA` YAML, typed reader, pure `ContentPage`, effects confined to bounded client component |
| Capability cohesion | Five surfaces/probes, builder-owned conditional home root, no overlapping ownership or generic provider/settings abstraction |
| Security/privacy isolation | Two-host CSP/egress metadata, no provider script/API/events, query rejection, origin-wide fail-closed stub, no destination disclosure |
| Representative browser evidence | Popup fixture proves no eager request, activation/cleanup, focus, fallback, 320-pixel containment, and selected axe rules |
| Deterministic fixture evidence | Exact 36/41/38 files, 76 Calendly surfaces, compiled-CLI regeneration, state/inference agreement, source immutability |
| Generated compatibility | All three fixtures pass frozen install, peer, audit, signature, lint, typecheck, Next/OpenNext build, explicit Chromium, development, and preview checks |
| Claim boundary | No provider, hosted, deployed, visual, human-accessibility, production, launch, or WCAG claim |

## Capability and state details

`booking-calendly` declares:

- version `0.1.0`;
- delivery mode `source-generated`;
- state classification `repository-stateful`;
- source-removal policy `automatic`;
- dependency `section-composition`;
- supported profiles `portfolio` and `site`;
- external domains `calendly.com` and `www.calendly.com`;
- CSP `frame-src https://calendly.com https://www.calendly.com`;
- provider-controlled browser storage, scheduling data, and retention;
- elevated threat review;
- no package, environment variable, secret, or platform resource; and
- verification by typecheck, Next build, browser development, and browser preview.

The retained fixture is `acme-portfolio-calendly`, display name `Acme Portfolio Booking`, profile `portfolio`, recipe `0.5.0`, destination `https://calendly.com/example/intro`, and mode `popup`. Installed capabilities are exactly `standards`, `content-files`, `section-composition`, `deployment-cloudflare`, `observability`, and `booking-calendly`. State records 76 managed surfaces, no applied migrations, and no ejections.

## Verification summary

Detailed command evidence and limitations are in the paired [verification evidence](2026-08-10-calendly-initial-scaffolding-verification.md).

| Gate | Result |
| --- | --- |
| Builder-core | PASS; `121/121` |
| CLI | PASS; `10/10` |
| Checked schema | PASS |
| Constitution | PASS; `22/22` |
| Package boundaries | PASS; `41/41` |
| Semantic naming | PASS |
| Generated fixture policy and determinism | PASS; `7/7` in `366.45s`; `36/41/38` exact files |
| Fixed-root certification | PASS; three fixtures, each exact 12 checks, approximately `6m30s` |
| Builder-core/CLI lint and typecheck | PASS |
| Root builder lint | PASS; `7.03s` |
| Root builder build | PASS; `4.10s` |
| Root builder typecheck | PASS; `4.02s` |
| Root moderate audit | PASS; no known vulnerabilities |
| Registry signatures | PASS; `885` verified |
| Changeset status | PASS; pre-existing standards minor retained; no Calendly package/version need |
| Diff check | PASS; no output |

No final aggregate rerun was performed on unchanged tree `e0242ea`. The baseline aggregate was green, and the exact affected component suites plus the complete fixed-root harness succeeded after the final repair. Repository policy forbids repeating unchanged successful expensive checks.

## Independent review dispositions

| Review | Disposition |
| --- | --- |
| Requirements | Explicit `:443` canonicalization defect fixed and re-review approved; design `www` host/CSP mismatch fixed and approved |
| Architecture and anti-overengineering | Unrestricted-query privacy defect fixed through all-query rejection and approved; no generic framework/package or ownership defect remains |
| Test evidence | Stale selected-generation CLI expectation and query/schema/canonical-URL protection gaps fixed; affected full suites, regeneration, determinism, and fixed-root checks passed; approved |

Earlier scoped review repairs for inactive frames, API-unavailable fallbacks, provider-origin interception, direct dialog bounds, generated typechecking, and canonical provider-specific wording were also reproduced, repaired, rerun, and approved. All reviewers were read-only. No material finding remains open.

## Security and privacy boundary

- The raw validated destination is retained in desired state and generated attributes, while request/navigation comparisons use URL-standard canonical form.
- Query strings are rejected completely; failures remain sanitized.
- The local browser test intercepts every configured-provider-origin request, fulfills only the exact scheduling document, aborts and records every unexpected request, and asserts none occurred.
- No Calendly account, event type, credential, booking, provider data, cookie, retention setting, API, webhook, analytics, or consent surface is managed.
- No provider persistent state was created or changed by implementation or verification.
- Audit/signature results are dated point-in-time evidence, not a guarantee against unknown or future vulnerabilities.

## Risks and deferred work

- Local stubbed evidence does not establish Calendly availability, provider rendering, booking completion, or provider confirmation.
- No protected-staging deployment, hosted CI run, live deployed-mode call, synthetic Calendly event/identity, or provider cleanup was executed.
- Automated accessibility evidence does not establish visual quality, human usability, assistive-technology compatibility, or WCAG conformance.
- Chromium is the only certified browser, and external package/browser artifacts may change later.
- The retained risk fixture covers popup mode; link/inline remain deterministic contract coverage rather than separate expensive full fixtures.
- Existing-repository transformation, capability addition/removal, migrations, booking webhooks, provider recovery, and later capabilities remain deferred.
- Client-specific content, visual approval, performance certification, launch readiness, and P2 phase completion require later evidence and explicit approval.

## Rollback and recovery

Source rollback is a focused newest-first revert of `e0242ea`, `31e9bab`, `7d80f81`, `c696e72`, `95786a4`, `db5ed54`, `aaf9583`, `f0ab380`, `fd77ecf`, `3a25478`, and `5077377` as far as the intended recovery boundary requires. Revert the later final evidence commit separately to withdraw this packet, verification evidence, and checklist state. Do not reset or rewrite history.

After source rollback, regenerate all affected fixtures through the restored compiled production CLI and rerun applicable deterministic and fixed-root verification. Catalog metadata, contracts, schemas, templates, generated bytes, ownership fingerprints, desired state, installed state, and fixture inventories must remain in agreement.

Provider cleanup is separate and is not accomplished by Git or generated-source rollback. The builder manages no provider persistent state, and this increment created no Calendly account configuration, event type, booking, cookie, scheduling record, or other provider data; there is therefore no current provider cleanup action. Any later protected-staging provider state must be cleaned and evidenced under its separately approved certification plan.

No dependency version rollback is required for Calendly because the capability adds no package. The existing pending minor Changeset for `@egeria-systems/standards` predates this capability and remains separately owned.

## Authorization and stop gate

No push, pull request, merge, publication, deployment, workflow dispatch, provider mutation, persistent-data action, production action, permission change, credential use, external message, or review-comment response occurred.

After the evidence commit and affected documentation/semantic checks, stop for explicit verified-final-diff approval. That approval accepts only the final committed comparison. It does not approve P2 completion, client launch, protected-staging certification, provider action or cleanup, another P2 outcome, push, pull request, merge, publication, deployment, production action, permission change, external message, or review-comment response.
