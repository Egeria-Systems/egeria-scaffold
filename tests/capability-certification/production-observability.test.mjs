import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, lstat, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
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

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function createKnownOwner(parent) {
  const path = await mkdtemp(join(parent, "certification-owner-"));
  const stats = await lstat(path, { bigint: true });
  return { path, device: stats.dev, inode: stats.ino };
}

test("observability fresh certification drives the compiled CLI and fixed verifier without provider input", async () => {
  const ownerParent = await mkdtemp(join(tmpdir(), "egeria-observability-certification-test-"));
  const commands = [];
  let ownedPath;
  let verifiedRoot;
  const previousToken = process.env.CLOUDFLARE_API_TOKEN;
  process.env.CLOUDFLARE_API_TOKEN = "PRIVATE_VALUE";

  try {
    const result = await certifyProductionObservabilityForTesting({
      async createOwner() {
        const identity = await createKnownOwner(ownerParent);
        ownedPath = identity.path;
        return identity;
      },
      async runCommand(input) {
        commands.push(input);
        assert.equal(input.executable, process.execPath);
        assert.equal(input.environment.CLOUDFLARE_API_TOKEN, undefined);
        assert.equal(input.environment.NPM_TOKEN, undefined);
        assert.equal(input.environment.NODE_OPTIONS, undefined);
        const command = input.arguments[1];

        if (command === "create") {
          return `${JSON.stringify({
            ok: true,
            command: "create",
            destination: join(ownedPath, "project"),
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
      commands.map(({ arguments: arguments_ }) => arguments_[1]),
      ["create", "infer", "doctor", "diff"],
    );
    assert.deepEqual(commands[0].arguments.slice(1), [
      "create",
      "--profile",
      "portfolio",
      "--name",
      "acme-portfolio-observability",
      "--display-name",
      "Acme Portfolio Observability",
      "--directory",
      join(ownedPath, "project"),
    ]);
    assert.equal(verifiedRoot, join(ownedPath, "project"));
    assert.equal(await pathExists(ownedPath), false);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_VALUE/u);
  } finally {
    if (previousToken === undefined) {
      delete process.env.CLOUDFLARE_API_TOKEN;
    } else {
      process.env.CLOUDFLARE_API_TOKEN = previousToken;
    }
    await rm(ownerParent, { recursive: true, force: true });
  }
});

test("observability fresh certification rejects an invalid subject and still removes its identity-bound owner", async () => {
  const ownerParent = await mkdtemp(join(tmpdir(), "egeria-observability-certification-failure-"));
  let ownedPath;

  try {
    await assert.rejects(
      () =>
        certifyProductionObservabilityForTesting({
          async createOwner() {
            const identity = await createKnownOwner(ownerParent);
            ownedPath = identity.path;
            return identity;
          },
          async runCommand(input) {
            if (input.arguments[1] !== "create") {
              throw new Error("must not run later commands");
            }
            return `${JSON.stringify({
              ok: true,
              command: "create",
              profile: "portfolio",
              capabilities: [
                "standards",
                "content-files",
                "section-composition",
                "deployment-cloudflare",
              ],
            })}\n`;
          },
          async verifyProject() {
            throw new Error("must not verify");
          },
        }),
      (error) => {
        assert.equal(error?.name, "ProductionObservabilityCertificationError");
        assert.equal(error?.code, "FRESH_SCAFFOLD_CREATE_INVALID");
        return true;
      },
    );
    assert.equal(await pathExists(ownedPath), false);
  } finally {
    await rm(ownerParent, { recursive: true, force: true });
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
