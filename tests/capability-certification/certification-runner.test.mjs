import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  access,
  chmod,
  cp,
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

import { certifyBookingCalendlyForTesting } from "../../scripts/certify-booking-calendly.mjs";
import {
  certifyCloudflareDeploymentForTesting,
  readCloudflareDeploymentRevisionForTesting,
} from "../../scripts/certify-cloudflare-deployment.mjs";
import { certifyContentFilesForTesting } from "../../scripts/certify-content-files.mjs";
import { certifyGeneratedTestingForTesting } from "../../scripts/certify-generated-testing.mjs";
import { certifyProfileTransitionLifecycleForTesting } from "../../scripts/certify-profile-transition-lifecycle.mjs";
import { certifySectionCompositionForTesting } from "../../scripts/certify-section-composition.mjs";
import { certifySiteRoutingForTesting } from "../../scripts/certify-site-routing.mjs";
import { certifyStandardsLifecycleForTesting } from "../../scripts/certify-standards-lifecycle.mjs";
import { runCertificationCli } from "../../scripts/lib/certification-cli.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const checkScript = resolve(
  repositoryRoot,
  "scripts/check-capability-certification.mjs",
);
const certificationRegistryPath = resolve(
  repositoryRoot,
  "certifications/capabilities.json",
);
const builderCoreDistPath = resolve(
  repositoryRoot,
  "packages/builder-core/dist",
);
const builderCoreNodeModulesPath = resolve(
  repositoryRoot,
  "packages/builder-core/node_modules",
);
const privatePlanPath =
  "docs/superpowers/plans/private-certification-validation.md";
const privateEvidencePath =
  "docs/implementation-evidence/private-certification-validation.md";
const privateSubject = Object.freeze({
  descriptorVersion: "0.1.0",
  behaviorContractDigest:
    "sha256:339462dc3cc43065aeeb2eabc0556960d07c4c6b3e1e13738715fc7e0cedc8ab",
});
const certificationScript = resolve(
  repositoryRoot,
  "scripts/certify-booking-calendly.mjs",
);
const cloudflareDeploymentCertificationScript = resolve(
  repositoryRoot,
  "scripts/certify-cloudflare-deployment.mjs",
);
const contentFilesCertificationScript = resolve(
  repositoryRoot,
  "scripts/certify-content-files.mjs",
);
const generatedTestingCertificationScript = resolve(
  repositoryRoot,
  "scripts/certify-generated-testing.mjs",
);
const standardsLifecycleCertificationScript = resolve(
  repositoryRoot,
  "scripts/certify-standards-lifecycle.mjs",
);
const profileTransitionLifecycleCertificationScript = resolve(
  repositoryRoot,
  "scripts/certify-profile-transition-lifecycle.mjs",
);
const sectionCompositionCertificationScript = resolve(
  repositoryRoot,
  "scripts/certify-section-composition.mjs",
);
const siteRoutingCertificationScript = resolve(
  repositoryRoot,
  "scripts/certify-site-routing.mjs",
);
const compiledUpgradeCertificationTests = [
  "the compiled plan-upgrade command plans both profiles without changing any byte",
  "the compiled apply-upgrade command completes the exact portfolio and site transactions",
  "the compiled standards upgrade verification failure retains transformed source and old controls",
  "the compiled plan-upgrade command refuses unsafe or unsupported repository states without writes",
  "the compiled apply-upgrade command refuses the finite unsafe matrix without mutation",
];
const builderUpgradeCertificationTests = [
  "standards capability upgrade refuses unsupported capability and target inputs without mutation",
  "standards capability upgrade transforms, verifies, persists state last, and stops for final-diff approval",
  "standards capability upgrade refuses malformed, wrong, and stale plan authority without mutation",
  "standards capability upgrade propagates named planner refusals without mutation",
  "standards capability upgrade refuses duplicate migration history before writing",
  "standards capability upgrade refuses unsafe Git and changed pre-write identity",
  "standards capability upgrade refuses an ignored create target before mutation",
  "standards capability upgrade contains reader, create-target, and preflight exceptions before writes",
  "standards capability upgrade distinguishes uncommitted and partial transform failures",
  "standards capability upgrade retains transformed source and old controls on verification or re-inference failure",
  "standards capability upgrade maps clock and migration persistence failures to the retained source prefix",
  "standards capability upgrade retains the migration prefix when its reread fails",
  "standards capability upgrade retains an uncertain committed migration append",
  "standards capability upgrade retains migration and old state on state construction failure",
  "standards capability upgrade retains migration and old state when state persistence fails",
  "standards capability upgrade retains an uncertain committed state replacement",
  "standards capability upgrade retains the full persisted prefix on post-state disagreement",
  "standards capability upgrade retains the full prefix on post-state state and inference disagreement",
  "standards capability upgrade reports final Git and exact-byte failures after persistence",
];
const compiledProfileTransitionCertificationTests = [
  "the compiled profile-transition planner is repeatable and leaves portfolio controls and Git unchanged",
  "the compiled profile-transition planner refuses an already-site project without mutation",
  "the compiled profile-transition command emits its command-specific malformed-argument refusal",
  "the compiled profile-transition planner refuses the finite unsafe matrix without mutation",
  "the compiled apply-profile-transition command completes default and Calendly portfolio transactions",
  "the compiled profile transition verification failure retains transformed source and old controls",
  "the compiled apply-profile-transition command refuses representative unsafe inputs without mutation",
];
const builderProfileTransitionCertificationTests = [
  "portfolio-to-site profile transition refuses unsupported target inputs without mutation",
  "portfolio-to-site profile transition transforms, verifies, persists state last, and stops for final-diff approval",
  "portfolio-to-site profile transition preserves the optional Calendly capability and settings",
  "portfolio-to-site profile transition refuses malformed, wrong, and stale plan authority without mutation",
  "portfolio-to-site profile transition propagates named planner refusals without mutation",
  "portfolio-to-site profile transition refuses duplicate migration history before writing",
  "portfolio-to-site profile transition refuses unsafe Git and changed pre-write identity",
  "portfolio-to-site profile transition refuses an ignored create target before mutation",
  "portfolio-to-site profile transition contains reader, create-target, and preflight exceptions before writes",
  "portfolio-to-site profile transition distinguishes uncommitted and partial transform failures",
  "portfolio-to-site profile transition contains thrown writer exceptions at every persistence boundary",
  "portfolio-to-site profile transition retains transformed source and old controls on verification or re-inference failure",
  "portfolio-to-site profile transition contains a thrown verifier exception with the transformed prefix",
  "portfolio-to-site profile transition maps clock and migration persistence failures to the retained source prefix",
  "portfolio-to-site profile transition contains a thrown clock exception with the transformed prefix",
  "portfolio-to-site profile transition retains the migration prefix when its reread fails",
  "portfolio-to-site profile transition retains an uncertain committed migration append",
  "portfolio-to-site profile transition retains migration and old state when state persistence fails",
  "portfolio-to-site profile transition retains migration and old state on state construction failure",
  "portfolio-to-site profile transition retains an uncertain committed state replacement",
  "portfolio-to-site profile transition retains the complete persisted prefix when state reread fails",
  "portfolio-to-site profile transition retains the full persisted prefix on post-state disagreement",
  "portfolio-to-site profile transition retains the full prefix on post-state state and inference disagreement",
  "portfolio-to-site profile transition reports final Git and exact-byte failures after persistence",
  "filesystem-backed portfolio-to-site transition verifies binary baselines without an injected byte reader",
  "filesystem-backed portfolio-to-site transition rejects changed final binary bytes without an injected byte reader",
  "filesystem-backed portfolio-to-site transition rejects an ancestor swap during an exact-byte read",
];

function successfulTap(testNames) {
  return [
    "TAP version 13",
    ...testNames.flatMap((name, index) => [
      `# Subtest: ${name}`,
      `ok ${index + 1} - ${name}`,
    ]),
    `1..${testNames.length}`,
    `# tests ${testNames.length}`,
    `# pass ${testNames.length}`,
    "# fail 0",
    "",
  ].join("\n");
}

