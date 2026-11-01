# Guided gameplay — 20261101-v4-guided-gameplay

The latest task adds persistent step instructions and optional sourced phrase examples, the mobile learning path, immediate saved quiz feedback, and direct next/replay. TypeScript and **53 unit/PostgreSQL checks** passed. Current browser, deployment and visual evidence is in [guided gameplay verification](gameplay-guide/README.md); the [visual QA report](../design-qa.md) compares all four supplied mockup screens. Results below are historical measurements, not fresh load or latency guarantees.

# Gameplay and UI revision — 20261031-v2.2-ux

The current revision adds natural contextual dialogue, flexible objective matching, automatic voice submission/playback, still character portraits, clearer copy, Desa Kenderan, and consistent responsive layouts. **39/39 unit/database tests**, **21 browser tests** passed; six browser cases were skipped as documented. All four lessons passed real-provider conversation and quiz probes. See the [audit report](gameplay-audit/README.md) and its conversation transcripts for current evidence.

The benchmarks and deployment checks below describe the original release, retained as historical evidence; they are not new performance measurements for the revised dialogue prompt.

---

# Release verification — 2026-10-31

Release **20261031-v1.1** is deployed at **https://ngraos.docker.anatera.app** after the final input-size hardening patch. This report separates application behavior, provider integration, language consistency and physical-device validation.

## Passed

| Check | Evidence |
|---|---|
| Production build and TypeScript | Next.js standalone built successfully locally and inside Docker. Postbuild removes any copied environment files. |
| Unit and database integration | **34/34** tests across eight files passed, including bounded chunked request handling. Test files run sequentially because they share a remote database tunnel; concurrency is exercised inside the tests. |
| Concurrent persistence | 20 independent players, 60 turns, hints, quizzes, rewards, cookie ownership and duplicate requests passed against real PostgreSQL, with AI mocked. A separate saturated 25-connection pool regression passed. |
| Concurrent real AI | **20/20** live sessions completed mission, quiz, reward and refresh through public HTTPS with real OpenRouter. Zero failed requests or retries, exactly 20 reward events, and matching saved XP/stars/albums. The test also replayed completions concurrently and verified private quiz keys were not exposed. |
| Browser matrix | **18 passed, 3 capability skips, 0 failed**. Chromium desktop/mobile and Windows WebKit mobile UI. See [browser report notes](../tests/e2e/README.md). |
| All four lessons with real AI | Warung, Kos, Pasar and Boss reached three objectives, five-question quiz, saved rewards and unlocks through real OpenRouter calls. |
| Quiz grounding | A deliberate real mistake generated four linked questions. Error-free sessions produced reinforcement only. Unsupported corrections cannot reduce stars; answer-revealing prompts are rejected. |
| Accounts and privacy | Signup, sign-in, sign-out invalidation, deletion, cross-account 404 and non-admin 403 passed both locally and through public HTTPS. |
| Audio | Primary and validated fallback Gemini TTS return playable WAV. Synthetic WebM/Opus and MP4/AAC uploads passed FFmpeg normalization, real transcription, transcript confirmation, roleplay and authorized WAV playback in production. |
| Browser audio | Chromium recorded and played its advertised WebM/Opus and MP4/Opus codecs, retained editable transcript confirmation and updated the amplitude-driven character animation. |
| Failure recovery | Microphone denial/unavailability, provider failure, draft preservation, retry with the same turn ID, no fake corrections, and text fallback passed. |
| Deployment | HTTPS active, nonroot container, private database, secret exclusion, rotating logs, daily backup timer and checksum-verified restore into a disposable database passed. |
| Dependencies | `npm audit` reported zero vulnerabilities at implementation time. |

## Measured production latency

Ten sequential real GPT reply requests measured **2.711 seconds median** and **4.608 seconds p90** (nearest-rank), meeting the six-second text target in this small sample. This does not establish a production service-level guarantee or a concurrent-load percentile. An audio-roundtrip reply outside that benchmark took 6.283 seconds, so occasional slower replies remain possible.

Two synthetic transcription samples measured **3.610 and 3.132 seconds**, including request/normalization overhead. The three-second transcript target is **not yet met**. User confirmation time is excluded. Full text and audio timing records are in [production-audio.json](verification/production-audio.json); the four-level journey and model checks are in [backend.json](verification/backend.json).

Under **20 simultaneous real-AI sessions**, text replies measured **5.072 seconds median / 7.415 seconds p90**; quiz generation p90 was **7.258 seconds**. All 20 completed successfully with no retries, but the six-second text target was **not met consistently at that load**. See [production-load.json](verification/production-load.json). The prior load run is retained as evidence: gameplay and database writes succeeded, but an order-sensitive JSON comparison in the test harness incorrectly failed replay assertions. The corrected run uses structural equality and passed.

## Limits and follow-up validation

- **Physical Android Chrome and iOS Safari microphones remain untested.** Playwright is viewport/engine simulation. Windows WebKit exposes none of the microphone, MediaRecorder or AudioContext APIs, so its three media cases were explicitly skipped. Chromium media tests use synthesized sound, never the user's private microphone.
- The content was source-backed and cross-checked by a separate AI model. **280 of 285 candidates** passed the recorded consistency check; five questionable senses remain drafts. This is not an accuracy score, native-speaker validation or an expert claim.
- API usage records include actual provider/model, latency and tokens where returned. The dashboard sums provider-reported costs; binary audio responses may omit cost metadata, so reconcile with OpenRouter billing.
- Backups are on the same physical server disk. Recovery from complete disk loss needs a separate user-selected backup destination.
- Email/password authentication is complete. Email delivery for password-reset/verification is not configured; administrator access uses explicitly configured existing user UUIDs, never first-signup promotion.

The public demo can be reset without affecting a personal account. Production secrets, temporary recordings and test authentication cookies are absent from these reports. Test accounts and temporary audio created for integration checks were removed after verification.
