import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

import {
  createLighthouseConfiguration,
  decodePerformanceBaseline,
  decodePerformanceBudget,
  decodePerformancePolicy,
  derivePerformanceThresholds,
  isDirectExecution,
  loadLighthouseReports,
  runPerformanceBudgets,
  summarizeLighthouseReports,
  validatePreviewResponse,
} from "../../packages/builder-core/templates/common/apps/web/scripts/run-performance-budgets.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const runnerPath = resolve(
  repositoryRoot,
  "packages/builder-core/templates/common/apps/web/scripts/run-performance-budgets.mjs",
);
const policyPath = resolve(
  repositoryRoot,
  "packages/builder-core/templates/common/apps/web/performance-policy.json",
);
const metricIdentifiers = Object.freeze([
  "first-contentful-paint",
  "largest-contentful-paint",
  "total-blocking-time",
  "cumulative-layout-shift",
  "speed-index",
  "resource-summary:total:size",
  "resource-summary:script:size",
  "resource-summary:stylesheet:size",
  "resource-summary:font:size",
  "resource-summary:image:size",
  "resource-summary:third-party:count",
]);
const acceptedMedians = Object.freeze({
  "first-contentful-paint": 1100,
  "largest-contentful-paint": 2050,
  "total-blocking-time": 110,
  "cumulative-layout-shift": 0.07,
  "speed-index": 2600,
  "resource-summary:total:size": 310000,
  "resource-summary:script:size": 160000,
  "resource-summary:stylesheet:size": 22000,
  "resource-summary:font:size": 12000,
  "resource-summary:image:size": 32000,
  "resource-summary:third-party:count": 0,
});

function clone(value) {
  return structuredClone(value);
}

function createBudget() {
  return {
    schemaVersion: "1.0.0",
    scenarios: [
      {
        identifier: "home",
        path: "/",
        baselineVariants: ["site"],
      },
      {
        identifier: "about",
        path: "/about",
        baselineVariants: ["site"],
      },
    ],
    exceptions: [],
  };
}

function createBaseline() {
  return {
    schemaVersion: "1.0.0",
    calibratedOn: "2026-08-20",
    environment: {
      image:
        "mcr.microsoft.com/playwright:v1.62.1-noble@sha256:dcc5531e97840b9b5e794f2814476b21571c5124a3fca2267d73041f56e7580e",
      platform: "linux/amd64",
      node: "22.23.2",
      pnpm: "11.20.0",
      lighthouseCi: "0.15.1",
      lighthouse: "12.6.1",
      playwright: "1.62.1",
      chromium: "chromium-123456",
      cpuQuota: 2,
      memoryBytes: 4294967296,
    },
    measurements: ["/", "/about"].flatMap((path) =>
      metricIdentifiers.map((metric) => {
        const acceptedMedian = acceptedMedians[metric];
        return {
          variant: "site",
          path,
          metric,
          batchMedians: [acceptedMedian / 2, acceptedMedian],
          acceptedMedian,
        };
      }),
    ),
  };
}

function createLighthouseReport(url, index, overrides = {}) {
  const increment = index * 10;
  const resourceItems = [
    { resourceType: "total", transferSize: 300000 + increment, requestCount: 20 },
    { resourceType: "script", transferSize: 150000 + increment, requestCount: 8 },
    { resourceType: "stylesheet", transferSize: 20000 + increment, requestCount: 2 },
    { resourceType: "font", transferSize: 10000 + increment, requestCount: 1 },
    { resourceType: "image", transferSize: 30000 + increment, requestCount: 3 },
    { resourceType: "third-party", transferSize: 0, requestCount: 0 },
  ];
  return {
    lighthouseVersion: "12.6.1",
    requestedUrl: url,
    finalUrl: url,
    fetchTime: `2026-08-20T00:00:${String(index).padStart(2, "0")}.000Z`,
    environment: { benchmarkIndex: 1000 + increment },
    categories: { performance: { score: 0.9 - index / 100 } },
    audits: {
      "first-contentful-paint": { numericValue: 1000 + increment },
      "largest-contentful-paint": { numericValue: 2000 + increment },
      "total-blocking-time": { numericValue: 100 + increment },
      "cumulative-layout-shift": { numericValue: 0.01 + index / 100 },
      "speed-index": { numericValue: 2500 + increment },
      "server-response-time": { numericValue: 50 + increment },
      "largest-contentful-paint-element": {
        details: { items: [{ node: { selector: "main h1" } }] },
      },
      "resource-summary": { details: { items: resourceItems } },
    },
    ...overrides,
  };
}

