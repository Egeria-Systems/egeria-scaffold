import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

import { certifyAppLocalForTesting } from "../../scripts/certify-app-local.mjs";
import { certifyFreshScaffoldForTesting } from "../../scripts/lib/certify-fresh-scaffold.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const revision = "4da1ad1e48c12567d4e477c4ecbc3b9d4e097922";
const currentRegistry = JSON.parse(await readFile(join(repositoryRoot, "certifications/capabilities.json"), "utf8"));
const registry = structuredClone(currentRegistry);
delete registry.records["application-persistence"];
delete registry.records["background-job-delivery"];
delete registry.records["transactional-email-resend"];
delete registry.records["contact-form-web3forms"];
registry.records["app-foundation"] = {
  subject: { descriptorVersion: "0.1.0", behaviorContractDigest: "sha256:6d9cf389441064a96d2b47bb309becab37358fcc2952335feffae8720eb6f497" },
  requiredEvidence: ["existing-repository-lifecycle", "fresh-scaffold"],
  status: "pending", taskPlan: "docs/superpowers/plans/2026-09-13-app-foundation-certification.md", evidence: [],
};
registry.records.standards = {
  subject: {
    descriptorVersion: "0.5.0",
    behaviorContractDigest: "sha256:56a667594f2cbf43beed6e23471e4d8bf28fcbbf54d6f13530191153c84d4de9",
  },
  requiredEvidence: ["existing-repository-lifecycle", "fresh-scaffold"],
  status: "pending",
  taskPlan: "docs/superpowers/plans/2026-09-12-vitest-five-migration.md",
  evidence: [],
};
registry.records["deployment-cloudflare"] = {
  subject: {
    descriptorVersion: "0.3.0",
    behaviorContractDigest: "sha256:fb2464553830b052428773286689dc91984d662bf999b267aefbcb66e045ed6e",
  },
  requiredEvidence: ["cleanup-recovery", "deployed-application", "fresh-scaffold"],
  status: "pending",
  taskPlan: "docs/superpowers/plans/2026-09-05-effect-app-foundation-certification.md",
  evidence: [],
};
const fixedChecks = [
  "pnpm-version", "frozen-install", "peer-dependencies", "dependency-audit",
  "registry-signatures", "lint", "cloudflare-types", "typecheck", "unit-tests",
  "component-tests", "next-build", "opennext-build", "browser-install",
  "browser-development", "browser-preview",
];
const fixtureState = JSON.parse(await readFile(join(repositoryRoot, "fixtures/generated/app/.egeria/state.json"), "utf8"));

class TestCertificationError extends Error {
  constructor(code) { super(code); this.code = code; }
}

const configuration = {
  profile: "app", projectName: "acme-app", displayName: "Acme App",
  createArguments: [], capabilityIdentifier: "app-foundation", capabilityVersion: "0.1.0",
  expectedCapabilities: fixtureState.installedCapabilities.map(({ identifier }) => identifier),
  expectedInstalledCapabilities: fixtureState.installedCapabilities,
  expectedCapabilitySettings: {}, expectedRecipeVersion: "0.2.0", verifierIdentifier: "app",
  expectedVerificationChecks: fixedChecks,
  createError: code => new TestCertificationError(code),
  isCertificationError: error => error instanceof TestCertificationError,
};

function buildEvidence(identifier) {
  return {
    fixture: identifier,
    effect: { version: "4.0.0-rc.112", license: "MIT", dependencies: {}, optionalDependencies: {}, scripts: {}, packageSha256: "a".repeat(64) },
    client: { files: [{ path: "apps/web/.next/static/chunks/main.js", bytes: 10 }], bytes: 10, inspectedEffectMarkers: ["~effect/Effect"] },
    server: { files: 1, bytes: 20 },
    worker: { path: "apps/web/.open-next/server-functions/default/handler.mjs", bytes: 30, sha256: "b".repeat(64) },
    limits: "Exact source imports and installed Effect identity markers inspected; byte counts do not establish performance or production safety.",
  };
}

