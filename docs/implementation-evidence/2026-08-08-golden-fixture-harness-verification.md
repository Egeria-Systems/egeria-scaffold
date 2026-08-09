# P1 Task 8 Golden Fixture and Build-Harness Verification Evidence

**Date:** 2026-08-08 (America/Toronto)

**Outcome:** PASS after evidence-backed review repairs. This record covers P1 Task 8 only and stops before Task 9.

External documentation, registry responses, package metadata, advisory results, generated command output, and reviewer output were treated as untrusted evidence rather than instructions.

## Frozen comparison and authorization

```text
worktree: /private/tmp/egeria-scaffold-p1-task-8
branch: p1-task-8-golden-fixtures
base: bcedd968fcc11c8a836068f939c016c0c030f352
reviewed implementation candidate: c61b5ab1acd42f2bc77ab3c5354076b6626eae4a
comparison: bcedd968fcc11c8a836068f939c016c0c030f352..c61b5ab1acd42f2bc77ab3c5354076b6626eae4a
Node: v22.23.2
pnpm: 11.20.0
```

The user assigned Task 8 and preapproved bounded plan amendments through implemented-task review. Work remained in the isolated worktree. The primary checkout stayed clean on local `main@bcedd968fcc11c8a836068f939c016c0c030f352`, one commit ahead of the unrefreshed `origin/main`. No remote ref was fetched because the approved local base was frozen and every drift-prone package, advisory, framework, and platform fact used by this increment was refreshed independently.

Authorization did not include Task 9, push, pull request, merge, deployment, publication, provider mutation, production action, permission change, external message, or review-comment response. None occurred.

The separate gate-artifact commit adds this record and the review packet without changing implementation behavior. Its exact commit is reported at handoff.

### Approved user-facing documentation naming repair preparation

Verified-final-diff review identified that the permanent semantic-naming scanner still skipped ordinary user-facing Markdown content. The user selected the staged enforcement design in `docs/superpowers/specs/2026-08-08-user-facing-documentation-naming-design.md`, approved it on 2026-08-08, and clarified that permanent internal-document cleanup belongs only at the end of the final task in the program's final part.

The repair was re-frozen at clean worktree commit `2ceefe9c341aad87676a6a24c046923022c18d1a` against the unchanged Task 8 base. Preparation rechecked the branch/status, recent commits, root and relevant package manifests, the five checked builder-core JSON Schemas, root and builder-core instructions, accepted ADR index, architecture overview, capability model, enforcement map, program roadmaps, review protocol, canonical Task 8 plan, current semantic scanner/tests, and this packet.

The same-day official Node `22.23.2` and pnpm `11.20.0` documentation, security-release, registry, and advisory evidence in `2026-08-08-golden-fixture-harness-preparation.md` remains current for this repair. The repair changes no tool or provider configuration, dependency, lockfile, executable generator, template, generated fixture, networked verification command, or provider surface. It therefore requires no new provider documentation, advisory query, installation, registry read, generated-project build, compatibility proof, or external action.

No blocking contradiction remains. The permanent scanner is the canonical owner; the enforcement map owns its gate mapping; the root README and contribution guide are user-facing; internal architecture/provenance content remains temporarily exempt; and the roadmap can defer permanent-document cleanup to the end of the final task in the final program part without changing current executable scope.

## Current official and package evidence

The dated [preparation record](2026-08-08-golden-fixture-harness-preparation.md) records the official Node, pnpm, Next.js, OpenNext, and Cloudflare documentation; exact registry metadata; direct-version advisory queries; package signatures; integrity values; and claim limits revalidated before implementation.

The final settled-tree live run independently refreshed the resolved-graph evidence:

- root and generated-project moderate advisory audits reported no known vulnerability;
- root and generated-project peer checks reported no issue;
- generated-project registry-signature audits passed;
- exact published `@egeria-systems/standards@0.1.0` and `@egeria-systems/observability@0.1.0` integrity checks passed;
- both bootstrap Egeria packages still have registry signatures but no attestation under the prior approved provenance exception.

Audit and signature success are point-in-time evidence. They do not establish package provenance, future registry safety, or general security.

## Implemented behavior

### Committed generated fixtures

