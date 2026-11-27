// Sky Courier — sound, synthesized with WebAudio. No audio files.
// Layers, all generated:
//  * engine: two detuned oscillators (saw + sub-octave square) through a
//    throttle-tracking lowpass, plus a wind-noise loop whose gain follows
//    airspeed — the faster she flies, the more air rushes past.
//  * event sounds: ring chime (climbs with the streak) + shimmer +
//    whoosh, crate pluck + sparkle, bullseye ping + echo, zone chime +
//    thud, drop whistle (a falling crate whistles down), combo fanfare,
//    near-miss whoosh + chirp, balloon arpeggio, landing fanfare (with
//    firework pops on a greased landing), crash boom + debris.
//  * new calls the coordinator may wire (all optional, all safe if never
//    called): missionDone() for EVENT_MISSION_DONE, gust() for a strong
//    gust, thud() for a touchdown thump, firework() for win-screen pops.
// Everything routes through one master gain, so M really mutes
// everything (the old code only silenced the engine oscillator).
// Call signatures stay backwards compatible: engine(throttle, flying)
// still works — pass world.state.speed as a third argument and the wind
// follows airspeed instead of throttle; land() still works — pass
// state.greased and a greaser gets firework pops.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineSub = null;
  let engineFilter = null;
  let engineGain = null;
  let windSrc = null;
  let windFilter = null;
  let windGain = null;
  let noiseBuf = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return;
    started = true;
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ctx.destination);
      // One shared noise buffer (seeded LCG, not Math.random — the same
      // buffer every run, so the wind and the crash sound identical).
      let s = 123456789;
      const next = () => {
        s = (Math.imul(s, 1103515245) + 12345) | 0;
        return ((s >>> 0) / 4294967296) * 2 - 1;
      };
      const len = ctx.sampleRate;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = next();
      // Engine: sawtooth + a sub-octave square, detuned a touch apart
      // so the hum has a beat instead of one flat note.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineSub = ctx.createOscillator();
      engineSub.type = 'square';
      engineSub.frequency.value = 27.5;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineFilter.Q.value = 1.2;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const subGain = ctx.createGain();
      subGain.gain.value = 0.5;
      engineOsc.connect(engineFilter);
      engineSub.connect(subGain).connect(engineFilter);
      engineFilter.connect(engineGain).connect(master);
      engineOsc.start();
      engineSub.start();
      // Wind: looped noise through a bandpass — the rush of air. The
      // band sits where wind lives (400–900 Hz) and opens with speed.
      windSrc = ctx.createBufferSource();
      windSrc.buffer = noiseBuf;
      windSrc.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 500;
      windFilter.Q.value = 0.6;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      windSrc.connect(windFilter).connect(windGain).connect(master);
      windSrc.start();
    } catch {
      ctx = null;
    }
  }

  // One-shot tone, optionally sweeping frequency (a whistle, a boom,
  // a whoosh) and optionally sweeping volume down on its own.
  function tone(freq, dur, type, vol, when = 0, freqEnd = 0) {
    if (!ctx || muted) return;
    try {
      const t = ctx.currentTime + when;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (freqEnd > 0) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + dur + 0.05);
    } catch {
      // Sound is garnish; never let it break the game.
    }
  }

  // A burst of filtered noise: whooshes, thuds, pops, crash debris.
  // freq = bandpass centre, q = narrowness, dur = length.
  function noise(dur, vol, freq, q = 1, when = 0) {
    if (!ctx || muted || !noiseBuf) return;
    try {
      const t = ctx.currentTime + when;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.playbackRate.value = 0.7 + (freq % 100) / 400;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(master);
      src.start(t);
      src.stop(t + dur + 0.05);
    } catch {
      // Sound is garnish; never let it break the game.
    }
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 1;
      if (engineGain && m) engineGain.gain.value = 0;
      if (windGain && m) windGain.gain.value = 0;
    },
    isMuted() { return muted; },
    // speed (m/s, optional): when the coordinator passes
    // world.state.speed, the wind follows airspeed; otherwise it
    // follows the throttle as a rough proxy.
    engine(throttle, flying, speed = 0) {
      if (!ctx || muted || !engineGain) return;
      const air = speed > 0 ? speed : 40 + throttle * 60;
      engineGain.gain.value = flying ? 0.03 + throttle * 0.05 : 0;
      const f = 48 + throttle * 55;
      if (engineOsc) engineOsc.frequency.value = f;
      if (engineSub) engineSub.frequency.value = f / 2 + 0.6;
      if (engineFilter) engineFilter.frequency.value = 280 + throttle * 500;
      // Wind rush: silent on the ground, swelling with airspeed.
      if (windGain && windFilter) {
        windGain.gain.value = flying ? Math.max(0, (air - 45) / 90) * 0.055 : 0;
        windFilter.frequency.value = 380 + air * 6;
      }
    },
    ring(streak = 0) {
      // The chime climbs with the streak: each consecutive ring rings a
      // little higher, so a hot streak sounds hot. A soft whoosh under
      // it sells passing through the hoop, and a high shimmer sparkles
      // on top when the streak is running.
      const lift = 1 + Math.min(streak, 8) * 0.06;
      noise(0.25, 0.1, 1400, 0.8);
      tone(880 * lift, 0.25, 'sine', 0.16);
      tone(1318 * lift, 0.35, 'sine', 0.12, 0.07);
      if (streak >= 4) tone(1760 * lift, 0.3, 'sine', 0.1, 0.14);
      if (streak >= 2) tone(2637 * lift, 0.22, 'sine', 0.06, 0.1);
      if (streak >= 6) tone(3520 * lift, 0.25, 'sine', 0.05, 0.16);
    },
    balloon() {
      // A happy little arpeggio for buzzing the balloon, with a shimmer.
      tone(784, 0.15, 'sine', 0.15);
      tone(988, 0.15, 'sine', 0.15, 0.1);
      tone(1175, 0.3, 'sine', 0.15, 0.2);
      tone(1568, 0.25, 'sine', 0.07, 0.28);
    },
    crate() {
      // A bright two-note pluck for grabbing a sky crate, plus a gold
      // sparkle run — the crate pays, so it should sound like it pays.
      tone(1046, 0.12, 'triangle', 0.16);
      tone(1568, 0.2, 'triangle', 0.14, 0.08);
      tone(2093, 0.16, 'sine', 0.08, 0.16);
      tone(2637, 0.2, 'sine', 0.06, 0.22);
    },
    bullseye() {
      // A single high ping for a crate dead on the zone centre, with a
      // soft echo a beat later — the drop run's precision moment.
      tone(2093, 0.3, 'sine', 0.16);
      tone(2637, 0.35, 'sine', 0.12, 0.06);
      tone(2093, 0.4, 'sine', 0.06, 0.35);
      tone(3136, 0.3, 'sine', 0.05, 0.42);
    },
    combo() {
      // The ON FIRE fanfare: a quick rising run when a streak peaks,
      // over a swell of noise — the loudest happy sound in the game.
      noise(0.5, 0.08, 900, 0.7);
      tone(1046, 0.12, 'sine', 0.16);
      tone(1318, 0.12, 'sine', 0.16, 0.09);
      tone(1568, 0.12, 'sine', 0.16, 0.18);
      tone(2093, 0.3, 'sine', 0.14, 0.27);
      tone(2637, 0.35, 'sine', 0.08, 0.36);
    },
    nearMiss() {
      // A startled little two-note chirp for threading the flock, over
      // the whoosh of the birds flashing past.
      noise(0.3, 0.14, 2200, 1.2);
      tone(1568, 0.1, 'sine', 0.14, 0.05);
      tone(2093, 0.18, 'sine', 0.12, 0.13);
    },
    zone() {
      // Chime plus a low thud: the crate has thumped into the zone.
      tone(659, 0.2, 'sine', 0.15);
      tone(988, 0.3, 'sine', 0.13, 0.08);
      tone(180, 0.22, 'sine', 0.16, 0.02);
      noise(0.12, 0.12, 220, 1);
    },
    drop() {
      // The crate whistles as it falls away: a descending sine sweep
      // over most of a second, then a soft release click up front.
      tone(220, 0.12, 'triangle', 0.12);
      tone(950, 0.85, 'sine', 0.07, 0.05, 320);
    },
    crash() {
      // A real crash: a half-second tearing noise, a low boom that
      // falls from 120 Hz to 30, and a crackle of debris after it.
      noise(0.7, 0.32, 700, 0.6);
      tone(120, 0.7, 'sawtooth', 0.22, 0, 30);
      tone(55, 0.9, 'sine', 0.25, 0.05, 28);
      noise(0.4, 0.1, 2600, 2, 0.25);
      noise(0.3, 0.08, 1800, 2, 0.45);
    },
    land(greased = false) {
      // The landing fanfare: a rising four-note phrase with a warm bass
      // under it. A greased landing gets firework pops after the phrase.
      tone(523, 0.18, 'sine', 0.16);
      tone(392, 0.4, 'sine', 0.1);
      tone(659, 0.18, 'sine', 0.16, 0.14);
      tone(523, 0.4, 'sine', 0.09, 0.14);
      tone(784, 0.3, 'sine', 0.16, 0.28);
      tone(659, 0.4, 'sine', 0.09, 0.28);
      tone(1046, 0.45, 'sine', 0.14, 0.42);
      tone(784, 0.5, 'sine', 0.1, 0.42);
      if (greased) {
        this.firework(0.7);
        this.firework(1.0);
        this.firework(1.35);
      }
    },
    // --- New calls the coordinator may wire (safe if never called) ---
    missionDone() {
      // Short jingle for EVENT_MISSION_DONE: mission complete, onward.
      tone(659, 0.14, 'sine', 0.14);
      tone(880, 0.14, 'sine', 0.14, 0.11);
      tone(1175, 0.28, 'sine', 0.13, 0.22);
    },
    thud() {
      // Touchdown thump: low sine + a puff of noise.
      tone(140, 0.18, 'sine', 0.2, 0, 60);
      noise(0.1, 0.14, 240, 1);
    },
    gust() {
      // A gust swelling past: banded noise rising and falling.
      noise(0.6, 0.12, 600, 0.7);
      noise(0.5, 0.08, 1100, 0.8, 0.15);
    },
    firework(when = 0) {
      // One firework pop: a sharp crack and a rising whistle tail.
      noise(0.12, 0.2, 3200, 2, when);
      tone(700, 0.5, 'sine', 0.05, when + 0.05, 1800);
    },
    whistle() {
      // A falling-crate whistle on its own, for the drop run.
      tone(950, 0.85, 'sine', 0.07, 0, 320);
    },
  };
}
