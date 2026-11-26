// Sky Courier — sound, synthesized with WebAudio. No audio files: an
// engine hum whose pitch follows the throttle, a chime for rings and
// deliveries, a thud for drops, a fanfare for landing, noise for a crash.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return;
    started = true;
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter).connect(engineGain).connect(ctx.destination);
      engineOsc.start();
    } catch {
      ctx = null;
    }
  }

  function tone(freq, dur, type, vol, when = 0) {
    if (!ctx || muted) return;
    try {
      const t = ctx.currentTime + when;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + dur + 0.05);
    } catch {
      // Sound is garnish; never let it break the game.
    }
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    setMuted(m) { muted = m; if (engineGain) engineGain.gain.value = 0; },
    isMuted() { return muted; },
    engine(throttle, flying) {
      if (!ctx || muted || !engineGain) return;
      engineGain.gain.value = flying ? 0.03 + throttle * 0.05 : 0;
      if (engineOsc) engineOsc.frequency.value = 48 + throttle * 55;
    },
    ring(streak = 0) {
      // The chime climbs with the streak: each consecutive ring rings a
      // little higher, so a hot streak sounds hot.
      const lift = 1 + Math.min(streak, 8) * 0.06;
      tone(880 * lift, 0.25, 'sine', 0.16);
      tone(1318 * lift, 0.35, 'sine', 0.12, 0.07);
      if (streak >= 4) tone(1760 * lift, 0.3, 'sine', 0.1, 0.14);
    },
    balloon() {
      // A happy little arpeggio for buzzing the balloon.
      tone(784, 0.15, 'sine', 0.15);
      tone(988, 0.15, 'sine', 0.15, 0.1);
      tone(1175, 0.3, 'sine', 0.15, 0.2);
    },
    zone() { tone(659, 0.2, 'sine', 0.15); tone(988, 0.3, 'sine', 0.13, 0.08); },
    drop() { tone(220, 0.12, 'triangle', 0.12); },
    crash() {
      if (!ctx || muted) return;
      try {
        const len = ctx.sampleRate * 0.5;
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const g = ctx.createGain();
        g.gain.value = 0.3;
        src.connect(g).connect(ctx.destination);
        src.start();
      } catch { /* ignore */ }
      tone(70, 0.6, 'sawtooth', 0.2);
    },
    land() {
      tone(523, 0.18, 'sine', 0.16);
      tone(659, 0.18, 'sine', 0.16, 0.14);
      tone(784, 0.3, 'sine', 0.16, 0.28);
      tone(1046, 0.45, 'sine', 0.14, 0.42);
    },
  };
}
