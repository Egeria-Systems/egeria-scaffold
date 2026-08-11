# acme-portfolio-calendly workspace guidance

- Keep user-visible and translatable application copy in validated locale content files.
- Keep accessibility copy, including skip-navigation labels, in validated locale content files.
- Keep long-form Markdown as validated data; do not convert client-editable content to executable MDX.
- Compose pages only from the source-owned registered section types; content must not name components, imports, scripts, styles, or arbitrary child trees.
- Keep presentation components pure and pass them typed data and callbacks.
- Preserve the generated Tailwind CSS and PostCSS boundary, semantic design tokens, visible focus treatment, responsive wrapping, and reduced-motion protection.
- Keep Cloudflare types and bindings in platform adapters, generated configuration, integration tests, and composition roots.
- Keep operational telemetry bounded and infrastructure-owned. Do not add raw error/private fields, analytics, console interception, browser storage, or provider effects to presentation or application code.
- Preserve application-owned files unless a reviewed change explicitly replaces them.
