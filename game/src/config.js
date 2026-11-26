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

// Scoring.
export const SCORE_RING = 100;
export const SCORE_STREAK = 25;
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
export const RATING_ACE = 5000;
export const RATING_SKILLED = 3800;

// Landing envelope (mission 3, on the runway strip only).
export const LAND_MAX_VS = 7; // m/s descent at touchdown
export const LAND_MAX_SPEED = 100; // m/s at touchdown
export const CROSSWIND = 14; // m/s lateral push once past z 5000

export const MISSIONS = [
  {
    id: 1,
    name: 'RING RUN',
    brief: 'Fly through all 12 rings. Throttle with Shift / Ctrl, steer with the arrow keys or WASD. A ring pays 100, streaks pay extra, dead-centre hits pay more.',
    goal: 'Fly through 12 rings',
  },
  {
    id: 2,
    name: 'SUPPLY DROP',
    brief: 'Five villages need supplies. Press Space over a marked circle to drop a crate — it keeps your forward speed, so release a little early. 6 crates, 5 zones.',
    goal: 'Drop crates on 5 zones',
  },
  {
    id: 3,
    name: 'STORM LANDING',
    brief: 'Crosswind from the right. Bring her down on the runway: slow, level, gentle. Touch down under 100 m/s and under 7 m/s descent, inside the strip.',
    goal: 'Land on the runway',
  },
];
