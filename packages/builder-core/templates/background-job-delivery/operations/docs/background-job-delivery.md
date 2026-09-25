# Background job delivery

This optional capability generates one shared primary OpenNext Worker. Its ordinary HTTP handler remains intact; a separate Queue module handles jobs. It adds no application workflow, database, email/contact integration, scheduler or public endpoint. Current portfolio/site/app profiles can select it without changing profile or selecting persistence.

## Using the contract

Application code obtains `JobDispatcher` through Effect and the server composition layer. Supply a version-1 envelope with the intended environment, caller-created opaque UUID `operationId`, named job type/version and payload. A successful dispatch reports `accepted`, which means enqueue acceptance only. Store the operation identity before dispatch if your use case needs durable reconciliation. A cancelled, rejected or timed-out send can have been accepted; deliberate recovery must reuse the original operation identity and payload.

Define real handlers in the application-owned `src/application/job-handlers.ts`. Each definition supplies a unique type/version, explicit payload allowlist, repeat-safety declaration and Effect handler. There is no default business handler. Prefer opaque record references to message bodies or personal data. Envelope JSON is limited to 16,384 UTF-8 bytes. Payloads allow at most 64 entries per object or array, 2,048 characters per string and nesting through depth five; object keys are bounded identifiers. The registry admits at most 32 unique type/version pairs, with type names up to 64 characters and versions from 1 to 65,535. Application validation must further restrict the concrete fields. Do not put secrets or unnecessary personal information in a payload.

Handlers must tolerate duplicate and out-of-order delivery, including a timeout after their side effect and before acknowledgement. Use naturally idempotent operations, monotonic updates, or consumer-owned durable state for the actual business requirement. The declaration is an obligation to prove, not runtime deduplication. A process-local set, transport ID or acknowledgement is not durable exactly-once processing. A Queue transport ID changes on re-enqueue; `operationId` must not.

## Failure and inspection

The consumer has a ten-second attempt deadline. Expected retry failures and uncertain execution request native retry with bounded backoff. Configuration allows three retries after the first attempt; native exhaustion transfers the original envelope to the same environment's dead-letter Queue. Missing handler versions, invalid handler registration or thrown payload-validator errors request native retry so exhaustion preserves the original envelope for recovery after the consumer is repaired. Explicit terminal/cancelled handler outcomes and malformed input create bounded terminal records; invalid bodies are omitted. A terminal-record enqueue is acknowledged only after it succeeds. A failed or ambiguous terminal enqueue retries the original delivery and can duplicate a terminal record.

Keep the dead-letter Queue unconsumed until an authorized operator handles it. Native exhaustion can retain an original malformed body if terminal quarantine itself repeatedly fails; apply the same restricted access and privacy policy to all queued work. Custom diagnostics contain only fixed outcome/error codes, never payloads, raw errors, identities or bodies. Source/configuration changes neither inspect nor delete remote data.

`inspectTerminalJob` identifies a locally recoverable original envelope; `prepareJobRecovery` revalidates its exact schema, handler and environment and preserves the operation identity. They perform no provider I/O, authorization, dispatch, acknowledgement or drain. Before any later operator replay, reconcile whether the side effect already happened and obtain the required authorization. Repair the actual consumer cause first; replaying a poison job without a repair repeats failure. Restore missing handler versions or correct registration before recovering an accepted job. Invalid data requires human disposition and is never fabricated into another job.

## Configuration and authority

`wrangler.jsonc` declares separate local, staging and production queue names, producer/DLQ bindings and mandatory native dead-letter target. Queue names must be 1–63 characters, use letters/numbers/dashes and start and end with a letter or number. Generated names append up to 21 characters, so choose a project name of at most 42 characters when selecting jobs. `node scripts/check-job-delivery.mjs local` validates the repository map. This check cannot prove remote resource existence, account permissions or provider retention. The approved retention contract is the Workers Free maximum: **24 hours (86,400 seconds)** on both primary and dead-letter queues. Before a staging or production deployment, an operator must verify those exact resources and their retention, assign an inspection owner, and arrange inspection and authorized recovery before expiry. Set `JOB_RETENTION_REVIEWED=true` for the selected environment's preflight only after that review. The manual deployment workflow requires the equivalent `job_retention_reviewed` checkbox, defaulting to false and bound to the separately approved exact revision. This is an operator attestation, not automated provider readback, resource provisioning or deployment authorization.