The repository now commits exact production-CLI output for both executable profiles:

| Profile | Regular files | Installed capabilities | Managed surfaces |
| --- | ---: | ---: | ---: |
| `portfolio` | 25 | 5 | 43 |
| `site` | 27 | 6 | 45 |

Each fixture is a lightweight pnpm workspace containing `apps/web` only. Desired project configuration, installed state, empty migration history, generated surfaces, capability resolution, read-only inference, doctor, and diff agree. The fixture byte contract is pinned to LF by the scoped repository attribute `fixtures/generated/** text eol=lf`.

The two lockfiles are byte-identical and have SHA-256:

```text
f8299e645d89fc42865b7b70fdec368c7ce0dc67d4a32ad40100645dd7fe47a2
```

The supplementary tree fingerprints use this exact algorithm: recursively enumerate regular files in Unicode code-point path order, encode each file as `{path, content}` with Base64 content, serialize the array with `JSON.stringify`, and SHA-256 the serialized bytes. The exact diagnostic command was:

```text
node -e 'const fs=require("node:fs");const path=require("node:path");const crypto=require("node:crypto");for(const profile of ["portfolio","site"]){const root=path.resolve("fixtures/generated",profile);const rows=[];function walk(dir,rel){for(const e of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){const r=rel?rel+"/"+e.name:e.name;const p=path.join(dir,e.name);if(e.isDirectory())walk(p,r);else rows.push({path:r,content:fs.readFileSync(p).toString("base64")});}}walk(root,"");console.log(profile,rows.length,crypto.createHash("sha256").update(JSON.stringify(rows)).digest("hex"));}'
```

Results:

```text
portfolio 25 8940b5f8757efa9c1acd51d4057de9eff07050de7da989e23caf325a89e4ebf7
site 27 b4fed57c2acece4aebc824d7d352a66bec122ee2af5a0ca4f07f05a957c95e41
```

The normative determinism gate is stronger than these diagnostic hashes: it compares every committed path and byte against two independent compiled-CLI generations.

### Fixed-root verification harness

`verify:generated-skeletons` accepts no production fixture root, registry, package identity, command list, or environment extension. Before invoking pnpm, it verifies:

- the exact two committed inventories and only regular files/directories;
- exact root and web manifests, including script maps, engines, package manager, public registry-version dependencies, and absence of lifecycle-hook drift;
- the exact workspace policy, including the sole approved `miniflare>undici: 7.29.0` security override and lifecycle-build allowlist;
- the exact lockfile preamble/override plus rejection of local, Git, URL, and tarball source locators in keys or mapping values;
- exact versions and integrities for both public Egeria packages;
- absence of generated artifacts, credentials, provider secrets, symlinks, and local dependency sources.

The harness copies each accepted fixture to an identity-recorded temporary owner, creates an empty private home/npm configuration and separate store, invokes pnpm through no-shell argument arrays with bounded output/time and an allowlisted environment, cleans only the identity-matching owner, and confirms the committed source bytes did not change.

For each profile it runs exact pnpm version, frozen install, peer check, moderate audit, signature audit, lint, typecheck, Next build, and OpenNext Cloudflare build commands.

### Canonical enforcement

Root scripts expose `test:generated-fixtures`, `verify:generated-skeletons`, and the aggregate `verify:builder-kernel`. Canonical architecture, package ownership, roadmap, root guidance, contributor guidance, and README surfaces describe the implemented subset and its limits. The permanent semantic-naming scanner remains the single owner after a proved-equivalent temporary ESLint adapter was removed. It enumerates live tracked and non-ignored untracked paths, excludes unstaged tracked deletions, scans user-facing Markdown by default, and retains the approved internal/provenance content exemptions during implementation.

The root README and contribution guide now use stable implementation-status language rather than roadmap coordinates. The roadmap records P1 as in review, not complete; Task 9 retains the schema-contract review and final P1 Gate 3 packet. Permanent internal-document hardening is scheduled only at the end of the final task in the program's final part.

## Test-driven development evidence

Focused failing tests preceded implementation and reviewer repairs:

| Cycle | RED evidence | Minimum GREEN implementation |
| --- | --- | --- |
| Fixture determinism | Both committed fixture roots were absent | Generate exact production-CLI portfolio/site outputs; compare two generations and the committed bytes; verify inference/doctor/diff are read-only |
| Fixed verifier | Harness module and exported inspection boundary were absent | Exact inventory/source/integrity preflight, isolated no-shell command runner, bounded cleanup, source-byte recheck, and stable failures |
| Canonical wiring | Documentation and root-script assertions described the earlier state | Add aggregate scripts and update direct canonical consumers without claiming Task 9 completion |
| Semantic adapter sunset | Package-boundary assertion still required the temporary adapter | Prove permanent-scanner equivalence, remove the duplicate adapter, and retain one canonical semantic owner |
| Scanner deleted-path regression | An unstaged tracked deletion could be enumerated then fail during read | Subtract `git ls-files --deleted` from live tracked paths with focused constitution coverage |
| User-facing Markdown classification | Root and nested README, contribution, and guide paths returned `skip`, and the controlled scanner never read them | Scan `.md` content by default after exact internal/provenance, agent-instruction, generated-directory, binary, and lockfile exclusions |
| Case-insensitive Markdown extension | `docs/guides/REFERENCE.MD` returned `skip` against the first case-sensitive implementation | Normalize only the extension check to lowercase before matching `.md` |
| User-facing leakage cleanup | After classifier GREEN, the live scan reported nine exact findings across root `README.md` and `CONTRIBUTING.md` | Replace roadmap coordinates with stable implementation, capability, and approval language; keep unrelated user-facing prose unchanged |
| Direct documentation contracts | The first aggregate passed 19/21 constitution tests and exposed two stale README sequencing assertions; the first focused repair then exposed the remaining historical package-boundary assertion | Replace all three public sequencing-text assertions with stable builder-kernel status and approved package-boundary behavior while retaining constructed labels for exempt historical records |
| Review: LF portability | `git check-attr` returned `text`/`eol` unspecified for generated fixture bytes | Add scoped `.gitattributes` rule and exact `check-attr` regression |
| Review: override/execution policy | Added workspace override, changed lock override, lifecycle hook, remote manifest source, and block tarball were accepted | Validate exact manifests/workspace/lock policy before installation and document the sole approved override |
| Review closure: snapshot locator | `tslib: git+https://...` in a lockfile mapping value passed inspection | Reject forbidden source schemes in every lockfile mapping value and retain the exact mutation regression |

Two test corrections preserved existing contracts rather than changing production behavior: the determinism test aligned macOS `/var` with the CLI's existing `realpath` result, and the lockfile protocol assertion was narrowed so `excludeLinksFromLockfile` was not mistaken for a `file:` source.

## Verification receipts

### Final settled implementation candidate

The exact final aggregate command ran once after the last source-policy repair:

```text
COREPACK_HOME=/private/tmp/egeria-task-8-corepack CI=true \
  /Users/CoveMB/.volta/tools/image/node/22.23.2/bin/corepack \
  pnpm run verify:builder-kernel
```

Results:

| Gate | Result |
| --- | --- |
| Constitution and repository-local links | PASS; 21/21 |
| Package boundaries | PASS; 39/39 |
| Private builder-core | PASS; build plus 103/103 tests |
| CLI production entry | PASS; build plus 9/9 tests |
| Generated fixtures | PASS; 7/7; portfolio 25 and site 27 byte-stable files |
| Builder lint | PASS; zero warnings |
| Builder build | PASS |
| Builder typecheck | PASS |
| Live fixed-root fixture harness | PASS for both profiles and all nine checks |
| Changesets status | PASS; no package bump at patch, minor, or major |

The live harness emitted the exact content-safe result:

```json
{"ok":true,"profiles":["portfolio","site"],"checks":["pnpm-version","frozen-install","peer-dependencies","dependency-audit","registry-signatures","lint","typecheck","next-build","opennext-build"]}
```

Additional settled-input checks:

| Command | Result |
| --- | --- |
| `pnpm audit --audit-level=moderate` | PASS; no known vulnerabilities |
| `pnpm peers check` | PASS; no peer dependency issues |
| `node scripts/check-semantic-naming.mjs` | PASS |
| `git diff --check bcedd968fcc11c8a836068f939c016c0c030f352...08bca41ada747bb11b72aae9f544e0392796569e` | PASS |
| `pnpm run verify:compatibility-proof` | PASS on the earlier frozen candidate; lint/typecheck, unit 4/4, Next/OpenNext builds, Cloudflare type generation, workerd integration 1/1, development Playwright 4/4, preview Playwright 4/4 |

User-facing naming repair verification against `c61b5ab1acd42f2bc77ab3c5354076b6626eae4a`:

| Command | Result |
| --- | --- |
| `node --test tests/constitution/semantic-naming.test.mjs` | PASS; 7/7 including classification, exemptions, deterministic findings, invalid input, and live scan |
| `pnpm run check:semantic-naming` | PASS; no findings |
| `pnpm run verify:builder-packages:quality` | PASS; constitution 21/21, package boundaries 39/39, standards 14/14, observability 1/1, zero-warning builder lint, builds, and typechecks |
| `git diff --check bcedd968fcc11c8a836068f939c016c0c030f352...c61b5ab1acd42f2bc77ab3c5354076b6626eae4a` | PASS |
| `git status --short --branch` | PASS; clean `p1-task-8-golden-fixtures` |

The generated-project harness and compatibility proof were not repeated for the naming repair because it changed no executable generator, package, dependency, template, fixture, lockfile, or proof input. Their previously settled results remain the applicable evidence for those unchanged surfaces.

### Command-environment corrections

The first post-repair aggregate attempt selected the desktop fallback Node `v24.14.0` and pnpm `11.16.0`; the manifest rejected them with `ERR_PNPM_UNSUPPORTED_ENGINE` before tests. The corrected run used the exact Node `22.23.2` Corepack entry and downloaded pinned pnpm `11.20.0` into a task-scoped temporary cache.

