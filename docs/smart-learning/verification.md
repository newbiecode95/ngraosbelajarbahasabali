# Smart missions, contextual choices and quiz recording

Release: `20261101-v4.2.1-smart-learning` — 1 November 2026.

The learner can express a mission in natural Balinese, Indonesian, English or a mixture, confirm the resulting progress, then take a source-backed quiz. Repeat recording stops after a speech pause and leaves an editable transcript; scoring still requires **Periksa jawaban**.

## Changes

- Replaced the model-evidence AND phrase-regex gate with grounded semantic evidence plus an independent fallback for clear communicative acts. Evidence must quote the actual learner and reference an allowed lesson objective. NPC text supplies context only. Positive evidence spanning punctuation is supported; translation requests, score commands and negated purchases are excluded.
- Fruit quantities work in either word order, with classifier variations, digits and contextual short replies. Money amounts are not treated as fruit counts. Existing active sessions reconcile missed clear acts when resumed, without adding turns, consuming hints or issuing rewards.
- Multiple choice uses server-controlled contrast scenarios and reviewed alternatives: same fruit/different quantity, different fruit/same sentence, hometown versus workplace, or greeting plus thanks. Equivalent spellings and overlapping dictionary meanings are excluded as distractors. Generated and fallback quizzes use the same checks and shuffled alternatives.
- At least four exercises use real mistakes when suitable material exists. A lone single-word cognate without a fair choice contrast supplies three repeat exercises plus two explicitly labelled reinforcement exercises, preserving all three question types without fabricating an error or an impossible word-order exercise.
- Enabled the existing voice activity detector in quiz recording: 1.5 seconds of silence after speech, 9 seconds without speech, and the existing 30-second maximum. Missing analyser support retains manual stopping. The UI reports recording/transcribing state and prevents scoring while capture is active.

## Verification

| Boundary | Evidence |
| --- | --- |
| TypeScript | `npm run typecheck` passed. |
| Rules and persistence | `RUN_DB_TESTS=1 npm test`: **75 passed** across 12 files. Real PostgreSQL checks cover isolation, concurrent retries/rewards, missed-market recovery and no duplicate turns. |
| Choice grounding | Tests cover all 280 non-draft corpus candidates as correction targets, all three exercise types, real mistake links, answer privacy, sourced options and synonym exclusions. These are consistency checks, not expert language validation. |
| Browser flow | **23 passed, 4 capability skips** across Chromium desktop/mobile and Windows WebKit. Includes guided conversation, next/replay, saved Kos/Pasar/Boss continuation, and quiz recording. |
| Quiz capture | Synthetic audio proves pause auto-stop without a stop click, editable transcription without auto-submission, silent capture without a transcription request, manual fallback, and stopped capture tracks. No private microphone was used. |
| Real AI and HTTP | Two disposable market journeys each reach 3/3, generate five questions with all three types, preserve private keys, complete rewards, and survive duplicate requests with exactly one reward event. Both localhost and public HTTPS passed: [local report](live-http-local.json), [public report](live-http.json). |
| Manual UI | An Indonesian Kos introduction completes origin and work in one turn. The contextual hometown/workplace question fits a 390×844 viewport with no horizontal overflow. See [contextual-quiz-mobile.jpg](contextual-quiz-mobile.jpg). |
| Public capture regression | Against the deployed HTTPS bundle: **6 passed, 3 capability skips**, covering speech-pause stop, silent capture and manual fallback on Chromium desktop/mobile. The [editable transcript](quiz-transcript-mobile.png) remains ungraded until explicitly checked. |

The live probe caught a quote-grounding bug involving a comma in a full-sentence evidence quote. After fixing it, both “mau beli pisang dua buku” and “Yang pisang itu sepasang buat bekal kami, Pak.” fulfilled the market quantity target. Automated regressions retain both cases.

Existing saved quizzes and graded answers are retained. Newly generated quizzes use the improved choices. Active missed missions reconcile when opened again. No user transcript or account was modified by the disposable HTTP checks; their own test identities were deleted afterward.

Physical Android/iOS microphone testing remains outside this host's capabilities. Windows WebKit does not expose the capture APIs and is explicitly skipped for audio tests. Language evidence remains source/AI consistency checking, not native-speaker certification.

## Deployment verification

`ngraos:20261101-v4.2.1-smart-learning` is healthy at [ngraos.docker.anatera.app](https://ngraos.docker.anatera.app/). Docker production build and TypeScript passed; standalone secret exclusion passed. A database backup was created at `backups/ngraos-20261101T073107Z.dump` before migration/seed and container replacement. Existing database schema and user rewards remain intact.

Public `/api/health` returned `status=ok`, `database=ready`, `aiReady=true`. The fresh public page reported no browser errors. Both real-AI HTTPS journeys and the deployed-bundle recording matrix passed after the final release. Disposable HTTP players and their data were deleted after each run.
