# Production observability package publication evidence

- Date: 2026-08-11
- Status: both exact public packages verified after publication
- Publication commit: `717c3bb0f048f4a4bc544100125ae42d818f09bc`
- Workflow: [Package release run 31458617354](https://github.com/Egeria-Systems/egeria-scaffold/actions/runs/31458617354), attempt 2
- Prior incident: [fresh-checkout remediation evidence](2026-08-11-package-release-fresh-checkout-remediation.md)

## Outcome

The npm registry contains exactly these two-version histories:

- `@egeria-systems/standards`: `0.1.0`, `0.2.0`
- `@egeria-systems/observability`: `0.1.0`, `0.2.0`

Both `0.2.0` artifacts downloaded successfully, matched the registry's SHA-1 and SHA-512 integrity metadata, exposed only their reviewed inventories, imported from a fresh consumer, and carried verified registry signatures and provenance attestations. Neither package has an unexpected version, and the publication was not partial.

## CI-incident reconciliation

The first approved publication candidate at `8b09d1b00004cafe0bd63405b956dd7122e2cbec` stopped before registry validation or publication because typed lint depended on ignored workspace declaration output in a warmed checkout. The separately reviewed remediation made the canonical package verification build workspace declarations before typed lint and proved the correction in a fresh clone. The final source commit merged that remediation with concurrent main-line documentation work at `717c3bb0f048f4a4bc544100125ae42d818f09bc`.

The successful manual `workflow_dispatch` attempt reports:

- branch `main` and head SHA `717c3bb0f048f4a4bc544100125ae42d818f09bc`;
- completed conclusion `success`;
- successful checkout, setup, frozen install, release-context verification, complete candidate verification, final registry-absence check, publication, and unconditional authentication cleanup; and
- GitHub-hosted runner execution from `.github/workflows/package-release.yml`.

No failed attempt published an immutable target. The remediation did not change package contents, versions, publication authentication, provenance configuration, or registry policy.

## Exact registry artifacts

### `@egeria-systems/standards@0.2.0`

- SHA-1: `6c4f6d7c1decc6dcb29e0f9106d3f42eb4ff3de2`
- SRI: `sha512-PbQhByMiGJrUX5JLR7cLBSlnD7NAcdpWLt2paO740451nLPEIHeFQ4wCRGpxw0UmzbfqjeNIsGlcyW0VNZeD5w==`
- Packed size: 8,888 bytes; unpacked size: 30,290 bytes
- Inventory: seven files — `LICENSE`, `README.md`, `package.json`, three explicit ESLint modules, and `typescript/strict.json`

### `@egeria-systems/observability@0.2.0`

- SHA-1: `8e500871deddd78dc9bf6883c9075c967aeec768`
- SRI: `sha512-t0ulhalC7yc53PLABF4lu+jknR2jwdNJOLXd48Vtt5dw3KubGUTzSUU4Bn8jqvRonVn47vb0TexHOsxFoe1wDA==`
- Packed size: 11,393 bytes; unpacked size: 41,620 bytes
- Inventory: nineteen files — `LICENSE`, `README.md`, `package.json`, and the reviewed JavaScript/declaration outputs for root, browser, server, testing, contracts, dispatch, events, and redaction

The package download command reported the same SHA-1 and SRI values as the independent registry metadata query.

## Provenance and signature evidence

Each registry record contains an npm registry signature and two attestations: an npm publish attestation and SLSA provenance v1. Both provenance statements resolve to:

- source repository `https://github.com/Egeria-Systems/egeria-scaffold`;
- source ref `refs/heads/main`;
- source commit `717c3bb0f048f4a4bc544100125ae42d818f09bc`;
- workflow `.github/workflows/package-release.yml`;
- event `workflow_dispatch`;
- GitHub-hosted Actions runner; and
- invocation `https://github.com/Egeria-Systems/egeria-scaffold/actions/runs/31458617354/attempts/2`.

The attested SHA-512 subject digests equal the decoded registry SRI digests for each package. A fresh npm `12.0.2` consumer then ran `npm audit signatures`: 89 installed packages had verified registry signatures and 27 had verified attestations, including both Egeria packages.

Current npm documentation confirms that `npm audit signatures` verifies both registry signatures and provenance attestations, while provenance links source and build instructions rather than proving source safety.

## Fresh-consumer evidence

An isolated temporary npm project installed exact `0.2.0` dependencies with scripts disabled and no npm user configuration. It then:

- loaded the exact package versions through their public `package.json` exports;
- imported the observability root, browser, server, and testing surfaces and asserted their exact export names;
- constructed one canonical operational event;
- imported all four standards surfaces and exercised their exported configuration values or factories;
- verified signatures and provenance; and
- completed a moderate production audit with zero reported vulnerabilities.

The temporary consumer and downloaded tarballs are disposable verification inputs outside the repository. They are not generated-project state or substitutes for the public registry.

## Claim limits and recovery

This evidence proves the named registry metadata, tarball bytes/inventory, import behavior, audit result, signature validation, and provenance linkage at verification time. It does not prove that the package source is defect-free, that every consumer environment works, or that generated Cloudflare, Next.js, browser, Better Stack, Workers Logs, deployment, production, visual, accessibility, or WCAG behavior exists.

npm versions are immutable. Source rollback cannot remove `0.2.0`; any package defect requires a separately approved forward version plus consumer recovery. No provider, credential, deployment, persistent data, or generated-project state was created by this verification.

The verified public release unlocks the separately planned generated observability integration. It does not authorize capability certification, protected-staging deployment, provider creation, secret mutation, or production action.
