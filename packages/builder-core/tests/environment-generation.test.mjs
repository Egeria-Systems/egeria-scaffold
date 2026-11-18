import assert from "node:assert/strict";
import test from "node:test";
import * as core from "../dist/index.js";
import { createGenerationRenderingContext } from "../dist/catalog/verified-package-versions.js";
import { ordinaryGenerationVerificationChecks } from "../dist/contracts/generation-verification.js";

const request = {
  projectName: "environment-example",
  displayName: "Environment Example",
  packageVersions: { standards: "0.1.0", observability: "0.3.0" },
};

function success(result) {
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.value;
}

for (const [profile, recipeVersion] of [["portfolio", "0.12.0"], ["site", "0.13.0"], ["app", "0.3.0"]]) {
  test(`default ${profile} generation materializes the complete environment contract`, async () => {
    const rendered = success(await core.renderSkeleton({ ...request, profile }));
    assert.equal(rendered.project.schemaVersion, "2.0.0");
    assert.equal(rendered.project.recipeVersion, recipeVersion);
    assert.ok(rendered.files.some(({ path }) => path === "docs/environments.md"));
    assert.equal(rendered.resolved.capabilities.find(({ identifier }) => identifier === "standards").version, "0.9.0");
    assert.equal(rendered.resolved.capabilities.find(({ identifier }) => identifier === "deployment-cloudflare").version, "0.9.0");
  });
}

test("default generation persists public selections without provider destinations", async () => {
  const settings = {
    consent: { policy: "explicit-opt-in" },
    providers: { cloudflareWebAnalytics: true, googleAnalytics4: true },
    operationalIntegrations: { googleSearchConsole: true, lookerStudio: { connector: "google-analytics-4" } },
  };
  const rendered = success(await core.renderSkeleton({
    ...request, profile: "site", multilingual: true, contactFormWeb3Forms: true,
    bookingCalendly: { mode: "popup" }, analytics: settings,
  }));
  assert.deepEqual(rendered.project.capabilitySettings, {
    analytics: settings, "booking-calendly": { mode: "popup" },
  });
  assert.ok(rendered.project.selectedCapabilities.includes("contact-form-web3forms"));
  assert.equal(success(core.parseProjectYaml(core.serializeProjectYaml(rendered.project))).schemaVersion, "2.0.0");
});

test("default installed inspection rejects missing controls instead of selecting generation defaults", async () => {
  const result = await core.readVerifiedProjectSnapshot(core.createInMemoryRepositoryReader({}));
  assert.equal(result.ok, false);
  assert.equal(result.issues[0].code, "PROJECT_INSPECTION_INVALID");
});

test("default codecs and installed inspection accept only the exact current tuple", async () => {
  const rendered = success(await core.renderSkeleton(
    { ...request, profile: "portfolio" }, core.createApplicationEnvironmentRenderingContext(),
  ));
  // Synthetic unit input; this record is never written or claimed as executed verification.
  const state = {
    schemaVersion: "2.0.0", projectSchemaVersion: "2.0.0", builderVersion: "0.0.0",
    origin: { profile: "portfolio", recipeVersion: "0.12.0" },
    installedCapabilities: core.createInstalledManifest(rendered.resolved),
    appliedMigrations: [], ejections: [],
    managedSurfaces: success(core.materializeInstalledSurfaces({
      files: new Map(rendered.files.map(({ path, content }) => [path, content])),
      surfaces: rendered.surfaces,
    })),
    compatibility: { node: "22.23.2", pnpm: "11.28.1", platformAdapter: "cloudflare-workers" },
    lastSuccessfulVerification: { kind: "generation", checks: ["contracts", "pre-state-inference", ...ordinaryGenerationVerificationChecks, "post-state-inference"] },
  };
  const projectSource = core.serializeProjectYaml(rendered.project);
  assert.equal(success(core.parseStateJson(JSON.stringify(state))).schemaVersion, "2.0.0");
  const read = (project, installed) => core.readVerifiedProjectSnapshot(core.createInMemoryRepositoryReader({
    ".egeria/project.yaml": project, ".egeria/state.json": JSON.stringify(installed),
  }));
  const valid = success(await read(projectSource, state));
  assert.equal(valid.renderingContext.projectSchemaVersion, "2.0.0");
  const mixed = structuredClone(state);
  mixed.installedCapabilities.find(({ identifier }) => identifier === "deployment-cloudflare").version = "0.10.0";
  for (const invalid of [mixed, { ...state, schemaVersion: "1.0.0" }, { ...state, schemaVersion: "99.0.0" }]) {
    assert.equal((await read(projectSource, invalid)).ok, false);
  }
  assert.equal(core.parseProjectYaml(projectSource.replace('schemaVersion: 2.0.0', 'schemaVersion: 1.0.0')).ok, false);
  assert.equal(core.parseStateJson(JSON.stringify({ ...state,
    lastSuccessfulVerification: { kind: "capability-upgrade", checks: ["contracts", "plan-approval", "pre-state-inference", ...ordinaryGenerationVerificationChecks, "post-change-inference"] },
  })).ok, false);

});


