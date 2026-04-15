#!/bin/bash

# Free port 53 (stop systemd-resolved)
free_port_53() {
    log "Freeing port 53..."

    # Stop systemd-resolved socket and service
    systemctl stop systemd-resolved.socket 2>/dev/null || true
    systemctl disable systemd-resolved.socket 2>/dev/null || true
    systemctl stop systemd-resolved 2>/dev/null || true
    systemctl disable systemd-resolved 2>/dev/null || true

    # Wait for port to be released
    local retries=30
    while [ $retries -gt 0 ]; do
        if ! ss -tulpn 2>/dev/null | grep -q ":53 "; then
            log "✓ Port 53 freed"
            return 0
        fi
        sleep 1
        retries=$((retries - 1))
    done

    log "⚠ Port 53 still occupied after 30 seconds"
    return 1
}

# Configure /etc/resolv.conf to use local dnsmasq
configure_resolv_conf() {
    log "Configuring /etc/resolv.conf..."

    # Unprotect if protected
    chattr -i /etc/resolv.conf 2>/dev/null || true

    # Backup if symlink
    if [ -L /etc/resolv.conf ]; then
        local target
        target=$(readlink -f /etc/resolv.conf)
        echo "$target" > "$CONFIG_DIR/resolv.conf.symlink.backup"
        rm -f /etc/resolv.conf
    elif [ -f /etc/resolv.conf ]; then
        cp /etc/resolv.conf "$CONFIG_DIR/resolv.conf.backup"
    fi

    cat > /etc/resolv.conf << 'EOF'
# Generado por openpath
# DNS local (dnsmasq)
nameserver 127.0.0.1
options edns0 trust-ad
search lan
EOF

    chattr +i /etc/resolv.conf 2>/dev/null || true

    log "✓ /etc/resolv.conf configured"
}

# Configure upstream DNS for dnsmasq
configure_upstream_dns() {
    log "Configuring upstream DNS..."

    mkdir -p /run/dnsmasq

    PRIMARY_DNS=$(detect_primary_dns)

    echo "$PRIMARY_DNS" > "$ORIGINAL_DNS_FILE"

    cat > /run/dnsmasq/resolv.conf << EOF
# DNS upstream para dnsmasq
nameserver $PRIMARY_DNS
nameserver ${FALLBACK_DNS_SECONDARY:-8.8.4.4}
EOF

    log "✓ Upstream DNS configured: $PRIMARY_DNS"
}

# Create DNS upstream initialization script
create_dns_init_script() {
    local fallback_primary="${FALLBACK_DNS_PRIMARY:-8.8.8.8}"
    local fallback_secondary="${FALLBACK_DNS_SECONDARY:-8.8.4.4}"

    cat > "$SCRIPTS_DIR/dnsmasq-init-resolv.sh" << EOF
#!/bin/bash
# Regenerate /run/dnsmasq/resolv.conf on each boot

FALLBACK_DNS_PRIMARY="${fallback_primary}"
FALLBACK_DNS_SECONDARY="${fallback_secondary}"

mkdir -p /run/dnsmasq

if [ -f /var/lib/openpath/original-dns.conf ]; then
    PRIMARY_DNS=\$(cat /var/lib/openpath/original-dns.conf | head -1)
else
    if command -v nmcli >/dev/null 2>&1; then
        PRIMARY_DNS=\$(nmcli dev show 2>/dev/null | grep -i "IP4.DNS\[1\]" | awk '{print \$2}' | head -1)
    fi
    [ -z "\$PRIMARY_DNS" ] && PRIMARY_DNS=\$(ip route | grep default | awk '{print \$3}' | head -1)
    [ -z "\$PRIMARY_DNS" ] && PRIMARY_DNS="\$FALLBACK_DNS_PRIMARY"
fi

cat > /run/dnsmasq/resolv.conf << DNSEOF
nameserver \$PRIMARY_DNS
nameserver \$FALLBACK_DNS_SECONDARY
DNSEOF

echo "dnsmasq-init-resolv: DNS upstream configurado a \$PRIMARY_DNS"
EOF
    chmod +x "$SCRIPTS_DIR/dnsmasq-init-resolv.sh"
}

# Create tmpfiles.d config for /run/dnsmasq
create_tmpfiles_config() {
    cat > /etc/tmpfiles.d/openpath-dnsmasq.conf << 'EOF'
# Create /run/dnsmasq directory on each boot
d /run/dnsmasq 0755 root root -
EOF
}

# Restore original DNS
restore_dns() {
    log "Restoring original DNS..."

    chattr -i /etc/resolv.conf 2>/dev/null || true

    if [ -f "$CONFIG_DIR/resolv.conf.symlink.backup" ]; then
        local target
        target=$(cat "$CONFIG_DIR/resolv.conf.symlink.backup")
        ln -sf "$target" /etc/resolv.conf
    elif [ -f "$CONFIG_DIR/resolv.conf.backup" ]; then
        cp "$CONFIG_DIR/resolv.conf.backup" /etc/resolv.conf
    else
        cat > /etc/resolv.conf << EOF
nameserver 8.8.8.8
nameserver 8.8.4.4
EOF
    fi

    systemctl enable systemd-resolved 2>/dev/null || true
    systemctl start systemd-resolved 2>/dev/null || true

    log "✓ DNS restored"
}
