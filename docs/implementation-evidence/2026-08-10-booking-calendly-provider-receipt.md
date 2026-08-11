# Booking Calendly Provider Certification Receipt

**Execution date:** `2026-08-10 America/Toronto (EDT, UTC-04:00)`

**Certification receipt status:** `complete`

**Certification reviewer decision:** `accepted`

**Certification unresolved prompts:** `none`

**Certification capability:** `booking-calendly`

**Certification descriptor version:** `0.1.0`

**Certification behavior-contract digest:** `sha256:339462dc3cc43065aeeb2eabc0556960d07c4c6b3e1e13738715fc7e0cedc8ab`

**Certification evidence revision:** `f9ccb143724b4f1dd7f05a2ee8e3219c224d5558`

**Passed certification outcomes:** `cleanup-recovery, deployed-application, provider-confirmed`

**Reviewed certification outcomes:** `cleanup-recovery, deployed-application, provider-confirmed`

## Workflow and revision identity

- Repository revision: `f9ccb143724b4f1dd7f05a2ee8e3219c224d5558`
- Workflow run: [booking-calendly-certification attempt 2](https://github.com/Egeria-Systems/egeria-scaffold/actions/runs/31443784009)
- Workflow job: [verify-and-deploy](https://github.com/Egeria-Systems/egeria-scaffold/actions/runs/31443784009/job/93638099657)
- Protected environment: `compatibility`
- Deployment risk owner: `CoveMB`
- Independent human deployment reviewer: `none — sole-developer exception`
- GitHub environment required-reviewer status: `none configured`
- Administrator bypass: `enabled and accepted for this bounded non-production risk exception`
- Local receipt artifact: `booking-calendly-local-receipt`, 419 bytes, retained through `2026-08-18T00:20:45Z`
- Local receipt artifact digest: `sha256:aafab7d79e3791b90d269fee515ef3d3e6feb9ce09922a538a224d08d731b26e`
- Staging origin: `https://acme-portfolio-calendly.bmarquiscom.workers.dev`
- Worker-name preflight: `acme-portfolio-calendly` was absent before deployment and dedicated to this certification journey
- Action owners and roles: `CoveMB` acted as GitHub repository administrator, workflow dispatcher, deployment risk owner, Cloudflare account administrator, Calendly certification operator, and implemented-task reviewer
- Credential disposition: shared non-expiring account token `egeria-scaffold github tests` remains unchanged in the `compatibility` environment; `CoveMB` owns immediate rotation after suspected exposure or an account, permission, or ownership change and an annual review by `2027-08-10`

## Synthetic-data declaration

- Synthetic labels: `controlled certification host` and `controlled certification invitee`; actual identity and address values are intentionally omitted
- Test-controlled calendar and inbox: `confirmed by the operator`
- Real client data, client identities, client messages, client calendars, and production resources excluded: `yes`
- Calendly service-tier basis: `Free-compatible during and after trial`
- Free-baseline check: one one-on-one event type, one connected calendar, bounded availability, supported video conferencing, ordinary scheduling, and no trial-only or paid dependency
- Event-type lifecycle: `pre-existing designated event; preserved`
- Quota and spend result: one event type and one booking used existing GitHub and Cloudflare quota; no paid upgrade or incremental spend

## Deployed application evidence

- Generated profile, capability, version, and mode: `portfolio`, `booking-calendly`, `0.1.0`, `popup`
- Deployed browser suite: `passed` in the workflow job's `Test deployed application behavior` step
- Ordinary-link fallback target: `passed` through the deployed browser suite
- Popup activation and visible scheduling page: `passed`; the operator completed the booking through the rendered popup integration
- User-visible post-booking success state: the operator reported a completed booking flow and received the provider confirmation email; no email content or confirmation link was retained

## Provider-confirmed evidence

- Synthetic booking completed through the rendered integration: `yes`
- Provider meeting status in Calendly Meetings: `scheduled`, then `cancelled`
- Polling result: `not needed`; the first bounded Meetings inspection showed exactly one upcoming meeting matching the designated event
- Booking and provider-record timestamps: bounded to `2026-08-10T20:20:51-04:00` through `2026-08-10T20:54:02-04:00`; exact invitee and calendar data were not retained
- Causal match: the operator completed exactly one rendered booking, received one provider confirmation, and the read-only Meetings check showed exactly one upcoming `30 Minute Meeting`; after cancellation the Upcoming count was zero
- Provider reviewer: `CoveMB`

## Cancellation and cleanup evidence

- Synthetic meeting cancellation: completed by the operator and verified no later than `2026-08-10T20:54:02-04:00`
- Event-type cleanup: `pre-existing designated event preserved; no event-type mutation`
- Test calendar and inbox cleanup: `completed and confirmed by the operator`; no provider content was copied into repository evidence
- Certification Worker: `acme-portfolio-calendly` removed by the Cloudflare account administrator
- Staging origin verification: a fresh unauthenticated request after deletion returned HTTP `404`
- Production resources and persistent stores touched: `none`

## Privacy exclusions

- Controlled host and invitee email addresses, account identities, and calendar identities: `omitted`
- Calendly booking, meeting, confirmation, cancellation, rescheduling, invitee, and event-management URLs: `not copied or retained`; only public Calendly help citations appear below
- Confirmation email contents, headers, recipients, attachments, and private meeting-location or video-conferencing details: `not copied or retained`
- Provider record identifiers, calendar payloads, account-dashboard content, browser DOM captures, and screenshots: `not copied or retained`
- Calendly cookies, browser storage, sessions, authentication material, and recovery material: `not copied or retained`
- GitHub and Cloudflare secret values, token values, and credential-bearing logs: `not copied or retained`

## Current official evidence basis

- Calendly's [meeting-management guidance](https://calendly.com/help/how-to-manage-your-meetings) and [cancellation guidance](https://calendly.com/help/how-to-cancel-a-meeting) identify the Meetings confirmation and cancellation boundaries used by the operator.
- Cloudflare's [Worker deletion API contract](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/methods/delete/) identifies script deletion and its `Workers Scripts Write` permission boundary.
- GitHub's [Actions artifacts API](https://docs.github.com/en/rest/actions/artifacts?apiVersion=2026-03-10) defines the retained artifact metadata and digest recorded above.
- OpenNext's [Cloudflare CLI contract](https://opennext.js.org/cloudflare/cli) identifies `opennextjs-cloudflare deploy` as the build, Wrangler deployment, and serving boundary exercised by the successful workflow.

## Claim boundary

This receipt records one bounded synthetic provider journey at one deployed revision. Recurring automated tests remain stubbed and fail-closed at the Calendly origin; they do not create provider bookings. This receipt does not establish ongoing provider availability, production safety, visual approval, human accessibility, or WCAG conformance. Automated accessibility results remain partial evidence only, and this receipt makes no WCAG conformance claim.

## Reviewer decision

- Application evidence accepted: `yes — exact-revision workflow deployment and deployed browser step passed`
- Provider evidence accepted: `yes — one rendered booking produced one matching provider record and confirmation`
- Cleanup/recovery evidence accepted: `yes — meeting cancelled, event preserved, Worker removed, origin returned 404, and no persistent or production resource was touched`
- Registry may change from `pending` to `certified`: `yes`
- Review revision: `f9ccb143724b4f1dd7f05a2ee8e3219c224d5558`
- Rerun trigger evaluation: `none at review`; a material descriptor/evidence-contract, provider event, service-tier, deployed environment, credential-scope, or target change requires newly authorized certification evidence
