import assert from "node:assert/strict";
import test from "node:test";
import { parseDocument } from "yaml";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { renderSkeleton } from "../dist/generation/render-skeleton.js";
import { resolveRecipeLockfileVersion } from "../dist/generation/recipe-lockfiles.js";
import { createGenerationRenderingContext, verifiedCapabilityPackageVersions } from "../dist/catalog/verified-package-versions.js";


import { createCapabilityCatalogSnapshot } from "../dist/catalog/capability-catalog.js";
import { createApplicationEnvironmentRenderingContext, isApplicationEnvironmentRenderingContext } from "../dist/catalog/verified-package-versions.js";

const request = (profile, extra = {}) => ({ profile, projectName: "jobs-example", displayName: "Jobs example", packageVersions: verifiedCapabilityPackageVersions, ...extra });

const excludedOperatorFiles = ["apps/web/scripts/job-operator.mjs", "apps/web/src/infrastructure/cloudflare/job-operations.ts", "apps/web/tests/unit/job-operations.test.ts"];

test("application environment catalog admits exactly the retained and fresh deployment compositions", () => {
  for (const [persistence, jobs, standards, predecessor, successor] of [
    [false, false, "0.9.0", "0.9.0", "0.13.0"],
    [true, false, "0.10.0", "0.10.0", "0.14.0"],
    [false, true, "0.9.0", "0.11.0", "0.15.0"],
    [true, true, "0.10.0", "0.12.0", "0.16.0"],
  ]) for (const [retained, deployment] of [[true, predecessor], [false, successor]]) {
    const context = createApplicationEnvironmentRenderingContext(persistence, false, jobs, undefined, undefined, retained);
    assert.equal(isApplicationEnvironmentRenderingContext(context), true);
    assert.equal(context.catalogSnapshot.standards, standards);
    assert.equal(context.catalogSnapshot.deploymentCloudflare, deployment);
    assert.equal(context.catalogSnapshot.siteRouting, "0.5.0");
    assert.equal(context.catalogSnapshot.backgroundJobDelivery, jobs ? "0.3.0" : undefined);
    const result = createCapabilityCatalogSnapshot(verifiedCapabilityPackageVersions, context.catalogSnapshot);
    assert.equal(result.ok, true, JSON.stringify(result));
    const descriptor = result.value.find(({ identifier }) => identifier === "background-job-delivery");
    assert.equal(descriptor?.version, jobs ? "0.3.0" : undefined);
    if (jobs) {
      assert.deepEqual(descriptor.migrationPlanners, []);
      assert.deepEqual(descriptor.privilegedOperations, ["dispatch-background-job", "consume-background-job"]);
      for (const path of excludedOperatorFiles) {
        assert.equal(descriptor.managedSurfaces.some(surface => surface.path === path), false, path);
      }
      for (const check of ["bounded-replay-and-drain", "uncertain-acknowledgement-resumption"]) {
        assert.equal(descriptor.verificationPlan.includes(check), false, check);
      }
      assert.ok(descriptor.removalAndRecoveryRequirements.includes("unsupported-lifecycle-refusal"));
    }
    for (const changed of [
      { standards: persistence ? "0.9.0" : "0.10.0" },
      { deploymentCloudflare: jobs ? "0.13.0" : "0.15.0" },
      { siteRouting: "0.4.0" },
      { backgroundJobDelivery: jobs ? "0.2.0" : "0.3.0" },
    ]) {
      const mixed = { ...context, catalogSnapshot: { ...context.catalogSnapshot, ...changed } };
      assert.equal(isApplicationEnvironmentRenderingContext(mixed), false, JSON.stringify(changed));
      assert.equal(createCapabilityCatalogSnapshot(verifiedCapabilityPackageVersions, mixed.catalogSnapshot).ok, false, JSON.stringify(changed));
    }
  }
});

