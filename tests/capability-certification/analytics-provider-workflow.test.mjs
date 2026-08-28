import assert from "node:assert/strict";
import { execFile, spawnSync } from "node:child_process";
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
const exactHostname = "analytics-certification.example-account.workers.dev";
const exactSiteTag = "site-tag-0123456789abcdef";
const exactSiteTokenDigest = "a".repeat(64);
const exactDeploymentId = "11111111-2222-4333-8444-555555555555";
const exactVersionId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function measuredEvidence(mode = "exercise") {
  const context = {
    schemaVersion: "1.0.0",
    mode,
    event: {
      name: "pull_request",
      action: "labeled",
      label: `analytics-certification-${mode}`,
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
      hostname: exactHostname,
      production: false,
    },
  };
  const siteIdentity = {
    headSha: exactRevision,
    environment: "analytics-certification",
    hostname: exactHostname,
    identityKnown: true,
    site: {
      siteTag: exactSiteTag,
      siteTokenSha256: exactSiteTokenDigest,
      autoInstall: false,
    },
  };
  const workerIdentity = {
    headSha: exactRevision,
    environment: "analytics-certification",
    hostname: exactHostname,
    identityKnown: true,
    worker: {
      name: "analytics-certification",
      deploymentId: exactDeploymentId,
      versionId: exactVersionId,
    },
  };
  if (mode === "cleanup") {
    return {
      context,
      siteIdentity,
      workerIdentity,
      siteReadback: null,
      deploymentReadback: null,
      readiness: null,
      browserJourney: null,
      cleanup: {
        schemaVersion: "1.0.0",
        headSha: exactRevision,
        environment: "analytics-certification",
        hostname: exactHostname,
        worker: "analytics-certification",
        site: {
          initialState: "present",
          identityDisposition: "matched",
          deletionAttempted: true,
          absenceVerified: true,
        },
        workerResource: {
          initialState: "absent",
          identityDisposition: "not-present",
          deletionAttempted: false,
          absenceVerified: true,
        },
        dedicatedRecovery: "exact-deletion-and-absence",
        operatorCleanupPending: true,
      },
    };
  }
  return {
    context,
    siteIdentity,
    workerIdentity,
    siteReadback: {
      schemaVersion: "1.0.0",
      headSha: exactRevision,
      environment: "analytics-certification",
      hostname: exactHostname,
      createdByRun: true,
      readbackVerified: true,
      siteTagMatchesIdentity: true,
      siteTokenMatchesIdentity: true,
      scriptTokenMatchesIdentity: true,
      autoInstall: false,
    },
    deploymentReadback: {
      schemaVersion: "1.0.0",
      headSha: exactRevision,
      environment: "analytics-certification",
      hostname: exactHostname,
      worker: "analytics-certification",
      scriptReadbackVerified: true,
      deploymentReadbackVerified: true,
      deploymentId: exactDeploymentId,
      versionId: exactVersionId,
      singleVersionAt100Percent: true,
    },
    readiness: {
      schemaVersion: "1.0.0",
      headSha: exactRevision,
      hostname: exactHostname,
      maximumAttempts: 20,
      intervalMilliseconds: 15_000,
      requestTimeoutMilliseconds: 5_000,
      maximumElapsedMilliseconds: 300_000,
      attempts: 4,
      elapsedMilliseconds: 45_321,
      succeeded: true,
      status: 200,
    },
    browserJourney: {
      schemaVersion: "1.0.0",
      traffic: "synthetic-only",
      requestEnvelopeLimit: 64,
      totalExternalRequests: 6,
      unexpectedExternalRequests: 0,
      cases: [
        "fresh-denial",
        "positive-grant",
        "complete-withdrawal-reload",
      ],
      providers: {
        cloudflareWebAnalytics: { scriptRequests: 1, collectionRequests: 1 },
        googleAnalytics4: { scriptRequests: 1, collectionRequests: 1 },
        microsoftClarity: { scriptRequests: 1, collectionRequests: 1 },
      },
      beforeGrant: { providerRequests: 0, unexpectedExternalRequests: 0 },
      afterGrant: { providerRequests: 6, unexpectedExternalRequests: 0 },
      withdrawalReload: {
        providerRequests: 0,
        unexpectedExternalRequests: 0,
        captureStartedBeforeAction: true,
        networkIdleObserved: true,
      },
    },
    cleanup: null,
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

const controlPlaneStepNames = [
  "Create and read back Web Analytics site",
  "Deploy dedicated certification Worker",
  "Read back dedicated Worker deployment",
  "Resolve exact exercise identity artifacts",
  "Download exact exercise identity artifacts",
  "Delete and verify task resources",
];

function assertBoundedControlPlaneRequests(source) {
  assert.match(
    source,
    /const controlPlaneFetch = \(input, init = \{\}\) =>\s*fetch\(input, \{ \.\.\.init, signal: AbortSignal\.timeout\(10_000\) \}\);/u,
  );
  assert.equal((source.match(/\bfetch\b/gu) ?? []).length, 1);
  assert.ok((source.match(/\bcontrolPlaneFetch\(/gu) ?? []).length > 0);
  assert.doesNotMatch(
    source,
    /\b(?:retry|retries|maximumAttempts|setTimeout)\b/iu,
  );
}

test("control-plane requests use exact per-request deadlines without retries", async () => {
  const workflow = parseYaml(await readFile(workflowPath, "utf8"));
  const steps = Object.fromEntries(
    workflow.jobs.certify.steps.map((step) => [step.name, step]),
  );

  for (const name of controlPlaneStepNames) {
    const source = steps[name].run;
    assertBoundedControlPlaneRequests(source);
    assert.throws(() =>
      assertBoundedControlPlaneRequests(
        source.replace("AbortSignal.timeout(10_000)", "undefined"),
      ),
    );
    assert.throws(() =>
      assertBoundedControlPlaneRequests(
        source.replace(/await controlPlaneFetch\(/u, "await fetch("),
      ),
    );
    assert.throws(() =>
      assertBoundedControlPlaneRequests(`${source}\nconst retries = 1;`),
    );
  }

  assert.match(
    steps["Wait for dedicated Worker readiness"].run,
    /AbortSignal\.timeout\(Math\.max\(1, Math\.min\(requestTimeoutMilliseconds, Math\.floor\(remaining\)\)\)\)/u,
  );
});

test("the label workflow is protected, pinned, non-cancelling, and step-secret-isolated", async () => {
  const [workflowSource, browserFixture] = await Promise.all([
    readFile(workflowPath, "utf8"),
    readFile(browserFixturePath, "utf8"),
  ]);
  const workflow = parseYaml(workflowSource);
  assert.deepEqual(workflow.on, { pull_request: { types: ["labeled"] } });
  assert.deepEqual(workflow.permissions, { actions: "read", contents: "read" });
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
    /response[\s\S]+status !== 404/u,
  );
  assert.match(
    steps["Prepare private identity envelopes"].run,
    /analytics-certification\\\.[\s\S]+workers\\\.dev[\s\S]+target\.href !== `https:\/\/\$\{target\.hostname\}\//u,
  );
  assert.match(
    steps["Create and read back Web Analytics site"].run,
    /site-identity\.json[\s\S]+readbackResponse/u,
  );
  for (const name of [
    "Upload Web Analytics identity",
    "Upload Worker identity",
  ]) {
    assert.match(String(steps[name].if), /always\(\)/u);
    assert.equal(steps[name].with["retention-days"], 7);
    assert.match(steps[name].with.name, /pull_request\.head\.sha/u);
  }
  assert.match(
    steps["Resolve exact exercise identity artifacts"].run,
    /workflow_run\?\.head_sha/u,
  );
  assert.match(
    steps["Resolve exact exercise identity artifacts"].run,
    /artifacts\?name=/u,
  );
  assert.doesNotMatch(
    steps["Resolve exact exercise identity artifacts"].run,
    /workflow_run\?\.event/u,
  );
  assert.match(
    steps["Download exact exercise identity artifacts"].run,
    /artifact_ids[\s\S]+unzip/u,
  );
  assert.match(
    steps["Download exact exercise identity artifacts"].run,
    /content-length[\s\S]+65_536/u,
  );
  assert.match(
    steps["Download exact exercise identity artifacts"].run,
    /unzip -Z1[\s\S]+site-identity\.json[\s\S]+worker-identity\.json/u,
  );
  assert.match(
    steps["Read back dedicated Worker deployment"].run,
    /workers\/scripts\/analytics-certification[\s\S]+\$\{endpoint\}\/deployments/u,
  );
  assert.match(
    steps["Read back dedicated Worker deployment"].run,
    /deployment-readback\.json/u,
  );
  assert.equal(
    steps["Wait for dedicated Worker readiness"].env.MAXIMUM_ATTEMPTS,
    "20",
  );
  assert.equal(
    steps["Wait for dedicated Worker readiness"].env.INTERVAL_MILLISECONDS,
    "15000",
  );
  assert.equal(
    steps["Wait for dedicated Worker readiness"].env.REQUEST_TIMEOUT_MILLISECONDS,
    "5000",
  );
  assert.equal(
    steps["Wait for dedicated Worker readiness"].env.MAXIMUM_ELAPSED_MILLISECONDS,
    "300000",
  );
  assert.match(
    steps["Wait for dedicated Worker readiness"].run,
    /AbortSignal\.timeout/u,
  );
  assert.match(
    steps["Wait for dedicated Worker readiness"].run,
    /elapsedMilliseconds[\s\S]+attempts/u,
  );
  assert.ok(
    job.steps.indexOf(steps["Read back dedicated Worker deployment"]) <
      job.steps.indexOf(steps["Wait for dedicated Worker readiness"]),
  );
  assert.ok(
    job.steps.indexOf(steps["Wait for dedicated Worker readiness"]) <
      job.steps.indexOf(steps["Exercise deployed consent behavior"]),
  );
  assert.match(steps["Delete and verify task resources"].run, /analytics-certification/u);
  assert.match(
    steps["Delete and verify task resources"].run,
    /planAnalyticsCertificationCleanup/u,
  );
  assert.match(steps["Delete and verify task resources"].run, /cleanup\.json/u);
  assert.match(steps["Delete and verify task resources"].run, /status === 404/u);
  assert.match(
    steps["Build redacted receipt"].run,
    /--input-directory/u,
  );
  assert.doesNotMatch(
    steps["Build redacted receipt"].run,
    /attempts:\s*1|elapsed(?:Seconds|Milliseconds):\s*0|compatibilityBaseline|cleanup-recovery/u,
  );
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
    /workflow_dispatch|push:|schedule:|pull_request_target|continue-on-error|cancel-in-progress:\s*true|--retries=[1-9]|provider-confirmed|verify:compatibility-proof|compatibilityBaseline|cleanup-recovery/iu,
  );
  assert.match(browserFixture, /ANALYTICS_PROVIDER_BROWSER_RECEIPT_PATH/u);
  assert.match(browserFixture, /data-analytics-consent-action/u);
  assert.match(browserFixture, /cloudflare-web-analytics/u);
  assert.match(browserFixture, /google-analytics-4/u);
  assert.match(browserFixture, /microsoft-clarity/u);
  assert.match(browserFixture, /c\.bing\.com/u);
  assert.match(browserFixture, /analytics\.google\.com/u);
  assert.match(browserFixture, /kind:\s*"script"/u);
  assert.match(browserFixture, /kind:\s*"collection"/u);
  assert.match(browserFixture, /requestEnvelopeLimit\s*=\s*64/u);
  assert.match(
    browserFixture,
    /withdrawalStartIndex\s*=\s*requests\.length[\s\S]+action\(page,\s*"decline"\)/u,
  );
  assert.doesNotMatch(browserFixture, /requests\s*=\s*\[\]/u);
  assert.doesNotMatch(browserFixture, /page\.route|route\.fulfill/u);

  const inlinePrograms = job.steps.flatMap((step) =>
    [...String(step.run ?? "").matchAll(/node --input-type=module -e '\n([\s\S]*?)\n\s*'/gu)].map(
      ([, source]) => source,
    ),
  );
  assert.ok(inlinePrograms.length >= 10);
  for (const source of inlinePrograms) {
    const parsed = spawnSync(
      process.execPath,
      ["--input-type=module", "--check"],
      { input: source, encoding: "utf8" },
    );
    assert.equal(parsed.status, 0, parsed.stderr);
  }
});

test("cleanup planning converges every partial prefix and refuses replacement identity", async () => {
  const { planAnalyticsCertificationCleanup } =
    await import(`${receiptBuilderPath}?cleanup-plan=${Date.now()}`);
  const context = {
    headSha: exactRevision,
    environment: "analytics-certification",
    hostname: exactHostname,
    worker: "analytics-certification",
  };
  const siteIdentity = {
    headSha: exactRevision,
    environment: "analytics-certification",
    hostname: exactHostname,
    identityKnown: true,
    site: {
      siteTag: exactSiteTag,
      siteTokenSha256: exactSiteTokenDigest,
      autoInstall: false,
    },
  };
  const workerIdentity = {
    headSha: exactRevision,
    environment: "analytics-certification",
    hostname: exactHostname,
    identityKnown: true,
    worker: {
      name: "analytics-certification",
      deploymentId: exactDeploymentId,
      versionId: exactVersionId,
    },
  };
  const currentSite = {
    hostname: exactHostname,
    siteTag: exactSiteTag,
    siteTokenSha256: exactSiteTokenDigest,
    autoInstall: false,
  };
  const currentWorker = {
    name: "analytics-certification",
    deploymentId: exactDeploymentId,
    versionId: exactVersionId,
  };

  for (const [sitePresent, workerPresent] of [
    [true, true],
    [true, false],
    [false, true],
    [false, false],
  ]) {
    assert.deepEqual(
      planAnalyticsCertificationCleanup({
        context,
        siteIdentity,
        workerIdentity,
        currentSite: sitePresent ? currentSite : null,
        currentWorker: workerPresent ? currentWorker : null,
      }),
      {
        deleteSite: sitePresent,
        deleteWorker: workerPresent,
        siteInitialState: sitePresent ? "present" : "absent",
        workerInitialState: workerPresent ? "present" : "absent",
      },
      `site ${sitePresent ? "present" : "absent"}, Worker ${workerPresent ? "present" : "absent"}`,
    );
  }

  for (const [name, currentSiteOverride, currentWorkerOverride] of [
    [
      "replacement site",
      { ...currentSite, siteTag: "replacement-site-tag" },
      currentWorker,
    ],
    [
      "replacement Worker deployment",
      currentSite,
      { ...currentWorker, deploymentId: "99999999-8888-4777-8666-555555555555" },
    ],
  ]) {
    assert.throws(
      () =>
        planAnalyticsCertificationCleanup({
          context,
          siteIdentity,
          workerIdentity,
          currentSite: currentSiteOverride,
          currentWorker: currentWorkerOverride,
        }),
      { code: "ANALYTICS_PROVIDER_EVIDENCE_INVALID" },
      name,
    );
  }

  assert.throws(
    () =>
      planAnalyticsCertificationCleanup({
        context,
        siteIdentity: { ...siteIdentity, identityKnown: false, site: null },
        workerIdentity,
        currentSite,
        currentWorker,
      }),
    { code: "ANALYTICS_PROVIDER_EVIDENCE_INVALID" },
    "a present provider resource with unknowable identity requires operator review",
  );
  assert.deepEqual(
    planAnalyticsCertificationCleanup({
      context,
      siteIdentity: { ...siteIdentity, identityKnown: false, site: null },
      workerIdentity: {
        ...workerIdentity,
        identityKnown: false,
        worker: null,
      },
      currentSite: null,
      currentWorker: null,
    }),
    {
      deleteSite: false,
      deleteWorker: false,
      siteInitialState: "absent",
      workerInitialState: "absent",
    },
  );
});

test("the redacted receipt is derived only from reconciled private measurements", async () => {
  const { createAnalyticsCertificationProviderReceiptForTesting } =
    await import(`${receiptBuilderPath}?measurements=${Date.now()}`);

  assert.throws(
    () =>
      createAnalyticsCertificationProviderReceiptForTesting({
        schemaVersion: "1.0.0",
        mode: "exercise",
        polling: { attempts: 1, elapsedMilliseconds: 0 },
        outcomes: ["deployed-application"],
      }),
    { code: "ANALYTICS_PROVIDER_EVIDENCE_INVALID" },
    "legacy aggregate claims are not measurements",
  );

  const exerciseReceipt =
    createAnalyticsCertificationProviderReceiptForTesting(measuredEvidence());
  assert.deepEqual(exerciseReceipt, {
    schemaVersion: "1.0.0",
    ok: true,
    mode: "exercise",
    subject: measuredEvidence().context.subject,
    repository: "Egeria-Systems/egeria-scaffold",
    headRef: "analytics-capability-certification",
    headSha: exactRevision,
    environment: "analytics-certification",
    worker: "analytics-certification",
    outcomes: ["deployed-application"],
    providerRecordsClaimed: false,
    providerConfirmation: "pending-human-evidence",
    resourceDisposition: "retained-for-human-provider-confirmation",
    measurements: {
      readinessAttempts: 4,
      readinessElapsedMilliseconds: 45_321,
      externalRequestEnvelopes: 6,
    },
    checks: [
      "trusted-pull-request-head",
      "exact-subject",
      "dedicated-worker-identity",
      "manual-web-analytics-readback",
      "bounded-readiness",
      "bounded-synthetic-provider-collections",
      "deployed-consent-journeys",
    ],
  });

  const cleanupReceipt =
    createAnalyticsCertificationProviderReceiptForTesting(
      measuredEvidence("cleanup"),
    );
  assert.deepEqual(cleanupReceipt.outcomes, []);
  assert.equal(
    cleanupReceipt.resourceDisposition,
    "cloudflare-only-removed-and-absence-verified",
  );
  assert.deepEqual(cleanupReceipt.measurements, {
    siteInitialState: "present",
    workerInitialState: "absent",
  });
  assert.doesNotMatch(
    JSON.stringify(cleanupReceipt),
    /cleanup-recovery|compatibility|provider-confirmed|https?:|site-tag|11111111/iu,
  );

  for (const [sitePresent, workerPresent] of [
    [true, true],
    [true, false],
    [false, true],
    [false, false],
  ]) {
    const evidence = structuredClone(measuredEvidence("cleanup"));
    evidence.cleanup.site = {
      initialState: sitePresent ? "present" : "absent",
      identityDisposition: sitePresent ? "matched" : "not-present",
      deletionAttempted: sitePresent,
      absenceVerified: true,
    };
    evidence.cleanup.workerResource = {
      initialState: workerPresent ? "present" : "absent",
      identityDisposition: workerPresent ? "matched" : "not-present",
      deletionAttempted: workerPresent,
      absenceVerified: true,
    };
    const receipt =
      createAnalyticsCertificationProviderReceiptForTesting(evidence);
    assert.deepEqual(receipt.outcomes, []);
    assert.deepEqual(receipt.measurements, {
      siteInitialState: sitePresent ? "present" : "absent",
      workerInitialState: workerPresent ? "present" : "absent",
    });
  }

  const failures = [
    ["wrong repository", (value) => { value.context.pullRequest.baseRepository = "other/repository"; }],
    ["fork", (value) => { value.context.pullRequest.headRepository = "fork/repository"; }],
    ["wrong ref", (value) => { value.context.pullRequest.headRef = "main"; }],
    ["wrong checked out SHA", (value) => { value.context.pullRequest.checkedOutSha = "f".repeat(40); }],
    ["changed label", (value) => { value.context.event.label = "analytics-certification"; }],
    ["production target", (value) => { value.context.resources.production = true; }],
    ["wrong Worker", (value) => { value.context.resources.worker = "production"; }],
    ["hardcoded top-level polling", (value) => { value.polling = { attempts: 1, elapsedMilliseconds: 0 }; }],
    ["missing readiness measurement", (value) => { value.readiness = null; }],
    ["malformed elapsed time", (value) => { value.readiness.elapsedMilliseconds = "45321"; }],
    ["zero attempts", (value) => { value.readiness.attempts = 0; }],
    ["elapsed beyond aggregate bound", (value) => { value.readiness.elapsedMilliseconds = 300_001; }],
    ["wrong Worker-derived hostname", (value) => { value.context.resources.hostname = "other-worker.example-account.workers.dev"; }],
    ["deployment replacement", (value) => { value.deploymentReadback.deploymentId = "99999999-8888-4777-8666-555555555555"; }],
    ["script-only analytics", (value) => { value.browserJourney.providers.googleAnalytics4.collectionRequests = 0; }],
    ["unexpected external origin", (value) => { value.browserJourney.unexpectedExternalRequests = 1; }],
    ["request envelope exceeded", (value) => { value.browserJourney.totalExternalRequests = 65; }],
    ["withdrawal capture reset", (value) => { value.browserJourney.withdrawalReload.captureStartedBeforeAction = false; }],
    ["false browser count", (value) => { value.browserJourney.afterGrant.providerRequests = 5; }],
  ];
  for (const [name, mutate] of failures) {
    const evidence = structuredClone(measuredEvidence());
    mutate(evidence);
    assert.throws(
      () => createAnalyticsCertificationProviderReceiptForTesting(evidence),
      { code: "ANALYTICS_PROVIDER_EVIDENCE_INVALID" },
      name,
    );
  }

  for (const [name, mutate] of [
    ["cleanup outcome overclaim", (value) => { value.outcomes = ["cleanup-recovery"]; }],
    ["false compatibility recovery", (value) => { value.cleanup.compatibilityBaselineRecovered = true; }],
    ["missing absence proof", (value) => { value.cleanup.site.absenceVerified = false; }],
  ]) {
    const evidence = structuredClone(measuredEvidence("cleanup"));
    mutate(evidence);
    assert.throws(
      () => createAnalyticsCertificationProviderReceiptForTesting(evidence),
      { code: "ANALYTICS_PROVIDER_EVIDENCE_INVALID" },
      name,
    );
  }
});

test("the executable builder parses exact owner-only measurement files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "analytics-measurements-"));
  const evidence = measuredEvidence();
  const files = {
    "context.json": evidence.context,
    "site-identity.json": evidence.siteIdentity,
    "worker-identity.json": evidence.workerIdentity,
    "site-readback.json": evidence.siteReadback,
    "deployment-readback.json": evidence.deploymentReadback,
    "readiness.json": evidence.readiness,
    "browser-journey.json": evidence.browserJourney,
  };
  try {
    await Promise.all(
      Object.entries(files).map(([name, value]) =>
        writeFile(join(directory, name), JSON.stringify(value), {
          encoding: "utf8",
          mode: 0o600,
        }),
      ),
    );
    const accepted = await execFileAsync(process.execPath, [
      receiptBuilderPath,
      "--input-directory",
      directory,
    ]);
    assert.equal(accepted.stderr, "");
    assert.equal(JSON.parse(accepted.stdout).measurements.readinessAttempts, 4);

    const assertPrivateFailure = async () =>
      assert.rejects(
        execFileAsync(process.execPath, [
          receiptBuilderPath,
          "--input-directory",
          directory,
        ]),
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

    await chmod(join(directory, "readiness.json"), 0o644);
    await assertPrivateFailure();
    await chmod(join(directory, "readiness.json"), 0o600);
    await rm(join(directory, "readiness.json"));
    await assertPrivateFailure();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
