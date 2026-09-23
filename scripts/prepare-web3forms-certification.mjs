import { execFile } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual, promisify } from "node:util";

import {
  createCertificationSubject,
  createVerifiedCapabilityCatalog,
  parseProjectYaml,
} from "../packages/builder-core/dist/index.js";
import { runCertificationCli } from "./lib/certification-cli.mjs";
import {
  createCertificationPreflight,
  createCertificationRepositoryReaders,
} from "./lib/certification-preflight.mjs";
import {
  createIsolatedProcessEnvironment,
  isolatedProcessOptions,
  pathIdentityMatches,
  readPathIdentity,
} from "./lib/isolated-process.mjs";

const execute = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliEntry = join(repositoryRoot, "apps/cli/dist/index.js");
const exactRevisionPattern = /^[a-f0-9]{40}$/u;
const accessKeyPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iu;
const capability = "contact-form-web3forms";
const profile = "site";
const recipeVersion = "0.12.0";
const projectName = "acme-web3forms-certification";
const displayName = "Web3Forms Certification";
const expectedCapabilities = [
  "standards", "content-files", "section-composition", "deployment-cloudflare",
  "observability", "site-routing", capability,
];
const expectedSubject = {
  descriptorVersion: "0.1.0",
  behaviorContractDigest: "sha256:e462b6432eaac905b973d2122c122abca5fdd498e262ee63f7f2508b16978be9",
};
const requiredEvidence = [
  "cleanup-recovery", "deployed-application", "existing-repository-lifecycle",
  "fresh-scaffold", "provider-confirmed",
];

class Web3FormsCertificationError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

const createError = code => new Web3FormsCertificationError(code);
const isCertificationError = error => error instanceof Web3FormsCertificationError;
const errorCodes = {
  adapterInvalid: "CERTIFICATION_ADAPTER_INVALID",
  revisionInvalid: "CERTIFICATION_REVISION_UNAVAILABLE",
  revisionUnavailable: "CERTIFICATION_REVISION_UNAVAILABLE",
  revisionMismatch: "CERTIFICATION_REVISION_MISMATCH",
  worktreeUnavailable: "CERTIFICATION_WORKTREE_UNAVAILABLE",
  worktreeDirty: "CERTIFICATION_WORKTREE_DIRTY",
  indexFlags: "CERTIFICATION_INDEX_FLAGS",
};

function validInput(input) {
  return input !== null && typeof input === "object" &&
    typeof input.revision === "string" && exactRevisionPattern.test(input.revision) &&
    typeof input.accessKey === "string" && accessKeyPattern.test(input.accessKey) &&
    typeof input.outputRoot === "string" && isAbsolute(input.outputRoot);
}

async function runCommand(input) {
  const { stdout } = await execute(input.executable, input.arguments, {
    cwd: input.cwd, env: input.environment, timeout: 15 * 60 * 1000,
    ...isolatedProcessOptions,
  });
  return stdout;
}

async function requireAuthority(preflight, revision) {
  await preflight.requireRevision(revision);
  preflight.requireCleanStatus(await preflight.readRepositoryStatus());
  preflight.requireOrdinaryIndexEntries(await preflight.readRepositoryIndexEntries());
}

async function readSubject() {
  try {
    const registry = JSON.parse(await readFile(join(repositoryRoot, "certifications/capabilities.json"), "utf8"));
    const record = registry.records[capability];
    const catalog = createVerifiedCapabilityCatalog();
    if (!catalog.ok || !isDeepStrictEqual(record.requiredEvidence, requiredEvidence)) throw new Error();
    const descriptor = catalog.value.find(value => value.identifier === capability);
    const subject = createCertificationSubject(descriptor, requiredEvidence);
    if (!isDeepStrictEqual(subject, expectedSubject) || !isDeepStrictEqual(record.subject, subject)) throw new Error();
    return subject;
  } catch {
    throw createError("CERTIFICATION_SUBJECT_INVALID");
  }
}

async function runCli(adapters, arguments_, code) {
  try {
    const output = await adapters.runCommand({
      executable: process.execPath, arguments: [cliEntry, ...arguments_],
      cwd: repositoryRoot, environment: createIsolatedProcessEnvironment(),
    });
    if (typeof output !== "string" || output.trimEnd().split("\n").length !== 1) throw new Error();
    const value = JSON.parse(output);
    if (value?.ok !== true || value.command !== arguments_[0]) throw new Error();
    return value;
  } catch {
    throw createError(code);
  }
}

