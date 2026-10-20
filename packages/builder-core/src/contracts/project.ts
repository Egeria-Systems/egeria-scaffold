import { z } from "zod";

import {
  safeRelativePathSchema,
  stableIdentifierSchema,
} from "./identifiers.js";
import {
  applicationEnvironmentRecipeVersions,
  profileIdentifierSchema,
  profileRecipeVersionSchema,
} from "./profile.js";

const capabilityIdentifierListSchema = z
  .array(stableIdentifierSchema)
  .min(1)
  .superRefine((identifiers, context) => {
    if (new Set(identifiers).size !== identifiers.length) {
      context.addIssue({
        code: "custom",
        message: "selected capabilities must be unique",
      });
    }
  })
  .readonly();

const ejectedAreaListSchema = z
  .array(safeRelativePathSchema)
  .superRefine((areas, context) => {
    if (new Set(areas).size !== areas.length) {
      context.addIssue({ code: "custom", message: "ejected areas must be unique" });
    }
  })
  .readonly();

const displayNameSchema = z
  .string()
  .regex(/^(?=.{1,120}$)(?=.*\S)[^\p{Cc}]+$/u);
const calendlyDestinationPattern =
  /^https:\/\/(?:www\.)?calendly\.com(?::443)?\/[^\s/?#][^\s?#]*$/u;

function isCalendlyDestination(value: string): boolean {
  if (value.length > 2_048 || /\s/u.test(value) || value.includes("#")) {
    return false;
  }

  try {
    const destination = new URL(value);

    return (
      destination.protocol === "https:" &&
      (destination.hostname === "calendly.com" ||
        destination.hostname === "www.calendly.com") &&
      destination.port === "" &&
      destination.pathname !== "/" &&
      destination.username === "" &&
      destination.password === "" &&
      destination.search === "" &&
      destination.hash === ""
    );
  } catch {
    return false;
  }
}

export const calendlyBookingSettingsSchema = z
  .strictObject({
    destination: z
      .string()
      .min(1)
      .max(2_048)
      .regex(calendlyDestinationPattern)
      .refine(isCalendlyDestination),
    mode: z.enum(["link", "inline", "popup"]),
  })
  .readonly();

export type CalendlyBookingSettings = z.infer<
  typeof calendlyBookingSettingsSchema
>;

const cloudflareWebAnalyticsTokenSchema = z
  .string()
  .regex(/^[A-Fa-f0-9]{32}$/u);
const googleAnalyticsMeasurementIdSchema = z
  .string()
  .regex(/^G-[A-Z0-9]{6,20}$/u);
const microsoftClarityProjectIdSchema = z
  .string()
  .regex(/^[a-z0-9]{8,32}$/u);
const googleSearchConsoleVerificationTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{16,128}$/u);

function validateAnalyticsSelection(
  settings: Readonly<{
    providers: Readonly<Record<string, unknown>>;
    operationalIntegrations: Readonly<{ googleSearchConsole?: unknown; lookerStudio?: unknown }>;
  }>,
  context: z.RefinementCtx,
): void {
    const hasRuntimeProvider = Object.values(settings.providers).some(
      (provider) => provider !== undefined,
    );
    const hasSearchConsole =
      settings.operationalIntegrations.googleSearchConsole !== undefined;

    if (!hasRuntimeProvider && !hasSearchConsole) {
      context.addIssue({
        code: "custom",
        message: "analytics requires a runtime provider or Search Console",
        path: ["providers"],
      });
    }

    if (
      settings.operationalIntegrations.lookerStudio !== undefined &&
      settings.providers.googleAnalytics4 === undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "Looker Studio requires Google Analytics 4",
        path: ["operationalIntegrations", "lookerStudio"],
      });
    }
}

export const analyticsSettingsSchema = z
  .strictObject({
    consent: z
      .strictObject({ policy: z.literal("explicit-opt-in") })
      .readonly(),
    providers: z
      .strictObject({
        cloudflareWebAnalytics: z
          .strictObject({ siteToken: cloudflareWebAnalyticsTokenSchema })
          .readonly()
          .optional(),
        googleAnalytics4: z
          .strictObject({ measurementId: googleAnalyticsMeasurementIdSchema })
          .readonly()
          .optional(),
        microsoftClarity: z
          .strictObject({
            projectId: microsoftClarityProjectIdSchema,
            audience: z.literal("not-directed-to-minors"),
          })
          .readonly()
          .optional(),
      })
      .readonly(),
    operationalIntegrations: z
      .strictObject({
        googleSearchConsole: z
          .strictObject({
            verificationToken: googleSearchConsoleVerificationTokenSchema,
          })
          .readonly()
          .optional(),
        lookerStudio: z
          .strictObject({ connector: z.literal("google-analytics-4") })
          .readonly()
          .optional(),
      })
      .readonly(),
  })
  .superRefine(validateAnalyticsSelection)
  .readonly();

export type AnalyticsSettings = z.infer<typeof analyticsSettingsSchema>;

export const web3FormsContactSettingsSchema = z.strictObject({
  accessKey: z.string().regex(/^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/u),
}).readonly();

