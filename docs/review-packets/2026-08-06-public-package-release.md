# Public Package Release Completion Review Packet

**Date:** 2026-08-06 (America/Toronto)

**Status:** Public `0.1.0` release evidence assembled; stop for final completion approval

## Exact scope

```text
public source commit: 91a4413f67930f3aa5c85a4d998c450c728942e0
future provenance fix: f640c87a709bc4266c59543942fe093824d02eb9
completion comparison: 91a4413f67930f3aa5c85a4d998c450c728942e0..HEAD
```

The completion comparison contains the independently reviewed future-workflow fix and this six-file evidence commit. The public packages were built from `91a4413f67930f3aa5c85a4d998c450c728942e0`; this later comparison does not claim that documentation or `f640c87` was part of either immutable `0.1.0` artifact.

The complete public execution, artifact, consumer, control, historical candidate, and limitation record is in the [verification evidence](../implementation-evidence/2026-08-06-public-package-release-verification.md).

## Current outcome

- Exactly `@egeria-systems/standards@0.1.0` and `@egeria-systems/observability@0.1.0` are public and installable from npm. Their anonymous version sets are exactly `["0.1.0"]`, and `latest` is `0.1.0` for each.
- Manual workflow run [`31128800393`](https://github.com/Egeria-Systems/egeria-scaffold/actions/runs/31128800393) completed every step successfully on `main` at the exact public source commit.
- The repository is public; protected `main` stayed at the source SHA; secret scanning and push protection are enabled. The accepted Dependabot branch, pull request, and Copilot review surface did not change `main`.
- Both packages are public Apache-2.0 artifacts with the correct repository/directory metadata, exact allowlisted inventories, matching license bytes, and npm registry signatures. No private package or unintended file was published.
- Neither immutable `0.1.0` version has npm provenance. The user explicitly approved this exact two-version bootstrap provenance exception after Changesets selected pnpm `11.20.0`'s native publish path, whose publish options did not consume manifest `publishConfig.provenance`. This is not retroactive provenance and does not apply to later versions.
- The published archives are not byte-identical to the private `pnpm pack` archives because pnpm normalized published `package.json` files. Inventories, license bytes, and every other included byte match.
- Fresh Node `22.23.2`/npm `12.0.2` consumers passed standards controls under ESLint `9.39.5` and `10.8.0`, the observability empty-root control, all three signature audits, and moderate audits with zero vulnerabilities at the recorded time.
- Trusted publishing is configured for both packages with `Egeria-Systems/egeria-scaffold`, `package-release.yml`, `npm-release`, and `npm publish` only. Publishing access disallows tokens. The GitHub environment secret list is empty and bootstrap-token revocation is operator-confirmed.
- Commit `f640c87a709bc4266c59543942fe093824d02eb9` adds an explicit future `NPM_CONFIG_PROVENANCE: "true"` request. OIDC and that request remain unexercised until a later separately approved version.
- No tag or GitHub release was created by us. Ephemeral Changesets tags were not pushed because checkout credentials were disabled.

## Evidence-increment changed files

```text
M README.md
M docs/architecture/package-ownership.md
M docs/superpowers/plans/2026-08-06-public-package-release.md
M docs/implementation-evidence/2026-08-06-public-package-release-verification.md
M docs/review-packets/2026-08-06-public-package-release.md
M tests/constitution/constitution.test.mjs
```

The earlier `f640c87` commit changed only `.github/workflows/package-release.yml` and `tests/package-boundaries/package-release.test.mjs`; those reviewed files are preserved unchanged by this evidence commit.

## Test-driven and verification record

- RED: the focused constitution documentation contract failed only because README and package ownership still described private release candidates and registry absence.
- GREEN: after the minimum current-status correction, the same focused contract passed 1/1 without a live network.
- Future workflow fix: sole missing provenance request reproduced RED; focused GREEN passed 1/1, the complete package-release test file passed 15/15, and `git diff --check` passed.

| Command | Result |
|---|---|
| `rtk node --test --test-name-pattern='package ownership documentation records the approved release boundary' tests/constitution/constitution.test.mjs` before canonical docs | expected RED; 0/1 passed because README still described private release-candidate status |
| the same focused command after README/package ownership correction | GREEN; 1/1 passed |
| `rtk pnpm run test:constitution` and `rtk pnpm run check:semantic-naming` | environment preflight failed before tests: fallback pnpm `11.16.0`/Node `24.14.0` violated required pnpm `11.20.0`/Node `22.23.2` |
| `pnpm run test:constitution` under exact Volta Node `22.23.2` and pnpm `11.20.0` | pass; 20/20 tests |
| `pnpm run check:semantic-naming` under the same exact toolchain | pass |
| `rtk git diff --check` | pass |

The failed preflight changed no repository file. Exact Volta paths were then used as required by the approved plan; no tool installation or pin change occurred.

## Reviewer dispositions

| Review | Finding or scope | Disposition |
|---|---|---|
| Historical private-candidate requirements | README contradicted implemented builder behavior | repaired and constitution-tested before public execution; resolved |
| Historical architecture/anti-overengineering | raw-SHA checkout did not provide Changesets' local `main` | full-history `main` checkout plus exact `HEAD` and local-main checks; resolved |
| Historical test evidence | Git assertions lacked mutation protection; registry adapter coverage was incomplete | independent mutations and adapter tests added; resolved |
| Historical supply-chain/privacy | exact-version-only registry guard permitted unexpected earlier history | package-level plus exact-version absence and post-release complete-version-set check added; resolved |
| Future provenance fix | explicit publish-time provenance request | `f640c87`; independent review found no material issue |

## Current risks and deferred work

- The immutable `0.1.0` packages have registry signatures but no cryptographic source/workflow provenance.
- Trusted-publisher OIDC and the explicit future provenance request are unexercised until a later separately approved version.
- Administrator bypass remains enabled on `npm-release` by explicit operator decision. The environment is otherwise restricted to `main`, requires one `User` reviewer, and leaves prevent-self-review disabled because there is one eligible operator.
- Registry, signature, and advisory observations are time-sensitive. Automated tests, audits, and signatures do not prove security, privacy, legal title, accessibility conformance, production fitness, human usability, or future-release correctness.
- Publication time was `2026-08-06T22:10:51Z`. Because generated projects enforce `minimumReleaseAge: 1440`, Task 7 live installation must wait until after `2026-08-07T22:10:51Z` (`2026-08-07 18:10:51 America/Toronto`) and recheck live state.
- No further version, publication, evidence push, tag, GitHub release, or Task 7 implementation is authorized by this packet.

## Rollback and recovery

- **Source:** reverting `f640c87` or this evidence commit changes only the future workflow/docs tree. Any wider source correction requires its own approved comparison and does not change published packages.
- **Registry:** the two `0.1.0` versions are immutable. Any corrective version or deprecation is separate from source rollback and requires new explicit approval; this packet recommends no registry action.
- **Credentials and trust:** the bootstrap token and environment secret are gone. Changing trusted-publisher or publishing-access settings is a separate external action.
- **Visibility:** the repository is public. Returning it to private would not retract prior source disclosure or published packages and requires separate approval.
- **Persistent/state:** no `.egeria` state, migration record, deployment, persistent data, provider resource, or client repository changed.

## Final completion approval requested

Approve or reject the exact `91a4413f67930f3aa5c85a4d998c450c728942e0..HEAD` completion comparison and this packet. Approval closes only this public `0.1.0` release evidence increment. Any push of the evidence commit or later publication remains separately authorized.
