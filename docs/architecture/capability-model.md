# Capability Model

**Status:** Controlling capability vocabulary through generated deterministic visual regression

**Runtime status:** The seven `portfolio`/`site` descriptors and two recipes named below are executable in private builder-core. Exact `standards@0.4.0`, `content-files@0.4.0`, and `section-composition@0.3.0` retain their accepted subject-bound evidence. The production-site increment advances `site-routing` from the historically certified `0.3.0` subject to `0.4.0`; the current subject is certified from accepted local `fresh-scaffold` and `existing-repository-lifecycle` evidence at revision `f2b80d9e5e6bb08237d7cc887ee42d2f106e9243`. Active `booking-calendly@0.1.0` remains certified from its fresh-add lifecycle and protected-staging/provider receipts and remains an explicit optional initial-scaffolding selection and exact supported later-add/remove subject. Every other program capability and profile remains documentation-only.

## Descriptor contract

Capabilities have one delivery mode, one or more state classifications, exactly one source-removal policy, and separate operational recovery metadata. This avoids the source plan's ambiguous composite labels and keeps privilege separate from state.

```ts
type CapabilityDeliveryMode =
  | "package-backed"
  | "source-generated"
  | "hybrid";

type CapabilityStateClassification =
  | "stateless"
  | "repository-stateful"
  | "external-stateful"
  | "persistent-data";

type CapabilityRemovalPolicy =
  | "automatic"
  | "reviewed"
  | "export-and-remove"
  | "eject-only"
  | "unsupported";

interface CapabilityDescriptor {
  identifier: string;
  version: string;
  deliveryMode: CapabilityDeliveryMode;
  stateClassifications: readonly [
    CapabilityStateClassification,
    ...CapabilityStateClassification[],
  ];
  removalPolicy: CapabilityRemovalPolicy;
  dependencies: readonly string[];
  optionalIntegrations: readonly string[];
  conflicts: readonly string[];
  supportedProfiles: readonly string[];
  requiredPackages: readonly string[];
  environmentVariables: readonly string[];
  secrets: readonly string[];
  platformResources: readonly string[];
  externalDomains: readonly string[];
  contentSecurityPolicyContributions: readonly string[];
  browserStorage: readonly string[];
  dataClassifications: readonly string[];
  retentionAssumptions: readonly string[];
  privilegedOperations: readonly string[];
  threatReviewLevel: string;
  adapterSemanticRequirements: readonly string[];
  managedSurfaces: readonly ManagedSurfaceDescriptor[];
  inferenceProbes: readonly InferenceProbe[];
  migrationPlanners: readonly string[];
  verificationPlan: readonly string[];
  documentationEvidenceRequirements: readonly string[];
  removalAndRecoveryRequirements: readonly string[];
}

type ManagedSurfaceDescriptor = Readonly<{
  identifier: string;
  owner:
    | Readonly<{ kind: "builder-kernel" }>
    | Readonly<{ kind: "capability"; identifier: string }>;
  path: string;
  ownership: "managed" | "merge-managed" | "application-owned";
  fingerprintTarget:
    | Readonly<{ kind: "file" }>
    | Readonly<{ kind: "json-value"; pointer: string }>;
  mergeStrategy: "replace-file" | "json-property";
}>;

type InferenceProbe =
  | Readonly<{ kind: "file"; path: string }>
  | Readonly<{
      kind: "json-value";
      path: string;
      pointer: string;
      expected: string | boolean | number;
    }>
  | Readonly<{
      kind: "package";
      path: string;
      section: "dependencies" | "devDependencies";
      packageName: string;
      version: string;
    }>;
```

`version` is the capability release version used by catalogs and installed manifests. The descriptor schema-format version is owned by the schema identifier, such as `urn:egeria-systems:schema:capability:1.0.0`, rather than a second descriptor field.

An implementation must model `stateClassifications` as a non-empty set without duplicate members. `stateless` cannot be combined with another classification. Privileged operations, data sensitivity, retention, and provider cleanup stay in their dedicated metadata.

## Materialized recipes

```text
portfolio
  standards
  + content-files
  + section-composition
  + deployment-cloudflare
  + observability

site
  portfolio
  + site-routing

app
  app-foundation

authenticated-app
  app-foundation
  + application-persistence
  + transactional-email-resend
  + identity-core
  + identity-google
  + protected-area
  + account-profile
  + support-console
```

