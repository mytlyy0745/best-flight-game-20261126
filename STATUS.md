# STATUS — best-flight-game-20261126-0057 "Make the best flight game"

## Status: POLISHED ROUND 4, COMMITTED, READY TO SUBMIT — NOT submitted (Li: polish only, submit later)

- Competition: `best-flight-game-20261126-0057` ($500 pot, 1st $100, places 1–50 paid)
- Entries close: 2026-11-28T00:57:00Z (Nov 28 08:57 CST) · Results due: 2026-12-14T00:57:00Z
- Repo: https://github.com/mytlyy0745/best-flight-game-20261126
- Polished commit (round 4): `6059dfd966850e525485d84dd63edc56cd62c9ec` on `main` (confirmed via `git ls-remote`)
- Previous commit (round 3): `00e5f79ac0c885e5c5a35f4febddb0b9a685805`

## Round 4 polish (2026-11-26, Li: "再打磨，增加游戏趣味性" — gameplay fun; polish only, do NOT submit)

### Gameplay fun (the point of this round)
- **Golden rings**: 2 of the 12 rings are golden — smaller (r 24 vs 30), worth 250 instead of 100, gold with twinkling sparkles. Seeded mid-course (never the first ring), reachable from the ring before. Streak and precision still stack on top. A golden ring is a visible risk/reward decision in every run.
- **Combo meter**: the current ring/zone streak shows under the mission banner as "COMBO xN" (gold at x4+, orange at x6+) once it reaches 2; best combo is shown on the win screen ("Best combo: x12" verified). The ring chime climbs in pitch with the streak (and adds a third note at x4+) so a hot streak sounds hot.
- **Ring-hit bursts**: for 0.8 s after threading a ring, an expanding golden ripple and sparkles bloom off it — the payoff you feel. Visible in the staged play shot (a golden ring just hit, ripple mid-bloom).
- **Hot-air balloon**: a striped balloon drifts over the valley in the ring run (seeded position, slow sway). Buzz within 45 m for +150, once per flight ("BALLOON BUZZ +150", happy arpeggio). It fires on some seeds (7, 1, 5) and not others — a positional bonus, not a given.
- **Bird flock**: five birds cross the valley, drifting across the track and flapping as they go (seeded, deterministic in time). Pure life — they never hurt the plane, but flying through the flock is a thrill worth watching for.
- **Dusk landing**: mission 3 now flies at dusk — violet sky up top, deep orange horizon, the sun low and large over the strip. The day ends as she comes home; the landing shot reads warm and distinct from the daytime missions.

### Fix found by testing
- Golden rings at r 20 were right at the autopilot's accuracy limit: seed 13 missed one by 21 m and fell to 5851. Traced the worst crossing error across all 20 seeds (21 m) and set the golden radius to 24 m — still visibly smaller than a normal ring, now inside what a well-flown run reliably threads. After the fix every seed hits both golden rings.

## Verification (round 4, all in this session)
- Headless playtest (`/tmp/test-flight.mjs`, 20 seeds, all deterministic): **7251–7476 — every seed 12/12 rings, 5/5 zones, landed**. Best 7476 (seed 5), worst 7251 (seeds 21, 2, 23, 31), seed 7 (screenshot seed): 7426. Floor rose from 6925 (round 3) to 7251; ceiling now ~7600 (was ~7300). All deterministic (two runs identical).
- Balloon buzz check (`/tmp/test-balloon.mjs`): fires on seeds 7, 1, 5; maxCombo 12 on every seed.
- Fairness (`/tmp/test-fairness.mjs`): no input → crash, score 0; full dive → crash, score 0; full climb → crash, score 0. Not a free win.
- Screenshots: regenerated with headless Chrome at 1280×720 JPEG q82, all ≤256 KiB (88/83/77/58 KiB), all 4 visually inspected — golden ring + "GOLDEN RING +300" + "COMBO x3" + burst ripple in the play shot; dusk sky and low sun in the land shot; title and drop shots clean. Win screen staged separately and inspected: "LEGEND OF THE SKIES", final score 7426, "Best combo: x12", "TOUCHDOWN! +1101 GREASED +250 BEAT THE CLOCK +200".
- Live game page loaded in headless Chrome, zero page errors (only headless-environment dbus noise). `node --check` clean on every game file, main.ts, serve.ts.
- `MAKEFUN_OUTPUT_DIR=out1/out2 node main.ts` → byte-identical outputs (`diff -r` clean); dossier.json 503,472 bytes (< 1.5 MiB).
- No external URLs in `game/` / main.ts (only `http://localhost` in serve.ts, the local dev server). Static files only, no libraries.

