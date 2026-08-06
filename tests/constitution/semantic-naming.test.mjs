import assert from "node:assert/strict";
import { relative, resolve } from "node:path";
import test from "node:test";

import {
  classifySemanticNamingPath,
  findSequencingLabels,
  listRepositoryPaths,
  scanRepository,
} from "../../scripts/check-semantic-naming.mjs";

const compactLabel = (...parts) => parts.join("");
const namedLabel = (prefix, ordinal, separator = " ") =>
  [prefix, separator, ordinal].join("");
const repositoryRoot = resolve(import.meta.dirname, "../..");

test("the matcher identifies compact sequencing labels at textual and identifier boundaries", () => {
  const cases = [
    {
      source: compactLabel("P", "2"),
      value: compactLabel("P", "2"),
    },
    {
      source: compactLabel("p", "0", ".", "3"),
      value: compactLabel("p", "0", ".", "3"),
    },
    {
      source: compactLabel("P", "5", "B"),
      value: compactLabel("P", "5", "B"),
    },
    {
      source: compactLabel("p", "x"),
      value: compactLabel("p", "x"),
    },
    {
      source: ["create", compactLabel("P", "1"), "Catalog"].join(""),
      value: compactLabel("P", "1"),
    },
    {
      source: [compactLabel("p", "03"), "Section"].join(""),
      value: compactLabel("p", "03"),
    },
  ];

  for (const { source, value } of cases) {
    assert.deepEqual(findSequencingLabels(source), [
      {
        family: "compact-phase",
        index: source.indexOf(value),
        value,
      },
    ]);
  }
});

test("the matcher identifies every named sequencing prefix without treating domain words as labels", () => {
  const prefixes = [
    "phase",
    "task",
    "stage",
    "step",
    "part",
    "milestone",
    "gate",
    "wave",
    "workstream",
    "sprint",
    "iteration",
    "increment",
    "epic",
    "story",
  ];

  for (const prefix of prefixes) {
    const value = namedLabel(prefix, "3");
    assert.deepEqual(findSequencingLabels(value), [
      {
        family: "named-sequence",
        index: 0,
        prefix,
        value,
      },
    ]);
  }

  const identifierCases = [
    namedLabel("Task", "3", "_"),
    namedLabel("Gate", "X", "-"),
    namedLabel("Phase", "2A", "."),
    ["current", namedLabel("Task", "4", ""), "Boundary"].join(""),
  ];

  for (const source of identifierCases) {
    assert.equal(findSequencingLabels(source).length, 1);
  }

  for (const source of [
    "p2pConnection",
    "taskQueue",
    "stepCount",
    "stageName",
    "incrementValue",
    "version 2.3.0",
    "the current phase remains documented",
  ]) {
    assert.deepEqual(findSequencingLabels(source), []);
  }
});

test("path classification preserves provenance while scanning product Markdown and authored text", () => {
  const documentedPhasePath = [
    "docs/roadmaps/",
    compactLabel("p", "1"),
    "-builder.md",
  ].join("");

  assert.deepEqual(classifySemanticNamingPath(documentedPhasePath), {
    contentPolicy: "skip",
    pathPolicy: "allow-sequencing-labels",
  });
  assert.deepEqual(
    classifySemanticNamingPath("docs/architecture/overview.md"),
    {
      contentPolicy: "skip",
      pathPolicy: "require-semantic-name",
    },
  );
  assert.deepEqual(
    classifySemanticNamingPath("packages/builder-core/README.md"),
    {
      contentPolicy: "skip",
      pathPolicy: "require-semantic-name",
    },
  );
  assert.deepEqual(
    classifySemanticNamingPath(
      "packages/builder-core/templates/common/README.md.template",
    ),
    {
      contentPolicy: "scan",
      pathPolicy: "require-semantic-name",
    },
  );
  assert.deepEqual(
    classifySemanticNamingPath("fixtures/generated/site/README.md"),
    {
      contentPolicy: "scan",
      pathPolicy: "require-semantic-name",
    },
  );
  assert.deepEqual(classifySemanticNamingPath("package.json"), {
    contentPolicy: "scan",
    pathPolicy: "require-semantic-name",
  });
  assert.deepEqual(classifySemanticNamingPath("pnpm-lock.yaml"), {
    contentPolicy: "skip",
    pathPolicy: "require-semantic-name",
  });
  assert.deepEqual(
    classifySemanticNamingPath("node_modules/example/index.mjs"),
    {
      contentPolicy: "skip",
      pathPolicy: "require-semantic-name",
    },
  );
});

