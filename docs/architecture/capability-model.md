# Capability Model

**Status:** Controlling capability vocabulary through the current Calendly initial-scaffolding implementation and bounded provider certification

**Runtime status:** The seven `portfolio`/`site` descriptors and two recipes named below are executable in private builder-core. `booking-calendly` is an explicit optional initial-scaffolding selection with a certified subject-bound record, actual fresh-scaffold evidence, and passed protected-staging, provider-confirmed, and cleanup evidence; every other program capability and profile remains documentation-only.

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

The executable `portfolio` and `site` recipes are `0.7.0`. Their capability identifiers remain unchanged; the recipe advance records the materially changed default `standards@0.3.0` testing contract while retaining the `observability@0.2.0` composition introduced by recipe `0.6.0`. An initial-scaffolding request may explicitly add `booking-calendly`; dependency-first resolution adds its existing `section-composition` dependency, and the generated installed manifest records the resulting selection.

The planned P3B boundary delivers `multilingual` and `analytics` as optional capabilities during initial scaffolding and addable later through the completed P3 lifecycle; there is no composite profile or capability and no client-specific default recipe. `site-routing` remains the default capability for `site`, while each optional capability retains its own state, dependencies, migrations, verification, certification, and removal policy.

## Initial catalog

The current executable catalog contains exactly `standards`, `content-files`, `section-composition`, `deployment-cloudflare`, `observability`, `booking-calendly`, and `site-routing` for `portfolio` and `site`. The other rows remain program visibility only and have no runtime descriptor, resolver availability, generated surface, state, or provider effect yet.

State classifications below describe repository, external-provider, and persistent-data effects managed by the capability. Dependencies may also vary by an explicitly selected mode; those conditional rules are called out rather than hidden.

Profile inclusion distinguishes recipe defaults from independent selections. `dependency-only` means the resolver may add the capability to satisfy another supported selection, but it is not offered directly for that origin profile. Origin profiles remain informational after materialization; this policy controls scaffolding and migration prompts, not live inheritance.

| Capability | Delivery mode | State classifications | Removal policy | Profile inclusion | Required or conditional dependencies |
|---|---|---|---|---|---|
| `standards` | `hybrid` | `repository-stateful` | `reviewed` | default: portfolio, site, app, authenticated-app | Owns the ordinary standards package plus generated lint/type/test/browser-quality configuration; exact Vitest, React plugin, jsdom, Testing Library, Playwright, and axe package/script properties; named Node/jsdom projects and setup; starter unit/component/browser specifications; and the read-only quality workflow |
| `content-files` | `source-generated` | `repository-stateful` | `reviewed` | default: portfolio, site | `standards`; generated YAML 1.2 parsing uses ordinary dependency `yaml`, while exact development dependency `raw-loader` bundles YAML/Markdown as text without runtime filesystem reads; owns validated externalized accessibility copy |
| `section-composition` | `source-generated` | `repository-stateful` | `reviewed` | default: portfolio, site | `content-files`; owns Tailwind CSS and PostCSS package/configuration surfaces, global semantic design tokens, and responsive pure presentation |
| `deployment-cloudflare` | `hybrid` | `repository-stateful`, `external-stateful` | `reviewed` | default: portfolio, site, app, authenticated-app | `standards` |
| `observability` | `hybrid` | `repository-stateful`, `external-stateful` | `reviewed` | default: portfolio, site, app, authenticated-app | `deployment-cloudflare` |
| `booking-calendly` | `source-generated` | `repository-stateful` | `automatic` | optional: portfolio, site | `section-composition`; initial scaffolding also requires the strict paired destination/mode settings described below |
| `site-routing` | `source-generated` | `repository-stateful` | `reviewed` | default: site | `content-files`, `section-composition` |
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

### Executable observability boundary