## To submit (when Li says so)
- Bundle this polish session's transcripts with the kit CLI, then submit `--competition best-flight-game-20261126-0057 --repo-url https://github.com/mytlyy0745/best-flight-game-20261126 --commit 6059dfd966850e525485d84dd63edc56cd62c9ec --title "Sky Courier" --bundle <file> --keypair <file>`.
- No entry fee (entry_fee null). Verify live via `GET /api/agents/me` (stage scored, 0 failed checks).
- Test scripts (not committed): `/tmp/test-flight.mjs`, `/tmp/test-fairness.mjs`, `/tmp/test-balloon.mjs`, `/tmp/debug-seed13.mjs`, `/tmp/debug-golden.mjs`, `/tmp/capture-shots.sh`, `/tmp/live-check.sh`.

## Round 3 polish (2026-11-26, kept for reference)

### Visuals (screenshot judging — fresh-eyes pass on all 4 shots)
- **Patchwork fields (biggest win)**: each ground band now carries 2–3 irregular field plots in different crop colours (12-colour palette incl. ploughed brown and straw) with hedgerow edges, so the ground reads as a patchwork of fields instead of full-width stripes. Tall near bands are split horizontally (hedgerow line + darker lower half) inside the *visible* part of the band, so a huge foreground band does not read as one flat slab.
- **Horizon haze**: a soft pale veil straddling the horizon melts the hard line where flat ground meets sky and gives the far world atmosphere.
- **Mountains**: far range lightened for atmospheric perspective (rgba(110,136,162,0.62)), snow caps bigger (34×11) and more numerous, plus a faint lit ridge edge — the peaks now read as snowy mountains, not flat waves.
- **Trees**: conifers are now 3 stacked tiers (lightest at the top) with colour variety, round-canopy trees got a second crown, and every tree casts a soft ground shadow — big near pines read as pines instead of flat triangles.
- **Runway**: threshold bars (8 white bars at the strip start), mown grass shoulder beside the strip, mowing stripes on the airfield grass, and — the foreground fix — **tyre marks**: two dark wheel tracks down the strip. Found by tracing: the landing shot's brown foreground slab *is* the asphalt itself (at 8 m the strip is wider than the screen, so it fills the frame); the tyre marks give it texture where nothing else can read.
- **Title overlay** lightened 0.45 → 0.38 so the world shows through more; plane got a red cheatline under the blue registration stripe and a slightly stronger prop disc.
- No scoring or rules changes (the autopilot already maxes everything; ceiling ~7300).

### Debugging note (worth knowing)
- Two rounds of magenta diagnostics were used to find why the landing foreground stayed flat: the split *was* executing, but the first version placed the split at a fraction of the band's full height, which lands below the frame for tall bands (fixed by splitting inside the visible height), and the foreground slab turned out to be the asphalt strip itself, not grass — hence tyre marks, not more grass texture. Diagnostics were removed before committing; the committed code is clean.

## Verification (round 3, all in this session)
- Headless playtest (`/tmp/test-flight.mjs`, 20 seeds, all deterministic): **6925–7051 — every seed 12/12 rings, 5/5 zones, landed**. Best 7051 (seed 99), worst 6925 (seed 21), seed 7 (screenshot seed): 6951. Unchanged from round 2 (render-only changes; no rules touched).
- Fairness (`/tmp/test-fairness.mjs`): no input → crash, score 0; full dive → crash, score 0; full climb → crash, score 0. Not a free win.
- Screenshots: regenerated with headless Chrome at 1280×720 JPEG q82, all ≤256 KiB (83/82/74/59 KiB), all 4 visually inspected — patchwork, snow caps, haze, layered trees, threshold bars, tyre marks all confirmed. Live game page loaded in headless Chrome and renders the title screen correctly.
- `node --check` clean on every game file, main.ts, serve.ts.
- `MAKEFUN_OUTPUT_DIR=out1/out2 node main.ts` → byte-identical outputs (`diff -r` clean); dossier.json 483,500 bytes (< 1.5 MiB).
- No external URLs in `game/` / main.ts (only `http://localhost` in serve.ts, the local dev server). Static files only, no libraries.

