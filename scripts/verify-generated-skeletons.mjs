import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import {
  chmod,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  open,
  opendir,
  readFile,
  readdir,
  realpath,
  writeFile,
} from "node:fs/promises";
import { constants as operatingSystemConstants, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify, stripVTControlCharacters } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  cleanupOwnedDirectory,
  createIsolatedProcessEnvironment,
  isolatedProcessOptions,
  pathIdentityMatches,
  readPathIdentity,
} from "./lib/isolated-process.mjs";
import { runDependencyAudit } from "./lib/dependency-audit.mjs";
import { inspectAppEffectBuild, inspectEffectSourceBoundary } from "./verify-app-transition-visuals.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const versionTimeoutMilliseconds = 30 * 1000;
const commandTimeoutMilliseconds = 15 * 60 * 1000;
const requiredPnpmVersion = "11.28.1";
const publicRegistry = "https://registry.npmjs.org/";
const generatedVisualArtifactsRoot = resolve(
  repositoryRoot,
  "generated-visual-artifacts",
);
const visualArtifactMaximumBytes = 16 * 1024 * 1024;
const visualArtifactDirectories = Object.freeze([
  Object.freeze({
    destination: "playwright-report",
    relativeSource: "apps/web/playwright-report",
  }),
  Object.freeze({
    destination: "test-results",
    relativeSource: "apps/web/test-results",
  }),
]);
const codePointCompare = (left, right) =>
  left < right ? -1 : left > right ? 1 : 0;

const portfolioFiles = Object.freeze([
  ".egeria/migrations.jsonl",
  ".egeria/project.yaml",
  ".egeria/state.json",
  ".github/workflows/deploy.yml",
  ".github/workflows/quality.yml",
  ".gitignore",
  ".nvmrc",
  "AGENTS.md",
  "README.md",
  "apps/web/.dev.vars.example",
  "apps/web/.env.example",
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
  "apps/web/playwright.transport.config.ts",
  "apps/web/playwright.visual.config.ts",
  "apps/web/postcss.config.mjs",
  "apps/web/scripts/check-application-environment.mjs",
  "apps/web/scripts/browser-development-server.ts",
  "apps/web/scripts/check-deployment-protection.mjs",
  "apps/web/scripts/check-prepared-artifact.mjs",
  "apps/web/scripts/prepare-ci-git.sh",
  "apps/web/src/configuration/application-build.ts",
  "apps/web/src/configuration/application-environment.ts",
  "apps/web/src/configuration/site-origin.ts",
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
  "apps/web/tests/e2e/application-test.ts",
  "apps/web/tests/e2e/application-transport.ts",
  "apps/web/tests/e2e/site-quality.spec.ts",
  "apps/web/tests/scripts/deployment-protection.test.mjs",
  "apps/web/tests/scripts/prepared-artifact.test.mjs",
  "apps/web/tests/setup/component.ts",
  "apps/web/tests/transport/application-transport.spec.ts",
  "apps/web/tests/unit/application-build.test.ts",
  "apps/web/tests/unit/application-environment.test.ts",
  "apps/web/tests/unit/content-schema.test.ts",
  "apps/web/tests/unit/observability-environment.test.ts",
  "apps/web/tests/unit/site-origin.test.ts",
  "apps/web/tests/visual/home-visual.spec.ts",
  "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "apps/web/tsconfig.json",
  "apps/web/vitest.config.ts",
  "apps/web/wrangler.jsonc",
  "docs/environments.md",
  "docs/observability.md",
  "package.json",
  "patches/next-eslint-plugin-next.patch",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
].sort(codePointCompare));

const bookingCalendlyFiles = Object.freeze([
  "apps/web/app/page.tsx",
  "apps/web/content/en-CA/booking-calendly.yaml",
  "apps/web/content/fr-CA/booking-calendly.yaml",
  "apps/web/src/integrations/booking-calendly/booking-content.ts",
  "apps/web/src/integrations/booking-calendly/booking-settings.ts",
  "apps/web/src/integrations/booking-calendly/calendly-booking.tsx",
  "apps/web/tests/component/booking-availability.test.tsx",
  "apps/web/tests/e2e/calendly-booking.spec.ts",
  "apps/web/tests/unit/booking-configuration.test.ts",
  "docs/booking-calendly.md",
].sort(codePointCompare));

const siteRoutingFiles = Object.freeze([
  "apps/web/app/about/page.tsx",
  "apps/web/app/not-found.tsx",
  "apps/web/app/robots.ts",
  "apps/web/app/sitemap.ts",
  "apps/web/app/work/error.tsx",
  "apps/web/app/work/featured/page.tsx",
  "apps/web/app/work/page.tsx",
  "apps/web/content/en-CA/about.yaml",
  "apps/web/content/en-CA/not-found.yaml",
  "apps/web/content/en-CA/work-featured.yaml",
  "apps/web/src/routing/read-routing-content.ts",
  "apps/web/src/routing/routing-content-schema.ts",
  "apps/web/src/routing/site-page.tsx",
  "apps/web/tests/component/site-page.test.tsx",
  "apps/web/tests/e2e/site-routing.spec.ts",
  "apps/web/tests/unit/routing-content.test.ts",
].sort(codePointCompare));

const appFoundationFiles = Object.freeze([
  "apps/web/app/api/health/route.ts",
  "apps/web/docs/application-boundaries.md",
  "apps/web/src/application/build-information-reader.ts",
  "apps/web/src/application/health.ts",
  "apps/web/src/application/request-context.ts",
  "apps/web/src/composition/server-health.ts",
  "apps/web/src/delivery/health-route.ts",
  "apps/web/src/domain/build-information.ts",
  "apps/web/src/infrastructure/cloudflare/application-environment.ts",
  "apps/web/src/infrastructure/cloudflare/build-information-reader.ts",
  "apps/web/src/infrastructure/memory/build-information-reader.ts",
  "apps/web/tests/integration/health-worker.test.ts",
  "apps/web/tests/unit/build-information.test.ts",
  "apps/web/tests/unit/cloudflare-build-information-reader.test.ts",
  "apps/web/tests/unit/health-route.test.ts",
  "apps/web/tests/unit/health.test.ts",
  "apps/web/tests/unit/request-context.test.ts",
  "apps/web/vitest.cloudflare.config.ts",
].sort(codePointCompare));

const transactionalEmailFiles = Object.freeze([
  "apps/web/src/application/transactional-email-sender.ts",
  "apps/web/src/infrastructure/resend/transactional-email-sender.ts",
  "apps/web/src/infrastructure/cloudflare/transactional-email-configuration.ts",
  "apps/web/src/composition/server-transactional-email.ts",
  "apps/web/src/infrastructure/observability/transactional-email-events.ts",
  "apps/web/tests/unit/resend-transactional-email-sender.test.ts",
  "apps/web/tests/unit/server-transactional-email.test.ts",
  "apps/web/tests/unit/transactional-email-events.test.ts",
  "docs/transactional-email.md",
].sort(codePointCompare));

const applicationPersistenceFiles = Object.freeze([
  ".github/workflows/migrate-application-database.yml",
  "apps/web/drizzle.config.ts",
  "apps/web/scripts/check-application-database.mjs",
  "apps/web/src/configuration/application-database.ts",
  "apps/web/src/infrastructure/persistence/schema.ts",
  "apps/web/tests/bindings/application-persistence.test.ts",
  "apps/web/tests/bindings/fixtures/migrations/0000_persistence_fixture.sql",
  "apps/web/tests/bindings/fixtures/migrations/0001_persistence_fixture_index.sql",
  "apps/web/tests/bindings/fixtures/schema.ts",
  "apps/web/tests/bindings/fixtures/worker.ts",
  "apps/web/tests/unit/application-database-environment.test.ts",
  "apps/web/vitest.bindings.config.ts",
  "docs/application-persistence.md",
].sort(codePointCompare));

const backgroundJobFiles = Object.freeze([
  "apps/web/scripts/check-job-delivery.mjs",
  "apps/web/src/application/job-delivery.ts",
  "apps/web/src/application/job-handlers.ts",
  "apps/web/src/composition/job-handler-composition.ts",
  "apps/web/src/composition/server-jobs.ts",
  "apps/web/src/infrastructure/cloudflare/job-delivery.ts",
  "apps/web/src/infrastructure/memory/job-delivery.ts",
  "apps/web/tests/integration/fixtures/job-worker.mjs",
  "apps/web/tests/integration/job-worker.test.ts",
  "apps/web/tests/unit/job-delivery.test.ts",
  "apps/web/tests/unit/job-handler-composition.test.ts",
  "apps/web/worker.mjs",
  "docs/background-job-delivery.md",
].sort(codePointCompare));

const multilingualFiles = Object.freeze([
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
].sort(codePointCompare));

const analyticsFiles = Object.freeze([
  "apps/web/content/en-CA/analytics.yaml",
  "apps/web/content/fr-CA/analytics.yaml",
  "apps/web/src/integrations/analytics/analytics-configuration.ts",
  "apps/web/src/integrations/analytics/analytics-consent-state.ts",
  "apps/web/src/integrations/analytics/analytics-consent.tsx",
  "apps/web/src/integrations/analytics/analytics-content-source.d.ts",
  "apps/web/src/integrations/analytics/analytics-content.ts",
  "apps/web/src/integrations/analytics/analytics-provider-contract.ts",
  "apps/web/src/integrations/analytics/analytics-runtime.ts",
  "apps/web/src/integrations/analytics/analytics-settings.ts",
  "apps/web/tests/component/analytics-consent.test.tsx",
  "apps/web/tests/e2e/analytics-consent.spec.ts",
  "apps/web/tests/unit/analytics-configuration.test.ts",
  "apps/web/tests/unit/analytics-consent-state.test.ts",
  "apps/web/tests/unit/analytics-provider-contract.test.ts",
  "apps/web/tests/unit/analytics-runtime.test.ts",
  "docs/analytics.md",
].sort(codePointCompare));

const multilingualErrorProofRoute = `"use client";

export default function ErrorBoundaryProof() {
  const recoveryKey = "egeria-verifier-error-boundary-recovery";
  if (
    typeof window !== "undefined" &&
    window.sessionStorage.getItem(recoveryKey) !== "ready"
  ) {
    throw new Error("Intentional verifier-only error boundary proof");
  }
  return <main data-testid="verifier-recovery" />;
}
`;

const multilingualErrorProofSpecification = `import { expect, test } from "@playwright/test";

test("renders and retries ordinary failures in the active locale", async ({ page }) => {
  const recoveryKey = "egeria-verifier-error-boundary-recovery";
  await page.addInitScript((key) => {
    window.sessionStorage.setItem(key, "fail");
  }, recoveryKey);
  await page.goto("/fr-CA/error-boundary-proof");

  await expect(page.locator("html")).toHaveAttribute("lang", "fr-CA");
  const fallback = page.locator(
    'main[aria-labelledby="error-fallback-heading"]',
  );
  const heading = fallback.getByRole("heading", { level: 1 });
  const retry = fallback.getByRole("button");
  await expect(heading).toBeVisible();
  await expect(retry).toBeVisible();

  await page.evaluate((key) => {
    window.sessionStorage.setItem(key, "ready");
  }, recoveryKey);
  await retry.click();
  await expect(page.getByTestId("verifier-recovery")).toBeAttached();
});
`;

async function prepareVerifierOnlyBrowserProof(validationRoot, contract) {
  if (contract.expectedMultilingualVersion === null) return;

  const routeDirectory = join(
    validationRoot,
    "apps/web/app/[locale]/error-boundary-proof",
  );
  await mkdir(routeDirectory, { recursive: true, mode: 0o700 });
  await writeFile(join(routeDirectory, "page.tsx"), multilingualErrorProofRoute, {
    flag: "wx",
    mode: 0o600,
  });
  await writeFile(
    join(
      validationRoot,
      "apps/web/tests/e2e/multilingual-error-boundary.spec.ts",
    ),
    multilingualErrorProofSpecification,
    { flag: "wx", mode: 0o600 },
  );
}

const createArguments = ({
  profile,
  projectName,
  displayName,
  analytics,
  bookingCalendly,
  multilingual,
  applicationPersistence,
  transactionalEmailResend,
  contactFormWeb3Forms,
  backgroundJobDelivery,
}) =>
  Object.freeze([
    "--profile",
    profile,
    "--name",
    projectName,
    "--display-name",
    displayName,
    ...(bookingCalendly === undefined
      ? []
      : [
          "--booking-calendly",
          "--calendly-mode",
          bookingCalendly.mode,
        ]),
    ...(multilingual === true ? ["--multilingual"] : []),
    ...(applicationPersistence === true ? ["--application-persistence"] : []),
    ...(transactionalEmailResend === true ? ["--transactional-email-resend"] : []),
    ...(contactFormWeb3Forms === true ? ["--contact-form-web3forms"] : []),
    ...(backgroundJobDelivery === true ? ["--background-job-delivery"] : []),
    ...(analytics === undefined
      ? []
      : [
          "--cloudflare-web-analytics",
          "--google-analytics-4",
          "--microsoft-clarity",
          "--microsoft-clarity-audience",
          analytics.providers.microsoftClarity.audience,
          "--google-search-console",
          "--looker-studio",
        ]),
  ]);

const contactFiles = Object.freeze([
  "apps/web/content/en-CA/contact-form-web3forms.yaml",
  "apps/web/content/fr-CA/contact-form-web3forms.yaml",
  "apps/web/src/integrations/contact-form-web3forms/contact-content-source.d.ts",
  "apps/web/src/integrations/contact-form-web3forms/contact-content.ts",
  "apps/web/src/integrations/contact-form-web3forms/contact-form-placement.tsx",
  "apps/web/src/integrations/contact-form-web3forms/contact-form.tsx",
  "apps/web/src/integrations/contact-form-web3forms/contact-settings.ts",
  "apps/web/src/integrations/contact-form-web3forms/hcaptcha.tsx",
  "apps/web/src/integrations/contact-form-web3forms/submit-contact.ts",
  "apps/web/src/integrations/contact-form-web3forms/web3forms-contact.tsx",
  "apps/web/tests/component/contact-availability.test.tsx",
  "apps/web/tests/component/web3forms-contact.test.tsx",
  "apps/web/tests/e2e/web3forms-contact.spec.ts",
  "apps/web/tests/unit/contact-configuration.test.ts",
  "apps/web/tests/unit/web3forms-contact.test.ts",
  "docs/contact-form-web3forms.md",
].sort(codePointCompare));

const noCapabilitySettings = Object.freeze({});
const portfolioCalendlySettings = Object.freeze({
  "booking-calendly": Object.freeze({
    mode: "popup",
  }),
});
const siteAnalyticsSettings = Object.freeze({
  analytics: Object.freeze({
    consent: Object.freeze({ policy: "explicit-opt-in" }),
    providers: Object.freeze({
      cloudflareWebAnalytics: true,
      googleAnalytics4: true,
      microsoftClarity: Object.freeze({
        audience: "not-directed-to-minors",
      }),
    }),
    operationalIntegrations: Object.freeze({
      googleSearchConsole: true,
      lookerStudio: Object.freeze({ connector: "google-analytics-4" }),
    }),
  }),
});

