import { resolveApplicationBuild } from "./application-build.ts";
import { resolveContactSettings } from "../integrations/contact-form-web3forms/contact-settings.ts";

type BuildInput = Readonly<Parameters<typeof resolveApplicationBuild>[0] & {
  contactAccessKey?: unknown;
}>;

export function readPublicBuildEnvironment(): BuildInput {
  return {
    applicationEnvironment: process.env.APPLICATION_ENVIRONMENT,
    publicApplicationEnvironment: process.env.NEXT_PUBLIC_APPLICATION_ENVIRONMENT,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    sourceRevision: process.env.BUILD_SOURCE_REVISION,
    deploymentId: process.env.NEXT_DEPLOYMENT_ID,
    contactAccessKey: process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY,
  };
}

export function resolvePublicBuild(input: BuildInput, mode: "local" | "deployment") {
  const build = resolveApplicationBuild(input, mode);
  if (!build.ok) return { ok: false, source: "base", ...build.issue } as const;
  const target = build.value.target;
  const contact = resolveContactSettings(input.contactAccessKey, target);
  if (!contact.ok) return { ok: false, source: "contact", ...contact.issue } as const;

  const publicValues = {
    NEXT_PUBLIC_APPLICATION_ENVIRONMENT: target,
    NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: contact.settings?.accessKey ?? "",
  };
  return { ok: true, value: { build: build.value, publicValues } } as const;
}
