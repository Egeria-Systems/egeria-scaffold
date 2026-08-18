import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  access,
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

import { isPinnedGitHubActionReference } from "../helpers/github-actions.mjs";

const execFileAsync = promisify(execFile);

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const requireFromBuilderCore = createRequire(
  resolve(repositoryRoot, "packages/builder-core/package.json"),
);
const { parse } = requireFromBuilderCore("yaml");
const compactLabel = (...parts) => parts.join("");
const namedLabel = (prefix, ordinal, separator = " ") =>
  [prefix, separator, ordinal].join("");
const credentialBoundPackageCommandPattern =
  /\b(?:pnpm|npm|yarn)\b[^\n]*(?:\bbuild|\btest)(?=[:\s]|$)/iu;

async function runRepositoryQualityScopeClassifier(input) {
  const executionRoot = await mkdtemp(
    join(tmpdir(), "egeria-quality-scope-execution-"),
  );
  const outputPath = join(executionRoot, "github-output");

  try {
    let executablePath = process.env.PATH ?? "";
    if (input.forceDiffFailure) {
      const gitPath = (
        await execFileAsync("which", ["git"], { encoding: "utf8" })
      ).stdout.trim();
      const wrapperRoot = join(executionRoot, "bin");
      const wrapperPath = join(wrapperRoot, "git");
      await mkdir(wrapperRoot, { recursive: true });
      await writeFile(
        wrapperPath,
        `#!/bin/bash\nif [[ "$1" == "diff" ]]; then\n  exit 2\nfi\nexec ${JSON.stringify(gitPath)} "$@"\n`,
        "utf8",
      );
      await chmod(wrapperPath, 0o755);
      executablePath = `${wrapperRoot}:${executablePath}`;
    }

    await execFileAsync("bash", ["-c", input.scopeRun], {
      cwd: input.repositoryRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: executablePath,
        EVENT_NAME: input.eventName,
        PULL_REQUEST_BASE_SHA: input.pullRequestBaseSha,
        PULL_REQUEST_HEAD_SHA: input.pullRequestHeadSha,
        PUSH_BASE_SHA: input.pushBaseSha,
        PUSH_HEAD_SHA: input.pushHeadSha,
        GITHUB_OUTPUT: outputPath,
      },
    });

    const entries = (await readFile(outputPath, "utf8"))
      .trim()
      .split("\n")
      .map((line) => {
        const separatorIndex = line.indexOf("=");
        assert.ok(separatorIndex > 0);
        return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1)];
      });
    assert.deepEqual(
      entries.map(([name]) => name).toSorted(),
      ["compatibility-proof", "generated-projects"],
    );
    return Object.fromEntries(entries);
  } finally {
    await rm(executionRoot, { recursive: true, force: true });
  }
}

function enumerateSecretReferences(value, path = "") {
  if (typeof value === "string") {
    return [...value.matchAll(/\$\{\{([\s\S]*?)\}\}/gu)].flatMap(
      ([, expression]) =>
        [...expression.matchAll(/\bsecrets\b/gu)].map(
          (secretContextMatch) => {
            const referenceSuffix = expression.slice(secretContextMatch.index);
            const approvedReference =
              /^secrets\.([A-Za-z_][A-Za-z0-9_]*)\b/u.exec(referenceSuffix);

            return {
              path,
              reference: approvedReference
                ? `secrets.${approvedReference[1]}`
                : "secrets",
            };
          },
        ),
    );
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => {
      const entryIdentifier =
        entry && typeof entry === "object" && typeof entry.name === "string"
          ? JSON.stringify(entry.name)
          : index;

      return enumerateSecretReferences(
        entry,
        `${path}[${entryIdentifier}]`,
      );
    });
  }

  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, entry]) =>
      enumerateSecretReferences(entry, path ? `${path}.${key}` : key),
    );
  }

  return [];
}

function assertWorkflowSecretBoundary(workflow, expectedReferences) {
  assert.deepEqual(enumerateSecretReferences(workflow), expectedReferences);
}

async function readRepositoryFile(relativePath) {
  return readFile(resolve(repositoryRoot, relativePath), "utf8");
}

async function listRepositoryPaths() {
  const { stdout } = await execFileAsync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { cwd: repositoryRoot, encoding: "utf8" },
  );

  return stdout.split("\0").filter(Boolean);
}

function listRepositoryMarkdownFiles(repositoryPaths) {
  return repositoryPaths
    .filter((path) => path.endsWith(".md"))
    .map((path) => resolve(repositoryRoot, path));
}

function isInsideRepository(path) {
  const relativePath = relative(repositoryRoot, path);

  return (
    relativePath !== ".." &&
    !relativePath.startsWith(`..${sep}`) &&
    !isAbsolute(relativePath)
  );
}

test("the root workspace remains private and pins the compatibility-proof toolchain", async () => {
  const manifest = JSON.parse(await readRepositoryFile("package.json"));
  const nvmVersion = await readRepositoryFile(".nvmrc");
  const proofContent = JSON.parse(
    await readRepositoryFile("proofs/nextjs-cloudflare/content/en-CA.json"),
  );

  assert.equal(manifest.name, "@egeria-systems/scaffold");
  assert.equal(manifest.private, true);
  assert.equal(
    manifest.scripts.test
      .split(" && ")
      .includes(
        "pnpm --filter @egeria-systems/nextjs-cloudflare-proof test:unit",
      ),
    true,
  );
  assert.equal(
    manifest.scripts["test:constitution"],
    "node --test tests/constitution/*.test.mjs",
  );
  assert.equal(
    manifest.scripts["check:semantic-naming"],
    "node scripts/check-semantic-naming.mjs",
  );
  assert.equal(
    manifest.scripts["verify:compatibility-proof"],
    "pnpm --filter @egeria-systems/nextjs-cloudflare-proof verify",
  );
  assert.equal("dependencies" in manifest, false);
  assert.deepEqual(Object.keys(manifest.devDependencies ?? {}).sort(), [
    "@changesets/cli",
    "@egeria-systems/standards",
    "@eslint/js",
    "eslint",
    "npm",
  ]);
  assert.equal(manifest.packageManager, "pnpm@11.20.0");
  assert.deepEqual(manifest.engines, {
    node: "22.23.2",
    pnpm: "11.20.0",
  });
  assert.deepEqual(manifest.volta, { node: "22.23.2" });
  assert.equal(nvmVersion, `${manifest.volta.node}\n`);
  assert.equal(
    proofContent.page.facts.find(({ identifier }) => identifier === "node")
      ?.value,
    manifest.volta.node,
  );
});

test("each authored code context names its test runner, command, and evidence boundary", async () => {
  const contracts = [
    {
      path: "AGENTS.md",
      required: [
        /node --test/u,
        /Vitest/u,
        /Playwright/u,
        /createTestHarness\(\)/u,
        /fast-check/u,
        /Workers Vitest/u,
        /test:capability-certification/u,
      ],
    },
    {
      path: "apps/cli/AGENTS.md",
      required: [/node --test/u, /pnpm run test:cli/u, /subprocess/iu],
    },
    {
      path: "packages/builder-core/AGENTS.md",
      required: [
        /node --test/u,
        /pnpm run test:builder-core/u,
        /test:generated-project/u,
        /test:unit.*test:component/su,
        /fast-check/u,
      ],
    },
    {
      path: "packages/standards/AGENTS.md",
      required: [
        /node --test/u,
        /@egeria-systems\/standards run test/u,
        /public Vitest preset/u,
      ],
    },
    {
      path: "packages/observability/AGENTS.md",
      required: [
        /node --test/u,
        /@egeria-systems\/observability run test/u,
        /redaction/u,
        /failure/iu,
      ],
    },
    {
      path: "proofs/nextjs-cloudflare/AGENTS.md",
      required: [
        /test:unit/u,
        /createTestHarness\(\)/u,
        /test:e2e:dev/u,
        /test:e2e:preview/u,
        /product architecture/u,
      ],
    },
    {
      path: "packages/builder-core/templates/common/AGENTS.md.template",
      required: [
        /pnpm run test:unit/u,
        /pnpm run test:component/u,
        /pnpm --dir apps\/web run test:e2e:dev/u,
        /pnpm --dir apps\/web run test:e2e:preview/u,
      ],
    },
    {
      path: "packages/builder-core/templates/common/apps/web/AGENTS.md.template",
      required: [
        /getByRole/u,
        /userEvent/u,
        /cleanup/u,
        /jsdom/u,
        /broad snapshots/u,
        /WCAG conformance/u,
        /Workers Vitest/u,
      ],
    },
  ];

  for (const contract of contracts) {
    const source = await readFile(resolve(repositoryRoot, contract.path), "utf8");
    for (const requirement of contract.required) {
      assert.match(source, requirement, contract.path);
    }
  }
});

function workflowCommands(job) {
  return job.steps
    .flatMap(({ run }) => (typeof run === "string" ? [run] : []))
    .join("\n");
}

