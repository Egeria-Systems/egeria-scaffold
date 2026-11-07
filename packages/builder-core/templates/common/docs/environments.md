# Application environments

`APPLICATION_ENVIRONMENT` selects `development`, `staging` or `production`. Local builds default to development only when the value is absent or empty. Both staging and production use production compilation; `NODE_ENV` does not select the application target.

| Application target | Build selection | Worker runtime selection |
| --- | --- | --- |
| development | Local default, or explicit `development` | Explicit `development`; never defaults at runtime |
| staging | Explicit `staging`, using production compilation | Explicit `staging`, matching the artifact |
| production | Explicit `production`, using production compilation | Explicit `production`, matching the artifact |

Next reads build inputs from `apps/web/.env.local` or explicitly supplied process variables. Worker runtime configuration comes from Wrangler and `apps/web/.dev.vars`. These are separate inputs. Next does not automatically load `.env.staging`. The build derives `NEXT_PUBLIC_APPLICATION_ENVIRONMENT`; do not configure it independently. A conflicting public value refuses the build.

## Local setup

From the workspace root:

```sh
cp apps/web/.env.example apps/web/.env.local
cp apps/web/.dev.vars.example apps/web/.dev.vars
pnpm --dir apps/web run check:environment
pnpm --dir apps/web run dev
```

The preflight checks process inputs only. Next validates again after loading its own environment files. Actual `.env*` and `.dev.vars*` files are ignored; only the examples belong in source control. Never put secrets into a `NEXT_PUBLIC_` variable or Next configuration's `env` map. Public values are visible to visitors and must be selected before compilation.

## Origin and prepared target builds

`NEXT_PUBLIC_SITE_URL` is the single canonical site origin for metadata, sitemap, language links and selected analytics. Staging/production require an HTTPS origin without credentials, a path, query or fragment. Development alone may default to `http://localhost:3000` or use HTTP loopback. Next compiles the literal public input; Worker variables cannot replace it. Nonproduction metadata is noindex/nofollow and its robots file disallows crawling. Robots is not access control.

Release preflight also requires `BUILD_SOURCE_REVISION`, exactly 40 lowercase hexadecimal characters. Next's actual build ID binds that revision and target. Do not set `NEXT_DEPLOYMENT_ID` or override `deploymentId`. Use separate fresh checkouts or generated temporary directories for each target; never reuse a receipt to relabel an old build. Supply every selected service's inputs alongside the following values.

These local examples use a clearly synthetic revision and placeholder origins. They do not represent source approval or deploy anything:

```sh
export BUILD_SOURCE_REVISION=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
export APPLICATION_ENVIRONMENT=staging
export NEXT_PUBLIC_SITE_URL=https://staging.example.test
pnpm --dir apps/web run check:environment:deployment
pnpm --dir apps/web run build
CLOUDFLARE_ENV=staging pnpm --dir apps/web exec opennextjs-cloudflare build --skipNextBuild
```

In a second fresh checkout, use the same synthetic revision and production inputs:

```sh
export BUILD_SOURCE_REVISION=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
export APPLICATION_ENVIRONMENT=production
export NEXT_PUBLIC_SITE_URL=https://www.example.test
pnpm --dir apps/web run check:environment:deployment
pnpm --dir apps/web run build
CLOUDFLARE_ENV=production pnpm --dir apps/web exec opennextjs-cloudflare build --skipNextBuild
```

If jobs are selected, prepare their separately bundled wrapper and native input metadata before recording:

```sh
(cd apps/web && pnpm exec wrangler deploy --dry-run --env "$APPLICATION_ENVIRONMENT" --outdir .open-next/jobs-bundle --metafile .open-next/jobs-inputs.json --x-provision=false --x-auto-create=false)
```

Then record and check only the prepared output. The generated preview config invokes the adapter directly and simulates bindings locally; it does not run `next dev` or rebuild. Supply the selected service guides' independent test expectations too.

```sh
pnpm --dir apps/web run check:prepared-artifact record "$APPLICATION_ENVIRONMENT" "$BUILD_SOURCE_REVISION" --local
pnpm --dir apps/web run check:prepared-artifact verify "$APPLICATION_ENVIRONMENT" "$BUILD_SOURCE_REVISION" --local
pnpm --dir apps/web run test:e2e:preview
pnpm --dir apps/web run check:prepared-artifact verify "$APPLICATION_ENVIRONMENT" "$BUILD_SOURCE_REVISION" --local
```

Run development browser tests before these final builds. After recording, do not run any command that rebuilds or starts Next development. A changed/missing artifact or unsupported bundling input fails closed. Preserve the failing receipt and logs, inspect the cause, and rebuild in a new temporary checkout after correction. Do not overwrite a receipt. The receipt detects accidental mixing; it is not a signature or authenticity proof. The pinned real bundle, copied build ID and queue Text-module import still need actual local verification before acceptance.

