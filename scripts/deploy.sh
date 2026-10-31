#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "${NGRAOS_DIR:-/opt/ngraos}"
release="${1:-}"
if [[ ! "$release" =~ ^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$ ]]; then
  echo 'Usage: bash scripts/deploy.sh <unique-release-tag>' >&2
  exit 2
fi
test -f .env
chmod 600 .env
export NGRAOS_RELEASE="$release"
docker compose config --quiet
mkdir -p releases backups
docker compose build app migrate
docker compose up -d --wait --wait-timeout 90 db
if docker compose exec -T db psql -U ngraos -d ngraos -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public');" | grep -q t; then
  bash scripts/backup.sh
fi
docker compose run --rm --no-deps migrate npm run db:migrate
docker compose run --rm --no-deps migrate npm run db:seed
docker compose up -d --no-build --wait --wait-timeout 180 app
curl --fail --silent --show-error --retry 3 http://127.0.0.1:3022/api/health
# Persist the successful release only after health checks pass.
python3 - "$release" <<'PY'
import pathlib, sys
p=pathlib.Path('.env')
lines=[line for line in p.read_text().splitlines() if not line.startswith('NGRAOS_RELEASE=')]
lines.append('NGRAOS_RELEASE='+sys.argv[1])
p.write_text('\n'.join(lines)+'\n')
PY
printf '%s\n' "$release" > releases/current
printf '\nNgraos release %s is healthy.\n' "$release"
