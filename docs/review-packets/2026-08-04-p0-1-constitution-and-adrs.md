# P0.1 Constitution and ADRs Review Packet

**Recorded:** 2026-08-04

**Status:** Ready for Gate 3 verified-final-diff approval

## Scope and acceptance decision

P0.1 creates the repository constitution and a private, dependency-free root pnpm workspace. It records the approved architecture, capability vocabulary and future catalog, enforcement ownership, roadmap, contribution/review lifecycle, and ADR-0001 through ADR-0011.

The candidate satisfies the increment acceptance criteria:

- authoritative decisions are represented without an unresolved contradiction;
- future profiles and capabilities are visible without runtime implementation;
- each enforceable invariant names an actual manual/static gate or a future automated owner without overstating current enforcement;
- root `AGENTS.md` is substantive, self-contained, and establishes canonical ownership and cohesion rules;
- no application, production profile, builder/public package, dependency, lockfile, `.egeria` state/schema, workflow, binding, provider resource, or deployment was created.

## Frozen comparison

- Base: `98ff2f4054fb7c1b27a217726e40ba9f2fc5bca3`
- Independent-review candidate: `8303aeda2d25ccf1087a3af0e1b3616ccf1a20c3`
- Repaired candidate: `f10ecc21ee8eec13df988b8d99027ec3d23762dd`
- Evidence-complete candidate before this delivery packet: `1747210c6c45919dcc3101839b9ad6ad2b3bdc34`
- Branch: `main`, explicitly approved as a one-time P0.1 bootstrap exception

This packet is the final delivery-only commit on top of `1747210c`; its exact commit is reported alongside the packet at Gate 3. The approved source plan remains byte-identical to the base version with SHA-256 `f8d3f7db149f18c28ac3c6e41781405e3661c4a5ab710ee28290b184864c1027`.

No remote ref was refreshed because the preparation check found that the configured remote had no heads or tags. No push, pull request, merge, deployment, publication, provider mutation, or external message occurred.

## Changed files

Workspace and executable contracts:

- `.gitignore`
- `package.json`
- `pnpm-workspace.yaml`
- `tests/constitution/constitution.test.mjs`

Repository entry points and governance:

- `AGENTS.md`
- `CONTRIBUTING.md`
- `README.md`
- `docs/governance/review-and-contribution.md`

Architecture and roadmap:

- `docs/architecture/overview.md`
- `docs/architecture/capability-model.md`
- `docs/architecture/enforcement-map.md`
- `docs/roadmaps/program-roadmap.md`

Accepted decisions:

- `docs/adr/README.md`
- `docs/adr/0001-materialized-profile-recipes.md`
- `docs/adr/0002-capability-delivery-and-state.md`
- `docs/adr/0003-hybrid-ownership.md`
- `docs/adr/0004-cloudflare-isolation.md`
- `docs/adr/0005-evidence-driven-package-extraction.md`
- `docs/adr/0006-egeria-state-files.md`
- `docs/adr/0007-transactional-repository-migrations.md`
- `docs/adr/0008-copy-externalization.md`
- `docs/adr/0009-accessibility-evidence-and-claims.md`
- `docs/adr/0010-analytics-and-observability.md`
- `docs/adr/0011-github-actions-deployment-authority.md`

Evidence, plan, and packet:

- `docs/implementation-evidence/2026-08-04-p0-1-constitution-preparation.md`
- `docs/implementation-evidence/2026-08-04-p0-1-constitution-verification.md`
- `docs/superpowers/plans/2026-08-04-p0-1-constitution-and-adrs.md`
- `docs/review-packets/2026-08-04-p0-1-constitution-and-adrs.md`

The approved source plan at `docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md` was persisted in the base commit and not changed by the implementation range.

## Test-driven evidence

The detailed RED/GREEN record is in the [verification evidence](../implementation-evidence/2026-08-04-p0-1-constitution-verification.md). Material cycles were:

| Cycle | RED | GREEN |
|---|---|---|
| Root workspace | Missing `package.json` and `pnpm-workspace.yaml` produced two `ENOENT` failures | Private dependency-free workspace and Volta Node pin passed |
| Governance | Missing `README.md` produced focused `ENOENT` | Entry points, constitution, and governance protocol passed |
| Architecture | Missing architecture overview produced focused `ENOENT` | Architecture, capability model, enforcement map, and roadmap passed |
| ADR groups | Missing ADR index, then missing ADR-0006, produced focused `ENOENT` | All eleven accepted ADRs passed the structural contract |
| Link integrity | A real premature README directory link failed | Repository-bounded local links passed after the link became non-link guidance |
| Capability inclusion | Catalog dependency text was parsed where required profile inclusion was absent | All 24 rows passed normalized delivery/state/removal/profile contracts |
| Ignored-file boundary | A temporary ignored worktree Markdown file contaminated the old recursive scan | Git tracked/unignored discovery passed while the fixture existed; fixture removed |
| ADR authority | Negative control failed because the strict validator did not exist | Invalid authority is rejected; all real ADR documents and index rows pass |

Phrase-presence tests used during early prose authoring were removed before review because they detected wording changes rather than meaningful contracts.

## Verification commands and results

