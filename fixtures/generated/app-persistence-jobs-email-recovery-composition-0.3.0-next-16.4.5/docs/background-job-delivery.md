# Background job delivery

The common environment guide at `docs/environments.md` owns build origins, source identity, prepared artifacts and the protected release sequence.

This optional capability generates one shared primary OpenNext Worker. Its ordinary HTTP handler remains intact; a separate Queue module handles jobs. It adds no application workflow, database, email/contact integration, scheduler or public endpoint. Current portfolio/site/app profiles can select it without changing profile or selecting persistence.

## Using the contract

Application code obtains `JobDispatcher` through Effect and the server composition layer. Supply a version-1 envelope with the intended environment, caller-created opaque UUID `operationId`, named job type/version and payload. A successful dispatch reports `accepted`, which means enqueue acceptance only. Store the operation identity before dispatch if your use case needs durable reconciliation. A cancelled, rejected or timed-out send can have been accepted; deliberate recovery must reuse the original operation identity and payload.

Define real handlers in the application-owned `src/application/job-handlers.ts`. Each definition supplies a unique type/version, explicit payload allowlist, repeat-safety declaration and Effect handler. There is no default business handler. Prefer opaque record references to message bodies or personal data. Envelope JSON is limited to 16,384 UTF-8 bytes. Payloads allow at most 64 entries per object or array, 2,048 characters per string and nesting through depth five; object keys are bounded identifiers. The registry admits at most 32 unique type/version pairs, with type names up to 64 characters and versions from 1 to 65,535. Application validation must further restrict the concrete fields. Validators and handlers receive deeply frozen, isolated envelope snapshots; they must not mutate payloads. Version consumers deliberately: keep compatible declarations for queued versions, or restore them before recovery. Changing a validator under an existing type/version can reject previously accepted work. Do not put secrets or unnecessary personal information in a payload.

Handlers must tolerate duplicate and out-of-order delivery, including a timeout after their side effect and before acknowledgement. Use naturally idempotent operations, monotonic updates, or consumer-owned durable state for the actual business requirement. The declaration is an obligation to prove, not runtime deduplication. A process-local set, transport ID or acknowledgement is not durable exactly-once processing. A Queue transport ID changes on re-enqueue; `operationId` must not.

## Failure and inspection

The consumer has a ten-second attempt deadline. Expected retry failures and uncertain execution request native retry with bounded backoff. Configuration allows three retries after the first attempt; native exhaustion transfers the original envelope to the same environment's dead-letter Queue. Structurally bounded same-target envelopes request native retry when the current handler is missing, registration is invalid, or its payload validator throws or returns false. Exhaustion preserves the original envelope for recovery after the consumer is repaired. No rejected payload executes or acknowledges. Explicit terminal/cancelled handler outcomes retain the original validated pre-handler snapshot without rerunning its validator. Malformed envelopes create sanitized bounded terminal records with no raw body. A terminal-record enqueue is acknowledged only after it succeeds. A failed or ambiguous terminal enqueue retries the original delivery and can duplicate a terminal record.

Structural validity is not proof of previous producer admission: newly injected business-invalid envelopes receive the same retention treatment as previously accepted jobs rejected by a replacement validator. This deliberate recovery/privacy tradeoff preserves bounded data without authorizing execution or claiming provenance. Keep the dead-letter Queue unconsumed until an authorized operator handles it. Native exhaustion can retain an original malformed body if terminal quarantine itself repeatedly fails; apply the same restricted access and privacy policy to all queued work. Custom diagnostics contain only fixed outcome/error codes, never payloads, raw errors, identities or bodies. Source/configuration changes neither inspect nor delete remote data.

