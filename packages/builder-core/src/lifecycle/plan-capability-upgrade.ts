import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { createCapabilityCatalogSnapshot } from "../catalog/capability-catalog.js";
import { verifiedCapabilityPackageVersions } from "../catalog/verified-package-versions.js";
import type { ManagedSurfaceDescriptor } from "../contracts/capability.js";
import type { ContractIssue } from "../contracts/result.js";
import type { InstalledState, InstalledSurface } from "../contracts/state.js";
import {
  deriveProjectDiscrepancies,
  inspectProject,
  type ProjectInspection,
} from "../diagnostics/project-inspection.js";
import { createBuilderStateSurfaces } from "../generation/builder-state-surfaces.js";
import {
  renderSkeleton,
  type GeneratedFile,
  type RenderedSkeleton,
} from "../generation/render-skeleton.js";
import { createRecipeLockfileUrl } from "../generation/recipe-lockfiles.js";
import { fingerprintFileContent, fingerprintJsonValue } from "../ownership/fingerprint.js";
import {
  createProfileRecipeSnapshot,
  profileRecipes,
} from "../profiles/profile-recipes.js";
import { createCachingRepositoryReader } from "../repository/cache-reader.js";
import type { RepositoryReader } from "../repository/repository-reader.js";
import {
  canonicalizeJsonValue,
  resolveJsonPointer,
  stringifyCanonicalJson,
  type JsonValue,
} from "../serialization/canonical-json.js";
import {
  parseMigrationLog,
  parseProjectYaml,
  parseStateJson,
  serializeProjectYaml,
} from "../state/codecs.js";
import type { GitWorktreeInspection } from "./git-worktree-inspection.js";
import {
  resolveSupportedCapabilityUpgrade,
  type SupportedCapabilityUpgrade,
  type SupportedCapabilityUpgradeEndpoint,
  type SupportedCapabilityUpgradeResolutionFailureCode,
} from "./supported-capability-upgrades.js";

export type CapabilityUpgradePlanningFailureCode =
  | SupportedCapabilityUpgradeResolutionFailureCode
  | "CAPABILITY_ACTION_CONFLICT"
  | "CAPABILITY_VERSION_AMBIGUOUS"
  | "PROJECT_DRIFT_DETECTED"
  | "PROJECT_EJECTION_UNSUPPORTED"
  | "PROJECT_INSPECTION_INVALID"
  | "PROJECT_STATE_INCOMPATIBLE";

export type CapabilityUpgradeControlFileEvidence = Readonly<{
  path:
    | ".egeria/migrations.jsonl"
    | ".egeria/project.yaml"
    | ".egeria/state.json";
  fingerprint: `sha256:${string}`;
}>;

type CapabilityUpgradeFileAction = Readonly<{
  kind: "create-file" | "replace-file";
  path: string;
  ownership: "application-owned" | "managed" | "merge-managed";
  owner:
    | "builder-kernel"
    | "content-files"
    | "deployment-cloudflare"
    | "site-routing"
    | "standards";
  targetFingerprint: `sha256:${string}`;
}>;

type CapabilityUpgradeJsonAction = Readonly<{
  kind: "set-json-value";
  path: "apps/web/package.json";
  pointer: "/scripts/test:visual";
  ownership: "merge-managed";
  owner: "standards";
  targetFingerprint: `sha256:${string}`;
}>;

export type CapabilityUpgradeAction =
  | CapabilityUpgradeFileAction
  | CapabilityUpgradeJsonAction;

export type CapabilityUpgradePlan = Readonly<{
  operation: "upgrade-capability";
  status: "approval-required";
  planFingerprint: `sha256:${string}`;
  baseRevision: string;
  profile: "portfolio" | "site";
  capability: Readonly<{
    identifier: "site-routing" | "standards";
    fromVersion: "0.3.0";
    toVersion: "0.4.0";
  }>;
  source: SupportedCapabilityUpgradeEndpoint;
  target: SupportedCapabilityUpgradeEndpoint;
  controlFiles: readonly CapabilityUpgradeControlFileEvidence[];
  currentCapabilities: readonly string[];
  desiredCapabilities: readonly string[];
  actions: readonly CapabilityUpgradeAction[];
  requiredApprovals: readonly ["transform", "verified-final-diff"];
  persistenceOrder: readonly [
    "transform",
    "verify",
    "re-infer",
    "append-migration-record",
    "persist-state",
    "verify-state-and-inference",
  ];
}>;

