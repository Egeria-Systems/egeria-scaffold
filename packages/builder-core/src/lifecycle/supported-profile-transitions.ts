export type SupportedProfileTransitionResolutionFailureCode =
  | "PROFILE_ALREADY_CURRENT"
  | "PROFILE_TRANSITION_SOURCE_UNSUPPORTED"
  | "PROFILE_TRANSITION_EDGE_MISSING"
  | "PROFILE_TRANSITION_UNSUPPORTED";

export type SupportedProfileTransitionEndpoint = Readonly<{
  profile: "portfolio" | "site";
  recipeVersion: "0.10.0";
}>;

export type SupportedProfileTransition = Readonly<{
  source: SupportedProfileTransitionEndpoint &
    Readonly<{ profile: "portfolio" }>;
  target: SupportedProfileTransitionEndpoint & Readonly<{ profile: "site" }>;
}>;

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
  if (input.toProfile !== "site") {
    return { ok: false, code: "PROFILE_TRANSITION_UNSUPPORTED" };
  }

  if (
    input.fromProfile === input.toProfile &&
    input.fromRecipeVersion === input.toRecipeVersion
  ) {
    return { ok: false, code: "PROFILE_ALREADY_CURRENT" };
  }

  if (input.fromProfile !== "portfolio") {
    return { ok: false, code: "PROFILE_TRANSITION_SOURCE_UNSUPPORTED" };
  }

  if (
    input.fromRecipeVersion !== "0.10.0" ||
    input.toRecipeVersion !== "0.10.0"
  ) {
    return { ok: false, code: "PROFILE_TRANSITION_EDGE_MISSING" };
  }

  return {
    ok: true,
    value: {
      source: { profile: "portfolio", recipeVersion: "0.10.0" },
      target: { profile: "site", recipeVersion: "0.10.0" },
    },
  };
}
