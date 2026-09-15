import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import * as core from "../dist/index.js";
import { createBuilderStateSurfaces } from "../dist/generation/builder-state-surfaces.js";
import { planCapabilityRemoval } from "../dist/lifecycle/plan-capability-removal.js";
import { applyCapabilityRemoval } from "../dist/lifecycle/apply-capability-removal.js";
import { stringifyCanonicalJson } from "../dist/serialization/canonical-json.js";
import { persistenceGenerationVerificationChecks } from "../dist/contracts/generation-verification.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const root = "/generated/persistence-removal";
const git = { ok: true, identity: {
  root, revision: "abcdef0123456789abcdef0123456789abcdef01",
  attachedRef: "refs/heads/remove-persistence",
  gitDirectory: "/generated/.git/worktrees/remove-persistence", commonDirectory: "/generated/.git",
} };
const digest = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const fingerprint = (value) => digest(stringifyCanonicalJson(value));

async function repository(options = {}) {
  const rendered = await core.renderSkeleton({
    profile: "app", projectName: "persistence-removal", displayName: "Persistence removal",
    applicationPersistence: true, ...(options.multilingual ? { multilingual: true } : {}),
    packageVersions: core.verifiedCapabilityPackageVersions,
  });
  assert.equal(rendered.ok, true, JSON.stringify(rendered));
  const files = new Map(rendered.value.files.map(({ path, content }) => [path, content]));
  files.set("pnpm-lock.yaml", new Uint8Array(await readFile(new URL("../lockfiles/web-application-persistence/pnpm-lock.yaml", import.meta.url))));
  files.set(".egeria/project.yaml", encoder.encode(core.serializeProjectYaml(rendered.value.project)));
  files.set(".egeria/migrations.jsonl", encoder.encode(""));
  const surfaces = core.materializeInstalledSurfaces({ files, surfaces: [...rendered.value.surfaces, ...createBuilderStateSurfaces()] });
  assert.equal(surfaces.ok, true, JSON.stringify(surfaces));
  const state = {
    schemaVersion: "1.0.0", builderVersion: "0.0.0", projectSchemaVersion: "1.0.0",
    origin: { profile: "app", recipeVersion: "0.2.0" },
    installedCapabilities: core.createInstalledManifest(rendered.value.resolved),
    appliedMigrations: [], managedSurfaces: surfaces.value, ejections: [],
    compatibility: { node: "22.23.2", pnpm: "11.20.0", platformAdapter: "cloudflare-workers" },
    lastSuccessfulVerification: { kind: "generation", checks: ["contracts", "pre-state-inference", ...persistenceGenerationVerificationChecks, "post-state-inference"] },
  };
  files.set(".egeria/state.json", encoder.encode(`${stringifyCanonicalJson(state)}\n`));
  const writes = [];
  const reader = {
    async readBytes(path) { return files.has(path) ? { kind: "file", content: files.get(path) } : { kind: "missing" }; },
    async readText(path) {
      const result = await this.readBytes(path);
      if (result.kind !== "file") return result;
      try { return { kind: "file", content: new TextDecoder("utf-8", { fatal: true }).decode(result.content) }; }
      catch { return { kind: "error", code: "FILE_ENCODING_INVALID" }; }
    },
  };
  const writer = { async write(changes) {
    for (const change of changes) assert.deepEqual(files.get(change.path), change.expected);
    for (const change of changes) {
      if (change.kind === "delete-file") files.delete(change.path);
      else files.set(change.path, change.content);
    }
    writes.push(changes.map(({ path }) => path));
    await options.afterWrite?.({ files, writes });
    return { ok: true };
  } };
  const inventory = async () => ({ ok: true, value: {
    entries: [...files.keys()].filter((path) => !path.startsWith(".wrangler/")).sort().map((path) => ({ path, kind: "file", source: "tracked" })), truncated: false,
  } });
  return { files, writes, reader, writer, inventory, rendered: rendered.value };
}

