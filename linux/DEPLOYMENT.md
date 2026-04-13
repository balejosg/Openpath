# OpenPath Linux Agent Deployment

> Status: maintained
> Applies to: `linux/`
> Last verified: 2026-04-13
> Source of truth: `linux/DEPLOYMENT.md`

## Supported Delivery Paths

### 1. APT Bootstrap

The APT bootstrap flow is generated from `linux/scripts/build/apt-bootstrap.sh` and is the primary operator-facing install path for packaged Linux deployments.

Typical published usage:

```bash
curl -fsSL https://raw.githubusercontent.com/balejosg/openpath/gh-pages/apt/apt-bootstrap.sh | sudo bash
```

Useful flags supported by the bootstrap include:

- `--skip-setup`
- `--package-version <version>`

### 2. Source Installer

For local development or direct source installs:

```bash
cd linux
sudo ./install.sh
```

The installer supports explicit setup flags and an unattended mode; verify current options against `linux/install.sh` before documenting new deployment recipes.

### 3. API-Served Agent Delivery

The API exposes Linux delivery endpoints used by managed flows:

- `/api/agent/linux/manifest`
- `/api/agent/linux/packages/<version>`

## Package and Runtime Artifacts

Current Linux build/runtime pieces include:

- Debian package namespace: `openpath-dnsmasq`
- package builder: `linux/scripts/build/build-deb.sh`
- whitelist updater: `linux/scripts/runtime/openpath-update.sh`
- scheduled self-update wrapper: `linux/scripts/runtime/openpath-agent-update.sh`
- self-update engine: `linux/scripts/runtime/openpath-self-update.sh`
- watchdog: `linux/scripts/runtime/dnsmasq-watchdog.sh`
- SSE listener: `linux/scripts/runtime/openpath-sse-listener.sh`

## Deployment Verification

After deployment, verify:

```bash
sudo openpath status
sudo openpath health
sudo openpath test
systemctl status dnsmasq openpath-dnsmasq.timer openpath-agent-update.timer dnsmasq-watchdog.timer
```
