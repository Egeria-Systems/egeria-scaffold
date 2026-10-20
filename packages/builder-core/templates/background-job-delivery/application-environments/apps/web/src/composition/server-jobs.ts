import { readCompiledApplicationEnvironment, type ApplicationEnvironment } from "@/src/configuration/application-environment";
import { jobHandlers } from "@/src/application/job-handlers";
import { cloudflareJobConfiguration, consumeCloudflareJobs, createCloudflareJobDispatcherLayer, type JobMessageBatch } from "@/src/infrastructure/cloudflare/job-delivery";

export const serverJobDispatcherLayer = createCloudflareJobDispatcherLayer({ compiledTarget: readCompiledApplicationEnvironment, configuration: cloudflareJobConfiguration, handlers: jobHandlers });
export const consumeServerJobs = (batch: JobMessageBatch, environment: unknown, compiledTarget: ApplicationEnvironment) =>
  consumeCloudflareJobs(batch, environment, compiledTarget, jobHandlers);
