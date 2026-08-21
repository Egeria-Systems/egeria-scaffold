import { execFile, spawn } from "node:child_process";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const artifactDirectoryName = ".lighthouseci";
const assertionConfigurationName = "assertion-config.json";
const summaryName = "performance-summary.json";
const maximumConfigurationBytes = 1024 * 1024;
const maximumReportBytes = 8 * 1024 * 1024;
const maximumReportsBytes = 32 * 1024 * 1024;
const readinessTimeoutMilliseconds = 120_000;
const readinessPollMilliseconds = 250;
const commandTimeoutMilliseconds = 10 * 60_000;
const cleanupTimeoutMilliseconds = 5_000;

export const performanceMetricIdentifiers = Object.freeze([
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

const metricIdentifierSet = new Set(performanceMetricIdentifiers);
const allowedVariants = Object.freeze([
  "portfolio",
  "portfolio-calendly",
  "site",
]);
const allowedVariantSet = new Set(allowedVariants);
const resourceMetrics = Object.freeze({
  "resource-summary:total:size": {
    resourceType: "total",
    property: "transferSize",
  },
  "resource-summary:script:size": {
    resourceType: "script",
    property: "transferSize",
  },
  "resource-summary:stylesheet:size": {
    resourceType: "stylesheet",
    property: "transferSize",
  },
  "resource-summary:font:size": {
    resourceType: "font",
    property: "transferSize",
  },
  "resource-summary:image:size": {
    resourceType: "image",
    property: "transferSize",
  },
  "resource-summary:third-party:count": {
    resourceType: "third-party",
    property: "requestCount",
  },
});

const expectedPolicy = Object.freeze({
  schemaVersion: "1.0.0",
  toolchain: Object.freeze({
    lighthouseCi: "0.15.1",
    lighthouse: "13.4.1",
    playwright: "1.62.1",
  }),
  execution: Object.freeze({
    runs: 5,
    aggregation: "median",
    origin: "http://127.0.0.1:3102",
    formFactor: "mobile",
  }),
});

export class PerformanceBudgetRunnerError extends Error {
  constructor(code, relatedCodes = []) {
    const codes = Object.freeze([...new Set([code, ...relatedCodes])]);
    super(codes.join("\n"));
    this.name = "PerformanceBudgetRunnerError";
    this.code = code;
    this.codes = codes;
  }
}

function fail(code) {
  throw new PerformanceBudgetRunnerError(code);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value, expectedKeys) {
  if (!isObject(value)) return false;
  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  return (
    actualKeys.length === sortedExpectedKeys.length &&
    actualKeys.every((key, index) => key === sortedExpectedKeys[index])
  );
}

function isFiniteNonnegativeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isNonemptyBoundedString(value, maximumLength = 512) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximumLength &&
    value.trim() === value
  );
}

function isIsoCalendarDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function clone(value) {
  return structuredClone(value);
}

function validateMetricPolicy(actual, metric) {
  const isThirdPartyCount = metric === "resource-summary:third-party:count";
  return (
    hasExactKeys(actual, [
      "hardMaximum",
      "relativeHeadroom",
      "absoluteHeadroom",
      "roundingQuantum",
    ]) &&
    isFiniteNonnegativeNumber(actual.hardMaximum) &&
    isFiniteNonnegativeNumber(actual.relativeHeadroom) &&
    isFiniteNonnegativeNumber(actual.absoluteHeadroom) &&
    isFiniteNonnegativeNumber(actual.roundingQuantum) &&
    actual.roundingQuantum > 0 &&
    (!isThirdPartyCount ||
      (actual.hardMaximum === 0 &&
        actual.relativeHeadroom === 0 &&
        actual.absoluteHeadroom === 0 &&
        actual.roundingQuantum === 1))
  );
}

export function decodePerformancePolicy(value) {
  if (
    !hasExactKeys(value, ["schemaVersion", "toolchain", "execution", "metrics"]) ||
    value.schemaVersion !== expectedPolicy.schemaVersion ||
    !hasExactKeys(value.toolchain, ["lighthouseCi", "lighthouse", "playwright"]) ||
    !Object.entries(expectedPolicy.toolchain).every(
      ([key, expectedValue]) => value.toolchain[key] === expectedValue,
    ) ||
    !hasExactKeys(value.execution, ["runs", "aggregation", "origin", "formFactor"]) ||
    !Object.entries(expectedPolicy.execution).every(
      ([key, expectedValue]) => value.execution[key] === expectedValue,
    ) ||
    !hasExactKeys(value.metrics, performanceMetricIdentifiers) ||
    !performanceMetricIdentifiers.every((metric) =>
      validateMetricPolicy(value.metrics[metric], metric),
    )
  ) {
    fail("PERFORMANCE_POLICY_INVALID");
  }
  return clone(value);
}

function validateScenario(scenario) {
  if (
    !hasExactKeys(scenario, ["identifier", "path", "baselineVariants"]) ||
    !Array.isArray(scenario.baselineVariants) ||
    scenario.baselineVariants.length === 0 ||
    scenario.baselineVariants.some((variant) => !allowedVariantSet.has(variant)) ||
    new Set(scenario.baselineVariants).size !== scenario.baselineVariants.length
  ) {
    return false;
  }
  const orderedVariants = allowedVariants.filter((variant) =>
    scenario.baselineVariants.includes(variant),
  );
  if (
    orderedVariants.some(
      (variant, index) => variant !== scenario.baselineVariants[index],
    )
  ) {
    return false;
  }
  return (
    (scenario.identifier === "home" && scenario.path === "/") ||
    (scenario.identifier === "about" && scenario.path === "/about")
  );
}

