import {
  certifyFreshScaffold,
  certifyFreshScaffoldForTesting,
} from "./lib/certify-fresh-scaffold.mjs";
import { runCertificationCli } from "./lib/certification-cli.mjs";

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
  const calendlyUrl = input?.calendlyUrl ?? defaultCalendlyUrl;
  return certifyFreshScaffold(configurationFor(calendlyUrl));
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

await runCertificationCli({
  moduleUrl: import.meta.url,
  parseArguments,
  certify: certifyBookingCalendly,
  isCertificationError: (error) =>
    error instanceof BookingCalendlyCertificationError,
});
