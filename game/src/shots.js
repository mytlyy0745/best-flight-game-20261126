// Sky Courier — screenshot staging and the autopilot that flies it.
// Each scene plays the real rules forward from a fresh world for a fixed
// number of steps, steered by a simple pilot (aim at the next ring, zone
// or the runway centreline), so the frame is what a real flight looks like
// and the same seed always gives the same frame.
import { STEP, RUNWAY, MISSION_Z, CROSSWIND } from './config.js';
import { EVENT_LANDED, EVENT_DROP } from './world.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const SAMPLE = STEP;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// How long a crate dropped now takes to reach the ground: the fall time
// depends on the ground height where it lands, not where the zone is —
// the hills vary by metres under a ~200 m fall, and that error alone is
// most of a bullseye. Iterate twice on the predicted landing point.
function fallTimeFor(s, zoneZ, world) {
  let ft = Math.sqrt((2 * Math.max(15, s.alt - world.groundAt(zoneZ))) / 9.8);
  for (let i = 0; i < 2; i += 1) {
    const predZ = s.z + s.speed * ft;
    ft = Math.sqrt((2 * Math.max(15, s.alt - world.groundAt(predZ))) / 9.8);
  }
  return ft;
}

// Fly toward a point: bank until the heading points at it, pitch until the
// vertical speed closes the altitude gap, throttle to hold target speed.
function autopilot(world) {
  const s = world.state;
  let targetX = 0;
  let targetAlt = 160;
  let targetSpeed = 88;
  let drop = false;

  if (s.mission === 1) {
    const ring = world.nextRing();
    const crate = world.nextSkyCrate();
    // A floating crate is worth the detour only when it sits near the
    // line the plane is already flying to the next ring: within 25 m
    // of that line, so the bump out and back costs almost no ring
    // margin. (The first version aimed at any crate within 45 m of
    // the plane and cost rings: a crate 74 m off the ring line with
    // 120 m to recover is unrecoverable.) Crates far off the line are
    // left for a human pilot to chase.
    if (crate && ring && crate.z > s.z + 30 && crate.z < ring.z && crate.z - s.z < 350) {
      const t = (crate.z - s.z) / (ring.z - s.z);
      const lineX = s.x + (ring.x - s.x) * t;
      const lineAlt = s.alt + (ring.alt - s.alt) * t;
      if (Math.abs(crate.x - lineX) < 25 && Math.abs(crate.alt - lineAlt) < 30) {
        targetX = crate.x;
        targetAlt = crate.alt;
      } else {
        targetX = ring.x;
        targetAlt = ring.alt;
      }
    } else if (ring) {
      targetX = ring.x;
      targetAlt = ring.alt;
    }
  } else if (s.mission === 2) {
    const zone = world.nextZone();
    if (zone) {
      // The drop wind pushes a falling crate sideways, so the release
      // point sits upwind of the zone: fly the offset line, and release
      // when the crate's predicted landing point crosses the zone.
      // The fall time is iterated on the ground height at the predicted
      // landing point, not at the zone: the hills vary by metres under
      // a 200 m fall, and that error alone is most of a bullseye.
      const fallTime = fallTimeFor(s, zone.z, world);
      const predictedZ = s.z + s.speed * fallTime;
      const predictedX = s.x + world.dropWind * fallTime;
      targetX = zone.x - world.dropWind * fallTime;
      targetAlt = 70;
      targetSpeed = 72;
      // Two tiers: first try for the bullseye (predicted landing within
      // 10 m in both axes), and if that window passes without a lined-up
      // release, still take the safe drop in the late half of the old
      // window — the zone still converts, just not dead centre.
      if (Math.abs(predictedX - zone.x) < 10 && Math.abs(predictedZ - zone.z) < 10) drop = true;
      else if (predictedZ > zone.z - 10 && Math.abs(predictedX - zone.x) < 24 && Math.abs(predictedZ - zone.z) < 30) drop = true;
    }
  } else {
    // Final: glide down the centreline, fighting the crosswind.
    targetX = s.z > 5000 ? -CROSSWIND * 0.4 : 0;
    const distToStrip = Math.max(0, RUNWAY.z0 - s.z);
    targetAlt = s.z >= RUNWAY.z0 ? 0 : clamp(distToStrip * 0.055, 8, 220);
    targetSpeed = s.z > 5200 ? 72 : 84;
  }

  const headRad = ((s.heading - 90) * Math.PI) / 180;
  const lateralVel = Math.sin(headRad) * s.speed;
  // The wind adds to the lateral speed, so the heading that holds a
  // wanted lateral velocity must crab into it — the crosswind in the
  // landing, and the gusts through the ring run.
  const wind = s.mission === 3 && s.z > 5000 ? CROSSWIND : s.mission === 1 ? s.gust : 0;
  const wantLateral = clamp((targetX - s.x) * 0.5, -40, 40);
  const wantHeading = 90 + (Math.asin(clamp((wantLateral - wind) / Math.max(40, s.speed), -1, 1)) * 180) / Math.PI;
  let roll = clamp((wantHeading - s.heading) * 0.13, -1, 1);
  roll -= s.roll * 0.25;
  roll = clamp(roll, -1, 1);

  // Over the strip, hold a steady gentle descent so she actually touches
  // down instead of floating on the glide path forever.
  // Descent is allowed to be steeper than the climb: the drop run leaves
  // the rings high and must get down to drop altitude before the first
  // release point, or the window passes before it.
  const wantVs = s.mission === 3 && s.z >= RUNWAY.z0
    ? -4.5
    : clamp((targetAlt - s.alt) * 0.45, -28, 20);
  let pitch = clamp((wantVs - s.vs) * 0.09, -1, 1);
  // Flare on short final: soften the descent only while it is steep.
  if (s.mission === 3 && s.z >= RUNWAY.z0 - 120 && s.alt < 12 && s.vs < -5) {
    pitch = clamp(pitch + 0.2, -1, 1);
  }
  const throttle = clamp((targetSpeed - 38) / 80, 0.2, 0.95);
  return { pitch: clamp(pitch, -1, 1), roll, throttle, drop };
}

