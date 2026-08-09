# Portfolio Content Contract Review Packet

**Date:** 2026-08-09 (America/Toronto)

**Outcome:** READY FOR VERIFIED-FINAL-DIFF APPROVAL after evidence-backed review repair.

**Implementation comparison:** `5580da10eded51ceefa53a068c7ddaaddf2a2d50..3dfdffb5af46b49ac4330fd7f73b22e4fc7d2551`

The implemented increment lives in isolated worktree `/private/tmp/egeria-scaffold-portfolio-content-validation` on branch `portfolio-content-validation`. The separate final artifact commit completes the plan checklist and adds this packet and verification evidence only; its exact hash is reported at handoff.

Remote refs were not refreshed because the user authorized a local source-only increment, the approved base equaled clean local `main` and local `origin/main`, and live remote state did not affect correctness. Official technical documentation, advisories, registry metadata, audits, signatures, production generation, and builds were refreshed independently.

## Scope and result

The production builder now generates strict versioned structured and long-form content for the first bounded P2 content increment. Current `portfolio` and `site` recipes are `0.2.0`; retained `0.1.0` provenance remains readable; `content-files@0.2.0` owns exact application-owned configuration and long-form content surfaces/probes; and new output records exact desired/installed versions and 45/47 managed surfaces.

Generated repositories include validated YAML 1.2 content configuration and Markdown with exact YAML front matter. The parser rejects unsafe YAML, duplicate/extra keys, aliases, missing delimiters, empty required strings/body, unsafe raw controls, and YAML-encoded forbidden controls. Readers use fixed paths. The layout consumes validated locale configuration. Visible sample copy remains in content files. Markdown remains opaque non-executable data.

The committed `portfolio` fixture contains 27 regular files and five installed capabilities. The `site` fixture contains 29 regular files and six installed capabilities. Each profile was generated and verified repeatedly by the actual production CLI; committed output matches fresh output byte-for-byte.

Copy-rule enforcement remains with the public standards package and is not implemented here because public package versioning/publication is separately approval-gated. This increment does not add copy lint rules, Markdown rendering, bounded UI sections, responsive design, Calendly, analytics, deployment, visual/performance/accessibility gates, a real client project, CMS, multilingual content, existing-repository mutation, providers, later capabilities, or `apps/jobs`.

## Changed files

Plans, architecture, evidence, and review:

```text
docs/architecture/enforcement-map.md
docs/architecture/package-ownership.md
docs/implementation-evidence/2026-08-09-portfolio-content-contract-preparation.md
docs/implementation-evidence/2026-08-09-portfolio-content-contract-verification.md
docs/review-packets/2026-08-09-portfolio-content-contract.md
docs/superpowers/plans/2026-08-09-portfolio-content-contract.md
packages/builder-core/AGENTS.md
packages/builder-core/README.md
```

Private contracts, catalog, recipes, templates, and checked schemas:

```text
packages/builder-core/schemas/profile.schema.json
packages/builder-core/schemas/project.schema.json
packages/builder-core/schemas/state.schema.json
packages/builder-core/src/catalog/capability-catalog.ts
packages/builder-core/src/contracts/profile.ts
packages/builder-core/src/contracts/project.ts
packages/builder-core/src/contracts/state.ts
packages/builder-core/src/generation/template-catalog.ts
packages/builder-core/src/profiles/profile-recipes.ts
packages/builder-core/src/resolution/resolve-capabilities.ts
packages/builder-core/templates/common/AGENTS.md.template
packages/builder-core/templates/common/apps/web/AGENTS.md.template
packages/builder-core/templates/common/apps/web/app/layout.tsx
packages/builder-core/templates/common/apps/web/content/content.config.yaml
packages/builder-core/templates/common/apps/web/src/content/content-schema.ts
packages/builder-core/templates/common/apps/web/src/content/read-content.ts
packages/builder-core/templates/portfolio/apps/web/content/en-CA/long-form/introduction.md.template
packages/builder-core/templates/site/apps/web/content/en-CA/long-form/introduction.md.template
```

Tests and verification contracts:

```text
packages/builder-core/tests/contracts.test.mjs
packages/builder-core/tests/diagnostics.test.mjs
packages/builder-core/tests/generate-project.test.mjs
packages/builder-core/tests/render-skeleton.test.mjs
packages/builder-core/tests/resolution.test.mjs
scripts/verify-generated-skeletons.mjs
tests/generated-fixtures/determinism.test.mjs
tests/package-boundaries/private-packages.test.mjs
```

Generated portfolio fixture:

```text
fixtures/generated/portfolio/.egeria/project.yaml
fixtures/generated/portfolio/.egeria/state.json
fixtures/generated/portfolio/AGENTS.md
fixtures/generated/portfolio/apps/web/AGENTS.md
fixtures/generated/portfolio/apps/web/app/layout.tsx
fixtures/generated/portfolio/apps/web/content/content.config.yaml
fixtures/generated/portfolio/apps/web/content/en-CA/long-form/introduction.md
fixtures/generated/portfolio/apps/web/src/content/content-schema.ts
fixtures/generated/portfolio/apps/web/src/content/read-content.ts
```

Generated site fixture:

```text
fixtures/generated/site/.egeria/project.yaml
fixtures/generated/site/.egeria/state.json
fixtures/generated/site/AGENTS.md
fixtures/generated/site/apps/web/AGENTS.md
fixtures/generated/site/apps/web/app/layout.tsx
fixtures/generated/site/apps/web/content/content.config.yaml
fixtures/generated/site/apps/web/content/en-CA/long-form/introduction.md
fixtures/generated/site/apps/web/src/content/content-schema.ts
fixtures/generated/site/apps/web/src/content/read-content.ts
```

No package manifest, Changeset, root/generated lockfile, public package, workflow, provider configuration, or deployment surface changed.

## Focused commits

- `cd01539` — `Plan portfolio content validation`
- `15ec559` — `Amend portfolio content test scope`
- `d6a8a39` — `Add validated portfolio content contracts`
- `f140042` — `Refresh generated content fixtures`
- `33701c9` — `Record content validation repair scope`
- `3dfdffb` — `Reject encoded content controls`

The separate final artifact commit records completed checklists, final evidence, and this packet only.

## Requirement-to-evidence map

| Requirement | Evidence |
| --- | --- |
| Versioned materialized recipes | Current recipe `0.2.0`; retained `0.1.0` accepted; unimplemented `0.3.0` rejected; generated desired/installed provenance agrees |
| Validated structured content | Exact `content.config.yaml`, strict YAML 1.2 parsing, exact schema/default locale/locale list, stable content error |
| Validated long-form content | Exact Markdown delimiters/front matter/body; aliases, duplicates, extra/missing keys, empty fields/body, raw and encoded forbidden controls rejected |
| Non-executable content | No MDX/framework/renderer; body returned as opaque text; no raw-HTML safety claim |
| Fixed server I/O | No caller-controlled content path; exact configuration/site/introduction paths; pure parser separate from reader shell |
| Externalized copy | Profile sample copy and special display-name bytes live only in locale content; executable source assertions guard visible strings |
| Capability/state ownership | `content-files@0.2.0`, exact two added application-owned surfaces/probes, 42/44 render surfaces and 45/47 installed surfaces |
| Actual builder generation | Production CLI generation, state-last project/state records, inference agreement, repeated byte equality, committed fixtures |
| Both direct profile consumers | `portfolio` and `site` template overlays, fixtures, exact 27/29 inventories, lint/typecheck/Next/OpenNext builds |
| No premature later behavior | Exact file/catalog/profile/dependency tests and explicit non-goals; no public package, provider, deployment, UI, Calendly, analytics, or later capability surface |

## Verification summary

Final aggregate at implementation HEAD `3dfdffb5af46b49ac4330fd7f73b22e4fc7d2551`:

| Gate | Result |
| --- | --- |
| Constitution and semantic naming | PASS; 21/21 |
| Package boundaries | PASS; 39/39 |
| Private builder-core | PASS; build and 104/104 |
| Thin CLI | PASS; build and 9/9 |
| Generated fixtures | PASS; 7/7; 27/29 byte-stable files |
| Builder lint/build/typecheck | PASS |
| Fixed-root portfolio/site verification | PASS; pnpm, frozen install, peers, audit, signatures, lint, typecheck, Next, OpenNext |
| Changesets status | PASS; no bump |
| Final root moderate audit | PASS; no known vulnerabilities |
| Final root registry signatures | PASS; 885/885 |

