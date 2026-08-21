import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  cp,
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
  "unit-tests",
  "component-tests",
  "next-build",
  "opennext-build",
];
const planSettings = {
  destination: "https://calendly.com/acme/private-planning-destination",
  mode: "popup",
};

function cleanGitInspection(overrides = {}) {
  return {
    ok: true,
    identity: {
      root: "/private/generated-worktree",
      revision: "abcdef0123456789abcdef0123456789abcdef01",
      attachedRef: "refs/heads/transactional-change",
      gitDirectory:
        "/private/generated-common/.git/worktrees/transactional-change",
      commonDirectory: "/private/generated-common/.git",
      ...overrides,
    },
  };
}

function expectedPlanActions() {
  return [
    {
      kind: "replace-project-configuration",
      path: ".egeria/project.yaml",
      ownership: "managed",
      owner: "builder-kernel",
    },
    {
      kind: "replace-file",
      path: "apps/web/app/page.tsx",
      ownership: "application-owned",
      owner: "builder-kernel",
    },
    {
      kind: "create-file",
      path: "apps/web/content/en-CA/booking-calendly.yaml",
      ownership: "application-owned",
      owner: "booking-calendly",
    },
    {
      kind: "create-file",
      path: "apps/web/src/integrations/booking-calendly/booking-content.ts",
      ownership: "application-owned",
      owner: "booking-calendly",
    },
    {
      kind: "create-file",
      path: "apps/web/src/integrations/booking-calendly/booking-settings.ts",
      ownership: "managed",
      owner: "booking-calendly",
    },
    {
      kind: "create-file",
      path: "apps/web/src/integrations/booking-calendly/calendly-booking.tsx",
      ownership: "application-owned",
      owner: "booking-calendly",
    },
    {
      kind: "create-file",
      path: "apps/web/tests/e2e/calendly-booking.spec.ts",
      ownership: "application-owned",
      owner: "booking-calendly",
    },
  ];
}

function expectedAdditionPlan(profile, revision, mode = "popup") {
  const currentCapabilities = [
    "content-files",
    "deployment-cloudflare",
    "observability",
    "section-composition",
    ...(profile === "site" ? ["site-routing"] : []),
    "standards",
  ].sort();

  return {
    operation: "add-capability",
    status: "approval-required",
    baseRevision: revision,
    profile,
    capability: {
      identifier: "booking-calendly",
      version: "0.1.0",
    },
    settings: { mode, destination: "redacted" },
    currentCapabilities,
    desiredCapabilities: ["booking-calendly", ...currentCapabilities].sort(),
    actions: expectedPlanActions(),
    requiredApprovals: ["transform", "verified-final-diff"],
    persistenceOrder: [
      "transform",
      "verify",
      "re-infer",
      "append-migration-record",
      "persist-state",
      "verify-state-and-inference",
    ],
  };
}

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

