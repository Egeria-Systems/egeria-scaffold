import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { parseDocument } from "yaml";

import { createTemplateCatalog } from "../dist/generation/template-catalog.js";
import {
  deriveTemplateDestination,
  renderTemplateSource,
} from "../dist/generation/render-template.js";

const tokens = {
  projectName: "acme-studio",
  displayNameJson: JSON.stringify('Acme "Studio"\nMontréal'),
  workerName: "acme-studio-web",
};

test("current recipes own the lint patch and select exact optional dependency families", async () => {
  const core = await import("../dist/index.js");
  const { createGenerationRenderingContext, createVerifiedProjectSnapshot } = await import("../dist/catalog/verified-package-versions.js");
  const { resolveRecipeLockfileVersion } = await import("../dist/generation/recipe-lockfiles.js");
  const recipes = { portfolio: "0.12.0", site: "0.13.0", app: "0.3.0" };
  const patchPath = "patches/next-eslint-plugin-next.patch";
  const patch = await readFile(new URL("../templates/common/literal-lint-roots/patches/next-eslint-plugin-next.patch", import.meta.url));
  for (const profile of ["portfolio", "site", "app"]) {
    for (const options of [{}, { transactionalEmailResend: true }, { backgroundJobDelivery: true }, ...(profile === "app" ? [{ applicationPersistence: true }, { applicationPersistence: true, transactionalEmailResend: true }, { applicationPersistence: true, backgroundJobDelivery: true }] : [])]) {
      const context = createGenerationRenderingContext(options.applicationPersistence === true, options.transactionalEmailResend === true, options.backgroundJobDelivery === true);
      const request = { profile, projectName: "current-example", displayName: "Current Example", packageVersions: core.verifiedCapabilityPackageVersions, ...options };
      const current = assertSuccess(await core.renderSkeleton(request, context));
      assert.equal(current.project.recipeVersion, recipes[profile]);
      assert.deepEqual(Buffer.from(current.files.find(({ path }) => path === patchPath).content), patch);
      const ownedPatch = current.surfaces.find(({ path }) => path === patchPath);
      assert.equal(ownedPatch.ownership, "managed");
      assert.deepEqual(ownedPatch.owner, { kind: "builder-kernel" });
      const policy = parseGeneratedYaml(current.files, "pnpm-workspace.yaml");
      const manifest = parseGeneratedJson(current.files, "apps/web/package.json");
      const plugin = manifest.devDependencies["eslint-config-next"];
      assert.equal(policy.overrides["@next/eslint-plugin-next@" + plugin + ">fast-glob"], "-");
      assert.equal(policy.patchedDependencies["@next/eslint-plugin-next@" + plugin], patchPath);
      assert.equal(manifest.devDependencies.vitest, "5.0.3");
      assert.equal(manifest.dependencies.next, "16.4.5");
      assert.equal(policy.overrides["next@>=16.2.0 <16.4.5"], "16.4.5");
      const foundation = manifest.dependencies.effect !== undefined;
      const retainedLock = options.applicationPersistence ? "app-0.2.7-persistence"
        : profile === "app" ? "app-0.3.0"
        : profile === "site" && foundation ? "app-0.2.7"
        : profile === "portfolio" && foundation ? "portfolio-0.11.7-foundation"
        : profile + "-" + recipes[profile];
      const expectedLock = retainedLock + "-next-16.4.5";
      assert.equal(resolveRecipeLockfileVersion(current.project, manifest), expectedLock);
      for (const next of ["16.3.8", "16.4.0", "^16.4.5", "16.4.6"]) {
        assert.equal(resolveRecipeLockfileVersion(current.project, { ...manifest, dependencies: { ...manifest.dependencies, next } }), undefined);
      }
      for (const vitest of ["4.1.10", "4.1.11", "5.0.0", "^5.0.3"]) {
        assert.equal(resolveRecipeLockfileVersion(current.project, { ...manifest, devDependencies: { ...manifest.devDependencies, vitest } }), undefined);
      }
      const lockfile = parseDocument(await readFile(new URL("../lockfiles/web-recipe-" + expectedLock + "/pnpm-lock.yaml", import.meta.url), "utf8")).toJS();
      assert.deepEqual(lockfile.overrides, policy.overrides);
      assert.deepEqual(assertSuccess(createVerifiedProjectSnapshot(current.project, renderingState(core, current))).renderingContext, createGenerationRenderingContext(options.applicationPersistence === true, foundation, options.backgroundJobDelivery === true));
    }
    const candidate = assertSuccess(await core.renderSkeleton({ profile, projectName: "internal-example", displayName: "Internal Example", packageVersions: core.verifiedCapabilityPackageVersions }, core.createApplicationEnvironmentRenderingContext()));
    assert.equal(candidate.project.schemaVersion, "2.0.0");
    assert.deepEqual(Buffer.from(candidate.files.find(({ path }) => path === patchPath).content), patch);
  }
});

test("installed Next.js patch preserves its exact generated dependency view", async () => {
  const core = await import("../dist/index.js");
  const { readVerifiedProjectSnapshot } = await import("../dist/catalog/verified-package-versions.js");
  const { resolveRecipeLockfileVersion } = await import("../dist/generation/recipe-lockfiles.js");
  for (const [root, profile, projectName, displayName, persistent, lock] of [
    ["portfolio-0.12.0", "portfolio", "acme-portfolio", "Acme Portfolio", false, "portfolio-0.12.0"],
    ["app-persistence-0.3.0", "app", "acme-app-persistence", "Acme App Persistence", true, "app-0.2.7-persistence"],
  ]) {
    const fixture = new URL("../../../fixtures/generated/" + root + "/", import.meta.url);
    const reader = core.createFileSystemRepositoryReader(fileURLToPath(fixture));
    const snapshot = assertSuccess(await readVerifiedProjectSnapshot(reader));
    const rendered = assertSuccess(await core.renderSkeleton({
      profile, projectName, displayName,
      packageVersions: core.verifiedCapabilityPackageVersions,
      ...(persistent ? { applicationPersistence: true } : {}),
    }, snapshot.renderingContext));
    for (const path of ["apps/web/package.json", "pnpm-workspace.yaml"]) {
      assert.deepEqual(Buffer.from(rendered.files.find(file => file.path === path).content), await readFile(new URL(path, fixture)));
    }
    assert.equal(resolveRecipeLockfileVersion(rendered.project, parseGeneratedJson(rendered.files, "apps/web/package.json")), lock);
  }
});

function renderingState(core, rendered) {
  const managedSurfaces = assertSuccess(core.materializeInstalledSurfaces({ files: new Map(rendered.files.map(({ path, content }) => [path, content])), surfaces: rendered.surfaces }));
  const checks = rendered.project.selectedCapabilities.includes("application-persistence")
    ? core.persistenceGenerationVerificationChecks
    : rendered.project.selectedCapabilities.includes("app-foundation") ? core.appGenerationVerificationChecks : core.ordinaryGenerationVerificationChecks;
  return {
    schemaVersion: "2.0.0", builderVersion: "0.0.0", projectSchemaVersion: "2.0.0",
    origin: { profile: rendered.project.originProfile, recipeVersion: rendered.project.recipeVersion },
    installedCapabilities: core.createInstalledManifest(rendered.resolved), managedSurfaces, appliedMigrations: [], ejections: [],
    compatibility: { node: "22.23.2", pnpm: "11.28.1", platformAdapter: "cloudflare-workers" },
    lastSuccessfulVerification: { kind: "generation", checks: ["contracts", "pre-state-inference", ...checks, "post-state-inference"] },
  };
}

test("installed rendering requires a supported Next fingerprint", async (t) => {
  const core = await import("../dist/index.js");
  const { createVerifiedProjectSnapshot } = await import("../dist/catalog/verified-package-versions.js");
  const rendered = assertSuccess(await core.renderSkeleton({
    profile: "site", projectName: "current-example", displayName: "Current Example",
    packageVersions: core.verifiedCapabilityPackageVersions,
  }));
  const state = renderingState(core, rendered);
  const nextSurface = state.managedSurfaces.find(({ identifier }) => identifier === "builder-web-package-next");
  assert.ok(nextSurface);
  for (const [label, managedSurfaces] of [
    ["missing Next record", state.managedSurfaces.filter(surface => surface !== nextSurface)],
    ["mis-targeted Next record", state.managedSurfaces.map(surface =>
      surface === nextSurface ? { ...surface, fingerprintTarget: { kind: "json-value", pointer: "/dependencies/react" } } : surface)],
    ["unsupported Next version", state.managedSurfaces.map(surface =>
      surface === nextSurface ? { ...surface, fingerprint: core.fingerprintJsonValue("16.4.6") } : surface)],
  ]) {
    await t.test(label, () => {
      const snapshot = createVerifiedProjectSnapshot(rendered.project, { ...state, managedSurfaces });
      assert.equal(snapshot.ok, false);
      assert.deepEqual(snapshot.issues, [
        { code: "PROJECT_INSPECTION_INVALID", path: [], context: { reason: "installed-controls-invalid" } },
      ]);
    });
  }
});

test("frozen retired rendering controls remain inert and refuse executable selection", async () => {
  const core = await import("../dist/index.js");
  const frozen = JSON.parse(await readFile(new URL("./fixtures/retired-recipes/supported-rendering.json", import.meta.url), "utf8"));
  assert.ok(frozen.cases.length > 0);
  for (const expected of frozen.cases) {
    assert.ok(expected.files.length > 0);
    assert.equal((await core.renderSkeleton(expected.request, expected.context)).ok, false, expected.label);
  }
});

const analyticsSettings = {
  consent: { policy: "explicit-opt-in" },
  providers: {
    cloudflareWebAnalytics: true,
    googleAnalytics4: true,
    microsoftClarity: { audience: "not-directed-to-minors" },
  },
  operationalIntegrations: {
    googleSearchConsole: true,
    lookerStudio: { connector: "google-analytics-4" },
  },
};

const visualBaselinePaths = [
  "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
];

const appFoundationPaths = [
  "apps/web/src/infrastructure/cloudflare/application-environment.ts",
  "apps/web/app/api/health/route.ts",
  "apps/web/src/domain/build-information.ts",
  "apps/web/src/application/build-information-reader.ts",
  "apps/web/src/application/request-context.ts",
  "apps/web/src/application/health.ts",
  "apps/web/src/infrastructure/cloudflare/build-information-reader.ts",
  "apps/web/src/infrastructure/memory/build-information-reader.ts",
  "apps/web/src/composition/server-health.ts",
  "apps/web/src/delivery/health-route.ts",
  "apps/web/docs/application-boundaries.md",
  "apps/web/tests/unit/request-context.test.ts",
  "apps/web/tests/unit/build-information.test.ts",
  "apps/web/tests/unit/health.test.ts",
  "apps/web/tests/unit/cloudflare-build-information-reader.test.ts",
  "apps/web/tests/unit/health-route.test.ts",
  "apps/web/tests/integration/health-worker.test.ts",
  "apps/web/vitest.cloudflare.config.ts",
].sort();

test("app generation preserves production-site bytes across all optional subsets", async () => {
  const core = await import("../dist/index.js");
  for (const generation of [
    { context: undefined, recipe: "0.3.0", standards: "0.9.0", appVitest: "5.0.3", siteVitest: "5.0.3" },
  ]) {    const renderSkeleton = (request) => core.renderSkeleton(request, generation.context);
    for (let subset = 0; subset < 8; subset += 1) {
      const request = {
        projectName: "acme-app",
        displayName: "Acme App",
        packageVersions: { standards: "0.1.0", observability: "0.3.0" },
        ...(subset & 1 ? { bookingCalendly: {
          mode: "popup",
        } } : {}),
        ...(subset & 2 ? { multilingual: true } : {}),
        ...(subset & 4 ? { analytics: analyticsSettings } : {}),
      };
      const site = assertSuccess(await renderSkeleton({ ...request, profile: "site" }));
      const app = assertSuccess(await renderSkeleton({ ...request, profile: "app" }));
      assert.equal(app.project.originProfile, "app");
      assert.equal(app.project.recipeVersion, generation.recipe);
      assert.equal(app.resolved.capabilities.find(({ identifier }) => identifier === "standards").version, generation.standards);
      assert.deepEqual(app.project.capabilitySettings, site.project.capabilitySettings);
      assert.deepEqual(
        app.resolved.capabilities.map(({ identifier }) => identifier).sort(),
        [...site.resolved.capabilities.map(({ identifier }) => identifier), "app-foundation"].sort(),
      );
      const siteFiles = new Map(site.files.map(({ path, content }) => [path, content]));
      assert.deepEqual(
        app.files.map(({ path }) => path),
        [...siteFiles.keys(), ...appFoundationPaths].sort(),
      );
      for (const { path, content } of app.files) {
        if (siteFiles.has(path) && path !== "apps/web/package.json" && path !== "pnpm-workspace.yaml") {
          assert.deepEqual(content, siteFiles.get(path), `${subset}: ${path}`);
        }
      }
      const manifest = parseGeneratedJson(app.files, "apps/web/package.json");
      const siteManifest = parseGeneratedJson(site.files, "apps/web/package.json");
      assert.equal(manifest.dependencies.effect, "4.0.0-rc.112");
      assert.equal(manifest.scripts["test:integration:cloudflare"],
        "vitest run --config vitest.cloudflare.config.ts");
      assert.equal(manifest.devDependencies.vitest, generation.appVitest);
      assert.equal(siteManifest.devDependencies.vitest, generation.siteVitest);
      delete manifest.dependencies.effect;
      delete manifest.scripts["test:integration:cloudflare"];
      delete manifest.devDependencies.vitest;
      delete siteManifest.devDependencies.vitest;
      assert.deepEqual(manifest, siteManifest);
      const workspace = parseGeneratedYaml(app.files, "pnpm-workspace.yaml");
      const siteWorkspace = parseGeneratedYaml(site.files, "pnpm-workspace.yaml");
      assert.equal(workspace.allowBuilds["msgpackr-extract"], false);
      delete workspace.allowBuilds["msgpackr-extract"];
      assert.deepEqual(workspace, siteWorkspace);
      const foundation = app.resolved.capabilities.find(({ identifier }) => identifier === "app-foundation");
      assert.deepEqual(foundation.managedSurfaces.filter(({ fingerprintTarget }) => fingerprintTarget.kind === "file")
        .map(({ path }) => path).sort(), appFoundationPaths);
      assert.deepEqual(snapshotBytes(app.files), snapshotBytes(
        assertSuccess(await renderSkeleton({ ...request, profile: "app" })).files,
      ));
    }
  }
});

test("Worker integration workflows run after OpenNext and before credentials", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  for (const profile of ["portfolio", "site", "app"]) {
    const rendered = assertSuccess(await renderSkeleton({
      profile, projectName: "acme-web", displayName: "Acme Web",
      packageVersions: { standards: "0.1.0", observability: "0.3.0" },
    }));
    const files = indexFiles(rendered.files);
    const wrangler = JSON.parse(files.get("apps/web/wrangler.jsonc"));
    assert.ok(wrangler.compatibility_flags.includes("nodejs_compat"));
    assert.ok(wrangler.compatibility_flags.includes("enable_request_signal"));
    for (const path of [".github/workflows/quality.yml", ".github/workflows/deploy.yml"]) {
      const workflow = parseGeneratedYaml(rendered.files, path);
      const steps = Object.values(workflow.jobs)[0].steps;
      const commands = steps.flatMap(({ run }) => (run ?? "").split("\n"));
      const integration = commands.indexOf("pnpm --dir apps/web run --if-present test:integration:cloudflare");
      const build = commands.indexOf("pnpm --dir apps/web exec opennextjs-cloudflare build --skipNextBuild");
      assert.ok(build >= 0);
      assert.equal(integration, build + 1);
      assert.equal(steps.some(step => JSON.stringify(step.env ?? {}).includes("secrets.CLOUDFLARE_")), false);

    }
    const manifest = parseGeneratedJson(rendered.files, "apps/web/package.json");
    if (profile !== "app") {
      assert.equal(manifest.dependencies.effect, undefined);
      assert.equal(manifest.scripts["test:integration:cloudflare"], undefined);
    }
  }
});

const portfolioPaths = [
  ".github/workflows/deploy.yml",
  ".github/workflows/quality.yml",
  ".gitignore",
  ".nvmrc",
  "AGENTS.md",
  "README.md",
  "apps/web/AGENTS.md",
  "apps/web/app/api/observability/route.ts",
  "apps/web/app/error.tsx",
  "apps/web/app/global-error.tsx",
  "apps/web/app/globals.css",
  "apps/web/app/layout.tsx",
  "apps/web/app/page.tsx",
  "apps/web/content/content.config.yaml",
  "apps/web/content/en-CA/long-form/introduction.md",
  "apps/web/content/en-CA/observability.yaml",
  "apps/web/content/en-CA/site.yaml",
  "apps/web/eslint.config.mjs",
  "apps/web/instrumentation-client.ts",
  "apps/web/instrumentation.ts",
  "apps/web/next.config.ts",
  "apps/web/open-next.config.ts",
  "apps/web/package.json",
  "apps/web/playwright.config.shared.ts",
  "apps/web/playwright.deployed.config.ts",
  "apps/web/playwright.dev.config.ts",
  "apps/web/playwright.preview.config.ts",
  "apps/web/playwright.visual.config.ts",
  "apps/web/postcss.config.mjs",
  "apps/web/src/content/content-schema.ts",
  "apps/web/src/content/content-source.d.ts",
  "apps/web/src/content/read-content.ts",
  "apps/web/src/infrastructure/cloudflare/observability-context.ts",
  "apps/web/src/infrastructure/observability/browser-reporter.ts",
  "apps/web/src/infrastructure/observability/error-copy.ts",
  "apps/web/src/infrastructure/observability/installed-capability.ts",
  "apps/web/src/infrastructure/observability/server-reporter.ts",
  "apps/web/src/infrastructure/observability/web-vitals-reporter.tsx",
  "apps/web/src/presentation/content-page.tsx",
  "apps/web/src/presentation/error-fallback.tsx",
  "apps/web/src/sections/section-registry.tsx",
  "apps/web/tests/component/content-page.test.tsx",
  "apps/web/tests/e2e/site-quality.spec.ts",
  "apps/web/tests/setup/component.ts",
  "apps/web/tests/unit/content-schema.test.ts",
  "apps/web/tests/visual/home-visual.spec.ts",
  ...visualBaselinePaths,
  "apps/web/tsconfig.json",
  "apps/web/vitest.config.ts",
  "apps/web/wrangler.jsonc",
  "package.json",
  "patches/next-eslint-plugin-next.patch",
  "pnpm-workspace.yaml",
  "apps/web/.dev.vars.example",
  "apps/web/.env.example",
  "apps/web/playwright.transport.config.ts",
  "apps/web/scripts/browser-development-server.ts",
  "apps/web/scripts/check-application-environment.mjs",
  "apps/web/scripts/check-deployment-protection.mjs",
  "apps/web/scripts/check-prepared-artifact.mjs",
  "apps/web/scripts/prepare-ci-git.sh",
  "apps/web/src/configuration/application-build.ts",
  "apps/web/src/configuration/application-environment.ts",
  "apps/web/src/configuration/document-metadata.ts",
  "apps/web/src/configuration/public-build.ts",
  "apps/web/src/configuration/site-origin.ts",
  "apps/web/tests/e2e/application-test.ts",
  "apps/web/tests/e2e/application-transport.ts",
  "apps/web/tests/scripts/deployment-protection.test.mjs",
  "apps/web/tests/scripts/prepared-artifact.test.mjs",
  "apps/web/tests/transport/application-transport.spec.ts",
  "apps/web/tests/unit/application-build.test.ts",
  "apps/web/tests/unit/application-environment.test.ts",
  "apps/web/tests/unit/observability-environment.test.ts",
  "apps/web/tests/unit/site-origin.test.ts",
  "docs/environments.md",
  "docs/observability.md",
].sort();

const sitePaths = [
  ".github/workflows/deploy.yml",
  ".github/workflows/quality.yml",
  ".gitignore",
  ".nvmrc",
  "AGENTS.md",
  "README.md",
  "apps/web/AGENTS.md",
  "apps/web/app/about/page.tsx",
  "apps/web/app/api/observability/route.ts",
  "apps/web/app/error.tsx",
  "apps/web/app/global-error.tsx",
  "apps/web/app/globals.css",
  "apps/web/app/layout.tsx",
  "apps/web/app/not-found.tsx",
  "apps/web/app/page.tsx",
  "apps/web/app/robots.ts",
  "apps/web/app/sitemap.ts",
  "apps/web/app/work/error.tsx",
  "apps/web/app/work/featured/page.tsx",
  "apps/web/app/work/page.tsx",
  "apps/web/content/content.config.yaml",
  "apps/web/content/en-CA/about.yaml",
  "apps/web/content/en-CA/long-form/introduction.md",
  "apps/web/content/en-CA/not-found.yaml",
  "apps/web/content/en-CA/observability.yaml",
  "apps/web/content/en-CA/site.yaml",
  "apps/web/content/en-CA/work-featured.yaml",
  "apps/web/eslint.config.mjs",
  "apps/web/instrumentation-client.ts",
  "apps/web/instrumentation.ts",
  "apps/web/next.config.ts",
  "apps/web/open-next.config.ts",
  "apps/web/package.json",
  "apps/web/playwright.config.shared.ts",
  "apps/web/playwright.deployed.config.ts",
  "apps/web/playwright.dev.config.ts",
  "apps/web/playwright.preview.config.ts",
  "apps/web/playwright.visual.config.ts",
  "apps/web/postcss.config.mjs",
  "apps/web/src/content/content-schema.ts",
  "apps/web/src/content/content-source.d.ts",
  "apps/web/src/content/read-content.ts",
  "apps/web/src/infrastructure/cloudflare/observability-context.ts",
  "apps/web/src/infrastructure/observability/browser-reporter.ts",
  "apps/web/src/infrastructure/observability/error-copy.ts",
  "apps/web/src/infrastructure/observability/installed-capability.ts",
  "apps/web/src/infrastructure/observability/server-reporter.ts",
  "apps/web/src/infrastructure/observability/web-vitals-reporter.tsx",
  "apps/web/src/presentation/content-page.tsx",
  "apps/web/src/presentation/error-fallback.tsx",
  "apps/web/src/routing/read-routing-content.ts",
  "apps/web/src/routing/routing-content-schema.ts",
  "apps/web/src/routing/site-page.tsx",
  "apps/web/src/sections/section-registry.tsx",
  "apps/web/tests/component/content-page.test.tsx",
  "apps/web/tests/component/site-page.test.tsx",
  "apps/web/tests/e2e/site-quality.spec.ts",
  "apps/web/tests/e2e/site-routing.spec.ts",
  "apps/web/tests/setup/component.ts",
  "apps/web/tests/unit/content-schema.test.ts",
  "apps/web/tests/unit/routing-content.test.ts",
  "apps/web/tests/visual/home-visual.spec.ts",
  ...visualBaselinePaths,
  "apps/web/tsconfig.json",
  "apps/web/vitest.config.ts",
  "apps/web/wrangler.jsonc",
  "package.json",
  "patches/next-eslint-plugin-next.patch",
  "pnpm-workspace.yaml",
  "apps/web/.dev.vars.example",
  "apps/web/.env.example",
  "apps/web/playwright.transport.config.ts",
  "apps/web/scripts/browser-development-server.ts",
  "apps/web/scripts/check-application-environment.mjs",
  "apps/web/scripts/check-deployment-protection.mjs",
  "apps/web/scripts/check-prepared-artifact.mjs",
  "apps/web/scripts/prepare-ci-git.sh",
  "apps/web/src/configuration/application-build.ts",
  "apps/web/src/configuration/application-environment.ts",
  "apps/web/src/configuration/document-metadata.ts",
  "apps/web/src/configuration/public-build.ts",
  "apps/web/src/configuration/site-origin.ts",
  "apps/web/tests/e2e/application-test.ts",
  "apps/web/tests/e2e/application-transport.ts",
  "apps/web/tests/scripts/deployment-protection.test.mjs",
  "apps/web/tests/scripts/prepared-artifact.test.mjs",
  "apps/web/tests/transport/application-transport.spec.ts",
  "apps/web/tests/unit/application-build.test.ts",
  "apps/web/tests/unit/application-environment.test.ts",
  "apps/web/tests/unit/observability-environment.test.ts",
  "apps/web/tests/unit/site-origin.test.ts",
  "docs/environments.md",
  "docs/observability.md",
].sort();

const bookingCalendlyPaths = [
  "apps/web/content/fr-CA/booking-calendly.yaml",
  "apps/web/tests/component/booking-availability.test.tsx",
  "apps/web/tests/unit/booking-configuration.test.ts",
  "docs/booking-calendly.md",
  "apps/web/content/en-CA/booking-calendly.yaml",
  "apps/web/src/integrations/booking-calendly/booking-content.ts",
  "apps/web/src/integrations/booking-calendly/booking-settings.ts",
  "apps/web/src/integrations/booking-calendly/calendly-booking.tsx",
  "apps/web/tests/e2e/calendly-booking.spec.ts",
];

const multilingualPaths = [
  "docs/multilingual.md",
  "apps/web/app/[locale]/[[...segments]]/page.tsx",
  "apps/web/app/[locale]/layout.tsx",
  "apps/web/app/[locale]/not-found.tsx",
  "apps/web/content/en-CA/localized-content.yaml",
  "apps/web/content/fr-CA/localized-content.yaml",
  "apps/web/middleware.ts",
  "apps/web/src/i18n/locale.ts",
  "apps/web/src/i18n/localized-content.ts",
  "apps/web/src/i18n/localized-profile.ts",
  "apps/web/src/i18n/read-localized-content.ts",
  "apps/web/src/integrations/booking/localized-booking.tsx",
  "apps/web/src/presentation/localized-page.tsx",
  "apps/web/tests/component/multilingual-page.test.tsx",
  "apps/web/tests/e2e/multilingual-routing.spec.ts",
  "apps/web/tests/unit/locale.test.ts",
  "apps/web/tests/unit/localized-content.test.ts",
];

const analyticsPaths = [
  "apps/web/src/integrations/analytics/analytics-configuration.ts",
  "apps/web/tests/unit/analytics-configuration.test.ts",
  "apps/web/content/en-CA/analytics.yaml",
  "apps/web/content/fr-CA/analytics.yaml",
  "apps/web/src/integrations/analytics/analytics-consent-state.ts",
  "apps/web/src/integrations/analytics/analytics-consent.tsx",
  "apps/web/src/integrations/analytics/analytics-content-source.d.ts",
  "apps/web/src/integrations/analytics/analytics-content.ts",
  "apps/web/src/integrations/analytics/analytics-provider-contract.ts",
  "apps/web/src/integrations/analytics/analytics-runtime.ts",
  "apps/web/src/integrations/analytics/analytics-settings.ts",
  "apps/web/tests/component/analytics-consent.test.tsx",
  "apps/web/tests/e2e/analytics-consent.spec.ts",
  "apps/web/tests/unit/analytics-consent-state.test.ts",
  "apps/web/tests/unit/analytics-provider-contract.test.ts",
  "apps/web/tests/unit/analytics-runtime.test.ts",
  "docs/analytics.md",
];

const bookingCalendlyCopy = {
  heading: "Book a conversation",
  summary: "Choose a time that works for you.",
  linkLabel: "Schedule with Calendly",
  frameTitle: "Calendly scheduling page",
  popupHeading: "Choose a time",
  closeLabel: "Close scheduling",
  unavailable: "Online booking is currently unavailable. Please use the contact details below.",
};

const packageVersions = {
  standards: "0.1.0",
  observability: "0.3.0",
};

const decoder = new TextDecoder("utf-8", { fatal: true });

function assertSuccess(result) {
  assert.equal(result.ok, true);
  return result.value;
}

function assertFailure(result, code, rejectedValue) {
  assert.equal(result.ok, false);
  assert.deepEqual(result.issues.map((issue) => issue.code), [code]);
  assert.equal(JSON.stringify(result.issues).includes(rejectedValue), false);
}

function assertFailureReason(result, reason) {
  assert.equal(result.ok, false);
  assert.equal(result.issues[0]?.context.reason, reason);
}

function indexFiles(files) {
  return new Map(
    files.flatMap((file) =>
      visualBaselinePaths.includes(file.path)
        ? []
        : [[file.path, decoder.decode(file.content)]],
    ),
  );
}

function indexFileBytes(files) {
  return new Map(files.map(({ path, content }) => [path, content]));
}

async function findGeneratedTypeScriptDiagnostics(files, sourcePath, code) {
  const typescriptModule = await import("typescript");
  const typescript = typescriptModule.default ?? typescriptModule;
  const projectRoot = "/generated";
  const settingsPath =
    "apps/web/src/integrations/booking-calendly/booking-settings.ts";
  const indexedFiles = indexFiles(files);
  const generatedSources = new Map([
    [join(projectRoot, sourcePath), indexedFiles.get(sourcePath)],
    [join(projectRoot, settingsPath), indexedFiles.get(settingsPath)],
  ]);
  for (const source of generatedSources.values()) {
    assert.notEqual(source, undefined);
  }
  const compilerOptions = {
    module: typescript.ModuleKind.ESNext,
    moduleResolution: typescript.ModuleResolutionKind.Bundler,
    noEmit: true,
    skipLibCheck: true,
    strict: true,
    target: typescript.ScriptTarget.ES2022,
  };
  const compilerHost = typescript.createCompilerHost(compilerOptions);
  const getSourceFile = compilerHost.getSourceFile.bind(compilerHost);
  compilerHost.getSourceFile = (
    fileName,
    languageVersion,
    onError,
    shouldCreateNewSourceFile,
  ) => {
    const source = generatedSources.get(fileName);
    return source === undefined
      ? getSourceFile(
          fileName,
          languageVersion,
          onError,
          shouldCreateNewSourceFile,
        )
      : typescript.createSourceFile(fileName, source, languageVersion, true);
  };
  compilerHost.resolveModuleNames = (moduleNames) =>
    moduleNames.map((moduleName) =>
      moduleName ===
      "../../src/integrations/booking-calendly/booking-settings"
        ? {
            extension: typescript.Extension.Ts,
            isExternalLibraryImport: false,
            resolvedFileName: join(projectRoot, settingsPath),
          }
        : undefined,
    );

  const sourceFileName = join(projectRoot, sourcePath);
  const program = typescript.createProgram(
    [...generatedSources.keys()],
    compilerOptions,
    compilerHost,
  );
  const sourceFile = program.getSourceFile(sourceFileName);
  assert.notEqual(sourceFile, undefined);

  return program
    .getSemanticDiagnostics(sourceFile)
    .filter((diagnostic) => diagnostic.code === code)
    .map((diagnostic) => typescript.flattenDiagnosticMessageText(
      diagnostic.messageText,
      "\n",
    ));
}

function parseGeneratedJson(files, path) {
  const source = indexFiles(files).get(path);
  assert.notEqual(source, undefined);
  return JSON.parse(source);
}

function parseGeneratedYaml(files, path) {
  const source = indexFiles(files).get(path);
  assert.notEqual(source, undefined);
  const document = parseDocument(source, {
    version: "1.2",
    schema: "core",
    resolveKnownTags: false,
    strict: true,
    stringKeys: true,
    uniqueKeys: true,
  });
  assert.deepEqual(document.errors, []);
  assert.deepEqual(document.warnings, []);
  return document.toJS({ maxAliasCount: 0, mapAsMap: false });
}

function snapshotBytes(files) {
  return files.map(({ path, content }) => ({ path, content: [...content] }));
}

function contrastRatio(foreground, background) {
  const relativeLuminance = (hex) => {
    const channels = hex.match(/[0-9a-f]{2}/giu).map((value) =>
      Number.parseInt(value, 16) / 255,
    );
    const [red, green, blue] = channels.map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );

    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const values = [relativeLuminance(foreground), relativeLuminance(background)];

  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
}

async function loadRenderSkeleton() {
  const module = await import("../dist/index.js");
  assert.equal(typeof module.renderSkeleton, "function");
  return (request, context) => module.renderSkeleton(request, context);
}

async function compileGeneratedContentModule(files) {
  const source = indexFiles(files).get(
    "apps/web/src/content/content-schema.ts",
  );
  assert.notEqual(source, undefined);
  const typescriptModule = await import("typescript");
  const typescript = typescriptModule.default ?? typescriptModule;
  const transpiled = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.ESNext,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText;
  const executable = transpiled.replace(
    'from "yaml"',
    `from ${JSON.stringify(import.meta.resolve("yaml"))}`,
  );
  assert.notEqual(executable, transpiled);

  const moduleUrl = `data:text/javascript;base64,${Buffer.from(executable).toString("base64")}`;

  return { moduleUrl, module: await import(moduleUrl) };
}

async function loadGeneratedContentModule(files) {
  return (await compileGeneratedContentModule(files)).module;
}

async function loadGeneratedRoutingContentModule(files) {
  const source = indexFiles(files).get(
    "apps/web/src/routing/routing-content-schema.ts",
  );
  assert.notEqual(source, undefined);
  const typescriptModule = await import("typescript");
  const typescript = typescriptModule.default ?? typescriptModule;
  const transpiled = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.ESNext,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText;
  const contentModule = await compileGeneratedContentModule(files);
  const executable = transpiled.replace(
    'from "../content/content-schema"',
    `from ${JSON.stringify(contentModule.moduleUrl)}`,
  );
  assert.notEqual(executable, transpiled);

  return import(
    `data:text/javascript;base64,${Buffer.from(executable).toString("base64")}`
  );
}

async function loadGeneratedBookingContentModule(files) {
  const indexedFiles = indexFiles(files);
  const source = indexedFiles.get(
    "apps/web/src/integrations/booking-calendly/booking-content.ts",
  );
  const bookingContentSource = indexedFiles.get(
    "apps/web/content/en-CA/booking-calendly.yaml",
  );
  assert.notEqual(source, undefined);
  assert.notEqual(bookingContentSource, undefined);
  const typescriptModule = await import("typescript");
  const typescript = typescriptModule.default ?? typescriptModule;
  const transpiled = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.ESNext,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText;
  const contentModule = await compileGeneratedContentModule(files);
  const withSource = transpiled.replace(
    'import bookingContentSource from "../../../content/en-CA/booking-calendly.yaml";',
    `const bookingContentSource = ${JSON.stringify(bookingContentSource)};`,
  ).replace(
    'import frenchBookingContentSource from "../../../content/fr-CA/booking-calendly.yaml";',
    `const frenchBookingContentSource = ${JSON.stringify(indexedFiles.get("apps/web/content/fr-CA/booking-calendly.yaml"))};`,
  );
  const executable = withSource.replace(
    'from "../../content/content-schema"',
    `from ${JSON.stringify(contentModule.moduleUrl)}`,
  );
  assert.notEqual(withSource, transpiled);
  assert.notEqual(executable, withSource);

  return import(
    `data:text/javascript;base64,${Buffer.from(executable).toString("base64")}`
  );
}

