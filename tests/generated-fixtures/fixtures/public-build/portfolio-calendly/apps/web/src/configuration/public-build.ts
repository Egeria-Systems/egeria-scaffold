import { resolveApplicationBuild } from "./application-build.ts";
import { resolveBookingDestination } from "../integrations/booking-calendly/booking-settings.ts";

type BuildInput = Readonly<Parameters<typeof resolveApplicationBuild>[0] & {
  bookingUrl?: unknown;
}>;

export function readPublicBuildEnvironment(): BuildInput {
  return {
    applicationEnvironment: process.env.APPLICATION_ENVIRONMENT,
    publicApplicationEnvironment: process.env.NEXT_PUBLIC_APPLICATION_ENVIRONMENT,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    sourceRevision: process.env.BUILD_SOURCE_REVISION,
    deploymentId: process.env.NEXT_DEPLOYMENT_ID,
    bookingUrl: process.env.NEXT_PUBLIC_CALENDLY_URL,
  };
}

export function resolvePublicBuild(input: BuildInput, mode: "local" | "deployment") {
  const build = resolveApplicationBuild(input, mode);
  if (!build.ok) return { ok: false, source: "base", ...build.issue } as const;
  const target = build.value.target;
  const booking = resolveBookingDestination(input.bookingUrl, target);
  if (!booking.ok) return { ok: false, source: "booking", ...booking.issue } as const;

  const publicValues = {
    NEXT_PUBLIC_APPLICATION_ENVIRONMENT: target,
    NEXT_PUBLIC_CALENDLY_URL: booking.destination ?? "",
  };
  return { ok: true, value: { build: build.value, publicValues } } as const;
}
