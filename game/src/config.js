export const STEP = 1 / 60;
export const TRACK_LENGTH = 6800; // metres of track, runway ends here
export const SEG_LEN = 25; // metres per terrain segment
export const VIEW_DIST = 1500; // metres the renderer draws ahead
export const BEST_KEY = 'sky-courier-best';

export const SPEED_MIN = 38; // m/s, below this the plane sinks
export const SPEED_MAX = 118; // m/s at full throttle
export const CLIMB_RATE = 0.42; // vertical speed per m/s of forward speed at full pitch
export const TURN_RATE = 28; // degrees of heading per second at full bank
export const MAX_ALT = 460; // metres above datum
export const LATERAL_LIMIT = 320; // metres either side of the centreline

// Flight model (algorithms.js): stall, ground effect, layered gusts, wind ramp.
export const STALL_SPEED = 55; // m/s — below this the wing quits and she sinks
export const STALL_SINK_K = 0.029; // sink = K * (STALL_SPEED - speed)^1.5, smooth to zero at stall speed
export const GROUND_EFFECT_ALT = 8; // metres above ground where the cushion starts
export const GROUND_EFFECT_LIFT = 0.25; // fraction of sink removed at ground level
export const CRATE_TERMINAL_VS = 45; // m/s, fastest a falling crate ever drops
export const CROSSWIND_RAMP_Z0 = 5000; // crosswind builds in from here, not a step
export const CROSSWIND_RAMP_Z1 = 5600; // full crosswind from here
export const GUST_SWELL_AMP = 1.5; // m/s, slow swell under the two fast gusts
export const GUST_SWELL_FREQ = 0.05;
export const RETRY_FUEL_MIN = 40; // a retry keeps what fuel she had, at least a reserve tank
export const RING_STEP_BASE = 40; // course ramp: first legs step at most this far sideways
export const RING_STEP_INC = 4; // ...growing each ring, capped at 70
export const RING_ALT_STEP_BASE = 25; // first legs climb/dive at most this far
export const RING_ALT_STEP_INC = 1.5; // ...growing each ring, capped at 35

export const FUEL_START = 100;
export const FUEL_DRAIN_BASE = 0.12;
export const FUEL_DRAIN_THROTTLE = 0.5;

export const RING_COUNT = 12;
export const RING_RADIUS = 30;
export const ZONE_COUNT = 5;
export const ZONE_RADIUS = 36;
export const CRATES = 6;
export const RUNWAY = { z0: 6000, z1: 6600, halfWidth: 18 };
export const MISSION_Z = { ringsEnd: 3100, zonesEnd: 5500 };

export const GOLDEN_RING_COUNT = 2;
export const GOLDEN_RING_RADIUS = 24; // smaller than a normal ring (30), but inside what the autopilot reliably threads (worst observed crossing error 21 m)
export const SCORE_GOLDEN_RING = 250;
export const SCORE_BALLOON_BUZZ = 150;
export const BALLOON_BUZZ_DIST = 45;
export const RING_BURST_TIME = 0.8; // seconds a hit ring keeps sparkling

export const GUST_AMP1 = 5;
export const GUST_AMP2 = 3;
export const GUST_FREQ1 = 0.35;
export const GUST_FREQ2 = 0.13;
export const GUST_STRONG = 6; // m/s — at or above this the HUD calls it a GUST
export const SCORE_ON_FIRE = 50;
export const ON_FIRE_RING_STREAK = 6;
export const ON_FIRE_ZONE_STREAK = 4;
export const SCORE_NEAR_MISS = 25;
export const NEAR_MISS_DIST = 15;
export const WINGMAN_Z0 = 700;
export const WINGMAN_Z1 = 2200;

export const SKY_CRATE_COUNT = 3;
export const SKY_CRATE_RADIUS = 20; // metres, 3D distance to collect
export const SCORE_SKY_CRATE = 75;
export const DROP_WIND_MAX = 6; // m/s lateral push on falling crates
export const SCORE_BULLSEYE = 100;
export const BULLSEYE_DIST = 10; // metres from zone centre, both axes

export const SCORE_RING = 100;
export const SCORE_STREAK = 30; // was 25: a clean run of rings is the
export const SCORE_ZONE = 250;
export const SCORE_LAND_BASE = 400;
export const SCORE_LAND_CENTER = 300;
export const SCORE_LAND_SMOOTH = 200;

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

export const RATING_LEGEND = 6500;
export const RATING_ACE = 5000;
export const RATING_SKILLED = 3800;

export const SCORE_SPEED_RING = 50; // ring threaded at 100+ m/s
export const SPEED_RING_MIN = 100; // m/s at the ring crossing
export const SCORE_SURGEON = 25; // per ring in a dead-centre streak (2nd+)
export const SCORE_SHARPSHOOTER = 50; // per bullseye in a streak (2nd+)
export const SURGEON_CAP = 4; // streak multipliers stop growing here — skill pays, farming does not
export const SHARPSHOOTER_CAP = 4;
export const SCORE_CLEAN_SWEEP = 150; // every sky crate in mission 1
export const SCORE_UNTOUCHED = 200; // landed, no retry, no damage

