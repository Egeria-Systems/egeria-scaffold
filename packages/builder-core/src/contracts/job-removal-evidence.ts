import { z } from "zod";
import { fingerprintSchema, safeRelativePathSchema, stableIdentifierSchema } from "./identifiers.js";

const resourceIdentitySchema = z.strictObject({
  environment: z.enum(["local", "staging", "production"]),
  accountId: stableIdentifierSchema,
  primaryQueueId: stableIdentifierSchema,
  deadLetterQueueId: stableIdentifierSchema,
}).refine(({ primaryQueueId, deadLetterQueueId }) => primaryQueueId !== deadLetterQueueId).readonly();
const resourcesSchema = z.array(resourceIdentitySchema).max(3).refine((resources) =>
  new Set(resources.map(({environment}) => environment)).size === resources.length &&
  new Set(resources.flatMap(({accountId,primaryQueueId,deadLetterQueueId}) => [`${accountId}/${primaryQueueId}`, `${accountId}/${deadLetterQueueId}`])).size === resources.length * 2,
).readonly();
export const jobRemovalSubjectSchema = z.strictObject({
  descriptorVersion: z.enum(["0.1.0", "0.2.0"]),
  descriptorFingerprint: fingerprintSchema,
  configurationFingerprint: fingerprintSchema,
  handlerFingerprint: fingerprintSchema,
  sourceRevision: z.string().regex(/^[a-f0-9]{40}$/u),
  resources: resourcesSchema,
}).readonly();
const reportedOutcome = z.enum(["passed", "failed", "unavailable"]);
const workDispositionSchema = z.strictObject({
  disposition: z.enum(["retain", "drain", "discard", "unknown"]),
  outcome: reportedOutcome,
  workRemaining: z.boolean(),
  originalEnqueuedAt: z.iso.datetime({ offset: true }).optional(),
  originalExpiresAt: z.iso.datetime({ offset: true }).optional(),
}).readonly();
const auditSchema = z.strictObject({ reference: stableIdentifierSchema, digest: fingerprintSchema }).readonly();
export const jobRemovalEvidenceSchema = z.strictObject({
  schemaVersion: z.literal("1.0.0"),
  subject: jobRemovalSubjectSchema,
  deploymentInventory: z.strictObject({
    local: z.enum(["present", "not-provisioned", "unknown"]),
    staging: z.enum(["present", "not-provisioned", "unknown"]),
    production: z.enum(["present", "not-provisioned", "unknown"]),
  }).readonly(),
  observedAt: z.iso.datetime({ offset: true }),
  expiresAt: z.iso.datetime({ offset: true }),
  resources: z.array(z.strictObject({
    identity: resourceIdentitySchema,
    producerStop: reportedOutcome,
    primary: workDispositionSchema,
    inFlight: workDispositionSchema,
    delayed: workDispositionSchema,
    deadLetter: workDispositionSchema,
    retentionSeconds: z.literal(86400),
    compatibleConsumer: z.strictObject({
      deployed: z.literal(true),
      descriptorVersion: z.enum(["0.1.0", "0.2.0"]),
      handlerFingerprint: fingerprintSchema,
      recoveryOwner: stableIdentifierSchema,
      preservesOriginalIdentity: z.literal(true),
    }).readonly().optional(),
    operationLimits: z.strictObject({ maxMessages: z.number().int().min(1).max(1000), maxDurationSeconds: z.number().int().min(1).max(3600) }).readonly(),
    audit: auditSchema.optional(),
  }).readonly()).max(3).readonly(),
}).readonly();
export const jobRemovalInputSchema = z.strictObject({
  resources: resourcesSchema,
  evidence: jobRemovalEvidenceSchema.optional(),
  localArtifacts: z.array(z.strictObject({ reference: stableIdentifierSchema, path: safeRelativePathSchema }).readonly()).max(3).refine((items) =>
    new Set(items.map(({reference}) => reference)).size === items.length && new Set(items.map(({path}) => path)).size === items.length,
  ).readonly().optional(),
}).readonly();
export const jobRemovalReviewInputSchema = z.strictObject({
  expectedSubject: jobRemovalSubjectSchema,
  evidence: jobRemovalEvidenceSchema.optional(),
  localArtifactDigests: z.array(auditSchema).max(3).readonly().optional(),
  requiredLocalArtifactReferences: z.array(stableIdentifierSchema).max(3).readonly().optional(),
}).readonly();
const reasonSchema = z.enum([
  "INPUT_INVALID", "SUBJECT_MATCHED", "SUBJECT_MISMATCH", "EVIDENCE_MISSING", "EVIDENCE_STALE",
  "OUTCOME_OPERATOR_REPORTED", "REQUIRED_OUTCOME_FAILED", "DISPOSITION_UNKNOWN", "DISPOSITION_INCOMPLETE",
  "RETAINED_WORK_REQUIRES_COMPATIBLE_CONSUMER", "ORIGINAL_EXPIRY_INVALID", "LOCAL_DIGEST_MATCHED", "LOCAL_ARTIFACT_UNAVAILABLE",
  "LOCAL_DIGEST_MISMATCH", "HUMAN_REVIEW_REQUIRED", "SOURCE_ONLY_REMOVAL", "REMOTE_DISPOSITION_OPERATOR_REPORTED",
]);
export const jobRemovalMachineReportSchema = z.strictObject({
  schemaVersion: z.literal("1.0.0"),
  subjectFingerprint: fingerprintSchema,
  evidenceFingerprint: fingerprintSchema,
  localArtifactsFingerprint: fingerprintSchema,
  recommendation: z.enum(["ready-for-human-review", "obtain-more-evidence", "blocked"]),
  reasons: z.array(reasonSchema).max(32).readonly(),
  checks: z.array(z.strictObject({ identifier: stableIdentifierSchema, reference: stableIdentifierSchema, status: z.enum(["verified-local", "operator-reported", "unavailable", "conflict"]), reason: reasonSchema }).readonly()).min(1).max(64).readonly(),
  requiredReviewItems: z.array(z.strictObject({ identifier: stableIdentifierSchema, reference: stableIdentifierSchema, reason: reasonSchema }).readonly()).min(1).max(64).readonly(),
  reportFingerprint: fingerprintSchema,
}).readonly();
export const jobRemovalHumanReviewSchema = z.strictObject({
  reportFingerprint: fingerprintSchema,
  dispositions: z.array(z.strictObject({ identifier: stableIdentifierSchema, disposition: z.enum(["accepted", "rejected", "unresolved"]) }).readonly()).min(1).max(64).readonly(),
}).readonly();
export type JobRemovalInput = z.infer<typeof jobRemovalInputSchema>;
export type JobRemovalSubject = z.infer<typeof jobRemovalSubjectSchema>;
export type JobRemovalEvidence = z.infer<typeof jobRemovalEvidenceSchema>;
export type JobRemovalMachineReport = z.infer<typeof jobRemovalMachineReportSchema>;
export type JobRemovalHumanReview = z.infer<typeof jobRemovalHumanReviewSchema>;
