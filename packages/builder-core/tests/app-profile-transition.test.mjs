import assert from "node:assert/strict";
import { copyFile, readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import test from "node:test";
import { createSyntheticAppTransitionAdmission } from "../../../tests/helpers/synthetic-app-transition-admission.mjs";
import { createGenerationRenderingContext } from "../dist/catalog/verified-package-versions.js";
import { createApplicationEnvironmentProfileRecipes } from "../dist/profiles/profile-recipes.js";
const currentTransitionCohorts = [
  { label: "Current", generation: "current", portfolio: "0.12.0", site: "0.13.0", app: "0.3.0" },
];
const currentTransitionContexts = {
  "current": createGenerationRenderingContext(),
};

import { deflateSync } from "node:zlib";
import { parseDocument, stringify } from "yaml";
import * as core from "../dist/index.js";
import { createBuilderStateSurfaces } from "../dist/generation/builder-state-surfaces.js";
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const bookingCalendly = { mode: "popup" };
const analytics = {
  consent: { policy: "explicit-opt-in" }, providers: { cloudflareWebAnalytics: true }, operationalIntegrations: {}
};
const git = { ok: true, identity: {
    root: "/private/app-plan", revision: "a".repeat(40), attachedRef: "refs/heads/app-plan", gitDirectory: "/private/common/.git/worktrees/app-plan", commonDirectory: "/private/common/.git"
  } };
const checks = ["contracts", "pre-state-inference", "lockfile", "frozen-install", "lint", "typecheck", "unit-tests", "component-tests", "next-build", "opennext-build", "post-state-inference"];
async function fixture(profile, subset = 0, project = { projectName: "transition-test", displayName: "Private display sentinel" }, generation = "current") {
  const request = {
    profile, ...project, packageVersions: core.verifiedCapabilityPackageVersions, ...(subset & 1 ? { bookingCalendly } : {}), ...(subset & 2 ? { multilingual: true } : {}), ...(subset & 4 ? { analytics } : {})
  };
  const context = currentTransitionContexts[generation];
  const rendered = await core.renderSkeleton(request, context);
  assert.equal(rendered.ok, true, JSON.stringify(rendered.issues));
  const target = await core.renderSkeleton({ ...request, profile: "app" }, context);
  assert.equal(target.ok, true);
  const files = new Map(rendered.value.files.map(({ path, content }) => [path, new Uint8Array(content)]));
  files.set("pnpm-lock.yaml", new Uint8Array(await readFile(new URL(`../lockfiles/web-recipe-${`${profile}-${currentTransitionCohorts.find(cohort => cohort.generation === generation)[profile]}`}-next-16.4.5/pnpm-lock.yaml`, import.meta.url))));
  files.set(".egeria/project.yaml", encoder.encode(core.serializeProjectYaml(rendered.value.project)));
  files.set(".egeria/migrations.jsonl", encoder.encode(""));
  const surfaces = core.materializeInstalledSurfaces({ files, surfaces: [...rendered.value.surfaces, ...createBuilderStateSurfaces()] });
  assert.equal(surfaces.ok, true, JSON.stringify(surfaces.issues));
  const state = {
    schemaVersion: "2.0.0", builderVersion: "0.0.0", projectSchemaVersion: "2.0.0", origin: { profile, recipeVersion: rendered.value.project.recipeVersion }, installedCapabilities: core.createInstalledManifest(rendered.value.resolved), appliedMigrations: [], managedSurfaces: surfaces.value, ejections: [], compatibility: {
      node: "22.23.2", pnpm: "11.28.1", platformAdapter: "cloudflare-workers"
    }, lastSuccessfulVerification: { kind: "generation", checks }
  };
  files.set(".egeria/state.json", encoder.encode(core.serializeStateJson(state)));
  const reader = { async readBytes(path) { const content = files.get(path); return content === undefined ? { kind: "missing" } : { kind: "file", content: new Uint8Array(content) }; }, async readText(path) { const content = files.get(path); if (content === undefined) {
      return { kind: "missing" };
    } try {
      return { kind: "file", content: decoder.decode(content) };
    }
    catch {
      return { kind: "error", code: "FILE_ENCODING_INVALID" };
    } } };
  return {
    source: rendered.value, target: target.value, files, reader, state
  };
}
async function prepare(f) {
  const { loadAppTransitionContentValidators } = await import("../dist/lifecycle/app-transition-content-validation.js");
  const { prepareAppProfileTransition } = await import("../dist/lifecycle/app-profile-transition.js");
  return prepareAppProfileTransition({
    source: f.source, target: f.target, currentFiles: f.files, validators: await loadAppTransitionContentValidators()
  });
}
// Explicit injected unit evidence; this never establishes default source admission.
async function reviewed(f) {
  const prepared = await prepare(f);
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  return {
    manifestFingerprint: `sha256:${"b".repeat(64)}`, sourceProfile: f.source.project.originProfile, optionalCapabilities: f.source.project.selectedCapabilities.filter(x => ["analytics", "booking-calendly", "multilingual"].includes(x)), influencingFingerprints: prepared.value.influencingFingerprints, baselines: f.target.files.filter(({ path }) => path.endsWith(".png"))
  };
}
async function plan(f, evidence, planner = core.planProfileTransition) {
  const before = JSON.stringify([...f.files].map(([p, b]) => [p, Buffer.from(b).toString("base64")]));
  const result = await planner({
    reader: f.reader, git, toProfile: "app", inspectCreateTargets: async () => ({ ok: true }), inspectWorktree: async () => git, ...(evidence ? { readReviewedVisualEvidence: async () => evidence } : {})
  });
  assert.equal(JSON.stringify([...f.files].map(([p, b]) => [p, Buffer.from(b).toString("base64")])), before);
  return result;
}
for (const profile of ["portfolio", "site"])
  for (let subset = 0; subset < 8; subset++)
    test(`app planner preserves ${profile} optional subset ${subset}`, async () => {
      const f = await fixture(profile, subset);
      // This assertion supplies causal RED against the existing unsupported planner.
      const result = await plan(f, { manifestFingerprint: `sha256:${"b".repeat(64)}` });
      assert.notEqual(result.issues?.[0]?.code, "PROFILE_TRANSITION_UNSUPPORTED");
      const evidence = await reviewed(f);
      const prepared = await prepare(f);
      assert.equal(prepared.ok, true);
      const manifest = JSON.parse(decoder.decode(prepared.value.files.find(({ path }) => path === "apps/web/package.json").content));
      assert.equal(manifest.devDependencies.vitest, "5.0.3", "incoming transitions preserve the source declaration");
      const successful = await plan(f, evidence);
      assert.equal(successful.ok, true, JSON.stringify(successful));
      assert.deepEqual(await plan(f, evidence), successful);
      const value = successful.value;
      assert.equal(value.target.profile, "app");
      assert.equal(value.target.recipeVersion, "0.3.0");
      assert.ok(value.target.capabilities.some(({ identifier, version }) => identifier === "app-foundation" && version === "0.3.0"));
      assert.ok(value.target.capabilities.some(({ identifier, version }) => identifier === "site-routing" && version === "0.5.0"));
      assert.equal(value.actions.some(({ path }) => path.startsWith(".egeria/")), false);
      assert.equal(value.actions.some(({ kind }) => kind.includes("delete")), false);
      assert.equal(value.actions.filter(({ path }) => path === "apps/web/package.json").length, 1);
      assert.equal(value.actions.find(({ path }) => path === "apps/web/package.json").kind, "merge-json");
      assert.ok(value.actions.some(({ path }) => path === "pnpm-lock.yaml"));
      assert.ok(value.actions.some(({ path }) => path === "pnpm-workspace.yaml"));
      assert.equal(value.dispositions.length, new Set([...f.source.files, ...f.target.files].map(({ path }) => path)).size + 1);
      assert.equal(JSON.stringify(value).includes("Private display sentinel"), false);
      assert.equal(JSON.stringify(value).includes("calendly.com"), false);
      assert.equal(JSON.stringify(value).includes("/private/"), false);
    });
test("portfolio preparation preserves scalar content, navigation, Markdown and unrelated package members", async () => {
  const f = await fixture("portfolio");
  const path = "apps/web/content/en-CA/site.yaml";
  const content = parseDocument(decoder.decode(f.files.get(path))).toJS();
  content.metadata.title = "null";
  content.home.sections[0].content.heading = "false";
  content.navigation = [{ href: "/about", label: "My about" }];
  f.files.set(path, encoder.encode(stringify(content)));
  const manifestPath = "apps/web/package.json";
  const manifest = JSON.parse(decoder.decode(f.files.get(manifestPath)));
  manifest.scripts.custom = "echo safe";
  manifest.description = "custom";
  f.files.set(manifestPath, encoder.encode(JSON.stringify(manifest)));
  const markdown = "apps/web/content/en-CA/long-form/introduction.md";
  f.files.set(markdown, encoder.encode('---\ntitle: Custom\nsummary: Kept\n---\nCustom prose.\n'));
  const prepared = await prepare(f);
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  const target = new Map(prepared.value.files.map(({ path, content }) => [path, content]));
  const migrated = parseDocument(decoder.decode(target.get(path))).toJS();
  assert.deepEqual(migrated.metadata, content.metadata);
  assert.deepEqual(migrated.home, content.home);
  assert.deepEqual(migrated.accessibility, content.accessibility);
  assert.equal(migrated.navigation[0].label, "My about");
  assert.equal(migrated.navigation.filter(({ href }) => href === "/about").length, 1);
  assert.deepEqual(target.get(markdown), f.files.get(markdown));
  const merged = JSON.parse(decoder.decode(target.get(manifestPath)));
  assert.equal(merged.scripts.custom, "echo safe");
  assert.equal(merged.description, "custom");
  assert.equal(merged.dependencies.effect, "4.0.0-rc.112");
  assert.equal(merged.dependencies.next, "16.4.5");
});
test("app planning preserves both supported Git revision formats and rejects invalid identities", async () => {
  for (const profile of ["portfolio", "site"]) {
    const f = await fixture(profile);
    const evidence = await reviewed(f);
    const before = JSON.stringify([...f.files]);
    const fingerprints = [];
    for (const revision of ["a".repeat(40), "a".repeat(64)]) {
      const inspected = { ...git, identity: { ...git.identity, revision } };
      const result = await core.planProfileTransition({
        reader: f.reader, git: inspected, toProfile: "app",
        readReviewedVisualEvidence: async () => evidence,
        inspectCreateTargets: async () => ({ ok: true }), inspectWorktree: async () => inspected,
      });
      assert.equal(result.ok, true, `${profile}/${revision.length}: ${JSON.stringify(result)}`);
      fingerprints.push(result.value.planFingerprint);
    }
    assert.notEqual(fingerprints[0], fingerprints[1]);
    for (const revision of ["a".repeat(39), "a".repeat(41), "a".repeat(63), "a".repeat(65), "g".repeat(64)]) {
      const inspected = { ...git, identity: { ...git.identity, revision } };
      const result = await core.planProfileTransition({
        reader: f.reader, git: inspected, toProfile: "app",
        readReviewedVisualEvidence: async () => evidence,
        inspectCreateTargets: async () => ({ ok: true }), inspectWorktree: async () => inspected,
      });
      assert.equal(result.ok, false);
      assert.equal(result.issues[0].code, "PROJECT_INSPECTION_INVALID");
    }
    assert.equal(JSON.stringify([...f.files]), before);
  }
});
test("current visual admission requires renewed evidence for all subsets and changed first-viewport content", async () => {
  const policy = await import("../dist/lifecycle/app-profile-transition.js");
  for (let subset = 0; subset < 8; subset++) {
    const f = await fixture("portfolio", subset, policy.appTransitionVisualProject);
    const before = [...f.files].map(([path, content]) => [path, Buffer.from(content)]);
    const result = await plan(f);
    assert.equal(result.ok, false);
    assert.equal(result.issues[0].code, "PROFILE_TRANSITION_VISUAL_EVIDENCE_REQUIRED");
    assert.deepEqual([...f.files].map(([path, content]) => [path, Buffer.from(content)]), before);
    const path = subset & 2 ? "apps/web/content/en-CA/localized-content.yaml" : "apps/web/content/en-CA/site.yaml";
    const content = parseDocument(decoder.decode(f.files.get(path))).toJS();
    const home = subset & 2 ? content.pages.home : content.home;
    home.sections[0].content.heading = "Changed first viewport";
    f.files.set(path, encoder.encode(stringify(content)));
    const changed = [...f.files].map(([path, content]) => [path, Buffer.from(content)]);
    const refused = await plan(f);
    assert.equal(refused.ok, false);
    assert.equal(refused.issues[0].code, "PROFILE_TRANSITION_VISUAL_EVIDENCE_REQUIRED");
    assert.deepEqual([...f.files].map(([path, content]) => [path, Buffer.from(content)]), changed);
  }
});
test("strict data preparation refuses malformed YAML, aliases, duplicate keys, scalar mismatch and locale parity", async () => {
  for (const bad of ['metadata: [', 'metadata: &meta {title: x, description: y}\naccessibility: *meta', 'metadata: {}\nmetadata: {}', 'metadata: null']) {
    const f = await fixture("portfolio");
    f.files.set("apps/web/content/en-CA/site.yaml", encoder.encode(bad));
    assert.equal((await prepare(f)).ok, false);
  }
  for (const scalar of ['null', 'false', '0', '0x10', '.nan']) {
    const f = await fixture("portfolio");
    const source = decoder.decode(f.files.get("apps/web/content/en-CA/site.yaml"));
    f.files.set("apps/web/content/en-CA/site.yaml", encoder.encode(source.replace('title: "Private display sentinel"', `title: ${scalar}`)));
    assert.equal((await prepare(f)).ok, false);
  }
  const f = await fixture("portfolio", 2);
  const path = "apps/web/content/fr-CA/localized-content.yaml";
  const content = parseDocument(decoder.decode(f.files.get(path))).toJS();
  content.pages.home.sections[0].id = "different";
  f.files.set(path, encoder.encode(stringify(content)));
  assert.equal((await prepare(f)).ok, false);
});
test("app planner refuses unreviewed visual changes, missing files, managed drift, ejection and collisions", async () => {
  for (const [path, change] of [
    ["apps/web/app/globals.css", b => encoder.encode(decoder.decode(b) + "\nbody {color:red}\n")],
    ["pnpm-workspace.yaml", b => encoder.encode(decoder.decode(b) + "\n# changed\n")],
    ["apps/web/src/presentation/content-page.tsx", () => undefined],
    ["apps/web/app/api/health/route.ts", () => encoder.encode("collision")],
  ]) {
    const f = await fixture("portfolio");
    const evidence = await reviewed(f);
    const b = change(f.files.get(path));
    if (b === undefined) {
      f.files.delete(path);
    }
    else
      f.files.set(path, b);
    assert.equal((await plan(f, evidence)).ok, false, path);
  }
  const f = await fixture("site");
  f.state.ejections = [{ path: "apps/web/app/page.tsx", reason: "custom" }];
  f.files.set(".egeria/state.json", encoder.encode(JSON.stringify(f.state)));
  assert.equal((await plan(f)).ok, false);
});
test("site preparation preserves customized compatible UI and content without migration", async () => {
  const f = await fixture("site", 7);
  const path = "apps/web/src/presentation/content-page.tsx";
  f.files.set(path, encoder.encode(decoder.decode(f.files.get(path)) + "\n// custom\n"));
  const result = await plan(f);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.value.dispositions.find(x => x.path === path).kind, "preserve-file");
  assert.equal(result.value.actions.some(x => x.kind === "migrate-file"), false);
  const before = result.value.planFingerprint;
  f.files.set(path, encoder.encode(decoder.decode(f.files.get(path)) + "\n// more custom\n"));
  assert.notEqual((await plan(f)).value.planFingerprint, before);
});
test("portfolio planning refuses an unrecognized visual baseline before approval", async () => {
  const f = await fixture("portfolio");
  const evidence = await reviewed(f);
  const path = "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png";
  const bytes = new Uint8Array(f.files.get(path));
  bytes[bytes.length - 1] ^= 1;
  f.files.set(path, bytes);
  assert.equal((await plan(f, evidence)).ok, false);
});
test("app planning refuses ignored create paths and stale Git identity through the existing Git boundary", async () => {
  const f = await fixture("site");
  for (const adapters of [
    { inspectCreateTargets: async () => ({ ok: false, code: "CAPABILITY_ACTION_CONFLICT" }) },
    { inspectWorktree: async () => ({ ok: true, identity: { ...git.identity, revision: "b".repeat(40) } }) },
  ]) {
    const result = await core.planProfileTransition({
      reader: f.reader, git, toProfile: "app", inspectCreateTargets: async () => ({ ok: true }), inspectWorktree: async () => git, ...adapters
    });
    assert.equal(result.ok, false);
  }
});
test("app content migration preserves every localized source value and appends only required pages", async () => {
  const f = await fixture("portfolio", 3);
  const before = [];
  for (const locale of ["en-CA", "fr-CA"]) {
    const path = `apps/web/content/${locale}/localized-content.yaml`;
    const value = parseDocument(decoder.decode(f.files.get(path))).toJS();
    value.booking.heading = `Booking ${locale}`;
    value.error.summary = `false ${locale}`;
    value.navigation[0].label = `Home ${locale}`;
    value.pages.home.sections[0].content.heading = `Title ${locale}`;
    f.files.set(path, encoder.encode(stringify(value)));
    before.push(value);
  }
  const prepared = await prepare(f);
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  for (const [index, locale] of ["en-CA", "fr-CA"].entries()) {
    const content = prepared.value.files.find(({ path }) => path === `apps/web/content/${locale}/localized-content.yaml`).content;
    const after = parseDocument(decoder.decode(content)).toJS();
    for (const key of ["metadata", "accessibility", "localeSwitch", "booking", "error", "notFound"])
      assert.deepEqual(after[key], before[index][key]);
    assert.deepEqual(after.pages.home, before[index].pages.home);
    assert.deepEqual(after.navigation.slice(0, before[index].navigation.length), before[index].navigation);
    assert.deepEqual(Object.keys(after.pages).sort(), ["about", "home", "workFeatured"]);
  }
});

