import assert from "node:assert/strict";
import test from "node:test";

import { createCapabilityCatalogSnapshot } from "../dist/catalog/capability-catalog.js";
import { createApplicationEnvironmentRenderingContext, isApplicationEnvironmentRenderingContext, verifiedCapabilityPackageVersions } from "../dist/catalog/verified-package-versions.js";
import { resolveCapabilities } from "../dist/resolution/resolve-capabilities.js";
import { profileRecipes } from "../dist/profiles/profile-recipes.js";
import { renderSkeleton } from "../dist/generation/render-skeleton.js";
import { createVerifiedProjectSnapshot } from "../dist/catalog/verified-package-versions.js";

const defaultSnapshot = { standards: "0.5.0", siteRouting: "0.4.0", appFoundation: "0.1.0" };
const persistenceSnapshot = { ...defaultSnapshot, standards: "0.6.0", deploymentCloudflare: "0.4.0", applicationPersistence: "0.1.0" };
const catalog = (snapshot) => createCapabilityCatalogSnapshot(verifiedCapabilityPackageVersions, snapshot);

test("explicit application persistence resolves the complete optional tuple with exact existing foundation", () => {
  const result = catalog(persistenceSnapshot);
  assert.equal(result.ok, true, JSON.stringify(result));
  const resolved = resolveCapabilities({ profile: "app", requestedCapabilities: ["application-persistence"] }, result.value, profileRecipes);
  assert.equal(resolved.ok, true, JSON.stringify(resolved));
  const versions = Object.fromEntries(resolved.value.capabilities.map(({ identifier, version }) => [identifier, version]));
  assert.equal(versions["application-persistence"], "0.1.0");
  assert.equal(versions.standards, "0.6.0");
  assert.equal(versions["deployment-cloudflare"], "0.4.0");
  assert.equal(versions["app-foundation"], "0.1.0");
  assert.equal(versions["site-routing"], "0.4.0");
  const persistence = result.value.find(({ identifier }) => identifier === "application-persistence");
  assert.deepEqual(persistence.dependencies, ["app-foundation"]);
  assert.equal(persistence.removalPolicy, "export-and-remove");
  assert.deepEqual(persistence.stateClassifications, ["repository-stateful", "external-stateful", "persistent-data"]);
  assert.deepEqual(persistence.requiredPackages, ["drizzle-orm", "drizzle-kit", "@cloudflare/workers-types"]);
  assert.equal(result.value.find(({ identifier }) => identifier === "standards").inferenceProbes.find(({ packageName }) => packageName === "vitest").version, "5.0.0");
});

test("default generation retains exact default shared subjects while persistence is explicitly selected", async () => {
  const result = await renderSkeleton({ profile: "app", projectName: "test-app", displayName: "Test app", packageVersions: verifiedCapabilityPackageVersions });
  assert.equal(result.ok, true, JSON.stringify(result));
  const versions = Object.fromEntries(result.value.resolved.capabilities.map(({ identifier, version }) => [identifier, version]));
  assert.equal(versions.standards, "0.5.0");
  assert.equal(versions["deployment-cloudflare"], "0.3.0");
  assert.equal(versions["application-persistence"], undefined);
  assert.equal(result.value.files.some(({ path }) => path.includes("persistence") || path.endsWith("vitest.bindings.config.ts")), false);
});

test("installed persistence selection requires the exact shared versions and original app recipe", () => {
  const project = { originProfile: "app", recipeVersion: "0.2.0" };
  const state = { origin: { profile: "app", recipeVersion: "0.2.0" }, installedCapabilities: [
    { identifier: "standards", version: "0.6.0" },
    { identifier: "deployment-cloudflare", version: "0.4.0" },
    { identifier: "application-persistence", version: "0.1.0" },
    { identifier: "app-foundation", version: "0.1.0" },
    { identifier: "site-routing", version: "0.4.0" },
  ] };
  const selected = createVerifiedProjectSnapshot(project, state);
  assert.equal(selected.ok, true);
  assert.deepEqual(selected.value.renderingContext?.catalogSnapshot, persistenceSnapshot);
  for (const changed of [
    { ...state, installedCapabilities: state.installedCapabilities.slice(0, 2) },
    { ...state, installedCapabilities: state.installedCapabilities.map((capability) => capability.identifier === "deployment-cloudflare" ? { ...capability, version: "0.3.0" } : capability) },
    { ...state, origin: { profile: "app", recipeVersion: "0.1.0" } },
  ]) assert.equal(createVerifiedProjectSnapshot(project, changed).value.renderingContext, undefined);
});

test("persistence leaves every unaffected descriptor byte contract unchanged", () => {
  const ordinary = catalog(defaultSnapshot);
  const optional = catalog(persistenceSnapshot);
  assert.equal(optional.ok, true, JSON.stringify(optional));
  assert.equal(ordinary.ok, true);
  assert.equal(ordinary.value.some(({ identifier }) => identifier === "application-persistence"), false);
  for (const descriptor of ordinary.value) {
    if (["standards", "deployment-cloudflare"].includes(descriptor.identifier)) continue;
    assert.deepEqual(optional.value.find(({ identifier }) => identifier === descriptor.identifier), descriptor);
  }
});

