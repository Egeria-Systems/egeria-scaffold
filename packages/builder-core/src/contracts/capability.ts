import { z } from "zod";

import {
  jsonPointerSchema,
  safeRelativePathSchema,
  semanticVersionSchema,
  stableIdentifierSchema,
} from "./identifiers.js";

const nonEmptyTextSchema = z.string().min(1).max(512).regex(/\S/);
const metadataListSchema = z.array(nonEmptyTextSchema).readonly();
const identifierListSchema = z.array(stableIdentifierSchema).readonly();

export const capabilityDeliveryModeSchema = z.enum([
  "package-backed",
  "source-generated",
  "hybrid",
]);

export const capabilityStateClassificationSchema = z.enum([
  "stateless",
  "repository-stateful",
  "external-stateful",
  "persistent-data",
]);

export const capabilityRemovalPolicySchema = z.enum([
  "automatic",
  "reviewed",
  "export-and-remove",
  "eject-only",
  "unsupported",
]);

export const surfaceOwnershipModeSchema = z.enum([
  "managed",
  "merge-managed",
  "application-owned",
  "ejected",
]);

export const capabilityStateClassificationsSchema = z
  .array(capabilityStateClassificationSchema)
  .min(1)
  .superRefine((classifications, context) => {
    if (new Set(classifications).size !== classifications.length) {
      context.addIssue({
        code: "custom",
        message: "state classifications must be unique",
      });
    }

    if (classifications.includes("stateless") && classifications.length > 1) {
      context.addIssue({
        code: "custom",
        message: "stateless cannot be combined with another classification",
      });
    }
  })
  .readonly();

const fileProbeSchema = z.strictObject({
  kind: z.literal("file"),
  path: safeRelativePathSchema,
});

const jsonValueProbeSchema = z.strictObject({
  kind: z.literal("json-value"),
  path: safeRelativePathSchema,
  pointer: jsonPointerSchema,
  expected: z.union([z.string(), z.boolean(), z.number()]),
});

const packageProbeSchema = z.strictObject({
  kind: z.literal("package"),
  path: safeRelativePathSchema,
  section: z.enum(["dependencies", "devDependencies"]),
  packageName: nonEmptyTextSchema,
  version: nonEmptyTextSchema,
});

export const inferenceProbeSchema = z
  .discriminatedUnion("kind", [
    fileProbeSchema,
    jsonValueProbeSchema,
    packageProbeSchema,
  ])
  .readonly()
  .meta({ id: "urn:egeria-systems:schema:inference-probe:1.0.0" });

export const surfaceOwnerSchema = z
  .discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("builder-kernel") }),
    z.strictObject({
      kind: z.literal("capability"),
      identifier: stableIdentifierSchema,
    }),
  ])
  .readonly();

export const fingerprintTargetSchema = z
  .discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("file") }),
    z.strictObject({
      kind: z.literal("json-value"),
      pointer: jsonPointerSchema,
    }),
  ])
  .readonly();

function addMergeTargetIssue(
  descriptor: {
    fingerprintTarget: { kind: "file" } | { kind: "json-value"; pointer: string };
    mergeStrategy: "replace-file" | "json-property";
  },
  context: z.RefinementCtx,
): void {
  const validPair =
    (descriptor.fingerprintTarget.kind === "file" &&
      descriptor.mergeStrategy === "replace-file") ||
    (descriptor.fingerprintTarget.kind === "json-value" &&
      descriptor.mergeStrategy === "json-property");

  if (!validPair) {
    context.addIssue({
      code: "custom",
      message: "merge strategy must match its fingerprint target",
      path: ["mergeStrategy"],
    });
  }
}

export const managedSurfaceDescriptorSchema = z
  .strictObject({
    identifier: stableIdentifierSchema,
    owner: surfaceOwnerSchema,
    path: safeRelativePathSchema,
    ownership: z.enum(["managed", "merge-managed", "application-owned"]),
    fingerprintTarget: fingerprintTargetSchema,
    mergeStrategy: z.enum(["replace-file", "json-property"]),
  })
  .superRefine(addMergeTargetIssue)
  .readonly()
  .meta({
    id: "urn:egeria-systems:schema:managed-surface-descriptor:1.0.0",
  });

export const capabilityDescriptorSchema = z
  .strictObject({
    identifier: stableIdentifierSchema,
    version: semanticVersionSchema,
    deliveryMode: capabilityDeliveryModeSchema,
    stateClassifications: capabilityStateClassificationsSchema,
    removalPolicy: capabilityRemovalPolicySchema,
    dependencies: identifierListSchema,
    optionalIntegrations: identifierListSchema,
    conflicts: identifierListSchema,
    supportedProfiles: identifierListSchema,
    requiredPackages: metadataListSchema,
    environmentVariables: metadataListSchema,
    secrets: metadataListSchema,
    platformResources: metadataListSchema,
    externalDomains: metadataListSchema,
    contentSecurityPolicyContributions: metadataListSchema,
    browserStorage: metadataListSchema,
    dataClassifications: metadataListSchema,
    retentionAssumptions: metadataListSchema,
    privilegedOperations: metadataListSchema,
    threatReviewLevel: nonEmptyTextSchema,
    adapterSemanticRequirements: metadataListSchema,
    managedSurfaces: z.array(managedSurfaceDescriptorSchema).readonly(),
    inferenceProbes: z.array(inferenceProbeSchema).readonly(),
    migrationPlanners: metadataListSchema,
    verificationPlan: metadataListSchema,
    documentationEvidenceRequirements: metadataListSchema,
    removalAndRecoveryRequirements: metadataListSchema,
  })
  .readonly()
  .meta({
    id: "urn:egeria-systems:schema:capability:1.0.0",
    title: "Egeria capability descriptor",
  });

export type CapabilityDeliveryMode = z.infer<
  typeof capabilityDeliveryModeSchema
>;
export type CapabilityStateClassification = z.infer<
  typeof capabilityStateClassificationSchema
>;
export type CapabilityRemovalPolicy = z.infer<
  typeof capabilityRemovalPolicySchema
>;
export type SurfaceOwnershipMode = z.infer<typeof surfaceOwnershipModeSchema>;
export type InferenceProbe = z.infer<typeof inferenceProbeSchema>;
export type ManagedSurfaceDescriptor = z.infer<
  typeof managedSurfaceDescriptorSchema
>;
export type CapabilityDescriptor = z.infer<typeof capabilityDescriptorSchema>;
