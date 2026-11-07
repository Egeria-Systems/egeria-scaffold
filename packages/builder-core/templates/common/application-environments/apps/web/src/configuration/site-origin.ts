import { readCompiledApplicationEnvironment, type ApplicationEnvironment } from "./application-environment.ts";

export type SiteOriginResult =
  | Readonly<{ ok: true; value: string }>
  | Readonly<{ ok: false; issue: Readonly<{ field: "NEXT_PUBLIC_SITE_URL"; reason: "missing" | "invalid" }> }>;

export function resolveSiteOrigin(input: Readonly<{ target: ApplicationEnvironment; value: unknown }>): SiteOriginResult {
  const missing = input.value === undefined || input.value === "";
  if (missing && input.target === "development") return { ok: true, value: "http://localhost:3000" };
  const invalid = (): SiteOriginResult => ({ ok: false, issue: { field: "NEXT_PUBLIC_SITE_URL", reason: missing ? "missing" : "invalid" } });
  if (typeof input.value !== "string" || missing || input.value.trim() !== input.value || /[?#\\\u0000-\u0020\u007f]/u.test(input.value)) return invalid();
  try {
    const url = new URL(input.value);
    const localHttp = input.target === "development" && url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]");
    if ((url.protocol !== "https:" && !localHttp) || url.username !== "" || url.password !== "" || url.pathname !== "/") return invalid();
    return { ok: true, value: url.origin };
  } catch {
    return invalid();
  }
}

export function readCompiledSiteOrigin(): string {
  const target = readCompiledApplicationEnvironment();
  if (!target.ok) throw new Error(`APPLICATION_ENVIRONMENT_INVALID:${target.issue.field}:${target.issue.reason}`);
  const origin = resolveSiteOrigin({ target: target.value, value: process.env.NEXT_PUBLIC_SITE_URL });
  if (!origin.ok) throw new Error(`SITE_ORIGIN_INVALID:${origin.issue.field}:${origin.issue.reason}`);
  return origin.value;
}
