import type { D1Database } from "@cloudflare/workers-types";
import { matchesApplicationDatabaseTarget } from "../../../src/configuration/application-database";
import { readCompiledApplicationEnvironment } from "../../../src/configuration/application-environment";

// This synthetic consumer belongs only to the local binding test harness.
const worker = {
  async fetch(request: Request, environment: {
    APPLICATION_ENVIRONMENT?: unknown;
    APPLICATION_DATABASE_ENVIRONMENT?: unknown;
    APP_DB?: D1Database;
  }) {
    const compiled = readCompiledApplicationEnvironment();
    if (!compiled.ok) return new Response(null, { status: 503 });
    if (!matchesApplicationDatabaseTarget(compiled.value, environment.APPLICATION_ENVIRONMENT, environment.APPLICATION_DATABASE_ENVIRONMENT)) {
      return new Response(null, { status: 503 });
    }
    const binding = environment.APP_DB;
    if (binding == null || typeof binding.prepare !== "function") return new Response(null, { status: 503 });
    const value = await request.text();
    await binding.prepare("INSERT INTO persistence_fixture (id, value) VALUES (?, ?)").bind(value, value).run();
    return new Response(null, { status: 204 });
  },
};

export default worker;