async function readPolicy() {
  return JSON.parse(await readFile(policyPath, "utf8"));
}

async function expectRunnerError(callback, expectedCode) {
  await assert.rejects(callback, (error) => {
    assert.equal(error?.name, "PerformanceBudgetRunnerError");
    assert.equal(error?.code, expectedCode);
    assert.equal(String(error), `${error.name}: ${expectedCode}`);
    assert.doesNotMatch(String(error), /PRIVATE_VALUE/u);
    return true;
  });
}

test("managed policy fixes the approved toolchain, execution, and hard ceilings", async () => {
  const policy = decodePerformancePolicy(await readPolicy());

  assert.deepEqual(policy.toolchain, {
    lighthouseCi: "0.15.1",
    lighthouse: "12.6.1",
    playwright: "1.62.1",
  });
  assert.deepEqual(policy.execution, {
    runs: 5,
    aggregation: "median",
    origin: "http://127.0.0.1:3102",
    formFactor: "mobile",
  });
  assert.deepEqual(policy.metrics, {
    "first-contentful-paint": {
      hardMaximum: 1800,
      relativeHeadroom: 0.2,
      absoluteHeadroom: 100,
      roundingQuantum: 50,
    },
    "largest-contentful-paint": {
      hardMaximum: 2500,
      relativeHeadroom: 0.2,
      absoluteHeadroom: 100,
      roundingQuantum: 50,
    },
    "total-blocking-time": {
      hardMaximum: 200,
      relativeHeadroom: 0.2,
      absoluteHeadroom: 25,
      roundingQuantum: 25,
    },
    "cumulative-layout-shift": {
      hardMaximum: 0.1,
      relativeHeadroom: 0,
      absoluteHeadroom: 0.02,
      roundingQuantum: 0.01,
    },
    "speed-index": {
      hardMaximum: 3400,
      relativeHeadroom: 0.2,
      absoluteHeadroom: 100,
      roundingQuantum: 50,
    },
    "resource-summary:total:size": {
      hardMaximum: 353280,
      relativeHeadroom: 0.1,
      absoluteHeadroom: 8192,
      roundingQuantum: 8192,
    },
    "resource-summary:script:size": {
      hardMaximum: 204800,
      relativeHeadroom: 0.1,
      absoluteHeadroom: 8192,
      roundingQuantum: 8192,
    },
    "resource-summary:stylesheet:size": {
      hardMaximum: 35840,
      relativeHeadroom: 0.1,
      absoluteHeadroom: 8192,
      roundingQuantum: 8192,
    },
    "resource-summary:font:size": {
      hardMaximum: 30720,
      relativeHeadroom: 0.1,
      absoluteHeadroom: 8192,
      roundingQuantum: 8192,
    },
    "resource-summary:image:size": {
      hardMaximum: 51200,
      relativeHeadroom: 0.1,
      absoluteHeadroom: 8192,
      roundingQuantum: 8192,
    },
    "resource-summary:third-party:count": {
      hardMaximum: 0,
      relativeHeadroom: 0,
      absoluteHeadroom: 0,
      roundingQuantum: 1,
    },
  });
});

