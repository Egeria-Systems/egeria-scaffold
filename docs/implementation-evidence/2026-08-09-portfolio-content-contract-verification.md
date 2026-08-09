# Portfolio Content Contract Verification Evidence

**Date:** 2026-08-09 (America/Toronto)

**Status:** Implemented, independently reviewed, and ready for verified-final-diff approval

**Implementation comparison:** `5580da10eded51ceefa53a068c7ddaaddf2a2d50..3dfdffb5af46b49ac4330fd7f73b22e4fc7d2551`

The separate final artifact commit completes the plan checklist and adds this evidence plus the review packet without changing executable, template, schema, fixture, dependency, or lockfile behavior. Its exact hash is reported at handoff.

## Result

The actual production builder now generates the first bounded P2 content contract for both executable profiles:

- current `portfolio` and `site` recipes record version `0.2.0`;
- runtime profile, project, and state contracts continue to read retained `0.1.0` provenance, accept current `0.2.0`, and reject unimplemented `0.3.0`;
- `content-files` is source-generated version `0.2.0` with explicit application-owned configuration and long-form content surfaces and inference probes;
- `apps/web/content/content.config.yaml` validates exact schema version `1.0.0`, default locale `en-CA`, and supported locale list `[en-CA]`;
- `apps/web/content/en-CA/long-form/introduction.md` validates exact YAML front-matter keys `title` and `summary`, non-empty decoded strings, non-empty opaque body text, line endings, YAML safety controls, and forbidden raw or YAML-encoded controls;
- generated readers use fixed server paths and accept no caller path;
- the root layout consumes the validated default locale;
- visible sample copy remains in locale content rather than TypeScript/TSX;
- Markdown remains non-executable data and is neither rendered nor treated as MDX.

The committed production-CLI fixtures contain 27 regular files for `portfolio` and 29 for `site`. They record five/six installed capabilities and 45/47 managed surfaces respectively. Desired project state, installed state, catalog versions, inference probes, source bytes, and ownership fingerprints agree.

No package manifest, dependency, root or generated lockfile graph, public package API/version, Changeset, provider, workflow, deployment, persistent-data surface, or production system changed.

## Scope amendment

The canonical P2 list is ordered but not separately task-numbered. The user's “P2 task 1” was interpreted as the first P2 deliverable. The user preapproved plan amendments and authorized continued local execution through implementation review.

The first canonical bullet combines YAML/Markdown content with copy enforcement. This increment implements the independently reviewable content contract. Copy enforcement remains deferred to the public standards package, its canonical owner, because changing and publishing that package is a separately approval-gated external action. No project-local duplicate rule owner was introduced.

Two direct-consumer plan amendments were recorded during execution:

- the canonical diagnostic repository required the two new content-files paths;
- `tests/generated-fixtures/determinism.test.mjs` directly consumes the changed fixture contract and therefore required version and surface assertions.

## TDD evidence

### Content and recipe contract

The first focused RED ran the new compatibility, catalog, template, parser, reader, copy, and ownership expectations against the unchanged implementation:

```text
Node test name pattern across contracts, resolution, and rendering
9 tests: 1 passed, 8 failed as expected

causal failures:
- recipe `0.2.0` rejected by old literal contracts
- current recipes/catalog remained `0.1.0`
- new configuration/Markdown paths were absent
- fixed readers and parser functions were absent
- ownership remained 40/42
```

After the minimum implementation, the same focused set passed `9/9`.

The generation RED then failed `1/1` because the old exact inventory omitted the two new content files. After the generation contract update, the focused state-last generation test passed `1/1`, including current recipe/content versions and 45/47 surfaces.

The first full builder-core GREEN attempt passed `103/104` and exposed one current-catalog test consumer: the canonical diagnostic repository omitted the new probe paths. Adding only those two source entries made the focused diagnostic test pass `1/1`, builder-core pass `104/104`, and package boundaries pass `39/39`.

### Fixture contract

The updated fixture contract failed against the old committed trees with the expected inventory mismatch. A sandboxed production generation also failed during lockfile preparation because the verifier's minimal child environment could not reach the registry; the sanitized result was `LOCKFILE_PREPARATION_FAILED` with `source-changed`. A controlled disposable reproduction with registry access showed that exact pnpm `11.20.0` added only `pnpm-lock.yaml` and changed no source byte.

With permitted registry access, the production CLI generated and verified two fresh copies of each profile. Both pairs were byte-identical. The committed-fixture suite then passed `7/7` and reported:

```text
portfolio: 27 byte-stable files
site: 29 byte-stable files
```

### Requirements-review repair

Requirements review reproduced a real bypass: raw Markdown controls were rejected, but YAML escapes such as `title: "\0"` and `summary: "\u007f"` decoded after that check and were accepted.

The causal regression test failed `0/1` with “Missing expected exception.” The minimum repair reused the existing control predicate when validating decoded content strings. The focused parser test then passed `1/1`. Production CLI generation and isolated builds passed for both profiles; comparison with the prior fixtures showed only the expected parser bytes and derived state fingerprints changed. Builder-core passed `104/104`, and fixture inspection passed `6/6` before final aggregate verification.

The same requirements reviewer verified the encoded-control and exact-file-scope findings as closed.

## Independent review dispositions

