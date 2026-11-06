import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// Exact upstream helper shared by the three supported Next plugin versions.
// It is patch input only and is never executed or imported.
const originalHelper = "\"use strict\";\nObject.defineProperty(exports, \"__esModule\", {\n    value: true\n});\nObject.defineProperty(exports, \"getRootDirs\", {\n    enumerable: true,\n    get: function() {\n        return getRootDirs;\n    }\n});\nvar _fastglob = require(\"fast-glob\");\n/**\n * Process a Next.js root directory glob.\n */ var processRootDir = function(rootDir) {\n    return (0, _fastglob.globSync)(rootDir.replace(/\\\\/g, '/'), {\n        onlyDirectories: true\n    });\n};\nvar getRootDirs = function(context) {\n    var rootDirs = [\n        context.cwd\n    ];\n    var nextSettings = context.settings.next || {};\n    var rootDir = nextSettings.rootDir;\n    if (typeof rootDir === 'string') {\n        rootDirs = processRootDir(rootDir);\n    } else if (Array.isArray(rootDir)) {\n        rootDirs = rootDir.map(function(dir) {\n            return typeof dir === 'string' ? processRootDir(dir) : [];\n        }).flat();\n    }\n    return rootDirs;\n};\n";
const originalDigest = "886677432990a735e5ebdfb345ff1cbd40e264f9947a8432eeeb254b3a926bde";
const patchFile = fileURLToPath(new URL(
  "../../packages/builder-core/templates/common/literal-lint-roots/patches/next-eslint-plugin-next.patch",
  import.meta.url,
));
const nativeRequire = createRequire(import.meta.url);