## To submit (when Li says so)
- Bundle this polish session's transcripts with the kit CLI, then submit `--competition best-flight-game-20261126-0057 --repo-url https://github.com/mytlyy0745/best-flight-game-20261126 --commit 00e5f79ac0c885e5c5a35f4e2c3546e31d76aef4 --title "Sky Courier" --bundle <file> --keypair <file>`.
- No entry fee (entry_fee null). Verify live via `GET /api/agents/me` (stage scored, 0 failed checks).
- Test scripts (not committed): `/tmp/test-flight.mjs`, `/tmp/test-fairness.mjs`, `/tmp/debug-land-geo.mjs`, `/tmp/capture-shots.sh`, `/tmp/live-check.sh`.

## Round 2 polish (2026-11-26, kept for reference)

### Visuals (screenshot judging)
- **Ground texture**: each terrain band now gets top-to-bottom shading plus plough-furrow dashes, so fields read as worked farmland instead of flat stacked paint (visible in all 4 screenshots).
- **Runway rework (biggest fix)**: the airfield band is now grass; the strip is a proper asphalt strip drawn per band with correct perspective. Centreline is now world-space dashes (20 m paint / 30 m gap) with clamped widths, edge lines thin. The old unclamped line widths turned into giant white blocks when the camera got low over the strip — that is what the big white rectangles in the old 4-land shot were. The landing shot now reads as a real runway: green grass, grey strip, thin dashed centreline, amber edge lights, approach light bar.
- **Drop zones**: unhit zones now have a vertical amber light beam (fading with height, capped on screen) so targets read from far away instead of being a faint ellipse on the ground.
- **Clouds**: shaded undersides, so puffs read as volumes instead of flat white stickers.
- **HUD**: the NEXT RING / NEXT ZONE / runway guidance labels now sit on a dark backing pill, so they stay readable over trees and clouds (the old 3-drop label was half-hidden by a tree cluster).
- **Win screen**: new `?shot=win` staging mode in shots.js (flies the full course to a landing) — used to verify the new rating renders.

### Gameplay / scoring
- **Drop-run fairness (the real fix)**: first zone moved to 700 m past the ring run's end (was 600 m, zones now 3800/4200/4600/5000/5400, spacing 400 m), and zone lateral steps cut to ±80 m (was ±110 m). Root cause found by tracing seed 4: the plane leaves the rings high (~200 m) and the first zone's release point sits ~200 m ahead of it — with only 600 m the plane was still descending when the release window passed, because the predicted landing point stalls while descending. A human player has the same problem, so this is a genuine course fix, not autopilot tuning.
- **New rating**: LEGEND OF THE SKIES at 6500+ (config RATING_LEGEND; win screen shows it — verified in the staged win shot, final score 6951).
- Scoring ceiling unchanged (~7300); the floor rose instead.

## Verification (round 2, all in this session)
- Headless playtest (`/tmp/test-flight.mjs`, 20 seeds, all deterministic): **6925–7051 — every seed 12/12 rings, 5/5 zones, landed**. Worst seed now 6925 (was 5825 with 3/5 zones). Best 7051 (seed 99). Seed 7 (screenshot seed): 6951.
- Fairness (`/tmp/test-fairness.mjs`): no input → crash, score 0; full dive → crash, score 0; full climb → crash, score 0. Not a free win.
- Screenshots: regenerated with headless Chrome at 1280×720 JPEG q82, all ≤256 KiB (83/78/71/53 KiB), all 4 visually inspected — ground furrows, zone beam, runway strip, readable labels all confirmed. Win screen captured separately and inspected (LEGEND OF THE SKIES, final score 6951).
- Browser: 5 page loads (play/drop/land/start/win), zero console errors.
- `node --check` clean on every game file, main.ts, serve.ts.
- `MAKEFUN_OUTPUT_DIR=out1/out2 node main.ts` → byte-identical outputs (`diff -r` clean); dossier.json 457,526 bytes (< 1.5 MiB).
- No external URLs in `game/` / main.ts (only `http://localhost` in serve.ts, the local dev server). Static files only, no libraries.

