# acme-site-multilingual-analytics

Generated as a lightweight pnpm workspace with its web application in `apps/web`.

Use the root scripts for local development and verification. Review configuration and application-owned content before release.

## Unit and component checks

Install project dependencies with `pnpm install --frozen-lockfile`, then run the named projects independently:

```sh
pnpm run test:unit
pnpm run test:component
```

`test:unit` runs parser and domain checks in Node. `test:component` runs synchronous React presentation checks in jsdom with semantic Testing Library queries. Run both with `pnpm run test`, or use the explicit `test:unit:watch`, `test:component:watch`, and `test:watch` commands only during interactive local development.

jsdom does not exercise CSS layout, visible focus, iframe/browser APIs, routing, async Server Components, workerd, or deployment. Use the browser checks below for their owned boundaries.

## Browser quality checks

Install project dependencies with `pnpm install --frozen-lockfile`, then explicitly install Chromium before the first browser run:

```sh
pnpm --dir apps/web run browser:install
```

Run the same content-agnostic Playwright and axe checks against either local environment:

```sh
pnpm --dir apps/web run test:e2e:dev
pnpm --dir apps/web run test:e2e:preview
```

The development command starts Next.js on loopback port 3100. Preview E2E consumes already prepared `.open-next` output and starts Wrangler/workerd on loopback port 3101, so run the Next build followed by the OpenNext `--skipNextBuild` transform first. The development and preview commands are separate execution environments and do not reuse an ambient server.

To test an already deployed project, supply its public HTTPS root explicitly:

```sh
PLAYWRIGHT_DEPLOYED_URL=https://example.com pnpm --dir apps/web run test:e2e:deployed
```

Deployed mode rejects missing, malformed, non-HTTPS, credential-bearing, query-bearing, and fragment-bearing URLs. It starts no server. The automatic quality workflow remains local-only; the separate manual deployment workflow runs this check after deployment.

Playwright reports and test results are ignored locally and uploaded for seven days when generated CI browser checks fail. Axe and browser checks provide bounded evidence for selected automated and interaction behaviors. Passing them does not establish WCAG conformance, assistive-technology compatibility, or human usability.

## Visual regression checks

The visual suite compares the generated home route at one desktop viewport and one narrow mobile viewport against reviewed application-owned baselines. It consumes prepared OpenNext output through the loopback workerd preview boundary:

```sh
pnpm run build
pnpm --dir apps/web exec opennextjs-cloudflare build --skipNextBuild
pnpm --dir apps/web run test:visual
```

Baseline updates are an explicit review action. Use a clean index, stage only the intended causal source and configuration changes, and inspect the staged diff for private inputs before continuing. The command below creates a read-only source snapshot from the index, exposes only the application-owned baseline directory as writable, and copies back only the two approved PNG names. Run it in the exact pinned Linux/amd64 environment, review the image diff together with the expected and actual images, and commit baseline bytes only beside their causal source change:

```sh
visual_baseline_source="$(mktemp -d)"
trap 'rm -rf "$visual_baseline_source"' EXIT
git checkout-index --all --prefix="$visual_baseline_source/"
docker run --rm --platform linux/amd64 --shm-size=1g --workdir /work --env PNPM_HOME=/pnpm --env PATH=/pnpm/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin --volume "${visual_baseline_source}:/source:ro" --volume "$PWD/apps/web/tests/visual/home-visual.spec.ts-snapshots:/baseline-output" mcr.microsoft.com/playwright:v1.62.1-noble@sha256:dcc5531e97840b9b5e794f2814476b21571c5124a3fca2267d73041f56e7580e bash -lc 'cp -a /source/. /work/ && corepack pnpm runtime set node 22.23.2 -g && corepack enable --install-directory /pnpm/bin && node --version && pnpm --version && pnpm install --frozen-lockfile && pnpm run build && pnpm --dir apps/web exec opennextjs-cloudflare build --skipNextBuild && pnpm --dir apps/web run test:visual --update-snapshots && cp /work/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png /baseline-output/home-desktop-chromium-linux.png && cp /work/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png /baseline-output/home-mobile-chromium-linux.png'
```

