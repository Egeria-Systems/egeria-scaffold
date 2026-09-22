import assert from "node:assert/strict";
import { execFile, spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
  "sha256:6c562317c6888a0c4a1b14bb2d7320f309b7c6ac3927a4b94cb3e9365ae01bba";
const exactHostname = "analytics-certification.example-account.workers.dev";
const exactSiteTag = "site-tag-0123456789abcdef";
const exactSiteTokenDigest = "a".repeat(64);
const exactDeploymentId = "11111111-2222-4333-8444-555555555555";
const exactVersionId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function measuredEvidence(mode = "exercise") {
  const context = {
    schemaVersion: "2.0.0",
    mode,
    event: { name: "workflow_dispatch" },
    source: {
      repository: "Egeria-Systems/egeria-scaffold",
      ref: "refs/heads/main",
      revision: exactRevision,
      expectedRevision: exactRevision,
      checkedOutRevision: exactRevision,
      exerciseRevision: exactRevision,
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
      appBuild: null,
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
    appBuild: {
      schemaVersion: "1.0.0",
      headSha: exactRevision,
      profile: "app",
      recipeVersion: "0.2.0",
      workerIntegration: { executed: ["app-analytics"], skipped: [] },
      appBuildEvidence: [{
        fixture: "app-analytics",
        effect: { version: "4.0.0-rc.112", packageSha256: "a".repeat(64) },
        client: { files: ["apps/web/.next/static/chunks/app.js"], bytes: 25, inspectedEffectMarkers: ["~effect/Effect"] },
        server: { files: 1, bytes: 100 },
        worker: { path: "apps/web/.open-next/server-functions/default/handler.mjs", bytes: 50, sha256: "b".repeat(64) },
      }],
    },
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
      schemaVersion: "1.1.0",
      traffic: "synthetic-only",
      requestEnvelopeLimit: 64,
      totalExternalRequests: 6,
      unexpectedExternalRequests: 0,
      cases: [
        "fresh-denial",
        "persisted-denial-reload",
        "purpose-specific-partial-grant",
        "positive-grant",
        "complete-withdrawal-reload",
      ],
      providers: {
        cloudflareWebAnalytics: { scriptRequests: 1, collectionRequests: 1 },
        googleAnalytics4: { scriptRequests: 1, collectionRequests: 1 },
        microsoftClarity: { scriptRequests: 1, collectionRequests: 1 },
      },
      freshDenial: {
        providerRequests: 0,
        unexpectedExternalRequests: 0,
        consentRecordPersisted: false,
        providerCookieCount: 0,
      },
      persistedDenialReload: {
        providerRequests: 0,
        unexpectedExternalRequests: 0,
        consentRecordPersisted: true,
        consentRecordSchemaVersion: 2,
        deniedPurposeCount: 3,
        providerCookieCount: 0,
      },
      partialGrant: {
        providerRequests: 2,
        unexpectedExternalRequests: 0,
        grantedPurpose: "aggregate-traffic-and-performance",
        grantedProvider: "cloudflareWebAnalytics",
        providers: {
          cloudflareWebAnalytics: { scriptRequests: 1, collectionRequests: 1 },
          googleAnalytics4: { scriptRequests: 0, collectionRequests: 0 },
          microsoftClarity: { scriptRequests: 0, collectionRequests: 0 },
        },
      },
      fullGrant: { providerRequests: 6, unexpectedExternalRequests: 0 },
      withdrawalReload: {
        providerRequests: 0,
        unexpectedExternalRequests: 0,
        captureStartedBeforeAction: true,
        networkIdleObserved: true,
        consentRecordPersisted: true,
        deniedPurposeCount: 3,
        providerCookiesBeforeWithdrawal: 2,
        providerCookiesAfterWithdrawal: 0,
      },
      providerSourceBoundary: {
        classifiedProviderRequests: 6,
        unexpectedExternalRequests: 0,
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

test("the manual workflow is main-only, revision-bound, pinned, and step-secret-isolated", async () => {
  const [workflowSource, browserFixture] = await Promise.all([
    readFile(workflowPath, "utf8"),
    readFile(browserFixturePath, "utf8"),
  ]);
  const workflow = parseYaml(workflowSource);
  assert.deepEqual(Object.keys(workflow.on), ["workflow_dispatch"]);
  assert.deepEqual(workflow.on.workflow_dispatch.inputs, {
    expected_revision: { description: "Exact reviewed main revision approved for certification", required: true, type: "string" },
    exercise_revision: { description: "Exact earlier exercise revision to clean up; required only for cleanup", required: false, type: "string" },
    mode: { description: "Exercise or remove the exact task resources", required: true, type: "choice", options: ["exercise", "cleanup"] },
  });
  assert.deepEqual(workflow.permissions, { actions: "read", contents: "read" });
  assert.deepEqual(workflow.concurrency, {
    group: "analytics-certification",
    "cancel-in-progress": false,
    queue: "max",
  });
  assert.deepEqual(Object.keys(workflow.jobs), ["certify"]);
  const job = workflow.jobs.certify;
  assert.equal(job.if, "github.repository == 'Egeria-Systems/egeria-scaffold' && github.ref == 'refs/heads/main'");
  assert.equal(job.environment.name, "analytics-certification");
  assert.equal(job.environment.url, "${{ vars.DEPLOY_URL }}");
  assert.equal(job["timeout-minutes"], 90);
  assert.equal("continue-on-error" in job, false);
  assert.equal("strategy" in job, false);

  const steps = Object.fromEntries(job.steps.map((step) => [step.name, step]));
  assert.deepEqual(steps["Check out approved main revision"].with, {
    "fetch-depth": 0,
    ref: "${{ github.sha }}",
    "persist-credentials": false,
  });
  for (const step of job.steps.filter(({ uses }) => uses !== undefined)) {
    const [action] = step.uses.split("@");
    assert.equal(isPinnedGitHubActionReference(step.uses, action), true);
  }
  assert.match(steps["Validate trusted request"].run, /Egeria-Systems\/egeria-scaffold/u);
  assert.match(steps["Validate trusted request"].run, /refs\/heads\/main/u);
  assert.match(steps["Validate trusted request"].run, /workflow_dispatch/u);
  assert.deepEqual(steps["Verify checked out subject"].env, {
    EXPECTED_REVISION: "${{ inputs.expected_revision }}",
    EXERCISE_REVISION: "${{ inputs.exercise_revision }}",
  });
  assert.match(steps["Verify checked out subject"].run, /node scripts\/verify-approved-revision\.mjs/u);
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
  assert.match(steps["Generate exact analytics candidate"].run, /create --profile app /u);
  const preparation = steps["Verify and prepare analytics candidate"].run;
  assert.match(preparation, /run test:integration:cloudflare/u);
  assert.match(preparation, /inspectAppEffectBuild/u);
  assert.match(preparation, /requireAppRuntimeEvidence/u);
  assert.match(preparation, /app-build\.json/u);
  assert.ok(job.steps.indexOf(steps["Verify and prepare analytics candidate"]) < job.steps.indexOf(steps["Deploy dedicated certification Worker"]));
  assert.match(steps["Exercise deployed consent behavior"].run, /--retries=0/u);
  assert.match(steps["Exercise deployed consent behavior"].run, /synthetic/iu);
  assert.match(steps["Exercise deployed consent behavior"].run, /analytics-provider\.spec\.ts/u);
  assert.match(steps["Create and read back Web Analytics site"].run, /auto_install/u);
  assert.match(steps["Create and read back Web Analytics site"].run, /false/u);
  assert.match(
    steps["Create and read back Web Analytics site"].run,
    /const endpoint = `https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\/\$\{account\}\/rum\/site_info`;\s*const listEndpoint = `\$\{endpoint\}\/list`;/u,
  );
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
    assert.match(steps[name].with.name, /github\.sha/u);
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
    /const readinessTarget = new URL\("\/en-CA", target\);[\s\S]+fetch\(readinessTarget,/u,
  );
  assert.doesNotMatch(
    steps["Wait for dedicated Worker readiness"].run,
    /fetch\(target,/u,
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
    /const analyticsEndpoint = `https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\/\$\{process\.env\.CLOUDFLARE_ACCOUNT_ID\}\/rum\/site_info`;\s*const analyticsListEndpoint = `\$\{analyticsEndpoint\}\/list`;/u,
  );
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
    /pull_request|push:|schedule:|continue-on-error|cancel-in-progress:\s*true|--retries=[1-9]|provider-confirmed|verify:compatibility-proof|compatibilityBaseline|cleanup-recovery/iu,
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
    /action\(page,\s*"decline"\)[\s\S]+waitForLoadState\("networkidle"\)[\s\S]+performance\.getEntriesByType\("resource"\)/u,
  );
  assert.match(
    browserFixture,
    /reloadedDocumentResources[\s\S]+classifyUrl\(url, applicationRoot\.hostname\)[\s\S]+providerRequests\(withdrawalRequests\)/u,
  );
  assert.doesNotMatch(browserFixture, /withdrawal(?:Reload)?StartIndex/u);
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

test("cleanup admission separates the approved executor from an ancestral exercise", async () => {
  const workflow = parseYaml(await readFile(workflowPath, "utf8"));
  const step = workflow.jobs.certify.steps.find(
    ({ name }) => name === "Verify checked out subject",
  );
  const directory = await mkdtemp(join(tmpdir(), "analytics-revision-admission-"));
  const environmentPath = join(directory, "environment");
  const git = (...arguments_) => execFileAsync("git", [
    "-c", "user.name=Certification Test",
    "-c", "user.email=certification@example.invalid",
    "-c", "commit.gpgsign=false",
    ...arguments_,
  ], { cwd: directory });
  try {
    await mkdir(join(directory, "scripts"));
    await mkdir(join(directory, "certifications"));
    for (const path of ["scripts/verify-approved-revision.mjs", "certifications/capabilities.json"]) {
      await writeFile(join(directory, path), await readFile(join(repositoryRoot, path)));
    }
    await git("init", "--initial-branch=main");
    await git("commit", "--allow-empty", "-m", "Exercise revision");
    const earlierRevision = (await git("rev-parse", "HEAD")).stdout.trim();
    await git("commit", "--allow-empty", "-m", "Cleanup executor revision");
    const executorRevision = (await git("rev-parse", "HEAD")).stdout.trim();
    const unrelatedRevision = (await git("commit-tree", "HEAD^{tree}", "-m", "Unrelated revision")).stdout.trim();
    const environment = {
      PATH: process.env.PATH,
      GITHUB_REF: "refs/heads/main",
      GITHUB_SHA: executorRevision,
      EXPECTED_REVISION: executorRevision,
      CERTIFICATION_MODE: "cleanup",
      EXERCISE_REVISION: earlierRevision,
      GITHUB_ENV: environmentPath,
    };
    const run = async (overrides = {}) => {
      await writeFile(environmentPath, "");
      return spawnSync("bash", ["-e", "-c", step.run], {
        cwd: directory, encoding: "utf8", env: { ...environment, ...overrides },
      });
    };
    const accepted = await run();
    assert.equal(accepted.status, 0, accepted.stderr);
    assert.equal(await readFile(environmentPath, "utf8"), `EXERCISE_REVISION=${earlierRevision}\n`);
    const exercise = await run({ CERTIFICATION_MODE: "exercise", EXERCISE_REVISION: "" });
    assert.equal(exercise.status, 0, exercise.stderr);
    assert.equal(await readFile(environmentPath, "utf8"), `EXERCISE_REVISION=${executorRevision}\n`);
    for (const [name, overrides] of [
      ["missing exercise", { EXERCISE_REVISION: "" }],
      ["malformed exercise", { EXERCISE_REVISION: "main" }],
      ["unknown exercise", { EXERCISE_REVISION: "f".repeat(40) }],
      ["non-ancestral exercise", { EXERCISE_REVISION: unrelatedRevision }],
      ["unapproved executor", { EXPECTED_REVISION: earlierRevision }],
      ["wrong ref", { GITHUB_REF: "refs/heads/other" }],
      ["exercise override", { CERTIFICATION_MODE: "exercise" }],
    ]) {
      assert.notEqual((await run(overrides)).status, 0, name);
      assert.equal(await readFile(environmentPath, "utf8"), "", name);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("cleanup resolves only the selected exercise artifacts after main advances", async () => {
  const workflow = parseYaml(await readFile(workflowPath, "utf8"));
  const step = workflow.jobs.certify.steps.find(
    ({ name }) => name === "Resolve exact exercise identity artifacts",
  );
  const source = /node --input-type=module -e '\n([\s\S]*?)\n\s*'/u.exec(step.run)[1];
  const directory = await mkdtemp(join(tmpdir(), "analytics-exercise-artifacts-"));
  const environmentPath = join(directory, "environment");
  const executorRevision = "b".repeat(40);
  const expressions = {
    "${{ github.sha }}": executorRevision,
    "${{ env.EXERCISE_REVISION }}": exactRevision,
    "${{ github.token }}": "synthetic-github-token",
    "${{ github.api_url }}": "https://github.invalid",
    "${{ github.repository }}": "Egeria-Systems/egeria-scaffold",
  };
  const environment = Object.fromEntries(
    Object.entries(step.env).map(([name, value]) => [name, expressions[value]]),
  );
  const artifacts = ["site", "worker"].map((kind, index) => ({
    name: `analytics-certification-${kind}-identity-${exactRevision}`,
    id: index + 1,
    expired: false,
    workflow_run: { head_sha: exactRevision, head_branch: "main" },
  }));
  const run = async (values) => {
    await writeFile(environmentPath, "");
    const mockedFetch = `globalThis.fetch = async (url) => ({ ok: true, json: async () => ({ artifacts: ${JSON.stringify(values)}.filter(artifact => artifact.name === new URL(url).searchParams.get("name")) }) });\n`;
    return spawnSync(process.execPath, ["--input-type=module", "--eval", mockedFetch + source], {
      encoding: "utf8", env: { ...environment, GITHUB_ENV: environmentPath },
    });
  };
  try {
    const accepted = await run(artifacts);
    assert.equal(accepted.status, 0, accepted.stderr);
    assert.equal(await readFile(environmentPath, "utf8"), "SITE_IDENTITY_ARTIFACT_ID=1\nWORKER_IDENTITY_ARTIFACT_ID=2\n");
    for (const [name, values] of [
      ["missing identity", artifacts.slice(0, 1)],
      ["ambiguous identity", [...artifacts, { ...artifacts[0], id: 3 }]],
      ["expired identity", artifacts.map((artifact) => ({ ...artifact, expired: true }))],
      ["wrong revision", artifacts.map((artifact) => ({ ...artifact, workflow_run: { ...artifact.workflow_run, head_sha: executorRevision } }))],
      ["wrong branch", artifacts.map((artifact) => ({ ...artifact, workflow_run: { ...artifact.workflow_run, head_branch: "other" } }))],
    ]) {
      assert.notEqual((await run(values)).status, 0, name);
      assert.equal(await readFile(environmentPath, "utf8"), "", name);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("cleanup receipts bind earlier exercise identities separately from their executor", async () => {
  const { createAnalyticsCertificationProviderReceiptForTesting: createReceipt } =
    await import(receiptBuilderPath);
  const evidence = measuredEvidence("cleanup");
  const executorRevision = "b".repeat(40);
  Object.assign(evidence.context.source, {
    revision: executorRevision,
    expectedRevision: executorRevision,
    checkedOutRevision: executorRevision,
  });
  const receipt = createReceipt(evidence);
  assert.equal(receipt.headSha, executorRevision);
  assert.equal(receipt.exerciseRevision, exactRevision);
  assert.deepEqual(receipt.outcomes, []);
  for (const [name, mutate] of [
    ["missing exercise", (value) => { delete value.context.source.exerciseRevision; }],
    ["malformed exercise", (value) => { value.context.source.exerciseRevision = "main"; }],
    ["wrong exercise", (value) => { value.context.source.exerciseRevision = executorRevision; }],
    ["mixed site identity", (value) => { value.siteIdentity.headSha = executorRevision; }],
    ["mixed Worker identity", (value) => { value.workerIdentity.headSha = executorRevision; }],
    ["mixed cleanup measurement", (value) => { value.cleanup.headSha = executorRevision; }],
    ["unapproved executor", (value) => { value.context.source.expectedRevision = exactRevision; }],
  ]) {
    const invalid = structuredClone(evidence);
    mutate(invalid);
    assert.throws(() => createReceipt(invalid), { code: "ANALYTICS_PROVIDER_EVIDENCE_INVALID" }, name);
  }
  const exercise = measuredEvidence();
  exercise.context.source.exerciseRevision = executorRevision;
  assert.throws(() => createReceipt(exercise), { code: "ANALYTICS_PROVIDER_EVIDENCE_INVALID" });
});

test("the cleanup workflow deletes earlier exercise resources only while their identities still match", async () => {
  const workflow = parseYaml(await readFile(workflowPath, "utf8"));
  const steps = Object.fromEntries(workflow.jobs.certify.steps.map((step) => [step.name, step]));
  const program = (name) => /node --input-type=module -e '\n([\s\S]*?)\n\s*'/u.exec(steps[name].run)[1];
  const directory = await mkdtemp(join(tmpdir(), "analytics-cleanup-execution-"));
  const executorRevision = "b".repeat(40);
  const environment = {
    EVIDENCE_DIRECTORY: directory, DEPLOY_URL: `https://${exactHostname}/`,
    CERTIFICATION_MODE: "cleanup", GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_REPOSITORY: "Egeria-Systems/egeria-scaffold", GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: executorRevision, EXPECTED_REVISION: executorRevision, EXERCISE_REVISION: exactRevision,
    CLOUDFLARE_ACCOUNT_ID: "synthetic-account",
    CLOUDFLARE_DEPLOY_API_TOKEN: "synthetic-deploy-token",
    CLOUDFLARE_WEB_ANALYTICS_API_TOKEN: "synthetic-analytics-token",
  };
  const execute = (source) => spawnSync(process.execPath, ["--input-type=module", "--eval", source], {
    cwd: repositoryRoot, encoding: "utf8", env: environment,
  });
  try {
    const context = execute(program("Prepare private measurement context"));
    assert.equal(context.status, 0, context.stderr);
    const evidence = measuredEvidence("cleanup");
    // The site is absent; the retained Worker still needs identity-bound deletion.
    await writeFile(join(directory, "site-identity.json"), JSON.stringify({ ...evidence.siteIdentity, identityKnown: false, site: null }), { mode: 0o600 });
    await writeFile(join(directory, "worker-identity.json"), JSON.stringify(evidence.workerIdentity), { mode: 0o600 });
    for (const replacement of [true, false]) {
      const mockedFetch = `
        import { writeFileSync as recordDeletes } from "node:fs";
        const deletes = [];
        process.on("exit", () => recordDeletes(process.env.EVIDENCE_DIRECTORY + "/deletes.json", JSON.stringify(deletes)));
        let workerPresent = true;
        globalThis.fetch = async (url, options = {}) => {
          const path = new URL(url).pathname;
          if (options.method === "DELETE") { deletes.push(path); workerPresent = false; return { ok: true }; }
          if (path.endsWith("/rum/site_info/list")) return { ok: true, json: async () => ({ success: true, result: [] }) };
          if (path.endsWith("/deployments")) return { ok: true, json: async () => ({ success: true, result: [{
            id: ${JSON.stringify(replacement ? exactVersionId : exactDeploymentId)}, created_on: "2026-09-19T00:00:00Z",
            versions: [{ version_id: ${JSON.stringify(exactVersionId)}, percentage: 100 }],
          }] }) };
          if (path.endsWith("/workers/scripts/analytics-certification")) return { ok: workerPresent, status: workerPresent ? 200 : 404 };
          throw new Error("Unexpected provider request");
        };
      `;
      const result = execute(mockedFetch + program("Delete and verify task resources"));
      const deletes = JSON.parse(await readFile(join(directory, "deletes.json"), "utf8"));
      if (replacement) {
        assert.notEqual(result.status, 0);
        assert.deepEqual(deletes, []);
      } else {
        assert.equal(result.status, 0, result.stderr);
        assert.deepEqual(deletes, ["/client/v4/accounts/synthetic-account/workers/scripts/analytics-certification"]);
        await rm(join(directory, "deletes.json"));
        const { stdout } = await execFileAsync(process.execPath, [receiptBuilderPath, "--input-directory", directory]);
        const receipt = JSON.parse(stdout);
        assert.equal(receipt.headSha, executorRevision);
        assert.equal(receipt.exerciseRevision, exactRevision);
        assert.equal(receipt.resourceDisposition, "cloudflare-only-removed-and-absence-verified");
      }
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
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
    schemaVersion: "2.0.0",
    ok: true,
    mode: "exercise",
    subject: measuredEvidence().context.subject,
    repository: "Egeria-Systems/egeria-scaffold",
    headRef: "refs/heads/main",
    headSha: exactRevision,
    exerciseRevision: exactRevision,
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
      deployedConsentCases: 5,
      persistedDenialProviderRequests: 0,
      partialGrantProviderRequests: 2,
      providerCookiesAfterWithdrawal: 0,
      sourceBoundaryUnexpectedExternalRequests: 0,
    },
    checks: [
      "approved-main-revision",
      "exact-subject",
      "app-whole-worker-integration",
      "app-effect-build-inspection",
      "dedicated-worker-identity",
      "manual-web-analytics-readback",
      "bounded-readiness",
      "bounded-synthetic-provider-collections",
      "persisted-denial-reload",
      "purpose-specific-partial-grant",
      "accessible-provider-cookie-cleanup",
      "configured-provider-source-boundary",
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
    ["wrong repository", (value) => { value.context.source.repository = "other/repository"; }],
    ["unapproved revision", (value) => { value.context.source.expectedRevision = "f".repeat(40); }],
    ["wrong ref", (value) => { value.context.source.ref = "refs/heads/other"; }],
    ["wrong checked out SHA", (value) => { value.context.source.checkedOutRevision = "f".repeat(40); }],
    ["wrong event", (value) => { value.context.event.name = "pull_request"; }],
    ["legacy context", (value) => { value.context.schemaVersion = "1.0.0"; }],
    ["prior subject", (value) => { value.context.subject.behaviorContractDigest = "sha256:ca2e69a35e935eab011f0543fdf140e644a0dec490650298bdfba730e2e9d378"; }],
    ["missing app build", (value) => { value.appBuild = null; }],
    ["site build", (value) => { value.appBuild.profile = "site"; }],
    ["different build revision", (value) => { value.appBuild.headSha = "f".repeat(40); }],
    ["skipped Worker integration", (value) => { value.appBuild.workerIntegration = { executed: [], skipped: ["app-analytics"] }; }],
    ["wrong Effect version", (value) => { value.appBuild.appBuildEvidence[0].effect.version = "0.0.0"; }],
    ["missing client inspection", (value) => { value.appBuild.appBuildEvidence[0].client.inspectedEffectMarkers = []; }],
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
    ["missing persisted denial", (value) => { value.browserJourney.persistedDenialReload.consentRecordPersisted = false; }],
    ["partial grant crosses purpose boundary", (value) => { value.browserJourney.partialGrant.providers.googleAnalytics4.scriptRequests = 1; }],
    ["provider cookie retained after withdrawal", (value) => { value.browserJourney.withdrawalReload.providerCookiesAfterWithdrawal = 1; }],
    ["false browser count", (value) => { value.browserJourney.fullGrant.providerRequests = 5; }],
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
    "app-build.json": evidence.appBuild,
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
