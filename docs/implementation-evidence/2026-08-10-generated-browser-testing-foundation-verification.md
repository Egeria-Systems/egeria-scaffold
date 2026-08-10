# Generated Browser-Testing Foundation Verification Evidence

**Verification date:** 2026-08-10 (America/Toronto)

**Status:** Implemented, independently reviewed, and ready for verified-final-diff approval

**Implementation comparison:** `e7026bd9e8c7a7ca20b5a485ee6702d2921a7586..9d12d150d17bcf54557248a13d8ec2f42314a4ea`

**Verified implementation tree:** `9d12d150d17bcf54557248a13d8ec2f42314a4ea`

The separate final artifact commit completes the plan checklist and adds this evidence plus the review packet without changing executable, template, schema, fixture, dependency, workflow, or lockfile behavior. Its exact hash is reported at handoff.

## Result

The production builder now generates the same reusable browser-quality foundation for `portfolio` and `site`:

- exact `@playwright/test@1.62.1` and `@axe-core/playwright@4.12.1` development dependencies;
- explicit Chromium installation plus development, OpenNext/workerd preview, and deployed-mode scripts;
- one shared deterministic Chromium configuration and environment-specific configurations;
- one content-agnostic specification covering headings/content, same-origin navigation, page and console errors, bounded axe rules, keyboard and visible focus, 320-CSS-pixel reflow, and reduced motion;
- ignored Playwright artifacts and generated developer guidance;
- one immutable, read-only, test-only GitHub Actions workflow with frozen installation, a single CI worker, concurrency cancellation, static/development/preview gates, and failure artifacts; and
- an HTTPS-only deployed configuration that fails closed for missing, malformed, non-HTTPS, credential-bearing, query-bearing, and fragment-bearing input while retaining an explicit deployed base path.

The `standards` capability is now `0.2.0` with hybrid delivery and owns the generated quality surfaces without adding a public testing API. Current `portfolio` and `site` recipes are `0.5.0`. The catalog still contains exactly six executable capabilities. No source imports from `proofs`, separate testing capability, public testing package, `apps/jobs`, provider resource, credential, deployment behavior, or ordinary-generation browser receipt was added.

The workerd certification amendment bundles validated YAML 1.2 and Markdown-with-validated-front-matter sources as build-time text modules through exact `raw-loader@4.0.2`. Runtime filesystem access is absent from the generated content reader. This advances `content-files` to `0.4.0`, `deployment-cloudflare` to `0.2.0`, and `site-routing` to `0.3.0` while retaining externalized non-executable content and existing capability boundaries.

## TDD and implementation evidence

Focused RED contracts first required the recipe/capability versions, exact quality packages and scripts, environment-specific configurations, starter specification, workflow, managed surfaces, probes, schemas, generated files, and unchanged six-item ordinary-generation receipt. The source implementation reached GREEN before fixture certification.

Fixture RED contracts then required exact portfolio/site inventories, isolated environment and browser state, explicit browser installation, development and preview commands, and the expanded fixed-root result. Both fixtures were regenerated through the compiled production CLI in absent temporary destinations and their installed fingerprints were updated only from successful outputs.

Runtime certification exposed two real defects:

1. generated server scripts forwarded an argument separator to Next/OpenNext instead of the intended host/port arguments; and
2. workerd returned HTTP 500 when runtime `node:fs` reads addressed unavailable bundle paths.

The smallest repairs corrected the server commands and moved validated content reads to supported build-time text modules. Development and workerd suites then passed for both profiles.

Independent review and the aggregate gate produced further causal repairs:

- restored the exact private template inventory and retained YAML 1.2/front-matter ownership wording;
- retained deployed subpaths, excluded download links, covered every discovered page for focus/motion, and rejected transparent or geometry-free focus indicators;
- asserted the parsed workflow's exact jobs, commands, immutable action references, permissions boundary, and lack of job environment overrides;
- loaded the generated deployed configuration under missing, invalid, and valid isolated environment values without replacing its top-level fail-closed initialization;
- injected unrelated credentials/options and proved the exact verifier environment allowlist plus distinct per-profile working, home, temporary, cache, browser, configuration, and pnpm-store paths; and
- removed a semantic-naming collision from the shadow parser and added paired shadow-only positive/negative controls so geometry evaluation cannot be bypassed by the generated outline.

The final bounded recheck reported: “No material improvements recommended.”

## Final verification

The complete aggregate passed at implementation tree `9d12d150d17bcf54557248a13d8ec2f42314a4ea` with Node `22.23.2`, pnpm `11.20.0`, and `CI=true`:

```text
pnpm run verify:builder-kernel
```

| Gate | Result |
| --- | --- |
| Constitution and semantic naming | PASS; 21/21 |
| Package boundaries | PASS; 40/40 |
| Private builder-core | PASS; build and 110/110 tests |
| Thin CLI | PASS; build and 9/9 tests |
| Generated fixtures | PASS; 7/7; portfolio 36 and site 38 byte-stable files |
| Builder lint and copy externalization | PASS; zero warnings |
| Builder build and typecheck | PASS |
| Fixed-root portfolio development | PASS; Chromium and six starter specifications |
| Fixed-root portfolio workerd preview | PASS; Chromium and six starter specifications |
| Fixed-root site development | PASS; Chromium and six starter specifications |
| Fixed-root site workerd preview | PASS; Chromium and six starter specifications |
| Changesets | PASS; existing pending minor intent for `@egeria-systems/standards` retained |

The fixed-root verifier returned:

