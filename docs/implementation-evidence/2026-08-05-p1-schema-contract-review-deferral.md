# P1 schema contract review deferral

**Date:** 2026-08-05 (America/Toronto)

**Status:** two Task 1A dispositions implemented, verified, and independently reviewed; six questions remain deferred

**Source state:** clean local `main` at `d6892c0e02b9f2138c484311eed2aa6530552869` before this evidence record and plan amendment

## Purpose

Preserve the Task 1 schema field-purpose review and the subsequent bounded material-code-simplification comparison without acting on either result before the remaining P1 consumers exist. Task 9 of the approved P1 plan must re-evaluate every item against the final P1 tree before the Gate 3 packet is written.

These observations are review inputs. They are not approved defects, simplifications, schema migrations, or implementation instructions.

## Reviewed boundary

The direct audit inspected every runtime field and supporting contract under `packages/builder-core/src/contracts`, the checked Draft 2020-12 artifacts under `packages/builder-core/schemas`, the package entry point and manifest, the schema generator, the Task 1 contract tests, accepted ADRs, the capability model, and the approved P1 plan's documented Tasks 2 through 8 consumers.

The bounded material-code-simplification run froze these 17 selected files:

- `packages/builder-core/package.json`;
- all five files under `packages/builder-core/schemas`;
- `packages/builder-core/scripts/generate-json-schemas.mjs`;
- all eight files under `packages/builder-core/src/contracts`;
- `packages/builder-core/src/index.ts`; and
- `packages/builder-core/tests/contracts.test.mjs`.

It used no external reviewer or code egress and performed no repository mutation.

## Direct field-purpose audit

The direct audit found a defined purpose for the identifier/version/path/fingerprint primitives; probe variants; profile fields; desired/installed state separation; capability dependency, security, lifecycle, inference, verification, evidence, and recovery metadata; migration lineage and authorization fields; and deterministic validation-result fields.

It recorded eight questions for later review:

| Item | Original direct observation | Reason to defer |
| --- | --- | --- |
| Capability `schemaVersion` | Its `0.1.0` value appears to become installed capability `version`, while the name describes a schema-format version. | Task 2 will establish the actual catalog-to-manifest mapping. |
| Migration `outcome` | The literal `succeeded` may carry no information because the log admits only successful records. | Final codec/history consumers and persisted compatibility do not yet exist. |
| Verification `kind` | The literal `generation` may carry no information in P1. | Final generation/state and future-transition boundaries need to be traced first. |
| `capabilitySettings` | Arbitrary nested values may permit unsupported P1 configuration or accidental secret-bearing state. | Final P1 descriptors and desired-state consumers will establish whether settings exist. |
| `threatReviewLevel` | A non-empty string has a security-routing purpose but no accepted closed vocabulary. | The correct vocabulary requires an explicit security/product contract rather than reviewer invention. |
| Surface target and merge strategy | The concepts are distinct, but P1 permits only one target/strategy pairing and implements the pairing policy in two schemas. | Final ownership/materialization/inference consumers will show whether consolidation or a discriminated representation is net simpler. |
| Ejection identity | A path alone may not identify a bounded JSON-property surface safely. | P1 emits no ejections; the final surface model must be reviewed before changing the accepted format. |
| Runtime/static schema parity | Generated JSON Schemas omit several runtime custom refinements. | Preparation explicitly allowed some runtime-only refinements; Task 9 must decide whether that narrower static contract remains acceptable and documented. |

The direct audit initially suggested possible renaming, removal, tightening, or structural changes. None was implemented or approved.

## Material-code-simplification result

The local workflow recorded:

```text
run ID:
20260805-160757-b4362e75

scope hash:
8c8ee333094ed8820d682797ed52544ae22dcdea12d66f6155b9dde1ae227c4e

candidate bundle hash:
43917656e2863fbf1774b0153d9b3bd11a555e1183ebf38a15af79069fbb27ed

ledger hash:
7dfc5d466f4dc795fdf97e93753e55f7061b1a9370448c82a91e96eeab5f7c9f

controller posture:
READY
```

The architecture wave found no material behavior-preserving simplification after treating accepted ADRs and planned consumers as counterevidence. It recorded the capability-version ambiguity and runtime/static schema mismatch as non-simplification concerns.