A provider Queue is bounded retention, not indefinite archival storage. Workers Free fixes retention at 24 hours; messages that expire are deleted by the provider. Do not assume that a DLQ transfer gives an additional 24-hour recovery window: inspect the provider's actual message age/expiry and act within the remaining time. No code here extends retention, archives expired messages or adds paid capacity. Source rollback does not recover expired work or reverse side effects. Never lower retention or discard queued data as part of source recovery.

The builder supports only its exact approved jobs addition, removal and re-addition tuples. Removal needs fresh reviewed retain/drain/discard evidence and preserves necessary application work. It performs no remote drain, purge or deletion. Installed jobs 0.1.0 retains its original source; new jobs 0.2.0 includes the operator below. In-place jobs upgrades, profile transitions and unrelated operations on jobs-bearing repositories remain unsupported. Preserve the worktree and queued resources during recovery.

## Bounded operator

Run `scripts/job-operator.mjs` from `apps/web` on **Node 22.23.2**, in a clean committed checkout with the exact installed dependencies. It uses Node's native TypeScript stripping and module hooks to load the real application registry, including extensionless `@/` imports. The registry and its imports must be usable in Node and have no import-time side effects. Unsupported syntax, `server-only`, Worker-only bindings or other incompatible runtime imports refuse before the operator creates its provider transport. It does not invoke Vitest, a second runner, or a replacement registry. Local tests use synthetic transport and credentials only.

The four commands require a private JSON request and an explicit private token file; ambient Cloudflare credentials are not read. Every command, including read-only inspection, requires `authorized: true` for its exact command/account/environment/resources. Obtain separate authority before contacting a live account. Token permissions must be limited to the approved account and Queue actions; no script permission changes or provisioning occur here.

Create a new owner-only run directory **outside the repository**, on a trusted local filesystem. The run directory, request file and token file must all be outside the whole Git repository. Use canonical absolute paths: symlinks, public files, hard-linked files and shared directories are refused. The operator requires POSIX ownership/permissions and filesystem support for atomic installation and `fsync`.

```sh
umask 077
RUN="$(mktemp -d "$HOME/job-recovery.XXXXXXXX")"
```

Create `$RUN/token.json` using a secure editor, with exactly one `token` property. Keep the token out of command arguments, terminal history, source and logs. Create request files with mode `0600`; keep the run directory at `0700`.

Before writing the request, obtain the local registry digest without provider access:

```sh
node --input-type=module -e 'const { loadApplication } = await import("./scripts/job-operator.mjs"); const application = await loadApplication(process.cwd()); console.log(application.registryDigest);'
git rev-parse HEAD
```

The digest binds the actual loaded source graph, including nested registry imports and canonical job validators. The Git revision and clean-tree check bind the wider tracked project. Review that exact local revision/registry against the **deployed** native Worker; the API checks consumer identity/settings, while `deployedCompatibilityReviewed` is the human compatibility attestation. The tool cannot infer deployed handler/schema compatibility from a queue name.

This request shape shows every common field. Replace the synthetic identifiers, revision, digest and timestamps with reviewed real values; the example itself is not authorization. Times are integer Unix milliseconds. `issuedAt` must be current, `expiresAt` must be in the future and at most 15 minutes after issuance.

```json
{
  "version": 1,
  "command": "inspect",
  "authorized": true,
  "scope": {
    "environment": "staging",
    "accountId": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "primary": { "id": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "name": "example-jobs-staging" },
    "deadLetter": { "id": "cccccccccccccccccccccccccccccccc", "name": "example-jobs-staging-dead" },
    "consumer": { "id": "dddddddddddddddddddddddddddddddd", "scriptName": "example-staging" },
    "revision": "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    "registryDigest": "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    "deployedCompatibilityReviewed": true
  },
  "issuedAt": 0,
  "expiresAt": 0,
  "bounds": { "maxMessages": 5, "maxRequests": 40, "maxDurationMs": 30000, "observations": 3, "intervalMs": 1000 }
}
```

