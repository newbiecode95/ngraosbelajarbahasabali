#!/usr/bin/env bash
set -euo pipefail
test "$(id -u)" = 0
test -f /opt/ngraos/scripts/backup.sh
cat > /etc/systemd/system/ngraos-backup.service <<'UNIT'
[Unit]
Description=Ngraos PostgreSQL daily backup
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
WorkingDirectory=/opt/ngraos
UMask=0077
ExecStart=/bin/bash /opt/ngraos/scripts/backup.sh
TimeoutStartSec=600
UNIT
cat > /etc/systemd/system/ngraos-backup.timer <<'UNIT'
[Unit]
Description=Ngraos database backup at 03:15 Asia/Makassar

[Timer]
OnCalendar=*-*-* 19:15:00 UTC
Persistent=true
RandomizedDelaySec=300
Unit=ngraos-backup.service

[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now ngraos-backup.timer
systemctl is-active ngraos-backup.timer