function adaptersFor({ changeInference, changeProject, changeVerification, failCommand, readRegistry, ...authority } = {}) {
  let identifier;
  let root;
  const calls = [];
  return {
    calls,
    async readCurrentRevision() { return revision; },
    async readRepositoryStatus() { return ""; },
    async readRepositoryIndexEntries() { return "H package.json\0"; },
    async readRegistry() { return readRegistry ? readRegistry() : structuredClone(registry); },
    async runCommand(input) {
      calls.push(input.arguments[1]);
      assert.equal(input.executable, process.execPath);
      assert.equal(input.arguments[0], join(repositoryRoot, "apps/cli/dist/index.js"));
      assert.equal(input.environment.CI, "true");
      assert.equal(input.environment.CLOUDFLARE_API_TOKEN, undefined);
      const command = input.arguments[1];
      if (failCommand === command) throw new Error("PRIVATE_CHILD_VALUE");
      if (command === "create") {
        root = input.arguments[input.arguments.indexOf("--directory") + 1];
        identifier = input.arguments.includes("--multilingual") ? "app-all-optional-integrations" : "app";
        await cp(join(repositoryRoot, "fixtures/generated", identifier), root, { recursive: true, errorOnExist: true, force: false });
        if (changeProject) {
          const projectPath = join(root, ".egeria/project.yaml");
          await writeFile(projectPath, changeProject(await readFile(projectPath, "utf8")));
        }
        const state = JSON.parse(await readFile(join(root, ".egeria/state.json"), "utf8"));
        return JSON.stringify({ ok: true, command, profile: "app", capabilities: state.installedCapabilities.map(item => item.identifier) });
      }
      assert.equal(input.arguments.at(-1), root);
      if (command === "infer") {
        const state = JSON.parse(await readFile(join(root, ".egeria/state.json"), "utf8"));
        const result = { state: { kind: "valid", value: state }, capabilities: state.installedCapabilities.map(({ identifier }) => ({ identifier, category: "confirmed", probes: [] })).sort((a, b) => a.identifier.localeCompare(b.identifier)), surfaces: [] };
        changeInference?.(result);
        return JSON.stringify({ ok: true, command, result });
      }
      if (command === "doctor") return JSON.stringify({ ok: true, command, result: { healthy: true, diagnostics: [] } });
      if (command === "diff") return JSON.stringify({ ok: true, command, result: { equal: true, differences: [] } });
      assert.fail(`unexpected command: ${command}`);
    },
    async verifyProject(receivedRoot, receivedIdentifier, name) {
      calls.push("verify");
      assert.equal(receivedRoot, root);
      assert.equal(receivedIdentifier, identifier);
      assert.equal(name, `acme-${identifier}`);
      const result = { ok: true, fixtures: [identifier], profiles: ["app"], checks: fixedChecks,
        workerIntegration: { executed: [identifier], skipped: [] }, appBuildEvidence: [buildEvidence(identifier)] };
      changeVerification?.(result);
      return result;
    },
    ...authority,
  };
}

test("fresh app runner contracts reject incomplete or wrong installed identity before runtime verification", async () => {
  const mutations = [
    result => { result.state.value.installedCapabilities[0].version = "0.4.0"; },
    result => { result.state.value.installedCapabilities.pop(); },
    result => { result.state.value.installedCapabilities.push(result.state.value.installedCapabilities[0]); },
    result => { result.state.value.origin.recipeVersion = "0.1.0"; },
    result => { result.capabilities.pop(); },
    result => { result.capabilities[0].category = "partial"; },
    result => { result.capabilities.push({ identifier: "analytics", category: "probable", probes: [] }); },
  ];
  for (const changeInference of mutations) {
    const adapters = adaptersFor({ changeInference });
    await assert.rejects(certifyFreshScaffoldForTesting(configuration, adapters), { code: "FRESH_SCAFFOLD_INFERENCE_INVALID" });
    assert.equal(adapters.calls.includes("verify"), false);
  }
});

test("fresh app runner contracts retain actual separate Worker and build evidence", async () => {
  const result = await certifyFreshScaffoldForTesting(configuration, adaptersFor());
  assert.deepEqual(result.workerIntegration, { executed: ["app"], skipped: [] });
  assert.deepEqual(result.appBuildEvidence, [buildEvidence("app")]);
});

