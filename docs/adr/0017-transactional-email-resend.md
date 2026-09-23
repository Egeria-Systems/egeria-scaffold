# ADR-0017: Independently selectable transactional email

**Status:** Accepted

**Date:** 2026-09-22

## Context

Transactional email needs a provider-neutral application boundary and explicit provider semantics without introducing a business workflow. The user approved current-profile support, native HTTP transport, the sender and reliability contract, and privacy/removal behavior on 2026-09-22.

## Decision

`transactional-email-resend@0.1.0` is optional on current `portfolio@0.11.0`, `site@0.12.0`, and `app@0.2.0`. It requires `app-foundation@0.2.0`, which supports those three profiles. Selection preserves origin profile and routing: portfolio remains one page. No persistence, queue, authentication, contact submission, template, or public sending endpoint is implied.

This explicitly supersedes only the exact `app-foundation@0.1.0` requirement in [ADR-0013](0013-convergent-app-profile.md) and [ADR-0016](0016-optional-application-persistence.md) when email is selected or its foundation is retained. Default recipes and historical installed descriptors, rendering, locks and transition edges remain unchanged. New email addition requires an exact current recipe. Installed views select the complete finite tuple, including foundation version, email and optional persistence. Removing email retains foundation; removing persistence retains email and its foundation. Returning portfolio/site to a foundation-free state is outside this capability's removal executor.

The application-owned `TransactionalEmailSender` contract uses the Effect service/layer boundary accepted in [ADR-0014](0014-selective-effect-application-runtime.md). Each lazy send accepts one recipient, optional reply-to, subject, required plain text, optional HTML, and a mandatory caller-supplied opaque idempotency key. The sender address is fixed in runtime configuration. Success reports provider acceptance and an opaque message reference; it does not promise inbox delivery.

The Resend adapter uses native fetch against the fixed HTTPS sending endpoint, refuses redirects, and adds no SDK dependency. Each invocation performs one attempt with a ten-second deadline and cancellation propagation. Stable typed failures distinguish validation, configuration, authorization, idempotency conflict, rate limiting, quota, confirmed unavailability and unknown acceptance. Bounded retry hints are information only. Transport failure, timeout, malformed success or an ambiguous provider failure may mean the message was accepted. No implicit retry or durable exactly-once mechanism is generated. Resend's idempotency window is 24 hours; callers own deliberate retries using the same key and payload, message content/localization and business policy.

Composition reads runtime configuration and validates credential shape and sender/domain consistency locally. It does not verify DNS or provision credentials. Operators separately verify the sending domain and provide a sending-only domain-restricted key. Builds and tests use no real credentials. Events contain only bounded outcome and stable error codes; addresses, content, credentials, idempotency keys, message references and raw responses are excluded. Event reporting failures cannot change the send outcome.

Reviewed removal binds source ownership, preservation/ejection decisions, surviving references, exact plan inputs and provider/credential/retention dispositions. It changes source only. Existing isolated guarded writes, verification, re-inference, migration append and state-last persistence remain mandatory. Provider accounts, keys, DNS, retained messages and source recovery remain separate operations.

## Consequences

The broader foundation and new email descriptor are new pending certification subjects; existing exact receipts remain historical evidence for their original subjects. Controlled provider tests and local workerd evidence establish exercised adapter behavior, not live-provider certification or inbox delivery. The [capability model](../architecture/capability-model.md#transactional-email-boundary) owns lifecycle limits; the [program roadmap](../roadmaps/program-roadmap.md#one-time-2026-09-19-transactional-email-implementation-exception) owns sequencing and the separate integration gate.

Provider contracts: [sending API](https://resend.com/docs/api-reference/emails/send-email), [idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys), [errors](https://resend.com/docs/api-reference/errors), [verified domains](https://resend.com/docs/dashboard/domains/introduction), and [API keys](https://resend.com/docs/dashboard/api-keys/introduction), checked 2026-09-19.
