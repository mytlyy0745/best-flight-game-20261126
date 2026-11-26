# best-flight-game-20261126

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/mytlyy0745/best-flight-game-20261126/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/mytlyy0745/best-flight-game-20261126/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

**Sky Courier** — a little pseudo-3D flight game in plain HTML and canvas, no libraries, no network. You fly three sorties in one small prop plane: thread 12 rings over rolling farmland — two of them are smaller golden rings worth 250, and a hot-air balloon drifts over the valley (buzz it for +150) while a flock of birds crosses the sky — drop supply crates on five marked villages (they keep your forward speed, so release early), then bring her home through a crosswind at dusk and land on the runway — slow, level and gentle, or she bounces. Throttle discipline, turning and fuel all matter: burn too much showing off in the rings and the landing gets tight. Chained hits build a combo that climbs the score and the chime with it.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser and press Space (or click) to fly.

## How to play

- **Arrows / WASD** — pitch and bank. Banking turns the plane; the compass and heading show where you are pointed.
- **Shift / Ctrl** — throttle up / down. Speed, altitude, heading and vertical speed are on the lit instruments, top left.
- **Space** — drop a supply crate (mission 2) / confirm on menus.
- **Mouse** — hold the button and steer toward the pointer.
- **P** — pause, **M** — mute.

Missions run back to back with a short brief before each. A crash retries the mission you were on, keeping the score your finished missions banked. Land all three sorties and you get a rating — ACE OF THE SKIES for 5000+ points. Your best score is kept in the browser.

## Scoring

- **Rings** — 100 each, +25 per ring of your streak; threading one dead centre pays +25 more. Two golden rings are smaller and pay 250. All 12 rings pays a +300 perfect bonus. Chained hits build a combo (shown on the HUD, best combo on the win screen) and the ring chime climbs in pitch with your streak.
- **Balloon** — buzz the drifting hot-air balloon in the ring run for +150, once per flight. Birds cross the valley too — pure life, fly through the flock for the thrill.
- **Drops** — 250 for the first zone, then 300, 350, 400, 450 as the streak builds; all five zones pays a +300 perfect bonus. Flying past a zone breaks the streak.
- **Landing** — up to ~900 for centreline, smoothness and fuel left, +250 for greasing it (gentle, centred, no damage). The sun is setting as you come in.
- **Beat the clock** — +200 per mission finished inside its par time (45 s rings, 50 s drops, 45 s landing), for a run that actually flew the mission.

A great run clears 5000; the ceiling is around 7600.

Screenshots in `screenshots/` are real renders of the game itself, staged deterministically with `?shot=start|play|drop|land&seed=7` (see `shots.json`). `main.ts` hands the game in: it copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the kit's vendored library.

---

<sub>Entered on [make.fun](https://make.fun/?ref=89k0z65b&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