test("optional jobs preserves current profile recipes and installs no implicit persistence", async () => {
  for (const profile of ["portfolio", "site", "app"]) {
    const result = await renderSkeleton(request(profile, { backgroundJobDelivery: true }));
    assert.equal(result.ok, true, JSON.stringify(result));
    const { project, resolved, files } = result.value;
    assert.ok(project.selectedCapabilities.includes("background-job-delivery"));
    assert.equal(project.originProfile, profile);
    assert.equal(project.selectedCapabilities.includes("application-persistence"), false);
    assert.equal(project.selectedCapabilities.includes("transactional-email-resend"), false);
    assert.equal(resolved.capabilities.find(({identifier}) => identifier === "app-foundation").version, "0.3.0");
    assert.ok(files.some(({path}) => path === "apps/web/src/application/job-delivery.ts"));
    const manifest = JSON.parse(new TextDecoder().decode(files.find(({path}) => path === "apps/web/package.json").content));
    assert.ok(resolveRecipeLockfileVersion(project, manifest));
    const config = JSON.parse(new TextDecoder().decode(files.find(({path}) => path === "apps/web/wrangler.jsonc").content));
    assert.equal(config.main, "worker.mjs");
    assert.equal(config.queues.consumers.length, 1);
    assert.ok(config.queues.consumers[0].dead_letter_queue);
    assert.notEqual(config.env.staging.queues.consumers[0].queue, config.env.production.queues.consumers[0].queue);
    assert.equal(files.some(({path}) => path.startsWith("apps/jobs/")), false);
  }
});

test("application environment jobs render matching manifests and independent service selections", async () => {
  for (const profile of ["portfolio", "site", "app"]) {
    for (const persistence of profile === "app" ? [false, true] : [false]) {
      for (const email of [false, true]) {
        const context = createApplicationEnvironmentRenderingContext(persistence, false, true);
        const result = await renderSkeleton(request(profile, {
          backgroundJobDelivery: true,
          ...(persistence ? { applicationPersistence: true } : {}),
          ...(email ? { transactionalEmailResend: true } : {}),
        }), context);
        assert.equal(result.ok, true, JSON.stringify(result));
        const { project, resolved, files } = result.value;
        assert.equal(project.schemaVersion, "2.0.0");
        assert.equal(project.selectedCapabilities.includes("application-persistence"), persistence);
        assert.equal(project.selectedCapabilities.includes("transactional-email-resend"), email);
        assert.equal(resolved.capabilities.find(({ identifier }) => identifier === "background-job-delivery").version, "0.3.0");
        assert.equal(resolved.capabilities.find(({ identifier }) => identifier === "app-foundation").version, "0.3.0");
        const generated = new Map(files.map(({ path, content }) => [path, new TextDecoder().decode(content)]));
        const manifest = JSON.parse(generated.get("apps/web/package.json"));
        assert.ok(resolveRecipeLockfileVersion(project, manifest));
        for (const path of excludedOperatorFiles) {
          assert.equal(generated.has(path), false, path);
        }
        assert.match(generated.get("apps/web/worker.mjs"), /\.open-next\/assets\/BUILD_ID/u);
        assert.equal(new Set(files.map(({ path }) => path)).size, files.length);
        const wrangler = JSON.parse(generated.get("apps/web/wrangler.jsonc"));
        assert.equal(wrangler.main, "worker.mjs");
        assert.equal(wrangler.vars.APPLICATION_ENVIRONMENT, "development");
        for (const target of ["staging", "production"]) {
          assert.equal(wrangler.env[target].vars.APPLICATION_ENVIRONMENT, target);
          assert.equal(wrangler.env[target].vars.JOB_ENVIRONMENT, target);
        }
      }
    }
  }
});

test("jobs remains absent from default recipes", async () => {
  for (const profile of ["portfolio", "site", "app"]) {
    const result = await renderSkeleton(request(profile));
    assert.equal(result.ok, true);
    assert.equal(result.value.project.selectedCapabilities.includes("background-job-delivery"), false);
    assert.equal(result.value.files.some(({path}) => path === "apps/web/worker.mjs"), false);
  }
});


