import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  checkLocalCandidate,
  checkRegistryState,
  checkReleaseContext,
  classifyRegistryResponseStatus,
  readRegistryPackageState,
} from "../../scripts/check-package-release.mjs";
import { isPinnedGitHubActionReference } from "../helpers/github-actions.mjs";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);

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
    version: "0.2.0",
  },
  {
    name: "@egeria-systems/standards",
    path: "packages/standards",
    private: false,
    version: "0.2.0",
  },
  {
    name: "@egeria-systems/nextjs-cloudflare-proof",
    path: "proofs/nextjs-cloudflare",
    private: true,
    version: "0.0.0",
  },
];

const unpublishedTargetRegistryResults = [
  {
    name: "@egeria-systems/observability",
    version: "0.2.0",
    packageStatus: "present",
    versions: ["0.1.0"],
    status: "absent",
  },
  {
    name: "@egeria-systems/standards",
    version: "0.2.0",
    packageStatus: "present",
    versions: ["0.1.0"],
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
        version: "0.2.0",
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
    ["0.1.0", "PUBLIC_PACKAGE_VERSION_UNEXPECTED"],
    ["0.3.0", "PUBLIC_PACKAGE_VERSION_UNEXPECTED"],
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

test("release registry state accepts existing histories with absent target versions", () => {
  assert.deepEqual(
    checkRegistryState({
      packages: packageRecords,
      pendingChangesets: [],
      registryResults: unpublishedTargetRegistryResults,
    }),
    [],
  );
});

test("release registry state fails closed for every non-absent target result", () => {
  for (const status of [
    "present",
    "redirect",
    "rate-limited",
    "authentication-failed",
    "network-failed",
  ]) {
    const registryResults = unpublishedTargetRegistryResults.map((result, index) =>
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
        registryResults: unpublishedTargetRegistryResults.slice(0, 1),
      }),
    ),
    ["REGISTRY_RESULT_SET_INVALID"],
  );
  assert.deepEqual(
    problemCodes(
      checkRegistryState({
        packages: packageRecords,
        pendingChangesets: [],
        registryResults: unpublishedTargetRegistryResults.map((result, index) =>
          index === 0 ? { ...result, status: "present" } : result,
        ),
      }),
    ),
    ["REGISTRY_STATE_INVALID"],
  );
});

test("registry validation rejects missing package history", () => {
  const registryResults = unpublishedTargetRegistryResults.map(
    (result, index) =>
      index === 0
        ? { ...result, packageStatus: "absent", versions: [] }
        : result,
  );

  assert.deepEqual(
    problemCodes(
      checkRegistryState({
        packages: packageRecords,
        pendingChangesets: [],
        registryResults,
      }),
    ),
    ["REGISTRY_STATE_INVALID"],
  );
});

test("registry validation rejects unexpected package history versions", () => {
  for (const versions of [["0.3.0"], ["0.1.0", "0.3.0"], []]) {
    const registryResults = unpublishedTargetRegistryResults.map(
      (result, index) => (index === 0 ? { ...result, versions } : result),
    );

    assert.deepEqual(
      problemCodes(
        checkRegistryState({
          packages: packageRecords,
          pendingChangesets: [],
          registryResults,
        }),
      ),
      ["REGISTRY_STATE_INVALID"],
    );
  }
});

test("registry response statuses are classified fail-closed", () => {
  for (const [statusCode, status] of [
    [404, "absent"],
    [200, "present"],
    [301, "redirect"],
    [307, "redirect"],
    [401, "authentication-failed"],
    [403, "authentication-failed"],
    [429, "rate-limited"],
    [500, "unexpected"],
  ]) {
    assert.equal(classifyRegistryResponseStatus(statusCode), status);
  }
});

test("registry adapter checks package history and exact version", async () => {
  const requests = [];
  const result = await readRegistryPackageState({
    name: "@egeria-systems/standards",
    version: "0.2.0",
    request: async (url, options) => {
      requests.push({ url, redirect: options.redirect });
      return url.endsWith("/0.2.0")
        ? { status: 404 }
        : {
            status: 200,
            json: async () => ({ versions: { "0.1.0": {} } }),
          };
    },
  });

  assert.deepEqual(result, {
    name: "@egeria-systems/standards",
    version: "0.2.0",
    packageStatus: "present",
    versions: ["0.1.0"],
    status: "absent",
  });
  assert.deepEqual(
    requests.sort((left, right) => left.url.localeCompare(right.url)),
    [
      {
        url: "https://registry.npmjs.org/%40egeria-systems%2Fstandards",
        redirect: "manual",
      },
      {
        url: "https://registry.npmjs.org/%40egeria-systems%2Fstandards/0.2.0",
        redirect: "manual",
      },
    ],
  );
});

