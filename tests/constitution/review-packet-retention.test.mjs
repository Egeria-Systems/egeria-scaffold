import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

const checkScript = resolve(import.meta.dirname, "../../scripts/check-review-packet.mjs");
const packetArgument = "docs/review-packets/current packet";
const manifestName = "packet-files.txt";

async function createPacket(context, files = { "packet.md": "# Review\n" }) {
  const root = await mkdtemp(join(tmpdir(), "review-packet-retention-"));
  context.after(() => rm(root, { recursive: true, force: true }));

  const packet = join(root, packetArgument);
  await mkdir(packet, { recursive: true });
  for (const [relativePath, content] of Object.entries(files)) {
    const destination = join(packet, relativePath);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, content);
  }

  const manifest = join(packet, manifestName);
  await writeFile(manifest, Object.keys(files).join("\n") + "\n");
  return { root, packet, manifest };
}

function checkPacket(root, args = [packetArgument]) {
  const result = spawnSync(process.execPath, [checkScript, ...args], {
    cwd: root,
    encoding: "utf8",
    timeout: 10_000,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  return result;
}

function assertRefusal(result, path) {
  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.stdout, "");
  assert.ok(result.stderr.includes(JSON.stringify(path)), result.stderr);
}

test("accepts a packet of selected records and diagnostics without changing it", async (context) => {
  const files = {
    "packet.md": "# Review and verification\n",
    "receipt.json": '{"exit":0}\n',
    "logs/check.stdout": "ok\n",
    "notes/store/v11/summary.json": "{}\n",
    "visual/expected.png": "expected",
    "visual/actual.png": "actual",
    "visual/diff.png": "diff",
  };
  const { root, packet, manifest } = await createPacket(context, files);
  const manifestContent = Object.keys(files).join("\r\n") + "\r\n";
  await writeFile(manifest, manifestContent);
  const expectedBytes = Buffer.byteLength(Object.values(files).join("") + manifestContent);
  const structure = (await readdir(packet, { recursive: true })).sort();

  const result = checkPacket(root);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /\b8 files\b/u);
  assert.ok(result.stdout.includes(String(expectedBytes)), result.stdout);
  assert.deepEqual((await readdir(packet, { recursive: true })).sort(), structure);
  assert.equal(await readFile(manifest, "utf8"), manifestContent);
  for (const [path, content] of Object.entries(files)) {
    assert.equal(await readFile(join(packet, path), "utf8"), content);
  }
});

test("checks the selected packet independently of older sibling workspaces", async (context) => {
  const { root, manifest } = await createPacket(context);
  const olderInstall = join(root, "docs/review-packets/older/verification/node_modules");
  await mkdir(olderInstall, { recursive: true });
  await writeFile(join(olderInstall, "dependency.mjs"), "export default 1;\n");
  await writeFile(manifest, "packet.md");

  const result = checkPacket(root);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\b2 files\b/u);
});

test("refuses an undeclared file even when it resembles a diagnostic", async (context) => {
  const { root, packet } = await createPacket(context);
  await writeFile(join(packet, "extra.log"), "unlisted output");

  assertRefusal(checkPacket(root), "extra.log");
});

test("refuses an undeclared execution subtree at its root", async (context) => {
  const { root, packet } = await createPacket(context);
  const install = join(packet, "execution/workspace/node_modules/library");
  await mkdir(install, { recursive: true });
  await writeFile(join(install, "index.js"), "contents");

  assertRefusal(checkPacket(root), "execution");
});

test("refuses missing files and an absent packet record", async (context) => {
  const { root, manifest } = await createPacket(context);

  await writeFile(manifest, "packet.md\nmissing-receipt.json\n");
  assertRefusal(checkPacket(root), "missing-receipt.json");

  await writeFile(manifest, "receipt.json\n");
  assertRefusal(checkPacket(root), "packet.md");
});

test("requires a manifest in the selected packet", async (context) => {
  const { root, manifest } = await createPacket(context);
  await rm(manifest);

  assertRefusal(checkPacket(root), manifestName);
});