test("Git enumeration includes tracked and non-ignored untracked paths with NUL-safe parsing", async () => {
  const calls = [];
  const paths = await listRepositoryPaths({
    root: "/repository",
    runGit: async (call) => {
      calls.push(call);
      return Buffer.from("z-last.mjs\0a-first.mjs\0line\nbreak.mjs\0", "utf8");
    },
  });

  assert.deepEqual(calls, [
    {
      args: [
        "ls-files",
        "-z",
        "--cached",
        "--others",
        "--exclude-standard",
      ],
      command: "git",
      cwd: "/repository",
    },
  ]);
  assert.deepEqual(paths, ["a-first.mjs", "line\nbreak.mjs", "z-last.mjs"]);
});

test("repository scanning reports deterministic path and content locations without source excerpts", async () => {
  const root = "/repository";
  const phasePath = [
    "packages/",
    compactLabel("p", "2"),
    "-helper/index.mjs",
  ].join("");
  const documentedPhasePath = [
    "docs/roadmaps/",
    compactLabel("p", "1"),
    "-builder.md",
  ].join("");
  const testDescription = namedLabel("Task", "3");
  const fixtureDescription = namedLabel("Story", "4");
  const templateDescription = namedLabel("Milestone", "2");
  const paths = [
    "tests/naming.test.mjs",
    phasePath,
    documentedPhasePath,
    "docs/architecture/overview.md",
    "packages/builder-core/templates/common/README.md.template",
    "fixtures/generated/site/README.md",
    "pnpm-lock.yaml",
  ];
  const contents = new Map([
    ["tests/naming.test.mjs", `const stable = true;\nconst message = "${testDescription}";\n`],
    [phasePath, "export {};\n"],
    [documentedPhasePath, testDescription],
    ["docs/architecture/overview.md", testDescription],
    [
      "packages/builder-core/templates/common/README.md.template",
      `${templateDescription}\n`,
    ],
    ["fixtures/generated/site/README.md", `${fixtureDescription}\n`],
    ["pnpm-lock.yaml", testDescription],
  ]);
  const readPaths = [];

  const findings = await scanRepository({
    paths,
    readFile: async (absolutePath) => {
      const repositoryPath = relative(root, absolutePath);
      readPaths.push(repositoryPath);
      return Buffer.from(contents.get(repositoryPath), "utf8");
    },
    root,
  });

  assert.deepEqual(readPaths.sort(), [
    "fixtures/generated/site/README.md",
    phasePath,
    "packages/builder-core/templates/common/README.md.template",
    "tests/naming.test.mjs",
  ].sort());
  assert.deepEqual(findings, [
    {
      column: 1,
      family: "named-sequence",
      kind: "content",
      line: 1,
      path: "fixtures/generated/site/README.md",
      value: fixtureDescription,
    },
    {
      column: 1,
      family: "named-sequence",
      kind: "content",
      line: 1,
      path: "packages/builder-core/templates/common/README.md.template",
      value: templateDescription,
    },
    {
      column: 10,
      family: "compact-phase",
      kind: "path",
      line: 1,
      path: phasePath,
      value: compactLabel("p", "2"),
    },
    {
      column: 18,
      family: "named-sequence",
      kind: "content",
      line: 2,
      path: "tests/naming.test.mjs",
      value: testDescription,
    },
  ]);
  assert.ok(
    findings.every(
      (finding) => !("content" in finding) && !("source" in finding),
    ),
  );
});

test("repository scanning rejects unsafe paths and invalid authored UTF-8 before reporting partial results", async () => {
  for (const unsafePath of [
    "/absolute.mjs",
    "../outside.mjs",
    "safe\\outside.mjs",
    "control\0name.mjs",
  ]) {
    await assert.rejects(
      scanRepository({
        paths: [unsafePath],
        readFile: async () => {
          assert.fail("unsafe paths must not be read");
        },
        root: "/repository",
      }),
      /SEMANTIC_NAMING_PATH_INVALID/,
    );
  }

  await assert.rejects(
    scanRepository({
      paths: ["tests/invalid.mjs"],
      readFile: async (absolutePath) => {
        assert.equal(absolutePath, resolve("/repository", "tests/invalid.mjs"));
        return Buffer.from([0xc3, 0x28]);
      },
      root: "/repository",
    }),
    /SEMANTIC_NAMING_TEXT_INVALID:tests\/invalid\.mjs/,
  );
});

test("repository paths and authored content use semantic names", async () => {
  assert.deepEqual(await scanRepository({ root: repositoryRoot }), []);
});