type CapabilityUpgradePlanBody = Omit<CapabilityUpgradePlan, "planFingerprint">;
type PlanningIssue = Omit<ContractIssue, "code"> &
  Readonly<{ code: CapabilityUpgradePlanningFailureCode }>;
type PlanningResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; issues: readonly PlanningIssue[] }>;
type ValidInspection = ProjectInspection &
  Readonly<{
    project: Extract<ProjectInspection["project"], Readonly<{ kind: "valid" }>>;
    migrations: Extract<
      ProjectInspection["migrations"],
      Readonly<{ kind: "valid" }>
    >;
    inference: ProjectInspection["inference"] &
      Readonly<{
        state: Extract<
          ProjectInspection["inference"]["state"],
          Readonly<{ kind: "valid" }>
        >;
      }>;
    resolution: Extract<
      NonNullable<ProjectInspection["resolution"]>,
      Readonly<{ ok: true }>
    >;
  }>;

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const controlPaths = [
  ".egeria/migrations.jsonl",
  ".egeria/project.yaml",
  ".egeria/state.json",
] as const;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function planningFailure(
  code: CapabilityUpgradePlanningFailureCode,
): PlanningResult<never> {
  return {
    ok: false,
    issues: [
      {
        code,
        path: [],
        context: { reason: "precondition-refused" },
      },
    ],
  };
}

function sameOrderedValues(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function sameStringSet(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    new Set(left).size === left.length &&
    left.every((value) => right.includes(value))
  );
}

function sameSurfaceOwner(
  installed: InstalledSurface["owner"],
  expected: ManagedSurfaceDescriptor["owner"],
): boolean {
  return (
    installed.kind === expected.kind &&
    (installed.kind === "builder-kernel" ||
      (expected.kind === "capability" &&
        installed.identifier === expected.identifier))
  );
}

function sameFingerprintTarget(
  installed: InstalledSurface["fingerprintTarget"],
  expected: ManagedSurfaceDescriptor["fingerprintTarget"],
): boolean {
  return (
    installed.kind === expected.kind &&
    (installed.kind === "file" ||
      (expected.kind === "json-value" &&
        installed.pointer === expected.pointer))
  );
}

function hasSurfaceInventoryDrift(
  installed: readonly InstalledSurface[],
  expected: readonly ManagedSurfaceDescriptor[],
): boolean {
  const installedByIdentifier = new Map(
    installed.map((surface) => [surface.identifier, surface]),
  );

  return (
    installed.length !== expected.length ||
    expected.some((surface) => {
      const actual = installedByIdentifier.get(surface.identifier);

      if (actual === undefined) {
        return true;
      }

      return (
        actual.path !== surface.path ||
        actual.ownership !== surface.ownership ||
        actual.mergeStrategy !== surface.mergeStrategy ||
        !sameSurfaceOwner(actual.owner, surface.owner) ||
        !sameFingerprintTarget(
          actual.fingerprintTarget,
          surface.fingerprintTarget,
        )
      );
    })
  );
}

async function readControlSources(
  reader: RepositoryReader,
): Promise<
  | Readonly<{
      ok: true;
      sources: ReadonlyMap<(typeof controlPaths)[number], string>;
      state: InstalledState;
    }>
  | Readonly<{ ok: false }>
> {
  const sources = new Map<(typeof controlPaths)[number], string>();

  for (const path of controlPaths) {
    const result = await reader.readText(path);

    if (result.kind !== "file") {
      return { ok: false };
    }

    sources.set(path, result.content);
  }

  const project = parseProjectYaml(sources.get(".egeria/project.yaml") ?? "");
  const state = parseStateJson(sources.get(".egeria/state.json") ?? "");
  const migrations = parseMigrationLog(
    sources.get(".egeria/migrations.jsonl") ?? "",
  );

  return project.ok && state.ok && migrations.ok
    ? { ok: true, sources, state: state.value }
    : { ok: false };
}

function sourceVersion(
  state: InstalledState,
  capability: "site-routing" | "standards",
): string | undefined {
  const matches = state.installedCapabilities.filter(
    ({ identifier }) => identifier === capability,
  );

  return matches.length === 1 ? matches[0]?.version : undefined;
}

