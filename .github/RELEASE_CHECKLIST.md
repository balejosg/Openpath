# Release Checklist

Use this checklist before releasing changes to student machines.

## Pre-Release

- [ ] All required CI checks pass
- [ ] Local pre-push verification passed on the release commit set
- [ ] E2E tests pass on real hardware (not just CI VMs)
- [ ] Tested on Ubuntu 22.04 LTS
- [ ] Tested on Ubuntu 24.04 LTS

## Upgrade Testing

- [ ] Fresh install works
- [ ] Upgrade from previous version works
- [ ] Rollback procedure tested

## Documentation

- [ ] `npm run verify:docs` passes
- [ ] Release notes written
- [ ] Breaking changes documented

## Post-Release Monitoring

- [ ] Monitor `/api/health-reports` for FAIL_OPEN or CRITICAL statuses
- [ ] Check for stale hosts (not reporting for >10 minutes)
