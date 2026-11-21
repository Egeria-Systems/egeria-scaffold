import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { derivePnpmToolEnvironment } from "../dist/generation/verify-generated-project.js";
import { createApplicationEnvironmentRenderingContext, createFileSystemRepositoryReader, createPnpmGeneratedProjectVerifier, generateProject, inferRepository, readVerifiedProjectSnapshot } from "../dist/index.js";
import { assertCompositionSourcePreserved, createJobCompositionFixture, createEmailOnlyFixture, verifyEmailOnlyFixture } from "./helpers/job-composition-fixture.mjs";

const runFile = promisify(execFile);

async function verifyLocalQueuePreparation(source, owner) {
  const root = join(owner, "local-preparation");
  await cp(source, root, { recursive: true, errorOnExist: true, force: false });
  const web = join(root, "apps/web");
  const home = join(owner, "preparation-home");
  await mkdir(home, { mode: 0o700 });
  const path = process.env.PATH;
  const environment = {
    PATH: path,
    ...await derivePnpmToolEnvironment("pnpm", { environment: { PATH: path } }),
    HOME: home,
    XDG_CONFIG_HOME: home,
    CI: "1",
    NEXT_TELEMETRY_DISABLED: "1",
    npm_config_registry: "https://registry.npmjs.org/",
    APPLICATION_ENVIRONMENT: "development",
  };
  const command = (arguments_, extra = {}) => runFile("pnpm", arguments_, {
    cwd: root, env: { ...environment, ...extra }, encoding: "utf8", maxBuffer: 1024 * 1024, timeout: 240_000,
  });
  await command(["install", "--frozen-lockfile", "--store-dir", join(owner, "preparation-store")]);
  await command(["--dir", "apps/web", "run", "cf-typegen"]);
  await command(["run", "typecheck"]);
  await access(join(web, ".next/types/routes.d.ts"));
  const artifact = join(web, ".open-next/assets/BUILD_ID");
  for (const args of [["run", "build"], ["run", "build:cloudflare"], ["--dir", "apps/web", "run", "preview"], ["run", "verify"]]) {
    for (const [reason, extra] of [["missing", {}], ["invalid", { BUILD_SOURCE_REVISION: "synthetic-invalid-revision" }]]) {
      await assert.rejects(command(args, extra), error => {
        assert.equal(error.code, 1, args.join(" "));
        assert.match(error.stdout + error.stderr, new RegExp(`APPLICATION_BUILD_INVALID:BUILD_SOURCE_REVISION:${reason}`, "u"));
        assert.doesNotMatch(error.stdout + error.stderr, /synthetic-invalid-revision/u);
        return true;
      });
      await assert.rejects(access(join(web, ".next/BUILD_ID")), { code: "ENOENT" });
      await assert.rejects(access(artifact), { code: "ENOENT" });
    }
  }
  const fileRevision = "a".repeat(40);
  await writeFile(join(web, ".env.local"), `BUILD_SOURCE_REVISION=${fileRevision}\n`, { flag: "wx", mode: 0o600 });
  await command(["run", "build"]);
  await command(["--dir", "apps/web", "exec", "opennextjs-cloudflare", "build", "--skipNextBuild"]);
  assert.equal(await readFile(artifact, "utf8"), `egeria-development-${fileRevision}`);
  await command(["--dir", "apps/web", "exec", "wrangler", "deploy", "--dry-run", "--outdir", ".open-next/jobs-bundle",
    "--metafile", ".open-next/jobs-inputs.json", "--x-provision=false", "--x-auto-create=false"]);
  await command(["--dir", "apps/web", "exec", "vitest", "run", "--config", "vitest.cloudflare.config.ts",
    "tests/integration/job-worker.test.ts", "-t", "keeps actual built HTTP|late recognized foreign target"]);
  const explicitRevision = "b".repeat(40);
  await command(["run", "build"], { BUILD_SOURCE_REVISION: explicitRevision });
  assert.equal(await readFile(join(web, ".next/BUILD_ID"), "utf8"), `egeria-development-${explicitRevision}`);
}

