import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Effect, Layer } from "effect";
import {
  BuildInformationReader,
  BuildInformationUnavailable,
} from "@/src/application/build-information-reader";
import { parseBuildInformation } from "@/src/domain/build-information";

export const buildInformationReaderLayer = Layer.succeed(BuildInformationReader, {
  read: () => Effect.tryPromise({
    // The provider has no cancellation parameter. Interruption stops our wait.
    try: () => getCloudflareContext({ async: true }),
    catch: () => new BuildInformationUnavailable(),
  }).pipe(Effect.flatMap((context) => {
    // Parsing and property access stay outside the provider-failure catch.
    const metadata: unknown = Reflect.get(context.env, "CF_VERSION_METADATA");
    const parsed = parseBuildInformation(metadata);
    return parsed.valid
      ? Effect.succeed(parsed.value)
      : Effect.fail(new BuildInformationUnavailable());
  })),
});
