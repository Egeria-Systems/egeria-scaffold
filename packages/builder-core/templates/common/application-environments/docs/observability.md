# Observability and browser diagnostics

The application records bounded operational events in Workers Logs without a Better Stack account. Optional Better Stack delivery adds restricted error diagnostics. Analytics remains a separate capability with its own consent and provider configuration.

Follow [application environments][environment-guide] for build targets, ignored private inputs and runtime target agreement. Build and runtime `APPLICATION_ENVIRONMENT` must match before reporting. Each accepted server, browser and independent transactional-email event carries that authoritative environment label.

<!-- This link resolves in the generated repository. -->
[environment-guide]: environments.md

## Console-only local use

Install the frozen dependencies from the generated repository root:

```sh
pnpm install --frozen-lockfile
```

Copy `apps/web/.env.example` to ignored `apps/web/.env.local` and `apps/web/.dev.vars.example` to ignored `apps/web/.dev.vars`. Use the development build target and matching runtime target. Leave both runtime provider fields empty:

```dotenv
APPLICATION_ENVIRONMENT=development
BETTER_STACK_INGESTING_HOST=
BETTER_STACK_SOURCE_TOKEN=
```

Run `pnpm --dir apps/web run dev`. Browser web vitals and application errors use the fixed `/api/observability` endpoint. Safe custom records contain event identity, bounded attributes and `environment`; they do not contain exception messages, stacks or causes. The console-only path makes no Better Stack request.

The generated unit example exercises the real context, reporters, route and package sinks with intercepted platform/transport boundaries:

```sh
pnpm --dir apps/web run test:unit tests/unit/observability-environment.test.ts
```

Expected: valid targets produce labeled safe records; a missing pair uses console only; a partial pair refuses dispatch; restoring a complete valid pair resumes controlled delivery. Browser errors retain their identity and diagnostic fingerprint through route validation and server labeling. All requests in this example are intercepted; it does not contact Better Stack or establish an Access session.

If transactional email is selected, also run:

```sh
pnpm --dir apps/web run test:unit tests/unit/server-transactional-email.test.ts tests/unit/transactional-email-events.test.ts
```

Email outcome reporting is independently safe-only Workers Logs. It validates the target and adds the label, but does not depend on Better Stack settings and never sends message contents or recipient addresses. Email delivery remains configured by its own selected guide; persistence and jobs are not prerequisites for these diagnostics.

## Optional Better Stack delivery

An authorized operator needs a Better Stack telemetry source, its exact ingesting hostname and source token. Review the account's current ingest volume, source limits, retention, region and access permissions before enabling delivery. The generated project does not provision resources or choose a subscription.

Use a shared nonproduction source when appropriate, with environment labels to distinguish development and staging. Keep production in a separate source with separately scoped credentials and reviewed access/retention. The operator must verify actual source ownership and destination; labels alone do not establish isolation.

Set **both** `BETTER_STACK_INGESTING_HOST` and `BETTER_STACK_SOURCE_TOKEN` in ignored local runtime `.dev.vars` or the separately authorized deployed Worker secret configuration. Use the hostname without a URL scheme or path and the source's actual token. Never put either value in `NEXT_PUBLIC_*`, source, build variables, `.egeria`, browser payloads or diagnostic evidence. The existing package accepts only its bounded Better Stack hostname/token formats.

Both values absent or empty disable the provider. A single supplied value, a wrong-type value, or malformed complete configuration refuses common reporting before logging or network dispatch; it does not silently fall back to console. Failure containment means application responses still succeed where they otherwise would.

The adapter uses HTTPS POST with a Bearer source token, a five-second timeout, no retries and no redirect following. The package bounds provider bodies to 96,000 bytes. HTTP 202 means provider acceptance, not durable ingestion/readback. Provider rejection or timeout produces at most one bounded delivery-failure record for an error report. Delivery remains best effort; it is not a durable queue.

See [Better Stack HTTP ingestion](https://betterstack.com/docs/logs/ingesting-data/http/logs/) for the current source setup and response contract. Actual ingestion, query visibility, permissions and retention require a separately authorized live check.

## Staging browser diagnostics behind Access

Set the staging build's `NEXT_PUBLIC_SITE_URL` to its exact HTTPS origin, for example `https://staging.example.com`, and build with `APPLICATION_ENVIRONMENT=staging`. The public origin and target are compiled into the browser artifact. Runtime variables cannot retarget an existing build.

Only that staging artifact running on its configured exact non-loopback HTTPS origin includes native same-origin credentials to `/api/observability`. Development, production, alternate origins and local previews omit credentials. Missing or malformed origin configuration also omits them. The browser request has no referrer, cannot follow redirects, and cannot be redirected by an HTML base element. Web3Forms continues omitting credentials independently.

An authorized human must first establish the site's [Cloudflare Access session](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/). Application code never reads the cookie and never receives an Access service token. A synthetic local cookie test proves transport selection only; it cannot prove a real session, policy, protected route or deployment. Check [Access troubleshooting](https://developers.cloudflare.com/cloudflare-one/troubleshooting/access/) if the deployed route is blocked.

## Privacy and failures

The route accepts only the declared error/web-vital vocabulary, requires same-origin JSON, and bounds the request stream to 8,192 bytes before buffering. It reconstructs and sanitizes browser diagnostics and rejects extra client environment/provider fields. The server owns environment labeling. The application returns HTTP 202 for valid diagnostics even when delivery fails; this is not evidence of delivery. Invalid payloads return 400, wrong origin 403, excessive body size 413 and unsupported media type 415.

Restricted diagnostics can contain sanitized exception message, stack and cause fields only in the Better Stack diagnostic sink. Sanitization reduces exposure but cannot guarantee privacy; runtime stacks are not source-map deobfuscated. Keep credentials, request bodies, cookies and personal data out of errors. Custom Workers Logs remain safe-only; platform exception logs have separate provider-controlled retention and access considerations. Invocation logs stay disabled.

If records are missing, check matched build/runtime targets, then that both provider values are either absent or valid. Run the local unit example to distinguish configuration refusal from transport failure. A staging artifact served at localhost must omit cookies; test a real Access session only on its authorized configured origin. Rebuild if the public target/origin changes. Never print rejected configuration or raw diagnostics while troubleshooting.

## Disable and recover

Clear **both** runtime provider fields to return common reporting to console-only operation. Correct a partial pair or target mismatch and rerun the local example before an authorized deployment. Restoring configuration does not replay missed diagnostics.

Source rollback, runtime configuration restoration, credential rotation and provider data/retention are separate operations. Preserve reusable sources unless their owner explicitly approves deletion. Removing fields or reverting source does not revoke credentials, erase retained logs, undo delivered email or certify cleanup.
