import { z } from "zod";

import {
  safeRelativePathSchema,
  stableIdentifierSchema,
} from "./identifiers.js";
import {
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
  /^https:\/\/(?:www\.)?calendly\.com(?::443)?\/[^\s/?#][^\s?#]*(?:\?[^\s#]*)?$/u;

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

const capabilitySettingsSchema = z
  .strictObject({
    "booking-calendly": calendlyBookingSettingsSchema.optional(),
  })
  .readonly();

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
    const selected = project.selectedCapabilities.includes("booking-calendly");
    const configured =
      project.capabilitySettings["booking-calendly"] !== undefined;

    if (selected !== configured) {
      context.addIssue({
        code: "custom",
        message: "booking-calendly selection and settings must agree",
        path: configured
          ? ["selectedCapabilities"]
          : ["capabilitySettings", "booking-calendly"],
      });
    }
  })
  .readonly()
  .meta({
    id: "urn:egeria-systems:schema:project:1.0.0",
    title: "Egeria project configuration",
  });

export type ProjectConfiguration = z.infer<
  typeof projectConfigurationSchema
>;
