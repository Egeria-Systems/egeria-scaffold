import { jobRemovalHumanReviewSchema, jobRemovalMachineReportSchema, jobRemovalReviewInputSchema, type JobRemovalHumanReview, type JobRemovalMachineReport } from "../contracts/job-removal-evidence.js";
import type { ValidationResult } from "../contracts/result.js";
import { fingerprintJsonValue } from "../ownership/fingerprint.js";

type Check = JobRemovalMachineReport["checks"][number];

/** The clock is evaluated for eligibility only; it is never included in stable evidence hashes. */
export function reviewJobRemovalEvidence(input: unknown, now: () => string = () => new Date().toISOString()): JobRemovalMachineReport {
  const parsed = jobRemovalReviewInputSchema.safeParse(input);
  const checks: Check[] = [];
  const reviews: JobRemovalMachineReport["requiredReviewItems"][number][] = [
    {identifier:"source-removal-diff", reference:"removal-plan", reason:"SOURCE_ONLY_REMOVAL"},
    {identifier:"deployment-inventory-completeness", reference:"removal-plan", reason:"REMOTE_DISPOSITION_OPERATOR_REPORTED"},
    {identifier:"resource-identity-and-producer-stop", reference:"removal-plan", reason:"REMOTE_DISPOSITION_OPERATOR_REPORTED"},
  ];
  const check = (identifier: string, reference: string, status: Check["status"], reason: Check["reason"]) => { checks.push({identifier, reference, status, reason}); };
  if (!parsed.success) {
    check("input-structure", "removal-input", "conflict", "INPUT_INVALID");
  } else {
    const { expectedSubject, evidence } = parsed.data;
    if (evidence === undefined) check("removal-subject", "removal-evidence", "unavailable", "EVIDENCE_MISSING");
    else {
      check("removal-subject", "removal-evidence", fingerprintJsonValue(expectedSubject) === fingerprintJsonValue(evidence.subject) ? "verified-local" : "conflict", fingerprintJsonValue(expectedSubject) === fingerprintJsonValue(evidence.subject) ? "SUBJECT_MATCHED" : "SUBJECT_MISMATCH");
      let time = Number.NaN;
      try { time = Date.parse(now()); } catch { /* Invalid clocks refuse eligibility. */ }
      const observed = Date.parse(evidence.observedAt);
      const expires = Date.parse(evidence.expiresAt);
      if (!Number.isFinite(time) || observed > time || time >= expires || expires <= observed || expires - observed > 86400000) check("freshness", "removal-evidence", "conflict", "EVIDENCE_STALE");
      for (const environment of ["local", "staging", "production"] as const) {
        const status = evidence.deploymentInventory[environment];
        const present = expectedSubject.resources.some((resource) => resource.environment === environment);
        if (status === "unknown" || (status === "present") !== present) check("deployment-inventory", environment, "conflict", "DISPOSITION_INCOMPLETE");
      }
      const identities = new Set(evidence.resources.map(({identity}) => fingerprintJsonValue(identity)));
      if (identities.size !== expectedSubject.resources.length || evidence.resources.length !== expectedSubject.resources.length || expectedSubject.resources.some((identity) => !identities.has(fingerprintJsonValue(identity)))) check("resource-identities", "removal-evidence", "conflict", "SUBJECT_MISMATCH");
      for (const [index, identity] of expectedSubject.resources.entries()) {
        const reference = `queue-${String(index + 1)}`;
        const resource = evidence.resources.find((entry) => fingerprintJsonValue(entry.identity) === fingerprintJsonValue(identity));
        if (resource === undefined) { check("resource-disposition", reference, "unavailable", "EVIDENCE_MISSING"); continue; }
        check("producer-stop", reference, resource.producerStop === "passed" ? "operator-reported" : "conflict", resource.producerStop === "passed" ? "OUTCOME_OPERATOR_REPORTED" : "REQUIRED_OUTCOME_FAILED");
        for (const area of ["primary", "inFlight", "delayed", "deadLetter"] as const) {
          const work = resource[area];
          const identifier = area === "inFlight" ? "in-flight" : area === "deadLetter" ? "dead-letter" : area;
          reviews.push({identifier:`${reference}-${identifier}-disposition`, reference, reason:"REMOTE_DISPOSITION_OPERATOR_REPORTED"});
          if (work.disposition === "unknown") check(identifier, reference, "conflict", "DISPOSITION_UNKNOWN");
          else if (work.outcome !== "passed" || (work.disposition === "drain" && work.workRemaining)) check(identifier, reference, "conflict", "DISPOSITION_INCOMPLETE");
          else check(identifier, reference, "operator-reported", "OUTCOME_OPERATOR_REPORTED");
          if (work.workRemaining) {
            const enqueued = Date.parse(work.originalEnqueuedAt ?? "");
            const expiry = Date.parse(work.originalExpiresAt ?? "");
            if (!Number.isFinite(enqueued) || !Number.isFinite(expiry) || enqueued > observed || expiry <= expires || expiry <= enqueued || expiry - enqueued > 86400000) check(`${identifier}-expiry`, reference, "conflict", "ORIGINAL_EXPIRY_INVALID");
            if (work.disposition !== "discard" && (resource.compatibleConsumer?.descriptorVersion !== expectedSubject.descriptorVersion || resource.compatibleConsumer.handlerFingerprint !== expectedSubject.handlerFingerprint)) check(`${identifier}-consumer`, reference, "conflict", "RETAINED_WORK_REQUIRES_COMPATIBLE_CONSUMER");
          }
        }
        if (resource.compatibleConsumer !== undefined) reviews.push({identifier:`${reference}-deployed-consumer-recovery`, reference, reason:"REMOTE_DISPOSITION_OPERATOR_REPORTED"});
        reviews.push({identifier:`${reference}-retention-and-operation-limits`, reference, reason:"REMOTE_DISPOSITION_OPERATOR_REPORTED"});
        if (resource.audit !== undefined) {
          const local = parsed.data.localArtifactDigests?.find(({reference}) => reference === resource.audit?.reference);
          const required = parsed.data.requiredLocalArtifactReferences?.includes(resource.audit.reference) === true;
          if (local !== undefined) check("audit-artifact", reference, local.digest === resource.audit.digest ? "verified-local" : "conflict", local.digest === resource.audit.digest ? "LOCAL_DIGEST_MATCHED" : "LOCAL_DIGEST_MISMATCH");
          else if (required) check("audit-artifact", reference, "conflict", "LOCAL_ARTIFACT_UNAVAILABLE");
          reviews.push({identifier:`${reference}-audit-provenance`, reference, reason:"REMOTE_DISPOSITION_OPERATOR_REPORTED"});
        }
      }
      for (const reference of parsed.data.requiredLocalArtifactReferences ?? []) {
        if (!evidence.resources.some(({audit}) => audit?.reference === reference)) check("audit-coverage", "removal-evidence", "conflict", "SUBJECT_MISMATCH");
      }
    }
  }
  const recommendation: JobRemovalMachineReport["recommendation"] = checks.some(({status}) => status === "conflict") ? "blocked" : checks.some(({status}) => status === "unavailable") ? "obtain-more-evidence" : "ready-for-human-review";
  const body = {
    schemaVersion:"1.0.0" as const,
    subjectFingerprint:fingerprintJsonValue(parsed.success ? parsed.data.expectedSubject : null),
    evidenceFingerprint:fingerprintJsonValue(parsed.success ? parsed.data.evidence ?? null : null),
    localArtifactsFingerprint:fingerprintJsonValue(parsed.success ? {digests:parsed.data.localArtifactDigests ?? [], required:parsed.data.requiredLocalArtifactReferences ?? []} : null),
    recommendation,
    reasons:[...new Set([...checks.filter(({status}) => status === "conflict" || status === "unavailable").map(({reason}) => reason), ...(recommendation === "ready-for-human-review" ? ["HUMAN_REVIEW_REQUIRED" as const] : [])])],
    checks, requiredReviewItems:reviews,
  };
  return {...body, reportFingerprint:fingerprintJsonValue(body)};
}

