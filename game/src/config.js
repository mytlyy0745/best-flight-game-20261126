// Sky Courier — tuning constants and mission layout.
// One file, one job: every number the world, physics and renderer agree on.
export const STEP = 1 / 60;
export const TRACK_LENGTH = 6800; // metres of track, runway ends here
export const SEG_LEN = 25; // metres per terrain segment
export const VIEW_DIST = 1500; // metres the renderer draws ahead
export const BEST_KEY = 'sky-courier-best';

// Flight envelope.
export const SPEED_MIN = 38; // m/s, below this the plane sinks
export const SPEED_MAX = 118; // m/s at full throttle
export const CLIMB_RATE = 0.42; // vertical speed per m/s of forward speed at full pitch
export const TURN_RATE = 28; // degrees of heading per second at full bank
export const MAX_ALT = 460; // metres above datum
export const LATERAL_LIMIT = 320; // metres either side of the centreline

// Fuel: 100 units. Drains faster at high throttle; landing with fuel left pays.
export const FUEL_START = 100;
export const FUEL_DRAIN_BASE = 0.12;
export const FUEL_DRAIN_THROTTLE = 0.5;

// Rings: 12 of them, mission 1. Zones: 5 drop zones, mission 2.
// Runway: flat strip mission 3 must land on.
export const RING_COUNT = 12;
export const RING_RADIUS = 30;
export const ZONE_COUNT = 5;
export const ZONE_RADIUS = 36;
export const CRATES = 6;
export const RUNWAY = { z0: 6000, z1: 6600, halfWidth: 18 };
export const MISSION_Z = { ringsEnd: 3100, zonesEnd: 5500 };

// Fun — golden rings and the balloon: risk and reward in the ring run.
// Two of the 12 rings are golden: smaller, harder to thread, worth more.
// A hot-air balloon drifts over the valley; buzzing it pays a bonus.
export const GOLDEN_RING_COUNT = 2;
export const GOLDEN_RING_RADIUS = 24; // smaller than a normal ring (30), but inside what the autopilot reliably threads (worst observed crossing error 21 m)
export const SCORE_GOLDEN_RING = 250;
export const SCORE_BALLOON_BUZZ = 150;
export const BALLOON_BUZZ_DIST = 45;
export const RING_BURST_TIME = 0.8; // seconds a hit ring keeps sparkling

// Round 6 fun — gusts, combo peaks, the wingman, near-misses.
// Gusts: slow, seeded wind in the ring run only. Two sines, so the push
// builds and fades over ~10-20 s — a pilot can see it coming and correct,
// and the autopilot crabs into it the same way it crabs the crosswind.
// Peak push is 8 m/s: felt, never unfair.
export const GUST_AMP1 = 5;
export const GUST_AMP2 = 3;
export const GUST_FREQ1 = 0.35;
export const GUST_FREQ2 = 0.13;
export const GUST_STRONG = 6; // m/s — at or above this the HUD calls it a GUST
// ON FIRE: the first time a streak peaks — 6 rings in a row, or 4 zones
// in a row — it pays a bonus once per mission, with a fanfare.
export const SCORE_ON_FIRE = 50;
export const ON_FIRE_RING_STREAK = 6;
export const ON_FIRE_ZONE_STREAK = 4;
// Near-miss: thread the bird flock close enough to ruffle feathers.
export const SCORE_NEAR_MISS = 25;
export const NEAR_MISS_DIST = 15;
// The wingman: a second plane flies formation beside you for a stretch
// of the ring run, then peels off and is gone.
export const WINGMAN_Z0 = 700;
export const WINGMAN_Z1 = 2200;

// Round 9 gameplay — sky crates in the ring run, and a windy drop run.
// Sky crates: floating supply crates off the ring line. Grabbing one is
// a route choice — deviate from the rings for +75, or hold the line.
// Drop wind: a seeded lateral wind through the drop run. Crates drift
// sideways as they fall, so the pilot releases upwind; a crate that
// lands within 10 m of a zone centre is a BULLSEYE.
export const SKY_CRATE_COUNT = 3;
export const SKY_CRATE_RADIUS = 20; // metres, 3D distance to collect
export const SCORE_SKY_CRATE = 75;
export const DROP_WIND_MAX = 6; // m/s lateral push on falling crates
export const SCORE_BULLSEYE = 100;
export const BULLSEYE_DIST = 10; // metres from zone centre, both axes