test("compiled app transition validation accepts corresponding section links and preserves authored hrefs", async () => {
  for (const profile of ["portfolio", "site"]) {
    const f = await fixture(profile, 2);
    const authored = new Map();
    for (const locale of ["en-CA", "fr-CA"]) {
      const path = `apps/web/content/${locale}/localized-content.yaml`;
      const catalog = parseDocument(decoder.decode(f.files.get(path))).toJS();
      const cta = catalog.pages.home.sections.find(({ type }) => type === "call-to-action");
      cta.content.href = `/${locale}?source=cta#home`;
      if (profile === "site") {
        const list = catalog.pages.workFeatured.sections.find(({ type }) => type === "project-list");
        list.content.projects[0].href = `/${locale}/about?source=project#team`;
      }
      const bytes = encoder.encode(stringify(catalog));
      authored.set(path, bytes);
      f.files.set(path, bytes);
    }
    const prepared = await prepare(f);
    assert.equal(prepared.ok, true, `${profile}: ${JSON.stringify(prepared)}`);
    for (const [path, bytes] of authored) {
      const output = prepared.value.files.find((file) => file.path === path).content;
      const catalog = parseDocument(decoder.decode(output)).toJS();
      assert.deepEqual(catalog.pages.home, parseDocument(decoder.decode(bytes)).toJS().pages.home);
      if (profile === "site") assert.deepEqual(output, bytes);
    }

    const frenchPath = "apps/web/content/fr-CA/localized-content.yaml";
    const french = parseDocument(decoder.decode(f.files.get(frenchPath))).toJS();
    french.pages.home.sections.find(({ type }) => type === "call-to-action").content.href = "/fr-CA?source=other#home";
    f.files.set(frenchPath, encoder.encode(stringify(french)));
    assert.equal((await prepare(f)).ok, false, profile);
  }
});

