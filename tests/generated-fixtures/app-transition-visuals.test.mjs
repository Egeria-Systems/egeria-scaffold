import assert from "node:assert/strict";
import * as filesystem from "node:fs/promises";
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, delimiter, dirname, isAbsolute, join, sep } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const producer = new URL("../../scripts/verify-app-transition-visuals.mjs", import.meta.url);

for (const auditPath of ["scripts/lib/dependency-audit.mjs", "scripts/dependency-audit-exception.json"])
test(`changing ${auditPath} invalidates visual candidates and promotion`, async t => {
  const h = await harness(t);
  const execute = promisify(execFile);
  for (const path of ["scripts/lib/dependency-audit.mjs", "scripts/dependency-audit-exception.json", "packages/builder-core/dist/index.js"]) {
    await mkdir(dirname(join(h.root, path)), { recursive: true });
    await writeFile(join(h.root, path), "original reviewed content");
  }
  await execute("git", ["init", "--quiet"], { cwd: h.root });
  await execute("git", ["add", "scripts"], { cwd: h.root });
  await execute("git", ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "Initial fixture"], { cwd: h.root });
  const adapters = { ...h.adapters };
  delete adapters.snapshotSource;
  const { stdout: sourceRevision } = await execute("git", ["rev-parse", "HEAD"], { cwd: h.root });
  adapters.inspectEnvironment = async () => ({ ...h.module.appTransitionVisualToolchain, runtime: h.module.validateAppTransitionRuntimeReceipt(canonicalRuntimeBytes(hostedRuntimeReceipt(h.module, { sourceRevision: sourceRevision.trim() }))) });
  const candidate = await h.module.verifyAppTransitionVisuals({ mode: "candidates" }, adapters);
  await writeFile(join(h.root, auditPath), "changed audit decision");
  await assert.rejects(h.module.verifyAppTransitionVisuals({ mode: "promote", digest: candidate.manifestSha256 }, adapters), /VISUAL_SOURCE_CHANGED/);
  await writeFile(join(h.root, auditPath), "original reviewed content");
  await assert.rejects(h.module.verifyAppTransitionVisuals({ mode: "candidates" }, {
    ...adapters,
    executeCase: async input => {
      const result = await h.adapters.executeCase(input);
      await writeFile(join(h.root, auditPath), "changed during capture");
      return result;
    },
  }), /VISUAL_SOURCE_CHANGED/);
});

test("app transition visual producer exposes bounded candidate, comparison, and reviewed promotion modes", async () => {
  const exists = await access(producer).then(() => true, () => false);
  assert.equal(exists, true, "the app transition visual producer is not implemented");
  const module = await import(producer);
  assert.equal(typeof module.verifyAppTransitionVisuals, "function");
  assert.deepEqual(module.parseAppTransitionVisualArguments([]), { mode: "compare" });
  assert.deepEqual(module.parseAppTransitionVisualArguments(["--", "--candidates"]), { mode: "candidates" });
  for (const recipeVersion of ["0.2.2", "0.2.3"]) {
    assert.deepEqual(module.parseAppTransitionVisualArguments(["--candidates", `--app-recipe-version=${recipeVersion}`]), { mode: "candidates", recipeVersion });
  }
  const digest = "a".repeat(64);
  assert.deepEqual(module.parseAppTransitionVisualArguments([`--promote-reviewed-manifest-sha256=${digest}`]), { mode: "promote", digest });
  for (const arguments_ of [["--app-recipe-version=0.2.0"], ["--app-recipe-version=0.2.2", "--app-recipe-version=0.2.3"], ["--update-snapshots"], ["--candidates", "--candidates"], ["--promote-reviewed-manifest-sha256=unreviewed"], ["--directory=/tmp/elsewhere"]]) {
    assert.throws(() => module.parseAppTransitionVisualArguments(arguments_), /VISUAL_ARGUMENT_INVALID/);
  }
});