export const generatedFixtureContracts = Object.freeze([
  Object.freeze({
    identifier: "portfolio",
    profile: "portfolio",
    projectName: "acme-portfolio",
    displayName: "Acme Portfolio",
    createArguments: createArguments({
      profile: "portfolio",
      projectName: "acme-portfolio",
      displayName: "Acme Portfolio",
    }),
    expectedCapabilitySettings: noCapabilitySettings,
    relativeRoot: "fixtures/generated/portfolio-0.12.0-next-16.4.5",
    expectedFiles: portfolioFiles,
    expectedCapabilities: Object.freeze([
      "standards",
      "content-files",
      "section-composition",
      "deployment-cloudflare",
      "observability",
    ]),
    expectedRecipeVersion: "0.12.0",
    expectedStandardsVersion: "0.9.0",
    expectedObservabilityVersion: "0.4.0",
    expectedContentFilesVersion: "0.4.0",
    expectedSectionCompositionVersion: "0.3.0",
    expectedDeploymentCloudflareVersion: "0.9.0",
    expectedSiteRoutingVersion: null,
    expectedBookingCalendlyVersion: null,
    expectedAnalyticsVersion: null,
    expectedMultilingualVersion: null,
    expectedSurfaces: 134,
    visualRegression: true,
  }),
  Object.freeze({
    identifier: "portfolio-calendly",
    profile: "portfolio",
    projectName: "acme-portfolio-calendly",
    displayName: "Acme Portfolio Calendly",
    createArguments: createArguments({
      profile: "portfolio",
      projectName: "acme-portfolio-calendly",
      displayName: "Acme Portfolio Calendly",
      bookingCalendly: portfolioCalendlySettings["booking-calendly"],
    }),
    expectedCapabilitySettings: portfolioCalendlySettings,
    relativeRoot: "fixtures/generated/portfolio-calendly-0.12.0-next-16.4.5",
    expectedFiles: Object.freeze([
      ...portfolioFiles.filter(
        (path) => path !== "apps/web/app/page.tsx",
      ),
      ...bookingCalendlyFiles,
    ].sort(codePointCompare)),
    expectedCapabilities: Object.freeze([
      "standards",
      "content-files",
      "section-composition",
      "deployment-cloudflare",
      "observability",
      "booking-calendly",
    ]),
    expectedRecipeVersion: "0.12.0",
    expectedStandardsVersion: "0.9.0",
    expectedObservabilityVersion: "0.4.0",
    expectedContentFilesVersion: "0.4.0",
    expectedSectionCompositionVersion: "0.3.0",
    expectedDeploymentCloudflareVersion: "0.9.0",
    expectedSiteRoutingVersion: null,
    expectedBookingCalendlyVersion: "0.2.0",
    expectedAnalyticsVersion: null,
    expectedMultilingualVersion: null,
    expectedSurfaces: 143,
    visualRegression: true,
  }),
  Object.freeze({
    identifier: "site",
    profile: "site",
    projectName: "acme-site",
    displayName: "Acme Site",
    createArguments: createArguments({
      profile: "site",
      projectName: "acme-site",
      displayName: "Acme Site",
    }),
    expectedCapabilitySettings: noCapabilitySettings,
    relativeRoot: "fixtures/generated/site-0.13.0-next-16.4.5",
    expectedFiles: Object.freeze([
      ...portfolioFiles,
      ...siteRoutingFiles,
    ].sort(codePointCompare)),
    expectedCapabilities: Object.freeze([
      "standards",
      "content-files",
      "section-composition",
      "deployment-cloudflare",
      "observability",
      "site-routing",
    ]),
    expectedRecipeVersion: "0.13.0",
    expectedStandardsVersion: "0.9.0",
    expectedObservabilityVersion: "0.4.0",
    expectedContentFilesVersion: "0.4.0",
    expectedSectionCompositionVersion: "0.3.0",
    expectedDeploymentCloudflareVersion: "0.9.0",
    expectedSiteRoutingVersion: "0.5.0",
    expectedBookingCalendlyVersion: null,
    expectedAnalyticsVersion: null,
    expectedMultilingualVersion: null,
    expectedSurfaces: 150,
    visualRegression: true,
  }),
  Object.freeze({
    identifier: "site-multilingual",
    profile: "site",
    projectName: "acme-site-multilingual",
    displayName: "Acme Site Multilingual",
    createArguments: createArguments({
      profile: "site",
      projectName: "acme-site-multilingual",
      displayName: "Acme Site Multilingual",
      multilingual: true,
    }),
    expectedCapabilitySettings: noCapabilitySettings,
    relativeRoot: "fixtures/generated/site-multilingual-0.13.0-next-16.4.5-multilingual-0.1.1",
    expectedFiles: Object.freeze([
      ...portfolioFiles,
      ...siteRoutingFiles,
      ...multilingualFiles,
    ].sort(codePointCompare)),
    expectedCapabilities: Object.freeze([
      "standards",
      "content-files",
      "section-composition",
      "deployment-cloudflare",
      "observability",
      "site-routing",
      "multilingual",
    ]),
    expectedRecipeVersion: "0.13.0",
    expectedStandardsVersion: "0.9.0",
    expectedObservabilityVersion: "0.4.0",
    expectedContentFilesVersion: "0.4.0",
    expectedSectionCompositionVersion: "0.3.0",
    expectedDeploymentCloudflareVersion: "0.9.0",
    expectedSiteRoutingVersion: "0.5.0",
    expectedBookingCalendlyVersion: null,
    expectedAnalyticsVersion: null,
    expectedMultilingualVersion: "0.1.1",
    expectedSurfaces: 167,
    visualRegression: false,
  }),
  Object.freeze({
    identifier: "site-public-integrations",
    profile: "site",
    projectName: "acme-site-public-integrations",
    displayName: "Acme Site Public Integrations",
    createArguments: createArguments({
      profile: "site",
      projectName: "acme-site-public-integrations",
      displayName: "Acme Site Public Integrations",
      analytics: siteAnalyticsSettings.analytics,
      bookingCalendly: portfolioCalendlySettings["booking-calendly"],
      contactFormWeb3Forms: true,
      multilingual: true,
    }),
    expectedCapabilitySettings: Object.freeze({ ...siteAnalyticsSettings, ...portfolioCalendlySettings }),
    relativeRoot: "fixtures/generated/site-public-integrations-0.13.0-next-16.4.5-multilingual-0.1.1-consent-session",
    expectedFiles: Object.freeze([
      ...portfolioFiles.filter(path => !bookingCalendlyFiles.includes(path)),
      ...bookingCalendlyFiles,
      ...contactFiles,
      ...siteRoutingFiles,
      ...multilingualFiles,
      ...analyticsFiles,
    ].sort(codePointCompare)),
    expectedCapabilities: Object.freeze([
      "standards",
      "content-files",
      "section-composition",
      "deployment-cloudflare",
      "observability",
      "site-routing",
      "contact-form-web3forms",
      "analytics",
      "booking-calendly",
      "multilingual",
    ]),
    expectedRecipeVersion: "0.13.0",
    expectedStandardsVersion: "0.9.0",
    expectedObservabilityVersion: "0.4.0",
    expectedContentFilesVersion: "0.4.0",
    expectedSectionCompositionVersion: "0.3.0",
    expectedDeploymentCloudflareVersion: "0.9.0",
    expectedSiteRoutingVersion: "0.5.0",
    expectedBookingCalendlyVersion: "0.2.0",
    expectedContactFormVersion: "0.2.0",
    expectedAnalyticsVersion: "0.2.0",
    expectedMultilingualVersion: "0.1.1",
    expectedSurfaces: 209,
    visualRegression: false,
  }),
  Object.freeze({
    identifier: "app",
    profile: "app",
    projectName: "acme-app",
    displayName: "Acme App",
    createArguments: createArguments({
      profile: "app", projectName: "acme-app", displayName: "Acme App",
    }),
    expectedCapabilitySettings: noCapabilitySettings,
    relativeRoot: "fixtures/generated/app-0.3.0-next-16.4.5",
    expectedFiles: Object.freeze([
      ...portfolioFiles, ...siteRoutingFiles, ...appFoundationFiles,
    ].sort(codePointCompare)),
    expectedCapabilities: Object.freeze([
      "standards", "deployment-cloudflare", "content-files", "section-composition",
      "observability", "app-foundation", "site-routing",
    ]),
    expectedRecipeVersion: "0.3.0",
    expectedStandardsVersion: "0.9.0",
    expectedObservabilityVersion: "0.4.0",
    expectedContentFilesVersion: "0.4.0",
    expectedSectionCompositionVersion: "0.3.0",
    expectedDeploymentCloudflareVersion: "0.9.0",
    expectedAppFoundationVersion: "0.3.0",
    expectedSiteRoutingVersion: "0.5.0",
    expectedBookingCalendlyVersion: null,
    expectedAnalyticsVersion: null,
    expectedMultilingualVersion: null,
    expectedSurfaces: 170,
    visualRegression: true,
  }),
  Object.freeze({
    identifier: "app-all-optional-integrations",
    profile: "app",
    projectName: "acme-app-all-optional-integrations",
    displayName: "Acme App All Optional Integrations",
    createArguments: createArguments({
      profile: "app",
      projectName: "acme-app-all-optional-integrations",
      displayName: "Acme App All Optional Integrations",
      analytics: siteAnalyticsSettings.analytics,
      bookingCalendly: portfolioCalendlySettings["booking-calendly"],
      multilingual: true,
    }),
    expectedCapabilitySettings: Object.freeze({
      ...siteAnalyticsSettings, ...portfolioCalendlySettings,
    }),
    relativeRoot: "fixtures/generated/app-all-optional-integrations-0.3.0-next-16.4.5-multilingual-0.1.1-consent-session",
    expectedFiles: Object.freeze([
      ...portfolioFiles.filter((path) => !bookingCalendlyFiles.includes(path)),
      ...siteRoutingFiles, ...appFoundationFiles, ...bookingCalendlyFiles,
      ...multilingualFiles, ...analyticsFiles,
    ].sort(codePointCompare)),
    expectedCapabilities: Object.freeze([
      "standards", "deployment-cloudflare", "content-files", "section-composition",
      "observability", "app-foundation", "site-routing", "analytics",
      "booking-calendly", "multilingual",
    ]),
    expectedRecipeVersion: "0.3.0",
    expectedStandardsVersion: "0.9.0",
    expectedObservabilityVersion: "0.4.0",
    expectedContentFilesVersion: "0.4.0",
    expectedSectionCompositionVersion: "0.3.0",
    expectedDeploymentCloudflareVersion: "0.9.0",
    expectedAppFoundationVersion: "0.3.0",
    expectedSiteRoutingVersion: "0.5.0",
    expectedBookingCalendlyVersion: "0.2.0",
    expectedAnalyticsVersion: "0.2.0",
    expectedMultilingualVersion: "0.1.1",
    expectedSurfaces: 213,
    visualRegression: false,
  }),
  Object.freeze({
    identifier: "app-persistence",
    profile: "app",
    projectName: "acme-app-persistence",
    displayName: "Acme App Persistence",
    createArguments: createArguments({ profile: "app", projectName: "acme-app-persistence", displayName: "Acme App Persistence", applicationPersistence: true }),
    expectedCapabilitySettings: noCapabilitySettings,
    relativeRoot: "fixtures/generated/app-persistence-0.3.0-next-16.4.5",
    expectedFiles: Object.freeze([...portfolioFiles, ...siteRoutingFiles, ...appFoundationFiles, ...applicationPersistenceFiles].sort(codePointCompare)),
    expectedCapabilities: Object.freeze([
      "standards", "deployment-cloudflare", "content-files", "section-composition",
      "observability", "app-foundation", "site-routing", "application-persistence",
    ]),
    expectedRecipeVersion: "0.3.0",
    expectedStandardsVersion: "0.10.0",
    expectedObservabilityVersion: "0.4.0",
    expectedContentFilesVersion: "0.4.0",
    expectedSectionCompositionVersion: "0.3.0",
    expectedDeploymentCloudflareVersion: "0.10.0",
    expectedAppFoundationVersion: "0.3.0",
    expectedApplicationPersistenceVersion: "0.2.0",
    expectedSiteRoutingVersion: "0.5.0",
    expectedBookingCalendlyVersion: null,
    expectedAnalyticsVersion: null,
    expectedMultilingualVersion: null,
    expectedSurfaces: 191,
    visualRegression: false,
  }),
  Object.freeze({
    identifier: "portfolio-email", profile: "portfolio", projectName: "acme-portfolio-email", displayName: "Acme Portfolio Email",
    createArguments: createArguments({ profile: "portfolio", projectName: "acme-portfolio-email", displayName: "Acme Portfolio Email", transactionalEmailResend: true }),
    expectedCapabilitySettings: noCapabilitySettings,
    relativeRoot: "fixtures/generated/portfolio-email-explicit-target-0.12.0-next-16.4.5",
    expectedFiles: Object.freeze([...portfolioFiles, ...appFoundationFiles, ...transactionalEmailFiles].sort(codePointCompare)),
    expectedCapabilities: Object.freeze(["standards", "content-files", "section-composition", "deployment-cloudflare", "observability", "app-foundation", "transactional-email-resend"]),
    expectedRecipeVersion: "0.12.0", expectedStandardsVersion: "0.9.0",
    expectedObservabilityVersion: "0.4.0", expectedContentFilesVersion: "0.4.0", expectedSectionCompositionVersion: "0.3.0",
    expectedDeploymentCloudflareVersion: "0.9.0", expectedAppFoundationVersion: "0.3.0",
    expectedTransactionalEmailVersion: "0.2.0", expectedApplicationPersistenceVersion: null,
    expectedSiteRoutingVersion: null, expectedBookingCalendlyVersion: null,
    expectedAnalyticsVersion: null, expectedMultilingualVersion: null, expectedSurfaces: 163, visualRegression: false,
  }),
  Object.freeze({
    identifier: "app-persistence-email", profile: "app", projectName: "acme-app-persistence-email", displayName: "Acme App Persistence Email",
    createArguments: createArguments({ profile: "app", projectName: "acme-app-persistence-email", displayName: "Acme App Persistence Email", transactionalEmailResend: true, applicationPersistence: true }),
    expectedCapabilitySettings: noCapabilitySettings,
    relativeRoot: "fixtures/generated/app-persistence-email-explicit-target-0.3.0-next-16.4.5",
    expectedFiles: Object.freeze([...portfolioFiles, ...appFoundationFiles, ...siteRoutingFiles, ...applicationPersistenceFiles, ...transactionalEmailFiles].sort(codePointCompare)),
    expectedCapabilities: Object.freeze(["standards", "deployment-cloudflare", "content-files", "section-composition", "observability", "app-foundation", "site-routing", "application-persistence", "transactional-email-resend"]),
    expectedRecipeVersion: "0.3.0", expectedStandardsVersion: "0.10.0",
    expectedObservabilityVersion: "0.4.0", expectedContentFilesVersion: "0.4.0", expectedSectionCompositionVersion: "0.3.0",
    expectedDeploymentCloudflareVersion: "0.10.0", expectedAppFoundationVersion: "0.3.0",
    expectedTransactionalEmailVersion: "0.2.0", expectedApplicationPersistenceVersion: "0.2.0",
    expectedSiteRoutingVersion: "0.5.0", expectedBookingCalendlyVersion: null,
    expectedAnalyticsVersion: null, expectedMultilingualVersion: null, expectedSurfaces: 200, visualRegression: false,
  }),
  Object.freeze({
    identifier: "site-contact-form",
    profile: "site",
    projectName: "acme-site-contact-form",
    displayName: "Acme Site Contact Form",
    createArguments: createArguments({ profile: "site", projectName: "acme-site-contact-form", displayName: "Acme Site Contact Form", contactFormWeb3Forms: true }),
    expectedCapabilitySettings: noCapabilitySettings,
    relativeRoot: "fixtures/generated/site-contact-form-0.13.0-next-16.4.5",
    expectedFiles: Object.freeze([...portfolioFiles, ...siteRoutingFiles, ...contactFiles].sort(codePointCompare)),
    expectedCapabilities: Object.freeze(["standards", "content-files", "section-composition", "deployment-cloudflare", "observability", "site-routing", "contact-form-web3forms"]),
    expectedRecipeVersion: "0.13.0",
    expectedStandardsVersion: "0.9.0",
    expectedObservabilityVersion: "0.4.0",
    expectedContentFilesVersion: "0.4.0",
    expectedSectionCompositionVersion: "0.3.0",
    expectedDeploymentCloudflareVersion: "0.9.0",
    expectedSiteRoutingVersion: "0.5.0",
    expectedBookingCalendlyVersion: null,
    expectedAnalyticsVersion: null,
    expectedMultilingualVersion: null,
    expectedContactFormVersion: "0.2.0",
    expectedSurfaces: 166,
    visualRegression: false,
  }),
  Object.freeze({
    identifier: "app-jobs", profile: "app", projectName: "acme-app-jobs", displayName: "Acme App Jobs",
    createArguments: createArguments({ profile: "app", projectName: "acme-app-jobs", displayName: "Acme App Jobs", backgroundJobDelivery: true }),
    expectedCapabilitySettings: noCapabilitySettings,
    relativeRoot: "fixtures/generated/app-jobs-recovery-composition-0.3.0-next-16.4.5",
    expectedFiles: Object.freeze([...portfolioFiles, ...siteRoutingFiles, ...appFoundationFiles, ...backgroundJobFiles].sort(codePointCompare)),
    expectedCapabilities: Object.freeze(["standards", "deployment-cloudflare", "content-files", "section-composition", "observability", "app-foundation", "site-routing", "background-job-delivery"]),
    expectedRecipeVersion: "0.3.0", expectedStandardsVersion: "0.9.0",
    expectedObservabilityVersion: "0.4.0", expectedContentFilesVersion: "0.4.0", expectedSectionCompositionVersion: "0.3.0",
    expectedDeploymentCloudflareVersion: "0.11.0", expectedAppFoundationVersion: "0.3.0", expectedBackgroundJobVersion: "0.3.0",
    expectedApplicationPersistenceVersion: null, expectedTransactionalEmailVersion: null,
    expectedSiteRoutingVersion: "0.5.0", expectedBookingCalendlyVersion: null,
    expectedAnalyticsVersion: null, expectedMultilingualVersion: null, expectedSurfaces: 183, visualRegression: false,
  }),
  Object.freeze({
    identifier: "app-persistence-jobs-email", profile: "app", projectName: "acme-app-persistence-jobs-email", displayName: "Acme App Persistence Jobs Email",
    createArguments: createArguments({ profile: "app", projectName: "acme-app-persistence-jobs-email", displayName: "Acme App Persistence Jobs Email", backgroundJobDelivery: true, applicationPersistence: true, transactionalEmailResend: true }),
    expectedCapabilitySettings: noCapabilitySettings,
    relativeRoot: "fixtures/generated/app-persistence-jobs-email-recovery-composition-0.3.0-next-16.4.5",
    expectedFiles: Object.freeze([...portfolioFiles, ...siteRoutingFiles, ...appFoundationFiles, ...backgroundJobFiles, ...applicationPersistenceFiles, ...transactionalEmailFiles].sort(codePointCompare)),
    expectedCapabilities: Object.freeze(["standards", "deployment-cloudflare", "content-files", "section-composition", "observability", "app-foundation", "site-routing", "application-persistence", "transactional-email-resend", "background-job-delivery"]),
    expectedRecipeVersion: "0.3.0", expectedStandardsVersion: "0.10.0",
    expectedObservabilityVersion: "0.4.0", expectedContentFilesVersion: "0.4.0", expectedSectionCompositionVersion: "0.3.0",
    expectedDeploymentCloudflareVersion: "0.12.0", expectedAppFoundationVersion: "0.3.0", expectedBackgroundJobVersion: "0.3.0",
    expectedApplicationPersistenceVersion: "0.2.0", expectedTransactionalEmailVersion: "0.2.0",
    expectedSiteRoutingVersion: "0.5.0", expectedBookingCalendlyVersion: null,
    expectedAnalyticsVersion: null, expectedMultilingualVersion: null, expectedSurfaces: 213, visualRegression: false,
  }),
]);

