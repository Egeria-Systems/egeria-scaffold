import type { CapabilityDescriptor } from "../contracts/capability.js";
import type { ValidationResult } from "../contracts/result.js";
import { createCapabilityCatalog } from "./capability-catalog.js";

export const verifiedCapabilityPackageVersions = Object.freeze({
  standards: "0.1.0",
  observability: "0.3.0",
} as const);

export function createVerifiedCapabilityCatalog(): ValidationResult<
  readonly CapabilityDescriptor[]
> {
  return createCapabilityCatalog(verifiedCapabilityPackageVersions);
}
