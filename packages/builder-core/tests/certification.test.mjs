import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import * as core from "../dist/index.js";

const planPath =
  "docs/superpowers/plans/2026-08-10-booking-calendly-certification.md";
const evidencePath =
  "docs/implementation-evidence/2026-08-10-booking-calendly-certification-verification.md";
const evidenceRevision = "636df53958c0e3421b7f493d83493724b67b41f3";
const evidenceDocumentSource = readFileSync(
  new URL(`../../../${evidencePath}`, import.meta.url),
  "utf8",
);
const observabilityPlanPath =
  "docs/superpowers/plans/2026-08-10-production-observability-certification.md";
const standardsPlanPath =
  "docs/superpowers/plans/2026-08-10-generated-unit-component-testing-certification.md";
const committedRegistry = JSON.parse(
  readFileSync(
    new URL("../../../certifications/capabilities.json", import.meta.url),
    "utf8",
  ),
);

const descriptorDigests = Object.freeze({
  "booking-calendly":
    "sha256:339462dc3cc43065aeeb2eabc0556960d07c4c6b3e1e13738715fc7e0cedc8ab",
  "content-files":
    "sha256:5ae35debef622dc0fb9eeee3889e79a72fd6ff28eb730865bfe95e8674c9ff05",
  "deployment-cloudflare":
    "sha256:846ae45d15ba9d8f256a9b7a1d8a4f3cda1b871a3b3f79f7656fd621050e8273",
  observability:
    "sha256:a4f15a132e08da307ab412673b02152fee8509c0cc1dabb4b60856abd61f5d97",
  "section-composition":
    "sha256:4f63f9d6169048b5a1f5b1d042b3a0ddaa22ca1273d1acadf6235ce93e616696",
  "site-routing":
    "sha256:d716a1c93f8f40db33e54612c85d521fbd6ba13cd142d35ab0c39fa9c4b9647e",
  standards:
    "sha256:be53fdace61b6782e7f0abbbc0af7c333f81122f3a62fcfc7eb0ac687b2ff2fb",
});

const requiredEvidence = Object.freeze({
  "booking-calendly": Object.freeze([
    "cleanup-recovery",
    "deployed-application",
    "fresh-scaffold",
    "provider-confirmed",
  ]),
  "content-files": Object.freeze(["fresh-scaffold"]),
  "deployment-cloudflare": Object.freeze([
    "cleanup-recovery",
    "deployed-application",
    "fresh-scaffold",
  ]),
  observability: Object.freeze([
    "cleanup-recovery",
    "deployed-application",
    "fresh-scaffold",
  ]),
  "section-composition": Object.freeze(["fresh-scaffold"]),
  "site-routing": Object.freeze(["fresh-scaffold"]),
  standards: Object.freeze(["fresh-scaffold"]),
});

function assertSuccess(result) {
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  return result.value;
}

const catalog = assertSuccess(core.createVerifiedCapabilityCatalog());
const descriptorsByIdentifier = new Map(
  catalog.map((descriptor) => [descriptor.identifier, descriptor]),
);

function createRecord(identifier) {
  const descriptor = descriptorsByIdentifier.get(identifier);
  assert.notEqual(descriptor, undefined);

  const taskPlan =
    identifier === "booking-calendly"
      ? planPath
      : identifier === "observability"
        ? observabilityPlanPath
        : identifier === "standards"
          ? standardsPlanPath
        : null;

  return {
    subject: {
      descriptorVersion: descriptor.version,
      behaviorContractDigest: descriptorDigests[identifier],
    },
    requiredEvidence: requiredEvidence[identifier],
    status:
      identifier === "booking-calendly" ||
      identifier === "observability" ||
      identifier === "standards"
        ? "pending"
        : "backfill-pending",
    taskPlan,
    evidence: [],
  };
}

const registry = {
  schemaVersion: "1.0.0",
  records: Object.fromEntries(
    [...descriptorsByIdentifier.keys()]
      .toSorted()
      .map((identifier) => [identifier, createRecord(identifier)]),
  ),
};

function cloneRegistry() {
  return structuredClone(registry);
}

function evidenceFor(record, kinds = record.requiredEvidence) {
  return kinds.map((kind) => ({
    kind,
    path: evidencePath,
    outcome: "passed",
    revision: evidenceRevision,
    subject: structuredClone(record.subject),
  }));
}