function assertConsolidatedRepositoryQualityWorkflow(source, workflow) {
  const expectedJobIdentifiers = [
    "scope",
    "builder-and-packages",
    "generated-projects",
    "compatibility-proof",
    "dependency-review",
  ];
  const generatedPaths = [
    ".github/workflows/repository-quality.yml",
    ".gitattributes",
    ".npmrc",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "apps/cli/**",
    "packages/builder-core/**",
    "packages/observability/**",
    "packages/standards/**",
    "fixtures/generated/**",
    "scripts/verify-generated-skeletons.mjs",
    "tests/generated-fixtures/**",
  ];
  const compatibilityPaths = [
    ".github/workflows/repository-quality.yml",
    ".npmrc",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "packages/standards/**",
    "proofs/nextjs-cloudflare/**",
  ];

  assert.equal(workflow.name, "Repository quality");
  assert.deepEqual(workflow.on, {
    pull_request: null,
    push: { branches: ["main"] },
  });
  assert.deepEqual(workflow.permissions, { contents: "read" });
  assert.deepEqual(workflow.concurrency, {
    group: "repository-quality-${{ github.ref }}",
    "cancel-in-progress": true,
  });
  assert.deepEqual(Object.keys(workflow.jobs), expectedJobIdentifiers);
  assert.equal(
    Object.hasOwn(workflow.jobs["builder-and-packages"], "if"),
    false,
  );
  assert.equal(
    Object.hasOwn(workflow.jobs["builder-and-packages"], "needs"),
    false,
  );
  assert.doesNotMatch(
    source,
    /\bpaths(?:-ignore)?:|\bsecrets\b|id-token:\s*write|environment:|pull_request_target|workflow_run/iu,
  );

  const scopeJob = workflow.jobs.scope;
  const scopeStep = scopeJob.steps.find(({ id }) => id === "classify");
  const scopeRun = scopeStep?.run ?? "";
  assert.deepEqual(scopeJob.outputs, {
    "generated-projects": "${{ steps.classify.outputs.generated-projects }}",
    "compatibility-proof": "${{ steps.classify.outputs.compatibility-proof }}",
  });
  assert.deepEqual(scopeStep?.env, {
    EVENT_NAME: "${{ github.event_name }}",
    PULL_REQUEST_BASE_SHA: "${{ github.event.pull_request.base.sha }}",
    PULL_REQUEST_HEAD_SHA: "${{ github.event.pull_request.head.sha }}",
    PUSH_BASE_SHA: "${{ github.event.before }}",
    PUSH_HEAD_SHA: "${{ github.sha }}",
  });
  assert.doesNotMatch(scopeRun, /\$\{\{/u);
  assert.match(scopeRun, /\^\[0-9a-f\]\{40\}\$/u);
  assert.match(scopeRun, /0000000000000000000000000000000000000000/u);
  assert.match(scopeRun, /git cat-file -e "\$\{BASE_SHA\}\^\{commit\}"/u);
  assert.match(scopeRun, /git cat-file -e "\$\{HEAD_SHA\}\^\{commit\}"/u);
  assert.match(
    scopeRun,
    /git diff --quiet "\$BASE_SHA" "\$HEAD_SHA" -- "\$\{generated_paths\[@\]\}"/u,
  );
  assert.match(
    scopeRun,
    /git diff --quiet "\$BASE_SHA" "\$HEAD_SHA" -- "\$\{compatibility_paths\[@\]\}"/u,
  );
  assert.match(
    scopeRun,
    /set -euo pipefail\s+generated_projects="true"\s+compatibility_proof="true"/u,
  );
  assert.match(
    scopeRun,
    /case "\$generated_status" in[\s\S]+0\)[\s\S]+generated_projects="false"[\s\S]+1\)[\s\S]+generated_projects="true"[\s\S]+\*\)[\s\S]+scope_error="true"/u,
  );
  assert.match(
    scopeRun,
    /case "\$compatibility_status" in[\s\S]+0\)[\s\S]+compatibility_proof="false"[\s\S]+1\)[\s\S]+compatibility_proof="true"[\s\S]+\*\)[\s\S]+scope_error="true"/u,
  );
  assert.match(
    scopeRun,
    /if \[\[ "\$scope_error" == "true" \]\]; then[\s\S]+generated_projects="true"[\s\S]+compatibility_proof="true"/u,
  );
  assert.match(
    scopeRun,
    /printf 'generated-projects=%s\\n' "\$generated_projects" >> "\$GITHUB_OUTPUT"/u,
  );
  assert.match(
    scopeRun,
    /printf 'compatibility-proof=%s\\n' "\$compatibility_proof" >> "\$GITHUB_OUTPUT"/u,
  );
  for (const [name, expectedPaths] of [
    ["generated_paths", generatedPaths],
    ["compatibility_paths", compatibilityPaths],
  ]) {
    const arrayBody = new RegExp(
      `(?:^|\\n)\\s*${name}=\\(\\n([\\s\\S]*?)\\n\\s*\\)`,
      "u",
    ).exec(scopeRun)?.[1];
    assert.equal(typeof arrayBody, "string", name);
    assert.deepEqual(
      arrayBody
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line.trim())),
      expectedPaths,
      name,
    );
  }

  assert.equal(
    workflow.jobs["generated-projects"].if,
    "needs.scope.outputs.generated-projects == 'true'",
  );
  assert.deepEqual(workflow.jobs["generated-projects"].needs, ["scope"]);
  assert.equal(
    workflow.jobs["compatibility-proof"].if,
    "needs.scope.outputs.compatibility-proof == 'true'",
  );
  assert.deepEqual(workflow.jobs["compatibility-proof"].needs, ["scope"]);
  assert.equal(
    workflow.jobs["dependency-review"].if,
    "github.event_name == 'pull_request'",
  );

  const commandsByJob = Object.fromEntries(
    Object.entries(workflow.jobs).map(([identifier, job]) => [
      identifier,
      workflowCommands(job),
    ]),
  );
  for (const command of [
    "pnpm run test:constitution",
    "pnpm run check:semantic-naming",
    "pnpm run test:package-boundaries",
    "pnpm run test:builder-core",
    "pnpm run test:cli",
    "pnpm run test:packages",
    "pnpm run test:capability-certification",
    "pnpm run check:capability-certification",
  ]) {
    assert.match(
      commandsByJob["builder-and-packages"],
      new RegExp(escapeRegularExpression(command), "u"),
    );
  }
  assert.doesNotMatch(
    commandsByJob["builder-and-packages"],
    /test:generated-fixtures|verify:generated-skeletons|nextjs-cloudflare-proof/u,
  );
  for (const command of [
    "pnpm run test:generated-fixtures",
    "pnpm run verify:generated-skeletons",
  ]) {
    assert.match(
      commandsByJob["generated-projects"],
      new RegExp(escapeRegularExpression(command), "u"),
    );
  }
  for (const command of [
    "pnpm --filter @egeria-systems/nextjs-cloudflare-proof run lint",
    "pnpm --filter @egeria-systems/nextjs-cloudflare-proof run typecheck",
    "pnpm --filter @egeria-systems/nextjs-cloudflare-proof run test:unit",
    "pnpm --filter @egeria-systems/nextjs-cloudflare-proof run build",
    "pnpm --filter @egeria-systems/nextjs-cloudflare-proof exec opennextjs-cloudflare build --skipNextBuild",
    "pnpm --filter @egeria-systems/nextjs-cloudflare-proof run cf-typegen:check",
    "pnpm --filter @egeria-systems/nextjs-cloudflare-proof run test:integration:cloudflare",
    "pnpm --filter @egeria-systems/nextjs-cloudflare-proof exec playwright install --with-deps chromium",
    "pnpm --filter @egeria-systems/nextjs-cloudflare-proof run test:e2e:dev",
    "pnpm --filter @egeria-systems/nextjs-cloudflare-proof run test:e2e:preview",
  ]) {
    assert.match(
      commandsByJob["compatibility-proof"],
      new RegExp(escapeRegularExpression(command), "u"),
    );
  }
  assert.doesNotMatch(
    Object.values(commandsByJob).join("\n"),
    /\bdeploy\b|\bpublish\b|npm publish|wrangler deploy/iu,
  );

  const jobsWithCheckout = [
    "scope",
    "builder-and-packages",
    "generated-projects",
    "compatibility-proof",
  ];
  const jobsWithToolchain = [
    "builder-and-packages",
    "generated-projects",
    "compatibility-proof",
  ];
  for (const [identifier, job] of Object.entries(workflow.jobs)) {
    assert.equal(job["runs-on"], "ubuntu-24.04", identifier);
    assert.equal(typeof job["timeout-minutes"], "number", identifier);
    assert.ok(job["timeout-minutes"] > 0 && job["timeout-minutes"] <= 45);
  }
  for (const identifier of jobsWithCheckout) {
    const checkout = workflow.jobs[identifier].steps.find(({ uses }) =>
      uses?.startsWith("actions/checkout@"),
    );
    assert.equal(
      isPinnedGitHubActionReference(checkout?.uses, "actions/checkout"),
      true,
      identifier,
    );
    assert.equal(checkout?.with?.["persist-credentials"], false, identifier);
  }
  for (const identifier of ["scope", "builder-and-packages"]) {
    const checkout = workflow.jobs[identifier].steps.find(({ uses }) =>
      uses?.startsWith("actions/checkout@"),
    );
    assert.equal(checkout?.with?.["fetch-depth"], 0, identifier);
  }
  for (const identifier of jobsWithToolchain) {
    const setup = workflow.jobs[identifier].steps.find(({ uses }) =>
      uses?.startsWith("pnpm/setup@"),
    );
    assert.equal(
      isPinnedGitHubActionReference(setup?.uses, "pnpm/setup"),
      true,
      identifier,
    );
    assert.deepEqual(setup?.with, {
      version: "11.20.0",
      runtime: "node@22.23.2",
      cache: false,
      install: false,
    });
    assert.ok(
      workflow.jobs[identifier].steps.some(
        ({ run }) => run === "pnpm install --frozen-lockfile",
      ),
      identifier,
    );
  }

  const dependencySteps = workflow.jobs["dependency-review"].steps;
  assert.equal(dependencySteps.length, 1);
  assert.equal(
    isPinnedGitHubActionReference(
      dependencySteps[0]?.uses,
      "actions/dependency-review-action",
    ),
    true,
  );
  assert.deepEqual(dependencySteps[0]?.with, {
    "fail-on-severity": "moderate",
    "fail-on-scopes": "runtime, development",
  });
}

test("Dependabot groups weekly GitHub Actions version updates", async () => {
  const configuration = parse(
    await readRepositoryFile(".github/dependabot.yml"),
  );
  const actionUpdates = configuration.updates.filter(
    (update) => update["package-ecosystem"] === "github-actions",
  );

  assert.equal(actionUpdates.length, 1);
  assert.equal(actionUpdates[0].directory, "/");
  assert.deepEqual(actionUpdates[0].schedule, { interval: "weekly" });
  assert.deepEqual(actionUpdates[0].groups, {
    "action-updates": {
      "applies-to": "version-updates",
      patterns: ["*"],
    },
  });
});

test("ordinary repository CI exposes stable fail-safe quality jobs", async () => {
  for (const path of [
    ".github/workflows/generated-project-quality.yml",
    ".github/workflows/compatibility-proof-quality.yml",
  ]) {
    await assert.rejects(access(resolve(repositoryRoot, path)), undefined, path);
  }

  const source = await readRepositoryFile(
    ".github/workflows/repository-quality.yml",
  );
  const workflow = parse(source);
  assertConsolidatedRepositoryQualityWorkflow(source, workflow);

  const negativeCases = [
    {
      name: "unsafe event interpolation",
      mutateWorkflow(candidate) {
        candidate.jobs.scope.steps.find(({ id }) => id === "classify").run +=
          "\necho ${{ github.event.before }}";
      },
    },
    {
      name: "secret context",
      mutateSource: (candidateSource) => candidateSource.replace(
        "permissions:\n  contents: read",
        "env:\n  TOKEN: ${{ secrets.UNSAFE }}\n\npermissions:\n  contents: read",
      ),
    },
    {
      name: "write token",
      mutateSource: (candidateSource) => candidateSource.replace(
        "permissions:\n  contents: read",
        "permissions:\n  contents: read\n  id-token: write",
      ),
    },
    {
      name: "workflow path filter",
      mutateWorkflow(candidate) {
        candidate.on.pull_request = { paths: ["docs/**"] };
      },
    },
    {
      name: "reusable toolchain cache",
      mutateWorkflow(candidate) {
        candidate.jobs["builder-and-packages"].steps.find(({ uses }) =>
          uses?.startsWith("pnpm/setup@"),
        ).with.cache = true;
      },
    },
    {
      name: "conditioned builder policy lane",
      mutateWorkflow(candidate) {
        candidate.jobs["builder-and-packages"].if =
          "github.actor != 'dependabot[bot]'";
      },
    },
    {
      name: "dependent builder policy lane",
      mutateWorkflow(candidate) {
        candidate.jobs["builder-and-packages"].needs = ["scope"];
      },
    },
    {
      name: "disabled fail-safe default",
      mutateWorkflow(candidate) {
        const scopeStep = candidate.jobs.scope.steps.find(
          ({ id }) => id === "classify",
        );
        scopeStep.run = scopeStep.run.replace(
          'generated_projects="true"',
          'generated_projects="false"',
        );
      },
    },
    {
      name: "write authority",
      mutateWorkflow(candidate) {
        candidate.permissions.contents = "write";
      },
    },
    {
      name: "removed generated verification",
      mutateWorkflow(candidate) {
        candidate.jobs["generated-projects"].steps = candidate.jobs[
          "generated-projects"
        ].steps.filter(
          ({ run }) => run !== "pnpm run verify:generated-skeletons",
        );
      },
    },
  ];
  for (const { name, mutateSource, mutateWorkflow } of negativeCases) {
    const candidate = structuredClone(workflow);
    mutateWorkflow?.(candidate);
    const candidateSource = mutateSource?.(source) ?? source;
    assert.throws(
      () => assertConsolidatedRepositoryQualityWorkflow(candidateSource, candidate),
      { name: "AssertionError" },
      name,
    );
  }

  const builderSteps = workflow.jobs["builder-and-packages"].steps;
  const buildIndex = builderSteps.findIndex(
    ({ run }) => run === "pnpm run build:builder",
  );
  const packageTestIndex = builderSteps.findIndex(
    ({ run }) => run === "pnpm run test:packages",
  );
  assert.ok(buildIndex >= 0 && buildIndex < packageTestIndex);
  assert.equal(
    builderSteps.find(({ name }) => name === "Check release intent")?.run,
    "pnpm run check:package-release pull-request origin/main || pnpm exec changeset status --since origin/main",
  );

  const rootManifest = JSON.parse(await readRepositoryFile("package.json"));
  const kernelCommands = rootManifest.scripts["verify:builder-kernel"].split(" && ");
  assert.ok(
    kernelCommands.indexOf("pnpm run build:builder") <
      kernelCommands.indexOf("pnpm run test:packages"),
  );

  const bookingWorkflow = await readFile(
    resolve(repositoryRoot, ".github/workflows/booking-calendly-certification.yml"),
    "utf8",
  );
  assert.match(bookingWorkflow, /run test:unit[\s\S]+run test:component[\s\S]+Deploy certification Worker/u);
});

