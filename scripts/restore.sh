#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "${NGRAOS_DIR:-/opt/ngraos}"
mode="${1:-}"
backup="${2:-}"
if [[ "$mode" != '--verify' && "$mode" != '--restore' ]] || [[ ! -f "$backup" ]]; then
  printf 'Usage: %s --verify|--restore backups/ngraos-<timestamp>.dump\n' "$0" >&2
  exit 2
fi
backup="$(realpath -- "$backup")"
case "$backup" in "$(pwd)/backups/"ngraos-*.dump) ;; *) echo 'Backup must be inside the dedicated ngraos backups directory.' >&2; exit 2 ;; esac
if [[ -f "${backup}.sha256" ]]; then sha256sum --check "${backup}.sha256"; fi
if [[ "$mode" == '--verify' ]]; then
  check_db="ngraos_restore_check_$(date +%s)"
  docker compose exec -T db createdb -U ngraos "$check_db"
  trap 'docker compose exec -T db dropdb -U ngraos --if-exists "$check_db" >/dev/null' EXIT
  docker compose exec -T db pg_restore -U ngraos -d "$check_db" --no-owner --no-acl --exit-on-error < "$backup"
  docker compose exec -T db psql -U ngraos -d "$check_db" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"
  printf 'Backup restore verified in disposable database.\n'
  exit 0
fi
# An explicit --restore is destructive for this application's database only.
# Preserve a fresh backup and stop writers before restoring.
bash scripts/backup.sh
docker compose stop app
docker compose exec -T db dropdb -U ngraos --force --if-exists ngraos
docker compose exec -T db createdb -U ngraos ngraos
docker compose exec -T db pg_restore -U ngraos -d ngraos --no-owner --no-acl --exit-on-error < "$backup"
docker compose up -d app
printf 'Ngraos database restored; verify application health and learner progress.\n'
