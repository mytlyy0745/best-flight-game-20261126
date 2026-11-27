import { createRandom } from './random.js';
import { VIEW_DIST, CROSSWIND } from './config.js';
import { SCREEN_WIN } from './render.js'; // win screen: celebration, no storm

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
  let particles = [];
  let lastZoneBurstZ = -1; // z of the zone already dusted, so one event = one puff

  function spawn(p) {
    if (particles.length >= MAX_PARTICLES) particles.shift();
    particles.push(p);
  }

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

  function planeScreen(view, state) {
    return {
      x: view.w / 2,
      y: view.h * 0.6 - state.pitch * 16 + (view.screen === 0 ? 80 : 0),
    };
  }

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
      if (k % 3 === 0) {
        ctx.fillStyle = `rgba(${base[0]},${base[1]},${base[2]},${alpha * 0.25})`;
        ctx.beginPath();
        ctx.arc(px, py, 7 - t * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawContrails(ctx, view, state, plane) {
    if (state.speed < 55 || state.alt < 4) return;
    const scale = Math.min(view.w, view.h) / 720;
    const ang = -(view.screen === 0 ? 0 : state.roll) * 0.85;
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    const strength = clamp((state.speed - 55) / 45, 0.25, 1) * clamp(state.throttle + 0.25, 0, 1);
    const flow = (state.time * 36) % 24; // the trail streams backward
    for (const side of [-1, 1]) {
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
    ctx.lineWidth = 1;
    ctx.lineCap = 'butt';
  }

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

  function drawRain(ctx, view, state) {
    if (state.mission !== 3) return;
    if (view.screen === SCREEN_WIN) return;
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

  const FWX = [0.14, 0.86, 0.36, 0.11, 0.89, 0.55, 0.7];
  const FWY = [0.48, 0.48, 0.74, 0.68, 0.68, 0.74, 0.74];

  return {
    update(dt, state, events, world) {
      if (!state || state.over === undefined) return;
      if (events & EVENT_CRASH) {
        sparkBurst(state.x, state.alt, state.z + 30, 26, 26, [[255, 120, 40], [255, 60, 30], [255, 200, 90]], 0.8);
        dustPuff(state.x, state.alt, state.z + 30, 14, 16, 4);
      }
      if (events & EVENT_LANDED) {
        dustPuff(state.x - 4, 1, state.z + 25, 10, 10, 2.5);
        dustPuff(state.x + 4, 1, state.z + 31, 10, 10, 2.5);
        if (state.greased) sparkBurst(state.x, 2, state.z + 25, 10, 12, [[255, 214, 102], [255, 255, 255]], 0.6);
      }
      if (events & EVENT_ZONE) {
        let hitZone = null;
        for (const zn of world.course.zones) {
          if (zn.hit && (!hitZone || zn.z > hitZone.z)) hitZone = zn;
        }
        if (hitZone && hitZone.z !== lastZoneBurstZ) {
          lastZoneBurstZ = hitZone.z;
          dustPuff(hitZone.x, 1, hitZone.z, 12, 12, 3);
        }
      }
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

    draw(ctx, view, state, world) {
      if (!ctx || !state || !world) return;
      const plane = planeScreen(view, state);
      drawContrails(ctx, view, state, plane);
      drawRingSparkles(ctx, view, state, world);
      drawCrateSmoke(ctx, view, state, plane);
      drawRain(ctx, view, state);
      drawMotes(ctx, view, state);
      drawSpeedLines(ctx, view, state);
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

    drawFireworks(ctx, w, h, time) {
      const cols = ['#ffd166', '#ff5a4e', '#7dd7ff', '#7dffa8', '#ff9de2', '#fff3b0', '#ff8c42'];
      for (let i = 0; i < 7; i += 1) {
        const fx = w * (FWX[i] + (hash(i * 7 + 3) - 0.5) * 0.06);
        const fy = h * (FWY[i] + (hash(i * 11 + 5) - 0.5) * 0.04);
        const B = i < 2 ? 1.5 : 1;
        const cycle = (time * 0.4 + i * 0.31) % 1;
        if (cycle >= 0.8) continue;
        const alpha = 1 - cycle / 0.8;
        const col = cols[i % cols.length];
        if (cycle < 0.1) {
          ctx.save();
          ctx.globalAlpha = (1 - cycle / 0.1) * 0.9;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(fx, fy, (5 + cycle * 30) * B, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        const glow = ctx.createRadialGradient(fx, fy, 1, fx, fy, (34 + cycle * 56) * B);
        glow.addColorStop(0, col);
        glow.addColorStop(0.4, col);
        glow.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.save();
        ctx.globalAlpha = alpha * 0.5 * B;
        ctx.fillStyle = glow;
        ctx.fillRect(fx - 95 * B, fy - 95 * B, 190 * B, 190 * B);
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.5 * B;
        for (let k = 0; k < 28; k += 1) {
          const a = (k / 28) * Math.PI * 2 + i * 0.6 + hash(i * 17 + k) * 0.2;
          const r0 = (12 + cycle * 64) * B;
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
          ctx.arc(x2, y2, 2 * B, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = alpha * 0.85;
        ctx.fillStyle = '#ffffff';
        for (let k = 0; k < 10; k += 1) {
          const a = hash(i * 23 + k * 7) * Math.PI * 2;
          const r = (14 + cycle * 78) * B * (0.8 + hash(i * 31 + k) * 0.4);
          ctx.beginPath();
          ctx.arc(fx + Math.cos(a) * r, fy + Math.sin(a) * r + cycle * cycle * 34, 1.3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
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

    drawSunHalo(ctx, view, state) {
      const dusk = view.dusk ? 1 : 0;
      const sx = view.w * 0.78;
      const sy = view.horizonY - view.h * (dusk ? 0.09 : 0.22);
      const warm = dusk ? '255,170,90' : '255,220,140';
      const core = dusk ? '255,214,150' : '255,244,200';
      let g = ctx.createRadialGradient(sx, sy, 10, sx, sy, view.h * 0.42);
      g.addColorStop(0, `rgba(${core},0.55)`);
      g.addColorStop(0.25, `rgba(${warm},0.28)`);
      g.addColorStop(1, `rgba(${warm},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(sx - view.h * 0.45, sy - view.h * 0.45, view.h * 0.9, view.h * 0.9);
      g = ctx.createRadialGradient(sx, sy, 4, sx, sy, 90);
      g.addColorStop(0, `rgba(${core},0.85)`);
      g.addColorStop(0.5, `rgba(${warm},0.35)`);
      g.addColorStop(1, `rgba(${warm},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(sx - 95, sy - 95, 190, 190);
      ctx.strokeStyle = `rgba(${core},0.35)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, 62, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
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
        ctx.fillStyle = dusk ? 'rgba(96,96,140,0.35)' : 'rgba(146,166,198,0.4)';
        ctx.beginPath();
        ctx.ellipse(sx, sy + s * 0.3, s * 0.85, s * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = dusk ? 'rgba(232,222,248,0.85)' : 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.ellipse(sx - s * 0.45, sy - s * 0.42, s * 0.34, s * 0.18, 0, 0, Math.PI * 2);
        ctx.ellipse(sx + s * 0.1, sy - s * 0.5, s * 0.38, s * 0.2, 0, 0, Math.PI * 2);
        ctx.ellipse(sx + s * 0.6, sy - s * 0.38, s * 0.28, s * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = dusk ? 'rgba(255,190,140,0.55)' : 'rgba(255,238,200,0.6)';
        ctx.beginPath();
        ctx.ellipse(sx + s * 0.35, sy - s * 0.3, s * 0.4, s * 0.1, -0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    },

    reset() {
      particles = [];
      lastZoneBurstZ = -1;
    },

    particleCount() { return particles.length; },
  };
}
