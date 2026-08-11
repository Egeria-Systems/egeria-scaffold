import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, lstat, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

import { certifyBookingCalendlyForTesting } from "../../scripts/certify-booking-calendly.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const checkScript = resolve(
  repositoryRoot,
  "scripts/check-capability-certification.mjs",
);
const certificationScript = resolve(
  repositoryRoot,
  "scripts/certify-booking-calendly.mjs",
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

async function runCheck(arguments_) {
  try {
    const result = await execFileAsync(process.execPath, [checkScript, ...arguments_], {
      cwd: repositoryRoot,
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

test("the repository registry admits but remains open for observability certification", async () => {
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
          path: ["records", "observability", "status"],
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
        ["deployment-cloudflare", "backfill-pending"],
        ["observability", "pending"],
        ["section-composition", "backfill-pending"],
        ["site-routing", "backfill-pending"],
        ["standards", "backfill-pending"],
      ].map(([capabilityIdentifier, reason]) => ({
        code: "CAPABILITY_CERTIFICATION_PENDING",
        path: ["records", capabilityIdentifier, "status"],
        context: { reason },
      })),
    })}\n`,
    stderr: "",
  });
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

test("Calendly fresh certification drives the compiled CLI and fixed verifier without leaking ambient data", async () => {
  const ownerParent = await mkdtemp(join(tmpdir(), "egeria-certification-test-"));
  const commands = [];
  let ownedPath;
  let verifiedRoot;
  const previousToken = process.env.CLOUDFLARE_API_TOKEN;
  process.env.CLOUDFLARE_API_TOKEN = "PRIVATE_VALUE";

  try {
    const result = await certifyBookingCalendlyForTesting(
      { calendlyUrl: "https://calendly.com/example/intro" },
      {
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
      commands.map(({ arguments: arguments_ }) => arguments_[1]),
      ["create", "infer", "doctor", "diff"],
    );
    assert.deepEqual(commands[0].arguments.slice(1), [
      "create",
      "--profile",
      "portfolio",
      "--name",
      "acme-portfolio-calendly",
      "--display-name",
      "Acme Portfolio Booking",
      "--directory",
      join(ownedPath, "project"),
      "--calendly-url",
      "https://calendly.com/example/intro",
      "--calendly-mode",
      "popup",
    ]);
    assert.equal(verifiedRoot, join(ownedPath, "project"));
    assert.equal(await pathExists(ownedPath), false);
    assert.doesNotMatch(JSON.stringify(result), /calendly\.com|PRIVATE_VALUE/u);
  } finally {
    if (previousToken === undefined) {
      delete process.env.CLOUDFLARE_API_TOKEN;
    } else {
      process.env.CLOUDFLARE_API_TOKEN = previousToken;
    }
    await rm(ownerParent, { recursive: true, force: true });
  }
});

test("Calendly fresh certification maps failures and still removes its identity-bound owner", async () => {
  const ownerParent = await mkdtemp(join(tmpdir(), "egeria-certification-failure-"));
  let ownedPath;

  try {
    await assert.rejects(
      () =>
        certifyBookingCalendlyForTesting(
          { calendlyUrl: "https://calendly.com/example/private-value" },
          {
            async createOwner() {
              const identity = await createKnownOwner(ownerParent);
              ownedPath = identity.path;
              return identity;
            },
            async runCommand() {
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
  } finally {
    await rm(ownerParent, { recursive: true, force: true });
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
