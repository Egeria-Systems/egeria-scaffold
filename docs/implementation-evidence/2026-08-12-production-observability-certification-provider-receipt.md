# Production Observability Certification Provider Receipt

**Execution date:** `2026-08-12/13 America/Toronto (EDT, UTC-04:00)`

**Certification receipt status:** `complete`

**Certification reviewer decision:** `accepted`

**Certification unresolved prompts:** `none`

**Certification capability:** `observability`

**Certification descriptor version:** `0.2.0`

**Certification behavior-contract digest:** `sha256:937a3dcad0c96b45ae9f4acb977bd65e46e2caa50bd3fc6dfb29561a1ab637b9`

**Certification evidence revision:** `ee1e1df10fa2be2f09333efecd86de7f7a131d49`

**Passed certification outcomes:** `deployed-application, fresh-scaffold`

**Reviewed certification outcomes:** `deployed-application, fresh-scaffold`

## Evidence-contract decision

The user explicitly approved certification while intentionally retaining selected provider, credential, deployment, and data resources. The active subject requires `deployed-application` and `fresh-scaffold`. Cleanup was not executed or validated, `cleanup-recovery` is not a passed or reviewed outcome, and no cleanup or recovery claim is made. The prior subject digest and local receipt remain historical evidence rather than active coverage for this amended subject.

## Workflow and revision identity

- Workflow run: `31664542523`, attempt `1`, manual dispatch, completed successfully.
- Repository and deployed Git revision: `ee1e1df10fa2be2f09333efecd86de7f7a131d49`.
- Protected environment and deployed Worker: `test-deploy`.
- Cloudflare deployment identifier: `7c28675e-acc8-40a0-9f05-95aef7786646`.
- Cloudflare version identifier and custom-event `release_id`: `d1a53e93-5aa3-43b7-bcd1-fe2c75f2b1e3`.
- Bounded artifact: `production-observability-certification-receipts`, artifact `9167523925`, digest `sha256:1be069f11851580a5eba299107b03f25560d695c1428bebd8f294f9191208898`, retained by GitHub through `2026-08-20T03:45:05Z`.
- Local receipt SHA-256: `3768d8b7a6c7f3c1845415f8450f3f453d9d0e2e7bd9ac7e02dd55f2b4092753`.
- Route receipt SHA-256: `7bf1930802af32af0bab307c4086f27995e3c592f2f92d7ff27f65232f8a97af`.
- Browser receipt SHA-256: `0c20edcd57648fcdef1f02cff8647f36d137ef60067d665982fda4c3e15ba275`.
- Cloudflare identity receipt SHA-256: `b9e068c7a6a4bd9e4c479108832d18c6df6283f408394736c885f5227e644f08`.

## Fresh-scaffold evidence

The workflow's bounded local receipt reported exact capability `observability@0.2.0`, profile `portfolio`, and all 19 declared checks:

```text
compiled-cli-create, state-inference, healthy-diagnostics, exact-diff,
pnpm-version, frozen-install, peer-dependencies, dependency-audit,
registry-signatures, lint, cloudflare-types, typecheck, unit-tests,
component-tests, next-build, opennext-build, browser-install,
browser-development, browser-preview
```

This accepts the active `fresh-scaffold` outcome at the same evidence-producing revision as the deployed journey. It does not establish ongoing hosted or provider behavior.

## Deployed application evidence

- The home response and certification-only framework error response passed.
- The route accepted the exact bounded browser-error and web-vital envelopes and rejected cross-origin, wrong-media-type, oversized, malformed, extra-field, invalid-vocabulary, and secret-bearing inputs.
- The actual generated browser listener dispatched one synthetic browser error through the same-origin route with an exact `202`; its bounded correlation identifier was `156bfc08-709c-41a4-943d-e886b2e15667`.
- The browser request omitted both cookie and referrer headers.
- The deterministic route markers were `obs-cert-error-ee1e1df10fa2be2f09333efecd86de7f7a131d49` and `obs-cert-vital-ee1e1df10fa2be2f09333efecd86de7f7a131d49`.
- The deployment identity receipt bound the checked Git revision to one latest Cloudflare deployment with one version receiving 100 percent of traffic.

