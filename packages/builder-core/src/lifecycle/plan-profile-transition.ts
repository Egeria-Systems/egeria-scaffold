import { createHash } from "node:crypto";

import { createCapabilityCatalogSnapshot } from "../catalog/capability-catalog.js";
import { verifiedCapabilityPackageVersions } from "../catalog/verified-package-versions.js";
import type { ManagedSurfaceDescriptor } from "../contracts/capability.js";
import type { ContractIssue } from "../contracts/result.js";
import type { InstalledState, InstalledSurface } from "../contracts/state.js";
import {
  inspectProject,
  type ProjectInspection,
} from "../diagnostics/project-inspection.js";
import { createBuilderStateSurfaces } from "../generation/builder-state-surfaces.js";
import {
  renderSkeleton,
  type RenderedSkeleton,
} from "../generation/render-skeleton.js";
import { createInstalledManifest } from "../manifest/create-installed-manifest.js";
import { fingerprintFileContent } from "../ownership/fingerprint.js";
import { createProfileRecipeSnapshot } from "../profiles/profile-recipes.js";
import { createCachingRepositoryReader } from "../repository/cache-reader.js";
import type { RepositoryReader } from "../repository/repository-reader.js";
import { stringifyCanonicalJson } from "../serialization/canonical-json.js";
import {
  parseMigrationLog,
  parseProjectYaml,
  parseStateJson,
  serializeProjectYaml,
} from "../state/codecs.js";
import type { GitWorktreeInspection } from "./git-worktree-inspection.js";
import {
  resolveSupportedProfileTransition,
  type SupportedProfileTransitionResolutionFailureCode,
} from "./supported-profile-transitions.js";

export type ProfileTransitionPlanningFailureCode =
  | SupportedProfileTransitionResolutionFailureCode
  | "PROFILE_INFERENCE_AMBIGUOUS"
  | "PROFILE_TRANSITION_ACTION_CONFLICT"
  | "PROJECT_DRIFT_DETECTED"
  | "PROJECT_EJECTION_UNSUPPORTED"
  | "PROJECT_INSPECTION_INVALID"
  | "PROJECT_STATE_INCOMPATIBLE";

export type ProfileTransitionControlFileEvidence = Readonly<{
  path:
    | ".egeria/migrations.jsonl"
    | ".egeria/project.yaml"
    | ".egeria/state.json";
  fingerprint: `sha256:${string}`;
}>;

export type ProfileTransitionCapabilitySubject = Readonly<{
  identifier: string;
  version: string;
}>;

export type ProfileTransitionEndpoint = Readonly<{
  profile: "portfolio" | "site";
  recipeVersion: "0.10.0";
  capabilities: readonly ProfileTransitionCapabilitySubject[];
}>;

export type ProfileTransitionAction = Readonly<{
  kind: "create-file" | "replace-file";
  path: string;
  ownership: "application-owned" | "managed";
  owner: "builder-kernel" | "content-files" | "site-routing" | "standards";
  currentSubject:
    | Readonly<{ kind: "absent" }>
    | Readonly<{
        kind: "fingerprint";
        fingerprint: `sha256:${string}`;
      }>;
  targetFingerprint: `sha256:${string}`;
}>;

