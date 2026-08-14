import observabilityCopySource from "../../../content/en-CA/observability.yaml";

import { parseYamlContent } from "../../content/content-schema";

export type ErrorFallbackCopy = Readonly<{
  heading: string;
  summary: string;
  retryLabel: string;
}>;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Readonly<Record<string, unknown>>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function isCopy(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(value)
  );
}

export function parseErrorFallbackCopy(value: unknown): ErrorFallbackCopy {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["heading", "retryLabel", "summary"]) ||
    !isCopy(value.heading) ||
    !isCopy(value.summary) ||
    !isCopy(value.retryLabel)
  ) {
    throw new TypeError("CONTENT_INVALID");
  }

  return Object.freeze({
    heading: value.heading,
    summary: value.summary,
    retryLabel: value.retryLabel,
  });
}

export function readErrorFallbackCopy(): ErrorFallbackCopy {
  return parseErrorFallbackCopy(parseYamlContent(observabilityCopySource));
}