function validInspection(
  inspection: ProjectInspection,
): ValidInspection | undefined {
  return inspection.project.kind === "valid" &&
    inspection.migrations.kind === "valid" &&
    inspection.inference.state.kind === "valid" &&
    inspection.resolution?.ok === true
    ? (inspection as ValidInspection)
    : undefined;
}

function hasExactAgreement(
  inspection: ValidInspection,
  edge: SupportedCapabilityUpgrade,
): boolean {
  const project = inspection.project.value;
  const state = inspection.inference.state.value;
  const resolved = inspection.resolution.value;
  const desiredIdentifiers = resolved.capabilities.map(({ identifier }) => identifier);
  const installedIdentifiers = state.installedCapabilities.map(
    ({ identifier }) => identifier,
  );
  const migrationIdentifiers = inspection.migrations.value.map(
    ({ identifier }) => identifier,
  );
  const resolvedVersions = new Map(
    resolved.capabilities.map(({ identifier, version }) => [identifier, version]),
  );
  const installedVersionsAgree = state.installedCapabilities.every(
    ({ identifier, version }) => resolvedVersions.get(identifier) === version,
  );
  const inferenceByIdentifier = new Map(
    inspection.inference.capabilities.map((evidence) => [
      evidence.identifier,
      evidence,
    ]),
  );

  return (
    project.recipeVersion === edge.source.recipeVersion &&
    state.origin.profile === project.originProfile &&
    state.origin.recipeVersion === project.recipeVersion &&
    resolved.recipeVersion === project.recipeVersion &&
    project.selectedCapabilities.includes(edge.capability) &&
    sameStringSet(project.selectedCapabilities, desiredIdentifiers) &&
    sameStringSet(installedIdentifiers, desiredIdentifiers) &&
    installedVersionsAgree &&
    sameOrderedValues(state.appliedMigrations, migrationIdentifiers) &&
    desiredIdentifiers.every(
      (identifier) => inferenceByIdentifier.get(identifier)?.category === "confirmed",
    ) &&
    inspection.inference.capabilities.every(
      ({ category }) => category === "confirmed",
    )
  );
}

function hasMaterialDrift(inspection: ValidInspection): boolean {
  const discrepancies = deriveProjectDiscrepancies(inspection);

  return (
    discrepancies.capabilities.length > 0 ||
    discrepancies.surfaces.length > 0 ||
    inspection.inference.surfaces.some(
      ({ status }) => status !== "confirmed" && status !== "application-owned",
    )
  );
}

function hasUnsupportedEjection(inspection: ValidInspection): boolean {
  return (
    inspection.project.value.ejectedAreas.length > 0 ||
    inspection.inference.state.value.ejections.length > 0 ||
    inspection.inference.surfaces.some(({ status }) => status === "ejected")
  );
}

function expectedSourceSurfaces(input: Readonly<{
  rendered: RenderedSkeleton;
  sourceStandards: readonly ManagedSurfaceDescriptor[];
}>): readonly ManagedSurfaceDescriptor[] {
  return [
    ...input.rendered.surfaces.filter(
      ({ owner }) =>
        owner.kind !== "capability" || owner.identifier !== "standards",
    ),
    ...input.sourceStandards,
    ...createBuilderStateSurfaces(),
  ];
}

function generatedFile(
  rendered: RenderedSkeleton,
  path: string,
): GeneratedFile | undefined {
  return rendered.files.find((file) => file.path === path);
}

function historicalQualitySource(target: GeneratedFile): string | undefined {
  const visualStep = [
    "      - name: Compare OpenNext visual baselines",
    "        run: pnpm --dir apps/web run test:visual",
    "",
  ].join("\n");

  try {
    const source = decoder.decode(target.content);
    return source.includes(visualStep)
      ? source.replace(visualStep, "")
      : undefined;
  } catch {
    return undefined;
  }
}

