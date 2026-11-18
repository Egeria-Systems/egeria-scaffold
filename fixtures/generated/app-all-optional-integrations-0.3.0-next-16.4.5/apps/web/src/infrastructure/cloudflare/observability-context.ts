import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  readCompiledApplicationEnvironment,
  validateRuntimeApplicationEnvironment,
  type ApplicationEnvironment,
} from "../../configuration/application-environment";

type ObservabilityEnvironment = Readonly<{
  APPLICATION_ENVIRONMENT?: unknown;
  BETTER_STACK_INGESTING_HOST?: unknown;
  BETTER_STACK_SOURCE_TOKEN?: unknown;
  CF_VERSION_METADATA?: Readonly<{ id?: unknown }>;
}>;

export type ObservabilityRuntimeContext = Readonly<{
  applicationEnvironment: ApplicationEnvironment;
  ingestingHost: string;
  sourceToken: string;
  releaseId?: string;
  schedule: (task: Promise<unknown>) => void;
}>;

export async function readObservabilityRuntimeContext(): Promise<ObservabilityRuntimeContext> {
  const cloudflareContext = await getCloudflareContext({ async: true });
  const environment = cloudflareContext.env as CloudflareEnv &
    ObservabilityEnvironment;
  const compiled = readCompiledApplicationEnvironment();
  if (!compiled.ok) throw new Error("APPLICATION_ENVIRONMENT_INVALID");
  const target = validateRuntimeApplicationEnvironment(environment.APPLICATION_ENVIRONMENT, compiled.value);
  if (!target.ok) throw new Error("APPLICATION_ENVIRONMENT_INVALID");
  const ingestingHost = environment.BETTER_STACK_INGESTING_HOST;
  const sourceToken = environment.BETTER_STACK_SOURCE_TOKEN;
  const releaseId = environment.CF_VERSION_METADATA?.id;

  const hostAbsent = ingestingHost === undefined || ingestingHost === "";
  const tokenAbsent = sourceToken === undefined || sourceToken === "";
  if (hostAbsent !== tokenAbsent || (!hostAbsent && (typeof ingestingHost !== "string" || typeof sourceToken !== "string"))) {
    throw new Error("BETTER_STACK_CONFIGURATION_INVALID");
  }

  return Object.freeze({
    applicationEnvironment: target.value,
    ingestingHost: typeof ingestingHost === "string" ? ingestingHost : "",
    sourceToken: typeof sourceToken === "string" ? sourceToken : "",
    ...(typeof releaseId === "string" ? { releaseId } : {}),
    schedule: (task) => cloudflareContext.ctx.waitUntil(task),
  });
}
