export type SupportedProfileTransitionResolutionFailureCode =
  | "PROFILE_ALREADY_CURRENT"
  | "PROFILE_TRANSITION_SOURCE_UNSUPPORTED"
  | "PROFILE_TRANSITION_EDGE_MISSING"
  | "PROFILE_TRANSITION_UNSUPPORTED";

export type SupportedProfileTransitionEndpoint = Readonly<{
  profile: "portfolio" | "site" | "app";
  recipeVersion: "0.11.7" | "0.12.7" | "0.2.7";
}>;

export type SupportedAppProfileTransition = Readonly<{
  source:
    | Readonly<{ profile: "portfolio"; recipeVersion: "0.11.7" }>
    | Readonly<{ profile: "site"; recipeVersion: "0.12.7" }>;
  target: Readonly<{ profile: "app"; recipeVersion: "0.2.7" }>;
}>;

export type SupportedProfileTransition = SupportedAppProfileTransition;

export type SupportedProfileTransitionResolution =
  | Readonly<{ ok: true; value: SupportedProfileTransition }>
  | Readonly<{
      ok: false;
      code: SupportedProfileTransitionResolutionFailureCode;
    }>;

export function resolveSupportedProfileTransition(input: Readonly<{
  fromProfile: string;
  fromRecipeVersion: string;
  toProfile: string;
  toRecipeVersion: string;
}>): SupportedProfileTransitionResolution {
  if (input.toProfile !== "app") return { ok: false, code: "PROFILE_TRANSITION_UNSUPPORTED" };
  if (input.fromProfile === "app" && input.fromRecipeVersion === input.toRecipeVersion) {
    return { ok: false, code: "PROFILE_ALREADY_CURRENT" };
  }
  if (input.fromProfile !== "portfolio" && input.fromProfile !== "site") {
    return { ok: false, code: "PROFILE_TRANSITION_SOURCE_UNSUPPORTED" };
  }
  if (input.toRecipeVersion !== "0.2.7" ||
      input.fromRecipeVersion !== (input.fromProfile === "portfolio" ? "0.11.7" : "0.12.7")) {
    return { ok: false, code: "PROFILE_TRANSITION_EDGE_MISSING" };
  }
  return { ok: true, value: {
    source: input.fromProfile === "portfolio"
      ? { profile: "portfolio", recipeVersion: "0.11.7" }
      : { profile: "site", recipeVersion: "0.12.7" },
    target: { profile: "app", recipeVersion: "0.2.7" },
  } };
}
