# Hosted contact form

Selected contact uses `NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY` as a public build input. A missing or empty key in development leaves the home-page form unavailable, with localized copy and the existing contact links as fallback. There is no form, challenge or provider request in that state. Staging and production require a valid UUID; malformed nonempty values refuse every target. Diagnostics name the field and reason without printing its value.

The key identifies the receiving form; it is not a secret. Never put private API credentials in a `NEXT_PUBLIC_` variable, source, `.egeria`, logs or examples. Public browser values are fixed at compilation: changing Worker runtime configuration cannot change a built destination. See [Next environment variables](https://nextjs.org/docs/app/guides/environment-variables) and the generated `docs/environments.md` guide.

## Account, inbox and challenge setup

For separately authorized live use, the operator needs an owner-controlled [Web3Forms account](https://app.web3forms.com/), a form and a verified receiving inbox. Use an intended shared development/staging form and inbox within the project; use a separate production form and inbox. Confirm the actual destination before compiling each target.

Enable mandatory hCaptcha for that form in the dashboard. The generated client already uses Web3Forms' shared free hCaptcha site key; retain it. A generic hCaptcha test key/secret pair or successful client challenge does not prove Web3Forms accepts the token. See [Web3Forms hCaptcha setup](https://docs.web3forms.com/getting-started/customizations/spam-protection/hcaptcha).

Official pricing checked **2026-09-24** lists Free with 250 monthly submissions, unlimited forms and domains, hCaptcha and one recipient per form. Advanced domain restrictions are optional paid features, not a prerequisite here. Recheck current limits and the selected account at setup. See [Web3Forms pricing](https://web3forms.com/pricing).

Real hCaptcha does not support supplying `localhost` or `127.0.0.1` as the hostname. An authorized live local check therefore needs an owner-controlled nonproduction hostname mapped to loopback. For example, an operator may replace this reserved example hostname with their own in macOS `/private/etc/hosts`:

```text
127.0.0.1 contact-dev.example.com
```

Use that hostname when visiting the development server, and verify provider configuration. This example does not instruct an automated task to change the hosts file. Controlled tests below may use loopback because they intercept the SDK and all provider traffic. See the [hCaptcha developer guide](https://docs.hcaptcha.com/).

## Ordinary local work

From the generated workspace root, copy examples only when the destination files do not already exist; preserve existing local configuration:

```sh
cp apps/web/.env.example apps/web/.env.local
cp apps/web/.dev.vars.example apps/web/.dev.vars
pnpm --dir apps/web run check:environment
pnpm --dir apps/web run dev
```

Leave `NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY=` blank for unavailable local contact. Next loads `apps/web/.env.local`; the Node preflight checks explicit process inputs only. `.env.staging` is not automatically loaded. Worker `.dev.vars` does not configure the browser destination. For deliberately authorized live local use, replace the blank value with the nonproduction form UUID, restart/rebuild and visit the supported mapped hostname.

Copy comes from `apps/web/content/en-CA/contact-form-web3forms.yaml` and, when multilingual is selected, its `fr-CA` counterpart. Keep both complete; the subject is static, bounded and single-line. Contact appears only on exact supported home routes. It adds no server endpoint, database, Resend call or cross-provider fallback.

## Separate staging and production builds

Replace the following placeholders with the appropriate public form UUID before execution. These commands validate and build locally; they do not deploy:

```sh
APPLICATION_ENVIRONMENT=staging NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY='<nonproduction-form-uuid>' pnpm --dir apps/web run check:environment:deployment
APPLICATION_ENVIRONMENT=staging NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY='<nonproduction-form-uuid>' pnpm --dir apps/web run build
APPLICATION_ENVIRONMENT=production NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY='<production-form-uuid>' pnpm --dir apps/web run check:environment:deployment
APPLICATION_ENVIRONMENT=production NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY='<production-form-uuid>' pnpm --dir apps/web run build
```

Build both targets separately from the same reviewed source. Runtime substitutions cannot retarget either artifact. A project without selected contact does not require this key. Target conflicts retain the common environment error priority; inspect the named field rather than dumping environment values.

## Controlled verification

`CONTACT_TEST_EXPECTED_ACCESS_KEY` is a Playwright assertion input only. It describes the artifact expected by the test, does not configure the application, and belongs in neither `.env.example` nor `.egeria`. Empty expectation selects unavailable tests; a synthetic UUID selects configured tests. With both the application key and expectation absent or empty, the development contact spec exercises unavailability.

```sh
pnpm --dir apps/web run browser:install
pnpm --dir apps/web run test:unit
pnpm --dir apps/web run test:component
APPLICATION_ENVIRONMENT=development NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY= CONTACT_TEST_EXPECTED_ACCESS_KEY= pnpm --dir apps/web run test:e2e:dev web3forms-contact.spec.ts
APPLICATION_ENVIRONMENT=development NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY=00000000-0000-4000-8000-000000000001 CONTACT_TEST_EXPECTED_ACCESS_KEY=00000000-0000-4000-8000-000000000001 pnpm --dir apps/web run test:e2e:dev web3forms-contact.spec.ts
APPLICATION_ENVIRONMENT=development NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY=00000000-0000-4000-8000-000000000001 pnpm --dir apps/web run build:cloudflare
APPLICATION_ENVIRONMENT=development CONTACT_TEST_EXPECTED_ACCESS_KEY=00000000-0000-4000-8000-000000000001 pnpm --dir apps/web run test:e2e:preview web3forms-contact.spec.ts
```

The contact spec intercepts all provider requests, supplies a synthetic challenge and bounded responses, and aborts other external traffic. It loads no real SDK and submits to no real form. Preview consumes prepared output; its expectation must match the build. Use the matching runtime target and Wrangler environment for production-like previews as described in the generated `docs/environments.md` guide. Keep existing foundation/runtime configuration intact.

Node/jsdom tests establish their own boundaries. Playwright and axe provide controlled browser and automated accessibility evidence, not WCAG conformance. Review keyboard focus, zoom, reflow, translations and manual fallback. Live CAPTCHA enforcement, provider acceptance and independently observed inbox delivery require separately authorized evidence; an accepted response alone does not prove delivery.

## Privacy, outcomes and troubleshooting

Configured contact waits for explicit challenge activation before loading hCaptcha. Submission sends exactly `access_key`, `name`, `email`, `message`, `subject` and `h-captcha-response` to Web3Forms. The transport omits credentials and referrer, refuses redirects, makes no automatic retry, and bounds its wait and response size. Tokens reset after an attempt or expiration. Rejection/rate limiting preserves fields; network, timeout or unreadable-response outcomes are uncertain, so a deliberate retry may duplicate a message. Navigation cancels local waiting but cannot revoke a remotely accepted submission. Raw provider messages are never displayed.

If blocked, use the manual contact links and inspect the selected form, inbox, hCaptcha enforcement, quota and any configured domain restriction. Keep diagnosis separate from sending another message. See [Web3Forms troubleshooting](https://docs.web3forms.com/getting-started/troubleshooting).

hCaptcha receives browser/network information, and submitted fields reach Web3Forms and the recipient inbox. Do not solicit sensitive information. Official retention information conflicts: the older [FAQ](https://docs.web3forms.com/getting-started/faq) says submissions are not stored, while the [current site](https://web3forms.com/) and [pricing](https://web3forms.com/pricing) advertise retention/history. These sources were checked **2026-09-24**. Verify the actual form/account retention and receiving-inbox policy before live use; do not assume zero storage or equate dashboard visibility with deletion.

For a deployment CSP, permit the Web3Forms submission connection and hCaptcha's documented script, frame, style and connection origins, including `https://js.hcaptcha.com`; follow [hCaptcha CSP guidance](https://docs.hcaptcha.com/) without pinning regional asset hosts. Verify the actual deployed policy separately.

## Disable and recover

Clear the key and rebuild to restore development unavailability. A release build with selected contact requires valid configuration; omit release contact through an approved generated-repository capability removal. During internal generation assembly this lifecycle is a private integration interface, not an advertised public CLI command.

Removal preserves/ejects modified application-owned source and refuses conflicting shared edits or surviving references. Reconcile preserved ownership before re-addition. Source removal does not delete a form, provider submissions or inbox records: retain those resources until their separate disposition is explicitly decided. Recover source, build configuration, runtime configuration and provider/data changes independently.