export type Web3FormsContactSettings = z.infer<typeof web3FormsContactSettingsSchema>;

const capabilitySettingsSchema = z
  .strictObject({
    analytics: analyticsSettingsSchema.optional(),
    "contact-form-web3forms": web3FormsContactSettingsSchema.optional(),
    "booking-calendly": calendlyBookingSettingsSchema.optional(),
  })
  .readonly();

function validateProjectSelections(
  project: Readonly<{
    selectedCapabilities: readonly string[];
    capabilitySettings: Readonly<{ analytics?: unknown; "booking-calendly"?: unknown }>;
  }>,
  context: z.RefinementCtx,
): void {
    const bookingSelected =
      project.selectedCapabilities.includes("booking-calendly");
    const bookingConfigured =
      project.capabilitySettings["booking-calendly"] !== undefined;

    if (bookingSelected !== bookingConfigured) {
      context.addIssue({
        code: "custom",
        message: "booking-calendly selection and settings must agree",
        path: bookingConfigured
          ? ["selectedCapabilities"]
          : ["capabilitySettings", "booking-calendly"],
      });
    }

    const analyticsSelected =
      project.selectedCapabilities.includes("analytics");
    const analyticsConfigured =
      project.capabilitySettings.analytics !== undefined;

    if (analyticsSelected !== analyticsConfigured) {
      context.addIssue({
        code: "custom",
        message: "analytics selection and settings must agree",
        path: analyticsConfigured
          ? ["selectedCapabilities"]
          : ["capabilitySettings", "analytics"],
      });
    }
}

export const projectConfigurationSchema = z
  .strictObject({
    schemaVersion: z.literal("1.0.0"),
    builderCompatibility: z.literal("0.0.0"),
    project: z
      .strictObject({
        name: stableIdentifierSchema,
        displayName: displayNameSchema,
        defaultLocale: z.literal("en-CA"),
      })
      .readonly(),
    originProfile: profileIdentifierSchema,
    recipeVersion: profileRecipeVersionSchema,
    platformAdapter: z.literal("cloudflare-workers"),
    selectedCapabilities: capabilityIdentifierListSchema,
    capabilitySettings: capabilitySettingsSchema,
    ejectedAreas: ejectedAreaListSchema,
  })
  .superRefine((project, context) => {
    const contactSelected = project.selectedCapabilities.includes("contact-form-web3forms");
    const contactConfigured = project.capabilitySettings["contact-form-web3forms"] !== undefined;
    if (contactSelected !== contactConfigured) {
      context.addIssue({ code: "custom", message: "contact selection and settings must agree", path: ["capabilitySettings", "contact-form-web3forms"] });
    }
    validateProjectSelections(project, context);
  })
  .readonly()
  .meta({
    id: "urn:egeria-systems:schema:project:1.0.0",
    title: "Egeria project configuration",
  });

export type ProjectConfiguration = z.infer<
  typeof projectConfigurationSchema
>;

export const applicationEnvironmentBookingSettingsSchema = calendlyBookingSettingsSchema
  .unwrap()
  .pick({ mode: true })
  .readonly();

export const applicationEnvironmentAnalyticsSettingsSchema = z.strictObject({
  consent: analyticsSettingsSchema.unwrap().shape.consent,
  providers: z.strictObject({
    cloudflareWebAnalytics: z.literal(true).optional(),
    googleAnalytics4: z.literal(true).optional(),
    microsoftClarity: z.strictObject({ audience: z.literal("not-directed-to-minors") }).readonly().optional(),
  }).readonly(),
  operationalIntegrations: z.strictObject({
    googleSearchConsole: z.literal(true).optional(),
    lookerStudio: analyticsSettingsSchema.unwrap().shape.operationalIntegrations.unwrap().shape.lookerStudio,
  }).readonly(),
}).superRefine(validateAnalyticsSelection).readonly();

export const applicationEnvironmentProjectConfigurationSchema = z.strictObject({
  ...projectConfigurationSchema.unwrap().shape,
  schemaVersion: z.literal("2.0.0"),
  capabilitySettings: z.strictObject({
    analytics: applicationEnvironmentAnalyticsSettingsSchema.optional(),
    "booking-calendly": applicationEnvironmentBookingSettingsSchema.optional(),
  }).readonly(),
}).superRefine(validateProjectSelections).superRefine((project, context) => {
  if (project.recipeVersion !== applicationEnvironmentRecipeVersions[project.originProfile]) {
    context.addIssue({ code: "custom", message: "application environment recipe must match profile", path: ["recipeVersion"] });
  }
}).readonly().meta({
  id: "urn:egeria-systems:schema:project:2.0.0",
  title: "Egeria application environment project configuration",
});

export type ApplicationEnvironmentAnalyticsSettings = z.infer<typeof applicationEnvironmentAnalyticsSettingsSchema>;
export type ApplicationEnvironmentBookingSettings = z.infer<typeof applicationEnvironmentBookingSettingsSchema>;
export type ApplicationEnvironmentProjectConfiguration = z.infer<typeof applicationEnvironmentProjectConfigurationSchema>;