| Command | Result |
|---|---|
| `node --version` | `v22.23.0` through Volta |
| `pnpm --version` | `10.32.1` |
| `git --version` | `git version 2.50.1 (Apple Git-155)` |
| `pnpm run test:constitution` at repaired/evidence candidates | 6 passed; 0 failed, skipped, or cancelled |
| `git diff --check 98ff2f4...HEAD` | Passed before packet creation |
| Source-plan SHA-256 | Matched `f8d3f7db149f18c28ac3c6e41781405e3661c4a5ab710ee28290b184864c1027` |
| Absence checks for `apps`, `packages`, `.egeria`, `pnpm-lock.yaml`, and `.github` | All passed |
| Reviewer repair verification | All three reviewers returned READY; test-evidence reviewer independently reran 6 tests and the repair-range diff check |

The controller reruns the full suite, comparison whitespace check, source hash, absence checks, status, changed-file list, and commit range after committing this packet. Those final delivery results are reported alongside this file without mutating the approved candidate afterward.

## Independent reviewer dispositions

| Reviewer | Finding | Disposition | Repair verification |
|---|---|---|---|
| Requirements | Capability catalog omitted per-capability profile inclusion | Material-kept; added default, optional, and dependency-only inclusion plus a normalized catalog contract | READY |
| Architecture | `.egeria` state mutated after final-diff approval | Material-kept; state update and verification now precede preparation and approval of the exact final diff | READY |
| Architecture | P0.3 and P1 both claimed executable project/state schemas | Material-kept; P0.3 owns package/API boundaries and P1 owns schema/kernel implementation | READY |
| Architecture | Source-generated Calendly omitted repository state and blurred provider authority | Material-kept; classified repository state and excluded Calendly account/configuration from capability authority | READY |
| Test evidence | Markdown discovery included ignored/user-local trees and permitted outside targets | Material-kept; Git-bounded discovery and pre-access repository containment added | READY |
| Test evidence | Accessibility claim policy overstated P0.1 semantic automation | Material-kept; P0.1 is documented/manual review and release automation remains planned | READY |
| Test evidence | ADR test did not protect accepted authority or ordered non-empty decisions | Material-kept; strict document/index validator and negative control added | READY |

No reviewer reported a Critical or Minor finding. No finding was rejected, deferred, or classified as low-value churn. No additional specialist was justified for this documentation-only, dependency-free increment.

## Security and compatibility evidence

The [preparation evidence](../implementation-evidence/2026-08-04-p0-1-constitution-preparation.md) records dated official Node.js, pnpm, Next.js/OpenNext/Cloudflare, W3C, and GitHub deployment-environment sources.

Node.js `22.23.0` is the approved P0.1 development pin and contains the reviewed June 2026 fixes for the Node 22 line. This does not prove Next.js/OpenNext compatibility. No third-party package was installed and no lockfile exists, so there is no dependency graph on which a package advisory scan could provide evidence. Local pnpm 10 audit output is deliberately not used because its documented registry endpoint is retired.

P0.2 must refresh official documentation and advisories, select exact dependency versions, produce a lockfile, and prove the combination through local Next development, workerd preview, unit/integration/accessibility smoke tests, and a non-production GitHub Actions deployment.

## Risks and fragile assumptions

- The constitution is documentation plus static repository contracts. Review reduces semantic contradiction risk but does not make prose executable.
- The profile-inclusion catalog is an accepted initial policy. P1 must encode it in schemas/resolution tests and can change it only through an explicit accepted architecture decision.
- The persisted source plan contains a lifecycle sequence that updates `.egeria` state after final-diff approval. ADR-0007 explicitly resolves that conflict: state is part of the exact diff and must be updated and re-verified before final approval.
- Node.js `22.23.0` was selected by explicit user decision, but framework/adapter compatibility and the eventual pnpm version remain unproved until P0.2.
- Direct work on `main` was explicitly allowed only for this bootstrap. Permanent builder behavior and later repository-changing increments still require a clean isolated worktree unless separately approved.

## Deferred work

P0.2 owns the deployed Next.js/Cloudflare compatibility proof, exact dependencies/lockfile, generated binding types, strict TypeScript, ESLint flat configuration, Vitest, Cloudflare integration testing, Playwright/axe, workerd preview, non-production GitHub Actions deployment, and documented beta/runtime distinctions.

P0.3 owns the lean package/API boundaries: thin `apps/cli`, private `packages/builder-core`, public `packages/standards`, public observability shell, release tooling, API ownership, and accidental-publication safeguards. Executable project/state schemas and the builder kernel remain P1 work.

No P0.2 or P0.3 implementation has started.

## Rollback and recovery

P0.1 created source and documentation only. It has no deployment, provider state, persistent data, secret, package publication, or external resource to reverse.

After explicit approval, source recovery uses ordinary `git revert` commits against the named P0.1 implementation commits, newest first. The bootstrap commit `98ff2f4` remains a separately auditable copy of the approved source plan, preparation evidence, and initial plan. Do not use destructive reset/checkout operations to remove approved or user-owned history.

## Evidence limits

P0.1 does not prove Next.js/OpenNext runtime behavior, local development, workerd behavior, binding generation, TypeScript/ESLint/Vitest/Playwright/axe behavior, deployment, visual quality, translation fidelity, accessibility conformance, production safety, package publication, builder transformations, state inference, migrations, or persistent/provider rollback.

Automated accessibility gates remain mandatory for their owning phases, but no WCAG conformance claim is permitted without knowledgeable human evaluation. Human evaluation is not a default release gate unless separately required by contract, procurement, an explicit risk decision, or a conformance claim.

## Approval requested

Approve the exact final P0.1 diff presented with this packet. That approval accepts only P0.1 and closes its Gate 3 review. It does not authorize push, pull-request creation, merge, publication, deployment, provider changes, persistent-data migration, permission changes, production action, or external messaging.

Planning P0.2 is a separate next-stage authorization and should be stated explicitly if desired.
