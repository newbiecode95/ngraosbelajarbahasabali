# Browser acceptance update — gameplay and UI revision

Latest run: **21 passed, 6 skipped, 0 failed** across desktop Chromium, mobile Chromium, and Windows WebKit. Four skips concern unavailable Windows WebKit media APIs; two skip duplicate execution of the six-width layout matrix in other projects. TypeScript and the production build pass.

New acceptance tests demonstrate a real synthetic microphone stream ending after silence, automatic transcript submission, automatic WAV playback, exactly one opening audio request, still character portraits, and the final reply completing before the learner opens the quiz. Review-before-send remains optional and is tested separately. No private microphone or paid AI is used by browser fixtures.

The layout matrix covers 320, 390, 760, 768, 1024 and 1440 pixels for map, sources, album, profile and navigation. Phone conversation controls, error recovery, source search and quiz states also inherit the revised shared layout. Physical iOS/Android microphone behavior is not certified by these tests.

Run `npm run test:e2e` against an existing dev server. Real-demo fixtures use isolated test IP identities on localhost to avoid exhausting another developer's demo bucket; public rate limits remain in place.

The implementation audit and current screenshots are in [docs/gameplay-audit](../../docs/gameplay-audit/README.md). Previous implementation results follow for historical context.

---

# Browser acceptance results

Last verified: **2026-10-31**, Windows host, Playwright **1.64.1**, local app at `http://localhost:3000` with the real PostgreSQL database.

Final run: **18 passed, 3 explicitly skipped, 0 failed** (52.5 seconds). `npx tsc --noEmit` also passed. The real-Postgres 20-player persistence acceptance suite was rerun after the transaction-client pool fix: **5/5 passed**.

| Project | Viewport | Browser checks | Native media checks |
| --- | --- | --- | --- |
| Desktop Chromium 156 | 1440 × 960 | 7 passed | Synthetic capture, codec playback, WAV player and analyser passed |
| Mobile Chromium 156 | 390 × 844 | 7 passed | Synthetic capture, codec playback, WAV player and analyser passed |
| Mobile WebKit 27.2, Windows port | 390 × 844 | 4 passed | 3 capability-dependent checks skipped; this build exposes no capture/Web Audio APIs |

The WebKit project is an engine/viewport simulation, **not a real iPhone or an iOS Safari compatibility certification**. This Windows WebKit build reports `navigator.mediaDevices`, `MediaRecorder`, `AudioContext`, and `webkitAudioContext` as undefined even on a secure localhost origin. Its `canPlayType('audio/wav')` claim does not establish working recording or analyser support. Native iOS microphone capture, codecs, audio permissions and speaker output remain unverified. The test report preserves the observed engine capabilities and the reason for each skip.

## What was exercised

- Real demo API: welcome/map, chosen nickname, new session, text mode, hint persistence, browser reload and resume of the same session. Each browser context deletes only its own new demo afterward.
- All three engines: locked locations; English settings and reload; mobile navigation; microphone permission denial leading to text input; missing microphone APIs with manual text fallback; failed turn recovery preserving the draft and reusing the same idempotency ID.
- Layout: no document/body horizontal overflow at 390 × 844 and 1440 × 960 across map, lesson, settings and album views. Full-page screenshots are attached.
- Chromium: an oscillator feeds a real `MediaStream`, `MediaRecorder` creates an actual encoded audio file, the app submits multipart audio, recording tracks are released, and a mocked transcript remains editable. The oscillator is synthetic input; no user microphone is opened.
- Chromium: an initial speech failure can be retried with a real 24 kHz PCM WAV fixture. HTML audio playback progresses, the NPC enters/exits its speaking state, and the analyser updates the mouth animation value.
- Chromium: every advertised recorder MIME in the app's candidate list was actually recorded and played. `audio/webm;codecs=opus` and `audio/webm` produced WebM/Opus; `audio/mp4` produced MP4/Opus. All three progressed through playback. `audio/ogg;codecs=opus` was not advertised by this Chromium build.

`ngraos.e2e.ts` uses the real database only for the fresh-demo persistence scenario. Other API responses are controlled browser fixtures. `media.e2e.ts` blocks all unmatched app API calls, including provider-backed endpoints. Speech-to-text output is a fixture, so these checks establish media transport/UI behavior, **not recognition or Balinese pronunciation accuracy**. No paid AI requests are made by these browser tests.

## Run

Start the application and its configured database first, then:

```sh
npx playwright install chromium webkit
npx playwright test
npx playwright show-report
```

Use `PLAYWRIGHT_BASE_URL` to select another existing test server. Keep the server running throughout the suite; a restart correctly causes a connection failure. A real-demo test consumes one demo-creation rate-limit slot per browser project, so avoid repeatedly rerunning it against the same shared development IP within an hour. Use `--grep` for focused media/UI reruns.

The HTML report is `playwright-report/index.html`; screenshots and generated test artifacts are under `test-results/e2e`. Recordings, capability probes and codec-result JSON are attached to the report. `.e2e.ts` names and the explicit Playwright `testMatch` keep these browser scenarios separate from Vitest unit/integration tests.
