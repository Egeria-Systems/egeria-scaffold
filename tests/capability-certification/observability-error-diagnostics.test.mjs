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
    counts: {
      cases: 3,
      captureInvocations: 3,
      acceptedOriginals: 3,
      syntheticApplicationRequests: 3,
      workersRecords: 4,
      betterStackRecords: 2,
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
    counts: {
      cases: 3,
      captureInvocations: 3,
      acceptedOriginals: 3,
      syntheticApplicationRequests: 3,
      workersRecords: 4,
      betterStackRecords: 2,
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
    eventIdentifiers: Array.from(
      { length: 5 },
      (_, index) => `00000000-0000-4000-8000-00000000000${index}`,
    ),
    counts: {
      cases: 5,
      captureInvocations: 6,
      acceptedOriginals: 5,
      syntheticApplicationRequests: 7,
      workersRecords: 5,
      betterStackRecords: 5,
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
      counts: {
        cases: 8,
        captureInvocations: 9,
        acceptedOriginals: 8,
        syntheticApplicationRequests: 10,
        maximumSyntheticApplicationRequests: 16,
        workersRecords: 9,
        betterStackRecords: 7,
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
});

test("the Cloudflare deployment sanitizer can bind the current subject without changing its historical default", async () => {
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
  assert.equal(
    createCloudflareDeploymentReceiptForTesting(input).version,
    "0.2.0",
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
  assert.match(routeFixture, /dispatchOperationalErrorReport/u);
  assert.match(routeFixture, /provider-rejected/u);
  assert.match(routeFixture, /observability\.delivery\.failed/u);
  assert.match(browserFixture, /duplicate-suppression/u);
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
