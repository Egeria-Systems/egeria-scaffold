# Dependency Update CI Cost Design

**Date:** 2026-08-13 (America/Toronto)

**Status:** Approved for bounded local implementation

## Goal

Reduce review churn and avoid expensive generated-project and compatibility-proof jobs when an update changes only an unrelated manual workflow, while preserving immutable action pins, stable required-check identities, fail-safe scope handling, dependency review, and the always-running builder/package lane.

## Decisions

### Group GitHub Actions version updates

Keep the weekly `github-actions` Dependabot ecosystem and add one `action-updates` group whose explicit `applies-to: version-updates` rule matches every action with `patterns: ["*"]`. Dependabot may therefore combine action version updates into one pull request instead of opening one pull request per action.

This changes pull-request batching only. It does not add auto-merge, loosen the full-commit-SHA policy, group npm updates, or change dependency-review severity.

### Narrow deep-job workflow ownership

Replace the broad `.github/workflows/**` entry in both deep-job path lists with the exact `.github/workflows/repository-quality.yml` path.

The repository-quality workflow remains an input to both deep lanes because it owns their commands, conditions, and execution policy. Changes to manual deployment, certification, or package-release workflows continue through the always-running `builder-and-packages` policy checks, but do not run generated-project or compatibility-proof verification solely because they are workflow files.

Revision validation and error handling remain unchanged. Missing, zero, malformed, unavailable, or unresolvable revisions and Git diff errors still run both deep lanes. Job-level skips preserve the five stable check identities.

This decision supersedes only the accepted 2026-08-12 CI design statement that every workflow-file change enables both deep jobs. The rest of that accepted design remains unchanged.

## Evidence contract

The constitution suite must:

- parse the Dependabot configuration and require the exact weekly GitHub Actions version-update group;
- execute the actual scope shell against synthetic Git history;
- prove an unrelated manual-workflow-only change disables both deep lanes;
- prove a repository-quality workflow change enables both deep lanes; and
- retain all existing invalid-revision and Git-error fail-safe scenarios.

These checks establish local configuration shape and classifier behavior. They do not prove Dependabot will create a grouped pull request, GitHub-hosted job conditions, required-check settings, or Actions billing.

## Recovery

Restore per-action Dependabot pull requests by removing the `action-updates` group. Restore the prior conservative scope by changing both exact workflow paths back to `.github/workflows/**` and reverting the matching contracts and current-state documentation. No external recovery is required for this local implementation.

## Non-goals

No action pin, npm update policy, dependency-review threshold, job identity, workflow trigger, permission, secret, environment, deployment, publication, certification, provider, cache, generated source, fixture, package, or runtime behavior changes. No staging, commit, push, pull request, workflow dispatch, merge, or GitHub setting change is authorized.
