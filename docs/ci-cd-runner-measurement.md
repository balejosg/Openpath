# CI/CD Runner Measurement

> Status: maintained
> Applies to: OpenPath CI/E2E timing, artifact evidence, and controlled runner follow-up
> Last verified: 2026-04-25
> Source of truth: `docs/ci-cd-runner-measurement.md`

Use this runbook when continuing CI optimization work. It replaces temporary
planning notes as the durable place to record how OpenPath runner timing is
measured.

## What To Measure

For each representative push, record:

- OpenPath commit SHA and workflow run ID.
- Workflow conclusion and total wall-clock time.
- Per-job durations for:
  - `Windows Agent Tests (Pester)`
  - `Windows E2E`
  - `Windows Student Policy`
  - `Linux E2E`
  - `Linux Student Policy`
  - release or package workflows when they are relevant to the change.
- Whether the job waited in queue before starting.
- Runner identity for Windows jobs (`RUNNER_NAME`, `RUNNER_ENVIRONMENT`,
  `RUNNER_OS`) so queue pressure can be separated from test execution time.
- Cache signals from logs, especially npm cache hits and pre-provisioned
  Windows dependency reuse.
- Artifact evidence for diagnostic uploads when the workflow is meant to retain
  artifacts.
- Runner health after the run: runner online, not stuck busy, and reset helper
  completed.

Do not compare a cold runner provisioning sample with a warm steady-state
sample without labeling it as cold or warm.

## GitHub CLI Commands

List current main-branch workflow runs:

```bash
gh run list --repo balejosg/Openpath --branch main --limit 10 \
  --json databaseId,workflowName,headSha,status,conclusion,createdAt,updatedAt
```

Inspect one workflow run:

```bash
gh run view <run-id> --repo balejosg/Openpath \
  --json name,headSha,status,conclusion,createdAt,updatedAt,jobs
```

Compare queued versus executing time for Windows jobs:

```bash
gh run view <run-id> --repo balejosg/Openpath --json jobs \
  --jq '.jobs[] | select(.name | test("Windows")) |
    [.name,.status,.conclusion,.startedAt,.completedAt] | @tsv'
```

Inspect a specific job log for cache and artifact signals:

```bash
gh run view <run-id> --repo balejosg/Openpath --job <job-id> --log \
  | rg -n "Cache hit|Cache restored|Upload .*diagnostics|Artifact|ENOTFOUND|ETIMEDOUT"
```

List retained artifacts:

```bash
gh api repos/balejosg/Openpath/actions/runs/<run-id>/artifacts \
  --jq '.artifacts[] | [.name,.expired,.size_in_bytes,.created_at] | @tsv'
```

## Latest Controlled Windows Baseline

The latest validated OpenPath controlled Windows baseline is:

- Commit: `ecb7a69c` (`ci: restore windows runner before artifact upload`)
- E2E run: `24760799312`
- Workflow conclusion: `success`
- `Windows Student Policy`: `9m45s`
- `Windows E2E`: `3m36s`
- `Linux Student Policy`: `6m44s`
- `Linux E2E (ubuntu-22.04)`: `1m38s`
- `Linux E2E (ubuntu-24.04)`: `1m44s`
- Windows student-policy diagnostic artifact:
  `windows-student-policy-artifacts-24760799312`, retained, `1123977`
  bytes.
- Upload symptom cleared: the Windows diagnostics upload finalized in GitHub
  blob storage without `ENOTFOUND`.

The important implementation detail is the step order in
`.github/workflows/e2e-tests.yml`: `Restore self-hosted Windows runner state`
must run before `Upload Windows student-policy diagnostics`. The reset restores
external DNS before `actions/upload-artifact` contacts GitHub artifact storage.
`tests/repo-config/workflow-contracts.test.mjs` protects that ordering.

## Current Constraint Decision

The current bottleneck is Windows target-platform capacity, not local
pre-commit. The latest measurement set that motivated this decision included:

- OpenPath pre-commit with no staged files: `0.117s`.
- OpenPath `E2E Tests` run `24905419191`: `15m45s` total, with
  `Windows Student Policy` at `11m50s` and `Windows E2E` at `3m37s`.
- OpenPath `CI` run `24905419192`: `16m41s` total, while the Windows Pester
  execution itself was about `52s` and waited behind other Windows work.
- OpenPath prerelease deb/APT run `24906133675`: `7m04s`.
- OpenPath `E2E Tests` run `24923049151` published
  `windows-student-policy-timings.json`; the expensive work was not setup:
  `Build workspaces` was `4.329s`, `Install Selenium dependencies` was
  `1.790s`, and `Ensure test PostgreSQL` was `4.414s`. The two browser passes
  dominated the lane: `Run Selenium student suite (sse)` was `294.908s` and
  `Run Selenium student suite (fallback)` was `266.407s`.

Do not register a second destructive Windows runner process on the same VM while
the host has no spare RAM. That would increase contention on the current
constraint and can corrupt target-platform evidence because the Windows lanes
modify DNS, services, scheduled tasks, browser policy, and client install state.

`test-windows` remains the required `CI Success` input and stays pinned to the
self-hosted OpenPath Windows runner. `test-windows-hosted-advisory` samples
GitHub-hosted `windows-2025` capacity with the same isolated Pester helper only
on manual `workflow_dispatch` runs; it uses `continue-on-error: true`, a short
`6m` job timeout, and is intentionally outside `CI Success`. The first automatic
sample on run `24910078474` completed the Pester and summary steps, then
remained `in_progress` during hosted runner finalization until cancellation. A
second sample on run `24922725203` showed the same post-step finalization stall
even with the shorter timeout. Treat this as hosted teardown evidence, not as a
reason to put hosted Windows on the automatic push path. Promote hosted Windows
from advisory to required only after repeated manual samples show stable green
execution and no teardown or timeout pattern.

Windows Student Policy keeps full target-platform evidence on the self-hosted
runner, but only the SSE pass runs the full Selenium matrix. The fallback pass
uses the `fallback-propagation` profile to prove the behavior that differs from
SSE: blocked-page request submission, backend approval, manual/update-based
propagation, and blocked-path enforcement in the installed Windows client. This
exploits the current constraint by removing duplicate browser-matrix work while
preserving a required Windows gate.

## Decision Rules

- Optimize from repeated representative samples, not one isolated fast or slow
  run.
- Treat GitHub artifact upload failures separately from endpoint behavior when
  local diagnostic files were created and client tests passed.
- Treat a runner that is offline, stuck busy, or unable to pick up jobs as
  runner infrastructure evidence.
- Treat endpoint install, DNS, policy, or self-update failures as product or
  client evidence unless runner health checks show the runner itself failed.
- Keep self-hosted runner usage restricted to trusted repository workflows.
- Treat hosted Windows advisory failures as capacity evidence unless the Pester
  assertions themselves fail; they do not reduce the current release quality
  gate.
- Promote a hosted advisory lane only with repeated green samples from the same
  workflow shape. A single fast hosted sample is not enough evidence to remove
  target-platform self-hosted coverage.

## Remaining Optimization Questions

- Measure sustained queue pressure with the hosted advisory lane before adding
  paid Windows capacity.
- Split `windows-student-policy` into parallel SSE and fallback jobs only if the
  reduced fallback profile still leaves this lane as the workflow bottleneck.
- Consider browser-stack simplification separately from runner provisioning;
  replacing Selenium with Playwright is a larger product-test change, not a
  runner setup task.
