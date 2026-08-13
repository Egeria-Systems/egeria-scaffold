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

function assertObservabilityWorkflowSecretBoundary(workflow) {
  assertWorkflowSecretBoundary(workflow, [
    {
      path: 'jobs.verify-and-deploy.steps["Deploy certification Worker"].env.CLOUDFLARE_ACCOUNT_ID',
      reference: "secrets.CLOUDFLARE_ACCOUNT_ID",
    },
    {
      path: 'jobs.verify-and-deploy.steps["Deploy certification Worker"].env.CLOUDFLARE_API_TOKEN',
      reference: "secrets.CLOUDFLARE_API_TOKEN",
    },
    {
      path: 'jobs.verify-and-deploy.steps["Install observability provider secrets"].env.CLOUDFLARE_ACCOUNT_ID',
      reference: "secrets.CLOUDFLARE_ACCOUNT_ID",
    },
    {
      path: 'jobs.verify-and-deploy.steps["Install observability provider secrets"].env.CLOUDFLARE_API_TOKEN',
      reference: "secrets.CLOUDFLARE_API_TOKEN",
    },
    {
      path: 'jobs.verify-and-deploy.steps["Install observability provider secrets"].env.BETTER_STACK_INGESTING_HOST',
      reference: "secrets.BETTER_STACK_INGESTING_HOST",
    },
    {
      path: 'jobs.verify-and-deploy.steps["Install observability provider secrets"].env.BETTER_STACK_SOURCE_TOKEN',
      reference: "secrets.BETTER_STACK_SOURCE_TOKEN",
    },
  ]);
}

function extractObservabilityHumanPrerequisiteRunbook(document) {
  return document
    .split("## Human prerequisite runbook\n", 2)[1]
    ?.split("\n## Consolidated contradictions and live-run blockers", 1)[0];
}

async function readRepositoryFile(relativePath) {
  return readFile(resolve(repositoryRoot, relativePath), "utf8");
}