test("the registry contract is strict, sorted, and status-aware", () => {
  assert.deepEqual(
    core.certificationRegistrySchema.parse(registry),
    registry,
  );

  for (const invalid of [
    { ...registry, unexpected: true },
    { ...registry, schemaVersion: "2.0.0" },
    {
      ...registry,
      records: { ...registry.records, "Unsafe Key": createRecord("standards") },
    },
  ]) {
    assert.equal(core.certificationRegistrySchema.safeParse(invalid).success, false);
  }

  const unsortedRequirements = cloneRegistry();
  unsortedRequirements.records["booking-calendly"].requiredEvidence.reverse();
  assert.equal(
    core.certificationRegistrySchema.safeParse(unsortedRequirements).success,
    false,
  );

  const uncoveredCertification = cloneRegistry();
  uncoveredCertification.records["booking-calendly"].status = "certified";
  assert.equal(
    core.certificationRegistrySchema.safeParse(uncoveredCertification).success,
    false,
  );

  const unplannedPending = cloneRegistry();
  unplannedPending.records["booking-calendly"].taskPlan = null;
  assert.equal(
    core.certificationRegistrySchema.safeParse(unplannedPending).success,
    false,
  );

  const unexpectedEvidence = cloneRegistry();
  unexpectedEvidence.records["booking-calendly"].evidence = [
    {
      ...evidenceFor(unexpectedEvidence.records["booking-calendly"], [
        "fresh-scaffold",
      ])[0],
      kind: "unrequired-outcome",
    },
  ];
  assert.equal(
    core.certificationRegistrySchema.safeParse(unexpectedEvidence).success,
    false,
  );
});

test("certification subjects bind the descriptor and required evidence", () => {
  const bookingDescriptor = descriptorsByIdentifier.get("booking-calendly");
  assert.notEqual(bookingDescriptor, undefined);

  assert.deepEqual(
    core.createCertificationSubject(
      bookingDescriptor,
      requiredEvidence["booking-calendly"],
    ),
    {
      descriptorVersion: "0.1.0",
      behaviorContractDigest:
        "sha256:339462dc3cc43065aeeb2eabc0556960d07c4c6b3e1e13738715fc7e0cedc8ab",
    },
  );

  assert.notEqual(
    core.createCertificationSubject(bookingDescriptor, ["fresh-scaffold"])
      .behaviorContractDigest,
    descriptorDigests["booking-calendly"],
  );
});

test("descriptor admission rejects incomplete, stale, extra, and false-legacy coverage", () => {
  assert.deepEqual(
    core.validateCertificationAdmission({ catalog, registry }),
    { ok: true, value: undefined },
  );

  const missing = cloneRegistry();
  delete missing.records["booking-calendly"];
  assert.deepEqual(
    core.validateCertificationAdmission({ catalog, registry: missing }).issues,
    [
      {
        code: "CERTIFICATION_RECORD_MISSING",
        path: ["records", "booking-calendly"],
        context: { reason: "missing" },
      },
    ],
  );

  const staleVersion = cloneRegistry();
  staleVersion.records["booking-calendly"].subject.descriptorVersion = "0.0.1";
  assert.deepEqual(
    core.validateCertificationAdmission({ catalog, registry: staleVersion })
      .issues,
    [
      {
        code: "CERTIFICATION_SUBJECT_VERSION_MISMATCH",
        path: ["records", "booking-calendly", "subject", "descriptorVersion"],
        context: { reason: "stale" },
      },
    ],
  );

  const staleDigest = cloneRegistry();
  staleDigest.records["booking-calendly"].subject.behaviorContractDigest = `sha256:${"0".repeat(64)}`;
  assert.deepEqual(
    core.validateCertificationAdmission({ catalog, registry: staleDigest })
      .issues,
    [
      {
        code: "CERTIFICATION_SUBJECT_DIGEST_MISMATCH",
        path: ["records", "booking-calendly", "subject", "behaviorContractDigest"],
        context: { reason: "stale" },
      },
    ],
  );

  const falseLegacy = cloneRegistry();
  falseLegacy.records["booking-calendly"].status = "backfill-pending";
  falseLegacy.records["booking-calendly"].taskPlan = null;
  assert.deepEqual(
    core.validateCertificationAdmission({ catalog, registry: falseLegacy })
      .issues,
    [
      {
        code: "CERTIFICATION_BACKFILL_NOT_ALLOWED",
        path: ["records", "booking-calendly", "status"],
        context: { reason: "not-legacy" },
      },
    ],
  );

  const extra = cloneRegistry();
  extra.records["unknown-capability"] = createRecord("standards");
  assert.deepEqual(
    core.validateCertificationAdmission({ catalog, registry: extra }).issues,
    [
      {
        code: "CERTIFICATION_RECORD_UNKNOWN",
        path: ["records", "unknown-capability"],
        context: { reason: "unknown" },
      },
    ],
  );

  const changedLegacyCatalog = catalog.map((descriptor) =>
    descriptor.identifier === "standards"
      ? { ...descriptor, version: "0.2.1" }
      : descriptor,
  );
  const changedLegacy = cloneRegistry();
  const changedStandards = changedLegacyCatalog.find(
    ({ identifier }) => identifier === "standards",
  );
  assert.notEqual(changedStandards, undefined);
  changedLegacy.records.standards.subject = core.createCertificationSubject(
    changedStandards,
    changedLegacy.records.standards.requiredEvidence,
  );
  changedLegacy.records.standards.status = "backfill-pending";
  changedLegacy.records.standards.taskPlan = null;
  assert.deepEqual(
    core.validateCertificationAdmission({
      catalog: changedLegacyCatalog,
      registry: changedLegacy,
    }).issues,
    [
      {
        code: "CERTIFICATION_BACKFILL_SUBJECT_MISMATCH",
        path: ["records", "standards", "subject"],
        context: { reason: "not-accepted-subject" },
      },
    ],
  );
  assert.deepEqual(
    core.validateCertificationClosure({
      registry: {
        schemaVersion: "1.0.0",
        records: { standards: changedLegacy.records.standards },
      },
      policy: "legacy-backfill-exempt",
    }).issues,
    [
      {
        code: "CAPABILITY_CERTIFICATION_PENDING",
        path: ["records", "standards", "status"],
        context: { reason: "backfill-pending" },
      },
    ],
  );
});