function removalEvidence(repository) {
  const databases = [{ environment: "local", databaseId: "local-application-database" }];
  const schemaPath = "apps/web/src/infrastructure/persistence/schema.ts";
  const subject = {
    descriptorVersion: "0.1.0",
    descriptorFingerprint: fingerprint(repository.rendered.resolved.capabilities.find(({ identifier }) => identifier === "application-persistence")),
    schemaFingerprint: fingerprint([{ path: schemaPath, fingerprint: digest(repository.files.get(schemaPath)) }]),
    migrationsFingerprint: fingerprint([...repository.files.keys()].filter((path) => path.startsWith("apps/web/migrations/")).sort().map((path) => ({ path, fingerprint: digest(repository.files.get(path)) }))),
    databases,
  };
  const exportBytes = encoder.encode("synthetic private export\n");
  const recoveryBytes = encoder.encode("synthetic private recovery\n");
  repository.files.set(".wrangler/removal-evidence/export.sql", exportBytes);
  repository.files.set(".wrangler/removal-evidence/recovery.json", recoveryBytes);
  return {
    databases,
    policy: { exportNotBefore: "2026-09-14T00:00:00Z", retainUntil: "2026-10-14T00:00:00Z", recoveryRequirements: [{ environment: "local", scope: "local" }], writeConsistency: "writes-paused" },
    evidence: { schemaVersion: "1.0.0", subject, databases: [{ ...databases[0],
      export: { artifactReference: "local-export", digest: digest(exportBytes), completedAt: "2026-09-14T01:00:00Z", outcome: "passed" },
      recovery: { artifactReference: "local-recovery", digest: digest(recoveryBytes), exportDigest: digest(exportBytes), scope: "local", restoration: "passed", readback: "passed" },
      writeConsistency: { mode: "writes-paused", outcome: "passed" }, retention: { retainedUntil: "2026-10-14T00:00:00Z", outcome: "passed" },
    }] },
    localArtifacts: [{ reference: "local-export", path: ".wrangler/removal-evidence/export.sql" }, { reference: "local-recovery", path: ".wrangler/removal-evidence/recovery.json" }],
  };
}

async function plan(repository, persistenceRemoval, capability = "application-persistence") {
  return planCapabilityRemoval({ reader: repository.reader, git, capability, persistenceRemoval, inspectRepositoryInventory: repository.inventory });
}

function humanReview(plan) {
  return { reportFingerprint: plan.persistenceRemovalReport.reportFingerprint, dispositions: plan.persistenceRemovalReport.requiredReviewItems.map(({ identifier }) => ({ identifier, disposition: "accepted" })) };
}

async function apply(repository, planned, evidence, overrides = {}) {
  return applyCapabilityRemoval({
    root, capability: "application-persistence", approvedPlanFingerprint: planned.planFingerprint,
    persistenceRemoval: evidence, persistenceRemovalHumanReview: humanReview(planned),
    reader: repository.reader, writer: repository.writer, inspectRepositoryInventory: repository.inventory,
    inspectWorktree: async () => git, inspectExpectedChanges: async () => ({ ok: true }),
    verifier: { verifyInIsolatedCopy: async () => ({ ok: true, value: { checks: core.appGenerationVerificationChecks } }) },
    now: () => "2026-09-14T02:00:00Z", ...overrides,
  });
}

test("persistence removal requires evidence review and restores the default app in a state-last transaction", async () => {
  const repo = await repository();
  const manifest = JSON.parse(decoder.decode(repo.files.get("apps/web/package.json")));
  manifest.scripts.custom = "node scripts/custom.mjs";
  repo.files.set("apps/web/package.json", encoder.encode(`${JSON.stringify(manifest, null, 2)}\n`));
  const evidence = removalEvidence(repo);
  const planned = await plan(repo, evidence);
  assert.equal(planned.ok, true, JSON.stringify(planned));
  assert.deepEqual(planned.value.persistenceRemovalSubject, {
    descriptorVersion: "0.1.0",
    descriptorFingerprint: evidence.evidence.subject.descriptorFingerprint,
    schemaFingerprint: evidence.evidence.subject.schemaFingerprint,
    migrationsFingerprint: evidence.evidence.subject.migrationsFingerprint,
  });
  assert.equal(planned.value.persistenceRemovalReport.recommendation, "ready-for-human-review");
  assert.equal(JSON.stringify(planned).includes("synthetic private"), false);
  assert.equal(JSON.stringify(planned).includes("local-application-database"), false);
  const result = await apply(repo, planned.value, evidence);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(repo.writes.slice(-2), [[".egeria/migrations.jsonl"], [".egeria/state.json"]]);
  const finalState = JSON.parse(decoder.decode(repo.files.get(".egeria/state.json")));
  assert.equal(finalState.installedCapabilities.find(({ identifier }) => identifier === "standards").version, "0.5.0");
  assert.equal(finalState.installedCapabilities.find(({ identifier }) => identifier === "deployment-cloudflare").version, "0.3.0");
  assert.equal(finalState.installedCapabilities.some(({ identifier }) => identifier === "application-persistence"), false);
  const finalManifest = JSON.parse(decoder.decode(repo.files.get("apps/web/package.json")));
  assert.equal(finalManifest.scripts.custom, "node scripts/custom.mjs");
  assert.equal(finalManifest.dependencies["drizzle-orm"], undefined);
  assert.equal(finalManifest.devDependencies["drizzle-kit"], undefined);
  assert.equal(repo.files.has("apps/web/vitest.bindings.config.ts"), false);
  assert.deepEqual(repo.files.get("pnpm-lock.yaml"), new Uint8Array(await readFile(new URL("../lockfiles/web-recipe-app-0.2.0/pnpm-lock.yaml", import.meta.url))));
});

