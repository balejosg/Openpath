# OpenPath Deployment Shapes

> Status: maintained
> Applies to: self-hosted OpenPath evaluation and rollout planning
> Last verified: 2026-04-13
> Source of truth: `docs/evaluation/deployment-shapes.md`

This guide describes common ways to deploy OpenPath without prescribing a single topology.

## Shape 1: Single-Site Deployment

Best fit when one technical team owns one environment and one endpoint estate.

Typical characteristics:

- one API deployment
- one PostgreSQL backend
- endpoint agents enrolled against the same policy source
- a single operational team handling policy, upgrades, and diagnosis

This is usually the simplest path for an initial controlled rollout.

## Shape 2: Central Service With Distributed Endpoints

Best fit when policy administration is centralized but endpoints live across multiple labs, classrooms, or sites.

Typical characteristics:

- one central policy service
- multiple endpoint groups or rollout waves
- stronger need for operational naming, ownership, and staged verification

This shape increases coordination needs even when the software components stay the same.

## Shape 3: Phased Rollout

Best fit when the team wants to reduce change risk before wider deployment.

Typical phases:

- admin and operator review
- limited endpoint cohort
- blocked-resource support and diagnosis loop
- wider rollout after verification

This is usually the safest starting shape if the team is new to the platform.

## What Changes Between Shapes

The core components do not change much. What changes is operational complexity:

- number of endpoints
- rollout sequencing
- change approval model
- incident response expectations
- need for local runbooks and escalation paths

## Avoid These Assumptions

Do not assume:

- browser-only controls are enough for every endpoint scenario
- one successful test group means broad rollout is operationally ready
- the project will define your internal ownership model for you

Use this guide together with:

- [`self-hosted-prerequisites.md`](self-hosted-prerequisites.md)
- [`support-boundaries.md`](support-boundaries.md)
- [`../SECURITY-HARDENING.md`](../SECURITY-HARDENING.md)
