# OpenPath Support Boundaries

> Status: maintained
> Applies to: self-hosted OpenPath evaluation and operator planning
> Last verified: 2026-04-13
> Source of truth: `docs/evaluation/support-boundaries.md`

This document clarifies what OpenPath provides as a project and what a self-hosting team must still own.

## What The Project Provides

This repository provides:

- the API, administration UI, endpoint agents, and browser integration
- maintained technical documentation for architecture, security, and package entrypoints
- verification commands and repository workflows for contributors
- platform-specific guidance for Linux, Windows, and browser extension flows

## What Your Team Must Still Own

A self-hosting team must still own:

- infrastructure provisioning and secrets
- backup and recovery procedures
- monitoring, alerting, and incident response
- local policy decisions and approval workflows
- endpoint rollout sequencing
- internal training and operator escalation paths

## What This Means During Evaluation

During evaluation, do not ask only whether the software works. Also ask:

- Who will operate it day to day?
- Who will investigate blocked-resource issues?
- Who controls upgrades and rollback decisions?
- Which runbooks must exist outside this repository?

## When To Create Local Runbooks

You should create local runbooks before broad rollout if you need:

- named ownership for changes and incidents
- local escalation paths
- environment-specific backup and recovery procedures
- endpoint enrollment or browser rollout steps specific to your estate

Use the project docs as the technical baseline, not as a complete substitute for local operations documentation.