function hasExactBaselineVariants(scenario, expectedVariants) {
  return (
    scenario.baselineVariants.length === expectedVariants.length &&
    scenario.baselineVariants.every(
      (variant, index) => variant === expectedVariants[index],
    )
  );
}

function validateScenarioMatrix(scenarios) {
  if (scenarios.length === 1) {
    return (
      scenarios[0].identifier === "home" &&
      scenarios[0].path === "/" &&
      hasExactBaselineVariants(scenarios[0], [
        "portfolio",
        "portfolio-calendly",
      ])
    );
  }
  return (
    scenarios.length === 2 &&
    scenarios[0].identifier === "home" &&
    scenarios[0].path === "/" &&
    hasExactBaselineVariants(scenarios[0], ["site"]) &&
    scenarios[1].identifier === "about" &&
    scenarios[1].path === "/about" &&
    hasExactBaselineVariants(scenarios[1], ["site"])
  );
}

function validateException(exception) {
  return (
    hasExactKeys(exception, [
      "route",
      "metric",
      "temporaryMaximum",
      "reason",
      "owner",
      "approvalReference",
      "expiresOn",
      "removalGate",
    ]) &&
    (exception.route === "/" || exception.route === "/about") &&
    metricIdentifierSet.has(exception.metric) &&
    isFiniteNonnegativeNumber(exception.temporaryMaximum) &&
    isNonemptyBoundedString(exception.reason) &&
    isNonemptyBoundedString(exception.owner) &&
    isNonemptyBoundedString(exception.approvalReference) &&
    isIsoCalendarDate(exception.expiresOn) &&
    isNonemptyBoundedString(exception.removalGate)
  );
}

export function decodePerformanceBudget(value) {
  if (
    !hasExactKeys(value, ["schemaVersion", "scenarios", "exceptions"]) ||
    value.schemaVersion !== "1.0.0" ||
    !Array.isArray(value.scenarios) ||
    !value.scenarios.every(validateScenario) ||
    !validateScenarioMatrix(value.scenarios) ||
    !Array.isArray(value.exceptions) ||
    !value.exceptions.every(validateException)
  ) {
    fail("PERFORMANCE_BUDGET_INVALID");
  }
  const routes = new Set(value.scenarios.map(({ path }) => path));
  const exceptionKeys = new Set();
  for (const exception of value.exceptions) {
    if (!routes.has(exception.route)) fail("PERFORMANCE_BUDGET_INVALID");
    const key = `${exception.route}\u0000${exception.metric}`;
    if (exceptionKeys.has(key)) fail("PERFORMANCE_BUDGET_INVALID");
    exceptionKeys.add(key);
  }
  return clone(value);
}

function validateBaselineEnvironment(environment, policy) {
  const expected = {
    image:
      "mcr.microsoft.com/playwright:v1.62.1-noble@sha256:dcc5531e97840b9b5e794f2814476b21571c5124a3fca2267d73041f56e7580e",
    platform: "linux/amd64",
    node: "22.23.2",
    pnpm: "11.20.0",
    lighthouseCi: policy.toolchain.lighthouseCi,
    lighthouse: policy.toolchain.lighthouse,
    playwright: policy.toolchain.playwright,
    cpuQuota: 2,
    memoryBytes: 4294967296,
  };
  if (
    !hasExactKeys(environment, [
      "image",
      "platform",
      "node",
      "pnpm",
      "lighthouseCi",
      "lighthouse",
      "playwright",
      "chromium",
      "cpuQuota",
      "memoryBytes",
    ]) ||
    !isNonemptyBoundedString(environment.chromium, 512) ||
    !Object.entries(expected).every(([key, expectedValue]) => environment[key] === expectedValue)
  ) {
    return false;
  }
  return true;
}

function validateMeasurement(measurement) {
  return (
    hasExactKeys(measurement, [
      "variant",
      "path",
      "metric",
      "batchMedians",
      "acceptedMedian",
    ]) &&
    allowedVariantSet.has(measurement.variant) &&
    (measurement.path === "/" || measurement.path === "/about") &&
    metricIdentifierSet.has(measurement.metric) &&
    Array.isArray(measurement.batchMedians) &&
    measurement.batchMedians.length === 2 &&
    measurement.batchMedians.every(isFiniteNonnegativeNumber) &&
    isFiniteNonnegativeNumber(measurement.acceptedMedian) &&
    measurement.acceptedMedian === Math.max(...measurement.batchMedians) &&
    (measurement.metric !== "resource-summary:third-party:count" ||
      (Number.isInteger(measurement.batchMedians[0]) &&
        Number.isInteger(measurement.batchMedians[1]) &&
        Number.isInteger(measurement.acceptedMedian)))
  );
}

