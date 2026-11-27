import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import * as core from "../../packages/builder-core/dist/index.js";
import { generatedFixtureContracts } from "../../scripts/verify-generated-skeletons.mjs";

const repositoryRoot = new URL("../../", import.meta.url);
const fingerprint = bytes => createHash("sha256").update(bytes).digest("hex");
const codePointCompare = (left, right) => left < right ? -1 : left > right ? 1 : 0;

const retainedFixtureDigests = Object.freeze({
  "portfolio": "8eb404916e43d7d3cfb6d2fc2c42c9a62cc2874f4f6690a976775bdf96b75cf4",
  "portfolio-calendly": "38887cc49a9782ed75327f9e1c95d05cc6c6ff99f986069a58249513c3302770",
  "site": "85aca4d30591100a04e16aef620655d4089d359fe0da146ae23cde138758ccb3",
  "site-multilingual": "28ddc8ea570a20fbed0f9679eb702248cc26db40305825057d61f59d62bd4e8e",
  "site-public-integrations": "c4272d9ad68eb7e53773edb6ae56084db05c6992e652a2d4f5c5775a863affa6",
  "app": "d2e36928bb5142c31a241d10c1239ccc182965fba2377d6edfb2daed429d5d5c",
  "app-all-optional-integrations": "b83cf9976c7ce24586719f26522dfc7a1b0577c2c6417c441b2d8313d85b70e5",
  "app-persistence": "174302b580953fd41ececd9e440b318c5b33c106af8e58d6b0f618fc618a0b85",
  "portfolio-email": "80a1fa553ee53436e721f9fadcc30aac790a5c0fb61aac38dba1534a7232264d",
  "app-persistence-email": "f27bad80efca9c2b1847b1121468ea374f4a2d07985ebad0411b6d7d9e1a0524",
  "site-contact-form": "fd8c3ee291bcacf958619b380bfa3c926049462fa39505b7a3f3f19dd3dc8ffb",
  "app-jobs": "bae3ec20b6597e06a3d63429e3fbc20db46b0a3cfaee5f32ac4f9f2bfe5c892e",
  "app-persistence-jobs-email": "4fcc2a241639c20849fb697906b4371b820024d56770fcb0274095c61053f3e8",
});

export function requestForFixture(fixture) {
  return {
    profile: fixture.profile, projectName: fixture.projectName, displayName: fixture.displayName,
    packageVersions: core.verifiedCapabilityPackageVersions,
    ...(fixture.expectedBookingCalendlyVersion ? { bookingCalendly: fixture.expectedCapabilitySettings["booking-calendly"] } : {}),
    ...(fixture.expectedAnalyticsVersion ? { analytics: fixture.expectedCapabilitySettings.analytics } : {}),
    ...(fixture.expectedMultilingualVersion ? { multilingual: true } : {}),
    ...(fixture.expectedApplicationPersistenceVersion ? { applicationPersistence: true } : {}),
    ...(fixture.expectedTransactionalEmailVersion ? { transactionalEmailResend: true } : {}),
    ...(fixture.expectedBackgroundJobVersion ? { backgroundJobDelivery: true } : {}),
    ...(fixture.expectedContactFormVersion ? { contactFormWeb3Forms: true } : {}),
  };
}

export async function readArchivedGeneratedFixture(identifier) {
  const fixture = generatedFixtureContracts.find(candidate => candidate.identifier === identifier);
  assert.ok(fixture, identifier);
  const root = new URL(fixture.relativeRoot + "/", repositoryRoot);
  const [project, state, migrations, lock, webManifest] = await Promise.all([
    readFile(new URL(".egeria/project.yaml", root)),
    readFile(new URL("tests/generated-fixtures/fixtures/installed-ancestor-controls/" + identifier + "-state.json", repositoryRoot)),
    readFile(new URL(".egeria/migrations.jsonl", root)),
    readFile(new URL("pnpm-lock.yaml", root)),
    readFile(new URL("apps/web/package.json", root), "utf8"),
  ]);
  const installed = await core.readVerifiedProjectSnapshot(core.createInMemoryRepositoryReader({
    ".egeria/project.yaml": project.toString("utf8"),
    ".egeria/state.json": state.toString("utf8"),
    "apps/web/package.json": webManifest,
  }));
  assert.equal(installed.ok, true, JSON.stringify(installed.issues));
  const rendered = await core.renderSkeleton(requestForFixture(fixture), installed.value.renderingContext);
  assert.equal(rendered.ok, true, JSON.stringify(rendered.issues));

  const files = new Map();
  for (const { path, content } of [
    ...rendered.value.files,
    { path: ".egeria/project.yaml", content: project },
    { path: ".egeria/state.json", content: state },
    { path: ".egeria/migrations.jsonl", content: migrations },
    { path: "pnpm-lock.yaml", content: lock },
  ]) {
    assert.equal(files.has(path), false, path);
    files.set(path, new Uint8Array(content));
  }
  const ordered = [...files].sort(([left], [right]) => codePointCompare(left, right));
  const snapshot = ordered.map(([path, bytes]) => ({ path, fingerprint: fingerprint(bytes) }));
  assert.equal(fingerprint(JSON.stringify(snapshot)), retainedFixtureDigests[identifier], identifier);
  const installedState = core.installedStateSchema.parse(JSON.parse(state.toString("utf8")));
  assert.equal(installedState.managedSurfaces.find(({ path }) => path === "pnpm-lock.yaml").fingerprint,
    core.fingerprintFileContent(lock), identifier);
  return new Map(ordered);
}
