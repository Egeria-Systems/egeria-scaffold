import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

import {
  certificationRegistrySchema,
  createCertificationSubject,
  createInstalledManifest,
  createVerifiedCapabilityCatalog,
  profileRecipes,
  resolveCapabilities,
  validateCertificationAdmission,
  validateContract,
} from "../packages/builder-core/dist/index.js";
import { generatedFixtureContracts } from "./verify-generated-skeletons.mjs";
import { certifyFreshScaffold, certifyFreshScaffoldForTesting } from "./lib/certify-fresh-scaffold.mjs";
import { runCertificationCli } from "./lib/certification-cli.mjs";
import { createCertificationPreflight, createCertificationRepositoryReaders } from "./lib/certification-preflight.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const exactRevisionPattern = /^[a-f0-9]{40}$/u;
const capabilityIdentifiers = Object.freeze([
  "analytics", "app-foundation", "booking-calendly", "content-files", "deployment-cloudflare",
  "multilingual", "observability", "section-composition", "site-routing", "standards",
]);
const fixtureIdentifiers = Object.freeze(["app", "app-all-optional-integrations"]);
const generatedChecks = Object.freeze([
  "pnpm-version", "frozen-install", "peer-dependencies", "dependency-audit",
  "registry-signatures", "lint", "cloudflare-types", "typecheck", "unit-tests",
  "component-tests", "next-build", "opennext-build", "browser-install",
  "browser-development", "browser-preview",
]);

export class AppLocalCertificationError extends Error {
  constructor(code) {
    super(`Local app certification failed: ${code}`);
    this.name = "AppLocalCertificationError";
    this.code = code;
  }
}

const createError = code => new AppLocalCertificationError(code);
const isCertificationError = error => error instanceof AppLocalCertificationError;
const errorCodes = Object.freeze({
  adapterInvalid: "CERTIFICATION_ADAPTER_INVALID",
  revisionInvalid: "CERTIFICATION_REVISION_UNAVAILABLE",
  revisionUnavailable: "CERTIFICATION_REVISION_UNAVAILABLE",
  revisionMismatch: "CERTIFICATION_REVISION_MISMATCH",
  worktreeUnavailable: "CERTIFICATION_WORKTREE_UNAVAILABLE",
  worktreeDirty: "CERTIFICATION_WORKTREE_DIRTY",
  indexFlags: "CERTIFICATION_INDEX_FLAGS",
});
const repositoryReaders = createCertificationRepositoryReaders({
  repositoryRoot, revisionArguments: ["rev-parse", "--verify", "HEAD"],
  exactRevisionPattern, createError, isCertificationError, errorCodes,
});

async function requireAuthority(preflight, revision) {
  await preflight.requireRevision(revision);
  preflight.requireCleanStatus(await preflight.readRepositoryStatus());
  preflight.requireOrdinaryIndexEntries(await preflight.readRepositoryIndexEntries());
}

async function readSubjects(adapters) {
  try {
    const registry = validateContract(certificationRegistrySchema, await adapters.readRegistry());
    const catalog = createVerifiedCapabilityCatalog();
    if (!registry.ok || !catalog.ok ||
      !isDeepStrictEqual(Object.keys(registry.value.records).sort(), capabilityIdentifiers) ||
      !isDeepStrictEqual(catalog.value.map(({ identifier }) => identifier).sort(), capabilityIdentifiers) ||
      !validateCertificationAdmission({ catalog: catalog.value, registry: registry.value }).ok) {
      throw createError("CERTIFICATION_SUBJECT_INVALID");
    }
    return {
      catalog: catalog.value,
      subjects: capabilityIdentifiers.map(capability => ({
        capability,
        subject: createCertificationSubject(
          catalog.value.find(({ identifier }) => identifier === capability),
          registry.value.records[capability].requiredEvidence,
        ),
      })),
    };
  } catch {
    throw createError("CERTIFICATION_SUBJECT_INVALID");
  }
}

