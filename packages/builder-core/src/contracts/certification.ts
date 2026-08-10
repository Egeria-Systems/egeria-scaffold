import { z } from "zod";

import {
  fingerprintSchema,
  safeRelativePathSchema,
  semanticVersionSchema,
  stableIdentifierSchema,
} from "./identifiers.js";

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function requireSortedUniqueIdentifiers(
  values: readonly string[],
  context: z.RefinementCtx,
): void {
  const expected = [...new Set(values)].sort(compareText);

  if (
    expected.length !== values.length ||
    expected.some((value, index) => value !== values[index])
  ) {
    context.addIssue({
      code: "custom",
      message: "identifiers must be unique and sorted",
    });
  }
}

const certificationPlanPathSchema = safeRelativePathSchema.refine(
  (path) =>
    path.startsWith("docs/superpowers/plans/") && path.endsWith(".md"),
  "certification task plans must use the approved plan directory",
);

const certificationEvidencePathSchema = safeRelativePathSchema.refine(
  (path) =>
    path.startsWith("docs/implementation-evidence/") && path.endsWith(".md"),
  "certification evidence must use the implementation evidence directory",
);

export const certificationStatusSchema = z.enum([
  "backfill-pending",
  "pending",
  "certified",
]);

export const certificationSubjectSchema = z
  .strictObject({
    descriptorVersion: semanticVersionSchema,
    behaviorContractDigest: fingerprintSchema,
  })
  .readonly();

export const certificationEvidenceSchema = z
  .strictObject({
    kind: stableIdentifierSchema,
    path: certificationEvidencePathSchema,
    outcome: z.literal("passed"),
    revision: z.string().regex(/^[a-f0-9]{40}$/),
    subject: certificationSubjectSchema,
  })
  .readonly();

const requiredEvidenceSchema = z
  .array(stableIdentifierSchema)
  .min(1)
  .superRefine(requireSortedUniqueIdentifiers)
  .readonly();

const certificationEvidenceListSchema = z
  .array(certificationEvidenceSchema)
  .superRefine((evidence, context) => {
    const keys = evidence.map(({ kind, path }) => `${kind}\u0000${path}`);
    const expected = [...new Set(keys)].sort(compareText);

    if (
      expected.length !== keys.length ||
      expected.some((value, index) => value !== keys[index])
    ) {
      context.addIssue({
        code: "custom",
        message: "evidence must be unique and sorted",
      });
    }
  })
  .readonly();

export const capabilityCertificationRecordSchema = z
  .strictObject({
    subject: certificationSubjectSchema,
    requiredEvidence: requiredEvidenceSchema,
    status: certificationStatusSchema,
    taskPlan: certificationPlanPathSchema.nullable(),
    evidence: certificationEvidenceListSchema,
  })
  .superRefine((record, context) => {
    if (record.status === "backfill-pending") {
      if (record.taskPlan !== null) {
        context.addIssue({
          code: "custom",
          message: "backfill records cannot claim a certification task",
          path: ["taskPlan"],
        });
      }
    } else if (record.taskPlan === null) {
      context.addIssue({
        code: "custom",
        message: "pending and certified records require a task plan",
        path: ["taskPlan"],
      });
    }

    const required = new Set(record.requiredEvidence);
    const evidenceKinds = record.evidence.map(({ kind }) => kind);

    for (const [index, kind] of evidenceKinds.entries()) {
      if (!required.has(kind)) {
        context.addIssue({
          code: "custom",
          message: "evidence kind is not required",
          path: ["evidence", index, "kind"],
        });
      }
    }

    if (new Set(evidenceKinds).size !== evidenceKinds.length) {
      context.addIssue({
        code: "custom",
        message: "each evidence kind can be recorded once",
        path: ["evidence"],
      });
    }

    for (const [index, evidence] of record.evidence.entries()) {
      if (
        evidence.subject.descriptorVersion !==
          record.subject.descriptorVersion ||
        evidence.subject.behaviorContractDigest !==
          record.subject.behaviorContractDigest
      ) {
        context.addIssue({
          code: "custom",
          message: "evidence must bind the certification subject",
          path: ["evidence", index, "subject"],
        });
      }
    }

    if (
      record.status === "certified" &&
      (evidenceKinds.length !== record.requiredEvidence.length ||
        record.requiredEvidence.some((kind) => !evidenceKinds.includes(kind)))
    ) {
      context.addIssue({
        code: "custom",
        message: "certified records require every declared evidence outcome",
        path: ["evidence"],
      });
    }
  })
  .readonly();

export const certificationRegistrySchema = z
  .strictObject({
    schemaVersion: z.literal("1.0.0"),
    records: z
      .record(stableIdentifierSchema, capabilityCertificationRecordSchema)
      .refine((records) => Object.keys(records).length > 0, {
        message: "the certification registry cannot be empty",
      })
      .readonly(),
  })
  .readonly()
  .meta({
    id: "urn:egeria-systems:schema:capability-certification-registry:1.0.0",
    title: "Egeria capability certification coverage registry",
  });

export type CertificationStatus = z.infer<typeof certificationStatusSchema>;
export type CertificationSubject = z.infer<typeof certificationSubjectSchema>;
export type CertificationEvidence = z.infer<typeof certificationEvidenceSchema>;
export type CapabilityCertificationRecord = z.infer<
  typeof capabilityCertificationRecordSchema
>;
export type CertificationRegistry = z.infer<
  typeof certificationRegistrySchema
>;
