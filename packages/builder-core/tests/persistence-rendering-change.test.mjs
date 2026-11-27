import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { prepareCapabilityDependencyChange } from "../dist/lifecycle/prepare-capability-dependency-change.js";
import { renderSkeleton } from "../dist/generation/render-skeleton.js";
import { createApplicationEnvironmentRenderingContext, createGenerationRenderingContext, verifiedCapabilityPackageVersions } from "../dist/catalog/verified-package-versions.js";
import { createInMemoryRepositoryReader } from "../dist/repository/repository-reader.js";
const decoder = new TextDecoder();
const request = { profile: "app", projectName: "test-app", displayName: "Test app", packageVersions: verifiedCapabilityPackageVersions };
const { createApplicationEnvironmentProfileRecipes } = await import("../dist/profiles/profile-recipes.js");
const currentContext = (persistence = false) => ({ ...createGenerationRenderingContext(persistence), profiles: createApplicationEnvironmentProfileRecipes() });
const ordinary = (await renderSkeleton(request, currentContext())).value;
const persistent = (await renderSkeleton({ ...request, applicationPersistence: true }, currentContext(true))).value;
const manifest = (rendered) => JSON.parse(decoder.decode(rendered.files.find(({ path }) => path === "apps/web/package.json").content));
const lock = async (persistent) => readFile(new URL(`../lockfiles/${persistent ? "web-recipe-app-0.2.7-persistence-next-16.4.5" : "web-recipe-app-0.3.0-next-16.4.5"}/pnpm-lock.yaml`, import.meta.url), "utf8");
async function reader(rendered, modify = (value) => value, lockSource) {
  return createInMemoryRepositoryReader({
    "package.json": decoder.decode(rendered.files.find(({ path }) => path === "package.json").content),
    "apps/web/package.json": JSON.stringify(modify(manifest(rendered))),
    "pnpm-lock.yaml": lockSource ?? await lock(rendered === persistent),
  });
}
test("persistence switches exact locks and package members while retaining custom scripts and metadata", async () => {
  for (const [current, desired] of [[ordinary, persistent], [persistent, ordinary]]) {
    const result = await prepareCapabilityDependencyChange({ current, desired, reader: await reader(current, (value) => ({ ...value, description: "Custom app", scripts: { ...value.scripts, custom: "node custom.mjs" } })) });
    assert.equal(result.ok, true, JSON.stringify(result));
    const actual = manifest(result.value.desired);
    assert.equal(actual.scripts.custom, "node custom.mjs");
    assert.equal(actual.description, "Custom app");
    assert.deepEqual(actual.dependencies, manifest(desired).dependencies);
    assert.deepEqual(actual.devDependencies, manifest(desired).devDependencies);
    assert.equal(decoder.decode(result.value.desired.files.find(({ path }) => path === "pnpm-lock.yaml").content), await lock(desired === persistent));
    assert.deepEqual(result.value.desired.surfaces, desired.surfaces);
  }
});
test("persistence refuses custom dependency graphs, changed owned scripts, colliding additions and changed lock bytes", async () => {
  for (const [current, desired, modify, lockSource] of [
    [ordinary, persistent, (value) => ({ ...value, dependencies: { ...value.dependencies, custom: "1.0.0" } })],
    [ordinary, persistent, (value) => ({ ...value, optionalDependencies: { custom: "1.0.0" } })],
    [ordinary, persistent, (value) => ({ ...value, scripts: { ...value.scripts, "db:check": "custom" } })],
    [persistent, ordinary, (value) => ({ ...value, scripts: { ...value.scripts, "db:check": "custom" } })],
    [ordinary, persistent, undefined, "changed"],
  ]) {
    const result = await prepareCapabilityDependencyChange({ current, desired, reader: await reader(current, modify, lockSource) });
    assert.equal(result.ok, false);
  }
});
test("persistence refuses duplicate package members without mutating either rendering", async () => {
  const source = JSON.stringify(manifest(ordinary)).replace('"private":true', '"private":true,"private":false');
  const result = await prepareCapabilityDependencyChange({ current: ordinary, desired: persistent, reader: createInMemoryRepositoryReader({ "apps/web/package.json": source, "pnpm-lock.yaml": await lock(false) }) });
  assert.equal(result.ok, false);
});

