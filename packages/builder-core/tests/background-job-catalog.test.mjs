import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { renderSkeleton } from "../dist/generation/render-skeleton.js";
import { resolveRecipeLockfileVersion } from "../dist/generation/recipe-lockfiles.js";
import { verifiedCapabilityPackageVersions } from "../dist/catalog/verified-package-versions.js";

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
      delete config.env.production.queues.consumers[0].dead_letter_queue;
      await writeFile(join(root, "apps/web/wrangler.jsonc"), JSON.stringify(config));
      assert.throws(() => invoke("production", "true"), { status: 1 });
      const workflow = new TextDecoder().decode(result.value.files.find(({ path }) => path === ".github/workflows/deploy.yml").content);
      assert.match(workflow, /job_retention_reviewed:\n\s+description:.*24-hour.*\n\s+required: true\n\s+type: boolean\n\s+default: false/u);
      assert.match(workflow, /JOB_RETENTION_REVIEWED: \$\{\{ inputs\.job_retention_reviewed \}\}/u);
    } finally { await rm(root, { recursive: true, force: true }); }
  }
});