| Review | Finding | Disposition |
| --- | --- | --- |
| Requirements | YAML-encoded NUL/DEL bypassed the raw Markdown control check | CLOSED in `3dfdffb`; causal RED, decoded-string validation, regenerated exact fixtures/fingerprints, focused GREEN, production generation/builds, and independent re-review |
| Requirements | Direct fixture determinism test was absent from the plan's exact-file inventory | CLOSED in `33701c9`; exact consumer and rationale recorded before the repair |
| Architecture and anti-overengineering | No material improvement recommended | CLOSED; private source-generated boundary, fixed I/O shell, pure parser, versioning, ownership, dependency, and deferral decisions accepted |
| Test evidence | No material improvement recommended on clean repaired HEAD | CLOSED; reviewer confirmed parser/fixture byte identity and fingerprint agreement and required the final aggregate before post-repair build claims |
| Requirements re-review | Both findings closed; no repair-caused material defect | PASS |

All reviewers were read-only. They made no repository or external mutation and spawned no further agents.

## Final verification

The final executable/template/fixture aggregate ran once at `3dfdffb5af46b49ac4330fd7f73b22e4fc7d2551` with `CI=true`, Node `22.23.2`, and pnpm `11.20.0`:

```text
CI=true volta run --node 22.23.2 --pnpm 11.20.0 pnpm run verify:builder-kernel
```

| Gate | Result |
| --- | --- |
| Constitution and semantic naming | PASS; 21/21 |
| Package boundaries | PASS; 39/39 |
| Private builder-core | PASS; build plus 104/104 tests |
| Thin CLI | PASS; build plus 9/9 tests |
| Generated fixtures | PASS; 7/7; two generations per profile; 27/29 byte-stable files |
| Builder lint | PASS; zero warnings |
| Builder build and typecheck | PASS |
| Fixed-root committed fixtures | PASS for both profiles and all nine checks |
| Changesets status | PASS; no package bump |

The fixed-root result was:

```json
{"ok":true,"profiles":["portfolio","site"],"checks":["pnpm-version","frozen-install","peer-dependencies","dependency-audit","registry-signatures","lint","typecheck","next-build","opennext-build"]}
```

Fresh final root supply-chain checks also passed:

```text
pnpm audit --audit-level moderate
No known vulnerabilities found

pnpm audit signatures
885 packages audited; 885 packages have verified registry signatures
```

Both generated fixture lockfiles remain byte-identical with SHA-256:

```text
028d52c01ccdc8f76b3beb1e764aa5ccb420981efbe45df28478bf680ce2bb11
```

The canonical template and both generated parser copies are byte-identical with SHA-256:

```text
828703cb9f90d1cf074107c5998a601756eb336c12acf25bdf138ff02f7547f5
```

Both installed-state `content-files-schema` surfaces record that exact parser fingerprint.

## Focused commits

- `cd01539` — plan the validated content increment and record preparation evidence.
- `15ec559` — add the canonical diagnostic repository to the exact test scope.
- `d6a8a39` — add versioned content contracts, templates, schemas, tests, and canonical owners.
- `f140042` — regenerate exact portfolio/site fixtures and advance fixture contracts.
- `33701c9` — record the direct fixture-test consumer and decoded-control repair scope.
- `3dfdffb` — reject YAML-encoded forbidden controls and regenerate affected fingerprints.

The separate final artifact commit records completed checklists, this evidence, and the review packet only.

## Claim limits, risks, and deferred work

- Markdown body text is parsed as opaque data. No Markdown/HTML renderer or sanitizer exists, and no raw-HTML safety claim is made.
- Copy-literal, attribute, metadata, missing-key, unused-key, locale-parity, and escape-hatch rules remain deferred to a separately versioned and approved standards-package increment.
- Only `en-CA` is implemented. Passing shape tests does not establish translation or semantic content quality.
- Determinism is proved for the exact current CLI, profiles, toolchain, registry-date policy, and fixtures; it is not independent cross-platform corroboration.
- Audits and signatures are point-in-time supply-chain evidence. Registry signatures do not prove upstream source provenance.
- Generated Next/OpenNext builds passed, but no workerd preview or deployment ran.
- No visual, performance, human-usability, accessibility-conformance, general-security, production-safety, or launch-readiness claim is made. Automated accessibility remains mandatory in a later P2 increment, and automation alone cannot support WCAG conformance.
- Bounded sections, responsive UI, Calendly, observability runtime, CI/deployment, retained real client project, and launch-scope approval remain later separately gated P2 work.
- Existing-repository mutation, migration execution, provider rollback, later profiles/capabilities, and `apps/jobs` remain out of scope.
- Remote refs were not refreshed; the approved local base equaled local `main` and local `origin/main` at preparation.

## Rollback and recovery

Use focused newest-first `git revert` commits rather than reset or history rewriting:

1. revert `3dfdffb` to withdraw the decoded-control repair and its derived fixture fingerprints;
2. revert `33701c9` to withdraw only the repair/scope record;
3. revert `f140042` to restore the previous generated fixtures and fixture contract;
4. revert `d6a8a39` to restore recipe/content capability `0.1.0`, prior templates, runtime contracts, tests, checked schemas, and direct owner documentation;
5. revert `15ec559` and `cd01539` to withdraw planning artifacts.

After any source revert, regenerate fixtures from the restored production CLI and rerun `verify:builder-kernel`. Revert the separate final artifact commit if this evidence and packet must also be withdrawn.

This increment has no persistent data, provider resource, deployment, public package release, remote Git mutation, permission change, production action, or external message to reverse. Temporary dependencies, builds, verifier copies, and disposable generated roots are non-authoritative and reproducible with the exact pinned toolchain.