test("app planning fingerprints preserved bytes, raw controls and optional settings without exposing them", async () => {
  const f = await fixture("portfolio", 5);
  const evidence = await reviewed(f);
  const first = await plan(f, evidence);
  assert.equal(first.ok, true);
  const markdown = "apps/web/content/en-CA/long-form/introduction.md";
  f.files.set(markdown, encoder.encode("---\ntitle: Kept\nsummary: Private prose sentinel\n---\nPrivate content sentinel.\n"));
  const second = await plan(f, evidence);
  assert.equal(second.ok, true, JSON.stringify(second));
  assert.notEqual(second.value.planFingerprint, first.value.planFingerprint);
  const project = ".egeria/project.yaml";
  f.files.set(project, encoder.encode(`# private control sentinel\n${decoder.decode(f.files.get(project))}`));
  f.state.managedSurfaces.find(({path}) => path === project).fingerprint = core.fingerprintFileContent(f.files.get(project));
  f.files.set(".egeria/state.json", encoder.encode(core.serializeStateJson(f.state)));
  const third = await plan(f, evidence);
  assert.equal(third.ok, true);
  assert.notEqual(third.value.planFingerprint, second.value.planFingerprint);
  assert.doesNotMatch(JSON.stringify(third), /Private prose sentinel|Private content sentinel|private control sentinel|siteToken|calendly.com/);
});