`observability@0.2.0` combines exact replaceable package `@egeria-systems/observability@0.2.0` with generated application-owned infrastructure. The public package owns immutable provider-neutral operational events, bounded context, normalized error categories, allowlisted attributes, redaction, non-throwing dispatch, Better Stack protocol encoding, structured-log/browser sinks, and test assertions. It has no runtime dependency on Next.js, React, the DOM, Cloudflare, or a provider SDK.

Generated source registers Next.js request-error and browser instrumentation, reports web vitals, accepts only strict same-origin JSON envelopes at `/api/observability`, and reconstructs allowlisted events without raw errors, stacks, URLs, headers, cookies, form values, arbitrary attributes, or browser storage. Browser delivery explicitly omits credentials and referrer data. The route reads request streams only through the 8,192-byte cap and cancels oversized bodies before buffering the remainder. The Cloudflare adapter alone reads `BETTER_STACK_INGESTING_HOST`, `BETTER_STACK_SOURCE_TOKEN`, and `CF_VERSION_METADATA`, and uses `waitUntil()` only as best-effort, non-durable post-response work. `apps/web/wrangler.jsonc` remains fully owned by `deployment-cloudflare`; observability requires and infers Workers Logs enabled with head sampling `1`, default request/response invocation logs disabled, and the `CF_VERSION_METADATA` binding. The custom records use only the bounded package schema. Cloudflare can separately retain platform or framework errors and uncaught exceptions outside that schema, so the descriptor classifies those provider-controlled logs separately and protected-staging certification must verify their actual fields and retention before any production claim.

Security metadata classifies the capability as elevated, names the two provider secrets, Cloudflare Workers Logs and Better Stack source resources, the Better Stack ingestion host boundary, bounded operational telemetry, provider-controlled retention, and privileged provider/secret configuration. Generated source creates no provider resource, secret, rate-limit resource, WAF rule, queue, database, or analytics surface. The public same-origin endpoint has strict origin, media-type, byte-size, schema, vocabulary, correlation-token, and extra-field rejection, but origin checking is not authentication; deployment-level abuse and cost controls remain a protected-staging certification concern.

Repository removal, deployment-observability configuration, credential revocation or rotation, provider-resource disposition, retained-data disposition, and source/provider/credential recovery are separate reviewed requirements. The [fresh-scaffold runner](../../scripts/certify-production-observability.mjs) passed the bounded local journey at `ef845b1e0551d3b43e17969cc00f21960c90769b`, and the registry binds its reviewed [verification receipt](../implementation-evidence/2026-08-11-production-observability-certification-verification.md). The [manual protected-staging workflow](../../.github/workflows/production-observability-certification.yml), deployed exercise, and [provider receipt template](../implementation-evidence/production-observability-provider-receipt-template.md) are prepared but have not been dispatched or executed. Provider configuration, credentials, actual Better Stack delivery, Workers Logs UI receipt/retention, deployed execution, abuse controls, cleanup/recovery, performance, visual assessment, and human accessibility evaluation remain unproved. Retention and quotas are plan-dependent, and exact Next.js/OpenNext compatibility requires the actual pinned build and protected deployment evidence. The subject is `pending` under [`certifications/capabilities.json`](../../certifications/capabilities.json), requires `cleanup-recovery`, `deployed-application`, and `fresh-scaffold` evidence, and links its separate certification plan; no local result or prepared external path makes a production or WCAG-conformance claim.

### Executable Calendly boundary

Initial selection is one atomic request containing `destination` and `mode`. `destination` accepts at most 2,048 characters and must be HTTPS on `calendly.com` or `www.calendly.com`, use a non-root path, and contain no credentials, query string, fragment, normalization whitespace, or non-default port. `mode` is exactly `link`, `inline`, or `popup`. Stable validation issues do not contain rejected destinations.

`.egeria/project.yaml` permits one strict optional `capabilitySettings.booking-calendly` object and requires settings presence to agree exactly with the selected capability. `.egeria/state.json` records `booking-calendly@0.1.0`, its source-generated delivery, repository-stateful classification, automatic source-removal policy, and surface fingerprints. Existing projects with `capabilitySettings: {}` remain valid.

