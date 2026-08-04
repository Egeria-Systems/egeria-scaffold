import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { CompatibilityRuntimeReport } from "../../application/compatibility-runtime";

export function readCompatibilityRuntime(): CompatibilityRuntimeReport {
  const { env } = getCloudflareContext();

  return {
    environment: env.PROOF_ENVIRONMENT,
    runtime: "workerd",
  };
}