async function loadGeneratedSectionModule(files) {
  const source = indexFiles(files).get(
    "apps/web/src/sections/section-registry.tsx",
  );
  assert.notEqual(source, undefined);
  const typescriptModule = await import("typescript");
  const typescript = typescriptModule.default ?? typescriptModule;
  const transpiled = typescript.transpileModule(source, {
    compilerOptions: {
      jsx: typescript.JsxEmit.ReactJSX,
      module: typescript.ModuleKind.ESNext,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText;
  const contentModule = await compileGeneratedContentModule(files);
  const jsxRuntimeUrl = `data:text/javascript;base64,${Buffer.from(
    [
      "export const Fragment = Symbol.for('react.fragment');",
      "export function jsx(type, props, key) { return { type, props: props ?? {}, key: key ?? null }; }",
      "export const jsxs = jsx;",
    ].join("\n"),
  ).toString("base64")}`;
  const withContentImport = transpiled.replace(
    'from "../content/content-schema"',
    `from ${JSON.stringify(contentModule.moduleUrl)}`,
  );
  const executable = withContentImport.replace(
    'from "react/jsx-runtime"',
    `from ${JSON.stringify(jsxRuntimeUrl)}`,
  );
  assert.notEqual(withContentImport, transpiled);
  assert.notEqual(executable, withContentImport);

  return import(
    `data:text/javascript;base64,${Buffer.from(executable).toString("base64")}`
  );
}

async function loadGeneratedPresentationModule(files) {
  const source = indexFiles(files).get(
    "apps/web/src/presentation/content-page.tsx",
  );
  assert.notEqual(source, undefined);
  const typescriptModule = await import("typescript");
  const typescript = typescriptModule.default ?? typescriptModule;
  const transpiled = typescript.transpileModule(source, {
    compilerOptions: {
      jsx: typescript.JsxEmit.ReactJSX,
      module: typescript.ModuleKind.ESNext,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText;
  const sectionModuleUrl = `data:text/javascript;base64,${Buffer.from(
    "export function SectionComposition(props) { return { type: 'section-composition', props, key: null }; }",
  ).toString("base64")}`;
  const jsxRuntimeUrl = `data:text/javascript;base64,${Buffer.from(
    [
      "export const Fragment = Symbol.for('react.fragment');",
      "export function jsx(type, props, key) { return { type, props: props ?? {}, key: key ?? null }; }",
      "export const jsxs = jsx;",
    ].join("\n"),
  ).toString("base64")}`;
  const withSectionImport = transpiled.replace(
    'from "../sections/section-registry"',
    `from ${JSON.stringify(sectionModuleUrl)}`,
  );
  const executable = withSectionImport.replace(
    'from "react/jsx-runtime"',
    `from ${JSON.stringify(jsxRuntimeUrl)}`,
  );
  assert.notEqual(withSectionImport, transpiled);
  assert.notEqual(executable, withSectionImport);

  return import(
    `data:text/javascript;base64,${Buffer.from(executable).toString("base64")}`
  );
}

let deployedConfigurationLoad = 0;

async function loadGeneratedDeployedConfigurationModule(files, deployedURL) {
  const indexed = indexFiles(files);
  const source = indexed.get("apps/web/playwright.deployed.config.ts");
  const typescriptModule = await import("typescript");
  const typescript = typescriptModule.default ?? typescriptModule;
  const compile = source => typescript.transpileModule(source, {
    compilerOptions: { module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2022 },
  }).outputText;
  const developmentServerURL = `data:text/javascript;base64,${Buffer.from(compile(indexed.get("apps/web/scripts/browser-development-server.ts"))).toString("base64")}`;
  const transportSource = compile(indexed.get("apps/web/tests/e2e/application-transport.ts"));
  const executableTransport = transportSource.replace(
    'from "../../scripts/browser-development-server.ts"',
    `from ${JSON.stringify(developmentServerURL)}`,
  );
  assert.notEqual(executableTransport, transportSource);
  const transportURL = `data:text/javascript;base64,${Buffer.from(executableTransport).toString("base64")}`;
  const executable = compile(source.replace(
    'import { createBrowserQualityConfig } from "./playwright.config.shared";',
    `import { readTransportSettings } from ${JSON.stringify(transportURL)};
const createBrowserQualityConfig = options => { readTransportSettings(options.baseURL, process.env); return options; };`,
  ));
  const inputs = { DEPLOY_URL: deployedURL, NEXT_PUBLIC_SITE_URL: deployedURL, APPLICATION_ENVIRONMENT: "production" };
  const original = Object.fromEntries(Object.keys(inputs).map(key => [key, process.env[key]]));
  for (const [key, value] of Object.entries(inputs)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  try {
    deployedConfigurationLoad += 1;
    return await import(`data:text/javascript;base64,${Buffer.from(executable).toString("base64")}#load-${deployedConfigurationLoad}`);
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

let observabilityRouteLoad = 0;

async function loadGeneratedObservabilityRoute(files, throwOnReport = false) {
  const source = indexFiles(files).get(
    "apps/web/app/api/observability/route.ts",
  );
  assert.notEqual(source, undefined);
  const typescriptModule = await import("typescript");
  const typescript = typescriptModule.default ?? typescriptModule;
  const transpiled = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.ESNext,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText;
  observabilityRouteLoad += 1;
  const eventKey = `__observabilityEvents${observabilityRouteLoad}`;
  const reportKey = `__observabilityErrorReports${observabilityRouteLoad}`;
  const prohibitedTokenKey =
    `__isProhibitedObservabilityToken${observabilityRouteLoad}`;
  globalThis[eventKey] = [];
  globalThis[reportKey] = [];
  const canonicalReporter = await loadGeneratedServerReporter(files, {
    ingestingHost: "",
    sourceToken: "",
  });
  globalThis[prohibitedTokenKey] =
    canonicalReporter.module.isProhibitedObservabilityToken;
  const reporterModule = `data:text/javascript;base64,${Buffer.from(
    [
      `export async function reportBrowserEvent(input) { globalThis[${JSON.stringify(eventKey)}].push(input);`,
      ...(throwOnReport ? ['throw new Error("transport failed");'] : []),
      "}",
      `export async function reportBrowserErrorReport(input) { globalThis[${JSON.stringify(reportKey)}].push(input);`,
      ...(throwOnReport ? ['throw new Error("transport failed");'] : []),
      "}",
      `export const isProhibitedObservabilityToken = globalThis[${JSON.stringify(prohibitedTokenKey)}];`,
    ].join("\n"),
  ).toString("base64")}`;
  const withReporter = transpiled.replace(
    'from "../../../src/infrastructure/observability/server-reporter"',
    `from ${JSON.stringify(reporterModule)}`,
  );
  const executable = withReporter.replace(
    'from "@egeria-systems/observability"',
    `from ${JSON.stringify(new URL("../../observability/dist/index.js", import.meta.url).href)}`,
  );
  assert.notEqual(withReporter, transpiled);
  assert.notEqual(executable, withReporter);

  return {
    module: await import(
      `data:text/javascript;base64,${Buffer.from(executable).toString("base64")}#route-${observabilityRouteLoad}`
    ),
    events: globalThis[eventKey],
    reports: globalThis[reportKey],
  };
}

async function browserErrorEnvelope(
  error = Object.freeze({
    name: "Error",
    message: "synthetic browser failure",
    stack: "Error: synthetic browser failure\n    at render (src/app.tsx:12:4)",
  }),
  overrides = {},
) {
  const observability = await import("../../observability/dist/index.js");
  const browser = await import("../../observability/dist/browser.js");
  const capture = Object.freeze({
    mechanism: "browser-error-event",
    handled: false,
  });
  const event = assertSuccess(
    observability.createOperationalEvent(
      {
        name: "browser.window.error",
        kind: "application.error",
        runtime: "browser",
        severity: "error",
        context: { eventId: "browser-event-123", service: "web" },
        errorCategory: "unexpected",
        attributes: {
          capture_mechanism: "browser-error-event",
          handled: false,
        },
      },
      {
        allowedAttributeNames: ["capture_mechanism", "handled"],
        clock: { now: () => new Date("2026-08-13T12:00:00.000Z") },
      },
    ),
  );
  const report = assertSuccess(
    observability.createOperationalErrorReport(event, error, capture, {}),
  );
  const envelope = assertSuccess(browser.createBrowserErrorEnvelope(report));
  return { ...envelope, ...overrides };
}

async function webVitalEnvelope() {
  const observability = await import("../../observability/dist/index.js");
  const browser = await import("../../observability/dist/browser.js");
  const event = assertSuccess(
    observability.createOperationalEvent(
      {
        name: "browser.web.vital",
        kind: "web.vital",
        runtime: "browser",
        severity: "info",
        context: { eventId: "browser-vital-123", service: "web" },
        attributes: {
          metric_name: "LCP",
          value: 1_234.5,
          delta: 10.25,
          rating: "good",
          navigation_type: "navigate",
        },
      },
      {
        allowedAttributeNames: [
          "delta",
          "metric_name",
          "navigation_type",
          "rating",
          "value",
        ],
        clock: { now: () => new Date("2026-08-13T12:00:00.000Z") },
      },
    ),
  );
  return assertSuccess(browser.createBrowserEnvelope(event));
}

function observabilityRequest(body, overrides = {}) {
  return new Request(
    overrides.url ?? "https://portfolio.example/api/observability",
    {
      method: "POST",
      headers: {
        origin: "https://portfolio.example",
        "content-type": "application/json",
        ...overrides.headers,
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    },
  );
}

let browserReporterLoad = 0;

async function loadGeneratedBrowserReporter(files) {
  const source = indexFiles(files).get(
    "apps/web/src/infrastructure/observability/browser-reporter.ts",
  );
  assert.notEqual(source, undefined);
  const typescriptModule = await import("typescript");
  const typescript = typescriptModule.default ?? typescriptModule;
  const transpiled = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.ESNext,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText;
  browserReporterLoad += 1;
  const withRoot = transpiled.replace(
    'from "@egeria-systems/observability"',
    `from ${JSON.stringify(new URL("../../observability/dist/index.js", import.meta.url).href)}`,
  );
  const withTarget = withRoot.includes('from "../../configuration/application-environment"')
    ? withRoot.replace('from "../../configuration/application-environment"', `from ${JSON.stringify(await generatedApplicationEnvironmentModule(files))}`)
    : withRoot;
  const executable = withTarget.replace(
    'from "@egeria-systems/observability/browser"',
    `from ${JSON.stringify(new URL("../../observability/dist/browser.js", import.meta.url).href)}`,
  );
  assert.notEqual(withRoot, transpiled);
  assert.notEqual(executable, withRoot);

  return {
    module: await import(
      `data:text/javascript;base64,${Buffer.from(executable).toString("base64")}#browser-reporter-${browserReporterLoad}`
    ),
  };
}

let browserInstrumentationLoad = 0;

async function loadGeneratedBrowserInstrumentation(files) {
  const source = indexFiles(files).get("apps/web/instrumentation-client.ts");
  assert.notEqual(source, undefined);
  const typescriptModule = await import("typescript");
  const typescript = typescriptModule.default ?? typescriptModule;
  const transpiled = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.ESNext,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText;
  browserInstrumentationLoad += 1;
  const callKey = `__browserInstrumentationCalls${browserInstrumentationLoad}`;
  globalThis[callKey] = [];
  const reporterModule = `data:text/javascript;base64,${Buffer.from(
    `export function reportBrowserError(error, source) { globalThis[${JSON.stringify(callKey)}].push({ error, source }); }`,
  ).toString("base64")}`;
  const executable = transpiled.replace(
    'from "./src/infrastructure/observability/browser-reporter"',
    `from ${JSON.stringify(reporterModule)}`,
  );
  assert.notEqual(executable, transpiled);

  const listeners = new Map();
  const previousAddEventListener = globalThis.addEventListener;
  globalThis.addEventListener = (type, listener) => {
    listeners.set(type, listener);
  };
  try {
    await import(
      `data:text/javascript;base64,${Buffer.from(executable).toString("base64")}#browser-instrumentation-${browserInstrumentationLoad}`
    );
  } finally {
    if (previousAddEventListener === undefined) {
      delete globalThis.addEventListener;
    } else {
      globalThis.addEventListener = previousAddEventListener;
    }
  }

  return { listeners, calls: globalThis[callKey] };
}

async function readCommonWebTemplate(path) {
  return readFile(
    new URL(`../templates/common/apps/web/${path}`, import.meta.url),
    "utf8",
  );
}

async function readSiteWebTemplate(path) {
  return readFile(
    new URL(`../templates/site/apps/web/${path}`, import.meta.url),
    "utf8",
  );
}

async function loadErrorCopyModule(files) {
  const [source, copySource] = await Promise.all([
    readCommonWebTemplate("src/infrastructure/observability/error-copy.ts"),
    readCommonWebTemplate("content/en-CA/observability.yaml"),
  ]);
  const typescriptModule = await import("typescript");
  const typescript = typescriptModule.default ?? typescriptModule;
  const transpiled = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.ESNext,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText;
  const contentModule = await compileGeneratedContentModule(files);
  const withCopy = transpiled.replace(
    'import observabilityCopySource from "../../../content/en-CA/observability.yaml";',
    `const observabilityCopySource = ${JSON.stringify(copySource)};`,
  );
  const executable = withCopy.replace(
    'from "../../content/content-schema"',
    `from ${JSON.stringify(contentModule.moduleUrl)}`,
  );
  assert.notEqual(withCopy, transpiled);
  assert.notEqual(executable, withCopy);
  return import(
    `data:text/javascript;base64,${Buffer.from(executable).toString("base64")}`
  );
}

function createTestJsxRuntimeUrl() {
  return `data:text/javascript;base64,${Buffer.from(
    [
      "export const Fragment = Symbol.for('react.fragment');",
      "export function jsx(type, props, key) { return { type, props: props ?? {}, key: key ?? null }; }",
      "export const jsxs = jsx;",
    ].join("\n"),
  ).toString("base64")}`;
}

async function loadErrorFallbackModule() {
  const source = await readCommonWebTemplate(
    "src/presentation/error-fallback.tsx",
  );
  const typescriptModule = await import("typescript");
  const typescript = typescriptModule.default ?? typescriptModule;
  const transpiled = typescript.transpileModule(source, {
    compilerOptions: {
      jsx: typescript.JsxEmit.ReactJSX,
      module: typescript.ModuleKind.ESNext,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText;
  const executable = transpiled.replace(
    'from "react/jsx-runtime"',
    `from ${JSON.stringify(createTestJsxRuntimeUrl())}`,
  );
  assert.notEqual(executable, transpiled);
  return import(
    `data:text/javascript;base64,${Buffer.from(executable).toString("base64")}`
  );
}

let errorBoundaryLoad = 0;

async function loadErrorBoundaryModule(path, readTemplate = readCommonWebTemplate) {
  const source = await readTemplate(path);
  const typescriptModule = await import("typescript");
  const typescript = typescriptModule.default ?? typescriptModule;
  const transpiled = typescript.transpileModule(source, {
    compilerOptions: {
      jsx: typescript.JsxEmit.ReactJSX,
      module: typescript.ModuleKind.ESNext,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText;
  errorBoundaryLoad += 1;
  const reportKey = `__errorBoundaryReports${errorBoundaryLoad}`;
  globalThis[reportKey] = [];
  const reactModule = `data:text/javascript;base64,${Buffer.from(
    "export function useEffect(effect) { effect(); }",
  ).toString("base64")}`;
  const copyModule = `data:text/javascript;base64,${Buffer.from(
    'export function readErrorFallbackCopy() { return Object.freeze({ heading: "Something went wrong", summary: "We could not complete this page. Please try again.", retryLabel: "Try again" }); }',
  ).toString("base64")}`;
  const reporterModule = `data:text/javascript;base64,${Buffer.from(
    `export function reportReactBoundaryError(error, context) { globalThis[${JSON.stringify(reportKey)}].push({ error, context }); }`,
  ).toString("base64")}`;
  const fallbackModule = `data:text/javascript;base64,${Buffer.from(
    "export function ErrorFallback(props) { return { type: 'error-fallback', props, key: null }; }",
  ).toString("base64")}`;
  const executable = transpiled
    .replace('from "react"', `from ${JSON.stringify(reactModule)}`)
    .replace(
      /from "\.\.\/(?:\.\.\/)?src\/infrastructure\/observability\/error-copy"/u,
      `from ${JSON.stringify(copyModule)}`,
    )
    .replace(
      /from "\.\.\/(?:\.\.\/)?src\/infrastructure\/observability\/browser-reporter"/u,
      `from ${JSON.stringify(reporterModule)}`,
    )
    .replace(
      /from "\.\.\/(?:\.\.\/)?src\/presentation\/error-fallback"/u,
      `from ${JSON.stringify(fallbackModule)}`,
    )
    .replace(
      'from "react/jsx-runtime"',
      `from ${JSON.stringify(createTestJsxRuntimeUrl())}`,
    );
  assert.notEqual(executable, transpiled);
  return {
    module: await import(
      `data:text/javascript;base64,${Buffer.from(executable).toString("base64")}#error-boundary-${errorBoundaryLoad}`
    ),
    reports: globalThis[reportKey],
  };
}

let serverReporterLoad = 0;

async function loadGeneratedServerReporter(
  files,
  {
    ingestingHost = "s123.eu-nbg-2.betterstackdata.com",
    rejectErrorDispatch = false,
    runtimeContextModule,
    scheduleShouldThrow = false,
    sourceToken = "source-token-123456",
  } = {},
) {
  const source = indexFiles(files).get(
    "apps/web/src/infrastructure/observability/server-reporter.ts",
  );
  assert.notEqual(source, undefined);
  const typescriptModule = await import("typescript");
  const typescript = typescriptModule.default ?? typescriptModule;
  const transpiled = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.ESNext,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText;
  serverReporterLoad += 1;
  const scheduleKey = `__serverReporterScheduled${serverReporterLoad}`;
  globalThis[scheduleKey] = [];
  const rootModule = new URL(
    "../../observability/dist/index.js",
    import.meta.url,
  ).href;
  const reporterRootModule = rejectErrorDispatch
    ? `data:text/javascript;base64,${Buffer.from(
        [
          `import { createOperationalErrorReport, createOperationalEvent, dispatchOperationalEvent, normalizeErrorCategory, reconstructOperationalErrorReport } from ${JSON.stringify(rootModule)};`,
          "export { createOperationalErrorReport, createOperationalEvent, dispatchOperationalEvent, normalizeErrorCategory, reconstructOperationalErrorReport };",
          'export async function dispatchOperationalErrorReport() { throw new Error("synthetic dispatch rejection"); }',
        ].join("\n"),
      ).toString("base64")}`
    : rootModule;
  const serverModule = new URL(
    "../../observability/dist/server.js",
    import.meta.url,
  ).href;
  const contextModule = runtimeContextModule ?? `data:text/javascript;base64,${Buffer.from(
    [
      "export async function readObservabilityRuntimeContext() {",
      `return { ingestingHost: ${JSON.stringify(ingestingHost)}, sourceToken: ${JSON.stringify(sourceToken)}, releaseId: "release-123", schedule(delivery) { globalThis[${JSON.stringify(scheduleKey)}].push(delivery); ${scheduleShouldThrow ? 'throw new Error("context failed");' : ""} } };`,
      "}",
    ].join("\n"),
  ).toString("base64")}`;
  const withRoot = transpiled.replace(
    'from "@egeria-systems/observability"',
    `from ${JSON.stringify(reporterRootModule)}`,
  );
  const withServer = withRoot.replace(
    'from "@egeria-systems/observability/server"',
    `from ${JSON.stringify(serverModule)}`,
  );
  const executable = withServer.replace(
    'from "../cloudflare/observability-context"',
    `from ${JSON.stringify(contextModule)}`,
  );
  assert.notEqual(withRoot, transpiled);
  assert.notEqual(withServer, withRoot);
  assert.notEqual(executable, withServer);

  return {
    module: await import(
      `data:text/javascript;base64,${Buffer.from(executable).toString("base64")}#reporter-${serverReporterLoad}`
    ),
    scheduled: globalThis[scheduleKey],
  };
}

let instrumentationLoad = 0;

async function loadGeneratedInstrumentation(files) {
  const source = indexFiles(files).get("apps/web/instrumentation.ts");
  assert.notEqual(source, undefined);
  const typescriptModule = await import("typescript");
  const typescript = typescriptModule.default ?? typescriptModule;
  const transpiled = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.ESNext,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText;
  instrumentationLoad += 1;
  const callKey = `__serverInstrumentationCalls${instrumentationLoad}`;
  globalThis[callKey] = [];
  const reporterModule = `data:text/javascript;base64,${Buffer.from(
    `export async function reportServerError(error, context) { globalThis[${JSON.stringify(callKey)}].push({ error, context }); await new Promise((resolve) => setImmediate(resolve)); }`,
  ).toString("base64")}`;
  const executable = transpiled.replace(
    'from "./src/infrastructure/observability/server-reporter"',
    `from ${JSON.stringify(reporterModule)}`,
  );
  assert.notEqual(executable, transpiled);

  return {
    module: await import(
      `data:text/javascript;base64,${Buffer.from(executable).toString("base64")}#instrumentation-${instrumentationLoad}`
    ),
    calls: globalThis[callKey],
  };
}

function assertContentInvalid(operation) {
  assert.throws(operation, {
    name: "TypeError",
    message: "CONTENT_INVALID",
  });
}

function describeTestElement(element) {
  if (typeof element === "string") {
    return element;
  }

  const { children, ...attributes } = element.props;
  delete attributes.className;
  const normalizedChildren =
    children === undefined ? [] : Array.isArray(children) ? children : [children];

  return {
    type: element.type,
    key: element.key,
    attributes,
    children: normalizedChildren.map(describeTestElement),
  };
}

async function snapshotDirectory(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const snapshot = [];

  for (const entry of entries.sort((left, right) =>
    left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
  )) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      snapshot.push(...(await snapshotDirectory(path)));
    } else {
      snapshot.push([path, [...(await readFile(path))]]);
    }
  }

  return snapshot;
}

test("template rendering replaces only the approved dynamic and workflow tokens", () => {
  const result = renderTemplateSource({
    source: "common/package.json.template",
    text: [
      "{",
      '  \"name\": \"{{projectName}}\",',
      '  \"displayName\": {{displayNameJson}},',
      '  \"worker\": \"{{workerName}}\",',
      '  \"group\": \"{{githubWorkflowExpression}}-{{githubRefExpression}}\"',
      "}",
      "",
    ].join("\r\n"),
    tokens,
  });

  const rendered = assertSuccess(result);
  assert.equal(
    rendered,
    '{\n  "name": "acme-studio",\n  "displayName": "Acme \\"Studio\\"\\nMontréal",\n  "worker": "acme-studio-web",\n  "group": "${{ github.workflow }}-${{ github.ref }}"\n}\n',
  );
  assert.deepEqual(JSON.parse(rendered), {
    name: "acme-studio",
    displayName: 'Acme "Studio"\nMontréal',
    worker: "acme-studio-web",
    group: "${{ github.workflow }}-${{ github.ref }}",
  });
});

test("Calendly settings tokens are JSON data scoped to the managed settings template", () => {
  const settingsTokens = {
    ...tokens,
    calendlyDestinationJson: JSON.stringify(
      'https://calendly.com/acme/intro?theme="contrast',
    ),
    calendlyModeJson: JSON.stringify("popup"),
  };
  const settingsSource =
    "booking-calendly/apps/web/src/integrations/booking-calendly/booking-settings.ts.template";
  const rendered = assertSuccess(
    renderTemplateSource({
      source: settingsSource,
      text: [
        "export const settings = {",
        "  destination: {{calendlyDestinationJson}},",
        "  mode: {{calendlyModeJson}},",
        "};",
      ].join("\n"),
      tokens: settingsTokens,
    }),
  );

  assert.equal(
    rendered,
    'export const settings = {\n  destination: "https://calendly.com/acme/intro?theme=\\"contrast",\n  mode: "popup",\n};\n',
  );
  const unavailable = renderTemplateSource({
    source: "common/README.md.template",
    text: "{{calendlyDestinationJson}}",
    tokens: settingsTokens,
  });
  assertFailure(unavailable, "TEMPLATE_TOKEN_INVALID", "calendlyDestinationJson");
  assertFailureReason(unavailable, "unavailable-token");

  const recursive = renderTemplateSource({
    source: settingsSource,
    text: "{{calendlyDestinationJson}}",
    tokens: {
      ...settingsTokens,
      calendlyDestinationJson: '"{{projectName}}"',
    },
  });
  assertFailure(recursive, "TEMPLATE_TOKEN_INVALID", "projectName");
  assertFailureReason(recursive, "recursive-token");
});

test("analytics settings are one JSON token scoped to the managed settings template", () => {
  const settingsSource =
    "analytics/apps/web/src/integrations/analytics/analytics-settings.ts.template";
  const settingsTokens = {
    ...tokens,
    analyticsSettingsJson: JSON.stringify(analyticsSettings, null, 2),
  };
  const rendered = assertSuccess(
    renderTemplateSource({
      source: settingsSource,
      text: "export const settings = {{analyticsSettingsJson}} as const;",
      tokens: settingsTokens,
    }),
  );

  assert.match(rendered, /"googleAnalytics4": true/u);
  const unavailable = renderTemplateSource({
    source: "common/README.md.template",
    text: "{{analyticsSettingsJson}}",
    tokens: settingsTokens,
  });
  assertFailure(unavailable, "TEMPLATE_TOKEN_INVALID", "analyticsSettingsJson");
  assertFailureReason(unavailable, "unavailable-token");
});

test("rendering normalizes newlines and leaves static sources otherwise unchanged", () => {
  assert.equal(
    assertSuccess(
      renderTemplateSource({
        source: "common/apps/web/tsconfig.json",
        text: "first\rsecond\r\nthird\n\n",
        tokens,
      }),
    ),
    "first\nsecond\nthird\n",
  );
});

test("template rendering rejects unknown, malformed, unresolved, and introduced tokens", () => {
  const cases = [
    ["{{privateValue}}", "privateValue", "unknown-token"],
    ["{{projectName}", "projectName", "malformed-token"],
    ["{{ projectName }}", " projectName ", "malformed-token"],
  ];

  for (const [text, rejectedValue, reason] of cases) {
    const result = renderTemplateSource({
      source: "common/README.md.template",
      text,
      tokens,
    });
    assertFailure(result, "TEMPLATE_TOKEN_INVALID", rejectedValue);
    assertFailureReason(result, reason);
  }

  const recursiveResult = renderTemplateSource({
    source: "common/README.md.template",
    text: "{{projectName}}",
    tokens: { ...tokens, projectName: "{{stillUnknown}}" },
  });
  assertFailure(recursiveResult, "TEMPLATE_TOKEN_INVALID", "stillUnknown");
  assertFailureReason(recursiveResult, "recursive-token");

  assertFailure(
    renderTemplateSource({
      source: "common/apps/web/tsconfig.json",
      text: "{{projectName}}",
      tokens,
    }),
    "TEMPLATE_TOKEN_INVALID",
    "projectName",
  );
});

test("template destinations are safe and strip the template suffix exactly once", () => {
  assert.equal(
    assertSuccess(
      deriveTemplateDestination("common/apps/web/package.json.template"),
    ),
    "apps/web/package.json",
  );
  assert.equal(
    assertSuccess(
      deriveTemplateDestination("common/example.template.template"),
    ),
    "example.template",
  );
  assert.equal(
    assertSuccess(deriveTemplateDestination("site/apps/web/app/work/page.tsx")),
    "apps/web/app/work/page.tsx",
  );

  for (const source of [
    "outside/file.template",
    "common/../secret.template",
    "common/apps\\web\\file.template",
    "common/.template",
    "/common/file.template",
  ]) {
    assertFailure(
      deriveTemplateDestination(source),
      "TEMPLATE_SOURCE_INVALID",
      source,
    );
  }
});

test("template catalogs declare text and exact visual baseline binary sources", () => {
  for (const profile of ["portfolio", "site"]) {
    const entries = assertSuccess(createTemplateCatalog(profile));
    const binaryDestinations = entries
      .filter(({ contentKind }) => contentKind === "binary")
      .map(({ destination }) => destination);

    assert.equal(entries.length > 0, true);
    assert.equal(
      entries.every(({ contentKind }) =>
        ["text", "binary"].includes(contentKind),
      ),
      true,
    );
    assert.deepEqual(binaryDestinations, visualBaselinePaths);
  }
});

test("binary template entries preserve invalid UTF-8 and token-like bytes exactly", async () => {
  const owner = await mkdtemp(join(tmpdir(), "egeria-binary-template-"));
  const source = "baseline.png";
  const sourcePath = join(owner, source);
  const bytes = Uint8Array.from([
    0xff, 0xfe, 0x7b, 0x7b, 0x70, 0x72, 0x6f, 0x6a, 0x65, 0x63, 0x74, 0x4e,
    0x61, 0x6d, 0x65, 0x7d, 0x7d, 0x00,
  ]);

  try {
    await writeFile(sourcePath, bytes);
    const module = await import("../dist/generation/render-skeleton.js");
    assert.equal(typeof module.renderTemplateCatalogEntry, "function");

    const rendered = assertSuccess(
      await module.renderTemplateCatalogEntry(
        {
          source,
          destination:
            "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
          contentKind: "binary",
        },
        0,
        pathToFileURL(`${owner}/`),
        tokens,
      ),
    );

    assert.deepEqual([...rendered.content], [...bytes]);
    assert.notEqual(rendered.content.at(-1), 0x0a);
    rendered.content[0] = 0;
    assert.deepEqual([...(await readFile(sourcePath))], [...bytes]);
  } finally {
    await rm(owner, { recursive: true, force: true });
  }
});

test("portfolio and site render exact sorted deterministic file sets", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const request = {
    profile: "portfolio",
    projectName: "acme-studio",
    displayName: "Acme Studio",
    packageVersions,
  };
  const first = assertSuccess(await renderSkeleton(request));
  const second = assertSuccess(await renderSkeleton(request));
  const site = assertSuccess(
    await renderSkeleton({ ...request, profile: "site" }),
  );

  assert.deepEqual(first.files.map(({ path }) => path), portfolioPaths);
  assert.deepEqual(site.files.map(({ path }) => path), sitePaths);
  assert.deepEqual(snapshotBytes(first.files), snapshotBytes(second.files));

  for (const rendered of [first, site]) {
    const catalog = assertSuccess(createTemplateCatalog(rendered.project.originProfile));
    const contentKinds = new Map(
      catalog.map(({ destination, contentKind }) => [destination, contentKind]),
    );

    for (const { path, content } of rendered.files) {
      assert.equal(path.startsWith("/"), false);
      assert.equal(path.includes(".."), false);
      assert.equal(path.includes("\\"), false);
      assert.doesNotMatch(path, /[\u0000-\u001f\u007f]/);

      if (contentKinds.get(path) === "text") {
        const text = decoder.decode(content);
        assert.equal(text.includes("\r"), false);
        assert.equal(text.endsWith("\n"), true);
        assert.equal(text.endsWith("\n\n"), false);
      }
    }
  }
});

test("multilingual selection renders deterministic locale-prefixed portfolio and site contracts", async () => {
  const renderSkeleton = await loadRenderSkeleton();

  for (const profile of ["portfolio", "site"]) {
    const request = {
      profile,
      projectName: `acme-${profile}`,
      displayName: `Acme ${profile}`,
      multilingual: true,
      packageVersions,
    };
    const first = assertSuccess(await renderSkeleton(request));
    const second = assertSuccess(await renderSkeleton(request));
    const files = indexFiles(first.files);
    const baselinePaths = profile === "portfolio" ? portfolioPaths : sitePaths;

    assert.deepEqual(
      first.files.map(({ path }) => path),
      [
        ...baselinePaths,
        ...multilingualPaths,
      ].toSorted(),
    );
    assert.deepEqual(snapshotBytes(first.files), snapshotBytes(second.files));
    assert.equal(first.project.selectedCapabilities.includes("multilingual"), true);
    assert.equal(first.surfaces.find(({ path }) => path === "docs/multilingual.md")?.ownership, "application-owned");
    const baseline = assertSuccess(await renderSkeleton({ ...request, multilingual: undefined }));
    assert.equal(baseline.files.some(({ path }) => path === "docs/multilingual.md"), false);
    assert.deepEqual(first.project.capabilitySettings, {});
    assert.match(files.get("apps/web/middleware.ts"), /accept-language/iu);
    assert.match(files.get("apps/web/middleware.ts"), /x-egeria-locale/u);
    assert.match(files.get("apps/web/app/[locale]/layout.tsx"), /generateStaticParams/u);
    assert.match(files.get("apps/web/app/[locale]/layout.tsx"), /alternates/u);
    assert.match(
      files.get("apps/web/app/[locale]/[[...segments]]/page.tsx"),
      /generateMetadata/u,
    );
    assert.match(files.get("apps/web/src/i18n/localized-content.ts"), /CONTENT_INVALID/u);
    assert.match(files.get("apps/web/src/i18n/localized-content.ts"), /parity/iu);
    assert.match(files.get("apps/web/app/error.tsx"), /readLocalizedCatalog/u);
    assert.match(
      files.get("apps/web/tests/visual/home-visual.spec.ts"),
      /outside the established generated visual matrix/u,
    );
    assert.doesNotMatch(
      files.get("apps/web/src/i18n/localized-content.ts"),
      /Accueil|Passer au contenu|Travaux en vedette/u,
    );
    const englishCatalog = parseGeneratedYaml(
      first.files,
      "apps/web/content/en-CA/localized-content.yaml",
    );
    const frenchCatalog = parseGeneratedYaml(
      first.files,
      "apps/web/content/fr-CA/localized-content.yaml",
    );
    assert.equal(frenchCatalog.navigation[0].href, "/fr-CA");
    assert.match(frenchCatalog.localeSwitch.label, /\S/u);
    assert.notEqual(
      frenchCatalog.localeSwitch.label,
      englishCatalog.localeSwitch.label,
    );
    assert.match(frenchCatalog.error.retryLabel, /\S/u);
    assert.notEqual(
      frenchCatalog.error.retryLabel,
      englishCatalog.error.retryLabel,
    );
    if (profile === "site") {
      assert.match(
        files.get("apps/web/tests/e2e/site-routing.spec.ts"),
        /\/fr-CA\/about/u,
      );
    }
  }
});

test("multilingual and Calendly compose without changing either capability setting", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const bookingCalendly = {
    mode: "popup",
  };
  const rendered = assertSuccess(
    await renderSkeleton({
      profile: "site",
      projectName: "acme-site",
      displayName: "Acme Site",
      multilingual: true,
      bookingCalendly,
      packageVersions,
    }),
  );
  const files = indexFiles(rendered.files);

  assert.equal(rendered.project.selectedCapabilities.includes("multilingual"), true);
  assert.equal(
    rendered.project.selectedCapabilities.includes("booking-calendly"),
    true,
  );
  assert.deepEqual(rendered.project.capabilitySettings, {
    "booking-calendly": bookingCalendly,
  });
  assert.match(
    files.get("apps/web/src/integrations/booking/localized-booking.tsx"),
    /CalendlyBooking/u,
  );
  const englishCatalog = parseGeneratedYaml(
    rendered.files,
    "apps/web/content/en-CA/localized-content.yaml",
  );
  const frenchCatalog = parseGeneratedYaml(
    rendered.files,
    "apps/web/content/fr-CA/localized-content.yaml",
  );
  assert.match(frenchCatalog.booking.linkLabel, /\S/u);
  assert.notEqual(
    frenchCatalog.booking.linkLabel,
    englishCatalog.booking.linkLabel,
  );
});

test("analytics renders deterministic provider-neutral contracts and composes with multilingual", async () => {
  const renderSkeleton = await loadRenderSkeleton();

  for (const profile of ["portfolio", "site"]) {
    for (const multilingual of [false, true]) {
      const first = assertSuccess(
        await renderSkeleton({
          profile,
          projectName: `acme-${profile}`,
          displayName: `Acme ${profile}`,
          analytics: analyticsSettings,
          ...(multilingual ? { multilingual: true } : {}),
          packageVersions,
        }),
      );
      const second = assertSuccess(
        await renderSkeleton({
          profile,
          projectName: `acme-${profile}`,
          displayName: `Acme ${profile}`,
          analytics: analyticsSettings,
          ...(multilingual ? { multilingual: true } : {}),
          packageVersions,
        }),
      );
      const files = indexFiles(first.files);
      const expectedPaths = [
        ...(profile === "site" ? sitePaths : portfolioPaths),
        ...analyticsPaths,
        ...(multilingual ? multilingualPaths : []),
      ].toSorted();

      assert.deepEqual(first.files.map(({ path }) => path), expectedPaths);
      assert.deepEqual(snapshotBytes(first.files), snapshotBytes(second.files));
      assert.equal(
        first.project.selectedCapabilities.includes("analytics"),
        true,
      );
      assert.deepEqual(
        first.project.capabilitySettings.analytics,
        analyticsSettings,
      );
      assert.match(
        files.get("apps/web/src/integrations/analytics/analytics-settings.ts"),
        /"googleAnalytics4": true/u,
      );
      const analyticsProviderContract = files.get(
        "apps/web/src/integrations/analytics/analytics-provider-contract.ts",
      );
      assert.match(
        analyticsProviderContract,
        /aggregate-traffic-and-performance|audience-measurement|consented-experience-analysis/u,
      );
      assert.match(analyticsProviderContract, /imageSources/u);
      assert.match(
        analyticsProviderContract,
        /https:\/\/\*\.google-analytics\.com/u,
      );
      assert.match(
        analyticsProviderContract,
        /https:\/\/\*\.analytics\.google\.com/u,
      );
      assert.match(
        analyticsProviderContract,
        /session-statistics/u,
      );
      assert.match(
        analyticsProviderContract,
        /approximate-geolocation/u,
      );
      assert.match(
        analyticsProviderContract,
        /pseudonymous-client-and-session-identifiers/u,
      );
      assert.match(
        analyticsProviderContract,
        /session-replay-dom-mutations-content-and-layout/u,
      );
      assert.match(
        analyticsProviderContract,
        /diagnostics-and-performance/u,
      );
      assert.match(
        analyticsProviderContract,
        /page-metadata-and-dimensions/u,
      );
      assert.match(
        analyticsProviderContract,
        /pseudonymous-envelope-user-and-session-identifiers/u,
      );
      assert.doesNotMatch(
        analyticsProviderContract,
        /doubleclick\.net|googleadservices\.com|googlesyndication\.com|https:\/\/\*\.google\.com/u,
      );
      assert.match(
        files.get("apps/web/src/integrations/analytics/analytics-runtime.ts"),
        /explicit-opt-in|analytics_Storage|analytics_storage/u,
      );
      const analyticsGuide = files.get("docs/analytics.md");
      assert.match(
        analyticsGuide,
        /Enable with JS Snippet installation/u,
      );
      assert.match(
        analyticsGuide,
        /automatic setup\/Pages injection/iu,
      );
      assert.match(
        analyticsGuide,
        /Disable.*not.*replacement/iu,
      );
      assert.match(
        analyticsGuide,
        /separate manual Web Analytics site for nonproduction and production/iu,
      );
      assert.match(
        analyticsGuide,
        /Review masking, retention, audience eligibility/iu,
      );
      assert.match(
        analyticsGuide,
        /structural.*layout.*unmasked content.*leave the browser/iu,
      );
      assert.match(
        analyticsGuide,
        /Masking is provider controlled/iu,
      );
      assert.match(files.get("apps/web/app/layout.tsx"), /AnalyticsConsent/u);
      assert.match(files.get("apps/web/app/layout.tsx"), /verification/u);
      assert.equal(
        parseGeneratedYaml(first.files, "apps/web/content/en-CA/analytics.yaml")
          .allowAllLabel,
        "Allow all",
      );
      assert.match(
        parseGeneratedYaml(first.files, "apps/web/content/fr-CA/analytics.yaml")
          .allowAllLabel,
        /\S/u,
      );

      for (const path of analyticsPaths) {
        assert.doesNotMatch(files.get(path), /observability/iu, path);
      }

      if (multilingual) {
        assert.match(files.get("apps/web/app/layout.tsx"), /x-egeria-locale/u);
        assert.match(
          files.get("apps/web/app/layout.tsx"),
          /readAnalyticsContent\(locale\)/u,
        );
      } else {
        assert.match(
          files.get("apps/web/app/layout.tsx"),
          /readAnalyticsContent\("en-CA"\)/u,
        );
      }
    }
  }
});

test("current rendering refuses retired recipe contexts", async () => {
  const core = await import("../dist/index.js");
  for (const profile of ["portfolio", "site", "app"]) {
    const request = { profile, projectName: "current-recipe", displayName: "Current Recipe", packageVersions: core.verifiedCapabilityPackageVersions };
    for (const recipeVersion of ["0.10.0", "0.11.1", "0.12.2", "0.2.2"]) {
      const context = core.createGenerationRenderingContext();
      const profiles = context.profiles.map(recipe => recipe.identifier === profile ? { ...recipe, recipeVersion } : recipe);
      const refused = await core.renderSkeleton(request, { ...context, profiles });
      assert.equal(refused.ok, false);
      assert.equal(Object.hasOwn(refused, "value"), false);
    }
  }
});

test("production site rendering materializes route metadata and browser contracts without changing portfolio", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const site = assertSuccess(
    await renderSkeleton({
      profile: "site",
      projectName: "acme-site",
      displayName: "Acme Site",
      packageVersions,
    }),
  );
  const portfolio = assertSuccess(
    await renderSkeleton({
      profile: "portfolio",
      projectName: "acme-portfolio",
      displayName: "Acme Portfolio",
      packageVersions,
    }),
  );
  const siteFiles = indexFiles(site.files);
  const portfolioFiles = indexFiles(portfolio.files);

  assert.match(siteFiles.get("apps/web/app/sitemap.ts"), /MetadataRoute\.Sitemap/u);
  assert.match(siteFiles.get("apps/web/app/robots.ts"), /MetadataRoute\.Robots/u);
  assert.match(
    siteFiles.get("apps/web/app/not-found.tsx"),
    /export const metadata: Metadata = notFoundContent\.metadata;/u,
  );
  assert.match(
    siteFiles.get("apps/web/app/work/page.tsx"),
    /permanentRedirect\("\/work\/featured"\)/u,
  );
  assert.match(
    siteFiles.get("apps/web/src/routing/site-page.tsx"),
    /aria-current/u,
  );
  assert.match(
    siteFiles.get("apps/web/tests/e2e/site-routing.spec.ts"),
    /\/work\/featured/u,
  );
  assert.equal(portfolioFiles.has("apps/web/app/sitemap.ts"), false);
  assert.equal(portfolioFiles.has("apps/web/src/routing/site-page.tsx"), false);
});

test("generated observability guidance preserves restricted diagnostic boundaries", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const rendered = assertSuccess(
    await renderSkeleton({
      profile: "portfolio",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      packageVersions,
    }),
  );
  const files = indexFiles(rendered.files);
  const readme = files.get("README.md");
  const instructions = files.get("apps/web/AGENTS.md");

  for (const document of [readme, instructions]) {
    assert.match(
      document,
      /safe operational events[\s\S]+restricted error reports/iu,
    );
    assert.match(document, /server route[\s\S]+revalidat[\s\S]+re-sanitiz/iu);
    assert.match(document, /not a privacy guarantee/iu);
    assert.match(document, /not source-map deobfuscated/iu);
    assert.match(
      document,
      /Workers(?: Logs)? custom records[\s\S]+only[\s\S]+safe[\s\S]+only[\s\S]+Better Stack diagnostic adapter[\s\S]+restricted/iu,
    );
  }

  assert.doesNotMatch(readme, /never receives raw error messages, stacks/iu);
});

test("rendered manifests and desired project match the approved resolved recipe", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const portfolio = assertSuccess(
    await renderSkeleton({
      profile: "portfolio",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      packageVersions,
    }),
  );

  assert.deepEqual(portfolio.project, {
    schemaVersion: "2.0.0",
    builderCompatibility: "0.0.0",
    project: {
      name: "acme-studio",
      displayName: "Acme Studio",
      defaultLocale: "en-CA",
    },
    originProfile: "portfolio",
    recipeVersion: "0.12.0",
    platformAdapter: "cloudflare-workers",
    selectedCapabilities: [
      "standards",
      "content-files",
      "section-composition",
      "deployment-cloudflare",
      "observability",
    ],
    capabilitySettings: {},
    ejectedAreas: [],
  });
  assert.deepEqual(
    portfolio.resolved.capabilities.map(({ identifier }) => identifier),
    portfolio.project.selectedCapabilities,
  );

  const rootManifest = parseGeneratedJson(portfolio.files, "package.json");

  assert.deepEqual(rootManifest, {
    name: "acme-studio",
    version: "0.0.0",
    private: true,
    scripts: {
      build: "pnpm --dir apps/web run build",
      "build:cloudflare": "pnpm --dir apps/web run build:cloudflare",
      dev: "pnpm --dir apps/web run dev",
      lint: "pnpm --dir apps/web run lint",
      test: "pnpm --dir apps/web run test",
      "test:component": "pnpm --dir apps/web run test:component",
      "test:component:watch": "pnpm --dir apps/web run test:component:watch",
      "test:unit": "pnpm --dir apps/web run test:unit",
      "test:unit:watch": "pnpm --dir apps/web run test:unit:watch",
      "test:watch": "pnpm --dir apps/web run test:watch",
      typecheck: "pnpm --dir apps/web run typecheck",
      verify:
        "pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run build && pnpm --dir apps/web exec opennextjs-cloudflare build --skipNextBuild",
    },
    engines: { node: "22.23.2", pnpm: "11.28.1" },
    packageManager: "pnpm@11.28.1",
    volta: { node: "22.23.2" },
  });
  assert.equal(
    indexFiles(portfolio.files).get(".nvmrc"),
    `${rootManifest.volta.node}\n`,
  );
  assert.deepEqual(parseGeneratedJson(portfolio.files, "apps/web/package.json"), {
    name: "acme-studio-web",
    version: "0.0.0",
    private: true,
    type: "module",
    scripts: {
      "browser:install": "playwright install chromium",
      "browser:install:ci": "playwright install --with-deps chromium",
      build: "next build",
      "build:cloudflare": "opennextjs-cloudflare build",
      "cf-typegen":
        "wrangler types --env-interface CloudflareEnv --include-runtime=false cloudflare-env.d.ts",
      "check:environment": "node scripts/check-application-environment.mjs --local",
      "check:environment:deployment": "node scripts/check-application-environment.mjs --deployment",
      "check:prepared-artifact": "node --experimental-strip-types scripts/check-prepared-artifact.mjs",
      "test:deployment-contracts": "node --experimental-strip-types --test tests/scripts/prepared-artifact.test.mjs tests/scripts/deployment-protection.test.mjs",
      "test:transport": "playwright test --config playwright.transport.config.ts",
      dev: "next dev",
      lint: "eslint . --max-warnings 0",
      preview:
        "opennextjs-cloudflare build && opennextjs-cloudflare preview",
      test: "vitest run",
      "test:component": "vitest run --project component",
      "test:component:watch": "vitest --project component",
      "test:e2e:deployed":
        "playwright test --config playwright.deployed.config.ts",
      "test:e2e:dev": "playwright test --config playwright.dev.config.ts",
      "test:e2e:preview":
        "playwright test --config playwright.preview.config.ts",
      "test:visual": "playwright test --config playwright.visual.config.ts",
      "test:unit": "vitest run --project unit",
      "test:unit:watch": "vitest --project unit",
      "test:watch": "vitest",
      typecheck: "next typegen && tsc --noEmit",
    },
    dependencies: {
      "@egeria-systems/observability": "0.3.0",
      "@opennextjs/cloudflare": "1.20.12",
      next: "16.4.5",
      react: "19.2.8",
      "react-dom": "19.2.8",
      yaml: "2.9.0",
    },
    devDependencies: {
      "@axe-core/playwright": "4.12.1",
      "@egeria-systems/standards": "0.1.0",
      "@playwright/test": "1.62.1",
      "@tailwindcss/postcss": "4.3.3",
      "@testing-library/dom": "10.4.1",
      "@testing-library/jest-dom": "7.0.1",
      "@testing-library/react": "16.3.2",
      "@testing-library/user-event": "14.6.3",
      "@types/node": "22.20.1",
      "@types/react": "19.2.18",
      "@types/react-dom": "19.2.4",
      "@vitejs/plugin-react": "6.0.5",
      eslint: "9.39.5",
      "eslint-config-next": "16.3.0",
      jsdom: "30.0.1",
      postcss: "8.5.26",
      "raw-loader": "4.0.2",
      tailwindcss: "4.3.3",
      typescript: "6.0.3",
      "typescript-eslint": "8.66.0",
      vitest: "5.0.3",
      wrangler: "4.148.0",
    },
  });
});

test("generated unit and component tests use distinct named environments", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const rendered = assertSuccess(
    await renderSkeleton({
      profile: "portfolio",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      packageVersions,
    }),
  );
  const files = indexFiles(rendered.files);
  const configuration = files.get("apps/web/vitest.config.ts");
  const setup = files.get("apps/web/tests/setup/component.ts");
  const unitTest = files.get("apps/web/tests/unit/content-schema.test.ts");
  const componentTest = files.get(
    "apps/web/tests/component/content-page.test.tsx",
  );
  const webInstructions = files.get("apps/web/AGENTS.md");
  const typescript = parseGeneratedJson(rendered.files, "apps/web/tsconfig.json");

  assert.match(configuration, /name: "unit"[\s\S]+environment: "node"/u);
  assert.match(
    configuration,
    /include: \["tests\/unit\/\*\*\/\*\.test\.ts"\]/u,
  );
  assert.match(configuration, /name: "component"[\s\S]+environment: "jsdom"/u);
  assert.match(
    configuration,
    /include: \["tests\/component\/\*\*\/\*\.test\.tsx"\]/u,
  );
  assert.match(configuration, /setupFiles: \["\.\/tests\/setup\/component\.ts"\]/u);
  assert.match(configuration, /globals: false/u);
  assert.match(configuration, /resolve: \{ tsconfigPaths: true \}/u);
  assert.doesNotMatch(configuration, /workers|cloudflare|miniflare|coverage/iu);
  assert.doesNotMatch(configuration, /vite-tsconfig-paths/u);

  assert.match(setup, /@testing-library\/jest-dom\/matchers/u);
  assert.match(setup, /expect\.extend\(matchers\)/u);
  assert.match(setup, /afterEach\(cleanup\)/u);
  assert.match(unitTest, /parseContentConfiguration/u);
  assert.match(unitTest, /parseYamlContent/u);
  assert.match(unitTest, /CONTENT_INVALID/u);
  assert.doesNotMatch(unitTest, /passWithNoTests|snapshot/iu);
  assert.match(componentTest, /render\(\s*<ContentPage/u);
  assert.match(componentTest, /getByRole\("main"\)/u);
  assert.match(componentTest, /getByRole\("navigation"\)/u);
  assert.match(componentTest, /getByRole\("heading"/u);
  assert.doesNotMatch(componentTest, /snapshot|fireEvent/iu);
  assert.match(webInstructions, /\[workspace guidance\]\(\.\.\/\.\.\/AGENTS\.md\)/u);
  assert.match(webInstructions, /pnpm run test:unit/u);
  assert.match(webInstructions, /pnpm run test:component/u);
  assert.match(webInstructions, /focused failing test[\s\S]+RED[\s\S]+GREEN/u);
  assert.match(webInstructions, /pnpm run verify/u);
  assert.ok(typescript.include.includes("tests/**/*.ts"));
  assert.ok(typescript.include.includes("tests/**/*.tsx"));
});

test("generated workspaces constrain vulnerable transitive dependency ranges", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const rendered = assertSuccess(
    await renderSkeleton({
      profile: "portfolio",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      packageVersions,
    }),
  );

  const workspace = parseGeneratedYaml(
    rendered.files,
    "pnpm-workspace.yaml",
  );

  assert.equal(workspace.minimumReleaseAge, 1440);
  assert.equal(workspace.resolutionMode, "time-based");
  assert.equal(workspace.overrides["vitest@4.1.10"], undefined);
  assert.equal(workspace.overrides["next@>=16.2.0 <16.4.5"], "16.4.5");
  assert.equal(workspace.overrides["vite@>=8.2.0 <8.2.4"], "8.2.4");
  assert.equal(workspace.overrides["sharp@>=0.35.0 <0.35.5"], "0.35.5");
  assert.ok(workspace.minimumReleaseAgeExclude.includes("vite@8.2.4"));

});

test("production observability renders bounded Next and Cloudflare composition", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const rendered = assertSuccess(
    await renderSkeleton({
      profile: "portfolio",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      packageVersions,
    }),
  );
  const files = indexFiles(rendered.files);
  const wrangler = parseGeneratedJson(rendered.files, "apps/web/wrangler.jsonc");
  const workspace = files.get("pnpm-workspace.yaml");

  assert.match(
    workspace,
    /minimumReleaseAgeExclude:[\s\S]*"@egeria-systems\/observability@0\.3\.0"/u,
  );

  assert.deepEqual(wrangler.observability, {
    enabled: true,
    head_sampling_rate: 1,
    logs: {
      invocation_logs: false,
    },
  });
  assert.deepEqual(wrangler.version_metadata, {
    binding: "CF_VERSION_METADATA",
  });
  assert.equal("analytics_engine_datasets" in wrangler, false);

  assert.match(
    files.get("apps/web/instrumentation.ts"),
    /export const onRequestError/u,
  );
  assert.match(
    files.get("apps/web/instrumentation-client.ts"),
    /addEventListener\("error"/u,
  );
  assert.match(
    files.get("apps/web/instrumentation-client.ts"),
    /addEventListener\("unhandledrejection"/u,
  );
  assert.match(
    files.get(
      "apps/web/src/infrastructure/observability/web-vitals-reporter.tsx",
    ),
    /useReportWebVitals/u,
  );
  assert.match(
    files.get("apps/web/app/layout.tsx"),
    /<WebVitalsReporter \/>/u,
  );

  const generatedSources = [...files.entries()]
    .filter(([path]) => !path.includes("/tests/") && (path.endsWith(".ts") || path.endsWith(".tsx")))
    .map(([, source]) => source)
    .join("\n");
  assert.doesNotMatch(
    generatedSources,
    /Cloudflare Web Analytics|sessionStorage|localStorage|document\.cookie|console\.(?:debug|error|warn)\s*=|window\.console/u,
  );
});

test("browser instrumentation passes actual error and rejection values", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const rendered = assertSuccess(
    await renderSkeleton({
      profile: "portfolio",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      packageVersions,
    }),
  );
  const loaded = await loadGeneratedBrowserInstrumentation(rendered.files);
  const error = new Error("browser stack evidence");
  const opaqueErrorEvent = Object.freeze({
    error: undefined,
    message: "opaque cross-origin failure",
    filename: "https://private.example/page?token=credential-secret",
  });
  const rejectionReason = "primitive rejection";

  loaded.listeners.get("error")?.({
    error,
    message: error.message,
    filename: "https://private.example/private.ts?token=credential-secret",
  });
  loaded.listeners.get("error")?.(opaqueErrorEvent);
  loaded.listeners.get("unhandledrejection")?.({ reason: rejectionReason });

  assert.deepEqual(loaded.calls, [
    { error, source: "window-error" },
    { error: opaqueErrorEvent.message, source: "window-error" },
    { error: rejectionReason, source: "unhandled-rejection" },
  ]);
  assert.doesNotMatch(
    JSON.stringify(loaded.calls),
    /private\.example|private\.ts|credential-secret|filename/u,
  );
});

test("browser reporting creates bounded diagnostic envelopes and suppresses duplicate objects", async (testContext) => {
  setEnvironmentInput(testContext, "NEXT_PUBLIC_APPLICATION_ENVIRONMENT", "staging");
  const renderSkeleton = await loadRenderSkeleton();
  const rendered = assertSuccess(
    await renderSkeleton({
      profile: "portfolio",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      packageVersions,
    }),
  );
  const loaded = await loadGeneratedBrowserReporter(rendered.files);
  const requests = [];
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  globalThis.window = { location: { origin: "https://portfolio.example" } };
  setEnvironmentInput(testContext, "NEXT_PUBLIC_SITE_URL", undefined);
  globalThis.fetch = async (input, init) => {
    requests.push({ input, init });
    return { ok: true };
  };
  const duplicate = Object.assign(new Error("same browser failure"), {
    stack: "Error: same browser failure\n    at render (src/app.tsx:12:4)",
  });
  const reactBoundaryError = new Error("react boundary failure");
  const hostile = new Proxy(
    {},
    {
      get() {
        throw new Error("hostile getter private value");
      },
    },
  );

  try {
    loaded.module.reportBrowserError(duplicate, "window-error");
    loaded.module.reportReactBoundaryError(duplicate, { boundary: "page" });
    loaded.module.reportReactBoundaryError(reactBoundaryError, {
      boundary: "global",
    });
    loaded.module.reportReactBoundaryError(new Error("invalid boundary"), {
      boundary: "nested",
    });
    loaded.module.reportBrowserError("primitive rejection", "unhandled-rejection");
    loaded.module.reportBrowserError("primitive rejection", "unhandled-rejection");
    loaded.module.reportCaughtBrowserError(hostile, {
      operation: "refresh-content",
    });
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
  }

  assert.equal(requests.length, 5);
  for (const { input, init } of requests) {
    assert.equal(input, "https://portfolio.example/api/observability");
    assert.equal(init.method, "POST");
    assert.deepEqual(init.headers, { "Content-Type": "application/json" });
    assert.equal(init.credentials, "omit");
    assert.equal(init.referrerPolicy, "no-referrer");
    assert.equal(init.keepalive, true);
    assert.deepEqual(Object.keys(JSON.parse(init.body)).sort(), [
      "report",
      "schemaVersion",
      "type",
    ]);
    assert.equal(JSON.parse(init.body).schemaVersion, "2.0.0");
    assert.equal(JSON.parse(init.body).type, "error-report");
    assert.ok(new TextEncoder().encode(init.body).byteLength <= 8_192);
  }

  const envelopes = requests.map(({ init }) => JSON.parse(init.body));
  assert.equal(new Set(envelopes.map(({ report }) => report.event.context.eventId)).size, 5);
  assert.deepEqual(
    envelopes.map(({ report }) => report.capture),
    [
      { mechanism: "browser-error-event", handled: false },
      { mechanism: "react-error-boundary", handled: true },
      { mechanism: "browser-unhandled-rejection", handled: false },
      { mechanism: "browser-unhandled-rejection", handled: false },
      {
        mechanism: "selected-catch",
        handled: true,
        operation: "refresh-content",
      },
    ],
  );
  assert.match(
    envelopes[0].report.diagnostics.exceptionStacktrace,
    /src\/app\.tsx:12:4/u,
  );
  assert.doesNotMatch(
    JSON.stringify(envelopes),
    /credential|document\.cookie|localStorage|sessionStorage|private\.example|userAgent|referrer|hostile getter private value/u,
  );

  globalThis.fetch = async () => {
    throw new Error("private provider response");
  };
  try {
    await assert.doesNotReject(async () => {
      loaded.module.reportBrowserError(new Error("network failure"), "window-error");
      await new Promise((resolve) => setImmediate(resolve));
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
  }
});

test("browser recovery source set exists before capability admission", async () => {
  const sourcePaths = [
    "app/error.tsx",
    "app/global-error.tsx",
    "content/en-CA/observability.yaml",
    "src/infrastructure/observability/error-copy.ts",
    "src/presentation/error-fallback.tsx",
  ];

  const sources = await Promise.all(
    sourcePaths.map((path) =>
      readFile(
        new URL(`../templates/common/apps/web/${path}`, import.meta.url),
        "utf8",
      ),
    ),
  );

  assert.equal(sources.every((source) => source.trim().length > 0), true);
});

test("browser route reconstructs bounded error reports and retains safe web vitals", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const rendered = assertSuccess(
    await renderSkeleton({
      profile: "portfolio",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      packageVersions,
    }),
  );
  const loaded = await loadGeneratedObservabilityRoute(rendered.files);
  const validErrorEnvelope = await browserErrorEnvelope();
  const validWebVitalEnvelope = await webVitalEnvelope();
  const assertEmptyResponse = async (request, status) => {
    const response = await loaded.module.POST(request);
    assert.equal(response.status, status);
    assert.equal(await response.text(), "");
  };

  await assertEmptyResponse(observabilityRequest(validErrorEnvelope), 202);
  await assertEmptyResponse(observabilityRequest(validWebVitalEnvelope), 202);
  await assertEmptyResponse(
    observabilityRequest(validWebVitalEnvelope, {
      url: "http://127.0.0.1:3100/api/observability",
      headers: {
        host: "portfolio.example:3100",
        origin: "http://portfolio.example:3100",
        "sec-fetch-site": "same-origin",
      },
    }),
    202,
  );

  assert.equal(loaded.reports.length, 1);
  assert.deepEqual(loaded.reports[0], validErrorEnvelope.report);
  assert.deepEqual(loaded.events, [
    {
      name: "browser.web.vital",
      kind: "web.vital",
      severity: "info",
      eventId: "browser-vital-123",
      attributes: validWebVitalEnvelope.event.attributes,
      allowedAttributeNames: [
        "delta",
        "metric_name",
        "navigation_type",
        "rating",
        "value",
      ],
    },
    {
      name: "browser.web.vital",
      kind: "web.vital",
      severity: "info",
      eventId: "browser-vital-123",
      attributes: validWebVitalEnvelope.event.attributes,
      allowedAttributeNames: [
        "delta",
        "metric_name",
        "navigation_type",
        "rating",
        "value",
      ],
    },
  ]);

  const mutate = (operation) => {
    const value = structuredClone(validErrorEnvelope);
    operation(value);
    return value;
  };
  const invalidBodies = [
    "{",
    { ...validErrorEnvelope, extra: true },
    { schemaVersion: "2.0.0", type: "error-report" },
    mutate(({ report }) => {
      report.event.extra = true;
    }),
    mutate(({ report }) => {
      report.capture.mechanism = "unknown-capture";
    }),
    mutate(({ report }) => {
      report.capture.operation = { nested: "private" };
    }),
    mutate(({ report }) => {
      report.diagnostics.exceptionMessage = "x".repeat(2_049);
    }),
    mutate(({ report }) => {
      report.diagnostics.exceptionMessage =
        "Authorization: Bearer credential-secret";
    }),
    {
      ...structuredClone(validWebVitalEnvelope),
      event: {
        ...structuredClone(validWebVitalEnvelope.event),
        context: { eventId: "credential-marker", service: "web" },
      },
    },
  ];
  for (const body of invalidBodies) {
    await assertEmptyResponse(observabilityRequest(body), 400);
  }

  await assertEmptyResponse(
    observabilityRequest(validErrorEnvelope, {
      headers: { origin: "https://cross-origin.example" },
    }),
    403,
  );
  await assertEmptyResponse(
    observabilityRequest(validErrorEnvelope, {
      url: "http://127.0.0.1:3100/api/observability",
      headers: {
        host: "portfolio.example:3100",
        origin: "http://portfolio.example:3100",
      },
    }),
    403,
  );
  await assertEmptyResponse(
    observabilityRequest(validErrorEnvelope, {
      headers: { "content-type": "text/plain" },
    }),
    415,
  );
  await assertEmptyResponse(
    observabilityRequest(validErrorEnvelope, {
      headers: { "content-length": "8193" },
    }),
    413,
  );

  const largeError = new Error("m".repeat(3_000));
  largeError.stack = `Error: ${"s".repeat(20_000)}\n    at render (src/app.tsx:1:1)`;
  const exactEnvelope = await browserErrorEnvelope(largeError);
  const exactBody = JSON.stringify(exactEnvelope);
  assert.equal(new TextEncoder().encode(exactBody).byteLength, 8_192);
  await assertEmptyResponse(observabilityRequest(exactBody), 202);
  await assertEmptyResponse(observabilityRequest(`${exactBody} `), 413);

  let pullCount = 0;
  let cancelled = false;
  const oversizedStream = new ReadableStream(
    {
      pull(controller) {
        pullCount += 1;
        controller.enqueue(new Uint8Array(pullCount === 1 ? 8_192 : 1));
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  await assertEmptyResponse(
    {
      body: oversizedStream,
      headers: new Headers({
        origin: "https://portfolio.example",
        "content-type": "application/json",
      }),
      url: "https://portfolio.example/api/observability",
    },
    413,
  );
  assert.equal(pullCount, 2);
  assert.equal(cancelled, true);
});

test("browser route rejects malformed UTF-8 without dispatching observability", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const rendered = assertSuccess(
    await renderSkeleton({
      profile: "portfolio",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      packageVersions,
    }),
  );
  const loaded = await loadGeneratedObservabilityRoute(rendered.files);
  const validErrorEnvelope = await browserErrorEnvelope();
  const encodedEnvelope = new TextEncoder().encode(
    JSON.stringify(validErrorEnvelope),
  );
  const malformedByteOffset = decoder.decode(encodedEnvelope).indexOf(
    "synthetic browser failure",
  );
  assert.notEqual(malformedByteOffset, -1);
  encodedEnvelope[malformedByteOffset] = 0xff;
  const chunks = [
    encodedEnvelope.subarray(0, malformedByteOffset + 1),
    encodedEnvelope.subarray(malformedByteOffset + 1),
  ];

  let cancelled = false;
  let nextChunk = 0;
  const malformedStream = new ReadableStream(
    {
      pull(controller) {
        const chunk = chunks[nextChunk];
        nextChunk += 1;
        if (chunk === undefined) {
          controller.close();
          return;
        }
        controller.enqueue(chunk);
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  const response = await loaded.module.POST({
    body: malformedStream,
    headers: new Headers({
      origin: "https://portfolio.example",
      "content-type": "application/json",
    }),
    url: "https://portfolio.example/api/observability",
  });

  assert.equal(response.status, 400);
  assert.equal(await response.text(), "");
  assert.equal(cancelled, true);
  assert.deepEqual(loaded.events, []);
  assert.deepEqual(loaded.reports, []);
});

test("error recovery copy and presentation are exact, validated, and pure", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const rendered = assertSuccess(
    await renderSkeleton({
      profile: "portfolio",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      packageVersions,
    }),
  );
  const copyModule = await loadErrorCopyModule(rendered.files);
  const fallbackModule = await loadErrorFallbackModule();
  const copy = Object.freeze({
    heading: "Something went wrong",
    summary: "We could not complete this page. Please try again.",
    retryLabel: "Try again",
  });

  assert.deepEqual(copyModule.readErrorFallbackCopy(), copy);
  for (const invalid of [
    null,
    { ...copy, extra: "not allowed" },
    { ...copy, heading: "" },
    { ...copy, summary: { nested: "not copy" } },
    { ...copy, retryLabel: "Try\u0000again" },
  ]) {
    assert.throws(() => copyModule.parseErrorFallbackCopy(invalid), {
      name: "TypeError",
      message: "CONTENT_INVALID",
    });
  }

  let retried = false;
  const renderedFallback = fallbackModule.ErrorFallback({
    copy,
    onRetry: () => {
      retried = true;
    },
  });
  assert.equal(renderedFallback.type, "main");
  assert.equal(
    renderedFallback.props["aria-labelledby"],
    "error-fallback-heading",
  );
  const section = renderedFallback.props.children;
  assert.equal(section.type, "section");
  const [heading, summary, retry] = section.props.children;
  assert.equal(heading.type, "h1");
  assert.equal(heading.props.id, "error-fallback-heading");
  assert.equal(heading.props.children, copy.heading);
  assert.equal(summary.type, "p");
  assert.equal(summary.props.children, copy.summary);
  assert.equal(retry.type, "button");
  assert.equal(retry.props.type, "button");
  assert.equal(retry.props.children, copy.retryLabel);
  retry.props.onClick();
  assert.equal(retried, true);
});

test("page and global boundaries report once and render the required roots", async () => {
  const pageBoundary = await loadErrorBoundaryModule("app/error.tsx");
  const globalBoundary = await loadErrorBoundaryModule("app/global-error.tsx");
  const pageError = new Error("page boundary failure");
  const globalError = new Error("global boundary failure");
  const reset = () => undefined;

  const pageResult = pageBoundary.module.default({ error: pageError, reset });
  assert.deepEqual(pageBoundary.reports, [
    { error: pageError, context: { boundary: "page" } },
  ]);
  const pageFallback = pageResult.type(pageResult.props);
  assert.equal(pageFallback.type, "error-fallback");
  assert.equal(pageFallback.props.onRetry, reset);

  const globalResult = globalBoundary.module.default({
    error: globalError,
    reset,
  });
  assert.deepEqual(globalBoundary.reports, [
    { error: globalError, context: { boundary: "global" } },
  ]);
  assert.equal(globalResult.type, "html");
  assert.equal(globalResult.props.lang, "en-CA");
  assert.equal(globalResult.props.children.type, "body");
  const globalFallbackElement = globalResult.props.children.props.children;
  const globalFallback = globalFallbackElement.type(globalFallbackElement.props);
  assert.equal(globalFallback.type, "error-fallback");
});

test("the nested work boundary reports once and preserves fallback retry behavior", async () => {
  const workBoundary = await loadErrorBoundaryModule(
    "app/work/error.tsx",
    readSiteWebTemplate,
  );
  const error = new Error("work boundary failure");
  let resetCount = 0;
  const reset = () => {
    resetCount += 1;
  };

  const result = workBoundary.module.default({ error, reset });

  assert.deepEqual(workBoundary.reports, [
    { error, context: { boundary: "page" } },
  ]);
  const fallback = result.type(result.props);
  assert.equal(fallback.type, "error-fallback");
  assert.deepEqual(fallback.props.copy, {
    heading: "Something went wrong",
    summary: "We could not complete this page. Please try again.",
    retryLabel: "Try again",
  });
  assert.equal(fallback.props.onRetry, reset);
  fallback.props.onRetry();
  assert.equal(resetCount, 1);
});


test("Next request instrumentation awaits reporting with only approved framework inputs", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const rendered = assertSuccess(
    await renderSkeleton({
      profile: "portfolio",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      packageVersions,
    }),
  );
  const loaded = await loadGeneratedInstrumentation(rendered.files);
  const error = Object.assign(new Error("synthetic request failure"), {
    digest: "next-digest-1",
  });
  const request = {
    path: "/private/customer?token=credential-secret",
    method: "GET",
    headers: {
      authorization: "Bearer credential-secret",
      cookie: "session=private",
    },
  };
  const context = {
    routerKind: "App Router",
    routePath: "/app/(store)/products/[productId]",
    routeType: "render",
    renderSource: "react-server-components",
    renderType: "dynamic-resume",
    revalidateReason: "on-demand",
  };

  const reporting = loaded.module.onRequestError(error, request, context);
  assert.equal(reporting instanceof Promise, true);
  await reporting;

  assert.deepEqual(loaded.calls, [
    {
      error,
      context: {
        requestMethod: "GET",
        routerKind: "App Router",
        routePath: "/app/(store)/products/[productId]",
        routeType: "render",
        renderSource: "react-server-components",
        renderType: "dynamic-resume",
        revalidateReason: "on-demand",
      },
    },
  ]);
  assert.doesNotMatch(
    JSON.stringify(loaded.calls),
    /private\/customer|credential-secret|authorization|cookie|session=/u,
  );
});

test("server reporting accepts the current Next route type vocabulary", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const rendered = assertSuccess(
    await renderSkeleton({
      profile: "portfolio",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      packageVersions,
    }),
  );
  const loaded = await loadGeneratedServerReporter(rendered.files, {
    ingestingHost: "",
    sourceToken: "",
  });
  const structuredRecords = [];
  const routeTypes = ["action", "proxy", "render", "route"];
  const originalConsoleInfo = console.info;
  console.info = (record) => structuredRecords.push(record);

  try {
    for (const routeType of routeTypes) {
      await loaded.module.reportServerError(new Error("synthetic failure"), {
        routeType,
      });
    }
    await Promise.all(loaded.scheduled);
  } finally {
    console.info = originalConsoleInfo;
  }

  assert.deepEqual(
    structuredRecords.map(({ attributes }) => attributes.route_type),
    routeTypes,
  );
});

test("server reporting contains unexpected diagnostic dispatch rejections", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const rendered = assertSuccess(
    await renderSkeleton({
      profile: "portfolio",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      packageVersions,
    }),
  );
  const loaded = await loadGeneratedServerReporter(rendered.files, {
    rejectErrorDispatch: true,
  });

  await assert.doesNotReject(() =>
    loaded.module.reportServerError(new Error("synthetic failure")),
  );
  assert.equal(loaded.scheduled.length, 1);
  await assert.doesNotReject(() => loaded.scheduled[0]);
});

test("browser event delivery preserves the validated event identifier", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const rendered = assertSuccess(
    await renderSkeleton({
      profile: "portfolio",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      packageVersions,
    }),
  );
  const loaded = await loadGeneratedServerReporter(rendered.files, {
    ingestingHost: "",
    sourceToken: "",
  });
  const structuredRecords = [];
  const originalConsoleInfo = console.info;
  console.info = (record) => structuredRecords.push(record);

  try {
    await loaded.module.reportBrowserEvent({
      name: "browser.web.vital",
      kind: "web.vital",
      severity: "info",
      eventId: "browser-vital-123",
      attributes: { metric_name: "LCP" },
      allowedAttributeNames: ["metric_name"],
    });
    await loaded.scheduled[0];
  } finally {
    console.info = originalConsoleInfo;
  }

  assert.equal(structuredRecords.length, 1);
  assert.equal(structuredRecords[0].event_id, "browser-vital-123");
});

test("server reporting normalizes only valid proxy and Pages route contexts", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const rendered = assertSuccess(
    await renderSkeleton({
      profile: "portfolio",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      packageVersions,
    }),
  );
  const loaded = await loadGeneratedServerReporter(rendered.files);
  const providerRecords = [];
  const originalConsoleInfo = console.info;
  const originalFetch = globalThis.fetch;
  console.info = () => undefined;
  globalThis.fetch = async (_url, init) => {
    providerRecords.push(JSON.parse(init.body));
    return { status: 202 };
  };

  try {
    await loaded.module.reportServerError(new Error("proxy failure"), {
      routerKind: "Pages Router",
      routePath: "/proxy",
      routeType: "proxy",
    });
    await loaded.module.reportServerError(new Error("page failure"), {
      routerKind: "Pages Router",
      routePath: "/orders/[...orderParts]",
      routeType: "render",
    });
    await loaded.module.reportServerError(new Error("root page failure"), {
      routerKind: "Pages Router",
      routePath: "/",
      routeType: "render",
    });
    await loaded.module.reportServerError(new Error("invalid proxy router"), {
      routerKind: "App Router",
      routePath: "/proxy",
      routeType: "proxy",
    });
    await loaded.module.reportServerError(new Error("missing proxy router"), {
      routePath: "/proxy",
      routeType: "proxy",
    });
    await Promise.all(loaded.scheduled);
  } finally {
    console.info = originalConsoleInfo;
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(
    providerRecords.map(({ capture }) => capture.routeIdentifier),
    ["proxy", "orders/[catch-all]", "root", undefined, undefined],
  );
});

test("server request and selected-catch reports separate safe and restricted delivery", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const rendered = assertSuccess(
    await renderSkeleton({
      profile: "portfolio",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      packageVersions,
    }),
  );
  const loaded = await loadGeneratedServerReporter(rendered.files);
  const structuredRecords = [];
  const providerRequests = [];
  const originalConsoleInfo = console.info;
  const originalFetch = globalThis.fetch;
  console.info = (record) => structuredRecords.push(record);
  globalThis.fetch = async (url, init) => {
    providerRequests.push({ url, init });
    return { status: 202 };
  };
  const error = Object.assign(new TypeError("synthetic request failure"), {
    digest: "next-digest-1",
    stack:
      "TypeError: synthetic request failure\n" +
      "    at render (/app/products/page.tsx:10:2)",
  });

  try {
    await assert.doesNotReject(() =>
      loaded.module.reportServerError(error, {
        correlationId: "request-123",
        requestMethod: "GET",
        routerKind: "App Router",
        routePath: "/app/(store)/products/[productId]",
        routeType: "render",
        renderSource: "react-server-components",
        renderType: "dynamic-resume",
        revalidateReason: "on-demand",
      }),
    );
    assert.equal(loaded.scheduled.length, 1);
    await assert.doesNotReject(() => loaded.scheduled[0]);

    await assert.doesNotReject(() =>
      loaded.module.reportCaughtServerError(
        new Error("synthetic selected failure"),
        { operation: "refresh-catalog", correlationId: "operation-456" },
      ),
    );
    assert.equal(loaded.scheduled.length, 2);
    await assert.doesNotReject(() => loaded.scheduled[1]);
  } finally {
    console.info = originalConsoleInfo;
    globalThis.fetch = originalFetch;
  }

  assert.equal(structuredRecords.length, 2);
  assert.deepEqual(structuredRecords[0], {
    schema_version: "2.0.0",
    dt: structuredRecords[0].dt,
    event_name: "server.request.error",
    event_kind: "application.error",
    runtime: "server",
    severity: "error",
    event_id: structuredRecords[0].event_id,
    correlation_id: "request-123",
    release_id: "release-123",
    service: "web",
    error_category: "unexpected",
    attributes: {
      capture_mechanism: "next-request-error",
      handled: false,
      http_method: "GET",
      render_source: "react-server-components",
      render_type: "dynamic-resume",
      revalidate_reason: "on-demand",
      route_identifier: "group.products.dynamic",
      route_type: "render",
      router_kind: "app-router",
    },
  });
  assert.match(
    structuredRecords[0].event_id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
  );
  assert.equal("environment" in structuredRecords[0], false);
  assert.equal(providerRequests.length, 2);
  const providerRecords = providerRequests.map(({ init }) =>
    JSON.parse(init.body),
  );
  assert.deepEqual(providerRecords[0].capture, {
    mechanism: "next-request-error",
    handled: false,
    routerKind: "app-router",
    routeType: "render",
    renderSource: "react-server-components",
    renderType: "dynamic-resume",
    revalidateReason: "on-demand",
    requestMethod: "GET",
    routeIdentifier: "group/products/[dynamic]",
  });
  assert.equal(providerRecords[0]["exception.type"], "TypeError");
  assert.equal(
    providerRecords[0]["exception.message"],
    "synthetic request failure",
  );
  assert.match(
    providerRecords[0]["exception.stacktrace"],
    /TypeError: synthetic request failure[\s\S]+\[REDACTED_PATH\]\/page\.tsx:10:2/u,
  );
  assert.equal(providerRecords[0]["exception.digest"], "next-digest-1");
  assert.match(
    providerRecords[0]["exception.fingerprint"],
    /^fnv1a32-v1:[a-f0-9]{8}$/u,
  );
  assert.equal(providerRecords[0]["exception.truncated"], true);
  assert.deepEqual(providerRecords[1].capture, {
    mechanism: "selected-catch",
    handled: true,
    operation: "refresh-catalog",
  });
  assert.equal(providerRecords[1].correlation_id, "operation-456");
  assert.equal(
    providerRequests.every(({ init }) => init.signal instanceof AbortSignal),
    true,
  );
  for (const [index, structuredRecord] of structuredRecords.entries()) {
    for (const [key, value] of Object.entries(structuredRecord)) {
      assert.deepEqual(providerRecords[index][key], value);
    }
  }
  assert.doesNotMatch(
    JSON.stringify(structuredRecords),
    /exception\.|fingerprint|synthetic request failure/u,
  );
});

test("generated server delivery uses the actual observability package record shapes", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const rendered = assertSuccess(
    await renderSkeleton({
      profile: "portfolio",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      packageVersions,
    }),
  );
  const loaded = await loadGeneratedServerReporter(rendered.files);
  const structuredRecords = [];
  const providerRequests = [];
  const originalConsoleInfo = console.info;
  const originalFetch = globalThis.fetch;
  console.info = (record) => structuredRecords.push(record);
  globalThis.fetch = async (url, init) => {
    providerRequests.push({ url, init });
    return { status: 202 };
  };

  try {
    await loaded.module.reportServerError(
      new TypeError("synthetic package record"),
      {
        requestMethod: "GET",
        routerKind: "App Router",
        routePath: "/app/(store)/products/[productId]",
        routeType: "route",
      },
    );
    await loaded.scheduled[0];
  } finally {
    console.info = originalConsoleInfo;
    globalThis.fetch = originalFetch;
  }

  assert.equal(structuredRecords.length, 1);
  assert.equal(structuredRecords[0].schema_version, "2.0.0");
  assert.equal(structuredRecords[0].event_name, "server.request.error");
  assert.equal(structuredRecords[0].event_kind, "application.error");
  assert.equal("schemaVersion" in structuredRecords[0], false);
  assert.deepEqual(structuredRecords[0].attributes, {
    capture_mechanism: "next-request-error",
    handled: false,
    http_method: "GET",
    route_identifier: "group.products.dynamic",
    route_type: "route",
    router_kind: "app-router",
  });
  assert.equal(providerRequests.length, 1);
  const diagnosticRecord = JSON.parse(providerRequests[0].init.body);
  assert.equal(diagnosticRecord.event_id, structuredRecords[0].event_id);
  assert.equal(diagnosticRecord["exception.type"], "TypeError");
  assert.equal(
    diagnosticRecord["exception.message"],
    "synthetic package record",
  );
  assert.match(
    diagnosticRecord["exception.fingerprint"],
    /^fnv1a32-v1:[a-f0-9]{8}$/u,
  );
  assert.equal(
    diagnosticRecord.capture.routeIdentifier,
    "group/products/[dynamic]",
  );
  assert.equal("diagnostics" in diagnosticRecord, false);
});

test("generated server contains oversized diagnostics without HTTP or recursive reporting", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const rendered = assertSuccess(
    await renderSkeleton({
      profile: "portfolio",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      packageVersions,
    }),
  );
  const loaded = await loadGeneratedServerReporter(rendered.files);
  const structuredRecords = [];
  let providerRequests = 0;
  const originalConsoleInfo = console.info;
  const originalFetch = globalThis.fetch;
  console.info = (record) => structuredRecords.push(record);
  globalThis.fetch = async () => {
    providerRequests += 1;
    return { status: 202 };
  };
  const oversizedError = {
    name: "TypeError",
    message: "\u0000".repeat(2_048),
    stack: "\u0000".repeat(16_384),
    cause: {
      name: "CauseOne",
      stack: "\u0000".repeat(16_384),
      cause: { name: "CauseTwo", stack: "\u0000".repeat(16_384) },
    },
  };

  try {
    await loaded.module.reportServerError(oversizedError);
    await loaded.scheduled[0];
  } finally {
    console.info = originalConsoleInfo;
    globalThis.fetch = originalFetch;
  }

  assert.equal(providerRequests, 0);
  assert.deepEqual(
    structuredRecords.map(({ event_name }) => event_name),
    ["server.request.error", "observability.delivery.failed"],
  );
  assert.deepEqual(structuredRecords[1].attributes, {
    reason: "payload-too-large",
    sink: "better-stack",
  });
});

test("server reporting contains hostile inputs and diagnostic delivery failures", async (testContext) => {
  const renderSkeleton = await loadRenderSkeleton();
  const rendered = assertSuccess(
    await renderSkeleton({
      profile: "portfolio",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      packageVersions,
    }),
  );
  const structuredRecords = [];
  const originalConsoleInfo = console.info;
  const originalFetch = globalThis.fetch;
  console.info = (record) => structuredRecords.push(record);
  testContext.after(() => {
    console.info = originalConsoleInfo;
  });

  const withoutProvider = await loadGeneratedServerReporter(rendered.files, {
    ingestingHost: "",
    sourceToken: "",
  });
  let withoutProviderRequests = 0;
  try {
    globalThis.fetch = async () => {
      withoutProviderRequests += 1;
      throw new Error("provider response contained credential-secret");
    };
    await assert.doesNotReject(() =>
      withoutProvider.module.reportServerError(
        new Error("private failure"),
        {
          requestMethod: "TRACE",
          routerKind: "Private Router",
          routePath: "/app/private/customer@example.com?token=secret",
          routeType: "middleware",
          renderSource: "private-source",
          renderType: "static",
          revalidateReason: "private-reason",
        },
      ),
    );
    await withoutProvider.scheduled[0];
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(withoutProviderRequests, 0);
  assert.equal(structuredRecords.length, 1);
  assert.equal(structuredRecords[0].event_name, "server.request.error");
  assert.deepEqual(structuredRecords[0].attributes, {
    capture_mechanism: "next-request-error",
    handled: false,
  });

  const failing = await loadGeneratedServerReporter(rendered.files, {
    scheduleShouldThrow: false,
  });
  const hostileError = Object.create(null, {
    name: { get: () => "Error" },
    message: {
      get: () => "synthetic " + "x".repeat(4_000),
    },
    stack: {
      get: () => "Error: synthetic\n" + "at frame (/private/path:1:2)\n".repeat(8_000),
    },
    digest: {
      get() {
        throw new Error("hostile getter credential-secret");
      },
    },
    privateField: { value: "credential-secret" },
  });
  const failingProviderRecords = [];
  try {
    globalThis.fetch = async (_url, init) => {
      failingProviderRecords.push(JSON.parse(init.body));
      return {
        status: 503,
        body: "provider response credential-secret",
      };
    };
    await assert.doesNotReject(() =>
      failing.module.reportServerError(hostileError, {
        requestMethod: "POST",
        routerKind: "Pages Router",
        routePath: "/orders/[...orderParts]",
        routeType: "route",
        renderSource: "server-rendering",
        renderType: "dynamic",
        revalidateReason: "stale",
      }),
    );
    assert.equal(failing.scheduled.length, 1);
    await assert.doesNotReject(() => failing.scheduled[0]);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(failingProviderRecords.length, 1);
  assert.equal(
    new TextEncoder().encode(
      JSON.stringify(failingProviderRecords[0]),
    ).byteLength < 96_000,
    true,
  );
  assert.deepEqual(failingProviderRecords[0].capture, {
    mechanism: "next-request-error",
    handled: false,
    routerKind: "pages-router",
    routeType: "route",
    renderSource: "server-rendering",
    renderType: "dynamic",
    revalidateReason: "stale",
    requestMethod: "POST",
    routeIdentifier: "orders/[catch-all]",
  });
  assert.equal(structuredRecords.length, 3);
  assert.equal(
    structuredRecords[2].event_name,
    "observability.delivery.failed",
  );
  assert.deepEqual(structuredRecords[2].attributes, {
    reason: "provider-rejected",
    sink: "better-stack",
  });
  assert.doesNotMatch(
    JSON.stringify([...structuredRecords, ...failingProviderRecords]),
    /credential-secret|provider response|private\/path|privateField/u,
  );

  const scheduleFailureRecords = [];
  console.info = (record) => scheduleFailureRecords.push(record);
  const scheduleFailure = await loadGeneratedServerReporter(rendered.files, {
    scheduleShouldThrow: true,
  });
  try {
    globalThis.fetch = async () => ({ status: 503 });
    await assert.doesNotReject(() =>
      scheduleFailure.module.reportServerError(new Error("synthetic failure"), {
        requestMethod: "GET",
      }),
    );
    await assert.doesNotReject(() => scheduleFailure.scheduled[0]);
  } finally {
    console.info = originalConsoleInfo;
    globalThis.fetch = originalFetch;
  }
  assert.equal(
    scheduleFailureRecords.filter(
      ({ event_name: eventName }) =>
        eventName === "observability.delivery.failed",
    ).length,
    1,
  );
});

test("rendering conditionally overlays the home route and materializes each Calendly mode", async () => {
  const renderSkeleton = await loadRenderSkeleton();

  for (const mode of ["link", "inline", "popup"]) {
    const bookingCalendly = {
        mode,
    };
    const rendered = assertSuccess(
      await renderSkeleton({
        profile: "portfolio",
        projectName: "acme-studio",
        displayName: "Acme Studio",
        bookingCalendly,
        packageVersions,
      }),
    );

    assert.equal(rendered.project.schemaVersion, "2.0.0");
    assert.equal(rendered.project.recipeVersion, "0.12.0");
    assert.equal(
      rendered.project.selectedCapabilities.at(-1),
      "booking-calendly",
    );
    assert.deepEqual(rendered.project.capabilitySettings, {
      "booking-calendly": bookingCalendly,
    });
    assert.deepEqual(
      rendered.resolved.capabilities.map(({ identifier }) => identifier),
      rendered.project.selectedCapabilities,
    );
    assert.deepEqual(
      rendered.files.map(({ path }) => path),
      [...portfolioPaths, ...bookingCalendlyPaths].toSorted(),
    );
    const files = indexFiles(rendered.files);
    const bookingSource = files.get("apps/web/src/integrations/booking-calendly/booking-settings.ts");
    assert.match(bookingSource, new RegExp(`mode: ${JSON.stringify(mode)}`));
    assert.match(bookingSource, /NEXT_PUBLIC_CALENDLY_URL/u);
    assert.match(bookingSource, /destination: string \| undefined/u);
    assert.doesNotMatch(bookingSource, /https:\/\/calendly\.com\/acme/u);
    assert.match(
      files.get("apps/web/app/page.tsx"),
      /<CalendlyBooking settings=\{bookingCalendlySettings\} copy=\{bookingContent\} \/>/u,
    );
    assert.doesNotMatch(
      files.get("apps/web/app/page.tsx"),
      /from "\.\.\/src\/presentation\/content-page";[\s\S]+from "\.\.\/src\/presentation\/content-page";/u,
    );
  }

  const selectedSite = assertSuccess(
    await renderSkeleton({
      profile: "site",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      bookingCalendly: {
        mode: "popup",
      },
      packageVersions,
    }),
  );
  assert.deepEqual(
    selectedSite.files.map(({ path }) => path),
    [...sitePaths, ...bookingCalendlyPaths].toSorted(),
  );
});

test("generated Calendly copy is strict externalized YAML", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const rendered = assertSuccess(
    await renderSkeleton({
      profile: "portfolio",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      bookingCalendly: {
            mode: "inline",
      },
      packageVersions,
    }),
  );
  const files = indexFiles(rendered.files);
  assert.deepEqual(
    parseGeneratedYaml(
      rendered.files,
      "apps/web/content/en-CA/booking-calendly.yaml",
    ),
    bookingCalendlyCopy,
  );
  const bookingContentModule = await loadGeneratedBookingContentModule(
    rendered.files,
  );
  assert.deepEqual(bookingContentModule.readBookingContent(), bookingCalendlyCopy);
  assert.deepEqual(
    bookingContentModule.parseBookingContent(bookingCalendlyCopy),
    bookingCalendlyCopy,
  );

  for (const invalidContent of [
    { ...bookingCalendlyCopy, extra: true },
    { ...bookingCalendlyCopy, heading: "" },
    { ...bookingCalendlyCopy, summary: " " },
    { ...bookingCalendlyCopy, linkLabel: 42 },
    { ...bookingCalendlyCopy, frameTitle: "Unsafe\u007fcopy" },
    { ...bookingCalendlyCopy, popupHeading: undefined },
    { ...bookingCalendlyCopy, closeLabel: "Unsafe\u0085copy" },
  ]) {
    assertContentInvalid(() =>
      bookingContentModule.parseBookingContent(invalidContent),
    );
  }

  for (const value of Object.values(bookingCalendlyCopy)) {
    assert.equal(
      [...files]
        .filter(([path]) => !path.includes("/tests/") && (path.endsWith(".ts") || path.endsWith(".tsx")))
        .some(([, source]) => source.includes(value)),
      false,
      value,
    );
  }
});

test("generated Calendly presentation preserves link, lazy inline, and native dialog contracts", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const rendered = assertSuccess(
    await renderSkeleton({
      profile: "portfolio",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      bookingCalendly: {
        mode: "popup",
      },
      packageVersions,
    }),
  );
  const files = indexFiles(rendered.files);
  const component = files.get(
    "apps/web/src/integrations/booking-calendly/calendly-booking.tsx",
  );
  const browserSpecification = files.get(
    "apps/web/tests/e2e/calendly-booking.spec.ts",
  );
  const generatedInstructions = files.get("apps/web/AGENTS.md");
  const generatedReadme = files.get("README.md");
  assert.notEqual(component, undefined);
  assert.notEqual(browserSpecification, undefined);
  assert.match(generatedInstructions, /direct cross-origin iframe/u);
  assert.match(generatedInstructions, /normal-link fallback/u);
  assert.match(generatedInstructions, /native dialog lifecycle/u);
  assert.match(generatedReadme, /Calendly booking/u);
  assert.match(generatedReadme, /provider-controlled scheduling data/u);
  assert.match(generatedReadme, /does not load Calendly host-page JavaScript/u);

  for (const contract of [
    /^"use client";$/mu,
    /href=\{settings\.destination\}/u,
    /settings\.mode === "link"/u,
    /settings\.mode === "inline"/u,
    /settings\.mode === "popup"/u,
    /IntersectionObserver/u,
    /rootMargin/u,
    /requestAnimationFrame/u,
    /showModal/u,
    /event\.preventDefault\(\)/u,
    /onClose/u,
    /setFrameActive\(false\)/u,
    /src=\{settings\.destination\}/u,
    /loading="lazy"/u,
    /title=\{copy\.frameTitle\}/u,
    /referrerPolicy="strict-origin-when-cross-origin"/u,
    /<dialog/u,
    /max-w-4xl/u,
    /max-h-\[calc\(100dvh-2rem\)\]/u,
  ]) {
    assert.match(component, contract);
  }
  assert.equal(
    component.match(
      /\{frameActive \? \(\s*<BookingFrame settings=\{settings\} copy=\{copy\} \/>\s*\) : null\}/gu,
    )?.length,
    2,
  );
  assert.doesNotMatch(component, /src=\{frameActive/u);
  assert.doesNotMatch(component, /calendly\.com/u);
  assert.doesNotMatch(component, /<script|Calendly\.init|fetch\(/u);

  for (const contract of [
    /BOOKING_TEST_EXPECTED_URL/u,
    /BOOKING_TEST_MODE/u,
    /context\.route\("\*\*\/\*"/u,
    /request\.url\(\) === expectedRequestUrl/u,
    /unexpected\.push\(request\.url\(\)\)/u,
    /route\.abort\("blockedbyclient"\)/u,
    /route\.fulfill/u,
    /expect\(audit\.unexpected\)\.toEqual\(\[\]\)/u,
    /javaScriptEnabled: false/u,
    /bookingMode === "link"/u,
    /bookingMode === "inline"/u,
    /bookingMode !== "inline"/u,
    /bookingMode !== "popup"/u,
    /toHaveAttribute\("href", expectedUrl/u,
    /toHaveAttribute\("src", expectedUrl/u,
    /toHaveCount\(0\)/u,
    /keyboard\.press\("Escape"\)/u,
    /document\.activeElement/u,
    /width: 320/u,
    /scrollWidth/u,
    /AxeBuilder/u,
    /wcag22aa/u,
  ]) {
    assert.match(browserSpecification, contract);
  }
  assert.doesNotMatch(browserSpecification, /not\.toHaveAttribute\("src"\)/u);
  assert.doesNotMatch(browserSpecification, /page\.goto\(bookingCalendlySettings\.destination/u);
});

test("rendering refuses literal Calendly destinations without disclosing them", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  for (const destination of ["https://calendly.com:443/private-sentinel/intro", "https://calendly.com/private-sentinel/intro"]) {
    const result = await renderSkeleton({ profile: "portfolio", projectName: "literal-refusal", displayName: "Literal Refusal", bookingCalendly: { destination, mode: "popup" }, packageVersions });
    assert.equal(result.ok, false);
    assert.equal(Object.hasOwn(result, "value"), false);
    assert.doesNotMatch(JSON.stringify(result), /private-sentinel/u);
  }
});

test("rendering rejects Calendly query data before desired state or settings are materialized", async () => {
  const renderSkeleton = await loadRenderSkeleton();

  for (const destination of [
    "https://calendly.com/acme/intro?month=2026-08",
    "https://calendly.com/acme/intro?email=person%40example.com&token=private-token",
  ]) {
    const result = await renderSkeleton({
      profile: "portfolio",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      bookingCalendly: { destination, mode: "popup" },
      packageVersions,
    });

    assert.equal(result.ok, false);
    assert.equal(Object.hasOwn(result, "value"), false);
    assert.ok(
      result.issues.every(
        ({ code }) => code === "CONTRACT_VALIDATION_FAILED",
      ),
    );
    assert.doesNotMatch(
      JSON.stringify(result.issues),
      /month=2026-08|person%40example\.com|private-token/u,
    );
  }
});

test("generated Calendly browser behavior covers unavailable platform APIs", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const rendered = assertSuccess(
    await renderSkeleton({
      profile: "portfolio",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      bookingCalendly: {
        mode: "popup",
      },
      packageVersions,
    }),
  );
  const browserSpecification = indexFiles(rendered.files).get(
    "apps/web/tests/e2e/calendly-booking.spec.ts",
  );
  assert.notEqual(browserSpecification, undefined);

  for (const contract of [
    /test\("inline fallback works without IntersectionObserver"/u,
    /page\.addInitScript/u,
    /Object\.defineProperty\(window, "IntersectionObserver"/u,
    /test\("popup falls back to navigation without native modal support"/u,
    /Object\.defineProperty\(\s*HTMLDialogElement\.prototype,\s*"showModal"/u,
    /page\.waitForURL\(expectedRequestUrl\)/u,
    /audit\.requests\[0\]\?\.frame\(\)/u,
  ]) {
    assert.match(browserSpecification, contract);
  }
});

test("generated popup Calendly browser specification keeps every configured mode comparable", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const rendered = assertSuccess(
    await renderSkeleton({
      profile: "portfolio",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      bookingCalendly: {
        mode: "popup",
      },
      packageVersions,
    }),
  );

  assert.deepEqual(
    await findGeneratedTypeScriptDiagnostics(
      rendered.files,
      "apps/web/tests/e2e/calendly-booking.spec.ts",
      2367,
    ),
    [],
  );
});

test("generated deployment binds staging and production to reviewed source and prepared artifacts", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const rendered = assertSuccess(await renderSkeleton({ profile: "portfolio", projectName: "release-contract", displayName: "Release Contract", packageVersions }));
  const workflow = parseGeneratedYaml(rendered.files, ".github/workflows/deploy.yml");
  assert.deepEqual(workflow.on, { workflow_dispatch: { inputs: { expected_revision: {
    description: "Exact reviewed main revision for both target builds", required: true, type: "string",
  } } } });
  assert.deepEqual(workflow.permissions, { contents: "read" });
  assert.deepEqual(workflow.concurrency, { group: "application-release", queue: "max", "cancel-in-progress": false });
  assert.deepEqual(Object.keys(workflow.jobs), ["verify-source", "staging", "production"]);
  assert.equal(workflow.jobs["verify-source"].if, "github.ref == 'refs/heads/main'");
  assert.equal(workflow.jobs.staging.needs, "verify-source");
  assert.deepEqual(workflow.jobs.production.needs, ["verify-source", "staging"]);
  for (const [name, job] of Object.entries(workflow.jobs)) {
    assert.equal(job["runs-on"], "ubuntu-24.04");
    assert.equal(job["timeout-minutes"], 45);
    assert.deepEqual(job.container, {
      image: "mcr.microsoft.com/playwright:v1.62.1-noble@sha256:dcc5531e97840b9b5e794f2814476b21571c5124a3fca2267d73041f56e7580e",
      options: "--shm-size=1g",
    });
    assert.deepEqual(job.permissions, name === "staging" ? { contents: "read" } : { contents: "read", actions: "read" });
    const steps = Object.fromEntries(job.steps.map(step => [step.name, step]));
    assert.deepEqual(steps["Check out frozen source"].with, {
      "fetch-depth": 0,
      ref: name === "verify-source" ? "${{ github.sha }}" : "${{ needs.verify-source.outputs.revision }}",
      "persist-credentials": false,
    });
    assert.deepEqual(steps["Set up pnpm and Node.js"].with, { version: "11.28.1", runtime: "node@22.23.2", cache: false, install: false });
    assert.equal(steps["Install frozen dependencies"].run, "pnpm install --frozen-lockfile");
    assert.equal(job.env.WRANGLER_SEND_METRICS, "false");
    if (name === "verify-source") {
      assert.equal(job.environment, undefined);
      assert.equal(steps["Check native deployment protections"].run, "node scripts/check-deployment-protection.mjs preflight");
      continue;
    }
    assert.deepEqual(job.environment, { name, url: "${{ vars.DEPLOY_URL }}" });
    assert.equal(job.env.APPLICATION_ENVIRONMENT, name);
    assert.equal(job.env.BUILD_SOURCE_REVISION, "${{ needs.verify-source.outputs.revision }}");
    const prepare = job.steps.indexOf(steps["Prepare target application"]);
    const record = job.steps.indexOf(steps["Record prepared target artifact"]);
    const preview = job.steps.indexOf(steps["Test prepared local preview"]);
    const deploy = job.steps.indexOf(steps["Deploy prepared Cloudflare Worker"]);
    assert.ok(prepare >= 0 && record > prepare && preview > record && deploy > preview);
    assert.match(steps["Record prepared target artifact"].run, /check:prepared-artifact record/u);
    assert.equal((steps["Test prepared local preview"].run.match(/check:prepared-artifact verify/gu) ?? []).length, 2);
    const deployStep = steps["Deploy prepared Cloudflare Worker"];
    assert.deepEqual(deployStep.env, { CLOUDFLARE_ACCOUNT_ID: "${{ secrets.CLOUDFLARE_ACCOUNT_ID }}", CLOUDFLARE_API_TOKEN: "${{ secrets.CLOUDFLARE_API_TOKEN }}" });
    const commandLines = deployStep.run.split("\n").map(line => line.trim());
    const verifyArtifact = commandLines.indexOf('pnpm run check:prepared-artifact verify "$APPLICATION_ENVIRONMENT" "$EXPECTED_REVISION"');
    const deployWorker = commandLines.indexOf(`pnpm exec opennextjs-cloudflare deploy --env ${name} -- --x-provision=false --x-auto-create=false`);
    assert.ok(verifyArtifact >= 0 && deployWorker > verifyArtifact, `${name} must verify the prepared artifact before deployment`);
    assert.doesNotMatch(deployStep.run, /\b(?:build|install|preview)\b/u);
    assert.equal(job.steps.filter(step => JSON.stringify(step.env ?? {}).includes("secrets.CLOUDFLARE_")).length, 1);
  }
  assert.equal(workflow.jobs.production.steps.find(step => step.name === "Recheck native protections and this run's human approval").run, "node scripts/check-deployment-protection.mjs production");
  assert.equal(workflow.jobs.staging.steps.at(-1).run, "pnpm --dir apps/web run test:e2e:deployed");
  assert.equal(workflow.jobs.staging.steps.some(step => step.uses?.startsWith("actions/upload-artifact")), false);

  const guard = workflow.jobs["verify-source"].steps.find(step => step.name === "Verify reviewed clean main revision");
  const revision = "a".repeat(40);
  const runGuard = overrides => spawnSync("bash", ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c",
    `git() { case "$1" in rev-parse) printf '%s' "$TEST_HEAD" ;; status) printf '%s' "$TEST_STATUS" ;; *) return 1 ;; esac; }\n${guard.run}`], {
    encoding: "utf8", env: { EXPECTED_REVISION: revision, GITHUB_SHA: revision, TEST_HEAD: revision, TEST_STATUS: "", GITHUB_REF: "refs/heads/main", GITHUB_RUN_ATTEMPT: "1", GITHUB_OUTPUT: "/dev/null", ...overrides },
  });
  assert.equal(runGuard({}).status, 0);
  for (const inputs of [{ EXPECTED_REVISION: "A".repeat(40) }, { EXPECTED_REVISION: "a".repeat(39) }, { GITHUB_SHA: "b".repeat(40) }, { TEST_HEAD: "b".repeat(40) }, { TEST_STATUS: " M changed.ts" }, { GITHUB_REF: "refs/heads/release" }, { GITHUB_RUN_ATTEMPT: "2" }]) {
    assert.notEqual(runGuard(inputs).status, 0, JSON.stringify(inputs));
  }
});

test("generated browser quality is environment-specific and content-agnostic", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const rendered = assertSuccess(
    await renderSkeleton({
      profile: "site",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      packageVersions,
    }),
  );
  const files = indexFiles(rendered.files);
  const shared = files.get("apps/web/playwright.config.shared.ts");
  const development = files.get("apps/web/playwright.dev.config.ts");
  const developmentServer = files.get("apps/web/scripts/browser-development-server.ts");
  const preview = files.get("apps/web/playwright.preview.config.ts");
  const deployed = files.get("apps/web/playwright.deployed.config.ts");
  const nextConfiguration = files.get("apps/web/next.config.ts");
  const specification = files.get("apps/web/tests/e2e/site-quality.spec.ts");
  const workflow = files.get(".github/workflows/quality.yml");
  const workflowConfiguration = parseGeneratedYaml(
    rendered.files,
    ".github/workflows/quality.yml",
  );
  const ignore = files.get(".gitignore");
  const readme = files.get("README.md");
  const instructions = files.get("AGENTS.md");

  assert.match(shared, /fullyParallel: false/u);
  assert.match(shared, /forbidOnly: Boolean\(process\.env\.CI\)/u);
  assert.match(shared, /process\.env\.CI \? \{ workers: 1 \} : \{\}/u);
  assert.match(shared, /name: "chromium"/u);
  assert.match(shared, /trace: protectedStaging \? "off" : "retain-on-failure"/u);
  assert.match(shared, /screenshot: protectedStaging \? "off" : "only-on-failure"/u);
  assert.match(shared, /video: protectedStaging \? "off" : "retain-on-failure"/u);

  assert.match(development, /baseURL: guardedDevelopmentOrigin, webServer: guardedDevelopmentServer/u);
  assert.match(developmentServer, /http:\/\/127\.0\.0\.1:3100/u);
  assert.match(developmentServer, /node --experimental-strip-types scripts\/browser-development-server\.ts --hostname 127\.0\.0\.1 --port 3100/u);
  assert.match(developmentServer, /reuseExistingServer: false/u);
  assert.match(preview, /http:\/\/localhost:3101/u);
  assert.match(
    preview,
    /pnpm exec opennextjs-cloudflare preview\$\{selection\} -- --ip 127\.0\.0\.1 --port 3101/u,
  );
  assert.doesNotMatch(preview, /pnpm run preview/u);
  assert.match(preview, /reuseExistingServer: false/u);
  assert.match(nextConfiguration, /output: "standalone"/u);
  assert.match(
    nextConfiguration,
    /outputFileTracingRoot: fileURLToPath\(new URL\("\.\.\/\.\.\/", import\.meta\.url\)\)/u,
  );

  assert.match(deployed, /process\.env\.DEPLOY_URL/u);
  assert.match(deployed, /DEPLOYED_URL_REQUIRED/u);
  assert.doesNotMatch(deployed, /PLAYWRIGHT_DEPLOYED_URL|COMPATIBILITY_URL/u);
  const deployedModule = await loadGeneratedDeployedConfigurationModule(rendered.files, "https://example.com");
  assert.deepEqual(deployedModule.default, { baseURL: "https://example.com" });
  for (const [value, message] of [
    [undefined, "DEPLOYED_URL_REQUIRED"], ["", "DEPLOYED_URL_REQUIRED"],
    ...["not a url", "http://example.com", "https://user@example.com", "https://example.com/quality/", "https://example.com?token=private", "https://example.com#fragment"]
      .map(value => [value, "APPLICATION_TRANSPORT_ORIGIN_INVALID"]),
  ]) {
    await assert.rejects(loadGeneratedDeployedConfigurationModule(rendered.files, value), { name: "Error", message });
  }

  for (const contract of [
    /getByRole\("main"\)/u,
    /getByRole\("heading", \{ level: 1 \}\)/u,
    /console/u,
    /pageerror/u,
    /wcag22aa/u,
    /keyboard\.press\("Tab"\)/u,
    /const LANDING_PATH = "\.\/"/u,
    /element\.hasAttribute\("download"\)/u,
    /const paths = await discoverContentPaths\(page, openApplicationPage\);/u,
    /for \(const path of paths\)/u,
    /outlineColor/u,
    /isPerceptibleColor/u,
    /outlineStyle/u,
    /boxShadow/u,
    /width: 320/u,
    /scrollWidth/u,
    /reducedMotion: "reduce"/u,
    /transitionDuration/u,
    /animationDuration/u,
  ]) {
    assert.match(specification, contract);
  }
  const focusContract = specification.slice(
    specification.indexOf('test("provides keyboard focus'),
    specification.indexOf('test("reflows without document overflow'),
  );
  const reducedMotionContract = specification.slice(
    specification.indexOf('test("honours reduced motion'),
  );
  assert.match(
    focusContract,
    /const paths = await discoverContentPaths\(page, openApplicationPage\);[\s\S]+for \(const path of paths\)/u,
  );
  assert.match(
    reducedMotionContract,
    /const paths = await discoverContentPaths\(page, openApplicationPage\);[\s\S]+for \(const path of paths\)/u,
  );
  assert.doesNotMatch(specification, /Acme|Portfolio|About|Contact/u);

  assert.match(workflow, /^permissions:\n  contents: read$/mu);
  assert.match(workflow, /cancel-in-progress: true/u);
  assert.match(workflow, /\$\{\{ github\.workflow \}\}-\$\{\{ github\.ref \}\}/u);
  assert.match(workflow, /actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1/u);
  assert.match(workflow, /pnpm\/setup@84cb39b217b10273981911c288cd62326dc7c6d2/u);
  assert.match(workflow, /actions\/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a/u);
  assert.match(workflow, /persist-credentials: false/u);
  assert.match(workflow, /version: 11\.28\.1/u);
  assert.match(workflow, /runtime: node@22\.23\.2/u);
  assert.match(workflow, /pnpm install --frozen-lockfile/u);
  assert.match(workflow, /pnpm run lint/u);
  assert.match(workflow, /pnpm run typecheck/u);
  assert.match(workflow, /pnpm run test:unit/u);
  assert.match(workflow, /pnpm run test:component/u);
  assert.match(workflow, /pnpm run build/u);
  assert.match(
    workflow,
    /pnpm --dir apps\/web exec opennextjs-cloudflare build --skipNextBuild/u,
  );
  assert.doesNotMatch(workflow, /pnpm run build:cloudflare/u);
  assert.match(
    workflow,
    /pnpm --dir apps\/web exec playwright install chromium/u,
  );
  assert.doesNotMatch(workflow, /playwright install --with-deps/u);
  assert.match(workflow, /test:e2e:dev/u);
  assert.match(workflow, /test:e2e:preview/u);
  assert.match(workflow, /pnpm --dir apps\/web run test:visual/u);
  assert.doesNotMatch(workflow, /--update-snapshots/u);
  assert.match(workflow, /if: failure\(\)/u);
  assert.match(workflow, /retention-days: 7/u);
  assert.doesNotMatch(workflow, /secrets\.|deploy|release|PLAYWRIGHT_DEPLOYED_URL/iu);
  assert.deepEqual(workflowConfiguration.permissions, { contents: "read" });
  assert.deepEqual(workflowConfiguration.concurrency, {
    group: "${{ github.workflow }}-${{ github.ref }}",
    "cancel-in-progress": true,
  });
  assert.deepEqual(workflowConfiguration.jobs, {
    verify: {
      env: {
        APPLICATION_ENVIRONMENT: "development",
        NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
        BUILD_SOURCE_REVISION: "${{ github.sha }}",
      },
      "runs-on": "ubuntu-24.04",
      container: {
        image:
          "mcr.microsoft.com/playwright:v1.62.1-noble@sha256:dcc5531e97840b9b5e794f2814476b21571c5124a3fca2267d73041f56e7580e",
        options: "--shm-size=1g",
      },
      "timeout-minutes": 30,
      steps: [
        {
          name: "Check out repository",
          uses: "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
          with: { "persist-credentials": false },
        },
        {
          name: "Set up pnpm and Node.js",
          uses: "pnpm/setup@84cb39b217b10273981911c288cd62326dc7c6d2",
          with: {
            version: "11.28.1",
            runtime: "node@22.23.2",
            cache: false,
            install: false,
          },
        },
        {
          name: "Install dependencies",
          run: "pnpm install --frozen-lockfile",
        },
        { name: "Lint generated project", run: "pnpm run lint" },
        { name: "Typecheck generated project", run: "pnpm run typecheck" },
        { name: "Test generated unit behavior", run: "pnpm run test:unit" },
        { name: "Test generated components", run: "pnpm run test:component" },
        { name: "Build Next.js application", run: "pnpm run build" },
        {
          name: "Build OpenNext application",
          run: "pnpm --dir apps/web exec opennextjs-cloudflare build --skipNextBuild",
        },
        {
          name: "Test built Worker when installed",
          run: "pnpm --dir apps/web run --if-present test:integration:cloudflare",
        },
        {
          name: "Install Chromium",
          run: "pnpm --dir apps/web exec playwright install chromium",
        },
        {
          name: "Test Next.js development",
          run: "pnpm --dir apps/web run test:e2e:dev",
        },
        {
          name: "Test OpenNext workerd preview",
          if: "!cancelled()",
          run: "pnpm --dir apps/web run test:e2e:preview",
        },
        {
          name: "Compare OpenNext visual baselines",
          run: "pnpm --dir apps/web run test:visual",
        },
        {
          name: "Upload browser failure artifacts",
          if: "failure()",
          uses: "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a",
          with: {
            name: "browser-failure-artifacts",
            path: "apps/web/playwright-report/\napps/web/test-results/\n",
            "if-no-files-found": "ignore",
            "include-hidden-files": false,
            "retention-days": 7,
          },
        },
      ],
    },
  });

  assert.match(ignore, /^playwright-report\/$/mu);
  assert.match(ignore, /^test-results\/$/mu);
  assert.match(readme, /explicitly install Chromium/iu);
  assert.match(readme, /pnpm run test:unit/u);
  assert.match(readme, /pnpm run test:component/u);
  assert.match(readme, /already prepared `.open-next` output/iu);
  assert.match(readme, /--skipNextBuild/u);
  assert.match(instructions, /already prepared `.open-next` output/iu);
  assert.match(instructions, /--skipNextBuild/u);
  assert.match(readme, /jsdom does not exercise CSS layout/iu);
  assert.match(readme, /does not establish WCAG conformance/iu);
});

test("generated visual regression owns four deterministic preview baselines", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const portfolio = assertSuccess(
    await renderSkeleton({
      profile: "portfolio",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      packageVersions,
    }),
  );
  const booking = assertSuccess(
    await renderSkeleton({
      profile: "portfolio",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      bookingCalendly: {
        mode: "popup",
      },
      packageVersions,
    }),
  );
  const site = assertSuccess(
    await renderSkeleton({
      profile: "site",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      packageVersions,
    }),
  );
  const portfolioFiles = indexFiles(portfolio.files);
  const configuration = portfolioFiles.get(
    "apps/web/playwright.visual.config.ts",
  );
  const specification = portfolioFiles.get(
    "apps/web/tests/visual/home-visual.spec.ts",
  );
  const readme = portfolioFiles.get("README.md");
  const rootInstructions = portfolioFiles.get("AGENTS.md");
  const webInstructions = portfolioFiles.get("apps/web/AGENTS.md");

  assert.match(configuration, /http:\/\/127\.0\.0\.1:3101/u);
  assert.match(
    configuration,
    /pnpm exec opennextjs-cloudflare preview -- --ip 127\.0\.0\.1 --port 3101/u,
  );
  assert.match(configuration, /testDir: "\.\/tests\/visual"/u);
  assert.match(configuration, /workers: 1/u);
  assert.match(configuration, /locale: "en-CA"/u);
  assert.match(configuration, /timezoneId: "America\/Toronto"/u);
  assert.match(configuration, /colorScheme: "light"/u);
  assert.match(configuration, /reducedMotion: "reduce"/u);
  assert.match(configuration, /threshold: 0/u);
  assert.match(configuration, /maxDiffPixels: 0/u);
  assert.match(configuration, /animations: "disabled"/u);
  assert.match(configuration, /caret: "hide"/u);
  assert.match(configuration, /scale: "css"/u);
  assert.doesNotMatch(configuration, /PLAYWRIGHT_DEPLOYED_URL|reuseExistingServer: true/u);

  assert.match(specification, /page\.goto\("\/"\)/u);
  assert.match(specification, /getByRole\("main"\)/u);
  assert.match(specification, /getByRole\("heading", \{ level: 1 \}\)/u);
  assert.match(specification, /element\.textContent = normalizedHeroHeading/u);
  assert.match(specification, /width: 1440, height: 900/u);
  assert.match(specification, /width: 320, height: 800/u);
  assert.match(specification, /toHaveScreenshot\("home-desktop\.png"\)/u);
  assert.match(specification, /toHaveScreenshot\("home-mobile\.png"\)/u);
  assert.equal(specification.match(/page\.goto\(/gu)?.length, 1);
  assert.doesNotMatch(specification, /Acme|Portfolio|About|Contact/u);

  assert.match(readme, /pnpm --dir apps\/web run test:visual/u);
  assert.match(readme, /--platform linux\/amd64/u);
  assert.match(readme, /--update-snapshots/u);
  assert.match(readme, /application-owned baselines/iu);
  assert.match(readme, /review the image diff/iu);
  assert.match(readme, /git checkout-index --all --prefix=/u);
  assert.match(readme, /\/source:ro/u);
  assert.match(
    readme,
    /apps\/web\/tests\/visual\/home-visual\.spec\.ts-snapshots:\/baseline-output/u,
  );
  for (const baselineName of [
    "home-desktop-chromium-linux.png",
    "home-mobile-chromium-linux.png",
  ]) {
    assert.ok(readme.includes(baselineName));
  }
  assert.doesNotMatch(readme, /--volume "\$PWD:\/source"/u);
  assert.doesNotMatch(readme, /\/source\/apps\/web\/tests\/visual/u);
  assert.doesNotMatch(readme, /\*\.png/u);
  assert.match(readme, /does not establish visual quality/iu);
  assert.match(readme, /Playwright report and test-result artifacts/iu);
  assert.match(rootInstructions, /visual configuration is managed/iu);
  assert.match(rootInstructions, /visual specifications and baselines are application-owned/iu);
  assert.match(webInstructions, /application-owned visual specifications and baselines/iu);
  assert.match(webInstructions, /does not establish visual quality/iu);

  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
  const portfolioBytes = indexFileBytes(portfolio.files);
  const bookingBytes = indexFileBytes(booking.files);
  const siteBytes = indexFileBytes(site.files);
  for (const path of visualBaselinePaths) {
    const portfolioBaseline = portfolioBytes.get(path);
    const bookingBaseline = bookingBytes.get(path);
    const siteBaseline = siteBytes.get(path);

    assert.deepEqual([...portfolioBaseline.slice(0, 8)], pngSignature);
    assert.deepEqual([...siteBaseline.slice(0, 8)], pngSignature);
    assert.deepEqual(bookingBaseline, portfolioBaseline);
    assert.notDeepEqual(siteBaseline, portfolioBaseline);
  }
});

test("rendered files satisfy every inference probe in their resolved recipes", async () => {
  const core = await import("../dist/index.js");

  for (const profile of ["portfolio", "site"]) {
    const rendered = assertSuccess(
      await core.renderSkeleton({
        profile,
        projectName: "acme-studio",
        displayName: "Acme Studio",
        packageVersions,
      }),
    );
    const reader = core.createInMemoryRepositoryReader(
      Object.fromEntries(
        rendered.files.flatMap(({ path, content }) =>
          visualBaselinePaths.includes(path)
            ? []
            : [[path, decoder.decode(content)]],
        ),
      ),
    );
    const inference = await core.inferRepository({
      reader,
      catalog: rendered.resolved.capabilities,
    });
    const expectedIdentifiers = rendered.resolved.capabilities
      .map(({ identifier }) => identifier)
      .sort();

    assert.equal(inference.state.kind, "missing");
    assert.deepEqual(
      inference.capabilities.map(({ identifier }) => identifier),
      expectedIdentifiers,
    );
    for (const capability of inference.capabilities) {
      assert.equal(capability.category, "probable", capability.identifier);
      assert.ok(capability.probes.length > 0, capability.identifier);
      assert.ok(
        capability.probes.every(({ status }) => status === "present"),
        capability.identifier,
      );
    }
  }

  const selected = assertSuccess(
    await core.renderSkeleton({
      profile: "portfolio",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      bookingCalendly: {
        mode: "popup",
      },
      packageVersions,
    }),
  );
  const reader = core.createInMemoryRepositoryReader(
    Object.fromEntries(
      selected.files.flatMap(({ path, content }) =>
        visualBaselinePaths.includes(path)
          ? []
          : [[path, decoder.decode(content)]],
      ),
    ),
  );
  const inference = await core.inferRepository({
    reader,
    catalog: selected.resolved.capabilities,
  });
  const bookingCalendly = inference.capabilities.find(
    ({ identifier }) => identifier === "booking-calendly",
  );
  assert.notEqual(bookingCalendly, undefined);
  assert.equal(bookingCalendly.category, "probable");
  assert.equal(bookingCalendly.probes.length, 9);
  assert.ok(
    bookingCalendly.probes.every(({ status }) => status === "present"),
  );
});

test("generated global styles expose the approved responsive accessibility tokens", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const rendered = assertSuccess(
    await renderSkeleton({
      profile: "portfolio",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      packageVersions,
    }),
  );
  const files = indexFiles(rendered.files);
  const styles = files.get("apps/web/app/globals.css");
  const postcss = files.get("apps/web/postcss.config.mjs");
  assert.notEqual(styles, undefined);
  assert.notEqual(postcss, undefined);

  assert.match(styles, /^@import "tailwindcss";/u);
  assert.match(styles, /@theme inline/u);
  assert.match(styles, /overflow-wrap:\s*anywhere/u);
  assert.match(styles, /:focus-visible/u);
  assert.match(
    styles,
    /box-shadow:\s*0 0 0 0\.2rem var\(--design-color-canvas\)/u,
  );
  assert.match(styles, /@media \(forced-colors:\s*active\)/u);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)/u);
  assert.deepEqual(
    Object.fromEntries(
      [...styles.matchAll(/--design-color-([a-z-]+):\s*(#[0-9a-f]{6});/giu)].map(
        ([, name, value]) => [name, value.toLowerCase()],
      ),
    ),
    {
      canvas: "#f6f5ef",
      surface: "#ffffff",
      ink: "#17211f",
      muted: "#52605c",
      accent: "#0b6959",
      "accent-hover": "#075346",
      "accent-contrast": "#ffffff",
      focus: "#b45309",
      line: "#c5cfca",
    },
  );
  assert.deepEqual(
    Object.fromEntries(
      [
        ...styles.matchAll(
          /--color-([a-z-]+):\s*var\(--design-color-([a-z-]+)\);/gu,
        ),
      ].map(([, semanticName, designName]) => [semanticName, designName]),
    ),
    {
      canvas: "canvas",
      surface: "surface",
      ink: "ink",
      muted: "muted",
      accent: "accent",
      "accent-hover": "accent-hover",
      "accent-contrast": "accent-contrast",
      focus: "focus",
      line: "line",
    },
  );
  assert.match(postcss, /const postcssConfiguration = \{/u);
  assert.match(postcss, /"@tailwindcss\/postcss": \{\}/u);
  assert.match(postcss, /export default postcssConfiguration;/u);
  assert.doesNotMatch(postcss, /export default \{/u);

  const palette = {
    canvas: "#f6f5ef",
    surface: "#ffffff",
    ink: "#17211f",
    muted: "#52605c",
    accent: "#0b6959",
    accentContrast: "#ffffff",
    focus: "#b45309",
  };
  for (const [foreground, background] of [
    [palette.ink, palette.canvas],
    [palette.muted, palette.canvas],
    [palette.accent, palette.canvas],
    [palette.accentContrast, palette.accent],
    [palette.focus, palette.canvas],
    [palette.ink, palette.surface],
    [palette.muted, palette.surface],
  ]) {
    assert.ok(contrastRatio(foreground, background) >= 4.5);
  }
});

test("display names are inserted as YAML 1.2 data and runtime copy stays externalized", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const displayName = 'Atelier "Nord" — Montréal 👩‍💻';
  const portfolio = assertSuccess(
    await renderSkeleton({
      profile: "portfolio",
      projectName: "atelier-nord",
      displayName,
      packageVersions,
    }),
  );
  const site = assertSuccess(
    await renderSkeleton({
      profile: "site",
      projectName: "atelier-nord",
      displayName,
      packageVersions,
    }),
  );

  assert.deepEqual(
    parseGeneratedYaml(
      portfolio.files,
      "apps/web/content/content.config.yaml",
    ),
    {
      schemaVersion: "1.0.0",
      defaultLocale: "en-CA",
      locales: ["en-CA"],
    },
  );
  assert.deepEqual(
    parseGeneratedYaml(portfolio.files, "apps/web/content/en-CA/site.yaml"),
    {
      metadata: { title: displayName, description: "A focused portfolio." },
      accessibility: { skipToContent: "Skip to content" },
      home: {
        sections: [
          {
            id: "introduction",
            type: "hero",
            variant: "default",
            enabled: true,
            content: {
              heading: displayName,
              summary: "A concise introduction to selected work.",
            },
          },
          {
            id: "approach",
            type: "text",
            variant: "default",
            enabled: true,
            content: {
              heading: "Approach",
              body: "Thoughtful work begins with clear goals and practical decisions.",
            },
          },
          {
            id: "selected-work",
            type: "project-list",
            variant: "default",
            enabled: true,
            content: {
              heading: "Selected work",
              projects: [
                {
                  title: "Example project",
                  summary:
                    "A representative project demonstrating focused delivery.",
                  href: "https://example.com/work/example-project",
                },
              ],
            },
          },
          {
            id: "contact",
            type: "call-to-action",
            variant: "default",
            enabled: true,
            content: {
              heading: "Start a conversation",
              summary:
                "Share the goals and constraints shaping your next project.",
              label: "Send an email",
              href: "mailto:hello@example.com",
            },
          },
        ],
      },
      navigation: [],
    },
  );
  const portfolioContentModule = await loadGeneratedContentModule(
    portfolio.files,
  );
  assert.deepEqual(
    portfolioContentModule.parseMarkdownContent(
      indexFiles(portfolio.files).get(
        "apps/web/content/en-CA/long-form/introduction.md",
      ),
    ),
    {
      frontMatter: {
        title: displayName,
        summary: "A focused introduction.",
      },
      body: "A concise overview of selected work and the approach behind it.",
    },
  );
  assert.deepEqual(
    parseGeneratedYaml(site.files, "apps/web/content/en-CA/site.yaml"),
    {
      metadata: {
        title: displayName,
        description: "A multi-page public website.",
      },
      accessibility: { skipToContent: "Skip to content" },
      home: {
        sections: [
          {
            id: "introduction",
            type: "hero",
            variant: "default",
            enabled: true,
            content: {
              heading: displayName,
              summary: "A clear starting point for this website.",
            },
          },
          {
            id: "welcome",
            type: "text",
            variant: "default",
            enabled: true,
            content: {
              heading: "Welcome",
              body: "Explore the work, background, and ways to connect.",
            },
          },
          {
            id: "contact",
            type: "call-to-action",
            variant: "default",
            enabled: true,
            content: {
              heading: "Get in touch",
              summary: "Start a conversation about your next project.",
              label: "Send an email",
              href: "mailto:hello@example.com",
            },
          },
        ],
      },
      navigation: [
        { href: "/", label: "Home" },
        { href: "/about", label: "About" },
        { href: "/work/featured", label: "Work" },
      ],
    },
  );
  assert.deepEqual(
    parseGeneratedYaml(site.files, "apps/web/content/en-CA/about.yaml"),
    {
      metadata: {
        title: "About",
        description: "Background, working principles, and approach.",
      },
      sections: [
        {
          id: "introduction",
          type: "hero",
          variant: "default",
          enabled: true,
          content: {
            heading: "About",
            summary: "Background and approach.",
          },
        },
        {
          id: "principles",
          type: "text",
          variant: "default",
          enabled: true,
          content: {
            heading: "Working principles",
            body:
              "Clear communication, careful craft, and practical outcomes guide the work.",
          },
        },
      ],
    },
  );

  const visibleCopy = [
    displayName,
    "A focused portfolio.",
    "A concise introduction to selected work.",
    "Thoughtful work begins with clear goals and practical decisions.",
    "A representative project demonstrating focused delivery.",
    "Share the goals and constraints shaping your next project.",
    "A multi-page public website.",
    "A clear starting point for this website.",
    "Explore the work, background, and ways to connect.",
    "Start a conversation about your next project.",
    "Background and approach.",
    "Clear communication, careful craft, and practical outcomes guide the work.",
    "A focused introduction.",
    "A concise overview of selected work and the approach behind it.",
    "A website introduction.",
    "An introduction to this website and the work it presents.",
    "Skip to content",
  ];
  for (const rendered of [portfolio, site]) {
    const files = indexFiles(rendered.files);
    assert.equal(
      [...files.keys()].some(
        (path) => path.startsWith("apps/web/content/") && path.endsWith(".json"),
      ),
      false,
    );
    const executableSource = [...files]
      .filter(
        ([path]) =>
          !path.startsWith("apps/web/tests/") &&
          (path.endsWith(".ts") || path.endsWith(".tsx")),
      )
      .map(([, source]) => source)
      .join("\n");
    for (const copy of visibleCopy) {
      assert.equal(executableSource.includes(copy), false);
    }
  }
});

test("generated content is bundled as text without runtime filesystem access", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const portfolio = assertSuccess(
    await renderSkeleton({
      profile: "portfolio",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      packageVersions,
    }),
  );
  const site = assertSuccess(
    await renderSkeleton({
      profile: "site",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      packageVersions,
    }),
  );
  const portfolioReader = indexFiles(portfolio.files).get(
    "apps/web/src/content/read-content.ts",
  );
  const siteReader = indexFiles(site.files).get(
    "apps/web/src/routing/read-routing-content.ts",
  );
  const contentDeclarations = indexFiles(portfolio.files).get(
    "apps/web/src/content/content-source.d.ts",
  );
  const nextConfiguration = indexFiles(portfolio.files).get(
    "apps/web/next.config.ts",
  );

  for (const source of [portfolioReader, siteReader]) {
    assert.notEqual(source, undefined);
    assert.match(source, /import \w+Source from ".+\.yaml"/u);
    assert.doesNotMatch(source, /node:fs|node:path|readFile|process\.cwd/u);
  }
  assert.notEqual(contentDeclarations, undefined);
  assert.match(contentDeclarations, /declare module "\*\.md"/u);
  assert.match(contentDeclarations, /declare module "\*\.yaml"/u);
  assert.notEqual(nextConfiguration, undefined);
  assert.match(nextConfiguration, /"\*\.\{md,yaml,yml\}"/u);
  assert.match(nextConfiguration, /loaders: \["raw-loader"\]/u);
  assert.match(nextConfiguration, /as: "\*\.js"/u);
  assert.match(
    portfolioReader,
    /from "\.\.\/\.\.\/content\/content\.config\.yaml"/u,
  );
  assert.match(
    portfolioReader,
    /from "\.\.\/\.\.\/content\/en-CA\/long-form\/introduction\.md"/u,
  );
});

test("the emitted YAML parser rejects unsafe syntax and invalid content shapes", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const rendered = assertSuccess(
    await renderSkeleton({
      profile: "site",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      packageVersions,
    }),
  );
  const contentModule = await loadGeneratedContentModule(rendered.files);
  const routingContentModule = await loadGeneratedRoutingContentModule(
    rendered.files,
  );
  const files = indexFiles(rendered.files);
  const configurationSource = files.get("apps/web/content/content.config.yaml");
  const introductionSource = files.get(
    "apps/web/content/en-CA/long-form/introduction.md",
  );
  const siteSource = files.get("apps/web/content/en-CA/site.yaml");
  const aboutSource = files.get("apps/web/content/en-CA/about.yaml");
  assert.notEqual(configurationSource, undefined);
  assert.notEqual(introductionSource, undefined);
  assert.notEqual(siteSource, undefined);
  assert.notEqual(aboutSource, undefined);

  assert.deepEqual(
    contentModule.parseContentConfiguration(
      contentModule.parseYamlContent(configurationSource),
    ),
    {
      schemaVersion: "1.0.0",
      defaultLocale: "en-CA",
      locales: ["en-CA"],
    },
  );
  assert.deepEqual(contentModule.parseMarkdownContent(introductionSource), {
    frontMatter: {
      title: "Acme Studio",
      summary: "A website introduction.",
    },
    body: "An introduction to this website and the work it presents.",
  });
  assert.deepEqual(
    contentModule.parseMarkdownContent(
      "---\r\ntitle: Example\r\nsummary: Summary\r\n---\r\nBody\r\n",
    ),
    {
      frontMatter: { title: "Example", summary: "Summary" },
      body: "Body",
    },
  );

  const siteContent = contentModule.parseSiteContent(
    contentModule.parseYamlContent(siteSource),
  );
  assert.deepEqual(
    siteContent,
    parseGeneratedYaml(rendered.files, "apps/web/content/en-CA/site.yaml"),
  );
  const aboutContent = routingContentModule.parseRoutedPageContent(
    contentModule.parseYamlContent(aboutSource),
  );
  assert.deepEqual(
    aboutContent,
    parseGeneratedYaml(rendered.files, "apps/web/content/en-CA/about.yaml"),
  );

  for (const unsafeYaml of [
    "value: first\nvalue: second\n",
    "value: !unapproved tagged\n",
    "first: &shared value\nsecond: *shared\n",
    "---\nvalue: first\n---\nvalue: second\n",
  ]) {
    assertContentInvalid(() => contentModule.parseYamlContent(unsafeYaml));
  }

  assertContentInvalid(() =>
    contentModule.parseSiteContent({ ...siteContent, extra: true }),
  );
  const siteContentWithoutAccessibility = { ...siteContent };
  delete siteContentWithoutAccessibility.accessibility;
  assertContentInvalid(() =>
    contentModule.parseSiteContent(siteContentWithoutAccessibility),
  );
  for (const accessibility of [
    {},
    { skipToContent: "" },
    { skipToContent: " " },
    { skipToContent: 42 },
    { skipToContent: "Skip\u007fcontent" },
    { skipToContent: "Skip\u0085content" },
    { skipToContent: "Skip", extra: true },
  ]) {
    assertContentInvalid(() =>
      contentModule.parseSiteContent({ ...siteContent, accessibility }),
    );
  }
  assertContentInvalid(() =>
    contentModule.parseSiteContent({
      ...siteContent,
      home: {
        sections: [
          {
            ...siteContent.home.sections[0],
            content: {
              ...siteContent.home.sections[0].content,
              heading: " ",
            },
          },
          ...siteContent.home.sections.slice(1),
        ],
      },
    }),
  );
  assertContentInvalid(() =>
    contentModule.parseSiteContent({
      ...siteContent,
      navigation: [...siteContent.navigation, siteContent.navigation[0]],
    }),
  );
  assertContentInvalid(() =>
    routingContentModule.parseRoutedPageContent({
      ...aboutContent,
      extra: true,
    }),
  );
  assertContentInvalid(() =>
    contentModule.parseContentConfiguration({
      schemaVersion: "1.0.0",
      defaultLocale: "en-CA",
      locales: ["en-CA"],
      extra: true,
    }),
  );
  for (const invalidMarkdown of [
    "title: Missing delimiters\n",
    "---\ntitle: Missing summary\n---\nBody\n",
    "---\ntitle: Example\nsummary: Summary\nextra: true\n---\nBody\n",
    "---\ntitle: Example\nsummary: Summary\n---\n \n",
    "---\ntitle: Example\nsummary: Summary\n---\nUnsafe\u0000body\n",
    '---\ntitle: "\\0"\nsummary: Summary\n---\nBody\n',
    '---\ntitle: Example\nsummary: "\\u007f"\n---\nBody\n',
    "---\ntitle: &title Example\nsummary: *title\n---\nBody\n",
    "---\ntitle: First\ntitle: Second\nsummary: Summary\n---\nBody\n",
  ]) {
    assertContentInvalid(() =>
      contentModule.parseMarkdownContent(invalidMarkdown),
    );
  }
});

test("generated section parsing is bounded, ordered, and link-safe", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const rendered = assertSuccess(
    await renderSkeleton({
      profile: "portfolio",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      packageVersions,
    }),
  );
  const contentModule = await loadGeneratedContentModule(rendered.files);
  const source = indexFiles(rendered.files).get(
    "apps/web/content/en-CA/site.yaml",
  );
  assert.notEqual(source, undefined);
  const siteContent = contentModule.parseSiteContent(
    contentModule.parseYamlContent(source),
  );
  assert.deepEqual(
    siteContent.home.sections.map(({ id, type, enabled }) => ({
      id,
      type,
      enabled,
    })),
    [
      { id: "introduction", type: "hero", enabled: true },
      { id: "approach", type: "text", enabled: true },
      { id: "selected-work", type: "project-list", enabled: true },
      { id: "contact", type: "call-to-action", enabled: true },
    ],
  );

  const [hero, textSection, projectList, callToAction] =
    siteContent.home.sections;
  const withDisabledText = contentModule.parsePageContent({
    sections: [hero, { ...textSection, enabled: false }, projectList, callToAction],
  });
  assert.deepEqual(
    withDisabledText.sections.map(({ id, enabled }) => ({ id, enabled })),
    [
      { id: "introduction", enabled: true },
      { id: "approach", enabled: false },
      { id: "selected-work", enabled: true },
      { id: "contact", enabled: true },
    ],
  );
  const withDisabledLeadingText = contentModule.parsePageContent({
    sections: [
      { ...textSection, enabled: false },
      hero,
      projectList,
      callToAction,
    ],
  });
  assert.deepEqual(
    withDisabledLeadingText.sections.map(({ id, enabled }) => ({ id, enabled })),
    [
      { id: "approach", enabled: false },
      { id: "introduction", enabled: true },
      { id: "selected-work", enabled: true },
      { id: "contact", enabled: true },
    ],
  );

  const safeDestinations = [
    "/work",
    "#selected-work",
    "https://example.com/work",
    "mailto:hello@example.com",
  ];
  for (const href of safeDestinations) {
    assert.deepEqual(
      contentModule.parseSiteContent({
        metadata: { title: "Example", description: "Example description" },
        accessibility: { skipToContent: "Skip to sentinel content" },
        home: { sections: [hero] },
        navigation: [{ href, label: "Destination" }],
      }).navigation,
      [{ href, label: "Destination" }],
    );
  }

  const invalidPages = [
    { sections: [] },
    { sections: [{ ...hero, id: "Introduction" }] },
    { sections: [hero, { ...textSection, id: hero.id }] },
    { sections: [{ ...hero, type: "unknown" }] },
    { sections: [{ ...hero, variant: "split" }] },
    { sections: [{ ...hero, enabled: "yes" }] },
    { sections: [{ ...hero, content: { ...hero.content, extra: true } }] },
    { sections: [{ ...hero, enabled: false }] },
    { sections: [hero, { ...hero, id: "second-introduction" }] },
    { sections: [textSection, hero] },
    {
      sections: [
        hero,
        { ...projectList, content: { ...projectList.content, projects: [] } },
      ],
    },
    {
      sections: [
        hero,
        {
          ...projectList,
          content: {
            ...projectList.content,
            projects: [
              projectList.content.projects[0],
              projectList.content.projects[0],
            ],
          },
        },
      ],
    },
    { sections: [hero], extra: true },
  ];
  for (const invalidPage of invalidPages) {
    assertContentInvalid(() => contentModule.parsePageContent(invalidPage));
  }

  for (const href of [
    "",
    "#",
    " /work",
    "/work ",
    "//example.com/path",
    "/\\example.com/path",
    "/\t/user:secret@example.com/path",
    "/\n/user:secret@example.com/path",
    "/\r/user:secret@example.com/path",
    "http://example.com/path",
    "https://user:secret@example.com/path",
    "javascript:alert(1)",
    "data:text/html,unsafe",
    "file:///private/example",
    "relative/path",
  ]) {
    assertContentInvalid(() =>
      contentModule.parseSiteContent({
        metadata: { title: "Example", description: "Example description" },
        accessibility: { skipToContent: "Skip to sentinel content" },
        home: { sections: [hero] },
        navigation: [{ href, label: "Destination" }],
      }),
    );
    assertContentInvalid(() =>
      contentModule.parsePageContent({
        sections: [
          hero,
          {
            ...projectList,
            content: {
              ...projectList.content,
              projects: [
                { ...projectList.content.projects[0], href },
              ],
            },
          },
        ],
      }),
    );
    assertContentInvalid(() =>
      contentModule.parsePageContent({
        sections: [
          hero,
          {
            ...callToAction,
            content: { ...callToAction.content, href },
          },
        ],
      }),
    );
  }
});

test("a text-only variant reaches the generated component and compiled content contracts", async (context) => {
  const scratch = await mkdtemp(join(tmpdir(), "egeria-section-variant-"));
  context.after(() => rm(scratch, { recursive: true, force: true }));
  for (const path of ["dist", "templates", "package.json"]) {
    await cp(new URL(`../${path}`, import.meta.url), join(scratch, path), { recursive: true });
  }
  await mkdir(join(scratch, "scripts"));
  const compiler = "scripts/compile-content-validation.mjs";
  await cp(new URL(`../${compiler}`, import.meta.url), join(scratch, compiler));
  await symlink(fileURLToPath(new URL("../node_modules", import.meta.url)), join(scratch, "node_modules"), "dir");

  const temporaryBuilder = path => import(pathToFileURL(join(scratch, "dist", path)).href);
  const editTemplate = async (path, before, after) => {
    const file = join(scratch, "templates", path);
    const text = await readFile(file, "utf8");
    const updated = text.replace(before, after);
    assert.notEqual(updated, text, path);
    await writeFile(file, updated);
  };
  const contentPath = "common/apps/web/src/content/content-schema.ts";
  const registryPath = "common/apps/web/src/sections/section-registry.tsx";
  const textDefinition = 'text: Object.freeze({\n    approvedVariants: Object.freeze(["default"] as const),';
  await editTemplate(contentPath, textDefinition, textDefinition.replace('"default"', '"default", "test-accent"'));
  await editTemplate(registryPath,
    /(function TextSection\([\s\S]*?return \(\n    <section)/u,
    '$1 data-test-section-variant={section.variant}');
  const locales = ["en-CA", "fr-CA"];
  for (const locale of locales) {
    await editTemplate(`multilingual/site/apps/web/content/${locale}/localized-content.yaml.template`,
      /(^ +type: text\n +variant: )default/mu, "$1test-accent");
  }

  const { renderSkeleton } = await temporaryBuilder("generation/render-skeleton.js");
  const { files } = assertSuccess(await renderSkeleton({
    profile: "app", projectName: "section-example", displayName: "Section Example",
    multilingual: true, packageVersions,
  }));
  const generated = indexFiles(files);
  const [english, french] = locales.map(locale =>
    parseDocument(generated.get(`apps/web/content/${locale}/localized-content.yaml`)).toJS());
  const page = english.pages.home;
  const site = {
    metadata: english.metadata,
    accessibility: { skipToContent: english.accessibility.skipToContent },
    home: { sections: page.sections },
    navigation: [],
  };
  const content = await loadGeneratedContentModule(files);
  const react = await loadGeneratedSectionModule(files);
  assert.deepEqual(react.sectionRegistry.text.approvedVariants, ["default", "test-accent"]);
  const parsed = content.parseSiteContent(site);
  const textElement = react.SectionComposition({ sections: parsed.home.sections })
    .find(({ props }) => props.section.type === "text");
  assert.equal(textElement.type(textElement.props).props["data-test-section-variant"], "test-accent");
  assertContentInvalid(() => content.parsePageContent({
    sections: [{ ...page.sections[0], variant: "test-accent" }],
  }));

  const compiled = spawnSync(process.execPath, [join(scratch, compiler)], { encoding: "utf8" });
  assert.equal(compiled.status, 0, compiled.stderr);
  const validatorPath = "lifecycle/app-transition-content-validation.js";
  const { loadAppTransitionContentValidators } = await temporaryBuilder(validatorPath);
  const validators = await loadAppTransitionContentValidators();
  assert.equal(validators.parseSite(site).home.sections[1].variant, "test-accent");
  assert.equal(validators.parseRoutedPage(page).sections[1].variant, "test-accent");
  const parsedEnglish = validators.parseLocalized(english, "en-CA", "site");
  const parsedFrench = validators.parseLocalized(french, "fr-CA", "site");
  assert.equal(parsedEnglish.pages.home.sections[1].variant, "test-accent");
  assert.equal(parsedFrench.pages.home.sections[1].variant, "test-accent");
  validators.assertParity(parsedEnglish, parsedFrench, "site");
  french.pages.home.sections[1].variant = "default";
  const differentFrench = validators.parseLocalized(french, "fr-CA", "site");
  assertContentInvalid(() => validators.assertParity(parsedEnglish, differentFrench, "site"));

  const installed = await import(`../dist/${validatorPath}`);
  const installedValidators = await installed.loadAppTransitionContentValidators();
  assertContentInvalid(() => installedValidators.parseSite(site));
});

test("the source-owned registry declares and renders every approved section", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const rendered = assertSuccess(
    await renderSkeleton({
      profile: "portfolio",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      packageVersions,
    }),
  );
  const contentModule = await loadGeneratedContentModule(rendered.files);
  const sectionModule = await loadGeneratedSectionModule(rendered.files);
  const source = indexFiles(rendered.files).get(
    "apps/web/content/en-CA/site.yaml",
  );
  const content = contentModule.parseSiteContent(
    contentModule.parseYamlContent(source),
  );

  assert.deepEqual(Object.keys(sectionModule.sectionRegistry), [
    "hero",
    "text",
    "project-list",
    "call-to-action",
  ]);
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(sectionModule.sectionRegistry).map(([type, entry]) => [
        type,
        {
          type: entry.type,
          contentSchemaVersion: entry.contentSchemaVersion,
          approvedVariants: entry.approvedVariants,
          supportedProfiles: entry.supportedProfiles,
          accessibilityRequirements: entry.accessibilityRequirements,
          analyticsDeclarations: entry.analyticsDeclarations,
          migrationHooks: entry.migrationHooks,
        },
      ]),
    ),
    {
      hero: {
        type: "hero",
        contentSchemaVersion: "1.0.0",
        approvedVariants: ["default"],
        supportedProfiles: ["portfolio", "site", "app"],
        accessibilityRequirements: ["page-heading-level-one"],
        analyticsDeclarations: [],
        migrationHooks: [],
      },
      text: {
        type: "text",
        contentSchemaVersion: "1.0.0",
        approvedVariants: ["default"],
        supportedProfiles: ["portfolio", "site", "app"],
        accessibilityRequirements: ["section-heading-level-two"],
        analyticsDeclarations: [],
        migrationHooks: [],
      },
      "project-list": {
        type: "project-list",
        contentSchemaVersion: "1.0.0",
        approvedVariants: ["default"],
        supportedProfiles: ["portfolio", "site", "app"],
        accessibilityRequirements: [
          "section-heading-level-two",
          "project-list-semantics",
          "descriptive-link-labels",
        ],
        analyticsDeclarations: [],
        migrationHooks: [],
      },
      "call-to-action": {
        type: "call-to-action",
        contentSchemaVersion: "1.0.0",
        approvedVariants: ["default"],
        supportedProfiles: ["portfolio", "site", "app"],
        accessibilityRequirements: [
          "section-heading-level-two",
          "descriptive-link-labels",
        ],
        analyticsDeclarations: [],
        migrationHooks: [],
      },
    },
  );

  const composition = sectionModule.SectionComposition({
    sections: content.home.sections.map((section) =>
      section.type === "text" ? { ...section, enabled: false } : section,
    ),
  });
  assert.deepEqual(
    composition.map(({ type, props, key }) => ({
      component: type,
      id: props.section.id,
      key,
    })),
    [
      {
        component: sectionModule.sectionRegistry.hero.Component,
        id: "introduction",
        key: "introduction",
      },
      {
        component: sectionModule.sectionRegistry["project-list"].Component,
        id: "selected-work",
        key: "selected-work",
      },
      {
        component: sectionModule.sectionRegistry["call-to-action"].Component,
        id: "contact",
        key: "contact",
      },
    ],
  );

  const sentinelSections = contentModule.parsePageContent({
    sections: [
      {
        ...content.home.sections[0],
        content: {
          heading: "Hero heading sentinel",
          summary: "Hero summary sentinel",
        },
      },
      {
        ...content.home.sections[1],
        content: {
          heading: "Text heading sentinel",
          body: "Text body sentinel",
        },
      },
      {
        ...content.home.sections[2],
        content: {
          heading: "Projects heading sentinel",
          projects: [
            {
              title: "Project title sentinel",
              summary: "Project summary sentinel",
              href: "https://example.com/project-sentinel",
            },
          ],
        },
      },
      {
        ...content.home.sections[3],
        content: {
          heading: "Action heading sentinel",
          summary: "Action summary sentinel",
          label: "Action label sentinel",
          href: "mailto:action-sentinel@example.com",
        },
      },
    ],
  }).sections;
  const renderedSections = sentinelSections.map((section) =>
    sectionModule.sectionRegistry[section.type].Component({ section }),
  );
  assert.deepEqual(
    renderedSections.map(describeTestElement),
    [
      {
        type: "header",
        key: null,
        attributes: {
          id: "introduction",
          "aria-labelledby": "introduction--heading",
        },
        children: [
          {
            type: "h1",
            key: null,
            attributes: { id: "introduction--heading" },
            children: ["Hero heading sentinel"],
          },
          {
            type: "p",
            key: null,
            attributes: {},
            children: ["Hero summary sentinel"],
          },
        ],
      },
      {
        type: "section",
        key: null,
        attributes: {
          id: "approach",
          "aria-labelledby": "approach--heading",
        },
        children: [
          {
            type: "h2",
            key: null,
            attributes: { id: "approach--heading" },
            children: ["Text heading sentinel"],
          },
          {
            type: "p",
            key: null,
            attributes: {},
            children: ["Text body sentinel"],
          },
        ],
      },
      {
        type: "section",
        key: null,
        attributes: {
          id: "selected-work",
          "aria-labelledby": "selected-work--heading",
        },
        children: [
          {
            type: "h2",
            key: null,
            attributes: { id: "selected-work--heading" },
            children: ["Projects heading sentinel"],
          },
          {
            type: "ul",
            key: null,
            attributes: {},
            children: [
              {
                type: "li",
                key: "https://example.com/project-sentinel",
                attributes: {},
                children: [
                  {
                    type: "article",
                    key: null,
                    attributes: {},
                    children: [
                      {
                        type: "h3",
                        key: null,
                        attributes: {},
                        children: [
                          {
                            type: "a",
                            key: null,
                            attributes: {
                              href: "https://example.com/project-sentinel",
                            },
                            children: ["Project title sentinel"],
                          },
                        ],
                      },
                      {
                        type: "p",
                        key: null,
                        attributes: {},
                        children: ["Project summary sentinel"],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        type: "section",
        key: null,
        attributes: {
          id: "contact",
          "aria-labelledby": "contact--heading",
        },
        children: [
          {
            type: "h2",
            key: null,
            attributes: { id: "contact--heading" },
            children: ["Action heading sentinel"],
          },
          {
            type: "p",
            key: null,
            attributes: {},
            children: ["Action summary sentinel"],
          },
          {
            type: "a",
            key: null,
            attributes: { href: "mailto:action-sentinel@example.com" },
            children: ["Action label sentinel"],
          },
        ],
      },
    ],
  );

  const collisionProneSections = contentModule.parsePageContent({
    sections: [
      { ...content.home.sections[0], id: "introduction" },
      { ...content.home.sections[1], id: "introduction-heading" },
    ],
  }).sections;
  const collisionProneElements = collisionProneSections.map((section) =>
    sectionModule.sectionRegistry[section.type].Component({ section }),
  );
  const elementIdentifiers = collisionProneElements.flatMap(({ props }) => [
    props.id,
    ...props.children
      .filter(({ props: childProperties }) => childProperties.id !== undefined)
      .map(({ props: childProperties }) => childProperties.id),
  ]);
  assert.deepEqual(elementIdentifiers, [
    "introduction",
    "introduction--heading",
    "introduction-heading",
    "introduction-heading--heading",
  ]);
  assert.equal(new Set(elementIdentifiers).size, elementIdentifiers.length);
  for (const { props } of collisionProneElements) {
    assert.ok(elementIdentifiers.includes(props["aria-labelledby"]));
  }

  for (const section of content.home.sections) {
    assert.deepEqual(
      sectionModule.sectionRegistry[section.type].contentSchema(section.content),
      section.content,
    );
  }
});

test("generated presentation composes skip navigation and responsive section layouts", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const rendered = assertSuccess(
    await renderSkeleton({
      profile: "site",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      packageVersions,
    }),
  );
  const files = indexFiles(rendered.files);
  const contentModule = await loadGeneratedContentModule(rendered.files);
  const sectionModule = await loadGeneratedSectionModule(rendered.files);
  const presentationModule = await loadGeneratedPresentationModule(
    rendered.files,
  );
  const content = contentModule.parseSiteContent(
    contentModule.parseYamlContent(
      files.get("apps/web/content/en-CA/site.yaml"),
    ),
  );
  const bookingChild = { type: "booking", props: {}, key: null };
  const pageTree = presentationModule.ContentPage({
    sections: content.home.sections,
    navigation: [{ href: "/", label: "N" }],
    skipToContent: "S",
    children: bookingChild,
  });

  assert.equal(pageTree.type, Symbol.for("react.fragment"));
  const [skipLink, navigation, main] = pageTree.props.children;
  assert.equal(skipLink.type, "a");
  assert.equal(skipLink.props.href, "#main-content");
  assert.equal(skipLink.props.children, "S");
  assert.match(skipLink.props.className, /focus:translate-y-0/u);
  assert.match(skipLink.props.className, /min-h-11/u);
  assert.match(skipLink.props.className, /min-w-11/u);
  assert.match(skipLink.props.className, /inline-flex/u);
  assert.equal(navigation.type, "nav");
  assert.equal(main.type, "main");
  assert.equal(main.props.id, "main-content");
  assert.equal(main.props.tabIndex, -1);
  const article = main.props.children;
  const [sectionComposition, renderedBookingChild] = article.props.children;
  const navigationList = navigation.props.children;
  const navigationLink = navigationList.props.children[0].props.children;
  assert.match(navigationList.props.className, /flex-wrap/u);
  assert.match(navigationLink.props.className, /min-h-11/u);
  assert.match(navigationLink.props.className, /min-w-11/u);
  assert.match(navigationLink.props.className, /inline-flex/u);
  assert.equal(navigationLink.props.children, "N");
  assert.equal(typeof sectionComposition.type, "function");
  assert.equal(sectionComposition.type(sectionComposition.props).type, "section-composition");
  assert.equal(renderedBookingChild, bookingChild);

  const pageWithoutNavigation = presentationModule.ContentPage({
    sections: content.home.sections,
    navigation: [],
    skipToContent: "Skip to sentinel content",
  });
  assert.equal(pageWithoutNavigation.props.children[0], null);
  assert.equal(pageWithoutNavigation.props.children[1], null);

  const projectList = sectionModule.sectionRegistry["project-list"].Component({
    section: {
      id: "selected-work",
      type: "project-list",
      variant: "default",
      enabled: true,
      content: {
        heading: "Selected work",
        projects: [
          {
            title: "P",
            summary: "Project summary",
            href: "https://example.com/project",
          },
        ],
      },
    },
  });
  const projectListElement = projectList.props.children[1];
  assert.match(projectListElement.props.className, /md:grid-cols-2/u);
  assert.match(
    projectListElement.props.children[0].props.children.props.children[0].props
      .children.props.className,
    /min-h-11/u,
  );
  assert.match(
    projectListElement.props.children[0].props.children.props.children[0].props
      .children.props.className,
    /min-w-11/u,
  );
  assert.match(
    projectListElement.props.children[0].props.children.props.children[0].props
      .children.props.className,
    /inline-flex/u,
  );

  const callToAction = sectionModule.sectionRegistry["call-to-action"].Component({
    section: {
      id: "contact",
      type: "call-to-action",
      variant: "default",
      enabled: true,
      content: {
        heading: "Contact",
        summary: "Start a conversation",
        label: "C",
        href: "mailto:hello@example.com",
      },
    },
  });
  assert.match(callToAction.props.children[2].props.className, /min-h-12/u);
  assert.match(callToAction.props.children[2].props.className, /min-w-11/u);
  assert.match(callToAction.props.children[2].props.className, /inline-flex/u);

  assert.match(
    files.get("apps/web/app/page.tsx"),
    /skipToContent=\{content\.accessibility\.skipToContent\}/u,
  );
  assert.match(
    files.get("apps/web/app/about/page.tsx"),
    /skipToContent=\{accessibility\.skipToContent\}/u,
  );
});

test("Cloudflare imports and types stay in generated configuration boundaries", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const rendered = assertSuccess(
    await renderSkeleton({
      profile: "site",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      bookingCalendly: {
        mode: "popup",
      },
      packageVersions,
    }),
  );
  const approvedConfigurationPaths = new Set([
    "apps/web/next.config.ts",
    "apps/web/open-next.config.ts",
    "apps/web/src/infrastructure/cloudflare/observability-context.ts",
    "apps/web/tests/unit/observability-environment.test.ts",
  ]);

  for (const [path, source] of indexFiles(rendered.files)) {
    if (
      (path.endsWith(".ts") || path.endsWith(".tsx")) &&
      !approvedConfigurationPaths.has(path)
    ) {
      assert.doesNotMatch(
        source,
        /(?:@opennextjs\/cloudflare|@cloudflare\/workers-types|cloudflare:|\b(?:AnalyticsEngineDataset|CloudflareEnv|D1Database|DurableObjectNamespace|Hyperdrive|KVNamespace|Queue|R2Bucket|VectorizeIndex)\b)/,
        path,
      );
    }
  }
});

test("generated presentation remains a pure typed-data boundary", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const rendered = assertSuccess(
    await renderSkeleton({
      profile: "site",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      packageVersions,
    }),
  );
  const presentationSource = indexFiles(rendered.files).get(
    "apps/web/src/presentation/content-page.tsx",
  );
  assert.notEqual(presentationSource, undefined);
  assert.deepEqual(presentationSource.match(/^import .*;$/gm), [
    'import type { ReactNode } from "react";',
    'import type { NavigationItem, PageSection } from "../content/content-schema";',
    'import { SectionComposition } from "../sections/section-registry";',
  ]);
  const registrySource = indexFiles(rendered.files).get(
    "apps/web/src/sections/section-registry.tsx",
  );
  assert.notEqual(registrySource, undefined);
  for (const source of [presentationSource, registrySource]) {
    assert.doesNotMatch(
      source,
      /(?:\b(?:fetch|process|readFile|readFileSync|useEffect|useLayoutEffect|useState)\b|node:|"use client")/,
    );
  }
});

test("profiles remain narrow and exclude later capabilities and surfaces", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const portfolio = assertSuccess(
    await renderSkeleton({
      profile: "portfolio",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      packageVersions,
    }),
  );
  const site = assertSuccess(
    await renderSkeleton({
      profile: "site",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      packageVersions,
    }),
  );

  assert.equal(portfolio.files.some(({ path }) => path.includes("/about")), false);
  assert.equal(site.files.some(({ path }) => path.includes("/about")), true);
  for (const rendered of [portfolio, site]) {
    const paths = rendered.files.map(({ path }) => path).join("\n");
    assert.doesNotMatch(
      paths,
      /(?:apps\/jobs|packages\/|\.egeria|pnpm-lock\.yaml|middleware)/,
    );
    const output = [...indexFiles(rendered.files)]
      .filter(([path]) => /\.(?:ts|tsx|jsonc)$/u.test(path) && !path.includes("/tests/"))
      .map(([, content]) => content)
      .join("\n")
      .toLowerCase();
    for (const marker of [
      "app-foundation",
      "database",
      "d1",
      "queue",
      "resend",
      "better-auth",
      "stripe",
      "web-analytics",
      "cms",
      "contact-submission",
      "totp",
      "passkey",
    ]) {
      assert.doesNotMatch(output, new RegExp(`\\b${marker}\\b`, "u"), marker);
    }
  }
});

test("ownership descriptors cover every generated surface without overlap", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  for (const [profile, expectedCount] of [
    ["portfolio", 133],
    ["site", 149],
  ]) {
    const rendered = assertSuccess(
      await renderSkeleton({
        profile,
        projectName: "acme-studio",
        displayName: "Acme Studio",
        packageVersions,
      }),
    );
    assert.equal(rendered.surfaces.length, expectedCount);
    assert.deepEqual(
      rendered.surfaces.map(({ identifier }) => identifier),
      rendered.surfaces
        .map(({ identifier }) => identifier)
        .toSorted((left, right) => (left < right ? -1 : left > right ? 1 : 0)),
    );

    const expectedCapabilitySurfaces = rendered.resolved.capabilities
      .flatMap(({ managedSurfaces }) => managedSurfaces)
      .toSorted((left, right) =>
        left.identifier < right.identifier
          ? -1
          : left.identifier > right.identifier
            ? 1
            : 0,
      );
    assert.deepEqual(
      rendered.surfaces.filter(({ owner }) => owner.kind === "capability"),
      expectedCapabilitySurfaces,
    );
    assert.equal(
      rendered.surfaces.some(
        ({ identifier }) => identifier === "builder-global-styles",
      ),
      false,
    );
    assert.deepEqual(
      rendered.surfaces.find(
        ({ identifier }) => identifier === "builder-home-route",
      ),
      {
        identifier: "builder-home-route",
        owner: { kind: "builder-kernel" },
        path: "apps/web/app/page.tsx",
        ownership: "application-owned",
        fingerprintTarget: { kind: "file" },
        mergeStrategy: "replace-file",
      },
    );

    const fullFileOwners = new Map();
    for (const surface of rendered.surfaces) {
      if (surface.fingerprintTarget.kind === "file") {
        fullFileOwners.set(
          surface.path,
          (fullFileOwners.get(surface.path) ?? 0) + 1,
        );
      }
    }
    for (const { path } of rendered.files) {
      assert.equal(
        fullFileOwners.get(path) ?? 0,
        path === "apps/web/package.json" ? 0 : 1,
        path,
      );
    }

    const manifestPointers = rendered.surfaces
      .filter(
        ({ path, fingerprintTarget }) =>
          path === "apps/web/package.json" &&
          fingerprintTarget.kind === "json-value",
      )
      .map(({ fingerprintTarget }) => fingerprintTarget.pointer)
      .toSorted();
    assert.deepEqual(manifestPointers, [
      "/dependencies/@egeria-systems~1observability",
      "/dependencies/@opennextjs~1cloudflare",
      "/dependencies/next",
      "/dependencies/react",
      "/dependencies/react-dom",
      "/dependencies/yaml",
      "/devDependencies/@axe-core~1playwright",
      "/devDependencies/@egeria-systems~1standards",
      "/devDependencies/@playwright~1test",
      "/devDependencies/@tailwindcss~1postcss",
      "/devDependencies/@testing-library~1dom",
      "/devDependencies/@testing-library~1jest-dom",
      "/devDependencies/@testing-library~1react",
      "/devDependencies/@testing-library~1user-event",
      "/devDependencies/@types~1node",
      "/devDependencies/@types~1react",
      "/devDependencies/@types~1react-dom",
      "/devDependencies/@vitejs~1plugin-react",
      "/devDependencies/eslint",
      "/devDependencies/eslint-config-next",
      "/devDependencies/jsdom",
      "/devDependencies/postcss",
      "/devDependencies/raw-loader",
      "/devDependencies/tailwindcss",
      "/devDependencies/typescript",
      "/devDependencies/typescript-eslint",
      "/devDependencies/vitest",
      "/devDependencies/wrangler",
      "/name",
      "/private",
      "/scripts/browser:install",
      "/scripts/browser:install:ci",
      "/scripts/build",
      "/scripts/build:cloudflare",
      "/scripts/cf-typegen",
      "/scripts/check:environment",
      "/scripts/check:environment:deployment",
      "/scripts/check:prepared-artifact",
      "/scripts/dev",
      "/scripts/lint",
      "/scripts/preview",
      "/scripts/test",
      "/scripts/test:component",
      "/scripts/test:component:watch",
      "/scripts/test:deployment-contracts",
      "/scripts/test:e2e:deployed",
      "/scripts/test:e2e:dev",
      "/scripts/test:e2e:preview",
      "/scripts/test:transport",
      "/scripts/test:unit",
      "/scripts/test:unit:watch",
      "/scripts/test:visual",
      "/scripts/test:watch",
      "/scripts/typecheck",
      "/type",
      "/version",
    ]);
  }

  const selected = assertSuccess(
    await renderSkeleton({
      profile: "portfolio",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      bookingCalendly: {
        mode: "popup",
      },
      packageVersions,
    }),
  );
  assert.equal(selected.surfaces.length, 142);
  assert.deepEqual(
    selected.surfaces
      .filter(
        ({ owner }) =>
          owner.kind === "capability" &&
          owner.identifier === "booking-calendly",
      )
      .map(({ identifier }) => identifier),
    [
      "booking-calendly-availability-tests",
      "booking-calendly-browser-specification",
      "booking-calendly-client-component",
      "booking-calendly-configuration-tests",
      "booking-calendly-content",
      "booking-calendly-content-reader",
      "booking-calendly-french-content",
      "booking-calendly-operator-guide",
      "booking-calendly-settings",
    ],
  );
});

test("rendering rejects invalid requests with stable existing contract failures", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const invalidRequests = [
    {
      request: {
        profile: "unsupported-profile",
        projectName: "acme-studio",
        displayName: "Acme Studio",
        packageVersions,
      },
      code: "PROFILE_UNKNOWN",
    },
    {
      request: {
        profile: "portfolio",
        projectName: "../escape",
        displayName: "Acme Studio",
        packageVersions,
      },
      code: "CONTRACT_VALIDATION_FAILED",
    },
    {
      request: {
        profile: "portfolio",
        projectName: "acme-studio",
        displayName: "   ",
        packageVersions,
      },
      code: "CONTRACT_VALIDATION_FAILED",
    },
    {
      request: {
        profile: "portfolio",
        projectName: "acme-studio",
        displayName: "Acme Studio",
        packageVersions: { ...packageVersions, standards: "workspace:*" },
      },
      code: "CAPABILITY_PACKAGE_VERSION_INVALID",
    },
  ];

  for (const { request, code } of invalidRequests) {
    const result = await renderSkeleton(request);
    assert.equal(result.ok, false);
    assert.equal(result.issues[0]?.code, code);
    assert.equal(JSON.stringify(result.issues).includes("../escape"), false);
    assert.equal(JSON.stringify(result.issues).includes("workspace:*"), false);
  }
});

test("rendering snapshots validated package versions before asynchronous reads", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const mutablePackageVersions = { ...packageVersions };
  const pendingRender = renderSkeleton({
    profile: "portfolio",
    projectName: "acme-studio",
    displayName: "Acme Studio",
    packageVersions: mutablePackageVersions,
  });

  mutablePackageVersions.standards = "file:../../attacker";
  mutablePackageVersions.observability =
    "https://attacker.invalid/package.tgz";

  const rendered = assertSuccess(await pendingRender);
  const applicationManifest = parseGeneratedJson(
    rendered.files,
    "apps/web/package.json",
  );

  assert.equal(
    applicationManifest.devDependencies["@egeria-systems/standards"],
    packageVersions.standards,
  );
  assert.equal(
    applicationManifest.dependencies["@egeria-systems/observability"],
    packageVersions.observability,
  );
});

test("rendering returns isolated byte arrays and performs no repository write", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const packageRoot = new URL("..", import.meta.url).pathname;
  const before = await snapshotDirectory(join(packageRoot, "templates"));
  const request = {
    profile: "portfolio",
    projectName: "acme-studio",
    displayName: "Acme Studio",
    packageVersions,
  };
  const first = assertSuccess(await renderSkeleton(request));
  const original = snapshotBytes(first.files);
  first.files[0].content[0] = 0;
  const second = assertSuccess(await renderSkeleton(request));

  assert.deepEqual(snapshotBytes(second.files), original);
  assert.deepEqual(await snapshotDirectory(join(packageRoot, "templates")), before);

  const generationSource = (
    await Promise.all(
      ["render-skeleton.ts", "render-template.ts", "template-catalog.ts"].map(
        (name) =>
          readFile(new URL(`../src/generation/${name}`, import.meta.url), "utf8"),
      ),
    )
  ).join("\n");
  assert.equal(
    generationSource.match(/from "node:fs\/promises"/g)?.length,
    1,
  );
  assert.match(
    generationSource,
    /^import \{ readFile \} from "node:fs\/promises";$/m,
  );
  assert.doesNotMatch(
    generationSource.replace(
      'import { readFile } from "node:fs/promises";',
      "",
    ),
    /(?:node:(?:child_process|fs)|\b(?:appendFile|copyFile|cp|createWriteStream|mkdir|mkdtemp|open|rename|rm|writeFile)\s*\()/,
  );
});




const applicationEnvironmentContext = {
  projectSchemaVersion: "2.0.0",
  catalogSnapshot: { standards: "0.9.0", siteRouting: "0.5.0", appFoundation: "0.3.0", deploymentCloudflare: "0.13.0", transactionalEmailResend: "0.2.0" },
  profiles: [
    { identifier: "portfolio", schemaVersion: "1.0.0", recipeVersion: "0.12.0", defaultCapabilities: ["standards", "content-files", "section-composition", "deployment-cloudflare", "observability"] },
    { identifier: "site", schemaVersion: "1.0.0", recipeVersion: "0.13.0", defaultCapabilities: ["standards", "content-files", "section-composition", "deployment-cloudflare", "observability", "site-routing"] },
    { identifier: "app", schemaVersion: "1.0.0", recipeVersion: "0.3.0", defaultCapabilities: ["app-foundation", "site-routing"] },
  ],
};

async function renderApplicationEnvironment(profile, options = {}) {
  const core = await import("../dist/index.js");
  return core.renderSkeleton({ profile, projectName: "environment-example", displayName: "Environment Example", packageVersions: core.verifiedCapabilityPackageVersions, ...options }, applicationEnvironmentContext);
}

test("public README follows the current staged release controls", async () => {
  const core = await import("../dist/index.js");
  const candidate = indexFiles(assertSuccess(await renderApplicationEnvironment("portfolio")).files).get("README.md");
  assert.match(candidate, /APPLICATION_ENVIRONMENT=production NEXT_PUBLIC_SITE_URL=https:\/\/example.com DEPLOY_URL=https:\/\/example.com/u);
  assert.match(candidate, /missing or unverifiable controls refuse deployment/u);
  assert.doesNotMatch(candidate, /PLAYWRIGHT_DEPLOYED_URL/u);
  const current = assertSuccess(await core.renderSkeleton({ profile: "portfolio", projectName: "readme-contract", displayName: "Readme Contract", packageVersions: core.verifiedCapabilityPackageVersions }));
  assert.doesNotMatch(indexFiles(current.files).get("README.md"), /PLAYWRIGHT_DEPLOYED_URL/u);
});

test("fresh jobs require a source revision when Next generates a build ID", async () => {
  const core = await import("../dist/index.js");
  const revision = "a".repeat(40);
  for (const [withJobs, retained] of [[true, false], [true, "public-build"], [true, true], [false, false]]) {
    const context = core.createGenerationRenderingContext(false, false, withJobs, undefined, undefined, retained);
    const rendered = assertSuccess(await core.renderSkeleton({ profile: "app", projectName: "jobs-build",
      displayName: "Jobs build", packageVersions: core.verifiedCapabilityPackageVersions,
      ...(withJobs ? { backgroundJobDelivery: true } : {}) }, context));
    const root = await mkdtemp(join(tmpdir(), "jobs-build-id-"));
    try {
      for (const { path, content } of rendered.files.filter(({ path }) =>
        path === "apps/web/next.config.ts" || path.startsWith("apps/web/src/configuration/"))) {
        const destination = join(root, path);
        await mkdir(join(destination, ".."), { recursive: true });
        await writeFile(destination, content);
      }
      const web = join(root, "apps/web");
      const adapter = join(web, "node_modules/@opennextjs/cloudflare");
      const next = join(web, "node_modules/next");
      await mkdir(adapter, { recursive: true });
      await mkdir(next, { recursive: true });
      await writeFile(join(adapter, "package.json"), JSON.stringify({ type: "module", exports: "./index.js" }));
      await writeFile(join(adapter, "index.js"), "export function initOpenNextCloudflareForDev() {}\n");
      await writeFile(join(next, "package.json"), JSON.stringify({ type: "module" }));
      await writeFile(join(next, "constants.js"), 'export const PHASE_PRODUCTION_BUILD = "phase-production-build";\n');
      const script = 'const { default: config } = await import("./next.config.ts"); const actual = typeof config === "function" ? await config(process.env.TEST_NEXT_PHASE) : config; console.log(JSON.stringify({ buildId: process.env.TEST_BUILD === "1" ? await actual.generateBuildId?.() : undefined }));';
      const invoke = (phase, build, buildRevision) => spawnSync(process.execPath, ["--input-type=module", "-e", script], {
        cwd: web, encoding: "utf8", env: {
          APPLICATION_ENVIRONMENT: "development", TEST_NEXT_PHASE: phase, TEST_BUILD: build ? "1" : "0",
          ...(buildRevision === undefined ? {} : { BUILD_SOURCE_REVISION: buildRevision }),
        },
      });
      const fresh = withJobs && retained === false;
      const missing = invoke("phase-production-build", true);
      assert.equal(missing.status, fresh ? 1 : 0, missing.stderr);
      if (fresh) assert.match(missing.stderr, /APPLICATION_BUILD_INVALID:BUILD_SOURCE_REVISION:missing/u);
      for (const phase of ["phase-production-build", "phase-development-server", "phase-production-server", "phase-export"]) {
        const allowed = invoke(phase, false);
        assert.equal(allowed.status, 0, allowed.stderr);
        assert.deepEqual(JSON.parse(allowed.stdout), {});
      }
      const invalid = invoke("phase-production-build", true, "synthetic-private-invalid-revision");
      assert.equal(invalid.status, 1, invalid.stderr);
      assert.match(invalid.stderr, /APPLICATION_BUILD_INVALID:BUILD_SOURCE_REVISION:invalid/u);
      assert.doesNotMatch(invalid.stderr, /synthetic-private-invalid-revision/u);
      const valid = invoke("phase-production-build", true, revision);
      assert.equal(valid.status, 0, valid.stderr);
      assert.deepEqual(JSON.parse(valid.stdout), { buildId: `egeria-development-${revision}` });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

test("environment build compositions bind target and revision while preserving native public origin replacement", async () => {
  for (const analytics of [false, true]) for (const booking of [false, true]) for (const contact of [false, true]) {
    const rendered = assertSuccess(await renderApplicationEnvironment("portfolio", {
      ...(analytics ? { analytics: { consent: { policy: "explicit-opt-in" }, providers: { googleAnalytics4: true }, operationalIntegrations: {} } } : {}),
      ...(booking ? { bookingCalendly: { mode: "link" } } : {}),
      ...(contact ? { contactFormWeb3Forms: true } : {}),
    }));
    const root = await mkdtemp(join(tmpdir(), "environment-build-composition-"));
    try {
      for (const file of rendered.files.filter(({ path }) => path === "apps/web/next.config.ts" || path === "apps/web/scripts/check-application-environment.mjs" || path.startsWith("apps/web/src/configuration/") || path.startsWith("apps/web/src/integrations/"))) {
        const destination = join(root, file.path); await mkdir(join(destination, ".."), { recursive: true }); await writeFile(destination, file.content);
      }
      const fixture = join(root, "apps/web/node_modules/@opennextjs/cloudflare");
      await mkdir(fixture, { recursive: true });
      await writeFile(join(fixture, "package.json"), JSON.stringify({ type: "module", exports: "./index.js" }));
      await writeFile(join(fixture, "index.js"), "export function initOpenNextCloudflareForDev() {}\n");
      const code = 'const { default: config } = await import("./next.config.ts"); const { resolvePublicBuild, readPublicBuildEnvironment } = await import("./src/configuration/public-build.ts"); console.log(JSON.stringify({ env: config.env, buildId: await config.generateBuildId?.(), resolved: resolvePublicBuild(readPublicBuildEnvironment(), "local") }));';
      const revision = "a".repeat(40);
      const env = { APPLICATION_ENVIRONMENT: "staging", NEXT_PUBLIC_SITE_URL: "https://release.example.test", BUILD_SOURCE_REVISION: revision,
        NEXT_PUBLIC_ANALYTICS_ENABLED: "false", NEXT_PUBLIC_CALENDLY_URL: "https://calendly.com/example/consultation", NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: "00000000-0000-4000-8000-000000000000" };
      const invoke = environment => spawnSync(process.execPath, ["--input-type=module", "-e", code], { cwd: join(root, "apps/web"), env: environment, encoding: "utf8" });
      const result = invoke(env);
      assert.equal(result.status, 0, result.stderr);
      const config = JSON.parse(result.stdout);
      assert.equal(config.buildId, `egeria-staging-${revision}`);
      assert.equal(config.env.NEXT_PUBLIC_APPLICATION_ENVIRONMENT, "staging");
      assert.deepEqual(config.resolved, { ok: true, value: { build: { target: "staging", siteOrigin: "https://release.example.test", buildId: config.buildId }, publicValues: config.env } });
      assert.deepEqual(Object.keys(config.env).sort(), [
        "NEXT_PUBLIC_APPLICATION_ENVIRONMENT",
        ...(contact ? ["NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY"] : []),
        ...(booking ? ["NEXT_PUBLIC_CALENDLY_URL"] : []),
        ...(analytics ? ["NEXT_PUBLIC_ANALYTICS_ENABLED", "NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN", "NEXT_PUBLIC_GA4_MEASUREMENT_ID", "NEXT_PUBLIC_CLARITY_PROJECT_ID", "NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION"] : []),
      ].sort());
      assert.equal(Object.hasOwn(config.env, "NEXT_PUBLIC_SITE_URL"), false);
      for (const invalid of [{ NEXT_PUBLIC_SITE_URL: "" }, { NEXT_PUBLIC_SITE_URL: "https://release.example.test/path" }, { BUILD_SOURCE_REVISION: "not-a-revision" }, { NEXT_DEPLOYMENT_ID: "override" }]) {
        assert.equal(invoke({ ...env, ...invalid }).status, 1, JSON.stringify(invalid));
      }
      const runPreflight = (environment, args) => spawnSync(process.execPath, ["scripts/check-application-environment.mjs", ...args], { cwd: join(root, "apps/web"), env: environment, encoding: "utf8" });
      const invalidUsage = runPreflight(env, ["--local", "--deployment"]);
      assert.equal(invalidUsage.status, 2);
      assert.deepEqual(JSON.parse(invalidUsage.stderr), { code: "APPLICATION_ENVIRONMENT_ARGUMENT_INVALID" });
      const validPreflight = runPreflight(env, ["--local"]);
      assert.equal(validPreflight.status, 0, validPreflight.stderr);
      const failures = [
        ["NEXT_PUBLIC_SITE_URL", "APPLICATION_BUILD_INVALID", "APPLICATION_ENVIRONMENT_INVALID"],
        ...(contact ? [["NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY", "CONTACT_CONFIGURATION_INVALID", "CONTACT_CONFIGURATION_INVALID"]] : []),
        ...(booking ? [["NEXT_PUBLIC_CALENDLY_URL", "BOOKING_CONFIGURATION_INVALID", "BOOKING_CONFIGURATION_INVALID"]] : []),
        ...(analytics ? [["NEXT_PUBLIC_GA4_MEASUREMENT_ID", "ANALYTICS_CONFIGURATION_INVALID", "ANALYTICS_CONFIGURATION_INVALID"]] : []),
      ];
      const rejected = { ...env, ...Object.fromEntries(failures.map(([field]) => [field, "synthetic-private-value"])) };
      for (const [field, nextCode, preflightCode] of failures) {
        const next = invoke(rejected);
        const preflight = runPreflight(rejected, ["--local"]);
        assert.equal(next.status, 1);
        assert.match(next.stderr, new RegExp(`Error: ${nextCode}:${field}:invalid`));
        assert.equal(preflight.status, 1);
        assert.deepEqual(JSON.parse(preflight.stderr), { code: preflightCode, field, reason: "invalid" });
        assert.doesNotMatch(next.stdout + next.stderr + preflight.stdout + preflight.stderr, /synthetic-private-value/u);
        if (env[field] === undefined) delete rejected[field]; else rejected[field] = env[field];
      }
    } finally { await rm(root, { recursive: true, force: true }); }
  }
});

test("document metadata shares the compiled origin and target without imposing production robots", async () => {
  for (const multilingual of [false, true]) for (const contact of [false, true]) for (const analytics of [false, true]) {
    const selected = assertSuccess(await renderApplicationEnvironment("site", {
      ...(multilingual ? { multilingual: true } : {}),
      ...(contact ? { contactFormWeb3Forms: true } : {}),
      ...(analytics ? { analytics: { consent: { policy: "explicit-opt-in" }, providers: { googleAnalytics4: true }, operationalIntegrations: {} } } : {}),
    }));
    assert.match(indexFiles(selected.files).get("apps/web/app/layout.tsx"), /\.\.\.createDocumentMetadata\(readCompiledSiteOrigin\(\), process\.env\.NEXT_PUBLIC_APPLICATION_ENVIRONMENT\)/u, JSON.stringify({ multilingual, contact, analytics }));
  }
  const candidate = assertSuccess(await renderApplicationEnvironment("portfolio"));
  const path = "apps/web/src/configuration/document-metadata.ts";
  const file = candidate.files.find(entry => entry.path === path);
  assert.ok(file, "the managed root metadata helper must be generated");
  const owner = await mkdtemp(join(tmpdir(), "environment-document-metadata-"));
  try {
    const entry = join(owner, "document-metadata.ts");
    await writeFile(entry, file.content);
    const { createDocumentMetadata } = await import(pathToFileURL(entry));
    for (const target of ["development", "staging", "production"]) {
      const result = createDocumentMetadata("https://example.test", target);
      assert.equal(result.metadataBase.href, "https://example.test/");
      if (target === "production") assert.equal(Object.hasOwn(result, "robots"), false);
      else assert.deepEqual(result.robots, { index: false, follow: false });
    }
  } finally {
    await rm(owner, { recursive: true, force: true });
  }
});

test("application environment rendering preserves profile identity and materializes common targets without optional providers", async () => {
  for (const [profile, recipeVersion] of [["portfolio", "0.12.0"], ["site", "0.13.0"], ["app", "0.3.0"]]) {
    for (const multilingual of [false, true]) {
      const rendered = assertSuccess(await renderApplicationEnvironment(profile, multilingual ? { multilingual: true } : {}));
      assert.equal(rendered.project.schemaVersion, "2.0.0");
      assert.equal(rendered.project.recipeVersion, recipeVersion);
      assert.deepEqual(rendered.project.capabilitySettings, {});
      assert.equal(rendered.project.selectedCapabilities.includes("app-foundation"), profile === "app");
      assert.equal(rendered.project.selectedCapabilities.includes("multilingual"), multilingual);
      const files = new Map(rendered.files.map(({ path, content }) => [path, Buffer.from(content).toString("utf8")]));
      assert.ok(files.has("apps/web/src/configuration/application-environment.ts"));
      assert.ok(files.has("docs/environments.md"));
      const manifest = JSON.parse(files.get("apps/web/package.json"));
      assert.equal(manifest.devDependencies.vitest, "5.0.3");
      assert.equal(manifest.dependencies.effect, profile === "app" ? "4.0.0-rc.112" : undefined);
      assert.equal(manifest.scripts["check:environment"], "node scripts/check-application-environment.mjs --local");
      assert.equal(manifest.scripts["check:environment:deployment"], "node scripts/check-application-environment.mjs --deployment");
      assert.equal(JSON.parse(files.get("apps/web/tsconfig.json")).compilerOptions.allowImportingTsExtensions, true);
      assert.doesNotMatch(files.get("apps/web/.env.example"), /WEB3FORMS|CALENDLY|ANALYTICS|RESEND|NEXT_PUBLIC_APPLICATION_ENVIRONMENT/u);
      assert.doesNotMatch(files.get("apps/web/.dev.vars.example"), /RESEND|TRANSACTIONAL_EMAIL|APP_DB/u);
      const generatedPaths = new Set(rendered.files.map(({ path }) => path));
      assert.equal(generatedPaths.size, rendered.files.length);
      assert.ok(rendered.surfaces.some(({ path, owner }) => path === "docs/environments.md" && owner.kind === "builder-kernel"));
    }
  }
});

test("environment routed output removes the competing origin and retains complete route ownership", async () => {
  for (const profile of ["site", "app"]) for (const multilingual of [false, true]) {
    const rendered = assertSuccess(await renderApplicationEnvironment(profile, multilingual ? { multilingual: true } : {}));
    const paths = new Set(rendered.files.map(({ path }) => path));
    assert.equal(paths.has("apps/web/content/en-CA/routing.yaml"), false);
    assert.equal(rendered.surfaces.some(({ path }) => path === "apps/web/content/en-CA/routing.yaml"), false);
    for (const path of ["apps/web/app/robots.ts", "apps/web/app/sitemap.ts", "apps/web/src/routing/read-routing-content.ts", "apps/web/src/routing/routing-content-schema.ts"]) {
      assert.equal(paths.has(path), true, path);
      assert.equal(rendered.surfaces.some(surface => surface.path === path && surface.owner.identifier === "site-routing"), true, path);
    }
    assert.equal(rendered.resolved.capabilities.find(({ identifier }) => identifier === "site-routing").version, "0.5.0");
  }
});

test("environment deployment preflight requires origin and source identity in every service composition", async () => {
  for (const analytics of [false, true]) for (const booking of [false, true]) for (const contact of [false, true]) {
    const rendered = assertSuccess(await renderApplicationEnvironment("portfolio", {
      ...(analytics ? { analytics: { consent: { policy: "explicit-opt-in" }, providers: { googleAnalytics4: true }, operationalIntegrations: {} } } : {}),
      ...(booking ? { bookingCalendly: { mode: "link" } } : {}),
      ...(contact ? { contactFormWeb3Forms: true } : {}),
    }));
    const root = await mkdtemp(join(tmpdir(), "environment-release-preflight-"));
    try {
      for (const file of rendered.files.filter(({ path }) => path.startsWith("apps/web/src/configuration/") || path.startsWith("apps/web/src/integrations/") || path === "apps/web/scripts/check-application-environment.mjs")) {
        const destination = join(root, file.path); await mkdir(join(destination, ".."), { recursive: true }); await writeFile(destination, file.content);
      }
      const env = { APPLICATION_ENVIRONMENT: "staging", NEXT_PUBLIC_SITE_URL: "https://release.example.test", BUILD_SOURCE_REVISION: "a".repeat(40), NEXT_PUBLIC_ANALYTICS_ENABLED: "false", NEXT_PUBLIC_CALENDLY_URL: "https://calendly.com/example/consultation", NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: "00000000-0000-4000-8000-000000000000" };
      const invoke = environment => spawnSync(process.execPath, [join(root, "apps/web/scripts/check-application-environment.mjs"), "--deployment"], { env: environment, encoding: "utf8" });
      for (const missing of ["NEXT_PUBLIC_SITE_URL", "BUILD_SOURCE_REVISION"]) {
        const input = { ...env }; delete input[missing];
        assert.equal(invoke(input).status, 1, missing);
      }
      for (const target of ["staging", "production"]) assert.equal(invoke({ ...env, APPLICATION_ENVIRONMENT: target }).status, 0);
      const refused = invoke({ ...env, NEXT_PUBLIC_SITE_URL: "private-sentinel" });
      assert.equal(refused.status, 1);
      assert.doesNotMatch(refused.stdout + refused.stderr, /private-sentinel/u);
    } finally { await rm(root, { recursive: true, force: true }); }
  }
});

test("application environment generated ignore rules protect actual build and runtime values while tracking examples", async () => {
  const rendered = assertSuccess(await renderApplicationEnvironment("app"));
  const root = await mkdtemp(join(tmpdir(), "application-environment-ignore-"));
  try {
    const ignore = rendered.files.find(({ path }) => path === ".gitignore");
    await writeFile(join(root, ".gitignore"), ignore.content);
    const gitIsolationDirectory = join(root, "git-isolation");
    await mkdir(gitIsolationDirectory);
    const gitEnvironment = {
      PATH: process.env.PATH,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: join(gitIsolationDirectory, "config"),
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "core.excludesFile",
      GIT_CONFIG_VALUE_0: join(gitIsolationDirectory, "ignore"),
      GIT_TEMPLATE_DIR: gitIsolationDirectory,
      GIT_TERMINAL_PROMPT: "0",
    };
    assert.equal(spawnSync("git", ["init", "--quiet", root], { encoding: "utf8", env: gitEnvironment }).status, 0);
    for (const path of ["apps/web/.env.local", "apps/web/.env.production", "apps/web/.dev.vars", "apps/web/.dev.vars.staging"]) {
      assert.equal(spawnSync("git", ["check-ignore", "--no-index", path], { cwd: root, encoding: "utf8", env: gitEnvironment }).status, 0, path);
    }
    for (const path of ["apps/web/.env.example", "apps/web/.dev.vars.example"]) {
      assert.equal(spawnSync("git", ["check-ignore", "--no-index", path], { cwd: root, encoding: "utf8", env: gitEnvironment }).status, 1, path);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("application environment generated preflight rejects unsafe targets without loading or echoing secret values", async () => {
  const rendered = assertSuccess(await renderApplicationEnvironment("portfolio"));
  const files = new Map(rendered.files.map(({ path, content }) => [path, content]));
  const root = await mkdtemp(join(tmpdir(), "application-environment-preflight-"));
  try {
    for (const path of ["apps/web/src/configuration/application-environment.ts", "apps/web/src/configuration/application-build.ts", "apps/web/src/configuration/public-build.ts", "apps/web/src/configuration/site-origin.ts", "apps/web/scripts/check-application-environment.mjs"]) {
      const destination = join(root, path);
      await mkdir(join(destination, ".."), { recursive: true });
      await writeFile(destination, files.get(path));
    }
    const helper = await import(pathToFileURL(join(root, "apps/web/src/configuration/application-environment.ts")));
    for (const [input, want] of [[undefined, "missing"], ["", "missing"], [" ", "invalid"], ["Production", "invalid"], ["private-sentinel", "invalid"], [null, "invalid"], [42, "invalid"]]) {
      assert.deepEqual(helper.parseApplicationEnvironment(input), { ok: false, issue: { field: "APPLICATION_ENVIRONMENT", reason: want } });
    }
    for (const target of ["development", "staging", "production"]) {
      assert.deepEqual(helper.parseApplicationEnvironment(target), { ok: true, value: target });
      assert.deepEqual(helper.validateRuntimeApplicationEnvironment(target, target), { ok: true, value: target });
    }
    assert.deepEqual(helper.resolveBuildApplicationEnvironment({ applicationEnvironment: undefined }, "local"), { ok: true, value: "development" });
    assert.equal(helper.validateRuntimeApplicationEnvironment(undefined, "development").ok, false);
    assert.equal(helper.validateRuntimeApplicationEnvironment("production", "staging").ok, false);
    const script = join(root, "apps/web/scripts/check-application-environment.mjs");
    for (const [args, env, code] of [
      [["--local"], {}, 0], [["--local"], { APPLICATION_ENVIRONMENT: "" }, 0],
      [["--deployment"], {}, 1], [["--deployment"], { APPLICATION_ENVIRONMENT: "development" }, 1],
      [["--deployment"], { APPLICATION_ENVIRONMENT: "staging", NEXT_PUBLIC_SITE_URL: "https://staging.example.test", BUILD_SOURCE_REVISION: "a".repeat(40) }, 0],
      [["--deployment"], { APPLICATION_ENVIRONMENT: "production", NEXT_PUBLIC_APPLICATION_ENVIRONMENT: "production", NEXT_PUBLIC_SITE_URL: "https://production.example.test", BUILD_SOURCE_REVISION: "a".repeat(40) }, 0],
      [["--local"], { APPLICATION_ENVIRONMENT: "private-sentinel" }, 1],
      [["--local"], { APPLICATION_ENVIRONMENT: "staging", NEXT_PUBLIC_APPLICATION_ENVIRONMENT: "production" }, 1],
      [["--deployment"], { NEXT_PUBLIC_APPLICATION_ENVIRONMENT: "staging" }, 1],
      [["--other"], {}, 2], [["--local", "--local"], {}, 2],
    ]) {
      const result = spawnSync(process.execPath, [script, ...args], { encoding: "utf8", env });
      assert.equal(result.status, code, `${JSON.stringify({ args, env })}: ${result.stderr}`);
      assert.doesNotMatch(result.stdout + result.stderr, /private-sentinel/u);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("application environment rendering refuses selection disagreement and mixed contexts", async () => {
  for (const selection of [{ backgroundJobDelivery: true }]) {
    const result = await renderApplicationEnvironment("app", selection);
    assert.equal(result.ok, false);
    assert.equal(result.issues[0].code, "APPLICATION_ENVIRONMENT_CONTEXT_INVALID");
  }
  const core = await import("../dist/index.js");
  const result = await core.renderSkeleton({ profile: "portfolio", projectName: "example", displayName: "Example", packageVersions: core.verifiedCapabilityPackageVersions }, { ...applicationEnvironmentContext, projectSchemaVersion: "1.0.0" });
  assert.equal(result.ok, false);
});

test("environment persistence rendering selects its target configuration while preserving the public package graph", async () => {
  const core = await import("../dist/index.js");
  const request = { profile: "app", projectName: "example", displayName: "Example", applicationPersistence: true, packageVersions: core.verifiedCapabilityPackageVersions };
  const candidate = assertSuccess(await core.renderSkeleton(request, core.createApplicationEnvironmentRenderingContext(true)));
  const historical = assertSuccess(await core.renderSkeleton(request));
  const files = new Map(candidate.files.map(({ path, content }) => [path, new TextDecoder().decode(content)]));
  assert.equal(candidate.project.schemaVersion, "2.0.0");
  assert.ok(candidate.project.selectedCapabilities.includes("application-persistence"));
  const historicalPackage = historical.files.find(({ path }) => path === "apps/web/package.json");
  const expected = JSON.parse(new TextDecoder().decode(historicalPackage.content));
  const actual = JSON.parse(files.get("apps/web/package.json"));
  assert.deepEqual(actual.dependencies, expected.dependencies);
  assert.deepEqual(actual.devDependencies, expected.devDependencies);
  for (const path of ["apps/web/src/configuration/application-database.ts", "apps/web/tests/unit/application-database-environment.test.ts", "docs/application-persistence.md"]) assert.ok(files.has(path), path);
  const config = JSON.parse(files.get("apps/web/wrangler.jsonc"));
  assert.deepEqual([config.vars, config.env.staging.vars, config.env.production.vars], [
    { APPLICATION_ENVIRONMENT: "development", APPLICATION_DATABASE_ENVIRONMENT: "local" },
    { APPLICATION_ENVIRONMENT: "staging", APPLICATION_DATABASE_ENVIRONMENT: "staging" },
    { APPLICATION_ENVIRONMENT: "production", APPLICATION_DATABASE_ENVIRONMENT: "production" },
  ]);
  for (const [selection, context] of [[request, core.createApplicationEnvironmentRenderingContext()], [{ ...request, applicationPersistence: undefined }, core.createApplicationEnvironmentRenderingContext(true)]]) {
    const result = await core.renderSkeleton(selection, context);
    assert.equal(result.ok, false);
    assert.equal(result.issues[0].code, "APPLICATION_ENVIRONMENT_CONTEXT_INVALID");
  }
});

const environmentAnalyticsSettings = {
  consent: { policy: "explicit-opt-in" },
  providers: {
    cloudflareWebAnalytics: true,
    googleAnalytics4: true,
    microsoftClarity: { audience: "not-directed-to-minors" },
  },
  operationalIntegrations: { googleSearchConsole: true, lookerStudio: { connector: "google-analytics-4" } },
};

test("fresh consent rendering and exact installed consent bytes select independently of the Next graph", async () => {
  const core = await import("../dist/index.js");
  const { createVerifiedProjectSnapshot } = await import("../dist/catalog/verified-package-versions.js");
  const paths = [
    "apps/web/src/integrations/analytics/analytics-runtime.ts",
    "apps/web/src/integrations/analytics/analytics-consent.tsx",
    "apps/web/tests/unit/analytics-runtime.test.ts",
    "apps/web/tests/component/analytics-consent.test.tsx",
    "apps/web/tests/e2e/analytics-consent.spec.ts",
  ];
  const templateRoot = new URL("../templates/analytics/application-environments/", import.meta.url);
  const baseline = await Promise.all(paths.map(path => readFile(new URL(path, templateRoot))));
  for (const profile of ["portfolio", "site", "app"]) {
    for (const multilingual of [false, true]) {
      for (const retainedNext of [undefined, "16.4.1"]) {
        const request = { profile, projectName: "consent-rendering", displayName: "Consent rendering",
          packageVersions: core.verifiedCapabilityPackageVersions, analytics: analyticsSettings, ...(multilingual ? { multilingual: true } : {}) };
        const currentContext = core.createApplicationEnvironmentRenderingContext(false, false, false, retainedNext);
        const priorContext = core.createApplicationEnvironmentRenderingContext(false, false, false, retainedNext, true);
        const current = assertSuccess(await core.renderSkeleton(request, currentContext));
        const prior = assertSuccess(await core.renderSkeleton(request, priorContext));
        assert.deepEqual(prior.files.map(({ path }) => path), current.files.map(({ path }) => path));
        assert.deepEqual(prior.surfaces, current.surfaces);
        const next = parseGeneratedJson(current.files, "apps/web/package.json").dependencies.next;
        assert.equal(next, retainedNext ?? "16.4.5");
        const currentFiles = new Map(current.files.map(({ path, content }) => [path, Buffer.from(content)]));
        const priorFiles = new Map(prior.files.map(({ path, content }) => [path, Buffer.from(content)]));
        assert.deepEqual([...currentFiles.keys()].filter(path => !currentFiles.get(path).equals(priorFiles.get(path))).sort(), [...paths].sort());
        for (const [index, path] of paths.entries()) assert.deepEqual(priorFiles.get(path), baseline[index]);
        const priorState = renderingState(core, prior);
        const currentState = renderingState(core, current);
        assert.equal(assertSuccess(createVerifiedProjectSnapshot(prior.project, priorState)).renderingContext.retainAnalyticsConsent, true);
        assert.equal(assertSuccess(createVerifiedProjectSnapshot(current.project, currentState)).renderingContext.retainAnalyticsConsent, undefined);
        const updated = currentState.managedSurfaces.find(({ path }) => path === paths[0]);
        const mixed = { ...priorState, managedSurfaces: priorState.managedSurfaces.map(surface => surface.path === paths[0] ? updated : surface) };
        assert.equal(createVerifiedProjectSnapshot(prior.project, mixed).ok, false);
        const { analytics, ...omittedRequest } = request;
        const omitted = assertSuccess(await core.renderSkeleton(omittedRequest, currentContext));
        assert.deepEqual(assertSuccess(await core.renderSkeleton(omittedRequest, priorContext)).files, omitted.files);
        assert.ok(paths.every(path => !omitted.files.some(file => file.path === path)));
      }
    }
  }
});

test("environment analytics rendering composes every profile with selection-only controls and owned configuration", async () => {
  for (const profile of ["portfolio", "site", "app"]) {
    for (let selection = 0; selection < 8; selection += 1) {
      const rendered = assertSuccess(await renderApplicationEnvironment(profile, {
        analytics: environmentAnalyticsSettings,
        ...(selection & 1 ? { contactFormWeb3Forms: true } : {}),
        ...(selection & 2 ? { bookingCalendly: { mode: "popup" } } : {}),
        ...(selection & 4 ? { multilingual: true } : {}),
      }));
      assert.deepEqual(rendered.project.capabilitySettings.analytics, environmentAnalyticsSettings);
      assert.equal(rendered.resolved.capabilities.find(({ identifier }) => identifier === "analytics")?.version, "0.2.0");
      assert.equal(rendered.surfaces.filter(({ owner }) => owner.kind === "capability" && owner.identifier === "analytics").length, 17);
      const files = new Map(rendered.files.map(({ path, content }) => [path, Buffer.from(content).toString("utf8")]));
      assert.equal(files.size, rendered.files.length);
      assert.ok(files.has("apps/web/src/integrations/analytics/analytics-configuration.ts"));
      assert.ok(files.has("apps/web/tests/unit/analytics-configuration.test.ts"));
      for (const name of ["CLOUDFLARE_WEB_ANALYTICS_TOKEN", "GA4_MEASUREMENT_ID", "CLARITY_PROJECT_ID", "GOOGLE_SITE_VERIFICATION"]) {
        assert.match(files.get("apps/web/.env.example"), new RegExp(`^NEXT_PUBLIC_${name}=$`, "mu"));
      }
      assert.match(files.get("apps/web/.env.example"), /^NEXT_PUBLIC_ANALYTICS_ENABLED=false$/mu);
      assert.equal(files.get("apps/web/.env.example").includes("NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY="), Boolean(selection & 1));
      assert.equal(files.get("apps/web/.env.example").includes("NEXT_PUBLIC_CALENDLY_URL="), Boolean(selection & 2));
      assert.doesNotMatch(files.get("apps/web/.dev.vars.example"), /ANALYTICS|MEASUREMENT|CLARITY|VERIFICATION/u);
    }
  }
});




test("fresh security declarations match their locked Next across supported dependency families", async () => {
  const core = await import("../dist/index.js");
  const { resolveRecipeLockfileVersion } = await import("../dist/generation/recipe-lockfiles.js");
  for (const profile of ["portfolio", "site", "app"]) {
    for (const options of [{}, { transactionalEmailResend: true }, { backgroundJobDelivery: true }, ...(profile === "app" ? [{ applicationPersistence: true }, { applicationPersistence: true, transactionalEmailResend: true }, { applicationPersistence: true, backgroundJobDelivery: true }] : [])]) {
      const rendered = assertSuccess(await core.renderSkeleton({ profile, projectName: "declared-next", displayName: "Declared Next", packageVersions: core.verifiedCapabilityPackageVersions, ...options }));
      const manifest = parseGeneratedJson(rendered.files, "apps/web/package.json");
      assert.equal(manifest.dependencies.next, "16.4.5");
      const lock = resolveRecipeLockfileVersion(rendered.project, manifest);
      assert.ok(lock);
      for (const version of ["16.3.1", "16.3.4", "^16.4.5", "99.0.0"]) {
        assert.equal(resolveRecipeLockfileVersion(rendered.project, { ...manifest, dependencies: { ...manifest.dependencies, next: version } }), undefined);
      }
    }
  }
});

test("historical installed controls refuse instead of selecting fresh generation", async () => {
  const { createVerifiedProjectSnapshot } = await import("../dist/catalog/verified-package-versions.js");
  for (const fixture of ["portfolio-0.11.7", "portfolio-email-0.11.7", "site-0.12.7", "app-0.2.7", "app-persistence-0.2.7"]) {
    const source = new URL(`../../../fixtures/generated/${fixture}/`, import.meta.url);
    const project = parseDocument(await readFile(new URL(".egeria/project.yaml", source), "utf8")).toJS();
    const state = JSON.parse(await readFile(new URL(".egeria/state.json", source), "utf8"));
    assert.equal(createVerifiedProjectSnapshot(project, state).ok, false);
  }
});


test("security dependency policy shares exact reviewed patches with environment candidates", async t => {
  const core = await import("../dist/index.js");
  for (const profile of ["portfolio", "site", "app"]) {
    const request = { profile, projectName: "security-policy", displayName: "Security Policy", packageVersions: core.verifiedCapabilityPackageVersions };
    const current = assertSuccess(await core.renderSkeleton(request));
    const candidate = assertSuccess(await core.renderSkeleton(request, core.createApplicationEnvironmentRenderingContext()));
    const policy = parseGeneratedYaml(current.files, "pnpm-workspace.yaml");
    await t.test(profile + " compatible security closure", () => {
      assert.deepEqual({
        fastUri: policy.overrides["fast-uri@"],
        bodyParser: policy.overrides["body-parser@"],
        undici: policy.overrides["undici@"],
        miniflareUndici: policy.overrides["miniflare>undici"],
        jsdomUndici: policy.overrides["jsdom>undici"],
        qs: policy.overrides["qs@"],
      }, { fastUri: "3.1.9", bodyParser: "2.4.0", undici: "6.29.1", miniflareUndici: "7.30.1", jsdomUndici: "8.12.2", qs: "6.16.1" });
      for (const obsolete of ["qs@6.16.0", "undici@7.29.1", "undici@8.10.2"]) {
        assert.equal(policy.minimumReleaseAgeExclude.includes(obsolete), false);
      }
    });
    await t.test(profile + " exact package manager", () => {
      const rootManifest = parseGeneratedJson(current.files, "package.json");
      assert.equal(rootManifest.packageManager, "pnpm@11.28.1");
      assert.equal(rootManifest.engines.pnpm, "11.28.1");
    });
    assert.equal(policy.overrides["next@16.3.0"], undefined);
    assert.equal(policy.overrides["next@>=16.2.0 <16.4.5"], "16.4.5");
    assert.equal(policy.overrides["brace-expansion@>=1.0.0 <1.1.21"], "1.1.21");
    assert.equal(policy.overrides["brace-expansion@>=2.0.0 <2.1.7"], "2.1.7");
    assert.equal(policy.overrides["brace-expansion@>=5.0.0 <5.0.12"], "5.0.12");
    assert.equal(policy.overrides["@node-minify/core@9.0.2>glob"], "14.0.3");
    assert.equal(policy.overrides["@opennextjs/cloudflare@1.20.12>glob"], "14.0.3");
    assert.equal(policy.overrides["minimatch@>=7.0.0 <11.0.4"], "11.0.4");
    assert.deepEqual(policy, parseGeneratedYaml(candidate.files, "pnpm-workspace.yaml"));
    assert.equal(policy.minimumReleaseAge, 1440);
    assert.equal(policy.resolutionMode, "time-based");
    assert.equal(current.project.schemaVersion, "2.0.0");
    assert.equal(candidate.project.schemaVersion, "2.0.0");
  }
});


async function withEnvironmentAnalyticsNextConfiguration(selection, analytics, check) {
  const rendered = assertSuccess(await renderApplicationEnvironment("site", {
    ...(analytics ? { analytics } : {}),
    ...(selection & 1 ? { contactFormWeb3Forms: true } : {}),
    ...(selection & 2 ? { bookingCalendly: { mode: "popup" } } : {}),
  }));
  const root = await mkdtemp(join(tmpdir(), "analytics-next-configuration-"));
  try {
    for (const file of rendered.files.filter(({ path }) => path === "apps/web/next.config.ts" || /(?:application-environment|application-build|public-build|site-origin|booking-settings|contact-settings|analytics-configuration|analytics-settings)\.ts$/u.test(path))) {
      const destination = join(root, file.path);
      await mkdir(join(destination, ".."), { recursive: true });
      await writeFile(destination, file.content);
    }
    await writeFile(join(root, "package.json"), JSON.stringify({ type: "module" }));
    const platform = join(root, "node_modules/@opennextjs/cloudflare");
    await mkdir(platform, { recursive: true });
    await writeFile(join(platform, "package.json"), JSON.stringify({ type: "module", exports: "./index.js" }));
    await writeFile(join(platform, "index.js"), "export function initOpenNextCloudflareForDev() { globalThis.platformInitializations += 1; }\n");
    const runner = join(root, "apps/web/check-next.mjs");
    await writeFile(runner, `
globalThis.platformInitializations = 0;
try {
  if (process.argv[2] === "reader") {
    const { readCompiledAnalyticsConfiguration } = await import("./src/integrations/analytics/analytics-configuration.ts");
    const { analyticsSettings } = await import("./src/integrations/analytics/analytics-settings.ts");
    console.log(JSON.stringify(readCompiledAnalyticsConfiguration(analyticsSettings)));
  } else {
    const { default: configuration } = await import("./next.config.ts");
    console.log(JSON.stringify({ env: configuration.env, siteUrl: process.env.NEXT_PUBLIC_SITE_URL, initializations: globalThis.platformInitializations }));
  }
} catch (error) {
  console.log(JSON.stringify({ error: error.message, initializations: globalThis.platformInitializations }));
  process.exitCode = 1;
}
`);
    const invoke = (overrides = {}, mode = "next") => {
      const result = spawnSync(process.execPath, [runner, mode], { encoding: "utf8", env: {
        APPLICATION_ENVIRONMENT: "staging",
        NEXT_PUBLIC_ANALYTICS_ENABLED: "true",
        NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN: "0123456789abcdef0123456789abcdef",
        NEXT_PUBLIC_GA4_MEASUREMENT_ID: "G-TEST123456",
        NEXT_PUBLIC_CLARITY_PROJECT_ID: "clarity123",
        NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: "synthetic-verification-token",
        NEXT_PUBLIC_SITE_URL: "https://qa.analytics-test.invalid",
        NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: "00000000-0000-4000-8000-000000000001",
        NEXT_PUBLIC_CALENDLY_URL: "https://calendly.com/synthetic-nonproduction/intro",
        ...overrides,
      } });
      assert.doesNotMatch(result.stdout + result.stderr, /private-sentinel/u);
      assert.notEqual(result.stdout.trim(), "", result.stderr);
      return { status: result.status, value: JSON.parse(result.stdout), stderr: result.stderr };
    };
    await check(invoke);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("environment analytics Next configuration preserves the common origin across independent selections", async (context) => {
  const selections = [
    { providers: { googleAnalytics4: true }, operationalIntegrations: {} },
    { providers: { cloudflareWebAnalytics: true }, operationalIntegrations: {} },
    { providers: {}, operationalIntegrations: { googleSearchConsole: true } },
    environmentAnalyticsSettings,
    undefined,
  ];
  for (const composition of [0, 1, 2, 3]) {
    await context.test(`contact=${Boolean(composition & 1)} booking=${Boolean(composition & 2)}`, async () => {
      for (const selected of selections) {
        const analytics = selected ? { consent: { policy: "explicit-opt-in" }, ...selected } : undefined;
        await withEnvironmentAnalyticsNextConfiguration(composition, analytics, async (invoke) => {
          for (const target of composition === 0 ? ["development", "staging", "production"] : ["staging"]) {
            for (const enabled of ["false", "true"]) {
              const result = invoke({ APPLICATION_ENVIRONMENT: target, NEXT_PUBLIC_ANALYTICS_ENABLED: enabled });
              assert.equal(result.status, 0, result.stderr);
              assert.equal(result.value.initializations, 1);
              assert.equal(result.value.siteUrl, "https://qa.analytics-test.invalid");
              assert.equal(Object.hasOwn(result.value.env, "NEXT_PUBLIC_SITE_URL"), false, "Analytics must leave the common origin to native public environment compilation");
              assert.equal(result.value.env.NEXT_PUBLIC_APPLICATION_ENVIRONMENT, target);
              if (analytics) {
                assert.equal(result.value.env.NEXT_PUBLIC_ANALYTICS_ENABLED, enabled);
                assert.equal(result.value.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID, selected.providers.googleAnalytics4 ? "G-TEST123456" : "");
                assert.equal(result.value.env.NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN, selected.providers.cloudflareWebAnalytics ? "0123456789abcdef0123456789abcdef" : "");
                assert.equal(result.value.env.NEXT_PUBLIC_CLARITY_PROJECT_ID, selected.providers.microsoftClarity ? "clarity123" : "");
                assert.equal(result.value.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION, selected.operationalIntegrations.googleSearchConsole && target === "production" ? "synthetic-verification-token" : "");
              }
              if (composition & 1) assert.equal(result.value.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY, "00000000-0000-4000-8000-000000000001");
              if (composition & 2) assert.equal(result.value.env.NEXT_PUBLIC_CALENDLY_URL, "https://calendly.com/synthetic-nonproduction/intro");
            }
          }
        });
      }
    });
  }
});

test("environment analytics Next configuration retains Clarity origin validation and normalization", async () => {
  for (const composition of [0, 1, 2, 3]) {
    await withEnvironmentAnalyticsNextConfiguration(composition, environmentAnalyticsSettings, async (invoke) => {
      for (const target of ["staging", "production"]) {
        const missing = invoke({ APPLICATION_ENVIRONMENT: target, NEXT_PUBLIC_SITE_URL: "" });
        assert.equal(missing.status, 1);
        assert.deepEqual(missing.value, { error: "APPLICATION_BUILD_INVALID:NEXT_PUBLIC_SITE_URL:missing", initializations: 0 });
        assert.equal(invoke({ APPLICATION_ENVIRONMENT: target, NEXT_PUBLIC_ANALYTICS_ENABLED: "false", NEXT_PUBLIC_SITE_URL: "" }).status, 1);
      }
      for (const enabled of ["false", "true"]) {
        const malformed = invoke({ NEXT_PUBLIC_ANALYTICS_ENABLED: enabled, NEXT_PUBLIC_SITE_URL: "https://qa.analytics-test.invalid/private-sentinel" });
        assert.equal(malformed.status, 1);
        assert.deepEqual(malformed.value, { error: "APPLICATION_BUILD_INVALID:NEXT_PUBLIC_SITE_URL:invalid", initializations: 0 });
      }
      for (const [target, siteUrl, expectedOrigin] of [
        ["staging", "https://qa.analytics-test.invalid:443/", "https://qa.analytics-test.invalid"],
        ["development", "http://localhost:3000", "http://localhost:3000"],
      ]) {
        const result = invoke({ APPLICATION_ENVIRONMENT: target, NEXT_PUBLIC_SITE_URL: siteUrl });
        assert.equal(result.status, 0);
        assert.equal(result.value.siteUrl, siteUrl);
        const reader = invoke({ APPLICATION_ENVIRONMENT: target, NEXT_PUBLIC_APPLICATION_ENVIRONMENT: target, NEXT_PUBLIC_SITE_URL: siteUrl }, "reader");
        assert.equal(reader.status, 0);
        assert.equal(reader.value.ok, true);
        assert.equal(reader.value.configuration.siteOrigin, expectedOrigin);
      }
      const unavailable = invoke({ NEXT_PUBLIC_APPLICATION_ENVIRONMENT: "staging", NEXT_PUBLIC_ANALYTICS_ENABLED: "false", NEXT_PUBLIC_SITE_URL: "" }, "reader");
      assert.equal(unavailable.value.ok, true);
      assert.equal(unavailable.value.configuration.collectionAvailable, false);
      assert.deepEqual(unavailable.value.configuration.missingFields, ["NEXT_PUBLIC_SITE_URL"]);
    });
  }
  await withEnvironmentAnalyticsNextConfiguration(0, { consent: { policy: "explicit-opt-in" }, providers: { googleAnalytics4: true }, operationalIntegrations: {} }, async (invoke) => {
    const result = invoke({ NEXT_PUBLIC_SITE_URL: "not-an-origin", NEXT_PUBLIC_ANALYTICS_ENABLED: "TRUE" });
    assert.equal(result.status, 1);
    assert.deepEqual(result.value, { error: "APPLICATION_BUILD_INVALID:NEXT_PUBLIC_SITE_URL:invalid", initializations: 0 });
    const reader = invoke({ NEXT_PUBLIC_APPLICATION_ENVIRONMENT: "staging", NEXT_PUBLIC_SITE_URL: "not-an-origin", NEXT_PUBLIC_ANALYTICS_ENABLED: "TRUE" }, "reader");
    assert.equal(reader.value.ok, true);
    assert.equal(reader.value.configuration.collectionEnabled, false);
    assert.equal(reader.value.configuration.siteOrigin, undefined);
  });
});

test("environment analytics Next configuration refuses invalid inputs before platform initialization", async () => {
  for (const composition of [0, 1, 2, 3]) {
    await withEnvironmentAnalyticsNextConfiguration(composition, environmentAnalyticsSettings, async (invoke) => {
      const refuse = (overrides, error) => {
        const result = invoke(overrides);
        assert.equal(result.status, 1);
        assert.deepEqual(result.value, { error, initializations: 0 });
      };
      refuse({ NEXT_PUBLIC_APPLICATION_ENVIRONMENT: "production", NEXT_PUBLIC_GA4_MEASUREMENT_ID: "private-sentinel" }, "APPLICATION_BUILD_INVALID:NEXT_PUBLIC_APPLICATION_ENVIRONMENT:mismatch");
      if (composition & 1) refuse({ NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: "", NEXT_PUBLIC_CALENDLY_URL: "private-sentinel", NEXT_PUBLIC_GA4_MEASUREMENT_ID: "private-sentinel" }, "CONTACT_CONFIGURATION_INVALID:NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY:missing");
      if (composition & 2) refuse({ NEXT_PUBLIC_CALENDLY_URL: "", NEXT_PUBLIC_GA4_MEASUREMENT_ID: "private-sentinel" }, "BOOKING_CONFIGURATION_INVALID:NEXT_PUBLIC_CALENDLY_URL:missing");
      refuse({ NEXT_PUBLIC_ANALYTICS_ENABLED: "false", NEXT_PUBLIC_GA4_MEASUREMENT_ID: "private-sentinel" }, "ANALYTICS_CONFIGURATION_INVALID:NEXT_PUBLIC_GA4_MEASUREMENT_ID:invalid");
    });
  }
});

test("environment booking rendering preserves independent selections and mode-only controls", async () => {
  for (const profile of ["portfolio", "site", "app"]) {
    for (const mode of ["link", "inline", "popup"]) {
      for (const composed of [false, true]) {
        const rendered = assertSuccess(await renderApplicationEnvironment(profile, {
          bookingCalendly: { mode }, ...(composed ? { multilingual: true, contactFormWeb3Forms: true } : {}),
        }));
        assert.deepEqual(rendered.project.capabilitySettings, { "booking-calendly": { mode } });
        assert.equal(rendered.project.selectedCapabilities.includes("contact-form-web3forms"), composed);
        assert.equal(rendered.project.selectedCapabilities.includes("multilingual"), composed);
        assert.equal(rendered.project.selectedCapabilities.includes("app-foundation"), profile === "app");
        const files = new Map(rendered.files.map(({ path, content }) => [path, Buffer.from(content).toString("utf8")]));
        assert.equal(new Set(files.keys()).size, rendered.files.length);
        assert.ok(files.has("docs/booking-calendly.md"));
        assert.ok(files.has("apps/web/content/fr-CA/booking-calendly.yaml"));
        assert.match(files.get("apps/web/.env.example"), /^NEXT_PUBLIC_CALENDLY_URL=$/mu);
        assert.equal(files.get("apps/web/.env.example").includes("NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY="), composed);
        assert.doesNotMatch(files.get("apps/web/.dev.vars.example"), /CALENDLY|WEB3FORMS/u);
        assert.equal(rendered.surfaces.filter(({ owner }) => owner.kind === "capability" && owner.identifier === "booking-calendly").length, 9);
      }
    }
  }
});


test("environment booking validates generated destinations before process effects without exposing input", async () => {
  const destinationA = "https://calendly.com/synthetic-nonproduction/intro";
  const destinationB = "https://www.calendly.com:443/synthetic-production/intro";
  for (const contact of [false, true]) {
    const rendered = assertSuccess(await renderApplicationEnvironment("portfolio", { bookingCalendly: { mode: "popup" }, ...(contact ? { contactFormWeb3Forms: true } : {}) }));
    const root = await mkdtemp(join(tmpdir(), "booking-environment-configuration-"));
    try {
      for (const file of rendered.files.filter(({ path }) => path.endsWith("application-environment.ts") || path.endsWith("application-build.ts") || path.endsWith("public-build.ts") || path.endsWith("site-origin.ts") || path.endsWith("booking-settings.ts") || path.endsWith("contact-settings.ts") || path.endsWith("check-application-environment.mjs"))) {
        const destination = join(root, file.path);
        await mkdir(join(destination, ".."), { recursive: true });
        await writeFile(destination, file.content);
      }
      const helper = await import(pathToFileURL(join(root, "apps/web/src/integrations/booking-calendly/booking-settings.ts")));
      for (const target of ["development", "staging", "production"]) {
        for (const value of [undefined, ""]) {
          assert.deepEqual(helper.resolveBookingDestination(value, target), target === "development"
            ? { ok: true, destination: undefined }
            : { ok: false, issue: { field: "NEXT_PUBLIC_CALENDLY_URL", reason: "missing" } });
        }
        for (const value of [destinationA, destinationB]) assert.deepEqual(helper.resolveBookingDestination(value, target), { ok: true, destination: value });
        for (const value of [null, 7, false, {}, " ", "http://calendly.com/a", "https://calendly.com/", "https://other.test/a", "https://calendly.com.other.test/a", "https://private-sentinel@calendly.com/a", `${destinationA}?private-sentinel`, `${destinationA}#private-sentinel`, `${destinationA} `, "https://calendly.com:444/a", `https://calendly.com/${"a".repeat(2048)}`]) {
          assert.deepEqual(helper.resolveBookingDestination(value, target), { ok: false, issue: { field: "NEXT_PUBLIC_CALENDLY_URL", reason: "invalid" } });
        }
      }
      const script = join(root, "apps/web/scripts/check-application-environment.mjs");
      for (const target of ["development", "staging", "production"]) {
        for (const value of ["", "private-sentinel", destinationA]) {
          const result = spawnSync(process.execPath, [script, target === "development" ? "--local" : "--deployment"], { encoding: "utf8", env: {
            APPLICATION_ENVIRONMENT: target, NEXT_PUBLIC_SITE_URL: "https://booking.example.test", BUILD_SOURCE_REVISION: "a".repeat(40), NEXT_PUBLIC_CALENDLY_URL: value,
            ...(contact ? { NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: "00000000-0000-4000-8000-000000000001" } : {}),
          } });
          assert.equal(result.status, value === destinationA || (value === "" && target === "development") ? 0 : 1, result.stderr);
          assert.doesNotMatch(result.stdout + result.stderr, /private-sentinel/u);
          if (result.status !== 0) assert.match(result.stderr, /BOOKING_CONFIGURATION_INVALID/u);
        }
      }
      const conflict = spawnSync(process.execPath, [script, "--local"], { encoding: "utf8", env: {
        APPLICATION_ENVIRONMENT: "staging", NEXT_PUBLIC_APPLICATION_ENVIRONMENT: "production", NEXT_PUBLIC_CALENDLY_URL: "private-sentinel",
      } });
      assert.equal(conflict.status, 1);
      assert.match(conflict.stderr, /APPLICATION_ENVIRONMENT_INVALID/u);
      assert.doesNotMatch(conflict.stderr, /BOOKING_CONFIGURATION_INVALID|CONTACT_CONFIGURATION_INVALID|private-sentinel/u);
    } finally { await rm(root, { recursive: true, force: true }); }
  }
});


test("environment analytics preflight validates all compositions with field-only ordered refusals", async (context) => {
  for (const selection of [0, 1, 2, 3]) {
    await context.test(`contact=${Boolean(selection & 1)} booking=${Boolean(selection & 2)}`, async () => {
      const rendered = assertSuccess(await renderApplicationEnvironment("site", {
        analytics: environmentAnalyticsSettings,
        ...(selection & 1 ? { contactFormWeb3Forms: true } : {}),
        ...(selection & 2 ? { bookingCalendly: { mode: "popup" } } : {}),
      }));
      const root = await mkdtemp(join(tmpdir(), "analytics-environment-preflight-"));
      for (const file of rendered.files.filter(({ path }) => /(?:application-environment|application-build|public-build|site-origin|booking-settings|contact-settings|analytics-configuration|analytics-settings)\.ts$/u.test(path) || path.endsWith("check-application-environment.mjs"))) {
        const destination = join(root, file.path);
        await mkdir(join(destination, ".."), { recursive: true });
        await writeFile(destination, file.content);
      }
      const valid = {
        APPLICATION_ENVIRONMENT: "staging",
        NEXT_PUBLIC_ANALYTICS_ENABLED: "true",
        NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN: "0123456789abcdef0123456789abcdef",
        NEXT_PUBLIC_GA4_MEASUREMENT_ID: "G-TEST123456",
        NEXT_PUBLIC_CLARITY_PROJECT_ID: "clarity123",
        NEXT_PUBLIC_SITE_URL: "https://qa.analytics-test.invalid",
        NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: "synthetic-verification-token",
        NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: "00000000-0000-4000-8000-000000000001",
        NEXT_PUBLIC_CALENDLY_URL: "https://calendly.com/synthetic-nonproduction/intro",
      };
      const script = join(root, "apps/web/scripts/check-application-environment.mjs");
      const check = (overrides, expected) => {
        const result = spawnSync(process.execPath, [script, "--local"], { encoding: "utf8", env: { ...valid, ...overrides } });
        assert.equal(result.status, expected === undefined ? 0 : 1, result.stderr);
        if (expected !== undefined) assert.deepEqual(JSON.parse(result.stderr.trim()), expected);
        assert.doesNotMatch(result.stdout + result.stderr, /private-sentinel|0123456789abcdef|G-TEST123456|clarity123/u);
      };
      check({ NEXT_PUBLIC_GA4_MEASUREMENT_ID: "" }, { code: "ANALYTICS_CONFIGURATION_INVALID", field: "NEXT_PUBLIC_GA4_MEASUREMENT_ID", reason: "missing" });
      check({}, undefined);
      check({ APPLICATION_ENVIRONMENT: "development", NEXT_PUBLIC_GA4_MEASUREMENT_ID: "" }, undefined);
      check({ NEXT_PUBLIC_ANALYTICS_ENABLED: "false", NEXT_PUBLIC_GA4_MEASUREMENT_ID: "", NEXT_PUBLIC_CLARITY_PROJECT_ID: "", NEXT_PUBLIC_SITE_URL: "" }, { code: "APPLICATION_ENVIRONMENT_INVALID", field: "NEXT_PUBLIC_SITE_URL", reason: "missing" });
      check({ NEXT_PUBLIC_ANALYTICS_ENABLED: "false", NEXT_PUBLIC_GA4_MEASUREMENT_ID: "private-sentinel" }, { code: "ANALYTICS_CONFIGURATION_INVALID", field: "NEXT_PUBLIC_GA4_MEASUREMENT_ID", reason: "invalid" });
      check({ APPLICATION_ENVIRONMENT: "production", NEXT_PUBLIC_ANALYTICS_ENABLED: "false", NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: "" }, { code: "ANALYTICS_CONFIGURATION_INVALID", field: "NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION", reason: "missing" });
      check({ APPLICATION_ENVIRONMENT: "production" }, undefined);
      check({ NEXT_PUBLIC_APPLICATION_ENVIRONMENT: "production", NEXT_PUBLIC_GA4_MEASUREMENT_ID: "private-sentinel" }, { code: "APPLICATION_ENVIRONMENT_INVALID", field: "NEXT_PUBLIC_APPLICATION_ENVIRONMENT", reason: "mismatch" });
      if (selection & 1) check({ NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: "", NEXT_PUBLIC_CALENDLY_URL: "private-sentinel", NEXT_PUBLIC_GA4_MEASUREMENT_ID: "private-sentinel" }, { code: "CONTACT_CONFIGURATION_INVALID", field: "NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY", reason: "missing" });
      if (selection & 2) check({ NEXT_PUBLIC_CALENDLY_URL: "", NEXT_PUBLIC_GA4_MEASUREMENT_ID: "private-sentinel" }, { code: "BOOKING_CONFIGURATION_INVALID", field: "NEXT_PUBLIC_CALENDLY_URL", reason: "missing" });
    });
  }
});

async function generatedApplicationEnvironmentModule(files) {
  const typescript = await import("typescript");
  const source = indexFiles(files).get("apps/web/src/configuration/application-environment.ts");
  const executable = typescript.transpileModule(source, { compilerOptions: { module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2022 } }).outputText;
  return `data:text/javascript;base64,${Buffer.from(executable).toString("base64")}`;
}

let environmentObservabilityLoad = 0;
async function loadEnvironmentObservabilityContext(files, environment, testContext) {
  const typescript = await import("typescript");
  const key = `__environmentObservability${++environmentObservabilityLoad}`;
  const scheduled = [];
  globalThis[key] = { env: environment, ctx: { waitUntil(task) { scheduled.push(task); } } };
  testContext.after(() => { delete globalThis[key]; });
  const platformModule = `data:text/javascript;base64,${Buffer.from(`export async function getCloudflareContext() { return globalThis[${JSON.stringify(key)}]; }`).toString("base64")}`;
  const source = indexFiles(files).get("apps/web/src/infrastructure/cloudflare/observability-context.ts");
  const executable = typescript.transpileModule(source, { compilerOptions: { module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2022 } }).outputText
    .replace('from "@opennextjs/cloudflare"', `from ${JSON.stringify(platformModule)}`)
    .replace('from "../../configuration/application-environment"', `from ${JSON.stringify(await generatedApplicationEnvironmentModule(files))}`);
  const moduleURL = `data:text/javascript;base64,${Buffer.from(executable).toString("base64")}#${key}`;
  return { module: await import(moduleURL), moduleURL, scheduled };
}

function setEnvironmentInput(testContext, key, value) {
  const original = process.env[key];
  if (value === undefined) delete process.env[key]; else process.env[key] = value;
  testContext.after(() => { if (original === undefined) delete process.env[key]; else process.env[key] = original; });
}

test("environment observability preserves shared bytes across finite installed contexts", async () => {
  const core = await import("../dist/index.js");
  const request = { projectName: "observability-context", displayName: "Observability Context", packageVersions: core.verifiedCapabilityPackageVersions };
  const sharedPaths = [
    "apps/web/src/infrastructure/cloudflare/observability-context.ts",
    "apps/web/src/infrastructure/observability/server-reporter.ts",
    "apps/web/src/infrastructure/observability/browser-reporter.ts",
    "apps/web/app/api/observability/route.ts",
  ];
  const current = assertSuccess(await core.renderSkeleton({ ...request, profile: "portfolio" }));
  const publicFiles = indexFiles(current.files);
  assert.equal(current.resolved.capabilities.find(({ identifier }) => identifier === "observability").version, "0.4.0");
  for (const path of sharedPaths) {
    const expected = path === "apps/web/app/api/observability/route.ts"
      ? await readCommonWebTemplate(path.slice("apps/web/".length))
      : await readFile(new URL(`../templates/common/application-environments/${path}`, import.meta.url), "utf8");
    assert.equal(publicFiles.get(path), expected, path);
  }
  for (const persistence of [false, true]) {
    for (const retainedFoundation of [false, true]) {
      const rendered = assertSuccess(await core.renderSkeleton({
        ...request, profile: persistence ? "app" : "portfolio", transactionalEmailResend: true,
        ...(persistence ? { applicationPersistence: true } : {}),
      }, core.createApplicationEnvironmentRenderingContext(persistence, retainedFoundation)));
      const files = indexFiles(rendered.files);
      const capability = rendered.resolved.capabilities.find(({ identifier }) => identifier === "observability");
      assert.equal(capability.version, "0.4.0");
      for (const path of sharedPaths) assert.equal(files.get(path), publicFiles.get(path), path);
      for (const surface of capability.managedSurfaces) {
        if (surface.fingerprintTarget.kind === "file") assert.ok(files.has(surface.path), surface.path);
      }
      assert.equal(JSON.parse(files.get("apps/web/package.json")).dependencies["@egeria-systems/observability"], "0.3.0");
      for (const path of ["docs/environments.md", "docs/observability.md"]) {
        const content = files.get(path);
        const links = [...content.matchAll(/\[[^\]]+\]\(([^)]+)\)/gu), ...content.matchAll(/^\[[^\]]+\]:\s+(\S+)/gmu)];
        assert.ok(links.length > 0, path);
        for (const [, destination] of links) {
          if (/^(?:https?:|#)/u.test(destination)) continue;
          const target = new URL(destination, "https://generated.example/" + path);
          assert.ok(files.has(target.pathname.slice(1)), `${path} -> ${destination}`);
        }
      }
      assert.ok(files.has("apps/web/tests/unit/transactional-email-events.test.ts"));
      assert.equal(new Set(rendered.files.map(({ path }) => path)).size, rendered.files.length);
    }
  }
});

test("environment observability rejects partial runtime provider input before dispatch", async (testContext) => {
  const rendered = assertSuccess(await renderApplicationEnvironment("portfolio"));
  setEnvironmentInput(testContext, "NEXT_PUBLIC_APPLICATION_ENVIRONMENT", "staging");
  const context = await loadEnvironmentObservabilityContext(rendered.files, { APPLICATION_ENVIRONMENT: "staging", BETTER_STACK_INGESTING_HOST: "s123.eu-nbg-2.betterstackdata.com" }, testContext);
  await assert.rejects(context.module.readObservabilityRuntimeContext(), { message: "BETTER_STACK_CONFIGURATION_INVALID" });
  assert.deepEqual(context.scheduled, []);
});

test("environment observability labels actual structured events using runtime agreement", async (testContext) => {
  const rendered = assertSuccess(await renderApplicationEnvironment("portfolio"));
  setEnvironmentInput(testContext, "NEXT_PUBLIC_APPLICATION_ENVIRONMENT", "staging");
  const context = await loadEnvironmentObservabilityContext(rendered.files, { APPLICATION_ENVIRONMENT: "staging" }, testContext);
  const reporter = await loadGeneratedServerReporter(rendered.files, { runtimeContextModule: context.moduleURL });
  const records = [];
  testContext.mock.method(console, "info", record => records.push(record));
  await reporter.module.reportCaughtServerError(new Error("synthetic failure"), { operation: "load-example" });
  await Promise.all(context.scheduled);
  assert.equal(records.length, 1);
  assert.equal(records[0].environment, "staging");
  assert.equal(records[0].event_name, "server.caught.error");
  assert.doesNotMatch(JSON.stringify(records), /synthetic failure|stack_trace/u);
});

test("environment observability credentials require a staging artifact at its exact configured origin", async (testContext) => {
  const rendered = assertSuccess(await renderApplicationEnvironment("portfolio"));
  setEnvironmentInput(testContext, "NEXT_PUBLIC_APPLICATION_ENVIRONMENT", "staging");
  setEnvironmentInput(testContext, "NEXT_PUBLIC_SITE_URL", "https://staging.example.test");
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { origin: "https://staging.example.test" } } });
  testContext.after(() => { if (original) Object.defineProperty(globalThis, "window", original); else delete globalThis.window; });
  const requests = [];
  testContext.mock.method(globalThis, "fetch", async (url, options) => { requests.push({ url, options }); return new Response(null, { status: 202 }); });
  const reporter = await loadGeneratedBrowserReporter(rendered.files);
  reporter.module.reportWebVital({ name: "LCP", value: 12, delta: 1, rating: "good", navigationType: "navigate" });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.credentials, "same-origin");
  assert.equal(requests[0].url, "https://staging.example.test/api/observability");
  assert.equal(requests[0].options.mode, "same-origin");
  assert.equal(requests[0].options.redirect, "error");
});


test("environment release workflows freeze one source then gate separate staging and production artifacts", async context => {
  const core = await import("../dist/index.js");
  const { createApplicationEnvironmentRenderingContext } = await import("../dist/catalog/verified-package-versions.js");
  for (const persistence of [false, true]) for (const jobs of [false, true]) await context.test(`persistence=${persistence}, jobs=${jobs}`, async () => {
    const result = assertSuccess(await core.renderSkeleton({ profile: "app", projectName: "release-example", displayName: "Release Example", packageVersions: core.verifiedCapabilityPackageVersions,
      ...(persistence ? { applicationPersistence: true } : {}), ...(jobs ? { backgroundJobDelivery: true } : {}) }, createApplicationEnvironmentRenderingContext(persistence, false, jobs)));
    assert.match(indexFiles(result.files).get("apps/web/playwright.preview.config.ts"), /http:\/\/localhost:3101/u);
    const workflow = parseGeneratedYaml(result.files, ".github/workflows/deploy.yml");
    assert.deepEqual(Object.keys(workflow.jobs), ["verify-source", "staging", "production"]);
    assert.equal(workflow.jobs.staging.needs, "verify-source");
    assert.deepEqual(workflow.jobs.production.needs, ["verify-source", "staging"]);
    assert.equal(workflow.concurrency["cancel-in-progress"], false);
    for (const target of ["staging", "production"]) {
      const job = workflow.jobs[target];
      assert.equal(job.environment.name, target);
      assert.equal(job.env.APPLICATION_ENVIRONMENT, target);
      assert.equal(job.env.CLOUDFLARE_ENV, target);
      assert.equal(job.steps[0].with.ref, "${{ needs.verify-source.outputs.revision }}");
      assert.equal(job.permissions.contents, "read");
      assert.equal(job.permissions.actions, target === "production" ? "read" : undefined);
      assert.equal(Object.keys(job.env).some(key => /TOKEN|SECRET|KEY/u.test(key)), false);
      const record = job.steps.findIndex(step => step.run?.includes("check:prepared-artifact record"));
      const preview = job.steps.findIndex(step => step.run?.includes("test:e2e:preview"));
      const deploy = job.steps.findIndex(step => step.env?.CLOUDFLARE_API_TOKEN);
      assert.ok(record >= 0 && preview > record && deploy > preview);
      for (const step of job.steps.slice(record + 1)) assert.equal(/(?:next build|run build|test:e2e:dev)/u.test(step.run ?? ""), false);
      for (const step of job.steps) {
        if (step.env?.CF_ACCESS_CLIENT_SECRET) { assert.equal(target, "staging"); assert.ok(job.steps.indexOf(step) > deploy); }
        if (step.env?.CLOUDFLARE_API_TOKEN) assert.equal(step.name, "Deploy prepared Cloudflare Worker");
        assert.equal(/db:migrate|d1 migrations|job-operator/u.test(step.run ?? ""), false);
      }
      assert.equal(job.steps.at(-1).run, "pnpm --dir apps/web run test:e2e:deployed");
      if (persistence) {
        assert.equal(job.concurrency.group, `application-database-${target}`);
        assert.equal(job.concurrency["cancel-in-progress"], false);
        assert.equal(workflow.on.workflow_dispatch.inputs[`expected_${target}_database_id`].required, true);
      }
      if (jobs) assert.equal(workflow.on.workflow_dispatch.inputs[`${target}_job_retention_reviewed`].type, "boolean");
    }
    const helperPath = "apps/web/scripts/prepare-ci-git.sh";
    const surface = result.surfaces.find(({ path }) => path === helperPath);
    assert.equal(surface?.owner.identifier, "deployment-cloudflare");
    assert.equal(surface.ownership, "managed");
    assert.equal(surface.mergeStrategy, "replace-file");
    const wrappedCommands = Object.entries(workflow.jobs).flatMap(([job, { steps }]) =>
      steps.flatMap(step => (step.run ?? "").split("\n").filter(line => line.includes(helperPath))
        .map(command => ({ job, command: command.trim(), env: step.env }))),
    );
    assert.deepEqual(wrappedCommands, [{
      job: "verify-source",
      command: `sh ${helperPath} pnpm --dir apps/web run test:deployment-contracts`,
      env: undefined,
    }]);
    const manifest = parseGeneratedJson(result.files, "apps/web/package.json");
    assert.equal(manifest.scripts["check:prepared-artifact"], "node --experimental-strip-types scripts/check-prepared-artifact.mjs");
    assert.ok(manifest.scripts["test:deployment-contracts"]);
    const wrangler = parseGeneratedJson(result.files, "apps/web/wrangler.jsonc");
    assert.equal(wrangler.name, "release-example-local");
    assert.equal(wrangler.env.staging.name, "release-example-staging");
    assert.equal(wrangler.env.production.name, "release-example");
    for (const target of ["staging", "production"]) {
      assert.equal(wrangler.env[target].workers_dev, false);
      assert.equal(wrangler.env[target].preview_urls, false);
    }
  });
});


test("current generation owns literal lint patches across foundation and persistence combinations", async () => {
  const core = await import("../dist/index.js");
  const { resolveRecipeLockfileVersion } = await import("../dist/generation/recipe-lockfiles.js");
  const patchPath = "patches/next-eslint-plugin-next.patch";
  const patch = await readFile(new URL("../templates/common/literal-lint-roots/patches/next-eslint-plugin-next.patch", import.meta.url));
  for (const profile of ["portfolio", "site", "app"]) {
    for (const options of [{}, { transactionalEmailResend: true }, { backgroundJobDelivery: true }, ...(profile === "app" ? [{ applicationPersistence: true }, { applicationPersistence: true, transactionalEmailResend: true }, { applicationPersistence: true, backgroundJobDelivery: true }] : [])]) {
      const rendered = assertSuccess(await core.renderSkeleton({ profile, projectName: "literal-lint-example", displayName: "Literal Lint Example", packageVersions: core.verifiedCapabilityPackageVersions, ...options }));
      const fileMap = new Map(rendered.files.map(({ path, content }) => [path, content]));
      assert.deepEqual(Buffer.from(fileMap.get(patchPath)), patch);
      const plugin = `@next/eslint-plugin-next@${profile === "portfolio" ? "16.3.0" : "16.3.3"}`;
      const policy = parseGeneratedYaml(rendered.files, "pnpm-workspace.yaml");
      assert.equal(policy.overrides[`${plugin}>fast-glob`], "-");
      assert.deepEqual(policy.patchedDependencies, { [plugin]: patchPath });
      const ownedPatch = rendered.surfaces.find(({ path }) => path === patchPath);
      assert.equal(ownedPatch.ownership, "managed");
      assert.deepEqual(ownedPatch.owner, { kind: "builder-kernel" });
      const manifest = parseGeneratedJson(rendered.files, "apps/web/package.json");
      const foundation = manifest.dependencies.effect !== undefined;
      const expectedLock = options.applicationPersistence ? "app-0.2.7-persistence-next-16.4.5"
        : profile === "app" ? "app-0.3.0-next-16.4.5"
        : foundation ? profile === "portfolio" ? "portfolio-0.11.7-foundation-next-16.4.5" : "app-0.2.7-next-16.4.5"
        : profile === "portfolio" ? "portfolio-0.12.0-next-16.4.5" : "site-0.13.0-next-16.4.5";
      assert.equal(resolveRecipeLockfileVersion(rendered.project, manifest), expectedLock);
      const lock = parseDocument(await readFile(new URL(`../lockfiles/web-recipe-${expectedLock}/pnpm-lock.yaml`, import.meta.url), "utf8")).toJS();
      assert.equal(lock.patchedDependencies[plugin], createHash("sha256").update(patch).digest("hex"));
    }
  }
});
