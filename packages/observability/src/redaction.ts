import type {
  OperationalAttributes,
  OperationalAttributeValue,
} from "./contracts.js";

const maximumAttributeCount = 16;
const attributeNamePattern = /^[a-z][a-z0-9_]{0,63}$/u;
const safeStringPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/u;
const prohibitedAttributeNamePattern =
  /(?:authorization|cause|cookie|email|header|ip|message|password|path|query|referrer|secret|stack|token|url|user_agent|(?:^|_)(?:console|credential|filename|form|request|response)(?:_|$))/u;
const secretWordPattern = /(?:bearer|credential|password|secret|token)/iu;
const secretPrefixPattern =
  /^(?:gh[opsu]_|github_pat_|xox[baprs]-|AIza|(?:pk|sk)_(?:live|test)_)/u;
const compactTokenPattern =
  /^[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}$/u;
const ipv4AddressPattern = /^(?:\d{1,3}\.){3}\d{1,3}$/u;
const ipv6AddressPattern =
  /^(?=[A-Fa-f0-9:.]*:[A-Fa-f0-9:.]*:)[A-Fa-f0-9:.]+$/u;

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

export function isPrivateDataLikeString(value: string): boolean {
  return (
    secretWordPattern.test(value) ||
    secretPrefixPattern.test(value) ||
    compactTokenPattern.test(value) ||
    ipv4AddressPattern.test(value) ||
    ipv6AddressPattern.test(value)
  );
}

function sanitizeAttributeValue(
  value: unknown,
): OperationalAttributeValue | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (
    typeof value === "string" &&
    safeStringPattern.test(value) &&
    !isPrivateDataLikeString(value)
  ) {
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