test("standards lifecycle certification accepts real filtered TAP with passing nested subtests", async (context) => {
  const revision = "a".repeat(40);
  const fixtureRoot = await mkdtemp(
    join(tmpdir(), "egeria-standards-filtered-tap-"),
  );
  context.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  const fixturePath = join(fixtureRoot, "filtered-evidence.test.mjs");
  const fixtureTests = compiledUpgradeCertificationTests.map((name, index) =>
    index === 0
      ? `test(${JSON.stringify(name)}, async (context) => { await context.test("nested reporter evidence", () => {}); });`
      : `test(${JSON.stringify(name)}, () => {});`,
  );
  await writeFile(
    fixturePath,
    [
      'import test from "node:test";',
      ...fixtureTests,
      'test("unselected reporter evidence", () => {});',
      "",
    ].join("\n"),
  );

  let realTap;
  const result = await certifyStandardsLifecycleForTesting(
    { revision },
    {
      readCurrentRevision: async () => revision,
      readRepositoryStatus: async () => "",
      async runCommand(input) {
        if (input.arguments.at(-1) === "apps/cli/tests/cli.test.mjs") {
          const execution = await execFileAsync(
            input.executable,
            [...input.arguments.slice(0, -1), fixturePath],
            {
              cwd: input.cwd,
              env: input.environment,
            },
          );
          realTap = execution.stdout;
          return execution;
        }
        if (input.arguments[0] !== "--test") return { stdout: "{}\n" };
        return { stdout: successfulTap(builderUpgradeCertificationTests) };
      },
    },
  );

  assert.match(realTap, /^    # Subtest: nested reporter evidence$/mu);
  assert.equal(result.ok, true);
});

test("standards lifecycle certification binds the exact revision to causal compiled evidence", async () => {
  const revision = "a".repeat(40);
  const commands = [];
  let revisionReads = 0;
  let statusReads = 0;

  const result = await certifyStandardsLifecycleForTesting(
    { revision },
    {
      async readCurrentRevision() {
        revisionReads += 1;
        return revision;
      },
      async readRepositoryStatus() {
        statusReads += 1;
        return "";
      },
      async runCommand(input) {
        commands.push(input);
        if (input.arguments[0] !== "--test") return { stdout: "{}\n" };
        return {
          stdout: successfulTap(
            input.arguments.at(-1) === "apps/cli/tests/cli.test.mjs"
              ? compiledUpgradeCertificationTests
              : builderUpgradeCertificationTests,
          ),
        };
      },
    },
  );

  assert.equal(revisionReads, 2);
  assert.equal(statusReads, 2);
  assert.deepEqual(
    commands.map(({ executable, arguments: arguments_, cwd, environment }) => ({
      executable,
      arguments: arguments_,
      cwd,
      secrets: [
        environment.CLOUDFLARE_API_TOKEN,
        environment.CLOUDFLARE_ACCOUNT_ID,
        environment.NPM_TOKEN,
      ],
    })),
    [
      {
        executable: process.execPath,
        arguments: [
          "--test",
          "--test-reporter=tap",
          "--test-name-pattern",
          "^the compiled (?:plan-upgrade command plans both profiles without changing any byte|apply-upgrade command completes the exact portfolio and site transactions|standards upgrade verification failure retains transformed source and old controls|plan-upgrade command refuses unsafe or unsupported repository states without writes|apply-upgrade command refuses the finite unsafe matrix without mutation)$",
          "apps/cli/tests/cli.test.mjs",
        ],
        cwd: repositoryRoot,
        secrets: [undefined, undefined, undefined],
      },
      {
        executable: process.execPath,
        arguments: ["scripts/certify-generated-testing.mjs"],
        cwd: repositoryRoot,
        secrets: [undefined, undefined, undefined],
      },
      {
        executable: process.execPath,
        arguments: [
          "--test",
          "--test-reporter=tap",
          "--test-name-pattern",
          "^standards capability upgrade ",
          "packages/builder-core/tests/apply-capability-upgrade.test.mjs",
        ],
        cwd: repositoryRoot,
        secrets: [undefined, undefined, undefined],
      },
    ],
  );
  assert.deepEqual(result, {
    ok: true,
    capability: "standards",
    version: "0.4.0",
    evidenceRevision: revision,
    profiles: ["portfolio", "site"],
    checks: [
      "compiled-plan-upgrade",
      "compiled-apply-upgrade",
      "already-current-refusal",
      "missing-edge-refusal",
      "verification-failure-prefix",
      "migration-before-state",
      "state-persistence-failure-prefix",
      "exact-final-state",
      "fresh-scaffold",
    ],
  });
});

test("standards lifecycle certification fails closed on revision drift and command failure", async () => {
  const revision = "a".repeat(40);
  await assert.rejects(
    certifyStandardsLifecycleForTesting(
      { revision },
      {
        readCurrentRevision: async () => "b".repeat(40),
        readRepositoryStatus: async () => "",
        runCommand: async () => assert.fail("drift must stop before execution"),
      },
    ),
    (error) => error?.code === "EVIDENCE_REVISION_MISMATCH",
  );

  let reads = 0;
  await assert.rejects(
    certifyStandardsLifecycleForTesting(
      { revision },
      {
        readCurrentRevision: async () => {
          reads += 1;
          return revision;
        },
        readRepositoryStatus: async () => "",
        runCommand: async () => {
          throw new Error("private output");
        },
      },
    ),
    (error) => error?.code === "LIFECYCLE_EVIDENCE_FAILED",
  );
  assert.equal(reads, 1);
});

test("standards lifecycle certification rejects dirty inputs before and after evidence", async () => {
  const revision = "a".repeat(40);
  await assert.rejects(
    certifyStandardsLifecycleForTesting(
      { revision },
      {
        readCurrentRevision: async () => revision,
        readRepositoryStatus: async () => " M packages/builder-core/src/index.ts\n",
        runCommand: async () => assert.fail("dirty inputs must stop before execution"),
      },
    ),
    (error) => error?.code === "EVIDENCE_WORKTREE_DIRTY",
  );

  let statusReads = 0;
  let commandRuns = 0;
  await assert.rejects(
    certifyStandardsLifecycleForTesting(
      { revision },
      {
        readCurrentRevision: async () => revision,
        readRepositoryStatus: async () => {
          statusReads += 1;
          return statusReads === 1 ? "" : "?? unexpected-source.ts\0";
        },
        runCommand: async (input) => {
          commandRuns += 1;
          if (input.arguments[0] !== "--test") return { stdout: "{}\n" };
          return {
            stdout: successfulTap(
              input.arguments.at(-1) === "apps/cli/tests/cli.test.mjs"
                ? compiledUpgradeCertificationTests
                : builderUpgradeCertificationTests,
            ),
          };
        },
      },
    ),
    (error) => error?.code === "EVIDENCE_WORKTREE_DIRTY",
  );
  assert.equal(commandRuns, 3);
  assert.equal(statusReads, 2);
});

test("standards lifecycle certification rejects a successful zero-match test process", async () => {
  const revision = "a".repeat(40);
  await assert.rejects(
    certifyStandardsLifecycleForTesting(
      { revision },
      {
        readCurrentRevision: async () => revision,
        readRepositoryStatus: async () => "",
        runCommand: async () => ({
          stdout: [
            "TAP version 13",
            "1..0",
            "# tests 0",
            "# pass 0",
            "# fail 0",
            "",
          ].join("\n"),
        }),
      },
    ),
    (error) => error?.code === "LIFECYCLE_EVIDENCE_FAILED",
  );
});

test("the standards lifecycle certification command requires one exact revision without echoing rejected values", async () => {
  const execution = await execFileAsync(process.execPath, [
    standardsLifecycleCertificationScript,
    "--revision",
    "private-value",
  ]).catch((error) => error);

  assert.equal(execution.code, 2);
  assert.equal(execution.stdout, "");
  assert.deepEqual(JSON.parse(execution.stderr), {
    ok: false,
    code: "CERTIFICATION_ARGUMENT_INVALID",
  });
  assert.doesNotMatch(execution.stderr, /private-value/u);
});

test("profile transition lifecycle certification accepts real TAP with nested and unselected skipped tests", async (context) => {
  const revision = "a".repeat(40);
  const fixtureRoot = await mkdtemp(
    join(tmpdir(), "egeria-profile-transition-filtered-tap-"),
  );
  context.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  const fixturePath = join(fixtureRoot, "filtered-evidence.test.mjs");
  const fixtureTests = compiledProfileTransitionCertificationTests.map(
    (name, index) =>
      index === 0
        ? `test(${JSON.stringify(name)}, async (context) => { await context.test("nested reporter evidence", () => {}); });`
        : `test(${JSON.stringify(name)}, () => {});`,
  );
  await writeFile(
    fixturePath,
    [
      'import test from "node:test";',
      ...fixtureTests,
      'test("unselected reporter evidence", { skip: true }, () => {});',
      "",
    ].join("\n"),
  );

  let realTap;
  const result = await certifyProfileTransitionLifecycleForTesting(
    { revision },
    {
      readCurrentRevision: async () => revision,
      readRepositoryStatus: async () => "",
      readRepositoryIndexEntries: async () => "H selected-evidence.test.mjs\0",
      async runCommand(input) {
        if (input.arguments.at(-1) === "apps/cli/tests/cli.test.mjs") {
          const fixtureArguments = input.arguments.slice(0, -1);
          fixtureArguments.splice(
            fixtureArguments.indexOf("--test-name-pattern"),
            2,
          );
          const execution = await execFileAsync(
            input.executable,
            [...fixtureArguments, fixturePath],
            { cwd: input.cwd, env: input.environment },
          );
          realTap = execution.stdout;
          return execution;
        }
        return { stdout: successfulTap(builderProfileTransitionCertificationTests) };
      },
    },
  );

  assert.match(realTap, /^    # Subtest: nested reporter evidence$/mu);
  assert.match(realTap, /unselected reporter evidence.*# SKIP/mu);
  assert.equal(result.ok, true);
});

test("profile transition lifecycle certification binds the exact revision to causal evidence", async () => {
  const revision = "a".repeat(40);
  const commands = [];
  let revisionReads = 0;
  let statusReads = 0;
  let indexReads = 0;

  const result = await certifyProfileTransitionLifecycleForTesting(
    { revision },
    {
      async readCurrentRevision() {
        revisionReads += 1;
        return revision;
      },
      async readRepositoryStatus() {
        statusReads += 1;
        return "";
      },
      async readRepositoryIndexEntries() {
        indexReads += 1;
        return "H selected-evidence.test.mjs\0";
      },
      async runCommand(input) {
        commands.push(input);
        return {
          stdout: successfulTap(
            input.arguments.at(-1) === "apps/cli/tests/cli.test.mjs"
              ? compiledProfileTransitionCertificationTests
              : builderProfileTransitionCertificationTests,
          ),
        };
      },
    },
  );

  assert.equal(revisionReads, 2);
  assert.equal(statusReads, 2);
  assert.equal(indexReads, 2);
  assert.deepEqual(
    commands.map(({ executable, arguments: arguments_, cwd, environment }) => ({
      executable,
      arguments: arguments_,
      cwd,
      secrets: [
        environment.CLOUDFLARE_API_TOKEN,
        environment.CLOUDFLARE_ACCOUNT_ID,
        environment.NPM_TOKEN,
      ],
    })),
    [
      {
        executable: process.execPath,
        arguments: [
          "--test",
          "--test-reporter=tap",
          "--test-name-pattern",
          "^the compiled (?:profile-transition planner is repeatable and leaves portfolio controls and Git unchanged|profile-transition planner refuses an already-site project without mutation|profile-transition command emits its command-specific malformed-argument refusal|profile-transition planner refuses the finite unsafe matrix without mutation|apply-profile-transition command completes default and Calendly portfolio transactions|profile transition verification failure retains transformed source and old controls|apply-profile-transition command refuses representative unsafe inputs without mutation)$",
          "apps/cli/tests/cli.test.mjs",
        ],
        cwd: repositoryRoot,
        secrets: [undefined, undefined, undefined],
      },
      {
        executable: process.execPath,
        arguments: [
          "--test",
          "--test-reporter=tap",
          "--test-name-pattern",
          "^(?:portfolio-to-site profile transition |filesystem-backed portfolio-to-site transition )",
          "packages/builder-core/tests/apply-profile-transition.test.mjs",
        ],
        cwd: repositoryRoot,
        secrets: [undefined, undefined, undefined],
      },
    ],
  );
  assert.deepEqual(result, {
    ok: true,
    subject: "profile-transition-lifecycle",
    evidenceRevision: revision,
    transition: {
      fromProfile: "portfolio",
      fromRecipeVersion: "0.10.0",
      toProfile: "site",
      toRecipeVersion: "0.10.0",
    },
    migration: "transition-portfolio-0-10-0-to-site-0-10-0",
    checks: [
      "compiled-plan-repeatability",
      "compiled-apply-default",
      "compiled-apply-calendly",
      "already-current-refusal",
      "unsafe-and-malformed-refusal",
      "verification-failure-prefix",
      "transformation-failure-prefix",
      "verification-and-reinference-prefix",
      "migration-persistence-prefix",
      "state-persistence-prefix",
      "post-state-prefix",
      "final-diff-and-byte-inspection",
      "exact-resultant-state",
    ],
  });
});

test("profile transition lifecycle certification fails closed on revision, status, and command drift", async () => {
  const revision = "a".repeat(40);
  await assert.rejects(
    certifyProfileTransitionLifecycleForTesting(
      { revision },
      {
        readCurrentRevision: async () => "b".repeat(40),
        readRepositoryStatus: async () => "",
        readRepositoryIndexEntries: async () => "H selected-evidence.test.mjs\0",
        runCommand: async () => assert.fail("drift must stop before execution"),
      },
    ),
    (error) => error?.code === "EVIDENCE_REVISION_MISMATCH",
  );

  await assert.rejects(
    certifyProfileTransitionLifecycleForTesting(
      { revision },
      {
        readCurrentRevision: async () => revision,
        readRepositoryStatus: async () => " M private-source.ts\0",
        readRepositoryIndexEntries: async () => "H selected-evidence.test.mjs\0",
        runCommand: async () => assert.fail("dirty input must not execute"),
      },
    ),
    (error) => error?.code === "EVIDENCE_WORKTREE_DIRTY",
  );

  await assert.rejects(
    certifyProfileTransitionLifecycleForTesting(
      { revision },
      {
        readCurrentRevision: async () => revision,
        readRepositoryStatus: async () => "",
        readRepositoryIndexEntries: async () => "H selected-evidence.test.mjs\0",
        runCommand: async () => {
          throw new Error("private output");
        },
      },
    ),
    (error) => error?.code === "LIFECYCLE_EVIDENCE_FAILED",
  );

  let statusReads = 0;
  let commandRuns = 0;
  await assert.rejects(
    certifyProfileTransitionLifecycleForTesting(
      { revision },
      {
        readCurrentRevision: async () => revision,
        readRepositoryIndexEntries: async () => "H selected-evidence.test.mjs\0",
        readRepositoryStatus: async () => {
          statusReads += 1;
          return statusReads === 1 ? "" : "?? unexpected-source.ts\0";
        },
        runCommand: async (input) => {
          commandRuns += 1;
          return {
            stdout: successfulTap(
              input.arguments.at(-1) === "apps/cli/tests/cli.test.mjs"
                ? compiledProfileTransitionCertificationTests
                : builderProfileTransitionCertificationTests,
            ),
          };
        },
      },
    ),
    (error) => error?.code === "EVIDENCE_WORKTREE_DIRTY",
  );
  assert.equal(commandRuns, 2);
  assert.equal(statusReads, 2);

  let indexReads = 0;
  let indexCommandRuns = 0;
  await assert.rejects(
    certifyProfileTransitionLifecycleForTesting(
      { revision },
      {
        readCurrentRevision: async () => revision,
        readRepositoryStatus: async () => "",
        readRepositoryIndexEntries: async () => {
          indexReads += 1;
          return indexReads === 1
            ? "H selected-evidence.test.mjs\0"
            : "S selected-evidence.test.mjs\0";
        },
        runCommand: async (input) => {
          indexCommandRuns += 1;
          return {
            stdout: successfulTap(
              input.arguments.at(-1) === "apps/cli/tests/cli.test.mjs"
                ? compiledProfileTransitionCertificationTests
                : builderProfileTransitionCertificationTests,
            ),
          };
        },
      },
    ),
    (error) => error?.code === "EVIDENCE_WORKTREE_INDEX_FLAGS",
  );
  assert.equal(indexCommandRuns, 2);
  assert.equal(indexReads, 2);
});

test("profile transition lifecycle certification rejects Git index flags that hide evidence changes", async (context) => {
  const revision = "a".repeat(40);

  for (const hiddenFlag of ["--assume-unchanged", "--skip-worktree"]) {
    const fixtureRoot = await mkdtemp(
      join(tmpdir(), "egeria-hidden-certification-evidence-"),
    );
    context.after(() => rm(fixtureRoot, { recursive: true, force: true }));
    const evidencePath = "selected-evidence.test.mjs";
    await execFileAsync("git", ["init", "--quiet"], { cwd: fixtureRoot });
    await writeFile(join(fixtureRoot, evidencePath), "export const value = 1;\n");
    await execFileAsync("git", ["add", evidencePath], { cwd: fixtureRoot });
    await execFileAsync(
      "git",
      [
        "-c",
        "user.name=Certification Test",
        "-c",
        "user.email=certification-test@example.invalid",
        "commit",
        "--quiet",
        "-m",
        "Add evidence fixture",
      ],
      { cwd: fixtureRoot },
    );
    await execFileAsync("git", ["update-index", hiddenFlag, evidencePath], {
      cwd: fixtureRoot,
    });
    await writeFile(join(fixtureRoot, evidencePath), "export const value = 2;\n");

    const [{ stdout: status }, { stdout: indexEntries }] = await Promise.all([
      execFileAsync(
        "git",
        ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
        { cwd: fixtureRoot },
      ),
      execFileAsync("git", ["ls-files", "-v", "-z"], { cwd: fixtureRoot }),
    ]);
    assert.equal(status, "");

    await assert.rejects(
      certifyProfileTransitionLifecycleForTesting(
        { revision },
        {
          readCurrentRevision: async () => revision,
          readRepositoryStatus: async () => status,
          readRepositoryIndexEntries: async () => indexEntries,
          runCommand: async () =>
            assert.fail("hidden index flags must stop before evidence"),
        },
      ),
      (error) => error?.code === "EVIDENCE_WORKTREE_INDEX_FLAGS",
    );
  }
});

test("profile transition lifecycle certification rejects zero-match, selected-skip, and malformed TAP", async () => {
  const revision = "a".repeat(40);
  const invalidOutputs = [
    ["TAP version 13", "1..0", "# tests 0", "# pass 0", "# fail 0", ""].join("\n"),
    [
      "TAP version 13",
      ...compiledProfileTransitionCertificationTests.flatMap((name, index) => [
        `# Subtest: ${name}`,
        index === 0
          ? `ok ${index + 1} - ${name} # SKIP selected evidence`
          : `ok ${index + 1} - ${name}`,
      ]),
      `1..${compiledProfileTransitionCertificationTests.length}`,
      `# tests ${compiledProfileTransitionCertificationTests.length}`,
      `# pass ${compiledProfileTransitionCertificationTests.length - 1}`,
      "# fail 0",
      "# skipped 1",
      "",
    ].join("\n"),
    "not TAP\n",
  ];

  for (const stdout of invalidOutputs) {
    await assert.rejects(
      certifyProfileTransitionLifecycleForTesting(
        { revision },
        {
          readCurrentRevision: async () => revision,
          readRepositoryStatus: async () => "",
          readRepositoryIndexEntries: async () => "H selected-evidence.test.mjs\0",
          runCommand: async () => ({ stdout }),
        },
      ),
      (error) => error?.code === "LIFECYCLE_EVIDENCE_FAILED",
    );
  }
});

test("the profile transition lifecycle certification command requires one exact revision without echoing rejected values", async () => {
  const execution = await execFileAsync(process.execPath, [
    profileTransitionLifecycleCertificationScript,
    "--revision",
    "private-value",
  ]).catch((error) => error);

  assert.equal(execution.code, 2);
  assert.equal(execution.stdout, "");
  assert.deepEqual(JSON.parse(execution.stderr), {
    ok: false,
    code: "CERTIFICATION_ARGUMENT_INVALID",
  });
  assert.doesNotMatch(execution.stderr, /private-value/u);
});

const fixedChecks = Object.freeze([
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
  "next-build",
  "opennext-build",
  "browser-install",
  "browser-development",
  "browser-preview",
]);
const visualChecks = Object.freeze([...fixedChecks, "visual-regression"]);
const contentFixtureChecks = Object.freeze([
  "content-fixture-overlay",
  "content-fixture-frozen-install",
  "content-fixture-unit-contract",
  "content-fixture-browser-install",
  "content-fixture-browser-development",
]);
const sectionCompositionFixtureChecks = Object.freeze([
  "section-composition-fixture-overlay",
  "section-composition-fixture-frozen-install",
  "section-composition-fixture-unit-contract",
  "section-composition-fixture-component-contract",
  "section-composition-fixture-browser-install",
  "section-composition-fixture-browser-development",
]);
const siteRoutingFixtureChecks = Object.freeze([
  "site-routing-fixture-overlay",
  "site-routing-fixture-frozen-install",
  "site-routing-fixture-component-contract",
  "site-routing-fixture-browser-install",
  "site-routing-fixture-browser-development",
]);

function createCertificationCliRuntime(arguments_ = []) {
  const scriptPath = resolve(
    repositoryRoot,
    "scripts/example-certification.mjs",
  );
  const stdout = [];
  const stderr = [];
  const runtime = {
    argv: [process.execPath, scriptPath, ...arguments_],
    stdout: { write: (value) => stdout.push(value) },
    stderr: { write: (value) => stderr.push(value) },
    exitCode: undefined,
  };

  return {
    moduleUrl: pathToFileURL(scriptPath).href,
    runtime,
    stdout,
    stderr,
  };
}

test("the certification CLI runner is inert when its module is imported", async () => {
  const execution = createCertificationCliRuntime();
  execution.runtime.argv[1] = resolve(repositoryRoot, "scripts/importer.mjs");

  await runCertificationCli(
    {
      moduleUrl: execution.moduleUrl,
      parseArguments: () => assert.fail("an imported module must not parse"),
      certify: () => assert.fail("an imported module must not certify"),
      isCertificationError: () => false,
    },
    execution.runtime,
  );

  assert.deepEqual(execution.stdout, []);
  assert.deepEqual(execution.stderr, []);
  assert.equal(execution.runtime.exitCode, undefined);
});

test("the certification CLI runner owns argument, success, and failure framing", async (context) => {
  await context.test("rejects arguments without echoing them", async () => {
    const execution = createCertificationCliRuntime([
      "--unknown",
      "private-value",
    ]);

    await runCertificationCli(
      {
        moduleUrl: execution.moduleUrl,
        parseArguments: () => undefined,
        certify: () => assert.fail("invalid arguments must not certify"),
        isCertificationError: () => false,
      },
      execution.runtime,
    );

    assert.deepEqual(execution.stdout, []);
    assert.deepEqual(execution.stderr, [
      `${JSON.stringify({
        ok: false,
        code: "CERTIFICATION_ARGUMENT_INVALID",
      })}\n`,
    ]);
    assert.equal(execution.runtime.exitCode, 2);
    assert.doesNotMatch(execution.stderr.join(""), /private-value/u);
  });

  await context.test("writes one JSON success result", async () => {
    const execution = createCertificationCliRuntime();

    await runCertificationCli(
      {
        moduleUrl: execution.moduleUrl,
        parseArguments: () => ({ profile: "portfolio" }),
        certify: async (input) => ({ ok: true, profile: input.profile }),
        isCertificationError: () => false,
      },
      execution.runtime,
    );

    assert.deepEqual(execution.stdout, [
      `${JSON.stringify({ ok: true, profile: "portfolio" })}\n`,
    ]);
    assert.deepEqual(execution.stderr, []);
    assert.equal(execution.runtime.exitCode, undefined);
  });

  class LocalCertificationError extends Error {
    constructor(code) {
      super("certification failed");
      this.code = code;
    }
  }

  for (const [name, error, expectedCode] of [
    [
      "preserves a typed certification code",
      new LocalCertificationError("TYPED_FAILURE"),
      "TYPED_FAILURE",
    ],
    [
      "contains an untyped failure",
      new Error("private-value"),
      "CERTIFICATION_FAILED",
    ],
  ]) {
    await context.test(name, async () => {
      const execution = createCertificationCliRuntime();

      await runCertificationCli(
        {
          moduleUrl: execution.moduleUrl,
          parseArguments: () => ({}),
          certify: async () => {
            throw error;
          },
          isCertificationError: (candidate) =>
            candidate instanceof LocalCertificationError,
        },
        execution.runtime,
      );

      assert.deepEqual(execution.stdout, []);
      assert.deepEqual(execution.stderr, [
        `${JSON.stringify({ ok: false, code: expectedCode })}\n`,
      ]);
      assert.equal(execution.runtime.exitCode, 1);
      assert.doesNotMatch(execution.stderr.join(""), /private-value/u);
    });
  }
});

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function createSuccessfulScaffoldAdapters({
  diagnostics = Object.freeze({ healthy: true, diagnostics: [] }),
  differences = Object.freeze({ equal: true, differences: [] }),
  inferredCapability,
  profile = "portfolio",
  expectedCapabilities = Object.freeze([
    "standards",
    "content-files",
    "section-composition",
    "deployment-cloudflare",
    "observability",
  ]),
  readCurrentRevision,
  readRepositoryStatus = async () => "",
  readRepositoryIndexEntries = async () =>
    "H selected-evidence.test.mjs\0",
  postCreate = async () => {},
  verifyFixture,
  verificationChecks = fixedChecks,
  verificationFixtures,
  verifierIdentifier = "portfolio",
}) {
  const state = {
    commands: [],
    ownedPath: undefined,
    projectRoot: undefined,
    verifiedProjectName: undefined,
    verifiedRoot: undefined,
    verificationOptions: undefined,
    fixtureInput: undefined,
  };

  return {
    state,
    adapters: {
      readCurrentRevision,
      readRepositoryStatus,
      readRepositoryIndexEntries,
      async runCommand(input) {
        state.commands.push(input);
        assert.equal(input.executable, process.execPath);
        assert.equal(input.environment.CLOUDFLARE_API_TOKEN, undefined);
        assert.equal(input.environment.CLOUDFLARE_ACCOUNT_ID, undefined);
        assert.equal(input.environment.NPM_TOKEN, undefined);
        assert.equal(input.environment.NODE_OPTIONS, undefined);
        const command = input.arguments[1];

        if (command === "create") {
          state.projectRoot = input.arguments[
            input.arguments.indexOf("--directory") + 1
          ];
          state.ownedPath = dirname(state.projectRoot);
          assert.equal((await lstat(state.ownedPath)).mode & 0o777, 0o700);
          await postCreate(state.projectRoot);
          return `${JSON.stringify({
            ok: true,
            command: "create",
            destination: state.projectRoot,
            profile,
            capabilities: expectedCapabilities,
          })}\n`;
        }
        if (command === "infer") {
          return `${JSON.stringify({
            ok: true,
            command: "infer",
            result: {
              state: {
                kind: "valid",
                value: { installedCapabilities: [inferredCapability] },
              },
              capabilities: [
                {
                  identifier: inferredCapability.identifier,
                  category: "confirmed",
                },
              ],
            },
          })}\n`;
        }
        if (command === "doctor") {
          return `${JSON.stringify({
            ok: true,
            command: "doctor",
            result: diagnostics,
          })}\n`;
        }
        if (command === "diff") {
          return `${JSON.stringify({
            ok: true,
            command: "diff",
            result: differences,
          })}\n`;
        }
        throw new Error("unexpected command");
      },
      async verifyProject(root, identifier, expectedProjectName, options) {
        state.verifiedRoot = root;
        state.verifiedProjectName = expectedProjectName;
        state.verificationOptions = options;
        assert.equal(identifier, verifierIdentifier);
        return {
          ok: true,
          fixtures: verificationFixtures ?? [verifierIdentifier],
          profiles: [profile],
          checks: verificationChecks,
        };
      },
      ...(verifyFixture === undefined
        ? {}
        : {
            async verifyFixture(input) {
              state.fixtureInput = input;
              return verifyFixture(input);
            },
          }),
    },
  };
}

test("section composition certification binds both supported fresh-scaffold profiles to one clean exact subject", async () => {
  const revision = "a".repeat(40);
  let revisionReads = 0;
  let statusReads = 0;
  let indexReads = 0;
  const authority = {
    readCurrentRevision: async () => {
      revisionReads += 1;
      return revision;
    },
    readRepositoryStatus: async () => {
      statusReads += 1;
      return "";
    },
    readRepositoryIndexEntries: async () => {
      indexReads += 1;
      return "H selected-evidence.test.mjs\0";
    },
  };
  const portfolio = createSuccessfulScaffoldAdapters({
    inferredCapability: {
      identifier: "section-composition",
      version: "0.3.0",
    },
    readCurrentRevision: authority.readCurrentRevision,
    postCreate: (projectRoot) => writeRecipeVersion(projectRoot, "0.10.0"),
    verifyFixture: async ({ environment }) => {
      assert.equal(environment.CLOUDFLARE_API_TOKEN, undefined);
      assert.equal(environment.CLOUDFLARE_ACCOUNT_ID, undefined);
      assert.equal(environment.NPM_TOKEN, undefined);
      return { ok: true, checks: sectionCompositionFixtureChecks };
    },
  });
  const site = createSuccessfulScaffoldAdapters({
    expectedCapabilities: Object.freeze([
      "standards",
      "content-files",
      "section-composition",
      "deployment-cloudflare",
      "observability",
      "site-routing",
    ]),
    inferredCapability: {
      identifier: "section-composition",
      version: "0.3.0",
    },
    profile: "site",
    readCurrentRevision: authority.readCurrentRevision,
    postCreate: (projectRoot) => writeRecipeVersion(projectRoot, "0.10.0"),
    verifierIdentifier: "site",
  });

  const result = await certifySectionCompositionForTesting(
    { revision },
    {
      ...authority,
      journeys: { portfolio: portfolio.adapters, site: site.adapters },
    },
  );

  assert.deepEqual(result, {
    ok: true,
    capability: "section-composition",
    version: "0.3.0",
    profiles: ["portfolio", "site"],
    subject: {
      descriptorVersion: "0.3.0",
      behaviorContractDigest:
        "sha256:4f63f9d6169048b5a1f5b1d042b3a0ddaa22ca1273d1acadf6235ce93e616696",
    },
    recipeVersion: "0.10.0",
    locale: "en-CA",
    evidenceRevision: revision,
    checks: [
      ...[
        "compiled-cli-create",
        "state-inference",
        "healthy-diagnostics",
        "exact-diff",
        ...fixedChecks,
        ...sectionCompositionFixtureChecks,
      ].map((check) => `portfolio:${check}`),
      ...[
        "compiled-cli-create",
        "state-inference",
        "healthy-diagnostics",
        "exact-diff",
        ...fixedChecks,
      ].map((check) => `site:${check}`),
      "repository-sources-unchanged",
    ],
  });
  assert.equal(portfolio.state.verifiedRoot, portfolio.state.projectRoot);
  assert.equal(portfolio.state.fixtureInput.projectRoot, portfolio.state.projectRoot);
  assert.equal(site.state.verifiedRoot, site.state.projectRoot);
  assert.equal(site.state.fixtureInput, undefined);
  assert.equal(revisionReads, 2);
  assert.equal(statusReads, 2);
  assert.equal(indexReads, 2);
  assert.equal(await pathExists(portfolio.state.ownedPath), false);
  assert.equal(await pathExists(site.state.ownedPath), false);
});

test("section composition fixture verification applies the exact isolated overlay and command sequence", async () => {
  const ownedRoot = await mkdtemp(
    join(tmpdir(), "section-composition-fixture-verifier-"),
  );
  const projectRoot = join(ownedRoot, "generated-project");
  const supportRoot = join(
    ownedRoot,
    "section-composition-fixture-support",
  );
  const commands = [];

  try {
    const { verifySectionCompositionFixtureForTesting } = await import(
      "../../scripts/certify-section-composition.mjs"
    );
    const result = await verifySectionCompositionFixtureForTesting({
      projectRoot,
      environment: { PATH: "/verified/bin" },
      runCommand: async (command) => {
        commands.push(command);
      },
    });

    assert.deepEqual(result, {
      ok: true,
      checks: sectionCompositionFixtureChecks,
    });
    for (const [source, destination] of [
      [
        "section-composition-certification.test.ts",
        "apps/web/tests/unit/section-composition-certification.test.ts",
      ],
      [
        "section-composition-certification.test.tsx",
        "apps/web/tests/component/section-composition-certification.test.tsx",
      ],
      [
        "section-composition-certification.spec.ts",
        "apps/web/tests/e2e/section-composition-certification.spec.ts",
      ],
    ]) {
      assert.equal(
        await readFile(join(projectRoot, destination), "utf8"),
        await readFile(
          join(
            repositoryRoot,
            "tests/capability-certification/fixtures/section-composition",
            source,
          ),
          "utf8",
        ),
      );
    }
    assert.deepEqual(
      commands.map(({ executable, arguments: arguments_, cwd, timeout }) => ({
        executable,
        arguments: arguments_,
        cwd,
        timeout,
      })),
      [
        {
          executable: "pnpm",
          arguments: [
            "install",
            "--frozen-lockfile",
            "--store-dir",
            join(supportRoot, "store"),
          ],
          cwd: projectRoot,
          timeout: 15 * 60 * 1000,
        },
        {
          executable: "pnpm",
          arguments: [
            "--dir",
            "apps/web",
            "exec",
            "vitest",
            "run",
            "--project",
            "unit",
            "tests/unit/section-composition-certification.test.ts",
          ],
          cwd: projectRoot,
          timeout: 15 * 60 * 1000,
        },
        {
          executable: "pnpm",
          arguments: [
            "--dir",
            "apps/web",
            "exec",
            "vitest",
            "run",
            "--project",
            "component",
            "tests/component/section-composition-certification.test.tsx",
          ],
          cwd: projectRoot,
          timeout: 15 * 60 * 1000,
        },
        {
          executable: "pnpm",
          arguments: ["--dir", "apps/web", "run", "browser:install"],
          cwd: projectRoot,
          timeout: 15 * 60 * 1000,
        },
        {
          executable: "pnpm",
          arguments: [
            "--dir",
            "apps/web",
            "exec",
            "playwright",
            "test",
            "--config",
            "playwright.dev.config.ts",
            "tests/e2e/section-composition-certification.spec.ts",
          ],
          cwd: projectRoot,
          timeout: 15 * 60 * 1000,
        },
      ],
    );
    for (const command of commands) {
      assert.equal(command.environment.PATH, "/verified/bin");
      assert.equal(command.environment.HOME, join(supportRoot, "home"));
      assert.equal(command.environment.USERPROFILE, join(supportRoot, "home"));
      assert.equal(
        command.environment.PLAYWRIGHT_BROWSERS_PATH,
        join(supportRoot, "playwright-browsers"),
      );
      assert.equal(
        command.environment.NPM_CONFIG_USERCONFIG,
        join(supportRoot, ".npmrc"),
      );
      assert.equal(
        command.environment.NPM_CONFIG_REGISTRY,
        "https://registry.npmjs.org/",
      );
      assert.equal(command.environment.TMPDIR, join(supportRoot, "temporary"));
      assert.equal(command.environment.TMP, join(supportRoot, "temporary"));
      assert.equal(command.environment.TEMP, join(supportRoot, "temporary"));
      assert.equal(command.environment.XDG_CACHE_HOME, join(supportRoot, "cache"));
    }
  } finally {
    await rm(ownedRoot, { recursive: true, force: true });
  }
});

test("section composition certification fails closed on authority and journey drift", async (context) => {
  const revision = "a".repeat(40);
  const createJourneys = (authorityOverrides = {}, siteOverrides = {}) => {
    const authority = {
      readCurrentRevision: async () => revision,
      readRepositoryStatus: async () => "",
      readRepositoryIndexEntries: async () =>
        "H selected-evidence.test.mjs\0",
      ...authorityOverrides,
    };
    const portfolio = createSuccessfulScaffoldAdapters({
      inferredCapability: {
        identifier: "section-composition",
        version: "0.3.0",
      },
      readCurrentRevision: authority.readCurrentRevision,
      postCreate: (projectRoot) => writeRecipeVersion(projectRoot, "0.10.0"),
      verifyFixture: async () => ({
        ok: true,
        checks: sectionCompositionFixtureChecks,
      }),
    });
    const site = createSuccessfulScaffoldAdapters({
      expectedCapabilities: Object.freeze([
        "standards",
        "content-files",
        "section-composition",
        "deployment-cloudflare",
        "observability",
        "site-routing",
      ]),
      inferredCapability: {
        identifier: "section-composition",
        version: "0.3.0",
      },
      profile: "site",
      readCurrentRevision: authority.readCurrentRevision,
      postCreate: (projectRoot) => writeRecipeVersion(projectRoot, "0.10.0"),
      verifierIdentifier: "site",
      ...siteOverrides,
    });
    return {
      adapters: {
        ...authority,
        journeys: { portfolio: portfolio.adapters, site: site.adapters },
      },
      portfolio,
      site,
    };
  };

  await context.test("rejects a dirty worktree before either journey", async () => {
    const setup = createJourneys({
      readRepositoryStatus: async () => "?? private-source.ts\0",
    });
    await assert.rejects(
      certifySectionCompositionForTesting({ revision }, setup.adapters),
      (error) => error?.code === "CERTIFICATION_WORKTREE_DIRTY",
    );
    assert.equal(setup.portfolio.state.commands.length, 0);
    assert.equal(setup.site.state.commands.length, 0);
  });

  await context.test("rejects hidden index flags before either journey", async () => {
    const setup = createJourneys({
      readRepositoryIndexEntries: async () =>
        "S selected-evidence.test.mjs\0",
    });
    await assert.rejects(
      certifySectionCompositionForTesting({ revision }, setup.adapters),
      (error) => error?.code === "CERTIFICATION_INDEX_FLAGS",
    );
    assert.equal(setup.portfolio.state.commands.length, 0);
    assert.equal(setup.site.state.commands.length, 0);
  });

  await context.test("rejects worktree drift after both contained journeys", async () => {
    let statusReads = 0;
    const setup = createJourneys({
      readRepositoryStatus: async () => {
        statusReads += 1;
        return statusReads === 1 ? "" : "?? private-source.ts\0";
      },
    });
    await assert.rejects(
      certifySectionCompositionForTesting({ revision }, setup.adapters),
      (error) => error?.code === "CERTIFICATION_WORKTREE_DIRTY",
    );
    assert.equal(
      setup.portfolio.state.verifiedRoot,
      setup.portfolio.state.projectRoot,
    );
    assert.equal(setup.site.state.verifiedRoot, setup.site.state.projectRoot);
    assert.equal(await pathExists(setup.portfolio.state.ownedPath), false);
    assert.equal(await pathExists(setup.site.state.ownedPath), false);
  });

  await context.test("rejects index-flag drift after both contained journeys", async () => {
    let indexReads = 0;
    const setup = createJourneys({
      readRepositoryIndexEntries: async () => {
        indexReads += 1;
        return `${indexReads === 1 ? "H" : "S"} selected-evidence.test.mjs\0`;
      },
    });
    await assert.rejects(
      certifySectionCompositionForTesting({ revision }, setup.adapters),
      (error) => error?.code === "CERTIFICATION_INDEX_FLAGS",
    );
    assert.equal(
      setup.portfolio.state.verifiedRoot,
      setup.portfolio.state.projectRoot,
    );
    assert.equal(setup.site.state.verifiedRoot, setup.site.state.projectRoot);
    assert.equal(await pathExists(setup.portfolio.state.ownedPath), false);
    assert.equal(await pathExists(setup.site.state.ownedPath), false);
  });

  await context.test("rejects an invalid site verification identity", async () => {
    const setup = createJourneys({}, { verificationChecks: fixedChecks.slice(1) });
    await assert.rejects(
      certifySectionCompositionForTesting({ revision }, setup.adapters),
      (error) => error?.code === "GENERATED_PROJECT_VERIFICATION_INVALID",
    );
    assert.equal(await pathExists(setup.portfolio.state.ownedPath), false);
    assert.equal(await pathExists(setup.site.state.ownedPath), false);
  });

  await context.test("rejects revision drift after both contained journeys", async () => {
    let reads = 0;
    const setup = createJourneys({
      readCurrentRevision: async () => {
        reads += 1;
        return reads === 1 ? revision : "b".repeat(40);
      },
    });
    await assert.rejects(
      certifySectionCompositionForTesting({ revision }, setup.adapters),
      (error) => error?.code === "CERTIFICATION_REVISION_MISMATCH",
    );
    assert.equal(await pathExists(setup.portfolio.state.ownedPath), false);
    assert.equal(await pathExists(setup.site.state.ownedPath), false);
  });
});

test("the section composition certification command requires one exact revision without echoing rejected values", async () => {
  for (const [arguments_, expectedCode, expectedExitCode] of [
    [["--revision", "private-value"], "CERTIFICATION_REVISION_INVALID", 1],
    [
      ["--", "--revision", "private-value"],
      "CERTIFICATION_REVISION_INVALID",
      1,
    ],
    [["--unknown", "private-value"], "CERTIFICATION_ARGUMENT_INVALID", 2],
  ]) {
    const execution = await execFileAsync(
      process.execPath,
      [sectionCompositionCertificationScript, ...arguments_],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        env: { PATH: process.env.PATH },
      },
    ).catch((error) => error);

    assert.equal(execution.code, expectedExitCode);
    assert.equal(execution.stdout, "");
    assert.deepEqual(JSON.parse(execution.stderr), {
      ok: false,
      code: expectedCode,
    });
    assert.doesNotMatch(execution.stderr, /private-value/u);
  }
});

async function writeRecipeVersion(projectRoot, version) {
  await mkdir(join(projectRoot, ".egeria"), { recursive: true });
  await writeFile(
    join(projectRoot, ".egeria/project.yaml"),
    `recipeVersion: ${version}\n`,
  );
}

async function copyCertificationRuntime(cleanRoot) {
  await chmod(cleanRoot, 0o700);
  await mkdir(join(cleanRoot, "scripts"), { recursive: true });
  await mkdir(join(cleanRoot, "certifications"), { recursive: true });
  await mkdir(join(cleanRoot, "packages/builder-core"), { recursive: true });
  await mkdir(join(cleanRoot, "node_modules"), { recursive: true });
  const cleanCheckScript = join(
    cleanRoot,
    "scripts/check-capability-certification.mjs",
  );
  await copyFile(checkScript, cleanCheckScript);
  await cp(builderCoreDistPath, join(cleanRoot, "packages/builder-core/dist"), {
    recursive: true,
  });
  for (const dependency of ["yaml", "zod"]) {
    await cp(
      join(builderCoreNodeModulesPath, dependency),
      join(cleanRoot, "node_modules", dependency),
      { dereference: true, recursive: true },
    );
  }
  return cleanCheckScript;
}

function createPrivateRegistry(revision) {
  return {
    schemaVersion: "1.0.0",
    records: {
      "booking-calendly": {
        subject: privateSubject,
        requiredEvidence: ["fresh-scaffold"],
        status: "certified",
        taskPlan: privatePlanPath,
        evidence: [
          {
            kind: "fresh-scaffold",
            path: privateEvidencePath,
            outcome: "passed",
            revision,
            subject: privateSubject,
          },
        ],
      },
    },
  };
}

function createPrivateEvidence(revision, decision = "accepted") {
  return [
    "**Certification capability:** `booking-calendly`",
    "**Certification descriptor version:** `0.1.0`",
    `**Certification behavior-contract digest:** \`${privateSubject.behaviorContractDigest}\``,
    `**Certification evidence revision:** \`${revision}\``,
    "**Passed certification outcomes:** `fresh-scaffold`",
    "**Reviewed certification outcomes:** `fresh-scaffold`",
    "**Certification receipt status:** `complete`",
    `**Certification reviewer decision:** \`${decision}\``,
    "**Certification unresolved prompts:** `none`",
  ].join("\n");
}

async function writePrivateValidationFixture(
  cleanRoot,
  revision,
  decision = "accepted",
) {
  await mkdir(dirname(join(cleanRoot, privatePlanPath)), { recursive: true });
  await mkdir(dirname(join(cleanRoot, privateEvidencePath)), { recursive: true });
  await writeFile(join(cleanRoot, privatePlanPath), "# Private plan\n", "utf8");
  await writeFile(
    join(cleanRoot, privateEvidencePath),
    createPrivateEvidence(revision, decision),
    "utf8",
  );
  await writeFile(
    join(cleanRoot, "certifications/capabilities.json"),
    `${JSON.stringify(createPrivateRegistry(revision), null, 2)}\n`,
    "utf8",
  );
}

function assertArtifactIssue(result, code) {
  assert.equal(result.exitCode, 1);
  assert.equal(result.stderr, "");
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.gate, "artifacts");
  assert.equal(report.issues.some((issue) => issue.code === code), true);
}

async function runCheck(
  arguments_,
  { cwd = repositoryRoot, script = checkScript } = {},
) {
  try {
    const result = await execFileAsync(process.execPath, [script, ...arguments_], {
      cwd,
      encoding: "utf8",
      env: { PATH: process.env.PATH },
    });
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return {
      exitCode: error.code,
      stdout: error.stdout,
      stderr: error.stderr,
    };
  }
}

test("the repository registry admits current subjects and refuses pending closure", async () => {
  const admission = await runCheck([]);
  assert.deepEqual(admission, {
    exitCode: 0,
    stdout: `${JSON.stringify({
      ok: true,
      gate: "admission",
      records: 7,
    })}\n`,
    stderr: "",
  });

  const closure = await runCheck(["--closure", "legacy-backfill-exempt"]);
  assert.deepEqual(closure, {
    exitCode: 1,
    stdout: `${JSON.stringify({
      ok: false,
      gate: "closure",
      policy: "legacy-backfill-exempt",
      issues: [
        {
          code: "CAPABILITY_CERTIFICATION_PENDING",
          path: ["records", "site-routing", "status"],
          context: { reason: "pending" },
        },
      ],
    })}\n`,
    stderr: "",
  });

  const fullClosure = await runCheck(["--closure", "all-certified"]);
  assert.deepEqual(fullClosure, {
    exitCode: 1,
    stdout: `${JSON.stringify({
      ok: false,
      gate: "closure",
      policy: "all-certified",
      issues: [
        {
          code: "CAPABILITY_CERTIFICATION_PENDING",
          path: ["records", "site-routing", "status"],
          context: { reason: "pending" },
        },
      ],
    })}\n`,
    stderr: "",
  });
});

test("the ordinary certification gate does not require private workflow artifacts", async () => {
  const cleanRoot = await mkdtemp(
    join(tmpdir(), "egeria-certification-clean-checkout-"),
  );

  try {
    const cleanCheckScript = await copyCertificationRuntime(cleanRoot);
    await copyFile(
      certificationRegistryPath,
      join(cleanRoot, "certifications/capabilities.json"),
    );

    const result = await runCheck([], {
      cwd: cleanRoot,
      script: cleanCheckScript,
    });

    assert.deepEqual(result, {
      exitCode: 0,
      stdout: `${JSON.stringify({
        ok: true,
        gate: "admission",
        records: 7,
      })}\n`,
      stderr: "",
    });
  } finally {
    await rm(cleanRoot, { recursive: true, force: true });
  }
});

test("private certification validation rejects missing, rejected, and non-ancestor evidence", async () => {
  const cleanRoot = await mkdtemp(
    join(tmpdir(), "egeria-private-certification-validation-"),
  );

  try {
    const cleanCheckScript = await copyCertificationRuntime(cleanRoot);
    await writeFile(join(cleanRoot, "baseline.txt"), "baseline\n", "utf8");
    await execFileAsync("git", ["init", "--quiet"], { cwd: cleanRoot });
    await execFileAsync("git", ["add", "baseline.txt"], { cwd: cleanRoot });
    await execFileAsync(
      "git",
      [
        "-c",
        "user.name=Certification Test",
        "-c",
        "user.email=certification@example.invalid",
        "commit",
        "--quiet",
        "-m",
        "baseline",
      ],
      { cwd: cleanRoot },
    );
    const { stdout: revisionOutput } = await execFileAsync(
      "git",
      ["rev-parse", "HEAD"],
      { cwd: cleanRoot, encoding: "utf8" },
    );
    const revision = revisionOutput.trim();
    await writePrivateValidationFixture(cleanRoot, revision);

    const accepted = await runCheck(["--artifacts"], {
      cwd: cleanRoot,
      script: cleanCheckScript,
    });
    assert.deepEqual(accepted, {
      exitCode: 0,
      stdout: `${JSON.stringify({
        ok: true,
        gate: "artifacts",
        records: 1,
      })}\n`,
      stderr: "",
    });

    await rm(join(cleanRoot, privateEvidencePath));
    assertArtifactIssue(
      await runCheck(["--artifacts"], {
        cwd: cleanRoot,
        script: cleanCheckScript,
      }),
      "CERTIFICATION_EVIDENCE_MISSING",
    );

    await writePrivateValidationFixture(cleanRoot, revision, "rejected");
    assertArtifactIssue(
      await runCheck(["--artifacts"], {
        cwd: cleanRoot,
        script: cleanCheckScript,
      }),
      "CERTIFICATION_EVIDENCE_REVIEW_REJECTED",
    );

    const nonAncestorRevision = "0".repeat(40);
    await writePrivateValidationFixture(cleanRoot, nonAncestorRevision);
    assertArtifactIssue(
      await runCheck(["--artifacts"], {
        cwd: cleanRoot,
        script: cleanCheckScript,
      }),
      "CERTIFICATION_EVIDENCE_REVISION_UNKNOWN",
    );
  } finally {
    await rm(cleanRoot, { recursive: true, force: true });
  }
});

test("private certification validation checks only records changed from accepted main", async () => {
  const cleanRoot = await mkdtemp(
    join(tmpdir(), "egeria-private-certification-delta-"),
  );

  try {
    const cleanCheckScript = await copyCertificationRuntime(cleanRoot);
    await writeFile(join(cleanRoot, "baseline.txt"), "baseline\n", "utf8");
    await execFileAsync("git", ["init", "--quiet"], { cwd: cleanRoot });
    await execFileAsync("git", ["add", "baseline.txt"], { cwd: cleanRoot });
    await execFileAsync(
      "git",
      [
        "-c",
        "user.name=Certification Test",
        "-c",
        "user.email=certification@example.invalid",
        "commit",
        "--quiet",
        "-m",
        "baseline",
      ],
      { cwd: cleanRoot },
    );
    const { stdout: initialRevisionOutput } = await execFileAsync(
      "git",
      ["rev-parse", "HEAD"],
      { cwd: cleanRoot, encoding: "utf8" },
    );
    const initialRevision = initialRevisionOutput.trim();
    const historicalSubject = {
      descriptorVersion: "0.4.0",
      behaviorContractDigest: `sha256:${"a".repeat(64)}`,
    };
    const historicalRecord = {
      subject: historicalSubject,
      requiredEvidence: ["fresh-scaffold"],
      status: "certified",
      taskPlan: "docs/superpowers/plans/historical-certification.md",
      evidence: [
        {
          kind: "fresh-scaffold",
          path: "docs/implementation-evidence/historical-certification.md",
          outcome: "passed",
          revision: initialRevision,
          subject: historicalSubject,
        },
      ],
    };
    const baselineRegistry = createPrivateRegistry(initialRevision);
    baselineRegistry.records["booking-calendly"].status = "pending";
    baselineRegistry.records["booking-calendly"].evidence = [];
    baselineRegistry.records.standards = historicalRecord;
    await writeFile(
      join(cleanRoot, "certifications/capabilities.json"),
      `${JSON.stringify(baselineRegistry, null, 2)}\n`,
      "utf8",
    );
    await execFileAsync(
      "git",
      ["add", "certifications/capabilities.json"],
      { cwd: cleanRoot },
    );
    await execFileAsync(
      "git",
      [
        "-c",
        "user.name=Certification Test",
        "-c",
        "user.email=certification@example.invalid",
        "commit",
        "--quiet",
        "-m",
        "accept baseline registry",
      ],
      { cwd: cleanRoot },
    );
    const { stdout: baselineRevisionOutput } = await execFileAsync(
      "git",
      ["rev-parse", "HEAD"],
      { cwd: cleanRoot, encoding: "utf8" },
    );
    const baselineRevision = baselineRevisionOutput.trim();
    await execFileAsync(
      "git",
      ["update-ref", "refs/remotes/origin/main", baselineRevision],
      { cwd: cleanRoot },
    );

    await writePrivateValidationFixture(cleanRoot, baselineRevision);
    const currentRegistry = createPrivateRegistry(baselineRevision);
    currentRegistry.records.standards = historicalRecord;
    await writeFile(
      join(cleanRoot, "certifications/capabilities.json"),
      `${JSON.stringify(currentRegistry, null, 2)}\n`,
      "utf8",
    );

    assert.deepEqual(
      await runCheck(["--artifacts"], {
        cwd: cleanRoot,
        script: cleanCheckScript,
      }),
      {
        exitCode: 0,
        stdout: `${JSON.stringify({
          ok: true,
          gate: "artifacts",
          records: 1,
        })}\n`,
        stderr: "",
      },
    );
  } finally {
    await rm(cleanRoot, { recursive: true, force: true });
  }
});

test("private certification validation rejects deletion of an accepted evidence artifact", async () => {
  const cleanRoot = await mkdtemp(
    join(tmpdir(), "egeria-private-certification-deleted-evidence-"),
  );

  try {
    const cleanCheckScript = await copyCertificationRuntime(cleanRoot);
    await execFileAsync("git", ["init", "--quiet"], { cwd: cleanRoot });
    await writePrivateValidationFixture(cleanRoot, "0".repeat(40));
    await execFileAsync("git", ["add", "."], { cwd: cleanRoot });
    await execFileAsync(
      "git",
      [
        "-c",
        "user.name=Certification Test",
        "-c",
        "user.email=certification@example.invalid",
        "commit",
        "--quiet",
        "-m",
        "accept certification evidence",
      ],
      { cwd: cleanRoot },
    );
    const { stdout: baselineRevisionOutput } = await execFileAsync(
      "git",
      ["rev-parse", "HEAD"],
      { cwd: cleanRoot, encoding: "utf8" },
    );
    const baselineRevision = baselineRevisionOutput.trim();
    await writePrivateValidationFixture(cleanRoot, baselineRevision);
    await execFileAsync(
      "git",
      ["add", "certifications/capabilities.json", privateEvidencePath],
      { cwd: cleanRoot },
    );
    await execFileAsync(
      "git",
      [
        "-c",
        "user.name=Certification Test",
        "-c",
        "user.email=certification@example.invalid",
        "commit",
        "--quiet",
        "-m",
        "bind accepted evidence revision",
      ],
      { cwd: cleanRoot },
    );
    const { stdout: acceptedRevisionOutput } = await execFileAsync(
      "git",
      ["rev-parse", "HEAD"],
      { cwd: cleanRoot, encoding: "utf8" },
    );
    await execFileAsync(
      "git",
      ["update-ref", "refs/remotes/origin/main", acceptedRevisionOutput.trim()],
      { cwd: cleanRoot },
    );

    await rm(join(cleanRoot, privateEvidencePath));

    assertArtifactIssue(
      await runCheck(["--artifacts"], {
        cwd: cleanRoot,
        script: cleanCheckScript,
      }),
      "CERTIFICATION_EVIDENCE_MISSING",
    );
  } finally {
    await rm(cleanRoot, { recursive: true, force: true });
  }
});

test("Cloudflare deployment certification binds a fresh portfolio to the exact deployment subject", async () => {
  const revision = "a".repeat(40);
  const previousToken = process.env.CLOUDFLARE_API_TOKEN;
  process.env.CLOUDFLARE_API_TOKEN = "PRIVATE_VALUE";
  const scaffold = createSuccessfulScaffoldAdapters({
    inferredCapability: {
      identifier: "deployment-cloudflare",
      version: "0.3.0",
    },
    readCurrentRevision: async () => revision,
    postCreate: async (projectRoot) => {
      await mkdir(join(projectRoot, ".egeria"), { recursive: true });
      await writeFile(
        join(projectRoot, ".egeria/project.yaml"),
        "recipeVersion: 0.9.0\n",
      );
    },
  });

  try {
    const result = await certifyCloudflareDeploymentForTesting(
      { revision },
      scaffold.adapters,
    );

    assert.deepEqual(result, {
      ok: true,
      capability: "deployment-cloudflare",
      version: "0.3.0",
      profile: "portfolio",
      subject: {
        descriptorVersion: "0.3.0",
        behaviorContractDigest:
          "sha256:1690cf9bb12e33a07ea2b91f125cdec62d1d302f35bcc7d533c6a89797481d41",
      },
      recipeVersion: "0.9.0",
      evidenceRevision: revision,
      checks: [
        "compiled-cli-create",
        "state-inference",
        "healthy-diagnostics",
        "exact-diff",
        ...fixedChecks,
      ],
    });
    assert.deepEqual(
      scaffold.state.commands.map(({ arguments: arguments_ }) =>
        arguments_.slice(1),
      ),
      [
        [
          "create",
          "--profile",
          "portfolio",
          "--name",
          "acme-generated-project",
          "--display-name",
          "Acme Generated Project",
          "--directory",
          scaffold.state.projectRoot,
        ],
        ["infer", "--directory", scaffold.state.projectRoot],
        ["doctor", "--directory", scaffold.state.projectRoot],
        ["diff", "--directory", scaffold.state.projectRoot],
      ],
    );
    assert.equal(scaffold.state.verifiedRoot, scaffold.state.projectRoot);
    assert.equal(
      scaffold.state.verifiedProjectName,
      "acme-generated-project",
    );
    assert.equal(scaffold.state.verificationOptions, undefined);
    assert.equal(await pathExists(scaffold.state.ownedPath), false);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_VALUE/u);
  } finally {
    if (previousToken === undefined) {
      delete process.env.CLOUDFLARE_API_TOKEN;
    } else {
      process.env.CLOUDFLARE_API_TOKEN = previousToken;
    }
  }
});

