import type { ZodType } from "zod";

export type ContractIssue = Readonly<{
  code: string;
  path: readonly (string | number)[];
  context: Readonly<Record<string, string>>;
}>;

export type ValidationResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; issues: readonly ContractIssue[] }>;

function normalizePathSegment(segment: PropertyKey): string | number {
  if (typeof segment === "number") {
    return segment;
  }

  return typeof segment === "symbol" ? String(segment) : segment;
}

function comparePathSegments(
  left: string | number,
  right: string | number,
): number {
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  const leftText = String(left);
  const rightText = String(right);

  if (leftText < rightText) {
    return -1;
  }

  if (leftText > rightText) {
    return 1;
  }

  return 0;
}

function compareIssues(left: ContractIssue, right: ContractIssue): number {
  const sharedLength = Math.min(left.path.length, right.path.length);

  for (let index = 0; index < sharedLength; index += 1) {
    const leftSegment = left.path[index];
    const rightSegment = right.path[index];

    if (leftSegment === undefined || rightSegment === undefined) {
      continue;
    }

    const comparison = comparePathSegments(leftSegment, rightSegment);

    if (comparison !== 0) {
      return comparison;
    }
  }

  if (left.path.length !== right.path.length) {
    return left.path.length - right.path.length;
  }

  if (left.code < right.code) {
    return -1;
  }

  if (left.code > right.code) {
    return 1;
  }

  const leftContext = JSON.stringify(left.context);
  const rightContext = JSON.stringify(right.context);

  return leftContext < rightContext ? -1 : leftContext > rightContext ? 1 : 0;
}

export function validateContract<T>(
  schema: ZodType<T>,
  input: unknown,
): ValidationResult<T> {
  const result = schema.safeParse(input);

  if (result.success) {
    return { ok: true, value: result.data };
  }

  const issues = result.error.issues
    .map(
      (issue): ContractIssue => ({
        code: "CONTRACT_VALIDATION_FAILED",
        path: issue.path.map(normalizePathSegment),
        context: { reason: issue.code },
      }),
    )
    .sort(compareIssues);

  return { ok: false, issues };
}