export type ProfileTransitionPlan = Readonly<{
  operation: "transition-profile";
  status: "approval-required";
  planFingerprint: `sha256:${string}`;
  baseRevision: string;
  source: ProfileTransitionEndpoint & Readonly<{ profile: "portfolio" }>;
  target: ProfileTransitionEndpoint & Readonly<{ profile: "site" }>;
  controlFiles: readonly ProfileTransitionControlFileEvidence[];
  actions: readonly ProfileTransitionAction[];
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

type ProfileTransitionPlanBody = Omit<ProfileTransitionPlan, "planFingerprint">;
type PlanningIssue = Omit<ContractIssue, "code"> &
  Readonly<{ code: ProfileTransitionPlanningFailureCode }>;
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
type ControlSources = Readonly<{
  sources: ReadonlyMap<(typeof controlPaths)[number], string>;
  project: Extract<ReturnType<typeof parseProjectYaml>, Readonly<{ ok: true }>>;
  state: Extract<ReturnType<typeof parseStateJson>, Readonly<{ ok: true }>>;
  migrations: Extract<
    ReturnType<typeof parseMigrationLog>,
    Readonly<{ ok: true }>
  >;
}>;

const encoder = new TextEncoder();
const controlPaths = [
  ".egeria/migrations.jsonl",
  ".egeria/project.yaml",
  ".egeria/state.json",
] as const;
const transitionFilePaths = [
  "apps/web/app/about/page.tsx",
  "apps/web/content/en-CA/about.yaml",
  "apps/web/content/en-CA/long-form/introduction.md",
  "apps/web/content/en-CA/site.yaml",
  "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
] as const;
const actionOwners = new Map<
  string,
  Readonly<{
    ownership: "application-owned" | "managed";
    owner: ProfileTransitionAction["owner"];
  }>
>([
  [
    ".egeria/project.yaml",
    { ownership: "managed", owner: "builder-kernel" },
  ],
  [
    "apps/web/app/about/page.tsx",
    { ownership: "application-owned", owner: "site-routing" },
  ],
  [
    "apps/web/content/en-CA/about.yaml",
    { ownership: "application-owned", owner: "site-routing" },
  ],
  [
    "apps/web/content/en-CA/long-form/introduction.md",
    { ownership: "application-owned", owner: "content-files" },
  ],
  [
    "apps/web/content/en-CA/site.yaml",
    { ownership: "application-owned", owner: "content-files" },
  ],
  [
    "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
    { ownership: "application-owned", owner: "standards" },
  ],
  [
    "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
    { ownership: "application-owned", owner: "standards" },
  ],
]);

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.length === right.length &&
    left.every((byte, index) => byte === right[index])
  );
}