test("app planning rejects unknown installed fingerprints and fixed-lockfile-incompatible dependencies", async () => {
  const f = await fixture("portfolio");
  const evidence = await reviewed(f);
  const surface = f.state.managedSurfaces.find(({path}) => path === "apps/web/app/page.tsx");
  surface.fingerprint = `sha256:${"c".repeat(64)}`;
  f.files.set(".egeria/state.json", encoder.encode(core.serializeStateJson(f.state)));
  assert.equal((await plan(f, evidence)).ok, false);
  const site = await fixture("site");
  const path = "apps/web/package.json";
  const manifest = JSON.parse(decoder.decode(site.files.get(path)));
  manifest.dependencies.unknown = "1.0.0";
  site.files.set(path, encoder.encode(JSON.stringify(manifest)));
  assert.equal((await plan(site)).ok, false);
});

test("app preparation refuses unproved source-only files and never mutates source bytes", async () => {
  const f = await fixture("site");
  const path = "apps/web/content/en-CA/unknown.yaml";
  const content = encoder.encode("unknown: content\n");
  f.files.set(path, content);
  f.source = {...f.source, files:[...f.source.files,{path,content}],surfaces:[...f.source.surfaces,{identifier:"unknown-content",owner:{kind:"capability",identifier:"content-files"},path,ownership:"application-owned",fingerprintTarget:{kind:"file"},mergeStrategy:"replace-file"}]};
  assert.equal((await prepare(f)).ok, false);
  assert.equal(decoder.decode(f.files.get(path)), "unknown: content\n");
});

test("app preparation refuses duplicate JSON members and preexisting unknown localized pages", async () => {
  const f = await fixture("site");
  const path = "apps/web/package.json";
  const source = decoder.decode(f.files.get(path));
  f.files.set(path, encoder.encode(source.replace('{', '{"description":"first","description":"second",')));
  assert.equal((await prepare(f)).ok, false);
  const localized = await fixture("portfolio", 2);
  const catalogPath = "apps/web/content/en-CA/localized-content.yaml";
  const catalog = parseDocument(decoder.decode(localized.files.get(catalogPath))).toJS();
  catalog.pages.about = catalog.pages.home;
  localized.files.set(catalogPath, encoder.encode(stringify(catalog, {aliasDuplicateObjects:false})));
  assert.equal((await prepare(localized)).ok, false);
});

test("site to app refuses malformed routed application content before planning", async () => {
  for (const path of [
    "apps/web/content/en-CA/about.yaml",
    "apps/web/content/en-CA/not-found.yaml",
    "apps/web/content/en-CA/work-featured.yaml",
  ]) {
    const f = await fixture("site");
    f.files.set(path, encoder.encode("unknown: invalid\n"));
    const result = await plan(f);
    assert.equal(result.ok, false, path);
    assert.equal(result.issues[0].code, "PROFILE_TRANSITION_CONTENT_INVALID");
  }
});

test("app preparation validates routed target data and preserves valid customized source bytes", async () => {
  for (const path of [
    "apps/web/content/en-CA/about.yaml",
    "apps/web/content/en-CA/not-found.yaml",
    "apps/web/content/en-CA/work-featured.yaml",
  ]) {
    const f = await fixture("site", 7);
    const value = parseDocument(decoder.decode(f.files.get(path))).toJS();
    value.metadata.title = "Custom routed page";
    const custom = encoder.encode(`# preserve formatting and comments\n${stringify(value)}`);
    f.files.set(path, custom);
    const prepared = await prepare(f);
    assert.equal(prepared.ok, true, path);
    assert.deepEqual(prepared.value.files.find(file => file.path === path).content, custom);
    const invalid = await fixture("portfolio");
    invalid.target = {...invalid.target, files: invalid.target.files.map(file => file.path === path ? {...file, content: encoder.encode("unknown: invalid\n")} : file)};
    assert.equal((await prepare(invalid)).ok, false, path);
  }
});

test("app preparation refuses malformed configuration and optional content while preserving valid customized bytes", async () => {
  for (const path of [
    "apps/web/content/content.config.yaml",
    "apps/web/content/en-CA/observability.yaml",
    "apps/web/content/en-CA/booking-calendly.yaml",
    "apps/web/content/en-CA/analytics.yaml",
    "apps/web/content/fr-CA/analytics.yaml",
  ]) {
    const f = await fixture("site", 7);
    const original = f.files.get(path);
    f.files.set(path, encoder.encode("unknown: invalid\n"));
    const result = await plan(f);
    assert.equal(result.ok, false, path);
    assert.equal(result.issues[0].code, "PROFILE_TRANSITION_CONTENT_INVALID");
    const value = parseDocument(decoder.decode(original)).toJS();
    if (!path.endsWith("content.config.yaml")) value.heading = "Customized safe heading";
    const customized = encoder.encode(`# preserve custom bytes\n${stringify(value)}`);
    f.files.set(path, customized);
    const prepared = await prepare(f);
    assert.equal(prepared.ok, true, path);
    assert.deepEqual(prepared.value.files.find(file => file.path === path).content, customized);
    f.target = {...f.target, files:f.target.files.map(file => file.path === path ? {...file,content:encoder.encode("unknown: invalid\n")} : file)};
    assert.equal((await prepare(f)).ok, false, path);
  }
});

