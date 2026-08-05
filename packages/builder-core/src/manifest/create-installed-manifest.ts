import type { InstalledCapability } from "../contracts/state.js";
import type { ResolvedCapabilities } from "../resolution/resolve-capabilities.js";

export function createInstalledManifest(
  resolved: ResolvedCapabilities,
): readonly InstalledCapability[] {
  return resolved.capabilities.map(
    ({
      identifier,
      version,
      deliveryMode,
      stateClassifications,
      removalPolicy,
    }) => ({
      identifier,
      version,
      deliveryMode,
      stateClassifications,
      removalPolicy,
    }),
  );
}
