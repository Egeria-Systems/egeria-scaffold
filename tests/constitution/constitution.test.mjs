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
import { exactSemanticVersionPattern } from "../helpers/semantic-version.mjs";

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
  /(?:\b(?:pnpm|npm|yarn)\b[^\n]*(?:\bbuild|\btest)(?=[:\s]|$)|\bopennextjs-cloudflare\b[^\n]*\bbuild\b)/iu;

test("credential-bearing workflow steps forbid package and direct OpenNext builds", () => {
  for (const command of [
    "pnpm run build",
    "npm test",
    "yarn build:cloudflare",
    "opennextjs-cloudflare build --skipNextBuild",
  ]) {
    assert.match(command, credentialBoundPackageCommandPattern);
  }
});

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

test("generic increment requests preserve the complete delivery lifecycle", async () => {
  const [rootInstructions, reviewProtocol, sourcePlan] = await Promise.all([
    readRepositoryFile("AGENTS.md"),
    readRepositoryFile("docs/governance/review-and-contribution.md"),
    readRepositoryFile(
      "docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md",
    ),
  ]);
  const preparationGate = namedLabel("Gate", "1");
  const planGate = namedLabel("Gate", "2");
  const finalDiffGate = namedLabel("Gate", "3");

  assert.match(reviewProtocol, /^## Increment request routing$/mu);
  const routingSection = reviewProtocol
    .split("## Increment request routing\n", 2)[1]
    .split(`## ${preparationGate}: preparation evidence`, 1)[0];
  assert.ok(routingSection, "increment request routing is missing");
  assert.match(
    routingSection,
    /implement the next logical increment[\s\S]+start the next increment/iu,
  );
  assert.match(
    routingSection,
    new RegExp(
      `${escapeRegularExpression(preparationGate)}[\\s\\S]+${escapeRegularExpression(planGate)}[\\s\\S]+implementation[\\s\\S]+@ponytail-review[\\s\\S]+independent review[\\s\\S]+${escapeRegularExpression(finalDiffGate)}`,
      "iu",
    ),
  );
  assert.match(
    routingSection,
    new RegExp(
      `generic[^.]+request[^.]+(?:does not|is not)[^.]+approval[^.]+${escapeRegularExpression(planGate)}[^.]+plan`,
      "iu",
    ),
  );
  assert.match(
    routingSection,
    /generic start request[\s\S]+not approval[\s\S]+later authority gate[\s\S]+commit[\s\S]+push[\s\S]+pull-request/iu,
  );

  const lifecycleHeadings = [
    "## Test-driven implementation",
    "## Ponytail simplification gate",
    "## Independent review",
    "## Final verification and packet",
    `## ${finalDiffGate}: verified-final-diff approval`,
  ];
  const lifecycleHeadingIndexes = lifecycleHeadings.map((heading) =>
    reviewProtocol.indexOf(heading),
  );
  assert.ok(
    lifecycleHeadingIndexes.every((index) => index >= 0),
    "a required lifecycle heading is missing",
  );
  assert.deepEqual(
    lifecycleHeadingIndexes,
    lifecycleHeadingIndexes.toSorted((left, right) => left - right),
    "the Ponytail pass must precede independent review and final approval",
  );

  const ponytailSection = reviewProtocol
    .split("## Ponytail simplification gate\n", 2)[1]
    .split("## Independent review", 1)[0];
  assert.ok(ponytailSection, "Ponytail simplification gate is missing");
  assert.match(ponytailSection, /@ponytail-review/u);
  assert.match(ponytailSection, /exact frozen comparison/iu);
  assert.match(ponytailSection, /read-only/iu);
  assert.match(
    ponytailSection,
    /approval of that plan explicitly authorizes[\s\S]+one read-only invocation[\s\S]+each frozen comparison/iu,
  );
  assert.match(
    ponytailSection,
    /evidence, not authority[\s\S]+validat/iu,
  );
  assert.match(
    ponytailSection,
    /separate explicit (?:request|approval)[\s\S]+repair/iu,
  );
  assert.match(
    ponytailSection,
    /candidate changes[\s\S]+rerun[\s\S]+@ponytail-review/iu,
  );
  assert.match(
    ponytailSection,
    /unavailable|fails/iu,
  );
  assert.match(
    ponytailSection,
    /plugin version[\s\S]+comparison[\s\S]+dispositions/iu,
  );

  const independentReviewSection = reviewProtocol
    .split("## Independent review\n", 2)[1]
    .split("## Final verification and packet", 1)[0];
  assert.ok(independentReviewSection, "independent review is missing");
  for (const scope of [
    "Requirements reviewer",
    "Architecture and anti-overengineering reviewer",
    "Test-evidence reviewer",
  ]) {
    assert.match(independentReviewSection, new RegExp(scope, "u"));
  }
  assert.match(
    independentReviewSection,
    /Ponytail[\s\S]+does not replace[\s\S]+three/iu,
  );

  assert.match(
    rootInstructions,
    /implement the next logical increment[\s\S]+start the next increment[\s\S]+review and contribution protocol/iu,
  );
  assert.match(
    rootInstructions,
    new RegExp(
      `${escapeRegularExpression(preparationGate)}[\\s\\S]+${escapeRegularExpression(planGate)}[\\s\\S]+Ponytail[\\s\\S]+independent review[\\s\\S]+${escapeRegularExpression(finalDiffGate)}`,
      "iu",
    ),
  );

  const agentGovernanceSection = sourcePlan
    .split("## 20. AI-agent governance\n", 2)[1]
    .split("## 21. Gradual implementation roadmap", 1)[0];
  assert.ok(agentGovernanceSection, "AI-agent governance is missing");
  const governanceMilestones = [
    "test-driven development",
    "@ponytail-review",
    "independent non-overlapping reviewers",
    "mandatory pause for user approval",
  ].map((milestone) => agentGovernanceSection.indexOf(milestone));
  assert.ok(
    governanceMilestones.every((index) => index >= 0),
    "a required per-increment governance milestone is missing",
  );
  assert.deepEqual(
    governanceMilestones,
    governanceMilestones.toSorted((left, right) => left - right),
    "the source plan must place Ponytail before independent review",
  );
});

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
    manifest.scripts["test:synthetic-client-journey"],
    "node --test tests/client-journey/*.test.mjs",
  );
  for (const aggregate of ["test", "verify:builder-kernel"]) {
    assert.equal(
      manifest.scripts[aggregate]
        .split(" && ")
        .filter(
          (command) => command === "pnpm run test:synthetic-client-journey",
        ).length,
      1,
      `${aggregate} must invoke the synthetic client journey exactly once`,
    );
  }
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
  assert.deepEqual(workflow.jobs["generated-projects"].container, {
    image:
      "mcr.microsoft.com/playwright:v1.62.1-noble@sha256:dcc5531e97840b9b5e794f2814476b21571c5124a3fca2267d73041f56e7580e",
    options: "--shm-size=1g",
  });
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
    "pnpm run verify:generated-visuals",
  ]) {
    assert.match(
      commandsByJob["generated-projects"],
      new RegExp(escapeRegularExpression(command), "u"),
    );
  }
  assert.doesNotMatch(
    commandsByJob["generated-projects"],
    /verify:generated-skeletons|--update-snapshots/u,
  );
  assert.equal(
    workflow.jobs["generated-projects"].steps.filter(
      ({ run }) => run === "pnpm run verify:generated-visuals",
    ).length,
    1,
  );
  const generatedProjectSteps = workflow.jobs["generated-projects"].steps;
  const visualVerificationIndex = generatedProjectSteps.findIndex(
    ({ run }) => run === "pnpm run verify:generated-visuals",
  );
  const visualArtifactUploadIndex = generatedProjectSteps.findIndex(
    ({ name }) => name === "Upload generated visual failure artifacts",
  );
  assert.ok(visualArtifactUploadIndex > visualVerificationIndex);
  assert.deepEqual(generatedProjectSteps[visualArtifactUploadIndex], {
    name: "Upload generated visual failure artifacts",
    if: "failure()",
    uses: "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a",
    with: {
      name: "generated-visual-failure-artifacts",
      path: "generated-visual-artifacts/",
      "if-no-files-found": "ignore",
      "include-hidden-files": false,
      "retention-days": 7,
    },
  });
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
          ({ run }) => run !== "pnpm run verify:generated-visuals",
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
  assert.equal(
    rootManifest.scripts["verify:generated-visuals"],
    "node scripts/verify-generated-skeletons.mjs --visual",
  );
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
    'packages:\n  - "apps/*"\n  - "packages/*"\n  - "proofs/*"\n\npmOnFail: error\n\nminimumReleaseAge: 1440\n\noverrides:\n  "miniflare>undici": 7.29.0\n  "qs@": 6.16.0\n\nallowBuilds:\n  "@parcel/watcher": true\n  "@swc/core": true\n  esbuild: true\n  unrs-resolver: true\n  workerd: true\n',
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
    "Accepted evidence snapshot",
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

test("exact semantic versions reject zero-padded numeric prereleases", () => {
  assert.doesNotMatch("1.2.3-01", exactSemanticVersionPattern);
  assert.match("1.2.3-alpha.1", exactSemanticVersionPattern);
  assert.match("1.2.3-01alpha", exactSemanticVersionPattern);
});

