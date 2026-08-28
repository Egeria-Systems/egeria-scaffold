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
  "docs/superpowers/plans/2026-08-25-standards-lifecycle-certification.md";
const standardsEvidencePath =
  "docs/implementation-evidence/2026-08-25-standards-lifecycle-certification-receipt.md";
const standardsEvidenceRevision =
  "d7f9dac6e25d5dde32015968d0912b45e73644e7";
const contentFilesPlanPath =
  "docs/superpowers/plans/2026-08-25-content-files-certification.md";
const contentFilesEvidencePath =
  "docs/implementation-evidence/2026-08-25-content-files-certification-receipt.md";
const contentFilesEvidenceRevision =
  "f03b9f624c370728f678924ce34e5287558d2a87";
const sectionCompositionPlanPath =
  "docs/superpowers/plans/2026-08-26-section-composition-certification.md";
const sectionCompositionEvidencePath =
  "docs/implementation-evidence/2026-08-26-section-composition-certification-receipt.md";
const sectionCompositionEvidenceRevision =
  "f74459c8833833186bb651c116ed524e51044677";
const siteRoutingPlanPath =
  "docs/superpowers/plans/2026-08-26-production-site-routing-certification.md";
const siteRoutingEvidencePath =
  "docs/implementation-evidence/2026-08-26-production-site-routing-certification-receipt.md";
const siteRoutingEvidenceRevision =
  "6034d7330af912d1a1b9bcff3323ed360ebee2d0";
const historicalSiteRoutingEvidencePath =
  "docs/implementation-evidence/2026-08-26-site-routing-certification-receipt.md";
const historicalSiteRoutingEvidenceRevision =
  "77cea944513e521939bf4de088048f67acdfbc3c";
const deploymentPlanPath =
  "docs/superpowers/plans/2026-08-18-generated-cloudflare-deployment-certification.md";
const multilingualPlanPath =
  "docs/superpowers/plans/2026-08-27-multilingual-certification.md";
const multilingualEvidencePath =
  "docs/implementation-evidence/2026-08-27-multilingual-certification-receipt.md";
const multilingualEvidenceRevision =
  "96b587a254cf6fc859867d6fc66c7e0c900c4cfd";
const analyticsPlanPath =
  "docs/superpowers/plans/2026-08-27-analytics-capability-certification.md";
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
const previousAnalyticsDescriptorDigest =
  "sha256:e9386b318b0c42e3bc05ccb0f9077bacd833d3211e4d61371a12ed8fef473833";

