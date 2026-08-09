# P1 schema contract review deferral

**Date:** 2026-08-05 (America/Toronto)

**Status:** all eight recorded questions re-evaluated against the final P1 consumers; dispositions settled for Gate 3 review

**Source state:** clean local `main` at `d6892c0e02b9f2138c484311eed2aa6530552869` before this evidence record and plan amendment

## Purpose

Preserve the Task 1 schema field-purpose review and the subsequent bounded material-code-simplification comparison, then record the final Task 9 re-evaluation after the remaining P1 consumers exist. The historical sections below remain unchanged evidence; the final review is appended rather than rewriting the original observations.

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

## Final Task 9 review

### Frozen source and authorization

```text
worktree: /private/tmp/egeria-scaffold-p1-task-8
branch: p1-task-8-golden-fixtures
Task 9 base: 8a503f5e6dceec59330412084c8b014ca287e43b
initial schema-transformation candidate: e8ba4a9c5ebbfa596bed9709392e86dd4d1ed60f
settled pre-packet implementation candidate: fea12f9c874d938bd029d31bc0f0fb7809359ee5
Task 9 comparison: 8a503f5e6dceec59330412084c8b014ca287e43b..fea12f9c874d938bd029d31bc0f0fb7809359ee5
overall P1 base: 303ee9d35e19f9191948d994159f77c82c90a1ed
Node: 22.23.2
pnpm: 11.20.0
```

The user required Task 9 to build on the Task 8 worktree and approved continuous local execution through implemented-task review, including the corrected simplification Gate A and replacement Gate B plan. Remote refs were not refreshed because the approved local worktree/base was frozen and remote freshness did not affect this local comparison. No push, pull request, merge, deployment, publication, provider mutation, persistent-data action, permission change, external message, or review-comment response was authorized or performed.

Gate 2 required the repository-local exact-file plan and its approval before implementation. The factual order was source commits `77a295c` and `e8ba4a9`, repository plan amendment `cf8c48e`, then evidence commit `8acd816`. This is a bounded process deviation. The approved external controller plan preceded source mutation and mitigated scope and implementation risk, but it did not satisfy the repository-local Gate 2 prerequisite or retroactively provide the missing prerequisite-before-dependent-step control. No authority waived Gate 2 or created an exception. The later amendment preserves the canonical record and created no competing repository plan. At material-review Gate A, after this bounded interpretation was stated, the user replied `approve`: the recorded deviation is accepted for the pending Gate 3 decision only. This acceptance is not compliance, a waiver, an exception, or precedent and does not cure the chronology. Gate 3 remained unsealed through that decision.

The sealed external plan also contained one internally conflicting detail: it requested malformed-receipt assertions at `/verification` while requiring preservation of observable error behavior. Both the Task 9 baseline and settled implementation report `GENERATED_VERIFICATION_INVALID` at the root path `[]`, and the characterization test fixes that issue path together with `checks-mismatch` for malformed, missing, additional, and reordered receipts. Task 9 intentionally retained the root path as the behavior-preserving disposition. The sealed external plan, plan hash, Gate B receipt, runtime source, and test bytes remain unchanged; this recorded discrepancy is not precedent for silent plan divergence.

### Final field-purpose dispositions

The final audit traced each item through its runtime schema, catalog or codec caller, generated `.egeria` boundary, tests, checked schema artifact, and final portfolio/site fixtures. Correctness and product-vocabulary questions remained separate from behavior-preserving simplification.

