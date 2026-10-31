# Welcome screen — Ngraos

The public home page at `/` introduces Ngraos before the application. The learning village now lives at `/desa`; direct visits and refreshes at that address keep the player inside the application.

The welcome includes the purpose of Ngraos, the preserved “Dari Tamiu jadi Nyama” headline, three short playing instructions, and a primary **Mulai / Begin** button. Indonesian and English are available. The existing locale preference is retained.

The new illustrated gateway uses local WebP assets, a forest/ivory/gold palette, Cormorant Garamond display type, subtle light particles and pointer parallax on capable desktop devices. On entry the scene advances toward the village, the copy fades, warm light fills the frame and the application appears. Reduced-motion and saved motion preferences use a short, quiet transition instead. No sound starts automatically on the welcome screen.

The application route is prefetched. Buttons wait for client readiness, repeated activation is blocked, and the screen restores its entry state on Back navigation. Navigation uses the normal Next.js router and browser history.

## Verification

The dedicated browser checks cover:

- Purpose, all three instructions, loaded artwork and the entry button.
- The visible transition state followed by arrival in the actual village.
- Refresh staying in the application, and Back allowing entry again.
- English, keyboard activation, reduced motion and responsive widths 320–1440 px.

The existing gameplay/browser suite was updated to use `/desa` and remains part of regression checking. No AI provider calls are required by the welcome screen or its tests.

Asset locations, generation method, exact prompt and font credits are in [artwork.md](artwork.md).

## Release results

Release **20261031-v3-welcome** is live. Final local regression: **31 browser cases passed, 8 explicitly skipped, 0 failed** across Chromium desktop/mobile and Windows WebKit. Four skips concern missing WebKit media APIs; four avoid repeating explicit viewport matrices in other projects. All **39 unit/database tests** and the production build passed. The welcome itself passed purpose/instructions, animation state, entry, Back/re-entry, refresh, keyboard, English and reduced-motion checks. Public deployment health is ready.
