import assert from "node:assert/strict";
import test from "node:test";

import {
  checkLocalCandidate,
  checkRegistryState,
  checkReleaseContext,
} from "../../scripts/check-package-release.mjs";

const releaseCommit = "a".repeat(40);

const packageRecords = [
  {
    name: "@egeria-systems/scaffold",
    path: ".",
    private: true,
    version: "0.0.0",
  },
  {
    name: "@egeria-systems/cli",
    path: "apps/cli",
    private: true,
    version: "0.0.0",
  },
  {
    name: "@egeria-systems/builder-core",
    path: "packages/builder-core",
    private: true,
    version: "0.0.0",
  },
  {
    name: "@egeria-systems/observability",
    path: "packages/observability",
    private: false,
    version: "0.1.0",
  },
  {
    name: "@egeria-systems/standards",
    path: "packages/standards",
    private: false,
    version: "0.1.0",
  },
  {
    name: "@egeria-systems/nextjs-cloudflare-proof",
    path: "proofs/nextjs-cloudflare",
    private: true,
    version: "0.0.0",
  },
];

const absentRegistryResults = [
  {
    name: "@egeria-systems/observability",
    version: "0.1.0",
    status: "absent",
  },
  {
    name: "@egeria-systems/standards",
    version: "0.1.0",
    status: "absent",
  },
];

const problemCodes = (problems) => problems.map(({ code }) => code);

test("exact main release context is accepted", () => {
  const problems = checkReleaseContext({
    githubRef: "refs/heads/main",
    githubSha: releaseCommit,
    releaseCommit,
  });

  assert.deepEqual(problems, []);
  assert.equal(Object.isFrozen(problems), true);
});

test("release context rejects invalid refs and commit identities", () => {
  assert.deepEqual(
    problemCodes(
      checkReleaseContext({
        githubRef: "refs/heads/release",
        githubSha: releaseCommit,
        releaseCommit,
      }),
    ),
    ["RELEASE_REF_INVALID"],
  );
  assert.deepEqual(
    problemCodes(
      checkReleaseContext({
        githubRef: "refs/heads/main",
        githubSha: releaseCommit,
        releaseCommit: releaseCommit.toUpperCase(),
      }),
    ),
    ["RELEASE_COMMIT_INVALID", "RELEASE_COMMIT_MISMATCH"],
  );
  assert.deepEqual(
    problemCodes(
      checkReleaseContext({
        githubRef: "refs/heads/main",
        githubSha: "b".repeat(40),
        releaseCommit,
      }),
    ),
    ["RELEASE_COMMIT_MISMATCH"],
  );
});

test("the exact two-package release candidate is accepted", () => {
  const problems = checkLocalCandidate({
    packages: packageRecords,
    pendingChangesets: [],
  });

  assert.deepEqual(problems, []);
  assert.equal(Object.isFrozen(problems), true);
});

test("missing, extra, renamed, or private public records are rejected", () => {
  const cases = [
    packageRecords.filter(
      ({ name }) => name !== "@egeria-systems/standards",
    ),
    [
      ...packageRecords,
      {
        name: "@egeria-systems/extra",
        path: "packages/extra",
        private: false,
        version: "0.1.0",
      },
    ],
    packageRecords.map((record) =>
      record.name === "@egeria-systems/standards"
        ? { ...record, name: "@egeria-systems/standard" }
        : record,
    ),
    packageRecords.map((record) =>
      record.name === "@egeria-systems/standards"
        ? { ...record, private: true }
        : record,
    ),
  ];

  for (const packages of cases) {
    assert.deepEqual(
      problemCodes(checkLocalCandidate({ packages, pendingChangesets: [] })),
      ["PUBLIC_PACKAGE_SET_INVALID"],
    );
  }
});

test("invalid, zero, and wrong candidate versions are rejected", () => {
  for (const [version, code] of [
    ["invalid", "PUBLIC_PACKAGE_VERSION_INVALID"],
    ["0.0.0", "PUBLIC_PACKAGE_VERSION_INVALID"],
    ["0.2.0", "PUBLIC_PACKAGE_VERSION_UNEXPECTED"],
  ]) {
    const packages = packageRecords.map((record) =>
      record.name === "@egeria-systems/standards"
        ? { ...record, version }
        : record,
    );

    assert.deepEqual(
      problemCodes(checkLocalCandidate({ packages, pendingChangesets: [] })),
      [code],
    );
  }
});

test("pending release intent is rejected after version materialization", () => {
  assert.deepEqual(
    problemCodes(
      checkLocalCandidate({
        packages: packageRecords,
        pendingChangesets: ["pending-release.md"],
      }),
    ),
    ["PENDING_CHANGESET"],
  );
});

test("an all-absent registry state is accepted", () => {
  assert.deepEqual(
    checkRegistryState({
      packages: packageRecords,
      pendingChangesets: [],
      registryResults: absentRegistryResults,
    }),
    [],
  );
});

test("present, mixed, redirect, rate-limit, authentication, and network states fail closed", () => {
  for (const status of [
    "present",
    "redirect",
    "rate-limited",
    "authentication-failed",
    "network-failed",
  ]) {
    const registryResults = absentRegistryResults.map((result, index) =>
      index === 0
        ? {
            ...result,
            status,
            detail: "credential-secret response-body",
          }
        : result,
    );
    const problems = checkRegistryState({
      packages: packageRecords,
      pendingChangesets: [],
      registryResults,
    });
    const serialized = JSON.stringify(problems);

    assert.deepEqual(problemCodes(problems), ["REGISTRY_STATE_INVALID"]);
    assert.equal(serialized.includes("credential-secret"), false);
    assert.equal(serialized.includes("response-body"), false);
  }
});

test("registry validation rejects incomplete or mixed target results", () => {
  assert.deepEqual(
    problemCodes(
      checkRegistryState({
        packages: packageRecords,
        pendingChangesets: [],
        registryResults: absentRegistryResults.slice(0, 1),
      }),
    ),
    ["REGISTRY_RESULT_SET_INVALID"],
  );
  assert.deepEqual(
    problemCodes(
      checkRegistryState({
        packages: packageRecords,
        pendingChangesets: [],
        registryResults: absentRegistryResults.map((result, index) =>
          index === 0 ? { ...result, status: "present" } : result,
        ),
      }),
    ),
    ["REGISTRY_STATE_INVALID"],
  );
});
