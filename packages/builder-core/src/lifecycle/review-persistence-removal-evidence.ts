import { createHash } from "node:crypto";

import {
  persistenceRemovalHumanReviewSchema,
  persistenceRemovalMachineReportSchema,
  persistenceRemovalReviewInputSchema,
  type PersistenceRemovalHumanReview,
  type PersistenceRemovalMachineReport,
  type PersistenceRemovalReviewInput,
  type PersistenceRemovalSubject,
} from "../contracts/persistence-removal-evidence.js";
import { validateContract, type ValidationResult } from "../contracts/result.js";
import { stringifyCanonicalJson } from "../serialization/canonical-json.js";

type ReviewCheck = PersistenceRemovalMachineReport["checks"][number];
type ReviewItem = PersistenceRemovalMachineReport["requiredReviewItems"][number];
type ReviewReason = ReviewCheck["reason"];
type UnfingerprintedReport = Omit<PersistenceRemovalMachineReport, "reportFingerprint">;

function fingerprint(value: unknown): string {
  return `sha256:${createHash("sha256").update(stringifyCanonicalJson(value), "utf8").digest("hex")}`;
}

function fingerprintReport(report: UnfingerprintedReport): PersistenceRemovalMachineReport {
  return { ...report, reportFingerprint: fingerprint(report) };
}

function subjectFingerprint(subject: PersistenceRemovalSubject): string {
  return fingerprint({
    ...subject,
    databases: [...subject.databases].sort((left, right) =>
      left.environment < right.environment ? -1 : left.environment > right.environment ? 1 : 0),
  });
}

function isMandatoryEvidenceUnavailable(check: ReviewCheck): boolean {
  return check.status === "unavailable" && check.reason !== "LOCAL_ARTIFACT_UNAVAILABLE";
}

function invalidInputReport(): PersistenceRemovalMachineReport {
  const invalidFingerprint = fingerprint({ invalid: true });
  return fingerprintReport({
    schemaVersion: "1.0.0",
    subjectFingerprint: invalidFingerprint,
    policyFingerprint: invalidFingerprint,
    evidenceFingerprint: invalidFingerprint,
    localArtifactsFingerprint: invalidFingerprint,
    recommendation: "blocked",
    reasons: ["INPUT_INVALID"],
    checks: [{ identifier: "input-structure", reference: "removal-input", status: "conflict", reason: "INPUT_INVALID" }],
    requiredReviewItems: [{ identifier: "correct-input", reference: "removal-input", reason: "INPUT_INVALID" }],
  });
}

