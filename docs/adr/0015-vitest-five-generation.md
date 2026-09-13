# ADR-0015: Vitest 5 generation and retained histories

**Status:** Accepted

**Date:** 2026-09-12

## Context

The generated test foundation must support Vitest 5 without silently changing existing materialized repositories. Existing standards upgrades retain original recipe provenance, and historical app generation and incoming transitions have two valid Vitest 4 declarations. A new default must not change the descriptors, rendered bytes, dependency locks, diagnostics, or supported lifecycle operations of those repositories.

This ADR supersedes only [ADR-0013](0013-convergent-app-profile.md)'s exact current recipe and incoming-edge limitation. It retains that ADR's complete production-site experience, independent optional capabilities, no-deletion transition policy, ownership, state-last persistence, recovery, and final-diff approval. [ADR-0001](0001-materialized-profile-recipes.md)'s materialization and installed-manifest authority and [ADR-0014](0014-selective-effect-application-runtime.md)'s Effect boundary remain unchanged.

## Decision

New generation selects standards capability `0.5.0` and Vitest `5.0.0` with these exact recipe versions:

| Profile | New recipe |
|---|---|
| `portfolio` | `0.11.0` |
| `site` | `0.12.0` |
| `app` | `0.2.0` |

The app recipe continues to materialize exact `app-foundation@0.1.0 + site-routing@0.4.0`. Public standards remains `0.1.0`; generated app Effect remains `4.0.0-rc.112`. This change creates no package release, backend capability, new test environment, or builder/CLI test-runner migration.

The new generation adds only these incoming app transitions, each across all eight existing Calendly, multilingual, and analytics subsets:

```text
portfolio@0.11.0 -> app@0.2.0
site@0.12.0 -> app@0.2.0
```

Every previously supported exact edge remains available with its retained endpoints. In particular, `portfolio@0.10.0 -> app@0.1.0` and `site@0.11.0 -> app@0.1.0` remain historical operations. No automatic standards `0.4.0` to `0.5.0`, Vitest 4 to 5, or mixed-generation profile transition is introduced. Unknown, skipped, and otherwise unsupported edges continue to refuse before mutation.

Builder-core selects a finite retained catalog and recipe view from validated controls and authoritative installed capability metadata. Original recipe provenance alone cannot choose an installed descriptor. Keep one descriptor per capability identifier and one recipe per profile in each selected view. Preserve existing diagnostic outcomes and optional-operation eligibility, including existing refusals for older histories.

Historical descriptors, generated output, installed fingerprints, dependency locks, and recorded visual inputs remain exact. Retain both valid historical app declarations: fresh app `0.1.0` declares Vitest `4.1.11`; incoming historical app transitions preserve their source's `4.1.10` declaration and approved override. Neither declaration is normalized by unrelated optional lifecycle operations. New standards inference requires exactly Vitest `5.0.0`.

Each new recipe selects its own reviewed lock matching the exact Next/ESLint/Vitest graph and app Effect graph. Existing release-age, security override, frozen-install, and build-script policies remain in force. The generated jsdom setup uses jest-dom's public matchers and Vitest's matcher extension contract while preserving the existing cleanup behavior and TypeScript/lint policies.

The new standards descriptor subject remains pending with a renewed task plan and no carried-forward certification evidence. Historical evidence continues to certify only its exact recorded subject.

## Rejected alternatives

- Changing the existing standards descriptor or retained locks would alter materialized repository meaning and invalidate historical fingerprints or evidence.
- Switching global defaults without explicit historical selection would make existing diagnostics and lifecycle operations depend on the latest generator.
- A generic version resolver or migration framework is unnecessary for the finite approved recipe and edge matrix.
- An automatic historical migration would require its own approved compatibility, transformation, verification, and recovery contract.

## Consequences

New projects receive Vitest 5; retained projects keep their existing supported behavior. The exact recipe matrix introduces a bounded maintenance obligation for retained descriptors, render contexts, locks, and lifecycle regression coverage.

## Enforcement

This ADR owns the generation and edge decision. The [capability model](../architecture/capability-model.md) owns capability and lifecycle behavior, and the [enforcement map](../architecture/enforcement-map.md) owns actual verification gates. The separate [app transition visual-evidence gate](../architecture/capability-model.md#app-transition-visual-evidence) requires review of the fixed new inputs and exact candidate manifest before acceptance; recomputing fingerprints does not supply approval. Independent requirements, architecture, and test-evidence review and exact final-diff approval remain required. Passing Node, jsdom, static, or build checks establishes only the boundaries actually exercised; this decision provides no deployment, provider, accessibility-conformance, or production-readiness claim.
