# OpenPath How-To

> Status: maintained
> Applies to: OpenPath repository
> Last verified: 2026-04-13
> Source of truth: `docs/HOWTO.md`

## Install the Linux Agent

Published APT bootstrap:

```bash
curl -fsSL https://raw.githubusercontent.com/balejosg/openpath/gh-pages/apt/apt-bootstrap.sh | sudo bash
```

Source install:

```bash
cd linux
sudo ./install.sh
sudo openpath setup
```

## Install the Windows Agent

Run as Administrator:

```powershell
.\Install-OpenPath.ps1 -WhitelistUrl "http://your-server:3000/export/group.txt"
```

Enrollment-token bootstrap:

```powershell
.\Install-OpenPath.ps1 -ApiUrl "https://api.example.com" -ClassroomId "<classroom-id>" -EnrollmentToken "<token>" -Unattended
```

The enrollment flow requires `-ApiUrl`; the installer still supports direct `-WhitelistUrl` bootstrap when you are not using API-backed enrollment.

## Run Core Services Locally

```bash
npm run dev --workspace=@openpath/api
npm run dev --workspace=@openpath/react-spa
npm run dev --workspace=@openpath/dashboard
```

## Build Extension Release Artifacts

```bash
npm run build:chromium-managed --workspace=@openpath/firefox-extension
npm run build:firefox-release --workspace=@openpath/firefox-extension -- --signed-xpi /path/to/signed.xpi
```

## Run Common Checks

```bash
npm run verify:agent
npm run verify:quick
npm run verify:docs
```

Subsystem-specific workflows are documented in the package READMEs linked from [`INDEX.md`](INDEX.md).
