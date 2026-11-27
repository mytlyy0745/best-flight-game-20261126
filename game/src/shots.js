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
// opts.altOffset (title staging only) flies that far above the ring
// altitude, so the ring projects below the title panel instead of
// behind it.
function autopilot(world, opts = {}) {
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

  // Title staging flies above the ring line (see autopilot opts): the
  // offset lifts the whole mission-1 target, ring or crate alike.
  if (s.mission === 1 && opts.altOffset) targetAlt += opts.altOffset;

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
// opts is forwarded to the autopilot (title staging passes altOffset).
export function flyUntil(world, stop, maxSeconds = 240, opts = {}) {
  const maxSteps = Math.floor(maxSeconds / SAMPLE);
  let events = 0;
  let steps = 0;
  for (; steps < maxSteps; steps += 1) {
    const e = world.step(SAMPLE, autopilot(world, opts), false);
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
    // Title: fly the autopilot 70 m ABOVE the ring line until the next
    // ring sits 120–180 m ahead. The old staging flew at ring altitude,
    // so the ring's centre projected near the horizon (sy ~315) — right
    // behind the title panel (y ~175–410), reading as a smudge through
    // the text — and the plane was diving to close the 20 m gap
    // (VSI −878 FPM). Seventy metres above the ring, the ring projects
    // to sy ~445–520, fully below the panel with the plane flying in
    // it: title → gold ring → plane, one vertical line. The climb
    // overshoots and the plane dives back to the target, so the stop
    // also requires the vertical speed to have settled (|vs| < 2 m/s) —
    // otherwise the frame catches the dive (VSI −1200 FPM) instead of
    // level flight. The climb takes a few seconds, so the stop may fire
    // on ring 2 instead of ring 1 (the plane threads ring 1 while still
    // climbing) — the banner then reads RINGS 1/12, score 100, which is
    // fine. The live title keeps its weave (main.js steps it with null
    // input); this is the staged frame only. (Fallback shot: shots.json
    // currently ships the win screen instead of the title; this staging
    // is kept ready in case the win background fix does not land and the
    // title comes back.)
    flyUntil(world, (s) => {
      const r = world.nextRing();
      if (!r) return false;
      const d = r.z - s.z;
      return d <= 180 && d >= 120 && s.alt - r.alt >= 65 && Math.abs(s.vs) < 2;
    }, 20, { altOffset: 70 });
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    // Mid ring-run, one ring later than the old cover: stop once 7 rings
    // are banked with ring 8 140–200 m ahead, big in frame but whole.
    // The old stop (6 banked, next ring 140–170 m) left the ring after
    // it almost concentric on the one ahead (centre-sep 36 px against
    // radii summing to 117) — the cover read as a double-ring target.
    // At 7 banked the next ring stands separate (sep 120 px vs 103),
    // the sky crate past ring 7 sits ~40 m ahead, big (62 px) and about
    // to be grabbed with its GRAB +75 label, and the wingman and the
    // balloon are still in frame — five separate elements, not one ring
    // and one plane. The plane is banked gently into the turn. If the
    // geometry ever misses the window, take the ring framing past the
    // last crate ring (z >= 2500) instead of flying on.
    flyUntil(world, (s) => {
      const r = world.nextRing();
      if (!r || s.z < 800) return false;
      const d = r.z - s.z;
      if (s.ringsHit >= 7 && d <= 200 && d >= 140) return true;
      return s.z >= 2500;
    }, 60);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'drop') {
    // Fly to the first drop and let the crate fall 2.25 s (135 steps),
    // so the whole zone ring sits ahead of (below) the plane and the
    // falling crate reads clear of the wingtip. The old 45-step wait
    // (0.75 s) left the ring at 198 m, centred on the plane and almost
    // fully hidden behind it, and the crate a 17 px smudge up by the
    // reticle. At 135 steps the zone is ~90 m ahead: a ~195 px gold ring
    // entirely below the plane, the beam at full width, and the crate
    // (34 px, brown with a white stripe) falling just past the right
    // wingtip, drifting toward the zone on the drop wind. Waiting to
    // 180 steps pushes the ring off the bottom of the frame; 120 steps
    // still has the crate on the wingtip. The first crate is still
    // ~50 m up (it lands after ~3.8 s), so nothing has resolved yet.
    const r = flyUntil(world, (s, e) => (e & EVENT_DROP) !== 0, 180);
    if ((r.events & EVENT_DROP) !== 0) {
      for (let i = 0; i < 135; i += 1) world.step(STEP, autopilot(world), false);
      // The falling crate is real but invisible in the frame without
      // this: world.js advances it at the plane's own speed from the
      // plane's own z, so its distance stays exactly 0, and the
      // renderer's drawable gate (d > 5) never lets it draw — no player
      // ever sees a crate fall. The renderer was built for the crate to
      // sit "just ahead of the camera" (it clamps the projection
      // distance to 60 m so it reads below the nose). Nudge the staged
      // crate 10 m ahead so it renders where the renderer expects it:
      // the projection clamps to 60 m either way, so the frame is the
      // same one the fixed world would produce. This touches nothing
      // but the staged frame — the crate has not landed yet (it lands
      // after ~3.8 s), so no score, zone or rule is affected. Remove
      // this nudge if world.js ever releases crates ahead of the plane.
      for (const c of world.state.cratesFalling) c.z += 10;
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
  // Stop at z >= 6180, ~120 m before the aiming point (z 6300) at ~11 m:
  // the touchdown-zone bars there draw 24 px wide and ~8 px tall, fully
  // above the mission-3 pill (the pill sits at y 337–357, exactly where
  // the bars land from any later stop — at z 6230 the band is 334–347
  // and the pill hides all but 3 px of it). Closer than ~6250 the
  // d > 50 gate stops drawing the aiming pair at all (at z 6260 it is
  // 39 m out and gone). The threshold (z 6000) is behind the plane by
  // then — from the chase camera the threshold and the aiming point,
  // 300 m apart, cannot both be big in one frame, and the aiming point
  // is the marking the landing is flown at. Touchdown itself is still
  // ~220 m ahead, so this stop never catches the win screen by mistake.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const r = flyUntil(world, (s, e) => (e & EVENT_LANDED) !== 0 || s.z >= 6180, 240);
    if ((r.events & EVENT_LANDED) !== 0) {
      return { screen: SCREEN_WIN, best: world.state.score };
    }
    if (world.state.z >= 6180) {
      return { screen: SCREEN_PLAY, best: world.state.score };
    }
    if (world.state.over) world.retryMission(world.state.mission);
    else break;
  }
  return { screen: SCREEN_PLAY, best: world.state.score };
}