`runJobAttempt` checks the envelope, takes one bounded, frozen snapshot, validates it with the selected declaration, and runs that declaration's handler at most once. The result distinguishes malformed envelopes, declaration rejection and executed attempts. Producers still use strict `validateJob` before sending. `inspectTerminalJob` identifies a locally recoverable original envelope. `prepareJobRecovery` revalidates its exact schema, restored current declaration and environment and preserves the original operation identity and payload. Both recovery functions are pure. Retention alone never authorizes execution or replay. Before any later operator replay, reconcile whether the side effect already happened and obtain the required authorization. Restore compatible handler versions, payload validators or registration before recovering retained work.

## Configuration and authority

`wrangler.jsonc` declares separate local, staging and production queue names, producer/DLQ bindings and mandatory native dead-letter target. Queue names must be 1–63 characters, use letters/numbers/dashes and start and end with a letter or number. Generated names append up to 21 characters, so choose a project name of at most 42 characters when selecting jobs. `APPLICATION_ENVIRONMENT=development node scripts/check-job-delivery.mjs local` validates the repository map. This check cannot prove remote resource existence, account permissions or provider retention. The approved retention contract is the Workers Free maximum: **24 hours (86,400 seconds)** on both primary and dead-letter queues. Before a staging or production deployment, an operator must verify those exact resources and their retention, assign an inspection owner, and arrange inspection and authorized recovery before expiry. Set `JOB_RETENTION_REVIEWED=true` for the selected environment's preflight only after that review. The manual deployment workflow requires separate `staging_job_retention_reviewed` and `production_job_retention_reviewed` checkboxes, each defaulting to false and bound to the separately approved exact revision. This is an operator attestation, not automated provider readback, resource provisioning or deployment authorization.

A provider Queue is bounded retention, not indefinite archival storage. Workers Free fixes retention at 24 hours; messages that expire are deleted by the provider. Do not assume that a DLQ transfer gives an additional 24-hour recovery window: inspect the provider's actual message age/expiry and act within the remaining time. No code here extends retention, archives expired messages or adds paid capacity. Source rollback does not recover expired work or reverse side effects. Never lower retention or discard queued data as part of source recovery.

Jobs 0.4.0 supports fresh generation and verification. Existing-repository jobs lifecycle, upgrades, profile transitions and unrelated operations on jobs-bearing repositories refuse. The credentialed operator command belonged to jobs 0.2.0. Preserve the worktree and queued resources during recovery. Remote replay, drain, purge and deletion require separate operator decisions and tooling.

## Local evidence and limits

Unit tests exercise the real application contracts and memory adapter. The memory adapter is explicitly local/test-only, limited to 100 pending or terminal entries, four attempts and non-durable; restart loses all its work. It revalidates the current declaration on each attempt and preserves the isolated original snapshot through local retry exhaustion; retained failures still count toward capacity. The existing whole-built-Worker command also executes synthetic Queue integration tests, including native retries/exhaustion, HTTP preservation and side-effect ambiguity. The test fixture has private synthetic endpoints and an observation DLQ consumer; neither is the production entry point or a retention implementation. Controlled local tests re-enqueue the pure recovery result through the real generated Worker and verify that the synthetic monotonic handler converges under the original operation identity. The observed terminal copy remains intact. This supplies no operator, remote replay, targeted deletion or provider purge evidence.

The pinned topology proof observed redelivery of an explicitly acknowledged message when a later batch message throws. Its characterization remains negative evidence against parity with Cloudflare's documented guarantee. Repeat-safe handlers are required regardless of that discrepancy. Local tests establish exercised local behavior, not deployed delivery, throughput, crash durability, permissions, exactly-once processing or capability certification.

## Provider references