function planAddArguments(directory, selectedSettings = planSettings) {
  return [
    "plan-add",
    "--directory",
    directory,
    "--capability",
    "booking-calendly",
    "--calendly-url",
    selectedSettings.destination,
    "--calendly-mode",
    selectedSettings.mode,
  ];
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

test("the plan-add parser accepts exact options in any order", () => {
  const expected = {
    kind: "plan-add",
    directory: "/private/tmp/acme-portfolio",
    capability: "booking-calendly",
    settings: {
      destination: "https://calendly.com/acme/intro",
      mode: "popup",
    },
  };
  const ordered = [
    "plan-add",
    "--directory",
    "/private/tmp/acme-portfolio",
    "--capability",
    "booking-calendly",
    "--calendly-url",
    "https://calendly.com/acme/intro",
    "--calendly-mode",
    "popup",
  ];
  const reordered = [
    "plan-add",
    "--calendly-mode",
    "popup",
    "--calendly-url",
    "https://calendly.com/acme/intro",
    "--capability",
    "booking-calendly",
    "--directory",
    "/private/tmp/acme-portfolio",
  ];

  assert.deepEqual(assertSuccess(cliArguments.parseCliArguments(ordered)), expected);
  assert.deepEqual(
    assertSuccess(cliArguments.parseCliArguments(reordered)),
    expected,
  );
});

test("the plan-add parser rejects incomplete, duplicate, unknown, and unsafe values", () => {
  const valid = [
    "plan-add",
    "--directory",
    "/private/tmp/acme-portfolio",
    "--capability",
    "booking-calendly",
    "--calendly-url",
    "https://calendly.com/acme/intro",
    "--calendly-mode",
    "popup",
  ];
  const invalidCases = [
    valid.slice(0, -2),
    [...valid, "--directory", "/private/tmp/other"],
    [...valid, "--unknown", "private-value"],
    valid.map((value) =>
      value === "booking-calendly" ? "invented-capability" : value,
    ),
    valid.map((value) => (value === "popup" ? "modal" : value)),
    valid.map((value) =>
      value === "https://calendly.com/acme/intro"
        ? "https://calendar.example/private"
        : value,
    ),
    valid.map((value) =>
      value === "/private/tmp/acme-portfolio" ? "bad\0directory" : value,
    ),
  ];

  for (const arguments_ of invalidCases) {
    const result = cliArguments.parseCliArguments(arguments_);
    assert.equal(result.ok, false, JSON.stringify(arguments_));
    assert.deepEqual(result.issues, [
      {
        code: "CLI_ARGUMENT_INVALID",
        path: [],
        context: { reason: "invalid-arguments" },
      },
    ]);
    assert.doesNotMatch(
      JSON.stringify(result),
      /invented-capability|calendar\.example|private-value|bad\\u0000directory/u,
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
      0,
    );
    assert.deepEqual(captured.error, []);
    assert.deepEqual(captured.standard, [
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
          "booking-calendly",
        ],
      }),
    ]);
    assert.doesNotMatch(captured.standard[0], /private-intro|calendly\.com/u);
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

test("plan-add emits the complete approval-required envelope after two matching inspections", async () => {
  const inspection = cleanGitInspection();
  const inspections = [inspection, structuredClone(inspection)];
  const runCli = cli.createCliRunner({
    createVerifier: createFakeVerifier,
    createReader: () =>
      core.createFileSystemRepositoryReader(
        resolve(repositoryRoot, "fixtures/generated/portfolio"),
      ),
    inspectGitWorktree: () => Promise.resolve(inspections.shift()),
    inspectGitCreateTargets: () => Promise.resolve({ ok: true }),
  });
  const captured = captureOutput();

  assert.equal(
    await runCli(planAddArguments("/private/ignored-input"), captured.output),
    0,
  );
  assert.deepEqual(inspections, []);
  assert.deepEqual(captured.error, []);
  assert.deepEqual(captured.standard, [
    JSON.stringify({
      ok: true,
      command: "plan-add",
      result: expectedAdditionPlan("portfolio", inspection.identity.revision),
    }),
  ]);
  assert.doesNotMatch(
    captured.standard[0],
    /private-planning-destination|calendly\.com|refs\/heads|generated-common/u,
  );
});

test("plan-add contains final inspection changes and never leaks a completed plan", async () => {
  const initial = cleanGitInspection();
  const finalCases = [
    {
      name: "revision changed",
      final: cleanGitInspection({
        revision: "1111111111111111111111111111111111111111",
      }),
      code: "GIT_WORKTREE_CHANGED",
    },
    {
      name: "attached ref changed",
      final: cleanGitInspection({ attachedRef: "refs/heads/other-change" }),
      code: "GIT_WORKTREE_CHANGED",
    },
    {
      name: "Git directory changed",
      final: cleanGitInspection({
        gitDirectory: "/private/generated-common/.git/worktrees/replaced",
      }),
      code: "GIT_WORKTREE_CHANGED",
    },
    {
      name: "common directory changed",
      final: cleanGitInspection({
        commonDirectory: "/private/replaced-common/.git",
      }),
      code: "GIT_WORKTREE_CHANGED",
    },
    {
      name: "clean worktree became dirty",
      final: { ok: false, code: "GIT_WORKTREE_DIRTY" },
      code: "GIT_WORKTREE_DIRTY",
    },
    {
      name: "operation began",
      final: { ok: false, code: "GIT_OPERATION_IN_PROGRESS" },
      code: "GIT_OPERATION_IN_PROGRESS",
    },
    {
      name: "conflict appeared",
      final: { ok: false, code: "GIT_WORKTREE_CONFLICTED" },
      code: "GIT_WORKTREE_CONFLICTED",
    },
    {
      name: "inspection timed out",
      final: { ok: false, code: "GIT_WORKTREE_IDENTITY_INVALID" },
      code: "GIT_WORKTREE_IDENTITY_INVALID",
    },
  ];

  for (const fixture of finalCases) {
    const inspections = [structuredClone(initial), fixture.final];
    const runCli = cli.createCliRunner({
      createVerifier: createFakeVerifier,
      createReader: () =>
        core.createFileSystemRepositoryReader(
          resolve(repositoryRoot, "fixtures/generated/portfolio"),
        ),
      inspectGitWorktree: () => Promise.resolve(inspections.shift()),
      inspectGitCreateTargets: () => Promise.resolve({ ok: true }),
    });
    const captured = captureOutput();

    assert.equal(
      await runCli(planAddArguments("/private/ignored-input"), captured.output),
      1,
      fixture.name,
    );
    assert.deepEqual(captured.standard, [], fixture.name);
    assert.deepEqual(
      captured.error,
      [
        JSON.stringify({
          ok: false,
          command: "plan-add",
          code: fixture.code,
        }),
      ],
      fixture.name,
    );
    assert.doesNotMatch(
      captured.error[0],
      /approval-required|private-planning-destination|refs\/heads|generated-common/u,
      fixture.name,
    );
  }

  const inspections = [structuredClone(initial), "throw"];
  const throwingRunner = cli.createCliRunner({
    createVerifier: createFakeVerifier,
    createReader: () =>
      core.createFileSystemRepositoryReader(
        resolve(repositoryRoot, "fixtures/generated/portfolio"),
      ),
    inspectGitCreateTargets: () => Promise.resolve({ ok: true }),
    inspectGitWorktree() {
      const next = inspections.shift();
      if (next === "throw") {
        throw new Error("private Git failure");
      }
      return Promise.resolve(next);
    },
  });
  const captured = captureOutput();
  assert.equal(
    await throwingRunner(
      planAddArguments("/private/ignored-input"),
      captured.output,
    ),
    1,
  );
  assert.deepEqual(captured.standard, []);
  assert.deepEqual(captured.error, [
    JSON.stringify({
      ok: false,
      command: "plan-add",
      code: "GIT_WORKTREE_IDENTITY_INVALID",
    }),
  ]);
  assert.doesNotMatch(captured.error[0], /private Git failure|approval-required/u);

  const readerFailureRunner = cli.createCliRunner({
    createVerifier: createFakeVerifier,
    createReader: () => ({
      readText() {
        throw new Error("private repository reader failure");
      },
    }),
    inspectGitCreateTargets: () => Promise.resolve({ ok: true }),
    inspectGitWorktree: () => Promise.resolve(structuredClone(initial)),
  });
  const readerFailure = captureOutput();
  assert.equal(
    await readerFailureRunner(
      planAddArguments("/private/ignored-input"),
      readerFailure.output,
    ),
    1,
  );
  assert.deepEqual(readerFailure.standard, []);
  assert.deepEqual(readerFailure.error, [
    JSON.stringify({
      ok: false,
      command: "plan-add",
      code: "REPOSITORY_OPEN_FAILED",
    }),
  ]);
  assert.doesNotMatch(
    readerFailure.error[0],
    /private repository reader failure|approval-required/u,
  );

  const ignoredTargetRunner = cli.createCliRunner({
    createVerifier: createFakeVerifier,
    createReader: () =>
      core.createFileSystemRepositoryReader(
        resolve(repositoryRoot, "fixtures/generated/portfolio"),
      ),
    inspectGitCreateTargets: () =>
      Promise.resolve({ ok: false, code: "CAPABILITY_ACTION_CONFLICT" }),
    inspectGitWorktree: () => Promise.resolve(structuredClone(initial)),
  });
  const ignoredTarget = captureOutput();
  assert.equal(
    await ignoredTargetRunner(
      planAddArguments("/private/ignored-input"),
      ignoredTarget.output,
    ),
    1,
  );
  assert.deepEqual(ignoredTarget.standard, []);
  assert.deepEqual(ignoredTarget.error, [
    JSON.stringify({
      ok: false,
      command: "plan-add",
      code: "CAPABILITY_ACTION_CONFLICT",
    }),
  ]);
});

async function executeGit(root, arguments_, readOnly = false) {
  const globalOptions = readOnly
    ? [
        "--no-optional-locks",
        "--no-replace-objects",
        "--no-lazy-fetch",
        "-c",
        "core.fsmonitor=false",
        "-c",
        "core.untrackedCache=false",
      ]
    : [];

  return new Promise((resolveResult, rejectResult) => {
    execFile(
      "git",
      [...globalOptions, ...arguments_],
      {
        cwd: root,
        encoding: "buffer",
        env: { PATH: process.env.PATH },
        maxBuffer: 1024 * 1024,
        timeout: 10_000,
      },
      (error, stdout) => {
        if (error === null) {
          resolveResult(new Uint8Array(stdout));
        } else {
          rejectResult(error);
        }
      },
    );
  });
}

async function withGitFixture(name, run) {
  const createdOwner = await mkdtemp(join(tmpdir(), "egeria-plan-add-cli-"));
  const owner = await realpath(createdOwner);
  const ownerStats = await lstat(owner, { bigint: true });
  const primary = join(owner, "primary");
  const linked = join(owner, "linked");

  try {
    await cp(resolve(repositoryRoot, `fixtures/generated/${name}`), primary, {
      recursive: true,
    });
    await executeGit(owner, ["init", "--initial-branch=main", primary]);
    await executeGit(primary, ["config", "user.name", "CLI Plan Test"]);
    await executeGit(primary, [
      "config",
      "user.email",
      "cli-plan@example.test",
    ]);
    await executeGit(primary, ["add", "-A"]);
    await executeGit(primary, ["commit", "-m", "fixture"]);
    await executeGit(primary, [
      "worktree",
      "add",
      "-b",
      "plan-add-test",
      linked,
    ]);
    await run({ linked, primary });
  } finally {
    const currentStats = await lstat(owner, { bigint: true });
    assert.equal(currentStats.isDirectory(), true);
    assert.equal(currentStats.isSymbolicLink(), false);
    assert.equal(currentStats.dev, ownerStats.dev);
    assert.equal(currentStats.ino, ownerStats.ino);
    await rm(owner, { recursive: true, force: false });
  }
}

async function operationSnapshot(root) {
  const states = [];

  for (const marker of [
    "MERGE_HEAD",
    "rebase-merge",
    "rebase-apply",
    "REVERT_HEAD",
    "CHERRY_PICK_HEAD",
    "sequencer",
  ]) {
    const pathOutput = await executeGit(
      root,
      ["rev-parse", "--git-path", marker],
      true,
    );
    const path = Buffer.from(pathOutput).toString("utf8").trim();

    try {
      const stats = await lstat(path);
      states.push({
        marker,
        kind: stats.isSymbolicLink()
          ? "symlink"
          : stats.isDirectory()
            ? "directory"
            : "file",
        ...(stats.isFile()
          ? { content: (await readFile(path)).toString("base64") }
          : {}),
      });
    } catch (error) {
      if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") {
        throw error;
      }
    }
  }

  return states;
}

