#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "${NGRAOS_DIR:-/opt/ngraos}"
mkdir -p backups
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="backups/ngraos-${stamp}.dump"
docker compose exec -T db pg_dump -U ngraos -d ngraos --format=custom --no-owner --no-acl > "${target}.partial"
test -s "${target}.partial"
mv "${target}.partial" "$target"
sha256sum "$target" > "${target}.sha256"
printf 'Database backup created: %s\n' "$target"
# Keep 14 daily database snapshots. Credentials and source releases are separate.
find backups -maxdepth 1 -type f -name 'ngraos-*.dump*' -mtime +14 -delete
