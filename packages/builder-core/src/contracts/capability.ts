import { z } from "zod";

import {
  jsonPointerSchema,
  safeRelativePathSchema,
  semanticVersionSchema,
  stableIdentifierSchema,
} from "./identifiers.js";
import { addMergeTargetIssue } from "./surface-target.js";

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

export const multilingualCapabilityVersion = "0.1.1";

export const publicBuildManagedFiles = [
  ["deployment-public-build-configuration", "apps/web/src/configuration/public-build.ts"],
  ["deployment-document-metadata", "apps/web/src/configuration/document-metadata.ts"],
] as const;

const deploymentVersionPairs = {
  ordinary: { retained: "0.9.0", current: "0.13.0" },
  persistence: { retained: "0.10.0", current: "0.14.0" },
  jobs: { retained: "0.11.0", publicBuild: "0.15.0", current: "0.17.0" },
  persistenceAndJobs: { retained: "0.12.0", publicBuild: "0.16.0", current: "0.18.0" },
} as const;

type DeploymentVersionPair = typeof deploymentVersionPairs[keyof typeof deploymentVersionPairs];
type PublicBuildJobsDeploymentVersion = typeof deploymentVersionPairs["jobs" | "persistenceAndJobs"]["publicBuild"];
export type DeploymentCapabilityVersion = DeploymentVersionPair[keyof DeploymentVersionPair] | PublicBuildJobsDeploymentVersion;
export type RetainedDeploymentView = boolean | "public-build";
export const backgroundJobDeliveryVersions = { retained: "0.3.0", current: "0.4.0" } as const;
export type BackgroundJobDeliveryVersion = typeof backgroundJobDeliveryVersions[keyof typeof backgroundJobDeliveryVersions];

export function deploymentVersionsFor(persistence: boolean, jobs: boolean): Readonly<{
  retained: DeploymentCapabilityVersion;
  current: DeploymentCapabilityVersion;
  publicBuild?: PublicBuildJobsDeploymentVersion;
}> {
  if (jobs) return persistence ? deploymentVersionPairs.persistenceAndJobs : deploymentVersionPairs.jobs;
  return persistence ? deploymentVersionPairs.persistence : deploymentVersionPairs.ordinary;
}

export function deploymentViewForVersion(persistence: boolean, jobs: boolean, version: unknown): RetainedDeploymentView | undefined {
  const versions = deploymentVersionsFor(persistence, jobs);
  if (version === versions.current) return false;
  if (version === versions.retained) return true;
  if (versions.publicBuild !== undefined && version === versions.publicBuild) return "public-build";
  return undefined;
}

export function supportedDeploymentViews(jobs: boolean): readonly RetainedDeploymentView[] {
  return jobs ? [false, true, "public-build"] : [false, true];
}
