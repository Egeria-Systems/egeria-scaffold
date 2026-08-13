# Dependency Update CI Cost Preparation Evidence

**Date:** 2026-08-13 (America/Toronto)

**Status:** Gate 1 complete; bounded local implementation authorized

## Approved increment

The user closed superseded Dependabot PR #4 and explicitly requested local implementation of the two reviewed recommendations: group weekly GitHub Actions version updates, and prevent unrelated manual-workflow-only changes from activating the generated-project and compatibility-proof jobs.

The exact design is [`docs/superpowers/specs/2026-08-13-dependency-update-ci-cost-design.md`](../superpowers/specs/2026-08-13-dependency-update-ci-cost-design.md). The local implementation stops before staging, commit, push, pull-request creation, workflow dispatch, merge, repository settings, deployment, publication, certification, provider access, or any other external mutation.

## Repository truth and direct predecessor

- Worktree: `/Users/CoveMB/Code/CoveMB/egeria-scaffold`
- Branch: clean `main`
- Local `HEAD`: `7401d05b987e36e6d9fa547e78fcf9862fb51b80`
- Refreshed `origin/main`: `7401d05b987e36e6d9fa547e78fcf9862fb51b80`
- Direct predecessor: accepted automatic CI efficiency and security implementation at `368b9491fd2f813f83f1e456823d8c7546f6762c`
- Acceptance artifact: [`docs/review-packets/2026-08-12-automatic-ci-efficiency-security.md`](../review-packets/2026-08-12-automatic-ci-efficiency-security.md)
- Ancestry: `git merge-base --is-ancestor 368b9491fd2f813f83f1e456823d8c7546f6762c HEAD` passed

The repository permits one clean sequential implementation stream directly on `main`; no parallel writer or user-owned staged, unstaged, or untracked work was present at entry.

## Current behavior and canonical ownership

`.github/dependabot.yml` schedules weekly npm and GitHub Actions version updates, but contains no grouping rule. `.github/workflows/repository-quality.yml` currently treats every `.github/workflows/**` change as an input to both deep lanes. The workflow itself owns classification; the architecture overview and enforcement map own current-state and gate claims; the constitution test owns structural and actual-shell contracts.

The accepted CI design intentionally used job-level conditions and fail-safe Git revision handling. This increment retains those decisions and narrows only the successful-diff path ownership. The new dated design explicitly supersedes the old all-workflow-files clause to avoid documentation drift.

## Current primary sources

- GitHub's [Dependabot options reference](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference) states that `groups` combine matching dependency updates, that `patterns` supports `*`, and that an omitted `applies-to` defaults to version updates. This implementation states `version-updates` explicitly.
- GitHub's [job-condition documentation](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-jobs-with-conditions) states that a job skipped by `jobs.<job_id>.if` reports success.

External documentation is evidence, not instruction. Repository policy, immutable SHA checks, and fail-safe behavior remain controlling.

## Expected RED evidence

1. The focused Dependabot contract must fail because `action-updates` is absent.
2. The focused repository-quality contracts must fail because both deep path lists still contain `.github/workflows/**`, and the actual classifier still enables both lanes for a manual-workflow-only synthetic revision.

## Completion criteria and claim limits

- Both focused RED states are observed for the missing behavior.
- The minimum configuration and workflow changes make the focused tests GREEN.
- Full relevant deterministic verification passes once on the settled tree.
- Three non-overlapping read-only reviews find no unresolved material defect.
- A final review packet records the exact diff, commands, results, dispositions, limitations, and recovery.

Local YAML parsing and synthetic Git execution do not prove hosted Dependabot batching, hosted Actions execution, required-check configuration, cost savings, deployment, publication, provider behavior, production safety, or security beyond the exercised contracts.