test("lock selection refuses retired recipe identities even with their exact declarations", async () => {
  const { resolveRecipeLockfileVersion } = await import("../dist/generation/recipe-lockfiles.js");
  for (const [profile, version, next, eslint] of [
    ["portfolio", "0.11.2", "16.3.8", "16.3.0"],
    ["site", "0.12.2", "16.3.8", "16.3.3"],
    ["app", "0.2.2", "16.3.8", "16.3.3"],
    ["portfolio", "0.11.7", "16.4.1", "16.3.0"],
    ["site", "0.12.7", "16.4.1", "16.3.3"],
    ["app", "0.2.7", "16.4.1", "16.3.3"],
  ]) {
    assert.equal(resolveRecipeLockfileVersion({ originProfile: profile, recipeVersion: version }, {
      dependencies: { next, ...(profile === "app" ? { effect: "4.0.0-rc.112" } : {}) },
      devDependencies: { "eslint-config-next": eslint, vitest: "5.0.3" },
    }), undefined);
  }
});


test("retired portfolio-to-site routes refuse before repository or verifier access", async () => {
  const forbidden = () => { throw new Error("retired route accessed an adapter"); };
  const reader = { readText: forbidden, readBytes: forbidden };
  const git = { ok: true, identity: {} };
  const transition = await core.planProfileTransition({ reader, git, toProfile: "site" });
  assert.equal(transition.ok, false);
  assert.equal(transition.issues[0].code, "PROFILE_TRANSITION_UNSUPPORTED");
  assert.deepEqual(await core.applyProfileTransition({ root: "/unused", toProfile: "site", approvedPlanFingerprint: "unused", reader, inspectWorktree: forbidden, verifier: { verifyInIsolatedCopy: forbidden } }), {
    ok: false, code: "PROFILE_TRANSITION_UNSUPPORTED", phase: "precondition", recovery: "not-required",
  });
});


test("catalog admission is limited to the four complete current descriptor tuples", () => {
  for (const persistence of [false, true]) {
    for (const jobs of [false, true]) {
      const context = createGenerationRenderingContext(persistence, false, jobs);
      const catalog = success(core.createCapabilityCatalogSnapshot(request.packageVersions, context.catalogSnapshot));
      assert.equal(catalog.some(({ identifier }) => identifier === "background-job-delivery"), jobs);
      const standards = catalog.find(({ identifier }) => identifier === "standards");
      assert.deepEqual(standards.environmentVariables, ["DEPLOY_URL", "EXPECTED_REVISION"]);
      assert.deepEqual(standards.secrets, ["CF_ACCESS_CLIENT_ID", "CF_ACCESS_CLIENT_SECRET", "GITHUB_TOKEN"]);
      for (const mixed of [
        { ...context.catalogSnapshot, standards: "0.4.0" },
        { ...context.catalogSnapshot, appFoundation: "0.1.0" },
        { ...context.catalogSnapshot, unknown: "0.1.0" },
      ]) assert.equal(core.createCapabilityCatalogSnapshot(request.packageVersions, mixed).ok, false);
    }
  }
  for (const retired of [
    { standards: "0.3.0" },
    { standards: "0.4.0", siteRouting: "0.4.0", appFoundation: "0.1.0" },
    { standards: "0.5.0", siteRouting: "0.4.0", appFoundation: "0.1.0" },
    { standards: "0.6.0", siteRouting: "0.4.0", appFoundation: "0.1.0", deploymentCloudflare: "0.4.0", applicationPersistence: "0.1.0" },
  ]) assert.equal(core.createCapabilityCatalogSnapshot(request.packageVersions, retired).ok, false);
});


test("generated quality binds local build inputs and selected browser expectations", async () => {
  const { parse } = await import("yaml");
  for (const profile of ["portfolio", "site", "app"]) {
    const rendered = success(await core.renderSkeleton({ ...request, profile,
      multilingual: true, contactFormWeb3Forms: true, bookingCalendly: { mode: "popup" },
      analytics: { consent: { policy: "explicit-opt-in" }, providers: { googleAnalytics4: true }, operationalIntegrations: {} },
      ...(profile === "app" ? { applicationPersistence: true, backgroundJobDelivery: true } : {}),
    }));
    const source = rendered.files.find(({ path }) => path === ".github/workflows/quality.yml");
    const workflow = parse(new TextDecoder().decode(source.content));
    assert.equal(workflow.jobs.verify.env.APPLICATION_ENVIRONMENT, "development");
    assert.equal(workflow.jobs.verify.env.NEXT_PUBLIC_SITE_URL, "http://localhost:3000");
    assert.equal(workflow.jobs.verify.env.BUILD_SOURCE_REVISION, "${{ github.sha }}");
    assert.equal(workflow.jobs.verify.env.NEXT_PUBLIC_ANALYTICS_ENABLED, "false");
    assert.equal(workflow.jobs.verify.env.ANALYTICS_TEST_BUILD_FLAG, "false");
    assert.equal(workflow.jobs.verify.env.ANALYTICS_TEST_TARGET, "development");
    assert.equal(workflow.jobs.verify.env.ANALYTICS_TEST_EXPECTED_SITE_ORIGIN, "http://localhost:3000");
    assert.equal(workflow.jobs.verify.env.ANALYTICS_TEST_EXPECTED_GA4_ID, "");
    assert.equal(workflow.jobs.verify.env.CONTACT_TEST_EXPECTED_ACCESS_KEY, "");
    assert.equal(workflow.jobs.verify.env.BOOKING_TEST_EXPECTED_URL, "");
    assert.equal(workflow.jobs.verify.env.BOOKING_TEST_MODE, "popup");
    assert.equal(workflow.jobs.verify.env.BOOKING_TEST_MULTILINGUAL, "true");
    assert.deepEqual(workflow.permissions, { contents: "read" });
    assert.ok(workflow.jobs.verify.steps.some(({ run }) => run === "pnpm --dir apps/web run test:e2e:preview"));
  }
});
