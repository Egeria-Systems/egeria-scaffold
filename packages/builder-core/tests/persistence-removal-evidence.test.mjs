import assert from "node:assert/strict";
import test from "node:test";

import {
  reviewPersistenceRemovalEvidence,
  validatePersistenceRemovalHumanReview,
} from "../dist/lifecycle/review-persistence-removal-evidence.js";

const fingerprint = (character) => `sha256:${character.repeat(64)}`;

function inputFixture() {
  const subject = {
    descriptorVersion: "0.1.0",
    descriptorFingerprint: fingerprint("a"),
    schemaFingerprint: fingerprint("b"),
    migrationsFingerprint: fingerprint("c"),
    databases: [{ environment: "staging", databaseId: "private-database-target" }],
  };
  return {
    expectedSubject: subject,
    policy: {
      exportNotBefore: "2026-09-01T00:00:00Z",
      retainUntil: "2026-10-01T00:00:00Z",
      recoveryRequirements: [{ environment: "staging", scope: "local" }],
      writeConsistency: "writes-paused",
    },
    evidence: {
      schemaVersion: "1.0.0",
      subject: structuredClone(subject),
      databases: [{
        environment: "staging",
        databaseId: "private-database-target",
        export: {
          artifactReference: "private-export-artifact",
          digest: fingerprint("d"),
          completedAt: "2026-09-14T01:00:00Z",
          outcome: "passed",
        },
        recovery: {
          artifactReference: "private-recovery-artifact",
          digest: fingerprint("e"),
          exportDigest: fingerprint("d"),
          scope: "local",
          restoration: "passed",
          readback: "passed",
        },
        writeConsistency: { mode: "writes-paused", outcome: "passed" },
        retention: { retainedUntil: "2026-10-02T00:00:00Z", outcome: "passed" },
      }],
    },
    localArtifactDigests: [
      { reference: "private-export-artifact", digest: fingerprint("d") },
      { reference: "private-recovery-artifact", digest: fingerprint("e") },
    ],
  };
}

function acceptance(report) {
  return {
    reportFingerprint: report.reportFingerprint,
    dispositions: report.requiredReviewItems.map(({ identifier }) => ({ identifier, disposition: "accepted" })),
  };
}

test("complete evidence is ready only for human review with distinct local and reported facts", () => {
  const report = reviewPersistenceRemovalEvidence(inputFixture());
  assert.equal(report?.recommendation, "ready-for-human-review");
  assert.ok(report.checks.some(({ identifier, status }) => identifier === "export-artifact-digest" && status === "verified-local"));
  assert.ok(report.checks.some(({ identifier, status }) => identifier === "export-outcome" && status === "operator-reported"));
  assert.ok(report.requiredReviewItems.some(({ reason }) => reason === "LOCAL_RECOVERY_DOES_NOT_PROVE_DEPLOYED_RECOVERY"));
  assert.ok(report.requiredReviewItems.some(({ reason }) => reason === "SOURCE_REMOVAL_DIFF_REQUIRES_HUMAN_REVIEW"));
  assert.ok(report.requiredReviewItems.some(({ reason }) => reason === "PROVIDER_DATA_DISPOSITION_REQUIRES_HUMAN_REVIEW"));
});

test("human review requires exact snapshot and explicit acceptance of every required item", () => {
  const report = reviewPersistenceRemovalEvidence(inputFixture());
  assert.equal(validatePersistenceRemovalHumanReview(report, undefined)?.ok, false);
  assert.equal(validatePersistenceRemovalHumanReview(report, acceptance(report)).ok, true);
  for (const change of [
    (review) => { review.reportFingerprint = fingerprint("f"); },
    (review) => { review.dispositions.pop(); },
    (review) => { review.dispositions[0].disposition = "unresolved"; },
    (review) => { review.dispositions[0].disposition = "rejected"; },
    (review) => { review.dispositions.push(review.dispositions[0]); },
    (review) => { review.dispositions.push({ identifier: "extra-item", disposition: "accepted" }); },
  ]) {
    const review = acceptance(report);
    change(review);
    assert.equal(validatePersistenceRemovalHumanReview(report, review).ok, false);
  }
});

test("wrong target and changed required descriptor schema or migrations block removal", () => {
  for (const change of [
    (input) => { input.evidence.subject.descriptorVersion = "0.2.0"; },
    (input) => { input.evidence.subject.descriptorFingerprint = fingerprint("f"); },
    (input) => { input.evidence.subject.schemaFingerprint = fingerprint("f"); },
    (input) => { input.evidence.subject.migrationsFingerprint = fingerprint("f"); },
    (input) => { input.evidence.subject.databases[0].environment = "production"; },
    (input) => { input.evidence.databases[0].databaseId = "wrong-private-database"; },
    (input) => { input.evidence.databases[0].recovery.exportDigest = fingerprint("f"); },
    (input) => { input.evidence.subject.databases.push({ environment: "production", databaseId: "extra-private-database" }); },
  ]) {
    const input = inputFixture();
    change(input);
    const report = reviewPersistenceRemovalEvidence(input);
    assert.equal(report.recommendation, "blocked");
    assert.equal(validatePersistenceRemovalHumanReview(report, acceptance(report)).ok, false);
  }
});

