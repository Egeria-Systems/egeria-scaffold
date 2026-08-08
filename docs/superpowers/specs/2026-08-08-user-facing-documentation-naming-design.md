# User-Facing Documentation Naming Design

**Status:** Approved 2026-08-08, including the final-part timing clarification

## Problem

The permanent semantic-naming scanner enforces responsibility-based names across executable source, configuration, workflows, tests, templates, fixtures, generated content, and repository paths. It currently skips the content of every file below `docs/` and every ordinary `README.md`, `CONTRIBUTING.md`, and `AGENTS.md`.

That exemption is too broad for user-facing documentation. The root README and contribution guide currently contain implementation-sequencing labels even though readers need durable capability, responsibility, and current-status language rather than roadmap coordinates.

Internal architecture and implementation records still use sequencing labels as efficient provenance and lookup aids while the program is being built. Rewriting all of those records now would create high churn and reduce useful implementation routing.

## Decision

Adopt staged enforcement.

The current repair will scan user-facing Markdown content and remove existing user-facing leakage. Internal architecture, decision, governance, agent-instruction, and provenance documents remain content-exempt throughout program implementation. Only at the end of the final task in the program's final part will a permanent-documentation hardening pass clean permanent internal documentation and broaden the scanner without rewriting historical artifacts.

The canonical sequencing-label grammar does not change. The repair changes only which Markdown content is scanned.

## Immediate enforcement boundary

The scanner will treat Markdown as user-facing by default unless its path belongs to an explicit internal or provenance category.

Content must be scanned for:

- root and nested `README.md` files outside exempt internal/provenance paths;
- root and nested `CONTRIBUTING.md` files outside exempt internal/provenance paths;
- future Markdown documents outside exempt internal/provenance paths;
- existing product Markdown in templates and generated fixtures;
- all existing authored executable, configuration, workflow, test, fixture, template, generated, and root configuration content already covered by the scanner.

Content remains exempt during implementation for:

- every `AGENTS.md` instruction file;
- accepted architecture decision records under `docs/adr/`;
- permanent architecture documents under `docs/architecture/`;
- governance documents under `docs/governance/`;
- roadmaps under `docs/roadmaps/`;
- plans and specifications under `docs/superpowers/plans/` and `docs/superpowers/specs/`;
- implementation evidence under `docs/implementation-evidence/`;
- review packets under `docs/review-packets/`;
- compatibility records under `docs/compatibility/`;
- generated build directories, binary files, and dependency lockfiles already excluded for non-documentary reasons.

Path enforcement remains unchanged. Sequencing labels remain allowed in filenames only under the existing explicit provenance path prefixes. Architecture, governance, ADR, agent-instruction, README, contribution, package, application, proof, template, fixture, and generated paths must continue to use semantic names.

## User-facing cleanup

The root `README.md` will replace phase-number headings and historical phase summaries with stable responsibility and current-status language. It may link to the roadmap, compatibility record, architecture, and evidence rather than repeating their sequencing labels.

The root `CONTRIBUTING.md` will describe the builder-kernel candidate and its approval status without a phase label. Package, application, proof, template, and generated READMEs must already pass the expanded content scan; no unrelated editorial rewrite is authorized.

The repair does not prohibit ordinary non-sequencing uses such as `taskQueue`, `stageName`, version numbers, or prose where words such as “phase” are not followed by a canonical ordinal.

## Permanent internal-document cleanup

The program roadmap will add permanent documentation hardening to the end of the final task in its final part. No earlier task or part, including the final P1 review task, will inventory, clean, or expand enforcement over the exempt internal documents. At that end-of-program boundary, the hardening pass will:

- inventory sequencing labels in architecture, ADR, governance, and agent-instruction content;
- replace implementation-routing labels with stable responsibility language or precise links where the labels no longer provide necessary provenance;
- identify the smallest remaining historical/provenance content exemptions;
- extend automated scanning to cleaned permanent internal documents;
- preserve dated plans, implementation evidence, review packets, compatibility history, roadmap history, and genuinely phase-scoped invariants where sequencing remains the actual subject;
- produce focused tests, evidence, review, and a separate approval checkpoint.

Adding the future task does not authorize or begin that cleanup during the current repair.

## Scanner structure

`classifySemanticNamingPath(path)` remains the single classification boundary.

Its decision order will be explicit:

1. derive the existing path policy from provenance path prefixes;
2. skip generated directories, binary files, and lockfiles;
3. skip content in the exact internal/provenance categories above;
4. scan other Markdown, including README and contribution documents;
5. retain the existing authored-content rules for non-Markdown files.

No second scanner, parser, ESLint rule, dependency, configuration format, or policy registry will be introduced.

## Test contract

Focused tests will exercise the real classifier and scanner behavior.

RED must show that current code skips and therefore fails to report sequencing labels in:

- root `README.md`;
- a nested package README;
- root `CONTRIBUTING.md`;
- a future user-facing document such as `docs/guides/getting-started.md`.

GREEN must prove those paths are scanned while these remain content-exempt:

- `AGENTS.md`;
- `docs/adr/README.md`;
- `docs/architecture/overview.md`;
- `docs/governance/review-and-contribution.md`;
- a roadmap, plan, specification, evidence record, review packet, and compatibility record.

The existing matcher, path, content, test-description, deleted-path, invalid-UTF-8, counterexample, and repository-live-scan tests remain intact. The actual repository semantic scan must fail before the README/contribution cleanup and pass afterward.

## Canonical owners and implementation scope

The existing P1 builder-kernel plan will be amended surgically; no substitute implementation plan will be created. The enforcement map remains the canonical gate owner. Root instructions will state the user-facing documentation boundary without copying matcher grammar or path-prefix data.

Expected implementation files are limited to:

- `scripts/check-semantic-naming.mjs`;
- `tests/constitution/semantic-naming.test.mjs`;
- `README.md`;
- `CONTRIBUTING.md`;
- `AGENTS.md`;
- `docs/architecture/enforcement-map.md`;
- `docs/roadmaps/program-roadmap.md`;
- `docs/superpowers/plans/2026-08-05-p1-builder-kernel.md`;
- the current Task 8 verification evidence and review packet.

This design record is the only additional file.

## Verification and completion

The implementation will use a focused RED–GREEN–REFACTOR cycle, then run semantic naming, constitution, package-boundary, builder lint, comparison diff checks, and any direct documentation-link consumers. The expensive generated-project build harness will not be repeated unless a relevant executable, template, fixture, dependency, or harness input changes.

Completion requires the expanded repository scan to pass, current user-facing leakage to be removed, canonical owners to agree, the final hardening task to be recorded without being executed, and independent requirements, architecture/anti-overengineering, and test-evidence reviewers to have no unresolved material finding.

## Non-goals

- Cleaning architecture, ADR, governance, or agent-instruction prose now.
- Rewriting historical plans, evidence, review packets, compatibility records, or roadmap history.
- Expanding the canonical sequencing-label grammar.
- Detecting every conceptual synonym for implementation order.
- Reintroducing the deleted ESLint adapter.
- Scheduling or starting the permanent internal-document audit and cleanup before the end of the final task in the program's final part.
