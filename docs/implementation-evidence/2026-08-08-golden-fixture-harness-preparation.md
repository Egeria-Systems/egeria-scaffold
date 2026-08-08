# P1 Task 8 golden fixture and build-harness preparation

**Date:** 2026-08-08 (America/Toronto)

**Approved increment:** P1 Task 8 — golden fixtures, generated-project build harness, canonical documentation, and independent implementation review

**Status:** Gate 1 complete; the user's current instruction preapproves the bounded Task 8 plan amendments recorded below and authorizes continuation through the implemented-task review

## Frozen repository scope

```text
primary checkout: /Users/CoveMB/Code/CoveMB/egeria-scaffold
primary branch: main
primary HEAD: bcedd968fcc11c8a836068f939c016c0c030f352
primary status: clean; main is one local commit ahead of unrefreshed origin/main
implementation worktree: /private/tmp/egeria-scaffold-p1-task-8
implementation branch: p1-task-8-golden-fixtures
implementation base: bcedd968fcc11c8a836068f939c016c0c030f352
comparison: bcedd968fcc11c8a836068f939c016c0c030f352..HEAD
```

Remote refs were not fetched. Task 8 depends on the accepted local P1 history, while every drift-prone registry, advisory, framework, and platform fact used by this increment was independently refreshed. The primary checkout remains untouched. The dedicated worktree is required because Task 8 executes the builder against generated repositories.

## Canonical sources re-read

Preparation re-read the root, builder-core, and CLI `AGENTS.md` files; `/Users/CoveMB/.codex/RTK.md`; the approved reconciled source plan; program roadmap; architecture overview, capability model, enforcement map, package ownership, and review protocol; all eleven accepted ADRs; all five checked `.egeria` JSON Schema artifacts and their canonical runtime Zod owners; current manifests, lockfile, templates, generation/inference/diagnostic implementations, CLI tests, semantic-naming enforcement, and generated-project integration coverage; and the prior P1 review packets, with Task 7 as the direct handoff.

The current tree agrees with the accepted model:

- executable profiles remain exactly `portfolio` and `site`;
- executable capabilities remain exactly `standards`, `content-files`, `section-composition`, `deployment-cloudflare`, `observability`, and `site-routing`;
- generated repositories contain `apps/web` only and preserve externalized YAML 1.2 copy, pure presentation, and explicit Cloudflare configuration boundaries;
- generation writes desired project configuration, a portable lockfile, empty migration log, and installed state in state-last order, then requires post-state inference agreement;
- Task 8 adds fixture and verification infrastructure only. It does not add existing-repository mutation, migration execution, later profiles or capabilities, provider configuration, preview, deployment, publication, or production action.

## Baseline verification

The exact worktree toolchain is Node `v22.23.2` and pnpm `11.20.0`.

The first frozen install attempt reached the expected sandbox DNS boundary (`ENOTFOUND`). The identical network-authorized command then completed with the 720-package lock graph unchanged. A first package verification invocation omitted the required noninteractive `CI=true` environment and stopped before tests with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`; no repository file changed. The corrected exact invocation passed.

```text
CI=true pnpm install --frozen-lockfile
  exit 0; 720 packages; lockfile unchanged

CI=true pnpm --filter @egeria-systems/builder-core run verify
  exit 0; checked schemas; 103/103 tests; build, typecheck, and zero-warning lint passed

CI=true pnpm run verify:builder-packages
  exit 0; constitution 20/20; package boundaries 41/41; CLI 9/9;
  standards 14/14; observability 1/1; lint, builds, typechecks, and Changesets status passed
