import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { parse } from "yaml";

const templateRoot = new URL("../templates/", import.meta.url);
const scriptSource = new URL("deployment-cloudflare/application-persistence/apps/web/scripts/check-application-database.mjs.template", templateRoot);
const emptyHash = "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945";
const exampleHash = "906bfcb10142df41a32676dffe6660675f775d40d5edcc179523e9536cb5cf65";
const stagingId = "11111111-1111-4111-8111-111111111111";
const productionId = "22222222-2222-4222-8222-222222222222";

async function fixture(context) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "persistence-operations-")));
  context.after(() => rm(root, { recursive: true, force: true }));
  const web = path.join(root, "apps/web");
  await mkdir(path.join(web, "scripts"), { recursive: true });
  await writeFile(path.join(web, "scripts/check-application-database.mjs"), (await readFile(scriptSource, "utf8")).replace("{{workerEntryJson}}", JSON.stringify(".open-next/worker.js")));
  const source = await readFile(new URL("deployment-cloudflare/application-persistence/apps/web/wrangler.jsonc.template", templateRoot), "utf8");
  await writeFile(path.join(web, "wrangler.jsonc"), source.replaceAll("{{workerName}}", "example-app"));
  await writeFile(path.join(root, ".gitignore"), ".wrangler/\n");
  for (const args of [["init", "--initial-branch=main"], ["add", "."], ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "-m", "Initial fixture"]]) {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  }
  const revision = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim();
  return {
    root, web,
    environment: {
      APPLICATION_DATABASE_ENVIRONMENT: "staging",
      STAGING_APPLICATION_DATABASE_ID: stagingId,
      PRODUCTION_APPLICATION_DATABASE_ID: productionId,
      EXPECTED_DATABASE_ID: stagingId,
      EXPECTED_REVISION: revision,
      GITHUB_SHA: revision,
      GITHUB_REF: "refs/heads/main",
      MIGRATION_SET_SHA256: emptyHash,
      SOURCE_REVIEW_REFERENCE: "review-123",
      RECOVERY_POINT_REFERENCE: "recovery-123",
    },
  };
}

function run(fixture, mode, overrides = {}) {
  return spawnSync(process.execPath, ["scripts/check-application-database.mjs", mode], {
    cwd: fixture.web,
    encoding: "utf8",
    env: { PATH: process.env.PATH, ...fixture.environment, ...overrides },
  });
}

function refusal(result, code) {
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.deepEqual(JSON.parse(result.stderr), { ok: false, code });
}

function commitFixture(subject) {
  for (const args of [["add", "."], ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "-m", "Add reviewed SQL"]]) {
    const result = spawnSync("git", args, { cwd: subject.root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  }
  const revision = spawnSync("git", ["rev-parse", "HEAD"], { cwd: subject.root, encoding: "utf8" }).stdout.trim();
  Object.assign(subject.environment, { EXPECTED_REVISION: revision, GITHUB_SHA: revision });
}

test("local setup and an absent migration directory require no remote IDs or credentials", async (context) => {
  const subject = await fixture(context);
  const result = run(subject, "local", { STAGING_APPLICATION_DATABASE_ID: "", PRODUCTION_APPLICATION_DATABASE_ID: "" });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { ok: true, mode: "local", migrationCount: 0, migrationSetSha256: emptyHash });
});

test("migration review hashes exact SQL names and bytes without printing SQL", async (context) => {
  const subject = await fixture(context);
  await mkdir(path.join(subject.web, "migrations"));
  await writeFile(path.join(subject.web, "migrations/0000_example.sql"), "SELECT 1;\n");
  const first = run(subject, "migration-hash");
  assert.equal(first.status, 0, first.stderr);
  assert.equal(JSON.parse(first.stdout).migrationSetSha256, exampleHash);
  await writeFile(path.join(subject.web, "migrations/0000_example.sql"), "SELECT 'private-value';\n");
  const changed = run(subject, "migration-hash");
  assert.notEqual(JSON.parse(changed.stdout).migrationSetSha256, exampleHash);
  assert.doesNotMatch(changed.stdout + changed.stderr, /private-value|SELECT/);
});

