# Bounded Section Catalog Verification Evidence

**Date:** 2026-08-09 (America/Toronto)

**Status:** Implemented, independently reviewed, and ready for implemented-task and verified-final-diff approval

**Implementation comparison:** `83fe0e667a62701de881497d9293fc2355ef7654..f4cb864de31ca6cc7e7e5817ca468f6d21d34d4a`

**Verified implementation tree:** `29bd1e286733c217be68bbcb9b1bacb40d681f3f`

The separate final artifact commit completes the plan checklist and adds this evidence plus the review packet without changing executable, template, schema, fixture, dependency, or lockfile behavior. Its exact hash is reported at handoff.

## Result

The production builder now generates a source-owned, bounded section catalog for both executable profiles:

- `section-composition@0.2.0` materializes one application-owned registry surface and parser association;
- current `portfolio` and `site` recipes are `0.3.0`, while retained `0.1.0` and `0.2.0` provenance remain readable;
- the exact registered types are `hero`, `text`, `project-list`, and `call-to-action`, each with one `default` variant, explicit profile support, accessibility metadata, and empty current analytics/migration declarations;
- YAML section values use strict discriminated shapes, exact keys, unique semantic IDs, validated content, and one hero first among enabled sections;
- disabled sections remain validated and may precede the hero because they are omitted from rendering;
- navigation, project, and call-to-action links accept only reviewed root-relative, non-empty hash, credential-free HTTPS, and non-empty mailto destinations, with URL-normalization whitespace rejected before classification;
- pure Server Components render semantic headings, lists, articles, and ordinary anchors from typed data only;
- heading IDs use a reserved `--heading` namespace that cannot collide with a valid source section ID; and
- portfolio/site routes consume ordered section content without adding styling, browser state, provider behavior, analytics, Calendly, or later capabilities.

Generated output remains a lightweight `apps/web` pnpm workspace. No `apps/jobs`, database, queue, email, identity, payments, provider resource, workflow, deployment, or invented CRUD was added.

The committed production fixtures contain 28 files for `portfolio` and 30 for `site`, with 46/48 installed managed surfaces. Desired project state, installed state, inference probes, source bytes, fingerprints, and production generation agree.

## TDD and repair evidence

### Initial catalog RED/GREEN

The first focused RED specified current recipe/capability versions, exact registry metadata, all four content variants, bounded parser failures, ordering/disable behavior, semantic component output, copy coverage, ownership counts, and generated inventories against the prior implementation. Failures were caused by the absent `0.3.0` recipe provenance, `section-composition@0.2.0`, registry template, parser behavior, widened copy consumer, and generated paths.

The minimum source implementation made the focused catalog set pass `52/52`. Direct package-boundary consumers were then updated, and the complete package-boundary suite passed `40/40`. Builder-core passed `106/106` after all direct generation and diagnostic consumers were aligned.

The fixture contract failed against the previous 27/29-file committed trees with the expected exact-inventory mismatch. The production CLI generated each profile twice in fresh identity-bounded roots; pairs were byte-identical, and only the two exact fixture roots were refreshed.

### Link-normalization and DOM-ID repair

Requirements review reproduced an unsafe normalization case: the accepted root-relative value containing a line feed resolved through WHATWG URL parsing as a credential-bearing HTTPS destination. The causal parser regression failed with the expected missing `CONTENT_INVALID` exception. Tests now cover space, tab, line-feed, and carriage-return values across navigation, project, and call-to-action consumers. The shared validator rejects URL-normalization ASCII whitespace before any prefix or scheme classification.

Requirements and architecture review also reproduced a valid identifier pair whose prior `${id}-heading` derivation created a duplicate DOM ID. The causal renderer assertion failed against the old IDs. The repair uses `${id}--heading`, which the section-ID grammar cannot produce, and asserts global uniqueness plus exact `aria-labelledby` resolution.

The repaired focused renderer suite passed `19/19`, builder-core passed `106/106`, and the production builder regenerated and verified both profiles. A deterministic fixture comparison passed and reported 28/30 byte-stable files.

### Heading-order and semantic-evidence repair