| Item | Final disposition | Evidence and counterevidence | Compatibility impact | Confidence |
| --- | --- | --- | --- | --- |
| Capability release `version` | `retain-as-intentional` | The capability model and `capabilityDescriptorSchema` own a semantic release version. The six catalog descriptors supply `0.1.0`; resolution preserves it; `createInstalledManifest` projects it into installed state; inference requires installed and catalog versions to agree. The earlier `schemaVersion` name is gone, while schema-format versions retain their separate `1.0.0` fields. | Removing or renaming it would change descriptors, installed state, fixtures, manifest projection, and inference. No benefit outweighs that persisted/API migration. | High |
| Migration `outcome` | `retain-as-intentional` | ADR 0006 and `migrationRecordSchema` own successful-history semantics. Strict serializers and JSONL tests admit only `succeeded`; the literal makes each raw append-only record self-describing and fail-closed if a non-success record is presented. P1 writes an empty log and no executor emits migration records, so broader states would be invented. | Removal would change the checked schema and successful-record JSONL contract before any evidenced consumer benefit. | High |
| Verification `kind` | `retain-as-intentional` | ADR 0006 and `installedStateSchema` own the last-successful-verification receipt. Generation binds `kind: generation`; codecs, state-last tests, and both generated fixtures preserve it. It identifies which operation produced the durable receipt even though P1 has one writer and no current reader branches on it. | Removal would rewrite committed `.egeria/state.json` fixtures and the checked state schema for negligible simplification. | High |
| Empty `capabilitySettings` | `retain-as-intentional` | ADR 0006 and `projectConfigurationSchema` own desired state. The schema requires a record whose values are `never`; rendering emits `{}`; strict YAML parsing, state ownership, generation, and fixtures preserve it. No P1 capability reads settings, so populated data would be unsupported and could become a secret-bearing ambiguity. | Relaxation would create unsupported desired states; removal would change project YAML and future compatibility. The explicit empty extension point remains safest. | High |
| `threatReviewLevel` | `defer-with-owner` | ADR 0002, the capability model, and `capabilityDescriptorSchema` own security metadata. The schema requires non-empty text and all six executable descriptors currently use `standard`; catalog and resolution tests preserve it, but no P1 policy or generation code reads it and no accepted document defines other levels. | Closing the vocabulary now would create an unevidenced security contract. The capability-model/security-review owner must define values and migration before the first differentiated executable capability. | High on deferral; vocabulary unresolved |
| Surface target and merge strategy | `retain-as-intentional` | ADR 0003 owns the evidence-selection and merge-policy distinction. Materialization and inference use `fingerprintTarget`; `mergeStrategy` is validated and persisted for its separate lifecycle role. Only `file`/`replace-file` and `json-value`/`json-property` are valid. One private `addMergeTargetIssue` callback owns that pairing, while descriptor and installed-state schemas independently invoke it with exact trust-boundary paths. | The consolidation changes no serialized shape, checked schema bytes, fixture bytes, root export, or dependency. Collapsing the fields would discard the accepted distinction and add migration churn. | High |
| Ejection identity | `defer-with-owner` | ADRs 0003 and 0006 own ejection and state semantics; P3 owns executable existing-repository mutation. Project and installed-state schemas currently store path-only arrays, generation emits only empty arrays, and P1 has no ejection executor. Multiple managed JSON properties can share one path, demonstrating insufficiency without establishing the later representation. | P3 must define bounded same-path identity, collision semantics, migration, and recovery before any non-empty record is accepted. Redesign in P1 would be speculative. | High |
| Runtime/static schema parity | `clarify-contract` | Runtime Zod schemas are authoritative; `createJsonSchemaArtifacts` owns deterministic Draft 2020-12 derivation. Runtime codecs and catalog validation use Zod, while only generation/check tests consume the static artifacts. `schema:check` proves byte currency, not equivalence to omitted custom refinements. | Manually duplicating runtime policy in JSON Schema would create a second owner and drift risk. The package README now states the broader or less restrictive static-contract acceptance boundary; consumers needing complete validation must use the runtime schemas. | High |

The first, second, third, fourth, and sixth dispositions retain existing contracts; the sixth also received one behavior-preserving internal consolidation. The fifth and seventh have explicit later owners rather than invented P1 behavior. The eighth required documentation only. No deferred item supported a schema migration, field removal, new accepted value, new capability, or generated-fixture rewrite.

### Formal material simplification

The fresh bounded run reviewed the Task 9 source/test scope separately from the field-purpose audit:

```text
run ID: 20260808-230642-838704fd
scope hash: a6406a7affe4bbe3f11a2eb426c1db1479ee246365424895761a3a0f08085b59
candidate bundle hash: a32fc9a393faa2ce64e4e2f2583c69346d965c33468b15fa3e91cb329e0cb2f2
ledger hash: 19e60c3ec11d74b11ff08b4bd52e66a3ec9166e44db7bc896b39d7e2e4594742
Gate A receipt: 9b06a0c97362a807977d9a4d4e5cd0a166b7e482c415750410ecb2f0d7af412b
approved plan hash: 3b44a1b85cf50a8ef39cf734d99e5bd62966c269ecf19b7c31b507824dc215cd
Gate B receipt: d8e8659f2fdce2af98f229e44ebb30322653cf24b7c559049b6c18a6aa6a29f8
fix summary hash: b82606b8187cced8a25fd8e625970d42423d29e80557a6d14651fc5f770d5926
post-fix verification hash: 5bba6e9a476980560f994d8855e75d24d2c9ee9ef22a97f524f03f7b9b3b94d2
controller state: COMPLETE
verdict: pass
```

Two findings were accepted and resolved:

- F001 consolidated the exact six-value generated-project verifier receipt into one internal runtime-frozen owner, retained independent unknown-value validation, used that receipt as the core of the separate nine-value installed-state sequence, and added malformed/missing/additional/reordered receipt coverage. The controller's six-check description matches the verifier source; `lastSuccessfulVerification.checks` remains the distinct persisted contract.
- F002 consolidated the valid surface target/merge matrix and exact custom issue into one private callback while keeping both Zod trust boundaries independently invoked and their serialized shapes unchanged.

The source-owner RED controls observed three receipt representations and two surface-rule implementations before the repairs. GREEN observed one owner for each policy. Focused and global receipts passed: generated-project contract 16/16, contract boundaries 12/12, private-source inventory 6/6, builder-core 104/104, package boundaries 39/39, CLI 9/9, generated-fixture determinism 7/7, typecheck, lint, semantic naming, and both-profile generated-skeleton verification. The post-fix independent verifier found both root causes resolved, no regression, and no record-only observation.

One controller incident is preserved rather than hidden. Two F001 `run-test` calls were mistakenly issued concurrently, and their evidence writes collided even though the repository checks were green. Repository files were restored, the controller's pinned-runtime rollback completed, stale temporary checkpoint directories were moved intact to `/private/tmp/egeria-task9-simplification-20260808/quarantined-after-rollback/`, and the same approved transformation was replayed sequentially. Attempt 2 and the full post-fix verification passed. The incident changed no user-owned file and does not replace the final settled-tree verification.

### Formal material review

The final full material review covered the repaired implementation comparison through `eff2d595b59ae845cc3ea68c37e126703f960013`. Its initial immutable range and repair-aligned branch scopes produced the same review patch SHA-256, `883ed5b85d7e75050578aa1443a1fcbe8a9e4ac20b43be1c78cea4dbfd66c3bb`. The controller correctly refused to mutate from the range run, so all 22 reviewer artifacts were rebound to a mutable branch-scope run. After removing only the three run-binding hashes, every candidate artifact was semantically identical; assignment, obligation, frozen-quote, and controller validation passed 22/22 with eight candidates and zero ingestion rejection.

```text
run ID: 20260809-202521-6daa73b1
scope hash: ea0f8630a381fe3bb089a4fb3a293dc78552e2b90644a01f221bf0f96d9ca201
coverage plan hash: d07942c12b8ce89eea04ad22a4f7bd46c451320920a3163fa69888c31a552b30
coverage context hash: 371aa921dc01fc2e77b6f13aca3a8bb03ccd02909aee49cb44ebdcbd4c03c34e
candidate bundle hash: ba8353a0242866fab25d6bf4e10e3eea90db58c32c3138f1d1f71cc420d7e75f
ledger hash: 6b45eed71503cc14d413da81042f0a4da0509e4b05c9506a91ffd859d37226a3
Gate A receipt: f8e1e1bae1a27db77ed68bbbd36d22e18c6d34a6be3a479f5357ef8946e5f0d8
approved plan hash: ca007d477c8c69d1695f979ce4f4a04f24d97428c225a5826cce5624e7f2355f
Gate B receipt: aa7cbb09459702dbfc73fd76c00109fc721f1832c2759c7903a35b4b9aa566b0
fix summary hash: 26043a12cae136fbf97584788742295ceed7d96bef265d369024b992e7ca1984
post-fix verification hash: 5ff6b265db724dcd04c0369e5a3bb1bb26f85de2f8c6e59480beed44be4b754c
controller state: COMPLETE
verdict: pass
repair rounds: 0
```

