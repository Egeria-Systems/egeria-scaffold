import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, lstat, mkdir, readFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { certifyProductionObservabilityForTesting } from "../../scripts/certify-production-observability.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const certificationScript = resolve(
  repositoryRoot,
  "scripts/certify-production-observability.mjs",
);
const certificationRegistryPath = resolve(
  repositoryRoot,
  "certifications/capabilities.json",
);
const certificationCheckScript = resolve(
  repositoryRoot,
  "scripts/check-capability-certification.mjs",
);
const deployedExerciseScript = resolve(
  repositoryRoot,
  "scripts/exercise-production-observability.mjs",
);

const deployedBaseUrl = "https://observability-certification.example/";
const deployedRevision = "0123456789abcdef0123456789abcdef01234567";
const browserErrorMarker = `obs-cert-error-${deployedRevision}`;
const webVitalMarker = `obs-cert-vital-${deployedRevision}`;

const fixedChecks = Object.freeze([
  "pnpm-version",
  "frozen-install",
  "peer-dependencies",
  "dependency-audit",
  "registry-signatures",
  "lint",
  "typecheck",
  "next-build",
  "opennext-build",
  "browser-install",
  "browser-development",
  "browser-preview",
]);

function observabilityCommandOutput(
  command,
  version = "0.2.0",
  category = "confirmed",
) {
  if (command === "create") {
    return {
      ok: true,
      command: "create",
      profile: "portfolio",
      capabilities: [
        "standards",
        "content-files",
        "section-composition",
        "deployment-cloudflare",
        "observability",
      ],
    };
  }
  if (command === "infer") {
    return {
      ok: true,
      command: "infer",
      result: {
        state: {
          kind: "valid",
          value: {
            installedCapabilities: [
              { identifier: "observability", version },
            ],
          },
        },
        capabilities: [{ identifier: "observability", category }],
      },
    };
  }
  if (command === "doctor") {
    return {
      ok: true,
      command: "doctor",
      result: { healthy: true, diagnostics: [] },
    };
  }
  if (command === "diff") {
    return {
      ok: true,
      command: "diff",
      result: { equal: true, differences: [] },
    };
  }
  throw new Error("unexpected command");
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function cleanupRetainedDirectory(path) {
  if (path !== undefined) {
    await rm(path, { recursive: true, force: true });
  }
}

async function runCertificationClosure(policy) {
  try {
    const result = await execFileAsync(
      process.execPath,
      [certificationCheckScript, "--closure", policy],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        env: { PATH: process.env.PATH },
      },
    );
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return {
      exitCode: error.code,
      stdout: error.stdout,
      stderr: error.stderr,
    };
  }
}

async function loadDeployedExercise() {
  return import(pathToFileURL(deployedExerciseScript).href);
}

function responseWithoutReadableContent(status) {
  return new Proxy(
    { status },
    {
      get(target, property) {
        if (property in target) return target[property];
        if (
          ["arrayBuffer", "blob", "body", "formData", "json", "text"].includes(
            property,
          )
        ) {
          throw new Error("response content must not be read");
        }
        return undefined;
      },
    },
  );
}

test("the observability registry records only reviewed local fresh-scaffold evidence while remaining pending", async () => {
  const registry = JSON.parse(
    await readFile(certificationRegistryPath, "utf8"),
  );
  const record = registry.records.observability;
  const subject = {
    descriptorVersion: "0.2.0",
    behaviorContractDigest:
      "sha256:a4f15a132e08da307ab412673b02152fee8509c0cc1dabb4b60856abd61f5d97",
  };

  assert.deepEqual(record.subject, subject);
  assert.equal(
    record.taskPlan,
    "docs/superpowers/plans/2026-08-10-production-observability-certification.md",
  );
  assert.equal(record.status, "pending");
  assert.deepEqual(record.evidence, [
    {
      kind: "fresh-scaffold",
      path: "docs/implementation-evidence/2026-08-11-production-observability-certification-verification.md",
      outcome: "passed",
      revision: "ef845b1e0551d3b43e17969cc00f21960c90769b",
      subject,
    },
  ]);

  for (const policy of ["legacy-backfill-exempt", "all-certified"]) {
    const closure = await runCertificationClosure(policy);
    assert.equal(closure.exitCode, 1);
    assert.equal(closure.stderr, "");
    assert.match(
      closure.stdout,
      /"path":\["records","observability","status"\]/u,
    );
    assert.match(closure.stdout, /"reason":"pending"/u);
  }
});