Fixed-root result:

```json
{"ok":true,"profiles":["portfolio","site"],"checks":["pnpm-version","frozen-install","peer-dependencies","dependency-audit","registry-signatures","lint","typecheck","next-build","opennext-build"]}
```

Both fixture lockfiles have SHA-256 `028d52c01ccdc8f76b3beb1e764aa5ccb420981efbe45df28478bf680ce2bb11`. The canonical/generated parser SHA-256 is `828703cb9f90d1cf074107c5998a601756eb336c12acf25bdf138ff02f7547f5`, and both installed states record that fingerprint.

Detailed RED/GREEN observations, environment corrections, current official sources, claim limits, and rollback are in the [preparation evidence](../implementation-evidence/2026-08-09-portfolio-content-contract-preparation.md) and [verification evidence](../implementation-evidence/2026-08-09-portfolio-content-contract-verification.md).

## Independent review dispositions

| Review | Material finding | Disposition |
| --- | --- | --- |
| Requirements | Encoded NUL/DEL could enter decoded front-matter strings | CLOSED; causal RED, predicate reuse, exact fixture regeneration, builder-core/production-build GREEN, fingerprint agreement, independent re-review |
| Requirements | Fixture determinism test was omitted from exact-file plan | CLOSED; direct consumer and rationale recorded in the preapproved plan amendment |
| Architecture and anti-overengineering | No material improvement recommended | CLOSED |
| Test evidence | No material improvement recommended on repaired HEAD; final aggregate still required before build claims | CLOSED; final aggregate passed after review |
| Requirements repair re-review | Both findings closed; no repair-caused material defect | PASS |

No material finding remains open. Reviewers were read-only and performed no repository or external mutation.

## Risks and deferred work

- Markdown remains opaque data. Safe Markdown/HTML rendering is unimplemented and unclaimed.
- Standards-owned copy/locale lint gates remain a separately versioned, published, and approved increment.
- The exact generated language contract is `en-CA`; translation quality and multilingual behavior are untested.
- Dependency audits/signatures and official advisory checks are point-in-time evidence; signatures do not establish source provenance.
- Generated builds passed but no workerd runtime, preview, staging, deployment, visual, performance, accessibility, human-usability, production-safety, or launch-readiness result exists.
- Automation cannot establish WCAG conformance. Required later accessibility automation and any separately required human evaluation remain pending.
- Bounded sections, responsive UI, Calendly, observability runtime, CI/deployment, retained client project, and launch approval remain later P2 gates.
- Existing-repository mutations, migrations, recovery, providers, later capabilities/profiles, and `apps/jobs` remain out of scope.
- Remote refs were not refreshed; this packet uses the approved local base.

## Rollback and recovery

Source recovery is a focused newest-first revert of `3dfdffb`, `33701c9`, `f140042`, `d6a8a39`, `15ec559`, and `cd01539`, followed by production fixture regeneration and `verify:builder-kernel`. Revert the separate final artifact commit if this packet and final evidence must also be withdrawn. Do not reset or rewrite shared history.

To withdraw only the decoded-control repair, revert `3dfdffb`, regenerate both fixtures from the restored template, and rerun builder-core plus fixture verification. To withdraw only fixture adoption, revert `f140042`; do not leave current templates paired with stale committed fixtures. To withdraw the content contract, revert `d6a8a39` after restoring fixtures.

No persistent-data or provider rollback applies. Temporary dependency stores, builds, verifier copies, and disposable generated repositories are non-authoritative and reproducible from the exact pinned toolchain.

## Approval boundary

Requested decision: approve the exact final committed diff reported at handoff, or request one bounded repair.

Approval closes only this first bounded P2 content increment. It does not authorize the standards copy-enforcement increment, the next P2 increment, branch integration, push, pull request, merge, package publication, workflow dispatch, deployment, provider mutation, persistent-data action, production action, permission change, external message, or response to review comments.
