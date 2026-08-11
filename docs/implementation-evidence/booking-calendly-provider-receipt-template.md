# Booking Calendly Provider Receipt Template

Use this template only after the separately authorized protected-staging and provider journey in the [preparation runbook](2026-08-10-booking-calendly-certification-preparation.md). Replace every bracketed prompt with content-safe evidence or `not executed`. Delete this instruction before review.

For a new run, also apply the [shared test deployment policy](../governance/shared-test-deployment.md). Historical completed receipts keep the identities actually used and are not rewritten from this template.

**Execution date:** [date and timezone]

**Certification receipt status:** [replace with `complete` only after every section is resolved]

**Certification reviewer decision:** [replace with `accepted` only after affirmative implemented-task review]

**Certification unresolved prompts:** [replace with `none` only after every bracketed prompt is resolved]

**Certification capability:** `booking-calendly`

**Certification descriptor version:** `0.1.0`

**Certification behavior-contract digest:** `sha256:339462dc3cc43065aeeb2eabc0556960d07c4c6b3e1e13738715fc7e0cedc8ab`

**Certification evidence revision:** [40-character deployed Git revision]

**Passed certification outcomes:** `cleanup-recovery, deployed-application, provider-confirmed`

**Reviewed certification outcomes:** `cleanup-recovery, deployed-application, provider-confirmed`

## Workflow and revision identity

- Repository revision: [40-character Git commit]
- Workflow run URL: [GitHub Actions run URL]
- Protected environment: `test-deploy`
- Deployment risk owner: [public GitHub identity]
- Independent human deployment reviewer: `none — sole-developer exception`
- GitHub environment required-reviewer status: `none configured`
- Administrator bypass: [enabled and accepted for this non-production risk exception / unexpected state requiring stop]
- Local receipt artifact digest: [GitHub-reported artifact SHA-256]
- Staging origin: [`DEPLOY_URL` matched the public non-production `test-deploy` Worker root / mismatch requiring stop]
- Generated candidate-name preflight for `acme-portfolio-calendly`: [exact generated candidate identity]
- Shared Worker preflight for `test-deploy`: [exclusive lease, exact baseline/version, protection, route, and quota confirmed]
- Action owners and roles: [GitHub repository administrator; workflow dispatcher; deployment risk owner; Cloudflare account administrator; Calendly certification operator; implemented-task reviewer; identify `CoveMB` in every role]
- Credential disposition: [task token revoked / exposed or over-scoped token rotated / shared compatibility token unchanged under named rotation plan]

## Synthetic-data declaration

- Synthetic host and invitee labels declared before execution: [labels without email addresses]
- Test-controlled calendar/inbox confirmed: [yes / no]
- Real client data, identities, messages, calendars, and production resources excluded: [yes / no]
- Calendly service-tier basis: `Free-compatible during and after trial`
- Free-baseline check: [one one-on-one event type; one connected calendar; bounded availability; supported video conferencing; ordinary scheduling; no trial-only or paid dependency]
- Event-type lifecycle: `pre-existing designated event; preserved`
- Quota and spend result: [one event slot and one booking; existing GitHub/Cloudflare quota; no paid upgrade or incremental spend]

## Deployed application evidence

- Generated profile, capability, version, and mode: `portfolio`, `booking-calendly`, `0.1.0`, `popup`
- Deployed browser suite result: [pass / fail and workflow step URL]
- Ordinary-link fallback target verified: [pass / fail]
- Popup activation and visible scheduling page verified: [pass / fail]
- User-visible post-booking success state: [content-safe observation]

## Provider-confirmed evidence

- Synthetic booking completed through the rendered integration: [yes / no]
- Provider meeting status in Calendly Meetings: [scheduled / cancelled / other]
- Polling result: [30-second checks for no more than 5 minutes / not needed]
- Booking and provider-record timestamps: [bounded timestamps and timezone]
- Causal match between synthetic labels, time slot, and provider record: [content-safe explanation]
- Provider reviewer: [identity]

## Cancellation and cleanup evidence

- Synthetic meeting cancellation status and timestamp: [status]
- Event-type cleanup: `pre-existing designated event preserved; no event-type mutation`
- Test calendar/inbox cleanup: [status]
- Provider-specific Worker state disposition: [none / removed / explicitly retained under named owner and expiry]
- Shared Worker recovery: [clean compatibility baseline deployed to retained `test-deploy` Worker / not executed]
- Certification-only route reachability: [unreachable after cleanup / cleanup-recovery fails]
- Compatibility baseline verification: [expected route and deployed identity / failure]
- Production resources and persistent stores touched: `none`

## Privacy exclusions

This receipt must not contain an email address, calendar content, meeting URL, provider confirmation link, token, credential, cookie, secret value, private screenshot, personal data, or real client identifier. Link only to access-controlled provider evidence when a reviewer must inspect it; do not copy that content into the repository.

## Claim boundary

This receipt records one bounded synthetic provider journey. It does not establish WCAG conformance, ongoing provider availability, production safety, visual approval, or human accessibility. Automated accessibility results remain partial evidence only.

## Reviewer decision

- Application evidence accepted: [yes / no and reason]
- Provider evidence accepted: [yes / no and reason]
- Cleanup/recovery evidence accepted: [yes / no and reason]
- Registry may change from `pending` to `certified`: [yes / no]
- Review revision: [40-character Git commit]
- Rerun trigger evaluation: [none / exact trigger requiring a newly authorized rerun]