test("refuses declared dependency, cache, browser and build payloads", async (context) => {
  const rejectedPaths = [
    "evidence/Node_Modules/library/index.js",
    "evidence/.pnpm/library/index.js",
    "evidence/.npm/_cacache/content-v2/sha512/ab/blob",
    "evidence/.pnpm-store/v11/files/package",
    "evidence/pnpm-store/v11/files/package",
    "evidence/cache/pnpm/v11/files/package",
    "evidence/verification-profile/Library/Caches/pnpm/lockfile-verified.jsonl",
    "evidence/verification-profile/Library/Caches/pnpm/v11/metadata/package.json",
    "evidence/verification-profile/.cache/pnpm/v11/metadata/package.json",
    "evidence/fixture-support/store/v11/files/ab/package",
    "evidence/fixture-support/store/v11/index.db",
    "evidence/fixture-support/store/v11/projects/workspace",
    "evidence/playwright-browsers/chromium-1/chrome",
    "evidence/native-browsers/chromium-1/chrome",
    "evidence/ms-playwright/chromium-1/chrome",
    "evidence/.next/BUILD_ID",
    "evidence/.open-next/worker.js",
    "evidence/.wrangler/output.js",
    "evidence/dist/bundle.js",
    "evidence/.git",
  ];

  for (const path of rejectedPaths) {
    const { root } = await createPacket(context, {
      "packet.md": "# Review\n",
      [path]: "payload",
    });
    assertRefusal(checkPacket(root), path);
  }
});

test("refuses declared workspace archives", async (context) => {
  for (const path of [
    "attachments/copied-workspace.TAR.gz",
    "attachments/copied-workspace.txz",
    "attachments/copied-workspace.tbz2",
  ]) {
    const { root } = await createPacket(context, {
      "packet.md": "# Review\n",
      [path]: "opaque archive",
    });
    assertRefusal(checkPacket(root), path);
  }
});

test("refuses ambiguous manifest entries at their source line", async (context) => {
  const { root, manifest } = await createPacket(context);
  const invalidEntries = [
    "",
    "/outside.log",
    "outside/../packet.md",
    "./packet.md",
    "reports//case.log",
    "reports\\case.log",
    "C:/outside.log",
    "C:outside.log",
    "reports/\u001bcase.log",
    "packet.md",
    manifestName,
  ];
  for (const entry of invalidEntries) {
    await writeFile(manifest, "packet.md\n" + entry + "\n");
    const result = checkPacket(root);
    assertRefusal(result, manifestName);
    assert.match(result.stderr, /\bline 2\b/u);
  }
});

test("refuses a manifest symlink", async (context) => {
  const { root, manifest } = await createPacket(context);
  const outside = join(root, "outside-manifest");
  await rename(manifest, outside);
  await symlink(outside, manifest);

  const result = checkPacket(root);
  assertRefusal(result, manifestName);
  assert.ok(!result.stderr.includes(root), result.stderr);
});

test("refuses a symlink in declared evidence", async (context) => {
  const { root, packet, manifest } = await createPacket(context);
  const outside = join(root, "outside-log");
  await writeFile(outside, "external contents");
  await symlink(outside, join(packet, "linked.log"));
  await writeFile(manifest, "packet.md\nlinked.log\n");

  const result = checkPacket(root);
  assertRefusal(result, "linked.log");
  assert.ok(!result.stderr.includes(root), result.stderr);
  assert.equal(await readFile(outside, "utf8"), "external contents");
});

test("refuses a symlink in the selected packet's directory chain", async (context) => {
  const { root } = await createPacket(context);
  const realDocs = join(root, "real-docs");
  await rename(join(root, "docs"), realDocs);
  await symlink(realDocs, join(root, "docs"), "dir");

  const result = checkPacket(root);
  assertRefusal(result, ".");
  assert.ok(!result.stderr.includes(root), result.stderr);
});

test("rejects invocations outside one repository-relative packet", async (context) => {
  const { root, packet } = await createPacket(context);
  const invalidInvocations = [
    [],
    [packetArgument, "extra"],
    [packet],
    ["docs/review-packets"],
    ["docs/review-packets/../review-packets/current packet"],
  ];

  for (const args of invalidInvocations) {
    const result = checkPacket(root, args);
    assert.equal(result.status, 2, result.stderr);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /usage/iu);
    assert.ok(!result.stderr.includes(root), result.stderr);
  }
});