function configurationFor(identifier, catalog) {
  const fixture = generatedFixtureContracts.find(contract => contract.identifier === identifier);
  const resolved = resolveCapabilities({
    profile: "app",
    requestedCapabilities: identifier === "app" ? [] : ["analytics", "booking-calendly", "multilingual"],
  }, catalog, profileRecipes);
  if (!fixture || !resolved.ok || resolved.value.recipeVersion !== "0.2.0") {
    throw createError("CERTIFICATION_SUBJECT_INVALID");
  }
  const installed = createInstalledManifest(resolved.value);
  if (!isDeepStrictEqual(installed.map(({ identifier }) => identifier), fixture.expectedCapabilities)) {
    throw createError("CERTIFICATION_SUBJECT_INVALID");
  }
  return {
    profile: "app", projectName: fixture.projectName, displayName: fixture.displayName,
    // The fixture owns the exact synthetic settings and conventional create prefix.
    createArguments: fixture.createArguments.slice(6),
    capabilityIdentifier: "app-foundation", capabilityVersion: "0.1.0",
    expectedCapabilities: fixture.expectedCapabilities,
    expectedInstalledCapabilities: installed,
    expectedCapabilitySettings: fixture.expectedCapabilitySettings,
    expectedRecipeVersion: "0.2.0", verifierIdentifier: identifier,
    expectedVerificationChecks: generatedChecks,
    verificationOptions: { includeVisual: false },
    receipt: { identifier, recipeVersion: "0.2.0" },
    createError, isCertificationError,
  };
}

function requireRuntimeEvidence(result, identifier) {
  const builds = result.appBuildEvidence;
  const build = builds?.[0];
  const positiveInteger = value => Number.isSafeInteger(value) && value > 0;
  if (
    !isDeepStrictEqual(result.workerIntegration, { executed: [identifier], skipped: [] }) ||
    !Array.isArray(builds) || builds.length !== 1 || build?.fixture !== identifier ||
    build.effect?.version !== "4.0.0-rc.112" ||
    !/^[a-f0-9]{64}$/u.test(build.effect?.packageSha256 ?? "") ||
    !Array.isArray(build.client?.files) || build.client.files.length === 0 ||
    !positiveInteger(build.client.bytes) ||
    !Array.isArray(build.client.inspectedEffectMarkers) || build.client.inspectedEffectMarkers.length === 0 ||
    !positiveInteger(build.server?.files) || !positiveInteger(build.server?.bytes) ||
    build.worker?.path !== "apps/web/.open-next/server-functions/default/handler.mjs" ||
    !positiveInteger(build.worker.bytes) || !/^[a-f0-9]{64}$/u.test(build.worker.sha256 ?? "")
  ) {
    throw createError("CERTIFICATION_RUNTIME_EVIDENCE_INVALID");
  }
}

export { requireRuntimeEvidence as requireAppRuntimeEvidence };

async function certifyWithAuthority(input, adapters, runJourney) {
  if (input === null || typeof input !== "object" ||
    !isDeepStrictEqual(Object.keys(input), ["revision"]) ||
    typeof input.revision !== "string" || !exactRevisionPattern.test(input.revision)) {
    throw createError("CERTIFICATION_REVISION_INVALID");
  }
  const preflight = createCertificationPreflight({
    adapters, requiredAdapterFunctions: [
      "readCurrentRevision", "readRepositoryStatus", "readRepositoryIndexEntries", "readRegistry",
    ], createError, isCertificationError, errorCodes,
  });
  preflight.requireAdapters();
  await requireAuthority(preflight, input.revision);
  const { catalog, subjects } = await readSubjects(adapters);
  const freshScaffolds = [];
  for (const identifier of fixtureIdentifiers) {
    const result = await runJourney(configurationFor(identifier, catalog));
    requireRuntimeEvidence(result, identifier);
    freshScaffolds.push(result);
    await requireAuthority(preflight, input.revision);
  }
  return {
    ok: true, evidenceRevision: input.revision, subjects, freshScaffolds,
    limits: [
      "Local fresh-scaffold execution only; lifecycle evidence is recorded separately.",
      "No deployed, provider, human, visual-quality, linguistic-quality, accessibility-conformance or production-readiness outcome is established.",
    ],
  };
}

export function certifyAppLocal(input) {
  return certifyWithAuthority(input, {
    ...repositoryReaders,
    readRegistry: async () => JSON.parse(await readFile(resolve(repositoryRoot, "certifications/capabilities.json"), "utf8")),
  }, certifyFreshScaffold);
}

export function certifyAppLocalForTesting(input, adapters) {
  return certifyWithAuthority(input, adapters, configuration => certifyFreshScaffoldForTesting(configuration, adapters));
}

function parseArguments(arguments_) {
  const normalized = arguments_[0] === "--" ? arguments_.slice(1) : arguments_;
  return normalized.length === 2 && normalized[0] === "--revision" &&
    exactRevisionPattern.test(normalized[1]) ? { revision: normalized[1] } : undefined;
}

await runCertificationCli({ moduleUrl: import.meta.url, parseArguments, certify: certifyAppLocal, isCertificationError });