// Drive the world with the autopilot until `stop(state, events)` is true
// (or the step budget runs out). Returns the events seen and step count.
export function flyUntil(world, stop, maxSeconds = 240) {
  const maxSteps = Math.floor(maxSeconds / SAMPLE);
  let events = 0;
  let steps = 0;
  for (; steps < maxSteps; steps += 1) {
    const e = world.step(SAMPLE, autopilot(world), false);
    events |= e;
    if (stop(world.state, e)) break;
    if (world.state.over) break;
  }
  return { events, steps };
}

// Stage one named scene and return the screen to draw over it.
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'drop' && name !== 'land' && name !== 'win') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, null, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    // Mid ring-run: stop with the next ring 140–170 m ahead, big in frame
    // but whole, the plane banked toward it, a few rings already banked —
    // and a sky crate in readable range when one is still ahead, so the
    // cover shot shows the crate gameplay (round 9's honest note: no
    // crate was visible in the staged play shot — seed 7's crates sit
    // 970–1690 m ahead at the old stop). A crate sits 80 m past a ring,
    // so when the next ring is 140–170 m ahead the crate past it is
    // 220–250 m ahead — readable now the label shows past ~300 m. If
    // the run is past the last crate ring, take the ring framing.
    flyUntil(world, (s) => {
      const r = world.nextRing();
      if (!r || s.z < 800) return false;
      const d = r.z - s.z;
      if (d > 170 || d < 140) return false;
      const c = world.nextSkyCrate();
      if (c && c.z - s.z >= 100 && c.z - s.z <= 350) return true;
      return s.z >= 2500;
    }, 60);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'drop') {
    // Fly to the first drop and let the crate fall most of a second,
    // so it shows below the nose with the zone ahead.
    const r = flyUntil(world, (s, e) => (e & EVENT_DROP) !== 0, 180);
    if ((r.events & EVENT_DROP) !== 0) {
      for (let i = 0; i < 45; i += 1) world.step(STEP, autopilot(world), false);
    }
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  // win: fly the whole course to a landing, then show the win panel
  // (verifies the end-of-game rating; the score here is the staged run).
  if (name === 'win') {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const r = flyUntil(world, (s, e) => (e & EVENT_LANDED) !== 0, 300);
      if ((r.events & EVENT_LANDED) !== 0) return { screen: SCREEN_WIN, best: world.state.score };
      if (world.state.over) world.retryMission(world.state.mission);
      else break;
    }
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  // land: fly the whole course to short final over the strip — runway
  // ahead, gear down in spirit — or the win panel if she is already down.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const r = flyUntil(world, (s, e) => (e & EVENT_LANDED) !== 0 || s.z >= 6150, 240);
    if ((r.events & EVENT_LANDED) !== 0) {
      return { screen: SCREEN_WIN, best: world.state.score };
    }
    if (world.state.z >= 6150) {
      return { screen: SCREEN_PLAY, best: world.state.score };
    }
    if (world.state.over) world.retryMission(world.state.mission);
    else break;
  }
  return { screen: SCREEN_PLAY, best: world.state.score };
}
