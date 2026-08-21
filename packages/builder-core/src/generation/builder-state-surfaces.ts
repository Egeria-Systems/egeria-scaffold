import type { ManagedSurfaceDescriptor } from "../contracts/capability.js";
import { createFileSurfaceDescriptor } from "../contracts/surface-target.js";

export function createBuilderStateSurfaces(): readonly ManagedSurfaceDescriptor[] {
  return [
    createFileSurfaceDescriptor({
      identifier: "builder-project-configuration",
      owner: { kind: "builder-kernel" },
      path: ".egeria/project.yaml",
      ownership: "managed",
    }),
    createFileSurfaceDescriptor({
      identifier: "builder-dependency-lockfile",
      owner: { kind: "builder-kernel" },
      path: "pnpm-lock.yaml",
      ownership: "managed",
    }),
    createFileSurfaceDescriptor({
      identifier: "builder-migration-log",
      owner: { kind: "builder-kernel" },
      path: ".egeria/migrations.jsonl",
      ownership: "managed",
    }),
  ];
}
