# Calendly Initial-Scaffolding Verification Evidence

**Verification date:** 2026-08-10 (America/Toronto)

**Status:** Implementation and independent review complete; final evidence drafted; verified-final-diff approval pending

**Implementation comparison before final evidence:** `02ec5eb12741c1622beec02529c38965e7501d68..e0242eafa848847f108c08e3e9eaac408cc32e6a`

**Verified implementation tree:** `e0242eafa848847f108c08e3e9eaac408cc32e6a`

The two final evidence documents are the only current untracked additions. The existing implementation plan has checklist-only status changes, and the ignored progress ledger is not part of the Git comparison. No implementation source, template, schema, fixture, manifest, dependency, workflow, or lockfile change is uncommitted. The final committed comparison cannot include its own future commit hash; that exact comparison and status will be reported after the separately authorized evidence commit.

## Result

The builder now materializes `booking-calendly@0.1.0` only when paired Calendly arguments are supplied during initial `portfolio` or `site` creation. The existing `0.5.0` profile recipes remain unchanged. Selected settings become authoritative desired state, and installed capability metadata plus 76 exact ownership surfaces are recorded in generated state.

The destination contract accepts only a maximum 2,048-character HTTPS URL on `calendly.com` or `www.calendly.com`, with a non-root path and no credentials, query string, fragment, normalization whitespace, or non-default port. Explicit HTTPS `:443` remains accepted. Rejected destinations are not returned in contract or CLI issues.

Generated presentation supports:

- `link`: an ordinary anchor, with no provider request before navigation;
- `inline`: an ordinary anchor plus a direct cross-origin iframe activated near the viewport, with a post-hydration fallback when `IntersectionObserver` is unavailable; and
- `popup`: the ordinary anchor enhanced only when native modal support exists, with a user-activated direct iframe in a native `dialog` and iframe removal on close.

All visible booking copy is validated YAML. The generated integration loads no Calendly host-page script, consumes no provider API or event, stores no scheduling data, and adds no package, secret, environment variable, platform resource, provider adapter, generic integration framework, or later-add/existing-repository mutation behavior.

## Capability, settings, and fixture evidence

The executable catalog contains exactly seven descriptors. `booking-calendly` is source-generated, repository-stateful, automatically source-removable, supported by `portfolio` and `site`, and depends on `section-composition`. It declares both accepted hosts and the exact CSP contribution:

```text
frame-src https://calendly.com https://www.calendly.com
```

It owns five capability surfaces with matching file probes:

- application-owned booking copy;
- application-owned typed copy reader;
- managed generated settings;
- application-owned client component; and
- application-owned browser specification.

The builder kernel owns the conditional home composition root so selection does not create overlapping ownership.

The retained representative fixture records:

```yaml
originProfile: portfolio
recipeVersion: 0.5.0
capabilitySettings:
  booking-calendly:
    destination: https://calendly.com/example/intro
    mode: popup
selectedCapabilities:
  - standards
  - content-files
  - section-composition
  - deployment-cloudflare
  - observability
  - booking-calendly
```

Its installed state records `booking-calendly@0.1.0`, 76 managed surfaces, no applied migrations, no ejections, and generation checks for contracts, pre-state inference, lockfile, frozen install, lint, typecheck, Next build, OpenNext build, and post-state inference. Fresh compiled-CLI generation was byte-identical to the retained fixture after the final repair. The committed fixture inventory is exactly 41 files; base portfolio and site remain 36 and 38 files.

## TDD and repair evidence

The task reports record focused causal RED/GREEN cycles for strict settings, dependency-first resolution, CLI pairing, all three modes, conditional rendering, copy placement, ownership and inference, fixture identity and determinism, provider-origin request isolation, narrow dialog bounds, destination-query rejection, schema parity, and stale CLI expectations.

Material review findings were repaired before the settled tree:

| Review | Material finding | Final disposition |
| --- | --- | --- |
| Requirements | Explicit HTTPS `:443` was rejected although only non-default ports were forbidden | Fixed in `fd77ecf`; focused contract and full builder/CLI checks passed; re-review approved |
| Requirements | Design metadata did not completely state the accepted `www` host/CSP boundary | Fixed in `e0242ea`; design now matches both accepted hosts and the two-source CSP contribution; approved |
| Architecture and anti-overengineering | Allowing unrestricted Calendly query strings exposed avoidable customization and sensitive-data privacy risk | Fixed in `e0242ea` by rejecting every query string at runtime and in the checked schema, with sanitized failures; approved |
| Test evidence | The selected Calendly CLI test retained the earlier pre-template failure expectation | Fixed in `e0242ea`; it now proves exit `0`, the exact six-capability receipt, empty stderr, and no destination disclosure; approved |
| Test evidence | Query, canonical request/navigation URL, schema-pattern, and generated-fixture protections were incomplete | Fixed in `e0242ea`; focused regressions, full suites, fresh regeneration, determinism, and fixed-root certification passed; approved |

