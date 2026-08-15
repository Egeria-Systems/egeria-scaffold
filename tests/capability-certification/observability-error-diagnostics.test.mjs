import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  access,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { isPinnedGitHubActionReference } from "../helpers/github-actions.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const requireFromBuilderCore = createRequire(
  resolve(repositoryRoot, "packages/builder-core/package.json"),
);
const { parse: parseYaml } = requireFromBuilderCore("yaml");

const exactSubject = Object.freeze({
  descriptorVersion: "0.3.0",
  behaviorContractDigest:
    "sha256:24a3cb3361cd8f72a12a1926b512e087adb31ad120a62b70e06a68d9dcf90c99",
});
const exactRevision = "0123456789abcdef0123456789abcdef01234567";
const requiredEvidence = Object.freeze([
  "cleanup-recovery",
  "deployed-application",
  "fresh-scaffold",
]);
const fixedVerificationChecks = Object.freeze([
  "pnpm-version",
  "frozen-install",
  "peer-dependencies",
  "dependency-audit",
  "registry-signatures",
  "lint",
  "cloudflare-types",
  "typecheck",
  "unit-tests",
  "component-tests",
  "next-build",
  "opennext-build",
  "browser-install",
  "browser-development",
  "browser-preview",
]);
const fixtureVerificationChecks = Object.freeze([
  "certification-fixture-overlay",
  "certification-fixture-frozen-install",
  "certification-fixture-browser-install",
  "certification-fixture-browser-capture",
  "certification-fixture-server-capture",
  "certification-fixture-capture-semantics",
  "repository-sources-unchanged",
]);
const browserCases = Object.freeze([
  "browser-error",
  "unhandled-rejection",
  "react-boundary",
  "selected-browser-catch",
  "duplicate-suppression",
]);
const serverCases = Object.freeze([
  "next-request-error",
  "selected-server-catch",
  "diagnostic-failure-containment",
]);
const localCases = Object.freeze([...browserCases, ...serverCases]);
const localFixtureCounts = Object.freeze({
  cases: 8,
  captureInvocations: 9,
  acceptedOriginals: 8,
  syntheticApplicationRequests: 10,
  diagnosticDeliveryFailures: 1,
});
const localFixtureChecks = Object.freeze([
  "generated-browser-error-unhandled",
  "generated-unhandled-rejection-unhandled",
  "generated-react-boundary-handled",
  "generated-selected-browser-catch-handled",
  "generated-duplicate-suppression",
  "browser-private-context-omitted",
  "generated-next-request-error",
  "generated-selected-server-catch-context",
  "generated-diagnostic-failure-containment",
]);

function createLocalFixtureReceipt() {
  return {
    ok: true,
    capability: "observability",
    version: "0.3.0",
    subject: exactSubject,
    revision: exactRevision,
    scope: "local-full",
    cases: localCases,
    eventIdentifiers: Array.from(
      { length: 5 },
      (_, index) => `00000000-0000-4000-8000-00000000000${index}`,
    ),
    counts: localFixtureCounts,
    providerRecordsClaimed: false,
    checks: localFixtureChecks,
  };
}

const runnerPath = resolve(
  repositoryRoot,
  "scripts/certify-observability-error-diagnostics.mjs",
);
const exercisePath = resolve(
  repositoryRoot,
  "scripts/exercise-observability-error-diagnostics.mjs",
);
const registryPath = resolve(
  repositoryRoot,
  "certifications/capabilities.json",
);
const localReceiptPath = resolve(
  repositoryRoot,
  "docs/implementation-evidence/observability-error-diagnostics-certification-receipt.json",
);
const providerTemplatePath = resolve(
  repositoryRoot,
  "docs/implementation-evidence/observability-error-diagnostics-provider-receipt-template.md",
);
const workflowPath = resolve(
  repositoryRoot,
  ".github/workflows/observability-error-diagnostics-certification.yml",
);
const fixtureRoot = resolve(
  repositoryRoot,
  "tests/capability-certification/fixtures/observability-error-diagnostics",
);
const retiredCertificationPaths = Object.freeze([
  ".github/workflows/production-observability-certification.yml",
  "scripts/certify-production-observability.mjs",
  "scripts/exercise-production-observability.mjs",
  "tests/capability-certification/fixtures/observability-error-route.ts",
  "tests/capability-certification/fixtures/observability-browser-error.spec.ts",
  "tests/capability-certification/production-observability.test.mjs",
]);

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readOptionalFile(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
}

async function loadModule(path) {
  return import(`${pathToFileURL(path).href}?test=${Date.now()}`);
}

function commandOutput(command, version = "0.3.0") {
  if (command === "create") {
    return {
      ok: true,
      command,
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
      command,
      result: {
        state: {
          kind: "valid",
          value: {
            installedCapabilities: [
              { identifier: "observability", version },
            ],
          },
        },
        capabilities: [
          { identifier: "observability", category: "confirmed" },
        ],
      },
    };
  }
  if (command === "doctor") {
    return {
      ok: true,
      command,
      result: { healthy: true, diagnostics: [] },
    };
  }
  if (command === "diff") {
    return {
      ok: true,
      command,
      result: { equal: true, differences: [] },
    };
  }
  throw new Error("unexpected command");
}

