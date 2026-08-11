import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const requestTimeoutMilliseconds = 10_000;
const exactRevisionPattern = /^[0-9a-f]{40}$/u;

const checkNames = Object.freeze([
  "home-response",
  "certification-error-response",
  "browser-error-envelope-accepted",
  "web-vital-envelope-accepted",
  "cross-origin-rejected",
  "media-type-rejected",
  "oversize-rejected",
  "malformed-json-rejected",
  "extra-field-rejected",
  "vocabulary-rejected",
  "secret-bearing-rejected",
]);

export class ProductionObservabilityExerciseError extends Error {
  constructor(code) {
    super(`Production observability exercise failed: ${code}`);
    this.name = "ProductionObservabilityExerciseError";
    this.code = code;
  }
}

function createError(code) {
  return new ProductionObservabilityExerciseError(code);
}

function readBaseUrl(value) {
  if (typeof value !== "string") return undefined;

  try {
    const url = new URL(value);
    const rootUrl = `${url.origin}/`;
    if (
      url.protocol !== "https:" ||
      url.username !== "" ||
      url.password !== "" ||
      url.pathname !== "/" ||
      url.search !== "" ||
      url.hash !== "" ||
      (value !== url.origin && value !== rootUrl)
    ) {
      return undefined;
    }
    return rootUrl;
  } catch {
    return undefined;
  }
}

function readInput(input) {
  try {
    const baseUrl = readBaseUrl(input?.baseUrl);
    if (baseUrl === undefined) {
      throw createError("EXERCISE_BASE_URL_INVALID");
    }
    if (
      typeof input?.revision !== "string" ||
      !exactRevisionPattern.test(input.revision)
    ) {
      throw createError("EXERCISE_REVISION_INVALID");
    }
    return Object.freeze({ baseUrl, revision: input.revision });
  } catch (error) {
    if (error instanceof ProductionObservabilityExerciseError) throw error;
    throw createError("EXERCISE_INPUT_INVALID");
  }
}

function readAdapters(adapters) {
  if (
    typeof adapters !== "object" ||
    adapters === null ||
    typeof adapters.fetch !== "function" ||
    typeof adapters.createTimeoutSignal !== "function"
  ) {
    throw createError("EXERCISE_ADAPTER_INVALID");
  }
  return adapters;
}

function readFailureName(error) {
  if (typeof error !== "object" || error === null) return undefined;
  try {
    return typeof error.name === "string" ? error.name : undefined;
  } catch {
    return undefined;
  }
}

function isTimeoutFailure(error) {
  const name = readFailureName(error);
  return name === "AbortError" || name === "TimeoutError";
}

function browserErrorEnvelope(correlationId) {
  return {
    schemaVersion: "1.0.0",
    event: {
      name: "browser.window.error",
      kind: "application.error",
      runtime: "browser",
      severity: "error",
      context: { correlationId },
      errorCategory: "unexpected",
      attributes: { source: "window-error" },
    },
  };
}

function webVitalEnvelope(correlationId) {
  return {
    schemaVersion: "1.0.0",
    event: {
      name: "browser.web.vital",
      kind: "web.vital",
      runtime: "browser",
      severity: "info",
      context: { correlationId },
      attributes: {
        metricName: "LCP",
        value: 123.4,
        delta: 12.3,
        rating: "good",
        navigationType: "navigate",
      },
    },
  };
}

function jsonRequest(origin, body) {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
    },
    body,
  };
}

