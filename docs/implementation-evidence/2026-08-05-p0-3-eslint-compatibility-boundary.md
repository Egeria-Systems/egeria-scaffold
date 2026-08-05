# P0.3 ESLint compatibility-boundary evidence

**Date:** 2026-08-05

**Frozen starting point:** clean `main` at `097865b`; local `origin/main` was not refreshed because remote freshness does not affect this local P0.3 correction.

## Requested boundary

- Builder repository: ESLint `10.8.0` for `apps/cli` and builder-owned package source under `packages/*`.
- Next.js proof and future generated Next.js projects: ESLint `9.39.5` until the selected Next plugin graph supports ESLint 10.
- `@egeria-systems/standards`: declare and behaviorally test both majors.
- The accepted P0.2 proof must not be described or modified as migrated.

## Current official and registry evidence

- The [ESLint 10 migration guide](https://eslint.org/docs/latest/use/migrate-to-10.0.0) confirms ESLint 10's flat-config boundary and changed config lookup behavior.
- The [Next.js ESLint configuration guide](https://nextjs.org/docs/app/api-reference/config/eslint) documents `eslint-config-next` flat-config consumption through the ESLint CLI.
- The [typescript-eslint shared-config guide](https://typescript-eslint.io/users/configs/) recommends type-checked presets with `projectService`, identifies `strictTypeChecked` as not semver-stable, and does not recommend the `all` preset.

Registry queries on 2026-08-05 returned:

```text
npm view eslint-config-next@16.3.0 version peerDependencies dependencies --json
npm view eslint-plugin-import@2.32.0 peerDependencies --json
npm view eslint-plugin-jsx-a11y@6.10.2 peerDependencies --json
npm view eslint-plugin-react@7.37.5 peerDependencies --json
npm view typescript-eslint@8.66.0 version peerDependencies --json
npm view eslint@9.39.5 version engines --json
npm view eslint@10.8.0 version engines --json
```

The exact graph reports:

- `eslint-config-next@16.3.0`: direct ESLint peer `>=9.0.0`;
- `eslint-plugin-import@2.32.0`: ESLint peers through `^9` only;
- `eslint-plugin-jsx-a11y@6.10.2`: ESLint peers through `^9` only;
- `eslint-plugin-react@7.37.5`: ESLint peers through `^9.7` only;
- `typescript-eslint@8.66.0`: ESLint peers `^8.57.0 || ^9.0.0 || ^10.0.0` and TypeScript `<6.1.0`;
- ESLint `9.39.5` and `10.8.0` both support the repository's Node `22.23.0`.

The selected Next plugin graph therefore still requires the ESLint 9 side of the split. Future generated projects must revalidate their selected Next/plugin graph before changing majors; this evidence does not freeze ESLint 9 after compatibility changes.

## Repository validation and correction

At `097865b`:

- the root manifest correctly pins ESLint `10.8.0`;
- the proof correctly pins ESLint `9.39.5`, `eslint-config-next@16.3.0`, and `typescript-eslint@8.66.0`;
- standards correctly declares `^9.39.5 || ^10.8.0` and executes its public configs under real ESLint 9 and 10 APIs;
- the root ESLint 10 config and aggregate lint script cover CLI, builder-core, and observability source but omit the standards package's own `eslint/*.mjs` source;
- package ownership names the proof split but does not explicitly assign the same conditional ESLint 9 policy to future generated Next.js projects.

The bounded correction adds standards source to the root ESLint 10 config and aggregate lint command, gives standards a zero-warning root-delegating lint script, and records the generated-project policy in canonical package ownership. It changes no file under `proofs/nextjs-cloudflare`, no public standards API, and no generated-project implementation.