async function validateSourceStandardsFiles(input: Readonly<{
  reader: RepositoryReader;
  rendered: RenderedSkeleton;
  sourceSurfaces: readonly ManagedSurfaceDescriptor[];
}>): Promise<PlanningResult<void>> {
  for (const surface of input.sourceSurfaces) {
    const result = await input.reader.readText(surface.path);

    if (surface.ownership === "application-owned") {
      if (
        result.kind !== "file" &&
        !(
          result.kind === "error" &&
          (result.code === "FILE_ENCODING_INVALID" ||
            result.code === "FILE_TOO_LARGE")
        )
      ) {
        return planningFailure("PROJECT_DRIFT_DETECTED");
      }
      continue;
    }

    if (surface.fingerprintTarget.kind === "json-value") {
      continue;
    }

    const target = generatedFile(input.rendered, surface.path);
    if (target === undefined || result.kind !== "file") {
      return planningFailure("PROJECT_DRIFT_DETECTED");
    }

    let expected: string;
    if (surface.identifier === "standards-quality-workflow") {
      const historical = historicalQualitySource(target);

      if (historical === undefined) {
        return planningFailure("PROJECT_INSPECTION_INVALID");
      }
      expected = historical;
    } else {
      try {
        expected = decoder.decode(target.content);
      } catch {
        return planningFailure("PROJECT_INSPECTION_INVALID");
      }
    }

    if (result.content !== expected) {
      return planningFailure("PROJECT_DRIFT_DETECTED");
    }
  }

  return { ok: true, value: undefined };
}

function parseJsonSource(source: string): JsonValue | undefined {
  try {
    return canonicalizeJsonValue(JSON.parse(source) as unknown);
  } catch {
    return undefined;
  }
}

async function deriveActions(input: Readonly<{
  reader: RepositoryReader;
  rendered: RenderedSkeleton;
  sourceStandards: readonly ManagedSurfaceDescriptor[];
  targetStandards: readonly ManagedSurfaceDescriptor[];
}>): Promise<PlanningResult<readonly CapabilityUpgradeAction[]>> {
  const sourceIdentifiers = new Set(
    input.sourceStandards.map(({ identifier }) => identifier),
  );
  const actions: CapabilityUpgradeAction[] = [];
  const qualityTarget = generatedFile(
    input.rendered,
    ".github/workflows/quality.yml",
  );

  if (qualityTarget === undefined) {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }

  actions.push({
    kind: "replace-file",
    path: qualityTarget.path,
    ownership: "managed",
    owner: "standards",
    targetFingerprint: fingerprintFileContent(qualityTarget.content),
  });

  for (const surface of input.targetStandards) {
    if (sourceIdentifiers.has(surface.identifier)) {
      continue;
    }

    if (surface.fingerprintTarget.kind === "json-value") {
      if (
        surface.path !== "apps/web/package.json" ||
        surface.fingerprintTarget.pointer !== "/scripts/test:visual"
      ) {
        return planningFailure("PROJECT_INSPECTION_INVALID");
      }

      const manifest = await input.reader.readText(surface.path);
      const parsed =
        manifest.kind === "file" ? parseJsonSource(manifest.content) : undefined;
      const current =
        parsed === undefined
          ? { found: true as const }
          : resolveJsonPointer(parsed, surface.fingerprintTarget.pointer);

      if (parsed === undefined) {
        return planningFailure("CAPABILITY_VERSION_AMBIGUOUS");
      }
      if (current.found) {
        return planningFailure("CAPABILITY_ACTION_CONFLICT");
      }

      actions.push({
        kind: "set-json-value",
        path: "apps/web/package.json",
        pointer: "/scripts/test:visual",
        ownership: "merge-managed",
        owner: "standards",
        targetFingerprint: fingerprintJsonValue(
          "playwright test --config playwright.visual.config.ts",
        ),
      });
      continue;
    }

    const availability = await input.reader.readText(surface.path);
    if (availability.kind !== "missing") {
      return planningFailure("CAPABILITY_ACTION_CONFLICT");
    }

    const target = generatedFile(input.rendered, surface.path);
    if (target === undefined) {
      return planningFailure("PROJECT_INSPECTION_INVALID");
    }

    actions.push({
      kind: "create-file",
      path: surface.path,
      ownership:
        surface.ownership === "application-owned"
          ? "application-owned"
          : "managed",
      owner: "standards",
      targetFingerprint: fingerprintFileContent(target.content),
    });
  }

  return {
    ok: true,
    value: actions.sort((left, right) => {
      const pathComparison = compareText(left.path, right.path);
      return pathComparison === 0
        ? compareText(left.kind, right.kind)
        : pathComparison;
    }),
  };
}

