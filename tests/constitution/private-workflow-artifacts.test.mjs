import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, "../..");
const privateRoots = Object.freeze([
  "docs/implementation-evidence/",
  "docs/review-packets/",
  "docs/superpowers/",
]);
const trackedAcceptedReceipt =
  "docs/implementation-evidence/2026-08-16-observability-error-diagnostics-certification-receipt.md";
const syntheticMacHome = (...segments) =>
  ["", "Users", ...segments, ""].join("/");
const syntheticUnixHome = (root, ...segments) =>
  ["", root, ...segments].join("/");
const syntheticWindowsHome = (...segments) =>
  ["C:", "Users", ...segments].join("\\");
const allowedSyntheticHomePaths = new Map([
  [
    "packages/observability/tests/diagnostics.test.mjs",
    new Set([
      syntheticMacHome("alice"),
      syntheticMacHome("Alice Smith"),
      syntheticMacHome("Alice Smith (Admin)"),
    ]),
  ],
  [
    "packages/observability/tests/server.test.mjs",
    new Set([
      syntheticMacHome("Alice Smith"),
      syntheticMacHome("Alice Smith (Admin)"),
    ]),
  ],
]);
const userHomePatterns = Object.freeze([
  /\/Users\/[^/\0\r\n]+(?:\/|$)/gu,
  /\/home\/[^/\0\r\n]+(?:\/|$)/gu,
  /[A-Za-z]:\\Users\\[^\\\0\r\n]+(?:\\|$)/gu,
]);
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

async function listTrackedPaths() {
  const { stdout } = await execFileAsync("git", ["ls-files", "-z"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  return stdout.split("\0").filter(Boolean);
}

function detectPersonalHomePaths(source) {
  return userHomePatterns.flatMap((pattern) => {
    pattern.lastIndex = 0;
    return [...source.matchAll(pattern)].map((match) => match[0]);
  });
}

test("personal home-directory detection covers supported platform forms", () => {
  for (const path of [
    syntheticUnixHome("Users", "ron", "private"),
    syntheticUnixHome("Users", "alice"),
    syntheticUnixHome("home", "n0ra", "private"),
    syntheticUnixHome("home", "alice"),
    syntheticWindowsHome("r0n", "private"),
    syntheticWindowsHome("alice"),
  ]) {
    const matches = detectPersonalHomePaths(path);
    assert.equal(matches.length, 1, path);
    assert.equal(path.startsWith(matches[0]), true, path);
  }

  assert.deepEqual(detectPersonalHomePaths("docs/private-workflow.md"), []);
});

test("private workflow artifact roots keep only the accepted content-safe receipt tracked", async () => {
  const trackedPaths = await listTrackedPaths();

  for (const root of privateRoots) {
    await assert.doesNotReject(() =>
      execFileAsync(
        "git",
        ["check-ignore", "--quiet", "--no-index", `${root}privacy-probe.md`],
        { cwd: repositoryRoot },
      ),
    );
    const trackedWithinRoot = trackedPaths.filter(
      (path) => path === root.slice(0, -1) || path.startsWith(root),
    );
    assert.deepEqual(
      trackedWithinRoot,
      root === "docs/implementation-evidence/" ? [trackedAcceptedReceipt] : [],
      root,
    );
  }

  await assert.rejects(
    () =>
      execFileAsync(
        "git",
        ["check-ignore", "--quiet", "--no-index", trackedAcceptedReceipt],
        { cwd: repositoryRoot },
      ),
    (error) => Number(error.code) === 1,
  );
});

test("tracked text excludes personal home-directory paths", async () => {
  const unexpectedMatches = [];

  for (const path of await listTrackedPaths()) {
    let bytes;
    try {
      bytes = await readFile(resolve(repositoryRoot, path));
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    if (bytes.includes(0)) {
      continue;
    }

    let source;
    try {
      source = utf8Decoder.decode(bytes);
    } catch {
      continue;
    }

    for (const match of detectPersonalHomePaths(source)) {
      if (allowedSyntheticHomePaths.get(path)?.has(match) === true) {
        continue;
      }
      unexpectedMatches.push(`${path}:personal-home-path`);
    }
  }

  assert.deepEqual([...new Set(unexpectedMatches)].sort(), []);
});
