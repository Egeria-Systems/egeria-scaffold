import { createCapabilityCatalogSnapshot } from "../catalog/capability-catalog.js";
import { verifiedCapabilityPackageVersions } from "../catalog/verified-package-versions.js";
import { createCertificationSubject } from "../certification/capability-certification.js";
import type { CapabilityDescriptor } from "../contracts/capability.js";
import type { CertificationSubject } from "../contracts/certification.js";
import { createProfileRecipeSnapshot } from "../profiles/profile-recipes.js";

export type SupportedCapabilityUpgradeResolutionFailureCode =
  | "CAPABILITY_ALREADY_CURRENT"
  | "CAPABILITY_UPGRADE_EDGE_MISSING"
  | "CAPABILITY_UPGRADE_UNSUPPORTED";

export type SupportedCapabilityUpgradeEndpoint = Readonly<{
  recipeVersion: "0.9.0" | "0.10.0" | "0.11.0";
  evidenceRevision: string;
  subject: CertificationSubject;
}>;

type SupportedStandardsUpgrade = Readonly<{
  capability: "standards";
  fromVersion: "0.3.0";
  toVersion: "0.4.0";
  source: SupportedCapabilityUpgradeEndpoint &
    Readonly<{ recipeVersion: "0.9.0" }>;
  target: SupportedCapabilityUpgradeEndpoint &
    Readonly<{ recipeVersion: "0.10.0" }>;
}>;

type SupportedSiteRoutingUpgrade = Readonly<{
  capability: "site-routing";
  fromVersion: "0.3.0";
  toVersion: "0.4.0";
  source: SupportedCapabilityUpgradeEndpoint &
    Readonly<{ recipeVersion: "0.10.0" }>;
  target: SupportedCapabilityUpgradeEndpoint &
    Readonly<{ recipeVersion: "0.11.0" }>;
}>;

export type SupportedCapabilityUpgrade =
  | SupportedStandardsUpgrade
  | SupportedSiteRoutingUpgrade;

export type SupportedCapabilityUpgradeResolution =
  | Readonly<{ ok: true; value: SupportedCapabilityUpgrade }>
  | Readonly<{
      ok: false;
      code: SupportedCapabilityUpgradeResolutionFailureCode;
    }>;

function standardsDescriptor(
  version: "0.3.0" | "0.4.0",
): CapabilityDescriptor {
  const catalog = createCapabilityCatalogSnapshot(
    verifiedCapabilityPackageVersions,
    { standards: version },
  );

  if (!catalog.ok) {
    throw new TypeError("supported-upgrade-catalog-invalid");
  }

  const descriptor = catalog.value.find(
    ({ identifier }) => identifier === "standards",
  );

  if (descriptor === undefined) {
    throw new TypeError("supported-upgrade-descriptor-missing");
  }

  return descriptor;
}

function createStandardsUpgrade(): SupportedStandardsUpgrade {
  const sourceRecipes = createProfileRecipeSnapshot("0.9.0");
  const targetRecipes = createProfileRecipeSnapshot("0.10.0");

  if (
    sourceRecipes.some(({ recipeVersion }) => recipeVersion !== "0.9.0") ||
    targetRecipes.some(({ recipeVersion }) => recipeVersion !== "0.10.0")
  ) {
    throw new TypeError("supported-upgrade-recipe-invalid");
  }

  return {
    capability: "standards",
    fromVersion: "0.3.0",
    toVersion: "0.4.0",
    source: {
      recipeVersion: "0.9.0",
      evidenceRevision: "ea5a8ae8a6b0aa5fd7b8bc3bab3e03a52242aee2",
      subject: createCertificationSubject(standardsDescriptor("0.3.0"), [
        "fresh-scaffold",
      ]),
    },
    target: {
      recipeVersion: "0.10.0",
      evidenceRevision: "d7f9dac6e25d5dde32015968d0912b45e73644e7",
      subject: createCertificationSubject(standardsDescriptor("0.4.0"), [
        "existing-repository-lifecycle",
        "fresh-scaffold",
      ]),
    },
  };
}

function siteRoutingDescriptor(
  version: "0.3.0" | "0.4.0",
): CapabilityDescriptor {
  const catalog = createCapabilityCatalogSnapshot(
    verifiedCapabilityPackageVersions,
    { standards: "0.4.0", siteRouting: version },
  );

  if (!catalog.ok) {
    throw new TypeError("supported-upgrade-catalog-invalid");
  }

  const descriptor = catalog.value.find(
    ({ identifier }) => identifier === "site-routing",
  );
  if (descriptor === undefined) {
    throw new TypeError("supported-upgrade-descriptor-missing");
  }

  return descriptor;
}

function createSiteRoutingUpgrade(): SupportedSiteRoutingUpgrade {
  return {
    capability: "site-routing",
    fromVersion: "0.3.0",
    toVersion: "0.4.0",
    source: {
      recipeVersion: "0.10.0",
      evidenceRevision: "77cea944513e521939bf4de088048f67acdfbc3c",
      subject: createCertificationSubject(siteRoutingDescriptor("0.3.0"), [
        "fresh-scaffold",
      ]),
    },
    target: {
      recipeVersion: "0.11.0",
      evidenceRevision: "pending-site-routing-certification",
      subject: createCertificationSubject(siteRoutingDescriptor("0.4.0"), [
        "existing-repository-lifecycle",
        "fresh-scaffold",
      ]),
    },
  };
}

export function resolveSupportedCapabilityUpgrade(input: Readonly<{
  capability: string;
  fromVersion: string;
  toVersion: string;
}>): SupportedCapabilityUpgradeResolution {
  if (
    !["standards", "site-routing"].includes(input.capability) ||
    input.toVersion !== "0.4.0"
  ) {
    return { ok: false, code: "CAPABILITY_UPGRADE_UNSUPPORTED" };
  }

  if (input.fromVersion === input.toVersion) {
    return { ok: false, code: "CAPABILITY_ALREADY_CURRENT" };
  }

  if (input.fromVersion !== "0.3.0") {
    return { ok: false, code: "CAPABILITY_UPGRADE_EDGE_MISSING" };
  }

  return {
    ok: true,
    value:
      input.capability === "standards"
        ? createStandardsUpgrade()
        : createSiteRoutingUpgrade(),
  };
}