function controlFileEvidence(
  sources: ReadonlyMap<(typeof controlPaths)[number], string>,
): readonly CapabilityUpgradeControlFileEvidence[] {
  return controlPaths.map((path) => ({
    path,
    fingerprint: fingerprintFileContent(encoder.encode(sources.get(path) ?? "")),
  }));
}

function fingerprintPlan(input: Readonly<{
  plan: CapabilityUpgradePlanBody;
  git: Extract<GitWorktreeInspection, Readonly<{ ok: true }>>;
}>): `sha256:${string}` {
  const digest = createHash("sha256")
    .update(
      stringifyCanonicalJson({
        plan: input.plan,
        gitIdentity: input.git.identity,
      }),
      "utf8",
    )
    .digest("hex");

  return `sha256:${digest}`;
}

const siteRoutingUpgradePaths = [
  ".egeria/project.yaml",
  "apps/web/app/about/page.tsx",
  "apps/web/app/not-found.tsx",
  "apps/web/app/page.tsx",
  "apps/web/app/robots.ts",
  "apps/web/app/sitemap.ts",
  "apps/web/app/work/error.tsx",
  "apps/web/app/work/featured/page.tsx",
  "apps/web/app/work/page.tsx",
  "apps/web/content/en-CA/about.yaml",
  "apps/web/content/en-CA/not-found.yaml",
  "apps/web/content/en-CA/routing.yaml",
  "apps/web/content/en-CA/site.yaml",
  "apps/web/content/en-CA/work-featured.yaml",
  "apps/web/package.json",
  "apps/web/src/routing/read-routing-content.ts",
  "apps/web/src/routing/routing-content-schema.ts",
  "apps/web/src/routing/site-page.tsx",
  "apps/web/tests/component/site-page.test.tsx",
  "apps/web/tests/e2e/site-routing.spec.ts",
  "apps/web/tests/unit/routing-content.test.ts",
  "pnpm-lock.yaml",
] as const;

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.length === right.length &&
    left.every((byte, index) => byte === right[index])
  );
}

async function readRepositoryBytes(
  reader: RepositoryReader,
  path: string,
): Promise<
  | Readonly<{ kind: "file"; content: Uint8Array }>
  | Readonly<{ kind: "missing" }>
  | Readonly<{ kind: "invalid" }>
> {
  if (reader.readBytes !== undefined) {
    const result = await reader.readBytes(path);
    return result.kind === "file" || result.kind === "missing"
      ? result
      : { kind: "invalid" };
  }

  const result = await reader.readText(path);
  return result.kind === "file"
    ? { kind: "file", content: encoder.encode(result.content) }
    : result.kind === "missing"
      ? result
      : { kind: "invalid" };
}

function siteRoutingActionOwner(
  path: string,
  target: RenderedSkeleton,
): Pick<CapabilityUpgradeFileAction, "owner" | "ownership"> | undefined {
  if (
    path === ".egeria/project.yaml" ||
    path === "apps/web/app/page.tsx" ||
    path === "pnpm-lock.yaml"
  ) {
    return { owner: "builder-kernel", ownership: "managed" };
  }
  if (path === "apps/web/package.json") {
    return { owner: "builder-kernel", ownership: "merge-managed" };
  }

  const descriptor = target.surfaces.find(
    (surface) =>
      surface.path === path && surface.fingerprintTarget.kind === "file",
  );
  if (descriptor === undefined) {
    return undefined;
  }

  return {
    owner:
      descriptor.owner.kind === "builder-kernel"
        ? "builder-kernel"
        : descriptor.owner.identifier as CapabilityUpgradeFileAction["owner"],
    ownership: descriptor.ownership,
  };
}

