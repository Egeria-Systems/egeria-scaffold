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

const legacyBackfillSubjects = Object.freeze({
  "content-files": Object.freeze({
    descriptorVersion: "0.4.0",
    behaviorContractDigest:
      "sha256:5ae35debef622dc0fb9eeee3889e79a72fd6ff28eb730865bfe95e8674c9ff05",
  }),
  "deployment-cloudflare": Object.freeze({
    descriptorVersion: "0.2.0",
    behaviorContractDigest:
      "sha256:846ae45d15ba9d8f256a9b7a1d8a4f3cda1b871a3b3f79f7656fd621050e8273",
  }),
  observability: Object.freeze({
    descriptorVersion: "0.1.0",
    behaviorContractDigest:
      "sha256:1f070bdb531d8bcec8a7ebf5b081cde8466dcd0d72d5f16b5a5a3ac2bd65af93",
  }),
  "section-composition": Object.freeze({
    descriptorVersion: "0.3.0",
    behaviorContractDigest:
      "sha256:4f63f9d6169048b5a1f5b1d042b3a0ddaa22ca1273d1acadf6235ce93e616696",
  }),
  "site-routing": Object.freeze({
    descriptorVersion: "0.3.0",
    behaviorContractDigest:
      "sha256:d716a1c93f8f40db33e54612c85d521fbd6ba13cd142d35ab0c39fa9c4b9647e",
  }),
  standards: Object.freeze({
    descriptorVersion: "0.2.0",
    behaviorContractDigest:
      "sha256:a3a020b778c1ccfa24e0bfc951fcdf5eb74b50728f69e960124c6bae6a757311",
  }),
} satisfies Readonly<Record<string, CertificationSubject>>);

export const legacyBackfillCapabilityIdentifiers = Object.freeze(
  Object.keys(legacyBackfillSubjects).sort(),
);

export type CertificationClosurePolicy =
  | "legacy-backfill-exempt"
  | "all-certified";

const legacyBackfillCapabilitySet = new Set<string>(
  legacyBackfillCapabilityIdentifiers,
);

type CertificationArtifacts = Readonly<Record<string, string | undefined>>;

function issue(
  code: string,
  path: readonly (string | number)[],
  reason: string,
): ContractIssue {
  return { code, path, context: { reason } };
}

function subjectEquals(
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
      if (
        record.taskPlan !== null &&
        input.artifacts[record.taskPlan] === undefined
      ) {
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
    if (record.status === "backfill-pending") {
      if (!legacyBackfillCapabilitySet.has(descriptor.identifier)) {
        issues.push(
          issue(
            "CERTIFICATION_BACKFILL_NOT_ALLOWED",
            ["records", descriptor.identifier, "status"],
            "not-legacy",
          ),
        );
      } else if (
        !subjectEquals(
          record.subject,
          legacyBackfillSubjects[
            descriptor.identifier as keyof typeof legacyBackfillSubjects
          ],
        )
      ) {
        issues.push(
          issue(
            "CERTIFICATION_BACKFILL_SUBJECT_MISMATCH",
            ["records", descriptor.identifier, "subject"],
            "not-accepted-subject",
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
  policy: CertificationClosurePolicy;
}>): ValidationResult<void> {
  const issues = Object.entries(input.registry.records)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .flatMap(([identifier, record]) => {
    if (record.status === "certified") {
      return [];
    }
    if (
      input.policy === "legacy-backfill-exempt" &&
      record.status === "backfill-pending" &&
      legacyBackfillCapabilitySet.has(identifier) &&
      subjectEquals(
        record.subject,
        legacyBackfillSubjects[
          identifier as keyof typeof legacyBackfillSubjects
        ],
      )
    ) {
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