test("independently computed digest mismatches block and claimed verified flags cannot substitute", () => {
  for (const index of [0, 1]) {
    const input = inputFixture();
    input.localArtifactDigests[index].digest = fingerprint("f");
    assert.equal(reviewPersistenceRemovalEvidence(input).recommendation, "blocked");
  }
  const input = inputFixture();
  input.evidence.databases[0].export.verified = true;
  assert.equal(reviewPersistenceRemovalEvidence(input).recommendation, "blocked");
});

test("missing evidence and unavailable outcomes or artifacts cannot be approved by absence", () => {
  for (const change of [
    (input) => { delete input.evidence; },
    (input) => { input.evidence.databases = []; },
    (input) => { delete input.evidence.databases[0].export; },
    (input) => { delete input.evidence.databases[0].recovery; },
    (input) => { delete input.evidence.databases[0].writeConsistency; },
    (input) => { delete input.evidence.databases[0].retention; },
    (input) => { input.evidence.databases[0].recovery.readback = "unavailable"; },
    (input) => { input.evidence.databases[0].export.outcome = "unavailable"; },
  ]) {
    const input = inputFixture();
    change(input);
    const report = reviewPersistenceRemovalEvidence(input);
    assert.equal(report.recommendation, "obtain-more-evidence");
    assert.ok(report.checks.some(({ status }) => status === "unavailable"));
    assert.equal(validatePersistenceRemovalHumanReview(report, acceptance(report)).ok, false);
  }
});

test("local recovery cannot satisfy required deployed recovery and reported deployed success remains human reviewed", () => {
  const input = inputFixture();
  input.policy.recoveryRequirements[0].scope = "deployed";
  assert.equal(reviewPersistenceRemovalEvidence(input).recommendation, "obtain-more-evidence");
  input.evidence.databases[0].recovery.scope = "deployed";
  const report = reviewPersistenceRemovalEvidence(input);
  assert.equal(report.recommendation, "ready-for-human-review");
  assert.ok(report.requiredReviewItems.some(({ reason }) => reason === "DEPLOYED_RECOVERY_IS_OPERATOR_REPORTED"));
  assert.ok(!report.checks.some(({ identifier, status }) => identifier === "recovery-outcome" && status === "verified-local"));
});

test("failed required recovery export retention or consistency checks block", () => {
  for (const change of [
    (input) => { input.evidence.databases[0].recovery.restoration = "failed"; },
    (input) => { input.evidence.databases[0].recovery.readback = "failed"; },
    (input) => { input.evidence.databases[0].export.outcome = "failed"; },
    (input) => { input.evidence.databases[0].retention.outcome = "failed"; },
    (input) => { input.evidence.databases[0].writeConsistency.outcome = "failed"; },
  ]) {
    const input = inputFixture();
    change(input);
    assert.equal(reviewPersistenceRemovalEvidence(input).recommendation, "blocked");
  }
});

test("explicit export retention and write policies govern readiness without a universal age limit", () => {
  const input = inputFixture();
  input.evidence.databases[0].export.completedAt = "2000-01-01T00:00:00Z";
  input.policy.exportNotBefore = "2000-01-01T00:00:00Z";
  assert.equal(reviewPersistenceRemovalEvidence(input).recommendation, "ready-for-human-review");
  for (const change of [
    (value) => { value.evidence.databases[0].export.completedAt = "2026-08-31T23:59:59Z"; },
    (value) => { value.evidence.databases[0].retention.retainedUntil = "2026-09-30T23:59:59Z"; },
    (value) => { value.evidence.databases[0].writeConsistency.mode = "post-export-writes-captured"; },
    (value) => { value.evidence.databases[0].export.completedAt = "2026-10-03T00:00:00Z"; },
  ]) {
    const value = inputFixture();
    change(value);
    assert.equal(reviewPersistenceRemovalEvidence(value).recommendation, "blocked");
  }
});

test("all bound input changes invalidate prior report acceptance", () => {
  const original = reviewPersistenceRemovalEvidence(inputFixture());
  for (const change of [
    (input) => { input.policy.retainUntil = "2026-10-02T00:00:00Z"; },
    (input) => { input.evidence.databases[0].export.completedAt = "2026-09-14T02:00:00Z"; },
    (input) => { input.expectedSubject.schemaFingerprint = fingerprint("f"); },
    (input) => { input.localArtifactDigests[0].digest = fingerprint("f"); },
  ]) {
    const input = inputFixture();
    change(input);
    const report = reviewPersistenceRemovalEvidence(input);
    assert.notEqual(report.reportFingerprint, original.reportFingerprint);
    assert.equal(validatePersistenceRemovalHumanReview(report, acceptance(original)).ok, false);
  }
});

