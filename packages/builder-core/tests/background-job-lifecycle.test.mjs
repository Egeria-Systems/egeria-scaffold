import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as core from "../dist/index.js";
import { inspectProject } from "../dist/diagnostics/project-inspection.js";
import { createBuilderStateSurfaces } from "../dist/generation/builder-state-surfaces.js";
import { createRecipeLockfileUrl, resolveRecipeLockfileVersion } from "../dist/generation/recipe-lockfiles.js";
import { createGenerationRenderingContext, readVerifiedProjectSnapshot } from "../dist/catalog/verified-package-versions.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const capability = "background-job-delivery";
const root = "/generated/jobs-lifecycle";
const git = { ok: true, identity: { root, revision: "abcdef0123456789abcdef0123456789abcdef01", attachedRef: "refs/heads/jobs-lifecycle", gitDirectory: "/generated/.git/worktrees/jobs-lifecycle", commonDirectory: "/generated/.git" } };

async function repository(profile = "portfolio", options = {}) {
  const context = createGenerationRenderingContext(options.applicationPersistence === true, options.transactionalEmailResend === true || options.backgroundJobDelivery === true, options.backgroundJobDelivery === true);
  const rendered = await core.renderSkeleton({ profile, projectName: "jobs-lifecycle", displayName: "Jobs lifecycle", packageVersions: core.verifiedCapabilityPackageVersions, ...options }, context);
  assert.equal(rendered.ok, true, JSON.stringify(rendered));
  const files = new Map(rendered.value.files.map(({ path, content }) => [path, content]));
  const manifest = JSON.parse(decoder.decode(files.get("apps/web/package.json")));
  files.set("pnpm-lock.yaml", new Uint8Array(await readFile(createRecipeLockfileUrl(resolveRecipeLockfileVersion(rendered.value.project, manifest)))));
  files.set(".egeria/project.yaml", encoder.encode(core.serializeProjectYaml(rendered.value.project)));
  files.set(".egeria/migrations.jsonl", encoder.encode(""));
  const surfaces = core.materializeInstalledSurfaces({ files, surfaces: [...rendered.value.surfaces, ...createBuilderStateSurfaces()] });
  assert.equal(surfaces.ok, true, JSON.stringify(surfaces));
  const checks = options.applicationPersistence ? core.persistenceGenerationVerificationChecks : rendered.value.project.selectedCapabilities.includes("app-foundation") ? core.appGenerationVerificationChecks : core.ordinaryGenerationVerificationChecks;
  const state = { schemaVersion: "2.0.0", builderVersion: "0.0.0", projectSchemaVersion: "2.0.0", origin: { profile, recipeVersion: rendered.value.project.recipeVersion }, installedCapabilities: core.createInstalledManifest(rendered.value.resolved), appliedMigrations: [], managedSurfaces: surfaces.value, ejections: [], compatibility: { node: "22.23.2", pnpm: "11.28.1", platformAdapter: "cloudflare-workers" }, lastSuccessfulVerification: { kind: "generation", checks: ["contracts", "pre-state-inference", ...checks, "post-state-inference"] } };
  files.set(".egeria/state.json", encoder.encode(core.serializeStateJson(state)));
  const writes = [];
  const reader = {
    async readBytes(path) { return files.has(path) ? { kind: "file", content: files.get(path) } : { kind: "missing" }; },
    async readText(path) { return files.has(path) ? { kind: "file", content: decoder.decode(files.get(path)) } : { kind: "missing" }; },
  };
  const writer = { async write(changes) {
    for (const change of changes) {
      const expected = change.expected;
      if (expected?.kind === "missing") assert.equal(files.has(change.path), false);
      else assert.deepEqual(files.get(change.path), expected?.kind === "file" ? expected.content : expected);
    }
    for (const change of changes) {
      if (change.kind === "delete-file") files.delete(change.path);
      else files.set(change.path, change.content);
    }
    writes.push(changes.map(({ path }) => path));
    return { ok: true };
  } };
  const inventory = async () => ({ ok: true, value: { entries: [...files.keys()].sort().map((path) => ({ path, kind: "file", source: "tracked" })), truncated: false } });
  return { files, writes, reader, writer, inventory };
}

