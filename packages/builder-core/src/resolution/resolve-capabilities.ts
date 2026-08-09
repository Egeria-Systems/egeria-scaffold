import {
  capabilityDescriptorSchema,
  type CapabilityDescriptor,
} from "../contracts/capability.js";
import {
  profileRecipeSchema,
  type ProfileRecipe,
} from "../contracts/profile.js";
import type {
  ContractIssue,
  ValidationResult,
} from "../contracts/result.js";

export type ResolutionRequest = Readonly<{
  profile: "portfolio" | "site";
  requestedCapabilities?: readonly string[];
}>;

export type ResolvedCapabilities = Readonly<{
  profile: "portfolio" | "site";
  recipeVersion: ProfileRecipe["recipeVersion"];
  capabilities: readonly CapabilityDescriptor[];
}>;

type IndexedCapability = Readonly<{
  descriptor: CapabilityDescriptor;
  index: number;
}>;

type IndexedProfile = Readonly<{
  recipe: ProfileRecipe;
  index: number;
}>;

function validateCatalog(
  catalog: readonly CapabilityDescriptor[],
): ValidationResult<readonly IndexedCapability[]> {
  const issues: ContractIssue[] = [];
  const parsedCatalog: IndexedCapability[] = [];
  const firstIndexByIdentifier = new Map<string, number>();

  for (const [index, descriptor] of catalog.entries()) {
    const parsed = capabilityDescriptorSchema.safeParse(descriptor);

    if (!parsed.success) {
      issues.push({
        code: "CAPABILITY_CATALOG_INVALID",
        path: ["catalog", index],
        context: { reason: parsed.error.issues[0]?.code ?? "unknown" },
      });
      continue;
    }

    if (firstIndexByIdentifier.has(parsed.data.identifier)) {
      issues.push({
        code: "CAPABILITY_DUPLICATE",
        path: ["catalog", index, "identifier"],
        context: { identifier: parsed.data.identifier },
      });
      continue;
    }

    firstIndexByIdentifier.set(parsed.data.identifier, index);
    parsedCatalog.push({ descriptor: parsed.data, index });
  }

  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, value: parsedCatalog };
}

function validateProfiles(
  profiles: readonly ProfileRecipe[],
): ValidationResult<readonly IndexedProfile[]> {
  const issues: ContractIssue[] = [];
  const parsedProfiles: IndexedProfile[] = [];
  const identifiers = new Set<string>();

  for (const [index, profile] of profiles.entries()) {
    const parsed = profileRecipeSchema.safeParse(profile);

    if (!parsed.success) {
      issues.push({
        code: "PROFILE_CATALOG_INVALID",
        path: ["profiles", index],
        context: { reason: parsed.error.issues[0]?.code ?? "unknown" },
      });
      continue;
    }

    if (identifiers.has(parsed.data.identifier)) {
      issues.push({
        code: "PROFILE_DUPLICATE",
        path: ["profiles", index, "identifier"],
        context: { identifier: parsed.data.identifier },
      });
      continue;
    }

    identifiers.add(parsed.data.identifier);
    parsedProfiles.push({ recipe: parsed.data, index });
  }

  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, value: parsedProfiles };
}

function unknownCapabilityIssue(
  identifier: string,
  path: readonly (string | number)[],
): ValidationResult<never> {
  return {
    ok: false,
    issues: [{ code: "CAPABILITY_UNKNOWN", path, context: { identifier } }],
  };
}