for (const [profile, selection] of [
  ["portfolio", {}],
  ["site", { transactionalEmailResend: true }],
  ["app", { applicationPersistence: true }],
]) {
  test(`${profile} jobs generation verifies its actual runtime before persisting confirmed state`, async context => {
    const owner = await mkdtemp(join(tmpdir(), "egeria-jobs-generation-"));
    let verified = false;
    try {
      const result = await generateProject({
        request: { profile, projectName: `jobs-${profile}`, displayName: `Jobs ${profile}`, backgroundJobDelivery: true, ...selection },
        destination: join(owner, "project"),
        verifier: createPnpmGeneratedProjectVerifier({ pnpmExecutable: "pnpm" }),
      });
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.ok(result.value.state.lastSuccessfulVerification.checks.includes("worker-integration"));
      const reader = createFileSystemRepositoryReader(result.value.destination);
      const snapshot = await readVerifiedProjectSnapshot(reader);
      assert.equal(snapshot.ok, true, JSON.stringify(snapshot));
      const inference = await inferRepository({ reader: snapshot.value.reader, catalog: snapshot.value.catalog });
      assert.equal(inference.state.kind, "valid");
      assert.ok(inference.capabilities.every(({ category }) => category === "confirmed"), JSON.stringify(inference.capabilities));
      assert.ok(inference.surfaces.every(({ status }) => ["confirmed", "application-owned"].includes(status)), JSON.stringify(inference.surfaces.filter(({status})=>!["confirmed","application-owned"].includes(status))));
      assert.equal(result.value.state.installedCapabilities.some(({identifier})=>identifier==="application-persistence"), profile === "app");
      if (profile === "portfolio") await verifyLocalQueuePreparation(result.value.destination, owner);
      verified = true;
    } finally {
      if (verified) await rm(owner, { recursive: true, force: true });
      else context.diagnostic(`Retained failed jobs generation owner: ${owner}`);
    }
  });
}


for (const [profile, selection] of [
  ["portfolio", {}],
  ["site", { transactionalEmailResend: true, multilingual: true }],
  ["app", { applicationPersistence: true }],
  ["app", { applicationPersistence: true, transactionalEmailResend: true }],
]) {
  test(`${profile} environment jobs prepare all targets with independent selected services ${JSON.stringify(selection)}`, { timeout: 90 * 60 * 1000 }, async context => {
    const owner = await mkdtemp(join(tmpdir(), "egeria-environment-jobs-generation-"));
    context.diagnostic(`Retained environment jobs owner: ${owner}`);
    const renderingContext = createApplicationEnvironmentRenderingContext(selection.applicationPersistence === true, false, true);
    const result = await generateProject({
      request: { profile, projectName: `jobs-${profile}`, displayName: `Jobs ${profile}`, backgroundJobDelivery: true, ...selection },
      destination: join(owner, "project"), renderingContext,
      verifier: createPnpmGeneratedProjectVerifier({ pnpmExecutable: "pnpm" }),
    });
    assert.equal(result.ok, true, JSON.stringify(result));
    const versions = Object.fromEntries(result.value.state.installedCapabilities.map(({ identifier, version }) => [identifier, version]));
    assert.equal(versions["background-job-delivery"], "0.4.0");
    assert.equal(versions["app-foundation"], "0.3.0");
    assert.equal(versions["application-persistence"], selection.applicationPersistence ? "0.2.0" : undefined);
    assert.equal(versions["transactional-email-resend"], selection.transactionalEmailResend ? "0.2.0" : undefined);
    // The generation receipt belongs to the unchanged generated source. The
    // application-owned extension is authored before its own prepared builds.
    const fixture = await createJobCompositionFixture({ generatedRoot: result.value.destination, parent: owner, selection });
    const { verifyApplicationEnvironmentProject } = await import("../../../scripts/verify-generated-skeletons.mjs");
    let verification;
    try {
      verification = await verifyApplicationEnvironmentProject(fixture.root);
    } catch (error) {
      if (error.verificationFailure !== undefined) context.diagnostic(JSON.stringify(error.verificationFailure));
      throw error;
    }
    assert.deepEqual(verification.targets.map(({ target }) => target), ["development", "staging", "production"]);
    await assertCompositionSourcePreserved(fixture);
    await writeFile(join(owner, "prepared-target-evidence.json"), JSON.stringify(verification, null, 2));
  });
}

test("independent email-only site verifies its actual HTTP sender without jobs or persistence", { timeout: 30 * 60 * 1000 }, async context => {
  const owner = await mkdtemp(join(tmpdir(), "egeria-email-only-generation-"));
  context.diagnostic(`Retained independent email owner: ${owner}`);
  const result = await generateProject({
    request: { profile: "site", projectName: "independent-email", displayName: "Independent Email", transactionalEmailResend: true },
    destination: join(owner, "project"),
    verifier: createPnpmGeneratedProjectVerifier({ pnpmExecutable: "pnpm" }),
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.ok(result.value.state.lastSuccessfulVerification.checks.includes("worker-integration"));
  const fixture = await createEmailOnlyFixture({ generatedRoot: result.value.destination, parent: owner });
  const verification = await verifyEmailOnlyFixture(fixture);
  assert.deepEqual(verification.targets, ["development"]);
  await assertCompositionSourcePreserved(fixture);
  await writeFile(join(owner, "email-only-evidence.json"), JSON.stringify(verification, null, 2));
});
