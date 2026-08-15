import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const verifierPath = resolve(
  repositoryRoot,
  "scripts/verify-approved-revision.mjs",
);
const { stdout: headOutput } = await execFileAsync(
  "git",
  ["rev-parse", "HEAD"],
  { cwd: repositoryRoot, encoding: "utf8" },
);
const currentHead = headOutput.trim();
const otherRevision =
  currentHead === "a".repeat(40) ? "b".repeat(40) : "a".repeat(40);

async function runVerifier(overrides = {}, arguments_ = []) {
  const environment = {
    ...process.env,
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: currentHead,
    EXPECTED_REVISION: currentHead,
    ...overrides,
  };
  for (const [name, value] of Object.entries(environment)) {
    if (value === undefined) delete environment[name];
  }

  try {
    const result = await execFileAsync(
      process.execPath,
      [verifierPath, ...arguments_],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        env: environment,
      },
    );
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return {
      code: error.code,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
    };
  }
}

test("approved revision admission accepts only the exact current main event revision", async () => {
  assert.deepEqual(await runVerifier(), { code: 0, stdout: "", stderr: "" });

  for (const scenario of [
    {
      name: "missing expected revision",
      environment: { EXPECTED_REVISION: undefined },
    },
    {
      name: "malformed expected revision",
      environment: { EXPECTED_REVISION: "credential-secret" },
    },
    {
      name: "uppercase expected revision",
      environment: { EXPECTED_REVISION: currentHead.toUpperCase() },
    },
    {
      name: "abbreviated expected revision",
      environment: { EXPECTED_REVISION: currentHead.slice(0, 12) },
    },
    { name: "non-main ref", environment: { GITHUB_REF: "refs/heads/release" } },
    { name: "expected event mismatch", environment: { EXPECTED_REVISION: otherRevision } },
    {
      name: "checked-out HEAD mismatch",
      environment: {
        EXPECTED_REVISION: otherRevision,
        GITHUB_SHA: otherRevision,
      },
    },
  ]) {
    const result = await runVerifier(scenario.environment);
    assert.notEqual(result.code, 0, scenario.name);
    assert.equal(result.stdout, "", scenario.name);
    assert.doesNotMatch(
      result.stderr,
      /credential-secret|[0-9a-fA-F]{12,40}/u,
      scenario.name,
    );
  }

  const argumentResult = await runVerifier({}, [
    "credential-secret-deploy-revision-a1b2c3d4e5f6",
  ]);
  assert.notEqual(argumentResult.code, 0);
  assert.equal(argumentResult.stdout, "");
  assert.equal(
    argumentResult.stderr,
    "Approved revision admission failed.\n",
  );
});
