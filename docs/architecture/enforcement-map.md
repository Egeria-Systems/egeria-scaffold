# Architecture Enforcement Map

This document is the canonical owner for mapping invariants to actual or planned gates. “Planned” means the gate does not exist yet; documentation must not describe it as passing. Phase ownership follows the [program roadmap](../roadmaps/program-roadmap.md).

| Invariant | Rule | Gate status | Automated owner | Phase |
|---|---|---|---|---|
| `INV-PROFILE-MATERIALIZATION` | Resolved installed capabilities become authoritative; no live profile inheritance | actual for deterministic resolution, installed-manifest projection, and read-only state/capability evidence; transformation-time reconciliation remains planned | `builder-core` resolver, manifest, and repository-inference tests | P1 |
| `INV-CAPABILITY-METADATA` | Every capability declares normalized delivery, state, removal, security, ownership, inference, migration, and verification metadata | actual for the six executable descriptors, pure ownership materialization, bounded probe evaluation, and valid-state surface drift evidence; remaining program catalog enforcement planned | `builder-core` schema, catalog, state-ownership, and repository-inference contract tests | P1 |
| `INV-CLOUDFLARE-ISOLATION` | Cloudflare types and bindings remain in adapters, configuration, integration tests, and composition roots | actual for the P0.2 proof and dual-major standards behavior; generated-repository gate planned | `@egeria-systems/standards/eslint/cloudflare-isolation`, `proofs/nextjs-cloudflare/eslint.config.mjs`, standards behavior tests, proof lint/typecheck, and Wrangler harness | P0.2/P0.3/P1 |
| `INV-NARROW-PORTS` | Ports are narrow and owned by consuming boundaries | planned | architecture tests plus bounded review | P4 onward |
| `INV-NO-GENERIC-PLATFORM-PORT` | No generic `PlatformService` or `ApplicationDatabase` port | planned | architecture tests plus bounded review | P4 onward |
| `INV-PACKAGE-EXTRACTION` | Public extraction requires consumers/boundary, stable API, lifecycle value, tests, ownership, migration, and cost evidence | actual for P0.3 ownership shells and APIs; later extraction reassessment planned | package-boundary manifest, API, consumer, dependency-direction, and no-premature-surface tests | P0.2/P0.3/P10 |
| `INV-PACKAGE-PUBLICATION` | Only approved public packages expose allowlisted files and APIs; local release configuration never authorizes publication | actual for local P0.3 safeguards; external publication remains separately approval-gated | public/private manifest tests, Changeset status, lifecycle-script checks, and real dry-run package manifests | P0.3 |
| `INV-CLEAN-ISOLATED-MIGRATION` | Builder transformations require clean state and one isolated-worktree execution | planned | CLI temporary-repository integration tests | P3 |
| `INV-STATE-UPDATE-ORDER` | State records update after transformation, verification, and post-change inference | planned | transactional failure and recovery tests | P3 |
| `INV-COPY-EXTERNALIZATION` | User-visible/translatable copy comes from validated content/localization | actual for P0.2 proof; generated-repository gate planned | proof parser/pure-render unit test; later standards locale gates | P0.2/P2 |
| `INV-ACCESSIBILITY-AUTOMATION` | Generated applications run automated WCAG 2.2 AA-relevant checks | actual for P0.2 proof; generated-repository gate planned | Playwright development/preview/deployed smoke suite with axe, keyboard, reflow, and motion checks | P0.2/P2 |
| `INV-ACCESSIBILITY-CLAIMS` | Automation alone never supports a conformance claim | actual for P0.2 documentation; generated release check planned | constitution compatibility-record contract plus bounded review | P0.2/P2 |
| `INV-ANALYTICS-SEPARATION` | Cloudflare Web Analytics and other analytics never arrive through observability | planned | capability graph and generated-configuration tests | P5B |
| `INV-DEPLOYMENT-AUTHORITY` | GitHub Actions is the sole deployment authority | actual for the P0.2 workflow and deployed non-production proof | constitution workflow-policy contract, manual `compatibility-proof.yml` workflow, and recorded successful deployment run | P0.2 |
| `INV-P0-1-NO-PREMATURE-RUNTIME` | P0.1 contains constitution files only, with no app/package/state/workflow/provider surface | actual | final-tree inspection and review packet | P0.1 |

The exact P0.2 matrix, command meanings, runtime distinctions, deployment evidence, and claim limits are recorded in the [Next.js and Cloudflare compatibility record](../compatibility/nextjs-cloudflare.md). Local workflow structure proves only the repository contract; the recorded successful GitHub Actions run and non-production Worker evidence establish the separate external deployment result.

## Updating enforcement ownership

When a planned gate is implemented, update this table in the same focused change as the executable gate and its test. Record the exact command and result in implementation evidence. Passing a document-structure contract proves only structure and ownership; it does not prove prose semantics or a later runtime gate.
