import { resolveApplicationBuild } from "./application-build.ts";
import { resolveContactSettings } from "../integrations/contact-form-web3forms/contact-settings.ts";
import { resolveBookingDestination } from "../integrations/booking-calendly/booking-settings.ts";
import { resolveAnalyticsConfiguration, type AnalyticsConfigurationInput } from "../integrations/analytics/analytics-configuration.ts";
import { analyticsSettings } from "../integrations/analytics/analytics-settings.ts";

type BuildInput = Readonly<Parameters<typeof resolveApplicationBuild>[0] & {
  contactAccessKey?: unknown;
  bookingUrl?: unknown;
  analytics: Omit<AnalyticsConfigurationInput, "siteUrl" | "enabled"> & { enabled: string | undefined };
}>;

export function readPublicBuildEnvironment(): BuildInput {
  return {
    applicationEnvironment: process.env.APPLICATION_ENVIRONMENT,
    publicApplicationEnvironment: process.env.NEXT_PUBLIC_APPLICATION_ENVIRONMENT,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    sourceRevision: process.env.BUILD_SOURCE_REVISION,
    deploymentId: process.env.NEXT_DEPLOYMENT_ID,
    contactAccessKey: process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY,
    bookingUrl: process.env.NEXT_PUBLIC_CALENDLY_URL,
    analytics: {
      enabled: process.env.NEXT_PUBLIC_ANALYTICS_ENABLED,
      cloudflareToken: process.env.NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN,
      googleMeasurementId: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID,
      clarityProjectId: process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID,
      googleSiteVerification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    },
  };
}

export function resolvePublicBuild(input: BuildInput, mode: "local" | "deployment") {
  const build = resolveApplicationBuild(input, mode);
  if (!build.ok) return { ok: false, source: "base", ...build.issue } as const;
  const target = build.value.target;
  const contact = resolveContactSettings(input.contactAccessKey, target);
  if (!contact.ok) return { ok: false, source: "contact", ...contact.issue } as const;
  const booking = resolveBookingDestination(input.bookingUrl, target);
  if (!booking.ok) return { ok: false, source: "booking", ...booking.issue } as const;
  const analytics = resolveAnalyticsConfiguration(analyticsSettings, { ...input.analytics, siteUrl: input.siteUrl }, target);
  if (!analytics.ok) return { ok: false, source: "analytics", ...analytics.issue } as const;

  const publicValues = {
    NEXT_PUBLIC_APPLICATION_ENVIRONMENT: target,
    NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: contact.settings?.accessKey ?? "",
    NEXT_PUBLIC_CALENDLY_URL: booking.destination ?? "",
    NEXT_PUBLIC_ANALYTICS_ENABLED: input.analytics.enabled ?? "",
    NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN: analytics.configuration.cloudflareToken ?? "",
    NEXT_PUBLIC_GA4_MEASUREMENT_ID: analytics.configuration.googleMeasurementId ?? "",
    NEXT_PUBLIC_CLARITY_PROJECT_ID: analytics.configuration.clarityProjectId ?? "",
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: analytics.configuration.googleSiteVerification ?? "",
  };
  return { ok: true, value: { build: build.value, publicValues } } as const;
}
