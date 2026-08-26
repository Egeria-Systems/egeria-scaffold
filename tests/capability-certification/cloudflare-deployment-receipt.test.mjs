import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { createCloudflareDeploymentReceiptForTesting } from "../../scripts/create-cloudflare-deployment-receipt.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const deploymentReceiptScript = resolve(
  repositoryRoot,
  "scripts/create-cloudflare-deployment-receipt.mjs",
);
const deployedRevision = "0123456789abcdef0123456789abcdef01234567";
const cloudflareDeploymentId = "11111111-2222-4333-8444-555555555555";
const cloudflareVersionId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const olderCloudflareDeploymentId = "99999999-8888-4777-8666-555555555555";
const olderCloudflareVersionId = "ffffffff-eeee-4ddd-8ccc-bbbbbbbbbbbb";

function cloudflareDeploymentsInput(overrides = {}) {
  return [
    {
      id: olderCloudflareDeploymentId,
      created_on: "2026-08-11T15:00:00.000Z",
      versions: [
        { version_id: olderCloudflareVersionId, percentage: 100 },
      ],
      author_email: "private@example.invalid",
    },
    {
      id: cloudflareDeploymentId,
      created_on: "2026-08-11T16:00:00.000Z",
      versions: [{ version_id: cloudflareVersionId, percentage: 100 }],
      source: "private-provider-field",
      ...overrides,
    },
  ];
}

test("the Cloudflare deployment sanitizer returns only bounded current-subject identity", () => {
  const receipt = createCloudflareDeploymentReceiptForTesting({
    rawInput: JSON.stringify(cloudflareDeploymentsInput()),
    revision: deployedRevision,
    worker: "test-deploy",
    capabilityVersion: "0.3.0",
  });

  assert.deepEqual(receipt, {
    ok: true,
    capability: "observability",
    version: "0.3.0",
    worker: "test-deploy",
    gitRevision: deployedRevision,
    cloudflareDeploymentId,
    cloudflareVersionId,
    checks: [
      "git-revision-validated",
      "worker-validated",
      "latest-deployment-selected",
      "single-version-100-percent",
    ],
  });
  assert.doesNotMatch(JSON.stringify(receipt), /private|example\.invalid/iu);
});

test("the Cloudflare deployment sanitizer rejects ambiguous, malformed, stale, and unsafe identity without exposing input", () => {
  const tiedLatest = cloudflareDeploymentsInput();
  tiedLatest[0].created_on = tiedLatest[1].created_on;

  const failures = [
    [
      {
        rawInput: "private malformed provider response",
        revision: deployedRevision,
        worker: "test-deploy",
        capabilityVersion: "0.3.0",
      },
      "DEPLOYMENT_RECEIPT_JSON_INVALID",
    ],
    [
      {
        rawInput: "[]",
        revision: deployedRevision,
        worker: "test-deploy",
        capabilityVersion: "0.3.0",
      },
      "DEPLOYMENT_RECEIPT_DEPLOYMENTS_INVALID",
    ],
    [
      {
        rawInput: JSON.stringify(tiedLatest),
        revision: deployedRevision,
        worker: "test-deploy",
        capabilityVersion: "0.3.0",
      },
      "DEPLOYMENT_RECEIPT_LATEST_AMBIGUOUS",
    ],
    [
      {
        rawInput: JSON.stringify(
          cloudflareDeploymentsInput({ id: "private-deployment-id" }),
        ),
        revision: deployedRevision,
        worker: "test-deploy",
        capabilityVersion: "0.3.0",
      },
      "DEPLOYMENT_RECEIPT_IDENTITY_INVALID",
    ],
    [
      {
        rawInput: JSON.stringify(
          cloudflareDeploymentsInput({
            versions: [
              { version_id: cloudflareVersionId, percentage: 99 },
              { version_id: olderCloudflareVersionId, percentage: 1 },
            ],
          }),
        ),
        revision: deployedRevision,
        worker: "test-deploy",
        capabilityVersion: "0.3.0",
      },
      "DEPLOYMENT_RECEIPT_IDENTITY_INVALID",
    ],
    [
      {
        rawInput: JSON.stringify(
          cloudflareDeploymentsInput({
            versions: [
              { version_id: "private-version-id", percentage: 100 },
            ],
          }),
        ),
        revision: deployedRevision,
        worker: "test-deploy",
        capabilityVersion: "0.3.0",
      },
      "DEPLOYMENT_RECEIPT_IDENTITY_INVALID",
    ],
    [
      {
        rawInput: JSON.stringify(cloudflareDeploymentsInput()),
        revision: "PRIVATE_REVISION",
        worker: "test-deploy",
        capabilityVersion: "0.3.0",
      },
      "DEPLOYMENT_RECEIPT_REVISION_INVALID",
    ],
    [
      {
        rawInput: JSON.stringify(cloudflareDeploymentsInput()),
        revision: deployedRevision,
        worker: "private-worker",
        capabilityVersion: "0.3.0",
      },
      "DEPLOYMENT_RECEIPT_WORKER_INVALID",
    ],
    [
      {
        rawInput: JSON.stringify(cloudflareDeploymentsInput()),
        revision: deployedRevision,
        worker: "test-deploy",
      },
      "DEPLOYMENT_RECEIPT_VERSION_INVALID",
    ],
    [
      {
        rawInput: JSON.stringify(cloudflareDeploymentsInput()),
        revision: deployedRevision,
        worker: "test-deploy",
        capabilityVersion: "0.2.0",
      },
      "DEPLOYMENT_RECEIPT_VERSION_INVALID",
    ],
  ];

  for (const [input, expectedCode] of failures) {
    assert.throws(
      () => createCloudflareDeploymentReceiptForTesting(input),
      (error) => {
        assert.equal(error?.name, "CloudflareDeploymentReceiptError");
        assert.equal(error?.code, expectedCode);
        assert.doesNotMatch(
          error.message,
          /private|example\.invalid|012345|aaaaaaaa/iu,
        );
        return true;
      },
    );
  }
});

