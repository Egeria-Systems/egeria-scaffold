import type {
  OperationalAttributes,
  OperationalAttributeValue,
} from "./contracts.js";

const maximumAttributeCount = 16;
const attributeNamePattern = /^[a-z][a-z0-9_]{0,63}$/u;
const safeStringPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/u;
const prohibitedAttributeNamePattern =
  /(?:authorization|cause|cookie|email|header|ip|message|password|path|query|referrer|secret|stack|token|url|user_agent)/u;

function isPlainRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

function isAllowedAttributeName(value: string): boolean {
  return (
    attributeNamePattern.test(value) &&
    !prohibitedAttributeNamePattern.test(value)
  );
}

function sanitizeAttributeValue(
  value: unknown,
): OperationalAttributeValue | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "string" && safeStringPattern.test(value)) {
    return value;
  }
  return undefined;
}

export function validateAttributeAllowlist(
  names: readonly string[],
): boolean {
  return (
    names.length <= maximumAttributeCount &&
    new Set(names).size === names.length &&
    names.every(isAllowedAttributeName)
  );
}

export function redactOperationalAttributes(
  value: unknown,
  allowedAttributeNames: readonly string[],
): OperationalAttributes {
  if (!isPlainRecord(value)) return Object.freeze({});

  const attributes: Record<string, OperationalAttributeValue> = {};
  for (const name of [...allowedAttributeNames].sort()) {
    let attributeValue: unknown;
    try {
      attributeValue = value[name];
    } catch {
      continue;
    }

    const sanitized = sanitizeAttributeValue(attributeValue);
    if (sanitized !== undefined) attributes[name] = sanitized;
  }

  return Object.freeze(attributes);
}