test("observability production mutation keeps real owner identity while testing mocks commands and verification", async () => {
  const commands = [];
  let ownedPath;
  let projectRoot;
  let verifiedRoot;
  const previousToken = process.env.CLOUDFLARE_API_TOKEN;
  process.env.CLOUDFLARE_API_TOKEN = "PRIVATE_VALUE";

  try {
    const result = await certifyProductionObservabilityForTesting({
      async runCommand(input) {
        commands.push(input);
        assert.equal(input.executable, process.execPath);
        assert.equal(input.environment.CLOUDFLARE_API_TOKEN, undefined);
        assert.equal(input.environment.NPM_TOKEN, undefined);
        assert.equal(input.environment.NODE_OPTIONS, undefined);
        const command = input.arguments[1];

        if (command === "create") {
          projectRoot = input.arguments[
            input.arguments.indexOf("--directory") + 1
          ];
          ownedPath = dirname(projectRoot);
          assert.equal((await lstat(ownedPath)).mode & 0o777, 0o700);
          return `${JSON.stringify({
            ok: true,
            command: "create",
            destination: projectRoot,
            profile: "portfolio",
            capabilities: [
              "standards",
              "content-files",
              "section-composition",
              "deployment-cloudflare",
              "observability",
            ],
          })}\n`;
        }
        if (command === "infer") {
          return `${JSON.stringify({
            ok: true,
            command: "infer",
            result: {
              state: {
                kind: "valid",
                value: {
                  installedCapabilities: [
                    { identifier: "observability", version: "0.2.0" },
                  ],
                },
              },
              capabilities: [
                { identifier: "observability", category: "confirmed" },
              ],
            },
          })}\n`;
        }
        if (command === "doctor") {
          return `${JSON.stringify({
            ok: true,
            command: "doctor",
            result: { healthy: true, diagnostics: [] },
          })}\n`;
        }
        if (command === "diff") {
          return `${JSON.stringify({
            ok: true,
            command: "diff",
            result: { equal: true, differences: [] },
          })}\n`;
        }
        throw new Error("unexpected command");
      },
      async verifyProject(root, identifier) {
        verifiedRoot = root;
        assert.equal(identifier, "portfolio");
        return {
          ok: true,
          fixtures: ["portfolio"],
          profiles: ["portfolio"],
          checks: fixedChecks,
        };
      },
    });

    assert.deepEqual(result, {
      ok: true,
      capability: "observability",
      version: "0.2.0",
      profile: "portfolio",
      checks: [
        "compiled-cli-create",
        "state-inference",
        "healthy-diagnostics",
        "exact-diff",
        ...fixedChecks,
      ],
    });
    assert.equal(commands.length, 4);
    assert.deepEqual(
      commands.map(({ arguments: arguments_ }) => arguments_.slice(1)),
      [
        [
          "create",
          "--profile",
          "portfolio",
          "--name",
          "acme-portfolio",
          "--display-name",
          "Acme Portfolio",
          "--directory",
          projectRoot,
        ],
        ["infer", "--directory", projectRoot],
        ["doctor", "--directory", projectRoot],
        ["diff", "--directory", projectRoot],
      ],
    );
    assert.equal(verifiedRoot, projectRoot);
    assert.equal(await pathExists(ownedPath), false);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_VALUE/u);
  } finally {
    if (previousToken === undefined) {
      delete process.env.CLOUDFLARE_API_TOKEN;
    } else {
      process.env.CLOUDFLARE_API_TOKEN = previousToken;
    }
  }
});

