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
const exceptionEmailPattern =
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
const exceptionIpv4Pattern = /\b(?:\d{1,3}\.){3}\d{1,3}\b/gu;
const exceptionIpv6Pattern =
  /(?<![A-Fa-f0-9:.])[A-Fa-f0-9:.]*:[A-Fa-f0-9:.]*:[A-Fa-f0-9:.]*(?![A-Fa-f0-9:.])/gu;
const exceptionJwtPattern =
  /\b[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/gu;
const exceptionBearerPattern = /\bBearer\s+[A-Za-z0-9._~+/-]{4,}/giu;
const exceptionSecretAssignmentPattern =
  /\b([A-Za-z0-9_-]*(?:authorization|cookie|credential|password|secret|token|api[_-]?key)[A-Za-z0-9_-]*)\s*[:=]\s*[^\s,;)}]+/giu;
const exceptionKnownSecretPattern =
  /\b(?:gh[opsu]_|github_pat_|xox[baprs]-|AIza|(?:pk|sk)_(?:live|test)_)[A-Za-z0-9._~-]+\b/gu;
const uriUserInfoPattern =
  /\b([a-z][a-z0-9+.-]*:\/\/)[^@\s/?#]+@/giu;
const urlDetailsPattern = /([a-z][a-z0-9+.-]*:\/\/[^\s?#)]+)(?:\?[^\s#)]*)?(?:#[^\s)]*)?/giu;
const unixAbsolutePathPattern =
  /(?<![A-Za-z0-9:+./-])(?:file:\/\/)?\/(?:[^/\s()?#]+\/)*([^/\s()?#]+)(?:\?[^\s#)]*)?(?:#[^\s)]*)?/gu;
const windowsAbsolutePathPattern =
  /\b[A-Za-z]:\\(?:[^\\\s()?#]+\\)*([^\\\s()?#]+)(?:\?[^\s#)]*)?(?:#[^\s)]*)?/gu;
const uncAbsolutePathPattern =
  /\\\\(?:[^\\\s()?#]+\\)+([^\\\s()?#]+)(?:\?[^\s#)]*)?(?:#[^\s)]*)?/gu;

export const exceptionRedactionMarkers = Object.freeze({
  email: "[REDACTED_EMAIL]",
  ip: "[REDACTED_IP]",
  path: "[REDACTED_PATH]",
  secret: "[REDACTED_SECRET]",
  truncated: "[TRUNCATED]",
});

export function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    bytes +=
      codePoint <= 0x7f
        ? 1
        : codePoint <= 0x7ff
          ? 2
          : codePoint <= 0xffff
            ? 3
            : 4;
  }
  return bytes;
}

export function truncateUtf8(
  value: string,
  maximumBytes: number,
): Readonly<{ value: string; truncated: boolean }> {
  if (utf8ByteLength(value) <= maximumBytes) {
    return Object.freeze({ value, truncated: false });
  }

  const marker = exceptionRedactionMarkers.truncated;
  const availableBytes = Math.max(0, maximumBytes - utf8ByteLength(marker));
  let prefix = "";
  let prefixBytes = 0;
  for (const character of value) {
    const characterBytes = utf8ByteLength(character);
    if (prefixBytes + characterBytes > availableBytes) break;
    prefix += character;
    prefixBytes += characterBytes;
  }
  return Object.freeze({ value: `${prefix}${marker}`, truncated: true });
}

export function redactExceptionText(
  value: string,
): Readonly<{ value: string; redacted: boolean }> {
  let redacted = false;
  const replace = (
    pattern: RegExp,
    replacement: string | ((...values: string[]) => string),
  ): void => {
    const next = value.replace(pattern, replacement as never);
    if (next !== value) redacted = true;
    value = next;
  };

  replace(exceptionBearerPattern, exceptionRedactionMarkers.secret);
  replace(
    exceptionSecretAssignmentPattern,
    (_match, key) => `${key}=${exceptionRedactionMarkers.secret}`,
  );
  replace(exceptionKnownSecretPattern, exceptionRedactionMarkers.secret);
  replace(
    uriUserInfoPattern,
    (_match, scheme) => `${scheme}${exceptionRedactionMarkers.secret}@`,
  );
  replace(exceptionJwtPattern, exceptionRedactionMarkers.secret);
  replace(exceptionEmailPattern, exceptionRedactionMarkers.email);
  replace(exceptionIpv4Pattern, exceptionRedactionMarkers.ip);
  replace(exceptionIpv6Pattern, (candidate) => {
    const colonCount = candidate.match(/:/gu)?.length ?? 0;
    return candidate.includes("::") || colonCount >= 3
      ? exceptionRedactionMarkers.ip
      : candidate;
  });
  replace(urlDetailsPattern, (_match, base) => base);
  replace(
    uncAbsolutePathPattern,
    (_match, file) => `${exceptionRedactionMarkers.path}\\${file}`,
  );
  replace(
    windowsAbsolutePathPattern,
    (_match, file) => `${exceptionRedactionMarkers.path}\\${file}`,
  );
  replace(
    unixAbsolutePathPattern,
    (_match, file) => `${exceptionRedactionMarkers.path}/${file}`,
  );

  return Object.freeze({ value, redacted });
}

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
