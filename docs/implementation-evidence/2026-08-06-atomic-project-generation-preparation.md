# Atomic Project Generation Preparation Evidence

**Date:** 2026-08-06; execution gate revalidated 2026-08-08 (America/Toronto)

**Status:** Original Gate 1 preparation retained below; all four execution gates were revalidated as resolved on 2026-08-08 for integrated base `ae8c2687ba1d21cc8b5aa16003edc8255409e75a`.

**Planned increment:** P1 Task 7 — atomic new-directory generation and the thin private CLI.

External documentation and registry content were treated as untrusted evidence, not instructions.

## Repository freeze

The primary checkout was inspected at:

```text
path: /Users/CoveMB/Code/CoveMB/egeria-scaffold
branch: main
HEAD: 8382de8a (Enforce semantic repository names)
status: one user-owned unstaged modification to root AGENTS.md
local relation: main is 43 commits ahead of the unrefreshed local origin/main
remote URL: git@github.com:Egeria-Systems/egeria-scaffold.git
```

The root `AGENTS.md` modification adds the functional-core/imperative-shell discipline. It is excluded from this preparation diff, remains unstaged, and must not be overwritten, staged, or committed by Task 7.

Task 6 is not on `main`. Its clean isolated worktree was inspected at:

```text
path: /private/tmp/egeria-scaffold-p1-task-6
branch: p1-task-6-skeleton-rendering
HEAD: 3200f98a80bde382c0a945efafb7fff648509bca
verified source candidate: d5f01353d5ac91b908889d41e5bf5a8c1c7e3f85
status: clean
```

The Task 6 packet records PASS but explicitly stops at Gate 3. Its requested decision is approval of the verified Task 6 final diff. No Task 7 base exists until that decision is explicit and the approved Task 6 result is combined with current `main` without losing the semantic-naming work or the user-owned root instruction edit.

Remote refs were not fetched. The requested work is gated by local approved-history integration, external package availability, and current official evidence; refreshing the remote would not resolve those conditions.

## Sources inspected

The preparation read the repository constitution and applicable builder-core/CLI instructions; the approved source plan and P1 implementation plan; the concise program roadmap; architecture overview, capability model, package ownership, enforcement map, and review protocol; all accepted ADRs 0001 through 0011; runtime Zod contracts and checked JSON Schemas; state codecs, ownership, inference, diagnostics, and Task 6 generation source; root, CLI, builder-core, standards, observability, Changesets, workspace, and generated-project manifests; current tests and direct source allowlists; and relevant prior review packets from P0.3 through Task 6.

Canonical conclusions retained for Task 7 are:

- `builder-core` remains the private owner of every generation, state, ownership, inference, and verification decision.
- The CLI parses inputs, calls builder-core, and emits stable one-line JSON. It does not duplicate decisions or contain product copy.
- Only `portfolio` and `site` are executable. Generated repositories contain only `apps/web`.
- New-directory creation refuses an existing destination and never changes an existing repository, invokes Git, deploys, publishes, or calls a provider.
- Project YAML and rendered non-state files precede the lockfile and pre-state inference. The empty migration log and installed state follow successful generated-project verification. State is written last, post-state inference must agree, and only then may the source temporary directory become the destination.
- Task 7 must use real public-registry packages, a portable lockfile, frozen install, lint, typecheck, Next build, and OpenNext build. Synthetic or local tarball substitutions do not meet this contract.
- Generated build outputs and `node_modules` stay in a second builder-owned validation directory and never enter the delivered destination.

## Current implementation inputs

Task 6 returns a deterministic `RenderedSkeleton` containing the checked desired project, resolved capabilities, sorted generated files, and validated ownership descriptors. Portfolio currently returns 21 files/40 descriptors; site returns 23 files/42 descriptors. State remains absent by design.

Existing reusable owners are sufficient:

- `createCapabilityCatalog`, `profileRecipes`, `resolveCapabilities`, and `createInstalledManifest` own capability state;
- `serializeProjectYaml` and `serializeStateJson` own control-file bytes;
- `materializeInstalledSurfaces` owns fingerprints for exact files and JSON values;
- `createFileSystemRepositoryReader` plus `inferRepository`, `doctorRepository`, and `diffProject` own read-only inspection;
- `renderSkeleton` owns only in-memory source rendering.

Task 7 therefore needs an imperative filesystem/process shell and CLI adapter, not a second catalog, parser, inference algorithm, ownership implementation, generic platform service, or migration framework.

The current installed-state schema already requires this exact generation receipt:

```text
contracts
pre-state-inference
lockfile
frozen-install
lint
typecheck
next-build
opennext-build
post-state-inference
```