The mutable Gate A receipt records the exact user statement `approve and preaprove all gates until full resolution`; the exact Gate B statement was `approve`. These receipts authorize only the hash-bound repair. They do not convert the historical Gate 2 deviation into compliance, waive policy, approve the pending Gate 3 final diff, or authorize external action.

Two findings were approved and resolved:

- F001 retained the candid chronology and recorded the user's bounded acceptance of the non-curable Gate 2 deviation for the pending Gate 3 decision only. The canonical Gate 2 rule, Git history, sealed artifacts, and absence of compliance, waiver, exception, or precedent remain explicit.
- F002 corrected the introduced acceptance-direction wording in the builder-core README and this evidence record. When conversion omits a runtime refinement, checked-schema acceptance can be broader or less restrictive than authoritative runtime Zod; complete validation still requires the runtime schemas, and no full semantic-parity claim was added.

The three discarded groups were a pre-existing static/runtime acceptance difference already accounted for by F002 and two non-fragile additional-test suggestions. The approved repair changed only this evidence record, the canonical plan, and the builder-core README. Causal pre-edit assertions failed on the absent disposition and reversed direction; Volta reported those intentional assertion exits as `126`. Retained GREEN checks, final-state refreshes, exact three-path scope, constitution 21/21, semantic naming, focused runtime surface-pairing behavior, and `git diff --check` all passed. The independent post-fix verifier hash-checked all retained logs, resolved both findings, found no fix-caused regression or record-only observation, and returned `pass`.

### Current official evidence

On 2026-08-08, the implementation revalidated the current primary sources for every runtime/tool boundary materially touched by this review:

