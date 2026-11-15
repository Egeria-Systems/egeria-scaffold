import { readFile } from "node:fs/promises";
import { createInstalledManifest } from "../dist/manifest/create-installed-manifest.js";
import assert from "node:assert/strict";
import test from "node:test";

import { createCapabilityCatalogSnapshot } from "../dist/catalog/capability-catalog.js";
import { createApplicationEnvironmentRenderingContext, createGenerationRenderingContext, createVerifiedProjectSnapshot, verifiedCapabilityPackageVersions } from "../dist/catalog/verified-package-versions.js";
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

for (const [profile, lockfile] of [
  ["portfolio", "portfolio-0.11.7-foundation"],
  ["site", "app-0.2.7"],
  ["app", "app-0.3.0"],
]) {
  test(`environment email selection preserves ${profile} identity without persistence`, async () => {
    const rendered = await renderSkeleton(
      request(profile, { transactionalEmailResend: true }),
      createApplicationEnvironmentRenderingContext(),
    );
    assert.equal(rendered.ok, true, JSON.stringify(rendered));
    const { project, resolved, files } = rendered.value;
    const versions = Object.fromEntries(resolved.capabilities.map(({ identifier, version }) => [identifier, version]));
    assert.equal(project.schemaVersion, "2.0.0");
    assert.equal(project.originProfile, profile);
    assert.equal(project.recipeVersion, { portfolio: "0.12.0", site: "0.13.0", app: "0.3.0" }[profile]);
    assert.equal(versions["transactional-email-resend"], "0.2.0");
    assert.equal(versions["app-foundation"], "0.3.0");
    assert.equal(versions.standards, "0.7.1");
    assert.equal(versions["deployment-cloudflare"], "0.7.1");
    assert.equal(versions["application-persistence"], undefined);
    assert.equal(versions["site-routing"], profile === "portfolio" ? undefined : "0.4.0");
    const manifest = JSON.parse(new TextDecoder().decode(files.find(({ path }) => path === "apps/web/package.json").content));
    assert.equal(manifest.dependencies.effect, "4.0.0-rc.112");
    assert.equal(manifest.dependencies.resend, undefined);
    assert.equal(resolveRecipeLockfileVersion(project, manifest), lockfile);
    assert.ok(files.some(({ path }) => path === "apps/web/src/composition/server-transactional-email.ts"));
    const file = path => new TextDecoder().decode(files.find(entry => entry.path === path).content);
    for (const name of ["RESEND_API_KEY", "TRANSACTIONAL_EMAIL_FROM", "TRANSACTIONAL_EMAIL_DOMAIN", "TRANSACTIONAL_EMAIL_ALLOWED_RECIPIENTS"]) {
      assert.ok(file("apps/web/.dev.vars.example").includes(`${name}=\n`));
      assert.equal(file("apps/web/.env.example").includes(name), false);
    }
    const descriptor = resolved.capabilities.find(capability => capability.identifier === "transactional-email-resend");
    assert.deepEqual(descriptor.dependencies, ["app-foundation"]);
    assert.deepEqual(descriptor.migrationPlanners, ["add-transactional-email-resend-0-2-0", "remove-transactional-email-resend-0-2-0"]);
  });
}

test("environment email composes with independently selected current persistence", async () => {
  const rendered = await renderSkeleton(
    request("app", { transactionalEmailResend: true, applicationPersistence: true }),
    createApplicationEnvironmentRenderingContext(true),
  );
  assert.equal(rendered.ok, true, JSON.stringify(rendered));
  const { project, resolved, files } = rendered.value;
  const versions = Object.fromEntries(resolved.capabilities.map(({ identifier, version }) => [identifier, version]));
  assert.equal(versions["transactional-email-resend"], "0.2.0");
  assert.equal(versions["app-foundation"], "0.3.0");
  assert.equal(versions["application-persistence"], "0.2.0");
  assert.equal(versions.standards, "0.8.0");
  assert.equal(versions["deployment-cloudflare"], "0.8.0");
  const manifest = JSON.parse(new TextDecoder().decode(files.find(({ path }) => path === "apps/web/package.json").content));
  assert.equal(resolveRecipeLockfileVersion(project, manifest), "app-0.2.7-persistence");
});

for (const profile of ["portfolio", "site"]) {
  test(`environment email context retains ${profile} foundation without selecting email`, async () => {
    const rendered = await renderSkeleton(request(profile), createApplicationEnvironmentRenderingContext(false, true));
    assert.equal(rendered.ok, true, JSON.stringify(rendered));
    const versions = Object.fromEntries(rendered.value.resolved.capabilities.map(({ identifier, version }) => [identifier, version]));
    assert.equal(versions["app-foundation"], "0.3.0");
    assert.equal(versions["transactional-email-resend"], undefined);
    assert.equal(versions["application-persistence"], undefined);
    assert.equal(rendered.value.project.originProfile, profile);
  });
}
