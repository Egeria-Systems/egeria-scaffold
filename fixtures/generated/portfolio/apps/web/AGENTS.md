# acme-portfolio web application guidance

- Load validated locale content in routes and pass typed values into pure presentation components.
- Add page sections through the typed source registry and preserve exact content validation, stable instance identifiers, and one enabled hero first among enabled sections per page.
- Keep long-form Markdown as validated data and use only an explicitly reviewed renderer.
- Keep visible copy out of TypeScript and TSX source.
- Preserve externalized skip-navigation copy, the `main-content` focus target, visible focus treatment, responsive wrapping, minimum primary-link target sizing, and reduced-motion protection.
- Keep Tailwind CSS and PostCSS configuration and global semantic design tokens in their generated application boundaries; do not scatter colour literals through presentation components.
- Keep Playwright and axe quality configuration environment-specific. Install Chromium explicitly, keep development and OpenNext/workerd preview on their fixed loopback ports, and supply deployed mode only through a reviewed HTTPS `PLAYWRIGHT_DEPLOYED_URL`.
- Keep browser specifications content-agnostic and preserve heading/content, navigation, page/console error, axe, keyboard/visible-focus, 320 CSS-pixel reflow, and reduced-motion coverage. Automated results are bounded evidence and do not establish WCAG conformance.
- When Calendly booking is installed, keep its settings managed and its copy, reader, client component, and browser specification application-owned. Keep provider execution in the direct cross-origin iframe, and preserve the normal-link fallback, activation-bounded loading, and native dialog lifecycle.
- Keep Cloudflare bindings at configuration and composition boundaries; do not import them into domain or application code.
- Treat application-owned routes, content, presentation, styles, and guidance as project-maintained surfaces.
