import assert from "node:assert/strict";
import { chmod, link, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { createFileSystemCapabilityRemovalWriter } from "../dist/lifecycle/capability-removal-writer.js";

const encoder = new TextEncoder();

async function createTemporaryRoot(context, prefix) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  context.after(() => rm(root, { recursive: true, force: false }));
  return root;
}

test("filesystem removal writer commits an ordered replace/delete batch and preserves replacement mode", async (context) => {
  assert.equal(typeof createFileSystemCapabilityRemovalWriter, "function");
  const root = await createTemporaryRoot(context, "egeria-removal-writer-");
  const replacement = join(root, "replace.txt");
  const deletion = join(root, "delete.txt");
  await writeFile(replacement, "before\n", "utf8");
  await chmod(replacement, 0o600);
  await writeFile(deletion, "delete me\n", "utf8");

  const writer = createFileSystemCapabilityRemovalWriter(root);
  assert.deepEqual(
    await writer.write([
      {
        kind: "replace-file",
        path: "replace.txt",
        expected: encoder.encode("before\n"),
        content: encoder.encode("after\n"),
      },
      {
        kind: "delete-file",
        path: "delete.txt",
        expected: encoder.encode("delete me\n"),
      },
    ]),
    { ok: true },
  );
  assert.equal(await readFile(replacement, "utf8"), "after\n");
  assert.equal(Number((await lstat(replacement)).mode & 0o777), 0o600);
  await assert.rejects(lstat(deletion), (error) => error?.code === "ENOENT");
});

test("filesystem removal writer preflights the complete batch without mutation", async (context) => {
  const root = await createTemporaryRoot(context, "egeria-removal-preflight-");
  await writeFile(join(root, "target.txt"), "before\n", "utf8");
  await mkdir(join(root, "directory"));
  await symlink(join(root, "target.txt"), join(root, "target-link"));
  await symlink(root, join(root, "ancestor-link"));
  const writer = createFileSystemCapabilityRemovalWriter(root);
  const replace = {
    kind: "replace-file",
    path: "target.txt",
    expected: encoder.encode("before\n"),
    content: encoder.encode("after\n"),
  };

  const invalidBatches = [
    [{ ...replace, path: "../outside.txt" }],
    [{ ...replace, path: join(root, "target.txt") }],
    [{ ...replace, path: "missing.txt" }],
    [{ ...replace, path: "directory" }],
    [{ ...replace, path: "target-link" }],
    [{ ...replace, path: "ancestor-link/target.txt" }],
    [{ ...replace, expected: encoder.encode("stale\n") }],
    [replace, { ...replace }],
    [],
  ];

  for (const changes of invalidBatches) {
    assert.deepEqual(await writer.write(changes), {
      ok: false,
      sourceChanged: false,
    });
    assert.equal(await readFile(join(root, "target.txt"), "utf8"), "before\n");
  }

  const rootLink = `${root}-link`;
  await symlink(root, rootLink);
  context.after(() => unlink(rootLink));
  assert.deepEqual(
    await createFileSystemCapabilityRemovalWriter(rootLink).write([replace]),
    { ok: false, sourceChanged: false },
  );
  assert.deepEqual(
    await createFileSystemCapabilityRemovalWriter("relative-root").write([
      replace,
    ]),
    { ok: false, sourceChanged: false },
  );
});

test("filesystem removal writer refuses replacement and deletion races without clobbering live bytes", async (context) => {
  const root = await createTemporaryRoot(context, "egeria-removal-race-");
  const replacement = join(root, "replace.txt");
  const deletion = join(root, "delete.txt");
  await writeFile(replacement, "before\n", "utf8");
  await writeFile(deletion, "delete me\n", "utf8");

  const replacementWriter = createFileSystemCapabilityRemovalWriter(root, {
    beforeCommit: async () => writeFile(replacement, "concurrent\n", "utf8"),
  });
  assert.deepEqual(
    await replacementWriter.write([
      {
        kind: "replace-file",
        path: "replace.txt",
        expected: encoder.encode("before\n"),
        content: encoder.encode("after\n"),
      },
    ]),
    { ok: false, sourceChanged: true },
  );
  assert.equal(await readFile(replacement, "utf8"), "concurrent\n");

  const deletionWriter = createFileSystemCapabilityRemovalWriter(root, {
    beforeCommit: async () => writeFile(deletion, "concurrent\n", "utf8"),
  });
  assert.deepEqual(
    await deletionWriter.write([
      {
        kind: "delete-file",
        path: "delete.txt",
        expected: encoder.encode("delete me\n"),
      },
    ]),
    { ok: false, sourceChanged: true },
  );
  assert.equal(await readFile(deletion, "utf8"), "concurrent\n");
});

test("filesystem removal writer retains a committed prefix and leaves later paths unchanged", async (context) => {
  const root = await createTemporaryRoot(context, "egeria-removal-prefix-");
  await writeFile(join(root, "first.txt"), "first before\n", "utf8");
  await writeFile(join(root, "second.txt"), "second before\n", "utf8");
  await writeFile(join(root, "third.txt"), "third before\n", "utf8");
  const writer = createFileSystemCapabilityRemovalWriter(root, {
    beforeCommit: (path) =>
      path === "second.txt"
        ? Promise.reject(new Error("injected failure"))
        : Promise.resolve(),
  });

  assert.deepEqual(
    await writer.write([
      {
        kind: "replace-file",
        path: "first.txt",
        expected: encoder.encode("first before\n"),
        content: encoder.encode("first after\n"),
      },
      {
        kind: "delete-file",
        path: "second.txt",
        expected: encoder.encode("second before\n"),
      },
      {
        kind: "delete-file",
        path: "third.txt",
        expected: encoder.encode("third before\n"),
      },
    ]),
    { ok: false, sourceChanged: true },
  );
  assert.equal(await readFile(join(root, "first.txt"), "utf8"), "first after\n");
  assert.equal(await readFile(join(root, "second.txt"), "utf8"), "second before\n");
  assert.equal(await readFile(join(root, "third.txt"), "utf8"), "third before\n");
});

