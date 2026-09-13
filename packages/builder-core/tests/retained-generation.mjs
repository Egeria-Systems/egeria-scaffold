import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import * as core from "../dist/index.js";
import { createVitestFourProfileRecipes } from "../dist/profiles/profile-recipes.js";
import { createBuilderStateSurfaces } from "../dist/generation/builder-state-surfaces.js";
import { createRecipeLockfileUrl, resolveRecipeLockfileVersion } from "../dist/generation/recipe-lockfiles.js";

export const retainedRenderingContext = {
  catalogSnapshot: { standards: "0.4.0", siteRouting: "0.4.0", appFoundation: "0.1.0" },
  profiles: createVitestFourProfileRecipes(),
};

// Reconstruct the retained test cohort from explicit rendering inputs. The
// in-memory control receipt supplies test preconditions, not execution evidence.
export async function createRetainedGenerationEntries(directory) {
  const project = core.parseProjectYaml(await readFile(join(directory, ".egeria/project.yaml"), "utf8"));
  const state = core.parseStateJson(await readFile(join(directory, ".egeria/state.json"), "utf8"));
  assert.equal(project.ok, true);
  assert.equal(state.ok, true);
  const settings = project.value.capabilitySettings;
  const rendered = await core.renderSkeleton({
    profile: project.value.originProfile,
    projectName: project.value.project.name,
    displayName: project.value.project.displayName,
    packageVersions: core.verifiedCapabilityPackageVersions,
    ...(settings["booking-calendly"] === undefined ? {} : { bookingCalendly: settings["booking-calendly"] }),
    ...(settings.analytics === undefined ? {} : { analytics: settings.analytics }),
    ...(project.value.selectedCapabilities.includes("multilingual") ? { multilingual: true } : {}),
  }, retainedRenderingContext);
  assert.equal(rendered.ok, true, JSON.stringify(rendered));
  const files = new Map(rendered.value.files.map(({ path, content }) => [path, content]));
  const manifest = JSON.parse(Buffer.from(files.get("apps/web/package.json")).toString("utf8"));
  const lockfile = resolveRecipeLockfileVersion(rendered.value.project, manifest);
  assert.notEqual(lockfile, undefined);
  files.set("pnpm-lock.yaml", new Uint8Array(await readFile(createRecipeLockfileUrl(lockfile))));
  files.set(".egeria/project.yaml", new TextEncoder().encode(core.serializeProjectYaml(rendered.value.project)));
  files.set(".egeria/migrations.jsonl", new Uint8Array());
  const surfaces = core.materializeInstalledSurfaces({ files, surfaces: [...rendered.value.surfaces, ...createBuilderStateSurfaces()].sort((left, right) => left.identifier < right.identifier ? -1 : left.identifier > right.identifier ? 1 : 0) });
  assert.equal(surfaces.ok, true);
  files.set(".egeria/state.json", new TextEncoder().encode(core.serializeStateJson({
    ...state.value,
    origin: { profile: rendered.value.project.originProfile, recipeVersion: rendered.value.project.recipeVersion },
    installedCapabilities: core.createInstalledManifest(rendered.value.resolved),
    managedSurfaces: surfaces.value,
  })));
  return files;
}