test("Cloudflare deployment certification requires a clean checkout", async () => {
  const cleanRoot = await mkdtemp(
    join(tmpdir(), "egeria-deployment-certification-revision-"),
  );

  try {
    await writeFile(join(cleanRoot, "tracked.txt"), "baseline\n", "utf8");
    await execFileAsync("git", ["init", "--quiet"], { cwd: cleanRoot });
    await execFileAsync("git", ["add", "tracked.txt"], { cwd: cleanRoot });
    await execFileAsync(
      "git",
      [
        "-c",
        "user.name=Certification Test",
        "-c",
        "user.email=certification@example.invalid",
        "commit",
        "--quiet",
        "-m",
        "baseline",
      ],
      { cwd: cleanRoot },
    );
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd: cleanRoot,
      encoding: "utf8",
    });

    assert.equal(
      await readCloudflareDeploymentRevisionForTesting(cleanRoot),
      stdout.trim(),
    );

    for (const [path, contents] of [
      ["untracked.txt", "untracked\n"],
      ["tracked.txt", "modified\n"],
    ]) {
      await writeFile(join(cleanRoot, path), contents, "utf8");
      await assert.rejects(
        readCloudflareDeploymentRevisionForTesting(cleanRoot),
        (error) => {
          assert.equal(error.name, "CloudflareDeploymentCertificationError");
          assert.equal(error.code, "CERTIFICATION_WORKTREE_DIRTY");
          return true;
        },
      );
      await rm(join(cleanRoot, path));
    }
  } finally {
    await rm(cleanRoot, { recursive: true, force: true });
  }
});

