# HANDOFF — best-flight-game-20261126-0057 "Make the best flight game"

## Entry

- Competition: `best-flight-game-20261126-0057` ($500 pot, 1st $100, places 1–50 paid)
- Entries close: 2026-11-28T00:57:00Z · Results due: 2026-12-14T00:57:00Z
- Repo: https://github.com/mytlyy0745/best-flight-game-20261126 (public, created 2026-11-26T01:57:28Z — after the 00:57:00Z opening)
- Commit: `c90a8deb1be10fe150f7bc3668c021b0457dc509` on `main` (confirmed via `git ls-remote`)
- **POLISHED ROUND 4 2026-11-26 (Li: "再打磨，增加游戏趣味性" — gameplay fun; polish only, do NOT submit yet): new commit `6059dfd966850e525485d84dd63edc56cd62c9ec` on `main` (confirmed via `git ls-remote`). See STATUS.md for the full round-4 report. Golden rings (2×, 250 pts), combo meter + climbing chime, ring-hit bursts, balloon buzz bonus (+150), bird flock, dusk landing. Staged playtests 7251–7476 across 20 seeds (was 6925–7051).**
- **POLISHED ROUND 3 2026-11-26 (Li: "继续打磨", polish only, do NOT submit yet): new commit `00e5f79ac0c885e5c5a35f4e2c3546e31d76aef4` on `main` (confirmed via `git ls-remote`). See STATUS.md for the full round-3 report. Patchwork fields, horizon haze, snowy mountains, layered trees, runway tyre marks + threshold + mow stripes. Staged playtests unchanged 6925–7051 across 20 seeds (render-only changes).**
- **POLISHED ROUND 2 2026-11-26 (Li: "继续优化打磨", polish only, do NOT submit yet): commit `de1fb52da83adf3f9785c224b3d70f35136acb51` on `main`. See STATUS.md. Staged playtests 6925–7051 across 20 seeds (was 5825–7051), every seed 12/12 rings, 5/5 zones, landed. Ground texture, runway rework, zone beams, LEGEND tier (6500+), fairer drop run.**
- **POLISHED ROUND 1 2026-11-26 (Li: more scoring points, push past 5000; polish only, do NOT submit yet): commit `f8651e67611d2899ae8a35f4febddb0b9a685805` on `main`. See STATUS.md. Staged playtests 5825–7051 across 16 seeds (was 3226–3725).**
- Repo About: homepage https://make.fun/bounty/best-flight-game-20261126-0057, topics makefun, ai-agents, bounties, games
- Builder agent id: `bd62016f-278c-46b3-a997-073fd4793aa3`
- **NOT submitted.** Parent run bundles transcripts and submits.

## The game — Sky Courier

Original pseudo-3D chase-view flight game, plain 2D canvas, no libraries, no network, static files under `game/`. Three sorties back to back:

1. **Ring Run** — fly through 10 rings over farmland (100 pts each, +25 streak bonus).
2. **Supply Drop** — drop crates on 5 marked zones with Space; crates keep forward speed, so release early (250 pts each, 6 crates).
3. **Storm Landing** — land on the runway in a crosswind: under 100 m/s, under 7 m/s descent, inside the strip; scored on centreline, smoothness and fuel left (up to ~900 pts).

Controls: Arrows/WASD pitch+bank (banking turns), Shift/Ctrl throttle, Space drop/confirm, mouse hold-to-steer, P pause, M mute. HUD: ALT/SPD/HDG/VSI, fuel + hull bars, throttle, compass strip, next-target distance, mission banner, score. WebAudio engine hum, ring chimes, landing fanfare. Crash retries the failed mission, keeping banked score. Ratings: ACE (3800+), SKILLED PILOT (2800+), ROOKIE WINGS.

## Files (all written fresh in this session)

- `main.ts` — hand-in program: copies `game/` + `screenshots/` to `$MAKEFUN_OUTPUT_DIR` (or `/output`), writes `dossier.json` via kit's `buildDossier`.
- `game/index.html` + `game/src/` — `config.js` (tuning + mission layout), `random.js` (seeded RNG), `world.js` (terrain, rings, zones, runway, physics, missions — DOM-free), `input.js`, `audio.js`, `render.js` (pseudo-3D chase view + HUD + overlays), `shots.js` (autopilot + deterministic shot staging), `main.js` (boot/loop/screens).
- `vendor/makefun-game.ts` — kit's copy, byte-identical (sha256 dc67187521b24025ff952f8c231485a6eb92d6d71d29edd2a08154ffb4376129).
- `screenshots/` — 4 real renders, 1280×720 JPEG q82, each ≤ 256 KiB: `1-play.jpg` (ring run, cover), `2-start.jpg` (title), `3-drop.jpg` (supply drop), `4-land.jpg` (short final over the runway).
- `README.md` (from the live readme_template; all three badges, referral code 89k0z65b), `LICENSE` (MIT, kit's), `serve.ts`, `shots.json`.

## Verification results

- **Headless playtest** (`/tmp/test-flight.mjs`, drives the real world rules with the shots autopilot): seed 7 — 10/10 rings, 3/5 zones, landed, score 3725; seed 42 — 10/10 rings, 2/5 zones, landed, score 3226. Two runs, same seed → byte-identical results (deterministic). No-input flight crashes (overshoot), full dive crashes (terrain strike) — the game is not a free win.
- **Kit check**: `MAKEFUN_OUTPUT_DIR=out1 node main.ts` and `...=out2` — outputs byte-identical (`diff -r` clean). dossier.json 426,910 bytes (< 1.5 MiB cap); out total 758,636 bytes; game/ 54,617 bytes, 10 files; index.html 822 bytes.
- **Browser**: served locally, all 8 JS modules 200, `node --check` clean on every game file, no `Uncaught` errors in headless-Chrome console (only unrelated SODA updater noise), no external URLs anywhere in `game/`. All 4 screenshots visually inspected: ring + plane + lit HUD (cover), title panel, drop zone ahead, runway with centreline on final.
- Bugs found and fixed during validation: landing float (proportional glide controller never touched down), crosswind not accounted for in the autopilot's heading (drifted off the strip), crate drop dumping all 6 crates at once (no cooldown), drop prediction ignoring ground height (crates fell short), ring spacing too tight for the climb rate.

## Session files (work dir)

- `~/workspace/make-fun/best-flight-game-20261126/prompt.txt` — opening prompt, verbatim
- `~/workspace/make-fun/best-flight-game-20261126/HANDOFF.md` — this file
- `~/workspace/make-fun/best-flight-game-20261126/kit/` + `kit.zip` — downloaded kit (not committed)
- Repo files: `main.ts`, `serve.ts`, `shots.json`, `README.md`, `LICENSE`, `.gitignore`, `game/`, `screenshots/`, `vendor/`
- Test scripts (not committed): `/tmp/test-flight.mjs`, `/tmp/debug-land.mjs`

## For the parent (submit step)

- Bundle transcripts for this session + parent chain (`node cli/makefun.mjs bundle` from the unpacked kit), then `submit --competition best-flight-game-20261126-0057 --repo-url https://github.com/mytlyy0745/best-flight-game-20261126 --commit 6059dfd966850e525485d84dd63edc56cd62c9ec --title "Sky Courier" --bundle <file> --keypair <file>`.
- No entry fee (entry_fee null). Verify the submission live via `/api/agents/me` (stage scored, 0 failed checks).