test("jobs and persistence share the selected Worker entry without weakening database preflight", async () => {
  const result = await renderSkeleton(request("app", { backgroundJobDelivery: true, applicationPersistence: true }));
  assert.equal(result.ok, true, JSON.stringify(result));
  const root = await mkdtemp(join(tmpdir(), "jobs-database-preflight-"));
  try {
    for (const file of result.value.files.filter(({path})=>["apps/web/wrangler.jsonc","apps/web/scripts/check-application-database.mjs","apps/web/src/configuration/application-environment.ts","apps/web/src/configuration/application-database.ts"].includes(path))) {
      const destination = join(root, file.path); await mkdir(dirname(destination), {recursive:true}); await writeFile(destination,file.content);
    }
    const output = execFileSync(process.execPath, ["scripts/check-application-database.mjs", "local"], { cwd: join(root,"apps/web"),encoding:"utf8" });
    assert.equal(JSON.parse(output).ok,true);
  } finally { await rm(root,{recursive:true,force:true}); }
});


test("remote jobs preflight requires explicit review of the Free-tier retention contract", async () => {
  for (const selection of [{}, { applicationPersistence: true }]) {
    const result = await renderSkeleton(request("app", { backgroundJobDelivery: true, ...selection }));
    assert.equal(result.ok, true, JSON.stringify(result));
    const root = await mkdtemp(join(tmpdir(), "jobs-retention-preflight-"));
    try {
      const selectedFiles = result.value.files.filter(({ path }) => ["apps/web/wrangler.jsonc", "apps/web/scripts/check-job-delivery.mjs"].includes(path));
      for (const file of selectedFiles) {
        const destination = join(root, file.path);
        await mkdir(dirname(destination), { recursive: true });
        await writeFile(destination, file.content);
      }
      const invoke = (environment, reviewed) => execFileSync(process.execPath, ["scripts/check-job-delivery.mjs", environment], {
        cwd: join(root, "apps/web"), encoding: "utf8", stdio: "pipe", env: { APPLICATION_ENVIRONMENT: environment === "local" ? "development" : environment, JOB_RETENTION_REVIEWED: reviewed },
      });
      assert.equal(invoke("local", ""), "JOB_CONFIGURATION_VALID\n");
      for (const environment of ["staging", "production"]) {
        for (const reviewed of ["", "false", "86400", "yes"]) assert.throws(() => invoke(environment, reviewed), { status: 1 });
        assert.equal(invoke(environment, "true"), "JOB_CONFIGURATION_VALID\n");
      }
      const configFile = selectedFiles.find(({ path }) => path.endsWith("wrangler.jsonc"));
      const config = JSON.parse(new TextDecoder().decode(configFile.content));
      for (const binding of ["JOB_QUEUE", "JOB_DEAD_LETTER_QUEUE"]) {
        for (const identity of ["a", "a".repeat(63), "a".repeat(64), "jobs-", "-jobs"]) {
          const candidate = structuredClone(config);
          const production = candidate.env.production;
          production.vars[binding === "JOB_QUEUE" ? "JOB_QUEUE_NAME" : "JOB_DEAD_LETTER_QUEUE_NAME"] = identity;
          production.queues.producers.find((item) => item.binding === binding).queue = identity;
          production.queues.consumers[0][binding === "JOB_QUEUE" ? "queue" : "dead_letter_queue"] = identity;
          await writeFile(join(root, "apps/web/wrangler.jsonc"), JSON.stringify(candidate));
          if ([1, 63].includes(identity.length)) assert.equal(invoke("production", "true"), "JOB_CONFIGURATION_VALID\n");
          else assert.throws(() => invoke("production", "true"), { status: 1 });
        }
      }
      delete config.env.production.queues.consumers[0].dead_letter_queue;
      await writeFile(join(root, "apps/web/wrangler.jsonc"), JSON.stringify(config));
      assert.throws(() => invoke("production", "true"), { status: 1 });
      const workflow = new TextDecoder().decode(result.value.files.find(({ path }) => path === ".github/workflows/deploy.yml").content);
      const deployment = parseDocument(workflow).toJS();
      for (const target of ["staging", "production"]) {
        const input = deployment.on.workflow_dispatch.inputs[`${target}_job_retention_reviewed`];
        assert.deepEqual({ required: input.required, type: input.type, default: input.default }, { required: true, type: "boolean", default: false });
        assert.match(input.description, /86400-second retention/u);
        assert.equal(deployment.jobs[target].env.JOB_RETENTION_REVIEWED, "${{ inputs." + target + "_job_retention_reviewed }}");
      }
    } finally { await rm(root, { recursive: true, force: true }); }
  }
});