test("Cloudflare deployment certification rejects checkout drift after scaffold verification", async () => {
  const revision = "a".repeat(40);
  let revisionReads = 0;
  const scaffold = createSuccessfulScaffoldAdapters({
    inferredCapability: {
      identifier: "deployment-cloudflare",
      version: "0.3.0",
    },
    readCurrentRevision: async () => {
      revisionReads += 1;
      return revisionReads === 1 ? revision : "b".repeat(40);
    },
    postCreate: async (projectRoot) => {
      await mkdir(join(projectRoot, ".egeria"), { recursive: true });
      await writeFile(
        join(projectRoot, ".egeria/project.yaml"),
        "recipeVersion: 0.9.0\n",
      );
    },
  });

  await assert.rejects(
    certifyCloudflareDeploymentForTesting(
      { revision },
      scaffold.adapters,
    ),
    (error) => {
      assert.equal(error.name, "CloudflareDeploymentCertificationError");
      assert.equal(error.code, "CERTIFICATION_REVISION_MISMATCH");
      return true;
    },
  );
  assert.equal(await pathExists(scaffold.state.ownedPath), false);
});

test("Cloudflare deployment certification rejects a non-exact evidence revision", async () => {
  await assert.rejects(
    async () =>
      certifyCloudflareDeploymentForTesting(
        { revision: "a".repeat(39) },
        {
          readCurrentRevision: async () =>
            assert.fail("invalid input must not read the revision"),
          runCommand: async () => assert.fail("invalid input must not run"),
          verifyProject: async () =>
            assert.fail("invalid input must not verify"),
        },
      ),
    (error) => {
      assert.equal(error.name, "CloudflareDeploymentCertificationError");
      assert.equal(error.code, "CERTIFICATION_REVISION_INVALID");
      return true;
    },
  );
});

