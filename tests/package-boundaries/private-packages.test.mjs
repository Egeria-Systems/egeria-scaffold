import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, readFile, readdir } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);

async function pathExists(relativePath) {
  try {
    await access(resolve(repositoryRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function readJson(relativePath) {
  return JSON.parse(
    await readFile(resolve(repositoryRoot, relativePath), "utf8"),
  );
}

async function listFiles(directory, baseDirectory = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listFiles(path, baseDirectory)));
    } else {
      files.push(relative(baseDirectory, path));
    }
  }

  return files.sort();
}

async function listWorkspacePackages() {
  const { stdout } = await execFileAsync(
    "pnpm",
    ["list", "--recursive", "--depth", "-1", "--json"],
    { cwd: repositoryRoot, encoding: "utf8" },
  );

  return JSON.parse(stdout).map((workspacePackage) => ({
    name: workspacePackage.name,
    path: relative(repositoryRoot, workspacePackage.path) || ".",
    private: workspacePackage.private,
    version: workspacePackage.version,
  }));
}

test("the workspace materializes the approved private builder boundaries", async () => {
  const workspacePackages = (await listWorkspacePackages()).sort((left, right) =>
    left.path.localeCompare(right.path),
  );

  assert.deepEqual(workspacePackages, [
    {
      name: "@egeria-systems/scaffold",
      path: ".",
      private: true,
      version: "0.0.0",
    },
    {
      name: "@egeria-systems/cli",
      path: "apps/cli",
      private: true,
      version: "0.0.0",
    },
    {
      name: "@egeria-systems/builder-core",
      path: "packages/builder-core",
      private: true,
      version: "0.0.0",
    },
    {
      name: "@egeria-systems/observability",
      path: "packages/observability",
      private: false,
      version: "0.3.0",
    },
    {
      name: "@egeria-systems/standards",
      path: "packages/standards",
      private: false,
      version: "0.2.0",
    },
    {
      name: "@egeria-systems/nextjs-cloudflare-proof",
      path: "proofs/nextjs-cloudflare",
      private: true,
      version: "0.0.0",
    },
  ]);
});

test("the private package manifests expose only their approved runtime boundaries", async () => {
  assert.equal(await pathExists("apps/cli/package.json"), true);
  assert.equal(await pathExists("packages/builder-core/package.json"), true);

  assert.deepEqual(await readJson("apps/cli/package.json"), {
    name: "@egeria-systems/cli",
    version: "0.0.0",
    private: true,
    type: "module",
    bin: {
      egeria: "./dist/index.js",
    },
    scripts: {
      build: "tsc -p tsconfig.json",
      lint:
        "pnpm --dir ../.. exec eslint apps/cli/src apps/cli/tests --max-warnings 0",
      test: "node --test tests/*.test.mjs",
      typecheck: "tsc -p tsconfig.json --noEmit",
    },
    dependencies: {
      "@egeria-systems/builder-core": "workspace:*",
    },
    devDependencies: {
      "@egeria-systems/standards": "workspace:*",
      "@types/node": "22.20.1",
      typescript: "6.0.3",
    },
  });
  assert.deepEqual(await readJson("packages/builder-core/package.json"), {
    name: "@egeria-systems/builder-core",
    version: "0.0.0",
    private: true,
    type: "module",
    exports: {
      ".": {
        types: "./dist/index.d.ts",
        import: "./dist/index.js",
      },
      "./package.json": "./package.json",
    },
    scripts: {
      build: "tsc -p tsconfig.json",
      lint:
        "pnpm --dir ../.. exec eslint packages/builder-core/src --max-warnings 0",
      "schema:check": "node scripts/generate-json-schemas.mjs --check",
      "schema:generate": "node scripts/generate-json-schemas.mjs",
      test: "node --test tests/*.test.mjs",
      "test:generated-project":
        "node --test tests/generate-project.integration.mjs",
      typecheck: "tsc -p tsconfig.json --noEmit",
      verify:
        "pnpm run build && pnpm run schema:check && pnpm run test && pnpm run typecheck && pnpm run lint",
    },
    dependencies: {
      yaml: "2.9.0",
      zod: "4.4.3",
    },
    devDependencies: {
      "@egeria-systems/standards": "workspace:*",
      "@types/node": "22.20.1",
      typescript: "6.0.3",
    },
  });
});