These expressions define generation-time resolution only. The resolved installed capability set becomes authoritative. Recipe inheritance is not stored as a live mutation channel.

The executable recipes are `portfolio@0.10.0` and `site@0.11.0`. The site recipe advances only `site-routing@0.4.0` and the reviewed Next.js security patch; the portfolio recipe remains frozen. The routing descriptor declares its generated nested error boundary's dependency on the already-installed exact `observability@0.3.0`; every other capability identifier and dependency remains unchanged, including exact `standards@0.4.0` and `deployment-cloudflare@0.3.0`. An initial-scaffolding request may explicitly add `booking-calendly`; dependency-first resolution adds its existing `section-composition` dependency, and the generated installed manifest records the resulting selection.

The planned P3B boundary delivers `multilingual` and `analytics` as optional capabilities during initial scaffolding and addable later through the completed P3 lifecycle; there is no composite profile or capability and no client-specific default recipe. `site-routing` remains the default capability for `site`, while each optional capability retains its own state, dependencies, migrations, verification, certification, and removal policy.

## Initial catalog

The current executable catalog contains exactly `standards`, `content-files`, `section-composition`, `deployment-cloudflare`, `observability`, `booking-calendly`, and `site-routing` for `portfolio` and `site`. The other rows remain program visibility only and have no runtime descriptor, resolver availability, generated surface, state, or provider effect yet.

State classifications below describe repository, external-provider, and persistent-data effects managed by the capability. Dependencies may also vary by an explicitly selected mode; those conditional rules are called out rather than hidden.

Profile inclusion distinguishes recipe defaults from independent selections. `dependency-only` means the resolver may add the capability to satisfy another supported selection, but it is not offered directly for that origin profile. Origin profiles remain informational after materialization; this policy controls scaffolding and migration prompts, not live inheritance.

