# Capability Model

**Status:** Controlling capability vocabulary through the current app generation boundary

**Runtime status:** Private builder-core validates ten current capability descriptors and three generation recipes, including exact `app-foundation@0.1.0` and `app@0.1.0`. App project/state parsing, rendering, and state-last new-directory generation are implemented under the [app boundary](#accepted-app-architecture-boundary), which owns runtime scope, verification, and staged CLI/lifecycle refusals. All ten current subjects remain pending fresh certification; accepted receipts are historical evidence only for their exact prior descriptor digests. Exact incoming app planning and execution follow the boundary below; dedicated retained app fixtures and certification execution remain later work. Every other program capability and profile remains documentation-only.

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
  app-foundation@0.1.0
  + site-routing@0.4.0

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

The generation-executable recipes are `portfolio@0.10.0`, `site@0.11.0`, and `app@0.1.0`. The site recipe advances only `site-routing@0.4.0` and the reviewed Next.js security patch, which app also uses; the portfolio recipe remains frozen. The routing descriptor declares its generated nested error boundary's dependency on the already-installed exact `observability@0.3.0`; every established capability dependency remains unchanged, including exact `standards@0.4.0` and `deployment-cloudflare@0.3.0`. An initial-scaffolding request may explicitly add `booking-calendly`; dependency-first resolution adds its existing `section-composition` dependency, and the generated installed manifest records the resulting selection. Exact `app@0.1.0 = app-foundation@0.1.0 + site-routing@0.4.0` is accepted by the shared profile/project/state contracts and builder-core generation; the [app boundary](#accepted-app-architecture-boundary) retains separate CLI and lifecycle gates.

Multilingual and analytics remain independent optional capabilities during initial portfolio/site/app generation; exact later addition/removal supports all three profiles under the existing lifecycle preconditions; CLI creation remains limited to portfolio/site. There is no composite profile or capability and no client-specific default recipe. Exact `multilingual@0.1.0` and exact `analytics@0.1.0` remain separate executable subjects. `site-routing` is a default capability for site and app, while each optional capability retains its own state, dependencies, migrations, verification, certification, and removal policy.

## Initial catalog

The current catalog contains the nine established descriptors plus exact `app-foundation@0.1.0`. The established descriptors support portfolio, site, and app where declared; `site-routing@0.4.0` supports site and app, while `app-foundation` supports only app. Current recipe-catalog, project/state, rendering, and new-directory generation entries are `portfolio@0.10.0`, `site@0.11.0`, and `app@0.1.0`. App CLI and lifecycle availability is limited by the [staged boundary below](#accepted-app-architecture-boundary). The other rows remain program visibility only and have no runtime descriptor, resolver availability, generated surface, state, or provider effect yet.

State classifications below describe repository, external-provider, and persistent-data effects managed by the capability. Dependencies may also vary by an explicitly selected mode; those conditional rules are called out rather than hidden.

Profile inclusion distinguishes recipe defaults from independent selections. `dependency-only` means the resolver may add the capability to satisfy another supported selection, but it is not offered directly for that origin profile. Origin profiles remain informational after materialization; this policy controls scaffolding and migration prompts, not live inheritance.

| Capability | Delivery mode | State classifications | Removal policy | Profile inclusion | Required or conditional dependencies |
|---|---|---|---|---|---|
| `standards` | `hybrid` | `repository-stateful` | `reviewed` | default: portfolio, site; dependency-only: app, authenticated-app | Owns the ordinary standards package plus generated lint/type/test/browser-quality configuration; exact Vitest, React plugin, jsdom, Testing Library, Playwright, and axe package/script properties; named Node/jsdom projects and setup; starter unit/component/browser specifications; managed visual configuration; application-owned visual specification and profile baselines; and the read-only quality workflow |
| `content-files` | `source-generated` | `repository-stateful` | `reviewed` | default: portfolio, site; dependency-only: app, authenticated-app | `standards`; generated YAML 1.2 parsing uses ordinary dependency `yaml`, while exact development dependency `raw-loader` bundles YAML/Markdown as text without runtime filesystem reads; owns validated externalized accessibility copy |
| `section-composition` | `source-generated` | `repository-stateful` | `reviewed` | default: portfolio, site; dependency-only: app, authenticated-app | `content-files`; owns Tailwind CSS and PostCSS package/configuration surfaces, global semantic design tokens, and responsive pure presentation |
| `deployment-cloudflare` | `hybrid` | `repository-stateful`, `external-stateful` | `reviewed` | default: portfolio, site; dependency-only: app, authenticated-app | `standards`; exact OpenNext/Wrangler and platform configuration plus the managed manual protected deployment workflow |
| `observability` | `hybrid` | `repository-stateful`, `external-stateful` | `reviewed` | default: portfolio, site; dependency-only: app, authenticated-app | `content-files`, `deployment-cloudflare`, `section-composition` |
| `booking-calendly` | `source-generated` | `repository-stateful` | `automatic` | optional: portfolio, site, app | `section-composition`; initial scaffolding also requires the strict paired destination/mode settings described below |
| `site-routing` | `source-generated` | `repository-stateful` | `reviewed` | default: site, app | `content-files`, `section-composition`; exact `0.4.0` additionally requires `observability` for its generated nested error boundary |
| `app-foundation` | `hybrid` | `repository-stateful` | `reviewed` | default: app, authenticated-app; dependency-only: portfolio, site | `standards`, `deployment-cloudflare`, `observability`; exact ordinary generated-app dependency `effect@4.0.0-rc.112` |
| `application-persistence` | `hybrid` | `repository-stateful`, `external-stateful`, `persistent-data` | `export-and-remove` | default: authenticated-app; optional: app; dependency-only: portfolio, site | `app-foundation` |
| `transactional-email-resend` | `hybrid` | `repository-stateful`, `external-stateful` | `reviewed` | default: authenticated-app; optional: portfolio, site, app | `app-foundation` |
| `background-job-delivery` | `hybrid` | `repository-stateful`, `external-stateful` | `reviewed` | optional: portfolio, site, app, authenticated-app | `app-foundation` |
| `durable-contact-submissions` | `hybrid` | `repository-stateful`, `external-stateful`, `persistent-data` | `export-and-remove` | optional: portfolio, site, app, authenticated-app | `app-foundation`, `application-persistence`; email and jobs optional |
| `multilingual` | `source-generated` | `repository-stateful` | `reviewed` | optional: portfolio, site, app | `content-files`, `section-composition`, `observability`; optional composition with `site-routing` and `booking-calendly`; authenticated-app remains future visibility only |
| `analytics` | `hybrid` | `repository-stateful`, `external-stateful` | `reviewed` | optional: portfolio, site, app | Public profile; each provider selected independently |
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

## Accepted app architecture boundary

The `app@0.1.0` recipe directly selects only `app-foundation@0.1.0` and `site-routing@0.4.0`; declared dependencies supply the complete production-site content, navigation, contact, accessibility, responsive, and visual behavior. `app-foundation` is hybrid and owns the explicit generated server-source and test allowlist plus the exact merge-managed `/dependencies/effect` member for `effect@4.0.0-rc.112` and `/scripts/test:integration:cloudflare` member. The recipe selects the resolved graph, while builder-kernel alone owns the exact root `pnpm-lock.yaml` and `.egeria` state lifecycle. App rendering uses the existing production-site and multilingual presentation owners without creating a parallel UI.

Calendly, multilingual, and analytics remain independent optional choices. Fresh generation and each incoming transition must prove all eight subsets: none; booking-calendly; multilingual; analytics; booking-calendly plus multilingual; booking-calendly plus analytics; multilingual plus analytics; and booking-calendly plus multilingual plus analytics. No optional capability becomes an implicit app-foundation dependency.

Read-only planning and fingerprint-gated execution support exactly `portfolio@0.10.0 -> app@0.1.0` and `site@0.11.0 -> app@0.1.0`. Planning must classify every relevant path as preserve, create, replace, migrate structurally, or refuse; perform no UI or content deletion; preserve unrelated application-owned bytes; bind all influencing inputs; and refuse uncertainty before mutation. App-foundation has no removal executor or back-transition.

App-foundation and the nine existing descriptors extended to support app are ten current pending certification subjects under the coordinated plan. Historical evidence remains valid only for its exact prior descriptor digest and cannot certify these subjects. This lifecycle increment changes no certification status and authorizes no certification execution or provider action.

The selective runtime permits Effect only in generated application, infrastructure, composition, and delivery server modules. Request context stays explicit; the application owns the build-information service; Cloudflare and memory Layers implement it; delivery runs one lazy program once and interprets the full Cause. Builder-core, CLI, domain, presentation, client, and content remain Effect-free. The deployment capability alone owns `enable_request_signal`. The bounded cancellation claim covers the Effect fiber and response path, not already-started provider work. No retry, stateful backend, generic platform port, wrapper package, unstable import, or placeholder server action is introduced.

Builder-core admits exact app project/state contracts and state-last new-directory generation. CLI `create --profile app` remains rejected by a local schema derived from the shared profile identifier until its separately approved CLI increment. Public capability-addition and capability-removal planners support exact app projects for `booking-calendly@0.1.0`, `multilingual@0.1.0`, and `analytics@0.1.0` whenever the ordinary dependency, ownership, removal-policy, reference, Git, and approval preconditions pass. The existing executors recompute the plan, preserve unrelated capabilities/settings and compatible application-owned bytes, verify and re-infer, append the migration before persisting state, and finish with exact-byte verification and the verified-final-diff approval stop. No app-specific algorithm or migration family is added. The unchanged conservative reference guard refuses multilingual removal while the surviving generated analytics browser specification references the removable locale module; fresh-render compatibility does not bypass that precondition. App capability upgrades remain unsupported and have no app verification vector. Incoming app execution follows the exact transaction boundary below; dedicated retained app fixtures and certification execution remain later work. Transition visual promotion requires the separate exact-manifest human approval described below. The [program roadmap](../roadmaps/program-roadmap.md#p4--app-foundation) owns their sequencing and approval gates.

The generated app's `test:integration:cloudflare` script runs its Vitest integration configuration against the whole built Worker through `createTestHarness()`. Ordinary generated-project verification runs the conditional integration command after OpenNext build; generated quality and deployment workflows place the same command before browser or credential-bearing deployment steps. Exact app generation, optional-capability addition/removal, and incoming transitions require `worker-integration` immediately after `opennext-build`, with the owned script present and successfully completed; portfolio/site vectors remain unchanged. Generation validates the receipt against the rendered capability graph, and the lifecycle executors select the existing exact app receipt before migration/state construction. [State contracts](../../packages/builder-core/src/contracts/state.ts) own exact persisted and full verification vectors, including active app addition/removal and incoming transition receipts. Generated test source is not execution evidence: actual command outcomes, bundle boundaries, cancellation behavior, browser results, and limitations belong to the implementation evidence and review packet. No local result implies deployment, ongoing provider availability, accessibility conformance, or production readiness.

### Read-only incoming app transition boundary

The pure app-profile-transition policy consumes explicit source/target bytes, canonical ownership descriptors, validators, fingerprints, and reviewed visual evidence. The existing planner shell owns bounded repository and Git reads. Its sixteen source-profile/optional-subset cases retain exact selections and settings, preserve compatible application-owned bytes and unrelated valid package members, and classify the complete inventory without delete actions. Unknown identities, ejection, managed drift, invalid controls/content, collisions, changed Git identity, and unproved visual inputs refuse before any write or verifier execution.

Both edges merge only `/dependencies/effect` and `/scripts/test:integration:cloudflare`; portfolio additionally changes `/dependencies/next` and `/devDependencies/eslint-config-next`. An unrepresented dependency graph cannot use the fixed lockfile and therefore refuses. Builder-kernel replaces the root lockfile with exact `web-recipe-app-0.1.0` bytes and replaces the recognized workspace policy to retain the explicit native-build denial. New `.egeria` persistence remains outside the transformation batch. Private plan fingerprints bind raw and parsed controls, manifests, descriptors, recipes, ownership, settings, Git identity, every preserved path and action byte, and reviewed first-viewport evidence. Public action output contains sorted relative paths and stable reasons only.

Portfolio content migration reuses the exact generated strict YAML and content validators through fixed build-compiled modules; it never executes project-supplied code. It preserves valid source values, adds only required production-site navigation and localized page structures, validates both locale schemas and parity, and serializes deterministically. Site-to-app retains compatible production-site content without a YAML rewrite. The existing historical portfolio-to-site planner and seven-action executor keep their behavior.

### Incoming app transition execution

`applyProfileTransition` consumes only the exact approved fingerprint for the two incoming app edges above, across all sixteen source-profile/optional-subset combinations. The planner remains the canonical owner of policy and deterministic package/YAML materialization. Immediately before the first write, execution recomputes the complete plan, rechecks creation eligibility and exact Git identity, and rereads every action, preserved subject, and control. Any changed, missing, unsafe, or unproved input refuses before writer or verifier invocation. The existing atomic writer receives exact current/target bytes and remains policy-free; there are no delete actions or ejections.

Execution transforms the source once, verifies a VCS-free copy with the exact app Worker receipt, and freshly infers the bounded pending target while all three controls retain their source bytes. After those checks succeed, it writes the target project, appends exactly one validated migration, and persists installed state last. The only app migration identifiers are `transition-portfolio-0-10-0-to-app-0-1-0` and `transition-site-0-11-0-to-app-0-1-0`. Final project/state/migration/inference agreement, the exact dynamic dirty-path set, and exact source/control byte rereads precede `verified-final-diff-approval-required`. Before writes, recovery is `not-required`; every retained write prefix returns `inspect-worktree`, without automatic rollback, cleanup, reset, or commit. The historical portfolio-to-site ordering and migration remain unchanged. This proves bounded transactions and tested failure prefixes, not a generic transition framework or automatic recovery system.

### App transition visual evidence

`scripts/verify-app-transition-visuals.mjs` owns the separate four-asset contract. It materializes the compiled policy's fixed synthetic portfolio-transition inputs for all eight optional subsets in identity-owned temporary roots, then runs the generated checks and exact Linux/amd64 Chromium comparisons. It binds the complete generated input inventory, first-viewport fingerprints, toolchain, browser, source and compiled builder bytes, viewport dimensions, and image digests in one canonical manifest. Its disposable visual-spec overlay enables both multilingual viewport tests, retains the established heading normalization, intercepts external traffic, and records actual screenshots; it does not alter generated specifications or source fixtures.

Candidate mode requires one byte-identical desktop/mobile pair across the four monolingual subsets and one across the four multilingual subsets, followed by non-update reproducibility checks. Retained actuals must first stabilize as two consecutive byte-identical captures within a bounded poll independent of the expected image; Playwright's native pixel comparator can exclude antialiasing differences even at zero tolerance. Varying captures remain diagnostic artifacts, and stable differences still fail exact reproduction, subset, or baseline comparisons. Expected, actual, diff, report, and failure artifacts remain under ignored `generated-visual-artifacts/app-transitions`. Historical hashes are provenance comparisons only. A person must review all four images and approve the exact manifest SHA-256 before promotion. The promotion command accepts only that digest, rechecks source/candidate identities, refuses symlinks and existing destinations, and exclusively writes the four named app-transition PNGs. A partial exclusive-write failure retains its prefix for inspection and reports written paths; it never rolls back automatically. Default mode installs promoted assets only in disposable targets and compares all eight subsets without snapshot updates. The retained-fixture `verify:generated-visuals` boundary remains separate.

The bounded repository-quality job checks the exact pull-request head in the pinned native Linux container. Draft pull requests generate review candidates and retain their evidence for seven days; marking a pull request ready triggers ordinary non-update comparisons. Main pushes also compare. Hosted candidate success does not approve or promote assets, and no hosted mode can update source baselines.

Fixed reviewed portfolio evidence covers only matching synthetic settings and frozen fingerprints of runtime/build inputs, the screenshot specification, the exact app lockfile, and the four expected PNG identities. The input record is fixed before the candidate manifest and human approval; changed templates or images cannot authorize themselves by recomputing a new record. Unproved first-viewport customization refuses; compatible content outside that closure may be preserved. Site-to-app binds and preserves its existing compatible UI/content and baseline bytes. Screenshot equality and historical hash equality do not supply human approval or establish visual quality, accessibility conformance, deployed behavior, or production readiness.

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

Generation creates no GitHub environment, secret, branch rule, provider token, Cloudflare resource, route, domain, deployment, cleanup, or certification evidence. Source rollback, Worker/provider rollback, route/domain disposition, credential rotation/revocation, and provider/data recovery remain distinct. The prior descriptor subject was certified from separately accepted fresh-scaffold, deployed-application, and cleanup-recovery evidence at builder revision `ea5a8ae8a6b0aa5fd7b8bc3bab3e03a52242aee2` and generated revision `47eb9ef09ea412dbfcf14f69dda153fb14a0691b`; the current app-supporting subject remains pending. That bounded historical evidence does not establish ongoing provider availability, visual or performance quality, human accessibility, WCAG conformance, or production readiness.

### Executable observability boundary

`observability@0.3.0` combines exact replaceable package `@egeria-systems/observability@0.3.0` with generated application-owned infrastructure. The public package owns immutable provider-neutral safe operational events, distinct restricted error reports and diagnostic sinks, bounded context, normalized error categories, allowlisted attributes, guarded error normalization, redaction, non-throwing dispatch, Better Stack protocol encoding, structured-log/browser sinks, and test assertions. It has no runtime dependency on Next.js, React, the DOM, Cloudflare, or a provider SDK.

Generated source registers all three Next.js request-error inputs and browser error/rejection instrumentation, reports web vitals, exposes selected caught-error reporters, and installs five declared application-owned error surfaces: `app/error.tsx`, `app/global-error.tsx`, externalized observability copy, its typed copy reader, and the pure fallback presentation. The same-origin `/api/observability` route accepts distinct strictly bounded safe-event and restricted error-report envelopes, revalidates and re-sanitizes browser reports on the server, and cancels streams beyond 8,192 bytes before buffering the remainder. Browser delivery omits credentials, referrer data, URLs, storage, and persistent user/device/session identifiers. Workers custom records receive only the bounded safe operational event; only the Better Stack diagnostic adapter receives the restricted message, stack, and causes together with that safe event. Non-error operational events continue through the safe delivery path. The Better Stack encoding is provider-specific, but its input is a provider-neutral diagnostic report, so another provider requires an adapter and composition change rather than changes to capture or browser/framework boundaries.

The Cloudflare composition reads `BETTER_STACK_INGESTING_HOST`, `BETTER_STACK_SOURCE_TOKEN`, and `CF_VERSION_METADATA`, and uses `waitUntil()` only as best-effort, non-durable post-response work. `apps/web/wrangler.jsonc` remains fully owned by `deployment-cloudflare`; observability requires and infers Workers Logs enabled with head sampling `1`, default request/response invocation logs disabled, and the `CF_VERSION_METADATA` binding. Cloudflare can separately retain platform or framework errors and uncaught exceptions outside the custom safe schema, so the descriptor classifies those provider-controlled logs separately and the future protected-staging certification must verify their actual fields and retention before any production claim.

Restricted message and stack sanitization, byte/line bounds, guarded reads, path/query/fragment removal, and pattern redaction reduce exposure but are defense in depth, not a privacy guarantee. Stack strings are not source-map deobfuscated in this increment. Access, provider region, retention, deletion, credentials, and operator handling remain certification decisions.

Security metadata classifies the capability as elevated, names the two provider secrets, Cloudflare Workers Logs and Better Stack source resources, the Better Stack ingestion host boundary, bounded operational telemetry, provider-controlled retention, and privileged provider/secret configuration. Generated source creates no provider resource, secret, rate-limit resource, WAF rule, queue, database, or analytics surface. The public same-origin endpoint has strict origin, media-type, byte-size, schema, vocabulary, correlation-token, and extra-field rejection, but origin checking is not authentication; deployment-level abuse and cost controls remain a protected-staging certification concern.

Repository removal, deployment-observability configuration, credential revocation or rotation, provider-resource disposition, retained-data disposition, and source/provider/credential recovery are separate reviewed requirements. The prior exact `observability@0.3.0` subject, behavior-contract digest `sha256:24a3cb3361cd8f72a12a1926b512e087adb31ad120a62b70e06a68d9dcf90c99`, was certified from accepted `fresh-scaffold`, `deployed-application`, and `cleanup-recovery` evidence at exact revision `bdcc55f1bfa6eca392ce3e36bdc35adb6f085bad`. The current widened subject has behavior-contract digest `sha256:0fa9530d9b2b6de0438cadd400a80909e8f55a5cb6c3d7b3ecc59724088c5f43` and is pending fresh certification. Diagnostics run `31925083913` and recovery run `31925927776` bind the bounded live and recovery outcomes. The prior certified `observability@0.2.0` subject at `ee1e1df10fa2be2f09333efecd86de7f7a131d49` retains only historical evidence from the private protected-staging receipt; that exact prior subject cannot certify `0.3.0`. That historical certification does not establish durable delivery, ongoing provider availability, production readiness, privacy completeness, visual quality, human accessibility, or WCAG conformance.

### Executable Calendly boundary

Initial selection is one atomic request containing `destination` and `mode`. `destination` accepts at most 2,048 characters and must be HTTPS on `calendly.com` or `www.calendly.com`, use a non-root path, and contain no credentials, query string, fragment, normalization whitespace, or non-default port. `mode` is exactly `link`, `inline`, or `popup`. Stable validation issues do not contain rejected destinations.

`.egeria/project.yaml` permits one strict optional `capabilitySettings.booking-calendly` object and requires settings presence to agree exactly with the selected capability. `.egeria/state.json` records `booking-calendly@0.1.0`, its source-generated delivery, repository-stateful classification, automatic source-removal policy, and surface fingerprints. Existing projects with `capabilitySettings: {}` remain valid.

The capability owns five declared surfaces and matching file probes: the booking browser specification, client component, externalized booking copy, typed copy reader, and generated settings. Copy, reader, client, and browser files are application-owned after creation; settings remain managed. The builder kernel owns the conditional home route, preventing overlapping capability ownership. Removal means removing generated booking surfaces and settings; it does not imply provider configuration or data cleanup.

Security metadata declares both accepted Calendly hosts, their exact `frame-src` contribution, provider-controlled browser storage and scheduling data inside the cross-origin frame, provider-controlled retention, and elevated threat review. The generated presentation uses an ordinary link, a near-viewport direct iframe for inline mode, or an anchor enhanced to a native dialog and user-activated iframe for popup mode. It loads no Calendly host-page script or API and listens to no provider event.

The verification plan includes typecheck, Next build, development browser checks, and OpenNext/workerd preview browser checks. The retained `portfolio-calendly` popup fixture provides deterministic selected-state and stubbed-browser evidence while contract tests cover all three modes. That evidence does not call Calendly, make or confirm a booking, prove deployed or hosted execution, establish visual or human accessibility quality, or support a WCAG conformance claim.

### Executable multilingual boundary

Exact `multilingual@0.1.0` is source-generated, repository-stateful, and reviewed. It is independently selectable for `portfolio`, `site`, and `app` during initial generation; exact fingerprint-gated later addition and removal support all three profiles under the [app lifecycle preconditions](#accepted-app-architecture-boundary). It adds no package, provider, credential, platform resource, persistent data, external action, new profile, or generic lifecycle API. Default generation without multilingual remains byte-stable.

The supported locales are exactly `en-CA` and `fr-CA`, and the default locale is `en-CA`. Every public URL, including the default locale, is locale-prefixed. An unprefixed public request redirects once to the best supported locale selected from `Accept-Language`, or to `en-CA` when no supported preference exists. An explicit unsupported locale resolves through not-found behavior rather than silently selecting another locale. Runtime content has no runtime translation fallback. Catastrophic global-error rendering may use the default locale only when no supported locale can be recovered from the request path.

Locale negotiation uses the Edge `middleware.ts` convention as an explicit adapter-compatibility boundary. Next 16's replacement `proxy.ts` convention is Node-only, while the pinned OpenNext Cloudflare adapter rejects Node middleware; migrating this surface to `proxy.ts` therefore requires a later adapter upgrade that passes the same Next and OpenNext builds. The deprecation warning is accepted only for this bounded compatibility reason.

Each profile has one strict localized catalog per supported locale. Parsing rejects unknown fields, and cross-locale validation treats missing keys, unused keys, and structural parity differences in pages, routes, sections, navigation, metadata, accessibility copy, observability copy, and optional booking copy as build-time errors that fail closed. Localized navigation, route metadata language alternates, language switching, and site sitemap alternates derive from the same validated catalogs and route model. The generic French starter catalog is builder-authored example copy, not a client translation or a linguistic-quality claim; client-specific copy requires human replacement and review.

The descriptor owns `apps/web/middleware.ts`; `apps/web/app/[locale]/layout.tsx`, `apps/web/app/[locale]/[[...segments]]/page.tsx`, and `apps/web/app/[locale]/not-found.tsx`; `apps/web/src/i18n/locale.ts`, `apps/web/src/i18n/localized-profile.ts`, `apps/web/src/i18n/localized-content.ts`, and `apps/web/src/i18n/read-localized-content.ts`; `apps/web/src/presentation/localized-page.tsx`; `apps/web/src/integrations/booking/localized-booking.tsx`; `apps/web/tests/component/multilingual-page.test.tsx`, `apps/web/tests/e2e/multilingual-routing.spec.ts`, `apps/web/tests/unit/locale.test.ts`, and `apps/web/tests/unit/localized-content.test.ts`; and both application-owned locale catalogs. Existing single-locale sources remain an inactive recovery baseline while the capability is installed. All other surfaces keep their existing owners. Multilingual composition replaces shared bytes only in the builder-kernel root layout, observability error boundary, standards visual specification, and, for `site` and `app`, the site-routing sitemap and browser specification; their descriptors and installed fingerprints remain owned by those existing boundaries without overlap. Addition supports Calendly before multilingual and multilingual before Calendly. Removal restores shared single-locale bytes and deletes unchanged managed multilingual surfaces. Modified application-owned locale catalogs require explicit owner review, and their preservation or ejection must be decided before transformation approval of removal. Source recovery, repository recovery, and any future provider or deployed recovery remain separate.

The prior `multilingual@0.1.0` descriptor subject was certified from separately planned and accepted `fresh-scaffold` and `existing-repository-lifecycle` evidence at revision `96b587a254cf6fc859867d6fc66c7e0c900c4cfd`; the current app-supporting subject remains pending. Implementation evidence, ordinary unit/component/browser/build results, and registry admission alone do not certify multilingual behavior. The accepted historical certificate does not establish linguistic quality, visual quality, human accessibility, deployed behavior, production readiness, privacy completeness, or WCAG conformance. Analytics implementation and the combined real-client journey required separate successor acceptance.

### Executable analytics boundary

Exact `analytics@0.1.0` is hybrid, repository-stateful and external-stateful, with reviewed removal. It is independently selectable for exact current `portfolio`, `site`, and `app` initial generation; exact later addition/removal supports all three profiles under the [app lifecycle preconditions](#accepted-app-architecture-boundary). It is not a recipe default and has no dependency on `observability`. Its generated sources import no observability package or adapter and emit no observability event. The implementation adds no public package, provider credential, secret, provider API client, generic lifecycle executor, profile, persistent-data store, or deployed resource.

The runtime provider settings are independently optional strict objects for Cloudflare Web Analytics, Google Analytics 4, and Microsoft Clarity. Search Console and Looker Studio are independently represented operational integration settings. A request must select at least one runtime provider or Search Console; Looker Studio requires GA4, and Clarity requires the exact `not-directed-to-minors` audience declaration. Site tokens, measurement identifiers, project identifiers, and verification tokens are provider identifiers that are public in generated browser source, not secrets. Builder contracts still validate bounded safe identifier syntax, fingerprint the exact values, and redact them from plans and failures.

The only supported consent policy is `explicit-opt-in`. It is deny-by-default for every selected runtime provider, supports withdrawal, and starts no provider script or request before a current grant. The [purpose-based consent decision](../adr/0012-purpose-based-analytics-consent.md) owns the architecture, and the exact executable contract follows.

#### Purpose-based consent contract

Purpose is the canonical choice key. The current provider mapping is fixed and one-to-one: `cloudflare-web-analytics` implements `aggregate-traffic-and-performance`, `google-analytics-4` implements `audience-measurement`, and `microsoft-clarity` implements `consented-experience-analysis`. Provider identifiers are disclosure and invalidation context, not visitor switches; project settings remain the provider-selection authority.

The first-party key `egeria.analytics.consent.v2` stores one strict record:

```ts
type AnalyticsPurposeIdentifier =
  | "aggregate-traffic-and-performance"
  | "audience-measurement"
  | "consented-experience-analysis";

type AnalyticsPurposeDecision = Readonly<{
  purpose: AnalyticsPurposeIdentifier;
  decision: "granted" | "denied";
}>;

type AnalyticsConsentContextEntry = Readonly<{
  provider: AnalyticsProviderIdentifier;
  purpose: AnalyticsPurposeIdentifier;
}>;

type AnalyticsConsentRecordV2 = Readonly<{
  schemaVersion: 2;
  noticeVersion: 1;
  decidedAt: string;
  expiresAt: string;
  providerPurposeContext: readonly AnalyticsConsentContextEntry[];
  purposes: readonly AnalyticsPurposeDecision[];
}>;
```

`decidedAt` and `expiresAt` are UTC instants, and expiry is exactly 180 days after the decision. `providerPurposeContext` and `purposes` are separate, use deterministic code-point order, and store no provider configuration values. The context contains exactly one entry for every configured provider and its one current purpose. The decisions contain exactly one entry for every unique configured purpose. Neither collection permits a duplicate, missing, extra, or unknown value. The record's schema, exact `noticeVersion: 1`, shape, timestamps, purpose decisions, and complete provider-purpose context are revalidated before any provider loads. A legacy, malformed, partial, expired, future-dated, notice-stale, or configuration-stale record grants nothing, and no legacy grant is promoted.

The localized control defaults every purpose to denied, discloses the configured purposes, gives allow-all and deny-all equal prominence, supports purpose-specific decisions, stays persistently reopenable, and provides withdrawal. A current in-memory choice does not become durable unless the complete record persists successfully. A reduction is any formerly granted purpose becoming denied, absent, expired, or invalid; reductions take effect fail-closed in memory before bounded provider effects. A successful persisted reduction reloads: complete withdrawal or invalidation yields a provider-free document, while partial reduction can reload only the providers for purposes that remain granted. More-permissive persisted changes may load only newly granted current providers and retain the one-loader invariant.

The browser storage event synchronizes a persisted change across other open tabs, which revalidate the whole record and apply the same expansion or reduction path. A storage failure leaves only a tab-local in-memory result and is not broadcast. If a stale grant cannot be removed or replaced, revocation remains `incomplete`: the tab stays fail-closed, does not report successful withdrawal, and does not automatically reload into that stale grant.

Google denial updates `analytics_storage`, `ad_storage`, `ad_user_data`, and `ad_personalization` to `denied`. Clarity receives consent-v2 denial plus its documented cookie-erasure call. The runtime may expire known accessible `_ga`, `_ga_*`, `_clck`, and `_clsk` first-party cookies. Cloudflare Web Analytics documents no client revocation operation for its manual beacon. These bounded effects do not unload executed code, cancel every in-flight request, erase provider-held data, or replace the safe reload that omits denied providers.

The stored record is a local technical preference, not an audit receipt, identity record, provider-erasure receipt, proof of informed consent, or legal-compliance artifact. It adds no dependency, backend, provider mutation, deployment, certification, compliance claim, or observability coupling.

Provider contracts retain stable unique loader identifiers and the fixed non-advertising purposes above. Repeated grant and navigation insert each selected script at most once. GA4 advertising storage, user data, and personalization remain denied, and the integration emits no custom events or manual page-view stream. Clarity advertising storage remains denied. Provider-native page and navigation measurement supplies the selected analytics behavior. Search Console emits only Google verification metadata. Looker Studio emits no runtime code and records only the operator contract for a GA4 connector.

The descriptor and generated provider declaration enumerate potential or selected external domains, Content Security Policy contributions, browser storage, cookies, data purposes and classes, provider-controlled retention, account/property/project resources, and privileged operator configuration. Cloudflare Web Analytics uses its manual beacon host and collection endpoint; GA4 uses only non-advertising Google tag and analytics endpoints; Clarity uses its documented tag, collection, and Bing support endpoints. Operator guidance states that provider accounts, verification state, reports, dashboards, retained provider data, and third-party cookies are outside repository lifecycle authority.

The analytics descriptor owns the generated strict settings, provider contract and runtime, localized `en-CA` and `fr-CA` consent catalogs and reader, provider-neutral client control, operator guide, and unit/component/browser specifications. The builder-kernel root layout remains its existing owner and is replaced compositionally by analytics-aware single-locale or multilingual variants without overlapping descriptor ownership. All other surfaces retain their existing owners. This makes analytics-first then multilingual, multilingual-first then analytics, removal in either order, and analytics re-add deterministic without changing the exact multilingual descriptor or its behavior-contract digest.

Initial generation and later add/remove/re-add use the existing exact planner, writer, verification, re-inference, migration append, state-last persistence, post-state inference, expected-diff, and final-byte contracts. Analytics addition migrations are exact `add-analytics-0-1-0`; removal uses `remove-analytics-0-1-0`. Removal requires repository reference review plus explicit provider-account, retained-data, storage, and cookie disposition. Modified application-owned operator guidance is preserved/ejected under the existing reviewed removal rules. No builder command provisions, configures, queries, or deletes provider state.

The generic retained `site-multilingual-analytics` fixture selects all three runtime providers, Search Console, and Looker Studio. Provider origins are locally intercepted; the fixture proves deterministic generation, exact state/inference, strict copy/settings, no request before grant, one-time loading after grant, persistent denial, withdrawal reload, Search Console metadata, automated accessibility, unit/component checks, lint/typecheck, Next/OpenNext builds, and development/workerd browser behavior. It is not provider-confirmed, deployed, visual-quality, human-accessibility, privacy-completeness, production-readiness, legal-compliance, or WCAG-conformance evidence.

Analytics certification completed as a separate successor for exact `analytics@0.1.0` from accepted `cleanup-recovery`, `deployed-application`, `existing-repository-lifecycle`, `fresh-scaffold`, and `provider-confirmed` evidence. The bounded certification used synthetic non-production provider resources and completed their recorded cleanup; it authorizes no production or client deployment, legal-compliance claim, real-client data, publication, paid-provider change, or combined real-client action.

The one-time 2026-08-27 analytics implementation-lane exception permits this implementation from accepted multilingual `main@2033048c79a777af7e7d2725784bac6e9be3433f` while multilingual certification owns its separate worktree and artifacts. Multilingual certification merges first; analytics then rebases onto certified accepted main, revalidates the unchanged multilingual subject, reruns affected checks, and completes incremental CodeRabbit review. There is no concurrent merge, the exception is not precedent, and any multilingual descriptor, digest, or certified-behavior change requires an explicit pending or recertification decision.

## Certification coverage

The strict repository-owned [`certifications/capabilities.json`](../../certifications/capabilities.json) registry is keyed by executable capability identifier. Each subject binds the exact descriptor version and a canonical SHA-256 digest of the descriptor plus ordered required-evidence contract. Builder-core owns the private schema and pure descriptor-admission and closure decisions; registry presence alone never means certified.

Clean-checkout admission rejects absent, unknown, stale-version, or stale-digest records without reading ignored private artifacts. Before the app contract digest change, the following prior descriptor subjects had accepted certification evidence. Exact `standards@0.4.0` was certified from its accepted task-linked `existing-repository-lifecycle` and renewed `fresh-scaffold` receipt at evidence revision `d7f9dac6e25d5dde32015968d0912b45e73644e7`; `observability@0.3.0` and `deployment-cloudflare@0.3.0` were certified from exact task-linked receipts; the prior `booking-calendly@0.1.0` descriptor subject was certified from exact local evidence revision `b30e10b86b9ac9ef8dfdf1e8fa8e4077e2abe059` and protected/provider evidence revision `f9bd78f115c2118afd6dcc17ce49b2bfe34ca10d`; exact `content-files@0.4.0` was certified from accepted local `fresh-scaffold` evidence at revision `f03b9f624c370728f678924ce34e5287558d2a87`; exact `section-composition@0.3.0` was certified from accepted local `fresh-scaffold` evidence at revision `f74459c8833833186bb651c116ed524e51044677`; exact `site-routing@0.3.0` was certified from accepted local `fresh-scaffold` evidence at revision `77cea944513e521939bf4de088048f67acdfbc3c`; exact `multilingual@0.1.0` was certified from accepted local `existing-repository-lifecycle` and `fresh-scaffold` evidence at revision `96b587a254cf6fc859867d6fc66c7e0c900c4cfd`; and exact `analytics@0.1.0` was certified from all five required outcomes at revision `a97341ea628210b6fa713fb12461084f20c3f8da`. Before a certification workflow updates the tracked registry, the separately invoked local private-artifact gate requires every referenced plan and evidence receipt and binds each passed entry and receipt to its capability, descriptor subject, evidence-producing ancestor revision, and declared outcome. Those accepted receipts are historical evidence only for their exact prior descriptor digests. Current admission passes for ten coordinated pending records, while `all-certified` closure rejects only those ten pending subjects.

The following historical subjects are identified by their exact behavior-contract digests at their accepted evidence revisions. Their version strings alone do not identify the current app-supporting subjects.

| Historical descriptor subject | Prior behavior-contract digest |
| --- | --- |
| `site-routing@0.4.0` | `sha256:17e62c4468bc05480828d23471b63afc29e19eb6a9bff07eee1f99d30cd7b3e3` |
| `multilingual@0.1.0` | `sha256:016afd467349fde8ffeb821fe672cf60004f8e10916141c4f3837a81afcb1d41` |
| `analytics@0.1.0` | `sha256:ca2e69a35e935eab011f0543fdf140e644a0dec490650298bdfba730e2e9d378` |

Historically, at production-site closure, descriptor admission and both then-current closure policies passed because task-linked `site-routing@0.4.0` had accepted evidence for both required outcomes. The historical `site-routing@0.3.0` receipt remains limited to that exact prior subject; later pending capability records do not alter that historical closure.

The Task 8B successor runner used the compiled CLI for fresh scaffolding of a `portfolio` project, re-inferred it, required healthy diagnostics and an empty exact diff, and reused the existing fixed generated-project verifier, including deterministic visual regression. Its accepted receipt certifies only the prior descriptor digest for exact `standards@0.4.0` at evidence revision `d7f9dac6e25d5dde32015968d0912b45e73644e7`; historical `standards@0.3.0` evidence remains limited to that prior subject. Accepted `observability@0.3.0` evidence remains historical for its exact prior descriptor digest. The accepted prior-digest `booking-calendly@0.1.0` evidence remains historical, and the prior lifecycle digest was certified only by its exact local and protected/provider receipts; the current app-supporting digest remains pending. These bounded journeys do not prove ongoing provider availability, visual quality, production readiness, or WCAG conformance.

## Delivery and package ownership

Package-backed delivery uses an ordinary replaceable dependency. Source-generated delivery writes owned source under declared merge/ejection rules. Hybrid delivery combines both and declares each surface explicitly.

Initial public packages are limited to `@egeria-systems/standards` and `@egeria-systems/observability`, and they are created only in P0.3. P0.3 reserves private `builder-core` ownership of project/state schemas; P1 implements them there. They remain private until a proven independent consumer justifies extraction.

The full catalog preserves future visibility without prematurely implementing later stages. The current implementation is limited to ten descriptors and three generation recipes; app project/state parsing, generation, exact optional-capability addition/removal, and incoming transitions follow the [app boundary](#accepted-app-architecture-boundary), which owns the remaining CLI and lifecycle gates. Deployment adds only its declared workflow/security/state contract and performs no external action during generation. Calendly adds only initial-scaffolding settings and declared local surfaces. Multilingual adds only strict locale-prefixed source, application-owned locale catalogs, and exact lifecycle behavior. Analytics adds only strict redacted settings, declared source/content/test surfaces, explicit-opt-in provider loading, operational-integration metadata, exact lifecycle behavior, and locally stubbed verification; it performs no provider provisioning or mutation, no deployment, no legal-compliance claim, and no certification. Observability adds only its exact public package, bounded generated adapters/configuration, declared secrets/resources, probes, and verification; it performs no provider mutation and remains independent from analytics.

The implemented existing-repository boundary includes read-only `plan-add`, fingerprint-gated `apply-add`, read-only `plan-remove`, and fingerprint-gated `apply-remove` for exact `booking-calendly@0.1.0`, `multilingual@0.1.0`, and `analytics@0.1.0`; read-only `plan-upgrade` and exact `apply-upgrade` for the `standards@0.3.0` to `standards@0.4.0` and `site-routing@0.3.0` to `site-routing@0.4.0` edges; and accepted read-only `plan-profile-transition` plus exact fingerprint-gated `apply-profile-transition` for exact `portfolio@0.10.0` to historical `site@0.10.0`. Application requires the same clean attached linked worktree and exact private plan input, transforms once, verifies an isolated copy without VCS metadata, requires pending inference and the exact transformed bytes, appends one successful migration record containing only completed checks, persists state last with the same conservative receipt, requires final state/inference and the exact dirty paths, then rereads exact migration/source/control bytes before stopping for verified-final-diff approval. Removal planning verifies the installed recipe and exact managed/shared bytes; classifies unchanged capability-owned application files for deletion and modified or already-ejected application-owned files for preservation/ejection; and returns a redacted fingerprinted approval plan with no write. Its fingerprint-bound review requirements require repository-wide review for surviving references to removed surfaces and exact-path reconciliation for any preserved/ejected capability file before transformation approval. Analytics removal additionally requires provider-account, retained-data, browser-storage, and cookie disposition review. Accepted removal-reference hardening for all three exact removable capabilities scans bounded tracked and non-ignored-untracked Git-visible projected content, refuses exact surviving references, fingerprints path-only heuristic, dynamic-loading, and incomplete-coverage warnings, and recomputes the guarded plan before writing. The private analyzer uses the finite planner-owned tokens `calendly`, `multilingual`, and `analytics`; no guard contacts providers, and package-backed analysis remains deferred until a concrete removable package exists. Exact Calendly removal execution was accepted-main integrated earlier at `main@7f59e8b093edb7be617cd2a30bfb4ebaa6a8ab6e`; exact multilingual implementation is accepted at `main@2033048c79a777af7e7d2725784bac6e9be3433f` and certified at evidence revision `96b587a254cf6fc859867d6fc66c7e0c900c4cfd`; exact analytics implementation is accepted at `main@aa0bcd7e315b11f07e0f4207d11e230ce911b2f4` and certified at evidence revision `a97341ea628210b6fa713fb12461084f20c3f8da`. Pull requests 48, 49, and 50 make the standards executor and portfolio-to-site planner/executor accepted-main integrated, with the transition executor accepted at `main@641db9537f5dea4911b0b727eb083f8d6d359204`; their private control persistence is accepted at `main@532a7cd6e874db13ac8c4b1d2f376abe83862772`. Exact portfolio-to-site transition lifecycle certification is complete for the compiled plan/apply/refusal matrix and operation-specific retained-prefix boundaries at evidence revision `8098c68c82aaa35a59345706c851e8111d463111`; it does not merge runtime policy or operation-specific effects. Exact `content-files@0.4.0` was certified at evidence revision `f03b9f624c370728f678924ce34e5287558d2a87`, exact `section-composition@0.3.0` was certified at evidence revision `f74459c8833833186bb651c116ed524e51044677`, historical exact `site-routing@0.3.0` was certified at evidence revision `77cea944513e521939bf4de088048f67acdfbc3c`, and prior-digest `site-routing@0.4.0` was certified from both required outcomes at evidence revision `6034d7330af912d1a1b9bcff3323ed360ebee2d0`. P3 Gate 3 closure is approved, closed, integrated, and reconciled. Historical analytics certification is complete only for its prior descriptor digest; current app-supporting certification and real-client work remain separately gated. A generic lifecycle executor, any further upgrade or profile-transition edge, and automated recovery remain planned. The boundary adds no webhook, new profile, provider API, publication, or production authority. The [program roadmap](../roadmaps/program-roadmap.md#p3c--automated-removal-reference-hardening) owns the exact accepted candidate, accepted-main ancestry, tree identity, post-merge job dispositions, and closure status. P3C is complete. P4 is the next eligible phase, but this closure does not authorize P4 planning or implementation.

The production-site increment adds only the second exact capability edge, `site-routing@0.3.0` to `0.4.0`, from `site@0.10.0` to `site@0.11.0`. Its read-only planner and fingerprint-gated state-last executor reuse the accepted operation-specific lifecycle contract without introducing a generic executor, another profile transition, provider behavior, deployment, publication, or runtime certification authority.

### First supported upgrade edge

The approved source plan owns the [first supported upgrade planning boundary](../roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md#first-supported-upgrade-planning-boundary). It declares exact repository-only `standards@0.3.0` to `standards@0.4.0` as a capability edge and owns its endpoint evidence, command, agreement, fingerprint, refusal, no-mutation, compatibility, executor, recovery, and approval contracts. Merged pull request 47 integrates only read-only planning at accepted `main@138b5d712ab22016c020eb1c2a3e56e0efc89a5a`: exact version-specific catalog/recipe snapshots, installed-source inference and agreement, six target actions, control/target fingerprints, Git containment, privacy-safe output, and refusal without mutation. This model contributes the existing invariant that installed capabilities are authoritative while original recipe `0.9.0` provenance and the independently versioned project/state/migration `1.0.0` controls plus builder `0.0.0` are not upgrade subjects.

Exact fingerprint-gated compiled `apply-upgrade` is accepted for only that edge by pull request 48 at `main@af8898b533f4a7ccf08c83bd7818312a5f27c3c0`. Its private operation-specific executor/writer recomputes planning and Git identity before the six-action write, transforms once, verifies and freshly infers before the exact migration append, persists state last with `lastSuccessfulVerification.kind: "capability-upgrade"`, reruns agreement, proves the exact eight-path diff, and stops for separate verified-final-diff approval. Planning approval, execution, verification, persistence, recovery, and verified-final-diff approval remain separate. Every failure after a committed write retains an inspectable prefix and never triggers automatic rollback. Accepted execution does not certify, deploy, publish, approve a generated-project final diff, establish browser/workerd or provider behavior, prove visual quality or accessibility conformance, or establish lifecycle/security certification or production readiness. With all four concrete executors accepted, the evidence-gated private extraction shares only the exact three-control read/parse/raw-source mechanics plus canonical migration append/reread validation and state serialization/write mechanics. The control reader does not catch exceptions, and it maps every non-file read result, including a structured reader error, to `undefined`; operation-specific callers retain their accepted call timing, policy, and failure classification. Both helpers remain internal unless later evidence independently satisfies package extraction. The finite single-edge matrix retains named examples; `fast-check` remains deferred until a later graph is materially combinatorial.

### First supported profile-transition edge

The approved source plan owns the [planning](../roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md#first-supported-profile-transition-planning-boundary) and [execution](../roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md#first-supported-profile-transition-execution-boundary) contracts for exact `portfolio@0.10.0` to `site@0.10.0`. Pull request 49 accepted read-only compiled `plan-profile-transition --directory <absolute-existing-linked-worktree> --to-profile site` at `main@612a963ab96221837b1c8ac815f41e90736d292e`, with no caller-supplied source profile. Installed capabilities remain authoritative: the target manifest preserves every exact agreed optional subject, preserves the five exact shared default subjects, and adds only `site-routing@0.3.0` for the default edge. Builder-core owns transition support, agreement, seven render-derived actions, private fingerprint material, refusal, privacy, no-mutation policy, bounded Git/filesystem effects, and the transition workflow; the CLI owns only strict arguments, path resolution, one-line JSON, and stable exits.

Planning requires clean stable attached linked-worktree identity before and after planning, exact project/state/migration/recipe/capability/inference/surface agreement, absent create targets including Git-ignored targets, and no ejection or managed drift. Its deterministic digest privately binds exact controls, inputs, action subjects/targets, base revision, and Git identity without disclosing repository metadata, content, settings, credentials, or personal data. Planning success is approval-required evidence only, and `.egeria` controls, source, managed surfaces, Git metadata, and every repository byte remain unchanged on planning success and refusal.

The approved executor consumes only that exact fingerprint, preserves optional Calendly selection/settings, performs the seven action writes once through an operation-specific writer, verifies an isolated VCS-free copy, freshly infers, appends `transition-portfolio-0-10-0-to-site-0-10-0`, persists state last with `lastSuccessfulVerification.kind: "profile-transition"`, proves final agreement and the exact nine-path diff, and stops for separate verified-final-diff approval. Failures retain the same conservative pre-write `not-required` and post-write `inspect-worktree` recovery distinction without automatic rollback. Recovery automation, certification, provider/deployment/publication action, and every other edge remain separate. This single finite edge does not justify `fast-check` or a generic lifecycle abstraction.
