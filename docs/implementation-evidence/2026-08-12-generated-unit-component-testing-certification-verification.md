# Generated Unit and Component Testing Certification Verification Evidence

**Date:** 2026-08-12 (America/Toronto)

**Status:** All eight approved local certification outcomes passed for the exact standards subject

**Planning base:** `12ecc73a8337ab12ece9dd3a6b2aec03f940383c`

**Certification capability:** `standards`

**Certification descriptor version:** `0.3.0`

**Certification behavior-contract digest:** `sha256:be53fdace61b6782e7f0abbbc0af7c333f81122f3a62fcfc7eb0ac687b2ff2fb`

**Certification evidence revision:** `f9a962874d587e4594af341a1fe5f62db6d7672c`

**Passed certification outcomes:** `fresh-scaffold`

**Reviewed certification outcomes:** `fresh-scaffold`

**Certification receipt status:** `complete`

**Certification reviewer decision:** `accepted`

**Certification unresolved prompts:** `none`

## Subject and evidence boundary

The evidence-producing revision is a descendant of the integrated Task 6C revision and contains the thin compiled-CLI certification runner and its focused tests. The independently recomputed descriptor subject remained `standards@0.3.0` with the digest above before and after the registry-only transition.

The strict machine-readable receipt at `docs/implementation-evidence/generated-unit-component-testing-certification-receipt.json` binds all eight approved outcomes to that subject and revision. The capability registry requires only the causal `fresh-scaffold` evidence kind; the other seven outcomes decompose and review the local risk-based proof for that same generated baseline.

## Passed execution record

The exact Node.js `22.23.2` and pnpm `11.20.0` toolchain paths were used with `CI=true`. Network access was enabled only for package installation, registry audit/signature verification, and browser-backed verification.

| Outcome | Evidence | Result |
| --- | --- | --- |
| `fresh-scaffold` | `pnpm run verify:generated-testing-certification` | Passed the compiled create, inference, doctor, diff, install/audit/signature, lint/type, unit/component, build, and development/preview browser matrix; 19 checks reported. |
| `unit-tests` | Fresh generated `apps/web`: `pnpm run test:unit` | 1 file and 2 tests passed. |
| `component-tests` | Fresh generated `apps/web`: `pnpm run test:component` | 1 file and 1 test passed under jsdom. |
| `state-agreement` | Compiled CLI `infer`, `doctor`, and `diff` | State was valid, standards `0.3.0` was confirmed, diagnostics were healthy with zero findings, and the diff was equal with zero differences. |
| `generated-project-builds` | Fresh-scaffold fixed verifier | Lint, Cloudflare types, strict typecheck, Next.js build, and OpenNext build passed. |
| `browser-regression` | Fresh-scaffold fixed verifier | Local Next.js development and OpenNext/workerd preview Playwright/axe checks passed. |
| `retained-fixture-matrix` | `pnpm run test:generated-fixtures`; `pnpm run verify:generated-skeletons` | 8 of 8 fixture contracts passed; 47, 52, and 49 byte-stable files were confirmed; the fixed verifier passed for portfolio, Calendly portfolio, and site. |
| `ci-contract` | `pnpm run test:constitution` and static workflow inspection | The read-only explicit test-lane contract passed. No hosted run is claimed. |

The bounded fresh-scaffold result was:

```json
{"ok":true,"capability":"standards","version":"0.3.0","profile":"portfolio","checks":["compiled-cli-create","state-inference","healthy-diagnostics","exact-diff","pnpm-version","frozen-install","peer-dependencies","dependency-audit","registry-signatures","lint","cloudflare-types","typecheck","unit-tests","component-tests","next-build","opennext-build","browser-install","browser-development","browser-preview"]}
```

The bounded retained-fixture result was:

```json
{"ok":true,"fixtures":["portfolio","portfolio-calendly","site"],"profiles":["portfolio","site"],"checks":["pnpm-version","frozen-install","peer-dependencies","dependency-audit","registry-signatures","lint","cloudflare-types","typecheck","unit-tests","component-tests","next-build","opennext-build","browser-install","browser-development","browser-preview"]}
```

## Setup-invalid attempts and cleanup

The first direct unit/component commands were launched concurrently before the retained fresh project had dependencies. They began competing sandboxed installs and could not resolve the registry. Only those temporary-project processes were stopped; a single frozen install followed by sequential unit and component commands produced the recorded evidence.

The first retained-fixture invocation lost its session handle, and the duplicate retry ran without network authority. Both invalid process trees were stopped, their exact mode-0700 temporary owners were verified and removed, and neither attempt was counted. The one registry-enabled retained-fixture run above is the recorded result. No generated project content was retained.

## Claim limits and recovery

No workflow was dispatched. No deployment, provider, credential, environment, permission, persistent data, or production system was read or mutated. Passing local Playwright/axe automation does not establish visual quality, human usability, assistive-technology compatibility, or WCAG conformance.

Recovery reverts the registry status, receipt, verification evidence, review packet, and current-status documentation in newest-first focused changes. If the exact subject remains valid, its record returns to `pending`. No source, dependency, provider, deployment, persistent-data, credential, or production recovery applies.