export function decodePerformanceBaseline(value, { policy, budget } = {}) {
  const decodedPolicy = decodePerformancePolicy(policy);
  const decodedBudget = decodePerformanceBudget(budget);
  if (
    !hasExactKeys(value, [
      "schemaVersion",
      "calibratedOn",
      "environment",
      "measurements",
    ]) ||
    value.schemaVersion !== "1.0.0" ||
    !isIsoCalendarDate(value.calibratedOn) ||
    !validateBaselineEnvironment(value.environment, decodedPolicy) ||
    !Array.isArray(value.measurements) ||
    !value.measurements.every(validateMeasurement)
  ) {
    fail("PERFORMANCE_BASELINE_INVALID");
  }

  const expectedKeys = new Set(
    decodedBudget.scenarios.flatMap((scenario) =>
      scenario.baselineVariants.flatMap((variant) =>
        performanceMetricIdentifiers.map(
          (metric) => `${variant}\u0000${scenario.path}\u0000${metric}`,
        ),
      ),
    ),
  );
  const actualKeys = new Set();
  for (const measurement of value.measurements) {
    const key = `${measurement.variant}\u0000${measurement.path}\u0000${measurement.metric}`;
    if (!expectedKeys.has(key) || actualKeys.has(key)) {
      fail("PERFORMANCE_BASELINE_INVALID");
    }
    actualKeys.add(key);
  }
  if (
    actualKeys.size !== expectedKeys.size ||
    [...expectedKeys].some((key) => !actualKeys.has(key))
  ) {
    fail("PERFORMANCE_BASELINE_INVALID");
  }
  return clone(value);
}

function roundedThreshold(value, policy) {
  const headroom = Math.max(
    value * policy.relativeHeadroom,
    policy.absoluteHeadroom,
  );
  const quotient = (value + headroom) / policy.roundingQuantum;
  const adjustedQuotient =
    quotient - Number.EPSILON * Math.max(1, Math.abs(quotient));
  const rounded = Math.ceil(adjustedQuotient) * policy.roundingQuantum;
  const decimalPlaces = Math.max(
    0,
    (String(policy.roundingQuantum).split(".")[1] ?? "").length,
  );
  return Math.min(Number(rounded.toFixed(decimalPlaces)), policy.hardMaximum);
}

function exactRouteUrl(policy, path) {
  const url = new URL(path, policy.execution.origin);
  if (url.origin !== policy.execution.origin || url.pathname !== path) {
    fail("PERFORMANCE_BUDGET_INVALID");
  }
  return url.href;
}

function matchingUrlPattern(path) {
  return path === "/"
    ? "^http://127\\.0\\.0\\.1:3102/$"
    : "^http://127\\.0\\.0\\.1:3102/about$";
}

export function derivePerformanceThresholds({
  policy,
  budget,
  baseline,
  currentDate,
}) {
  const decodedPolicy = decodePerformancePolicy(policy);
  const decodedBudget = decodePerformanceBudget(budget);
  const decodedBaseline = decodePerformanceBaseline(baseline, {
    policy: decodedPolicy,
    budget: decodedBudget,
  });
  if (!isIsoCalendarDate(currentDate)) fail("PERFORMANCE_DATE_INVALID");

  const exceptions = new Map();
  for (const exception of decodedBudget.exceptions) {
    if (exception.metric === "resource-summary:third-party:count") {
      fail("PERFORMANCE_EXCEPTION_INVALID");
    }
    if (exception.expiresOn < currentDate) {
      fail("PERFORMANCE_EXCEPTION_EXPIRED");
    }
    const hardMaximum = decodedPolicy.metrics[exception.metric].hardMaximum;
    if (exception.temporaryMaximum > hardMaximum) {
      fail("PERFORMANCE_EXCEPTION_INVALID");
    }
    exceptions.set(`${exception.route}\u0000${exception.metric}`, exception);
  }

  return decodedBudget.scenarios.map((scenario) => {
    const thresholds = {};
    const activeExceptions = [];
    for (const metric of performanceMetricIdentifiers) {
      const measurements = decodedBaseline.measurements.filter(
        (measurement) =>
          measurement.path === scenario.path &&
          measurement.metric === metric &&
          scenario.baselineVariants.includes(measurement.variant),
      );
      const acceptedMedian = Math.max(
        ...measurements.map((measurement) => measurement.acceptedMedian),
      );
      const metricPolicy = decodedPolicy.metrics[metric];
      if (acceptedMedian > metricPolicy.hardMaximum) {
        fail("PERFORMANCE_THRESHOLD_INVALID");
      }
      const derived =
        metric === "resource-summary:third-party:count"
          ? 0
          : roundedThreshold(acceptedMedian, metricPolicy);
      const exception = exceptions.get(`${scenario.path}\u0000${metric}`);
      if (exception !== undefined) {
        if (exception.temporaryMaximum < derived) {
          fail("PERFORMANCE_EXCEPTION_INVALID");
        }
        thresholds[metric] = exception.temporaryMaximum;
        activeExceptions.push(exception);
      } else {
        thresholds[metric] = derived;
      }
    }
    return {
      identifier: scenario.identifier,
      path: scenario.path,
      url: exactRouteUrl(decodedPolicy, scenario.path),
      matchingUrlPattern: matchingUrlPattern(scenario.path),
      thresholds,
      activeExceptions,
    };
  });
}

export function createLighthouseConfiguration({
  policy,
  budget,
  baseline,
  currentDate,
  chromiumPath,
}) {
  if (!isNonemptyBoundedString(chromiumPath, 4096)) {
    fail("PERFORMANCE_CHROMIUM_INVALID");
  }
  const decodedPolicy = decodePerformancePolicy(policy);
  const thresholds = derivePerformanceThresholds({
    policy: decodedPolicy,
    budget,
    baseline,
    currentDate,
  });
  return {
    ci: {
      collect: {
        url: thresholds.map(({ url }) => url),
        numberOfRuns: decodedPolicy.execution.runs,
        additive: true,
        chromePath: chromiumPath,
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
      },
      assert: {
        assertMatrix: thresholds.map(({ matchingUrlPattern: pattern, thresholds: values }) => ({
          matchingUrlPattern: pattern,
          assertions: Object.fromEntries(
            performanceMetricIdentifiers.map((metric) => [
              metric,
              [
                "error",
                {
                  aggregationMethod: decodedPolicy.execution.aggregation,
                  maxNumericValue: values[metric],
                },
              ],
            ]),
          ),
        })),
      },
    },
  };
}

