import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const builtEntry = resolve(packageRoot, "dist/index.js");

test("the public root API exposes only the approved operational contract", async () => {
  await access(builtEntry);

  const publicApi = await import("@egeria-systems/observability");

  assert.deepEqual(Object.keys(publicApi).sort(), [
    "createOperationalErrorReport",
    "createOperationalEvent",
    "dispatchOperationalEvent",
    "isOperationalErrorReport",
    "normalizeErrorCategory",
    "operationalCaptureMechanisms",
    "operationalErrorCategories",
    "operationalEventKinds",
    "operationalRuntimes",
    "operationalSeverities",
    "reconstructOperationalErrorReport",
  ]);
});
