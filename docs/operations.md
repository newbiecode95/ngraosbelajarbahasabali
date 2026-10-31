# Ngraos operations

Production runs at **https://ngraos.docker.anatera.app** on the authorized home server, in `/opt/ngraos`. This is a dedicated Docker Compose project. The existing Cloudflare Tunnel and Traefik serve HTTPS; they are not replaced by this stack.

## Services and data

- `app`: Node 24 / Next.js standalone, FFmpeg, UID 1000. Host port `127.0.0.1:3022`; joins the existing `coolify` proxy network and the private database network.
- `db`: PostgreSQL 17 with pgvector, private `ngraos_private` network plus a dedicated `database_access` bridge that permits Docker to publish host-loopback `127.0.0.1:55432` for authorized SSH forwarding. The database is not directly reachable from LAN or Internet.
- `migrate`: one-shot tooling image containing the release's complete dependencies, TypeScript source and migration scripts; run through the `tools` profile.
- Persistent volumes: `ngraos_postgres` for learner/auth/application state and `ngraos_media` for regenerable generated-audio cache (`MEDIA_CACHE_DIR=/app/data/audio`). Temporary learner recordings use `/tmp` and the application cleans them after processing. Backups contain database state, not temporary recordings or regenerable audio.
- Resource ceilings: app 2 CPUs / 1.5 GiB, database 1 CPU / 1 GiB, migration process 1 CPU / 768 MiB. Docker logs rotate at three 10 MiB files per service.

## Secrets and local development

Production `/opt/ngraos/.env` is mode `0600`, read by Compose at runtime and excluded from the Docker build context and source archives. Cloudflare credentials remain in the existing server-owned hosting configuration and are read only in memory by the hostname helper. Never print `docker compose config`, container environment values, or `.env` contents into shared logs; use `docker compose config --quiet` for validation.

The local ignored `.env` uses `127.0.0.1:55432`. Start the secure database tunnel with `scripts/deploy-db-tunnel.ps1`; it reads the existing DPAPI-protected SSH credentials, verifies the stored host key, and listens only on Windows loopback. It does not write the SSH password to disk or pass it in command arguments. Keep its process running while developing. Local development currently uses the dedicated Ngraos database; do not run destructive test cleanup against learner data. Use isolated test accounts and review migration behavior before a production run.

## Release procedure

1. Run typecheck, unit tests, production build and the intended browser smoke checks locally. Confirm current AI configuration with the application's smoke tool before enabling optional fallbacks.
2. From Windows run `scripts/deploy.ps1 -Release <unique-tag>`. It archives only explicit source inputs, uploads through the authorized SSH helper, and builds application and tooling images on the server. Add `-UploadOnly` to transfer reviewed source without building.
3. `scripts/deploy.sh` validates Compose, starts the database, backs up an existing schema, runs `db:migrate` and `db:seed`, then waits for application health. The regular seed is free of embedding calls; invoke an explicitly reviewed embedding job separately when needed.
4. For first publication only, after localhost health succeeds, run `bash scripts/deploy-hostname.sh --provision` on the server. This creates only the dedicated hostname, its validation records and CNAME, preserving conflicting DNS records. Check `--check` until hostname and certificate are active, then verify the public HTTPS health route and actual login/lesson flow.
5. Successful release tags are recorded in `.env` and `releases/current`; source archives and Docker image tags are retained for rollback. Deployment source archives do not contain secrets.

Updating `.env` is separate from source deployment: securely upload a prepared private environment file, install it mode `0600`, then recreate the app. Preserve the existing `POSTGRES_PASSWORD` and authentication secret when updating model keys or other configuration.

To grant administration, add the intended existing BetterAuth user UUID to `ADMIN_USER_IDS` (comma-separated) and recreate the app. `ADMIN_EMAILS` grants access only to accounts whose email is verified; an unverified signup cannot claim an administrator address. Never make a public demo account an administrator.