test("policy, budget, and baseline decoders reject non-exact or inconsistent data", async () => {
  const policy = await readPolicy();
  const budget = createBudget();
  const baseline = createBaseline();

  assert.deepEqual(decodePerformanceBudget(budget), budget);
  assert.deepEqual(decodePerformanceBaseline(baseline, { policy, budget }), baseline);

  const policyWithExtraKey = clone(policy);
  policyWithExtraKey.execution.unapproved = true;
  assert.throws(() => decodePerformancePolicy(policyWithExtraKey), {
    name: "PerformanceBudgetRunnerError",
    code: "PERFORMANCE_POLICY_INVALID",
  });

  for (const invalidPolicy of [
    { ...policy, schemaVersion: "2.0.0" },
    { ...policy, execution: { ...policy.execution, runs: 4 } },
    {
      ...policy,
      execution: { ...policy.execution, origin: "http://localhost:3102" },
    },
    {
      ...policy,
      metrics: {
        ...policy.metrics,
        "first-contentful-paint": {
          ...policy.metrics["first-contentful-paint"],
          hardMaximum: "1800",
        },
      },
    },
  ]) {
    assert.throws(() => decodePerformancePolicy(invalidPolicy), {
      code: "PERFORMANCE_POLICY_INVALID",
    });
  }

  const reversedBudget = clone(budget);
  reversedBudget.scenarios.reverse();
  assert.throws(() => decodePerformanceBudget(reversedBudget), {
    code: "PERFORMANCE_BUDGET_INVALID",
  });
  const duplicateBudget = clone(budget);
  duplicateBudget.scenarios[1].path = "/";
  assert.throws(() => decodePerformanceBudget(duplicateBudget), {
    code: "PERFORMANCE_BUDGET_INVALID",
  });

  const incompleteBaseline = clone(baseline);
  incompleteBaseline.measurements.pop();
  assert.throws(
    () => decodePerformanceBaseline(incompleteBaseline, { policy, budget }),
    { code: "PERFORMANCE_BASELINE_INVALID" },
  );
  const duplicateBaseline = clone(baseline);
  duplicateBaseline.measurements.push(clone(duplicateBaseline.measurements[0]));
  assert.throws(
    () => decodePerformanceBaseline(duplicateBaseline, { policy, budget }),
    { code: "PERFORMANCE_BASELINE_INVALID" },
  );
  const mismatchedMedian = clone(baseline);
  mismatchedMedian.measurements[0].acceptedMedian += 1;
  assert.throws(
    () => decodePerformanceBaseline(mismatchedMedian, { policy, budget }),
    { code: "PERFORMANCE_BASELINE_INVALID" },
  );
  const wrongEnvironment = clone(baseline);
  wrongEnvironment.environment.lighthouse = "12.6.0";
  assert.throws(
    () => decodePerformanceBaseline(wrongEnvironment, { policy, budget }),
    { code: "PERFORMANCE_BASELINE_INVALID" },
  );
});

test("budget decoder accepts only the complete portfolio or site route matrix", () => {
  const portfolioBudget = {
    schemaVersion: "1.0.0",
    scenarios: [
      {
        identifier: "home",
        path: "/",
        baselineVariants: ["portfolio", "portfolio-calendly"],
      },
    ],
    exceptions: [],
  };
  assert.deepEqual(decodePerformanceBudget(portfolioBudget), portfolioBudget);
  assert.deepEqual(decodePerformanceBudget(createBudget()), createBudget());

  const incompleteSiteBudget = createBudget();
  incompleteSiteBudget.scenarios.pop();
  assert.throws(() => decodePerformanceBudget(incompleteSiteBudget), {
    code: "PERFORMANCE_BUDGET_INVALID",
  });

  const incompletePortfolioBudget = clone(portfolioBudget);
  incompletePortfolioBudget.scenarios[0].baselineVariants.pop();
  assert.throws(() => decodePerformanceBudget(incompletePortfolioBudget), {
    code: "PERFORMANCE_BUDGET_INVALID",
  });

  const mixedProfileBudget = createBudget();
  mixedProfileBudget.scenarios[0].baselineVariants = ["portfolio", "site"];
  assert.throws(() => decodePerformanceBudget(mixedProfileBudget), {
    code: "PERFORMANCE_BUDGET_INVALID",
  });
});