const verificationChecks = [
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
  "deployment-contracts",
  "transport-contracts",
  "application-environment",
  "next-build",
  "opennext-build",
  "prepared-artifact",
  "browser-install",
  "browser-development",
  "browser-preview",
];
const visualVerificationCheck = "visual-regression";
const defaultVerificationOptions = Object.freeze({ includeVisual: false });
const visualVerificationOptions = Object.freeze({ includeVisual: true });

const requiredPublicPackages = [
  {
    name: "@egeria-systems/observability",
    field: "dependencies",
    version: "0.3.0",
    integrity:
      "sha512-AnqIa6qn1aLYuntoQ1zo9A80ioiStR2mKJg5mq/v/NrKNAFQfP7InXojel9Azst3lLDUUdyDuEDFmCIgyWDwrA==",
  },
  {
    name: "@egeria-systems/standards",
    field: "devDependencies",
    version: "0.1.0",
    integrity:
      "sha512-BmDwcX0T6KT271C4N24jCKn6ymKTqDAFpJjsG6LNpmIoTAz0xApIcqpHFl9dHOqlB2xdhdHwKYfSiELUp04E0Q==",
  },
];

const expectedWorkspacePolicy = (pluginVersion) => `packages:
  - "apps/*"

pmOnFail: error

minimumReleaseAge: 1440
minimumReleaseAgeExclude:
  - "vite@8.2.4"
  - "@egeria-systems/observability@0.3.0"
  - "js-yaml@4.3.2"
  - "sharp@0.35.4"
  - "@img/sharp-darwin-arm64@0.35.4"
  - "@img/sharp-darwin-x64@0.35.4"
  - "@img/sharp-freebsd-wasm32@0.35.4"
  - "@img/sharp-libvips-darwin-arm64@1.3.3"
  - "@img/sharp-libvips-darwin-x64@1.3.3"
  - "@img/sharp-libvips-linux-arm@1.3.3"
  - "@img/sharp-libvips-linux-arm64@1.3.3"
  - "@img/sharp-libvips-linux-ppc64@1.3.3"
  - "@img/sharp-libvips-linux-riscv64@1.3.3"
  - "@img/sharp-libvips-linux-s390x@1.3.3"
  - "@img/sharp-libvips-linux-x64@1.3.3"
  - "@img/sharp-libvips-linuxmusl-arm64@1.3.3"
  - "@img/sharp-libvips-linuxmusl-x64@1.3.3"
  - "@img/sharp-linux-arm@0.35.4"
  - "@img/sharp-linux-arm64@0.35.4"
  - "@img/sharp-linux-ppc64@0.35.4"
  - "@img/sharp-linux-riscv64@0.35.4"
  - "@img/sharp-linux-s390x@0.35.4"
  - "@img/sharp-linux-x64@0.35.4"
  - "@img/sharp-linuxmusl-arm64@0.35.4"
  - "@img/sharp-linuxmusl-x64@0.35.4"
  - "@img/sharp-wasm32@0.35.4"
  - "@img/sharp-webcontainers-wasm32@0.35.4"
  - "@img/sharp-win32-arm64@0.35.4"
  - "@img/sharp-win32-ia32@0.35.4"
  - "@img/sharp-win32-x64@0.35.4"

resolutionMode: time-based

overrides:
  "vite@>=8.2.0 <8.2.4": "8.2.4"
  "vite@8.2.4>rolldown": "1.2.5"
  "vite@8.2.4>postcss": "8.5.26"
  "@next/eslint-plugin-next@${pluginVersion}>fast-glob": "-"
  "@node-minify/core@9.0.2>glob": "14.0.3"
  "@opennextjs/cloudflare@1.20.12>glob": "14.0.3"
  "minimatch@>=7.0.0 <11.0.4": "11.0.4"
  "fast-uri@": 3.1.9
  "body-parser@": 2.4.0
  "undici@": 6.29.1
  "js-yaml@>=4.0.0 <4.3.2": 4.3.2
  "miniflare>undici": 7.30.1
  "jsdom>undici": 8.12.2
  "next@>=16.2.0 <16.4.5": 16.4.5
  "brace-expansion@>=1.0.0 <1.1.21": 1.1.21
  "brace-expansion@>=2.0.0 <2.1.7": 2.1.7
  "brace-expansion@>=5.0.0 <5.0.12": 5.0.12
  "qs@": 6.16.1
  "sharp@>=0.35.0 <0.35.5": 0.35.5
  "source-map-js@>=1.0.0 <1.2.2": 1.2.2
  "proxy-addr@>=2.0.0 <2.0.8": 2.0.8

allowBuilds:
  "@parcel/watcher": true
  "@swc/core": true
  esbuild: true
  unrs-resolver: true
  workerd: true

patchedDependencies:
  "@next/eslint-plugin-next@${pluginVersion}": "patches/next-eslint-plugin-next.patch"
`;

const expectedLockfilePreamble = (pluginVersion) => `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false

overrides:
  vite@>=8.2.0 <8.2.4: 8.2.4
  vite@8.2.4>rolldown: 1.2.5
  vite@8.2.4>postcss: 8.5.26
  '@next/eslint-plugin-next@${pluginVersion}>fast-glob': '-'
  '@node-minify/core@9.0.2>glob': 14.0.3
  '@opennextjs/cloudflare@1.20.12>glob': 14.0.3
  minimatch@>=7.0.0 <11.0.4: 11.0.4
  fast-uri@: 3.1.9
  body-parser@: 2.4.0
  undici@: 6.29.1
  js-yaml@>=4.0.0 <4.3.2: 4.3.2
  miniflare>undici: 7.30.1
  jsdom>undici: 8.12.2
  next@>=16.2.0 <16.4.5: 16.4.5
  brace-expansion@>=1.0.0 <1.1.21: 1.1.21
  brace-expansion@>=2.0.0 <2.1.7: 2.1.7
  brace-expansion@>=5.0.0 <5.0.12: 5.0.12
  qs@: 6.16.1
  sharp@>=0.35.0 <0.35.5: 0.35.5
  source-map-js@>=1.0.0 <1.2.2: 1.2.2
  proxy-addr@>=2.0.0 <2.0.8: 2.0.8

patchedDependencies:
  '@next/eslint-plugin-next@${pluginVersion}': 0d97aaca566ae4a55bd76e0176c30db196d7707e852a9e76deb2eb3668dc55aa

importers:
`;

function expectedRootManifest(projectName) {
  return {
    name: projectName,
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
  };
}

