import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createFileSystemRepositoryReader, createPnpmGeneratedProjectVerifier, generateProject, inferRepository, readVerifiedProjectSnapshot } from "../dist/index.js";

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
