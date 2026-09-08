export const ordinaryGenerationVerificationChecks = Object.freeze([
  "lockfile",
  "frozen-install",
  "lint",
  "typecheck",
  "unit-tests",
  "component-tests",
  "next-build",
  "opennext-build",
] as const);

export const appGenerationVerificationChecks = Object.freeze([
  ...ordinaryGenerationVerificationChecks,
  "worker-integration",
] as const);
