import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "../..");
const cliArguments = await import(
  pathToFileURL(resolve(packageRoot, "dist/arguments.js"))
);
const cli = await import(pathToFileURL(resolve(packageRoot, "dist/run-cli.js")));
const core = await import(
  pathToFileURL(resolve(repositoryRoot, "packages/builder-core/dist/index.js"))
);

const generatedChecks = [
  "lockfile",
  "frozen-install",
  "lint",
  "typecheck",
  "next-build",
  "opennext-build",
];

function assertSuccess(result) {
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  return result.value;
}

function createFakeVerifier() {
  return {
    async prepareLockfile(root) {
      await writeFile(join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
      return { ok: true, value: undefined };
    },
    verifyInIsolatedCopy() {
      return Promise.resolve({
        ok: true,
        value: { checks: generatedChecks },
      });
    },
  };
}

function captureOutput() {
  const standard = [];
  const error = [];

  return {
    output: {
      write(value) {
        standard.push(value);
      },
      writeError(value) {
        error.push(value);
      },
    },
    standard,
    error,
  };
}

async function listTree(root) {
  const snapshot = [];

  async function visit(directory, relativeDirectory) {
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries.sort((left, right) =>
      left.name.localeCompare(right.name),
    )) {
      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${entry.name}`
        : entry.name;
      const absolutePath = join(directory, entry.name);

      if (entry.isDirectory()) {
        snapshot.push({ kind: "directory", path: relativePath });
        await visit(absolutePath, relativePath);
      } else {
        const stats = await lstat(absolutePath);
        assert.equal(stats.isFile(), true, relativePath);
        snapshot.push({
          kind: "file",
          path: relativePath,
          content: (await readFile(absolutePath)).toString("base64"),
        });
      }
    }
  }

  await visit(root, "");
  return snapshot;
}

async function executeNode(arguments_) {
  return new Promise((resolveResult) => {
    execFile(
      process.execPath,
      arguments_,
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        env: {
          PATH: process.env.PATH,
        },
      },
      (error, stdout, stderr) => {
        resolveResult({
          exitCode: error === null ? 0 : error.code,
          stdout,
          stderr,
        });
      },
    );
  });
}

async function withGeneratedFixture(run) {
  const owner = await mkdtemp(join(tmpdir(), "egeria-cli-test-"));
  const destination = join(owner, "acme-portfolio");

  try {
    assertSuccess(
      await core.generateProject({
        request: {
          profile: "portfolio",
          projectName: "acme-portfolio",
          displayName: "Acme Portfolio",
        },
        destination,
        verifier: createFakeVerifier(),
      }),
    );
    await run(destination);
  } finally {
    await rm(owner, { recursive: true, force: true });
  }
}

test("the parser accepts only the exact command-specific arguments", () => {
  assert.deepEqual(
    assertSuccess(
      cliArguments.parseCliArguments([
        "create",
        "--profile",
        "portfolio",
        "--name",
        "acme-portfolio",
        "--display-name",
        "Acme Portfolio",
        "--directory",
        "/private/tmp/acme-portfolio",
      ]),
    ),
    {
      kind: "create",
      profile: "portfolio",
      projectName: "acme-portfolio",
      displayName: "Acme Portfolio",
      directory: "/private/tmp/acme-portfolio",
    },
  );

  for (const mode of ["link", "inline", "popup"]) {
    assert.deepEqual(
      assertSuccess(
        cliArguments.parseCliArguments([
          "create",
          "--profile",
          "portfolio",
          "--name",
          "acme-portfolio",
          "--display-name",
          "Acme Portfolio",
          "--directory",
          "/private/tmp/acme-portfolio",
          "--calendly-url",
          "https://calendly.com/acme/intro",
          "--calendly-mode",
          mode,
        ]),
      ),
      {
        kind: "create",
        profile: "portfolio",
        projectName: "acme-portfolio",
        displayName: "Acme Portfolio",
        directory: "/private/tmp/acme-portfolio",
        bookingCalendly: {
          destination: "https://calendly.com/acme/intro",
          mode,
        },
      },
    );
  }

  for (const kind of ["infer", "doctor", "diff"]) {
    assert.deepEqual(
      assertSuccess(
        cliArguments.parseCliArguments([
          kind,
          "--directory",
          "/private/tmp/acme-portfolio",
        ]),
      ),
      { kind, directory: "/private/tmp/acme-portfolio" },
    );
  }
});

test("the parser rejects missing, repeated, unknown, abbreviated, and crossed arguments", () => {
  const invalidCases = [
    [],
    ["unknown", "--directory", "/private/tmp/example"],
    ["infer"],
    ["infer", "--directory", "/tmp/a", "--directory", "/tmp/b"],
    ["infer", "--directory", "/tmp/a", "--profile", "site"],
    ["infer", "--directory", "/tmp/a", "extra"],
    ["infer", "--dir", "/tmp/a"],
    [
      "create",
      "--profile",
      "application",
      "--name",
      "acme",
      "--display-name",
      "Acme",
      "--directory",
      "/tmp/acme",
    ],
    [
      "create",
      "--profile",
      "site",
      "--name",
      "Not-Kebab",
      "--display-name",
      "Acme",
      "--directory",
      "/tmp/acme",
    ],
    [
      "create",
      "--profile",
      "site",
      "--name",
      "acme",
      "--display-name",
      "   ",
      "--directory",
      "/tmp/acme",
    ],
    [
      "create",
      "--profile",
      "portfolio",
      "--name",
      "acme",
      "--display-name",
      "Acme",
      "--directory",
      "/tmp/acme",
      "--calendly-url",
      "https://calendly.com/acme/intro",
    ],
    [
      "create",
      "--profile",
      "portfolio",
      "--name",
      "acme",
      "--display-name",
      "Acme",
      "--directory",
      "/tmp/acme",
      "--calendly-mode",
      "popup",
    ],
    [
      "create",
      "--profile",
      "portfolio",
      "--name",
      "acme",
      "--display-name",
      "Acme",
      "--directory",
      "/tmp/acme",
      "--calendly-url",
      "https://calendar.example/private",
      "--calendly-mode",
      "popup",
    ],
  ];

  for (const arguments_ of invalidCases) {
    const result = cliArguments.parseCliArguments(arguments_);
    assert.equal(result.ok, false, JSON.stringify(arguments_));
    assert.deepEqual(
      result.issues,
      [
        {
          code: "CLI_ARGUMENT_INVALID",
          path: [],
          context: { reason: "invalid-arguments" },
        },
      ],
      JSON.stringify(arguments_),
    );
    assert.doesNotMatch(
      JSON.stringify(result),
      /Not-Kebab|application|\/tmp\/b|calendar\.example|private/u,
    );
  }
});

test("the runner forwards paired Calendly selection without exposing its URL", async () => {
  const owner = await mkdtemp(join(tmpdir(), "egeria-cli-calendly-"));
  const destination = join(owner, "acme-portfolio");
  const fakeVerifier = createFakeVerifier();
  const runCli = cli.createCliRunner({
    createVerifier: () => fakeVerifier,
  });
  const captured = captureOutput();

  try {
    assert.equal(
      await runCli(
        [
          "create",
          "--profile",
          "portfolio",
          "--name",
          "acme-portfolio",
          "--display-name",
          "Acme Portfolio",
          "--directory",
          destination,
          "--calendly-url",
          "https://calendly.com/acme/private-intro",
          "--calendly-mode",
          "popup",
        ],
        captured.output,
      ),
      1,
    );
    assert.deepEqual(captured.standard, []);
    assert.deepEqual(captured.error, [
      JSON.stringify({
        ok: false,
        command: "create",
        issues: [
          {
            code: "PRE_STATE_INFERENCE_FAILED",
            path: [],
            context: { reason: "evidence-mismatch" },
          },
        ],
      }),
    ]);
    assert.doesNotMatch(captured.error[0], /private-intro|calendly\.com/u);
  } finally {
    await rm(owner, { recursive: true, force: true });
  }
});

test("the runner emits exact create success and sanitized failure JSON", async () => {
  const owner = await mkdtemp(join(tmpdir(), "egeria-cli-create-"));
  const destination = join(owner, "acme-portfolio");
  const runCli = cli.createCliRunner({
    createVerifier: createFakeVerifier,
  });

  try {
    const success = captureOutput();
    assert.equal(
      await runCli(
        [
          "create",
          "--profile",
          "portfolio",
          "--name",
          "acme-portfolio",
          "--display-name",
          "Acme Portfolio",
          "--directory",
          destination,
        ],
        success.output,
      ),
      0,
    );
    assert.deepEqual(success.error, []);
    assert.deepEqual(success.standard, [
      JSON.stringify({
        ok: true,
        command: "create",
        destination: await realpath(destination),
        profile: "portfolio",
        capabilities: [
          "standards",
          "content-files",
          "section-composition",
          "deployment-cloudflare",
          "observability",
        ],
      }),
    ]);

    const failure = captureOutput();
    assert.equal(
      await runCli(
        [
          "create",
          "--profile",
          "portfolio",
          "--name",
          "acme-portfolio",
          "--display-name",
          "Acme Portfolio",
          "--directory",
          destination,
        ],
        failure.output,
      ),
      1,
    );
    assert.deepEqual(failure.standard, []);
    assert.deepEqual(failure.error, [
      JSON.stringify({
        ok: false,
        command: "create",
        issues: [
          {
            code: "DESTINATION_EXISTS",
            path: [],
            context: { reason: "already-exists" },
          },
        ],
      }),
    ]);
  } finally {
    await rm(owner, { recursive: true, force: true });
  }
});

test("invalid CLI input emits one content-free JSON error and exit two", async () => {
  const captured = captureOutput();
  const exitCode = await cli.runCli(
    ["infer", "--unknown", "private-value"],
    captured.output,
  );

  assert.equal(exitCode, 2);
  assert.deepEqual(captured.standard, []);
  assert.deepEqual(captured.error, [
    JSON.stringify({ ok: false, code: "CLI_ARGUMENT_INVALID" }),
  ]);
  assert.doesNotMatch(captured.error[0], /private-value|Unknown option|parseArgs/);
});

test("repository open failures emit one content-free JSON error", async () => {
  const captured = captureOutput();
  const runCli = cli.createCliRunner({
    createVerifier: createFakeVerifier,
    createReader() {
      throw new Error("private directory detail");
    },
  });

  assert.equal(
    await runCli(
      ["infer", "--directory", "/private/tmp/private-project"],
      captured.output,
    ),
    1,
  );
  assert.deepEqual(captured.standard, []);
  assert.deepEqual(captured.error, [
    JSON.stringify({ ok: false, code: "REPOSITORY_OPEN_FAILED" }),
  ]);
  assert.doesNotMatch(captured.error[0], /private-project|private directory detail/);
});

test("real invalid repository roots emit the sanitized open failure", async () => {
  const owner = await mkdtemp(join(tmpdir(), "egeria-cli-roots-"));
  const missingRoot = join(owner, "missing");
  const fileRoot = join(owner, "file");
  const directoryRoot = join(owner, "directory");
  const symlinkRoot = join(owner, "symlink");

  try {
    await writeFile(fileRoot, "not a repository\n");
    await mkdir(directoryRoot);
    await symlink(directoryRoot, symlinkRoot, "dir");

    for (const root of [missingRoot, fileRoot, symlinkRoot]) {
      const captured = captureOutput();
      assert.equal(
        await cli.runCli(["infer", "--directory", root], captured.output),
        1,
      );
      assert.deepEqual(captured.standard, []);
      assert.deepEqual(captured.error, [
        JSON.stringify({ ok: false, code: "REPOSITORY_OPEN_FAILED" }),
      ]);
      assert.equal(captured.error[0].includes(root), false);
    }
  } finally {
    await rm(owner, { recursive: true, force: true });
  }
});

test("infer, doctor, and diff preserve every fixture path and byte", async () => {
  await withGeneratedFixture(async (directory) => {
    const catalog = assertSuccess(core.createVerifiedCapabilityCatalog());
    const operations = [
      {
        kind: "infer",
        expected: await core.inferRepository({
          reader: core.createFileSystemRepositoryReader(directory),
          catalog,
        }),
        exitCode: 0,
      },
      {
        kind: "doctor",
        expected: await core.doctorRepository({
          reader: core.createFileSystemRepositoryReader(directory),
          catalog,
          profiles: core.profileRecipes,
        }),
        exitCode: 0,
      },
      {
        kind: "diff",
        expected: await core.diffProject({
          reader: core.createFileSystemRepositoryReader(directory),
          catalog,
          profiles: core.profileRecipes,
        }),
        exitCode: 0,
      },
    ];
    const original = await listTree(directory);

    for (const operation of operations) {
      const captured = captureOutput();
      assert.equal(
        await cli.runCli(
          [operation.kind, "--directory", directory],
          captured.output,
        ),
        operation.exitCode,
      );
      assert.deepEqual(captured.error, []);
      assert.deepEqual(captured.standard, [
        JSON.stringify({
          ok: true,
          command: operation.kind,
          result: operation.expected,
        }),
      ]);
      assert.deepEqual(await listTree(directory), original);
    }
  });
});

test("doctor and diff return exit one for diagnosed repository drift", async () => {
  await withGeneratedFixture(async (directory) => {
    await writeFile(join(directory, "pnpm-lock.yaml"), "drift\n");

    for (const kind of ["doctor", "diff"]) {
      const captured = captureOutput();
      assert.equal(
        await cli.runCli([kind, "--directory", directory], captured.output),
        1,
      );
      assert.deepEqual(captured.error, []);
      assert.equal(JSON.parse(captured.standard[0]).command, kind);
    }
  });
});

test("the built entry emits one JSON line with exact process exits", async () => {
  await withGeneratedFixture(async (directory) => {
    const entry = resolve(packageRoot, "dist/index.js");
    const healthy = await executeNode([
      entry,
      "doctor",
      "--directory",
      directory,
    ]);

    assert.equal(healthy.exitCode, 0);
    assert.equal(healthy.stderr, "");
    assert.deepEqual(healthy.stdout.trimEnd().split("\n"), [
      JSON.stringify({
        ok: true,
        command: "doctor",
        result: { healthy: true, diagnostics: [] },
      }),
    ]);

    const invalid = await executeNode([entry, "doctor", "--unknown", "value"]);
    assert.equal(invalid.exitCode, 2);
    assert.equal(invalid.stdout, "");
    assert.equal(
      invalid.stderr,
      `${JSON.stringify({ ok: false, code: "CLI_ARGUMENT_INVALID" })}\n`,
    );
  });
});
