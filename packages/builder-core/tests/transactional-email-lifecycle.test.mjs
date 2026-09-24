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
const capability = "transactional-email-resend";
const root = "/generated/email-lifecycle";
const git = { ok: true, identity: { root, revision: "abcdef0123456789abcdef0123456789abcdef01", attachedRef: "refs/heads/email-lifecycle", gitDirectory: "/generated/.git/worktrees/email-lifecycle", commonDirectory: "/generated/.git" } };

async function repository(profile = "portfolio", options = {}) {
  const rendered = await core.renderSkeleton({ profile, projectName: "email-lifecycle", displayName: "Email lifecycle", packageVersions: core.verifiedCapabilityPackageVersions, ...options }, options.context);
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

async function addition(repo, selectedCapability = capability, overrides = {}) {
  const planned = await core.planCapabilityAddition({ reader: repo.reader, git, capability: selectedCapability });
  assert.equal(planned.ok, true, JSON.stringify(planned));
  const result = await core.applyCapabilityAddition({ root, capability: selectedCapability, approvedPlanFingerprint: planned.value.planFingerprint, reader: repo.reader, writer: repo.writer, inspectWorktree: async () => git, inspectCreateTargets: async () => ({ ok: true }), inspectExpectedChanges: async () => ({ ok: true }), verifier: { verifyInIsolatedCopy: async () => ({ ok: true, value: { checks: core.appGenerationVerificationChecks } }) }, now: () => "2026-09-22T15:00:00.000Z", ...overrides });
  return { planned: planned.value, result };
}

test("current profiles add email with explicit dependencies and persist state only after verification", async () => {
  for (const profile of ["portfolio", "site", "app"]) {
    const repo = await repository(profile);
    const { planned, result } = await addition(repo);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.ok(planned.desiredCapabilities.includes("app-foundation"));
    assert.equal(planned.desiredCapabilities.includes("application-persistence"), false);
    assert.deepEqual(repo.writes.slice(-2), [[".egeria/migrations.jsonl"], [".egeria/state.json"]]);
    const state = core.parseStateJson(decoder.decode(repo.files.get(".egeria/state.json")));
    assert.equal(state.ok, true, JSON.stringify(state));
    assert.equal(state.value.origin.profile, profile);
    assert.equal(state.value.installedCapabilities.find(({ identifier }) => identifier === "app-foundation").version, "0.2.0");
  }
});

test("failed verification retains the source prefix without recording successful email installation", async () => {
  const repo = await repository();
  const original = repo.files.get(".egeria/state.json");
  const { result } = await addition(repo, capability, { verifier: { verifyInIsolatedCopy: async () => ({ ok: false }) } });
  assert.equal(result.ok, false);
  assert.equal(result.phase, "verify");
  assert.deepEqual(repo.files.get(".egeria/state.json"), original);
  assert.equal(decoder.decode(repo.files.get(".egeria/migrations.jsonl")), "");
  assert.ok(repo.files.has("apps/web/src/application/transactional-email-sender.ts"));
});

test("email removal declares separate operator review and retains foundation on all profiles", async () => {
  for (const profile of ["portfolio", "site", "app"]) {
    const repo = await repository(profile, { transactionalEmailResend: true });
    const planned = await core.planCapabilityRemoval({ reader: repo.reader, git, capability, inspectRepositoryInventory: repo.inventory });
    assert.equal(planned.ok, true, JSON.stringify(planned));
    assert.ok(planned.value.desiredCapabilities.includes("app-foundation"));
    assert.ok(planned.value.reviewRequirements.some(({ code }) => code === "review-email-provider-credential-and-retention-disposition"));
    const result = await core.applyCapabilityRemoval({ root, capability, approvedPlanFingerprint: planned.value.planFingerprint, reader: repo.reader, writer: repo.writer, inspectRepositoryInventory: repo.inventory, inspectWorktree: async () => git, inspectExpectedChanges: async () => ({ ok: true }), verifier: { verifyInIsolatedCopy: async () => ({ ok: true, value: { checks: core.appGenerationVerificationChecks } }) }, now: () => "2026-09-22T15:00:00.000Z" });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.deepEqual(repo.writes.slice(-2), [[".egeria/migrations.jsonl"], [".egeria/state.json"]]);
    assert.equal(repo.files.has("apps/web/src/application/transactional-email-sender.ts"), false);
    assert.equal(repo.files.has("apps/web/src/application/build-information-reader.ts"), true);
    const project = core.parseProjectYaml(decoder.decode(repo.files.get(".egeria/project.yaml"))).value;
    assert.ok(project.selectedCapabilities.includes("app-foundation"));
    assert.equal(project.selectedCapabilities.includes(capability), false);
    assert.equal(project.originProfile, profile);
  }
});

test("email addition refuses historical recipes and modified dependency locks before writes", async () => {
  const repo = await repository();
  repo.files.set("pnpm-lock.yaml", encoder.encode("changed-lock"));
  const planned = await core.planCapabilityAddition({ reader: repo.reader, git, capability });
  assert.equal(planned.ok, false);
  assert.equal(planned.issues[0].code, "PROJECT_DRIFT_DETECTED");
  assert.deepEqual(repo.writes, []);
  const context = createGenerationRenderingContext();
  const historical = await repository("portfolio", { context: { ...context, catalogSnapshot: { standards: "0.4.0", siteRouting: "0.4.0", appFoundation: "0.1.0" }, profiles: createVitestFourProfileRecipes() } });
  const result = await core.planCapabilityAddition({ reader: historical.reader, git, capability });
  assert.equal(result.ok, false);
  assert.equal(result.issues[0].code, "CAPABILITY_ADDITION_UNSUPPORTED");
  assert.deepEqual(historical.writes, []);
});

test("foundation installation preserves custom manifest members and rejects a missing Worker receipt", async () => {
  const repo = await repository();
  const manifest = JSON.parse(decoder.decode(repo.files.get("apps/web/package.json")));
  manifest.description = "Custom project";
  manifest.scripts.custom = "node custom.mjs";
  repo.files.set("apps/web/package.json", encoder.encode(JSON.stringify(manifest)));
  const { result } = await addition(repo);
  assert.equal(result.ok, true, JSON.stringify(result));
  const actual = JSON.parse(decoder.decode(repo.files.get("apps/web/package.json")));
  assert.equal(actual.description, "Custom project");
  assert.equal(actual.scripts.custom, "node custom.mjs");
  const other = await repository("site");
  const original = other.files.get(".egeria/state.json");
  const refused = await addition(other, capability, { verifier: { verifyInIsolatedCopy: async () => ({ ok: true, value: { checks: core.ordinaryGenerationVerificationChecks } }) } });
  assert.equal(refused.result.ok, false);
  assert.equal(refused.result.phase, "verify");
  assert.deepEqual(other.files.get(".egeria/state.json"), original);
});

test("email and persistence compose in either addition order", async () => {
  const verifier = { verifyInIsolatedCopy: async () => ({ ok: true, value: { checks: core.persistenceGenerationVerificationChecks } }) };
  for (const emailFirst of [false, true]) {
    const repo = await repository("app", emailFirst ? { transactionalEmailResend: true } : { applicationPersistence: true });
    const { result } = await addition(repo, emailFirst ? "application-persistence" : capability, { verifier });
    assert.equal(result.ok, true, JSON.stringify(result));
    const state = core.parseStateJson(decoder.decode(repo.files.get(".egeria/state.json")));
    assert.equal(state.ok, true, JSON.stringify(state));
    assert.ok(state.value.installedCapabilities.some(({ identifier }) => identifier === capability));
    assert.ok(state.value.installedCapabilities.some(({ identifier }) => identifier === "application-persistence"));
    assert.equal(state.value.installedCapabilities.find(({ identifier }) => identifier === "app-foundation").version, "0.2.0");
  }
});

test("other optional additions preserve email and the retained foundation", async () => {
  for (const emailInstalled of [true, false]) {
    const repo = await repository("portfolio", emailInstalled ? { transactionalEmailResend: true } : { context: createGenerationRenderingContext(false, true) });
    const { result } = await addition(repo, "multilingual");
    assert.equal(result.ok, true, JSON.stringify(result));
    const project = core.parseProjectYaml(decoder.decode(repo.files.get(".egeria/project.yaml"))).value;
    assert.equal(project.selectedCapabilities.includes(capability), emailInstalled);
    assert.ok(project.selectedCapabilities.includes("app-foundation"));
    assert.ok(project.selectedCapabilities.includes("multilingual"));
  }
});

test("surviving email imports and changed reviewed guide bytes refuse removal before writes", async () => {
  const repo = await repository("portfolio", { transactionalEmailResend: true });
  const consumer = "apps/web/src/application/consumer.ts";
  repo.files.set(consumer, encoder.encode('import { TransactionalEmailSender } from "./transactional-email-sender";\n'));
  const refused = await core.planCapabilityRemoval({ reader: repo.reader, git, capability, inspectRepositoryInventory: repo.inventory });
  assert.equal(refused.ok, false);
  assert.equal(refused.issues[0].code, "CAPABILITY_REMOVAL_REFERENCE_CONFLICT");
  repo.files.delete(consumer);
  const planned = await core.planCapabilityRemoval({ reader: repo.reader, git, capability, inspectRepositoryInventory: repo.inventory });
  assert.equal(planned.ok, true, JSON.stringify(planned));
  repo.files.set("docs/transactional-email.md", encoder.encode("Changed operator handoff\n"));
  const result = await core.applyCapabilityRemoval({ root, capability, approvedPlanFingerprint: planned.value.planFingerprint, reader: repo.reader, writer: repo.writer, inspectRepositoryInventory: repo.inventory, inspectWorktree: async () => git, inspectExpectedChanges: async () => ({ ok: true }), verifier: { verifyInIsolatedCopy: async () => ({ ok: true, value: { checks: core.appGenerationVerificationChecks } }) } });
  assert.equal(result.ok, false);
  assert.equal(result.phase, "precondition");
  assert.deepEqual(repo.writes, []);
});

const contactCapability = "contact-form-web3forms";
const contactSettings = { accessKey: "00000000-0000-4000-8000-000000000001" };
async function contactOperation(repo, operation, subject = contactCapability, settings, checks = core.appGenerationVerificationChecks, overrides = {}) {
  const input = { reader: repo.reader, git, capability: subject, ...(settings === undefined ? {} : {settings}), inspectRepositoryInventory: repo.inventory };
  const planned = await (operation === "add" ? core.planCapabilityAddition(input) : core.planCapabilityRemoval(input));
  assert.equal(planned.ok, true, JSON.stringify(planned));
  const result = await (operation === "add" ? core.applyCapabilityAddition : core.applyCapabilityRemoval)({
    ...input, root, approvedPlanFingerprint: planned.value.planFingerprint,
    writer: repo.writer, inspectWorktree: async () => git, inspectCreateTargets: async () => ({ok:true}), inspectExpectedChanges: async () => ({ok:true}),
    verifier: {verifyInIsolatedCopy:async()=>({ok:true,value:{checks}})}, now:()=>"2026-09-23T15:00:00.000Z", ...overrides,
  });
  return {planned:planned.value,result};
}

test("contact and email preserve both selections and retained foundation in either lifecycle order", async () => {
  for (const profile of ["portfolio", "site", "app"]) for (const emailFirst of [false,true]) {
    const repo = await repository(profile, emailFirst ? {transactionalEmailResend:true} : {contactFormWeb3Forms:contactSettings});
    let outcome = await contactOperation(repo,"add",emailFirst?contactCapability:capability,emailFirst?contactSettings:undefined);
    assert.equal(outcome.result.ok,true,JSON.stringify(outcome));
    let project=core.parseProjectYaml(decoder.decode(repo.files.get(".egeria/project.yaml"))).value;
    assert.deepEqual(project.capabilitySettings[contactCapability],contactSettings);
    assert.ok(project.selectedCapabilities.includes(capability));
    for(const subject of emailFirst?[contactCapability,capability]:[capability,contactCapability]) {
      outcome=await contactOperation(repo,"remove",subject);
      assert.equal(outcome.result.ok,true,JSON.stringify(outcome));
    }
    project=core.parseProjectYaml(decoder.decode(repo.files.get(".egeria/project.yaml"))).value;
    assert.ok(project.selectedCapabilities.includes("app-foundation"));
    assert.equal(project.selectedCapabilities.includes(capability),false);
    outcome=await contactOperation(repo,"add",contactCapability,contactSettings);
    assert.equal(outcome.result.ok,true,JSON.stringify(outcome));
    outcome=await contactOperation(repo,"remove");
    assert.equal(outcome.result.ok,true,JSON.stringify(outcome));
    const state=core.parseStateJson(decoder.decode(repo.files.get(".egeria/state.json"))).value;
    assert.equal(state.installedCapabilities.find(c=>c.identifier==="app-foundation").version,"0.2.0");
    assert.equal(state.installedCapabilities.some(c=>c.identifier===capability),false);
  }
});

test("contact without foundation uses ordinary verification and binds settings before mutation", async()=>{
  const repo=await repository();
  const planned=await core.planCapabilityAddition({reader:repo.reader,git,capability:contactCapability,settings:contactSettings});
  assert.equal(planned.ok,true,JSON.stringify(planned));
  const refused=await core.applyCapabilityAddition({root,capability:contactCapability,settings:{...contactSettings,accessKey:"00000000-0000-4000-8000-000000000002"},approvedPlanFingerprint:planned.value.planFingerprint,reader:repo.reader,writer:repo.writer,inspectWorktree:async()=>git,inspectCreateTargets:async()=>({ok:true})});
  assert.equal(refused.ok,false);assert.deepEqual(repo.writes,[]);
  const added=await contactOperation(repo,"add",contactCapability,contactSettings,core.ordinaryGenerationVerificationChecks);
  assert.equal(added.result.ok,true,JSON.stringify(added));
  const state=core.parseStateJson(decoder.decode(repo.files.get(".egeria/state.json"))).value;
  assert.equal(state.installedCapabilities.some(c=>c.identifier==="app-foundation"),false);
  assert.equal(state.lastSuccessfulVerification.checks.includes("worker-integration"),false);
  const removed=await contactOperation(repo,"remove",contactCapability,undefined,core.ordinaryGenerationVerificationChecks);
  assert.equal(removed.result.ok,true,JSON.stringify(removed));
  assert.ok(removed.planned.reviewRequirements.some(r=>r.code==="review-contact-provider-and-retained-data-disposition"));
  const repeated=await core.planCapabilityRemoval({reader:repo.reader,git,capability:contactCapability,inspectRepositoryInventory:repo.inventory});
  assert.equal(repeated.ok,false);assert.equal(repeated.issues[0].code,"CAPABILITY_NOT_INSTALLED");
});

test("contact composes with each public integration and restores the exact layout", async () => {
  const integrations = [
    { capability: "booking-calendly", settings: { destination: "https://calendly.com/example/intro", mode: "popup" }, request: "bookingCalendly" },
    { capability: "multilingual", settings: undefined, request: "multilingual" },
    { capability: "analytics", settings: { consent: {policy:"explicit-opt-in"}, providers:{cloudflareWebAnalytics:{siteToken:"0123456789abcdef0123456789abcdef"}}, operationalIntegrations:{} }, request: "analytics" },
  ];
  for (const integration of integrations) for (const contactFirst of [false, true]) {
    const repo = await repository("site", contactFirst ? {contactFormWeb3Forms:contactSettings} : {[integration.request]:integration.settings ?? true});
    const layout = repo.files.get("apps/web/app/layout.tsx");
    const subject = contactFirst ? integration.capability : contactCapability;
    const settings = contactFirst ? integration.settings : contactSettings;
    const added=await contactOperation(repo,"add",subject,settings,core.ordinaryGenerationVerificationChecks);
    assert.equal(added.result.ok,true,JSON.stringify(added));
    const project=core.parseProjectYaml(decoder.decode(repo.files.get(".egeria/project.yaml"))).value;
    assert.deepEqual(project.capabilitySettings[contactCapability],contactSettings);
    assert.ok(project.selectedCapabilities.includes(integration.capability));
    const removed=await contactOperation(repo,"remove",subject,undefined,core.ordinaryGenerationVerificationChecks);
    assert.equal(removed.result.ok,true,JSON.stringify(removed));
    assert.deepEqual(repo.files.get("apps/web/app/layout.tsx"),layout);
  }
});

test("contact preserves persistence binding verification and rejects a missing binding receipt", async()=>{
  const repo=await repository("app",{applicationPersistence:true,transactionalEmailResend:true});
  const original=repo.files.get(".egeria/state.json");
  const outcome=await contactOperation(repo,"add",contactCapability,contactSettings,core.appGenerationVerificationChecks);
  assert.equal(outcome.result.ok,false);assert.equal(outcome.result.phase,"verify");
  assert.deepEqual(repo.files.get(".egeria/state.json"),original);
  assert.equal(decoder.decode(repo.files.get(".egeria/migrations.jsonl")),"");
  const valid=await repository("app",{applicationPersistence:true,transactionalEmailResend:true});
  for(const operation of ["add","remove"]) {
    const result=await contactOperation(valid,operation,contactCapability,operation==="add"?contactSettings:undefined,core.persistenceGenerationVerificationChecks);
    assert.equal(result.result.ok,true,JSON.stringify(result));
    const project=core.parseProjectYaml(decoder.decode(valid.files.get(".egeria/project.yaml"))).value;
    assert.ok(project.selectedCapabilities.includes("application-persistence"));assert.ok(project.selectedCapabilities.includes(capability));
  }
});

test("contact removal preserves edited copy and refuses surviving imports", async()=>{
  const repo=await repository("portfolio",{contactFormWeb3Forms:contactSettings});
  const consumer="apps/web/src/contact-consumer.ts";
  repo.files.set(consumer,encoder.encode('import { submitContact } from "./integrations/contact-form-web3forms/submit-contact";\n'));
  const refused=await core.planCapabilityRemoval({reader:repo.reader,git,capability:contactCapability,inspectRepositoryInventory:repo.inventory});
  assert.equal(refused.ok,false);assert.equal(refused.issues[0].code,"CAPABILITY_REMOVAL_REFERENCE_CONFLICT");
  repo.files.delete(consumer);
  const copy="apps/web/content/en-CA/contact-form-web3forms.yaml";
  const changed=encoder.encode(decoder.decode(repo.files.get(copy)).replace("Send a message","Contact the team"));repo.files.set(copy,changed);
  const removed=await contactOperation(repo,"remove",contactCapability,undefined,core.ordinaryGenerationVerificationChecks);
  assert.equal(removed.result.ok,true,JSON.stringify(removed));assert.deepEqual(repo.files.get(copy),changed);
  const project=core.parseProjectYaml(decoder.decode(repo.files.get(".egeria/project.yaml"))).value;
  assert.ok(project.ejectedAreas.includes(copy));
  const blocked=await core.planCapabilityAddition({reader:repo.reader,git,capability:contactCapability,settings:contactSettings});
  assert.equal(blocked.ok,false);
});


test("contact refuses transitions and preserves controls after an interrupted write",async()=>{
  const installed=await repository("portfolio",{contactFormWeb3Forms:contactSettings});
  for(const toProfile of ["site","app"]) {
    const result=await core.planProfileTransition({reader:installed.reader,git,toProfile});
    assert.equal(result.ok,false);assert.equal(result.issues[0].code,"PROFILE_TRANSITION_UNSUPPORTED");
  }
  const repo=await repository();const state=repo.files.get(".egeria/state.json");
  const outcome=await contactOperation(repo,"add",contactCapability,contactSettings,core.ordinaryGenerationVerificationChecks,{
    writer:{async write(changes){const first=changes[0];repo.files.set(first.path,first.content);return {ok:false,sourceChanged:true};}},
  });
  assert.equal(outcome.result.ok,false);assert.equal(outcome.result.recovery,"inspect-worktree");
  assert.deepEqual(repo.files.get(".egeria/state.json"),state);assert.equal(decoder.decode(repo.files.get(".egeria/migrations.jsonl")),"");
});


test("jobs-bearing repositories refuse incidental addition and removal without changing source or state", async () => {
  const repo = await repository("portfolio", { backgroundJobDelivery: true, transactionalEmailResend: true });
  const before = new Map(repo.files);
  const snapshot = await readVerifiedProjectSnapshot(repo.reader);
  assert.equal(snapshot.ok, true, JSON.stringify(snapshot));
  const inspection = await inspectProject({ reader: repo.reader, catalog: snapshot.value.catalog, profiles: snapshot.value.profiles });
  assert.equal(inspection.project.kind, "valid", JSON.stringify(inspection.project));
  assert.equal(inspection.inference.state.kind, "valid", JSON.stringify(inspection.inference.state));
  assert.equal(inspection.resolution?.ok, true, JSON.stringify(inspection.resolution));
  const add = await core.planCapabilityAddition({ reader: repo.reader, git, capability: "multilingual" });
  assert.equal(add.ok, false);
  assert.equal(add.issues[0].code, "CAPABILITY_ADDITION_UNSUPPORTED");
  const remove = await core.planCapabilityRemoval({ reader: repo.reader, git, capability, inspectRepositoryInventory: repo.inventory });
  assert.equal(remove.ok, false);
  assert.equal(remove.issues[0].code, "CAPABILITY_REMOVAL_UNSUPPORTED");
  assert.deepEqual(repo.files, before);
  assert.deepEqual(repo.writes, []);
});


test("jobs repositories refuse profile transitions and unsupported upgrades before writes", async () => {
  const repo = await repository("portfolio", { backgroundJobDelivery: true });
  const before = new Map(repo.files);
  for (const toProfile of ["site", "app"]) {
    const result = await core.planProfileTransition({ reader: repo.reader, git, toProfile });
    assert.equal(result.ok, false, JSON.stringify(result));
  }
  for (const selectedCapability of ["background-job-delivery", "standards"]) {
    const result = await core.planCapabilityUpgrade({ reader: repo.reader, git, capability: selectedCapability, toVersion: "0.4.0" });
    assert.equal(result.ok, false, JSON.stringify(result));
  }
  assert.deepEqual(repo.files, before);
  assert.deepEqual(repo.writes, []);
});
