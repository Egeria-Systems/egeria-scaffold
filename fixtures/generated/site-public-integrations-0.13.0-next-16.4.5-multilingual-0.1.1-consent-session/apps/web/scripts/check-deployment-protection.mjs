import { pathToFileURL } from "node:url";

const maximumResponseBytes = 1024 * 1024;
function refuse(code) { throw new Error(`DEPLOYMENT_PROTECTION_${code}`); }

async function readResponse(response) {
  if (response.status !== 200 || response.redirected || response.body === null) refuse("API_UNAVAILABLE");
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > maximumResponseBytes) refuse("API_INVALID");
      chunks.push(Buffer.from(next.value));
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export async function checkDeploymentProtection({ phase, environment = process.env, fetch = globalThis.fetch }) {
  if (!["preflight", "production"].includes(phase) || environment.GITHUB_RUN_ATTEMPT !== "1" ||
      environment.GITHUB_REF !== "refs/heads/main" || !/^[a-f0-9]{40}$/u.test(environment.EXPECTED_REVISION ?? "") ||
      environment.GITHUB_SHA !== environment.EXPECTED_REVISION || !/^[1-9][0-9]*$/u.test(environment.GITHUB_RUN_ID ?? "") ||
      !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/u.test(environment.GITHUB_REPOSITORY ?? "") ||
      environment.GITHUB_REPOSITORY.split("/").some(part => part === "." || part === "..") ||
      !environment.GITHUB_TOKEN || !environment.GITHUB_ACTOR || !environment.GITHUB_TRIGGERING_ACTOR) refuse("SOURCE_INVALID");
  const base = `https://api.github.com/repos/${environment.GITHUB_REPOSITORY}`;
  const get = async path => {
    try {
      const response = await fetch(`${base}${path}`, { method: "GET", redirect: "error", signal: AbortSignal.timeout(10000),
        headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${environment.GITHUB_TOKEN}`, "X-GitHub-Api-Version": "2022-11-28" } });
      return await readResponse(response);
    } catch { refuse("API_UNAVAILABLE"); }
  };
  let productionId;
  for (const name of ["staging", "production"]) {
    const value = await get(`/environments/${name}`);
    if (value?.name !== name || !Number.isSafeInteger(value.id) || value.id <= 0 ||
        value.deployment_branch_policy?.protected_branches !== false || value.deployment_branch_policy?.custom_branch_policies !== true ||
        !Array.isArray(value.protection_rules)) refuse("ENVIRONMENT_INVALID");
    const policies = await get(`/environments/${name}/deployment-branch-policies?per_page=100`);
    if (policies?.total_count !== 1 || !Array.isArray(policies.branch_policies) || policies.branch_policies.length !== 1 ||
        policies.branch_policies[0]?.name !== "main" || policies.branch_policies[0]?.type !== "branch") refuse("BRANCH_INVALID");
    if (name === "production") {
      productionId = value.id;
      const reviewers = value.protection_rules.filter(rule => rule?.type === "required_reviewers");
      if (reviewers.length !== 1 || reviewers[0].prevent_self_review !== true || !Array.isArray(reviewers[0].reviewers) ||
          reviewers[0].reviewers.length === 0 || reviewers[0].reviewers.some(entry => !["User", "Team"].includes(entry?.type) ||
            !Number.isSafeInteger(entry.reviewer?.id) || entry.reviewer.id <= 0)) refuse("REVIEWERS_INVALID");
    }
  }
  if (phase === "production") {
    const reviews = await get(`/actions/runs/${environment.GITHUB_RUN_ID}/approvals`);
    const excluded = [environment.GITHUB_ACTOR, environment.GITHUB_TRIGGERING_ACTOR].map(value => value.toLowerCase());
    if (!Array.isArray(reviews) || !reviews.some(review => review?.state === "approved" && review.user?.type === "User" &&
      typeof review.user.login === "string" && !excluded.includes(review.user.login.toLowerCase()) &&
      Array.isArray(review.environments) && review.environments.some(value => value?.id === productionId && value.name === "production"))) refuse("APPROVAL_INVALID");
  }
  return { code: "DEPLOYMENT_PROTECTION_VALID", phase };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) refuse("ARGUMENT_INVALID");
    console.log(JSON.stringify(await checkDeploymentProtection({ phase: process.argv[2] })));
  } catch (error) {
    console.error(JSON.stringify({ code: error instanceof Error && /^DEPLOYMENT_PROTECTION_[A-Z_]+$/u.test(error.message) ? error.message : "DEPLOYMENT_PROTECTION_INVALID" }));
    process.exitCode = 1;
  }
}
