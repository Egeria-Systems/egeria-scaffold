import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  lstat,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const core = await import(
  pathToFileURL(resolve(packageRoot, "dist/index.js"))
);
const encoder = new TextEncoder();
const fixedGlobalOptions = [
  "--no-optional-locks",
  "--no-replace-objects",
  "--no-lazy-fetch",
  "-c",
  "core.fsmonitor=false",
  "-c",
  "core.untrackedCache=false",
];
const operationMarkers = [
  "MERGE_HEAD",
  "rebase-merge",
  "rebase-apply",
  "REVERT_HEAD",
  "CHERRY_PICK_HEAD",
  "sequencer",
];

function bytes(value) {
  return encoder.encode(value);
}

function commandResult(stdout = "", exitCode = 0) {
  return { exitCode, stdout: bytes(stdout) };
}

function inventoryIdentity(root = "/repository/worktree") {
  return {
    root,
    revision: "0123456789abcdef0123456789abcdef01234567",
    attachedRef: "refs/heads/transactional-change",
    gitDirectory: "/repository/.git/worktrees/transactional-change",
    commonDirectory: "/repository/.git",
  };
}

function scriptedInspection(overrides = {}) {
  const root = overrides.root ?? "/repository/worktree";
  const revision =
    overrides.revision ?? "0123456789abcdef0123456789abcdef01234567";
  const attachedRef = overrides.attachedRef ?? "refs/heads/transactional-change";
  const gitDirectory =
    overrides.gitDirectory ?? "/repository/.git/worktrees/transactional-change";
  const commonDirectory = overrides.commonDirectory ?? "/repository/.git";
  const calls = [];
  const markerPaths = new Map(
    operationMarkers.map((marker) => [
      marker,
      `${gitDirectory}/${marker}`,
    ]),
  );
  const metadata = new Map();

  const runGit = async (_root, arguments_) => {
    calls.push([...arguments_]);
    const key = arguments_.join("\0");

    if (overrides.throwAt === key) {
      throw new Error("private process detail");
    }

    if (key === "rev-parse\0--show-toplevel") {
      return overrides.topLevelResult ?? commandResult(`${root}\n`);
    }
    if (key === "rev-parse\0--verify\0HEAD^{commit}") {
      return overrides.revisionResult ?? commandResult(`${revision}\n`);
    }
    if (key === "symbolic-ref\0--quiet\0HEAD") {
      return overrides.refResult ?? commandResult(`${attachedRef}\n`);
    }
    if (key === "rev-parse\0--path-format=absolute\0--git-dir") {
      return overrides.gitDirectoryResult ?? commandResult(`${gitDirectory}\n`);
    }
    if (key === "rev-parse\0--path-format=absolute\0--git-common-dir") {
      return overrides.commonDirectoryResult ?? commandResult(`${commonDirectory}\n`);
    }
    if (arguments_[0] === "rev-parse" && arguments_[1] === "--git-path") {
      const marker = arguments_[2];
      return (
        overrides.markerResults?.get(marker) ??
        commandResult(`${markerPaths.get(marker)}\n`)
      );
    }
    if (key === "ls-files\0-v\0-z") {
      return overrides.indexResult ?? commandResult("H tracked.txt\0");
    }
    if (key === "status\0--porcelain=v1\0-z\0--untracked-files=all") {
      return overrides.statusResult ?? commandResult();
    }

    throw new Error("unexpected command");
  };

  const readMetadata = async (path) =>
    overrides.metadataResults?.get(path) ?? metadata.get(path) ?? "missing";

  return {
    attachedRef,
    calls,
    commonDirectory,
    gitDirectory,
    markerPaths,
    readMetadata,
    revision,
    root,
    runGit,
  };
}

async function inspectScript(script) {
  return core.inspectGitWorktree({
    root: script.root,
    runGit: script.runGit,
    readMetadata: script.readMetadata,
  });
}

function scriptIdentity(script) {
  return {
    root: script.root,
    revision: script.revision,
    attachedRef: script.attachedRef,
    gitDirectory: script.gitDirectory,
    commonDirectory: script.commonDirectory,
  };
}

