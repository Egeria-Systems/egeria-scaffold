import type { ManagedSurfaceDescriptor } from "../contracts/capability.js";
import type {
  ContractIssue,
  ValidationResult,
} from "../contracts/result.js";
import type { InstalledSurface } from "../contracts/state.js";
import {
  canonicalizeJsonValue,
  resolveJsonPointer,
} from "../serialization/canonical-json.js";
import {
  fingerprintFileContent,
  fingerprintJsonValue,
} from "./fingerprint.js";

function surfaceIssue(
  code: string,
  index: number,
  reason: string,
): ContractIssue {
  return {
    code,
    path: ["surfaces", index],
    context: { reason },
  };
}

function pointerOverlaps(left: string, right: string): boolean {
  return (
    left === right ||
    left === "" ||
    right === "" ||
    left.startsWith(`${right}/`) ||
    right.startsWith(`${left}/`)
  );
}

function targetsOverlap(
  left: ManagedSurfaceDescriptor,
  right: ManagedSurfaceDescriptor,
): boolean {
  if (left.path !== right.path) {
    return false;
  }

  if (
    left.fingerprintTarget.kind === "file" ||
    right.fingerprintTarget.kind === "file"
  ) {
    return true;
  }

  return pointerOverlaps(
    left.fingerprintTarget.pointer,
    right.fingerprintTarget.pointer,
  );
}

function validateTargets(
  surfaces: readonly ManagedSurfaceDescriptor[],
): ContractIssue | undefined {
  const identifiers = new Set<string>();

  for (const [index, surface] of surfaces.entries()) {
    if (identifiers.has(surface.identifier)) {
      return surfaceIssue("SURFACE_TARGET_DUPLICATE", index, "identifier");
    }

    identifiers.add(surface.identifier);

    if (surface.path === ".egeria/state.json") {
      return surfaceIssue("SURFACE_TARGET_DUPLICATE", index, "state-self-reference");
    }

    for (let priorIndex = 0; priorIndex < index; priorIndex += 1) {
      const priorSurface = surfaces[priorIndex];

      if (priorSurface !== undefined && targetsOverlap(priorSurface, surface)) {
        return surfaceIssue("SURFACE_TARGET_DUPLICATE", index, "overlap");
      }
    }
  }

  return undefined;
}

function decodeJsonSource(content: Uint8Array): unknown {
  const source = new TextDecoder("utf-8", { fatal: true }).decode(content);
  return JSON.parse(source) as unknown;
}

export function materializeInstalledSurfaces(input: Readonly<{
  files: ReadonlyMap<string, Uint8Array>;
  surfaces: readonly ManagedSurfaceDescriptor[];
}>): ValidationResult<readonly InstalledSurface[]> {
  const targetIssue = validateTargets(input.surfaces);

  if (targetIssue !== undefined) {
    return { ok: false, issues: [targetIssue] };
  }

  const installedSurfaces: InstalledSurface[] = [];

  for (const [index, surface] of input.surfaces.entries()) {
    const content = input.files.get(surface.path);

    if (content === undefined) {
      return {
        ok: false,
        issues: [surfaceIssue("SURFACE_SOURCE_MISSING", index, "missing")],
      };
    }

    if (surface.fingerprintTarget.kind === "file") {
      installedSurfaces.push({
        ...surface,
        fingerprint: fingerprintFileContent(content),
      });
      continue;
    }

    try {
      const json = canonicalizeJsonValue(decodeJsonSource(content));
      const result = resolveJsonPointer(
        json,
        surface.fingerprintTarget.pointer,
      );

      if (!result.found) {
        return {
          ok: false,
          issues: [
            surfaceIssue("SURFACE_POINTER_MISSING", index, "missing"),
          ],
        };
      }

      installedSurfaces.push({
        ...surface,
        fingerprint: fingerprintJsonValue(result.value),
      });
    } catch {
      return {
        ok: false,
        issues: [
          surfaceIssue("SURFACE_POINTER_MISSING", index, "invalid-json"),
        ],
      };
    }
  }

  return { ok: true, value: installedSurfaces };
}
