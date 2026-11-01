# Demo entry and village progression

Release: `20261101-v4.4.1-demo-map`.

The public flow is **Mulai → Bali map animation → name → village map arrival at Level 1 → conversation and quiz → village map movement to the newly unlocked Level 2**. The same transition applies to later levels. The map uses the existing village illustration and the player's initial as the “Kamu” marker, without adding an unrelated character.

## Behavior

- `DEMO_ONLY=true` is the default. `/api/player` exposes the runtime mode; the public interface omits sign-in, registration, account conversion and demo sign-out. The credential API returns `403 DEMO_ONLY`. Existing account data is retained. Set `DEMO_ONLY=false` and recreate the app container to restore the existing full account interface.
- Demo identity still uses its own opaque HttpOnly/SameSite cookie and seven-day expiry. Existing Better Auth cookies are ignored in demo mode. Sessions, rewards and unlocks remain checked on the backend.
- After the introduction animation, a name form appears before the app. It retains input on failure, prevents duplicate submission and supports keyboard entry. The name is stored on the same demo profile without resetting progress.
- Migration `0002_demo_name` adds an explicit name-completion flag. A deliberately chosen “Tamiu” is distinguished from an unnamed default profile. Existing named profiles are backfilled once. No existing account, name, progress or transcript is removed.
- First arrival shows the village map with an animated personal marker moving to Men Sari's warung. Level 2 is visibly locked. The player can start chatting or explore the village first.
- Only a successful persisted `/complete` response triggers the next-map sequence. Stars, XP and quiz results appear on the map; the marker moves from Warung to Kos and Level 2 visibly unlocks. The backend rejects Level 2 before Level 1 is complete. Replayed completion requests cannot award another reward.
- Returning/refreshing named demos keeps their name and progress. Completed transition IDs are retained per player to avoid repeated result animations on stale-session resume. Reduced motion settles the marker immediately.
- Music continues on map/name screens and pauses when chatting starts, using the existing music controller. Dialog focus is contained and background scrolling is disabled while the village map is open.

## Verification

| Check | Evidence |
| --- | --- |
| TypeScript | `npm run typecheck` passed. |
| Unit and real PostgreSQL | **79 passed** across 14 suites, including name persistence, named-Tamiu handling, cookie isolation, credential lock, existing full-account auth, twenty concurrent demo identities and idempotent rewards. |
| Browser regression | **41 passed, 4 explicit viewport skips** across desktop Chromium, phone Chromium and Windows WebKit. Includes all nine new demo-flow cases, legacy full-mode continuation, homepage entry and music. |
| New flow | Name appears after the intro, no login/password controls are shown, the initial marker settles at Warung, a full conversation/five checked questions complete Level 1, the marker visibly moves to Kos, Level 2 opens, and refresh retains the named demo. |
| Real integration locally | Opt-in `demo-live.e2e.ts` passed with real OpenRouter roleplay and quiz generation, real cookies and PostgreSQL. It verifies the name, locked-before/open-after Level 2, saved quiz, one reward event across retry and retained name after refresh. Only its own disposable identity is deleted afterward. |

The local SSH database forwarder now uses the existing helper's configured connection backlog of 128, required by the simultaneous identity tests. The canonical port `55432` was restored and the standard `RUN_DB_TESTS=1 npm test` command passed all 79 tests there. Application assertions were retained.

Screenshots from the isolated fixture matrix are [initial arrival](fixture-arrival-desktop.png) and [Level 2 unlock](fixture-unlock-mobile.png). Screenshots from the real public journey are [name entry](public-name.png), [Level 1 arrival](public-level-1.png) and [Level 2 unlocked](public-level-2.png).

This is browser-engine/viewport verification, not a physical Android or iPhone certification. The real-AI run confirms integration and saved state; it does not establish native-speaker language accuracy.

## Production

`ngraos:20261101-v4.4.1-demo-map` is healthy at [ngraos.docker.anatera.app](https://ngraos.docker.anatera.app/). Production build, TypeScript, migration and standalone secret checks passed. The final deployment created `backups/ngraos-20261101T084337Z.dump` before replacement.

On the final public image, the complete real-AI browser journey passed again, including locked login, named demo cookie, actual Level 1 conversation, five scored questions, persisted rewards, animated movement to Level 2, private backend unlock enforcement and refresh. All **12 isolated public UI cases passed** across Chromium desktop/mobile and Windows WebKit, including a valid 60-character name without horizontal overflow. No new demo-flow cases were skipped. Only known disposable test identities were removed; user progress was retained.
