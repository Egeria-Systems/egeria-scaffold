import type { D1Database } from "@cloudflare/workers-types";
import { resolveApplicationDatabaseEnvironment } from "../../../src/configuration/application-database";
import { readCompiledApplicationEnvironment, validateRuntimeApplicationEnvironment } from "../../../src/configuration/application-environment";

// This synthetic consumer belongs only to the local binding test harness.
const worker = {
  async fetch(request: Request, environment: {
    APPLICATION_ENVIRONMENT?: string;
    APPLICATION_DATABASE_ENVIRONMENT?: string;
    APP_DB?: D1Database;
  }) {
    const compiled = readCompiledApplicationEnvironment();
    if (!compiled.ok) return new Response(null, { status: 503 });
    const runtime = validateRuntimeApplicationEnvironment(environment.APPLICATION_ENVIRONMENT, compiled.value);
    if (!runtime.ok || environment.APPLICATION_DATABASE_ENVIRONMENT !== resolveApplicationDatabaseEnvironment(runtime.value)) {
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
