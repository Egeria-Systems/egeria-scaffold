import { createHash } from "node:crypto";

import { stringifyCanonicalJson } from "../serialization/canonical-json.js";

function fingerprint(content: Uint8Array | string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

export function fingerprintFileContent(
  content: Uint8Array,
): `sha256:${string}` {
  return fingerprint(content);
}

export function fingerprintJsonValue(value: unknown): `sha256:${string}` {
  return fingerprint(stringifyCanonicalJson(value));
}