function assessEvidence(input: PersistenceRemovalReviewInput): PersistenceRemovalMachineReport {
  const checks: ReviewCheck[] = [];
  const requiredReviewItems: ReviewItem[] = [
    { identifier: "source-removal-diff", reference: "removal-plan", reason: "SOURCE_REMOVAL_DIFF_REQUIRES_HUMAN_REVIEW" },
    { identifier: "provider-data-disposition", reference: "removal-plan", reason: "PROVIDER_DATA_DISPOSITION_REQUIRES_HUMAN_REVIEW" },
    { identifier: "expected-removal-subject", reference: "removal-subject", reason: "SUBJECT_REQUIRES_HUMAN_REVIEW" },
  ];
  const localArtifacts = new Map((input.localArtifactDigests ?? []).map(({ reference, digest }) => [reference, digest]));

  function check(identifier: ReviewCheck["identifier"], reference: string, status: ReviewCheck["status"], reason: ReviewReason): void {
    checks.push({ identifier, reference, status, reason });
    if (status === "unavailable" || status === "conflict") {
      requiredReviewItems.push({ identifier: `${reference}-${identifier}`, reference, reason });
    }
  }

  function review(identifier: string, reference: string, reason: ReviewReason): void {
    requiredReviewItems.push({ identifier: `${reference}-${identifier}`, reference, reason });
  }

  function outcome(identifier: ReviewCheck["identifier"], reference: string, outcomes: readonly ("passed" | "failed" | "unavailable")[]): void {
    if (outcomes.includes("failed")) {
      check(identifier, reference, "conflict", "REQUIRED_OUTCOME_FAILED");
    } else if (outcomes.includes("unavailable")) {
      check(identifier, reference, "unavailable", "REQUIRED_OUTCOME_UNAVAILABLE");
    } else {
      check(identifier, reference, "operator-reported", "OUTCOME_OPERATOR_REPORTED");
    }
  }

  function artifact(identifier: "export-artifact-digest" | "recovery-artifact-digest", reference: string, evidence: Readonly<{ artifactReference: string; digest: string }>): void {
    const digest = localArtifacts.get(evidence.artifactReference);
    if (digest === undefined) {
      check(identifier, reference, "unavailable", "LOCAL_ARTIFACT_UNAVAILABLE");
    } else if (digest !== evidence.digest) {
      check(identifier, reference, "conflict", "LOCAL_DIGEST_MISMATCH");
    } else {
      check(identifier, reference, "verified-local", "LOCAL_DIGEST_MATCHED");
    }
  }

  const expectedFingerprint = subjectFingerprint(input.expectedSubject);
  if (input.evidence === undefined) {
    check("removal-subject", "removal-evidence", "unavailable", "EVIDENCE_MISSING");
  } else if (subjectFingerprint(input.evidence.subject) !== expectedFingerprint) {
    check("removal-subject", "removal-evidence", "conflict", "SUBJECT_MISMATCH");
  } else {
    check("removal-subject", "removal-evidence", "verified-local", "SUBJECT_MATCHED");
  }

  for (const [index, database] of (input.evidence?.databases ?? []).entries()) {
    if (!input.expectedSubject.databases.some((expected) => expected.environment === database.environment && expected.databaseId === database.databaseId)) {
      check("database-evidence", `supplied-database-${String(index + 1)}`, "conflict", "SUBJECT_MISMATCH");
    }
  }

  for (const [index, expected] of input.expectedSubject.databases.entries()) {
    const reference = `database-${String(index + 1)}`;
    const database = input.evidence?.databases.find((entry) => entry.environment === expected.environment && entry.databaseId === expected.databaseId);
    if (database === undefined) {
      check("database-evidence", reference, "unavailable", "EVIDENCE_MISSING");
      continue;
    }

    if (database.export === undefined) {
      check("export-outcome", reference, "unavailable", "EVIDENCE_MISSING");
    } else {
      artifact("export-artifact-digest", reference, database.export);
      outcome("export-outcome", reference, [database.export.outcome]);
      const withinWindow = Date.parse(database.export.completedAt) >= Date.parse(input.policy.exportNotBefore);
      check("export-window", reference, withinWindow ? "operator-reported" : "conflict", withinWindow ? "EXPORT_WITHIN_POLICY_WINDOW" : "EXPORT_OUTSIDE_POLICY_WINDOW");
      review("export-completeness", reference, "EXPORT_COMPLETENESS_REQUIRES_HUMAN_REVIEW");
    }

    if (database.recovery === undefined) {
      check("recovery-outcome", reference, "unavailable", "EVIDENCE_MISSING");
    } else {
      artifact("recovery-artifact-digest", reference, database.recovery);
      outcome("recovery-outcome", reference, [database.recovery.restoration, database.recovery.readback]);
      if (database.export !== undefined) {
        const matchesExport = database.recovery.exportDigest === database.export.digest;
        check("recovery-export", reference, matchesExport ? "operator-reported" : "conflict", matchesExport ? "RECOVERY_EXPORT_MATCHED" : "RECOVERY_EXPORT_MISMATCH");
      }
      const requiredRecovery = input.policy.recoveryRequirements.find(({ environment }) => environment === expected.environment);
      if (database.recovery.scope !== requiredRecovery?.scope) {
        check("recovery-scope", reference, "unavailable", "REQUIRED_RECOVERY_SCOPE_MISSING");
      }
      review("recovery-provenance", reference, database.recovery.scope === "local" ? "LOCAL_RECOVERY_DOES_NOT_PROVE_DEPLOYED_RECOVERY" : "DEPLOYED_RECOVERY_IS_OPERATOR_REPORTED");
    }

    if (database.writeConsistency === undefined) {
      check("write-consistency", reference, "unavailable", "EVIDENCE_MISSING");
    } else {
      outcome("write-consistency", reference, [database.writeConsistency.outcome]);
      if (database.writeConsistency.mode !== input.policy.writeConsistency) {
        check("write-consistency", reference, "conflict", "WRITE_CONSISTENCY_POLICY_MISMATCH");
      }
      review("write-policy", reference, "WRITE_CONSISTENCY_REQUIRES_HUMAN_REVIEW");
    }

    if (database.retention === undefined) {
      check("retention", reference, "unavailable", "EVIDENCE_MISSING");
    } else {
      outcome("retention", reference, [database.retention.outcome]);
      const retainedUntil = Date.parse(database.retention.retainedUntil);
      if (retainedUntil < Date.parse(input.policy.retainUntil) || (database.export !== undefined && retainedUntil < Date.parse(database.export.completedAt))) {
        check("retention", reference, "conflict", "RETENTION_POLICY_NOT_MET");
      }
      review("retention-policy", reference, "RETENTION_REQUIRES_HUMAN_REVIEW");
    }
  }

  const conflicts = checks.filter(({ status }) => status === "conflict");
  const unavailable = checks.filter(({ status }) => status === "unavailable");
  const recommendation = conflicts.length > 0 ? "blocked" : unavailable.some(isMandatoryEvidenceUnavailable) ? "obtain-more-evidence" : "ready-for-human-review";
  return fingerprintReport({
    schemaVersion: "1.0.0",
    subjectFingerprint: expectedFingerprint,
    policyFingerprint: fingerprint(input.policy),
    evidenceFingerprint: fingerprint(input.evidence ?? null),
    localArtifactsFingerprint: fingerprint(input.localArtifactDigests ?? []),
    recommendation,
    reasons: [...new Set<ReviewReason>([
      ...conflicts.map(({ reason }) => reason),
      ...unavailable.map(({ reason }) => reason),
      ...(recommendation === "ready-for-human-review" ? ["HUMAN_REVIEW_REQUIRED" as const] : []),
    ])].sort(),
    checks,
    requiredReviewItems: [...new Map(requiredReviewItems.map((item) => [item.identifier, item])).values()],
  });
}

