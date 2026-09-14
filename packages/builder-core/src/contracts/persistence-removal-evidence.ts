import { z } from "zod";

import {
  fingerprintSchema,
  semanticVersionSchema,
  safeRelativePathSchema,
  stableIdentifierSchema,
} from "./identifiers.js";

const environmentSchema = z.enum(["local", "staging", "production"]);

const databaseIdentitySchema = z.strictObject({
  environment: environmentSchema,
  databaseId: stableIdentifierSchema,
});

function requireDistinctDatabases(
  databases: readonly z.infer<typeof databaseIdentitySchema>[],
  context: z.RefinementCtx,
): void {
  if (
    new Set(databases.map(({ environment }) => environment)).size !== databases.length ||
    new Set(databases.map(({ databaseId }) => databaseId)).size !== databases.length
  ) {
    context.addIssue({ code: "custom", message: "database identities must be distinct" });
  }
}

export const persistenceRemovalSubjectSchema = z.strictObject({
  descriptorVersion: semanticVersionSchema,
  descriptorFingerprint: fingerprintSchema,
  schemaFingerprint: fingerprintSchema,
  migrationsFingerprint: fingerprintSchema,
  databases: z.array(databaseIdentitySchema.readonly()).min(1).max(3)
    .superRefine(requireDistinctDatabases).readonly(),
}).readonly();

const recoveryScopeSchema = z.enum(["local", "deployed"]);
const writeConsistencyModeSchema = z.enum(["writes-paused", "post-export-writes-captured"]);
const reportedOutcomeSchema = z.enum(["passed", "failed", "unavailable"]);

export const persistenceRemovalPolicySchema = z.strictObject({
  exportNotBefore: z.iso.datetime({ offset: true }),
  retainUntil: z.iso.datetime({ offset: true }),
  recoveryRequirements: z.array(z.strictObject({
    environment: environmentSchema,
    scope: recoveryScopeSchema,
  }).readonly()).min(1).max(3).refine(
    (requirements) => new Set(requirements.map(({ environment }) => environment)).size === requirements.length,
    { message: "recovery environments must be unique" },
  ).readonly(),
  writeConsistency: writeConsistencyModeSchema,
}).refine(
  ({ exportNotBefore, retainUntil }) => Date.parse(exportNotBefore) <= Date.parse(retainUntil),
  { message: "retention must cover the export policy window" },
).readonly();

const exportEvidenceSchema = z.strictObject({
  artifactReference: stableIdentifierSchema,
  digest: fingerprintSchema,
  completedAt: z.iso.datetime({ offset: true }),
  outcome: reportedOutcomeSchema,
}).readonly();

const recoveryEvidenceSchema = z.strictObject({
  artifactReference: stableIdentifierSchema,
  digest: fingerprintSchema,
  exportDigest: fingerprintSchema,
  scope: recoveryScopeSchema,
  restoration: reportedOutcomeSchema,
  readback: reportedOutcomeSchema,
}).readonly();

const databaseEvidenceSchema = databaseIdentitySchema.extend({
  export: exportEvidenceSchema.optional(),
  recovery: recoveryEvidenceSchema.optional(),
  writeConsistency: z.strictObject({
    mode: writeConsistencyModeSchema,
    outcome: reportedOutcomeSchema,
  }).readonly().optional(),
  retention: z.strictObject({
    retainedUntil: z.iso.datetime({ offset: true }),
    outcome: reportedOutcomeSchema,
  }).readonly().optional(),
}).readonly();

export const persistenceRemovalEvidenceSchema = z.strictObject({
  schemaVersion: z.literal("1.0.0"),
  subject: persistenceRemovalSubjectSchema,
  databases: z.array(databaseEvidenceSchema).max(3)
    .superRefine(requireDistinctDatabases).readonly(),
}).readonly().meta({
  id: "urn:egeria-systems:schema:persistence-removal-evidence:1.0.0",
  title: "Egeria persistence removal evidence",
});

export const persistenceRemovalInputSchema = z.strictObject({
  databases: persistenceRemovalSubjectSchema.unwrap().shape.databases,
  policy: persistenceRemovalPolicySchema,
  evidence: persistenceRemovalEvidenceSchema.optional(),
  localArtifacts: z.array(z.strictObject({
    reference: stableIdentifierSchema,
    path: safeRelativePathSchema,
  }).readonly()).max(6).refine(
    (artifacts) => new Set(artifacts.map(({ reference }) => reference)).size === artifacts.length &&
      new Set(artifacts.map(({ path }) => path)).size === artifacts.length,
    { message: "artifact references and paths must be unique" },
  ).readonly().optional(),
}).readonly();

