# Cinematic arrival — 1 November 2026

The “Menuju Desa Kenderan” interlude now has a layered Bali silhouette, decorative relief, a luminous route, a cream destination marker and a warm parchment setting with a fine frame and gold accents. Phone/tablet layouts stack the heading and island; desktop and short landscape layouts place them side by side. “Desa Kenderan” and “Dari Tamiu jadi Nyama.” are retained.

The relief SVG is about 5.6 KB and reuses the existing coastline and projection. Its contour lines and mountain symbols are decorative, not elevation data. See [asset attribution](../assets.md). There is no new video, mapping SDK or runtime image-generation request.

The existing 1.9-second minimum, 1.55-second route movement, readiness signal and 620 ms exit remain unchanged. The route fallback now defers to the active journey overlay, preventing duplicate scenes and accessible headings during navigation. Focus still moves to the name form once arrival finishes; connection recovery remains available. Background music behavior is unchanged.

## Original cinematic implementation verification

- `npm run typecheck`: passed.
- Welcome, demo journey and new arrival tests: **27 passed**, with six deliberate skips for viewport/recovery cases that run once on desktop. Coverage includes desktop Chromium, phone Chromium and phone-sized WebKit.
- Explicit viewport matrix: 320×568, 375×667, 390×700, 390×844, 430×932, 760×844, 844×390, 1024×768 and 1440×900. Heading, destination label and status remain inside the viewport, no document horizontal overflow, and the destination anchor stays at the existing geographic coordinates without image letterboxing.
- English and reduced-motion tests verify a static island, hidden moving particles/traveler and focus handoff to the name form.
- Existing fixture journeys still cover name persistence/retry, Level 1 conversation, the five-question quiz, rewards and animated Level 2 unlock.
- After the final compass-position and small-screen centering polish, the arrival suite passed again: **4 passed, 2 deliberate matrix skips**.

Screenshots were visually inspected at phone, small phone, tablet, desktop and landscape sizes. These are browser-engine/viewport checks; no claim of physical iPhone or Android certification is made. This is a visual change, so no paid AI request or database schema change is required.

## Original cinematic deployment

Release **`20261101-v4.5-cinematic-arrival`** was deployed to [Ngraos!](https://ngraos.docker.anatera.app/). Docker production compilation, TypeScript and standalone secret checks passed. The deploy helper created `backups/ngraos-20261101T134059Z.dump` before replacement. No schema change was introduced.

The final public arrival/welcome suite passed **15 tests**, with six deliberate skips for viewport/recovery cases covered once on desktop. The same nine-size matrix passed against public assets. In addition, unmocked public entries passed on Chromium and WebKit: real `/api/player` response, new relief asset, finished transition, name form focused and no JavaScript page errors. The public SVG returned HTTP 200 with `image/svg+xml`, and health reported a ready database and AI configuration. No profile submission, paid AI request or learner-data write was needed for these visual checks.

## Parchment palette revision — current

**`20261101-v4.5.1-parchment-arrival`** replaces the dark blue/teal backdrop with the existing parchment base `#f5efdf`, warm cream light, forest-green text and aged-gold accents. The decorative background lines, particles, island shadow and connection-recovery panel now match that palette. Island geometry, layout, route, timing, music and focus behavior remain unchanged.

The local arrival suite passed **4 tests**, with two deliberate skips for the viewport matrix that runs once. The nine-size matrix passed and phone/desktop screenshots were visually inspected. Production build, TypeScript, standalone secret scan and health checks passed; the deploy helper created `backups/ngraos-20261101T135253Z.dump`.

The same arrival suite passed again against production: **4 passed, 2 deliberate matrix skips**. Fresh public checks confirm the computed backdrop is `rgb(245, 239, 223)`, the real entry transitions finish on Chromium and WebKit, and the name form receives focus without JavaScript page errors. The SVG returned HTTP 200 as `image/svg+xml`. No learner profile or paid AI request was created for these checks.

Current evidence: [public check results](public-verification.json), [phone](mobile.png), [desktop](desktop.png). The screenshots use real public assets; the real player response was deferred only to hold the normal intro long enough for a still capture. Interface content was not altered for the captures.