test("the Cloudflare deployment receipt CLI requires an explicit current version and emits one sanitized line", async () => {
  const temporaryRoot = await mkdtemp(
    resolve(tmpdir(), "observability-deployment-receipt-"),
  );
  const inputPath = resolve(temporaryRoot, "private-provider-response.json");

  try {
    await writeFile(
      inputPath,
      JSON.stringify(cloudflareDeploymentsInput()),
      "utf8",
    );
    const result = await execFileAsync(
      process.execPath,
      [
        deploymentReceiptScript,
        "--input",
        inputPath,
        "--revision",
        deployedRevision,
        "--worker",
        "test-deploy",
        "--version",
        "0.3.0",
      ],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        env: { PATH: process.env.PATH },
      },
    );

    assert.equal(result.stderr, "");
    assert.equal(result.stdout.split("\n").length, 2);
    assert.deepEqual(JSON.parse(result.stdout), {
      ok: true,
      capability: "observability",
      version: "0.3.0",
      worker: "test-deploy",
      gitRevision: deployedRevision,
      cloudflareDeploymentId,
      cloudflareVersionId,
      checks: [
        "git-revision-validated",
        "worker-validated",
        "latest-deployment-selected",
        "single-version-100-percent",
      ],
    });
    assert.doesNotMatch(
      result.stdout,
      /private|provider-response|example\.invalid/iu,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("the Cloudflare deployment receipt CLI rejects oversized files and incomplete arguments with stable private-safe errors", async () => {
  const temporaryRoot = await mkdtemp(
    resolve(tmpdir(), "observability-deployment-receipt-"),
  );
  const oversizedPath = resolve(temporaryRoot, "private-oversized-response.json");

  try {
    await writeFile(oversizedPath, "x".repeat(65_537), "utf8");
    const cases = [
      {
        arguments: [
          deploymentReceiptScript,
          "--input",
          oversizedPath,
          "--revision",
          deployedRevision,
          "--worker",
          "test-deploy",
          "--version",
          "0.3.0",
        ],
        exitCode: 1,
        code: "DEPLOYMENT_RECEIPT_INPUT_TOO_LARGE",
      },
      {
        arguments: [
          deploymentReceiptScript,
          "--input",
          oversizedPath,
          "--revision",
          deployedRevision,
          "--worker",
          "test-deploy",
        ],
        exitCode: 2,
        code: "DEPLOYMENT_RECEIPT_ARGUMENT_INVALID",
      },
    ];

    for (const expected of cases) {
      let failure;
      try {
        await execFileAsync(process.execPath, expected.arguments, {
          cwd: repositoryRoot,
          encoding: "utf8",
          env: { PATH: process.env.PATH },
        });
        assert.fail("invalid deployment receipt input must fail");
      } catch (error) {
        failure = error;
      }

      assert.equal(failure.code, expected.exitCode);
      assert.equal(failure.stdout, "");
      assert.equal(
        failure.stderr,
        `${JSON.stringify({ ok: false, code: expected.code })}\n`,
      );
      assert.doesNotMatch(
        failure.stderr,
        /private|oversized|response|012345/iu,
      );
    }
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