test("filesystem removal writer cleans only its identity-matching temporary file", async (context) => {
  const root = await createTemporaryRoot(context, "egeria-removal-temporary-");
  const target = join(root, "target.txt");
  await writeFile(target, "before\n", "utf8");
  let substitutedTemporaryPath;
  const writer = createFileSystemCapabilityRemovalWriter(root, {
    beforeCommit: async () => {
      const temporaryName = (await readdir(root)).find((name) =>
        name.startsWith(".egeria-removal-"),
      );
      assert.ok(temporaryName);
      substitutedTemporaryPath = join(root, temporaryName);
      await unlink(substitutedTemporaryPath);
      await writeFile(substitutedTemporaryPath, "concurrent temporary\n", "utf8");
      throw new Error("injected failure");
    },
  });

  assert.deepEqual(
    await writer.write([
      {
        kind: "replace-file",
        path: "target.txt",
        expected: encoder.encode("before\n"),
        content: encoder.encode("after\n"),
      },
    ]),
    { ok: false, sourceChanged: true },
  );
  assert.equal(await readFile(target, "utf8"), "before\n");
  assert.equal(await readFile(substitutedTemporaryPath, "utf8"), "concurrent temporary\n");
});

test("filesystem removal writer preserves its temporary path after concurrent byte changes", async (context) => {
  const root = await createTemporaryRoot(context, "egeria-removal-temporary-bytes-");
  const target = join(root, "target.txt");
  await writeFile(target, "before\n", "utf8");
  let modifiedTemporaryPath;
  const writer = createFileSystemCapabilityRemovalWriter(root, {
    beforeCommit: async () => {
      const temporaryName = (await readdir(root)).find((name) =>
        name.startsWith(".egeria-removal-"),
      );
      assert.ok(temporaryName);
      modifiedTemporaryPath = join(root, temporaryName);
      await writeFile(modifiedTemporaryPath, "changed\n", "utf8");
      throw new Error("injected failure");
    },
  });

  assert.deepEqual(
    await writer.write([
      {
        kind: "replace-file",
        path: "target.txt",
        expected: encoder.encode("before\n"),
        content: encoder.encode("after\n"),
      },
    ]),
    { ok: false, sourceChanged: true },
  );
  assert.equal(await readFile(target, "utf8"), "before\n");
  assert.equal(await readFile(modifiedTemporaryPath, "utf8"), "changed\n");
});

test("filesystem removal writer confines final mutations to the validated parent directory", async (context) => {
  const root = await createTemporaryRoot(context, "egeria-removal-parent-race-");
  const outside = await createTemporaryRoot(context, "egeria-removal-parent-outside-");
  const replacementParent = join(root, "replacement");
  const movedReplacementParent = join(root, "replacement-moved");
  await mkdir(replacementParent);
  await writeFile(join(replacementParent, "target.txt"), "before\n", "utf8");
  await link(
    join(replacementParent, "target.txt"),
    join(outside, "target.txt"),
  );

  const replacementWriter = createFileSystemCapabilityRemovalWriter(root, {
    beforeMutation: async () => {
      const temporaryName = (await readdir(replacementParent)).find((name) =>
        name.startsWith(".egeria-removal-"),
      );
      assert.ok(temporaryName);
      await rename(replacementParent, movedReplacementParent);
      await link(
        join(movedReplacementParent, temporaryName),
        join(outside, temporaryName),
      );
      await symlink(outside, replacementParent);
    },
  });
  assert.deepEqual(
    await replacementWriter.write([
      {
        kind: "replace-file",
        path: "replacement/target.txt",
        expected: encoder.encode("before\n"),
        content: encoder.encode("after\n"),
      },
    ]),
    { ok: false, sourceChanged: true },
  );
  assert.equal(await readFile(join(outside, "target.txt"), "utf8"), "before\n");
  assert.equal(
    await readFile(join(movedReplacementParent, "target.txt"), "utf8"),
    "before\n",
  );

  const deletionParent = join(root, "deletion");
  const movedDeletionParent = join(root, "deletion-moved");
  await mkdir(deletionParent);
  await writeFile(
    join(deletionParent, "delete-target.txt"),
    "delete me\n",
    "utf8",
  );
  await link(
    join(deletionParent, "delete-target.txt"),
    join(outside, "delete-target.txt"),
  );
  const deletionWriter = createFileSystemCapabilityRemovalWriter(root, {
    beforeMutation: async () => {
      await rename(deletionParent, movedDeletionParent);
      await symlink(outside, deletionParent);
    },
  });
  assert.deepEqual(
    await deletionWriter.write([
      {
        kind: "delete-file",
        path: "deletion/delete-target.txt",
        expected: encoder.encode("delete me\n"),
      },
    ]),
    { ok: false, sourceChanged: true },
  );
  assert.equal(
    await readFile(join(outside, "delete-target.txt"), "utf8"),
    "delete me\n",
  );
  assert.equal(
    await readFile(join(movedDeletionParent, "delete-target.txt"), "utf8"),
    "delete me\n",
  );
});
