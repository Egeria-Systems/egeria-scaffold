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
]);

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
  capabilityVersion: "0.3.0",
  verifierIdentifier: "portfolio",
  expectedVerificationChecks,
  receipt: Object.freeze({}),
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
