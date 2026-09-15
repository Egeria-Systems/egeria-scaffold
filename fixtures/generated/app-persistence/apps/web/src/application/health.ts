import { Effect } from "effect";
import {
  BuildInformationReader,
  type BuildInformationUnavailable,
} from "@/src/application/build-information-reader";
import type { RequestContext } from "@/src/application/request-context";
import type { BuildInformation } from "@/src/domain/build-information";

export type HealthReport = Readonly<{
  status: "ok";
  requestId: string;
  build: BuildInformation;
}>;

export function readHealth(
  requestContext: RequestContext,
): Effect.Effect<HealthReport, BuildInformationUnavailable, BuildInformationReader> {
  return Effect.gen(function* () {
    const reader = yield* BuildInformationReader;
    const build = yield* reader.read();
    return Object.freeze({ status: "ok" as const, requestId: requestContext.requestId, build });
  });
}
