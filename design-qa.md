# Latest visual QA — one-screen welcome

final result: passed

The current change is limited to the main welcome screen and its Bali arrival transition, following the user's explicit “The main screen only” clarification. The current visual evidence, viewport checks, five fidelity surfaces, resolved issues and intentional changes from the user's phone photos are recorded in [welcome v2 QA](docs/welcome-v2/README.md). Phone and desktop captures were opened and inspected, and the actual map component's point movement was checked in Chromium and WebKit. The prior guided-gameplay comparison below is retained as historical evidence for the unchanged learning flow.

# Guided gameplay — visual QA

final result: passed

## Source and comparison setup

Source visual truth: `C:/Users/Lenovo/.codex/codex-remote-attachments/01a19227-fb7c-7241-8cad-cbc846195c18/1B9B0BFC-4075-4569-8D5B-1AEE1CB8FC8A/1-Ngraos-Mockup-Aplikasi.pdf`, all four pages. Renders are in `work/mockup-reference/page-1.png` through `page-4.png` (488 × 1055). Each source was normalized to 390 × 844 before composition with a 390 × 844 browser screenshot at density 1. No device chrome was added.

Implementation: existing Next.js application at `http://localhost:3000/desa`. Deterministic comparison captures are `docs/gameplay-guide/reference-{path,conversation,quiz,result}.png`. They use an isolated browser fixture: Pasar selected after two completed locations, an open correction, checked question 2/5, and a two-star Pasar result. These are visual fixtures, not real-provider language evidence. The source's specific phrases, character name and statistics differ from the production corpus. Compare composition and interaction state, not invented numerical fidelity.

Full-view paired inputs opened and reviewed: `docs/gameplay-guide/compare-path.png`, `compare-conversation.png`, `compare-quiz.png`, `compare-result.png` (792 × 844, source left). Focused text/card comparisons: `focus-conversation.png` and `focus-result.png` (1584 × 590). Actual-backend manual captures, separate from fixtures: `02-mission-local.jpg` through `13-desktop-map-local.jpg` in the same directory.

## Findings and fixes

- **[P1, resolved] Duplicate phone introduction hid the learning path.** First capture `01-path-local.jpg` included the previous large heading and demo strip above the new path. Phone map now uses one Tamiu identity/progress header; demo is a small identity label. Final path comparison shows the four stages and selected action without duplicate introductions. The chronological path deliberately runs from level 1 downward; the source's reverse zigzag is adapted to a clearer reading order.
- **[P2, resolved] Selected card repeated briefing text.** The initial card displayed both a mission summary and the entire location description, while the unfinished-session callout repeated two instructions. The card now shows the learning topic and start button; the resume action is one line. See `reference-path.png` and the real-progress `11-path-final-local.jpg`.
- **[P2, resolved] Long album prose clipped the unlock card at 390 × 844.** `08-result-local.jpg` shows the earlier state. Results now show the first complete album sentence, with the remaining note available through native details. `reference-result.png` and `compare-result.png` show both the unlock and persistent actions. Long notes still scroll independently of the actions. A redundant desktop demo strip is omitted during quiz/results.
- **[P2, resolved] Internal provenance wording leaked into corrections.** The first fixture displayed a long English source title. The link now reads “Lihat sumber”, preserving the actual target and title metadata. The corrected phrase has stronger weight and 16 px type; explanatory copy is 14 px. See the final conversation comparison and focused crop.
- **[P2, resolved] Hint dialog started against the top-left edge.** `03-hint-local.jpg` records this. Native dialog centering is restored with an explicit margin; `10-hint-policy-local.jpg` shows a centered, readable dialog with the star rule before revealing an example.
- **[P1, resolved; functional] Profile arrival could overwrite an explicit location choice.** A user selection now survives initial profile loading, while the first incomplete location is still selected automatically when no selection was made. Locked-location and continuation tests cover this behavior.
- **[P2, resolved; functional] A saved response could leave the goal unchanged without a visible explanation.** A short inline notice now directs the player back to the current task when no objective advances. It does not claim a language error or reduce stars. The reference-state regression verifies both its appearance and removal after progress.