async function harness(t, overrides = {}) {
  const module = await import(producer);
  const root = await mkdtemp(join(tmpdir(), "egeria-app-visual-contract-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const images = {};
  for (const viewport of ["desktop", "mobile"]) {
    images[viewport] = await readFile(new URL(`../../fixtures/generated/portfolio/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-${viewport}-chromium-linux.png`, import.meta.url));
  }
  const calls = [];
  const adapters = {
    repositoryRoot: root,
    filesystem,
    inspectEnvironment: async () => ({ ...module.appTransitionVisualToolchain, runtime: module.validateAppTransitionRuntimeReceipt(canonicalRuntimeBytes(hostedRuntimeReceipt(module))) }),
    prepareBuilder: async () => {},
    snapshotSource: async () => ({ revision: "a".repeat(40), files: [{ path: "source.ts", sha256: "b".repeat(64) }] }),
    executeCase: async (input) => {
      calls.push(input);
      return {
        images,
        project: { request: { profile: "app" }, files: [{ path: "apps/web/source.ts", sha256: "c".repeat(64) }] },
        influencingFingerprints: [{ path: "apps/web/source.ts", fingerprint: `sha256:${"c".repeat(64)}` }],
        checks: ["synthetic-adapter-only"],
      };
    },
    ...overrides,
  };
  return { module, root, calls, adapters, images };
}

test("candidates exercise all eight subsets, retain four representatives, and bind exact manifest bytes", async (t) => {
  const h = await harness(t);
  const result = await h.module.verifyAppTransitionVisuals({ mode: "candidates" }, h.adapters);
  assert.equal(h.calls.length, 8);
  assert.equal(new Set(h.calls.map(({ subset }) => JSON.stringify(subset))).size, 8);
  assert.equal(h.calls.filter(({ subset }) => subset.includes("multilingual")).length, 4);
  const manifest = JSON.parse(await readFile(join(h.root, result.manifestPath), "utf8"));
  assert.equal(manifest.cases.length, 8);
  assert.equal(manifest.assets.length, 4);
  assert.equal(manifest.cases.every((entry) => entry.project.files.length && entry.influencingFingerprints.length), true);
  assert.equal(manifest.assets.every((entry) => typeof entry.historicalMatch === "boolean"), true);
  assert.match(result.manifestSha256, /^[a-f0-9]{64}$/);
});

test("wrong platform, architecture, toolchain, and subset inequality refuse without producing approvable evidence", async (t) => {
  const h = await harness(t);
  for (const change of [{ platform: "darwin" }, { architecture: "arm64" }, { node: "22.0.0" }, { browserRevision: "1" }]) {
    await assert.rejects(h.module.verifyAppTransitionVisuals({ mode: "candidates" }, { ...h.adapters, inspectEnvironment: async () => ({ ...h.module.appTransitionVisualToolchain, ...change }) }), /VISUAL_ENVIRONMENT_UNSUPPORTED/);
  }
  assert.equal(h.calls.length, 0);
  const execute = h.adapters.executeCase;
  await assert.rejects(h.module.verifyAppTransitionVisuals({ mode: "candidates" }, {
    ...h.adapters,
    executeCase: async (input) => {
      const value = await execute(input);
      if (input.subset.includes("analytics")) value.images = { ...value.images, desktop: Buffer.concat([value.images.desktop, Buffer.from("different")]) };
      return value;
    },
  }), /VISUAL_SUBSET_MISMATCH/);
  const runs = await readdir(join(h.root, "generated-visual-artifacts/app-transitions"));
  assert.equal(runs.length, 1);
  const entries = await readdir(join(h.root, "generated-visual-artifacts/app-transitions", runs[0]));
  assert.equal(entries.includes("failure.json"), true);
  assert.equal(entries.includes("candidate-manifest.json"), false);
});

test("source drift and process failures retain diagnostics and refuse candidates", async (t) => {
  const h = await harness(t);
  let snapshots = 0;
  await assert.rejects(h.module.verifyAppTransitionVisuals({ mode: "candidates" }, {
    ...h.adapters,
    snapshotSource: async () => ({ revision: "a".repeat(40), files: [{ sha256: String(snapshots++) }] }),
  }), /VISUAL_SOURCE_CHANGED/);
  await assert.rejects(h.module.verifyAppTransitionVisuals({ mode: "candidates" }, {
    ...h.adapters,
    executeCase: async ({ artifactDirectory }) => {
      await writeFile(join(artifactDirectory, "browser-failure.txt"), "synthetic process failure");
      throw new Error("VISUAL_CAPTURE_FAILED");
    },
  }), /VISUAL_CAPTURE_FAILED/);
  const runs = await readdir(join(h.root, "generated-visual-artifacts/app-transitions"));
  assert.equal(runs.length, 2);
  for (const run of runs) await access(join(h.root, "generated-visual-artifacts/app-transitions", run, "failure.json"));
});

test("candidate capture refuses a replaced owned artifact root before writing into its replacement", async (t) => {
  const h = await harness(t);
  let replaced;
  const execute = h.adapters.executeCase;
  await assert.rejects(h.module.verifyAppTransitionVisuals({ mode: "candidates" }, {
    ...h.adapters,
    executeCase: async (input) => {
      const value = await execute(input);
      replaced = dirname(input.artifactDirectory);
      await filesystem.rename(replaced, `${replaced}-retained`);
      await mkdir(replaced);
      return value;
    },
  }), /VISUAL_ROOT_CHANGED/);
  assert.deepEqual(await readdir(replaced), []);
});

test("promotion requires the unchanged reviewed manifest and writes only the four exact absent baselines", async (t) => {
  const h = await harness(t);
  await assert.rejects(h.module.verifyAppTransitionVisuals({ mode: "promote", digest: "0".repeat(64) }, h.adapters), /VISUAL_REVIEWED_MANIFEST_MISSING/);
  assert.deepEqual(await readdir(h.root), []);
  const candidate = await h.module.verifyAppTransitionVisuals({ mode: "candidates" }, h.adapters);
  await assert.rejects(h.module.verifyAppTransitionVisuals({ mode: "promote", digest: "0".repeat(64) }, h.adapters), /VISUAL_REVIEWED_MANIFEST_MISSING/);
  await assert.rejects(h.module.verifyAppTransitionVisuals({ mode: "promote", digest: candidate.manifestSha256 }, { ...h.adapters, snapshotSource: async () => ({ changed: true }) }), /VISUAL_SOURCE_CHANGED/);
  const result = await h.module.verifyAppTransitionVisuals({ mode: "promote", digest: candidate.manifestSha256 }, h.adapters);
  assert.equal(result.paths.length, 4);
  assert.equal(result.paths.every((path) => path.startsWith("packages/builder-core/templates/portfolio/apps/web/tests/visual/home-visual.spec.ts-snapshots/app-transition-") && path.endsWith("-chromium-linux.png")), true);
  await access(join(h.root, candidate.manifestPath));
  await assert.rejects(h.module.verifyAppTransitionVisuals({ mode: "promote", digest: candidate.manifestSha256 }, h.adapters), /VISUAL_PROMOTION_COLLISION/);
});

test("promotion refuses candidate tampering, symlink ancestors, and concurrent exclusive-write collisions", async (t) => {
  const h = await harness(t);
  const candidate = await h.module.verifyAppTransitionVisuals({ mode: "candidates" }, h.adapters);
  const manifest = JSON.parse(await readFile(join(h.root, candidate.manifestPath), "utf8"));
  const actual = join(h.root, dirname(candidate.manifestPath), manifest.assets[0].candidatePath);
  const original = await readFile(actual);
  await writeFile(actual, "changed");
  await assert.rejects(h.module.verifyAppTransitionVisuals({ mode: "promote", digest: candidate.manifestSha256 }, h.adapters), /VISUAL_CANDIDATE_CHANGED/);
  await writeFile(actual, original);
  await filesystem.symlink(h.root, join(h.root, "packages"));
  await assert.rejects(h.module.verifyAppTransitionVisuals({ mode: "promote", digest: candidate.manifestSha256 }, h.adapters), /VISUAL_PATH_UNSAFE/);
  await filesystem.unlink(join(h.root, "packages"));
  let attempts = 0;
  await assert.rejects(h.module.verifyAppTransitionVisuals({ mode: "promote", digest: candidate.manifestSha256 }, {
    ...h.adapters,
    filesystem: { ...filesystem, open: async (path, flags, mode) => {
      if (flags === "wx" && path.endsWith(".png") && ++attempts === 2) {
        await writeFile(path, "concurrent owner");
      }
      return filesystem.open(path, flags, mode);
    } },
  }), /VISUAL_PROMOTION_PARTIAL/);
  assert.equal(await readFile(join(h.root, manifest.assets[1].templatePath), "utf8"), "concurrent owner");
});

test("default compares the committed four baselines across all eight subsets without update mode", async (t) => {
  const h = await harness(t);
  const candidate = await h.module.verifyAppTransitionVisuals({ mode: "candidates" }, h.adapters);
  await h.module.verifyAppTransitionVisuals({ mode: "promote", digest: candidate.manifestSha256 }, h.adapters);
  h.calls.length = 0;
  const result = await h.module.verifyAppTransitionVisuals({ mode: "compare" }, h.adapters);
  assert.equal(result.status, "compared");
  assert.equal(h.calls.length, 8);
  assert.equal(h.calls.every(({ mode, baselines }) => mode === "compare" && baselines.desktop && baselines.mobile), true);
  const execute = h.adapters.executeCase;
  await assert.rejects(h.module.verifyAppTransitionVisuals({ mode: "compare" }, {
    ...h.adapters,
    executeCase: async (input) => {
      const value = await execute(input);
      return { ...value, images: { ...value.images, desktop: Buffer.concat([value.images.desktop, Buffer.from("stable different actual")]) } };
    },
  }), /VISUAL_COMPARISON_FAILED/);
});

test("visual reports require two executed viewport comparisons and reject skips, retries, and unrelated failures", async () => {
  const { validateAppTransitionVisualReport } = await import(producer);
  const report = (results) => ({ suites: [{ specs: results.map((result) => ({ tests: [{ results: [result] }] })) }] });
  const passed = { status: "passed" };
  const screenshotFailure = { status: "failed", errors: [{ message: "expect(page).toHaveScreenshot failed" }] };
  validateAppTransitionVisualReport(report([passed, passed]), false);
  validateAppTransitionVisualReport(report([passed, screenshotFailure]), true);
  assert.throws(() => validateAppTransitionVisualReport(report([passed]), true), /VISUAL_TEST_EXECUTION_INVALID/);
  assert.throws(() => validateAppTransitionVisualReport(report([passed, { status: "skipped" }]), true), /VISUAL_TEST_EXECUTION_INVALID/);
  assert.throws(() => validateAppTransitionVisualReport(report([passed, screenshotFailure]), false), /VISUAL_COMPARISON_FAILED/);
  assert.throws(() => validateAppTransitionVisualReport(report([passed, { status: "failed", errors: [{ message: "page.goto timed out" }] }]), true), /VISUAL_COMPARISON_FAILED/);
});

test("visual capture stabilizes and saves before screenshot comparison and preserves failures", async () => {
  const { createAppTransitionVisualSpec } = await import(producer);
  const require = createRequire(new URL("../../packages/builder-core/package.json", import.meta.url));
  const typescript = require("typescript");
  const source = await readFile(new URL("../../packages/builder-core/templates/common/apps/web/tests/visual/home-visual.spec.ts", import.meta.url), "utf8");
  const compiled = typescript.transpileModule(createAppTransitionVisualSpec(source, false), {
    compilerOptions: { module: typescript.ModuleKind.CommonJS },
  }).outputText;
  for (const { mismatch, unstable } of [{ mismatch: false, unstable: false }, { mismatch: true, unstable: false }, { mismatch: false, unstable: true }]) {
    const callbacks = [];
    const testAdapter = (_name, callback) => callbacks.push(callback);
    testAdapter.beforeEach = testAdapter.afterEach = () => {};
    const failure = new Error("toHaveScreenshot mismatch");
    const stabilityFailure = new Error("actual screenshot bytes never stabilized");
    let viewport;
    let matcherCalls = 0;
    let saveCompleted = false;
    let captured = 0;
    const written = [];
    const stableImage = Buffer.from("stable actual pixels");
    const expectAdapter = () => ({
      not: { toBeNull() {} }, toBe() {}, async toBeVisible() {},
      async toHaveScreenshot(name) {
        assert.equal(saveCompleted, true, "authoritative PNG save must complete before screenshot comparison");
        assert.equal(name, `home-${viewport}.png`);
        matcherCalls++;
        if (mismatch) throw failure;
      },
    });
    expectAdapter.poll = (capture, options) => ({ async toBe(expected) {
      assert.equal(options.timeout, 5_000);
      for (let attempt = 0; attempt < 4; attempt++) if (await capture() === expected) return;
      throw stabilityFailure;
    } });
    runInNewContext(compiled, {
      Buffer, exports: {}, require: identifier => {
        if (identifier === "node:fs/promises") return { async writeFile(path, content) {
          assert.equal(path, `${viewport}-captured.png`);
          assert.equal(content.equals(stableImage), true);
          await Promise.resolve();
          written.push({ path, content });
          saveCompleted = true;
        } };
        assert.equal(identifier, "@playwright/test");
        return { test: testAdapter, expect: expectAdapter };
      },
    });
    const page = {
      async route() {}, async setViewportSize() {}, async goto() { return { ok: () => true }; },
      getByRole() { return { async evaluate() {} }; },
      async screenshot(options) {
        assert.equal(matcherCalls, 0, "capture must precede screenshot comparison");
        assert.deepEqual({ ...options }, {
          path: `${viewport}-capture-${captured}.png`, animations: "disabled", caret: "hide", scale: "css",
        });
        captured++;
        if (unstable) return Buffer.from(`alternating pixels ${captured % 2}`);
        return captured === 1 ? Buffer.from("transient antialiasing pixels") : stableImage;
      },
    };
    assert.equal(callbacks.length, 2);
    for (const [index, callback] of callbacks.entries()) {
      viewport = ["desktop", "mobile"][index];
      matcherCalls = 0;
      saveCompleted = false;
      captured = 0;
      const writesBefore = written.length;
      const outcome = callback({ page }, { outputPath: name => name });
      if (unstable) await assert.rejects(outcome, error => error === stabilityFailure);
      else if (mismatch) await assert.rejects(outcome, error => error === failure);
      else await outcome;
      assert.equal(captured, unstable ? 4 : 3, "each viewport must discard a transient capture and prove two consecutive exact captures");
      assert.equal(written.length - writesBefore, unstable ? 0 : 1);
      assert.equal(saveCompleted, !unstable);
      assert.equal(matcherCalls, unstable ? 0 : 1);
    }
    assert.equal(written.length, unstable ? 0 : 2);
    assert.equal(written.every(({ content }) => content.equals(stableImage)), true);
  }
});

for (const preparation of ["synthetic", "security", "literal-lint"])
test(`${preparation} visual targets use exact production files, run non-update captures twice, and preserve process receipts`, async (t) => {
  const parentControl = process.env.pnpm_config_verify_deps_before_run;
  process.env.pnpm_config_verify_deps_before_run = "false";
  t.after(() => { if (parentControl === undefined) delete process.env.pnpm_config_verify_deps_before_run; else process.env.pnpm_config_verify_deps_before_run = parentControl; });
  const h = await harness(t);
  const spec = await readFile(new URL("../../packages/builder-core/templates/common/apps/web/tests/visual/home-visual.spec.ts", import.meta.url), "utf8");
  const artifactDirectory = join(h.root, "artifacts");
  await mkdir(artifactDirectory);
  const commands = [];
  let ownedProject;
  const repositoryRoot = preparation !== "synthetic" ? fileURLToPath(new URL("../", producer)) : h.root;
  const result = await h.module.executeAppTransitionVisualCase({ subset: [], mode: "candidates", baselines: {}, repositoryRoot, artifactDirectory, recipeVersion: preparation === "literal-lint" ? "0.2.3" : "0.2.2" }, {
    ...(preparation === "synthetic" ? { prepareProject: async () => ({ request: {}, sourceProject: {}, targetProject: {}, files: [
      { path: "apps/web/tests/visual/home-visual.spec.ts", content: Buffer.from(spec) },
      ...Object.entries(h.images).map(([viewport, content]) => ({ path: `apps/web/tests/visual/home-visual.spec.ts-snapshots/home-${viewport}-chromium-linux.png`, content })),
    ], influencingFingerprints: [{ path: "app.tsx", fingerprint: "sha256:synthetic" }] }) } : {}),
    inspectBrowser: async () => ({ synthetic: true }),
    inspectBuild: async () => ({ synthetic: true }),
    runAudit: async input => {
      assert.equal(input.environment.pnpm_config_verify_deps_before_run, "error");
      commands.push({ ...input, arguments: ["audit", "--audit-level", "info", "--json"] });
      return { status: "passed", rawExitCode: 0, thresholdExitCode: 0 };
    },
    runCommand: async (input) => {
      assert.equal(input.environment.pnpm_config_verify_deps_before_run, "error");
      commands.push(input);
      ownedProject = input.cwd;
      if (input.arguments.includes("test:visual")) {
        for (const [viewport, content] of Object.entries(h.images)) {
          const path = join(input.cwd, "apps/web/test-results", viewport, `${viewport}-captured.png`);
          await mkdir(dirname(path), { recursive: true });
          await writeFile(path, content);
        }
        await writeFile(input.environment.PLAYWRIGHT_JSON_OUTPUT_FILE, JSON.stringify({ suites: [{ specs: ["desktop", "mobile"].map(() => ({ tests: [{ results: [{ status: "passed" }] }] })) }] }));
      }
      return { exitCode: 0, stdout: "synthetic adapter", stderr: "" };
    },
  });
  if (preparation !== "synthetic") {
    assert.equal(result.project.sourceProject.schemaVersion, "1.0.0");
    assert.equal(result.project.sourceProject.recipeVersion, preparation === "literal-lint" ? "0.11.3" : "0.11.2");
    assert.equal(result.project.targetProject.schemaVersion, "1.0.0");
    assert.equal(result.project.targetProject.recipeVersion, preparation === "literal-lint" ? "0.2.3" : "0.2.2");
    assert.equal(result.project.files.find(({ path }) => path === "pnpm-lock.yaml").sha256, preparation === "literal-lint" ? "34be78bdb6d3f8a2b1c02cd2f58fadff1d3a90b14395da5ff5a2c9c72bddfbe6" : "71c4d59802625006860409d6298e3bd13963089fc55260350ad4c262dd216067");
    if (preparation === "literal-lint") assert.ok(result.influencingFingerprints.some(({ path }) => path === "patches/next-eslint-plugin-next.patch"));
  }
  assert.equal(commands.filter(({ arguments: args }) => args.includes("test:visual")).length, 2);
  assert.equal(commands.some(({ arguments: args }) => args.some(value => value.includes("update-snapshots"))), false);
  assert.equal(commands.every(({ environment }) => environment.NPM_CONFIG_REGISTRY === "https://registry.npmjs.org/" && !environment.GITHUB_TOKEN), true);
  assert.deepEqual(result.images.desktop, h.images.desktop);
  await assert.rejects(access(ownedProject), { code: "ENOENT" });
  await access(join(artifactDirectory, "candidate/report.json"));
  await access(join(artifactDirectory, "reproduction/report.json"));
});

test("visual prerequisites retain raw and threshold audit results and reject incoherent dispositions", async t => {
  const h = await harness(t);
  const spec = await readFile(new URL("../../packages/builder-core/templates/common/apps/web/tests/visual/home-visual.spec.ts", import.meta.url));
  const cases = [
    { disposition: { status: "passed", rawExitCode: 0, thresholdExitCode: 0 }, accepted: true },
    { disposition: { status: "passed", rawExitCode: 1, thresholdExitCode: 0 }, accepted: true },
    { disposition: { status: "accepted-with-security-exception", rawExitCode: 1, thresholdExitCode: 1 }, accepted: true },
    { disposition: { status: "passed", rawExitCode: 0 }, accepted: false },
    { disposition: { status: "passed", rawExitCode: 0, thresholdExitCode: 1 }, accepted: false },
    { disposition: { status: "passed", rawExitCode: 1, thresholdExitCode: 1 }, accepted: false },
    { disposition: { status: "passed", rawExitCode: 2, thresholdExitCode: 0 }, accepted: false },
    { disposition: { status: "accepted-with-security-exception", rawExitCode: 1 }, accepted: false },
    { disposition: { status: "accepted-with-security-exception", rawExitCode: 1, thresholdExitCode: 0 }, accepted: false },
    { disposition: { status: "accepted-with-security-exception", rawExitCode: 0, thresholdExitCode: 1 }, accepted: false },
    { disposition: { status: "refused", rawExitCode: 1, thresholdExitCode: 1 }, accepted: false, throws: true },
  ];
  for (const [index, { disposition, accepted, throws }] of cases.entries()) {
    const artifactDirectory = join(h.root, `audit-${index}`);
    await mkdir(artifactDirectory);
    const commands = [];
    await assert.rejects(h.module.executeAppTransitionVisualCase({ subset: [], mode: "candidates", baselines: {}, repositoryRoot: h.root, artifactDirectory }, {
      prepareProject: async () => ({ files: [{ path: "apps/web/tests/visual/home-visual.spec.ts", content: spec }], influencingFingerprints: [] }),
      runAudit: async () => {
        if (throws) throw Object.assign(new Error("DEPENDENCY_AUDIT_FAILED"), { auditDisposition: disposition });
        return disposition;
      },
      runCommand: async input => {
        commands.push(input.arguments);
        return { exitCode: input.arguments.includes("lint") ? 2 : 0, stdout: "synthetic", stderr: "" };
      },
      inspectBrowser: async () => assert.fail("failed prerequisites must prevent capture"),
    }), /VISUAL_PROJECT_CHECK_FAILED/);
    assert.equal(commands.some(args => args.includes("signatures")), accepted);
    assert.equal(commands.some(args => args.includes("test:visual")), false);
    const failure = JSON.parse(await readFile(join(artifactDirectory, "failure/failure.json")));
    const audit = failure.checks.find(check => check.name === "dependency-audit");
    assert.equal(audit.exitCode, disposition.rawExitCode);
    assert.deepEqual(audit.disposition, disposition);
  }
});


function hostedRuntimeReceipt(module, changes = {}) {
  const hash = "a".repeat(64);
  const layers = Array.from({ length: 9 }, (_, index) => `sha256:${String(index).padStart(64, "0")}`);
  return {
    schemaVersion: 1, policySha256: module.appTransitionRuntimePolicySha256,
    sourceRevision: "a".repeat(40),
    image: { engineId: `sha256:${hash}`, baseIndex: module.appTransitionRuntimePolicy.base.index,
      basePlatform: module.appTransitionRuntimePolicy.base.platform, baseLayers: layers.slice(0, 7), layers },
    packages: { beforeCount: 514, afterCount: 514, beforeSha256: hash, afterSha256: "b".repeat(64),
      changes: module.appTransitionRuntimePolicy.packages.map(({ name, before, version }) => ({ name, before, version, architecture: "amd64", status: "install ok installed" })), buildExitCode: 0 },
    tools: { node: { version: "22.23.2", sha256: hash }, pnpm: { version: "11.20.0", sha256: hash,
      closure: { sha256: hash, files: 3, bytes: 42 }, globalShims: '{"node":false}' } },
    security: structuredClone(module.appTransitionRuntimePolicy.security),
    ...changes,
  };
}

function canonicalRuntimeBytes(value) {
  const ordered = item => Array.isArray(item) ? item.map(ordered) : item && typeof item === "object"
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, ordered(item[key])])) : item;
  return Buffer.from(`${JSON.stringify(ordered(value), null, 2)}\n`);
}

