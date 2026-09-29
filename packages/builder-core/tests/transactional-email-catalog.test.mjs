import assert from "node:assert/strict";
import test from "node:test";

import { createCapabilityCatalogSnapshot } from "../dist/catalog/capability-catalog.js";
import { createApplicationEnvironmentRenderingContext, createGenerationRenderingContext, createVerifiedProjectSnapshot, verifiedCapabilityPackageVersions } from "../dist/catalog/verified-package-versions.js";
import { renderSkeleton } from "../dist/generation/render-skeleton.js";
import { resolveRecipeLockfileVersion } from "../dist/generation/recipe-lockfiles.js";

const ordinary = { standards: "0.5.0", siteRouting: "0.4.0", appFoundation: "0.1.0" };
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
    assert.equal(manifest.dependencies.next, "16.3.3");
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
    assert.equal(manifest.dependencies.next, profile === "portfolio" ? "16.3.0" : "16.3.3");
    assert.equal(rendered.value.resolved.capabilities.find(({ identifier }) => identifier === "app-foundation")?.version, profile === "app" ? "0.1.0" : undefined);
  }
});

test("installed email and retained foundation require an exact current profile and shared tuple", () => {
  for (const [profile, recipeVersion] of [["portfolio", "0.11.0"], ["site", "0.12.0"], ["app", "0.2.0"]]) {
    const project = { originProfile: profile, recipeVersion };
    const capabilities = [
      { identifier: "standards", version: "0.5.0" },
      { identifier: "deployment-cloudflare", version: "0.3.0" },
      { identifier: "app-foundation", version: "0.2.0" },
      ...(profile === "portfolio" ? [] : [{ identifier: "site-routing", version: "0.4.0" }]),
    ];
    for (const installedCapabilities of [capabilities, [...capabilities, { identifier: "transactional-email-resend", version: "0.1.0" }]]) {
      const state = { origin: { profile, recipeVersion }, installedCapabilities };
      assert.deepEqual(createVerifiedProjectSnapshot(project, state).value.renderingContext?.catalogSnapshot, email);
      const historical = { originProfile: profile, recipeVersion: "0.1.0" };
      assert.equal(createVerifiedProjectSnapshot(historical, { ...state, origin: { profile, recipeVersion: "0.1.0" } }).value.renderingContext, undefined);
      assert.equal(createVerifiedProjectSnapshot(project, { ...state, installedCapabilities: installedCapabilities.map((capability) => capability.identifier === "standards" ? { ...capability, version: "0.4.0" } : capability) }).value.renderingContext, undefined);
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


test("environment email selection preserves exact profile identity and independent persistence", async () => {
  for (const [profile, persistence] of [["portfolio", false], ["site", false], ["app", false], ["app", true]]) {
    const rendered = await renderSkeleton(request(profile, { transactionalEmailResend: true, ...(persistence ? { applicationPersistence: true } : {}) }), createApplicationEnvironmentRenderingContext(persistence));
    assert.equal(rendered.ok, true, JSON.stringify(rendered.issues));
    const { project, resolved, files } = rendered.value;
    const versions = Object.fromEntries(resolved.capabilities.map(({ identifier, version }) => [identifier, version]));
    assert.equal(project.originProfile, profile);
    assert.equal(project.recipeVersion, { portfolio: "0.12.0", site: "0.13.0", app: "0.3.0" }[profile]);
    assert.equal(versions["transactional-email-resend"], "0.2.0");
    assert.equal(versions["app-foundation"], "0.3.0");
    assert.equal(versions.standards, persistence ? "0.8.0" : "0.7.0");
    assert.equal(versions["deployment-cloudflare"], persistence ? "0.8.0" : "0.7.0");
    assert.equal(versions["application-persistence"], persistence ? "0.2.0" : undefined);
    assert.equal(versions["site-routing"], profile === "portfolio" ? undefined : "0.4.0");
    assert.equal(versions["background-job-delivery"], undefined);
    const file = path => new TextDecoder().decode(files.find(entry => entry.path === path).content);
    const manifest = JSON.parse(file("apps/web/package.json"));
    assert.equal(manifest.dependencies.effect, "4.0.0-rc.112");
    assert.equal(manifest.dependencies.resend, undefined);
    assert.equal(resolveRecipeLockfileVersion(project, manifest), persistence ? "application-persistence" : profile === "portfolio" ? "portfolio-foundation" : "app-0.2.0");
    for (const name of ["RESEND_API_KEY", "TRANSACTIONAL_EMAIL_FROM", "TRANSACTIONAL_EMAIL_DOMAIN", "TRANSACTIONAL_EMAIL_ALLOWED_RECIPIENTS"]) {
      assert.ok(file("apps/web/.dev.vars.example").includes(`${name}=\n`));
      assert.equal(file("apps/web/.env.example").includes(name), false);
    }
    const descriptor = resolved.capabilities.find(capability => capability.identifier === "transactional-email-resend");
    assert.deepEqual(descriptor.dependencies, ["app-foundation"]);
    assert.deepEqual(descriptor.migrationPlanners, ["add-transactional-email-resend-0-2-0", "remove-transactional-email-resend-0-2-0"]);
  }
});

test("environment retained foundation remains explicit and does not reinstall email", async () => {
  for (const profile of ["portfolio", "site", "app"]) {
    const rendered = await renderSkeleton(request(profile), createApplicationEnvironmentRenderingContext(false, true));
    assert.equal(rendered.ok, true, JSON.stringify(rendered.issues));
    assert.ok(rendered.value.project.selectedCapabilities.includes("app-foundation"));
    assert.equal(rendered.value.project.selectedCapabilities.includes("transactional-email-resend"), false);
    assert.equal(rendered.value.project.selectedCapabilities.includes("site-routing"), profile !== "portfolio");
    const ordinary = await renderSkeleton(request(profile), createApplicationEnvironmentRenderingContext());
    assert.equal(ordinary.ok, true);
    assert.equal(ordinary.value.project.selectedCapabilities.includes("app-foundation"), profile === "app");
  }
});
