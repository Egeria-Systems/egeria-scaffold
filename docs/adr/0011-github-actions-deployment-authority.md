# ADR-0011: GitHub Actions Deployment Authority

**Status:** Accepted

**Date:** 2026-08-04

## Context

Allowing developer machines, provider dashboards, and multiple CI systems to deploy independently would fragment audit history, permissions, environment separation, and recovery. Deployment proof also needs a clear distinction between local Next development, production-like workerd preview, non-production deployment, and production release.

## Decision

GitHub Actions is the sole deployment authority.

Local commands may build and preview for diagnostics, but they are not an authorized release path. P0.2 deploys only the approved compatibility proof to a non-production environment through GitHub Actions. It does not authorize production deployment.

Deployment workflows must:

- use environment-specific least-privilege credentials;
- keep non-production and production secrets/resources separate;
- restrict branches or refs allowed to deploy;
- use concurrency appropriate to the environment;
- record deployment status and smoke-test evidence;
- prevent self-approval where the selected GitHub plan and environment controls support it;
- verify actual protection-rule availability instead of assuming repository visibility or organization plan.

Stateful production deployments, persistent-data migrations, provider changes, and destructive operations require their own explicit human gates and recovery plans. An agent, workflow initiator, or reviewer cannot self-authorize them. Push, pull-request creation, merge, and deployment remain separate actions.

## Consequences

- Deployment history and permissions have one auditable control plane.
- Provider dashboard changes are break-glass or separately governed operations, not a parallel routine release path.
- P0.2 must prove non-production environment controls and document limitations.
- Production rollout policy can strengthen over time without changing the sole-authority decision.

## Enforcement

`INV-DEPLOYMENT-AUTHORITY` is planned for P0.2 workflow-policy, environment, credential-scope, deployment, and smoke checks. P0.1 performs no workflow creation or deployment.

GitHub documents branch restrictions, required reviewers, self-review prevention, and delayed environment-secret access in [Deployments and environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments). Availability varies by repository visibility and plan and must be verified at implementation time.
