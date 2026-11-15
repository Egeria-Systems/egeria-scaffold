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
export const calendlyBookingSettingsSchema = z.strictObject({
  mode: z.enum(["link", "inline", "popup"]),
}).readonly();

export type CalendlyBookingSettings = z.infer<typeof calendlyBookingSettingsSchema>;

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

export const analyticsSettingsSchema = z.strictObject({
  consent: z.strictObject({ policy: z.literal("explicit-opt-in") }).readonly(),
  providers: z.strictObject({
    cloudflareWebAnalytics: z.literal(true).optional(),
    googleAnalytics4: z.literal(true).optional(),
    microsoftClarity: z.strictObject({ audience: z.literal("not-directed-to-minors") }).readonly().optional(),
  }).readonly(),
  operationalIntegrations: z.strictObject({
    googleSearchConsole: z.literal(true).optional(),
    lookerStudio: z.strictObject({ connector: z.literal("google-analytics-4") }).readonly().optional(),
  }).readonly(),
}).superRefine(validateAnalyticsSelection).readonly();

export type AnalyticsSettings = z.infer<typeof analyticsSettingsSchema>;
export const web3FormsContactSettingsSchema = z.literal(true);
export type Web3FormsContactSettings = z.infer<typeof web3FormsContactSettingsSchema>;

const capabilitySettingsSchema = z.strictObject({
  analytics: analyticsSettingsSchema.optional(),
  "booking-calendly": calendlyBookingSettingsSchema.optional(),
}).readonly();

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
    schemaVersion: z.literal("2.0.0"),
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
  .superRefine(validateProjectSelections)
  .superRefine((project, context) => {
    if (project.recipeVersion !== applicationEnvironmentRecipeVersions[project.originProfile]) {
      context.addIssue({ code: "custom", message: "application environment recipe must match profile", path: ["recipeVersion"] });
    }
  })
  .readonly()
  .meta({
    id: "urn:egeria-systems:schema:project:2.0.0",
    title: "Egeria project configuration",
  });

export type ProjectConfiguration = z.infer<
  typeof projectConfigurationSchema
>;

export const applicationEnvironmentBookingSettingsSchema = calendlyBookingSettingsSchema;
export const applicationEnvironmentAnalyticsSettingsSchema = analyticsSettingsSchema;
export const applicationEnvironmentProjectConfigurationSchema = projectConfigurationSchema;
export type ApplicationEnvironmentAnalyticsSettings = AnalyticsSettings;
export type ApplicationEnvironmentBookingSettings = CalendlyBookingSettings;
export type ApplicationEnvironmentProjectConfiguration = ProjectConfiguration;
