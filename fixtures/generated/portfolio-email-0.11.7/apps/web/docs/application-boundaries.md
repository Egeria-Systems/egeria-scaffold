# Application boundaries

The health route reads optional build metadata through an application-owned port. The public app also retains the full site experience; its presentation, content, localization, contact, booking, and analytics owners remain independent of the server foundation.

Domain transformations stay pure and platform-neutral. Import Effect directly only in server application, infrastructure, composition, and delivery modules. Keep it out of domain, presentation, client, and content code. Tests may exercise the public Effect APIs. Use the stable pinned modules; do not import unstable or transitive packages or add an Effect facade.

`BuildInformationReader` owns the narrow read contract. The Cloudflare adapter alone acquires provider metadata and converts expected unavailability to a stable tagged error. Missing metadata is valid. Malformed metadata returns no raw value; parser defects remain defects. The memory Layer is for tests and is never a production fallback. Composition supplies the selected Layer without a service registry, global runtime, or managed runtime.

Each request receives an immutable context from the injected UUID generator and clock. Do not trust incoming correlation headers or retain context globally. Delivery runs the provided program once with the request signal. Any defect takes priority over interruption; interruption takes priority over recognized typed failures. Unexpected failures are reported through the existing bounded reporter. Responses expose only stable status, request ID, bounded build information, and error codes, with JSON UTF-8 and `no-store` headers. Presentation maps stable error identifiers to validated localized copy.

Add a server action only for a real selected capability. Validate serializable inputs and return serializable DTOs at that delivery boundary; perform authentication and authorization there when required by that capability. Keep Cloudflare types, bindings, and resources in adapters, configuration, integration tests, and composition roots. Do not add fake mutations, generic database/platform ports, invented CRUD, provider resources, retries, or speculative dependencies.

Use the workspace test order. Unit tests cover the pure/application/delivery contracts; the dedicated Cloudflare integration command uses the whole built Worker after Next and OpenNext builds. The app workspace explicitly denies the optional `msgpackr-extract` native build script; this health path does not use native extraction. Do not grant lifecycle scripts permission merely to silence installation failures.

An already-aborted request starts no application work. During execution, a request signal can interrupt the local Effect wait; the metadata provider accepts no cancellation argument. Local tests do not establish cancellation of provider acquisition or deployed disconnect handling. They also do not establish production behavior, performance, security certification, provider state, human accessibility, or WCAG conformance.

Recovery follows ownership: revert application-owned source through a reviewed source change; update the exact dependency manifest and lock together; handle deployments separately. Provider and persistent-data recovery belong to the capabilities that introduce them. This stateless foundation has no provider or data rollback operation.
