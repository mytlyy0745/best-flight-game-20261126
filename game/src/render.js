// Sky Courier — everything the eye sees: pseudo-3D chase view over
// rolling terrain, the aircraft, the rings and the runway, then the HUD
// instruments and the screen overlays. All drawing is plain 2D canvas.
import { SEG_LEN, VIEW_DIST, RUNWAY, MISSION_Z } from './config.js';

export const SCREEN_TITLE = 0;
export const SCREEN_BRIEF = 1;
export const SCREEN_PLAY = 2;
export const SCREEN_PAUSED = 3;
export const SCREEN_FAIL = 4;
export const SCREEN_MISSION_DONE = 5;
export const SCREEN_WIN = 6;

const FIELDS = [
  [96, 148, 74], [124, 168, 82], [74, 128, 66], [176, 164, 96],
  [110, 158, 96], [88, 138, 88], [150, 150, 84],
];
const SKY_TOP = [38, 96, 168];
const SKY_HORIZON = [246, 201, 138];

function hash(n) {
  let h = (n * 2654435761) >>> 0;
  h ^= h >>> 13;
  h ^= h << 5;
  return (h >>> 0) / 4294967296;
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function mix3(c1, c2, t) {
  return `rgb(${Math.round(lerp(c1[0], c2[0], t))},${Math.round(lerp(c1[1], c2[1], t))},${Math.round(lerp(c1[2], c2[2], t))})`;
}
function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawSky(w, h, horizonY, time) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, `rgb(${SKY_TOP[0]},${SKY_TOP[1]},${SKY_TOP[2]})`);
    g.addColorStop(0.55, `rgb(120,164,205)`);
    g.addColorStop(0.72, `rgb(${SKY_HORIZON[0]},${SKY_HORIZON[1]},${SKY_HORIZON[2]})`);
    g.addColorStop(0.73, `rgb(140,170,150)`);
    g.addColorStop(1, `rgb(90,120,80)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // Sun with a soft glow, upper right.
    const sx = w * 0.78;
    const sy = horizonY - h * 0.22;
    const glow = ctx.createRadialGradient(sx, sy, 4, sx, sy, 90);
    glow.addColorStop(0, 'rgba(255,244,200,0.95)');
    glow.addColorStop(0.25, 'rgba(255,220,140,0.55)');
    glow.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sx - 95, sy - 95, 190, 190);
    ctx.fillStyle = '#fff6d8';
    ctx.beginPath();
    ctx.arc(sx, sy, 22, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawMountains(w, h, horizonY, camZ, camX, layer) {
    const base = layer === 0 ? 66 : 40;
    const amp = layer === 0 ? 34 : 22;
    const speed = layer === 0 ? 0.05 : 0.11;
    const col = layer === 0 ? 'rgba(74,98,128,0.75)' : 'rgba(96,122,150,0.6)';
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, horizonY + 2);
    for (let x = 0; x <= w; x += 16) {
      const wx = x + camZ * speed * 10 - camX * (layer === 0 ? 2 : 5);
      const y = horizonY - base - amp * Math.abs(Math.sin(wx * 0.004) * 0.7 + Math.sin(wx * 0.011 + 2) * 0.5) - amp * 0.4 * Math.sin(wx * 0.027 + 1);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, horizonY + 2);
    ctx.closePath();
    ctx.fill();
  }

  function drawClouds(w, horizonY, camZ, camX, clouds, camDepth) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const c of clouds) {
      const d = c.z - camZ;
      if (d < 40 || d > VIEW_DIST) continue;
      const sx = w / 2 + (camDepth * (c.x - camX)) / d;
      const sy = horizonY - (camDepth * (c.y - 40)) / d;
      const s = (camDepth * 34 * c.s) / d;
      if (sx < -120 || sx > w + 120 || sy < -60 || sy > horizonY) continue;
      ctx.beginPath();
      ctx.ellipse(sx, sy, s, s * 0.32, 0, 0, Math.PI * 2);
      ctx.ellipse(sx - s * 0.5, sy + s * 0.08, s * 0.6, s * 0.26, 0, 0, Math.PI * 2);
      ctx.ellipse(sx + s * 0.55, sy + s * 0.06, s * 0.65, s * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlane(w, h, state, time) {
    const cx = w / 2;
    const cy = h * 0.6 - state.pitch * 16;
    const scale = Math.min(w, h) / 720;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-state.roll * 0.85);
    ctx.scale(scale, scale);
    // Wings (rear view, slight dihedral).
    ctx.fillStyle = '#c23b2e';
    ctx.beginPath();
    ctx.moveTo(-118, 6); ctx.lineTo(-16, -8); ctx.lineTo(-14, 8); ctx.lineTo(-112, 22); ctx.closePath();
    ctx.moveTo(118, 6); ctx.lineTo(16, -8); ctx.lineTo(14, 8); ctx.lineTo(112, 22); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e8e4da';
    ctx.beginPath();
    ctx.moveTo(-112, 10); ctx.lineTo(-16, -2); ctx.lineTo(-14, 6); ctx.lineTo(-108, 20); ctx.closePath();
    ctx.moveTo(112, 10); ctx.lineTo(16, -2); ctx.lineTo(14, 6); ctx.lineTo(108, 20); ctx.closePath();
    ctx.fill();
    // Tailplane.
    ctx.fillStyle = '#8f2a20';
    ctx.beginPath();
    ctx.moveTo(-46, -38); ctx.lineTo(-12, -46); ctx.lineTo(-10, -36); ctx.lineTo(-42, -28); ctx.closePath();
    ctx.moveTo(46, -38); ctx.lineTo(12, -46); ctx.lineTo(10, -36); ctx.lineTo(42, -28); ctx.closePath();
    ctx.fill();
    // Fuselage.
    const fg = ctx.createLinearGradient(-14, 0, 14, 0);
    fg.addColorStop(0, '#d8d2c4');
    fg.addColorStop(0.5, '#f4f0e4');
    fg.addColorStop(1, '#b9b2a2');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-13, 26);
    ctx.quadraticCurveTo(-16, -30, -8, -52);
    ctx.quadraticCurveTo(0, -58, 8, -52);
    ctx.quadraticCurveTo(16, -30, 13, 26);
    ctx.quadraticCurveTo(0, 34, -13, 26);
    ctx.fill();
    // Tail fin.
    ctx.fillStyle = '#c23b2e';
    ctx.beginPath();
    ctx.moveTo(-4, -50); ctx.lineTo(-3, -78); ctx.lineTo(5, -78); ctx.lineTo(6, -50); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f4f0e4';
    ctx.beginPath();
    ctx.moveTo(-3, -62); ctx.lineTo(4, -62); ctx.lineTo(4, -70); ctx.lineTo(-3, -70); ctx.closePath();
    ctx.fill();
    // Cockpit glass.
    ctx.fillStyle = '#16324a';
    ctx.beginPath();
    ctx.ellipse(0, -38, 8, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,220,255,0.7)';
    ctx.beginPath();
    ctx.ellipse(-2, -41, 3, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Registration stripe.
    ctx.fillStyle = '#1d4e89';
    ctx.fillRect(-13, 8, 26, 5);
    // Nav lights, blinking.
    if (Math.floor(time * 2) % 2 === 0) {
      ctx.fillStyle = '#ff4444';
      ctx.beginPath(); ctx.arc(-118, 12, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#44ff77';
      ctx.beginPath(); ctx.arc(118, 12, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = 'rgba(8,18,30,0.55)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(120,220,255,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  }

  function drawHud(w, h, state, world) {
    const ft = Math.round(state.alt * 3.281);
    const kts = Math.round(state.speed * 1.944);
    const hdg = Math.round(((state.heading % 360) + 360) % 360);
    const vsFpm = Math.round(state.vs * 196.85);
    ctx.save();
    ctx.shadowColor = 'rgba(120,220,255,0.9)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#bfefff';
    ctx.font = 'bold 15px ui-monospace, Menlo, monospace';
    ctx.textBaseline = 'top';
    // Left instrument block.
    panel(14, 14, 196, 108);
    ctx.fillText(`ALT  ${String(ft).padStart(5, ' ')} FT`, 24, 24);
    ctx.fillText(`SPD  ${String(kts).padStart(5, ' ')} KT`, 24, 48);
    ctx.fillText(`HDG  ${String(hdg).padStart(3, '0')}°`, 24, 72);
    ctx.fillText(`VSI  ${vsFpm >= 0 ? '+' : ''}${vsFpm} FPM`, 24, 96);
    // Right block: fuel, hull, throttle, crates.
    panel(w - 210, 14, 196, 108);
    ctx.fillText('FUEL', w - 200, 24);
    ctx.fillStyle = state.fuel > 25 ? '#7dffa8' : '#ff5a4e';
    ctx.fillRect(w - 200, 46, 176 * clamp(state.fuel / 100, 0, 1), 10);
    ctx.strokeStyle = 'rgba(191,239,255,0.5)';
    ctx.strokeRect(w - 200.5, 45.5, 176, 10);
    ctx.fillStyle = '#bfefff';
    ctx.fillText('HULL', w - 200, 64);
    ctx.fillStyle = state.damage < 50 ? '#7dffa8' : '#ff5a4e';
    ctx.fillRect(w - 200, 86, 176 * clamp(1 - state.damage / 100, 0, 1), 10);
    ctx.strokeStyle = 'rgba(191,239,255,0.5)';
    ctx.strokeRect(w - 200.5, 85.5, 176, 10);
    ctx.fillText(`THR ${Math.round(state.throttle * 100)}%`, w - 200, 104);
    // Mission banner, top centre.
    const mission = world.state.mission;
    let objective = '';
    if (mission === 1) objective = `RINGS ${world.state.ringsHit}/10`;
    else if (mission === 2) objective = `DROPS ${world.state.zonesHit}/5   CRATES ${world.state.crates}`;
    else objective = `LAND ON THE RUNWAY`;
    ctx.textAlign = 'center';
    ctx.font = 'bold 17px ui-monospace, Menlo, monospace';
    ctx.fillText(`MISSION ${mission} — ${objective}`, w / 2, 20);
    ctx.font = 'bold 26px ui-monospace, Menlo, monospace';
    ctx.fillText(String(world.state.score), w / 2, 46);
    ctx.font = '12px ui-monospace, Menlo, monospace';
    ctx.fillStyle = 'rgba(191,239,255,0.75)';
    ctx.fillText('SCORE', w / 2, 76);
    ctx.textAlign = 'left';
    // Compass strip, bottom centre.
    const cw = 360;
    const cx0 = w / 2 - cw / 2;
    panel(cx0 - 10, h - 46, cw + 20, 32);
    ctx.fillStyle = '#bfefff';
    ctx.font = '12px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    for (let d = -60; d <= 60; d += 15) {
      const deg = Math.round(((hdg + d) % 360 + 360) % 360);
      const x = w / 2 + d * 3;
      ctx.fillText(deg === 0 ? 'N' : deg === 90 ? 'E' : deg === 180 ? 'S' : deg === 270 ? 'W' : String(deg), x, h - 40);
      ctx.fillRect(x - 0.5, h - 24, 1, 6);
    }
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(w / 2 - 1, h - 46, 2, 10);
    ctx.textAlign = 'left';
    // Centre reticle + next target distance.
    ctx.strokeStyle = 'rgba(191,239,255,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.44, 14, 0, Math.PI * 2);
    ctx.moveTo(w / 2 - 20, h * 0.44);
    ctx.lineTo(w / 2 - 8, h * 0.44);
    ctx.moveTo(w / 2 + 8, h * 0.44);
    ctx.lineTo(w / 2 + 20, h * 0.44);
    ctx.stroke();
    const target = mission === 1 ? world.nextRing() : mission === 2 ? world.nextZone() : null;
    if (target) {
      const dist = Math.max(0, Math.round(target.z - state.z));
      ctx.textAlign = 'center';
      ctx.font = 'bold 13px ui-monospace, Menlo, monospace';
      ctx.fillStyle = '#ffd166';
      ctx.fillText(mission === 1 ? `NEXT RING ${dist} m` : `NEXT ZONE ${dist} m`, w / 2, h * 0.44 + 26);
      ctx.textAlign = 'left';
    }
    if (mission === 3 && !state.landed) {
      const dist = Math.max(0, Math.round(RUNWAY.z0 - state.z));
      ctx.textAlign = 'center';
      ctx.font = 'bold 13px ui-monospace, Menlo, monospace';
      ctx.fillStyle = '#ffd166';
      ctx.fillText(state.z < RUNWAY.z0 ? `RUNWAY ${dist} m — SLOW DOWN, FLARE GENTLY` : 'ON THE STRIP — HOLD HER LEVEL', w / 2, h * 0.44 + 26);
      ctx.textAlign = 'left';
    }
    // Flash message.
    if (state.messageT > 0 && state.message) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 22px ui-monospace, Menlo, monospace';
      ctx.fillStyle = '#ffd166';
      ctx.fillText(state.message, w / 2, h * 0.24);
      ctx.textAlign = 'left';
    }
    ctx.restore();
  }

  function overlay(w, h, lines, accent) {
    ctx.fillStyle = 'rgba(6,12,22,0.62)';
    ctx.fillRect(0, 0, w, h);
    const bw = Math.min(640, w - 60);
    const bh = 54 + lines.length * 30;
    const bx = (w - bw) / 2;
    const by = (h - bh) / 2;
    ctx.fillStyle = 'rgba(8,18,30,0.82)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = 'bold 30px ui-monospace, Menlo, monospace';
    ctx.fillText(lines[0], w / 2, by + 26);
    ctx.fillStyle = '#e8f4ff';
    ctx.font = '15px ui-monospace, Menlo, monospace';
    lines.slice(1).forEach((line, i) => {
      ctx.fillText(line, w / 2, by + 62 + i * 26);
    });
    ctx.textAlign = 'left';
  }

  function draw(state, world, screen, best) {
    resize();
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const camZ = state.z;
    const camX = state.x;
    const camAlt = state.alt;
    const camDepth = (h / 2) / 0.767;
    const horizonY = h * 0.42 + state.pitch * 90;

    drawSky(w, h, horizonY, state.time);
    drawMountains(w, h, horizonY, camZ, camX, 0);
    drawMountains(w, h, horizonY, camZ, camX, 1);

    // Bank the world a little with the roll.
    ctx.save();
    ctx.translate(w / 2, h * 0.55);
    ctx.rotate(-state.roll * 0.1);
    ctx.translate(-w / 2, -h * 0.55);

    // Ground bands, far to near.
    const segCount = Math.ceil(VIEW_DIST / SEG_LEN);
    let prevY = horizonY;
    for (let i = segCount; i >= 0; i -= 1) {
      const d = Math.max(8, i * SEG_LEN);
      const z = camZ + d;
      const e = world.groundAt(z);
      const y = horizonY + (camDepth * (camAlt - e)) / d;
      if (i < segCount) {
        const haze = clamp(1 - d / VIEW_DIST, 0, 1) * 0.55;
        const onRunway = z >= RUNWAY.z0 && z <= RUNWAY.z1;
        const field = FIELDS[Math.floor(hash(i + Math.floor(camZ / SEG_LEN)) * FIELDS.length)];
        const col = onRunway ? [96, 96, 100] : field;
        ctx.fillStyle = mix3(col, SKY_HORIZON, haze * 0.7);
        ctx.fillRect(-40, Math.min(prevY, y), w + 80, Math.abs(prevY - y) + 1.5);
        // Field patch: a darker strip across part of the band.
        if (!onRunway && hash(i * 7 + 3) < 0.5) {
          const px = hash(i * 13 + 1) * w;
          ctx.fillStyle = mix3([52, 96, 52], SKY_HORIZON, haze * 0.7);
          ctx.fillRect(px, Math.min(prevY, y), w * 0.22, Math.abs(prevY - y) + 1.5);
        }
        // Runway centreline dashes.
        if (onRunway) {
          const cx = w / 2 - (camDepth * camX) / d;
          const half = (camDepth * RUNWAY.halfWidth) / d;
          ctx.strokeStyle = 'rgba(255,255,255,0.85)';
          ctx.lineWidth = Math.max(1, half * 0.08);
          ctx.beginPath();
          ctx.moveTo(cx, y);
          ctx.lineTo(cx, prevY);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,0.5)';
          ctx.lineWidth = Math.max(1, half * 0.06);
          ctx.beginPath();
          ctx.moveTo(cx - half, y);
          ctx.lineTo(cx - half, prevY);
          ctx.moveTo(cx + half, y);
          ctx.lineTo(cx + half, prevY);
          ctx.stroke();
        }
      }
      prevY = y;
    }

    // Objects, far to near: zones, trees, rings, falling crates.
    const drawables = [];
    for (const zn of world.course.zones) {
      const d = zn.z - camZ;
      if (d > 20 && d < VIEW_DIST) drawables.push({ d, kind: 'zone', o: zn });
    }
    for (const t of world.trees) {
      const d = t.z - camZ;
      if (d > 20 && d < VIEW_DIST) drawables.push({ d, kind: 'tree', o: t });
    }
    for (const r of world.course.rings) {
      const d = r.z - camZ;
      if (d > 10 && d < VIEW_DIST) drawables.push({ d, kind: 'ring', o: r });
    }
    for (const c of state.cratesFalling) {
      const d = c.z - camZ;
      if (d > 5 && d < VIEW_DIST) drawables.push({ d, kind: 'crate', o: c });
    }
    drawables.sort((a, b) => b.d - a.d);
    for (const item of drawables) {
      const { d } = item;
      if (item.kind === 'zone') {
        const zn = item.o;
        const sx = w / 2 + (camDepth * (zn.x - camX)) / d;
        const gy = horizonY + (camDepth * (camAlt - world.groundAt(zn.z))) / d;
        const rx = (camDepth * zn.r) / d;
        const ry = Math.max(2, rx * 0.16);
        ctx.fillStyle = zn.hit ? 'rgba(80,255,140,0.5)' : `rgba(255,190,60,${0.45 + 0.2 * Math.sin(state.time * 4)})`;
        ctx.beginPath();
        ctx.ellipse(sx, gy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = zn.hit ? '#50ff8c' : '#ffbe3c';
        ctx.lineWidth = 2;
        ctx.stroke();
        if (zn.hit) {
          ctx.fillStyle = '#50ff8c';
          ctx.font = `bold ${Math.max(11, Math.min(22, rx * 0.5))}px ui-monospace, monospace`;
          ctx.textAlign = 'center';
          ctx.fillText('SUPPLIED ✓', sx, gy - ry - 8);
          ctx.textAlign = 'left';
        }
      } else if (item.kind === 'tree') {
        const t = item.o;
        const sx = w / 2 + (camDepth * (t.x - camX)) / d;
        const gy = horizonY + (camDepth * (camAlt - world.groundAt(t.z))) / d;
        const s = (camDepth * 9 * t.s) / d;
        if (s < 2 || sx < -20 || sx > w + 20) continue;
        ctx.fillStyle = '#2c5a2e';
        ctx.beginPath();
        ctx.moveTo(sx, gy - s * 2.4);
        ctx.lineTo(sx - s * 0.8, gy);
        ctx.lineTo(sx + s * 0.8, gy);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#5a3a22';
        ctx.fillRect(sx - s * 0.1, gy - s * 0.4, s * 0.2, s * 0.4);
      } else if (item.kind === 'ring') {
        const r = item.o;
        const sx = w / 2 + (camDepth * (r.x - camX)) / d;
        const sy = horizonY + (camDepth * (camAlt - r.alt)) / d;
        const rr = (camDepth * r.r) / d;
        if (rr < 3 || sx < -rr || sx > w + rr) continue;
        const col = r.hit ? '#50ff8c' : r.passed ? 'rgba(255,90,78,0.55)' : '#ffc93c';
        ctx.lineWidth = Math.max(2, rr * 0.14);
        ctx.strokeStyle = col;
        ctx.beginPath();
        ctx.ellipse(sx, sy, rr, rr * 0.94, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = Math.max(1, rr * 0.05);
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, rr * 0.86, rr * 0.8, 0, 0, Math.PI * 2);
        ctx.stroke();
        // Strut down to the ground so the ring's height reads.
        const gy = horizonY + (camDepth * (camAlt - world.groundAt(r.z))) / d;
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx, sy + rr * 0.94);
        ctx.lineTo(sx, gy);
        ctx.stroke();
      } else if (item.kind === 'crate') {
        const c = item.o;
        // A crate falls just ahead of the camera: clamp its projection
        // distance so it stays on screen below the nose instead of
        // blowing up as its distance goes to zero.
        const pd = Math.max(d, 60);
        const sx = w / 2 + (camDepth * (c.x - camX)) / pd;
        const sy = horizonY + (camDepth * (camAlt - c.alt)) / pd;
        const s = Math.max(3, (camDepth * 2.2) / pd);
        ctx.fillStyle = '#c98f3d';
        ctx.fillRect(sx - s, sy - s, s * 2, s * 2);
        ctx.strokeStyle = '#6b4a1a';
        ctx.strokeRect(sx - s, sy - s, s * 2, s * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(sx - s * 0.2, sy - s, s * 0.4, s * 2);
      }
    }

    drawClouds(w, horizonY, camZ, camX, world.clouds, camDepth);
    ctx.restore();

    // Speed streaks at the edges when fast.
    if (state.speed > 85 && screen === SCREEN_PLAY) {
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i += 1) {
        const y = hash(i * 31 + Math.floor(state.time * 30)) * h;
        const len = 30 + hash(i * 17) * 60;
        const x = i % 2 === 0 ? hash(i * 7) * 60 : w - hash(i * 11) * 60;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + len);
        ctx.stroke();
      }
    }

    drawPlane(w, h, state, state.time);
    drawHud(w, h, state, world);

    if (screen === SCREEN_TITLE) {
      overlay(w, h, [
        'SKY COURIER',
        'Three sorties. One little plane. Bring her home.',
        'Arrows / WASD — fly    Shift / Ctrl — throttle',
        'Space — drop a crate    P — pause    M — mute',
        best > 0 ? `Best score: ${best}` : 'Fly the rings, drop the supplies, land her.',
        'Press Space or click to fly',
      ], '#ffd166');
    } else if (screen === SCREEN_BRIEF) {
      const m = world.state.mission;
      const defs = [
        null,
        ['MISSION 1 — RING RUN', 'Fly through all 10 rings. Throttle with Shift / Ctrl,', 'steer with the arrow keys or WASD. Rings pay 100,', 'streaks pay extra. Press Space to launch.'],
        ['MISSION 2 — SUPPLY DROP', 'Five villages need supplies. Press Space over a', 'marked circle to drop a crate — it keeps your speed,', 'so release a little early. 6 crates, 5 zones.', 'Press Space to launch.'],
        ['MISSION 3 — STORM LANDING', 'Crosswind from the right. Land on the runway:', 'slow, level, gentle — under 100 m/s and under', '7 m/s descent, inside the strip. Press Space.'],
      ];
      overlay(w, h, defs[m] ?? defs[1], '#7dd7ff');
    } else if (screen === SCREEN_PAUSED) {
      overlay(w, h, ['PAUSED', 'Press P or Space to keep flying'], '#bfefff');
    } else if (screen === SCREEN_FAIL) {
      overlay(w, h, [
        'DOWN!',
        state.crashReason || 'She went down.',
        `Score so far: ${state.score}`,
        'Press Space to retry this mission',
      ], '#ff5a4e');
    } else if (screen === SCREEN_MISSION_DONE) {
      overlay(w, h, [
        'MISSION COMPLETE',
        `Score: ${state.score}`,
        'Press Space for the next sortie',
      ], '#7dffa8');
    } else if (screen === SCREEN_WIN) {
      const rating = state.score >= 3800 ? 'ACE OF THE SKIES' : state.score >= 2800 ? 'SKILLED PILOT' : 'ROOKIE WINGS';
      overlay(w, h, [
        'DELIVERED — ALL MISSIONS COMPLETE',
        rating,
        `Final score: ${state.score}   (best ${Math.max(best, state.score)})`,
        `Landing bonus: +${state.landScore}`,
        'Press Space to fly again',
      ], '#ffd166');
    }
  }

  return { draw };
}
