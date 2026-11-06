export type ApplicationEnvironment = "development" | "staging" | "production";

export type ApplicationEnvironmentIssue = Readonly<{
  field: "APPLICATION_ENVIRONMENT" | "NEXT_PUBLIC_APPLICATION_ENVIRONMENT";
  reason: "missing" | "invalid" | "mismatch";
}>;

export type ApplicationEnvironmentResult =
  | Readonly<{ ok: true; value: ApplicationEnvironment }>
  | Readonly<{ ok: false; issue: ApplicationEnvironmentIssue }>;

export function parseApplicationEnvironment(value: unknown): ApplicationEnvironmentResult {
  if (value === "development" || value === "staging" || value === "production") {
    return { ok: true, value };
  }
  return { ok: false, issue: { field: "APPLICATION_ENVIRONMENT", reason: value === undefined || value === "" ? "missing" : "invalid" } };
}

export function resolveBuildApplicationEnvironment(
  input: Readonly<{ applicationEnvironment: unknown; publicApplicationEnvironment?: unknown }>,
  mode: "local" | "deployment",
): ApplicationEnvironmentResult {
  const supplied = parseApplicationEnvironment(input.applicationEnvironment);
  const target: ApplicationEnvironmentResult = !supplied.ok && supplied.issue.reason === "missing" && mode === "local"
    ? { ok: true, value: "development" }
    : supplied;
  if (!target.ok) return target;
  if (mode === "deployment" && target.value === "development") {
    return { ok: false, issue: { field: "APPLICATION_ENVIRONMENT", reason: "invalid" } };
  }
  if (input.publicApplicationEnvironment !== undefined && input.publicApplicationEnvironment !== "") {
    const publicTarget = parseApplicationEnvironment(input.publicApplicationEnvironment);
    if (!publicTarget.ok) {
      return { ok: false, issue: { field: "NEXT_PUBLIC_APPLICATION_ENVIRONMENT", reason: publicTarget.issue.reason } };
    }
    if (publicTarget.value !== target.value) {
      return { ok: false, issue: { field: "NEXT_PUBLIC_APPLICATION_ENVIRONMENT", reason: "mismatch" } };
    }
  }
  return target;
}

export function validateRuntimeApplicationEnvironment(
  runtimeValue: unknown,
  buildTarget: ApplicationEnvironment,
): ApplicationEnvironmentResult {
  const runtime = parseApplicationEnvironment(runtimeValue);
  if (!runtime.ok) return runtime;
  return runtime.value === buildTarget ? runtime : { ok: false, issue: { field: "APPLICATION_ENVIRONMENT", reason: "mismatch" } };
}

export function readCompiledApplicationEnvironment(): ApplicationEnvironmentResult {
  return parseApplicationEnvironment(process.env.NEXT_PUBLIC_APPLICATION_ENVIRONMENT);
}
