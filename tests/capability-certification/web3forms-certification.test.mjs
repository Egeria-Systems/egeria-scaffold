import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, copyFile, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

import { createCliRunner } from "../../apps/cli/dist/run-cli.js";
import { prepareWeb3FormsCertification } from "../../scripts/prepare-web3forms-certification.mjs";

const execute = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const revision = "abcdef0123456789abcdef0123456789abcdef01";
const accessKey = "00000000-0000-4000-8000-000000000001";
const subject = {
  descriptorVersion: "0.1.0",
  behaviorContractDigest: "sha256:e462b6432eaac905b973d2122c122abca5fdd498e262ee63f7f2508b16978be9",
};

async function temporaryInput(context) {
  const root = await mkdtemp(join(tmpdir(), "web3forms-preparation-test-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  return { revision, accessKey, outputRoot: join(root, "candidate") };
}

// Exercise compiled CLI generation and inference; runtime verification belongs to the deployment job.
const runCli = createCliRunner({
  createVerifier: () => ({
    async prepareLockfile(root) {
      await writeFile(join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
      return { ok: true, value: undefined };
    },
    async verifyInIsolatedCopy() {
      return { ok: true, value: { checks: [
        "lockfile", "frozen-install", "lint", "typecheck", "unit-tests",
        "component-tests", "next-build", "opennext-build",
      ] } };
    },
  }),
});

function adapters(transform = async (_command, output) => output, git = {}) {
  return {
    async runCommand(input) {
      if (input.executable === "git") {
        if (input.arguments[0] === "rev-parse") return git.revision ?? `${revision}\n`;
        if (input.arguments[0] === "status") return git.status ?? "";
        if (input.arguments[0] === "ls-files") return git.index ?? "H package.json\0";
        throw new Error("unexpected test Git command");
      }
      let stdout = "";
      let stderr = "";
      const status = await runCli(input.arguments.slice(1), {
        write: value => { stdout += value; },
        writeError: value => { stderr += value; },
      });
      assert.equal(status, 0, stderr);
      return transform(input.arguments[1], stdout, input);
    },
  };
}

test("preparation checks compiled site generation without exposing its public form identifier", async context => {
  const input = await temporaryInput(context);
  const result = await prepareWeb3FormsCertification(input, adapters());
  assert.equal(result.ok, true);
  assert.equal(result.capability, "contact-form-web3forms");
  assert.equal(result.profile, "site");
  assert.equal(result.recipeVersion, "0.12.0");
  assert.equal(result.evidenceRevision, revision);
  assert.deepEqual(result.subject, subject);
  assert.deepEqual(result.checks, ["compiled-cli-create", "state-inference", "healthy-diagnostics", "exact-diff"]);
  assert.equal(JSON.stringify(result).includes(accessKey), false);
  assert.equal(JSON.stringify(result).includes(input.outputRoot), false);
  const projectRoot = join(input.outputRoot, "project");
  assert.match(await readFile(join(projectRoot, ".egeria/project.yaml"), "utf8"), /recipeVersion: 0\.12\.0/u);
  const manifest = JSON.parse(await readFile(join(projectRoot, "apps/web/package.json"), "utf8"));
  assert.equal(manifest.dependencies.next, "16.3.3");
  assert.equal(manifest.dependencies.effect, undefined);
  await assert.rejects(access(join(projectRoot, "apps/web/app/api/contact")), { code: "ENOENT" });
  assert.equal((await lstat(input.outputRoot)).mode & 0o777, 0o700);
});

test("invalid preparation inputs cannot create a candidate", async context => {
  for (const changed of [
    { accessKey: undefined }, { accessKey: "not-a-form" },
    { accessKey: `${accessKey}\n` }, { revision: "main" },
    { outputRoot: "relative-candidate" },
  ]) {
    const input = await temporaryInput(context);
    await assert.rejects(prepareWeb3FormsCertification({ ...input, ...changed }, adapters()), {
      code: "CERTIFICATION_ARGUMENT_INVALID",
    });
    await assert.rejects(access(input.outputRoot), { code: "ENOENT" });
  }
});

test("repository drift and hidden index flags stop before generating", async context => {
  for (const [git, code] of [
    [{ revision: `${"1".repeat(40)}\n` }, "CERTIFICATION_REVISION_MISMATCH"],
    [{ status: "?? unreviewed.mjs\0" }, "CERTIFICATION_WORKTREE_DIRTY"],
    [{ index: "S hidden.mjs\0" }, "CERTIFICATION_INDEX_FLAGS"],
    [{ index: "h hidden.mjs\0" }, "CERTIFICATION_INDEX_FLAGS"],
  ]) {
    const input = await temporaryInput(context);
    await assert.rejects(prepareWeb3FormsCertification(input, adapters(undefined, git)), { code });
    await assert.rejects(access(input.outputRoot), { code: "ENOENT" });
  }
});

test("existing and symlink destinations preserve their contents", async context => {
  const input = await temporaryInput(context);
  await mkdir(input.outputRoot);
  const marker = join(input.outputRoot, "owned.txt");
  await writeFile(marker, "preserve");
  const link = join(dirname(input.outputRoot), "linked-candidate");
  await symlink(input.outputRoot, link, "dir");
  for (const outputRoot of [input.outputRoot, link]) {
    await assert.rejects(prepareWeb3FormsCertification({ ...input, outputRoot }, adapters()), {
      code: "CERTIFICATION_OUTPUT_ROOT_INVALID",
    });
  }
  assert.equal(await readFile(marker, "utf8"), "preserve");
});

test("a child failure produces a stable error and leaves an inspectable owned prefix", async context => {
  const input = await temporaryInput(context);
  const controlled = adapters();
  const runCommand = controlled.runCommand;
  controlled.runCommand = command => {
    if (command.executable !== "git") throw new Error(`PRIVATE_CHILD ${accessKey} ${input.outputRoot}`);
    return runCommand(command);
  };
  await assert.rejects(prepareWeb3FormsCertification(input, controlled), error => {
    assert.equal(error.code, "CERTIFICATION_CREATE_INVALID");
    assert.equal(error.message.includes("PRIVATE_CHILD"), false);
    assert.equal(error.message.includes(accessKey), false);
    assert.equal(error.cause, undefined);
    return true;
  });
  assert.equal((await lstat(input.outputRoot)).isDirectory(), true);
});

for (const [command, corrupt, code] of [
  ["create", value => { value.profile = "app"; }, "CERTIFICATION_CREATE_INVALID"],
  ["infer", value => { value.result.state.kind = "invalid"; }, "CERTIFICATION_INFERENCE_INVALID"],
  ["doctor", value => { value.result.healthy = false; }, "CERTIFICATION_DIAGNOSTICS_INVALID"],
  ["diff", value => { value.result.equal = false; }, "CERTIFICATION_DIFF_INVALID"],
]) {
  test(`an invalid ${command} result cannot become preparation evidence`, async context => {
    const input = await temporaryInput(context);
    await assert.rejects(prepareWeb3FormsCertification(input, adapters(async (actual, output) => {
      if (actual !== command) return output;
      const value = JSON.parse(output);
      corrupt(value);
      return `${JSON.stringify(value)}\n`;
    })), { code });
  });
}

test("extra child output cannot be accepted as the CLI result", async context => {
  const input = await temporaryInput(context);
  await assert.rejects(prepareWeb3FormsCertification(input, adapters(async (command, output) =>
    command === "create" ? `${output}PRIVATE_CHILD\n` : output)), {
    code: "CERTIFICATION_CREATE_INVALID",
  });
});

test("malformed inference shapes produce only the stable refusal code", async context => {
  for (const corrupt of [
    value => { value.result.state.value = null; },
    value => { value.result.state.value.installedCapabilities[0] = null; },
    value => { value.result.capabilities[0] = null; },
  ]) {
    const input = await temporaryInput(context);
    await assert.rejects(prepareWeb3FormsCertification(input, adapters(async (command, output) => {
      if (command !== "infer") return output;
      const value = JSON.parse(output);
      corrupt(value);
      return JSON.stringify(value);
    })), { code: "CERTIFICATION_INFERENCE_INVALID" });
  }
});

test("a changed provider setting is rejected even when the child reports success", async context => {
  const input = await temporaryInput(context);
  await assert.rejects(prepareWeb3FormsCertification(input, adapters(async (command, output) => {
    if (command === "diff") {
      const projectPath = join(input.outputRoot, "project/.egeria/project.yaml");
      const original = await readFile(projectPath, "utf8");
      await writeFile(projectPath, original.replace(accessKey, "00000000-0000-4000-8000-000000000002"));
    }
    return output;
  })), { code: "CERTIFICATION_PROJECT_INVALID" });
});

test("a registry subject mismatch stops before the candidate is created", async context => {
  const input = await temporaryInput(context);
  const copyRoot = join(dirname(input.outputRoot), "repository");
  await mkdir(join(copyRoot, "scripts"), { recursive: true });
  await mkdir(join(copyRoot, "packages/builder-core"), { recursive: true });
  await mkdir(join(copyRoot, "certifications"));
  await copyFile(join(repositoryRoot, "scripts/prepare-web3forms-certification.mjs"), join(copyRoot, "scripts/prepare-web3forms-certification.mjs"));
  await symlink(join(repositoryRoot, "scripts/lib"), join(copyRoot, "scripts/lib"), "dir");
  await symlink(join(repositoryRoot, "packages/builder-core/dist"), join(copyRoot, "packages/builder-core/dist"), "dir");
  const registry = JSON.parse(await readFile(join(repositoryRoot, "certifications/capabilities.json"), "utf8"));
  registry.records["contact-form-web3forms"].subject.behaviorContractDigest = `sha256:${"0".repeat(64)}`;
  await writeFile(join(copyRoot, "certifications/capabilities.json"), JSON.stringify(registry));
  const copiedRunner = await import(pathToFileURL(join(copyRoot, "scripts/prepare-web3forms-certification.mjs")));
  await assert.rejects(copiedRunner.prepareWeb3FormsCertification(input, adapters()), {
    code: "CERTIFICATION_SUBJECT_INVALID",
  });
  await assert.rejects(access(input.outputRoot), { code: "ENOENT" });
});

test("repository changes during preparation prevent a completed summary", async context => {
  const input = await temporaryInput(context);
  const git = {};
  await assert.rejects(prepareWeb3FormsCertification(input, adapters(async (command, output) => {
    if (command === "diff") git.status = " M changed.mjs\0";
    return output;
  }, git)), { code: "CERTIFICATION_WORKTREE_DIRTY" });
});

test("direct CLI refuses extra arguments without printing configuration", async () => {
  let failure;
  try {
    await execute(process.execPath, [join(repositoryRoot, "scripts/prepare-web3forms-certification.mjs"), "--extra"], {
      env: { PATH: process.env.PATH, WEB3FORMS_ACCESS_KEY: accessKey }, encoding: "utf8",
    });
  } catch (error) { failure = error; }
  assert.equal(failure?.code, 2);
  assert.equal(failure.stdout, "");
  assert.deepEqual(JSON.parse(failure.stderr), { ok: false, code: "CERTIFICATION_ARGUMENT_INVALID" });
  assert.equal(failure.stderr.includes(accessKey), false);
});
