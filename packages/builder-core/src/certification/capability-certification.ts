import { createHash } from "node:crypto";

import type { CapabilityDescriptor } from "../contracts/capability.js";
import type {
  CertificationRegistry,
  CertificationSubject,
} from "../contracts/certification.js";
import type {
  ContractIssue,
  ValidationResult,
} from "../contracts/result.js";
import { stringifyCanonicalJson } from "../serialization/canonical-json.js";

export const legacyBackfillCapabilityIdentifiers = Object.freeze([
  "content-files",
  "deployment-cloudflare",
  "observability",
  "section-composition",
  "site-routing",
  "standards",
] as const);

export type CertificationClosurePolicy =
  | "legacy-backfill-exempt"
  | "all-certified";

const legacyBackfillCapabilitySet = new Set<string>(
  legacyBackfillCapabilityIdentifiers,
);

function issue(
  code: string,
  path: readonly (string | number)[],
  reason: string,
): ContractIssue {
  return { code, path, context: { reason } };
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
    if (
      record.status === "backfill-pending" &&
      !legacyBackfillCapabilitySet.has(descriptor.identifier)
    ) {
      issues.push(
        issue(
          "CERTIFICATION_BACKFILL_NOT_ALLOWED",
          ["records", descriptor.identifier, "status"],
          "not-legacy",
        ),
      );
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
      legacyBackfillCapabilitySet.has(identifier)
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
