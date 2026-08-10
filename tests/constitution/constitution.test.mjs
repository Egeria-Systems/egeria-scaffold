import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

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

test("the workspace declares the approved proof root and install policy", async () => {
  const workspace = await readRepositoryFile("pnpm-workspace.yaml");

  assert.equal(
    workspace,
    'packages:\n  - "apps/*"\n  - "packages/*"\n  - "proofs/*"\n\npmOnFail: error\n\nminimumReleaseAge: 1440\n\noverrides:\n  "miniflare>undici": 7.29.0\n\nallowBuilds:\n  "@parcel/watcher": true\n  "@swc/core": true\n  esbuild: true\n  unrs-resolver: true\n  workerd: true\n',
  );
});

test("the compatibility proof has a private non-app workspace boundary", async () => {
  const proofManifest = JSON.parse(
    await readRepositoryFile("proofs/nextjs-cloudflare/package.json"),
  );

  assert.equal(
    proofManifest.name,
    "@egeria-systems/nextjs-cloudflare-proof",
  );
  assert.equal(proofManifest.private, true);
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
    /INV-ACCESSIBILITY-AUTOMATION[^\n]+all three retained fixtures pass local development and workerd Playwright\/axe/i,
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
    assert.match(
      document,
      /exactly `@egeria-systems\/standards@0\.1\.0` and `@egeria-systems\/observability@0\.1\.0` are publicly available on npm/i,
    );
    assert.match(document, /registry signatures/i);
    assert.match(document, /approved bootstrap provenance exception/i);
    assert.match(document, /future releases.*OIDC trusted publishing/i);
    assert.match(document, /explicit provenance request/i);
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
      "pnpm --filter @egeria-systems/nextjs-cloudflare-proof run deploy",
    )
  ) {
    problems.push("credential-bearing step must invoke the deploy-only script");
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

  assert.match(workflow, /^on:\n  workflow_dispatch:\n/m);
  assert.doesNotMatch(workflow, /^  (?:push|pull_request|schedule):/m);
  assert.match(workflow, /^permissions:\n  contents: read\n/m);
  assert.match(workflow, /^  group: compatibility-proof\n  cancel-in-progress: false$/m);
  assert.match(workflow, /if: github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /^      name: compatibility$/m);
  assert.match(
    workflow,
    /actions\/checkout@d23441a48e516b6c34aea4fa41551a30e30af803/,
  );
  assert.match(
    workflow,
    /pnpm\/setup@c9883cc79df532ad1a7b81bf9ab944ceb090d65c/,
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
    /COMPATIBILITY_URL: \$\{\{ vars\.COMPATIBILITY_URL \}\}/,
  );
  assert.doesNotMatch(workflow, /production/i);
});

