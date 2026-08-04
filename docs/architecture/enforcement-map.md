# Architecture Enforcement Map

This document is the canonical owner for mapping invariants to actual or planned gates. “Planned” means the gate does not exist yet; documentation must not describe it as passing. Phase ownership follows the [program roadmap](../roadmaps/program-roadmap.md).

| Invariant | Rule | Gate status | Automated owner | Phase |
|---|---|---|---|---|
| `INV-PROFILE-MATERIALIZATION` | Resolved installed capabilities become authoritative; no live profile inheritance | planned | `builder-core` resolver, manifest, and inference tests | P1 |
| `INV-CAPABILITY-METADATA` | Every capability declares normalized delivery, state, removal, security, ownership, inference, migration, and verification metadata | planned | `builder-core` schema and catalog contract tests | P1 |
| `INV-CLOUDFLARE-ISOLATION` | Cloudflare types and bindings remain in adapters, configuration, integration tests, and composition roots | planned | standards import restrictions and architecture tests | P0.3/P1 |
| `INV-NARROW-PORTS` | Ports are narrow and owned by consuming boundaries | planned | architecture tests plus bounded review | P4 onward |
| `INV-NO-GENERIC-PLATFORM-PORT` | No generic `PlatformService` or `ApplicationDatabase` port | planned | architecture tests plus bounded review | P4 onward |
| `INV-PACKAGE-EXTRACTION` | Public extraction requires consumers/boundary, stable API, lifecycle value, tests, ownership, migration, and cost evidence | planned | package API/release checks plus review evidence | P0.3/P10 |
| `INV-CLEAN-ISOLATED-MIGRATION` | Builder transformations require clean state and one isolated-worktree execution | planned | CLI temporary-repository integration tests | P3 |
| `INV-STATE-UPDATE-ORDER` | State records update after transformation, verification, and post-change inference | planned | transactional failure and recovery tests | P3 |
| `INV-COPY-EXTERNALIZATION` | User-visible/translatable copy comes from validated content/localization | planned | standards lint, missing/unused key, and locale parity checks | P2 |
| `INV-ACCESSIBILITY-AUTOMATION` | Generated applications run automated WCAG 2.2 AA-relevant checks | planned | axe and Playwright gates | P0.2/P2 |
| `INV-ACCESSIBILITY-CLAIMS` | Automation alone never supports a conformance claim | documented/manual review in P0.1; automated planned | bounded requirements/architecture review; release checks later | P0.1/P2 |
| `INV-ANALYTICS-SEPARATION` | Cloudflare Web Analytics and other analytics never arrive through observability | planned | capability graph and generated-configuration tests | P5B |
| `INV-DEPLOYMENT-AUTHORITY` | GitHub Actions is the sole deployment authority | planned | workflow-policy and environment checks | P0.2 |
| `INV-P0-1-NO-PREMATURE-RUNTIME` | P0.1 contains constitution files only, with no app/package/state/workflow/provider surface | actual | final-tree inspection and review packet | P0.1 |

## Updating enforcement ownership

When a planned gate is implemented, update this table in the same focused change as the executable gate and its test. Record the exact command and result in implementation evidence. Passing a document-structure contract proves only structure and ownership; it does not prove prose semantics or a later runtime gate.
