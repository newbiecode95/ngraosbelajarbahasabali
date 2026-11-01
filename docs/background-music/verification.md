# Village background music

Release: `20261101-v4.3-village-music`.

The user's **VILLAGE - Cinematic Backsound Bali.mp3** replaces the procedural noise ambience. The complete 3:46 track is retained. The 5,433,815-byte original becomes a 1,323,584-byte Opus stream (75.6% smaller) with a 1,811,565-byte MP3 fallback (66.7% smaller). Source and output hashes, duration and encoding details are in [assets.json](assets.json). The original is not published.

## Playback contract

- A single audio element lives in the root layout, so `/` ↔ `/desa` navigation and village dashboards retain playback position and do not create overlapping players.
- No music source, preload or download occurs before user interaction, or when starting a lesson as the first action. Music streams after a gesture; it is not decoded in full into a Web Audio buffer. Audible autoplay follows [browser activation rules](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay).
- Music fades out over 180 ms and pauses when starting/resuming a game, before the lesson request finishes in the tested flow. Conversation, recording, quiz and result views remain quiet. Going back to the village, album, profile or homepage resumes the same track with a 1.4-second fade.
- Web Audio GainNode supplies fades where supported; HTML audio volume supplies a fallback. Unsupported/failed Opus delivery falls back once to MP3. Optional music failures cannot block the game or NPC speech.
- The homepage now has a 44×44 sound button. The existing village/header/settings sound control uses the same stored mute preference. Muted reloads do not fetch music. Hiding the page pauses music; returning restores it if allowed.
- Versioned audio filenames use `Cache-Control: public, max-age=31536000, immutable` and byte-range streaming. Future audio revisions must use a new filename.

## Evidence

TypeScript and the 57 applicable unit tests passed; 18 unrelated database tests were skipped in this frontend-only run. The browser regression matrix passed **31 cases with 8 explicit skips** across desktop Chromium, phone-sized Chromium and Windows WebKit. All **12 new music cases passed**, with no music capability skips. The eight skips belong to existing viewport-specific welcome checks and unavailable Windows WebKit voice-capture APIs.

The music tests use the actual compressed user-supplied audio, not a substituted tone. They verify advancing playback time, full duration, loop setting, retained audio-element identity across routes, stopped/retained position in game and quiz, measured fade gain/volume, mute persistence, codec/network fallback, failed-game recovery and visibility handling. Provider API calls are intercepted in the browser fixtures, so these checks neither consume paid AI nor alter user progress.

Manual mobile inspection at 390×844 found no horizontal overflow; sound/language controls are 44 px high and 44/62 px wide. See [mobile-control.jpg](mobile-control.jpg).

Physical Android/iOS devices remain untested; Chromium and Windows WebKit are browser-engine checks. Voice-capture capability skips are recorded explicitly and do not represent native microphone passes.

## Production

`ngraos:20261101-v4.3-village-music` is healthy at [ngraos.docker.anatera.app](https://ngraos.docker.anatera.app/). The Docker build, production TypeScript and standalone secret-exclusion checks passed. The existing deployment workflow created `backups/ngraos-20261101T075916Z.dump` before migration/seed and replacement. No schema or account changes were needed.

All **12 music tests passed again against the public HTTPS bundle**, including real Opus/MP3 decoding on Chromium desktop/mobile and Windows WebKit, playback retained across home/village/dashboard routes, game/quiz silence, return fades, stored mute, failed-game recovery and visibility handling. No music cases were skipped.

The independent [HTTP asset audit](http-assets.json) confirms exact file bytes and SHA-256 matches, the expected MIME types, immutable one-year cache headers and `206` responses for byte ranges on both formats. `/api/health` returned database/AI ready. Re-run it with `PROBE_URL=https://ngraos.docker.anatera.app node scripts/check-music.mjs`.

Manual inspection on the released homepage confirmed the Opus source playing at 31.512 seconds with the expected 226.354625-second duration and no media error. The mobile screenshot is from this public release. The pre-existing mute preference was restored after the check. Temporary server-side source/encoding files were removed; the user's original local attachment remains intact.