test("strict bounded inputs and review output redact unknown fields and private values", () => {
  for (const change of [
    (input) => { input.evidence.privateExportPayload = "private-payload-marker"; },
    (input) => { input.evidence.databases[0].recovery.privateSecret = "private-secret-marker"; },
    (input) => { input.policy.recoveryRequirements[0].scope = "private-invalid-enum-marker"; },
    (input) => { delete input.expectedSubject; },
    (input) => { input.expectedSubject.databases.push(input.expectedSubject.databases[0]); },
    (input) => { input.localArtifactDigests.push(input.localArtifactDigests[0]); },
    (input) => { input.evidence.databases = Array.from({ length: 4 }, () => input.evidence.databases[0]); },
  ]) {
    const input = inputFixture();
    change(input);
    const report = reviewPersistenceRemovalEvidence(input);
    assert.equal(report.recommendation, "blocked");
    assert.doesNotMatch(JSON.stringify(report), /private-|privateExportPayload|privateSecret/);
  }
  const report = reviewPersistenceRemovalEvidence(inputFixture());
  assert.doesNotMatch(JSON.stringify(report), /private-/);
  const review = acceptance(report);
  review.explanation = "private-human-explanation";
  const result = validatePersistenceRemovalHumanReview(report, review);
  assert.equal(result.ok, false);
  assert.doesNotMatch(JSON.stringify(result), /private-human-explanation|explanation/);
});

test("assessment is deterministic canonical and does not mutate supplied input", () => {
  const input = inputFixture();
  const before = structuredClone(input);
  const first = reviewPersistenceRemovalEvidence(input);
  assert.deepEqual(input, before);
  assert.deepEqual(reviewPersistenceRemovalEvidence(input), first);
  const reordered = Object.fromEntries(Object.entries(input).reverse());
  assert.equal(reviewPersistenceRemovalEvidence(reordered).reportFingerprint, first.reportFingerprint);
  assert.match(first.reportFingerprint, /^sha256:[a-f0-9]{64}$/);
});

test("report tampering and malformed JavaScript input fail without leaking or throwing", () => {
  const report = reviewPersistenceRemovalEvidence(inputFixture());
  const changedReport = structuredClone(report);
  changedReport.requiredReviewItems.pop();
  assert.equal(validatePersistenceRemovalHumanReview(changedReport, acceptance(changedReport)).ok, false);
  const hostileInput = { get expectedSubject() { throw new Error("private-input-marker"); } };
  const result = reviewPersistenceRemovalEvidence(hostileInput);
  assert.equal(result.recommendation, "blocked");
  assert.doesNotMatch(JSON.stringify(result), /private-input-marker/);
  for (const invalid of [null, undefined, [], true, "private-invalid-marker"]) {
    assert.equal(reviewPersistenceRemovalEvidence(invalid).recommendation, "blocked");
  }
});

test("unavailable local artifact access requires explicit human disposition without claiming local verification", () => {
  const input = inputFixture();
  delete input.localArtifactDigests;
  const report = reviewPersistenceRemovalEvidence(input);
  assert.equal(report.recommendation, "ready-for-human-review");
  assert.equal(report.checks.filter(({ reason, status }) => reason === "LOCAL_ARTIFACT_UNAVAILABLE" && status === "unavailable").length, 2);
  assert.ok(!report.checks.some(({ reason }) => reason === "LOCAL_DIGEST_MATCHED"));
  const review = acceptance(report);
  assert.equal(validatePersistenceRemovalHumanReview(report, review).ok, true);
  review.dispositions = review.dispositions.filter(({ identifier }) => !identifier.endsWith("export-artifact-digest"));
  assert.equal(validatePersistenceRemovalHumanReview(report, review).ok, false);
});

test("mixed environments require exact independent recovery policy coverage", () => {
  const input = inputFixture();
  input.expectedSubject.databases = [
    { environment: "local", databaseId: "private-local-database" },
    { environment: "staging", databaseId: "private-database-target" },
    { environment: "production", databaseId: "private-production-database" },
  ];
  input.evidence.subject = structuredClone(input.expectedSubject);
  const evidence = input.evidence.databases[0];
  input.evidence.databases = input.expectedSubject.databases.map((identity) => ({
    ...structuredClone(evidence), ...identity,
    recovery: { ...evidence.recovery, scope: identity.environment === "local" ? "local" : "deployed" },
  }));
  input.policy.recoveryRequirements = [
    { environment: "local", scope: "local" },
    { environment: "staging", scope: "deployed" },
    { environment: "production", scope: "deployed" },
  ];
  assert.equal(reviewPersistenceRemovalEvidence(input).recommendation, "ready-for-human-review");
  input.evidence.databases[2].recovery.scope = "local";
  assert.equal(reviewPersistenceRemovalEvidence(input).recommendation, "obtain-more-evidence");
  for (const change of [
    (value) => { value.policy.recoveryRequirements.pop(); },
    (value) => { value.policy.recoveryRequirements.push(value.policy.recoveryRequirements[0]); },
    (value) => { value.expectedSubject.databases[0].environment = "custom-environment"; },
  ]) {
    const value = structuredClone(input);
    change(value);
    assert.equal(reviewPersistenceRemovalEvidence(value).recommendation, "blocked");
  }
});
