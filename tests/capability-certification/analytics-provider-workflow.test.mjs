import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { isPinnedGitHubActionReference } from "../helpers/github-actions.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const requireFromBuilderCore = createRequire(
  resolve(repositoryRoot, "packages/builder-core/package.json"),
);
const { parse: parseYaml } = requireFromBuilderCore("yaml");
const execFileAsync = promisify(execFile);
const workflowPath = resolve(
  repositoryRoot,
  ".github/workflows/analytics-certification.yml",
);
const receiptBuilderPath = resolve(
  repositoryRoot,
  "scripts/analytics-certification-provider-receipt.mjs",
);
const browserFixturePath = resolve(
  repositoryRoot,
  "tests/capability-certification/fixtures/analytics-provider/analytics-provider.spec.ts",
);
const exactRevision = "0123456789abcdef0123456789abcdef01234567";
const exactDigest =
  "sha256:ca2e69a35e935eab011f0543fdf140e644a0dec490650298bdfba730e2e9d378";

function exerciseEvidence() {
  return {
    schemaVersion: "1.0.0",
    mode: "exercise",
    event: {
      name: "pull_request",
      action: "labeled",
      label: "analytics-certification-exercise",
    },
    pullRequest: {
      baseRepository: "Egeria-Systems/egeria-scaffold",
      headRepository: "Egeria-Systems/egeria-scaffold",
      headRef: "analytics-capability-certification",
      headSha: exactRevision,
      checkedOutSha: exactRevision,
    },
    subject: {
      identifier: "analytics",
      version: "0.1.0",
      behaviorContractDigest: exactDigest,
    },
    environment: "analytics-certification",
    resources: {
      worker: "analytics-certification",
      target: "dedicated-non-production-workers-dev",
      httpsTargetValidated: true,
      production: false,
      cloudflareWebAnalytics: {
        createdByRun: true,
        autoInstall: false,
        readbackVerified: true,
        hostnameBound: true,
        siteTokenBound: true,
        scriptTokenBound: true,
      },
    },
    polling: {
      maxAttempts: 20,
      intervalSeconds: 15,
      attempts: 4,
      elapsedSeconds: 45,
      automaticRetries: 0,
    },
    traffic: {
      syntheticOnly: true,
      realUserTraffic: false,
      personalData: false,
      boundedRequestEnvelopes: true,
      unexpectedTraffic: false,
    },
    checks: {
      revisionVerified: true,
      subjectVerified: true,
      localInstallPassed: true,
      localBuildPassed: true,
      generatedCandidateVerified: true,
      deploymentVerified: true,
      consentJourneysPassed: true,
      noRequestsBeforeGrant: true,
      withdrawalReloadPassed: true,
    },
    disposition: {
      worker: "retained-for-human-provider-confirmation",
      cloudflareWebAnalyticsSite:
        "retained-for-human-provider-confirmation",
      operatorControlledProviders: "pending-reviewed-cleanup",
    },
    outcomes: ["deployed-application"],
    providerRecordsClaimed: false,
  };
}

function cleanupEvidence() {
  const evidence = exerciseEvidence();
  return {
    ...evidence,
    mode: "cleanup",
    event: { ...evidence.event, label: "analytics-certification-cleanup" },
    resources: {
      worker: "analytics-certification",
      target: "dedicated-non-production-workers-dev",
      httpsTargetValidated: true,
      production: false,
      cloudflareWebAnalytics: {
        createdByRun: true,
        autoInstall: false,
        readbackVerified: true,
        hostnameBound: true,
        siteTokenBound: true,
        scriptTokenBound: true,
      },
    },
    checks: {
      revisionVerified: true,
      subjectVerified: true,
      resourceIdentityVerified: true,
      compatibilityBaselineRecovered: true,
      compatibilityBaselineVerified: true,
      workerDeletionVerified: true,
      webAnalyticsSiteDeletionVerified: true,
      workerAbsenceVerified: true,
      webAnalyticsSiteAbsenceVerified: true,
    },
    disposition: {
      worker: "removed-and-absence-verified",
      cloudflareWebAnalyticsSite: "removed-and-absence-verified",
      operatorControlledProviders: "pending-reviewed-cleanup",
    },
    outcomes: ["cleanup-recovery"],
  };
}

