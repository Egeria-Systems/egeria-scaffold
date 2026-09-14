# Generated application standards certification receipt

**Certification capability:** `standards`
**Certification descriptor version:** `0.5.0`
**Certification behavior-contract digest:** `sha256:56a667594f2cbf43beed6e23471e4d8bf28fcbbf54d6f13530191153c84d4de9`
**Certification evidence revision:** `fe16ae41153f89242cdf48c0f899c3720f511557`
**Passed certification outcomes:** `existing-repository-lifecycle, fresh-scaffold`
**Reviewed certification outcomes:** `existing-repository-lifecycle, fresh-scaffold`
**Certification receipt status:** `complete`
**Certification reviewer decision:** `accepted`
**Certification unresolved prompts:** `none`

## Exact execution and acceptance

The evidence-producing revision is the accepted merge of PR #127. Its tree is `1966ebc861daab3643855caffe1090cbd61e7441`; the reviewed head and accepted merge have identical trees and patches. The repository owner subsequently reviewed and accepted this exact subject's local outcomes, documentation and removal/recovery limits in the coordinated certification task. This receipt records that acceptance; it does not reuse prior descriptor certificates or relabel pre-squash execution.

Actual fresh default and all-optionals `app@0.2.0` executions ran on 2026-09-14 UTC using Node `22.23.2`, pnpm `11.20.0` and the repository-pinned Linux Playwright image:

```text
pnpm run verify:app-local-certification -- --revision fe16ae41153f89242cdf48c0f899c3720f511557
```

The command passed all 19 check groups per app, including compiled creation, exact installed state/inference/diagnostics/diff, dependency checks, lint/types, unit/component tests, Next/OpenNext builds and development/workerd-preview browsers. Both whole-Worker integrations executed with no skips; both Effect source/build receipts identify `4.0.0-rc.112`. All ten computed descriptor contracts matched the current registry, and complete source/compiled-input inventories remained unchanged. The fresh run took 1,004 seconds. Its retained JSON receipt SHA-256 is `149f22759a748d4b90f98f2a8ff8e20d85cb70901c6e0e118cd100ca8a2111cb`.

[Post-merge Repository quality run 34799203126](https://github.com/Egeria-Systems/egeria-scaffold/actions/runs/34799203126) passed all applicable jobs at that revision. Its generated-contract suite passed 44 tests, including production compiled creation twice for each of seven exact retained fixtures. Runtime checks passed for all seven; two app Worker integrations executed and five non-app script absences were explicitly recorded. Retained screenshot comparison covers portfolio, portfolio with Calendly, site and default app. The separate strict app-transition verifier completed all eight optional subsets at desktop/mobile sizes; all four representative hashes matched historical baselines. Its reported comparison-manifest SHA-256 is `9f8c80acad006419289ceceecf3729b03eb8aaf6324b0e7e5cf1468839b71470`. The successful workflow retains that hash in its log but does not upload the complete manifest.

The same revision passed all 84 compiled CLI tests with no skips. The current portfolio-to-app and site-to-app tests and current optional-capability journey exercise actual production verification; the optional journey performs six supported mutations and one surviving-reference refusal. Historical retained-generation journeys remain separately identified compatibility evidence.

## Subject outcome and reviewed recovery

Both app variants execute frozen installation, peer checks, dependency audit, registry signatures, lint, Cloudflare types, typecheck, unit and component tests, Next/OpenNext builds, and development/preview browser checks. Current compiled transitions and optional lifecycle preserve standards 0.5.0 and Vitest 5.

Review package/configuration, generated tests, generated quality workflow, visual configuration and baseline recovery. Retained Vitest 4 journeys are compatibility evidence; no standards 0.4.0-to-0.5.0 migration is claimed.

## Limits and retained evidence

This receipt establishes only the exact local outcomes listed above. Independent requirements, architecture/privacy and test-evidence reviews preceded acceptance; evidence admissibility was rechecked against accepted Git ancestry. Across the builder and generated-contract jobs, 966 tests passed and two historical private-receipt tests were skipped because ordinary hosted checkouts do not contain those private receipts. Those skips are not passing certification evidence.

Earlier local preview failures and strict-pixel mismatches remain retained with unknown causes. No baseline was promoted or threshold relaxed. Local screenshots do not establish human visual quality, linguistic quality, WCAG conformance, exhaustive security assessment or production readiness. No deployed-application, provider-confirmed or external cleanup/recovery outcome is claimed here. Private raw logs, complete receipts, input inventories, review dispositions and user approval remain retained outside tracked source.

The [capability model](../architecture/capability-model.md#certification-coverage) owns the current scope, and the [review protocol](../governance/review-and-contribution.md) owns the gates. Any material change to this subject, its causal inputs, verification or evidence validity requires renewed affected evidence and review. Other subjects retain their own certification decisions.