The code/test wave proposed one low-severity candidate: give the duplicated target/merge pairing validation one internal owner while preserving the two public schema shapes. The fail-closed controller rejected that entire reviewer output because its evidence quote was not an exact substring of the frozen comparison source. The rejected claim was not repaired, re-ingested, validated, adjudicated, or accepted.

The resulting ledger contained no kept or discarded candidate groups. Gate A was not accepted and no Gate B transformation plan exists.

## Comparison and current disposition

The direct review was deliberately broader: it asked whether each field was necessary, well named, and sufficiently constrained. The material-code-simplification workflow asked whether an accepted behavior could be reduced now with a present material benefit exceeding compatibility and implementation churn.

Their results therefore do not contradict each other:

- every field has at least a plausible architectural purpose;
- the direct audit exposed questions about naming, validation, persisted meaning, and representation;
- the simplification workflow did not establish an approved behavior-preserving removal or consolidation; and
- correctness or product-vocabulary questions must not be relabeled as code bloat.

The initial user direction was to preserve all eight questions for Task 9. The later timing authorization and bounded reassessment below supersede that timing for only two pre-consumer corrections; Task 9 still revalidates all eight against actual P1 consumers.

## Pre-Task2 reassessment

The user subsequently authorized using implementation judgment to address an item now when delaying it would make later P1 work less safe or create avoidable compatibility. Reassessment against the final Task 1 tree separates two pre-consumer corrections from six questions that still need later evidence:

| Item | Timing decision | Basis |
| --- | --- | --- |
| Capability `schemaVersion` | Implemented and independently reviewed in Task 1A as capability release `version`. | Task 2 must map this value into `InstalledCapability.version`; retaining two names would cement an avoidable semantic contradiction. The descriptor schema-format version already has its `1.0.0` schema identifier. |
| `capabilitySettings` | Implemented and independently reviewed in Task 1A as a required empty map. | P1 defines no capability settings, while the prior arbitrary nested values created unsupported desired states and could not enforce the no-secrets contract. An explicit empty map preserves the accepted field without inventing later settings. |
| Migration `outcome` | Keep unchanged through P1 and re-evaluate in Task 9. | The literal makes successful-only raw JSONL records self-describing; no current maintenance or compatibility evidence establishes that deletion is beneficial. |
| Verification `kind` | Keep unchanged through P1 and re-evaluate in Task 9. | It names the verification receipt's operation and may distinguish later operations; removing it now offers little benefit. |
| `threatReviewLevel` | Defer to Task 9. | A closed security vocabulary needs an accepted product/security owner; Task 1A must not invent one. |
| Surface target and merge strategy | Defer to Task 9. | Runtime behavior is currently valid; the rejected simplification submission did not establish an accepted reduction, and Tasks 3 through 5 will provide real consumers. |
| Ejection identity | Defer to Task 9 or its later migration owner. | P1 emits no ejections, so changing the format now would be speculative. |
| Runtime/static schema parity | Defer to Task 9. | The accepted preparation record deliberately permits runtime-only cross-field refinements; the final P1 review can evaluate the actual static-schema consumers and claim wording. |

Task 1A followed `docs/superpowers/plans/2026-08-05-p1-pre-task2-schema-contract-clarifications.md`: its causal RED run failed only the descriptor-name, populated-settings, and canonical-documentation controls; GREEN passed all 24 focused tests, schema currency, typecheck, lint, all 21 package-boundary tests, and diff whitespace validation. Requirements and architecture reviewers reported no material findings. The test-evidence reviewer identified one material negative-control gap; the repaired control passed and bounded follow-up closed the finding. Task 9 still revalidates all eight recorded items against the final P1 tree, including whether the two Task 1A dispositions remained correct in actual consumers.

## Task 9 review requirements

Task 9 must:

1. re-freeze the final P1 source and trace each question through actual consumers and serialized fixtures;
2. repeat the field-purpose and behavior-preserving simplification lenses separately;
3. classify every item as `retain-as-intentional`, `clarify-contract`, `tighten-validation`, `remove-as-redundant`, or `defer-with-owner`;
4. record evidence, counterevidence, compatibility impact, and confidence;
5. create and obtain approval for a new exact-file plan before any resulting schema/source/test change; and
6. include final dispositions in the P1 verification evidence and Gate 3 review packet.

No schema, runtime source, generated artifact, test, package manifest, or lockfile changed as part of this deferral record.
