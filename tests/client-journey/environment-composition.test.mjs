import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { inspectGeneratedFixture, verifyApplicationEnvironmentProject } from "../../scripts/verify-generated-skeletons.mjs";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const optionalServers = ["application-persistence", "background-job-delivery", "transactional-email-resend"];

// These are real generated-runtime tests, not source-only tests. Each fixed
// fixture must first be created by the ordinary compiled public CLI verifier.
for (const [identifier, relativeRoot, selected] of [
  ["app", "fixtures/generated/app-0.3.0", []],
  ["portfolio-email", "fixtures/generated/portfolio-email-explicit-target-0.12.0", ["transactional-email-resend"]],
  ["app-jobs", "fixtures/generated/app-jobs-recovery-composition-0.3.0", ["background-job-delivery"]],
  ["app-persistence-jobs-email", "fixtures/generated/app-persistence-jobs-email-recovery-composition-0.3.0", optionalServers],
]) {
  test(`${identifier} preserves independent server effects across all application targets`, { timeout: 90 * 60 * 1000 }, async context => {
    const root = join(repositoryRoot, relativeRoot);
    await inspectGeneratedFixture(root, identifier);
    const state = JSON.parse(await readFile(join(root, ".egeria/state.json"), "utf8"));
    assert.equal(state.schemaVersion, "2.0.0");
    const installed = state.installedCapabilities.map(({ identifier }) => identifier);
    assert.equal(installed.includes("app-foundation"), true);
    assert.deepEqual(installed.filter(identifier => optionalServers.includes(identifier)).sort(), [...selected].sort());

    // Reuse the generated port tests: lazy health acquisition, exact recipient
    // authorization/unknown email acceptance, queue target and durable-failure
    // guards, and (only when selected) real local D1 zero-write/refusal recovery.
    // The verifier runs their owning Vitest and Workers suites in isolated copies.
    const result = await verifyApplicationEnvironmentProject(root);
    assert.equal(result.ok, true);
    assert.equal(result.liveAcceptance, false);
    assert.deepEqual(result.targets.map(({ target }) => target), ["development", "staging", "production"]);
    for (const target of result.targets) {
      const commands = target.commands.map(({ arguments: arguments_ }) => arguments_.join(" "));
      assert.ok(commands.includes("--dir apps/web run test:integration:cloudflare"));
      assert.equal(commands.includes("--dir apps/web run test:integration:bindings"), selected.includes("application-persistence"));
      assert.equal(commands.some(command => command.includes("wrangler deploy --dry-run")), selected.includes("background-job-delivery"));
      assert.equal(commands.filter(command => command.includes("check:prepared-artifact verify")).length, 2);
      if (target.target === "development") assert.ok(commands.includes("run test:unit"));
    }
    const evidence = await mkdtemp(join(tmpdir(), `egeria-${identifier}-composition-`));
    await writeFile(join(evidence, "verification.json"), JSON.stringify(result, null, 2), { flag: "wx", mode: 0o600 });
    context.diagnostic(`Retained local composition result: ${evidence}`);
  });
}
