import assert from "node:assert/strict";
import test from "node:test";
import { checkDeploymentProtection } from "../../scripts/check-deployment-protection.mjs";

const environment = { GITHUB_REPOSITORY: "example/project", GITHUB_RUN_ID: "123", GITHUB_RUN_ATTEMPT: "1",
  GITHUB_REF: "refs/heads/main", GITHUB_SHA: "a".repeat(40), EXPECTED_REVISION: "a".repeat(40),
  GITHUB_ACTOR: "author", GITHUB_TRIGGERING_ACTOR: "operator", GITHUB_TOKEN: "synthetic-token-never-print" };
const policies = { total_count: 1, branch_policies: [{ name: "main", type: "branch" }] };
const staging = { id: 10, name: "staging", deployment_branch_policy: { protected_branches: false, custom_branch_policies: true }, protection_rules: [] };
const production = { ...staging, id: 20, name: "production", protection_rules: [{ type: "required_reviewers", prevent_self_review: true, reviewers: [{ type: "User", reviewer: { id: 30 } }] }] };
const history = [{ state: "approved", user: { id: 30, type: "User", login: "reviewer" }, environments: [{ id: 20, name: "production" }] }];
function fixture(overrides = {}) {
  const requests = [];
  const data = { staging, production, policies, history, ...overrides };
  const fetch = async (url, options) => {
    requests.push({ url, options });
    const key = url.endsWith("/approvals") ? "history" : url.includes("/deployment-branch-policies?") ? "policies" : url.endsWith("/staging") ? "staging" : "production";
    const value = data[key];
    return value instanceof Response ? value : Response.json(value);
  };
  return { fetch, requests };
}

test("protection guard admits exact main restrictions and a separate human production approval", async () => {
  const input = fixture();
  await checkDeploymentProtection({ phase: "preflight", environment, fetch: input.fetch });
  assert.equal(input.requests.length, 4);
  await checkDeploymentProtection({ phase: "production", environment, fetch: input.fetch });
  assert.equal(input.requests.length, 9);
  for (const { url, options } of input.requests) {
    assert.equal(new URL(url).origin, "https://api.github.com");
    assert.equal(options.redirect, "error");
    assert.equal(options.method, "GET");
  }
});

test("protection guard refuses missing reviewers, self approval and broader branches", async () => {
  for (const overrides of [
    { production: { ...production, protection_rules: [] } },
    { production: { ...production, protection_rules: [{ ...production.protection_rules[0], prevent_self_review: false }] } },
    { production: { ...production, deployment_branch_policy: null } },
    { policies: { total_count: 2, branch_policies: [...policies.branch_policies, { name: "*", type: "branch" }] } },
    { policies: { total_count: 1, branch_policies: [{ name: "main", type: "tag" }] } },
    { history: [] },
    { history: [{ ...history[0], user: { ...history[0].user, login: "author" } }] },
    { history: [{ ...history[0], user: { ...history[0].user, login: "operator" } }] },
    { history: [{ ...history[0], user: { ...history[0].user, type: "Bot" } }] },
    { history: [{ ...history[0], environments: [{ id: 21, name: "production" }] }] },
  ]) await assert.rejects(checkDeploymentProtection({ phase: "production", environment, fetch: fixture(overrides).fetch }), /^Error: DEPLOYMENT_PROTECTION_/);
});

test("protection guard denies unavailable, malformed, redirected and oversized API results without logging tokens", async () => {
  for (const response of [new Response(null, { status: 403 }), new Response(null, { status: 404 }),
    new Response(null, { status: 302, headers: { location: "https://other.example.test" } }),
    new Response("invalid-json-private"), new Response("x".repeat(1024 * 1024 + 1)), Response.json(null)]) {
    await assert.rejects(checkDeploymentProtection({ phase: "preflight", environment, fetch: fixture({ staging: response }).fetch }), error =>
      /^DEPLOYMENT_PROTECTION_/u.test(error.message) && !error.message.includes("private") && !error.message.includes("token"));
  }
  await assert.rejects(checkDeploymentProtection({ phase: "preflight", environment, fetch: async () => { throw new Error("synthetic-token-never-print"); } }), /^Error: DEPLOYMENT_PROTECTION_API_UNAVAILABLE$/);
});

test("protection guard refuses reruns and inconsistent source before any API request", async () => {
  for (const change of [{ GITHUB_RUN_ATTEMPT: "2" }, { GITHUB_SHA: "b".repeat(40) }, { GITHUB_REF: "refs/heads/other" }, { GITHUB_TOKEN: "" }, { GITHUB_REPOSITORY: "../escape" }]) {
    const input = fixture();
    await assert.rejects(checkDeploymentProtection({ phase: "preflight", environment: { ...environment, ...change }, fetch: input.fetch }));
    assert.equal(input.requests.length, 0);
  }
});