/** Only a freshly recomputed local report may be passed by the executor. */
export function validateJobRemovalHumanReview(report: unknown, review: unknown): ValidationResult<JobRemovalHumanReview> {
  const refusal = (code: string): ValidationResult<JobRemovalHumanReview> => ({ok:false, issues:[{code,path:[],context:{}}]});
  const parsedReport = jobRemovalMachineReportSchema.safeParse(report);
  const parsedReview = jobRemovalHumanReviewSchema.safeParse(review);
  if (!parsedReport.success || !parsedReview.success) return refusal("JOB_REMOVAL_HUMAN_REVIEW_INVALID");
  const {reportFingerprint, ...body} = parsedReport.data;
  if (reportFingerprint !== fingerprintJsonValue(body) || reportFingerprint !== parsedReview.data.reportFingerprint) return refusal("JOB_REMOVAL_REVIEW_SNAPSHOT_CHANGED");
  if (body.recommendation !== "ready-for-human-review" || body.checks.some(({status}) => status === "conflict" || status === "unavailable")) return refusal("JOB_REMOVAL_EVIDENCE_NOT_READY");
  const required = new Set(body.requiredReviewItems.map(({identifier}) => identifier));
  const supplied = new Set(parsedReview.data.dispositions.map(({identifier}) => identifier));
  if (required.size !== supplied.size || supplied.size !== parsedReview.data.dispositions.length || parsedReview.data.dispositions.some(({identifier,disposition}) => !required.has(identifier) || disposition !== "accepted")) return refusal("JOB_REMOVAL_HUMAN_REVIEW_INCOMPLETE");
  return {ok:true,value:parsedReview.data};
}