## Backups, restore and rollback

Run `bash scripts/backup.sh` to create a custom-format database dump plus SHA-256 checksum in `/opt/ngraos/backups`, with a 14-day retention window. Install the daily timer once using `bash scripts/deploy-backup-timer.sh`; it runs around 03:15 Asia/Makassar and catches missed runs after reboot. These backups remain on the same physical disk: disk-loss recovery requires an additional user-selected external destination.

Verify a backup without changing production data:

```sh
cd /opt/ngraos
bash scripts/restore.sh --verify backups/ngraos-<timestamp>.dump
```

The verify mode restores into a temporary database and drops only that database afterward. Test this after first deployment and after material schema changes.

To restore actual learner data, the explicit command `bash scripts/restore.sh --restore backups/ngraos-<timestamp>.dump` first saves a fresh backup, stops the app, replaces only the Ngraos database and restarts the app. Verify health, authentication and learner progress afterward. If restore fails, the app remains stopped so it cannot write to partial data.

For an application-only rollback, set `NGRAOS_RELEASE=<previous-tag>` in the server `.env` without printing its contents, then run `docker compose up -d --no-build --wait app`. Ensure the previous code is compatible with the current schema. A schema rollback requires the matching backup and explicit database restore; never assume old code can read a changed schema.

## Checks

```sh
cd /opt/ngraos
docker compose config --quiet
docker compose ps
curl --fail http://127.0.0.1:3022/api/health
curl --fail https://ngraos.docker.anatera.app/api/health
systemctl status ngraos-backup.timer --no-pager
```

Confirm microphone permission, recording, transcript correction, NPC playback, quiz completion and progress persistence through the public HTTPS site. `/api/health` verifies backend readiness; it is not proof of speech quality or complete lesson behavior. Never send personal recordings or API credentials to Telegram notifications.

## Verified release: 20261031-v2.2-ux

On 31 October 2026, this release passed Docker production build, migration and 285-entry seed, public HTTPS health, nonroot runtime/FFmpeg checks, and a scan confirming no environment files in the runtime image. A post-release database backup passed its checksum and restored successfully into a disposable database; the verification database was removed afterward. The daily backup timer is active.

The final `20261031-v2.2-ux` patch adds bounded streamed JSON input. Its public smoke check rejected an approximately 40 KB streamed request without a declared `Content-Length` with HTTP 413. The final deployment backup is `backups/ngraos-20261031T142436Z.dump`, with a verified checksum. Database restore verification was completed on the preceding release; this patch does not change the schema.

The public production probe passed synthetic WebM/Opus and MP4/AAC upload, real transcription, transcript confirmation, saved turn and protected WAV playback. Ten sequential reply samples had a 2.711-second median and 4.608-second p90. The two transcription samples took 3.610 and 3.132 seconds, slightly above the 3-second target. This is not a concurrent AI load test or verification of physical phone microphones and native-speaker accuracy. Detailed evidence is maintained in `docs/verification/production-audio.json`.

A separate production test completed 20 simultaneous real-AI journeys through session, conversation, quiz, completion and refresh, with 20 unique rewards and no failed HTTP attempts or retries. Reply median was 5.072 seconds and p90 was 7.415 seconds, above the 6-second target under that load. Fixtures were removed afterward. See `docs/verification/production-load.json` and the final delivery summary in `docs/verification.md`; performance targets that were missed are retained as limitations.

Run database test files serially against the shared development database. The local SSH tunnel helper uses an accept backlog of 128 for burst connections; restart an older helper process to activate this setting after confirming no tests or development requests are using it. Production database connections do not use the SSH tunnel.

Gameplay/UI revision 20261031-v2.2-ux: Desa Kenderan, natural conversation history, automatic voice send/playback, still portraits and responsive layout. Current evidence is in docs/gameplay-audit/README.md. Original latency samples remain historical.
