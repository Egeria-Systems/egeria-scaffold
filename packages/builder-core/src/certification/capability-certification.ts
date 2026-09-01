import { createHash } from "node:crypto";

import type { CapabilityDescriptor } from "../contracts/capability.js";
import type {
  CapabilityCertificationRecord,
  CertificationRegistry,
  CertificationSubject,
} from "../contracts/certification.js";
import type {
  ContractIssue,
  ValidationResult,
} from "../contracts/result.js";
import { stringifyCanonicalJson } from "../serialization/canonical-json.js";

type CertificationArtifacts = Readonly<Record<string, string | undefined>>;

function issue(
  code: string,
  path: readonly (string | number)[],
  reason: string,
): ContractIssue {
  return { code, path, context: { reason } };
}

function certificationSubjectEquals(
  left: CertificationSubject,
  right: CertificationSubject,
): boolean {
  return (
    left.descriptorVersion === right.descriptorVersion &&
    left.behaviorContractDigest === right.behaviorContractDigest
  );
}

function readMetadata(document: string, label: string): string | undefined {
  const prefix = `**${label}:** \``;
  const line = document
    .split("\n")
    .find((candidate) => candidate.startsWith(prefix));

  return line?.endsWith("`") === true
    ? line.slice(prefix.length, -1)
    : undefined;
}

function includesUnresolvedPrompt(document: string): boolean {
  return document
    .split("\n")
    .some((line) => /:\s*\[[^\]\n]+\]\s*$/u.test(line));
}

function validateEvidenceArtifact(input: Readonly<{
  artifacts: CertificationArtifacts;
  identifier: string;
  record: CapabilityCertificationRecord;
  evidenceIndex: number;
  validRevisions: ReadonlySet<string>;
}>): readonly ContractIssue[] {
  const evidence = input.record.evidence[input.evidenceIndex];
  if (evidence === undefined) {
    return [];
  }
  const document = input.artifacts[evidence.path];
  const basePath = [
    "records",
    input.identifier,
    "evidence",
    input.evidenceIndex,
  ] as const;

  if (document === undefined) {
    return [
      issue(
        "CERTIFICATION_EVIDENCE_MISSING",
        [...basePath, "path"],
        "missing",
      ),
    ];
  }

  const outcomes = readMetadata(document, "Passed certification outcomes")
    ?.split(", ")
    .filter((value) => value.length > 0);
  const reviewedOutcomes = readMetadata(
    document,
    "Reviewed certification outcomes",
  )
    ?.split(", ")
    .filter((value) => value.length > 0);
  const checks: readonly Readonly<{
    actual: string | undefined;
    code: string;
    expected: string;
    path: readonly (string | number)[];
    reason: string;
  }>[] = [
    {
      actual: readMetadata(document, "Certification capability"),
      code: "CERTIFICATION_EVIDENCE_CAPABILITY_MISMATCH",
      expected: input.identifier,
      path: [...basePath, "path"],
      reason: "wrong-capability",
    },
    {
      actual: readMetadata(document, "Certification descriptor version"),
      code: "CERTIFICATION_EVIDENCE_SUBJECT_MISMATCH",
      expected: evidence.subject.descriptorVersion,
      path: [...basePath, "subject", "descriptorVersion"],
      reason: "wrong-subject",
    },
    {
      actual: readMetadata(
        document,
        "Certification behavior-contract digest",
      ),
      code: "CERTIFICATION_EVIDENCE_SUBJECT_MISMATCH",
      expected: evidence.subject.behaviorContractDigest,
      path: [...basePath, "subject", "behaviorContractDigest"],
      reason: "wrong-subject",
    },
    {
      actual: readMetadata(document, "Certification evidence revision"),
      code: "CERTIFICATION_EVIDENCE_REVISION_MISMATCH",
      expected: evidence.revision,
      path: [...basePath, "revision"],
      reason: "wrong-revision",
    },
  ];
  const issues = checks
    .filter(({ actual, expected }) => actual !== expected)
    .map(({ code, path, reason }) => issue(code, path, reason));

  if (outcomes?.includes(evidence.kind) !== true) {
    issues.push(
      issue(
        "CERTIFICATION_EVIDENCE_OUTCOME_MISMATCH",
        [...basePath, "kind"],
        "not-passed-by-artifact",
      ),
    );
  }
  if (reviewedOutcomes?.includes(evidence.kind) !== true) {
    issues.push(
      issue(
        "CERTIFICATION_EVIDENCE_REVIEW_OUTCOME_MISMATCH",
        [...basePath, "kind"],
        "not-accepted-by-review",
      ),
    );
  }
  if (readMetadata(document, "Certification receipt status") !== "complete") {
    issues.push(
      issue(
        "CERTIFICATION_EVIDENCE_RECEIPT_INCOMPLETE",
        [...basePath, "path"],
        "not-complete",
      ),
    );
  }
  if (
    readMetadata(document, "Certification reviewer decision") !== "accepted"
  ) {
    issues.push(
      issue(
        "CERTIFICATION_EVIDENCE_REVIEW_REJECTED",
        [...basePath, "path"],
        "not-accepted",
      ),
    );
  }
  if (
    readMetadata(document, "Certification unresolved prompts") !== "none" ||
    includesUnresolvedPrompt(document)
  ) {
    issues.push(
      issue(
        "CERTIFICATION_EVIDENCE_PROMPTS_UNRESOLVED",
        [...basePath, "path"],
        "unresolved",
      ),
    );
  }
  if (!input.validRevisions.has(evidence.revision)) {
    issues.push(
      issue(
        "CERTIFICATION_EVIDENCE_REVISION_UNKNOWN",
        [...basePath, "revision"],
        "not-in-checked-history",
      ),
    );
  }

  return issues;
}

