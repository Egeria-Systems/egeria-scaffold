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

test("path classification scans user-facing Markdown and preserves internal provenance exemptions", () => {
  const documentedPhasePath = [
    "docs/roadmaps/",
    compactLabel("p", "1"),
    "-builder.md",
  ].join("");

  const cases = [
    ["README.md", "scan", "require-semantic-name"],
    ["CONTRIBUTING.md", "scan", "require-semantic-name"],
    ["packages/builder-core/README.md", "scan", "require-semantic-name"],
    ["docs/guides/getting-started.md", "scan", "require-semantic-name"],
    ["docs/guides/REFERENCE.MD", "scan", "require-semantic-name"],
    ["AGENTS.md", "skip", "require-semantic-name"],
    ["docs/adr/README.md", "skip", "require-semantic-name"],
    [
      "docs/architecture/overview.md",
      "skip",
      "require-semantic-name",
    ],
    [
      "docs/governance/review-and-contribution.md",
      "skip",
      "require-semantic-name",
    ],
    ["docs/roadmaps/program-roadmap.md", "skip", "allow-sequencing-labels"],
    [
      "docs/superpowers/plans/builder-kernel.md",
      "skip",
      "allow-sequencing-labels",
    ],
    [
      "docs/superpowers/specs/naming-design.md",
      "skip",
      "allow-sequencing-labels",
    ],
    [
      "docs/implementation-evidence/naming.md",
      "skip",
      "allow-sequencing-labels",
    ],
    [
      "docs/review-packets/naming.md",
      "skip",
      "allow-sequencing-labels",
    ],
    [
      "docs/compatibility/runtime.md",
      "skip",
      "allow-sequencing-labels",
    ],
    [documentedPhasePath, "skip", "allow-sequencing-labels"],
  ];

  for (const [path, contentPolicy, pathPolicy] of cases) {
    assert.deepEqual(classifySemanticNamingPath(path), {
      contentPolicy,
      pathPolicy,
    });
  }

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

test("repository scanning treats exact SHA-512 integrity values as opaque data", async () => {
  const root = "/repository";
  const path = "scripts/registry-metadata.mjs";
  const integrity = [
    "sha512-AnqIa6qn1aLYuntoQ1zo9A80ioiStR2mKJg5mq/v/NrKNAFQf",
    compactLabel("P", "7"),
    "InXojel9Azst3lLDUUdyDuEDFmCIgyWDwrA==",
  ].join("");
  const prohibitedLabel = namedLabel("Task", "3");
  const source = [
    `const integrity = ${JSON.stringify(integrity)};`,
    `const label = ${JSON.stringify(prohibitedLabel)};`,
  ].join("\n");

  assert.deepEqual(
    await scanRepository({
      paths: [path],
      readFile: async () => Buffer.from(source, "utf8"),
      root,
    }),
    [
      {
        column: source.split("\n")[1].indexOf(prohibitedLabel) + 1,
        family: "named-sequence",
        kind: "content",
        line: 2,
        path,
        value: prohibitedLabel,
      },
    ],
  );
});

test("Git enumeration includes live tracked and untracked paths with NUL-safe parsing", async () => {
  const calls = [];
  const paths = await listRepositoryPaths({
    root: "/repository",
    runGit: async (call) => {
      calls.push(call);
      if (call.args.includes("--deleted")) {
        return Buffer.from("z-last.mjs\0", "utf8");
      }
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
    {
      args: ["ls-files", "-z", "--deleted"],
      command: "git",
      cwd: "/repository",
    },
  ]);
  assert.deepEqual(paths, ["a-first.mjs", "line\nbreak.mjs"]);
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
  const readmeDescription = namedLabel("Task", "5");
  const contributingDescription = compactLabel("P", "3");
  const packageReadmeDescription = namedLabel("Stage", "4");
  const guideDescription = namedLabel("Part", "2");
  const paths = [
    "README.md",
    "CONTRIBUTING.md",
    "packages/builder-core/README.md",
    "docs/guides/getting-started.md",
    "AGENTS.md",
    "docs/adr/README.md",
    "docs/architecture/overview.md",
    "docs/governance/review-and-contribution.md",
    "docs/superpowers/specs/naming-design.md",
    "docs/implementation-evidence/naming.md",
    "docs/review-packets/naming.md",
    "docs/compatibility/runtime.md",
    "tests/naming.test.mjs",
    phasePath,
    documentedPhasePath,
    "packages/builder-core/templates/common/README.md.template",
    "fixtures/generated/site/README.md",
    "pnpm-lock.yaml",
  ];
  const contents = new Map([
    ["README.md", `${readmeDescription}\n`],
    ["CONTRIBUTING.md", `${contributingDescription}\n`],
    ["packages/builder-core/README.md", `${packageReadmeDescription}\n`],
    ["docs/guides/getting-started.md", `${guideDescription}\n`],
    ["AGENTS.md", testDescription],
    ["docs/adr/README.md", testDescription],
    ["docs/architecture/overview.md", testDescription],
    ["docs/governance/review-and-contribution.md", testDescription],
    ["docs/superpowers/specs/naming-design.md", testDescription],
    ["docs/implementation-evidence/naming.md", testDescription],
    ["docs/review-packets/naming.md", testDescription],
    ["docs/compatibility/runtime.md", testDescription],
    ["tests/naming.test.mjs", `const stable = true;\nconst message = "${testDescription}";\n`],
    [phasePath, "export {};\n"],
    [documentedPhasePath, testDescription],
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
    "CONTRIBUTING.md",
    "README.md",
    "docs/guides/getting-started.md",
    "fixtures/generated/site/README.md",
    phasePath,
    "packages/builder-core/README.md",
    "packages/builder-core/templates/common/README.md.template",
    "tests/naming.test.mjs",
  ].sort());
  assert.deepEqual(findings, [
    {
      column: 1,
      family: "compact-phase",
      kind: "content",
      line: 1,
      path: "CONTRIBUTING.md",
      value: contributingDescription,
    },
    {
      column: 1,
      family: "named-sequence",
      kind: "content",
      line: 1,
      path: "README.md",
      value: readmeDescription,
    },
    {
      column: 1,
      family: "named-sequence",
      kind: "content",
      line: 1,
      path: "docs/guides/getting-started.md",
      value: guideDescription,
    },
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
      path: "packages/builder-core/README.md",
      value: packageReadmeDescription,
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
