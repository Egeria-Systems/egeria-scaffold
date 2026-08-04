import { readCompatibilityRuntime } from "../../../src/infrastructure/cloudflare/read-compatibility-runtime";

export const runtime = "nodejs";

export function GET(): Response {
  return Response.json(readCompatibilityRuntime());
}