test("literal lint roots validate the complete setting before route discovery", async (t) => {
  assert.equal(createHash("sha256").update(originalHelper).digest("hex"), originalDigest);
  const temporaryRoot = fs.realpathSync(fs.mkdtempSync(path.join(tmpdir(), "literal-lint-roots-")));
  t.diagnostic(`Retained standalone helper fixtures: ${temporaryRoot}`);
  const helperFile = path.join(temporaryRoot, "dist/utils/get-root-dirs.js");
  fs.mkdirSync(path.dirname(helperFile), { recursive: true });
  fs.writeFileSync(helperFile, originalHelper);
  // Keep the standalone fixture outside an enclosing repository's patch path filtering.
  const patchOptions = {
    cwd: temporaryRoot,
    env: { ...process.env, GIT_CEILING_DIRECTORIES: path.dirname(temporaryRoot) },
  };
  execFileSync("git", ["apply", "--check", patchFile], patchOptions);
  execFileSync("git", ["apply", patchFile], patchOptions);
  const exports = {};
  vm.runInNewContext(fs.readFileSync(helperFile, "utf8"), {
    exports,
    process,
    require(specifier) {
      // Fail before importing any matcher if the patch regresses.
      assert.ok(["node:fs", "node:path"].includes(specifier), specifier);
      return nativeRequire(specifier);
    },
  }, { filename: helperFile });
  const getRootDirs = exports.getRootDirs;
  const roots = (rootDir, cwd = "unvalidated-context-cwd") =>
    Array.from(getRootDirs({ cwd, settings: { next: { rootDir } } }));
  const directory = (name) => {
    const result = path.join(temporaryRoot, name);
    fs.mkdirSync(result, { recursive: true });
    return result;
  };
  const first = directory("first");
  const second = directory("second");
  const contextDirectory = directory("context");
  const invalid = (value, setting = "rootDir") => assert.throws(
    () => roots(value),
    (error) => error.message.includes(setting) && !error.message.includes(temporaryRoot),
  );

  await t.test("absent and undefined settings preserve context cwd without validation", (t) => {
    t.mock.method(fs, "statSync", () => assert.fail("default must not stat"));
    t.mock.method(fs, "accessSync", () => assert.fail("default must not check access"));
    for (const settings of [{}, { next: {} }, { next: { rootDir: undefined } }]) {
      assert.deepEqual(Array.from(getRootDirs({ cwd: "nonexistent-context", settings })), ["nonexistent-context"]);
    }
  });

  await t.test("relative roots use process cwd while defaults retain context cwd", () => {
    const previous = process.cwd();
    try {
      process.chdir(temporaryRoot);
      assert.deepEqual(roots("first", contextDirectory), [first]);
      assert.deepEqual(roots(undefined, contextDirectory), [contextDirectory]);
      assert.deepEqual(roots(["second", "first", "second"]), [second, first, second]);
      assert.deepEqual(roots(first), [first]);
      assert.deepEqual(roots(path.dirname(temporaryRoot)), [path.dirname(temporaryRoot)]);
      for (const spelling of ["./first/", "first//./", "second/../first", "first\\", ".\\first"]) {
        assert.deepEqual(roots(spelling), [first]);
      }
    } finally {
      process.chdir(previous);
    }
  });

  await t.test("literal spaces Unicode dot names and ordinary punctuation are not expanded", () => {
    for (const name of [" ", " spaced ", "école", ".hidden", "@name", "+name", "a!b", "~", "$HOME"]) {
      const root = directory(name);
      assert.deepEqual(roots(root), [root]);
    }
  });

  await t.test("invalid types and any invalid array member refuse rather than fallback or filter", () => {
    for (const value of [null, false, true, 0, 1, {}, [], "", [first, 2], [first, ""], [[first]], [first, undefined]]) {
      invalid(value);
    }
    const sparse = [first];
    sparse.length = 2;
    invalid(sparse, "rootDir[1]");
  });

  await t.test("reserved glob syntax is rejected before filesystem access anywhere in the array", (t) => {
    t.mock.method(fs, "statSync", () => assert.fail("glob rejection must precede stat"));
    t.mock.method(fs, "accessSync", () => assert.fail("glob rejection must precede access"));
    for (const spelling of ["*", "**", "?", "[a]", "]", "{a,b}", "}", "(a)", ")", "@(a)", "+(a)", "!(a)", "!literal", "\\*"]) {
      invalid([first, spelling], "rootDir[1]");
    }
  });

  await t.test("missing paths files broken links and loops invalidate the whole setting", () => {
    const file = path.join(temporaryRoot, "regular-file");
    fs.writeFileSync(file, "fixture");
    for (const value of [file, path.join(temporaryRoot, "missing"), "bad\0path"]) {
      invalid([first, value], "rootDir[1]");
    }
    const broken = path.join(temporaryRoot, "broken-link");
    fs.symlinkSync(path.join(temporaryRoot, "absent-target"), broken, "junction");
    invalid([first, broken], "rootDir[1]");
    if (process.platform !== "win32") {
      const loop = path.join(temporaryRoot, "loop-link");
      fs.symlinkSync(loop, loop);
      invalid([first, loop], "rootDir[1]");
    }
  });

  await t.test("directory aliases preserve lexical paths including targets outside the root", () => {
    const alias = path.join(temporaryRoot, "alias");
    fs.symlinkSync(first, alias, "junction");
    assert.deepEqual(roots(alias), [alias]);
    const outsideAlias = path.join(temporaryRoot, "outside-alias");
    fs.symlinkSync(path.dirname(temporaryRoot), outsideAlias, "junction");
    assert.deepEqual(roots(outsideAlias), [outsideAlias]);
  });

  await t.test("permission denial rejects all roots before a consumer can traverse", (t) => {
    const alias = path.join(temporaryRoot, "permission-alias");
    fs.symlinkSync(second, alias, "junction");
    const originalAccess = fs.accessSync;
    const modes = process.platform === "win32" ? [fs.constants.R_OK] : [fs.constants.R_OK, fs.constants.X_OK];
    for (const deniedMode of modes) {
      for (const deniedRoot of [second, alias]) {
        const calls = [];
        const mock = t.mock.method(fs, "accessSync", (root, mode) => {
          calls.push([root, mode]);
          if (root === deniedRoot && (mode & deniedMode) !== 0) {
            throw Object.assign(new Error("controlled native access denial"), { code: "EACCES" });
          }
          return originalAccess(root, mode);
        });
        let traversed = false;
        assert.throws(() => {
          roots([first, deniedRoot]);
          traversed = true;
        }, /rootDir\[1\]/u);
        assert.equal(traversed, false);
        assert.deepEqual(calls.map(([root]) => root), [first, deniedRoot]);
        const requiredMode = process.platform === "win32" ? fs.constants.R_OK : fs.constants.R_OK | fs.constants.X_OK;
        assert.ok(calls.every(([, mode]) => mode === requiredMode));
        mock.mock.restore();
      }
    }
  });

  await t.test("foreign drives URLs device paths and drive-relative paths fail explicitly", () => {
    for (const value of ["C:relative", "file:///tmp/root", "https://example.com/root", "\\\\.\\C:\\root", "\\\\?\\C:\\root"]) {
      invalid(value);
    }
    if (process.platform !== "win32") {
      for (const value of ["C:/absolute", "C:\\absolute", "\\\\server\\share", "//server/share"]) invalid(value);
    } else {
      assert.deepEqual(roots(first.replaceAll("\\", "/")), [first]);
    }
  });
});
