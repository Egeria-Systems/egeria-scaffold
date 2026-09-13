import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import * as core from "../dist/index.js";
import { requiredEvidence } from "./certification-contracts.mjs";

const coordinatedPlanPath =
  "docs/superpowers/plans/2026-09-05-effect-app-foundation-certification.md";
const evidencePath =
  "docs/implementation-evidence/example-certification-verification.md";
const evidenceRevision = "636df53958c0e3421b7f493d83493724b67b41f3";
const descriptorDigests = Object.freeze({
  analytics:
    "sha256:6c562317c6888a0c4a1b14bb2d7320f309b7c6ac3927a4b94cb3e9365ae01bba",
  "app-foundation":
    "sha256:6d9cf389441064a96d2b47bb309becab37358fcc2952335feffae8720eb6f497",
  "booking-calendly":
    "sha256:f9ee03e776da520af1bef7079a12454fd5339205f04d9836a424d5011da1bdca",
  "content-files":
    "sha256:0e6519573a119a1e09b90421189c55ec81422382c8bd10429f977e1e129029c4",
  "deployment-cloudflare":
    "sha256:fb2464553830b052428773286689dc91984d662bf999b267aefbcb66e045ed6e",
  multilingual:
    "sha256:48a3ac0f39e8f356fbc9bc63b95f2d4fb7d334aee8cbef0726800ee10fbd9891",
  observability:
    "sha256:0fa9530d9b2b6de0438cadd400a80909e8f55a5cb6c3d7b3ecc59724088c5f43",
  "section-composition":
    "sha256:9f9830fd6fc0674d3851e42ca6b7f3a14b2182b60a994bc470399043b98b771e",
  "site-routing":
    "sha256:a8bd53e9b32546266efd3dde9dc96fc3914cb06e9e811b8bf96ebd42822e2dac",
  standards:
    "sha256:56a667594f2cbf43beed6e23471e4d8bf28fcbbf54d6f13530191153c84d4de9",
});
const descriptorVersions = Object.freeze({
  analytics: "0.1.0",
  "app-foundation": "0.1.0",
  "booking-calendly": "0.1.0",
  "content-files": "0.4.0",
  "deployment-cloudflare": "0.3.0",
  multilingual: "0.1.0",
  observability: "0.3.0",
  "section-composition": "0.3.0",
  "site-routing": "0.4.0",
  standards: "0.5.0",
});
const expectedIdentifiers = Object.freeze([
  "analytics",
  "app-foundation",
  "booking-calendly",
  "content-files",
  "deployment-cloudflare",
  "multilingual",
  "observability",
  "section-composition",
  "site-routing",
  "standards",
]);
const committedRegistry = JSON.parse(
  readFileSync(
    new URL("../../../certifications/capabilities.json", import.meta.url),
    "utf8",
  ),
);

function assertSuccess(result) {
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  return result.value;
}

const catalog = assertSuccess(core.createVerifiedCapabilityCatalog());
const descriptorsByIdentifier = new Map(
  catalog.map((descriptor) => [descriptor.identifier, descriptor]),
);

function createRecord(identifier) {
  return {
    subject: {
      descriptorVersion: descriptorVersions[identifier],
      behaviorContractDigest: descriptorDigests[identifier],
    },
    requiredEvidence: requiredEvidence[identifier],
    status: "pending",
    taskPlan: identifier === "standards" ? "docs/superpowers/plans/2026-09-12-vitest-five-migration.md" : coordinatedPlanPath,
    evidence: [],
  };
}

