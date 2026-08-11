import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { parseDocument } from "yaml";

import {
  deriveTemplateDestination,
  renderTemplateSource,
} from "../dist/generation/render-template.js";

const tokens = {
  projectName: "acme-studio",
  displayNameJson: JSON.stringify('Acme "Studio"\nMontréal'),
  workerName: "acme-studio-web",
};

const portfolioPaths = [
  ".github/workflows/quality.yml",
  ".gitignore",
  ".nvmrc",
  "AGENTS.md",
  "README.md",
  "apps/web/AGENTS.md",
  "apps/web/app/api/observability/route.ts",
  "apps/web/app/globals.css",
  "apps/web/app/layout.tsx",
  "apps/web/app/page.tsx",
  "apps/web/content/content.config.yaml",
  "apps/web/content/en-CA/long-form/introduction.md",
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
  "apps/web/postcss.config.mjs",
  "apps/web/src/content/content-schema.ts",
  "apps/web/src/content/content-source.d.ts",
  "apps/web/src/content/read-content.ts",
  "apps/web/src/infrastructure/cloudflare/observability-context.ts",
  "apps/web/src/infrastructure/observability/browser-reporter.ts",
  "apps/web/src/infrastructure/observability/installed-capability.ts",
  "apps/web/src/infrastructure/observability/server-reporter.ts",
  "apps/web/src/infrastructure/observability/web-vitals-reporter.tsx",
  "apps/web/src/presentation/content-page.tsx",
  "apps/web/src/sections/section-registry.tsx",
  "apps/web/tests/e2e/site-quality.spec.ts",
  "apps/web/tsconfig.json",
  "apps/web/wrangler.jsonc",
  "package.json",
  "pnpm-workspace.yaml",
];

