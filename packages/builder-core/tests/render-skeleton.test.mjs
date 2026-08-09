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
  ".gitignore",
  ".nvmrc",
  "AGENTS.md",
  "README.md",
  "apps/web/AGENTS.md",
  "apps/web/app/globals.css",
  "apps/web/app/layout.tsx",
  "apps/web/app/page.tsx",
  "apps/web/content/content.config.yaml",
  "apps/web/content/en-CA/long-form/introduction.md",
  "apps/web/content/en-CA/site.yaml",
  "apps/web/eslint.config.mjs",
  "apps/web/next.config.ts",
  "apps/web/open-next.config.ts",
  "apps/web/package.json",
  "apps/web/src/content/content-schema.ts",
  "apps/web/src/content/read-content.ts",
  "apps/web/src/infrastructure/observability/installed-capability.ts",
  "apps/web/src/presentation/content-page.tsx",
  "apps/web/tsconfig.json",
  "apps/web/wrangler.jsonc",
  "package.json",
  "pnpm-workspace.yaml",
];

const sitePaths = [
  ".gitignore",
  ".nvmrc",
  "AGENTS.md",
  "README.md",
  "apps/web/AGENTS.md",
  "apps/web/app/about/page.tsx",
  "apps/web/app/globals.css",
  "apps/web/app/layout.tsx",
  "apps/web/app/page.tsx",
  "apps/web/content/content.config.yaml",
  "apps/web/content/en-CA/about.yaml",
  "apps/web/content/en-CA/long-form/introduction.md",
  "apps/web/content/en-CA/site.yaml",
  "apps/web/eslint.config.mjs",
  "apps/web/next.config.ts",
  "apps/web/open-next.config.ts",
  "apps/web/package.json",
  "apps/web/src/content/content-schema.ts",
  "apps/web/src/content/read-content.ts",
  "apps/web/src/infrastructure/observability/installed-capability.ts",
  "apps/web/src/presentation/content-page.tsx",
  "apps/web/tsconfig.json",
  "apps/web/wrangler.jsonc",
  "package.json",
  "pnpm-workspace.yaml",
];

