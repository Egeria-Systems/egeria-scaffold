import assert from "node:assert/strict";
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const reviewedRecipeLockfile = resolve(
  packageRoot,
  "lockfiles/web-recipe-0.8.0/pnpm-lock.yaml",
);
const core = await import(pathToFileURL(resolve(packageRoot, "dist/index.js")));
const verifierModule = await import(
  pathToFileURL(
    resolve(packageRoot, "dist/generation/verify-generated-project.js"),
  ),
);

const generatedChecks = [
  "lockfile",
  "frozen-install",
  "lint",
  "typecheck",
  "unit-tests",
  "component-tests",
  "next-build",
  "opennext-build",
];
const completeChecks = [
  "contracts",
  "pre-state-inference",
  ...generatedChecks,
  "post-state-inference",
];
const portfolioRenderedPaths = [
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
  "apps/web/tsconfig.json",
  "apps/web/vitest.config.ts",
  "apps/web/wrangler.jsonc",
  "package.json",
  "pnpm-workspace.yaml",
];
const siteRenderedPaths = [
  ...portfolioRenderedPaths,
  "apps/web/app/about/page.tsx",
  "apps/web/content/en-CA/about.yaml",
].sort();
const bookingCalendlyRenderedPaths = [
  "apps/web/content/en-CA/booking-calendly.yaml",
  "apps/web/src/integrations/booking-calendly/booking-content.ts",
  "apps/web/src/integrations/booking-calendly/booking-settings.ts",
  "apps/web/src/integrations/booking-calendly/calendly-booking.tsx",
  "apps/web/tests/e2e/calendly-booking.spec.ts",
];
const controlPaths = [
  ".egeria/migrations.jsonl",
  ".egeria/project.yaml",
  ".egeria/state.json",
  "pnpm-lock.yaml",
];

function request(profile = "portfolio") {
  return {
    profile,
    projectName: profile === "portfolio" ? "acme-portfolio" : "acme-site",
    displayName: profile === "portfolio" ? "Acme Portfolio" : "Acme Site",
  };
}

function assertSuccess(result) {
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  return result.value;
}

function assertFailure(result, code) {
  assert.equal(result.ok, false);
  assert.deepEqual(result.issues.map((issue) => issue.code), [code]);
  assert.ok(result.issues.every((issue) => !("input" in issue)));
}

async function exists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
      return false;
    }
    throw error;
  }
}

async function listFiles(root) {
  const files = [];

  async function visit(path, relativePath) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const entryPath = join(path, entry.name);
      const entryRelativePath = relativePath
        ? `${relativePath}/${entry.name}`
        : entry.name;

      if (entry.isDirectory()) {
        await visit(entryPath, entryRelativePath);
      } else {
        files.push(entryRelativePath);
      }
    }
  }

  await visit(root, "");
  return files.sort();
}

async function infer(root) {
  return core.inferRepository({
    reader: core.createFileSystemRepositoryReader(root),
    catalog: assertSuccess(core.createVerifiedCapabilityCatalog()),
  });
}