test("fresh app runner contracts reject project selection and settings disagreement", async () => {
  for (const changeProject of [
    source => source.replace("originProfile: app", "originProfile: site"),
    source => source.replace("capabilitySettings: {}", "capabilitySettings:\n  booking-calendly:\n    destination: https://calendly.com/example/intro\n    mode: popup"),
    source => source.replace("  - site-routing\n", ""),
  ]) {
    const adapters = adaptersFor({ changeProject });
    await assert.rejects(certifyFreshScaffoldForTesting(configuration, adapters), { code: "FRESH_SCAFFOLD_RECIPE_INVALID" });
    assert.equal(adapters.calls.includes("verify"), false);
  }
});

function runLocal(adapters = adaptersFor(), input = { revision }) {
  return certifyAppLocalForTesting(input, adapters);
}

test("local runner contracts attribute default app journeys only to the retained app subjects", async () => {
  const adapters = adaptersFor();
  const result = await runLocal(adapters);
  assert.equal(result.ok, true);
  assert.equal(result.evidenceRevision, revision);
  assert.deepEqual(result.subjects.map(({ capability }) => capability), [
    "analytics", "app-foundation", "booking-calendly", "content-files", "deployment-cloudflare",
    "multilingual", "observability", "section-composition", "site-routing", "standards",
  ]);
  assert.deepEqual(result.subjects.find(({ capability }) => capability === "standards").subject, {
    descriptorVersion: "0.5.0", behaviorContractDigest: "sha256:56a667594f2cbf43beed6e23471e4d8bf28fcbbf54d6f13530191153c84d4de9",
  });
  assert.deepEqual(result.freshScaffolds.map(({ identifier }) => identifier), ["app", "app-all-optional-integrations"]);
  for (const fresh of result.freshScaffolds) {
    assert.equal(fresh.recipeVersion, "0.2.0");
    assert.deepEqual(fresh.workerIntegration, { executed: [fresh.identifier], skipped: [] });
    assert.deepEqual(fresh.appBuildEvidence, [buildEvidence(fresh.identifier)]);
    assert.equal(fresh.installedCapabilities[0].version, "0.5.0");
  }
  assert.deepEqual(adapters.calls, ["create", "infer", "doctor", "diff", "verify", "create", "infer", "doctor", "diff", "verify"]);
  assert.doesNotMatch(JSON.stringify(result), /certified|accepted|calendly\.com|clarity123|0123456789abcdef0123456789abcdef/);
});

test("local app certification refuses persistence and renewed shared subjects before generation", async () => {
  for (const changed of [
    currentRegistry.records,
    { ...registry.records, "application-persistence": {
      ...registry.records["app-foundation"],
      subject: { descriptorVersion: "0.1.0", behaviorContractDigest: `sha256:${"c".repeat(64)}` },
    } },
    { ...registry.records, standards: {
      ...registry.records.standards,
      subject: { descriptorVersion: "0.6.0", behaviorContractDigest: `sha256:${"d".repeat(64)}` },
    } },
    { ...registry.records, "deployment-cloudflare": {
      ...registry.records["deployment-cloudflare"],
      subject: { descriptorVersion: "0.4.0", behaviorContractDigest: `sha256:${"e".repeat(64)}` },
    } },
  ]) {
    const adapters = adaptersFor({ readRegistry: () => ({ ...registry, records: changed }) });
    await assert.rejects(runLocal(adapters), { code: "CERTIFICATION_SUBJECT_INVALID" });
    assert.deepEqual(adapters.calls, []);
  }
});

test("local runner contracts refuse missing extra or mismatched registry subjects before generation", async () => {
  for (const change of [
    value => { delete value.records.analytics; },
    value => { value.records.unexpected = value.records.analytics; },
    value => { value.records.standards.subject.behaviorContractDigest = `sha256:${"f".repeat(64)}`; },
  ]) {
    const adapters = adaptersFor({ readRegistry() { const value = structuredClone(registry); change(value); return value; } });
    await assert.rejects(runLocal(adapters), { code: "CERTIFICATION_SUBJECT_INVALID" });
    assert.deepEqual(adapters.calls, []);
  }
});