function expectedWebManifest(projectName, eslintConfigNextVersion, appFoundation, persistence) {
  return {
    dependencies: {
      "@egeria-systems/observability": "0.3.0",
      "@opennextjs/cloudflare": "1.20.12",
      ...(appFoundation ? { effect: "4.0.0-rc.112" } : {}),
      ...(persistence ? { "drizzle-orm": "0.45.2" } : {}),
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
      ...(persistence ? { "@cloudflare/workers-types": "5.20261006.1", "drizzle-kit": "0.31.10" } : {}),
      eslint: "9.39.5",
      "eslint-config-next": eslintConfigNextVersion,
      jsdom: "30.0.1",
      postcss: "8.5.26",
      "raw-loader": "4.0.2",
      tailwindcss: "4.3.3",
      typescript: "6.0.3",
      "typescript-eslint": "8.66.0",
      vitest: "5.0.3",
      wrangler: "4.148.0",
    },
    name: `${projectName}-web`,
    private: true,
    scripts: {
      "check:environment": "node scripts/check-application-environment.mjs --local",
      "check:environment:deployment": "node scripts/check-application-environment.mjs --deployment",
      "check:prepared-artifact": "node --experimental-strip-types scripts/check-prepared-artifact.mjs",
      "test:deployment-contracts": "node --experimental-strip-types --test tests/scripts/prepared-artifact.test.mjs tests/scripts/deployment-protection.test.mjs",
      "test:transport": "playwright test --config playwright.transport.config.ts",
      "browser:install": "playwright install chromium",
      "browser:install:ci": "playwright install --with-deps chromium",
      build: "next build",
      "build:cloudflare": "opennextjs-cloudflare build",
      "cf-typegen":
        "wrangler types --env-interface CloudflareEnv --include-runtime=false cloudflare-env.d.ts",
      dev: "next dev",
      lint: "eslint . --max-warnings 0",
      preview:
        "opennextjs-cloudflare build && opennextjs-cloudflare preview",
      test: "vitest run",
      "test:component": "vitest run --project component",
      "test:component:watch": "vitest --project component",
      ...(appFoundation ? {
        "test:integration:cloudflare": "vitest run --config vitest.cloudflare.config.ts",
      } : {}),
      ...(persistence ? {
        "db:generate": "drizzle-kit generate --config drizzle.config.ts",
        "db:migrate:local": "node scripts/check-application-database.mjs local && wrangler d1 migrations apply APP_DB --local --config wrangler.jsonc --x-provision=false --x-auto-create=false",
        "db:check": "node scripts/check-application-database.mjs local",
        "db:migrations:hash": "node scripts/check-application-database.mjs migration-hash",
        "test:integration:bindings": "vitest run --config vitest.bindings.config.ts",
      } : {}),
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
    type: "module",
    version: "0.0.0",
  };
}

export class GeneratedFixtureVerificationError extends Error {
  constructor(code) {
    super(`Generated fixture verification failed: ${code}`);
    this.name = "GeneratedFixtureVerificationError";
    this.code = code;
  }
}

function fail(code) {
  throw new GeneratedFixtureVerificationError(code);
}

function fixedFixtureIndex(identifier, failureCode) {
  const index = generatedFixtureContracts.findIndex(contract => contract.identifier === identifier);
  if (index === -1) fail(failureCode);
  return index;
}

export function parseVerificationArguments(arguments_) {
  if (!Array.isArray(arguments_)) {
    fail("VERIFICATION_ARGUMENT_INVALID");
  }
  const prefix = "--from-fixture=";
  let includeVisual = false;
  let fromFixture;
  for (const argument of arguments_) {
    if (argument === "--visual" && !includeVisual) {
      includeVisual = true;
    } else if (typeof argument === "string" && argument.startsWith(prefix) && fromFixture === undefined) {
      fromFixture = argument.slice(prefix.length);
      fixedFixtureIndex(fromFixture, "VERIFICATION_ARGUMENT_INVALID");
    } else {
      fail("VERIFICATION_ARGUMENT_INVALID");
    }
  }
  if (fromFixture !== undefined) return Object.freeze({ includeVisual, fromFixture });
  return includeVisual ? visualVerificationOptions : defaultVerificationOptions;
}

function requireVerificationOptions(options) {
  if (
    options === null ||
    typeof options !== "object" ||
    Object.keys(options).length !== 1 ||
    typeof options.includeVisual !== "boolean"
  ) {
    fail("VERIFICATION_OPTION_INVALID");
  }
}

function fingerprint(content) {
  return createHash("sha256").update(content).digest("hex");
}

function createChildEnvironment(support) {
  return createIsolatedProcessEnvironment({
    HOME: support.home,
    USERPROFILE: support.home,
    TMPDIR: support.temporary,
    TMP: support.temporary,
    TEMP: support.temporary,
    NPM_CONFIG_REGISTRY: publicRegistry,
    NPM_CONFIG_USERCONFIG: support.userConfiguration,
    PLAYWRIGHT_BROWSERS_PATH: support.browsers,
    XDG_CACHE_HOME: support.cache,
  });
}

export function syntheticApplicationEnvironment(selected, settings, target, siteOrigin) {
  const environment = {
    APPLICATION_ENVIRONMENT: target, NEXT_PUBLIC_SITE_URL: siteOrigin,
    BUILD_SOURCE_REVISION: "a".repeat(40), WRANGLER_SEND_METRICS: "false",
    ...(target === "development" ? {} : { CLOUDFLARE_ENV: target }),
  };
  if (selected.includes("contact-form-web3forms")) Object.assign(environment, {
    NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: "00000000-0000-4000-8000-000000000001",
    CONTACT_TEST_EXPECTED_ACCESS_KEY: "00000000-0000-4000-8000-000000000001",
  });
  if (selected.includes("booking-calendly")) Object.assign(environment, {
    NEXT_PUBLIC_CALENDLY_URL: "https://calendly.com/egeria-synthetic-nonproduction/intro",
    BOOKING_TEST_EXPECTED_URL: "https://calendly.com/egeria-synthetic-nonproduction/intro",
    BOOKING_TEST_MODE: settings["booking-calendly"].mode,
    BOOKING_TEST_MULTILINGUAL: String(selected.includes("multilingual")),
  });
  if (selected.includes("analytics")) {
    Object.assign(environment, {
      NEXT_PUBLIC_ANALYTICS_ENABLED: "false", ANALYTICS_TEST_BUILD_FLAG: "false", ANALYTICS_TEST_TARGET: target,
      ANALYTICS_TEST_EXPECTED_SITE_ORIGIN: siteOrigin, ANALYTICS_TEST_EXPECTED_CLOUDFLARE_TOKEN: "",
      ANALYTICS_TEST_EXPECTED_GA4_ID: "", ANALYTICS_TEST_EXPECTED_CLARITY_ID: "", ANALYTICS_TEST_EXPECTED_VERIFICATION: "",
    });
    if (settings.analytics.operationalIntegrations.googleSearchConsole !== undefined) {
      environment.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION = "synthetic-verification-not-a-provider-token";
      environment.ANALYTICS_TEST_EXPECTED_VERIFICATION = target === "production" ? environment.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION : "";
    }
  }
  return environment;
}

async function createGeneratedFixtureOwner() {
  const path = await mkdtemp(join(tmpdir(), "egeria-generated-fixtures-"));
  const identity = await readPathIdentity(path);

  if (identity.isSymbolicLink || !identity.isDirectory) {
    fail("VERIFICATION_SETUP_FAILED");
  }
  await chmod(path, 0o700);
  return {
    path: identity.path,
    device: identity.device,
    inode: identity.inode,
    birthtimeNanoseconds: identity.birthtimeNanoseconds,
  };
}

async function createSupportPaths(root) {
  const home = join(root, "home");
  const browsers = join(root, "playwright-browsers");
  const cache = join(root, "cache");
  const temporary = join(root, "temporary");
  const store = join(root, "store");
  const userConfiguration = join(root, ".npmrc");

  await mkdir(home, { mode: 0o700 });
  await mkdir(browsers, { mode: 0o700 });
  await mkdir(cache, { mode: 0o700 });
  await mkdir(temporary, { mode: 0o700 });
  await mkdir(store, { mode: 0o700 });
  await writeFile(userConfiguration, "", { flag: "wx", mode: 0o600 });

  return { browsers, cache, home, temporary, store, userConfiguration };
}

async function snapshotTree(root) {
  let rootStats;
  try {
    rootStats = await lstat(root);
  } catch {
    fail("FIXTURE_PATH_INVALID");
  }
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
    fail("FIXTURE_PATH_INVALID");
  }

  const snapshot = [];

  async function visit(directory, relativeDirectory) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      fail("FIXTURE_PATH_INVALID");
    }
    entries.sort((left, right) => codePointCompare(left.name, right.name));

    for (const entry of entries) {
      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${entry.name}`
        : entry.name;
      const absolutePath = join(directory, entry.name);

      if (entry.isDirectory()) {
        await visit(absolutePath, relativePath);
      } else if (entry.isFile()) {
        let content;
        try {
          content = await readFile(absolutePath);
        } catch {
          fail("FIXTURE_PATH_INVALID");
        }
        snapshot.push({ path: relativePath, fingerprint: fingerprint(content) });
      } else {
        fail("FIXTURE_PATH_INVALID");
      }
    }
  }

  await visit(root, "");
  return snapshot.sort((left, right) => codePointCompare(left.path, right.path));
}

function hasLocalSource(value) {
  if (typeof value === "string") {
    return /^(?:file|link|workspace):/u.test(value);
  }
  if (Array.isArray(value)) {
    return value.some(hasLocalSource);
  }
  return (
    value !== null &&
    typeof value === "object" &&
    Object.values(value).some(hasLocalSource)
  );
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalJson);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => codePointCompare(left, right))
        .map(([key, entry]) => [key, canonicalJson(entry)]),
    );
  }
  return value;
}

function jsonMatches(actual, expected) {
  return (
    JSON.stringify(canonicalJson(actual)) ===
    JSON.stringify(canonicalJson(expected))
  );
}

async function readJson(path, failureCode) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    fail(failureCode);
  }
}

async function inspectFixture(root, contract) {
  const snapshot = await snapshotTree(root);
  const actualPaths = snapshot.map(({ path }) => path);
  const expectedPathSet = new Set(contract.expectedFiles);
  if (actualPaths.some((path) => !expectedPathSet.has(path))) {
    fail("GENERATED_FIXTURE_FORBIDDEN_ARTIFACT");
  }
  if (
    actualPaths.length !== contract.expectedFiles.length ||
    actualPaths.some((path, index) => path !== contract.expectedFiles[index])
  ) {
    fail("FIXTURE_INVENTORY_INVALID");
  }

  const rootManifest = await readJson(
    join(root, "package.json"),
    "FIXTURE_MANIFEST_INVALID",
  );
  const webManifest = await readJson(
    join(root, "apps/web/package.json"),
    "FIXTURE_MANIFEST_INVALID",
  );
  if (
    rootManifest.name !== contract.projectName ||
    webManifest.name !== `${contract.projectName}-web`
  ) {
    fail("FIXTURE_MANIFEST_INVALID");
  }
  if (hasLocalSource(rootManifest) || hasLocalSource(webManifest)) {
    fail("GENERATED_FIXTURE_LOCAL_DEPENDENCY");
  }
  if (
    !jsonMatches(rootManifest, expectedRootManifest(contract.projectName)) ||
    !jsonMatches(
      webManifest,
      expectedWebManifest(
        contract.projectName,
        contract.profile === "portfolio" ? "16.3.0" : "16.3.3",
        contract.expectedAppFoundationVersion !== undefined,
        contract.expectedApplicationPersistenceVersion === "0.2.0",
      ),
    )
  ) {
    fail("FIXTURE_MANIFEST_INVALID");
  }
  for (const requiredPackage of requiredPublicPackages) {
    if (
      webManifest[requiredPackage.field]?.[requiredPackage.name] !==
      requiredPackage.version
    ) {
      fail("FIXTURE_MANIFEST_INVALID");
    }
  }

  let workspacePolicy;
  try {
    workspacePolicy = await readFile(
      join(root, "pnpm-workspace.yaml"),
      "utf8",
    );
  } catch {
    fail("FIXTURE_WORKSPACE_POLICY_INVALID");
  }
  const persistence = contract.expectedApplicationPersistenceVersion === "0.2.0";
  const pluginVersion = contract.profile === "portfolio" ? "16.3.0" : "16.3.3";
  const workspacePolicyTemplate = expectedWorkspacePolicy(pluginVersion);
  const workspacePolicyBase = persistence
    ? workspacePolicyTemplate.replace("\nallowBuilds:\n", '  "@esbuild-kit/core-utils>esbuild": 0.25.4\n\nallowBuilds:\n') : workspacePolicyTemplate;
  const expectedPolicy = contract.expectedAppFoundationVersion !== undefined
    ? workspacePolicyBase.replace("\n\npatchedDependencies:", "\n  msgpackr-extract: false\n\npatchedDependencies:")
    : workspacePolicyBase;
  if (workspacePolicy !== expectedPolicy) {
    fail("FIXTURE_WORKSPACE_POLICY_INVALID");
  }

  let lockfile;
  try {
    lockfile = await readFile(join(root, "pnpm-lock.yaml"), "utf8");
  } catch {
    fail("FIXTURE_LOCKFILE_INVALID");
  }
  const lockfileTemplate = expectedLockfilePreamble(pluginVersion);
  const lockfilePreamble = persistence ? lockfileTemplate.replace("\n\npatchedDependencies:", "\n  '@esbuild-kit/core-utils>esbuild': 0.25.4\n\npatchedDependencies:") : lockfileTemplate;
  if (
    !lockfile.startsWith(lockfilePreamble) ||
    (lockfile.match(/^overrides:/gmu) ?? []).length !== 1 ||
    /^\s+[^:\r\n]+:\s+['"]?(?:(?:file|link|workspace|git|github|https?):|git\+)/mu.test(
      lockfile,
    ) ||
    /^\s+['"]?(?:(?:file|link|workspace|git|github|https?):|git\+)/mu.test(
      lockfile,
    ) ||
    /^\s+tarball:/mu.test(lockfile) ||
    /(?:^|[{,]\s*)tarball:/mu.test(lockfile)
  ) {
    fail("FIXTURE_LOCKFILE_INVALID");
  }
  for (const requiredPackage of requiredPublicPackages) {
    const entry = `'${requiredPackage.name}@${requiredPackage.version}':\n    resolution: `;
    const integrity = requiredPackage.integrity;
    if (![entry + "{integrity: " + integrity + "}", entry + "{ integrity: " + integrity + " }"].some(value => lockfile.includes(value))) {
      fail("FIXTURE_LOCKFILE_INVALID");
    }
  }

  if (contract.expectedAppFoundationVersion === undefined && /^\s+(?:effect:|['"]?effect@)/mu.test(lockfile)) {
    fail("FIXTURE_EFFECT_BOUNDARY_INVALID");
  }
  const expectedLockFingerprint = persistence
    ? "e70b7ad107c93d245c32f9f2c7f8424fd1c4a35a2c146679c55f30cc0c977830"
    : contract.profile === "portfolio"
      ? contract.expectedAppFoundationVersion === undefined
        ? "e46a83d2b2fcd45b1368965cc02694cd60d1d9000283341e884287a9df4f3597"
        : "526c473aa0bac20c39435216ceac88b6daca911367ac16a9a13dd1ad53fc3070"
      : contract.expectedAppFoundationVersion === undefined
        ? "041c4684a58db5b9e12753ce9f132fd02623cd0d8c87fc6d9a27b9d18a35a6ae"
        : "17988722d44ecb809a7d73d7eb553b33f422596f7089ab9ee04900242260c10f";
  if (fingerprint(lockfile) !== expectedLockFingerprint) {
    fail("FIXTURE_LOCKFILE_INVALID");
  }

  try {
    inspectEffectSourceBoundary(await readFixtureSources(root, snapshot), contract.expectedAppFoundationVersion !== undefined);
  } catch {
    fail("FIXTURE_EFFECT_BOUNDARY_INVALID");
  }
  return snapshot;
}

async function readFixtureSources(root, snapshot) {
  return Promise.all(snapshot.filter(({ path }) => /\.[cm]?[jt]sx?$/u.test(path)).map(async ({ path }) => ({
    path, content: await readFile(join(root, path)),
  })));
}

function contractForIdentifier(identifier) {
  const contract = generatedFixtureContracts.find(
    (candidate) => candidate.identifier === identifier,
  );
  if (contract === undefined) {
    fail("FIXTURE_IDENTIFIER_INVALID");
  }
  return contract;
}

const publicBuildWitnessDirectory = "tests/generated-fixtures/fixtures/public-build";
const publicBuildWitnessPaths = Object.freeze([
  ".egeria/state.json",
  "apps/web/app/layout.tsx",
  "apps/web/next.config.ts",
  "apps/web/scripts/check-application-environment.mjs",
  "apps/web/src/configuration/document-metadata.ts",
  "apps/web/src/configuration/public-build.ts",
]);
const jobAttemptWitnessDirectory = "tests/generated-fixtures/fixtures/job-attempts";
const jobAttemptWitnessPaths = Object.freeze([
  ".egeria/state.json",
  "apps/web/next.config.ts",
  "apps/web/src/application/job-delivery.ts",
  "apps/web/src/infrastructure/cloudflare/job-delivery.ts",
  "apps/web/src/infrastructure/memory/job-delivery.ts",
  "apps/web/tests/integration/fixtures/job-worker.mjs",
  "apps/web/tests/integration/job-worker.test.ts",
  "apps/web/tests/unit/job-delivery.test.ts",
  "apps/web/tests/unit/job-handler-composition.test.ts",
  "docs/background-job-delivery.md",
]);
const jobAttemptWitnesses = Object.freeze({
  "app-jobs": {
    deploymentVersion: "0.17.0",
    digest: "5d1cf472814f6da7b67d82a370ffd312f3ddd935164b23a37b7b373b052b86ac",
  },
  "app-persistence-jobs-email": {
    deploymentVersion: "0.18.0",
    digest: "b1efbb84e637954dc43ea9412b74a84d57cbfa1ab6e4847cce3ead751af39ef0",
  },
});
const retainedFixtureDigests = Object.freeze({
  "portfolio": "8eb404916e43d7d3cfb6d2fc2c42c9a62cc2874f4f6690a976775bdf96b75cf4",
  "portfolio-calendly": "38887cc49a9782ed75327f9e1c95d05cc6c6ff99f986069a58249513c3302770",
  "site": "85aca4d30591100a04e16aef620655d4089d359fe0da146ae23cde138758ccb3",
  "site-multilingual": "28ddc8ea570a20fbed0f9679eb702248cc26db40305825057d61f59d62bd4e8e",
  "site-public-integrations": "c4272d9ad68eb7e53773edb6ae56084db05c6992e652a2d4f5c5775a863affa6",
  "app": "d2e36928bb5142c31a241d10c1239ccc182965fba2377d6edfb2daed429d5d5c",
  "app-all-optional-integrations": "b83cf9976c7ce24586719f26522dfc7a1b0577c2c6417c441b2d8313d85b70e5",
  "app-persistence": "174302b580953fd41ececd9e440b318c5b33c106af8e58d6b0f618fc618a0b85",
  "portfolio-email": "80a1fa553ee53436e721f9fadcc30aac790a5c0fb61aac38dba1534a7232264d",
  "app-persistence-email": "f27bad80efca9c2b1847b1121468ea374f4a2d07985ebad0411b6d7d9e1a0524",
  "site-contact-form": "fd8c3ee291bcacf958619b380bfa3c926049462fa39505b7a3f3f19dd3dc8ffb",
  "app-jobs": "bae3ec20b6597e06a3d63429e3fbc20db46b0a3cfaee5f32ac4f9f2bfe5c892e",
  "app-persistence-jobs-email": "4fcc2a241639c20849fb697906b4371b820024d56770fcb0274095c61053f3e8",
});
const publicBuildFixtureDigests = Object.freeze({
  "portfolio": "b99697c5e430a1ffa493f06adb84f6c77bb123dcad1980027304fd83ef028908",
  "portfolio-calendly": "e5f9cd0516c11a5e4469cc9fbbbfb6d7edc693b8de35a440afddb748692faa21",
  "site": "acd5434db2c2dd70e5515fd6a9e976056ebc9d1f0a089fa3866f493e623a5cb0",
  "site-multilingual": "55afd4ac0766c710a9d757f1dead9eef23ab7cf2714ed7bbb102f819b218220e",
  "site-public-integrations": "871588a3d3219e755c9d926565aa1a92158a5550e2cb52668665b83c2462f4c3",
  "app": "eef57916a8e67e1a53279eb541fa53fb8a595f10465894972b5a929339199d84",
  "app-all-optional-integrations": "71977c46898f8d7273390a3c5bbeb3241d1ca8848dcc5bc9cc59b448729c1621",
  "app-persistence": "334fd73d363554a678c4ef15fe70c4fd0911e90b18a6cef681290ddb58721ec3",
  "portfolio-email": "289bb0c323bfbd78960e72f8ba34028442494dea4c3edfbda2a0cca26598d430",
  "app-persistence-email": "9b391237237a80b67287ba3c51c321cd8f9d729390a9b657edfe175cc10ca667",
  "site-contact-form": "bfd91b292b6770d52938fd9c86943af38ada7a2e109bd267e82872f0f7c1a10c",
  "app-jobs": "f73f8313fa30dd09cc9822b311992d072bfc1f00e9bdb1397707fc81f2f91181",
  "app-persistence-jobs-email": "3ba4a3116ecfa8094ec12b09281c1c4965130079807e7142949183abc86700e7",
});
const successorDeploymentVersions = Object.freeze({
  "0.9.0": "0.13.0", "0.10.0": "0.14.0", "0.11.0": "0.15.0", "0.12.0": "0.16.0",
});

function currentFixtureContract(identifier) {
  const retained = contractForIdentifier(identifier);
  const jobAttempt = jobAttemptWitnesses[identifier];
  return Object.freeze({
    ...retained,
    expectedFiles: Object.freeze([...new Set([...retained.expectedFiles, ...publicBuildWitnessPaths])].sort(codePointCompare)),
    expectedSurfaces: retained.expectedSurfaces + 2,
    expectedDeploymentCloudflareVersion: jobAttempt?.deploymentVersion ?? successorDeploymentVersions[retained.expectedDeploymentCloudflareVersion],
    ...(jobAttempt === undefined ? {} : { expectedBackgroundJobVersion: "0.4.0" }),
  });
}

export function contractForGeneratedProject(identifier, expectedProjectName) {
  const app = identifier === "app-calendly" ? currentFixtureContract("app") : undefined;
  const contract = app === undefined ? currentFixtureContract(identifier) : Object.freeze({
    ...app,
    identifier,
    projectName: "acme-app-calendly",
    displayName: "Acme App Booking",
    expectedFiles: Object.freeze([
      ...app.expectedFiles.filter(path => !bookingCalendlyFiles.includes(path)),
      ...bookingCalendlyFiles,
    ].sort(codePointCompare)),
    expectedCapabilities: Object.freeze([...app.expectedCapabilities, "booking-calendly"]),
    expectedCapabilitySettings: portfolioCalendlySettings,
    expectedBookingCalendlyVersion: "0.2.0",
    expectedSurfaces: app.expectedSurfaces + 9,
    visualRegression: false,
  });
  if (expectedProjectName === undefined) return contract;
  return Object.freeze({ ...contract, projectName: expectedProjectName });
}

export function inspectGeneratedFixture(root, identifier) {
  return inspectFixture(resolve(root), contractForIdentifier(identifier));
}

async function defaultRunCommand(input) {
  const { stdout } = await execFileAsync(
    input.executable,
    [...input.arguments],
    {
      cwd: input.cwd,
      env: input.environment,
      timeout: input.timeout,
      ...isolatedProcessOptions,
    },
  );
  return stdout;
}

async function measureVisualArtifactTree(root, maximumBytes) {
  let totalBytes = 0;

  async function visit(directory) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      fail("VISUAL_ARTIFACT_EXPORT_FAILED");
    }
    entries.sort((left, right) => codePointCompare(left.name, right.name));

    for (const entry of entries) {
      const path = join(directory, entry.name);
      let stats;
      try {
        stats = await lstat(path);
      } catch {
        fail("VISUAL_ARTIFACT_EXPORT_FAILED");
      }
      if (stats.isSymbolicLink()) {
        fail("VISUAL_ARTIFACT_EXPORT_FAILED");
      }
      if (stats.isDirectory()) {
        await visit(path);
      } else if (stats.isFile()) {
        totalBytes += stats.size;
        if (totalBytes > maximumBytes) {
          fail("VISUAL_ARTIFACT_EXPORT_FAILED");
        }
      } else {
        fail("VISUAL_ARTIFACT_EXPORT_FAILED");
      }
    }
  }

  await visit(root);
  return totalBytes;
}

async function captureVisualFailureArtifacts({
  failureCode = "VISUAL_REGRESSION_FAILED",
  identifier,
  validationRoot,
  artifactRoot = generatedVisualArtifactsRoot,
  maximumBytes = visualArtifactMaximumBytes,
  previewDiagnostics,
}) {
  await mkdir(artifactRoot, {
    recursive: true,
    mode: 0o700,
  });
  let artifactRootStats;
  try {
    artifactRootStats = await lstat(artifactRoot);
  } catch {
    fail("VISUAL_ARTIFACT_EXPORT_FAILED");
  }
  if (artifactRootStats.isSymbolicLink() || !artifactRootStats.isDirectory()) {
    fail("VISUAL_ARTIFACT_EXPORT_FAILED");
  }
  await chmod(artifactRoot, 0o700);

  const diagnosticContent = previewDiagnostics === undefined
    ? undefined
    : `${JSON.stringify(previewDiagnostics)}\n`;
  let totalBytes = Buffer.byteLength(diagnosticContent ?? "");
  if (totalBytes > maximumBytes) fail("VISUAL_ARTIFACT_EXPORT_FAILED");
  const availableArtifacts = [];

  for (const artifact of visualArtifactDirectories) {
    const source = join(validationRoot, artifact.relativeSource);
    let sourceStats;
    try {
      sourceStats = await lstat(source);
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      fail("VISUAL_ARTIFACT_EXPORT_FAILED");
    }
    if (sourceStats.isSymbolicLink() || !sourceStats.isDirectory()) {
      fail("VISUAL_ARTIFACT_EXPORT_FAILED");
    }

    const bytes = await measureVisualArtifactTree(
      source,
      maximumBytes - totalBytes,
    );
    totalBytes += bytes;
    availableArtifacts.push({ ...artifact, bytes, source });
  }

  const outputRoot = await mkdtemp(
    join(artifactRoot, `${identifier}-`),
  );
  await chmod(outputRoot, 0o700);

  for (const artifact of availableArtifacts) {
    await cp(artifact.source, join(outputRoot, artifact.destination), {
      recursive: true,
      force: false,
      errorOnExist: true,
      dereference: false,
    });
  }

  if (diagnosticContent !== undefined) {
    await writeFile(join(outputRoot, "preview-diagnostics.json"), diagnosticContent, {
      flag: "wx", mode: 0o600,
    });
  }

  await writeFile(
    join(outputRoot, "failure.json"),
    `${JSON.stringify({
      code: failureCode,
      fixture: identifier,
    })}\n`,
    { flag: "wx", mode: 0o600 },
  );
}

export const captureVisualFailureArtifactsForTesting =
  captureVisualFailureArtifacts;

const previewDiagnosticIndicators = [
  ["proxy-worker-error", /Error inside ProxyWorker/u],
  ["network-connection-lost", /Network connection lost\./u],
  ["connection-refused", /\b(?:ECONNREFUSED|ERR_CONNECTION_REFUSED)\b/u],
  ["wrangler-error", /✘\s*\[ERROR\]/u],
  ["broken-pipe", /\b(?:EPIPE|Broken pipe)\b/u],
  ["webserver-started", /\bpw:webserver\s+Process started\b/u],
  ["webserver-ready", /\bpw:webserver\s+WebServer available\b/u],
  ["webserver-teardown-started", /\bpw:webserver\s+Terminating the WebServer\b/u],
  ["webserver-teardown-finished", /\bpw:webserver\s+Terminated the WebServer\b/u],
];

function inspectPreviewOutput(value) {
  if (value === undefined || value === null) return { status: "absent" };
  if (typeof value !== "string" && !Buffer.isBuffer(value)) return { status: "refused" };
  const bytes = Buffer.byteLength(value);
  if (bytes > isolatedProcessOptions.maxBuffer) return { status: "refused" };
  const text = stripVTControlCharacters(value.toString());
  const observations = previewDiagnosticIndicators
    .map(([identifier, pattern]) => ({ identifier, position: text.search(pattern) }))
    .filter(({ position }) => position !== -1);
  return {
    status: "inspected", bytes,
    indicators: observations.map(({ identifier }) => identifier),
    // First recognized matches within this stream; not a complete event timeline.
    firstOccurrences: [...observations].sort((left, right) => left.position - right.position).map(({ identifier }) => identifier),
  };
}

async function snapshotPreviewLogs(home) {
  try {
    const configurationParts = process.platform === "darwin"
      ? ["Library", "Preferences"]
      : process.platform === "win32"
        ? ["AppData", "Roaming", "xdg.config"]
        : [".config"];
    let directory = home;
    for (const part of ["", ...configurationParts, ".wrangler", "logs"]) {
      directory = join(directory, part);
      const stats = await lstat(directory);
      if (!stats.isDirectory() || stats.isSymbolicLink()) throw new Error();
    }
    const files = new Map();
    let entries = 0;
    for await (const entry of await opendir(directory)) {
      if (++entries > 32) throw new Error();
      if (!/^wrangler-[A-Za-z0-9_.-]+\.log$/u.test(entry.name)) continue;
      const path = join(directory, entry.name);
      const stats = await lstat(path);
      if (!stats.isFile() || stats.isSymbolicLink()) throw new Error();
      files.set(entry.name, { path, size: stats.size, device: stats.dev, inode: stats.ino, modified: stats.mtimeMs });
    }
    return { status: "inspected", files };
  } catch (error) {
    return { status: error?.code === "ENOENT" ? "absent" : "refused", files: new Map() };
  }
}

async function inspectPreviewLogs(home, before) {
  const after = await snapshotPreviewLogs(home);
  if (before.status === "refused" || after.status === "refused") return { status: "refused" };
  if (after.status === "absent") return { status: "absent" };
  const indicators = new Set();
  let bytes = 0;
  let logsInspected = 0;
  try {
    for (const [name, file] of after.files) {
      const previous = before.files.get(name);
      const sameFile = previous?.device === file.device && previous?.inode === file.inode;
      if (sameFile && previous.size === file.size && previous.modified === file.modified) continue;
      if (sameFile && file.size <= previous.size) throw new Error();
      const offset = sameFile ? previous.size : 0;
      const length = file.size - offset;
      bytes += length;
      if (bytes > isolatedProcessOptions.maxBuffer) throw new Error();
      const handle = await open(file.path, fileConstants.O_RDONLY | fileConstants.O_NOFOLLOW);
      try {
        const stats = await handle.stat();
        if (!stats.isFile() || stats.dev !== file.device || stats.ino !== file.inode || stats.size !== file.size || stats.mtimeMs !== file.modified) throw new Error();
        const content = Buffer.alloc(length);
        const result = await handle.read(content, 0, length, offset);
        if (result.bytesRead !== length) throw new Error();
        for (const indicator of inspectPreviewOutput(content).indicators) indicators.add(indicator);
        logsInspected += 1;
      } finally {
        await handle.close();
      }
    }
    return {
      status: "inspected", logsInspected,
      indicators: previewDiagnosticIndicators.map(([identifier]) => identifier).filter((identifier) => indicators.has(identifier)),
    };
  } catch {
    return { status: "refused" };
  }
}

const openNextDiagnosticIndicators = [
  ["skipped-next-build", "Skipping Next.js build"],
  ["building-next-app", "Building Next.js app"],
  ["generating-bundle", "Generating bundle"],
  ["opennext-complete", "OpenNext build complete."],
];

function inspectOpenNextOutput(value) {
  try {
    if (value === undefined || value === null) return { status: "absent" };
    if (typeof value !== "string" && !Buffer.isBuffer(value)) return { status: "refused" };
    if (value.length > isolatedProcessOptions.maxBuffer) return { status: "refused" };
    const bytes = Buffer.byteLength(value);
    if (bytes > isolatedProcessOptions.maxBuffer) return { status: "refused" };
    const text = stripVTControlCharacters(typeof value === "string" ? value : Buffer.prototype.toString.call(value));
    return {
      status: "inspected", bytes,
      indicators: openNextDiagnosticIndicators.filter(([, literal]) => text.includes(literal)).map(([identifier]) => identifier),
    };
  } catch {
    return { status: "refused" };
  }
}

function inspectOpenNextFailure(cause, timing) {
  try {
    const details = {};
    if (cause !== null && (typeof cause === "object" || typeof cause === "function")) {
      for (const field of ["code", "signal", "killed", "stdout", "stderr"]) {
        const descriptor = Object.getOwnPropertyDescriptor(cause, field);
        if (descriptor !== undefined && !Object.hasOwn(descriptor, "value")) return { status: "refused" };
        details[field] = descriptor?.value;
      }
    }
    return {
      process: {
        exitCode: Number.isInteger(details.code) && details.code >= 0 && details.code <= 255 ? details.code : null,
        signal: typeof details.signal === "string" && Object.hasOwn(operatingSystemConstants.signals, details.signal) ? details.signal : null,
        killed: typeof details.killed === "boolean" ? details.killed : null,
        outputLimitExceeded: details.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER",
      },
      timing,
      stdout: inspectOpenNextOutput(details.stdout),
      stderr: inspectOpenNextOutput(details.stderr),
    };
  } catch {
    return { status: "refused" };
  }
}

const previewTestFiles = new Map([
  "site-quality", "site-routing", "multilingual-routing", "analytics-consent", "calendly-booking", "web3forms-contact",
].map(name => [`${name}.spec.ts`, `apps/web/tests/e2e/${name}.spec.ts`]));
const previewFailureSiteFiles = new Map([
  ...previewTestFiles,
  ["application-test.ts", "apps/web/tests/e2e/application-test.ts"],
  ["application-transport.ts", "apps/web/tests/e2e/application-transport.ts"],
]);
const previewTransportCodes = new Set([
  "ORIGIN_INVALID", "CREDENTIALS_INVALID", "DEBUG_FORBIDDEN", "DIAGNOSTICS_FORBIDDEN", "DEVELOPMENT_MODE_INVALID",
  "DESTINATION_INVALID", "REQUEST_FAILED", "REDIRECT_INVALID", "REDIRECT_LIMIT", "NAVIGATION_FAILED",
  "BROWSER_REDIRECT_FORBIDDEN", "READINESS_FAILED", "BROWSER_REQUEST_BLOCKED",
].map(code => `APPLICATION_TRANSPORT_${code}`));
const previewTestResultCategories = Object.freeze({
  passed: "none", failed: "test-failed", timedOut: "test-timeout", skipped: "none", interrupted: "interrupted",
});
const previewTestResultLimit = 128;

async function preparePreviewTestReport(owner, supportIdentity, validationRoot, sourceRoot) {
  try {
    const directories = [owner, supportIdentity];
    for (const root of [validationRoot, sourceRoot]) {
      let path = root;
      for (const part of ["", "apps", "web", "tests", "e2e"]) {
        path = join(path, part);
        directories.push(await readPathIdentity(path));
      }
    }
    if (!(await Promise.all(directories.map(pathIdentityMatches))).every(Boolean)) return undefined;
    const testRoot = (await realpath(join(validationRoot, "apps/web/tests/e2e"))).replaceAll("\\", "/");
    const reportPath = join(supportIdentity.path, "preview-results.json");
    try { await lstat(reportPath); return undefined; }
    catch (error) { if (error?.code !== "ENOENT") return undefined; }
    return { reportPath, testRoot, directories };
  } catch { return undefined; }
}

async function readPreviewDiagnosticFile(path, openFile = open) {
  const before = await lstat(path);
  if (!before.isFile() || before.isSymbolicLink() || before.size > isolatedProcessOptions.maxBuffer) throw new Error();
  const handle = await openFile(path, fileConstants.O_RDONLY | fileConstants.O_NOFOLLOW | fileConstants.O_NONBLOCK);
  const unchanged = stats => stats.isFile() && stats.dev === before.dev && stats.ino === before.ino &&
    stats.size === before.size && stats.mtimeMs === before.mtimeMs && stats.ctimeMs === before.ctimeMs;
  try {
    if (!unchanged(await handle.stat())) throw new Error();
    const content = Buffer.alloc(before.size);
    const result = await handle.read(content, 0, content.length, 0);
    if (result.bytesRead !== content.length || !unchanged(await handle.stat()) || !unchanged(await lstat(path))) throw new Error();
    return content;
  } finally { await handle.close(); }
}

const previewResponseDisposalErrors = new Map([
  ["Target page, context or browser has been closed", "target-closed"],
  ["Test ended.", "test-ended"],
  ["Response has been disposed", "response-disposed"],
]);

function projectPreviewFailureSite(result, testRoot, sources) {
  const projected = {};
  const location = result.errorLocation;
  if (typeof location?.file === "string" && Number.isInteger(location.line) && location.line > 0 &&
    Number.isInteger(location.column) && location.column > 0) {
    const file = location.file.replaceAll("\\", "/");
    for (const [name, source] of sources) {
      if (file !== `${testRoot}/${name}`) continue;
      const line = source.lines[location.line - 1];
      if (typeof line === "string" && location.column <= line.length) {
        projected.errorLocation = { file: source.file, line: location.line, column: location.column };
        if (name === "application-transport.ts" && ["failed", "timedOut"].includes(result.status) &&
            /^\s*(?:finally|try) \{ await response\??\.dispose\(\); \}$/u.test(line)) {
          const message = result.error?.message;
          if (typeof message !== "string") projected.responseDisposalError = "unavailable";
          else {
            const reason = stripVTControlCharacters(message).split(/\r?\n/u, 1)[0]
              .replace(/^Error: /u, "").replace(/^apiResponse\.dispose: /u, "");
            projected.responseDisposalError = previewResponseDisposalErrors.get(reason) ??
              (/^Test timeout of [1-9]\d*ms exceeded\.$/u.test(reason) ? "test-timeout" : "unclassified");
          }
        }
      }
      break;
    }
  }
  const code = result.error?.message;
  if (sources.has("application-transport.ts") && previewTransportCodes.has(code)) projected.transportCode = code;
  return projected;
}

function projectPreviewTestReport(report, testRoot, sources) {
  if (report?.config?.version !== "1.62.1" || typeof report.config.rootDir !== "string" ||
    report.config.rootDir.replaceAll("\\", "/") !== testRoot || !Array.isArray(report.suites) ||
    !Array.isArray(report.errors) || report.errors.length > previewTestResultLimit) throw new Error();
  const cases = [];
  let resultCount = 0;
  const pending = [...report.suites].reverse();
  while (pending.length > 0) {
    const suite = pending.pop();
    if (!suite || !Array.isArray(suite.specs) || (suite.suites !== undefined && !Array.isArray(suite.suites))) throw new Error();
    for (const spec of suite.specs) {
      const source = previewTestFiles.has(spec?.file) ? sources.get(spec.file) : undefined;
      const line = source?.lines[spec.line - 1];
      if (!source || !Number.isInteger(spec.line) || spec.line < 1 || !Number.isInteger(spec.column) || spec.column < 1 ||
        typeof line !== "string" || line.slice(0, spec.column - 1).trim() !== "" ||
        !/^test\(/u.test(line.slice(spec.column - 1)) || !Array.isArray(spec.tests) || spec.tests.length === 0) throw new Error();
      for (const test of spec.tests) {
        if (!["expected", "unexpected", "flaky", "skipped"].includes(test?.status) || !Array.isArray(test.results)) throw new Error();
        const selected = test.status === "unexpected" || test.status === "flaky";
        if (test.results.length > 2 || (selected && test.results.length === 0)) throw new Error();
        const results = test.results.map((result, retry) => {
          if (result?.retry !== retry || !Object.hasOwn(previewTestResultCategories, result.status)) throw new Error();
          return { retry, status: result.status, category: previewTestResultCategories[result.status],
            ...(selected ? projectPreviewFailureSite(result, testRoot, sources) : {}) };
        });
        if (selected) {
          resultCount += results.length;
          if (resultCount > previewTestResultLimit) throw new Error();
          cases.push({ file: source.file, line: spec.line, column: spec.column, outcome: test.status, results });
        }
      }
    }
    pending.push(...(suite.suites ?? []).toReversed());
  }
  return { status: "inspected", globalErrorCount: report.errors.length, cases };
}

async function inspectPreviewTestReport({ prepared, validationRoot, sourceRoot, sourceSnapshot, openReport }) {
  if (prepared === undefined) return { status: "refused" };
  try {
    if (!(await Promise.all(prepared.directories.map(pathIdentityMatches))).every(Boolean)) throw new Error();
    let content;
    try { content = await readPreviewDiagnosticFile(prepared.reportPath, openReport); }
    catch (error) { if (error?.code === "ENOENT") return { status: "absent" }; throw error; }
    const sources = new Map();
    for (const [name, file] of previewFailureSiteFiles) {
      const entry = sourceSnapshot.find(item => item.path === file);
      if (entry === undefined) continue;
      const original = await readPreviewDiagnosticFile(join(sourceRoot, file));
      const copied = await readPreviewDiagnosticFile(join(validationRoot, file));
      if (fingerprint(original) !== entry.fingerprint || fingerprint(copied) !== entry.fingerprint) throw new Error();
      sources.set(name, { file, lines: original.toString("utf8").split(/\r?\n/u) });
    }
    const result = projectPreviewTestReport(JSON.parse(content), prepared.testRoot, sources);
    if (!(await Promise.all(prepared.directories.map(pathIdentityMatches))).every(Boolean)) throw new Error();
    return result;
  } catch { return { status: "refused" }; }
}

async function runExpectedCommand(runCommand, input, failureCode) {
  const logsBefore = failureCode === "BROWSER_PREVIEW_FAILED"
    ? await snapshotPreviewLogs(input.environment.HOME)
    : undefined;
  const commandStarted = failureCode === "OPENNEXT_BUILD_FAILED" ? performance.now() : undefined;
  const commandInput = failureCode === "BROWSER_PREVIEW_FAILED"
    ? { ...input, environment: { ...input.environment, DEBUG: "pw:webserver" } }
    : input;
  try {
    return await runCommand(commandInput);
  } catch (cause) {
    const error = new GeneratedFixtureVerificationError(failureCode);
    if (commandStarted !== undefined) {
      error.commandDiagnostics = inspectOpenNextFailure(cause, {
        elapsedMilliseconds: performance.now() - commandStarted,
        timeoutMilliseconds: input.timeout,
      });
    }
    if (logsBefore !== undefined) {
      try {
        error.previewDiagnostics = {
          process: {
            exitCode: Number.isInteger(cause?.code) && cause.code >= 0 && cause.code <= 255 ? cause.code : null,
            signal: typeof cause?.signal === "string" && Object.hasOwn(operatingSystemConstants.signals, cause.signal) ? cause.signal : null,
            killed: cause?.killed === true,
            outputLimitExceeded: cause?.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER",
          },
          stdout: inspectPreviewOutput(cause?.stdout),
          stderr: inspectPreviewOutput(cause?.stderr),
          wrangler: await inspectPreviewLogs(input.environment.HOME, logsBefore),
        };
      } catch {
        error.previewDiagnostics = { status: "refused" };
      }
    }
    throw error;
  }
}

// The fixed visual spec has exactly two cases and uses Playwright's list reporter.
function observedVisualComparisons(stdout) {
  if (typeof stdout !== "string") return false;
  const lines = stripVTControlCharacters(stdout).split(/\r?\n/u).map(line => line.trim()).filter(Boolean);
  const start = lines.indexOf("Running 2 tests using 1 worker");
  if (start === -1 || lines.length - start !== 4) return false;

  const passedCase = /^(?:✓|ok) +([12]) \[chromium\] › tests\/visual\/home-visual\.spec\.ts:\d+:\d+ › matches the (desktop|mobile) home viewport \((?:\d{1,4}ms|\d{1,2}\.\d[sm])\)$/u;
  const desktop = passedCase.exec(lines[start + 1]);
  const mobile = passedCase.exec(lines[start + 2]);
  return desktop?.[1] === "1" && desktop[2] === "desktop" && mobile?.[1] === "2" && mobile[2] === "mobile" &&
    /^2 passed \((?:\d{1,4}ms|\d{1,2}\.\d[sm])\)$/u.test(lines[start + 3]);
}

async function verifySourcesWithAdapters(
  adapters,
  sourcesBefore,
  options = defaultVerificationOptions,
  admittedAudit,
  firstFixture = 0,
) {
  const selectedSources = sourcesBefore.slice(firstFixture);
  let owner;
  try {
    owner = await adapters.createOwner();
  } catch {
    fail("VERIFICATION_SETUP_FAILED");
  }
  if (!(await pathIdentityMatches(owner))) {
    fail("VERIFICATION_SETUP_FAILED");
  }

  let pendingError;
  const workerIntegration = { executed: [], skipped: [] };
  const bindingIntegration = { executed: [], skipped: [] };
  const appBuildEvidence = [];
  const auditDispositions = [];
  const visualComparisons = [];
  try {
    for (const source of selectedSources) {
      const validationRoot = join(
        owner.path,
        `${source.contract.identifier}-project`,
      );
      const supportRoot = join(
        owner.path,
        `${source.contract.identifier}-support`,
      );

      await cp(source.root, validationRoot, {
        recursive: true,
        force: false,
        errorOnExist: true,
        dereference: false,
      });
      await mkdir(supportRoot, { mode: 0o700 });
      const support = await createSupportPaths(supportRoot);
      try {
        await prepareVerifierOnlyBrowserProof(validationRoot, source.contract);
      } catch {
        fail("VERIFICATION_SETUP_FAILED");
      }
      const environment = {
        ...createChildEnvironment(support),
        ...syntheticApplicationEnvironment(source.contract.expectedCapabilities,
          source.contract.expectedCapabilitySettings, "development", "http://localhost:3000"),
      };
      const webManifest = await readJson(
        join(validationRoot, "apps/web/package.json"), "FIXTURE_MANIFEST_INVALID",
      );
      const hasWorkerIntegration = Object.hasOwn(webManifest.scripts, "test:integration:cloudflare");
      const hasBindingIntegration = source.contract.expectedApplicationPersistenceVersion === "0.2.0";
      const hasJobs = source.contract.expectedBackgroundJobVersion !== undefined;
      if (!hasBindingIntegration) bindingIntegration.skipped.push(source.contract.identifier);
      const commandInput = (arguments_, timeout = commandTimeoutMilliseconds) => ({
        executable: "pnpm",
        arguments: arguments_,
        cwd: validationRoot,
        environment,
        timeout,
      });

      const version = await runExpectedCommand(
        adapters.runCommand,
        commandInput(["--version"], versionTimeoutMilliseconds),
        "PNPM_VERSION_INVALID",
      );
      if (
        typeof version !== "string" ||
        version.trim() !== requiredPnpmVersion
      ) {
        fail("PNPM_VERSION_INVALID");
      }

      const commands = [
        {
          arguments: [
            "install",
            "--frozen-lockfile",
            "--store-dir",
            support.store,
          ],
          failureCode: "FROZEN_INSTALL_FAILED",
        },
        {
          arguments: ["peers", "check"],
          failureCode: "PEER_DEPENDENCY_CHECK_FAILED",
        },
        {
          arguments: admittedAudit ? ["audit", "--audit-level", "info", "--json"] : ["audit", "--audit-level", "moderate"],
          failureCode: "DEPENDENCY_AUDIT_FAILED",
        },
        {
          arguments: ["audit", "signatures"],
          failureCode: "REGISTRY_SIGNATURE_CHECK_FAILED",
        },
        { arguments: ["run", "lint"], failureCode: "LINT_FAILED" },
        ...(hasBindingIntegration ? [{
          arguments: ["run", "typecheck"],
          failureCode: "CLEAN_TYPECHECK_FAILED",
        }] : []),
        {
          arguments: ["--dir", "apps/web", "run", "cf-typegen"],
          failureCode: "CLOUDFLARE_TYPE_GENERATION_FAILED",
        },
        {
          arguments: ["run", "typecheck"],
          failureCode: "TYPECHECK_FAILED",
        },
        { arguments: ["run", "test:unit"], failureCode: "UNIT_TESTS_FAILED" },
        {
          arguments: ["run", "test:component"],
          failureCode: "COMPONENT_TESTS_FAILED",
        },
        { arguments: ["--dir", "apps/web", "run", "test:deployment-contracts"], failureCode: "DEPLOYMENT_CONTRACTS_FAILED" },
        { arguments: ["--dir", "apps/web", "run", "check:environment"], failureCode: "APPLICATION_ENVIRONMENT_INVALID" },
        ...(hasJobs ? [{ arguments: ["--dir", "apps/web", "exec", "node", "scripts/check-job-delivery.mjs", "local"], failureCode: "JOB_CONFIGURATION_FAILED" }] : []),
        { arguments: ["run", "build"], failureCode: "NEXT_BUILD_FAILED" },
        {
          arguments: [
            "--dir",
            "apps/web",
            "exec",
            "opennextjs-cloudflare",
            "build",
            "--skipNextBuild",
          ],
          failureCode: "OPENNEXT_BUILD_FAILED",
        },
        ...(hasJobs ? [{ arguments: ["--dir", "apps/web", "exec", "wrangler", "deploy", "--dry-run", "--outdir", ".open-next/jobs-bundle", "--metafile", ".open-next/jobs-inputs.json", "--x-provision=false", "--x-auto-create=false"], failureCode: "JOB_BUNDLE_FAILED" }] : []),
        { arguments: ["--dir", "apps/web", "run", "check:prepared-artifact", "record", "development", environment.BUILD_SOURCE_REVISION, "--local"], failureCode: "PREPARED_ARTIFACT_FAILED" },
        {
          arguments: ["--dir", "apps/web", "run", "--if-present", "test:integration:cloudflare"],
          failureCode: "WORKER_INTEGRATION_FAILED",
        },
        ...(hasBindingIntegration ? [{
          arguments: ["--dir", "apps/web", "run", "test:integration:bindings"],
          failureCode: "BINDING_INTEGRATION_FAILED",
        }] : []),
        { arguments: ["--dir", "apps/web", "run", "check:prepared-artifact", "verify", "development", environment.BUILD_SOURCE_REVISION, "--local"], failureCode: "PREPARED_ARTIFACT_FAILED" },
        { arguments: ["--dir", "apps/web", "run", "browser:install"], failureCode: "BROWSER_INSTALL_FAILED" },
        { arguments: ["--dir", "apps/web", "run", "test:transport"], failureCode: "TRANSPORT_CONTRACTS_FAILED" },
        { arguments: ["--dir", "apps/web", "run", "test:e2e:dev"], failureCode: "BROWSER_DEVELOPMENT_FAILED" },
        {
          arguments: ["--dir", "apps/web", "run", "test:e2e:preview"],
          failureCode: "BROWSER_PREVIEW_FAILED",
        },
        ...(options.includeVisual && source.contract.visualRegression
          ? [
              {
                arguments: ["--dir", "apps/web", "run", "test:visual"],
                failureCode: "VISUAL_REGRESSION_FAILED",
              },
            ]
          : []),
        { arguments: ["--dir", "apps/web", "run", "check:prepared-artifact", "verify", "development", environment.BUILD_SOURCE_REVISION, "--local"], failureCode: "PREPARED_ARTIFACT_FAILED" },
      ];

      for (const command of commands) {
        try {
          if (command.failureCode === "DEPENDENCY_AUDIT_FAILED" && admittedAudit) {
            const audit = await runExpectedCommand(admittedAudit,
              commandInput(command.arguments), command.failureCode);
            const auditAccepted = audit?.status === "passed"
              ? audit.thresholdExitCode === 0 && [0, 1].includes(audit.rawExitCode)
              : audit?.status === "accepted-with-security-exception" && audit.thresholdExitCode === 1 && audit.rawExitCode === 1;
            if (!auditAccepted) fail(command.failureCode);
            auditDispositions.push({ fixture: source.contract.identifier, ...audit });
          } else {
            const output = await runExpectedCommand(adapters.runCommand, commandInput(command.arguments), command.failureCode);
            if (command.failureCode === "VISUAL_REGRESSION_FAILED" && observedVisualComparisons(output)) {
              visualComparisons.push({ fixture: source.contract.identifier, passedCases: 2 });
            }
          }
          if (command.failureCode === "BINDING_INTEGRATION_FAILED") bindingIntegration.executed.push(source.contract.identifier);
          if (command.failureCode === "WORKER_INTEGRATION_FAILED") {
            workerIntegration[hasWorkerIntegration ? "executed" : "skipped"].push(source.contract.identifier);
            if (hasWorkerIntegration) {
              try {
                appBuildEvidence.push({
                  fixture: source.contract.identifier,
                  ...await inspectAppEffectBuild(validationRoot, await readFixtureSources(source.root, source.snapshot)),
                });
              } catch {
                fail("EFFECT_BUILD_BOUNDARY_FAILED");
              }
            }
          }
        } catch (error) {
          if (
            error instanceof GeneratedFixtureVerificationError &&
            ["BROWSER_PREVIEW_FAILED", "VISUAL_REGRESSION_FAILED"].includes(
              error.code,
            ) &&
            adapters.captureVisualArtifacts !== undefined
          ) {
            try {
              await adapters.captureVisualArtifacts({
                failureCode: error.code,
                identifier: source.contract.identifier,
                validationRoot,
                ...(error.previewDiagnostics === undefined ? {} : { previewDiagnostics: error.previewDiagnostics }),
              });
            } catch {
              error.artifactExportCode = "VISUAL_ARTIFACT_EXPORT_FAILED";
            }
          }
          throw error;
        }
      }
    }
  } catch (error) {
    pendingError =
      error instanceof GeneratedFixtureVerificationError
        ? error
        : new GeneratedFixtureVerificationError("VERIFICATION_FAILED");
  } finally {
    try {
      const sourcesAfter = await Promise.all(
        sourcesBefore.map(({ contract, root }) =>
          inspectFixture(root, contract),
        ),
      );
      if (
        sourcesAfter.some(
          (snapshot, index) =>
            JSON.stringify(snapshot) !==
            JSON.stringify(sourcesBefore[index].snapshot),
        )
      ) {
        pendingError = new GeneratedFixtureVerificationError(
          "FIXTURE_SOURCE_CHANGED",
        );
      }
    } catch {
      pendingError = new GeneratedFixtureVerificationError(
        "FIXTURE_SOURCE_CHANGED",
      );
    }

    if (!(await cleanupOwnedDirectory(owner))) {
      pendingError = new GeneratedFixtureVerificationError(
        "VERIFICATION_CLEANUP_FAILED",
      );
    }
  }

  if (pendingError !== undefined) {
    throw pendingError;
  }

  const visualVerificationExecuted =
    options.includeVisual &&
    selectedSources.some(({ contract }) => contract.visualRegression);

  return {
    ok: true,
    fixtures: selectedSources.map(({ contract }) => contract.identifier),
    ...(admittedAudit ? { auditDispositions, status: auditDispositions.some(audit => audit.status === "accepted-with-security-exception")
      ? "completed-with-security-exception" : "completed" } : {}),
    workerIntegration,
    bindingIntegration,
    appBuildEvidence,
    ...(visualComparisons.length ? { visualComparisons } : {}),
    profiles: [
      ...new Set(selectedSources.map(({ contract }) => contract.profile)),
    ],
    checks: visualVerificationExecuted
      ? [...verificationChecks, visualVerificationCheck]
      : verificationChecks,
  };
}

export function verifyGeneratedSkeletons(options = defaultVerificationOptions) {
  return verifyGeneratedSkeletonsForTesting(
    {
      captureVisualArtifacts: captureVisualFailureArtifacts,
      createOwner: createGeneratedFixtureOwner,
      runCommand: defaultRunCommand,
      runAudit: runDependencyAudit,
    },
    options,
  );
}

function requireAdapters(adapters) {
  if (
    adapters === null ||
    typeof adapters !== "object" ||
    typeof adapters.createOwner !== "function" ||
    typeof adapters.runCommand !== "function" ||
    (adapters.captureVisualArtifacts !== undefined &&
      typeof adapters.captureVisualArtifacts !== "function")
  ) {
    fail("VERIFICATION_ADAPTER_INVALID");
  }
}

async function requireFixtureWitnessInputs(input) {
  try {
    if (await realpath(input.retainedRoot) !== input.retainedRoot ||
        await realpath(input.witnessRoot) !== input.witnessRoot ||
        (input.jobAttemptRoot !== undefined && await realpath(input.jobAttemptRoot) !== input.jobAttemptRoot)) fail("FIXTURE_WITNESS_INVALID");
    const [retained, publicBuild, jobAttempt] = await Promise.all([
      inspectFixture(input.retainedRoot, input.retained),
      snapshotTree(input.witnessRoot),
      input.jobAttemptRoot === undefined ? undefined : snapshotTree(input.jobAttemptRoot),
    ]);
    if (fingerprint(JSON.stringify(retained)) !== retainedFixtureDigests[input.retained.identifier] ||
        !jsonMatches(publicBuild.map(({ path }) => path), publicBuildWitnessPaths) ||
        (jobAttempt !== undefined && !jsonMatches(jobAttempt.map(({ path }) => path), jobAttemptWitnessPaths))) fail("FIXTURE_WITNESS_INVALID");
    return { publicBuild, jobAttempt };
  } catch {
    fail("FIXTURE_WITNESS_INVALID");
  }
}

async function requireFixtureWitnessDirectory(witnessDirectory, identifiers) {
  if (await realpath(witnessDirectory) !== witnessDirectory) fail("FIXTURE_WITNESS_INVALID");
  const entries = await readdir(witnessDirectory, { withFileTypes: true });
  if (entries.some(entry => !entry.isDirectory()) || !jsonMatches(
    entries.map(entry => entry.name).sort(codePointCompare),
    [...identifiers].sort(codePointCompare),
  )) fail("FIXTURE_WITNESS_INVALID");
}

async function writeFixtureWitness(reconstruction, path, content, retainedFingerprint) {
  const destination = join(reconstruction, path);
  const parent = dirname(destination);
  if (await realpath(parent) !== parent) fail("FIXTURE_WITNESS_INVALID");
  const existing = retainedFingerprint !== undefined;
  const flags = fileConstants.O_RDWR | fileConstants.O_NOFOLLOW | fileConstants.O_NONBLOCK |
    (existing ? 0 : fileConstants.O_CREAT | fileConstants.O_EXCL);
  const file = await open(destination, flags, 0o644);
  try {
    const stats = await file.stat();
    if (!stats.isFile() || stats.nlink !== 1) fail("FIXTURE_WITNESS_INVALID");
    if (existing) {
      if (fingerprint(await file.readFile()) !== retainedFingerprint) fail("FIXTURE_WITNESS_INVALID");
      await file.truncate(0);
    }
    const { bytesWritten } = await file.write(content, 0, content.length, 0);
    if (bytesWritten !== content.length) fail("FIXTURE_WITNESS_INVALID");
  } finally {
    await file.close();
  }
}

async function applyFixtureWitness(reconstruction, owner, witnessRoot, witness, existingSnapshot) {
  const existingFingerprints = new Map(existingSnapshot.map(({ path, fingerprint }) => [path, fingerprint]));
  for (const { path, fingerprint: expected } of witness) {
    const content = await readFile(join(witnessRoot, path));
    if (fingerprint(content) !== expected || !(await pathIdentityMatches(owner))) fail("FIXTURE_WITNESS_INVALID");
    await writeFixtureWitness(reconstruction, path, content, existingFingerprints.get(path));
  }
}

async function withCurrentFixtureSources(fixtureRepositoryRoot, identifiers, operation) {
  let witnessDirectory;
  let jobAttemptDirectory;
  let root;
  const requireWitnessDirectories = () => Promise.all([
    requireFixtureWitnessDirectory(witnessDirectory, generatedFixtureContracts.map(({ identifier }) => identifier)),
    requireFixtureWitnessDirectory(jobAttemptDirectory, Object.keys(jobAttemptWitnesses)),
  ]);
  try {
    root = await realpath(fixtureRepositoryRoot);
    witnessDirectory = resolve(root, publicBuildWitnessDirectory);
    jobAttemptDirectory = resolve(root, jobAttemptWitnessDirectory);
    await requireWitnessDirectories();
  } catch {
    fail("FIXTURE_WITNESS_INVALID");
  }
  const inputs = identifiers.map(identifier => {
    const retained = contractForIdentifier(identifier);
    return {
      retained,
      retainedRoot: resolve(root, retained.relativeRoot),
      witnessRoot: resolve(witnessDirectory, identifier),
      jobAttemptRoot: Object.hasOwn(jobAttemptWitnesses, identifier) ? resolve(jobAttemptDirectory, identifier) : undefined,
    };
  });
  const before = await Promise.all(inputs.map(requireFixtureWitnessInputs));
  const owner = await createGeneratedFixtureOwner();
  try {
    const ownedRoot = await realpath(owner.path);
    const sources = [];
    for (const [index, input] of inputs.entries()) {
      const identifier = input.retained.identifier;
      const reconstruction = join(ownedRoot, identifier);
      try {
        if (!(await pathIdentityMatches(owner)) || await realpath(owner.path) !== ownedRoot) fail("FIXTURE_WITNESS_INVALID");
        await cp(input.retainedRoot, reconstruction, { recursive: true, force: false, errorOnExist: true, dereference: false });
        const copied = await snapshotTree(reconstruction);
        if (fingerprint(JSON.stringify(copied)) !== retainedFixtureDigests[identifier]) fail("FIXTURE_WITNESS_INVALID");
        const { publicBuild, jobAttempt } = before[index];
        await applyFixtureWitness(reconstruction, owner, input.witnessRoot, publicBuild, copied);
        if (jobAttempt !== undefined) {
          const publicBuildSnapshot = await snapshotTree(reconstruction);
          if (fingerprint(JSON.stringify(publicBuildSnapshot)) !== publicBuildFixtureDigests[identifier]) fail("FIXTURE_WITNESS_INVALID");
          await applyFixtureWitness(reconstruction, owner, input.jobAttemptRoot, jobAttempt, publicBuildSnapshot);
        }
      } catch {
        fail("FIXTURE_WITNESS_INVALID");
      }
      const source = await sourceForRoot(reconstruction, currentFixtureContract(identifier));
      const expectedDigest = jobAttemptWitnesses[identifier]?.digest ?? publicBuildFixtureDigests[identifier];
      if (fingerprint(JSON.stringify(source.snapshot)) !== expectedDigest) fail("FIXTURE_WITNESS_INVALID");
      sources.push(source);
    }
    return await operation(sources);
  } finally {
    try {
      await requireWitnessDirectories();
      const after = await Promise.all(inputs.map(requireFixtureWitnessInputs));
      if (!jsonMatches(before, after)) fail("FIXTURE_SOURCE_CHANGED");
    } catch {
      fail("FIXTURE_SOURCE_CHANGED");
    } finally {
      if (!(await cleanupOwnedDirectory(owner))) fail("VERIFICATION_CLEANUP_FAILED");
    }
  }
}

export function withCurrentGeneratedFixture(identifier, operation) {
  return withCurrentFixtureSources(repositoryRoot, [identifier], async ([source]) => {
    const result = await operation(source.root, source.contract);
    if (!jsonMatches(await inspectFixture(source.root, source.contract), source.snapshot)) fail("FIXTURE_SOURCE_CHANGED");
    return result;
  });
}

async function sourceForRoot(root, contract) {
  const fixedRoot = resolve(root);
  return {
    contract,
    root: fixedRoot,
    snapshot: await inspectFixture(fixedRoot, contract),
  };
}

export async function verifyGeneratedSkeletonsForTesting(
  adapters,
  options = defaultVerificationOptions,
  fixtureRepositoryRoot = repositoryRoot,
) {
  requireAdapters(adapters);
  if (typeof adapters.runAudit !== "function") fail("VERIFICATION_ADAPTER_INVALID");
  const { fromFixture, ...commandOptions } = options ?? {};
  requireVerificationOptions(commandOptions);
  const firstFixture = Object.hasOwn(options, "fromFixture")
    ? fixedFixtureIndex(fromFixture, "VERIFICATION_OPTION_INVALID")
    : 0;
  return withCurrentFixtureSources(
    fixtureRepositoryRoot,
    generatedFixtureContracts.map(({ identifier }) => identifier),
    (sources) => verifySourcesWithAdapters(adapters, sources, commandOptions, adapters.runAudit, firstFixture),
  );
}

export function verifyGeneratedProject(
  root,
  identifier,
  expectedProjectName,
  options = defaultVerificationOptions,
) {
  return verifyGeneratedProjectForTesting(
    root,
    identifier,
    {
      captureVisualArtifacts: captureVisualFailureArtifacts,
      createOwner: createGeneratedFixtureOwner,
      runCommand: defaultRunCommand,
    },
    expectedProjectName,
    options,
  );
}

export async function verifyGeneratedProjectForTesting(
  root,
  identifier,
  adapters,
  expectedProjectName,
  options = defaultVerificationOptions,
  retained = false,
) {
  requireAdapters(adapters);
  requireVerificationOptions(options);
  const contract = retained
    ? { ...contractForIdentifier(identifier), ...(expectedProjectName === undefined ? {} : { projectName: expectedProjectName }) }
    : contractForGeneratedProject(identifier, expectedProjectName);
  const source = await sourceForRoot(root, contract);
  return verifySourcesWithAdapters(adapters, [source], options);
}

export function formatGeneratedFixtureFailure(error) {
  const code =
    error instanceof GeneratedFixtureVerificationError
      ? error.code
      : "VERIFICATION_FAILED";
  return {
    ok: false,
    code,
    ...(error?.artifactExportCode === undefined
      ? {}
      : { artifactExportCode: error.artifactExportCode }),
    ...(code === "OPENNEXT_BUILD_FAILED" && error.commandDiagnostics !== undefined
      ? { commandDiagnostics: error.commandDiagnostics }
      : {}),
  };
}

export function verifyApplicationEnvironmentProject(root) {
  return verifyApplicationEnvironmentProjectForTesting(root, {
    createOwner: createGeneratedFixtureOwner,
    runCommand: defaultRunCommand,
    captureVisualArtifacts: captureVisualFailureArtifacts,
  });
}

export async function verifyApplicationEnvironmentProjectForTesting(root, adapters) {
  if (typeof adapters?.createOwner !== "function" || typeof adapters.runCommand !== "function" ||
    (adapters.captureVisualArtifacts !== undefined && typeof adapters.captureVisualArtifacts !== "function") ||
    (adapters.openPreviewReport !== undefined && typeof adapters.openPreviewReport !== "function")) fail("VERIFICATION_SETUP_FAILED");
  const core = await import("../packages/builder-core/dist/index.js");
  const { derivePnpmToolEnvironment } = await import("../packages/builder-core/dist/generation/verify-generated-project.js");
  const toolEnvironment = await (adapters.derivePnpmToolEnvironment ?? derivePnpmToolEnvironment)("pnpm");
  const fixedRoot = resolve(root);
  const sourceBefore = await snapshotTree(fixedRoot);
  const snapshot = await core.readVerifiedProjectSnapshot(core.createFileSystemRepositoryReader(fixedRoot));
  const project = core.parseProjectYaml(await readFile(join(fixedRoot, ".egeria/project.yaml"), "utf8"));
  if (!snapshot.ok || !project.ok) fail("FIXTURE_STATE_INVALID");
  const selected = project.value.selectedCapabilities;
  const profile = project.value.originProfile;
  const jobs = selected.includes("background-job-delivery");
  const persistence = selected.includes("application-persistence");
  const email = selected.includes("transactional-email-resend");
  const foundation = selected.includes("app-foundation");
  const manifest = await readFile(join(fixedRoot, "apps/web/package.json"));
  const lockfile = await readFile(join(fixedRoot, "pnpm-lock.yaml"));
  const owner = await adapters.createOwner();
  if (!(await pathIdentityMatches(owner))) fail("VERIFICATION_SETUP_FAILED");
  const targets = [];
  let activeTarget = null;
  let pendingError;
  try {
    for (const target of ["development", "staging", "production"]) {
      activeTarget = target;
      const validationRoot = join(owner.path, target + "-project");
      const supportRoot = join(owner.path, target + "-support");
      await cp(fixedRoot, validationRoot, { recursive: true, force: false, errorOnExist: true, dereference: false });
      await mkdir(supportRoot, { mode: 0o700 });
      const supportIdentity = await readPathIdentity(supportRoot);
      const support = await createSupportPaths(supportRoot);
      const revision = "a".repeat(40); // Explicit synthetic source identity, never a reviewed commit assertion.
      const siteOrigin = `https://${target}.application-test.invalid`;
      const environment = { ...createChildEnvironment(support), ...toolEnvironment,
        ...syntheticApplicationEnvironment(selected, project.value.capabilitySettings, target, siteOrigin) };
      const commands = [];
      const run = async (arguments_, failureCode, commandEnvironment = environment) => {
        const result = await runExpectedCommand(adapters.runCommand, { executable: "pnpm", arguments: arguments_, cwd: validationRoot, environment: commandEnvironment, timeout: commandTimeoutMilliseconds }, failureCode);
        commands.push({ arguments: arguments_, status: "passed" });
        return result;
      };
      if ((await run(["--version"], "PNPM_VERSION_INVALID")).trim() !== requiredPnpmVersion) fail("PNPM_VERSION_INVALID");
      await run(["install", "--frozen-lockfile", "--store-dir", support.store], "FROZEN_INSTALL_FAILED");
      await run(["--dir", "apps/web", "run", "browser:install"], "BROWSER_INSTALL_FAILED");
      if (target === "development") {
        await run(["run", "lint"], "LINT_FAILED");
        if (persistence) await run(["--dir", "apps/web", "run", "cf-typegen"], "CLOUDFLARE_TYPE_GENERATION_FAILED");
        await run(["run", "typecheck"], "TYPECHECK_FAILED");
        await run(["run", "test:unit"], "UNIT_TESTS_FAILED");
        await run(["run", "test:component"], "COMPONENT_TESTS_FAILED");
        await run(["--dir", "apps/web", "run", "test:deployment-contracts"], "DEPLOYMENT_CONTRACTS_FAILED");
        await run(["--dir", "apps/web", "run", "test:transport"], "TRANSPORT_CONTRACTS_FAILED");
        await run(["--dir", "apps/web", "run", "test:e2e:dev"], "BROWSER_DEVELOPMENT_FAILED");
      }
      await run(["--dir", "apps/web", "run", target === "development" ? "check:environment" : "check:environment:deployment"], "APPLICATION_ENVIRONMENT_INVALID");
      await run(["run", "build"], "NEXT_BUILD_FAILED");
      await run(["--dir", "apps/web", "exec", "opennextjs-cloudflare", "build", "--skipNextBuild"], "OPENNEXT_BUILD_FAILED");
      if (jobs) await run(["--dir", "apps/web", "exec", "wrangler", "deploy", "--dry-run", ...(target === "development" ? [] : ["--env", target]), "--outdir", ".open-next/jobs-bundle", "--metafile", ".open-next/jobs-inputs.json", "--x-provision=false", "--x-auto-create=false"], "JOB_BUNDLE_FAILED");
      const artifact = mode => ["--dir", "apps/web", "run", "check:prepared-artifact", mode, target, revision, "--local"];
      await run(artifact("record"), "PREPARED_ARTIFACT_FAILED");
      const receiptPath = join(validationRoot, "apps/web/.open-next/prepared-artifact.json");
      const receiptBefore = await readFile(receiptPath);
      if (foundation) await run(["--dir", "apps/web", "run", "test:integration:cloudflare"], "WORKER_INTEGRATION_FAILED");
      if (persistence) await run(["--dir", "apps/web", "run", "test:integration:bindings"], "BINDING_INTEGRATION_FAILED");
      await run(artifact("verify"), "PREPARED_ARTIFACT_FAILED");
      const preparedReport = await preparePreviewTestReport(owner, supportIdentity, validationRoot, fixedRoot);
      try {
        await run(["--dir", "apps/web", "run", "test:e2e:preview", ...(preparedReport === undefined ? [] : ["--reporter=list,html,json"])],
          "BROWSER_PREVIEW_FAILED", preparedReport === undefined ? environment : { ...environment,
            PLAYWRIGHT_JSON_OUTPUT_FILE: preparedReport.reportPath,
            PLAYWRIGHT_HTML_OPEN: "never", PLAYWRIGHT_HTML_OUTPUT_DIR: join(validationRoot, "apps/web/playwright-report"),
          });
      } catch (error) {
        error.previewDiagnostics = { ...error.previewDiagnostics, playwright: await inspectPreviewTestReport({
          prepared: preparedReport, validationRoot, sourceRoot: fixedRoot, sourceSnapshot: sourceBefore, openReport: adapters.openPreviewReport,
        }) };
        throw error;
      }
      await run(artifact("verify"), "PREPARED_ARTIFACT_FAILED");
      if (!(await readFile(receiptPath)).equals(receiptBefore)) fail("PREPARED_ARTIFACT_CHANGED");
      targets.push({ target, sourceIdentity: { revision, synthetic: true }, publicOrigin: siteOrigin,
        manifestSha256: fingerprint(manifest), lockfileSha256: fingerprint(lockfile), receiptSha256: fingerprint(receiptBefore),
        environmentKeys: Object.keys(environment).sort(), commands });
    }
  } catch (error) { pendingError = error; }
  finally {
    try { if (JSON.stringify(await snapshotTree(fixedRoot)) !== JSON.stringify(sourceBefore)) pendingError = new GeneratedFixtureVerificationError("FIXTURE_SOURCE_CHANGED"); }
    catch { pendingError = new GeneratedFixtureVerificationError("FIXTURE_SOURCE_CHANGED"); }
    if (pendingError === undefined) {
      if (!(await cleanupOwnedDirectory(owner))) pendingError = new GeneratedFixtureVerificationError("VERIFICATION_CLEANUP_FAILED");
    } else {
      const failureCode = pendingError instanceof GeneratedFixtureVerificationError ? pendingError.code : "VERIFICATION_FAILED";
      const verificationFailure = {
        code: failureCode, profile, target: activeTarget, services: { jobs, persistence, email },
        ...(failureCode === "BROWSER_PREVIEW_FAILED" && pendingError.previewDiagnostics !== undefined
          ? { previewDiagnostics: pendingError.previewDiagnostics } : {}),
      };
      if (await pathIdentityMatches(owner)) {
        if (failureCode === "BROWSER_PREVIEW_FAILED" && adapters.captureVisualArtifacts !== undefined) {
          try {
            await adapters.captureVisualArtifacts({
              failureCode,
              identifier: `application-environment-${profile}-${jobs ? "jobs" : "web"}-${persistence ? "persistence" : "stateless"}-${email ? "email" : "no-email"}-${activeTarget}`,
              validationRoot: join(owner.path, activeTarget + "-project"),
              previewDiagnostics: verificationFailure.previewDiagnostics,
            });
          } catch {
            pendingError.artifactExportCode = "VISUAL_ARTIFACT_EXPORT_FAILED";
            verificationFailure.artifactExportCode = pendingError.artifactExportCode;
          }
        }
        try {
          // The owner identity and completed commands stay in private local evidence.
          await writeFile(join(owner.path, "verification-failure.json"), JSON.stringify({
            failureCode, verificationFailure, completedTargets: targets,
            owner: { path: owner.path, device: String(owner.device), inode: String(owner.inode) },
          }, null, 2), { flag: "wx", mode: 0o600 });
          pendingError.retainedEvidencePath = owner.path;
        } catch {
          verificationFailure.evidenceRetentionCode = "VERIFICATION_EVIDENCE_RETENTION_FAILED";
        }
      } else {
        verificationFailure.evidenceRetentionCode = "VERIFICATION_EVIDENCE_RETENTION_FAILED";
      }
      pendingError.verificationFailure = verificationFailure;
    }
  }
  if (pendingError !== undefined) throw pendingError;
  return { ok: true, targets, providerPolicy: "synthetic inputs and controlled browser requests only", liveAcceptance: false };
}

async function runMain() {
  try {
    const options = parseVerificationArguments(process.argv.slice(2));
    const result = await verifyGeneratedSkeletons(options);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify(formatGeneratedFixtureFailure(error))}\n`,
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
