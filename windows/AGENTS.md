# Windows AGENTS.md

PowerShell endpoint agent: Acrylic DNS Proxy, Windows Firewall, Task Scheduler automation, browser-extension rollout, and a unified CLI in `OpenPath.ps1`.

## Structure

- `lib/DNS.psm1`: Acrylic install/config/runtime helpers
- `lib/Firewall.psm1`: outbound DNS firewall policy
- `lib/Browser*.psm1`: Firefox/Chromium policy and staged artifact handling
- `lib/Services.psm1`: scheduled task registration and status
- `lib/Common.psm1`: shared config, logging, enrollment, and self-update helpers
- `OpenPath.ps1`: operator CLI (`status`, `update`, `health`, `doctor`, `self-update`, `enroll`, `rotate-token`, `restart`)
- `Install-OpenPath.ps1`: bootstrap/install flow
- `Uninstall-OpenPath.ps1`: cleanup/removal flow
- `scripts/Pre-Install-Validation.ps1`: machine readiness checks
- `scripts/Enroll-Machine.ps1`: classroom enrollment helper

## Conventions

- use approved PowerShell verbs
- keep parameters PascalCase and validated
- prefer shared helpers in `lib/` over duplicating logic in installers/scripts
- use structured warnings/errors rather than ad hoc output for control flow

`Write-Host` is acceptable for operator-facing CLI/install output in this repo; do not use it as a substitute for reusable logging or testable control flow.

## Verification

```powershell
.\scripts\Pre-Install-Validation.ps1
Invoke-Pester -Path tests\
```

Use targeted browser and rollout tests under `windows/tests/` when touching Firefox/Chromium policy paths, scheduled tasks, or enrollment/self-update behavior.

## Anti-Patterns

- hardcoded filesystem locations when `$OpenPathRoot` or helper functions already exist
- duplicate enrollment or self-update logic outside shared modules
- changing scheduled task or firewall naming without updating tests