test("observability production mutation rejects a wrong installed capability version", async () => {
  let ownedPath;

  await assert.rejects(
      () =>
        certifyProductionObservabilityForTesting({
          async runCommand(input) {
            const command = input.arguments[1];
            ownedPath = dirname(
              input.arguments[input.arguments.indexOf("--directory") + 1],
            );
            return `${JSON.stringify(
              observabilityCommandOutput(command, "0.1.0"),
            )}\n`;
          },
          async verifyProject() {
            throw new Error("must not verify");
          },
        }),
    (error) => {
      assert.equal(error?.name, "ProductionObservabilityCertificationError");
      assert.equal(error?.code, "FRESH_SCAFFOLD_INFERENCE_INVALID");
      return true;
    },
  );
  assert.equal(await pathExists(ownedPath), false);
});

test("observability production mutation rejects an unconfirmed inference category", async () => {
  let ownedPath;

  await assert.rejects(
    () =>
      certifyProductionObservabilityForTesting({
          async runCommand(input) {
            ownedPath = dirname(
              input.arguments[input.arguments.indexOf("--directory") + 1],
            );
            return `${JSON.stringify(
              observabilityCommandOutput(
                input.arguments[1],
                "0.2.0",
                "inferred",
              ),
            )}\n`;
          },
          async verifyProject() {
            throw new Error("must not verify");
          },
        }),
    (error) => {
      assert.equal(error?.name, "ProductionObservabilityCertificationError");
      assert.equal(error?.code, "FRESH_SCAFFOLD_INFERENCE_INVALID");
      return true;
    },
  );
  assert.equal(await pathExists(ownedPath), false);
});

test("observability production mutation refuses identity-replacement cleanup", async () => {
  let retainedOwner;

  try {
    await assert.rejects(
      () =>
        certifyProductionObservabilityForTesting({
          async runCommand(input) {
            const command = input.arguments[1];
            const projectRoot = input.arguments[
              input.arguments.indexOf("--directory") + 1
            ];
            if (command === "create") {
              retainedOwner = dirname(projectRoot);
              assert.equal((await lstat(retainedOwner)).mode & 0o777, 0o700);
              await rm(retainedOwner, { recursive: true });
              await mkdir(retainedOwner, { mode: 0o700 });
            }
            return `${JSON.stringify(observabilityCommandOutput(command))}\n`;
          },
          async verifyProject(root, identifier) {
            assert.equal(identifier, "portfolio");
            return {
              ok: true,
              fixtures: ["portfolio"],
              profiles: ["portfolio"],
              checks: fixedChecks,
            };
          },
        }),
      (error) => {
        assert.equal(error?.name, "ProductionObservabilityCertificationError");
        assert.equal(error?.code, "CERTIFICATION_CLEANUP_FAILED");
        return true;
      },
    );
    assert.equal(await pathExists(retainedOwner), true);
  } finally {
    await cleanupRetainedDirectory(retainedOwner);
  }
});

test("observability testing API rejects the production-adapter mutation", async () => {
  for (const adapters of [undefined, null, {}, { runCommand() {} }]) {
    await assert.rejects(
      () => certifyProductionObservabilityForTesting(adapters),
      (error) => {
        assert.equal(error?.name, "ProductionObservabilityCertificationError");
        assert.equal(error?.code, "CERTIFICATION_ADAPTER_INVALID");
        return true;
      },
    );
  }
});

test("the observability certification entry rejects unknown arguments without echoing them", async () => {
  let result;
  try {
    await execFileAsync(process.execPath, [
      certificationScript,
      "--unknown",
      "private-value",
    ], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { PATH: process.env.PATH },
    });
    assert.fail("invalid arguments must fail");
  } catch (error) {
    result = error;
  }

  assert.equal(result.code, 2);
  assert.equal(result.stdout, "");
  assert.equal(
    result.stderr,
    `${JSON.stringify({
      ok: false,
      code: "CERTIFICATION_ARGUMENT_INVALID",
    })}\n`,
  );
  assert.doesNotMatch(result.stderr, /private-value/u);
});