Task 7 adds builder-owned managed file descriptors for `.egeria/project.yaml`, `.egeria/migrations.jsonl`, and `pnpm-lock.yaml`. It must not fingerprint `state.json` into itself.

## Current official documentation and registry evidence

### Node.js filesystem, child process, and argument parsing

- The exact Node 22 filesystem documentation describes `mkdtemp` as creating a unique directory by appending random characters; temporary roots therefore use explicit builder-owned prefixes in the destination's canonical parent.
- Node documents exclusive file open mode `wx` as failing when the path exists. Task 7 uses exclusive creation for every emitted file, migration log, and state file rather than access-then-write.
- Node documents `execFile` as spawning the executable directly without a shell by default. The generated-project verifier uses argument arrays, bounded output, stable content-free failures, and no shell.
- `util.parseArgs` is stable in the accepted Node line and supports strict named options. The CLI parses each command against its own exact option set and never emits parser exception text or rejected user values.
- Node documents `cp({ recursive: true, force: false, errorOnExist: true })` as refusing existing copy targets, but a recursive copy exposes a partially materialized destination and therefore does not satisfy the approved one-rename atomic publication boundary.
- Node documents `rename` as overwriting an existing `newPath` in applicable cases. Node 22 exposes no portable directory equivalent of Linux `renameat2(RENAME_NOREPLACE)` or macOS exclusive rename flags. This creates the no-clobber contradiction recorded below.

Official source: <https://nodejs.org/docs/v22.23.2/api/fs.html>, <https://nodejs.org/docs/v22.23.2/api/child_process.html>, and <https://nodejs.org/docs/v22.23.2/api/util.html>.

### pnpm and generated-project verification

Current pnpm 11/12 documentation confirms:

- `pnpm install --lockfile-only` updates the lockfile and may update `package.json`, while writing no `node_modules`;
- `pnpm install --frozen-lockfile` refuses a missing or stale lockfile;
- integrity mismatch is a hard failure unless the explicit `--update-checksums` bypass is used; Task 7 never uses that bypass;
- `pnpm audit` v11 uses the registry bulk advisory endpoint; and
- `pnpm audit signatures` verifies registry signatures for installed packages.

Task 7 must therefore snapshot the rendered source before lock preparation and accept exactly one new `pnpm-lock.yaml`; any manifest or other source mutation is a failure. The real integration check uses a public generated-project graph only after the two Egeria packages exist. It must not transmit the current private workspace dependency graph without separate sensitive-egress approval.

Official source: <https://pnpm.io/cli/install> and <https://pnpm.io/cli/audit>.

### Next.js, OpenNext, and Cloudflare

Current OpenNext and Cloudflare guidance continues to use `next build`, `opennextjs-cloudflare build`, `nodejs_compat`, `.open-next/worker.js`, and `.open-next/assets`. OpenNext `1.20.2` requires Next `>=16.2.11` on the 16.x line and Wrangler `^4.86.0`; selected Next `16.3.0` and Wrangler `4.118.0` satisfy those peers. Task 7 builds locally only: it does not preview, run workerd, upload, or deploy.

Official source: <https://opennext.js.org/cloudflare/get-started> and <https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/>.

### Exact public dependency metadata

Read-only npm registry checks on 2026-08-06 confirmed that every already-selected generated dependency exists at its exact version and reports compatible direct engines/peers: OpenNext Cloudflare `1.20.2`, Next and eslint-config-next `16.3.0`, React/React DOM `19.2.8`, YAML `2.9.0`, TypeScript `6.0.3`, typescript-eslint `8.66.0`, ESLint `9.39.5`, Wrangler `4.118.0`, and the exact `@types/*` packages. pnpm `11.20.0` exists and requires Node `>=22.13`.

GitHub Advisory Database exact-version queries returned an empty result for each of those direct package versions and for pnpm `11.20.0`. This is direct-package dated evidence only; it does not clear a future transitive generated lock graph.

The attempted current private-workspace `pnpm audit --audit-level moderate` was not authorized because it would transmit the private repository dependency graph to the external npm advisory endpoint. No workaround was used. The post-publication Task 7 integration plan instead audits the public generated-project lockfile with explicit approval.

## Security-currentness evidence

The accepted repository and generated-project pin is Node `22.23.0`. The official Node `22.23.2` release dated 2026-07-29 fixes three HIGH, four MEDIUM, and three LOW vulnerabilities, including HTTP/2 and permission-model defects. `22.23.0` is therefore not security-current.

Official source: <https://nodejs.org/en/blog/release/v22.23.2>.

