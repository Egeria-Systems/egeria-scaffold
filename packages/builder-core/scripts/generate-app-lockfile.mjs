import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

import { parseProjectYaml } from "../dist/state/codecs.js";
import { createRecipeLockfileUrl, resolveRecipeLockfileVersion } from "../dist/generation/recipe-lockfiles.js";
import { cleanupOwnedDirectory, createOwnedTemporaryDirectory } from "../dist/generation/source-tree-safety.js";

// The input is a reviewed rendered project. Only dependency inputs are copied;
// package lifecycle scripts never run during lockfile generation.
assert.equal(process.argv.length, 3, "Supply the reviewed rendered project root.");
const source = resolve(process.argv[2]);
const project = parseProjectYaml(await readFile(join(source, ".egeria/project.yaml"), "utf8"));
assert.equal(project.ok, true, "Invalid project identity.");
const manifest = await readFile(join(source, "apps/web/package.json"));
const version = resolveRecipeLockfileVersion(project.value, JSON.parse(manifest));
assert.equal(version, "app-0.1.0", "Only the exact app dependency graph is supported.");
const workspace = await readFile(join(source, "pnpm-workspace.yaml"));
const expectedWorkspace = parseYaml(await readFile(new URL("../templates/common/pnpm-workspace.yaml", import.meta.url), "utf8"));
expectedWorkspace.allowBuilds["msgpackr-extract"] = false;
assert.deepEqual(parseYaml(workspace.toString("utf8")), expectedWorkspace);
const target = createRecipeLockfileUrl(version);
const owner = await createOwnedTemporaryDirectory(tmpdir(), "egeria-app-lockfile-");
assert.equal(owner.ok, true, "Cannot establish temporary directory ownership.");
try {
  await mkdir(join(owner.value.path, "apps/web"), { recursive: true });
  await writeFile(join(owner.value.path, "apps/web/package.json"), manifest);
  await writeFile(join(owner.value.path, "pnpm-workspace.yaml"), workspace);
  await writeFile(join(owner.value.path, "package.json"), await readFile(join(source, "package.json")));
  let existing;
  try {
    existing = await readFile(target);
    await writeFile(join(owner.value.path, "pnpm-lock.yaml"), existing);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const pnpmVersion = execFileSync("pnpm", ["--version"], { encoding: "utf8" }).trim();
  assert.equal(pnpmVersion, "11.20.0");
  execFileSync("pnpm", [
    "install", "--lockfile-only", "--ignore-scripts", "--registry=https://registry.npmjs.org/",
    ...(existing ? ["--frozen-lockfile"] : []),
  ], { cwd: owner.value.path, stdio: "inherit", timeout: 900_000 });
  const generated = await readFile(join(owner.value.path, "pnpm-lock.yaml"));
  if (existing) {
    assert.deepEqual(generated, existing, "Existing reviewed lockfile changed.");
  } else {
    await mkdir(new URL(".", target), { recursive: true });
    await writeFile(target, generated, { flag: "wx" });
  }
  process.stdout.write("Exact app lockfile generated or verified.\n");
} finally {
  assert.equal(await cleanupOwnedDirectory(owner.value), true, "Owned cleanup failed.");
}