async function createRunnerAdapters({ recipeVersion = "0.8.0" } = {}) {
  let projectRoot;
  const commands = [];
  const adapters = {
    async runCommand(input) {
      commands.push(input);
      const command = input.arguments[1];
      projectRoot = input.arguments[input.arguments.indexOf("--directory") + 1];
      if (command === "create") {
        await mkdir(join(projectRoot, ".egeria"), { recursive: true });
        await writeFile(
          join(projectRoot, ".egeria/project.yaml"),
          `originProfile: portfolio\nrecipeVersion: ${recipeVersion}\n`,
          "utf8",
        );
      }
      return `${JSON.stringify(commandOutput(command))}\n`;
    },
    async verifyProject(root, identifier) {
      assert.equal(root, projectRoot);
      assert.equal(identifier, "portfolio");
      return {
        ok: true,
        fixtures: ["portfolio"],
        profiles: ["portfolio"],
        checks: fixedVerificationChecks,
      };
    },
    async verifyFixture(input) {
      assert.equal(input.projectRoot, projectRoot);
      assert.equal(typeof input.runCommand, "function");
      assert.equal(input.environment.CLOUDFLARE_API_TOKEN, undefined);
      assert.equal(input.environment.BETTER_STACK_SOURCE_TOKEN, undefined);
      return { ok: true, checks: fixtureVerificationChecks };
    },
  };
  return { adapters, commands, readProjectRoot: () => projectRoot };
}

function enumerateSecretReferences(value, path = "") {
  if (typeof value === "string") {
    return [...value.matchAll(/\$\{\{([\s\S]*?)\}\}/gu)].flatMap(
      ([, expression]) =>
        [...expression.matchAll(/\bsecrets\b/gu)].map((match) => {
          const suffix = expression.slice(match.index);
          const approved = /^secrets\.([A-Za-z_][A-Za-z0-9_]*)\b/u.exec(
            suffix,
          );
          return {
            path,
            reference: approved ? `secrets.${approved[1]}` : "secrets",
          };
        }),
    );
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => {
      const entryIdentifier =
        entry && typeof entry === "object" && typeof entry.name === "string"
          ? JSON.stringify(entry.name)
          : index;
      return enumerateSecretReferences(
        entry,
        `${path}[${entryIdentifier}]`,
      );
    });
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, entry]) =>
      enumerateSecretReferences(entry, path ? `${path}.${key}` : key),
    );
  }
  return [];
}

function responseWithoutReadableContent(status) {
  return new Proxy(
    { status },
    {
      get(target, property) {
        if (property in target) return target[property];
        if (["arrayBuffer", "blob", "body", "formData", "json", "text"].includes(property)) {
          throw new Error("response content must not be read");
        }
        return undefined;
      },
    },
  );
}

test("the diagnostics certification receipt covers only the exact pending subject and reviewed local outcome", async (t) => {
  const registry = JSON.parse(await readFile(registryPath, "utf8"));
  const record = registry.records.observability;
  assert.deepEqual(record, {
    subject: exactSubject,
    requiredEvidence,
    status: "pending",
    taskPlan:
      "docs/superpowers/plans/2026-08-12-observability-error-diagnostics-certification.md",
    evidence: [],
  });

  if (!(await pathExists(localReceiptPath))) {
    t.skip("private local receipt is absent from an ordinary checkout");
    return;
  }

  const receipt = JSON.parse(await readFile(localReceiptPath, "utf8"));
  assert.equal(receipt.schemaVersion, "1.0.0");
  assert.equal(receipt.capability, "observability");
  assert.deepEqual(receipt.subject, exactSubject);
  assert.match(receipt.evidenceRevision, /^[0-9a-f]{40}$/u);
  assert.equal(receipt.status, "complete");
  assert.equal(receipt.reviewDecision, "accepted");
  assert.deepEqual(receipt.unresolvedPrompts, []);
  assert.deepEqual(receipt.hostedRunClaim, {
    claimed: false,
    basis: "local-fresh-scaffold-only",
  });
  assert.equal(receipt.outcomes.length, 1);
  assert.deepEqual(
    receipt.outcomes.map(({ identifier, result, reviewDecision }) => ({
      identifier,
      result,
      reviewDecision,
    })),
    [
      {
        identifier: "fresh-scaffold",
        result: "passed",
        reviewDecision: "accepted",
      },
    ],
  );
  assert.deepEqual(receipt.outcomes[0].subject, exactSubject);
  assert.equal(
    receipt.outcomes[0].evidenceRevision,
    receipt.evidenceRevision,
  );
  await execFileAsync(
    "git",
    ["merge-base", "--is-ancestor", receipt.evidenceRevision, "HEAD"],
    { cwd: repositoryRoot },
  );
  assert.doesNotMatch(
    JSON.stringify(receipt),
    /0\.2\.0|a4f15a132e08da307ab412673b02152fee8509c0cc1dabb4b60856abd61f5d97/u,
  );
});