test("machine-ready persistence removal never writes without complete human dispositions", async () => {
  const repo = await repository();
  const evidence = removalEvidence(repo);
  const planned = await plan(repo, evidence);
  assert.equal(planned.ok, true, JSON.stringify(planned));
  for (const review of [undefined, { ...humanReview(planned.value), dispositions: [] }, { ...humanReview(planned.value), dispositions: humanReview(planned.value).dispositions.map((item) => ({ ...item, disposition: "rejected" })) }]) {
    const result = await apply(repo, planned.value, evidence, { persistenceRemovalHumanReview: review });
    assert.equal(result.ok, false);
    assert.equal(result.phase, "precondition");
    assert.deepEqual(repo.writes, []);
  }
});

test("persistence removal preserves customized content mentioning removed packages for human review", async () => {
  for (const packageName of ["drizzle-orm", "drizzle-kit"]) {
    const repo = await repository();
    const path = "apps/web/content/en-CA/work-featured.yaml";
    const content = encoder.encode(decoder.decode(repo.files.get(path)).replace("title: Featured work", `title: Replacing ${packageName}`));
    repo.files.set(path, content);
    const evidence = removalEvidence(repo);
    const planned = await plan(repo, evidence);
    assert.equal(planned.ok, true, JSON.stringify(planned));
    assert.equal(planned.value.persistenceRemovalReport.recommendation, "ready-for-human-review");
    const review = planned.value.reviewRequirements.find(({ code }) => code === "review-capability-removal-reference-warnings");
    assert.ok(review.warnings.some((warning) => warning.path === path && warning.code === "CAPABILITY_REMOVAL_HEURISTIC_REFERENCE_POSSIBLE"));
    assert.deepEqual(repo.writes, []);
    const result = await apply(repo, planned.value, evidence);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.deepEqual(repo.files.get(path), content);
  }
});

test("changed export bytes after approval refuse before the first write", async () => {
  const repo = await repository();
  const evidence = removalEvidence(repo);
  const planned = await plan(repo, evidence);
  assert.equal(planned.ok, true, JSON.stringify(planned));
  repo.files.set(".wrangler/removal-evidence/export.sql", encoder.encode("changed private export"));
  const result = await apply(repo, planned.value, evidence);
  assert.equal(result.ok, false);
  assert.equal(result.phase, "precondition");
  assert.deepEqual(repo.writes, []);
});

test("persistence evidence subjects and required recovery cannot be self-certified by the supplied envelope", async () => {
  for (const mutate of [
    (input) => { delete input.evidence; },
    (input) => { input.evidence.subject.schemaFingerprint = `sha256:${"0".repeat(64)}`; },
    (input) => { input.evidence.databases[0].databaseId = "other-database"; },
    (input) => { input.evidence.databases[0].recovery.restoration = "failed"; },
    (input) => { input.policy.recoveryRequirements[0].scope = "deployed"; },
  ]) {
    const repo = await repository();
    const evidence = removalEvidence(repo);
    mutate(evidence);
    const planned = await plan(repo, evidence);
    assert.equal(planned.ok, true, JSON.stringify(planned));
    assert.notEqual(planned.value.persistenceRemovalReport.recommendation, "ready-for-human-review");
    const result = await apply(repo, planned.value, evidence);
    assert.equal(result.ok, false);
    assert.equal(result.code, "PERSISTENCE_REMOVAL_EVIDENCE_NOT_READY");
    assert.deepEqual(repo.writes, []);
  }
});

