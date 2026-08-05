# Changesets

Changesets record versioning intent for the public packages in this workspace. Add a Changeset with `pnpm changeset` when an approved change affects a public package API or packaged contents.

The repository default is restricted. The standards and observability manifests explicitly declare public npm access, while the root, proof, CLI, and builder-core packages remain private and excluded from versioning and publication.

Changeset files and release scripts do not authorize publication. Versioning, publishing, credentials, npm namespace control, and other external actions still require the repository's separate current evidence and explicit human approval gates.