async function deriveSiteRoutingActions(input: Readonly<{
  reader: RepositoryReader;
  source: RenderedSkeleton;
  target: RenderedSkeleton;
}>): Promise<PlanningResult<readonly CapabilityUpgradeAction[]>> {
  const [sourceLockfile, targetLockfile] = await Promise.all([
    readFile(createRecipeLockfileUrl("0.8.0")),
    readFile(createRecipeLockfileUrl("0.9.0")),
  ]);
  const sourceBytes = new Map(
    input.source.files.map(({ path, content }) => [path, content]),
  );
  sourceBytes.set(
    ".egeria/project.yaml",
    encoder.encode(serializeProjectYaml(input.source.project)),
  );
  sourceBytes.set("pnpm-lock.yaml", new Uint8Array(sourceLockfile));
  const targetBytes = new Map(
    input.target.files.map(({ path, content }) => [path, content]),
  );
  targetBytes.set(
    ".egeria/project.yaml",
    encoder.encode(serializeProjectYaml(input.target.project)),
  );
  targetBytes.set("pnpm-lock.yaml", new Uint8Array(targetLockfile));

  const changedPaths = [...targetBytes]
    .filter(([path, content]) => {
      const source = sourceBytes.get(path);
      return source === undefined || !sameBytes(source, content);
    })
    .map(([path]) => path)
    .sort(compareText);
  if (!sameOrderedValues(changedPaths, siteRoutingUpgradePaths)) {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }

  const actions: CapabilityUpgradeAction[] = [];
  for (const path of siteRoutingUpgradePaths) {
    const source = sourceBytes.get(path);
    const target = targetBytes.get(path);
    const owner = siteRoutingActionOwner(path, input.target);
    if (target === undefined || owner === undefined) {
      return planningFailure("PROJECT_INSPECTION_INVALID");
    }

    const current = await readRepositoryBytes(input.reader, path);
    if (source === undefined) {
      if (current.kind !== "missing") {
        return planningFailure("CAPABILITY_ACTION_CONFLICT");
      }
      actions.push({
        kind: "create-file",
        path,
        ...owner,
        targetFingerprint: fingerprintFileContent(target),
      });
      continue;
    }
    if (current.kind !== "file" || !sameBytes(current.content, source)) {
      return planningFailure("PROJECT_DRIFT_DETECTED");
    }
    actions.push({
      kind: "replace-file",
      path,
      ...owner,
      targetFingerprint: fingerprintFileContent(target),
    });
  }

  return { ok: true, value: actions };
}