```json
{"ok":true,"profiles":["portfolio","site"],"checks":["pnpm-version","frozen-install","peer-dependencies","dependency-audit","registry-signatures","lint","typecheck","next-build","opennext-build","browser-install","browser-development","browser-preview"]}
```

For each profile, certification copied the immutable fixture into an identity-bounded owner and used profile-distinct HOME, temporary, XDG cache, pnpm store, npm configuration, Playwright browser, report, test-result, and fixed-port server state. The exact child environment is allowlisted and excludes representative npm, Cloudflare, Node-option, deployed-URL, browser, and cache values inherited from the caller. The committed fixture roots were unchanged after certification.

The deployed configuration contract was validated without contacting a deployment: the generated module rejected missing and invalid environment values at configuration load and returned the exact normalized `https://example.com/quality/` base for a valid explicit value. The parsed generated workflow matched the exact approved read-only job and step structure. Neither contract was executed on a live deployment or hosted runner.

Both generated lockfiles are byte-identical with SHA-256:

```text
bd843e0cab3dd775ae9cee9e60476dfdef122682c15a6c4e1706d6a0562f6b12
```

Selected generated quality surfaces are byte-identical across both profiles:

| Surface | SHA-256 |
| --- | --- |
| Shared Playwright configuration | `89c07b78bb0442f65664afb83e56ec37d1b0d7d3ca1698901a2abad9433ffd1a` |
| Deployed Playwright configuration | `d4da22b547bbcc589aaf1c1c9b0ece4e8254ab658612237f167034fa52b2f2b5` |
| Browser-quality specification | `4740d9c9547af9f2f383ea1549780505546b52fbe011eabd10492ca5ae7157cc` |

Audit and registry-signature checks passed inside both fixed-root generated projects. They are point-in-time supply-chain evidence, not proof that unknown vulnerabilities are absent or that registry artifacts reproduce upstream source.

## Independent review dispositions

| Review | Material finding | Disposition |
| --- | --- | --- |
| Architecture and anti-overengineering | Exact template allowlist omitted `content-source.d.ts` | CLOSED in `cc19b64`; exact boundary gate passes |
| Architecture and anti-overengineering | Package ownership lost YAML 1.2 and validated-front-matter precision | CLOSED in `cc19b64`; canonical wording and direct-consumer gate restored |
| Requirements | Accepted deployed subpaths resolved landing checks to the origin root | CLOSED in `a19ecd2`; trailing base path and relative landing target are causal |
| Requirements | Transparent focus styles could pass | CLOSED in `a19ecd2` and `9d12d15`; colour and geometry branches have positive/negative controls |
| Requirements | Download links were treated as content pages | CLOSED in `a19ecd2`; downloads are excluded from discovery/navigation |
| Requirements | Focus and reduced motion covered only the landing page | CLOSED in `a19ecd2`; both iterate every discovered content path |
| Test evidence | Workflow checks were not structurally causal | CLOSED in `98504bf`; parsed exact job/steps/commands/actions and boundary |
| Test evidence | Deployed tests bypassed top-level fail-closed loading | CLOSED in `98504bf`; missing/invalid/valid configuration imports |
| Test evidence | Verifier isolation tests did not prove exact allowlisting or profile separation | CLOSED in `98504bf`; injected values, exact keys, and distinct roots |
| Aggregate semantic gate | Focus-shadow unit token collided with sequencing-label grammar | CLOSED in `b6b18d8`; unit-agnostic computed geometry parser and regenerated state |
| Final bounded recheck | Shadow geometry could survive an always-true/always-false mutation | CLOSED in `9d12d15`; paired shadow-only controls; no material finding remains |

All reviewers were read-only. They made no repository or external mutation and spawned no further agents.

## Claim limits, risks, and deferred work

- Axe, keyboard, focus, reflow, and motion results are bounded automated evidence only. They do not establish WCAG conformance, assistive-technology compatibility, human usability, or a completed human evaluation.
- No hosted GitHub Actions run or live deployed-URL execution occurred. Workflow and deployed-mode evidence is static/local contract evidence only.
- No credentials, production deployment, release workflow, provider mutation, cross-browser expansion, visual regression, performance budget, production claim, or retained client launch evidence is included.
- Chromium is the only certified browser. Browser and package installation remain explicit mutable external inputs.
- Content remains validated/externalized, but descriptive, localization, and client-specific quality remain human judgments.
- Determinism is exact-toolchain/profile evidence, not independent cross-platform proof.
- Existing-repository mutation, migrations, persistent-data/provider rollback, later capabilities, and `apps/jobs` remain out of scope.
- Remote refs were not refreshed because this is an approved local source-bound sequential stream.

## Rollback and recovery

Use focused newest-first `git revert` commits, not reset or history rewriting. Revert `9d12d15`, `b6b18d8`, `98504bf`, `a19ecd2`, `cc19b64`, `4769d72`, `6bbfa52`, `dbf104d`, `0003fd3`, `c1b878d`, and `bbc171d` as far as the intended recovery boundary requires. Revert the separate final artifact commit to withdraw this evidence, packet, and completed checklist.

After a source revert, regenerate both fixtures through the restored production CLI and rerun `verify:builder-kernel`. Never leave template bytes, package/recipe versions, managed surfaces, fingerprints, workflow/configuration bytes, fixture state, or lockfiles out of agreement.

No persistent-data, provider, deployment, hosted-workflow, package-publication, remote-Git, permission, production, credential, or external-message recovery applies. Temporary build, browser, cache, server, and generated-project roots are non-authoritative and reproducible from the pinned toolchain.
