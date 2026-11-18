import type { JobDefinition } from "@/src/application/job-delivery";
import type { jobHandlers } from "@/src/application/job-handlers";
import type { ApplicationEnvironment } from "@/src/configuration/application-environment";

// Application-owned: map the same declarations to closed handles with lazy,
// invocation-local layers. Do not run business effects while assembling them.
// No optional service is imported by the empty/dependency-free default.
export function createJobHandlers(input: Readonly<{
  definitions: typeof jobHandlers;
  environment: unknown;
  compiledTarget: ApplicationEnvironment;
}>): readonly JobDefinition[] {
  return input.definitions;
}
