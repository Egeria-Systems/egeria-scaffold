import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import * as core from "../dist/index.js";
import { requiredEvidence } from "./certification-contracts.mjs";

const planPath =
  "docs/superpowers/plans/2026-08-24-booking-calendly-lifecycle-certification.md";
const evidencePath =
  "docs/implementation-evidence/2026-08-10-booking-calendly-certification-verification.md";
const evidenceRevision = "636df53958c0e3421b7f493d83493724b67b41f3";
const bookingLifecycleEvidencePath =
  "docs/implementation-evidence/2026-08-24-booking-calendly-lifecycle-certification-verification.md";
const bookingLifecycleEvidenceRevision =
  "b30e10b86b9ac9ef8dfdf1e8fa8e4077e2abe059";
const bookingProviderEvidencePath =
  "docs/implementation-evidence/2026-08-24-booking-calendly-lifecycle-provider-receipt.md";
const bookingProviderEvidenceRevision =
  "f9bd78f115c2118afd6dcc17ce49b2bfe34ca10d";
const observabilityPlanPath =
  "docs/superpowers/plans/2026-08-12-observability-error-diagnostics-certification.md";
const observabilityEvidencePath =
  "docs/implementation-evidence/2026-08-16-observability-error-diagnostics-certification-receipt.md";
const observabilityEvidenceRevision =
  "bdcc55f1bfa6eca392ce3e36bdc35adb6f085bad";
const standardsPlanPath =
  "docs/superpowers/plans/2026-08-19-generated-visual-regression-certification.md";
const standardsEvidencePath =
  "docs/implementation-evidence/2026-08-20-generated-visual-regression-certification-receipt.md";
const standardsEvidenceRevision =
  "416e2c2441978ac86f3a17dee96a694141033e20";
const deploymentPlanPath =
  "docs/superpowers/plans/2026-08-18-generated-cloudflare-deployment-certification.md";
const deploymentEvidencePath =
  "docs/implementation-evidence/2026-08-18-generated-cloudflare-deployment-certification-receipt.md";
const deploymentEvidenceRevision =
  "ea5a8ae8a6b0aa5fd7b8bc3bab3e03a52242aee2";
const committedRegistry = JSON.parse(
  readFileSync(
    new URL("../../../certifications/capabilities.json", import.meta.url),
    "utf8",
  ),
);

const descriptorDigests = Object.freeze({
  "booking-calendly":
    "sha256:ee498aac3a9701829ea9345a3281958e6e05f22941a85896dac3b239b0f452f2",
  "content-files":
    "sha256:5ae35debef622dc0fb9eeee3889e79a72fd6ff28eb730865bfe95e8674c9ff05",
  "deployment-cloudflare":
    "sha256:1690cf9bb12e33a07ea2b91f125cdec62d1d302f35bcc7d533c6a89797481d41",
  observability:
    "sha256:24a3cb3361cd8f72a12a1926b512e087adb31ad120a62b70e06a68d9dcf90c99",
  "section-composition":
    "sha256:4f63f9d6169048b5a1f5b1d042b3a0ddaa22ca1273d1acadf6235ce93e616696",
  "site-routing":
    "sha256:d716a1c93f8f40db33e54612c85d521fbd6ba13cd142d35ab0c39fa9c4b9647e",
  standards:
    "sha256:be53fdace61b6782e7f0abbbc0af7c333f81122f3a62fcfc7eb0ac687b2ff2fb",
});

function createEvidenceDocument({
  capability = "booking-calendly",
  descriptorVersion = "0.1.0",
  behaviorContractDigest = descriptorDigests["booking-calendly"],
  revision = evidenceRevision,
  passed = "fresh-scaffold",
  reviewed = "fresh-scaffold",
  status = "complete",
  decision = "accepted",
  unresolvedPrompts = "none",
  additionalLines = [],
} = {}) {
  return [
    `**Certification capability:** \`${capability}\``,
    `**Certification descriptor version:** \`${descriptorVersion}\``,
    `**Certification behavior-contract digest:** \`${behaviorContractDigest}\``,
    `**Certification evidence revision:** \`${revision}\``,
    `**Passed certification outcomes:** \`${passed}\``,
    `**Reviewed certification outcomes:** \`${reviewed}\``,
    `**Certification receipt status:** \`${status}\``,
    `**Certification reviewer decision:** \`${decision}\``,
    `**Certification unresolved prompts:** \`${unresolvedPrompts}\``,
    ...additionalLines,
  ].join("\n");
}

