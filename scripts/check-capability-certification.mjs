import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  certificationRegistrySchema,
  createVerifiedCapabilityCatalog,
  validateCertificationAdmission,
  validateCertificationArtifacts,
  validateCertificationClosure,
  validateContract,
} from "../packages/builder-core/dist/index.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = resolve(
  repositoryRoot,
  "certifications/capabilities.json",
);
const executeFile = promisify(execFile);

function parseArguments(arguments_) {
  if (arguments_.length === 0) {
    return { kind: "admission" };
  }
  if (arguments_.length === 1 && arguments_[0] === "--artifacts") {
    return { kind: "artifacts" };
  }
  if (
    arguments_.length === 2 &&
    arguments_[0] === "--closure" &&
    (arguments_[1] === "legacy-backfill-exempt" ||
      arguments_[1] === "all-certified")
  ) {
    return { kind: "closure", policy: arguments_[1] };
  }

  return undefined;
}

function writeStandard(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function writeError(value) {
  process.stderr.write(`${JSON.stringify(value)}\n`);
}

async function readRegistry() {
  try {
    return JSON.parse(await readFile(registryPath, "utf8"));
  } catch {
    return undefined;
  }
}

async function readArtifact(path) {
  try {
    return await readFile(resolve(repositoryRoot, path), "utf8");
  } catch {
    return undefined;
  }
}

async function revisionIsInCheckedHistory(revision) {
  const options = {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: { PATH: process.env.PATH },
    windowsHide: true,
  };

  try {
    await executeFile("git", ["cat-file", "-e", `${revision}^{commit}`], options);
    await executeFile(
      "git",
      ["merge-base", "--is-ancestor", revision, "HEAD"],
      options,
    );
    return true;
  } catch {
    return false;
  }
}

async function validatePrivateArtifacts(registry) {
  const artifactPaths = new Set();
  for (const record of Object.values(registry.records)) {
    if (record.taskPlan !== null) {
      artifactPaths.add(record.taskPlan);
    }
    for (const evidence of record.evidence) {
      artifactPaths.add(evidence.path);
    }
  }
  const artifacts = Object.fromEntries(
    await Promise.all(
      [...artifactPaths]
        .sort()
        .map(async (path) => [path, await readArtifact(path)]),
    ),
  );
  const evidenceRevisions = [
    ...new Set(
      Object.values(registry.records).flatMap((record) =>
        record.evidence.map((evidence) => evidence.revision),
      ),
    ),
  ].sort();
  const validRevisions = (
    await Promise.all(
      evidenceRevisions.map(async (revision) => ({
        revision,
        valid: await revisionIsInCheckedHistory(revision),
      })),
    )
  )
    .filter(({ valid }) => valid)
    .map(({ revision }) => revision);

  return validateCertificationArtifacts({
    registry,
    artifacts,
    validRevisions,
  });
}

async function runMain() {
  const command = parseArguments(process.argv.slice(2));
  if (command === undefined) {
    writeError({ ok: false, code: "CERTIFICATION_ARGUMENT_INVALID" });
    process.exitCode = 2;
    return;
  }

  const rawRegistry = await readRegistry();
  if (rawRegistry === undefined) {
    writeError({ ok: false, code: "CERTIFICATION_REGISTRY_UNREADABLE" });
    process.exitCode = 2;
    return;
  }

  const registry = validateContract(certificationRegistrySchema, rawRegistry);
  if (!registry.ok) {
    writeStandard({
      ok: false,
      gate: "contract",
      issues: registry.issues,
    });
    process.exitCode = 1;
    return;
  }

  if (command.kind === "artifacts") {
    const artifactValidation = await validatePrivateArtifacts(registry.value);
    if (!artifactValidation.ok) {
      writeStandard({
        ok: false,
        gate: "artifacts",
        issues: artifactValidation.issues,
      });
      process.exitCode = 1;
      return;
    }
    writeStandard({
      ok: true,
      gate: "artifacts",
      records: Object.keys(registry.value.records).length,
    });
    return;
  }

  const catalog = createVerifiedCapabilityCatalog();
  if (!catalog.ok) {
    writeStandard({
      ok: false,
      gate: "contract",
      issues: catalog.issues,
    });
    process.exitCode = 1;
    return;
  }

  const admission = validateCertificationAdmission({
    catalog: catalog.value,
    registry: registry.value,
  });
  if (!admission.ok) {
    writeStandard({ ok: false, gate: "admission", issues: admission.issues });
    process.exitCode = 1;
    return;
  }

  if (command.kind === "admission") {
    writeStandard({
      ok: true,
      gate: "admission",
      records: Object.keys(registry.value.records).length,
    });
    return;
  }

  const closure = validateCertificationClosure({
    registry: registry.value,
    policy: command.policy,
  });
  if (!closure.ok) {
    writeStandard({
      ok: false,
      gate: "closure",
      policy: command.policy,
      issues: closure.issues,
    });
    process.exitCode = 1;
    return;
  }

  writeStandard({ ok: true, gate: "closure", policy: command.policy });
}

await runMain();
