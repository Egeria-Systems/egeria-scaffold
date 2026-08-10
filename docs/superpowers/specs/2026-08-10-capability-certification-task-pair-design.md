# Capability Certification Task-Pair Design

**Date:** 2026-08-10

**Status:** Approved for roadmap-only materialization

## Goal

Make capability certification a mandatory, separately approved task for every new or materially changed executable capability, while requiring each certification task to discover and explain any human account, credential, provider, staging, cost, and cleanup prerequisites during its own planning phase.

## Task-pair contract

Every capability delivery consists of two independently reviewable tasks:

1. a capability implementation task; and
2. a capability certification task that follows the accepted implementation.

Implementation approval does not imply certification. A capability or phase cannot close, and a capability cannot be advertised as certified, until its certification task has produced the required local evidence and any conditionally required protected-staging or provider evidence.

The certification task always starts with preparation and exact-file planning. It then generates or transforms the smallest supported project with the compiled CLI, verifies desired/installed/inferred state, installs and builds the exact result, and runs the affected local browser, runtime, integration, migration, removal, and recovery checks. External-provider or persistent-state evidence remains separate and explicitly approval-gated.

## Human-prerequisite runbook

Each capability-certification plan must give the user current, step-by-step instructions for any required external setup. The plan must state either that no human setup is required or identify:

- the official sources and date used;
- required account, subscription tier, sandbox or test environment;
- exact resources, roles, and least-privilege permissions;
- credential names, scopes, lifetime, rotation, and approved storage location without recording values;
- callback, webhook, redirect, domain, or allowlist configuration;
- synthetic identities and test data;
- quotas, rate limits, possible spend, retention, and waiting periods;
- a non-secret readiness preflight;
- exact cleanup, deletion, revocation, rotation, rollback, and recovery steps; and
- which actions belong to the user, which may be automated after approval, and every external-action stop gate.

This amendment introduces no new provider-specific outcome scenario and does not freeze provider setup instructions. Existing canonical outcome boundaries remain controlling; each certification task derives current setup steps and its exact executable scenarios from official documentation during Gate 1 and freezes them only in that task's approved plan.

## Sequencing

- A new P2 Task 5B follows the implemented Calendly task and owns `booking-calendly` certification plus the smallest reusable fresh-scaffold certification foundation justified by that concrete capability.
- P3 extends the foundation to compiled-CLI addition, upgrade, migration, removal, refusal, and recovery journeys and performs a one-time coverage backfill for already accepted executable capabilities. Existing valid evidence may be mapped without rerunning unchanged expensive checks; missing evidence becomes a separate certification task.
- From P4 onward, every new or materially changed executable capability automatically receives its certification sibling task before the next dependent capability or phase gate.
- P10 risk-selected fleet reruns supplement rather than replace original capability certification.

## Planned enforcement

The certification foundation will introduce a repository-owned coverage registry keyed by executable capability identifier. Each active record will bind its certification subject to the descriptor version or behavior-contract digest. Descriptor admission will require a pending certification record linked to the separate certification task, and every material change will replace stale active coverage with a new task-linked pending record while retaining history. Phase and release closure will reject any ordinary record that remains pending instead of certified. Existing pre-foundation descriptors receive an explicit `backfill-pending` treatment; these records are exempt from P2 closure without being certified, then P3 closure rejects any that the evidence backfill has not reconciled. Multiple capabilities may share a generated scenario only when the scenario records causal assertions for each mapped capability; registry presence alone is not proof.

Until that executable gate exists, the source plan, concise program roadmap, review protocol, and enforcement map own the planned task-pair and planning contracts. Documentation changes do not claim that the future runner, registry, staging setup, provider account, credentials, or provider result already exists.

## Non-goals

This amendment does not implement a certification runner, create capability scenarios, create accounts or provider resources, request or store credentials, deploy, contact providers, spend money, mutate persistent data, or rerun existing expensive verification.
