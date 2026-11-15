import {
  certifyFreshScaffold,
  certifyFreshScaffoldForTesting,
} from "./lib/certify-fresh-scaffold.mjs";
import { runCertificationCli } from "./lib/certification-cli.mjs";

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
  "visual-regression",
]);
const subject = Object.freeze({
  descriptorVersion: "0.5.1",
  behaviorContractDigest:
    "sha256:936eaba6040e0736ccf630b775ab91f92d67f4e5a65332b829378e2a491cc168",
});

export class GeneratedTestingCertificationError extends Error {
  constructor(code) {
    super(`Generated testing certification failed: ${code}`);
    this.name = "GeneratedTestingCertificationError";
    this.code = code;
  }
}

const configuration = Object.freeze({
  profile: "portfolio",
  projectName: "acme-portfolio",
  displayName: "Acme Portfolio",
  createArguments: Object.freeze([]),
  expectedCapabilities,
  capabilityIdentifier: "standards",
  capabilityVersion: "0.5.1",
  expectedRecipeVersion: "0.11.7",
  verifierIdentifier: "portfolio",
  verificationOptions: Object.freeze({ includeVisual: true }),
  expectedVerificationChecks,
  receipt: Object.freeze({
    subject,
    recipeVersion: "0.11.7",
  }),
  createError: (code) => new GeneratedTestingCertificationError(code),
  isCertificationError: (error) =>
    error instanceof GeneratedTestingCertificationError,
});

export function certifyGeneratedTesting() {
  return certifyFreshScaffold(configuration);
}

export function certifyGeneratedTestingForTesting(adapters) {
  return certifyFreshScaffoldForTesting(configuration, adapters);
}

function parseArguments(arguments_) {
  return arguments_.length === 0 ? {} : undefined;
}

await runCertificationCli({
  moduleUrl: import.meta.url,
  parseArguments,
  certify: certifyGeneratedTesting,
  isCertificationError: (error) =>
    error instanceof GeneratedTestingCertificationError,
});
