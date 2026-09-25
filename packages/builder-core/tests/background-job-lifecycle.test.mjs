import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as core from "../dist/index.js";
import { inspectProject } from "../dist/diagnostics/project-inspection.js";
import { createBuilderStateSurfaces } from "../dist/generation/builder-state-surfaces.js";
import { createRecipeLockfileUrl, resolveRecipeLockfileVersion } from "../dist/generation/recipe-lockfiles.js";
import { createVitestFourProfileRecipes } from "../dist/profiles/profile-recipes.js";
import { createGenerationRenderingContext, readVerifiedProjectSnapshot } from "../dist/catalog/verified-package-versions.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const capability = "background-job-delivery";
const root = "/generated/jobs-lifecycle";
const git = { ok: true, identity: { root, revision: "abcdef0123456789abcdef0123456789abcdef01", attachedRef: "refs/heads/jobs-lifecycle", gitDirectory: "/generated/.git/worktrees/jobs-lifecycle", commonDirectory: "/generated/.git" } };

async function repository(profile = "portfolio", options = {}) {
  const rendered = await core.renderSkeleton({ profile, projectName: "jobs-lifecycle", displayName: "Jobs lifecycle", packageVersions: core.verifiedCapabilityPackageVersions, ...options }, options.context);
  assert.equal(rendered.ok, true, JSON.stringify(rendered));
  const files = new Map(rendered.value.files.map(({ path, content }) => [path, content]));
  const manifest = JSON.parse(decoder.decode(files.get("apps/web/package.json")));
  files.set("pnpm-lock.yaml", new Uint8Array(await readFile(createRecipeLockfileUrl(resolveRecipeLockfileVersion(rendered.value.project, manifest)))));
  files.set(".egeria/project.yaml", encoder.encode(core.serializeProjectYaml(rendered.value.project)));
  files.set(".egeria/migrations.jsonl", encoder.encode(""));
  const surfaces = core.materializeInstalledSurfaces({ files, surfaces: [...rendered.value.surfaces, ...createBuilderStateSurfaces()] });
  assert.equal(surfaces.ok, true, JSON.stringify(surfaces));
  const checks = options.applicationPersistence ? core.persistenceGenerationVerificationChecks : rendered.value.project.selectedCapabilities.includes("app-foundation") ? core.appGenerationVerificationChecks : core.ordinaryGenerationVerificationChecks;
  const state = { schemaVersion: "1.0.0", builderVersion: "0.0.0", projectSchemaVersion: "1.0.0", origin: { profile, recipeVersion: rendered.value.project.recipeVersion }, installedCapabilities: core.createInstalledManifest(rendered.value.resolved), appliedMigrations: [], managedSurfaces: surfaces.value, ejections: [], compatibility: { node: "22.23.2", pnpm: "11.20.0", platformAdapter: "cloudflare-workers" }, lastSuccessfulVerification: { kind: "generation", checks: ["contracts", "pre-state-inference", ...checks, "post-state-inference"] } };
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

test("jobs addition selects current jobs and deployment on all current profiles", async () => {
  for (const profile of ["portfolio", "site", "app"]) {
    const repo = await repository(profile);
    const planned = await core.planCapabilityAddition({ reader: repo.reader, git, capability });
    assert.equal(planned.ok, true, JSON.stringify(planned));
    assert.equal(planned.value.capability.version, "0.2.0");
    const result = await core.applyCapabilityAddition({ root, capability, approvedPlanFingerprint: planned.value.planFingerprint, reader: repo.reader, writer: repo.writer, inspectWorktree: async () => git, inspectCreateTargets: async () => ({ ok: true }), inspectExpectedChanges: async () => ({ ok: true }), verifier: { verifyInIsolatedCopy: async () => ({ ok: true, value: { checks: core.appGenerationVerificationChecks } }) } });
    assert.equal(result.ok, true, JSON.stringify(result));
    const state = core.parseStateJson(decoder.decode(repo.files.get(".egeria/state.json"))).value;
    assert.equal(state.installedCapabilities.find(({identifier}) => identifier === capability).version, "0.2.0");
    assert.equal(state.installedCapabilities.find(({identifier}) => identifier === "deployment-cloudflare").version, "0.5.0");
    assert.equal(state.installedCapabilities.find(({identifier}) => identifier === "app-foundation").version, "0.2.0");
    assert.deepEqual(repo.writes.slice(-2), [[".egeria/migrations.jsonl"], [".egeria/state.json"]]);
  }
});

const fixedNow = () => "2026-09-24T15:00:00.000Z";
const resources = [{environment:"staging",accountId:"private-account",primaryQueueId:"private-primary",deadLetterQueueId:"private-dead-letter"}];
async function removalPlan(repo, overrides = {}) {
  const base = {reader:repo.reader,git,capability,inspectRepositoryInventory:repo.inventory,now:fixedNow};
  const discovery = await core.planCapabilityRemoval({...base,jobRemoval:{resources}});
  assert.equal(discovery.ok,true,JSON.stringify(discovery));
  const disposition={disposition:"drain",outcome:"passed",workRemaining:false};
  const jobRemoval={resources,evidence:{schemaVersion:"1.0.0",subject:{...discovery.value.jobRemovalSubject,resources},deploymentInventory:{local:"not-provisioned",staging:"present",production:"not-provisioned"},observedAt:"2026-09-24T14:55:00.000Z",expiresAt:"2026-09-24T15:10:00.000Z",resources:resources.map(identity=>({identity,producerStop:"passed",primary:disposition,inFlight:disposition,delayed:disposition,deadLetter:disposition,retentionSeconds:86400,operationLimits:{maxMessages:100,maxDurationSeconds:300}}))},...overrides};
  const planned=await core.planCapabilityRemoval({...base,jobRemoval});
  assert.equal(planned.ok,true,JSON.stringify(planned));
  const report=planned.value.jobRemovalReport;
  const jobRemovalHumanReview={reportFingerprint:report.reportFingerprint,dispositions:report.requiredReviewItems.map(({identifier})=>({identifier,disposition:"accepted"}))};
  return {planned:planned.value,jobRemoval,jobRemovalHumanReview};
}
async function remove(repo, prepared, overrides={}) {
  const checks=core.parseProjectYaml(decoder.decode(repo.files.get(".egeria/project.yaml"))).value.selectedCapabilities.includes("application-persistence")?core.persistenceGenerationVerificationChecks:core.appGenerationVerificationChecks;
  return core.applyCapabilityRemoval({root,capability,approvedPlanFingerprint:prepared.planned.planFingerprint,jobRemoval:prepared.jobRemoval,jobRemovalHumanReview:prepared.jobRemovalHumanReview,reader:repo.reader,writer:repo.writer,inspectWorktree:async()=>git,inspectExpectedChanges:async()=>({ok:true}),inspectRepositoryInventory:repo.inventory,verifier:{verifyInIsolatedCopy:async()=>({ok:true,value:{checks}})},now:fixedNow,...overrides});
}
async function add(repo, overrides={}) {
  const planned=await core.planCapabilityAddition({reader:repo.reader,git,capability});
  assert.equal(planned.ok,true,JSON.stringify(planned));
  const checks=core.parseProjectYaml(decoder.decode(repo.files.get(".egeria/project.yaml"))).value.selectedCapabilities.includes("application-persistence")?core.persistenceGenerationVerificationChecks:core.appGenerationVerificationChecks;
  return core.applyCapabilityAddition({root,capability,approvedPlanFingerprint:planned.value.planFingerprint,reader:repo.reader,writer:repo.writer,inspectWorktree:async()=>git,inspectCreateTargets:async()=>({ok:true}),inspectExpectedChanges:async()=>({ok:true}),verifier:{verifyInIsolatedCopy:async()=>({ok:true,value:{checks}})},now:fixedNow,...overrides});
}
test("current jobs removal and re-add retain foundation, explicit email, persistence and exact migration identities", async()=>{
  for(const profile of ["portfolio","site","app"]) for(const retainedVersion of ["0.1.0","0.2.0"]) {
    const persistent=profile==="app";
    const repo=await repository(profile,{backgroundJobDelivery:true,transactionalEmailResend:true,...(persistent?{applicationPersistence:true}:{}),context:createGenerationRenderingContext(persistent,true,true,retainedVersion)});
    const prepared=await removalPlan(repo);
    assert.equal(prepared.planned.capability.version,retainedVersion);
    assert.equal(prepared.planned.jobRemovalReport.recommendation,"ready-for-human-review");
    assert.equal(JSON.stringify(prepared.planned).includes("private-account"),false);
    assert.equal(prepared.planned.actions.some(({path,kind})=>path==="apps/web/worker.mjs"&&kind==="delete-file"),true);
    const removed=await remove(repo,prepared);assert.equal(removed.ok,true,JSON.stringify(removed));
    assert.equal(removed.value.migration,`remove-background-job-delivery-${retainedVersion.replaceAll(".","-")}`);
    let state=core.parseStateJson(decoder.decode(repo.files.get(".egeria/state.json"))).value;
    assert.equal(state.installedCapabilities.find(({identifier})=>identifier==="deployment-cloudflare").version,persistent?"0.4.0":"0.3.0");
    assert.equal(state.installedCapabilities.find(({identifier})=>identifier==="app-foundation").version,"0.2.0");
    assert.ok(state.installedCapabilities.some(({identifier})=>identifier==="transactional-email-resend"));
    if(persistent) assert.ok(repo.files.has("apps/web/src/infrastructure/persistence/schema.ts"));
    const added=await add(repo);assert.equal(added.ok,true,JSON.stringify(added));assert.equal(added.value.migration,"add-background-job-delivery-0-2-0");
    state=core.parseStateJson(decoder.decode(repo.files.get(".egeria/state.json"))).value;
    assert.equal(state.installedCapabilities.find(({identifier})=>identifier===capability).version,"0.2.0");
    assert.deepEqual(repo.writes.slice(-2),[[".egeria/migrations.jsonl"],[".egeria/state.json"]]);
  }
});
test("post-source verification failure retains inspectable prefix and unchanged installed state", async()=>{
  for(const operation of ["add","remove"]) {
    const repo=await repository("app",operation==="remove"?{backgroundJobDelivery:true}:{});
    const original=repo.files.get(".egeria/state.json");
    const override={verifier:{verifyInIsolatedCopy:async()=>({ok:false})}};
    const result=operation==="add"?await add(repo,override):await remove(repo,await removalPlan(repo),override);
    assert.equal(result.ok,false);assert.equal(result.phase,"verify");assert.equal(result.recovery,"inspect-worktree");
    assert.deepEqual(repo.files.get(".egeria/state.json"),original);assert.equal(decoder.decode(repo.files.get(".egeria/migrations.jsonl")),"");
    assert.equal(repo.files.has("apps/web/src/application/job-delivery.ts"),operation==="add");
  }
});
test("freshness, subject mutation, unknown disposition and dirty identity refuse before writes",async()=>{
  for(const mode of ["stale","changed-handler","unknown","dirty"]) {
    const repo=await repository("portfolio",{backgroundJobDelivery:true});const prepared=await removalPlan(repo);
    const overrides={};
    if(mode==="stale") overrides.now=()=>"2026-09-24T15:10:00.000Z";
    if(mode==="changed-handler") repo.files.set("apps/web/src/application/job-handlers.ts",encoder.encode("export const changed=true;\n"));
    if(mode==="unknown") prepared.jobRemoval.evidence.resources[0].delayed.disposition="unknown";
    if(mode==="dirty") overrides.inspectWorktree=async()=>({ok:false,code:"GIT_WORKTREE_DIRTY"});
    const result=await remove(repo,prepared,overrides);assert.equal(result.ok,false);assert.equal(result.phase,"precondition");assert.deepEqual(repo.writes,[]);
  }
});
test("modified handler is preserved after reconciling imports and blocks re-add until ejection is resolved",async()=>{
  const repo=await repository("portfolio",{backgroundJobDelivery:true});
  const path="apps/web/src/application/job-handlers.ts";const content=encoder.encode("export const retainedApplicationHandler = () => true;\n");repo.files.set(path,content);
  const prepared=await removalPlan(repo);assert.equal(prepared.planned.actions.find(action=>action.path===path).kind,"preserve-file-and-eject");
  const result=await remove(repo,prepared);assert.equal(result.ok,true,JSON.stringify(result));assert.deepEqual(repo.files.get(path),content);
  const refused=await core.planCapabilityAddition({reader:repo.reader,git,capability});assert.equal(refused.ok,false);assert.equal(refused.issues[0].code,"PROJECT_EJECTION_UNSUPPORTED");
});
test("surviving producer and modified handler imports refuse jobs removal",async()=>{
  for(const path of ["apps/web/src/application/job-handlers.ts","apps/web/src/application/custom-producer.ts"]) {
    const repo=await repository("portfolio",{backgroundJobDelivery:true});repo.files.set(path,encoder.encode('import { JobDelivery } from "./job-delivery";\nexport const keep = JobDelivery;\n'));
    const result=await core.planCapabilityRemoval({reader:repo.reader,git,capability,jobRemoval:{resources},inspectRepositoryInventory:repo.inventory,now:fixedNow});
    assert.equal(result.ok,false);assert.equal(result.issues[0].code,"CAPABILITY_REMOVAL_REFERENCE_CONFLICT");assert.deepEqual(repo.writes,[]);
  }
});

test("jobs removal reports installed absence without inferring a fictional source version",async()=>{
  const repo=await repository();
  const result=await core.planCapabilityRemoval({reader:repo.reader,git,capability,jobRemoval:{resources},inspectRepositoryInventory:repo.inventory});
  assert.equal(result.ok,false);assert.equal(result.issues[0].code,"CAPABILITY_NOT_INSTALLED");assert.deepEqual(repo.writes,[]);
});

test("raw Queue producers and unknown dynamic or configuration references refuse removal",async()=>{
  for(const [path,source] of [
    ["apps/web/src/application/raw-producer.ts","export const send = (env, message) => env.JOB_QUEUE.send(message);\n"],
    ["apps/web/src/application/raw-dead-letter.ts","export const send = (env, message) => env['JOB_DEAD_LETTER_QUEUE'].send(message);\n"],
    ["apps/web/src/application/dynamic-consumer.ts","export const load = (path) => import(path);\n"],
    ["queue.config.json",JSON.stringify({consumer:"job-delivery"})],
  ]) {
    const repo=await repository("portfolio",{backgroundJobDelivery:true});repo.files.set(path,encoder.encode(source));
    const result=await core.planCapabilityRemoval({reader:repo.reader,git,capability,jobRemoval:{resources},inspectRepositoryInventory:repo.inventory,now:fixedNow});
    assert.equal(result.ok,false,path);assert.equal(result.issues[0].code,"CAPABILITY_REMOVAL_REFERENCE_CONFLICT");assert.deepEqual(repo.writes,[]);
  }
});

test("jobs addition refuses drifted controls, unsupported installed tuples and incomplete consumer surfaces",async()=>{
  for(const mode of ["unknown-tuple","managed-drift","missing-consumer"]) {
    const repo=await repository("app",mode==="missing-consumer"?{backgroundJobDelivery:true}:{});
    if(mode==="unknown-tuple") {
      const state=JSON.parse(decoder.decode(repo.files.get(".egeria/state.json")));
      state.installedCapabilities.find(({identifier})=>identifier==="deployment-cloudflare").version="9.9.9";
      repo.files.set(".egeria/state.json",encoder.encode(JSON.stringify(state)));
    } else if(mode==="managed-drift") repo.files.set("apps/web/wrangler.jsonc",encoder.encode("{}\n"));
    else repo.files.delete("apps/web/worker.mjs");
    const result=mode==="missing-consumer"
      ?await core.planCapabilityRemoval({reader:repo.reader,git,capability,jobRemoval:{resources},inspectRepositoryInventory:repo.inventory})
      :await core.planCapabilityAddition({reader:repo.reader,git,capability});
    assert.equal(result.ok,false,mode);assert.deepEqual(repo.writes,[]);
  }
});
test("jobs removal revalidates disposition immediately before writing and requires complete human review",async()=>{
  for(const mode of ["expires-before-write","unresolved-review","artifact-changed"]) {
    const repo=await repository("portfolio",{backgroundJobDelivery:true});
    let prepared=await removalPlan(repo);
    if(mode==="artifact-changed") {
      const artifactPath="docs/operator-audit.json";const artifact=encoder.encode('{"reviewed":true}\n');repo.files.set(artifactPath,artifact);
      prepared.jobRemoval.evidence.resources[0].audit={reference:"reviewed-audit",digest:core.fingerprintFileContent(artifact)};
      prepared.jobRemoval.localArtifacts=[{reference:"reviewed-audit",path:artifactPath}];
      prepared=await removalPlan(repo,prepared.jobRemoval);
      repo.files.set(artifactPath,encoder.encode('{"reviewed":false}\n'));
    }
    if(mode==="unresolved-review") prepared.jobRemovalHumanReview.dispositions[0].disposition="unresolved";
    let clockReads=0;
    const result=await remove(repo,prepared,mode==="expires-before-write"?{now:()=>++clockReads===1?fixedNow():"2026-09-24T15:10:00.000Z"}:{});
    assert.equal(result.ok,false,mode);assert.equal(result.phase,"precondition");assert.deepEqual(repo.writes,[]);
    if(mode==="expires-before-write") assert.equal(clockReads,2);
  }
});

test("generated and locally added jobs remove with an empty reviewed unprovisioned inventory", async () => {
  for (const initiallyGenerated of [true, false]) {
    const repo = await repository("portfolio", initiallyGenerated ? {backgroundJobDelivery:true} : {});
    if (!initiallyGenerated) assert.equal((await add(repo)).ok, true);
    const discovery = await core.planCapabilityRemoval({reader:repo.reader,git,capability,jobRemoval:{resources:[]},inspectRepositoryInventory:repo.inventory,now:fixedNow});
    assert.equal(discovery.ok, true, JSON.stringify(discovery));
    assert.equal(discovery.value.jobRemovalReport.recommendation, "obtain-more-evidence");
    const jobRemoval = {resources:[],evidence:{
      schemaVersion:"1.0.0",subject:{...discovery.value.jobRemovalSubject,resources:[]},
      deploymentInventory:{local:"not-provisioned",staging:"not-provisioned",production:"not-provisioned"},
      observedAt:"2026-09-24T14:55:00.000Z",expiresAt:"2026-09-24T15:10:00.000Z",resources:[],
    }};
    const planned = await core.planCapabilityRemoval({reader:repo.reader,git,capability,jobRemoval,inspectRepositoryInventory:repo.inventory,now:fixedNow});
    assert.equal(planned.ok, true, JSON.stringify(planned));
    assert.equal(planned.value.jobRemovalReport.recommendation, "ready-for-human-review");
    const report = planned.value.jobRemovalReport;
    const prepared = {planned:planned.value,jobRemoval,jobRemovalHumanReview:{reportFingerprint:report.reportFingerprint,dispositions:report.requiredReviewItems.map(({identifier})=>({identifier,disposition:"accepted"}))}};
    const result = await remove(repo,prepared);
    assert.equal(result.ok, true, JSON.stringify(result));
    const state = core.parseStateJson(decoder.decode(repo.files.get(".egeria/state.json"))).value;
    assert.equal(state.installedCapabilities.some(({identifier})=>identifier===capability), false);
    assert.equal(state.installedCapabilities.find(({identifier})=>identifier==="app-foundation").version,"0.2.0");
    assert.deepEqual(repo.writes.slice(-2),[[".egeria/migrations.jsonl"],[".egeria/state.json"]]);
  }
});