test("the private packages compile through the shared strict contract", async () => {
  const expectedCliConfig = {
    extends: "@egeria-systems/standards/typescript/strict.json",
    compilerOptions: {
      declaration: true,
      outDir: "dist",
      rootDir: "src",
      types: ["node"],
    },
    include: ["src/**/*.ts"],
  };

  assert.equal(
    await pathExists("apps/cli/tsconfig.json"),
    true,
    "the CLI must consume the shared strict TypeScript API",
  );
  assert.equal(
    await pathExists("packages/builder-core/tsconfig.json"),
    true,
    "builder-core must consume the shared strict TypeScript API",
  );
  assert.deepEqual(await readJson("apps/cli/tsconfig.json"), expectedCliConfig);
  assert.deepEqual(
    await readJson("packages/builder-core/tsconfig.json"),
    expectedCliConfig,
  );
});

test("the root copy lint covers integration presentation templates", async () => {
  const rootManifest = await readJson("package.json");
  assert.match(
    rootManifest.scripts["check:copy-externalization"],
    /templates\/\*\*\/src\/integrations\/\*\*\/\*\.tsx/u,
  );

  const rootEslintConfiguration = await import(
    pathToFileURL(resolve(repositoryRoot, "eslint.config.mjs"))
  );
  const copyConfiguration = rootEslintConfiguration.default.find(
    ({ name }) =>
      name === "@egeria-systems/standards/copy-externalization",
  );
  assert.notEqual(copyConfiguration, undefined);
  assert.ok(
    copyConfiguration.files.includes(
      "packages/builder-core/templates/**/src/integrations/**/*.tsx",
    ),
  );
});

