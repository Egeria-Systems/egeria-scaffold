# Hosted contact form

The optional home-page form sends name, reply email and message directly from the browser to Web3Forms. It remains on the page. The existing contact section remains the manual fallback. It adds no server endpoint, database, transactional email call or cross-provider fallback.

## Configuration

The generated contact settings contain a public Web3Forms UUID access key, not a secret. Obtain your own form identifier through Web3Forms during deployment preparation; never place private API keys here. The synthetic identifier in retained examples cannot receive submissions. Configure and verify the destination inbox and enable hCaptcha enforcement for that form in the Web3Forms dashboard. The client uses the free Web3Forms hCaptcha site key. A client checkbox alone does not establish provider-side enforcement.

Copy is validated from `apps/web/content/en-CA/contact-form-web3forms.yaml` and its `fr-CA` equivalent. Edit both consistently; subject is static, bounded and single-line. The form appears only on the exact home route (including supported locale homes). It is independent of Calendly, analytics consent and Resend transactional email.

## Privacy and network policy

No provider request occurs until the visitor activates hCaptcha. hCaptcha receives browser/network information; submissions then send name, email, message, public form identifier, static subject and CAPTCHA token to Web3Forms. Do not solicit sensitive information. Review provider terms, processor disclosures and actual account retention settings before launch. Treat submissions as potentially stored in Web3Forms and the recipient inbox; source removal does not delete that data.

If deploying with CSP, allow `https://api.web3forms.com` for connections and hCaptcha's documented `https://hcaptcha.com` and `https://*.hcaptcha.com` script, frame, style and connection origins, including `https://js.hcaptcha.com`. Do not hard-code regional asset subdomains. Verify the actual deployment policy. There are no contact environment variables, server secrets or bindings.

## Outcomes and recovery

The client makes one bounded attempt and never automatically retries. A success acknowledges provider acceptance, not mailbox delivery. Rate limiting and rejection preserve input. Network errors, unreadable replies and timeouts are uncertain outcomes: an explicit retry may duplicate a message. CAPTCHA must be solved again after each attempt or expiration. Navigation/unmount cancels the local wait; cancellation cannot revoke a submission already accepted remotely. If JavaScript, hCaptcha or Web3Forms is unavailable, use the existing contact links.

Removal is source-only. Review references and preserve/eject user-edited files through the builder's ordinary guarded removal procedure. Dispose of the public form identifier, provider submissions and recipient-inbox records separately under the operator's retention policy. Re-add only after preserved references are reconciled. No provider deletion is automated.

## Verification boundary

Generated unit and component tests use synthetic responses. Playwright runs controlled development and OpenNext/workerd journeys with provider interception; it does not send real forms. Live provider enforcement, real delivery, retention/disposition and operator evidence require the separate capability certification increment. Automated accessibility checks do not establish WCAG conformance; inspect keyboard, focus, zoom, reflow, translated copy and fallback behavior before release.

Official references: [Web3Forms API](https://docs.web3forms.com/getting-started/customizations), [Web3Forms hCaptcha](https://docs.web3forms.com/getting-started/customizations/spam-protection/hcaptcha), [hCaptcha configuration](https://docs.hcaptcha.com/configuration/), [hCaptcha CSP guidance](https://docs.hcaptcha.com/).