test("hosted app transition runtime validates exact provenance and rejects altered public fields", async () => {
  const module = await import(producer);
  assert.equal(typeof module.validateAppTransitionRuntimeReceipt, "function");
  const receipt = hostedRuntimeReceipt(module);
  const bytes = canonicalRuntimeBytes(receipt);
  const valid = module.validateAppTransitionRuntimeReceipt(bytes, { imageId: receipt.image.engineId, sourceRevision: receipt.sourceRevision });
  assert.deepEqual(valid.receipt, receipt);
  assert.match(valid.receiptSha256, /^[a-f0-9]{64}$/);
  for (const mutate of [
    value => { value.image.baseIndex = `sha256:${"0".repeat(64)}`; },
    value => { value.image.layers[0] = `sha256:${"f".repeat(64)}`; },
    value => { value.packages.changes.pop(); },
    value => { value.packages.afterCount = 515; },
    value => { value.packages.buildExitCode = 1; },
    value => { value.tools.node.version = "22.0.0"; },
    value => { value.tools.pnpm.closure.files = 1025; },
    value => { value.tools.pnpm.globalShims = '{"node":true}'; },
    value => { value.security.readOnlyRoot = false; },
    value => { value.privateHostPath = "SENSITIVE_SENTINEL"; },
  ]) {
    const changed = structuredClone(receipt); mutate(changed);
    assert.throws(() => module.validateAppTransitionRuntimeReceipt(canonicalRuntimeBytes(changed)), /VISUAL_ENVIRONMENT_UNSUPPORTED/);
  }
  for (const expected of [{ imageId: `sha256:${"f".repeat(64)}` }, { sourceRevision: "f".repeat(40) }, { receiptSha256: "f".repeat(64) }, { nodeSha256: "f".repeat(64) }])
    assert.throws(() => module.validateAppTransitionRuntimeReceipt(bytes, expected), /VISUAL_ENVIRONMENT_UNSUPPORTED/);
  assert.throws(() => module.validateAppTransitionRuntimeReceipt(Buffer.from(JSON.stringify(receipt))), /VISUAL_ENVIRONMENT_UNSUPPORTED/);
});

