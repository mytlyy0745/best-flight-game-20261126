import {
  CLIMB_RATE, STALL_SPEED, STALL_SINK_K, GROUND_EFFECT_ALT, GROUND_EFFECT_LIFT,
  GUST_AMP1, GUST_AMP2, GUST_FREQ1, GUST_FREQ2, GUST_SWELL_AMP, GUST_SWELL_FREQ,
  CROSSWIND, CROSSWIND_RAMP_Z0, CROSSWIND_RAMP_Z1, CRATE_TERMINAL_VS,
  SCORE_RING, SCORE_GOLDEN_RING, SCORE_STREAK, SCORE_RING_PRECISION,
  SCORE_ZONE, SCORE_ZONE_STREAK, SCORE_LAND_BASE, SCORE_LAND_CENTER,
  SCORE_LAND_SMOOTH, RUNWAY, LAND_MAX_VS,
  RING_STEP_BASE, RING_STEP_INC, RING_ALT_STEP_BASE, RING_ALT_STEP_INC,
} from './config.js';

export function stallSink(speed) {
  const d = STALL_SPEED - speed;
  return d <= 0 ? 0 : STALL_SINK_K * Math.pow(d, 1.5);
}

export function groundEffect(heightAboveGround) {
  if (heightAboveGround >= GROUND_EFFECT_ALT) return 0;
  return GROUND_EFFECT_LIFT * (1 - heightAboveGround / GROUND_EFFECT_ALT);
}

export function climbVs(speed, pitch, heightAboveGround) {
  const ge = groundEffect(heightAboveGround);
  return pitch * speed * CLIMB_RATE - stallSink(speed) * (1 - ge) + 2 * ge;
}

export function layeredGust(time, p1, p2) {
  return GUST_AMP1 * Math.sin(time * GUST_FREQ1 + p1)
    + GUST_AMP2 * Math.sin(time * GUST_FREQ2 + p2)
    + GUST_SWELL_AMP * Math.sin(time * GUST_SWELL_FREQ + p1 + 1.3);
}

export function crosswindAt(z) {
  const t = (z - CROSSWIND_RAMP_Z0) / (CROSSWIND_RAMP_Z1 - CROSSWIND_RAMP_Z0);
  const s = t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
  return CROSSWIND * s;
}

export function crateFallStep(c, dt, dropWind) {
  c.vz = Math.max(c.vz - 9.8 * dt, -CRATE_TERMINAL_VS);
  c.z += c.vf * dt;
  c.x += dropWind * dt;
  c.alt += c.vz * dt;
}

export function ringPoints(golden, streak, precise) {
  const base = golden ? SCORE_GOLDEN_RING : SCORE_RING;
  const streakBonus = SCORE_STREAK * (streak - 1);
  const precisionBonus = precise ? SCORE_RING_PRECISION : 0;
  return { base, streakBonus, precisionBonus, total: base + streakBonus + precisionBonus };
}

export function zonePoints(zoneStreak) {
  const base = SCORE_ZONE;
  const streakBonus = SCORE_ZONE_STREAK * zoneStreak;
  return { base, streakBonus, total: base + streakBonus };
}

export function landingPoints(x, vs, fuel) {
  const center = Math.round(SCORE_LAND_CENTER * (1 - Math.abs(x) / RUNWAY.halfWidth));
  const smooth = Math.round(SCORE_LAND_SMOOTH * (1 - vs / LAND_MAX_VS));
  const fuelBonus = Math.round(fuel * 2);
  return { base: SCORE_LAND_BASE, center, smooth, fuelBonus, total: SCORE_LAND_BASE + center + smooth + fuelBonus };
}

export function courseStepBudget(i) {
  return {
    dx: Math.min(70, RING_STEP_BASE + RING_STEP_INC * i),
    dAlt: Math.min(35, RING_ALT_STEP_BASE + RING_ALT_STEP_INC * i),
  };
}

export function validateCourse(course, groundAt) {
  const issues = [];
  let px = 0;
  let pa = 160;
  for (let i = 0; i < course.rings.length; i += 1) {
    const r = course.rings[i];
    const b = courseStepBudget(i);
    if (Math.abs(r.x - px) > b.dx + 0.001) issues.push(`ring ${i} lateral step ${Math.abs(r.x - px).toFixed(1)} > ${b.dx}`);
    if (Math.abs(r.alt - pa) > b.dAlt + 0.001) issues.push(`ring ${i} altitude step ${Math.abs(r.alt - pa).toFixed(1)} > ${b.dAlt}`);
    if (r.alt - groundAt(r.z) < 30) issues.push(`ring ${i} only ${(r.alt - groundAt(r.z)).toFixed(1)} m above ground`);
    px = r.x;
    pa = r.alt;
  }
  let zx = course.zones[0].x;
  for (let i = 0; i < course.zones.length; i += 1) {
    const zn = course.zones[i];
    if (Math.abs(zn.x - zx) > 80.001) issues.push(`zone ${i} lateral step ${Math.abs(zn.x - zx).toFixed(1)} > 80`);
    if (zn.z + zn.r >= 6000) issues.push(`zone ${i} overlaps the runway strip`);
    zx = zn.x;
  }
  for (let i = 0; i < course.skyCrates.length; i += 1) {
    const c = course.skyCrates[i];
    const ring = course.rings.find((r) => r.z + 80 === c.z);
    if (!ring) { issues.push(`crate ${i} has no anchor ring`); continue; }
    const next = course.rings[course.rings.indexOf(ring) + 1];
    if (!next) { issues.push(`crate ${i} has no next ring`); continue; }
    const midX = (ring.x + next.x) / 2;
    if (Math.abs(c.x - midX) < 15 || Math.abs(c.x - midX) > 35.001) issues.push(`crate ${i} off-line ${Math.abs(c.x - midX).toFixed(1)} m`);
    if (c.alt < 80 || c.alt > 260) issues.push(`crate ${i} altitude ${c.alt.toFixed(1)} out of band`);
  }
  return issues;
}