test("Cloudflare deployment certification rejects a missing revision adapter", async () => {
  await assert.rejects(
    certifyCloudflareDeploymentForTesting(
      { revision: "a".repeat(40) },
      {
        runCommand: async () => assert.fail("invalid adapters must not run"),
        verifyProject: async () =>
          assert.fail("invalid adapters must not verify"),
      },
    ),
    (error) => {
      assert.equal(error.name, "CloudflareDeploymentCertificationError");
      assert.equal(error.code, "CERTIFICATION_ADAPTER_INVALID");
      return true;
    },
  );
});

test("Cloudflare deployment certification rejects a revision that is not the current checkout", async () => {
  const revision = "a".repeat(40);
  await assert.rejects(
    certifyCloudflareDeploymentForTesting(
      { revision },
      {
        readCurrentRevision: async () => "b".repeat(40),
        runCommand: async () => assert.fail("mismatched input must not run"),
        verifyProject: async () =>
          assert.fail("mismatched input must not verify"),
      },
    ),
    (error) => {
      assert.equal(error.name, "CloudflareDeploymentCertificationError");
      assert.equal(error.code, "CERTIFICATION_REVISION_MISMATCH");
      return true;
    },
  );
});

test("the Cloudflare deployment certification entry accepts only its revision argument without echoing it", async () => {
  let invalidRevision;
  try {
    await execFileAsync(process.execPath, [
      cloudflareDeploymentCertificationScript,
      "--revision",
      "private-value",
    ], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { PATH: process.env.PATH },
    });
    assert.fail("an invalid revision must fail");
  } catch (error) {
    invalidRevision = error;
  }

  assert.equal(invalidRevision.code, 1);
  assert.equal(invalidRevision.stdout, "");
  assert.equal(
    invalidRevision.stderr,
    `${JSON.stringify({
      ok: false,
      code: "CERTIFICATION_REVISION_INVALID",
    })}\n`,
  );
  assert.doesNotMatch(invalidRevision.stderr, /private-value/u);

  let unknownArgument;
  try {
    await execFileAsync(process.execPath, [
      cloudflareDeploymentCertificationScript,
      "--unknown",
      "private-value",
    ], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { PATH: process.env.PATH },
    });
    assert.fail("an unknown argument must fail");
  } catch (error) {
    unknownArgument = error;
  }

  assert.equal(unknownArgument.code, 2);
  assert.equal(unknownArgument.stdout, "");
  assert.equal(
    unknownArgument.stderr,
    `${JSON.stringify({
      ok: false,
      code: "CERTIFICATION_ARGUMENT_INVALID",
    })}\n`,
  );
  assert.doesNotMatch(unknownArgument.stderr, /private-value/u);
});

test("generated testing certification binds a fresh portfolio to the exact standards subject", async () => {
  const previousToken = process.env.NPM_TOKEN;
  process.env.NPM_TOKEN = "PRIVATE_VALUE";
  const scaffold = createSuccessfulScaffoldAdapters({
    inferredCapability: { identifier: "standards", version: "0.4.0" },
    postCreate: (projectRoot) => writeRecipeVersion(projectRoot, "0.10.0"),
    verificationChecks: visualChecks,
  });

  try {
    const result = await certifyGeneratedTestingForTesting(scaffold.adapters);

    assert.deepEqual(result, {
      ok: true,
      capability: "standards",
      version: "0.4.0",
      profile: "portfolio",
      subject: {
        descriptorVersion: "0.4.0",
        behaviorContractDigest:
          "sha256:81bb7d1c0ee095b6411c29350fa418c8676ffa90594b848a9cc19806e08c29d4",
      },
      recipeVersion: "0.10.0",
      checks: [
        "compiled-cli-create",
        "state-inference",
        "healthy-diagnostics",
        "exact-diff",
        ...visualChecks,
      ],
    });
    assert.deepEqual(
      scaffold.state.commands.map(({ arguments: arguments_ }) =>
        arguments_.slice(1),
      ),
      [
        [
          "create",
          "--profile",
          "portfolio",
          "--name",
          "acme-portfolio",
          "--display-name",
          "Acme Portfolio",
          "--directory",
          scaffold.state.projectRoot,
        ],
        ["infer", "--directory", scaffold.state.projectRoot],
        ["doctor", "--directory", scaffold.state.projectRoot],
        ["diff", "--directory", scaffold.state.projectRoot],
      ],
    );
    assert.equal(scaffold.state.verifiedRoot, scaffold.state.projectRoot);
    assert.deepEqual(scaffold.state.verificationOptions, {
      includeVisual: true,
    });
    assert.equal(await pathExists(scaffold.state.ownedPath), false);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_VALUE/u);
  } finally {
    if (previousToken === undefined) {
      delete process.env.NPM_TOKEN;
    } else {
      process.env.NPM_TOKEN = previousToken;
    }
  }
});