function createFakeVerifier(options = {}) {
  const calls = [];
  const roots = [];
  const preStateInferences = [];

  return {
    calls,
    roots,
    preStateInferences,
    verifier: {
      async prepareLockfile(root) {
        calls.push("prepare-lockfile");
        roots.push(root);
        assert.equal(await exists(join(root, ".egeria/state.json")), false);
        assert.equal(await exists(join(root, ".egeria/migrations.jsonl")), false);

        if (options.prepare !== undefined) {
          return options.prepare(root);
        }

        await writeFile(join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
        return { ok: true, value: undefined };
      },
      async verifyInIsolatedCopy(root) {
        calls.push("verify-isolated-copy");
        roots.push(root);
        assert.equal(await exists(join(root, ".egeria/state.json")), false);
        assert.equal(await exists(join(root, ".egeria/migrations.jsonl")), false);
        preStateInferences.push(await infer(root));

        if (options.verify !== undefined) {
          return options.verify(root);
        }

        return { ok: true, value: { checks: generatedChecks } };
      },
    },
  };
}

async function withTestRoot(run) {
  const owner = await mkdtemp(join(tmpdir(), "egeria-generation-test-"));

  try {
    await run(owner);
  } finally {
    await rm(owner, { recursive: true, force: true });
  }
}

async function createFakePnpmExecutable(owner) {
  const executable = join(owner, "fake-pnpm");
  const controlPath = join(owner, "fake-pnpm-control.json");
  const logPath = join(owner, "fake-pnpm-log.jsonl");
  const source = `#!${process.execPath}
import { appendFileSync, readFileSync } from "node:fs";

const control = JSON.parse(readFileSync(${JSON.stringify(controlPath)}, "utf8"));
const arguments_ = process.argv.slice(2);
const operation = arguments_.join(" ");
appendFileSync(
  ${JSON.stringify(logPath)},
  JSON.stringify({ arguments: arguments_, cwd: process.cwd(), environment: process.env }) + "\\n",
);

if (control.overflowOperation === operation) {
  process.stdout.write("sensitive-output".repeat(100_000));
}
if (
  control.failureOperation === operation ||
  (control.failureOperationPrefix !== undefined &&
    operation.startsWith(control.failureOperationPrefix))
) {
  process.stderr.write("sensitive-error");
  process.exit(23);
}
if (operation === "--version") {
  process.stdout.write((control.version ?? "11.20.0") + "\\n");
  process.exit(0);
}
`;

  await writeFile(executable, source);
  await chmod(executable, 0o700);
  await writeFile(controlPath, "{}\n");

  return {
    executable,
    async configure(value) {
      await writeFile(controlPath, `${JSON.stringify(value)}\n`);
    },
    async readCalls() {
      if (!(await exists(logPath))) {
        return [];
      }
      return (await readFile(logPath, "utf8"))
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    },
  };
}

async function createVerifierSource(owner, name = "source") {
  const root = join(owner, name);
  await mkdir(root);
  await writeFile(join(root, "package.json"), '{"private":true}\n');
  await writeFile(join(root, "marker"), "source-marker\n");
  return root;
}

async function snapshotFileBytes(root) {
  const snapshot = new Map();
  for (const path of await listFiles(root)) {
    snapshot.set(path, await readFile(join(root, path), "base64"));
  }
  return snapshot;
}

test("builder-core exports new-directory generation without caller package versions", async () => {
  assert.equal(typeof core.generateProject, "function");
  assert.equal(typeof core.createPnpmGeneratedProjectVerifier, "function");
  const declaration = await readFile(
    resolve(packageRoot, "dist/generation/write-generated-project.d.ts"),
    "utf8",
  );
  assert.match(
    declaration,
    /ProjectGenerationRequest = Omit<\s*GenerationRequest,\s*"packageVersions"\s*>/,
  );
});

test("the internal generated-project verification receipt is frozen", () => {
  assert.deepEqual(verifierModule.verificationChecks, generatedChecks);
  assert.equal(Object.isFrozen(verifierModule.verificationChecks), true);
  assert.equal(
    verifierModule.verificationChecks.some((check) =>
      /browser|playwright|e2e/u.test(check),
    ),
    false,
  );
});

test("failed exclusive writes never delete a possibly replaced path", async () => {
  for (const failureStage of ["write", "close"]) {
    let removeAttempted = false;
    const result = await verifierModule.writeExclusive(
      "created-lockfile",
      new Uint8Array([1]),
      {
        async open() {
          return {
            async stat() {
              return {
                isFile: () => true,
                isSymbolicLink: () => false,
                dev: 1n,
                ino: 2n,
              };
            },
            async writeFile() {
              if (failureStage === "write") {
                throw new Error("write failed");
              }
            },
            async close() {
              if (failureStage === "close") {
                throw new Error("close failed");
              }
            },
          };
        },
        async remove() {
          removeAttempted = true;
        },
      },
    );

    assert.deepEqual(result, { ok: false, sourceChanged: true });
    assert.equal(removeAttempted, false);
  }

  const openFailure = await verifierModule.writeExclusive(
    "pre-existing-lockfile",
    new Uint8Array(),
    {
      async open() {
        throw new Error("exclusive creation failed");
      },
    },
  );
  assert.deepEqual(openFailure, { ok: false, sourceChanged: false });
});

test("lockfile preparation reports a failed exclusive-write source mutation", async () => {
  await withTestRoot(async (owner) => {
    const source = await createVerifierSource(owner);
    const result = await verifierModule.prepareLockfile(source, async () => ({
      ok: false,
      sourceChanged: true,
    }));

    assert.deepEqual(result, {
      ok: false,
      issues: [
        {
          code: "LOCKFILE_PREPARATION_FAILED",
          path: [],
          context: { reason: "lockfile-write-failed-source-changed" },
        },
      ],
    });
  });
});

test("the pnpm verifier materializes reviewed recipe bytes before exact isolated commands", async () => {
  await withTestRoot(async (owner) => {
    const fakePnpm = await createFakePnpmExecutable(owner);
    const source = await createVerifierSource(owner);
    const canonicalSource = await realpath(source);
    const verifier = core.createPnpmGeneratedProjectVerifier({
      pnpmExecutable: fakePnpm.executable,
    });

    assertSuccess(await verifier.prepareLockfile(source));
    assert.deepEqual(await fakePnpm.readCalls(), []);
    assert.deepEqual(
      await readFile(join(source, "pnpm-lock.yaml")),
      await readFile(reviewedRecipeLockfile),
    );
    const beforeVerification = await snapshotFileBytes(source);
    assert.deepEqual(assertSuccess(await verifier.verifyInIsolatedCopy(source)), {
      checks: generatedChecks,
    });
    assert.deepEqual(await snapshotFileBytes(source), beforeVerification);

    const calls = await fakePnpm.readCalls();
    assert.deepEqual(
      calls.map(({ arguments: arguments_ }) => arguments_),
      [
        ["--version"],
        [
          "install",
          "--frozen-lockfile",
          "--store-dir",
          calls[1].arguments.at(-1),
        ],
        ["run", "lint"],
        ["run", "typecheck"],
        ["run", "test:unit"],
        ["run", "test:component"],
        ["run", "build"],
        [
          "--dir",
          "apps/web",
          "exec",
          "opennextjs-cloudflare",
          "build",
          "--skipNextBuild",
        ],
      ],
    );
    assert.notEqual(calls[0].cwd, canonicalSource);
    assert.ok(calls.every(({ cwd }) => cwd === calls[0].cwd));

    const forbiddenEnvironmentKeys = [
      "TOKEN",
      "SECRET",
      "PASSWORD",
      "NPM_TOKEN",
      "NODE_OPTIONS",
      "ARBITRARY_INHERITED_VALUE",
    ];
    const allowedEnvironmentKeys = new Set([
      "CI",
      "HOME",
      "USERPROFILE",
      "TMPDIR",
      "TMP",
      "TEMP",
      "NPM_CONFIG_REGISTRY",
      "NPM_CONFIG_USERCONFIG",
      "NEXT_TELEMETRY_DISABLED",
      "PATH",
      "SystemRoot",
      "ComSpec",
      "PATHEXT",
      "LANG",
      "__CF_USER_TEXT_ENCODING",
    ]);

    for (const { arguments: arguments_, environment } of calls) {
      assert.ok(
        Object.keys(environment).every((key) => allowedEnvironmentKeys.has(key)),
        JSON.stringify(Object.keys(environment)),
      );
      assert.ok(forbiddenEnvironmentKeys.every((key) => !(key in environment)));
      assert.equal(environment.CI, "true");
      assert.equal(environment.NEXT_TELEMETRY_DISABLED, "1");
      assert.equal(environment.NPM_CONFIG_REGISTRY, "https://registry.npmjs.org/");
      assert.ok(environment.NPM_CONFIG_USERCONFIG.endsWith("/.npmrc"));
      assert.equal(await exists(environment.HOME), false);
      assert.equal(await exists(environment.NPM_CONFIG_USERCONFIG), false);
      assert.equal(await exists(arguments_.at(-1)), false);
    }

    const commandText = calls
      .flatMap(({ arguments: arguments_ }) => arguments_)
      .join(" ");
    assert.doesNotMatch(
      commandText,
      /preview|deploy|upload|wrangler|git|npm publish|--force|--update-checksums|[;&|`$<>]/i,
    );
  });
});

test("the pnpm verifier rejects pre-existing lockfile targets without invoking pnpm", async () => {
  await withTestRoot(async (owner) => {
    const fakePnpm = await createFakePnpmExecutable(owner);

    for (const scenario of [
      {
        name: "regular-lockfile",
        create: (path) => writeFile(path, "keep-lockfile\n"),
      },
      { name: "directory-lockfile", create: (path) => mkdir(path) },
      {
        name: "symlink-lockfile",
        create: (path) => symlink("package.json", path),
      },
    ]) {
      const source = await createVerifierSource(owner, scenario.name);
      await scenario.create(join(source, "pnpm-lock.yaml"));
      const verifier = core.createPnpmGeneratedProjectVerifier({
        pnpmExecutable: fakePnpm.executable,
      });
      assertFailure(
        await verifier.prepareLockfile(source),
        "LOCKFILE_PREPARATION_FAILED",
      );
      assert.deepEqual(await fakePnpm.readCalls(), []);
      assert.equal(await exists(source), true);
    }
  });
});

test("the pnpm verifier maps command failures without child output", async () => {
  await withTestRoot(async (owner) => {
    const cases = [
      ["--version", "PNPM_VERSION_INVALID", "exact"],
      [
        "install --frozen-lockfile --store-dir ignored",
        "FROZEN_INSTALL_FAILED",
        "prefix",
      ],
      ["run lint", "LINT_FAILED", "exact"],
      ["run typecheck", "TYPECHECK_FAILED", "exact"],
      ["run test:unit", "UNIT_TESTS_FAILED", "exact"],
      ["run test:component", "COMPONENT_TESTS_FAILED", "exact"],
      ["run build", "NEXT_BUILD_FAILED", "exact"],
      [
        "--dir apps/web exec opennextjs-cloudflare build --skipNextBuild",
        "OPENNEXT_BUILD_FAILED",
        "exact",
      ],
    ];

    for (const [operation, code, match] of cases) {
      const caseOwner = await mkdtemp(join(owner, "failure-case-"));
      const fakePnpm = await createFakePnpmExecutable(caseOwner);
      const source = await createVerifierSource(caseOwner);
      const verifier = core.createPnpmGeneratedProjectVerifier({
        pnpmExecutable: fakePnpm.executable,
      });

      assertSuccess(await verifier.prepareLockfile(source));
      if (match === "prefix") {
        await fakePnpm.configure({ failureOperationPrefix: operation.split(" ignored")[0] });
      } else {
        await fakePnpm.configure({ failureOperation: operation });
      }

      const result = await verifier.verifyInIsolatedCopy(source);
      assertFailure(result, code);
      assert.equal(
        result.issues[0]?.context.reason,
        "command-failed;exit-code=23;timed-out=false",
      );
      assert.doesNotMatch(JSON.stringify(result.issues), /sensitive-output|sensitive-error/);
      assert.equal(await exists(source), true);
    }

    const overflowOwner = await mkdtemp(join(owner, "overflow-case-"));
    const overflowPnpm = await createFakePnpmExecutable(overflowOwner);
    const overflowSource = await createVerifierSource(overflowOwner);
    const overflowVerifier = core.createPnpmGeneratedProjectVerifier({
      pnpmExecutable: overflowPnpm.executable,
    });
    assertSuccess(await overflowVerifier.prepareLockfile(overflowSource));
    await overflowPnpm.configure({ overflowOperation: "--version" });
    assertFailure(
      await overflowVerifier.verifyInIsolatedCopy(overflowSource),
      "PNPM_VERSION_INVALID",
    );

    const versionOwner = await mkdtemp(join(owner, "version-case-"));
    const versionPnpm = await createFakePnpmExecutable(versionOwner);
    const versionSource = await createVerifierSource(versionOwner);
    const versionVerifier = core.createPnpmGeneratedProjectVerifier({
      pnpmExecutable: versionPnpm.executable,
    });
    assertSuccess(await versionVerifier.prepareLockfile(versionSource));
    await versionPnpm.configure({ version: "11.19.0" });
    assertFailure(
      await versionVerifier.verifyInIsolatedCopy(versionSource),
      "PNPM_VERSION_INVALID",
    );
  });
});

test("command failure diagnostics retain only bounded process metadata", () => {
  assert.equal(
    verifierModule.commandFailureReason({ code: 23, killed: false }),
    "command-failed;exit-code=23;timed-out=false",
  );
  assert.equal(
    verifierModule.commandFailureReason({ code: null, killed: true }),
    "command-failed;timed-out=true",
  );
  assert.equal(
    verifierModule.commandFailureReason({
      code: "sensitive-error",
      killed: "sensitive-output",
    }),
    "command-failed",
  );
});

test("portfolio and site generation writes exact state-last repositories", async () => {
  await withTestRoot(async (owner) => {
    for (const profile of ["portfolio", "site"]) {
      const destination = join(owner, profile);
      const fake = createFakeVerifier();
      const generated = assertSuccess(
        await core.generateProject({
          request: request(profile),
          destination,
          verifier: fake.verifier,
        }),
      );

      assert.deepEqual(fake.calls, [
        "prepare-lockfile",
        "verify-isolated-copy",
      ]);
      assert.equal(fake.roots[0], fake.roots[1]);
      assert.equal(await exists(fake.roots[0]), false);
      assert.equal(generated.destination, join(await realpath(owner), profile));
      assert.deepEqual(
        await listFiles(destination),
        [
          ...(profile === "portfolio"
            ? portfolioRenderedPaths
            : siteRenderedPaths),
          ...controlPaths,
        ].sort(),
      );

      const state = core.parseStateJson(
        await readFile(join(destination, ".egeria/state.json"), "utf8"),
      );
      assert.deepEqual(assertSuccess(state), generated.state);
      assert.deepEqual(generated.state.lastSuccessfulVerification, {
        kind: "generation",
        checks: completeChecks,
      });
      assert.deepEqual(generated.state.appliedMigrations, []);
      assert.deepEqual(generated.state.ejections, []);
      assert.deepEqual(generated.state.compatibility, {
        node: "22.23.2",
        pnpm: "11.20.0",
        platformAdapter: "cloudflare-workers",
      });
      assert.equal(generated.state.origin.recipeVersion, "0.8.0");
      assert.equal(
        generated.state.managedSurfaces.length,
        profile === "portfolio" ? 100 : 102,
      );
      assert.equal(
        generated.state.installedCapabilities.find(
          ({ identifier }) => identifier === "observability",
        )?.version,
        "0.3.0",
      );
      assert.equal(
        generated.state.installedCapabilities.find(
          ({ identifier }) => identifier === "standards",
        )?.version,
        "0.3.0",
      );
      assert.equal(
        generated.state.installedCapabilities.find(
          ({ identifier }) => identifier === "content-files",
        )?.version,
        "0.4.0",
      );
      assert.equal(
        generated.state.installedCapabilities.find(
          ({ identifier }) => identifier === "section-composition",
        )?.version,
        "0.3.0",
      );
      assert.equal(
        generated.state.installedCapabilities.find(
          ({ identifier }) => identifier === "site-routing",
        )?.version,
        profile === "site" ? "0.3.0" : undefined,
      );

      const catalog = assertSuccess(core.createVerifiedCapabilityCatalog());
      const resolved = assertSuccess(
        core.resolveCapabilities({ profile }, catalog, core.profileRecipes),
      );
      assert.deepEqual(
        generated.state.installedCapabilities,
        core.createInstalledManifest(resolved),
      );

      const preStateInference = fake.preStateInferences[0];
      assert.deepEqual(preStateInference.state, { kind: "missing" });
      assert.deepEqual(
        preStateInference.capabilities.map(({ identifier, category }) => ({
          identifier,
          category,
        })),
        resolved.capabilities.map(({ identifier }) => ({
          identifier,
          category: "probable",
        })).sort((left, right) => left.identifier.localeCompare(right.identifier)),
      );

      const postStateInference = await infer(destination);
      assert.equal(postStateInference.state.kind, "valid");
      assert.deepEqual(
        postStateInference.capabilities.map(({ identifier, category }) => ({
          identifier,
          category,
        })),
        resolved.capabilities.map(({ identifier }) => ({
          identifier,
          category: "confirmed",
        })).sort((left, right) => left.identifier.localeCompare(right.identifier)),
      );
      assert.ok(
        postStateInference.surfaces.every(({ status }) =>
          ["confirmed", "application-owned"].includes(status),
        ),
      );

      for (const [identifier, path] of [
        ["builder-project-configuration", ".egeria/project.yaml"],
        ["builder-dependency-lockfile", "pnpm-lock.yaml"],
        ["builder-migration-log", ".egeria/migrations.jsonl"],
      ]) {
        const surface = generated.state.managedSurfaces.find(
          (candidate) => candidate.identifier === identifier,
        );
        assert.notEqual(surface, undefined);
        assert.deepEqual(surface.owner, { kind: "builder-kernel" });
        assert.equal(surface.path, path);
        assert.equal(surface.ownership, "managed");
        assert.deepEqual(surface.fingerprintTarget, { kind: "file" });
        assert.equal(surface.mergeStrategy, "replace-file");
        assert.equal(
          surface.fingerprint,
          core.fingerprintFileContent(
            await readFile(join(destination, surface.path)),
          ),
        );
      }
      assert.equal(
        (await readFile(join(destination, ".egeria/migrations.jsonl"))).length,
        0,
      );

      const webManifest = JSON.parse(
        await readFile(join(destination, "apps/web/package.json"), "utf8"),
      );
      assert.equal(
        webManifest.devDependencies["@egeria-systems/standards"],
        "0.1.0",
      );
      assert.equal(
        webManifest.devDependencies["@axe-core/playwright"],
        "4.12.1",
      );
      assert.equal(
        webManifest.devDependencies["@playwright/test"],
        "1.62.1",
      );
      assert.deepEqual(
        Object.fromEntries(
          Object.entries(webManifest.devDependencies).filter(([name]) =>
            [
              "@testing-library/dom",
              "@testing-library/jest-dom",
              "@testing-library/react",
              "@testing-library/user-event",
              "@vitejs/plugin-react",
              "jsdom",
              "vitest",
            ].includes(name),
          ),
        ),
        {
          "@testing-library/dom": "10.4.1",
          "@testing-library/jest-dom": "7.0.1",
          "@testing-library/react": "16.3.2",
          "@testing-library/user-event": "14.6.3",
          "@vitejs/plugin-react": "6.0.5",
          jsdom: "30.0.1",
          vitest: "4.1.10",
        },
      );
      assert.deepEqual(
        Object.fromEntries(
          Object.entries(webManifest.scripts).filter(([name]) =>
            /^test(?::(?:component|unit))?(?::watch)?$/u.test(name),
          ),
        ),
        {
          test: "vitest run",
          "test:component": "vitest run --project component",
          "test:component:watch": "vitest --project component",
          "test:unit": "vitest run --project unit",
          "test:unit:watch": "vitest --project unit",
          "test:watch": "vitest",
        },
      );
      assert.deepEqual(
        Object.fromEntries(
          Object.entries(webManifest.scripts).filter(([name]) =>
            /^(?:browser:install(?::ci)?|test:e2e:(?:deployed|dev|preview))$/u.test(
              name,
            ),
          ),
        ),
        {
          "browser:install": "playwright install chromium",
          "browser:install:ci": "playwright install --with-deps chromium",
          "test:e2e:deployed":
            "playwright test --config playwright.deployed.config.ts",
          "test:e2e:dev":
            "playwright test --config playwright.dev.config.ts",
          "test:e2e:preview":
            "playwright test --config playwright.preview.config.ts",
        },
      );
      assert.equal(
        webManifest.devDependencies["@tailwindcss/postcss"],
        "4.3.3",
      );
      assert.equal(webManifest.devDependencies.postcss, "8.5.26");
      assert.equal(webManifest.devDependencies.tailwindcss, "4.3.3");
      assert.equal(
        webManifest.dependencies["@egeria-systems/observability"],
        "0.3.0",
      );

      const deliveredPaths = await listFiles(destination);
      assert.ok(
        deliveredPaths.every(
          (path) =>
            !/(^|\/)(?:node_modules|\.next|\.open-next|\.wrangler|\.pnpm-store|\.egeria-validation)(?:\/|$)/u.test(
              path,
            ),
        ),
      );
    }
  });
});

test("generation rejects caller version overrides before creating a destination", async () => {
  await withTestRoot(async (owner) => {
    const destination = join(owner, "version-override");
    const fake = createFakeVerifier();
    const result = await core.generateProject({
      request: {
        ...request(),
        packageVersions: { standards: "9.9.9", observability: "9.9.9" },
      },
      destination,
      verifier: fake.verifier,
    });

    assertFailure(result, "PROJECT_GENERATION_REQUEST_INVALID");
    assert.deepEqual(fake.calls, []);
    assert.equal(await exists(destination), false);
    assert.doesNotMatch(JSON.stringify(result.issues), /9\.9\.9/);
  });
});

test("generation accepts only the exact optional Calendly request key", async () => {
  await withTestRoot(async (owner) => {
    const bookingCalendly = {
      destination: "https://calendly.com/acme/intro",
      mode: "popup",
    };
    const acceptedDestination = join(owner, "accepted-selection");
    const acceptedVerifier = createFakeVerifier();
    const accepted = assertSuccess(
      await core.generateProject({
        request: { ...request(), bookingCalendly },
        destination: acceptedDestination,
        verifier: acceptedVerifier.verifier,
      }),
    );

    assert.deepEqual(acceptedVerifier.calls, [
      "prepare-lockfile",
      "verify-isolated-copy",
    ]);
    assert.equal(await exists(acceptedDestination), true);
    assert.deepEqual(
      await listFiles(acceptedDestination),
      [
        ...portfolioRenderedPaths,
        ...bookingCalendlyRenderedPaths,
        ...controlPaths,
      ].sort(),
    );

    const project = assertSuccess(
      core.parseProjectYaml(
        await readFile(
          join(acceptedDestination, ".egeria/project.yaml"),
          "utf8",
        ),
      ),
    );
    assert.deepEqual(project.capabilitySettings, {
      "booking-calendly": bookingCalendly,
    });
    assert.equal(project.selectedCapabilities.at(-1), "booking-calendly");

    const catalog = assertSuccess(core.createVerifiedCapabilityCatalog());
    const resolved = assertSuccess(
      core.resolveCapabilities(
        {
          profile: "portfolio",
          requestedCapabilities: ["booking-calendly"],
        },
        catalog,
        core.profileRecipes,
      ),
    );
    assert.deepEqual(project.selectedCapabilities, [
      "standards",
      "content-files",
      "section-composition",
      "deployment-cloudflare",
      "observability",
      "booking-calendly",
    ]);
    assert.deepEqual(
      accepted.state.installedCapabilities,
      core.createInstalledManifest(resolved),
    );
    assert.equal(accepted.state.managedSurfaces.length, 105);
    assert.equal(
      accepted.state.managedSurfaces.filter(
        ({ owner }) =>
          owner.kind === "capability" &&
          owner.identifier === "booking-calendly",
      ).length,
      5,
    );
    assert.deepEqual(
      accepted.state.managedSurfaces.find(
        ({ identifier }) => identifier === "builder-home-route",
      )?.owner,
      { kind: "builder-kernel" },
    );

    const preStateInference = acceptedVerifier.preStateInferences[0];
    assert.deepEqual(preStateInference.state, { kind: "missing" });
    assert.deepEqual(
      preStateInference.capabilities.map(({ identifier, category }) => ({
        identifier,
        category,
      })),
      resolved.capabilities
        .map(({ identifier }) => ({
          identifier,
          category: "probable",
        }))
        .sort((left, right) => left.identifier.localeCompare(right.identifier)),
    );

    const postStateInference = await infer(acceptedDestination);
    assert.equal(postStateInference.state.kind, "valid");
    assert.deepEqual(
      postStateInference.capabilities.map(({ identifier, category }) => ({
        identifier,
        category,
      })),
      resolved.capabilities
        .map(({ identifier }) => ({
          identifier,
          category: "confirmed",
        }))
        .sort((left, right) => left.identifier.localeCompare(right.identifier)),
    );
    assert.ok(
      postStateInference.surfaces.every(({ status }) =>
        ["confirmed", "application-owned"].includes(status),
      ),
    );

    for (const [index, invalidRequest] of [
      { ...request(), bookingCalendly: undefined },
      {
        ...request(),
        bookingCalendly: {
          destination: "https://calendar.example/private",
          mode: "popup",
        },
      },
      { ...request(), bookingCalendly, unexpected: true },
    ].entries()) {
      const destination = join(owner, `invalid-${index}`);
      const fake = createFakeVerifier();
      const result = await core.generateProject({
        request: invalidRequest,
        destination,
        verifier: fake.verifier,
      });

      assertFailure(result, "PROJECT_GENERATION_REQUEST_INVALID");
      assert.deepEqual(fake.calls, []);
      assert.equal(await exists(destination), false);
      assert.doesNotMatch(
        JSON.stringify(result.issues),
        /calendar\.example|private|unexpected/u,
      );
    }
  });
});

test("generation preserves every existing destination kind", async () => {
  await withTestRoot(async (owner) => {
    const targets = [
      join(owner, "existing-file"),
      join(owner, "existing-empty-directory"),
      join(owner, "existing-directory"),
      join(owner, "existing-symlink"),
    ];
    await writeFile(targets[0], "keep-file");
    await mkdir(targets[1]);
    await mkdir(targets[2]);
    await writeFile(join(targets[2], "marker"), "keep-directory");
    await symlink(targets[0], targets[3]);

    for (const destination of targets) {
      const fake = createFakeVerifier();
      const before = await lstat(destination);
      const result = await core.generateProject({
        request: request(),
        destination,
        verifier: fake.verifier,
      });
      const after = await lstat(destination);

      assertFailure(result, "DESTINATION_EXISTS");
      assert.deepEqual(fake.calls, []);
      assert.equal(after.dev, before.dev);
      assert.equal(after.ino, before.ino);
    }
    assert.equal(await readFile(targets[0], "utf8"), "keep-file");
    assert.equal(
      await readFile(join(targets[2], "marker"), "utf8"),
      "keep-directory",
    );
  });
});

test("generation rejects missing and non-directory parents", async () => {
  await withTestRoot(async (owner) => {
    const parentFile = join(owner, "parent-file");
    await writeFile(parentFile, "keep");

    for (const destination of [
      join(owner, "missing", "project"),
      join(parentFile, "project"),
    ]) {
      const fake = createFakeVerifier();
      assertFailure(
        await core.generateProject({
          request: request(),
          destination,
          verifier: fake.verifier,
        }),
        "DESTINATION_PARENT_INVALID",
      );
      assert.deepEqual(fake.calls, []);
      assert.equal(await exists(destination), false);
    }
  });
});

test("verifier failures never write state or migration records", async () => {
  await withTestRoot(async (owner) => {
    for (const stage of ["prepare", "verify"]) {
      const destination = join(owner, `failed-${stage}`);
      let stateObserved = false;
      let migrationObserved = false;
      const failure = {
        ok: false,
        issues: [{ code: `${stage.toUpperCase()}_FAILED`, path: [], context: {} }],
      };
      const fake = createFakeVerifier({
        prepare: async (root) => {
          stateObserved = await exists(join(root, ".egeria/state.json"));
          migrationObserved = await exists(
            join(root, ".egeria/migrations.jsonl"),
          );
          return stage === "prepare"
            ? failure
            : (await writeFile(
                join(root, "pnpm-lock.yaml"),
                "lockfileVersion: '9.0'\n",
              ),
              { ok: true, value: undefined });
        },
        verify: async (root) => {
          stateObserved = await exists(join(root, ".egeria/state.json"));
          migrationObserved = await exists(
            join(root, ".egeria/migrations.jsonl"),
          );
          return failure;
        },
      });
      const result = await core.generateProject({
        request: request(),
        destination,
        verifier: fake.verifier,
      });

      assertFailure(result, `${stage.toUpperCase()}_FAILED`);
      assert.equal(stateObserved, false);
      assert.equal(migrationObserved, false);
      assert.equal(await exists(destination), false);
      assert.equal(await exists(fake.roots[0]), false);
    }
  });
});

test("lockfile preparation may add only one regular lockfile without mutations", async () => {
  await withTestRoot(async (owner) => {
    const cases = [
      {
        name: "missing-lockfile",
        prepare: async () => ({ ok: true, value: undefined }),
      },
      {
        name: "changed-manifest",
        prepare: async (root) => {
          await writeFile(join(root, "package.json"), "{}\n");
          await writeFile(
            join(root, "pnpm-lock.yaml"),
            "lockfileVersion: '9.0'\n",
          );
          return { ok: true, value: undefined };
        },
      },
      {
        name: "extra-file",
        prepare: async (root) => {
          await writeFile(join(root, "unexpected"), "unexpected");
          await writeFile(
            join(root, "pnpm-lock.yaml"),
            "lockfileVersion: '9.0'\n",
          );
          return { ok: true, value: undefined };
        },
      },
      {
        name: "symlink-lockfile",
        prepare: async (root) => {
          await symlink("package.json", join(root, "pnpm-lock.yaml"));
          return { ok: true, value: undefined };
        },
      },
    ];

    for (const scenario of cases) {
      const destination = join(owner, scenario.name);
      const fake = createFakeVerifier({ prepare: scenario.prepare });
      const result = await core.generateProject({
        request: request(),
        destination,
        verifier: fake.verifier,
      });

      assertFailure(result, "LOCKFILE_PREPARATION_INVALID");
      assert.equal(await exists(destination), false);
      assert.equal(await exists(fake.roots[0]), false);
      assert.deepEqual(fake.calls, ["prepare-lockfile"]);
    }
  });
});

test("verification receipts must contain the exact ordered checks", async () => {
  await withTestRoot(async (owner) => {
    const cases = [
      { name: "malformed", receipt: undefined },
      { name: "missing-checks", receipt: {} },
      {
        name: "additional-check",
        receipt: { checks: [...generatedChecks, "extra"] },
      },
      { name: "reordered", receipt: { checks: [...generatedChecks].reverse() } },
      {
        name: "sparse",
        receipt: { checks: new Array(generatedChecks.length) },
      },
    ];

    for (const scenario of cases) {
      const destination = join(owner, scenario.name);
      const fake = createFakeVerifier({
        verify: async () => ({ ok: true, value: scenario.receipt }),
      });
      const result = await core.generateProject({
        request: request(),
        destination,
        verifier: fake.verifier,
      });

      assertFailure(result, "GENERATED_VERIFICATION_INVALID");
      assert.deepEqual(result.issues, [
        {
          code: "GENERATED_VERIFICATION_INVALID",
          path: [],
          context: { reason: "checks-mismatch" },
        },
      ]);
      assert.equal(await exists(destination), false);
      assert.equal(await exists(fake.roots[0]), false);
    }
  });
});

test("exclusive state creation rejects verifier-created state and cleans only the source", async () => {
  await withTestRoot(async (owner) => {
    const destination = join(owner, "state-collision");
    const fake = createFakeVerifier({
      verify: async (root) => {
        await writeFile(join(root, ".egeria/state.json"), "independent-state");
        return { ok: true, value: { checks: generatedChecks } };
      },
    });
    const result = await core.generateProject({
      request: request(),
      destination,
      verifier: fake.verifier,
    });

    assertFailure(result, "STATE_WRITE_FAILED");
    assert.equal(await exists(destination), false);
    assert.equal(await exists(fake.roots[0]), false);
  });
});

test("a destination created during verification is preserved", async () => {
  await withTestRoot(async (owner) => {
    const destination = join(owner, "late-destination");
    const fake = createFakeVerifier({
      verify: async () => {
        await mkdir(destination);
        await writeFile(join(destination, "marker"), "independent");
        return { ok: true, value: { checks: generatedChecks } };
      },
    });
    const result = await core.generateProject({
      request: request(),
      destination,
      verifier: fake.verifier,
    });

    assertFailure(result, "DESTINATION_EXISTS");
    assert.equal(
      await readFile(join(destination, "marker"), "utf8"),
      "independent",
    );
    assert.equal(await exists(fake.roots[0]), false);
  });
});

test("a replaced source temporary directory is never recursively removed", async () => {
  await withTestRoot(async (owner) => {
    const destination = join(owner, "replaced-source");
    let movedSource;
    const fake = createFakeVerifier({
      verify: async (root) => {
        movedSource = `${root}-moved`;
        await rename(root, movedSource);
        await mkdir(root);
        await writeFile(join(root, "marker"), "unowned-replacement");
        return { ok: true, value: { checks: generatedChecks } };
      },
    });
    const result = await core.generateProject({
      request: request(),
      destination,
      verifier: fake.verifier,
    });

    assertFailure(result, "TEMPORARY_DIRECTORY_AMBIGUOUS");
    assert.equal(
      await readFile(join(fake.roots[0], "marker"), "utf8"),
      "unowned-replacement",
    );
    assert.equal(await exists(movedSource), true);
    assert.equal(await exists(destination), false);
  });
});

test("the generation core has no shell, Git, provider, or overwrite surface", async () => {
  const source = await readFile(
    resolve(packageRoot, "src/generation/write-generated-project.ts"),
    "utf8",
  );
  assert.doesNotMatch(source, /node:child_process|\bexec(?:File)?\b|\bspawn\b/);
  assert.doesNotMatch(source, /\bgit\b|deploy|preview|provider|wrangler/i);
  assert.doesNotMatch(source, /\bforce\b|overwrite/i);
  assert.match(source, /open\([^)]*,\s*"wx"\)/);
  assert.match(source, /rename\(/);
});