The capability owns five declared surfaces and matching file probes: the booking browser specification, client component, externalized booking copy, typed copy reader, and generated settings. Copy, reader, client, and browser files are application-owned after creation; settings remain managed. The builder kernel owns the conditional home route, preventing overlapping capability ownership. Removal means removing generated booking surfaces and settings; it does not imply provider configuration or data cleanup.

Security metadata declares both accepted Calendly hosts, their exact `frame-src` contribution, provider-controlled browser storage and scheduling data inside the cross-origin frame, provider-controlled retention, and elevated threat review. The generated presentation uses an ordinary link, a near-viewport direct iframe for inline mode, or an anchor enhanced to a native dialog and user-activated iframe for popup mode. It loads no Calendly host-page script or API and listens to no provider event.

The verification plan includes typecheck, Next build, development browser checks, and OpenNext/workerd preview browser checks. The retained `portfolio-calendly` popup fixture provides deterministic selected-state and stubbed-browser evidence while contract tests cover all three modes. That evidence does not call Calendly, make or confirm a booking, prove deployed or hosted execution, establish visual or human accessibility quality, or support a WCAG conformance claim.

## Certification coverage

The strict repository-owned [`certifications/capabilities.json`](../../certifications/capabilities.json) registry is keyed by executable capability identifier. Each subject binds the exact descriptor version and a canonical SHA-256 digest of the descriptor plus ordered required-evidence contract. Builder-core owns the private schema and pure descriptor-admission and closure decisions; registry presence alone never means certified.

Admission is actual and rejects absent, unknown, stale-version, stale-digest, or unauthorized backfill records. The materially changed observability and standards subjects no longer inherit the legacy exemption: each has an ordinary task-linked `pending` record, while four unchanged subjects remain `backfill-pending` and `booking-calendly` remains certified. Referenced plans and evidence must be repository-present, and every passed evidence entry and receipt binds its capability, descriptor subject, evidence-producing ancestor revision, and declared outcome. Receipts must also be complete, contain no unresolved prompt fields, and record affirmative overall and per-outcome review. Transition and all-certified closure both reject the current pending subjects until their separate tasks succeed.

The actual fresh-scaffold runner creates a new `portfolio` project through the compiled CLI, re-infers it, requires healthy diagnostics and an empty exact diff, and reuses the fixed generated-project install/build/browser verifier against that output. For observability, that repeatable runner supplies only the registered reviewed `fresh-scaffold` evidence; its separate manual protected-staging workflow and content-safe provider receipt path are prepared but unexecuted, so `deployed-application` and `cleanup-recovery` remain absent. A separately authorized exact-revision workflow and content-safe human receipt record the passed protected-staging application, provider-confirmed booking, cancellation, and cleanup outcomes that certify `booking-calendly@0.1.0`. These bounded journeys do not prove ongoing provider availability, production readiness, or WCAG conformance.

## Delivery and package ownership

Package-backed delivery uses an ordinary replaceable dependency. Source-generated delivery writes owned source under declared merge/ejection rules. Hybrid delivery combines both and declares each surface explicitly.

Initial public packages are limited to `@egeria-systems/standards` and `@egeria-systems/observability`, and they are created only in P0.3. P0.3 reserves private `builder-core` ownership of project/state schemas; P1 implements them there. They remain private until a proven independent consumer justifies extraction.

The full catalog preserves future visibility without prematurely implementing later stages. The executable boundary is limited to the seven descriptors and two recipes identified above. Calendly adds only initial-scaffolding settings and declared local surfaces. Observability adds only its exact public package, bounded generated adapters/configuration, declared secrets/resources, probes, and verification; it performs no provider mutation and installs no analytics. Neither capability adds a later-add command, existing-repository transformation, webhook, or new profile.
