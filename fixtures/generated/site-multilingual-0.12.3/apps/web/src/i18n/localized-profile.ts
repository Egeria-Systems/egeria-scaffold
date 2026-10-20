export const localizedRoutes = [
  { identifier: "home", segments: [] },
  { identifier: "about", segments: ["about"] },
  { identifier: "workFeatured", segments: ["work", "featured"] },
] as const;

export const localizedRedirects = [
  { segments: ["work"], destinationSegments: ["work", "featured"] },
] as const;
