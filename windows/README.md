# OpenPath Windows Agent

> Status: maintained
> Applies to: `windows/`
> Last verified: 2026-04-13
> Source of truth: `windows/README.md`

The Windows agent enforces OpenPath policy with Acrylic DNS Proxy, Windows Firewall, scheduled tasks, browser policy rollout, and an operator CLI entrypoint at `OpenPath.ps1`.

## Installation

Run as Administrator:

```powershell
.\Install-OpenPath.ps1 -WhitelistUrl "http://your-server:3000/export/group.txt"
```

Supported classroom-oriented install patterns include:

```powershell
.\Install-OpenPath.ps1 -ApiUrl "https://api.example.com" -ClassroomId "<classroom-id>" -EnrollmentToken "<token>" -Unattended
.\Install-OpenPath.ps1 -WhitelistUrl "http://your-server:3000/export/group.txt" -SkipPreflight
.\Install-OpenPath.ps1 -WhitelistUrl "http://your-server:3000/export/group.txt" -Verbose
```

The installer stages browser-extension artifacts when present and registers scheduled tasks for update, watchdog, startup, SSE, and agent self-update flows.

## Operational Commands

`OpenPath.ps1` currently supports:

- `status`
- `update`
- `health`
- `doctor`
- `self-update`
- `enroll`
- `rotate-token`
- `restart`
- `help`

Examples:

```powershell
.\OpenPath.ps1 status
.\OpenPath.ps1 doctor browser
.\OpenPath.ps1 self-update --check
```

## Runtime Shape

Installed structure centers on `C:\OpenPath\` and includes:

- `OpenPath.ps1`
- `Install-OpenPath.ps1`
- `Uninstall-OpenPath.ps1`
- `Rotate-Token.ps1`
- `lib\*.psm1`
- `scripts\Update-OpenPath.ps1`, `scripts\Start-SSEListener.ps1`, `scripts\Test-DNSHealth.ps1`, `scripts\Enroll-Machine.ps1`
- `data\config.json`, `data\logs\`, local whitelist state
- `browser-extension\firefox`, `browser-extension\firefox-release`, `browser-extension\chromium-managed`, `browser-extension\chromium-unmanaged`

## Browser Distribution Notes

- Firefox Release auto-install requires a signed distribution via `firefoxExtensionId` + `firefoxExtensionInstallUrl` or staged `browser-extension\firefox-release\metadata.json` plus `openpath-firefox-extension.xpi`.
- Managed Chromium rollout depends on staged `browser-extension\chromium-managed\metadata.json` and the API routes documented in [`../firefox-extension/README.md`](../firefox-extension/README.md).
- Unmanaged Chromium guidance uses store URLs in `config.json` and `.url` shortcuts rather than forced install.

## Verification

```powershell
.\scripts\Pre-Install-Validation.ps1
Get-ScheduledTask -TaskName "OpenPath-*"
Get-NetFirewallRule -DisplayName "OpenPath-*"
nslookup example.com 127.0.0.1
Get-Content C:\OpenPath\data\logs\openpath.log -Tail 100
```