| Capability | Delivery mode | State classifications | Removal policy | Profile inclusion | Required or conditional dependencies |
|---|---|---|---|---|---|
| `standards` | `hybrid` | `repository-stateful` | `reviewed` | default: portfolio, site, app, authenticated-app | Owns the ordinary standards package plus generated lint/type/test/browser-quality configuration; exact Vitest, React plugin, jsdom, Testing Library, Playwright, and axe package/script properties; named Node/jsdom projects and setup; starter unit/component/browser specifications; managed visual configuration; application-owned visual specification and profile baselines; and the read-only quality workflow |
| `content-files` | `source-generated` | `repository-stateful` | `reviewed` | default: portfolio, site | `standards`; generated YAML 1.2 parsing uses ordinary dependency `yaml`, while exact development dependency `raw-loader` bundles YAML/Markdown as text without runtime filesystem reads; owns validated externalized accessibility copy |
| `section-composition` | `source-generated` | `repository-stateful` | `reviewed` | default: portfolio, site | `content-files`; owns Tailwind CSS and PostCSS package/configuration surfaces, global semantic design tokens, and responsive pure presentation |
| `deployment-cloudflare` | `hybrid` | `repository-stateful`, `external-stateful` | `reviewed` | default: portfolio, site, app, authenticated-app | `standards`; exact OpenNext/Wrangler and platform configuration plus the managed manual protected deployment workflow |
| `observability` | `hybrid` | `repository-stateful`, `external-stateful` | `reviewed` | default: portfolio, site, app, authenticated-app | `content-files`, `deployment-cloudflare`, `section-composition` |
| `booking-calendly` | `source-generated` | `repository-stateful` | `automatic` | optional: portfolio, site | `section-composition`; initial scaffolding also requires the strict paired destination/mode settings described below |
| `site-routing` | `source-generated` | `repository-stateful` | `reviewed` | default: site | `content-files`, `section-composition`; exact `0.4.0` additionally requires `observability` for its generated nested error boundary |
| `app-foundation` | `source-generated` | `repository-stateful` | `reviewed` | default: app, authenticated-app; dependency-only: portfolio, site | `standards`, `deployment-cloudflare`, `observability` |
| `application-persistence` | `hybrid` | `repository-stateful`, `external-stateful`, `persistent-data` | `export-and-remove` | default: authenticated-app; optional: app; dependency-only: portfolio, site | `app-foundation` |
| `transactional-email-resend` | `hybrid` | `repository-stateful`, `external-stateful` | `reviewed` | default: authenticated-app; optional: portfolio, site, app | `app-foundation` |
| `background-job-delivery` | `hybrid` | `repository-stateful`, `external-stateful` | `reviewed` | optional: portfolio, site, app, authenticated-app | `app-foundation` |
| `durable-contact-submissions` | `hybrid` | `repository-stateful`, `external-stateful`, `persistent-data` | `export-and-remove` | optional: portfolio, site, app, authenticated-app | `app-foundation`, `application-persistence`; email and jobs optional |
| `multilingual` | `hybrid` | `repository-stateful` | `reviewed` | optional: portfolio, site, app, authenticated-app | Public profile content contracts |
| `analytics` | `hybrid` | `repository-stateful`, `external-stateful` | `reviewed` | optional: portfolio, site, app, authenticated-app | Public profile; each provider selected independently |
| `cms-payload` | `hybrid` | `repository-stateful`, `external-stateful`, `persistent-data` | `export-and-remove` | optional: portfolio, site, app, authenticated-app | Stable content contracts; multilingual integration conditional |
| `identity-core` | `hybrid` | `repository-stateful`, `persistent-data` | `eject-only` | default: authenticated-app | `app-foundation`, `application-persistence`, `transactional-email-resend` |
| `identity-google` | `hybrid` | `repository-stateful`, `external-stateful` | `reviewed` | default: authenticated-app | `identity-core` |
| `protected-area` | `source-generated` | `repository-stateful` | `reviewed` | default: authenticated-app | `identity-core` |
| `account-profile` | `source-generated` | `repository-stateful`, `persistent-data` | `export-and-remove` | default: authenticated-app | `identity-core`, `application-persistence` |
| `support-console` | `source-generated` | `repository-stateful`, `persistent-data` | `reviewed` | default: authenticated-app | `identity-core`, `protected-area`, `account-profile`; privileged operations declared separately |
| `identity-2fa` | `hybrid` | `repository-stateful`, `persistent-data` | `reviewed` | optional: authenticated-app | `identity-core` |
| `identity-passkeys` | `hybrid` | `repository-stateful`, `persistent-data` | `reviewed` | optional: authenticated-app | `identity-core` |
| `payments-stripe` | `hybrid` | `repository-stateful`, `external-stateful`, `persistent-data` | `reviewed` | optional: site, app, authenticated-app | `app-foundation`; persistence/jobs resolved by mode; subscriptions require `BillingSubjectProvider` |
| `booking-webhooks` | `hybrid` | `repository-stateful`, `external-stateful`, `persistent-data` | `reviewed` | optional: app, authenticated-app | `app-foundation`, `application-persistence`; jobs optional |

## Independent and conditional behavior

- `app` does not automatically install persistence, email, jobs, durable contact submissions, or payments.
- `durable-contact-submissions` persists an accepted submission before acknowledging success. Resend notification is optional; queued delivery is optional when jobs are installed. Notification failure never erases an accepted submission.
- `transactional-email-resend` exposes a provider-neutral sender and a Resend adapter. Contact and identity flows may share the adapter but retain separate templates, policies, tokens, rate limits, and use cases.
- `background-job-delivery` provides provider-neutral dispatch/handler contracts and a Cloudflare Queue adapter. A queue does not automatically require a separate jobs Worker.
- `booking-calendly` manages generated repository integration around a user-supplied destination. It does not manage the Calendly account, event configuration, provider data, cookies, or retention, so provider state and provider cleanup remain outside this capability's authority.
- `identity-2fa` and `identity-passkeys` remain independently addable after `identity-core`.
- `payments-stripe` supports `one-time`, `subscriptions`, or `both`. The resolver adds mode-required persistence and background processing explicitly. Removing source does not cancel subscriptions, refund payments, or delete provider/legal records.
- Cloudflare Web Analytics belongs only to `analytics`; it is never implied by `observability`.
- `support-console` exposes only bounded identity, session, account-lifecycle, audit, and installed-capability reconciliation workflows. It is not a generic database browser or business CRUD framework.

### Executable visual regression boundary

`standards@0.4.0` adds deterministic visual regression without changing the exact public `@egeria-systems/standards@0.1.0` package pin. It owns the managed visual configuration and merge-managed `test:visual` script; the generated project owns the application-owned specification and profile baselines. The configuration consumes already prepared OpenNext/workerd preview output, one Chromium worker, fixed `en-CA` locale and Toronto timezone, light colour scheme, reduced motion, hidden caret, disabled animations, CSS-pixel scaling, and exact zero-pixel tolerance.

