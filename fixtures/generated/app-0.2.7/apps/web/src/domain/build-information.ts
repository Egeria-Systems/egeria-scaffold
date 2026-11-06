export type BuildInformation = Readonly<{ releaseId?: string }>;

type BuildInformationResult =
  | Readonly<{ valid: true; value: BuildInformation }>
  | Readonly<{ valid: false }>;

const releaseIdentifier = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function parseBuildInformation(metadata: unknown): BuildInformationResult {
  if (metadata === undefined) {
    return Object.freeze({ valid: true, value: Object.freeze({}) });
  }
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) {
    return Object.freeze({ valid: false });
  }
  const identifier = "id" in metadata ? metadata.id : undefined;
  return typeof identifier === "string" && releaseIdentifier.test(identifier)
    ? Object.freeze({ valid: true, value: Object.freeze({ releaseId: identifier }) })
    : Object.freeze({ valid: false });
}