test("visual input fingerprints include rendered build configuration and manifests", async () => {
  const f = await fixture("portfolio");
  const prepared = await prepare(f);
  assert.equal(prepared.ok, true);
  for (const path of ["package.json", "pnpm-workspace.yaml", "apps/web/package.json", "apps/web/next.config.ts", "apps/web/postcss.config.mjs", "apps/web/playwright.visual.config.ts", "apps/web/tests/visual/home-visual.spec.ts"]) {
    assert.ok(prepared.value.influencingFingerprints.some(input => input.path === path), path);
  }
});

test("synthetic wrapper admission refuses changed runtime and lock identities while preserving excluded-content fingerprints", async context => {
  const fixture = await createSyntheticAppTransitionAdmission(context);
  const syntheticPolicy = await import(fixture.verifierUrl);
  const policy = await import("../dist/lifecycle/app-profile-transition.js");
  const { loadAppTransitionContentValidators } = await import("../dist/lifecycle/app-transition-content-validation.js");
  const validators = await loadAppTransitionContentValidators();
  const cohorts = [
    { context: currentTransitionContexts.current, lock: "app-0.3.0-next-16.4.5" },
  ];
  const lockFingerprints = await Promise.all(cohorts.map(async ({ lock }) => core.fingerprintFileContent(new Uint8Array(await readFile(new URL(`../lockfiles/web-recipe-${lock}/pnpm-lock.yaml`, import.meta.url))))));
  for (const [cohortIndex, cohort] of cohorts.entries()) {
  const targetLockfileFingerprint = lockFingerprints[cohortIndex];
  for (let subset = 0; subset < 8; subset++) {
    const request = {...policy.appTransitionVisualProject, packageVersions:core.verifiedCapabilityPackageVersions,
      ...(subset & 1 ? {bookingCalendly:policy.appTransitionVisualBookingSettings}:{}),
      ...(subset & 2 ? {multilingual:true}:{}),
      ...(subset & 4 ? {analytics:policy.appTransitionVisualAnalyticsSettings}:{}),
    };
    const source = await core.renderSkeleton({...request,profile:"portfolio"}, cohort.context);
    const target = await core.renderSkeleton({...request,profile:"app"}, cohort.context);
    assert.equal(source.ok,true);assert.equal(target.ok,true);
    const currentFiles = new Map(source.value.files.map(({path,content})=>[path,content]));
    const prepared = policy.prepareAppProfileTransition({source:source.value,target:target.value,currentFiles,validators});
    assert.equal(prepared.ok,true);
    const optionalCapabilities = source.value.project.selectedCapabilities.filter(identifier=>["analytics","booking-calendly","multilingual"].includes(identifier));
    const identity = {optionalCapabilities,influencingFingerprints:prepared.value.influencingFingerprints,targetLockfileFingerprint};
    assert.equal(policy.verifyAppTransitionVisualInputRecord(identity).ok, false, "new generation requires renewed canonical admission");
    assert.equal(syntheticPolicy.verifyAppTransitionVisualInputRecord(identity).ok,true);
    assert.equal(syntheticPolicy.verifyAppTransitionVisualInputRecord({ ...identity, optionalCapabilities: [...optionalCapabilities].reverse() }).ok, true);
    for (const invalidSubset of [
      [...optionalCapabilities, "unknown-capability"],
      ...(optionalCapabilities.length ? [[...optionalCapabilities, optionalCapabilities[0]]] : [["none"]]),
      ...(optionalCapabilities.length > 1 ? [[[...optionalCapabilities].sort().join("+")]] : []),
    ]) {
      assert.equal(syntheticPolicy.verifyAppTransitionVisualInputRecord({ ...identity, optionalCapabilities: invalidSubset }).ok, false, JSON.stringify(invalidSubset));
    }
    for (const otherLock of [policy.appTransitionVisualInputRecord, policy.vitestFiveAppTransitionVisualInputRecord,
      policy.literalLintAppTransitionVisualInputCandidate, policy.viteSecurityAppTransitionVisualInputCandidate]
      .map(record => record.targetLockfileFingerprint)) {
      assert.equal(syntheticPolicy.verifyAppTransitionVisualInputRecord({ ...identity, targetLockfileFingerprint: otherLock }).ok, false, "other cohorts cannot approve these inputs");
    }
    for (const pixel of [[255,0,0,255], [0,0,255,255]]) {
      const baselines = policy.appTransitionBaselinePaths.map(path => ({path,content:onePixelPng(pixel)}));
      assert.equal(syntheticPolicy.verifyAppTransitionVisualInputRecord({...identity,baselines}).ok,false,"unreviewed valid PNG bytes cannot self-approve");
    }
    for (const path of ["apps/web/app/globals.css","apps/web/postcss.config.mjs","apps/web/package.json","apps/web/tests/visual/home-visual.spec.ts"]) {
      const altered = {...identity,influencingFingerprints:identity.influencingFingerprints.map(input=>input.path===path?{...input,fingerprint:`sha256:${"d".repeat(64)}`}:input)};
      assert.equal(syntheticPolicy.verifyAppTransitionVisualInputRecord(altered).ok,false,path);
    }
    assert.equal(syntheticPolicy.verifyAppTransitionVisualInputRecord({...identity,targetLockfileFingerprint:`sha256:${"e".repeat(64)}`}).ok,false);
    currentFiles.set("apps/web/content/en-CA/long-form/introduction.md",encoder.encode("---\ntitle: Preserved\nsummary: Off home\n---\nCustomized preserved prose.\n"));
    const customized = policy.prepareAppProfileTransition({source:source.value,target:target.value,currentFiles,validators});
    assert.equal(customized.ok,true);
    assert.deepEqual(customized.value.influencingFingerprints, prepared.value.influencingFingerprints);
    assert.equal(syntheticPolicy.verifyAppTransitionVisualInputRecord({...identity,influencingFingerprints:customized.value.influencingFingerprints}).ok,true);
  }
  }
});

