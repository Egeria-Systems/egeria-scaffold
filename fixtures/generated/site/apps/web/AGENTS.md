# acme-site web application guidance

- Load validated locale content in routes and pass typed values into pure presentation components.
- Add page sections through the typed source registry and preserve exact content validation, stable instance identifiers, and one enabled hero first among enabled sections per page.
- Keep long-form Markdown as validated data and use only an explicitly reviewed renderer.
- Keep visible copy out of TypeScript and TSX source.
- Preserve externalized skip-navigation copy, the `main-content` focus target, visible focus treatment, responsive wrapping, minimum primary-link target sizing, and reduced-motion protection.
- Keep Tailwind CSS and PostCSS configuration and global semantic design tokens in their generated application boundaries; do not scatter colour literals through presentation components.
- Keep Playwright and axe quality configuration environment-specific. Install Chromium explicitly, keep development and OpenNext/workerd preview on their fixed loopback ports, and supply deployed mode only through a reviewed HTTPS `PLAYWRIGHT_DEPLOYED_URL`.
- Keep browser specifications content-agnostic and preserve heading/content, navigation, page/console error, axe, keyboard/visible-focus, 320 CSS-pixel reflow, and reduced-motion coverage. Automated results are bounded evidence and do not establish WCAG conformance.
- When Calendly booking is installed, keep its settings managed and its copy, reader, client component, and browser specification application-owned. Keep provider execution in the direct cross-origin iframe, and preserve the normal-link fallback, activation-bounded loading, and native dialog lifecycle.
- Keep observability instrumentation and reporters infrastructure-owned. Preserve credential-free and referrer-free same-origin delivery plus the content-type, stream-before-buffer byte-size, schema, vocabulary, correlation-token, and extra-field boundaries; never forward raw errors, messages, stacks, URLs, headers, cookies, form values, or arbitrary attributes. Keep Cloudflare request/response invocation logs disabled so they cannot bypass this vocabulary; platform error/exception logs remain a separate provider-controlled certification concern.
- Keep Cloudflare bindings at configuration and composition boundaries; only the Cloudflare observability adapter may read the declared Better Stack secrets, version metadata, and execution context. Do not import Cloudflare types into domain, application, or presentation code.
- Keep Cloudflare Web Analytics and every other analytics or browser-storage surface absent unless a separately selected analytics capability owns it.
- Treat application-owned routes, content, presentation, styles, and guidance as project-maintained surfaces.
- Keep unit tests in `tests/unit` under the named Node project and component tests in `tests/component` under the named jsdom project. Prefer semantic `getByRole` or `findByRole` queries and `userEvent.setup()` for interaction; preserve explicit component `cleanup` and avoid broad snapshots.
- jsdom does not prove layout, visible focus, iframe/browser APIs, routing, async Server Components, workerd behavior, or accessibility conformance. Escalate those cases to the owning Playwright development or preview suite. Add Workers Vitest only when a selected capability owns concrete Workers bindings and its test contract.
