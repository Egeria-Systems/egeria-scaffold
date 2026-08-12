import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, lstat, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

import { certifyBookingCalendlyForTesting } from "../../scripts/certify-booking-calendly.mjs";
import { certifyGeneratedTestingForTesting } from "../../scripts/certify-generated-testing.mjs";

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
const generatedTestingCertificationScript = resolve(
  repositoryRoot,
  "scripts/certify-generated-testing.mjs",
);
const generatedTestingReceiptPath = resolve(
  repositoryRoot,
  "docs/implementation-evidence/generated-unit-component-testing-certification-receipt.json",
);
const generatedTestingEvidenceRevision =
  "c9294e9dc59d4b7bafed406846af3b43a10733d3";
const generatedTestingSubject = Object.freeze({
  descriptorVersion: "0.3.0",
  behaviorContractDigest:
    "sha256:be53fdace61b6782e7f0abbbc0af7c333f81122f3a62fcfc7eb0ac687b2ff2fb",
});
const generatedTestingOutcomeCommands = Object.freeze({
  "fresh-scaffold": Object.freeze([
    "pnpm run verify:generated-testing-certification",
  ]),
  "unit-tests": Object.freeze(["pnpm --dir apps/web run test:unit"]),
  "component-tests": Object.freeze([
    "pnpm --dir apps/web run test:component",
  ]),
  "state-agreement": Object.freeze([
    "node apps/cli/dist/index.js infer --directory GENERATED_PROJECT",
    "node apps/cli/dist/index.js doctor --directory GENERATED_PROJECT",
    "node apps/cli/dist/index.js diff --directory GENERATED_PROJECT",
  ]),
  "generated-project-builds": Object.freeze([
    "pnpm run verify:generated-testing-certification",
  ]),
  "browser-regression": Object.freeze([
    "pnpm run verify:generated-testing-certification",
  ]),
  "retained-fixture-matrix": Object.freeze([
    "pnpm run test:generated-fixtures",
    "pnpm run verify:generated-skeletons",
  ]),
  "ci-contract": Object.freeze(["pnpm run test:constitution"]),
});
const generatedTestingOutcomeIdentifiers = Object.freeze(
  Object.keys(generatedTestingOutcomeCommands),
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

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
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

function assertExactKeys(value, expectedKeys) {
  assert.deepEqual(Object.keys(value).toSorted(), expectedKeys.toSorted());
}

function assertGeneratedTestingReceipt(receipt) {
  assertExactKeys(receipt, [
    "schemaVersion",
    "capability",
    "subject",
    "evidenceRevision",
    "status",
    "reviewDecision",
    "unresolvedPrompts",
    "hostedRunClaim",
    "outcomes",
  ]);
  assert.equal(receipt.schemaVersion, "1.0.0");
  assert.equal(receipt.capability, "standards");
  assert.deepEqual(receipt.subject, generatedTestingSubject);
  assert.equal(receipt.evidenceRevision, generatedTestingEvidenceRevision);
  assert.equal(receipt.status, "complete");
  assert.equal(receipt.reviewDecision, "accepted");
  assert.deepEqual(receipt.unresolvedPrompts, []);
  assert.deepEqual(receipt.hostedRunClaim, {
    claimed: false,
    basis: "static-ci-contract-only",
  });
  assert.equal(receipt.outcomes.length, generatedTestingOutcomeIdentifiers.length);
  assert.deepEqual(
    receipt.outcomes.map(({ identifier }) => identifier),
    generatedTestingOutcomeIdentifiers,
  );
  assert.equal(
    new Set(receipt.outcomes.map(({ identifier }) => identifier)).size,
    generatedTestingOutcomeIdentifiers.length,
  );

  for (const outcome of receipt.outcomes) {
    assertExactKeys(outcome, [
      "identifier",
      "capability",
      "subject",
      "evidenceRevision",
      "commands",
      "result",
      "reviewDecision",
      "summary",
    ]);
    assert.equal(outcome.capability, "standards");
    assert.deepEqual(outcome.subject, generatedTestingSubject);
    assert.equal(outcome.evidenceRevision, generatedTestingEvidenceRevision);
    assert.deepEqual(
      outcome.commands,
      generatedTestingOutcomeCommands[outcome.identifier],
    );
    assert.equal(outcome.result, "passed");
    assert.equal(outcome.reviewDecision, "accepted");
    assert.equal(typeof outcome.summary, "string");
    assert.notEqual(outcome.summary.length, 0);
    assert.doesNotMatch(
      outcome.summary,
      /PRIVATE_VALUE|\/private\/|\[replace|\bTBD\b/u,
    );
  }
}

test("the repository registry admits certified standards while remaining open for observability", async () => {
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
      ].map(([capabilityIdentifier, reason]) => ({
        code: "CAPABILITY_CERTIFICATION_PENDING",
        path: ["records", capabilityIdentifier, "status"],
        context: { reason },
      })),
    })}\n`,
    stderr: "",
  });
});

test("the generated testing receipt binds all reviewed outcomes to the exact standards subject", async () => {
  const receipt = JSON.parse(await readFile(generatedTestingReceiptPath, "utf8"));
  assertGeneratedTestingReceipt(receipt);

  const mutations = [
    {
      label: "missing outcome",
      mutate(candidate) {
        candidate.outcomes.pop();
      },
    },
    {
      label: "failed outcome",
      mutate(candidate) {
        candidate.outcomes[0].result = "failed";
      },
    },
    {
      label: "stale revision",
      mutate(candidate) {
        candidate.outcomes[0].evidenceRevision = "0".repeat(40);
      },
    },
    {
      label: "duplicated outcome",
      mutate(candidate) {
        candidate.outcomes[1] = structuredClone(candidate.outcomes[0]);
      },
    },
    {
      label: "extra outcome",
      mutate(candidate) {
        candidate.outcomes.push({
          ...structuredClone(candidate.outcomes[0]),
          identifier: "unexpected",
        });
      },
    },
    {
      label: "wrong subject",
      mutate(candidate) {
        candidate.outcomes[0].subject.descriptorVersion = "0.2.0";
      },
    },
    {
      label: "unreviewed outcome",
      mutate(candidate) {
        candidate.outcomes[0].reviewDecision = "pending";
      },
    },
    {
      label: "unresolved prompt",
      mutate(candidate) {
        candidate.unresolvedPrompts.push("present");
      },
    },
  ];

  for (const { label, mutate } of mutations) {
    const candidate = structuredClone(receipt);
    mutate(candidate);
    assert.throws(
      () => assertGeneratedTestingReceipt(candidate),
      undefined,
      label,
    );
  }
});

test("generated testing certification binds a fresh portfolio to the exact standards subject", async () => {
  const commands = [];
  let ownedPath;
  let projectRoot;
  let verifiedRoot;
  const previousToken = process.env.NPM_TOKEN;
  process.env.NPM_TOKEN = "PRIVATE_VALUE";

  try {
    const result = await certifyGeneratedTestingForTesting({
      async runCommand(input) {
        commands.push(input);
        assert.equal(input.executable, process.execPath);
        assert.equal(input.environment.NPM_TOKEN, undefined);
        assert.equal(input.environment.CLOUDFLARE_API_TOKEN, undefined);
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
      commands.map(({ arguments: arguments_ }) => arguments_.slice(1)),
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