Bounds allow 1–20 messages, 3–100 requests, 100–60,000 milliseconds, 2–10 drain observations and 10–5,000 milliseconds between observations. Resource checks consume the request budget. Responses are capped at 1 MiB with a deadline of at most ten seconds per request and the remaining command duration. Only the fixed HTTPS Cloudflare API origin is used; redirects are refused. Current queue IDs/names, native consumer identity/settings, unconsumed DLQ, unpaused primary delivery and **86,400-second retention on both queues** must match before effects. Missing or incomplete remote evidence refuses.

```sh
node scripts/job-operator.mjs inspect --request "$RUN/inspect.json" --directory "$RUN" --token-file "$RUN/token.json"
```

`inspect` uses non-leasing peek and writes a bounded `inspection.json` privately. This is a sample, not complete enumeration, a lock on remote messages or an archive. Ordinary output contains only fixed outcomes, counts, timestamps and fingerprints. Privately inspect the bounded bodies, original identities and transport IDs to choose the exact work; never paste them into ordinary audit logs.

For `plan-replay`, use the same common fields with `command: "plan-replay"` and add:

```json
{
  "priorEffectsReconciled": true,
  "selection": [
    { "messageId": "EXACT_PRIVATE_TRANSPORT_ID", "originalRetentionDeadline": 0 }
  ]
}
```

These properties are added to the common request, not submitted alone. The operator peeks again and requires every selected transport ID in that bounded sample. Missing selection fails safely; increase a reviewed bound only within the hard limit. Supply the **original** retention deadline from independent provenance. It must still be in the future; a DLQ timestamp does not grant a fresh 24-hour window. Unknown original expiry requires human disposition rather than an invented deadline. `priorEffectsReconciled` attests that possible earlier effects were reconciled and replay with the original identity is appropriate.

```sh
node scripts/job-operator.mjs plan-replay --request "$RUN/plan-request.json" --directory "$RUN" --token-file "$RUN/token.json"
```

Review the private `plan.json` and its output fingerprint. The plan binds account/environment/resources, current revision and registry, exact source references/body digests, validated original envelopes and operation identities, handler type/version/repeat-safety, bounds, expiry and `remove-after-accepted` disposition. Canonical `prepareJobRecovery` and `validateJob` perform schema/handler validation; the operator does not invent a replacement payload. Duplicate operation identities within a selection refuse.

For `replay`, keep the same scope and bounds, use a fresh authorized issuance/expiry within the original plan validity, omit `selection`, and add `priorEffectsReconciled: true` and `approvalFingerprint` equal to the reviewed fingerprint. The authorization includes targeted removal of **only** each selected DLQ reference after enqueue acceptance and its durable checkpoint.

```sh
node scripts/job-operator.mjs replay --request "$RUN/replay-request.json" --directory "$RUN" --token-file "$RUN/token.json"
```

Each entry progresses durably through `prepared`, `send-started`, `send-accepted`, `removal-started`, `removed`. Before sending, a fresh non-leasing peek must still match the source ID and body digest. Fresh peek references may rotate; removal always uses the exact approved original reference, never its replacement. The exact validated envelope goes to the original primary queue. Removal checks fresh resource identity again and rejects per-reference purge warnings/errors even when the provider reports top-level success. A transport acceptance means queued, never completed. This is not an atomic move or an exclusive remote lease: another operator or consumer can race, and transport delivery can duplicate.

An interrupted bounded run may resume with the same plan, private directory and reviewed request. `prepared` entries can send; `send-accepted` entries may only remove the original source; removed entries never resend. A completed run refuses a duplicate invocation. `send-started` or `removal-started` on resumption is uncertain and **requires human reconciliation** before any further provider call. A checkpoint failure after an effect can leave such uncertainty. Do not delete/edit checkpoints or create a new plan to bypass it. Reconcile provider acceptance, original logical effects and remaining source copy through a separately reviewed recovery action. No distributed deduplication or exactly-once guarantee exists across run directories.

