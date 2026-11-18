import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import * as core from "../dist/index.js";
import { requiredEvidence } from "./certification-contracts.mjs";

const evidencePath =
  "docs/implementation-evidence/example-certification-verification.md";
const evidenceRevision = "636df53958c0e3421b7f493d83493724b67b41f3";
const descriptorDigests = Object.freeze({
  "analytics": "sha256:5a8ac0ab5ae5b7adbd020c96f209c05d7ebe084215393a5a1f4293fe0480184b",
  "app-foundation": "sha256:2557256a72b6a62257298dcbafd587430b899285ef999141f45c1b9da91a749f",
  "application-persistence": "sha256:07740afcd637972b0de5cf5c538e697ae09a901eb52409eac30533a04d8374c7",
  "background-job-delivery": "sha256:7f42f615f573bc8594bbec10ea6b1cfca1d4317a616c6bbb7e2d4b68b9c8aa79",
  "booking-calendly": "sha256:fd15608c0b956074a64aec1f48782851dfd0297421abb7e250b30612e644ac08",
  "contact-form-web3forms": "sha256:004b30987fb775d1942ed7facf0460c259518a6df4b004438716c4c815245e07",
  "content-files": "sha256:0e6519573a119a1e09b90421189c55ec81422382c8bd10429f977e1e129029c4",
  "deployment-cloudflare": "sha256:a415ac2d81272c6fe57dde554465c9120282df75e209de8796725f2f52844fe6",
  "multilingual": "sha256:48a3ac0f39e8f356fbc9bc63b95f2d4fb7d334aee8cbef0726800ee10fbd9891",
  "observability": "sha256:1da86ce88e9257fc0d33dfb0a9f379919c32b58f1337c4b4ae9699ded0770a16",
  "section-composition": "sha256:9f9830fd6fc0674d3851e42ca6b7f3a14b2182b60a994bc470399043b98b771e",
  "site-routing": "sha256:989b092f5d02af02fecde9cd06545119588bd2c6e684c4df52e85dc3ffc62ebb",
  "standards": "sha256:109efca6d92a045a6e3fb8b70d7f25d34b80a4b3911d23d722ff3196566df188",
  "transactional-email-resend": "sha256:77f32ddd9faf0886553ae2f40a9f5b19e16dd8b4cf9b8864169fbf7ebfc5a85f"
});
const descriptorVersions = Object.freeze({
  "analytics": "0.2.0",
  "app-foundation": "0.3.0",
  "application-persistence": "0.2.0",
  "background-job-delivery": "0.3.0",
  "booking-calendly": "0.2.0",
  "contact-form-web3forms": "0.2.0",
  "content-files": "0.4.0",
  "deployment-cloudflare": "0.12.0",
  "multilingual": "0.1.0",
  "observability": "0.4.0",
  "section-composition": "0.3.0",
  "site-routing": "0.5.0",
  "standards": "0.10.0",
  "transactional-email-resend": "0.2.0"
});
const expectedIdentifiers = Object.freeze([
  "analytics",
  "app-foundation",
  "application-persistence",
  "background-job-delivery",
  "booking-calendly",
  "contact-form-web3forms",
  "content-files",
  "deployment-cloudflare",
  "multilingual",
  "observability",
  "section-composition",
  "site-routing",
  "standards",
  "transactional-email-resend",
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
    taskPlan: identifier === "background-job-delivery"
      ? "docs/superpowers/plans/capability-repairs/2026-11-15-background-job-reliability-composition-plan.md"
      : "docs/superpowers/plans/2026-11-04-environment-generation-certification-handoff.md",
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

  assert.equal(core.createCapabilityCatalogSnapshot(core.verifiedCapabilityPackageVersions, {
    standards: "0.4.0", siteRouting: "0.4.0", appFoundation: "0.1.0",
  }).ok, false);

  const defaultCatalog = assertSuccess(core.createCapabilityCatalogSnapshot(
    core.verifiedCapabilityPackageVersions, core.createGenerationRenderingContext().catalogSnapshot,
  ));
  assert.equal(defaultCatalog.some(({ identifier }) => identifier === "application-persistence"), false);
  assert.deepEqual(core.createCertificationSubject(defaultCatalog.find(({ identifier }) => identifier === "standards"), requiredEvidence.standards), {
    descriptorVersion: "0.9.0",
    behaviorContractDigest: "sha256:278d07e3e3d57cff287b3fefed0e067f6023c530401dd901b3bdb31c91e1551c",
  });
  assert.deepEqual(core.createCertificationSubject(defaultCatalog.find(({ identifier }) => identifier === "deployment-cloudflare"), requiredEvidence["deployment-cloudflare"]), {
    descriptorVersion: "0.9.0",
    behaviorContractDigest: "sha256:8868b0a7241f9891d2e03ec676fbfc31c80d1bbddfc0b9c0ee16b642104afd5f",
  });
  assert.equal(defaultCatalog.find(({ identifier }) => identifier === "deployment-cloudflare").version, "0.9.0");
  assert.notDeepEqual(
    core.createCertificationSubject(defaultCatalog.find(({ identifier }) => identifier === "standards"), requiredEvidence.standards),
    registry.records.standards.subject,
  );

  const bookingDescriptor = descriptorsByIdentifier.get("booking-calendly");
  assert.notEqual(bookingDescriptor, undefined);
  assert.notEqual(
    core.createCertificationSubject(bookingDescriptor, ["fresh-scaffold"])
      .behaviorContractDigest,
    descriptorDigests["booking-calendly"],
  );
});

