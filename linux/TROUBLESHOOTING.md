# OpenPath Linux Agent Troubleshooting

> Status: maintained
> Applies to: `linux/`
> Last verified: 2026-04-13
> Source of truth: `linux/TROUBLESHOOTING.md`

## First Checks

```bash
sudo openpath status
sudo openpath health
sudo openpath test
sudo openpath log 100
```

## Important Services

```bash
systemctl status dnsmasq
systemctl status openpath-dnsmasq.timer
systemctl status openpath-agent-update.timer
systemctl status dnsmasq-watchdog.timer
systemctl status captive-portal-detector.service
systemctl status openpath-sse-listener.service
```

## Common Symptoms

### DNS does not resolve

```bash
sudo systemctl restart dnsmasq
sudo openpath update
ss -ulnp | grep :53
```

### Rules changed upstream but the machine did not update

```bash
sudo systemctl restart openpath-sse-listener.service
sudo openpath update
sudo openpath force
```

### Watchdog or integrity fallback triggered

```bash
sudo openpath health
sudo openpath log 200 | grep -E 'WATCHDOG|INTEGRITY|FAIL_OPEN|STALE_FAILSAFE|TAMPERED'
ls -l /var/lib/openpath/
```

### Self-update or package rollback questions

```bash
sudo openpath self-update --check
dpkg -s openpath-dnsmasq
```

## Useful Files

- `/etc/openpath/whitelist-url.conf`
- `/etc/openpath/overrides.conf`
- `/var/lib/openpath/health-status`
- `/var/lib/openpath/watchdog-fails`
- `/var/lib/openpath/integrity.sha256`
- `/var/log/openpath.log`
- `/var/log/captive-portal-detector.log`
