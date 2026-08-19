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
  rm,
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
import { certifyGeneratedTestingForTesting } from "../../scripts/certify-generated-testing.mjs";
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
const generatedTestingCertificationScript = resolve(
  repositoryRoot,
  "scripts/certify-generated-testing.mjs",
);

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
  inferredCapability,
  readCurrentRevision,
  postCreate = async () => {},
  verifierIdentifier = "portfolio",
}) {
  const state = {
    commands: [],
    ownedPath: undefined,
    projectRoot: undefined,
    verifiedProjectName: undefined,
    verifiedRoot: undefined,
  };

  return {
    state,
    adapters: {
      readCurrentRevision,
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
      async verifyProject(root, identifier, expectedProjectName) {
        state.verifiedRoot = root;
        state.verifiedProjectName = expectedProjectName;
        assert.equal(identifier, verifierIdentifier);
        return {
          ok: true,
          fixtures: [verifierIdentifier],
          profiles: ["portfolio"],
          checks: fixedChecks,
        };
      },
    },
  };
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

test("the repository registry admits current descriptors and rejects closure while deployment is pending", async () => {
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
          path: ["records", "deployment-cloudflare", "status"],
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
        ["content-files", "backfill-pending"],
        ["deployment-cloudflare", "pending"],
        ["section-composition", "backfill-pending"],
        ["site-routing", "backfill-pending"],
      ].map(([capabilityIdentifier, reason]) => ({
        code: "CAPABILITY_CERTIFICATION_PENDING",
        path: ["records", capabilityIdentifier, "status"],
        context: { reason },
      })),
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
    inferredCapability: { identifier: "standards", version: "0.3.0" },
  });

  try {
    const result = await certifyGeneratedTestingForTesting(scaffold.adapters);

    assert.deepEqual(result, {
      ok: true,
      capability: "standards",
      version: "0.3.0",
      profile: "portfolio",
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

test("generated testing certification rejects incomplete, extra, or reordered verifier checks", async () => {
  const commandOutput = (input) => {
    const command = input.arguments[1];
    if (command === "create") {
      return `${JSON.stringify({
        ok: true,
        command,
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
    if (command === "infer") {
      return `${JSON.stringify({
        ok: true,
        command,
        result: {
          state: {
            kind: "valid",
            value: {
              installedCapabilities: [
                { identifier: "standards", version: "0.3.0" },
              ],
            },
          },
          capabilities: [
            { identifier: "standards", category: "confirmed" },
          ],
        },
      })}\n`;
    }
    if (command === "doctor") {
      return `${JSON.stringify({
        ok: true,
        command,
        result: { healthy: true, diagnostics: [] },
      })}\n`;
    }
    if (command === "diff") {
      return `${JSON.stringify({
        ok: true,
        command,
        result: { equal: true, differences: [] },
      })}\n`;
    }
    throw new Error("unexpected command");
  };
  const invalidChecks = [
    fixedChecks.slice(0, -1),
    [...fixedChecks, "unexpected"],
    [...fixedChecks].reverse(),
  ];

  for (const checks of invalidChecks) {
    await assert.rejects(
      certifyGeneratedTestingForTesting({
        runCommand: async (input) => commandOutput(input),
        verifyProject: async () => ({
          ok: true,
          fixtures: ["portfolio"],
          profiles: ["portfolio"],
          checks,
        }),
      }),
      (error) => {
        assert.equal(error.name, "GeneratedTestingCertificationError");
        assert.equal(error.code, "GENERATED_PROJECT_VERIFICATION_INVALID");
        return true;
      },
    );
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
  let verifiedRoot;
  const previousToken = process.env.CLOUDFLARE_API_TOKEN;
  process.env.CLOUDFLARE_API_TOKEN = "PRIVATE_VALUE";

  try {
    const result = await certifyBookingCalendlyForTesting(
      { calendlyUrl: "https://calendly.com/example/intro" },
      {
        async runCommand(input) {
          commands.push(input);
          assert.equal(input.executable, process.execPath);
          assert.equal(input.environment.CLOUDFLARE_API_TOKEN, undefined);
          assert.equal(input.environment.NPM_TOKEN, undefined);
          assert.equal(input.environment.NODE_OPTIONS, undefined);
          const command = input.arguments[1];

          if (command === "create") {
            projectRoot = input.arguments[
              input.arguments.indexOf("--directory") + 1
            ];
            ownedPath = dirname(projectRoot);
            assert.equal((await lstat(ownedPath)).mode & 0o777, 0o700);
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
                "booking-calendly",
              ],
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
        "compiled-cli-create",
        "state-inference",
        "healthy-diagnostics",
        "exact-diff",
        ...fixedChecks,
      ],
    });
    assert.equal(commands.length, 4);
    assert.deepEqual(
      commands.map(({ arguments: arguments_ }) => arguments_.slice(1)),
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
          projectRoot,
          "--calendly-url",
          "https://calendly.com/example/intro",
          "--calendly-mode",
          "popup",
        ],
        ["infer", "--directory", projectRoot],
        ["doctor", "--directory", projectRoot],
        ["diff", "--directory", projectRoot],
      ],
    );
    assert.equal(verifiedRoot, projectRoot);
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
      assert.equal(error?.code, "FRESH_SCAFFOLD_CREATE_FAILED");
      assert.doesNotMatch(String(error), /PRIVATE_VALUE|calendly\.com/u);
      return true;
    },
  );
  assert.equal(await pathExists(ownedPath), false);
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
