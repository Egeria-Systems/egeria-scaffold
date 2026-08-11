import { z } from "zod";

import {
  capabilityDeliveryModeSchema,
  capabilityRemovalPolicySchema,
  capabilityStateClassificationsSchema,
  fingerprintTargetSchema,
  surfaceOwnerSchema,
  surfaceOwnershipModeSchema,
} from "./capability.js";
import {
  fingerprintSchema,
  safeRelativePathSchema,
  semanticVersionSchema,
  stableIdentifierSchema,
} from "./identifiers.js";
import {
  profileIdentifierSchema,
  profileRecipeVersionSchema,
} from "./profile.js";
import { addMergeTargetIssue } from "./surface-target.js";

function requireUniqueIdentifiers(
  values: readonly { identifier: string }[],
  context: z.RefinementCtx,
): void {
  const identifiers = values.map(({ identifier }) => identifier);

  if (new Set(identifiers).size !== identifiers.length) {
    context.addIssue({ code: "custom", message: "identifiers must be unique" });
  }
}

export const installedCapabilitySchema = z
  .strictObject({
    identifier: stableIdentifierSchema,
    version: semanticVersionSchema,
    deliveryMode: capabilityDeliveryModeSchema,
    stateClassifications: capabilityStateClassificationsSchema,
    removalPolicy: capabilityRemovalPolicySchema,
  })
  .readonly();

export const installedSurfaceSchema = z
  .strictObject({
    identifier: stableIdentifierSchema,
    owner: surfaceOwnerSchema,
    path: safeRelativePathSchema,
    ownership: surfaceOwnershipModeSchema,
    fingerprintTarget: fingerprintTargetSchema,
    mergeStrategy: z.enum(["replace-file", "json-property"]),
    fingerprint: fingerprintSchema,
  })
  .superRefine(addMergeTargetIssue)
  .readonly();

const legacyVerificationChecks = [
  "contracts",
  "pre-state-inference",
  "lockfile",
  "frozen-install",
  "lint",
  "typecheck",
  "next-build",
  "opennext-build",
  "post-state-inference",
] as const;

const currentVerificationChecks = [
  "contracts",
  "pre-state-inference",
  "lockfile",
  "frozen-install",
  "lint",
  "typecheck",
  "unit-tests",
  "component-tests",
  "next-build",
  "opennext-build",
  "post-state-inference",
] as const;

const legacyVerificationChecksSchema = z
  .tuple([
    z.literal("contracts"),
    z.literal("pre-state-inference"),
    z.literal("lockfile"),
    z.literal("frozen-install"),
    z.literal("lint"),
    z.literal("typecheck"),
    z.literal("next-build"),
    z.literal("opennext-build"),
    z.literal("post-state-inference"),
  ])
  .readonly();

const currentVerificationChecksSchema = z
  .tuple([
    z.literal("contracts"),
    z.literal("pre-state-inference"),
    z.literal("lockfile"),
    z.literal("frozen-install"),
    z.literal("lint"),
    z.literal("typecheck"),
    z.literal("unit-tests"),
    z.literal("component-tests"),
    z.literal("next-build"),
    z.literal("opennext-build"),
    z.literal("post-state-inference"),
  ])
  .readonly();

const verificationChecksSchema = z
  .union([legacyVerificationChecksSchema, currentVerificationChecksSchema])
  .readonly();

function hasExactChecks(
  actualChecks: readonly string[],
  expectedChecks: readonly string[],
): boolean {
  return (
    actualChecks.length === expectedChecks.length &&
    actualChecks.every((check, index) => check === expectedChecks[index])
  );
}

export const installedStateSchema = z
  .strictObject({
    schemaVersion: z.literal("1.0.0"),
    builderVersion: z.literal("0.0.0"),
    projectSchemaVersion: z.literal("1.0.0"),
    origin: z
      .strictObject({
        profile: profileIdentifierSchema,
        recipeVersion: profileRecipeVersionSchema,
      })
      .readonly(),
    installedCapabilities: z
      .array(installedCapabilitySchema)
      .superRefine(requireUniqueIdentifiers)
      .readonly(),
    appliedMigrations: z.array(stableIdentifierSchema).readonly(),
    managedSurfaces: z
      .array(installedSurfaceSchema)
      .superRefine(requireUniqueIdentifiers)
      .readonly(),
    ejections: z.array(safeRelativePathSchema).readonly(),
    compatibility: z
      .strictObject({
        node: z.literal("22.23.2"),
        pnpm: z.literal("11.20.0"),
        platformAdapter: z.literal("cloudflare-workers"),
      })
      .readonly(),
    lastSuccessfulVerification: z
      .strictObject({
        kind: z.literal("generation"),
        checks: verificationChecksSchema,
      })
      .readonly(),
  })
  .superRefine((state, context) => {
    const expectedChecks =
      state.origin.recipeVersion === "0.7.0"
        ? currentVerificationChecks
        : legacyVerificationChecks;

    if (!hasExactChecks(state.lastSuccessfulVerification.checks, expectedChecks)) {
      context.addIssue({
        code: "custom",
        message: "verification checks must match the originating recipe version",
        path: ["lastSuccessfulVerification", "checks"],
      });
    }
  })
  .readonly()
  .meta({
    id: "urn:egeria-systems:schema:state:1.0.0",
    title: "Egeria installed state",
  });

export type InstalledCapability = z.infer<typeof installedCapabilitySchema>;
export type InstalledSurface = z.infer<typeof installedSurfaceSchema>;
export type InstalledState = z.infer<typeof installedStateSchema>;
