import { readCompiledApplicationEnvironment, type ApplicationEnvironment } from "../../configuration/application-environment.ts";

export type Web3FormsContactSettings = Readonly<{ accessKey: string }>;
export type ContactSettingsResult =
  | Readonly<{ ok: true; settings: Web3FormsContactSettings | undefined }>
  | Readonly<{ ok: false; issue: Readonly<{
      field: "NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY";
      reason: "missing" | "invalid";
    }> }>;

export function resolveContactSettings(value: unknown, target: ApplicationEnvironment): ContactSettingsResult {
  const missing = value === undefined || value === "";
  if (missing && target === "development") return { ok: true, settings: undefined };
  if (missing) return { ok: false, issue: { field: "NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY", reason: "missing" } };
  if (typeof value !== "string" || !/^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/u.test(value)) {
    return { ok: false, issue: { field: "NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY", reason: "invalid" } };
  }
  return { ok: true, settings: { accessKey: value } };
}

export function readContactSettings(): Web3FormsContactSettings | undefined {
  const target = readCompiledApplicationEnvironment();
  if (!target.ok) throw new Error(`APPLICATION_ENVIRONMENT_INVALID:${target.issue.field}:${target.issue.reason}`);
  const contact = resolveContactSettings(process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY, target.value);
  if (!contact.ok) throw new Error(`CONTACT_CONFIGURATION_INVALID:${contact.issue.field}:${contact.issue.reason}`);
  return contact.settings;
}