function parseExactUrl(value, code) {
  if (typeof value !== "string") fail(code);
  try {
    return new URL(value);
  } catch {
    fail(code);
  }
}

function requireDiagnosticNumber(value) {
  if (!isFiniteNonnegativeNumber(value)) {
    fail("PERFORMANCE_EVIDENCE_METRIC_INVALID");
  }
  return value;
}

function resourceSummaryItems(report) {
  const items = report?.audits?.["resource-summary"]?.details?.items;
  if (!Array.isArray(items)) fail("PERFORMANCE_EVIDENCE_METRIC_INVALID");
  return items;
}

function oneResourceItem(items, resourceType) {
  const matches = items.filter((item) => item?.resourceType === resourceType);
  if (matches.length !== 1) fail("PERFORMANCE_EVIDENCE_METRIC_INVALID");
  return matches[0];
}

function extractMetrics(report) {
  const items = resourceSummaryItems(report);
  return Object.fromEntries(
    performanceMetricIdentifiers.map((metric) => {
      if (resourceMetrics[metric] === undefined) {
        const value = report?.audits?.[metric]?.numericValue;
        return [metric, requireDiagnosticNumber(value)];
      }
      const { resourceType, property } = resourceMetrics[metric];
      const value = oneResourceItem(items, resourceType)?.[property];
      if (
        !isFiniteNonnegativeNumber(value) ||
        (property === "requestCount" && !Number.isInteger(value))
      ) {
        fail("PERFORMANCE_EVIDENCE_METRIC_INVALID");
      }
      return [metric, value];
    }),
  );
}

function extractLargestContentfulElement(report) {
  const details = report?.audits?.["lcp-breakdown-insight"]?.details;
  if (details?.type !== "list" || !Array.isArray(details.items)) {
    fail("PERFORMANCE_EVIDENCE_METRIC_INVALID");
  }
  const nodes = details.items.filter(
    (item) => isObject(item) && item.type === "node",
  );
  if (nodes.length !== 1) fail("PERFORMANCE_EVIDENCE_METRIC_INVALID");
  const [node] = nodes;
  if (isNonemptyBoundedString(node.selector, 2048)) return node.selector;
  if (isNonemptyBoundedString(node.snippet, 2048)) return node.snippet;
  fail("PERFORMANCE_EVIDENCE_METRIC_INVALID");
}

