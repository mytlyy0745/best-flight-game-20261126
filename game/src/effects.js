// Sky Courier — particle effects: wingtip contrails, ring sparkles,
// storm rain, speed lines, event bursts (ring / crate / zone / crash /
// landing), win-screen fireworks, sun halo, cloud volume and airborne
// motes. Pure 2D canvas, no libraries, no network, no Math.random /
// Date.now anywhere: every jitter comes from the seeded stream
// (createRandom) or from a hash of (index, time), so the same seed and
// the same world time always paint the same frame — a screenshot staged
// with &seed=7 is the same frame every time.
//
// Two kinds of effect live here:
//  * STATE-DERIVED effects (contrails, ring sparkles, rain, speed lines,
//    falling-crate smoke, the ring/crate burst right after a hit, sun
//    halo, cloud volume, motes) are computed from world state +
//    state.time inside draw(). They need no update() history, so they
//    show in staged screenshots too.
//  * SIMULATED bursts (crash fireball, landing dust, zone dust) are
//    spawned by update() from the world's event bitmask and simulated
//    forward. They are live-play juice and source-outline richness; a
//    staged still never shows a crash or a landing dust cloud anyway.
//
// WIRING (coordinator: main.js + render.js — this file is never imported
// by index.html directly):
//   import { createEffects } from './effects.js';
//   const fx = createEffects(seed);            // same seed as the world
//   // once per world step, in main.js step():
//   fx.update(STEP, world.state, events, world);
//   // inside render.js draw(), right after drawSky (halo sits behind
//   // the mountains and clouds, like real light):
//   fx.drawSunHalo(ctx, {w, h, horizonY, dusk}, state);
//   // inside render.js draw(), right after drawClouds:
//   fx.drawCloudVolume(ctx, {w, h, horizonY, camDepth, camX: state.x, camZ: state.z}, state, world);
//   // inside render.js draw(), in the roll-rotated block, after the
//   // plane is drawn and before the HUD:
//   fx.draw(ctx, {
//     w, h,
//     horizonY, camDepth,
//     camX: state.x, camAlt: state.alt, camZ: state.z,
//     pitch: state.pitch, screen,
//     dusk: state.mission === 3 ? 1 : 0,
//   }, state, world);
//   // win screen, before the win overlay (bursts sit behind the panel,
//   // like render.js's own fireworks):
//   fx.drawFireworks(ctx, w, h, animT);
// The view object mirrors the projection render.js already uses:
//   sx = w/2 + camDepth * (wx - camX) / d,  sy = horizonY + camDepth * (camAlt - wy) / d
// with d = wz - camZ. Points with d <= 8 are behind / under the camera
// and are skipped, exactly like the ground bands.
import { createRandom } from './random.js';
import { VIEW_DIST, CROSSWIND } from './config.js';

// Events, mirrored from world.js so this module needs no import of it.
const EVENT_RING = 1;
const EVENT_ZONE = 2;
const EVENT_CRASH = 4;
const EVENT_LANDED = 8;
const EVENT_CRATE = 1024;

const MAX_PARTICLES = 500;
const TRAIL_POINTS = 11; // contrail samples streaming off each wingtip
const RING_SPARKLES = 9; // sparkles orbiting each near ring
const RAIN_DROPS = 130; // rain streaks in the storm landing
const MOTES = 42; // golden airborne motes drifting in the daylight
const BURST_LIFE = 0.9; // seconds a ring/crate burst stays visible

