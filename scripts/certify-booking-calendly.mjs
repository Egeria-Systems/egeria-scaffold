import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { certifyFreshScaffoldForTesting } from "./lib/certify-fresh-scaffold.mjs";

const defaultCalendlyUrl = "https://calendly.com/example/intro";
const expectedCapabilities = Object.freeze([
  "standards",
  "content-files",
  "section-composition",
  "deployment-cloudflare",
  "observability",
  "booking-calendly",
]);

export class BookingCalendlyCertificationError extends Error {
  constructor(code) {
    super(`Booking Calendly certification failed: ${code}`);
    this.name = "BookingCalendlyCertificationError";
    this.code = code;
  }
}

function configurationFor(calendlyUrl) {
  return {
    profile: "portfolio",
    projectName: "acme-portfolio-calendly",
    displayName: "Acme Portfolio Booking",
    createArguments: [
      "--calendly-url",
      calendlyUrl,
      "--calendly-mode",
      "popup",
    ],
    expectedCapabilities,
    capabilityIdentifier: "booking-calendly",
    capabilityVersion: "0.1.0",
    verifierIdentifier: "portfolio-calendly",
    receipt: { mode: "popup" },
    createError: (code) => new BookingCalendlyCertificationError(code),
    isCertificationError: (error) =>
      error instanceof BookingCalendlyCertificationError,
  };
}

export function certifyBookingCalendly(input = {}) {
  return certifyBookingCalendlyForTesting(input);
}

export function certifyBookingCalendlyForTesting(input, adapters) {
  const calendlyUrl = input?.calendlyUrl ?? defaultCalendlyUrl;
  return certifyFreshScaffoldForTesting(configurationFor(calendlyUrl), adapters);
}

function parseArguments(arguments_) {
  if (arguments_.length === 0) {
    return {};
  }
  if (arguments_.length === 2 && arguments_[0] === "--calendly-url") {
    return { calendlyUrl: arguments_[1] };
  }
  return undefined;
}

async function runMain() {
  const input = parseArguments(process.argv.slice(2));
  if (input === undefined) {
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
    const result = await certifyBookingCalendly(input);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({
        ok: false,
        code:
          error instanceof BookingCalendlyCertificationError
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