Accessibility review showed that `[text, hero]` was valid even though it rendered an `h2` before the page `h1`. The focused regression failed with the expected missing `CONTENT_INVALID` exception. The parser now requires the hero to be first among enabled sections and explicitly accepts disabled leading sections.

Accessibility and test-evidence review also found that immediate-child assertions did not protect the declared nested list/article/link semantics or prove that rendered copy and destinations came from validated data. A recursive deterministic JSX description now uses unique sentinel values and asserts:

- each heading ID and `aria-labelledby` target;
- every hero/text/project/action text leaf;
- exact `ul > li > article > h3 > a` project structure;
- project key, label, summary, and `href`; and
- call-to-action heading, summary, label, and `href`.

The focused renderer suite and all `106/106` builder-core tests passed. Fresh production generation/builds passed for both exact fixture identities, and generated guidance, parser bytes, and state fingerprints were refreshed.

### Final aggregate contract repair

The first final aggregate stopped at constitution test `14/21` because the roadmap had advanced from the prior copy-enforcement status to completed Task 2/current Task 3, while its direct test consumer still required the old sentence. No later aggregate gate ran. The exact test expression was updated to require the current roadmap status without changing a constitution rule. The focused constitution suite then passed `21/21`.

## Independent review dispositions

| Review | Material finding | Disposition |
| --- | --- | --- |
| Requirements | URL-normalization whitespace could bypass the root-relative link boundary | CLOSED in `820698a`/`e4e20db`; causal regressions cover all three link consumers, validator repaired, exact fixtures regenerated |
| Requirements | Derived heading IDs could collide with another valid section ID | CLOSED in `820698a`/`e4e20db`; reserved namespace, uniqueness and ARIA regressions, exact fixtures regenerated |
| Architecture and anti-overengineering | Confirmed the DOM-ID collision; no additional material finding | CLOSED by the same repair |
| Accessibility | Enabled section headings could render before the page heading | CLOSED in `1496689`/`17e176b`; first-enabled-hero invariant, disabled-leading positive case, guidance and fixtures aligned |
| Accessibility | Nested project/CTA semantics were not fully regression-protected | CLOSED in `1496689`; recursive exact JSX contract added |
| Test evidence | Content-backed leaf text and link destinations were not proven end to end | CLOSED in `1496689`; unique sentinel assertions cover every leaf and destination |
| Bounded repair recheck | Rechecked link normalization, DOM/ARIA IDs, heading order, recursive semantics, fixtures, guidance, and state | PASS; all findings CLOSED and “No material improvements recommended.” |

All reviewers were read-only. They made no repository or external mutation, responded to no review comment, and spawned no further agents.

## Final verification

The complete aggregate passed at implementation HEAD `f4cb864de31ca6cc7e7e5817ca468f6d21d34d4a` with Node `22.23.2`, pnpm `11.20.0`, `CI=true`, and the exact pinned Node/pnpm image directories first in `PATH`:

```text
pnpm run verify:builder-kernel
```

| Gate | Result |
| --- | --- |
| Constitution and semantic naming | PASS; 21/21 |
| Package boundaries | PASS; 40/40 |
| Private builder-core | PASS; build plus 106/106 tests |
| Thin CLI | PASS; build plus 9/9 tests |
| Generated fixtures | PASS; 7/7; two generations per profile; 28/30 byte-stable files |
| Builder lint and copy externalization | PASS; zero warnings |
| Builder build and typecheck | PASS |
| Fixed-root committed fixtures | PASS for both profiles and all nine checks |
| Changesets status | PASS; existing standards minor release intent retained, no new package bump |

The fixed-root result was:

```json
{"ok":true,"profiles":["portfolio","site"],"checks":["pnpm-version","frozen-install","peer-dependencies","dependency-audit","registry-signatures","lint","typecheck","next-build","opennext-build"]}
```

Fresh final root supply-chain checks also passed:

```text
pnpm audit --audit-level=moderate
No known vulnerabilities found

pnpm audit signatures
885 packages audited; 885 packages have verified registry signatures
```

Both generated lockfiles remain byte-identical with SHA-256:

```text
028d52c01ccdc8f76b3beb1e764aa5ccb420981efbe45df28478bf680ce2bb11
```

The canonical and both generated content schemas are byte-identical with SHA-256:

```text
ceb4ed2ea57de6d84c247959006febe8f01cf4f2610bac928604fa9aaf24a172
```

The canonical and both generated section registries are byte-identical with SHA-256:

```text
7440ee450925da589589e6e0174c152e091124973dc5d36832d57eae9747b848
```

The corresponding installed-state surfaces record those exact generated-file fingerprints. Production generation, deterministic comparison, inference, doctor, diff, fixed-root installs, audits, signatures, lint, typecheck, Next builds, and OpenNext builds all passed.

## Focused commits

- `612dc67` — plan bounded section composition and record preparation/design evidence.
- `0cd6285` — add bounded section composition, schemas, tests, copy coverage, and canonical owners.
- `ac9c38a` — refresh exact generated section fixtures.
- `820698a` — harden generated section identifiers and links.
- `e4e20db` — refresh hardened section fixtures.
- `1496689` — enforce generated page heading order and exact semantic renderer coverage.
- `17e176b` — refresh ordered section fixtures.
- `f4cb864` — align the roadmap constitution consumer with current status.

The separate final artifact commit records completed checklists, this evidence, and the review packet only.

## Current official and security evidence

The dated [preparation evidence](2026-08-09-bounded-section-catalog-preparation.md) records the current primary React, TypeScript, Next.js, YAML, WHATWG URL, Node, and package release/advisory sources reviewed for this increment. The final link-normalization repair follows the WHATWG behavior reproduced during review. No dependency or provider version changed. Audits and advisory range comparisons are point-in-time evidence, not proof that unknown vulnerabilities do not exist.

## Claim limits, risks, and deferred work

- Static JSX and production build evidence does not establish a browser accessibility tree, keyboard/focus behavior, screen-reader behavior, responsive reflow, motion behavior, visual quality, or human usability.
- No axe/browser accessibility gate is implemented by this increment, and no WCAG conformance claim is made. Automation alone would remain insufficient for such a claim.
- Descriptive quality of authored headings, summaries, and link labels remains human judgment; tests prove shape and data flow, not editorial quality.
- Link validation is intentionally narrow. It does not add redirects, target behavior, Calendly embedding, tracking, or general-purpose URL policy.
- The generated UI is semantic but unstyled. Responsive accessible UI, visual/performance checks, Calendly, production observability, CI/deployment, retained real-client evidence, and launch-scope approval remain later separately gated P2 work.
- Generated builds passed, but no workerd preview, deployment, browser run, or production action occurred.
- Determinism is proved for the exact current CLI, profiles, toolchain, registry-date policy, and fixtures; it is not cross-platform corroboration.
- Audits and registry signatures are point-in-time supply-chain evidence; signatures do not establish upstream source provenance.
- Existing-repository transformation, migrations, persistent-data/provider rollback, later profiles/capabilities, and `apps/jobs` remain out of scope.
- Remote refs were not refreshed. The comparison uses the approved local base and current local stream.

## Rollback and recovery

Use focused newest-first `git revert` commits rather than reset or history rewriting:

1. revert `f4cb864` to restore the prior roadmap test expression;
2. revert `17e176b` and `1496689` to withdraw the first-enabled-hero/semantic-test repair and its fixture fingerprints;
3. revert `e4e20db` and `820698a` to withdraw link/DOM-ID hardening and its fixture fingerprints;
4. revert `ac9c38a` and `0cd6285` to restore the pre-catalog recipes, templates, schemas, tests, architecture documentation, and fixtures; and
5. revert `612dc67` to withdraw only the dated plan/design/preparation artifacts.

After any source revert, regenerate both fixtures from the restored production CLI and rerun `verify:builder-kernel`. Revert the separate final artifact commit if this evidence and packet must also be withdrawn.

There is no persistent-data, provider, deployment, public-package release, remote Git, permission, production, or external-message action to reverse. Temporary generation/build roots and package stores are non-authoritative and reproducible from the pinned toolchain.