async function planSiteRoutingUpgrade(input: Readonly<{
  reader: RepositoryReader;
  git: Extract<GitWorktreeInspection, Readonly<{ ok: true }>>;
}>): Promise<PlanningResult<CapabilityUpgradePlan>> {
  const reader = createCachingRepositoryReader(input.reader);
  const controls = await readControlSources(reader);
  if (!controls.ok) {
    return planningFailure("PROJECT_STATE_INCOMPATIBLE");
  }

  const installedVersion = sourceVersion(controls.state, "site-routing");
  if (installedVersion === undefined) {
    return planningFailure("CAPABILITY_VERSION_AMBIGUOUS");
  }
  const edge = resolveSupportedCapabilityUpgrade({
    capability: "site-routing",
    fromVersion: installedVersion,
    toVersion: "0.4.0",
  });
  if (!edge.ok) {
    return planningFailure(edge.code);
  }

  const sourceCatalog = createCapabilityCatalogSnapshot(
    verifiedCapabilityPackageVersions,
    { standards: "0.4.0", siteRouting: "0.3.0" },
  );
  if (!sourceCatalog.ok) {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }
  const sourceProfiles = createProfileRecipeSnapshot("0.10.0");
  const inspectionCandidate = await inspectProject({
    reader,
    catalog: sourceCatalog.value,
    profiles: sourceProfiles,
  });
  if (
    inspectionCandidate.inference.capabilities.find(
      ({ identifier }) => identifier === "site-routing",
    )?.category === "ambiguous"
  ) {
    return planningFailure("CAPABILITY_VERSION_AMBIGUOUS");
  }
  const inspection = validInspection(inspectionCandidate);
  if (inspection?.project.value.originProfile !== "site") {
    return planningFailure("PROJECT_STATE_INCOMPATIBLE");
  }
  if (!hasExactAgreement(inspection, edge.value)) {
    return planningFailure("PROJECT_STATE_INCOMPATIBLE");
  }
  if (hasUnsupportedEjection(inspection)) {
    return planningFailure("PROJECT_EJECTION_UNSUPPORTED");
  }
  if (hasMaterialDrift(inspection)) {
    return planningFailure("PROJECT_DRIFT_DETECTED");
  }

  const project = inspection.project.value;
  if (
    controls.sources.get(".egeria/project.yaml") !== serializeProjectYaml(project)
  ) {
    return planningFailure("PROJECT_DRIFT_DETECTED");
  }
  const booking = project.capabilitySettings["booking-calendly"];
  const request = {
    profile: "site" as const,
    projectName: project.project.name,
    displayName: project.project.displayName,
    packageVersions: verifiedCapabilityPackageVersions,
    ...(booking === undefined ? {} : { bookingCalendly: booking }),
  };
  const [sourceResult, targetResult] = await Promise.all([
    renderSkeleton(request, {
      catalogSnapshot: { standards: "0.4.0", siteRouting: "0.3.0" },
      profiles: sourceProfiles,
    }),
    renderSkeleton(request, {
      catalogSnapshot: { standards: "0.4.0", siteRouting: "0.4.0" },
      profiles: profileRecipes,
    }),
  ]);
  if (!sourceResult.ok || !targetResult.ok) {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }
  if (
    hasSurfaceInventoryDrift(controls.state.managedSurfaces, [
      ...sourceResult.value.surfaces,
      ...createBuilderStateSurfaces(),
    ])
  ) {
    return planningFailure("PROJECT_DRIFT_DETECTED");
  }

  const actions = await deriveSiteRoutingActions({
    reader,
    source: sourceResult.value,
    target: targetResult.value,
  });
  if (!actions.ok) {
    return actions;
  }
  const capabilities = inspection.resolution.value.capabilities
    .map(({ identifier }) => identifier)
    .sort(compareText);
  const plan: CapabilityUpgradePlanBody = {
    operation: "upgrade-capability",
    status: "approval-required",
    baseRevision: input.git.identity.revision,
    profile: "site",
    capability: {
      identifier: "site-routing",
      fromVersion: "0.3.0",
      toVersion: "0.4.0",
    },
    source: edge.value.source,
    target: edge.value.target,
    controlFiles: controlFileEvidence(controls.sources),
    currentCapabilities: capabilities,
    desiredCapabilities: capabilities,
    actions: actions.value,
    requiredApprovals: ["transform", "verified-final-diff"],
    persistenceOrder: [
      "transform",
      "verify",
      "re-infer",
      "append-migration-record",
      "persist-state",
      "verify-state-and-inference",
    ],
  };
  return {
    ok: true,
    value: {
      ...plan,
      planFingerprint: fingerprintPlan({ plan, git: input.git }),
    },
  };
}