function planningFailure(
  code: ProfileTransitionPlanningFailureCode,
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

function sameOrderedValues<T>(left: readonly T[], right: readonly T[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function sameJson(left: unknown, right: unknown): boolean {
  return stringifyCanonicalJson(left) === stringifyCanonicalJson(right);
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

async function readControlSources(
  reader: RepositoryReader,
): Promise<ControlSources | undefined> {
  const sources = new Map<(typeof controlPaths)[number], string>();

  for (const path of controlPaths) {
    const result = await reader.readText(path);
    if (result.kind !== "file") {
      return undefined;
    }
    sources.set(path, result.content);
  }

  const project = parseProjectYaml(sources.get(".egeria/project.yaml") ?? "");
  const state = parseStateJson(sources.get(".egeria/state.json") ?? "");
  const migrations = parseMigrationLog(
    sources.get(".egeria/migrations.jsonl") ?? "",
  );

  return project.ok && state.ok && migrations.ok
    ? { sources, project, state, migrations }
    : undefined;
}

function capabilitySubjects(
  rendered: RenderedSkeleton,
): readonly ProfileTransitionCapabilitySubject[] {
  return rendered.resolved.capabilities
    .map(({ identifier, version }) => ({ identifier, version }))
    .sort((left, right) => compareText(left.identifier, right.identifier));
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

function sameInstalledSurfaceDescriptor(
  installed: InstalledSurface,
  expected: ManagedSurfaceDescriptor,
): boolean {
  return (
    installed.identifier === expected.identifier &&
    installed.path === expected.path &&
    installed.ownership === expected.ownership &&
    installed.mergeStrategy === expected.mergeStrategy &&
    sameSurfaceOwner(installed.owner, expected.owner) &&
    sameFingerprintTarget(
      installed.fingerprintTarget,
      expected.fingerprintTarget,
    )
  );
}

function exactSurfaceInventory(
  installed: readonly InstalledSurface[],
  expected: readonly ManagedSurfaceDescriptor[],
): boolean {
  const installedByIdentifier = new Map(
    installed.map((surface) => [surface.identifier, surface]),
  );

  return (
    installed.length === expected.length &&
    installedByIdentifier.size === installed.length &&
    expected.every((surface) => {
      const current = installedByIdentifier.get(surface.identifier);
      return (
        current !== undefined &&
        sameInstalledSurfaceDescriptor(current, surface)
      );
    })
  );
}

function expectedSourceSurfaces(input: Readonly<{
  rendered: RenderedSkeleton;
}>): readonly ManagedSurfaceDescriptor[] {
  return [...input.rendered.surfaces, ...createBuilderStateSurfaces()];
}

function hasExactAgreement(
  inspection: ValidInspection,
  controls: ControlSources,
  rendered: RenderedSkeleton,
): PlanningResult<void> {
  const project = inspection.project.value;
  const state = inspection.inference.state.value;
  const desiredIdentifiers = rendered.resolved.capabilities.map(
    ({ identifier }) => identifier,
  );
  const expectedManifest = createInstalledManifest(rendered.resolved);
  const migrationIdentifiers = inspection.migrations.value.map(
    ({ identifier }) => identifier,
  );
  const inferenceByIdentifier = new Map(
    inspection.inference.capabilities.map((evidence) => [
      evidence.identifier,
      evidence,
    ]),
  );
  const siteRouting = inferenceByIdentifier.get("site-routing");

  if (
    siteRouting !== undefined &&
    (siteRouting.category === "partial" ||
      siteRouting.category === "ambiguous" ||
      siteRouting.category === "contradictory")
  ) {
    return planningFailure("PROFILE_INFERENCE_AMBIGUOUS");
  }

  const unexpectedInference = inspection.inference.capabilities.some(
    ({ category, identifier }) =>
      !desiredIdentifiers.includes(identifier) &&
      identifier !== "site-routing" &&
      (category === "ambiguous" ||
        category === "contradictory" ||
        category === "partial" ||
        category === "probable"),
  );
  if (unexpectedInference) {
    return planningFailure("PROFILE_INFERENCE_AMBIGUOUS");
  }

  if (
    project.originProfile !== rendered.resolved.profile ||
    project.recipeVersion !== rendered.resolved.recipeVersion ||
    state.origin.profile !== project.originProfile ||
    state.origin.recipeVersion !== project.recipeVersion ||
    rendered.resolved.profile !== project.originProfile ||
    rendered.resolved.recipeVersion !== project.recipeVersion ||
    !sameOrderedValues(project.selectedCapabilities, desiredIdentifiers) ||
    !sameJson(state.installedCapabilities, expectedManifest) ||
    !sameOrderedValues(state.appliedMigrations, migrationIdentifiers) ||
    !desiredIdentifiers.every(
      (identifier) =>
        inferenceByIdentifier.get(identifier)?.category === "confirmed",
    ) ||
    controls.project.value.originProfile !== project.originProfile ||
    controls.state.value.origin.profile !== state.origin.profile
  ) {
    return planningFailure("PROJECT_STATE_INCOMPATIBLE");
  }

  return { ok: true, value: undefined };
}

function sourceAndTargetBytes(input: Readonly<{
  controls: ControlSources;
  source: RenderedSkeleton;
  target: RenderedSkeleton;
}>): ReadonlyMap<
  string,
  Readonly<{ source?: Uint8Array; target: Uint8Array }>
> | undefined {
  const sourceFiles = new Map(
    input.source.files.map(({ path, content }) => [path, content]),
  );
  const targetFiles = new Map(
    input.target.files.map(({ path, content }) => [path, content]),
  );
  const changedPaths = new Set<string>();

  for (const [path, target] of targetFiles) {
    const source = sourceFiles.get(path);
    if (source === undefined || !sameBytes(source, target)) {
      changedPaths.add(path);
    }
  }
  for (const path of sourceFiles.keys()) {
    if (!targetFiles.has(path)) {
      return undefined;
    }
  }

  if (
    changedPaths.size !== transitionFilePaths.length ||
    transitionFilePaths.some((path) => !changedPaths.has(path))
  ) {
    return undefined;
  }

  const result = new Map<
    string,
    Readonly<{ source?: Uint8Array; target: Uint8Array }>
  >();
  result.set(".egeria/project.yaml", {
    source: encoder.encode(
      input.controls.sources.get(".egeria/project.yaml") ?? "",
    ),
    target: encoder.encode(serializeProjectYaml(input.target.project)),
  });

  for (const path of transitionFilePaths) {
    const target = targetFiles.get(path);
    if (target === undefined) {
      return undefined;
    }
    const source = sourceFiles.get(path);
    result.set(path, {
      ...(source === undefined ? {} : { source }),
      target,
    });
  }

  return result;
}

function actionSourceFingerprintsAgree(
  state: InstalledState,
  bytes: ReadonlyMap<
    string,
    Readonly<{ source?: Uint8Array; target: Uint8Array }>
  >,
): boolean {
  return [...bytes].every(([path, values]) => {
    if (values.source === undefined) {
      return true;
    }
    const matches = state.managedSurfaces.filter(
      (surface) =>
        surface.path === path && surface.fingerprintTarget.kind === "file",
    );
    return (
      matches.length === 1 &&
      matches[0]?.fingerprint === fingerprintFileContent(values.source)
    );
  });
}

async function deriveActions(input: Readonly<{
  reader: RepositoryReader;
  bytes: ReadonlyMap<
    string,
    Readonly<{ source?: Uint8Array; target: Uint8Array }>
  >;
}>): Promise<PlanningResult<readonly ProfileTransitionAction[]>> {
  const actions: ProfileTransitionAction[] = [];

  for (const path of [...input.bytes.keys()].sort(compareText)) {
    const values = input.bytes.get(path);
    const owner = actionOwners.get(path);
    if (values === undefined || owner === undefined) {
      return planningFailure("PROJECT_INSPECTION_INVALID");
    }

    const current = await input.reader.readBytes?.(path);
    if (current === undefined) {
      return planningFailure("PROJECT_INSPECTION_INVALID");
    }
    if (values.source === undefined) {
      if (current.kind !== "missing") {
        return planningFailure("PROFILE_TRANSITION_ACTION_CONFLICT");
      }
      actions.push({
        kind: "create-file",
        path,
        ...owner,
        currentSubject: { kind: "absent" },
        targetFingerprint: fingerprintFileContent(values.target),
      });
      continue;
    }

    if (
      current.kind !== "file" ||
      !sameBytes(current.content, values.source)
    ) {
      return planningFailure("PROJECT_DRIFT_DETECTED");
    }

    actions.push({
      kind: "replace-file",
      path,
      ...owner,
      currentSubject: {
        kind: "fingerprint",
        fingerprint: fingerprintFileContent(values.source),
      },
      targetFingerprint: fingerprintFileContent(values.target),
    });
  }

  return { ok: true, value: actions };
}

function controlFileEvidence(
  sources: ReadonlyMap<(typeof controlPaths)[number], string>,
): readonly ProfileTransitionControlFileEvidence[] {
  return controlPaths.map((path) => ({
    path,
    fingerprint: fingerprintFileContent(encoder.encode(sources.get(path) ?? "")),
  }));
}

function encodeBytes(bytes: Uint8Array | undefined): string | null {
  return bytes === undefined ? null : Buffer.from(bytes).toString("base64");
}

function fingerprintPlan(input: Readonly<{
  plan: ProfileTransitionPlanBody;
  controls: ControlSources;
  source: RenderedSkeleton;
  target: RenderedSkeleton;
  sourceSurfaces: readonly ManagedSurfaceDescriptor[];
  bytes: ReadonlyMap<
    string,
    Readonly<{ source?: Uint8Array; target: Uint8Array }>
  >;
  git: Extract<GitWorktreeInspection, Readonly<{ ok: true }>>;
}>): `sha256:${string}` {
  const sourceCatalog = createCapabilityCatalogSnapshot(
    verifiedCapabilityPackageVersions,
    { standards: "0.4.0" },
  );
  const targetCatalog = createCapabilityCatalogSnapshot(
    verifiedCapabilityPackageVersions,
    { standards: "0.4.0" },
  );
  if (!sourceCatalog.ok || !targetCatalog.ok) {
    throw new TypeError("profile-transition-catalog-invalid");
  }
  const rawControls = Object.fromEntries(input.controls.sources);
  const actionBytes = [...input.bytes]
    .sort(([left], [right]) => compareText(left, right))
    .map(([path, value]) => ({
      path,
      source: encodeBytes(value.source),
      target: encodeBytes(value.target),
    }));
  const fingerprintMaterial = {
    plan: input.plan,
    rawControls,
    parsedControls: {
      project: input.controls.project.value,
      state: input.controls.state.value,
      migrations: input.controls.migrations.value,
    },
    recipes: createProfileRecipeSnapshot("0.10.0"),
    sourceCatalog: sourceCatalog.value,
    targetCatalog: targetCatalog.value,
    sourceManifest: createInstalledManifest(input.source.resolved),
    targetManifest: createInstalledManifest(input.target.resolved),
    sourceSurfaces: input.sourceSurfaces,
    targetSurfaces: [
      ...input.target.surfaces,
      ...createBuilderStateSurfaces(),
    ],
    actionBytes,
    gitIdentity: input.git.identity,
  };
  const digest = createHash("sha256")
    .update(stringifyCanonicalJson(fingerprintMaterial), "utf8")
    .digest("hex");

  return `sha256:${digest}`;
}

async function planProfileTransitionInternal(input: Readonly<{
  reader: RepositoryReader;
  git: Extract<GitWorktreeInspection, Readonly<{ ok: true }>>;
  toProfile: "site";
}>): Promise<PlanningResult<ProfileTransitionPlan>> {
  const toProfile: unknown = Reflect.get(input, "toProfile");
  if (toProfile !== "site") {
    return planningFailure("PROFILE_TRANSITION_UNSUPPORTED");
  }

  const reader = createCachingRepositoryReader(input.reader);
  const controls = await readControlSources(reader);
  if (controls === undefined) {
    return planningFailure("PROJECT_STATE_INCOMPATIBLE");
  }

  if (
    controls.project.value.ejectedAreas.length > 0 ||
    controls.state.value.ejections.length > 0
  ) {
    return planningFailure("PROJECT_EJECTION_UNSUPPORTED");
  }

  const catalog = createCapabilityCatalogSnapshot(
    verifiedCapabilityPackageVersions,
    { standards: "0.4.0" },
  );
  if (!catalog.ok) {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }
  const inspectionCandidate = await inspectProject({
    reader,
    catalog: catalog.value,
    profiles: createProfileRecipeSnapshot("0.10.0"),
  });
  const inspection = validInspection(inspectionCandidate);
  if (inspection === undefined) {
    return planningFailure("PROJECT_STATE_INCOMPATIBLE");
  }

  const project = controls.project.value;
  const booking = project.capabilitySettings["booking-calendly"];
  const renderInput = {
    projectName: project.project.name,
    displayName: project.project.displayName,
    packageVersions: verifiedCapabilityPackageVersions,
    ...(booking === undefined ? {} : { bookingCalendly: booking }),
  };
  const sourceResult = await renderSkeleton({
    ...renderInput,
    profile: project.originProfile,
  });
  if (!sourceResult.ok) {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }
  const source = sourceResult.value;

  const agreement = hasExactAgreement(
    inspection,
    controls,
    source,
  );
  if (!agreement.ok) {
    return agreement;
  }
  if (
    controls.sources.get(".egeria/project.yaml") !==
    serializeProjectYaml(source.project)
  ) {
    return planningFailure("PROJECT_DRIFT_DETECTED");
  }

  if (
    inspection.inference.surfaces.some(({ status }) => status === "ejected")
  ) {
    return planningFailure("PROJECT_EJECTION_UNSUPPORTED");
  }
  if (
    inspection.inference.surfaces.some(
      ({ status }) =>
        status !== "confirmed" && status !== "application-owned",
    )
  ) {
    return planningFailure("PROJECT_DRIFT_DETECTED");
  }

  const sourceSurfaces = expectedSourceSurfaces({ rendered: source });
  if (
    !exactSurfaceInventory(
      controls.state.value.managedSurfaces,
      sourceSurfaces,
    )
  ) {
    return planningFailure("PROJECT_DRIFT_DETECTED");
  }

  const edge = resolveSupportedProfileTransition({
    fromProfile: project.originProfile,
    fromRecipeVersion: project.recipeVersion,
    toProfile,
    toRecipeVersion: "0.10.0",
  });
  if (!edge.ok) {
    return planningFailure(edge.code);
  }

  const targetResult = await renderSkeleton({
    ...renderInput,
    profile: "site",
  });
  if (!targetResult.ok) {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }
  const target = targetResult.value;
  const bytes = sourceAndTargetBytes({ controls, source, target });
  if (bytes === undefined) {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }
  if (!actionSourceFingerprintsAgree(controls.state.value, bytes)) {
    return planningFailure("PROJECT_DRIFT_DETECTED");
  }
  const actions = await deriveActions({ reader, bytes });
  if (!actions.ok) {
    return actions;
  }

  const plan: ProfileTransitionPlanBody = {
    operation: "transition-profile",
    status: "approval-required",
    baseRevision: input.git.identity.revision,
    source: {
      ...edge.value.source,
      capabilities: capabilitySubjects(source),
    },
    target: {
      ...edge.value.target,
      capabilities: capabilitySubjects(target),
    },
    controlFiles: controlFileEvidence(controls.sources),
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
      planFingerprint: fingerprintPlan({
        plan,
        controls,
        source,
        target,
        sourceSurfaces,
        bytes,
        git: input.git,
      }),
    },
  };
}

export async function planProfileTransition(input: Readonly<{
  reader: RepositoryReader;
  git: Extract<GitWorktreeInspection, Readonly<{ ok: true }>>;
  toProfile: "site";
}>): Promise<PlanningResult<ProfileTransitionPlan>> {
  try {
    return await planProfileTransitionInternal(input);
  } catch {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }
}