The representative matrix contains four screenshots only: portfolio at 1440 by 900 and 320 by 800 CSS pixels, and site at those same two viewports. The optional Calendly portfolio reuses the portfolio baseline bytes while retaining its separate behavioral browser test. No browser, locale, route, colour-scheme, or full-page combinatorial matrix is implied.

Baselines are application-owned binary PNGs committed beside their specification and created or changed only from a reviewed staged source snapshot in the exact digest-pinned Linux/amd64 Playwright environment. The source snapshot is mounted read-only and only the baseline directory is writable. Run the generated README's pinned update command once from a portfolio project and once from a site project; each run copies both approved viewport PNGs from that profile directory, yielding four canonical files in total. `--update-snapshots` is permitted only after a causal source change, followed by human review of expected, actual, and diff images and a second comparison without update mode. CI never updates baselines. Generated CI runs visual comparison only after prepared-preview success so it cannot replace an earlier browser failure's report and test results. The root verifier restricts its artifact root to owner-only access, enforces a 16 MiB combined byte cap across each fixture's available Playwright report and test-result trees, and exports those visual-failure artifacts before isolated cleanup. Both generated and repository workflows retain failure-only artifacts with available expected, actual, and diff images for seven days, subject to any lower repository or organization maximum. Removing the capability removes managed configuration and the script property through reviewed capability removal; application-owned specifications and baselines require explicit human disposition rather than automatic deletion.

Task 8B is complete for exact `standards@0.4.0` from the accepted local `fresh-scaffold` outcome at evidence revision `d7f9dac6e25d5dde32015968d0912b45e73644e7`. Historical `standards@0.3.0` evidence cannot certify the new subject. Screenshot equality is narrow evidence for selected pixels in the pinned environment; it does not establish visual quality, design quality, human accessibility, assistive-technology behavior, deployed behavior, production readiness, or WCAG conformance. Performance budgets are deferred by the unnumbered P2 closure amendment and no performance claim is made; neither controlled-laboratory nor field or real-user performance evidence is established. The documentary deferral does not alter `standards@0.4.0`, behavior-contract digest `sha256:81bb7d1c0ee095b6411c29350fa418c8676ffa90594b848a9cc19806e08c29d4`, recipe `0.10.0`, or accepted certification evidence, so no certification sibling is required. No analytics, provider resource, deployment, or real-client generation is part of this boundary.

### Executable Cloudflare deployment boundary

`deployment-cloudflare@0.3.0` remains hybrid and now owns six exact managed/merge-managed surfaces: the OpenNext and Wrangler package properties, Next/OpenNext/Wrangler configuration, and `.github/workflows/deploy.yml`. Matching probes make the workflow part of authoritative installed state. The descriptor declares `DEPLOY_URL`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, the Worker/static-assets resources, the privileged Worker deployment operation, and elevated threat review.

The workflow is manual-only, fixed to `refs/heads/main`, and requires the approved lowercase 40-character revision to equal `GITHUB_SHA`. It has only `contents: read`, credential-free exact-revision checkout, fixed tools/actions, disabled reusable pnpm cache, queued non-cancelling `production-deploy` concurrency, and a bounded job. The fixed `production` GitHub environment owns its public HTTPS URL, deployment secrets, branch policy, and any required reviewers. Frozen installation, lint, typecheck, unit/component tests, Next/OpenNext builds, Chromium installation, and development/workerd browser checks all precede the only credential-bearing step. That step validates the two declared Cloudflare values and runs OpenNext deploy against already prepared output; it cannot build. The existing strict deployed Playwright/axe check runs afterward.

Generation creates no GitHub environment, secret, branch rule, provider token, Cloudflare resource, route, domain, deployment, cleanup, or certification evidence. Source rollback, Worker/provider rollback, route/domain disposition, credential rotation/revocation, and provider/data recovery remain distinct. The exact registry subject is certified from separately accepted fresh-scaffold, deployed-application, and cleanup-recovery evidence at builder revision `ea5a8ae8a6b0aa5fd7b8bc3bab3e03a52242aee2` and generated revision `47eb9ef09ea412dbfcf14f69dda153fb14a0691b`. That bounded evidence does not establish ongoing provider availability, visual or performance quality, human accessibility, WCAG conformance, or production readiness.

