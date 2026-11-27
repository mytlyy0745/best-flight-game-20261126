import {
  STEP, TRACK_LENGTH, SPEED_MIN, SPEED_MAX, CLIMB_RATE, TURN_RATE,
  MAX_ALT, LATERAL_LIMIT, FUEL_START, FUEL_DRAIN_BASE, FUEL_DRAIN_THROTTLE,
  RING_COUNT, RING_RADIUS, ZONE_COUNT, ZONE_RADIUS, CRATES, RUNWAY,
  MISSION_Z, SCORE_RING, SCORE_STREAK, SCORE_ZONE, SCORE_LAND_BASE,
  SCORE_LAND_CENTER, SCORE_LAND_SMOOTH, LAND_MAX_VS, LAND_MAX_SPEED,
  CROSSWIND, SCORE_RING_PRECISION, RING_PRECISION_DIST, SCORE_ZONE_STREAK,
  SCORE_PERFECT_RINGS, SCORE_PERFECT_ZONES, SCORE_TIME_RINGS,
  SCORE_TIME_ZONES, SCORE_TIME_LAND, TIME_PAR_RINGS, TIME_PAR_ZONES,
  TIME_PAR_LAND, SCORE_GREASED, LAND_GREASED_VS,
  GOLDEN_RING_COUNT, GOLDEN_RING_RADIUS, SCORE_GOLDEN_RING,
  SCORE_BALLOON_BUZZ, BALLOON_BUZZ_DIST,
  GUST_AMP1, GUST_AMP2, GUST_FREQ1, GUST_FREQ2,
  SCORE_ON_FIRE, ON_FIRE_RING_STREAK, ON_FIRE_ZONE_STREAK,
  SCORE_NEAR_MISS, NEAR_MISS_DIST,
  SKY_CRATE_COUNT, SKY_CRATE_RADIUS, SCORE_SKY_CRATE,
  DROP_WIND_MAX, SCORE_BULLSEYE, BULLSEYE_DIST,
} from './config.js';
import { createRandom, makeNoise } from './random.js';

export const EVENT_RING = 1;
export const EVENT_ZONE = 2;
export const EVENT_CRASH = 4;
export const EVENT_LANDED = 8;
export const EVENT_FUEL_EMPTY = 16;
export const EVENT_MISSION_DONE = 32;
export const EVENT_DROP = 64;
export const EVENT_BALLOON = 128;
export const EVENT_ON_FIRE = 256;
export const EVENT_NEAR_MISS = 512;
export const EVENT_CRATE = 1024;
export const EVENT_BULLSEYE = 2048;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function buildCourse(rand) {
  const rings = [];
  let x = 0;
  let alt = 150;
  const goldenIdx = new Set();
  while (goldenIdx.size < GOLDEN_RING_COUNT) {
    goldenIdx.add(2 + Math.floor(rand() * (RING_COUNT - 3)));
  }
  for (let i = 0; i < RING_COUNT; i += 1) {
    const z = 350 + i * 240;
    x = clamp(x + (rand() * 2 - 1) * 70, -170, 170);
    alt = clamp(alt + (rand() * 2 - 1) * 35, 80, 260);
    const golden = goldenIdx.has(i);
    rings.push({ z, x, alt, r: golden ? GOLDEN_RING_RADIUS : RING_RADIUS, hit: false, passed: false, golden, hitT: -1 });
  }
  const zones = [];
  let zx = clamp(rings[RING_COUNT - 1].x + (rand() * 2 - 1) * 40, -150, 150);
  for (let i = 0; i < ZONE_COUNT; i += 1) {
    if (i > 0) zx = clamp(zx + (rand() * 2 - 1) * 80, -150, 150);
    zones.push({ z: 3800 + i * 400, x: zx, r: ZONE_RADIUS, hit: false, passed: false });
  }
  const skyCrates = [];
  const crateIdx = new Set();
  while (crateIdx.size < SKY_CRATE_COUNT) {
    crateIdx.add(3 + Math.floor(rand() * 7));
  }
  for (const i of [...crateIdx].sort((a, b) => a - b)) {
    const midX = (rings[i].x + rings[i + 1].x) / 2;
    const midAlt = (rings[i].alt + rings[i + 1].alt) / 2;
    const off = (rand() < 0.5 ? -1 : 1) * (15 + rand() * 20);
    skyCrates.push({
      z: rings[i].z + 80,
      x: clamp(midX + off, -200, 200),
      alt: clamp(midAlt + (rand() * 2 - 1) * 30, 80, 260),
      taken: false,
      hitT: -1,
    });
  }
  return { rings, zones, skyCrates };
}