test("default jobs generation omits credentialed operator tools", async () => {
  for (const profile of ["portfolio", "site", "app"]) {
    const result = await renderSkeleton(request(profile, { backgroundJobDelivery: true }));
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.value.resolved.capabilities.find(({ identifier }) => identifier === "background-job-delivery").version, "0.3.0");
    for (const path of excludedOperatorFiles) {
      assert.equal(result.value.files.some(file => file.path === path), false, path);
    }
  }
});

test("jobs generation refuses retired jobs contexts", async () => {
  for (const profile of ["portfolio", "site", "app"]) {
    for (const version of ["0.1.0", "0.2.0"]) {
      const context = createGenerationRenderingContext(false, false, true);
      const result = await renderSkeleton(request(profile, { backgroundJobDelivery: true }), {
        ...context, catalogSnapshot: { ...context.catalogSnapshot, backgroundJobDelivery: version },
      });
      assert.equal(result.ok, false);
      assert.equal(Object.hasOwn(result, "value"), false);
    }
  }
});

test("jobs catalog rejects mixed and unknown current tuples", () => {
  for (const persistence of [false, true]) {
    const snapshot = createGenerationRenderingContext(persistence, false, true).catalogSnapshot;
    assert.equal(createCapabilityCatalogSnapshot(verifiedCapabilityPackageVersions, snapshot).ok, true);
    for (const changed of [
      { backgroundJobDelivery: "0.1.0" }, { backgroundJobDelivery: "0.2.0" },
      { deploymentCloudflare: "0.3.0" }, { deploymentCloudflare: "0.6.0" },
      { deploymentCloudflare: "0.3.1" }, { deploymentCloudflare: "0.6.1" },
      { appFoundation: "0.1.0" }, { standards: "0.4.0" }, { siteRouting: "0.3.0" },
      { applicationPersistence: "0.1.1" },
    ]) assert.equal(createCapabilityCatalogSnapshot(verifiedCapabilityPackageVersions, { ...snapshot, ...changed }).ok, false, JSON.stringify(changed));
  }
});

test("current jobs owns event composition independently of optional service selection", async () => {
  for (const email of [false, true]) {
    const result = await renderSkeleton(request("site", { backgroundJobDelivery: true, ...(email ? { transactionalEmailResend: true } : {}) }));
    assert.equal(result.ok, true, JSON.stringify(result));
    const generated = new Map(result.value.files.map(({ path, content }) => [path, new TextDecoder().decode(content)]));
    const descriptor = result.value.resolved.capabilities.find(({ identifier }) => identifier === "background-job-delivery");
    for (const [path, ownership] of [["apps/web/src/composition/job-handler-composition.ts", "application-owned"], ["apps/web/tests/unit/job-handler-composition.test.ts", "managed"]]) {
      assert.equal(descriptor.managedSurfaces.find(surface => surface.path === path)?.ownership, ownership);
      assert.ok(generated.has(path));
    }
    const hook = generated.get("apps/web/src/composition/job-handler-composition.ts");
    assert.match(hook, /typeof jobHandlers/u);
    assert.doesNotMatch(hook, /transactional-email|resend|application-persistence|getCloudflareContext/u);
    assert.match(generated.get("apps/web/src/composition/server-jobs.ts"), /await import\("@\/src\/composition\/job-handler-composition"\)/u);
    assert.equal(generated.has("apps/web/src/infrastructure/resend/transactional-email-sender.ts"), email);
  }
});
