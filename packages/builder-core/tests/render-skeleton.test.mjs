import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
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

const analyticsSettings = {
  consent: { policy: "explicit-opt-in" },
  providers: {
    cloudflareWebAnalytics: {
      siteToken: "0123456789abcdef0123456789abcdef",
    },
    googleAnalytics4: { measurementId: "G-TEST123456" },
    microsoftClarity: {
      projectId: "clarity123",
      audience: "not-directed-to-minors",
    },
  },
  operationalIntegrations: {
    googleSearchConsole: {
      verificationToken: "search-console-verification-token",
    },
    lookerStudio: { connector: "google-analytics-4" },
  },
};

const visualBaselinePaths = [
  "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
];

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
  "pnpm-workspace.yaml",
];

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
  "apps/web/content/en-CA/routing.yaml",
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
  "pnpm-workspace.yaml",
];

const bookingCalendlyPaths = [
  "apps/web/content/en-CA/booking-calendly.yaml",
  "apps/web/src/integrations/booking-calendly/booking-content.ts",
  "apps/web/src/integrations/booking-calendly/booking-settings.ts",
  "apps/web/src/integrations/booking-calendly/calendly-booking.tsx",
  "apps/web/tests/e2e/calendly-booking.spec.ts",
];

const multilingualPaths = [
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
  "apps/web/content/en-CA/analytics.yaml",
  "apps/web/content/fr-CA/analytics.yaml",
  "apps/web/src/integrations/analytics/analytics-consent.tsx",
  "apps/web/src/integrations/analytics/analytics-content-source.d.ts",
  "apps/web/src/integrations/analytics/analytics-content.ts",
  "apps/web/src/integrations/analytics/analytics-provider-contract.ts",
  "apps/web/src/integrations/analytics/analytics-runtime.ts",
  "apps/web/src/integrations/analytics/analytics-settings.ts",
  "apps/web/tests/component/analytics-consent.test.tsx",
  "apps/web/tests/e2e/analytics-consent.spec.ts",
  "apps/web/tests/unit/analytics-provider-contract.test.ts",
  "docs/analytics.md",
];