const evidenceDocumentSource = createEvidenceDocument();

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
      : identifier === "deployment-cloudflare"
        ? deploymentPlanPath
        : identifier === "observability"
          ? observabilityPlanPath
          : identifier === "standards"
            ? standardsPlanPath
            : null;

  return {
    subject: {
      descriptorVersion: descriptor.version,
      behaviorContractDigest:
        identifier === "standards"
          ? core.createCertificationSubject(
              descriptor,
              requiredEvidence[identifier],
            ).behaviorContractDigest
          : descriptorDigests[identifier],
    },
    requiredEvidence: requiredEvidence[identifier],
    status:
      identifier === "booking-calendly" ||
      identifier === "deployment-cloudflare" ||
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
        "sha256:ee498aac3a9701829ea9345a3281958e6e05f22941a85896dac3b239b0f452f2",
    },
  );

  assert.notEqual(
    core.createCertificationSubject(bookingDescriptor, ["fresh-scaffold"])
      .behaviorContractDigest,
    descriptorDigests["booking-calendly"],
  );
});

test("current Calendly lifecycle subject has exact reviewed certification evidence", () => {
  const bookingDescriptor = descriptorsByIdentifier.get("booking-calendly");
  assert.notEqual(bookingDescriptor, undefined);
  const subject = core.createCertificationSubject(
    bookingDescriptor,
    requiredEvidence["booking-calendly"],
  );

  assert.deepEqual(committedRegistry.records["booking-calendly"], {
    subject,
    requiredEvidence: [
      "cleanup-recovery",
      "deployed-application",
      "existing-repository-lifecycle",
      "fresh-scaffold",
      "provider-confirmed",
    ],
    status: "certified",
    taskPlan: planPath,
    evidence: [
      {
        kind: "cleanup-recovery",
        path: bookingProviderEvidencePath,
        outcome: "passed",
        revision: bookingProviderEvidenceRevision,
        subject,
      },
      {
        kind: "deployed-application",
        path: bookingProviderEvidencePath,
        outcome: "passed",
        revision: bookingProviderEvidenceRevision,
        subject,
      },
      {
        kind: "existing-repository-lifecycle",
        path: bookingLifecycleEvidencePath,
        outcome: "passed",
        revision: bookingLifecycleEvidenceRevision,
        subject,
      },
      {
        kind: "fresh-scaffold",
        path: bookingLifecycleEvidencePath,
        outcome: "passed",
        revision: bookingLifecycleEvidenceRevision,
        subject,
      },
      {
        kind: "provider-confirmed",
        path: bookingProviderEvidencePath,
        outcome: "passed",
        revision: bookingProviderEvidenceRevision,
        subject,
      },
    ],
  });
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

test("material observability diagnostics have exact reviewed certification evidence", () => {
  const observabilityDescriptor = descriptorsByIdentifier.get("observability");
  assert.notEqual(observabilityDescriptor, undefined);
  const observabilityRecord = committedRegistry.records.observability;
  const subject = core.createCertificationSubject(
    observabilityDescriptor,
    requiredEvidence.observability,
  );

  assert.equal(observabilityDescriptor.version, "0.3.0");
  assert.deepEqual(observabilityRecord, {
    subject,
    requiredEvidence: requiredEvidence.observability,
    status: "certified",
    taskPlan: observabilityPlanPath,
    evidence: requiredEvidence.observability.map((kind) => ({
      kind,
      path: observabilityEvidencePath,
      outcome: "passed",
      revision: observabilityEvidenceRevision,
      subject,
    })),
  });
  const acceptedReceiptUrl = new URL(
    `../../../${observabilityEvidencePath}`,
    import.meta.url,
  );
  assert.equal(existsSync(acceptedReceiptUrl), true, observabilityEvidencePath);
  assert.deepEqual(
    core.validateCertificationArtifacts({
      registry: {
        schemaVersion: "1.0.0",
        records: { observability: observabilityRecord },
      },
      artifacts: {
        [deploymentPlanPath]: "# approved plan",
        [observabilityPlanPath]: "# approved plan",
        [observabilityEvidencePath]: readFileSync(acceptedReceiptUrl, "utf8"),
      },
      validRevisions: [observabilityEvidenceRevision],
    }),
    { ok: true, value: undefined },
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

test("material visual testing changes have exact accepted certification evidence", () => {
  const standardsDescriptor = descriptorsByIdentifier.get("standards");
  assert.notEqual(standardsDescriptor, undefined);

  const subject = core.createCertificationSubject(standardsDescriptor, [
    "fresh-scaffold",
  ]);

  assert.equal(standardsDescriptor.version, "0.4.0");
  assert.notEqual(
    subject.behaviorContractDigest,
    descriptorDigests.standards,
  );
  assert.deepEqual(committedRegistry.records.standards, {
    subject,
    requiredEvidence: ["fresh-scaffold"],
    status: "certified",
    taskPlan: standardsPlanPath,
    evidence: [
      {
        kind: "fresh-scaffold",
        path: standardsEvidencePath,
        outcome: "passed",
        revision: standardsEvidenceRevision,
        subject,
      },
    ],
  });
});

test("accepted visual standards receipt binds the reviewed fresh-scaffold outcome", () => {
  const standardsDescriptor = descriptorsByIdentifier.get("standards");
  assert.notEqual(standardsDescriptor, undefined);

  const subject = core.createCertificationSubject(standardsDescriptor, [
    "fresh-scaffold",
  ]);
  const acceptedRecord = {
    subject,
    requiredEvidence: ["fresh-scaffold"],
    status: "certified",
    taskPlan: standardsPlanPath,
    evidence: [
      {
        kind: "fresh-scaffold",
        path: standardsEvidencePath,
        outcome: "passed",
        revision: standardsEvidenceRevision,
        subject,
      },
    ],
  };
  const acceptedReceiptUrl = new URL(
    `../../../${standardsEvidencePath}`,
    import.meta.url,
  );

  assert.equal(existsSync(acceptedReceiptUrl), true, standardsEvidencePath);
  assert.deepEqual(
    core.validateCertificationArtifacts({
      registry: {
        schemaVersion: "1.0.0",
        records: { standards: acceptedRecord },
      },
      artifacts: {
        [standardsPlanPath]: "# approved plan",
        [standardsEvidencePath]: readFileSync(acceptedReceiptUrl, "utf8"),
      },
      validRevisions: [standardsEvidenceRevision],
    }),
    { ok: true, value: undefined },
  );
});

test("material generated deployment changes have exact reviewed certification evidence", () => {
  const deploymentRecord = committedRegistry.records["deployment-cloudflare"];

  assert.equal(deploymentRecord.subject.descriptorVersion, "0.3.0");
  assert.match(
    deploymentRecord.subject.behaviorContractDigest,
    /^sha256:[0-9a-f]{64}$/u,
  );
  assert.deepEqual(deploymentRecord.requiredEvidence, [
    "cleanup-recovery",
    "deployed-application",
    "fresh-scaffold",
  ]);
  assert.equal(deploymentRecord.status, "certified");
  assert.equal(deploymentRecord.taskPlan, deploymentPlanPath);
  assert.deepEqual(
    deploymentRecord.evidence.map(({ kind, path, outcome, revision }) => ({
      kind,
      path,
      outcome,
      revision,
    })),
    ["cleanup-recovery", "deployed-application", "fresh-scaffold"].map(
      (kind) => ({
        kind,
        path: deploymentEvidencePath,
        outcome: "passed",
        revision: deploymentEvidenceRevision,
      }),
    ),
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
        [deploymentPlanPath]: "# approved plan",
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
        [deploymentPlanPath]: "# approved plan",
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
        [deploymentPlanPath]: "# approved plan",
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
        [deploymentPlanPath]: "# approved plan",
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
  const incompleteReceipt = createEvidenceDocument({
    status: "incomplete",
    decision: "rejected",
    unresolvedPrompts: "present",
    additionalLines: ["- Remaining evidence: [replace before review]"],
  });

  assert.deepEqual(
    core.validateCertificationArtifacts({
      registry: recorded,
      artifacts: {
        [deploymentPlanPath]: "# approved plan",
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
  const mismatchedReview = createEvidenceDocument({
    reviewed: "deployed-application",
  });

  assert.deepEqual(
    core.validateCertificationArtifacts({
      registry: recorded,
      artifacts: {
        [deploymentPlanPath]: "# approved plan",
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
        path: ["records", "deployment-cloudflare", "status"],
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
        path: ["records", "deployment-cloudflare", "status"],
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
