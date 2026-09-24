# Background job delivery

This optional capability generates one shared primary OpenNext Worker. Its ordinary HTTP handler remains intact; a separate Queue module handles jobs. It adds no application workflow, database, email/contact integration, scheduler or public endpoint. Current portfolio/site/app profiles can select it without changing profile or selecting persistence.

## Using the contract

Application code obtains `JobDispatcher` through Effect and the server composition layer. Supply a version-1 envelope with the intended environment, caller-created opaque UUID `operationId`, named job type/version and payload. A successful dispatch reports `accepted`, which means enqueue acceptance only. Store the operation identity before dispatch if your use case needs durable reconciliation. A cancelled, rejected or timed-out send can have been accepted; deliberate recovery must reuse the original operation identity and payload.

Define real handlers in the application-owned `src/application/job-handlers.ts`. Each definition supplies a unique type/version, explicit payload allowlist, repeat-safety declaration and Effect handler. There is no default business handler. Prefer opaque record references to message bodies or personal data. Envelope JSON is limited to 16,384 UTF-8 bytes. Payloads allow at most 64 entries per object or array, 2,048 characters per string and nesting through depth five; object keys are bounded identifiers. The registry admits at most 32 unique type/version pairs, with type names up to 64 characters and versions from 1 to 65,535. Application validation must further restrict the concrete fields. Do not put secrets or unnecessary personal information in a payload.

Handlers must tolerate duplicate and out-of-order delivery, including a timeout after their side effect and before acknowledgement. Use naturally idempotent operations, monotonic updates, or consumer-owned durable state for the actual business requirement. The declaration is an obligation to prove, not runtime deduplication. A process-local set, transport ID or acknowledgement is not durable exactly-once processing. A Queue transport ID changes on re-enqueue; `operationId` must not.

## Failure and inspection

The consumer has a ten-second attempt deadline. Expected retry failures and uncertain execution request native retry with bounded backoff. Configuration allows three retries after the first attempt; native exhaustion transfers the original envelope to the same environment's dead-letter Queue. Missing handler versions or invalid handler registration request native retry so exhaustion preserves the original envelope for recovery after the consumer is repaired. Explicit terminal/cancelled handler outcomes and malformed input create bounded terminal records; invalid bodies are omitted. A terminal-record enqueue is acknowledged only after it succeeds. A failed or ambiguous terminal enqueue retries the original delivery and can duplicate a terminal record.

Keep the dead-letter Queue unconsumed until an authorized operator handles it. Native exhaustion can retain an original malformed body if terminal quarantine itself repeatedly fails; apply the same restricted access and privacy policy to all queued work. Custom diagnostics contain only fixed outcome/error codes, never payloads, raw errors, identities or bodies. Source/configuration changes neither inspect nor delete remote data.

`inspectTerminalJob` identifies a locally recoverable original envelope; `prepareJobRecovery` revalidates its exact schema, handler and environment and preserves the operation identity. They perform no provider I/O, authorization, dispatch, acknowledgement or drain. Before any later operator replay, reconcile whether the side effect already happened and obtain the required authorization. Repair the actual consumer cause first; replaying a poison job without a repair repeats failure. Restore missing handler versions or correct registration before recovering an accepted job. Invalid data requires human disposition and is never fabricated into another job.

## Configuration and authority

`wrangler.jsonc` declares separate local, staging and production queue names, producer/DLQ bindings and mandatory native dead-letter target. `node scripts/check-job-delivery.mjs local` validates the repository map. This check cannot prove remote resource existence, account permissions or provider retention. The approved retention contract is the Workers Free maximum: **24 hours (86,400 seconds)** on both primary and dead-letter queues. Before a staging or production deployment, an operator must verify those exact resources and their retention, assign an inspection owner, and arrange inspection and authorized recovery before expiry. Set `JOB_RETENTION_REVIEWED=true` for the selected environment's preflight only after that review. The manual deployment workflow requires the equivalent `job_retention_reviewed` checkbox, defaulting to false and bound to the separately approved exact revision. This is an operator attestation, not automated provider readback, resource provisioning or deployment authorization.

A provider Queue is bounded retention, not indefinite archival storage. Workers Free fixes retention at 24 hours; messages that expire are deleted by the provider. Do not assume that a DLQ transfer gives an additional 24-hour recovery window: inspect the provider's actual message age/expiry and act within the remaining time. No code here extends retention, archives expired messages or adds paid capacity. Source rollback does not recover expired work or reverse side effects. Never lower retention or discard queued data as part of source recovery.

Fresh generation is the supported builder boundary. Existing-repository add/remove/upgrade, and executable replay/drain machinery, remain unsupported. Preserve the worktree and queued resources during recovery. Any later source removal needs a reviewed retain/drain/discard disposition and separate authority for external data operations.

## Local evidence and limits

Unit tests exercise the real application contracts and memory adapter. The memory adapter is explicitly local/test-only, limited to 100 pending or terminal entries, four attempts and non-durable; restart loses all its work. The existing whole-built-Worker command also executes synthetic Queue integration tests, including native retries/exhaustion, HTTP preservation and side-effect ambiguity. The test fixture has private synthetic endpoints and an observation DLQ consumer; neither is the production entry point or a retention implementation.

The pinned topology proof observed redelivery of an explicitly acknowledged message when a later batch message throws. Its characterization remains negative evidence against parity with Cloudflare's documented guarantee. Repeat-safe handlers are required regardless of that discrepancy. Local tests establish exercised local behavior, not deployed delivery, throughput, crash durability, permissions, exactly-once processing or capability certification.

## Provider references

- [Queue JavaScript API](https://developers.cloudflare.com/queues/configuration/javascript-apis/) and [native batching/retries](https://developers.cloudflare.com/queues/configuration/batching-retries/).
- [Dead-letter Queues](https://developers.cloudflare.com/queues/configuration/dead-letter-queues/) and [retention limits](https://developers.cloudflare.com/queues/platform/limits/).
- [OpenNext custom Worker composition](https://opennext.js.org/cloudflare/howtos/custom-worker).

Provider documentation describes production contracts; the local acknowledgement characterization above remains contrary evidence for the tested emulator.