### Executable observability boundary

`observability@0.3.0` combines exact replaceable package `@egeria-systems/observability@0.3.0` with generated application-owned infrastructure. The public package owns immutable provider-neutral safe operational events, distinct restricted error reports and diagnostic sinks, bounded context, normalized error categories, allowlisted attributes, guarded error normalization, redaction, non-throwing dispatch, Better Stack protocol encoding, structured-log/browser sinks, and test assertions. It has no runtime dependency on Next.js, React, the DOM, Cloudflare, or a provider SDK.

Generated source registers all three Next.js request-error inputs and browser error/rejection instrumentation, reports web vitals, exposes selected caught-error reporters, and installs five declared application-owned error surfaces: `app/error.tsx`, `app/global-error.tsx`, externalized observability copy, its typed copy reader, and the pure fallback presentation. The same-origin `/api/observability` route accepts distinct strictly bounded safe-event and restricted error-report envelopes, revalidates and re-sanitizes browser reports on the server, and cancels streams beyond 8,192 bytes before buffering the remainder. Browser delivery omits credentials, referrer data, URLs, storage, and persistent user/device/session identifiers. Workers custom records receive only the bounded safe operational event; only the Better Stack diagnostic adapter receives the restricted message, stack, and causes together with that safe event. Non-error operational events continue through the safe delivery path. The Better Stack encoding is provider-specific, but its input is a provider-neutral diagnostic report, so another provider requires an adapter and composition change rather than changes to capture or browser/framework boundaries.

The Cloudflare composition reads `BETTER_STACK_INGESTING_HOST`, `BETTER_STACK_SOURCE_TOKEN`, and `CF_VERSION_METADATA`, and uses `waitUntil()` only as best-effort, non-durable post-response work. `apps/web/wrangler.jsonc` remains fully owned by `deployment-cloudflare`; observability requires and infers Workers Logs enabled with head sampling `1`, default request/response invocation logs disabled, and the `CF_VERSION_METADATA` binding. Cloudflare can separately retain platform or framework errors and uncaught exceptions outside the custom safe schema, so the descriptor classifies those provider-controlled logs separately and the future protected-staging certification must verify their actual fields and retention before any production claim.

Restricted message and stack sanitization, byte/line bounds, guarded reads, path/query/fragment removal, and pattern redaction reduce exposure but are defense in depth, not a privacy guarantee. Stack strings are not source-map deobfuscated in this increment. Access, provider region, retention, deletion, credentials, and operator handling remain certification decisions.

Security metadata classifies the capability as elevated, names the two provider secrets, Cloudflare Workers Logs and Better Stack source resources, the Better Stack ingestion host boundary, bounded operational telemetry, provider-controlled retention, and privileged provider/secret configuration. Generated source creates no provider resource, secret, rate-limit resource, WAF rule, queue, database, or analytics surface. The public same-origin endpoint has strict origin, media-type, byte-size, schema, vocabulary, correlation-token, and extra-field rejection, but origin checking is not authentication; deployment-level abuse and cost controls remain a protected-staging certification concern.

Repository removal, deployment-observability configuration, credential revocation or rotation, provider-resource disposition, retained-data disposition, and source/provider/credential recovery are separate reviewed requirements. The current subject under [`certifications/capabilities.json`](../../certifications/capabilities.json) is exact `observability@0.3.0`, behavior-contract digest `sha256:24a3cb3361cd8f72a12a1926b512e087adb31ad120a62b70e06a68d9dcf90c99`, and certified from accepted `fresh-scaffold`, `deployed-application`, and `cleanup-recovery` evidence at exact revision `bdcc55f1bfa6eca392ce3e36bdc35adb6f085bad`. Diagnostics run `31925083913` and recovery run `31925927776` bind the bounded live and recovery outcomes. The prior certified `observability@0.2.0` subject at `ee1e1df10fa2be2f09333efecd86de7f7a131d49` retains only historical evidence from the private protected-staging receipt; that exact prior subject cannot certify `0.3.0`. Current certification does not establish durable delivery, ongoing provider availability, production readiness, privacy completeness, visual quality, human accessibility, or WCAG conformance.

### Executable Calendly boundary