Task 6 already recorded that a separately approved runtime-pin compatibility increment is required before P1 closure or any current-security/release claim. Task 7 would create real repositories and installed-state compatibility records containing the stale pin. The recommended order is to complete the bounded `22.23.2` compatibility update before Task 7 rather than generating immediate migration debt. The Task 7 plan does not silently change the pin.

## Public-package prerequisite evidence

The approved Task 7 prerequisite expects:

```text
@egeria-systems/standards@0.1.0
@egeria-systems/observability@0.1.0
registry: https://registry.npmjs.org/
access: public
provenance: enabled
```

Current read-only registry queries returned `E404` for both exact packages. Local manifests remain `0.0.0`, the pending Changeset requests minor releases, and no release record exists.

The repository is currently private according to the connected GitHub repository metadata. No `LICENSE`, `COPYING`, or `NOTICE` file exists, and neither public package manifest declares `license` or `repository` metadata.

Current npm provenance documentation requires a supported cloud-hosted CI runner and a public `repository` entry matching the publishing source. It also explains that provenance links package bytes to public source/build instructions but does not prove code safety. The present private repository and manifests cannot satisfy that prerequisite as written.

Official source: <https://docs.npmjs.com/generating-provenance-statements/>.

Publication, repository visibility, licensing, trusted-publisher configuration, credentials, package versioning, and registry mutation are external decisions and actions. None is authorized by this Task 7 preparation.

## Selected Task 7 design

The exact-file plan selects a functional core with two imperative shells:

1. `write-generated-project.ts` composes existing pure owners, writes only inside a builder-owned source temporary directory, validates pre/post inference, materializes state last, and performs the final destination operation.
2. `verify-generated-project.ts` owns direct no-shell pnpm execution and a second builder-owned validation copy. It uses a minimal temporary home/store, does not inherit token-like environment variables, never returns child output, and deletes only identity-verified directories it created.
3. `apps/cli` owns strict argument parsing, dependency construction, stable JSON mapping, and process exit status only.

`generateProject` accepts profile, project name, and display name without caller-supplied package versions. It injects the separately verified immutable catalog internally before calling the still-generic in-memory renderer. This makes the release record, not a CLI/user value, authoritative for installed public packages.

The current project schema counts `displayName` with JavaScript UTF-16 code units. A live check rejected 120 emoji despite the approved Task 7 limit being 120 Unicode code points, and the schema currently permits embedded control characters. The exact plan resolves this directly required contradiction with one Unicode regular-expression contract that counts code points and rejects Unicode `Cc` control characters. It deliberately does not reject all `Cf` format characters because zero-width joiners are valid parts of common emoji sequences and the approved requirement is control rejection. Runtime Zod and the regenerated checked JSON Schema remain aligned; broader schema-parity review stays in Task 9.

## Atomic no-clobber approaches

Three approaches were compared:

1. **Builder-owned sibling temp plus final `lstat` and one Node `rename` — recommended only with an explicit cooperative-filesystem assumption.** This preserves the approved atomic visibility boundary and detects destinations created before the final check. Node can still overwrite in a race after that check; the implementation cannot claim hostile-concurrency no-clobber.
2. **Recursive `cp` with `force: false` and `errorOnExist: true`.** This gives portable no-overwrite copy behavior but exposes a partial destination, complicates cleanup if another actor adds content, and contradicts the approved rename-once design. Rejected unless atomic visibility is explicitly relaxed.
3. **Native exclusive rename through a platform-specific helper or addon.** This can provide real atomic no-replace semantics, but adds an unsupported native/runtime boundary and portability burden that P1 does not otherwise justify. Rejected unless hostile concurrent destination creation is in scope.

The plan keeps approach 1 conditional. Approval must explicitly accept the narrow residual race or select a different product requirement; it must not be described as a proven never-overwrite guarantee.

## Consolidated blockers and required decisions

These are the complete currently known blockers. Ordinary implementation details are resolved in the linked exact-file plan.

1. **Task 6 final-diff and integration gate:** approve the Task 6 packet and establish one clean integrated base containing `main@8382de8` and `p1-task-6-skeleton-rendering@3200f98` without losing the user-owned root instruction edit. No merge/rebase/cherry-pick is authorized by this preparation.
2. **Public-package release gate:** decide repository/source visibility and licensing, add valid public repository/license metadata, authorize and execute the separate `0.1.0` release through an approved provenance-capable authority, then record exact manifests, tarballs, integrity, provenance, signatures, install, and deprecation/recovery evidence. The two registry packages are currently absent.
3. **Node security gate:** approve and complete the separately scoped `22.23.2` compatibility increment before Task 7, or explicitly direct Task 7 to retain vulnerable `22.23.0` while accepting that no current-security or release claim is possible. The preparation recommends updating first.
4. **Atomic no-clobber contract:** accept the documented cooperative-filesystem assumption for portable Node `rename`, relax atomic visibility in favor of recursive no-clobber copy, or authorize a separately justified native exclusive-rename boundary. The preparation recommends the first only if hostile same-parent concurrent creation is out of scope.