test("the CLI is a thin command adapter while builder-core owns generation and lifecycle execution", async () => {
  const expectedEntry = `#!/usr/bin/env node

import { runCli } from "./run-cli.js";

process.exitCode = await runCli(process.argv.slice(2), {
  write: (value) => process.stdout.write(\`\${value}\\n\`),
  writeError: (value) => process.stderr.write(\`\${value}\\n\`),
});
`;

  assert.deepEqual(
    await listFiles(resolve(repositoryRoot, "apps/cli/src")),
    ["arguments.ts", "index.ts", "run-cli.ts"],
  );
  assert.equal(
    await readFile(resolve(repositoryRoot, "apps/cli/src/index.ts"), "utf8"),
    expectedEntry,
  );

  const builderCoreSourceFiles = await listFiles(
    resolve(repositoryRoot, "packages/builder-core/src"),
  );

  assert.deepEqual(
    builderCoreSourceFiles,
    [
      "catalog/capability-catalog.ts",
      "catalog/verified-package-versions.ts",
      "certification/capability-certification.ts",
      "contracts/capability.ts",
      "contracts/certification.ts",
      "contracts/generation-verification.ts",
      "contracts/identifiers.ts",
      "contracts/json-schemas.ts",
      "contracts/migration.ts",
      "contracts/profile.ts",
      "contracts/project.ts",
      "contracts/result.ts",
      "contracts/state.ts",
      "contracts/surface-target.ts",
      "diagnostics/diff-project.ts",
      "diagnostics/doctor.ts",
      "diagnostics/project-inspection.ts",
      "generation/builder-state-surfaces.ts",
      "generation/render-skeleton.ts",
      "generation/render-template.ts",
      "generation/source-tree-safety.ts",
      "generation/template-catalog.ts",
      "generation/verify-generated-project.ts",
      "generation/write-generated-project.ts",
      "index.ts",
      "inference/evaluate-probe.ts",
      "inference/infer-repository.ts",
      "lifecycle/apply-capability-addition.ts",
      "lifecycle/apply-capability-removal.ts",
      "lifecycle/apply-capability-upgrade.ts",
      "lifecycle/capability-addition-writer.ts",
      "lifecycle/capability-removal-file-operation.ts",
      "lifecycle/capability-removal-writer.ts",
      "lifecycle/capability-upgrade-writer.ts",
      "lifecycle/git-worktree-inspection.ts",
      "lifecycle/plan-capability-addition.ts",
      "lifecycle/plan-capability-removal.ts",
      "lifecycle/plan-capability-upgrade.ts",
      "lifecycle/supported-capability-upgrades.ts",
      "manifest/create-installed-manifest.ts",
      "ownership/fingerprint.ts",
      "ownership/materialize-surfaces.ts",
      "profiles/profile-recipes.ts",
      "repository/cache-reader.ts",
      "repository/repository-reader.ts",
      "resolution/resolve-capabilities.ts",
      "serialization/canonical-json.ts",
      "state/codecs.ts",
    ],
  );
  assert.deepEqual(
    await listFiles(resolve(repositoryRoot, "packages/builder-core/templates")),
    [
      "booking-calendly/apps/web/app/page.tsx",
      "booking-calendly/apps/web/content/en-CA/booking-calendly.yaml",
      "booking-calendly/apps/web/src/integrations/booking-calendly/booking-content.ts",
      "booking-calendly/apps/web/src/integrations/booking-calendly/booking-settings.ts.template",
      "booking-calendly/apps/web/src/integrations/booking-calendly/calendly-booking.tsx",
      "booking-calendly/apps/web/tests/e2e/calendly-booking.spec.ts",
      "common/.github/workflows/deploy.yml.template",
      "common/.github/workflows/quality.yml.template",
      "common/.gitignore.template",
      "common/.nvmrc",
      "common/AGENTS.md.template",
      "common/README.md.template",
      "common/apps/web/AGENTS.md.template",
      "common/apps/web/app/api/observability/route.ts",
      "common/apps/web/app/error.tsx",
      "common/apps/web/app/global-error.tsx",
      "common/apps/web/app/globals.css",
      "common/apps/web/app/layout.tsx",
      "common/apps/web/app/page.tsx",
      "common/apps/web/content/content.config.yaml",
      "common/apps/web/content/en-CA/observability.yaml",
      "common/apps/web/eslint.config.mjs",
      "common/apps/web/instrumentation-client.ts",
      "common/apps/web/instrumentation.ts",
      "common/apps/web/next.config.ts",
      "common/apps/web/open-next.config.ts",
      "common/apps/web/package.json.template",
      "common/apps/web/playwright.config.shared.ts",
      "common/apps/web/playwright.deployed.config.ts",
      "common/apps/web/playwright.dev.config.ts",
      "common/apps/web/playwright.preview.config.ts",
      "common/apps/web/playwright.visual.config.ts",
      "common/apps/web/postcss.config.mjs",
      "common/apps/web/src/content/content-schema.ts",
      "common/apps/web/src/content/content-source.d.ts",
      "common/apps/web/src/content/read-content.ts",
      "common/apps/web/src/infrastructure/cloudflare/observability-context.ts",
      "common/apps/web/src/infrastructure/observability/browser-reporter.ts",
      "common/apps/web/src/infrastructure/observability/error-copy.ts",
      "common/apps/web/src/infrastructure/observability/installed-capability.ts",
      "common/apps/web/src/infrastructure/observability/server-reporter.ts",
      "common/apps/web/src/infrastructure/observability/web-vitals-reporter.tsx",
      "common/apps/web/src/presentation/content-page.tsx",
      "common/apps/web/src/presentation/error-fallback.tsx",
      "common/apps/web/src/sections/section-registry.tsx",
      "common/apps/web/tests/component/content-page.test.tsx",
      "common/apps/web/tests/e2e/site-quality.spec.ts",
      "common/apps/web/tests/setup/component.ts",
      "common/apps/web/tests/unit/content-schema.test.ts",
      "common/apps/web/tests/visual/home-visual.spec.ts",
      "common/apps/web/tsconfig.json",
      "common/apps/web/vitest.config.ts",
      "common/apps/web/wrangler.jsonc.template",
      "common/package.json.template",
      "common/pnpm-workspace.yaml",
      "portfolio/apps/web/content/en-CA/long-form/introduction.md.template",
      "portfolio/apps/web/content/en-CA/site.yaml.template",
      "portfolio/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
      "portfolio/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
      "site/apps/web/app/about/page.tsx",
      "site/apps/web/content/en-CA/about.yaml.template",
      "site/apps/web/content/en-CA/long-form/introduction.md.template",
      "site/apps/web/content/en-CA/site.yaml.template",
      "site/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
      "site/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
    ],
  );
});

