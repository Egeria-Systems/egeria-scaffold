# ADR-0019: Optional background job delivery in the primary Worker

**Status:** Accepted topology, bounded implementation authority and Free-tier maximum retention.

**Date:** 2026-09-23

[ADR-0020](0020-application-environments.md#generation-and-precise-supersessions) adds common application-target/deployment reconciliation and narrowly permits related unused snapshot retirement at complete generation activation. It does not reopen primary-Worker topology, queue/envelope guards, retention/attestation, local-runtime limitations or unsupported lifecycle/replay/drain.

## Context and decision

The user accepts [merged Queue topology proof](../compatibility/queue-consumer-topology.md) as local predecessor evidence, including its emulator acknowledgement discrepancy. The subsequent explicit human decision selects one shared primary OpenNext Worker. HTTP delivery and Queue delivery remain cohesive separate modules with a narrow composition entry point preserving OpenNext fetch and named exports. The historical separate-Worker preference in [D4](../roadmaps/2026-09-16-remaining-program-decisions.md#4-d4-source-separation-and-worker-separation-are-different-decisions) is preserved as history. No second topology or `apps/jobs` is generated.

Fresh generation supports independently selected `background-job-delivery@0.1.0` on current portfolio, site and app recipes. It selects the existing broader `app-foundation@0.2.0` without changing origin profile or adding persistence. This extends ADR-0017's broader-foundation selection to jobs, superseding only the exact foundation 0.1.0 requirement in [ADR-0013](0013-convergent-app-profile.md) and [ADR-0016](0016-optional-application-persistence.md) for this explicit selection. Default recipes, retained installed tuples and immutable fixtures remain unchanged.

The consuming application owns job definitions, payload allowlists and repeat-safe side effects. Dispatch uses a provider-neutral Effect service and stable opaque operation identity. Acceptance means queued, not completed. Delivery can duplicate or reorder and can time out after a side effect; consumers reconcile using the original operation identity and must implement idempotence or monotonic updates where needed. No generic durable deduplication store is introduced.

Use the existing whole-built-Worker harness and exact generated dependency graph. Preserve the proof's negative mixed-batch acknowledgement observation without claiming topology fixes it or exactly-once processing. Dependency or runner changes require demonstrated need and compatibility evidence.

Existing-repository lifecycle and operator replay/drain machinery remain unsupported until their own increment. No business jobs, public dispatch/replay endpoint, event bus, scheduler, implicit contact/email integration, provider resource creation or deployment is included. The [bounded runtime exception](../roadmaps/program-roadmap.md#one-time-2026-09-23-background-job-runtime-exception) owns sequencing and the later reconciliation gate. Local execution is not capability certification or phase closure.

## Retention decision

The user selected the Free-tier maximum: **24 hours (86,400 seconds)** for primary and dead-letter queues. Remote preflight requires explicit operator attestation that the selected resources use this policy and have an inspection owner who can act before expiry. The manual deployment input defaults to false and follows the exact-revision gate. This attestation does not verify remote configuration or authorize deployment, provider mutation, data replay or spending. Expired work is not recoverable by source rollback; no paid retention or generic archive is introduced.

## Contract owners and evidence

The [capability boundary](../architecture/capability-model.md#background-job-delivery-boundary) owns installed selection, managed surfaces and unsupported lifecycle. The generated [operator guide](../../packages/builder-core/templates/background-job-delivery/docs/background-job-delivery.md) owns bounded admission, attempt and terminal/recovery contracts. Handler support or registry errors retain the original accepted envelope through native retry and dead-letter exhaustion; restoring a compatible consumer must permit identity-preserving recovery. Malformed bodies remain excluded from diagnostic terminal records.

[OpenNext custom Worker composition](https://opennext.js.org/cloudflare/howtos/custom-worker), [Cloudflare Queue APIs](https://developers.cloudflare.com/queues/configuration/javascript-apis/), [retry policy](https://developers.cloudflare.com/queues/configuration/batching-retries/), [dead-letter queues](https://developers.cloudflare.com/queues/configuration/dead-letter-queues/) and [retention limits](https://developers.cloudflare.com/queues/platform/limits/) were refreshed during this increment. They inform the contract without establishing deployed behavior or resolving the local acknowledgement discrepancy.
