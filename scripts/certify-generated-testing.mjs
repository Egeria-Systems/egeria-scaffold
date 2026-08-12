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

async function runMain() {
  if (process.argv.length !== 2) {
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
    const result = await certifyGeneratedTesting();
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({
        ok: false,
        code:
          error instanceof GeneratedTestingCertificationError
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
