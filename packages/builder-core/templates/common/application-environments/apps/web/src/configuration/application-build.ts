import { resolveBuildApplicationEnvironment, type ApplicationEnvironment, type ApplicationEnvironmentIssue } from "./application-environment.ts";
import { resolveSiteOrigin } from "./site-origin.ts";

type BuildIssue = ApplicationEnvironmentIssue | Readonly<{
  field: "NEXT_PUBLIC_SITE_URL" | "BUILD_SOURCE_REVISION" | "deploymentId";
  reason: "missing" | "invalid";
}>;

export function resolveApplicationBuild(input: Readonly<{
  applicationEnvironment: unknown;
  publicApplicationEnvironment?: unknown;
  siteUrl?: unknown;
  sourceRevision?: unknown;
  deploymentId?: unknown;
}>, mode: "local" | "deployment"):
  | Readonly<{ ok: true; value: Readonly<{ target: ApplicationEnvironment; siteOrigin: string; buildId?: string }> }>
  | Readonly<{ ok: false; issue: BuildIssue }> {
  const target = resolveBuildApplicationEnvironment(input, mode);
  if (!target.ok) return target;
  const origin = resolveSiteOrigin({ target: target.value, value: input.siteUrl });
  if (!origin.ok) return origin;
  if (input.deploymentId !== undefined && input.deploymentId !== "") return { ok: false, issue: { field: "deploymentId", reason: "invalid" } };
  const missing = input.sourceRevision === undefined || input.sourceRevision === "";
  if (missing && mode === "local") return { ok: true, value: { target: target.value, siteOrigin: origin.value } };
  if (typeof input.sourceRevision !== "string" || !/^[a-f0-9]{40}$/u.test(input.sourceRevision)) {
    return { ok: false, issue: { field: "BUILD_SOURCE_REVISION", reason: missing ? "missing" : "invalid" } };
  }
  return { ok: true, value: { target: target.value, siteOrigin: origin.value, buildId: `egeria-${target.value}-${input.sourceRevision}` } };
}

export function parseApplicationBuildId(value: unknown):
  | Readonly<{ ok: true; value: Readonly<{ target: ApplicationEnvironment; revision: string }> }>
  | Readonly<{ ok: false }> {
  if (typeof value !== "string") return { ok: false };
  const match = /^egeria-(development|staging|production)-([a-f0-9]{40})$/u.exec(value);
  if (match === null || match[0] !== value) return { ok: false };
  const target = match[1];
  const revision = match[2];
  if ((target !== "development" && target !== "staging" && target !== "production") || revision === undefined) return { ok: false };
  return { ok: true, value: { target, revision } };
}
