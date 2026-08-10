# Capability Model

**Status:** Controlling capability vocabulary through P1 Task 2

**Runtime status:** The six `portfolio`/`site` descriptors and two recipes named below are executable in private builder-core. Every other program capability and profile remains documentation-only.

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

## Initial catalog

The current executable catalog contains exactly `standards`, `content-files`, `section-composition`, `deployment-cloudflare`, `observability`, and `site-routing` for the `portfolio` and `site` recipes. The other rows remain program visibility only and have no runtime descriptor, resolver availability, generated surface, state, or provider effect yet.

State classifications below describe repository, external-provider, and persistent-data effects managed by the capability. Dependencies may also vary by an explicitly selected mode; those conditional rules are called out rather than hidden.

Profile inclusion distinguishes recipe defaults from independent selections. `dependency-only` means the resolver may add the capability to satisfy another supported selection, but it is not offered directly for that origin profile. Origin profiles remain informational after materialization; this policy controls scaffolding and migration prompts, not live inheritance.

| Capability | Delivery mode | State classifications | Removal policy | Profile inclusion | Required or conditional dependencies |
|---|---|---|---|---|---|
| `standards` | `package-backed` | `repository-stateful` | `reviewed` | default: portfolio, site, app, authenticated-app | None |
| `content-files` | `source-generated` | `repository-stateful` | `reviewed` | default: portfolio, site | `standards`; generated YAML 1.2 parsing uses ordinary dependency `yaml`; owns validated externalized accessibility copy |
| `section-composition` | `source-generated` | `repository-stateful` | `reviewed` | default: portfolio, site | `content-files`; owns Tailwind CSS and PostCSS package/configuration surfaces, global semantic design tokens, and responsive pure presentation |
| `deployment-cloudflare` | `hybrid` | `repository-stateful`, `external-stateful` | `reviewed` | default: portfolio, site, app, authenticated-app | `standards` |
| `observability` | `hybrid` | `repository-stateful`, `external-stateful` | `reviewed` | default: portfolio, site, app, authenticated-app | `deployment-cloudflare` |
| `booking-calendly` | `source-generated` | `repository-stateful` | `automatic` | optional: portfolio, site, app, authenticated-app | Public profile plus an existing Calendly destination |
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
- `booking-calendly` manages generated repository integration around a user-supplied destination. It does not manage the Calendly account or provider configuration, so provider state and provider cleanup remain outside this capability's authority.
- `identity-2fa` and `identity-passkeys` remain independently addable after `identity-core`.
- `payments-stripe` supports `one-time`, `subscriptions`, or `both`. The resolver adds mode-required persistence and background processing explicitly. Removing source does not cancel subscriptions, refund payments, or delete provider/legal records.
- Cloudflare Web Analytics belongs only to `analytics`; it is never implied by `observability`.
- `support-console` exposes only bounded identity, session, account-lifecycle, audit, and installed-capability reconciliation workflows. It is not a generic database browser or business CRUD framework.

## Delivery and package ownership

Package-backed delivery uses an ordinary replaceable dependency. Source-generated delivery writes owned source under declared merge/ejection rules. Hybrid delivery combines both and declares each surface explicitly.

Initial public packages are limited to `@egeria-systems/standards` and `@egeria-systems/observability`, and they are created only in P0.3. P0.3 reserves private `builder-core` ownership of project/state schemas; P1 implements them there. They remain private until a proven independent consumer justifies extraction.

The full catalog preserves future visibility without prematurely implementing later stages. P1 Task 2 adds only the six descriptors and two recipes identified above. It adds no template, `.egeria` file, inference engine, migration executor, binding, provider integration, generated application, or generated profile skeleton.
