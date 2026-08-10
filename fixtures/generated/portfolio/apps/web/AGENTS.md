# acme-portfolio web application guidance

- Load validated locale content in routes and pass typed values into pure presentation components.
- Add page sections through the typed source registry and preserve exact content validation, stable instance identifiers, and one enabled hero first among enabled sections per page.
- Keep long-form Markdown as validated data and use only an explicitly reviewed renderer.
- Keep visible copy out of TypeScript and TSX source.
- Preserve externalized skip-navigation copy, the `main-content` focus target, visible focus treatment, responsive wrapping, minimum primary-link target sizing, and reduced-motion protection.
- Keep Tailwind CSS and PostCSS configuration and global semantic design tokens in their generated application boundaries; do not scatter colour literals through presentation components.
- Keep Cloudflare bindings at configuration and composition boundaries; do not import them into domain or application code.
- Treat application-owned routes, content, presentation, styles, and guidance as project-maintained surfaces.