test("repository quality scope classification executes fail-safe Git behavior", async (context) => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "egeria-quality-scope-"));
  context.after(async () => {
    await rm(fixtureRoot, { recursive: true, force: true });
  });

  const git = async (...arguments_) =>
    execFileAsync("git", arguments_, {
      cwd: fixtureRoot,
      encoding: "utf8",
    });
  await git("init", "--quiet");
  await git("config", "user.name", "Repository quality contract");
  await git("config", "user.email", "quality-contract@example.invalid");
  await git("config", "commit.gpgsign", "false");

  const commitFile = async (relativePath, content, message) => {
    const absolutePath = resolve(fixtureRoot, relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content, "utf8");
    await git("add", "--", relativePath);
    await git("commit", "--quiet", "-m", message);
    return (await git("rev-parse", "HEAD")).stdout.trim();
  };

  const baseRevision = await commitFile("README.md", "base\n", "base");
  const documentationRevision = await commitFile(
    "docs/note.md",
    "unrelated\n",
    "documentation",
  );
  const generatedRevision = await commitFile(
    "apps/cli/scoped.txt",
    "generated\n",
    "generated",
  );
  const proofRevision = await commitFile(
    "proofs/nextjs-cloudflare/scoped.txt",
    "proof\n",
    "proof",
  );
  const manualWorkflowRevision = await commitFile(
    ".github/workflows/package-release.yml",
    "name: package release\n",
    "manual workflow",
  );
  const repositoryQualityWorkflowRevision = await commitFile(
    ".github/workflows/repository-quality.yml",
    "name: repository quality\n",
    "repository quality workflow",
  );

  const workflowSource = await readRepositoryFile(
    ".github/workflows/repository-quality.yml",
  );
  const workflow = parse(workflowSource);
  const scopeRun = workflow.jobs.scope.steps.find(
    ({ id }) => id === "classify",
  )?.run;
  assert.equal(typeof scopeRun, "string");

  const bothEnabled = {
    "generated-projects": "true",
    "compatibility-proof": "true",
  };
  const scenarios = [
    {
      name: "unchanged revision",
      pushBaseSha: baseRevision,
      pushHeadSha: baseRevision,
      expected: {
        "generated-projects": "false",
        "compatibility-proof": "false",
      },
    },
    {
      name: "unrelated documentation",
      pushBaseSha: baseRevision,
      pushHeadSha: documentationRevision,
      expected: {
        "generated-projects": "false",
        "compatibility-proof": "false",
      },
    },
    {
      name: "generated-only change",
      pushBaseSha: documentationRevision,
      pushHeadSha: generatedRevision,
      expected: {
        "generated-projects": "true",
        "compatibility-proof": "false",
      },
    },
    {
      name: "proof-only change",
      pushBaseSha: generatedRevision,
      pushHeadSha: proofRevision,
      expected: {
        "generated-projects": "false",
        "compatibility-proof": "true",
      },
    },
    {
      name: "manual workflow change",
      pushBaseSha: proofRevision,
      pushHeadSha: manualWorkflowRevision,
      expected: {
        "generated-projects": "false",
        "compatibility-proof": "false",
      },
    },
    {
      name: "repository quality workflow change",
      pushBaseSha: manualWorkflowRevision,
      pushHeadSha: repositoryQualityWorkflowRevision,
      expected: bothEnabled,
    },
    {
      name: "malformed revision",
      pushBaseSha: "not-a-revision",
      pushHeadSha: baseRevision,
      expected: bothEnabled,
    },
    {
      name: "malformed head revision",
      pushBaseSha: baseRevision,
      pushHeadSha: "not-a-revision",
      expected: bothEnabled,
    },
    {
      name: "missing revision",
      pushBaseSha: "",
      pushHeadSha: baseRevision,
      expected: bothEnabled,
    },
    {
      name: "zero revision",
      pushBaseSha: "0".repeat(40),
      pushHeadSha: baseRevision,
      expected: bothEnabled,
    },
    {
      name: "unresolvable revision",
      pushBaseSha: "f".repeat(40),
      pushHeadSha: baseRevision,
      expected: bothEnabled,
    },
    {
      name: "unsupported event",
      eventName: "workflow_dispatch",
      pushBaseSha: baseRevision,
      pushHeadSha: documentationRevision,
      expected: bothEnabled,
    },
    {
      name: "Git diff error",
      pushBaseSha: baseRevision,
      pushHeadSha: documentationRevision,
      forceDiffFailure: true,
      expected: bothEnabled,
    },
  ];

  for (const scenario of scenarios) {
    const actual = await runRepositoryQualityScopeClassifier({
      scopeRun,
      repositoryRoot: fixtureRoot,
      eventName: scenario.eventName ?? "push",
      pullRequestBaseSha: "",
      pullRequestHeadSha: "",
      pushBaseSha: scenario.pushBaseSha,
      pushHeadSha: scenario.pushHeadSha,
      forceDiffFailure: scenario.forceDiffFailure ?? false,
    });
    assert.deepEqual(actual, scenario.expected, scenario.name);
  }

  assert.deepEqual(
    await runRepositoryQualityScopeClassifier({
      scopeRun,
      repositoryRoot: fixtureRoot,
      eventName: "pull_request",
      pullRequestBaseSha: documentationRevision,
      pullRequestHeadSha: generatedRevision,
      pushBaseSha: "not-used",
      pushHeadSha: "not-used",
      forceDiffFailure: false,
    }),
    {
      "generated-projects": "true",
      "compatibility-proof": "false",
    },
    "pull-request revisions",
  );
});

test("the workspace declares the approved proof root and install policy", async () => {
  const workspace = await readRepositoryFile("pnpm-workspace.yaml");

  assert.equal(
    workspace,
    'packages:\n  - "apps/*"\n  - "packages/*"\n  - "proofs/*"\n\npmOnFail: error\n\nminimumReleaseAge: 1440\n\noverrides:\n  "miniflare>undici": 7.29.0\n\nallowBuilds:\n  "@parcel/watcher": true\n  "@swc/core": true\n  esbuild: true\n  unrs-resolver: true\n  workerd: true\n',
  );
});

test("the compatibility proof has a private non-app workspace boundary", async () => {
  const [
    proofManifestSource,
    previewConfiguration,
    proofInstructions,
    nextConfiguration,
  ] = await Promise.all([
      readRepositoryFile("proofs/nextjs-cloudflare/package.json"),
      readRepositoryFile(
        "proofs/nextjs-cloudflare/playwright.preview.config.ts",
      ),
      readRepositoryFile("proofs/nextjs-cloudflare/AGENTS.md"),
      readRepositoryFile("proofs/nextjs-cloudflare/next.config.ts"),
    ]);
  const proofManifest = JSON.parse(proofManifestSource);

  assert.equal(
    proofManifest.name,
    "@egeria-systems/nextjs-cloudflare-proof",
  );
  assert.equal(proofManifest.private, true);
  assert.equal(
    proofManifest.scripts["build:cloudflare"],
    "opennextjs-cloudflare build",
  );
  assert.equal(
    proofManifest.scripts.preview,
    "opennextjs-cloudflare build && opennextjs-cloudflare preview -- --ip 127.0.0.1 --port 3101",
  );
  assert.equal(proofManifest.scripts.deploy, "opennextjs-cloudflare deploy");
  const verificationCommands = proofManifest.scripts.verify.split(" && ");
  const nextBuildIndex = verificationCommands.indexOf("pnpm run build");
  const openNextBuildIndex = verificationCommands.indexOf(
    "pnpm exec opennextjs-cloudflare build --skipNextBuild",
  );
  assert.ok(nextBuildIndex >= 0 && openNextBuildIndex === nextBuildIndex + 1);
  assert.equal(verificationCommands.includes("pnpm run build:cloudflare"), false);
  assert.match(
    previewConfiguration,
    /pnpm exec opennextjs-cloudflare preview -- --ip 127\.0\.0\.1 --port 3101/u,
  );
  assert.doesNotMatch(previewConfiguration, /pnpm run preview/u);
  assert.match(proofInstructions, /already prepared `.open-next` output/iu);
  assert.match(proofInstructions, /--skipNextBuild/u);
  assert.match(nextConfiguration, /output: "standalone"/u);
  assert.match(
    nextConfiguration,
    /outputFileTracingRoot: fileURLToPath\(new URL\("\.\.\/\.\.\/", import\.meta\.url\)\)/u,
  );
  await assert.rejects(readRepositoryFile("apps/web/package.json"));
  await assert.rejects(readRepositoryFile("apps/compatibility/package.json"));
  await assert.rejects(
    readRepositoryFile("packages/project-schema/package.json"),
  );
});

test("the compatibility record preserves its required evidence boundaries", async () => {
  const compatibility = await readRepositoryFile(
    "docs/compatibility/nextjs-cloudflare.md",
  );
  const compatibilityPhase = compactLabel("P", "0", ".", "2");

  for (const heading of [
    "Status and evidence date",
    "Exact matrix",
    "What each check proves",
    "Runtime distinctions",
    "Known limitations",
    "Accessibility evidence and claim boundary",
    "Deployment boundary",
    "Revalidation triggers",
  ]) {
    assert.match(compatibility, new RegExp(`^## ${heading}$`, "m"));
  }

  assert.match(
    compatibility,
    new RegExp(
      `${escapeRegularExpression(compatibilityPhase)} combination is accepted after verified-final-diff approval`,
      "i",
    ),
  );
  assert.match(compatibility, /non-production Cloudflare Worker/i);
  assert.match(compatibility, /Node `22\.23\.2` revalidation is local-only/i);
  assert.match(
    compatibility,
    /deployed evidence remains on Node `22\.23\.0`/i,
  );
  assert.match(compatibility, /do(?:es)? not establish WCAG conformance/i);
});

test("the compatibility package matrix follows executable version owners", async () => {
  const [compatibility, rootSource, proofSource] = await Promise.all([
    readRepositoryFile("docs/compatibility/nextjs-cloudflare.md"),
    readRepositoryFile("package.json"),
    readRepositoryFile("proofs/nextjs-cloudflare/package.json"),
  ]);
  const rootManifest = JSON.parse(rootSource);
  const proofManifest = JSON.parse(proofSource);
  const matrixBody = compatibility
    .split("## Exact matrix\n\n", 2)[1]
    ?.split("\n\n", 1)[0];
  assert.equal(typeof matrixBody, "string");
  const exactMatrix = new Map(
    matrixBody
      .split("\n")
      .slice(2)
      .map((row) => row.split("|").slice(1, -1).map((cell) => cell.trim())),
  );

  assert.equal(
    proofManifest.dependencies.react,
    proofManifest.dependencies["react-dom"],
  );
  const expectedPackageVersions = [
    ["Node.js", rootManifest.engines.node],
    ["pnpm", rootManifest.engines.pnpm],
    ["Next.js", proofManifest.dependencies.next],
    ["React / React DOM", proofManifest.dependencies.react],
    [
      "OpenNext Cloudflare",
      proofManifest.dependencies["@opennextjs/cloudflare"],
    ],
    ["Wrangler", proofManifest.devDependencies.wrangler],
    ["TypeScript", proofManifest.devDependencies.typescript],
    ["ESLint", proofManifest.devDependencies.eslint],
    [
      "Next ESLint config",
      proofManifest.devDependencies["eslint-config-next"],
    ],
    [
      "typescript-eslint",
      proofManifest.devDependencies["typescript-eslint"],
    ],
    ["Vitest", proofManifest.devDependencies.vitest],
    ["Playwright", proofManifest.devDependencies["@playwright/test"]],
    [
      "axe Playwright adapter",
      proofManifest.devDependencies["@axe-core/playwright"],
    ],
  ];

  for (const [surface, version] of expectedPackageVersions) {
    assert.equal(exactMatrix.get(surface), `\`${version}\``, surface);
  }
});

test("canonical documentation points to the non-product compatibility proof", async () => {
  const documents = await Promise.all([
    readRepositoryFile("README.md"),
    readRepositoryFile("AGENTS.md"),
    readRepositoryFile("docs/architecture/overview.md"),
    readRepositoryFile("docs/architecture/enforcement-map.md"),
    readRepositoryFile("docs/roadmaps/program-roadmap.md"),
  ]);

  assert.match(documents[0], /\(docs\/compatibility\/nextjs-cloudflare\.md\)/);
  assert.match(documents[0], /\(proofs\/nextjs-cloudflare\/\)/);
  assert.match(documents[1], /\(proofs\/nextjs-cloudflare\/AGENTS\.md\)/);
  assert.match(documents[2], /\.\.\/compatibility\/nextjs-cloudflare\.md/);
  assert.match(documents[3], /\.\.\/compatibility\/nextjs-cloudflare\.md/);
  assert.match(documents[4], /\.\.\/compatibility\/nextjs-cloudflare\.md/);
});

test("workspace documentation reserves apps for builder code and proofs for evidence", async () => {
  const overview = await readRepositoryFile("docs/architecture/overview.md");

  assert.match(overview, /`apps\/\*` contains builder applications/);
  assert.match(overview, /`proofs\/\*` contains disposable infrastructure evidence/);
  assert.match(overview, /`packages\/\*` contains deliberately owned packages/);
});

test("canonical Cloudflare boundaries permit provider-specific generated templates", async () => {
  const [enforcementMap, packageOwnership] = await Promise.all([
    readRepositoryFile("docs/architecture/enforcement-map.md"),
    readRepositoryFile("docs/architecture/package-ownership.md"),
  ]);

  assert.match(
    enforcementMap,
    /INV-CLOUDFLARE-ISOLATION[^\n]+Calendly integration templates contain no Cloudflare imports or types/i,
  );
  assert.doesNotMatch(
    enforcementMap,
    /provider-neutral Calendly integration source/i,
  );
  assert.match(
    packageOwnership,
    /Builder-core's core infrastructure and consuming-boundary ports remain provider-neutral[^\n]+generated application templates may be provider-specific/i,
  );
  assert.match(
    packageOwnership,
    /`booking-calendly`[^\n]+adds no public package, provider adapter[^\n]+API client/i,
  );
});