test("remote deployment derives isolated named bindings and preserves managed source", async (context) => {
  const subject = await fixture(context);
  const original = await readFile(path.join(subject.web, "wrangler.jsonc"));
  const result = run(subject, "remote-deploy", { SOURCE_REVIEW_REFERENCE: "", RECOVERY_POINT_REFERENCE: "" });
  assert.equal(result.status, 0, result.stderr);
  const config = JSON.parse(await readFile(path.join(subject.web, ".wrangler/application-database/wrangler.remote.json"), "utf8"));
  assert.equal(config.env.staging.d1_databases[0].database_id, stagingId);
  assert.equal(config.env.production.d1_databases[0].database_id, productionId);
  assert.notEqual(config.env.staging.name, config.env.production.name);
  assert.equal(config.d1_databases[0].database_id, "application-database-local");
  for (const environment of [config, config.env.staging, config.env.production]) {
    assert.equal(environment.d1_databases[0].migrations_dir, path.join(subject.web, "migrations"));
    assert.equal(environment.d1_databases[0].migrations_table, "d1_migrations");
    assert.equal(environment.assets.directory, path.join(subject.web, ".open-next/assets"));
    assert.equal(environment.version_metadata.binding, "CF_VERSION_METADATA");
  }
  assert.equal(config.main, path.join(subject.web, ".open-next/worker.js"));
  assert.deepEqual(await readFile(path.join(subject.web, "wrangler.jsonc")), original);
  assert.doesNotMatch(result.stdout + result.stderr, /11111111|22222222/);
});

for (const [name, overrides, code] of [
  ["missing IDs", { STAGING_APPLICATION_DATABASE_ID: "" }, "APPLICATION_DATABASE_IDS_REQUIRED"],
  ["duplicate IDs", { PRODUCTION_APPLICATION_DATABASE_ID: stagingId }, "APPLICATION_DATABASE_IDS_NOT_ISOLATED"],
  ["malformed IDs", { STAGING_APPLICATION_DATABASE_ID: "sensitive-not-a-uuid" }, "APPLICATION_DATABASE_IDS_REQUIRED"],
  ["unknown environment", { APPLICATION_DATABASE_ENVIRONMENT: "test-deploy" }, "APPLICATION_DATABASE_ENVIRONMENT_INVALID"],
  ["wrong database", { EXPECTED_DATABASE_ID: productionId }, "APPLICATION_DATABASE_TARGET_MISMATCH"],
  ["wrong revision", { EXPECTED_REVISION: "a".repeat(40) }, "APPLICATION_DATABASE_REVISION_MISMATCH"],
  ["non-main ref", { GITHUB_REF: "refs/heads/feature" }, "APPLICATION_DATABASE_REVISION_MISMATCH"],
  ["changed migration set", { MIGRATION_SET_SHA256: "a".repeat(64) }, "APPLICATION_DATABASE_MIGRATIONS_CHANGED"],
]) {
  test(`remote preflight refuses ${name} before writing derived configuration`, async (context) => {
    const subject = await fixture(context);
    refusal(run(subject, "remote-deploy", overrides), code);
    await assert.rejects(readFile(path.join(subject.web, ".wrangler/application-database/wrangler.remote.json")), { code: "ENOENT" });
  });
}

test("remote migration requires SQL and explicit review and recovery references", async (context) => {
  const subject = await fixture(context);
  refusal(run(subject, "remote-migrate"), "APPLICATION_DATABASE_NO_MIGRATIONS");
  await mkdir(path.join(subject.web, "migrations"));
  await writeFile(path.join(subject.web, "migrations/0000_example.sql"), "SELECT 1;\n");
  commitFixture(subject);
  refusal(run(subject, "remote-migrate", { MIGRATION_SET_SHA256: exampleHash, SOURCE_REVIEW_REFERENCE: "" }), "APPLICATION_DATABASE_REVIEW_REQUIRED");
  refusal(run(subject, "remote-migrate", { MIGRATION_SET_SHA256: exampleHash, RECOVERY_POINT_REFERENCE: "" }), "APPLICATION_DATABASE_REVIEW_REQUIRED");
  const result = run(subject, "remote-migrate", { MIGRATION_SET_SHA256: exampleHash });
  assert.equal(result.status, 0, result.stderr);
});

test("remote operation refuses checkout bytes changed after source review", async (context) => {
  const subject = await fixture(context);
  const source = path.join(subject.web, "wrangler.jsonc");
  await writeFile(source, (await readFile(source, "utf8")).replace("example-app-staging", "other-app-staging"));
  refusal(run(subject, "remote-deploy"), "APPLICATION_DATABASE_SOURCE_CHANGED");
});

test("remote operation verifies actual checkout even when supplied revision claims agree", async (context) => {
  const subject = await fixture(context);
  refusal(run(subject, "remote-deploy", { EXPECTED_REVISION: "a".repeat(40), GITHUB_SHA: "a".repeat(40) }), "APPLICATION_DATABASE_REVISION_MISMATCH");
});

