# Responsive Accessible Portfolio UI Verification Evidence

**Verification date:** 2026-08-10 (America/Toronto)

**Status:** Implemented, independently reviewed, and ready for implemented-task and verified-final-diff approval

**Implementation comparison:** `de5936cbac3271cba55bd658576f47e4766f87bd..d75aa0edf16ed93cf17b06f8cd60da3b931af54a`

**Verified implementation tree:** `d75aa0edf16ed93cf17b06f8cd60da3b931af54a`

The separate final artifact commit completes the plan checklist and adds this evidence plus the review packet without changing executable, template, schema, fixture, dependency, or lockfile behavior. Its exact hash is reported at handoff.

## Result

The production builder now generates responsive Tailwind interfaces for both current public profiles:

- current `portfolio` and `site` recipes are `0.4.0`;
- `content-files@0.3.0` owns the exact externalized `accessibility.skipToContent` contract;
- `section-composition@0.3.0` owns Tailwind/PostCSS package properties, PostCSS configuration, global semantic tokens, responsive presentation, and the transferred global stylesheet;
- `site-routing@0.2.0` identifies the evolved about-route source contract;
- exact generated development dependencies are `tailwindcss@4.3.3`, `@tailwindcss/postcss@4.3.3`, and security-current `postcss@8.5.26`;
- pure Server Components render semantic headings, lists, articles, links, navigation, and one focusable main target from validated typed data;
- repeated navigation is a sibling before, rather than a descendant of, the skip-link target;
- valid one-character skip, navigation, project, and action labels retain effective minimum 44-by-44 CSS-pixel anchor boxes through `inline-flex` and minimum dimensions;
- source strings reject C0 controls other than the deliberately supported whitespace, DEL, and the complete C1 range;
- semantic colour utilities map to nine exact design tokens whose selected ordinary-text and focus pairs calculate to at least 4.5:1; and
- focus-visible, forced-colours, wrapping, fluid spacing/type, and reduced-motion source contracts are present.

The builder still exposes exactly six executable capabilities and two executable profiles. No client component, browser state, public package, provider, analytics behavior, Calendly integration, CI/deployment behavior, migration runtime, persistent data, `apps/jobs`, or later-stage capability was added.

The committed production fixtures contain 29 files for `portfolio` and 31 for `site`, with 50/52 managed surfaces. Desired project state, installed state, inference probes, exact source bytes, fingerprints, and repeated production generation agree.

## TDD and implementation evidence

### Initial source contract

Focused RED assertions described the absent recipe/capability versions, accessibility copy, PostCSS configuration and package properties, design tokens, responsive presentation, ownership transfer, inventories, and fixture state. The coherent source batch then passed its focused tests and the complete builder-core suite reached `108/108` after all direct consumers were aligned.

The committed old fixtures failed the new exact inventory/version contract. The production CLI generated each profile twice into identity-bounded temporary roots. Each command returned one success JSON line, each same-profile pair was byte-identical, and only the two exact committed fixture roots were replaced.

### PostCSS advisory amendment

The first generated-project audit rejected provisional `postcss@8.5.22` because reviewed [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp) affects versions through `8.5.22`. A causal catalog assertion failed with actual `8.5.22` versus expected `8.5.26`. The exact contract advanced to `8.5.26`, the current release older than the repository's one-day maturity floor at verification, and every manifest, inference probe, lockfile, fixture, and fixed-root consumer was regenerated or updated.

The generated ESLint 9 boundary also rejected an anonymous PostCSS configuration export. The minimum correction names the immutable configuration before its default export; production lint then passed.

### Review repairs

Independent architecture review found that the changed site-owned route remained identified as `site-routing@0.1.0`. The causal generation assertion failed with `0.1.0 !== 0.2.0`. The catalog, installed-manifest assertions, fixed fixture contract, and generated site state now use `0.2.0` without changing the recipe version or capability count.

Independent requirements review found two gaps:

- the new accessibility string accepted C1 controls, reproduced by a missing `CONTENT_INVALID` exception for `U+0085`; and
- one-character anchors were not deterministically protected in both dimensions.