test("jobs lifecycle refuses before repository, Git, verifier, or writer calls", async () => {
  const unexpected = () => { assert.fail("unsupported jobs lifecycle accessed an adapter"); };
  for (const operation of ["Addition", "Removal"]) {
    const input = {
      root, capability, approvedPlanFingerprint: `sha256:${"a".repeat(64)}`,
      reader: { readText: unexpected, readBytes: unexpected }, writer: { write: unexpected },
      inspectWorktree: unexpected, inspectCreateTargets: unexpected, inspectExpectedChanges: unexpected,
      inspectRepositoryInventory: unexpected, verifier: { verifyInIsolatedCopy: unexpected },
      git,
    };
    const planned = await core[`planCapability${operation}`](input);
    assert.equal(planned.ok, false);
    assert.equal(planned.issues[0].code, `CAPABILITY_${operation.toUpperCase()}_UNSUPPORTED`);
    const result = await core[`applyCapability${operation}`](input);
    assert.equal(result.ok, false);
    assert.equal(result.code, `CAPABILITY_${operation.toUpperCase()}_UNSUPPORTED`);
    assert.equal(result.phase, "precondition");
    assert.equal(result.recovery, "not-required");
  }
});

test("installed current jobs remain inspectable while every optional lifecycle refuses before writes", async () => {
  for (const [profile, persistent] of [["portfolio", false], ["site", false], ["app", false], ["app", true]]) {
    const repo = await repository(profile, { backgroundJobDelivery: true, transactionalEmailResend: true, ...(persistent ? { applicationPersistence: true } : {}) });
    const before = new Map(repo.files);
    const snapshot = await readVerifiedProjectSnapshot(repo.reader);
    assert.equal(snapshot.ok, true, JSON.stringify(snapshot));
    const inspection = await inspectProject({ reader: repo.reader, catalog: snapshot.value.catalog, profiles: snapshot.value.profiles });
    assert.equal(inspection.project.kind, "valid");
    assert.equal(inspection.inference.state.kind, "valid");
    assert.equal(inspection.resolution.ok, true);
    assert.equal(core.parseStateJson(decoder.decode(repo.files.get(".egeria/state.json"))).value.installedCapabilities.find(value => value.identifier === capability).version, "0.4.0");
    for (const [selectedCapability, settings] of [
      ["contact-form-web3forms", undefined], ["multilingual", undefined],
      ["booking-calendly", { mode: "link" }],
      ["analytics", { consent: { policy: "explicit-opt-in" }, providers: { googleAnalytics4: true }, operationalIntegrations: {} }],
      ["transactional-email-resend", undefined], ["application-persistence", undefined],
    ]) {
      for (const operation of ["Addition", "Removal"]) {
        const unexpected = () => assert.fail("jobs-bearing lifecycle reached mutation or verification");
        const input = { root, reader: repo.reader, git, capability: selectedCapability, ...(operation === "Addition" ? { settings } : {}),
          approvedPlanFingerprint: `sha256:${"a".repeat(64)}`, writer: { write: unexpected },
          ...(operation === "Removal" && selectedCapability === "application-persistence" ? { persistenceRemoval: {
            databases: [{ environment: "local", databaseId: "local-application-database" }],
            policy: { exportNotBefore: "2026-09-24T00:00:00Z", retainUntil: "2026-10-24T00:00:00Z", recoveryRequirements: [{ environment: "local", scope: "local" }], writeConsistency: "writes-paused" },
          } } : {}),
          inspectWorktree: async () => git, inspectCreateTargets: unexpected, inspectExpectedChanges: unexpected,
          inspectRepositoryInventory: repo.inventory, verifier: { verifyInIsolatedCopy: unexpected },
        };
        const planned = await core[`planCapability${operation}`](input);
        assert.equal(planned.ok, false);
        assert.equal(planned.issues[0].code, `CAPABILITY_${operation.toUpperCase()}_UNSUPPORTED`);
        const result = await core[`applyCapability${operation}`](input);
        assert.equal(result.ok, false);
        assert.equal(result.code, `CAPABILITY_${operation.toUpperCase()}_UNSUPPORTED`);
        assert.equal(result.phase, "precondition");
      }
    }
    assert.deepEqual(repo.files, before);
    assert.deepEqual(repo.writes, []);
  }
});

test("jobs repositories refuse incoming transitions and retired upgrades without changing controls", async () => {
  const repo = await repository("site", { backgroundJobDelivery: true });
  const before = new Map(repo.files);
  const transition = await core.planProfileTransition({ reader: repo.reader, git, toProfile: "app" });
  assert.equal(transition.ok, false);
  assert.equal(transition.issues[0].code, "PROFILE_TRANSITION_UNSUPPORTED");
  assert.equal(Object.hasOwn(core, "planCapabilityUpgrade"), false);
  assert.deepEqual(repo.files, before);
  assert.deepEqual(repo.writes, []);
});