test("package ownership documentation records the approved release boundary", async () => {
  const builderFoundationPhase = compactLabel("P", "0", ".", "3");
  const builderKernelPhase = compactLabel("P", "1");
  const [
    rootInstructions,
    readme,
    contributing,
    packageOwnership,
    overview,
    enforcementMap,
    roadmap,
  ] = await Promise.all([
    readRepositoryFile("AGENTS.md"),
    readRepositoryFile("README.md"),
    readRepositoryFile("CONTRIBUTING.md"),
    readRepositoryFile("docs/architecture/package-ownership.md"),
    readRepositoryFile("docs/architecture/overview.md"),
    readRepositoryFile("docs/architecture/enforcement-map.md"),
    readRepositoryFile("docs/roadmaps/program-roadmap.md"),
  ]);

  for (const nestedInstructions of [
    "apps/cli/AGENTS.md",
    "packages/builder-core/AGENTS.md",
    "packages/observability/AGENTS.md",
    "packages/standards/AGENTS.md",
  ]) {
    assert.match(rootInstructions, new RegExp(`\\(${nestedInstructions}\\)`));
  }
  assert.match(
    rootInstructions,
    /\(docs\/architecture\/package-ownership\.md\)/,
  );

  assert.match(overview, /\(package-ownership\.md\)/);
  assert.match(
    overview,
    new RegExp(`${escapeRegularExpression(builderFoundationPhase)} is complete`, "i"),
  );
  assert.match(
    overview,
    new RegExp(
      `${escapeRegularExpression(builderKernelPhase)} is the first executable project/state schema stage`,
      "i",
    ),
  );

  assert.match(
    enforcementMap,
    new RegExp(
      `INV-PACKAGE-EXTRACTION[^\\n]+actual for ${escapeRegularExpression(builderFoundationPhase)}`,
      "i",
    ),
  );
  assert.match(
    enforcementMap,
    /INV-PACKAGE-PUBLICATION[^\n]+actual/i,
  );
  assert.match(
    enforcementMap,
    /@egeria-systems\/standards\/eslint\/cloudflare-isolation/,
  );
  assert.match(
    enforcementMap,
    /proofs\/nextjs-cloudflare\/eslint\.config\.mjs/,
  );
  assert.match(
    enforcementMap,
    /INV-ACCESSIBILITY-AUTOMATION[^\n]+all three current retained fixtures pass local development and workerd Playwright\/axe checks[^\n]+any conformance claim remain separate/i,
  );
  assert.match(
    enforcementMap,
    /deployed execution.*any conformance claim remain separate/i,
  );

  const completedBuilderFoundationSection = roadmap
    .split(`### ${builderFoundationPhase} — Lean builder monorepo`, 2)[1]
    .split(`## ${builderKernelPhase} — Builder kernel`, 1)[0];
  assert.match(
    completedBuilderFoundationSection,
    /\*\*Completed \(2026-08-05\):\*\*/,
  );
  assert.match(completedBuilderFoundationSection, /40604eb\.\.da74a5b/);
  assert.match(
    roadmap,
    new RegExp(
      `${escapeRegularExpression(builderKernelPhase)} is the first executable project/state schema stage`,
      "i",
    ),
  );

  for (const document of [readme, contributing]) {
    assert.match(document, /apps\/cli/);
    assert.match(document, /packages\/builder-core/);
    assert.match(document, /packages\/standards/);
    assert.match(document, /packages\/observability/);
    assert.match(document, /Changeset/i);
    assert.match(document, /publication[^\n]+explicit[^\n]+approval/i);
  }

  assert.match(readme, /pnpm run verify:compatibility-proof/);
  assert.match(readme, /pnpm run verify:builder-packages/);
  assert.match(
    readme,
    /strict.*codecs.*read-only.*inference.*state-last.*generation.*committed golden fixtures/i,
  );
  assert.match(
    readme,
    /builder kernel has received verified-final-diff approval.*client-ready portfolio stage is in progress/iu,
  );
  assert.match(contributing, /pnpm run verify:builder-packages/);

  assert.match(readme, /packages\/standards/);
  assert.match(readme, /packages\/observability/);
  assert.match(readme, /\[Apache-2\.0\]\(LICENSE\)/);
  assert.match(readme, /manual.*package-release\.yml/i);

  assert.match(contributing, /must not publish.*local/i);
  assert.match(contributing, /public API.*approved Changeset/i);

  for (const document of [readme, packageOwnership]) {
    assert.match(document, /@egeria-systems\/standards/iu);
    assert.match(document, /@egeria-systems\/observability/iu);
    assert.match(document, /`0\.1\.0`[\s\S]+`0\.2\.0`/iu);
    assert.match(document, /registry signatures/i);
    assert.match(document, /bootstrap[\s\S]+exception/i);
    assert.match(document, /OIDC trusted publishing/i);
    assert.match(document, /explicit provenance/i);
  }
  assert.match(packageOwnership, /Changesets.*versioning and publication/i);
  assert.match(packageOwnership, /does not create.*release resolver/i);
  assert.match(packageOwnership, /`package-release\.yml`/);
  assert.match(packageOwnership, /`npm-release`/);
  assert.match(packageOwnership, /exact.*commit/i);
  assert.match(packageOwnership, /bootstrap token.*removed/i);
  assert.match(packageOwnership, /OIDC trusted publishing/i);
  assert.match(
    packageOwnership,
    /each public package[\s\S]+exact registry history[\s\S]+unchanged version[\s\S]+present[\s\S]+new target version[\s\S]+absent/i,
  );
  assert.match(
    packageOwnership,
    /local configuration.*green workflow.*authorize publication/i,
  );

  assert.match(
    enforcementMap,
    /INV-PACKAGE-PUBLICATION.*manifest.*API.*tarball.*release-context.*registry.*package-release\.yml/i,
  );

  assert.match(
    readme,
    /lean package and tooling boundaries.*verified-final-diff approval/i,
  );
});

function validateCompatibilityDeploymentCredentialBoundary(workflow) {
  const deployIndex = workflow.indexOf("- name: Deploy compatibility Worker");
  const deployedTestIndex = workflow.indexOf(
    "- name: Test deployed compatibility proof",
  );
  const deployBlock = workflow.slice(deployIndex, deployedTestIndex);
  const problems = [];

  if (
    !deployBlock.includes(
      "pnpm --filter @egeria-systems/nextjs-cloudflare-proof run deploy -- --name test-deploy",
    )
  ) {
    problems.push(
      "credential-bearing step must invoke the deploy-only script for the shared Worker",
    );
  }

  if (/(?:pnpm|opennextjs-cloudflare)[^\n]*\bbuild\b/.test(deployBlock)) {
    problems.push("credential-bearing step must not build under Cloudflare credentials");
  }

  return problems.join("; ");
}

