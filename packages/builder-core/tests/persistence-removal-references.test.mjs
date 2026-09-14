import assert from "node:assert/strict";
import test from "node:test";

import { guardCapabilityRemovalReferences } from "../dist/lifecycle/capability-removal-reference-guard.js";

const encoder = new TextEncoder();

async function inspect(entries, options = {}) {
  const files = new Map(entries);
  return guardCapabilityRemovalReferences({
    reader: {
      async readText(path) {
        const content = files.get(path);
        return content === undefined ? { kind: "missing" } : { kind: "file", content };
      },
    },
    inventory: {
      entries: [...files.keys()].map((path) => ({ path, kind: "file" })),
      truncated: false,
    },
    actions: [],
    desiredFiles: [],
    referenceToken: "application-persistence",
    removedPackages: ["drizzle-orm", "drizzle-kit"],
    ...options,
  });
}

test("persistence removal refuses surviving package root and subpath module consumers", async () => {
  for (const source of [
    'import { sql } from "drizzle-orm";',
    'export { drizzle } from "drizzle-orm/d1";',
    'type Database = import("drizzle-orm/d1").DrizzleD1Database;',
    'const load = () => import("drizzle-kit");',
    'const database = require("drizzle-orm/d1");',
    'const path = require.resolve("drizzle-kit/api");',
    'import database = require("drizzle-orm/d1");',
  ]) {
    const result = await inspect([["apps/web/src/consumer.ts", source]]);
    assert.deepEqual(result, { ok: false, conflicts: ["apps/web/src/consumer.ts"] });
  }
});

test("persistence removal refuses surviving tooling and package configuration references", async () => {
  const result = await inspect([
    ["apps/web/package.json", '{"scripts":{"custom:migrate":"drizzle-kit migrate"}}'],
    ["scripts/check.sh", "pnpm exec drizzle-kit check"],
    ["apps/other/package.json", '{"dependencies":{"drizzle-orm":"0.45.2"}}'],
  ]);
  assert.deepEqual(result, {
    ok: false,
    conflicts: ["apps/other/package.json", "apps/web/package.json", "scripts/check.sh"],
  });
});

test("persistence removal inspects the projected source and manifest after owned replacements", async () => {
  const result = await inspect([
    ["apps/web/src/removed.ts", 'import { sql } from "drizzle-orm";'],
    ["apps/web/package.json", '{"dependencies":{"drizzle-orm":"0.45.2"}}'],
  ], {
    actions: [
      { kind: "delete-file", path: "apps/web/src/removed.ts" },
      { kind: "replace-file", path: "apps/web/package.json" },
    ],
    desiredFiles: [{ path: "apps/web/package.json", content: encoder.encode('{"dependencies":{}}') }],
  });
  assert.deepEqual(result, { ok: true, warnings: [] });
});

test("persistence package names in prose and dynamic loading remain explicit review warnings", async () => {
  const result = await inspect([
    ["docs/migration.md", "Previously used drizzle-orm/d1."],
    ["apps/web/src/loader.ts", "export const load = (name) => import(name);"],
    ["apps/web/src/label.ts", 'export const label = "drizzle-orm";'],
    ["apps/web/src/other.ts", 'import value from "drizzle-orm-extra";'],
  ]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.warnings, [
    { code: "CAPABILITY_REMOVAL_DYNAMIC_REFERENCE_POSSIBLE", path: "apps/web/src/loader.ts" },
    { code: "CAPABILITY_REMOVAL_HEURISTIC_REFERENCE_POSSIBLE", path: "apps/web/src/label.ts" },
    { code: "CAPABILITY_REMOVAL_HEURISTIC_REFERENCE_POSSIBLE", path: "docs/migration.md" },
  ]);
});

test("removing an unrelated capability does not treat retained persistence imports as conflicts", async () => {
  const result = await inspect([["apps/web/src/database.ts", 'import { drizzle } from "drizzle-orm/d1";']], {
    referenceToken: "calendly",
    removedPackages: [],
  });
  assert.deepEqual(result, { ok: true, warnings: [] });
});
