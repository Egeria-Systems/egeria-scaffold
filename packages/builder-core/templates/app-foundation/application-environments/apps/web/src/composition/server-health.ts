import { Data, Effect, type Layer } from "effect";
import type { BuildInformationReader } from "@/src/application/build-information-reader";
import { readHealth } from "@/src/application/health";
import type { RequestContext } from "@/src/application/request-context";
import { readCompiledApplicationEnvironment, validateRuntimeApplicationEnvironment } from "@/src/configuration/application-environment";

export { buildInformationReaderLayer as serverHealthLayer } from "@/src/infrastructure/cloudflare/build-information-reader";

export class ApplicationEnvironmentInvalid extends Data.TaggedError("ApplicationEnvironmentInvalid") {
  readonly code = "application-environment-invalid" as const;

  constructor() {
    super();
    Object.freeze(this);
  }
}

export function composeHealth(
  requestContext: RequestContext,
  readerLayer: Layer.Layer<BuildInformationReader>,
  readRuntimeEnvironment: () => Promise<unknown>,
) {
  return Effect.gen(function* () {
    const compiled = readCompiledApplicationEnvironment();
    if (!compiled.ok) return yield* Effect.fail(new ApplicationEnvironmentInvalid());
    const runtimeValue = yield* Effect.tryPromise({
      try: readRuntimeEnvironment,
      catch: () => new ApplicationEnvironmentInvalid(),
    });
    const runtime = validateRuntimeApplicationEnvironment(runtimeValue, compiled.value);
    if (!runtime.ok) return yield* Effect.fail(new ApplicationEnvironmentInvalid());
    return yield* readHealth(requestContext).pipe(Effect.provide(readerLayer));
  });
}
