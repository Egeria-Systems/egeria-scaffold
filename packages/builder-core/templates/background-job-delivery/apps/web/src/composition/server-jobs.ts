import { jobHandlers } from "@/src/application/job-handlers";
import { cloudflareJobConfiguration, consumeCloudflareJobs, createCloudflareJobDispatcherLayer, type JobMessageBatch } from "@/src/infrastructure/cloudflare/job-delivery";

export const serverJobDispatcherLayer = createCloudflareJobDispatcherLayer({ configuration: cloudflareJobConfiguration, handlers: jobHandlers });
export const consumeServerJobs = (batch: JobMessageBatch, environment: unknown) =>
  consumeCloudflareJobs(batch, environment, jobHandlers);