function hash(n) {
  let h = (n * 2654435761) >>> 0;
  h ^= h >>> 13;
  h ^= h << 5;
  return (h >>> 0) / 4294967296;
}
function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function createEffects(seed) {
  const rand = createRandom(seed >>> 0);
  // Simulated particles in world space: {x, alt, z, vx, vy, vz, life,
  // maxLife, size, r, g, b, grav, drag, smoke}. Only live-play bursts
  // use this list; the staged stills are all state-derived.
  let particles = [];
  let lastZoneBurstZ = -1; // z of the zone already dusted, so one event = one puff

  function spawn(p) {
    if (particles.length >= MAX_PARTICLES) particles.shift();
    particles.push(p);
  }

  // A radial burst of sparks around a world point (ring hit, crate grab).
  function sparkBurst(x, alt, z, count, speed, cols, life) {
    for (let i = 0; i < count; i += 1) {
      const a = rand() * Math.PI * 2;
      const b = (rand() - 0.5) * Math.PI;
      const v = speed * (0.4 + rand() * 0.8);
      const c = cols[Math.floor(rand() * cols.length)];
      spawn({
        x, alt, z,
        vx: Math.cos(a) * Math.cos(b) * v,
        vy: Math.sin(b) * v,
        vz: Math.sin(a) * Math.cos(b) * v,
        life: life * (0.6 + rand() * 0.6), maxLife: life,
        size: 1.5 + rand() * 2.5,
        r: c[0], g: c[1], b: c[2], grav: -6, drag: 0.92, smoke: false,
      });
    }
  }

  // A slow grey-brown dust puff: landing smoke, zone dust, crash smoke.
  function dustPuff(x, alt, z, count, spread, rise) {
    for (let i = 0; i < count; i += 1) {
      const a = rand() * Math.PI * 2;
      const v = spread * (0.3 + rand() * 0.7);
      spawn({
        x: x + (rand() - 0.5) * spread * 2, alt: alt + rand() * 2, z: z + (rand() - 0.5) * spread * 2,
        vx: Math.cos(a) * v, vy: rise * (0.5 + rand()), vz: Math.sin(a) * v,
        life: 1.1 + rand() * 0.9, maxLife: 2,
        size: 5 + rand() * 9,
        r: 168, g: 158, b: 142, grav: 2.5, drag: 0.94, smoke: true,
      });
    }
  }

  // The plane's screen anchor — the same point render.js draws the
  // plane at, so bursts and trails start exactly at the aircraft.
  function planeScreen(view, state) {
    return {
      x: view.w / 2,
      y: view.h * 0.6 - state.pitch * 16 + (view.screen === 0 ? 80 : 0),
    };
  }

  // Project a world point with the renderer's own formula. Returns null
  // when the point is behind the camera or past the view distance.
  function project(view, wx, wy, wz) {
    const d = wz - view.camZ;
    if (d < 8 || d > VIEW_DIST) return null;
    return {
      x: view.w / 2 + (view.camDepth * (wx - view.camX)) / d,
      y: view.horizonY + (view.camDepth * (view.camAlt - wy)) / d,
      d,
      s: view.camDepth / d, // world metres -> screen px at this depth
    };
  }

  // The gold spark ring that blooms around the plane the instant she
  // threads a ring (or grabs a sky crate): deterministic in state, so
  // it fires in live play from r.hitT / c.hitT with no update() history.
  // The plane has just passed the ring, so the burst is drawn at the
  // plane's screen anchor, expanding and fading over BURST_LIFE.
  function drawHitBurst(ctx, view, state, hitT, golden, plane) {
    if (hitT < 0) return;
    const age = state.time - hitT;
    if (age < 0 || age >= BURST_LIFE) return;
    const t = age / BURST_LIFE;
    const base = golden ? [255, 190, 60] : [255, 214, 102];
    const n = golden ? 16 : 12;
    for (let k = 0; k < n; k += 1) {
      const a = hash(Math.floor(hitT * 60) * 31 + k * 17) * Math.PI * 2;
      const r0 = 14 + hash(Math.floor(hitT * 60) * 13 + k * 7) * 26;
      const r = r0 * (0.4 + t * 1.6);
      const px = plane.x + Math.cos(a) * r;
      const py = plane.y + Math.sin(a) * r * 0.85;
      const alpha = (1 - t) * (k % 3 === 0 ? 0.95 : 0.6);
      ctx.fillStyle = `rgba(${base[0]},${base[1]},${base[2]},${alpha})`;
      ctx.beginPath();
      ctx.arc(px, py, 2.6 - t * 1.4, 0, Math.PI * 2);
      ctx.fill();
      // A faint halo on every third spark so the burst glows, not just dots.
      if (k % 3 === 0) {
        ctx.fillStyle = `rgba(${base[0]},${base[1]},${base[2]},${alpha * 0.25})`;
        ctx.beginPath();
        ctx.arc(px, py, 7 - t * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Wingtip contrails: two fading white streaks streaming back from the
  // wingtips toward the bottom corners of the frame. Screen space, not
  // world space — the plane sits AT the camera plane in this renderer
  // (camZ = state.z), so a world-space point behind the plane is behind
  // the camera and can never project (the first version did exactly
  // that: its first sample had d = 0, the projection refused it, and
  // the whole trail silently never drew). The trail is anchored at the
  // drawn wingtips — the same anchor render.js draws the plane at —
  // and streams down-and-out with a slight outward curve, recycling
  // with time so it flows backward in live play. Visible in every
  // staged still, because it only needs state, not update() history.
  function drawContrails(ctx, view, state, plane) {
    if (state.speed < 55 || state.alt < 4) return;
    const scale = Math.min(view.w, view.h) / 720;
    const ang = -(view.screen === 0 ? 0 : state.roll) * 0.85;
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    const strength = clamp((state.speed - 55) / 45, 0.25, 1) * clamp(state.throttle + 0.25, 0, 1);
    const flow = (state.time * 36) % 24; // the trail streams backward
    for (const side of [-1, 1]) {
      // Wingtip in screen space: local (±118, 8), rotated with the plane.
      const lx = side * 118 * scale;
      const ly = 8 * scale;
      const tipX = plane.x + lx * cos - ly * sin;
      const tipY = plane.y + lx * sin + ly * cos;
      const pts = [];
      for (let k = 0; k < TRAIL_POINTS; k += 1) {
        const dist = k * 24 + flow;
        pts.push({
          x: tipX + side * (dist * 0.45 + dist * dist * 0.0016),
          y: tipY + dist,
          a: strength * 0.5 * (1 - k / TRAIL_POINTS),
          w: 1.5 + k * 0.8,
        });
      }
      // Soft wide under-stroke first, so the trail glows instead of
      // reading as a hard white wire.
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(255,255,255,${(0.1 * strength).toFixed(3)})`;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let k = 1; k < pts.length; k += 1) ctx.lineTo(pts[k].x, pts[k].y);
      ctx.stroke();
      for (let k = 1; k < pts.length; k += 1) {
        ctx.strokeStyle = `rgba(255,255,255,${pts[k].a.toFixed(3)})`;
        ctx.lineWidth = pts[k].w;
        ctx.beginPath();
        ctx.moveTo(pts[k - 1].x, pts[k - 1].y);
        ctx.lineTo(pts[k].x, pts[k].y);
        ctx.stroke();
      }
    }
    // Reset the line state the trail borrowed, so the next draw call
    // does not inherit a fat round cap.
    ctx.lineWidth = 1;
    ctx.lineCap = 'butt';
  }

  // Sparkles orbiting the next rings: a live ring reads as charged, not
  // as a flat yellow hoop. Seeded by ring index, animated by state.time,
  // so the same frame always shows the same sparkles. Golden rings get
  // gold sparkles; plain rings get warm white ones.
  function drawRingSparkles(ctx, view, state, world) {
    const rings = world.course.rings;
    let drawn = 0;
    for (const r of rings) {
      if (r.passed || drawn >= 2) continue;
      const d = r.z - state.z;
      if (d < 20 || d > 900) continue;
      drawn += 1;
      const ri = rings.indexOf(r);
      for (let k = 0; k < RING_SPARKLES; k += 1) {
        const a = hash(ri * 101 + k * 17) * Math.PI * 2 + state.time * (0.6 + hash(ri * 7 + k) * 0.9);
        const rr = r.r * (0.94 + 0.06 * Math.sin(state.time * 2 + k * 1.7));
        const p = project(view, r.x + Math.cos(a) * rr, r.alt + Math.sin(a) * rr, r.z);
        if (!p) continue;
        const tw = 0.55 + 0.45 * Math.sin(state.time * 5 + k * 2.3);
        const col = r.golden ? '255,190,60' : '255,240,200';
        ctx.fillStyle = `rgba(${col},${(0.85 * tw).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1.2, p.s * 0.55), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Rain in the storm landing (mission 3): slanted streaks, blown by
  // the crosswind, cycling down the frame as a function of state.time.
  // Screen space, so it reads even when the world ahead is empty sky.
  // A few fast horizontal gust streaks cross the frame too — the storm
  // is wind, not only water.
  function drawRain(ctx, view, state) {
    if (state.mission !== 3) return;
    const slant = -CROSSWIND * 1.6; // px of sideways drift per streak
    ctx.strokeStyle = 'rgba(190,214,235,0.3)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < RAIN_DROPS; i += 1) {
      const x0 = hash(i * 37 + 3) * (view.w + 120) - 60;
      const fall = (hash(i * 53 + 11) * view.h + state.time * 460) % (view.h + 60) - 30;
      const len = 26 + hash(i * 19 + 5) * 14;
      ctx.moveTo(x0, fall);
      ctx.lineTo(x0 + (slant * len) / 60, fall + len);
    }
    ctx.stroke();
    // Gust streaks: 6 fast horizontal slashes, one crossing every ~2 s.
    ctx.strokeStyle = 'rgba(220,232,245,0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const gy = hash(i * 61 + 7) * view.h * 0.7;
      const gx = ((hash(i * 43 + 2) * view.w - state.time * 620) % (view.w + 400) + view.w + 400) % (view.w + 400) - 200;
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + 130, gy + 8);
    }
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  // Golden airborne motes in daylight (missions 1–2): dust and pollen
  // drifting in the light, slow and faint. They give the air itself a
  // texture — the sky stops being a flat gradient and gains depth. A
  // pure function of state.time, so stills are stable and replays match.
  function drawMotes(ctx, view, state) {
    if (state.mission === 3) return;
    for (let i = 0; i < MOTES; i += 1) {
      const mx = (hash(i * 47 + 5) * view.w + state.time * (6 + hash(i * 13 + 1) * 10)) % view.w;
      const my = hash(i * 29 + 3) * view.h * 0.62 + Math.sin(state.time * 0.4 + i * 1.3) * 9;
      const tw = 0.5 + 0.5 * Math.sin(state.time * 1.7 + i * 2.1);
      const a = 0.1 + 0.16 * tw;
      ctx.fillStyle = `rgba(255,236,180,${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(mx, my, 1 + hash(i * 17 + 9) * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Speed lines at high speed: faint streaks near the frame edges that
  // sell velocity in a still. Only above 85 m/s, and only a whisper —
  // the sky, not the effect, is the picture.
  function drawSpeedLines(ctx, view, state) {
    if (state.speed < 85) return;
    const n = Math.min(10, Math.floor((state.speed - 85) / 3));
    ctx.strokeStyle = 'rgba(255,255,255,0.13)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < n; i += 1) {
      const edge = hash(i * 41 + Math.floor(state.time * 6)) ;
      const side = i % 2 === 0 ? 0 : 1; // 0 = left edge, 1 = right edge
      const y = hash(i * 23 + 9) * view.h;
      const x = side === 0 ? 6 + edge * 40 : view.w - 6 - edge * 40;
      const len = 40 + hash(i * 29 + 2) * 60;
      ctx.moveTo(x, y);
      ctx.lineTo(x + (side === 0 ? len : -len), y + (hash(i * 31 + 4) - 0.5) * 24);
    }
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  // Smoke puffs trailing a falling supply crate: the drop shot stages
  // 0.75 s after release, so the crate shows below the nose with a
  // little white trail behind it — the drop reads as an event, not a dot.
  // Screen space, like the contrails: a falling crate keeps the plane's
  // forward speed, so its world depth stays d ≈ 0 and it can never
  // project — the puffs hang below the plane anchor instead, drifting
  // sideways with the drop wind the pilot is fighting.
  function drawCrateSmoke(ctx, view, state, plane) {
    const falling = state.cratesFalling;
    if (!falling || falling.length === 0) return;
    const drift = Math.sign(state.dropWind || 0);
    for (const c of falling) {
      for (let k = 0; k < 4; k += 1) {
        const px = plane.x + drift * k * 5;
        const py = plane.y + 52 + k * 22;
        const a = 0.3 * (1 - k / 4);
        ctx.fillStyle = `rgba(235,235,230,${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(px, py, 3 + k * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawSimulated(ctx, view) {
    for (const p of particles) {
      const pr = project(view, p.x, p.alt, p.z);
      if (!pr) continue;
      const t = 1 - p.life / p.maxLife;
      const size = p.size * (p.smoke ? 1 + t * 1.6 : 1 - t * 0.5);
      const alpha = p.smoke ? 0.4 * (1 - t) : 0.9 * (1 - t);
      ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, Math.max(0.8, size * pr.s * 0.12), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return {
    // Advance the simulation and spawn bursts from this step's events.
    // Call once per world step, before draw(). Safe to call with events 0.
    update(dt, state, events, world) {
      if (!state || state.over === undefined) return;
      if (events & EVENT_CRASH) {
        // Fireball + smoke at the wreck: orange core, red edge, grey smoke.
        // Spawned 30 m ahead of the plane, not at it: the plane sits at
        // the camera plane (d = 0), so a burst at her own position can
        // never project — 30 m ahead it blooms low in the frame.
        sparkBurst(state.x, state.alt, state.z + 30, 26, 26, [[255, 120, 40], [255, 60, 30], [255, 200, 90]], 0.8);
        dustPuff(state.x, state.alt, state.z + 30, 14, 16, 4);
      }
      if (events & EVENT_LANDED) {
        // Touchdown dust kicked up along the strip, both sides — again
        // 25 m ahead of the camera plane so it projects.
        dustPuff(state.x - 4, 1, state.z + 25, 10, 10, 2.5);
        dustPuff(state.x + 4, 1, state.z + 31, 10, 10, 2.5);
        if (state.greased) sparkBurst(state.x, 2, state.z + 25, 10, 12, [[255, 214, 102], [255, 255, 255]], 0.6);
      }
      if (events & EVENT_ZONE) {
        // Dust where the crate thumped in: the zone just hit is the
        // hit zone with the greatest z (crates land ahead of the plane).
        let hitZone = null;
        for (const zn of world.course.zones) {
          if (zn.hit && (!hitZone || zn.z > hitZone.z)) hitZone = zn;
        }
        if (hitZone && hitZone.z !== lastZoneBurstZ) {
          lastZoneBurstZ = hitZone.z;
          dustPuff(hitZone.x, 1, hitZone.z, 12, 12, 3);
        }
      }
      // Advance + cull the simulation. dt is STEP (1/60) in live play.
      const step = dt > 0 && dt < 0.5 ? dt : 1 / 60;
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.life -= step;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        p.vy += p.grav * step;
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.vz *= p.drag;
        p.x += p.vx * step;
        p.alt += p.vy * step;
        p.z += p.vz * step;
      }
    },

    // Draw every effect for this frame. Works with no update() history:
    // the state-derived effects (trails, sparkles, rain, smoke, hit
    // bursts) only need state + world, so staged screenshots get them.
    draw(ctx, view, state, world) {
      if (!ctx || !state || !world) return;
      const plane = planeScreen(view, state);
      drawContrails(ctx, view, state, plane);
      drawRingSparkles(ctx, view, state, world);
      drawCrateSmoke(ctx, view, state, plane);
      drawRain(ctx, view, state);
      drawMotes(ctx, view, state);
      drawSpeedLines(ctx, view, state);
      // Bursts for the most recent ring hit and crate grab, if fresh.
      let lastRing = null;
      for (const r of world.course.rings) {
        if (r.hit && (!lastRing || r.hitT > lastRing.hitT)) lastRing = r;
      }
      if (lastRing) drawHitBurst(ctx, view, state, lastRing.hitT, lastRing.golden, plane);
      let lastCrate = null;
      for (const c of world.course.skyCrates) {
        if (c.taken && (!lastCrate || c.hitT > lastCrate.hitT)) lastCrate = c;
      }
      if (lastCrate) drawHitBurst(ctx, view, state, lastCrate.hitT, true, plane);
      drawSimulated(ctx, view);
    },

    // Win-screen fireworks: seven seeded bursts blooming on a loop,
    // each with 28 sparks, a bright glow core, a flash at ignition, a
    // smaller echo burst half a cycle later and crackle dots at the rim
    // — dense and bright enough to carry the win still, not a few thin
    // spokes. A pure function of time, so the win screen replays.
    // Call BEFORE the win overlay (like render.js's own fireworks), so
    // the bursts sit behind the panel instead of over its text; the
    // harness calls it last only because it draws after the renderer.
    drawFireworks(ctx, w, h, time) {
      const cols = ['#ffd166', '#ff5a4e', '#7dd7ff', '#7dffa8', '#ff9de2', '#fff3b0', '#ff8c42'];
      for (let i = 0; i < 7; i += 1) {
        const fx = w * (0.08 + hash(i * 7 + 3) * 0.84);
        const fy = h * (0.07 + hash(i * 11 + 5) * 0.26);
        const cycle = (time * 0.4 + i * 0.31) % 1;
        if (cycle >= 0.8) continue;
        const alpha = 1 - cycle / 0.8;
        const col = cols[i % cols.length];
        // Ignition flash: a hard white-gold blink in the first 10% of
        // the cycle, so each burst pops instead of fading in.
        if (cycle < 0.1) {
          ctx.save();
          ctx.globalAlpha = (1 - cycle / 0.1) * 0.9;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(fx, fy, 5 + cycle * 30, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        // Glow core: two layered gradients, warm centre, wide reach.
        const glow = ctx.createRadialGradient(fx, fy, 1, fx, fy, 34 + cycle * 56);
        glow.addColorStop(0, col);
        glow.addColorStop(0.4, col);
        glow.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.save();
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillStyle = glow;
        ctx.fillRect(fx - 95, fy - 95, 190, 190);
        ctx.restore();
        // 28 sparks, drooping as the burst ages, with a bright head dot.
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.5;
        for (let k = 0; k < 28; k += 1) {
          const a = (k / 28) * Math.PI * 2 + i * 0.6 + hash(i * 17 + k) * 0.2;
          const r0 = 12 + cycle * 64;
          const droop = cycle * cycle * 30;
          const x1 = fx + Math.cos(a) * r0 * 0.35;
          const y1 = fy + Math.sin(a) * r0 * 0.35 + droop * 0.35;
          const x2 = fx + Math.cos(a) * r0;
          const y2 = fy + Math.sin(a) * r0 + droop;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(x2, y2, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        // Crackle dots: small bright embers scattered past the rim.
        ctx.save();
        ctx.globalAlpha = alpha * 0.85;
        ctx.fillStyle = '#ffffff';
        for (let k = 0; k < 10; k += 1) {
          const a = hash(i * 23 + k * 7) * Math.PI * 2;
          const r = (14 + cycle * 78) * (0.8 + hash(i * 31 + k) * 0.4);
          ctx.beginPath();
          ctx.arc(fx + Math.cos(a) * r, fy + Math.sin(a) * r + cycle * cycle * 34, 1.3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        // Echo burst: a smaller second bloom half a cycle behind the
        // first, same site, so the sky never has a single lonely burst.
        const ec = (cycle + 0.5) % 1;
        if (ec < 0.6) {
          const ea = 0.7 * (1 - ec / 0.6);
          ctx.save();
          ctx.globalAlpha = ea;
          ctx.strokeStyle = cols[(i + 2) % cols.length];
          ctx.lineWidth = 2;
          for (let k = 0; k < 12; k += 1) {
            const a = (k / 12) * Math.PI * 2 + i;
            const r0 = 6 + ec * 30;
            ctx.beginPath();
            ctx.moveTo(fx + Math.cos(a) * r0 * 0.4, fy + Math.sin(a) * r0 * 0.4);
            ctx.lineTo(fx + Math.cos(a) * r0, fy + Math.sin(a) * r0);
            ctx.stroke();
          }
          ctx.restore();
        }
      }
    },

    // Sun halo: call right after drawSky, before the mountains, so the
    // light sits behind the world like real light. The sun in render.js
    // is a flat disc with a small glow; this adds the atmosphere around
    // it — a wide warm halo, a tighter bright core, a thin halo ring,
    // a few soft crepuscular rays and lens-flare glints trailing toward
    // the frame centre. Same sun anchor as drawSky (w*0.78, horizonY
    // minus a dusk/day offset), so the halo never drifts off the disc.
    // A pure function of state.time: the glints twinkle, the halo holds.
    drawSunHalo(ctx, view, state) {
      const dusk = view.dusk ? 1 : 0;
      const sx = view.w * 0.78;
      const sy = view.horizonY - view.h * (dusk ? 0.09 : 0.22);
      const warm = dusk ? '255,170,90' : '255,220,140';
      const core = dusk ? '255,214,150' : '255,244,200';
      // Wide halo: the sky itself warms around the sun.
      let g = ctx.createRadialGradient(sx, sy, 10, sx, sy, view.h * 0.42);
      g.addColorStop(0, `rgba(${core},0.55)`);
      g.addColorStop(0.25, `rgba(${warm},0.28)`);
      g.addColorStop(1, `rgba(${warm},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(sx - view.h * 0.45, sy - view.h * 0.45, view.h * 0.9, view.h * 0.9);
      // Tight bright core hugging the disc.
      g = ctx.createRadialGradient(sx, sy, 4, sx, sy, 90);
      g.addColorStop(0, `rgba(${core},0.85)`);
      g.addColorStop(0.5, `rgba(${warm},0.35)`);
      g.addColorStop(1, `rgba(${warm},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(sx - 95, sy - 95, 190, 190);
      // Thin halo ring at ~2.4 disc radii — the edge the eye catches.
      ctx.strokeStyle = `rgba(${core},0.35)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, 62, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
      // Crepuscular rays: long faint wedges fanning down from the sun.
      ctx.save();
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = `rgb(${warm})`;
      for (let k = 0; k < 5; k += 1) {
        const a = Math.PI * (0.28 + k * 0.11) + Math.sin(state.time * 0.1 + k) * 0.02;
        const len = view.h * (0.5 + hash(k * 13 + 2) * 0.25);
        const spread = 0.03 + hash(k * 7 + 1) * 0.03;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(a - spread) * len, sy + Math.sin(a - spread) * len);
        ctx.lineTo(sx + Math.cos(a + spread) * len, sy + Math.sin(a + spread) * len);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      // Lens-flare glints trailing from the sun toward the frame centre.
      for (let k = 0; k < 3; k += 1) {
        const t = 0.22 + k * 0.16;
        const gx = sx + (view.w / 2 - sx) * t;
        const gy = sy + (view.h * 0.55 - sy) * t;
        const tw = 0.5 + 0.5 * Math.sin(state.time * 1.3 + k * 2.4);
        const gr = 3 + k * 2.5;
        ctx.fillStyle = `rgba(${core},${(0.28 * tw).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(gx, gy, gr, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(${core},${(0.22 * tw).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(gx, gy, gr * 2.2, 0, Math.PI * 2);
        ctx.stroke();
      }
    },

    // Cloud volume: call right after drawClouds. The scene role owns
    // where clouds sit; this adds the texture on top of the same clouds —
    // extra dome puffs stacked above each cloud so it reads tall, a
    // soft dark under-puff for the shaded base, and a warm sunlit rim
    // on the sun side (sun at w*0.78). Same projection and same skip
    // rules as render.js drawClouds, so the puffs never float where
    // the cloud itself was culled. A slow ±3 px drift with time keeps
    // live play breathing without moving the still.
    drawCloudVolume(ctx, view, state, world) {
      const clouds = world.clouds;
      if (!clouds) return;
      for (let ci = 0; ci < clouds.length; ci += 1) {
        const c = clouds[ci];
        const d = c.z - view.camZ;
        if (d < 40 || d > VIEW_DIST) continue;
        const drift = Math.sin(state.time * 0.05 + ci * 1.7) * 3;
        const sx = view.w / 2 + (view.camDepth * (c.x - view.camX)) / d + drift;
        const sy = view.horizonY - (view.camDepth * (c.y - 40)) / d;
        const s = (view.camDepth * 34 * c.s) / d;
        if (sx < -120 || sx > view.w + 120 || sy < -60 || sy > view.horizonY) continue;
        if (sy - s * 0.32 < 110) continue;
        if (sy > view.horizonY - 50) continue;
        const dusk = view.dusk ? 1 : 0;
        // Soft dark under-puff: the shaded base, deeper than the flat
        // ellipse render.js draws, so the cloud has a belly.
        ctx.fillStyle = dusk ? 'rgba(96,96,140,0.35)' : 'rgba(146,166,198,0.4)';
        ctx.beginPath();
        ctx.ellipse(sx, sy + s * 0.3, s * 0.85, s * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        // Extra domes stacked above the body: the cloud reads tall and
        // lumpy instead of one wide flat puff.
        ctx.fillStyle = dusk ? 'rgba(232,222,248,0.85)' : 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.ellipse(sx - s * 0.45, sy - s * 0.42, s * 0.34, s * 0.18, 0, 0, Math.PI * 2);
        ctx.ellipse(sx + s * 0.1, sy - s * 0.5, s * 0.38, s * 0.2, 0, 0, Math.PI * 2);
        ctx.ellipse(sx + s * 0.6, sy - s * 0.38, s * 0.28, s * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();
        // Warm sunlit rim on the sun side (sun sits upper-right).
        ctx.fillStyle = dusk ? 'rgba(255,190,140,0.55)' : 'rgba(255,238,200,0.6)';
        ctx.beginPath();
        ctx.ellipse(sx + s * 0.35, sy - s * 0.3, s * 0.4, s * 0.1, -0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    },

    // Drop all simulated particles (mission retry / new flight).
    reset() {
      particles = [];
      lastZoneBurstZ = -1;
    },

    // For tests: how many simulated particles are alive right now.
    particleCount() { return particles.length; },
  };
}
