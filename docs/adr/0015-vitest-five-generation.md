# ADR-0015: Vitest 5 generation and retained histories

**Status:** Accepted

**Date:** 2026-09-12

[ADR-0016](0016-optional-application-persistence.md) supersedes only the standards-version requirement for explicit application-persistence selection; this ADR continues to own default generation and retained histories.

[ADR-0020](0020-application-environments.md#generation-and-precise-supersessions) narrowly permits retiring related unused executable recipes, installed snapshots and historical edges when the complete environment generation activates, with its explicit early-retirement exception for the three unused intermediate recipes. This decision remains the historical owner of the exact Vitest generations below. Preserve public generation until activation, historical receipts afterward, installed-manifest authority and zero-write refusal for unsupported or mixed tuples; no old-to-new migration is implied.

## Context

The generated test foundation must support Vitest 5 without silently changing existing materialized repositories. Existing standards upgrades retain original recipe provenance, and historical app generation and incoming transitions have two valid Vitest 4 declarations. A new default must not change the descriptors, rendered bytes, dependency locks, diagnostics, or supported lifecycle operations of those repositories.

This ADR supersedes only [ADR-0013](0013-convergent-app-profile.md)'s exact current recipe and incoming-edge limitation. It retains that ADR's complete production-site experience, independent optional capabilities, no-deletion transition policy, ownership, state-last persistence, recovery, and final-diff approval. [ADR-0001](0001-materialized-profile-recipes.md)'s materialization and installed-manifest authority and [ADR-0014](0014-selective-effect-application-runtime.md)'s Effect boundary remain unchanged.

## Decision

The initial Vitest 5 generation selected standards capability `0.5.0` and Vitest `5.0.0` with these exact recipe versions:

| Profile | New recipe |
|---|---|
| `portfolio` | `0.11.0` |
| `site` | `0.12.0` |
| `app` | `0.2.0` |

The app recipe continues to materialize exact `app-foundation@0.1.0 + site-routing@0.4.0`. Public standards remains `0.1.0`; generated app Effect remains `4.0.0-rc.112`. This change creates no package release, backend capability, new test environment, or builder/CLI test-runner migration.

That generation added only these incoming app transitions, each across all eight existing Calendly, multilingual, and analytics subsets:

```text
portfolio@0.11.0 -> app@0.2.0
site@0.12.0 -> app@0.2.0
```

Every previously supported exact edge remains available with its retained endpoints. In particular, `portfolio@0.10.0 -> app@0.1.0` and `site@0.11.0 -> app@0.1.0` remain historical operations. No automatic standards `0.4.0` to `0.5.0`, Vitest 4 to 5, or mixed-generation profile transition is introduced. Unknown, skipped, and otherwise unsupported edges continue to refuse before mutation.

Builder-core selects a finite retained catalog and recipe view from validated controls and authoritative installed capability metadata. Original recipe provenance alone cannot choose an installed descriptor. Keep one descriptor per capability identifier and one recipe per profile in each selected view. Preserve existing diagnostic outcomes and optional-operation eligibility, including existing refusals for older histories.

Historical descriptors, generated output, installed fingerprints, dependency locks, and recorded visual inputs remain exact. Retain both valid historical app declarations: fresh app `0.1.0` declares Vitest `4.1.11`; incoming historical app transitions preserve their source's `4.1.10` declaration and approved override. Neither declaration is normalized by unrelated optional lifecycle operations. New standards inference requires exactly Vitest `5.0.0`.

Each new recipe selects its own reviewed lock matching the exact Next/ESLint/Vitest graph and app Effect graph. Existing release-age, security override, frozen-install, and build-script policies remain in force. The generated jsdom setup uses jest-dom's public matchers and Vitest's matcher extension contract while preserving the existing cleanup behavior and TypeScript/lint policies.

The new standards descriptor subject remains pending with a renewed task plan and no carried-forward certification evidence. Historical evidence continues to certify only its exact recorded subject.

## Dependency security successors

The September intermediate cohort below is historical. [ADR-0020](0020-application-environments.md#early-retirement-of-unused-intermediate-recipes) supersedes its executable retention, including original and corrected declarations; complete historical bytes and visual records remain preserved. The later current dependency successors remain supported.

The dependency-only successor dated 2026-09-29 selected schema `1.0.0` recipes `portfolio@0.11.1`, `site@0.12.1` and `app@0.2.1` for new public generation. Fresh generation declares Next `16.3.6`, matching its existing resolved security graph; explicit internal environment candidates use the same corrected declaration. Capability descriptors, all other direct dependency declarations, runtime and presentation sources, settings and removal policies remain unchanged. The exact graph substitutions are `next@16.3.6`, `fast-uri@3.1.8`, major-preserving `brace-expansion@1.1.21`, `2.1.7` and `5.0.12`, Miniflare's `undici@7.29.1` and jsdom's `undici@8.10.2`. The root tooling graph selects the same Next and brace-expansion corrections alongside its Miniflare substitution; it has no fast-uri dependency. The separate `braces@3.0.3` advisory remains unresolved: these corrections do not waive the audit gate or authorize security acceptance. The one-day release age and time-based resolution remain in force, with exact reviewed Undici age exclusions.

Builder-core owns five new complete lock families:

| Recipe selection | Lock identity |
|---|---|
| Portfolio | `portfolio-0.11.1` |
| Site | `site-0.12.1` |
| App or site with foundation | `app-0.2.1` |
| App with persistence, independently including email or jobs | `app-0.2.1-persistence` |
| Portfolio with foundation, independently including email or jobs | `portfolio-0.11.1-foundation` |

Each identity has its own `web-recipe-<identity>/pnpm-lock.yaml`. Exact installed recipe and descriptor tuples select the matching complete policy and graph during planning and application. Addition/removal preserves that recipe view, including foundation retention; it cannot silently adopt the latest generation. Historical locks, fixtures, rendered bytes, diagnostics, supported operations and both historical Vitest declarations remain exact. Supported already materialized schema-1 security projects retain their exact original Next declarations (`16.3.0` for portfolio without foundation, `16.3.3` with foundation or for site/app); corrected projects retain `16.3.6`. Selection requires the exact installed recipe/descriptor tuple and managed Next fingerprint, with matching actual manifest and lock bytes. Unknown or inconsistent declarations refuse before mutation. This finite selection adds no automatic migration or recipe replacement. There is no historical-to-security migration or mixed-cohort edge.

The only additional incoming edges are `portfolio@0.11.1 -> app@0.2.1` and `site@0.12.1 -> app@0.2.1`, covering the same eight optional subsets. Their exact new visual inputs and candidate manifest require separate review and approval even when the resulting pixels match existing baselines. All previous edges and receipt identifiers remain available.

That cohort's eleven fixture contracts selected complete versioned successor roots through `scripts/verify-generated-skeletons.mjs`. Their unmerged current manifest/state pairs may be canonically regenerated for this declaration correction only when every other generated byte remains equal. Previous unversioned fixture roots, historical locks and records, and all PNG baselines remain immutable. Corrected transition inputs still require separate exact-input and candidate-manifest review and approval. Frozen installation, peers, audit/signatures, source/runtime/browser verification, visual evidence and independent review remain required. Dependency verification supplies implementation evidence, not a new capability certification. [ADR-0020](0020-application-environments.md#generation-and-precise-supersessions) still owns later schema-2 activation and related retirement; this schema-1 successor activates neither.

### Successor dependency closure dated 2026-10-09

At this dated dependency-closure boundary, public generation selected schema `1.0.0` recipes `portfolio@0.11.2`, `site@0.12.2` and `app@0.2.2`, with direct Next `16.3.8`. Five new complete lock families are `portfolio-0.11.2`, `site-0.12.2`, `app-0.2.2`, `portfolio-0.11.2-foundation` and `app-0.2.2-persistence`. Their finite selection preserves the corresponding foundation, persistence, independent email and jobs behavior described above. All capability descriptors, other direct declarations, settings, runtime and presentation sources, build permissions, release-age policy and prior age exclusions remain unchanged.

Each generated family replaces exactly thirty-nine package identities: Next `16.3.8` and its env/SWC companions, sharp `0.35.5` and its native/wasm/libvips closure, source-map-js `1.2.2`, and proxy-addr `2.0.8`. Root tooling applies the same closure and additionally replaces shell-quote `1.10.0` with `1.11.0` through a root-only override, for forty replacements. The unactivated internal environment recipes retain portfolio `0.12.0`, site `0.13.0` and app `0.3.0` identities while renewing their exact graphs, workspace policy, Next declaration and derived fingerprints. These changes do not activate schema-2 public generation.

All other supported public recipes, locks and fixtures remain exact; the September intermediate cohort is retired only under the [narrow ADR-0020 exception](0020-application-environments.md#early-retirement-of-unused-intermediate-recipes). Installed recipe/descriptor selection cannot adopt this new graph through an unrelated operation. The only new incoming edges are `portfolio@0.11.2 -> app@0.2.2` and `site@0.12.2 -> app@0.2.2`, each with the existing eight optional subsets. Current portfolio inputs remain unadmitted by the exact visual acceptance records and must refuse before mutation until separate input review and visual admission. Existing site-to-app no-visual-change handling remains unchanged; no mixed-cohort transition is introduced.

That dependency closure selected eleven newly materialized roots: `portfolio-0.11.2`, `portfolio-calendly-0.11.2`, `portfolio-email-0.11.2`, `site-0.12.2`, `site-contact-form-0.12.2`, `site-multilingual-0.12.2`, `site-multilingual-analytics-0.12.2`, `app-0.2.2`, `app-all-optional-integrations-0.2.2`, `app-persistence-0.2.2` and `app-persistence-email-0.2.2`. Canonical rendering changes only project/state controls and fingerprints, the direct Next declaration, workspace policy and lock. Every unrelated generated byte and PNG remains identical to its retained counterpart. Copied historical verification records are retained provenance, not new runtime verification.

Raw full-severity graph audits still report the unresolved `braces@3.0.3` advisory. The existing audit exception remains unchanged, freshness-revoked and unbound to the new graphs. Source preparation, compiler results and deterministic or mocked tests establish neither installed-root readmission nor generated application, Worker, browser, visual, hosted, provider or capability-certification acceptance. Those checks and any residual security decision remain separately gated.

## Rejected alternatives

- Changing the existing standards descriptor or retained locks would alter materialized repository meaning and invalidate historical fingerprints or evidence.
- Switching global defaults without explicit historical selection would make existing diagnostics and lifecycle operations depend on the latest generator.
- A generic version resolver or migration framework is unnecessary for the finite approved recipe and edge matrix.
- An automatic historical migration would require its own approved compatibility, transformation, verification, and recovery contract.

## Consequences

New projects receive Vitest 5; retained projects keep their existing supported behavior. The exact recipe matrix introduces a bounded maintenance obligation for retained descriptors, render contexts, locks, and lifecycle regression coverage.

## Enforcement

This ADR owns the generation and edge decision. The [capability model](../architecture/capability-model.md) owns capability and lifecycle behavior, and the [enforcement map](../architecture/enforcement-map.md) owns actual verification gates. The separate [app transition visual-evidence gate](../architecture/capability-model.md#app-transition-visual-evidence) requires review of the fixed new inputs and exact candidate manifest before acceptance; recomputing fingerprints does not supply approval. Independent requirements, architecture, and test-evidence review and exact final-diff approval remain required. Passing Node, jsdom, static, or build checks establishes only the boundaries actually exercised; this decision provides no deployment, provider, accessibility-conformance, or production-readiness claim.

## Literal lint roots successors

The schema-1 tooling successors are `portfolio@0.11.3`, `site@0.12.3` and `app@0.2.3`. Their explicit rendering and installed-snapshot selection preserve the `.2` capability descriptors and all unrelated generated bytes. The builder kernel owns `patches/next-eslint-plugin-next.patch` as a managed file. Workspace policy binds that patch to the exact Next ESLint plugin version and removes only that parent's `fast-glob` edge. Root/proof policy and the internal application-environment candidates use the same canonical patch; internal candidates do not activate schema 2.

The five successor lock families are `portfolio-0.11.3`, `portfolio-0.11.3-foundation`, `site-0.12.3`, `app-0.2.3` and `app-0.2.3-persistence`. Installed `.2` and older supported cohorts retain their exact recipes, locks, fixtures and operations. The only successor incoming edges are exact `.3` portfolio/site to `.3` app; mixed cohorts remain unsupported. Portfolio transitions still require their own exact visual admission. The existing visual candidate verifier accepts `--app-recipe-version=0.2.2` or `--app-recipe-version=0.2.3`; omission retains its `.2` behavior. Selecting a candidate is not visual acceptance.

Public generation and the active immutable-fixture verifier select `.3` together. Eleven complete fixture roots were materialized byte-for-byte from actual successor generation outputs with new successful generation receipts; their direct CLI, verifier and default assertions select the same cohort. Retained `.2` and older supported fixtures, locks and historical evidence remain exact. This coupled source activation carries the completed generation evidence; it does not establish remaining full-kernel, audit/signature, browser, visual or final-diff acceptance.