const packageVersions = {
  standards: "0.1.0",
  observability: "0.1.0",
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

async function loadRenderSkeleton() {
  const module = await import("../dist/index.js");
  assert.equal(typeof module.renderSkeleton, "function");
  return module.renderSkeleton;
}

async function loadGeneratedContentModule(files) {
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

  return import(
    `data:text/javascript;base64,${Buffer.from(executable).toString("base64")}`
  );
}

function assertContentInvalid(operation) {
  assert.throws(operation, {
    name: "TypeError",
    message: "CONTENT_INVALID",
  });
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

test("template rendering replaces only the three approved tokens", () => {
  const result = renderTemplateSource({
    source: "common/package.json.template",
    text: [
      "{",
      '  \"name\": \"{{projectName}}\",',
      '  \"displayName\": {{displayNameJson}},',
      '  \"worker\": \"{{workerName}}\"',
      "}",
      "",
    ].join("\r\n"),
    tokens,
  });

  const rendered = assertSuccess(result);
  assert.equal(
    rendered,
    '{\n  "name": "acme-studio",\n  "displayName": "Acme \\"Studio\\"\\nMontréal",\n  "worker": "acme-studio-web"\n}\n',
  );
  assert.deepEqual(JSON.parse(rendered), {
    name: "acme-studio",
    displayName: 'Acme "Studio"\nMontréal',
    worker: "acme-studio-web",
  });
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
    recipeVersion: "0.2.0",
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
      build: "next build",
      "build:cloudflare": "opennextjs-cloudflare build",
      "cf-typegen":
        "wrangler types --env-interface CloudflareEnv --include-runtime=false cloudflare-env.d.ts",
      dev: "next dev",
      lint: "eslint . --max-warnings 0",
      preview:
        "opennextjs-cloudflare build && opennextjs-cloudflare preview",
      typecheck: "next typegen && tsc --noEmit",
    },
    dependencies: {
      "@egeria-systems/observability": "0.1.0",
      "@opennextjs/cloudflare": "1.20.2",
      next: "16.3.0",
      react: "19.2.8",
      "react-dom": "19.2.8",
      yaml: "2.9.0",
    },
    devDependencies: {
      "@egeria-systems/standards": "0.1.0",
      "@types/node": "22.20.1",
      "@types/react": "19.2.18",
      "@types/react-dom": "19.2.4",
      eslint: "9.39.5",
      "eslint-config-next": "16.3.0",
      typescript: "6.0.3",
      "typescript-eslint": "8.66.0",
      wrangler: "4.118.0",
    },
  });
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
      home: {
        heading: displayName,
        summary: "A concise introduction to selected work.",
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
      home: {
        heading: displayName,
        summary: "A clear starting point for this website.",
      },
      navigation: [
        { href: "/", label: "Home" },
        { href: "/about", label: "About" },
      ],
    },
  );
  assert.deepEqual(
    parseGeneratedYaml(site.files, "apps/web/content/en-CA/about.yaml"),
    { heading: "About", summary: "Background and approach." },
  );

  const visibleCopy = [
    displayName,
    "A focused portfolio.",
    "A concise introduction to selected work.",
    "A multi-page public website.",
    "A clear starting point for this website.",
    "Background and approach.",
    "A focused introduction.",
    "A concise overview of selected work and the approach behind it.",
    "A website introduction.",
    "An introduction to this website and the work it presents.",
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

test("generated server readers use web-workspace string paths for YAML content", async () => {
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

  for (const source of [portfolioReader, siteReader]) {
    assert.notEqual(source, undefined);
    assert.match(source, /from "node:path"/);
    assert.match(source, /join\(process\.cwd\(\), "content\/en-CA\//);
    assert.doesNotMatch(source, /new URL|import\.meta\.url|fileURLToPath/);
  }
  assert.match(
    portfolioReader,
    /join\(\s*process\.cwd\(\),\s*"content\/content\.config\.yaml",?\s*\)/,
  );
  assert.match(
    portfolioReader,
    /join\(\s*process\.cwd\(\),\s*"content\/en-CA\/long-form\/introduction\.md",?\s*\)/,
  );
  assert.doesNotMatch(portfolioReader, /function read\w+\([^)]*(?:path|file)/i);
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
  assert.deepEqual(
    contentModule.parsePageContent(contentModule.parseYamlContent(aboutSource)),
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
  assertContentInvalid(() =>
    contentModule.parseSiteContent({
      ...siteContent,
      home: { ...siteContent.home, heading: " " },
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
      heading: "About",
      summary: "Background and approach.",
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
    "---\ntitle: &title Example\nsummary: *title\n---\nBody\n",
    "---\ntitle: First\ntitle: Second\nsummary: Summary\n---\nBody\n",
  ]) {
    assertContentInvalid(() =>
      contentModule.parseMarkdownContent(invalidMarkdown),
    );
  }
});

test("Cloudflare imports and types stay in generated configuration boundaries", async () => {
  const renderSkeleton = await loadRenderSkeleton();
  const rendered = assertSuccess(
    await renderSkeleton({
      profile: "site",
      projectName: "acme-studio",
      displayName: "Acme Studio",
      packageVersions,
    }),
  );
  const approvedConfigurationPaths = new Set([
    "apps/web/next.config.ts",
    "apps/web/open-next.config.ts",
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
    'import type { NavigationItem } from "../content/content-schema";',
  ]);
  assert.doesNotMatch(
    presentationSource,
    /(?:\b(?:fetch|process|readFile|readFileSync|useEffect|useLayoutEffect|useState)\b|node:)/,
  );
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
      /(?:apps\/jobs|packages\/|\.egeria|pnpm-lock\.yaml|middleware|\.github\/workflows)/,
    );
    const output = [...indexFiles(rendered.files).values()].join("\n").toLowerCase();
    for (const marker of [
      "app-foundation",
      "database",
      "d1",
      "queue",
      "resend",
      "better-auth",
      "stripe",
      "analytics",
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
    ["portfolio", 42],
    ["site", 44],
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
      "/devDependencies/@egeria-systems~1standards",
      "/devDependencies/@types~1node",
      "/devDependencies/@types~1react",
      "/devDependencies/@types~1react-dom",
      "/devDependencies/eslint",
      "/devDependencies/eslint-config-next",
      "/devDependencies/typescript",
      "/devDependencies/typescript-eslint",
      "/devDependencies/wrangler",
      "/name",
      "/private",
      "/scripts",
      "/type",
      "/version",
    ]);
  }
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