Initial selection is one atomic request containing `destination` and `mode`. `destination` accepts at most 2,048 characters and must be HTTPS on `calendly.com` or `www.calendly.com`, use a non-root path, and contain no credentials, query string, fragment, normalization whitespace, or non-default port. `mode` is exactly `link`, `inline`, or `popup`. Stable validation issues do not contain rejected destinations.

`.egeria/project.yaml` permits one strict optional `capabilitySettings.booking-calendly` object and requires settings presence to agree exactly with the selected capability. `.egeria/state.json` records `booking-calendly@0.1.0`, its source-generated delivery, repository-stateful classification, automatic source-removal policy, and surface fingerprints. Existing projects with `capabilitySettings: {}` remain valid.

The capability owns five declared surfaces and matching file probes: the booking browser specification, client component, externalized booking copy, typed copy reader, and generated settings. Copy, reader, client, and browser files are application-owned after creation; settings remain managed. The builder kernel owns the conditional home route, preventing overlapping capability ownership. Removal means removing generated booking surfaces and settings; it does not imply provider configuration or data cleanup.

Security metadata declares both accepted Calendly hosts, their exact `frame-src` contribution, provider-controlled browser storage and scheduling data inside the cross-origin frame, provider-controlled retention, and elevated threat review. The generated presentation uses an ordinary link, a near-viewport direct iframe for inline mode, or an anchor enhanced to a native dialog and user-activated iframe for popup mode. It loads no Calendly host-page script or API and listens to no provider event.

The verification plan includes typecheck, Next build, development browser checks, and OpenNext/workerd preview browser checks. The retained `portfolio-calendly` popup fixture provides deterministic selected-state and stubbed-browser evidence while contract tests cover all three modes. That evidence does not call Calendly, make or confirm a booking, prove deployed or hosted execution, establish visual or human accessibility quality, or support a WCAG conformance claim.

## Certification coverage

The strict repository-owned [`certifications/capabilities.json`](../../certifications/capabilities.json) registry is keyed by executable capability identifier. Each subject binds the exact descriptor version and a canonical SHA-256 digest of the descriptor plus ordered required-evidence contract. Builder-core owns the private schema and pure descriptor-admission and closure decisions; registry presence alone never means certified.

Clean-checkout admission is actual and rejects absent, unknown, stale-version, stale-digest, or unauthorized backfill records without reading ignored private artifacts. Exact `standards@0.4.0` is certified from its accepted task-linked `existing-repository-lifecycle` and renewed `fresh-scaffold` receipt at evidence revision `d7f9dac6e25d5dde32015968d0912b45e73644e7`; `observability@0.3.0` and `deployment-cloudflare@0.3.0` remain certified from exact task-linked receipts; active `booking-calendly@0.1.0` is certified from exact local evidence revision `b30e10b86b9ac9ef8dfdf1e8fa8e4077e2abe059` and protected/provider evidence revision `f9bd78f115c2118afd6dcc17ce49b2bfe34ca10d`; exact `content-files@0.4.0` is certified from accepted local `fresh-scaffold` evidence at revision `f03b9f624c370728f678924ce34e5287558d2a87`; exact `section-composition@0.3.0` is certified from accepted local `fresh-scaffold` evidence at revision `f74459c8833833186bb651c116ed524e51044677`; and exact `site-routing@0.3.0` is certified from accepted local `fresh-scaffold` evidence at revision `77cea944513e521939bf4de088048f67acdfbc3c`. Before a certification workflow updates the tracked registry, the separately invoked local private-artifact gate requires every referenced plan and evidence receipt and binds each passed entry and receipt to its capability, descriptor subject, evidence-producing ancestor revision, and declared outcome. Descriptor admission, `legacy-backfill-exempt` closure, and `all-certified` closure pass.

Current descriptor admission, `legacy-backfill-exempt` closure, and `all-certified` closure also pass for the production-site catalog because task-linked `site-routing@0.4.0` now has accepted evidence for both required outcomes. The historical `site-routing@0.3.0` receipt remains limited to that exact prior subject.

The Task 8B successor runner used the compiled CLI for fresh scaffolding of a `portfolio` project, re-inferred it, required healthy diagnostics and an empty exact diff, and reused the existing fixed generated-project verifier, including deterministic visual regression. Its accepted receipt certifies only exact `standards@0.4.0` at evidence revision `d7f9dac6e25d5dde32015968d0912b45e73644e7`; historical `standards@0.3.0` evidence remains limited to that prior subject. Accepted `observability@0.3.0` evidence remains current. The accepted prior-digest `booking-calendly@0.1.0` evidence remains historical, while the active lifecycle digest is certified only by its exact current local and protected/provider receipts. These bounded journeys do not prove ongoing provider availability, visual quality, production readiness, or WCAG conformance.