// Scoring.
export const SCORE_RING = 100;
export const SCORE_STREAK = 30; // was 25: a clean run of rings is the
// skill the game rewards most, so the streak now pays more per ring.
export const SCORE_ZONE = 250;
export const SCORE_LAND_BASE = 400;
export const SCORE_LAND_CENTER = 300;
export const SCORE_LAND_SMOOTH = 200;

// New scoring depth — every one of these is earned by flying well:
// precision rings, escalating zone streaks, perfect missions, par times,
// and a greased landing. A great run can clear 5000; the ceiling is ~7300.
export const SCORE_RING_PRECISION = 25; // ring hit within 8 m of centre
export const RING_PRECISION_DIST = 8;
export const SCORE_ZONE_STREAK = 50; // each consecutive zone pays +50 more
export const SCORE_PERFECT_RINGS = 300; // all rings in mission 1
export const SCORE_PERFECT_ZONES = 300; // all zones in mission 2
export const SCORE_TIME_RINGS = 200; // mission 1 inside par time
export const SCORE_TIME_ZONES = 200; // mission 2 inside par time
export const SCORE_TIME_LAND = 200; // mission 3 inside par time
export const TIME_PAR_RINGS = 45; // seconds, from mission start
export const TIME_PAR_ZONES = 50;
export const TIME_PAR_LAND = 45;
export const SCORE_GREASED = 250; // touchdown gentle, centred, no damage
export const LAND_GREASED_VS = 3.5; // m/s descent at touchdown

// Ratings shown on the win screen.
export const RATING_LEGEND = 6500;
export const RATING_ACE = 5000;
export const RATING_SKILLED = 3800;

// Resub gameplay depth — bonuses the main.js scorer pays on top of the
// world rules. Every one of them is earned by flying well, never by
// surviving: a speed ring needs 100+ m/s through the ring, a surgeon
// streak needs consecutive dead-centre threads, sharpshooter needs
// consecutive bullseyes, clean sweep needs every sky crate, untouched
// needs a whole flight with no crash and no damage. The autopilot
// flies at 88 m/s and takes only near-line crates, so it earns almost
// none of these — they are the human skill ceiling, not free points.
export const SCORE_SPEED_RING = 50; // ring threaded at 100+ m/s
export const SPEED_RING_MIN = 100; // m/s at the ring crossing
export const SCORE_SURGEON = 25; // per ring in a dead-centre streak (2nd+)
export const SCORE_SHARPSHOOTER = 50; // per bullseye in a streak (2nd+)
export const SCORE_CLEAN_SWEEP = 150; // every sky crate in mission 1
export const SCORE_UNTOUCHED = 200; // landed, no retry, no damage

// Landing envelope (mission 3, on the runway strip only).
export const LAND_MAX_VS = 7; // m/s descent at touchdown
export const LAND_MAX_SPEED = 100; // m/s at touchdown
export const CROSSWIND = 14; // m/s lateral push once past z 5000

export const MISSIONS = [
  {
    id: 1,
    name: 'RING RUN',
    brief: 'Fly through all 12 rings. Two are GOLDEN — smaller, worth 250. A balloon drifts over the valley: buzz it for +150. Supply crates float off the ring line: grab one for +75, all three for a CLEAN SWEEP +150 — but don\'t miss the next ring. Watch the wind — gusts push you sideways, and a wingman flies formation with you for a stretch. Throttle with Shift / Ctrl, steer with the arrow keys or WASD. Rings pay 100, streaks pay extra, dead-centre hits pay more — thread one dead centre twice in a row for a SURGEON bonus, or flat out at 100+ m/s for FULL SEND +50.',
    goal: 'Fly through 12 rings',
  },
  {
    id: 2,
    name: 'SUPPLY DROP',
    brief: 'Five villages need supplies. Press Space over a marked circle to drop a crate — it keeps your forward speed, so release a little early. A crosswind drifts the crates sideways: watch the DROP WIND meter and release upwind. Land one within 10 m of the centre for a BULLSEYE +100 — two bullseyes in a row pays SHARPSHOOTER. Hold B for the speed brake to slow for the release. 6 crates, 5 zones.',
    goal: 'Drop crates on 5 zones',
  },
  {
    id: 3,
    name: 'STORM LANDING',
    brief: 'Crosswind from the right. Bring her down on the runway: slow, level, gentle. Touch down under 100 m/s and under 7 m/s descent, inside the strip. Hold B for the speed brake on final. A whole flight with no crash and no damage pays UNTOUCHED +200.',
    goal: 'Land on the runway',
  },
];