const sitePaths = [
  ".github/workflows/quality.yml",
  ".gitignore",
  ".nvmrc",
  "AGENTS.md",
  "README.md",
  "apps/web/AGENTS.md",
  "apps/web/app/about/page.tsx",
  "apps/web/app/api/observability/route.ts",
  "apps/web/app/globals.css",
  "apps/web/app/layout.tsx",
  "apps/web/app/page.tsx",
  "apps/web/content/content.config.yaml",
  "apps/web/content/en-CA/about.yaml",
  "apps/web/content/en-CA/long-form/introduction.md",
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
  "apps/web/postcss.config.mjs",
  "apps/web/src/content/content-schema.ts",
  "apps/web/src/content/content-source.d.ts",
  "apps/web/src/content/read-content.ts",
  "apps/web/src/infrastructure/cloudflare/observability-context.ts",
  "apps/web/src/infrastructure/observability/browser-reporter.ts",
  "apps/web/src/infrastructure/observability/installed-capability.ts",
  "apps/web/src/infrastructure/observability/server-reporter.ts",
  "apps/web/src/infrastructure/observability/web-vitals-reporter.tsx",
  "apps/web/src/presentation/content-page.tsx",
  "apps/web/src/sections/section-registry.tsx",
  "apps/web/tests/e2e/site-quality.spec.ts",
  "apps/web/tsconfig.json",
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
  observability: "0.2.0",
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
  return new Map(files.map((file) => [file.path, decoder.decode(file.content)]));
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
  const reportKey = `__observabilityReports${observabilityRouteLoad}`;
  globalThis[reportKey] = [];
  const reporterModule = `data:text/javascript;base64,${Buffer.from(
    [
      `export async function reportBrowserEvent(input) { globalThis[${JSON.stringify(reportKey)}].push(input);`,
      ...(throwOnReport ? ['throw new Error("transport failed");'] : []),
      "}",
    ].join("\n"),
  ).toString("base64")}`;
  const executable = transpiled.replace(
    'from "../../../src/infrastructure/observability/server-reporter"',
    `from ${JSON.stringify(reporterModule)}`,
  );
  assert.notEqual(executable, transpiled);

  return {
    module: await import(
      `data:text/javascript;base64,${Buffer.from(executable).toString("base64")}#route-${observabilityRouteLoad}`
    ),
    reports: globalThis[reportKey],
  };
}

function browserErrorEnvelope(overrides = {}) {
  return {
    schemaVersion: "1.0.0",
    event: {
      name: "browser.window.error",
      kind: "application.error",
      runtime: "browser",
      severity: "error",
      context: { correlationId: "browser-event-123" },
      errorCategory: "unexpected",
      attributes: { source: "window-error" },
    },
    ...overrides,
  };
}

function observabilityRequest(body, overrides = {}) {
  return new Request("https://portfolio.example/api/observability", {
    method: "POST",
    headers: {
      origin: "https://portfolio.example",
      "content-type": "application/json",
      ...overrides.headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

let serverReporterLoad = 0;

async function loadGeneratedServerReporter(files) {
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
  const eventKey = `__serverReporterEvents${serverReporterLoad}`;
  globalThis[eventKey] = [];
  const rootModule = `data:text/javascript;base64,${Buffer.from(
    [
      `export function createOperationalEvent(input) { globalThis[${JSON.stringify(eventKey)}].push(input); return { ok: true, value: Object.freeze({}) }; }`,
      'export function normalizeErrorCategory() { return "unexpected"; }',
      'export function dispatchOperationalEvent() { return Promise.reject(new Error("provider failed")); }',
    ].join("\n"),
  ).toString("base64")}`;
  const serverModule = `data:text/javascript;base64,${Buffer.from(
    [
      "export function createStructuredLogSink() { return Object.freeze({}); }",
      "export function createBetterStackSink() { return Object.freeze({ ok: false }); }",
    ].join("\n"),
  ).toString("base64")}`;
  const contextModule = `data:text/javascript;base64,${Buffer.from(
    [
      "export async function readObservabilityRuntimeContext() {",
      'return { ingestingHost: "", sourceToken: "", releaseId: "release-123", schedule() { throw new Error("context failed"); } };',
      "}",
    ].join("\n"),
  ).toString("base64")}`;
  const withRoot = transpiled.replace(
    'from "@egeria-systems/observability"',
    `from ${JSON.stringify(rootModule)}`,
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
    events: globalThis[eventKey],
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
    assertSuccess(deriveTemplateDestination("site/apps/web/next.config.ts")),
    "apps/web/next.config.ts",
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
    for (const { path, content } of rendered.files) {
      assert.equal(path.startsWith("/"), false);
      assert.equal(path.includes(".."), false);
      assert.equal(path.includes("\\"), false);
      assert.doesNotMatch(path, /[\u0000-\u001f\u007f]/);

      const text = decoder.decode(content);
      assert.equal(text.includes("\r"), false);
      assert.equal(text.endsWith("\n"), true);
      assert.equal(text.endsWith("\n\n"), false);
    }
  }
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
    recipeVersion: "0.6.0",
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
      typecheck: "pnpm --dir apps/web run typecheck",
      verify:
        "pnpm run lint && pnpm run typecheck && pnpm run build && pnpm run build:cloudflare",
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
      "test:e2e:deployed":
        "playwright test --config playwright.deployed.config.ts",
      "test:e2e:dev": "playwright test --config playwright.dev.config.ts",
      "test:e2e:preview":
        "playwright test --config playwright.preview.config.ts",
      typecheck: "next typegen && tsc --noEmit",
    },
    dependencies: {
      "@egeria-systems/observability": "0.2.0",
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
      "@types/node": "22.20.1",
      "@types/react": "19.2.18",
      "@types/react-dom": "19.2.4",
      eslint: "9.39.5",
      "eslint-config-next": "16.3.0",
      postcss: "8.5.26",
      "raw-loader": "4.0.2",
      tailwindcss: "4.3.3",
      typescript: "6.0.3",
      "typescript-eslint": "8.66.0",
      wrangler: "4.118.0",
    },
  });
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
    /minimumReleaseAgeExclude:\n  - "@egeria-systems\/observability@0\.2\.0"/u,
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

test("the browser route accepts only bounded same-origin operational envelopes", async () => {
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

  assert.equal(
    (await loaded.module.POST(observabilityRequest(browserErrorEnvelope())))
      .status,
    202,
  );
  assert.deepEqual(loaded.reports, [
    {
      name: "browser.window.error",
      kind: "application.error",
      severity: "error",
      correlationId: "browser-event-123",
      errorCategory: "unexpected",
      attributes: { source: "window-error" },
      allowedAttributeNames: ["source"],
    },
  ]);

  const invalidRequests = [
    [
      observabilityRequest(browserErrorEnvelope(), {
        headers: { origin: "https://cross-origin.example" },
      }),
      403,
    ],
    [
      observabilityRequest(browserErrorEnvelope(), {
        headers: { "content-type": "text/plain" },
      }),
      415,
    ],
    [observabilityRequest("{"), 400],
    [
      observabilityRequest({
        ...browserErrorEnvelope(),
        unexpected: true,
      }),
      400,
    ],
    [
      observabilityRequest({
        ...browserErrorEnvelope(),
        event: {
          ...browserErrorEnvelope().event,
          message: "private error message",
        },
      }),
      400,
    ],
    [
      observabilityRequest({
        ...browserErrorEnvelope(),
        event: {
          ...browserErrorEnvelope().event,
          kind: "visitor.analytics",
        },
      }),
      400,
    ],
    [
      observabilityRequest({
        ...browserErrorEnvelope(),
        event: {
          ...browserErrorEnvelope().event,
          context: { correlationId: "bearer-secret-token" },
        },
      }),
      400,
    ],
    [
      observabilityRequest("x".repeat(8_193)),
      413,
    ],
    [
      observabilityRequest(browserErrorEnvelope(), {
        headers: { "content-length": "8193" },
      }),
      413,
    ],
  ];
  for (const [request, status] of invalidRequests) {
    assert.equal((await loaded.module.POST(request)).status, status);
  }
  assert.equal(loaded.reports.length, 1);

  let pullCount = 0;
  let cancelled = false;
  const oversizedStream = new ReadableStream(
    {
      pull(controller) {
        pullCount += 1;
        controller.enqueue(
          new Uint8Array(pullCount === 1 ? 8_192 : 1),
        );
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  assert.equal(
    (
      await loaded.module.POST({
        body: oversizedStream,
        headers: new Headers({
          origin: "https://portfolio.example",
          "content-type": "application/json",
        }),
        url: "https://portfolio.example/api/observability",
      })
    ).status,
    413,
  );
  assert.equal(pullCount, 2);
  assert.equal(cancelled, true);

  const failedTransport = await loadGeneratedObservabilityRoute(
    rendered.files,
    true,
  );
  assert.equal(
    (
      await failedTransport.module.POST(
        observabilityRequest(browserErrorEnvelope()),
      )
    ).status,
    202,
  );
  assert.equal(failedTransport.reports.length, 1);
});

test("server reporting contains runtime and provider failures without raw error data", async () => {
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

  await assert.doesNotReject(() =>
    loaded.module.reportServerError(
      new Error("private message with bearer-secret-token"),
    ),
  );
  assert.equal(loaded.events.length, 1);
  assert.deepEqual(loaded.events[0], {
    name: "server.request.error",
    kind: "application.error",
    runtime: "server",
    severity: "error",
    context: {
      correlationId: loaded.events[0].context.correlationId,
      releaseId: "release-123",
    },
    errorCategory: "unexpected",
    attributes: {},
  });
  assert.match(
    loaded.events[0].context.correlationId,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
  );
  assert.doesNotMatch(
    JSON.stringify(loaded.events),
    /private message|bearer-secret-token/u,
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
    assert.equal(rendered.project.recipeVersion, "0.6.0");
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
  const specification = files.get("apps/web/tests/e2e/site-quality.spec.ts");
  const workflow = files.get(".github/workflows/quality.yml");
  const workflowConfiguration = parseGeneratedYaml(
    rendered.files,
    ".github/workflows/quality.yml",
  );
  const ignore = files.get(".gitignore");
  const readme = files.get("README.md");

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
  assert.match(preview, /pnpm run preview --ip 127\.0\.0\.1 --port 3101/u);
  assert.match(preview, /reuseExistingServer: false/u);

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
  assert.match(workflow, /pnpm\/setup@4700d737c3d7a2e7199f3d42a920f0bf7f34e411/u);
  assert.match(workflow, /actions\/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a/u);
  assert.match(workflow, /persist-credentials: false/u);
  assert.match(workflow, /version: 11\.20\.0/u);
  assert.match(workflow, /runtime: node@22\.23\.2/u);
  assert.match(workflow, /pnpm install --frozen-lockfile/u);
  assert.match(workflow, /browser:install:ci/u);
  assert.match(workflow, /pnpm run verify/u);
  assert.match(workflow, /test:e2e:dev/u);
  assert.match(workflow, /test:e2e:preview/u);
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
      "timeout-minutes": 30,
      steps: [
        {
          name: "Check out repository",
          uses: "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
          with: { "persist-credentials": false },
        },
        {
          name: "Set up pnpm and Node.js",
          uses: "pnpm/setup@4700d737c3d7a2e7199f3d42a920f0bf7f34e411",
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
        {
          name: "Install Chromium",
          run: "pnpm --dir apps/web run browser:install:ci",
        },
        { name: "Run static and build gates", run: "pnpm run verify" },
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
  assert.match(readme, /does not establish WCAG conformance/iu);
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
        rendered.files.map(({ path, content }) => [
          path,
          decoder.decode(content),
        ]),
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
      selected.files.map(({ path, content }) => [path, decoder.decode(content)]),
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
      ],
    },
  );
  assert.deepEqual(
    parseGeneratedYaml(site.files, "apps/web/content/en-CA/about.yaml"),
    {
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
      .filter(([path]) => path.endsWith(".ts") || path.endsWith(".tsx"))
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
    "apps/web/app/about/page.tsx",
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
  const aboutContent = contentModule.parsePageContent(
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
    contentModule.parsePageContent({
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
      .filter(([path]) => path !== ".github/workflows/quality.yml")
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
    ["portfolio", 75],
    ["site", 77],
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
      "/devDependencies/@types~1node",
      "/devDependencies/@types~1react",
      "/devDependencies/@types~1react-dom",
      "/devDependencies/eslint",
      "/devDependencies/eslint-config-next",
      "/devDependencies/postcss",
      "/devDependencies/raw-loader",
      "/devDependencies/tailwindcss",
      "/devDependencies/typescript",
      "/devDependencies/typescript-eslint",
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
      "/scripts/test:e2e:deployed",
      "/scripts/test:e2e:dev",
      "/scripts/test:e2e:preview",
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
  assert.equal(selected.surfaces.length, 80);
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
