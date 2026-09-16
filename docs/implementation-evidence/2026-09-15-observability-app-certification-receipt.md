# observability app certification receipt

**Certification capability:** `observability`
**Certification descriptor version:** `0.3.0`
**Certification behavior-contract digest:** `sha256:0fa9530d9b2b6de0438cadd400a80909e8f55a5cb6c3d7b3ecc59724088c5f43`
**Certification evidence revision:** `9ea5dce328a9a065f71e168cb2c82ea515f54ae1`
**Passed certification outcomes:** `cleanup-recovery, deployed-application, fresh-scaffold`
**Reviewed certification outcomes:** `cleanup-recovery, deployed-application, fresh-scaffold`
**Certification receipt status:** `complete`
**Certification reviewer decision:** `accepted`
**Certification unresolved prompts:** `none`

## Exact subject and acceptance

Execution occurred on 2026-09-15 UTC at the accepted PR #128 merge revision above. Independent review verified the exact subjects, all nineteen frozen evidence files, deployed identities, provider reconciliation and recovery provenance. The repository owner explicitly accepted all three outcomes, their retained-resource and observation limits, and the exact-subject certification change on 2026-09-16 UTC.

The current admission subject is byte-identical to the accepted app-supporting observability subject above. The separate default-app deployment receipt does not supply observability acceptance; this receipt records its own reviewed capture, delivery and recovery outcomes.

## Fresh-scaffold outcome

[Diagnostics run 34926395956](https://github.com/Egeria-Systems/egeria-scaffold/actions/runs/34926395956) generated exact default `app@0.2.0` through the compiled CLI. Fresh local verification and pristine deployment-candidate verification passed before the bounded diagnostic fixtures were applied. The actual overlaid Worker then passed its build and whole-Worker integration. Both fresh and deployment receipts preserve actual Effect/build and workerd evidence. Recipe, installed subjects, producing revision and readiness identity passed canonical validation.

## Deployed-application outcome

The same protected GitHub Actions run deployed the prepared generated app to the reusable stateless non-production Worker. Readiness, server cases, browser cases and matrix reconciliation passed against version `69f8d6ff-ccad-4d42-a16c-fc032b16c346`. This proves the bounded generated-app deployment; it does not claim that the generated client's standalone deployment workflow ran.

Eight cases made nine capture calls and accepted eight originals. Ten application exercise requests plus one readiness request stayed within the sixteen targeted-request limit. Assets, framework traffic, deployment/control-plane requests, provider readback and recovery checks are additional; no total-traffic ceiling is claimed. The browser matrix suppressed eight Web Vital requests and transmitted none.

Actual provider readback reconciled nine Cloudflare custom operational records and seven Better Stack diagnostic records by safe identifiers, timestamps and version correlation. All seven shared records matched, including the five browser identifiers. The two additional Cloudflare records were the contained original and its diagnostic-delivery-failure warning. One separate framework error was excluded from the custom-record count. Custom operational fields stayed within the allowlist; diagnostic field-name presence was checked separately without retaining enriched values in this receipt.

## Cleanup-recovery outcome

[Compatibility recovery run 34927988761](https://github.com/Egeria-Systems/egeria-scaffold/actions/runs/34927988761) passed at the same exact source revision, including its deployed browser journey. Browser-control loss required recovery before the planned secret removal. The owner then explicitly approved a configuration-only dashboard Delete & Deploy exception for the two temporary Better Stack Worker secrets. Their removal produced final active version `3ac1c9b3-13a9-4734-a939-02d7b6fa13fa` at 100 percent traffic.

Final dashboard readback showed no Worker secrets, only the ASSETS resource binding and PROOF_ENVIRONMENT=compatibility, and disabled Logs and Traces. The task observed the expected compatibility homepage and rendered 404 pages at `/certification/diagnostics`, `/api/certification/diagnostics` and `/api/observability`. The owner manually confirmed `{"environment":"compatibility","runtime":"workerd"}` from `/api/compatibility`. These successful observations did not independently capture numeric HTTP status codes. Earlier automated HTTP 403/Cloudflare 1010 and Brave client blocks remain failed historical checks; no security setting was weakened to bypass them.

The shared deployment lease was released after those observations. The reusable Worker, GitHub environment and credentials, and replacement Better Stack source are intentionally retained. The replacement source uses the approved United States Free-plan configuration with three-day log/span and thirty-day metric retention; the prior source remains intact. Credentials require fresh scope, expiry and rotation review before future use. No source retirement, provider-data deletion or credential rotation is claimed.

The last Cloudflare plan readback was Free; exact remaining quota was not remeasured after recovery. No upgrade or incremental-spend action occurred. The successful credential-installation step had an EXIT trap removing its secret and deployment temporary files; no independent post-exit filesystem inspection is claimed. Seven allowlisted JSON receipts were uploaded with seven-day artifact retention, with safe private evidence retained separately.

## Claim and privacy limits

This receipt certifies only the exact subject and bounded outcomes above. Manual runtime observation is human evidence, not an automated successful request. Source rollback, persistent-data recovery, provider deletion and credential rotation are separate domains. No durable delivery, future provider availability, production readiness, privacy/security completeness, performance quality, human accessibility or WCAG-conformance claim follows.

No credential values, provider account/token identifiers, ingestion hosts, private URLs, raw logs, stacks or request metadata are included. Analytics, Calendly and persistence-related subjects retain their independent requirements. The [capability model](../architecture/capability-model.md#certification-coverage) owns current coverage and the [review protocol](../governance/review-and-contribution.md) owns acceptance gates. Changed subjects, causal inputs or evidence defects require renewed affected evidence and review.
