import { serverHealthLayer } from "@/src/composition/server-health";
import { createHealthRoute } from "@/src/delivery/health-route";
import { reportCaughtServerError } from "@/src/infrastructure/observability/server-reporter";

export const GET = createHealthRoute({
  readerLayer: serverHealthLayer,
  randomUUID: () => crypto.randomUUID(),
  now: () => new Date(),
  reportError: (error) => reportCaughtServerError(error, { operation: "health.read" }),
});