test("generated testing certification rejects missing, extra, or reordered visual verifier checks", async () => {
  const invalidChecks = [
    visualChecks.slice(0, -2),
    fixedChecks,
    [...visualChecks, "unexpected"],
    [...visualChecks].reverse(),
  ];

  for (const checks of invalidChecks) {
    const scaffold = createSuccessfulScaffoldAdapters({
      inferredCapability: { identifier: "standards", version: "0.4.0" },
      postCreate: (projectRoot) =>
        writeRecipeVersion(projectRoot, "0.10.0"),
      verificationChecks: checks,
    });
    await assert.rejects(
      certifyGeneratedTestingForTesting(scaffold.adapters),
      (error) => {
        assert.equal(error.name, "GeneratedTestingCertificationError");
        assert.equal(error.code, "GENERATED_PROJECT_VERIFICATION_INVALID");
        return true;
      },
    );
  }
});

test("generated testing certification rejects stale state, recipe, diagnostics, diff, and verifier identity", async (context) => {
  const validInput = Object.freeze({
    inferredCapability: Object.freeze({
      identifier: "standards",
      version: "0.4.0",
    }),
    postCreate: (projectRoot) =>
      writeRecipeVersion(projectRoot, "0.10.0"),
    verificationChecks: visualChecks,
  });
  const cases = [
    [
      "stale installed standards",
      {
        ...validInput,
        inferredCapability: { identifier: "standards", version: "0.3.0" },
      },
      "FRESH_SCAFFOLD_INFERENCE_INVALID",
    ],
    [
      "stale recipe",
      {
        ...validInput,
        postCreate: (projectRoot) =>
          writeRecipeVersion(projectRoot, "0.9.0"),
      },
      "FRESH_SCAFFOLD_RECIPE_INVALID",
    ],
    [
      "unhealthy diagnostics",
      {
        ...validInput,
        diagnostics: { healthy: false, diagnostics: [{ code: "DRIFT" }] },
      },
      "FRESH_SCAFFOLD_DIAGNOSTICS_INVALID",
    ],
    [
      "non-empty diff",
      {
        ...validInput,
        differences: { equal: false, differences: [{ code: "DRIFT" }] },
      },
      "FRESH_SCAFFOLD_DIFF_INVALID",
    ],
    [
      "wrong verifier identity",
      { ...validInput, verificationFixtures: ["site"] },
      "GENERATED_PROJECT_VERIFICATION_INVALID",
    ],
  ];

  for (const [name, input, expectedCode] of cases) {
    await context.test(name, async () => {
      const scaffold = createSuccessfulScaffoldAdapters(input);
      await assert.rejects(
        certifyGeneratedTestingForTesting(scaffold.adapters),
        (error) => {
          assert.equal(error.name, "GeneratedTestingCertificationError");
          assert.equal(error.code, expectedCode);
          return true;
        },
      );
      assert.equal(await pathExists(scaffold.state.ownedPath), false);
    });
  }
});

test("the generated testing certification entry rejects unknown arguments without echoing them", async () => {
  let result;
  try {
    await execFileAsync(process.execPath, [
      generatedTestingCertificationScript,
      "--unknown",
      "private-value",
    ], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { PATH: process.env.PATH },
    });
    assert.fail("invalid arguments must fail");
  } catch (error) {
    result = error;
  }

  assert.equal(result.code, 2);
  assert.equal(result.stdout, "");
  assert.equal(
    result.stderr,
    `${JSON.stringify({
      ok: false,
      code: "CERTIFICATION_ARGUMENT_INVALID",
    })}\n`,
  );
  assert.doesNotMatch(result.stderr, /private-value/u);
});

test("content files certification binds a clean exact revision to causal fresh-scaffold evidence", async () => {
  const revision = "a".repeat(40);
  let revisionReads = 0;
  let statusReads = 0;
  let indexReads = 0;
  const scaffold = createSuccessfulScaffoldAdapters({
    inferredCapability: { identifier: "content-files", version: "0.4.0" },
    readCurrentRevision: async () => {
      revisionReads += 1;
      return revision;
    },
    readRepositoryStatus: async () => {
      statusReads += 1;
      return "";
    },
    readRepositoryIndexEntries: async () => {
      indexReads += 1;
      return "H selected-evidence.test.mjs\0";
    },
    postCreate: (projectRoot) => writeRecipeVersion(projectRoot, "0.10.0"),
    verifyFixture: async ({ projectRoot, environment }) => {
      assert.equal(projectRoot, scaffold.state.projectRoot);
      assert.equal(environment.CLOUDFLARE_API_TOKEN, undefined);
      assert.equal(environment.CLOUDFLARE_ACCOUNT_ID, undefined);
      assert.equal(environment.NPM_TOKEN, undefined);
      assert.equal(environment.NODE_OPTIONS, undefined);
      return { ok: true, checks: contentFixtureChecks };
    },
  });

  const result = await certifyContentFilesForTesting(
    { revision },
    scaffold.adapters,
  );

  assert.deepEqual(result, {
    ok: true,
    capability: "content-files",
    version: "0.4.0",
    profile: "portfolio",
    subject: {
      descriptorVersion: "0.4.0",
      behaviorContractDigest:
        "sha256:5ae35debef622dc0fb9eeee3889e79a72fd6ff28eb730865bfe95e8674c9ff05",
    },
    recipeVersion: "0.10.0",
    locale: "en-CA",
    evidenceRevision: revision,
    checks: [
      "compiled-cli-create",
      "state-inference",
      "healthy-diagnostics",
      "exact-diff",
      ...fixedChecks,
      ...contentFixtureChecks,
      "repository-sources-unchanged",
    ],
  });
  assert.deepEqual(
    scaffold.state.commands.map(({ arguments: arguments_ }) =>
      arguments_.slice(1),
    ),
    [
      [
        "create",
        "--profile",
        "portfolio",
        "--name",
        "acme-portfolio",
        "--display-name",
        "Acme Portfolio",
        "--directory",
        scaffold.state.projectRoot,
      ],
      ["infer", "--directory", scaffold.state.projectRoot],
      ["doctor", "--directory", scaffold.state.projectRoot],
      ["diff", "--directory", scaffold.state.projectRoot],
    ],
  );
  assert.equal(scaffold.state.verifiedRoot, scaffold.state.projectRoot);
  assert.equal(scaffold.state.fixtureInput.projectRoot, scaffold.state.projectRoot);
  assert.equal(revisionReads, 2);
  assert.equal(statusReads, 2);
  assert.equal(indexReads, 2);
  assert.equal(await pathExists(scaffold.state.ownedPath), false);
});

test("content files fixture verification applies the exact isolated overlay and command sequence", async () => {
  const ownedRoot = await mkdtemp(join(tmpdir(), "content-fixture-verifier-"));
  const projectRoot = join(ownedRoot, "generated-project");
  const supportRoot = join(ownedRoot, "content-fixture-support");
  const siteContentPath = join(
    projectRoot,
    "apps/web/content/en-CA/site.yaml",
  );
  const commands = [];

  try {
    await mkdir(dirname(siteContentPath), { recursive: true });
    await writeFile(
      siteContentPath,
      "schemaVersion: 1.0.0\nnavigation: []\n",
    );
    const { verifyContentFixtureForTesting } = await import(
      "../../scripts/certify-content-files.mjs"
    );

    const result = await verifyContentFixtureForTesting({
      projectRoot,
      environment: { PATH: "/verified/bin" },
      runCommand: async (command) => {
        commands.push(command);
      },
    });

    assert.deepEqual(result, { ok: true, checks: contentFixtureChecks });
    assert.equal(
      await readFile(siteContentPath, "utf8"),
      "schemaVersion: 1.0.0\nnavigation:\n  - href: \"#introduction\"\n    label: Introduction\n",
    );
    assert.equal(
      await readFile(
        join(
          projectRoot,
          "apps/web/tests/unit/content-files-certification.test.ts",
        ),
        "utf8",
      ),
      await readFile(
        join(
          repositoryRoot,
          "tests/capability-certification/fixtures/content-files/content-files-certification.test.ts",
        ),
        "utf8",
      ),
    );
    assert.equal(
      await readFile(
        join(
          projectRoot,
          "apps/web/tests/e2e/content-files-certification.spec.ts",
        ),
        "utf8",
      ),
      await readFile(
        join(
          repositoryRoot,
          "tests/capability-certification/fixtures/content-files/content-files-certification.spec.ts",
        ),
        "utf8",
      ),
    );
    assert.equal(await readFile(join(supportRoot, ".npmrc"), "utf8"), "");
    assert.deepEqual(
      commands.map(({ executable, arguments: arguments_, cwd, timeout }) => ({
        executable,
        arguments: arguments_,
        cwd,
        timeout,
      })),
      [
        {
          executable: "pnpm",
          arguments: [
            "install",
            "--frozen-lockfile",
            "--store-dir",
            join(supportRoot, "store"),
          ],
          cwd: projectRoot,
          timeout: 15 * 60 * 1000,
        },
        {
          executable: "pnpm",
          arguments: [
            "--dir",
            "apps/web",
            "exec",
            "vitest",
            "run",
            "--project",
            "unit",
            "tests/unit/content-files-certification.test.ts",
          ],
          cwd: projectRoot,
          timeout: 15 * 60 * 1000,
        },
        {
          executable: "pnpm",
          arguments: ["--dir", "apps/web", "run", "browser:install"],
          cwd: projectRoot,
          timeout: 15 * 60 * 1000,
        },
        {
          executable: "pnpm",
          arguments: [
            "--dir",
            "apps/web",
            "exec",
            "playwright",
            "test",
            "--config",
            "playwright.dev.config.ts",
            "tests/e2e/content-files-certification.spec.ts",
          ],
          cwd: projectRoot,
          timeout: 15 * 60 * 1000,
        },
      ],
    );
    for (const command of commands) {
      assert.equal(command.environment.PATH, "/verified/bin");
      assert.equal(command.environment.HOME, join(supportRoot, "home"));
      assert.equal(
        command.environment.USERPROFILE,
        join(supportRoot, "home"),
      );
      assert.equal(
        command.environment.PLAYWRIGHT_BROWSERS_PATH,
        join(supportRoot, "playwright-browsers"),
      );
      assert.equal(
        command.environment.NPM_CONFIG_USERCONFIG,
        join(supportRoot, ".npmrc"),
      );
      assert.equal(
        command.environment.NPM_CONFIG_REGISTRY,
        "https://registry.npmjs.org/",
      );
      assert.equal(
        command.environment.TMPDIR,
        join(supportRoot, "temporary"),
      );
      assert.equal(command.environment.TMP, join(supportRoot, "temporary"));
      assert.equal(command.environment.TEMP, join(supportRoot, "temporary"));
      assert.equal(
        command.environment.XDG_CACHE_HOME,
        join(supportRoot, "cache"),
      );
    }
  } finally {
    await rm(ownedRoot, { recursive: true, force: true });
  }
});

test("content files fixture verification contains preparation and overlay filesystem failures", async (context) => {
  const { verifyContentFixtureForTesting } = await import(
    "../../scripts/certify-content-files.mjs"
  );
  const cases = [
    {
      name: "support-root preparation",
      prepare: async ({ ownedRoot }) => {
        await writeFile(join(ownedRoot, "content-fixture-support"), "blocked");
      },
    },
    {
      name: "fixture destination creation",
      prepare: async ({ projectRoot, siteContentPath }) => {
        await mkdir(dirname(siteContentPath), { recursive: true });
        await writeFile(siteContentPath, "navigation: []\n");
        await mkdir(join(projectRoot, "apps/web"), { recursive: true });
        await writeFile(join(projectRoot, "apps/web/tests"), "blocked");
      },
    },
    {
      name: "navigation overlay write",
      skip: process.getuid?.() === 0,
      prepare: async ({ siteContentPath }) => {
        await mkdir(dirname(siteContentPath), { recursive: true });
        await writeFile(siteContentPath, "navigation: []\n", { mode: 0o400 });
      },
    },
  ];

  for (const { name, prepare, skip = false } of cases) {
    await context.test(name, { skip }, async () => {
      const ownedRoot = await mkdtemp(
        join(tmpdir(), "content-fixture-failure-"),
      );
      const projectRoot = join(ownedRoot, "generated-project");
      const siteContentPath = join(
        projectRoot,
        "apps/web/content/en-CA/site.yaml",
      );
      let commandRuns = 0;

      try {
        await prepare({ ownedRoot, projectRoot, siteContentPath });
        await assert.rejects(
          verifyContentFixtureForTesting({
            projectRoot,
            environment: { PATH: "/verified/bin" },
            runCommand: async () => {
              commandRuns += 1;
            },
          }),
          (error) =>
            error?.name === "ContentFilesCertificationError" &&
            error.code === "CERTIFICATION_FIXTURE_OVERLAY_FAILED",
        );
        assert.equal(commandRuns, 0);
      } finally {
        await rm(ownedRoot, { recursive: true, force: true });
      }
    });
  }
});