function enumerateSecretReferences(value, path = "") {
  if (typeof value === "string") {
    const match = /^\$\{\{ secrets\.([A-Z0-9_]+) \}\}$/u.exec(value);
    return match === null ? [] : [{ path, name: match[1] }];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      enumerateSecretReferences(entry, `${path}[${index}]`),
    );
  }
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, entry]) =>
    enumerateSecretReferences(entry, path === "" ? key : `${path}.${key}`),
  );
}

test("the provider receipt accepts only exact redacted exercise and cleanup evidence", async () => {
  const { createAnalyticsCertificationProviderReceiptForTesting } =
    await import(`${receiptBuilderPath}?test=${Date.now()}`);

  assert.deepEqual(
    createAnalyticsCertificationProviderReceiptForTesting(exerciseEvidence()),
    {
      schemaVersion: "1.0.0",
      ok: true,
      mode: "exercise",
      subject: {
        identifier: "analytics",
        version: "0.1.0",
        behaviorContractDigest: exactDigest,
      },
      repository: "Egeria-Systems/egeria-scaffold",
      headRef: "analytics-capability-certification",
      headSha: exactRevision,
      environment: "analytics-certification",
      worker: "analytics-certification",
      outcomes: ["deployed-application"],
      providerRecordsClaimed: false,
      providerConfirmation: "pending-human-evidence",
      resourceDisposition: "retained-for-human-provider-confirmation",
      checks: [
        "trusted-pull-request-head",
        "exact-subject",
        "dedicated-non-production-target",
        "manual-web-analytics-readback",
        "bounded-synthetic-traffic",
        "deployed-consent-journeys",
      ],
    },
  );

  const cleanupReceipt =
    createAnalyticsCertificationProviderReceiptForTesting(cleanupEvidence());
  assert.deepEqual(cleanupReceipt.outcomes, ["cleanup-recovery"]);
  assert.equal(cleanupReceipt.resourceDisposition, "removed-and-absence-verified");
  assert.equal(cleanupReceipt.providerRecordsClaimed, false);
  assert.doesNotMatch(
    JSON.stringify([cleanupReceipt]),
    /https?:|token|secret|account|provider-confirmed|production-ready/iu,
  );
});

test("the provider receipt fails closed on identity, scope, bounds, claims, and unsafe content", async () => {
  const { createAnalyticsCertificationProviderReceiptForTesting } =
    await import(`${receiptBuilderPath}?test=${Date.now()}`);
  const mutations = [
    ["wrong repository", (value) => { value.pullRequest.baseRepository = "other/repository"; }],
    ["fork", (value) => { value.pullRequest.headRepository = "fork/repository"; }],
    ["wrong ref", (value) => { value.pullRequest.headRef = "main"; }],
    ["wrong checked out SHA", (value) => { value.pullRequest.checkedOutSha = "f".repeat(40); }],
    ["changed label", (value) => { value.event.label = "analytics-certification"; }],
    ["production target", (value) => { value.resources.production = true; }],
    ["wrong Worker", (value) => { value.resources.worker = "production"; }],
    ["automatic installation", (value) => { value.resources.cloudflareWebAnalytics.autoInstall = true; }],
    ["unbounded polling", (value) => { value.polling.maxAttempts = 21; }],
    ["automatic retry", (value) => { value.polling.automaticRetries = 1; }],
    ["unexpected traffic", (value) => { value.traffic.unexpectedTraffic = true; }],
    ["real users", (value) => { value.traffic.realUserTraffic = true; }],
    ["premature provider claim", (value) => { value.outcomes.push("provider-confirmed"); }],
    ["extra field", (value) => { value.rawProviderPayload = {}; }],
    ["secret-like content", (value) => { value.disposition.operatorControlledProviders = "Bearer abcdefghijklmnopqrstuvwxyz"; }],
    ["private URL", (value) => { value.disposition.operatorControlledProviders = "https://private.example.invalid"; }],
  ];

  for (const [name, mutate] of mutations) {
    const evidence = structuredClone(exerciseEvidence());
    mutate(evidence);
    assert.throws(
      () => createAnalyticsCertificationProviderReceiptForTesting(evidence),
      { code: "ANALYTICS_PROVIDER_EVIDENCE_INVALID" },
      name,
    );
  }
});

