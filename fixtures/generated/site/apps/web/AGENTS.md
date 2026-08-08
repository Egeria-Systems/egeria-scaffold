# acme-site web application guidance

- Load validated locale content in routes and pass typed values into pure presentation components.
- Keep visible copy out of TypeScript and TSX source.
- Keep Cloudflare bindings at configuration and composition boundaries; do not import them into domain or application code.
- Treat application-owned routes, content, presentation, styles, and guidance as project-maintained surfaces.
