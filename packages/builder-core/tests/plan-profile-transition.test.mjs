import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "../..");
const core = await import(pathToFileURL(resolve(packageRoot, "dist/index.js")));
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const baseGit = Object.freeze({
  ok: true,
  identity: Object.freeze({
    root: "/private/profile-transition-worktree",
    revision: "abcdef0123456789abcdef0123456789abcdef01",
    attachedRef: "refs/heads/profile-transition-planning",
    gitDirectory:
      "/private/profile-transition-common/.git/worktrees/profile-transition-planning",
    commonDirectory: "/private/profile-transition-common/.git",
  }),
});
const controlPaths = [
  ".egeria/migrations.jsonl",
  ".egeria/project.yaml",
  ".egeria/state.json",
];
function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sameBytes(left, right) {
  return (
    left.length === right.length &&
    left.every((byte, index) => byte === right[index])
  );
}

async function loadEntries(root) {
  const entries = new Map();

  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolutePath = join(directory, entry.name);

      if (entry.isDirectory()) {
        await visit(absolutePath);
      } else if (entry.isFile()) {
        entries.set(
          relative(root, absolutePath).split(sep).join("/"),
          new Uint8Array(await readFile(absolutePath)),
        );
      }
    }
  }

  await visit(root);
  return entries;
}

async function portfolioEntries() {
  return loadEntries(resolve(repositoryRoot, "fixtures/generated/portfolio-0.11.7"));
}

function cloneEntries(entries) {
  return new Map(
    [...entries].map(([path, content]) => [path, new Uint8Array(content)]),
  );
}

function snapshotEntries(entries) {
  return JSON.stringify(
    [...entries]
      .sort(([left], [right]) => compareText(left, right))
      .map(([path, content]) => [path, Buffer.from(content).toString("base64")]),
  );
}

function text(entries, path) {
  const content = entries.get(path);
  assert.ok(content, `missing fixture path: ${path}`);
  return decoder.decode(content);
}

function setText(entries, path, content) {
  entries.set(path, encoder.encode(content));
}

function createSnapshotReader(entries, overrides = new Map()) {
  const files = cloneEntries(entries);
  const fixedOverrides = new Map(overrides);

  return {
    async readText(path) {
      if (fixedOverrides.has(path)) {
        const override = fixedOverrides.get(path);

        if (override === "throw") {
          throw new Error("private repository reader detail");
        }

        return structuredClone(override);
      }

      const content = files.get(path);
      if (content === undefined) {
        return { kind: "missing" };
      }

      try {
        return { kind: "file", content: decoder.decode(content) };
      } catch {
        return { kind: "error", code: "FILE_ENCODING_INVALID" };
      }
    },
    async readBytes(path) {
      if (fixedOverrides.has(path)) {
        const override = fixedOverrides.get(path);
        if (override === "throw") {
          throw new Error("private repository reader detail");
        }
        if (override.kind === "file") {
          return { kind: "file", content: encoder.encode(override.content) };
        }
        return structuredClone(override);
      }
      const content = files.get(path);
      return content === undefined
        ? { kind: "missing" }
        : { kind: "file", content: new Uint8Array(content) };
    },
  };
}

async function planFromEntries(entries, options = {}) {
  const before = snapshotEntries(entries);
  const controlsBefore = new Map(
    controlPaths.map((path) => [path, new Uint8Array(entries.get(path))]),
  );
  const result = await core.planProfileTransition({
    reader: createSnapshotReader(entries, options.overrides),
    git: options.git ?? baseGit,
    toProfile: options.toProfile ?? "app",
    inspectCreateTargets: async () => ({ ok: true }),
    inspectWorktree: async () => options.git ?? baseGit,
  });

  assert.equal(snapshotEntries(entries), before);
  for (const [path, content] of controlsBefore) {
    assert.equal(sameBytes(entries.get(path), content), true, path);
  }

  return result;
}

function assertFailure(result, code) {
  assert.equal(result.ok, false);
  assert.deepEqual(result.issues.map(({ code: issueCode }) => issueCode), [code]);
  assert.doesNotMatch(
    JSON.stringify(result),
    /private repository reader detail|refs\/heads|profile-transition-worktree|profile-transition-common/u,
  );
}

test("only the current incoming app edges are supported", () => {
  for (const [profile, version] of [["portfolio", "0.11.7"], ["site", "0.12.7"]]) {
    assert.equal(core.resolveSupportedProfileTransition({ fromProfile: profile, fromRecipeVersion: version, toProfile: "app", toRecipeVersion: "0.2.7" }).ok, true);
    for (const target of ["0.1.0", "0.2.0", "0.2.2", "0.2.3", "0.2.4"]) {
      assert.equal(core.resolveSupportedProfileTransition({ fromProfile: profile, fromRecipeVersion: version, toProfile: "app", toRecipeVersion: target }).ok, false);
    }
  }
  assert.equal(core.resolveSupportedProfileTransition({ fromProfile: "portfolio", fromRecipeVersion: "0.10.0", toProfile: "site", toRecipeVersion: "0.10.0" }).ok, false);
});