function createRequests({ baseUrl, revision }) {
  const origin = new URL(baseUrl).origin;
  const observabilityUrl = `${baseUrl}api/observability`;
  const routeBrowserErrorMarker = `obs-cert-error-${revision}`;
  const routeWebVitalMarker = `obs-cert-vital-${revision}`;
  const browserError = browserErrorEnvelope(routeBrowserErrorMarker);

  return Object.freeze({
    markers: Object.freeze({
      routeBrowserErrorMarker,
      routeWebVitalMarker,
    }),
    requests: Object.freeze([
      Object.freeze({
        url: baseUrl,
        init: Object.freeze({ method: "GET" }),
        expectedStatus: 200,
      }),
      Object.freeze({
        url: `${baseUrl}api/observability-certification-error`,
        init: Object.freeze({ method: "GET" }),
        expectedStatus: 500,
      }),
      Object.freeze({
        url: observabilityUrl,
        init: jsonRequest(origin, JSON.stringify(browserError)),
        expectedStatus: 202,
      }),
      Object.freeze({
        url: observabilityUrl,
        init: jsonRequest(
          origin,
          JSON.stringify(webVitalEnvelope(routeWebVitalMarker)),
        ),
        expectedStatus: 202,
      }),
      Object.freeze({
        url: observabilityUrl,
        init: jsonRequest(
          "https://cross-origin.invalid",
          JSON.stringify(
            browserErrorEnvelope(`obs-cert-cross-origin-${revision}`),
          ),
        ),
        expectedStatus: 403,
      }),
      Object.freeze({
        url: observabilityUrl,
        init: {
          ...jsonRequest(
            origin,
            JSON.stringify(browserErrorEnvelope(`obs-cert-media-${revision}`)),
          ),
          headers: { "Content-Type": "text/plain", Origin: origin },
        },
        expectedStatus: 415,
      }),
      Object.freeze({
        url: observabilityUrl,
        init: jsonRequest(origin, "x".repeat(8_193)),
        expectedStatus: 413,
      }),
      Object.freeze({
        url: observabilityUrl,
        init: jsonRequest(origin, "{]"),
        expectedStatus: 400,
      }),
      Object.freeze({
        url: observabilityUrl,
        init: jsonRequest(
          origin,
          JSON.stringify({
            ...browserErrorEnvelope(`obs-cert-extra-${revision}`),
            unexpected: true,
          }),
        ),
        expectedStatus: 400,
      }),
      Object.freeze({
        url: observabilityUrl,
        init: jsonRequest(
          origin,
          JSON.stringify({
            ...browserError,
            event: {
              ...browserError.event,
              kind: "application.lifecycle",
              context: {
                correlationId: `obs-cert-vocabulary-${revision}`,
              },
            },
          }),
        ),
        expectedStatus: 400,
      }),
      Object.freeze({
        url: observabilityUrl,
        init: jsonRequest(
          origin,
          JSON.stringify(browserErrorEnvelope(`obs-token-${revision}`)),
        ),
        expectedStatus: 400,
      }),
    ]),
  });
}

async function runRequest(request, adapters) {
  let response;
  try {
    response = await adapters.fetch(request.url, {
      ...request.init,
      signal: adapters.createTimeoutSignal(requestTimeoutMilliseconds),
    });
  } catch (error) {
    throw createError(
      isTimeoutFailure(error)
        ? "EXERCISE_REQUEST_TIMEOUT"
        : "EXERCISE_REQUEST_FAILED",
    );
  }

  let status;
  try {
    status = response?.status;
  } catch {
    throw createError("EXERCISE_REQUEST_FAILED");
  }
  if (status !== request.expectedStatus) {
    throw createError("EXERCISE_STATUS_UNEXPECTED");
  }
}

async function exerciseProductionObservabilityWithAdapters(input, adapters) {
  const validatedInput = readInput(input);
  const validatedAdapters = readAdapters(adapters);
  const exercise = createRequests(validatedInput);

  for (const request of exercise.requests) {
    await runRequest(request, validatedAdapters);
  }

  return Object.freeze({
    ok: true,
    capability: "observability",
    version: "0.2.0",
    revision: validatedInput.revision,
    markers: Object.freeze({
      routeBrowserError: exercise.markers.routeBrowserErrorMarker,
      routeWebVital: exercise.markers.routeWebVitalMarker,
    }),
    checks: checkNames,
  });
}

const productionAdapters = Object.freeze({
  fetch: globalThis.fetch,
  createTimeoutSignal: (milliseconds) => AbortSignal.timeout(milliseconds),
});

export function exerciseProductionObservability(input) {
  return exerciseProductionObservabilityWithAdapters(input, productionAdapters);
}

export function exerciseProductionObservabilityForTesting(input, adapters) {
  return exerciseProductionObservabilityWithAdapters(input, adapters);
}

function parseArguments(arguments_) {
  if (
    arguments_.length === 4 &&
    arguments_[0] === "--base-url" &&
    arguments_[2] === "--revision"
  ) {
    return { baseUrl: arguments_[1], revision: arguments_[3] };
  }
  return undefined;
}

async function runMain() {
  const input = parseArguments(process.argv.slice(2));
  if (input === undefined) {
    process.stderr.write(
      `${JSON.stringify({ ok: false, code: "EXERCISE_ARGUMENT_INVALID" })}\n`,
    );
    process.exitCode = 2;
    return;
  }

  try {
    const receipt = await exerciseProductionObservability(input);
    process.stdout.write(`${JSON.stringify(receipt)}\n`);
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({
        ok: false,
        code:
          error instanceof ProductionObservabilityExerciseError
            ? error.code
            : "EXERCISE_FAILED",
      })}\n`,
    );
    process.exitCode = 1;
  }
}

if (
  process.argv[1] !== undefined &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  await runMain();
}