test("persistence removal preserves changed application schema and user migration SQL", async () => {
  const repo = await repository();
  const schemaPath = "apps/web/src/infrastructure/persistence/schema.ts";
  const schema = encoder.encode("export const applicationSchema = {};\n");
  const sql = encoder.encode("CREATE TABLE customer_owned(id INTEGER PRIMARY KEY);\n");
  repo.files.set(schemaPath, schema);
  repo.files.set("apps/web/migrations/0000_customer.sql", sql);
  repo.files.set("apps/web/migrations/meta/_journal.json", encoder.encode('{"entries":[]}\n'));
  const evidence = removalEvidence(repo);
  const planned = await plan(repo, evidence);
  assert.equal(planned.ok, true, JSON.stringify(planned));
  assert.equal(planned.value.actions.find(({ path }) => path === schemaPath).kind, "preserve-file-and-eject");
  const result = await apply(repo, planned.value, evidence);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(repo.files.get(schemaPath), schema);
  assert.deepEqual(repo.files.get("apps/web/migrations/0000_customer.sql"), sql);
  assert.equal(repo.files.has("apps/web/migrations/meta/_journal.json"), true);
  assert.deepEqual(JSON.parse(decoder.decode(repo.files.get(".egeria/state.json"))).ejections, [schemaPath]);
  const repeated = await plan(repo, evidence);
  assert.equal(repeated.ok, false);
  assert.equal(repeated.issues[0].code, "CAPABILITY_NOT_INSTALLED");
});

test("surviving Drizzle consumers refuse persistence removal without erasing custom source", async () => {
  for (const [path, content] of [
    ["apps/web/src/custom.ts", 'import { sql } from "drizzle-orm"; export { sql };\n'],
    ["apps/web/src/custom.ts", 'export { sqliteTable } from "drizzle-orm/sqlite-core";\n'],
    ["apps/web/custom.config.ts", 'import { defineConfig } from "drizzle-kit"; export default defineConfig({});\n'],
  ]) {
    const repo = await repository();
    repo.files.set(path, encoder.encode(content));
    const planned = await plan(repo, removalEvidence(repo));
    assert.equal(planned.ok, false);
    assert.equal(planned.issues[0].code, "CAPABILITY_REMOVAL_REFERENCE_CONFLICT");
    assert.deepEqual(repo.writes, []);
    assert.equal(decoder.decode(repo.files.get(path)), content);
  }
});

test("persistence removal refuses static Drizzle commands reached through custom JavaScript tools", async () => {
  for (const source of [
    'import { execFileSync } from "node:child_process"; execFileSync("drizzle-kit", ["generate"]);',
    'import { spawn } from "node:child_process"; spawn("drizzle-kit", ["generate"]);',
    'import process from "node:child_process"; process.execSync("pnpm exec drizzle-kit generate");',
    'import { execFile } from "node:child_process"; execFile("pnpm", ["exec", "drizzle-kit", "generate"], () => {});',
    'import { spawnSync } from "node:child_process"; spawnSync("node", ["node_modules/drizzle-kit/bin.cjs", "generate"]);',
  ]) {
    const repo = await repository();
    const path = "scripts/generate-models.mjs";
    repo.files.set(path, encoder.encode(source));
    const manifest = JSON.parse(decoder.decode(repo.files.get("apps/web/package.json")));
    manifest.scripts.custom = "node ../../scripts/generate-models.mjs";
    repo.files.set("apps/web/package.json", encoder.encode(`${JSON.stringify(manifest, null, 2)}\n`));
    const planned = await plan(repo, removalEvidence(repo));
    assert.equal(planned.ok, false, source);
    assert.equal(planned.issues[0].code, "CAPABILITY_REMOVAL_REFERENCE_CONFLICT");
    assert.deepEqual(repo.writes, []);
    assert.equal(decoder.decode(repo.files.get(path)), source);
  }
});

test("a custom dependency graph refuses persistence removal before replacement", async () => {
  const repo = await repository();
  const manifest = JSON.parse(decoder.decode(repo.files.get("apps/web/package.json")));
  manifest.dependencies["custom-database-consumer"] = "1.0.0";
  repo.files.set("apps/web/package.json", encoder.encode(`${JSON.stringify(manifest)}\n`));
  const planned = await plan(repo, removalEvidence(repo));
  assert.equal(planned.ok, false);
  assert.equal(planned.issues[0].code, "PROJECT_DRIFT_DETECTED");
  assert.deepEqual(repo.writes, []);
});

test("evidence changed during final preflight refuses before source writes", async () => {
  const repo = await repository();
  const evidence = removalEvidence(repo);
  const planned = await plan(repo, evidence);
  assert.equal(planned.ok, true, JSON.stringify(planned));
  let inspections = 0;
  const result = await apply(repo, planned.value, evidence, { inspectWorktree: async () => {
    inspections += 1;
    if (inspections === 2) repo.files.set(".wrangler/removal-evidence/export.sql", encoder.encode("later bytes"));
    return git;
  } });
  assert.equal(result.ok, false);
  assert.equal(result.code, "CAPABILITY_PLAN_APPROVAL_INVALID");
  assert.deepEqual(repo.writes, []);
});