export function resolveCapabilities(
  request: ResolutionRequest,
  catalog: readonly CapabilityDescriptor[],
  profiles: readonly ProfileRecipe[],
): ValidationResult<ResolvedCapabilities> {
  const catalogResult = validateCatalog(catalog);
  if (!catalogResult.ok) {
    return catalogResult;
  }

  const profilesResult = validateProfiles(profiles);
  if (!profilesResult.ok) {
    return profilesResult;
  }

  const profile = profilesResult.value.find(
    ({ recipe }) => recipe.identifier === request.profile,
  );
  if (profile === undefined) {
    return {
      ok: false,
      issues: [
        {
          code: "PROFILE_UNKNOWN",
          path: ["profile"],
          context: { identifier: request.profile },
        },
      ],
    };
  }

  const capabilityByIdentifier = new Map(
    catalogResult.value.map(({ descriptor }) => [
      descriptor.identifier,
      descriptor,
    ]),
  );
  const requestedCapabilities = request.requestedCapabilities ?? [];
  const seeds: readonly Readonly<{
    identifier: string;
    path: readonly (string | number)[];
  }>[] = [
    ...profile.recipe.defaultCapabilities.map((identifier, index) => ({
      identifier,
      path: ["profiles", profile.index, "defaultCapabilities", index],
    })),
    ...requestedCapabilities.map((identifier, index) => ({
      identifier,
      path: ["requestedCapabilities", index],
    })),
  ];

  for (const seed of seeds) {
    if (!capabilityByIdentifier.has(seed.identifier)) {
      return unknownCapabilityIssue(seed.identifier, seed.path);
    }
  }

  const resolved: CapabilityDescriptor[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const stack: string[] = [];

  function visit(
    identifier: string,
  ): ValidationResult<undefined> {
    if (visited.has(identifier)) {
      return { ok: true, value: undefined };
    }

    const capability = capabilityByIdentifier.get(identifier);
    if (capability === undefined) {
      return unknownCapabilityIssue(identifier, ["capabilities", identifier]);
    }

    if (!capability.supportedProfiles.includes(request.profile)) {
      return {
        ok: false,
        issues: [
          {
            code: "CAPABILITY_UNSUPPORTED",
            path: ["capabilities", identifier],
            context: { identifier, profile: request.profile },
          },
        ],
      };
    }

    visiting.add(identifier);
    stack.push(identifier);

    const dependencies = capability.dependencies
      .map((dependency, index) => ({ dependency, index }))
      .sort((left, right) => left.dependency.localeCompare(right.dependency));

    for (const { dependency, index } of dependencies) {
      if (!capabilityByIdentifier.has(dependency)) {
        return {
          ok: false,
          issues: [
            {
              code: "CAPABILITY_DEPENDENCY_MISSING",
              path: ["capabilities", identifier, "dependencies", index],
              context: { capability: identifier, dependency },
            },
          ],
        };
      }

      if (visiting.has(dependency)) {
        const cycleStart = stack.indexOf(dependency);
        const cycle = [...stack.slice(cycleStart), dependency];
        return {
          ok: false,
          issues: [
            {
              code: "CAPABILITY_CYCLE",
              path: ["capabilities", identifier, "dependencies"],
              context: { cycle: cycle.join(",") },
            },
          ],
        };
      }

      const dependencyResult = visit(dependency);
      if (!dependencyResult.ok) {
        return dependencyResult;
      }
    }

    stack.pop();
    visiting.delete(identifier);
    visited.add(identifier);
    resolved.push(capability);
    return { ok: true, value: undefined };
  }

  for (const { identifier } of seeds) {
    const result = visit(identifier);
    if (!result.ok) {
      return result;
    }
  }

  const selectedIdentifiers = new Set(
    resolved.map(({ identifier }) => identifier),
  );
  for (const capability of resolved) {
    for (const [index, conflict] of capability.conflicts.entries()) {
      if (selectedIdentifiers.has(conflict)) {
        return {
          ok: false,
          issues: [
            {
              code: "CAPABILITY_CONFLICT",
              path: ["capabilities", capability.identifier, "conflicts", index],
              context: {
                capability: capability.identifier,
                conflict,
              },
            },
          ],
        };
      }
    }
  }

  return {
    ok: true,
    value: {
      profile: profile.recipe.identifier,
      recipeVersion: profile.recipe.recipeVersion,
      capabilities: resolved,
    },
  };
}