async function listRepositoryMarkdownFiles() {
  const { stdout } = await execFileAsync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { cwd: repositoryRoot, encoding: "utf8" },
  );

  return stdout
    .split("\0")
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
    ".github/workflows/**",
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
    ".github/workflows/**",
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
    "pnpm exec changeset status --since origin/main",
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
  const workflowRevision = await commitFile(
    ".github/workflows/scoped.yml",
    "name: scoped\n",
    "workflow",
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
      name: "workflow change",
      pushBaseSha: proofRevision,
      pushHeadSha: workflowRevision,
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
  const approvalGate = namedLabel("Gate", "3");
  const historicalPathToken = compactLabel("p", "0", "-", "3");
  const [
    rootInstructions,
    readme,
    contributing,
    packageOwnership,
    overview,
    enforcementMap,
    roadmap,
    verification,
    reviewPacket,
  ] = await Promise.all([
    readRepositoryFile("AGENTS.md"),
    readRepositoryFile("README.md"),
    readRepositoryFile("CONTRIBUTING.md"),
    readRepositoryFile("docs/architecture/package-ownership.md"),
    readRepositoryFile("docs/architecture/overview.md"),
    readRepositoryFile("docs/architecture/enforcement-map.md"),
    readRepositoryFile("docs/roadmaps/program-roadmap.md"),
    readRepositoryFile(
      `docs/implementation-evidence/2026-08-04-${historicalPathToken}-lean-builder-monorepo-verification.md`,
    ),
    readRepositoryFile(
      `docs/review-packets/2026-08-04-${historicalPathToken}-lean-builder-monorepo.md`,
    ),
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
    /both package names and target versions are absent/i,
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
  assert.match(
    verification,
    new RegExp(
      `${escapeRegularExpression(approvalGate)} APPROVED[^\\n]+40604eb5b8a3ade0175c16dd945a1bafee15ae04\\.\\.da74a5baab12d19fa5a5007008f960f495721b8e`,
      "i",
    ),
  );
  assert.match(
    reviewPacket,
    new RegExp(
      `${escapeRegularExpression(approvalGate)} outcome:\\*\\* APPROVED[^\\n]+40604eb5b8a3ade0175c16dd945a1bafee15ae04\\.\\.da74a5baab12d19fa5a5007008f960f495721b8e`,
      "i",
    ),
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

  assert.match(workflow, /^on:\n  workflow_dispatch:\n/m);
  assert.doesNotMatch(workflow, /^  (?:push|pull_request|schedule):/m);
  assert.match(workflow, /^permissions:\n  contents: read\n/m);
  assert.match(
    workflow,
    /^  group: test-deploy\n  cancel-in-progress: false\n  queue: max$/m,
  );
  assert.match(workflow, /if: github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /^      name: test-deploy$/m);
  assert.match(workflow, /^      url: \$\{\{ vars\.DEPLOY_URL \}\}$/m);
  assert.equal(
    isPinnedGitHubActionReference(
      stepsByName["Check out repository"].uses,
      "actions/checkout",
    ),
    true,
  );
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
  assert.match(workflow, /^          cache: true$/m);
  assert.match(workflow, /^          install: false$/m);
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

  const verifyIndex = workflow.indexOf("- name: Verify compatibility proof");
  const deployIndex = workflow.indexOf("- name: Deploy compatibility Worker");
  const deployedTestIndex = workflow.indexOf(
    "- name: Test deployed compatibility proof",
  );

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
    calendlyPreparation,
    observabilityPreparation,
  ] = await Promise.all([
    readRepositoryFile(".github/workflows/compatibility-proof.yml"),
    readRepositoryFile(".github/workflows/booking-calendly-certification.yml"),
    readRepositoryFile(
      ".github/workflows/production-observability-certification.yml",
    ),
    readRepositoryFile("docs/governance/shared-test-deployment.md"),
    readRepositoryFile("docs/compatibility/nextjs-cloudflare.md"),
    readRepositoryFile(
      "docs/implementation-evidence/2026-08-10-booking-calendly-certification-preparation.md",
    ),
    readRepositoryFile(
      "docs/implementation-evidence/2026-08-11-production-observability-certification-preparation.md",
    ),
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
      /vars\.(?:COMPATIBILITY_URL|BOOKING_CALENDLY_CERTIFICATION_URL|OBSERVABILITY_CERTIFICATION_URL)/u,
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

  for (const document of [
    compatibilityRecord,
    calendlyPreparation,
    observabilityPreparation,
  ]) {
    assert.match(document, /shared-test-deployment\.md/u);
  }
});

test("Calendly certification deployment is manual, revision-bound, and secret-minimal", async () => {
  const [source, runbook, receipt, wranglerTemplate, renderingSource] =
    await Promise.all([
      readRepositoryFile(
        ".github/workflows/booking-calendly-certification.yml",
      ),
      readRepositoryFile(
        "docs/implementation-evidence/2026-08-10-booking-calendly-certification-preparation.md",
      ),
      readRepositoryFile(
        "docs/implementation-evidence/booking-calendly-provider-receipt-template.md",
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
    cache: true,
    install: false,
  });
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
  assert.match(runbook, new RegExp("Worker name `" + projectName + "`"));
  assert.match(receipt, new RegExp("preflight for `" + projectName + "`"));
  assert.doesNotMatch(runbook, /acme-portfolio-calendly-web/u);
  assert.doesNotMatch(receipt, /acme-portfolio-calendly-web/u);
});

test("the provider receipt template separates application, provider, and cleanup evidence", async () => {
  const template = await readRepositoryFile(
    "docs/implementation-evidence/booking-calendly-provider-receipt-template.md",
  );

  for (const heading of [
    "Workflow and revision identity",
    "Synthetic-data declaration",
    "Deployed application evidence",
    "Provider-confirmed evidence",
    "Cancellation and cleanup evidence",
    "Privacy exclusions",
    "Claim boundary",
  ]) {
    assert.match(template, new RegExp(`^## ${heading}$`, "mu"));
  }
  assert.match(template, /synthetic host and invitee/iu);
  assert.match(template, /meeting status/iu);
  assert.match(template, /acme-portfolio-calendly/u);
  assert.match(template, /Worker.*removed|removed.*Worker/iu);
  assert.match(template, /must not contain.*email address/iu);
  assert.match(template, /does not establish WCAG conformance/iu);
});

test("observability certification deployment is manual, exact-revision, and secret-isolated", async () => {
  const [source, wranglerTemplate, renderingSource] = await Promise.all([
    readRepositoryFile(
      ".github/workflows/production-observability-certification.yml",
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
  assert.equal(job["timeout-minutes"], 60);
  assert.deepEqual(job.environment, {
    name: "test-deploy",
    url: "${{ vars.DEPLOY_URL }}",
  });
  const stepsByName = Object.fromEntries(
    job.steps.map((step) => [step.name, step]),
  );
  const certificationRoot =
    "${{ runner.temp }}/production-observability-certification/project";
  const secretFile =
    "${{ runner.temp }}/production-observability-provider-secrets.json";
  const deploymentsFile =
    "${{ runner.temp }}/production-observability-cloudflare-deployments.json";
  const deploymentReceipt =
    "${{ runner.temp }}/production-observability-cloudflare-receipt.json";
  const browserReceipt =
    "${{ runner.temp }}/production-observability-browser-receipt.json";

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
    cache: true,
    install: false,
  });

  assert.deepEqual(stepsByName["Verify approved revision"].env, {
    EXPECTED_REVISION: "${{ inputs.expected_revision }}",
  });
  assert.match(
    stepsByName["Verify approved revision"].run,
    /test "\$GITHUB_REF" = "refs\/heads\/main"/u,
  );
  assert.match(
    stepsByName["Verify approved revision"].run,
    /\[\[ "\$EXPECTED_REVISION" =~ \^\[0-9a-f\]\{40\}\$ \]\]/u,
  );
  assert.match(
    stepsByName["Verify approved revision"].run,
    /test "\$GITHUB_SHA" = "\$EXPECTED_REVISION"/u,
  );
  assert.match(
    stepsByName["Verify approved revision"].run,
    /test "\$\(git rev-parse HEAD\)" = "\$GITHUB_SHA"/u,
  );
  assert.equal(
    stepsByName["Install builder dependencies"].run,
    "pnpm install --frozen-lockfile",
  );
  assert.equal(
    stepsByName["Build builder packages"].run,
    "pnpm run build:builder",
  );
  assert.match(
    stepsByName["Verify fresh local scaffold"].run,
    /node scripts\/certify-production-observability\.mjs > "\$RUNNER_TEMP\/production-observability-local-receipt\.json"/u,
  );
  assert.match(
    stepsByName["Verify fresh local scaffold"].run,
    /wc -c < "\$RUNNER_TEMP\/production-observability-local-receipt\.json"\)" -le 2048/u,
  );

  assert.deepEqual(stepsByName["Create deployment candidate"].env, {
    CERTIFICATION_ROOT: certificationRoot,
  });
  assert.match(
    stepsByName["Create deployment candidate"].run,
    /node apps\/cli\/dist\/index\.js create --profile portfolio --name acme-portfolio-observability --display-name "Acme Portfolio Observability" --directory "\$CERTIFICATION_ROOT"/u,
  );
  assert.match(wranglerTemplate, /"name": "\{\{workerName\}\}"/u);
  assert.match(
    renderingSource,
    /workerName: projectResult\.value\.project\.name/u,
  );
  assert.deepEqual(stepsByName["Add certification fixtures"].env, {
    CERTIFICATION_ROOT: certificationRoot,
  });
  assert.match(
    stepsByName["Add certification fixtures"].run,
    /tests\/capability-certification\/fixtures\/observability-error-route\.ts/u,
  );
  assert.match(
    stepsByName["Add certification fixtures"].run,
    /apps\/web\/app\/api\/observability-certification-error\/route\.ts/u,
  );
  assert.match(
    stepsByName["Add certification fixtures"].run,
    /tests\/capability-certification\/fixtures\/observability-browser-error\.spec\.ts/u,
  );
  assert.match(
    stepsByName["Add certification fixtures"].run,
    /apps\/web\/tests\/e2e\/observability-browser-error\.spec\.ts/u,
  );
  assert.deepEqual(stepsByName["Prepare deployment candidate"].env, {
    CERTIFICATION_ROOT: certificationRoot,
  });
  assert.match(
    stepsByName["Prepare deployment candidate"].run,
    /pnpm --dir "\$CERTIFICATION_ROOT" install --frozen-lockfile/u,
  );
  assert.match(
    stepsByName["Prepare deployment candidate"].run,
    /pnpm --dir "\$CERTIFICATION_ROOT" run build:cloudflare/u,
  );
  assert.match(
    stepsByName["Prepare deployment candidate"].run,
    /pnpm --dir "\$CERTIFICATION_ROOT\/apps\/web" run browser:install:ci/u,
  );

  assert.deepEqual(stepsByName["Deploy certification Worker"].env, {
    CERTIFICATION_ROOT: certificationRoot,
    CLOUDFLARE_ACCOUNT_ID: "${{ secrets.CLOUDFLARE_ACCOUNT_ID }}",
    CLOUDFLARE_API_TOKEN: "${{ secrets.CLOUDFLARE_API_TOKEN }}",
  });
  assert.match(
    stepsByName["Deploy certification Worker"].run,
    /pnpm --dir "\$CERTIFICATION_ROOT\/apps\/web" exec opennextjs-cloudflare deploy --name test-deploy/u,
  );
  assert.doesNotMatch(
    stepsByName["Deploy certification Worker"].run,
    credentialBoundPackageCommandPattern,
  );
  assert.doesNotMatch(
    stepsByName["Deploy certification Worker"].run,
    /better[_ -]?stack/iu,
  );

  const secretStep = stepsByName["Install observability provider secrets"];
  assert.deepEqual(secretStep.env, {
    CERTIFICATION_ROOT: certificationRoot,
    SECRET_FILE: secretFile,
    DEPLOYMENTS_FILE: deploymentsFile,
    DEPLOYMENT_RECEIPT: deploymentReceipt,
    CLOUDFLARE_ACCOUNT_ID: "${{ secrets.CLOUDFLARE_ACCOUNT_ID }}",
    CLOUDFLARE_API_TOKEN: "${{ secrets.CLOUDFLARE_API_TOKEN }}",
    BETTER_STACK_INGESTING_HOST:
      "${{ secrets.BETTER_STACK_INGESTING_HOST }}",
    BETTER_STACK_SOURCE_TOKEN:
      "${{ secrets.BETTER_STACK_SOURCE_TOKEN }}",
  });
  assert.match(secretStep.run, /^umask 077$/mu);
  assert.match(
    secretStep.run,
    /trap 'rm -f "\$SECRET_FILE" "\$DEPLOYMENTS_FILE"' EXIT/u,
  );
  assert.match(secretStep.run, /BETTER_STACK_INGESTING_HOST:\s*process\.env\.BETTER_STACK_INGESTING_HOST/u);
  assert.match(secretStep.run, /BETTER_STACK_SOURCE_TOKEN:\s*process\.env\.BETTER_STACK_SOURCE_TOKEN/u);
  assert.match(secretStep.run, /mode:\s*0o600/u);
  assert.match(secretStep.run, /flag:\s*"wx"/u);
  assert.match(secretStep.run, /stat -c "%a" "\$SECRET_FILE"/u);
  assert.match(
    secretStep.run,
    /wrangler secret bulk "\$SECRET_FILE" --name test-deploy/u,
  );
  assert.match(
    secretStep.run,
    /wrangler deployments list --name test-deploy --json > "\$DEPLOYMENTS_FILE"/u,
  );
  assert.match(
    secretStep.run,
    /node scripts\/create-cloudflare-deployment-receipt\.mjs --input "\$DEPLOYMENTS_FILE" --revision "\$GITHUB_SHA" --worker test-deploy > "\$DEPLOYMENT_RECEIPT"/u,
  );
  assert.match(
    secretStep.run,
    /test "\$\(wc -l < "\$DEPLOYMENT_RECEIPT"\)" -eq 1/u,
  );
  assert.match(
    secretStep.run,
    /test "\$\(wc -c < "\$DEPLOYMENT_RECEIPT"\)" -le 1024/u,
  );
  assert.match(
    secretStep.run,
    /stat -c "%a" "\$DEPLOYMENT_RECEIPT"/u,
  );
  assert.ok(
    secretStep.run.indexOf('wrangler secret bulk "$SECRET_FILE"') <
      secretStep.run.indexOf("wrangler deployments list"),
  );
  assert.ok(
    secretStep.run.indexOf("wrangler deployments list") <
      secretStep.run.indexOf(
        "node scripts/create-cloudflare-deployment-receipt.mjs",
      ),
  );
  assert.doesNotMatch(secretStep.run, /\$BETTER_STACK_|\$\{\{\s*secrets\./u);

  assert.deepEqual(stepsByName["Exercise deployed observability"].env, {
    OBSERVABILITY_CERTIFICATION_URL:
      "${{ vars.DEPLOY_URL }}",
    EXPECTED_REVISION: "${{ inputs.expected_revision }}",
  });
  assert.match(
    stepsByName["Exercise deployed observability"].run,
    /node scripts\/exercise-production-observability\.mjs --base-url "\$OBSERVABILITY_CERTIFICATION_URL" --revision "\$EXPECTED_REVISION" > "\$RUNNER_TEMP\/production-observability-route-receipt\.json"/u,
  );
  assert.match(
    stepsByName["Exercise deployed observability"].run,
    /wc -c < "\$RUNNER_TEMP\/production-observability-route-receipt\.json"\)" -le 2048/u,
  );
  assert.deepEqual(stepsByName["Test deployed application behavior"].env, {
    CERTIFICATION_ROOT: certificationRoot,
    PLAYWRIGHT_DEPLOYED_URL: "${{ vars.DEPLOY_URL }}",
    OBSERVABILITY_BROWSER_RECEIPT_PATH: browserReceipt,
  });
  assert.match(
    stepsByName["Test deployed application behavior"].run,
    /pnpm --dir "\$CERTIFICATION_ROOT\/apps\/web" run test:e2e:deployed/u,
  );
  assert.match(
    stepsByName["Test deployed application behavior"].run,
    /wc -l < "\$OBSERVABILITY_BROWSER_RECEIPT_PATH"\)" -eq 1/u,
  );
  assert.match(
    stepsByName["Test deployed application behavior"].run,
    /wc -c < "\$OBSERVABILITY_BROWSER_RECEIPT_PATH"\)" -le 1024/u,
  );
  assert.match(
    stepsByName["Test deployed application behavior"].run,
    /stat -c "%a" "\$OBSERVABILITY_BROWSER_RECEIPT_PATH"/u,
  );

  assertObservabilityWorkflowSecretBoundary(workflow);
  const betterStackSecretReferences = job.steps
    .filter((step) => JSON.stringify(step).includes("secrets.BETTER_STACK_"))
    .map(({ name }) => name);
  assert.deepEqual(betterStackSecretReferences, [
    "Install observability provider secrets",
  ]);
  const secretStepIndex = job.steps.findIndex(
    ({ name }) => name === "Install observability provider secrets",
  );
  const exerciseIndex = job.steps.findIndex(
    ({ name }) => name === "Exercise deployed observability",
  );
  const browserIndex = job.steps.findIndex(
    ({ name }) => name === "Test deployed application behavior",
  );
  assert.ok(secretStepIndex > -1 && secretStepIndex < exerciseIndex);
  assert.ok(exerciseIndex < browserIndex);
  assert.doesNotMatch(
    JSON.stringify(job.steps.slice(secretStepIndex + 1)),
    /\$\{\{\s*secrets\./u,
  );

  const uploadStep = stepsByName["Upload certification receipts"];
  assert.equal(
    isPinnedGitHubActionReference(
      uploadStep.uses,
      "actions/upload-artifact",
    ),
    true,
  );
  assert.deepEqual(uploadStep.with, {
    name: "production-observability-certification-receipts",
    path:
      "${{ runner.temp }}/production-observability-local-receipt.json\n${{ runner.temp }}/production-observability-route-receipt.json\n${{ runner.temp }}/production-observability-browser-receipt.json\n${{ runner.temp }}/production-observability-cloudflare-receipt.json\n",
    "if-no-files-found": "error",
    "retention-days": 7,
  });
  assert.doesNotMatch(
    uploadStep.with.path,
    /deployments|provider-secrets/iu,
  );
  assert.doesNotMatch(source, /^  (?:pull_request|push|schedule):/mu);
  assert.doesNotMatch(
    source,
    /gh workflow run|betterstack\.com\/api|api\.betterstack|wrangler\s+delete|rollback/iu,
  );
});

test("observability workflow secrets are rejected outside exact approved step environment paths", async (t) => {
  const source = await readRepositoryFile(
    ".github/workflows/production-observability-certification.yml",
  );
  const workflow = parse(source);
  const secretExpression = "${{ secrets.CLOUDFLARE_API_TOKEN }}";
  const mutations = [
    [
      "workflow environment",
      (candidate) => (candidate.env = { LEAK: secretExpression }),
    ],
    [
      "job environment",
      (candidate) =>
        (candidate.jobs["verify-and-deploy"].env = {
          LEAK: secretExpression,
        }),
    ],
    [
      "job defaults",
      (candidate) =>
        (candidate.jobs["verify-and-deploy"].defaults = {
          run: { shell: secretExpression },
        }),
    ],
    [
      "job container",
      (candidate) =>
        (candidate.jobs["verify-and-deploy"].container = {
          image: secretExpression,
        }),
    ],
    [
      "job matrix",
      (candidate) =>
        (candidate.jobs["verify-and-deploy"].strategy = {
          matrix: { leak: [secretExpression] },
        }),
    ],
    [
      "step run string",
      (candidate) => {
        const deployStep = candidate.jobs["verify-and-deploy"].steps.find(
          ({ name }) => name === "Deploy certification Worker",
        );
        deployStep.run = `${deployStep.run}\n${secretExpression}`;
      },
    ],
    [
      "bracket secret syntax",
      (candidate) =>
        (candidate.jobs["verify-and-deploy"].env = {
          LEAK: "${{ secrets['CLOUDFLARE_API_TOKEN'] }}",
        }),
    ],
    [
      "bare secret context",
      (candidate) =>
        (candidate.jobs["verify-and-deploy"].env = {
          LEAK: "${{ secrets }}",
        }),
    ],
    [
      "dynamic secret context",
      (candidate) =>
        (candidate.jobs["verify-and-deploy"].env = {
          LEAK: "${{ secrets[github.event.inputs.secret_name] }}",
        }),
    ],
  ];

  for (const [name, mutate] of mutations) {
    await t.test(name, () => {
      const mutatedWorkflow = structuredClone(workflow);

      mutate(mutatedWorkflow);
      assert.throws(() =>
        assertObservabilityWorkflowSecretBoundary(mutatedWorkflow),
      );
    });
  }
});

test("observability preparation provides the required step-by-step human prerequisite runbook", async () => {
  const [preparation, plan] = await Promise.all([
    readRepositoryFile(
      "docs/implementation-evidence/2026-08-11-production-observability-certification-preparation.md",
    ),
    readRepositoryFile(
      "docs/superpowers/plans/2026-08-10-production-observability-certification.md",
    ),
  ]);
  const runbook = extractObservabilityHumanPrerequisiteRunbook(preparation);

  assert.ok(runbook, "observability human-prerequisite runbook is missing");
  assert.match(
    runbook,
    /account owner[\s\S]+account type[\s\S]+subscription tier[\s\S]+sandbox or test environment[\s\S]+eligibility[\s\S]+waiting period/iu,
  );
  assert.match(
    runbook,
    /GitHub repository administrator[\s\S]+Cloudflare account administrator[\s\S]+Better Stack operator[\s\S]+privacy and cost owner[\s\S]+cleanup owner[\s\S]+evidence reviewer/iu,
  );
  assert.match(
    runbook,
    /`test-deploy`[\s\S]+`CLOUDFLARE_ACCOUNT_ID`[\s\S]+`CLOUDFLARE_API_TOKEN`[\s\S]+`BETTER_STACK_INGESTING_HOST`[\s\S]+`BETTER_STACK_SOURCE_TOKEN`[\s\S]+GitHub environment secrets/iu,
  );
  assert.match(
    runbook,
    /`Workers Scripts Write`[\s\S]+human[\s\S]+approve[\s\S]+exact command/iu,
  );
  assert.match(
    runbook,
    /credential[\s\S]+scope[\s\S]+lifetime[\s\S]+expir[\s\S]+rotat/iu,
  );
  assert.match(
    runbook,
    /public HTTPS staging origin[\s\S]+`DEPLOY_URL`[\s\S]+synthetic/iu,
  );
  assert.match(
    runbook,
    /no callback, webhook, redirect, or allowlist[\s\S]+no synthetic human identity/iu,
  );
  assert.match(runbook, /readiness preflight/iu);
  assert.match(
    runbook,
    /every 30 seconds[\s\S]+10-minute deadline[\s\S]+stop[\s\S]+fail/iu,
  );
  assert.match(
    runbook,
    /rate limit[\s\S]+quota[\s\S]+no paid upgrade[\s\S]+retention/iu,
  );
  assert.match(
    plan,
    /- \[x\] Add the governance-required step-by-step human-prerequisite runbook/u,
  );
});

test("observability runbook keeps external actions gated and defines ordered cleanup and recovery", async () => {
  const preparation = await readRepositoryFile(
    "docs/implementation-evidence/2026-08-11-production-observability-certification-preparation.md",
  );
  const runbook = extractObservabilityHumanPrerequisiteRunbook(preparation);

  assert.ok(runbook, "observability human-prerequisite runbook is missing");
  assert.match(
    runbook,
    /explicit approval checkpoint[\s\S]+integration and push[\s\S]+environment[\s\S]+provider source[\s\S]+credential[\s\S]+workflow dispatch[\s\S]+telemetry[\s\S]+provider inspection[\s\S]+cleanup/iu,
  );
  assert.match(
    runbook,
    /cleanup order[\s\S]+provider-specific Worker secrets[\s\S]+clean compatibility baseline[\s\S]+certification-only route[\s\S]+Better Stack source[\s\S]+retained data[\s\S]+GitHub environment secrets[\s\S]+revoke or rotate/iu,
  );
  assert.match(
    runbook,
    /source rollback[\s\S]+deployment recovery[\s\S]+provider recovery[\s\S]+credential recovery/iu,
  );
  assert.match(runbook, /rerun triggers/iu);
  assert.match(
    runbook,
    /Every external action remains separately unauthorized/iu,
  );
  assert.match(
    runbook,
    /content-safe placeholder[\s\S]+must not contain[\s\S]+secret[\s\S]+private URL[\s\S]+raw log/iu,
  );
});

test("the observability certification error fixture contains only the bounded throwing GET handler", async () => {
  const fixture = await readRepositoryFile(
    "tests/capability-certification/fixtures/observability-error-route.ts",
  );

  assert.equal(
    fixture,
    'export function GET(): never {\n  throw new Error("synthetic observability certification error");\n}\n',
  );
});

test("the deployed browser fixture exercises the generated global reporter and writes only a bounded UUID receipt", async () => {
  const fixture = await readRepositoryFile(
    "tests/capability-certification/fixtures/observability-browser-error.spec.ts",
  );

  assert.match(fixture, /page\.goto\("\/"\)/u);
  assert.match(fixture, /context\(\)\.addCookies/u);
  assert.match(fixture, /name: "observability-certification"/u);
  assert.match(fixture, /value: "synthetic"/u);
  assert.match(fixture, /page\.waitForResponse/u);
  assert.match(fixture, /\/api\/observability/u);
  assert.match(fixture, /browser\.window\.error/u);
  assert.match(fixture, /new ErrorEvent\("error"\)/u);
  assert.match(fixture, /globalThis\.dispatchEvent/u);
  assert.ok(
    fixture.indexOf("page.waitForResponse") <
      fixture.indexOf('new ErrorEvent("error")'),
  );
  assert.doesNotMatch(fixture, /page\.route|route\.(?:abort|continue|fulfill)/u);
  assert.match(fixture, /request\.allHeaders\(\)/u);
  assert.match(fixture, /cookie/u);
  assert.match(fixture, /referer/u);
  for (const literal of [
    'envelope.schemaVersion !== "1.0.0"',
    'event.name !== "browser.window.error"',
    'event.kind !== "application.error"',
    'event.runtime !== "browser"',
    'event.severity !== "error"',
    'event.errorCategory !== "unexpected"',
    'event.attributes.source !== "window-error"',
  ]) {
    assert.match(fixture, new RegExp(escapeRegularExpression(literal), "u"));
  }
  assert.match(fixture, /UUID|uuid/iu);
  assert.match(fixture, /OBSERVABILITY_BROWSER_RECEIPT_PATH/u);
  assert.match(fixture, /isAbsolute/u);
  assert.match(fixture, /browserReporterCorrelationId/u);
  assert.match(fixture, /flag: "wx"/u);
  assert.match(fixture, /mode: 0o600/u);
  assert.match(fixture, /trace: "off"/u);
  assert.match(fixture, /screenshot: "off"/u);
  assert.match(fixture, /video: "off"/u);
  assert.doesNotMatch(
    fixture,
    /console\.|\.attach\(|writeFile\([^,]+,\s*(?:headers|requestEnvelope|body)/u,
  );
});

test("the observability provider receipt separates custom, platform, provider, and cleanup evidence", async () => {
  const template = await readRepositoryFile(
    "docs/implementation-evidence/production-observability-provider-receipt-template.md",
  );

  for (const heading of [
    "Workflow and revision identity",
    "Synthetic-data declaration",
    "Deployed application and custom-event evidence",
    "Cloudflare platform and framework log evidence",
    "Better Stack evidence",
    "Provider-failure containment test basis",
    "Unauthenticated route abuse and cost decision",
    "Credential disposition",
    "Worker, source, and data cleanup",
    "Privacy exclusions",
    "Claim boundary",
    "Reviewer decision",
  ]) {
    assert.match(template, new RegExp(`^## ${heading}$`, "mu"));
  }
  assert.match(template, /observability-certification/iu);
  assert.match(template, /acme-portfolio-observability/u);
  assert.match(template, /cleanup-recovery, deployed-application/u);
  assert.match(template, /application\/custom event/iu);
  assert.match(template, /Workers Logs.*platform\/framework/iu);
  assert.match(template, /source.*region.*tier.*quota.*retention/isu);
  for (const field of [
    "schema_version",
    "dt",
    "event_name",
    "event_kind",
    "runtime",
    "severity",
    "correlation_id",
    "release_id",
    "error_category",
    "attributes",
  ]) {
    assert.match(template, new RegExp(`\\b${field}\\b`, "u"));
  }
  assert.match(template, /provider rejection.*timeout.*unreachable.*containment/isu);
  assert.match(template, /GitHub.*Cloudflare.*Better Stack/isu);
  assert.match(template, /Worker.*source.*retained data/isu);
  assert.match(template, /must not contain.*secret.*ingestion host.*private URL.*raw log.*stack.*request metadata.*client data/isu);
  assert.match(template, /does not establish.*durable delivery/iu);
  assert.match(
    template,
    /local receipt[\s\S]+route-envelope receipt[\s\S]+browser-instrumentation receipt[\s\S]+Cloudflare identity receipt/iu,
  );
  assert.match(
    template,
    /checked Git SHA[\s\S]+secret installation[\s\S]+deployments list[\s\S]+Cloudflare deployment identifier[\s\S]+Cloudflare version identifier/iu,
  );
  assert.match(
    template,
    /`CF_VERSION_METADATA\.id`[\s\S]+Cloudflare version identifier[\s\S]+not the Git revision/iu,
  );
  assert.match(
    template,
    /every provider custom event[\s\S]+`release_id`[\s\S]+captured Cloudflare version identifier[\s\S]+never the Git SHA/iu,
  );
});

test("the observability receipt reconciles every custom event class emitted after secret installation", async () => {
  const [workflowSource, template] = await Promise.all([
    readRepositoryFile(
      ".github/workflows/production-observability-certification.yml",
    ),
    readRepositoryFile(
      "docs/implementation-evidence/production-observability-provider-receipt-template.md",
    ),
  ]);
  const job = parse(workflowSource).jobs["verify-and-deploy"];
  const secretStepIndex = job.steps.findIndex(
    ({ name }) => name === "Install observability provider secrets",
  );
  const exerciseStepIndex = job.steps.findIndex(
    ({ name }) => name === "Exercise deployed observability",
  );
  const browserStepIndex = job.steps.findIndex(
    ({ name }) => name === "Test deployed application behavior",
  );

  assert.ok(secretStepIndex > -1 && secretStepIndex < exerciseStepIndex);
  assert.ok(exerciseStepIndex < browserStepIndex);
  assert.match(
    template,
    /`Exercise deployed observability`[\s\S]+`browser\.window\.error`[\s\S]+route-envelope[\s\S]+revision-derived correlation marker/iu,
  );
  assert.match(
    template,
    /`Exercise deployed observability`[\s\S]+`browser\.web\.vital`[\s\S]+route-envelope[\s\S]+revision-derived correlation marker/iu,
  );
  assert.match(
    template,
    /`Exercise deployed observability`[\s\S]+`server\.request\.error`[\s\S]+generated UUID[\s\S]+not a revision-derived marker/iu,
  );
  assert.match(
    template,
    /`Test deployed application behavior`[\s\S]+actual generated browser reporter[\s\S]+`browser\.window\.error`[\s\S]+UUID/iu,
  );
  assert.match(
    template,
    /`Test deployed application behavior`[\s\S]+`browser\.web\.vital`[\s\S]+non-deterministic[\s\S]+must not predeclare an exact marker or count/iu,
  );
  assert.match(
    template,
    /complete observed custom-event inventory[\s\S]+Cloudflare Workers Logs[\s\S]+Better Stack/iu,
  );
  assert.match(
    template,
    /additional custom event[\s\S]+reject[\s\S]+predeclared[\s\S]+bounded[\s\S]+reconciled/iu,
  );
});

test("cleanup-recovery requires the certification error route to be unreachable after cleanup", async () => {
  const template = await readRepositoryFile(
    "docs/implementation-evidence/production-observability-provider-receipt-template.md",
  );
  const cleanupSection = template
    .split("## Worker, source, and data cleanup\n", 2)[1]
    .split("## Privacy exclusions", 1)[0];

  assert.ok(cleanupSection, "observability cleanup section is missing");
  assert.match(
    cleanupSection,
    /restore the clean compatibility baseline[\s\S]+clean compatibility baseline deployed without the certification fixture/iu,
  );
  assert.match(
    cleanupSection,
    /post-cleanup[\s\S]+`\/api\/observability-certification-error`[\s\S]+unreachable[\s\S]+record only the status/iu,
  );
  assert.match(
    cleanupSection,
    /cleanup-recovery[\s\S]+cannot pass[\s\S]+route remains reachable or the reachability result is not verified/iu,
  );
  assert.doesNotMatch(
    cleanupSection,
    /Cloudflare Worker cleanup: \[[^\]]*retained/iu,
  );
  assert.match(
    template,
    /Certification-only error-route unreachability accepted: \[yes \/ no and reason\]/u,
  );
});

test("provider preparation defines the external safety envelope", async () => {
  const [preparation, plan, receipt] = await Promise.all([
    readRepositoryFile(
      "docs/implementation-evidence/2026-08-10-booking-calendly-certification-preparation.md",
    ),
    readRepositoryFile(
      "docs/superpowers/plans/2026-08-10-booking-calendly-certification.md",
    ),
    readRepositoryFile(
      "docs/implementation-evidence/booking-calendly-provider-receipt-template.md",
    ),
  ]);

  for (const document of [preparation, plan]) {
    assert.match(document, /GitHub repository administrator/iu);
    assert.match(document, /workflow dispatcher/iu);
    assert.match(document, /Calendly certification operator/iu);
    assert.match(document, /Cloudflare account administrator/iu);
    assert.match(document, /Workers Scripts Write/u);
    assert.match(document, /every 30 seconds[^.]+5 minutes/iu);
    assert.match(document, /exactly one synthetic booking/iu);
    assert.match(document, /no paid upgrade/iu);
    assert.match(document, /seven days/iu);
    assert.match(document, /credential[^.]+revoke[^.]+rotate/iu);
    assert.match(document, /rerun trigger/iu);
  }
  assert.match(receipt, /action owners and roles/iu);
  assert.match(receipt, /polling result/iu);
  assert.match(receipt, /quota and spend/iu);
  assert.match(receipt, /credential disposition/iu);
  assert.match(receipt, /rerun trigger/iu);
});

test("provider execution remains truthful and Free-compatible for a sole developer", async () => {
  const [preparation, plan, receipt] = await Promise.all([
    readRepositoryFile(
      "docs/implementation-evidence/2026-08-10-booking-calendly-certification-preparation.md",
    ),
    readRepositoryFile(
      "docs/superpowers/plans/2026-08-10-booking-calendly-certification.md",
    ),
    readRepositoryFile(
      "docs/implementation-evidence/booking-calendly-provider-receipt-template.md",
    ),
  ]);

  for (const document of [preparation, plan]) {
    assert.match(document, /sole developer/iu);
    assert.match(document, /no independent human deployment (?:approval|review)/iu);
    assert.match(document, /administrator bypass[^.]+accepted limitation/iu);
    assert.match(document, /remain usable after the trial expires without payment/iu);
    assert.match(document, /trial-only or paid/iu);
    assert.match(document, /pre-existing designated event/iu);
    assert.match(document, /preserve[s]? the event type/iu);
    assert.match(document, /designation is the only authorized event-type action/iu);
    assert.doesNotMatch(
      document,
      /authorized (?:creation or designation|creating or designating)/iu,
    );
    assert.doesNotMatch(
      document,
      /event-type (?:creation|change|disabling|deletion)[^.]+separate(?:ly)? (?:authorized|approv(?:al|ed))/iu,
    );
  }

  assert.match(
    receipt,
    /Independent human deployment reviewer: `none — sole-developer exception`/u,
  );
  assert.match(
    receipt,
    /GitHub environment required-reviewer status: `none configured`/u,
  );
  assert.match(
    receipt,
    /Administrator bypass: \[enabled and accepted for this non-production risk exception \/ unexpected state requiring stop\]/u,
  );
  assert.match(receipt, /identify `CoveMB` in every role/u);
  assert.match(receipt, /Free-compatible during and after trial/iu);
  assert.match(receipt, /pre-existing designated/iu);
  assert.match(receipt, /event-?type[^.]+preserved/iu);
  assert.doesNotMatch(receipt, /certification-created|disabled or deleted/iu);
  assert.doesNotMatch(
    receipt,
    /event-type (?:creation|change|disabling|deletion)[^.]+separate(?:ly)? (?:authorized|approv(?:al|ed))/iu,
  );
});

test("repository documentation has no broken local Markdown links", async () => {
  const markdownFiles = await listRepositoryMarkdownFiles();
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
    design,
  ] =
    await Promise.all([
      readRepositoryFile(
        "docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md",
      ),
      readRepositoryFile("docs/roadmaps/program-roadmap.md"),
      readRepositoryFile("docs/governance/review-and-contribution.md"),
      readRepositoryFile("docs/architecture/enforcement-map.md"),
      readRepositoryFile(
        "docs/superpowers/specs/2026-08-10-capability-certification-task-pair-design.md",
      ),
    ]);
  const clientReadyPhase = compactLabel("P", "2");
  const lifecyclePhase = compactLabel("P", "3");
  const appFoundationPhase = compactLabel("P", "4");
  const initialCertificationTask = namedLabel("Task", "5B");
  const currentCertificationTask = namedLabel("Task", "6B");
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
      `${escapeRegularExpression(currentCertificationTask)}[^#]+observability@0\\.2\\.0`,
      "i",
    ),
  );
  assert.match(
    clientReadySection,
    /observability@0\.2\.0[^#]+certified[^#]+cleanup-recovery[^#]+not claimed[^#]+retained-resource disposition/iu,
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
    /booking-calendly@0\.1\.0[^\n]+certified[^\n]+standards@0\.3\.0[^\n]+certified[^\n]+observability@0\.2\.0[^\n]+certified[^\n]+four unchanged subjects[^\n]+backfill-pending/i,
  );
  assert.match(
    enforcementMap,
    /descriptor version or behavior-contract digest[^\n]+material change[^\n]+new task-linked pending record/i,
  );
  assert.match(
    enforcementMap,
    /descriptor admission and transition closure pass[^\n]+all-certified closure rejects the four frozen backfills/i,
  );
  assert.match(
    design,
    /introduces no new provider-specific outcome scenario[\s\S]+existing canonical outcome boundaries remain controlling/i,
  );
  assert.match(
    design,
    /descriptor version or behavior-contract digest[\s\S]+material change[\s\S]+new task-linked pending record/i,
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
    overview,
    capabilityModel,
    enforcementMap,
    reviewProtocol,
    roadmap,
    builderCoreInstructions,
    builderCoreReadme,
    packageOwnership,
    registrySource,
    providerReceipt,
  ] = await Promise.all([
    readRepositoryFile("docs/architecture/overview.md"),
    readRepositoryFile("docs/architecture/capability-model.md"),
    readRepositoryFile("docs/architecture/enforcement-map.md"),
    readRepositoryFile("docs/governance/review-and-contribution.md"),
    readRepositoryFile("docs/roadmaps/program-roadmap.md"),
    readRepositoryFile("packages/builder-core/AGENTS.md"),
    readRepositoryFile("packages/builder-core/README.md"),
    readRepositoryFile("docs/architecture/package-ownership.md"),
    readRepositoryFile("certifications/capabilities.json"),
    readRepositoryFile(
      "docs/implementation-evidence/2026-08-10-booking-calendly-provider-receipt.md",
    ),
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
    "deployed-application",
    "fresh-scaffold",
  ]);
  assert.deepEqual(
    observabilityRecord.evidence.map(({ kind }) => kind),
    ["deployed-application", "fresh-scaffold"],
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
    providerReceipt,
    /Certification receipt status:\*\* `complete`/u,
  );
  assert.match(
    providerReceipt,
    /Certification reviewer decision:\*\* `accepted`/u,
  );
  assert.match(
    providerReceipt,
    /Passed certification outcomes:\*\* `cleanup-recovery, deployed-application, provider-confirmed`/u,
  );
  assert.match(providerReceipt, /HTTP `404`/u);
  assert.match(providerReceipt, /pre-existing designated event; preserved/u);
  assert.match(providerReceipt, /no WCAG conformance/iu);
  assert.match(providerReceipt, /^## Privacy exclusions$/mu);
  assert.match(
    providerReceipt,
    /invitee[^.]+address[^.]+omitted[\s\S]+confirmation[^.]+content[^.]+not copied or retained[\s\S]+provider[^.]+identifiers[^.]+not copied or retained/iu,
  );
  assert.doesNotMatch(providerReceipt, /:\s*\[[^\]\n]+\]\s*$/mu);
  assert.doesNotMatch(
    providerReceipt,
    /(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\bcf(?:at|ut)_[A-Za-z0-9_-]+\b|\bgh[pousr]_[A-Za-z0-9_]+\b|\bgithub_pat_[A-Za-z0-9_]+\b)/iu,
  );
  const privateCalendlyUrlPattern =
    /https:\/\/(?:www\.)?calendly\.com\/(?!help(?:\/|\b))[^\s)`]+/iu;
  assert.match(
    "https://calendly.com/synthetic-host/private-meeting",
    privateCalendlyUrlPattern,
  );
  assert.doesNotMatch(
    "https://calendly.com/help/how-to-cancel-a-meeting",
    privateCalendlyUrlPattern,
  );
  assert.doesNotMatch(providerReceipt, privateCalendlyUrlPattern);
  assert.match(
    enforcementMap,
    /descriptor admission and transition closure pass[^\n]+all-certified closure rejects the four frozen backfills/iu,
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
  const [
    reviewProtocol,
    sourcePlan,
    roadmap,
    implementationPlan,
    certificationPlan,
    planAReviewPacket,
    protectedWorkflowPlan,
  ] =
    await Promise.all([
      readRepositoryFile("docs/governance/review-and-contribution.md"),
      readRepositoryFile(
        "docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md",
      ),
      readRepositoryFile("docs/roadmaps/program-roadmap.md"),
      readRepositoryFile(
        "docs/superpowers/plans/2026-08-10-generated-unit-component-testing.md",
      ),
      readRepositoryFile(
        "docs/superpowers/plans/2026-08-10-generated-unit-component-testing-certification.md",
      ),
      readRepositoryFile(
        "docs/review-packets/2026-08-12-automatic-ci-efficiency-security.md",
      ),
      readRepositoryFile(
        "docs/superpowers/plans/2026-08-12-protected-workflow-hardening.md",
      ),
    ]);
  const implementationTask = namedLabel("Task", "6C");
  const implementationPredecessor = namedLabel("Task", "6");
  const independentStream = namedLabel("Task", "6B");
  const certificationTask = namedLabel("Task", "6D");
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

  assert.match(
    protectedWorkflowPlan,
    /Acceptance artifact:[^\n]+2026-08-12-automatic-ci-efficiency-security\.md[\s\S]+explicit verified-final-diff approval and an exact accepted revision/iu,
  );
  assert.match(
    planAReviewPacket,
    /\*\*Verified-final-diff approval:\*\* `approved`/u,
  );
  assert.match(
    planAReviewPacket,
    /\*\*Accepted Plan A revision:\*\* `368b9491fd2f813f83f1e456823d8c7546f6762c`/u,
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
    certificationPlan,
    new RegExp(
      `${escapeRegularExpression(certificationTask)} was implemented[^.]+and squash-integrated as \`main@c9294e9dc59d4b7bafed406846af3b43a10733d3\`[\\s\\S]+Accepted repair \`ee1e1df10fa2be2f09333efecd86de7f7a131d49\`[\\s\\S]+Plan A is rebased onto that accepted revision`,
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

  assert.match(
    implementationPlan,
    new RegExp(
      `\\*\\*Direct predecessor under the approved independent-work exception:\\*\\* ${portfolioPhase} ${escapeRegularExpression(implementationPredecessor)} production-observability implementation`,
      "u",
    ),
  );
  assert.match(
    implementationPlan,
    /approved exact committed comparison[^.]+45b57d2dc265ef6ba9ac805d7352a01db5f1081d[^.]+ancestor of `HEAD`/iu,
  );
  assert.match(
    implementationPlan,
    /pnpm run check:capability-certification/u,
  );
  assert.match(
    implementationPlan,
    /`observability@0\.2\.0` record[^.]+`pending` subject/iu,
  );
  assert.match(
    implementationPlan,
    /unexpected observability status[^.]+hard stop/iu,
  );

  assert.match(
    certificationPlan,
    new RegExp(
      `\\*\\*Direct predecessor:\\*\\* ${portfolioPhase} ${escapeRegularExpression(implementationTask)} generated unit and component testing implementation`,
      "u",
    ),
  );
  assert.match(
    certificationPlan,
    /approved exact committed comparison[^.]+merge-base --is-ancestor[^.]+ HEAD/iu,
  );
  assert.match(
    certificationPlan,
    /pnpm run check:capability-certification/u,
  );
  assert.match(
    certificationPlan,
    /admission[^.]+pass[\s\S]+legacy-backfill-exempt[^.]+reject[^.]+observability[\s\S]+all-certified[^.]+reject[^.]+four[^.]+backfill/iu,
  );
  assert.match(
    certificationPlan,
    new RegExp(
      "pending `standards` subject[^.]+" +
        escapeRegularExpression(certificationTask) +
        " plan",
      "iu",
    ),
  );
});

test("already-certified standards renewal uses one descendant evidence revision", async () => {
  const certificationPlan = await readRepositoryFile(
    "docs/superpowers/plans/2026-08-10-generated-unit-component-testing-certification.md",
  );
  const renewalBoundary = certificationPlan
    .split("### Plan A reconciliation boundary\n", 2)[1]
    ?.split("\n## Certification outcomes", 1)[0];
  const originalPreflight = namedLabel("Task", "1");
  const certificationTask = namedLabel("Task", "6D");

  assert.equal(typeof renewalBoundary, "string");
  assert.match(
    renewalBoundary,
    /already-certified `standards@0\.3\.0` subject/iu,
  );
  assert.match(
    renewalBoundary,
    /This is evidence renewal for the already-certified `standards@0\.3\.0` subject, not a second pending-to-certified transition/iu,
  );
  assert.match(
    renewalBoundary,
    /single post-Plan A evidence revision[^.]+all eight outcomes/iu,
  );
  assert.equal(
    renewalBoundary.includes(
      `do not reapply ${originalPreflight}'s original pending-subject prerequisite`,
    ),
    true,
  );
  assert.match(
    renewalBoundary,
    /Rerun all eight on that exact descendant rather than carrying an earlier outcome forward/iu,
  );
  assert.match(
    renewalBoundary,
    /Preserve the certified registry status throughout this evidence renewal/iu,
  );
  assert.equal(
    renewalBoundary.includes(
      `may not modify the stopped ${certificationTask} branch, its receipt, registry entry, evidence, or certification status`,
    ),
    true,
  );
  for (const outcome of [
    "fresh-scaffold",
    "unit-tests",
    "component-tests",
    "state-agreement",
    "generated-project-builds",
    "browser-regression",
    "retained-fixture-matrix",
    "ci-contract",
  ]) {
    assert.equal(renewalBoundary.includes(`\`${outcome}\``), true, outcome);
  }
  assert.equal(
    renewalBoundary.includes(
      `resume at this plan's ${originalPreflight} preflight`,
    ),
    false,
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
    /standards@0\.3\.0[^\n]+\[renewed eight-outcome receipt\]\(docs\/implementation-evidence\/generated-unit-component-testing-certification-receipt\.json\)[^\n]+d7c63b0aaa9bebd56c075f16f1e5d86519853698/iu,
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
    /observability certification MR is pushed[^.]+merge, package publication, another deployment, provider mutation, cleanup, and production remain separate/iu,
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
    /The executable builder currently has seven capability descriptors.*retains exact `portfolio`, `portfolio-calendly`, and `site` fixtures.*all three fixtures are certified locally.*recurring Calendly browser proof.*separate exact-revision provider receipt certifies.*protected-staging.*confirmation.*cancellation.*cleanup/isu,
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
