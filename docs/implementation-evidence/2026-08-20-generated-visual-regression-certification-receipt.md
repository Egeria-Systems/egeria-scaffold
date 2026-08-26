# Generated Visual Regression Certification Receipt

**Execution date:** `2026-08-20 America/Toronto (EDT, UTC-04:00)`

**Certification receipt status:** `complete`

**Certification reviewer decision:** `accepted`

**Certification unresolved prompts:** `none`

**Certification capability:** `standards`

**Certification descriptor version:** `0.4.0`

**Certification behavior-contract digest:** `sha256:8733f70cdc64134232912c691c6922b27defb8cb7c2871faa334cfad2b394643`

**Certification evidence revision:** `416e2c2441978ac86f3a17dee96a694141033e20`

**Passed certification outcomes:** `fresh-scaffold`

**Reviewed certification outcomes:** `fresh-scaffold`

This is an accepted content-safe receipt. It records accepted local evidence and the separately approved registry transition for the exact subject.

## Subject and source identity

- Exact subject: `standards@0.4.0`, behavior-contract digest `sha256:8733f70cdc64134232912c691c6922b27defb8cb7c2871faa334cfad2b394643`.
- Builder evidence revision: `416e2c2441978ac86f3a17dee96a694141033e20`.
- Accepted Task 8 main: `8e5f376f32a95f87420fd82a61566c08c2db020e`.
- Recipe: `portfolio@0.10.0`.
- Evidence kind: `fresh-scaffold`.

## Fresh-scaffold outcome

The exact evidence revision ran `pnpm run verify:generated-testing-certification` after a root frozen install in the exact pinned Linux/amd64 Playwright image with Node `22.23.2`, pnpm `11.20.0`, and `1g` shared memory. The command exited `0`.

The existing compiled CLI created a disposable absent-destination `portfolio`, installed exact `standards@0.4.0` and recipe `0.10.0`, confirmed inference, returned healthy doctor output with no diagnostics, and returned exact diff equality with no differences. The fixed generated-project verifier then passed, in order: pnpm version, frozen install, peer dependencies, dependency audit, registry signatures, lint, Cloudflare types, typecheck, unit tests, component tests, Next build, OpenNext build, browser install, development browser, workerd preview browser, and deterministic visual regression.

The deterministic comparison used the committed portfolio desktop and mobile Chromium/Linux PNG baselines against prepared OpenNext/workerd output. It did not update baseline bytes.

Result: `passed`; human acceptance: `accepted`.

## Cleanup and privacy exclusions

The runner removed its fresh project and fixed-verifier owner roots. No visual failure-artifact root existed after success. The worktree and tracked bytes of the exact source revision remained unchanged; only disposable install and build outputs existed in the task-owned source copy.

No secret or credential value, child-process output, generated project source, browser profile, registry token, environment value, private URL, machine-specific path, raw registry response, or raw log is retained here.

## Claim boundary

This receipt can support only the exact local fresh-scaffold subject, revision, recipe, pinned execution environment, and twenty ordered checks after explicit acceptance. Screenshot equality establishes only selected-pixel equality for the committed portfolio baselines in that environment.

It does not establish visual or design quality, human accessibility, assistive-technology usability, WCAG conformance, deployed behavior, ongoing provider availability, production readiness, performance budgets, security clearance, privacy completeness, or real-client readiness. No deployment, provider read or mutation, workflow dispatch, publication, analytics, browser storage, persistent-data action, P3 work, push, pull request, merge, or external message is part of this outcome.

## Reviewer decision

- `fresh-scaffold` evidence accepted: `yes`
- Exact subject, revision, recipe, and twenty-check binding accepted: `yes`
- Privacy exclusions and claim boundary accepted: `yes`
- Registry transition separately approved: `yes`
- Review revision: `416e2c2441978ac86f3a17dee96a694141033e20`
- Rerun trigger: a material descriptor, behavior contract, runner, shared engine, verifier, dependency, generated output, baseline, or evidence defect requires a new clean evidence revision and complete rerun