test("the thin local runner binds exact recipe, subject, revision, fixed verification, fixture checks, and cleanup", async () => {
  const { certifyObservabilityErrorDiagnosticsForTesting } =
    await loadModule(runnerPath);
  const { adapters, commands, readProjectRoot } = await createRunnerAdapters();
  const result = await certifyObservabilityErrorDiagnosticsForTesting(
    { revision: exactRevision },
    adapters,
  );

  assert.deepEqual(result, {
    ok: true,
    capability: "observability",
    version: "0.3.0",
    profile: "portfolio",
    subject: exactSubject,
    recipeVersion: "0.8.0",
    evidenceRevision: exactRevision,
    cleanup: "identity-checked",
    checks: [
      "compiled-cli-create",
      "state-inference",
      "healthy-diagnostics",
      "exact-diff",
      ...fixedVerificationChecks,
      ...fixtureVerificationChecks,
    ],
  });
  assert.deepEqual(
    commands.map(({ arguments: arguments_ }) => arguments_.slice(1, 3)),
    [
      ["create", "--profile"],
      ["infer", "--directory"],
      ["doctor", "--directory"],
      ["diff", "--directory"],
    ],
  );
  assert.match(
    commands[0].arguments.join(" "),
    /--name acme-portfolio --display-name Acme Portfolio/u,
  );
  assert.equal(await pathExists(dirname(readProjectRoot())), false);
  assert.equal(Buffer.byteLength(JSON.stringify(result), "utf8") <= 4_096, true);
  assert.doesNotMatch(JSON.stringify(result), /0\.2\.0/u);
});

test("the local fixture receipt binds every capture case and rejects semantic or provider-claim drift", async () => {
  const { validateLocalFixtureReceiptForTesting } = await loadModule(runnerPath);
  const receipt = createLocalFixtureReceipt();

  assert.equal(
    validateLocalFixtureReceiptForTesting(receipt, exactRevision),
    true,
  );

  const reordered = structuredClone(receipt);
  reordered.subject = {
    behaviorContractDigest: exactSubject.behaviorContractDigest,
    descriptorVersion: exactSubject.descriptorVersion,
  };
  reordered.counts = {
    diagnosticDeliveryFailures: 1,
    syntheticApplicationRequests: 10,
    acceptedOriginals: 8,
    captureInvocations: 9,
    cases: 8,
  };
  assert.equal(
    validateLocalFixtureReceiptForTesting(reordered, exactRevision),
    true,
  );

  for (const mutate of [
    (value) => value.cases.pop(),
    (value) => value.checks.splice(3, 1),
    (value) => {
      value.counts.acceptedOriginals = 9;
    },
    (value) => {
      value.providerRecordsClaimed = true;
    },
  ]) {
    const drifted = structuredClone(receipt);
    mutate(drifted);
    assert.throws(
      () => validateLocalFixtureReceiptForTesting(drifted, exactRevision),
      (error) => error?.code === "CERTIFICATION_FIXTURE_RECEIPT_INVALID",
    );
  }
});