test("failed verification retains transformed source and the original state and migration log", async () => {
  const repo = await repository();
  const evidence = removalEvidence(repo);
  const planned = await plan(repo, evidence);
  assert.equal(planned.ok, true, JSON.stringify(planned));
  const state = repo.files.get(".egeria/state.json");
  const migrations = repo.files.get(".egeria/migrations.jsonl");
  const result = await apply(repo, planned.value, evidence, { verifier: { verifyInIsolatedCopy: async () => ({ ok: false }) } });
  assert.equal(result.ok, false);
  assert.equal(result.phase, "verify");
  assert.equal(result.recovery, "inspect-worktree");
  assert.equal(repo.writes.length, 1);
  assert.deepEqual(repo.files.get(".egeria/state.json"), state);
  assert.deepEqual(repo.files.get(".egeria/migrations.jsonl"), migrations);
  assert.equal(repo.files.has("apps/web/drizzle.config.ts"), false);
});

test("other optional removal retains persistence and requires the binding verification lane", async () => {
  for (const bindingChecked of [false, true]) {
    const repo = await repository({ multilingual: true });
    const planned = await plan(repo, undefined, "multilingual");
    assert.equal(planned.ok, true, JSON.stringify(planned));
    const result = await applyCapabilityRemoval({
      root, capability: "multilingual", approvedPlanFingerprint: planned.value.planFingerprint,
      reader: repo.reader, writer: repo.writer, inspectRepositoryInventory: repo.inventory,
      inspectWorktree: async () => git, inspectExpectedChanges: async () => ({ ok: true }),
      verifier: { verifyInIsolatedCopy: async () => ({ ok: true, value: { checks: bindingChecked ? persistenceGenerationVerificationChecks : core.appGenerationVerificationChecks } }) },
      now: () => "2026-09-14T02:00:00Z",
    });
    assert.equal(result.ok, bindingChecked, JSON.stringify(result));
    if (!bindingChecked) assert.equal(result.code, "CAPABILITY_VERIFICATION_FAILED");
    const state = JSON.parse(decoder.decode(repo.files.get(".egeria/state.json")));
    assert.equal(state.installedCapabilities.find(({ identifier }) => identifier === "standards").version, "0.6.0");
    assert.equal(state.installedCapabilities.some(({ identifier }) => identifier === "application-persistence"), true);
    assert.equal(repo.files.has("apps/web/vitest.bindings.config.ts"), true);
  }
});

test("unavailable selected local artifacts remain explicit human review obligations", async () => {
  const repo = await repository();
  const evidence = removalEvidence(repo);
  repo.files.delete(".wrangler/removal-evidence/recovery.json");
  const planned = await plan(repo, evidence);
  assert.equal(planned.ok, true, JSON.stringify(planned));
  assert.equal(planned.value.persistenceRemovalReport.recommendation, "ready-for-human-review");
  assert.equal(planned.value.persistenceRemovalReport.reasons.includes("LOCAL_ARTIFACT_UNAVAILABLE"), true);
  const review = humanReview(planned.value);
  const missingArtifactReview = planned.value.persistenceRemovalReport.requiredReviewItems.find(({ reason }) => reason === "LOCAL_ARTIFACT_UNAVAILABLE");
  const incomplete = { ...review, dispositions: review.dispositions.filter(({ identifier }) => identifier !== missingArtifactReview.identifier) };
  const refused = await apply(repo, planned.value, evidence, { persistenceRemovalHumanReview: incomplete });
  assert.equal(refused.ok, false);
  assert.equal(refused.code, "PERSISTENCE_REMOVAL_HUMAN_REVIEW_INCOMPLETE");
  assert.deepEqual(repo.writes, []);
  const accepted = await apply(repo, planned.value, evidence);
  assert.equal(accepted.ok, true, JSON.stringify(accepted));
});

test("changed user migration bytes invalidate an approved evidence subject before writes", async () => {
  const repo = await repository();
  const path = "apps/web/migrations/0000_application.sql";
  repo.files.set(path, encoder.encode("CREATE TABLE user_owned(id TEXT);\n"));
  const evidence = removalEvidence(repo);
  const planned = await plan(repo, evidence);
  assert.equal(planned.ok, true, JSON.stringify(planned));
  repo.files.set(path, encoder.encode("CREATE TABLE user_owned(id INTEGER);\n"));
  const result = await apply(repo, planned.value, evidence);
  assert.equal(result.ok, false);
  assert.equal(result.code, "CAPABILITY_PLAN_APPROVAL_INVALID");
  assert.deepEqual(repo.writes, []);
});