test("content files certification fails closed on invalid authority and evidence drift", async (context) => {
  const revision = "a".repeat(40);
  const createScaffold = (overrides = {}) =>
    createSuccessfulScaffoldAdapters({
      inferredCapability: { identifier: "content-files", version: "0.4.0" },
      readCurrentRevision: async () => revision,
      postCreate: (projectRoot) => writeRecipeVersion(projectRoot, "0.10.0"),
      verifyFixture: async () => ({ ok: true, checks: contentFixtureChecks }),
      ...overrides,
    });

  await context.test("rejects a non-exact revision before using adapters", async () => {
    await assert.rejects(
      certifyContentFilesForTesting({ revision: "a".repeat(39) }, {}),
      (error) =>
        error?.name === "ContentFilesCertificationError" &&
        error.code === "CERTIFICATION_REVISION_INVALID",
    );
  });

  for (const [name, overrides, expectedCode] of [
    [
      "rejects a dirty worktree before scaffolding",
      { readRepositoryStatus: async () => "?? private-source.ts\0" },
      "CERTIFICATION_WORKTREE_DIRTY",
    ],
    [
      "rejects non-ordinary index flags before scaffolding",
      { readRepositoryIndexEntries: async () => "S selected-evidence.test.mjs\0" },
      "CERTIFICATION_INDEX_FLAGS",
    ],
  ]) {
    await context.test(name, async () => {
      const scaffold = createScaffold(overrides);
      await assert.rejects(
        certifyContentFilesForTesting({ revision }, scaffold.adapters),
        (error) =>
          error?.name === "ContentFilesCertificationError" &&
          error.code === expectedCode,
      );
      assert.equal(scaffold.state.commands.length, 0);
    });
  }

  await context.test("rejects revision drift after contained evidence", async () => {
    let reads = 0;
    const scaffold = createScaffold({
      readCurrentRevision: async () => {
        reads += 1;
        return reads === 1 ? revision : "b".repeat(40);
      },
    });
    await assert.rejects(
      certifyContentFilesForTesting({ revision }, scaffold.adapters),
      (error) => error?.code === "CERTIFICATION_REVISION_MISMATCH",
    );
    assert.equal(await pathExists(scaffold.state.ownedPath), false);
  });

  await context.test("contains causal fixture failure", async () => {
    const scaffold = createScaffold({
      verifyFixture: async () => {
        throw new Error("private fixture failure");
      },
    });
    await assert.rejects(
      certifyContentFilesForTesting({ revision }, scaffold.adapters),
      (error) => error?.code === "CERTIFICATION_FIXTURE_VERIFICATION_FAILED",
    );
    assert.equal(await pathExists(scaffold.state.ownedPath), false);
  });

  await context.test("rejects worktree drift after contained evidence", async () => {
    let reads = 0;
    const scaffold = createScaffold({
      readRepositoryStatus: async () => {
        reads += 1;
        return reads === 1 ? "" : " M private-source.ts\0";
      },
    });
    await assert.rejects(
      certifyContentFilesForTesting({ revision }, scaffold.adapters),
      (error) => error?.code === "CERTIFICATION_WORKTREE_DIRTY",
    );
    assert.equal(await pathExists(scaffold.state.ownedPath), false);
  });
});

test("the content files certification command requires one exact revision without echoing rejected values", async () => {
  for (const [arguments_, expectedCode, expectedExitCode] of [
    [
      ["--revision", "private-value"],
      "CERTIFICATION_REVISION_INVALID",
      1,
    ],
    [
      ["--", "--revision", "private-value"],
      "CERTIFICATION_REVISION_INVALID",
      1,
    ],
    [["--unknown", "private-value"], "CERTIFICATION_ARGUMENT_INVALID", 2],
  ]) {
    const execution = await execFileAsync(
      process.execPath,
      [contentFilesCertificationScript, ...arguments_],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        env: { PATH: process.env.PATH },
      },
    ).catch((error) => error);

    assert.equal(execution.code, expectedExitCode);
    assert.equal(execution.stdout, "");
    assert.deepEqual(JSON.parse(execution.stderr), {
      ok: false,
      code: expectedCode,
    });
    assert.doesNotMatch(execution.stderr, /private-value/u);
  }
});

test("site routing certification binds a clean exact revision to causal fresh-scaffold evidence", async () => {
  const revision = "a".repeat(40);
  let revisionReads = 0;
  let statusReads = 0;
  let indexReads = 0;
  const scaffold = createSuccessfulScaffoldAdapters({
    expectedCapabilities: Object.freeze([
      "standards",
      "content-files",
      "section-composition",
      "deployment-cloudflare",
      "observability",
      "site-routing",
    ]),
    inferredCapability: { identifier: "site-routing", version: "0.3.0" },
    profile: "site",
    readCurrentRevision: async () => {
      revisionReads += 1;
      return revision;
    },
    readRepositoryStatus: async () => {
      statusReads += 1;
      return "";
    },
    readRepositoryIndexEntries: async () => {
      indexReads += 1;
      return "H selected-evidence.test.mjs\0";
    },
    postCreate: (projectRoot) => writeRecipeVersion(projectRoot, "0.10.0"),
    verifierIdentifier: "site",
    verifyFixture: async ({ projectRoot, environment }) => {
      assert.equal(projectRoot, scaffold.state.projectRoot);
      assert.equal(environment.CLOUDFLARE_API_TOKEN, undefined);
      assert.equal(environment.CLOUDFLARE_ACCOUNT_ID, undefined);
      assert.equal(environment.NPM_TOKEN, undefined);
      assert.equal(environment.NODE_OPTIONS, undefined);
      return { ok: true, checks: siteRoutingFixtureChecks };
    },
  });

  const result = await certifySiteRoutingForTesting(
    { revision },
    scaffold.adapters,
  );

  assert.deepEqual(result, {
    ok: true,
    capability: "site-routing",
    version: "0.3.0",
    profile: "site",
    subject: {
      descriptorVersion: "0.3.0",
      behaviorContractDigest:
        "sha256:d716a1c93f8f40db33e54612c85d521fbd6ba13cd142d35ab0c39fa9c4b9647e",
    },
    recipeVersion: "0.10.0",
    locale: "en-CA",
    evidenceRevision: revision,
    checks: [
      "compiled-cli-create",
      "state-inference",
      "healthy-diagnostics",
      "exact-diff",
      ...fixedChecks,
      ...siteRoutingFixtureChecks,
      "repository-sources-unchanged",
    ],
  });
  assert.deepEqual(
    scaffold.state.commands.map(({ arguments: arguments_ }) =>
      arguments_.slice(1),
    ),
    [
      [
        "create",
        "--profile",
        "site",
        "--name",
        "acme-site",
        "--display-name",
        "Acme Site",
        "--directory",
        scaffold.state.projectRoot,
      ],
      ["infer", "--directory", scaffold.state.projectRoot],
      ["doctor", "--directory", scaffold.state.projectRoot],
      ["diff", "--directory", scaffold.state.projectRoot],
    ],
  );
  assert.equal(scaffold.state.verifiedRoot, scaffold.state.projectRoot);
  assert.equal(scaffold.state.fixtureInput.projectRoot, scaffold.state.projectRoot);
  assert.equal(revisionReads, 2);
  assert.equal(statusReads, 2);
  assert.equal(indexReads, 2);
  assert.equal(await pathExists(scaffold.state.ownedPath), false);
});

test("site routing fixture verification applies the exact isolated overlay and command sequence", async () => {
  const ownedRoot = await mkdtemp(join(tmpdir(), "site-routing-fixture-verifier-"));
  const projectRoot = join(ownedRoot, "generated-project");
  const supportRoot = join(ownedRoot, "site-routing-fixture-support");
  const commands = [];

  try {
    const { verifySiteRoutingFixtureForTesting } = await import(
      "../../scripts/certify-site-routing.mjs"
    );
    const result = await verifySiteRoutingFixtureForTesting({
      projectRoot,
      environment: { PATH: "/verified/bin" },
      runCommand: async (command) => {
        commands.push(command);
      },
    });

    assert.deepEqual(result, { ok: true, checks: siteRoutingFixtureChecks });
    for (const [source, destination] of [
      [
        "site-routing-certification.test.tsx",
        "apps/web/tests/component/site-routing-certification.test.tsx",
      ],
      [
        "site-routing-vitest.config.ts",
        "apps/web/tests/component/site-routing-vitest.config.ts",
      ],
      [
        "site-routing-certification.spec.ts",
        "apps/web/tests/e2e/site-routing-certification.spec.ts",
      ],
    ]) {
      assert.equal(
        await readFile(join(projectRoot, destination), "utf8"),
        await readFile(
          join(
            repositoryRoot,
            "tests/capability-certification/fixtures/site-routing",
            source,
          ),
          "utf8",
        ),
      );
    }
    assert.equal(await readFile(join(supportRoot, ".npmrc"), "utf8"), "");
    assert.deepEqual(
      commands.map(({ executable, arguments: arguments_, cwd, timeout }) => ({
        executable,
        arguments: arguments_,
        cwd,
        timeout,
      })),
      [
        {
          executable: "pnpm",
          arguments: [
            "install",
            "--frozen-lockfile",
            "--store-dir",
            join(supportRoot, "store"),
          ],
          cwd: projectRoot,
          timeout: 15 * 60 * 1000,
        },
        {
          executable: "pnpm",
          arguments: [
            "--dir",
            "apps/web",
            "exec",
            "vitest",
            "run",
            "--config",
            "tests/component/site-routing-vitest.config.ts",
            "tests/component/site-routing-certification.test.tsx",
          ],
          cwd: projectRoot,
          timeout: 15 * 60 * 1000,
        },
        {
          executable: "pnpm",
          arguments: ["--dir", "apps/web", "run", "browser:install"],
          cwd: projectRoot,
          timeout: 15 * 60 * 1000,
        },
        {
          executable: "pnpm",
          arguments: [
            "--dir",
            "apps/web",
            "exec",
            "playwright",
            "test",
            "--config",
            "playwright.dev.config.ts",
            "tests/e2e/site-routing-certification.spec.ts",
          ],
          cwd: projectRoot,
          timeout: 15 * 60 * 1000,
        },
      ],
    );
    for (const command of commands) {
      assert.equal(command.environment.PATH, "/verified/bin");
      assert.equal(command.environment.HOME, join(supportRoot, "home"));
      assert.equal(command.environment.USERPROFILE, join(supportRoot, "home"));
      assert.equal(
        command.environment.PLAYWRIGHT_BROWSERS_PATH,
        join(supportRoot, "playwright-browsers"),
      );
      assert.equal(
        command.environment.NPM_CONFIG_USERCONFIG,
        join(supportRoot, ".npmrc"),
      );
      assert.equal(
        command.environment.NPM_CONFIG_REGISTRY,
        "https://registry.npmjs.org/",
      );
      assert.equal(command.environment.TMPDIR, join(supportRoot, "temporary"));
      assert.equal(command.environment.TMP, join(supportRoot, "temporary"));
      assert.equal(command.environment.TEMP, join(supportRoot, "temporary"));
      assert.equal(command.environment.XDG_CACHE_HOME, join(supportRoot, "cache"));
    }
  } finally {
    await rm(ownedRoot, { recursive: true, force: true });
  }
});

test("site routing fixture verification reports component command failures", async () => {
  const ownedRoot = await mkdtemp(join(tmpdir(), "site-routing-fixture-component-failure-"));
  const projectRoot = join(ownedRoot, "generated-project");
  let commandRuns = 0;

  try {
    const { verifySiteRoutingFixtureForTesting } = await import(
      "../../scripts/certify-site-routing.mjs"
    );
    await assert.rejects(
      verifySiteRoutingFixtureForTesting({
        projectRoot,
        environment: { PATH: "/verified/bin" },
        runCommand: async () => {
          commandRuns += 1;
          if (commandRuns === 2) {
            throw new Error("private component failure");
          }
        },
      }),
      (error) =>
        error?.name === "SiteRoutingCertificationError" &&
        error.code === "CERTIFICATION_FIXTURE_COMPONENT_FAILED",
    );
    assert.equal(commandRuns, 2);
  } finally {
    await rm(ownedRoot, { recursive: true, force: true });
  }
});

test("site routing fixture verification contains preparation failures", async () => {
  const ownedRoot = await mkdtemp(join(tmpdir(), "site-routing-fixture-failure-"));
  const projectRoot = join(ownedRoot, "generated-project");
  let commandRuns = 0;

  try {
    await writeFile(join(ownedRoot, "site-routing-fixture-support"), "blocked");
    const { verifySiteRoutingFixtureForTesting } = await import(
      "../../scripts/certify-site-routing.mjs"
    );
    await assert.rejects(
      verifySiteRoutingFixtureForTesting({
        projectRoot,
        environment: { PATH: "/verified/bin" },
        runCommand: async () => {
          commandRuns += 1;
        },
      }),
      (error) =>
        error?.name === "SiteRoutingCertificationError" &&
        error.code === "CERTIFICATION_FIXTURE_OVERLAY_FAILED",
    );
    assert.equal(commandRuns, 0);
  } finally {
    await rm(ownedRoot, { recursive: true, force: true });
  }
});

test("site routing certification fails closed on invalid authority and evidence drift", async (context) => {
  const revision = "a".repeat(40);
  const createScaffold = (overrides = {}) =>
    createSuccessfulScaffoldAdapters({
      expectedCapabilities: Object.freeze([
        "standards",
        "content-files",
        "section-composition",
        "deployment-cloudflare",
        "observability",
        "site-routing",
      ]),
      inferredCapability: { identifier: "site-routing", version: "0.3.0" },
      profile: "site",
      readCurrentRevision: async () => revision,
      postCreate: (projectRoot) => writeRecipeVersion(projectRoot, "0.10.0"),
      verifierIdentifier: "site",
      verifyFixture: async () => ({ ok: true, checks: siteRoutingFixtureChecks }),
      ...overrides,
    });

  await context.test("rejects a non-exact revision before using adapters", async () => {
    await assert.rejects(
      certifySiteRoutingForTesting({ revision: "a".repeat(39) }, {}),
      (error) =>
        error?.name === "SiteRoutingCertificationError" &&
        error.code === "CERTIFICATION_REVISION_INVALID",
    );
  });

  for (const [name, overrides, expectedCode] of [
    [
      "rejects a dirty worktree before scaffolding",
      { readRepositoryStatus: async () => "?? private-source.ts\0" },
      "CERTIFICATION_WORKTREE_DIRTY",
    ],
    [
      "rejects non-ordinary index flags before scaffolding",
      { readRepositoryIndexEntries: async () => "S selected-evidence.test.mjs\0" },
      "CERTIFICATION_INDEX_FLAGS",
    ],
  ]) {
    await context.test(name, async () => {
      const scaffold = createScaffold(overrides);
      await assert.rejects(
        certifySiteRoutingForTesting({ revision }, scaffold.adapters),
        (error) => error?.code === expectedCode,
      );
      assert.equal(scaffold.state.commands.length, 0);
    });
  }

  for (const [name, override, expectedCode] of [
    [
      "rejects revision drift after contained evidence",
      (() => {
        let reads = 0;
        return {
          readCurrentRevision: async () =>
            (reads += 1) === 1 ? revision : "b".repeat(40),
        };
      })(),
      "CERTIFICATION_REVISION_MISMATCH",
    ],
    [
      "rejects worktree drift after contained evidence",
      (() => {
        let reads = 0;
        return {
          readRepositoryStatus: async () =>
            (reads += 1) === 1 ? "" : " M private-source.ts\0",
        };
      })(),
      "CERTIFICATION_WORKTREE_DIRTY",
    ],
    [
      "rejects index-flag drift after contained evidence",
      (() => {
        let reads = 0;
        return {
          readRepositoryIndexEntries: async () =>
            `${(reads += 1) === 1 ? "H" : "S"} selected-evidence.test.mjs\0`,
        };
      })(),
      "CERTIFICATION_INDEX_FLAGS",
    ],
  ]) {
    await context.test(name, async () => {
      const scaffold = createScaffold(override);
      await assert.rejects(
        certifySiteRoutingForTesting({ revision }, scaffold.adapters),
        (error) => error?.code === expectedCode,
      );
      assert.equal(await pathExists(scaffold.state.ownedPath), false);
    });
  }

  await context.test("rejects invalid fixed-verifier evidence", async () => {
    const scaffold = createScaffold({ verificationChecks: fixedChecks.slice(1) });
    await assert.rejects(
      certifySiteRoutingForTesting({ revision }, scaffold.adapters),
      (error) => error?.code === "GENERATED_PROJECT_VERIFICATION_INVALID",
    );
    assert.equal(await pathExists(scaffold.state.ownedPath), false);
  });

  await context.test("contains causal fixture failure", async () => {
    const scaffold = createScaffold({
      verifyFixture: async () => {
        throw new Error("private fixture failure");
      },
    });
    await assert.rejects(
      certifySiteRoutingForTesting({ revision }, scaffold.adapters),
      (error) => error?.code === "CERTIFICATION_FIXTURE_VERIFICATION_FAILED",
    );
    assert.equal(await pathExists(scaffold.state.ownedPath), false);
  });
});