test("material observability remains pending with only reviewed fresh-scaffold evidence", () => {
  const observabilityDescriptor = descriptorsByIdentifier.get("observability");
  assert.notEqual(observabilityDescriptor, undefined);
  const observabilityRecord = committedRegistry.records.observability;

  assert.equal(observabilityDescriptor.version, "0.2.0");
  assert.deepEqual(observabilityRecord, {
    subject: core.createCertificationSubject(
      observabilityDescriptor,
      ["cleanup-recovery", "deployed-application", "fresh-scaffold"],
    ),
    requiredEvidence: [
      "cleanup-recovery",
      "deployed-application",
      "fresh-scaffold",
    ],
    status: "pending",
    taskPlan: observabilityPlanPath,
    evidence: [
      {
        kind: "fresh-scaffold",
        path: "docs/implementation-evidence/2026-08-11-production-observability-certification-verification.md",
        outcome: "passed",
        revision: "ef845b1e0551d3b43e17969cc00f21960c90769b",
        subject: core.createCertificationSubject(
          observabilityDescriptor,
          ["cleanup-recovery", "deployed-application", "fresh-scaffold"],
        ),
      },
    ],
  });
  assert.doesNotThrow(() =>
    readFileSync(new URL(`../../../${observabilityPlanPath}`, import.meta.url)),
  );

  const falseLegacy = structuredClone(committedRegistry);
  falseLegacy.records.observability.status = "backfill-pending";
  falseLegacy.records.observability.taskPlan = null;
  assert.deepEqual(
    core.validateCertificationAdmission({
      catalog,
      registry: falseLegacy,
    }).issues,
    [
      {
        code: "CERTIFICATION_BACKFILL_SUBJECT_MISMATCH",
        path: ["records", "observability", "subject"],
        context: { reason: "not-accepted-subject" },
      },
    ],
  );
});

test("material standards testing changes remain pending for separate certification", () => {
  const standardsDescriptor = descriptorsByIdentifier.get("standards");
  assert.notEqual(standardsDescriptor, undefined);

  assert.equal(standardsDescriptor.version, "0.3.0");
  assert.deepEqual(committedRegistry.records.standards, {
    subject: core.createCertificationSubject(standardsDescriptor, [
      "fresh-scaffold",
    ]),
    requiredEvidence: ["fresh-scaffold"],
    status: "pending",
    taskPlan: standardsPlanPath,
    evidence: [],
  });
  assert.doesNotThrow(() =>
    readFileSync(new URL(`../../../${standardsPlanPath}`, import.meta.url)),
  );
});