function extractDiagnostics(report) {
  const items = resourceSummaryItems(report);
  return {
    performanceScore: requireDiagnosticNumber(report?.categories?.performance?.score),
    timeToFirstByte: requireDiagnosticNumber(
      report?.audits?.["server-response-time"]?.numericValue,
    ),
    totalRequestCount: requireDiagnosticNumber(
      oneResourceItem(items, "total")?.requestCount,
    ),
    benchmarkIndex: requireDiagnosticNumber(report?.environment?.benchmarkIndex),
    largestContentfulElement: extractLargestContentfulElement(report),
  };
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function validateReportEnvelope({ sourcePath, report }, policy, allowedUrls) {
  if (
    !isNonemptyBoundedString(sourcePath, 512) ||
    basename(sourcePath) !== sourcePath ||
    !isObject(report)
  ) {
    fail("PERFORMANCE_EVIDENCE_INVALID");
  }
  if (report.lighthouseVersion !== policy.toolchain.lighthouse) {
    fail("PERFORMANCE_EVIDENCE_VERSION_INVALID");
  }
  const requestedUrl = parseExactUrl(
    report.requestedUrl,
    "PERFORMANCE_EVIDENCE_ROUTE_INVALID",
  );
  const finalUrl = parseExactUrl(
    report.finalUrl,
    "PERFORMANCE_EVIDENCE_ROUTE_INVALID",
  );
  if (
    requestedUrl.origin !== policy.execution.origin ||
    finalUrl.origin !== policy.execution.origin
  ) {
    fail("PERFORMANCE_EVIDENCE_ORIGIN_INVALID");
  }
  if (!allowedUrls.has(requestedUrl.href)) {
    fail("PERFORMANCE_EVIDENCE_ROUTE_INVALID");
  }
  if (finalUrl.href !== requestedUrl.href) {
    fail("PERFORMANCE_EVIDENCE_REDIRECTED");
  }
  if (
    typeof report.fetchTime !== "string" ||
    Number.isNaN(Date.parse(report.fetchTime))
  ) {
    fail("PERFORMANCE_EVIDENCE_INVALID");
  }
  return {
    sourcePath,
    url: requestedUrl.href,
    fetchTime: report.fetchTime,
    metrics: extractMetrics(report),
    diagnostics: extractDiagnostics(report),
  };
}

export function summarizeLighthouseReports({
  policy,
  budget,
  baseline,
  reports,
  currentDate,
}) {
  const decodedPolicy = decodePerformancePolicy(policy);
  const decodedBudget = decodePerformanceBudget(budget);
  const decodedBaseline = decodePerformanceBaseline(baseline, {
    policy: decodedPolicy,
    budget: decodedBudget,
  });
  const thresholdRoutes = derivePerformanceThresholds({
    policy: decodedPolicy,
    budget: decodedBudget,
    baseline: decodedBaseline,
    currentDate,
  });
  if (!Array.isArray(reports)) fail("PERFORMANCE_EVIDENCE_INVALID");
  const allowedUrls = new Set(thresholdRoutes.map(({ url }) => url));
  const sourcePaths = new Set();
  const fetchTimesByUrl = new Map();
  const samples = reports.map((entry) => {
    const sample = validateReportEnvelope(entry, decodedPolicy, allowedUrls);
    if (sourcePaths.has(sample.sourcePath)) {
      fail("PERFORMANCE_EVIDENCE_DUPLICATE");
    }
    sourcePaths.add(sample.sourcePath);
    const fetchTimes = fetchTimesByUrl.get(sample.url) ?? new Set();
    if (fetchTimes.has(sample.fetchTime)) {
      fail("PERFORMANCE_EVIDENCE_DUPLICATE");
    }
    fetchTimes.add(sample.fetchTime);
    fetchTimesByUrl.set(sample.url, fetchTimes);
    return sample;
  });

  const routeSummaries = thresholdRoutes.map((route) => {
    const routeSamples = samples
      .filter(({ url }) => url === route.url)
      .sort(
        (left, right) =>
          left.fetchTime.localeCompare(right.fetchTime) ||
          left.sourcePath.localeCompare(right.sourcePath),
      );
    if (routeSamples.length !== decodedPolicy.execution.runs) {
      fail("PERFORMANCE_EVIDENCE_MISSING");
    }
    const medians = Object.fromEntries(
      performanceMetricIdentifiers.map((metric) => [
        metric,
        median(routeSamples.map((sample) => sample.metrics[metric])),
      ]),
    );
    const results = Object.fromEntries(
      performanceMetricIdentifiers.map((metric) => [
        metric,
        {
          median: medians[metric],
          maximum: route.thresholds[metric],
          passed: medians[metric] <= route.thresholds[metric],
        },
      ]),
    );
    return {
      identifier: route.identifier,
      path: route.path,
      url: route.url,
      matchingUrlPattern: route.matchingUrlPattern,
      samples: routeSamples,
      medians,
      thresholds: route.thresholds,
      activeExceptions: route.activeExceptions,
      results,
      diagnostics: {
        medians: {
          performanceScore: median(
            routeSamples.map(({ diagnostics }) => diagnostics.performanceScore),
          ),
          timeToFirstByte: median(
            routeSamples.map(({ diagnostics }) => diagnostics.timeToFirstByte),
          ),
          totalRequestCount: median(
            routeSamples.map(({ diagnostics }) => diagnostics.totalRequestCount),
          ),
          benchmarkIndex: median(
            routeSamples.map(({ diagnostics }) => diagnostics.benchmarkIndex),
          ),
        },
        largestContentfulElement:
          routeSamples[Math.floor(routeSamples.length / 2)].diagnostics
            .largestContentfulElement,
      },
    };
  });
  const exceeded = routeSummaries.some(({ results }) =>
    Object.values(results).some(({ passed }) => !passed),
  );
  return {
    schemaVersion: "1.0.0",
    environment: decodedBaseline.environment,
    execution: decodedPolicy.execution,
    routes: routeSummaries,
    failureCodes: exceeded ? ["PERFORMANCE_BUDGET_EXCEEDED"] : [],
  };
}

export async function loadLighthouseReports(artifactDirectory) {
  let rootStats;
  try {
    rootStats = await lstat(artifactDirectory, { bigint: true });
  } catch {
    fail("PERFORMANCE_EVIDENCE_PATH_INVALID");
  }
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
    fail("PERFORMANCE_EVIDENCE_PATH_INVALID");
  }
  let entries;
  try {
    entries = await readdir(artifactDirectory, { withFileTypes: true });
  } catch {
    fail("PERFORMANCE_EVIDENCE_PATH_INVALID");
  }
  const reportEntries = entries
    .filter(({ name }) => /^lhr-[a-zA-Z0-9_-]+\.json$/u.test(name))
    .sort((left, right) => left.name.localeCompare(right.name));
  const reports = [];
  const entriesByName = new Map(entries.map((entry) => [entry.name, entry]));
  let totalBytes = 0n;
  for (const entry of reportEntries) {
    if (!entry.isFile() || entry.isSymbolicLink()) {
      fail("PERFORMANCE_EVIDENCE_PATH_INVALID");
    }
    const path = join(artifactDirectory, entry.name);
    let stats;
    try {
      stats = await lstat(path, { bigint: true });
    } catch {
      fail("PERFORMANCE_EVIDENCE_PATH_INVALID");
    }
    if (stats.isSymbolicLink() || !stats.isFile()) {
      fail("PERFORMANCE_EVIDENCE_PATH_INVALID");
    }
    totalBytes += stats.size;
    if (
      stats.size > BigInt(maximumReportBytes) ||
      totalBytes > BigInt(maximumReportsBytes)
    ) {
      fail("PERFORMANCE_EVIDENCE_OVERSIZED");
    }
    const htmlName = entry.name.replace(/\.json$/u, ".html");
    const htmlEntry = entriesByName.get(htmlName);
    if (htmlEntry === undefined || !htmlEntry.isFile() || htmlEntry.isSymbolicLink()) {
      fail("PERFORMANCE_EVIDENCE_PATH_INVALID");
    }
    const htmlPath = join(artifactDirectory, htmlName);
    let htmlStats;
    try {
      htmlStats = await lstat(htmlPath, { bigint: true });
    } catch {
      fail("PERFORMANCE_EVIDENCE_PATH_INVALID");
    }
    if (htmlStats.isSymbolicLink() || !htmlStats.isFile()) {
      fail("PERFORMANCE_EVIDENCE_PATH_INVALID");
    }
    totalBytes += htmlStats.size;
    if (
      htmlStats.size > BigInt(maximumReportBytes) ||
      totalBytes > BigInt(maximumReportsBytes)
    ) {
      fail("PERFORMANCE_EVIDENCE_OVERSIZED");
    }
    try {
      reports.push({
        sourcePath: entry.name,
        htmlPath: htmlName,
        report: JSON.parse(await readFile(path, "utf8")),
      });
    } catch (error) {
      if (error instanceof PerformanceBudgetRunnerError) throw error;
      fail("PERFORMANCE_EVIDENCE_INVALID");
    }
  }
  return reports;
}