test("historical visual candidates remain inert alongside exact current admission", async () => {
  const policy = await import("../dist/lifecycle/app-profile-transition.js");
  const { loadAppTransitionContentValidators } = await import("../dist/lifecycle/app-transition-content-validation.js");
  const validators = await loadAppTransitionContentValidators();
  const candidate = policy.literalLintAppTransitionVisualInputCandidate;
  assert.ok(candidate, "current visual input candidate must be frozen before review");
  assert.equal(Object.isFrozen(candidate), true);
  assert.equal(Object.isFrozen(candidate.subsets), true);
  assert.equal(Object.isFrozen(candidate.baselines), true);
  for (const [group, prefix] of [["monolingual", ""], ["multilingual", "multilingual-"]]) {
    const baselines = await Promise.all(["desktop", "mobile"].map(async viewport =>
      core.fingerprintFileContent(new Uint8Array(await readFile(new URL(`../templates/portfolio/apps/web/tests/visual/home-visual.spec.ts-snapshots/app-transition-${prefix}home-${viewport}-chromium-linux.png`, import.meta.url))))));
    assert.deepEqual(candidate.baselines[group], baselines);
    assert.equal(Object.isFrozen(candidate.baselines[group]), true);
  }
  const historical = JSON.parse(await readFile(new URL("../../../docs/implementation-evidence/retired-recipe-visuals/portfolio-0.11.3/transition-inputs.json", import.meta.url), "utf8"));
  assert.deepEqual(candidate, historical.value);
  for (const generation of [
    { context: createGenerationRenderingContext(), portfolio: "0.12.0", app: "0.3.0", next: "16.4.5", lock: "app-0.3.0-next-16.4.5" },
  ]) for (let subset = 0; subset < 8; subset++) {
    const request = {
      ...policy.appTransitionVisualProject, packageVersions: core.verifiedCapabilityPackageVersions,
      ...(subset & 1 ? { bookingCalendly: policy.appTransitionVisualBookingSettings } : {}),
      ...(subset & 2 ? { multilingual: true } : {}),
      ...(subset & 4 ? { analytics: policy.appTransitionVisualAnalyticsSettings } : {}),
    };
    const source = await core.renderSkeleton({ ...request, profile: "portfolio" }, generation.context);
    const target = await core.renderSkeleton({ ...request, profile: "app" }, generation.context);
    assert.equal(source.ok, true); assert.equal(target.ok, true);
    assert.equal(source.value.project.recipeVersion, generation.portfolio);
    assert.equal(target.value.project.recipeVersion, generation.app);
    const prepared = policy.prepareAppProfileTransition({ source: source.value, target: target.value,
      currentFiles: new Map(source.value.files.map(({ path, content }) => [path, content])), validators });
    assert.equal(prepared.ok, true);
    const manifest = JSON.parse(decoder.decode(prepared.value.files.find(({ path }) => path === "apps/web/package.json").content));
    assert.equal(manifest.dependencies.next, generation.next);
    const optionalCapabilities = source.value.project.selectedCapabilities.filter(identifier => ["analytics", "booking-calendly", "multilingual"].includes(identifier));
    const targetLockfileFingerprint = core.fingerprintFileContent(new Uint8Array(await readFile(new URL(`../lockfiles/web-recipe-${generation.lock}/pnpm-lock.yaml`, import.meta.url))));
    const identity = { optionalCapabilities, influencingFingerprints: prepared.value.influencingFingerprints, targetLockfileFingerprint };
    assert.equal(policy.verifyAppTransitionVisualInputRecord(identity).ok, false, "new inputs do not inherit historical admission");
    assert.equal(policy.verifyAppTransitionVisualInputRecord({ ...identity, targetLockfileFingerprint: candidate.targetLockfileFingerprint }).ok, false);
    assert.notEqual(core.fingerprintJsonValue(prepared.value.influencingFingerprints), candidate.subsets[[...optionalCapabilities].sort().join("+") || "none"]);
  }
  assert.deepEqual(Object.keys(candidate.subsets).sort(), ["none", "analytics", "booking-calendly", "multilingual", "analytics+booking-calendly", "analytics+multilingual", "booking-calendly+multilingual", "analytics+booking-calendly+multilingual"].sort());
  assert.equal(core.resolveSupportedProfileTransition({ fromProfile: "portfolio", fromRecipeVersion: "0.11.3", toProfile: "app", toRecipeVersion: "0.2.3" }).ok, false);
});

// Construct complete PNGs with valid chunk CRCs, changing only pixel data.
function onePixelPng(pixel) {
  function chunk(type, data) {
    const payload = Buffer.concat([Buffer.from(type), data]);
    let crc = 0xffffffff;
    for (const byte of payload) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
    const checksum = Buffer.alloc(4); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([length,payload,checksum]);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1,0); header.writeUInt32BE(1,4); header[8]=8; header[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk("IHDR",header),chunk("IDAT",deflateSync(Buffer.from([0,...pixel]))),chunk("IEND",Buffer.alloc(0))]);
}


for (const cohort of currentTransitionCohorts) test(`${cohort.label} incoming app plans preserve all optional subsets and refuse mixed generations`, async () => {
  const { resolveSupportedProfileTransition } = await import("../dist/lifecycle/supported-profile-transitions.js");
  for (const [profile, version, retainedVersion] of [["portfolio", cohort.portfolio, "0.10.0"], ["site", cohort.site, "0.11.0"]]) {
    assert.deepEqual(resolveSupportedProfileTransition({ fromProfile: profile, fromRecipeVersion: version, toProfile: "app", toRecipeVersion: cohort.app }), { ok: true, value: { source: { profile, recipeVersion: version }, target: { profile: "app", recipeVersion: cohort.app } } });
    for (const [source, target] of [[version, "0.1.0"], [retainedVersion, cohort.app]]) assert.deepEqual(resolveSupportedProfileTransition({ fromProfile: profile, fromRecipeVersion: source, toProfile: "app", toRecipeVersion: target }), { ok: false, code: "PROFILE_TRANSITION_EDGE_MISSING" });
    for (let subset = 0; subset < 8; subset++) {
      const f = await fixture(profile, subset, undefined, cohort.generation);
      const prepared = await prepare(f);
      assert.equal(prepared.ok, true, JSON.stringify(prepared));
      const manifest = JSON.parse(decoder.decode(prepared.value.files.find(({ path }) => path === "apps/web/package.json").content));
      assert.equal(manifest.devDependencies.vitest, "5.0.3");
      const result = await plan(f, await reviewed(f));
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.equal(result.value.target.recipeVersion, cohort.app);
      assert.equal(result.value.target.capabilities.find(({ identifier }) => identifier === "standards").version, "0.9.0");
      assert.equal(result.value.actions.some(({ kind }) => kind.includes("delete")), false);
      assert.equal(result.value.actions.filter(({ path }) => path === "pnpm-lock.yaml").length, 1);
      assert.deepEqual(result.value.requiredApprovals, ["transform", "verified-final-diff"]);
      assert.deepEqual(f.source.project.capabilitySettings, f.target.project.capabilitySettings);
    }
  }
});