test("threshold derivation uses the exact formula, rounding, caps, and exceptions", async () => {
  const policy = decodePerformancePolicy(await readPolicy());
  const budget = decodePerformanceBudget(createBudget());
  const baseline = decodePerformanceBaseline(createBaseline(), { policy, budget });
  const [home] = derivePerformanceThresholds({
    policy,
    budget,
    baseline,
    currentDate: "2026-08-20",
  });

  assert.deepEqual(home.thresholds, {
    "first-contentful-paint": 1350,
    "largest-contentful-paint": 2500,
    "total-blocking-time": 150,
    "cumulative-layout-shift": 0.09,
    "speed-index": 3150,
    "resource-summary:total:size": 344064,
    "resource-summary:script:size": 180224,
    "resource-summary:stylesheet:size": 32768,
    "resource-summary:font:size": 24576,
    "resource-summary:image:size": 40960,
    "resource-summary:third-party:count": 0,
  });

  const overCeilingBaseline = clone(baseline);
  const overCeiling = overCeilingBaseline.measurements.find(
    ({ path, metric }) => path === "/" && metric === "first-contentful-paint",
  );
  overCeiling.batchMedians = [1800, 1801];
  overCeiling.acceptedMedian = 1801;
  assert.throws(
    () =>
      derivePerformanceThresholds({
        policy,
        budget,
        baseline: overCeilingBaseline,
        currentDate: "2026-08-20",
      }),
    { code: "PERFORMANCE_THRESHOLD_INVALID" },
  );

  const activeBudget = clone(budget);
  activeBudget.exceptions.push({
    route: "/",
    metric: "first-contentful-paint",
    temporaryMaximum: 1500,
    reason: "Causal browser update under review",
    owner: "web-platform",
    approvalReference: "PERF-123",
    expiresOn: "2026-08-20",
    removalGate: "Remove after accepted recalibration",
  });
  const activeThreshold = derivePerformanceThresholds({
    policy,
    budget: decodePerformanceBudget(activeBudget),
    baseline,
    currentDate: "2026-08-20",
  })[0];
  assert.equal(activeThreshold.thresholds["first-contentful-paint"], 1500);
  assert.equal(activeThreshold.activeExceptions.length, 1);

  const expiredBudget = clone(activeBudget);
  expiredBudget.exceptions[0].expiresOn = "2026-08-19";
  assert.throws(
    () =>
      derivePerformanceThresholds({
        policy,
        budget: decodePerformanceBudget(expiredBudget),
        baseline,
        currentDate: "2026-08-20",
      }),
    { code: "PERFORMANCE_EXCEPTION_EXPIRED" },
  );
  const outOfCapBudget = clone(activeBudget);
  outOfCapBudget.exceptions[0].temporaryMaximum = 1801;
  assert.throws(
    () =>
      derivePerformanceThresholds({
        policy,
        budget: decodePerformanceBudget(outOfCapBudget),
        baseline,
        currentDate: "2026-08-20",
      }),
    { code: "PERFORMANCE_EXCEPTION_INVALID" },
  );
  const thirdPartyBudget = clone(activeBudget);
  thirdPartyBudget.exceptions[0].metric = "resource-summary:third-party:count";
  thirdPartyBudget.exceptions[0].temporaryMaximum = 0;
  assert.throws(
    () =>
      derivePerformanceThresholds({
        policy,
        budget: decodePerformanceBudget(thirdPartyBudget),
        baseline,
        currentDate: "2026-08-20",
      }),
    { code: "PERFORMANCE_EXCEPTION_INVALID" },
  );
});

test("derived Lighthouse config fixes mobile collection and route-specific median assertions", async () => {
  const policy = decodePerformancePolicy(await readPolicy());
  const budget = decodePerformanceBudget(createBudget());
  const baseline = decodePerformanceBaseline(createBaseline(), { policy, budget });
  const configuration = createLighthouseConfiguration({
    policy,
    budget,
    baseline,
    currentDate: "2026-08-20",
    chromiumPath: "/ms-playwright/chromium/chrome",
  });

  assert.deepEqual(configuration.ci.collect, {
    url: [
      "http://127.0.0.1:3102/",
      "http://127.0.0.1:3102/about",
    ],
    numberOfRuns: 5,
    additive: true,
    chromePath: "/ms-playwright/chromium/chrome",
    settings: {
      onlyCategories: ["performance"],
      formFactor: "mobile",
      throttlingMethod: "simulate",
      throttling: {
        rttMs: 150,
        throughputKbps: 1638.4,
        downloadThroughputKbps: 1638.4,
        uploadThroughputKbps: 675,
        cpuSlowdownMultiplier: 4,
      },
      screenEmulation: {
        mobile: true,
        width: 412,
        height: 823,
        deviceScaleFactor: 1,
        disabled: false,
      },
      locale: "en-CA",
      disableStorageReset: false,
      chromeFlags: "--lang=en-CA --force-prefers-color-scheme=light",
    },
  });
  assert.deepEqual(
    configuration.ci.assert.assertMatrix.map(({ matchingUrlPattern }) =>
      matchingUrlPattern,
    ),
    [
      "^http://127\\.0\\.0\\.1:3102/$",
      "^http://127\\.0\\.0\\.1:3102/about$",
    ],
  );
  assert.deepEqual(
    configuration.ci.assert.assertMatrix[0].assertions[
      "first-contentful-paint"
    ],
    ["error", { aggregationMethod: "median", maxNumericValue: 1350 }],
  );
  assert.equal(configuration.ci.upload, undefined);
});

