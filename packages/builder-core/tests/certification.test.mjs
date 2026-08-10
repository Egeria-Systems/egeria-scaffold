import assert from "node:assert/strict";
import test from "node:test";

import * as core from "../dist/index.js";

const planPath =
  "docs/superpowers/plans/2026-08-10-booking-calendly-certification.md";
const evidencePath =
  "docs/implementation-evidence/2026-08-10-booking-calendly-certification-verification.md";

const descriptorDigests = Object.freeze({
  "booking-calendly":
    "sha256:339462dc3cc43065aeeb2eabc0556960d07c4c6b3e1e13738715fc7e0cedc8ab",
  "content-files":
    "sha256:5ae35debef622dc0fb9eeee3889e79a72fd6ff28eb730865bfe95e8674c9ff05",
  "deployment-cloudflare":
    "sha256:846ae45d15ba9d8f256a9b7a1d8a4f3cda1b871a3b3f79f7656fd621050e8273",
  observability:
    "sha256:1f070bdb531d8bcec8a7ebf5b081cde8466dcd0d72d5f16b5a5a3ac2bd65af93",
  "section-composition":
    "sha256:4f63f9d6169048b5a1f5b1d042b3a0ddaa22ca1273d1acadf6235ce93e616696",
  "site-routing":
    "sha256:d716a1c93f8f40db33e54612c85d521fbd6ba13cd142d35ab0c39fa9c4b9647e",
  standards:
    "sha256:a3a020b778c1ccfa24e0bfc951fcdf5eb74b50728f69e960124c6bae6a757311",
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

  return {
    subject: {
      descriptorVersion: descriptor.version,
      behaviorContractDigest: descriptorDigests[identifier],
    },
    requiredEvidence: requiredEvidence[identifier],
    status: identifier === "booking-calendly" ? "pending" : "backfill-pending",
    taskPlan: identifier === "booking-calendly" ? planPath : null,
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

function evidenceFor(record) {
  return record.requiredEvidence.map((kind) => ({ kind, path: evidencePath }));
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
    { kind: "unrequired-outcome", path: evidencePath },
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
  assert.deepEqual(
    core.validateCertificationClosure({
      registry: currentCertified,
      policy: "legacy-backfill-exempt",
    }),
    { ok: true, value: undefined },
  );
  assert.equal(
    core.validateCertificationClosure({
      registry: currentCertified,
      policy: "all-certified",
    }).issues.length,
    6,
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
