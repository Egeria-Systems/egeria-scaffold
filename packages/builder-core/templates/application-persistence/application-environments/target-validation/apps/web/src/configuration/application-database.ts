import { validateRuntimeApplicationEnvironment, type ApplicationEnvironment } from "./application-environment.ts";

export function resolveApplicationDatabaseEnvironment(
  applicationEnvironment: ApplicationEnvironment,
): "local" | "staging" | "production" {
  return applicationEnvironment === "development" ? "local" : applicationEnvironment;
}

export function matchesApplicationDatabaseTarget(
  compiledTarget: ApplicationEnvironment,
  runtimeTarget: unknown,
  databaseLabel: unknown,
): boolean {
  return validateRuntimeApplicationEnvironment(runtimeTarget, compiledTarget).ok &&
    databaseLabel === resolveApplicationDatabaseEnvironment(compiledTarget);
}