test("the site routing certification command requires one exact revision without echoing rejected values", async () => {
  for (const [arguments_, expectedCode, expectedExitCode] of [
    [["--revision", "private-value"], "CERTIFICATION_REVISION_INVALID", 1],
    [
      ["--", "--revision", "private-value"],
      "CERTIFICATION_REVISION_INVALID",
      1,
    ],
    [["--unknown", "private-value"], "CERTIFICATION_ARGUMENT_INVALID", 2],
  ]) {
    const execution = await execFileAsync(
      process.execPath,
      [siteRoutingCertificationScript, ...arguments_],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        env: { PATH: process.env.PATH },
      },
    ).catch((error) => error);

    assert.equal(execution.code, expectedExitCode);
    assert.equal(execution.stdout, "");
    assert.deepEqual(JSON.parse(execution.stderr), {
      ok: false,
      code: expectedCode,
    });
    assert.doesNotMatch(execution.stderr, /private-value/u);
  }
});

test("the registry command rejects unknown arguments without registry content", async () => {
  const result = await runCheck(["--unknown", "private-value"]);
  assert.deepEqual(result, {
    exitCode: 2,
    stdout: "",
    stderr: `${JSON.stringify({
      ok: false,
      code: "CERTIFICATION_ARGUMENT_INVALID",
    })}\n`,
  });
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /private-value/u);
});

test("Calendly production mutation keeps real owner identity while testing mocks commands and verification", async () => {
  const commands = [];
  let ownedPath;
  let projectRoot;
  let primaryRoot;
  let verifiedRoot;
  const previousToken = process.env.CLOUDFLARE_API_TOKEN;
  process.env.CLOUDFLARE_API_TOKEN = "PRIVATE_VALUE";

  try {
    const result = await certifyBookingCalendlyForTesting(
      { calendlyUrl: "https://calendly.com/example/intro" },
      {
        async runCommand(input) {
          commands.push(input);
          assert.equal(input.environment.CLOUDFLARE_API_TOKEN, undefined);
          assert.equal(input.environment.NPM_TOKEN, undefined);
          assert.equal(input.environment.NODE_OPTIONS, undefined);
          if (input.executable === "git") {
            const worktreeIndex = input.arguments.indexOf("worktree");
            if (worktreeIndex !== -1) {
              projectRoot = input.arguments.at(-1);
              await mkdir(projectRoot);
              await writeFile(join(projectRoot, ".git"), "gitdir: private\n");
            }
            return "";
          }

          assert.equal(input.executable, process.execPath);
          const command = input.arguments[1];

          if (command === "create") {
            primaryRoot = input.arguments[
              input.arguments.indexOf("--directory") + 1
            ];
            ownedPath = dirname(primaryRoot);
            assert.equal((await lstat(ownedPath)).mode & 0o777, 0o700);
            await mkdir(primaryRoot);
            return `${JSON.stringify({
              ok: true,
              command: "create",
              destination: projectRoot,
              profile: "portfolio",
              capabilities: [
                "standards",
                "content-files",
                "section-composition",
                "deployment-cloudflare",
                "observability",
              ],
            })}\n`;
          }
          if (command === "plan-add") {
            return `${JSON.stringify({
              ok: true,
              command: "plan-add",
              result: {
                operation: "add-capability",
                status: "approval-required",
                planFingerprint: `sha256:${"a".repeat(64)}`,
                profile: "portfolio",
                capability: {
                  identifier: "booking-calendly",
                  version: "0.1.0",
                },
              },
            })}\n`;
          }
          if (command === "apply-add") {
            return `${JSON.stringify({
              ok: true,
              command: "apply-add",
              result: {
                status: "verified-final-diff-approval-required",
                capability: {
                  identifier: "booking-calendly",
                  version: "0.1.0",
                },
                migration: "add-booking-calendly-0-1-0",
              },
            })}\n`;
          }
          if (command === "infer") {
            return `${JSON.stringify({
              ok: true,
              command: "infer",
              result: {
                state: {
                  kind: "valid",
                  value: {
                    installedCapabilities: [
                      { identifier: "booking-calendly", version: "0.1.0" },
                    ],
                  },
                },
                capabilities: [
                  { identifier: "booking-calendly", category: "confirmed" },
                ],
              },
            })}\n`;
          }
          if (command === "doctor") {
            return `${JSON.stringify({
              ok: true,
              command: "doctor",
              result: { healthy: true, diagnostics: [] },
            })}\n`;
          }
          if (command === "diff") {
            return `${JSON.stringify({
              ok: true,
              command: "diff",
              result: { equal: true, differences: [] },
            })}\n`;
          }
          throw new Error("unexpected command");
        },
        async verifyProject(root, identifier) {
          verifiedRoot = root;
          assert.equal(identifier, "portfolio-calendly");
          assert.notEqual(root, projectRoot);
          assert.equal(dirname(root), ownedPath);
          assert.equal(await pathExists(join(root, ".git")), false);
          return {
            ok: true,
            fixtures: ["portfolio-calendly"],
            profiles: ["portfolio"],
            checks: fixedChecks,
          };
        },
      },
    );

    assert.deepEqual(result, {
      ok: true,
      capability: "booking-calendly",
      version: "0.1.0",
      profile: "portfolio",
      mode: "popup",
      checks: [
        "compiled-cli-create-baseline",
        "clean-linked-worktree",
        "compiled-cli-plan-add",
        "compiled-cli-apply-add",
        "state-inference",
        "healthy-diagnostics",
        "exact-diff",
        ...fixedChecks,
      ],
    });
    assert.equal(commands.length, 12);
    assert.deepEqual(
      commands
        .filter(({ executable }) => executable === process.execPath)
        .map(({ arguments: arguments_ }) => arguments_.slice(1)),
      [
        [
          "create",
          "--profile",
          "portfolio",
          "--name",
          "acme-portfolio-calendly",
          "--display-name",
          "Acme Portfolio Booking",
          "--directory",
          primaryRoot,
        ],
        [
          "plan-add",
          "--directory",
          projectRoot,
          "--capability",
          "booking-calendly",
          "--calendly-url",
          "https://calendly.com/example/intro",
          "--calendly-mode",
          "popup",
        ],
        [
          "apply-add",
          "--directory",
          projectRoot,
          "--capability",
          "booking-calendly",
          "--calendly-url",
          "https://calendly.com/example/intro",
          "--calendly-mode",
          "popup",
          "--approved-plan",
          `sha256:${"a".repeat(64)}`,
        ],
        ["infer", "--directory", projectRoot],
        ["doctor", "--directory", projectRoot],
        ["diff", "--directory", projectRoot],
      ],
    );
    assert.deepEqual(
      commands
        .filter(({ executable }) => executable === "git")
        .map(({ arguments: arguments_ }) => arguments_),
      [
        ["-C", primaryRoot, "init", "--initial-branch", "main"],
        ["-C", primaryRoot, "config", "user.name", "Egeria Certification"],
        [
          "-C",
          primaryRoot,
          "config",
          "user.email",
          "certification@example.invalid",
        ],
        ["-C", primaryRoot, "add", "--all"],
        ["-C", primaryRoot, "commit", "-m", "Create certification baseline"],
        [
          "-C",
          primaryRoot,
          "worktree",
          "add",
          "-b",
          "booking-calendly-certification-worktree",
          projectRoot,
        ],
      ],
    );
    assert.notEqual(verifiedRoot, projectRoot);
    assert.equal(await pathExists(ownedPath), false);
    assert.doesNotMatch(JSON.stringify(result), /calendly\.com|PRIVATE_VALUE/u);
  } finally {
    if (previousToken === undefined) {
      delete process.env.CLOUDFLARE_API_TOKEN;
    } else {
      process.env.CLOUDFLARE_API_TOKEN = previousToken;
    }
  }
});

test("Calendly production mutation maps command failures and removes its real owner", async () => {
  let ownedPath;

  await assert.rejects(
    () =>
      certifyBookingCalendlyForTesting(
        { calendlyUrl: "https://calendly.com/example/private-value" },
        {
          async runCommand(input) {
            ownedPath = dirname(
              input.arguments[input.arguments.indexOf("--directory") + 1],
            );
            throw new Error("PRIVATE_VALUE");
          },
          async verifyProject() {
            throw new Error("must not verify");
          },
        },
      ),
    (error) => {
      assert.equal(error?.name, "BookingCalendlyCertificationError");
      assert.equal(error?.code, "BASELINE_CREATE_FAILED");
      assert.doesNotMatch(String(error), /PRIVATE_VALUE|calendly\.com/u);
      return true;
    },
  );
  assert.equal(await pathExists(ownedPath), false);
});

test("Calendly certification canonicalizes an owned directory below a symbolic-link parent", async () => {
  const testRoot = await mkdtemp(
    join(tmpdir(), "egeria-calendly-canonical-owner-test-"),
  );
  const canonicalParent = join(testRoot, "canonical");
  const aliasParent = join(testRoot, "alias");
  await mkdir(canonicalParent);
  await symlink(
    canonicalParent,
    aliasParent,
    process.platform === "win32" ? "junction" : "dir",
  );
  const requestedOutputRoot = join(aliasParent, "owner");
  let observedOutputRoot;

  try {
    await assert.rejects(
      () =>
        certifyBookingCalendlyForTesting(
          {
            calendlyUrl: "https://calendly.com/example/private-value",
            outputRoot: requestedOutputRoot,
          },
          {
            async runCommand(input) {
              observedOutputRoot = dirname(
                input.arguments[input.arguments.indexOf("--directory") + 1],
              );
              throw new Error("stop after observing canonical owner");
            },
            async verifyProject() {
              throw new Error("must not verify");
            },
          },
        ),
      (error) => {
        assert.equal(error?.code, "BASELINE_CREATE_FAILED");
        return true;
      },
    );

    assert.equal(observedOutputRoot, join(await realpath(aliasParent), "owner"));
    assert.equal(await pathExists(requestedOutputRoot), false);
  } finally {
    await rm(testRoot, { recursive: true });
  }
});

test("Calendly testing API rejects the production-adapter mutation", async () => {
  for (const adapters of [undefined, null, {}, { runCommand() {} }]) {
    await assert.rejects(
      () =>
        certifyBookingCalendlyForTesting(
          { calendlyUrl: "https://calendly.com/example/intro" },
          adapters,
        ),
      (error) => {
        assert.equal(error?.name, "BookingCalendlyCertificationError");
        assert.equal(error?.code, "CERTIFICATION_ADAPTER_INVALID");
        return true;
      },
    );
  }
});

test("Calendly certification rejects unsafe retained output roots before commands", async () => {
  const owner = await mkdtemp(join(tmpdir(), "egeria-calendly-output-test-"));
  const existing = join(owner, "existing");
  await mkdir(existing);
  let calls = 0;
  const adapters = {
    runCommand() {
      calls += 1;
      throw new Error("must not run");
    },
    verifyProject() {
      throw new Error("must not verify");
    },
  };

  try {
    for (const outputRoot of ["relative-output", existing]) {
      await assert.rejects(
        () =>
          certifyBookingCalendlyForTesting(
            {
              calendlyUrl: "https://calendly.com/example/private-value",
              outputRoot,
            },
            adapters,
          ),
        (error) => {
          assert.equal(error?.name, "BookingCalendlyCertificationError");
          assert.equal(error?.code, "CERTIFICATION_OUTPUT_ROOT_INVALID");
          assert.doesNotMatch(String(error), /PRIVATE_VALUE|calendly\.com/u);
          return true;
        },
      );
    }
    assert.equal(calls, 0);
    assert.equal((await lstat(existing)).isDirectory(), true);
  } finally {
    await rm(owner, { recursive: true });
  }
});

test("the certification entry rejects unknown arguments without echoing them", async () => {
  let result;
  try {
    await execFileAsync(process.execPath, [
      certificationScript,
      "--unknown",
      "private-value",
    ], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { PATH: process.env.PATH },
    });
    assert.fail("invalid arguments must fail");
  } catch (error) {
    result = error;
  }

  assert.equal(result.code, 2);
  assert.equal(result.stdout, "");
  assert.equal(
    result.stderr,
    `${JSON.stringify({
      ok: false,
      code: "CERTIFICATION_ARGUMENT_INVALID",
    })}\n`,
  );
  assert.doesNotMatch(result.stderr, /private-value/u);
});

test("the certification entry accepts retained output syntax before safe root validation", async () => {
  let result;
  try {
    await execFileAsync(process.execPath, [
      certificationScript,
      "--output-root",
      "private-relative-output",
      "--calendly-url",
      "https://calendly.com/example/private-value",
    ], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { PATH: process.env.PATH },
    });
    assert.fail("relative retained output must fail");
  } catch (error) {
    result = error;
  }

  assert.equal(result.code, 1);
  assert.equal(result.stdout, "");
  assert.equal(
    result.stderr,
    `${JSON.stringify({
      ok: false,
      code: "CERTIFICATION_OUTPUT_ROOT_INVALID",
    })}\n`,
  );
  assert.doesNotMatch(result.stderr, /private-relative|calendly\.com/u);
});

test("the certification entry accepts the conventional package-script separator", async () => {
  let result;
  try {
    await execFileAsync(process.execPath, [
      certificationScript,
      "--",
      "--output-root",
      "private-relative-output",
      "--calendly-url",
      "https://calendly.com/example/private-value",
    ], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { PATH: process.env.PATH },
    });
    assert.fail("relative retained output must fail");
  } catch (error) {
    result = error;
  }

  assert.equal(result.code, 1);
  assert.equal(result.stdout, "");
  assert.equal(
    result.stderr,
    `${JSON.stringify({
      ok: false,
      code: "CERTIFICATION_OUTPUT_ROOT_INVALID",
    })}\n`,
  );
  assert.doesNotMatch(result.stderr, /private-relative|calendly\.com/u);
});