test("current certification requires renewal for every changed generation consumer", () => {
  assert.deepEqual(Object.keys(committedRegistry.records), expectedIdentifiers);
  assert.deepEqual(Object.keys(requiredEvidence), expectedIdentifiers);
  for (const [identifier, record] of Object.entries(committedRegistry.records)) {
    assert.deepEqual(record, createRecord(identifier), identifier);
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
    [registry.records.standards.taskPlan]: "# current generation certification renewal",
    [registry.records["background-job-delivery"].taskPlan]: "# current jobs recovery and composition certification renewal",
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

test("closure rejects every pending subject and accepts complete certification", () => {
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

test("hosted contact cannot borrow email evidence or omit provider and cleanup outcomes", () => {
  const contact = createRecord("contact-form-web3forms");
  const email = createRecord("transactional-email-resend");
  for (const omitted of ["provider-confirmed", "cleanup-recovery"]) {
    const invalid = {...contact, status:"certified", evidence:evidenceFor(contact).filter(entry=>entry.kind!==omitted)};
    assert.equal(core.certificationRegistrySchema.safeParse({schemaVersion:"1.0.0",records:{"contact-form-web3forms":invalid}}).success,false);
  }
  const borrowed = {...contact, status:"certified", evidence:evidenceFor(email)};
  assert.equal(core.certificationRegistrySchema.safeParse({schemaVersion:"1.0.0",records:{"contact-form-web3forms":borrowed}}).success,false);
  const changed = structuredClone(contact);changed.subject.behaviorContractDigest=`sha256:${"0".repeat(64)}`;
  const candidates = cloneRegistry();candidates.records["contact-form-web3forms"]=changed;
  assert.equal(core.validateCertificationAdmission({catalog,registry:candidates}).ok,false);
  assert.equal(core.validateCertificationClosure({catalog,registry:committedRegistry}).ok,false);
});

test("renewed deployment admission requires a new plan and its private artifact", () => {
  const acceptedRegistry = structuredClone(committedRegistry);
  acceptedRegistry.records["deployment-cloudflare"] = {
    ...acceptedRegistry.records["deployment-cloudflare"],
    subject: {
      descriptorVersion: "0.6.0",
      behaviorContractDigest: "sha256:55c727c3636b4405e489d6e65d5b435228f50b1ef6ede51293d44556137576fd",
    },
    taskPlan: "docs/superpowers/plans/2026-09-24-job-lifecycle-operator-certification.md",
  };
  assert.deepEqual(core.validateCertificationAdmission({ catalog, registry: committedRegistry, acceptedRegistry }), {
    ok: true,
    value: undefined,
  });
  const stalePlan = structuredClone(committedRegistry);
  stalePlan.records["deployment-cloudflare"].taskPlan = acceptedRegistry.records["deployment-cloudflare"].taskPlan;
  const refused = core.validateCertificationAdmission({ catalog, registry: stalePlan, acceptedRegistry });
  assert.equal(refused.ok, false);
  assert.equal(refused.issues.some(({ code }) => code === "CERTIFICATION_TASK_PLAN_RENEWAL_REQUIRED"), true);

  const record = committedRegistry.records["deployment-cloudflare"];
  const selected = { schemaVersion: "1.0.0", records: { "deployment-cloudflare": record } };
  assert.deepEqual(core.validateCertificationArtifacts({
    registry: selected,
    artifacts: { [record.taskPlan]: "# Pending deployment certification renewal" },
    validRevisions: [],
  }), { ok: true, value: undefined });
  const missing = core.validateCertificationArtifacts({ registry: selected, artifacts: {}, validRevisions: [] });
  assert.equal(missing.ok, false);
  assert.equal(missing.issues[0].code, "CERTIFICATION_TASK_PLAN_MISSING");
});

test("renewed persistence admission requires a new plan and its private artifact", () => {
  const acceptedRegistry = structuredClone(committedRegistry);
  acceptedRegistry.records["application-persistence"] = {
    ...acceptedRegistry.records["application-persistence"],
    subject: {
      descriptorVersion: "0.1.0",
      behaviorContractDigest: "sha256:dcb911f024f4a0cf792396bf919e2387f0193fae6608071c6dea7aa371eb4c95",
    },
    taskPlan: "docs/superpowers/plans/2026-09-14-application-persistence-certification.md",
  };
  assert.deepEqual(core.validateCertificationAdmission({ catalog, registry: committedRegistry, acceptedRegistry }), {
    ok: true,
    value: undefined,
  });
  const stalePlan = structuredClone(committedRegistry);
  stalePlan.records["application-persistence"].taskPlan = acceptedRegistry.records["application-persistence"].taskPlan;
  const refused = core.validateCertificationAdmission({ catalog, registry: stalePlan, acceptedRegistry });
  assert.equal(refused.ok, false);
  assert.equal(refused.issues.some(({ code }) => code === "CERTIFICATION_TASK_PLAN_RENEWAL_REQUIRED"), true);

  const record = committedRegistry.records["application-persistence"];
  const selected = { schemaVersion: "1.0.0", records: { "application-persistence": record } };
  assert.deepEqual(core.validateCertificationArtifacts({
    registry: selected,
    artifacts: { [record.taskPlan]: "# Pending persistence certification renewal" },
    validRevisions: [],
  }), { ok: true, value: undefined });
  const missing = core.validateCertificationArtifacts({ registry: selected, artifacts: {}, validRevisions: [] });
  assert.equal(missing.ok, false);
  assert.equal(missing.issues[0].code, "CERTIFICATION_TASK_PLAN_MISSING");
});
