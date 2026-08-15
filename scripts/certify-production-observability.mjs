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

export class ProductionObservabilityCertificationError extends Error {
  constructor(code) {
    super(`Production observability certification failed: ${code}`);
    this.name = "ProductionObservabilityCertificationError";
    this.code = code;
  }
}

const configuration = Object.freeze({
  profile: "portfolio",
  projectName: "acme-portfolio",
  displayName: "Acme Portfolio",
  createArguments: Object.freeze([]),
  expectedCapabilities,
  capabilityIdentifier: "observability",
  capabilityVersion: "0.2.0",
  verifierIdentifier: "portfolio",
  receipt: Object.freeze({}),
  createError: (code) => new ProductionObservabilityCertificationError(code),
  isCertificationError: (error) =>
    error instanceof ProductionObservabilityCertificationError,
});

export function certifyProductionObservability() {
  return certifyFreshScaffold(configuration);
}

export function certifyProductionObservabilityForTesting(adapters) {
  return certifyFreshScaffoldForTesting(configuration, adapters);
}

function parseArguments(arguments_) {
  return arguments_.length === 0 ? {} : undefined;
}

await runCertificationCli({
  moduleUrl: import.meta.url,
  parseArguments,
  certify: certifyProductionObservability,
  isCertificationError: (error) =>
    error instanceof ProductionObservabilityCertificationError,
});