Earlier task-scoped review also closed inactive blank-frame rendering, unavailable browser-API fallbacks, provider-origin fail-closed interception, direct 320-pixel dialog bounds, generated browser-specification typechecking, and inaccurate provider-neutral documentation. No material reviewer finding remains open.

## Final verification

All recorded pnpm commands used `CI=true`, Node.js `22.23.2`, pnpm `11.20.0`, and the required RTK command prefix. Results below are the settled Task 6/final-verification evidence for tree `e0242ea`; this evidence-only drafting task did not rerun tests.

| Exact command | Result | Bounded evidence |
| --- | --- | --- |
| `rtk proxy env CI=true volta run --node 22.23.2 --pnpm 11.20.0 pnpm run test:builder-core` | exit `0`; `121/121` | Runtime contracts, catalog/resolution, rendering, generation, schema protection, and focused Calendly behavior |
| `rtk proxy env CI=true volta run --node 22.23.2 --pnpm 11.20.0 pnpm run test:cli` | exit `0`; `10/10` | Paired arguments, successful forwarding/receipt, sanitized failures, and unchanged commands |
| `rtk proxy env CI=true volta run --node 22.23.2 --pnpm 11.20.0 pnpm --filter @egeria-systems/builder-core run schema:check` | exit `0` | Checked project schema is byte-current with the canonical runtime schema generator |
| `rtk proxy env CI=true volta run --node 22.23.2 --pnpm 11.20.0 pnpm run test:constitution` | exit `0`; `22/22` | Canonical document/link/ownership contracts and semantic-naming adapter |
| `rtk proxy env CI=true volta run --node 22.23.2 --pnpm 11.20.0 pnpm run test:package-boundaries` | exit `0`; `41/41` | Package, template inventory, copy-lint, release, and Cloudflare-boundary contracts |
| `rtk proxy env CI=true volta run --node 22.23.2 --pnpm 11.20.0 pnpm run check:semantic-naming` | exit `0` | Current tracked and non-ignored authored surfaces satisfy semantic naming |
| `rtk proxy env CI=true volta run --node 22.23.2 --pnpm 11.20.0 pnpm run test:generated-fixtures` | exit `0`; `7/7`; `366.45s` | Fixture policy and compiled-CLI determinism; exact `36/41/38` byte-stable file diagnostics |
| `rtk proxy env CI=true volta run --node 22.23.2 --pnpm 11.20.0 pnpm run verify:generated-skeletons` | exit `0`; approximately `6m30s` | All three identity-bounded fixtures completed all 12 fixed-root checks |
| `rtk proxy env CI=true volta run --node 22.23.2 --pnpm 11.20.0 pnpm --filter @egeria-systems/builder-core run lint` and the equivalent CLI lint plus both package typechecks | all exit `0` | Final affected package source satisfied lint and TypeScript contracts |
| `rtk proxy env CI=true volta run --node 22.23.2 --pnpm 11.20.0 pnpm run lint:builder` | exit `0`; `7.03s` | Final root builder lint and copy-externalization gate |
| `rtk proxy env CI=true volta run --node 22.23.2 --pnpm 11.20.0 pnpm run build:builder` | exit `0`; `4.10s` | Final builder-core, observability, and CLI compilation |
| `rtk proxy env CI=true volta run --node 22.23.2 --pnpm 11.20.0 pnpm run typecheck:builder` | exit `0`; `4.02s` | Final builder package TypeScript checks |
| `rtk proxy env CI=true volta run --node 22.23.2 --pnpm 11.20.0 pnpm audit --audit-level moderate` | exit `0`; no known vulnerabilities | Point-in-time root advisory result at moderate threshold |
| `rtk proxy env CI=true volta run --node 22.23.2 --pnpm 11.20.0 pnpm audit signatures` | exit `0`; `885` signatures verified | Point-in-time registry-signature evidence |
| `rtk proxy env CI=true volta run --node 22.23.2 --pnpm 11.20.0 pnpm run changeset:status` | exit `0` | Pre-existing pending minor intent for `@egeria-systems/standards`; Calendly adds no public package/version requirement |
| `rtk git diff --check` | exit `0`; no output | Settled implementation diff had no whitespace errors |

The package-specific lint/typecheck row expands to these four commands, each exit `0`:

```text
rtk proxy env CI=true volta run --node 22.23.2 --pnpm 11.20.0 pnpm --filter @egeria-systems/builder-core run lint
rtk proxy env CI=true volta run --node 22.23.2 --pnpm 11.20.0 pnpm --filter @egeria-systems/cli run lint
rtk proxy env CI=true volta run --node 22.23.2 --pnpm 11.20.0 pnpm --filter @egeria-systems/builder-core run typecheck
rtk proxy env CI=true volta run --node 22.23.2 --pnpm 11.20.0 pnpm --filter @egeria-systems/cli run typecheck
```

For each of `portfolio`, `portfolio-calendly`, and `site`, the fixed-root verifier completed exactly:

```text
pnpm-version
frozen-install
peer-dependencies
dependency-audit
registry-signatures
lint
typecheck
next-build
opennext-build
browser-install
browser-development
browser-preview
```

The verifier used fixture-distinct identity-bounded validation, support, home, temporary, npm configuration, cache, pnpm store, and browser roots, and confirmed the committed sources were unchanged.

No final aggregate `pnpm run verify:builder-kernel` rerun was performed on the unchanged `e0242ea` tree. The baseline aggregate was green, and every affected component plus the complete three-fixture fixed-root certification passed after the final repair. The repository explicitly forbids repeating an unchanged successful expensive check; another aggregate run would add cost without testing changed inputs.

## Security and privacy

- Rejected URLs are never echoed in issues or CLI errors.
- Every query string is rejected, preventing initial desired state from retaining email, token-like, tracking, or other query data.
- Both accepted hosts are represented consistently in validation, external-domain metadata, CSP, and browser interception.
- Provider content remains cross-origin in a direct iframe with `strict-origin-when-cross-origin`; no host-page provider script or event listener is loaded.
- The browser specification intercepts the complete configured Calendly origin, fulfills only the exact scheduling document with local stub content, records and aborts every other provider-origin request, and asserts the unexpected-request list remains empty.
- No credential, secret, account identifier, booking data, or unnecessary personal data was added to source, logs, evidence, or fixtures.
- Calendly account configuration, event types, cookies, retention, scheduling data, and provider cleanup are not managed. No provider persistent state was created, changed, or claimed as builder-owned.

Audit and signature results are dated, point-in-time supply-chain evidence. They do not guarantee that unknown or future vulnerabilities are absent or that registry artifacts reproduce upstream source.

## Claim limits, risks, and deferred work

- The browser suites use a local cross-origin stub. They do not establish Calendly availability, rendering, booking completion, or provider-side confirmation.
- Local development and workerd preview results do not prove a hosted workflow, protected-staging deployment, live deployment, or production readiness.
- Axe, keyboard, focus, fallback, and 320-pixel containment are bounded automated evidence only. They do not prove visual quality, human usability, assistive-technology compatibility, or WCAG conformance.
- Only Chromium was certified. Package and browser installation remain mutable external inputs.
- Link, inline, and popup contracts are covered, but the retained risk fixture is intentionally popup-only rather than an expensive three-mode fixture matrix.
- Existing-repository addition/removal, transactional migration, webhook ingestion, analytics, consent, provider configuration, and later capabilities remain out of scope.
- Protected-staging deployment, creation of a synthetic event and identity, one synthetic booking, provider-confirmed outcome, live fallback proof, retention limits, and provider cleanup require a separate approved plan and authority.
- P2 is not complete, and no client launch or launch-scope approval is implied by this packet.

Remote refs were not fetched or refreshed. The work is an approved local, clean, sequential, source-bound stream; the exact implementation comparison is against its frozen local base, and remote freshness does not affect the validity of that comparison. Local `main` is ahead of the unrefreshed local `origin/main`; this evidence makes no claim about current remote state.

## Rollback and recovery

Source recovery is a focused newest-first `git revert`, never reset or history rewriting, across the implementation commits listed in the review packet as far as the intended recovery boundary requires. Revert the later final-evidence commit separately if the evidence and checklist are to be withdrawn.

After source rollback, regenerate every affected retained fixture through the restored compiled production CLI and run the applicable deterministic and fixed-root verification. Do not leave catalog metadata, runtime/schema contracts, templates, generated files, ownership fingerprints, desired state, installed state, fixture inventory, or browser specifications out of agreement.

Provider cleanup is a separate domain from source recovery. This local implementation created and manages no Calendly account configuration, event type, booking, scheduling data, cookie, or other provider persistent state, so there is currently no provider cleanup action to perform. If a later separately approved protected-staging journey creates provider state, its cleanup and retention evidence must be executed under that journey; reverting source would not perform or prove that cleanup.

No deployment, hosted workflow, publication, remote-Git, permission, production, credential, persistent-data, external-message, or provider mutation occurred in this increment.
