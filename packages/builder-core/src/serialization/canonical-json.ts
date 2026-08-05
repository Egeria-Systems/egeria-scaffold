export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | Readonly<{ [key: string]: JsonValue }>;

export type JsonPointerResult =
  | Readonly<{ found: true; value: JsonValue }>
  | Readonly<{ found: false }>;

function isPlainObject(
  value: object,
): value is Readonly<Record<string, unknown>> {
  const prototype = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function isJsonArray(value: JsonValue): value is readonly JsonValue[] {
  return Array.isArray(value);
}

function canonicalize(
  value: unknown,
  ancestors: Set<object>,
): JsonValue {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("JSON_VALUE_INVALID");
    }

    return value;
  }

  if (typeof value !== "object") {
    throw new TypeError("JSON_VALUE_INVALID");
  }

  if (ancestors.has(value)) {
    throw new TypeError("JSON_VALUE_CYCLIC");
  }

  ancestors.add(value);

  try {
    if (isUnknownArray(value)) {
      return value.map((item) => canonicalize(item, ancestors));
    }

    if (!isPlainObject(value)) {
      throw new TypeError("JSON_VALUE_INVALID");
    }

    const entries = Object.keys(value)
      .sort()
      .map(
        (key): readonly [string, JsonValue] => [
          key,
          canonicalize(value[key], ancestors),
        ],
      );

    return Object.fromEntries(entries);
  } finally {
    ancestors.delete(value);
  }
}

export function canonicalizeJsonValue(value: unknown): JsonValue {
  return canonicalize(value, new Set());
}

export function stringifyCanonicalJson(value: unknown): string {
  return JSON.stringify(canonicalizeJsonValue(value));
}

export function jsonValuesEqual(left: unknown, right: unknown): boolean {
  return stringifyCanonicalJson(left) === stringifyCanonicalJson(right);
}

function decodePointerToken(token: string): string | undefined {
  if (!/^(?:[^~]|~[01])*$/.test(token)) {
    return undefined;
  }

  return token.replaceAll("~1", "/").replaceAll("~0", "~");
}

export function resolveJsonPointer(
  value: JsonValue,
  pointer: string,
): JsonPointerResult {
  if (pointer === "") {
    return { found: true, value };
  }

  if (!pointer.startsWith("/")) {
    return { found: false };
  }

  let current = value;

  for (const encodedToken of pointer.slice(1).split("/")) {
    const token = decodePointerToken(encodedToken);

    if (token === undefined) {
      return { found: false };
    }

    if (isJsonArray(current)) {
      if (!/^(?:0|[1-9][0-9]*)$/.test(token)) {
        return { found: false };
      }

      const index = Number(token);

      if (!Number.isSafeInteger(index) || index >= current.length) {
        return { found: false };
      }

      const next = current[index];

      if (next === undefined) {
        return { found: false };
      }

      current = next;
      continue;
    }

    if (current === null || typeof current !== "object") {
      return { found: false };
    }

    const object = current as Readonly<Record<string, JsonValue>>;

    if (!Object.hasOwn(object, token)) {
      return { found: false };
    }

    current = object[token] as JsonValue;
  }

  return { found: true, value: current };
}