test("the executable receipt builder emits one line and refuses exposed evidence files", async () => {
  const root = await mkdtemp(join(tmpdir(), "analytics-provider-receipt-"));
  const inputPath = join(root, "evidence.json");
  try {
    await writeFile(inputPath, JSON.stringify(exerciseEvidence()), {
      encoding: "utf8",
      mode: 0o600,
    });
    const accepted = await execFileAsync(process.execPath, [
      receiptBuilderPath,
      "--input",
      inputPath,
    ]);
    assert.equal(accepted.stderr, "");
    assert.equal(accepted.stdout.split("\n").length, 2);
    assert.deepEqual(JSON.parse(accepted.stdout), {
      schemaVersion: "1.0.0",
      ok: true,
      mode: "exercise",
      subject: exerciseEvidence().subject,
      repository: "Egeria-Systems/egeria-scaffold",
      headRef: "analytics-capability-certification",
      headSha: exactRevision,
      environment: "analytics-certification",
      worker: "analytics-certification",
      outcomes: ["deployed-application"],
      providerRecordsClaimed: false,
      providerConfirmation: "pending-human-evidence",
      resourceDisposition: "retained-for-human-provider-confirmation",
      checks: [
        "trusted-pull-request-head",
        "exact-subject",
        "dedicated-non-production-target",
        "manual-web-analytics-readback",
        "bounded-synthetic-traffic",
        "deployed-consent-journeys",
      ],
    });

    await chmod(inputPath, 0o644);
    await assert.rejects(
      execFileAsync(process.execPath, [receiptBuilderPath, "--input", inputPath]),
      (error) => {
        assert.equal(error.code, 1);
        assert.equal(error.stdout, "");
        assert.equal(
          error.stderr,
          '{"ok":false,"code":"ANALYTICS_PROVIDER_EVIDENCE_INVALID"}\n',
        );
        return true;
      },
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("the label workflow is protected, pinned, non-cancelling, and step-secret-isolated", async () => {
  const [workflowSource, browserFixture] = await Promise.all([
    readFile(workflowPath, "utf8"),
    readFile(browserFixturePath, "utf8"),
  ]);
  const workflow = parseYaml(workflowSource);
  assert.deepEqual(workflow.on, { pull_request: { types: ["labeled"] } });
  assert.deepEqual(workflow.permissions, { contents: "read" });
  assert.deepEqual(workflow.concurrency, {
    group: "analytics-certification",
    "cancel-in-progress": false,
    queue: "max",
  });
  assert.deepEqual(Object.keys(workflow.jobs), ["certify"]);
  const job = workflow.jobs.certify;
  assert.equal(job.environment.name, "analytics-certification");
  assert.equal(job.environment.url, "${{ vars.DEPLOY_URL }}");
  assert.equal(job["timeout-minutes"], 90);
  assert.equal("continue-on-error" in job, false);
  assert.equal("strategy" in job, false);

  const steps = Object.fromEntries(job.steps.map((step) => [step.name, step]));
  assert.deepEqual(steps["Check out exact pull request head"].with, {
    "fetch-depth": 0,
    ref: "${{ github.event.pull_request.head.sha }}",
    "persist-credentials": false,
  });
  for (const step of job.steps.filter(({ uses }) => uses !== undefined)) {
    const [action] = step.uses.split("@");
    assert.equal(isPinnedGitHubActionReference(step.uses, action), true);
  }
  assert.match(steps["Validate trusted request"].run, /Egeria-Systems\/egeria-scaffold/u);
  assert.match(steps["Validate trusted request"].run, /analytics-capability-certification/u);
  assert.match(steps["Validate trusted request"].run, /analytics-certification-exercise/u);
  assert.match(steps["Validate trusted request"].run, /analytics-certification-cleanup/u);
  assert.match(steps["Verify checked out subject"].run, /git rev-parse HEAD/u);
  assert.match(
    steps["Verify checked out subject"].run,
    /registry\.records\.analytics\.subject/u,
  );
  assert.match(steps["Verify checked out subject"].run, new RegExp(exactDigest, "u"));
  assert.match(
    steps["Verify and prepare analytics candidate"].run,
    /installedCapabilities[\s\S]+identifier === "analytics"[\s\S]+version === "0\.1\.0"/u,
  );
  assert.match(
    steps["Verify and prepare analytics candidate"].run,
    /analytics-settings\.ts/u,
  );
  assert.match(steps["Exercise deployed consent behavior"].run, /--retries=0/u);
  assert.match(steps["Exercise deployed consent behavior"].run, /synthetic/iu);
  assert.match(steps["Exercise deployed consent behavior"].run, /analytics-provider\.spec\.ts/u);
  assert.match(steps["Create and read back Web Analytics site"].run, /auto_install/u);
  assert.match(steps["Create and read back Web Analytics site"].run, /false/u);
  assert.match(
    steps["Create and read back Web Analytics site"].run,
    /existing[\s\S]+length !== 0/u,
  );
  assert.match(
    steps["Deploy dedicated certification Worker"].run,
    /existingWorker[\s\S]+status !== 404/u,
  );
  assert.equal(steps["Verify bounded provider envelopes"].env.MAX_ATTEMPTS, "20");
  assert.equal(
    steps["Verify bounded provider envelopes"].env.INTERVAL_SECONDS,
    "15",
  );
  assert.match(steps["Delete and verify task resources"].run, /analytics-certification/u);
  assert.match(steps["Delete and verify task resources"].run, /absence/iu);
  assert.equal(steps["Upload redacted receipt"].with["retention-days"], 7);
  assert.doesNotMatch(
    steps["Upload redacted receipt"].with.path,
    /raw|payload|log|trace|screenshot|video|site-info/iu,
  );

  const secretReferences = enumerateSecretReferences(workflow);
  assert.deepEqual(
    [...new Set(secretReferences.map(({ name }) => name))].sort(),
    [
      "CLOUDFLARE_ACCOUNT_ID",
      "CLOUDFLARE_DEPLOY_API_TOKEN",
      "CLOUDFLARE_WEB_ANALYTICS_API_TOKEN",
    ],
  );
  for (const { path } of secretReferences) {
    assert.match(
      path,
      /steps\[[0-9]+\]\.env/u,
    );
    assert.doesNotMatch(path, /jobs\.certify\.env/u);
  }
  for (const step of job.steps.filter(({ env }) =>
    Object.values(env ?? {}).some((value) =>
      String(value).includes("${{ secrets."),
    ),
  )) {
    assert.doesNotMatch(step.run, /pnpm\s+(?:install|run\s+(?:build|test|lint|typecheck))|npm\s+(?:install|test|run)/iu);
  }
  assert.doesNotMatch(
    workflowSource,
    /workflow_dispatch|push:|schedule:|pull_request_target|continue-on-error|cancel-in-progress:\s*true|--retries=[1-9]|provider-confirmed/iu,
  );
  assert.match(browserFixture, /ANALYTICS_PROVIDER_BROWSER_RECEIPT_PATH/u);
  assert.match(browserFixture, /data-analytics-consent-action/u);
  assert.match(browserFixture, /cloudflare-web-analytics/u);
  assert.match(browserFixture, /google-analytics-4/u);
  assert.match(browserFixture, /microsoft-clarity/u);
  assert.doesNotMatch(browserFixture, /page\.route|route\.fulfill/u);
});
