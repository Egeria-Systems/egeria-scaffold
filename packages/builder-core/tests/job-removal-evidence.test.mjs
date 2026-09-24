import assert from "node:assert/strict";
import test from "node:test";
import * as core from "../dist/index.js";

test("job removal rejects malformed evidence without exposing input", () => {
  const report = core.reviewJobRemovalEvidence({secret: "private-identity"});
  assert.equal(report.recommendation, "blocked");
  assert.equal(JSON.stringify(report).includes("private-identity"), false);
  assert.equal(core.validateJobRemovalHumanReview(report, {reportFingerprint: report.reportFingerprint, dispositions: report.requiredReviewItems.map(({identifier}) => ({identifier, disposition:"accepted"}))}).ok, false);
});

const fingerprint = (character) => `sha256:${character.repeat(64)}`;
const now = () => "2026-09-24T15:00:00.000Z";
function completeInput() {
  const identity = {environment:"staging", accountId:"private-account", primaryQueueId:"private-primary", deadLetterQueueId:"private-dead-letter"};
  const expectedSubject = {descriptorVersion:"0.2.0", descriptorFingerprint:fingerprint("a"), configurationFingerprint:fingerprint("b"), handlerFingerprint:fingerprint("c"), sourceRevision:"d".repeat(40), resources:[identity]};
  const disposition = {disposition:"drain", outcome:"passed", workRemaining:false};
  return {expectedSubject, evidence:{schemaVersion:"1.0.0", subject:expectedSubject, deploymentInventory:{local:"not-provisioned",staging:"present",production:"not-provisioned"}, observedAt:"2026-09-24T14:55:00.000Z", expiresAt:"2026-09-24T15:10:00.000Z", resources:[{identity, producerStop:"passed", primary:{...disposition}, inFlight:{...disposition}, delayed:{...disposition}, deadLetter:{...disposition}, retentionSeconds:86400, operationLimits:{maxMessages:100,maxDurationSeconds:300}}]}};
}
function accept(report) { return {reportFingerprint:report.reportFingerprint, dispositions:report.requiredReviewItems.map(({identifier}) => ({identifier,disposition:"accepted"}))}; }
test("reviewed remote disposition remains operator reported and exact human coverage is mandatory", () => {
  const input = completeInput();
  const report = core.reviewJobRemovalEvidence(input, now);
  assert.equal(report.recommendation, "ready-for-human-review");
  assert.equal(core.validateJobRemovalHumanReview(report, accept(report)).ok, true);
  assert.equal(report.checks.find(({identifier}) => identifier === "primary").status, "operator-reported");
  assert.equal(JSON.stringify(report).includes("private-"), false);
  for (const mutate of [review => review.dispositions.pop(), review => review.dispositions.push(review.dispositions[0]), review => review.dispositions[0].disposition="unresolved", review => review.reportFingerprint=fingerprint("e")]) {
    const review = accept(report); mutate(review);
    assert.equal(core.validateJobRemovalHumanReview(report, review).ok, false);
  }
  const later = core.reviewJobRemovalEvidence(input, () => "2026-09-24T15:01:00.000Z");
  assert.equal(later.reportFingerprint, report.reportFingerprint);
  const stale = core.reviewJobRemovalEvidence(input, () => input.evidence.expiresAt);
  assert.equal(stale.recommendation, "blocked");
  assert.equal(core.validateJobRemovalHumanReview(stale, accept(stale)).ok, false);
});
test("unknown, incomplete, stale and mismatched dispositions cannot be human overridden", () => {
  for (const mutate of [
    input => input.evidence.subject.sourceRevision="e".repeat(40),
    input => input.evidence.resources[0].identity.environment="production",
    input => input.evidence.resources[0].producerStop="unavailable",
    input => input.evidence.resources[0].primary.disposition="unknown",
    input => input.evidence.resources[0].delayed.workRemaining=true,
    input => input.evidence.resources[0].deadLetter.outcome="failed",
    input => input.evidence.observedAt="2026-09-24T15:01:00.000Z",
    input => input.evidence.expiresAt="2026-09-24T14:59:00.000Z",
  ]) {
    const input=completeInput(); input.evidence=structuredClone(input.evidence); mutate(input);
    const report=core.reviewJobRemovalEvidence(input,now);
    assert.equal(report.recommendation,"blocked",JSON.stringify(report));
    assert.equal(core.validateJobRemovalHumanReview(report,accept(report)).ok,false);
  }
});
test("retained work requires original expiry and compatible deployed consumer recovery", () => {
  const input=completeInput(); const resource=input.evidence.resources[0];
  resource.deadLetter={disposition:"retain",outcome:"passed",workRemaining:true,originalEnqueuedAt:"2026-09-24T12:00:00.000Z",originalExpiresAt:"2026-09-25T12:00:00.000Z"};
  assert.equal(core.reviewJobRemovalEvidence(input,now).recommendation,"blocked");
  resource.compatibleConsumer={deployed:true,descriptorVersion:"0.2.0",handlerFingerprint:input.expectedSubject.handlerFingerprint,recoveryOwner:"operator-team",preservesOriginalIdentity:true};
  assert.equal(core.reviewJobRemovalEvidence(input,now).recommendation,"ready-for-human-review");
  for(const mutate of [r=>r.compatibleConsumer.descriptorVersion="0.1.0",r=>r.compatibleConsumer.handlerFingerprint=fingerprint("f"),r=>r.deadLetter.originalExpiresAt="2026-09-25T12:00:01.000Z",r=>r.deadLetter.originalExpiresAt="2026-09-24T15:05:00.000Z"]) {
    const changed=structuredClone(input); mutate(changed.evidence.resources[0]);
    assert.equal(core.reviewJobRemovalEvidence(changed,now).recommendation,"blocked");
  }
});
test("supplied local audit artifacts must exist, match and refer to the evidence", () => {
  const input=completeInput(); input.evidence.resources[0].audit={reference:"private-audit",digest:fingerprint("f")};
  input.requiredLocalArtifactReferences=["private-audit"];
  assert.equal(core.reviewJobRemovalEvidence(input,now).recommendation,"blocked");
  input.localArtifactDigests=[{reference:"private-audit",digest:fingerprint("f")}];
  assert.equal(core.reviewJobRemovalEvidence(input,now).recommendation,"ready-for-human-review");
  input.localArtifactDigests[0].digest=fingerprint("e");
  assert.equal(core.reviewJobRemovalEvidence(input,now).recommendation,"blocked");
  input.requiredLocalArtifactReferences=["unrelated"];
  assert.equal(core.reviewJobRemovalEvidence(input,now).recommendation,"blocked");
});