async function requireProject(projectRoot, accessKey) {
  try {
    const project = parseProjectYaml(await readFile(join(projectRoot, ".egeria/project.yaml"), "utf8"));
    if (!project.ok || project.value.originProfile !== profile ||
      project.value.recipeVersion !== recipeVersion ||
      project.value.project.name !== projectName || project.value.project.displayName !== displayName ||
      !isDeepStrictEqual(project.value.selectedCapabilities, expectedCapabilities) ||
      !isDeepStrictEqual(project.value.capabilitySettings, { [capability]: { accessKey } })) {
      throw new Error();
    }
  } catch {
    throw createError("CERTIFICATION_PROJECT_INVALID");
  }
}

export async function prepareWeb3FormsCertification(input, adapters = { runCommand }) {
  if (!validInput(input)) throw createError("CERTIFICATION_ARGUMENT_INVALID");
  if (typeof adapters?.runCommand !== "function") throw createError("CERTIFICATION_ADAPTER_INVALID");
  const readers = createCertificationRepositoryReaders({
    repositoryRoot, revisionArguments: ["rev-parse", "--verify", "HEAD"],
    exactRevisionPattern, createError, isCertificationError, errorCodes,
  }, async (executable, arguments_, options) => ({
    stdout: await adapters.runCommand({
      executable, arguments: arguments_, cwd: options.cwd, environment: options.env,
    }),
  }));
  const preflight = createCertificationPreflight({
    adapters: readers, requiredAdapterFunctions: Object.keys(readers),
    createError, isCertificationError, errorCodes,
  });
  await requireAuthority(preflight, input.revision);
  const subject = await readSubject();
  let owner;
  try {
    await mkdir(input.outputRoot, { mode: 0o700 });
    owner = await readPathIdentity(input.outputRoot);
    if (owner.isSymbolicLink || !owner.isDirectory) throw new Error();
  } catch {
    throw createError("CERTIFICATION_OUTPUT_ROOT_INVALID");
  }
  const projectRoot = join(input.outputRoot, "project");
  const created = await runCli(adapters, [
    "create", "--profile", profile, "--name", projectName, "--display-name", displayName,
    "--directory", projectRoot, "--web3forms-access-key", input.accessKey,
  ], "CERTIFICATION_CREATE_INVALID");
  if (created.profile !== profile || !isDeepStrictEqual(created.capabilities, expectedCapabilities)) {
    throw createError("CERTIFICATION_CREATE_INVALID");
  }
  const inferred = await runCli(adapters, ["infer", "--directory", projectRoot], "CERTIFICATION_INFERENCE_INVALID");
  const state = inferred.result?.state;
  const installed = state?.value?.installedCapabilities;
  const capabilities = inferred.result?.capabilities;
  if (state?.kind !== "valid" ||
    !isDeepStrictEqual(state.value?.origin, { profile, recipeVersion }) ||
    !Array.isArray(installed) ||
    !isDeepStrictEqual(installed.map(value => value?.identifier), expectedCapabilities) ||
    !installed.some(value => value?.identifier === capability && value.version === subject.descriptorVersion) ||
    !Array.isArray(capabilities) ||
    !isDeepStrictEqual(capabilities.map(value => value?.identifier).sort(), [...expectedCapabilities].sort()) ||
    capabilities.some(value => value?.category !== "confirmed")) {
    throw createError("CERTIFICATION_INFERENCE_INVALID");
  }
  const diagnosed = await runCli(adapters, ["doctor", "--directory", projectRoot], "CERTIFICATION_DIAGNOSTICS_INVALID");
  if (diagnosed.result?.healthy !== true || !isDeepStrictEqual(diagnosed.result.diagnostics, [])) {
    throw createError("CERTIFICATION_DIAGNOSTICS_INVALID");
  }
  const diff = await runCli(adapters, ["diff", "--directory", projectRoot], "CERTIFICATION_DIFF_INVALID");
  if (diff.result?.equal !== true || !isDeepStrictEqual(diff.result.differences, [])) {
    throw createError("CERTIFICATION_DIFF_INVALID");
  }
  await requireProject(projectRoot, input.accessKey);
  if (!(await pathIdentityMatches(owner))) throw createError("CERTIFICATION_OUTPUT_ROOT_INVALID");
  await requireAuthority(preflight, input.revision);
  return {
    ok: true, capability, subject, evidenceRevision: input.revision, profile, recipeVersion,
    checks: ["compiled-cli-create", "state-inference", "healthy-diagnostics", "exact-diff"],
  };
}

await runCertificationCli({
  moduleUrl: import.meta.url,
  parseArguments: arguments_ => {
    const input = {
      revision: process.env.EXPECTED_REVISION,
      outputRoot: process.env.CERTIFICATION_OWNER,
      accessKey: process.env.WEB3FORMS_ACCESS_KEY,
    };
    return arguments_.length === 0 && validInput(input) ? input : undefined;
  },
  certify: prepareWeb3FormsCertification,
  isCertificationError,
});
