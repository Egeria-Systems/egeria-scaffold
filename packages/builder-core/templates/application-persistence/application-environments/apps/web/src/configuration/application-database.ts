import type { ApplicationEnvironment } from "./application-environment.ts";

export function resolveApplicationDatabaseEnvironment(
  applicationEnvironment: ApplicationEnvironment,
): "local" | "staging" | "production" {
  return applicationEnvironment === "development" ? "local" : applicationEnvironment;
}