test("the deployment credential contract rejects build work in the secret-bearing block", async () => {
  const workflow = await readRepositoryFile(
    ".github/workflows/compatibility-proof.yml",
  );
  const insecureWorkflow = workflow.replace(
    "pnpm --filter @egeria-systems/nextjs-cloudflare-proof run deploy",
    "pnpm --filter @egeria-systems/nextjs-cloudflare-proof build:cloudflare\n          pnpm --filter @egeria-systems/nextjs-cloudflare-proof run deploy",
  );

  assert.match(
    validateCompatibilityDeploymentCredentialBoundary(insecureWorkflow),
    /must not build under Cloudflare credentials/,
  );
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
    group: "booking-calendly-certification",
    "cancel-in-progress": false,
  });

  const job = workflow.jobs["verify-and-deploy"];
  assert.equal(job.if, "github.ref == 'refs/heads/main'");
  assert.equal(job["runs-on"], "ubuntu-24.04");
  assert.deepEqual(job.environment, {
    name: "compatibility",
    url: "${{ vars.BOOKING_CALENDLY_CERTIFICATION_URL }}",
  });
  assert.deepEqual(job.env, {
    CERTIFICATION_ROOT:
      "${{ runner.temp }}/booking-calendly-certification/project",
  });

  const stepsByName = Object.fromEntries(
    job.steps.map((step) => [step.name, step]),
  );
  assert.equal(
    stepsByName["Check out repository"].uses,
    "actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803",
  );
  assert.deepEqual(stepsByName["Check out repository"].with, {
    "fetch-depth": 0,
    ref: "${{ github.sha }}",
    "persist-credentials": false,
  });
  assert.equal(
    stepsByName["Set up pnpm and Node.js"].uses,
    "pnpm/setup@c9883cc79df532ad1a7b81bf9ab944ceb090d65c",
  );
  assert.deepEqual(stepsByName["Set up pnpm and Node.js"].with, {
    version: "11.20.0",
    runtime: "node@22.23.2",
    cache: true,
    install: false,
  });
  assert.equal(
    stepsByName["Upload local certification receipt"].uses,
    "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a",
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
  const deployedTestIndex = job.steps.findIndex(
    ({ name }) => name === "Test deployed application behavior",
  );
  assert.ok(revisionIndex > -1 && revisionIndex < deployIndex);
  assert.ok(deployIndex < deployedTestIndex);
  assert.deepEqual(stepsByName["Deploy certification Worker"].env, {
    CLOUDFLARE_ACCOUNT_ID: "${{ secrets.CLOUDFLARE_ACCOUNT_ID }}",
    CLOUDFLARE_API_TOKEN: "${{ secrets.CLOUDFLARE_API_TOKEN }}",
  });
  assert.deepEqual(
    stepsByName["Test deployed application behavior"].env,
    {
      PLAYWRIGHT_DEPLOYED_URL:
        "${{ vars.BOOKING_CALENDLY_CERTIFICATION_URL }}",
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
    /pnpm\b[^\n]*(?:build|test)|calendly/iu,
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
  const siteAndAppPhase = compactLabel("P", "4");
  const initialCertificationTask = namedLabel("Task", "5B");
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
    .split(`## ${siteAndAppPhase} — Site and app foundation`, 1)[0];
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
    /descriptor admission[^\n]+pending[^\n]+closure[^\n]+backfill-pending/i,
  );
  assert.match(
    enforcementMap,
    /descriptor version or behavior-contract digest[^\n]+material change[^\n]+new task-linked pending record/i,
  );
  assert.match(
    enforcementMap,
    new RegExp(
      `backfill-pending[^\\n]+${escapeRegularExpression(clientReadyPhase)} closure[^\\n]+${escapeRegularExpression(lifecyclePhase)} closure[^\\n]+reject`,
      "i",
    ),
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

test("executable capability certification ownership is current", async () => {
  const [
    overview,
    capabilityModel,
    enforcementMap,
    reviewProtocol,
    roadmap,
    builderCoreInstructions,
    builderCoreReadme,
  ] = await Promise.all([
    readRepositoryFile("docs/architecture/overview.md"),
    readRepositoryFile("docs/architecture/capability-model.md"),
    readRepositoryFile("docs/architecture/enforcement-map.md"),
    readRepositoryFile("docs/governance/review-and-contribution.md"),
    readRepositoryFile("docs/roadmaps/program-roadmap.md"),
    readRepositoryFile("packages/builder-core/AGENTS.md"),
    readRepositoryFile("packages/builder-core/README.md"),
  ]);

  for (const document of [overview, capabilityModel, enforcementMap, roadmap]) {
    assert.match(document, /certifications\/capabilities\.json/u);
    assert.match(
      document,
      /booking-calendly[\s\S]+pending[\s\S]+protected-staging[\s\S]+unexecuted/iu,
    );
  }
  assert.match(
    enforcementMap,
    /admission[^\n]+actual[^\n]+closure[^\n]+reject/iu,
  );
  assert.match(
    enforcementMap,
    /fresh-scaffold[^\n]+actual[^\n]+provider[^\n]+unexecuted/iu,
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
    /local certification foundation[^.]+implemented/iu,
  );
  for (const document of [builderCoreInstructions, builderCoreReadme]) {
    assert.match(document, /private certification registry/iu);
    assert.match(document, /descriptor admission/iu);
    assert.match(document, /closure/iu);
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

  assert.deepEqual(
    {
      fixtures: manifest.scripts["test:generated-fixtures"],
      kernel: manifest.scripts["verify:builder-kernel"],
      skeletons: manifest.scripts["verify:generated-skeletons"],
    },
    {
      fixtures: "node --test tests/generated-fixtures/*.test.mjs",
      kernel:
        "pnpm run test:constitution && pnpm run test:package-boundaries && pnpm run test:builder-core && pnpm run test:cli && pnpm run test:capability-certification && pnpm run check:capability-certification && pnpm run test:generated-fixtures && pnpm run lint:builder && pnpm run build:builder && pnpm run typecheck:builder && pnpm run verify:generated-skeletons && pnpm run changeset:status",
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
        " as the next increment approves " +
        escapeRegularExpression(browserTestingTask) +
        "'s generated browser-quality foundation at committed artifact `02ec5eb12741c1622beec02529c38965e7501d68`[\\s\\S]+" +
        "Selecting " +
        escapeRegularExpression(calendlyCertificationTask) +
        " as the next increment accepts " +
        escapeRegularExpression(calendlyTask) +
        " Calendly initial scaffolding[\\s\\S]+" +
        escapeRegularExpression(calendlyCertificationTask) +
        "'s local certification foundation is implemented and awaiting review; later task numbering is unchanged[\\s\\S]+develops directly on clean local `main`",
    ),
  );
  assert.match(
    contributing,
    /The executable builder currently has seven capability descriptors.*retains exact `portfolio`, `portfolio-calendly`, and `site` fixtures.*all three fixtures are certified locally.*protected-staging\/provider-confirmed certification.*separately authorized outcomes/isu,
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