test("site planning binds the current target without mutation or control-file actions", async () => {
  const entries = await loadEntries(resolve(repositoryRoot, "fixtures/generated/site-0.12.7"));
  const result = await planFromEntries(entries);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(result.value.target.profile, "app");
  assert.equal(result.value.target.recipeVersion, "0.2.7");
  assert.equal(result.value.actions.some(({ path }) => path.startsWith(".egeria/")), false);
  assert.deepEqual(result.value.requiredApprovals, ["transform", "verified-final-diff"]);
});

test("current planning refuses collisions, managed drift, ejections and invalid controls without mutation", async () => {
  const base = await loadEntries(resolve(repositoryRoot, "fixtures/generated/site-0.12.7"));
  for (const mutate of [
    entries => entries.set("apps/web/app/api/health/route.ts", encoder.encode("collision")),
    entries => entries.set("pnpm-lock.yaml", encoder.encode("changed lock")),
    entries => entries.set(".egeria/migrations.jsonl", encoder.encode("invalid migration")),
    entries => entries.set(".egeria/project.yaml", encoder.encode("invalid project")),
    entries => entries.set(".egeria/state.json", encoder.encode("invalid state")),
    entries => { const state = JSON.parse(text(entries, ".egeria/state.json")); state.origin.recipeVersion = "0.12.3"; setText(entries, ".egeria/state.json", JSON.stringify(state)); },
    entries => { const state = JSON.parse(text(entries, ".egeria/state.json")); state.managedSurfaces.pop(); setText(entries, ".egeria/state.json", JSON.stringify(state)); },
    entries => { const state = JSON.parse(text(entries, ".egeria/state.json")); state.ejections = [{ identifier: "custom", paths: ["apps/web/app/page.tsx"] }]; setText(entries, ".egeria/state.json", JSON.stringify(state)); },
  ]) {
    const entries = cloneEntries(base);
    mutate(entries);
    assert.equal((await planFromEntries(entries)).ok, false);
  }
});

test("current planning contains reader errors and refuses a reader without bytes", async () => {
  const entries = await loadEntries(resolve(repositoryRoot, "fixtures/generated/site-0.12.7"));
  for (const path of controlPaths) {
    const result = await planFromEntries(entries, { overrides: new Map([[path, "throw"]]) });
    assertFailure(result, "PROJECT_INSPECTION_INVALID");
  }
  const reader = createSnapshotReader(entries);
  const before = snapshotEntries(entries);
  assert.equal((await core.planProfileTransition({ reader: { readText: reader.readText }, git: baseGit, toProfile: "app" })).ok, false);
  assert.equal(snapshotEntries(entries), before);
});

test("retired transition targets refuse before repository access", async () => {
  let reads = 0;
  const reader = { async readText() { reads += 1; throw new Error("must not read"); }, async readBytes() { reads += 1; throw new Error("must not read"); } };
  const result = await core.planProfileTransition({ reader, git: baseGit, toProfile: "site" });
  assertFailure(result, "PROFILE_TRANSITION_UNSUPPORTED");
  assert.equal(reads, 0);
});

test("app transition planning reaches content and visual eligibility after exact source admission", async () => {
  const result = await planFromEntries(await portfolioEntries(), {toProfile: "app"});
  assert.equal(result.ok, false);
  assert.equal(result.issues[0].code, "PROFILE_TRANSITION_VISUAL_EVIDENCE_REQUIRED");
});


test("successor portfolio transition refuses missing exact visual admission without mutation", async () => {
  for (const recipeVersion of ["0.11.7"]) {
    const entries = await loadEntries(resolve(repositoryRoot, `fixtures/generated/portfolio-${recipeVersion}`));
    const project = core.parseProjectYaml(text(entries, ".egeria/project.yaml"));
    assert.equal(project.ok, true);
    assert.equal(project.value.recipeVersion, recipeVersion);
    const result = await planFromEntries(entries, { toProfile: "app" });
    assertFailure(result, "PROFILE_TRANSITION_VISUAL_EVIDENCE_REQUIRED");
  }
});

test("retired portfolio controls refuse transition planning without mutation", async () => {
  for (const name of ["portfolio-0.11.3", "portfolio-calendly-0.11.3", "portfolio-email-0.11.3"]) {
    const control = JSON.parse(await readFile(resolve(packageRoot, `tests/fixtures/retired-recipes/${name}.json`), "utf8"));
    const entries = new Map([
      [".egeria/migrations.jsonl", encoder.encode("")],
      [".egeria/project.yaml", encoder.encode(control.projectYaml)],
      [".egeria/state.json", encoder.encode(JSON.stringify(control.variants.committed.state))],
    ]);
    const before = new Map(entries);
    const result = await planFromEntries(entries, { toProfile: "app" });
    assertFailure(result, "PROJECT_STATE_INCOMPATIBLE");
    assert.deepEqual(entries, before);
  }
});