test("retired transition endpoints refuse the historical and current targets", async () => {
  for (const [profile, recipeVersion] of [["portfolio", "0.11.2"], ["site", "0.12.3"]]) {
    for (const toRecipeVersion of ["0.2.2", "0.2.3", "0.3.0"]) {
      assert.equal(core.resolveSupportedProfileTransition({ fromProfile: profile, fromRecipeVersion: recipeVersion, toProfile: "app", toRecipeVersion }).ok, false);
    }
  }
});

test("Vite security incoming transitions admit only exact same-cohort endpoints", async () => {
  const { resolveSupportedProfileTransition } = await import("../dist/lifecycle/supported-profile-transitions.js");
  for (const [profile, recipeVersion, retainedRecipe] of [["portfolio", "0.12.0", "0.11.3"], ["site", "0.13.0", "0.12.3"]]) {
    const edge = resolveSupportedProfileTransition({ fromProfile: profile, fromRecipeVersion: recipeVersion, toProfile: "app", toRecipeVersion: "0.3.0" });
    assert.deepEqual(edge, { ok: true, value: { source: { profile, recipeVersion }, target: { profile: "app", recipeVersion: "0.3.0" } } });
    for (const [source, target] of [[recipeVersion, "0.2.3"], [retainedRecipe, "0.3.0"]]) {
      assert.deepEqual(resolveSupportedProfileTransition({ fromProfile: profile, fromRecipeVersion: source, toProfile: "app", toRecipeVersion: target }), { ok: false, code: "PROFILE_TRANSITION_EDGE_MISSING" });
    }
  }
});


test("the default planner reads only the current destinations of reviewed promotion", async t => {
  const isolated = await createSyntheticAppTransitionAdmission(t);
  const policy = await import(isolated.verifierUrl);
  const sourcePlanner = new URL("../dist/lifecycle/plan-profile-transition.js", import.meta.url);
  const isolatedPlanner = new URL("plan-profile-transition.js", isolated.verifierUrl);
  await copyFile(sourcePlanner, isolatedPlanner);
  const plannerUrl = import.meta.resolve(isolatedPlanner.href);

  // Keep the real planner, renderer and filesystem reader. Only this temporary
  // package supplies the test admission record and four promotion destinations.
  const hooks = registerHooks({ resolve(specifier, context, next) {
    if (context.parentURL === plannerUrl && specifier.startsWith(".") && specifier !== "./app-profile-transition.js") {
      return next(new URL(specifier, sourcePlanner).href, context);
    }
    return next(specifier, context);
  } });
  let planner;
  try { ({ planProfileTransition: planner } = await import(plannerUrl)); }
  finally { hooks.deregister(); }

  const source = await fixture("portfolio", 0, policy.appTransitionVisualProject);
  const before = await plan(source, undefined, planner);
  assert.equal(before.issues?.[0]?.code, "PROFILE_TRANSITION_VISUAL_EVIDENCE_REQUIRED");
  const adapters = {
    repositoryRoot: isolated.root,
    inspectEnvironment: async () => isolated.module.appTransitionVisualToolchain,
    prepareBuilder: async () => {},
    snapshotSource: async () => ({ revision: "a".repeat(40), files: [] }),
    executeCase: async ({ subset }) => {
      const prepared = isolated.preparedProjects.get(subset.join("+") || "none");
      return {
        images: isolated.images[subset.includes("multilingual") ? "multilingual" : "monolingual"],
        project: { files: prepared.files.map(({ path }) => ({ path })) },
        influencingFingerprints: prepared.influencingFingerprints,
        checks: ["synthetic-fixture"],
      };
    },
  };
  const candidate = await isolated.module.verifyAppTransitionVisuals({ mode: "candidates" }, adapters);
  await isolated.module.verifyAppTransitionVisuals({ mode: "promote", digest: candidate.manifestSha256 }, adapters);
  const result = await plan(source, undefined, planner);
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  const production = await plan(source);
  assert.equal(production.issues?.[0]?.code, "PROFILE_TRANSITION_VISUAL_EVIDENCE_REQUIRED");
});