const bookingCalendlyCopy = {
  heading: "Book a conversation",
  summary: "Choose a time that works for you.",
  linkLabel: "Schedule with Calendly",
  frameTitle: "Calendly scheduling page",
  popupHeading: "Choose a time",
  closeLabel: "Close scheduling",
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
  return module.renderSkeleton;
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
  const source = indexFiles(files).get(
    "apps/web/playwright.deployed.config.ts",
  );
  assert.notEqual(source, undefined);
  const executableSource = source
    .replace(
      'import { createBrowserQualityConfig } from "./playwright.config.shared";',
      "const createBrowserQualityConfig = (options: unknown) => options;",
    );
  assert.notEqual(executableSource, source);
  const typescriptModule = await import("typescript");
  const typescript = typescriptModule.default ?? typescriptModule;
  const executable = typescript.transpileModule(executableSource, {
    compilerOptions: {
      module: typescript.ModuleKind.ESNext,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText;

  const previousDeployedURL = process.env.PLAYWRIGHT_DEPLOYED_URL;
  if (deployedURL === undefined) {
    delete process.env.PLAYWRIGHT_DEPLOYED_URL;
  } else {
    process.env.PLAYWRIGHT_DEPLOYED_URL = deployedURL;
  }

  try {
    deployedConfigurationLoad += 1;
    return await import(
      `data:text/javascript;base64,${Buffer.from(executable).toString("base64")}#load-${deployedConfigurationLoad}`
    );
  } finally {
    if (previousDeployedURL === undefined) {
      delete process.env.PLAYWRIGHT_DEPLOYED_URL;
    } else {
      process.env.PLAYWRIGHT_DEPLOYED_URL = previousDeployedURL;
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
  const executable = withRoot.replace(
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
          `import { createOperationalErrorReport, createOperationalEvent, dispatchOperationalEvent, normalizeErrorCategory } from ${JSON.stringify(rootModule)};`,
          "export { createOperationalErrorReport, createOperationalEvent, dispatchOperationalEvent, normalizeErrorCategory };",
          'export async function dispatchOperationalErrorReport() { throw new Error("synthetic dispatch rejection"); }',
        ].join("\n"),
      ).toString("base64")}`
    : rootModule;
  const serverModule = new URL(
    "../../observability/dist/server.js",
    import.meta.url,
  ).href;
  const contextModule = `data:text/javascript;base64,${Buffer.from(
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

  assert.match(rendered, /"measurementId": "G-TEST123456"/u);
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
    destination: "https://calendly.com/acme/intro",
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

  for (const multilingual of [false, true]) {
    const first = assertSuccess(
      await renderSkeleton({
        profile: "site",
        projectName: "acme-site",
        displayName: "Acme Site",
        analytics: analyticsSettings,
        ...(multilingual ? { multilingual: true } : {}),
        packageVersions,
      }),
    );
    const second = assertSuccess(
      await renderSkeleton({
        profile: "site",
        projectName: "acme-site",
        displayName: "Acme Site",
        analytics: analyticsSettings,
        ...(multilingual ? { multilingual: true } : {}),
        packageVersions,
      }),
    );
    const files = indexFiles(first.files);
    const expectedPaths = [
      ...sitePaths,
      ...analyticsPaths,
      ...(multilingual ? multilingualPaths : []),
    ].toSorted();

    assert.deepEqual(first.files.map(({ path }) => path), expectedPaths);
    assert.deepEqual(snapshotBytes(first.files), snapshotBytes(second.files));
    assert.equal(first.project.selectedCapabilities.includes("analytics"), true);
    assert.deepEqual(first.project.capabilitySettings.analytics, analyticsSettings);
    assert.match(
      files.get("apps/web/src/integrations/analytics/analytics-settings.ts"),
      /G-TEST123456/u,
    );
    assert.match(
      files.get("apps/web/src/integrations/analytics/analytics-provider-contract.ts"),
      /aggregate-traffic-and-performance|audience-measurement|consented-experience-analysis/u,
    );
    assert.match(
      files.get("apps/web/src/integrations/analytics/analytics-runtime.ts"),
      /explicit-opt-in|analytics_Storage|analytics_storage/u,
    );
    assert.match(files.get("apps/web/app/layout.tsx"), /AnalyticsConsent/u);
    assert.match(files.get("apps/web/app/layout.tsx"), /verification/u);
    assert.equal(
      parseGeneratedYaml(first.files, "apps/web/content/en-CA/analytics.yaml")
        .allowLabel,
      "Allow analytics",
    );
    assert.match(
      parseGeneratedYaml(first.files, "apps/web/content/fr-CA/analytics.yaml")
        .allowLabel,
      /\S/u,
    );

    for (const path of analyticsPaths) {
      assert.doesNotMatch(files.get(path), /observability/iu, path);
    }

    if (multilingual) {
      assert.match(files.get("apps/web/app/layout.tsx"), /x-egeria-locale/u);
      assert.match(files.get("apps/web/app/layout.tsx"), /readAnalyticsContent\(locale\)/u);
    } else {
      assert.match(files.get("apps/web/app/layout.tsx"), /readAnalyticsContent\("en-CA"\)/u);
    }
  }
});

test("current site rendering uses the patched framework while historical rendering stays frozen", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const request = {
    profile: "site",
    projectName: "acme-studio",
    displayName: "Acme Studio",
    packageVersions,
  };
  const current = assertSuccess(await renderSkeleton(request));
  const currentManifest = JSON.parse(
    indexFiles(current.files).get("apps/web/package.json"),
  );
  const historicalProfiles = [
    {
      identifier: "portfolio",
      schemaVersion: "1.0.0",
      recipeVersion: "0.10.0",
      defaultCapabilities: [
        "standards",
        "content-files",
        "section-composition",
        "deployment-cloudflare",
        "observability",
      ],
    },
    {
      identifier: "site",
      schemaVersion: "1.0.0",
      recipeVersion: "0.10.0",
      defaultCapabilities: [
        "standards",
        "content-files",
        "section-composition",
        "deployment-cloudflare",
        "observability",
        "site-routing",
      ],
    },
  ];
  const historicalRendered = assertSuccess(
    await renderSkeleton(request, {
      catalogSnapshot: {
        standards: "0.4.0",
        siteRouting: "0.3.0",
      },
      profiles: historicalProfiles,
    }),
  );
  const historicalManifest = JSON.parse(
    indexFiles(historicalRendered.files).get("apps/web/package.json"),
  );

  assert.equal(current.project.recipeVersion, "0.11.0");
  assert.equal(currentManifest.dependencies.next, "16.3.3");
  assert.equal(currentManifest.devDependencies["eslint-config-next"], "16.3.3");
  assert.equal(historicalRendered.project.recipeVersion, "0.10.0");
  assert.equal(historicalManifest.dependencies.next, "16.3.0");
  assert.equal(
    historicalManifest.devDependencies["eslint-config-next"],
    "16.3.0",
  );
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
    schemaVersion: "1.0.0",
    builderCompatibility: "0.0.0",
    project: {
      name: "acme-studio",
      displayName: "Acme Studio",
      defaultLocale: "en-CA",
    },
    originProfile: "portfolio",
    recipeVersion: "0.10.0",
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
    engines: { node: "22.23.2", pnpm: "11.20.0" },
    packageManager: "pnpm@11.20.0",
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
      "@opennextjs/cloudflare": "1.20.2",
      next: "16.3.0",
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
      vitest: "4.1.10",
      wrangler: "4.118.0",
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

  assert.match(setup, /@testing-library\/jest-dom\/vitest/u);
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
    /minimumReleaseAgeExclude:\n  - "@egeria-systems\/observability@0\.3\.0"/u,
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
    .filter(([path]) => path.endsWith(".ts") || path.endsWith(".tsx"))
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

test("browser reporting creates bounded diagnostic envelopes and suppresses duplicate objects", async () => {
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
  }

  assert.equal(requests.length, 5);
  for (const { input, init } of requests) {
    assert.equal(input, "/api/observability");
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
      destination: "https://calendly.com/acme/intro",
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

    assert.equal(rendered.project.schemaVersion, "1.0.0");
    assert.equal(rendered.project.recipeVersion, "0.10.0");
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
    assert.equal(
      files.get(
        "apps/web/src/integrations/booking-calendly/booking-settings.ts",
      ),
      [
        "export type CalendlyBookingSettings = Readonly<{",
        "  destination: string;",
        '  mode: "link" | "inline" | "popup";',
        "}>;",
        "",
        "export const bookingCalendlySettings = {",
        '  destination: "https://calendly.com/acme/intro",',
        `  mode: ${JSON.stringify(mode)},`,
        "} as const satisfies CalendlyBookingSettings;",
        "",
      ].join("\n"),
    );
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
        destination: "https://www.calendly.com/acme/intro",
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
        destination: "https://calendly.com/acme/intro",
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
        .filter(([path]) => path.endsWith(".ts") || path.endsWith(".tsx"))
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
        destination: "https://calendly.com/acme/intro",
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
    /const configuredProviderUrl = new URL\(\s*bookingCalendlySettings\.destination,\s*\)\.href/u,
    /new URL\(bookingCalendlySettings\.destination\)\.origin/u,
    /target\.route\(\s*\(url\) => url\.origin === providerOrigin/u,
    /requestUrl === configuredProviderUrl/u,
    /unexpectedRequestUrls\.push\(requestUrl\)/u,
    /route\.abort\("blockedbyclient"\)/u,
    /route\.fulfill/u,
    /<link rel="icon" href="data:,">/u,
    /stubSchedulingDocument\(page\)/u,
    /stubSchedulingDocument\(context\)/u,
    /expect\(providerAudit\.unexpectedRequestUrls\(\)\)\.toEqual\(\[\]\)/u,
    /javaScriptEnabled: false/u,
    /CalendlyBookingSettings\["mode"\]/u,
    /bookingMode === "link"/u,
    /bookingMode === "inline"/u,
    /test\.skip\(bookingMode !== "inline"\)/u,
    /test\.skip\(bookingMode !== "popup"\)/u,
    /toHaveAttribute\(\s*"href",\s*bookingCalendlySettings\.destination/u,
    /toHaveAttribute\(\s*"src",\s*bookingCalendlySettings\.destination/u,
    /toHaveCount\(0\)[\s\S]+toHaveCount\(1\)/u,
    /keyboard\.press\("Escape"\)/u,
    /document\.activeElement/u,
    /width: 320/u,
    /getBoundingClientRect\(\)/u,
    /dialogBounds\.right\)\.toBeLessThanOrEqual\(dialogBounds\.innerWidth\)/u,
    /scrollWidth/u,
    /AxeBuilder/u,
    /wcag22aa/u,
  ]) {
    assert.match(browserSpecification, contract);
  }
  assert.doesNotMatch(browserSpecification, /not\.toHaveAttribute\("src"\)/u);
  assert.doesNotMatch(browserSpecification, /page\.goto\(bookingCalendlySettings\.destination/u);
});

test("rendered explicit HTTPS port remains raw while browser requests use its canonical URL", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const destination = "https://calendly.com:443/acme/intro";
  const rendered = assertSuccess(
    await renderSkeleton({
      profile: "portfolio",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      bookingCalendly: { destination, mode: "popup" },
      packageVersions,
    }),
  );
  const files = indexFiles(rendered.files);
  const settings = files.get(
    "apps/web/src/integrations/booking-calendly/booking-settings.ts",
  );
  const component = files.get(
    "apps/web/src/integrations/booking-calendly/calendly-booking.tsx",
  );
  const browserSpecification = files.get(
    "apps/web/tests/e2e/calendly-booking.spec.ts",
  );

  assert.equal(
    rendered.project.capabilitySettings["booking-calendly"]?.destination,
    destination,
  );
  assert.match(settings, /destination: "https:\/\/calendly\.com:443\/acme\/intro"/u);
  assert.match(component, /href=\{settings\.destination\}/u);
  assert.match(component, /src=\{settings\.destination\}/u);
  assert.match(
    browserSpecification,
    /const configuredProviderUrl = new URL\(\s*bookingCalendlySettings\.destination,\s*\)\.href/u,
  );
  assert.match(browserSpecification, /requestUrl === configuredProviderUrl/u);
  assert.equal(
    browserSpecification.match(/page\.waitForURL\(configuredProviderUrl\)/gu)
      ?.length,
    2,
  );
  assert.match(
    browserSpecification,
    /toHaveAttribute\(\s*"href",\s*bookingCalendlySettings\.destination/u,
  );
  assert.match(
    browserSpecification,
    /toHaveAttribute\(\s*"src",\s*bookingCalendlySettings\.destination/u,
  );
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
        destination: "https://calendly.com/acme/intro",
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
    /test\("activates inline fallback when IntersectionObserver is unavailable"/u,
    /page\.addInitScript/u,
    /Object\.defineProperty\(window, "IntersectionObserver"/u,
    /test\("preserves popup navigation when native modal support is unavailable"/u,
    /Object\.defineProperty\(\s*HTMLDialogElement\.prototype,\s*"showModal"/u,
    /dialogOpen: dialog instanceof HTMLDialogElement && dialog\.open/u,
    /frameCount: document\.querySelectorAll/u,
    /request\.frame\(\) === page\.mainFrame\(\)/u,
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
        destination: "https://calendly.com/acme/intro",
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

test("generated deployment is manual, revision-bound, least-privilege, and deploys only verified output", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const rendered = assertSuccess(
    await renderSkeleton({
      profile: "portfolio",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      packageVersions,
    }),
  );
  const workflow = parseGeneratedYaml(
    rendered.files,
    ".github/workflows/deploy.yml",
  );
  const readme = indexFiles(rendered.files).get("README.md");

  assert.deepEqual(workflow.on, {
    workflow_dispatch: {
      inputs: {
        expected_revision: {
          description: "Exact main revision approved for deployment",
          required: true,
          type: "string",
        },
      },
    },
  });
  assert.deepEqual(workflow.permissions, { contents: "read" });
  assert.deepEqual(workflow.concurrency, {
    group: "production-deploy",
    queue: "max",
    "cancel-in-progress": false,
  });
  assert.match(
    readme,
    /prevent self-review[^.]+GitHub plan and environment controls support it/iu,
  );
  assert.match(
    readme,
    /when unavailable[^.]+record that limitation[^.]+reviewer other than the workflow initiator/iu,
  );

  const job = workflow.jobs["verify-and-deploy"];
  assert.equal(job.if, "github.ref == 'refs/heads/main'");
  assert.equal(job["runs-on"], "ubuntu-24.04");
  assert.deepEqual(job.container, {
    image:
      "mcr.microsoft.com/playwright:v1.62.1-noble@sha256:dcc5531e97840b9b5e794f2814476b21571c5124a3fca2267d73041f56e7580e",
    options: "--shm-size=1g",
  });
  assert.equal(job["timeout-minutes"], 45);
  assert.deepEqual(job.environment, {
    name: "production",
    url: "${{ vars.DEPLOY_URL }}",
  });

  const steps = Object.fromEntries(job.steps.map((step) => [step.name, step]));
  assert.deepEqual(Object.keys(steps), [
    "Check out repository",
    "Set up pnpm and Node.js",
    "Verify approved revision",
    "Install dependencies",
    "Lint generated project",
    "Typecheck generated project",
    "Test generated unit behavior",
    "Test generated components",
    "Build Next.js application",
    "Build OpenNext application",
    "Install Chromium",
    "Test Next.js development",
    "Test OpenNext workerd preview",
    "Verify deployment target configured",
    "Deploy Cloudflare Worker",
    "Wait for deployed application",
    "Test deployed application",
    "Upload deployment browser failure artifacts",
  ]);
  assert.deepEqual(steps["Check out repository"], {
    name: "Check out repository",
    uses: "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
    with: {
      "fetch-depth": 0,
      ref: "${{ github.sha }}",
      "persist-credentials": false,
    },
  });
  assert.deepEqual(steps["Set up pnpm and Node.js"].with, {
    version: "11.20.0",
    runtime: "node@22.23.2",
    cache: false,
    install: false,
  });

  const revisionGuard = steps["Verify approved revision"];
  assert.equal(revisionGuard.shell, "bash");
  assert.deepEqual(revisionGuard.env, {
    EXPECTED_REVISION: "${{ inputs.expected_revision }}",
  });
  const approvedRevision = "a".repeat(40);
  const runGuard = (environment) =>
    spawnSync(
      "bash",
      ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", revisionGuard.run],
      {
        encoding: "utf8",
        env: {
          EXPECTED_REVISION: environment.EXPECTED_REVISION,
          GITHUB_SHA: environment.GITHUB_SHA,
          GITHUB_REF: environment.GITHUB_REF,
        },
      },
    );
  assert.equal(
    runGuard({
      EXPECTED_REVISION: approvedRevision,
      GITHUB_SHA: approvedRevision,
      GITHUB_REF: "refs/heads/main",
    }).status,
    0,
  );
  for (const environment of [
    {
      EXPECTED_REVISION: "A".repeat(40),
      GITHUB_SHA: "A".repeat(40),
      GITHUB_REF: "refs/heads/main",
    },
    {
      EXPECTED_REVISION: "a".repeat(39),
      GITHUB_SHA: "a".repeat(39),
      GITHUB_REF: "refs/heads/main",
    },
    {
      EXPECTED_REVISION: approvedRevision,
      GITHUB_SHA: "b".repeat(40),
      GITHUB_REF: "refs/heads/main",
    },
    {
      EXPECTED_REVISION: approvedRevision,
      GITHUB_SHA: approvedRevision,
      GITHUB_REF: "refs/heads/release",
    },
  ]) {
    assert.notEqual(
      runGuard(environment).status,
      0,
      JSON.stringify(environment),
    );
  }

  assert.equal(
    steps["Install dependencies"].run,
    "pnpm install --frozen-lockfile",
  );
  assert.equal(steps["Lint generated project"].run, "pnpm run lint");
  assert.equal(
    steps["Typecheck generated project"].run,
    "pnpm run typecheck",
  );
  assert.equal(
    steps["Test generated unit behavior"].run,
    "pnpm run test:unit",
  );
  assert.equal(
    steps["Test generated components"].run,
    "pnpm run test:component",
  );
  assert.equal(steps["Build Next.js application"].run, "pnpm run build");
  assert.equal(
    steps["Build OpenNext application"].run,
    "pnpm --dir apps/web exec opennextjs-cloudflare build --skipNextBuild",
  );
  assert.equal(
    steps["Install Chromium"].run,
    "pnpm --dir apps/web exec playwright install chromium",
  );
  assert.equal(
    steps["Test Next.js development"].run,
    "pnpm --dir apps/web run test:e2e:dev",
  );
  assert.equal(
    steps["Test OpenNext workerd preview"].run,
    "pnpm --dir apps/web run test:e2e:preview",
  );
  assert.deepEqual(steps["Verify deployment target configured"].env, {
    PLAYWRIGHT_DEPLOYED_URL: "${{ vars.DEPLOY_URL }}",
  });
  assert.equal(
    steps["Verify deployment target configured"].run,
    "pnpm --dir apps/web exec playwright test --config playwright.deployed.config.ts --list",
  );

  const deployStep = steps["Deploy Cloudflare Worker"];
  assert.deepEqual(deployStep.env, {
    CLOUDFLARE_ACCOUNT_ID: "${{ secrets.CLOUDFLARE_ACCOUNT_ID }}",
    CLOUDFLARE_API_TOKEN: "${{ secrets.CLOUDFLARE_API_TOKEN }}",
  });
  assert.match(
    deployStep.run,
    /^test -n "\$CLOUDFLARE_ACCOUNT_ID"$/mu,
  );
  assert.match(
    deployStep.run,
    /^test -n "\$CLOUDFLARE_API_TOKEN"$/mu,
  );
  assert.match(deployStep.run, /opennextjs-cloudflare deploy/u);
  assert.doesNotMatch(
    deployStep.run,
    /(?:pnpm|opennextjs-cloudflare)[^\n]*\b(?:build|install|test|preview)\b|\bwrangler\b/iu,
  );
  assert.equal(
    job.steps.filter((step) =>
      Object.values(step.env ?? {}).some((value) =>
        String(value).includes("secrets."),
      ),
    ).length,
    1,
  );
  assert.deepEqual(steps["Wait for deployed application"].env, {
    DEPLOY_URL: "${{ vars.DEPLOY_URL }}",
  });
  assert.equal(
    steps["Wait for deployed application"].run,
    `attempt=1
while [ "$attempt" -le 12 ]; do
  status="$(curl --connect-timeout 5 --max-time 10 --silent --output /dev/null --write-out '%{http_code}' "$DEPLOY_URL" || true)"
  case "$status" in
    2??) exit 0 ;;
  esac
  if [ "$attempt" -eq 12 ]; then
    echo "Deployment did not become ready" >&2
    exit 1
  fi
  sleep 5
  attempt=$((attempt + 1))
done
`,
  );
  const runReadinessProbe = (curlFunction) =>
    spawnSync(
      "sh",
      [
        "-e",
        "-c",
        `${curlFunction}
sleep() { :; }
${steps["Wait for deployed application"].run}`,
      ],
      {
        encoding: "utf8",
        env: { DEPLOY_URL: "https://example.invalid" },
      },
    );
  assert.equal(
    runReadinessProbe(
      'curl() { if [ "$attempt" -lt 3 ]; then printf 404; else printf 200; fi; }',
    ).status,
    0,
  );
  assert.equal(
    runReadinessProbe(
      'curl() { if [ "$attempt" -lt 3 ]; then return 28; else printf 200; fi; }',
    ).status,
    0,
  );
  const unavailableDeployment = runReadinessProbe(
    "curl() { printf 404; }",
  );
  assert.notEqual(unavailableDeployment.status, 0);
  assert.equal(
    unavailableDeployment.stderr,
    "Deployment did not become ready\n",
  );
  assert.ok(
    job.steps.indexOf(steps["Deploy Cloudflare Worker"]) <
      job.steps.indexOf(steps["Wait for deployed application"]),
  );
  assert.ok(
    job.steps.indexOf(steps["Wait for deployed application"]) <
      job.steps.indexOf(steps["Test deployed application"]),
  );
  assert.deepEqual(steps["Test deployed application"].env, {
    PLAYWRIGHT_DEPLOYED_URL: "${{ vars.DEPLOY_URL }}",
  });
  assert.equal(
    steps["Test deployed application"].run,
    "pnpm --dir apps/web run test:e2e:deployed",
  );
  assert.equal(
    steps["Upload deployment browser failure artifacts"].if,
    "failure()",
  );
  assert.equal(
    steps["Upload deployment browser failure artifacts"].uses,
    "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a",
  );
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
  assert.match(shared, /trace: "retain-on-failure"/u);
  assert.match(shared, /screenshot: "only-on-failure"/u);
  assert.match(shared, /video: "retain-on-failure"/u);

  assert.match(development, /http:\/\/127\.0\.0\.1:3100/u);
  assert.match(development, /pnpm run dev --hostname 127\.0\.0\.1 --port 3100/u);
  assert.match(development, /reuseExistingServer: false/u);
  assert.match(preview, /http:\/\/127\.0\.0\.1:3101/u);
  assert.match(
    preview,
    /pnpm exec opennextjs-cloudflare preview -- --ip 127\.0\.0\.1 --port 3101/u,
  );
  assert.doesNotMatch(preview, /pnpm run preview/u);
  assert.match(preview, /reuseExistingServer: false/u);
  assert.match(nextConfiguration, /output: "standalone"/u);
  assert.match(
    nextConfiguration,
    /outputFileTracingRoot: fileURLToPath\(new URL\("\.\.\/\.\.\/", import\.meta\.url\)\)/u,
  );

  assert.match(deployed, /PLAYWRIGHT_DEPLOYED_URL/u);
  assert.match(deployed, /protocol !== "https:"/u);
  assert.match(deployed, /url\.username !== "" \|\| url\.password !== ""/u);
  assert.match(deployed, /url\.hash !== ""/u);
  assert.match(deployed, /DEPLOYED_URL_REQUIRED/u);
  assert.match(deployed, /DEPLOYED_URL_INVALID/u);
  assert.doesNotMatch(deployed, /COMPATIBILITY_URL/u);

  await assert.rejects(
    loadGeneratedDeployedConfigurationModule(rendered.files, undefined),
    { name: "Error", message: "DEPLOYED_URL_REQUIRED" },
  );
  await assert.rejects(
    loadGeneratedDeployedConfigurationModule(
      rendered.files,
      "http://example.com",
    ),
    { name: "Error", message: "DEPLOYED_URL_INVALID" },
  );
  const deployedModule = await loadGeneratedDeployedConfigurationModule(
    rendered.files,
    "https://example.com/quality/",
  );
  assert.deepEqual(deployedModule.default, {
    baseURL: "https://example.com/quality/",
  });
  assert.equal(
    deployedModule.parseDeployedBaseURL("https://example.com/quality/"),
    "https://example.com/quality/",
  );
  assert.equal(
    new URL(
      "./",
      deployedModule.parseDeployedBaseURL("https://example.com/quality/"),
    ).href,
    "https://example.com/quality/",
  );
  for (const [value, message] of [
    [undefined, "DEPLOYED_URL_REQUIRED"],
    ["", "DEPLOYED_URL_REQUIRED"],
    ["not a url", "DEPLOYED_URL_INVALID"],
    ["http://example.com", "DEPLOYED_URL_INVALID"],
    ["https://user@example.com", "DEPLOYED_URL_INVALID"],
    ["https://example.com?token=private", "DEPLOYED_URL_INVALID"],
    ["https://example.com#fragment", "DEPLOYED_URL_INVALID"],
  ]) {
    assert.throws(() => deployedModule.parseDeployedBaseURL(value), {
      name: "Error",
      message,
    });
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
    /const paths = await discoverContentPaths\(page\);/u,
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
    /const paths = await discoverContentPaths\(page\);[\s\S]+for \(const path of paths\)/u,
  );
  assert.match(
    reducedMotionContract,
    /const paths = await discoverContentPaths\(page\);[\s\S]+for \(const path of paths\)/u,
  );
  assert.doesNotMatch(specification, /Acme|Portfolio|About|Contact/u);

  assert.match(workflow, /^permissions:\n  contents: read$/mu);
  assert.match(workflow, /cancel-in-progress: true/u);
  assert.match(workflow, /\$\{\{ github\.workflow \}\}-\$\{\{ github\.ref \}\}/u);
  assert.match(workflow, /actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1/u);
  assert.match(workflow, /pnpm\/setup@84cb39b217b10273981911c288cd62326dc7c6d2/u);
  assert.match(workflow, /actions\/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a/u);
  assert.match(workflow, /persist-credentials: false/u);
  assert.match(workflow, /version: 11\.20\.0/u);
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
            version: "11.20.0",
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
        destination: "https://calendly.com/acme/intro",
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
        destination: "https://calendly.com/acme/intro",
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
  assert.equal(bookingCalendly.probes.length, 5);
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
        supportedProfiles: ["portfolio", "site"],
        accessibilityRequirements: ["page-heading-level-one"],
        analyticsDeclarations: [],
        migrationHooks: [],
      },
      text: {
        type: "text",
        contentSchemaVersion: "1.0.0",
        approvedVariants: ["default"],
        supportedProfiles: ["portfolio", "site"],
        accessibilityRequirements: ["section-heading-level-two"],
        analyticsDeclarations: [],
        migrationHooks: [],
      },
      "project-list": {
        type: "project-list",
        contentSchemaVersion: "1.0.0",
        approvedVariants: ["default"],
        supportedProfiles: ["portfolio", "site"],
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
        supportedProfiles: ["portfolio", "site"],
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
        destination: "https://calendly.com/acme/intro",
        mode: "popup",
      },
      packageVersions,
    }),
  );
  const approvedConfigurationPaths = new Set([
    "apps/web/next.config.ts",
    "apps/web/open-next.config.ts",
    "apps/web/src/infrastructure/cloudflare/observability-context.ts",
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
      .filter(([path]) => !path.startsWith(".github/workflows/"))
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
      assert.equal(output.includes(marker), false, marker);
    }
  }
});

test("ownership descriptors cover every generated surface without overlap", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  for (const [profile, expectedCount] of [
    ["portfolio", 103],
    ["site", 120],
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
      "/scripts/dev",
      "/scripts/lint",
      "/scripts/preview",
      "/scripts/test",
      "/scripts/test:component",
      "/scripts/test:component:watch",
      "/scripts/test:e2e:deployed",
      "/scripts/test:e2e:dev",
      "/scripts/test:e2e:preview",
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
        destination: "https://calendly.com/acme/intro",
        mode: "popup",
      },
      packageVersions,
    }),
  );
  assert.equal(selected.surfaces.length, 108);
  assert.deepEqual(
    selected.surfaces
      .filter(
        ({ owner }) =>
          owner.kind === "capability" &&
          owner.identifier === "booking-calendly",
      )
      .map(({ identifier }) => identifier),
    [
      "booking-calendly-browser-specification",
      "booking-calendly-client-component",
      "booking-calendly-content",
      "booking-calendly-content-reader",
      "booking-calendly-settings",
    ],
  );
});

test("rendering rejects invalid requests with stable existing contract failures", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const invalidRequests = [
    {
      request: {
        profile: "app",
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
