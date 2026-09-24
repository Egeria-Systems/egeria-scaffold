# ADR-0018: Browser-hosted contact form

**Status:** Accepted

**Date:** 2026-09-23

[ADR-0020](0020-application-environments.md#generation-and-precise-supersessions) replaces literal public-key creation/settings transport with fixed public build configuration at complete generation activation. It preserves the six-field browser/hCaptcha contract, bounds, no retry/fallback, independent Resend and separate provider/data disposition below.

## Context

Public contact needs a small independently selectable form without requiring application email or durable submission infrastructure. The user approved current portfolio/site/app recipes, direct browser fetch with localized outcomes, and free hCaptcha with subsequent provider-side certification.

## Decision

`contact-form-web3forms@0.1.0` is source-generated on `portfolio@0.11.0`, `site@0.12.0` and `app@0.2.0`. It depends only on content-files and section-composition. It adds no package, server endpoint, Effect boundary, binding, secret, database or email fallback. Resend remains the independently selectable application sender under [ADR-0017](0017-transactional-email-resend.md); durable contact submissions remain separate future work.

Selection requires one strict public UUID form access key. The browser makes one explicit-field POST to the fixed Web3Forms endpoint with credentials omitted, referrer suppressed, redirects refused, a 15-second total deadline and a 16-KiB response limit. Localized results distinguish validation, provider rejection, rate limiting, acknowledged acceptance and uncertainty. Provider text is never displayed or logged. Acceptance does not mean mailbox delivery, and an uncertain attempt may have succeeded remotely. There is no automatic retry.

The capability owns its validated English/French copy, pure view, client controller, native-fetch boundary and direct hCaptcha SDK adapter. A visitor explicitly activates the challenge. The named SDK callback is registered before the script loads; script-load events alone cannot establish readiness. Each widget uses the matching language and clears its token after attempts, expiry, errors and teardown. Cached SDK readiness supports navigation/remount without another provider integration abstraction. Dashboard enforcement requires live certification.

One finite root-layout variant adds a Suspense-wrapped home-only placement after route children while preserving metadata, locale, analytics consent and observability. Initial server/hydration output is empty; exact supported home paths select the form. Route errors may coexist with the form while the root layout survives. Other routes never mount it. The existing contact links remain available independently.

The public identifier, provider submissions and recipient inbox have separate retention and recovery responsibilities. The capability declares repository, external and persistent-data state with reviewed source-only removal. Generated code and copy are application-owned; settings and shared composition retain their existing managed protections. Removal preserves/ejects edits, checks surviving references and records operator dispositions without deleting external data.

## Consequences

Default recipes, historical descriptors and installed tuples remain exact. Current add/remove recomputation preserves every selected integration, including contact settings, Resend and retained foundation. Existing foundation and persistence continue to require their Worker and binding checks. Contact introduces no transition edge; installed contact conservatively refuses existing profile transitions.

The [capability model](../architecture/capability-model.md#hosted-contact-form-boundary) owns lifecycle and claim boundaries. The [program roadmap](../roadmaps/program-roadmap.md#hosted-contact-form--next-two-increments) schedules immediate separate Web3Forms certification; mandatory Resend certification remains later. Controlled local tests, accessibility automation and workerd previews do not certify live enforcement, delivery, retention, translation quality or WCAG conformance.

Official contracts checked 2026-09-23: [Web3Forms hCaptcha](https://docs.web3forms.com/getting-started/customizations/spam-protection/hcaptcha), [Web3Forms API](https://docs.web3forms.com/getting-started/customizations), [hCaptcha configuration](https://docs.hcaptcha.com/configuration/), [Next.js usePathname](https://nextjs.org/docs/app/api-reference/functions/use-pathname), and [React server snapshots](https://react.dev/reference/react/useSyncExternalStore#adding-support-for-server-rendering).
