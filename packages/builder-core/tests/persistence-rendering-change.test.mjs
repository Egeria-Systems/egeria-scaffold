import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { preparePersistenceRenderingChange } from "../dist/lifecycle/prepare-persistence-rendering-change.js";
import { renderSkeleton } from "../dist/generation/render-skeleton.js";
import { verifiedCapabilityPackageVersions } from "../dist/catalog/verified-package-versions.js";
import { createInMemoryRepositoryReader } from "../dist/repository/repository-reader.js";
const decoder = new TextDecoder();
const request = { profile: "app", projectName: "test-app", displayName: "Test app", packageVersions: verifiedCapabilityPackageVersions };
const ordinary = (await renderSkeleton(request)).value;
const persistent = (await renderSkeleton({ ...request, applicationPersistence: true })).value;
const manifest = (rendered) => JSON.parse(decoder.decode(rendered.files.find(({ path }) => path === "apps/web/package.json").content));
const lock = async (persistent) => readFile(new URL(`../lockfiles/${persistent ? "web-application-persistence" : "web-recipe-app-0.2.0"}/pnpm-lock.yaml`, import.meta.url), "utf8");
async function reader(rendered, modify = (value) => value, lockSource) {
  return createInMemoryRepositoryReader({
    "package.json": decoder.decode(rendered.files.find(({ path }) => path === "package.json").content),
    "apps/web/package.json": JSON.stringify(modify(manifest(rendered))),
    "pnpm-lock.yaml": lockSource ?? await lock(rendered === persistent),
  });
}
test("persistence switches exact locks and package members while retaining custom scripts and metadata", async () => {
  for (const [current, desired] of [[ordinary, persistent], [persistent, ordinary]]) {
    const result = await preparePersistenceRenderingChange({ current, desired, reader: await reader(current, (value) => ({ ...value, description: "Custom app", scripts: { ...value.scripts, custom: "node custom.mjs" } })) });
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
    const result = await preparePersistenceRenderingChange({ current, desired, reader: await reader(current, modify, lockSource) });
    assert.equal(result.ok, false);
  }
});
test("persistence refuses duplicate package members without mutating either rendering", async () => {
  const source = JSON.stringify(manifest(ordinary)).replace('"private":true', '"private":true,"private":false');
  const result = await preparePersistenceRenderingChange({ current: ordinary, desired: persistent, reader: createInMemoryRepositoryReader({ "apps/web/package.json": source, "pnpm-lock.yaml": await lock(false) }) });
  assert.equal(result.ok, false);
});

test("persistence refuses a changed root dependency graph before replacing its lock", async () => {
  const base = await reader(ordinary);
  const root = JSON.parse((await base.readText("package.json")).content);
  const result = await preparePersistenceRenderingChange({ current: ordinary, desired: persistent, reader: {
    readText: async (path) => path === "package.json" ? { kind: "file", content: JSON.stringify({ ...root, devDependencies: { custom: "1.0.0" } }) } : base.readText(path),
  } });
  assert.equal(result.ok, false);
});