## Scope and claim limits

The plan includes only new-directory creation and the four P1 commands. It excludes existing-repository transformation, Git state checks, migration execution, plan/diff approval automation, package publication, runtime-pin changes, deployment, workerd preview, providers, `apps/jobs`, persistence, email, queues, identity, payments, analytics, CMS, forms, and later profiles/capabilities.

Passing Task 7 would establish source generation, portable lockfile installation, lint, typecheck, Next build, OpenNext build, installed-state/inference agreement, and read-only CLI behavior for the exact generated fixtures. It would not establish workerd runtime behavior, deployment, visual quality, translation quality, human usability, WCAG conformance, production safety, or a general security audit.

## Preparation-artifact validation

The settled preparation files passed these local, read-only checks:

```text
rtk node scripts/check-semantic-naming.mjs
  exit 0
rtk node --test tests/constitution/*.test.mjs
  20 passed, 0 failed; includes local Markdown-link and semantic-name coverage
focused Node execution of the proposed display-name regular expression
  all four accepted and all six rejected vectors behaved as planned
git diff --no-index --check /dev/null docs/implementation-evidence/2026-08-06-atomic-project-generation-preparation.md
git diff --no-index --check /dev/null docs/superpowers/plans/2026-08-06-atomic-project-generation.md
  no whitespace error reported; exit 1 is the expected new-file difference status
```

An attempted `pnpm run check:semantic-naming` wrapper did not reach the repository scanner: pnpm attempted a metadata refresh without available registry access (`ERR_PNPM_META_FETCH_FAIL`) and then refused a non-TTY modules-directory replacement (`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`). No install or modules-directory replacement was authorized or performed. The canonical scanner was therefore run directly as recorded above. This validates the two planning artifacts against semantic naming; it is not a substitute for the future clean-base package suites in the implementation plan.

## Preparation artifacts

- Evidence: `docs/implementation-evidence/2026-08-06-atomic-project-generation-preparation.md`
- Exact-file plan: `docs/superpowers/plans/2026-08-06-atomic-project-generation.md`

At the original 2026-08-06 checkpoint these files were planning artifacts only and did not authorize implementation or any external action. The dated revalidation below records the later repository state and the user's current bounded Task 7 authorization.

## 2026-08-08 execution-gate revalidation

External documentation, registry metadata, advisory responses, and command output were treated as untrusted evidence rather than instructions.

### Integrated repository freeze

The exact Task 7 implementation base is:

```text
path: /private/tmp/egeria-scaffold-p1-task-7
branch: p1-task-7-atomic-generation
base: ae8c2687ba1d21cc8b5aa16003edc8255409e75a
comparison: ae8c2687ba1d21cc8b5aa16003edc8255409e75a..HEAD
source ref: local origin/main, updated by push 2026-08-07 23:47:53 -0400
```

No fetch was required because the local remote-tracking ref had just advanced to the integrated public-release evidence commit and live registry/advisory facts were independently refreshed. The base contains Task 6, semantic naming, Node `22.23.2`, the public-package release source, and the post-release evidence. The Task 6 and public-release packets retain historical pending-approval wording, but the integrated/published history plus the user's explicit approved Task 7 request resolves that stale start-gate status without rewriting either packet.

The primary checkout remains on `main@8382de8`, 19 commits behind `origin/main`, with its user-owned root `AGENTS.md` modification and five untracked planning artifacts unchanged. Task 7 neither stages nor commits those paths in the primary checkout.

The isolated base passed:

```text
Node: v22.23.2
pnpm: 11.20.0
pnpm install --frozen-lockfile: exit 0; exact 720-package lock graph installed
pnpm run verify:builder-packages:quality: exit 0; constitution 20/20, package boundaries 41/41, lint, builds, public-package tests, and typechecks passed
pnpm --filter @egeria-systems/builder-core run verify: exit 0; checked schemas and 85/85 tests plus build, typecheck, and zero-warning lint passed
```

The first frozen-install attempt failed only because sandbox DNS returned `ENOTFOUND`; the identical network-authorized frozen command then passed without changing the lockfile.

### Resolved prerequisite gates