## Delivery and package ownership

Package-backed delivery uses an ordinary replaceable dependency. Source-generated delivery writes owned source under declared merge/ejection rules. Hybrid delivery combines both and declares each surface explicitly.

Initial public packages are limited to `@egeria-systems/standards` and `@egeria-systems/observability`, and they are created only in P0.3. P0.3 reserves private `builder-core` ownership of project/state schemas; P1 implements them there. They remain private until a proven independent consumer justifies extraction.

The full catalog preserves future visibility without prematurely implementing later stages. The executable boundary is limited to the seven descriptors and two recipes identified above. Deployment adds only its declared workflow/security/state contract and performs no external action during generation. Calendly adds only initial-scaffolding settings and declared local surfaces. Observability adds only its exact public package, bounded generated adapters/configuration, declared secrets/resources, probes, and verification; it performs no provider mutation and installs no analytics.

The implemented existing-repository boundary is limited to read-only `plan-add`, fingerprint-gated `apply-add`, read-only `plan-remove`, and fingerprint-gated `apply-remove` for exact `booking-calendly@0.1.0`; read-only `plan-upgrade` and exact `apply-upgrade` for the `standards@0.3.0` to `standards@0.4.0` and `site-routing@0.3.0` to `site-routing@0.4.0` edges; and accepted read-only `plan-profile-transition` plus exact fingerprint-gated `apply-profile-transition` for exact `portfolio@0.10.0` to historical `site@0.10.0`. Application requires the same clean attached linked worktree and exact private plan input, transforms once, verifies an isolated copy without VCS metadata, requires pending inference and the exact transformed bytes, appends one successful migration record containing only completed checks, persists state last with the same conservative receipt, requires final state/inference and the exact dirty paths, then rereads exact migration/source/control bytes before stopping for verified-final-diff approval. Removal planning verifies the installed recipe and exact managed/shared bytes; classifies unchanged capability-owned application files for deletion and modified or already-ejected application files for preservation/ejection; and returns a redacted fingerprinted approval plan with no write. Its fingerprint-bound review requirements require repository-wide review for surviving references to removed surfaces and exact-path reconciliation for any preserved/ejected capability file before transformation approval. The current planner declares those requirements but does not scan arbitrary repository source. Exact `apply-remove` is accepted-main integrated at `main@7f59e8b093edb7be617cd2a30bfb4ebaa6a8ab6e`; post-merge Repository quality run `32620215344` passed every applicable job. Pull requests 48, 49, and 50 make the standards executor and portfolio-to-site planner/executor accepted-main integrated, with the transition executor accepted at `main@641db9537f5dea4911b0b727eb083f8d6d359204`; their private control persistence is accepted at `main@532a7cd6e874db13ac8c4b1d2f376abe83862772`. Exact portfolio-to-site transition lifecycle certification is complete for the compiled plan/apply/refusal matrix and operation-specific retained-prefix boundaries at evidence revision `8098c68c82aaa35a59345706c851e8111d463111`; it does not merge runtime policy or operation-specific effects. Exact `content-files@0.4.0` is certified at evidence revision `f03b9f624c370728f678924ce34e5287558d2a87`, exact `section-composition@0.3.0` is certified at evidence revision `f74459c8833833186bb651c116ed524e51044677`, historical exact `site-routing@0.3.0` is certified at evidence revision `77cea944513e521939bf4de088048f67acdfbc3c`, and current exact `site-routing@0.4.0` is certified from both required outcomes at evidence revision `f2b80d9e5e6bb08237d7cc887ee42d2f106e9243`. P3 Gate 3 closure is approved, closed, integrated, and reconciled. The separate `multilingual` implementation and certification pair is next; analytics and real-client work remain separately gated. A generic lifecycle executor, any further upgrade or profile-transition edge, automated recovery, and P3C runtime work remain planned. The boundary adds no webhook, new profile, provider API, publication, or production authority.