test("Lighthouse summaries require five valid, unique, exact-route reports", async () => {
  const policy = decodePerformancePolicy(await readPolicy());
  const budget = decodePerformanceBudget(createBudget());
  const baseline = decodePerformanceBaseline(createBaseline(), { policy, budget });
  const urls = [
    "http://127.0.0.1:3102/",
    "http://127.0.0.1:3102/about",
  ];
  const reports = urls.flatMap((url) =>
    [0, 1, 2, 3, 4].map((index) => ({
      sourcePath: `lhr-${url.endsWith("about") ? index + 5 : index}.json`,
      report: createLighthouseReport(url, index),
    })),
  );
  const summary = summarizeLighthouseReports({
    policy,
    budget,
    baseline,
    reports,
    currentDate: "2026-08-20",
  });

  assert.equal(summary.schemaVersion, "1.0.0");
  assert.deepEqual(summary.environment, baseline.environment);
  assert.deepEqual(
    summary.routes.map(({ path, samples }) => [path, samples.length]),
    [["/", 5], ["/about", 5]],
  );
  assert.equal(summary.routes[0].medians["first-contentful-paint"], 1020);
  assert.equal(summary.routes[0].medians["resource-summary:total:size"], 300020);
  assert.equal(summary.routes[0].diagnostics.medians.performanceScore, 0.88);
  assert.equal(summary.routes[0].diagnostics.largestContentfulElement, "main h1");
  assert.deepEqual(summary.failureCodes, []);

  const invalidCases = [
    {
      code: "PERFORMANCE_EVIDENCE_MISSING",
      reports: reports.slice(1),
    },
    {
      code: "PERFORMANCE_EVIDENCE_DUPLICATE",
      reports: reports.map((entry, index) =>
        index === 1
          ? {
              ...entry,
              report: { ...entry.report, fetchTime: reports[0].report.fetchTime },
            }
          : entry,
      ),
    },
    {
      code: "PERFORMANCE_EVIDENCE_VERSION_INVALID",
      reports: reports.map((entry, index) =>
        index === 0
          ? { ...entry, report: { ...entry.report, lighthouseVersion: "12.6.0" } }
          : entry,
      ),
    },
    {
      code: "PERFORMANCE_EVIDENCE_ROUTE_INVALID",
      reports: reports.map((entry, index) =>
        index === 0
          ? {
              ...entry,
              report: { ...entry.report, requestedUrl: "http://127.0.0.1:3102/missing" },
            }
          : entry,
      ),
    },
    {
      code: "PERFORMANCE_EVIDENCE_REDIRECTED",
      reports: reports.map((entry, index) =>
        index === 0
          ? {
              ...entry,
              report: { ...entry.report, finalUrl: "http://127.0.0.1:3102/about" },
            }
          : entry,
      ),
    },
    {
      code: "PERFORMANCE_EVIDENCE_ORIGIN_INVALID",
      reports: reports.map((entry, index) =>
        index === 0
          ? {
              ...entry,
              report: { ...entry.report, finalUrl: "https://private.invalid/" },
            }
          : entry,
      ),
    },
    {
      code: "PERFORMANCE_EVIDENCE_METRIC_INVALID",
      reports: reports.map((entry, index) => {
        if (index !== 0) return entry;
        const report = clone(entry.report);
        report.audits["first-contentful-paint"].numericValue = "1000";
        return { ...entry, report };
      }),
    },
  ];
  for (const invalidCase of invalidCases) {
    assert.throws(
      () =>
        summarizeLighthouseReports({
          policy,
          budget,
          baseline,
          reports: invalidCase.reports,
          currentDate: "2026-08-20",
        }),
      { code: invalidCase.code },
    );
  }
});