test("hosted app transition runtime reads only bounded private stable regular receipts", async t => {
  const module = await import(producer);
  assert.equal(typeof module.readAppTransitionRuntimeReceipt, "function");
  const root = await mkdtemp(join(tmpdir(), "egeria-runtime-receipt-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, "receipt.json");
  await writeFile(path, canonicalRuntimeBytes(hostedRuntimeReceipt(module)), { mode: 0o600 });
  assert.equal((await module.readAppTransitionRuntimeReceipt(path)).receipt.schemaVersion, 1);
  await filesystem.symlink(path, join(root, "link"));
  await assert.rejects(module.readAppTransitionRuntimeReceipt(join(root, "link")), /VISUAL_ENVIRONMENT_UNSUPPORTED/);
  await filesystem.chmod(path, 0o644);
  await assert.rejects(module.readAppTransitionRuntimeReceipt(path), /VISUAL_ENVIRONMENT_UNSUPPORTED/);
  await filesystem.chmod(path, 0o600);
  await filesystem.link(path, join(root, "hardlink"));
  await assert.rejects(module.readAppTransitionRuntimeReceipt(path), /VISUAL_ENVIRONMENT_UNSUPPORTED/);
  await filesystem.unlink(join(root, "hardlink"));
  await writeFile(path, Buffer.alloc(65537));
  await assert.rejects(module.readAppTransitionRuntimeReceipt(path), /VISUAL_ENVIRONMENT_UNSUPPORTED/);
  await assert.rejects(module.readAppTransitionRuntimeReceipt(root), /VISUAL_ENVIRONMENT_UNSUPPORTED/);
});

test("hosted app transition runtime stages and binds the full executable relative pnpm closure", async t => {
  const module = await import(producer);
  assert.equal(typeof module.stageAppTransitionPnpmClosure, "function");
  const root = await mkdtemp(join(tmpdir(), "egeria-runtime-closure-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, "source");
  await mkdir(join(source, "dist", "nested"), { recursive: true });
  await writeFile(join(source, "pnpm"), "synthetic executable", { mode: 0o755 });
  await writeFile(join(source, "dist", "nested", "entry.mjs"), "synthetic runtime");
  await writeFile(join(source, "unrelated"), "EXCLUDED_SENTINEL");
  const staged = join(root, "staged");
  const inventory = await module.stageAppTransitionPnpmClosure(source, staged);
  assert.deepEqual(inventory.entries.map(({ path }) => path), ["dist/nested/entry.mjs", "pnpm"]);
  assert.deepEqual(await readdir(staged), ["dist", "pnpm"]);
  assert.deepEqual(await module.inspectAppTransitionPnpmClosure(staged), inventory);
  await writeFile(join(staged, "dist", "nested", "entry.mjs"), "changed");
  assert.notEqual((await module.inspectAppTransitionPnpmClosure(staged)).sha256, inventory.sha256);
  await filesystem.symlink(join(source, "pnpm"), join(source, "dist", "escape"));
  await assert.rejects(module.inspectAppTransitionPnpmClosure(source), /VISUAL_TOOLCHAIN_INVALID/);
  const input = { repositoryRoot: join(root, "workspace"), scratchRoot: join(root, "scratch"), nodeExecutable: join(root, "node"),
    pnpmDirectory: staged, receiptPath: join(root, "receipt.json"), imageId: `sha256:${"a".repeat(64)}`, arguments: ["--candidates", "--app-recipe-version=0.2.3"] };
  const invocation = module.createAppTransitionRuntimeInvocation(input);
  assert.ok(invocation.create.includes(`type=bind,source=${staged},target=/opt/app-visual-tools/pnpm,readonly`));
  assert.deepEqual(invocation.command, ["pnpm", "run", "verify:app-transition-visuals", "--", ...input.arguments]);
  assert.deepEqual(invocation.install, ["pnpm", "install", "--frozen-lockfile", "--store-dir", "/tmp/app-transition-runtime/store"]);
  assert.equal(invocation.create.filter(value => value.startsWith("type=bind,")).length, 5);
  for (const change of [{ pnpmDirectory: `${staged},rw` }, { imageId: "unpatched:latest" }, { arguments: ["--update-snapshots"] }, { arguments: ["--promote-reviewed-manifest-sha256=" + "a".repeat(64)] }, { secret: "PRIVATE_TOKEN" }])
    assert.throws(() => module.createAppTransitionRuntimeInvocation({ ...input, ...change }), /VISUAL_RUNTIME_INVOCATION_INVALID/);
});

test("hosted app transition runtime default builder receives owned paths and exact pnpm controls", async t => {
  const h = await harness(t);
  assert.equal(typeof h.module.validateAppTransitionRuntimeReceipt, "function");
  const previous = { ...process.env };
  for (const key of ["HOME", "XDG_CACHE_HOME", "NPM_CONFIG_USERCONFIG", "NODE_OPTIONS", "PRIVATE_TOKEN"]) process.env[key] = "PARENT_SENTINEL";
  process.env.PNPM_CONFIG_GLOBAL_SHIMS = '{"node":false}';
  process.env.pnpm_config_verify_deps_before_run = "false";
  t.after(() => { for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key]; Object.assign(process.env, previous); });
  const adapters = { ...h.adapters };
  delete adapters.prepareBuilder;
  const seen = [];
  adapters.runCommand = async input => {
    seen.push(input);
    assert.deepEqual(input.arguments, ["--filter", "@egeria-systems/builder-core", "run", "build"]);
    assert.equal(input.environment.pnpm_config_verify_deps_before_run, "error");
    assert.equal(input.environment.PNPM_CONFIG_GLOBAL_SHIMS, '{"node":false}');
    for (const key of ["HOME", "USERPROFILE", "TMPDIR", "TMP", "TEMP", "XDG_CACHE_HOME", "PNPM_HOME", "NPM_CONFIG_USERCONFIG", "npm_config_store_dir"]) {
      assert.ok(input.environment[key]); assert.doesNotMatch(input.environment[key], /PARENT_SENTINEL/);
      await access(input.environment[key]);
    }
    assert.equal(await readFile(input.environment.NPM_CONFIG_USERCONFIG, "utf8"), "");
    assert.equal(input.environment.NODE_OPTIONS, undefined); assert.equal(input.environment.PRIVATE_TOKEN, undefined);
    return { exitCode: 0, stdout: "", stderr: "" };
  };
  const outcome = await h.module.verifyAppTransitionVisuals({ mode: "candidates" }, adapters);
  assert.equal(seen.length, 1);
  const manifest = JSON.parse(await readFile(join(h.root, outcome.manifestPath), "utf8"));
  assert.equal(manifest.schemaVersion, 2);
  assert.deepEqual(manifest.runtime.receipt, hostedRuntimeReceipt(h.module));
  await assert.rejects(access(seen[0].environment.HOME), { code: "ENOENT" });
});

test("hosted app transition runtime refuses forged provenance before builder and legacy promotion", async t => {
  const h = await harness(t);
  assert.equal(typeof h.module.validateAppTransitionRuntimeReceipt, "function");
  let builds = 0;
  await assert.rejects(h.module.verifyAppTransitionVisuals({ mode: "candidates" }, { ...h.adapters,
    inspectEnvironment: async () => h.module.appTransitionVisualToolchain,
    prepareBuilder: async () => { builds++; },
  }), /VISUAL_ENVIRONMENT_UNSUPPORTED/);
  assert.equal(builds, 0); assert.equal(h.calls.length, 0);
  const candidate = await h.module.verifyAppTransitionVisuals({ mode: "candidates" }, h.adapters);
  const path = join(h.root, candidate.manifestPath); const manifest = JSON.parse(await readFile(path, "utf8"));
  manifest.schemaVersion = 1; const bytes = canonicalRuntimeBytes(manifest); await writeFile(path, bytes);
  const { createHash } = await import("node:crypto");
  await assert.rejects(h.module.verifyAppTransitionVisuals({ mode: "promote", digest: createHash("sha256").update(bytes).digest("hex") }, h.adapters), /VISUAL_MANIFEST_INVALID/);
});


test("hosted app transition runtime accepts pinned action aliases without exporting them", async t => {
  const module = await import(producer);
  const root = await mkdtemp(join(tmpdir(), "egeria-runtime-aliases-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "source", "dist"), { recursive: true });
  await writeFile(join(root, "source", "pnpm"), "executable", { mode: 0o755 });
  await writeFile(join(root, "source", "dist", "entry.mjs"), "runtime");
  for (const name of ["pn", "pnx", "pnpx"]) await filesystem.link(join(root, "source", "pnpm"), join(root, "source", name));
  const result = await module.stageAppTransitionPnpmClosure(join(root, "source"), join(root, "staged"));
  assert.equal(result.files, 2);
  assert.deepEqual(await readdir(join(root, "staged")), ["dist", "pnpm"]);
});

test("hosted app transition runtime compares complete package inventories before accepting the three fixes", async () => {
  const module = await import(producer);
  assert.equal(typeof module.inspectAppTransitionPackageDelta, "function");
  const packages = module.appTransitionRuntimePolicy.packages;
  const fields = (name, version, architecture = "amd64") => `Package: ${name}\nStatus: install ok installed\nArchitecture: ${architecture}\nVersion: ${version}\n`;
  const others = Array.from({ length: 511 }, (_, index) => fields(`unchanged-${index}`, "1.0"));
  const before = [...others, ...packages.map(value => fields(value.name, value.before))].join("\n");
  const after = [...others, ...packages.map(value => fields(value.name, value.version))].join("\n");
  const result = module.inspectAppTransitionPackageDelta(before, after);
  assert.equal(result.beforeCount, 514); assert.equal(result.changes.length, 3);
  for (const changed of [after.replace("Version: 1.0", "Version: 2.0"), `${after}\n${fields("extra", "1")}`, after.replace("Architecture: amd64", "Architecture: arm64")])
    assert.throws(() => module.inspectAppTransitionPackageDelta(before, changed), /VISUAL_RUNTIME_PACKAGES_INVALID/);
});

test("hosted app transition runtime captures native failure timeout and overflow without claiming success", async t => {
  const module = await import(producer);
  assert.equal(typeof module.runHostedAppTransitionCommand, "function");
  const root = await mkdtemp(join(tmpdir(), "egeria-runtime-command-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [source, options, expected] of [
    ['process.stdout.write("observed");process.exitCode=7', {}, { exitCode: 7, captureExitCode: 0 }],
    ['setInterval(()=>{},1000)', { timeout: 50 }, { timedOut: true }],
    ['process.stdout.write("x".repeat(4096))', { maximumBytes: 8 }, { overflow: true }],
  ]) {
    const result = await module.runHostedAppTransitionCommand({ executable: process.execPath, arguments: ["-e", source], cwd: root,
      environment: { PATH: process.env.PATH }, logDirectory: root, timeout: 3000, ...options });
    for (const [key, value] of Object.entries(expected)) assert.equal(result[key], value);
    assert.equal(result.success, false);
    assert.match(result.captureId, /^[a-f0-9-]+$/);
    const capturedStatus = JSON.parse(await readFile(join(root, `${result.captureId}.status.json`), "utf8"));
    assert.deepEqual(capturedStatus.arguments, ["-e", source]);
    assert.equal(capturedStatus.executable, process.execPath);
    assert.equal(capturedStatus.exitCode, result.exitCode);
    assert.ok((await readdir(root)).some(name => name.endsWith(".stdout.log")));
    if (result.overflow) assert.ok(Buffer.byteLength(result.stdout) <= 8);
  }
});


test("hosted app transition runtime binds executable hashes only to regular amd64 ELF files", async t => {
  const module = await import(producer);
  assert.equal(typeof module.inspectAppTransitionRuntimeExecutable, "function");
  const root = await mkdtemp(join(tmpdir(), "egeria-runtime-executable-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, "node"); const bytes = Buffer.alloc(64);
  bytes.set([127, 69, 76, 70, 2, 1, 1]); bytes.writeUInt16LE(3, 16); bytes.writeUInt16LE(62, 18);
  await writeFile(path, bytes, { mode: 0o755 });
  const { createHash } = await import("node:crypto");
  assert.equal(await module.inspectAppTransitionRuntimeExecutable(path), createHash("sha256").update(bytes).digest("hex"));
  bytes.writeUInt16LE(183, 18); await writeFile(path, bytes);
  await assert.rejects(module.inspectAppTransitionRuntimeExecutable(path), /VISUAL_TOOLCHAIN_INVALID/);
  await writeFile(path, "script");
  await assert.rejects(module.inspectAppTransitionRuntimeExecutable(path), /VISUAL_TOOLCHAIN_INVALID/);
});


test("hosted runtime repair accepts the actual pinned package-script child without weakening command controls", async t => {
  const module = await import(producer);
  const root = await mkdtemp(join(tmpdir(), "egeria-runtime-lifecycle-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const selectedPnpm = await selectInstalledPinnedPnpm(process.env);
  const pnpm = selectedPnpm.executable;
  console.log("Selected installed pnpm kind:", selectedPnpm.kind);
  const execute = promisify(execFile);
  const environment = { PATH: `${dirname(process.execPath)}:${process.env.PATH}`, HOME: root, USERPROFILE: root,
    TMPDIR: root, TMP: root, TEMP: root, XDG_CACHE_HOME: root, PNPM_HOME: join(root, "pnpm-home"),
    NPM_CONFIG_USERCONFIG: join(root, "user.npmrc"), NPM_CONFIG_REGISTRY: "https://registry.npmjs.org/",
    COREPACK_ENABLE_NETWORK: "0", npm_config_offline: "true", pnpm_config_offline: "true",
    PNPM_CONFIG_GLOBAL_SHIMS: '{"node":false}', pnpm_config_verify_deps_before_run: "error" };
  await writeFile(environment.NPM_CONFIG_USERCONFIG, "", { mode: 0o600 });
  assert.equal(selectedPnpm.version, "11.20.0");
  const script = "node scripts/verify-app-transition-visuals.mjs";
  await mkdir(join(root, "scripts"));
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "runtime-lifecycle-fixture", private: true, scripts: { "verify:app-transition-visuals": script } }));
  await writeFile(join(root, "scripts", "verify-app-transition-visuals.mjs"), [
    'import * as module from ' + JSON.stringify(producer.href) + ';',
    'import {writeFile} from "node:fs/promises";',
    'const keys=["pnpm_config_verify_deps_before_run","npm_lifecycle_event","npm_package_json","PNPM_SCRIPT_SRC_DIR","npm_lifecycle_script","npm_execpath"];',
    'const observed=Object.fromEntries(keys.map(key=>[key,process.env[key]]));',
    'await writeFile("observed.json",JSON.stringify(observed));',
    'const result=module.validateAppTransitionRuntimeEntry(observed,{repositoryRoot:process.cwd(),pnpmExecutable:' + JSON.stringify(pnpm) + ',script:' + JSON.stringify(script) + ',arguments:process.argv.slice(2)});',
    'await writeFile("entry-result.json",JSON.stringify(result));',
  ].join("\n"));
  const result = await execute(pnpm, ["--dir", root, "run", "verify:app-transition-visuals", "--", "--candidates", "--app-recipe-version=0.2.3"], { cwd: root, env: environment, timeout: 10000, maxBuffer: 1024 * 1024 }).then(value => ({ code: 0, ...value }), error => ({ code: error.code, stdout: error.stdout, stderr: error.stderr }));
  const observed = JSON.parse(await readFile(join(root, "observed.json"), "utf8"));
  assert.equal(observed.pnpm_config_verify_deps_before_run, "false", "actual pinned pnpm lifecycle normalization must be observed");
  console.log("Observed pinned lifecycle normalization:", observed.pnpm_config_verify_deps_before_run);
  assert.equal(result.code, 0, `${result.stderr}\n${JSON.stringify(observed)}`);
  assert.equal(JSON.parse(await readFile(join(root, "entry-result.json"), "utf8")).kind, "canonical-lifecycle");
  const expected = { repositoryRoot: root, pnpmExecutable: pnpm, script, arguments: ["--", "--candidates", "--app-recipe-version=0.2.3"] };
  assert.equal(module.validateAppTransitionRuntimeEntry({ pnpm_config_verify_deps_before_run: "error" }, expected).kind, "direct");
  assert.throws(() => module.validateAppTransitionRuntimeEntry({ pnpm_config_verify_deps_before_run: "error" }, { ...expected, script: "foreign" }), /VISUAL_ENVIRONMENT_UNSUPPORTED/);
  for (const key of ["npm_lifecycle_event", "npm_package_json", "PNPM_SCRIPT_SRC_DIR", "npm_lifecycle_script", "npm_execpath"]) {
    assert.throws(() => module.validateAppTransitionRuntimeEntry({ ...observed, [key]: "foreign" }, expected), /VISUAL_ENVIRONMENT_UNSUPPORTED/);
  }
  assert.throws(() => module.validateAppTransitionRuntimeEntry({ pnpm_config_verify_deps_before_run: "false" }, expected), /VISUAL_ENVIRONMENT_UNSUPPORTED/);
  assert.throws(() => module.validateAppTransitionRuntimeEntry(observed, { ...expected, arguments: ["--", "--update-snapshots"] }), /VISUAL_ENVIRONMENT_UNSUPPORTED/);
  assert.throws(() => module.validateAppTransitionRuntimeEntry(observed, { ...expected, arguments: ["--", "--app-recipe-version=0.2.3"] }), /VISUAL_ENVIRONMENT_UNSUPPORTED/);
});

test("hosted runtime repair tears down the exact container despite exhausted main capture and failed stop", async t => {
  const module = await import(producer);
  assert.equal(typeof module.finishAppTransitionHostedRuntime, "function");
  const root = await mkdtemp(join(tmpdir(), "egeria-runtime-teardown-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const containerId = "a".repeat(64); const failure = new Error("VISUAL_RUNTIME_COMMAND_FAILED");
  const controller = new AbortController(); controller.abort(failure);
  const calls = [];
  const finished = await module.finishAppTransitionHostedRuntime({ containerId, failure,
    mainCapture: { bytes: 64 * 1024 * 1024, signal: controller.signal }, cwd: root, environment: {}, logDirectory: root,
    runCommand: async input => {
      calls.push(input); assert.equal(input.signal, undefined); assert.ok(input.timeout > 0 && input.timeout <= 15000);
      if (calls.length === 1) { assert.ok(input.maximumBytes <= 256 * 1024); throw new Error("synthetic stop failure"); }
      assert.ok(input.maximumBytes <= 768 * 1024);
      return { success: true, exitCode: 0, signal: null, captureExitCode: 0, captureComplete: true, bytes: 100, captureId: "inspection", stdout: JSON.stringify([{ State: { Running: false, Pid: 0, ExitCode: 137, OOMKilled: false } }]) };
    },
  });
  assert.deepEqual(calls.map(({ arguments: args }) => args), [["stop", "--timeout=10", containerId], ["inspect", containerId]]);
  assert.equal(finished.failure, failure);
  assert.deepEqual(finished.stopped, { running: false, pid: 0, exitCode: 137, oomKilled: false });
  assert.equal(finished.capture.mainBytes, 64 * 1024 * 1024); assert.equal(finished.capture.mainAborted, true);
  assert.equal(finished.commands.length, 2);
  for (const scenario of ["stop-overflow", "running", "inspection-failure", "clean", "aborted-main"]) {
    const seen = [];
    const result = await module.finishAppTransitionHostedRuntime({ containerId, cwd: root, environment: {}, logDirectory: root,
      mainCapture: { bytes: 64 * 1024 * 1024, ...(scenario === "aborted-main" ? { signal: controller.signal } : {}) },
      runCommand: async input => {
        seen.push(input);
        if (seen.length === 1) return { success: scenario !== "stop-overflow", exitCode: 0, signal: null, captureExitCode: 0,
          captureComplete: scenario !== "stop-overflow", overflow: scenario === "stop-overflow", bytes: scenario === "stop-overflow" ? 256 * 1024 : 0, stdout: "" };
        if (scenario === "inspection-failure") throw new Error("synthetic inspection failure");
        return { success: true, exitCode: 0, signal: null, captureExitCode: 0, captureComplete: true, bytes: 100,
          stdout: JSON.stringify([{ State: { Running: scenario === "running", Pid: scenario === "running" ? 42 : 0, ExitCode: 0, OOMKilled: false } }]) };
      },
    });
    assert.equal(seen.length, 2);
    assert.ok(result.capture.teardownBytes <= 1024 * 1024);
    if (["running", "inspection-failure"].includes(scenario)) { assert.equal(result.stopped, null); assert.match(result.failure.message, /VISUAL_RUNTIME_STOP_UNKNOWN/); }
    else assert.equal(result.stopped.pid, 0);
    if (scenario === "stop-overflow") assert.match(result.failure.message, /VISUAL_RUNTIME_STOP_FAILED/);
    if (scenario === "clean") assert.equal(result.failure, undefined);
    if (scenario === "aborted-main") assert.equal(result.failure, failure);
  }
  for (const invalid of ["foreign", `${containerId}\n`]) await assert.rejects(module.finishAppTransitionHostedRuntime({ containerId: invalid, cwd: root, environment: {}, logDirectory: root, mainCapture: {}, runCommand: async () => assert.fail("invalid CID dispatched") }), /VISUAL_RUNTIME_INVOCATION_INVALID/);
});

test("hosted runtime repair bounds descendant-held pipes and preserves separate process groups", async t => {
  const module = await import(producer); const { spawn } = await import("node:child_process");
  const root = await mkdtemp(join(tmpdir(), "egeria-runtime-descendant-"));
  const sentinel = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { detached: true, stdio: "ignore" });
  const owned = new Set([sentinel.pid]);
  await writeFile(join(root, "sentinel-owner.json"), JSON.stringify({ token: "owned-sentinel", sentinel: sentinel.pid }), { mode: 0o600 });
  const killOwned = () => { for (const pid of owned) { try { process.kill(pid, "SIGKILL"); } catch (error) { if (error.code !== "ESRCH") throw error; } } };
  t.after(async () => { killOwned(); sentinel.unref(); await rm(root, { recursive: true, force: true }); });
  for (const mode of ["timeout", "abort", "escaped-exit", "closed-pipe-abort"]) {
    const ready = join(root, `${mode}.json`); const ownerFile = join(root, `${mode}-owner.json`); const token = `owned-${mode}`;
    const descendant = 'process.on("SIGTERM",()=>{});require("node:fs").writeFileSync(' + JSON.stringify(ready) + ',JSON.stringify({token:' + JSON.stringify(token) + ',leader:Number(process.argv[1]),descendant:process.pid}));setInterval(()=>{},1000);';
    const leader = [
      'const {spawn}=require("node:child_process");',
      'const descendant=spawn(process.execPath,["-e",' + JSON.stringify(descendant) + ',String(process.pid)],{detached:' + (mode === "escaped-exit") + ',stdio:' + JSON.stringify(mode === "closed-pipe-abort" ? ["ignore", "ignore", "ignore"] : ["ignore", "inherit", "inherit"]) + '});',
      'require("node:fs").writeFileSync(' + JSON.stringify(ownerFile) + ',JSON.stringify({token:' + JSON.stringify(token) + ',leader:process.pid,descendant:descendant.pid}));',
      mode === "escaped-exit" ? 'setInterval(()=>{if(require("node:fs").existsSync(' + JSON.stringify(ready) + '))process.exit(0)},10);' : 'setInterval(()=>{},1000);',
    ].join("");
    const controller = new AbortController();
    const start = performance.now();
    const command = module.runHostedAppTransitionCommand({ executable: process.execPath, arguments: ["-e", leader], cwd: root,
      environment: { PATH: process.env.PATH }, logDirectory: root, timeout: 2000, signal: controller.signal });
    let fixture; let outer;
    try {
      const until = performance.now() + 1500;
      while (!fixture && performance.now() < until) {
        try { fixture = JSON.parse(await readFile(ready, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; await new Promise(resolve => setTimeout(resolve, 10)); }
      }
      assert.equal(fixture?.token, token, "owned fixture readiness required before assertions");
      owned.add(fixture.leader); owned.add(fixture.descendant);
      if (mode === "abort" || mode === "closed-pipe-abort") controller.abort();
      const result = await Promise.race([command, new Promise((_, reject) => { outer = setTimeout(() => reject(new Error("owned command did not return within bounded drain")), 4500); })]);
      assert.equal(result.success, false);
      assert.equal(result.processGroupId, fixture.leader);
      assert.notEqual(result.processGroupId, process.pid);
      assert.ok(performance.now() - start < 6500);
      const sentinelState = await inspectOwnedFixtureProcess(sentinel.pid, owned);
      assert.match(sentinelState, /^[RSI]/, "separate sentinel is running");
      if (mode === "escaped-exit") {
        assert.equal(result.exitCode, 0); assert.equal(result.drainTimedOut, true); assert.equal(result.captureComplete, false);
        const escapedState = await inspectOwnedFixtureProcess(fixture.descendant, owned);
        assert.match(escapedState, /^[RSI]/, "separate fixture group remains running");
      } else {
        const state = await inspectOwnedFixtureProcess(fixture.descendant, owned);
        assert.ok(state === "" || state.startsWith("Z"), `same-group descendant still running: ${state}`);
        console.log("Owned descendant state:", JSON.stringify({ mode, pid: fixture.descendant, state: state || "validated-absent", sentinel: sentinelState }));
        if (mode === "closed-pipe-abort") assert.ok(result.terminationSignals.some(({ signal, status }) => signal === "SIGKILL" && ["sent", "gone"].includes(status)), "closed pipes must not cancel owned-group escalation");
      }
    } finally {
      clearTimeout(outer);
      const created = await readFile(ownerFile, "utf8").then(JSON.parse, () => fixture);
      if (created?.token === token) for (const pid of [created.leader, created.descendant]) {
        if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid || pid === sentinel.pid) continue;
        try { process.kill(pid, "SIGKILL"); } catch (error) { if (error.code !== "ESRCH") throw error; }
        owned.delete(pid);
      }
      await Promise.race([command.catch(() => {}), new Promise(resolve => setTimeout(resolve, 1000))]);
    }
  }
});


function isStandalonePnpmCandidate(candidate, header) {
  return basename(candidate) === "pnpm" && header.subarray(0, 7).equals(Buffer.from([127, 69, 76, 70, 2, 1, 1])) && header.readUInt16LE(18) === 62;
}

async function selectInstalledPinnedPnpm(environment) {
  const version = (await import(producer)).appTransitionVisualToolchain.pnpm;
  const execute = promisify(execFile);
  async function qualify(executable, kind) {
    const root = await mkdtemp(join(tmpdir(), "egeria-installed-pnpm-probe-"));
    try {
      await writeFile(join(root, "user.npmrc"), "", { mode: 0o600 });
      const result = await execute(executable, ["--version"], { cwd: root, timeout: 5000, maxBuffer: 16384, env: {
        PATH: `${dirname(process.execPath)}:${environment.PATH ?? ""}`, HOME: root, USERPROFILE: root,
        TMPDIR: root, TMP: root, TEMP: root, XDG_CACHE_HOME: root, PNPM_HOME: join(root, "pnpm-home"),
        NPM_CONFIG_USERCONFIG: join(root, "user.npmrc"), NPM_CONFIG_REGISTRY: "https://registry.npmjs.org/",
        PNPM_CONFIG_GLOBAL_SHIMS: '{"node":false}', pnpm_config_verify_deps_before_run: "error",
        COREPACK_ENABLE_NETWORK: "0", npm_config_offline: "true", pnpm_config_offline: "true",
      } });
      return result.stdout.trim() === version ? { executable, kind, version } : null;
    } finally { await rm(root, { recursive: true, force: true }); }
  }
  for (const directory of new Set((environment.PATH ?? "").split(delimiter))) {
    if (!isAbsolute(directory)) continue;
    let candidate;
    try { candidate = await filesystem.realpath(join(directory, "pnpm")); }
    catch (error) { if (["ENOENT", "ENOTDIR"].includes(error.code)) continue; throw error; }
    const stat = await filesystem.lstat(candidate);
    if (!stat.isFile() || !(stat.mode & 0o111)) continue;
    const header = Buffer.alloc(20); const handle = await filesystem.open(candidate, "r");
    try { await handle.read(header, 0, header.length, 0); } finally { await handle.close(); }
    if (process.platform === "linux" && process.arch === "x64" && isStandalonePnpmCandidate(candidate, header)) {
      const selected = await qualify(candidate, "native-executable");
      if (selected) return selected;
      continue;
    }
    const packageRoot = basename(candidate) === "volta-shim"
      ? join(dirname(dirname(candidate)), "tools", "image", "pnpm", version)
      : dirname(dirname(candidate));
    let manifest;
    try {
      const path = join(packageRoot, "package.json"); const metadata = await filesystem.stat(path);
      if (!metadata.isFile() || metadata.size > 65536) continue;
      manifest = JSON.parse(await readFile(path, "utf8"));
    } catch (error) { if (["ENOENT", "ENOTDIR"].includes(error.code)) continue; throw error; }
    if (manifest.name !== "pnpm" || manifest.version !== version || typeof manifest.bin?.pnpm !== "string") continue;
    if (isAbsolute(manifest.bin.pnpm) || manifest.bin.pnpm.split(/[\\/]/).includes("..")) throw new Error("INSTALLED_PINNED_PNPM_INVALID");
    const owner = await filesystem.realpath(packageRoot); const executable = await filesystem.realpath(join(packageRoot, manifest.bin.pnpm));
    const entry = await filesystem.stat(executable);
    if (!executable.startsWith(`${owner}${sep}`) || !entry.isFile() || !(entry.mode & 0o111) || !/\.[cm]?js$/.test(executable)) throw new Error("INSTALLED_PINNED_PNPM_INVALID");
    const selected = await qualify(executable, "declared-package-entry");
    if (selected) return selected;
  }
  throw new Error("INSTALLED_PINNED_PNPM_UNAVAILABLE");
}

async function inspectOwnedFixtureProcess(pid, owned, execute = promisify(execFile)) {
  assert.ok(Number.isInteger(pid) && pid > 0 && owned.has(pid), "inspection requires an exact owned fixture PID");
  let result;
  try { result = await execute("ps", ["-p", String(pid), "-o", "stat="], { timeout: 1000, maxBuffer: 16384, encoding: "utf8" }); }
  catch (error) {
    if (error.code === 1 && error.signal === null && error.killed === false && error.stdout === "" && error.stderr === "") return "";
    throw error;
  }
  if (typeof result.stdout !== "string" || result.stderr !== "" || !/^[RSDTZIXUW][<NLsl+>EXAW]*$/.test(result.stdout.trim())) throw new Error("OWNED_PROCESS_INSPECTION_INVALID");
  return result.stdout.trim();
}

test("hosted runtime continuation selects only installed pinned tools without lifecycle metadata", async t => {
  const environment = { ...process.env };
  for (const key of ["npm_execpath", "npm_lifecycle_event", "npm_lifecycle_script", "npm_package_json", "PNPM_SCRIPT_SRC_DIR"]) delete environment[key];
  const selected = await selectInstalledPinnedPnpm(environment);
  assert.ok(["declared-package-entry", "native-executable"].includes(selected.kind));
  assert.deepEqual(await selectInstalledPinnedPnpm({ ...environment, npm_execpath: "/nonexistent/lifecycle-entry" }), selected);
  const root = await mkdtemp(join(tmpdir(), "egeria-installed-tool-selection-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(selectInstalledPinnedPnpm({ PATH: root, npm_execpath: selected.executable }), /INSTALLED_PINNED_PNPM_UNAVAILABLE/);
});

test("hosted runtime continuation propagates every process inspection error except exact no-match", async () => {
  const pid = process.pid; const owned = new Set([pid]);
  const inspect = result => inspectOwnedFixtureProcess(pid, owned, async (executable, args, options) => {
    assert.equal(executable, "ps"); assert.deepEqual(args, ["-p", String(pid), "-o", "stat="]);
    assert.equal(options.timeout, 1000); assert.equal(options.maxBuffer, 16384);
    if (result instanceof Error) throw result;
    return result;
  });
  const absent = Object.assign(new Error("validated no-match"), { code: 1, signal: null, killed: false, stdout: "", stderr: "" });
  assert.equal(await inspect(absent), "");
  assert.equal(await inspect({ stdout: " Z\n", stderr: "" }), "Z");
  assert.equal(await inspect({ stdout: " S+\n", stderr: "" }), "S+");
  for (const fields of [
    { code: "EPERM" }, { code: "ENOENT" }, { code: "EACCES" }, { code: "ERR_CHILD_PROCESS_STDIO_MAXBUFFER" },
    { code: null, killed: true, signal: "SIGTERM" }, { code: 1, signal: "SIGKILL" },
    { code: 1, stdout: "partial" }, { code: 1, stderr: "permission denied" }, { code: 2 },
  ]) {
    const failure = Object.assign(new Error("inspection failure"), { stdout: "", stderr: "", signal: null, killed: false }, fields);
    await assert.rejects(inspect(failure), error => error === failure);
  }
  for (const result of [{ stdout: "", stderr: "" }, { stdout: "S\nZ\n", stderr: "" }, { stdout: "?\n", stderr: "" }, { stdout: "S\n", stderr: "warning" }])
    await assert.rejects(inspect(result), /OWNED_PROCESS_INSPECTION_INVALID/);
  await assert.rejects(inspectOwnedFixtureProcess(pid, new Set(), async () => assert.fail("unowned PID dispatched")), /exact owned fixture PID/);
});


test("hosted runtime continuation excludes manager shims from ELF candidate classification", () => {
  const header = Buffer.alloc(20); header.set([127, 69, 76, 70, 2, 1, 1]); header.writeUInt16LE(62, 18);
  assert.equal(isStandalonePnpmCandidate("/installed/bin/volta-shim", header), false, "a manager must not be version-probed as standalone pnpm");
  assert.equal(isStandalonePnpmCandidate("/installed/bin/corepack", header), false);
  assert.equal(isStandalonePnpmCandidate("/installed/bin/pnpm", header), true, "format candidate only; this fixture is never executed or treated as native qualification");
});