async function gitRepositorySnapshot(root) {
  const [head, refs, status, indexVisibility, tree, operations] = await Promise.all([
    executeGit(root, ["rev-parse", "HEAD"], true),
    executeGit(root, ["show-ref"], true),
    executeGit(
      root,
      ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
      true,
    ),
    executeGit(root, ["ls-files", "-v", "-z"], true),
    listTree(root),
    operationSnapshot(root),
  ]);

  return {
    head,
    refs,
    status,
    indexVisibility,
    tree: tree.filter(
      ({ path }) => path !== ".git" && !path.startsWith(".git/"),
    ),
    operations,
  };
}

async function commitAll(root, message) {
  await executeGit(root, ["add", "-A"]);
  await executeGit(root, ["commit", "-m", message]);
}

async function executeBuiltPlanAdd(directory) {
  return executeNode([
    resolve(packageRoot, "dist/index.js"),
    ...planAddArguments(directory),
  ]);
}

test("the compiled plan-add command emits exact portfolio and site plans without writes", async () => {
  for (const profile of ["portfolio", "site"]) {
    await withGitFixture(profile, async ({ linked }) => {
      const before = await gitRepositorySnapshot(linked);
      const execution = await executeBuiltPlanAdd(linked);
      const after = await gitRepositorySnapshot(linked);
      const revision = Buffer.from(before.head).toString("utf8").trim();

      assert.equal(execution.exitCode, 0);
      assert.equal(execution.stderr, "");
      assert.deepEqual(execution.stdout.trimEnd().split("\n"), [
        JSON.stringify({
          ok: true,
          command: "plan-add",
          result: expectedAdditionPlan(profile, revision),
        }),
      ]);
      assert.deepEqual(after, before);
      assert.doesNotMatch(
        execution.stdout,
        /private-planning-destination|calendly\.com|refs\/heads|\.git\/worktrees/u,
      );
    });
  }
});

