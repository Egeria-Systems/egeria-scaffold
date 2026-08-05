# P0.3 Strict Builder Lint Preparation Evidence

**Date:** 2026-08-04

**Comparison:** clean `main` at `aa4b421`; local `origin/main` was not refreshed because remote freshness does not affect this local forward increment. The user-owned untracked `docs/superpowers/specs/2026-08-04-phased-eslint-tooling-design.md` was read as design input and is excluded from this implementation's edits and commits.

## Approved scope

Add one forward-only P0.3 increment after the package and release shells:

- export a consumed strict, type-aware TypeScript ESLint flat-config factory from `@egeria-systems/standards`;
- compose exact `typescript-eslint` `strictTypeChecked` and `stylisticTypeChecked` presets with `projectService: true`;
- use ESLint 10 for builder-owned CLI, builder-core, and observability source while preserving the accepted proof's ESLint 9 and Next configuration;
- behaviorally test the public standards configs under exact ESLint 9 and 10;
- leave formatting ownership with Prettier by adding no formatting rule/plugin or formatter execution to ESLint;
- do not use the `all` preset or add later-phase analysis/UI plugins.

## Current official documentation

- The [typescript-eslint shared-config guidance](https://typescript-eslint.io/users/configs/) describes `strictTypeChecked` as the strict preset with typed rules, treats `stylisticTypeChecked` as an additional code-pattern layer, and explicitly warns that strict preset contents are not semver-stable. The dependency therefore requires an exact pin and representative behavioral tests.
- The [typescript-eslint parser guidance](https://typescript-eslint.io/packages/parser/#projectservice) recommends `projectService` over `project`, documents `projectService: true`, and states that `tsconfigRootDir` controls relative project discovery.
- The [ESLint flat-config guidance](https://eslint.org/docs/latest/use/configure/configuration-files) requires a root `eslint.config.*` exporting ordinary flat-config objects.
- Registry checks on 2026-08-04 reported ESLint `10.8.0` as `latest`, ESLint `9.39.5` as `maintenance`, and Node support `^20.19.0 || ^22.13.0 || >=24`; the repository's Node `22.23.0` satisfies that range.
- Registry checks reported `typescript-eslint@8.66.0` as `latest`, with peers `eslint: ^8.57.0 || ^9.0.0 || ^10.0.0` and `typescript: >=4.8.4 <6.1.0`. This covers exact ESLint `9.39.5`, ESLint `10.8.0`, and TypeScript `6.0.3`.
- Registry checks reported `@eslint/js@10.0.1` as current for the builder's ESLint 10 core-recommended config. It remains a consuming-root dependency rather than part of the dual-major public standards factory.

Commands used for current registry evidence:

```text
npm view eslint version engines peerDependencies dist-tags --json
npm view typescript-eslint version engines peerDependencies dist-tags --json
npm view @eslint/js version engines peerDependencies dist-tags --json
```

## Advisory evidence

GitHub Advisory Database GraphQL queries for npm packages returned:

- `eslint`: two historical advisories, both outside the selected versions; the only modern range was `<9.26.0` and the advisory was withdrawn on 2026-02-03;
- `typescript-eslint`: no advisory records;
- `eslint-config-prettier`: a current supply-chain advisory affects `10.1.6` and `10.1.7`. That package is not selected for this increment; no Prettier ESLint plugin/config is needed because the selected typescript-eslint stylistic preset governs code patterns rather than formatting layout.

A fresh locked-graph `pnpm audit --audit-level=moderate` remains required after installation; advisory lookup is not a substitute for auditing transitive dependencies.

## Boundary decisions

- Export `createTypeScriptStrictConfig({ tsconfigRootDir, files? })` from `@egeria-systems/standards/eslint/typescript-strict`.
- Reject non-absolute `tsconfigRootDir`; default `files` to TypeScript source extensions; leave ignores and environment globals to consumers.
- Pin `typescript-eslint` exactly to `8.66.0`; declare only the behaviorally tested ESLint peer majors, `^9.39.5 || ^10.8.0`.
- The builder root supplies `@eslint/js@10.0.1`, ESLint `10.8.0`, file scope, ignores, and zero-warning execution.
- CLI, builder-core, and observability package scripts delegate to the root ESLint 10 configuration. The proof keeps its existing package-local ESLint `9.39.5`, `eslint-config-next`, and lint command unchanged.
- Dual-major tests execute both the Cloudflare-isolation config and the typed strict factory under the real ESLint 9 and 10 APIs. A type-aware floating-promise fixture must fail, while valid but non-Prettier-formatted TypeScript must have no ESLint formatting diagnostic.

No blocking contradiction remains. The approved P0.3 plan is amended with the exact files and RED/GREEN commands before implementation.