The production-site increment adds only the second exact capability edge, `site-routing@0.3.0` to `0.4.0`, from `site@0.10.0` to `site@0.11.0`. Its read-only planner and fingerprint-gated state-last executor reuse the accepted operation-specific lifecycle contract without introducing a generic executor, another profile transition, provider behavior, deployment, publication, or runtime certification authority.

### First supported upgrade edge

The approved source plan owns the [first supported upgrade planning boundary](../roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md#first-supported-upgrade-planning-boundary). It declares exact repository-only `standards@0.3.0` to `standards@0.4.0` as a capability edge and owns its endpoint evidence, command, agreement, fingerprint, refusal, no-mutation, compatibility, executor, recovery, and approval contracts. Merged pull request 47 integrates only read-only planning at accepted `main@138b5d712ab22016c020eb1c2a3e56e0efc89a5a`: exact version-specific catalog/recipe snapshots, installed-source inference and agreement, six target actions, control/target fingerprints, Git containment, privacy-safe output, and refusal without mutation. This model contributes the existing invariant that installed capabilities are authoritative while original recipe `0.9.0` provenance and the independently versioned project/state/migration `1.0.0` controls plus builder `0.0.0` are not upgrade subjects.

Exact fingerprint-gated compiled `apply-upgrade` is accepted for only that edge by pull request 48 at `main@af8898b533f4a7ccf08c83bd7818312a5f27c3c0`. Its private operation-specific executor/writer recomputes planning and Git identity before the six-action write, transforms once, verifies and freshly infers before the exact migration append, persists state last with `lastSuccessfulVerification.kind: "capability-upgrade"`, reruns agreement, proves the exact eight-path diff, and stops for separate verified-final-diff approval. Planning approval, execution, verification, persistence, recovery, and verified-final-diff approval remain separate. Every failure after a committed write retains an inspectable prefix and never triggers automatic rollback. Accepted execution does not certify, deploy, publish, approve a generated-project final diff, establish browser/workerd or provider behavior, prove visual quality or accessibility conformance, or establish lifecycle/security certification or production readiness. With all four concrete executors accepted, the evidence-gated private extraction may share only canonical migration append/reread validation and state serialization/write mechanics; it remains internal unless later evidence independently satisfies package extraction. The finite single-edge matrix retains named examples; `fast-check` remains deferred until a later graph is materially combinatorial.

### First supported profile-transition edge

The approved source plan owns the [planning](../roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md#first-supported-profile-transition-planning-boundary) and [execution](../roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md#first-supported-profile-transition-execution-boundary) contracts for exact `portfolio@0.10.0` to `site@0.10.0`. Pull request 49 accepted read-only compiled `plan-profile-transition --directory <absolute-existing-linked-worktree> --to-profile site` at `main@612a963ab96221837b1c8ac815f41e90736d292e`, with no caller-supplied source profile. Installed capabilities remain authoritative: the target manifest preserves every exact agreed optional subject, preserves the five exact shared default subjects, and adds only `site-routing@0.3.0` for the default edge. Builder-core owns transition support, agreement, seven render-derived actions, private fingerprint material, refusal, privacy, no-mutation policy, bounded Git/filesystem effects, and the transition workflow; the CLI owns only strict arguments, path resolution, one-line JSON, and stable exits.

Planning requires clean stable attached linked-worktree identity before and after planning, exact project/state/migration/recipe/capability/inference/surface agreement, absent create targets including Git-ignored targets, and no ejection or managed drift. Its deterministic digest privately binds exact controls, inputs, action subjects/targets, base revision, and Git identity without disclosing repository metadata, content, settings, credentials, or personal data. Planning success is approval-required evidence only, and `.egeria` controls, source, managed surfaces, Git metadata, and every repository byte remain unchanged on planning success and refusal.

The approved executor consumes only that exact fingerprint, preserves optional Calendly selection/settings, performs the seven action writes once through an operation-specific writer, verifies an isolated VCS-free copy, freshly infers, appends `transition-portfolio-0-10-0-to-site-0-10-0`, persists state last with `lastSuccessfulVerification.kind: "profile-transition"`, proves final agreement and the exact nine-path diff, and stops for separate verified-final-diff approval. Failures retain the same conservative pre-write `not-required` and post-write `inspect-worktree` recovery distinction without automatic rollback. Recovery automation, certification, provider/deployment/publication action, and every other edge remain separate. This single finite edge does not justify `fast-check` or a generic lifecycle abstraction.
