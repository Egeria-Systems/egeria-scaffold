import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApplicationEnvironmentRenderingContext, createFileSystemRepositoryReader, createPnpmGeneratedProjectVerifier, generateProject, inferRepository, readVerifiedProjectSnapshot } from "../dist/index.js";

for (const [profile, selection] of [
  ["portfolio", {}],
  ["site", { transactionalEmailResend: true }],
  ["app", { applicationPersistence: true }],
]) {
  test(`${profile} jobs generation verifies its actual runtime before persisting confirmed state`, async () => {
    const owner = await mkdtemp(join(tmpdir(), "egeria-jobs-generation-"));
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
    } finally { await rm(owner, { recursive: true, force: true }); }
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
    const renderingContext = createApplicationEnvironmentRenderingContext(selection.applicationPersistence === true, false, true);
    const result = await generateProject({
      request: { profile, projectName: `jobs-${profile}`, displayName: `Jobs ${profile}`, backgroundJobDelivery: true, ...selection },
      destination: join(owner, "project"), renderingContext,
      verifier: createPnpmGeneratedProjectVerifier({ pnpmExecutable: "pnpm" }),
    });
    assert.equal(result.ok, true, JSON.stringify(result));
    const versions = Object.fromEntries(result.value.state.installedCapabilities.map(({ identifier, version }) => [identifier, version]));
    assert.equal(versions["background-job-delivery"], "0.3.0");
    assert.equal(versions["app-foundation"], "0.3.0");
    assert.equal(versions["application-persistence"], selection.applicationPersistence ? "0.2.0" : undefined);
    assert.equal(versions["transactional-email-resend"], selection.transactionalEmailResend ? "0.2.0" : undefined);
    const { verifyApplicationEnvironmentProject } = await import("../../../scripts/verify-generated-skeletons.mjs");
    let verification;
    try {
      verification = await verifyApplicationEnvironmentProject(result.value.destination);
    } catch (error) {
      if (error.verificationFailure !== undefined) context.diagnostic(JSON.stringify(error.verificationFailure));
      throw error;
    }
    assert.deepEqual(verification.targets.map(({ target }) => target), ["development", "staging", "production"]);
    await writeFile(join(owner, "prepared-target-evidence.json"), JSON.stringify(verification, null, 2));
  });
}