- [Zod JSON Schema conversion](https://zod.dev/json-schema) documents `z.toJSONSchema`, Draft 2020-12 output, conversion limits, unrepresentable schemas, and override behavior. The repository uses `target: draft-2020-12` and `unrepresentable: throw`; this does not make custom refinement parity automatic.
- [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12) and its [validation specification](https://json-schema.org/draft/2020-12/json-schema-validation) remain the normative static-schema sources.
- [Node.js June 2026 security releases](https://nodejs.org/en/blog/vulnerability/june-2026-security-releases) identify `22.23.0` as the patched Node 22 release; the repository remains pinned to the later `22.23.2` line already verified in the compatibility record.
- [pnpm audit](https://pnpm.io/cli/audit) documents advisory and registry-signature checks, while [pnpm install](https://pnpm.io/cli/install) documents frozen-lockfile and script-control behavior used by the final harness.

The schema-review transformations through `e6263e26c29823932276ec5ac40eb63c83cc1b48` changed no provider API, Cloudflare binding, generated application behavior, dependency version, manifest, or lockfile. The later reproducibility repair below is a separately planned stop-gate correction. Point-in-time audits and signature checks are recorded in the final P1 verification evidence; they do not prove future dependency safety or source provenance.

### Generated-fixture reproducibility repair preparation

**Date:** 2026-08-09 (America/Toronto)

The first settled Task 9 aggregate at clean candidate `e6263e26c29823932276ec5ac40eb63c83cc1b48` passed constitution 21/21, package boundaries 39/39, builder-core 104/104, and CLI 9/9 before the generated-fixture suite stopped at 6/7. Its determinism test generated two identical fresh outputs per profile, but the fresh output differed from the committed fixture in `pnpm-lock.yaml` and the lockfile fingerprint stored in `.egeria/state.json`.

The failure was reproducible outside the test owner. The committed lockfile SHA-256 was `f8299e645d89fc42865b7b70fdec368c7ce0dc67d4a32ad40100645dd7fe47a2`; default fresh resolution produced `385107c190289a6028aefa56074e306f482ba58eb3415551b97dcf5a3a4dc00d`. The default fresh graph selected `browserslist@4.28.8` / `baseline-browser-mapping@2.11.13`, while the committed graph retained `browserslist@4.28.7` / `baseline-browser-mapping@2.11.12`. No Task 9 commit changed a generated manifest, direct package version, workspace policy, lockfile-preparation command, template dependency, or fixture, so the cause was public-registry transitive-version drift rather than the receipt or managed-surface transformations.

Current official pnpm documentation was revalidated before selecting a repair:

- [Settings](https://pnpm.io/settings) confirms that project configuration belongs in `pnpm-workspace.yaml`.
- [Other settings: `resolutionMode`](https://pnpm.io/settings/other#resolutionmode) documents `time-based`: direct dependencies resolve to their lowest matching versions and subdependencies are limited to versions published before the latest direct dependency, so subdependencies update when direct dependencies update. It also documents the full-metadata performance tradeoff.
- [`pnpm install`](https://pnpm.io/cli/install) documents that `--lockfile-only` updates the lockfile without writing `node_modules`, while `--frozen-lockfile` leaves the lockfile unchanged and fails when it needs an update.
- [`pnpm audit`](https://pnpm.io/cli/audit) documents advisory queries and severity filtering used in the disposable verification.

A disposable, non-repository experiment added only `resolutionMode: time-based` to one generated workspace and resolved its lockfile twice from absent state with exact Node `22.23.2` and pnpm `11.20.0`. Both runs produced byte-identical SHA-256 `028d52c01ccdc8f76b3beb1e764aa5ccb420981efbe45df28478bf680ce2bb11`. Compared with the prior committed graph, the policy selected three older compatible transitive versions and added pnpm's `time` metadata. Frozen install passed, `pnpm audit --audit-level high` reported no known vulnerability, and the generated project passed zero-warning lint, typecheck, Next `16.3.0` build, and OpenNext Cloudflare `1.20.2` build. The first sandboxed verification attempt failed only because `next typegen` could not open a loopback helper port (`listen EPERM 127.0.0.1`); the identical permission-corrected command passed.

Alternatives were rejected provisionally: merely refreshing fixtures would fail again when another compatible transitive version appears; one override per drifting transitive dependency would copy package-manager resolution into builder policy; and a bundled lockfile template would add a large independently maintained artifact and bypass ordinary first-resolution behavior. The exact-file amendment in the canonical P1 plan authorizes the time-based policy, fixed-root verifier update, production-CLI regeneration of the two workspace policies, lockfiles, and derived state fingerprints, affected verification, and renewed final review. No repository source/configuration/fixture repair preceded that amendment.

### Sparse verification-receipt repair preparation

**Date:** 2026-08-09 (America/Toronto)

The independent final test-evidence reviewer reproduced a false-attestation path at candidate `088dd7a87eddb2a7500926b5bee67bffdf5fe9ee`. The generated-project writer required a six-element receipt and used `value.checks.every(...)` to compare it with the canonical tuple. JavaScript array iteration skips holes, so an injected verifier returning `{ checks: new Array(6) }` passed the guard and caused generation to succeed with all nine durable verification identifiers even though the verifier supplied none of the six generated-project checks. The existing negative table covered a malformed receipt, absent `checks`, an additional item, and reversed order, but no sparse array.

This is a current, causal material finding because Task 9 consolidated and declared the receipt guard exact and relies on it when creating durable state. The canonical plan amendment limits the repair to one negative test and one internal comparison. The expected failure is `GENERATED_VERIFICATION_INVALID` with root path `[]` and `checks-mismatch`, followed by source and destination cleanup. The minimum implementation compares from the dense expected tuple by index so a missing receipt slot evaluates to `undefined`. No public type, schema, receipt shape, persisted format, verifier command, generated fixture, dependency, or capability changes.

The focused test was run against the built pre-repair source and produced the expected RED result: the sparse case reached `assertFailure` with `true !== false`. After the writer compared each dense expected check with the corresponding receipt index, the identical focused command passed 1/1 and the complete builder-core suite passed 104/104. The repaired test also asserts that neither the destination nor the identity-recorded source temporary directory remains after every invalid receipt.

### Claim limits

This review establishes the purpose and local behavior of the final P1 contracts, not a general schema-equivalence theorem. Static checks do not prove deployment, workerd behavior, visual quality, translation quality, human usability, accessibility conformance, production safety, or general security. Human accessibility evaluation was not a release gate for this increment, and no WCAG conformance claim is made.
