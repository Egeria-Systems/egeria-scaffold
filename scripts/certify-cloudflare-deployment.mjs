import {
  certifyFreshScaffold,
  certifyFreshScaffoldForTesting,
} from "./lib/certify-fresh-scaffold.mjs";
import { runCertificationCli } from "./lib/certification-cli.mjs";

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
    projectName: "deployment-certification-portfolio",
    displayName: "Deployment Certification Portfolio",
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

export function certifyCloudflareDeployment(input = {}) {
  return certifyFreshScaffold(configurationFor(input?.revision));
}

export function certifyCloudflareDeploymentForTesting(input, adapters) {
  return certifyFreshScaffoldForTesting(
    configurationFor(input?.revision),
    adapters,
  );
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