test("evidence loading rejects symlinks and oversized reports", async () => {
  const owner = await mkdtemp(join(tmpdir(), "performance-evidence-"));
  try {
    await writeFile(
      join(owner, "lhr-0.json"),
      JSON.stringify(createLighthouseReport("http://127.0.0.1:3102/", 0)),
    );
    await writeFile(join(owner, "lhr-0.html"), "<!doctype html>");
    assert.equal((await loadLighthouseReports(owner)).length, 1);

    await symlink("lhr-0.json", join(owner, "lhr-1.json"));
    await expectRunnerError(
      () => loadLighthouseReports(owner),
      "PERFORMANCE_EVIDENCE_PATH_INVALID",
    );
    await rm(join(owner, "lhr-1.json"));

    await writeFile(join(owner, "lhr-1.json"), Buffer.alloc(8 * 1024 * 1024 + 1));
    await expectRunnerError(
      () => loadLighthouseReports(owner),
      "PERFORMANCE_EVIDENCE_OVERSIZED",
    );
  } finally {
    await rm(owner, { recursive: true, force: true });
  }
});

test("preview validation rejects redirects and non-loopback final URLs", () => {
  const expectedUrl = "http://127.0.0.1:3102/";
  assert.equal(
    validatePreviewResponse(expectedUrl, {
      ok: true,
      status: 200,
      finalUrl: expectedUrl,
    }),
    true,
  );
  assert.throws(
    () =>
      validatePreviewResponse(expectedUrl, {
        ok: false,
        status: 302,
        finalUrl: expectedUrl,
      }),
    { code: "PERFORMANCE_PREVIEW_READINESS_FAILED" },
  );
  assert.throws(
    () =>
      validatePreviewResponse(expectedUrl, {
        ok: true,
        status: 200,
        finalUrl: "https://private.invalid/",
      }),
    { code: "PERFORMANCE_PREVIEW_READINESS_FAILED" },
  );
});