async function inspectExpectedScript(script, expectedPaths) {
  return core.inspectGitExpectedChanges({
    root: script.root,
    identity: scriptIdentity(script),
    expectedPaths,
    runGit: script.runGit,
    readMetadata: script.readMetadata,
  });
}

test("repository inventory deterministically preserves Git-visible entry kinds", async () => {
  const root = "/repository/worktree";
  const calls = [];
  const runGit = async (_root, arguments_) => {
    calls.push(arguments_);
    if (arguments_.includes("--cached")) {
      return commandResult(
        [
          "100644 0\tzeta.ts",
          "120000 0\tlinked-config.ts",
          "160000 0\tvendor/repository",
          "100755 0\tscripts/remove-booking.mjs",
          "",
        ].join("\0"),
      );
    }
    return commandResult("alpha.ts\0");
  };

  const result = await core.inspectGitRepositoryInventory({
    root,
    identity: inventoryIdentity(root),
    runGit,
  });

  assert.deepEqual(result, {
    ok: true,
    value: {
      entries: [
        { path: "alpha.ts", kind: "file", source: "untracked" },
        { path: "linked-config.ts", kind: "symlink", source: "tracked" },
        {
          path: "scripts/remove-booking.mjs",
          kind: "file",
          source: "tracked",
        },
        { path: "vendor/repository", kind: "gitlink", source: "tracked" },
        { path: "zeta.ts", kind: "file", source: "tracked" },
      ],
      truncated: false,
    },
  });
  assert.deepEqual(calls, [
    [
      "ls-files",
      "--cached",
      "--full-name",
      "-z",
      "--format=%(objectmode) %(stage)%x09%(path)",
    ],
    [
      "ls-files",
      "--others",
      "--exclude-standard",
      "--full-name",
      "-z",
    ],
  ]);
});

test("repository inventory refuses malformed or identity-detached Git output", async () => {
  const root = "/repository/worktree";
  const validUntracked = commandResult();
  const cases = [
    {
      identity: inventoryIdentity("/different/worktree"),
      tracked: commandResult(),
    },
    { identity: inventoryIdentity(root), tracked: commandResult("100644 0\ta") },
    { identity: inventoryIdentity(root), tracked: commandResult("100600 0\ta\0") },
    { identity: inventoryIdentity(root), tracked: commandResult("100644 1\ta\0") },
    {
      identity: inventoryIdentity(root),
      tracked: commandResult("100644 0\t../outside.ts\0"),
    },
    {
      identity: inventoryIdentity(root),
      tracked: commandResult(["100644 0\ta.ts", "100644 0\ta.ts", ""].join("\0")),
    },
  ];

  for (const testCase of cases) {
    let calls = 0;
    const result = await core.inspectGitRepositoryInventory({
      root,
      identity: testCase.identity,
      runGit: async () => {
        calls += 1;
        return calls === 1 ? testCase.tracked : validUntracked;
      },
    });

    assert.deepEqual(result, {
      ok: false,
      code: "GIT_REPOSITORY_INVENTORY_INVALID",
    });
  }
});

