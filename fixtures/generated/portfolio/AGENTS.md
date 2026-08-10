# acme-portfolio workspace guidance

- Keep user-visible and translatable application copy in validated locale content files.
- Keep long-form Markdown as validated data; do not convert client-editable content to executable MDX.
- Compose pages only from the source-owned registered section types; content must not name components, imports, scripts, styles, or arbitrary child trees.
- Keep presentation components pure and pass them typed data and callbacks.
- Keep Cloudflare types and bindings in platform adapters, generated configuration, integration tests, and composition roots.
- Preserve application-owned files unless a reviewed change explicitly replaces them.