test("runner is import-inert and uses fixed shell-free processes with owned cleanup", async () => {
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `await import(${JSON.stringify(pathToFileURL(runnerPath).href)});`,
    ],
    { cwd: repositoryRoot, encoding: "utf8" },
  );
  assert.equal(stdout, "");
  assert.equal(stderr, "");
  assert.equal(
    isDirectExecution(pathToFileURL(runnerPath).href, [
      process.execPath,
      runnerPath,
    ]),
    true,
  );
  assert.equal(
    isDirectExecution(pathToFileURL(runnerPath).href, [process.execPath, "elsewhere.mjs"]),
    false,
  );

  const webRoot = await mkdtemp(join(tmpdir(), "performance-runner-"));
  const commands = [];
  const probes = [];
  let readinessAttempts = 0;
  let previewInput;
  let stoppedPreview;
  const previousTestSecret = process.env.PERFORMANCE_TEST_SECRET;
  process.env.PERFORMANCE_TEST_SECRET = "PRIVATE_VALUE";
  try {
    await writeFile(join(webRoot, "performance-policy.json"), JSON.stringify(await readPolicy()));
    await writeFile(join(webRoot, "performance-budget.json"), JSON.stringify(createBudget()));
    await writeFile(join(webRoot, "performance-baseline.json"), JSON.stringify(createBaseline()));

    const summary = await runPerformanceBudgets(
      { webRoot, currentDate: "2026-08-20" },
      {
        async resolveChromiumPath() {
          return "/ms-playwright/chromium/chrome";
        },
        async startPreview(input) {
          previewInput = input;
          return { pid: 12345, exitCode: null };
        },
        async probeRoute(url) {
          probes.push(url);
          readinessAttempts += 1;
          if (readinessAttempts === 1) {
            return { ok: false, status: 503, finalUrl: url };
          }
          return { ok: true, status: 200, finalUrl: url };
        },
        async delay() {},
        async runCommand(input) {
          commands.push(input);
          if (input.arguments.includes("collect")) {
            const urls = [
              "http://127.0.0.1:3102/",
              "http://127.0.0.1:3102/about",
            ];
            let reportIndex = 0;
            for (const url of urls) {
              for (let index = 0; index < 5; index += 1) {
                await writeFile(
                  join(webRoot, ".lighthouseci", `lhr-${reportIndex}.json`),
                  JSON.stringify(createLighthouseReport(url, index)),
                );
                await writeFile(
                  join(webRoot, ".lighthouseci", `lhr-${reportIndex}.html`),
                  "<!doctype html>",
                );
                reportIndex += 1;
              }
            }
          }
        },
        async stopPreview(preview) {
          stoppedPreview = preview;
        },
      },
    );

    assert.deepEqual(previewInput.executable, "pnpm");
    assert.deepEqual(previewInput.arguments, [
      "exec",
      "opennextjs-cloudflare",
      "preview",
      "--",
      "--ip",
      "127.0.0.1",
      "--port",
      "3102",
    ]);
    assert.equal(previewInput.shell, false);
    assert.deepEqual(probes, [
      "http://127.0.0.1:3102/",
      "http://127.0.0.1:3102/",
      "http://127.0.0.1:3102/about",
    ]);
    assert.deepEqual(
      commands.map(({ executable, arguments: arguments_, shell }) => ({
        executable,
        arguments: arguments_,
        shell,
      })),
      [
        {
          executable: "pnpm",
          arguments: [
            "exec",
            "lhci",
            "collect",
            "--config=.lighthouseci/assertion-config.json",
          ],
          shell: false,
        },
        {
          executable: "pnpm",
          arguments: [
            "exec",
            "lhci",
            "assert",
            "--config=.lighthouseci/assertion-config.json",
          ],
          shell: false,
        },
      ],
    );
    assert.deepEqual(stoppedPreview, { pid: 12345, exitCode: null });
    assert.equal(summary.routes.length, 2);
    assert.deepEqual(
      JSON.parse(
        await readFile(join(webRoot, ".lighthouseci", "performance-summary.json"), "utf8"),
      ),
      summary,
    );
    const configuration = JSON.parse(
      await readFile(join(webRoot, ".lighthouseci", "assertion-config.json"), "utf8"),
    );
    assert.equal(configuration.ci.collect.numberOfRuns, 5);
    const manifest = JSON.parse(
      await readFile(join(webRoot, ".lighthouseci", "manifest.json"), "utf8"),
    );
    assert.equal(manifest.schemaVersion, "1.0.0");
    assert.equal(manifest.reports.length, 10);
    assert.deepEqual(manifest.reports[0], {
      jsonPath: "lhr-0.json",
      htmlPath: "lhr-0.html",
      lighthouseVersion: "12.6.1",
      requestedUrl: "http://127.0.0.1:3102/",
      finalUrl: "http://127.0.0.1:3102/",
      fetchTime: "2026-08-20T00:00:00.000Z",
    });
    assert.equal((await readdir(join(webRoot, ".lighthouseci"))).some(
      (name) => name.startsWith("runtime-"),
    ), false);
    assert.equal(
      commands.every(
        ({ environment }) =>
          environment.PERFORMANCE_TEST_SECRET === undefined &&
          environment.TZ === "America/Toronto",
      ),
      true,
    );
  } finally {
    if (previousTestSecret === undefined) {
      delete process.env.PERFORMANCE_TEST_SECRET;
    } else {
      process.env.PERFORMANCE_TEST_SECRET = previousTestSecret;
    }
    await rm(webRoot, { recursive: true, force: true });
  }
});