## Provider evidence and free-tier boundary

Better Stack's release-scoped inventory contained 46 custom events:

- `server.request.error`: `1`;
- `browser.window.error`: `2`; and
- `browser.web.vital`: `43`.

All 46 records used schema `1.0.0`, the captured Cloudflare version as `release_id`, and the expected bounded runtime, kind, severity, error-category, and attribute vocabularies. The route browser-error marker, route web-vital marker, and actual browser-reporter UUID each reconciled to exactly one expected record. The 43 browser web-vitals reconciled to `FCP`, `LCP`, `CLS`, `TTFB`, and `FID`; every observed navigation type was `navigate` and every rating was `good`.

Cloudflare Workers Logs showed 47 events at the certification spike: 46 information-level custom records plus one error-level platform/framework record. Invocation logs remained disabled. Only provider-controlled metadata field names were inspected: `account`, `duration`, `endTime`, `error`, `errorTemplate`, `fingerprint`, `id`, `latency`, `level`, `message`, `messageTemplate`, `origin`, `requestId`, `spanId`, `spanName`, `startTime`, `traceDuration`, `traceId`, `transactionName`, `trigger`, and `type` under `$metadata`.

The Free Workers Logs dashboard did not index the synthetic correlation marker in `$metadata.message`; that query returned zero. Therefore the receipt does not claim per-class historical correlation inside Cloudflare. The aggregate reconciles exactly to the 46 custom Better Stack records plus one platform/framework error, but that reconciliation is not a durability or per-record Cloudflare-retention proof.

Both inspected accounts remained on their Free tiers. No payment, upgrade, or additional spend was authorized or performed. The certification stayed within the observed free-tier boundary; retained-resource quotas, retention, and future spend remain the user's operational responsibility.

## Retained-resource disposition

- Selected provider, credential, deployment, source, and data resources were intentionally retained by the user.
- Their post-run state, route reachability, credential lifetime or rotation, source/data retention, deletion, cleanup, and recovery were not validated in this transition.
- No provider cleanup, secret mutation, deployment, workflow rerun, or resource change was performed while recording this receipt.
- `cleanup-recovery` did not pass and is not required by this exact amended subject.
- The retained-resource decision does not apply to another capability or a future materially changed observability subject.

## Privacy exclusions

No secret, credential, token value, ingestion host, private provider URL, raw log, raw provider record, stack, request metadata, header value, cookie value, IP address, user agent, client data, client identifier, or real traffic content is recorded. Provider inspection was bounded to declared synthetic identifiers, aggregate counts, allowed field names and vocabularies, plan labels, and content-safe status values. No unexpected private field or real content was observed.

## Claim boundary

This receipt certifies only the exact `observability@0.2.0` subject and two declared outcomes at one exact revision and one bounded protected-staging journey. It does not establish durable delivery, retries, ongoing provider availability, production readiness, retained-resource safety, cleanup, recovery, performance, visual approval, security completeness, human accessibility, or WCAG conformance. `waitUntil()` remains best-effort, and provider retention and quotas remain plan-dependent.

## Reviewer decision

- Fresh-scaffold evidence accepted: `yes — all 19 bounded local checks passed at the deployed evidence revision`.
- Deployed application and bounded provider reconciliation accepted: `yes`.
- Free-tier/no-upgrade boundary accepted: `yes`.
- Cleanup/recovery evidence accepted: `not claimed and not evaluated`.
- Retained-resource disposition accepted: `yes — explicit user decision; operational state remains uncertified`.
- Registry may change from `pending` to `certified`: `yes, only under the amended two-outcome subject`.
- Rerun trigger: a descriptor, required-evidence contract, generated runtime, provider configuration, service tier, deployment target, credential boundary, or claimed outcome change requires new authorization and evidence.
