import { resolveApplicationBuild } from "./application-build.ts";

type BuildInput = Readonly<Parameters<typeof resolveApplicationBuild>[0] & {
}>;

export function readPublicBuildEnvironment(): BuildInput {
  return {
    applicationEnvironment: process.env.APPLICATION_ENVIRONMENT,
    publicApplicationEnvironment: process.env.NEXT_PUBLIC_APPLICATION_ENVIRONMENT,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    sourceRevision: process.env.BUILD_SOURCE_REVISION,
    deploymentId: process.env.NEXT_DEPLOYMENT_ID,
  };
}

export function resolvePublicBuild(input: BuildInput, mode: "local" | "deployment") {
  const build = resolveApplicationBuild(input, mode);
  if (!build.ok) return { ok: false, source: "base", ...build.issue } as const;
  const target = build.value.target;

  const publicValues = {
    NEXT_PUBLIC_APPLICATION_ENVIRONMENT: target,
  };
  return { ok: true, value: { build: build.value, publicValues } } as const;
}
