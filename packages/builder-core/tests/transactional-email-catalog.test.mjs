import { readFile } from "node:fs/promises";
import { createInstalledManifest } from "../dist/manifest/create-installed-manifest.js";
import assert from "node:assert/strict";
import test from "node:test";

import { createCapabilityCatalogSnapshot } from "../dist/catalog/capability-catalog.js";
import { createGenerationRenderingContext, createVerifiedProjectSnapshot, verifiedCapabilityPackageVersions } from "../dist/catalog/verified-package-versions.js";
import { renderSkeleton } from "../dist/generation/render-skeleton.js";
import { resolveRecipeLockfileVersion } from "../dist/generation/recipe-lockfiles.js";

const ordinary = { standards: "0.5.1", siteRouting: "0.4.0", appFoundation: "0.1.0" };
const email = { ...ordinary, appFoundation: "0.2.0", transactionalEmailResend: "0.1.0" };
const request = (profile, extra = {}) => ({ profile, projectName: "email-example", displayName: "Email example", packageVersions: verifiedCapabilityPackageVersions, ...extra });

test("email selection adds the server foundation to each current profile without changing its identity", async () => {
  for (const profile of ["portfolio", "site", "app"]) {
    const rendered = await renderSkeleton(request(profile, { transactionalEmailResend: true }));
    assert.equal(rendered.ok, true, JSON.stringify(rendered));
    const { project, resolved, files } = rendered.value;
    assert.equal(project.originProfile, profile);
    const versions = Object.fromEntries(resolved.capabilities.map(({ identifier, version }) => [identifier, version]));
    assert.equal(versions["transactional-email-resend"], "0.1.0");
    assert.equal(versions["app-foundation"], "0.2.0");
    assert.equal(versions["application-persistence"], undefined);
    assert.equal(versions["site-routing"], profile === "portfolio" ? undefined : "0.4.0");
    assert.ok(files.some(({ path }) => path === "apps/web/src/application/transactional-email-sender.ts"));
    const manifest = JSON.parse(new TextDecoder().decode(files.find(({ path }) => path === "apps/web/package.json").content));
    assert.equal(manifest.dependencies.effect, "4.0.0-rc.112");
    assert.equal(manifest.dependencies.resend, undefined);
    assert.equal(manifest.dependencies.next, "16.4.1");
    assert.ok(manifest.scripts["test:integration:cloudflare"]);
    assert.ok(resolveRecipeLockfileVersion(project, manifest));
  }
});

test("email leaves default and unrelated descriptor contracts unchanged", async () => {
  const original = createCapabilityCatalogSnapshot(verifiedCapabilityPackageVersions, ordinary);
  const expanded = createCapabilityCatalogSnapshot(verifiedCapabilityPackageVersions, email);
  assert.equal(expanded.ok, true, JSON.stringify(expanded));
  for (const descriptor of original.value) {
    if (descriptor.identifier === "app-foundation") continue;
    assert.deepEqual(expanded.value.find(({ identifier }) => identifier === descriptor.identifier), descriptor);
  }
  for (const profile of ["portfolio", "site", "app"]) {
    const rendered = await renderSkeleton(request(profile));
    assert.equal(rendered.ok, true);
    assert.equal(rendered.value.project.selectedCapabilities.includes("transactional-email-resend"), false);
    const manifest = JSON.parse(new TextDecoder().decode(rendered.value.files.find(({ path }) => path === "apps/web/package.json").content));
    assert.equal(manifest.dependencies.next, "16.4.1");
    assert.equal(rendered.value.resolved.capabilities.find(({ identifier }) => identifier === "app-foundation")?.version, profile === "app" ? "0.1.0" : undefined);
  }
});

test("installed email and retained foundation require an exact current profile and shared tuple", async () => {
  const fixtureState = JSON.parse(await readFile(new URL("../../../fixtures/generated/app-0.2.7/.egeria/state.json", import.meta.url), "utf8"));
  for (const profile of ["portfolio", "site", "app"]) {
    for (const hasEmail of [false, true]) {
      const rendered = await renderSkeleton(request(profile, hasEmail ? { transactionalEmailResend: true } : {}), createGenerationRenderingContext(false, true));
      assert.equal(rendered.ok, true);
      const project = rendered.value.project;
      const state = { ...fixtureState, origin: { profile, recipeVersion: project.recipeVersion }, installedCapabilities: createInstalledManifest(rendered.value.resolved) };
      const selected = createVerifiedProjectSnapshot(project, state);
      assert.equal(selected.ok, true, JSON.stringify(selected));
      assert.deepEqual(selected.value.renderingContext.catalogSnapshot, email);
      assert.equal(createVerifiedProjectSnapshot({ ...project, recipeVersion: "0.1.0" }, state).ok, false);
      assert.equal(createVerifiedProjectSnapshot(project, { ...state, installedCapabilities: state.installedCapabilities.map((capability) => capability.identifier === "standards" ? { ...capability, version: "0.4.0" } : capability) }).ok, false);
    }
  }
});

test("retaining the foundation does not silently reinstall email", async () => {
  const rendered = await renderSkeleton(request("portfolio"), createGenerationRenderingContext(false, true));
  assert.equal(rendered.ok, true, JSON.stringify(rendered));
  assert.ok(rendered.value.project.selectedCapabilities.includes("app-foundation"));
  assert.equal(rendered.value.project.selectedCapabilities.includes("transactional-email-resend"), false);
});

test("email composes with explicit app persistence without altering persistence ownership", async () => {
  const rendered = await renderSkeleton(request("app", { transactionalEmailResend: true, applicationPersistence: true }));
  assert.equal(rendered.ok, true, JSON.stringify(rendered));
  assert.ok(rendered.value.project.selectedCapabilities.includes("transactional-email-resend"));
  assert.ok(rendered.value.project.selectedCapabilities.includes("application-persistence"));
});
