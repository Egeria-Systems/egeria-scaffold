import type { z } from "zod";

import type { ManagedSurfaceDescriptor } from "./capability.js";

type SurfaceTarget = Readonly<{
  fingerprintTarget: { kind: "file" } | { kind: "json-value"; pointer: string };
  mergeStrategy: "replace-file" | "json-property";
}>;

type SurfaceDescriptorInput = Omit<
  ManagedSurfaceDescriptor,
  "fingerprintTarget" | "mergeStrategy"
>;

export function createFileSurfaceDescriptor(
  input: SurfaceDescriptorInput,
): ManagedSurfaceDescriptor {
  return {
    ...input,
    fingerprintTarget: { kind: "file" },
    mergeStrategy: "replace-file",
  };
}

export function createJsonValueSurfaceDescriptor(
  input: SurfaceDescriptorInput,
  pointer: string,
): ManagedSurfaceDescriptor {
  return {
    ...input,
    fingerprintTarget: { kind: "json-value", pointer },
    mergeStrategy: "json-property",
  };
}

export function addMergeTargetIssue(
  surface: SurfaceTarget,
  context: z.RefinementCtx,
): void {
  const validPair =
    (surface.fingerprintTarget.kind === "file" &&
      surface.mergeStrategy === "replace-file") ||
    (surface.fingerprintTarget.kind === "json-value" &&
      surface.mergeStrategy === "json-property");

  if (!validPair) {
    context.addIssue({
      code: "custom",
      message: "merge strategy must match its fingerprint target",
      path: ["mergeStrategy"],
    });
  }
}
