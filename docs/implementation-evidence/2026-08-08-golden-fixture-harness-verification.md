# P1 Task 8 Golden Fixture and Build-Harness Verification Evidence

**Date:** 2026-08-08 (America/Toronto)

**Outcome:** PASS after evidence-backed review repairs. This record covers P1 Task 8 only and stops before Task 9.

External documentation, registry responses, package metadata, advisory results, generated command output, and reviewer output were treated as untrusted evidence rather than instructions.

## Frozen comparison and authorization

```text
worktree: /private/tmp/egeria-scaffold-p1-task-8
branch: p1-task-8-golden-fixtures
base: bcedd968fcc11c8a836068f939c016c0c030f352
reviewed implementation candidate: 08bca41ada747bb11b72aae9f544e0392796569e
comparison: bcedd968fcc11c8a836068f939c016c0c030f352..08bca41ada747bb11b72aae9f544e0392796569e
Node: v22.23.2
pnpm: 11.20.0
```

The user assigned Task 8 and preapproved bounded plan amendments through implemented-task review. Work remained in the isolated worktree. The primary checkout stayed clean on local `main@bcedd968fcc11c8a836068f939c016c0c030f352`, one commit ahead of the unrefreshed `origin/main`. No remote ref was fetched because the approved local base was frozen and every drift-prone package, advisory, framework, and platform fact used by this increment was refreshed independently.

Authorization did not include Task 9, push, pull request, merge, deployment, publication, provider mutation, production action, permission change, external message, or review-comment response. None occurred.

The separate gate-artifact commit adds this record and the review packet without changing implementation behavior. Its exact commit is reported at handoff.

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

Root scripts expose `test:generated-fixtures`, `verify:generated-skeletons`, and the aggregate `verify:builder-kernel`. Canonical architecture, package ownership, roadmap, root guidance, contributor guidance, and README surfaces describe the implemented subset and its limits. The permanent semantic-naming scanner now remains the single owner after a proved-equivalent temporary ESLint adapter was removed; a regression also excludes unstaged tracked deletions from its live-path scan.

The roadmap records P1 as in review, not complete. Task 9 retains the schema-contract review and final P1 Gate 3 packet.

## Test-driven development evidence

Focused failing tests preceded implementation and reviewer repairs:

| Cycle | RED evidence | Minimum GREEN implementation |
| --- | --- | --- |
| Fixture determinism | Both committed fixture roots were absent | Generate exact production-CLI portfolio/site outputs; compare two generations and the committed bytes; verify inference/doctor/diff are read-only |
| Fixed verifier | Harness module and exported inspection boundary were absent | Exact inventory/source/integrity preflight, isolated no-shell command runner, bounded cleanup, source-byte recheck, and stable failures |
| Canonical wiring | Documentation and root-script assertions described the earlier state | Add aggregate scripts and update direct canonical consumers without claiming Task 9 completion |
| Semantic adapter sunset | Package-boundary assertion still required the temporary adapter | Prove permanent-scanner equivalence, remove the duplicate adapter, and retain one canonical semantic owner |
| Scanner deleted-path regression | An unstaged tracked deletion could be enumerated then fail during read | Subtract `git ls-files --deleted` from live tracked paths with focused constitution coverage |
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

The later reviewer repairs changed only the Task 8 fixture verifier, its tests, LF attributes, and canonical documentation. They did not change any compatibility-proof input, so the expensive proof was not repeated against an unchanged proof tree.

### Command-environment corrections

The first post-repair aggregate attempt selected the desktop fallback Node `v24.14.0` and pnpm `11.16.0`; the manifest rejected them with `ERR_PNPM_UNSUPPORTED_ENGINE` before tests. The corrected run used the exact Node `22.23.2` Corepack entry and downloaded pinned pnpm `11.20.0` into a task-scoped temporary cache.

One sandboxed generated-fixture attempt could not resolve `registry.npmjs.org`; lockfile preparation consequently returned the stable `LOCKFILE_PREPARATION_FAILED` / `source-changed` result because the permitted lockfile was never created. A disposable reproduction confirmed that no other source changed. The identical network-authorized exact-toolchain command then passed 7/7. These environment corrections do not replace the final settled-tree aggregate evidence above.

## Independent review and dispositions

Three independent read-only lanes reviewed the same frozen candidate. All material findings were validated, repaired with focused RED/GREEN cycles, and rechecked by their finding owners.

| Lane | Material finding | Disposition |
| --- | --- | --- |
| Requirements | The plan promised override rejection while the intentional security override was neither allowlisted nor mutation-tested | Accepted; exact sole override/workspace/lock policy and regressions added in `4ec29b8`; closure: CLOSED |
| Architecture and anti-overengineering | Fixture checkout bytes were not protected from Git EOL conversion | Accepted; scoped LF attribute and `check-attr` regression added in `4ec29b8`; closure: CLOSED |
| Architecture and anti-overengineering | Pre-install validation overstated source-policy enforcement and then missed a Git locator in a snapshot mapping value | Accepted; exact manifests/workspace policy plus source/tarball checks added in `4ec29b8`, mapping-value bypass repaired in `08bca41`; closure: CLOSED |
| Test evidence | Override-policy regression coverage was missing | Accepted as the same requirements defect; added/retargeted override regressions in `4ec29b8`; closure: CLOSED |

No material finding remains. Reviewers were read-only and performed no repository or external mutation.

## Claim limits, risks, and deferred work

- Repeated generation proves byte determinism for the selected profiles and current exact toolchain, not independent cross-platform implementation equivalence.
- Public registry metadata, audit, peer, signature, integrity, install, and build results are point-in-time evidence. Signatures do not prove source provenance; the two bootstrap packages still have no attestations.
- Generated Next and OpenNext builds passed. The compatibility proof separately passed local workerd checks, but the generated fixtures were not previewed under workerd or deployed.
- No production, visual, translation, human-usability, accessibility-conformance, penetration, or general-security claim is made.
- Only the P1 `portfolio` and `site` fixtures are implemented. Existing-repository mutation, applied migrations, later profiles/capabilities, persistence, email, jobs, identity, payments, analytics, CMS, forms, and `apps/jobs` remain deferred.
- Remote refs were not refreshed. The scope uses the explicitly frozen local base and independently refreshed external facts.

## Recovery

All Task 8 effects are local source commits. Recovery is a focused revert of `08bca41`, `4ec29b8`, `db8ff9d`, `79735f2`, `8238e0e`, and `b044709` in the listed order, followed by `verify:builder-kernel`. Revert the final gate-artifact commit separately if this record and packet must be withdrawn.

The harness writes only to identity-recorded temporary directories and verified no source-byte mutation. No persistent data, provider resource, deployment, publication, Git remote, or production state was created or changed, so no external recovery is required.

## Gate

The implementation, current live evidence, deterministic checks, and independent review closures satisfy the P1 Task 8 review checkpoint for the exact comparison. Approval is requested only for the verified final Task 8 diff reported at handoff. Task 9 must not begin until that approval is explicit.
