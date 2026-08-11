import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, lstat, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { certifyProductionObservabilityForTesting } from "../../scripts/certify-production-observability.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const certificationScript = resolve(
  repositoryRoot,
  "scripts/certify-production-observability.mjs",
);

const fixedChecks = Object.freeze([
  "pnpm-version",
  "frozen-install",
  "peer-dependencies",
  "dependency-audit",
  "registry-signatures",
  "lint",
  "typecheck",
  "next-build",
  "opennext-build",
  "browser-install",
  "browser-development",
  "browser-preview",
]);

function observabilityCommandOutput(
  command,
  version = "0.2.0",
  category = "confirmed",
) {
  if (command === "create") {
    return {
      ok: true,
      command: "create",
      profile: "portfolio",
      capabilities: [
        "standards",
        "content-files",
        "section-composition",
        "deployment-cloudflare",
        "observability",
      ],
    };
  }
  if (command === "infer") {
    return {
      ok: true,
      command: "infer",
      result: {
        state: {
          kind: "valid",
          value: {
            installedCapabilities: [
              { identifier: "observability", version },
            ],
          },
        },
        capabilities: [{ identifier: "observability", category }],
      },
    };
  }
  if (command === "doctor") {
    return {
      ok: true,
      command: "doctor",
      result: { healthy: true, diagnostics: [] },
    };
  }
  if (command === "diff") {
    return {
      ok: true,
      command: "diff",
      result: { equal: true, differences: [] },
    };
  }
  throw new Error("unexpected command");
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function cleanupRetainedDirectory(path) {
  if (path !== undefined) {
    await rm(path, { recursive: true, force: true });
  }
}

test("observability production mutation keeps real owner identity while testing mocks commands and verification", async () => {
  const commands = [];
  let ownedPath;
  let projectRoot;
  let verifiedRoot;
  const previousToken = process.env.CLOUDFLARE_API_TOKEN;
  process.env.CLOUDFLARE_API_TOKEN = "PRIVATE_VALUE";

  try {
    const result = await certifyProductionObservabilityForTesting({
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
                    { identifier: "observability", version: "0.2.0" },
                  ],
                },
              },
              capabilities: [
                { identifier: "observability", category: "confirmed" },
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
        assert.equal(identifier, "portfolio");
        return {
          ok: true,
          fixtures: ["portfolio"],
          profiles: ["portfolio"],
          checks: fixedChecks,
        };
      },
    });

    assert.deepEqual(result, {
      ok: true,
      capability: "observability",
      version: "0.2.0",
      profile: "portfolio",
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
          "acme-portfolio-observability",
          "--display-name",
          "Acme Portfolio Observability",
          "--directory",
          projectRoot,
        ],
        ["infer", "--directory", projectRoot],
        ["doctor", "--directory", projectRoot],
        ["diff", "--directory", projectRoot],
      ],
    );
    assert.equal(verifiedRoot, projectRoot);
    assert.equal(await pathExists(ownedPath), false);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_VALUE/u);
  } finally {
    if (previousToken === undefined) {
      delete process.env.CLOUDFLARE_API_TOKEN;
    } else {
      process.env.CLOUDFLARE_API_TOKEN = previousToken;
    }
  }
});

test("observability production mutation rejects a wrong installed capability version", async () => {
  let ownedPath;

  await assert.rejects(
      () =>
        certifyProductionObservabilityForTesting({
          async runCommand(input) {
            const command = input.arguments[1];
            ownedPath = dirname(
              input.arguments[input.arguments.indexOf("--directory") + 1],
            );
            return `${JSON.stringify(
              observabilityCommandOutput(command, "0.1.0"),
            )}\n`;
          },
          async verifyProject() {
            throw new Error("must not verify");
          },
        }),
    (error) => {
      assert.equal(error?.name, "ProductionObservabilityCertificationError");
      assert.equal(error?.code, "FRESH_SCAFFOLD_INFERENCE_INVALID");
      return true;
    },
  );
  assert.equal(await pathExists(ownedPath), false);
});

test("observability production mutation rejects an unconfirmed inference category", async () => {
  let ownedPath;

  await assert.rejects(
    () =>
      certifyProductionObservabilityForTesting({
          async runCommand(input) {
            ownedPath = dirname(
              input.arguments[input.arguments.indexOf("--directory") + 1],
            );
            return `${JSON.stringify(
              observabilityCommandOutput(
                input.arguments[1],
                "0.2.0",
                "inferred",
              ),
            )}\n`;
          },
          async verifyProject() {
            throw new Error("must not verify");
          },
        }),
    (error) => {
      assert.equal(error?.name, "ProductionObservabilityCertificationError");
      assert.equal(error?.code, "FRESH_SCAFFOLD_INFERENCE_INVALID");
      return true;
    },
  );
  assert.equal(await pathExists(ownedPath), false);
});

test("observability production mutation refuses identity-replacement cleanup", async () => {
  let retainedOwner;

  try {
    await assert.rejects(
      () =>
        certifyProductionObservabilityForTesting({
          async runCommand(input) {
            const command = input.arguments[1];
            const projectRoot = input.arguments[
              input.arguments.indexOf("--directory") + 1
            ];
            if (command === "create") {
              retainedOwner = dirname(projectRoot);
              assert.equal((await lstat(retainedOwner)).mode & 0o777, 0o700);
              await rm(retainedOwner, { recursive: true });
              await mkdir(retainedOwner, { mode: 0o700 });
            }
            return `${JSON.stringify(observabilityCommandOutput(command))}\n`;
          },
          async verifyProject(root, identifier) {
            assert.equal(identifier, "portfolio");
            return {
              ok: true,
              fixtures: ["portfolio"],
              profiles: ["portfolio"],
              checks: fixedChecks,
            };
          },
        }),
      (error) => {
        assert.equal(error?.name, "ProductionObservabilityCertificationError");
        assert.equal(error?.code, "CERTIFICATION_CLEANUP_FAILED");
        return true;
      },
    );
    assert.equal(await pathExists(retainedOwner), true);
  } finally {
    await cleanupRetainedDirectory(retainedOwner);
  }
});

test("observability testing API rejects the production-adapter mutation", async () => {
  for (const adapters of [undefined, null, {}, { runCommand() {} }]) {
    await assert.rejects(
      () => certifyProductionObservabilityForTesting(adapters),
      (error) => {
        assert.equal(error?.name, "ProductionObservabilityCertificationError");
        assert.equal(error?.code, "CERTIFICATION_ADAPTER_INVALID");
        return true;
      },
    );
  }
});

test("the observability certification entry rejects unknown arguments without echoing them", async () => {
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