const registry = {
  schemaVersion: "1.0.0",
  records: Object.fromEntries(
    expectedIdentifiers.map((identifier) => [identifier, createRecord(identifier)]),
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

function createEvidenceDocument({
  passed = "fresh-scaffold",
  reviewed = "fresh-scaffold",
  status = "complete",
  decision = "accepted",
  unresolvedPrompts = "none",
  revision = evidenceRevision,
} = {}) {
  const subject = registry.records["booking-calendly"].subject;

  return [
    "**Certification capability:** `booking-calendly`",
    `**Certification descriptor version:** \`${subject.descriptorVersion}\``,
    `**Certification behavior-contract digest:** \`${subject.behaviorContractDigest}\``,
    `**Certification evidence revision:** \`${revision}\``,
    `**Passed certification outcomes:** \`${passed}\``,
    `**Reviewed certification outcomes:** \`${reviewed}\``,
    `**Certification receipt status:** \`${status}\``,
    `**Certification reviewer decision:** \`${decision}\``,
    `**Certification unresolved prompts:** \`${unresolvedPrompts}\``,
  ].join("\n");
}

test("the registry contract is strict, sorted, and status-aware", () => {
  assert.deepEqual(core.certificationRegistrySchema.parse(registry), registry);

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
});

test("certification subjects bind the descriptor and required evidence", () => {
  for (const identifier of expectedIdentifiers) {
    const descriptor = descriptorsByIdentifier.get(identifier);
    assert.notEqual(descriptor, undefined, identifier);
    assert.deepEqual(
      core.createCertificationSubject(descriptor, requiredEvidence[identifier]),
      registry.records[identifier].subject,
      identifier,
    );
  }

  const retainedCatalog = assertSuccess(core.createCapabilityCatalogSnapshot(core.verifiedCapabilityPackageVersions, core.vitestFourCapabilityCatalogSnapshot));
  assert.deepEqual(core.createCertificationSubject(retainedCatalog.find(({ identifier }) => identifier === "standards"), requiredEvidence.standards), {
    descriptorVersion: "0.4.0",
    behaviorContractDigest: "sha256:640d95879a1e40e8fe26cf350453e01ead9fd031f30d53c4dd64552046449607",
  });

  const bookingDescriptor = descriptorsByIdentifier.get("booking-calendly");
  assert.notEqual(bookingDescriptor, undefined);
  assert.notEqual(
    core.createCertificationSubject(bookingDescriptor, ["fresh-scaffold"])
      .behaviorContractDigest,
    descriptorDigests["booking-calendly"],
  );
});

test("coordinated pending certification covers every current app foundation subject", () => {
  assert.deepEqual(Object.keys(committedRegistry.records), expectedIdentifiers);
  assert.deepEqual(Object.keys(requiredEvidence), expectedIdentifiers);
  assert.deepEqual(committedRegistry, registry);

  for (const [identifier, record] of Object.entries(committedRegistry.records)) {
    assert.equal(record.status, "pending");
    assert.equal(record.taskPlan, identifier === "standards" ? "docs/superpowers/plans/2026-09-12-vitest-five-migration.md" : coordinatedPlanPath);
    assert.deepEqual(record.evidence, []);
  }
});

test("descriptor admission accepts pending subjects and rejects missing, stale, and extra coverage", () => {
  assert.deepEqual(core.validateCertificationAdmission({ catalog, registry }), {
    ok: true,
    value: undefined,
  });

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
  assert.equal(
    core.validateCertificationAdmission({ catalog, registry: staleVersion })
      .issues[0].code,
    "CERTIFICATION_SUBJECT_VERSION_MISMATCH",
  );

  const staleDigest = cloneRegistry();
  staleDigest.records["booking-calendly"].subject.behaviorContractDigest =
    `sha256:${"0".repeat(64)}`;
  assert.equal(
    core.validateCertificationAdmission({ catalog, registry: staleDigest })
      .issues[0].code,
    "CERTIFICATION_SUBJECT_DIGEST_MISMATCH",
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
});

test("repository artifacts bind evidence to its plan, subject, revision, and reviewed outcome", () => {
  const recorded = cloneRegistry();
  const booking = recorded.records["booking-calendly"];
  booking.evidence = evidenceFor(booking, ["fresh-scaffold"]);
  const artifacts = {
    [coordinatedPlanPath]: "# approved plan",
    [registry.records.standards.taskPlan]: "# approved standards migration plan",
    [evidencePath]: createEvidenceDocument(),
  };

  assert.deepEqual(
    core.validateCertificationArtifacts({
      registry: recorded,
      artifacts,
      validRevisions: [evidenceRevision],
    }),
    { ok: true, value: undefined },
  );

  const missingPlan = cloneRegistry();
  missingPlan.records["booking-calendly"].taskPlan =
    "docs/superpowers/plans/missing-certification.md";
  assert.deepEqual(
    core.validateCertificationArtifacts({
      registry: missingPlan,
      artifacts,
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

  const unknownRevision = cloneRegistry();
  unknownRevision.records["booking-calendly"].evidence = evidenceFor(
    unknownRevision.records["booking-calendly"],
    ["fresh-scaffold"],
  ).map((evidence) => ({ ...evidence, revision: "0".repeat(40) }));
  assert.equal(
    core.validateCertificationArtifacts({
      registry: unknownRevision,
      artifacts: {
        ...artifacts,
        [evidencePath]: createEvidenceDocument({ revision: "0".repeat(40) }),
      },
      validRevisions: [evidenceRevision],
    }).issues[0].code,
    "CERTIFICATION_EVIDENCE_REVISION_UNKNOWN",
  );

  const incomplete = cloneRegistry();
  incomplete.records["booking-calendly"].evidence = evidenceFor(
    incomplete.records["booking-calendly"],
    ["fresh-scaffold"],
  );
  assert.deepEqual(
    core.validateCertificationArtifacts({
      registry: incomplete,
      artifacts: {
        ...artifacts,
        [evidencePath]: createEvidenceDocument({
          status: "incomplete",
          decision: "rejected",
          unresolvedPrompts: "present",
        }),
      },
      validRevisions: [evidenceRevision],
    }).issues.map(({ code }) => code),
    [
      "CERTIFICATION_EVIDENCE_RECEIPT_INCOMPLETE",
      "CERTIFICATION_EVIDENCE_REVIEW_REJECTED",
      "CERTIFICATION_EVIDENCE_PROMPTS_UNRESOLVED",
    ],
  );

  const mismatchedReview = cloneRegistry();
  mismatchedReview.records["booking-calendly"].evidence = evidenceFor(
    mismatchedReview.records["booking-calendly"],
    ["fresh-scaffold"],
  );
  assert.equal(
    core.validateCertificationArtifacts({
      registry: mismatchedReview,
      artifacts: {
        ...artifacts,
        [evidencePath]: createEvidenceDocument({
          reviewed: "deployed-application",
        }),
      },
      validRevisions: [evidenceRevision],
    }).issues[0].code,
    "CERTIFICATION_EVIDENCE_REVIEW_OUTCOME_MISMATCH",
  );

  const mismatchedPassedOutcome = cloneRegistry();
  mismatchedPassedOutcome.records["booking-calendly"].evidence = evidenceFor(
    mismatchedPassedOutcome.records["booking-calendly"],
    ["fresh-scaffold"],
  );
  assert.deepEqual(
    core.validateCertificationArtifacts({
      registry: mismatchedPassedOutcome,
      artifacts: {
        ...artifacts,
        [evidencePath]: createEvidenceDocument({
          passed: "deployed-application",
        }),
      },
      validRevisions: [evidenceRevision],
    }).issues,
    [
      {
        code: "CERTIFICATION_EVIDENCE_OUTCOME_MISMATCH",
        path: [
          "records",
          "booking-calendly",
          "evidence",
          0,
          "kind",
        ],
        context: { reason: "not-passed-by-artifact" },
      },
    ],
  );
});

test("closure rejects all ten pending subjects and accepts complete certification", () => {
  assert.deepEqual(
    core.validateCertificationClosure({ registry }).issues,
    expectedIdentifiers.map((identifier) => ({
      code: "CAPABILITY_CERTIFICATION_PENDING",
      path: ["records", identifier, "status"],
      context: { reason: "pending" },
    })),
  );

  const allCertified = cloneRegistry();
  for (const record of Object.values(allCertified.records)) {
    record.status = "certified";
    record.evidence = evidenceFor(record);
  }
  assert.deepEqual(
    core.certificationRegistrySchema.parse(allCertified),
    allCertified,
  );
  assert.deepEqual(core.validateCertificationClosure({ registry: allCertified }), {
    ok: true,
    value: undefined,
  });
});