export const persistenceRemovalReviewInputSchema = z.strictObject({
  expectedSubject: persistenceRemovalSubjectSchema,
  policy: persistenceRemovalPolicySchema,
  evidence: persistenceRemovalEvidenceSchema.optional(),
  localArtifactDigests: z.array(z.strictObject({
    reference: stableIdentifierSchema,
    digest: fingerprintSchema,
  }).readonly()).max(6).refine(
    (artifacts) => new Set(artifacts.map(({ reference }) => reference)).size === artifacts.length,
    { message: "artifact references must be unique" },
  ).readonly().optional(),
}).refine(
  ({ expectedSubject, policy }) =>
    expectedSubject.databases.length === policy.recoveryRequirements.length &&
    expectedSubject.databases.every(({ environment }) =>
      policy.recoveryRequirements.some((requirement) => requirement.environment === environment)),
  { message: "recovery requirements must cover the exact expected environments" },
).readonly();

const reviewReasonSchema = z.enum([
  "INPUT_INVALID",
  "SUBJECT_MATCHED",
  "SUBJECT_MISMATCH",
  "EVIDENCE_MISSING",
  "LOCAL_DIGEST_MATCHED",
  "LOCAL_DIGEST_MISMATCH",
  "LOCAL_ARTIFACT_UNAVAILABLE",
  "OUTCOME_OPERATOR_REPORTED",
  "REQUIRED_OUTCOME_FAILED",
  "REQUIRED_OUTCOME_UNAVAILABLE",
  "EXPORT_OUTSIDE_POLICY_WINDOW",
  "EXPORT_WITHIN_POLICY_WINDOW",
  "RECOVERY_EXPORT_MISMATCH",
  "RECOVERY_EXPORT_MATCHED",
  "REQUIRED_RECOVERY_SCOPE_MISSING",
  "LOCAL_RECOVERY_DOES_NOT_PROVE_DEPLOYED_RECOVERY",
  "DEPLOYED_RECOVERY_IS_OPERATOR_REPORTED",
  "WRITE_CONSISTENCY_POLICY_MISMATCH",
  "WRITE_CONSISTENCY_REQUIRES_HUMAN_REVIEW",
  "RETENTION_POLICY_NOT_MET",
  "RETENTION_REQUIRES_HUMAN_REVIEW",
  "EXPORT_COMPLETENESS_REQUIRES_HUMAN_REVIEW",
  "SOURCE_REMOVAL_DIFF_REQUIRES_HUMAN_REVIEW",
  "PROVIDER_DATA_DISPOSITION_REQUIRES_HUMAN_REVIEW",
  "SUBJECT_REQUIRES_HUMAN_REVIEW",
  "HUMAN_REVIEW_REQUIRED",
]);

const reviewCheckSchema = z.strictObject({
  identifier: z.enum([
    "input-structure", "removal-subject", "database-evidence",
    "export-artifact-digest", "export-outcome", "export-window",
    "recovery-artifact-digest", "recovery-export", "recovery-outcome", "recovery-scope",
    "write-consistency", "retention",
  ]),
  reference: stableIdentifierSchema,
  status: z.enum(["verified-local", "operator-reported", "unavailable", "conflict"]),
  reason: reviewReasonSchema,
}).readonly();

const requiredReviewItemSchema = z.strictObject({
  identifier: stableIdentifierSchema,
  reference: stableIdentifierSchema,
  reason: reviewReasonSchema,
}).readonly();

export const persistenceRemovalMachineReportSchema = z.strictObject({
  schemaVersion: z.literal("1.0.0"),
  subjectFingerprint: fingerprintSchema,
  policyFingerprint: fingerprintSchema,
  evidenceFingerprint: fingerprintSchema,
  localArtifactsFingerprint: fingerprintSchema,
  recommendation: z.enum(["ready-for-human-review", "obtain-more-evidence", "blocked"]),
  reasons: z.array(reviewReasonSchema).max(32).readonly(),
  checks: z.array(reviewCheckSchema).min(1).max(64).readonly(),
  requiredReviewItems: z.array(requiredReviewItemSchema).min(1).max(64).readonly(),
  reportFingerprint: fingerprintSchema,
}).readonly().meta({
  id: "urn:egeria-systems:schema:persistence-removal-machine-report:1.0.0",
  title: "Egeria persistence removal machine report",
});

export const persistenceRemovalHumanReviewSchema = z.strictObject({
  reportFingerprint: fingerprintSchema,
  dispositions: z.array(z.strictObject({
    identifier: stableIdentifierSchema,
    disposition: z.enum(["accepted", "rejected", "unresolved"]),
  }).readonly()).min(1).max(64).readonly(),
}).readonly();

export type PersistenceRemovalSubject = z.infer<typeof persistenceRemovalSubjectSchema>;
export type PersistenceRemovalPolicy = z.infer<typeof persistenceRemovalPolicySchema>;
export type PersistenceRemovalEvidence = z.infer<typeof persistenceRemovalEvidenceSchema>;
export type PersistenceRemovalReviewInput = z.infer<typeof persistenceRemovalReviewInputSchema>;
export type PersistenceRemovalMachineReport = z.infer<typeof persistenceRemovalMachineReportSchema>;
export type PersistenceRemovalHumanReview = z.infer<typeof persistenceRemovalHumanReviewSchema>;

export type PersistenceRemovalInput = z.infer<typeof persistenceRemovalInputSchema>;
