import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const builtEntry = resolve(packageRoot, "dist/index.js");

test("the public root API remains empty", async () => {
  await access(builtEntry);

  const publicApi = await import(pathToFileURL(builtEntry));

  assert.deepEqual(Object.keys(publicApi), []);
});