test("the compatibility deployment workflow is manual, bounded, and secret-minimal", async () => {
  const [workflow, proofManifestSource] = await Promise.all([
    readRepositoryFile(".github/workflows/compatibility-proof.yml"),
    readRepositoryFile("proofs/nextjs-cloudflare/package.json"),
  ]);
  const proofManifest = JSON.parse(proofManifestSource);
  const parsedWorkflow = parse(workflow);
  const stepsByName = Object.fromEntries(
    parsedWorkflow.jobs["verify-and-deploy"].steps.map((step) => [
      step.name,
      step,
    ]),
  );
  const job = parsedWorkflow.jobs["verify-and-deploy"];

  assert.match(workflow, /^on:\n  workflow_dispatch:\n/m);
  assert.deepEqual(parsedWorkflow.on, {
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
  assert.doesNotMatch(workflow, /^  (?:push|pull_request|schedule):/m);
  assert.match(workflow, /^permissions:\n  contents: read\n/m);
  assert.match(
    workflow,
    /^  group: test-deploy\n  cancel-in-progress: false\n  queue: max$/m,
  );
  assert.match(workflow, /if: github\.ref == 'refs\/heads\/main'/);
  assert.equal(job["timeout-minutes"], 45);
  assert.match(workflow, /^      name: test-deploy$/m);
  assert.match(workflow, /^      url: \$\{\{ vars\.DEPLOY_URL \}\}$/m);
  assert.equal(
    isPinnedGitHubActionReference(
      stepsByName["Check out repository"].uses,
      "actions/checkout",
    ),
    true,
  );
  assert.deepEqual(stepsByName["Check out repository"].with, {
    "fetch-depth": 0,
    ref: "${{ github.sha }}",
    "persist-credentials": false,
  });
  assert.equal(
    isPinnedGitHubActionReference(
      stepsByName["Set up pnpm and Node.js"].uses,
      "pnpm/setup",
    ),
    true,
  );
  assert.doesNotMatch(workflow, /pnpm\/action-setup|actions\/setup-node/);
  assert.match(workflow, /^          version: 11\.20\.0$/m);
  assert.match(workflow, /^          runtime: node@22\.23\.2$/m);
  assert.match(workflow, /^          cache: false$/m);
  assert.match(workflow, /^          install: false$/m);
  assert.deepEqual(stepsByName["Verify approved revision"].env, {
    EXPECTED_REVISION: "${{ inputs.expected_revision }}",
  });
  assert.equal(
    stepsByName["Verify approved revision"].run,
    "node scripts/verify-approved-revision.mjs",
  );
  assert.match(workflow, /pnpm install --frozen-lockfile/);
  assert.match(workflow, /run: pnpm run verify:compatibility-proof/);
  assert.equal(proofManifest.scripts.deploy, "opennextjs-cloudflare deploy");
  assert.equal(validateCompatibilityDeploymentCredentialBoundary(workflow), "");
  assertWorkflowSecretBoundary(parsedWorkflow, [
    {
      path: 'jobs.verify-and-deploy.steps["Deploy compatibility Worker"].env.CLOUDFLARE_ACCOUNT_ID',
      reference: "secrets.CLOUDFLARE_ACCOUNT_ID",
    },
    {
      path: 'jobs.verify-and-deploy.steps["Deploy compatibility Worker"].env.CLOUDFLARE_API_TOKEN',
      reference: "secrets.CLOUDFLARE_API_TOKEN",
    },
  ]);

  const revisionIndex = job.steps.findIndex(
    ({ name }) => name === "Verify approved revision",
  );
  const installIndex = job.steps.findIndex(
    ({ name }) => name === "Install dependencies",
  );
  const verifyIndex = workflow.indexOf("- name: Verify compatibility proof");
  const deployIndex = workflow.indexOf("- name: Deploy compatibility Worker");
  const deployedTestIndex = workflow.indexOf(
    "- name: Test deployed compatibility proof",
  );

  assert.ok(revisionIndex > -1 && revisionIndex < installIndex);
  assert.ok(verifyIndex > -1 && verifyIndex < deployIndex);
  assert.ok(deployIndex < deployedTestIndex);

  const deployBlock = workflow.slice(deployIndex, deployedTestIndex);
  assert.match(deployBlock, /secrets\.CLOUDFLARE_ACCOUNT_ID/);
  assert.match(deployBlock, /secrets\.CLOUDFLARE_API_TOKEN/);
  assert.doesNotMatch(workflow.slice(0, deployIndex), /secrets\.CLOUDFLARE_/);
  assert.doesNotMatch(
    workflow.slice(deployedTestIndex),
    /secrets\.CLOUDFLARE_/,
  );
  assert.match(
    workflow.slice(deployedTestIndex),
    /COMPATIBILITY_URL: \$\{\{ vars\.DEPLOY_URL \}\}/,
  );
  assert.doesNotMatch(workflow, /production/i);
});

test("the deployment credential contract rejects build work in the secret-bearing block", async () => {
  const workflow = await readRepositoryFile(
    ".github/workflows/compatibility-proof.yml",
  );
  const insecureWorkflow = workflow.replace(
    "pnpm --filter @egeria-systems/nextjs-cloudflare-proof run deploy -- --name test-deploy",
    "pnpm --filter @egeria-systems/nextjs-cloudflare-proof build:cloudflare\n          pnpm --filter @egeria-systems/nextjs-cloudflare-proof run deploy -- --name test-deploy",
  );

  assert.match(
    validateCompatibilityDeploymentCredentialBoundary(insecureWorkflow),
    /must not build under Cloudflare credentials/,
  );
});

test("credential-bearing steps reject package build or test commands at the end of a line", () => {
  for (const command of ["pnpm run build", "pnpm test"]) {
    assert.match(command, credentialBoundPackageCommandPattern);
  }
});

test("stateless manual deployments share one serialized protected deployment boundary", async () => {
  const [
    compatibilitySource,
    calendlySource,
    observabilitySource,
    policy,
    compatibilityRecord,
  ] = await Promise.all([
    readRepositoryFile(".github/workflows/compatibility-proof.yml"),
    readRepositoryFile(".github/workflows/booking-calendly-certification.yml"),
    readRepositoryFile(
      ".github/workflows/observability-error-diagnostics-certification.yml",
    ),
    readRepositoryFile("docs/governance/shared-test-deployment.md"),
    readRepositoryFile("docs/compatibility/nextjs-cloudflare.md"),
  ]);

  for (const source of [
    compatibilitySource,
    calendlySource,
    observabilitySource,
  ]) {
    const workflow = parse(source);
    assert.deepEqual(workflow.concurrency, {
      group: "test-deploy",
      "cancel-in-progress": false,
      queue: "max",
    });
    assert.deepEqual(workflow.jobs["verify-and-deploy"].environment, {
      name: "test-deploy",
      url: "${{ vars.DEPLOY_URL }}",
    });
    assert.doesNotMatch(
      source,
      /vars\.(?:COMPATIBILITY_URL|BOOKING_CALENDLY_CERTIFICATION_URL|OBSERVABILITY_DIAGNOSTICS_CERTIFICATION_URL)/u,
    );
  }

  assert.match(
    compatibilitySource,
    /run deploy -- --name test-deploy/u,
  );
  assert.match(
    calendlySource,
    /opennextjs-cloudflare deploy --name test-deploy/u,
  );
  assert.match(
    observabilitySource,
    /opennextjs-cloudflare deploy --name test-deploy/u,
  );
  assert.match(
    observabilitySource,
    /wrangler secret bulk "\$SECRET_FILE" --name test-deploy/u,
  );

  assert.match(
    policy,
    /stateless[\s\S]+non-production[\s\S]+same Cloudflare account[\s\S]+same protection boundary/iu,
  );
  assert.match(
    policy,
    /not eligible[\s\S]+production[\s\S]+persistent data/iu,
  );
  assert.match(policy, /not eligible[\s\S]+different provider permissions/iu);
  assert.match(
    policy,
    /exclusive lease[\s\S]+preflight[\s\S]+cleanup/iu,
  );
  assert.match(
    policy,
    /ordinary code deployment preserves existing Worker secrets[\s\S]+provider-specific secrets[\s\S]+removed or explicitly retained/iu,
  );
  assert.match(
    policy,
    /clean compatibility baseline[\s\S]+certification-only route[\s\S]+unreachable/iu,
  );

  assert.match(compatibilityRecord, /shared-test-deployment\.md/u);
});

test("Calendly certification deployment is manual, revision-bound, and secret-minimal", async () => {
  const [source, wranglerTemplate, renderingSource] =
    await Promise.all([
      readRepositoryFile(
        ".github/workflows/booking-calendly-certification.yml",
      ),
      readRepositoryFile(
        "packages/builder-core/templates/common/apps/web/wrangler.jsonc.template",
      ),
      readRepositoryFile(
        "packages/builder-core/src/generation/render-skeleton.ts",
      ),
    ]);
  const workflow = parse(source);

  assert.deepEqual(Object.keys(workflow.on), ["workflow_dispatch"]);
  assert.deepEqual(workflow.on.workflow_dispatch.inputs, {
    expected_revision: {
      description: "Exact main revision approved for certification",
      required: true,
      type: "string",
    },
    calendly_url: {
      description: "Synthetic Calendly event URL",
      required: true,
      type: "string",
    },
  });
  assert.deepEqual(workflow.permissions, { contents: "read" });
  assert.deepEqual(workflow.concurrency, {
    group: "test-deploy",
    "cancel-in-progress": false,
    queue: "max",
  });

  const job = workflow.jobs["verify-and-deploy"];
  assert.equal(job.if, "github.ref == 'refs/heads/main'");
  assert.equal(job["runs-on"], "ubuntu-24.04");
  assert.equal(job["timeout-minutes"], 45);
  assert.deepEqual(job.environment, {
    name: "test-deploy",
    url: "${{ vars.DEPLOY_URL }}",
  });
  assert.doesNotMatch(JSON.stringify(job.env ?? {}), /\$\{\{\s*runner\./u);

  const stepsByName = Object.fromEntries(
    job.steps.map((step) => [step.name, step]),
  );
  const certificationRoot =
    "${{ runner.temp }}/booking-calendly-certification/project";
  assert.deepEqual(stepsByName["Create deployment candidate"].env, {
    CALENDLY_URL: "${{ inputs.calendly_url }}",
    CERTIFICATION_ROOT: certificationRoot,
  });
  assert.deepEqual(stepsByName["Build and prepare deployment candidate"].env, {
    CERTIFICATION_ROOT: certificationRoot,
  });
  assert.equal(
    isPinnedGitHubActionReference(
      stepsByName["Check out repository"].uses,
      "actions/checkout",
    ),
    true,
  );
  assert.deepEqual(stepsByName["Check out repository"].with, {
    "fetch-depth": 0,
    ref: "${{ github.sha }}",
    "persist-credentials": false,
  });
  assert.equal(
    isPinnedGitHubActionReference(
      stepsByName["Set up pnpm and Node.js"].uses,
      "pnpm/setup",
    ),
    true,
  );
  assert.deepEqual(stepsByName["Set up pnpm and Node.js"].with, {
    version: "11.20.0",
    runtime: "node@22.23.2",
    cache: false,
    install: false,
  });
  assert.deepEqual(stepsByName["Verify approved revision"].env, {
    EXPECTED_REVISION: "${{ inputs.expected_revision }}",
  });
  assert.equal(
    stepsByName["Verify approved revision"].run,
    "node scripts/verify-approved-revision.mjs",
  );
  assert.equal(
    isPinnedGitHubActionReference(
      stepsByName["Upload local certification receipt"].uses,
      "actions/upload-artifact",
    ),
    true,
  );
  assert.equal(
    stepsByName["Upload local certification receipt"].with["retention-days"],
    7,
  );

  const revisionIndex = job.steps.findIndex(
    ({ name }) => name === "Verify approved revision",
  );
  const deployIndex = job.steps.findIndex(
    ({ name }) => name === "Deploy certification Worker",
  );
  const unitTestIndex = job.steps.findIndex(
    ({ name }) => name === "Test deployment candidate unit behavior",
  );
  const componentTestIndex = job.steps.findIndex(
    ({ name }) => name === "Test deployment candidate component behavior",
  );
  const buildIndex = job.steps.findIndex(
    ({ name }) => name === "Build and prepare deployment candidate",
  );
  const deployedTestIndex = job.steps.findIndex(
    ({ name }) => name === "Test deployed application behavior",
  );
  assert.ok(
    revisionIndex > -1 &&
      revisionIndex < unitTestIndex &&
      unitTestIndex < componentTestIndex &&
      componentTestIndex < buildIndex &&
      buildIndex < deployIndex,
  );
  assert.ok(deployIndex < deployedTestIndex);
  assert.deepEqual(stepsByName["Deploy certification Worker"].env, {
    CLOUDFLARE_ACCOUNT_ID: "${{ secrets.CLOUDFLARE_ACCOUNT_ID }}",
    CLOUDFLARE_API_TOKEN: "${{ secrets.CLOUDFLARE_API_TOKEN }}",
    CERTIFICATION_ROOT: certificationRoot,
  });
  assertWorkflowSecretBoundary(workflow, [
    {
      path: 'jobs.verify-and-deploy.steps["Deploy certification Worker"].env.CLOUDFLARE_ACCOUNT_ID',
      reference: "secrets.CLOUDFLARE_ACCOUNT_ID",
    },
    {
      path: 'jobs.verify-and-deploy.steps["Deploy certification Worker"].env.CLOUDFLARE_API_TOKEN',
      reference: "secrets.CLOUDFLARE_API_TOKEN",
    },
  ]);
  assert.deepEqual(
    stepsByName["Test deployed application behavior"].env,
    {
      CERTIFICATION_ROOT: certificationRoot,
      PLAYWRIGHT_DEPLOYED_URL: "${{ vars.DEPLOY_URL }}",
    },
  );

  const secretSteps = job.steps.filter((step) =>
    JSON.stringify(step).includes("secrets.CLOUDFLARE_"),
  );
  assert.deepEqual(
    secretSteps.map(({ name }) => name),
    ["Deploy certification Worker"],
  );
  assert.doesNotMatch(
    stepsByName["Deploy certification Worker"].run,
    credentialBoundPackageCommandPattern,
  );
  assert.doesNotMatch(
    stepsByName["Deploy certification Worker"].run,
    /calendly/iu,
  );
  assert.match(
    stepsByName["Deploy certification Worker"].run,
    /opennextjs-cloudflare deploy --name test-deploy/u,
  );
  assert.doesNotMatch(source, /^  (?:pull_request|push|schedule):/mu);
  assert.doesNotMatch(source, /wrangler delete|calendly\.com\/api|provider token/iu);

  const projectName =
    stepsByName["Create deployment candidate"].run.match(
      /--name ([a-z][a-z0-9-]+)/u,
    )?.[1];
  assert.equal(projectName, "acme-portfolio-calendly");
  assert.match(wranglerTemplate, /"name": "\{\{workerName\}\}"/u);
  assert.match(
    renderingSource,
    /workerName: projectResult\.value\.project\.name/u,
  );
});

test("repository documentation has no broken local Markdown links", async () => {
  const repositoryPaths = await listRepositoryPaths();
  const markdownFiles = listRepositoryMarkdownFiles(repositoryPaths);
  const brokenLinks = [];

  for (const markdownFile of markdownFiles) {
    const document = await readFile(markdownFile, "utf8");
    const links = document.matchAll(/\[[^\]]+\]\(([^)]+)\)/g);

    for (const [, destination] of links) {
      if (
        destination.startsWith("#") ||
        destination.startsWith("https://") ||
        destination.startsWith("http://") ||
        destination.startsWith("mailto:")
      ) {
        continue;
      }

      const [path] = destination.split("#", 1);
      const target = resolve(dirname(markdownFile), decodeURI(path));

      if (!isInsideRepository(target)) {
        brokenLinks.push(
          `${markdownFile.slice(repositoryRoot.length + 1)} -> ${destination} (outside repository)`,
        );
        continue;
      }

      const relativeTarget = relative(repositoryRoot, target);
      const targetIsTracked = repositoryPaths.some(
        (repositoryPath) =>
          repositoryPath === relativeTarget ||
          repositoryPath.startsWith(`${relativeTarget}/`),
      );
      if (!targetIsTracked) {
        brokenLinks.push(
          `${markdownFile.slice(repositoryRoot.length + 1)} -> ${destination} (not tracked)`,
        );
        continue;
      }

      try {
        await access(target);
      } catch {
        brokenLinks.push(
          `${markdownFile.slice(repositoryRoot.length + 1)} -> ${destination}`,
        );
      }
    }
  }

  assert.deepEqual(brokenLinks, []);
});

const acceptedAdrs = [
  ["0001-materialized-profile-recipes.md", "ADR-0001"],
  ["0002-capability-delivery-and-state.md", "ADR-0002"],
  ["0003-hybrid-ownership.md", "ADR-0003"],
  ["0004-cloudflare-isolation.md", "ADR-0004"],
  ["0005-evidence-driven-package-extraction.md", "ADR-0005"],
  ["0006-egeria-state-files.md", "ADR-0006"],
  ["0007-transactional-repository-migrations.md", "ADR-0007"],
  ["0008-copy-externalization.md", "ADR-0008"],
  ["0009-accessibility-evidence-and-claims.md", "ADR-0009"],
  ["0010-analytics-and-observability.md", "ADR-0010"],
  ["0011-github-actions-deployment-authority.md", "ADR-0011"],
];

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function validateAcceptedAdr({ document, fileName, identifier, index }) {
  const problems = [];

  if (!document.startsWith(`# ${identifier}: `)) {
    problems.push("document identifier does not match its file contract");
  }

  const statusLines = [...document.matchAll(/^\*\*Status:\*\* (.+)$/gm)];
  const dateLines = [...document.matchAll(/^\*\*Date:\*\* (.+)$/gm)];

  if (statusLines.length !== 1 || statusLines[0][1] !== "Accepted") {
    problems.push("document must declare Accepted exactly once");
  }

  if (dateLines.length !== 1 || dateLines[0][1] !== "2026-08-04") {
    problems.push("document must declare the accepted date exactly once");
  }

  const headings = ["Context", "Decision", "Consequences", "Enforcement"];
  const headingPositions = [];

  for (const heading of headings) {
    const marker = `\n## ${heading}\n`;
    const position = document.indexOf(marker);

    if (position === -1 || position !== document.lastIndexOf(marker)) {
      problems.push(`${heading} must appear exactly once`);
      continue;
    }

    headingPositions.push(position);

    const bodyStart = position + marker.length;
    const nextHeading = document.indexOf("\n## ", bodyStart);
    const body = document.slice(
      bodyStart,
      nextHeading === -1 ? document.length : nextHeading,
    );

    if (body.trim().length === 0) {
      problems.push(`${heading} must not be empty`);
    }
  }

  if (
    headingPositions.length === headings.length &&
    headingPositions.some(
      (position, index) => index > 0 && position < headingPositions[index - 1],
    )
  ) {
    problems.push("decision sections are out of order");
  }

  const escapedIdentifier = escapeRegularExpression(identifier);
  const escapedFileName = escapeRegularExpression(fileName);
  const identifierLinks = index.match(
    new RegExp(`\\[${escapedIdentifier}\\]\\(`, "g"),
  );
  const acceptedRow = new RegExp(
    `^\\| \\[${escapedIdentifier}\\]\\(${escapedFileName}\\) \\| [^|\\n]+ \\| Accepted \\| 2026-08-04 \\|$`,
    "m",
  );

  if ((identifierLinks?.length ?? 0) !== 1 || !acceptedRow.test(index)) {
    problems.push("index must contain one matching Accepted row");
  }

  return problems;
}

test("the ADR validator rejects non-authoritative decision records", () => {
  const problems = validateAcceptedAdr({
    document: `# ADR-9999: Invalid example

**Status:** Accepted

**Date:** 2026-08-04

## Decision

Decision appears before an empty context.

## Context

## Consequences

Consequences exist.

## Enforcement

Enforcement exists.
`,
    fileName: "9999-invalid-example.md",
    identifier: "ADR-9999",
    index: "| [ADR-9999](9999-invalid-example.md) | Invalid | Proposed | 2026-08-04 |",
  });

  assert.ok(problems.length >= 3);
});

const capabilityIdentifiers = [
  "standards",
  "content-files",
  "section-composition",
  "deployment-cloudflare",
  "observability",
  "booking-calendly",
  "site-routing",
  "app-foundation",
  "application-persistence",
  "transactional-email-resend",
  "background-job-delivery",
  "durable-contact-submissions",
  "multilingual",
  "analytics",
  "cms-payload",
  "identity-core",
  "identity-google",
  "protected-area",
  "account-profile",
  "support-console",
  "identity-2fa",
  "identity-passkeys",
  "payments-stripe",
  "booking-webhooks",
];

test("the documented capability catalog uses the normalized contract", async () => {
  const document = await readRepositoryFile(
    "docs/architecture/capability-model.md",
  );
  const descriptorMatch = document.match(
    /interface CapabilityDescriptor \{([\s\S]*?)\n\}/,
  );
  assert.ok(descriptorMatch, "capability descriptor contract is missing");
  assert.match(descriptorMatch[1], /^  version: string;$/m);
  assert.doesNotMatch(descriptorMatch[1], /^  schemaVersion: string;$/m);

  const catalog = document
    .split("## Initial catalog\n", 2)[1]
    .split("## Independent and conditional behavior", 1)[0];
  const capabilityRows = catalog
    .split("\n")
    .filter((line) => line.startsWith("| `"))
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );

  assert.deepEqual(
    capabilityRows.map(([identifier]) => identifier.slice(1, -1)),
    capabilityIdentifiers,
  );

  const observabilityRow = capabilityRows.find(
    ([identifier]) => identifier === "`observability`",
  );
  assert.notEqual(observabilityRow, undefined);
  assert.equal(
    observabilityRow[5],
    "`content-files`, `deployment-cloudflare`, `section-composition`",
  );

  const allowedProfiles = new Set([
    "portfolio",
    "site",
    "app",
    "authenticated-app",
  ]);
  const allowedDeliveryModes = new Set([
    "package-backed",
    "source-generated",
    "hybrid",
  ]);
  const allowedStateClassifications = new Set([
    "stateless",
    "repository-stateful",
    "external-stateful",
    "persistent-data",
  ]);
  const allowedRemovalPolicies = new Set([
    "automatic",
    "reviewed",
    "export-and-remove",
    "eject-only",
    "unsupported",
  ]);

  for (const row of capabilityRows) {
    assert.equal(row.length, 6, `${row[0]} has an incomplete catalog row`);

    const [
      identifier,
      deliveryMode,
      stateClassifications,
      removalPolicy,
      profileInclusion,
      dependencies,
    ] = row;
    const states = [...stateClassifications.matchAll(/`([^`]+)`/g)].map(
      ([, state]) => state,
    );

    assert.ok(
      allowedDeliveryModes.has(deliveryMode.slice(1, -1)),
      `${identifier} has an invalid delivery mode: ${deliveryMode}`,
    );
    assert.ok(states.length > 0, `${identifier} has no state classification`);
    assert.equal(
      new Set(states).size,
      states.length,
      `${identifier} repeats a state classification`,
    );
    assert.ok(
      states.every((state) => allowedStateClassifications.has(state)),
      `${identifier} has an invalid state classification`,
    );
    assert.ok(
      !states.includes("stateless") || states.length === 1,
      `${identifier} combines stateless with another classification`,
    );
    assert.ok(
      allowedRemovalPolicies.has(removalPolicy.slice(1, -1)),
      `${identifier} has an invalid removal policy: ${removalPolicy}`,
    );
    assert.ok(dependencies.length > 0, `${identifier} has no dependency entry`);

    const inclusions = profileInclusion.split("; ");
    const includedProfiles = [];

    assert.ok(inclusions.length > 0, `${identifier} has no profile inclusion`);

    for (const inclusion of inclusions) {
      const match = /^(default|optional|dependency-only): (.+)$/.exec(inclusion);

      assert.ok(
        match,
        `${identifier} has invalid profile inclusion: ${inclusion}`,
      );

      for (const profile of match[2].split(", ")) {
        assert.ok(
          allowedProfiles.has(profile),
          `${identifier} names an unknown profile: ${profile}`,
        );
        includedProfiles.push(profile);
      }
    }

    assert.equal(
      new Set(includedProfiles).size,
      includedProfiles.length,
      `${identifier} repeats a profile inclusion`,
    );
  }
});

test("capability delivery requires a separately planned certification task", async () => {
  const [
    sourcePlan,
    programRoadmap,
    reviewProtocol,
    enforcementMap,
    architectureOverview,
  ] =
    await Promise.all([
      readRepositoryFile(
        "docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md",
      ),
      readRepositoryFile("docs/roadmaps/program-roadmap.md"),
      readRepositoryFile("docs/governance/review-and-contribution.md"),
      readRepositoryFile("docs/architecture/enforcement-map.md"),
      readRepositoryFile("docs/architecture/overview.md"),
    ]);
  const clientReadyPhase = compactLabel("P", "2");
  const lifecyclePhase = compactLabel("P", "3");
  const appFoundationPhase = compactLabel("P", "4");
  const initialCertificationTask = namedLabel("Task", "5B");
  const historicalCertificationTask = namedLabel("Task", "6B");
  const preparationGate = namedLabel("Gate", "1");

  assert.match(
    sourcePlan,
    /^### Capability implementation and certification task pair$/m,
  );
  const sourceTaskPair = sourcePlan
    .split("### Capability implementation and certification task pair\n", 2)[1]
    .split("Certification is introduced in stages:", 1)[0];
  assert.ok(sourceTaskPair, "source-plan task-pair contract is missing");
  assert.match(
    sourceTaskPair,
    /every new or materially changed executable capability[\s\S]+separate capability-certification task/i,
  );
  assert.match(
    sourceTaskPair,
    /implementation approval does not imply certification[\s\S]+cannot close[\s\S]+advertised as certified/i,
  );
  assert.match(
    sourceTaskPair,
    /repository-owned certification coverage registry[\s\S]+executable capability identifier[\s\S]+planned/i,
  );
  assert.match(
    sourceTaskPair,
    /descriptor-admission gate[\s\S]+pending certification record[\s\S]+linked to[\s\S]+separate certification task/i,
  );
  assert.match(
    sourceTaskPair,
    /certification subject[\s\S]+descriptor version[\s\S]+behavior-contract digest/i,
  );
  assert.match(
    sourceTaskPair,
    /material change[\s\S]+replaces[\s\S]+certified record[\s\S]+new task-linked pending record/i,
  );
  assert.match(
    sourceTaskPair,
    /phase and release closure gate[\s\S]+rejects[\s\S]+not certified/i,
  );
  assert.match(
    sourceTaskPair,
    new RegExp(
      `backfill-pending[^.]+${escapeRegularExpression(lifecyclePhase)}`,
      "i",
    ),
  );
  assert.match(
    sourceTaskPair,
    new RegExp(
      `backfill-pending[\\s\\S]+exempt from ${escapeRegularExpression(clientReadyPhase)} closure[\\s\\S]+${escapeRegularExpression(lifecyclePhase)} closure[\\s\\S]+rejects`,
      "i",
    ),
  );

  const clientReadySection = programRoadmap
    .split(`## ${clientReadyPhase} — Client-ready portfolio\n`, 2)[1]
    .split(`## ${lifecyclePhase} — Transactional lifecycle`, 1)[0];
  assert.ok(clientReadySection, "client-ready roadmap section is missing");
  assert.match(
    clientReadySection,
    new RegExp(
      `${escapeRegularExpression(initialCertificationTask)}[^#]+booking-calendly`,
      "i",
    ),
  );
  assert.match(
    clientReadySection,
    new RegExp(
      `${escapeRegularExpression(historicalCertificationTask)}[^#]+observability@0\\.2\\.0`,
      "i",
    ),
  );
  assert.match(
    clientReadySection,
    /observability@0\.2\.0[^#]+certified[^#]+cleanup-recovery[^#]+not claimed[^#]+retained-resource disposition/iu,
  );
  assert.match(
    clientReadySection,
    /393225988aaed173e21dc547e69ff5b03305cf93[^#]+integrated[^#]+d543de78d8e1c238a499aeba5e315f4db724dd1b/iu,
  );
  assert.match(
    clientReadySection,
    /observability@0\.3\.0[^#]+certified[^#]+fresh-scaffold[^#]+deployed-application[^#]+cleanup-recovery[^#]+bdcc55f1bfa6eca392ce3e36bdc35adb6f085bad[^#]+31925083913[^#]+31925927776/iu,
  );
  assert.match(
    architectureOverview,
    /observability@0\.3\.0[^.]+certified[^.]+fresh-scaffold[^.]+deployed-application[^.]+cleanup-recovery[^.]+bdcc55f1bfa6eca392ce3e36bdc35adb6f085bad/iu,
  );
  const lifecycleSection = programRoadmap
    .split(`## ${lifecyclePhase} — Transactional lifecycle\n`, 2)[1]
    .split("## Capability delivery task pair", 1)[0];
  assert.ok(lifecycleSection, "lifecycle roadmap section is missing");
  assert.match(
    lifecycleSection,
    /coverage backfill[^#]+existing executable capabilities/i,
  );
  assert.match(
    lifecycleSection,
    /unchanged valid evidence[\s\S]+without repeating expensive checks/i,
  );
  assert.match(
    lifecycleSection,
    /closure rejects[\s\S]+backfill-pending/i,
  );
  const programTaskPair = programRoadmap
    .split("## Capability delivery task pair\n", 2)[1]
    .split(`## ${appFoundationPhase} — App foundation`, 1)[0];
  assert.ok(programTaskPair, "program task-pair contract is missing");
  assert.match(
    programTaskPair,
    /every new or materially changed executable capability[\s\S]+implementation task[\s\S]+certification task/i,
  );
  assert.match(
    programTaskPair,
    /local runtime evidence remains separate from protected-staging and provider outcomes[\s\S]+external action requires separate authorization/i,
  );
  assert.match(
    programTaskPair,
    /descriptor version or behavior-contract digest[\s\S]+material change[\s\S]+new task-linked pending record/i,
  );

  assert.match(reviewProtocol, /^## Capability-certification planning$/m);
  const planningSection = reviewProtocol
    .split("## Capability-certification planning\n", 2)[1]
    .split("## Builder-repository development boundary", 1)[0];
  assert.ok(planningSection, "certification-planning protocol is missing");
  assert.match(
    planningSection,
    new RegExp(
      `${escapeRegularExpression(preparationGate)}[^\n]+step-by-step human-prerequisite runbook`,
      "i",
    ),
  );
  assert.match(
    planningSection,
    /account owner[\s\S]+account type[\s\S]+subscription tier[\s\S]+sandbox or test environment/i,
  );
  assert.match(
    planningSection,
    /resource[\s\S]+least-privilege permissions or roles/i,
  );
  assert.match(
    planningSection,
    /credential names[\s\S]+scopes[\s\S]+lifetime[\s\S]+rotation[\s\S]+storage location[\s\S]+without recording values/i,
  );
  assert.match(
    planningSection,
    /callback[\s\S]+webhook[\s\S]+redirect[\s\S]+domain[\s\S]+allowlist/i,
  );
  assert.match(
    planningSection,
    /synthetic identities and data[\s\S]+readiness preflight[\s\S]+bounded polling[\s\S]+rate limits[\s\S]+quotas[\s\S]+possible spend[\s\S]+retention/i,
  );
  assert.match(
    planningSection,
    /step-by-step cleanup[\s\S]+resource deletion[\s\S]+credential revocation or rotation[\s\S]+rollback[\s\S]+recovery/i,
  );
  assert.match(
    planningSection,
    /owner of every action[\s\S]+automation boundary[\s\S]+explicit approval checkpoint/i,
  );
  assert.match(
    planningSection,
    /local controlled-dependency tests[\s\S]+protected-staging or provider journey/i,
  );
  assert.match(
    planningSection,
    /no human setup is required[\s\S]+external action remains separately authorized/i,
  );

  assert.match(
    enforcementMap,
    /INV-CAPABILITY-CERTIFICATION[^\n]+actual[^\n]+certification coverage registry/i,
  );
  assert.match(
    enforcementMap,
    /documentation contract[^\n]+does not prove[^\n]+runtime or provider result/i,
  );
  assert.match(
    enforcementMap,
    /booking-calendly@0\.1\.0[^\n]+certified[^\n]+standards@0\.3\.0[^\n]+certified[^\n]+observability@0\.3\.0[^\n]+certified[^\n]+four unchanged subjects[^\n]+backfill-pending/i,
  );
  assert.match(
    enforcementMap,
    /descriptor version or behavior-contract digest[^\n]+material change[^\n]+new task-linked pending record/i,
  );
  assert.match(
    enforcementMap,
    /descriptor admission[^\n]+legacy-backfill-exempt[^\n]+closure pass[^\n]+all-certified[^\n]+rejects only the four frozen backfills/i,
  );
});

test("client-required public-site work is relocated after lifecycle without requirement loss", async () => {
  const [sourcePlan, programRoadmap, overview, capabilityModel, enforcementMap, analyticsAdr] =
    await Promise.all([
      readRepositoryFile(
        "docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md",
      ),
      readRepositoryFile("docs/roadmaps/program-roadmap.md"),
      readRepositoryFile("docs/architecture/overview.md"),
      readRepositoryFile("docs/architecture/capability-model.md"),
      readRepositoryFile("docs/architecture/enforcement-map.md"),
      readRepositoryFile("docs/adr/0010-analytics-and-observability.md"),
    ]);
  const lifecyclePhase = compactLabel("P", "3");
  const clientExpansionPhase = compactLabel("P", "3", "B");
  const appFoundationPhase = compactLabel("P", "4");
  const portfolioBaselinePhase = compactLabel("P", "2");
  const multilingualSlot = compactLabel("P", "5", "A");
  const analyticsSlot = compactLabel("P", "5", "B");

  const roadmapPortfolio = programRoadmap
    .split(`## ${portfolioBaselinePhase} — Client-ready portfolio\n`, 2)[1]
    .split(`## ${lifecyclePhase} — Transactional lifecycle`, 1)[0];
  const sourceExpansion = sourcePlan
    .split(
      `#### ${clientExpansionPhase} — Client-required public-site expansion\n`,
      2,
    )[1]
    .split(`#### ${appFoundationPhase} — App foundation`, 1)[0];
  const roadmapExpansion = programRoadmap
    .split(`## ${clientExpansionPhase} — Client-required public-site expansion\n`, 2)[1]
    .split(`## ${appFoundationPhase} — App foundation`, 1)[0];

  assert.ok(roadmapPortfolio, "portfolio baseline roadmap section is missing");
  assert.doesNotMatch(roadmapPortfolio, /urgent first-client milestone/iu);
  assert.match(
    roadmapExpansion,
    /first client-ready milestone[\s\S]+real client/iu,
  );

  for (const section of [sourceExpansion, roadmapExpansion]) {
    assert.ok(section, "client-required public-site expansion is missing");
    assert.match(section, /production-complete `site` profile/iu);
    assert.match(section, /`multilingual`[\s\S]+independently selectable/iu);
    assert.match(
      section,
      /`analytics`[\s\S]+independently selectable[\s\S]+provider-neutral consent/iu,
    );
    assert.match(
      section,
      /capability implementation task[\s\S]+separate capability-certification task/iu,
    );
    assert.match(
      section,
      /real client project[\s\S]+generated[\s\S]+retained as migration evidence/iu,
    );
    assert.match(section, /no composite[\s\S]+profile[\s\S]+capability/iu);
    assert.match(section, /relocation ledger/iu);
    assert.match(
      section,
      new RegExp(
        `${escapeRegularExpression(multilingualSlot)}[\\s\\S]+${escapeRegularExpression(analyticsSlot)}[\\s\\S]+not deleted[\\s\\S]+not renumbered`,
        "iu",
      ),
    );
  }

  assert.match(
    sourcePlan,
    new RegExp(
      `${escapeRegularExpression(lifecyclePhase)}[\\s\\S]+${escapeRegularExpression(clientExpansionPhase)}[\\s\\S]+FIRST CLIENT-READY MILESTONE[\\s\\S]+${escapeRegularExpression(appFoundationPhase)}`,
      "u",
    ),
  );
  assert.match(
    overview,
    /transactional lifecycle[\s\S]+client-required public-site expansion[\s\S]+app-foundation/iu,
  );
  assert.match(
    capabilityModel,
    /multilingual[\s\S]+analytics[\s\S]+optional[\s\S]+initial scaffolding[\s\S]+addable later[\s\S]+no composite/iu,
  );
  assert.match(
    enforcementMap,
    new RegExp(
      `INV-ANALYTICS-SEPARATION[^\\n]+${escapeRegularExpression(clientExpansionPhase)}`,
      "iu",
    ),
  );
  assert.match(
    analyticsAdr,
    new RegExp(
      `INV-ANALYTICS-SEPARATION[^.]+${escapeRegularExpression(clientExpansionPhase)}`,
      "iu",
    ),
  );
});

test("executable capability certification ownership is current", async () => {
  const [
    rootReadme,
    overview,
    capabilityModel,
    enforcementMap,
    reviewProtocol,
    roadmap,
    builderCoreInstructions,
    builderCoreReadme,
    packageOwnership,
    registrySource,
  ] = await Promise.all([
    readRepositoryFile("README.md"),
    readRepositoryFile("docs/architecture/overview.md"),
    readRepositoryFile("docs/architecture/capability-model.md"),
    readRepositoryFile("docs/architecture/enforcement-map.md"),
    readRepositoryFile("docs/governance/review-and-contribution.md"),
    readRepositoryFile("docs/roadmaps/program-roadmap.md"),
    readRepositoryFile("packages/builder-core/AGENTS.md"),
    readRepositoryFile("packages/builder-core/README.md"),
    readRepositoryFile("docs/architecture/package-ownership.md"),
    readRepositoryFile("certifications/capabilities.json"),
  ]);

  for (const document of [overview, capabilityModel, enforcementMap, roadmap]) {
    assert.match(document, /certifications\/capabilities\.json/u);
    assert.match(document, /booking-calendly[\s\S]+certified/iu);
  }
  for (const document of [capabilityModel, enforcementMap]) {
    assert.match(
      document,
      /booking-calendly[\s\S]+certified[\s\S]+provider-confirmed[\s\S]+cleanup/iu,
    );
  }
  const registry = JSON.parse(registrySource);
  const bookingRecord = registry.records["booking-calendly"];
  const observabilityRecord = registry.records.observability;
  const standardsRecord = registry.records.standards;
  assert.equal(bookingRecord.status, "certified");
  assert.equal(observabilityRecord.status, "certified");
  assert.equal(standardsRecord.status, "certified");
  assert.deepEqual(observabilityRecord.requiredEvidence, [
    "cleanup-recovery",
    "deployed-application",
    "fresh-scaffold",
  ]);
  assert.deepEqual(
    observabilityRecord.evidence.map(({ kind, path, outcome, revision }) => ({
      kind,
      path,
      outcome,
      revision,
    })),
    ["cleanup-recovery", "deployed-application", "fresh-scaffold"].map(
      (kind) => ({
        kind,
        path: "docs/implementation-evidence/2026-08-16-observability-error-diagnostics-certification-receipt.md",
        outcome: "passed",
        revision: "bdcc55f1bfa6eca392ce3e36bdc35adb6f085bad",
      }),
    ),
  );
  assert.match(
    rootReadme,
    /recipe `0\.8\.0`[^\n]+observability@0\.3\.0/iu,
  );
  assert.match(
    capabilityModel,
    /all three Next\.js request-error inputs[^\n]+browser error\/rejection instrumentation[^\n]+five declared application-owned error surfaces[^\n]+app\/error\.tsx[^\n]+app\/global-error\.tsx[^\n]+externalized observability copy[^\n]+typed copy reader[^\n]+pure fallback presentation/iu,
  );
  assert.match(
    capabilityModel,
    /same-origin[^\n]+safe-event and restricted error-report envelopes[^\n]+8,192 bytes/iu,
  );
  assert.match(
    capabilityModel,
    /Workers custom records receive only the bounded safe operational event[^\n]+only the Better Stack diagnostic adapter receives the restricted message/iu,
  );
  for (const document of [overview, capabilityModel, enforcementMap, roadmap]) {
    assert.match(
      document,
      /observability@0\.3\.0[^\n]+certified[^\n]+bdcc55f1bfa6eca392ce3e36bdc35adb6f085bad/iu,
    );
    assert.match(
      document,
      /observability@0\.2\.0[^\n]+historical evidence[^\n]+(?:prior|exact historical) subject/iu,
    );
  }
  for (const document of [
    rootReadme,
    overview,
    capabilityModel,
    enforcementMap,
    roadmap,
    builderCoreReadme,
    packageOwnership,
  ]) {
    assert.doesNotMatch(
      document,
      /\]\([^)]*(?:superpowers|implementation-evidence|review-packets)\//u,
    );
  }
  assert.match(
    packageOwnership,
    /observability `0\.3\.0`[^\n]+OIDC trusted publishing[^\n]+provenance/iu,
  );
  assert.match(
    capabilityModel,
    /certification does not establish[^\n]+durable delivery[^\n]+ongoing provider availability[^\n]+production readiness[^\n]+privacy completeness[^\n]+visual quality[^\n]+human accessibility[^\n]+WCAG conformance/iu,
  );
  assert.match(
    packageOwnership,
    /descriptor `standards@0\.3\.0` is certified from its exact local subject-bound receipt[^\n]+public `0\.2\.0` availability alone does not alter the installed public package/iu,
  );
  assert.deepEqual(
    bookingRecord.evidence.map(({ kind }) => kind),
    [
      "cleanup-recovery",
      "deployed-application",
      "fresh-scaffold",
      "provider-confirmed",
    ],
  );
  assert.deepEqual(
    bookingRecord.evidence
      .filter(({ kind }) => kind !== "fresh-scaffold")
      .map(({ path, revision }) => ({ path, revision })),
    [
      "cleanup-recovery",
      "deployed-application",
      "provider-confirmed",
    ].map(() => ({
      path: "docs/implementation-evidence/2026-08-10-booking-calendly-provider-receipt.md",
      revision: "f9ccb143724b4f1dd7f05a2ee8e3219c224d5558",
    })),
  );
  assert.match(
    enforcementMap,
    /descriptor admission[^\n]+legacy-backfill-exempt[^\n]+closure pass[^\n]+all-certified[^\n]+rejects only the four frozen backfills/iu,
  );
  assert.match(
    enforcementMap,
    /booking-calendly@0\.1\.0[^\n]+certified from fresh-scaffold[^\n]+provider-confirmed[^\n]+cleanup/iu,
  );
  assert.match(
    reviewProtocol,
    /pnpm run check:capability-certification/iu,
  );
  assert.match(
    reviewProtocol,
    /--closure legacy-backfill-exempt/iu,
  );
  assert.match(
    reviewProtocol,
    /--closure all-certified/iu,
  );
  assert.match(
    reviewProtocol,
    /pnpm run verify:booking-calendly-certification/iu,
  );
  assert.match(
    roadmap,
    /provider certification[^.]+complete/iu,
  );
  for (const document of [builderCoreInstructions, builderCoreReadme]) {
    assert.match(document, /private certification registry/iu);
    assert.match(document, /descriptor admission/iu);
    assert.match(document, /closure/iu);
  }
});

test("execution plans enforce direct predecessors and bounded independent-work exceptions", async () => {
  const [reviewProtocol, sourcePlan, roadmap] =
    await Promise.all([
      readRepositoryFile("docs/governance/review-and-contribution.md"),
      readRepositoryFile(
        "docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md",
      ),
      readRepositoryFile("docs/roadmaps/program-roadmap.md"),
    ]);
  const implementationTask = namedLabel("Task", "6C");
  const implementationPredecessor = namedLabel("Task", "6");
  const independentStream = namedLabel("Task", "6B");
  const diagnosticsReleaseTask = namedLabel("Task", "5");
  const portfolioPhase = compactLabel("P", "2");

  assert.match(reviewProtocol, /^### Direct-predecessor gate$/mu);
  assert.match(
    reviewProtocol,
    /every implementation or certification plan[^.]+direct predecessor[^.]+acceptance artifact/iu,
  );
  assert.match(
    reviewProtocol,
    /explicit approval[^.]+ancestor of `HEAD`[^.]+machine[^.]+admission or closure/iu,
  );
  assert.match(
    reviewProtocol,
    /missing, pending, unapproved, non-ancestor, or ambiguous[^.]+hard stop/iu,
  );
  assert.match(
    reviewProtocol,
    /never infer[^.]+incrementing[^.]+number/iu,
  );
  assert.match(
    reviewProtocol,
    /bounded independent-work exception[^.]+explicit human approval[^.]+plan amendment/iu,
  );
  assert.match(
    reviewProtocol,
    /exact base and isolated worktree[^.]+non-overlapping scope[^.]+state that must remain unchanged[^.]+reconciliation boundary/iu,
  );
  assert.match(
    reviewProtocol,
    /does not approve[^.]+waive[^.]+final-diff gate[^.]+external mutation/iu,
  );

  assert.match(sourcePlan, /2026-08-11[^.]+independent-work exception/iu);
  assert.match(
    sourcePlan,
    /main@f4f682d4c711dc86a0158ab7f05393d5c33f0160/iu,
  );
  assert.match(
    sourcePlan,
    new RegExp(
      `${escapeRegularExpression(implementationPredecessor)}[^.]+direct predecessor|accepted ${escapeRegularExpression(implementationPredecessor)}`,
      "iu",
    ),
  );
  assert.match(
    sourcePlan,
    new RegExp(
      `${escapeRegularExpression(independentStream)}[^.]+pending[^.]+unchanged|preserv(?:e|es|ed) ${escapeRegularExpression(independentStream)}'s pending`,
      "iu",
    ),
  );
  assert.match(sourcePlan, /reconciliation[^.]+separate review/iu);

  assert.match(
    roadmap,
    new RegExp(
      `${escapeRegularExpression(implementationTask)} is integrated at \`main@12ecc73a8337ab12ece9dd3a6b2aec03f940383c\``,
      "u",
    ),
  );
  assert.match(
    roadmap,
    new RegExp(
      `${escapeRegularExpression(implementationPredecessor)}'s exact implementation diff[\\s\\S]+implementation task is complete`,
      "iu",
    ),
  );
  assert.match(
    roadmap,
    new RegExp(
      `(?:${escapeRegularExpression(portfolioPhase)} )?${escapeRegularExpression(independentStream)} is the separate[\\s\\S]+?certification increment[\\s\\S]+?complete`,
      "iu",
    ),
  );
  assert.match(
    roadmap,
    /cleanup-recovery[^.]+not claimed[^.]+retained-resource disposition[^.]+accepted/iu,
  );
  assert.match(
    roadmap,
    new RegExp(
      `diagnostics ${escapeRegularExpression(diagnosticsReleaseTask)}[^.]+selected[^.]+next increment[^.]+certification transition[^.]+integrated`,
      "iu",
    ),
  );

});

test("accepted ADRs use the repository decision contract", async () => {
  const index = await readRepositoryFile("docs/adr/README.md");
  const rowPositions = [];

  for (const [fileName, identifier] of acceptedAdrs) {
    const relativePath = `docs/adr/${fileName}`;
    const document = await readRepositoryFile(relativePath);

    assert.deepEqual(
      validateAcceptedAdr({ document, fileName, identifier, index }),
      [],
      relativePath,
    );
    rowPositions.push(index.indexOf(`[${identifier}](${fileName})`));
  }

  assert.ok(
    rowPositions.every(
      (position, index) => index === 0 || position > rowPositions[index - 1],
    ),
    "accepted ADR index rows are out of order",
  );
});

test("generated fixture enforcement is wired through its canonical owners", async () => {
  const manifest = JSON.parse(await readRepositoryFile("package.json"));
  const [
    rootInstructions,
    readme,
    contributing,
    overview,
    capabilityModel,
    enforcementMap,
    packageOwnership,
    roadmap,
    builderCoreReadme,
    cliReadme,
    eslintConfiguration,
  ] = await Promise.all(
    [
      "AGENTS.md",
      "README.md",
      "CONTRIBUTING.md",
      "docs/architecture/overview.md",
      "docs/architecture/capability-model.md",
      "docs/architecture/enforcement-map.md",
      "docs/architecture/package-ownership.md",
      "docs/roadmaps/program-roadmap.md",
      "packages/builder-core/README.md",
      "apps/cli/README.md",
      "eslint.config.mjs",
    ].map(readRepositoryFile),
  );
  const builderStage = compactLabel("P", "1");
  const portfolioStage = compactLabel("P", "2");
  const copyEnforcementTask = namedLabel("Task", "2");
  const sectionCatalogTask = namedLabel("Task", "3");
  const responsiveInterfaceTask = namedLabel("Task", "4");
  const browserTestingTask = namedLabel("Task", "4B");
  const calendlyTask = namedLabel("Task", "5");
  const calendlyCertificationTask = namedLabel("Task", "5B");
  const observabilityTask = namedLabel("Task", "6");
  const generatedTestingTask = namedLabel("Task", "6C");
  const generatedTestingCertificationTask = namedLabel("Task", "6D");

  assert.deepEqual(
    {
      fixtures: manifest.scripts["test:generated-fixtures"],
      kernel: manifest.scripts["verify:builder-kernel"],
      skeletons: manifest.scripts["verify:generated-skeletons"],
    },
    {
      fixtures: "node --test tests/generated-fixtures/*.test.mjs",
      kernel:
        "pnpm run test:constitution && pnpm run test:package-boundaries && pnpm run build:builder && pnpm run test:builder-core && pnpm run test:cli && pnpm run test:packages && pnpm run test:capability-certification && pnpm run check:capability-certification && pnpm run test:generated-fixtures && pnpm run lint:builder && pnpm run typecheck:builder && pnpm run verify:generated-skeletons && pnpm run changeset:status",
      skeletons: "node scripts/verify-generated-skeletons.mjs",
    },
  );
  await Promise.all(
    [
      "fixtures/generated/portfolio",
      "fixtures/generated/portfolio-calendly",
      "fixtures/generated/site",
    ].map((path) => access(resolve(repositoryRoot, path))),
  );

  assert.match(
    readme,
    /## Current implementation status/,
  );
  assert.match(
    readme,
    /builder kernel has received verified-final-diff approval.*committed golden fixtures.*client-ready portfolio stage is in progress/iu,
  );
  assert.match(readme, /retained `portfolio-calendly` fixture/iu);
  assert.match(
    capabilityModel,
    /seven `portfolio`\/`site` descriptors.*are executable/iu,
  );
  assert.match(
    packageOwnership,
    /exact seven-capability catalog/iu,
  );
  assert.match(
    builderCoreReadme,
    /exact seven executable capability descriptors/iu,
  );
  assert.match(
    cliReadme,
    /paired `--calendly-url` and `--calendly-mode`/iu,
  );
  assert.match(
    roadmap,
    new RegExp(
      `## ${builderStage} — Builder kernel[\\s\\S]+\\*\\*Completed \\(2026-08-09\\):\\*\\*[\\s\\S]+303ee9d35e19f9191948d994159f77c82c90a1ed\\.\\.5580da10eded51ceefa53a068c7ddaaddf2a2d50`,
    ),
  );
  assert.match(
    roadmap,
    new RegExp(
      "## " +
        escapeRegularExpression(portfolioStage) +
        " — Client-ready portfolio[\\s\\S]+" +
        escapeRegularExpression(copyEnforcementTask) +
        " added standards-owned static visible-copy enforcement for canonical templates[\\s\\S]+" +
        escapeRegularExpression(sectionCatalogTask) +
        " materialized the source-owned typed section catalog[\\s\\S]+" +
        escapeRegularExpression(responsiveInterfaceTask) +
        "'s responsive Tailwind presentation[\\s\\S]+are approved at committed artifact `e7026bd9e8c7a7ca20b5a485ee6702d2921a7586`[\\s\\S]+" +
        "Selecting " +
        escapeRegularExpression(calendlyTask) +
        " as the next increment approved " +
        escapeRegularExpression(browserTestingTask) +
        "'s generated browser-quality foundation at committed artifact `02ec5eb12741c1622beec02529c38965e7501d68`[\\s\\S]+" +
        "Selecting " +
        escapeRegularExpression(calendlyCertificationTask) +
        " as the next increment accepted " +
        escapeRegularExpression(calendlyTask) +
        " Calendly initial scaffolding[\\s\\S]+" +
        escapeRegularExpression(calendlyCertificationTask) +
        "'s bounded provider certification evidence is complete[\\s\\S]+" +
        escapeRegularExpression(observabilityTask) +
        "'s exact implementation diff `717c3bb0f048f4a4bc544100125ae42d818f09bc\\.\\.45b57d2dc265ef6ba9ac805d7352a01db5f1081d` is approved and the implementation task is complete",
    ),
  );
  assert.match(
    roadmap,
    /explicitly amended `observability@0\.2\.0` certification candidate records reviewed deployed-application and fresh-scaffold evidence[\s\S]{0,200}`cleanup-recovery` is not claimed/iu,
  );
  assert.match(
    roadmap,
    new RegExp(
      `${escapeRegularExpression(generatedTestingTask)} is integrated at \`main@12ecc73a8337ab12ece9dd3a6b2aec03f940383c\``,
      "u",
    ),
  );
  assert.match(
    roadmap,
    /Content candidate `93e4e9f6ea944329de7c47c9e8bf34382774b1f8` passed local verification and all three applicable hosted workflows/iu,
  );
  assert.match(
    roadmap,
    /always-on read-only builder\/package workflow and the path-scoped generated-project and compatibility-proof workflows passed hosted runs `31583624246`, `31583624387`, and `31583624223`/iu,
  );
  assert.match(
    roadmap,
    new RegExp(
      `${escapeRegularExpression(namedLabel("Task", "6D"))} is squash-integrated at accepted \`main@c9294e9dc59d4b7bafed406846af3b43a10733d3\`[\\s\\S]+accepted repair \`ee1e1df10fa2be2f09333efecd86de7f7a131d49\` binds the reviewed rerun receipt to accepted-main evidence revision`,
      "u",
    ),
  );
  assert.match(
    readme,
    /standards@0\.3\.0[^\n]+renewed eight-outcome private receipt[^\n]+d7c63b0aaa9bebd56c075f16f1e5d86519853698/iu,
  );
  assert.match(
    roadmap,
    new RegExp(
      `${escapeRegularExpression(namedLabel("Task", "6D"))} evidence renewal[^\\n]+all eight[^\\n]+d7c63b0aaa9bebd56c075f16f1e5d86519853698`,
      "iu",
    ),
  );
  assert.match(
    roadmap,
    /restricted-error-diagnostics implementation revision `393225988aaed173e21dc547e69ff5b03305cf93`[^\n]+integrated by accepted-main merge `d543de78d8e1c238a499aeba5e315f4db724dd1b`[^\n]+observability@0\.3\.0[^\n]+certified[^\n]+fresh-scaffold[^\n]+deployed-application[^\n]+cleanup-recovery[^\n]+bdcc55f1bfa6eca392ce3e36bdc35adb6f085bad/iu,
  );
  assert.match(
    roadmap,
    new RegExp(
      `${escapeRegularExpression(generatedTestingTask)} is integrated at \`main@12ecc73a8337ab12ece9dd3a6b2aec03f940383c\`[\\s\\S]+${escapeRegularExpression(generatedTestingCertificationTask)} is squash-integrated at accepted \`main@c9294e9dc59d4b7bafed406846af3b43a10733d3\`[\\s\\S]+accepted repair \`ee1e1df10fa2be2f09333efecd86de7f7a131d49\`[\\s\\S]+Automatic-CI Plan A is integrated at accepted \`main@368b9491fd2f813f83f1e456823d8c7546f6762c\`[\\s\\S]+${escapeRegularExpression(generatedTestingCertificationTask)} evidence renewal is integrated at accepted \`main@7b5324cfcffc7eb94f48cc304cbfe0ceb08c3486\``,
      "u",
    ),
  );
  assert.match(
    contributing,
    /The executable builder currently has seven capability descriptors.*retains exact `portfolio`, `portfolio-calendly`, and `site` fixtures.*all three fixtures are certified locally.*recurring Calendly browser proof.*separate private exact-revision provider receipt certifies.*protected-staging.*confirmation.*cancellation.*cleanup/isu,
  );
  assert.match(
    packageOwnership,
    /Controlling package and API ownership through the approved builder kernel, generated validated content, responsive portfolio presentation/iu,
  );
  for (const document of [rootInstructions, readme, contributing]) {
    assert.match(document, /verify:builder-kernel/u);
  }
  assert.match(
    overview,
    /committed portfolio, portfolio-with-Calendly, and site fixtures/iu,
  );
  assert.match(enforcementMap, /verify:generated-skeletons/u);
  assert.match(packageOwnership, /committed golden fixtures/u);
  assert.doesNotMatch(enforcementMap, /temporary repository-local ESLint adapter/u);
  assert.doesNotMatch(packageOwnership, /temporary root ESLint adapter/u);
  assert.doesNotMatch(eslintConfiguration, /noSequencingLabels|semantic-naming/u);
  await assert.rejects(
    access(
      resolve(repositoryRoot, "scripts/eslint/no-sequencing-labels.mjs"),
    ),
  );
});