const descriptorDigests = Object.freeze({
  analytics:
    "sha256:ca2e69a35e935eab011f0543fdf140e644a0dec490650298bdfba730e2e9d378",
  "booking-calendly":
    "sha256:ee498aac3a9701829ea9345a3281958e6e05f22941a85896dac3b239b0f452f2",
  "content-files":
    "sha256:5ae35debef622dc0fb9eeee3889e79a72fd6ff28eb730865bfe95e8674c9ff05",
  "deployment-cloudflare":
    "sha256:1690cf9bb12e33a07ea2b91f125cdec62d1d302f35bcc7d533c6a89797481d41",
  multilingual:
    "sha256:016afd467349fde8ffeb821fe672cf60004f8e10916141c4f3837a81afcb1d41",
  observability:
    "sha256:24a3cb3361cd8f72a12a1926b512e087adb31ad120a62b70e06a68d9dcf90c99",
  "section-composition":
    "sha256:4f63f9d6169048b5a1f5b1d042b3a0ddaa22ca1273d1acadf6235ce93e616696",
  "site-routing":
    "sha256:17e62c4468bc05480828d23471b63afc29e19eb6a9bff07eee1f99d30cd7b3e3",
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
    identifier === "analytics"
      ? analyticsPlanPath
      : identifier === "booking-calendly"
      ? planPath
      : identifier === "deployment-cloudflare"
        ? deploymentPlanPath
        : identifier === "multilingual"
          ? multilingualPlanPath
        : identifier === "observability"
          ? observabilityPlanPath
          : identifier === "site-routing"
            ? siteRoutingPlanPath
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
      identifier === "analytics" ||
      identifier === "booking-calendly" ||
      identifier === "deployment-cloudflare" ||
      identifier === "multilingual" ||
      identifier === "observability" ||
      identifier === "site-routing" ||
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

test("current content files subject has exact reviewed fresh-scaffold evidence", () => {
  const descriptor = descriptorsByIdentifier.get("content-files");
  assert.notEqual(descriptor, undefined);
  const subject = core.createCertificationSubject(
    descriptor,
    requiredEvidence["content-files"],
  );

  assert.deepEqual(committedRegistry.records["content-files"], {
    subject,
    requiredEvidence: ["fresh-scaffold"],
    status: "certified",
    taskPlan: contentFilesPlanPath,
    evidence: [
      {
        kind: "fresh-scaffold",
        path: contentFilesEvidencePath,
        outcome: "passed",
        revision: contentFilesEvidenceRevision,
        subject,
      },
    ],
  });
});

test("accepted content files receipt binds the reviewed fresh-scaffold outcome", () => {
  const acceptedRecord = committedRegistry.records["content-files"];
  const acceptedReceiptUrl = new URL(
    `../../../${contentFilesEvidencePath}`,
    import.meta.url,
  );

  assert.equal(existsSync(acceptedReceiptUrl), true, contentFilesEvidencePath);
  assert.deepEqual(
    core.validateCertificationArtifacts({
      registry: {
        schemaVersion: "1.0.0",
        records: { "content-files": acceptedRecord },
      },
      artifacts: {
        [contentFilesPlanPath]: "# approved plan",
        [contentFilesEvidencePath]: readFileSync(acceptedReceiptUrl, "utf8"),
      },
      validRevisions: [contentFilesEvidenceRevision],
    }),
    { ok: true, value: undefined },
  );
});

test("current section composition subject has exact reviewed fresh-scaffold evidence", () => {
  const descriptor = descriptorsByIdentifier.get("section-composition");
  assert.notEqual(descriptor, undefined);
  const subject = core.createCertificationSubject(
    descriptor,
    requiredEvidence["section-composition"],
  );

  assert.deepEqual(committedRegistry.records["section-composition"], {
    subject,
    requiredEvidence: ["fresh-scaffold"],
    status: "certified",
    taskPlan: sectionCompositionPlanPath,
    evidence: [
      {
        kind: "fresh-scaffold",
        path: sectionCompositionEvidencePath,
        outcome: "passed",
        revision: sectionCompositionEvidenceRevision,
        subject,
      },
    ],
  });
});

test("accepted section composition receipt binds the reviewed fresh-scaffold outcome", () => {
  const acceptedRecord = committedRegistry.records["section-composition"];
  const acceptedReceiptUrl = new URL(
    `../../../${sectionCompositionEvidencePath}`,
    import.meta.url,
  );

  assert.equal(
    existsSync(acceptedReceiptUrl),
    true,
    sectionCompositionEvidencePath,
  );
  assert.deepEqual(
    core.validateCertificationArtifacts({
      registry: {
        schemaVersion: "1.0.0",
        records: { "section-composition": acceptedRecord },
      },
      artifacts: {
        [sectionCompositionPlanPath]: "# approved plan",
        [sectionCompositionEvidencePath]: readFileSync(
          acceptedReceiptUrl,
          "utf8",
        ),
      },
      validRevisions: [sectionCompositionEvidenceRevision],
    }),
    { ok: true, value: undefined },
  );
});

test("current production site routing subject has exact reviewed lifecycle and fresh-scaffold evidence", () => {
  const descriptor = descriptorsByIdentifier.get("site-routing");
  assert.notEqual(descriptor, undefined);
  const subject = core.createCertificationSubject(
    descriptor,
    requiredEvidence["site-routing"],
  );

  const acceptedRecord = {
    subject,
    requiredEvidence: ["existing-repository-lifecycle", "fresh-scaffold"],
    status: "certified",
    taskPlan: siteRoutingPlanPath,
    evidence: ["existing-repository-lifecycle", "fresh-scaffold"].map(
      (kind) => ({
        kind,
        path: siteRoutingEvidencePath,
        outcome: "passed",
        revision: siteRoutingEvidenceRevision,
        subject,
      }),
    ),
  };
  const acceptedReceiptUrl = new URL(
    `../../../${siteRoutingEvidencePath}`,
    import.meta.url,
  );

  assert.deepEqual(committedRegistry.records["site-routing"], acceptedRecord);
  assert.equal(existsSync(acceptedReceiptUrl), true, siteRoutingEvidencePath);
  assert.deepEqual(
    core.validateCertificationArtifacts({
      registry: {
        schemaVersion: "1.0.0",
        records: { "site-routing": acceptedRecord },
      },
      artifacts: {
        [siteRoutingPlanPath]: "# approved plan",
        [siteRoutingEvidencePath]: readFileSync(acceptedReceiptUrl, "utf8"),
      },
      validRevisions: [siteRoutingEvidenceRevision],
    }),
    { ok: true, value: undefined },
  );
});

test("current multilingual subject has exact reviewed lifecycle and fresh-scaffold evidence", () => {
  const descriptor = descriptorsByIdentifier.get("multilingual");
  assert.notEqual(descriptor, undefined);
  const subject = core.createCertificationSubject(
    descriptor,
    requiredEvidence.multilingual,
  );
  const acceptedRecord = {
    subject,
    requiredEvidence: ["existing-repository-lifecycle", "fresh-scaffold"],
    status: "certified",
    taskPlan: multilingualPlanPath,
    evidence: ["existing-repository-lifecycle", "fresh-scaffold"].map(
      (kind) => ({
        kind,
        path: multilingualEvidencePath,
        outcome: "passed",
        revision: multilingualEvidenceRevision,
        subject,
      }),
    ),
  };
  const acceptedReceiptUrl = new URL(
    `../../../${multilingualEvidencePath}`,
    import.meta.url,
  );

  assert.deepEqual(committedRegistry.records.multilingual, acceptedRecord);
  assert.equal(existsSync(acceptedReceiptUrl), true, multilingualEvidencePath);
  assert.deepEqual(
    core.validateCertificationArtifacts({
      registry: {
        schemaVersion: "1.0.0",
        records: { multilingual: acceptedRecord },
      },
      artifacts: {
        [multilingualPlanPath]: "# approved plan",
        [multilingualEvidencePath]: readFileSync(acceptedReceiptUrl, "utf8"),
      },
      validRevisions: [multilingualEvidenceRevision],
    }),
    { ok: true, value: undefined },
  );
});

test("current analytics subject is admitted only as pending certification", () => {
  const descriptor = descriptorsByIdentifier.get("analytics");
  assert.notEqual(descriptor, undefined);
  const subject = core.createCertificationSubject(
    descriptor,
    requiredEvidence.analytics,
  );
  const analyticsPlan = readFileSync(
    new URL(`../../../${analyticsPlanPath}`, import.meta.url),
    "utf8",
  );

  assert.equal(subject.descriptorVersion, "0.1.0");
  assert.notEqual(
    subject.behaviorContractDigest,
    previousAnalyticsDescriptorDigest,
  );
  assert.equal(committedRegistry.records.analytics.status, "pending");
  assert.deepEqual(committedRegistry.records.analytics.evidence, []);
  assert.deepEqual(committedRegistry.records.analytics, {
    subject,
    requiredEvidence: [
      "cleanup-recovery",
      "deployed-application",
      "existing-repository-lifecycle",
      "fresh-scaffold",
      "provider-confirmed",
    ],
    status: "pending",
    taskPlan: analyticsPlanPath,
    evidence: [],
  });
  assert.match(analyticsPlan, /Enable with JS Snippet installation/u);
  assert.match(analyticsPlan, /installation-mode.*readback/iu);
  assert.match(
    analyticsPlan,
    /zero.*\/cdn-cgi\/rum.*fresh denial.*persisted denial.*withdrawal.*reload/iu,
  );
  assert.match(analyticsPlan, /positive grant.*provider.*receipt/iu);
  assert.match(analyticsPlan, /Disable.*not.*repair/iu);
});

test("accepted site routing receipt binds the reviewed fresh-scaffold outcome", () => {
  const historicalSubject = {
    descriptorVersion: "0.3.0",
    behaviorContractDigest:
      "sha256:d716a1c93f8f40db33e54612c85d521fbd6ba13cd142d35ab0c39fa9c4b9647e",
  };
  const acceptedRecord = {
    subject: historicalSubject,
    requiredEvidence: ["fresh-scaffold"],
    status: "certified",
    taskPlan: "docs/superpowers/plans/2026-08-26-site-routing-certification.md",
    evidence: [
      {
        kind: "fresh-scaffold",
        path: historicalSiteRoutingEvidencePath,
        outcome: "passed",
        revision: historicalSiteRoutingEvidenceRevision,
        subject: historicalSubject,
      },
    ],
  };
  const acceptedReceiptUrl = new URL(
    `../../../${historicalSiteRoutingEvidencePath}`,
    import.meta.url,
  );

  assert.equal(
    existsSync(acceptedReceiptUrl),
    true,
    historicalSiteRoutingEvidencePath,
  );
  assert.deepEqual(
    core.validateCertificationArtifacts({
      registry: {
        schemaVersion: "1.0.0",
        records: { "site-routing": acceptedRecord },
      },
      artifacts: {
        [acceptedRecord.taskPlan]: "# approved plan",
        [historicalSiteRoutingEvidencePath]: readFileSync(
          acceptedReceiptUrl,
          "utf8",
        ),
      },
      validRevisions: [historicalSiteRoutingEvidenceRevision],
    }),
    { ok: true, value: undefined },
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

test("standards has exact accepted fresh-scaffold and lifecycle evidence", () => {
  const standardsDescriptor = descriptorsByIdentifier.get("standards");
  assert.notEqual(standardsDescriptor, undefined);

  const subject = core.createCertificationSubject(standardsDescriptor, [
    "existing-repository-lifecycle",
    "fresh-scaffold",
  ]);

  assert.equal(standardsDescriptor.version, "0.4.0");
  assert.notEqual(
    subject.behaviorContractDigest,
    descriptorDigests.standards,
  );
  assert.deepEqual(committedRegistry.records.standards, {
    subject,
    requiredEvidence: ["existing-repository-lifecycle", "fresh-scaffold"],
    status: "certified",
    taskPlan: standardsPlanPath,
    evidence: ["existing-repository-lifecycle", "fresh-scaffold"].map(
      (kind) => ({
        kind,
        path: standardsEvidencePath,
        outcome: "passed",
        revision: standardsEvidenceRevision,
        subject,
      }),
    ),
  });
});

test("accepted standards receipt binds the reviewed fresh-scaffold and lifecycle outcomes", () => {
  const standardsDescriptor = descriptorsByIdentifier.get("standards");
  assert.notEqual(standardsDescriptor, undefined);

  const subject = core.createCertificationSubject(standardsDescriptor, [
    "existing-repository-lifecycle",
    "fresh-scaffold",
  ]);
  const acceptedRecord = {
    subject,
    requiredEvidence: ["existing-repository-lifecycle", "fresh-scaffold"],
    status: "certified",
    taskPlan: standardsPlanPath,
    evidence: ["existing-repository-lifecycle", "fresh-scaffold"].map(
      (kind) => ({
        kind,
        path: standardsEvidencePath,
        outcome: "passed",
        revision: standardsEvidenceRevision,
        subject,
      }),
    ),
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
        [analyticsPlanPath]: "# approved plan",
        [deploymentPlanPath]: "# approved plan",
        [planPath]: "# approved plan",
        [observabilityPlanPath]: "# approved plan",
        [siteRoutingPlanPath]: "# approved plan",
        [multilingualPlanPath]: "# approved plan",
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
        [analyticsPlanPath]: "# approved plan",
        [deploymentPlanPath]: "# approved plan",
        [observabilityPlanPath]: "# approved plan",
        [siteRoutingPlanPath]: "# approved plan",
        [multilingualPlanPath]: "# approved plan",
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
        [analyticsPlanPath]: "# approved plan",
        [deploymentPlanPath]: "# approved plan",
        [planPath]: "# approved plan",
        [observabilityPlanPath]: "# approved plan",
        [siteRoutingPlanPath]: "# approved plan",
        [multilingualPlanPath]: "# approved plan",
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
        [analyticsPlanPath]: "# approved plan",
        [deploymentPlanPath]: "# approved plan",
        [planPath]: "# approved plan",
        [observabilityPlanPath]: "# approved plan",
        [siteRoutingPlanPath]: "# approved plan",
        [multilingualPlanPath]: "# approved plan",
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
        [analyticsPlanPath]: "# approved plan",
        [deploymentPlanPath]: "# approved plan",
        [planPath]: "# approved plan",
        [observabilityPlanPath]: "# approved plan",
        [siteRoutingPlanPath]: "# approved plan",
        [multilingualPlanPath]: "# approved plan",
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
        [analyticsPlanPath]: "# approved plan",
        [deploymentPlanPath]: "# approved plan",
        [planPath]: "# approved plan",
        [observabilityPlanPath]: "# approved plan",
        [siteRoutingPlanPath]: "# approved plan",
        [multilingualPlanPath]: "# approved plan",
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
        path: ["records", "analytics", "status"],
        context: { reason: "pending" },
      },
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
        path: ["records", "multilingual", "status"],
        context: { reason: "pending" },
      },
      {
        code: "CAPABILITY_CERTIFICATION_PENDING",
        path: ["records", "observability", "status"],
        context: { reason: "pending" },
      },
      {
        code: "CAPABILITY_CERTIFICATION_PENDING",
        path: ["records", "site-routing", "status"],
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
    9,
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
        path: ["records", "analytics", "status"],
        context: { reason: "pending" },
      },
      {
        code: "CAPABILITY_CERTIFICATION_PENDING",
        path: ["records", "deployment-cloudflare", "status"],
        context: { reason: "pending" },
      },
      {
        code: "CAPABILITY_CERTIFICATION_PENDING",
        path: ["records", "multilingual", "status"],
        context: { reason: "pending" },
      },
      {
        code: "CAPABILITY_CERTIFICATION_PENDING",
        path: ["records", "site-routing", "status"],
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
    7,
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
