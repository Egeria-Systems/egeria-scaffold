import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createJsonSchemaArtifacts } from "../dist/index.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schemasDirectory = resolve(packageRoot, "schemas");
const arguments_ = process.argv.slice(2);
const checkOnly = arguments_.length === 1 && arguments_[0] === "--check";

if (arguments_.length > 0 && !checkOnly) {
  console.error("SCHEMA_GENERATOR_ARGUMENT_INVALID");
  process.exitCode = 2;
} else {
  const artifacts = createJsonSchemaArtifacts();

  if (!checkOnly) {
    await mkdir(schemasDirectory, { recursive: true });
  }

  for (const [artifactName, artifact] of Object.entries(artifacts)) {
    const artifactPath = resolve(schemasDirectory, artifactName);
    const expected = `${JSON.stringify(artifact, null, 2)}\n`;

    if (checkOnly) {
      let actual;

      try {
        actual = await readFile(artifactPath, "utf8");
      } catch {
        console.error(`SCHEMA_ARTIFACT_MISSING ${artifactName}`);
        process.exitCode = 1;
        continue;
      }

      if (actual !== expected) {
        console.error(`SCHEMA_ARTIFACT_STALE ${artifactName}`);
        process.exitCode = 1;
      }
    } else {
      await writeFile(artifactPath, expected, "utf8");
    }
  }
}
