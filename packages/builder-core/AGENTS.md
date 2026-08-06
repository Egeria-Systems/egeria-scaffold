# Builder core boundary

Read the repository [`AGENTS.md`](../../AGENTS.md), the canonical [package ownership](../../docs/architecture/package-ownership.md), and the [review and contribution protocol](../../docs/governance/review-and-contribution.md) before editing this surface.

`packages/builder-core` is the private owner of builder internals and project/state schemas. P1 Tasks 1 and 2 added the executable contracts, checked JSON Schema artifacts, exact six-capability catalog, `portfolio` and `site` recipes, deterministic resolution, and installed-manifest projection. P1 Task 3 added strict `.egeria` codecs plus pure hybrid-ownership fingerprint materialization. P1 Task 4 adds fixed-root read-only repository access and deterministic capability and surface evidence.

- Keep runtime Zod schemas canonical and generated Draft 2020-12 artifacts byte-checked against them. Do not hand-edit artifacts.
- Keep the executable catalog limited to `standards`, `content-files`, `section-composition`, `deployment-cloudflare`, `observability`, and `site-routing`; keep executable profiles limited to `portfolio` and `site`.
- Keep Task 4 reads fixed to explicitly declared state, probe, and valid-state surface paths. The reader does not enumerate or write, follows no requested-path symlink, caps text reads at 1 MiB, and emits no source content through evidence.
- Keep inference evidence separate from policy. Diagnostics remain deferred to Task 5; Task 4 neither blocks nor authorizes a repository change.
- Do not add diagnostics, planning, migration execution, repository transformation, templates, generated projects, recovery automation, provider integration, CLI behavior, or later-stage capability runtime code.
- Do not create or move schema ownership into a separate `project-schema` package.
- Do not expose builder-core as a public package or add generic `PlatformService` or `ApplicationDatabase` ports.
- Follow the currently approved increment and stop at its review gate before expanding this boundary.
