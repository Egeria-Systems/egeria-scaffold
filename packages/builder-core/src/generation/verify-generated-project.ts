import type { ValidationResult } from "../contracts/result.js";

export type GeneratedProjectVerification = Readonly<{
  checks: readonly [
    "lockfile",
    "frozen-install",
    "lint",
    "typecheck",
    "next-build",
    "opennext-build",
  ];
}>;

export interface GeneratedProjectVerifier {
  prepareLockfile(root: string): Promise<ValidationResult<void>>;
  verifyInIsolatedCopy(
    root: string,
  ): Promise<ValidationResult<GeneratedProjectVerification>>;
}