test("removal refuses omitted, unknown or unmatched deployment coverage", () => {
  for (const mutate of [input=>delete input.evidence.deploymentInventory, input=>input.evidence.deploymentInventory.production="unknown", input=>input.evidence.deploymentInventory.production="present",input=>input.evidence.deploymentInventory.staging="not-provisioned"]) {
    const input=completeInput(); mutate(input);
    const report=core.reviewJobRemovalEvidence(input,now);
    assert.equal(report.recommendation,"blocked");
    assert.equal(core.validateJobRemovalHumanReview(report,accept(report)).ok,false);
  }
});

function unprovisionedInput() {
  const input = completeInput();
  input.expectedSubject.resources = [];
  input.evidence.resources = [];
  input.evidence.deploymentInventory = {local:"not-provisioned",staging:"not-provisioned",production:"not-provisioned"};
  return input;
}

test("empty resource inventory permits only fresh fully reviewed unprovisioned removal", () => {
  const input = unprovisionedInput();
  const report = core.reviewJobRemovalEvidence(input, now);
  assert.equal(report.recommendation, "ready-for-human-review");
  assert.ok(report.requiredReviewItems.some(({identifier}) => identifier === "deployment-inventory-completeness"));
  assert.equal(core.validateJobRemovalHumanReview(report, accept(report)).ok, true);
  const incomplete = accept(report);
  incomplete.dispositions = incomplete.dispositions.filter(({identifier}) => identifier !== "deployment-inventory-completeness");
  assert.equal(core.validateJobRemovalHumanReview(report, incomplete).ok, false);
  assert.equal(core.reviewJobRemovalEvidence(input, () => input.evidence.expiresAt).recommendation, "blocked");
  for (const environment of ["local", "staging", "production"]) {
    for (const disposition of ["present", "unknown", undefined]) {
      const changed = unprovisionedInput();
      if (disposition === undefined) delete changed.evidence.deploymentInventory[environment];
      else changed.evidence.deploymentInventory[environment] = disposition;
      const refused = core.reviewJobRemovalEvidence(changed, now);
      assert.equal(refused.recommendation, "blocked");
      assert.equal(core.validateJobRemovalHumanReview(refused, accept(refused)).ok, false);
    }
  }
  const missingProvisionedEvidence = completeInput();
  missingProvisionedEvidence.evidence.resources = [];
  assert.equal(core.reviewJobRemovalEvidence(missingProvisionedEvidence, now).recommendation, "blocked");
  const mismatchedSubject = unprovisionedInput();
  mismatchedSubject.evidence = structuredClone(mismatchedSubject.evidence);
  mismatchedSubject.evidence.subject.resources = completeInput().expectedSubject.resources;
  assert.equal(core.reviewJobRemovalEvidence(mismatchedSubject, now).recommendation, "blocked");
  const missingEvidence = core.reviewJobRemovalEvidence({expectedSubject:input.expectedSubject}, now);
  assert.equal(missingEvidence.recommendation, "obtain-more-evidence");
  assert.equal(core.validateJobRemovalHumanReview(missingEvidence, accept(missingEvidence)).ok, false);
});
