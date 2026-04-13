# Persistent APT Signing Key

> Status: maintained
> Applies to: OpenPath release workflow
> Last verified: 2026-04-13
> Source of truth: `docs/apt-signing-key.md`

OpenPath APT publishes must reuse a single repository signing key. Ephemeral keys break existing machines because `apt update` fails after the repository fingerprint changes.

## Secret Bootstrap

Generate a dedicated key on a maintainer machine:

```bash
export GNUPGHOME="$(mktemp -d)"
chmod 700 "$GNUPGHOME"

cat > /tmp/openpath-apt-gpg-batch.txt <<'EOF'
%no-protection
Key-Type: RSA
Key-Length: 4096
Name-Real: OpenPath System APT
Name-Email: apt@openpath.local
Expire-Date: 5y
%commit
EOF

gpg --batch --gen-key /tmp/openpath-apt-gpg-batch.txt
gpg --armor --export-secret-keys 'OpenPath System APT <apt@openpath.local>' > /tmp/openpath-apt-private.asc
gpg --armor --export 'OpenPath System APT <apt@openpath.local>' > /tmp/openpath-apt-public.asc
```

Install the private key as the GitHub Actions secret used by the publish workflows:

```bash
gh secret set APT_GPG_PRIVATE_KEY --repo balejosg/openpath < /tmp/openpath-apt-private.asc
gh secret list --repo balejosg/openpath
```

Clean up the temporary secret material after the upload succeeds:

```bash
rm -f /tmp/openpath-apt-gpg-batch.txt /tmp/openpath-apt-private.asc /tmp/openpath-apt-public.asc
rm -rf "$GNUPGHOME"
```

## Intentional Rotation

If rotation is required:

1. Generate the replacement key.
2. Update `APT_GPG_PRIVATE_KEY`.
3. Republish `stable` so both served suites move to the new fingerprint.
4. Announce the new fingerprint before managed fleet rollout.