test("an early output failure removes identity-owned runtime state", async () => {
  const webRoot = await mkdtemp(join(tmpdir(), "performance-runner-output-failure-"));
  let previewStarted = false;
  try {
    await writeFile(join(webRoot, "performance-policy.json"), JSON.stringify(await readPolicy()));
    await writeFile(join(webRoot, "performance-budget.json"), JSON.stringify(createBudget()));
    await writeFile(join(webRoot, "performance-baseline.json"), JSON.stringify(createBaseline()));

    await expectRunnerError(
      () =>
        runPerformanceBudgets(
          { webRoot, currentDate: "2026-08-20" },
          {
            async resolveChromiumPath() {
              return "/ms-playwright/chromium/chrome";
            },
            async writeJson() {
              throw new Error("PRIVATE_VALUE");
            },
            async startPreview() {
              previewStarted = true;
              throw new Error("PRIVATE_VALUE");
            },
          },
        ),
      "PERFORMANCE_OUTPUT_INVALID",
    );
    assert.equal(previewStarted, false);
    assert.equal(
      (await readdir(join(webRoot, ".lighthouseci"))).some((name) =>
        name.startsWith("runtime-"),
      ),
      false,
    );
  } finally {
    await rm(webRoot, { recursive: true, force: true });
  }
});

test("runner maps child failures to redacted stable codes and still stops its process", async () => {
  const webRoot = await mkdtemp(join(tmpdir(), "performance-runner-failure-"));
  let stopped = false;
  try {
    await writeFile(join(webRoot, "performance-policy.json"), JSON.stringify(await readPolicy()));
    await writeFile(join(webRoot, "performance-budget.json"), JSON.stringify(createBudget()));
    await writeFile(join(webRoot, "performance-baseline.json"), JSON.stringify(createBaseline()));
    await expectRunnerError(
      () =>
        runPerformanceBudgets(
          { webRoot, currentDate: "2026-08-20" },
          {
            async resolveChromiumPath() {
              return "/ms-playwright/chromium/chrome";
            },
            async startPreview() {
              return { pid: 12345, exitCode: null };
            },
            async probeRoute(url) {
              return { ok: true, status: 200, finalUrl: url };
            },
            async runCommand() {
              throw new Error("PRIVATE_VALUE");
            },
            async stopPreview() {
              stopped = true;
            },
          },
        ),
      "PERFORMANCE_COLLECTION_FAILED",
    );
    assert.equal(stopped, true);
    assert.equal(
      (await readdir(join(webRoot, ".lighthouseci"))).some((name) =>
        name.startsWith("runtime-"),
      ),
      false,
    );
  } finally {
    await rm(webRoot, { recursive: true, force: true });
  }
});

test("runner reports primary and cleanup failures together in stable order", async () => {
  const webRoot = await mkdtemp(join(tmpdir(), "performance-runner-dual-failure-"));
  try {
    await writeFile(join(webRoot, "performance-policy.json"), JSON.stringify(await readPolicy()));
    await writeFile(join(webRoot, "performance-budget.json"), JSON.stringify(createBudget()));
    await writeFile(join(webRoot, "performance-baseline.json"), JSON.stringify(createBaseline()));

    await assert.rejects(
      () =>
        runPerformanceBudgets(
          { webRoot, currentDate: "2026-08-20" },
          {
            async resolveChromiumPath() {
              return "/ms-playwright/chromium/chrome";
            },
            async startPreview() {
              return { pid: 12345, exitCode: null };
            },
            async probeRoute(url) {
              return { ok: true, status: 200, finalUrl: url };
            },
            async runCommand() {
              throw new Error("PRIVATE_VALUE");
            },
            async stopPreview() {
              throw new Error("PRIVATE_VALUE");
            },
          },
        ),
      (error) => {
        assert.equal(error?.name, "PerformanceBudgetRunnerError");
        assert.equal(error?.code, "PERFORMANCE_COLLECTION_FAILED");
        assert.deepEqual(error?.codes, [
          "PERFORMANCE_COLLECTION_FAILED",
          "PERFORMANCE_CLEANUP_FAILED",
        ]);
        assert.equal(
          String(error),
          "PerformanceBudgetRunnerError: PERFORMANCE_COLLECTION_FAILED\nPERFORMANCE_CLEANUP_FAILED",
        );
        assert.doesNotMatch(String(error), /PRIVATE_VALUE/u);
        return true;
      },
    );
  } finally {
    await rm(webRoot, { recursive: true, force: true });
  }
});