test("the protected repository source guard rejects added files", async () => {
  const runner = await loadModule(runnerPath);
  assert.equal(typeof runner.snapshotTreeForTesting, "function");
  assert.equal(typeof runner.requireTreeIdenticalForTesting, "function");
  const root = await mkdtemp(join(tmpdir(), "diagnostics-protected-tree-"));

  try {
    await writeFile(join(root, "accepted.txt"), "accepted\n", "utf8");
    const snapshot = await runner.snapshotTreeForTesting(root);
    await writeFile(join(root, "unexpected.txt"), "unexpected\n", "utf8");
    await assert.rejects(
      () => runner.requireTreeIdenticalForTesting(root, snapshot),
      (error) => error?.code === "CERTIFICATION_SOURCE_CHANGED",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("the temporary fixture routes every server case through generated capture and asserts exact context", async () => {
  const [runner, routeFixture, browserFixture] = await Promise.all([
    readFile(runnerPath, "utf8"),
    readFile(
      join(
        fixtureRoot,
        "apps/web/app/api/certification/diagnostics/route.ts",
      ),
      "utf8",
    ),
    readFile(
      join(fixtureRoot, "observability-error-diagnostics.spec.ts"),
      "utf8",
    ),
  ]);

  assert.match(runner, /OBSERVABILITY_DIAGNOSTICS_SCOPE[\s\S]+local-full/u);
  assert.doesNotMatch(
    routeFixture,
    /createOperationalErrorReport|dispatchOperationalErrorReport/u,
  );
  assert.match(routeFixture, /Symbol\.for\("__cloudflare-context__"\)/u);
  assert.match(
    routeFixture,
    /reportCaughtServerError[\s\S]+certification-failure/u,
  );
  assert.match(routeFixture, /observability\.delivery\.failed/u);
  assert.match(routeFixture, /recursiveDiagnosticAttempts/u);
  assert.match(browserFixture, /scope === "local-full"/u);
  assert.match(browserFixture, /capture_mechanism/u);
  assert.match(browserFixture, /browser-private-context-omitted/u);
  for (const name of serverCases) {
    assert.match(browserFixture, new RegExp(name, "u"));
  }
});

test("the local runner rejects recipe drift before fixed verification", async () => {
  const { certifyObservabilityErrorDiagnosticsForTesting } =
    await loadModule(runnerPath);
  const { adapters } = await createRunnerAdapters({ recipeVersion: "0.7.0" });
  adapters.verifyProject = async () => {
    throw new Error("fixed verification must not run after recipe drift");
  };

  await assert.rejects(
    () =>
      certifyObservabilityErrorDiagnosticsForTesting(
        { revision: exactRevision },
        adapters,
      ),
    (error) => {
      assert.equal(error?.name, "ObservabilityErrorDiagnosticsCertificationError");
      assert.equal(error?.code, "FRESH_SCAFFOLD_RECIPE_INVALID");
      return true;
    },
  );
});

test("the local runner refuses cleanup after owner identity replacement", async () => {
  const { certifyObservabilityErrorDiagnosticsForTesting } =
    await loadModule(runnerPath);
  const { adapters } = await createRunnerAdapters();
  let retainedOwner;
  let replacementIdentity;
  const originalVerifyFixture = adapters.verifyFixture;
  adapters.verifyFixture = async (input) => {
    const receipt = await originalVerifyFixture(input);
    retainedOwner = dirname(input.projectRoot);
    const replacement = await mkdtemp(
      join(tmpdir(), "diagnostics-certification-replacement-"),
    );
    replacementIdentity = await lstat(replacement, { bigint: true });
    await rm(retainedOwner, { recursive: true });
    await rename(replacement, retainedOwner);
    return receipt;
  };

  try {
    await assert.rejects(
      () =>
        certifyObservabilityErrorDiagnosticsForTesting(
          { revision: exactRevision },
          adapters,
        ),
      (error) => {
        assert.equal(error?.code, "CERTIFICATION_CLEANUP_FAILED");
        return true;
      },
    );
    const retainedIdentity = await lstat(retainedOwner, { bigint: true });
    assert.equal(retainedIdentity.dev, replacementIdentity.dev);
    assert.equal(retainedIdentity.ino, replacementIdentity.ino);
  } finally {
    if (retainedOwner !== undefined) {
      await rm(retainedOwner, { recursive: true, force: true });
    }
  }
});

test("the runner CLI rejects unknown private input without echoing it", async () => {
  let failure;
  try {
    await execFileAsync(
      process.execPath,
      [runnerPath, "--unknown", "private-value"],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        env: { PATH: process.env.PATH },
      },
    );
    assert.fail("unknown arguments must fail");
  } catch (error) {
    failure = error;
  }
  assert.equal(failure.code, 2);
  assert.equal(failure.stdout, "");
  assert.equal(
    failure.stderr,
    `${JSON.stringify({
      ok: false,
      code: "CERTIFICATION_ARGUMENT_INVALID",
    })}\n`,
  );
  assert.doesNotMatch(failure.stderr, /private-value/u);
});

test("the package runner resolves HEAD to the exact checkout revision", async () => {
  const runner = await loadModule(runnerPath);
  assert.equal(typeof runner.parseArgumentsForTesting, "function");
  let headReads = 0;
  const readHead = async () => {
    headReads += 1;
    return exactRevision;
  };

  assert.deepEqual(
    await runner.parseArgumentsForTesting([], readHead),
    { revision: exactRevision },
  );
  assert.equal(headReads, 1);
  assert.deepEqual(
    await runner.parseArgumentsForTesting(
      ["--revision", exactRevision],
      readHead,
    ),
    { revision: exactRevision },
  );
  assert.equal(headReads, 1);
});

test("the deployed exercise is bounded to three server cases and reads content only for the controlled safe result", async () => {
  const { exerciseObservabilityErrorDiagnosticsForTesting } =
    await loadModule(exercisePath);
  const requests = [];
  const result = await exerciseObservabilityErrorDiagnosticsForTesting(
    {
      baseUrl: "https://diagnostics-certification.example/",
      revision: exactRevision,
    },
    {
      async fetch(url, init) {
        requests.push({ url, init });
        if (url.includes("next-request-error")) {
          return responseWithoutReadableContent(500);
        }
        if (url.includes("selected-server-catch")) {
          return responseWithoutReadableContent(204);
        }
        if (url.includes("diagnostic-failure-containment")) {
          return {
            status: 200,
            async json() {
              return {
                ok: true,
                diagnosticAttempts: 1,
                deliveryResult: "provider-rejected",
                applicationResult: "preserved",
                healthRecords: 1,
                originalRecords: 1,
                recursiveDiagnosticAttempts: 0,
                scheduledTasks: 1,
              };
            },
          };
        }
        throw new Error("unexpected request");
      },
      createTimeoutSignal(milliseconds) {
        assert.equal(milliseconds, 10_000);
        return { bounded: true };
      },
    },
  );

  assert.deepEqual(result, {
    ok: true,
    capability: "observability",
    version: "0.3.0",
    subject: exactSubject,
    revision: exactRevision,
    cases: serverCases,
    providerRecordsClaimed: false,
    counts: {
      cases: 3,
      captureInvocations: 3,
      acceptedOriginals: 3,
      syntheticApplicationRequests: 3,
      expectedWorkersRecords: 4,
      expectedBetterStackRecords: 2,
      diagnosticDeliveryFailures: 1,
    },
    checks: [
      "next-request-error-contained",
      "selected-server-catch-preserved",
      "diagnostic-failure-contained",
    ],
  });
  assert.equal(requests.length, 3);
  assert.equal(requests.every(({ init }) => init.method === "GET"), true);
  assert.equal(
    requests.every(({ init }) => init.signal?.bounded === true),
    true,
  );
});

test("the deployed fixture overrides the request-scoped Cloudflare context without replacing the platform global", async () => {
  const { ModuleKind, ScriptTarget, transpileModule } =
    requireFromBuilderCore("typescript");
  const temporaryRoot = await mkdtemp(
    join(tmpdir(), "diagnostics-cloudflare-context-"),
  );
  const routeModulePath = join(temporaryRoot, "route.mjs");
  const reporterModulePath = join(temporaryRoot, "server-reporter.mjs");
  const contextKey = Symbol.for("__cloudflare-context__");
  const leaseKey = Symbol.for(
    "__observability-diagnostics-certification-lease__",
  );
  const previousContextDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    contextKey,
  );
  const previousFetch = globalThis.fetch;
  const previousConsoleInfo = console.info;
  const scheduled = [];
  const providerRequests = [];
  const cloudflareContext = {
    env: {
      BETTER_STACK_INGESTING_HOST: "provider.example",
      BETTER_STACK_SOURCE_TOKEN: "provider-placeholder",
    },
    ctx: {
      waitUntil(task) {
        scheduled.push(Promise.resolve(task));
      },
    },
  };

  try {
    const routeSource = await readFile(
      join(
        fixtureRoot,
        "apps/web/app/api/certification/diagnostics/route.ts",
      ),
      "utf8",
    );
    const routeJavaScript = transpileModule(routeSource, {
      compilerOptions: {
        module: ModuleKind.ESNext,
        target: ScriptTarget.ES2022,
      },
    }).outputText.replace(
      '"../../../../src/infrastructure/observability/server-reporter"',
      '"./server-reporter.mjs"',
    );
    await writeFile(routeModulePath, routeJavaScript, "utf8");
    await writeFile(
      reporterModulePath,
      `const contextKey = Symbol.for("__cloudflare-context__");

export async function reportCaughtServerError(_error, context) {
  const runtime = Reflect.get(globalThis, contextKey);
  console.info({
    event_name: "server.caught.error",
    correlation_id: context.correlationId,
    attributes: {
      capture_mechanism: "selected-catch",
      handled: true,
      operation: context.operation,
    },
  });
  const delivery = (async () => {
    try {
      const response = await fetch(
        \`https://\${runtime.env.BETTER_STACK_INGESTING_HOST}\`,
        { method: "POST" },
      );
      if (response.status !== 202) {
        console.info({
          event_name: "observability.delivery.failed",
          attributes: { reason: "provider-rejected", sink: "better-stack" },
        });
      }
    } catch {
      console.info({
        event_name: "observability.delivery.failed",
        attributes: { reason: "sink-threw", sink: "better-stack" },
      });
    }
  })();
  runtime.ctx.waitUntil(delivery);
}
`,
      "utf8",
    );
    Object.defineProperty(globalThis, contextKey, {
      configurable: true,
      get: () => cloudflareContext,
    });
    console.info = () => undefined;
    globalThis.fetch = async (_url, init) => {
      providerRequests.push(init?.method);
      return new Response(null, { status: 202 });
    };

    const route = await import(`${pathToFileURL(routeModulePath).href}?test=${Date.now()}`);
    const markerSuffix = exactRevision.slice(0, 16);
    const requestFor = (name) =>
      new Request(
        `https://diagnostics-certification.example/api/certification/diagnostics?case=${name}&marker=diagnostics-${name === "selected-server-catch" ? "server" : "failure"}-${markerSuffix}`,
      );

    const selectedResponse = await route.GET(
      requestFor("selected-server-catch"),
    );
    assert.equal(selectedResponse.status, 204);
    await Promise.allSettled(scheduled.splice(0));

    const failureResponse = await route.GET(
      requestFor("diagnostic-failure-containment"),
    );
    assert.equal(failureResponse.status, 200);
    assert.deepEqual(await failureResponse.json(), {
      ok: true,
      diagnosticAttempts: 1,
      deliveryResult: "provider-rejected",
      applicationResult: "preserved",
      healthRecords: 1,
      originalRecords: 1,
      recursiveDiagnosticAttempts: 0,
      scheduledTasks: 1,
    });
    assert.deepEqual(providerRequests, ["POST"]);
  } finally {
    await Promise.allSettled(scheduled.splice(0));
    globalThis.fetch = previousFetch;
    console.info = previousConsoleInfo;
    Reflect.deleteProperty(globalThis, leaseKey);
    if (previousContextDescriptor === undefined) {
      Reflect.deleteProperty(globalThis, contextKey);
    } else {
      Object.defineProperty(globalThis, contextKey, previousContextDescriptor);
    }
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("route and browser receipts reconcile to the frozen eight-case matrix", async () => {
  const { reconcileObservabilityErrorDiagnosticsReceipts } =
    await loadModule(exercisePath);
  const routeReceipt = {
    ok: true,
    capability: "observability",
    version: "0.3.0",
    subject: exactSubject,
    revision: exactRevision,
    cases: serverCases,
    providerRecordsClaimed: false,
    counts: {
      cases: 3,
      captureInvocations: 3,
      acceptedOriginals: 3,
      syntheticApplicationRequests: 3,
      expectedWorkersRecords: 4,
      expectedBetterStackRecords: 2,
      diagnosticDeliveryFailures: 1,
    },
  };
  const browserReceipt = {
    ok: true,
    capability: "observability",
    version: "0.3.0",
    subject: exactSubject,
    revision: exactRevision,
    cases: browserCases,
    scope: "browser-only",
    providerRecordsClaimed: false,
    eventIdentifiers: Array.from(
      { length: 5 },
      (_, index) => `00000000-0000-4000-8000-00000000000${index}`,
    ),
    counts: {
      cases: 5,
      captureInvocations: 6,
      acceptedOriginals: 5,
      syntheticApplicationRequests: 7,
      expectedWorkersRecords: 5,
      expectedBetterStackRecords: 5,
      diagnosticDeliveryFailures: 0,
    },
  };

  assert.deepEqual(
    reconcileObservabilityErrorDiagnosticsReceipts(
      routeReceipt,
      browserReceipt,
      exactRevision,
    ),
    {
      ok: true,
      capability: "observability",
      version: "0.3.0",
      subject: exactSubject,
      revision: exactRevision,
      cases: [...browserCases, ...serverCases],
      providerRecordsClaimed: false,
      counts: {
        cases: 8,
        captureInvocations: 9,
        acceptedOriginals: 8,
        syntheticApplicationRequests: 10,
        maximumSyntheticApplicationRequests: 16,
        expectedWorkersRecords: 9,
        expectedBetterStackRecords: 7,
        diagnosticDeliveryFailures: 1,
      },
      checks: [
        "exact-case-matrix",
        "duplicate-suppression",
        "bounded-application-requests",
        "controlled-diagnostic-failure",
      ],
    },
  );

  const drifted = structuredClone(browserReceipt);
  drifted.counts.acceptedOriginals = 6;
  assert.throws(
    () =>
      reconcileObservabilityErrorDiagnosticsReceipts(
        routeReceipt,
        drifted,
        exactRevision,
      ),
    (error) => error?.code === "RECEIPT_COUNTS_INVALID",
  );

  const reorderedRoute = structuredClone(routeReceipt);
  reorderedRoute.subject = {
    behaviorContractDigest: exactSubject.behaviorContractDigest,
    descriptorVersion: exactSubject.descriptorVersion,
  };
  reorderedRoute.counts = Object.fromEntries(
    Object.entries(reorderedRoute.counts).reverse(),
  );
  const reorderedBrowser = structuredClone(browserReceipt);
  reorderedBrowser.subject = {
    behaviorContractDigest: exactSubject.behaviorContractDigest,
    descriptorVersion: exactSubject.descriptorVersion,
  };
  reorderedBrowser.counts = Object.fromEntries(
    Object.entries(reorderedBrowser.counts).reverse(),
  );
  assert.equal(
    reconcileObservabilityErrorDiagnosticsReceipts(
      reorderedRoute,
      reorderedBrowser,
      exactRevision,
    ).ok,
    true,
  );
});

test("the current diagnostics certification has no dispatchable predecessor path", async () => {
  for (const path of retiredCertificationPaths) {
    assert.equal(await pathExists(resolve(repositoryRoot, path)), false, path);
  }

  const workspace = JSON.parse(
    await readFile(resolve(repositoryRoot, "package.json"), "utf8"),
  );
  assert.equal(
    workspace.scripts["verify:production-observability-certification"],
    undefined,
  );

  const deploymentPolicy = await readFile(
    resolve(repositoryRoot, "docs/governance/shared-test-deployment.md"),
    "utf8",
  );
  assert.doesNotMatch(
    deploymentPolicy,
    /production-observability-certification/u,
  );

  const enforcementMap = await readFile(
    resolve(repositoryRoot, "docs/architecture/enforcement-map.md"),
    "utf8",
  );
  assert.doesNotMatch(
    enforcementMap,
    /verify:production-observability-certification/u,
  );
});

test("the Cloudflare deployment sanitizer requires the explicit current subject version", async () => {
  const { createCloudflareDeploymentReceiptForTesting } = await loadModule(
    resolve(repositoryRoot, "scripts/create-cloudflare-deployment-receipt.mjs"),
  );
  const input = {
    rawInput: JSON.stringify([
      {
        id: "11111111-2222-4333-8444-555555555555",
        created_on: "2026-08-14T12:00:00.000Z",
        versions: [
          {
            version_id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
            percentage: 100,
          },
        ],
      },
    ]),
    revision: exactRevision,
    worker: "test-deploy",
  };
  assert.throws(
    () => createCloudflareDeploymentReceiptForTesting(input),
    (error) => error?.code === "DEPLOYMENT_RECEIPT_VERSION_INVALID",
  );
  assert.throws(
    () =>
      createCloudflareDeploymentReceiptForTesting({
        ...input,
        capabilityVersion: "0.2.0",
      }),
    (error) => error?.code === "DEPLOYMENT_RECEIPT_VERSION_INVALID",
  );
  assert.deepEqual(
    createCloudflareDeploymentReceiptForTesting({
      ...input,
      capabilityVersion: "0.3.0",
    }),
    {
      ok: true,
      capability: "observability",
      version: "0.3.0",
      worker: "test-deploy",
      gitRevision: exactRevision,
      cloudflareDeploymentId: "11111111-2222-4333-8444-555555555555",
      cloudflareVersionId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      checks: [
        "git-revision-validated",
        "worker-validated",
        "latest-deployment-selected",
        "single-version-100-percent",
      ],
    },
  );
});

test("the prepared workflow is manual, exact-revision, protected, single-attempt, bounded, pinned, and secret-isolated", async () => {
  const [source, providerTemplate, pageFixture, routeFixture, browserFixture] =
    await Promise.all([
      readFile(workflowPath, "utf8"),
      readOptionalFile(providerTemplatePath),
      readFile(
        join(fixtureRoot, "apps/web/app/certification/diagnostics/page.tsx"),
        "utf8",
      ),
      readFile(
        join(
          fixtureRoot,
          "apps/web/app/api/certification/diagnostics/route.ts",
        ),
        "utf8",
      ),
      readFile(
        join(fixtureRoot, "observability-error-diagnostics.spec.ts"),
        "utf8",
      ),
    ]);
  const workflow = parseYaml(source);

  assert.deepEqual(workflow.on, {
    workflow_dispatch: {
      inputs: {
        expected_revision: {
          description: "Exact main revision approved for certification",
          required: true,
          type: "string",
        },
      },
    },
  });
  assert.deepEqual(workflow.permissions, { contents: "read" });
  assert.deepEqual(workflow.concurrency, {
    group: "test-deploy",
    "cancel-in-progress": false,
    queue: "max",
  });
  assert.deepEqual(Object.keys(workflow.jobs), ["verify-and-deploy"]);
  const job = workflow.jobs["verify-and-deploy"];
  assert.equal(job.if, "github.ref == 'refs/heads/main'");
  assert.equal(job["runs-on"], "ubuntu-24.04");
  assert.equal(job["timeout-minutes"], 60);
  assert.deepEqual(job.environment, {
    name: "test-deploy",
    url: "${{ vars.DEPLOY_URL }}",
  });
  assert.equal("continue-on-error" in job, false);
  assert.equal("strategy" in job, false);

  const stepsByName = Object.fromEntries(
    job.steps.map((step) => [step.name, step]),
  );
  assert.deepEqual(stepsByName["Check out repository"].with, {
    "fetch-depth": 0,
    ref: "${{ github.sha }}",
    "persist-credentials": false,
  });
  assert.deepEqual(stepsByName["Set up pnpm and Node.js"].with, {
    version: "11.20.0",
    runtime: "node@22.23.2",
    cache: false,
    install: false,
  });
  for (const step of job.steps.filter(({ uses }) => uses !== undefined)) {
    const [action] = step.uses.split("@");
    assert.equal(isPinnedGitHubActionReference(step.uses, action), true);
  }
  assert.match(
    stepsByName["Verify approved revision and subject"].run,
    /test "\$GITHUB_SHA" = "\$EXPECTED_REVISION"/u,
  );
  assert.match(
    stepsByName["Verify approved revision and subject"].run,
    /git merge-base --is-ancestor 393225988aaed173e21dc547e69ff5b03305cf93 "\$GITHUB_SHA"/u,
  );
  assert.match(
    stepsByName["Verify fresh local scaffold"].run,
    /certify-observability-error-diagnostics\.mjs --revision "\$GITHUB_SHA"/u,
  );
  assert.match(
    stepsByName["Create deployment candidate"].run,
    /--name acme-portfolio-observability-error-diagnostics/u,
  );
  assert.match(
    stepsByName["Verify deployment candidate before certification fixtures"].run,
    /apps\/cli\/dist\/index\.js infer[\s\S]+apps\/cli\/dist\/index\.js doctor[\s\S]+apps\/cli\/dist\/index\.js diff/u,
  );
  assert.match(
    stepsByName["Add certification fixtures"].run,
    /observability-error-diagnostics/u,
  );
  assert.match(
    stepsByName["Deploy certification Worker"].run,
    /opennextjs-cloudflare deploy --name test-deploy/u,
  );
  assert.match(
    stepsByName["Install observability provider secrets"].run,
    /--version 0\.3\.0/u,
  );
  assert.match(
    stepsByName["Test deployed browser diagnostics"].run,
    /playwright test --config playwright\.deployed\.config\.ts --retries=0 tests\/e2e\/observability-error-diagnostics\.spec\.ts/u,
  );
  assert.match(
    stepsByName["Reconcile bounded certification matrix"].run,
    /--reconcile/u,
  );
  assert.equal(
    stepsByName["Upload certification receipts"].with["retention-days"],
    7,
  );
  assert.doesNotMatch(
    stepsByName["Upload certification receipts"].with.path,
    /provider-secrets|cloudflare-deployments|raw|log|trace|screenshot|video/iu,
  );
  assert.deepEqual(enumerateSecretReferences(workflow), [
    {
      path: 'jobs.verify-and-deploy.steps["Deploy certification Worker"].env.CLOUDFLARE_ACCOUNT_ID',
      reference: "secrets.CLOUDFLARE_ACCOUNT_ID",
    },
    {
      path: 'jobs.verify-and-deploy.steps["Deploy certification Worker"].env.CLOUDFLARE_API_TOKEN',
      reference: "secrets.CLOUDFLARE_API_TOKEN",
    },
    {
      path: 'jobs.verify-and-deploy.steps["Install observability provider secrets"].env.CLOUDFLARE_ACCOUNT_ID',
      reference: "secrets.CLOUDFLARE_ACCOUNT_ID",
    },
    {
      path: 'jobs.verify-and-deploy.steps["Install observability provider secrets"].env.CLOUDFLARE_API_TOKEN',
      reference: "secrets.CLOUDFLARE_API_TOKEN",
    },
    {
      path: 'jobs.verify-and-deploy.steps["Install observability provider secrets"].env.BETTER_STACK_INGESTING_HOST',
      reference: "secrets.BETTER_STACK_INGESTING_HOST",
    },
    {
      path: 'jobs.verify-and-deploy.steps["Install observability provider secrets"].env.BETTER_STACK_SOURCE_TOKEN',
      reference: "secrets.BETTER_STACK_SOURCE_TOKEN",
    },
  ]);
  assert.doesNotMatch(
    source,
    /^  (?:pull_request|push|schedule):|continue-on-error|gh workflow run|wrangler\s+delete|betterstack\.com\/api|api\.betterstack|curl|retry/imu,
  );

  if (providerTemplate !== undefined) {
    for (const name of [...browserCases, ...serverCases]) {
      assert.match(providerTemplate, new RegExp(name, "u"));
    }
    assert.match(providerTemplate, /30 seconds/u);
    assert.match(providerTemplate, /20 polls/u);
    assert.match(providerTemplate, /ten-minute/u);
    assert.match(providerTemplate, /fifteen-minute/u);
    assert.match(providerTemplate, /seven days/u);
    assert.match(providerTemplate, /cleanup-recovery/u);
    assert.match(providerTemplate, /Certification unresolved prompts/u);
  }

  assert.match(pageFixture, /reportBrowserError/u);
  assert.match(pageFixture, /reportCaughtBrowserError/u);
  assert.match(pageFixture, /unhandledrejection/u);
  assert.match(pageFixture, /react-boundary/u);
  assert.match(routeFixture, /reportCaughtServerError/u);
  assert.doesNotMatch(routeFixture, /dispatchOperationalErrorReport/u);
  assert.match(
    routeFixture,
    /reportCaughtServerError[\s\S]+certification-failure/u,
  );
  assert.match(routeFixture, /provider-rejected/u);
  assert.match(routeFixture, /observability\.delivery\.failed/u);
  assert.match(browserFixture, /duplicate-suppression/u);
  assert.match(browserFixture, /local-full/u);
  assert.match(browserFixture, /browser-private-context-omitted/u);
  assert.match(browserFixture, /OBSERVABILITY_DIAGNOSTICS_BROWSER_RECEIPT_PATH/u);

  const allNewSources = [
    source,
    providerTemplate ?? "",
    pageFixture,
    routeFixture,
    browserFixture,
  ].join("\n");
  assert.doesNotMatch(
    allNewSources,
    /0\.2\.0|a4f15a132e08da307ab412673b02152fee8509c0cc1dabb4b60856abd61f5d97/u,
  );
});
