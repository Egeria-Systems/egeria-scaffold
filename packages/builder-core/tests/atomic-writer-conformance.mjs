import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

export const encoder = new TextEncoder();

export async function createTemporaryRoot(context, prefix) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  context.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

export async function assertMissing(path) {
  await assert.rejects(lstat(path), (error) => error?.code === "ENOENT");
}

function replacement(path, expected, content) {
  return {
    path,
    expected: { kind: "file", content: encoder.encode(expected) },
    content: encoder.encode(content),
  };
}

export function creation(path, content) {
  return {
    path,
    expected: { kind: "missing" },
    content,
  };
}

async function runWriterWithFileSizeLimit({
  root,
  writerModuleUrl,
  writerExportName,
  subprocessLabel,
}) {
  const script = `
    import { ${writerExportName} } from ${JSON.stringify(writerModuleUrl)};
    const result = await ${writerExportName}(${JSON.stringify(root)}).write([{
      path: "target.txt",
      expected: { kind: "file", content: new TextEncoder().encode("before\\n") },
      content: new Uint8Array(4096).fill(65),
    }]);
    process.stdout.write(JSON.stringify(result));
  `;
  return new Promise((resolveResult, rejectResult) => {
    const output = [];
    const child = spawn(
      "/bin/sh",
      [
        "-c",
        'ulimit -f 1; exec "$1" --input-type=module --eval "$2"',
        subprocessLabel,
        process.execPath,
        script,
      ],
      {
        cwd: root,
        env: {},
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
    child.stdout.on("data", (chunk) => output.push(chunk));
    child.once("error", rejectResult);
    child.once("close", (code) => {
      if (code !== 0) {
        rejectResult(new Error(`writer exited with code ${String(code)}`));
        return;
      }
      resolveResult(JSON.parse(Buffer.concat(output).toString("utf8")));
    });
  });
}

export function registerAtomicWriterConformanceTests({
  createWriter,
  operationName,
  fixturePrefix,
  temporaryFilePrefix,
  writerModuleUrl,
  writerExportName,
}) {
  test(
    `${operationName} writer commits ordered replacements and creates with exact bytes and modes`,
    async (context) => {
      const root = await createTemporaryRoot(
        context,
        `egeria-${fixturePrefix}-writer-`,
      );
      const replacementPath = join(root, "existing.txt");
      const binaryPath = join(root, "nested", "baseline.png");
      const binary = Uint8Array.from([0, 255, 137, 80, 78, 71, 13, 10, 0, 42]);
      await writeFile(replacementPath, "before\n", "utf8");
      await chmod(replacementPath, 0o600);
      const committed = [];
      const writer = createWriter(root, {
        beforeCommit: async (path) => committed.push(path),
      });

      assert.deepEqual(
        await writer.write([
          replacement("existing.txt", "before\n", "after\n"),
          creation("nested/baseline.png", binary),
        ]),
        { ok: true },
      );
      assert.deepEqual(committed, ["existing.txt", "nested/baseline.png"]);
      assert.equal(await readFile(replacementPath, "utf8"), "after\n");
      assert.equal(Number((await lstat(replacementPath)).mode & 0o777), 0o600);
      assert.deepEqual(await readFile(binaryPath), Buffer.from(binary));
      assert.equal(
        (await readdir(root)).some((name) =>
          name.startsWith(temporaryFilePrefix),
        ),
        false,
      );
    },
  );

  test(
    `${operationName} writer refuses invalid batches and unsafe filesystem state before mutation`,
    async (context) => {
      const root = await createTemporaryRoot(
        context,
        `egeria-${fixturePrefix}-preflight-`,
      );
      const target = join(root, "target.txt");
      await writeFile(target, "before\n", "utf8");
      await writeFile(join(root, "present.txt"), "present\n", "utf8");
      await mkdir(join(root, "directory"));
      await symlink(target, join(root, "target-link"));
      await symlink(root, join(root, "ancestor-link"));
      const writer = createWriter(root);
      const replace = replacement("target.txt", "before\n", "after\n");

      const invalidBatches = [
        [],
        [replace, { ...replace }],
        [{ ...replace, path: "../outside.txt" }],
        [{ ...replace, path: join(root, "target.txt") }],
        [{ ...replace, content: "not-bytes" }],
        [
          {
            ...replace,
            expected: { kind: "file", content: "not-bytes" },
          },
        ],
        [{ ...replace, expected: { kind: "unknown" } }],
        [replacement("missing.txt", "before\n", "after\n")],
        [replacement("directory", "before\n", "after\n")],
        [replacement("target-link", "before\n", "after\n")],
        [replacement("target.txt", "stale\n", "after\n")],
        [creation("present.txt", encoder.encode("must-not-write\n"))],
        [creation("ancestor-link/new.txt", encoder.encode("must-not-write\n"))],
      ];

      for (const changes of invalidBatches) {
        assert.deepEqual(await writer.write(changes), {
          ok: false,
          sourceChanged: false,
        });
        assert.equal(await readFile(target, "utf8"), "before\n");
        assert.equal(
          await readFile(join(root, "present.txt"), "utf8"),
          "present\n",
        );
      }

      const rootLink = `${root}-link`;
      await symlink(root, rootLink);
      context.after(() => unlink(rootLink).catch(() => undefined));
      assert.deepEqual(await createWriter(rootLink).write([replace]), {
        ok: false,
        sourceChanged: false,
      });
      assert.deepEqual(await createWriter("relative-root").write([replace]), {
        ok: false,
        sourceChanged: false,
      });
    },
  );

  test(`${operationName} writer binds the original root identity`, async (context) => {
    const root = await createTemporaryRoot(
      context,
      `egeria-${fixturePrefix}-root-`,
    );
    const movedRoot = `${root}-moved`;
    context.after(() => rm(movedRoot, { recursive: true, force: true }));
    await writeFile(join(root, "target.txt"), "before\n", "utf8");
    const writer = createWriter(root);
    await rename(root, movedRoot);
    await mkdir(root);
    await writeFile(join(root, "target.txt"), "replacement root\n", "utf8");

    assert.deepEqual(
      await writer.write([
        replacement("target.txt", "before\n", "must-not-write\n"),
      ]),
      { ok: false, sourceChanged: false },
    );
    assert.equal(
      await readFile(join(root, "target.txt"), "utf8"),
      "replacement root\n",
    );
    assert.equal(
      await readFile(join(movedRoot, "target.txt"), "utf8"),
      "before\n",
    );
  });

  test(
    `${operationName} writer preflights the complete batch before its first mutation`,
    async (context) => {
      const root = await createTemporaryRoot(
        context,
        `egeria-${fixturePrefix}-batch-`,
      );
      await writeFile(join(root, "first.txt"), "first before\n", "utf8");
      const writer = createWriter(root);

      assert.deepEqual(
        await writer.write([
          replacement("first.txt", "first before\n", "first after\n"),
          replacement("missing/new.txt", "missing\n", "must-not-write\n"),
        ]),
        { ok: false, sourceChanged: false },
      );
      assert.equal(
        await readFile(join(root, "first.txt"), "utf8"),
        "first before\n",
      );
      await assertMissing(join(root, "missing"));

      assert.deepEqual(
        await writer.write([
          creation("path-prefix", encoder.encode("file\n")),
          creation("path-prefix/nested.txt", encoder.encode("nested\n")),
        ]),
        { ok: false, sourceChanged: false },
      );
      await assertMissing(join(root, "path-prefix"));
    },
  );

  test(
    `${operationName} writer distinguishes failure before the first commit from a retained committed prefix`,
    async (context) => {
      const root = await createTemporaryRoot(
        context,
        `egeria-${fixturePrefix}-prefix-`,
      );
      const first = join(root, "first.txt");
      const second = join(root, "second.txt");
      await writeFile(first, "first before\n", "utf8");
      await writeFile(second, "second before\n", "utf8");
      const changes = [
        replacement("first.txt", "first before\n", "first after\n"),
        replacement("second.txt", "second before\n", "second after\n"),
      ];

      const beforeFirst = createWriter(root, {
        beforeCommit: () => Promise.reject(new Error("injected first failure")),
      });
      assert.deepEqual(await beforeFirst.write(changes), {
        ok: false,
        sourceChanged: false,
      });
      assert.equal(await readFile(first, "utf8"), "first before\n");
      assert.equal(await readFile(second, "utf8"), "second before\n");

      const afterFirst = createWriter(root, {
        beforeCommit: (path) =>
          path === "second.txt"
            ? Promise.reject(new Error("injected second failure"))
            : Promise.resolve(),
      });
      assert.deepEqual(await afterFirst.write(changes), {
        ok: false,
        sourceChanged: true,
      });
      assert.equal(await readFile(first, "utf8"), "first after\n");
      assert.equal(await readFile(second, "utf8"), "second before\n");
    },
  );

  test(
    `${operationName} writer refuses replacement and create races without overwriting concurrent bytes`,
    async (context) => {
      const root = await createTemporaryRoot(
        context,
        `egeria-${fixturePrefix}-race-`,
      );
      const replacementPath = join(root, "replace.txt");
      const createPath = join(root, "create.txt");
      await writeFile(replacementPath, "before\n", "utf8");

      const replacementWriter = createWriter(root, {
        beforeCommit: async () =>
          writeFile(
            replacementPath,
            "concurrent replacement\n",
            "utf8",
          ),
      });
      assert.deepEqual(
        await replacementWriter.write([
          replacement("replace.txt", "before\n", "after\n"),
        ]),
        { ok: false, sourceChanged: false },
      );
      assert.equal(
        await readFile(replacementPath, "utf8"),
        "concurrent replacement\n",
      );

      const creationWriter = createWriter(root, {
        beforeCommit: async () =>
          writeFile(createPath, "concurrent create\n", "utf8"),
      });
      assert.deepEqual(
        await creationWriter.write([
          creation("create.txt", encoder.encode("must-not-write\n")),
        ]),
        { ok: false, sourceChanged: false },
      );
      assert.equal(
        await readFile(createPath, "utf8"),
        "concurrent create\n",
      );
    },
  );

  test(
    `${operationName} writer refuses staged-byte substitution before commit`,
    async (context) => {
      const root = await createTemporaryRoot(
        context,
        `egeria-${fixturePrefix}-stage-race-`,
      );
      const target = join(root, "target.txt");
      await writeFile(target, "before\n", "utf8");
      let changedTemporaryPath;
      const writer = createWriter(root, {
        beforeCommit: async () => {
          const temporaryName = (await readdir(root)).find((name) =>
            name.startsWith(temporaryFilePrefix),
          );
          assert.ok(temporaryName);
          changedTemporaryPath = join(root, temporaryName);
          await writeFile(
            changedTemporaryPath,
            "substituted staged bytes\n",
            "utf8",
          );
        },
      });

      assert.deepEqual(
        await writer.write([
          replacement("target.txt", "before\n", "after\n"),
        ]),
        { ok: false, sourceChanged: true },
      );
      assert.equal(await readFile(target, "utf8"), "before\n");
      assert.equal(
        await readFile(changedTemporaryPath, "utf8"),
        "substituted staged bytes\n",
      );
    },
  );

  test(
    `${operationName} writer retains an actual staging write failure for inspection`,
    { skip: process.platform === "win32" },
    async (context) => {
      const root = await createTemporaryRoot(
        context,
        `egeria-${fixturePrefix}-write-failure-`,
      );
      const target = join(root, "target.txt");
      await writeFile(target, "before\n", "utf8");

      assert.deepEqual(
        await runWriterWithFileSizeLimit({
          root,
          writerModuleUrl,
          writerExportName,
          subprocessLabel: `egeria-${fixturePrefix}-write-failure`,
        }),
        {
          ok: false,
          sourceChanged: true,
        },
      );
      assert.equal(await readFile(target, "utf8"), "before\n");
      const entries = (await readdir(root)).sort();
      const temporaryNames = entries.filter((name) =>
        name.startsWith(temporaryFilePrefix),
      );
      assert.equal(temporaryNames.length, 1);
      assert.deepEqual(entries, [temporaryNames[0], "target.txt"].sort());
      const temporaryStats = await lstat(join(root, temporaryNames[0]));
      assert.equal(temporaryStats.isFile(), true);
      assert.ok(temporaryStats.size < 4096);
    },
  );

  test(
    `${operationName} writer retains uncertain staged and ancestor-race prefixes for inspection`,
    async (context) => {
      const root = await createTemporaryRoot(
        context,
        `egeria-${fixturePrefix}-staging-`,
      );
      const target = join(root, "target.txt");
      await writeFile(target, "before\n", "utf8");
      let changedTemporaryPath;
      const stagedWriter = createWriter(root, {
        beforeCommit: async () => {
          const temporaryName = (await readdir(root)).find((name) =>
            name.startsWith(temporaryFilePrefix),
          );
          assert.ok(temporaryName);
          changedTemporaryPath = join(root, temporaryName);
          await writeFile(
            changedTemporaryPath,
            "concurrent staged content\n",
            "utf8",
          );
          throw new Error("injected staged failure");
        },
      });

      assert.deepEqual(
        await stagedWriter.write([
          replacement("target.txt", "before\n", "after\n"),
        ]),
        { ok: false, sourceChanged: true },
      );
      assert.equal(await readFile(target, "utf8"), "before\n");
      assert.equal(
        await readFile(changedTemporaryPath, "utf8"),
        "concurrent staged content\n",
      );

      const outside = await createTemporaryRoot(
        context,
        `egeria-${fixturePrefix}-outside-`,
      );
      const parent = join(root, "parent");
      const movedParent = join(root, "parent-moved");
      await mkdir(parent);
      await writeFile(join(parent, "target.txt"), "parent before\n", "utf8");
      await writeFile(join(outside, "target.txt"), "outside live\n", "utf8");
      const ancestorRaceWriter = createWriter(root, {
        beforeCommit: async () => {
          await rename(parent, movedParent);
          await symlink(outside, parent);
        },
      });

      assert.deepEqual(
        await ancestorRaceWriter.write([
          replacement("parent/target.txt", "parent before\n", "must-not-write\n"),
        ]),
        { ok: false, sourceChanged: true },
      );
      assert.equal(
        await readFile(join(outside, "target.txt"), "utf8"),
        "outside live\n",
      );
      assert.equal(
        await readFile(join(movedParent, "target.txt"), "utf8"),
        "parent before\n",
      );
      assert.equal(
        (await readdir(movedParent)).some((name) =>
          name.startsWith(temporaryFilePrefix),
        ),
        true,
      );
    },
  );
}