for (const [workflowPath, mode, environment, operation] of [
  ["deployment-cloudflare/application-persistence/.github/workflows/deploy.yml.template", "remote-deploy", "production", "opennextjs-cloudflare"],
  ["application-persistence/.github/workflows/migrate-application-database.yml.template", "remote-migrate", "staging", "wrangler"],
]) {
  test(`${mode} workflow refuses invalid target before reaching its provider command`, async (context) => {
    const subject = await fixture(context);
    const workflow = parse((await readFile(new URL(workflowPath, templateRoot), "utf8")).replaceAll(/{{[A-Za-z0-9]+}}/g, "expression"));
    assert.deepEqual(workflow.permissions, { contents: "read" });
    assert.equal(workflow.concurrency["cancel-in-progress"], false);
    const job = Object.values(workflow.jobs)[0];
    const credentialSteps = job.steps.filter((step) => "CLOUDFLARE_API_TOKEN" in (step.env ?? {}));
    assert.equal(credentialSteps.length, 1);
    assert.deepEqual(Object.keys(credentialSteps[0].env).sort(), ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"]);
    const providerStep = credentialSteps[0];
    assert(job.steps.slice(0, job.steps.indexOf(providerStep)).some((step) => step.run === `node scripts/check-application-database.mjs ${mode}`));
    await mkdir(path.join(subject.web, "migrations"));
    await writeFile(path.join(subject.web, "migrations/0000_example.sql"), "SELECT 1;\n");
    commitFixture(subject);
    const tools = await realpath(await mkdtemp(path.join(tmpdir(), "persistence-provider-boundary-")));
    context.after(() => rm(tools, { recursive: true, force: true }));
    const sentinel = path.join(tools, "called.json");
    await writeFile(path.join(tools, "pnpm"), `#!${process.execPath}\nrequire("node:fs").writeFileSync(process.env.PROVIDER_SENTINEL, JSON.stringify(process.argv.slice(2)));\n`);
    await chmod(path.join(tools, "pnpm"), 0o700);
    const env = {
      PATH: `${tools}:${path.dirname(process.execPath)}:${process.env.PATH}`,
      ...subject.environment,
      APPLICATION_DATABASE_ENVIRONMENT: environment,
      EXPECTED_DATABASE_ID: environment === "production" ? productionId : stagingId,
      MIGRATION_SET_SHA256: exampleHash,
      CLOUDFLARE_ACCOUNT_ID: "sensitive-account-value",
      CLOUDFLARE_API_TOKEN: "sensitive-token-value",
      PROVIDER_SENTINEL: sentinel,
    };
    const refused = spawnSync("bash", ["--noprofile", "--norc", "-euo", "pipefail", "-c", providerStep.run], { cwd: subject.web, env: { ...env, STAGING_APPLICATION_DATABASE_ID: "" }, encoding: "utf8" });
    assert.equal(refused.status, 1);
    assert.doesNotMatch(refused.stdout + refused.stderr, /sensitive-/);
    await assert.rejects(readFile(sentinel), { code: "ENOENT" });
    const accepted = spawnSync("bash", ["--noprofile", "--norc", "-euo", "pipefail", "-c", providerStep.run], { cwd: subject.web, env, encoding: "utf8" });
    assert.equal(accepted.status, 0, accepted.stderr);
    const args = JSON.parse(await readFile(sentinel, "utf8"));
    assert.equal(args[0], "exec");
    assert.equal(args[1], operation);
    assert.equal(args[args.indexOf("--env") + 1], environment);
    assert.equal(args[args.indexOf("--config") + 1], ".wrangler/application-database/wrangler.remote.json");
    assert(args.includes("--x-provision=false"));
    assert(args.includes("--x-auto-create=false"));
  });
}

test("local and remote checks reject redirected migration input and output paths", async (context) => {
  const subject = await fixture(context);
  const outside = path.join(subject.root, "outside");
  await mkdir(outside);
  await symlink(outside, path.join(subject.web, "migrations"));
  refusal(run(subject, "migration-hash"), "APPLICATION_DATABASE_FILES_INVALID");
  await rm(path.join(subject.web, "migrations"));
  await mkdir(path.join(subject.web, ".wrangler"));
  await symlink(outside, path.join(subject.web, ".wrangler/application-database"));
  refusal(run(subject, "remote-deploy"), "APPLICATION_DATABASE_FILES_INVALID");
});
