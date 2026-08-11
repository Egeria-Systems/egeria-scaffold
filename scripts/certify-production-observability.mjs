import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  certifyFreshScaffold,
  certifyFreshScaffoldForTesting,
} from "./lib/certify-fresh-scaffold.mjs";

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

function argumentsAreValid(arguments_) {
  return arguments_.length === 0;
}

async function runMain() {
  if (!argumentsAreValid(process.argv.slice(2))) {
    process.stderr.write(
      `${JSON.stringify({
        ok: false,
        code: "CERTIFICATION_ARGUMENT_INVALID",
      })}\n`,
    );
    process.exitCode = 2;
    return;
  }

  try {
    const result = await certifyProductionObservability();
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({
        ok: false,
        code:
          error instanceof ProductionObservabilityCertificationError
            ? error.code
            : "CERTIFICATION_FAILED",
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