test("repository artifacts bind successful evidence to capability, subject, revision, and outcome", () => {
  const recorded = cloneRegistry();
  const booking = recorded.records["booking-calendly"];
  booking.evidence = evidenceFor(booking, ["fresh-scaffold"]);

  assert.deepEqual(
    core.validateCertificationArtifacts({
      registry: recorded,
      artifacts: {
        [planPath]: "# approved plan",
        [observabilityPlanPath]: "# approved plan",
        [standardsPlanPath]: "# approved plan",
        [evidencePath]: evidenceDocumentSource,
      },
      validRevisions: [evidenceRevision],
    }),
    { ok: true, value: undefined },
  );

  assert.deepEqual(
    core.validateCertificationArtifacts({
      registry: recorded,
      artifacts: {
        [observabilityPlanPath]: "# approved plan",
        [standardsPlanPath]: "# approved plan",
        [evidencePath]: evidenceDocumentSource,
      },
      validRevisions: [evidenceRevision],
    }).issues,
    [
      {
        code: "CERTIFICATION_TASK_PLAN_MISSING",
        path: ["records", "booking-calendly", "taskPlan"],
        context: { reason: "missing" },
      },
    ],
  );

  const relabeled = cloneRegistry();
  const relabeledBooking = relabeled.records["booking-calendly"];
  relabeledBooking.evidence = evidenceFor(relabeledBooking, [
    "deployed-application",
  ]);
  assert.deepEqual(
    core.validateCertificationArtifacts({
      registry: relabeled,
      artifacts: {
        [planPath]: "# approved plan",
        [observabilityPlanPath]: "# approved plan",
        [standardsPlanPath]: "# approved plan",
        [evidencePath]: evidenceDocumentSource,
      },
      validRevisions: [evidenceRevision],
    }).issues,
    [
      {
        code: "CERTIFICATION_EVIDENCE_OUTCOME_MISMATCH",
        path: ["records", "booking-calendly", "evidence", 0, "kind"],
        context: { reason: "not-passed-by-artifact" },
      },
      {
        code: "CERTIFICATION_EVIDENCE_REVIEW_OUTCOME_MISMATCH",
        path: ["records", "booking-calendly", "evidence", 0, "kind"],
        context: { reason: "not-accepted-by-review" },
      },
    ],
  );
});

test("repository artifacts reject revisions outside the checked Git history", () => {
  const recorded = cloneRegistry();
  const booking = recorded.records["booking-calendly"];
  const nonexistentRevision = "0".repeat(40);
  booking.evidence = evidenceFor(booking, ["fresh-scaffold"]).map(
    (evidence) => ({ ...evidence, revision: nonexistentRevision }),
  );

  const nonexistentRevisionDocument = evidenceDocumentSource.replace(
    evidenceRevision,
    nonexistentRevision,
  );

  assert.deepEqual(
    core.validateCertificationArtifacts({
      registry: recorded,
      artifacts: {
        [planPath]: "# approved plan",
        [observabilityPlanPath]: "# approved plan",
        [standardsPlanPath]: "# approved plan",
        [evidencePath]: nonexistentRevisionDocument,
      },
      validRevisions: [evidenceRevision],
    }).issues,
    [
      {
        code: "CERTIFICATION_EVIDENCE_REVISION_UNKNOWN",
        path: ["records", "booking-calendly", "evidence", 0, "revision"],
        context: { reason: "not-in-checked-history" },
      },
    ],
  );
});

test("repository artifacts reject incomplete or unresolved reviewer receipts", () => {
  const recorded = cloneRegistry();
  const booking = recorded.records["booking-calendly"];
  booking.evidence = evidenceFor(booking, ["fresh-scaffold"]);
  const incompleteReceipt = [
    "# Incomplete receipt",
    "",
    "**Certification capability:** `booking-calendly`",
    "",
    "**Certification descriptor version:** `0.1.0`",
    "",
    `**Certification behavior-contract digest:** \`${descriptorDigests["booking-calendly"]}\``,
    "",
    `**Certification evidence revision:** \`${evidenceRevision}\``,
    "",
    "**Passed certification outcomes:** `fresh-scaffold`",
    "",
    "**Reviewed certification outcomes:** `fresh-scaffold`",
    "",
    "**Certification receipt status:** `incomplete`",
    "",
    "**Certification reviewer decision:** `rejected`",
    "",
    "**Certification unresolved prompts:** `present`",
    "",
    "- Remaining evidence: [replace before review]",
  ].join("\n");

  assert.deepEqual(
    core.validateCertificationArtifacts({
      registry: recorded,
      artifacts: {
        [planPath]: "# approved plan",
        [observabilityPlanPath]: "# approved plan",
        [standardsPlanPath]: "# approved plan",
        [evidencePath]: incompleteReceipt,
      },
      validRevisions: [evidenceRevision],
    }).issues,
    [
      {
        code: "CERTIFICATION_EVIDENCE_RECEIPT_INCOMPLETE",
        path: ["records", "booking-calendly", "evidence", 0, "path"],
        context: { reason: "not-complete" },
      },
      {
        code: "CERTIFICATION_EVIDENCE_REVIEW_REJECTED",
        path: ["records", "booking-calendly", "evidence", 0, "path"],
        context: { reason: "not-accepted" },
      },
      {
        code: "CERTIFICATION_EVIDENCE_PROMPTS_UNRESOLVED",
        path: ["records", "booking-calendly", "evidence", 0, "path"],
        context: { reason: "unresolved" },
      },
    ],
  );
});

