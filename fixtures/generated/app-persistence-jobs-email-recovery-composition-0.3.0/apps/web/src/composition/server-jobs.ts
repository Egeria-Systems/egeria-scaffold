import { readCompiledApplicationEnvironment, type ApplicationEnvironment } from "@/src/configuration/application-environment";
import { JobDeliveryFailure, type JobDeclaration, type JobDefinition } from "@/src/application/job-delivery";
import { jobHandlers } from "@/src/application/job-handlers";
import { cloudflareJobConfiguration, consumeCloudflareJobs, createCloudflareJobDispatcherLayer, validateCloudflareJobBatch, type JobMessageBatch } from "@/src/infrastructure/cloudflare/job-delivery";

export const serverJobDispatcherLayer = createCloudflareJobDispatcherLayer({ compiledTarget: readCompiledApplicationEnvironment, configuration: cloudflareJobConfiguration, handlers: jobHandlers });

function validateAssembly(declarations: readonly JobDeclaration[], handlers: readonly JobDefinition[]): void {
  try {
    if (!Array.isArray(handlers) || handlers.length !== declarations.length) throw new Error();
    const identities = new Set<string>();
    for (const handler of handlers) {
      const declaration = declarations.find(item => item.type === handler.type && item.version === handler.version);
      const identity = `${handler.type}:${handler.version}`;
      if (declaration === undefined || identities.has(identity) || handler.repeatSafety !== declaration.repeatSafety ||
        handler.validate !== declaration.validate || typeof handler.handle !== "function") throw new Error();
      identities.add(identity);
    }
  } catch { throw new JobDeliveryFailure("job-configuration"); }
}

export async function consumeServerJobs(batch: JobMessageBatch, environment: unknown, compiledTarget: ApplicationEnvironment): Promise<void> {
  // Reuse the adapter's target/configuration/batch guard before even importing
  // application assembly. HTTP admission never loads this Queue-only hook.
  validateCloudflareJobBatch(batch, environment, compiledTarget);
  let handlers: readonly JobDefinition[];
  try {
    const declarations = jobHandlers.map(({ type, version, repeatSafety, validate }) => ({ type, version, repeatSafety, validate }));
    const { createJobHandlers } = await import("@/src/composition/job-handler-composition");
    handlers = createJobHandlers({ definitions: jobHandlers, environment, compiledTarget });
    validateAssembly(declarations, handlers);
  } catch { throw new JobDeliveryFailure("job-configuration"); }
  await consumeCloudflareJobs(batch, environment, compiledTarget, handlers);
}
