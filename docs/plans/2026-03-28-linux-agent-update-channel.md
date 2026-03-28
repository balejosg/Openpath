# Linux Agent Update Channel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an API-backed, package-based Linux self-update channel with a scheduled systemd wrapper and persisted update state.

**Architecture:** Linux remains package-based. The API becomes the authority for Linux agent update metadata, while the host performs the actual `.deb` installation locally. A dedicated `openpath-agent-update` wrapper/timer orchestrates unattended runs and records state without coupling OpenPath to ClassroomPath.

**Tech Stack:** TypeScript/Express, Bash, systemd, Debian packaging, BATS, Node test runner

### Task 1: Add failing Linux agent API tests

**Files:**

- Modify: `api/tests/token-delivery.test.ts`

**Steps:**

1. Add a Linux agent manifest test that expects an authenticated machine token.
2. Add a Linux agent manifest test that expects package metadata and hashes from the API.
3. Add a Linux package download test that expects bytes from a server-served `.deb`.
4. Run `npm run test:token-delivery --workspace=@openpath/api` and confirm the new Linux tests fail.

### Task 2: Add failing Linux guardrail tests

**Files:**

- Modify: `tests/linux-e2e.bats`
- Modify: `tests/install.bats`

**Steps:**

1. Add a guardrail test that expects the Linux self-update script to reference `/api/agent/linux/latest.json`.
2. Add a guardrail test that expects a dedicated `openpath-agent-update.sh` wrapper plus systemd timer/service wiring.
3. Add a guardrail test that expects `install.sh` and `build-deb.sh` to stage the new runtime script.
4. Run `bats tests/linux-e2e.bats tests/install.bats` and confirm the new tests fail.

### Task 3: Implement Linux API manifest and package endpoints

**Files:**

- Modify: `api/src/server.ts`
- Test: `api/tests/token-delivery.test.ts`

**Steps:**

1. Add Linux package discovery helpers and manifest shape in `api/src/server.ts`.
2. Add authenticated endpoints for `/api/agent/linux/latest.json` and `/api/agent/linux/package`.
3. Support configurable package staging with sane repo-local defaults.
4. Re-run `npm run test:token-delivery --workspace=@openpath/api` until green.

### Task 4: Implement Linux unattended agent wrapper/state

**Files:**

- Create: `linux/scripts/runtime/openpath-agent-update.sh`
- Modify: `linux/scripts/runtime/openpath-self-update.sh`
- Modify: `linux/scripts/runtime/openpath-cmd.sh`

**Steps:**

1. Add persisted update-state helpers and API manifest support to `openpath-self-update.sh`.
2. Implement the unattended wrapper script that records check/success/failure state.
3. Surface update-state information in `openpath status`.
4. Run the Linux guardrail tests and fix failures.

### Task 5: Wire systemd, installer, package build, and uninstall

**Files:**

- Modify: `linux/lib/services.sh`
- Modify: `linux/install.sh`
- Modify: `linux/uninstall.sh`
- Modify: `linux/scripts/build/build-deb.sh`
- Modify: `linux/debian-package/DEBIAN/postinst`

**Steps:**

1. Add `openpath-agent-update.service` and `.timer` generation and lifecycle management.
2. Ensure source installs and Debian package installs stage the new runtime script.
3. Enable/start/stop/remove the new timer alongside existing services.
4. Re-run `bats tests/linux-e2e.bats tests/install.bats tests/services.bats`.

### Task 6: Verify end-to-end

**Files:**

- Test: `api/tests/token-delivery.test.ts`
- Test: `tests/linux-e2e.bats`
- Test: `tests/install.bats`
- Test: `tests/services.bats`

**Steps:**

1. Run `npm run test:token-delivery --workspace=@openpath/api`.
2. Run `bats tests/linux-e2e.bats tests/install.bats tests/services.bats`.
3. Fix any regressions and re-run until all selected tests are green.
