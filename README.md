# Ngraos! — Dari Tamiu jadi Nyama

An interactive Balinese language adventure in **Desa Kenderan**, deployed with Docker at **https://ngraos.docker.anatera.app**. Four connected encounters take the player from a first greeting to a complete conversation: Warung Men Sari, Kos Bu Komang, Pasar Pagi, and the chapter boss.

The home page now opens with a cinematic welcome screen. Select **Mulai** to enter `/desa`; refreshing the village keeps you inside the app. See [welcome screen verification and art credits](docs/welcome/README.md).

## Implemented experience

- Illustrated 2.5D village with interactive locations, four character portraits, ambient sound, audio-reactive speaking indicators, keyboard navigation and reduced motion.
- Indonesian/English interface, email/password accounts, isolated resettable guest demos, saved sessions, and account deletion.
- Tap-to-record audio that ends after a speech pause, sends automatically, and plays NPC replies. Transcript review is optional; typing is always available. Browser recordings are normalized with FFmpeg and deleted after processing. No pronunciation score is invented.
- OpenRouter roleplay, source-grounded corrections, three authored objectives per location, five-question quizzes with traceable mistake/reinforcement origins, and server-controlled scoring.
- Visible task directions, optional saved phrase examples, a mobile learning path, immediate saved quiz feedback, and direct next/replay actions. See [guided gameplay and mockup comparisons](docs/gameplay-guide/README.md).
- Atomic reward events, best stars, XP, WITA streaks, unlocks and Album Desa cards. Retry and concurrent-tab protection is enforced in PostgreSQL.
- Searchable sourced learning material, privacy disclosure, reports, and an access-controlled admin panel for material availability, reports, model configuration and usage.

## Run locally

Requires Node.js 24, PostgreSQL 17 with pgvector, and FFmpeg on PATH (or `FFMPEG_PATH`). Copy `.env.example` to `.env` and set the database, authentication secret and OpenRouter key. Production secrets are never included in source archives or images.

```sh
npm ci
npm run db:migrate
npm run db:seed
npm run ai:check
npm run dev
```

The existing Windows checkout already has an ignored environment file and a secure SSH database tunnel. See [operations](docs/operations.md) before changing database settings. Do not overwrite the existing production database password or authentication secret.

```sh
npm run typecheck
npm test
# With the dedicated PostgreSQL instance available:
# PowerShell: $env:RUN_DB_TESTS='1'; npm test
# POSIX: RUN_DB_TESTS=1 npm test
npx playwright install chromium webkit
npm run test:e2e
npm run build
```

Database tests create and remove only their own isolated fixtures. Browser tests expect an already-running dev server; set `PLAYWRIGHT_BASE_URL` to another deployment when appropriate. Mocked provider tests do not establish real-world language accuracy or live-provider concurrency performance.

## AI and content

All runtime AI traffic uses server-side `OPENROUTER_API_KEY`. Default models are GPT-6.1 Sol for dialogue/quizzes, Gemini 3.8 Flash for transcription and cross-checking, Gemini 3.8 Flash TTS for character voices, and OpenAI text-embedding-3-large at 1536 dimensions. Model settings live in `src/server/config.ts` and can be overridden by environment variables. Flash-Lite TTS fallback is gated by explicit enablement and a completed validation check.

The content contains 200 dictionary candidates, 13 short teaching notes and 72 practice variants. A separate recorded Gemini review accepted 280 entries; five questionable senses remain drafts and cannot be used for grading. Read [content provenance and licensing](src/content/README.md). AI consistency checks are not native-speaker or expert validation. Unknown register remains unknown; unsupported suggestions cannot reduce stars.

The database is authoritative for turns, objective evidence, errors, quizzes and rewards. JSON Schema strict outputs are validated again by the backend and repaired at most once. Technical failures do not become learning mistakes. Speech failures preserve the visible text reply. Public phrase audio may be cached; personalized replies are not cached on disk.

## Deployment and verification

See [operations](docs/operations.md) for source deployment, TLS routing, model checks, daily backups, restore verification, administrator access and rollback. See [verification](docs/verification.md) for measured results and limitations. Images and procedural ambience are documented in [asset credits](docs/assets.md).

No public registration of a third-party hosting service is required. Everything runs in the dedicated `/opt/ngraos` Docker stack on the home server. Future scope (later chapters, spaced repetition and social features) is intentionally outside this release.
Current UI audit and responsive fixes: [docs/ui-review/README.md](docs/ui-review/README.md).
Latest phone conversation and unexpected-script correction: [docs/mobile-fix/README.md](docs/mobile-fix/README.md).