test("registry adapter maps request failures without exposing details", async () => {
  const result = await readRegistryPackageState({
    name: "@egeria-systems/observability",
    version: "0.2.0",
    request: async () => {
      throw new Error("credential-secret network detail");
    },
  });

  assert.deepEqual(result, {
    name: "@egeria-systems/observability",
    version: "0.2.0",
    packageStatus: "network-failed",
    versions: [],
    status: "network-failed",
  });
  assert.equal(JSON.stringify(result).includes("credential-secret"), false);
});

test("registry adapter rejects invalid package metadata without exposing it", async () => {
  const result = await readRegistryPackageState({
    name: "@egeria-systems/standards",
    version: "0.2.0",
    request: async (url) =>
      url.endsWith("/0.2.0")
        ? { status: 404 }
        : {
            status: 200,
            json: async () => ({ detail: "credential-secret response-body" }),
          },
  });

  assert.deepEqual(result, {
    name: "@egeria-systems/standards",
    version: "0.2.0",
    packageStatus: "invalid-response",
    versions: [],
    status: "absent",
  });
  assert.equal(JSON.stringify(result).includes("credential-secret"), false);
  assert.equal(JSON.stringify(result).includes("response-body"), false);
});

function countMatches(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

function releaseWorkflowProblems(workflow) {
  const contextIndex = workflow.indexOf("- name: Verify release context");
  const candidateIndex = workflow.indexOf("- name: Verify release candidate");
  const registryIndex = workflow.indexOf(
    "pnpm run check:package-release registry",
  );
  const publishIndex = workflow.indexOf("- name: Publish packages");
  const cleanupIndex = workflow.indexOf(
    "- name: Remove temporary npm authentication",
  );
  const beforePublishBlock = workflow.slice(0, publishIndex);
  const publishBlock = workflow.slice(publishIndex, cleanupIndex);
  const contextBlock = workflow.slice(contextIndex, candidateIndex);
  const problems = [];

  for (const command of [
    'test "$(git rev-parse HEAD)" = "$RELEASE_COMMIT"',
    'test "$(git rev-parse refs/heads/main)" = "$RELEASE_COMMIT"',
  ]) {
    if (!contextBlock.includes(command)) {
      problems.push("release context must bind HEAD and local main");
    }
  }

  if (!(registryIndex >= 0 && registryIndex < publishIndex)) {
    problems.push("registry validation must precede publication");
  }
  if (
    /NPM_BOOTSTRAP_TOKEN|secrets\.|npm config set|:_authToken/.test(
      beforePublishBlock,
    )
  ) {
    problems.push("publication must use only trusted-publisher authentication");
  }
  if (/NPM_BOOTSTRAP_TOKEN|secrets\.|:_authToken/.test(publishBlock)) {
    problems.push("publication must not receive configured authentication");
  }
  if (
    !beforePublishBlock.includes("pnpm run verify:package-release-candidate")
  ) {
    problems.push("release candidate verification must precede publication");
  }
  if (
    !publishBlock.includes(
      '        env:\n          NPM_CONFIG_PROVENANCE: "true"\n',
    )
  ) {
    problems.push("publication must explicitly request npm provenance");
  }
  if (
    /verify:package-release-candidate|pnpm peers check|pnpm audit/.test(
      publishBlock,
    )
  ) {
    problems.push("verification must precede publication");
  }
  if (workflow.includes("pnpm run changeset:status")) {
    problems.push("a materialized release must not run raw Changesets status");
  }
  if (!/^        if: always\(\)$/m.test(workflow.slice(cleanupIndex))) {
    problems.push("authentication cleanup must be unconditional");
  }
  if (
    !workflow.includes(
      "pnpm exec npm config delete --location=user //registry.npmjs.org/:_authToken",
    )
  ) {
    problems.push("authentication cleanup command is missing");
  }

  return problems;
}

test("package release workflow is manual, exact-commit-bound, and least privilege", async () => {
  const workflow = await readFile(
    resolve(repositoryRoot, ".github/workflows/package-release.yml"),
    "utf8",
  );

  assert.match(workflow, /^name: Package release$/m);
  assert.match(
    workflow,
    /^on:\n  workflow_dispatch:\n    inputs:\n      release_commit:\n(?:        .+\n)+/m,
  );
  assert.match(workflow, /^        required: true$/m);
  assert.match(workflow, /^        type: string$/m);
  assert.doesNotMatch(
    workflow,
    /^  (?:push|pull_request|schedule|release|workflow_call):/m,
  );
  assert.match(
    workflow,
    /^permissions:\n  contents: read\n  id-token: write$/m,
  );
  assert.match(
    workflow,
    /^concurrency:\n  group: package-release\n  cancel-in-progress: false$/m,
  );
  assert.match(workflow, /^    if: github\.ref == 'refs\/heads\/main'$/m);
  assert.match(workflow, /^    runs-on: ubuntu-24\.04$/m);
  assert.match(workflow, /^      name: npm-release$/m);
  const checkoutReference = workflow.match(
    /^        uses: (actions\/checkout@\S+)$/m,
  )?.[1];
  const setupReference = workflow.match(
    /^        uses: (pnpm\/setup@\S+)$/m,
  )?.[1];
  assert.equal(
    isPinnedGitHubActionReference(checkoutReference, "actions/checkout"),
    true,
  );
  assert.match(workflow, /^          persist-credentials: false$/m);
  assert.match(workflow, /^          fetch-depth: 0$/m);
  assert.match(workflow, /^          ref: main$/m);
  assert.match(
    workflow,
    /test "\$\(git rev-parse HEAD\)" = "\$RELEASE_COMMIT"/,
  );
  assert.match(
    workflow,
    /test "\$\(git rev-parse refs\/heads\/main\)" = "\$RELEASE_COMMIT"/,
  );
  assert.equal(
    isPinnedGitHubActionReference(setupReference, "pnpm/setup"),
    true,
  );
  assert.match(workflow, /^          version: 11\.20\.0$/m);
  assert.match(workflow, /^          runtime: node@22\.23\.2$/m);
  assert.match(workflow, /^          cache: false$/m);
  assert.match(workflow, /^          install: false$/m);
  assert.match(workflow, /pnpm install --frozen-lockfile/);
  assert.match(workflow, /test "\$\(pnpm exec npm --version\)" = "12\.0\.2"/);
  assert.match(workflow, /pnpm run check:package-release context/);
  assert.match(workflow, /pnpm run verify:package-release-candidate/);
  assert.doesNotMatch(workflow, /pnpm run changeset:status/);
  assert.match(workflow, /pnpm peers check/);
  assert.match(workflow, /pnpm audit --audit-level=moderate/);
  assert.equal(
    countMatches(workflow, /pnpm run check:package-release registry/g),
    1,
  );
  assert.equal(countMatches(workflow, /pnpm run release-packages/g), 1);
  assert.doesNotMatch(workflow, /NPM_BOOTSTRAP_TOKEN|secrets\.|npm config set/);
  assert.doesNotMatch(
    workflow,
    /actions\/cache|actions\/setup-node|git push|gh release|wrangler|deploy/i,
  );
  assert.deepEqual(releaseWorkflowProblems(workflow), []);
});

test("package release workflow mutations cannot expose authentication, drop provenance, or skip cleanup", async () => {
  const workflow = await readFile(
    resolve(repositoryRoot, ".github/workflows/package-release.yml"),
    "utf8",
  );
  const provenanceEnvironment =
    '        env:\n          NPM_CONFIG_PROVENANCE: "true"\n';
  const mutations = [
    workflow.replace(
      '          test "$(git rev-parse HEAD)" = "$RELEASE_COMMIT"\n',
      "",
    ),
    workflow.replace(
      '          test "$(git rev-parse refs/heads/main)" = "$RELEASE_COMMIT"\n',
      "",
    ),
    workflow.replace(
      "      - name: Publish packages\n" +
        provenanceEnvironment +
        "        run: pnpm run release-packages",
      "      - name: Publish packages\n" +
        provenanceEnvironment +
        "          NPM_BOOTSTRAP_TOKEN: ${{ secrets.NPM_BOOTSTRAP_TOKEN }}\n" +
        "        run: pnpm run release-packages",
    ),
    workflow.replace(
      "      - name: Publish packages\n",
      "      - name: Configure temporary npm authentication\n" +
        "        env:\n" +
        "          NPM_BOOTSTRAP_TOKEN: ${{ secrets.NPM_BOOTSTRAP_TOKEN }}\n" +
        "        run: pnpm exec npm config set --location=user //registry.npmjs.org/:_authToken \"$NPM_BOOTSTRAP_TOKEN\"\n\n" +
        "      - name: Publish packages\n",
    ),
    workflow.replace(provenanceEnvironment, "        env:\n"),
    workflow.replace(
      provenanceEnvironment,
      '        env:\n          NPM_CONFIG_PROVENANCE: "false"\n',
    ),
    workflow.replace("        if: always()\n", ""),
    workflow.replace("          pnpm run verify:package-release-candidate\n", ""),
  ];

  for (const mutation of mutations) {
    assert.notDeepEqual(releaseWorkflowProblems(mutation), []);
  }
});
