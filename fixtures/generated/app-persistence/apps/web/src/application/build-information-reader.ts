import { Context, Data, type Effect } from "effect";
import type { BuildInformation } from "@/src/domain/build-information";

export class BuildInformationUnavailable extends Data.TaggedError("BuildInformationUnavailable") {
  readonly category = "dependency-unavailable" as const;
  readonly code = "build-information-unavailable" as const;

  constructor() {
    super();
    Object.freeze(this);
  }
}

export class BuildInformationReader extends Context.Service<BuildInformationReader, {
  readonly read: () => Effect.Effect<BuildInformation, BuildInformationUnavailable>;
}>()("@egeria-systems/generated-app/BuildInformationReader") {}
