# Village entrance and music credit — 2 November 2026

The first village route now begins on the lower-left footpath marked in the user's reference image, at `(100, 470)` in the existing `1000 × 625` map coordinates. It follows the path into Warung Men Sari at `(220, 312)`. The avatar's initial position and the route share the same entrance constant. Subsequent routes and lesson unlocks are unchanged.

Settings → Learning experience now includes a Music credit section with **VILLAGE – Cinematic Backsound Bali**, **Sugi Art**, and a direct link to [the official YouTube upload](https://www.youtube.com/watch?v=XvUbSTLZXJo). Artist and title were checked against YouTube search metadata and YouTube's oEmbed endpoint. The original local MP3 did not expose artist/title text frames. No playback behavior, audio files, secrets or user progress is changed.

## Verification

- TypeScript passed. The first browser invocation could not connect because the local dev server was stopped; after starting it, all **9 targeted browser cases passed** across desktop Chromium, mobile Chromium and phone-sized WebKit.
- Coverage checks the lower-left SVG route origin, the avatar reaching Warung, name retry/reduced motion, the complete Level 1 conversation/quiz/unlock flow, and music attribution in Indonesian and English.
- The public fixture captures use the deployed JS/CSS/images with isolated API responses, avoiding paid AI requests and learner-data changes. A 320 px width check found no document horizontal overflow or JavaScript page errors.
- Against production, **8 cases passed initially**; one WebKit reload stayed on the existing loading screen past the unchanged 10-second assertion. That exact case passed on a single isolated rerun without code or assertion changes. All nine targeted cases have a passing result; the transient reload timeout is retained here rather than reported as a clean first run.
- Visual evidence: [entry path](entrance-route.png), [music credit](music-credit.png), and [public capture checks](entrance-credit-public.json). The village image was decoded before its still capture.

## Deployment

Release `20261102-v4.6-village-entry-credit` passed the production build, TypeScript, standalone secret scan, migration/seed and health checks. The deploy helper created `backups/ngraos-20261102T150417Z.dump`. No database schema or stored progress changes were introduced.