// Scoring ladder, cheapest to richest: every award in the game, in one table.
export const SCORING_LADDER = [
  { award: 'Ring', pts: 100, rule: 'thread a ring' },
  { award: 'Ring streak', pts: 30, rule: '+30 per ring already in the streak' },
  { award: 'Dead centre', pts: 25, rule: 'ring hit within 8 m of centre' },
  { award: 'SURGEON', pts: 25, rule: 'per dead-centre ring in a streak of 2+, multiplier capped at x4' },
  { award: 'FULL SEND', pts: 50, rule: 'ring threaded at 100+ m/s' },
  { award: 'Golden ring', pts: 250, rule: 'smaller ring, 2 per flight' },
  { award: 'ON FIRE', pts: 50, rule: '6-ring streak, or 4-zone streak — once per mission' },
  { award: 'Sky crate', pts: 75, rule: 'grab a floating crate off the ring line' },
  { award: 'CLEAN SWEEP', pts: 150, rule: 'all 3 sky crates in one flight' },
  { award: 'Balloon buzz', pts: 150, rule: 'fly within 45 m of the balloon — once per flight' },
  { award: 'Near miss', pts: 25, rule: 'within 15 m of a bird — once per flight' },
  { award: 'Zone', pts: 250, rule: 'crate lands in a zone' },
  { award: 'Zone streak', pts: 50, rule: '+50 per zone already in the streak' },
  { award: 'BULLSEYE', pts: 100, rule: 'crate lands within 10 m of a zone centre' },
  { award: 'SHARPSHOOTER', pts: 50, rule: 'per bullseye in a streak of 2+, multiplier capped at x4' },
  { award: 'PERFECT RING RUN', pts: 300, rule: 'all 12 rings' },
  { award: 'PERFECT DROPS', pts: 300, rule: 'all 5 zones' },
  { award: 'BEAT THE CLOCK', pts: 200, rule: 'a mission inside its par time' },
  { award: 'Touchdown', pts: 400, rule: 'landed on the strip' },
  { award: 'Centreline', pts: 300, rule: 'scaled by how close to the centreline' },
  { award: 'Smooth', pts: 200, rule: 'scaled by how gentle the descent' },
  { award: 'Fuel left', pts: 2, rule: 'per unit of fuel left at touchdown' },
  { award: 'GREASED', pts: 250, rule: 'gentle, centred, undamaged touchdown' },
  { award: 'UNTOUCHED', pts: 200, rule: 'whole flight, no crash and no damage' },
];

export const LAND_MAX_VS = 7; // m/s descent at touchdown
export const LAND_MAX_SPEED = 100; // m/s at touchdown
export const CROSSWIND = 14; // m/s lateral push once past z 5000

export const MISSIONS = [
  {
    id: 1,
    name: 'RING RUN',
    brief: 'Fly through all 12 rings. Two are GOLDEN — smaller, worth 250. A balloon drifts over the valley: buzz it for +150. Supply crates float off the ring line: grab one for +75, all three for a CLEAN SWEEP +150 — but don\'t miss the next ring. Watch the wind — gusts push you sideways, and a wingman flies formation with you for a stretch. Below 55 m/s the wing quits and she sinks, so keep the speed up. Throttle with Shift / Ctrl, steer with the arrow keys or WASD. Rings pay 100, streaks pay extra, dead-centre hits pay more — thread one dead centre twice in a row for a SURGEON bonus, or flat out at 100+ m/s for FULL SEND +50.',
    goal: 'Fly through 12 rings',
  },
  {
    id: 2,
    name: 'SUPPLY DROP',
    brief: 'Five villages need supplies. Press Space over a marked circle to drop a crate — it keeps your forward speed, so release a little early, and once it leaves the bay the throttle cannot steer it. A crosswind drifts the crates sideways: watch the DROP WIND meter and release upwind. Land one within 10 m of the centre for a BULLSEYE +100 — two bullseyes in a row pays SHARPSHOOTER. Hold B for the speed brake to slow for the release. 6 crates, 5 zones.',
    goal: 'Drop crates on 5 zones',
  },
  {
    id: 3,
    name: 'STORM LANDING',
    brief: 'Crosswind from the right — it builds in gradually past 5000 m, so crab into it early and hold the centreline. Bring her down on the runway: slow, level, gentle. Touch down under 100 m/s and under 7 m/s descent, inside the strip. The ground cushions her in the last 8 m, so a gentle flare pays. Hold B for the speed brake on final. A whole flight with no crash and no damage pays UNTOUCHED +200.',
    goal: 'Land on the runway',
  },
];