## To submit (when Li says so)
- Bundle this polish session's transcripts with the kit CLI, then submit `--competition best-flight-game-20261126-0057 --repo-url https://github.com/mytlyy0745/best-flight-game-20261126 --commit de1fb52da83adf3f9785c224b3d70f35136acb51 --title "Sky Courier" --bundle <file> --keypair <file>`.
- No entry fee (entry_fee null). Verify live via `GET /api/agents/me` (stage scored, 0 failed checks).
- Test scripts (not committed): `/tmp/test-flight.mjs`, `/tmp/test-fairness.mjs`, `/tmp/debug-zones.mjs`, `/tmp/debug-seed4.mjs`, `/tmp/capture-shots.sh`.

## Round 1 polish (2026-11-26, kept for reference)

### Scoring depth (the 5000+ target)
- Rings 10 → 12, with reachable steps (lateral ≤70 m, climb ≤35 m between rings).
- Dead-centre ring hit (<8 m from centre): +25. All 12 rings: +300 perfect bonus.
- Zones pay an escalating streak: 250, 300, 350, 400, 450. All 5 zones: +300 perfect bonus. Flying past a zone breaks the streak.
- Par-time bonus +200 per mission (45 s rings / 50 s drops / 45 s landing), gated on actually flying the mission (6+ rings, 3+ zones) so drifting through earns nothing.
- Greased landing +250 (descent ≤3.5 m/s, centred within half the strip, no damage).
- Ratings: ACE 5000+, SKILLED PILOT 3800+ (was 3800/2800).
- Scoring ceiling ≈ 7300. A great run clears 5000; a passive run scores 0.

### Course fairness fixes (found by tracing the autopilot)
- `nextZone()` now skips zones already flown past (was aiming at zones behind the plane → 0/5 zones on some seeds).
- First drop zone anchors near the ring run's exit x, and sits 600 m past the rings (was 200 m): the plane leaves the rings high and fast and needs that room to descend before the first release point.
- Drop release window widened to the zone's own radius; autopilot descends faster (wantVs −28) and flies the drop run slower (72 m/s).

### Visuals (screenshot judging)
- Terrain: winding river (seeded path), lane beside the track, cross-road near the village, hedgerows, 9 field colours, village of 8 houses, woods clusters with round-canopy trees, runway taxiway + amber edge lights, approach light bar, windsock, hangar.
- Sky/aircraft: snow caps on the far peaks, bigger cumulus clouds, propeller blur disc, wingtip contrails at speed, wing leading-edge highlights, brighter canopy glint.
- HUD: mission banner + score on a dark panel (clouds can no longer wash it out); clouds kept out of the top strip; title overlay lightened 0.62 → 0.45.

## Verification (round 1, kept for reference)
- Headless playtest (`/tmp/test-flight.mjs`, autopilot drives the real rules, retries on crash): 16 seeds, ALL above 5000, all deterministic (two runs identical):
  - seed 7 (screenshot seed): 6951 — 12/12 rings, 5/5 zones, landed, fuel 69
  - seed 42: 6975 · seed 99: 7051 · seed 1234: 7001 · seed 2026: 6951 · seed 555: 6976
  - seed 1 (worst): 5825 — 12/12 rings, 3/5 zones · seed 3: 6276 · seed 5: 7001 · seed 11: 7001 · seed 77: 7025 · seed 13: 6951 · seed 21: 6925 · seed 2: 6976 · seed 4: 6275
  - Before polish: 3226–3725 (ceiling ~4300, could never reach 5000).
- Fairness (`/tmp/test-fairness.mjs`): no input → crash, score 0; full dive → crash, score 0; full climb → crash, score 0. Not a free win.
- Screenshots: regenerated with headless Chrome (Playwright shell) at 1280×720 JPEG q82, all ≤256 KiB, all 4 visually inspected (ring run, title, drop, short final). HUD readable on all four.
- Browser: all 5 page loads (4 staged shots + live game) in headless Chrome, zero console errors.
- `node --check` clean on every game file, main.ts, serve.ts.
- `MAKEFUN_OUTPUT_DIR=out1/out2 node main.ts` → byte-identical outputs (`diff -r` clean); dossier.json 427,659 bytes (< 1.5 MiB); out total 763,582 bytes, 14 files.
- No external URLs anywhere in `game/` / main.ts / serve.ts. Static files only, no libraries.
