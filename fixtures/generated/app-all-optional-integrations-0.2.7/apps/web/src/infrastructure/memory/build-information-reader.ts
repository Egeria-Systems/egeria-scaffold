import { Effect, Layer } from "effect";
import {
  BuildInformationReader,
  BuildInformationUnavailable,
} from "@/src/application/build-information-reader";
import type { BuildInformation } from "@/src/domain/build-information";

// Test composition only; production never falls back to an in-memory value.
export function buildInformationReaderLayer(
  result: BuildInformation | BuildInformationUnavailable,
): Layer.Layer<BuildInformationReader> {
  const read = result instanceof BuildInformationUnavailable
    ? Effect.fail(new BuildInformationUnavailable())
    : Effect.succeed(Object.freeze(
        result.releaseId === undefined ? {} : { releaseId: result.releaseId },
      ));
  return Layer.succeed(BuildInformationReader, { read: () => read });
}
