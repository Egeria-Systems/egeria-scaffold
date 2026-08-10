# Capability Model

**Status:** Controlling capability vocabulary through the current Calendly initial-scaffolding implementation and local certification foundation

**Runtime status:** The seven `portfolio`/`site` descriptors and two recipes named below are executable in private builder-core. `booking-calendly` is an explicit optional initial-scaffolding selection with a pending subject-bound certification record and actual fresh-scaffold evidence; every other program capability and profile remains documentation-only.

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

The executable `portfolio` and `site` recipes remain at `0.5.0` with unchanged defaults. An initial-scaffolding request may explicitly add `booking-calendly`; dependency-first resolution adds its existing `section-composition` dependency, and the generated installed manifest—not a changed recipe—records the resulting selection.

## Initial catalog

The current executable catalog contains exactly `standards`, `content-files`, `section-composition`, `deployment-cloudflare`, `observability`, `booking-calendly`, and `site-routing` for `portfolio` and `site`. The other rows remain program visibility only and have no runtime descriptor, resolver availability, generated surface, state, or provider effect yet.

State classifications below describe repository, external-provider, and persistent-data effects managed by the capability. Dependencies may also vary by an explicitly selected mode; those conditional rules are called out rather than hidden.

Profile inclusion distinguishes recipe defaults from independent selections. `dependency-only` means the resolver may add the capability to satisfy another supported selection, but it is not offered directly for that origin profile. Origin profiles remain informational after materialization; this policy controls scaffolding and migration prompts, not live inheritance.

| Capability | Delivery mode | State classifications | Removal policy | Profile inclusion | Required or conditional dependencies |
|---|---|---|---|---|---|
| `standards` | `hybrid` | `repository-stateful` | `reviewed` | default: portfolio, site, app, authenticated-app | Owns the ordinary standards package plus generated lint/type/browser-quality configuration, exact Playwright/axe package and script properties, the content-agnostic starter specification, and the read-only quality workflow |
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

### Executable Calendly boundary

Initial selection is one atomic request containing `destination` and `mode`. `destination` accepts at most 2,048 characters and must be HTTPS on `calendly.com` or `www.calendly.com`, use a non-root path, and contain no credentials, query string, fragment, normalization whitespace, or non-default port. `mode` is exactly `link`, `inline`, or `popup`. Stable validation issues do not contain rejected destinations.

`.egeria/project.yaml` permits one strict optional `capabilitySettings.booking-calendly` object and requires settings presence to agree exactly with the selected capability. `.egeria/state.json` records `booking-calendly@0.1.0`, its source-generated delivery, repository-stateful classification, automatic source-removal policy, and surface fingerprints. Existing projects with `capabilitySettings: {}` remain valid.

The capability owns five declared surfaces and matching file probes: the booking browser specification, client component, externalized booking copy, typed copy reader, and generated settings. Copy, reader, client, and browser files are application-owned after creation; settings remain managed. The builder kernel owns the conditional home route, preventing overlapping capability ownership. Removal means removing generated booking surfaces and settings; it does not imply provider configuration or data cleanup.

Security metadata declares both accepted Calendly hosts, their exact `frame-src` contribution, provider-controlled browser storage and scheduling data inside the cross-origin frame, provider-controlled retention, and elevated threat review. The generated presentation uses an ordinary link, a near-viewport direct iframe for inline mode, or an anchor enhanced to a native dialog and user-activated iframe for popup mode. It loads no Calendly host-page script or API and listens to no provider event.

The verification plan includes typecheck, Next build, development browser checks, and OpenNext/workerd preview browser checks. The retained `portfolio-calendly` popup fixture provides deterministic selected-state and stubbed-browser evidence while contract tests cover all three modes. That evidence does not call Calendly, make or confirm a booking, prove deployed or hosted execution, establish visual or human accessibility quality, or support a WCAG conformance claim.

## Certification coverage

The strict repository-owned [`certifications/capabilities.json`](../../certifications/capabilities.json) registry is keyed by executable capability identifier. Each subject binds the exact descriptor version and a canonical SHA-256 digest of the descriptor plus ordered required-evidence contract. Builder-core owns the private schema and pure descriptor-admission and closure decisions; registry presence alone never means certified.

Admission is actual and rejects absent, unknown, stale-version, stale-digest, or unauthorized backfill records. The transition freezes the six accepted pre-foundation identifier/version/digest subjects, so a material legacy change cannot inherit the exemption. Referenced plans and evidence must be repository-present, and every passed evidence entry and receipt binds its capability, descriptor subject, evidence-producing revision, and declared outcome. Current P2 closure rejects the current `booking-calendly` pending record; later all-certified closure rejects every non-certified record. A material descriptor or evidence-contract change therefore requires a newly subject-bound task-linked pending record rather than inheriting stale coverage.

The actual fresh-scaffold runner creates a new `portfolio` project through the compiled CLI, re-infers it, requires healthy diagnostics and an empty exact diff, and reuses the fixed generated-project install/build/browser verifier against that output. This supplies only the registered `fresh-scaffold` evidence for `booking-calendly`; the capability remains pending. Its manual protected-staging workflow and human receipt contract are prepared, while protected-staging deployment, provider-confirmed booking, cancellation, and cleanup outcomes remain unexecuted and separately authorized.

## Delivery and package ownership

Package-backed delivery uses an ordinary replaceable dependency. Source-generated delivery writes owned source under declared merge/ejection rules. Hybrid delivery combines both and declares each surface explicitly.

Initial public packages are limited to `@egeria-systems/standards` and `@egeria-systems/observability`, and they are created only in P0.3. P0.3 reserves private `builder-core` ownership of project/state schemas; P1 implements them there. They remain private until a proven independent consumer justifies extraction.

The full catalog preserves future visibility without prematurely implementing later stages. The executable boundary is limited to the seven descriptors and two recipes identified above. Calendly adds only initial-scaffolding settings, declared generated surfaces, inference probes, and retained local verification; it adds no package, secret, environment variable, platform resource, provider adapter or mutation, later-add command, existing-repository transformation, webhook, or new profile.