/** Local digests must come from independent artifact reads at the imperative boundary. */
export function reviewPersistenceRemovalEvidence(input: unknown): PersistenceRemovalMachineReport {
  try {
    const validated = validateContract(persistenceRemovalReviewInputSchema, input);
    return validated.ok ? assessEvidence(validated.value) : invalidInputReport();
  } catch {
    return invalidInputReport();
  }
}

function refusedHumanReview(code: string): ValidationResult<PersistenceRemovalHumanReview> {
  return { ok: false, issues: [{ code, path: [], context: {} }] };
}

/** The executor supplies a freshly recomputed report, never a caller-selected report. */
export function validatePersistenceRemovalHumanReview(report: unknown, review: unknown): ValidationResult<PersistenceRemovalHumanReview> {
  try {
    const parsedReport = validateContract(persistenceRemovalMachineReportSchema, report);
    const parsedReview = validateContract(persistenceRemovalHumanReviewSchema, review);
    if (!parsedReport.ok || !parsedReview.ok) {
      return refusedHumanReview("PERSISTENCE_REMOVAL_HUMAN_REVIEW_INVALID");
    }
    const { reportFingerprint, ...reportBody } = parsedReport.value;
    if (reportFingerprint !== fingerprint(reportBody) || reportFingerprint !== parsedReview.value.reportFingerprint) {
      return refusedHumanReview("PERSISTENCE_REMOVAL_REVIEW_SNAPSHOT_CHANGED");
    }
    if (parsedReport.value.recommendation !== "ready-for-human-review" || parsedReport.value.checks.some((check) => check.status === "conflict" || isMandatoryEvidenceUnavailable(check))) {
      return refusedHumanReview("PERSISTENCE_REMOVAL_EVIDENCE_NOT_READY");
    }
    const required = new Set(parsedReport.value.requiredReviewItems.map(({ identifier }) => identifier));
    const supplied = new Set(parsedReview.value.dispositions.map(({ identifier }) => identifier));
    if (supplied.size !== required.size || supplied.size !== parsedReview.value.dispositions.length || parsedReview.value.dispositions.some(({ identifier, disposition }) => !required.has(identifier) || disposition !== "accepted")) {
      return refusedHumanReview("PERSISTENCE_REMOVAL_HUMAN_REVIEW_INCOMPLETE");
    }
    return parsedReview;
  } catch {
    return refusedHumanReview("PERSISTENCE_REMOVAL_HUMAN_REVIEW_INVALID");
  }
}