test("the compatibility proof manifests use exact semantic versions", async () => {
  const [rootSource, proofSource] = await Promise.all([
    readRepositoryFile("package.json"),
    readRepositoryFile("proofs/nextjs-cloudflare/package.json"),
  ]);
  const rootManifest = JSON.parse(rootSource);
  const proofManifest = JSON.parse(proofSource);

  assert.equal(
    proofManifest.dependencies.react,
    proofManifest.dependencies["react-dom"],
  );
  const executableVersions = [
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

  for (const [surface, version] of executableVersions) {
    assert.equal(typeof version, "string", surface);
    assert.match(version, exactSemanticVersionPattern, surface);
  }
});

test("the compatibility package matrix is bound to accepted evidence", async () => {
  const compatibility = await readRepositoryFile(
    "docs/compatibility/nextjs-cloudflare.md",
  );
  const matrixBody = compatibility
    .split("## Accepted evidence snapshot\n\n", 2)[1]
    ?.split("\n\n", 1)[0];
  assert.equal(typeof matrixBody, "string");
  const evidenceRows = matrixBody
    .split("\n")
    .slice(2)
    .map((row) => row.split("|").slice(1, -1).map((cell) => cell.trim()));
  const evidenceSnapshot = new Map(evidenceRows);
  assert.equal(
    evidenceSnapshot.size,
    evidenceRows.length,
    "accepted evidence surfaces must be unique",
  );
  const expectedEvidenceSnapshot = new Map([
    ["Evidence date", "`2026-08-13`"],
    ["Repository quality run", "`31742910235`"],
    [
      "Implementation commit",
      "`05fc743e5e24801d6e16e2ed89a8962397272238`",
    ],
    [
      "`pnpm-lock.yaml` SHA-256",
      "`71444e493ea0d4f2c2011fddcf2dd8b9b339335afafd56dd765e0c50878c126d`",
    ],
    ["Node.js", "`22.23.2`"],
    ["pnpm", "`11.20.0`"],
    ["Next.js", "`16.3.0`"],
    ["React / React DOM", "`19.2.8`"],
    ["OpenNext Cloudflare", "`1.20.2`"],
    ["Wrangler", "`4.120.1`"],
    ["TypeScript", "`6.0.3`"],
    ["ESLint", "`9.39.5`"],
    ["Next ESLint config", "`16.3.0`"],
    ["typescript-eslint", "`8.66.0`"],
    ["Vitest", "`4.1.10`"],
    ["Playwright", "`1.62.1`"],
    ["axe Playwright adapter", "`4.12.1`"],
    ["Cloudflare compatibility date", "`2026-08-04`"],
  ]);

  assert.deepEqual(evidenceSnapshot, expectedEvidenceSnapshot);
  for (const surface of [
    "Node.js",
    "pnpm",
    "Next.js",
    "React / React DOM",
    "OpenNext Cloudflare",
    "Wrangler",
    "TypeScript",
    "ESLint",
    "Next ESLint config",
    "typescript-eslint",
    "Vitest",
    "Playwright",
    "axe Playwright adapter",
  ]) {
    const cell = evidenceSnapshot.get(surface) ?? "";
    assert.match(cell, /^`[^`]+`$/u, surface);
    assert.match(cell.slice(1, -1), exactSemanticVersionPattern, surface);
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
    /builder kernel has received verified-final-diff approval.*client-ready portfolio stage is completed through an unnumbered closure amendment/iu,
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

test("the synthetic client journey workflow is manual, protected, and content-safe", async () => {
  const source = await readRepositoryFile(
    ".github/workflows/synthetic-client-journey.yml",
  );
  const workflow = parse(source);

  assert.deepEqual(Object.keys(workflow.on), ["workflow_dispatch"]);
  assert.deepEqual(workflow.on.workflow_dispatch.inputs, {
    expected_revision: {
      description:
        "Exact accepted main revision approved for the synthetic journey",
      required: true,
      type: "string",
    },
    cloudflare_web_analytics_site_token: {
      description: "Operator-owned test Web Analytics site token",
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
  const stepNames = job.steps.map(({ name }) => name);
  assert.ok(
    stepNames.indexOf("Record pristine generated baseline") >
      stepNames.indexOf("Generate synthetic client project"),
  );
  assert.ok(
    stepNames.indexOf("Record pristine generated baseline") <
      stepNames.indexOf("Apply synthetic client packet"),
  );
  assert.equal(
    stepsByName["Record pristine generated baseline"].run,
    `${[
      "git init -b main \"$JOURNEY_ROOT\"",
      "git -C \"$JOURNEY_ROOT\" config user.name \"Synthetic Journey Workflow\"",
      "git -C \"$JOURNEY_ROOT\" config user.email \"synthetic-journey@example.com\"",
      "git -C \"$JOURNEY_ROOT\" add .",
      "git -C \"$JOURNEY_ROOT\" commit -m \"Record pristine synthetic scaffold\"",
    ].join("\n")}\n`,
  );
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
  assert.match(
    stepsByName["Validate and mask test site token"].run,
    /^echo "::add-mask::\$CLOUDFLARE_WEB_ANALYTICS_SITE_TOKEN"/u,
  );
  assert.match(
    stepsByName["Validate and mask test site token"].run,
    /\^\[0-9a-f\]\{32\}\$/u,
  );
  assert.match(
    stepsByName["Verify approved predecessor"].run,
    /git merge-base --is-ancestor af3e927e542d322edd1b8200507de43276d02375 "\$GITHUB_SHA"/u,
  );
  assert.equal(
    stepsByName["Install builder dependencies"].run,
    "pnpm install --frozen-lockfile",
  );
  assert.match(source, /pnpm run check:capability-certification/u);
  assert.match(
    source,
    /node scripts\/check-capability-certification\.mjs --closure all-certified/u,
  );
  assert.match(source, /pnpm run build:builder/u);
  const generationCommand = stepsByName["Generate synthetic client project"].run
    .split("\n")
    .map((line) => line.trim().replace(/ \\$/u, ""))
    .join(" ");
  assert.match(
    generationCommand,
    /node apps\/cli\/dist\/index\.js create --profile site --name harbour-light-studio --display-name "Harbour Light Studio" --directory "\$JOURNEY_ROOT" --multilingual --cloudflare-web-analytics-token "\$CLOUDFLARE_WEB_ANALYTICS_SITE_TOKEN"/u,
  );
  assert.match(
    stepsByName["Apply synthetic client packet"].run,
    /node scripts\/apply-synthetic-client-packet\.mjs --project-root "\$JOURNEY_ROOT"/u,
  );
  assert.match(source, /apps\/cli\/dist\/index\.js infer/u);
  assert.match(source, /apps\/cli\/dist\/index\.js doctor/u);
  assert.match(source, /apps\/cli\/dist\/index\.js diff/u);
  for (const code of [
    "INFER_STATE_INVALID",
    "DOCTOR_HEALTH_INVALID",
    "DIFF_STATE_INVALID",
  ]) {
    assert.match(source, new RegExp(code, "u"));
  }
  for (const command of [
    "pnpm --dir \"$JOURNEY_ROOT\" install --frozen-lockfile",
    "pnpm --dir \"$JOURNEY_ROOT\" peers check",
    "pnpm --dir \"$JOURNEY_ROOT\" audit --audit-level moderate",
    "pnpm --dir \"$JOURNEY_ROOT\" audit signatures",
    "pnpm --dir \"$JOURNEY_ROOT\" run lint",
    "pnpm --dir \"$JOURNEY_ROOT/apps/web\" run cf-typegen",
    "pnpm --dir \"$JOURNEY_ROOT\" run typecheck",
    "pnpm --dir \"$JOURNEY_ROOT\" run test:unit",
    "pnpm --dir \"$JOURNEY_ROOT\" run test:component",
    "pnpm --dir \"$JOURNEY_ROOT\" run build",
    "pnpm --dir \"$JOURNEY_ROOT/apps/web\" exec opennextjs-cloudflare build --skipNextBuild",
    "pnpm --dir \"$JOURNEY_ROOT/apps/web\" run test:e2e:dev",
    "pnpm --dir \"$JOURNEY_ROOT/apps/web\" run test:e2e:preview",
  ]) {
    assert.match(source, new RegExp(command.replaceAll("$", "\\$"), "u"));
  }
  assert.match(
    stepsByName["Deploy synthetic client Worker"].run,
    /opennextjs-cloudflare deploy --name test-deploy/u,
  );
  assert.doesNotMatch(
    stepsByName["Deploy synthetic client Worker"].run,
    credentialBoundPackageCommandPattern,
  );
  assert.deepEqual(stepsByName["Deploy synthetic client Worker"].env, {
    CLOUDFLARE_ACCOUNT_ID: "${{ secrets.CLOUDFLARE_ACCOUNT_ID }}",
    CLOUDFLARE_API_TOKEN: "${{ secrets.CLOUDFLARE_API_TOKEN }}",
    JOURNEY_ROOT: "${{ runner.temp }}/synthetic-client-journey/project",
  });
  assert.match(
    stepsByName["Test deployed synthetic client journey"].run,
    /synthetic-client-deployed\.spec\.ts/u,
  );
  assert.match(
    stepsByName["Test deployed synthetic client journey"].run,
    /test:e2e:deployed/u,
  );
  assert.equal(
    isPinnedGitHubActionReference(
      stepsByName["Upload content-safe journey receipts"].uses,
      "actions/upload-artifact",
    ),
    true,
  );
  assert.equal(
    stepsByName["Upload content-safe journey receipts"].with[
      "retention-days"
    ],
    7,
  );
  assert.match(source, /4096/u);
  assert.match(source, /wc -l/u);
  assert.match(
    stepsByName["Validate content-safe receipts"].run,
    /cloudflareScriptRequestObserved !== true/u,
  );
  assert.match(
    stepsByName["Validate content-safe receipts"].run,
    /noProviderRequestAfterWithdrawal !== true/u,
  );
  assert.match(
    stepsByName["Validate content-safe receipts"].run,
    /automatedAxeViolations !== 0/u,
  );

  assertWorkflowSecretBoundary(workflow, [
    {
      path: 'jobs.verify-and-deploy.steps["Deploy synthetic client Worker"].env.CLOUDFLARE_ACCOUNT_ID',
      reference: "secrets.CLOUDFLARE_ACCOUNT_ID",
    },
    {
      path: 'jobs.verify-and-deploy.steps["Deploy synthetic client Worker"].env.CLOUDFLARE_API_TOKEN',
      reference: "secrets.CLOUDFLARE_API_TOKEN",
    },
  ]);
  assert.deepEqual(
    [...source.matchAll(/vars\.([A-Z0-9_]+)/gu)].map(([, name]) => name),
    ["DEPLOY_URL", "DEPLOY_URL"],
  );
  assert.doesNotMatch(source, /api\.cloudflare\.com/u);
  assert.doesNotMatch(source, /CLOUDFLARE_WEB_ANALYTICS_API_TOKEN/u);
  assert.doesNotMatch(source, /^  (?:pull_request|push|schedule):/mu);
});

test("stateless manual deployments share one serialized protected deployment boundary", async () => {
  const [
    compatibilitySource,
    calendlySource,
    observabilitySource,
    syntheticClientSource,
    policy,
    compatibilityRecord,
  ] = await Promise.all([
    readRepositoryFile(".github/workflows/compatibility-proof.yml"),
    readRepositoryFile(".github/workflows/booking-calendly-certification.yml"),
    readRepositoryFile(
      ".github/workflows/observability-error-diagnostics-certification.yml",
    ),
    readRepositoryFile(".github/workflows/synthetic-client-journey.yml"),
    readRepositoryFile("docs/governance/shared-test-deployment.md"),
    readRepositoryFile("docs/compatibility/nextjs-cloudflare.md"),
  ]);

  for (const source of [
    compatibilitySource,
    calendlySource,
    observabilitySource,
    syntheticClientSource,
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
    syntheticClientSource,
    /opennextjs-cloudflare deploy --name test-deploy/u,
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
  assert.match(
    policy,
    /synthetic client journey[\s\S]+pre-existing operator-owned[\s\S]+token/iu,
  );
  assert.match(
    policy,
    /bounded synthetic measurement traffic[\s\S]+provider-account retention/iu,
  );
  assert.match(policy, /no control-plane[\s\S]+mutation/iu);
  assert.match(
    policy,
    /exclusive lease[\s\S]+compatibility[\s\S]+restore[\s\S]+baseline/iu,
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
      description: "Exact reviewed revision approved for certification",
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
  const certificationOwner =
    "${{ runner.temp }}/booking-calendly-certification";
  const certificationRoot = `${certificationOwner}/project`;
  assert.deepEqual(
    stepsByName["Create fresh-added deployment candidate"].env,
    {
      CALENDLY_URL: "${{ inputs.calendly_url }}",
      CERTIFICATION_OWNER: certificationOwner,
    },
  );
  assert.equal(stepsByName["Build builder"].run, "pnpm run build:builder");
  assert.equal(
    stepsByName["Test compiled lifecycle behavior"].run,
    "pnpm run test:cli",
  );
  assert.match(
    stepsByName["Create fresh-added deployment candidate"].run,
    /node scripts\/certify-booking-calendly\.mjs --calendly-url "\$CALENDLY_URL" --output-root "\$CERTIFICATION_OWNER"/u,
  );
  assert.doesNotMatch(
    stepsByName["Create fresh-added deployment candidate"].run,
    /pnpm run verify:booking-calendly-certification/u,
  );
  assert.doesNotMatch(
    stepsByName["Create fresh-added deployment candidate"].run,
    /apps\/cli\/dist\/index\.js create/u,
  );
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
  const candidateIndex = job.steps.findIndex(
    ({ name }) => name === "Create fresh-added deployment candidate",
  );
  const builderBuildIndex = job.steps.findIndex(
    ({ name }) => name === "Build builder",
  );
  const lifecycleTestIndex = job.steps.findIndex(
    ({ name }) => name === "Test compiled lifecycle behavior",
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
      revisionIndex < builderBuildIndex &&
      builderBuildIndex < lifecycleTestIndex &&
      lifecycleTestIndex < candidateIndex &&
      candidateIndex < unitTestIndex &&
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

  assert.match(
    stepsByName["Create fresh-added deployment candidate"].run,
    /booking-calendly-local-receipt\.json/u,
  );
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
  ["0012-purpose-based-analytics-consent.md", "ADR-0012"],
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
    /INV-CAPABILITY-CERTIFICATION[^\n]+content-safe tracked receipts[^\n]+exact ignore exceptions/i,
  );
  assert.match(
    enforcementMap,
    /INV-CAPABILITY-CERTIFICATION[^\n]+check:private-capability-certification[^\n]+private-workflow-artifacts\.test\.mjs/i,
  );
  assert.match(
    enforcementMap,
    /documentation contract[^\n]+does not prove[^\n]+runtime or provider result/i,
  );
  assert.match(
    enforcementMap,
    /standards@0\.4\.0[^\n]+certified[^\n]+d7f9dac6e25d5dde32015968d0912b45e73644e7[^\n]+booking-calendly@0\.1\.0[^\n]+certified[^\n]+b30e10b86b9ac9ef8dfdf1e8fa8e4077e2abe059[^\n]+f9bd78f115c2118afd6dcc17ce49b2bfe34ca10d[^\n]+observability@0\.3\.0[^\n]+deployment-cloudflare@0\.3\.0[^\n]+certified[^\n]+content-files@0\.4\.0[^\n]+certified[^\n]+f03b9f624c370728f678924ce34e5287558d2a87[^\n]+section-composition@0\.3\.0[^\n]+certified[^\n]+f74459c8833833186bb651c116ed524e51044677[^\n]+site-routing@0\.3\.0[^\n]+certified[^\n]+77cea944513e521939bf4de088048f67acdfbc3c/i,
  );
  assert.match(
    enforcementMap,
    /descriptor version or behavior-contract digest[^\n]+material change[^\n]+new task-linked pending record/i,
  );
  assert.match(
    enforcementMap,
    /analytics@0\.1\.0[^\n]+certified[^\n]+a97341ea628210b6fa713fb12461084f20c3f8da[^\n]+descriptor admission[^\n]+all-certified[^\n]+pass/i,
  );
  assert.doesNotMatch(enforcementMap, /legacy-backfill-exempt/iu);
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
  const referenceHardeningPhase = compactLabel("P", "3", "C");
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
    .split(
      `#### ${referenceHardeningPhase} — Automated removal-reference hardening`,
      1,
    )[0];
  const roadmapExpansion = programRoadmap
    .split(`## ${clientExpansionPhase} — Client-required public-site expansion\n`, 2)[1]
    .split(
      `## ${referenceHardeningPhase} — Automated removal-reference hardening`,
      1,
    )[0];

  assert.ok(roadmapPortfolio, "portfolio baseline roadmap section is missing");
  assert.doesNotMatch(roadmapPortfolio, /urgent first-client milestone/iu);
  assert.match(
    roadmapExpansion,
    /first client-ready milestone[\s\S]+representative synthetic client journey/iu,
  );
  assert.match(
    roadmapExpansion,
    /\*\*Stop gate:\*\*[\s\S]+production `site`[\s\S]+independent multilingual and analytics[\s\S]+combined representative synthetic client journey[\s\S]+retained migration fixture[\s\S]+before app-foundation/iu,
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
      /representative synthetic client journey[\s\S]+derived from real engagement needs[\s\S]+generated[\s\S]+retained as migration evidence/iu,
    );
    assert.match(section, /operator-owned non-production accounts/iu);
    assert.match(
      section,
      /no actual client identity[\s\S]+content[\s\S]+approval[\s\S]+domain[\s\S]+account/iu,
    );
    assert.match(
      section,
      /does not establish[\s\S]+production deployment[\s\S]+provider certification[\s\S]+French certification[\s\S]+WCAG conformance[\s\S]+legal or privacy compliance[\s\S]+production readiness/iu,
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

  const closureStatusPattern = new RegExp(
    escapeRegularExpression(
      `${clientExpansionPhase} closure is approved and closed`,
    ),
    "iu",
  );
  const successorEligibilityPattern = new RegExp(
    escapeRegularExpression(
      `${referenceHardeningPhase} is the next eligible phase, but this closure does not authorize ${referenceHardeningPhase} planning or implementation`,
    ),
    "iu",
  );

  assert.doesNotMatch(
    `${clientExpansionPhase} closure is not approved and not closed`,
    closureStatusPattern,
  );
  assert.doesNotMatch(
    `${referenceHardeningPhase} is the next eligible phase, but this closure does not authorize deployment; ${referenceHardeningPhase} planning and implementation are authorized.`,
    successorEligibilityPattern,
  );

  for (const statusConsumer of [sourcePlan, programRoadmap, overview]) {
    assert.match(statusConsumer, closureStatusPattern);
    assert.match(statusConsumer, successorEligibilityPattern);
  }

  assert.doesNotMatch(
    overview,
    new RegExp(
      `${escapeRegularExpression(clientExpansionPhase)} is the next eligible phase`,
      "iu",
    ),
  );

  assert.match(
    programRoadmap,
    /main@f7caa6ef0b8103c051c99eb6599debf969b8489c[^\n]+87d8be28fa2d611a07b5eb7c32712f0245d12b87/iu,
  );
  assert.match(
    programRoadmap,
    /site-routing@0\.4\.0[^\n]+6034d7330af912d1a1b9bcff3323ed360ebee2d0[^\n]+multilingual@0\.1\.0[^\n]+96b587a254cf6fc859867d6fc66c7e0c900c4cfd[^\n]+analytics@0\.1\.0[^\n]+a97341ea628210b6fa713fb12461084f20c3f8da/iu,
  );
  assert.match(
    programRoadmap,
    /9cd386ee637cad85162917b4f4a91e6c878fb75e[^\n]+e116adbff366be2bf674846f231e26a6e00d132f[^\n]+33456304959[^\n]+33456850947/iu,
  );
  assert.match(
    programRoadmap,
    /d0ad7eaaa9c7198a8a479540bdd8b4dcf4dee113[^\n]+3583e88902c8b2328da90b77e0a4edd112cdfd23/iu,
  );
  assert.match(
    programRoadmap,
    /33588604465[^\n]+f7caa6ef0b8103c051c99eb6599debf969b8489c[^\n]+passed every applicable job/iu,
  );
  assert.match(
    programRoadmap,
    /synthetic[^\n]+does not establish[^\n]+production readiness[^\n]+WCAG conformance/iu,
  );
});

test("multilingual implementation and certification remain exact and claim-limited", async () => {
  const [
    sourcePlan,
    programRoadmap,
    overview,
    capabilityModel,
    enforcementMap,
    packageOwnership,
    cliInstructions,
    builderCoreInstructions,
  ] = await Promise.all([
    readRepositoryFile(
      "docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md",
    ),
    readRepositoryFile("docs/roadmaps/program-roadmap.md"),
    readRepositoryFile("docs/architecture/overview.md"),
    readRepositoryFile("docs/architecture/capability-model.md"),
    readRepositoryFile("docs/architecture/enforcement-map.md"),
    readRepositoryFile("docs/architecture/package-ownership.md"),
    readRepositoryFile("apps/cli/AGENTS.md"),
    readRepositoryFile("packages/builder-core/AGENTS.md"),
  ]);
  const clientExpansionPhase = compactLabel("P", "3", "B");

  for (const roadmap of [sourcePlan, programRoadmap]) {
    assert.match(
      roadmap,
      /one-time 2026-08-26 multilingual implementation-lane exception/iu,
    );
    assert.match(
      roadmap,
      /0a699d26198e94ddfaa596d812ad175284d05c49[\s\S]+a66890a6c30a275818e7b51f22ded987cc1d52ff/iu,
    );
    assert.match(
      roadmap,
      /Lane A[\s\S]+site-routing@0\.4\.0[\s\S]+accepted-main[\s\S]+Lane B[\s\S]+merge/iu,
    );
    assert.match(
      roadmap,
      /does not authorize[\s\S]+multilingual certification[\s\S]+analytics implementation[\s\S]+real client project/iu,
    );
  }

  assert.match(
    sourcePlan,
    new RegExp(
      `${escapeRegularExpression(clientExpansionPhase)}[\\s\\S]+multilingual@0\\.1\\.0[\\s\\S]+portfolio[\\s\\S]+site`,
      "iu",
    ),
  );
  assert.match(capabilityModel, /^### Executable multilingual boundary$/mu);
  const multilingualBoundary = capabilityModel
    .split("### Executable multilingual boundary\n", 2)[1]
    .split("\n### ", 1)[0];
  assert.ok(multilingualBoundary, "executable multilingual boundary is missing");
  assert.match(
    multilingualBoundary,
    /multilingual@0\.1\.0[\s\S]+source-generated[\s\S]+portfolio[\s\S]+site/iu,
  );
  assert.match(
    multilingualBoundary,
    /supported locales are exactly `en-CA` and `fr-CA`[\s\S]+default locale is `en-CA`/u,
  );
  assert.match(
    multilingualBoundary,
    /every public URL[\s\S]+default locale[\s\S]+locale-prefixed[\s\S]+Accept-Language/iu,
  );
  assert.match(
    multilingualBoundary,
    /explicit unsupported locale[\s\S]+not-found[\s\S]+no runtime translation fallback/iu,
  );
  assert.match(
    multilingualBoundary,
    /missing[\s\S]+unused[\s\S]+structural parity[\s\S]+fail closed/iu,
  );
  assert.match(
    multilingualBoundary,
    /application-owned locale catalogs[\s\S]+preservation or ejection[\s\S]+removal/iu,
  );
  assert.match(
    multilingualBoundary,
    /multilingual@0\.1\.0[\s\S]+certified[\s\S]+96b587a254cf6fc859867d6fc66c7e0c900c4cfd[\s\S]+linguistic quality[\s\S]+WCAG conformance/iu,
  );

  assert.match(
    overview,
    /multilingual@0\.1\.0[\s\S]+exact addition and removal[\s\S]+certified[\s\S]+96b587a254cf6fc859867d6fc66c7e0c900c4cfd/iu,
  );
  assert.match(
    enforcementMap,
    /INV-MULTILINGUAL-ROUTING[^\n]+actual[^\n]+locale-prefixed[^\n]+no fallback/iu,
  );
  assert.match(
    enforcementMap,
    /INV-MULTILINGUAL-CONTENT[^\n]+actual[^\n]+missing[^\n]+unused[^\n]+parity/iu,
  );
  assert.match(
    packageOwnership,
    /eight capability descriptors[\s\S]+multilingual@0\.1\.0[\s\S]+initial generation[\s\S]+exact addition and removal/iu,
  );

  for (const instructions of [cliInstructions, builderCoreInstructions]) {
    assert.match(
      instructions,
      /booking-calendly@0\.1\.0[\s\S]+multilingual@0\.1\.0/iu,
    );
    assert.match(
      instructions,
      /multilingual@0\.1\.0[\s\S]+certified[\s\S]+96b587a254cf6fc859867d6fc66c7e0c900c4cfd/iu,
    );
  }
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
    assert.match(
      document,
      /booking-calendly[^\n]+(?:active|current)[^\n]+certified/iu,
    );
  }
  assert.match(
    capabilityModel,
    /booking-calendly[^\n]+certified[^\n]+fresh-add lifecycle[^\n]+protected-staging\/provider receipts/iu,
  );
  assert.match(
    enforcementMap,
    /booking-calendly[^\n]+certified[^\n]+b30e10b86b9ac9ef8dfdf1e8fa8e4077e2abe059[^\n]+provider-confirmed[^\n]+cleanup[^\n]+f9bd78f115c2118afd6dcc17ce49b2bfe34ca10d/iu,
  );
  const registry = JSON.parse(registrySource);
  const bookingRecord = registry.records["booking-calendly"];
  const deploymentRecord = registry.records["deployment-cloudflare"];
  const observabilityRecord = registry.records.observability;
  const multilingualRecord = registry.records.multilingual;
  const siteRoutingRecord = registry.records["site-routing"];
  const standardsRecord = registry.records.standards;
  assert.equal(bookingRecord.status, "certified");
  assert.equal(
    bookingRecord.taskPlan,
    "docs/superpowers/plans/2026-08-24-booking-calendly-lifecycle-certification.md",
  );
  assert.deepEqual(bookingRecord.requiredEvidence, [
    "cleanup-recovery",
    "deployed-application",
    "existing-repository-lifecycle",
    "fresh-scaffold",
    "provider-confirmed",
  ]);
  const bookingSubject = {
    descriptorVersion: "0.1.0",
    behaviorContractDigest:
      "sha256:ee498aac3a9701829ea9345a3281958e6e05f22941a85896dac3b239b0f452f2",
  };
  assert.deepEqual(bookingRecord.evidence, [
    {
      kind: "cleanup-recovery",
      path: "docs/implementation-evidence/2026-08-24-booking-calendly-lifecycle-provider-receipt.md",
      outcome: "passed",
      revision: "f9bd78f115c2118afd6dcc17ce49b2bfe34ca10d",
      subject: bookingSubject,
    },
    {
      kind: "deployed-application",
      path: "docs/implementation-evidence/2026-08-24-booking-calendly-lifecycle-provider-receipt.md",
      outcome: "passed",
      revision: "f9bd78f115c2118afd6dcc17ce49b2bfe34ca10d",
      subject: bookingSubject,
    },
    {
      kind: "existing-repository-lifecycle",
      path: "docs/implementation-evidence/2026-08-24-booking-calendly-lifecycle-certification-verification.md",
      outcome: "passed",
      revision: "b30e10b86b9ac9ef8dfdf1e8fa8e4077e2abe059",
      subject: bookingSubject,
    },
    {
      kind: "fresh-scaffold",
      path: "docs/implementation-evidence/2026-08-24-booking-calendly-lifecycle-certification-verification.md",
      outcome: "passed",
      revision: "b30e10b86b9ac9ef8dfdf1e8fa8e4077e2abe059",
      subject: bookingSubject,
    },
    {
      kind: "provider-confirmed",
      path: "docs/implementation-evidence/2026-08-24-booking-calendly-lifecycle-provider-receipt.md",
      outcome: "passed",
      revision: "f9bd78f115c2118afd6dcc17ce49b2bfe34ca10d",
      subject: bookingSubject,
    },
  ]);
  assert.equal(deploymentRecord.status, "certified");
  assert.deepEqual(
    deploymentRecord.evidence.map(({ kind, path, outcome, revision }) => ({
      kind,
      path,
      outcome,
      revision,
    })),
    ["cleanup-recovery", "deployed-application", "fresh-scaffold"].map(
      (kind) => ({
        kind,
        path: "docs/implementation-evidence/2026-08-18-generated-cloudflare-deployment-certification-receipt.md",
        outcome: "passed",
        revision: "ea5a8ae8a6b0aa5fd7b8bc3bab3e03a52242aee2",
      }),
    ),
  );
  assert.equal(observabilityRecord.status, "certified");
  assert.deepEqual(multilingualRecord, {
    subject: {
      descriptorVersion: "0.1.0",
      behaviorContractDigest:
        "sha256:016afd467349fde8ffeb821fe672cf60004f8e10916141c4f3837a81afcb1d41",
    },
    requiredEvidence: ["existing-repository-lifecycle", "fresh-scaffold"],
    status: "certified",
    taskPlan: "docs/superpowers/plans/2026-08-27-multilingual-certification.md",
    evidence: ["existing-repository-lifecycle", "fresh-scaffold"].map(
      (kind) => ({
        kind,
        path: "docs/implementation-evidence/2026-08-27-multilingual-certification-receipt.md",
        outcome: "passed",
        revision: "96b587a254cf6fc859867d6fc66c7e0c900c4cfd",
        subject: {
          descriptorVersion: "0.1.0",
          behaviorContractDigest:
            "sha256:016afd467349fde8ffeb821fe672cf60004f8e10916141c4f3837a81afcb1d41",
        },
      }),
    ),
  });
  assert.deepEqual(siteRoutingRecord, {
    subject: {
      descriptorVersion: "0.4.0",
      behaviorContractDigest:
        "sha256:17e62c4468bc05480828d23471b63afc29e19eb6a9bff07eee1f99d30cd7b3e3",
    },
    requiredEvidence: ["existing-repository-lifecycle", "fresh-scaffold"],
    status: "certified",
    taskPlan:
      "docs/superpowers/plans/2026-08-26-production-site-routing-certification.md",
    evidence: ["existing-repository-lifecycle", "fresh-scaffold"].map(
      (kind) => ({
        kind,
        path: "docs/implementation-evidence/2026-08-26-production-site-routing-certification-receipt.md",
        outcome: "passed",
        revision: "6034d7330af912d1a1b9bcff3323ed360ebee2d0",
        subject: {
          descriptorVersion: "0.4.0",
          behaviorContractDigest:
            "sha256:17e62c4468bc05480828d23471b63afc29e19eb6a9bff07eee1f99d30cd7b3e3",
        },
      }),
    ),
  });
  assert.equal(standardsRecord.status, "certified");
  assert.deepEqual(standardsRecord.requiredEvidence, [
    "existing-repository-lifecycle",
    "fresh-scaffold",
  ]);
  assert.deepEqual(
    standardsRecord.evidence,
    ["existing-repository-lifecycle", "fresh-scaffold"].map((kind) => ({
      kind,
      path: "docs/implementation-evidence/2026-08-25-standards-lifecycle-certification-receipt.md",
      outcome: "passed",
      revision: "d7f9dac6e25d5dde32015968d0912b45e73644e7",
      subject: {
        descriptorVersion: "0.4.0",
        behaviorContractDigest:
          "sha256:81bb7d1c0ee095b6411c29350fa418c8676ffa90594b848a9cc19806e08c29d4",
      },
    })),
  );
  assert.equal(
    standardsRecord.taskPlan,
    "docs/superpowers/plans/2026-08-25-standards-lifecycle-certification.md",
  );
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
    /recipe `0\.10\.0`[^\n]+standards@0\.4\.0[^\n]+observability@0\.3\.0[^\n]+deployment-cloudflare@0\.3\.0/iu,
  );
  assert.match(
    rootReadme,
    /booking-calendly@0\.1\.0[^\n]+fresh-scaffold[^\n]+existing-repository-lifecycle[^\n]+b30e10b86b9ac9ef8dfdf1e8fa8e4077e2abe059[^\n]+deployed-application[^\n]+provider-confirmed[^\n]+cleanup-recovery[^\n]+f9bd78f115c2118afd6dcc17ce49b2bfe34ca10d/iu,
  );
  assert.match(
    capabilityModel,
    /all three Next\.js request-error inputs[^\n]+browser error\/rejection instrumentation[^\n]+five declared application-owned error surfaces[^\n]+app\/error\.tsx[^\n]+app\/global-error\.tsx[^\n]+externalized observability copy[^\n]+typed copy reader[^\n]+pure fallback presentation/iu,
  );
  assert.match(
    capabilityModel,
    /executable recipes are `portfolio@0\.10\.0` and `site@0\.11\.0`[^\n]+site-routing@0\.4\.0[^\n]+observability@0\.3\.0[^\n]+standards@0\.4\.0[^\n]+deployment-cloudflare@0\.3\.0/iu,
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
    assert.match(
      document,
      /multilingual@0\.1\.0[^\n]+certified[^\n]+96b587a254cf6fc859867d6fc66c7e0c900c4cfd/iu,
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
    /descriptor `standards@0\.4\.0` is certified from accepted existing-repository-lifecycle and renewed fresh-scaffold evidence at revision `d7f9dac6e25d5dde32015968d0912b45e73644e7`[^\n]+generated repositories retain exact public package pin `0\.1\.0`/iu,
  );
  assert.match(
    enforcementMap,
    /analytics@0\.1\.0[^\n]+certified[^\n]+a97341ea628210b6fa713fb12461084f20c3f8da[^\n]+descriptor admission[^\n]+all-certified[^\n]+pass/iu,
  );
  assert.match(
    enforcementMap,
    /booking-calendly@0\.1\.0[^\n]+certified[^\n]+b30e10b86b9ac9ef8dfdf1e8fa8e4077e2abe059[^\n]+provider-confirmed[^\n]+cleanup[^\n]+f9bd78f115c2118afd6dcc17ce49b2bfe34ca10d/iu,
  );
  assert.match(
    reviewProtocol,
    /pnpm run check:capability-certification/iu,
  );
  assert.doesNotMatch(
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

test("canonical documentation records visual regression and the client-ready closure boundary", async () => {
  const visualCertificationTask = namedLabel("Task", "8B");
  const clientReadyPhase = compactLabel("P", "2");
  const lifecyclePhase = compactLabel("P", "3");
  const clientExpansionPhase = compactLabel("P", "3B");
  const [
    rootInstructions,
    contributing,
    rootReadme,
    sourcePlan,
    capabilityModel,
    enforcementMap,
    overview,
    packageOwnership,
    roadmap,
    builderInstructions,
    builderReadme,
  ] = await Promise.all([
    readRepositoryFile("AGENTS.md"),
    readRepositoryFile("CONTRIBUTING.md"),
    readRepositoryFile("README.md"),
    readRepositoryFile(
      "docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md",
    ),
    readRepositoryFile("docs/architecture/capability-model.md"),
    readRepositoryFile("docs/architecture/enforcement-map.md"),
    readRepositoryFile("docs/architecture/overview.md"),
    readRepositoryFile("docs/architecture/package-ownership.md"),
    readRepositoryFile("docs/roadmaps/program-roadmap.md"),
    readRepositoryFile("packages/builder-core/AGENTS.md"),
    readRepositoryFile("packages/builder-core/README.md"),
  ]);

  for (const statusOwner of [sourcePlan, overview, roadmap]) {
    assert.match(
      statusOwner,
      /b46f5f59c7f98ed6be1fa569a2f4a1f23d1ca1ad[^\n]+32323617228/iu,
    );
  }
  for (const statusOwner of [sourcePlan, overview, roadmap]) {
    assert.match(
      statusOwner,
      /8e5f376f32a95f87420fd82a61566c08c2db020e[^\n]+32399819237/iu,
    );
    assert.match(
      statusOwner,
      /8e5f376f32a95f87420fd82a61566c08c2db020e[^\n]+32399819237[^\n]+integration evidence[^\n]+not[^\n]+certification evidence/iu,
    );
  }
  for (const currentOwner of [
    rootReadme,
    sourcePlan,
    capabilityModel,
    enforcementMap,
    overview,
    packageOwnership,
    roadmap,
    builderInstructions,
    builderReadme,
  ]) {
    assert.match(currentOwner, /standards@0\.4\.0/iu);
    assert.match(
      currentOwner,
      /standards@0\.4\.0[^\n]+certified|certified[^\n]+standards@0\.4\.0/iu,
    );
    assert.match(
      currentOwner,
      /standards@0\.4\.0[^\n]+fresh-scaffold[^\n]+d7f9dac6e25d5dde32015968d0912b45e73644e7/iu,
    );
  }

  assert.match(
    capabilityModel,
    /compiled CLI[^\n]+fresh[^\n]+scaffold[^\n]+fixed generated-project verifier[^\n]+deterministic visual regression/iu,
  );

  assert.match(
    capabilityModel,
    /managed visual configuration[^\n]+application-owned specification[^\n]+profile baselines/iu,
  );
  assert.match(capabilityModel, /OpenNext\/workerd preview/iu);
  assert.match(capabilityModel, /1440[^\n]+900[^\n]+320[^\n]+800/iu);
  assert.match(capabilityModel, /--update-snapshots[^\n]+causal source change/iu);
  assert.match(capabilityModel, /failure-only[^\n]+seven days/iu);
  assert.match(
    capabilityModel,
    new RegExp(
      `${escapeRegularExpression(visualCertificationTask)}[^\\n]+complete[^\\n]+standards@0\\.4\\.0[^\\n]+fresh-scaffold`,
      "iu",
    ),
  );

  assert.match(
    enforcementMap,
    /deterministic visual regression[^\n]+actual[^\n]+verify:generated-visuals/iu,
  );
  assert.match(enforcementMap, /binary[^\n]+PNG/iu);
  assert.match(enforcementMap, /test:visual/iu);
  assert.match(enforcementMap, /failure-only[^\n]+seven days/iu);
  assert.match(
    packageOwnership,
    /standards@0\.4\.0[^\n]+public package pin `0\.1\.0`[^\n]+unchanged/iu,
  );

  for (const contributorSurface of [
    rootInstructions,
    contributing,
    rootReadme,
    builderInstructions,
    builderReadme,
  ]) {
    assert.match(contributorSurface, /verify:generated-visuals|test:visual/iu);
    assert.match(
      contributorSurface,
      /visual quality[^\n]+WCAG conformance/iu,
    );
  }
  for (const closureOwner of [
    rootReadme,
    sourcePlan,
    capabilityModel,
    enforcementMap,
    overview,
    roadmap,
  ]) {
    assert.match(
      closureOwner,
      /(?:deferring performance budgets[^\n]+no performance or production-readiness claim|performance budgets[^\n]+deferred[^\n]+no performance claim)/iu,
    );
  }
  for (const sequencingOwner of [sourcePlan, roadmap]) {
    assert.match(sequencingOwner, /unnumbered closure amendment/iu);
    assert.match(
      sequencingOwner,
      /standards@0\.4\.0[^\n]+fresh-scaffold[^\n]+d7f9dac6e25d5dde32015968d0912b45e73644e7/iu,
    );
    assert.match(
      sequencingOwner,
      /visual regression[^\n]+claim limits[^\n]+unchanged/iu,
    );
    assert.match(
      sequencingOwner,
      new RegExp(
        `${escapeRegularExpression(lifecyclePhase)}[^\\n]+eligible[^\\n]+verified-final-diff approval[^\\n]+accepted-main integration`,
        "iu",
      ),
    );
    assert.match(
      sequencingOwner,
      /explicit[^\n]+independent-work exception[^\n]+e354c4b36a6c1c30bd10b6ac9a7ea42678399fe9[^\n]+7645b65a056c643e775987679eeb922e5d5b6ff6[^\n]+33000891104[^\n]+reconciliation[^\n]+satisfying[^\n]+merge gate/iu,
    );
    assert.match(
      sequencingOwner,
      new RegExp(
        `${escapeRegularExpression(clientExpansionPhase)}[^\\n]+next eligible`,
        "iu",
      ),
    );
  }
  assert.doesNotMatch(
    overview,
    new RegExp(
      `in-progress ${escapeRegularExpression(clientReadyPhase)} portfolio`,
      "iu",
    ),
  );
  assert.doesNotMatch(
    sourcePlan,
    new RegExp(
      `${escapeRegularExpression(clientReadyPhase)}\\s+Production-ready portfolio`,
      "iu",
    ),
  );
  assert.match(
    roadmap,
    /no capability-certification backfill increment remains/iu,
  );
  assert.doesNotMatch(
    roadmap,
    /Accepted pre-foundation capabilities remain explicitly `backfill-pending`/iu,
  );
});

test("canonical documentation accepts profile-transition execution and records transactional-lifecycle closure", async () => {
  const lifecyclePhase = compactLabel("P", "3");
  const [
    rootReadme,
    sourcePlan,
    roadmap,
    overview,
    capabilityModel,
    packageOwnership,
    enforcementMap,
    builderCoreInstructions,
    builderCoreReadme,
  ] =
    await Promise.all([
      readRepositoryFile("README.md"),
      readRepositoryFile(
        "docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md",
      ),
      readRepositoryFile("docs/roadmaps/program-roadmap.md"),
      readRepositoryFile("docs/architecture/overview.md"),
      readRepositoryFile("docs/architecture/capability-model.md"),
      readRepositoryFile("docs/architecture/package-ownership.md"),
      readRepositoryFile("docs/architecture/enforcement-map.md"),
      readRepositoryFile("packages/builder-core/AGENTS.md"),
      readRepositoryFile("packages/builder-core/README.md"),
    ]);

  for (const statusOwner of [sourcePlan, roadmap, overview]) {
    assert.match(
      statusOwner,
      /7ba461ac20d4a1d708e9f7b940e15cda0fce3295[^\n]+32429352322/iu,
    );
    assert.match(
      statusOwner,
      /31e1bab38496c87dc2e6084c958bd9300a141508[^\n]+32577925329/iu,
    );
  }

  assert.match(
    sourcePlan,
    /pre-write[^\n]+original repository[^\n]+unchanged[^\n]+committed write[^\n]+retains[^\n]+exact prefix[^\n]+recovery evidence/iu,
  );
  assert.match(
    sourcePlan,
    /injected removal failure[^\n]+exact mutation boundary[^\n]+three authoritative state files[^\n]+never[^\n]+automatic rollback/iu,
  );

  for (const sequencingOwner of [sourcePlan, roadmap]) {
    assert.match(
      sequencingOwner,
        /7509fc819ba8670040374c350762720848a47ef1[^\n]+direct predecessor[^\n]+apply-remove[^\n]+pull request 46[^\n]+7f59e8b093edb7be617cd2a30bfb4ebaa6a8ab6e[^\n]+32620215344/iu,
    );
    assert.match(
      sequencingOwner,
      /fingerprint-gated[^\n]+apply-remove[^\n]+booking-calendly@0\.1\.0/iu,
    );
    assert.match(
      sequencingOwner,
      /(?:verified-final-diff[^\n]+separate[^\n]+approval|separate[^\n]+verified-final-diff[^\n]+approval)/iu,
    );
  }

  for (const sequencingOwner of [sourcePlan, roadmap]) {
    assert.match(
      sequencingOwner,
      /performance budgets[^\n]+deferred[^\n]+no performance claim/iu,
    );
    assert.match(
      sequencingOwner,
      new RegExp(
        `94a1d88f500b145366e065797633788a415c00ef[^\\n]+${escapeRegularExpression(lifecyclePhase)} entry gate`,
        "iu",
      ),
    );
    assert.match(
      sequencingOwner,
      /independent-work exception[^\n]+e354c4b36a6c1c30bd10b6ac9a7ea42678399fe9[^\n]+reconciliation[^\n]+merge gate/iu,
    );
  }

  for (const boundaryOwner of [
    sourcePlan,
    roadmap,
    overview,
  ]) {
    assert.match(
      boundaryOwner,
      /read-only[^\n]+plan-add[^\n]+booking-calendly@0\.1\.0/iu,
    );
    assert.match(
      boundaryOwner,
      /fingerprint-gated[^\n]+apply-add[^\n]+booking-calendly@0\.1\.0/iu,
    );
    assert.match(
      boundaryOwner,
      /read-only[^\n]+plan-remove[^\n]+booking-calendly@0\.1\.0/iu,
    );
    assert.match(
      boundaryOwner,
      /(?:existing-repository[^\n]+(?:migration append|appends the migration)[^\n]+(?:state-last persistence|persists state last)|prepare one canonical appended successful migration record[^\n]+write `\.egeria\/migrations\.jsonl`[^\n]+write `\.egeria\/state\.json` last)/iu,
    );
    assert.match(
      boundaryOwner,
      /apply-remove[^\n]+accepted-main integrated/iu,
    );
    assert.match(
      boundaryOwner,
      /apply-profile-transition[^\n]+(?:pull request 50|accepted|641db9537f5dea4911b0b727eb083f8d6d359204)/iu,
    );
    assert.match(
      boundaryOwner,
      /generic lifecycle executor[^\n]+(?:another|any further) upgrade or profile-transition edge[^\n]+automated recovery[^\n]+remain planned/iu,
    );
  }

  assert.match(
    overview,
    /Existing-repository mutation[^\n]+Calendly, multilingual, and analytics addition\/removal[^\n]+standards and site-routing upgrades[^\n]+portfolio-to-site transition[^\n]+analytics implementation[^\n]+aa0bcd7e315b11f07e0f4207d11e230ce911b2f4[^\n]+532a7cd6e874db13ac8c4b1d2f376abe83862772[^\n]+Exact Calendly certification[^\n]+protected-staging\/provider journey[^\n]+Exact standards certification[^\n]+compiled upgrade\/refusal\/recovery[^\n]+renewed fresh-scaffold evidence[^\n]+analytics@0\.1\.0[^\n]+a97341ea628210b6fa713fb12461084f20c3f8da[^\n]+generic lifecycle executor[^\n]+any further upgrade or profile-transition edge[^\n]+automated recovery/iu,
  );
  assert.match(
    overview,
    /Generic or unapproved existing-repository changes[^\n]+unsupported transactional migrations[^\n]+remain outside the accepted baseline/iu,
  );

  assert.match(
    capabilityModel,
    /read-only `plan-add`[^\n]+fingerprint-gated `apply-add`[^\n]+read-only `plan-remove`[^\n]+booking-calendly@0\.1\.0/iu,
  );
  assert.match(
    capabilityModel,
    /verifies an isolated copy[^\n]+migration record[^\n]+state last[^\n]+verified-final-diff approval/iu,
  );
  assert.match(
    capabilityModel,
    /Pull requests 48, 49, and 50[^\n]+standards executor[^\n]+portfolio-to-site planner\/executor[^\n]+accepted-main integrated[^\n]+641db9537f5dea4911b0b727eb083f8d6d359204[^\n]+532a7cd6e874db13ac8c4b1d2f376abe83862772[^\n]+portfolio-to-site transition lifecycle certification[^\n]+complete[^\n]+8098c68c82aaa35a59345706c851e8111d463111[^\n]+generic lifecycle executor[^\n]+(?:another|any further) upgrade or profile-transition edge[^\n]+automated recovery[^\n]+remain planned/iu,
  );
  assert.match(
    enforcementMap,
    /INV-CLEAN-ISOLATED-MIGRATION[^\n]+booking-calendly@0\.1\.0[^\n]+plan-add[^\n]+apply-add[^\n]+plan-remove[^\n]+exact plan fingerprint[^\n]+exact expected dirty paths/iu,
  );
  assert.match(
    enforcementMap,
    /plan-remove[^\n]+ownership-aware[^\n]+delete[^\n]+preserve[^\n]+eject[^\n]+redact[^\n]+no write/iu,
  );
  assert.match(
    enforcementMap,
    /INV-STATE-UPDATE-ORDER[^\n]+exact Calendly, multilingual, and analytics addition\/removal[^\n]+migration-before-state persistence[^\n]+final manifest\/state\/inference agreement/iu,
  );
  assert.match(
    capabilityModel,
    /implemented existing-repository boundary[^\n]+apply-remove/iu,
  );
  assert.match(
    capabilityModel,
    /Exact Calendly removal[^\n]+accepted-main integrated/iu,
  );
  assert.match(
    capabilityModel,
    /Removal planning[^\n]+fingerprint/iu,
  );
  assert.match(
    enforcementMap,
    /INV-STATE-UPDATE-ORDER[^\n]+actual[^\n]+exact Calendly, multilingual, and analytics addition\/removal/iu,
  );

  assert.match(
    sourcePlan,
    /standards@0\.3\.0[^\n]+standards@0\.4\.0[^\n]+capability edge[^\n]+recipe[^\n]+builder-version[^\n]+profile-transition edge/iu,
  );
  assert.match(
    sourcePlan,
    /plan-upgrade --directory <absolute-existing-linked-worktree> --capability standards --to-version 0\.4\.0/iu,
  );
  assert.match(
    sourcePlan,
    /desired selection[^\n]+installed state[^\n]+inference[^\n]+project provenance[^\n]+state[^\n]+migration history/iu,
  );
  assert.match(
    sourcePlan,
    /drift[^\n]+dirty or unstable Git identity[^\n]+disagreement[^\n]+without repository mutation/iu,
  );
  assert.match(
    sourcePlan,
    /already-current refusal[^\n]+unsupported or missing-edge[^\n]+ambiguous versions[^\n]+incompatible control state/iu,
  );
  assert.match(
    sourcePlan,
    /stdout[^\n]+stderr[^\n]+exit-code[^\n]+fingerprint[^\n]+stable[^\n]+privacy-safe/iu,
  );
  assert.match(
    sourcePlan,
    /project\.yaml[^\n]+state\.json[^\n]+migrations\.jsonl[^\n]+exact original bytes/iu,
  );
  assert.match(
    sourcePlan,
    /0\.y\.z[^\n]+1\.0\.0[^\n]+control contracts[^\n]+not upgrade subjects[^\n]+previous capability major[^\n]+does not exist/iu,
  );
  assert.match(
    sourcePlan,
    /portfolio-to-site[^\n]+independent[^\n]+profile-transition boundary/iu,
  );

  for (const upgradeSummary of [roadmap, overview, capabilityModel]) {
    assert.match(
      upgradeSummary,
      /standards@0\.3\.0[^\n]+standards@0\.4\.0[^\n]+capability edge/iu,
    );
    assert.match(
      upgradeSummary,
      /first-supported-upgrade-planning-boundary/iu,
    );
  }

  for (const acceptedPlanningOwner of [sourcePlan, roadmap, capabilityModel]) {
    assert.match(
      acceptedPlanningOwner,
      /pull request 47[^\n]+main@138b5d712ab22016c020eb1c2a3e56e0efc89a5a/iu,
    );
  }
  for (const acceptedPlanningOwner of [sourcePlan, roadmap]) {
    assert.match(
      acceptedPlanningOwner,
      /cd57c479cb74a5e0f839f7b46ded220bc456b151[^\n]+32658708533/iu,
    );
  }
  for (const acceptedExecutorOwner of [
    sourcePlan,
    roadmap,
    overview,
    capabilityModel,
  ]) {
    assert.match(
      acceptedExecutorOwner,
      /pull request 48[^\n]+main@af8898b533f4a7ccf08c83bd7818312a5f27c3c0/iu,
    );
    assert.match(
      acceptedExecutorOwner,
      /apply-upgrade[^\n]+(?:verified-final-diff[^\n]+separate[^\n]+approval|separate[^\n]+verified-final-diff[^\n]+approval)/iu,
    );
  }
  for (const integrationOwner of [sourcePlan, roadmap]) {
    assert.match(
      integrationOwner,
      /3cd51b076d076d39151e96fc1d04c4d91a689a81[^\n]+a9335c1078d5d613f398196674b6b4a39efab4ab[^\n]+32690135067/iu,
    );
  }
  for (const currentStatusOwner of [
    sourcePlan,
    roadmap,
    overview,
    capabilityModel,
    packageOwnership,
    enforcementMap,
  ]) {
    assert.doesNotMatch(
      currentStatusOwner,
      /(?:apply-upgrade|standards executor)[^.\n]+(?:\bis\b|\bremains\b)[^.\n]+(?:\blocal\b|unaccepted|not accepted-main integrated)|(?:\blocal\b|unaccepted|not accepted-main integrated)[^.\n]+(?:apply-upgrade|standards executor)[^.\n]+(?:\bis\b|\bremains\b)/iu,
    );
  }
  assert.match(
    packageOwnership,
    /applyCapabilityUpgrade[^\n]+createFileSystemCapabilityUpgradeWriter[^\n]+private/iu,
  );
  assert.match(
    enforcementMap,
    /INV-SUPPORTED-UPGRADE-EDGE[^\n]+apply-upgrade[^\n]+actual[^\n]+accepted/iu,
  );
  assert.match(
    enforcementMap,
    /INV-STATE-UPDATE-ORDER[^\n]+standards(?: and site-routing)? upgrades?[^\n]+migration-before-state[^\n]+verified-final-diff/iu,
  );
  for (const candidateOwner of [sourcePlan, capabilityModel, enforcementMap]) {
    assert.match(
      candidateOwner,
      /failure[^\n]+inspectable prefix[^\n]+never[^\n]+automatic rollback/iu,
    );
  }
  for (const claimOwner of [sourcePlan, roadmap, overview, capabilityModel]) {
    assert.match(
      claimOwner,
      /apply-upgrade[^\n]+accepted[^\n]+(?:does not|not)[^\n]+(?:certif|deploy|production)/iu,
    );
  }

  assert.match(
    sourcePlan,
    /plan-profile-transition --directory <absolute-existing-linked-worktree> --to-profile site/iu,
  );
  assert.match(
    sourcePlan,
    /single declared profile-transition edge[^\n]+portfolio@0\.10\.0[^\n]+site@0\.10\.0/iu,
  );
  assert.match(
    sourcePlan,
    /source profile[^\n]+infer[^\n]+no caller-supplied `--from-profile`/iu,
  );
  assert.match(
    sourcePlan,
    /success[^\n]+stdout[^\n]+exit `0`[^\n]+refusal[^\n]+stderr[^\n]+exit `1`[^\n]+invalid[^\n]+exit `2`/iu,
  );
  assert.match(
    sourcePlan,
    /recovery[^\n]+`not-required`[^\n]+approval-required/iu,
  );
  assert.match(
    sourcePlan,
    /builder-core[^\n]+canonical[^\n]+transition-planning owner[^\n]+CLI[^\n]+thin/iu,
  );
  assert.match(
    sourcePlan,
    /project\.yaml[^\n]+state\.json[^\n]+migrations\.jsonl[^\n]+every repository byte[^\n]+unchanged/iu,
  );
  for (const transitionConsumer of [
    roadmap,
    overview,
    capabilityModel,
    packageOwnership,
    enforcementMap,
  ]) {
    assert.match(
      transitionConsumer,
      /plan-profile-transition[^\n]+portfolio[^\n]+site|portfolio[^\n]+site[^\n]+plan-profile-transition/iu,
    );
    assert.match(
      transitionConsumer,
      /apply-profile-transition[^\n]+portfolio[^\n]+site|portfolio[^\n]+site[^\n]+apply-profile-transition/iu,
    );
  }

  assert.match(
    sourcePlan,
    /apply-profile-transition --directory <absolute-existing-linked-worktree> --to-profile site --approved-plan sha256:<digest>/iu,
  );
  assert.match(
    sourcePlan,
    /applyProfileTransition[^\n]+createFileSystemProfileTransitionWriter/iu,
  );
  assert.match(
    sourcePlan,
    /transition-portfolio-0-10-0-to-site-0-10-0[^\n]+profile-transition/iu,
  );
  assert.match(
    sourcePlan,
    /seven action paths[^\n]+migrations\.jsonl[^\n]+state\.json[^\n]+dirty/iu,
  );
  assert.match(
    sourcePlan,
    /(?:failure|refusal) before a committed write[^\n]+not-required[^\n]+failure after a committed write[^\n]+inspect-worktree/iu,
  );

  for (const acceptedTransitionOwner of [sourcePlan, roadmap]) {
    assert.match(
      acceptedTransitionOwner,
      /pull request 49[^\n]+main@612a963ab96221837b1c8ac815f41e90736d292e/iu,
    );
    assert.match(
      acceptedTransitionOwner,
      /d0ad744e3818046f755d3933843b22213307c109[^\n]+85afdf22ea8625f3b70cdd712f961d629e948daa[^\n]+32745968642/iu,
    );
  }

  for (const acceptedTransitionExecutorOwner of [
    sourcePlan,
    roadmap,
    overview,
    capabilityModel,
    packageOwnership,
  ]) {
    assert.match(
      acceptedTransitionExecutorOwner,
      /pull request(?: 50|s 48, 49, and 50)[^\n]+main@641db9537f5dea4911b0b727eb083f8d6d359204/iu,
    );
  }
  assert.match(
    enforcementMap,
    /INV-SUPPORTED-PROFILE-TRANSITION[^\n]+actual and accepted[^\n]+pull request 50/iu,
  );

  for (const extractionOwner of [
    sourcePlan,
    roadmap,
    overview,
    capabilityModel,
    packageOwnership,
    enforcementMap,
  ]) {
    assert.match(
      extractionOwner,
      /private[^\n]+(?:migration-log[^\n]+state-control|control-persistence|control persistence|shared control)/iu,
    );
  }

  const lifecycleClosureLabel = [
    lifecyclePhase,
    " ",
    namedLabel("Gate", "3"),
    " closure",
  ].join("");
  const finalLifecycleClosurePattern = new RegExp(
    `${escapeRegularExpression(lifecycleClosureLabel)}[^\\n]+approved[^\\n]+closed`,
    "iu",
  );
  const multilingualEligibilityPattern =
    /multilingual@0\.1\.0[^\n]+certified[^\n]+96b587a254cf6fc859867d6fc66c7e0c900c4cfd/iu;
  const semanticLifecycleClosurePattern =
    /transactional-lifecycle closure[^\n]+approved[^\n]+closed/iu;
  const semanticMultilingualPattern =
    /multilingual@0\.1\.0[^\n]+certified[^\n]+96b587a254cf6fc859867d6fc66c7e0c900c4cfd/iu;

  for (const sequencingOwner of [sourcePlan, roadmap]) {
    assert.doesNotMatch(sequencingOwner, /minimum one remaining increment/iu);
    assert.match(
      sequencingOwner,
      /booking-calendly@0\.1\.0[^\n]+lifecycle certification[^\n]+complete/iu,
    );
    assert.match(
      sequencingOwner,
      /standards@0\.4\.0[^\n]+lifecycle certification[^\n]+complete/iu,
    );
    assert.match(
      sequencingOwner,
      /portfolio-to-site[^\n]+transition[^\n]+lifecycle certification[^\n]+complete[^\n]+8098c68c82aaa35a59345706c851e8111d463111/iu,
    );
    assert.match(
      sequencingOwner,
      /content-files@0\.4\.0[^\n]+certification[^\n]+complete[^\n]+f03b9f624c370728f678924ce34e5287558d2a87/iu,
    );
    assert.match(
      sequencingOwner,
      /section-composition@0\.3\.0[^\n]+certification[^\n]+complete[^\n]+f74459c8833833186bb651c116ed524e51044677/iu,
    );
    assert.match(
      sequencingOwner,
      /site-routing@0\.3\.0[^\n]+certification[^\n]+complete[^\n]+77cea944513e521939bf4de088048f67acdfbc3c/iu,
    );
    assert.match(
      sequencingOwner,
      /site-routing@0\.4\.0[^\n]+certif(?:ied|ication)[^\n]+6034d7330af912d1a1b9bcff3323ed360ebee2d0/iu,
    );
    assert.match(
      sequencingOwner,
      finalLifecycleClosurePattern,
    );
    assert.doesNotMatch(sequencingOwner, /minimum two remaining increments/iu);
    assert.doesNotMatch(sequencingOwner, /minimum three remaining increments/iu);
    assert.doesNotMatch(sequencingOwner, /minimum four remaining increments/iu);
    assert.doesNotMatch(sequencingOwner, /minimum five remaining increments/iu);
    assert.doesNotMatch(
      sequencingOwner,
      /selected next increment[^\n]+portfolio-to-site transition lifecycle certification/iu,
    );
    assert.doesNotMatch(
      sequencingOwner,
      /site-routing@0\.3\.0[^\n]+next[^\n]+certification increment/iu,
    );
  }

  for (const closureStatusConsumer of [
    sourcePlan,
    roadmap,
    overview,
    capabilityModel,
    builderCoreInstructions,
  ]) {
    assert.match(closureStatusConsumer, finalLifecycleClosurePattern);
    assert.match(closureStatusConsumer, multilingualEligibilityPattern);
  }

  for (const semanticStatusConsumer of [rootReadme, builderCoreReadme]) {
    assert.match(semanticStatusConsumer, semanticLifecycleClosurePattern);
    assert.match(semanticStatusConsumer, semanticMultilingualPattern);
  }

  assert.doesNotMatch(
    overview,
    /isolated production-site (?:implementation )?candidate/iu,
  );
  assert.doesNotMatch(
    builderCoreReadme,
    /public-site expansion is the next eligible phase/iu,
  );

  assert.match(
    roadmap,
    /main@392f2e27de1d4a24124d51daf059b1667207436e[^\n]+0f5b729262237aa6856be4d8e5aa4396584233a2/iu,
  );
  assert.match(
    roadmap,
    /32984587387[^\n]+unavailable[^\n]+outage[^\n]+waiv[^\n]+not[^\n]+passing hosted check/iu,
  );
  assert.match(
    roadmap,
    new RegExp(
      `${escapeRegularExpression(lifecycleClosureLabel)}[^\\n]+e354c4b36a6c1c30bd10b6ac9a7ea42678399fe9[^\\n]+7645b65a056c643e775987679eeb922e5d5b6ff6[^\\n]+33000891104[^\\n]+attempt 2[^\\n]+passed every applicable job[^\\n]+${escapeRegularExpression(lifecyclePhase)} is complete`,
      "iu",
    ),
  );

  for (const certificationStatusOwner of [
    overview,
    capabilityModel,
    enforcementMap,
  ]) {
    assert.match(
      certificationStatusOwner,
      /portfolio-to-site[^\n]+transition[^\n]+lifecycle certification[^\n]+complete[^\n]+8098c68c82aaa35a59345706c851e8111d463111/iu,
    );
    assert.match(
      certificationStatusOwner,
      /content-files@0\.4\.0[^\n]+certified[^\n]+f03b9f624c370728f678924ce34e5287558d2a87/iu,
    );
    assert.match(
      certificationStatusOwner,
      /section-composition@0\.3\.0[^\n]+certified[^\n]+f74459c8833833186bb651c116ed524e51044677/iu,
    );
    assert.match(
      certificationStatusOwner,
      /site-routing@0\.3\.0[^\n]+certified[^\n]+77cea944513e521939bf4de088048f67acdfbc3c/iu,
    );
  }

  assert.match(
    sourcePlan,
    /Evidence-gated internal lifecycle extraction boundary[^]+private to `packages\/builder-core`[^]+not a generic lifecycle executor or public API/iu,
  );

  assert.match(
    enforcementMap,
    /INV-SUPPORTED-UPGRADE-EDGE[^\n]+standards@0\.3\.0[^\n]+standards@0\.4\.0[^\n]+apply-upgrade[^\n]+actual[^\n]+accepted[^\n]+separate verified-final-diff stop/iu,
  );
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
  const publicSitePhase = compactLabel("P", "3B");
  const closureGate = `${compactLabel("P", "3")} ${namedLabel("Gate", "3")}`;

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
    sourcePlan,
    /2026-08-26[^.]+independent-work exception/iu,
  );
  assert.match(
    sourcePlan,
    /main@392f2e27de1d4a24124d51daf059b1667207436e[^.]+site-routing certification receipt/iu,
  );
  assert.match(
    sourcePlan,
    /reconciliation[^.]+isolated `production-site-profile` branch[^.]+accepted closure/iu,
  );
  assert.match(
    sourcePlan,
    new RegExp(
      `${escapeRegularExpression(closureGate)}[^.]+e354c4b36a6c1c30bd10b6ac9a7ea42678399fe9`,
      "iu",
    ),
  );
  assert.match(
    sourcePlan,
    new RegExp(
      `${escapeRegularExpression(publicSitePhase)}[^.]+next eligible`,
      "iu",
    ),
  );

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
  assert.match(
    roadmap,
    /2026-08-26[^.]+independent-work exception[^.]+main@392f2e27de1d4a24124d51daf059b1667207436e/iu,
  );
  assert.match(
    roadmap,
    /reconciliation[^.]+isolated `production-site-profile` branch[^.]+accepted closure/iu,
  );
  assert.match(
    roadmap,
    new RegExp(
      `${escapeRegularExpression(closureGate)}[^.]+e354c4b36a6c1c30bd10b6ac9a7ea42678399fe9`,
      "iu",
    ),
  );
  assert.match(
    roadmap,
    new RegExp(
      `${escapeRegularExpression(publicSitePhase)}[^.]+next eligible`,
      "iu",
    ),
  );

});

test("analytics implementation is independently selectable and serialized behind multilingual certification", async () => {
  const [sourcePlan, roadmap, overview, capabilityModel, enforcementMap, packageOwnership] =
    await Promise.all([
      readRepositoryFile(
        "docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md",
      ),
      readRepositoryFile("docs/roadmaps/program-roadmap.md"),
      readRepositoryFile("docs/architecture/overview.md"),
      readRepositoryFile("docs/architecture/capability-model.md"),
      readRepositoryFile("docs/architecture/enforcement-map.md"),
      readRepositoryFile("docs/architecture/package-ownership.md"),
    ]);
  const owners = [
    sourcePlan,
    roadmap,
    overview,
    capabilityModel,
    enforcementMap,
    packageOwnership,
  ];

  for (const owner of owners) {
    assert.match(owner, /analytics@0\.1\.0/iu);
    assert.match(
      owner,
      /Cloudflare Web Analytics[^\n]+Google Analytics 4[^\n]+Microsoft Clarity|Cloudflare Web Analytics[^\n]+GA4[^\n]+Microsoft Clarity/iu,
    );
    assert.match(owner, /Search Console[^\n]+Looker Studio/iu);
    assert.match(owner, /observability[^\n]+(?:independent|separate|no coupling)/iu);
  }

  for (const sequencingOwner of [sourcePlan, roadmap]) {
    assert.match(
      sequencingOwner,
      /one-time 2026-08-27 analytics implementation-lane exception/iu,
    );
    assert.match(
      sequencingOwner,
      /multilingual certification[^.]+merge(?:s|d)? first[^.]+analytics[^.]+rebase/iu,
    );
    assert.match(
      sequencingOwner,
      /not precedent[^.]+no concurrent merge/iu,
    );
  }

  assert.match(
    capabilityModel,
    /explicit-opt-in[\s\S]{0,800}deny-by-default[\s\S]{0,800}withdrawal/iu,
  );
  assert.match(
    capabilityModel,
    /provider identifiers[^.]+public[^.]+not secrets/iu,
  );
  assert.match(
    capabilityModel,
    /provider accounts[^.]+retained provider data[^.]+outside repository lifecycle authority/iu,
  );
  assert.match(
    enforcementMap,
    /INV-ANALYTICS-CONSENT[^\n]+actual/iu,
  );
  assert.match(
    enforcementMap,
    /INV-ANALYTICS-PROVIDER-BOUNDARY[^\n]+actual/iu,
  );
  assert.match(
    packageOwnership,
    /no public package[^.]+no generic lifecycle executor/iu,
  );
  assert.match(
    overview,
    /separate analytics certification[^.]+accepted[^.]+exact five-outcome receipt/iu,
  );

  for (const boundaryOwner of [sourcePlan, roadmap, overview, capabilityModel]) {
    assert.match(
      boundaryOwner,
      /no provider (?:provisioning|mutation)[^.]+no deployment[^.]+no legal-compliance claim/iu,
    );
  }
});

test("purpose-based analytics consent is canonical and fail-closed", async () => {
  const [adr, capabilityModel, enforcementMap] = await Promise.all([
    readRepositoryFile("docs/adr/0012-purpose-based-analytics-consent.md"),
    readRepositoryFile("docs/architecture/capability-model.md"),
    readRepositoryFile("docs/architecture/enforcement-map.md"),
  ]);

  assert.match(adr, /Status:\*\* Accepted/u);
  assert.match(capabilityModel, /purpose[^\n]+canonical choice/iu);
  assert.match(
    capabilityModel,
    /type AnalyticsConsentRecordV2 = Readonly<\{\n  schemaVersion: 2;\n  noticeVersion: 1;\n  decidedAt: string;\n  expiresAt: string;\n  providerPurposeContext: readonly AnalyticsConsentContextEntry\[\];\n  purposes: readonly AnalyticsPurposeDecision\[\];\n\}>;/u,
  );
  assert.match(capabilityModel, /180 days/iu);
  assert.match(capabilityModel, /configured purposes/iu);
  assert.match(capabilityModel, /local technical preference/iu);
  assert.match(
    capabilityModel,
    /stale grant[^\n]+revocation[^\n]+incomplete/iu,
  );
  assert.match(capabilityModel, /storage event[^\n]+open tabs/iu);
  const consentEnforcementRow = enforcementMap
    .split("\n")
    .find((row) => row.startsWith("| `INV-ANALYTICS-CONSENT` |"));
  assert.ok(consentEnforcementRow);
  const consentEnforcementColumns = consentEnforcementRow
    .split("|")
    .slice(1, -1)
    .map((column) => column.trim());
  assert.match(consentEnforcementColumns[1], /versioned[^\n]+purpose/iu);
  assert.match(
    consentEnforcementColumns[2],
    /^actual for the version-2 consent record/iu,
  );
  assert.doesNotMatch(consentEnforcementColumns[2], /\bplanned\b/iu);
  for (const evidenceOwner of [
    /builder contract[^;]+rendering[^;]+lifecycle tests/iu,
    /generated Vitest unit[^;]+component specifications/iu,
    /site-multilingual-analytics[^;]+Playwright specification/iu,
    /fixture determinism/iu,
    /verify:generated-skeletons/iu,
  ]) {
    assert.match(consentEnforcementColumns[3], evidenceOwner);
  }
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
        "pnpm run test:constitution && pnpm run test:synthetic-client-journey && pnpm run test:package-boundaries && pnpm run build:builder && pnpm run test:builder-core && pnpm run test:cli && pnpm run test:packages && pnpm run test:capability-certification && pnpm run check:capability-certification && pnpm run test:generated-fixtures && pnpm run lint:builder && pnpm run typecheck:builder && pnpm run verify:generated-skeletons && pnpm run changeset:status",
      skeletons: "node scripts/verify-generated-skeletons.mjs",
    },
  );
  await Promise.all(
    [
      "fixtures/generated/portfolio",
      "fixtures/generated/portfolio-calendly",
      "fixtures/generated/site",
      "fixtures/generated/site-multilingual",
      "fixtures/generated/site-multilingual-analytics",
    ].map((path) => access(resolve(repositoryRoot, path))),
  );

  assert.match(
    readme,
    /## Current implementation status/,
  );
  assert.match(
    readme,
    /builder kernel has received verified-final-diff approval.*committed golden fixtures.*client-ready portfolio stage is completed through an unnumbered closure amendment/iu,
  );
  assert.match(
    readme,
    /retained `portfolio-calendly`, `site-multilingual`, and `site-multilingual-analytics` fixtures/iu,
  );
  assert.match(
    capabilityModel,
    /nine `portfolio`\/`site` descriptors.*executable.*analytics@0\.1\.0.*ninth executable descriptor/isu,
  );
  assert.match(
    packageOwnership,
    /nine capability descriptors/iu,
  );
  assert.match(
    builderCoreReadme,
    /exact nine executable capability descriptors/iu,
  );
  assert.match(
    cliReadme,
    /paired `--calendly-url` and `--calendly-mode`.*strict analytics options/isu,
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
    /standards@0\.3\.0[^\n]+renewed eight-outcome private receipt[^\n]+ea5a8ae8a6b0aa5fd7b8bc3bab3e03a52242aee2/iu,
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

test("automated removal-reference hardening follows client expansion without weakening existing gates", async () => {
  const architecturePhase = compactLabel("P", "0");
  const lifecyclePhase = compactLabel("P", "3");
  const clientExpansionPhase = compactLabel("P", "3", "B");
  const referenceHardeningPhase = compactLabel("P", "3", "C");
  const appFoundationPhase = compactLabel("P", "4");
  const [sourcePlan, roadmap, architectureOverview, enforcementMap] =
    await Promise.all([
      readRepositoryFile(
        "docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md",
      ),
      readRepositoryFile("docs/roadmaps/program-roadmap.md"),
      readRepositoryFile("docs/architecture/overview.md"),
      readRepositoryFile("docs/architecture/enforcement-map.md"),
    ]);

  const clientExpansionIndex = roadmap.indexOf(
    `## ${clientExpansionPhase} — Client-required public-site expansion`,
  );
  const referenceHardeningIndex = roadmap.indexOf(
    `## ${referenceHardeningPhase} — Automated removal-reference hardening`,
  );
  const appFoundationIndex = roadmap.indexOf(
    `## ${appFoundationPhase} — App foundation`,
  );
  const sourceReferenceHardening = sourcePlan
    .split(
      `#### ${referenceHardeningPhase} — Automated removal-reference hardening\n`,
      2,
    )[1]
    .split(`#### ${appFoundationPhase} — App foundation`, 1)[0];
  const roadmapReferenceHardening = roadmap
    .split(
      `## ${referenceHardeningPhase} — Automated removal-reference hardening\n`,
      2,
    )[1]
    .split(`## ${appFoundationPhase} — App foundation`, 1)[0];
  const sourceReferenceHardeningStopGate = sourceReferenceHardening.split(
    "**Stop gate:**",
    2,
  )[1];
  const roadmapReferenceHardeningStopGate = roadmapReferenceHardening.split(
    "**Stop gate:**",
    2,
  )[1];
  const removalReferenceGuardRow = enforcementMap
    .split("\n")
    .find((line) => line.startsWith("| `INV-REMOVAL-REFERENCE-GUARDS` |"));

  assert.ok(clientExpansionIndex >= 0);
  assert.ok(referenceHardeningIndex > clientExpansionIndex);
  assert.ok(appFoundationIndex > referenceHardeningIndex);
  assert.ok(sourceReferenceHardening);
  assert.ok(roadmapReferenceHardening);
  assert.ok(sourceReferenceHardeningStopGate);
  for (const obligation of [
    /Calendly exact-reference refusals/iu,
    /heuristic and coverage warnings/iu,
    /deterministic inventory/iu,
    /privacy-safe output/iu,
    /repository-identity refusal/iu,
    /executor revalidation/iu,
    /no-mutation refusal/iu,
    /Package-backed or reusable-analysis claims/iu,
    /separately named concrete evidence gates/iu,
  ]) {
    assert.match(sourceReferenceHardeningStopGate, obligation);
  }
  assert.match(
    roadmapReferenceHardening,
    /finding no detected match must never be represented as proof of dependency absence or complete removal/iu,
  );
  assert.ok(roadmapReferenceHardeningStopGate);
  for (const obligation of [
    /bounded Calendly guard/iu,
    /then-concrete package-backed guard/iu,
    /deterministic/iu,
    /privacy-safe/iu,
    /identity-change/iu,
    /executor-revalidation/iu,
    /no-mutation/iu,
    /before app-foundation/iu,
  ]) {
    assert.match(roadmapReferenceHardeningStopGate, obligation);
  }

  const gradualRoadmapStart = sourcePlan.indexOf(
    `\`\`\`text\n${architecturePhase}  Architecture materialization and deployed compatibility proof`,
  );
  const gradualRoadmapEnd = sourcePlan.indexOf(
    "```\n\n### Sequencing rules",
    gradualRoadmapStart,
  );
  const gradualRoadmap = sourcePlan.slice(
    gradualRoadmapStart,
    gradualRoadmapEnd,
  );
  const sourceClientExpansionIndex = gradualRoadmap.indexOf(
    `${clientExpansionPhase} Production site profile`,
  );
  const sourceReferenceHardeningIndex = gradualRoadmap.indexOf(
    `${referenceHardeningPhase} Automated removal-reference hardening`,
  );
  const sourceAppFoundationIndex = gradualRoadmap.indexOf(
    `${appFoundationPhase}  App profile/app-foundation`,
  );

  assert.ok(gradualRoadmapStart >= 0);
  assert.ok(gradualRoadmapEnd > gradualRoadmapStart);
  assert.ok(sourceClientExpansionIndex >= 0);
  assert.ok(sourceReferenceHardeningIndex > sourceClientExpansionIndex);
  assert.ok(sourceAppFoundationIndex > sourceReferenceHardeningIndex);
  assert.match(
    architectureOverview,
    new RegExp(
      `planned sequencing.+${lifecyclePhase} transactional lifecycle.+prerequisite.+${clientExpansionPhase} client-required public-site expansion.+after ${clientExpansionPhase} closes, ${referenceHardeningPhase} automated removal-reference hardening.+without reopening ${lifecyclePhase} or ${clientExpansionPhase}.+${appFoundationPhase}.+changes no capability defaults.+no composite client profile or capability`,
      "is",
    ),
  );
  assert.match(
    roadmap,
    new RegExp(
      `${referenceHardeningPhase} begins after ${clientExpansionPhase} closes[^\n]+does not reopen or weaken ${lifecyclePhase} or ${clientExpansionPhase}`,
      "i",
    ),
  );
  assert.match(
    sourcePlan,
    new RegExp(
      `${referenceHardeningPhase} begins only after ${clientExpansionPhase} closes.+no detected match.+never be represented as proof`,
      "is",
    ),
  );
  assert.ok(removalReferenceGuardRow);
  const removalReferenceGuardColumns = removalReferenceGuardRow
    .split("|")
    .slice(1, -1)
    .map((column) => column.trim());
  assert.deepEqual(
    removalReferenceGuardColumns.slice(0, 1),
    ["`INV-REMOVAL-REFERENCE-GUARDS`"],
  );
  assert.match(
    removalReferenceGuardColumns[1],
    /finding no detected match may never be represented as proof of dependency absence or complete removal/iu,
  );
  assert.match(
    removalReferenceGuardColumns[2],
    /^actual for exact `booking-calendly@0\.1\.0`/u,
  );
  assert.match(
    removalReferenceGuardColumns[2],
    /equivalent guards for exact `multilingual@0\.1\.0` and `analytics@0\.1\.0` remain planned/iu,
  );
  assert.equal(removalReferenceGuardColumns[4], referenceHardeningPhase);
});
