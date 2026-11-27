import { STEP, RUNWAY, MISSION_Z, CROSSWIND } from './config.js';
import { EVENT_LANDED, EVENT_DROP } from './world.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const SAMPLE = STEP;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function fallTimeFor(s, zoneZ, world) {
  let ft = Math.sqrt((2 * Math.max(15, s.alt - world.groundAt(zoneZ))) / 9.8);
  for (let i = 0; i < 2; i += 1) {
    const predZ = s.z + s.speed * ft;
    ft = Math.sqrt((2 * Math.max(15, s.alt - world.groundAt(predZ))) / 9.8);
  }
  return ft;
}

function autopilot(world, opts = {}) {
  const s = world.state;
  let targetX = 0;
  let targetAlt = 160;
  let targetSpeed = 88;
  let drop = false;

  if (s.mission === 1) {
    const ring = world.nextRing();
    const crate = world.nextSkyCrate();
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
      const fallTime = fallTimeFor(s, zone.z, world);
      const predictedZ = s.z + s.speed * fallTime;
      const predictedX = s.x + world.dropWind * fallTime;
      targetX = zone.x - world.dropWind * fallTime;
      targetAlt = 70;
      targetSpeed = 72;
      if (Math.abs(predictedX - zone.x) < 10 && Math.abs(predictedZ - zone.z) < 10) drop = true;
      else if (predictedZ > zone.z - 10 && Math.abs(predictedX - zone.x) < 24 && Math.abs(predictedZ - zone.z) < 30) drop = true;
    }
  } else {
    targetX = s.z > 5000 ? -CROSSWIND * 0.4 : 0;
    const distToStrip = Math.max(0, RUNWAY.z0 - s.z);
    targetAlt = s.z >= RUNWAY.z0 ? 0 : clamp(distToStrip * 0.055, 8, 220);
    targetSpeed = s.z > 5200 ? 72 : 84;
  }

  if (s.mission === 1 && opts.altOffset) targetAlt += opts.altOffset;

  const headRad = ((s.heading - 90) * Math.PI) / 180;
  const lateralVel = Math.sin(headRad) * s.speed;
  const wind = s.mission === 3 && s.z > 5000 ? CROSSWIND : s.mission === 1 ? s.gust : 0;
  const wantLateral = clamp((targetX - s.x) * 0.5, -40, 40);
  const wantHeading = 90 + (Math.asin(clamp((wantLateral - wind) / Math.max(40, s.speed), -1, 1)) * 180) / Math.PI;
  let roll = clamp((wantHeading - s.heading) * 0.13, -1, 1);
  roll -= s.roll * 0.25;
  roll = clamp(roll, -1, 1);

  const wantVs = s.mission === 3 && s.z >= RUNWAY.z0
    ? -4.5
    : clamp((targetAlt - s.alt) * 0.45, -28, 20);
  let pitch = clamp((wantVs - s.vs) * 0.09, -1, 1);
  if (s.mission === 3 && s.z >= RUNWAY.z0 - 120 && s.alt < 12 && s.vs < -5) {
    pitch = clamp(pitch + 0.2, -1, 1);
  }
  const throttle = clamp((targetSpeed - 38) / 80, 0.2, 0.95);
  return { pitch: clamp(pitch, -1, 1), roll, throttle, drop };
}

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

export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'drop' && name !== 'land' && name !== 'win') {
    flyUntil(world, (s) => {
      const r = world.nextRing();
      if (!r) return false;
      const d = r.z - s.z;
      return d <= 180 && d >= 120 && s.alt - r.alt >= 65 && Math.abs(s.vs) < 2;
    }, 20, { altOffset: 70 });
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
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
    const r = flyUntil(world, (s, e) => (e & EVENT_DROP) !== 0, 180);
    if ((r.events & EVENT_DROP) !== 0) {
      for (let i = 0; i < 135; i += 1) world.step(STEP, autopilot(world), false);
      for (const c of world.state.cratesFalling) c.z += 10;
    }
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'win') {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const r = flyUntil(world, (s, e) => (e & EVENT_LANDED) !== 0, 300);
      if ((r.events & EVENT_LANDED) !== 0) return { screen: SCREEN_WIN, best: world.state.score };
      if (world.state.over) world.retryMission(world.state.mission);
      else break;
    }
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const r = flyUntil(world, (s, e) => (e & EVENT_LANDED) !== 0 || s.z >= 6280, 240);
    if ((r.events & EVENT_LANDED) !== 0) {
      return { screen: SCREEN_WIN, best: world.state.score };
    }
    if (world.state.z >= 6280) {
      return { screen: SCREEN_PLAY, best: world.state.score };
    }
    if (world.state.over) world.retryMission(world.state.mission);
    else break;
  }
  return { screen: SCREEN_PLAY, best: world.state.score };
}
