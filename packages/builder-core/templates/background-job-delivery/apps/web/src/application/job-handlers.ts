import type { JobDefinition } from "@/src/application/job-delivery";

// Register only real consuming use cases here. Each definition must validate an
// explicit payload allowlist and document/test its repeat-safety obligation.
// Store opaque record references, never secrets or unnecessary personal data.
export const jobHandlers: readonly JobDefinition[] = [];