test("repository inventory reports deterministic entry-limit coverage", async () => {
  const paths = Array.from(
    { length: 20_001 },
    (_, index) => `src/file-${String(index).padStart(5, "0")}.ts`,
  );
  const tracked = `${paths.map((path) => `100644 0\t${path}`).join("\0")}\0`;
  let calls = 0;

  const result = await core.inspectGitRepositoryInventory({
    root: "/repository/worktree",
    identity: inventoryIdentity(),
    runGit: async () => {
      calls += 1;
      return calls === 1 ? commandResult(tracked) : commandResult();
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.entries.length, 20_000);
  assert.equal(result.value.entries[0].path, "src/file-00000.ts");
  assert.equal(result.value.entries.at(-1).path, "src/file-19999.ts");
  assert.equal(result.value.truncated, true);
});

test("Git worktree inspection builds an exact bounded Git process request", async () => {
  const requests = [];
  const runGit = core.createGitCommandRunner({
    execute: async (request) => {
      requests.push(request);
      return commandResult("clean");
    },
    sourceEnvironment: {
      PATH: "/trusted/bin",
      HOME: "/private/home",
      LANG: "private-locale",
      GIT_DIR: "/private/git-dir",
      GIT_CONFIG_COUNT: "2",
      GIT_OBJECT_DIRECTORY: "/private/objects",
    },
    platform: "darwin",
  });

  assert.deepEqual(
    await runGit("/repository/worktree", ["status", "--porcelain=v1", "-z"]),
    commandResult("clean"),
  );
  assert.deepEqual(requests, [
    {
      executable: "git",
      arguments: [
        ...fixedGlobalOptions,
        "status",
        "--porcelain=v1",
        "-z",
      ],
      options: {
        cwd: "/repository/worktree",
        shell: false,
        timeout: 10_000,
        maxBuffer: 1024 * 1024,
        windowsHide: true,
        encoding: "buffer",
        env: {
          PATH: "/trusted/bin",
          GIT_OPTIONAL_LOCKS: "0",
          GIT_NO_LAZY_FETCH: "1",
          GIT_CONFIG_NOSYSTEM: "1",
          GIT_CONFIG_GLOBAL: "/dev/null",
          LC_ALL: "C",
        },
      },
    },
  ]);

  const windowsRequests = [];
  const windowsRunGit = core.createGitCommandRunner({
    execute: async (request) => {
      windowsRequests.push(request);
      return commandResult();
    },
    sourceEnvironment: {
      Path: "C:\\Git\\cmd",
      SystemRoot: "C:\\Windows",
      ComSpec: "C:\\Windows\\System32\\cmd.exe",
      PATHEXT: ".COM;.EXE",
      GIT_WORK_TREE: "C:\\private",
    },
    platform: "win32",
  });
  await windowsRunGit("C:\\repository", ["status"]);
  assert.deepEqual(windowsRequests[0].options.env, {
    PATH: "C:\\Git\\cmd",
    SystemRoot: "C:\\Windows",
    ComSpec: "C:\\Windows\\System32\\cmd.exe",
    PATHEXT: ".COM;.EXE",
    GIT_OPTIONAL_LOCKS: "0",
    GIT_NO_LAZY_FETCH: "1",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "NUL",
    LC_ALL: "C",
  });
});

test("expected Git changes require the exact identity and path set", async () => {
  const expectedPaths = ["tracked.txt", "new/nested.txt"];
  const exact = scriptedInspection({
    statusResult: commandResult(" M tracked.txt\0?? new/nested.txt\0"),
  });
  assert.deepEqual(await inspectExpectedScript(exact, expectedPaths), {
    ok: true,
  });

  for (const status of [
    " M tracked.txt\0",
    " M tracked.txt\0?? new/nested.txt\0?? extra.txt\0",
    "R  tracked.txt\0old.txt\0?? new/nested.txt\0",
    "UU tracked.txt\0?? new/nested.txt\0",
    "!! tracked.txt\0?? new/nested.txt\0",
  ]) {
    const script = scriptedInspection({ statusResult: commandResult(status) });
    assert.deepEqual(await inspectExpectedScript(script, expectedPaths), {
      ok: false,
      code: status.startsWith("UU")
        ? "GIT_WORKTREE_CONFLICTED"
        : "GIT_WORKTREE_CHANGED",
    });
  }

  const changedIdentity = scriptedInspection({
    statusResult: commandResult(" M tracked.txt\0?? new/nested.txt\0"),
  });
  assert.deepEqual(
    await core.inspectGitExpectedChanges({
      root: changedIdentity.root,
      identity: {
        ...scriptIdentity(changedIdentity),
        revision: "abcdef0123456789abcdef0123456789abcdef01",
      },
      expectedPaths,
      runGit: changedIdentity.runGit,
      readMetadata: changedIdentity.readMetadata,
    }),
    { ok: false, code: "GIT_WORKTREE_CHANGED" },
  );

  assert.deepEqual(
    await core.inspectGitExpectedChanges({
      root: exact.root,
      identity: scriptIdentity(exact),
      expectedPaths: ["../unsafe"],
      runGit: exact.runGit,
      readMetadata: exact.readMetadata,
    }),
    { ok: false, code: "GIT_WORKTREE_IDENTITY_INVALID" },
  );
});

test("expected Git changes accept exact porcelain deletion paths only", async () => {
  const expectedPaths = ["changed.txt", "deleted.txt"];
  const exact = scriptedInspection({
    statusResult: commandResult(" M changed.txt\0 D deleted.txt\0"),
  });
  assert.deepEqual(await inspectExpectedScript(exact, expectedPaths), {
    ok: true,
  });

  for (const fixture of [
    {
      status: " M changed.txt\0",
      code: "GIT_WORKTREE_CHANGED",
    },
    {
      status: " M changed.txt\0 D deleted.txt\0?? extra.txt\0",
      code: "GIT_WORKTREE_CHANGED",
    },
    {
      status: " M changed.txt\0R  deleted.txt\0original.txt\0",
      code: "GIT_WORKTREE_CHANGED",
    },
    {
      status: " M changed.txt\0UD deleted.txt\0",
      code: "GIT_WORKTREE_CONFLICTED",
    },
  ]) {
    const script = scriptedInspection({
      statusResult: commandResult(fixture.status),
    });
    assert.deepEqual(await inspectExpectedScript(script, expectedPaths), {
      ok: false,
      code: fixture.code,
    });
  }
});

test("Git worktree inspection passes the exact request through execFile and contains failures", async () => {
  const calls = [];
  const stdout = Buffer.from("bounded-output");
  const options = {
    cwd: "/repository/worktree",
    shell: false,
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
    windowsHide: true,
    encoding: "buffer",
    env: Object.freeze({ PATH: "/trusted/bin", LC_ALL: "C" }),
  };
  const request = {
    executable: "git",
    arguments: Object.freeze(["status", "--porcelain=v1", "-z"]),
    options,
  };
  const execute = core.createGitProcessExecutor(
    (executable, arguments_, receivedOptions, callback) => {
      calls.push({ executable, arguments_, receivedOptions });
      callback(null, stdout, Buffer.from("private-stderr"));
    },
  );

  assert.deepEqual(await execute(request), {
    exitCode: 0,
    stdout: new Uint8Array(stdout),
  });
  assert.equal(calls[0].executable, "git");
  assert.deepEqual(calls[0].arguments_, request.arguments);
  assert.notEqual(calls[0].arguments_, request.arguments);
  assert.equal(calls[0].receivedOptions, options);
  assert.equal(calls[0].receivedOptions.env, options.env);

  const nonZero = core.createGitProcessExecutor(
    (_executable, _arguments, _options, callback) => {
      callback(
        Object.assign(new Error("private failure"), { code: 17 }),
        Buffer.from("bounded-refusal"),
        Buffer.from("private-stderr"),
      );
    },
  );
  assert.deepEqual(await nonZero(request), {
    exitCode: 17,
    stdout: new Uint8Array(Buffer.from("bounded-refusal")),
  });

  for (const processError of [
    Object.assign(new Error("private timeout"), {
      code: null,
      killed: true,
      signal: "SIGTERM",
    }),
    Object.assign(new Error("private overflow"), {
      code: "ERR_CHILD_PROCESS_STDIO_MAXBUFFER",
    }),
  ]) {
    const failing = core.createGitProcessExecutor(
      (_executable, _arguments, _options, callback) => {
        callback(processError, Buffer.alloc(0), Buffer.from("private-stderr"));
      },
    );
    await assert.rejects(failing(request), (error) => {
      assert.doesNotMatch(String(error), /private|stderr/iu);
      return true;
    });
  }
});

test("Git worktree inspection retains clean linked-worktree identity in fixed command order", async () => {
  const script = scriptedInspection();
  const result = await inspectScript(script);

  assert.deepEqual(result, {
    ok: true,
    identity: {
      root: script.root,
      revision: script.revision,
      attachedRef: script.attachedRef,
      gitDirectory: script.gitDirectory,
      commonDirectory: script.commonDirectory,
    },
  });
  assert.deepEqual(script.calls, [
    ["rev-parse", "--show-toplevel"],
    ["rev-parse", "--verify", "HEAD^{commit}"],
    ["symbolic-ref", "--quiet", "HEAD"],
    ["rev-parse", "--path-format=absolute", "--git-dir"],
    ["rev-parse", "--path-format=absolute", "--git-common-dir"],
    ...operationMarkers.map((marker) => ["rev-parse", "--git-path", marker]),
    ["ls-files", "-v", "-z"],
    ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
  ]);
});

test("Git worktree inspection accepts 64-character revisions with portable line endings", async () => {
  const revision =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  for (const lineEnding of ["\n", "\r\n"]) {
    const script = scriptedInspection({
      revision,
      revisionResult: commandResult(`${revision}${lineEnding}`),
    });
    const result = await inspectScript(script);

    assert.equal(result.ok, true);
    assert.equal(result.identity.revision, revision);
  }
});

test("Git worktree inspection applies stable refusal precedence", async () => {
  const cases = [
    {
      name: "non Git repository",
      script: scriptedInspection({ topLevelResult: commandResult("", 128) }),
      code: "GIT_REPOSITORY_REQUIRED",
    },
    {
      name: "canonical root mismatch",
      script: scriptedInspection({
        topLevelResult: commandResult("/different/root\n"),
      }),
      code: "GIT_WORKTREE_IDENTITY_INVALID",
    },
    {
      name: "primary worktree",
      script: scriptedInspection({
        gitDirectory: "/repository/.git",
        commonDirectory: "/repository/.git",
        refResult: commandResult("", 1),
      }),
      code: "GIT_WORKTREE_NOT_ISOLATED",
    },
    {
      name: "detached head",
      script: scriptedInspection({ refResult: commandResult("", 1) }),
      code: "GIT_BRANCH_REQUIRED",
    },
    {
      name: "unexpected symbolic-ref exit",
      script: scriptedInspection({ refResult: commandResult("", 2) }),
      code: "GIT_WORKTREE_IDENTITY_INVALID",
    },
    {
      name: "detached result with malformed output",
      script: scriptedInspection({ refResult: commandResult("unexpected\n", 1) }),
      code: "GIT_WORKTREE_IDENTITY_INVALID",
    },
    {
      name: "invalid revision identity",
      script: scriptedInspection({ revisionResult: commandResult("not-a-revision\n") }),
      code: "GIT_WORKTREE_IDENTITY_INVALID",
    },
    {
      name: "invalid common-directory identity",
      script: scriptedInspection({
        commonDirectoryResult: commandResult("relative/common-directory\n"),
      }),
      code: "GIT_WORKTREE_IDENTITY_INVALID",
    },
    {
      name: "unmerged status takes precedence over ordinary dirt",
      script: scriptedInspection({
        statusResult: commandResult(" M tracked\0UU conflict\0?? untracked\0"),
      }),
      code: "GIT_WORKTREE_CONFLICTED",
    },
    ...[
      "h assume-unchanged.txt\0",
      "S skip-worktree.txt\0",
      "s both-hidden.txt\0",
    ].map((indexOutput) => ({
      name: `hidden index entry ${JSON.stringify(indexOutput)}`,
      script: scriptedInspection({ indexResult: commandResult(indexOutput) }),
      code: "GIT_WORKTREE_DIRTY",
    })),
    {
      name: "hidden index entry does not mask a conflict",
      script: scriptedInspection({
        indexResult: commandResult("S skip-worktree.txt\0"),
        statusResult: commandResult("UU conflict\0"),
      }),
      code: "GIT_WORKTREE_CONFLICTED",
    },
    {
      name: "malformed index visibility output",
      script: scriptedInspection({ indexResult: commandResult("H missing-nul") }),
      code: "GIT_WORKTREE_IDENTITY_INVALID",
    },
    ...[
      "M  staged\0",
      " M tracked\0",
      "?? untracked\0",
      "R  renamed\0original\0",
    ].map((status) => ({
      name: `dirty status ${JSON.stringify(status)}`,
      script: scriptedInspection({ statusResult: commandResult(status) }),
      code: "GIT_WORKTREE_DIRTY",
    })),
    {
      name: "malformed non-NUL status",
      script: scriptedInspection({ statusResult: commandResult("?? untracked") }),
      code: "GIT_WORKTREE_IDENTITY_INVALID",
    },
    {
      name: "oversized status output",
      script: scriptedInspection({
        statusResult: {
          exitCode: 0,
          stdout: new Uint8Array(1024 * 1024 + 1),
        },
      }),
      code: "GIT_WORKTREE_IDENTITY_INVALID",
    },
    {
      name: "unexpected process failure",
      script: scriptedInspection({ throwAt: "rev-parse\0--show-toplevel" }),
      code: "GIT_WORKTREE_IDENTITY_INVALID",
    },
  ];

  for (const fixture of cases) {
    assert.deepEqual(
      await inspectScript(fixture.script),
      { ok: false, code: fixture.code },
      fixture.name,
    );
  }
});

test("Git worktree inspection contains every operation marker without following metadata", async () => {
  for (const marker of operationMarkers) {
    const script = scriptedInspection();
    const path = script.markerPaths.get(marker);
    const metadataResults = new Map([[path, "present"]]);
    script.readMetadata = async (candidate) =>
      metadataResults.get(candidate) ?? "missing";

    assert.deepEqual(await inspectScript(script), {
      ok: false,
      code: "GIT_OPERATION_IN_PROGRESS",
    });
  }

  for (const metadataState of ["symlink", "error"]) {
    const base = scriptedInspection();
    const markerPath = base.markerPaths.get("MERGE_HEAD");
    base.readMetadata = async (candidate) =>
      candidate === markerPath ? metadataState : "missing";
    assert.deepEqual(await inspectScript(base), {
      ok: false,
      code:
        metadataState === "symlink"
          ? "GIT_OPERATION_IN_PROGRESS"
          : "GIT_WORKTREE_IDENTITY_INVALID",
    });
  }

  const escaped = scriptedInspection({
    markerResults: new Map([
      ["MERGE_HEAD", commandResult("/private/escaped-marker\n")],
    ]),
  });
  let metadataCalled = false;
  escaped.readMetadata = async () => {
    metadataCalled = true;
    return "present";
  };
  assert.deepEqual(await inspectScript(escaped), {
    ok: false,
    code: "GIT_WORKTREE_IDENTITY_INVALID",
  });
  assert.equal(metadataCalled, false);

  const failedRead = scriptedInspection();
  failedRead.readMetadata = async () => {
    throw new Error("private metadata detail");
  };
  assert.deepEqual(await inspectScript(failedRead), {
    ok: false,
    code: "GIT_WORKTREE_IDENTITY_INVALID",
  });
});

test("Git create-target inspection refuses ignored paths and contains Git failures", async () => {
  const calls = [];
  const runGit = async (_root, arguments_) => {
    calls.push([...arguments_]);
    const path = arguments_.at(-1);

    if (path === "ignored/target.txt") {
      return commandResult("", 0);
    }

    return commandResult("", 1);
  };

  assert.deepEqual(
    await core.inspectGitCreateTargets({
      root: "/repository/worktree",
      paths: ["visible/target.txt", "ignored/target.txt"],
      runGit,
    }),
    { ok: false, code: "CAPABILITY_ACTION_CONFLICT" },
  );
  assert.deepEqual(calls, [
    ["check-ignore", "--no-index", "--quiet", "--", "ignored/target.txt"],
  ]);
  assert.deepEqual(
    await core.inspectGitCreateTargets({
      root: "/repository/worktree",
      paths: ["visible/target.txt"],
      runGit,
    }),
    { ok: true },
  );
  assert.deepEqual(
    await core.inspectGitCreateTargets({
      root: "/repository/worktree",
      paths: ["../unsafe"],
      runGit,
    }),
    { ok: false, code: "GIT_WORKTREE_IDENTITY_INVALID" },
  );
  assert.deepEqual(
    await core.inspectGitCreateTargets({
      root: "/repository/worktree",
      paths: ["failed/target.txt"],
      runGit: async () => commandResult("", 2),
    }),
    { ok: false, code: "GIT_WORKTREE_IDENTITY_INVALID" },
  );
});

async function createDisposableDirectory(context) {
  const createdPath = await mkdtemp(join(tmpdir(), "egeria-git-inspection-"));
  const path = await realpath(createdPath);
  const stats = await lstat(path, { bigint: true });
  const identity = { path, device: stats.dev, inode: stats.ino };

  context.after(async () => {
    const current = await lstat(identity.path, { bigint: true });
    assert.equal(current.isDirectory(), true);
    assert.equal(current.isSymbolicLink(), false);
    assert.equal(current.dev, identity.device);
    assert.equal(current.ino, identity.inode);
    await rm(identity.path, { recursive: true, force: false });
  });

  return path;
}

async function runGit(root, arguments_) {
  return execFileAsync("git", arguments_, {
    cwd: root,
    encoding: "buffer",
    maxBuffer: 1024 * 1024,
    timeout: 10_000,
  });
}

async function repositorySnapshot(root) {
  const [head, refs, status, indexVisibility, files] = await Promise.all([
    runGit(root, ["rev-parse", "HEAD"]),
    runGit(root, ["show-ref"]),
    runGit(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]),
    runGit(root, ["ls-files", "-v", "-z"]),
    runGit(root, ["ls-files", "-co", "--exclude-standard", "-z"]),
  ]);
  const paths = Buffer.from(files.stdout)
    .subarray(0, -1)
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .sort();
  const entries = await Promise.all(
    paths.map(async (path) => [path, new Uint8Array(await readFile(join(root, path)))]),
  );

  return {
    head: new Uint8Array(head.stdout),
    refs: new Uint8Array(refs.stdout),
    status: new Uint8Array(status.stdout),
    indexVisibility: new Uint8Array(indexVisibility.stdout),
    entries,
  };
}

test("Git worktree inspection is read-only for a real clean and dirty linked worktree", async (context) => {
  const parent = await createDisposableDirectory(context);
  const primary = join(parent, "primary");
  const linked = join(parent, "linked");
  await execFileAsync("git", ["init", primary]);
  await execFileAsync("git", ["config", "user.name", "Inspection Test"], {
    cwd: primary,
  });
  await execFileAsync("git", ["config", "user.email", "inspection@example.test"], {
    cwd: primary,
  });
  await writeFile(join(primary, ".gitignore"), "ignored.txt\n", "utf8");
  await writeFile(join(primary, "tracked.txt"), "tracked\n", "utf8");
  await runGit(primary, ["add", ".gitignore", "tracked.txt"]);
  await runGit(primary, ["commit", "-m", "initial"]);
  await runGit(primary, ["worktree", "add", "-b", "inspection-branch", linked]);
  await writeFile(join(linked, "ignored.txt"), "ignored\n", "utf8");

  const cleanBefore = await repositorySnapshot(linked);
  const cleanResult = await core.inspectGitWorktree({ root: linked });
  const cleanAfter = await repositorySnapshot(linked);
  assert.equal(cleanResult.ok, true, JSON.stringify(cleanResult));
  assert.equal(cleanResult.identity.root, linked);
  assert.notEqual(
    cleanResult.identity.gitDirectory,
    cleanResult.identity.commonDirectory,
  );
  assert.deepEqual(cleanAfter, cleanBefore);

  await writeFile(join(linked, "untracked.txt"), "untracked\n", "utf8");
  const dirtyBefore = await repositorySnapshot(linked);
  assert.deepEqual(await core.inspectGitWorktree({ root: linked }), {
    ok: false,
    code: "GIT_WORKTREE_DIRTY",
  });
  assert.deepEqual(await repositorySnapshot(linked), dirtyBefore);

  await rm(join(linked, "untracked.txt"));
  await runGit(linked, ["update-index", "--assume-unchanged", "tracked.txt"]);
  await writeFile(join(linked, "tracked.txt"), "hidden assume change\n", "utf8");
  const assumeBefore = await repositorySnapshot(linked);
  assert.equal(Buffer.from(assumeBefore.status).length, 0);
  assert.deepEqual(await core.inspectGitWorktree({ root: linked }), {
    ok: false,
    code: "GIT_WORKTREE_DIRTY",
  });
  assert.deepEqual(await repositorySnapshot(linked), assumeBefore);

  await runGit(linked, ["update-index", "--no-assume-unchanged", "tracked.txt"]);
  await writeFile(join(linked, "tracked.txt"), "tracked\n", "utf8");
  await runGit(linked, ["update-index", "--skip-worktree", "tracked.txt"]);
  await writeFile(join(linked, "tracked.txt"), "hidden skip change\n", "utf8");
  const skipBefore = await repositorySnapshot(linked);
  assert.equal(Buffer.from(skipBefore.status).length, 0);
  assert.deepEqual(await core.inspectGitWorktree({ root: linked }), {
    ok: false,
    code: "GIT_WORKTREE_DIRTY",
  });
  assert.deepEqual(await repositorySnapshot(linked), skipBefore);
});