test("the compiled plan-add command refuses unsafe repository states without writes", async () => {
  const cases = [
    {
      name: "primary worktree",
      fixture: "portfolio",
      select: ({ primary }) => primary,
      prepare: async () => {},
      code: "GIT_WORKTREE_NOT_ISOLATED",
    },
    {
      name: "untracked dirt",
      fixture: "portfolio",
      select: ({ linked }) => linked,
      prepare: (root) => writeFile(join(root, "private-untracked.txt"), "x\n"),
      code: "GIT_WORKTREE_DIRTY",
    },
    {
      name: "detached head",
      fixture: "portfolio",
      select: ({ linked }) => linked,
      prepare: (root) => executeGit(root, ["checkout", "--detach"]),
      code: "GIT_BRANCH_REQUIRED",
    },
    {
      name: "operation marker",
      fixture: "portfolio",
      select: ({ linked }) => linked,
      prepare: async (root) => {
        const output = await executeGit(root, [
          "rev-parse",
          "--git-path",
          "MERGE_HEAD",
        ]);
        await writeFile(Buffer.from(output).toString("utf8").trim(), "operation\n");
      },
      code: "GIT_OPERATION_IN_PROGRESS",
    },
    {
      name: "committed application drift",
      fixture: "portfolio",
      select: ({ linked }) => linked,
      prepare: async (root) => {
        await writeFile(join(root, "apps/web/app/page.tsx"), "private drift\n");
        await commitAll(root, "drift home route");
      },
      code: "PROJECT_DRIFT_DETECTED",
    },
    {
      name: "missing unrelated application-owned surface",
      fixture: "portfolio",
      select: ({ linked }) => linked,
      prepare: async (root) => {
        await rm(join(root, "apps/web/app/layout.tsx"));
        await commitAll(root, "delete application layout");
      },
      code: "PROJECT_DRIFT_DETECTED",
    },
    {
      name: "committed ejection",
      fixture: "portfolio",
      select: ({ linked }) => linked,
      prepare: async (root) => {
        const statePath = join(root, ".egeria/state.json");
        const parsed = core.parseStateJson(await readFile(statePath, "utf8"));
        assert.equal(parsed.ok, true);
        await writeFile(
          statePath,
          core.serializeStateJson({
            ...parsed.value,
            ejections: ["apps/web/app/page.tsx"],
          }),
        );
        await commitAll(root, "record unsupported ejection");
      },
      code: "PROJECT_EJECTION_UNSUPPORTED",
    },
    {
      name: "ignored create collision",
      fixture: "portfolio",
      select: ({ linked }) => linked,
      prepare: async (root) => {
        const ignorePath = join(root, ".gitignore");
        await writeFile(
          ignorePath,
          `${await readFile(ignorePath, "utf8")}apps/web/content/en-CA/booking-calendly.yaml\n`,
        );
        await commitAll(root, "ignore collision target");
        await writeFile(
          join(root, "apps/web/content/en-CA/booking-calendly.yaml"),
          "ignored collision\n",
        );
      },
      code: "CAPABILITY_ACTION_CONFLICT",
    },
    {
      name: "absent ignored create target",
      fixture: "portfolio",
      select: ({ linked }) => linked,
      prepare: async (root) => {
        const ignorePath = join(root, ".gitignore");
        await writeFile(
          ignorePath,
          `${await readFile(ignorePath, "utf8")}apps/web/content/en-CA/booking-calendly.yaml\n`,
        );
        await commitAll(root, "ignore absent create target");
      },
      code: "CAPABILITY_ACTION_CONFLICT",
    },
    ...[
      ["assume-unchanged", "--assume-unchanged"],
      ["skip-worktree", "--skip-worktree"],
    ].map(([name, flag]) => ({
      name: `hidden tracked change with ${name}`,
      fixture: "portfolio",
      select: ({ linked }) => linked,
      prepare: async (root) => {
        await executeGit(root, ["update-index", flag, ".gitignore"]);
        await writeFile(join(root, ".gitignore"), `hidden ${name} change\n`);
      },
      code: "GIT_WORKTREE_DIRTY",
    })),
    {
      name: "already installed capability",
      fixture: "portfolio-calendly",
      select: ({ linked }) => linked,
      prepare: async () => {},
      code: "CAPABILITY_ALREADY_INSTALLED",
    },
  ];

  for (const fixture of cases) {
    await withGitFixture(fixture.fixture, async (roots) => {
      const root = fixture.select(roots);
      await fixture.prepare(root);
      const before = await gitRepositorySnapshot(root);
      const execution = await executeBuiltPlanAdd(root);
      const after = await gitRepositorySnapshot(root);

      assert.equal(execution.exitCode, 1, fixture.name);
      assert.equal(execution.stdout, "", fixture.name);
      assert.deepEqual(
        execution.stderr.trimEnd().split("\n"),
        [
          JSON.stringify({
            ok: false,
            command: "plan-add",
            code: fixture.code,
          }),
        ],
        fixture.name,
      );
      assert.deepEqual(after, before, fixture.name);
      assert.doesNotMatch(
        execution.stderr,
        /private-planning-destination|calendly\.com|refs\/heads|private drift|private-untracked/u,
        fixture.name,
      );
    });
  }
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
