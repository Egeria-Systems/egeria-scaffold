import assert from "node:assert/strict";
import * as filesystem from "node:fs/promises";
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
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
  for (const recipeVersion of ["0.2.2", "0.2.3", "0.2.4"]) {
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
    inspectEnvironment: async () => module.appTransitionVisualToolchain,
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
    snapshotSource: async () => ({ files: [{ sha256: String(snapshots++) }] }),
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

for (const preparation of ["synthetic", "security", "literal-lint", "vite-security"])
test(`${preparation} visual targets use exact production files, run non-update captures twice, and preserve process receipts`, async (t) => {
  const h = await harness(t);
  const spec = await readFile(new URL("../../packages/builder-core/templates/common/apps/web/tests/visual/home-visual.spec.ts", import.meta.url), "utf8");
  const artifactDirectory = join(h.root, "artifacts");
  await mkdir(artifactDirectory);
  const commands = [];
  let ownedProject;
  const repositoryRoot = preparation !== "synthetic" ? fileURLToPath(new URL("../", producer)) : h.root;
  const result = await h.module.executeAppTransitionVisualCase({ subset: [], mode: "candidates", baselines: {}, repositoryRoot, artifactDirectory, recipeVersion: preparation === "vite-security" ? "0.2.4" : preparation === "literal-lint" ? "0.2.3" : "0.2.2" }, {
    ...(preparation === "synthetic" ? { prepareProject: async () => ({ request: {}, sourceProject: {}, targetProject: {}, files: [
      { path: "apps/web/tests/visual/home-visual.spec.ts", content: Buffer.from(spec) },
      ...Object.entries(h.images).map(([viewport, content]) => ({ path: `apps/web/tests/visual/home-visual.spec.ts-snapshots/home-${viewport}-chromium-linux.png`, content })),
    ], influencingFingerprints: [{ path: "app.tsx", fingerprint: "sha256:synthetic" }] }) } : {}),
    inspectBrowser: async () => ({ synthetic: true }),
    inspectBuild: async () => ({ synthetic: true }),
    runAudit: async input => {
      commands.push({ ...input, arguments: ["audit", "--audit-level", "info", "--json"] });
      return { status: "passed", rawExitCode: 0, thresholdExitCode: 0 };
    },
    runCommand: async (input) => {
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
    assert.equal(result.project.sourceProject.recipeVersion, preparation === "vite-security" ? "0.11.4" : preparation === "literal-lint" ? "0.11.3" : "0.11.2");
    assert.equal(result.project.targetProject.schemaVersion, "1.0.0");
    assert.equal(result.project.targetProject.recipeVersion, preparation === "vite-security" ? "0.2.4" : preparation === "literal-lint" ? "0.2.3" : "0.2.2");
    assert.equal(result.project.files.find(({ path }) => path === "pnpm-lock.yaml").sha256, preparation === "vite-security" ? "6b119f067ef4647b1e9147899ef10e7df91b2eb2d25aeba78de85d5522f6b0c6" : preparation === "literal-lint" ? "34be78bdb6d3f8a2b1c02cd2f58fadff1d3a90b14395da5ff5a2c9c72bddfbe6" : "71c4d59802625006860409d6298e3bd13963089fc55260350ad4c262dd216067");
    if (["literal-lint", "vite-security"].includes(preparation)) assert.ok(result.influencingFingerprints.some(({ path }) => path === "patches/next-eslint-plugin-next.patch"));
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