A crashed process may leave `.job-operator-lock`. After verifying that no process still owns the run, a human may remove only that stale lock; preserve plan/checkpoint/audit files and all uncertain stages. Writes are atomic and synced on the supported local filesystem, but portable path checks are not a hostile same-user concurrency sandbox or a hardware crash-durability certification.

For `drain`, use `command: "drain"` with `producersStopped: true` and no replay fields. This attests that relevant producers were stopped through separately authorized action. The tool only observes bounded approximate primary-backlog metrics while the **existing native consumer** runs. It never pulls, replaces the consumer, purges the primary queue or changes delivery configuration.

```sh
node scripts/job-operator.mjs drain --request "$RUN/drain.json" --directory "$RUN" --token-file "$RUN/token.json"
```

`observed-quiescent` requires at least two consecutive empty samples at the end of the observation window; `partial` reports remaining or intermittent work; `unknown` reports failed/invalid observations or an exhausted observation bound. Approximate zero does not prove absence of delayed/in-flight work, complete enumeration, business completion or safe source removal. Independent fresh disposition evidence remains necessary for removal.

`audit.json` holds at most 128 fixed events with per-invocation counts, timestamps, fingerprints and hashed transport IDs, without payloads, raw references/account IDs, credentials or raw errors. Private inspection/plan files necessarily contain bounded job bodies and source references. Restrict access, avoid backups/egress inconsistent with your data policy, and retain them only until the approved recovery/audit retention decision permits deletion. Never delete an incomplete or uncertain checkpoint to make a run appear fresh. Expired work cannot be restored by source rollback.

## Local evidence and limits

Unit tests exercise the real application contracts and memory adapter. The memory adapter is explicitly local/test-only, limited to 100 pending or terminal entries, four attempts and non-durable; restart loses all its work. The existing whole-built-Worker command also executes synthetic Queue integration tests, including native retries/exhaustion, HTTP preservation and side-effect ambiguity. The test fixture has private synthetic endpoints and an observation DLQ consumer; neither is the production entry point or a retention implementation. Operator replay tests enqueue the recovered envelope through the real generated Worker and prove the synthetic monotonic handler converges under repeated original identity. Targeted REST removal is simulated against the fixture observation list because its local DLQ observer already acknowledges messages; it is not evidence of live provider purge semantics.

The pinned topology proof observed redelivery of an explicitly acknowledged message when a later batch message throws. Its characterization remains negative evidence against parity with Cloudflare's documented guarantee. Repeat-safe handlers are required regardless of that discrepancy. Local tests establish exercised local behavior, not deployed delivery, throughput, crash durability, permissions, exactly-once processing or capability certification.

## Provider references

- [Queue JavaScript API](https://developers.cloudflare.com/queues/configuration/javascript-apis/) and [native batching/retries](https://developers.cloudflare.com/queues/configuration/batching-retries/).
- [Dead-letter Queues](https://developers.cloudflare.com/queues/configuration/dead-letter-queues/) and [retention limits](https://developers.cloudflare.com/queues/platform/limits/).
- [OpenNext custom Worker composition](https://opennext.js.org/cloudflare/howtos/custom-worker).
- [Non-leasing peek](https://developers.cloudflare.com/api/resources/queues/subresources/messages/methods/peek/), [JSON message push](https://developers.cloudflare.com/api/resources/queues/subresources/messages/methods/push/), [targeted reference purge](https://developers.cloudflare.com/api/resources/queues/subresources/messages/methods/purge/), [queue details](https://developers.cloudflare.com/api/resources/queues/methods/get/) and [approximate backlog metrics](https://developers.cloudflare.com/api/resources/queues/methods/get_metrics/).
- [Pinned Node module hooks and type stripping](https://nodejs.org/download/release/v22.23.2/docs/api/module.html).

Provider documentation describes production contracts; the local acknowledgement characterization above remains contrary evidence for the tested emulator.
