import { stringify } from "yaml";
import type { ManagedSurfaceDescriptor } from "../contracts/capability.js";
import type { GeneratedFile, RenderedSkeleton } from "../generation/render-skeleton.js";
import { fingerprintFileContent, fingerprintJsonValue } from "../ownership/fingerprint.js";
import { stringifyCanonicalJson } from "../serialization/canonical-json.js";
import type { AppTransitionContentValidators } from "./app-transition-content-validation.js";
import { resolveSupportedProfileTransition } from "./supported-profile-transitions.js";
export type AppTransitionFailureCode = "PROFILE_TRANSITION_CONTENT_INVALID" | "PROFILE_TRANSITION_ACTION_CONFLICT" | "PROFILE_TRANSITION_VISUAL_EVIDENCE_REQUIRED" | "PROJECT_DRIFT_DETECTED" | "PROJECT_INSPECTION_INVALID";
export type AppTransitionResult<T> = Readonly<{
  ok: true;
  value: T;
}> | Readonly<{
  ok: false;
  issues: readonly Readonly<{
    code: AppTransitionFailureCode;
    path: readonly [
    ];
    context: Readonly<{
      reason: "precondition-refused";
    }>;
  }>[];
}>;
export type AppTransitionPathFingerprint = Readonly<{
  path: string;
  fingerprint: `sha256:${string}`;
}>;
export type AppTransitionDisposition = Readonly<{
  kind: "preserve-file" | "create-file" | "replace-file" | "migrate-file" | "merge-json";
  path: string;
  reason: "compatible-content" | "target-required" | "recognized-source" | "content-preserving-migration" | "exact-package-members";
  ownership: "application-owned" | "managed" | "merge-managed";
  owner: string;
}>;
export type AppTransitionPreparation = Readonly<{
  files: readonly GeneratedFile[];
  dispositions: readonly AppTransitionDisposition[];
  preservedFingerprints: readonly AppTransitionPathFingerprint[];
  influencingFingerprints: readonly AppTransitionPathFingerprint[];
}>;
export type AppTransitionVisualEvidence = Readonly<{
  manifestFingerprint: `sha256:${string}`;
  sourceProfile: "portfolio" | "site";
  optionalCapabilities: readonly string[];
  influencingFingerprints: readonly AppTransitionPathFingerprint[];
  baselines: readonly GeneratedFile[];
  targetLockfileFingerprint?: `sha256:${string}`;
}>;
export const appTransitionVisualProject = Object.freeze({
  projectName: "app-transition-visual",
  displayName: "App transition",
});
export const appTransitionVisualBookingSettings = Object.freeze({
  destination: "https://calendly.com/example/discovery",
  mode: "popup" as const,
});
export const appTransitionVisualAnalyticsSettings = Object.freeze({
  consent: { policy: "explicit-opt-in" as const },
  providers: { cloudflareWebAnalytics: { siteToken: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } },
  operationalIntegrations: {},
});
// These fixed inputs and expected image identities require review together.
// The producer must regenerate and obtain approval before promoting images.
// Template/configuration/dependency changes require renewed visual evidence;
// recomputing a canonical render cannot silently approve new inputs.
export const appTransitionVisualInputRecord = Object.freeze({
  targetLockfileFingerprint: "sha256:6be34179936a9a700b51c0dc0d8c7b6c3472c7caf585bcb8caeb2005a2abd546",
  baselines: Object.freeze({
    monolingual: Object.freeze([
      "sha256:6f6dd1ddd3049d998ac51b4da17b7eb66ca481b89f9e4947fb68b0bce1af50d5",
      "sha256:00e95d03593487ac4a6bb3e08afe9a1df475ecb76b8b1f1da676259ccf551d27",
    ]),
    multilingual: Object.freeze([
      "sha256:d737921e3ceba92f58c1aa0fd728d7e8ecfd20dafb3e8241487e105d8f8aab8c",
      "sha256:b2eecb8f5a8d18f8b4f7516073b57f7faca8df1e947df37883e301d61403fd17",
    ]),
  }),
  subsets: Object.freeze({
    none: "sha256:8b8dc12f929d2142e73b6faf4e69f9a33a6c67f4e172490311bb1c5f7e37fd22",
    "booking-calendly": "sha256:a1aed8235073fed58c3a166aaeae61e59429bcabaea2e6ba1aa2087e287cb630",
    multilingual: "sha256:3a5d1abba0e635e611f6d248125a59dafbea2aadda7cd1fe0253f0e69e9fe2d9",
    "booking-calendly+multilingual": "sha256:6705bf4354f4296b6bc7f1d8a16e57fe9610ba86491448de957b587116c42404",
    analytics: "sha256:138ea42af4dc925789fb670e482c53d0cbc5ee304aa118ee610ced9079f304ff",
    "analytics+booking-calendly": "sha256:1e6c5e57eb1453cc152d2f425bd15574dffcdce8aa21eb5b857725b8f824010c",
    "analytics+multilingual": "sha256:ab6ff348028cd941f2d1c865ebe23818f80f6181836bf5220997fa4e99d0eb8a",
    "analytics+booking-calendly+multilingual": "sha256:01e06ed6a197332aeba54da7273eaf1890d08e85f51357332fb38f3862dd5b69",
  }),
});
export function verifyAppTransitionVisualInputRecord(input: Readonly<{
  optionalCapabilities: readonly string[];
  influencingFingerprints: readonly AppTransitionPathFingerprint[];
  targetLockfileFingerprint: `sha256:${string}`;
  baselines?: readonly GeneratedFile[];
}>): AppTransitionResult<Readonly<{ fingerprint: `sha256:${string}` }>> {
  const optionalCapabilities = [...input.optionalCapabilities].sort(compareText);
  const key = optionalCapabilities.join("+") || "none";
  const fingerprint = fingerprintJsonValue(input.influencingFingerprints);
  if (new Set(optionalCapabilities).size !== optionalCapabilities.length ||
      !Object.hasOwn(appTransitionVisualInputRecord.subsets, key) ||
      Reflect.get(appTransitionVisualInputRecord.subsets, key) !== fingerprint ||
      input.targetLockfileFingerprint !== appTransitionVisualInputRecord.targetLockfileFingerprint) {
    return appTransitionFailure("PROFILE_TRANSITION_VISUAL_EVIDENCE_REQUIRED");
  }
  const expectedBaselines = appTransitionVisualInputRecord.baselines[optionalCapabilities.includes("multilingual") ? "multilingual" : "monolingual"];
  if (input.baselines !== undefined) {
    const baselines = input.baselines;
    if (baselines.length !== appTransitionBaselinePaths.length ||
        appTransitionBaselinePaths.some((path, index) => {
          const matching = baselines.filter(file => file.path === path);
          const baseline = matching[0];
          return matching.length !== 1 || baseline === undefined || fingerprintFileContent(baseline.content) !== expectedBaselines[index];
        })) {
      return appTransitionFailure("PROFILE_TRANSITION_VISUAL_EVIDENCE_REQUIRED");
    }
  }
  return {ok:true,value:{fingerprint:fingerprintJsonValue({optionalCapabilities,influencingFingerprint:fingerprint,targetLockfileFingerprint:input.targetLockfileFingerprint,expectedBaselines})}};
}
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const maximumContentBytes = 1024 * 1024;
export const appTransitionBaselinePaths = [
  "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
] as const;
export function appTransitionFailure(code: AppTransitionFailureCode): AppTransitionResult<never> {
  return { ok: false, issues: [{
        code, path: [], context: { reason: "precondition-refused" }
      }] };
}
function compareText(left: string, right: string): number { return left < right ? -1 : left > right ? 1 : 0; }
function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((byte, index) => byte === right[index]);
}
function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("CONTENT_INVALID");
  }
  return value as Record<string, unknown>;
}
function text(bytes: Uint8Array): string {
  if (bytes.length > maximumContentBytes) {
    throw new TypeError("CONTENT_INVALID");
  }
  return decoder.decode(bytes);
}
function required(files: ReadonlyMap<string, Uint8Array>, path: string): Uint8Array {
  const bytes = files.get(path);
  if (bytes === undefined) {
    throw new TypeError("CONTENT_INVALID");
  }
  return bytes;
}
function serialize(value: unknown): Uint8Array {
  return encoder.encode(stringify(value, {
    version: "1.2", schema: "core", sortMapEntries: true, aliasDuplicateObjects: false, indent: 2, lineWidth: 0
  }));
}
function appendNavigation(source: unknown, target: unknown): unknown[] {
  if (!Array.isArray(source) || !Array.isArray(target)) {
    throw new TypeError("CONTENT_INVALID");
  }
  const sourceItems: readonly unknown[] = source;
  const targetItems: readonly unknown[] = target;
  const destinations = new Set(sourceItems.map(item => record(item).href));
  return [...sourceItems, ...targetItems.filter(item => !destinations.has(record(item).href))];
}
function migrateSite(source: Uint8Array, target: Uint8Array, validators: AppTransitionContentValidators): Uint8Array {
  const current = record(validators.parseSite(validators.parseYaml(text(source))));
  const desired = record(validators.parseSite(validators.parseYaml(text(target))));
  const migrated = { ...current, navigation: appendNavigation(current.navigation, desired.navigation) };
  validators.parseSite(migrated);
  const bytes = serialize(migrated);
  validators.parseSite(validators.parseYaml(text(bytes)));
  return bytes;
}
function localizedCatalogs(files: ReadonlyMap<string, Uint8Array>, profile: "portfolio" | "site", validators: AppTransitionContentValidators): readonly unknown[] {
  const catalogs = (["en-CA", "fr-CA"] as const).map(locale => validators.parseLocalized(validators.parseYaml(text(required(files, `apps/web/content/${locale}/localized-content.yaml`))), locale, profile));
  validators.assertParity(catalogs[0], catalogs[1], profile);
  return catalogs;
}
function migrateLocalized(source: ReadonlyMap<string, Uint8Array>, target: ReadonlyMap<string, Uint8Array>, validators: AppTransitionContentValidators): Map<string, Uint8Array> {
  const sourceCatalogs = localizedCatalogs(source, "portfolio", validators);
  const targetCatalogs = localizedCatalogs(target, "site", validators);
  const migrated = (["en-CA", "fr-CA"] as const).map((locale, index) => {
    const current = record(sourceCatalogs[index]);
    const desired = record(targetCatalogs[index]);
    const currentPages = record(current.pages);
    const desiredPages = record(desired.pages);
    const pages = {
      ...currentPages, about: desiredPages.about, workFeatured: desiredPages.workFeatured
    };
    return { locale, value: validators.parseLocalized({
        ...current, pages, navigation: appendNavigation(current.navigation, desired.navigation)
      }, locale, "site") };
  });
  validators.assertParity(migrated[0]?.value, migrated[1]?.value, "site");
  return new Map(migrated.map(({ locale, value }) => [`apps/web/content/${locale}/localized-content.yaml`, serialize(value)]));
}
function validateRoutedContent(
  files: ReadonlyMap<string, Uint8Array>,
  validators: AppTransitionContentValidators,
): void {
  for (const name of ["about", "not-found", "work-featured", "routing"]) {
    const bytes = files.get(`apps/web/content/en-CA/${name}.yaml`);
    if (bytes === undefined) continue;
    const value = validators.parseYaml(text(bytes));
    if (name === "routing") validators.parseRouting(value);
    else validators.parseRoutedPage(value);
  }
}
function validateAdditionalContent(
  files: ReadonlyMap<string, Uint8Array>,
  validators: AppTransitionContentValidators,
): void {
  const content = [
    ["apps/web/content/content.config.yaml", validators.parseConfiguration],
    ["apps/web/content/en-CA/observability.yaml", validators.parseErrorCopy],
    ["apps/web/content/en-CA/booking-calendly.yaml", validators.parseBooking],
    ["apps/web/content/en-CA/analytics.yaml", validators.parseAnalytics],
    ["apps/web/content/fr-CA/analytics.yaml", validators.parseAnalytics],
  ] as const;
  for (const [path, validate] of content) {
    const bytes = files.get(path);
    if (bytes !== undefined) validate(validators.parseYaml(text(bytes)));
  }
}
function fileSurface(surfaces: readonly ManagedSurfaceDescriptor[], path: string): ManagedSurfaceDescriptor | undefined {
  const matches = surfaces.filter(surface => surface.path === path && surface.fingerprintTarget.kind === "file");
  return matches.length === 1 ? matches[0] : undefined;
}
function owner(surface: ManagedSurfaceDescriptor): string {
  return surface.owner.kind === "builder-kernel" ? "builder-kernel" : surface.owner.identifier;
}
function mergeManifest(source: Uint8Array, target: Uint8Array, current: Uint8Array, profile: "portfolio" | "site", surfaces: readonly ManagedSurfaceDescriptor[], validators: AppTransitionContentValidators): Uint8Array {
  const before = record(JSON.parse(text(source)));
  const desired = record(JSON.parse(text(target)));
  const actual = record(JSON.parse(text(current)));
  validators.parseYaml(text(current));
  const pointers = ["/dependencies/effect", "/scripts/test:integration:cloudflare", ...(profile === "portfolio" ? ["/dependencies/next", "/devDependencies/eslint-config-next"] : [])];
  const merged = { ...actual };
  for (const pointer of pointers) {
    const [, section, member] = pointer.split("/");
    if (section === undefined || member === undefined || surfaces.filter(surface => surface.path === "apps/web/package.json" && surface.fingerprintTarget.kind === "json-value" && surface.fingerprintTarget.pointer === pointer).length !== 1) {
      throw new TypeError("CONTENT_INVALID");
    }
    const sourceSection = record(before[section]);
    const targetSection = record(desired[section]);
    const currentSection = record(actual[section]);
    if (stringifyCanonicalJson(currentSection[member] ?? null) !== stringifyCanonicalJson(sourceSection[member] ?? null) || Object.hasOwn(currentSection, member) !== Object.hasOwn(sourceSection, member)) {
      throw new TypeError("CONTENT_INVALID");
    }
    merged[section] = { ...record(merged[section]), [member]: targetSection[member] };
  }
  // The fixed lockfile can retain scripts/metadata, but cannot install an
  // unrepresented dependency graph. Dependency drift is never silently lost.
  for (const section of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies", "pnpm", "resolutions", "overrides"]) {
    if (stringifyCanonicalJson(actual[section] ?? null) !== stringifyCanonicalJson(before[section] ?? null)) {
      throw new TypeError("CONTENT_INVALID");
    }
  }
  return encoder.encode(`${stringifyCanonicalJson(merged)}\n`);
}
export function appTransitionInfluencingFingerprints(files: readonly GeneratedFile[]): readonly AppTransitionPathFingerprint[] {
  // Include runtime, build, manifest, workspace, and visual-runner inputs.
  // Exclusions are explicit non-rendered metadata and proven off-home data.
  return files.filter(({ path }) =>
    path !== ".gitignore" &&
    !path.startsWith(".github/") &&
    !/(?:^|\/)(?:AGENTS|README)\.md$/.test(path) &&
    (path === "apps/web/tests/visual/home-visual.spec.ts" || !/(?:^|\/)(?:docs|tests)\//.test(path)) &&
    !path.includes("/long-form/") &&
    !/^apps\/web\/content\/en-CA\/(?:about|work-featured|not-found|routing)\.yaml$/.test(path),
  ).map(({ path, content }) => ({ path, fingerprint: fingerprintFileContent(content) })).sort((a, b) => compareText(a.path, b.path));
}
export function prepareAppProfileTransition(input: Readonly<{
  source: RenderedSkeleton;
  target: RenderedSkeleton;
  currentFiles: ReadonlyMap<string, Uint8Array>;
  validators: AppTransitionContentValidators;
}>): AppTransitionResult<AppTransitionPreparation> {
  try {
    const profile = input.source.project.originProfile;
    const edge = resolveSupportedProfileTransition({
      fromProfile: profile, fromRecipeVersion: input.source.project.recipeVersion, toProfile: input.target.project.originProfile, toRecipeVersion: input.target.project.recipeVersion
    });
    if (!edge.ok || input.target.project.originProfile !== "app" || (profile !== "portfolio" && profile !== "site")) {
      return appTransitionFailure("PROJECT_INSPECTION_INVALID");
    }
    const source = new Map(input.source.files.map(({ path, content }) => [path, content]));
    const target = new Map(input.target.files.map(({ path, content }) => [path, content]));
    validateRoutedContent(input.currentFiles, input.validators);
    validateRoutedContent(target, input.validators);
    validateAdditionalContent(input.currentFiles, input.validators);
    validateAdditionalContent(target, input.validators);
    const multilingual = input.source.project.selectedCapabilities.includes("multilingual");
    input.validators.parseSite(input.validators.parseYaml(text(required(input.currentFiles, "apps/web/content/en-CA/site.yaml"))));
    input.validators.parseMarkdown(text(required(input.currentFiles, "apps/web/content/en-CA/long-form/introduction.md")));
    if (multilingual) {
      localizedCatalogs(input.currentFiles, profile, input.validators);
    }
    const migrated = multilingual && profile === "portfolio" ? migrateLocalized(input.currentFiles, target, input.validators) : new Map<string, Uint8Array>();
    if (profile === "portfolio" && !multilingual) {
      migrated.set("apps/web/content/en-CA/site.yaml", migrateSite(required(input.currentFiles, "apps/web/content/en-CA/site.yaml"), required(target, "apps/web/content/en-CA/site.yaml"), input.validators));
    }
    const paths = [...new Set([...source.keys(), ...target.keys()])].sort(compareText);
    const files: GeneratedFile[] = [];
    const dispositions: AppTransitionDisposition[] = [];
    const preservedFingerprints: AppTransitionPathFingerprint[] = [];
    for (const path of paths) {
      const previous = source.get(path);
      const desired = target.get(path);
      const current = input.currentFiles.get(path);
      if (previous !== undefined && current === undefined) {
        return appTransitionFailure("PROJECT_DRIFT_DETECTED");
      }
      if (previous === undefined && current !== undefined) {
        return appTransitionFailure("PROFILE_TRANSITION_ACTION_CONFLICT");
      }
      if (path === "apps/web/package.json") {
        const content = mergeManifest(required(source, path), required(target, path), required(input.currentFiles, path), profile, input.target.surfaces, input.validators);
        files.push({ path, content });
        dispositions.push({
          kind: "merge-json", path, reason: "exact-package-members", ownership: "merge-managed", owner: "builder-kernel"
        });
        continue;
      }
      const surface = fileSurface(input.target.surfaces, path) ?? fileSurface(input.source.surfaces, path);
      if (surface === undefined) {
        return appTransitionFailure("PROJECT_INSPECTION_INVALID");
      }
      const common = {
        path, owner: owner(surface), ownership: surface.ownership
      };
      if (previous === undefined && desired !== undefined) {
        files.push({ path, content: new Uint8Array(desired) });
        dispositions.push({
          ...common, kind: "create-file", reason: "target-required"
        });
        continue;
      }
      if (current === undefined || previous === undefined) {
        return appTransitionFailure("PROJECT_INSPECTION_INVALID");
      }
      if (desired === undefined) {
        return appTransitionFailure("PROFILE_TRANSITION_ACTION_CONFLICT");
      }
      if (surface.ownership !== "application-owned" && !sameBytes(current, previous)) {
        return appTransitionFailure("PROJECT_DRIFT_DETECTED");
      }
      const migration = migrated.get(path);
      if (migration !== undefined) {
        files.push({ path, content: migration });
        dispositions.push({
          ...common, kind: "migrate-file", reason: "content-preserving-migration"
        });
        continue;
      }
      const compatibleContent = surface.ownership === "application-owned" && (sameBytes(previous, desired) || path.endsWith(".md") || (multilingual && path === "apps/web/content/en-CA/site.yaml") || appTransitionBaselinePaths.some(baseline => baseline === path));
      if (compatibleContent || sameBytes(previous, desired)) {
        files.push({ path, content: new Uint8Array(current) });
        dispositions.push({
          ...common, kind: "preserve-file", reason: "compatible-content"
        });
        preservedFingerprints.push({ path, fingerprint: fingerprintFileContent(current) });
        continue;
      }
      if (!sameBytes(current, previous)) {
        return appTransitionFailure("PROJECT_DRIFT_DETECTED");
      }
      files.push({ path, content: new Uint8Array(desired) });
      dispositions.push({
        ...common, kind: "replace-file", reason: "recognized-source"
      });
    }
    return { ok: true, value: {
        files, dispositions, preservedFingerprints, influencingFingerprints: appTransitionInfluencingFingerprints(files)
      } };
  }
  catch {
    return appTransitionFailure("PROFILE_TRANSITION_CONTENT_INVALID");
  }
}
export function selectAppTransitionVisuals(input: Readonly<{
  prepared: AppTransitionPreparation;
  source: RenderedSkeleton;
  evidence: AppTransitionVisualEvidence | undefined;
}>): AppTransitionResult<AppTransitionPreparation> {
  if (input.source.project.originProfile === "site") {
    return { ok: true, value: input.prepared };
  }
  const evidence = input.evidence;
  const optional = input.source.project.selectedCapabilities.filter(identifier => ["analytics", "booking-calendly", "multilingual"].includes(identifier));
  if (evidence === undefined || !/^sha256:[a-f0-9]{64}$/.test(evidence.manifestFingerprint) || evidence.sourceProfile !== "portfolio" || stringifyCanonicalJson(evidence.optionalCapabilities) !== stringifyCanonicalJson(optional) || stringifyCanonicalJson(evidence.influencingFingerprints) !== stringifyCanonicalJson(input.prepared.influencingFingerprints) || evidence.baselines.length !== 2 || appTransitionBaselinePaths.some(path => evidence.baselines.filter(file => file.path === path).length !== 1)) {
    return appTransitionFailure("PROFILE_TRANSITION_VISUAL_EVIDENCE_REQUIRED");
  }
  const baselineFiles = new Map(evidence.baselines.map(file => [file.path, file.content]));
  for (const bytes of baselineFiles.values())
    if (bytes.length < 24 || bytes.length > maximumContentBytes || !sameBytes(bytes.subarray(0, 8), new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))) {
      return appTransitionFailure("PROFILE_TRANSITION_VISUAL_EVIDENCE_REQUIRED");
    }
  return { ok: true, value: {
      ...input.prepared,
      files: input.prepared.files.map(file => ({ path: file.path, content: new Uint8Array(baselineFiles.get(file.path) ?? file.content) })),
      dispositions: input.prepared.dispositions.map(disposition => baselineFiles.has(disposition.path) ? {
        ...disposition, kind: "replace-file", reason: "recognized-source"
      } : disposition),
      preservedFingerprints: input.prepared.preservedFingerprints.filter(({ path }) => !baselineFiles.has(path)),
    } };
}