test("the deployed observability exercise sends the fixed bounded journey and returns content-safe markers", async () => {
  const { exerciseProductionObservabilityForTesting } =
    await loadDeployedExercise();
  const expectedStatuses = [200, 500, 202, 202, 403, 415, 413, 400, 400, 400, 400];
  const requests = [];
  const timeoutDurations = [];
  const timeoutSignal = Object.freeze({ identifier: "test-timeout" });

  const receipt = await exerciseProductionObservabilityForTesting(
    { baseUrl: deployedBaseUrl, revision: deployedRevision },
    {
      async fetch(url, init) {
        requests.push({ url, init });
        return responseWithoutReadableContent(
          expectedStatuses[requests.length - 1],
        );
      },
      createTimeoutSignal(milliseconds) {
        timeoutDurations.push(milliseconds);
        return timeoutSignal;
      },
    },
  );

  assert.deepEqual(receipt, {
    ok: true,
    capability: "observability",
    version: "0.2.0",
    revision: deployedRevision,
    markers: {
      browserError: browserErrorMarker,
      webVital: webVitalMarker,
    },
    checks: [
      "home-response",
      "certification-error-response",
      "browser-error-accepted",
      "web-vital-accepted",
      "cross-origin-rejected",
      "media-type-rejected",
      "oversize-rejected",
      "malformed-json-rejected",
      "extra-field-rejected",
      "vocabulary-rejected",
      "secret-bearing-rejected",
    ],
  });
  assert.equal(requests.length, expectedStatuses.length);
  assert.deepEqual(timeoutDurations, expectedStatuses.map(() => 10_000));
  assert.equal(requests.every(({ init }) => init.signal === timeoutSignal), true);
  assert.deepEqual(
    requests.map(({ url, init }) => [url, init.method]),
    [
      [deployedBaseUrl, "GET"],
      [`${deployedBaseUrl}api/observability-certification-error`, "GET"],
      [`${deployedBaseUrl}api/observability`, "POST"],
      [`${deployedBaseUrl}api/observability`, "POST"],
      [`${deployedBaseUrl}api/observability`, "POST"],
      [`${deployedBaseUrl}api/observability`, "POST"],
      [`${deployedBaseUrl}api/observability`, "POST"],
      [`${deployedBaseUrl}api/observability`, "POST"],
      [`${deployedBaseUrl}api/observability`, "POST"],
      [`${deployedBaseUrl}api/observability`, "POST"],
      [`${deployedBaseUrl}api/observability`, "POST"],
    ],
  );

  const [
    home,
    certificationError,
    browserError,
    webVital,
    crossOrigin,
    mediaType,
    oversize,
    malformed,
    extraField,
    vocabulary,
    secretBearing,
  ] = requests;
  assert.deepEqual(home.init.headers, undefined);
  assert.equal(home.init.body, undefined);
  assert.deepEqual(certificationError.init.headers, undefined);
  assert.equal(certificationError.init.body, undefined);
  assert.deepEqual(browserError.init.headers, {
    "Content-Type": "application/json",
    Origin: "https://observability-certification.example",
  });
  assert.deepEqual(JSON.parse(browserError.init.body), {
    schemaVersion: "1.0.0",
    event: {
      name: "browser.window.error",
      kind: "application.error",
      runtime: "browser",
      severity: "error",
      context: { correlationId: browserErrorMarker },
      errorCategory: "unexpected",
      attributes: { source: "window-error" },
    },
  });
  assert.deepEqual(JSON.parse(webVital.init.body), {
    schemaVersion: "1.0.0",
    event: {
      name: "browser.web.vital",
      kind: "web.vital",
      runtime: "browser",
      severity: "info",
      context: { correlationId: webVitalMarker },
      attributes: {
        metricName: "LCP",
        value: 123.4,
        delta: 12.3,
        rating: "good",
        navigationType: "navigate",
      },
    },
  });
  assert.equal(
    crossOrigin.init.headers.Origin,
    "https://cross-origin.invalid",
  );
  assert.equal(mediaType.init.headers["Content-Type"], "text/plain");
  assert.equal(new TextEncoder().encode(oversize.init.body).byteLength, 8_193);
  assert.equal(malformed.init.body, "{]");
  assert.equal(JSON.parse(extraField.init.body).unexpected, true);
  assert.equal(
    JSON.parse(vocabulary.init.body).event.kind,
    "application.lifecycle",
  );
  assert.match(
    JSON.parse(secretBearing.init.body).event.context.correlationId,
    /token/iu,
  );
  assert.doesNotMatch(JSON.stringify(receipt), /observability-certification\.example/u);
  assert.doesNotMatch(JSON.stringify(receipt), /response content must not be read/u);
});

