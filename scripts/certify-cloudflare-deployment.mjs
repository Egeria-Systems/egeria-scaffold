import { execFile } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  certifyFreshScaffold,
  certifyFreshScaffoldForTesting,
} from "./lib/certify-fresh-scaffold.mjs";
import { runCertificationCli } from "./lib/certification-cli.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const exactRevisionPattern = /^[0-9a-f]{40}$/u;
const subject = Object.freeze({
  descriptorVersion: "0.3.0",
  behaviorContractDigest:
    "sha256:1690cf9bb12e33a07ea2b91f125cdec62d1d302f35bcc7d533c6a89797481d41",
});
const expectedCapabilities = Object.freeze([
  "standards",
  "content-files",
  "section-composition",
  "deployment-cloudflare",
  "observability",
]);
const expectedVerificationChecks = Object.freeze([
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

export class CloudflareDeploymentCertificationError extends Error {
  constructor(code) {
    super(`Cloudflare deployment certification failed: ${code}`);
    this.name = "CloudflareDeploymentCertificationError";
    this.code = code;
  }
}

function createError(code) {
  return new CloudflareDeploymentCertificationError(code);
}

function configurationFor(revision) {
  if (typeof revision !== "string" || !exactRevisionPattern.test(revision)) {
    throw createError("CERTIFICATION_REVISION_INVALID");
  }

  return Object.freeze({
    profile: "portfolio",
    projectName: "acme-portfolio",
    displayName: "Acme Portfolio",
    createArguments: Object.freeze([]),
    expectedCapabilities,
    capabilityIdentifier: "deployment-cloudflare",
    capabilityVersion: "0.3.0",
    expectedRecipeVersion: "0.9.0",
    verifierIdentifier: "portfolio",
    expectedVerificationChecks,
    receipt: Object.freeze({
      subject,
      recipeVersion: "0.9.0",
      evidenceRevision: revision,
    }),
    createError,
    isCertificationError: (error) =>
      error instanceof CloudflareDeploymentCertificationError,
  });
}

async function readCurrentRevision(root = repositoryRoot) {
  let revision;
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
      env: { PATH: process.env.PATH },
    });
    revision = stdout.trim();
    if (!exactRevisionPattern.test(revision)) {
      throw new Error("invalid revision");
    }
  } catch {
    throw createError("CERTIFICATION_REVISION_READ_FAILED");
  }

  let status;
  try {
    ({ stdout: status } = await execFileAsync(
      "git",
      ["status", "--porcelain=v1", "--untracked-files=all"],
      {
        cwd: root,
        encoding: "utf8",
        env: { PATH: process.env.PATH },
      },
    ));
  } catch {
    throw createError("CERTIFICATION_REVISION_READ_FAILED");
  }
  if (status !== "") {
    throw createError("CERTIFICATION_WORKTREE_DIRTY");
  }
  return revision;
}

export async function readCloudflareDeploymentRevisionForTesting(root) {
  return readCurrentRevision(root);
}

async function requireCurrentRevision(revision, readRevision) {
  let currentRevision;
  try {
    currentRevision = await readRevision();
  } catch (error) {
    if (error instanceof CloudflareDeploymentCertificationError) throw error;
    throw createError("CERTIFICATION_REVISION_READ_FAILED");
  }
  if (currentRevision !== revision) {
    throw createError("CERTIFICATION_REVISION_MISMATCH");
  }
}

export async function certifyCloudflareDeployment(input = {}) {
  const configuration = configurationFor(input?.revision);
  await requireCurrentRevision(input.revision, readCurrentRevision);
  const result = await certifyFreshScaffold(configuration);
  await requireCurrentRevision(input.revision, readCurrentRevision);
  return result;
}

export async function certifyCloudflareDeploymentForTesting(input, adapters) {
  const configuration = configurationFor(input?.revision);
  if (typeof adapters?.readCurrentRevision !== "function") {
    throw createError("CERTIFICATION_ADAPTER_INVALID");
  }
  await requireCurrentRevision(input.revision, adapters.readCurrentRevision);
  const result = await certifyFreshScaffoldForTesting(
    configuration,
    adapters,
  );
  await requireCurrentRevision(input.revision, adapters.readCurrentRevision);
  return result;
}

function parseArguments(arguments_) {
  if (arguments_.length === 2 && arguments_[0] === "--revision") {
    return { revision: arguments_[1] };
  }
  return undefined;
}

await runCertificationCli({
  moduleUrl: import.meta.url,
  parseArguments,
  certify: certifyCloudflareDeployment,
  isCertificationError: (error) =>
    error instanceof CloudflareDeploymentCertificationError,
});