export async function planCapabilityUpgrade(input: Readonly<{
  reader: RepositoryReader;
  git: Extract<GitWorktreeInspection, Readonly<{ ok: true }>>;
  capability: "site-routing" | "standards";
  toVersion: "0.4.0";
}>): Promise<PlanningResult<CapabilityUpgradePlan>> {
  const capability: unknown = Reflect.get(input, "capability");
  const toVersion: unknown = Reflect.get(input, "toVersion");

  if (
    (capability !== "standards" && capability !== "site-routing") ||
    toVersion !== "0.4.0"
  ) {
    return planningFailure("CAPABILITY_UPGRADE_UNSUPPORTED");
  }

  if (capability === "site-routing") {
    return planSiteRoutingUpgrade({ reader: input.reader, git: input.git });
  }

  const reader = createCachingRepositoryReader(input.reader);
  const controls = await readControlSources(reader);

  if (!controls.ok) {
    return planningFailure("PROJECT_STATE_INCOMPATIBLE");
  }

  const installedVersion = sourceVersion(controls.state, "standards");
  if (installedVersion === undefined) {
    return planningFailure("CAPABILITY_VERSION_AMBIGUOUS");
  }

  const edgeResult = resolveSupportedCapabilityUpgrade({
    capability,
    fromVersion: installedVersion,
    toVersion,
  });

  if (!edgeResult.ok) {
    return planningFailure(edgeResult.code);
  }

  const sourceCatalog = createCapabilityCatalogSnapshot(
    verifiedCapabilityPackageVersions,
    { standards: edgeResult.value.fromVersion },
  );
  const targetCatalog = createCapabilityCatalogSnapshot(
    verifiedCapabilityPackageVersions,
    { standards: edgeResult.value.toVersion },
  );

  if (!sourceCatalog.ok || !targetCatalog.ok) {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }

  const inspectionCandidate = await inspectProject({
    reader,
    catalog: sourceCatalog.value,
    profiles: createProfileRecipeSnapshot(edgeResult.value.source.recipeVersion),
  });
  const standardsInference = inspectionCandidate.inference.capabilities.find(
    ({ identifier }) => identifier === "standards",
  );

  if (standardsInference?.category === "ambiguous") {
    return planningFailure("CAPABILITY_VERSION_AMBIGUOUS");
  }

  const inspection = validInspection(inspectionCandidate);
  if (inspection === undefined) {
    return planningFailure("PROJECT_STATE_INCOMPATIBLE");
  }

  if (!hasExactAgreement(inspection, edgeResult.value)) {
    return planningFailure("PROJECT_STATE_INCOMPATIBLE");
  }

  if (hasUnsupportedEjection(inspection)) {
    return planningFailure("PROJECT_EJECTION_UNSUPPORTED");
  }

  if (hasMaterialDrift(inspection)) {
    return planningFailure("PROJECT_DRIFT_DETECTED");
  }

  const project = inspection.project.value;
  const state = inspection.inference.state.value;
  const projectSource = controls.sources.get(".egeria/project.yaml");
  if (projectSource !== serializeProjectYaml(project)) {
    return planningFailure("PROJECT_DRIFT_DETECTED");
  }

  const rendered = await renderSkeleton(
    {
      profile: project.originProfile,
      projectName: project.project.name,
      displayName: project.project.displayName,
      packageVersions: verifiedCapabilityPackageVersions,
      ...(project.capabilitySettings["booking-calendly"] === undefined
        ? {}
        : {
            bookingCalendly:
              project.capabilitySettings["booking-calendly"],
          }),
    },
    {
      catalogSnapshot: { standards: "0.4.0", siteRouting: "0.3.0" },
      profiles: createProfileRecipeSnapshot("0.10.0"),
    },
  );

  if (!rendered.ok) {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }

  const sourceStandards = sourceCatalog.value.find(
    ({ identifier }) => identifier === "standards",
  );
  const targetStandards = targetCatalog.value.find(
    ({ identifier }) => identifier === "standards",
  );

  if (sourceStandards === undefined || targetStandards === undefined) {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }

  if (
    hasSurfaceInventoryDrift(
      state.managedSurfaces,
      expectedSourceSurfaces({
        rendered: rendered.value,
        sourceStandards: sourceStandards.managedSurfaces,
      }),
    )
  ) {
    return planningFailure("PROJECT_DRIFT_DETECTED");
  }

  const sourceFiles = await validateSourceStandardsFiles({
    reader,
    rendered: rendered.value,
    sourceSurfaces: sourceStandards.managedSurfaces,
  });
  if (!sourceFiles.ok) {
    return sourceFiles;
  }

  const actions = await deriveActions({
    reader,
    rendered: rendered.value,
    sourceStandards: sourceStandards.managedSurfaces,
    targetStandards: targetStandards.managedSurfaces,
  });
  if (!actions.ok) {
    return actions;
  }

  const capabilities = inspection.resolution.value.capabilities
    .map(({ identifier }) => identifier)
    .sort(compareText);
  const plan: CapabilityUpgradePlanBody = {
    operation: "upgrade-capability",
    status: "approval-required",
    baseRevision: input.git.identity.revision,
    profile: project.originProfile,
    capability: {
      identifier: "standards",
      fromVersion: edgeResult.value.fromVersion,
      toVersion: edgeResult.value.toVersion,
    },
    source: edgeResult.value.source,
    target: edgeResult.value.target,
    controlFiles: controlFileEvidence(controls.sources),
    currentCapabilities: capabilities,
    desiredCapabilities: capabilities,
    actions: actions.value,
    requiredApprovals: ["transform", "verified-final-diff"],
    persistenceOrder: [
      "transform",
      "verify",
      "re-infer",
      "append-migration-record",
      "persist-state",
      "verify-state-and-inference",
    ],
  };

  return {
    ok: true,
    value: {
      ...plan,
      planFingerprint: fingerprintPlan({ plan, git: input.git }),
    },
  };
}