test("local runner contracts refuse dirty hidden or changed revision authority", async () => {
  for (const [overrides, code] of [
    [{ async readRepositoryStatus() { return " M package.json\0"; } }, "CERTIFICATION_WORKTREE_DIRTY"],
    [{ async readRepositoryIndexEntries() { return "S package.json\0"; } }, "CERTIFICATION_INDEX_FLAGS"],
    [{ async readCurrentRevision() { return "e".repeat(40); } }, "CERTIFICATION_REVISION_MISMATCH"],
  ]) {
    const adapters = adaptersFor(overrides);
    await assert.rejects(runLocal(adapters), { code });
    assert.deepEqual(adapters.calls, []);
  }
  let reads = 0;
  const adapters = adaptersFor({ async readCurrentRevision() { return reads++ === 0 ? revision : "e".repeat(40); } });
  await assert.rejects(runLocal(adapters), { code: "CERTIFICATION_REVISION_MISMATCH" });
  assert.ok(adapters.calls.filter(command => command === "create").length <= 1);
});

test("local runner contracts refuse absent skipped or mismatched Worker and Effect evidence", async () => {
  for (const changeVerification of [
    value => { delete value.workerIntegration; },
    value => { value.workerIntegration = { executed: [], skipped: ["app"] }; },
    value => { value.workerIntegration.executed = ["site"]; },
    value => { delete value.appBuildEvidence; },
    value => { value.appBuildEvidence = []; },
    value => { value.appBuildEvidence[0].fixture = "site"; },
    value => { value.appBuildEvidence[0].effect.version = "4.0.0-rc.113"; },
    value => { value.appBuildEvidence[0].worker.path = "PRIVATE_WORKER_PATH"; },
    value => { value.appBuildEvidence[0].client.inspectedEffectMarkers = []; },
  ]) {
    const adapters = adaptersFor({ changeVerification });
    await assert.rejects(runLocal(adapters), { code: "CERTIFICATION_RUNTIME_EVIDENCE_INVALID" });
    assert.equal(adapters.calls.filter(command => command === "create").length, 1);
  }
});

test("local runner contracts contain child and reader failures without private output", async () => {
  for (const [adapters, code] of [
    [adaptersFor({ failCommand: "create" }), "FRESH_SCAFFOLD_CREATE_FAILED"],
    [adaptersFor({ async readRepositoryStatus() { throw new Error("PRIVATE_STATUS_VALUE"); } }), "CERTIFICATION_WORKTREE_UNAVAILABLE"],
    [adaptersFor({ readRegistry() { throw new Error("PRIVATE_REGISTRY_VALUE"); } }), "CERTIFICATION_SUBJECT_INVALID"],
  ]) {
    await assert.rejects(runLocal(adapters), error => {
      assert.equal(error.code, code);
      assert.doesNotMatch(String(error), /PRIVATE/);
      return true;
    });
  }
});

test("local runner contracts reject malformed inputs before commands", async () => {
  for (const input of [undefined, null, {}, { revision: "HEAD" }, { revision, profile: "app" }]) {
    const adapters = adaptersFor();
    await assert.rejects(certifyAppLocalForTesting(input, adapters), { code: "CERTIFICATION_REVISION_INVALID" });
    assert.deepEqual(adapters.calls, []);
  }
});

test("local certification CLI refuses malformed options with bounded JSON", async () => {
  const execute = promisify(execFile);
  for (const arguments_ of [[], ["--revision", "PRIVATE_REVISION"], ["--revision", revision, "--unknown", "PRIVATE_VALUE"]]) {
    const result = await execute(process.execPath, [join(repositoryRoot, "scripts/certify-app-local.mjs"), ...arguments_], {
      cwd: repositoryRoot, env: { PATH: process.env.PATH },
    }).catch(error => error);
    assert.equal(result.code, 2);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, `${JSON.stringify({ ok: false, code: "CERTIFICATION_ARGUMENT_INVALID" })}\n`);
  }
});
