import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { renderSkeleton } from "../dist/generation/render-skeleton.js";
import { resolveRecipeLockfileVersion } from "../dist/generation/recipe-lockfiles.js";
import { createGenerationRenderingContext, verifiedCapabilityPackageVersions } from "../dist/catalog/verified-package-versions.js";

import { createCapabilityCatalogSnapshot } from "../dist/catalog/capability-catalog.js";

const request = (profile, extra = {}) => ({ profile, projectName: "jobs-example", displayName: "Jobs example", packageVersions: verifiedCapabilityPackageVersions, ...extra });

test("optional jobs preserves current profile recipes and installs no implicit persistence", async () => {
  for (const profile of ["portfolio", "site", "app"]) {
    const result = await renderSkeleton(request(profile, { backgroundJobDelivery: true }));
    assert.equal(result.ok, true, JSON.stringify(result));
    const { project, resolved, files } = result.value;
    assert.ok(project.selectedCapabilities.includes("background-job-delivery"));
    assert.equal(project.originProfile, profile);
    assert.equal(project.selectedCapabilities.includes("application-persistence"), false);
    assert.equal(project.selectedCapabilities.includes("transactional-email-resend"), false);
    assert.equal(resolved.capabilities.find(({identifier}) => identifier === "app-foundation").version, "0.2.0");
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
    for (const file of result.value.files.filter(({path})=>["apps/web/wrangler.jsonc","apps/web/scripts/check-application-database.mjs"].includes(path))) {
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
        cwd: join(root, "apps/web"), encoding: "utf8", stdio: "pipe", env: { JOB_RETENTION_REVIEWED: reviewed },
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
      assert.match(workflow, /job_retention_reviewed:\n\s+description:.*24-hour.*\n\s+required: true\n\s+type: boolean\n\s+default: false/u);
      assert.match(workflow, /JOB_RETENTION_REVIEWED: \$\{\{ inputs\.job_retention_reviewed \}\}/u);
    } finally { await rm(root, { recursive: true, force: true }); }
  }
});


test("new jobs generation materializes the operator capability version", async () => {
  for (const profile of ["portfolio", "site", "app"]) {
    const result = await renderSkeleton(request(profile, { backgroundJobDelivery: true }));
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.value.resolved.capabilities.find(({ identifier }) => identifier === "background-job-delivery").version, "0.2.0");
    for (const path of ["apps/web/scripts/job-operator.mjs", "apps/web/src/infrastructure/cloudflare/job-operations.ts", "apps/web/tests/unit/job-operations.test.ts"]) {
      assert.ok(result.value.files.some((file) => file.path === path), path);
    }
  }
});

test("retained jobs renders its accepted descriptor and exact predecessor bytes", async () => {
  const cases = [
    ["portfolio", false, "e7a18e10c7514562bf0af10f2829bc06b799d36424f2083e80cad43ae9ee753d"],
    ["site", false, "2209d56afbec86b6acb4df7572db811fb1f5968ab727927b780c18cc2b432e97"],
    ["app", false, "2209d56afbec86b6acb4df7572db811fb1f5968ab727927b780c18cc2b432e97"],
    ["app", true, "29c69cfb6947064e82fcb3f0bf22529c8a6f0b1914971edbc64250ace5e91e48"],
  ];
  for (const [profile, persistence, expected] of cases) {
    const context = createGenerationRenderingContext(persistence, true, true, "0.1.0");
    const result = await renderSkeleton(request(profile, { backgroundJobDelivery: true, ...(persistence ? { applicationPersistence: true } : {}) }), context);
    assert.equal(result.ok, true, JSON.stringify(result));
    const bytes = result.value.files.map(({ path, content }) => [path, Buffer.from(content).toString("base64")]);
    assert.equal(createHash("sha256").update(JSON.stringify(bytes)).digest("hex"), expected);
    const catalog = createCapabilityCatalogSnapshot(verifiedCapabilityPackageVersions, context.catalogSnapshot);
    assert.equal(catalog.ok, true);
    const descriptor = catalog.value.find(({ identifier }) => identifier === "background-job-delivery");
    assert.equal(createHash("sha256").update(JSON.stringify(descriptor)).digest("hex"), "1b1cc9768391e6193409b8ea95cd2fd8cfaccf65da86be59b9828c5445a719c4");
  }
});


test("jobs catalog rejects mixed and unknown tuples for both real versions", () => {
  for (const version of ["0.1.0", "0.2.0"]) {
    const snapshot = createGenerationRenderingContext(false, true, true, version).catalogSnapshot;
    assert.equal(createCapabilityCatalogSnapshot(verifiedCapabilityPackageVersions, snapshot).ok, true);
    for (const changed of [
      { backgroundJobDelivery: "0.3.0" }, { deploymentCloudflare: "0.3.0" },
      { deploymentCloudflare: "0.6.0" }, { appFoundation: "0.1.0" },
      { standards: "0.4.0" }, { siteRouting: "0.3.0" },
      { applicationPersistence: "0.1.0" },
    ]) assert.equal(createCapabilityCatalogSnapshot(verifiedCapabilityPackageVersions, { ...snapshot, ...changed }).ok, false, JSON.stringify(changed));
  }
});
