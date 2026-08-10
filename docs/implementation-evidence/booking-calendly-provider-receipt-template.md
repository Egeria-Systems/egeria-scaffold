# Booking Calendly Provider Receipt Template

Use this template only after the separately authorized protected-staging and provider journey in the [preparation runbook](2026-08-10-booking-calendly-certification-preparation.md). Replace every bracketed prompt with content-safe evidence or `not executed`. Delete this instruction before review.

**Execution date:** [date and timezone]

**Receipt status:** [complete / incomplete]

## Workflow and revision identity

- Repository revision: [40-character Git commit]
- Workflow run URL: [GitHub Actions run URL]
- Protected environment: `compatibility`
- Human deployment approver: [public GitHub identity]
- Local receipt artifact digest: [GitHub-reported artifact SHA-256]
- Staging origin: [dedicated non-production origin; omit private query data]
- Worker-name preflight for `acme-portfolio-calendly-web`: [absent before deployment / approved dedicated certification resource]

## Synthetic-data declaration

- Synthetic host and invitee labels declared before execution: [labels without email addresses]
- Test-controlled calendar/inbox confirmed: [yes / no]
- Real client data, identities, messages, calendars, and production resources excluded: [yes / no]
- Calendly service tier and event-type slot confirmed: [tier and bounded slot statement]

## Deployed application evidence

- Generated profile, capability, version, and mode: `portfolio`, `booking-calendly`, `0.1.0`, `popup`
- Deployed browser suite result: [pass / fail and workflow step URL]
- Ordinary-link fallback target verified: [pass / fail]
- Popup activation and visible scheduling page verified: [pass / fail]
- User-visible post-booking success state: [content-safe observation]

## Provider-confirmed evidence

- Synthetic booking completed through the rendered integration: [yes / no]
- Provider meeting status in Calendly Meetings: [scheduled / cancelled / other]
- Booking and provider-record timestamps: [bounded timestamps and timezone]
- Causal match between synthetic labels, time slot, and provider record: [content-safe explanation]
- Provider reviewer: [identity]

## Cancellation and cleanup evidence

- Synthetic meeting cancellation status and timestamp: [status]
- Synthetic event type disabled or deleted: [status]
- Test calendar/inbox cleanup: [status]
- Certification Worker rolled back or removed: [status]
- Staging origin no longer serves the certification Worker: [verification]
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
