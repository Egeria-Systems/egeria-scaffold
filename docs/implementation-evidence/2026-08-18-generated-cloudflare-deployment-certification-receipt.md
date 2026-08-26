# Generated Cloudflare Deployment Certification Receipt

**Execution date:** `2026-08-19 America/Toronto (EDT, UTC-04:00)`

**Certification receipt status:** `complete`

**Certification reviewer decision:** `accepted`

**Certification unresolved prompts:** `none`

**Certification capability:** `deployment-cloudflare`

**Certification descriptor version:** `0.3.0`

**Certification behavior-contract digest:** `sha256:1690cf9bb12e33a07ea2b91f125cdec62d1d302f35bcc7d533c6a89797481d41`

**Certification evidence revision:** `ea5a8ae8a6b0aa5fd7b8bc3bab3e03a52242aee2`

**Passed certification outcomes:** `cleanup-recovery, deployed-application, fresh-scaffold`

**Reviewed certification outcomes:** `cleanup-recovery, deployed-application, fresh-scaffold`

This content-safe receipt records the human reviewer's explicit acceptance of all three outcomes and separate approval of the certification-registry transition.

## Subject and source identity

- Exact subject: `deployment-cloudflare@0.3.0`, behavior-contract digest `sha256:1690cf9bb12e33a07ea2b91f125cdec62d1d302f35bcc7d533c6a89797481d41`.
- Builder evidence revision: `ea5a8ae8a6b0aa5fd7b8bc3bab3e03a52242aee2`.
- Generated repository: `Egeria-Systems/scaffold-generated-project-certification`.
- Generated revision: `47eb9ef09ea412dbfcf14f69dda153fb14a0691b`.
- Generated tree: `de2c0d58a6f1ff94cdf693262b39fb77bbf41693`.
- Recipe: `portfolio@0.9.0`.
- Deployment workflow digest: `sha256:44fd40dbd7c7df5c884efe754676b0457b7bf9e131599033a8a3818c41bb7065`.
- Generated-quality workflow digest: `sha256:545e8da83040b719bd04a360de3078dda6a1db1c1ca3cf7f235155a79c02cbdc`.
- Installed-state digest: `sha256:9712c379fd7768bb88de677ec03c905dfb2f7db3d3d30445bb60d9c890eb11c3`.

## Fresh-scaffold outcome

The final clean builder revision ran the compiled certification command with its exact revision and returned success. It created a fresh `portfolio`, confirmed the exact subject and recipe, re-inferred authoritative state, required healthy diagnostics and an empty builder diff, and passed frozen installation, peer dependency, audit, registry-signature, lint, Cloudflare type, typecheck, unit, component, Next build, OpenNext build, browser install, development-browser, and workerd-preview browser checks.

The generated repository was produced by the actual compiled builder rather than hand editing. Its exact remote `main` portable tree is byte-equal to the retained local generated tree. Automatic generated-quality run `32315057638` passed on that exact `main` revision.

Result: `passed`; human acceptance: `accepted`.

## Deployed-application outcome

Workflow dispatch `32315740366`, job `96267421358`, used exact generated `main@47eb9ef09ea412dbfcf14f69dda153fb14a0691b` as both the selected ref and `expected_revision`. GitHub held the job at the protected `production` environment. The explicitly approved sole-developer administrator bypass selected only that environment and recorded the exact revision and reason. GitHub records the decision as `skipped`; it is not reviewer approval or independent human review.

The run completed successfully in `2m40s`. Checkout, revision guard, frozen installation, lint, typecheck, unit and component tests, Next.js and OpenNext builds, Chromium installation, development and workerd-preview browser/axe checks, strict public-target validation, the sole credential-bearing deploy step, bounded readiness, and all seven deployed browser/axe checks passed. The failure-only artifact step was skipped and no successful-run artifact exists.

GitHub deployment `5993210930` reached successful status `17043842604`. The deployment produced Worker `acme-generated-project` and version `78387f27-0c4c-46e1-bcdb-ffebd0928e12`. Direct Cloudflare readback matched current prefix `78387f27` at 100 percent traffic, zero errors, and exactly bindings `ASSETS` and `CF_VERSION_METADATA`. The production `workers.dev` URL was enabled; no custom domain or route existed.

The public root returned HTTPS `200`, `text/html; charset=utf-8`, 11,584 bytes, and body digest `sha256:25a0eb6c7c71bf7f1934bda23899f075c724e072f2640a74d1a8f0d690c517fe`. A fresh Brave navigation rendered `Acme Generated Project` without an error page.

Result: `passed`; human acceptance: `accepted`.

## Cleanup-recovery outcome

Synthetic traffic and polling stopped. No restoring mutation was needed because the successful exact deployment is the approved retained baseline. Final readback confirmed the exact generated source/tree, current version at 100 percent traffic, zero errors, only the two declared bindings, and no Worker secret, service binding, queue, storage binding, custom domain, route, data set, or capability-specific provider resource.

The GitHub `production` environment retained only public variable `DEPLOY_URL`, only secret names `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`, the `main` deployment-branch policy, and the existing reviewer, prevent-self-review, and administrator-bypass controls. No secret value was read. The dedicated token remains retained under the approved credential owner, with review/rotation due `2026-11-19`.

The account remained on the Free plan at `53 / 100,000` requests today and one Worker build minute. No upgrade or incremental-spend action occurred. The successful run produced no artifact. Prior negative-evidence artifact `9378214606`, digest `sha256:3d583a1075f59fbabd4f8b4e0e8837156a170aebae1086a5a674d0f4277cfa8e`, remains retained until `2026-08-26`. Ephemeral hosted-run material was destroyed by the runner, and the bounded local HTTPS response file was removed.

The repository, environment, variable, Worker, and dedicated token are intentionally retained as the reusable generated-project certification baseline. Source revert, Worker deletion, version rollback, credential rotation/revocation, environment deletion, and persistent-data recovery were not executed and remain separate runbooks. No persistent data exists in this baseline, so no persistent-data recovery claim is made.

Result: `passed`; human acceptance: `accepted`.

## Privacy exclusions

No secret or credential value, provider account or token identifier, private URL, raw provider response, raw log, request header, request metadata, or machine-specific path is retained here.

## Claim boundary

This receipt supports only the exact subject, builder revision, generated revision, protected workflow run, retained synthetic Worker, three bounded outcomes, and recorded retained-baseline recovery. It does not establish ongoing provider availability, general production readiness, security or privacy completeness, visual or performance quality, human accessibility, assistive-technology compatibility, WCAG conformance, or real-client launch readiness.

## Reviewer decision

- `fresh-scaffold` evidence accepted: `yes`
- `deployed-application` evidence accepted: `yes`
- `cleanup-recovery` evidence accepted: `yes`
- Protection-bypass description, privacy exclusions, quota, and no-spend decisions accepted: `yes`
- All unresolved prompts removed: `yes`
- Registry transition separately approved: `yes`
- Review revision: `ea5a8ae8a6b0aa5fd7b8bc3bab3e03a52242aee2`
- Rerun trigger: a material descriptor, behavior contract, generated workflow, deployed result, provider result, cleanup result, or evidence defect requires newly authorized work