test("persistence refuses a changed root dependency graph before replacing its lock", async () => {
  const base = await reader(ordinary);
  const root = JSON.parse((await base.readText("package.json")).content);
  const result = await prepareCapabilityDependencyChange({ current: ordinary, desired: persistent, reader: {
    readText: async (path) => path === "package.json" ? { kind: "file", content: JSON.stringify({ ...root, devDependencies: { custom: "1.0.0" } }) } : base.readText(path),
  } });
  assert.equal(result.ok, false);
});


test("current persistence dependency replacement refuses swapped source locks", async () => {
  const currentOrdinary = await renderSkeleton(request, createGenerationRenderingContext());
  const currentPersistent = await renderSkeleton({ ...request, applicationPersistence: true }, createGenerationRenderingContext(true));
  assert.equal(currentOrdinary.ok, true);
  assert.equal(currentPersistent.ok, true);
  assert.equal(currentOrdinary.value.project.recipeVersion, "0.3.0");
  assert.equal(currentPersistent.value.project.recipeVersion, currentOrdinary.value.project.recipeVersion);
  assert.equal(manifest(currentOrdinary.value).dependencies.next, "16.4.5");
  assert.equal(manifest(currentPersistent.value).dependencies.next, "16.4.5");
  for (const [current, desired, removing] of [
    [currentOrdinary.value, currentPersistent.value, false],
    [currentPersistent.value, currentOrdinary.value, true],
  ]) {
    const expectedSource = await lock(removing);
    const expectedTarget = await lock(!removing);
    const actual = await prepareCapabilityDependencyChange({ current, desired, reader: await reader(current, undefined, expectedSource) });
    assert.equal(actual.ok, true, JSON.stringify(actual));
    assert.equal(decoder.decode(actual.value.desired.files.find(file => file.path === "pnpm-lock.yaml").content), expectedTarget);
    assert.equal(actual.value.desired.project.recipeVersion, current.project.recipeVersion);
    assert.equal(manifest(actual.value.desired).dependencies.next, "16.4.5");
    const mismatched = await prepareCapabilityDependencyChange({ current, desired, reader: await reader(current, value => ({ ...value, dependencies: { ...value.dependencies, next: "16.4.1" } }), expectedSource) });
    assert.equal(mismatched.ok, false);
    for (const source of [expectedTarget, expectedSource + "\n"]) {
      const refused = await prepareCapabilityDependencyChange({ current, desired, reader: await reader(current, undefined, source) });
      assert.equal(refused.ok, false);
    }
  }
});

test("environment persistence dependency changes preserve custom members and reuse both exact locks", async () => {
  const environmentLock = async persistent => readFile(new URL(`../lockfiles/${persistent ? "web-recipe-app-0.2.7-persistence-next-16.4.5" : "web-recipe-app-0.3.0-next-16.4.5"}/pnpm-lock.yaml`, import.meta.url), "utf8");
  const ordinaryCandidate = (await renderSkeleton(request, createApplicationEnvironmentRenderingContext())).value;
  const persistentCandidate = (await renderSkeleton({ ...request, applicationPersistence: true }, createApplicationEnvironmentRenderingContext(true))).value;
  for (const [current, desired, removing] of [[ordinaryCandidate, persistentCandidate, false], [persistentCandidate, ordinaryCandidate, true]]) {
    const sourceLock = await environmentLock(removing);
    const result = await prepareCapabilityDependencyChange({ current, desired, reader: await reader(current, value => ({ ...value, description: "Owned application", scripts: { ...value.scripts, custom: "node custom.mjs" } }), sourceLock) });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(manifest(result.value.desired).scripts.custom, "node custom.mjs");
    assert.equal(manifest(result.value.desired).description, "Owned application");
    assert.deepEqual(manifest(result.value.desired).dependencies, manifest(desired).dependencies);
    assert.equal(decoder.decode(result.value.desired.files.find(({ path }) => path === "pnpm-lock.yaml").content), await environmentLock(!removing));
    const refused = await prepareCapabilityDependencyChange({ current, desired, reader: await reader(current, value => ({ ...value, dependencies: { ...value.dependencies, custom: "1.0.0" } }), sourceLock) });
    assert.equal(refused.ok, false);
  }
});
