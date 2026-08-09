import type { z } from "zod";

type SurfaceTarget = Readonly<{
  fingerprintTarget: { kind: "file" } | { kind: "json-value"; pointer: string };
  mergeStrategy: "replace-file" | "json-property";
}>;

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
