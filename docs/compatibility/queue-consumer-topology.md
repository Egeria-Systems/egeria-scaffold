# Queue consumer topology proof

**Date:** 2026-09-23. **Status:** local compatibility evidence and recommendation for human review; no production topology is selected.

This is the test-only P5E-1 increment under the [bounded sequencing exception](../roadmaps/program-roadmap.md#one-time-2026-09-23-queue-topology-proof-exception). It preserves the accepted app-foundation predecessor and all certification state. It neither closes P4 nor implements jobs. The [D3/D4 decisions](../roadmaps/2026-09-16-remaining-program-decisions.md#4-d4-source-separation-and-worker-separation-are-different-decisions) own runner selection criteria and the user's separate-Worker preference.

Subsequent decision: the user accepted this local evidence and selected the shared primary Worker for the bounded runtime increment; see [ADR-0019](../adr/0019-background-job-delivery.md). The original findings and recommendation below remain historical proof evidence.

## Result and recommendation

Both candidates execute the same synthetic producer/consumer behavior locally: a Queue handler composed with the full built OpenNext Worker, and a separate queue-only Worker reached through the web Worker's producer binding. The web route and static page continue to work, including HTTP after a rejected Queue handler. No OpenNext integration obstacle was observed in this graph.

**Recommend a shared primary Worker for the currently demonstrated requirements.** Separate source modules work in either topology. This proof supplies no real job-only credential, independent release owner, scale requirement or bundle-pressure evidence that pays for a second deployed unit. The user's preference for separation remains valid direction to consider, not permission to invent those requirements. Choose a separate Worker when the actual job consumer needs a distinct binding/secret or deployment/recovery boundary; the synthetic binding test demonstrates that separation can enforce a narrower runtime environment. It does not establish that the eventual product needs that boundary.

The human decision is whether those concrete isolation or independent-operation needs justify a separate Worker before product configuration. Neither candidate is certified for deployment. The emulator limitation below affects both equally and cannot be fixed by selecting the other topology.

## Exact tested graph and reproduction

Starting comparison base: `3f62d61e869358ec59eb3e3ea898e222b4d0054b` (PR #144). Dependency inputs are unchanged. The root manifest, proof manifest and frozen lockfile remain the executable owners.

| Component | Tested version |
| --- | --- |
| Node / pnpm | `22.23.2` / `11.20.0` |
| Next / React and React DOM | `16.3.5` / `19.3.0` |
| OpenNext Cloudflare | `1.20.6` |
| Wrangler / Vitest | `4.131.2` / `5.0.0` |
| Transitive Miniflare / workerd | `5.20260911.1-alpha` / `1.20260911.1` |
| Compatibility date / flag | `2026-08-04` / `nodejs_compat` |

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @egeria-systems/nextjs-cloudflare-proof run build
pnpm --filter @egeria-systems/nextjs-cloudflare-proof exec opennextjs-cloudflare build --skipNextBuild
pnpm --filter @egeria-systems/nextjs-cloudflare-proof run test:integration:cloudflare
```

The existing integration command runs the original HTTP test and 20 Queue topology cases. Its normal repository-quality job already builds OpenNext first and runs this command. No workflow dispatch, deployment, new runner, dependency or generated-client test configuration is introduced. `pnpm run verify:compatibility-proof` exercises the complete existing lint/types/unit/build/typegen/integration/development-browser/preview-browser boundary; install the manifest-pinned Playwright Chromium when it is not already available.

The [host tests](../../proofs/nextjs-cloudflare/tests/integration/queue-topology.test.ts) use Wrangler `createTestHarness()` from the existing Vitest Node host. Queue bindings and handlers execute in workerd. Three [synthetic fixture modules](../../proofs/nextjs-cloudflare/tests/fixtures/queue-topology/) separate HTTP production of test messages, Queue handling, and shared composition. The shared entry point forwards ordinary fetches and named exports from `.open-next/worker.js`; the accepted deployable Wrangler entry point remains unchanged.

## Evidence and its limits

| Case | Actual local observation | Claim boundary |
| --- | --- | --- |
| Enqueue and consume | HTTP awaits native `Queue.sendBatch`; configured consumer receives native message IDs and attempt 1 | Enqueue acceptance is not completed business work |
| Explicit and implicit ack | Both success paths consume the synthetic batch | No exactly-once or durable side-effect guarantee |
| Individual retry | `message.retry()` produces attempt 2 with the same transport ID | Failure choice is injected; redelivery is performed by the runtime |
| Rejected handler | A synthetic throw on attempt 1 leads to attempt 2; built HTTP still responds | Does not prove load, crash or deployment isolation |
| Exhaustion and DLQ | Two configured retries yield attempts 1, 2, 3, then another local Queue receives the poison payload | The local DLQ is consumed for observation; it is not an operator retention/recovery system |
| Synthetic replay | Re-enqueue of the same logical key after terminal observation has a new transport ID | Controlled replay, not durable deduplication, exactly-once behavior or deployed recovery |
| Duplicate and order inputs | Two messages with the same logical key arrive as distinct transport IDs; explicit retry lets sequence 2 finish before sequence 1 | Duplicate payloads/reversed input are injected. No natural duplicate rate or scheduling guarantee is measured |
| Missing binding | Removing the producer binding returns `QUEUE_BINDING_MISSING` and no claimed enqueue | Local configuration refusal only |
| Environment isolation | Blue/green queue names and consumers remain separated; a deliberately wrong environment marker is rejected by the synthetic handler | Does not verify Cloudflare account IAM or deployed resource policy |
| Permission boundary | Shared HTTP sees both synthetic binding markers; separate HTTP lacks the consumer marker and consumer lacks the HTTP marker | Configuration visibility, not proof of real secrets or deployment-token least privilege |
| OpenNext integration | Actual built route and page respond in both environments/topologies | This minimal application does not establish production bundle capacity or load behavior |

### Pinned emulator acknowledgement discrepancy

The first runtime probe expected Cloudflare's documented rule: an individually acknowledged message is not redelivered when another message later throws. **Both local candidates instead redelivered that acknowledged message: attempts `[1, 2]`, rather than `[1]`.** The failed probe is retained in private evidence. Inspection of the active Miniflare Queue broker confirms its batch retry decision uses batch outcome and retry requests without honoring the explicit-ack set on the failure path.

Two explicitly named characterization cases retain this negative observation. A green suite means the pinned behavior was reproduced; those cases are **not passes of the documented Cloudflare guarantee**. When a future dependency update corrects the broker, they should fail and the evidence/expectation should be renewed. No runtime patch, silent workaround, skipped test, threshold relaxation or version change hides the discrepancy.

A second host runner would not by itself repair the same broker. Keep the current harness for this evidence; resolving parity or validating production ack semantics requires a separately scoped dependency investigation or authorized deployed Queue evidence before relying on that guarantee. The proof does not authorize either operation.

## Topology tradeoffs

| Boundary | Shared primary Worker | Separate consumer Worker |
| --- | --- | --- |
| Runtime access | Fetch and Queue handlers share configured bindings/secrets | Consumer can receive only its own bindings; demonstrated with synthetic markers |
| Build/deployment | One OpenNext composition entry point and release artifact | Preserves queue-free web handler and adds a consumer artifact/configuration |
| Recovery coupling | Source rollback replaces HTTP and Queue code together | Consumer source can be rolled back independently, subject to payload compatibility |
| Failure | Local handler rejection did not break HTTP | Separate isolate can contain consumer faults; real resource/load isolation remains unproved |
| Operations | One environment map, deployment target and release owner | Another environment/secret map, deployment target, diagnostics and compatibility handoff |
| Scaling/runtime limits | Shared artifact and Worker configuration; no measured capacity limit | Independent settings/bundle/ownership possible; local Queue consumer concurrency is unsupported |
| Queued state | Deploy/source rollback does not undo accepted or processed messages | Same; splitting Workers does not solve duplicates, ordering or lost enqueue |

Deployment, independent rollback, regional durability, autoscaling, account permissions, production throughput/limits, retry timing and actual business idempotency were not executed. These columns describe configuration/release consequences, not deployed test outcomes. The user's final topology choice and later P5E-2/P5E-3/P5E-C remain separate gates.

## Isolation and recovery

Each harness uses an identity-owned empty temporary root, preventing adjacent `.env`/`.dev.vars` loading, and absolute paths to the synthetic fixtures and built assets. The host denies outbound non-loopback fetches and fails if the Worker attempts one. Payloads, markers and logs are synthetic; no provider credentials or messages are used. Test resets recreate the runtime and its ephemeral Queue storage; `close()` stops it and only the task-created temporary root is removed. This establishes test isolation, not restart durability.

Preserve the isolated branch and private preparation, raw failed/successful logs, frozen inventories and review packet. Reverting the proof is source recovery only; no real Queue, Worker, lease, credential or retained provider resource was created or deleted. Existing product generation, descriptor/state/certification records and immutable fixtures remain unchanged.

## Official sources refreshed for this proof

- [OpenNext custom Worker](https://opennext.js.org/cloudflare/howtos/custom-worker): compose another handler with the generated fetch and preserve needed named exports.
- [Cloudflare test harness](https://developers.cloudflare.com/workers/testing/test-harness/) and [harness configuration](https://developers.cloudflare.com/workers/testing/test-harness/configure/): production build output, multiworker configuration and reset/diagnostic boundaries.
- [Queue JavaScript API](https://developers.cloudflare.com/queues/configuration/javascript-apis/) and [batching/retries](https://developers.cloudflare.com/queues/configuration/batching-retries/): acknowledgement, retry precedence and attempts; distinguish these documented contracts from the observed emulator discrepancy.
- [Dead-letter Queues](https://developers.cloudflare.com/queues/configuration/dead-letter-queues/): exhaustion disposition.
- [Delivery guarantees](https://developers.cloudflare.com/queues/reference/delivery-guarantees/) and [how Queues works](https://developers.cloudflare.com/queues/reference/how-queues-works/): at-least-once delivery without ordering guarantees.
- [Local development](https://developers.cloudflare.com/queues/configuration/local-development/): separate local producers/consumers and unavailable local consumer-concurrency proof.

These official sources were refreshed on the date above. They guide expectations; only the named executed checks establish local observations.

## Subsequent generated-runtime characterization

The shared-Worker implementation also exercises the actual generated graph: Next `16.3.3`, OpenNext `1.20.2`, Wrangler `4.118.0`, Vitest `5.0.0`, Effect `4.0.0-rc.112`, Miniflare `5.20260730.0-alpha` and workerd `1.20260730.1`. This is a distinct retained generation graph; the proof graph and its evidence above are unchanged.

Its [generated whole-Worker specification](../../packages/builder-core/templates/background-job-delivery/apps/web/tests/integration/job-worker.test.ts) deliberately acknowledges one real consumer message before a later synthetic batch throw. The targeted local run observed attempts `[1, 2]` while its monotonic side effect remained `1`. This is negative acknowledgement characterization and repeat-safety evidence, not a pass of Cloudflare's documented no-redelivery guarantee. No dependency change or second runner conceals the discrepancy.
