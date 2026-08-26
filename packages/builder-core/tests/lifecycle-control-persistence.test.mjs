import assert from "node:assert/strict";
import test from "node:test";

import {
  persistInstalledState,
  persistMigrationRecord,
  prepareMigrationRecord,
} from "../dist/lifecycle/lifecycle-control-persistence.js";

const decoder = new TextDecoder();

const previousMigrationSource =
  '{"capabilities":["standards"],"completedAt":"2026-08-23T12:00:00.000Z","fromBuilderVersion":"0.0.0","identifier":"previous-migration","kind":"migration","outcome":"succeeded","persistentDataAuthorizations":[],"remainingKnownDrift":[],"schemaVersion":"1.0.0","toBuilderVersion":"0.0.0","verificationChecks":["contracts"]}';
const appendedMigrationSource = `${previousMigrationSource}\n{"capabilities":["standards"],"completedAt":"2026-08-24T12:00:00.000Z","fromBuilderVersion":"0.0.0","identifier":"current-migration","kind":"migration","outcome":"succeeded","persistentDataAuthorizations":[],"remainingKnownDrift":[],"schemaVersion":"1.0.0","toBuilderVersion":"0.0.0","verificationChecks":["contracts","migration-record"]}\n`;

const migrationRecord = {
  schemaVersion: "1.0.0",
  identifier: "current-migration",
  kind: "migration",
  outcome: "succeeded",
  completedAt: "2026-08-24T12:00:00.000Z",
  fromBuilderVersion: "0.0.0",
  toBuilderVersion: "0.0.0",
  capabilities: ["standards"],
  persistentDataAuthorizations: [],
  remainingKnownDrift: [],
  verificationChecks: ["contracts", "migration-record"],
};

const installedState = {
  schemaVersion: "1.0.0",
  builderVersion: "0.0.0",
  projectSchemaVersion: "1.0.0",
  origin: { profile: "portfolio", recipeVersion: "0.1.0" },
  installedCapabilities: [],
  appliedMigrations: ["current-migration"],
  managedSurfaces: [],
  ejections: [],
  compatibility: {
    node: "22.23.2",
    pnpm: "11.20.0",
    platformAdapter: "cloudflare-workers",
  },
  lastSuccessfulVerification: {
    kind: "generation",
    checks: [
      "contracts",
      "pre-state-inference",
      "lockfile",
      "frozen-install",
      "lint",
      "typecheck",
      "next-build",
      "opennext-build",
      "post-state-inference",
    ],
  },
};

const installedStateSource = `{
  "appliedMigrations": [
    "current-migration"
  ],
  "builderVersion": "0.0.0",
  "compatibility": {
    "node": "22.23.2",
    "platformAdapter": "cloudflare-workers",
    "pnpm": "11.20.0"
  },
  "ejections": [],
  "installedCapabilities": [],
  "lastSuccessfulVerification": {
    "checks": [
      "contracts",
      "pre-state-inference",
      "lockfile",
      "frozen-install",
      "lint",
      "typecheck",
      "next-build",
      "opennext-build",
      "post-state-inference"
    ],
    "kind": "generation"
  },
  "managedSurfaces": [],
  "origin": {
    "profile": "portfolio",
    "recipeVersion": "0.1.0"
  },
  "projectSchemaVersion": "1.0.0",
  "schemaVersion": "1.0.0"
}
`;

test("migration persistence appends canonical bytes before exact reread validation", async () => {
  const events = [];
  const prepared = prepareMigrationRecord({
    currentSource: previousMigrationSource,
    currentIdentifiers: ["previous-migration"],
    record: migrationRecord,
  });

  assert.equal(prepared.source, appendedMigrationSource);
  assert.equal(decoder.decode(prepared.content), appendedMigrationSource);

  const result = await persistMigrationRecord({
    prepared,
    write: async (change) => {
      events.push({
        kind: "write",
        path: change.path,
        expected: decoder.decode(change.expected),
        content: decoder.decode(change.content),
      });
      return true;
    },
    readSource: async () => {
      events.push({ kind: "read" });
      return appendedMigrationSource;
    },
  });

  assert.deepEqual(events, [
    {
      kind: "write",
      path: ".egeria/migrations.jsonl",
      expected: previousMigrationSource,
      content: appendedMigrationSource,
    },
    { kind: "read" },
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.source, appendedMigrationSource);
  assert.equal(result.ok && decoder.decode(result.content), appendedMigrationSource);
});

test("migration persistence rejects failed writes and exact-source identifier disagreement", async () => {
  const prepared = prepareMigrationRecord({
    currentSource: `${previousMigrationSource}\n`,
    currentIdentifiers: ["different-previous-migration"],
    record: migrationRecord,
  });
  let readCount = 0;

  const failedWrite = await persistMigrationRecord({
    prepared,
    write: async () => false,
    readSource: async () => {
      readCount += 1;
      return prepared.source;
    },
  });
  assert.deepEqual(failedWrite, { ok: false });
  assert.equal(readCount, 0);

  const wrongIdentifiers = await persistMigrationRecord({
    prepared,
    write: async () => true,
    readSource: async () => prepared.source,
  });
  assert.deepEqual(wrongIdentifiers, { ok: false });
});

test("migration persistence rejects byte-different rereads with matching ordered identifiers", async () => {
  const prepared = prepareMigrationRecord({
    currentSource: previousMigrationSource,
    currentIdentifiers: ["previous-migration"],
    record: migrationRecord,
  });

  const byteDifferentSource = `${prepared.source}\n`;
  const result = await persistMigrationRecord({
    prepared,
    write: async () => true,
    readSource: async () => byteDifferentSource,
  });

  assert.deepEqual(result, { ok: false });
});

test("installed state persistence writes exact canonical bytes through the state-last boundary", async () => {
  const changes = [];
  const result = await persistInstalledState({
    currentSource: "{}\n",
    state: installedState,
    write: async (change) => {
      changes.push({
        path: change.path,
        expected: decoder.decode(change.expected),
        content: decoder.decode(change.content),
      });
      return true;
    },
  });

  assert.deepEqual(changes, [
    {
      path: ".egeria/state.json",
      expected: "{}\n",
      content: installedStateSource,
    },
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.source, installedStateSource);
  assert.equal(result.ok && decoder.decode(result.content), installedStateSource);
});

test("installed state persistence returns failure without claiming persisted bytes", async () => {
  const result = await persistInstalledState({
    currentSource: "{}\n",
    state: installedState,
    write: async () => false,
  });

  assert.deepEqual(result, { ok: false });
});