The user-facing naming repair's first aggregate invocation again exposed the desktop fallback through pnpm's dependency-status subprocess despite an exact outer binary. `volta run --node 22.23.2 --pnpm 11.20.0` corrected subprocess resolution; its first noninteractive run then stopped before tests with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`. The settled command added the already-required `CI=true` and passed with exact Node `22.23.2` and pnpm `11.20.0`. These stopped attempts changed no repository file.

One sandboxed generated-fixture attempt could not resolve `registry.npmjs.org`; lockfile preparation consequently returned the stable `LOCKFILE_PREPARATION_FAILED` / `source-changed` result because the permitted lockfile was never created. A disposable reproduction confirmed that no other source changed. The identical network-authorized exact-toolchain command then passed 7/7. These environment corrections do not replace the final settled-tree aggregate evidence above.

## Independent review and dispositions

Three independent read-only lanes reviewed the same frozen candidate. All material findings were validated, repaired with focused RED/GREEN cycles, and rechecked by their finding owners.

| Lane | Material finding | Disposition |
| --- | --- | --- |
| Requirements | The plan promised override rejection while the intentional security override was neither allowlisted nor mutation-tested | Accepted; exact sole override/workspace/lock policy and regressions added in `4ec29b8`; closure: CLOSED |
| Architecture and anti-overengineering | Fixture checkout bytes were not protected from Git EOL conversion | Accepted; scoped LF attribute and `check-attr` regression added in `4ec29b8`; closure: CLOSED |
| Architecture and anti-overengineering | Pre-install validation overstated source-policy enforcement and then missed a Git locator in a snapshot mapping value | Accepted; exact manifests/workspace policy plus source/tarball checks added in `4ec29b8`, mapping-value bypass repaired in `08bca41`; closure: CLOSED |
| Test evidence | Override-policy regression coverage was missing | Accepted as the same requirements defect; added/retargeted override regressions in `4ec29b8`; closure: CLOSED |

The approved user-facing naming repair was then reviewed independently against frozen candidate `c61b5ab1acd42f2bc77ab3c5354076b6626eae4a`:

| Lane | Result | Disposition |
| --- | --- | --- |
| Requirements | No material improvement recommended; approved scope, every exemption category, stable public status language, and final-program timing agree | CLOSED |
| Architecture and anti-overengineering | No material improvement recommended; staged classifier, canonical owners, and later-stage boundary agree without duplicate machinery | CLOSED |
| Test evidence | No material finding; RED/GREEN causality, controlled scanning, live scan, direct consumers, and proportional commands are credible | CLOSED |

No material finding remains. Reviewers were read-only and performed no repository or external mutation.

## Claim limits, risks, and deferred work

- Repeated generation proves byte determinism for the selected profiles and current exact toolchain, not independent cross-platform implementation equivalence.
- Public registry metadata, audit, peer, signature, integrity, install, and build results are point-in-time evidence. Signatures do not prove source provenance; the two bootstrap packages still have no attestations.
- Generated Next and OpenNext builds passed. The compatibility proof separately passed local workerd checks, but the generated fixtures were not previewed under workerd or deployed.
- Semantic scanning proves only the canonical grammar over classified paths. It does not prove documentation quality, completeness, conceptual-synonym coverage, or cleanliness of the intentionally exempt internal/provenance documents.
- No production, visual, translation, human-usability, accessibility-conformance, penetration, or general-security claim is made.
- Only the P1 `portfolio` and `site` fixtures are implemented. Existing-repository mutation, applied migrations, later profiles/capabilities, persistence, email, jobs, identity, payments, analytics, CMS, forms, and `apps/jobs` remain deferred.
- Remote refs were not refreshed. The scope uses the explicitly frozen local base and independently refreshed external facts.

## Recovery

All Task 8 effects are local source commits. Full recovery is a focused newest-first revert of `c61b5ab`, `19ca160`, `57cd737`, `2ceefe9`, `3391e6e`, `f81cd7a`, `08bca41`, `4ec29b8`, `db8ff9d`, `79735f2`, `8238e0e`, and `b044709`, followed by `verify:builder-kernel`. Revert the final gate-artifact commit separately if this record and packet must be withdrawn. To withdraw only the user-facing naming repair, revert `c61b5ab`, `19ca160`, `57cd737`, `2ceefe9`, and `3391e6e` newest-first, then rerun semantic naming and the builder-package quality gate.

The harness writes only to identity-recorded temporary directories and verified no source-byte mutation. No persistent data, provider resource, deployment, publication, Git remote, or production state was created or changed, so no external recovery is required.

## Gate

The implementation, current live evidence, deterministic checks, and independent review closures satisfy the P1 Task 8 review checkpoint for the exact comparison. Approval is requested only for the verified final Task 8 diff reported at handoff. Task 9 must not begin until that approval is explicit.

## Task 9 Gate 3 extension

The preceding Task 8 gate is retained as historical evidence. After its explicit approval, Task 9 used the same isolated worktree and reviewed the exact local comparison `8a503f5e6dceec59330412084c8b014ca287e43b..fea12f9c874d938bd029d31bc0f0fb7809359ee5`. Remote refs were not refreshed because the user froze the local Task 8 worktree/base and remote state did not affect this comparison. Current official schema, Node, pnpm, registry, and advisory evidence is recorded in [the final schema-contract review](2026-08-05-p1-schema-contract-review-deferral.md).

### Settled Task 9 behavior

Task 9 re-evaluated all eight deferred schema questions against the final catalog, resolution, codec, ownership, inference, diagnostics, generation, CLI, and fixture consumers. It retained the settled serialized shapes, assigned unresolved security vocabulary and ejection identity to explicit later owners, and documented runtime Zod as the complete-validation authority.

Two behavior-preserving consolidations removed duplicated internal policy without changing public or serialized contracts: the generated-project verifier now owns one frozen six-check receipt, and one private callback owns the two valid surface target/merge pairings while both Zod trust boundaries remain independent. A final reviewer then reproduced sparse-array false attestation in the exact receipt guard; the repaired comparison drives validation from the dense expected sequence so a hole reads as `undefined` and fails with the existing stable issue and cleanup behavior.

The first settled aggregate exposed time-dependent public-registry transitive drift rather than a same-run nondeterminism. The generated workspace now uses pnpm `resolutionMode: time-based`, the fixed-root verifier requires that exact policy, and both fixtures were regenerated only through the production CLI. The final lockfiles are byte-identical with SHA-256:

```text
028d52c01ccdc8f76b3beb1e764aa5ccb420981efbe45df28478bf680ce2bb11
```

Final diagnostic tree hashes are:

```text
portfolio 25 c604de54d60aefe4b3bea30530ea681891f39732ceee9f23b73e23438fa7a742
site      27 0280a733e5f38eb43363fc517e9e164b78a6c054b6e5ee8bf271341dea4b3ec0
```

Portfolio retains five installed capabilities and 43 managed surfaces; site retains six and 45. Both persist the distinct nine-value installed-state verification sequence. Manifest, state, confirmed inference, healthy doctor, and equal diff agree for both profiles.

### Final verification receipts

The full `verify:builder-kernel` aggregate ran once on the final executable, template, fixture, and dependency inputs at `eff2d595b59ae845cc3ea68c37e126703f960013` using exact Node `22.23.2`, pnpm `11.20.0`, and `CI=true`.

| Gate | Result |
| --- | --- |
| Constitution and repository-local links | PASS; 21/21 |
| Package boundaries | PASS; 39/39 |
| Private builder-core | PASS; build plus 104/104 tests |
| CLI production entry | PASS; build plus 9/9 tests |
| Generated fixtures | PASS; 7/7; two fresh generations per profile; portfolio 25 and site 27 byte-stable files |
| Builder lint | PASS; zero warnings |
| Builder build and typecheck | PASS |
| Live fixed-root fixture harness | PASS for both profiles and all nine checks |
| Changesets status | PASS; no package bump |

The harness emitted:

```json
{"ok":true,"profiles":["portfolio","site"],"checks":["pnpm-version","frozen-install","peer-dependencies","dependency-audit","registry-signatures","lint","typecheck","next-build","opennext-build"]}
```

The first sandboxed aggregate could not resolve `registry.npmjs.org`; lockfile preparation sanitized that environment failure as `LOCKFILE_PREPARATION_FAILED` / `source-changed`. A disposable before/after snapshot proved the source trees byte-identical. The identical network-permitted exact-toolchain aggregate then passed. This correction is environment evidence, not a replacement implementation.

Commit `fea12f9c874d938bd029d31bc0f0fb7809359ee5` changed documentation only after that aggregate. The generated-project harness, dependency checks, builds, and compatibility proof were not repeated because none of their source, template, fixture, manifest, lockfile, schema, dependency, or proof inputs changed. Proportional final checks passed the two material-review documentary contracts, the focused runtime surface-pairing contract, constitution 21/21, semantic naming, exact three-path repair scope, and `git diff --check`.

### Final independent review

The exact repaired implementation received separate read-only requirements, architecture/anti-overengineering, and test-evidence review. Requirements and architecture reported “No material improvements recommended.” Test-evidence review found the sparse-receipt defect; after its focused RED/GREEN repair, the final test-evidence conclusion was also “No material improvements recommended.”

The full material-code-review workflow used 22 assignment-matched reviewer artifacts, eight candidates, independent validation, adjudication, separate Gate A and Gate B receipts, checkpointed repairs, final-state test refreshes, and independent post-fix verification. It resolved the bounded Gate 2 disposition record and the reversed static/runtime acceptance wording, found no repair-caused regression, and completed with verdict `pass`, repair round zero, and verification hash `5ff6b265db724dcd04c0369e5a3bb1bb26f85de2f8c6e59480beed44be4b754c`.

### Gate 3 claim limits and recovery

This evidence establishes the final P1 builder-kernel contracts and exact local generated-fixture verification. It does not prove deployment, future registry safety, package provenance, workerd behavior for generated fixtures, visual or translation quality, human usability, accessibility conformance, penetration resistance, or general production security. No WCAG conformance claim is made.

Task 9 created no provider resource, persistent data, deployment, publication, Git remote change, permission change, or production action. Source recovery is a focused newest-first revert of Task 9 commits; the separate final gate-artifact commit can be reverted independently. Generated outputs can be rebuilt from the approved templates and production CLI. Dependency/build artifacts remain non-authoritative and can be reinstalled or rebuilt with the exact pinned toolchain. Provider and persistent-data rollback are not applicable.

The resulting [P1 review packet](../review-packets/2026-08-05-p1-builder-kernel.md) requests verified-final-diff approval only. Until that approval is explicit, P1 remains in review.