1. **Task 6/base:** resolved by the integrated base and the current explicit Task 7 authorization.
2. **Public packages:** resolved with the approved bootstrap provenance exception. Anonymous npm metadata again reported exactly `0.1.0`, Apache-2.0, the expected public repository/directory, registry signatures, and the release-record integrities:
   - standards: `sha512-BmDwcX0T6KT271C4N24jCKn6ymKTqDAFpJjsG6LNpmIoTAz0xApIcqpHFl9dHOqlB2xdhdHwKYfSiELUp04E0Q==`;
   - observability: `sha512-eCTt6tNP0q2HA0wNpM1VJpZBFZqFpBDekKbno+UUKfWMG5I+KEg3bpt/fKdVO86JrKohlIM6Zo/7qzGDBpmh8g==`.
   Both immutable versions still have no npm attestation, exactly matching the approved exception. Publication occurred at `2026-08-06T22:10:51Z`; the generated `minimumReleaseAge: 1440` gate elapsed at `2026-08-07T22:10:51Z` before this execution.
3. **Runtime:** resolved. Repository manifests, state contracts/artifacts, templates, compatibility record, and the executing runtime agree on Node `22.23.2`; pnpm remains `11.20.0`.
4. **Destination race:** resolved under the user's plan-amendment preapproval. The selected implementation performs initial and immediate pre-rename absence checks plus one rename from an identity-checked sibling temporary directory. It does not claim atomic no-replace against hostile same-parent concurrency because Node documents that rename may overwrite an existing target created in the residual race window.

### Refreshed official documentation and security evidence

The following official sources were refreshed on 2026-08-08:

- Node `22.23.2` filesystem, child-process, and utility documentation: `mkdtemp` appends random characters; `wx` fails if the path exists; `execFile` defaults to no shell; `parseArgs` defaults to strict options/no positionals; and rename may overwrite an existing target. Node's `22.23.2` release remains the 2026-07-29 security release fixing three HIGH, four MEDIUM, and three LOW issues.
- pnpm install/audit documentation: lockfile-only may update the lockfile and package manifest; frozen install does not update the lockfile; integrity mismatch fails unless `--update-checksums` is explicitly used; audit uses the registry bulk-advisory endpoint; and signature audit verifies registry ECDSA signatures.
- Next.js App Router and July 2026 security guidance, the Next.js maintainer advisory index, OpenNext Cloudflare documentation, and Cloudflare's Next.js guide. OpenNext `1.20.2` currently declares Next `>=15.5.21 <16 || >=16.2.11` and Wrangler `^4.86.0`; selected Next `16.3.0` and Wrangler `4.118.0` satisfy those current peers.
- Anonymous npm metadata for every selected direct runtime/tool version. All exact versions remain present, are not marked deprecated, are signature-bearing, and are compatible with the selected Node/peer matrix.

GitHub Advisory Database exact-version queries returned no matching advisory for:

```text
next@16.3.0
react@19.2.8
react-dom@19.2.8
@opennextjs/cloudflare@1.20.2
wrangler@4.118.0
yaml@2.9.0
zod@4.4.3
typescript@6.0.3
eslint@9.39.5
eslint@10.8.0
eslint-config-next@16.3.0
typescript-eslint@8.66.0
pnpm@11.20.0
npm@12.0.2
```

This is dated direct-version evidence, not proof about the future generated transitive graph. Task 3 still owns one fresh public lockfile, frozen install, moderate-level registry audit, signature audit, Next build, and OpenNext build for both generated profiles. The Egeria bootstrap packages' missing provenance is a known accepted exception and must not be converted into a passing provenance claim.

Official sources:

- <https://nodejs.org/docs/v22.23.2/api/fs.html>
- <https://nodejs.org/docs/v22.23.2/api/child_process.html>
- <https://nodejs.org/docs/v22.23.2/api/util.html>
- <https://nodejs.org/en/blog/release/v22.23.2>
- <https://pnpm.io/cli/install>
- <https://pnpm.io/cli/audit>
- <https://nextjs.org/docs/app>
- <https://nextjs.org/blog>
- <https://github.com/vercel/next.js/security/advisories>
- <https://opennext.js.org/cloudflare>
- <https://opennext.js.org/cloudflare/cli>
- <https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/>

### Execution authorization and remaining stop gate

The user explicitly assigned Task 7, preapproved non-blocking plan amendments, and directed continuous execution until the implemented-task review. That authorization covers the bounded local Task 7 implementation, focused commits, public-registry generated-project verification, and requested read-only reviewers. It does not authorize push, pull request, merge, publication, deployment, provider mutation, production action, permission change, external message, or review-comment response.

No consolidated blocker remains. Implementation may proceed through the exact-file plan and must stop at the Task 7 verified-final-diff review packet before Task 8.
