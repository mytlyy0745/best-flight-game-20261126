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

// Rings: 10 of them, mission 1. Zones: 5 drop zones, mission 2.
// Runway: flat strip mission 3 must land on.
export const RING_COUNT = 10;
export const RING_RADIUS = 30;
export const ZONE_COUNT = 5;
export const ZONE_RADIUS = 36;
export const CRATES = 6;
export const RUNWAY = { z0: 6000, z1: 6600, halfWidth: 18 };
export const MISSION_Z = { ringsEnd: 2600, zonesEnd: 5300 };

// Scoring.
export const SCORE_RING = 100;
export const SCORE_STREAK = 25;
export const SCORE_ZONE = 250;
export const SCORE_LAND_BASE = 400;
export const SCORE_LAND_CENTER = 300;
export const SCORE_LAND_SMOOTH = 200;

// Landing envelope (mission 3, on the runway strip only).
export const LAND_MAX_VS = 7; // m/s descent at touchdown
export const LAND_MAX_SPEED = 100; // m/s at touchdown
export const CROSSWIND = 14; // m/s lateral push once past z 5000

export const MISSIONS = [
  {
    id: 1,
    name: 'RING RUN',
    brief: 'Fly through all 10 rings. Throttle with Shift / Ctrl, steer with the arrow keys or WASD. A ring pays 100, streaks pay extra.',
    goal: 'Fly through 10 rings',
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