Rerun the comparison without `--update-snapshots` before accepting the change. CI never updates baselines. On failure, the existing failure-only upload contains Playwright report and test-result artifacts, including expected, actual, and diff images when available, and retains them for seven days. Screenshot equality is narrow regression evidence for these selected pixels in the pinned environment; it does not establish visual quality, design quality, human usability, accessibility conformance, deployed behavior, or production readiness.

## Protected Cloudflare deployment

The generated `.github/workflows/deploy.yml` is manual and accepts the exact lowercase 40-character `main` revision approved for deployment. Before enabling it, create a GitHub environment named `production`, restrict it to the protected `main` branch, add required reviewers where the repository plan supports them, and set its `DEPLOY_URL` variable to the public HTTPS root that the deployed browser check must exercise. Enable Prevent self-review when the selected GitHub plan and environment controls support it. Verify the control instead of assuming it exists; when unavailable, record that limitation in the deployment approval evidence and require an eligible reviewer other than the workflow initiator.

Store `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` as environment secrets. Use a Cloudflare token scoped to the target account and only the Worker-edit permissions required by this stateless deployment. Do not commit either value. Rotate or revoke the token separately when access changes or the deployment is retired.

The workflow uses frozen dependencies and runs lint, typecheck, unit, component, Next, OpenNext, development-browser, and workerd-preview checks before the credential-bearing step. That step only validates the two required values and deploys the already prepared `.open-next` output. A deployed HTTPS Playwright/axe smoke follows. Source removal does not undeploy a Worker, remove a route/domain, revoke a token, restore provider configuration, or erase provider data.

Local checks and workflow structure do not prove that GitHub protections are configured, credentials are valid, deployment succeeded, cleanup/recovery works, or the application is production-ready. Deployment execution and `deployment-cloudflare` certification require separate explicit approval and evidence. Visual quality, performance, human accessibility, and any WCAG conformance claim remain separate.

## Operational telemetry

This project generates bounded safe operational events and restricted error reports. Browser error reports use the same-origin `/api/observability` route; the server route revalidates, re-sanitizes, and re-bounds their strict size-limited message, stack, and cause diagnostics before delivery. It never accepts raw error objects, URLs, headers, cookies, form values, or arbitrary attributes. Message, stack, and cause sanitization reduces exposure but is not a privacy guarantee, and runtime stack strings are not source-map deobfuscated. Telemetry failures are isolated from application behavior.

Cloudflare Workers Logs custom records receive only bounded safe operational events; only the Better Stack diagnostic adapter receives restricted message, stack, and cause diagnostics with the safe event. Default invocation logs are disabled so request and response URLs cannot bypass the bounded event vocabulary. Cloudflare platform errors and uncaught exceptions are separate provider-controlled records whose deployed fields and retention require certification. Browser delivery omits credentials and referrer data, and the route cancels request streams once they exceed 8,192 bytes. Optional Better Stack delivery requires both `BETTER_STACK_INGESTING_HOST` and `BETTER_STACK_SOURCE_TOKEN` to be configured as runtime secrets. The generated project does not create that provider source, configure secrets, deploy, or install Cloudflare Web Analytics. Provider retention, endpoint abuse/cost controls, and credential/provider cleanup remain deployment responsibilities. Local builds and browser checks do not prove deployed telemetry receipt or production readiness.

## Calendly booking

When Calendly booking is selected, the generated integration keeps an ordinary link fallback and loads the direct cross-origin scheduling frame only near the viewport or after popup activation. It does not load Calendly host-page JavaScript. Calendly controls provider-side behavior, browser storage, and provider-controlled scheduling data; local checks do not prove provider availability or a completed booking.
