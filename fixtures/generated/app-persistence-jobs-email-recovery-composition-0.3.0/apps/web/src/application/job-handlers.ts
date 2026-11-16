import type { JobDefinition } from "@/src/application/job-delivery";

// One provider-independent registry owns declaration policy and business Effects.
// Declare the Effect requirements of service-using handlers explicitly, then
// satisfy them in composition/job-handler-composition.ts with per-event layers.
// Keep payloads allowlisted and repeat safety proved; never register secrets.
export const jobHandlers: readonly JobDefinition[] = [];
