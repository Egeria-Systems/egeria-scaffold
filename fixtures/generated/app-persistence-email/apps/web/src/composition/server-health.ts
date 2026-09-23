import { Effect, type Layer } from "effect";
import type { BuildInformationReader } from "@/src/application/build-information-reader";
import { readHealth } from "@/src/application/health";
import type { RequestContext } from "@/src/application/request-context";

export { buildInformationReaderLayer as serverHealthLayer } from "@/src/infrastructure/cloudflare/build-information-reader";

export function composeHealth(
  requestContext: RequestContext,
  readerLayer: Layer.Layer<BuildInformationReader>,
) {
  return readHealth(requestContext).pipe(Effect.provide(readerLayer));
}
