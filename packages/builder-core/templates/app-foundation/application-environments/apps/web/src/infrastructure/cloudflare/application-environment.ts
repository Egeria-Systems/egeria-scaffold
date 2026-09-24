import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function readRuntimeApplicationEnvironment(): Promise<unknown> {
  const context = await getCloudflareContext({ async: true });
  return Reflect.get(context.env, "APPLICATION_ENVIRONMENT");
}
