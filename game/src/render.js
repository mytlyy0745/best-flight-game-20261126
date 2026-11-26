// Sky Courier — everything the eye sees: pseudo-3D chase view over
// rolling terrain, the aircraft, the rings and the runway, then the HUD
// instruments and the screen overlays. All drawing is plain 2D canvas.
import { SEG_LEN, VIEW_DIST, RUNWAY, MISSION_Z, RING_COUNT, RATING_LEGEND, RATING_ACE, RATING_SKILLED, GUST_STRONG, WINGMAN_Z0, WINGMAN_Z1 } from './config.js';

export const SCREEN_TITLE = 0;
export const SCREEN_BRIEF = 1;
export const SCREEN_PLAY = 2;
export const SCREEN_PAUSED = 3;
export const SCREEN_FAIL = 4;
export const SCREEN_MISSION_DONE = 5;
export const SCREEN_WIN = 6;

const FIELDS = [
  [96, 148, 74], [124, 168, 82], [74, 128, 66], [176, 164, 96],
  [110, 158, 96], [88, 138, 88], [150, 150, 84], [138, 118, 70],
  [92, 152, 112], [150, 112, 70], [190, 175, 120], [118, 142, 92],
];
const PATCH_COLS = [
  [52, 96, 52], [138, 118, 70], [112, 96, 58], [70, 120, 70],
  [160, 140, 90], [96, 128, 80],
];
const RIVER_COL = [72, 132, 182];
const ROAD_COL = [104, 104, 110];
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
  // A free-running animation clock for moments when the world clock
  // stands still (the win screen): fireworks need time to bloom.
  let animT = 0;
  let lastNow = 0;

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

  function drawSky(w, h, horizonY, time, dusk) {
    // Dusk (mission 3, the day ending as she comes home): the sky cools
    // to violet up top and warms to deep orange at the horizon, and the
    // sun sinks toward the strip.
    const top = dusk ? [58, 66, 138] : SKY_TOP;
    const horizon = dusk ? [255, 166, 88] : SKY_HORIZON;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, `rgb(${top[0]},${top[1]},${top[2]})`);
    g.addColorStop(0.55, dusk ? `rgb(122,110,168)` : `rgb(120,164,205)`);
    g.addColorStop(0.72, `rgb(${horizon[0]},${horizon[1]},${horizon[2]})`);
    g.addColorStop(0.73, dusk ? `rgb(150,130,120)` : `rgb(140,170,150)`);
    g.addColorStop(1, dusk ? `rgb(96,84,80)` : `rgb(90,120,80)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // Sun with a soft glow, upper right — lower and warmer at dusk.
    const sx = w * 0.78;
    const sy = horizonY - h * (dusk ? 0.09 : 0.22);
    const glow = ctx.createRadialGradient(sx, sy, 4, sx, sy, dusk ? 130 : 115);
    glow.addColorStop(0, dusk ? 'rgba(255,214,150,0.95)' : 'rgba(255,244,200,0.95)');
    glow.addColorStop(0.25, dusk ? 'rgba(255,170,90,0.6)' : 'rgba(255,220,140,0.55)');
    glow.addColorStop(1, dusk ? 'rgba(255,170,90,0)' : 'rgba(255,220,140,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sx - 135, sy - 135, 270, 270);
    ctx.fillStyle = dusk ? '#ffe0a8' : '#fff6d8';
    ctx.beginPath();
    ctx.arc(sx, sy, dusk ? 28 : 26, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawMountains(w, h, horizonY, camZ, camX, layer) {
    const base = layer === 0 ? 66 : 40;
    const amp = layer === 0 ? 34 : 22;
    const speed = layer === 0 ? 0.05 : 0.11;
    // Far range is hazier and lighter than the near one (atmospheric
    // perspective), so the ridge reads as distance, not a flat wall.
    // A vertical gradient (light crest, darker base) gives the range
    // volume instead of one flat fill.
    const mg = ctx.createLinearGradient(0, horizonY - 120, 0, horizonY + 2);
    if (layer === 0) {
      mg.addColorStop(0, 'rgba(172,192,214,0.8)');
      mg.addColorStop(1, 'rgba(110,136,162,0.62)');
    } else {
      mg.addColorStop(0, 'rgba(126,150,176,0.72)');
      mg.addColorStop(1, 'rgba(96,122,150,0.6)');
    }
    ctx.fillStyle = mg;
    // Sample the ridge first so snow caps can sit on its peaks.
    const ridge = [];
    for (let x = 0; x <= w; x += 16) {
      const wx = x + camZ * speed * 10 - camX * (layer === 0 ? 2 : 5);
      const y = horizonY - base - amp * Math.abs(Math.sin(wx * 0.004) * 0.7 + Math.sin(wx * 0.011 + 2) * 0.5) - amp * 0.4 * Math.sin(wx * 0.027 + 1);
      ridge.push([x, y]);
    }
    ctx.beginPath();
    ctx.moveTo(0, horizonY + 2);
    for (const [x, y] of ridge) ctx.lineTo(x, y);
    ctx.lineTo(w, horizonY + 2);
    ctx.closePath();
    ctx.fill();
    // Lit ridge edge: a faint highlight along the crest so the range
    // has a sunlit side instead of one flat fill.
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = 0; k < ridge.length; k += 1) {
      const [x, y] = ridge[k];
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // Snow line on the far range: the crests that rise above it get
    // snow, following the ridge's own shape. The ridge is a smooth
    // rolling wave (local peaks are only ~1 px prominent), so capping
    // individual peaks reads as a white rash — a snow line caps only
    // the tallest humps, and each cap hugs its crest.
    if (layer === 0) {
      const snowLine = horizonY - 105;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.beginPath();
      let started = false;
      for (const [x, y] of ridge) {
        const sy = Math.min(y, snowLine);
        if (!started) { ctx.moveTo(x, sy); started = true; }
        else ctx.lineTo(x, sy);
      }
      ctx.lineTo(w, snowLine);
      ctx.lineTo(0, snowLine);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawHaze(w, horizonY) {
    // A soft pale veil straddling the horizon: it melts the hard line
    // where flat ground meets sky and gives the far world atmosphere.
    const g = ctx.createLinearGradient(0, horizonY - 46, 0, horizonY + 26);
    g.addColorStop(0, 'rgba(246,232,200,0)');
    g.addColorStop(0.55, 'rgba(246,232,200,0.28)');
    g.addColorStop(1, 'rgba(246,232,200,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, horizonY - 46, w, 72);
  }

  function drawClouds(w, horizonY, camZ, camX, clouds, camDepth) {
    for (const c of clouds) {
      const d = c.z - camZ;
      if (d < 40 || d > VIEW_DIST) continue;
      const sx = w / 2 + (camDepth * (c.x - camX)) / d;
      const sy = horizonY - (camDepth * (c.y - 40)) / d;
      const s = (camDepth * 34 * c.s) / d;
      if (sx < -120 || sx > w + 120 || sy < -60 || sy > horizonY) continue;
      // Keep the top strip clear so bright clouds never sit behind the
      // mission banner and wash out its text.
      if (sy - s * 0.32 < 110) continue;
      // Keep clouds out of the mountain band: a low cloud sitting on the
      // ridge reads as a white blob on the mountain, not as a cloud.
      if (sy > horizonY - 50) continue;
      // Shaded underside first, darker and larger than the white body,
      // so the puff reads as a volume rather than a flat white sticker.
      ctx.fillStyle = 'rgba(146,166,198,0.85)';
      ctx.beginPath();
      ctx.ellipse(sx, sy + s * 0.16, s * 0.98, s * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.beginPath();
      ctx.ellipse(sx, sy, s, s * 0.32, 0, 0, Math.PI * 2);
      ctx.ellipse(sx - s * 0.5, sy + s * 0.08, s * 0.6, s * 0.26, 0, 0, Math.PI * 2);
      ctx.ellipse(sx + s * 0.55, sy + s * 0.06, s * 0.65, s * 0.28, 0, 0, Math.PI * 2);
      ctx.ellipse(sx + s * 0.1, sy - s * 0.14, s * 0.55, s * 0.24, 0, 0, Math.PI * 2);
      ctx.ellipse(sx + s * 0.3, sy - s * 0.2, s * 0.42, s * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      // Warm sunlit top edge, so the lit side reads.
      ctx.fillStyle = 'rgba(255,238,200,0.85)';
      ctx.beginPath();
      ctx.ellipse(sx - s * 0.1, sy - s * 0.18, s * 0.55, s * 0.13, 0, 0, Math.PI * 2);
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
    // Wing leading-edge highlight.
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-118, 6); ctx.lineTo(-16, -8);
    ctx.moveTo(118, 6); ctx.lineTo(16, -8);
    ctx.stroke();
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
    ctx.fillStyle = 'rgba(190,225,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(-2, -41, 3.5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Propeller blur: from chase view the spinning disc reads as a faint
    // thin ellipse at the nose, with two blur spokes turning with time.
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.ellipse(0, -54, 15, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    const pa = time * 9;
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-Math.cos(pa) * 13, -54 - Math.sin(pa) * 3);
    ctx.lineTo(Math.cos(pa) * 13, -54 + Math.sin(pa) * 3);
    ctx.stroke();
    // Registration stripe, plus a thin red cheatline below it.
    ctx.fillStyle = '#1d4e89';
    ctx.fillRect(-13, 8, 26, 5);
    ctx.fillStyle = '#c23b2e';
    ctx.fillRect(-13, 15, 26, 2);
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
    // Panels are always followed by HUD text: leave the text colour set.
    ctx.fillStyle = '#bfefff';
  }

  function drawHud(w, h, state, world, screen) {
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
    // Mission banner, top centre — on its own dark panel so it stays
    // readable when a bright cloud drifts behind it.
    const mission = world.state.mission;
    let objective = '';
    if (mission === 1) objective = `RINGS ${world.state.ringsHit}/${RING_COUNT}`;
    else if (mission === 2) objective = `DROPS ${world.state.zonesHit}/5   CRATES ${world.state.crates}`;
    else objective = `LAND ON THE RUNWAY`;
    panel(w / 2 - 235, 8, 470, 88);
    ctx.textAlign = 'center';
    ctx.font = 'bold 17px ui-monospace, Menlo, monospace';
    ctx.fillText(`MISSION ${mission} — ${objective}`, w / 2, 20);
    ctx.font = 'bold 26px ui-monospace, Menlo, monospace';
    ctx.fillText(String(world.state.score), w / 2, 46);
    ctx.font = '12px ui-monospace, Menlo, monospace';
    ctx.fillStyle = 'rgba(191,239,255,0.75)';
    ctx.fillText('SCORE', w / 2, 76);
    ctx.textAlign = 'left';
    // Combo meter: the current ring/zone streak, shown once it is worth
    // bragging about. It climbs gold as the streak builds — the number
    // a player chases after the first few rings. At six it is ON FIRE.
    const combo = mission === 1 ? world.state.streak : mission === 2 ? world.state.zoneStreak : 0;
    if (combo >= 2) {
      const ccol = combo >= 6 ? '#ff9a3c' : combo >= 4 ? '#ffd166' : '#ffe9a8';
      ctx.textAlign = 'center';
      ctx.font = 'bold 15px ui-monospace, Menlo, monospace';
      const clabel = combo >= 6 ? `COMBO x${combo} — ON FIRE` : `COMBO x${combo}`;
      const ctw = ctx.measureText(clabel).width;
      if (combo >= 6) {
        ctx.shadowColor = '#ffd166';
        ctx.shadowBlur = 14;
      }
      ctx.fillStyle = 'rgba(8,18,30,0.6)';
      ctx.fillRect(w / 2 - ctw / 2 - 10, 100, ctw + 20, 22);
      ctx.fillStyle = ccol;
      ctx.fillText(clabel, w / 2, 105);
      ctx.shadowBlur = 0;
      ctx.textAlign = 'left';
    }
    // Wind indicator: the ring run has gusts — show the push so the
    // pilot can correct before the next ring. A strong one gets a shout.
    if (mission === 1 && screen === SCREEN_PLAY) {
      const g = world.state.gust;
      const strong = Math.abs(g) >= GUST_STRONG;
      const arrow = g > 0.5 ? '→' : g < -0.5 ? '←' : '·';
      const wlabel = strong ? `GUST! ${arrow} ${Math.abs(Math.round(g))}` : `WIND ${arrow} ${Math.abs(Math.round(g))}`;
      ctx.textAlign = 'center';
      ctx.font = 'bold 13px ui-monospace, Menlo, monospace';
      const wtw = ctx.measureText(wlabel).width;
      ctx.fillStyle = 'rgba(8,18,30,0.6)';
      ctx.fillRect(w / 2 - wtw / 2 - 10, 128, wtw + 20, 20);
      ctx.fillStyle = strong ? '#ff9a3c' : 'rgba(191,239,255,0.85)';
      ctx.fillText(wlabel, w / 2, 132);
      ctx.textAlign = 'left';
    }
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
    // No target pill on the title screen: it would sit behind the panel
    // and read as a half-hidden label.
    if (target && screen !== SCREEN_TITLE) {
      const dist = Math.max(0, Math.round(target.z - state.z));
      const label = mission === 1 ? `NEXT RING ${dist} m` : `NEXT ZONE ${dist} m`;
      ctx.textAlign = 'center';
      ctx.font = 'bold 13px ui-monospace, Menlo, monospace';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(8,18,30,0.6)';
      ctx.fillRect(w / 2 - tw / 2 - 8, h * 0.44 + 20, tw + 16, 20);
      ctx.fillStyle = '#ffd166';
      ctx.fillText(label, w / 2, h * 0.44 + 26);
      ctx.textAlign = 'left';
    }
    if (mission === 3 && !state.landed && screen !== SCREEN_TITLE) {
      const dist = Math.max(0, Math.round(RUNWAY.z0 - state.z));
      const label3 = state.z < RUNWAY.z0 ? `RUNWAY ${dist} m — SLOW DOWN, FLARE GENTLY` : 'ON THE STRIP — HOLD HER LEVEL';
      ctx.textAlign = 'center';
      ctx.font = 'bold 13px ui-monospace, Menlo, monospace';
      const tw3 = ctx.measureText(label3).width;
      ctx.fillStyle = 'rgba(8,18,30,0.6)';
      ctx.fillRect(w / 2 - tw3 / 2 - 8, h * 0.44 + 20, tw3 + 16, 20);
      ctx.fillStyle = '#ffd166';
      ctx.fillText(label3, w / 2, h * 0.44 + 26);
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

  function overlay(w, h, lines, accent, dy = 0) {
    ctx.fillStyle = 'rgba(6,12,22,0.3)';
    ctx.fillRect(0, 0, w, h);
    const bw = Math.min(640, w - 60);
    const bh = 54 + lines.length * 30;
    const bx = (w - bw) / 2;
    const by = (h - bh) / 2 + dy;
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

  // The wingman flies formation through the ring run: alongside and a
  // little ahead, then peels off to the right and is gone. Pure
  // position-in-time, so the same seed always flies the same formation.
  function wingmanAt(state) {
    const z = state.z;
    if (z < WINGMAN_Z0 || z > WINGMAN_Z1) return null;
    const fadeIn = clamp((z - WINGMAN_Z0) / 100, 0, 1);
    const fadeOut = clamp((WINGMAN_Z1 - z) / 300, 0, 1);
    const peel = clamp((z - 1900) / 300, 0, 1);
    return {
      d: 120, // metres ahead of the camera, in formation
      x: state.x + 70 + peel * 150,
      alt: state.alt + 12 - peel * 40,
      alpha: Math.min(fadeIn, fadeOut),
      roll: -0.15 + peel * 0.6,
    };
  }

  function draw(state, world, screen, best) {
    resize();
    const now = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;
    if (lastNow > 0) animT += Math.min(now - lastNow, 0.1);
    lastNow = now;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const camZ = state.z;
    const camX = state.x;
    const camAlt = state.alt;
    const camDepth = (h / 2) / 0.767;
    const horizonY = h * 0.42 + state.pitch * 90;
    // Dusk settles in for the landing: the day ends as she comes home.
    const dusk = state.mission === 3 ? 1 : 0;

    drawSky(w, h, horizonY, state.time, dusk);
    drawMountains(w, h, horizonY, camZ, camX, 0);
    drawMountains(w, h, horizonY, camZ, camX, 1);
    drawHaze(w, horizonY);

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
        const topY = Math.min(prevY, y);
        const bandH = Math.abs(prevY - y) + 1.5;
        // A cross-road near the village, drawn as a full-width grey band.
        const crossRoad = !onRunway && z >= 5740 && z <= 5770;
        const field = FIELDS[Math.floor(hash(i + Math.floor(camZ / SEG_LEN)) * FIELDS.length)];
        // On the airfield the band is grass; the strip itself is drawn
        // separately below, so the runway reads as a strip in a field
        // instead of the whole world turning grey.
        const col = onRunway ? [104, 140, 86] : crossRoad ? ROAD_COL : field;
        ctx.fillStyle = mix3(col, SKY_HORIZON, haze * 0.7);
        ctx.fillRect(-40, topY, w + 80, bandH);
        // Shade each band top-to-bottom so the ground has depth instead
        // of reading as flat stacked paint.
        const bg = ctx.createLinearGradient(0, topY, 0, topY + bandH);
        bg.addColorStop(0, 'rgba(255,255,255,0.05)');
        bg.addColorStop(1, 'rgba(0,0,0,0.10)');
        ctx.fillStyle = bg;
        ctx.fillRect(-40, topY, w + 80, bandH);
        // Plough furrows: short dashes across the field, so the ground
        // reads as worked farmland instead of flat paint.
        if (!onRunway && !crossRoad && bandH > 4) {
          ctx.fillStyle = mix3([60, 100, 58], SKY_HORIZON, haze * 0.7);
          for (let k = 0; k < 3; k += 1) {
            const fx = hash(i * 31 + k * 17 + 2) * w;
            const fl = w * (0.05 + hash(i * 13 + k * 7) * 0.09);
            ctx.fillRect(fx, topY + bandH * (0.25 + k * 0.25), fl, Math.max(1, bandH * 0.12));
          }
        }
        // The river winds across the farmland (ends before the airfield).
        if (!onRunway && !crossRoad && z < 5600) {
          const rx = w / 2 + (camDepth * (world.riverX(z) - camX)) / d;
          const rw = Math.max(2, (camDepth * 34) / d);
          if (rx + rw > -20 && rx - rw < w + 20) {
            ctx.fillStyle = mix3(RIVER_COL, SKY_HORIZON, haze * 0.7);
            ctx.fillRect(rx - rw / 2, topY, rw, bandH);
          }
        }
        // The lane that runs beside the track, and hedgerows on some bands.
        if (!onRunway && !crossRoad) {
          const lx = w / 2 + (camDepth * (-140 - camX)) / d;
          const lw = Math.max(1.5, (camDepth * 9) / d);
          if (lx + lw > -20 && lx - lw < w + 20) {
            ctx.fillStyle = mix3(ROAD_COL, SKY_HORIZON, haze * 0.7);
            ctx.fillRect(lx - lw / 2, topY, lw, bandH);
          }
          if (hash(i * 29 + 5) < 0.35) {
            ctx.fillStyle = mix3([42, 82, 46], SKY_HORIZON, haze * 0.7);
            ctx.fillRect(-40, topY, w + 80, 2);
          }
        }
        // Field patchwork: two or three irregular plots per band, each a
        // different crop colour with a hedgerow edge, so the ground reads
        // as a patchwork of fields instead of one full-width stripe.
        // Seeded by the band index, so the same band always looks the same.
        if (!onRunway && !crossRoad) {
          const patchCount = 1 + Math.floor(hash(i * 41 + 9) * 2);
          for (let p = 0; p < patchCount; p += 1) {
            const px = hash(i * 47 + p * 23 + 3) * w * 0.85;
            const pw = w * (0.2 + hash(i * 19 + p * 31 + 7) * 0.25);
            const praw = PATCH_COLS[Math.floor(hash(i * 53 + p * 11 + 5) * PATCH_COLS.length)];
            // Mute the patch toward the band's own field colour so plots
            // read as variations of one farm, not foreign slabs.
            const pcol = [Math.round(lerp(praw[0], field[0], 0.3)), Math.round(lerp(praw[1], field[1], 0.3)), Math.round(lerp(praw[2], field[2], 0.3))];
            ctx.fillStyle = mix3(pcol, SKY_HORIZON, haze * 0.7);
            ctx.fillRect(px, topY, pw, bandH);
            // Tall near bands: split the patch horizontally with a
            // hedgerow line and a darker lower half, so a huge
            // foreground band does not read as one flat slab. The split
            // sits inside the VISIBLE part of the band — a tall band
            // runs far below the frame, so a fraction of its full height
            // would land off-screen.
            if (bandH > 60) {
              const visH = Math.min(bandH, h - topY);
              const split = topY + visH * (0.4 + hash(i * 61 + p * 7) * 0.2);
              ctx.fillStyle = mix3([40, 70, 44], SKY_HORIZON, haze * 0.7);
              ctx.fillRect(px, split, pw, Math.max(1, visH * 0.05));
              const darker = [Math.round(pcol[0] * 0.85), Math.round(pcol[1] * 0.85), Math.round(pcol[2] * 0.85)];
              ctx.fillStyle = mix3(darker, SKY_HORIZON, haze * 0.7);
              ctx.fillRect(px, split, pw, topY + bandH - split);
            }
            // Hedgerow along the patch's left edge.
            ctx.fillStyle = mix3([42, 82, 46], SKY_HORIZON, haze * 0.7);
            ctx.fillRect(px, topY, Math.max(1, bandH * 0.1), bandH);
          }
        }
        // Airfield grass: mowing stripes in world space — every other
        // 40 m strip is mown lighter, so the near airfield does not read
        // as one flat warm slab (the near-field warm tint flattens it).
        // Drawn before the strip, so the asphalt covers the middle.
        if (onRunway && !crossRoad) {
          for (let k = -20; k <= 20; k += 1) {
            if (k % 2 !== 0) continue;
            const wx = k * 40;
            const sx = w / 2 + (camDepth * (wx - camX)) / d;
            const sw = Math.max(1.5, (camDepth * 40) / d);
            if (sx + sw < -20 || sx - sw > w + 20) continue;
            ctx.fillStyle = mix3([124, 164, 102], SKY_HORIZON, haze * 0.7);
            ctx.fillRect(sx - sw / 2, topY, sw, bandH);
          }
        }
        // Tall near airfield bands: split horizontally with a mow line
        // and a slightly darker lower half, so the foreground grass is
        // not one flat slab (world-space stripes are wider than the
        // screen this close to the camera, so they cannot do the job).
        // The split sits inside the VISIBLE part of the band.
        if (onRunway && !crossRoad && bandH > 60) {
          const visH = Math.min(bandH, h - topY);
          const split = topY + visH * (0.45 + hash(i * 71 + 3) * 0.15);
          ctx.fillStyle = mix3([70, 110, 60], SKY_HORIZON, haze * 0.7);
          ctx.fillRect(-40, split, w + 80, Math.max(1, visH * 0.05));
          ctx.fillStyle = mix3([88, 119, 73], SKY_HORIZON, haze * 0.7);
          ctx.fillRect(-40, split, w + 80, topY + bandH - split);
        }
        // The runway: asphalt strip on the grass, thin dashed centreline,
        // edge lines, taxiway and amber edge lights. Line widths are
        // clamped — the old unclamped widths turned into giant white
        // blocks when the camera got low over the strip.
        if (onRunway) {
          const cx = w / 2 - (camDepth * camX) / d;
          const half = (camDepth * RUNWAY.halfWidth) / d;
          // Asphalt strip.
          ctx.fillStyle = mix3([88, 88, 96], SKY_HORIZON, haze * 0.7);
          ctx.fillRect(cx - half, topY, half * 2, bandH);
          // Tyre marks: two dark wheel tracks down the strip, so the
          // asphalt has texture even at close range, where the strip is
          // wider than the screen and nothing else reads on it.
          for (const side of [-1, 1]) {
            const tx = cx + side * ((camDepth * 6) / d);
            const tw = Math.max(1.5, (camDepth * 2.2) / d);
            ctx.fillStyle = 'rgba(52,52,60,0.4)';
            ctx.fillRect(tx - tw / 2, topY, tw, bandH);
          }
          // Centreline dashes: 20 m of paint, 30 m of gap, in world space.
          const zm = z - SEG_LEN / 2;
          if ((((zm % 50) + 50) % 50) < 20) {
            ctx.strokeStyle = 'rgba(255,255,255,0.85)';
            ctx.lineWidth = Math.min(4, Math.max(1, half * 0.08));
            ctx.beginPath();
            ctx.moveTo(cx, y);
            ctx.lineTo(cx, prevY);
            ctx.stroke();
          }
          // Edge lines, thin.
          ctx.strokeStyle = 'rgba(255,255,255,0.5)';
          ctx.lineWidth = Math.min(3, Math.max(1, half * 0.06));
          ctx.beginPath();
          ctx.moveTo(cx - half, y);
          ctx.lineTo(cx - half, prevY);
          ctx.moveTo(cx + half, y);
          ctx.lineTo(cx + half, prevY);
          ctx.stroke();
          // Expansion joints: a dark line across the strip at the middle
          // of each band (25 m), so the near asphalt has rhythm instead
          // of reading as one flat slab.
          const jointY = topY + bandH / 2;
          ctx.strokeStyle = 'rgba(40,40,48,0.3)';
          ctx.lineWidth = Math.max(1, Math.min(3, half * 0.02));
          ctx.beginPath();
          ctx.moveTo(cx - half, jointY);
          ctx.lineTo(cx + half, jointY);
          ctx.stroke();
          // Repair patches: darker rectangles on the near asphalt, seeded
          // by the band, so the strip has texture even where the
          // centreline and joints are out of frame.
          if (bandH > 20) {
            for (let k = 0; k < 2; k += 1) {
              const rx2 = cx - half + hash(i * 83 + k * 29) * half * 2;
              const rw2 = half * (0.2 + hash(i * 37 + k * 13) * 0.3);
              ctx.fillStyle = 'rgba(60,60,70,0.25)';
              ctx.fillRect(rx2, topY + bandH * (0.2 + k * 0.4), rw2, bandH * 0.25);
            }
          }
          // Threshold bars at the start of the strip: eight white bars
          // across the asphalt, so the runway's beginning reads clearly.
          if (z - RUNWAY.z0 < 60) {
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            const bars = 8;
            for (let b = 0; b < bars; b += 1) {
              const bx0 = cx - half + ((b + 0.15) / bars) * half * 2;
              const bw = (half * 2 * 0.7) / bars;
              ctx.fillRect(bx0, topY, bw, bandH);
            }
          }
          // Mown grass shoulder on the left of the strip, lighter than
          // the surrounding field, so the airfield has a kept edge.
          const shoulderW = Math.max(2, (camDepth * 10) / d);
          ctx.fillStyle = mix3([126, 162, 100], SKY_HORIZON, haze * 0.7);
          ctx.fillRect(cx - half - shoulderW, topY, shoulderW, bandH);
          // Taxiway beside the strip, and amber edge lights down both sides.
          const taxiW = Math.max(2, (camDepth * 12) / d);
          ctx.fillStyle = mix3([70, 70, 78], SKY_HORIZON, haze * 0.7);
          ctx.fillRect(cx + half, topY, taxiW, bandH);
          const midY = (y + prevY) / 2;
          const lr = Math.min(6, Math.max(1, half * 0.05));
          ctx.fillStyle = 'rgba(255,190,60,0.9)';
          ctx.beginPath();
          ctx.arc(cx - half, midY, lr, 0, Math.PI * 2);
          ctx.arc(cx + half, midY, lr, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      prevY = y;
    }

    // Objects, far to near: zones, trees, houses, rings, falling crates.
    const drawables = [];
    for (const zn of world.course.zones) {
      const d = zn.z - camZ;
      if (d > 20 && d < VIEW_DIST) drawables.push({ d, kind: 'zone', o: zn });
    }
    for (const t of world.trees) {
      const d = t.z - camZ;
      if (d > 20 && d < VIEW_DIST) drawables.push({ d, kind: 'tree', o: t });
    }
    for (const hs of world.houses) {
      const d = hs.z - camZ;
      if (d > 20 && d < VIEW_DIST) drawables.push({ d, kind: 'house', o: hs });
    }
    {
      const d = world.windsock.z - camZ;
      if (d > 20 && d < VIEW_DIST) drawables.push({ d, kind: 'sock', o: world.windsock });
    }
    {
      const d = world.hangar.z - camZ;
      if (d > 20 && d < VIEW_DIST) drawables.push({ d, kind: 'hangar', o: world.hangar });
    }
    {
      // Approach light bar just before the strip: a row of white lights.
      const d = 5975 - camZ;
      if (d > 20 && d < VIEW_DIST) drawables.push({ d, kind: 'appr', o: { z: 5975 } });
    }
    for (const r of world.course.rings) {
      const d = r.z - camZ;
      if (d > 10 && d < VIEW_DIST) drawables.push({ d, kind: 'ring', o: r });
    }
    for (const c of state.cratesFalling) {
      const d = c.z - camZ;
      if (d > 5 && d < VIEW_DIST) drawables.push({ d, kind: 'crate', o: c });
    }
    // The balloon drifts over the valley (mission 1 airspace), and the
    // bird flock crosses the track — both seeded, both alive in the frame.
    {
      const bp = world.balloonAt(state.time);
      const d = bp.z - camZ;
      if (state.mission === 1 && d > 20 && d < VIEW_DIST) drawables.push({ d, kind: 'balloon', o: bp });
    }
    for (const b of world.birdsAt(state.time)) {
      const d = b.z - camZ;
      if (d > 20 && d < VIEW_DIST) drawables.push({ d, kind: 'bird', o: b });
    }
    // The wingman joins the formation through the ring run.
    if (state.mission === 1) {
      const wm = wingmanAt(state);
      if (wm) drawables.push({ d: wm.d, kind: 'wingman', o: wm });
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
        // Unhit zones get a vertical light beam, so the target reads
        // from far away instead of being a faint ellipse on the ground.
        if (!zn.hit) {
          const beamTop = Math.max(horizonY - 180, horizonY + (camDepth * (camAlt - (world.groundAt(zn.z) + 150))) / d);
          const bw = Math.min(16, Math.max(2, rx * 0.18));
          const bg2 = ctx.createLinearGradient(0, gy, 0, beamTop);
          bg2.addColorStop(0, `rgba(255,190,60,${0.45 + 0.15 * Math.sin(state.time * 4)})`);
          bg2.addColorStop(1, 'rgba(255,190,60,0)');
          ctx.fillStyle = bg2;
          ctx.fillRect(sx - bw / 2, beamTop, bw, gy - beamTop);
        }
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
        if (d < 30) continue; // too close to read as a tree — it is beside the camera
        const sx = w / 2 + (camDepth * (t.x - camX)) / d;
        const gy = horizonY + (camDepth * (camAlt - world.groundAt(t.z))) / d;
        // Cap the on-screen size: a tree a few dozen metres ahead would
        // otherwise blow up into a giant green disc filling the frame
        // (the drop shot's foreground trees). Real trees this close are
        // beside the camera, not in it.
        let s = (camDepth * 9 * t.s) / d;
        s = Math.min(s, 64);
        if (s < 2 || sx < -20 || sx > w + 20) continue;
        // Soft ground shadow so the tree sits on the field, not on top of it.
        ctx.fillStyle = 'rgba(0,0,0,0.16)';
        ctx.beginPath();
        ctx.ellipse(sx, gy, s * 0.55, s * 0.14, 0, 0, Math.PI * 2);
        ctx.fill();
        const greens = t.round
          ? [['#3a6b35', '#2c5a2e'], ['#4a7a3a', '#356b33'], ['#2f6030', '#274f2a']]
          : [['#2c5a2e', '#356b33', '#3f7a3a'], ['#27512b', '#2f6030', '#3a7038']];
        const g = greens[Math.floor(hash(Math.floor(t.z) * 7 + Math.floor(t.x)) * greens.length)];
        if (t.round) {
          // Round-canopy tree: two overlapping crowns over a trunk, so it
          // reads as a volume from any distance.
          ctx.fillStyle = g[0];
          ctx.beginPath();
          ctx.arc(sx, gy - s * 1.5, s * 0.85, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = g[1];
          ctx.beginPath();
          ctx.arc(sx - s * 0.35, gy - s * 1.15, s * 0.55, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#5a3a22';
          ctx.fillRect(sx - s * 0.1, gy - s * 0.7, s * 0.2, s * 0.7);
        } else {
          // Layered conifer: three stacked tiers, lightest at the top,
          // so a big near pine reads as a pine instead of a flat triangle.
          ctx.fillStyle = g[0];
          ctx.beginPath();
          ctx.moveTo(sx, gy - s * 2.4);
          ctx.lineTo(sx - s * 0.8, gy);
          ctx.lineTo(sx + s * 0.8, gy);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = g[1];
          ctx.beginPath();
          ctx.moveTo(sx, gy - s * 2.4);
          ctx.lineTo(sx - s * 0.58, gy - s * 0.8);
          ctx.lineTo(sx + s * 0.58, gy - s * 0.8);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = g[2];
          ctx.beginPath();
          ctx.moveTo(sx, gy - s * 2.4);
          ctx.lineTo(sx - s * 0.36, gy - s * 1.6);
          ctx.lineTo(sx + s * 0.36, gy - s * 1.6);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#5a3a22';
          ctx.fillRect(sx - s * 0.1, gy - s * 0.4, s * 0.2, s * 0.4);
        }
      } else if (item.kind === 'house') {
        const hs = item.o;
        const sx = w / 2 + (camDepth * (hs.x - camX)) / d;
        const gy = horizonY + (camDepth * (camAlt - world.groundAt(hs.z))) / d;
        const s = (camDepth * 8 * hs.s) / d;
        if (s < 3 || sx < -30 || sx > w + 30) continue;
        const walls = [['#e8dcc0', '#b0503c'], ['#d8c8a8', '#7a4a30'], ['#e0d0b0', '#a03c30']][hs.tone];
        ctx.fillStyle = walls[0];
        ctx.fillRect(sx - s * 0.6, gy - s * 0.9, s * 1.2, s * 0.9);
        ctx.fillStyle = walls[1];
        ctx.beginPath();
        ctx.moveTo(sx - s * 0.75, gy - s * 0.9);
        ctx.lineTo(sx, gy - s * 1.6);
        ctx.lineTo(sx + s * 0.75, gy - s * 0.9);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#2c3a4a';
        ctx.fillRect(sx - s * 0.15, gy - s * 0.55, s * 0.3, s * 0.35);
      } else if (item.kind === 'sock') {
        const o = item.o;
        const sx = w / 2 + (camDepth * (o.x - camX)) / d;
        const gy = horizonY + (camDepth * (camAlt - world.groundAt(o.z))) / d;
        const s = (camDepth * 8) / d;
        if (s < 2 || sx < -30 || sx > w + 30) continue;
        // Windsock: pole with an orange cone streaming downwind (left,
        // the crosswind blows from the right).
        ctx.strokeStyle = '#d8d8d8';
        ctx.lineWidth = Math.max(1, s * 0.08);
        ctx.beginPath();
        ctx.moveTo(sx, gy);
        ctx.lineTo(sx, gy - s * 2.2);
        ctx.stroke();
        ctx.fillStyle = '#ff7a2a';
        ctx.beginPath();
        ctx.moveTo(sx, gy - s * 2.2);
        ctx.lineTo(sx - s * 1.1, gy - s * 1.85);
        ctx.lineTo(sx - s * 1.1, gy - s * 2.05);
        ctx.closePath();
        ctx.fill();
      } else if (item.kind === 'hangar') {
        const o = item.o;
        const sx = w / 2 + (camDepth * (o.x - camX)) / d;
        const gy = horizonY + (camDepth * (camAlt - world.groundAt(o.z))) / d;
        const s = (camDepth * 16 * o.s) / d;
        if (s < 4 || sx < -80 || sx > w + 80) continue;
        ctx.fillStyle = '#7a8a7a';
        ctx.fillRect(sx - s, gy - s * 0.9, s * 2, s * 0.9);
        ctx.beginPath();
        ctx.arc(sx, gy - s * 0.9, s, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#4a5a4a';
        ctx.fillRect(sx - s * 0.6, gy - s * 0.55, s * 1.2, s * 0.55);
      } else if (item.kind === 'appr') {
        const o = item.o;
        const gy = horizonY + (camDepth * (camAlt - world.groundAt(o.z))) / d;
        for (let k = -3; k <= 3; k += 1) {
          const sx = w / 2 + (camDepth * (k * 10 - camX)) / d;
          const r = Math.max(1, (camDepth * 0.9) / d);
          ctx.fillStyle = 'rgba(255,255,255,0.95)';
          ctx.beginPath();
          ctx.arc(sx, gy, r, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (item.kind === 'ring') {
        const r = item.o;
        const sx = w / 2 + (camDepth * (r.x - camX)) / d;
        const sy = horizonY + (camDepth * (camAlt - r.alt)) / d;
        const rr = (camDepth * r.r) / d;
        if (rr < 3 || sx < -rr || sx > w + rr) continue;
        // Golden rings read gold, not yellow, and they sparkle — the
        // player should spot the 250-pointer a long way off.
        const col = r.hit ? '#50ff8c' : r.passed ? 'rgba(255,90,78,0.55)' : r.golden ? '#ffb020' : '#ffc93c';
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
        if (r.golden && !r.hit && !r.passed) {
          // Twinkling four-point sparkles around the golden ring.
          ctx.fillStyle = `rgba(255,230,150,${0.5 + 0.4 * Math.sin(state.time * 5 + r.z)})`;
          for (let k = 0; k < 4; k += 1) {
            const a = (k * Math.PI) / 2 + state.time * 0.4;
            const spx = sx + Math.cos(a) * rr * 1.25;
            const spy = sy + Math.sin(a) * rr * 1.25;
            const ss = Math.max(2, rr * 0.09);
            ctx.beginPath();
            ctx.moveTo(spx, spy - ss);
            ctx.lineTo(spx + ss * 0.3, spy - ss * 0.3);
            ctx.lineTo(spx + ss, spy);
            ctx.lineTo(spx + ss * 0.3, spy + ss * 0.3);
            ctx.lineTo(spx, spy + ss);
            ctx.lineTo(spx - ss * 0.3, spy + ss * 0.3);
            ctx.lineTo(spx - ss, spy);
            ctx.lineTo(spx - ss * 0.3, spy - ss * 0.3);
            ctx.closePath();
            ctx.fill();
          }
        }
        // Hit burst: for a moment after threading a ring, an expanding
        // golden ripple and sparkles bloom off it — the payoff you feel.
        if (r.hit && r.hitT >= 0) {
          const bt = (state.time - r.hitT) / 0.8;
          if (bt < 1) {
            const br = rr * (1 + bt * 1.1);
            ctx.strokeStyle = `rgba(255,210,90,${0.85 * (1 - bt)})`;
            ctx.lineWidth = Math.max(2, rr * 0.12 * (1 - bt));
            ctx.beginPath();
            ctx.ellipse(sx, sy, br, br * 0.94, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = `rgba(255,230,150,${0.9 * (1 - bt)})`;
            for (let k = 0; k < 6; k += 1) {
              const a = (k * Math.PI) / 3 + 0.5;
              const spx = sx + Math.cos(a) * rr * (1 + bt * 0.9);
              const spy = sy + Math.sin(a) * rr * (1 + bt * 0.9);
              ctx.beginPath();
              ctx.arc(spx, spy, Math.max(1.5, rr * 0.06), 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
        // Strut down to the ground so the ring's height reads.
        const gy = horizonY + (camDepth * (camAlt - world.groundAt(r.z))) / d;
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx, sy + rr * 0.94);
        ctx.lineTo(sx, gy);
        ctx.stroke();
      } else if (item.kind === 'balloon') {
        const bp = item.o;
        const sx = w / 2 + (camDepth * (bp.x - camX)) / d;
        const sy = horizonY + (camDepth * (camAlt - bp.alt)) / d;
        const s = (camDepth * 16) / d;
        if (s < 3 || sx < -80 || sx > w + 80) continue;
        // Striped envelope, ropes, and a little basket underneath.
        ctx.fillStyle = '#d84a35';
        ctx.beginPath();
        ctx.ellipse(sx, sy, s, s * 1.15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f4e8c8';
        ctx.beginPath();
        ctx.ellipse(sx, sy, s * 0.45, s * 1.15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#d84a35';
        ctx.beginPath();
        ctx.ellipse(sx, sy, s * 0.16, s * 1.15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#5a3a22';
        ctx.lineWidth = Math.max(1, s * 0.06);
        ctx.beginPath();
        ctx.moveTo(sx - s * 0.5, sy + s * 0.9);
        ctx.lineTo(sx - s * 0.3, sy + s * 1.5);
        ctx.moveTo(sx + s * 0.5, sy + s * 0.9);
        ctx.lineTo(sx + s * 0.3, sy + s * 1.5);
        ctx.stroke();
        ctx.fillStyle = '#6b4a1a';
        ctx.fillRect(sx - s * 0.3, sy + s * 1.5, s * 0.6, s * 0.45);
        if (!state.balloonBuzzed) {
          ctx.fillStyle = '#ffd166';
          ctx.font = `bold ${Math.max(11, Math.min(18, s * 0.5))}px ui-monospace, monospace`;
          ctx.textAlign = 'center';
          ctx.fillText('BUZZ ME +150', sx, sy - s * 1.45);
          ctx.textAlign = 'left';
        }
      } else if (item.kind === 'bird') {
        const b = item.o;
        const sx = w / 2 + (camDepth * (b.x - camX)) / d;
        const sy = horizonY + (camDepth * (camAlt - b.alt)) / d;
        const s = Math.max(2, (camDepth * 3.5) / d);
        if (sx < -20 || sx > w + 20 || sy < 0 || sy > horizonY) continue;
        // A flapping V: two wings that beat as the bird crosses the sky.
        const flap = b.flap * s * 0.5;
        ctx.strokeStyle = 'rgba(40,40,48,0.85)';
        ctx.lineWidth = Math.max(1, s * 0.12);
        ctx.beginPath();
        ctx.moveTo(sx - s, sy - flap);
        ctx.lineTo(sx, sy);
        ctx.lineTo(sx + s, sy - flap);
        ctx.stroke();
      } else if (item.kind === 'wingman') {
        // A little sister ship in formation: red wings, cream fuselage,
        // seen from behind, with a short contrail of her own.
        const wm = item.o;
        const sx = w / 2 + (camDepth * (wm.x - camX)) / d;
        const sy = horizonY + (camDepth * (camAlt - wm.alt)) / d;
        if (sx < -60 || sx > w + 60 || sy < -40 || sy > h + 40) continue;
        ctx.save();
        ctx.globalAlpha = wm.alpha;
        ctx.translate(sx, sy);
        ctx.rotate(wm.roll);
        const ws = 0.3 * (Math.min(w, h) / 720);
        ctx.scale(ws, ws);
        ctx.fillStyle = '#c23b2e';
        ctx.beginPath();
        ctx.moveTo(-118, 6); ctx.lineTo(-16, -8); ctx.lineTo(-14, 8); ctx.lineTo(-112, 22); ctx.closePath();
        ctx.moveTo(118, 6); ctx.lineTo(16, -8); ctx.lineTo(14, 8); ctx.lineTo(112, 22); ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#e8e4da';
        ctx.beginPath();
        ctx.moveTo(-13, 26);
        ctx.quadraticCurveTo(-16, -30, -8, -52);
        ctx.quadraticCurveTo(0, -58, 8, -52);
        ctx.quadraticCurveTo(16, -30, 13, 26);
        ctx.quadraticCurveTo(0, 34, -13, 26);
        ctx.fill();
        ctx.fillStyle = '#c23b2e';
        ctx.beginPath();
        ctx.moveTo(-4, -50); ctx.lineTo(-3, -78); ctx.lineTo(5, -78); ctx.lineTo(6, -50); ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.ellipse(0, -54, 15, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // Her contrail: a short fading streak trailing behind her.
        const g3 = ctx.createLinearGradient(sx, sy + 8, sx - 40, sy + 60);
        g3.addColorStop(0, `rgba(255,255,255,${0.3 * wm.alpha})`);
        g3.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = g3;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx - 8, sy + 8);
        ctx.lineTo(sx - 40, sy + 60);
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
    // Contrails streaming off the wingtips at speed.
    if (state.speed > 90 && screen === SCREEN_PLAY) {
      const scale = Math.min(w, h) / 720;
      const cx = w / 2;
      const cy = h * 0.6 - state.pitch * 16;
      for (const side of [-1, 1]) {
        const x0 = cx + side * 112 * scale;
        const y0 = cy + 12 * scale;
        const g2 = ctx.createLinearGradient(x0, y0, x0 + side * 14 * scale, y0 + 90 * scale);
        g2.addColorStop(0, 'rgba(255,255,255,0.28)');
        g2.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = g2;
        ctx.lineWidth = 2.5 * scale;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + side * 14 * scale, y0 + 90 * scale);
        ctx.stroke();
      }
    }
    drawHud(w, h, state, world, screen);

    // Fireworks over the field when she greases it in: seeded bursts
    // that bloom and fade on a loop, behind the win panel. A greased
    // landing deserves a little sky of its own.
    if (screen === SCREEN_WIN && state.greased) {
      const cols = ['#ffd166', '#ff5a4e', '#7dd7ff', '#7dffa8'];
      for (let i = 0; i < 4; i += 1) {
        const fx = w * (0.12 + hash(i * 7 + 3) * 0.76);
        const fy = h * (0.1 + hash(i * 11 + 5) * 0.22);
        const cycle = (animT * 0.4 + i * 0.37) % 1;
        const fr = 8 + cycle * 46;
        const fa = cycle < 0.7 ? 0.9 * (1 - cycle / 0.7) : 0;
        if (fa <= 0) continue;
        ctx.save();
        ctx.globalAlpha = fa;
        ctx.strokeStyle = cols[i % 4];
        ctx.lineWidth = 2;
        for (let k = 0; k < 10; k += 1) {
          const a = (k / 10) * Math.PI * 2 + i;
          ctx.beginPath();
          ctx.moveTo(fx + Math.cos(a) * fr * 0.4, fy + Math.sin(a) * fr * 0.4);
          ctx.lineTo(fx + Math.cos(a) * fr, fy + Math.sin(a) * fr);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    if (screen === SCREEN_TITLE) {
      overlay(w, h, [
        'SKY COURIER',
        'Three sorties. One little plane. Bring her home.',
        'Arrows / WASD — fly    Shift / Ctrl — throttle',
        'Space — drop a crate    P — pause    M — mute',
        best > 0 ? `Best score: ${best}` : 'Fly the rings, drop the supplies, land her.',
        'Press Space or click to fly',
      ], '#ffd166', -70);
    } else if (screen === SCREEN_BRIEF) {
      const m = world.state.mission;
      const defs = [
        null,
        ['MISSION 1 — RING RUN', 'Fly through all 12 rings. Gusts push you sideways —', 'watch the WIND meter and correct. A wingman flies', 'formation with you for a stretch. Press Space to launch.'],
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
      const rating = state.score >= RATING_LEGEND ? 'LEGEND OF THE SKIES' : state.score >= RATING_ACE ? 'ACE OF THE SKIES' : state.score >= RATING_SKILLED ? 'SKILLED PILOT' : 'ROOKIE WINGS';
      overlay(w, h, [
        'DELIVERED — ALL MISSIONS COMPLETE',
        rating,
        `Final score: ${state.score}   (best ${Math.max(best, state.score)})`,
        `Landing bonus: +${state.landScore}   Best combo: x${state.maxCombo}`,
        'Press Space to fly again',
      ], '#ffd166');
    }
  }

  return { draw };
}