export function createWorld(rand) {
  const noise = makeNoise(rand, 24, 700);
  const noise2 = makeNoise(rand, 12, 1600);
  const course = buildCourse(rand);
  const trees = [];
  for (let i = 0; i < 130; i += 1) {
    trees.push({ z: 120 + rand() * (TRACK_LENGTH - 240), x: (rand() < 0.5 ? -1 : 1) * (60 + rand() * 260), s: 0.7 + rand() * 0.9, round: rand() < 0.3 });
  }
  for (let c = 0; c < 7; c += 1) {
    const cz = 300 + rand() * (TRACK_LENGTH - 900);
    const cx = (rand() < 0.5 ? -1 : 1) * (90 + rand() * 220);
    const n = 6 + Math.floor(rand() * 7);
    for (let i = 0; i < n; i += 1) {
      trees.push({ z: cz + (rand() * 2 - 1) * 60, x: cx + (rand() * 2 - 1) * 55, s: 0.7 + rand() * 1.0, round: true });
    }
  }
  const clouds = [];
  for (let i = 0; i < 26; i += 1) {
    clouds.push({ z: rand() * TRACK_LENGTH, x: (rand() * 2 - 1) * 500, y: 190 + rand() * 140, s: 1.3 + rand() * 2.2 });
  }
  const river = { p1: rand() * 6.283, p2: rand() * 6.283 };
  function riverX(z) {
    return 150 * Math.sin(z * 0.0016 + river.p1) + 60 * Math.sin(z * 0.0042 + river.p2);
  }
  const houses = [];
  for (let i = 0; i < 8; i += 1) {
    houses.push({ z: 5660 + i * 34 + rand() * 18, x: (rand() < 0.5 ? -1 : 1) * (42 + rand() * 85), s: 0.8 + rand() * 0.6, tone: Math.floor(rand() * 3) });
  }
  const windsock = { z: 6060, x: -30 };
  const hangar = { z: 6180, x: 55, s: 1 };
  const balloon = {
    z: 900 + rand() * 1600,
    x: (rand() < 0.5 ? -1 : 1) * (80 + rand() * 60),
    alt: 120 + rand() * 80,
  };
  const birds = {
    z: 1500 + rand() * 1200,
    baseX: (rand() < 0.5 ? -1 : 1) * 220,
    alt: 140 + rand() * 60,
    count: 5,
  };
  function balloonAt(time) {
    return { z: balloon.z, x: balloon.x + 18 * Math.sin(time * 0.05), alt: balloon.alt + 4 * Math.sin(time * 0.11) };
  }
  function birdsAt(time) {
    const out = [];
    for (let i = 0; i < birds.count; i += 1) {
      out.push({
        z: birds.z + i * 14,
        x: birds.baseX + 130 * Math.sin(time * 0.1 + i * 0.9),
        alt: birds.alt + 6 * Math.sin(time * 0.7 + i * 1.3),
        flap: Math.sin(time * 6 + i * 1.7),
      });
    }
    return out;
  }
  const gust = { p1: rand() * 6.283, p2: rand() * 6.283 };
  function gustAt(time) {
    return GUST_AMP1 * Math.sin(time * GUST_FREQ1 + gust.p1) + GUST_AMP2 * Math.sin(time * GUST_FREQ2 + gust.p2);
  }
  const dropWind = (rand() * 2 - 1) * DROP_WIND_MAX;

  function groundAt(z) {
    if (z >= RUNWAY.z0) return 0;
    const hills = 16 * noise(z) + 10 * noise2(z) + 22;
    const blend = clamp((z - 5600) / 400, 0, 1);
    return hills * (1 - blend);
  }

  const state = freshState();

  function freshState() {
    return {
      mission: 1,
      z: 0,
      x: 0,
      alt: 160,
      speed: 70,
      heading: 90, // degrees, 90 = straight down the track
      pitch: 0,
      roll: 0,
      throttle: 0.7,
      fuel: FUEL_START,
      damage: 0,
      vs: 0, // vertical speed, m/s
      score: 0,
      streak: 0,
      ringsHit: 0,
      zonesHit: 0,
      zoneStreak: 0, // consecutive zones hit without flying past one
      crates: CRATES,
      dropCooldown: 0, // seconds until another crate may leave the bay
      time: 0,
      missionStart: 0, // state.time when the current mission began
      missionTimes: {}, // mission -> seconds it took
      scoreParts: { rings: 0, zones: 0, landing: 0, bonus: 0 },
      over: false,
      landed: false,
      crashReason: '',
      landScore: 0,
      banked: 0, // score banked by finished missions; a retry restarts from here
      cratesFalling: [], // {z, x, alt, vz}
      message: '',
      messageT: 0,
      balloonBuzzed: false, // the balloon bonus pays once per flight
      maxCombo: 0, // best ring/zone streak in this flight
      gust: 0, // current lateral wind in the ring run, m/s
      greased: false, // the landing was a greaser (for the win fireworks)
      nearMissed: false, // the bird-flock near-miss bonus already paid
      onFireM1: false, // the ring-run ON FIRE bonus already paid
      onFireM2: false, // the drop-run ON FIRE bonus already paid
      cratesCollected: 0, // sky crates grabbed in the ring run
      bullseyes: 0, // crates landed within 10 m of a zone centre
      dropWind, // steady lateral wind in the drop run, m/s (seeded)
      _fuelWarned: false,
    };
  }

  function reset() {
    Object.assign(state, freshState());
    for (const r of course.rings) { r.hit = false; r.passed = false; r.hitT = -1; }
    for (const zn of course.zones) { zn.hit = false; zn.passed = false; }
    for (const c of course.skyCrates) { c.taken = false; c.hitT = -1; }
  }

  function retryMission(mission) {
    const savedRings = course.rings.map((r) => ({ hit: r.hit, passed: r.passed, hitT: r.hitT }));
    const savedZones = course.zones.map((zn) => ({ hit: zn.hit, passed: zn.passed }));
    const savedCrates = course.skyCrates.map((c) => ({ taken: c.taken, hitT: c.hitT }));
    const banked = state.banked;
    const ringsHit = state.ringsHit;
    const zonesHit = state.zonesHit;
    const balloonBuzzed = state.balloonBuzzed;
    const maxCombo = state.maxCombo;
    const onFireM1 = state.onFireM1;
    const onFireM2 = state.onFireM2;
    const nearMissed = state.nearMissed;
    const cratesCollected = state.cratesCollected;
    const bullseyes = state.bullseyes;
    reset();
    state.banked = banked;
    state.score = banked;
    state.ringsHit = ringsHit;
    state.zonesHit = zonesHit;
    state.balloonBuzzed = balloonBuzzed;
    state.maxCombo = maxCombo;
    state.onFireM1 = onFireM1;
    state.onFireM2 = onFireM2;
    state.nearMissed = nearMissed;
    state.cratesCollected = cratesCollected;
    state.bullseyes = bullseyes;
    course.skyCrates.forEach((c, i) => { c.taken = savedCrates[i].taken; c.hitT = savedCrates[i].hitT; });
    state.mission = mission;
    state.missionStart = state.time;
    state.z = mission === 2 ? MISSION_Z.ringsEnd : mission === 3 ? MISSION_Z.zonesEnd : 0;
    state.alt = 160;
    state.speed = 70;
    if (mission >= 2) {
      course.rings.forEach((r, i) => { r.hit = savedRings[i].hit; r.passed = true; r.hitT = savedRings[i].hitT; });
    }
    if (mission >= 3) {
      course.zones.forEach((zn, i) => { zn.hit = savedZones[i].hit; zn.passed = savedZones[i].passed; });
    }
    say(mission === 1 ? 'RING RUN — again' : mission === 2 ? 'SUPPLY DROP — again' : 'STORM LANDING — again');
  }

  function nextRing() {
    return course.rings.find((r) => !r.passed) ?? null;
  }
  function nextZone() {
    return course.zones.find((zn) => !zn.hit && !zn.passed) ?? null;
  }
  function nextSkyCrate() {
    return course.skyCrates.find((c) => !c.taken && c.z > state.z) ?? null;
  }

  function say(text) {
    state.message = text;
    state.messageT = 2.4;
  }

  function crash(reason) {
    state.over = true;
    state.crashReason = reason;
    say(reason);
  }

  function finishMission() {
    const m = state.mission;
    const elapsed = state.time - state.missionStart;
    state.missionTimes[m] = Math.round(elapsed * 10) / 10;
    const par = m === 1 ? TIME_PAR_RINGS : TIME_PAR_ZONES;
    const timeBonus = m === 1 ? SCORE_TIME_RINGS : SCORE_TIME_ZONES;
    const flewIt = m === 1 ? state.ringsHit >= 6 : state.zonesHit >= 3;
    if (flewIt && elapsed <= par) {
      state.score += timeBonus;
      state.scoreParts.bonus += timeBonus;
      say(`BEAT THE CLOCK +${timeBonus}`);
    }
    if (m === 1 && state.ringsHit >= RING_COUNT) {
      state.score += SCORE_PERFECT_RINGS;
      state.scoreParts.bonus += SCORE_PERFECT_RINGS;
      say(`PERFECT RING RUN +${SCORE_PERFECT_RINGS}`);
    }
    if (m === 2 && state.zonesHit >= ZONE_COUNT) {
      state.score += SCORE_PERFECT_ZONES;
      state.scoreParts.bonus += SCORE_PERFECT_ZONES;
      say(`PERFECT DROPS +${SCORE_PERFECT_ZONES}`);
    }
    state.banked = state.score;
    state.mission += 1;
    state.missionStart = state.time;
    return EVENT_MISSION_DONE;
  }

  function step(dt, ctl, attract) {
    if (state.over || state.landed) return 0;
    let events = 0;
    state.time += dt;

    if (attract) {
      ctl = { pitch: Math.sin(state.time * 0.25) * 0.25, roll: Math.sin(state.time * 0.11) * 0.5, throttle: 0.65, drop: false };
    }

    state.throttle = clamp(ctl.throttle, 0, 1);
    const targetSpeed = SPEED_MIN + state.throttle * (SPEED_MAX - SPEED_MIN);
    state.speed += (targetSpeed - state.speed) * Math.min(1, dt * 0.8);

    state.pitch += (ctl.pitch - state.pitch) * Math.min(1, dt * 6);
    state.roll += (ctl.roll - state.roll) * Math.min(1, dt * 5);

    state.heading = clamp(state.heading + state.roll * TURN_RATE * dt * (state.speed / 70), 40, 140);
    const headRad = ((state.heading - 90) * Math.PI) / 180;
    let lateral = Math.sin(headRad) * state.speed;
    state.gust = state.mission === 1 ? gustAt(state.time) : 0;
    if (state.mission === 1) lateral += state.gust;
    if (state.z > 5000 && state.mission === 3) lateral += CROSSWIND;
    state.x = clamp(state.x + lateral * dt, -LATERAL_LIMIT, LATERAL_LIMIT);
    state.z += Math.cos(headRad) * state.speed * dt;

    const sink = state.speed < 55 ? (55 - state.speed) * 0.12 : 0;
    state.vs = state.pitch * state.speed * CLIMB_RATE - sink;
    state.alt = clamp(state.alt + state.vs * dt, 0, MAX_ALT);

    state.fuel -= (FUEL_DRAIN_BASE + state.throttle * FUEL_DRAIN_THROTTLE) * dt;
    if (state.fuel <= 0) {
      state.fuel = 0;
      state.throttle = 0;
      if (!state._fuelWarned) {
        state._fuelWarned = true;
        events |= EVENT_FUEL_EMPTY;
        say('FUEL EMPTY — glide her in!');
      }
    }

    for (const c of state.cratesFalling) {
      c.vz -= 9.8 * dt;
      c.z += state.speed * dt;
      c.x += state.dropWind * dt;
      c.alt += c.vz * dt;
      if (c.alt <= groundAt(c.z)) {
        c.done = true;
        const zone = course.zones.find((zn) => !zn.hit && Math.abs(zn.z - c.z) < zn.r && Math.abs(zn.x - c.x) < zn.r);
        if (zone) {
          zone.hit = true;
          state.zonesHit += 1;
          const pts = SCORE_ZONE + SCORE_ZONE_STREAK * state.zoneStreak;
          state.zoneStreak += 1;
          state.maxCombo = Math.max(state.maxCombo, state.zoneStreak);
          let bullExtra = '';
          if (Math.abs(zone.z - c.z) < BULLSEYE_DIST && Math.abs(zone.x - c.x) < BULLSEYE_DIST) {
            state.bullseyes += 1;
            state.score += SCORE_BULLSEYE;
            state.scoreParts.bonus += SCORE_BULLSEYE;
            events |= EVENT_BULLSEYE;
            bullExtra = ` — BULLSEYE +${SCORE_BULLSEYE}`;
          }
          let fireExtra = '';
          if (!state.onFireM2 && state.zoneStreak >= ON_FIRE_ZONE_STREAK) {
            state.onFireM2 = true;
            state.score += SCORE_ON_FIRE;
            state.scoreParts.bonus += SCORE_ON_FIRE;
            events |= EVENT_ON_FIRE;
            fireExtra = ` — ON FIRE +${SCORE_ON_FIRE}`;
          }
          state.score += pts;
          state.scoreParts.zones += pts;
          events |= EVENT_ZONE;
          say(`SUPPLY DELIVERED +${pts}${fireExtra}${bullExtra}`);
        }
      }
    }
    state.cratesFalling = state.cratesFalling.filter((c) => !c.done);

    for (const zn of course.zones) {
      if (!zn.hit && !zn.passed && state.z > zn.z + zn.r) {
        zn.passed = true;
        state.zoneStreak = 0;
      }
    }

    if (state.dropCooldown > 0) state.dropCooldown -= dt;
    if (ctl.drop && state.dropCooldown <= 0 && state.crates > 0 && state.mission === 2) {
      state.crates -= 1;
      state.dropCooldown = 1.5;
      state.cratesFalling.push({ z: state.z, x: state.x, alt: state.alt, vz: 0 });
      events |= EVENT_DROP;
    }

    const ground = groundAt(state.z);
    const onRunway = state.z >= RUNWAY.z0 && state.z <= RUNWAY.z1;

    if (state.mission === 1) {
      for (const c of course.skyCrates) {
        if (!c.taken && Math.abs(state.z - c.z) < SKY_CRATE_RADIUS) {
          const cd = Math.hypot(state.x - c.x, state.alt - c.alt, state.z - c.z);
          if (cd < SKY_CRATE_RADIUS) {
            c.taken = true;
            c.hitT = state.time;
            state.cratesCollected += 1;
            state.score += SCORE_SKY_CRATE;
            state.scoreParts.bonus += SCORE_SKY_CRATE;
            events |= EVENT_CRATE;
            say(`SUPPLY CRATE +${SCORE_SKY_CRATE}`);
          }
        }
      }
      for (const r of course.rings) {
        if (!r.passed && state.z >= r.z) {
          r.passed = true;
          const dx = state.x - r.x;
          const dy = state.alt - r.alt;
          if (Math.hypot(dx, dy) < r.r) {
            r.hit = true;
            r.hitT = state.time;
            state.ringsHit += 1;
            state.streak += 1;
            state.maxCombo = Math.max(state.maxCombo, state.streak);
            let pts = (r.golden ? SCORE_GOLDEN_RING : SCORE_RING) + SCORE_STREAK * (state.streak - 1);
            const precise = Math.hypot(dx, dy) < RING_PRECISION_DIST;
            if (precise) {
              pts += SCORE_RING_PRECISION;
              state.scoreParts.bonus += SCORE_RING_PRECISION;
            }
            state.score += pts;
            state.scoreParts.rings += pts - (precise ? SCORE_RING_PRECISION : 0);
            events |= EVENT_RING;
            let fireExtra = '';
            if (!state.onFireM1 && state.streak >= ON_FIRE_RING_STREAK) {
              state.onFireM1 = true;
              state.score += SCORE_ON_FIRE;
              state.scoreParts.bonus += SCORE_ON_FIRE;
              events |= EVENT_ON_FIRE;
              fireExtra = ` — ON FIRE +${SCORE_ON_FIRE}`;
            }
            say(`${r.golden ? 'GOLDEN RING' : `RING ${state.ringsHit}/${RING_COUNT}`} +${pts}${precise ? ' — DEAD CENTRE' : ''}${fireExtra}`);
          } else {
            state.streak = 0;
          }
        }
      }
      if (!state.balloonBuzzed) {
        const bp = balloonAt(state.time);
        const bdx = state.x - bp.x;
        const bdy = state.alt - bp.alt;
        const bdz = state.z - bp.z;
        if (Math.hypot(bdx, bdy, bdz) < BALLOON_BUZZ_DIST) {
          state.balloonBuzzed = true;
          state.score += SCORE_BALLOON_BUZZ;
          state.scoreParts.bonus += SCORE_BALLOON_BUZZ;
          events |= EVENT_BALLOON;
          say(`BALLOON BUZZ +${SCORE_BALLOON_BUZZ}`);
        }
      }
      if (!state.nearMissed) {
        for (const b of birdsAt(state.time)) {
          if (Math.hypot(state.x - b.x, state.alt - b.alt, state.z - b.z) < NEAR_MISS_DIST) {
            state.nearMissed = true;
            state.score += SCORE_NEAR_MISS;
            state.scoreParts.bonus += SCORE_NEAR_MISS;
            events |= EVENT_NEAR_MISS;
            say(`CLOSE ONE! +${SCORE_NEAR_MISS}`);
            break;
          }
        }
      }
      if (state.z >= MISSION_Z.ringsEnd) {
        say(state.ringsHit >= 6 ? 'RING RUN DONE — on to the drops' : 'RING RUN DONE — few rings, but onward');
        events |= finishMission();
      }
    }

    if (state.mission === 2 && state.z >= MISSION_Z.zonesEnd) {
      say(state.zonesHit >= 3 ? 'DROPS DONE — now bring her home' : 'DROPS DONE — now bring her home');
      events |= finishMission();
    }

    if (state.alt <= ground + 0.5) {
      if (onRunway && state.mission === 3) {
        const vs = Math.abs(state.vs);
        const centred = Math.abs(state.x) <= RUNWAY.halfWidth;
        if (centred && vs <= LAND_MAX_VS && state.speed <= LAND_MAX_SPEED) {
          state.landed = true;
          state.alt = 0;
          const centerBonus = Math.round(SCORE_LAND_CENTER * (1 - Math.abs(state.x) / RUNWAY.halfWidth));
          const smoothBonus = Math.round(SCORE_LAND_SMOOTH * (1 - vs / LAND_MAX_VS));
          const fuelBonus = Math.round(state.fuel * 2);
          state.landScore = SCORE_LAND_BASE + centerBonus + smoothBonus + fuelBonus;
          state.score += state.landScore;
          state.scoreParts.landing += state.landScore;
          let extra = '';
          if (vs <= LAND_GREASED_VS && Math.abs(state.x) <= RUNWAY.halfWidth * 0.5 && state.damage === 0) {
            state.greased = true;
            state.score += SCORE_GREASED;
            state.scoreParts.bonus += SCORE_GREASED;
            state.landScore += SCORE_GREASED;
            extra += ` GREASED +${SCORE_GREASED}`;
          }
          const elapsed3 = state.time - state.missionStart;
          state.missionTimes[3] = Math.round(elapsed3 * 10) / 10;
          if (elapsed3 <= TIME_PAR_LAND) {
            state.score += SCORE_TIME_LAND;
            state.scoreParts.bonus += SCORE_TIME_LAND;
            extra += ` BEAT THE CLOCK +${SCORE_TIME_LAND}`;
          }
          events |= EVENT_LANDED;
          say(`TOUCHDOWN! +${state.landScore}${extra}`);
        } else if (state.damage < 100) {
          state.damage += 45;
          state.alt = 10;
          state.vs = 5;
          state.speed *= 0.85;
          say(state.damage >= 100 ? 'AIRFRAME GONE' : centred ? 'TOO HARD — BOUNCED!' : 'OFF THE STRIP!');
          if (state.damage >= 100) crash('The landing broke her apart.');
        } else {
          crash('The landing broke her apart.');
        }
      } else if (state.z > MISSION_Z.zonesEnd && state.mission === 3 && state.z < RUNWAY.z0) {
        crash('Short of the runway — she came down in the fields.');
      } else {
        crash(state.alt <= 1 ? 'She kissed the dirt.' : 'Terrain strike!');
      }
    }

    if (!state.over && state.z >= TRACK_LENGTH) {
      if (state.mission === 3 && !state.landed) crash('Overshot the runway!');
      else if (state.mission < 3) { state.z = TRACK_LENGTH - 1; }
    }

    if (state.messageT > 0) state.messageT -= dt;
    return events;
  }

  return {
    state,
    course,
    trees,
    clouds,
    houses,
    windsock,
    hangar,
    balloon,
    birds,
    balloonAt,
    birdsAt,
    gustAt,
    dropWind,
    riverX,
    groundAt,
    reset,
    retryMission,
    step,
    nextRing,
    nextZone,
    nextSkyCrate,
  };
}