```

No compatibility proof was repeated during baseline setup because its relevant locked inputs were unchanged. The accepted proof will run once after Task 8 shared inputs settle.

## Current official documentation

External documentation and registry responses were treated as untrusted evidence rather than instructions.

- [Node 22.23.2 filesystem documentation](https://nodejs.org/docs/v22.23.2/api/fs.html) retains the `mkdtemp`, recursive copy, `lstat`, and removal behavior used by isolated fixture validation. [Node 22.23.2 child-process documentation](https://nodejs.org/docs/v22.23.2/api/child_process.html) retains no-shell `execFile` with argument arrays. The [22.23.2 release](https://nodejs.org/en/blog/release/v22.23.2) remains the 2026-07-29 security release fixing three HIGH, four MEDIUM, and three LOW issues.
- [pnpm install documentation](https://pnpm.io/cli/install) confirms that `--frozen-lockfile` does not update the lockfile and that `--lockfile-only` may update both the lockfile and `package.json`. [pnpm audit documentation](https://pnpm.io/cli/audit) confirms the moderate threshold and `pnpm audit signatures`, which verifies installed package ECDSA registry signatures. [pnpm peers documentation](https://pnpm.io/cli/peers) confirms that `pnpm peers check` reads the lockfile for unresolved or incompatible peers.
- The [Next.js release index](https://nextjs.org/blog) records Next `16.3` as available on 2026-08-03 and the July 2026 security floor as `16.2.11`. The selected exact `next@16.3.0` is above that floor.
- [OpenNext Cloudflare documentation](https://opennext.js.org/cloudflare) currently supports Next 16 and the Node.js runtime. The selected `@opennextjs/cloudflare@1.20.2` registry metadata declares Next `>=16.2.11` on the 16.x line and Wrangler `^4.86.0`; selected Next `16.3.0` and Wrangler `4.118.0` satisfy those peers.
- The [Cloudflare Next.js guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) continues to require `nodejs_compat`, `.open-next/worker.js`, `.open-next/assets`, and an OpenNext build. It distinguishes Node development from workerd preview. Task 8 builds only and makes no workerd or deployment claim.

## Registry and advisory refresh

Anonymous read-only npm metadata on 2026-08-08 confirmed that every selected direct version exists, is not marked deprecated, has a registry signature, and reports engines/peers compatible with Node `22.23.2` and the generated dependency graph:

```text
next 16.3.0
react 19.2.8
react-dom 19.2.8
@opennextjs/cloudflare 1.20.2
wrangler 4.118.0
yaml 2.9.0
typescript 6.0.3
eslint 9.39.5
eslint-config-next 16.3.0
typescript-eslint 8.66.0
@types/node 22.20.1
@types/react 19.2.18
@types/react-dom 19.2.4
pnpm 11.20.0
```

The two public Egeria packages remain exactly:

```text
@egeria-systems/standards@0.1.0
  integrity: sha512-BmDwcX0T6KT271C4N24jCKn6ymKTqDAFpJjsG6LNpmIoTAz0xApIcqpHFl9dHOqlB2xdhdHwKYfSiELUp04E0Q==

@egeria-systems/observability@0.1.0
  integrity: sha512-eCTt6tNP0q2HA0wNpM1VJpZBFZqFpBDekKbno+UUKfWMG5I+KEg3bpt/fKdVO86JrKohlIM6Zo/7qzGDBpmh8g==
```

Both have npm registry signatures and no attestation, exactly matching the approved bootstrap provenance exception. Task 8 must preserve that limitation and must not convert signature success into a provenance claim.

GitHub Advisory Database exact-version queries returned no matching advisory for Next, React, React DOM, OpenNext Cloudflare, Wrangler, YAML, Zod, TypeScript, ESLint, eslint-config-next, typescript-eslint, pnpm, or npm at their selected versions. This is dated direct-version evidence, not proof about the committed or future transitive graph. Task 8 therefore performs fresh public-registry frozen installs, moderate audits, signature audits, peer checks, and builds against both committed fixture lockfiles.

## Consolidated contradictions and amendments

No blocking uncertainty remains. Three bounded plan contradictions are resolved in the canonical Task 8 section:

1. The old plan named a `2026-08-05` verification record even though implementation occurs on 2026-08-08. Preparation and verification records now use the actual date.
2. The old fixture-verifier prose referred to advisory access but did not explicitly require fixture-level audit, signature, or peer checks. The amended interface names all three commands and their claim limits.
3. The canonical review protocol and the user's current request require a review packet for the implemented increment, while Task 8 correctly reserves the final P1 Gate 3 packet for Task 9. Task 8 now creates a Task-8-only review packet and still does not create or claim the P1 Gate 3 packet.

The amended plan also avoids repeating the expensive live fixture build against an unchanged tree: focused tests establish the script contract during TDD, and the public-registry build harness runs once in the settled final aggregate.

## Completion boundary

Task 8 is complete only when committed portfolio/site fixtures match two independent compiled-CLI generations byte-for-byte, both committed lockfiles resolve the exact public Egeria packages and pass fresh install/audit/signature/peer/build checks, permanent semantic naming proves equivalent coverage before the temporary ESLint adapter is removed, canonical owners accurately describe the implemented subset, required independent reviewers have no unresolved material finding, and the Task 8 verification record and review packet are committed.

Passing Task 8 does not establish workerd behavior, deployment, visual quality, translation quality, human usability, WCAG conformance, production safety, penetration resistance, source provenance for the two bootstrap packages, or future registry safety. Task 9 retains the deferred schema-contract review and final P1 Gate 3 packet.