test("repository artifacts require affirmative review of every claimed outcome", () => {
  const recorded = cloneRegistry();
  const booking = recorded.records["booking-calendly"];
  booking.evidence = evidenceFor(booking, ["fresh-scaffold"]);
  const mismatchedReview = [
    "# Mismatched review",
    "",
    "**Certification capability:** `booking-calendly`",
    "",
    "**Certification descriptor version:** `0.1.0`",
    "",
    `**Certification behavior-contract digest:** \`${descriptorDigests["booking-calendly"]}\``,
    "",
    `**Certification evidence revision:** \`${evidenceRevision}\``,
    "",
    "**Passed certification outcomes:** `fresh-scaffold`",
    "",
    "**Reviewed certification outcomes:** `deployed-application`",
    "",
    "**Certification receipt status:** `complete`",
    "",
    "**Certification reviewer decision:** `accepted`",
    "",
    "**Certification unresolved prompts:** `none`",
  ].join("\n");

  assert.deepEqual(
    core.validateCertificationArtifacts({
      registry: recorded,
      artifacts: {
        [planPath]: "# approved plan",
        [observabilityPlanPath]: "# approved plan",
        [standardsPlanPath]: "# approved plan",
        [evidencePath]: mismatchedReview,
      },
      validRevisions: [evidenceRevision],
    }).issues,
    [
      {
        code: "CERTIFICATION_EVIDENCE_REVIEW_OUTCOME_MISMATCH",
        path: ["records", "booking-calendly", "evidence", 0, "kind"],
        context: { reason: "not-accepted-by-review" },
      },
    ],
  );
});

test("closure distinguishes the bounded legacy transition from full certification", () => {
  assert.deepEqual(
    core.validateCertificationClosure({
      registry,
      policy: "legacy-backfill-exempt",
    }).issues,
    [
      {
        code: "CAPABILITY_CERTIFICATION_PENDING",
        path: ["records", "booking-calendly", "status"],
        context: { reason: "pending" },
      },
      {
        code: "CAPABILITY_CERTIFICATION_PENDING",
        path: ["records", "observability", "status"],
        context: { reason: "pending" },
      },
      {
        code: "CAPABILITY_CERTIFICATION_PENDING",
        path: ["records", "standards", "status"],
        context: { reason: "pending" },
      },
    ],
  );
  assert.equal(
    core.validateCertificationClosure({ registry, policy: "all-certified" })
      .issues.length,
    7,
  );

  const currentCertified = cloneRegistry();
  currentCertified.records["booking-calendly"].status = "certified";
  currentCertified.records["booking-calendly"].evidence = evidenceFor(
    currentCertified.records["booking-calendly"],
  );
  currentCertified.records.observability.status = "certified";
  currentCertified.records.observability.evidence = evidenceFor(
    currentCertified.records.observability,
  );
  assert.deepEqual(
    core.validateCertificationClosure({
      registry: currentCertified,
      policy: "legacy-backfill-exempt",
    }).issues,
    [
      {
        code: "CAPABILITY_CERTIFICATION_PENDING",
        path: ["records", "standards", "status"],
        context: { reason: "pending" },
      },
    ],
  );
  assert.equal(
    core.validateCertificationClosure({
      registry: currentCertified,
      policy: "all-certified",
    }).issues.length,
    5,
  );

  const allCertified = cloneRegistry();
  for (const record of Object.values(allCertified.records)) {
    record.status = "certified";
    record.taskPlan = planPath;
    record.evidence = evidenceFor(record);
  }
  assert.deepEqual(
    core.certificationRegistrySchema.parse(allCertified),
    allCertified,
  );
  assert.deepEqual(
    core.validateCertificationClosure({
      registry: allCertified,
      policy: "all-certified",
    }),
    { ok: true, value: undefined },
  );
});