test("the deployed observability exercise accepts only an HTTPS root origin and exact revision", async () => {
  const { exerciseProductionObservabilityForTesting } =
    await loadDeployedExercise();
  const adapters = {
    async fetch() {
      throw new Error("must not fetch");
    },
    createTimeoutSignal() {
      throw new Error("must not create a timeout");
    },
  };

  for (const baseUrl of [
    "http://observability-certification.example/",
    "https://observability-certification.example/path",
    "https://observability-certification.example/?private=query",
    "https://observability-certification.example/#private",
    "https://user:password@observability-certification.example/",
    " https://observability-certification.example/",
    "not-a-url",
  ]) {
    await assert.rejects(
      () =>
        exerciseProductionObservabilityForTesting(
          { baseUrl, revision: deployedRevision },
          adapters,
        ),
      (error) => {
        assert.equal(error?.name, "ProductionObservabilityExerciseError");
        assert.equal(error?.code, "EXERCISE_BASE_URL_INVALID");
        assert.doesNotMatch(
          error.message,
          /password|private|certification\.example/iu,
        );
        return true;
      },
    );
  }

  for (const revision of [
    deployedRevision.slice(1),
    `${deployedRevision}0`,
    deployedRevision.toUpperCase(),
    `${deployedRevision.slice(0, -1)}g`,
    "private-secret-revision",
  ]) {
    await assert.rejects(
      () =>
        exerciseProductionObservabilityForTesting(
          { baseUrl: deployedBaseUrl, revision },
          adapters,
        ),
      (error) => {
        assert.equal(error?.name, "ProductionObservabilityExerciseError");
        assert.equal(error?.code, "EXERCISE_REVISION_INVALID");
        assert.doesNotMatch(error.message, /private|secret|012345/iu);
        return true;
      },
    );
  }
});

test("the deployed observability exercise reports stable sanitized request failures", async () => {
  const { exerciseProductionObservabilityForTesting } =
    await loadDeployedExercise();

  for (const [failure, expectedCode] of [
    [
      Object.assign(new Error("private timeout at staging origin"), {
        name: "TimeoutError",
      }),
      "EXERCISE_REQUEST_TIMEOUT",
    ],
    [
      new Error("private-secret fetch failure at staging origin"),
      "EXERCISE_REQUEST_FAILED",
    ],
  ]) {
    await assert.rejects(
      () =>
        exerciseProductionObservabilityForTesting(
          { baseUrl: deployedBaseUrl, revision: deployedRevision },
          {
            async fetch() {
              throw failure;
            },
            createTimeoutSignal() {
              return Object.freeze({});
            },
          },
        ),
      (error) => {
        assert.equal(error?.name, "ProductionObservabilityExerciseError");
        assert.equal(error?.code, expectedCode);
        assert.doesNotMatch(error.message, /private|secret|staging/iu);
        return true;
      },
    );
  }

  await assert.rejects(
    () =>
      exerciseProductionObservabilityForTesting(
        { baseUrl: deployedBaseUrl, revision: deployedRevision },
        {
          async fetch() {
            return responseWithoutReadableContent(418);
          },
          createTimeoutSignal() {
            return Object.freeze({});
          },
        },
      ),
    (error) => {
      assert.equal(error?.name, "ProductionObservabilityExerciseError");
      assert.equal(error?.code, "EXERCISE_STATUS_UNEXPECTED");
      assert.doesNotMatch(error.message, /418|observability-certification/iu);
      return true;
    },
  );
});