test("current preparation fingerprints and canonical admission protect exact baselines", async testContext => {
  const fixture = await createSyntheticAppTransitionAdmission(testContext);
  const syntheticPolicy = await import(fixture.verifierUrl);
  const policy = await import("../dist/lifecycle/app-profile-transition.js");
  const { loadAppTransitionContentValidators } = await import("../dist/lifecycle/app-transition-content-validation.js");
  const { createApplicationEnvironmentProfileRecipes } = await import("../dist/profiles/profile-recipes.js");
  const validators = await loadAppTransitionContentValidators();
  const context = { ...createGenerationRenderingContext(), profiles: createApplicationEnvironmentProfileRecipes() };
  const preSectionContext = createGenerationRenderingContext(false, false, false, undefined, undefined, false, true);
  const predecessorContext = createGenerationRenderingContext(false, false, false, undefined, undefined, true, true);
  const retainedContext = { ...predecessorContext, retainAnalyticsConsent: true };
  const subsets = {};
  const consentFiles = [
    "apps/web/src/integrations/analytics/analytics-consent.tsx",
    "apps/web/src/integrations/analytics/analytics-runtime.ts",
  ];
  const buildFiles = [
    "apps/web/app/layout.tsx",
    "apps/web/next.config.ts",
    "apps/web/scripts/check-application-environment.mjs",
    "apps/web/src/configuration/document-metadata.ts",
    "apps/web/src/configuration/public-build.ts",
  ];
  const sectionFiles = [
    "apps/web/src/content/content-schema.ts",
    "apps/web/src/sections/section-registry.tsx",
  ];
  async function prepare(request, renderingContext) {
    const source = await core.renderSkeleton({ ...request, profile: "portfolio" }, renderingContext);
    const target = await core.renderSkeleton({ ...request, profile: "app" }, renderingContext);
    assert.equal(source.ok, true); assert.equal(target.ok, true);
    const currentFiles = new Map(source.value.files.map(({ path, content }) => [path, content]));
    const before = [...currentFiles].map(([path, content]) => [path, Buffer.from(content)]);
    const prepared = policy.prepareAppProfileTransition({ source: source.value, target: target.value, currentFiles, validators });
    assert.equal(prepared.ok, true, JSON.stringify(prepared));
    assert.deepEqual([...currentFiles].map(([path, content]) => [path, Buffer.from(content)]), before);
    return { source: source.value, prepared: prepared.value };
  }
  const targetLockfileFingerprint = core.fingerprintFileContent(new Uint8Array(await readFile(new URL("../lockfiles/web-recipe-app-0.3.0-next-16.4.5/pnpm-lock.yaml", import.meta.url))));
  for (let subset = 0; subset < 8; subset++) {
    const request = {
      ...policy.appTransitionVisualProject, packageVersions: core.verifiedCapabilityPackageVersions,
      ...(subset & 1 ? { bookingCalendly: policy.appTransitionVisualBookingSettings } : {}),
      ...(subset & 2 ? { multilingual: true } : {}),
      ...(subset & 4 ? { analytics: policy.appTransitionVisualAnalyticsSettings } : {}),
    };
    const retained = await prepare(request, retainedContext);
    const predecessor = await prepare(request, predecessorContext);
    const preSection = await prepare(request, preSectionContext);
    const current = await prepare(request, context);
    const optionalCapabilities = current.source.project.selectedCapabilities.filter(identifier => ["analytics", "booking-calendly", "multilingual"].includes(identifier));
    const priorFingerprints = retained.prepared.influencingFingerprints;
    const predecessorFingerprints = predecessor.prepared.influencingFingerprints;
    const preSectionFingerprints = preSection.prepared.influencingFingerprints;
    const currentFingerprints = current.prepared.influencingFingerprints;
    subsets[[...optionalCapabilities].sort().join("+") || "none"] = core.fingerprintJsonValue(priorFingerprints);
    const priorByPath = new Map(priorFingerprints.map(({ path, fingerprint }) => [path, fingerprint]));
    const predecessorByPath = new Map(predecessorFingerprints.map(({ path, fingerprint }) => [path, fingerprint]));
    const preSectionByPath = new Map(preSectionFingerprints.map(({ path, fingerprint }) => [path, fingerprint]));
    assert.deepEqual(predecessorFingerprints.map(({ path }) => path), priorFingerprints.map(({ path }) => path));
    assert.deepEqual(predecessorFingerprints.filter(({ path, fingerprint }) => priorByPath.get(path) !== fingerprint).map(({ path }) => path),
      subset & 4 ? consentFiles : []);
    assert.deepEqual(preSectionFingerprints.filter(({ path, fingerprint }) => predecessorByPath.get(path) !== fingerprint).map(({ path }) => path), buildFiles);
    assert.deepEqual(currentFingerprints.map(({ path }) => path), preSectionFingerprints.map(({ path }) => path));
    assert.deepEqual(currentFingerprints.filter(({ path, fingerprint }) => preSectionByPath.get(path) !== fingerprint).map(({ path }) => path), sectionFiles);
    const identity = { optionalCapabilities, influencingFingerprints: currentFingerprints, targetLockfileFingerprint };
    const retainedIdentity = { ...identity, influencingFingerprints: priorFingerprints };
    assert.equal(policy.verifyAppTransitionVisualInputRecord(identity).ok, false, "current preparation remains unadmitted");
    assert.equal(policy.verifyAppTransitionVisualInputRecord(retainedIdentity).ok, false, "retained preparation remains unadmitted");
    assert.equal(policy.verifyAppTransitionVisualInputRecord({ ...identity, influencingFingerprints: predecessorFingerprints }).ok, false);
    assert.equal(syntheticPolicy.verifyAppTransitionVisualInputRecord(identity).ok, true);
    const baselines = await Promise.all(policy.appTransitionBaselinePaths.map(async (path, index) => ({
      path, content: await readFile(new URL(`../templates/portfolio/apps/web/tests/visual/home-visual.spec.ts-snapshots/app-transition-${subset & 2 ? "multilingual-" : ""}home-${index === 0 ? "desktop" : "mobile"}-chromium-linux.png`, import.meta.url)),
    })));
    assert.equal(syntheticPolicy.verifyAppTransitionVisualInputRecord({ ...identity, baselines }).ok, true);
    assert.equal(syntheticPolicy.verifyAppTransitionVisualInputRecord({ ...identity, baselines: [baselines[0], baselines[0]] }).ok, false);
    assert.equal(syntheticPolicy.verifyAppTransitionVisualInputRecord({ ...identity, baselines: [{ ...baselines[0], path: "foreign.png" }, baselines[1]] }).ok, false);
    const retainedEvidence = {
      ...retainedIdentity,
      sourceProfile: "portfolio",
      manifestFingerprint: `sha256:${"a".repeat(64)}`,
      baselines,
    };
    assert.equal(policy.selectAppTransitionVisuals({ ...retained, evidence: retainedEvidence }).ok, true);
    const usingRetainedEvidence = policy.selectAppTransitionVisuals({ ...current, evidence: retainedEvidence });
    assert.equal(usingRetainedEvidence.issues?.[0]?.code, "PROFILE_TRANSITION_VISUAL_EVIDENCE_REQUIRED");
  }
  assert.deepEqual(subsets, {
  "none": "sha256:b95793876632bc0532d66fbcd110368ae2c47e03b44b16adb849679064473366",
  "analytics": "sha256:3f3a591cd48419cc2debf38296a359053e0809b82aff77c1fecfd30553caee7d",
  "booking-calendly": "sha256:975e4ec16bf9136b13a35c8a480f20173d17886b028bf5a4709f7ef2b8c16697",
  "analytics+booking-calendly": "sha256:5272e692f85caaf73123e9577b4739b32904b6314be9707140e4b21c093437f9",
  "multilingual": "sha256:82eed03cba5803fe526d4f44254cd120ca281e111d345457d43bfb658e3d699d",
  "analytics+multilingual": "sha256:56660909495ae01d50c7c63c0d6e26fa6bc05f4e3ea3e00bbe117fa70bd943b3",
  "booking-calendly+multilingual": "sha256:c1ca023e80b09dfe6eae5915a4c31a7420494f8ce5292f1824f3e3ca4bce2648",
  "analytics+booking-calendly+multilingual": "sha256:859d19ac3d16a26a710b3b9c6f436d852c9d6b839865ec4b5b254ac8f36b61e6"
});
  const candidate = policy.viteSecurityAppTransitionVisualInputCandidate;
  assert.notDeepEqual(candidate.subsets, subsets);
  assert.notEqual(candidate.targetLockfileFingerprint, targetLockfileFingerprint);
  assert.deepEqual(candidate.baselines, policy.appTransitionVisualInputRecord.baselines);
  assert.equal(Object.isFrozen(candidate), true);
  assert.equal(Object.isFrozen(candidate.subsets), true);
});