export function validatePreviewResponse(expectedUrl, response) {
  const expected = parseExactUrl(
    expectedUrl,
    "PERFORMANCE_PREVIEW_READINESS_FAILED",
  );
  const final = parseExactUrl(
    response?.finalUrl,
    "PERFORMANCE_PREVIEW_READINESS_FAILED",
  );
  if (
    expected.origin !== expectedPolicy.execution.origin ||
    final.origin !== expectedPolicy.execution.origin ||
    final.href !== expected.href ||
    response?.ok !== true ||
    !Number.isInteger(response?.status) ||
    response.status < 200 ||
    response.status > 299
  ) {
    fail("PERFORMANCE_PREVIEW_READINESS_FAILED");
  }
  return true;
}

async function readConfiguration(path, code) {
  let stats;
  try {
    stats = await lstat(path, { bigint: true });
  } catch {
    fail(code);
  }
  if (
    stats.isSymbolicLink() ||
    !stats.isFile() ||
    stats.size > BigInt(maximumConfigurationBytes)
  ) {
    fail(code);
  }
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    fail(code);
  }
}

async function createArtifactDirectory(webRoot) {
  const artifactDirectory = join(webRoot, artifactDirectoryName);
  try {
    await mkdir(artifactDirectory, { mode: 0o700 });
  } catch {
    fail("PERFORMANCE_OUTPUT_INVALID");
  }
  const stats = await lstat(artifactDirectory, { bigint: true });
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    fail("PERFORMANCE_OUTPUT_INVALID");
  }
  return {
    path: artifactDirectory,
    device: stats.dev,
    inode: stats.ino,
  };
}

async function createRuntimeOwner(artifactDirectory) {
  const path = await mkdtemp(join(artifactDirectory, "runtime-"));
  const stats = await lstat(path, { bigint: true });
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    fail("PERFORMANCE_OUTPUT_INVALID");
  }
  return { path, device: stats.dev, inode: stats.ino };
}

async function removeRuntimeOwner(owner) {
  let stats;
  try {
    stats = await lstat(owner.path, { bigint: true });
  } catch {
    fail("PERFORMANCE_CLEANUP_FAILED");
  }
  if (
    stats.isSymbolicLink() ||
    !stats.isDirectory() ||
    stats.dev !== owner.device ||
    stats.ino !== owner.inode
  ) {
    fail("PERFORMANCE_CLEANUP_FAILED");
  }
  try {
    await rm(owner.path, { recursive: true, force: false });
  } catch {
    fail("PERFORMANCE_CLEANUP_FAILED");
  }
}

function inheritedEnvironmentValue(key) {
  const actualKey = Object.keys(process.env).find(
    (candidate) => candidate.toLowerCase() === key.toLowerCase(),
  );
  return actualKey === undefined ? undefined : process.env[actualKey];
}

function createChildEnvironment(runtimeOwner) {
  const environment = {};
  for (const key of ["PATH", "SystemRoot", "ComSpec", "PATHEXT"]) {
    const value = inheritedEnvironmentValue(key);
    if (value !== undefined) environment[key] = value;
  }
  return {
    ...environment,
    CI: "true",
    HOME: runtimeOwner.path,
    USERPROFILE: runtimeOwner.path,
    TMPDIR: runtimeOwner.path,
    TMP: runtimeOwner.path,
    TEMP: runtimeOwner.path,
    XDG_CACHE_HOME: runtimeOwner.path,
    XDG_CONFIG_HOME: runtimeOwner.path,
    NPM_CONFIG_USERCONFIG: join(runtimeOwner.path, ".npmrc"),
    LANG: "en_CA.UTF-8",
    TZ: "America/Toronto",
  };
}

async function defaultResolveChromiumPath() {
  try {
    const { chromium } = await import("@playwright/test");
    return chromium.executablePath();
  } catch {
    fail("PERFORMANCE_CHROMIUM_INVALID");
  }
}

export async function startPreviewProcess(input) {
  try {
    const child = spawn(input.executable, input.arguments, {
      cwd: input.cwd,
      env: input.environment,
      detached: input.detached,
      shell: false,
      stdio: "ignore",
    });
    child.performanceStartupError = false;
    child.performanceProcessGroupId =
      input.detached === true && Number.isInteger(child.pid) ? child.pid : undefined;
    child.once("error", () => {
      child.performanceStartupError = true;
    });
    return child;
  } catch {
    fail("PERFORMANCE_PREVIEW_READINESS_FAILED");
  }
}

async function defaultProbeRoute(url) {
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(5_000),
  });
  return { ok: response.ok, status: response.status, finalUrl: response.url };
}

async function defaultRunCommand(input) {
  await execFileAsync(input.executable, input.arguments, {
    cwd: input.cwd,
    env: input.environment,
    shell: false,
    timeout: commandTimeoutMilliseconds,
    maxBuffer: 1024 * 1024,
    encoding: "utf8",
  });
}