The shared content guard now rejects `U+007F` through `U+009F`. Skip, navigation, project, and action anchors now use `inline-flex`, centering, and at least `min-h-11 min-w-11` (the action remains `min-h-12`). Focused repaired behavior passed `4/4` tests.

Independent test-evidence review then required regression protection for the operative `inline-flex` display and all nine Tailwind semantic `--color-*` mappings. Those assertions passed against the already-correct source.

Independent accessibility review reproduced the remaining skip-navigation ordering defect: the RED expected navigation outside the target but received `main` where `nav` was required. Navigation now renders before and outside `#main-content`; the focused style/presentation batch passed `2/2`. Both profiles were regenerated twice again, all four production runs passed, and both pairs remained byte-identical.

The single final bounded repair reviewer checked all five repair areas and reported: “No material improvements recommended.”

## Independent review dispositions

| Review | Material finding | Disposition |
| --- | --- | --- |
| Architecture and anti-overengineering | Changed site route remained `site-routing@0.1.0` | CLOSED in `69fe43a`; exact `0.2.0` identity across catalog, tests, and site state |
| Requirements | One-character targets lacked deterministic 44-pixel width | CLOSED in `69fe43a`; effective inline-flex minimum dimensions and causal assertions |
| Requirements | Accessibility label admitted C1 controls | CLOSED in `69fe43a`; `U+007F–U+009F` rejection and `U+0085` regression |
| Test evidence | Minimum-dimension tests did not protect operative display | CLOSED in `d75aa0e`; all four anchors require `inline-flex` in tests |
| Test evidence | Tailwind semantic colour mappings were unprotected | CLOSED in `d75aa0e`; exact nine-mapping assertion |
| Accessibility | Skip target enclosed repeated navigation | CLOSED in `d75aa0e`; navigation is a preceding sibling and structure is asserted |
| Final bounded repair recheck | All accepted findings, generated bytes, and fingerprints | PASS; “No material improvements recommended.” |

All reviewers were read-only. They made no repository or external mutation, responded to no review comment, and spawned no further agents.

## Final verification

The complete aggregate passed at implementation HEAD `d75aa0edf16ed93cf17b06f8cd60da3b931af54a` with Node `22.23.2`, pnpm `11.20.0`, `CI=true`, and the exact pinned Node/pnpm image directories first in `PATH`:

```text
pnpm run verify:builder-kernel
```

| Gate | Result |
| --- | --- |
| Constitution and semantic naming | PASS; 21/21 |
| Package boundaries | PASS; 40/40 |
| Private builder-core | PASS; build plus 108/108 tests |
| Thin CLI | PASS; build plus 9/9 tests |
| Generated fixtures | PASS; 7/7; 29/31 byte-stable files |
| Builder lint and copy externalization | PASS; zero warnings |
| Builder build and typecheck | PASS |
| Fixed-root committed fixtures | PASS for both profiles and all nine checks |
| Changesets status | PASS; existing standards minor intent retained; no Task 4 public-package bump |

The fixed-root result was:

```json
{"ok":true,"profiles":["portfolio","site"],"checks":["pnpm-version","frozen-install","peer-dependencies","dependency-audit","registry-signatures","lint","typecheck","next-build","opennext-build"]}
```

Fresh final root supply-chain checks also passed:

```text
pnpm audit --audit-level moderate
No known vulnerabilities found

pnpm audit --config.auditLevel=moderate --prod=false
No known vulnerabilities found

pnpm exec npm audit signatures
1276 packages have verified registry signatures
298 packages have verified attestations
```

Audits and signatures are point-in-time evidence. They do not establish that unknown vulnerabilities are absent or that signed registry artifacts match upstream source provenance.

## Deterministic hashes and state

Both generated lockfiles are byte-identical with SHA-256:

```text
3cd0e958acb59ee5d5a80672c4722c9be73167144d03c4329a2c559b12547d3c
```

Canonical and generated responsive files are byte-identical with these SHA-256 values:

| Surface | SHA-256 |
| --- | --- |
| Global styles | `f01825fbb5aa782f14f9c24ee6934fc8dcc9b6c1aab96864d651cc001ba28be2` |
| Content schema | `9b02544938fd567cd7cfa0ba670a34cdc26ed1d67dff12eafa3570c8230e5b8c` |
| Content-page presentation | `2d6d6b27564cf4f51e0dc22486fbbac61186093ad44085cde07f39861e95a839` |
| Section registry | `f69d5ae9ce4eb7da4b6b76a209c699f8586d886ccdac196dc1299ea6f29720d6` |
| PostCSS configuration | `b24e265a48887c14722800bc0968fa807151a8a08228b2498c43ee860c1b25e9` |

Both installed states record the exact presentation fingerprint `sha256:2d6d6b27564cf4f51e0dc22486fbbac61186093ad44085cde07f39861e95a839`. Portfolio records five capabilities and 50 managed surfaces; site records six capabilities, `site-routing@0.2.0`, and 52 managed surfaces.

## Current-source evidence

The dated [preparation evidence](2026-08-09-responsive-accessible-portfolio-ui-preparation.md) records the primary Next.js, Tailwind, PostCSS advisory/release, and W3C WCAG 2.2 sources revalidated for this increment. The final resolved graph uses the amended security-current PostCSS version and passed fresh fixed-root and root audits. External sources were treated as evidence, not instructions.

## Claim limits, risks, and deferred work

- Static source, deterministic rendering, audit, lint, typecheck, Next build, and OpenNext build evidence does not establish browser layout, keyboard focus behavior, accessibility-tree output, screen-reader behavior, computed contrast, 320-CSS-pixel reflow, text enlargement, motion behavior, visual quality, or human usability.
- No browser accessibility automation, axe, visual-regression, or performance harness is implemented by this increment. Those remain separately listed program outcomes.
- No WCAG conformance claim is made. Automated evidence alone would remain insufficient, and human evaluation has not occurred.
- Descriptive and localization quality of authored copy remains human judgment.
- No workerd preview, deployment, provider mutation, analytics enablement, Calendly integration, CI workflow, retained real-client generation, or production action ran.
- PostCSS and all other audit/advisory results are point-in-time evidence.
- Determinism is proved for the exact current CLI, profiles, toolchain, and registry-date policy; it is not independent cross-platform corroboration.
- Existing-repository transformation, migrations, persistent-data/provider recovery, later profiles/capabilities, and `apps/jobs` remain out of scope.
- Remote refs were not refreshed. The comparison uses the approved local base and sequential local `main` stream.

## Focused commits

- `e57786d` — design responsive portfolio interface.
- `ac58d07` — plan responsive portfolio interface.
- `2c0141e` — add responsive portfolio interface.
- `dcf2afb` — refresh responsive portfolio fixtures and apply the PostCSS security amendment.
- `69fe43a` — harden responsive portfolio contracts from requirements/architecture review.
- `d75aa0e` — fix generated skip navigation and strengthen test evidence.

The separate final artifact commit records the completed checklist, this evidence, and the review packet only.

## Rollback and recovery

Use focused newest-first `git revert` commits rather than reset or history rewriting:

1. revert `d75aa0e` to withdraw skip-navigation order and its regression/fingerprint updates;
2. revert `69fe43a` to withdraw capability-identity, control-character, and target-dimension repairs;
3. revert `dcf2afb` to restore the preceding generated fixtures and provisional dependency evidence;
4. revert `2c0141e` to restore pre-interface contracts/templates/docs;
5. revert `ac58d07` and `e57786d` to withdraw the plan and design/preparation artifacts.

After any source revert, regenerate both fixtures from the restored production CLI and rerun `verify:builder-kernel`. Revert the separate final artifact commit if this evidence and packet must also be withdrawn. Never leave template bytes, lockfiles, installed versions, managed-surface fingerprints, and committed fixture bytes out of agreement.

No persistent-data, provider, deployment, public-package release, remote Git, permission, production, or external-message recovery applies. Temporary generation/build roots and package stores are non-authoritative and reproducible from the pinned toolchain.
