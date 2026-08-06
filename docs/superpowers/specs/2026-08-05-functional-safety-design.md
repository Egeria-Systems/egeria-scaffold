# Selective Functional Safety Design

**Status:** Approved direction; written specification awaiting user review

## Problem

The approved source plan says that domain logic remains pure where practical, but the repository does not yet translate that principle into actionable authoring guidance or a narrow automated gate. A blanket functional-programming style would be inappropriate: builder code includes ordered effects, graph traversal, validation accumulation, JSON-pointer walking, and filesystem security checks where explicit state and `for...of` loops are clearer or behaviorally important.

The goal is therefore functional safety, not functional syntax. The repository should make data transformation pure and inputs non-mutating where practical while preserving direct imperative code at explicit algorithmic and effect boundaries.

## Decision

Adopt a selective functional-core/imperative-shell policy for builder source:

- Prefer pure functions, explicit data flow, and deeply readonly input contracts for domain transformations.
- Keep effects visible in scripts, adapters, composition roots, filesystem boundaries, and other infrastructure code.
- Use function composition when it clarifies a sequence of named transformations.
- Keep point-free style optional. Prefer an explicit lambda when it makes parameter flow, arity, narrowing, or error behavior clearer.
- Use `map` for one-to-one transformations, never for side effects. Use `filter`, `flatMap`, and `reduce` only when their semantics match the operation.
- Keep `for...of` when code needs early return, ordered synchronous or asynchronous effects, graph or cycle state, validation accumulation, precise path reporting, filesystem checks, or avoidance of accumulator copying.
- Do not replace a direct algorithm with copied arrays, `Map`s, `Set`s, or reducer state merely to satisfy a stylistic preference.

This policy complements the existing repository rule to favor pure functions where appropriate. It does not make point-free programming, composition helpers, recursion, expression-only code, or loop avoidance repository goals.

## Enforcement boundary

The policy has three repository-owned surfaces:

1. Root `AGENTS.md` owns the authoring guidance and allowed imperative boundaries.
2. `docs/architecture/enforcement-map.md` records `INV-FUNCTIONAL-SAFETY`, distinguishing the automatically checked input-mutation subset from the broader review-owned purity guidance.
3. Root `eslint.config.mjs` owns the ESLint 10 builder-source gate.

The root lint configuration adds a named flat-config object after the shared standards presets for the existing `builderTypeScriptFiles` scope. It enables:

```js
"no-param-reassign": ["error", { props: true }]
```

and:

```js
"@typescript-eslint/prefer-readonly-parameter-types": [
  "error",
  {
    allow: [
      { from: "package", name: "ZodType", package: "zod" },
      { from: "package", name: "$RefinementCtx", package: "zod" },
      { from: "lib", name: "Uint8Array" },
    ],
    checkParameterProperties: true,
    ignoreInferredTypes: true,
    treatMethodsAsReadonly: true,
  },
]
```

The source-qualified allowlist covers external Zod callback/schema contracts and the binary buffer boundary without permitting repository-owned mutable domain inputs. `ignoreInferredTypes: true` keeps the new type-level contract focused on explicitly annotated public and internal boundaries. `treatMethodsAsReadonly: true` avoids treating method-bearing interfaces as mutable solely because they expose methods; `no-param-reassign` still rejects direct parameter and parameter-property reassignment.

`tests/package-boundaries/internal-linting.test.mjs` behaviorally owns the configuration. Its tests must prove that the root ESLint 10 boundary:

- rejects an explicitly typed mutable parameter;
- accepts its deeply readonly equivalent;
- rejects direct parameter and parameter-property reassignment; and
- accepts only the exact source-qualified Zod and `Uint8Array` boundary types.

This automation proves only the configured input-mutation contract. It does not prove referential transparency, runtime behavior, absence of all mutation, or correct placement of every effect.

## Package and dependency decision

Do not add a runtime functional-programming package. The current builder contracts and native collection methods cover the selected policy without another abstraction layer:

- `fp-ts` would introduce parallel `Either`/validation conventions beside the stable discriminated results already owned by builder-core.
- Effect would add an effect runtime and architectural model substantially broader than the current narrow synchronous and asynchronous ports.
- Remeda would add utility surface for transformations that native arrays already express clearly in this scope.

Do not add `eslint-plugin-functional`. Its broader immutability, loop, declaration, and tacit-style rules would turn the semantic policy into syntax enforcement and create churn in valid resolver, inference, codec, and filesystem algorithms. The existing ESLint and typescript-eslint dependencies provide the two narrowly selected rules, so `package.json`, `pnpm-lock.yaml`, and the public `@egeria-systems/standards` package remain unchanged.

The public standards package is deliberately excluded. Its accepted API composes only the pinned shared TypeScript ESLint presets and supports both declared ESLint peer majors. Adding repository-specific functional rules there would widen public behavior and impose this builder policy on generated or external consumers.

## Current source impact

A read-only lint probe over the current builder TypeScript scope found only two required source adjustments:

- `packages/builder-core/src/contracts/capability.ts`: make the `addMergeTargetIssue` descriptor parameter and its nested fingerprint-target shape deeply readonly.
- `packages/builder-core/src/contracts/state.ts`: make the `values` parameter a readonly array of readonly identifier records.

These are type-only contract corrections. No runtime algorithm or public serialized schema changes.

No broader refactor is justified. In particular, retain:

- resolver `Set`, stack, and loop state used for graph and cycle behavior;
- canonical-JSON recursion state;
- sequential inference reads and cache behavior;
- codec and ownership loops that preserve early failure and exact path reporting; and
- repository-reader control flow that protects ordered filesystem checks and cleanup.

The material-simplification review also rejected extracting the duplicated merge-target predicate from state and capability contracts: the duplication is exact but currently has no demonstrated divergence or recurring maintenance cost, while extraction would widen or complicate private ownership.

## Planned implementation sequence

After this specification is approved, surgically amend the existing `docs/superpowers/plans/2026-08-05-p1-builder-kernel.md`; do not create a replacement implementation plan. Revalidate its current Task 5 state first, then place a focused Task 4A before Task 5 implementation if that ordering remains safe.

The exact-file plan is expected to cover only:

- `AGENTS.md` for canonical authoring guidance;
- `docs/architecture/enforcement-map.md` for partial automated ownership;
- `docs/superpowers/plans/2026-08-05-p1-builder-kernel.md` for the approved increment;
- `eslint.config.mjs` for root-only rules;
- `tests/package-boundaries/internal-linting.test.mjs` for RED/GREEN configuration behavior;
- the two builder-core contract files identified above; and
- focused implementation evidence and the required review packet.

Implementation follows test-driven development: first add focused lint-behavior tests and verify the expected RED result, then add the minimum root configuration and readonly annotations for GREEN. Run the smallest affected builder-core and package-boundary checks during the cycle, followed once by the full relevant deterministic suite on the coherent final tree. Independent requirements, architecture/anti-overengineering, and test-evidence review remain required before the increment review packet and approval stop.

## Compatibility, risk, and recovery

The change is source-level and lint-level only. It adds no runtime dependency, generated-client rule, public package behavior, persistent state, migration, provider resource, or deployment action.

The main risk is type-aware lint noise or performance cost. Mitigations are the existing typed root scope, explicitly annotated-parameter focus, narrow source-qualified exceptions, behavioral config tests, and retention of valid imperative boundaries. Any additional source violation discovered during implementation must be evaluated semantically; it is not automatic authorization for a broad refactor or suppression.

Rollback is a focused revert of the guidance, enforcement-map row, root lint layer, behavior tests, and two type annotations. No dependency, data, migration, provider, or production recovery is required.

## Non-goals

- No point-free mandate.
- No loop ban, `let` ban, recursion preference, or expression-only style.
- No runtime functional-programming package.
- No functional ESLint plugin.
- No change to public standards-package behavior.
- No broad source rewrite or extraction without a material maintenance case.
- No claim that lint alone proves functional purity or runtime correctness.
