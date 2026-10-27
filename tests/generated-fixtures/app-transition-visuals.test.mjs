import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as filesystem from "node:fs/promises";
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { createSyntheticAppTransitionAdmission } from "../helpers/synthetic-app-transition-admission.mjs";

const producer = new URL("../../scripts/verify-app-transition-visuals.mjs", import.meta.url);

for (const auditPath of ["scripts/lib/dependency-audit.mjs", "scripts/dependency-audit-exception.json", "packages/builder-core/src/lifecycle/app-transition-visual-admission.cjs"])
test(`changing ${auditPath} invalidates visual candidates and promotion`, async t => {
  const h = await harness(t);
  const execute = promisify(execFile);
  for (const path of ["scripts/lib/dependency-audit.mjs", "scripts/dependency-audit-exception.json", "packages/builder-core/dist/index.js", "packages/builder-core/src/lifecycle/app-transition-visual-admission.cjs"]) {
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
  assert.deepEqual(module.parseAppTransitionVisualArguments([]), { mode: "compare", recipeVersion: "0.2.7" });
  assert.deepEqual(module.parseAppTransitionVisualArguments(["--", "--candidates"]), { mode: "candidates", recipeVersion: "0.2.7" });
  for (const recipeVersion of ["0.2.7"]) {
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
    images[viewport] = await readFile(new URL(`../../docs/implementation-evidence/retired-recipe-visuals/portfolio/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-${viewport}-chromium-linux.png`, import.meta.url));
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

test("comparison refuses missing expected images before preparation or writes", async t => {
  const h = await comparisonHarness(t);
  const effects = [];
  const missing = join(h.root, h.paths[0]);
  await assert.rejects(h.module.verifyAppTransitionVisuals({ mode: "compare" }, {
    ...h.adapters, filesystem: { ...refuseWrites(effects), open: async (path, ...arguments_) => {
      if (path === missing) throw Object.assign(new Error("missing expected image"), { code: "ENOENT" });
      return filesystem.open(path, ...arguments_);
    } }, inspectEnvironment: async () => { effects.push("environment"); },
  }), { code: "ENOENT" });
  assert.deepEqual(effects, []);
  assert.deepEqual(h.calls, []);
});

test("current comparison inputs reach the environment before preparation or writes", async () => {
  const module = await import(producer);
  const effects = [];
  await assert.rejects(module.verifyAppTransitionVisuals({ mode: "compare" }, {
    inspectEnvironment: async () => { effects.push("environment"); throw new Error("CURRENT_COMPARISON_INPUTS_REACHED_ENVIRONMENT"); },
    prepareBuilder: async () => { effects.push("preparation"); },
    executeCase: async () => { effects.push("case"); },
  }), /^Error: CURRENT_COMPARISON_INPUTS_REACHED_ENVIRONMENT$/);
  assert.deepEqual(effects, ["environment"]);
});

test("shared visual membership refuses malformed optional subsets", () => {
  const require = createRequire(new URL("../../packages/builder-core/package.json", import.meta.url));
  const policy = require("./src/lifecycle/app-transition-visual-admission.cjs");
  const identity = {
    influencingFingerprint: "sha256:4a159aa4fd322131abd5c2d272b9c2312870e0012fbaa945c6b57191de631295",
    targetLockfileFingerprint: "sha256:78ac7e12de2b35c3486eb9f471d80cf2ae33c370768838d7e0fdb62bf85c9706",
  };
  assert.deepEqual(policy.verifyAppTransitionVisualInputIdentity({ ...identity, optionalCapabilities: [] }), {
    optionalCapabilities: [],
    expectedBaselines: [
      "sha256:6f6dd1ddd3049d998ac51b4da17b7eb66ca481b89f9e4947fb68b0bce1af50d5",
      "sha256:00e95d03593487ac4a6bb3e08afe9a1df475ecb76b8b1f1da676259ccf551d27",
    ],
  });
  for (const optionalCapabilities of [["none"], ["analytics", "analytics"], ["analytics+booking-calendly"], [null], new Array(1)]) {
    assert.equal(policy.verifyAppTransitionVisualInputIdentity({ ...identity, optionalCapabilities }), undefined);
  }
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

for (const preparation of ["synthetic", "current"])
test(`${preparation} visual targets use exact production files, run non-update captures twice, and preserve process receipts`, async (t) => {
  const h = await harness(t);
  const spec = await readFile(new URL("../../packages/builder-core/templates/common/apps/web/tests/visual/home-visual.spec.ts", import.meta.url), "utf8");
  const artifactDirectory = join(h.root, "artifacts");
  await mkdir(artifactDirectory);
  const commands = [];
  let ownedProject;
  const repositoryRoot = preparation !== "synthetic" ? fileURLToPath(new URL("../", producer)) : h.root;
  const result = await h.module.executeAppTransitionVisualCase({ subset: [], mode: "candidates", baselines: {}, repositoryRoot, artifactDirectory, recipeVersion: "0.2.7" }, {
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
    assert.equal(result.project.sourceProject.recipeVersion, "0.11.7");
    assert.equal(result.project.targetProject.schemaVersion, "1.0.0");
    assert.equal(result.project.targetProject.recipeVersion, "0.2.7");
    assert.equal(result.project.files.find(({ path }) => path === "pnpm-lock.yaml").sha256, "78ac7e12de2b35c3486eb9f471d80cf2ae33c370768838d7e0fdb62bf85c9706");
    assert.ok(result.influencingFingerprints.some(({ path }) => path === "patches/next-eslint-plugin-next.patch"));
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


test("retired portfolio visual arguments refuse", async () => {
  const module = await import(producer);
  for (const mode of [[], ["--candidates"]]) {
    assert.throws(() => module.parseAppTransitionVisualArguments([...mode, "--app-recipe-version=0.2.3"]), /VISUAL_ARGUMENT_INVALID/);
  }
});

test("retired portfolio visual verification refuses before preparation", async () => {
  const module = await import(producer);
  const effects = [];
  const unexpected = () => { effects.push("preparation"); throw new Error("unexpected preparation"); };
  await assert.rejects(module.verifyAppTransitionVisuals({ mode: "candidates", recipeVersion: "0.2.3" }, {
    repositoryRoot: "/unused/retired-visual",
    filesystem: new Proxy({}, { get: () => unexpected }),
    snapshotSource: unexpected,
    inspectEnvironment: unexpected,
    prepareBuilder: unexpected,
  }), /VISUAL_ARGUMENT_INVALID/);
  assert.deepEqual(effects, []);
});

test("retired portfolio visual execution refuses before project preparation", async () => {
  const module = await import(producer);
  const effects = [];
  await assert.rejects(module.executeAppTransitionVisualCase({ recipeVersion: "0.2.3" }, {
    prepareProject: async () => { effects.push("prepare"); throw new Error("unexpected project preparation"); },
  }), /VISUAL_RECIPE_IDENTITY_INVALID/);
  assert.deepEqual(effects, []);
});

const admissionLeaf = "packages/builder-core/src/lifecycle/app-transition-visual-admission.cjs";
const sourceRoot = fileURLToPath(new URL("../", producer));
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

async function comparisonHarness(t) {
  const fixture = await createSyntheticAppTransitionAdmission(t);
  const calls = [];
  const adapters = {
    repositoryRoot: fixture.root,
    filesystem,
    inspectEnvironment: async () => fixture.module.appTransitionVisualToolchain,
    prepareBuilder: async () => {},
    snapshotSource: async () => ({ revision: "a".repeat(40), files: [{ path: "source.ts", sha256: "b".repeat(64) }] }),
    prepareProject: async (_root, subset) => {
      const prepared = fixture.preparedProjects.get([...subset].sort().join("+") || "none");
      assert.ok(prepared, "the synthetic fixture must contain this exact optional subset");
      return structuredClone(prepared);
    },
    executeCase: async input => {
      calls.push(input);
      return {
        images: fixture.images[input.subset.includes("multilingual") ? "multilingual" : "monolingual"],
        project: { files: input.preparedProject.files.map(file => ({ path: file.path, sha256: sha256(file.content) })) },
        influencingFingerprints: input.preparedProject.influencingFingerprints,
        checks: ["synthetic-capture-adapter-only"],
      };
    },
  };
  return { ...fixture, calls, adapters, paths: fixture.pngPaths };
}

function refuseWrites(effects) {
  return { ...filesystem,
    mkdir: async () => { effects.push("mkdir"); throw new Error("UNEXPECTED_WRITE"); },
    open: async (path, flags, mode) => {
      if (flags === "wx") { effects.push("open-write"); throw new Error("UNEXPECTED_WRITE"); }
      return filesystem.open(path, flags, mode);
    },
  };
}

async function assertSyntheticEntry(h) {
  const effects = [];
  await assert.rejects(h.module.verifyAppTransitionVisuals({ mode: "compare" }, {
    ...h.adapters, filesystem: refuseWrites(effects),
    inspectEnvironment: async () => { effects.push("environment"); throw new Error("SYNTHETIC_ENTRY_REACHED_ENVIRONMENT"); },
    prepareBuilder: async () => { effects.push("build"); },
  }), /^Error: SYNTHETIC_ENTRY_REACHED_ENVIRONMENT$/);
  assert.deepEqual(effects, ["environment"]);
  assert.deepEqual(h.calls, []);
}

async function assertSyntheticComparison(h) {
  await assertSyntheticEntry(h);
  const result = await h.module.verifyAppTransitionVisuals({ mode: "compare" }, h.adapters);
  assert.equal(result.status, "compared");
  assert.equal(h.calls.length, 8);
  return result;
}

test("comparison refuses incoherent prepared identities before artifact or case writes", async t => {
  const h = await comparisonHarness(t);
  const changes = [
    prepared => { prepared.files.push(prepared.files[0]); },
    prepared => { prepared.files[0].path = "../outside"; },
    prepared => { prepared.files = prepared.files.filter(file => file.path !== "pnpm-lock.yaml"); },
    prepared => { prepared.files.find(file => file.path === "pnpm-lock.yaml").content = Buffer.from("foreign lock"); },
    prepared => { prepared.influencingFingerprints[0].fingerprint = `sha256:${"a".repeat(64)}`; },
    prepared => { prepared.targetProject.schemaVersion = "2.0.0"; },
    prepared => { prepared.targetProject.recipeVersion = "0.2.6"; },
  ];
  for (const change of changes) {
    const effects = [];
    await assert.rejects(h.module.verifyAppTransitionVisuals({ mode: "compare" }, {
      ...h.adapters, filesystem: refuseWrites(effects), prepareProject: async (...arguments_) => {
        const prepared = await h.adapters.prepareProject(...arguments_);
        change(prepared);
        return prepared;
      },
    }), /^Error: VISUAL_INPUT_IDENTITY_MISSING$/);
    assert.deepEqual(effects, []);
    assert.deepEqual(h.calls, []);
  }
});

test("comparison rejects missing or unsafe source, lock, PNG and policy before effects", async t => {
  const h = await physicalComparisonFixture(t);
  await assert.rejects(h.module.verifyAppTransitionVisuals({ mode: "compare" }, h.adapters), /^Error: COMPARISON_INPUTS_REACHED_ENVIRONMENT$/);
  assert.deepEqual(h.effects, ["environment"]);
  h.effects.length = 0;
  const paths = [admissionLeaf, "scripts/verify-app-transition-visuals.mjs", "packages/builder-core/src/lifecycle/app-profile-transition.ts",
    "packages/builder-core/templates/common/apps/web/app/globals.css", "packages/builder-core/templates/common/apps/web/tests/visual/home-visual.spec.ts",
    "packages/builder-core/lockfiles/web-recipe-app-0.2.7/pnpm-lock.yaml",
    "packages/builder-core/templates/portfolio/apps/web/tests/visual/home-visual.spec.ts-snapshots/app-transition-home-desktop-chromium-linux.png"];
  for (const path of paths) for (const kind of ["missing", "symlink"]) {
    const effects = [];
    let faultReached = false;
    const fs = { ...refuseWrites(effects),
      lstat: async absolute => {
        const stats = await filesystem.lstat(absolute);
        if (absolute === join(h.root, path) && kind === "symlink") {
          faultReached = true;
          return { ...stats, isFile: () => stats.isFile(), isDirectory: () => stats.isDirectory(), isSymbolicLink: () => true };
        }
        return stats;
      },
      open: async (absolute, flags, mode) => {
        if (flags === "wx") { effects.push("open-write"); throw new Error("UNEXPECTED_WRITE"); }
        if (absolute === join(h.root, path) && kind === "missing") {
          faultReached = true;
          throw Object.assign(new Error("missing"), { code: "ENOENT" });
        }
        const handle = await filesystem.open(absolute, flags, mode);
        return { stat: () => handle.stat(), close: () => handle.close(), readFile: async () => {
          const bytes = await handle.readFile();
          if (absolute === join(h.root, path) && kind === "changed") { faultReached = true; bytes[0] ^= 1; }
          return bytes;
        } };
      },
    };
    await assert.rejects(h.module.verifyAppTransitionVisuals({ mode: "compare" }, {
      ...h.adapters, filesystem: fs,
      inspectEnvironment: async () => { effects.push("environment"); throw new Error("UNEXPECTED_ENVIRONMENT"); },
      prepareBuilder: async () => { effects.push("build"); },
      executeCase: async () => { effects.push("case"); },
    }), error => kind === "missing" ? error.code === "ENOENT" : error.message === "VISUAL_PATH_UNSAFE", `${path}: ${kind}`);
    assert.equal(faultReached, true, `${path}: ${kind} must reach the intended physical read`);
    assert.deepEqual(effects, []);
  }
});

test("synthetic source entry ignores compiled output before the environment boundary", async t => {
  const h = await physicalComparisonFixture(t);
  await filesystem.rename(join(h.root, "packages/builder-core/dist"), join(h.root, "packages/builder-core/unavailable-compiled-inputs"));
  assert.equal(await access(join(h.root, "packages/builder-core/dist")).then(() => true, () => false), false);
  const reads = [];
  await assert.rejects(h.module.verifyAppTransitionVisuals({ mode: "compare" }, {
    ...h.adapters,
    filesystem: { ...h.adapters.filesystem, open: async (path, ...arguments_) => {
      reads.push(path);
      assert.equal(path.includes("/dist/"), false, "entry must not consult stale compiled output");
      return h.adapters.filesystem.open(path, ...arguments_);
    } },
  }), /^Error: COMPARISON_INPUTS_REACHED_ENVIRONMENT$/);
  assert.ok(reads.includes(join(h.root, admissionLeaf)), "the eligible fixture must reach physical source observations");
  assert.deepEqual(h.effects, ["environment"]);
});

test("synthetic comparison executes all subsets with canonical baseline bytes and leaves source PNGs unchanged", async t => {
  const h = await comparisonHarness(t);
  const before = await Promise.all(h.paths.map(path => readFile(join(h.root, path))));
  const result = await assertSyntheticComparison(h);
  assert.equal(h.calls.every(call => call.mode === "compare" && Object.keys(call.baselines).length === 2), true);
  const manifest = JSON.parse(await readFile(join(h.root, result.manifestPath), "utf8"));
  assert.equal(manifest.cases.length, 8);
  assert.equal(manifest.cases.every(entry => entry.checks[0] === "synthetic-capture-adapter-only"), true);
  assert.deepEqual(await Promise.all(h.paths.map(path => readFile(join(h.root, path)))), before);
});

test("comparison refuses source drift and incoherent preparation before new artifact or case writes", async t => {
  for (const change of ["raw-source", "rendered-input", "target-lock"]) {
    const h = await comparisonHarness(t);
    await assertSyntheticComparison(h);
    h.calls.length = 0;
    const effects = [];
    const counters = { environment: 0, build: 0, project: 0 };
    const prepare = h.adapters.prepareProject;
    const adapters = { ...h.adapters, filesystem: refuseWrites(effects),
      inspectEnvironment: async () => { counters.environment += 1; return h.module.appTransitionVisualToolchain; },
      prepareBuilder: async () => {
        counters.build += 1;
        if (change === "raw-source") {
          const path = join(h.root, "packages/builder-core/templates/common/apps/web/app/globals.css");
          await writeFile(path, Buffer.concat([await readFile(path), Buffer.from("\n")]));
        }
      },
      prepareProject: async (...arguments_) => {
        counters.project += 1;
        const value = await prepare(...arguments_);
        if (change === "rendered-input") value.influencingFingerprints[0] = { ...value.influencingFingerprints[0], fingerprint: `sha256:${"a".repeat(64)}` };
        if (change === "target-lock") value.files = value.files.map(file => file.path === "pnpm-lock.yaml" ? { ...file, content: Buffer.from("foreign lock") } : file);
        return value;
      },
    };
    await assert.rejects(h.module.verifyAppTransitionVisuals({ mode: "compare" }, adapters), change === "raw-source" ? /^Error: VISUAL_SOURCE_CHANGED$/ : /^Error: VISUAL_INPUT_IDENTITY_MISSING$/);
    assert.deepEqual(counters, { environment: 1, build: 1, project: change === "raw-source" ? 0 : 1 }, change);
    assert.deepEqual(effects, []);
    assert.deepEqual(h.calls, []);
  }
});

test("comparison reaches final-case source drift before refusing a new comparison manifest", async t => {
  const h = await comparisonHarness(t);
  await assertSyntheticComparison(h);
  h.calls.length = 0;
  const runsRoot = join(h.root, "generated-visual-artifacts/app-transitions");
  const previousRuns = new Set(await readdir(runsRoot));
  const execute = h.adapters.executeCase;
  await assert.rejects(h.module.verifyAppTransitionVisuals({ mode: "compare" }, {
    ...h.adapters, executeCase: async input => {
      const value = await execute(input);
      if (h.calls.length === 8) {
        const path = join(h.root, "packages/builder-core/templates/common/apps/web/app/globals.css");
        await writeFile(path, Buffer.concat([await readFile(path), Buffer.from("\n")]));
      }
      return value;
    },
  }), /^Error: VISUAL_SOURCE_CHANGED$/);
  assert.equal(h.calls.length, 8);
  const newRuns = (await readdir(runsRoot)).filter(name => !previousRuns.has(name));
  assert.equal(newRuns.length, 1);
  assert.equal((await readdir(join(runsRoot, newRuns[0]))).includes("comparison-manifest.json"), false);
});

async function physicalComparisonFixture(t) {
  const fixture = await createSyntheticAppTransitionAdmission(t);
  const effects = [];
  const adapters = {
    repositoryRoot: fixture.root,
    filesystem: refuseWrites(effects),
    inspectEnvironment: async () => { effects.push("environment"); throw new Error("COMPARISON_INPUTS_REACHED_ENVIRONMENT"); },
    prepareBuilder: async () => { effects.push("build"); },
    prepareProject: async () => { effects.push("project"); },
    executeCase: async () => { effects.push("case"); },
  };
  return { ...fixture, effects, adapters };
}

test("preloaded lifecycle policy does not block measuring stable fresh source", async t => {
  const h = await physicalComparisonFixture(t);
  const cached = h.fixedRequire("./src/lifecycle/app-transition-visual-admission.cjs");
  const original = await readFile(join(h.root, admissionLeaf), "utf8");
  const marker = `"manifestSha256": "${cached.record.manifestSha256}"`;
  assert.equal(original.split(marker).length, 2);
  await writeFile(join(h.root, admissionLeaf), original.replace(marker, `"manifestSha256": "${"f".repeat(64)}"`));
  await assert.rejects(h.module.verifyAppTransitionVisuals({ mode: "compare" }, h.adapters), /^Error: COMPARISON_INPUTS_REACHED_ENVIRONMENT$/);
  assert.deepEqual(h.effects, ["environment"]);
});

test("comparison observes physical policy drift despite a preloaded lifecycle policy", async t => {
  const h = await comparisonHarness(t);
  h.fixedRequire("./src/lifecycle/app-transition-visual-admission.cjs");
  const effects = [];
  await assert.rejects(h.module.verifyAppTransitionVisuals({ mode: "compare" }, {
    ...h.adapters, filesystem: refuseWrites(effects), prepareBuilder: async () => {
      const path = join(h.root, admissionLeaf);
      await writeFile(path, Buffer.concat([await readFile(path), Buffer.from("\n// drift after input capture\n")]));
    },
  }), /^Error: VISUAL_SOURCE_CHANGED$/);
  assert.deepEqual(effects, []);
  assert.deepEqual(h.calls, []);
});

test("fresh comparison measures stable unaccepted inputs without granting lifecycle reuse", async t => {
  const h = await comparisonHarness(t);
  const originalPolicy = await readFile(join(h.root, admissionLeaf));
  const sourcePath = "packages/builder-core/templates/common/apps/web/app/globals.css";
  await writeFile(join(h.root, sourcePath), Buffer.concat([await readFile(join(h.root, sourcePath)), Buffer.from("\n/* fresh measurement source */\n")]));
  const prepared = h.preparedProjects.get("none");
  const influenced = prepared.influencingFingerprints.find(entry => prepared.files.some(file => file.path === entry.path));
  assert.ok(influenced);
  const file = prepared.files.find(file => file.path === influenced.path);
  file.content = Buffer.concat([file.content, Buffer.from("\n")]);
  influenced.fingerprint = `sha256:${sha256(file.content)}`;
  const policy = await import(h.verifierUrl);
  const input = { optionalCapabilities: [], influencingFingerprints: prepared.influencingFingerprints,
    targetLockfileFingerprint: "sha256:78ac7e12de2b35c3486eb9f471d80cf2ae33c370768838d7e0fdb62bf85c9706" };
  assert.equal(policy.verifyAppTransitionVisualInputRecord(input).ok, false);
  const adapters = { ...h.adapters };
  const result = await h.module.verifyAppTransitionVisuals({ mode: "compare" }, adapters);
  assert.equal(result.status, "compared");
  assert.equal(h.calls.length, 8);
  const manifest = JSON.parse(await readFile(join(h.root, result.manifestPath)));
  assert.equal(manifest.baselines.length, 4);
  for (const entry of manifest.baselines) {
    assert.equal(sha256(await readFile(join(dirname(join(h.root, result.manifestPath)), entry.path))), entry.sha256);
  }
  assert.equal(policy.verifyAppTransitionVisualInputRecord(input).ok, false);
  assert.deepEqual(await readFile(join(h.root, admissionLeaf)), originalPolicy);
  await assert.rejects(h.module.verifyAppTransitionVisuals({ mode: "promote", digest: result.manifestSha256 }, adapters), /VISUAL_REVIEWED_MANIFEST_MISSING/);
});

test("visual command failure retains its exit when its report is missing or malformed", async t => {
  const h = await harness(t);
  const spec = await readFile(new URL("../../packages/builder-core/templates/common/apps/web/tests/visual/home-visual.spec.ts", import.meta.url));
  for (const report of [undefined, "not JSON"]) {
    const artifactDirectory = join(h.root, report === undefined ? "missing-report" : "invalid-report");
    await mkdir(artifactDirectory);
    await assert.rejects(h.module.executeAppTransitionVisualCase({ subset: [], mode: "compare", baselines: {}, repositoryRoot: h.root, artifactDirectory }, {
      prepareProject: async () => ({ files: [{ path: "apps/web/tests/visual/home-visual.spec.ts", content: spec }], influencingFingerprints: [] }),
      runAudit: async () => ({ status: "passed", rawExitCode: 0, thresholdExitCode: 0 }),
      inspectBrowser: async () => ({ synthetic: true }),
      inspectBuild: async () => ({ synthetic: true }),
      runCommand: async input => {
        if (!input.arguments.includes("test:visual")) return { exitCode: 0, stdout: "prerequisite", stderr: "" };
        if (report !== undefined) await writeFile(input.environment.PLAYWRIGHT_JSON_OUTPUT_FILE, report);
        return { exitCode: 23, stdout: "failed visual stdout", stderr: "failed visual stderr" };
      },
    }));
    const failure = JSON.parse(await readFile(join(artifactDirectory, "failure/failure.json")));
    assert.equal(failure.checks.find(check => check.name === "comparison")?.exitCode, 23);
    assert.equal(await readFile(join(artifactDirectory, "comparison/process.log"), "utf8"), "failed visual stdout\nfailed visual stderr");
  }
});


test("comparison binds operation inputs before build and refuses their drift before artifact writes", async t => {
  for (const path of [admissionLeaf, "packages/builder-core/src/lifecycle/app-profile-transition.ts",
    "packages/builder-core/lockfiles/web-recipe-app-0.2.7/pnpm-lock.yaml",
    "packages/builder-core/templates/portfolio/apps/web/tests/visual/home-visual.spec.ts-snapshots/app-transition-home-mobile-chromium-linux.png",
    "packages/builder-core/src/fresh-measurement-input.ts"]) {
    const h = await comparisonHarness(t);
    const effects = [];
    const adapters = { ...h.adapters, filesystem: refuseWrites(effects), prepareBuilder: async () => {
      const current = await readFile(join(h.root, path)).catch(error => { if (error.code !== "ENOENT") throw error; return Buffer.alloc(0); });
      await writeFile(join(h.root, path), Buffer.concat([current, Buffer.from("\n")]));
    } };
      await assert.rejects(h.module.verifyAppTransitionVisuals({ mode: "compare" }, adapters), /^Error: VISUAL_SOURCE_CHANGED$/);
    assert.deepEqual(effects, []);
    assert.deepEqual(h.calls, []);
  }
});

test("final comparison baseline drift retains failure without a comparison manifest", async t => {
  const h = await comparisonHarness(t);
  const execute = h.adapters.executeCase;
  const adapters = { ...h.adapters, executeCase: async input => {
    const value = await execute(input);
    if (h.calls.length === 8) await writeFile(join(h.root, h.paths[0]), Buffer.concat([await readFile(join(h.root, h.paths[0])), Buffer.from("\n")]));
    return value;
  } };
  await assert.rejects(h.module.verifyAppTransitionVisuals({ mode: "compare" }, adapters), /^Error: VISUAL_SOURCE_CHANGED$/);
  assert.equal(h.calls.length, 8);
  const runs = await readdir(join(h.root, "generated-visual-artifacts/app-transitions"));
  assert.equal(runs.length, 1);
  const run = join(h.root, "generated-visual-artifacts/app-transitions", runs[0]);
  const failure = JSON.parse(await readFile(join(run, "failure.json")));
  assert.equal(failure.sourceUnchanged, false);
  await assert.rejects(access(join(run, "comparison-manifest.json")), { code: "ENOENT" });
});


test("compiled input drift during preparation refuses before comparison artifacts", async t => {
  const h = await comparisonHarness(t);
  const path = "packages/builder-core/dist/serialization/canonical-json.js";
  const effects = [];
  let prepared = 0;
  await assert.rejects(h.module.verifyAppTransitionVisuals({ mode: "compare" }, {
    ...h.adapters, filesystem: refuseWrites(effects),
    snapshotSource: async () => ({ revision: "a".repeat(40), files: [{ path, sha256: sha256(await readFile(join(h.root, path))) }] }),
    prepareProject: async (...arguments_) => {
      const value = await h.adapters.prepareProject(...arguments_);
      if (prepared++ === 0) await writeFile(join(h.root, path), Buffer.concat([await readFile(join(h.root, path)), Buffer.from("\n// compiled bytes changed during preparation\n")]));
      return value;
    },
  }), /^Error: VISUAL_SOURCE_CHANGED$/);
  assert.equal(prepared, 8);
  assert.deepEqual(effects, []);
  assert.deepEqual(h.calls, []);
});


test("comparison baseline export refuses replacement of its captured artifact root before writing", async t => {
  const h = await comparisonHarness(t);
  const runsRoot = join(h.root, "generated-visual-artifacts/app-transitions");
  const baseline = join(h.root, h.paths[0]);
  let replacement;
  const fs = { ...filesystem, open: async (path, ...arguments_) => {
    const handle = await filesystem.open(path, ...arguments_);
    if (path !== baseline) return handle;
    return { stat: () => handle.stat(), close: () => handle.close(), readFile: async () => {
      const content = await handle.readFile();
      if (!replacement) {
        const runs = await readdir(runsRoot).catch(error => { if (error.code !== "ENOENT") throw error; return []; });
        if (runs.length === 1) {
          replacement = join(runsRoot, runs[0]);
          await filesystem.rename(replacement, join(h.root, "retained-original-run"));
          await mkdir(replacement);
        }
      }
      return content;
    } };
  } };
  await assert.rejects(h.module.verifyAppTransitionVisuals({ mode: "compare" }, { ...h.adapters, filesystem: fs }), /^Error: VISUAL_ROOT_CHANGED$/);
  assert.ok(replacement, "the replacement must occur during the baseline export read");
  assert.deepEqual(await readdir(replacement), [], "a replacement run must receive no baseline directory, files or failure artifacts");
  assert.deepEqual(h.calls, []);
  await assert.rejects(access(join(replacement, "comparison-manifest.json")), { code: "ENOENT" });
});