function waitForExit(child, timeoutMilliseconds) {
  if (child.exitCode !== null) return Promise.resolve();
  return new Promise((resolvePromise, rejectPromise) => {
    const timeout = setTimeout(() => {
      cleanup();
      rejectPromise(new Error("timeout"));
    }, timeoutMilliseconds);
    const onExit = () => {
      cleanup();
      resolvePromise();
    };
    const cleanup = () => {
      clearTimeout(timeout);
      child.off("exit", onExit);
    };
    child.once("exit", onExit);
  });
}

function signalProcessGroup(processGroupId, signal) {
  try {
    process.kill(-processGroupId, signal);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    fail("PERFORMANCE_CLEANUP_FAILED");
  }
}

function processGroupExists(processGroupId) {
  try {
    process.kill(-processGroupId, 0);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    fail("PERFORMANCE_CLEANUP_FAILED");
  }
}

async function waitForProcessGroupExit(processGroupId, timeoutMilliseconds) {
  const deadline = Date.now() + timeoutMilliseconds;
  while (processGroupExists(processGroupId)) {
    if (Date.now() >= deadline) return false;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
  }
  return true;
}

async function waitForTopChildExit(child, timeoutMilliseconds) {
  try {
    await waitForExit(child, timeoutMilliseconds);
    return true;
  } catch {
    return false;
  }
}

async function defaultStopPreview(child) {
  const processGroupId = child?.performanceProcessGroupId;
  if (
    process.platform !== "win32" &&
    Number.isInteger(processGroupId) &&
    processGroupId > 0
  ) {
    const termSent = signalProcessGroup(processGroupId, "SIGTERM");
    let [groupExited, topChildExited] = await Promise.all([
      termSent
        ? waitForProcessGroupExit(processGroupId, cleanupTimeoutMilliseconds)
        : Promise.resolve(true),
      waitForTopChildExit(child, cleanupTimeoutMilliseconds),
    ]);
    if (!groupExited || !topChildExited) {
      const killSent = signalProcessGroup(processGroupId, "SIGKILL");
      const [killedGroupExited, killedTopChildExited] = await Promise.all([
        killSent
          ? waitForProcessGroupExit(processGroupId, cleanupTimeoutMilliseconds)
          : Promise.resolve(true),
        topChildExited
          ? Promise.resolve(true)
          : waitForTopChildExit(child, cleanupTimeoutMilliseconds),
      ]);
      groupExited = killedGroupExited;
      topChildExited ||= killedTopChildExited;
    }
    if (
      !groupExited ||
      !topChildExited ||
      processGroupExists(processGroupId)
    ) {
      fail("PERFORMANCE_CLEANUP_FAILED");
    }
    return;
  }
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  try {
    await waitForExit(child, cleanupTimeoutMilliseconds);
    return;
  } catch {
    child.kill("SIGKILL");
  }
  try {
    await waitForExit(child, cleanupTimeoutMilliseconds);
  } catch {
    fail("PERFORMANCE_CLEANUP_FAILED");
  }
}

