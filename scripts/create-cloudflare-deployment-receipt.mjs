import { open } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const maximumInputBytes = 65_536;
const maximumDeploymentCount = 100;
const exactRevisionPattern = /^[0-9a-f]{40}$/u;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const workerName = "acme-portfolio-observability";
const checks = Object.freeze([
  "git-revision-validated",
  "worker-validated",
  "latest-deployment-selected",
  "single-version-100-percent",
]);

export class CloudflareDeploymentReceiptError extends Error {
  constructor(code) {
    super(`Cloudflare deployment receipt failed: ${code}`);
    this.name = "CloudflareDeploymentReceiptError";
    this.code = code;
  }
}

function createError(code) {
  return new CloudflareDeploymentReceiptError(code);
}

function readCreatedOn(deployment) {
  if (
    typeof deployment !== "object" ||
    deployment === null ||
    typeof deployment.created_on !== "string" ||
    deployment.created_on.length > 64
  ) {
    throw createError("DEPLOYMENT_RECEIPT_DEPLOYMENTS_INVALID");
  }

  const timestamp = Date.parse(deployment.created_on);
  if (!Number.isFinite(timestamp)) {
    throw createError("DEPLOYMENT_RECEIPT_DEPLOYMENTS_INVALID");
  }
  return timestamp;
}

function selectLatestDeployment(deployments) {
  if (
    !Array.isArray(deployments) ||
    deployments.length === 0 ||
    deployments.length > maximumDeploymentCount
  ) {
    throw createError("DEPLOYMENT_RECEIPT_DEPLOYMENTS_INVALID");
  }

  const timestamped = deployments.map((deployment) => ({
    deployment,
    timestamp: readCreatedOn(deployment),
  }));
  const latestTimestamp = Math.max(
    ...timestamped.map(({ timestamp }) => timestamp),
  );
  const latest = timestamped.filter(
    ({ timestamp }) => timestamp === latestTimestamp,
  );
  if (latest.length !== 1) {
    throw createError("DEPLOYMENT_RECEIPT_LATEST_AMBIGUOUS");
  }
  return latest[0].deployment;
}

function readLatestIdentity(deployment) {
  if (
    typeof deployment.id !== "string" ||
    !uuidPattern.test(deployment.id) ||
    !Array.isArray(deployment.versions) ||
    deployment.versions.length !== 1
  ) {
    throw createError("DEPLOYMENT_RECEIPT_IDENTITY_INVALID");
  }

  const version = deployment.versions[0];
  if (
    typeof version !== "object" ||
    version === null ||
    typeof version.version_id !== "string" ||
    !uuidPattern.test(version.version_id) ||
    version.percentage !== 100
  ) {
    throw createError("DEPLOYMENT_RECEIPT_IDENTITY_INVALID");
  }

  return Object.freeze({
    cloudflareDeploymentId: deployment.id,
    cloudflareVersionId: version.version_id,
  });
}

function parseRawDeployments(rawInput) {
  if (typeof rawInput !== "string") {
    throw createError("DEPLOYMENT_RECEIPT_INPUT_INVALID");
  }
  if (Buffer.byteLength(rawInput, "utf8") > maximumInputBytes) {
    throw createError("DEPLOYMENT_RECEIPT_INPUT_TOO_LARGE");
  }

  try {
    return JSON.parse(rawInput);
  } catch {
    throw createError("DEPLOYMENT_RECEIPT_JSON_INVALID");
  }
}

export function createCloudflareDeploymentReceiptForTesting({
  rawInput,
  revision,
  worker,
} = {}) {
  if (typeof revision !== "string" || !exactRevisionPattern.test(revision)) {
    throw createError("DEPLOYMENT_RECEIPT_REVISION_INVALID");
  }
  if (worker !== workerName) {
    throw createError("DEPLOYMENT_RECEIPT_WORKER_INVALID");
  }

  const deployments = parseRawDeployments(rawInput);
  const identity = readLatestIdentity(selectLatestDeployment(deployments));
  return Object.freeze({
    ok: true,
    capability: "observability",
    version: "0.2.0",
    worker: workerName,
    gitRevision: revision,
    ...identity,
    checks,
  });
}

async function readBoundedInput(path) {
  let file;
  try {
    file = await open(path, "r");
    const buffer = Buffer.alloc(maximumInputBytes + 1);
    let bytesRead = 0;

    while (bytesRead < buffer.length) {
      const result = await file.read(
        buffer,
        bytesRead,
        buffer.length - bytesRead,
        bytesRead,
      );
      if (result.bytesRead === 0) break;
      bytesRead += result.bytesRead;
    }

    if (bytesRead > maximumInputBytes) {
      throw createError("DEPLOYMENT_RECEIPT_INPUT_TOO_LARGE");
    }
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(
        buffer.subarray(0, bytesRead),
      );
    } catch {
      throw createError("DEPLOYMENT_RECEIPT_INPUT_INVALID");
    }
  } catch (error) {
    if (error instanceof CloudflareDeploymentReceiptError) throw error;
    throw createError("DEPLOYMENT_RECEIPT_INPUT_INVALID");
  } finally {
    await file?.close().catch(() => undefined);
  }
}

function parseArguments(arguments_) {
  if (
    arguments_.length === 6 &&
    arguments_[0] === "--input" &&
    arguments_[2] === "--revision" &&
    arguments_[4] === "--worker"
  ) {
    return {
      input: arguments_[1],
      revision: arguments_[3],
      worker: arguments_[5],
    };
  }
  return undefined;
}

async function runMain() {
  const input = parseArguments(process.argv.slice(2));
  if (input === undefined) {
    process.stderr.write(
      `${JSON.stringify({
        ok: false,
        code: "DEPLOYMENT_RECEIPT_ARGUMENT_INVALID",
      })}\n`,
    );
    process.exitCode = 2;
    return;
  }

  try {
    const receipt = createCloudflareDeploymentReceiptForTesting({
      rawInput: await readBoundedInput(input.input),
      revision: input.revision,
      worker: input.worker,
    });
    process.stdout.write(`${JSON.stringify(receipt)}\n`);
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({
        ok: false,
        code:
          error instanceof CloudflareDeploymentReceiptError
            ? error.code
            : "DEPLOYMENT_RECEIPT_FAILED",
      })}\n`,
    );
    process.exitCode = 1;
  }
}

if (
  process.argv[1] !== undefined &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  await runMain();
}