- [Queue JavaScript API](https://developers.cloudflare.com/queues/configuration/javascript-apis/) and [native batching/retries](https://developers.cloudflare.com/queues/configuration/batching-retries/).
- [Dead-letter Queues](https://developers.cloudflare.com/queues/configuration/dead-letter-queues/) and [retention limits](https://developers.cloudflare.com/queues/platform/limits/).
- [OpenNext custom Worker composition](https://opennext.js.org/cloudflare/howtos/custom-worker).
- [Non-leasing peek](https://developers.cloudflare.com/api/resources/queues/subresources/messages/methods/peek/), [JSON message push](https://developers.cloudflare.com/api/resources/queues/subresources/messages/methods/push/), [targeted reference purge](https://developers.cloudflare.com/api/resources/queues/subresources/messages/methods/purge/), [queue details](https://developers.cloudflare.com/api/resources/queues/methods/get/) and [approximate backlog metrics](https://developers.cloudflare.com/api/resources/queues/methods/get_metrics/).
- [Pinned Node module hooks and type stripping](https://nodejs.org/download/release/v22.23.2/docs/api/module.html).

Provider documentation describes production contracts; the local acknowledgement characterization above remains contrary evidence for the tested emulator.

## Common target and prepared queue identity

`APPLICATION_ENVIRONMENT` and the compiled build target must agree before dispatch or consumption. Development maps only to `JOB_ENVIRONMENT=local`; staging and production retain their names. The queue wrapper reads the copied build identity through its Text module and passes that target explicitly. A target mismatch fails before send, acknowledgement or handler effects. Correct the target and rebuild in a new local checkout; never relabel an existing artifact.

Set `BUILD_SOURCE_REVISION` to exactly 40 lowercase hexadecimal characters before a jobs production build. Next loads `apps/web/.env.local` in its usual order and gives an explicit process value precedence. For local preparation, set the revision there or in the build process, run `pnpm run build` at the project root, then run `pnpm --dir apps/web exec opennextjs-cloudflare build --skipNextBuild`. The copy at `apps/web/.open-next/assets/BUILD_ID` binds the target and revision. The same revision requirement applies when `build:cloudflare`, `preview`, or root `verify` starts the production build. Ordinary Next development keeps its optional revision.

Generate each target's native Wrangler dry-run bundle and metadata before recording its artifact, as shown in the common guide. The receipt covers bundler inputs and every emitted module. Actual local Wrangler verification is required; static source checks do not establish the pinned Text import or output layout. Jobs selection is independent of persistence and email. Existing-repository jobs lifecycle remains closed for these targets.

Release requires separate staging and production retention attestations after reviewing their actual queue resources. These attestations do not provision queues or authorize replay, drain, migration or other provider actions. Source rollback cannot undo accepted or delivered messages; retain recovery evidence and reconcile those effects separately.

## Event-bound service composition

The registry remains the single declaration source. Admission and recovery consume its `JobDeclaration` view without importing Queue composition. `JobDefinition<Requirements>` records a business handler's actual Effect requirements; the default `JobDefinition` has none. The application-owned `src/composition/job-handler-composition.ts` receives the registry, this Queue invocation's raw bindings and the target parsed from the built Worker identity. It must return one closed executable handle per declaration, preserving type, version, repeat-safety and the exact validator reference. Managed wiring rejects missing, extra, duplicate or changed declarations and non-callable handles before executing the batch. The existing adapter validates target/configuration and all envelope targets before importing or calling the hook. HTTP dispatch does not load the hook.

Create lazy layers inside that hook and provide them to the existing business Effects. Do not run sends, SQL, dispatch or other business effects during assembly; do not cache bindings/layers across invocations or put raw bindings into handler context. The empty/dependency-free generated hook simply returns the same definitions and imports no optional services. Selected email/persistence consumers supply their actual narrow ports. Jobs does not select either capability.

Here is a complete illustrative email consumer for a project that explicitly selected both jobs and transactional email. It is an extension example, not a generated workflow. The fixed test address/content below require replacement with reviewed application policy and localization. Its validator intentionally accepts no payload fields, avoiding arbitrary recipient/body data in queued work.

`apps/web/src/application/job-handlers.ts`:

```ts
import { Effect } from "effect";
import { JobHandlerFailure, type JobDefinition } from "@/src/application/job-delivery";
import { TransactionalEmailSender } from "@/src/application/transactional-email-sender";

export const jobHandlers: readonly JobDefinition<TransactionalEmailSender>[] = [{
  type: "example-notification",
  version: 1,
  repeatSafety: "consumer-reconciled",
  validate: payload => Object.keys(payload).length === 0,
  handle: job => Effect.gen(function* () {
    const sender = yield* TransactionalEmailSender;
    yield* sender.send({
      to: "allowed@example.test", subject: "Controlled example", text: "Synthetic content",
      idempotencyKey: job.operationId,
    }).pipe(Effect.mapError(error => new JobHandlerFailure(
      error.code === "transactional-email-validation" || error.code === "transactional-email-authorization"
        ? "terminal" : "retry",
    )));
  }),
}];
```

`apps/web/src/composition/job-handler-composition.ts`:

```ts
import { Effect } from "effect";
import type { JobDefinition } from "@/src/application/job-delivery";
import type { jobHandlers } from "@/src/application/job-handlers";
import { parseApplicationEnvironment, type ApplicationEnvironment } from "@/src/configuration/application-environment";
import { createTransactionalEmailEventReporter } from "@/src/infrastructure/observability/transactional-email-events";
import { createResendTransactionalEmailSenderLayer } from "@/src/infrastructure/resend/transactional-email-sender";

export function createJobHandlers(input: Readonly<{
  definitions: typeof jobHandlers;
  environment: unknown;
  compiledTarget: ApplicationEnvironment;
}>): readonly JobDefinition[] {
  const compiledTarget = () => parseApplicationEnvironment(input.compiledTarget);
  const email = createResendTransactionalEmailSenderLayer({
    compiledTarget,
    configuration: Effect.succeed(input.environment),
    request: (...arguments_) => fetch(...arguments_),
    reportEvent: createTransactionalEmailEventReporter({
      compiledTarget,
      runtimeTarget: () => typeof input.environment === "object" && input.environment !== null
        ? Reflect.get(input.environment, "APPLICATION_ENVIRONMENT") : undefined,
    }),
  });
  return input.definitions.map(definition => ({
    ...definition,
    handle: (job, context) => definition.handle(job, context).pipe(Effect.provide(email)),
  }));
}
```

Typechecking must reject returning these unprovided handlers as `readonly JobDefinition[]`; do not use assertions or erase Effect requirements to bypass that check. Run `pnpm --dir apps/web run typecheck` after extending both files. The HTTP `serverTransactionalEmailLayer` still acquires HTTP context; it is not the Queue layer. The explicit factory keeps the same one-attempt transport, ten-second deadline, target comparison and nonproduction recipient allowlist. Configure the synthetic address as allowed when running controlled tests, intercept the injected `request` inside workerd, and never delegate that test transport to real network fetch.

The example maps validation/recipient authorization to a terminal outcome and all other email failures to retry. This is illustrative consumer policy: configuration, rate/quota, conflict and unknown acceptance need an operator's actual reconciliation decision before any replay. Unknown acceptance is never proof of non-delivery, and a later successful attempt cannot undo an earlier send. Deliberate attempts must reuse the same operation key and exact content within the provider's applicable idempotency window; local tests cannot prove remote deduplication. A terminal outcome is acknowledged only after the existing terminal-copy admission succeeds.

For a follow-up job, provide `createCloudflareJobDispatcherLayer` with `compiledTarget`, `configuration: Effect.succeed(input.environment)` and `handlers: input.definitions`. Its admission needs declarations only. Preserve a caller-established follow-up `operationId` across retries; do not generate a fresh UUID in the retrying handler. Queue-send uncertainty maps to retry/reconciliation, not proof that no follow-up was admitted. Repeated parent delivery can enqueue duplicate follow-ups, whose consumer must satisfy its own repeat-safety declaration. No outbox, atomic cross-service transaction or deduplication store is implied.