function defaultDelay(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function awaitRouteReadiness(url, preview, adapters) {
  const deadline = Date.now() + readinessTimeoutMilliseconds;
  while (Date.now() <= deadline) {
    if (
      preview?.performanceStartupError === true ||
      (preview?.exitCode !== null && preview?.exitCode !== undefined)
    ) {
      fail("PERFORMANCE_PREVIEW_READINESS_FAILED");
    }
    let response;
    try {
      response = await adapters.probeRoute(url);
      return validatePreviewResponse(url, response);
    } catch (error) {
      if (
        error instanceof PerformanceBudgetRunnerError &&
        error.code === "PERFORMANCE_PREVIEW_READINESS_FAILED"
      ) {
        let expected;
        let final;
        try {
          expected = new URL(url);
          final = new URL(response?.finalUrl);
        } catch {
          throw error;
        }
        if (
          final.origin !== expected.origin ||
          final.href !== expected.href ||
          (Number.isInteger(response?.status) &&
            response.status >= 300 &&
            response.status <= 399)
        ) {
          throw error;
        }
      }
      if (Date.now() >= deadline) {
        fail("PERFORMANCE_PREVIEW_READINESS_FAILED");
      }
      await adapters.delay(readinessPollMilliseconds);
    }
  }
  fail("PERFORMANCE_PREVIEW_READINESS_FAILED");
}

function createPerformanceManifest(reports) {
  return {
    schemaVersion: "1.0.0",
    reports: reports.map(({ sourcePath, htmlPath, report }) => ({
      jsonPath: sourcePath,
      htmlPath,
      lighthouseVersion: report.lighthouseVersion,
      requestedUrl: report.requestedUrl,
      finalUrl: report.finalUrl,
      fetchTime: report.fetchTime,
    })),
  };
}

function normalizeFailure(error, code) {
  return error instanceof PerformanceBudgetRunnerError
    ? error
    : new PerformanceBudgetRunnerError(code);
}

async function writeJson(path, value) {
  try {
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
  } catch {
    fail("PERFORMANCE_OUTPUT_INVALID");
  }
}

async function writeOutputJson(adapters, path, value) {
  try {
    await adapters.writeJson(path, value);
  } catch (error) {
    throw normalizeFailure(error, "PERFORMANCE_OUTPUT_INVALID");
  }
}

export async function runPerformanceBudgets(
  {
    webRoot = process.cwd(),
    currentDate = new Date().toISOString().slice(0, 10),
  } = {},
  injectedAdapters = {},
) {
  const canonicalWebRoot = resolve(webRoot);
  const policy = decodePerformancePolicy(
    await readConfiguration(
      join(canonicalWebRoot, "performance-policy.json"),
      "PERFORMANCE_POLICY_INVALID",
    ),
  );
  const budget = decodePerformanceBudget(
    await readConfiguration(
      join(canonicalWebRoot, "performance-budget.json"),
      "PERFORMANCE_BUDGET_INVALID",
    ),
  );
  const baseline = decodePerformanceBaseline(
    await readConfiguration(
      join(canonicalWebRoot, "performance-baseline.json"),
      "PERFORMANCE_BASELINE_INVALID",
    ),
    { policy, budget },
  );
  const adapters = {
    resolveChromiumPath: defaultResolveChromiumPath,
    startPreview: startPreviewProcess,
    probeRoute: defaultProbeRoute,
    runCommand: defaultRunCommand,
    stopPreview: defaultStopPreview,
    delay: defaultDelay,
    writeJson,
    ...injectedAdapters,
  };
  const chromiumPath = await adapters.resolveChromiumPath();
  const configuration = createLighthouseConfiguration({
    policy,
    budget,
    baseline,
    currentDate,
    chromiumPath,
  });
  const artifactOwner = await createArtifactDirectory(canonicalWebRoot);
  const runtimeOwner = await createRuntimeOwner(artifactOwner.path);
  let preview;
  let summary;
  let failure;
  try {
    const environment = createChildEnvironment(runtimeOwner);
    const configurationPath = join(
      artifactOwner.path,
      assertionConfigurationName,
    );
    await writeOutputJson(adapters, configurationPath, configuration);

    try {
      preview = await adapters.startPreview({
        executable: "pnpm",
        arguments: [
          "exec",
          "opennextjs-cloudflare",
          "preview",
          "--",
          "--ip",
          "127.0.0.1",
          "--port",
          "3102",
        ],
        cwd: canonicalWebRoot,
        environment,
        detached: process.platform !== "win32",
        shell: false,
      });
    } catch (error) {
      throw normalizeFailure(error, "PERFORMANCE_PREVIEW_READINESS_FAILED");
    }
    for (const url of configuration.ci.collect.url) {
      await awaitRouteReadiness(url, preview, adapters);
    }

    try {
      await adapters.runCommand({
        executable: "pnpm",
        arguments: [
          "exec",
          "lhci",
          "collect",
          `--config=${artifactDirectoryName}/${assertionConfigurationName}`,
        ],
        cwd: canonicalWebRoot,
        environment,
        shell: false,
      });
    } catch (error) {
      throw normalizeFailure(error, "PERFORMANCE_COLLECTION_FAILED");
    }
    const reports = await loadLighthouseReports(artifactOwner.path);
    summary = summarizeLighthouseReports({
      policy,
      budget,
      baseline,
      reports,
      currentDate,
    });
    await writeOutputJson(
      adapters,
      join(artifactOwner.path, "manifest.json"),
      createPerformanceManifest(reports),
    );
    const summaryPath = join(artifactOwner.path, summaryName);
    await writeOutputJson(adapters, summaryPath, summary);
    try {
      await adapters.runCommand({
        executable: "pnpm",
        arguments: [
          "exec",
          "lhci",
          "assert",
          `--config=${artifactDirectoryName}/${assertionConfigurationName}`,
        ],
        cwd: canonicalWebRoot,
        environment,
        shell: false,
      });
    } catch (error) {
      const failedSummary = {
        ...summary,
        failureCodes: [
          ...new Set([
            ...summary.failureCodes,
            "PERFORMANCE_ASSERTION_FAILED",
          ]),
        ],
      };
      try {
        await writeFile(summaryPath, `${JSON.stringify(failedSummary, null, 2)}\n`, {
          encoding: "utf8",
          mode: 0o600,
          flag: "w",
        });
      } catch {
        throw new PerformanceBudgetRunnerError("PERFORMANCE_OUTPUT_INVALID");
      }
      throw normalizeFailure(error, "PERFORMANCE_ASSERTION_FAILED");
    }
    if (summary.failureCodes.length > 0) {
      throw new PerformanceBudgetRunnerError("PERFORMANCE_ASSERTION_FAILED");
    }
  } catch (error) {
    failure = normalizeFailure(error, "PERFORMANCE_RUNNER_FAILED");
  } finally {
    let cleanupFailed = false;
    let previewStopped = preview === undefined;
    if (preview !== undefined) {
      try {
        await adapters.stopPreview(preview);
        previewStopped = true;
      } catch {
        cleanupFailed = true;
      }
    }
    if (previewStopped) {
      try {
        await removeRuntimeOwner(runtimeOwner);
      } catch {
        cleanupFailed = true;
      }
    }
    if (cleanupFailed) {
      if (failure === undefined) {
        failure = new PerformanceBudgetRunnerError("PERFORMANCE_CLEANUP_FAILED");
      } else {
        failure = new PerformanceBudgetRunnerError(failure.code, [
          ...failure.codes.slice(1),
          "PERFORMANCE_CLEANUP_FAILED",
        ]);
      }
    }
  }
  if (failure !== undefined) throw failure;
  return summary;
}

export function isDirectExecution(moduleUrl, argv = process.argv) {
  if (typeof moduleUrl !== "string" || !Array.isArray(argv) || argv.length < 2) {
    return false;
  }
  try {
    return pathToFileURL(resolve(argv[1])).href === moduleUrl;
  } catch {
    return false;
  }
}

if (isDirectExecution(import.meta.url)) {
  try {
    await runPerformanceBudgets();
  } catch (error) {
    const message =
      error instanceof PerformanceBudgetRunnerError
        ? error.message
        : "PERFORMANCE_RUNNER_FAILED";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