test("builder-core direct consumers describe the private generation boundary", async () => {
  const cliInstructions = await readFile(
    resolve(repositoryRoot, "apps/cli/AGENTS.md"),
    "utf8",
  );
  const cliReadme = await readFile(
    resolve(repositoryRoot, "apps/cli/README.md"),
    "utf8",
  );
  const builderInstructions = await readFile(
    resolve(repositoryRoot, "packages/builder-core/AGENTS.md"),
    "utf8",
  );
  const builderReadme = await readFile(
    resolve(repositoryRoot, "packages/builder-core/README.md"),
    "utf8",
  );
  const packageOwnership = await readFile(
    resolve(repositoryRoot, "docs/architecture/package-ownership.md"),
    "utf8",
  );
  const rootReadme = await readFile(
    resolve(repositoryRoot, "README.md"),
    "utf8",
  );
  const enforcementMap = await readFile(
    resolve(repositoryRoot, "docs/architecture/enforcement-map.md"),
    "utf8",
  );

  assert.match(builderInstructions, /fixed-root read-only repository access/);
  assert.match(builderInstructions, /does not enumerate or write/);
  assert.match(builderInstructions, /content-safe read-only diagnostics/);
  assert.match(builderInstructions, /neither authorize nor perform a repository change/);
  assert.match(builderInstructions, /deterministic in-memory rendering/);
  assert.match(builderInstructions, /explicit allowlisted[^\n]+templates/);
  assert.match(builderInstructions, /YAML 1.2/);
  assert.match(builderInstructions, /Markdown with validated YAML front matter/);
  assert.match(builderInstructions, /recipe `0.10.0`/);
  assert.match(builderInstructions, /source-owned typed section registry/);
  assert.match(builderInstructions, /Tailwind CSS and PostCSS/);
  assert.match(builderInstructions, /Vitest Node\/jsdom/);
  assert.match(builderInstructions, /Playwright\/axe/);
  assert.match(builderInstructions, /verify:generated-visuals/);
  assert.match(builderInstructions, /state-last generation/);
  assert.match(builderInstructions, /exact verified public package versions/);
  assert.match(builderInstructions, /identity-recorded sibling temporary directory/);
  assert.match(builderInstructions, /portable rename/);
  assert.match(builderInstructions, /disabled Next telemetry/);
  assert.match(builderInstructions, /argument-array `execFile`/);
  assert.match(builderInstructions, /clean attached linked worktree/);
  assert.match(builderInstructions, /all non-ignored untracked files/);
  assert.match(builderInstructions, /`assume-unchanged` and `skip-worktree`/);
  assert.match(builderInstructions, /absent but Git-ignored create targets/);
  assert.match(builderInstructions, /every installed application-owned surface/);
  assert.match(builderInstructions, /canonical managed-surface inventory/);
  assert.match(
    builderInstructions,
    /Git preflight, deterministic addition, removal, exact supported-upgrade planning, and exact `portfolio@0\.10\.0` to `site@0\.10\.0` profile-transition planning, exact-diff inspection/,
  );
  assert.match(builderInstructions, /`applyCapabilityAddition`/);
  assert.match(builderInstructions, /`applyCapabilityRemoval`/);
  assert.match(builderInstructions, /persist state last/);
  assert.match(builderInstructions, /no transform, migration, state update, or provider action/);

  assert.match(builderReadme, /1 MiB/);
  assert.match(builderReadme, /doctorRepository/);
  assert.match(builderReadme, /diffProject/);
  assert.match(builderReadme, /renderSkeleton/);
  assert.match(builderReadme, /deterministic in-memory rendering/);
  assert.match(builderReadme, /explicit allowlisted[^\n]+templates/);
  assert.match(builderReadme, /YAML 1.2/);
  assert.match(builderReadme, /Markdown with validated YAML front matter/);
  assert.match(builderReadme, /recipe `0.10.0`/);
  assert.match(builderReadme, /four source-registered typed section shapes/);
  assert.match(builderReadme, /Tailwind CSS and PostCSS/);
  assert.match(builderReadme, /named generated Vitest unit\/component projects/);
  assert.match(builderReadme, /Playwright\/axe/);
  assert.match(builderReadme, /verify:generated-visuals/);
  assert.match(builderReadme, /generateProject/);
  assert.match(builderReadme, /previously absent destination/);
  assert.match(builderReadme, /installed state last/);
  assert.match(builderReadme, /hostile-concurrency no-clobber guarantee/);
  assert.match(builderReadme, /createPnpmGeneratedProjectVerifier/);
  assert.match(builderReadme, /Child processes receive only a narrow/);
  assert.match(builderReadme, /child output is never returned/i);
  assert.match(builderReadme, /planCapabilityAddition/);
  assert.match(builderReadme, /applyCapabilityAddition/);
  assert.match(builderReadme, /applyCapabilityRemoval/);
  assert.match(builderReadme, /planCapabilityRemoval/);
  assert.match(builderReadme, /planCapabilityUpgrade/);
  assert.match(builderReadme, /preserve-file-and-eject/);
  assert.match(builderReadme, /CAPABILITY_NOT_INSTALLED/);
  assert.match(builderReadme, /verified-final-diff approval/);
  assert.match(builderReadme, /clean attached linked worktree/);
  assert.match(builderReadme, /all non-ignored untracked files/);
  assert.match(builderReadme, /`assume-unchanged` and `skip-worktree`/);
  assert.match(builderReadme, /absent but Git-ignored create target/);
  assert.match(builderReadme, /every installed application-owned surface/);
  assert.match(builderReadme, /canonical managed-surface inventory/);
  assert.match(builderReadme, /redacts settings and repository metadata/);
  assert.match(builderReadme, /never resets, cleans, commits, creates a branch\/worktree, auto-rolls back, or contacts a provider/);
  assert.doesNotMatch(builderReadme, /The CLI remains empty/);

  const builderIndex = await readFile(
    resolve(repositoryRoot, "packages/builder-core/src/index.ts"),
    "utf8",
  );
  const capabilityUpgradeExecutor = await readFile(
    resolve(
      repositoryRoot,
      "packages/builder-core/src/lifecycle/apply-capability-upgrade.ts",
    ),
    "utf8",
  );
  const capabilityUpgradeWriter = await readFile(
    resolve(
      repositoryRoot,
      "packages/builder-core/src/lifecycle/capability-upgrade-writer.ts",
    ),
    "utf8",
  );
  assert.match(builderIndex, /apply-capability-removal\.js/);
  assert.match(builderIndex, /capability-removal-writer\.js/);
  assert.match(builderIndex, /plan-capability-upgrade\.js/);
  assert.match(builderIndex, /apply-capability-upgrade\.js/);
  assert.match(builderIndex, /capability-upgrade-writer\.js/);
  assert.match(
    capabilityUpgradeExecutor,
    /export async function applyCapabilityUpgrade\(/,
  );
  assert.match(
    capabilityUpgradeWriter,
    /export function createFileSystemCapabilityUpgradeWriter\(/,
  );
  assert.match(builderInstructions, /`applyCapabilityUpgrade`/);
  assert.match(
    builderInstructions,
    /`createFileSystemCapabilityUpgradeWriter`[^\n]+upgrade-specific/,
  );
  assert.match(builderReadme, /applyCapabilityUpgrade/);
  assert.match(builderReadme, /createFileSystemCapabilityUpgradeWriter/);
  assert.match(
    builderReadme,
    /lastSuccessfulVerification\.kind[^\n]+`capability-upgrade`/,
  );
  assert.match(
    builderReadme,
    /contracts[^\n]+plan-approval[^\n]+pre-state-inference[^\n]+lockfile[^\n]+frozen-install[^\n]+lint[^\n]+typecheck[^\n]+unit-tests[^\n]+component-tests[^\n]+next-build[^\n]+opennext-build[^\n]+post-change-inference[^\n]+migration-record[^\n]+post-state-inference/,
  );
  assert.match(cliInstructions, /eleven commands exact/);
  assert.match(cliInstructions, /`plan-add` remains read-only/);
  assert.match(cliInstructions, /`apply-add` is limited/);
  assert.match(cliInstructions, /`plan-remove` remains read-only/);
  assert.match(cliInstructions, /`apply-remove` is the exact current removal command/);
  assert.match(cliInstructions, /exact `plan-remove` fingerprint/);
  assert.match(cliInstructions, /`plan-upgrade` remains read-only/);
  assert.match(cliInstructions, /`apply-upgrade` is limited/);
  assert.match(cliInstructions, /`plan-profile-transition` remains read-only/);
  assert.match(
    cliInstructions,
    /`plan-profile-transition`[^\n]+`--directory`[^\n]+`--to-profile site`[^\n]+no[^\n]+`--from-profile`/,
  );
  assert.match(
    cliInstructions,
    /`apply-upgrade`[^\n]+`--directory`[^\n]+`--capability`[^\n]+`--to-version`[^\n]+`--approved-plan`/,
  );
  assert.match(
    cliInstructions,
    /standards@0\.3\.0[^\n]+standards@0\.4\.0[^\n]+single[^\n]+edge/,
  );
  assert.match(cliInstructions, /modified[^\n]+application-owned[^\n]+preserv[^\n]+eject/);
  assert.match(cliInstructions, /remain read-only/);
  assert.match(cliInstructions, /does not add overwrite/);
  assert.match(cliReadme, /eleven exact commands/);
  assert.match(cliReadme, /`apply-add` accepts/);
  assert.match(cliReadme, /`plan-remove` is also read-only/);
  assert.match(cliReadme, /`apply-remove` is the exact current removal command/);
  assert.match(cliReadme, /`plan-upgrade --directory/);
  assert.match(
    cliReadme,
    /`apply-upgrade --directory <absolute-existing-linked-worktree> --capability standards --to-version 0\.4\.0 --approved-plan sha256:<digest>`/,
  );
  assert.match(
    cliReadme,
    /`plan-profile-transition --directory <absolute-existing-linked-worktree> --to-profile site`/,
  );
  assert.match(cliReadme, /recovery[^\n]+`not-required`/);
  assert.match(cliReadme, /migration append[^\n]+state-last persistence/);
  assert.match(cliReadme, /preserve[^\n]+eject/);
  assert.match(cliReadme, /verified-final-diff approval/);
  assert.match(cliReadme, /CAPABILITY_NOT_INSTALLED/);
  assert.match(cliReadme, /clean attached linked worktree/);
  assert.match(cliReadme, /never creates the worktree or branch/);
  assert.match(cliReadme, /`assume-unchanged` and `skip-worktree`/);
  assert.match(cliReadme, /absent but ignored create targets/);
  assert.match(cliReadme, /canonical managed-surface inventory/);
  assert.match(cliReadme, /one content-safe JSON line/);
  assert.match(cliReadme, /no prompt, overwrite mode/);

  assert.match(packageOwnership, /exact accepted Calendly and standards transactions/);
  assert.match(packageOwnership, /canonical private owner/i);
  assert.match(packageOwnership, /deterministic in-memory rendering/);
  assert.match(packageOwnership, /explicit allowlisted templates/);
  assert.match(packageOwnership, /YAML 1.2/);
  assert.match(packageOwnership, /Markdown with validated YAML front matter/);
  assert.match(packageOwnership, /strict `.egeria` codecs/);
  assert.match(packageOwnership, /fixed-root repository inference/);
  assert.match(packageOwnership, /doctorRepository/);
  assert.match(packageOwnership, /diffProject/);
  assert.match(packageOwnership, /state-last new-directory generation/);
  assert.match(packageOwnership, /portable-rename race limit/);
  assert.match(packageOwnership, /pnpm `11.20.0`/);
  assert.match(packageOwnership, /disabled Next telemetry/);
  assert.match(packageOwnership, /Exact `create`, `infer`, `doctor`, `diff`, `plan-add`, `apply-add`, `plan-remove`, `apply-remove`, `plan-upgrade`, `apply-upgrade`, and `plan-profile-transition`/);
  assert.match(packageOwnership, /one-line JSON output/);
  assert.match(packageOwnership, /clean attached linked worktree/);
  assert.match(packageOwnership, /all non-ignored untracked files/);
  assert.match(packageOwnership, /`assume-unchanged` and `skip-worktree`/);
  assert.match(packageOwnership, /absent but Git-ignored create targets/);
  assert.match(packageOwnership, /every installed application-owned surface/);
  assert.match(packageOwnership, /canonical managed-surface inventory/);
  assert.match(packageOwnership, /redact settings and repository metadata/);
  assert.match(packageOwnership, /writes state last/);
  assert.match(packageOwnership, /removal planning[^\n]+read-only/);
  assert.doesNotMatch(packageOwnership, /future CLI consumer/);
  assert.match(packageOwnership, /existing-repository transformation/);
  assert.match(rootReadme, /eleven exact commands/);
  assert.match(rootReadme, /`apply-remove` is the exact current removal command/);
  assert.match(rootReadme, /transaction evidence awaiting verified-final-diff approval/);
  assert.match(rootReadme, /`plan-remove`/);
  assert.match(rootReadme, /egeria plan-upgrade/);
  assert.match(
    rootReadme,
    /egeria apply-upgrade --directory <absolute-existing-linked-worktree> --capability standards --to-version 0\.4\.0 --approved-plan sha256:<digest>/,
  );
  assert.match(
    rootReadme,
    /egeria plan-profile-transition --directory <absolute-existing-linked-worktree> --to-profile site/,
  );
  assert.match(rootReadme, /`assume-unchanged` and `skip-worktree`/);
  assert.match(rootReadme, /canonical managed-surface inventory/);
  assert.match(rootReadme, /No lifecycle command creates the branch\/worktree/);
  assert.match(enforcementMap, /desired, installed, and inferred/);
  assert.match(enforcementMap, /read-only diagnostics/);
  assert.match(enforcementMap, /exact source and template allowlists/);
  assert.match(enforcementMap, /render-skeleton\.test\.mjs/);
  assert.match(enforcementMap, /deterministic in-memory rendering/);
  assert.match(enforcementMap, /YAML 1.2/);
  assert.match(enforcementMap, /new-directory manifest\/pre-state\/post-state agreement/);
  assert.match(enforcementMap, /state-last failure injection/);
  assert.match(enforcementMap, /public installed generated-repository/);
  assert.match(enforcementMap, /execution-time moderate advisory/);
  assert.doesNotMatch(
    packageOwnership,
    /`packages\/builder-core`[^\n]*Empty ESM ownership shell/,
  );
});

test("builder-core keeps schemas private and reserves every later-stage builder surface", async () => {
  for (const requiredDocument of [
    "apps/cli/AGENTS.md",
    "apps/cli/README.md",
    "packages/builder-core/AGENTS.md",
    "packages/builder-core/README.md",
    "docs/architecture/package-ownership.md",
  ]) {
    assert.equal(
      await pathExists(requiredDocument),
      true,
      `${requiredDocument} must define or explain its boundary`,
    );
  }

  for (const forbiddenPath of [
    ".egeria",
    "packages/project-schema",
    "apps/cli/capabilities",
    "apps/cli/generators",
    "apps/cli/migrations",
    "apps/cli/profiles",
    "apps/cli/schemas",
    "apps/cli/state",
    "apps/cli/templates",
    "packages/builder-core/capabilities",
    "packages/builder-core/generators",
    "packages/builder-core/migrations",
    "packages/builder-core/profiles",
    "packages/builder-core/state",
  ]) {
    assert.equal(
      await pathExists(forbiddenPath),
      false,
      `${forbiddenPath} belongs to a later stage`,
    );
  }

  assert.deepEqual(
    await listFiles(resolve(repositoryRoot, "packages/builder-core/schemas")),
    [
      "capability.schema.json",
      "certification-registry.schema.json",
      "migration-record.schema.json",
      "profile.schema.json",
      "project.schema.json",
      "state.schema.json",
    ],
  );
});