No actionable P0/P1/P2 findings remain in the verified flows. Native content scrolling is intentional; persistent recording, checking, next-level and replay controls remain reachable at the tested sizes.

## Required fidelity surfaces

| Surface | Review |
| --- | --- |
| Fonts and typography | The PDF is rasterized (`/Glyphless`), so an original font name cannot be recovered. Existing locally hosted Outfit and DM Sans retain the rounded display/body distinction. Quiz headings are 26 px, dialogue 16 px, translations 14 px; corrected phrases are emphasized. The final paired crops were reviewed for wrapping and legibility. Small metadata remains secondary. |
| Spacing and layout rhythm | Cream paper, 20 px phone side margins, white answer cards, rounded feedback and green result hero follow the reference. The current task remains above independently scrolling dialogue. Quiz/result actions are persistent; phone targets are at least 44 px for primary controls. Existing desktop sidebar, village art and two-column conversation remain appropriate to the wider viewport. |
| Colors and tokens | Warm paper `#f5efe3`, forest `#2e683d`, gold `#e6aa32`, white cards and green/amber feedback preserve the reference hierarchy. Existing sage brand tokens remain in the surrounding desktop app. Incorrect answers use amber and a retry icon, plus text, rather than color alone. |
| Image quality and assets | Existing raster village/NPC art and supplied product brand are reused, with still portraits and speaking indicators. The mock's simplified Men Ayu is intentionally the existing Pak Made in Pasar. Standard map, lock, star, album and audio symbols use the established icon library. No raster artwork was replaced with CSS drawings or fake portraits. |
| Copy and content | Preserves Desa Kenderan and “Dari Tamiu jadi Nyama”. Directions are concrete, examples are optional, and progress comes from the backend. The source's expert-validation placeholder and per-answer XP sentence are omitted because they would misstate the current product. Five questions remain the authored MVP contract. No mistake is invented for an error-free session. |

## Interaction and responsive coverage

Manual chosen-browser verification with real backend: free directions → explicit sourced example → edit before sending → objective advance → five-question quiz → correct/incorrect feedback → stored reward → immediate Kos start. Protected answer playback completed without a visible error. Browser console inspection returned no errors. Desktop map and conversation were also inspected at 1440 × 960.

Automated coverage includes refresh/resume, unchanged-goal guidance, first-answer persistence, no unchecked answer leakage, all quiz types, next/replay, all four destinations, Boss without answer examples, concurrent hints/rewards, keyboard focus, reduced motion, language settings, microphone fallback and synthetic recording/playback. Sizes include 320 × 568, 390 × 844, a 390 × 380 keyboard-sized viewport, tablets and 1440 × 960. The desktop reference fixture also checks that result actions remain in view through resizing.

## Accepted differences and remaining scope

- This is a reference-based improvement to a working product, not a pixel-for-pixel reproduction. Existing characters, branding, authored corpus and truthful rewards take precedence over illustrative mock data.
- Tap-to-record, pause completion and optional transcript review remain; the reference's hold gesture is not imposed on existing users.
- NPC identity is compact in the phone header. The full illustration remains on desktop; no artificial mouth motion is introduced.
- Windows WebKit/phone viewport tests are not physical iOS or Android device certification. Browser media tests use synthetic sound. Language checks establish consistency, not native-speaker accuracy.
- P3 follow-up: the source's winding decorative path could be explored later using proper artwork if the product needs it. The current straight path keeps the learning sequence clear.

Implementation checklist: four reference states captured and paired; earlier P1/P2 issues fixed and recaptured; required fidelity surfaces inspected; functional flow verified; production deployment verification recorded separately in `docs/gameplay-guide/README.md`.