export function validateCertificationArtifacts(input: Readonly<{
  registry: CertificationRegistry;
  artifacts: CertificationArtifacts;
  validRevisions: readonly string[];
}>): ValidationResult<void> {
  const validRevisions = new Set(input.validRevisions);
  const issues = Object.entries(input.registry.records)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .flatMap(([identifier, record]) => {
      const recordIssues: ContractIssue[] = [];
      if (input.artifacts[record.taskPlan] === undefined) {
        recordIssues.push(
          issue(
            "CERTIFICATION_TASK_PLAN_MISSING",
            ["records", identifier, "taskPlan"],
            "missing",
          ),
        );
      }
      for (const index of record.evidence.keys()) {
        recordIssues.push(
          ...validateEvidenceArtifact({
            artifacts: input.artifacts,
            identifier,
            record,
            evidenceIndex: index,
            validRevisions,
          }),
        );
      }
      return recordIssues;
    });

  return issues.length === 0
    ? { ok: true, value: undefined }
    : { ok: false, issues };
}

export function createCertificationSubject(
  descriptor: CapabilityDescriptor,
  requiredEvidence: readonly string[],
): CertificationSubject {
  const behaviorContract = stringifyCanonicalJson({
    descriptor,
    requiredEvidence,
  });

  return {
    descriptorVersion: descriptor.version,
    behaviorContractDigest: `sha256:${createHash("sha256")
      .update(behaviorContract)
      .digest("hex")}`,
  };
}

export function validateCertificationAdmission(input: Readonly<{
  acceptedRegistry?: CertificationRegistry;
  catalog: readonly CapabilityDescriptor[];
  registry: CertificationRegistry;
}>): ValidationResult<void> {
  const descriptors = new Map(
    input.catalog.map((descriptor) => [descriptor.identifier, descriptor]),
  );
  const issues: ContractIssue[] = [];

  for (const descriptor of input.catalog) {
    const record = input.registry.records[descriptor.identifier];

    if (record === undefined) {
      issues.push(
        issue(
          "CERTIFICATION_RECORD_MISSING",
          ["records", descriptor.identifier],
          "missing",
        ),
      );
      continue;
    }

    const expected = createCertificationSubject(
      descriptor,
      record.requiredEvidence,
    );

    if (record.subject.descriptorVersion !== expected.descriptorVersion) {
      issues.push(
        issue(
          "CERTIFICATION_SUBJECT_VERSION_MISMATCH",
          ["records", descriptor.identifier, "subject", "descriptorVersion"],
          "stale",
        ),
      );
    }
    if (
      record.subject.behaviorContractDigest !==
      expected.behaviorContractDigest
    ) {
      issues.push(
        issue(
          "CERTIFICATION_SUBJECT_DIGEST_MISMATCH",
          [
            "records",
            descriptor.identifier,
            "subject",
            "behaviorContractDigest",
          ],
          "stale",
        ),
      );
    }

    const acceptedRecord = input.acceptedRegistry?.records[descriptor.identifier];
    if (
      input.acceptedRegistry !== undefined &&
      (acceptedRecord === undefined ||
        !certificationSubjectEquals(record.subject, acceptedRecord.subject))
    ) {
      if (record.status !== "pending") {
        issues.push(
          issue(
            "CERTIFICATION_SUBJECT_PENDING_REQUIRED",
            ["records", descriptor.identifier, "status"],
            "changed-subject",
          ),
        );
      }
      if (acceptedRecord?.taskPlan === record.taskPlan) {
        issues.push(
          issue(
            "CERTIFICATION_TASK_PLAN_RENEWAL_REQUIRED",
            ["records", descriptor.identifier, "taskPlan"],
            "changed-subject",
          ),
        );
      }
    }
  }

  for (const identifier of Object.keys(input.registry.records).sort()) {
    if (!descriptors.has(identifier)) {
      issues.push(
        issue(
          "CERTIFICATION_RECORD_UNKNOWN",
          ["records", identifier],
          "unknown",
        ),
      );
    }
  }

  return issues.length === 0
    ? { ok: true, value: undefined }
    : { ok: false, issues };
}

export function validateCertificationClosure(input: Readonly<{
  registry: CertificationRegistry;
}>): ValidationResult<void> {
  const issues = Object.entries(input.registry.records)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .flatMap(([identifier, record]) => {
      if (record.status === "certified") {
        return [];
      }

      return [
        issue(
          "CAPABILITY_CERTIFICATION_PENDING",
          ["records", identifier, "status"],
          record.status,
        ),
      ];
    });

  return issues.length === 0
    ? { ok: true, value: undefined }
    : { ok: false, issues };
}