## GitHub and Cloudflare release setup

The generated workflow verifies one reviewed clean main revision, deploys staging, completes protected smoke checks, then gates a separate production build through GitHub's native production environment. Reruns are refused: dispatch a fresh reviewed run. Release concurrency queues without cancelling an active release. Persistence deployments and migrations share a target-specific database lock; deployment never invokes migrations. Jobs dispatch requires separate exact-true staging and production retention attestations.

Configure named `staging` and `production` GitHub environments. Each must allow exactly the `main` branch through selected-branch policies, with no tags or wildcard branch rules. Production requires at least one native reviewer and self-review prevention. Before enabling release, verify repository visibility/plan eligibility, actual reviewer eligibility, and disable administrator bypass in GitHub settings. The read-only API guard checks available rules and the current run's separate human approval; unavailable or malformed responses refuse. It cannot establish bypass settings or eliminate races after a read.

| Configuration | Owner |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL`, `DEPLOY_URL`, selected public integration values | GitHub environment variables, per target; both origins must be identical exact HTTPS origins |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | Target GitHub environment secrets; available only in the deployment step |
| `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET` | Staging GitHub environment secrets; available only in protected readiness/smoke |
| Resend, Better Stack and other private application values | Worker secret stores, independently configured per target; never build inputs |
| Reviewed database IDs and migration-set hash | Explicit dispatch inputs checked against target variables, source and SQL |
| Local build/runtime inputs | Ignored `.env.local` / `.dev.vars`; do not commit actual values |

Keep public boolean-like strings raw so the owning validator applies its exact semantics. Do not forward unselected provider inputs. A change to public build configuration requires a new target build.

Configure reviewed custom routes/domains before deployment: named staging/production Workers have `workers_dev: false` and `preview_urls: false`. No client hostname or Cloudflare resource is invented. Independently inspect every alternate hostname, route and version URL in the actual account. Protect the complete staging origin with an Access **Service Auth** policy for the machine service token; also test expected denial without it. Human Access sessions used for staging diagnostics are a separate contract in the observability guide.

Protected tests send service-token headers only to the exact `DEPLOY_URL`. API redirects are bounded and validated one hop at a time; browser authenticated redirects fail closed. Intentional routing uses `getApplicationResponse` and `openApplicationPage`. Unmocked external requests and sockets are denied; provider tests return controlled responses. Trace, screenshots, video, HAR, debug modes and request-audit attachments are forbidden during protected runs. Do not enable runner/step debugging or print these secrets. Readiness is bounded and uses the same protected transport, not unauthenticated curl.

Run `pnpm --dir apps/web run test:deployment-contracts` for local artifact/native-protection contracts and `test:transport` for the dedicated HTTPS loopback canaries. The latter alone allows ephemeral self-signed canary certificates; deployed tests keep TLS verification enabled. These checks do not certify GitHub approvals, live Access coverage, provider retention, accessibility conformance or production safety. Only GitHub Actions has deployment authority, after the actual environment, source, data and provider approvals.

## Foundation health example

When application foundation is selected, start the development server using the local setup above. In another terminal, run `curl -i http://localhost:3000/api/health`: a valid development build and runtime target return the existing health payload. Set `APPLICATION_ENVIRONMENT=staging` in `.dev.vars` while keeping the compiled development target, restart the server, and request health again. It must return HTTP 503 with the stable `application-environment-invalid` code before the build-information reader runs. Restore development and restart to recover. Build-information availability is a separate health condition.

For production-like local evidence, build an explicit target, prepare OpenNext output and run its matching local Wrangler preview. Changing only runtime target must yield the same bounded failure; restoring the matching target recovers without changing provider resources. Health does not verify provider ownership or certify deployment safety.

## Service configuration and recovery

The examples contain configuration names only for selected capabilities. Better Stack is optional: leave both runtime provider fields empty for console-only operation. The [observability guide][observability-guide] owns provider validation, setup, staging browser diagnostics and composed examples; selected-service guides own their independent configuration.

<!-- This link resolves in the generated repository. -->
[observability-guide]: observability.md

Use appropriate shared nonproduction provider resources within one project; keep production resources separate. Local persistent state stays simulated. Provider rules or actual security and test-interference boundaries can require finer separation. Analytics collection stays off by default and requires explicit activation plus visitor consent. Common target declarations alone do not prove resource isolation, Access protection, workflow approval or provider behavior.

Correct invalid local configuration and rebuild when build inputs changed. Revert source separately from runtime configuration, provider changes or persistent data. Do not reset a database, drain queues or delete reusable resources to repair a source or target mismatch.

If booking is selected, see the generated `docs/booking-calendly.md` guide for isolated calendars, its fixed public build input, modes and safe recovery.

If analytics is selected, see the generated `docs/analytics.md` guide for build-time activation, consent, separate provider destinations, production Search verification and a complete contact/booking example.
