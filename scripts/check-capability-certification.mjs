import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

function parseArguments(arguments_) {
  if (arguments_.length === 0) {
    return { kind: "admission" };
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
  const catalog = createVerifiedCapabilityCatalog();
  if (!registry.ok || !catalog.ok) {
    writeStandard({
      ok: false,
      gate: "contract",
      issues: registry.ok ? catalog.issues : registry.issues,
    });
    process.exitCode = 1;
    return;
  }

  const artifactPaths = new Set();
  for (const record of Object.values(registry.value.records)) {
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
  const artifactValidation = validateCertificationArtifacts({
    registry: registry.value,
    artifacts,
  });
  if (!artifactValidation.ok) {
    writeStandard({
      ok: false,
      gate: "artifacts",
      issues: artifactValidation.issues,
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