test("mixed shared contract tuples refuse before resolution", () => {
  for (const snapshot of [
    { ...persistenceSnapshot, standards: "0.5.0" },
    { ...persistenceSnapshot, deploymentCloudflare: "0.3.0" },
    { ...persistenceSnapshot, appFoundation: undefined },
    { ...persistenceSnapshot, applicationPersistence: undefined },
    { ...defaultSnapshot, applicationPersistence: "0.1.0" },
    { ...defaultSnapshot, deploymentCloudflare: "0.4.0" },
    { ...persistenceSnapshot, applicationPersistence: "0.2.0" },
  ]) assert.equal(catalog(snapshot).ok, false, JSON.stringify(snapshot));
});

test("persistence is unavailable to portfolio and site and historical app views", () => {
  const optional = catalog(persistenceSnapshot);
  assert.equal(optional.ok, true, JSON.stringify(optional));
  for (const profile of ["portfolio", "site"]) {
    assert.equal(resolveCapabilities({ profile, requestedCapabilities: ["application-persistence"] }, optional.value, profileRecipes).ok, false);
  }
  const historical = catalog({ ...defaultSnapshot, standards: "0.4.0" });
  assert.equal(historical.ok, true);
  assert.equal(resolveCapabilities({ profile: "app", requestedCapabilities: ["application-persistence"] }, historical.value, profileRecipes).ok, false);
});

test("environment persistence resolves the complete app tuple without changing ordinary candidate subjects", () => {
  const context = createApplicationEnvironmentRenderingContext(true);
  const result = catalog(context.catalogSnapshot);
  assert.equal(result.ok, true, JSON.stringify(result));
  const resolved = resolveCapabilities({ profile: "app", requestedCapabilities: ["application-persistence"] }, result.value, context.profiles);
  assert.equal(resolved.ok, true, JSON.stringify(resolved));
  const versions = Object.fromEntries(resolved.value.capabilities.map(({ identifier, version }) => [identifier, version]));
  assert.equal(versions["application-persistence"], "0.2.0");
  assert.equal(versions.standards, "0.8.0");
  assert.equal(versions["deployment-cloudflare"], "0.8.0");
  assert.equal(versions["app-foundation"], "0.3.0");
  const persistence = result.value.find(({ identifier }) => identifier === "application-persistence");
  assert.equal(persistence.removalPolicy, "export-and-remove");
  assert.deepEqual(persistence.dependencies, ["app-foundation"]);
  assert.equal(persistence.managedSurfaces.some(({ path, ownership }) => path === "apps/web/src/configuration/application-database.ts" && ownership === "managed"), true);
  assert.deepEqual(persistence.migrationPlanners, ["add-application-persistence-0-2-0", "remove-application-persistence-0-2-0"]);
  const ordinary = catalog(createApplicationEnvironmentRenderingContext().catalogSnapshot);
  assert.equal(ordinary.ok, true);
  for (const descriptor of ordinary.value) {
    if (["standards", "deployment-cloudflare"].includes(descriptor.identifier)) continue;
    assert.deepEqual(result.value.find(({ identifier }) => identifier === descriptor.identifier), descriptor);
  }
  for (const profile of ["portfolio", "site"]) {
    assert.equal(resolveCapabilities({ profile, requestedCapabilities: ["application-persistence"] }, result.value, context.profiles).ok, false);
  }
  for (const identifier of ["background-job-delivery"]) {
    assert.equal(resolveCapabilities({ profile: "app", requestedCapabilities: [identifier] }, result.value, context.profiles).ok, false);
  }
});

test("environment persistence rejects partial and mixed snapshots at the catalog and rendering-context boundaries", () => {
  const context = createApplicationEnvironmentRenderingContext(true);
  const exact = { standards: "0.8.0", siteRouting: "0.4.0", appFoundation: "0.3.0", deploymentCloudflare: "0.8.0", applicationPersistence: "0.2.0", transactionalEmailResend: "0.2.0" };
  assert.deepEqual(context.catalogSnapshot, exact);
  assert.equal(isApplicationEnvironmentRenderingContext(context), true);
  for (const snapshot of [
    { ...exact, standards: "0.7.0" },
    { ...exact, deploymentCloudflare: "0.7.0" },
    { ...exact, applicationPersistence: "0.1.0" },
    { ...exact, applicationPersistence: undefined },
    { ...exact, appFoundation: undefined },
    { ...exact, unsupported: true },
  ]) {
    assert.equal(catalog(snapshot).ok, false, JSON.stringify(snapshot));
    assert.equal(isApplicationEnvironmentRenderingContext({ ...context, catalogSnapshot: snapshot }), false);
  }
});
